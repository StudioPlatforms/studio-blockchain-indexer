#!/bin/bash
set -e

# Configuration
INDEXER_HOST=${INDEXER_HOST:-localhost}
INDEXER_PORT=${INDEXER_PORT:-3000}
DB_HOST=${DB_HOST:-postgres}
DB_PORT=${DB_PORT:-5432}
DB_NAME=${DB_NAME:-analytics_data}
DB_USER=${DB_USER:-indexer_user}
DB_PASSWORD=${DB_PASSWORD:-strong_password}
CHECK_INTERVAL=${CHECK_INTERVAL:-60}  # Check every 60 seconds
LOG_FILE=${LOG_FILE:-/var/log/enhanced-monitor.log}
BACKUP_DIR=${BACKUP_DIR:-/var/backups/indexer}
SLACK_WEBHOOK_URL=${SLACK_WEBHOOK_URL:-""}  # Optional Slack webhook for notifications
DOCKER_COMPOSE_FILE=${DOCKER_COMPOSE_FILE:-"/project/docker-compose.yml"}
HONEYPOT_DB="studio_indexer"  # Name of the honeypot database

# Ensure log and backup directories exist
mkdir -p $(dirname $LOG_FILE)
mkdir -p $BACKUP_DIR

# Function to log messages
log() {
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a $LOG_FILE
}

# Function to send Slack notification
send_notification() {
  if [ -n "$SLACK_WEBHOOK_URL" ]; then
    curl -s -X POST -H 'Content-type: application/json' \
      --data "{\"text\":\"$1\"}" \
      $SLACK_WEBHOOK_URL
  fi
}

# Function to check if PostgreSQL is running
check_postgres() {
  log "Checking if PostgreSQL is running..."

  if ! docker ps | grep -q mainnet-indexer_postgres_1; then
    log "ERROR: PostgreSQL container is not running"
    return 1
  fi

  # Try to connect to PostgreSQL
  if ! docker exec mainnet-indexer_postgres_1 pg_isready -U postgres > /dev/null 2>&1; then
    log "ERROR: Cannot connect to PostgreSQL server"
    return 1
  fi

  log "PostgreSQL is running"
  return 0
}

# Function to check if the database exists and has tables
check_database() {
  log "Checking database..."

  # Check if we can connect to PostgreSQL
  if ! docker exec mainnet-indexer_postgres_1 psql -U postgres -c '\l' > /dev/null 2>&1; then
    log "ERROR: Cannot connect to PostgreSQL server"
    return 1
  fi

  # Check if the database exists
  if ! docker exec mainnet-indexer_postgres_1 psql -U postgres -lqt | cut -d \| -f 1 | grep -qw $DB_NAME; then
    log "ERROR: Database '$DB_NAME' does not exist"
    return 1
  fi

  # Check if the blocks table exists
  if ! docker exec mainnet-indexer_postgres_1 psql -U postgres -d $DB_NAME -c "SELECT to_regclass('public.blocks');" | grep -q blocks; then
    log "ERROR: 'blocks' table does not exist in the database"
    return 1
  fi

  log "Database is healthy"
  return 0
}

# Function to check if the honeypot database exists
check_honeypot() {
  log "Checking honeypot database..."

  # Check if the honeypot database exists
  if ! docker exec mainnet-indexer_postgres_1 psql -U postgres -lqt | cut -d \| -f 1 | grep -qw $HONEYPOT_DB; then
    log "ALERT: Honeypot database '$HONEYPOT_DB' does not exist"
    return 1
  fi

  log "Honeypot database is intact"
  return 0
}

# Function to restore the honeypot database
restore_honeypot() {
  log "Restoring honeypot database..."

  # Create the honeypot database
  if ! docker exec mainnet-indexer_postgres_1 psql -U postgres -c "CREATE DATABASE $HONEYPOT_DB;" > /dev/null 2>&1; then
    log "ERROR: Failed to create honeypot database"
    return 1
  fi

  # Create dummy table and insert data
  if ! docker exec mainnet-indexer_postgres_1 psql -U postgres -d $HONEYPOT_DB -c "
    CREATE TABLE dummy_data (id SERIAL PRIMARY KEY, data TEXT);
    INSERT INTO dummy_data (data) VALUES ('This is a honeypot database');
  " > /dev/null 2>&1; then
    log "ERROR: Failed to create dummy data in honeypot database"
    return 1
  fi

  log "Honeypot database restored successfully"
  send_notification "🚨 SECURITY ALERT: Honeypot database was deleted and has been restored"
  return 0
}

# Function to check if the indexer API is responding
check_indexer_health() {
  log "Checking indexer health..."

  # Check if the indexer container is running
  if ! docker ps | grep -q mainnet-indexer_indexer_1; then
    log "ERROR: Indexer container is not running"
    return 1
  fi

  # Check if the health endpoint is responding
  if ! curl -s "http://$INDEXER_HOST:$INDEXER_PORT/health" > /dev/null 2>&1; then
    log "ERROR: Indexer health endpoint is not responding"
    return 1
  fi

  # Check if the indexer is reporting as healthy
  local health_response=$(curl -s "http://$INDEXER_HOST:$INDEXER_PORT/health")
  if ! echo "$health_response" | grep -q '"status":"ok"'; then
    log "ERROR: Indexer is reporting unhealthy status: $health_response"
    return 1
  fi

  # Check if the indexer is actively indexing
  if ! echo "$health_response" | grep -q '"isIndexing":true'; then
    log "WARNING: Indexer is not actively indexing: $health_response"
    # Not returning error here as it might be normal in some cases
  fi

  log "Indexer is healthy"
  return 0
}

# Function to check if the API endpoints are responding
check_api_endpoints() {
  log "Checking API endpoints..."

  # Check if the blocks endpoint is responding
  if ! curl -s "http://$INDEXER_HOST:$INDEXER_PORT/blocks?limit=1" > /dev/null 2>&1; then
    log "ERROR: Blocks endpoint is not responding"
    return 1
  fi

  # Check if the transactions endpoint is responding
  if ! curl -s "http://$INDEXER_HOST:$INDEXER_PORT/transactions?limit=1" > /dev/null 2>&1; then
    log "ERROR: Transactions endpoint is not responding"
    return 1
  fi

  log "API endpoints are responding"
  return 0
}

# Function to create the database and run migrations
create_database() {
  log "Creating database '$DB_NAME'..."

  # Create the database
  if ! docker exec mainnet-indexer_postgres_1 psql -U postgres -c "CREATE DATABASE $DB_NAME;" > /dev/null 2>&1; then
    log "ERROR: Failed to create database"
    return 1
  fi

  log "Database created successfully. Running migrations..."

  # Run migrations
  for migration in /project/migrations/*.sql; do
    log "Running migration: $(basename $migration)"
    if ! docker cp "$migration" mainnet-indexer_postgres_1:/tmp/ > /dev/null 2>&1; then
      log "ERROR: Failed to copy migration file to container"
      return 1
    fi

    if ! docker exec mainnet-indexer_postgres_1 psql -U postgres -d $DB_NAME -f /tmp/$(basename $migration) > /dev/null 2>&1; then
      log "ERROR: Failed to run migration: $(basename $migration)"
      return 1
    fi
  done

  # Grant permissions to the indexer user
  log "Granting permissions to indexer user..."
  if ! docker exec mainnet-indexer_postgres_1 psql -U postgres -d $DB_NAME -c "
    GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO $DB_USER;
    GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO $DB_USER;
  " > /dev/null 2>&1; then
    log "ERROR: Failed to grant permissions to indexer user"
    return 1
  fi

  log "Migrations completed successfully"
  return 0
}

# Function to restart the indexer
restart_indexer() {
  log "Restarting indexer..."

  # Use docker-compose to restart the indexer
  if ! docker-compose -f $DOCKER_COMPOSE_FILE restart indexer > /dev/null 2>&1; then
    log "ERROR: Failed to restart indexer"
    return 1
  fi

  log "Indexer restarted successfully"
  return 0
}

# Function to restart all containers
restart_all() {
  log "Restarting all containers..."

  # Use docker-compose to restart all containers
  if ! docker-compose -f $DOCKER_COMPOSE_FILE down > /dev/null 2>&1; then
    log "ERROR: Failed to stop containers"
    return 1
  fi

  if ! docker-compose -f $DOCKER_COMPOSE_FILE up -d > /dev/null 2>&1; then
    log "ERROR: Failed to start containers"
    return 1
  fi

  log "All containers restarted successfully"
  return 0
}

# Function to backup the database
backup_database() {
  local timestamp=$(date +%Y%m%d_%H%M%S)
  local backup_file="$BACKUP_DIR/${DB_NAME}_$timestamp.sql"

  log "Backing up database to $backup_file..."

  # Check if the database exists before backing up
  if ! docker exec mainnet-indexer_postgres_1 psql -U postgres -lqt | cut -d \| -f 1 | grep -qw $DB_NAME; then
    log "ERROR: Cannot backup - database '$DB_NAME' does not exist"
    return 1
  fi

  # Create the backup
  if ! docker exec mainnet-indexer_postgres_1 pg_dump -U postgres -d $DB_NAME > $backup_file 2>/dev/null; then
    log "ERROR: Failed to create database backup"
    return 1
  fi

  # Compress the backup
  if ! gzip $backup_file; then
    log "ERROR: Failed to compress backup file"
    return 1
  fi

  log "Database backup created successfully: ${backup_file}.gz"

  # Clean up old backups (keep last 7 days)
  find $BACKUP_DIR -name "${DB_NAME}_*.sql.gz" -type f -mtime +7 -delete

  return 0
}

# Function to restore the database from the latest backup
restore_from_backup() {
  log "Attempting to restore database from backup..."

  # Find the latest backup
  local latest_backup=$(find $BACKUP_DIR -name "${DB_NAME}_*.sql.gz" -type f | sort -r | head -n 1)

  if [ -z "$latest_backup" ]; then
    # Try to find backups with the old naming convention
    latest_backup=$(find $BACKUP_DIR -name "studio_indexer_*.sql.gz" -type f | sort -r | head -n 1)
    
    if [ -z "$latest_backup" ]; then
      log "ERROR: No backup files found"
      return 1
    fi
  fi

  log "Found backup file: $latest_backup"

  # Uncompress the backup
  gunzip -c $latest_backup > /tmp/restore.sql

  # Create the database if it doesn't exist
  if ! docker exec mainnet-indexer_postgres_1 psql -U postgres -lqt | cut -d \| -f 1 | grep -qw $DB_NAME; then
    log "Creating database for restore..."
    if ! docker exec mainnet-indexer_postgres_1 psql -U postgres -c "CREATE DATABASE $DB_NAME;" > /dev/null 2>&1; then
      log "ERROR: Failed to create database for restore"
      return 1
    fi
  fi

  # Restore the database
  if ! cat /tmp/restore.sql | docker exec -i mainnet-indexer_postgres_1 psql -U postgres -d $DB_NAME > /dev/null 2>&1; then
    log "ERROR: Failed to restore database"
    return 1
  fi

  # Grant permissions to the indexer user
  log "Granting permissions to indexer user..."
  if ! docker exec mainnet-indexer_postgres_1 psql -U postgres -d $DB_NAME -c "
    GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO $DB_USER;
    GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO $DB_USER;
  " > /dev/null 2>&1; then
    log "ERROR: Failed to grant permissions to indexer user"
    return 1
  fi

  # Clean up
  rm -f /tmp/restore.sql

  log "Database restored successfully from backup"
  return 0
}

# Function to check for suspicious activity
check_for_suspicious_activity() {
  log "Checking for suspicious activity..."

  # Check for unauthorized access to PostgreSQL
  local pg_log_file="/var/lib/postgresql/data/log/postgresql-$(date +%Y-%m-%d).log"

  if docker exec mainnet-indexer_postgres_1 test -f $pg_log_file; then
    # Look for DROP DATABASE commands
    if docker exec mainnet-indexer_postgres_1 grep -q "DROP DATABASE" $pg_log_file; then
      log "ALERT: Found DROP DATABASE commands in PostgreSQL logs"
      send_notification "🚨 SECURITY ALERT: DROP DATABASE commands detected in PostgreSQL logs"
    fi

    # Look for failed authentication attempts
    if docker exec mainnet-indexer_postgres_1 grep -q "authentication failed" $pg_log_file; then
      log "ALERT: Found failed authentication attempts in PostgreSQL logs"
      send_notification "⚠️ SECURITY ALERT: Failed authentication attempts detected in PostgreSQL logs"
    fi
  fi

  # Check for unusual system activity
  if [ -f "/var/log/auth.log" ]; then
    if grep -q "Failed password" /var/log/auth.log; then
      log "ALERT: Found failed login attempts in system logs"
      send_notification "⚠️ SECURITY ALERT: Failed login attempts detected in system logs"
    fi
  fi

  return 0
}

# Main monitoring loop
main() {
  log "Starting enhanced indexer monitoring..."
  send_notification "🚀 Enhanced indexer monitoring started"

  # Create initial backup
  backup_database

  # Set up daily backup cron job if it doesn't exist
  if ! crontab -l | grep -q "backup-indexer-db.sh"; then
    log "Setting up daily backup cron job..."

    # Create backup script
    cat > /root/backup-indexer-db.sh << EOF
#!/bin/bash
BACKUP_DIR=${BACKUP_DIR:-/var/backups/indexer}
DB_NAME=${DB_NAME:-analytics_data}
timestamp=\$(date +%Y%m%d_%H%M%S)
backup_file="\$BACKUP_DIR/\${DB_NAME}_\$timestamp.sql"

mkdir -p \$BACKUP_DIR
docker exec mainnet-indexer_postgres_1 pg_dump -U postgres -d \$DB_NAME > \$backup_file 2>/dev/null
gzip \$backup_file
find \$BACKUP_DIR -name "\${DB_NAME}_*.sql.gz" -type f -mtime +7 -delete
EOF

    chmod +x /root/backup-indexer-db.sh

    # Add to crontab
    (crontab -l 2>/dev/null; echo "0 0 * * * /root/backup-indexer-db.sh") | crontab -

    log "Daily backup cron job set up successfully"
  fi

  # Main monitoring loop
  while true; do
    # Check if PostgreSQL is running
    if ! check_postgres; then
      log "PostgreSQL issue detected attempting to restart all containers..."
      send_notification "⚠️ Indexer Alert: PostgreSQL issue detected attempting to restart all containers..."

      if restart_all; then
        log "All containers restarted waiting for PostgreSQL to initialize..."
        sleep 30  # Wait for PostgreSQL to initialize
      else
        log "Failed to restart containers manual intervention required"
        send_notification "🚨 Indexer Alert: Failed to restart containers manual intervention required"
      fi
    fi

    # Check if the honeypot database exists
    if ! check_honeypot; then
      log "ALERT: Honeypot database was deleted! This may indicate a ransomware attack."
      send_notification "🚨 SECURITY ALERT: Honeypot database was deleted! This may indicate a ransomware attack."
      
      # Restore the honeypot database
      restore_honeypot
    fi

    # Check if the database exists and has tables
    if ! check_database; then
      log "Database issue detected attempting to restore from backup..."
      send_notification "⚠️ Indexer Alert: Database issue detected attempting to restore from backup..."

      if restore_from_backup; then
        log "Database restored from backup restarting indexer..."
        restart_indexer
      else
        log "Failed to restore from backup attempting to recreate database..."

        if create_database; then
          log "Database recreated restarting indexer..."
          restart_indexer
        else
          log "Failed to recreate database manual intervention required"
          send_notification "🚨 Indexer Alert: Failed to recreate database manual intervention required"
        fi
      fi
    fi

    # Check if the indexer is healthy
    if ! check_indexer_health; then
      log "Indexer health issue detected attempting to restart..."
      send_notification "⚠️ Indexer Alert: Health issue detected attempting to restart..."

      if restart_indexer; then
        log "Indexer restarted monitoring will continue..."
      else
        log "Failed to restart indexer attempting to restart all containers..."

        if restart_all; then
          log "All containers restarted monitoring will continue..."
        else
          log "Failed to restart all containers manual intervention required"
          send_notification "🚨 Indexer Alert: Failed to restart all containers manual intervention required"
        fi
      fi
    fi

    # Check if the API endpoints are responding
    if ! check_api_endpoints; then
      log "API endpoint issue detected attempting to restart indexer..."
      send_notification "⚠️ Indexer Alert: API endpoint issue detected attempting to restart..."

      if restart_indexer; then
        log "Indexer restarted monitoring will continue..."
      else
        log "Failed to restart indexer manual intervention required"
        send_notification "🚨 Indexer Alert: Failed to restart indexer manual intervention required"
      fi
    fi

    # Check for suspicious activity
    check_for_suspicious_activity

    # Create a backup every 6 hours
    if [ $(date +%H) -eq 0 ] || [ $(date +%H) -eq 6 ] || [ $(date +%H) -eq 12 ] || [ $(date +%H) -eq 18 ]; then
      if [ $(date +%M) -lt $CHECK_INTERVAL ]; then
        backup_database
      fi
    fi

    # Wait for the next check
    log "All checks completed waiting $CHECK_INTERVAL seconds for next check..."
    sleep $CHECK_INTERVAL
  done
}

# Run the main function
main
