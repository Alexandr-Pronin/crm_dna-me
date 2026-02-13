#!/bin/bash
# =============================================================================
# DNA ME CRM — EC2 User Data (Docker + Docker Compose bootstrap)
# Used by CloudFormation. App deployment is done via deploy-aws.sh.
# =============================================================================

set -e
exec > >(tee /var/log/user-data.log) 2>&1

echo "=== DNA ME CRM - EC2 Bootstrap ==="

dnf update -y

# Docker
dnf install -y docker
systemctl enable docker
systemctl start docker
usermod -aG docker ec2-user

# Docker Compose
curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
chmod +x /usr/local/bin/docker-compose

# Node.js for migrations
dnf install -y nodejs

# Backup directory
mkdir -p /opt/dna-crm/backups
chown -R ec2-user:ec2-user /opt/dna-crm

# Cron for automated pg_dump backup (runs daily at 3 AM)
cat > /opt/dna-crm/backup.sh << 'BACKUP_SCRIPT'
#!/bin/bash
# pg_dump via docker exec
BACKUP_DIR="/opt/dna-crm/backups"
DATE=$(date +%Y-%m-%d_%H-%M)
KEEP_DAYS=30

mkdir -p "$BACKUP_DIR"
docker exec dna_postgres pg_dump -U dna dna_marketing 2>/dev/null | gzip > "$BACKUP_DIR/dna_marketing_${DATE}.sql.gz" || true
find "$BACKUP_DIR" -name "*.sql.gz" -mtime +$KEEP_DAYS -delete 2>/dev/null || true
BACKUP_SCRIPT
chmod +x /opt/dna-crm/backup.sh

# Add cron (only after app is deployed; ec2-user will add via deploy script)
# echo "0 3 * * * /opt/dna-crm/backup.sh >> /var/log/dna-backup.log 2>&1" | crontab -u ec2-user

echo "Bootstrap complete. Run deploy-aws.sh to deploy the application."
