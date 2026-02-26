#!/bin/sh
# =============================================================================
# Nginx + Certbot entrypoint — init dummy certs, obtain real cert, renew loop
# Script remains as PID 1 to keep container alive.
# =============================================================================

set -e

DOMAIN="${DOMAIN_NAME:-crm.dna-me.net}"
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

# 2. Start nginx (daemon mode) to serve ACME challenge
echo "Starting nginx..."
nginx -t && nginx || { echo "Nginx config check failed"; exit 1; }
sleep 2

# 3. Obtain real cert (or renew)
echo "Obtaining Let's Encrypt certificate..."
certbot certonly --webroot -w /var/www/certbot \
  -d "$DOMAIN" --email "$EMAIL" \
  --agree-tos --non-interactive --force-renewal 2>/dev/null || true

# 3b. If Certbot saved to DOMAIN-0001 (happens when DOMAIN had our dummy), point DOMAIN to it so nginx gets the real cert
REAL_DIR="${CERTS_DIR}-0001"
if [ -d "$REAL_DIR" ] && [ -f "${REAL_DIR}/fullchain.pem" ]; then
  echo "Linking $CERTS_DIR -> $(basename "$REAL_DIR") so nginx uses the real certificate."
  rm -rf "$CERTS_DIR"
  ln -s "$(basename "$REAL_DIR")" "$CERTS_DIR"
fi

# 4. Reload nginx to use real certs
nginx -s reload 2>/dev/null || true

# 5. Renewal loop — script stays as PID 1
while true; do
  sleep 43200
  certbot renew --webroot -w /var/www/certbot --quiet 2>/dev/null && nginx -s reload 2>/dev/null || true
done
