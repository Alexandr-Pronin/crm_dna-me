#!/bin/bash
# =============================================================================
# DNA ME CRM — Backup script (run on DB instance via cron)
# Cron: 0 3 * * * (set in CloudFormation UserData)
# Local backup + S3 upload when S3_BUCKET is set (from .env.backup or env)
# =============================================================================

set -e

BACKUP_DIR="/opt/dna-crm/backups"
DATE=$(date +%Y-%m-%d_%H-%M)
KEEP_DAYS=30

# Load S3_BUCKET from .env.backup if present
[ -f /opt/dna-crm/.env.backup ] && . /opt/dna-crm/.env.backup
S3_BUCKET="${S3_BUCKET:-}"

mkdir -p "$BACKUP_DIR"

echo "[$DATE] Starting backup..."
docker exec dna_postgres pg_dump -U dna dna_marketing 2>/dev/null | gzip > "$BACKUP_DIR/dna_marketing_${DATE}.sql.gz" || {
  echo "[$DATE] Backup failed (is dna_postgres running?)"
  exit 1
}

# Upload to S3 when bucket is configured
if [ -n "$S3_BUCKET" ]; then
  if aws s3 cp "$BACKUP_DIR/dna_marketing_${DATE}.sql.gz" "s3://${S3_BUCKET}/backups/" 2>/dev/null; then
    echo "[$DATE] S3 upload done: s3://${S3_BUCKET}/backups/dna_marketing_${DATE}.sql.gz"
  else
    echo "[$DATE] S3 upload failed (check IAM role)"
  fi
fi

# Prune old local backups
find "$BACKUP_DIR" -name "*.sql.gz" -mtime +$KEEP_DAYS -delete 2>/dev/null || true

echo "[$DATE] Backup done: dna_marketing_${DATE}.sql.gz ($(du -h "$BACKUP_DIR/dna_marketing_${DATE}.sql.gz" 2>/dev/null | cut -f1))"
