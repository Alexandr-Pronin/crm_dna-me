#!/bin/bash
# =============================================================================
# DNA ME CRM — Proxmox LXC Setup Script
# Run this on the Proxmox host as root
# =============================================================================

set -e

# ---- CONFIG ----
STORAGE="local-lvm"           # Proxmox storage pool
TEMPLATE="local:vztmpl/debian-12-standard_12.2-1_amd64.tar.zst"
BRIDGE_INTERNAL="vmbr1"
GATEWAY_INTERNAL="10.10.10.1"
SUBNET="10.10.10.0/24"

DB_PASSWORD="CHANGE_ME_STRONG_PASSWORD"
# -----------------

echo "=== Step 1: Create internal bridge vmbr1 (if not exists) ==="
if ! grep -q "$BRIDGE_INTERNAL" /etc/network/interfaces; then
  cat >> /etc/network/interfaces <<EOF

auto $BRIDGE_INTERNAL
iface $BRIDGE_INTERNAL inet static
    address $GATEWAY_INTERNAL
    netmask 255.255.255.0
    bridge-ports none
    bridge-stp off
    bridge-fd 0
    post-up   echo 1 > /proc/sys/net/ipv4/ip_forward
    post-up   iptables -t nat -A POSTROUTING -s $SUBNET -o vmbr0 -j MASQUERADE
    post-down iptables -t nat -D POSTROUTING -s $SUBNET -o vmbr0 -j MASQUERADE
EOF
  ifup $BRIDGE_INTERNAL
  echo "Created $BRIDGE_INTERNAL"
else
  echo "$BRIDGE_INTERNAL already exists, skipping"
fi

echo ""
echo "=== Step 2: Create LXC 100 — Nginx Reverse Proxy ==="
pct create 100 $TEMPLATE \
  --hostname dna-proxy \
  --memory 512 \
  --cores 1 \
  --rootfs $STORAGE:5 \
  --net0 name=eth0,bridge=vmbr0,ip=dhcp \
  --net1 name=eth1,bridge=$BRIDGE_INTERNAL,ip=10.10.10.1/24 \
  --unprivileged 1 \
  --start 1

echo "Waiting for LXC 100 to start..."
sleep 5

pct exec 100 -- bash -c '
  apt-get update && apt-get install -y nginx certbot python3-certbot-nginx
  systemctl enable nginx
  echo "LXC 100 (Nginx) ready"
'

echo ""
echo "=== Step 3: Create LXC 101 — App (Docker) ==="
pct create 101 $TEMPLATE \
  --hostname dna-app \
  --memory 4096 \
  --cores 2 \
  --rootfs $STORAGE:20 \
  --net0 name=eth0,bridge=$BRIDGE_INTERNAL,ip=10.10.10.2/24,gw=$GATEWAY_INTERNAL \
  --unprivileged 0 \
  --features nesting=1,keyctl=1 \
  --start 1

sleep 5

pct exec 101 -- bash -c '
  apt-get update && apt-get install -y ca-certificates curl gnupg
  install -m 0755 -d /etc/apt/keyrings
  curl -fsSL https://download.docker.com/linux/debian/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
  chmod a+r /etc/apt/keyrings/docker.gpg
  echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/debian $(. /etc/os-release && echo $VERSION_CODENAME) stable" > /etc/apt/sources.list.d/docker.list
  apt-get update && apt-get install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin
  systemctl enable docker
  mkdir -p /opt/dna-crm
  echo "LXC 101 (Docker) ready"
'

echo ""
echo "=== Step 4: Create LXC 102 — PostgreSQL ==="
pct create 102 $TEMPLATE \
  --hostname dna-db \
  --memory 2048 \
  --cores 2 \
  --rootfs $STORAGE:30 \
  --net0 name=eth0,bridge=$BRIDGE_INTERNAL,ip=10.10.10.3/24,gw=$GATEWAY_INTERNAL \
  --unprivileged 1 \
  --start 1

sleep 5

pct exec 102 -- bash -c "
  apt-get update && apt-get install -y postgresql-15
  systemctl enable postgresql

  # Allow connections from internal network
  echo \"host all all 10.10.10.0/24 md5\" >> /etc/postgresql/15/main/pg_hba.conf
  sed -i \"s/#listen_addresses = 'localhost'/listen_addresses = '*'/\" /etc/postgresql/15/main/postgresql.conf

  systemctl restart postgresql

  # Create database and user
  su - postgres -c \"psql -c \\\"CREATE USER dna WITH PASSWORD '$DB_PASSWORD';\\\"\"
  su - postgres -c \"psql -c \\\"CREATE DATABASE dna_marketing OWNER dna;\\\"\"
  su - postgres -c \"psql -d dna_marketing -c \\\"CREATE EXTENSION IF NOT EXISTS \\\\\\\"uuid-ossp\\\\\\\";\\\"\"

  echo 'LXC 102 (PostgreSQL) ready'
"

echo ""
echo "=== Step 5: Create LXC 103 — Redis ==="
pct create 103 $TEMPLATE \
  --hostname dna-redis \
  --memory 1024 \
  --cores 1 \
  --rootfs $STORAGE:5 \
  --net0 name=eth0,bridge=$BRIDGE_INTERNAL,ip=10.10.10.4/24,gw=$GATEWAY_INTERNAL \
  --unprivileged 1 \
  --start 1

sleep 5

pct exec 103 -- bash -c '
  apt-get update && apt-get install -y redis-server
  sed -i "s/bind 127.0.0.1/bind 0.0.0.0/" /etc/redis/redis.conf
  sed -i "s/# maxmemory <bytes>/maxmemory 512mb/" /etc/redis/redis.conf
  sed -i "s/# maxmemory-policy noeviction/maxmemory-policy allkeys-lru/" /etc/redis/redis.conf
  echo "appendonly yes" >> /etc/redis/redis.conf
  systemctl restart redis-server
  systemctl enable redis-server
  echo "LXC 103 (Redis) ready"
'

echo ""
echo "=== Step 6: Firewall — only expose ports 80/443 on LXC 100 ==="
# Port forward from host to LXC 100
iptables -t nat -A PREROUTING -i vmbr0 -p tcp --dport 80 -j DNAT --to 10.10.10.1:80
iptables -t nat -A PREROUTING -i vmbr0 -p tcp --dport 443 -j DNAT --to 10.10.10.1:443

# Save rules
apt-get install -y iptables-persistent
netfilter-persistent save

echo ""
echo "============================================="
echo "  Setup complete!"
echo "  LXC 100 (Nginx):      10.10.10.1"
echo "  LXC 101 (App/Docker): 10.10.10.2"
echo "  LXC 102 (PostgreSQL): 10.10.10.3"
echo "  LXC 103 (Redis):      10.10.10.4"
echo ""
echo "  Next steps:"
echo "  1. Copy nginx-proxy.conf to LXC 100: /etc/nginx/sites-available/crm.dna-me.com"
echo "  2. Run certbot: certbot --nginx -d crm.dna-me.com"
echo "  3. Deploy app to LXC 101 using deploy.sh"
echo "============================================="
