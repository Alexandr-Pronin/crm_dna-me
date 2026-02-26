# DNA Marketing Engine — Kurzer Team-Guide

**Stand:** Februar 2026 | Für schnelle Orientierung und Team-Onboarding

---

## Was ist das?

**DNA Marketing Engine** ist eine CRM-Plattform für die Biotech-Branche mit Smart Routing, Lead-Scoring und Automatisierung. Sie verbindet Marketing-Events aus verschiedenen Kanälen, bewertet Leads und leitet sie in passende Sales-Pipelines.

---

## Was läuft bereits online?

| Bereich | Status | Kurzbeschreibung |
|---------|--------|------------------|
| **Leads** | ✅ Live | CRUD, Suche, Filter, Event-Timeline, Score, Intent-Signale, manuelles Routing |
| **Deals** | ✅ Live | Kanban-Board (Drag & Drop), Stages, Close (Won/Lost) |
| **Organizations** | ✅ Live | Firmen-Datenbank, Verknüpfung mit Leads |
| **Pipelines** | ✅ Live | Konfigurierbare Pipelines, Stages, Metriken |
| **Tasks** | ✅ Live | Aufgaben zu Deals/Leads zuordnen |
| **Auth** | ✅ Live | Login, 2FA, Rollen (Admin/User) |
| **Moco** | ✅ Live | Sync bei Deal-Won, Angebote, Rechnungen |
| **Slack** | ✅ Live | Hot-Lead-Alerts, Sales-Wins, Daily Digest |

---

## Pipelines & Automatisierung

- **Pipelines:** Deals können in Pipelines mit konfigurierbaren Stages verwaltet werden.
- **Automatisierung:** Stage-Bewegungen, Benachrichtigungen, Task-Erstellung per Trigger.
- **Rechnungen:** Bei Deal-Won → automatischer Sync mit Moco (Angebote, Rechnungen).
- **E-Mail-Marketing:** E-Mail-Sequenzen für Deals, Sequence Builder, Enrollment in Sequenzen.

---

## Datenbank: Kunden & Unternehmen

- **Leads** — Kontakte mit Event-Historie, Scoring, Intent.
- **Organizations** — Firmen mit Verknüpfung zu Leads.
- **Deals** — Verkaufschancen mit Pipeline-Stage und Moco-Sync.

---

## Heute im Fokus: Chat & Kommunikation

Geplant ist ein **Kommunikations-Service** pro Kunde/Lead mit:

- **E-Mail** — IMAP/SMTP-Sync (geplant), E-Mail-Sequenzen (bereits vorhanden).
- **LinkedIn** — Link zum Profil, direkte API-Integration.

### LinkedIn: Einschränkungen & Optionen

Die **LinkedIn Messaging API ist öffentlich nicht verfügbar.** Mögliche Wege:

| Option | Beschreibung |
|--------|--------------|
| **A) SNAP (Sales Navigator API)** | Erfordert Sales Navigator Lizenz + Partner-Vereinbarung mit LinkedIn |
| **B) Drittanbieter-Gateway** | z.B. **Unipile** (~99 €/Monat für 10 Accounts) — empfohlen für Messaging |
| **C) Manueller Fallback** | LinkedIn-Profil-URL speichern, Nutzer öffnet LinkedIn im Browser *(aktuell implementiert)* |

Der Code unterstützt alle drei Modi; für echtes Messaging per API ist SNAP oder ein Gateway nötig.

---

## Technik (Kurz)

- **Backend:** Node.js, Fastify, PostgreSQL, Redis, BullMQ
- **Frontend:** React Admin, MUI
- **Deployment:** AWS (CloudFormation, Docker, Nginx, SSL)

---

## Nächste Schritte (Roadmap)

1. **Chat-UI** — Panel für Konversationen pro Lead/Deal
2. **E-Mail-Sync** — IMAP/SMTP pro Team-Mitglied
3. **LinkedIn** — OAuth + ggf. Gateway (Unipile) für Messaging

---

*DNA ME — Built with ❤️*
