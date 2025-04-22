# Studio Blockchain Indexer Failsafe System

This document describes the failsafe system implemented for the Studio Blockchain Indexer to ensure high availability and automatic recovery from common issues.

## Overview

The failsafe system consists of three main components:

1. **Database Health Check Service**: Ensures the database exists and has the necessary schema.
2. **Monitoring Service**: Continuously monitors the indexer and database, taking corrective action when issues are detected.
3. **Dependency Chain**: Ensures services start in the correct order and only when their dependencies are healthy.

## Components

### 1. Database Health Check Service

The database health check service (`db-healthcheck`) is responsible for:

- Checking if the PostgreSQL server is running
- Checking if the `studio_indexer` database exists
- Creating the database if it doesn't exist
- Running the migrations to create the necessary tables

This service runs before the indexer starts and ensures that the database is properly set up. The indexer will only start if the database health check passes.

**Files:**
- `scripts/db-healthcheck.sh`: The health check script
- `scripts/Dockerfile.healthcheck`: Dockerfile for the health check service

### 2. Monitoring Service

The monitoring service (`monitor`) continuously checks:

- If the indexer is running and responding to health checks
- If the database exists and has the necessary tables
- If the API endpoints are responding correctly

If any issues are detected, the monitoring service will:

1. Log the issue
2. Send a notification (if configured)
3. Attempt to fix the issue automatically (e.g., recreate the database, restart the indexer)
4. If automatic recovery fails, request manual intervention

**Files:**
- `scripts/monitor-indexer.sh`: The monitoring script
- `scripts/Dockerfile.monitor`: Dockerfile for the monitoring service

### 3. Dependency Chain

The services are configured to start in the following order:

1. PostgreSQL database
2. Database health check service (depends on PostgreSQL being healthy)
3. Indexer service (depends on the database health check passing)
4. Monitoring service (depends on PostgreSQL and the indexer being started)

This ensures that each service only starts when its dependencies are ready.

## Configuration

### Environment Variables

The failsafe system can be configured using the following environment variables:

#### Database Health Check Service:
- `DB_HOST`: PostgreSQL host (default: postgres)
- `DB_PORT`: PostgreSQL port (default: 5432)
- `DB_NAME`: Database name (default: studio_indexer)
- `DB_USER`: Database user (default: postgres)
- `DB_PASSWORD`: Database password (default: postgres)
- `MIGRATIONS_DIR`: Directory containing migration files (default: /app/migrations)
- `LOG_FILE`: Log file path (default: /app/logs/db-healthcheck.log)

#### Monitoring Service:
- `INDEXER_HOST`: Indexer host (default: indexer)
- `INDEXER_PORT`: Indexer port (default: 3000)
- `DB_HOST`: PostgreSQL host (default: postgres)
- `DB_PORT`: PostgreSQL port (default: 5432)
- `DB_NAME`: Database name (default: studio_indexer)
- `DB_USER`: Database user (default: postgres)
- `DB_PASSWORD`: Database password (default: postgres)
- `CHECK_INTERVAL`: Interval between checks in seconds (default: 60)
- `LOG_FILE`: Log file path (default: /var/log/indexer-monitor.log)
- `SLACK_WEBHOOK_URL`: Slack webhook URL for notifications (optional)

## Logs

Logs for each service are stored in the following locations:

- Database Health Check: `/app/logs/db-healthcheck.log` (mounted to `healthcheck_logs` volume)
- Monitoring Service: `/var/log/indexer-monitor.log` (mounted to `monitor_logs` volume)
- Indexer: `/app/logs/combined.log` and `/app/logs/error.log` (mounted to `indexer_logs` volume)

You can view the logs using Docker Compose:

```bash
# View database health check logs
docker-compose logs db-healthcheck

# View monitoring service logs
docker-compose logs monitor

# View indexer logs
docker-compose logs indexer
```

## Manual Intervention

If automatic recovery fails, the monitoring service will log an error and send a notification (if configured). In this case, manual intervention is required.

Common issues that may require manual intervention:

1. **PostgreSQL server is down**: Check the PostgreSQL container logs and restart if necessary.
2. **Database corruption**: You may need to drop and recreate the database.
3. **Network issues**: Check if the RPC URLs are accessible.

## Deployment

The failsafe system is deployed as part of the standard deployment process. Simply run:

```bash
docker-compose up -d
```

This will start all services in the correct order with the failsafe system enabled.

## Testing the Failsafe System

You can test the failsafe system by simulating various failure scenarios:

1. **Database failure**: Stop the PostgreSQL container or drop the database.
2. **Indexer failure**: Stop the indexer container or kill the process.
3. **API failure**: Modify the API code to return errors.

The monitoring service should detect these issues and attempt to recover automatically.
