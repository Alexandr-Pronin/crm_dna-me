# DNA Marketing Engine — Архитектура

## Содержание

1. [Обзор системы](#1-обзор-системы)
2. [Диаграмма компонентов системы](#2-диаграмма-компонентов-системы)
3. [Схема базы данных (ER-диаграмма)](#3-схема-базы-данных-er-диаграмма)
4. [Описание таблиц](#4-описание-таблиц)
5. [Поток данных: обработка события](#5-поток-данных-обработка-события)
6. [Поток данных: маршрутизация лида](#6-поток-данных-маршрутизация-лида)
7. [Архитектура воркеров (BullMQ)](#7-архитектура-воркеров-bullmq)
8. [Компоненты фронтенда](#8-компоненты-фронтенда)
9. [Конфигурация пайплайнов](#9-конфигурация-пайплайнов)
10. [API-эндпоинты](#10-api-эндпоинты)

---

## 1. Обзор системы

DNA Marketing Engine — CRM-платформа для биотех-индустрии. Система принимает маркетинговые события из внешних каналов, скорит лидов, определяет их намерение (intent) и автоматически маршрутизирует в нужный пайплайн продаж.

```mermaid
graph TB
    subgraph "Внешние источники"
        WA[Waalaxy<br/>LinkedIn Outreach]
        LE[Lemlist<br/>Email Campaigns]
        WEB[Website<br/>Portal Events]
        ADS[Ads<br/>Google/LinkedIn]
        CONF[Conferences<br/>Offline Events]
    end

    subgraph "DNA Marketing Engine"
        API[Fastify API Server<br/>:3000]
        REDIS[(Redis 7<br/>:6379)]
        PG[(PostgreSQL 15<br/>:5432)]

        subgraph "BullMQ Workers"
            EW[Event Worker<br/>×10 concurrency]
            RW[Routing Worker<br/>×5 concurrency]
            SW[Sync Worker<br/>×3 concurrency]
            DW[Decay Worker<br/>cron: 2:00 AM]
            DDW[Daily Digest<br/>cron: 8:00 AM]
        end

        subgraph "Бизнес-логика (Services)"
            SE[Scoring Engine<br/>17 правил]
            ID[Intent Detector<br/>22 правила]
            AE[Automation Engine<br/>11 правил]
            PR[Pipeline Router]
        end

        FE[React Frontend<br/>:5173]
    end

    subgraph "Внешние интеграции"
        MOCO[Moco API<br/>Финансы/Счета]
        SLACK[Slack<br/>Уведомления]
    end

    WA & LE & WEB & ADS & CONF -->|POST /api/v1/events/ingest| API
    API -->|Enqueue| REDIS
    REDIS --> EW
    EW --> SE & ID & AE
    EW -->|Queue routing| REDIS
    REDIS --> RW
    RW --> PR
    EW & RW & SE & ID & AE & PR -->|Read/Write| PG
    REDIS --> SW
    SW --> MOCO & SLACK
    REDIS --> DW & DDW
    DW & DDW -->|Read/Write| PG
    FE -->|REST API| API
    API -->|Read/Write| PG
    API -->|Publish jobs| REDIS
```

---

## 2. Диаграмма компонентов системы

```mermaid
graph LR
    subgraph "Frontend (React + Vite :5173)"
        APP[App.jsx<br/>React Admin]
        DP[dataProvider.js<br/>API Client]
        AP[authProvider.js<br/>Dev Auth]
        APP --> DP & AP
    end

    subgraph "Backend API (Fastify :3000)"
        direction TB
        MW[Middleware<br/>API Key / HMAC / Error]

        subgraph "API Routes"
            R_EV[/events]
            R_LE[/leads]
            R_DE[/deals]
            R_PI[/pipelines]
            R_SC[/scoring]
            R_RO[/routing]
            R_TA[/tasks]
            R_TE[/team]
            R_AU[/automation]
            R_CA[/campaigns]
            R_GD[/gdpr]
            R_RE[/reports]
            R_IN[/integrations]
        end

        subgraph "Services"
            S_LE[LeadService]
            S_DE[DealService]
            S_PI[PipelineService]
            S_TA[TaskService]
            S_SC[ScoringEngine]
            S_ID[IntentDetector]
            S_AE[AutomationEngine]
            S_PR[PipelineRouter]
            S_RP[ReportService]
        end
    end

    subgraph "Workers (BullMQ)"
        W_EV[EventWorker]
        W_RO[RoutingWorker]
        W_SY[SyncWorker]
        W_DC[DecayWorker]
        W_DD[DailyDigest]
    end

    subgraph "Инфраструктура"
        PG[(PostgreSQL 15)]
        RD[(Redis 7)]
    end

    subgraph "Внешние API"
        MOCO[Moco]
        SLACK[Slack]
    end

    DP -->|HTTP| MW
    MW --> R_EV & R_LE & R_DE & R_PI & R_SC & R_RO & R_TA & R_TE & R_AU & R_CA & R_GD & R_RE & R_IN
    R_EV & R_LE --> S_LE
    R_DE --> S_DE
    R_PI --> S_PI
    R_TA --> S_TA
    R_SC --> S_SC
    R_RO --> S_PR
    R_RE --> S_RP
    S_LE & S_DE & S_PI & S_TA & S_SC & S_ID & S_AE & S_PR & S_RP --> PG
    R_EV -->|Enqueue| RD
    W_EV --> S_SC & S_ID & S_AE
    W_RO --> S_PR
    W_SY --> MOCO & SLACK
    W_EV & W_RO & W_SY & W_DC & W_DD --> PG
    RD --> W_EV & W_RO & W_SY & W_DC & W_DD
```

---

## 3. Схема базы данных (ER-диаграмма)

```mermaid
erDiagram
    organizations {
        UUID id PK
        VARCHAR name
        VARCHAR domain
        VARCHAR industry
        VARCHAR company_size
        VARCHAR country
        VARCHAR portal_id UK
        VARCHAR moco_id
        JSONB metadata
        TIMESTAMPTZ created_at
        TIMESTAMPTZ updated_at
    }

    pipelines {
        UUID id PK
        VARCHAR slug UK
        VARCHAR name
        TEXT description
        BOOLEAN is_active
        BOOLEAN is_default
        INTEGER sales_cycle_days
        VARCHAR target_persona
        JSONB config
        TIMESTAMPTZ created_at
    }

    pipeline_stages {
        UUID id PK
        UUID pipeline_id FK
        VARCHAR slug
        VARCHAR name
        INTEGER position
        VARCHAR stage_type
        JSONB automation_config
        TIMESTAMPTZ created_at
    }

    leads {
        UUID id PK
        VARCHAR email UK
        VARCHAR first_name
        VARCHAR last_name
        VARCHAR phone
        VARCHAR job_title
        UUID organization_id FK
        VARCHAR status
        VARCHAR lifecycle_stage
        INTEGER demographic_score
        INTEGER engagement_score
        INTEGER behavior_score
        INTEGER total_score "GENERATED"
        UUID pipeline_id FK
        VARCHAR routing_status
        TIMESTAMPTZ routed_at
        VARCHAR primary_intent
        INTEGER intent_confidence
        JSONB intent_summary
        VARCHAR first_touch_source
        VARCHAR last_touch_source
        TIMESTAMPTZ created_at
        TIMESTAMPTZ updated_at
        TIMESTAMPTZ last_activity
    }

    deals {
        UUID id PK
        UUID lead_id FK
        UUID pipeline_id FK
        UUID stage_id FK
        VARCHAR name
        DECIMAL value
        VARCHAR currency
        DATE expected_close_date
        VARCHAR assigned_to
        VARCHAR assigned_region
        VARCHAR status
        TEXT close_reason
        TIMESTAMPTZ closed_at
        VARCHAR moco_offer_id
        JSONB metadata
        TIMESTAMPTZ created_at
        TIMESTAMPTZ updated_at
    }

    events {
        UUID id PK
        UUID lead_id FK
        VARCHAR event_type
        VARCHAR event_category
        VARCHAR source
        TIMESTAMPTZ occurred_at PK
        JSONB metadata
        VARCHAR campaign_id
        VARCHAR utm_source
        VARCHAR utm_medium
        VARCHAR utm_campaign
        INTEGER score_points
        VARCHAR score_category
        TIMESTAMPTZ processed_at
        TIMESTAMPTZ created_at
    }

    intent_signals {
        UUID id PK
        UUID lead_id FK
        VARCHAR intent
        VARCHAR rule_id
        INTEGER confidence_points
        VARCHAR trigger_type
        UUID event_id
        JSONB trigger_data
        TIMESTAMPTZ detected_at
    }

    scoring_rules {
        UUID id PK
        VARCHAR slug UK
        VARCHAR name
        TEXT description
        BOOLEAN is_active
        INTEGER priority
        VARCHAR rule_type
        VARCHAR category
        JSONB conditions
        INTEGER points
        INTEGER max_per_day
        INTEGER max_per_lead
        INTEGER decay_days
        TIMESTAMPTZ created_at
        TIMESTAMPTZ updated_at
    }

    score_history {
        UUID id PK
        UUID lead_id FK
        UUID event_id
        UUID rule_id FK
        VARCHAR category
        INTEGER points_change
        INTEGER new_total
        TIMESTAMPTZ expires_at
        BOOLEAN expired
        TIMESTAMPTZ expired_at
        TIMESTAMPTZ created_at
    }

    automation_rules {
        UUID id PK
        VARCHAR name
        TEXT description
        BOOLEAN is_active
        INTEGER priority
        UUID pipeline_id FK
        UUID stage_id FK
        VARCHAR trigger_type
        JSONB trigger_config
        VARCHAR action_type
        JSONB action_config
        INTEGER execution_count
        TIMESTAMPTZ created_at
        TIMESTAMPTZ updated_at
    }

    automation_logs {
        UUID id PK
        UUID rule_id FK
        UUID lead_id FK
        UUID deal_id FK
        JSONB trigger_data
        JSONB action_result
        BOOLEAN success
        TEXT error_message
        TIMESTAMPTZ executed_at
    }

    tasks {
        UUID id PK
        UUID lead_id FK
        UUID deal_id FK
        VARCHAR title
        TEXT description
        VARCHAR task_type
        VARCHAR assigned_to
        TIMESTAMPTZ due_date
        TIMESTAMPTZ completed_at
        VARCHAR status
        UUID automation_rule_id FK
        TIMESTAMPTZ created_at
        TIMESTAMPTZ updated_at
    }

    team_members {
        UUID id PK
        VARCHAR email UK
        VARCHAR name
        VARCHAR role
        VARCHAR region
        BOOLEAN is_active
        INTEGER max_leads
        INTEGER current_leads
        TIMESTAMPTZ created_at
    }

    campaigns {
        UUID id PK
        VARCHAR name
        VARCHAR campaign_type
        VARCHAR status
        DECIMAL budget
        DECIMAL spent
        VARCHAR utm_campaign UK
        DATE start_date
        DATE end_date
        INTEGER leads_generated
        INTEGER deals_created
        DECIMAL revenue_attributed
        JSONB metadata
        TIMESTAMPTZ created_at
        TIMESTAMPTZ updated_at
    }

    api_keys {
        UUID id PK
        VARCHAR source
        VARCHAR key_hash UK
        TEXT description
        BOOLEAN is_active
        TIMESTAMPTZ last_used_at
        TIMESTAMPTZ created_at
    }

    organizations ||--o{ leads : "has"
    pipelines ||--o{ pipeline_stages : "contains"
    pipelines ||--o{ leads : "routes to"
    pipelines ||--o{ deals : "contains"
    pipeline_stages ||--o{ deals : "current stage"
    leads ||--o{ events : "generates"
    leads ||--o{ intent_signals : "has"
    leads ||--o{ deals : "converts to"
    leads ||--o{ score_history : "scored by"
    leads ||--o{ tasks : "assigned"
    leads ||--o{ automation_logs : "triggered"
    deals ||--o{ tasks : "has"
    deals ||--o{ automation_logs : "triggered"
    scoring_rules ||--o{ score_history : "applied"
    automation_rules ||--o{ automation_logs : "executed"
    automation_rules ||--o{ tasks : "created by"
    pipelines ||--o{ automation_rules : "scoped to"
    pipeline_stages ||--o{ automation_rules : "scoped to"
```

---

## 4. Описание таблиц

### Основные сущности

| Таблица | Назначение | Ключевые поля |
|---------|-----------|---------------|
| `organizations` | Компании, к которым привязаны лиды | `name`, `domain`, `industry`, `portal_id`, `moco_id` |
| `leads` | Контакты/лиды — центральная сущность | `email`, scores (3 категории + total), `routing_status`, `primary_intent`, `intent_confidence`, `intent_summary` |
| `pipelines` | Воронки продаж (Discovery, Research Lab, B2B, Co-Creation) | `slug`, `is_default`, `sales_cycle_days`, `target_persona` |
| `pipeline_stages` | Этапы внутри каждого пайплайна (3-7 этапов) | `position`, `stage_type` (awareness→closed_won/lost), `automation_config` |
| `deals` | Сделки — создаются при маршрутизации лида в пайплайн | `lead_id`, `pipeline_id`, `stage_id`, `value`, `assigned_to`, `status` |
| `events` | Маркетинговые события (партицирована по месяцам) | `event_type`, `source`, `occurred_at`, `metadata`, UTM-метки |

### Скоринг и интент

| Таблица | Назначение | Ключевые поля |
|---------|-----------|---------------|
| `scoring_rules` | Правила начисления баллов (17 правил) | `category` (demographic/engagement/behavior), `conditions` (JSONB), `points`, `decay_days` |
| `score_history` | История изменения баллов с экспирацией | `lead_id`, `rule_id`, `category`, `points_change`, `expires_at`, `expired` |
| `intent_signals` | Сигналы намерения лида (research/b2b/co_creation) | `lead_id`, `intent`, `confidence_points`, `trigger_type` |

### Автоматизация

| Таблица | Назначение | Ключевые поля |
|---------|-----------|---------------|
| `automation_rules` | Правила автоматизации (11 правил) | `trigger_type`, `trigger_config`, `action_type`, `action_config` |
| `automation_logs` | Лог выполнения правил | `rule_id`, `lead_id`, `deal_id`, `success`, `error_message` |
| `tasks` | Задачи для команды (создаются автоматически или вручную) | `lead_id`, `deal_id`, `assigned_to`, `due_date`, `status` |

### Команда и кампании

| Таблица | Назначение | Ключевые поля |
|---------|-----------|---------------|
| `team_members` | Участники команды продаж (4 человека) | `email`, `role`, `region`, `max_leads`, `current_leads` |
| `campaigns` | Маркетинговые кампании | `utm_campaign`, `budget`, `spent`, `leads_generated`, `revenue_attributed` |
| `api_keys` | API-ключи для webhook-аутентификации | `source`, `key_hash`, `is_active` |

### Особенности таблицы `events`

Таблица `events` **партицирована по месяцам** (PARTITION BY RANGE на `occurred_at`). Для 2026 года создано 12 партиций (`events_2026_01` ... `events_2026_12`). Составной PK: `(id, occurred_at)`.

### Вычисляемые поля

- `leads.total_score` — GENERATED ALWAYS AS `(demographic_score + engagement_score + behavior_score)` STORED
- `leads.intent_summary` — JSONB с confidence по каждому intent: `{"research": 0, "b2b": 0, "co_creation": 0}`

### Триггеры

Все основные таблицы имеют триггер `update_updated_at()` для автоматического обновления `updated_at`.

### Хранимые функции

| Функция | Назначение |
|---------|-----------|
| `recalculate_lead_scores(lead_id)` | Пересчёт скоров из не-истёкших записей `score_history` |
| `expire_old_scores()` | Экспирация старых скоров и пересчёт затронутых лидов |

---

## 5. Поток данных: обработка события

```mermaid
sequenceDiagram
    participant SRC as Внешний источник
    participant API as Fastify API<br/>:3000
    participant REDIS as Redis<br/>(BullMQ Queue)
    participant EW as Event Worker
    participant SE as Scoring Engine
    participant ID as Intent Detector
    participant AE as Automation Engine
    participant PG as PostgreSQL
    participant RQ as Routing Queue

    SRC->>API: POST /api/v1/events/ingest<br/>{event_type, source, lead_identifier, metadata}
    API->>API: Валидация X-API-Key
    API->>API: Валидация Zod-схемы
    API->>REDIS: events.add(job)
    API-->>SRC: 200 {event_id, "queued"}

    REDIS->>EW: Dequeue job

    Note over EW,PG: Шаг 1: Найти или создать лида
    EW->>PG: SELECT lead by email/portal_id
    alt Лид не найден
        EW->>PG: INSERT INTO leads
    end

    Note over EW,PG: Шаг 2: Сохранить событие
    EW->>PG: INSERT INTO events

    Note over EW,PG: Шаг 3: Обновить атрибуцию
    EW->>PG: UPDATE leads SET first/last_touch

    Note over EW,SE: Шаг 4: Скоринг
    EW->>SE: processEvent(lead, event)
    SE->>PG: SELECT scoring_rules WHERE is_active
    SE->>SE: Матчинг условий правил
    SE->>PG: INSERT INTO score_history
    SE->>PG: UPDATE leads SET scores
    SE-->>EW: {rules_matched, points_added, tier}

    Note over EW,ID: Шаг 5: Определение намерения
    EW->>ID: processEvent(lead, event)
    ID->>ID: Матчинг 22 intent-правил
    ID->>PG: INSERT INTO intent_signals
    ID->>PG: UPDATE leads SET intent_summary, primary_intent
    ID-->>EW: {signals_detected}

    Note over EW,AE: Шаг 6: Автоматизация
    EW->>AE: processEvent(lead, event)
    AE->>AE: Матчинг trigger_config
    AE->>PG: Execute actions (create task, notify, etc.)
    AE-->>EW: {rules_executed}

    Note over EW,RQ: Шаг 7: Оценка маршрутизации
    alt score ≥ 40 AND intent_confidence ≥ 60
        EW->>REDIS: routing.add({lead_id})
    end
```

---

## 6. Поток данных: маршрутизация лида

```mermaid
sequenceDiagram
    participant RQ as Routing Queue<br/>(Redis)
    participant RW as Routing Worker
    participant PR as Pipeline Router
    participant PG as PostgreSQL
    participant SQ as Sync Queue

    RQ->>RW: Dequeue {lead_id}
    RW->>PR: evaluateAndRoute(lead_id)

    PR->>PG: SELECT lead с scores и intent
    PR->>PR: Проверка порогов:<br/>score ≥ 40?<br/>intent_confidence ≥ 60?

    alt Пороги не достигнуты
        PR-->>RW: {routed: false, reason}
    else Пороги достигнуты
        PR->>PR: Определить пайплайн по intent:<br/>research → Research Lab<br/>b2b → B2B Lab Enablement<br/>co_creation → Panel Co-Creation

        PR->>PG: SELECT pipeline + first stage
        PR->>PG: INSERT INTO deals
        PR->>PR: Назначить владельца<br/>(round-robin по team_members)
        PR->>PG: UPDATE leads SET<br/>pipeline_id, routing_status='routed'
        PR->>PG: UPDATE team_members SET<br/>current_leads += 1

        alt Moco интеграция включена
            PR->>SQ: sync.add({type: 'create_customer'})
        end

        alt Slack интеграция включена
            PR->>SQ: sync.add({type: 'hot_lead_alert'})
        end

        PR-->>RW: {routed: true, pipeline, deal_id}
    end
```

---

## 7. Архитектура воркеров (BullMQ)

```mermaid
graph TB
    subgraph "Redis (очереди BullMQ)"
        Q_EV[events<br/>Очередь событий]
        Q_RO[routing<br/>Очередь маршрутизации]
        Q_SY[sync<br/>Очередь синхронизации]
        Q_SC[scheduled<br/>Запланированные задачи]
    end

    subgraph "Event Worker (×10)"
        EW_PROC[Обработка события]
        EW_LEAD[Find/Create Lead]
        EW_STORE[Store Event]
        EW_SCORE[Scoring Engine<br/>17 правил]
        EW_INTENT[Intent Detector<br/>22 правила]
        EW_AUTO[Automation Engine<br/>11 правил]
    end

    subgraph "Routing Worker (×5)"
        RW_EVAL[Pipeline Router]
        RW_DEAL[Create Deal]
        RW_ASSIGN[Assign Owner]
    end

    subgraph "Sync Worker (×3, rate: 10/s)"
        SW_MOCO[Moco Sync<br/>create_customer<br/>create_offer<br/>create_invoice]
        SW_SLACK[Slack Notifications<br/>hot_lead_alert<br/>routing_conflict<br/>deal_won<br/>send_message]
    end

    subgraph "Scheduled Workers"
        DW[Decay Worker<br/>cron: 0 2 * * *<br/>Экспирация скоров]
        DDW[Daily Digest<br/>cron: 0 8 * * *<br/>Ежедневная сводка]
    end

    Q_EV --> EW_PROC
    EW_PROC --> EW_LEAD --> EW_STORE --> EW_SCORE --> EW_INTENT --> EW_AUTO
    EW_AUTO -->|score ≥ 40 + intent ≥ 60| Q_RO

    Q_RO --> RW_EVAL --> RW_DEAL --> RW_ASSIGN
    RW_ASSIGN -->|moco/slack| Q_SY

    Q_SY --> SW_MOCO & SW_SLACK

    Q_SC --> DW & DDW
```

### Конфигурация очередей

| Очередь | Concurrency | Rate Limit | Назначение |
|---------|-------------|------------|-----------|
| `events` | 10 | — | Обработка входящих маркетинговых событий |
| `routing` | 5 | — | Оценка и маршрутизация лидов |
| `sync` | 3 | 10 req/s | Синхронизация с Moco и Slack |
| `scheduled` | 1 | — | Cron-задачи (decay, digest) |

---

## 8. Компоненты фронтенда

```mermaid
graph TB
    subgraph "App.jsx (React Admin)"
        LAYOUT[Layout]
        APPBAR[AppBar<br/>DNA ME Logo, Dev Badge]
        MENU[Menu<br/>Sidebar Navigation]
        LAYOUT --> APPBAR & MENU
    end

    subgraph "Providers"
        DP[dataProvider.js<br/>REST API Client<br/>Base: localhost:3000/api/v1]
        AP[authProvider.js<br/>Dev Mode Auth]
    end

    subgraph "CRM — Leads"
        LL[LeadList<br/>Таблица лидов<br/>+ фильтры + поиск]
        LS[LeadShow<br/>Детали лида<br/>3 вкладки]
        LCM[LeadCreateModal<br/>Форма создания]
        SH[ScoreHistory<br/>Timeline баллов]
        ET[EventTimeline<br/>Timeline событий]
        LL --> LCM
        LS --> SH & ET
    end

    subgraph "CRM — Deals"
        DL[DealList<br/>Список/Kanban сделок]
    end

    subgraph "CRM — Tasks"
        TL[TaskList<br/>Список задач]
    end

    subgraph "Analytics"
        RP[ReportsPage<br/>KPI + графики<br/>(mock data)]
        LSP[LeadScoringPage<br/>2 вкладки]
        SRE[ScoringRuleEditor<br/>CRUD правил]
        SST[ScoringStats<br/>Статистика скоринга]
        LSP --> SRE & SST
    end

    subgraph "System"
        SP[SettingsPage<br/>4 вкладки]
        TM[TeamManagement<br/>DataGrid команды]
        SP --> TM
    end

    subgraph "Common Components"
        SB[ScoreBadge<br/>Cold/Warm/Hot/VeryHot]
        STB[StatusBadge<br/>Статусы + цвета]
        DASH[Dashboard<br/>KPI Cards]
    end

    MENU --> DASH & LL & DL & TL & RP & LSP & SP
    LL & LS --> SB & STB
    DP -.->|HTTP| LL & LS & DL & TL & SRE & SST & TM
```

### Карта страниц

| Маршрут | Компонент | Источник данных |
|---------|-----------|----------------|
| `/` | Dashboard | Placeholder (mock) |
| `/leads` | LeadList | `GET /api/v1/leads` |
| `/leads/:id/show` | LeadShow | `GET /api/v1/leads/:id` |
| `/deals` | DealList | `GET /api/v1/deals` |
| `/tasks` | TaskList | `GET /api/v1/tasks` |
| `/reports` | ReportsPage | Mock data |
| `/lead-scoring` | LeadScoringPage | `GET /api/v1/scoring/rules`, `GET /api/v1/scoring/stats` |
| `/settings` | SettingsPage | `GET /api/v1/team` (вкладка Team) |

### Data Provider — основные API-вызовы

| Метод | Endpoint | Назначение |
|-------|----------|-----------|
| `getList('leads')` | `GET /leads` | Список лидов с пагинацией |
| `getOne('leads', id)` | `GET /leads/:id` | Детали лида |
| `create('leads', data)` | `POST /leads` | Создание лида |
| `getLeadEvents(id)` | `GET /leads/:id/events` | События лида |
| `getScoreHistory(id)` | `GET /scoring/leads/:id/history` | История скоров |
| `getScoringRules()` | `GET /scoring/rules` | Правила скоринга |
| `getTeamMembers()` | `GET /team` | Список команды |
| `moveDealStage(id, stageId)` | `PUT /deals/:id/stage` | Перемещение сделки |

---

## 9. Конфигурация пайплайнов

### 4 пайплайна продаж

```mermaid
graph LR
    subgraph "Discovery Pipeline (default)"
        D1[New Lead] --> D2[Qualifying] --> D3[Routed to Pipeline]
    end

    subgraph "Research Lab (14 дней)"
        R1[Initial Contact] --> R2[Information Phase] --> R3[Consultation] --> R4[Pilot Project] --> R5[Proposal Sent] --> R6[Customer ✅]
        R5 -.->|Moco: create_offer| MOCO1[Moco]
        R6 -.->|Moco: create_customer| MOCO1
    end

    subgraph "B2B Lab Enablement (60 дней)"
        B1[Initial Contact] --> B2[Tech Discovery] --> B3[Deep Analysis] --> B4[PoC] --> B5[Business Case] --> B6[Contract Signed ✅]
        B5 -.->|Moco: create_offer| MOCO2[Moco]
        B6 -.->|Moco: create_customer| MOCO2
    end

    subgraph "Panel Co-Creation (120 дней)"
        C1[Initial Contact] --> C2[Exploration] --> C3[Workshop] --> C4[Development] --> C5[Finalization] --> C6[Partnership ✅]
        C5 -.->|Moco: create_offer| MOCO3[Moco]
        C6 -.->|Moco: create_customer| MOCO3
    end
```

### Маршрутизация Intent → Pipeline

| Intent | Pipeline | Target Persona | Sales Cycle |
|--------|----------|---------------|-------------|
| `research` | Research Lab | PhD / Professor / Researcher | 14 дней |
| `b2b` | B2B Lab Enablement | Lab Director / Operations Manager | 60 дней |
| `co_creation` | Panel Co-Creation | VP R&D / CSO / CTO | 120 дней |
| unclear | Discovery | — | — |

### Пороги маршрутизации

| Параметр | Значение |
|----------|---------|
| Минимальный score | ≥ 40 |
| Минимальная intent confidence | ≥ 60% |
| Маржа confidence между интентами | 15% |
| Макс. дней без маршрутизации | 14 |

### Тиры скоринга

| Тир | Score | Цвет |
|-----|-------|------|
| Cold | 0–39 | Серый |
| Warm | 40–79 | Жёлтый |
| Hot | 80–119 | Оранжевый |
| Very Hot | 120+ | Красный |

---

## 10. API-эндпоинты

### Аутентификация

Все эндпоинты `/api/v1/*` требуют заголовок `X-API-Key`. Ключи настраиваются в `API_KEYS` env variable (формат: `key1:source1,key2:source2`).

### Health & Status

| Метод | Endpoint | Описание |
|-------|----------|---------|
| GET | `/health` | Полная проверка (DB + Redis) |
| GET | `/ready` | Readiness probe |
| GET | `/` | Информация о сервисе |

### Events (Ingestion)

| Метод | Endpoint | Описание |
|-------|----------|---------|
| POST | `/api/v1/events/ingest` | Принять маркетинговое событие |
| POST | `/api/v1/events/webhook` | Webhook с HMAC-валидацией |
| POST | `/api/v1/leads/bulk` | Массовый импорт лидов |

### Leads

| Метод | Endpoint | Описание |
|-------|----------|---------|
| GET | `/api/v1/leads` | Список с фильтрацией и пагинацией |
| GET | `/api/v1/leads/unrouted` | Немаршрутизированные лиды |
| GET | `/api/v1/leads/stats` | Статистика лидов |
| GET | `/api/v1/leads/:id` | Детали лида |
| POST | `/api/v1/leads` | Создать лида |
| PATCH | `/api/v1/leads/:id` | Обновить лида |
| DELETE | `/api/v1/leads/:id` | Удалить лида |
| GET | `/api/v1/leads/:id/events` | События лида |
| GET | `/api/v1/leads/:id/scores` | История скоров |
| GET | `/api/v1/leads/:id/intents` | Сигналы намерений |
| POST | `/api/v1/leads/:id/route` | Ручная маршрутизация |

### Deals

| Метод | Endpoint | Описание |
|-------|----------|---------|
| GET | `/api/v1/deals` | Список сделок |
| GET | `/api/v1/deals/:id` | Детали сделки |
| POST | `/api/v1/deals` | Создать сделку |
| PATCH | `/api/v1/deals/:id` | Обновить сделку |
| POST | `/api/v1/deals/:id/move` | Переместить по этапам |
| POST | `/api/v1/deals/:id/close` | Закрыть (won/lost) |

### Pipelines

| Метод | Endpoint | Описание |
|-------|----------|---------|
| GET | `/api/v1/pipelines` | Все пайплайны |
| GET | `/api/v1/pipelines/:id` | Пайплайн с этапами |
| GET | `/api/v1/pipelines/:id/deals` | Сделки в пайплайне |
| GET | `/api/v1/pipelines/:id/metrics` | Метрики пайплайна |

### Scoring & Routing

| Метод | Endpoint | Описание |
|-------|----------|---------|
| GET | `/api/v1/scoring/rules` | Правила скоринга |
| POST | `/api/v1/scoring/rules` | Создать правило |
| GET | `/api/v1/routing/config` | Конфигурация маршрутизации |
| POST | `/api/v1/routing/evaluate/:leadId` | Принудительная оценка |

### Tasks, Team, Automation, Campaigns, GDPR, Reports, Integrations

Полный список эндпоинтов для этих ресурсов — см. `README.md` и исходный код в `src/api/routes/`.
