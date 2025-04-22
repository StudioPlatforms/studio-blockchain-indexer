# PostgreSQL Security Measures Against Ransomware

This document outlines the security measures implemented to protect the blockchain indexer's PostgreSQL database from ransomware attacks.

## Problem

The PostgreSQL database was being targeted by ransomware that:
1. Deleted the database
2. Created a ransom note in a table named "readme" in a database named "readme_to_recover"
3. Demanded payment in Bitcoin to recover the data

## Security Measures Implemented

### 1. Database Obfuscation

- **Renamed Database**: Changed the database name from `studio_indexer` to `analytics_data` to avoid targeting by ransomware that looks for specific database names.
- **Custom Schema**: Using a non-default schema to further obfuscate the database structure.

### 2. Honeypot Strategy

- **Honeypot Database**: Created a decoy database named `studio_indexer` (the original name) with dummy data.
- **Automatic Restoration**: Implemented a service that automatically restores the honeypot database if it gets deleted.
- **Monitoring**: The honeypot serves as a canary to detect ransomware activity.

### 3. Access Restrictions

- **Limited User Privileges**: Created a dedicated user `indexer_user` with specific privileges.
- **Restricted Access**: Revoked public access to the database and granted specific permissions only to the dedicated user.

### 4. Enhanced Logging and Monitoring

- **Comprehensive Logging**: Enabled detailed PostgreSQL logging for all database operations.
- **Audit Logging**: Implemented event triggers to log database events, especially DROP DATABASE commands.
- **Suspicious Activity Monitoring**: Created a service that monitors for suspicious activities like failed login attempts and DROP DATABASE commands.

### 5. Backup and Recovery

- **Regular Backups**: Maintained the existing backup system that creates backups every 6 hours.
- **Backup Retention**: Keeping backups for 7 days to ensure data can be recovered if needed.

## How to Use

### Restarting the Indexer

To restart the indexer with all security measures in place:

```bash
/root/mainnet-indexer/restart-indexer.sh
```

### Monitoring Services

The following services are running to protect the database:

1. **Honeypot Monitor**: Automatically restores the honeypot database if deleted
   ```bash
   systemctl status honeypot-monitor.service
   ```

2. **Suspicious Activity Monitor**: Monitors for suspicious database activities
   ```bash
   systemctl status suspicious-activity-monitor.service
   ```

### Logs

Important logs to check:

- PostgreSQL Logs: `/var/lib/postgresql/data/log/`
- Honeypot Monitor Logs: `/var/log/honeypot-monitor.log`
- Suspicious Activity Logs: `/var/log/suspicious-activity.log`
- Postgres Security Logs: `/var/log/postgres-security.log`
- Indexer Restart Logs: `/var/log/indexer-restart.log`

## In Case of Attack

If a ransomware attack is detected:

1. Check the honeypot monitor logs to see if the honeypot database was deleted and restored.
2. Check the suspicious activity logs for details about the attack.
3. Verify that the real database (`analytics_data`) is still intact.
4. If needed, restore from the latest backup.

## Security Scripts

- `/root/mainnet-indexer/scripts/restore-honeypot.sh`: Monitors and restores the honeypot database
- `/root/mainnet-indexer/scripts/enhance-postgres-security.sh`: Applies security settings to PostgreSQL
- `/root/mainnet-indexer/scripts/monitor-suspicious-activity.sh`: Monitors for suspicious database activities
- `/root/mainnet-indexer/restart-indexer.sh`: Restarts the indexer with all security measures in place
