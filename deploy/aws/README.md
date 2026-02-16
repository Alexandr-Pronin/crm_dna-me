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

**PowerShell (empfohlen unter Windows):**
```powershell
.\deploy\aws\Deploy-Stack.ps1 -KeyPairName YOUR_KEY_NAME -AllowedCidr "YOUR_IP/32"
```

**Bash:**
```bash
aws cloudformation create-stack \
  --stack-name dna-crm-stack \
  --template-body file://deploy/aws/cloudformation.yaml \
  --parameters \
    ParameterKey=KeyPairName,ParameterValue=YOUR_KEY_NAME \
    ParameterKey=AllowedCidr,ParameterValue=YOUR_IP/32 \
  --capabilities CAPABILITY_IAM
```

Optional: Add `-S3BackupBucket your-backup-bucket` (PowerShell) bzw. `ParameterKey=S3BackupBucket,ParameterValue=your-backup-bucket` (Bash) für Off-Site Backups. Bucket vorher anlegen.

**Note**: DB SSH (port 22) is directly accessible via AllowedCidr, so you can deploy to the DB instance without ProxyJump when your IP is in AllowedCidr.

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

**Mit SSH (cloudformation.yaml):**
```bash
export SSH_KEY=~/.ssh/your-key.pem
bash deploy/aws/deploy-aws.sh
```

**Mit SSM, ohne SSH (cloudformation-ssm.yaml):**
```bash
bash deploy/aws/deploy-aws-ssm.sh
```
Siehe Abschnitt "Deployment ohne SSH (SSM)" unten.

The script fetches AppPublicIP and DbPrivateIP from CloudFormation, deploys to DB first (via SSH or SSM), waits 45s for Postgres, then deploys to App.

### 5. Verify

- https://crm.dna-me.com (or https://\<Elastic IP\>)
- https://crm.dna-me.com/health

### 6. Monitoring (MVP)

We recommend a free external uptime monitor for the MVP:
- **UptimeRobot** (https://uptimerobot.com) — 50 monitors free, 5-min interval
- **Healthchecks.io** (https://healthchecks.io) — cron job monitoring, free tier

Configure a monitor for `https://your-domain/health` to receive alerts when the app is down.

## Deployment ohne SSH (SSM)

Kein Key Pair, kein Port 22. Deployment via AWS Systems Manager + S3.

1. **S3 Bucket anlegen** (einmalig):
```bash
aws s3 mb s3://dna-crm-deploy-YOUR_ACCOUNT_ID --region eu-central-1
```

2. **Stack mit cloudformation-ssm.yaml erstellen**:

**PowerShell:**
```powershell
.\deploy\aws\Deploy-Stack-SSM.ps1 -DeployBucket dna-crm-deploy-YOUR_ACCOUNT_ID
```

**Bash:**
```bash
aws cloudformation create-stack \
  --stack-name dna-crm-stack \
  --template-body file://deploy/aws/cloudformation-ssm.yaml \
  --parameters ParameterKey=DeployBucket,ParameterValue=dna-crm-deploy-YOUR_ACCOUNT_ID \
  --capabilities CAPABILITY_IAM \
  --region eu-central-1
```

3. **Deploy ausführen**:

**Vollautomatisch (empfohlen):**
```bash
bash deploy/aws/deploy-full.sh
```
Erledigt: .env.aws Validierung, S3-Bucket, Stack, SSM-Wartezeit, App-Deploy.

**Nur App-Deploy (Stack muss existieren):**
```bash
bash deploy/aws/deploy-aws-ssm.sh
```

Interaktiver Zugriff: `aws ssm start-session --target <InstanceId>`

### DNS einrichten

**PowerShell (Route53 oder Anleitung):**
```powershell
.\deploy\aws\setup-dns.ps1
```

**Manuell:** Siehe `deploy/aws/DNS-SETUP.md`

## Files

| File | Purpose |
|------|---------|
| `cloudformation.yaml` | VPC, 2 EC2 (App + DB), SG, EIP — mit SSH |
| `cloudformation-ssm.yaml` | Wie oben, aber ohne SSH, mit SSM + S3 Deploy |
| `Deploy-Stack.ps1` | PowerShell: CloudFormation Stack automatisiert deployen |
| `deploy-aws-ssm.sh` | Deploy via SSM (kein SSH) |
| `deploy-full.sh` | Vollautomatisch: Stack + SSM-Warte + Deploy |
| `Deploy-Stack-SSM.ps1` | PowerShell: SSM-Stack erstellen |
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
