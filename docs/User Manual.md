# DNA Marketing Engine — User Manual

**Version:** 1.0  
**Date:** February 2026

---

## Table of Contents

1. [Introduction](#1-introduction)
2. [Roles in the CRM](#2-roles-in-the-crm)
3. [Overview: How to Use the Platform](#3-overview-how-to-use-the-platform)
4. [Registration and First Login](#4-registration-and-first-login)
5. [Creating Organizations](#5-creating-organizations)
6. [Creating Leads/Customers (Manually)](#6-creating-leadscustomers-manually)
7. [Lead/Customer Card View](#7-leadcustomer-card-view)
8. [Tasks (In Development)](#8-tasks-in-development)
9. [Pipelines](#9-pipelines)
10. [Chats & Communication](#10-chats--communication)
11. [Deals: List and Kanban View](#11-deals-list-and-kanban-view)
12. [Automations on the Deal Kanban](#12-automations-on-the-deal-kanban)
13. [Email Marketing (Sequences)](#13-email-marketing-sequences)
14. [Notes on Integrations](#14-notes-on-integrations)
15. [Recommended Screenshots](#15-recommended-screenshots)

---

## 1. Introduction

**DNA Marketing Engine** is a custom CRM platform for DNA-ME [CRM](https://crm.dna-me.net). It helps you with:

- **Contact Management** (Leads/Customers)
- **Deal Management** with Pipelines and Kanban
- **Communication** via Chats and Email
- **Automations** (Email sequences, notifications, Moco integration)
- **Email Marketing** with reusable sequences

This manual describes how to use the platform in your daily work and explains the available roles.

---

## 2. Roles in the CRM

The DNA ME CRM distinguishes between the following **roles**. They control who can see and do what (backend logic; the differentiation in the UI may be limited depending on the configuration).

| Role | Title | Typical Tasks |
|--------|-------------|---------------------|
| **admin** | Administrator | Activate users, system settings, full access to all data (e.g., all chats, all email accounts). The first registered user automatically becomes an admin. |
| **bdr** | Business Development Representative | Process leads, initial contact, qualification. Often assigned a region (e.g., DACH, UK) and capacity (max. leads). |
| **ae** | Account Executive | Manage deals, negotiations, closing. Higher deal responsibility. |
| **marketing_manager** | Marketing Manager | Campaigns, lead generation, larger lead capacity, discovery/fallback. |

**Notes:**

- **Registration:** The first user automatically becomes an **admin** and is immediately active. Subsequent users are created as **bdr** by default and are initially **inactive** until an admin activates them.
- **Chat Access:** Admins can see all conversations; other users typically only see conversations they are part of or that are assigned to their deal/lead.
- **Slack** is no longer supported and will be removed from the system; notifications are sent via email (e.g., to an admin/fadmin).

---

## 3. Overview: How to Use the Platform

**Typical Workflow:**

1. **Login** (possibly after registration and activation by an admin).
2. **Create Organizations** (companies), if you work with businesses.
3. **Create Leads/Customers** manually (or they are created automatically from incoming emails in the chat).
4. **Manage Leads** in the card view: contact details, notes, activities; the **Chat Button** opens the associated chats.
5. **Create Deals** and move them through stages in **Pipelines** (List or **Kanban View**).
6. **Use Automations** on the Deal Kanban: e.g., start an email sequence, send an email notification, create a Moco customer/project/proposal/invoice.
7. **Conduct Chats** under "Communication → Chat"; create a new conversation using the **Plus** button with lead assignment.
8. **Email Marketing**: Create sequences under "Email Marketing"; these sequences can be used in Kanban automations.

The **Tasks** feature is currently in development.

---

## 4. Registration and First Login

### Registering a New User

1. Open the **registration page** in your browser (e.g., `https://crm.dna-me.net/#/register`).
2. Enter your **Name**, **Email**, and **Password**.
3. Click **"Register"**.
4. **First User:** Automatically becomes an **Admin** and can log in immediately.
5. **Other Users:** Receive a message that the registration was successful and an administrator needs to activate the account. After activation (by an admin in the backend/DB), the user can log in under **"Login"**.

![alt text](image-1.png)

### Login
- Under **"Login"**, enter your email and password.
- If **2FA** is enabled: Enter the second factor (TOTP) after logging in. 2FA can be set up under **"2FA Setup"** (in the System menu).

---

## 5. Creating Organizations

Organizations are **companies/firms** that you can later assign to leads.

1. Open **"Organizations"** from the menu.
2. Click **"Create"**.
3. Fill in the following fields (as available):
   - **Name**
   - **Domain**
   - **Industry**
   - **Company Size**
   - **Country**
   - **Portal ID** / **Moco ID** (optional, for integrations)
4. Save.

The created organization can be selected in the **"Company"** field (organization_id) when creating or editing a lead.

![alt text](image-2.png)
---

## 6. Creating Leads/Customers (Manually)

Leads are your **contacts/customers**. You can create them manually, or they can be created automatically when an unknown sender writes to you first (see [Chats](#10-chats--communication)).

### Manual Creation

1. Open **"Leads"** from the menu.
2. Click **"Create"**.
3. **Required field:** **Email**.
4. Other fields as needed:
   - **First Name**, **Last Name**, **Phone**, **Job Title**
   - **Company** (select an organization, if available)
   - **LinkedIn URL**
   - **Status** (e.g., New, Contacted, Qualified, Nurturing, Customer, Churned)
   - **Lifecycle Stage** (Lead, MQL, SQL, Opportunity, Customer)
5. Save.

The lead will appear in the lead list and can be opened in the **card view**.
![alt text](image-3.png)
---

## 7. Lead/Customer Card View

When you click on a lead in the list, the **detail view (card)** for that lead opens.
![alt text](image-4.png)
### Key Elements

- **Header:** Name, Status, Lifecycle, possibly routing status.
- **Score Breakdown** and **Intent Signals** (if scoring is active).
- **Contact Information:** Email, Phone, Job Title, LinkedIn.
- **Company:** Linked organization (if set).
- **Log Activity:** Record activities (Note, Email, Call, Meeting, Task).

### "Chats" Button

- At the top of the card, there is a **"Chats"** button.
- Clicking it opens a **chat panel** with all **relevant chats** for this lead (from the Communication section).
- There, you can view and continue conversations with the customer.

### Notes – at the bottom of the card

- At the **bottom** of the lead card is the **"Notes"** section.
- It displays **sorted entries** for the lead: manually created notes (activity type "Note"), sorted by time (newest first).
- You can add more notes (or emails, calls, meetings, tasks) via **"Log Activity"**; notes will then appear in this list.
- A **refresh button** reloads the notes.

![alt text](image-5.png)

---

## 8. Tasks (In Development)

The **"Tasks"** menu item is available and shows a task list (CRUD via API). The **full functionality and UX** (e.g., assignment to deals/leads, filters, due dates) is still **in development**. Tasks can already be created as an activity in the lead card via "Log Activity".

---

## 9. Pipelines

**Pipelines** define the **sales stages** and metrics for your deals.

### What You See There

- **Pipelines List:** All pipelines with an overview (e.g., number of deals, revenue, win/loss).
- **Pipeline Detail:** Clicking on a pipeline opens the **detail view** with:
  - **Stages** with deal counts and values
  - **Metrics** (e.g., total revenue, won/lost deals, conversion rate)
  - **Settings link** to pipeline configuration (if configured)

### Usage

- Pipelines are the **template** for deal phases. When creating a deal, you select a pipeline and stage. On the **Deal Kanban**, deals are grouped by stage; you can drag and drop deals between stages.

---

## 10. Chats & Communication

The **chat overview** is located under **"Communication → Chat"**.

### Layout

- **Left side:** List of conversations with **tabs**:
  - **All:** all conversations
  - **Direct:** direct conversations (type = direct)
  - **Internal:** internal conversations (type = internal)
  - **Group:** group conversations (type = group)
- **Right side:** The selected **chat** (history and input field).
- **Search** and **Refresh** in the sidebar.
- **Plus button (+):** Create a new conversation.

### Every Chat = Communication with a Lead

- Every conversation is assigned to a **lead** (or will be).
- **New email from a customer:** If the customer writes **first** and is **not yet in the database**, a **lead card (customer)** can be created automatically; the message appears in the chats.
- In the lead card, the **"Chats"** button opens exactly the chats belonging to this lead.


### Creating a New Conversation

1. Click the **Plus button (+)**.
2. Select a **Lead** (search by name or email; min. 2 characters).
3. Optionally enter a **Subject**.
4. Choose a **Type**: Direct, Internal, or Group.
5. Click **"Create"**.

The new conversation appears in the list; you can start writing messages immediately.

![alt text](image-6.png)
---

## 11. Deals: List and Kanban View

You can manage deals under **"Deals"**. There are **two views**.

### List View

- **Table** of deals: Name, Pipeline, Stage, Value, Due Date, possibly email sequence status, etc.
- Search and filters (e.g., by pipeline/stage).
- **Create:** Create a new deal.

### Kanban View

- The **toggle** in the toolbar (list icon / Kanban icon) switches to the **Kanban board view**.
- Columns = **Stages** of the selected pipeline.
- **Cards** = Deals; you can **drag and drop** deals to another stage.
- Moving deals can trigger **automations** (see next section).


![alt text](image-7.png)
---

## 12. Automations on the Deal Kanban

On the **Kanban board**, **automations (triggers)** can be configured for each **stage**. When a deal is moved into a stage, the configured actions are executed.

### Available Automations (Selection)

| Action | Short Description |
|--------|-------------------|
| **Email Marketing** | Enroll a deal in an **email sequence**. The sequence is created under "Email Marketing" and selected here. |
| **Notification (Email)** | Currently: **Email notification** to a permanently configured recipient (e.g., fadmin/Admin). No more Slack. |
| **Create Moco Customer** | Creates a customer in **Moco**. |
| **Create Moco Project** | Creates a project in Moco. |
| **Create Moco Proposal** | Creates a proposal in Moco. |
| **Moco Invoice (Draft)** | Creates a draft invoice in Moco (optionally with title, tax, due date, line items). |
| **Cituro Booking Link** (in development) | Sends a meeting booking link via email. |

![alt text](image-8.png)

**Note:** **Slack** is no longer supported and will be removed from the system. Notifications are sent via email (e.g., to Admin/fadmin).

### Usage

- When **editing a stage** or via the Kanban trigger configuration (e.g., gear icon/"Stage Triggers"), you can select the desired actions and set parameters (e.g., which email sequence, which email address for notifications).
- When **moving** a deal into this stage, the actions run automatically (e.g., email to fadmin, enrollment in a sequence, Moco customer/project/proposal/invoice).

---

## 13. Email Marketing (Sequences)

Under **"Email Marketing"** (in the Analytics menu), you manage **email sequences** (chains of emails).

### What You Can Do There

- **Create and edit sequences** (name, description, steps, triggers).
- **Open the Sequence Builder** (e.g., via Edit or a direct route): define the steps of the sequence (subject, content, delay, etc.).
- **Activate/deactivate** sequences.
- Sequences typically have a **number of steps** and optional **triggers** (e.g., manual, on deal stage change).

![alt text](image-9.png)

An onboarding example
![alt text](image-10.png)

### Link to the Kanban

- The **sequences** created here can be selected in the **Deal Kanban automations** under **"Email Marketing"**.
- When a deal is moved to a stage for which "Enroll in email sequence" is configured, the deal is enrolled in the selected sequence and automatically receives the emails in the chain.

---

## 14. Notes on Integrations

- **Moco:** For proposals, invoices, customers, and projects. Configuration, e.g., under Settings → Integrations (API key, subdomain). The automations on the Kanban use this connection.
- **Slack:** Is **no longer used** and will be removed from the system. Notifications are sent via email (e.g., to fadmin/Admin).
- **Email Dispatch:** Email sequences and notifications use the configured email services (e.g., SMTP). Email accounts per user can be managed under settings (IMAP/SMTP for incoming/outgoing mail).


MOCO API
![alt text](image-11.png)
---
