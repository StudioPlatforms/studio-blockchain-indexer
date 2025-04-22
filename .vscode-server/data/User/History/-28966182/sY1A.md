# Blockchain Indexer Monitoring and Backup System

This document describes the monitoring and backup system for the blockchain indexer.

## Monitoring Components

### 1. Standard Monitor

The standard monitor (`monitor` service) performs basic health checks on the indexer and database. It runs in a Docker container and checks:

- Database connectivity
- Indexer health endpoint
- API endpoints

### 2. Enhanced Monitor

The enhanced monitor (`enhanced-monitor` service) provides more advanced monitoring and automatic recovery features:

- **Comprehensive Health Checks**: Checks PostgreSQL, database schema, indexer health, and API endpoints
- **Automatic Recovery**: Can restart services, recreate the database, and restore from backups
- **Suspicious Activity Detection**: Monitors for unauthorized database access and DROP commands
- **Backup Management**: Creates regular backups and manages retention

### 3. Database Healthcheck

The database healthcheck (`db-healthcheck` service) ensures the database is properly initialized with the required schema before the indexer starts.

## Backup System

### Automatic Backups

The system performs database backups through multiple mechanisms:

1. **Scheduled Cron Job**: A system cron job runs every 6 hours to create a backup of the database
   - Schedule: `0 */6 * * *` (at minute 0 past every 6th hour)
   - Script: `/root/mainnet-indexer/scripts/backup-database.sh`
   - Log: `/var/log/indexer-backup.log`

2. **Enhanced Monitor Backups**: The enhanced monitor also creates backups at 00:00, 06:00, 12:00, and 18:00

### Backup Location

Backups are stored in `/var/backups/indexer/` with the naming format:
```
studio_indexer_YYYYMMDD_HHMMSS.sql.gz
```

### Backup Retention

Backups are automatically pruned after 7 days to prevent disk space issues.

## Security Monitoring

The system includes several security monitoring features:

1. **Database Audit Logging**: All DROP commands are logged to the `db_audit_log` table
2. **PostgreSQL Log Monitoring**: The enhanced monitor checks PostgreSQL logs for suspicious commands
3. **System Log Monitoring**: The enhanced monitor checks system logs for unauthorized access attempts

## Recovery Procedures

### Automatic Recovery

The enhanced monitor can automatically recover from several failure scenarios:

1. **Database Deletion**: If the database is deleted, it will:
   - Attempt to restore from the latest backup
   - If no backup is available, recreate the database and run migrations
   - Restart the indexer

2. **Indexer Failure**: If the indexer stops responding, it will:
   - Restart the indexer container
   - If that fails, restart all containers

### Manual Recovery

For situations requiring manual intervention:

1. **Complete System Reset**:
   ```bash
   /root/mainnet-indexer/fix-and-start.sh
   ```
   This script will:
   - Stop all containers
   - Recreate the database
   - Run all migrations
   - Rebuild the enhanced monitor
   - Start all services
   - Create an initial backup
   - Start the investigation script

2. **Restore from Backup**:
   ```bash
   # Find available backups
   ls -la /var/backups/indexer/
   
   # Restore a specific backup
   gunzip -c /var/backups/indexer/studio_indexer_YYYYMMDD_HHMMSS.sql.gz | docker exec -i mainnet-indexer_postgres_1 psql -U postgres -d studio_indexer
   ```

## Logs

Important log files:

- **Indexer Logs**: `docker logs mainnet-indexer_indexer_1`
- **Enhanced Monitor Logs**: `docker logs mainnet-indexer_enhanced-monitor_1`
- **Standard Monitor Logs**: `docker logs mainnet-indexer_monitor_1`
- **Database Healthcheck Logs**: `docker logs mainnet-indexer_db-healthcheck_1`
- **Backup Logs**: `/var/log/indexer-backup.log`
- **Investigation Logs**: `/var/log/investigation-startup.log` and `/var/log/db-investigation.log`

## Troubleshooting

### Enhanced Monitor Restarting

If the enhanced monitor container is constantly restarting:

1. Check the logs:
   ```bash
   docker logs mainnet-indexer_enhanced-monitor_1
   ```

2. Verify Docker socket permissions:
   ```bash
   ls -la /var/run/docker.sock
   ```

3. Rebuild the container:
   ```bash
   cd /root/mainnet-indexer/scripts
   docker build -t mainnet-indexer_enhanced-monitor -f Dockerfile.enhanced-monitor .
   docker-compose -f /root/mainnet-indexer/docker-compose.yml up -d enhanced-monitor
   ```

### Indexer Not Progressing

If the indexer is not progressing:

1. Check the indexer logs:
   ```bash
   docker logs mainnet-indexer_indexer_1
   ```

2. Verify RPC connectivity:
   ```bash
   curl -X POST -H "Content-Type: application/json" --data '{"jsonrpc":"2.0","method":"eth_blockNumber","params":[],"id":1}' https://mainnet.studio-blockchain.com
   ```

3. Restart the indexer:
   ```bash
   docker-compose -f /root/mainnet-indexer/docker-compose.yml restart indexer
   ```

### Database Issues

If there are database issues:

1. Check PostgreSQL logs:
   ```bash
   docker exec mainnet-indexer_postgres_1 cat /var/lib/postgresql/data/log/postgresql-$(date +%Y-%m-%d).log
   ```

2. Check database audit logs:
   ```bash
   docker exec mainnet-indexer_postgres_1 psql -U postgres -c "SELECT * FROM db_audit_log ORDER BY event_time DESC LIMIT 10;"
   ```

3. Run the database healthcheck manually:
   ```bash
   docker-compose -f /root/mainnet-indexer/docker-compose.yml up db-healthcheck
