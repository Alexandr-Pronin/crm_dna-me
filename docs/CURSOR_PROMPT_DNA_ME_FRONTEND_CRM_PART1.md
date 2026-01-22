# DNA ME CRM Dashboard - Cursor Agent Prompt (Part 1 of 2)

## 🎯 PROJECT OVERVIEW & BUSINESS CONTEXT

You are building a comprehensive **CRM Admin Dashboard** for **DNA ME**, a GPU-accelerated genomic sequencing startup. This is a React-based administrative interface for managing multi-pipeline B2B sales, lead scoring, and marketing automation.

### Company Context
- **Business:** B2B genomic sequencing services (16S Microbiome, Metagenomics, Whole Genome)
- **Target Market:** Research labs, biotech companies, universities (Germany/EU focus)
- **Stage:** Pre-launch startup with aggressive go-to-market strategy
- **Tech Stack:** React/Next.js Portal, Node.js Backend, PostgreSQL, Make.com (automation)
- **Price Points:** €75-150 per sample (Research), €50-80 per sample (B2B volume)

---

## 🏗️ ARCHITECTURE OVERVIEW

### Data Sovereignty Pattern (CRITICAL - READ CAREFULLY)
DNA ME uses **Domain-Driven Data Sovereignty** - there is NO single master system. Each system owns its domain:

| Domain | Master System | Slave Systems | Notes |
|--------|---------------|---------------|-------|
| Customer Registration | **PORTAL** | HubSpot, Moco | User registers via Portal UI |
| Orders | **PORTAL** | HubSpot (Deals) | Portal generates order_id |
| Payment (Card) | **STRIPE** | Portal DB, Moco | Stripe is authoritative for card payments |
| Payment (Invoice) | **MOCO** | Portal DB | Moco handles bank transfers (Testatfähigkeit) |
| Sample Tracking | **LAB SYSTEM** | Portal DB | Lab physically processes samples |
| Analysis Results | **LAB SYSTEM** | Portal DB | Lab generates analysis results |
| CRM Data (Deals, Tasks) | **HUBSPOT** | Portal (read-only) | HubSpot manages sales pipeline |
| Financial Audit | **MOCO** | All systems | Moco is the only legally compliant system for German tax |

### Webhook Flow Architecture
```
┌─────────────────────────────────────────────────────────────────┐
│                      WEBHOOK & API FLOWS                         │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  OUTBOUND WEBHOOKS (Portal → Make.com):                         │
│  ┌──────────┐                    ┌──────────┐                   │
│  │  Portal  │ ─── Webhooks ────> │ Make.com │                   │
│  └──────────┘                    └──────────┘                   │
│      │                                 │                         │
│      │ 1. USER_REGISTRATION_COMPLETED  │                         │
│      │ 2. LEAD_ROI_CALCULATED          │                         │
│      │ 3. ORDER_PLACED                 │                         │
│      │ 4. SAMPLES_REGISTERED           │                         │
│      │ 5. SAMPLES_SHIPPED              │                         │
│      │ 6. ORDER_CANCELLED              │                         │
│                                                                  │
│  INBOUND API (Backend → Portal):                                │
│  ┌──────────┐                    ┌──────────┐                   │
│  │  Backend │ ─── REST API ────> │  Portal  │                   │
│  └──────────┘                    └──────────┘                   │
│      │                                 │                         │
│      │ PUT /api/v1/orders/{id}/status  │                         │
│      │ POST /api/v1/orders/{id}/results │                        │
│      │ POST /api/v1/samples/{id}/qc-results │                    │
│      │ POST /api/v1/notifications      │                         │
│                                                                  │
│  EXTERNAL WEBHOOKS:                                             │
│  ┌────────┐         ┌──────────┐         ┌──────────┐          │
│  │ Stripe │────────>│  Portal  │         │  Konto   │          │
│  └────────┘         └──────────┘         └──────────┘          │
│      │ payment_intent.succeeded          │ payment_received     │
│      │ payment_intent.failed             │                      │
│      │ invoice.paid                      │                      │
└─────────────────────────────────────────────────────────────────┘
```

---

## 📦 THREE PRODUCT PIPELINES

### Pipeline 1: Research Lab Services (Transactional)
- **Target:** Academic researchers, PhD students
- **Order Size:** 24-96 samples, one-time purchase
- **Sales Cycle:** 7-14 days (fast decision)
- **Price:** €75-120 per sample

**Stages:**
1. `awareness` - Sees content, cold
2. `interest` - Downloads whitepaper, uses ROI calculator
3. `consideration` - Requests demo, asks technical questions
4. `decision` - Receives quote, reviews sample report
5. `purchase` - Places first order
6. `won` - Order completed, becomes customer

### Pipeline 2: B2B Lab Enablement (Subscription)
- **Target:** Biotech companies, CROs (Contract Research Organizations)
- **Order Size:** 500-2000 samples/month, ongoing subscription
- **Sales Cycle:** 30-60 days (procurement process)
- **Price:** €50-80 per sample (volume discount)

**Stages:**
1. `awareness` - Conference, referral
2. `qualification` (MQL) - Fills "Enterprise Inquiry" form
3. `discovery` (SQL) - Initial sales call, assess BANT
4. `technical_validation` - Pilot project (50 samples)
5. `commercial_negotiation` - Pricing, SLA, contract terms
6. `contract_sent` - MSA sent for signature
7. `won` - Contract signed, active subscription

### Pipeline 3: Panel Co-Creation (White-Label Partnership)
- **Target:** Regional labs wanting to offer sequencing without owning equipment
- **Deal Type:** Revenue share agreement (50/50 split)
- **Sales Cycle:** 90-180 days (complex partnership)
- **Revenue Model:** % of partner's sales

**Stages:**
1. `awareness` - Targeted outreach
2. `qualification` - Lab has existing customer base
3. `partnership_discussion` - Explore white-label model
4. `due_diligence` - Assess lab capacity, financial health
5. `pilot_partnership` - 3-month trial with 5 customers
6. `contract_negotiation` - Revenue share %, branding, SLA
7. `won` - Partnership agreement signed

---

## 🎯 LEAD SCORING SYSTEM

### Scoring Model (200 Points Total)

**Demographic Fit (0-40 points):**
```javascript
const demographicRules = [
  { id: 'industry_biotech', condition: 'industry === "biotech" || industry === "pharma"', points: 20 },
  { id: 'company_size', condition: 'employee_count >= 50 && employee_count <= 500', points: 10 },
  { id: 'job_title_decision_maker', condition: 'title.includes("Director") || title.includes("Manager")', points: 10 },
];
```

**Engagement Score (0-60 points):**
```javascript
const engagementRules = [
  { id: 'website_visit', event: 'page_view', points: 2 },
  { id: 'pricing_page', event: 'page_view', condition: 'page === "/pricing"', points: 5 },
  { id: 'roi_calculator', event: 'roi_calculator_submitted', points: 15 },
  { id: 'whitepaper_download', event: 'document_downloaded', points: 10 },
  { id: 'demo_request', event: 'demo_requested', points: 20 },
  { id: 'linkedin_profile_view', event: 'linkedin_profile_viewed', points: 3 },
  { id: 'linkedin_post_like', event: 'linkedin_post_liked', points: 2 },
  { id: 'linkedin_post_comment', event: 'linkedin_post_commented', points: 5 },
  { id: 'email_opened', event: 'email_opened', points: 1 },
  { id: 'email_clicked', event: 'email_clicked', points: 3 },
  { id: 'email_replied', event: 'email_replied', points: 10 },
];
```

**Behavior Score (0-100 points):**
```javascript
const behaviorRules = [
  { id: 'multiple_visits', condition: 'visits_7_days >= 3', points: 10 },
  { id: 'pricing_and_case_study', condition: 'viewed_pricing && viewed_case_study', points: 15 },
  { id: 'linkedin_engagement', condition: 'linkedin_interactions >= 3', points: 10 },
  { id: 'cold_email_reply', condition: 'replied_to_cold_email', points: 20 },
  { id: 'webinar_attended', event: 'webinar_attended', points: 15 },
  { id: 'sample_report_requested', event: 'sample_report_requested', points: 20 },
  { id: 'order_placed', event: 'order_placed', points: 100 }, // Auto-convert to customer
];
```

### Score Thresholds
```javascript
const SCORE_THRESHOLDS = {
  COLD: { min: 0, max: 40, label: 'Cold', color: '#64748B', action: 'Nurture with content' },
  WARM: { min: 41, max: 80, label: 'Warm', color: '#F59E0B', action: 'BDR outreach' },
  HOT: { min: 81, max: 120, label: 'Hot', color: '#EF4444', action: 'AE demo call' },
  VERY_HOT: { min: 121, max: 999, label: 'Very Hot', color: '#DC2626', action: 'AE immediate contact' },
};
```

### Score Decay
- Points expire after 30 days of no activity
- Decay rate: 10% per week after 14 days of inactivity
- Reset on any new engagement

---

## 🔌 API SPECIFICATION

### Base Configuration
```javascript
const API_CONFIG = {
  BASE_URL: process.env.REACT_APP_API_URL || 'https://api.dna-me.net/v1',
  TIMEOUT: 30000,
  RETRY_ATTEMPTS: 3,
  RETRY_DELAY: 1000,
};
```

### Authentication
- **Method:** JWT Bearer Token
- **Storage:** localStorage (auth_token)
- **Refresh:** Token refresh endpoint available
- **Headers Required:**
  - `Authorization: Bearer {token}`
  - `X-Correlation-ID: {uuid}` (for tracing)
  - `Content-Type: application/json`

### Role-Based Access Control (RBAC)
```javascript
const ROLES = {
  ADMIN: {
    name: 'admin',
    permissions: ['*'], // Full access
  },
  SALES_MANAGER: {
    name: 'sales_manager',
    permissions: ['leads.*', 'deals.*', 'contacts.*', 'companies.*', 'reports.*', 'users.read', 'analytics.*'],
  },
  SALES_REP: {
    name: 'sales_rep',
    permissions: ['leads.read', 'leads.update', 'deals.*', 'contacts.*', 'companies.read', 'events.read'],
  },
  MARKETING: {
    name: 'marketing',
    permissions: ['leads.*', 'campaigns.*', 'analytics.*', 'automations.*', 'events.*'],
  },
  LAB_TECHNICIAN: {
    name: 'lab_technician',
    permissions: ['orders.read', 'samples.*', 'webhooks.read'],
  },
  VIEWER: {
    name: 'viewer',
    permissions: ['*.read'],
  },
};
```

### REST API Endpoints

#### Standard CRUD Resources
All resources follow React Admin data provider pattern:
- `GET /{resource}` - List with pagination, sorting, filtering
- `GET /{resource}/{id}` - Single record
- `POST /{resource}` - Create
- `PUT /{resource}/{id}` - Update
- `DELETE /{resource}/{id}` - Delete

**Resources:**
- `/leads`
- `/deals`
- `/contacts`
- `/companies`
- `/orders`
- `/samples`
- `/pipelines`
- `/campaigns`
- `/automations`
- `/events`
- `/webhooks`
- `/webhook-logs`
- `/integrations`
- `/users`
- `/reports`

#### Custom Endpoints
```javascript
// Lead operations
POST /leads/{id}/recalculate-score
POST /leads/{id}/assign
GET /leads/{id}/timeline
POST /leads/bulk-assign
POST /leads/bulk-tag

// Deal operations
PUT /deals/{id}/stage
POST /deals/{id}/move-pipeline

// Integration sync
POST /integrations/hubspot/sync
POST /integrations/moco/sync-order

// Automation
POST /automations/{id}/trigger

// Webhooks
POST /webhooks/{id}/test
POST /webhook-logs/{id}/retry

// Analytics
GET /analytics
GET /analytics/funnel
GET /analytics/attribution
GET /pipelines/{id}/metrics

// Import/Export
POST /{resource}/import
GET /{resource}/export
```

---

## 🎨 DESIGN SYSTEM

### Theme Configuration
```javascript
const THEME = {
  palette: {
    mode: 'dark',
    primary: { main: '#4A90A4' },      // Teal - Biotech primary
    secondary: { main: '#6C5CE7' },    // Purple - Accent
    success: { main: '#28A745' },
    warning: { main: '#F59E0B' },
    error: { main: '#DC3545' },
    background: {
      default: '#0a0a0f',
      paper: '#12121a',
    },
    text: {
      primary: '#e0e0e0',
      secondary: '#a0a0a0',
    },
  },
  typography: {
    fontFamily: '"IBM Plex Sans", "Roboto", "Helvetica", sans-serif',
    h1: { fontWeight: 300 },
    h4: { fontWeight: 300 },
  },
};
```

### Pipeline Colors
```javascript
const PIPELINE_COLORS = {
  'research-lab': {
    primary: '#4A90A4',
    secondary: '#357A8A',
    gradient: 'linear-gradient(135deg, #4A90A4 0%, #357A8A 100%)',
    label: 'Research Lab',
  },
  'b2b-lab': {
    primary: '#6C5CE7',
    secondary: '#5849C4',
    gradient: 'linear-gradient(135deg, #6C5CE7 0%, #5849C4 100%)',
    label: 'B2B Lab Enablement',
  },
  'co-creation': {
    primary: '#28A745',
    secondary: '#1E7E34',
    gradient: 'linear-gradient(135deg, #28A745 0%, #1E7E34 100%)',
    label: 'Panel Co-Creation',
  },
};
```

### Score Display Colors
```javascript
const SCORE_COLORS = {
  cold: { bg: '#64748B20', text: '#64748B', border: '#64748B40' },
  warm: { bg: '#F59E0B20', text: '#F59E0B', border: '#F59E0B40' },
  hot: { bg: '#EF444420', text: '#EF4444', border: '#EF444440' },
  veryHot: { bg: '#DC262620', text: '#DC2626', border: '#DC262640' },
};
```

---

## 📁 PROJECT STRUCTURE

```
dna-me-admin/
├── public/
│   └── dna-icon.svg
├── src/
│   ├── App.jsx                      # Main application with React Admin
│   ├── main.jsx                     # Entry point
│   ├── index.css                    # Global styles
│   │
│   ├── theme/
│   │   ├── index.js                 # MUI theme export
│   │   ├── palette.js               # Color palette
│   │   ├── typography.js            # Typography settings
│   │   └── components.js            # Component overrides
│   │
│   ├── providers/
│   │   ├── dataProvider.js          # React Admin data provider
│   │   ├── authProvider.js          # Authentication provider
│   │   └── i18nProvider.js          # Internationalization (EN/DE)
│   │
│   ├── components/
│   │   ├── Dashboard/
│   │   │   ├── index.jsx            # Main dashboard
│   │   │   ├── KPICard.jsx          # KPI metric cards
│   │   │   ├── PipelineFunnel.jsx   # Pipeline visualization
│   │   │   ├── HotLeadsList.jsx     # Hot leads quick view
│   │   │   ├── ActivityFeed.jsx     # Recent activity stream
│   │   │   └── Charts/              # Dashboard charts
│   │   │
│   │   ├── common/
│   │   │   ├── ScoreBadge.jsx       # Lead score display
│   │   │   ├── PipelineChip.jsx     # Pipeline indicator
│   │   │   ├── StatusBadge.jsx      # Generic status badge
│   │   │   ├── TimelineEvent.jsx    # Activity timeline item
│   │   │   ├── LoadingOverlay.jsx   # Loading states
│   │   │   └── ErrorBoundary.jsx    # Error handling
│   │   │
│   │   └── layout/
│   │       ├── AppBar.jsx           # Custom app bar
│   │       ├── Menu.jsx             # Sidebar menu
│   │       └── Layout.jsx           # Main layout wrapper
│   │
│   ├── resources/
│   │   ├── leads/
│   │   │   ├── index.jsx            # LeadList, LeadEdit
│   │   │   ├── LeadCreate.jsx       # Lead creation form
│   │   │   ├── LeadShow.jsx         # Lead detail view
│   │   │   └── components/
│   │   │       ├── LeadScoreCard.jsx
│   │   │       ├── LeadTimeline.jsx
│   │   │       └── LeadQuickActions.jsx
│   │   │
│   │   ├── deals/
│   │   │   ├── index.jsx            # DealList with Kanban
│   │   │   ├── DealCreate.jsx
│   │   │   ├── DealShow.jsx
│   │   │   ├── DealEdit.jsx
│   │   │   └── components/
│   │   │       ├── KanbanBoard.jsx  # Drag-drop kanban
│   │   │       ├── DealCard.jsx     # Kanban card
│   │   │       └── StageSelector.jsx
│   │   │
│   │   ├── contacts/
│   │   │   ├── index.jsx
│   │   │   ├── ContactCreate.jsx
│   │   │   ├── ContactShow.jsx
│   │   │   └── ContactEdit.jsx
│   │   │
│   │   ├── companies/
│   │   │   ├── index.jsx
│   │   │   ├── CompanyCreate.jsx
│   │   │   ├── CompanyShow.jsx
│   │   │   └── CompanyEdit.jsx
│   │   │
│   │   ├── orders/
│   │   │   ├── index.jsx            # OrderList
│   │   │   ├── OrderShow.jsx        # Order details
│   │   │   └── components/
│   │   │       ├── OrderStatusStepper.jsx
│   │   │       └── SamplesList.jsx
│   │   │
│   │   ├── samples/
│   │   │   ├── index.jsx
│   │   │   ├── SampleShow.jsx
│   │   │   └── components/
│   │   │       ├── QCResults.jsx
│   │   │       └── SampleTimeline.jsx
│   │   │
│   │   ├── pipelines/
│   │   │   ├── index.jsx
│   │   │   ├── PipelineEdit.jsx
│   │   │   └── StageConfiguration.jsx
│   │   │
│   │   ├── campaigns/
│   │   │   ├── index.jsx
│   │   │   ├── CampaignCreate.jsx
│   │   │   ├── CampaignShow.jsx
│   │   │   └── components/
│   │   │       ├── CampaignMetrics.jsx
│   │   │       └── LeadsList.jsx
│   │   │
│   │   ├── automations/
│   │   │   ├── index.jsx
│   │   │   ├── AutomationCreate.jsx
│   │   │   └── components/
│   │   │       └── RuleBuilder.jsx
│   │   │
│   │   ├── events/
│   │   │   ├── index.jsx            # Event log (read-only)
│   │   │   └── EventShow.jsx
│   │   │
│   │   ├── webhooks/
│   │   │   ├── index.jsx
│   │   │   └── WebhookLogs.jsx
│   │   │
│   │   ├── integrations/
│   │   │   ├── index.jsx
│   │   │   ├── HubSpotSync.jsx
│   │   │   └── MocoSync.jsx
│   │   │
│   │   └── users/
│   │       ├── index.jsx
│   │       ├── UserCreate.jsx
│   │       └── UserEdit.jsx
│   │
│   ├── pages/
│   │   ├── Analytics/
│   │   │   ├── index.jsx            # Main analytics page
│   │   │   ├── FunnelAnalytics.jsx  # Conversion funnels
│   │   │   ├── SourceAnalytics.jsx  # Lead sources
│   │   │   └── CampaignROI.jsx      # Campaign performance
│   │   │
│   │   ├── LeadScoring/
│   │   │   ├── index.jsx            # Scoring configuration
│   │   │   ├── RuleEditor.jsx       # Edit scoring rules
│   │   │   └── ScoreSimulator.jsx   # Test scoring
│   │   │
│   │   ├── WebhookMonitor/
│   │   │   ├── index.jsx            # Real-time webhook monitoring
│   │   │   ├── EndpointHealth.jsx
│   │   │   └── LogViewer.jsx
│   │   │
│   │   ├── JourneyBuilder/
│   │   │   └── index.jsx            # Visual automation builder (future)
│   │   │
│   │   └── Settings/
│   │       ├── index.jsx
│   │       ├── GeneralSettings.jsx
│   │       ├── NotificationSettings.jsx
│   │       └── IntegrationSettings.jsx
│   │
│   ├── hooks/
│   │   ├── useLeadScore.js          # Lead scoring calculations
│   │   ├── useTimeline.js           # Activity timeline
│   │   ├── usePipelineMetrics.js    # Pipeline statistics
│   │   ├── useWebhookHealth.js      # Webhook monitoring
│   │   └── useRealTimeUpdates.js    # WebSocket updates
│   │
│   ├── utils/
│   │   ├── scoring.js               # Scoring utilities
│   │   ├── formatting.js            # Date, currency, etc.
│   │   ├── validation.js            # Form validation
│   │   └── api.js                   # API helpers
│   │
│   └── constants/
│       ├── pipelines.js             # Pipeline configurations
│       ├── scoring.js               # Scoring rules
│       └── permissions.js           # RBAC definitions
│
├── package.json
├── vite.config.js
├── .env.example
└── README.md
```

---

## ⚡ TECHNOLOGY RECOMMENDATIONS

### Core Framework Options

**Option A: React Admin (Recommended for MVP)**
```json
{
  "react-admin": "^4.16.0",
  "@mui/material": "^5.14.x",
  "recharts": "^2.10.x"
}
```
- Pros: Fast development, built-in CRUD, good for admin dashboards
- Cons: Opinionated structure, harder to customize deeply

**Option B: Next.js + Shadcn/ui (Recommended for Scale)**
```json
{
  "next": "^14.x",
  "@tanstack/react-query": "^5.x",
  "@tanstack/react-table": "^8.x",
  "shadcn/ui": "latest"
}
```
- Pros: More flexibility, better performance, modern patterns
- Cons: More setup, need to build more from scratch

**Option C: Refine.dev (Alternative)**
```json
{
  "@refinedev/core": "^4.x",
  "@refinedev/mui": "^5.x"
}
```
- Pros: Modern React Admin alternative, better TypeScript
- Cons: Smaller community

### Recommended Additional Libraries
```json
{
  "dependencies": {
    "date-fns": "^2.30.x",
    "@hello-pangea/dnd": "^16.x",
    "react-hook-form": "^7.x",
    "zod": "^3.x",
    "zustand": "^4.x",
    "@tanstack/react-virtual": "^3.x",
    "socket.io-client": "^4.x",
    "papaparse": "^5.x",
    "xlsx": "^0.18.x"
  }
}
```

---

# Continue to Part 2 for Implementation Details...
