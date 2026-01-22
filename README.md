# 🧬 DNA Marketing Engine

A custom CRM platform with Smart Routing & Intent Detection for the biotech industry.

## Features

- **Event Ingestion**: Receive marketing events from multiple channels (Waalaxy, Lemlist, Website, Ads, Conferences)
- **Lead Scoring**: Real-time scoring with configurable rules and decay mechanism
- **Intent Detection**: Automatic detection of product intent (Research Lab, B2B Lab, Co-Creation)
- **Smart Routing**: Intelligent routing to the correct pipeline based on score + intent
- **Automation Engine**: Automated stage movements, notifications, and task creation
- **Integrations**: Moco (German finance) and Slack (alerts & notifications)

## Tech Stack

| Component | Technology |
|-----------|------------|
| Runtime | Node.js 20+ |
| Framework | Fastify |
| Database | PostgreSQL 15+ |
| Queue | Redis + BullMQ |
| Language | TypeScript (strict) |
| Validation | Zod |
| Migrations | node-pg-migrate |

## Prerequisites

- Node.js 20+
- Docker and Docker Compose
- npm v9+

## Quick Start

### 1. Clone and Install

```bash
git clone <repository-url>
cd dna-marketing-engine
npm install
```

### 2. Environment Setup

```bash
# Copy example environment file
cp env.example .env

# Edit .env with your configuration
```

### 3. Start Infrastructure

```bash
# Start PostgreSQL and Redis
docker-compose up -d

# Wait for services to be healthy
docker-compose ps
```

### 4. Run Migrations

```bash
# Apply database migrations
npm run migrate:up

# Or manually:
docker exec -i dna_postgres psql -U dna -d dna_marketing < migrations/1737475200000_initial-schema.sql
docker exec -i dna_postgres psql -U dna -d dna_marketing < migrations/1737475200001_seed-pipelines.sql
```

### 5. Seed Data (Optional)

```bash
npm run seed
```

### 6. Start Development

```bash
# Terminal 1: Start API server with hot reload
npm run dev

# Terminal 2: Start background workers
npm run workers
```

The server will be available at `http://localhost:3000`

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           DNA Marketing Engine                           │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│   ┌─────────────┐    ┌─────────────┐    ┌─────────────┐               │
│   │   Waalaxy   │    │   Website   │    │   Lemlist   │    ...        │
│   └──────┬──────┘    └──────┬──────┘    └──────┬──────┘               │
│          │                  │                  │                       │
│          └────────────┬─────┴─────┬────────────┘                       │
│                       ▼           ▼                                    │
│              ┌────────────────────────────┐                           │
│              │   Event Ingestion API      │                           │
│              │   POST /api/v1/events      │                           │
│              └────────────┬───────────────┘                           │
│                           │                                           │
│                           ▼                                           │
│              ┌────────────────────────────┐                           │
│              │      BullMQ Queue          │◄──────┐                   │
│              │      (Redis)               │       │                   │
│              └────────────┬───────────────┘       │                   │
│                           │                       │                   │
│          ┌────────────────┼────────────────┐      │                   │
│          ▼                ▼                ▼      │                   │
│   ┌──────────────┐ ┌──────────────┐ ┌──────────────┐                 │
│   │Event Worker  │ │Routing Worker│ │ Sync Worker  │                 │
│   ├──────────────┤ ├──────────────┤ ├──────────────┤                 │
│   │• Store Event │ │• Evaluate    │ │• Moco Sync   │                 │
│   │• Scoring     │ │• Route Lead  │ │• Slack Alerts│                 │
│   │• Intent      │ │• Create Deal │ │              │                 │
│   │• Automation  │ │• Assign Owner│ │              │                 │
│   └──────┬───────┘ └──────────────┘ └──────────────┘                 │
│          │                                                           │
│          ▼                                                           │
│   ┌──────────────────────────────────────────────────────────┐       │
│   │                    PostgreSQL                             │       │
│   ├──────────────────────────────────────────────────────────┤       │
│   │ leads │ events │ deals │ pipelines │ scoring_rules │ ... │       │
│   └──────────────────────────────────────────────────────────┘       │
│                                                                      │
└──────────────────────────────────────────────────────────────────────┘
```

## Smart Routing Logic

1. All new leads start in the **Global Lead Pool** (`pipeline_id = NULL`)
2. As events accumulate, scores increase and intent signals are detected
3. When a lead reaches:
   - Score **≥ 40** AND
   - Intent confidence **≥ 60%**
4. The lead is automatically routed to the appropriate pipeline:
   - `research` → Research Lab Pipeline
   - `b2b` → B2B Lab Enablement Pipeline
   - `co_creation` → Panel Co-Creation Pipeline
5. A deal is created and an owner is assigned

## Available Scripts

| Script | Description |
|--------|-------------|
| `npm run dev` | Start development server with hot reload |
| `npm run build` | Build for production |
| `npm start` | Start production server |
| `npm run workers` | Start background workers |
| `npm run dev:workers` | Start workers with hot reload |
| `npm run migrate:up` | Run database migrations |
| `npm run migrate:down` | Rollback last migration |
| `npm run seed` | Seed database with initial data |
| `npm test` | Run tests |
| `npm run typecheck` | TypeScript type checking |

## Project Structure

```
dna-marketing-engine/
├── src/
│   ├── api/                    # API layer
│   │   ├── routes/            # Fastify route handlers
│   │   │   ├── events.ts      # Event ingestion endpoints
│   │   │   ├── leads.ts       # Lead CRUD & search
│   │   │   ├── pipelines.ts   # Pipeline management
│   │   │   ├── deals.ts       # Deal management
│   │   │   ├── scoring.ts     # Scoring rules admin
│   │   │   ├── routing.ts     # Routing config
│   │   │   ├── tasks.ts       # Task management
│   │   │   └── integrations.ts # External integrations
│   │   ├── middleware/        # Request middleware
│   │   │   ├── apiKey.ts      # API key validation
│   │   │   ├── hmac.ts        # HMAC signature validation
│   │   │   └── errorHandler.ts # Global error handling
│   │   └── schemas/           # Zod validation schemas
│   │
│   ├── services/              # Business logic
│   │   ├── leadService.ts     # Lead operations
│   │   ├── scoringEngine.ts   # Score calculation
│   │   ├── intentDetector.ts  # Intent signal detection
│   │   ├── pipelineRouter.ts  # Smart routing logic
│   │   ├── automationEngine.ts # Automation rules
│   │   ├── dealService.ts     # Deal operations
│   │   ├── pipelineService.ts # Pipeline operations
│   │   └── taskService.ts     # Task operations
│   │
│   ├── workers/               # BullMQ background workers
│   │   ├── eventWorker.ts     # Event processing
│   │   ├── routingWorker.ts   # Lead routing
│   │   ├── syncWorker.ts      # External sync (Moco/Slack)
│   │   ├── decayWorker.ts     # Daily score decay
│   │   └── index.ts           # Worker orchestration
│   │
│   ├── integrations/          # External service clients
│   │   ├── moco.ts            # Moco API client
│   │   └── slack.ts           # Slack notifications
│   │
│   ├── db/                    # Database layer
│   │   ├── index.ts           # Connection pool
│   │   └── seeds/             # Seed data scripts
│   │
│   ├── config/                # Configuration
│   │   ├── index.ts           # Zod-validated config
│   │   ├── redis.ts           # Redis connection
│   │   ├── queues.ts          # BullMQ queues
│   │   ├── scoringRules.ts    # Default scoring rules
│   │   ├── intentRules.ts     # Intent detection rules
│   │   └── routingConfig.ts   # Routing thresholds
│   │
│   ├── errors/                # Custom error classes
│   ├── types/                 # TypeScript definitions
│   └── index.ts               # Main entry point
│
├── migrations/                # Database migrations
├── scripts/                   # Utility scripts
│   ├── test-e2e.ts           # E2E test suite (TypeScript)
│   └── test-e2e.sh           # E2E test suite (Shell)
├── docker-compose.yml
├── Dockerfile
├── package.json
├── tsconfig.json
└── README.md
```

## API Endpoints

### Health & Status

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/health` | Full health check (DB + Redis) |
| GET | `/ready` | Readiness probe |

### Events

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/v1/events/ingest` | Ingest a marketing event |
| POST | `/api/v1/events/webhook` | Webhook endpoint (HMAC validated) |
| POST | `/api/v1/leads/bulk` | Bulk import leads |

### Leads

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/leads` | List/search leads with filtering |
| GET | `/api/v1/leads/unrouted` | Get unrouted leads |
| GET | `/api/v1/leads/stats` | Get lead statistics |
| GET | `/api/v1/leads/:id` | Get single lead |
| POST | `/api/v1/leads` | Create lead |
| PATCH | `/api/v1/leads/:id` | Update lead |
| DELETE | `/api/v1/leads/:id` | Delete lead |
| GET | `/api/v1/leads/:id/events` | Get lead's events |
| GET | `/api/v1/leads/:id/scores` | Get lead's score history |
| GET | `/api/v1/leads/:id/intents` | Get lead's intent signals |
| POST | `/api/v1/leads/:id/route` | Manually route lead |

### Pipelines

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/pipelines` | List all pipelines |
| GET | `/api/v1/pipelines/:id` | Get pipeline with stages |
| GET | `/api/v1/pipelines/:id/deals` | Get pipeline deals |
| GET | `/api/v1/pipelines/:id/metrics` | Get pipeline metrics |

### Deals

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/deals` | List deals |
| GET | `/api/v1/deals/:id` | Get single deal |
| POST | `/api/v1/deals` | Create deal |
| PATCH | `/api/v1/deals/:id` | Update deal |
| POST | `/api/v1/deals/:id/move` | Move deal to stage |
| POST | `/api/v1/deals/:id/close` | Close deal (won/lost) |

### Scoring & Routing

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/scoring/rules` | Get scoring rules |
| POST | `/api/v1/scoring/rules` | Create scoring rule |
| GET | `/api/v1/routing/config` | Get routing configuration |
| POST | `/api/v1/routing/evaluate/:leadId` | Force routing evaluation |

### Tasks

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/tasks` | List tasks |
| GET | `/api/v1/tasks/:id` | Get single task |
| POST | `/api/v1/tasks` | Create task |
| PATCH | `/api/v1/tasks/:id` | Update task |
| POST | `/api/v1/tasks/:id/complete` | Mark task complete |

### Integrations

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/integrations/moco/status` | Check Moco connection |
| POST | `/api/v1/integrations/moco/sync/:leadId` | Manually sync to Moco |
| POST | `/api/v1/integrations/moco/webhook` | Moco payment webhook |

## Configuration

Configuration is validated with Zod and loaded from environment variables:

| Variable | Description | Required | Default |
|----------|-------------|----------|---------|
| `DATABASE_URL` | PostgreSQL connection string | Yes | - |
| `REDIS_URL` | Redis connection string | Yes | - |
| `PORT` | Server port | No | 3000 |
| `NODE_ENV` | Environment | No | development |
| `JWT_SECRET` | JWT signing secret (min 32 chars) | Yes | - |
| `WEBHOOK_SECRET` | HMAC webhook secret (min 16 chars) | Yes | - |
| `API_KEYS` | Comma-separated source:key pairs | No | - |
| `MOCO_API_KEY` | Moco API key | No | - |
| `MOCO_SUBDOMAIN` | Moco company subdomain | No | - |
| `SLACK_WEBHOOK_URL` | Slack webhook URL | No | - |
| `SLACK_BOT_TOKEN` | Slack bot token | No | - |
| `ENABLE_MOCO_SYNC` | Enable Moco synchronization | No | false |
| `ENABLE_SLACK_ALERTS` | Enable Slack notifications | No | false |
| `ENABLE_SCORE_DECAY` | Enable daily score decay | No | true |
| `SCORE_DECAY_DAYS` | Days before scores expire | No | 90 |

## Testing

### Run E2E Tests

```bash
# Using TypeScript version
npx tsx scripts/test-e2e.ts

# Using Shell version (requires curl + jq)
chmod +x scripts/test-e2e.sh
./scripts/test-e2e.sh
```

### Manual API Testing

```bash
# Health check
curl http://localhost:3000/health

# Ingest an event
curl -X POST http://localhost:3000/api/v1/events/ingest \
  -H "Content-Type: application/json" \
  -H "X-API-Key: portal:key2" \
  -d '{
    "event_type": "page_visited",
    "source": "portal",
    "occurred_at": "2026-01-21T12:00:00Z",
    "lead_identifier": {"email": "test@example.com"},
    "metadata": {"page_path": "/pricing"}
  }'

# List leads
curl http://localhost:3000/api/v1/leads \
  -H "X-API-Key: portal:key2"

# Get lead details
curl http://localhost:3000/api/v1/leads/<lead-id> \
  -H "X-API-Key: portal:key2"
```

## Database Schema

The CRM uses the following main tables:

| Table | Description |
|-------|-------------|
| `leads` | Contact information, scores, and routing status |
| `organizations` | Company data linked to leads |
| `pipelines` | Sales pipelines (Research, B2B, Co-Creation, Discovery) |
| `pipeline_stages` | Stages within each pipeline |
| `deals` | Opportunities linked to leads and pipelines |
| `events` | Marketing events (partitioned by month) |
| `intent_signals` | Detected intent signals for leads |
| `scoring_rules` | Configurable score calculation rules |
| `score_history` | Historical score changes with decay |
| `automation_rules` | Automation triggers and actions |
| `tasks` | Follow-up tasks for team members |
| `team_members` | Sales team members with capacity |
| `campaigns` | Marketing campaign tracking |
| `api_keys` | Webhook authentication keys |

## Docker Deployment

### Development

```bash
docker-compose up -d
```

### Production

```bash
docker-compose -f docker-compose.yml up -d api workers
```

## Integrations

### Moco (German Finance)

The Moco integration enables:
- Customer creation when deals are won
- Offer/quote generation
- Invoice creation from offers

Configure by setting `MOCO_API_KEY` and `MOCO_SUBDOMAIN` in your `.env` file.

### Slack

The Slack integration provides:
- Hot lead alerts (#hot-leads)
- Routing conflict notifications (#lead-routing)
- Deal won celebrations (#sales-wins)
- Daily digest summaries (#marketing-daily)
- Error alerts (#crm-alerts)

Configure by setting `SLACK_WEBHOOK_URL` in your `.env` file.

## Troubleshooting

### Common Issues

**Workers not processing jobs:**
- Check Redis connection: `redis-cli ping`
- Verify workers are running: `npm run workers`
- Check BullMQ dashboard (if configured)

**Events not creating leads:**
- Verify API key is correct
- Check worker logs for errors
- Ensure database is accessible

**Routing not triggering:**
- Check lead score (needs ≥ 40)
- Check intent confidence (needs ≥ 60%)
- Verify team members are seeded

### Logs

```bash
# API server logs
npm run dev

# Worker logs
npm run workers

# Check PostgreSQL
docker-compose logs postgres

# Check Redis
docker-compose logs redis
```

## License

Private - All rights reserved

## Support

For questions or issues, contact the development team.

---

**Built with ❤️ for DNA ME**
