// =============================================================================
// src/workers/notificationWorker.ts
// Notification Worker für E-Mail- und Slack-Benachrichtigungen
// =============================================================================

import { Worker, Job } from 'bullmq';
import { redisOptions } from '../config/redis.js';
import { db } from '../db/index.js';
import { getEmailService } from '../services/emailService.js';
import { getSlackService } from '../integrations/slack.js';
import type { Lead, Deal, TeamMember } from '../types/index.js';

// =============================================================================
// Types
// =============================================================================

interface NotificationJob {
  type: 'slack_notification' | 'send_slack' | 'email_notification' | 'notify_assignment_needed';
  channel?: string;
  message?: string;
  lead_id?: string;
  deal_id?: string;
  role?: string;
  to?: string;
  subject?: string;
  html?: string;
  metadata?: Record<string, unknown>;
}

interface LeadWithDeal extends Lead {
  deal_id?: string;
  deal_name?: string;
  deal_value?: number;
  pipeline_name?: string;
  stage_name?: string;
  assigned_to?: string;
}

// =============================================================================
// Process Slack Notification
// =============================================================================

async function processSlackNotification(
  slackService: ReturnType<typeof getSlackService>,
  data: NotificationJob
): Promise<void> {
  if (!slackService.isConfigured()) {
    console.log('[NotificationWorker] Slack nicht konfiguriert, überspringe Benachrichtigung');
    return;
  }

  const channel = data.channel || '#crm-notifications';
  const message = data.message || '';

  if (!message) {
    console.warn('[NotificationWorker] Keine Nachricht bereitgestellt');
    return;
  }

  const sent = await slackService.sendMessage(channel, message);
  
  if (sent) {
    console.log(`[NotificationWorker] Slack-Nachricht gesendet an ${channel}`);
  } else {
    console.error(`[NotificationWorker] Fehler beim Senden der Slack-Nachricht an ${channel}`);
  }
}

// =============================================================================
// Process Email Notification
// =============================================================================

async function processEmailNotification(
  emailService: ReturnType<typeof getEmailService>,
  data: NotificationJob
): Promise<void> {
  const to = data.to;
  const subject = data.subject || 'Benachrichtigung';
  const html = data.html || data.message || '';

  if (!to) {
    console.warn('[NotificationWorker] Keine E-Mail-Adresse bereitgestellt');
    return;
  }

  const result = await emailService.sendEmail({
    to,
    subject,
    html
  });

  if (result.success) {
    console.log(`[NotificationWorker] E-Mail-Benachrichtigung gesendet an ${to}: ${subject}`);
  } else {
    console.error(`[NotificationWorker] Fehler beim Senden der E-Mail an ${to}: ${result.error}`);
  }
}

// =============================================================================
// Process Assignment Needed Notification
// =============================================================================

async function processAssignmentNeeded(
  slackService: ReturnType<typeof getSlackService>,
  data: NotificationJob
): Promise<void> {
  if (!slackService.isConfigured()) {
    console.log('[NotificationWorker] Slack nicht konfiguriert, überspringe Benachrichtigung');
    return;
  }

  const leadId = data.lead_id;
  const dealId = data.deal_id;
  const role = data.role || 'unknown';

  if (!leadId && !dealId) {
    console.warn('[NotificationWorker] Keine Lead- oder Deal-ID bereitgestellt');
    return;
  }

  let lead: Lead | null = null;
  let deal: Deal | null = null;

  if (leadId) {
    lead = await db.queryOne<Lead>('SELECT * FROM leads WHERE id = $1', [leadId]);
  }

  if (dealId) {
    deal = await db.queryOne<Deal>('SELECT * FROM deals WHERE id = $1', [dealId]);
  }

  const message = `📋 Zuweisung erforderlich\n` +
    `Lead: ${lead?.email || 'unbekannt'}\n` +
    `Deal: ${deal?.name || dealId || 'N/A'}\n` +
    `Benötigte Rolle: ${role}\n` +
    `Bitte weisen Sie einen Eigentümer zu.`;

  const sent = await slackService.sendMessage('#lead-routing', message);
  
  if (sent) {
    console.log(`[NotificationWorker] Zuweisungsbenachrichtigung gesendet für ${leadId || dealId}`);
  }
}

// =============================================================================
// Create Notification Worker
// =============================================================================

export function createNotificationWorker(): Worker<NotificationJob> {
  const emailService = getEmailService();
  const slackService = getSlackService();

  const worker = new Worker<NotificationJob>(
    'notifications',
    async (job: Job<NotificationJob>) => {
      const jobType = job.name;
      const data = job.data;
      
      console.log(`[NotificationWorker] Verarbeite: ${jobType} (Job ${job.id})`);
      
      try {
        switch (jobType) {
          case 'slack_notification':
          case 'send_slack':
            await processSlackNotification(slackService, data);
            break;
            
          case 'email_notification':
            await processEmailNotification(emailService, data);
            break;
            
          case 'notify_assignment_needed':
            await processAssignmentNeeded(slackService, data);
            break;
            
          default:
            console.warn(`[NotificationWorker] Unbekannter Benachrichtigungstyp: ${jobType}`);
        }
        
        return { success: true, type: jobType };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unbekannter Fehler';
        console.error(`[NotificationWorker] Fehler bei ${jobType}:`, errorMessage);
        throw error;
      }
    },
    {
      connection: redisOptions,
      concurrency: 5
    }
  );
  
  worker.on('completed', (job) => {
    console.log(`[NotificationWorker] Job ${job.id} (${job.name}) erfolgreich abgeschlossen`);
  });
  
  worker.on('failed', (job, error) => {
    console.error(`[NotificationWorker] Job ${job?.id} (${job?.name}) fehlgeschlagen:`, error.message);
  });
  
  worker.on('error', (error) => {
    console.error('[NotificationWorker] Worker-Fehler:', error);
  });
  
  return worker;
}

export default createNotificationWorker;
