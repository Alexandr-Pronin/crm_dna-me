#!/bin/bash
# =============================================================================
# DNA ME CRM — Server-side deploy script
# Run this on LXC 101 (App container) after uploading release.tar.gz
# =============================================================================

set -e

APP_DIR="/opt/dna-crm"
RELEASE_FILE="$APP_DIR/release.tar.gz"

if [ ! -f "$RELEASE_FILE" ]; then
  echo "ERROR: $RELEASE_FILE not found!"
  echo "Upload it first: scp release.tar.gz root@10.10.10.2:$APP_DIR/"
  exit 1
fi

echo "=== Extracting release ==="
cd $APP_DIR
tar -xzf release.tar.gz

echo "=== Running database migrations ==="
# Install node for migrations (one-time)
if ! command -v node &> /dev/null; then
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
  apt-get install -y nodejs
fi
npm run migrate:up

echo "=== Building and starting Docker containers ==="
docker compose -f deploy/docker-compose.prod.yml up -d --build

echo "=== Waiting for health check ==="
sleep 10
if curl -sf http://localhost:3000/health > /dev/null; then
  echo "API is healthy!"
else
  echo "WARNING: Health check failed. Check logs:"
  echo "  docker logs dna_api"
fi

echo "=== Cleaning up ==="
rm -f $RELEASE_FILE

echo ""
echo "Deploy complete!"
echo "  API:      http://localhost:3000"
echo "  Frontend: http://localhost:8080"
echo ""
echo "Useful commands:"
echo "  docker logs -f dna_api       # API logs"
echo "  docker logs -f dna_workers   # Worker logs"
echo "  docker compose -f deploy/docker-compose.prod.yml ps"
