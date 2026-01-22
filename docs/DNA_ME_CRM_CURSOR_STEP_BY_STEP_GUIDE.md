# 🚀 DNA ME CRM - Полный Пошаговый Гайд для Cursor

**Цель:** Создать полноценную CRM платформу с нуля за 2-3 дня интенсивной работы  
**Уровень:** Средний (нужно понимание Node.js, SQL, API)  
**Результат:** Работающая система с Event Ingestion, Scoring, Intent Detection, Smart Routing

---

# 📋 СОДЕРЖАНИЕ

- [Этап 0: Подготовка окружения](#этап-0-подготовка-окружения-30-минут)
- [Этап 1: Инициализация проекта](#этап-1-инициализация-проекта-1-час)
- [Этап 2: База данных](#этап-2-база-данных-1-час)
- [Этап 3: Базовый API сервер](#этап-3-базовый-api-сервер-1-час)
- [Этап 4: Event Ingestion](#этап-4-event-ingestion-2-часа)
- [Этап 5: Lead Management](#этап-5-lead-management-1-час)
- [Этап 6: Scoring Engine](#этап-6-scoring-engine-2-часа)
- [Этап 7: Intent Detection](#этап-7-intent-detection-2-часа)
- [Этап 8: Smart Routing](#этап-8-smart-routing-2-часа)
- [Этап 9: Pipeline & Deals](#этап-9-pipeline--deals-1-час)
- [Этап 10: Automation Engine](#этап-10-automation-engine-2-часа)
- [Этап 11: Integrations](#этап-11-integrations-slack-moco-1-час)
- [Этап 12: Тестирование](#этап-12-тестирование-1-час)
- [Чеклист готовности](#чеклист-готовности)

---

# Этап 0: Подготовка окружения (30 минут)

## 0.1 Установи необходимое ПО

```bash
# Проверь что установлено
node --version    # Нужен v18+ (лучше v20)
npm --version     # Нужен v9+
docker --version  # Нужен Docker Desktop
git --version     # Нужен Git

# Установи Cursor если ещё нет
# https://cursor.sh/ - скачай и установи
```

## 0.2 Создай рабочую директорию

```bash
# Создай папку для проекта
mkdir dna-marketing-engine
cd dna-marketing-engine

# Инициализируй Git
git init
```

## 0.3 Скачай документацию

Создай папку `docs/` и положи туда оба файла Master Prompt:
- `docs/MASTER_PROMPT_PART1.md`
- `docs/MASTER_PROMPT_PART2.md`

```bash
mkdir docs
# Скопируй файлы Master Prompt в эту папку
```

## 0.4 Открой проект в Cursor

```bash
cursor .
```

## 0.5 Настрой Cursor Rules

1. Открой Settings: `Cmd+,` (Mac) / `Ctrl+,` (Windows)
2. Найди "Rules for AI"
3. Вставь эти правила:

```
# DNA Marketing Engine - Project Rules

## Project Context
Building a custom Marketing CRM with:
- Event-driven architecture (webhooks → queue → workers)
- Lead scoring with decay
- Intent detection (research/b2b/co_creation)
- Smart routing to pipelines
- No HubSpot - fully custom

## Tech Stack (ALWAYS USE)
- Runtime: Node.js 20 LTS
- Language: TypeScript (strict mode)
- Framework: Fastify (NOT Express)
- Database: PostgreSQL 15
- Queue: BullMQ with Redis
- Validation: Zod

## Code Style
- ES Modules (import/export, NOT require)
- Async/await (NOT callbacks)
- Proper error handling with try/catch
- Use 'pg' package for PostgreSQL (NOT Prisma, NOT Drizzle for now)
- File naming: camelCase.ts for files, PascalCase for classes

## Architecture Patterns
- Services: Business logic (scoringEngine.ts, leadService.ts)
- Workers: Background jobs (eventWorker.ts, routingWorker.ts)
- Routes: API endpoints (events.ts, leads.ts)
- Types: TypeScript interfaces (types/index.ts)

## Key Domain Concepts
- Lead starts in "Global Pool" (pipeline_id = NULL)
- Score = demographic + engagement + behavior
- Intent = research | b2b | co_creation (detected from events)
- Route when: score >= 40 AND intent_confidence >= 60%
```

✅ **Checkpoint:** Cursor открыт, Rules настроены, docs/ папка создана

---

# Этап 1: Инициализация проекта (1 час)

## 1.1 Создай структуру проекта

**В Cursor Chat (Cmd+L), напиши:**

```
Create the initial project structure for a Node.js TypeScript project.

Create these files:

1. package.json with:
   - name: "dna-marketing-engine"
   - type: "module"
   - scripts: dev, build, start, workers
   - dependencies: fastify, @fastify/cors, bullmq, ioredis, pg, zod, uuid, dayjs, pino, axios
   - devDependencies: typescript, @types/node, @types/pg, tsx, vitest

2. tsconfig.json with strict TypeScript, ES2022 target, NodeNext modules

3. .env.example with:
   - DATABASE_URL
   - REDIS_URL
   - PORT
   - WEBHOOK_SECRET
   - JWT_SECRET
   - SLACK_WEBHOOK_URL
   - MOCO_API_KEY
   - MOCO_SUBDOMAIN

4. .gitignore for Node.js project (node_modules, dist, .env, etc.)

5. Create empty folder structure:
   - src/api/routes/
   - src/api/middleware/
   - src/services/
   - src/workers/
   - src/integrations/
   - src/db/migrations/
   - src/config/
   - src/types/
```

## 1.2 Установи зависимости

После того как Cursor создаст файлы, выполни в терминале:

```bash
npm install
```

## 1.3 Создай .env файл

```bash
cp .env.example .env
```

Отредактируй `.env`:

```bash
DATABASE_URL=postgres://dna:devpassword@localhost:5432/dna_marketing
REDIS_URL=redis://localhost:6379
PORT=3000
WEBHOOK_SECRET=dev_webhook_secret_32chars_min
JWT_SECRET=dev_jwt_secret_32characters_min
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/xxx/yyy/zzz
MOCO_API_KEY=your_moco_key
MOCO_SUBDOMAIN=your_company
```

## 1.4 Создай docker-compose.yml

**В Cursor Chat:**

```
Create docker-compose.yml with:
1. PostgreSQL 15 (postgres:15-alpine)
   - Database: dna_marketing
   - User: dna
   - Password: devpassword
   - Port: 5432
   - Volume for data persistence

2. Redis 7 (redis:7-alpine)
   - Port: 6379

Include healthchecks for both services.
```

## 1.5 Запусти Docker

```bash
docker-compose up -d

# Проверь что работает
docker-compose ps
# Должны быть оба сервиса "Up"
```

✅ **Checkpoint:** `npm install` прошёл, Docker запущен, `.env` создан

---

# Этап 2: База данных (1 час)

## 2.1 Создай конфиг подключения к БД

**В Cursor Chat:**

```
Create src/config/index.ts that exports configuration object:
- Read all values from process.env
- Include: databaseUrl, redisUrl, port, webhookSecret, jwtSecret, slackWebhookUrl, mocoApiKey, mocoSubdomain
- Validate required vars, throw error if missing
```

## 2.2 Создай подключение к PostgreSQL

**В Cursor Chat:**

```
Create src/db/index.ts with PostgreSQL connection using 'pg' package:

1. Create Pool with connection string from config
2. Export helper functions:
   - query(sql, params) - execute query, return rows
   - queryOne(sql, params) - return first row or null
   - getClient() - get client for transactions

3. Add connection test on startup
4. Handle connection errors gracefully
```

## 2.3 Создай полную схему базы данных

**В Cursor Chat (это большой промпт):**

```
@docs/MASTER_PROMPT_PART1.md

Create src/db/migrations/001_initial_schema.sql with the complete database schema from Section 4.

Include ALL tables:
1. organizations
2. leads (with intent fields: primary_intent, intent_confidence, intent_summary, routing_status)
3. intent_signals
4. pipelines
5. pipeline_stages
6. deals
7. events (PARTITIONED BY RANGE on occurred_at)
8. scoring_rules
9. score_history
10. automation_rules
11. tasks
12. team_members

Include:
- All indexes from the document
- recalculate_lead_scores(lead_id) function
- expire_old_scores() function
- Event partitions for 2026 (Jan-Dec)

Also include SEED DATA:
- 4 pipelines: Discovery, Research Lab, B2B Lab Enablement, Panel Co-Creation
- All stages for each pipeline (from Section 3.2 of document)
```

## 2.4 Примени миграцию

```bash
# Подключись к PostgreSQL и выполни миграцию
docker exec -i dna-marketing-engine-postgres-1 psql -U dna -d dna_marketing < src/db/migrations/001_initial_schema.sql

# Или если используешь локальный psql:
psql $DATABASE_URL < src/db/migrations/001_initial_schema.sql
```

## 2.5 Проверь что таблицы созданы

```bash
# Подключись к БД
docker exec -it dna-marketing-engine-postgres-1 psql -U dna -d dna_marketing

# В psql выполни:
\dt
# Должен показать все таблицы

SELECT * FROM pipelines;
# Должен показать 4 pipeline

SELECT * FROM pipeline_stages;
# Должен показать stages для каждого pipeline

\q
# Выход
```

✅ **Checkpoint:** Все таблицы созданы, seed data на месте, pipelines видны

---

# Этап 3: Базовый API сервер (1 час)

## 3.1 Создай TypeScript типы

**В Cursor Chat:**

```
@docs/MASTER_PROMPT_PART1.md

Create src/types/index.ts with all TypeScript types from Section 5:

Include:
1. Enums: EventSource, EventType, LeadStatus, LifecycleStage, RoutingStatus, IntentType, DealStatus, ScoreCategory

2. Core entities: Lead, Organization, Pipeline, PipelineStage, Deal, MarketingEvent

3. Intent types: IntentSignal, IntentSummary, IntentRule

4. Scoring types: ScoringRule, ScoreHistoryEntry

5. API types: IngestEventRequest, IngestEventResponse, LeadFilters, PaginatedResult

6. Job types: EventProcessingJob, ScoringJob, RoutingJob

Export all types.
```

## 3.2 Создай Redis подключение

**В Cursor Chat:**

```
Create src/config/redis.ts:
1. Import IORedis
2. Create and export Redis connection using REDIS_URL from config
3. Add connection event handlers (connect, error, close)
4. Export connection for BullMQ
```

## 3.3 Создай Fastify сервер

**В Cursor Chat:**

```
Create src/index.ts - main entry point:

1. Import Fastify and plugins (@fastify/cors)
2. Import config and db
3. Create Fastify instance with logger (pino)
4. Register CORS
5. Add health check: GET /health
6. Add ready check: GET /ready (checks DB and Redis)
7. Import and register route modules (we'll create them next)
8. Start server on PORT from config
9. Handle graceful shutdown (SIGTERM, SIGINT)

Make sure to test database connection on startup.
```

## 3.4 Запусти сервер и проверь

```bash
npm run dev
```

В другом терминале:
```bash
curl http://localhost:3000/health
# Ожидаем: {"status":"ok"}

curl http://localhost:3000/ready
# Ожидаем: {"status":"ready","database":"connected","redis":"connected"}
```

✅ **Checkpoint:** Сервер запускается, health/ready endpoints работают

---

# Этап 4: Event Ingestion (2 часа)

## 4.1 Создай HMAC middleware

**В Cursor Chat:**

```
Create src/api/middleware/hmac.ts:

1. Export verifyHmacSignature middleware for Fastify
2. Read X-Webhook-Signature header
3. Calculate HMAC-SHA256 of raw request body using WEBHOOK_SECRET
4. Compare signatures (timing-safe comparison)
5. If invalid: return 401 Unauthorized
6. If valid: continue to handler

Also export helper function to generate signature (for testing).
```

## 4.2 Создай BullMQ очереди

**В Cursor Chat:**

```
Create src/config/queues.ts:

1. Import Queue from bullmq
2. Import redis connection
3. Create and export queues:
   - eventsQueue ('events')
   - scoringQueue ('scoring')
   - routingQueue ('routing')
   - syncQueue ('sync')
   - scheduledQueue ('scheduled')

4. Export queue names as constants
```

## 4.3 Создай Event Ingestion endpoint

**В Cursor Chat:**

```
Create src/api/routes/events.ts:

1. Create Fastify plugin that registers routes

2. POST /api/v1/events/ingest
   - Apply HMAC verification middleware
   - Validate body with Zod schema (IngestEventRequest):
     * event_type: enum of valid event types
     * source: enum of valid sources
     * occurred_at: ISO date string
     * lead_identifier: object with email?, linkedin_url?, portal_id?, waalaxy_id?
     * metadata?: object
     * correlation_id?: uuid string
     * campaign_id?: string
   - Generate event_id (uuid)
   - Add job to eventsQueue with event data
   - Return 202 Accepted with { event_id, status: 'queued', queued_at }

3. POST /api/v1/leads/bulk
   - For CSV/JSON batch import
   - Validate array of leads
   - Add batch job to eventsQueue
   - Return { job_id, leads_queued: count }

Include proper error handling and logging.
```

## 4.4 Зарегистрируй routes в сервере

**В Cursor Chat:**

```
Update src/index.ts to:
1. Import eventsRoutes from './api/routes/events'
2. Register eventsRoutes with prefix '/api/v1'
```

## 4.5 Создай Event Worker

**В Cursor Chat:**

```
Create src/workers/eventWorker.ts:

1. Import Worker from bullmq
2. Import db, redis connection
3. Import types

4. Create worker for 'events' queue that processes jobs:

   async function processEvent(job):
     a. Extract: event_id, event_type, source, lead_identifier, metadata, occurred_at
     
     b. Find or create lead:
        - Try find by email first
        - Then by waalaxy_id, portal_id, linkedin_url
        - If not found, create new lead with routing_status='unrouted'
     
     c. Store event in events table
     
     d. Update lead's last_activity timestamp
     
     e. Update attribution:
        - If first event: set first_touch_source, first_touch_date
        - Always update last_touch_source, last_touch_date
     
     f. Add job to scoringQueue: { lead_id, event_id }
     
     g. Return processing result

5. Configure worker:
   - concurrency: 10
   - limiter: { max: 100, duration: 1000 }

6. Add event handlers: completed, failed, error

7. Export function to create and start worker
```

## 4.6 Создай workers entry point

**В Cursor Chat:**

```
Create src/workers/index.ts:

1. Import all worker creators
2. Import queue setup
3. Create main function that:
   - Initializes all workers
   - Sets up graceful shutdown
   - Logs startup
4. Call main() at the end
```

## 4.7 Добавь npm script для workers

Убедись что в `package.json` есть:
```json
"scripts": {
  "dev:workers": "tsx watch src/workers/index.ts"
}
```

## 4.8 Тестируй Event Ingestion

Терминал 1:
```bash
npm run dev
```

Терминал 2:
```bash
npm run dev:workers
```

Терминал 3 - отправь тестовый event:
```bash
# Сначала сгенерируй подпись
BODY='{"event_type":"page_visited","source":"portal","occurred_at":"2026-01-21T12:00:00Z","lead_identifier":{"email":"test@example.com"},"metadata":{"page_path":"/pricing"}}'

SIGNATURE=$(echo -n "$BODY" | openssl dgst -sha256 -hmac "dev_webhook_secret_32chars_min" | cut -d' ' -f2)

curl -X POST http://localhost:3000/api/v1/events/ingest \
  -H "Content-Type: application/json" \
  -H "X-Webhook-Signature: $SIGNATURE" \
  -d "$BODY"
```

Ожидаемый ответ:
```json
{"event_id":"...","status":"queued","queued_at":"..."}
```

Проверь в БД:
```bash
docker exec -it dna-marketing-engine-postgres-1 psql -U dna -d dna_marketing -c "SELECT id, email, status FROM leads;"
docker exec -it dna-marketing-engine-postgres-1 psql -U dna -d dna_marketing -c "SELECT id, event_type, source FROM events;"
```

✅ **Checkpoint:** Events принимаются, leads создаются, events записываются

---

# Этап 5: Lead Management (1 час)

## 5.1 Создай Lead Service

**В Cursor Chat:**

```
Create src/services/leadService.ts:

Export class LeadService with methods:

1. findOrCreateLead(identifier: LeadIdentifier): Promise<Lead>
   - Try find by email, then waalaxy_id, portal_id, linkedin_url
   - If found, update any missing identifiers
   - If not found, create new lead
   - Return lead

2. getLeadById(id: string): Promise<Lead | null>

3. getLeadByEmail(email: string): Promise<Lead | null>

4. updateLead(id: string, data: Partial<Lead>): Promise<Lead>

5. searchLeads(filters: LeadFilters): Promise<PaginatedResult<Lead>>
   - Support filters: status, lifecycle_stage, routing_status, pipeline_id, primary_intent, min_score, max_score, search (full-text)
   - Support pagination: limit, offset
   - Return with total count

6. getLeadEvents(leadId: string, limit?: number): Promise<MarketingEvent[]>

7. getLeadScoreHistory(leadId: string): Promise<ScoreHistoryEntry[]>

8. deleteLead(id: string): Promise<void> (for GDPR)

Use db helper functions. Include proper error handling.
```

## 5.2 Создай Leads API routes

**В Cursor Chat:**

```
Create src/api/routes/leads.ts:

Fastify plugin with routes:

1. GET /api/v1/leads
   - Query params for filters (status, min_score, etc.)
   - Use leadService.searchLeads
   - Return paginated results

2. GET /api/v1/leads/unrouted
   - Get leads where routing_status = 'unrouted'
   - For marketing team to review

3. GET /api/v1/leads/:id
   - Get single lead with full details
   - Include organization if exists

4. POST /api/v1/leads
   - Manual lead creation
   - Validate with Zod
   - Use leadService

5. PATCH /api/v1/leads/:id
   - Update lead fields
   - Validate allowed fields

6. DELETE /api/v1/leads/:id
   - Soft delete or hard delete (GDPR)

7. GET /api/v1/leads/:id/events
   - Get lead's event timeline

8. GET /api/v1/leads/:id/scores
   - Get lead's score history

9. POST /api/v1/leads/:id/route
   - Manually route lead to pipeline
   - Body: { pipeline_slug, reason? }
```

## 5.3 Зарегистрируй routes

**В Cursor Chat:**

```
Update src/index.ts to register leadsRoutes
```

## 5.4 Тестируй Lead API

```bash
# Get all leads
curl http://localhost:3000/api/v1/leads

# Get unrouted leads
curl http://localhost:3000/api/v1/leads/unrouted

# Get lead by ID (use ID from previous response)
curl http://localhost:3000/api/v1/leads/{lead_id}

# Search leads with score filter
curl "http://localhost:3000/api/v1/leads?min_score=10"
```

✅ **Checkpoint:** Lead CRUD работает, поиск работает

---

# Этап 6: Scoring Engine (2 часа)

## 6.1 Создай конфиг scoring rules

**В Cursor Chat:**

```
@docs/MASTER_PROMPT_PART1.md

Create src/config/scoringRules.ts with default scoring rules from Section 7:

Export array of ScoringRule objects:

ENGAGEMENT rules:
- page_visited: +2 pts, max 10/day, decay 30d
- page_visited (pricing): +5 pts, max 3/day, decay 30d
- roi_calculator_submitted: +15 pts, max 1/day, decay 60d
- demo_requested: +20 pts, max 1/day, decay 90d
- whitepaper_downloaded: +10 pts, max 3/day, decay 45d
- linkedin_profile_viewed: +3 pts, max 5/day, decay 14d
- linkedin_post_liked: +2 pts, max 5/day, decay 14d
- linkedin_post_commented: +5 pts, max 3/day, decay 21d
- email_opened: +1 pt, max 5/day, decay 14d
- email_link_clicked: +3 pts, max 3/day, decay 21d
- email_replied: +10 pts, max 1/day, decay 60d

BEHAVIOR rules:
- order_placed: +100 pts, no decay (converts to customer)
- user_registered: +25 pts, no decay

DEMOGRAPHIC rules (applied once based on lead/org fields):
- industry = Biotech/Pharma/Research: +20 pts
- company_size = 51-500: +10 pts
- job_title contains Lab Manager/Director/Head: +10 pts

Include function to seed rules to database if not exists.
```

## 6.2 Создай Scoring Engine

**В Cursor Chat:**

```
@docs/MASTER_PROMPT_PART1.md

Create src/services/scoringEngine.ts with ScoringEngine class:

Properties:
- rules: ScoringRule[] (loaded from DB)
- routingQueue: Queue (to trigger routing after score change)

Methods:

1. async loadRules(): Promise<void>
   - Load active rules from scoring_rules table
   - Sort by priority

2. async processEvent(event: MarketingEvent, lead: Lead): Promise<ScoringResult>
   - Find matching rules for this event
   - For each matching rule:
     * Check canApplyRule (rate limits)
     * If can apply: call applyScore
   - Recalculate lead scores (call DB function)
   - Check triggers (hot lead alerts)
   - Queue routing evaluation
   - Return result with rules_matched, points_added, new_scores

3. private matchesConditions(rule: ScoringRule, event: MarketingEvent, lead: Lead): boolean
   - For event_based rules: match event_type and metadata
   - For demographic rules: match lead/org fields
   - For behavior rules: execute complex queries

4. private async canApplyRule(rule: ScoringRule, leadId: string): Promise<boolean>
   - Check max_per_day: count today's applications
   - Check max_per_lead: count total applications
   - Return true if within limits

5. private async applyScore(rule: ScoringRule, leadId: string, eventId: string): Promise<void>
   - Calculate expires_at from decay_days
   - Insert into score_history
   - Update lead's denormalized scores

6. private async checkTriggers(leadId: string, oldScore: number, newScore: number): Promise<string[]>
   - If crossed 40: update lifecycle_stage to 'mql'
   - If crossed 80: update to 'sql', trigger hot_lead_alert
   - If crossed 120: trigger very_hot_lead_alert
   - Return list of triggered actions

Include proper logging.
```

## 6.3 Интегрируй Scoring в Event Worker

**В Cursor Chat:**

```
Update src/workers/eventWorker.ts:

1. Import ScoringEngine
2. Create scoringEngine instance in worker
3. After storing event and before finishing:
   - Call scoringEngine.processEvent(event, lead)
   - Log scoring result

The flow should be:
Event received → Store event → Update attribution → Process scoring → Queue routing
```

## 6.4 Создай Scoring API routes

**В Cursor Chat:**

```
Create src/api/routes/scoring.ts:

1. GET /api/v1/scoring/rules
   - List all scoring rules
   - Include is_active filter

2. POST /api/v1/scoring/rules
   - Create new scoring rule
   - Validate with Zod

3. PATCH /api/v1/scoring/rules/:id
   - Update rule (points, decay_days, is_active, etc.)

4. DELETE /api/v1/scoring/rules/:id
   - Soft delete (set is_active = false)

5. POST /api/v1/scoring/recalculate/:leadId
   - Manually recalculate lead's score
   - Useful after rule changes
```

## 6.5 Seed scoring rules

**В Cursor Chat:**

```
Create src/db/seeds/scoring_rules.ts:

Script that inserts default scoring rules into database.
Check if rules exist before inserting (upsert by slug).
```

Выполни:
```bash
npx tsx src/db/seeds/scoring_rules.ts
```

## 6.6 Тестируй Scoring

```bash
# Отправь несколько events для одного lead
BODY='{"event_type":"page_visited","source":"portal","occurred_at":"2026-01-21T12:00:00Z","lead_identifier":{"email":"scoring-test@example.com"},"metadata":{"page_path":"/pricing"}}'
SIGNATURE=$(echo -n "$BODY" | openssl dgst -sha256 -hmac "dev_webhook_secret_32chars_min" | cut -d' ' -f2)
curl -X POST http://localhost:3000/api/v1/events/ingest -H "Content-Type: application/json" -H "X-Webhook-Signature: $SIGNATURE" -d "$BODY"

# Отправь ещё один event
BODY='{"event_type":"roi_calculator_submitted","source":"portal","occurred_at":"2026-01-21T12:01:00Z","lead_identifier":{"email":"scoring-test@example.com"},"metadata":{}}'
SIGNATURE=$(echo -n "$BODY" | openssl dgst -sha256 -hmac "dev_webhook_secret_32chars_min" | cut -d' ' -f2)
curl -X POST http://localhost:3000/api/v1/events/ingest -H "Content-Type: application/json" -H "X-Webhook-Signature: $SIGNATURE" -d "$BODY"

# Проверь score в БД
docker exec -it dna-marketing-engine-postgres-1 psql -U dna -d dna_marketing -c "SELECT email, engagement_score, total_score FROM leads WHERE email='scoring-test@example.com';"
```

✅ **Checkpoint:** Scoring работает, очки начисляются, score_history записывается

---

# Этап 7: Intent Detection (2 часа)

## 7.1 Создай конфиг Intent Rules

**В Cursor Chat:**

```
@docs/MASTER_PROMPT_PART1.md

Create src/config/intentRules.ts with intent detection rules from Section 3.3:

Export array of IntentRule objects:

RESEARCH intent signals:
- page_visited /pricing/16s → +25 pts
- email matches .edu, .ac., uni- → +30 pts
- job_title contains PhD, PostDoc, Researcher, Professor → +20 pts
- roi_calculator with samples < 100 → +25 pts
- whitepaper download (protocol) → +15 pts

B2B intent signals:
- page_visited /enterprise → +30 pts
- roi_calculator submitted → +20 pts
- roi_calculator with samples >= 100 → +35 pts
- company_size 51+ employees → +25 pts
- job_title contains Director, VP, Manager, Operations → +20 pts
- page_visited /api-docs → +25 pts
- whitepaper download (case-study) → +20 pts

CO_CREATION intent signals:
- page_visited /partnerships → +40 pts
- contact_form with inquiry_type=custom_panel → +50 pts
- page_visited /white-label → +45 pts
- industry Pharmaceutical, Biotech R&D → +20 pts
- job_title contains VP, CSO, CTO, Chief, CEO, Founder → +25 pts

Each rule should have:
- id: string
- intent: 'research' | 'b2b' | 'co_creation'
- trigger: object describing condition
- confidence_points: number
- description: string
```

## 7.2 Создай Intent Detector Service

**В Cursor Chat:**

```
@docs/MASTER_PROMPT_PART1.md

Create src/services/intentDetector.ts with IntentDetector class:

Properties:
- rules: IntentRule[]

Methods:

1. constructor()
   - Load rules from config

2. async processEvent(event: MarketingEvent, lead: Lead): Promise<IntentDetectionResult>
   - Find matching intent rules for this event
   - Store detected signals in intent_signals table
   - Recalculate lead's intent summary
   - Update lead's primary_intent and intent_confidence
   - Return result

3. private matchesIntentTrigger(rule: IntentRule, event: MarketingEvent, lead: Lead): boolean
   - For event triggers: match event_type and metadata
   - For lead_field triggers: check lead fields (email pattern, job_title)
   - For org_field triggers: check organization fields

4. async calculateIntentConfidence(leadId: string): Promise<IntentCalculation>
   - Get all intent_signals for lead
   - Sum points by intent type
   - Calculate primary_intent (highest score)
   - Calculate confidence (0-100):
     * confidence = (primary_score / total_points) * 100
     * Boost if primary clearly dominates secondary
     * Reduce if total signals are weak (< 30 pts)
   - Detect conflicts (two intents close in score)
   - Return { primary_intent, intent_confidence, intent_summary, is_routable, conflict_detected }

5. async updateLeadIntent(leadId: string, calculation: IntentCalculation): Promise<void>
   - Update lead's primary_intent, intent_confidence, intent_summary

Include the calculateIntentConfidence algorithm from Section 3.4 of the document.
```

## 7.3 Интегрируй Intent Detection в Event Worker

**В Cursor Chat:**

```
Update src/workers/eventWorker.ts:

1. Import IntentDetector
2. Create intentDetector instance
3. After scoring, call intentDetector.processEvent(event, lead)
4. Log intent detection results

Flow:
Event → Store → Attribution → Scoring → Intent Detection → Queue Routing
```

## 7.4 Создай API для intent signals

**В Cursor Chat:**

```
Update src/api/routes/leads.ts to add:

GET /api/v1/leads/:id/intents
- Get lead's intent signals
- Include calculated summary
```

## 7.5 Тестируй Intent Detection

```bash
# Создай lead с academic email (research intent)
BODY='{"event_type":"page_visited","source":"portal","occurred_at":"2026-01-21T12:00:00Z","lead_identifier":{"email":"professor@university.edu"},"metadata":{"page_path":"/pricing/16s"}}'
SIGNATURE=$(echo -n "$BODY" | openssl dgst -sha256 -hmac "dev_webhook_secret_32chars_min" | cut -d' ' -f2)
curl -X POST http://localhost:3000/api/v1/events/ingest -H "Content-Type: application/json" -H "X-Webhook-Signature: $SIGNATURE" -d "$BODY"

# Проверь intent
docker exec -it dna-marketing-engine-postgres-1 psql -U dna -d dna_marketing -c "SELECT email, primary_intent, intent_confidence, intent_summary FROM leads WHERE email='professor@university.edu';"

# Создай B2B lead
BODY='{"event_type":"roi_calculator_submitted","source":"portal","occurred_at":"2026-01-21T12:00:00Z","lead_identifier":{"email":"director@biotech-corp.com"},"metadata":{"samples_per_month":500}}'
SIGNATURE=$(echo -n "$BODY" | openssl dgst -sha256 -hmac "dev_webhook_secret_32chars_min" | cut -d' ' -f2)
curl -X POST http://localhost:3000/api/v1/events/ingest -H "Content-Type: application/json" -H "X-Webhook-Signature: $SIGNATURE" -d "$BODY"

# Проверь intent
docker exec -it dna-marketing-engine-postgres-1 psql -U dna -d dna_marketing -c "SELECT email, primary_intent, intent_confidence FROM leads WHERE email='director@biotech-corp.com';"
```

✅ **Checkpoint:** Intent detection работает, signals записываются, confidence рассчитывается

---

# Этап 8: Smart Routing (2 часа)

## 8.1 Создай Routing Config

**В Cursor Chat:**

```
Create src/config/routingConfig.ts:

Export ROUTING_CONFIG object:
- min_score_threshold: 40
- min_intent_confidence: 60
- intent_confidence_margin: 15
- max_unrouted_days: 14
- fallback_pipeline: 'discovery'
- owner_assignment:
  * research: { role: 'bdr', strategy: 'round_robin', region_aware: true }
  * b2b: { role: 'ae', strategy: 'capacity_based' }
  * co_creation: { role: 'partnership_manager', strategy: 'manual' }
  * discovery: { role: 'marketing_manager', strategy: 'notify_only' }
```

## 8.2 Создай Pipeline Router Service

**В Cursor Chat:**

```
@docs/MASTER_PROMPT_PART1.md

Create src/services/pipelineRouter.ts with PipelineRouter class:

This is the CRITICAL routing logic from Section 3.5.

Methods:

1. async evaluateAndRoute(lead: Lead): Promise<RoutingResult>
   - Skip if already routed (pipeline_id !== null)
   - Check minimum score threshold
   - Get intent calculation
   - If routable: call routeLeadToPipeline
   - If conflict: call handleIntentConflict
   - If stuck too long: call handleStuckLead
   - Otherwise: return wait

2. private async routeLeadToPipeline(lead: Lead, intent: IntentType): Promise<RoutingResult>
   - Map intent to pipeline slug:
     * research → 'research-lab'
     * b2b → 'b2b-lab-enablement'
     * co_creation → 'panel-co-creation'
   - Get pipeline and first stage
   - Create deal in pipeline
   - Update lead: pipeline_id, routing_status='routed', routed_at
   - Assign owner based on config
   - Trigger notifications
   - Return result

3. private async handleIntentConflict(lead: Lead, intent: IntentCalculation): Promise<RoutingResult>
   - Send Slack notification with buttons
   - Return manual_review result

4. private async handleStuckLead(lead: Lead): Promise<RoutingResult>
   - Route to discovery pipeline
   - Notify marketing manager
   - Return result

5. private async assignOwner(lead: Lead, intent: IntentType): Promise<TeamMember | null>
   - Get assignment config for intent
   - If round_robin: get next available by role
   - If capacity_based: get least loaded
   - If manual: return null, just notify
   - Update team_member.current_leads
   - Return assigned member

6. Helper methods:
   - getLead(id)
   - getPipelineBySlug(slug)
   - getFirstStage(pipelineId)
   - createDeal(data)
   - updateLead(id, data)
   - sendSlackNotification(payload)
```

## 8.3 Создай Routing Worker

**В Cursor Chat:**

```
Create src/workers/routingWorker.ts:

1. Import Worker from bullmq
2. Create worker for 'routing' queue

3. Process job:
   - Get lead by id
   - Call pipelineRouter.evaluateAndRoute(lead)
   - Log result
   - Return result

4. Configure: concurrency 5

5. Export createRoutingWorker function
```

## 8.4 Обнови workers/index.ts

**В Cursor Chat:**

```
Update src/workers/index.ts to include routingWorker
```

## 8.5 Добавь routing в Event Worker

**В Cursor Chat:**

```
Update src/workers/eventWorker.ts:

After intent detection, add job to routingQueue:
routingQueue.add('evaluate', { lead_id: lead.id, trigger: 'event_processed' })
```

## 8.6 Создай Routing API

**В Cursor Chat:**

```
Create src/api/routes/routing.ts:

1. GET /api/v1/routing/config
   - Return current routing configuration

2. PUT /api/v1/routing/config
   - Update routing thresholds (admin only)

3. POST /api/v1/routing/evaluate/:leadId
   - Manually trigger routing evaluation
   - Useful for testing or manual intervention

4. GET /api/v1/routing/stats
   - Return routing statistics:
     * leads_routed_today
     * leads_by_pipeline
     * avg_time_to_route
     * conflicts_pending
```

## 8.7 Тестируй Full Routing Flow

```bash
# Создай lead с достаточным score и intent для routing
# Нужно несколько events чтобы набрать score >= 40

# Event 1: page visit
BODY='{"event_type":"page_visited","source":"portal","occurred_at":"2026-01-21T12:00:00Z","lead_identifier":{"email":"routing-test@company.com"},"metadata":{"page_path":"/pricing"}}'
SIGNATURE=$(echo -n "$BODY" | openssl dgst -sha256 -hmac "dev_webhook_secret_32chars_min" | cut -d' ' -f2)
curl -X POST http://localhost:3000/api/v1/events/ingest -H "Content-Type: application/json" -H "X-Webhook-Signature: $SIGNATURE" -d "$BODY"

# Event 2: ROI calculator (high volume = B2B)
BODY='{"event_type":"roi_calculator_submitted","source":"portal","occurred_at":"2026-01-21T12:01:00Z","lead_identifier":{"email":"routing-test@company.com"},"metadata":{"samples_per_month":200}}'
SIGNATURE=$(echo -n "$BODY" | openssl dgst -sha256 -hmac "dev_webhook_secret_32chars_min" | cut -d' ' -f2)
curl -X POST http://localhost:3000/api/v1/events/ingest -H "Content-Type: application/json" -H "X-Webhook-Signature: $SIGNATURE" -d "$BODY"

# Event 3: Demo request (+20 pts)
BODY='{"event_type":"demo_requested","source":"portal","occurred_at":"2026-01-21T12:02:00Z","lead_identifier":{"email":"routing-test@company.com"},"metadata":{}}'
SIGNATURE=$(echo -n "$BODY" | openssl dgst -sha256 -hmac "dev_webhook_secret_32chars_min" | cut -d' ' -f2)
curl -X POST http://localhost:3000/api/v1/events/ingest -H "Content-Type: application/json" -H "X-Webhook-Signature: $SIGNATURE" -d "$BODY"

# Проверь результат
docker exec -it dna-marketing-engine-postgres-1 psql -U dna -d dna_marketing -c "SELECT email, total_score, primary_intent, intent_confidence, routing_status, pipeline_id FROM leads WHERE email='routing-test@company.com';"

# Проверь создался ли deal
docker exec -it dna-marketing-engine-postgres-1 psql -U dna -d dna_marketing -c "SELECT d.id, d.name, p.name as pipeline, ps.name as stage FROM deals d JOIN pipelines p ON d.pipeline_id = p.id JOIN pipeline_stages ps ON d.stage_id = ps.id;"
```

✅ **Checkpoint:** Full flow работает: Event → Scoring → Intent → Routing → Deal Created

---

# Этап 9: Pipeline & Deals (1 час)

## 9.1 Создай Pipeline Service

**В Cursor Chat:**

```
Create src/services/pipelineService.ts:

Methods:
1. getAllPipelines(): Promise<Pipeline[]>
2. getPipelineById(id: string): Promise<Pipeline | null>
3. getPipelineBySlug(slug: string): Promise<Pipeline | null>
4. getPipelineWithStages(id: string): Promise<Pipeline & { stages: PipelineStage[] }>
5. getPipelineMetrics(id: string): Promise<PipelineMetrics>
   - deals_count by stage
   - total_value
   - avg_time_in_stage
   - conversion_rates
```

## 9.2 Создай Deal Service

**В Cursor Chat:**

```
Create src/services/dealService.ts:

Methods:
1. createDeal(data: CreateDealDTO): Promise<Deal>
2. getDealById(id: string): Promise<Deal | null>
3. getDealsByPipeline(pipelineId: string, filters?): Promise<Deal[]>
4. getDealsByLead(leadId: string): Promise<Deal[]>
5. updateDeal(id: string, data: Partial<Deal>): Promise<Deal>
6. moveDealToStage(dealId: string, stageId: string, reason?: string): Promise<Deal>
   - Update stage_id
   - Update stage_entered_at
   - Log stage change
7. closeDeal(dealId: string, status: 'won' | 'lost', reason?: string): Promise<Deal>
   - Update status, closed_at, close_reason
   - If won: update lead.lifecycle_stage to 'customer'
   - If won: queue Moco sync
```

## 9.3 Создай Pipeline & Deal Routes

**В Cursor Chat:**

```
Create src/api/routes/pipelines.ts:

1. GET /api/v1/pipelines - list all
2. GET /api/v1/pipelines/:id - get with stages
3. GET /api/v1/pipelines/:id/deals - deals in pipeline
4. GET /api/v1/pipelines/:id/metrics - funnel metrics

Create src/api/routes/deals.ts:

1. GET /api/v1/deals - list all (with filters)
2. GET /api/v1/deals/:id - get single
3. POST /api/v1/deals - create manually
4. PATCH /api/v1/deals/:id - update
5. POST /api/v1/deals/:id/move - move to stage
6. POST /api/v1/deals/:id/close - close deal
```

## 9.4 Зарегистрируй routes

```
Update src/index.ts to register pipelines and deals routes
```

✅ **Checkpoint:** Pipeline и Deal CRUD работает

---

# Этап 10: Automation Engine (2 часа)

## 10.1 Создай Automation Engine

**В Cursor Chat:**

```
@docs/MASTER_PROMPT_PART2.md

Create src/services/automationEngine.ts from Section 8:

Class AutomationEngine with methods:

1. loadRules(): Promise<void>

2. processEvent(lead: Lead, event: MarketingEvent): Promise<AutomationResult>
   - Find matching automation rules
   - Execute actions for each match
   - Return results

3. processStageChange(deal: Deal, fromStage: PipelineStage, toStage: PipelineStage): Promise<AutomationResult>
   - Run stage-specific automation

4. evaluateTrigger(rule: AutomationRule, lead: Lead, event?: MarketingEvent, deal?: Deal): boolean

5. executeAction(rule: AutomationRule, lead: Lead, event?: MarketingEvent, deal?: Deal): Promise<ActionResult>

Action implementations:
- actionMoveToStage
- actionAssignOwner
- actionSendNotification
- actionCreateTask
- actionSyncMoco
- actionUpdateField
- actionRouteToPipeline
```

## 10.2 Создай Automation Rules seed

**В Cursor Chat:**

```
Create src/db/seeds/automation_rules.ts:

Default automation rules:

1. Hot Lead Alert
   - Trigger: score_threshold >= 80
   - Action: send_notification to #hot-leads

2. Demo Requested → Create Task
   - Trigger: event demo_requested
   - Action: create_task "Book demo call" due in 1 day

3. Order Placed → Convert to Customer
   - Trigger: event order_placed
   - Action: update_field lifecycle_stage = 'customer'

4. B2B Intent Detected → Assign AE
   - Trigger: intent_detected b2b with confidence >= 60
   - Action: assign_owner role=ae
```

## 10.3 Интегрируй в Event Worker

**В Cursor Chat:**

```
Update src/workers/eventWorker.ts:

After routing, call automationEngine.processEvent(lead, event)
```

## 10.4 Создай Task Service & Routes

**В Cursor Chat:**

```
Create src/services/taskService.ts:
- createTask
- getTasksByAssignee
- updateTask
- completeTask

Create src/api/routes/tasks.ts:
- GET /api/v1/tasks
- POST /api/v1/tasks
- PATCH /api/v1/tasks/:id
- POST /api/v1/tasks/:id/complete
```

✅ **Checkpoint:** Automation rules выполняются, tasks создаются

---

# Этап 11: Integrations (Slack, Moco) (1 час)

## 11.1 Создай Slack Service

**В Cursor Chat:**

```
@docs/MASTER_PROMPT_PART2.md

Create src/integrations/slack.ts from Section 10.2:

SlackService class with:
- sendMessage(channel, text)
- sendRichMessage(channel, blocks)
- sendHotLeadAlert(lead)
- sendRoutingConflict(lead)
- sendDailyDigest(stats)
```

## 11.2 Создай Moco Service

**В Cursor Chat:**

```
@docs/MASTER_PROMPT_PART2.md

Create src/integrations/moco.ts from Section 10.1:

MocoService class with:
- createCustomer(data)
- createOffer(data)
- createInvoiceFromOffer(offerId)
- getCustomer(id)
- findCustomerByEmail(email)
```

## 11.3 Создай Sync Worker

**В Cursor Chat:**

```
@docs/MASTER_PROMPT_PART2.md

Create src/workers/syncWorker.ts from Section 9.4:

Process sync jobs:
- moco: create_customer, create_offer, create_invoice
- slack: send notifications
```

## 11.4 Обнови workers/index.ts

**В Cursor Chat:**

```
Update src/workers/index.ts to include syncWorker
```

✅ **Checkpoint:** Slack notifications отправляются, Moco sync работает

---

# Этап 12: Тестирование (1 час)

## 12.1 End-to-End тест

Выполни полный цикл:

```bash
# 1. Создай нового lead через event
BODY='{"event_type":"page_visited","source":"waalaxy","occurred_at":"2026-01-21T12:00:00Z","lead_identifier":{"email":"e2e-test@biotech-startup.com","linkedin_url":"https://linkedin.com/in/testuser"},"metadata":{"page_path":"/"}}'
SIGNATURE=$(echo -n "$BODY" | openssl dgst -sha256 -hmac "dev_webhook_secret_32chars_min" | cut -d' ' -f2)
curl -X POST http://localhost:3000/api/v1/events/ingest -H "Content-Type: application/json" -H "X-Webhook-Signature: $SIGNATURE" -d "$BODY"

# 2. Добавь engagement events
BODY='{"event_type":"page_visited","source":"portal","occurred_at":"2026-01-21T12:05:00Z","lead_identifier":{"email":"e2e-test@biotech-startup.com"},"metadata":{"page_path":"/enterprise"}}'
SIGNATURE=$(echo -n "$BODY" | openssl dgst -sha256 -hmac "dev_webhook_secret_32chars_min" | cut -d' ' -f2)
curl -X POST http://localhost:3000/api/v1/events/ingest -H "Content-Type: application/json" -H "X-Webhook-Signature: $SIGNATURE" -d "$BODY"

BODY='{"event_type":"roi_calculator_submitted","source":"portal","occurred_at":"2026-01-21T12:10:00Z","lead_identifier":{"email":"e2e-test@biotech-startup.com"},"metadata":{"samples_per_month":300}}'
SIGNATURE=$(echo -n "$BODY" | openssl dgst -sha256 -hmac "dev_webhook_secret_32chars_min" | cut -d' ' -f2)
curl -X POST http://localhost:3000/api/v1/events/ingest -H "Content-Type: application/json" -H "X-Webhook-Signature: $SIGNATURE" -d "$BODY"

BODY='{"event_type":"demo_requested","source":"portal","occurred_at":"2026-01-21T12:15:00Z","lead_identifier":{"email":"e2e-test@biotech-startup.com"},"metadata":{}}'
SIGNATURE=$(echo -n "$BODY" | openssl dgst -sha256 -hmac "dev_webhook_secret_32chars_min" | cut -d' ' -f2)
curl -X POST http://localhost:3000/api/v1/events/ingest -H "Content-Type: application/json" -H "X-Webhook-Signature: $SIGNATURE" -d "$BODY"

# 3. Подожди 5 секунд для обработки
sleep 5

# 4. Проверь результат через API
curl http://localhost:3000/api/v1/leads | jq '.data[] | select(.email=="e2e-test@biotech-startup.com")'

# 5. Проверь в БД
docker exec -it dna-marketing-engine-postgres-1 psql -U dna -d dna_marketing -c "
SELECT 
  l.email, 
  l.total_score, 
  l.primary_intent, 
  l.intent_confidence,
  l.routing_status,
  p.name as pipeline,
  ps.name as stage
FROM leads l
LEFT JOIN pipelines p ON l.pipeline_id = p.id
LEFT JOIN deals d ON d.lead_id = l.id
LEFT JOIN pipeline_stages ps ON d.stage_id = ps.id
WHERE l.email = 'e2e-test@biotech-startup.com';
"
```

**Ожидаемый результат:**
- total_score >= 40
- primary_intent = 'b2b'
- intent_confidence >= 60
- routing_status = 'routed'
- pipeline = 'B2B Lab Enablement'
- stage = 'Initial Contact' (first stage)

## 12.2 Проверь все endpoints

```bash
# Health & Ready
curl http://localhost:3000/health
curl http://localhost:3000/ready

# Leads
curl http://localhost:3000/api/v1/leads
curl http://localhost:3000/api/v1/leads/unrouted
curl "http://localhost:3000/api/v1/leads?min_score=20"

# Pipelines
curl http://localhost:3000/api/v1/pipelines
curl http://localhost:3000/api/v1/pipelines | jq '.[0].id' # get ID
curl http://localhost:3000/api/v1/pipelines/{pipeline_id}

# Deals
curl http://localhost:3000/api/v1/deals

# Scoring Rules
curl http://localhost:3000/api/v1/scoring/rules

# Routing
curl http://localhost:3000/api/v1/routing/config
```

✅ **Checkpoint:** Все endpoints работают, E2E flow проходит

---

# ✅ Чеклист готовности

## Инфраструктура
- [ ] Docker running (postgres, redis)
- [ ] API server starts without errors
- [ ] Workers start without errors
- [ ] Database schema applied
- [ ] Seed data loaded (pipelines, scoring rules)

## Core Features
- [ ] Event ingestion works (POST /events/ingest)
- [ ] HMAC validation works
- [ ] Leads created from events
- [ ] Scoring engine calculates points
- [ ] Score history recorded
- [ ] Intent detection works
- [ ] Intent signals stored
- [ ] Routing evaluates correctly
- [ ] Deals created in correct pipeline
- [ ] Stage assignment works

## API Endpoints
- [ ] GET /health
- [ ] GET /ready
- [ ] POST /api/v1/events/ingest
- [ ] GET /api/v1/leads
- [ ] GET /api/v1/leads/:id
- [ ] GET /api/v1/pipelines
- [ ] GET /api/v1/deals
- [ ] GET /api/v1/scoring/rules

## Integrations
- [ ] Slack notifications (if configured)
- [ ] Moco sync (if configured)

---

# 🎉 Поздравляю!

Если все чекбоксы отмечены - у тебя работающая CRM платформа!

**Следующие шаги:**
1. Добавь UI (React/Next.js dashboard)
2. Настрой production deployment
3. Подключи реальные webhook sources (Waalaxy, Lemlist)
4. Настрой Slack workspace
5. Интегрируй с Moco

---

**Время на выполнение:** ~16-20 часов интенсивной работы  
**Рекомендация:** Делай по 2-3 этапа в день, тестируй после каждого этапа
