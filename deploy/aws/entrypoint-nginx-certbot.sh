#!/bin/sh
# =============================================================================
# Nginx + Certbot entrypoint — init dummy certs, obtain real cert, renew loop
# =============================================================================

set -e

DOMAIN="${DOMAIN_NAME:-crm.dna-me.com}"
EMAIL="${LETSENCRYPT_EMAIL:-admin@dna-me.com}"
CERTS_DIR="/etc/letsencrypt/live/${DOMAIN}"

# 1. Create dummy certs if real certs don't exist
if [ ! -f "${CERTS_DIR}/fullchain.pem" ]; then
  echo "Creating dummy certificates for $DOMAIN..."
  mkdir -p "$CERTS_DIR"
  openssl req -x509 -nodes -newkey rsa:2048 -days 1 \
    -keyout "${CERTS_DIR}/privkey.pem" \
    -out "${CERTS_DIR}/fullchain.pem" \
    -subj "/CN=${DOMAIN}"
fi

# 2. Start nginx (background) to serve ACME challenge
echo "Starting nginx..."
nginx

# 3. Obtain real cert (or renew)
echo "Obtaining Let's Encrypt certificate..."
certbot certonly --webroot -w /var/www/certbot \
  -d "$DOMAIN" --email "$EMAIL" \
  --agree-tos --non-interactive --force-renewal 2>/dev/null || true

# 4. Reload nginx to use real certs
nginx -s reload

# 5. Renewal loop (every 12h)
while true; do
  sleep 12h
  certbot renew --webroot -w /var/www/certbot --quiet && nginx -s reload
done
