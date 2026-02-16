#!/bin/bash
# =============================================================================
# DNA ME CRM — AWS Deployment via SSM (no SSH)
# Uses S3 for file transfer, aws ssm send-command for remote execution.
# Requires cloudformation-ssm.yaml stack (no Key Pair).
# =============================================================================

set -e

STACK_NAME="${STACK_NAME:-dna-crm-stack}"
REGION="${AWS_REGION:-eu-central-1}"
POSTGRES_WAIT="${POSTGRES_WAIT:-45}"
DEPLOY_PREFIX="dna-crm-deploy"

# ---------------------------------------------------------------------------
# Run SSM command and wait for completion
# Pass script via base64 to avoid JSON escaping issues.
# ---------------------------------------------------------------------------
ssm_run() {
  local instance_id="$1"
  local script="$2"
  local timeout="${3:-300}"

  local encoded
  encoded=$(echo "$script" | base64 | tr -d '\n')
  local cmd_id
  cmd_id=$(aws ssm send-command \
    --instance-ids "$instance_id" \
    --document-name "AWS-RunShellScript" \
    --parameters "commands=[\"echo $encoded | base64 -d | bash\"]" \
    --timeout-seconds "$timeout" \
    --region "$REGION" \
    --output text \
    --query "Command.CommandId")

  echo "  CommandId: $cmd_id (waiting...)"
  local status
  for i in $(seq 1 60); do
    status=$(aws ssm get-command-invocation \
      --command-id "$cmd_id" \
      --instance-id "$instance_id" \
      --region "$REGION" \
      --query "Status" \
      --output text 2>/dev/null || echo "Pending")
    if [[ "$status" == "Success" ]]; then
      echo "  Output:"
      aws ssm get-command-invocation \
        --command-id "$cmd_id" \
        --instance-id "$instance_id" \
        --region "$REGION" \
        --query "StandardOutputContent" \
        --output text 2>/dev/null | sed 's/^/    /'
      return 0
    elif [[ "$status" == "Failed" ]] || [[ "$status" == "Cancelled" ]]; then
      echo "  ERROR: Command failed. Status: $status"
      aws ssm get-command-invocation \
        --command-id "$cmd_id" \
        --instance-id "$instance_id" \
        --region "$REGION" \
        --query "[StandardOutputContent,StandardErrorContent]" \
        --output text 2>/dev/null | sed 's/^/    /'
      return 1
    fi
    sleep 5
  done
  echo "  ERROR: Timeout waiting for command"
  return 1
}

# ---------------------------------------------------------------------------
# Fetch stack outputs
# ---------------------------------------------------------------------------
echo "=== Fetching stack outputs ==="
APP_INSTANCE=$(aws cloudformation describe-stacks --stack-name "$STACK_NAME" --region "$REGION" \
  --query "Stacks[0].Outputs[?OutputKey=='AppInstanceId'].OutputValue" --output text 2>/dev/null || true)
DB_INSTANCE=$(aws cloudformation describe-stacks --stack-name "$STACK_NAME" --region "$REGION" \
  --query "Stacks[0].Outputs[?OutputKey=='DbInstanceId'].OutputValue" --output text 2>/dev/null || true)
DB_PRIVATE_IP=$(aws cloudformation describe-stacks --stack-name "$STACK_NAME" --region "$REGION" \
  --query "Stacks[0].Outputs[?OutputKey=='DbPrivateIP'].OutputValue" --output text 2>/dev/null || true)
APP_HOST=$(aws cloudformation describe-stacks --stack-name "$STACK_NAME" --region "$REGION" \
  --query "Stacks[0].Outputs[?OutputKey=='AppPublicIP'].OutputValue" --output text 2>/dev/null || true)
DEPLOY_BUCKET=$(aws cloudformation describe-stacks --stack-name "$STACK_NAME" --region "$REGION" \
  --query "Stacks[0].Outputs[?OutputKey=='DeployBucket'].OutputValue" --output text 2>/dev/null || true)

if [[ -z "$APP_INSTANCE" ]] || [[ -z "$DB_INSTANCE" ]] || [[ -z "$DEPLOY_BUCKET" ]]; then
  echo "ERROR: Stack outputs not found. Use cloudformation-ssm.yaml and ensure DeployBucket is set."
  exit 1
fi
echo "  App: $APP_INSTANCE | DB: $DB_INSTANCE | Bucket: $DEPLOY_BUCKET"

# ---------------------------------------------------------------------------
# Require .env.aws
# ---------------------------------------------------------------------------
if [[ ! -f deploy/aws/.env.aws ]]; then
  echo "ERROR: deploy/aws/.env.aws not found. Copy from .env.aws.example and fill POSTGRES_PASSWORD."
  exit 1
fi
source deploy/aws/.env.aws 2>/dev/null || true
if [[ -z "$POSTGRES_PASSWORD" ]]; then
  echo "ERROR: POSTGRES_PASSWORD not set in deploy/aws/.env.aws"
  exit 1
fi

DATABASE_URL="postgres://dna:${POSTGRES_PASSWORD}@${DB_PRIVATE_IP}:5432/dna_marketing"

# Extract first API key (before the colon label) for frontend build
FRONTEND_API_KEY=$(echo "$API_KEYS" | cut -d: -f1)
if [[ -z "$FRONTEND_API_KEY" ]]; then
  echo "WARNING: API_KEYS not set in .env.aws, frontend will use default 'test123'"
  FRONTEND_API_KEY="test123"
fi

# ---------------------------------------------------------------------------
# Build and pack
# ---------------------------------------------------------------------------
echo "=== Step 1: Building backend ==="
npm run build

echo "=== Step 2: Building frontend ==="
cd frontend
# MSYS_NO_PATHCONV=1 prevents Git Bash/MINGW from converting /api/v1 to C:/Program Files/Git/api/v1
MSYS_NO_PATHCONV=1 VITE_API_URL=/api/v1 VITE_API_KEY="$FRONTEND_API_KEY" VITE_API_FALLBACK="https://${DOMAIN_NAME:-crm.dna-me.net}/api/v1" npm run build
cd ..

echo "=== Step 3: Packing release ==="
tar -czf release.tar.gz \
  dist/ \
  src/ \
  frontend/dist/ \
  migrations/ \
  deploy/ \
  deploy/aws/ \
  Dockerfile \
  tsconfig.json \
  package.json \
  package-lock.json \
  migrate-config.json

# Create .env files
echo "POSTGRES_PASSWORD=$POSTGRES_PASSWORD" > /tmp/.env.db
grep -v "^DATABASE_URL=" deploy/aws/.env.aws > /tmp/.env.app
echo "DATABASE_URL=$DATABASE_URL" >> /tmp/.env.app

# ---------------------------------------------------------------------------
# Upload to S3
# ---------------------------------------------------------------------------
echo "=== Step 4: Uploading to S3 ==="
DEPLOY_KEY="${DEPLOY_PREFIX}/$(date +%Y%m%d-%H%M%S)"
aws s3 cp release.tar.gz "s3://${DEPLOY_BUCKET}/${DEPLOY_KEY}/release.tar.gz" --region "$REGION"
aws s3 cp /tmp/.env.db "s3://${DEPLOY_BUCKET}/${DEPLOY_KEY}/.env.db" --region "$REGION"
aws s3 cp /tmp/.env.app "s3://${DEPLOY_BUCKET}/${DEPLOY_KEY}/.env.app" --region "$REGION"
echo "  Uploaded to s3://${DEPLOY_BUCKET}/${DEPLOY_KEY}/"

# ---------------------------------------------------------------------------
# Deploy to DB instance
# ---------------------------------------------------------------------------
echo "=== Step 5: Deploying to DB instance ==="
DB_SCRIPT=$(cat << REMOTE_DB
set -e
cd /opt/dna-crm
aws s3 cp s3://${DEPLOY_BUCKET}/${DEPLOY_KEY}/release.tar.gz /tmp/release.tar.gz --region ${REGION}
aws s3 cp s3://${DEPLOY_BUCKET}/${DEPLOY_KEY}/.env.db /opt/dna-crm/.env.aws --region ${REGION}
tar -xzf /tmp/release.tar.gz -C .
rm /tmp/release.tar.gz
cp deploy/aws/backup.sh /opt/dna-crm/backup.sh
chmod +x /opt/dna-crm/backup.sh
chown -R ec2-user:ec2-user /opt/dna-crm
sudo -u ec2-user docker-compose -f deploy/aws/docker-compose.db.yml --env-file .env.aws up -d
for i in \$(seq 1 30); do
  if sudo -u ec2-user docker exec dna_postgres pg_isready -U dna -d dna_marketing 2>/dev/null; then
    echo "Postgres ready."
    exit 0
  fi
  sleep 2
done
echo "WARNING: Postgres health check timeout"
REMOTE_DB
)

ssm_run "$DB_INSTANCE" "$DB_SCRIPT" 120 || exit 1

echo "  Waiting ${POSTGRES_WAIT}s for Postgres to stabilize..."
sleep "$POSTGRES_WAIT"

# ---------------------------------------------------------------------------
# Deploy to App instance
# ---------------------------------------------------------------------------
echo "=== Step 6: Deploying to App instance ==="
APP_SCRIPT=$(cat << REMOTE_APP
set -e
cd /opt/dna-crm
aws s3 cp s3://${DEPLOY_BUCKET}/${DEPLOY_KEY}/release.tar.gz /tmp/release.tar.gz --region ${REGION}
aws s3 cp s3://${DEPLOY_BUCKET}/${DEPLOY_KEY}/.env.app /opt/dna-crm/.env.aws --region ${REGION}
tar -xzf /tmp/release.tar.gz -C .
rm /tmp/release.tar.gz
chown -R ec2-user:ec2-user /opt/dna-crm
DOMAIN=\$(grep '^DOMAIN_NAME=' .env.aws 2>/dev/null | cut -d= -f2)
DOMAIN=\${DOMAIN:-crm.dna-me.net}
sed "s/DOMAIN_NAME/\$DOMAIN/g" deploy/aws/nginx-aws.conf.template > deploy/aws/nginx-aws.conf
sudo -u ec2-user bash -c 'cd /opt/dna-crm && npm ci && export \$(grep -v ^# .env.aws 2>/dev/null | xargs) && npm run migrate:up'
sudo -u ec2-user docker-compose -f deploy/aws/docker-compose.aws.yml --env-file .env.aws up -d --build
(crontab -l 2>/dev/null | grep -v backup.sh; true) | crontab - 2>/dev/null || true
sleep 15
curl -sf http://localhost/health && echo " OK" || echo " WARNING: Health check failed"
REMOTE_APP
)

ssm_run "$APP_INSTANCE" "$APP_SCRIPT" 300 || exit 1

# ---------------------------------------------------------------------------
# Cleanup
# ---------------------------------------------------------------------------
rm -f release.tar.gz /tmp/.env.db /tmp/.env.app

echo ""
echo "Deploy complete!"
echo "  App:  https://${APP_HOST}"
echo "  Health: http://${APP_HOST}/health"
