#!/bin/bash
set -e

# Configuration
LOG_FILE="/var/log/db-investigation.log"
POSTGRES_CONTAINER="mainnet-indexer_postgres_1"
DB_NAME="studio_indexer"
MONITOR_DURATION=86400  # 24 hours in seconds

# Ensure log directory exists
mkdir -p $(dirname $LOG_FILE)

# Function to log messages
log() {
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a $LOG_FILE
}

# Function to check if the database exists
check_database_exists() {
  if docker exec $POSTGRES_CONTAINER psql -U postgres -lqt | cut -d \| -f 1 | grep -qw $DB_NAME; then
    return 0
  else
    return 1
  fi
}

# Function to set up database triggers to log DROP DATABASE commands
setup_db_triggers() {
  log "Setting up database triggers to monitor DROP DATABASE commands..."
  
  # Create an audit table in postgres database
  docker exec $POSTGRES_CONTAINER psql -U postgres -c "
    CREATE TABLE IF NOT EXISTS db_audit_log (
      id SERIAL PRIMARY KEY,
      event_time TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      username TEXT,
      client_addr TEXT,
      command TEXT,
      object_type TEXT,
      object_name TEXT
    );
  "
  
  # Create a function to log database events
  docker exec $POSTGRES_CONTAINER psql -U postgres -c "
    CREATE OR REPLACE FUNCTION log_db_event() RETURNS event_trigger AS \$\$
    DECLARE
      obj record;
      command text;
    BEGIN
      SELECT current_query() INTO command;
      
      FOR obj IN SELECT * FROM pg_event_trigger_dropped_objects()
      LOOP
        INSERT INTO db_audit_log (username, client_addr, command, object_type, object_name)
        VALUES (
          current_user,
          inet_client_addr(),
          command,
          obj.object_type,
          obj.object_identity
        );
      END LOOP;
    END;
    \$\$ LANGUAGE plpgsql;
  "
  
  # Create an event trigger for DROP commands
  docker exec $POSTGRES_CONTAINER psql -U postgres -c "
    DROP EVENT TRIGGER IF EXISTS log_drop_commands;
    CREATE EVENT TRIGGER log_drop_commands ON sql_drop
    EXECUTE PROCEDURE log_db_event();
  "
  
  log "Database triggers set up successfully"
}

# Function to enable PostgreSQL logging
enable_postgres_logging() {
  log "Enabling PostgreSQL logging..."
  
  # Update PostgreSQL configuration to enable logging
  docker exec $POSTGRES_CONTAINER psql -U postgres -c "
    ALTER SYSTEM SET log_statement = 'all';
    ALTER SYSTEM SET log_min_duration_statement = 0;
    ALTER SYSTEM SET log_connections = on;
    ALTER SYSTEM SET log_disconnections = on;
    ALTER SYSTEM SET log_duration = on;
    SELECT pg_reload_conf();
  "
  
  log "PostgreSQL logging enabled"
}

# Function to monitor system processes
monitor_processes() {
  log "Starting process monitoring..."
  
  # Get initial list of processes
  initial_processes=$(ps aux)
  
  # Monitor for new processes
  while true; do
    sleep 10
    
    current_processes=$(ps aux)
    
    # Compare current processes with initial processes
    diff_output=$(diff <(echo "$initial_processes") <(echo "$current_processes") 2>/dev/null || true)
    
    if [ -n "$diff_output" ]; then
      log "Process changes detected:"
      log "$diff_output"
      
      # Look for suspicious commands
      if echo "$diff_output" | grep -i -E "drop|delete|remove|psql|postgres" > /dev/null; then
        log "ALERT: Suspicious process detected that might be related to database deletion"
      fi
    fi
    
    # Check if the database still exists
    if ! check_database_exists; then
      log "ALERT: Database '$DB_NAME' has been deleted!"
      
      # Get list of running processes
      log "Current processes at time of deletion:"
      ps aux | tee -a $LOG_FILE
      
      # Get recent commands from history
      log "Recent commands from history:"
      history | tail -n 50 | tee -a $LOG_FILE
      
      # Check system logs
      log "Recent system logs:"
      journalctl -n 100 --no-pager | tee -a $LOG_FILE
      
      # Check PostgreSQL logs
      log "Recent PostgreSQL logs:"
      docker exec $POSTGRES_CONTAINER bash -c "cat /var/lib/postgresql/data/log/postgresql-*.log | tail -n 100" | tee -a $LOG_FILE
      
      # Check audit logs
      log "Database audit logs:"
      docker exec $POSTGRES_CONTAINER psql -U postgres -c "SELECT * FROM db_audit_log ORDER BY event_time DESC LIMIT 20;" | tee -a $LOG_FILE
      
      log "Investigation data collected. Please check $LOG_FILE for details."
      
      # Recreate the database
      log "Recreating the database..."
      docker exec $POSTGRES_CONTAINER psql -U postgres -c "CREATE DATABASE $DB_NAME;"
      
      # Run migrations
      log "Running migrations..."
      for migration in /root/mainnet-indexer/migrations/*.sql; do
        log "Running migration: $(basename $migration)"
        docker cp "$migration" $POSTGRES_CONTAINER:/tmp/
        docker exec $POSTGRES_CONTAINER psql -U postgres -d $DB_NAME -f /tmp/$(basename $migration)
      done
      
      log "Database recreated successfully"
    fi
    
    # Update initial processes for next comparison
    initial_processes=$current_processes
  done
}

# Function to monitor file system changes
monitor_filesystem() {
  log "Starting file system monitoring..."
  
  # Install inotify-tools if not already installed
  if ! command -v inotifywait &> /dev/null; then
    log "Installing inotify-tools..."
    apt-get update && apt-get install -y inotify-tools
  fi
  
  # Monitor PostgreSQL data directory
  docker exec $POSTGRES_CONTAINER bash -c "
    mkdir -p /tmp/fs_monitor
    cd /tmp/fs_monitor
    
    while true; do
      find /var/lib/postgresql/data -type f -name '*.conf' -o -name '*.ctl' | xargs md5sum > checksums.new
      
      if [ -f checksums.old ]; then
        diff checksums.old checksums.new > diff.log 2>&1 || true
        
        if [ -s diff.log ]; then
          echo '[$(date '+%Y-%m-%d %H:%M:%S')] File changes detected:' >> /tmp/fs_changes.log
          cat diff.log >> /tmp/fs_changes.log
        fi
      fi
      
      mv checksums.new checksums.old
      sleep 60
    done
  " &
  
  log "File system monitoring started"
}

# Main function
main() {
  log "Starting database deletion investigation..."
  
  # Check if the database exists
  if check_database_exists; then
    log "Database '$DB_NAME' exists"
    
    # Set up database triggers
    setup_db_triggers
    
    # Enable PostgreSQL logging
    enable_postgres_logging
    
    # Start monitoring processes
    monitor_processes &
    
    # Start monitoring file system
    monitor_filesystem &
    
    # Monitor for the specified duration
    log "Monitoring for $MONITOR_DURATION seconds..."
    sleep $MONITOR_DURATION
    
    log "Monitoring completed"
  else
    log "Database '$DB_NAME' does not exist. Creating it..."
    
    # Create the database
    docker exec $POSTGRES_CONTAINER psql -U postgres -c "CREATE DATABASE $DB_NAME;"
    
    # Run migrations
    for migration in /root/mainnet-indexer/migrations/*.sql; do
      log "Running migration: $(basename $migration)"
      docker cp "$migration" $POSTGRES_CONTAINER:/tmp/
      docker exec $POSTGRES_CONTAINER psql -U postgres -d $DB_NAME -f /tmp/$(basename $migration)
    done
    
    log "Database created successfully. Starting investigation..."
    
    # Set up database triggers
    setup_db_triggers
    
    # Enable PostgreSQL logging
    enable_postgres_logging
    
    # Start monitoring processes
    monitor_processes &
    
    # Start monitoring file system
    monitor_filesystem &
    
    # Monitor for the specified duration
    log "Monitoring for $MONITOR_DURATION seconds..."
    sleep $MONITOR_DURATION
    
    log "Monitoring completed"
  fi
}

# Run the main function
main
