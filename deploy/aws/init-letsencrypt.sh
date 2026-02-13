#!/bin/sh
# =============================================================================
# DNA ME CRM — Certbot SSL init (run before nginx starts with SSL)
# Creates dummy certs so nginx can start, then certbot obtains real certs.
# Usage: DOMAIN=crm.dna-me.com EMAIL=admin@dna-me.com ./init-letsencrypt.sh
# =============================================================================

set -e

DOMAIN="${DOMAIN:-crm.dna-me.com}"
EMAIL="${EMAIL:-admin@dna-me.com}"
CERTS_DIR="/etc/letsencrypt/live/${DOMAIN}"

if [ -d "$CERTS_DIR" ] && [ -f "${CERTS_DIR}/fullchain.pem" ]; then
  echo "Certificates already exist for $DOMAIN, skipping."
  exit 0
fi

echo "Creating dummy certificates for $DOMAIN..."
mkdir -p "$CERTS_DIR"
openssl req -x509 -nodes -newkey rsa:2048 \
  -days 1 \
  -keyout "${CERTS_DIR}/privkey.pem" \
  -out "${CERTS_DIR}/fullchain.pem" \
  -subj "/CN=${DOMAIN}"

echo "Dummy certs created. Start nginx, then run certbot to obtain real certs."
echo "  docker compose run --rm certbot certonly --webroot -w /var/www/certbot -d $DOMAIN --email $EMAIL --agree-tos --non-interactive --force-renewal"
echo "  docker compose exec nginx-proxy nginx -s reload"
