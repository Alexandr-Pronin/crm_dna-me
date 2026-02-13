#!/bin/bash
# =============================================================================
# DNA ME CRM — AWS Deployment Script (2 instances: App + DB)
# Deploys to DB first, waits for Postgres, then to App.
# =============================================================================

set -e

EC2_USER="${EC2_USER:-ec2-user}"
SSH_KEY="${SSH_KEY:-}"
APP_DIR="/opt/dna-crm"
STACK_NAME="${STACK_NAME:-dna-crm-stack}"
POSTGRES_WAIT="${POSTGRES_WAIT:-45}"

SSH_OPTS="-o StrictHostKeyChecking=no -o ConnectTimeout=10"
[ -n "$SSH_KEY" ] && SSH_OPTS="$SSH_OPTS -i $SSH_KEY"

# ---------------------------------------------------------------------------
# Fetch IPs from CloudFormation
# ---------------------------------------------------------------------------
echo "=== Fetching stack outputs ==="
APP_HOST=$(aws cloudformation describe-stacks --stack-name "$STACK_NAME" \
  --query "Stacks[0].Outputs[?OutputKey=='AppPublicIP'].OutputValue" --output text 2>/dev/null || true)
DB_PRIVATE_IP=$(aws cloudformation describe-stacks --stack-name "$STACK_NAME" \
  --query "Stacks[0].Outputs[?OutputKey=='DbPrivateIP'].OutputValue" --output text 2>/dev/null || true)
DB_PUBLIC_IP=$(aws cloudformation describe-stacks --stack-name "$STACK_NAME" \
  --query "Stacks[0].Outputs[?OutputKey=='DbPublicIP'].OutputValue" --output text 2>/dev/null || true)

# Fallback for single-instance stacks
if [ -z "$APP_HOST" ]; then
  APP_HOST=$(aws cloudformation describe-stacks --stack-name "$STACK_NAME" \
    --query "Stacks[0].Outputs[?OutputKey=='PublicIP'].OutputValue" --output text 2>/dev/null || true)
fi

if [ -z "$APP_HOST" ]; then
  echo "ERROR: Could not get App public IP. Deploy CloudFormation stack first."
  exit 1
fi

TWO_INSTANCE_MODE=false
if [ -n "$DB_PRIVATE_IP" ]; then
  TWO_INSTANCE_MODE=true
  echo "  App: $APP_HOST | DB: $DB_PRIVATE_IP${DB_PUBLIC_IP:+ (public: $DB_PUBLIC_IP)}"
else
  echo "  App: $APP_HOST (single-instance mode, not implemented - use 2-instance stack)"
  exit 1
fi

# ---------------------------------------------------------------------------
# Require .env.aws with POSTGRES_PASSWORD
# ---------------------------------------------------------------------------
if [ ! -f deploy/aws/.env.aws ]; then
  echo "ERROR: deploy/aws/.env.aws not found. Copy from .env.aws.example and fill POSTGRES_PASSWORD."
  exit 1
fi
source deploy/aws/.env.aws 2>/dev/null || true
if [ -z "$POSTGRES_PASSWORD" ]; then
  echo "ERROR: POSTGRES_PASSWORD not set in deploy/aws/.env.aws"
  exit 1
fi

# Build DATABASE_URL for App
DATABASE_URL="postgres://dna:${POSTGRES_PASSWORD}@${DB_PRIVATE_IP}:5432/dna_marketing"

# ---------------------------------------------------------------------------
# Build and pack
# ---------------------------------------------------------------------------
echo "=== Step 1: Building backend ==="
npm run build

echo "=== Step 2: Building frontend ==="
cd frontend
VITE_API_URL=/api/v1 npm run build
cd ..

echo "=== Step 3: Packing release ==="
tar -czf release.tar.gz \
  dist/ \
  frontend/dist/ \
  migrations/ \
  deploy/ \
  deploy/aws/ \
  Dockerfile \
  package.json \
  package-lock.json \
  migrate-config.json

# Create .env for DB (only POSTGRES_PASSWORD)
echo "POSTGRES_PASSWORD=$POSTGRES_PASSWORD" > /tmp/.env.db

# Create .env for App (full, with DATABASE_URL pointing to DB)
grep -v "^DATABASE_URL=" deploy/aws/.env.aws > /tmp/.env.app
echo "DATABASE_URL=$DATABASE_URL" >> /tmp/.env.app

# ---------------------------------------------------------------------------
# Deploy to DB instance first (direct SSH or ProxyJump)
# ---------------------------------------------------------------------------
echo "=== Step 4: Deploying to DB instance ==="
DB_SSH_TARGET="${DB_PUBLIC_IP:-$DB_PRIVATE_IP}"
if [ -n "$DB_PUBLIC_IP" ]; then
  DB_SSH_OPTS="$SSH_OPTS"
  echo "  Using direct SSH to DB ($DB_PUBLIC_IP)"
else
  DB_SSH_OPTS="$SSH_OPTS -o ProxyJump=$EC2_USER@$APP_HOST"
  echo "  Using ProxyJump via App"
fi

echo "  Uploading release to DB..."
scp $DB_SSH_OPTS release.tar.gz $EC2_USER@$DB_SSH_TARGET:/tmp/
scp $DB_SSH_OPTS /tmp/.env.db $EC2_USER@$DB_SSH_TARGET:/tmp/.env.aws

ssh $DB_SSH_OPTS $EC2_USER@$DB_SSH_TARGET "bash -s" << 'REMOTE_DB'
set -e
cd /opt/dna-crm
tar -xzf /tmp/release.tar.gz -C .
rm /tmp/release.tar.gz
mv /tmp/.env.aws .env.aws
cp deploy/aws/backup.sh /opt/dna-crm/backup.sh
chmod +x /opt/dna-crm/backup.sh

echo "  Starting Postgres..."
docker compose -f deploy/aws/docker-compose.db.yml --env-file .env.aws up -d

echo "  Waiting for Postgres to be ready..."
for i in $(seq 1 30); do
  if docker exec dna_postgres pg_isready -U dna -d dna_marketing 2>/dev/null; then
    echo "  Postgres is ready."
    exit 0
  fi
  sleep 2
done
echo "  WARNING: Postgres health check timeout"
REMOTE_DB

echo "  Waiting ${POSTGRES_WAIT}s for Postgres to stabilize..."
sleep "$POSTGRES_WAIT"

# ---------------------------------------------------------------------------
# Deploy to App instance
# ---------------------------------------------------------------------------
echo "=== Step 5: Deploying to App instance ==="
scp $SSH_OPTS release.tar.gz $EC2_USER@$APP_HOST:/tmp/
scp $SSH_OPTS /tmp/.env.app $EC2_USER@$APP_HOST:/tmp/.env.aws

ssh $SSH_OPTS $EC2_USER@$APP_HOST "bash -s" << REMOTE_APP
set -e
cd /opt/dna-crm
tar -xzf /tmp/release.tar.gz -C .
rm /tmp/release.tar.gz
mv /tmp/.env.aws .env.aws
export \$(grep -v '^#' .env.aws 2>/dev/null | xargs) || true

if [ -n "\$DOMAIN_NAME" ] && [ "\$DOMAIN_NAME" != "crm.dna-me.com" ]; then
  sed "s/crm.dna-me.com/\$DOMAIN_NAME/g" deploy/aws/nginx-aws.conf.template > deploy/aws/nginx-aws.conf
fi

echo "  Running migrations..."
DATABASE_URL="\${DATABASE_URL}" npm run migrate:up

echo "  Starting App stack..."
docker compose -f deploy/aws/docker-compose.aws.yml --env-file .env.aws up -d --build

(crontab -l 2>/dev/null | grep -v backup.sh; true) | crontab - 2>/dev/null || true

echo "  Waiting for health check..."
sleep 15
curl -sf http://localhost/health && echo " OK" || echo " WARNING: Health check failed"
REMOTE_APP

rm -f release.tar.gz /tmp/.env.db /tmp/.env.app

echo ""
echo "Deploy complete!"
echo "  App:  https://$APP_HOST"
echo "  Health: http://$APP_HOST/health"
