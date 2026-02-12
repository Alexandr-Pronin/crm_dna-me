#!/bin/bash
# =============================================================================
# DNA ME CRM — Backup script
# Run on LXC 102 (PostgreSQL) via cron
# Crontab: 0 3 * * * /opt/backup/backup.sh
# =============================================================================

set -e

BACKUP_DIR="/opt/backups"
DB_NAME="dna_marketing"
DB_USER="dna"
KEEP_DAYS=30
DATE=$(date +%Y-%m-%d_%H-%M)

mkdir -p $BACKUP_DIR

echo "[$DATE] Starting backup..."

# PostgreSQL dump
pg_dump -U $DB_USER $DB_NAME | gzip > "$BACKUP_DIR/${DB_NAME}_${DATE}.sql.gz"

# Remove old backups
find $BACKUP_DIR -name "*.sql.gz" -mtime +$KEEP_DAYS -delete

echo "[$DATE] Backup done: ${DB_NAME}_${DATE}.sql.gz"
echo "[$DATE] Size: $(du -h "$BACKUP_DIR/${DB_NAME}_${DATE}.sql.gz" | cut -f1)"
