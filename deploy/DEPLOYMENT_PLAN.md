# Deployment Plan: DNA ME CRM auf Proxmox (Manitu Root-Server)

> **Methode:** SCP/SFTP — lokaler Build, Upload auf Server.

---

## Architektur

```
Proxmox Host (Manitu Root-Server)
│
├── LXC 100  dna-proxy   512MB   1core   5GB   10.10.10.1   Nginx + SSL
├── LXC 101  dna-app      4GB   2core  20GB   10.10.10.2   Docker (API + Workers + Frontend)
├── LXC 102  dna-db        2GB   2core  30GB   10.10.10.3   PostgreSQL 15
└── LXC 103  dna-redis     1GB   1core   5GB   10.10.10.4   Redis 7
```

```
Internet → :443 → LXC 100 (Nginx) → LXC 101 :3000 (API)
                                   → LXC 101 :8080 (Frontend)
                  LXC 101 → LXC 102 :5432 (PostgreSQL)
                          → LXC 103 :6379 (Redis)
```

## Serveranforderungen

| Ressource | Minimum | Empfohlen |
|-----------|---------|-----------|
| CPU | 4 Kerne | 6+ Kerne |
| RAM | 6 GB | 8–12 GB |
| Disk | 60 GB SSD | 100 GB SSD |

---
---

# TEIL 1: Robin / ADMIN (Server einrichten — einmalig)

> Alles in diesem Teil wird auf dem Manitu Root-Server ausgeführt.
> Nach Abschluss braucht Alex: SSH-Zugang (IP + Passwort), DB-Passwort, SMTP-Daten.

---

### Schritt 1: Proxmox installieren

```bash
# Falls Debian 12 bereits installiert:
echo "deb http://download.proxmox.com/debian/pve bookworm pve-no-subscription" > /etc/apt/sources.list.d/pve.list
wget https://enterprise.proxmox.com/debian/proxmox-release-bookworm.gpg -O /etc/apt/trusted.gpg.d/proxmox-release-bookworm.gpg
apt update && apt full-upgrade -y
apt install -y proxmox-ve postfix open-iscsi
reboot
```

Web-UI: `https://<SERVER_IP>:8006`

Debian-Template herunterladen:
```bash
pveam update
pveam download local debian-12-standard_12.2-1_amd64.tar.zst
```

---

### Schritt 2: Internes Netzwerk einrichten

```bash
cat >> /etc/network/interfaces <<'EOF'

auto vmbr1
iface vmbr1 inet static
    address 10.10.10.1
    netmask 255.255.255.0
    bridge-ports none
    bridge-stp off
    bridge-fd 0
EOF

echo "net.ipv4.ip_forward = 1" >> /etc/sysctl.conf
sysctl -p

iptables -t nat -A POSTROUTING -s 10.10.10.0/24 -o vmbr0 -j MASQUERADE
iptables -t nat -A PREROUTING -i vmbr0 -p tcp --dport 80 -j DNAT --to 10.10.10.1:80
iptables -t nat -A PREROUTING -i vmbr0 -p tcp --dport 443 -j DNAT --to 10.10.10.1:443

apt install -y iptables-persistent
netfilter-persistent save
ifup vmbr1
```

---

### Schritt 3: LXC-Container erstellen

```bash
# LXC 100 — Nginx
pct create 100 local:vztmpl/debian-12-standard_12.2-1_amd64.tar.zst \
  --hostname dna-proxy --memory 512 --cores 1 --rootfs local-lvm:5 \
  --net0 name=eth0,bridge=vmbr1,ip=10.10.10.1/24 \
  --net1 name=eth1,bridge=vmbr0,ip=dhcp \
  --unprivileged 1

# LXC 101 — App (Docker)
pct create 101 local:vztmpl/debian-12-standard_12.2-1_amd64.tar.zst \
  --hostname dna-app --memory 4096 --cores 2 --rootfs local-lvm:20 \
  --net0 name=eth0,bridge=vmbr1,ip=10.10.10.2/24,gw=10.10.10.1 \
  --unprivileged 0 --features nesting=1,keyctl=1

# LXC 102 — PostgreSQL
pct create 102 local:vztmpl/debian-12-standard_12.2-1_amd64.tar.zst \
  --hostname dna-db --memory 2048 --cores 2 --rootfs local-lvm:30 \
  --net0 name=eth0,bridge=vmbr1,ip=10.10.10.3/24,gw=10.10.10.1 \
  --unprivileged 1

# LXC 103 — Redis
pct create 103 local:vztmpl/debian-12-standard_12.2-1_amd64.tar.zst \
  --hostname dna-redis --memory 1024 --cores 1 --rootfs local-lvm:5 \
  --net0 name=eth0,bridge=vmbr1,ip=10.10.10.4/24,gw=10.10.10.1 \
  --unprivileged 1

# Alle starten
pct start 100 && pct start 101 && pct start 102 && pct start 103
```

---

### Schritt 4: PostgreSQL einrichten (LXC 102)

```bash
pct enter 102

apt update && apt install -y postgresql-15
echo "host all all 10.10.10.0/24 md5" >> /etc/postgresql/15/main/pg_hba.conf
sed -i "s/#listen_addresses = 'localhost'/listen_addresses = '*'/" /etc/postgresql/15/main/postgresql.conf
systemctl restart postgresql && systemctl enable postgresql

su - postgres -c "psql <<'SQL'
CREATE USER dna WITH PASSWORD 'HIER_SICHERES_PASSWORT';
CREATE DATABASE dna_marketing OWNER dna;
\c dna_marketing
CREATE EXTENSION IF NOT EXISTS \"uuid-ossp\";
SQL"

exit
```

> **WICHTIG:** Das Passwort notieren und an Alex weitergeben.

---

### Schritt 5: Redis einrichten (LXC 103)

```bash
pct enter 103

apt update && apt install -y redis-server
sed -i "s/bind 127.0.0.1 -::1/bind 0.0.0.0/" /etc/redis/redis.conf
sed -i "s/appendonly no/appendonly yes/" /etc/redis/redis.conf
systemctl restart redis-server && systemctl enable redis-server

redis-cli ping   # → PONG
exit
```

---

### Schritt 6: Docker auf App-Server einrichten (LXC 101)

```bash
pct enter 101

apt update && apt install -y ca-certificates curl gnupg
install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/debian/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
chmod a+r /etc/apt/keyrings/docker.gpg
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/debian $(. /etc/os-release && echo $VERSION_CODENAME) stable" > /etc/apt/sources.list.d/docker.list
apt update && apt install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin
systemctl enable docker

# Node.js für Migrationen
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt install -y nodejs

mkdir -p /opt/dna-crm
exit
```

---

### Schritt 7: Nginx einrichten (LXC 100)

```bash
pct enter 100

apt update && apt install -y nginx certbot python3-certbot-nginx

cat > /etc/nginx/sites-available/crm.dna-me.com <<'EOF'
server {
    listen 80;
    server_name crm.dna-me.com;
    client_max_body_size 10M;

    location / {
        proxy_pass http://10.10.10.2:8080;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location /api/ {
        proxy_pass http://10.10.10.2:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location /health { proxy_pass http://10.10.10.2:3000/health; }
    location /ready  { proxy_pass http://10.10.10.2:3000/ready; }
}
EOF

ln -sf /etc/nginx/sites-available/crm.dna-me.com /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default
nginx -t && systemctl restart nginx && systemctl enable nginx
exit
```

---

### Schritt 8: DNS einrichten

Beim Domain-Provider für `dna-me.com`:

| Typ | Name | Wert | TTL |
|-----|------|------|-----|
| A | crm | `<Manitu Server Public IP>` | 300 |

---

### Schritt 9: SSL-Zertifikat

Nachdem DNS funktioniert:

```bash
pct enter 100
certbot --nginx -d crm.dna-me.com --non-interactive --agree-tos -m admin@dna-me.com
certbot renew --dry-run
exit
```

---

### Schritt 10: Backups einrichten

```bash
pct enter 102
mkdir -p /opt/backups

cat > /opt/backups/backup.sh <<'SCRIPT'
#!/bin/bash
DATE=$(date +%Y-%m-%d_%H-%M)
su - postgres -c "pg_dump dna_marketing" | gzip > "/opt/backups/dna_marketing_${DATE}.sql.gz"
find /opt/backups -name "*.sql.gz" -mtime +30 -delete
SCRIPT

chmod +x /opt/backups/backup.sh
echo "0 3 * * * /opt/backups/backup.sh >> /var/log/backup.log 2>&1" | crontab -
exit
```

In Proxmox Web-UI: Datacenter → Backup → Add → alle 4 LXC, wöchentlich.

---

### Ende Teil 1

Alex braucht jetzt:
1. **SSH-Zugang** zum Proxmox-Host (IP + Passwort)
2. **PostgreSQL-Passwort** (aus Schritt 4)
3. **SMTP-Zugangsdaten** (Mail-Server)

---
---

# TEIL 2: ALEX (Deploy — vom eigenen PC)

> Alles hier wird auf deinem Windows-PC ausgeführt (Git Bash oder WSL).
> Voraussetzung: Teil 1 ist erledigt. Du hast SSH-Zugang, DB-Passwort und SMTP-Daten.

---

### Schritt 1: .env.production ausfüllen

Datei `deploy/.env.production` öffnen und alle `CHANGE_ME` ersetzen:

| Variable | Woher | Beispiel |
|----------|-------|---------|
| `DATABASE_URL` | DB-Passwort vom Robin | `postgres://dna:geheim@10.10.10.3:5432/dna_marketing` |
| `REDIS_URL` | Steht schon | `redis://10.10.10.4:6379` |
| `JWT_SECRET` | Selbst generieren | 64 zufällige Zeichen |
| `WEBHOOK_SECRET` | Selbst generieren | 32 zufällige Zeichen |
| `SMTP_*` | Vom Robin | z.B. `mail.manitu.de` |
| `API_KEYS` | Selbst definieren | `mein_key:manual` |

Secrets generieren (Git Bash):
```bash
openssl rand -hex 32   # → JWT_SECRET
openssl rand -hex 16   # → WEBHOOK_SECRET
```

---

### Schritt 2: Erster Deploy

```bash
cd /pfad/zu/crm_dna-me

# 1. Dependencies installieren
npm ci
cd frontend && npm ci && cd ..

# 2. Backend bauen
npm run build

# 3. Frontend bauen
cd frontend && npm run build && cd ..

# 4. Alles packen
tar -czf release.tar.gz dist/ frontend/dist/ migrations/ deploy/ Dockerfile package.json package-lock.json

# 5. Hochladen
scp release.tar.gz root@SERVER_IP:/tmp/
ssh root@SERVER_IP "pct push 101 /tmp/release.tar.gz /opt/dna-crm/release.tar.gz"

# 6. Auf dem Server starten
ssh root@SERVER_IP "pct enter 101 -- bash -c '
  cd /opt/dna-crm
  tar -xzf release.tar.gz
  cp deploy/.env.production .env.production
  npm run migrate:up
  docker compose -f deploy/docker-compose.prod.yml up -d --build
  rm release.tar.gz
'"
```

---

### Schritt 3: Prüfen

Im Browser: `https://crm.dna-me.com`

---

## Weitere Deployments (Updates)

Nach Code-Änderungen — **eine Zeile**:
```bash
bash deploy/deploy-local.sh
```

Oder manuell:

**Komplett:**
```bash
npm run build && cd frontend && npm run build && cd ..
tar -czf release.tar.gz dist/ frontend/dist/ migrations/ deploy/ Dockerfile package.json package-lock.json
scp release.tar.gz root@SERVER:/opt/dna-crm/
ssh root@SERVER "pct enter 101 -- bash -c 'cd /opt/dna-crm && tar -xzf release.tar.gz && npm run migrate:up && docker compose -f deploy/docker-compose.prod.yml up -d --build && rm release.tar.gz'"
```

**Nur Frontend:**
```bash
cd frontend && npm run build && cd ..
tar -czf frontend-update.tar.gz frontend/dist/
scp frontend-update.tar.gz root@SERVER:/opt/dna-crm/
ssh root@SERVER "pct enter 101 -- bash -c 'cd /opt/dna-crm && tar -xzf frontend-update.tar.gz && docker restart dna_frontend && rm frontend-update.tar.gz'"
```

**Nur Backend:**
```bash
npm run build
tar -czf backend-update.tar.gz dist/ migrations/ Dockerfile package.json package-lock.json
scp backend-update.tar.gz root@SERVER:/opt/dna-crm/
ssh root@SERVER "pct enter 101 -- bash -c 'cd /opt/dna-crm && tar -xzf backend-update.tar.gz && npm run migrate:up && docker compose -f deploy/docker-compose.prod.yml up -d --build api workers && rm backend-update.tar.gz'"
```

---

## Vorbereitete Dateien

```
deploy/
├── docker-compose.prod.yml   ← FÜR SERVER: wie Docker die App startet
├── frontend-nginx.conf       ← FÜR SERVER: React-SPA Konfiguration
├── nginx-proxy.conf          ← FÜR SERVER: Reverse-Proxy (LXC 100)
├── setup-proxmox.sh          ← FÜR Robin: automatisches LXC-Setup (optional)
├── deploy-local.sh           ← FÜR ALEX: ein Befehl zum Deployen
├── server-deploy.sh          ← FÜR SERVER: wird automatisch aufgerufen
├── backup.sh                 ← FÜR SERVER: tägliche DB-Backups
├── .env.production           ← FÜR ALEX: Passwörter ausfüllen vor Deploy
└── DEPLOYMENT_PLAN.md        ← Diese Anleitung
```

---

## Troubleshooting (für Alex)

| Problem | Was tun |
|---------|---------|
| API antwortet nicht | `ssh root@SERVER "pct enter 101 -- bash -c 'docker logs dna_api --tail 50'"` |
| Weißer Bildschirm | `ssh root@SERVER "pct enter 101 -- bash -c 'ls /opt/dna-crm/frontend/dist/'"` |
| Worker hängen | `ssh root@SERVER "pct enter 101 -- bash -c 'docker logs dna_workers --tail 50'"` |
| Alles neustarten | `ssh root@SERVER "pct enter 101 -- bash -c 'docker compose -f /opt/dna-crm/deploy/docker-compose.prod.yml restart'"` |
