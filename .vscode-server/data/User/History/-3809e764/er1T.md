# Restart Instructions for Mainnet Indexer

After making changes to the verification service, you need to restart the indexer service for the changes to take effect. Here are the instructions:

## Option 1: Using systemctl (if the indexer is running as a systemd service)

```bash
# Stop the indexer service
sudo systemctl stop mainnet-indexer

# Wait for the service to stop
sleep 5

# Start the indexer service
sudo systemctl start mainnet-indexer

# Check the status of the service
sudo systemctl status mainnet-indexer
```

## Option 2: Using PM2 (if the indexer is running with PM2)

```bash
# Restart the indexer service
pm2 restart mainnet-indexer

# Check the status of the service
pm2 status mainnet-indexer
```

## Option 3: Manual restart (if the indexer is running directly)

1. Find the process ID of the indexer:
```bash
ps aux | grep mainnet-indexer
```

2. Kill the process:
```bash
kill <process_id>
```

3. Start the indexer again:
```bash
cd /path/to/mainnet-indexer
npm start
```

Choose the appropriate option based on how the indexer service is set up on your system.
