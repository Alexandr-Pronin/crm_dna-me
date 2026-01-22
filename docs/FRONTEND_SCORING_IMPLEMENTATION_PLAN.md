# 🎯 Frontend Scoring & Event System - Implementierungsplan

## 📊 Status-Analyse

### ✅ Backend ist VOLLSTÄNDIG implementiert

Das Backend hat alle notwendigen Funktionen:

1. **Scoring Engine** (`src/services/scoringEngine.ts`)
   - ✅ Event-basiertes Scoring
   - ✅ Profil-basiertes Scoring (Demographic)
   - ✅ Score History Tracking
   - ✅ Score Decay System
   - ✅ Threshold Triggers (Hot Lead Alerts)

2. **Event Worker** (`src/workers/eventWorker.ts`)
   - ✅ Event Processing Queue (BullMQ)
   - ✅ Automatisches Lead Finding/Creation
   - ✅ Scoring Integration
   - ✅ Intent Detection Integration
   - ✅ Automation Rules Integration
   - ✅ Routing Queue Integration

3. **API Endpoints** (vollständig vorhanden)
   - ✅ `GET /api/v1/scoring/rules` - Liste aller Scoring Rules
   - ✅ `POST /api/v1/scoring/rules` - Neue Rule erstellen
   - ✅ `PATCH /api/v1/scoring/rules/:id` - Rule bearbeiten
   - ✅ `DELETE /api/v1/scoring/rules/:id` - Rule löschen
   - ✅ `GET /api/v1/scoring/rules/:id` - Einzelne Rule mit Stats
   - ✅ `GET /api/v1/scoring/thresholds` - Score Thresholds Config
   - ✅ `GET /api/v1/scoring/leads/:leadId/history` - Score History
   - ✅ `GET /api/v1/scoring/leads/:leadId/breakdown` - Score Breakdown
   - ✅ `POST /api/v1/scoring/leads/:leadId/recalculate` - Scores neu berechnen
   - ✅ `GET /api/v1/scoring/stats` - Scoring Statistiken
   - ✅ `GET /api/v1/leads/:id/events` - Lead Event Timeline
   - ✅ `GET /api/v1/leads/:id/intents` - Intent Signals

### ❌ Frontend fehlt fast alles

**Was bereits existiert:**
- ✅ Basis Lead List (`LeadList.jsx`)
- ✅ Basis Lead Show (`LeadShow.jsx`)
- ✅ ScoreBadge Komponente (zeigt nur Score, keine Details)
- ✅ Statische Scoring Constants (`constants/scoring.js`)
- ✅ DataProvider mit einigen Custom-Methoden

**Was komplett fehlt:**
- ❌ Scoring Rules Management Page
- ❌ Score History Timeline in LeadShow
- ❌ Event Timeline in LeadShow
- ❌ Detaillierte Score Breakdown Ansicht
- ❌ Recalculate Score Button
- ❌ Scoring Statistics Dashboard
- ❌ Event Ingestion UI (optional, für Testing)

---

## 🚀 Implementierungsplan

### Phase 1: Score History & Timeline (PRIORITÄT 1)

**Ziel:** LeadShow erweitern mit vollständiger Score- und Event-Historie

#### 1.1 DataProvider erweitern
**Datei:** `frontend/src/providers/dataProvider.js`

```javascript
// Hinzufügen:
export const getScoreHistory = async (leadId) => {
  const { json } = await httpClient(`${API_URL}/scoring/leads/${leadId}/history`);
  return json.data || json;
};

export const getScoreBreakdown = async (leadId) => {
  const { json } = await httpClient(`${API_URL}/scoring/leads/${leadId}/breakdown`);
  return json;
};

export const recalculateLeadScores = async (leadId) => {
  const { json } = await httpClient(`${API_URL}/scoring/leads/${leadId}/recalculate`, {
    method: 'POST',
  });
  return json;
};

export const getLeadEvents = async (leadId, params = {}) => {
  const query = stringify(params);
  const { json } = await httpClient(`${API_URL}/leads/${leadId}/events?${query}`);
  return json.data || json;
};
```

#### 1.2 Score History Komponente erstellen
**Datei:** `frontend/src/resources/leads/components/ScoreHistory.jsx`

**Features:**
- Timeline mit allen Score-Änderungen
- Zeigt: Datum, Rule Name, Punkte, Kategorie, Event (falls vorhanden)
- Filter nach Kategorie (demographic/engagement/behavior)
- Sortierung nach Datum (neueste zuerst)

#### 1.3 Event Timeline Komponente erstellen
**Datei:** `frontend/src/resources/leads/components/EventTimeline.jsx`

**Features:**
- Chronologische Liste aller Events
- Zeigt: Event Type, Source, Datum, Metadata
- Icons für verschiedene Event-Typen
- Link zu Score History wenn Event Scoring ausgelöst hat

#### 1.4 LeadShow erweitern
**Datei:** `frontend/src/resources/leads/LeadShow.jsx`

**Änderungen:**
- Tabs hinzufügen: Overview | Score History | Events | Deals
- Score Breakdown Card erweitern mit:
  - Button "Recalculate Scores"
  - Link zu Score History
  - Expired Points Anzeige
- Score History Tab mit ScoreHistory Komponente
- Events Tab mit EventTimeline Komponente

**Geschätzte Zeit:** 4-6 Stunden

---

### Phase 2: Scoring Rules Management (PRIORITÄT 2)

**Ziel:** Vollständige UI zum Verwalten von Scoring Rules

#### 2.1 DataProvider erweitern
**Datei:** `frontend/src/providers/dataProvider.js`

```javascript
// Hinzufügen:
export const getScoringRules = async (params = {}) => {
  const query = stringify(params);
  const { json } = await httpClient(`${API_URL}/scoring/rules?${query}`);
  return json;
};

export const getScoringRule = async (ruleId) => {
  const { json } = await httpClient(`${API_URL}/scoring/rules/${ruleId}`);
  return json;
};

export const createScoringRule = async (ruleData) => {
  const { json } = await httpClient(`${API_URL}/scoring/rules`, {
    method: 'POST',
    body: JSON.stringify(ruleData),
  });
  return json;
};

export const updateScoringRule = async (ruleId, ruleData) => {
  const { json } = await httpClient(`${API_URL}/scoring/rules/${ruleId}`, {
    method: 'PATCH',
    body: JSON.stringify(ruleData),
  });
  return json;
};

export const deleteScoringRule = async (ruleId) => {
  await httpClient(`${API_URL}/scoring/rules/${ruleId}`, {
    method: 'DELETE',
  });
  return { id: ruleId };
};

export const getScoringThresholds = async () => {
  const { json } = await httpClient(`${API_URL}/scoring/thresholds`);
  return json;
};

export const getScoringStats = async () => {
  const { json } = await httpClient(`${API_URL}/scoring/stats`);
  return json;
};
```

#### 2.2 Scoring Rules List Page
**Datei:** `frontend/src/pages/LeadScoring/index.jsx`

**Features:**
- Tabelle mit allen Scoring Rules
- Spalten: Name, Kategorie, Rule Type, Points, Limits, Status, Actions
- Filter nach Kategorie, Status, Rule Type
- Sortierung
- Bulk Actions: Enable/Disable, Delete

#### 2.3 Scoring Rule Editor
**Datei:** `frontend/src/pages/LeadScoring/RuleEditor.jsx`

**Features:**
- Formular zum Erstellen/Bearbeiten von Rules
- Felder:
  - Slug (read-only bei Edit)
  - Name
  - Description
  - Rule Type (Event/Field/Threshold)
  - Category (Demographic/Engagement/Behavior)
  - Conditions (dynamisch je nach Rule Type)
  - Points
  - Max per Day
  - Max per Lead
  - Decay Days
  - Priority
  - Is Active
- Validierung
- Preview der Rule Logic

#### 2.4 Scoring Thresholds Config
**Datei:** `frontend/src/pages/LeadScoring/ThresholdsConfig.jsx`

**Features:**
- Anzeige der aktuellen Thresholds (Cold/Warm/Hot/Very Hot)
- Visualisierung mit Farben
- Info: Thresholds sind im Backend konfiguriert (nur Anzeige)

#### 2.5 Scoring Statistics Dashboard
**Datei:** `frontend/src/pages/LeadScoring/ScoringStats.jsx`

**Features:**
- KPI Cards:
  - Total Rules
  - Active Rules
  - Total Points Awarded
  - Expired Points
- Lead Score Distribution Chart (Pie Chart)
- Top Performing Rules Table (letzte 30 Tage)
- Rules by Category Breakdown

**Geschätzte Zeit:** 8-10 Stunden

---

### Phase 3: Score Breakdown Detail View (PRIORITÄT 3)

**Ziel:** Detaillierte Score-Analyse für einzelne Leads

#### 3.1 Score Breakdown Detail Komponente
**Datei:** `frontend/src/resources/leads/components/ScoreBreakdownDetail.jsx`

**Features:**
- Detaillierte Aufschlüsselung nach Kategorie
- Zeigt alle angewendeten Rules mit:
  - Rule Name
  - Punkte
  - Datum der Anwendung
  - Anzahl der Anwendungen
  - Expiration Status
- Visualisierung mit Progress Bars
- Filter nach Kategorie
- Sortierung

#### 3.2 LeadShow Integration
**Datei:** `frontend/src/resources/leads/LeadShow.jsx`

**Änderungen:**
- Score Breakdown Card erweitern
- Modal/Drawer für detaillierte Breakdown Ansicht
- Link von Score Breakdown Card

**Geschätzte Zeit:** 3-4 Stunden

---

### Phase 4: Event Ingestion UI (OPTIONAL)

**Ziel:** UI zum manuellen Testen der Event Ingestion

#### 4.1 Event Ingestion Form
**Datei:** `frontend/src/pages/Events/IngestEvent.jsx`

**Features:**
- Formular zum Erstellen von Test-Events
- Felder:
  - Event Type (Dropdown)
  - Source (Dropdown)
  - Lead Identifier (Email/Portal ID/etc.)
  - Metadata (JSON Editor)
  - Occurred At (Date/Time)
- Submit Button
- Response Anzeige (Event ID, Status)

**Geschätzte Zeit:** 2-3 Stunden

---

## 📋 Detaillierte Task-Liste

### Task 1: DataProvider erweitern
- [ ] Score History Methoden hinzufügen
- [ ] Scoring Rules CRUD Methoden hinzufügen
- [ ] Scoring Stats Methoden hinzufügen
- [ ] Event Timeline Methoden hinzufügen

### Task 2: Score History Komponente
- [ ] ScoreHistory.jsx erstellen
- [ ] Timeline UI mit Material-UI
- [ ] Filter nach Kategorie
- [ ] Integration in LeadShow

### Task 3: Event Timeline Komponente
- [ ] EventTimeline.jsx erstellen
- [ ] Event Icons Mapping
- [ ] Metadata Display
- [ ] Integration in LeadShow

### Task 4: LeadShow erweitern
- [ ] Tabs hinzufügen (Overview | Score History | Events | Deals)
- [ ] Score Breakdown Card erweitern
- [ ] Recalculate Button hinzufügen
- [ ] Score History Tab
- [ ] Events Tab

### Task 5: Scoring Rules List
- [ ] ScoringRulesList.jsx erstellen
- [ ] DataGrid mit allen Rules
- [ ] Filter und Sortierung
- [ ] Bulk Actions

### Task 6: Scoring Rule Editor
- [ ] RuleEditor.jsx erstellen
- [ ] Formular mit allen Feldern
- [ ] Dynamische Conditions UI
- [ ] Validierung
- [ ] Create/Edit Logic

### Task 7: Scoring Thresholds Config
- [ ] ThresholdsConfig.jsx erstellen
- [ ] Visualisierung der Thresholds
- [ ] Info über Backend-Konfiguration

### Task 8: Scoring Statistics
- [ ] ScoringStats.jsx erstellen
- [ ] KPI Cards
- [ ] Charts (Recharts)
- [ ] Top Rules Table

### Task 9: Score Breakdown Detail
- [ ] ScoreBreakdownDetail.jsx erstellen
- [ ] Detaillierte Rule-Liste
- [ ] Visualisierung
- [ ] Integration in LeadShow

### Task 10: Routing & Navigation
- [ ] LeadScoring Route hinzufügen
- [ ] Menu Item hinzufügen
- [ ] Breadcrumbs

---

## 🎨 UI/UX Spezifikationen

### Score History Timeline
- Material-UI Timeline Component
- Farbcodierung nach Kategorie:
  - Demographic: Teal (#4A90A4)
  - Engagement: Purple (#6C5CE7)
  - Behavior: Green (#28A745)
- Icons für verschiedene Rule Types
- Tooltip mit Details

### Event Timeline
- Chronologische Liste
- Event Type Badges
- Source Badges
- Expandable Metadata
- Link zu Score History wenn relevant

### Scoring Rules Table
- Sortierbare Spalten
- Status Badges (Active/Inactive)
- Category Badges
- Action Buttons (Edit/Delete/Enable/Disable)
- Bulk Selection

### Rule Editor Form
- Stepped Form für komplexe Rules
- JSON Editor für Conditions
- Preview Section
- Validation Messages

---

## 🔧 Technische Details

### API Response Formate

**Score History:**
```json
{
  "data": [
    {
      "id": "uuid",
      "lead_id": "uuid",
      "event_id": "uuid",
      "rule_id": "uuid",
      "rule_slug": "page_visited",
      "rule_name": "Page Visited",
      "category": "engagement",
      "points_change": 2,
      "new_total": 15,
      "expires_at": "2026-02-21T12:00:00Z",
      "expired": false,
      "created_at": "2026-01-21T12:00:00Z"
    }
  ]
}
```

**Score Breakdown:**
```json
{
  "lead_id": "uuid",
  "email": "lead@example.com",
  "demographic": 20,
  "engagement": 35,
  "behavior": 10,
  "total": 65,
  "score_tier": "warm",
  "history_count": 15,
  "expired_points": 5
}
```

**Scoring Rules:**
```json
{
  "data": [
    {
      "id": "uuid",
      "slug": "page_visited",
      "name": "Page Visited",
      "description": "Award points for page visits",
      "rule_type": "event",
      "category": "engagement",
      "conditions": {
        "event_type": "page_view"
      },
      "points": 2,
      "max_per_day": 10,
      "max_per_lead": null,
      "decay_days": 30,
      "priority": 100,
      "is_active": true,
      "created_at": "2026-01-01T00:00:00Z",
      "updated_at": "2026-01-01T00:00:00Z",
      "stats": {
        "total_applications": 1250,
        "unique_leads": 450,
        "total_points": 2500
      }
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 25,
    "total_pages": 2
  }
}
```

---

## 📊 Priorisierung

### 🔴 KRITISCH (sofort implementieren)
1. Score History Timeline in LeadShow
2. Event Timeline in LeadShow
3. Recalculate Score Button
4. Score Breakdown Detail View

### 🟡 WICHTIG (nächste Woche)
5. Scoring Rules Management Page
6. Scoring Rule Editor
7. Scoring Statistics Dashboard

### 🟢 OPTIONAL (später)
8. Event Ingestion UI
9. Advanced Filtering
10. Export Functionality

---

## ✅ Erfolgskriterien

- [ ] LeadShow zeigt vollständige Score History
- [ ] LeadShow zeigt vollständige Event Timeline
- [ ] User kann Scores manuell neu berechnen
- [ ] User kann Scoring Rules verwalten (CRUD)
- [ ] User sieht Scoring Statistiken
- [ ] Alle API-Endpoints sind integriert
- [ ] UI ist responsive und benutzerfreundlich

---

## 🚀 Nächste Schritte

1. **Sofort starten:** Phase 1 (Score History & Timeline)
2. **Diese Woche:** Phase 2 (Scoring Rules Management)
3. **Nächste Woche:** Phase 3 (Score Breakdown Detail)
4. **Optional:** Phase 4 (Event Ingestion UI)

---

**Geschätzte Gesamtzeit:** 17-23 Stunden

**Empfohlener Start:** Phase 1, Task 1 (DataProvider erweitern)
