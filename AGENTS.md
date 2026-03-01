# AGENTS.md

## Cursor Cloud specific instructions

### Project Overview

DNA Marketing Engine (DNA ME) — a CRM platform for biotech with smart lead routing, scoring, and intent detection. See `README.md` for full docs.

### Architecture

| Service | Port | Run Command |
|---------|------|-------------|
| PostgreSQL 15 | 5432 | `sudo docker compose up -d postgres` |
| Redis 7 | 6379 | `sudo docker compose up -d redis` |
| Backend API (Fastify) | 3000 | `npm run dev` |
| Background Workers (BullMQ) | — | `npm run workers` |
| Frontend (React/Vite) | 5173 | `cd frontend && npm run dev` |

### Starting the dev environment

1. Start infrastructure: `sudo docker compose up -d` (PostgreSQL + Redis)
2. Wait for healthy: `sudo docker compose ps` (both should show "healthy")
3. Run migrations (only needed on first setup or schema changes): `npm run migrate:up`
4. Seed data (optional): `npm run seed`
5. Start backend API: `npm run dev` (runs on port 3000 with hot reload)
6. Start workers: `npm run workers` (processes BullMQ jobs)
7. Start frontend: `cd frontend && npm run dev` (runs on port 5173)

### Non-obvious caveats

- **Docker requires sudo** in the Cloud Agent VM (runs inside a Firecracker VM). Always use `sudo docker compose ...`.
- **ESLint is not installed** as a backend devDependency. The `npm run lint` script will fail with "eslint not found". Frontend lint works via `cd frontend && npx eslint .`.
- **TypeScript typecheck** (`npm run typecheck`) has pre-existing errors across many files (unused variables, schema mismatches). These are not regressions.
- **No vitest test files** exist in the repo. `npm test` exits with code 1 ("no test files found").
- **API key format**: The `X-API-Key` header value is just the key portion (e.g., `dev_key_portal`), not `key:source`. Keys are configured via `API_KEYS` env var in `.env`.
- **Automation logs schema mismatch**: The `automation_logs` table is missing an `event_id` column that the code expects. This is a pre-existing issue that causes a non-fatal error during event processing.
- The `.env` file is created from `env.example`: `cp env.example .env`. It includes working dev defaults for PostgreSQL, Redis, JWT, and webhook secrets.
- **Workers must run separately** from the API server for event processing to work. Without workers, ingested events stay in the Redis queue unprocessed.
