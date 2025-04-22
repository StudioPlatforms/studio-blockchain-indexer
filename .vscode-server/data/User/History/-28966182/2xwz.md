# Blockchain Indexer Monitoring System

This document describes the enhanced monitoring and backup system for the blockchain indexer.

## Overview

The monitoring system consists of several components:

1. **Enhanced Monitor**: A robust monitoring service that checks the health of the indexer, database, and API endpoints. It automatically recreates the database and restarts the indexer if issues are detected.

2. **Database Backup System**: Automatically creates backups of the database every 6 hours and keeps them for 7 days.

3. **Investigation Tool**: A tool to investigate the root cause of database deletions by monitoring system processes, file system changes, and database events.

## Components

### Enhanced Monitor

The enhanced monitor (`enhanced-monitor.sh`) is a comprehensive monitoring service that:

- Checks if PostgreSQL is running
- Checks if the database exists and has tables
- Checks if the indexer API is responding
- Checks if the API endpoints are responding
- Creates regular backups of the database
- Restores the database from backup if it's deleted
- Recreates the database and runs migrations if needed
- Restarts the indexer or all containers if issues are detected
- Monitors for suspicious activity

The enhanced monitor is configured to run as a Docker container and is included in the `docker-compose.yml` file.

### Database Backup System

The database backup system creates regular backups of the database:

- Backups are created every 6 hours
- Backups are stored in `/var/backups/indexer`
- Backups are compressed to save space
- Old backups (older than 7 days) are automatically deleted

Additionally, a daily backup is scheduled via cron to ensure there's always a backup available.

### Investigation Tool

The investigation tool (`investigate-db-deletion.sh`) is designed to help identify the root cause of database deletions:

- Sets up database triggers to log DROP DATABASE commands
- Enables comprehensive PostgreSQL logging
- Monitors system processes for suspicious activity
- Monitors file system changes
- Collects detailed logs when a database deletion is detected
- Automatically recreates the database if it's deleted

## Usage

### Starting the Monitoring System

The monitoring system is included in the `docker-compose.yml` file and will start automatically when you run:

```bash
cd /root/mainnet-indexer
docker-compose up -d
```

### Manually Running the Investigation Tool

To manually run the investigation tool:

```bash
cd /root/mainnet-indexer
./scripts/investigate-db-deletion.sh
```

This will start monitoring for database deletions and collect detailed logs if a deletion is detected.

### Checking Logs

To check the logs of the enhanced monitor:

```bash
docker logs mainnet-indexer_enhanced-monitor_1
```

To check the investigation logs:

```bash
cat /var/log/db-investigation.log
```

### Restoring from Backup

The enhanced monitor will automatically restore the database from backup if it's deleted. To manually restore from the latest backup:

```bash
cd /root/mainnet-indexer
docker-compose exec enhanced-monitor /bin/bash -c "source /app/enhanced-monitor.sh && restore_from_backup"
```

## Troubleshooting

### Database is Missing

If the database is missing, the enhanced monitor will automatically:

1. Try to restore from the latest backup
2. If no backup is available, recreate the database and run migrations
3. Restart the indexer

### Indexer is Not Responding

If the indexer is not responding, the enhanced monitor will automatically:

1. Restart the indexer
2. If that doesn't work, restart all containers

### Manual Intervention Required

If the enhanced monitor cannot automatically fix an issue, it will log a message indicating that manual intervention is required. In this case:

1. Check the logs to identify the issue
2. Fix the issue manually
3. Restart the affected components

## Security Considerations

The enhanced monitor includes security monitoring features:

- Monitors for suspicious processes
- Checks for unauthorized database access
- Logs DROP DATABASE commands
- Sends alerts when suspicious activity is detected

If suspicious activity is detected, check the logs and take appropriate action to secure your system.
