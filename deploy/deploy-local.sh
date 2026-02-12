#!/bin/bash
# =============================================================================
# DNA ME CRM — Local deploy script (run from project root on your PC)
# Builds everything locally, packs it, and uploads to server via SCP
# =============================================================================

set -e

SERVER_USER="root"
SERVER_HOST="10.10.10.2"  # LXC 101 IP — change if using Proxmox host IP with port forward
SERVER_PATH="/opt/dna-crm"

echo "=== Step 1: Building backend ==="
npm run build

echo "=== Step 2: Building frontend ==="
cd frontend
npm run build
cd ..

echo "=== Step 3: Packing release ==="
tar -czf release.tar.gz \
  dist/ \
  frontend/dist/ \
  migrations/ \
  deploy/ \
  Dockerfile \
  package.json \
  package-lock.json \
  .env.production

echo "Release size: $(du -h release.tar.gz | cut -f1)"

echo "=== Step 4: Uploading to server ==="
scp release.tar.gz $SERVER_USER@$SERVER_HOST:$SERVER_PATH/

echo "=== Step 5: Running deploy on server ==="
ssh $SERVER_USER@$SERVER_HOST "cd $SERVER_PATH && bash deploy/server-deploy.sh"

echo "=== Cleaning up local archive ==="
rm -f release.tar.gz

echo ""
echo "Deploy finished! Check: https://crm.dna-me.com"
