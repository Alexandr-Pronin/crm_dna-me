# 🧬 DNA Marketing Engine — Projekt-Dokumentation

**Version:** 1.0.0  
**Stand:** Februar 2026

---

## Inhaltsverzeichnis

1. [Überblick](#überblick)
2. [Was kann es jetzt (MVP)?](#was-kann-es-jetzt-mvp)
3. [Phase 2 & Roadmap](#phase-2--roadmap)
4. [Technische Architektur](#technische-architektur)

---

## Überblick

**DNA Marketing Engine** ist eine maßgeschneiderte CRM-Plattform für die Biotech-Branche mit Smart Routing und Intent Detection. Sie verbindet Marketing-Events aus verschiedenen Kanälen, bewertet Leads automatisch und leitet sie intelligent in die passenden Sales-Pipelines.

---

## Was kann es jetzt (MVP)?

### ✅ Kern-CRM

| Modul | Status | Beschreibung |
|-------|--------|--------------|
| **Leads** | ✅ Vollständig | CRUD, Suche, Filter, Event-Timeline, Score-Historie, Intent-Signale, manuelles Routing |
| **Deals** | ✅ Vollständig | Kanban-Board (Drag & Drop), CRUD, Stage-Bewegung, Close (Won/Lost) |
| **Organizations** | ✅ Vollständig | CRUD, Verknüpfung mit Leads |
| **Pipelines** | ✅ Vollständig | Liste, Detailansicht, Metriken, Stage-Konfiguration |
| **Tasks** | ✅ Vollständig | CRUD, Zuordnung zu Deals/Leads, Erledigen |
| **Events** | ✅ Vollständig | Event-Ingestion, Timeline pro Lead |

### ✅ Smart Routing & Scoring

- **Event Ingestion**: Events aus Waalaxy, Lemlist, Website, Ads, Konferenzen
- **Lead Scoring**: Echtzeit-Scoring mit konfigurierbaren Regeln und Decay
- **Intent Detection**: Automatische Erkennung (Research Lab, B2B Lab, Co-Creation)
- **Smart Routing**: Automatisches Routing bei Score ≥ 40 und Intent ≥ 60 %
- **Routing-Konfiguration**: Schwellenwerte und Regeln über API anpassbar

### ✅ Automatisierung

- **Automation Engine**: Automatische Stage-Bewegungen, Benachrichtigungen, Task-Erstellung
- **Triggers**: Trigger-basierte Automatisierungen
- **Background Workers**: Event-, Routing-, Sync-, Decay-, Email-Sequence-Worker

### ✅ Authentifizierung & Sicherheit

- **JWT-basierte Auth**: Login, Registrierung
- **2FA (TOTP)**: Zwei-Faktor-Authentifizierung
- **Rollen**: Admin, User (Basis)
- **API-Key**: Webhook-Validierung (HMAC)

### ✅ E-Mail-Marketing (teilweise)

- **Sequences**: E-Mail-Sequenzen für Deals
- **Sequence Builder**: UI zum Erstellen/Bearbeiten von Sequenzen
- **Enrollments**: Deal-Enrollment in Sequenzen
- **Hinweis**: Reports, Settings, Email-Marketing-Dashboard nutzen teilweise noch Mock-Daten

### ✅ Integrationen

| Integration | Status | Funktion |
|-------------|--------|----------|
| **Moco** | ✅ | Kunden-Sync bei Deal-Won, Angebote, Rechnungen |
| **Slack** | ✅ | Hot-Lead-Alerts, Routing-Konflikte, Sales-Wins, Daily Digest, Error-Alerts |
| **Cituro** | 🔧 | Integration vorhanden |

### ✅ GDPR & Compliance

- **GDPR-Routes**: DSGVO-relevante Endpoints (Export, Löschung, etc.)

### ✅ Deployment

- **AWS**: CloudFormation (EC2 App + DB), Docker, Nginx + Certbot (SSL)
- **Alternative**: Proxmox/Manitou migrierbar (kein RDS, kein ElastiCache)

### ⚠️ Einschränkungen im MVP

- **Reports**: Mock-Daten
- **Settings**: Mock-Daten
- **Chat**: DB-Schema vorhanden, MessageService implementiert, **keine Chat-UI** im Frontend
- **E-Mail-Sync**: Keine IMAP/SMTP-Synchronisation im UI

---

## Phase 2 & Roadmap

### Phase 2 — Chat & Kommunikation (geplant)

| Feature | Priorität | Status | Beschreibung |
|---------|-----------|--------|--------------|
| **Chat-UI** | Hoch | 🔲 Geplant | Chat-Panel (ähnlich LinkedIn/Salesforce), Konversationen pro Lead/Deal |
| **E-Mail-Integration** | Hoch | 🔲 Geplant | IMAP/SMTP-Sync, E-Mail-Konten pro Team-Mitglied, Inbound/Outbound |
| **LinkedIn-Integration** | Mittel | 🔲 Geplant | OAuth, LinkedIn-Nachrichten in Konversationen |
| **MessageService** | Hoch | ✅ Implementiert | Kernlogik für E-Mail, LinkedIn, interne Notizen |
| **Conversations/Messages** | Hoch | ✅ DB-Schema | Tabellen `conversations`, `messages`, `email_accounts`, `linkedin_connections` |

### Phase 3 — Erweiterte Analytics & Automatisierung

| Feature | Priorität | Beschreibung |
|---------|-----------|--------------|
| **Reports (echte Daten)** | Hoch | Dashboard mit echten Metriken statt Mock |
| **Settings (echte API)** | Mittel | Systemeinstellungen über Backend |
| **Erweiterte Automatisierung** | Mittel | Mehr Trigger-Typen, komplexere Workflows |
| **Campaign-Tracking** | Mittel | Kampagnen-Metriken, Attribution |

### Phase 4 — Skalierung & Enterprise

| Feature | Priorität | Beschreibung |
|---------|-----------|--------------|
| **Multi-Tenancy** | Niedrig | Mehrere Organisationen/Mandanten |
| **Audit-Log** | Mittel | Vollständige Änderungshistorie |
| **API-Rate-Limiting** | Mittel | Feinere Kontrolle pro Client |
| **Webhooks (Outbound)** | Mittel | Externe Systeme bei Events benachrichtigen |

### Roadmap-Übersicht (vereinfacht)

```
MVP (jetzt)     Phase 2              Phase 3              Phase 4
─────────────────────────────────────────────────────────────────────
Leads, Deals    Chat-UI              Reports (real)        Multi-Tenancy
Scoring         E-Mail-Sync          Settings (real)       Audit-Log
Auth + 2FA      LinkedIn             Campaign-Tracking    Webhooks
Moco, Slack     MessageService ✅    Erweiterte Auto
AWS Deploy      DB-Schema ✅
```

---

## Technische Architektur

### Stack

| Komponente | Technologie |
|------------|-------------|
| Runtime | Node.js 20+ |
| Backend | Fastify |
| Datenbank | PostgreSQL 15+ |
| Queue | Redis + BullMQ |
| Frontend | React Admin, MUI |
| Sprache | TypeScript (strict) |
| Validierung | Zod |
| Migrationen | node-pg-migrate |

### Projektstruktur (Backend)

```
src/
├── api/           # API-Layer
│   ├── routes/    # Events, Leads, Deals, Pipelines, Auth, etc.
│   ├── middleware/
│   └── schemas/
├── services/      # Business-Logik
│   ├── leadService, dealService, pipelineService
│   ├── scoringEngine, intentDetector, pipelineRouter
│   ├── automationEngine, messageService
│   └── ...
├── workers/       # BullMQ-Worker
│   ├── eventWorker, routingWorker, syncWorker
│   ├── decayWorker, emailSequenceWorker, dailyDigestWorker
│   └── index.ts
├── integrations/  # Moco, Slack, Cituro
├── db/            # Connection, Seeds
├── config/        # Zod-validierte Konfiguration
└── utils/         # Crypto, etc.
```

### Projektstruktur (Frontend)

```
frontend/src/
├── components/    # Layout, Dashboard, Kanban
├── resources/     # Leads, Deals, Tasks, Organizations, Pipelines
├── pages/         # Reports, Settings, LeadScoring, EmailMarketing, Auth
├── providers/     # dataProvider, authProvider
└── theme/
```

### Wichtige Umgebungsvariablen

| Variable | Beschreibung | Pflicht |
|----------|--------------|---------|
| `DATABASE_URL` | PostgreSQL Connection String | Ja |
| `REDIS_URL` | Redis Connection String | Ja |
| `JWT_SECRET` | JWT-Signing (min. 32 Zeichen) | Ja |
| `WEBHOOK_SECRET` | HMAC Webhook (min. 16 Zeichen) | Ja |
| `MOCO_API_KEY`, `MOCO_SUBDOMAIN` | Moco-Integration | Nein |
| `SLACK_WEBHOOK_URL` | Slack-Benachrichtigungen | Nein |
| `CORS_ORIGIN` | Erlaubte Origins (Produktion) | Nein |

---

## API-Übersicht (MVP)

### Health
- `GET /health` — DB + Redis Status
- `GET /ready` — Readiness Probe

### Auth
- `POST /api/v1/auth/register`
- `POST /api/v1/auth/login`
- `POST /api/v1/auth/2fa/setup`
- `POST /api/v1/auth/2fa/verify`

### Leads
- `GET/POST/PATCH/DELETE /api/v1/leads`
- `GET /api/v1/leads/:id/events`, `.../scores`, `.../intents`
- `POST /api/v1/leads/:id/route`

### Deals
- `GET/POST/PATCH /api/v1/deals`
- `POST /api/v1/deals/:id/move`, `.../close`

### Pipelines, Tasks, Organizations, Events
- Vollständige CRUD-Endpoints (siehe README.md)

### Scoring & Routing
- `GET/POST /api/v1/scoring/rules`
- `GET /api/v1/routing/config`
- `POST /api/v1/routing/evaluate/:leadId`

### Integrations
- `GET /api/v1/integrations/moco/status`
- `POST /api/v1/integrations/moco/sync/:leadId`

---

## Benutzerhandbuch

- **[BENUTZERHANDBUCH.md](./BENUTZERHANDBUCH.md)** — Ausführliche Anleitung für Endnutzer: Rollen, Registrierung, Organisationen, Leads/Kunden, Kartenansicht (Chat-Button, Notizen), Tasks, Pipelines, Chats, Deals (Liste & Kanban), Automatisierungen, E-Mail-Marketing, empfohlene Screenshots.

## Lizenz & Support

- **Lizenz:** Privat — Alle Rechte vorbehalten
- **Support:** Entwicklungsteam kontaktieren

---

*Erstellt für DNA ME — Built with ❤️*
