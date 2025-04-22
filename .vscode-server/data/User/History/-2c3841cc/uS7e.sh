#!/bin/bash
set -e

# Configuration
POSTGRES_CONTAINER="mainnet-indexer_postgres_1"
LOG_FILE="/var/log/postgres-security.log"

# Ensure log directory exists
mkdir -p $(dirname $LOG_FILE)

# Function to log messages
log() {
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a $LOG_FILE
}

log "Enhancing PostgreSQL security..."

# Enable PostgreSQL logging
log "Enabling comprehensive PostgreSQL logging..."
docker exec $POSTGRES_CONTAINER psql -U postgres -c "
  ALTER SYSTEM SET log_statement = 'all';
  ALTER SYSTEM SET log_min_duration_statement = 0;
  ALTER SYSTEM SET log_connections = on;
  ALTER SYSTEM SET log_disconnections = on;
  ALTER SYSTEM SET log_duration = on;
  ALTER SYSTEM SET logging_collector = on;
  ALTER SYSTEM SET log_directory = 'log';
  ALTER SYSTEM SET log_filename = 'postgresql-%Y-%m-%d_%H%M%S.log';
  ALTER SYSTEM SET log_truncate_on_rotation = on;
  ALTER SYSTEM SET log_rotation_age = '1d';
  ALTER SYSTEM SET log_rotation_size = '10MB';
  SELECT pg_reload_conf();
"

# Create a function to log database events
log "Creating database audit logging..."
docker exec $POSTGRES_CONTAINER psql -U postgres -c "
  CREATE TABLE IF NOT EXISTS public.db_audit_log (
    id SERIAL PRIMARY KEY,
    event_time TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    username TEXT,
    client_addr TEXT,
    command TEXT,
    object_type TEXT,
    object_name TEXT
  );

  CREATE OR REPLACE FUNCTION log_db_event() RETURNS event_trigger AS \$\$
  DECLARE
    obj record;
    command text;
  BEGIN
    SELECT current_query() INTO command;

    FOR obj IN SELECT * FROM pg_event_trigger_dropped_objects()
    LOOP
      INSERT INTO public.db_audit_log (username, client_addr, command, object_type, object_name)
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

  DROP EVENT TRIGGER IF EXISTS log_drop_commands;
  CREATE EVENT TRIGGER log_drop_commands ON sql_drop
  EXECUTE PROCEDURE log_db_event();
"

# Restrict access to the analytics_data database
log "Restricting access to the analytics_data database..."
docker exec $POSTGRES_CONTAINER psql -U postgres -c "
  REVOKE ALL ON DATABASE analytics_data FROM PUBLIC;
  GRANT CONNECT ON DATABASE analytics_data TO indexer_user;
  GRANT ALL PRIVILEGES ON DATABASE analytics_data TO indexer_user;
"

# Create a script to monitor for suspicious activity
log "Creating a script to monitor for suspicious activity..."
cat > /root/mainnet-indexer/scripts/monitor-suspicious-activity.sh << 'EOF'
#!/bin/bash
set -e

# Configuration
POSTGRES_CONTAINER="mainnet-indexer_postgres_1"
CHECK_INTERVAL=300  # Check every 5 minutes
LOG_FILE="/var/log/suspicious-activity.log"

# Ensure log directory exists
mkdir -p $(dirname $LOG_FILE)

# Function to log messages
log() {
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a $LOG_FILE
}

# Function to check for suspicious activity
check_suspicious_activity() {
  log "Checking for suspicious activity..."

  # Check for DROP DATABASE commands
  suspicious_drops=$(docker exec $POSTGRES_CONTAINER psql -U postgres -c "
    SELECT * FROM public.db_audit_log 
    WHERE command LIKE '%DROP DATABASE%' 
    AND event_time > NOW() - INTERVAL '1 hour'
    ORDER BY event_time DESC;
  ")

  if [ -n "$suspicious_drops" ]; then
    log "ALERT: Found DROP DATABASE commands in audit log:"
    log "$suspicious_drops"
  fi

  # Check for failed login attempts
  failed_logins=$(docker exec $POSTGRES_CONTAINER grep -i "authentication failed" /var/lib/postgresql/data/log/postgresql-*.log 2>/dev/null || true)

  if [ -n "$failed_logins" ]; then
    log "ALERT: Found failed authentication attempts in PostgreSQL logs:"
    log "$failed_logins"
  fi
}

# Main monitoring loop
log "Starting suspicious activity monitoring..."

while true; do
  check_suspicious_activity
  sleep $CHECK_INTERVAL
done
EOF

chmod +x /root/mainnet-indexer/scripts/monitor-suspicious-activity.sh

# Create a systemd service for the suspicious activity monitor
log "Creating a systemd service for the suspicious activity monitor..."
cat > /etc/systemd/system/suspicious-activity-monitor.service << 'EOF'
[Unit]
Description=PostgreSQL Suspicious Activity Monitor
After=docker.service
Requires=docker.service

[Service]
Type=simple
User=root
ExecStart=/root/mainnet-indexer/scripts/monitor-suspicious-activity.sh
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
EOF

# Enable and start the suspicious activity monitor service
log "Enabling and starting the suspicious activity monitor service..."
systemctl daemon-reload
systemctl enable suspicious-activity-monitor.service
systemctl start suspicious-activity-monitor.service

log "PostgreSQL security enhancements completed successfully"
