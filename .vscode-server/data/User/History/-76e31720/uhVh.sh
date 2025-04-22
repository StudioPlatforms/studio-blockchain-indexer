#!/bin/bash

# Script to set environment variables for the database
# This script will set the environment variables needed for the database connection

# Database connection details
export DB_HOST="localhost"
export DB_PORT="5432"
export DB_USER="postgres"
export DB_NAME="blockchain"
export DB_PASSWORD="postgres"

# Log that the environment variables have been set
echo "Environment variables set:"
echo "DB_HOST=$DB_HOST"
echo "DB_PORT=$DB_PORT"
echo "DB_USER=$DB_USER"
echo "DB_NAME=$DB_NAME"
echo "DB_PASSWORD=********"

# Export PGPASSWORD for psql
export PGPASSWORD=$DB_PASSWORD
