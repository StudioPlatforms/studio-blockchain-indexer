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
  " 2>/dev/null || echo "No audit log data found")

  if [ "$suspicious_drops" != "No audit log data found" ] && [ -n "$suspicious_drops" ]; then
    log "ALERT: Found DROP DATABASE commands in audit log:"
    log "$suspicious_drops"
  fi

  # Check for failed login attempts
  failed_logins=$(docker exec $POSTGRES_CONTAINER bash -c "grep -i 'authentication failed' /var/lib/postgresql/data/log/postgresql-*.log 2>/dev/null || echo 'No failed logins found'")

  if [ "$failed_logins" != "No failed logins found" ]; then
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
