#!/bin/bash
set -e

# Configuration
BACKUP_DIR="/var/backups/indexer"
POSTGRES_CONTAINER="mainnet-indexer_postgres_1"
DB_NAME="studio_indexer"
RETENTION_DAYS=7  # Keep backups for 7 days
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="$BACKUP_DIR/studio_indexer_$TIMESTAMP.sql"

# Ensure backup directory exists
mkdir -p $BACKUP_DIR

# Log function
log() {
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1"
}

# Create backup
log "Creating backup of $DB_NAME database to $BACKUP_FILE"
docker exec $POSTGRES_CONTAINER pg_dump -U postgres -d $DB_NAME > $BACKUP_FILE

# Compress backup
log "Compressing backup file"
gzip $BACKUP_FILE
log "Backup created: ${BACKUP_FILE}.gz"

# Clean up old backups
log "Cleaning up backups older than $RETENTION_DAYS days"
find $BACKUP_DIR -name "studio_indexer_*.sql.gz" -type f -mtime +$RETENTION_DAYS -delete

# List current backups
log "Current backups:"
ls -lh $BACKUP_DIR

log "Backup completed successfully"
