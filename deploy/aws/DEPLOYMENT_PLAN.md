# DNA ME CRM — Final AWS Deployment Plan

Merged from Plans b0ab4d72 and b742a208 with expert review upgrades.

## Summary

| Aspect | Implementation |
|--------|----------------|
| **EC2** | 2× t3.medium (App + DB) |
| **Region** | eu-central-1 |
| **VPC** | 10.0.0.0/16, public subnet only (no NAT) |
| **DB** | Public subnet, no public IP, SG restricts to App |
| **EBS** | DB volume DeleteOnTermination: false |
| **Backup** | Cron 3 AM, local + S3 (IAM role) |
| **AllowedCidr** | Default 1.1.1.1/32 (change to your IP) |
| **Docker Compose** | Pinned v2.29.1 |

## Architecture

```
Internet → Elastic IP → App EC2 (t3.medium)
                         ├── Nginx (80/443) + Certbot
                         ├── API (:3000)
                         ├── Workers
                         ├── Frontend (Nginx SPA)
                         └── Redis (:6379)
                              │ DATABASE_URL=postgres://...@<DB_IP>:5432/...
                              ▼
                         DB EC2 (t3.medium, private subnet)
                         └── Postgres (:5432) in Docker
```

## Deploy Sequence (deploy-aws.sh)

1. Fetch AppPublicIP and DbPrivateIP from CloudFormation
2. Deploy to DB instance first (via ProxyJump through App)
3. Wait 45s for Postgres to become healthy
4. Deploy to App instance (migrate, then docker compose)
5. Health check

## Files Created

| File | Purpose |
|------|---------|
| `cloudformation.yaml` | VPC, Subnet, IGW, SG, EC2, EIP, User Data |
| `docker-compose.aws.yml` | All services, Certbot SSL |
| `nginx-aws.conf` | Reverse proxy (HTTP→HTTPS, Frontend, API) |
| `nginx-aws.conf.template` | Domain placeholder for custom domains |
| `Dockerfile.nginx-certbot` | Nginx + Certbot image |
| `entrypoint-nginx-certbot.sh` | SSL init + renewal loop |
| `init-letsencrypt.sh` | Dummy certs helper |
| `backup.sh` | pg_dump cron script |
| `user-data.sh` | EC2 bootstrap (standalone reference) |
| `deploy-aws.sh` | Build, upload, deploy |
| `.env.aws.example` | Environment template |
| `README.md` | Deployment instructions |

## Code Changes (Plan b0ab4d72)

- **src/config/index.ts**: Added `corsOrigin` (optional)
- **src/index.ts**: CORS origin from `CORS_ORIGIN` env
- **frontend/src/components/Dashboard/index.jsx**: Use `API_URL` from dataProvider
- **frontend/src/resources/pipelines/PipelineList.jsx**: Use `API_URL`
- **frontend/src/resources/pipelines/PipelineShow.jsx**: Use `API_URL`

## Deploy Flow

1. `aws cloudformation create-stack` (or update-stack)
2. Point DNS A record to Elastic IP
3. `cp deploy/aws/.env.aws.example deploy/aws/.env.aws` and fill
4. `VITE_API_URL=/api/v1 bash deploy/aws/deploy-aws.sh`

## Migration to Proxmox

1. `pg_dump` from Postgres container
2. Use same `docker-compose.aws.yml` or `docker-compose.prod.yml`
3. Swap `.env.aws` for `.env.production`
4. No application code changes
