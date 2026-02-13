# DNA ME CRM — AWS Deployment (eu-central-1)

Portable deployment: **no RDS, ALB, Lambda, ElastiCache**. Postgres, Redis, Nginx in Docker. Easy migration to Proxmox/Manitou.

## Architecture (2 instances)

- **App EC2** (t3.medium) — public subnet: API, Workers, Frontend, Redis, Nginx+Certbot
- **DB EC2** (t3.medium) — public subnet, public IP for docker pulls: Postgres 15 only (SG: 5432 from App, 22 from AllowedCidr)
- **Cost**: No NAT Gateway (DB in public subnet)
- **Data**: DB EBS volume `DeleteOnTermination: false`
- **Backup**: Cron 3 AM daily, local + S3 (optional)
- **AllowedCidr**: Default 1.1.1.1/32 — **change to your IP** for SSH

## Prerequisites

- AWS CLI configured
- SSH key pair in EC2
- Domain DNS A record pointing to Elastic IP (for SSL)

## Quick Start

### 1. Create CloudFormation Stack

**Required**: Set `AllowedCidr` to your IP (default 1.1.1.1/32 blocks SSH).

```bash
aws cloudformation create-stack \
  --stack-name dna-crm-stack \
  --template-body file://deploy/aws/cloudformation.yaml \
  --parameters \
    ParameterKey=KeyPairName,ParameterValue=YOUR_KEY_NAME \
    ParameterKey=AllowedCidr,ParameterValue=YOUR_IP/32
```

Optional: Add `ParameterKey=S3BackupBucket,ParameterValue=your-backup-bucket` for off-site backups. Create the bucket first.

Wait for stack creation, then get outputs:

```bash
aws cloudformation describe-stacks --stack-name dna-crm-stack \
  --query "Stacks[0].Outputs" --output table
# AppPublicIP = Elastic IP, DbPrivateIP = for DATABASE_URL
```

### 2. Point DNS to Elastic IP

Create A record: `crm.dna-me.com` → `<Elastic IP>`

### 3. Configure Environment

```bash
cp deploy/aws/.env.aws.example deploy/aws/.env.aws
# Edit .env.aws — set POSTGRES_PASSWORD, JWT_SECRET, WEBHOOK_SECRET, SMTP, etc.
```

### 4. Deploy Application

```bash
export SSH_KEY=~/.ssh/your-key.pem
bash deploy/aws/deploy-aws.sh
```

The script fetches AppPublicIP and DbPrivateIP from CloudFormation, deploys to DB first (via SSH to DB public IP or ProxyJump), waits 45s for Postgres, then deploys to App.

### 5. Verify

- https://crm.dna-me.com (or https://\<Elastic IP\>)
- https://crm.dna-me.com/health

### 6. Monitoring (MVP)

We recommend a free external uptime monitor for the MVP:
- **UptimeRobot** (https://uptimerobot.com) — 50 monitors free, 5-min interval
- **Healthchecks.io** (https://healthchecks.io) — cron job monitoring, free tier

Configure a monitor for `https://your-domain/health` to receive alerts when the app is down.

## Files

| File | Purpose |
|------|---------|
| `cloudformation.yaml` | VPC, 2 EC2 (App + DB), SG, EIP |
| `docker-compose.aws.yml` | App services (Redis, Nginx, Certbot, API, Workers, Frontend) |
| `docker-compose.db.yml` | DB instance: Postgres only |
| `nginx-aws.conf` | Reverse proxy + SSL |
| `Dockerfile.nginx-certbot` | Nginx + Certbot for automated SSL |
| `init-letsencrypt.sh` | Dummy certs before first Let's Encrypt run |
| `backup.sh` | `pg_dump` to local volume + S3 upload (cron 3 AM) |
| `deploy-aws.sh` | Build, pack, upload, deploy |
| `.env.aws.example` | Environment template |

## Security

- **SSH (22)**: Restricted to `AllowedCidr` (default 1.1.1.1/32 — change to your IP)
- **DB (5432)**: Only from App instance
- **DB (22)**: From AllowedCidr for deploy
- **HTTP (80)**: Open (Certbot ACME, redirect to HTTPS)
- **HTTPS (443)**: Open

## Backup

- **Local**: Daily at 3 AM to `/opt/dna-crm/backups/`, keep 30 days
- **S3**: Set `S3BackupBucket` parameter when creating stack. IAM role grants `s3:PutObject` to `s3://bucket/backups/*`
- **Cron**: Activated in CloudFormation UserData: `crontab -u ec2-user`

## Migration to Proxmox

1. `pg_dump` the database
2. Copy `docker-compose.prod.yml` or adapt `docker-compose.aws.yml` for Proxmox env
3. Same Docker images, same env vars — no code changes

## Code Fixes (Plan b0ab4d72)

- **CORS**: `src/index.ts` reads `CORS_ORIGIN` from env
- **API URLs**: Frontend uses `VITE_API_URL=/api/v1` for production
- **Dashboard/PipelineList**: Use `API_URL` from dataProvider
