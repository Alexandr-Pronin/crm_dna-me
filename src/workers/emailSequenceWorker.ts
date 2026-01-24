// =============================================================================
// src/workers/emailSequenceWorker.ts
// E-Mail Sequence Worker - Versendet fällige E-Mails aus Sequenzen
// =============================================================================

import { Worker, Queue, Job } from 'bullmq';
import { getRedisConnection } from '../config/redis.js';
import { db } from '../db/index.js';
import { getEmailService } from '../services/emailService.js';
import type { Lead, EmailSequence, EmailSequenceStep, EmailSequenceEnrollment } from '../types/index.js';

// =============================================================================
// Types
// =============================================================================

interface EmailSequenceJob {
  type: 'process_due_emails' | 'send_single_email';
  enrollment_id?: string;
}

interface DueEmail {
  enrollment_id: string;
  lead_id: string;
  sequence_id: string;
  current_step: number;
  lead_email: string;
  lead_first_name?: string;
  lead_last_name?: string;
  lead_company?: string;
  step_id: string;
  step_subject: string;
  step_body_html: string;
  step_body_text?: string;
  step_position: number;
}

// =============================================================================
// Queue Setup
// =============================================================================

const QUEUE_NAME = 'email-sequence';

let emailSequenceQueue: Queue | null = null;

export function getEmailSequenceQueue(): Queue {
  if (!emailSequenceQueue) {
    emailSequenceQueue = new Queue(QUEUE_NAME, {
      connection: getRedisConnection(),
      defaultJobOptions: {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 60000 // 1 minute initial delay
        },
        removeOnComplete: {
          age: 86400, // Keep completed jobs for 24 hours
          count: 1000
        },
        removeOnFail: {
          age: 604800 // Keep failed jobs for 7 days
        }
      }
    });
  }
  return emailSequenceQueue;
}

// =============================================================================
// Worker Creation
// =============================================================================

export function createEmailSequenceWorker(): Worker {
  const emailService = getEmailService();

  const worker = new Worker<EmailSequenceJob>(
    QUEUE_NAME,
    async (job: Job<EmailSequenceJob>) => {
      const { type, enrollment_id } = job.data;

      console.log(`[EmailSequenceWorker] Processing job: ${type}`);

      switch (type) {
        case 'process_due_emails':
          return await processDueEmails(emailService);

        case 'send_single_email':
          if (!enrollment_id) {
            throw new Error('enrollment_id required for send_single_email');
          }
          return await sendSingleEmail(emailService, enrollment_id);

        default:
          throw new Error(`Unknown job type: ${type}`);
      }
    },
    {
      connection: getRedisConnection(),
      concurrency: 5,
      limiter: {
        max: 20, // Max 20 emails per minute
        duration: 60000
      }
    }
  );

  worker.on('completed', (job) => {
    console.log(`[EmailSequenceWorker] Job ${job.id} completed`);
  });

  worker.on('failed', (job, err) => {
    console.error(`[EmailSequenceWorker] Job ${job?.id} failed:`, err.message);
  });

  return worker;
}

// =============================================================================
// Process Due Emails
// =============================================================================

async function processDueEmails(emailService: ReturnType<typeof getEmailService>): Promise<{
  processed: number;
  sent: number;
  failed: number;
}> {
  // Find all enrollments with due emails
  const dueEmails = await db.query<DueEmail>(
    `SELECT 
       ese.id as enrollment_id,
       ese.lead_id,
       ese.sequence_id,
       ese.current_step,
       l.email as lead_email,
       l.first_name as lead_first_name,
       l.last_name as lead_last_name,
       o.name as lead_company,
       ess.id as step_id,
       ess.subject as step_subject,
       ess.body_html as step_body_html,
       ess.body_text as step_body_text,
       ess.position as step_position
     FROM email_sequence_enrollments ese
     JOIN leads l ON ese.lead_id = l.id
     LEFT JOIN organizations o ON l.organization_id = o.id
     JOIN email_sequences es ON ese.sequence_id = es.id
     JOIN email_sequence_steps ess ON ess.sequence_id = es.id 
       AND ess.position = ese.current_step + 1
     WHERE ese.status = 'active'
       AND es.is_active = TRUE
       AND ese.next_email_due_at <= NOW()
     ORDER BY ese.next_email_due_at ASC
     LIMIT 100`
  );

  console.log(`[EmailSequenceWorker] Found ${dueEmails.length} due emails`);

  let sent = 0;
  let failed = 0;

  for (const dueEmail of dueEmails) {
    try {
      const success = await sendSequenceEmail(emailService, dueEmail);
      if (success) {
        sent++;
      } else {
        failed++;
      }
    } catch (error) {
      console.error(`[EmailSequenceWorker] Error sending email for enrollment ${dueEmail.enrollment_id}:`, error);
      failed++;
    }
  }

  return {
    processed: dueEmails.length,
    sent,
    failed
  };
}

// =============================================================================
// Send Single Email (for specific enrollment)
// =============================================================================

async function sendSingleEmail(
  emailService: ReturnType<typeof getEmailService>,
  enrollmentId: string
): Promise<boolean> {
  const dueEmail = await db.queryOne<DueEmail>(
    `SELECT 
       ese.id as enrollment_id,
       ese.lead_id,
       ese.sequence_id,
       ese.current_step,
       l.email as lead_email,
       l.first_name as lead_first_name,
       l.last_name as lead_last_name,
       o.name as lead_company,
       ess.id as step_id,
       ess.subject as step_subject,
       ess.body_html as step_body_html,
       ess.body_text as step_body_text,
       ess.position as step_position
     FROM email_sequence_enrollments ese
     JOIN leads l ON ese.lead_id = l.id
     LEFT JOIN organizations o ON l.organization_id = o.id
     JOIN email_sequences es ON ese.sequence_id = es.id
     JOIN email_sequence_steps ess ON ess.sequence_id = es.id 
       AND ess.position = ese.current_step + 1
     WHERE ese.id = $1
       AND ese.status = 'active'
       AND es.is_active = TRUE`,
    [enrollmentId]
  );

  if (!dueEmail) {
    console.warn(`[EmailSequenceWorker] No pending email found for enrollment ${enrollmentId}`);
    return false;
  }

  return sendSequenceEmail(emailService, dueEmail);
}

// =============================================================================
// Send Sequence Email
// =============================================================================

async function sendSequenceEmail(
  emailService: ReturnType<typeof getEmailService>,
  dueEmail: DueEmail
): Promise<boolean> {
  // Prepare template variables
  const variables: Record<string, string | number> = {
    first_name: dueEmail.lead_first_name || '',
    last_name: dueEmail.lead_last_name || '',
    email: dueEmail.lead_email,
    company: dueEmail.lead_company || '',
    full_name: [dueEmail.lead_first_name, dueEmail.lead_last_name].filter(Boolean).join(' ') || 'Interessent/in'
  };

  // Replace template variables in subject and body
  const replaceVariables = (text: string): string => {
    let result = text;
    for (const [key, value] of Object.entries(variables)) {
      const regex = new RegExp(`{{\\s*${key}\\s*}}`, 'gi');
      result = result.replace(regex, String(value));
    }
    return result;
  };

  const subject = replaceVariables(dueEmail.step_subject);
  const bodyHtml = replaceVariables(dueEmail.step_body_html);
  const bodyText = dueEmail.step_body_text ? replaceVariables(dueEmail.step_body_text) : undefined;

  // Send the email with tracking
  const result = await emailService.sendTrackedEmail(
    {
      to: dueEmail.lead_email,
      subject,
      html: bodyHtml,
      text: bodyText
    },
    {
      enrollmentId: dueEmail.enrollment_id,
      stepId: dueEmail.step_id,
      enableOpenTracking: true,
      enableClickTracking: true
    }
  );

  if (result.success) {
    // Update enrollment: increment current_step and set last_email_sent_at
    await db.execute(
      `UPDATE email_sequence_enrollments 
       SET current_step = current_step + 1,
           last_email_sent_at = NOW(),
           updated_at = NOW()
       WHERE id = $1`,
      [dueEmail.enrollment_id]
    );

    // Check if this was the last step
    const nextStep = await db.queryOne<{ id: string }>(
      `SELECT id FROM email_sequence_steps 
       WHERE sequence_id = $1 AND position = $2`,
      [dueEmail.sequence_id, dueEmail.step_position + 1]
    );

    if (!nextStep) {
      // Mark enrollment as completed
      await db.execute(
        `UPDATE email_sequence_enrollments 
         SET status = 'completed',
             completed_at = NOW(),
             next_email_due_at = NULL
         WHERE id = $1`,
        [dueEmail.enrollment_id]
      );

      console.log(`[EmailSequenceWorker] Enrollment ${dueEmail.enrollment_id} completed (all steps sent)`);
    }

    console.log(`[EmailSequenceWorker] Email sent: ${subject} → ${dueEmail.lead_email} (Step ${dueEmail.step_position})`);
    return true;
  } else {
    console.error(`[EmailSequenceWorker] Failed to send email: ${result.error}`);
    return false;
  }
}

// =============================================================================
// Setup Scheduled Job (every 15 minutes)
// =============================================================================

export async function setupEmailSequenceJob(): Promise<void> {
  const queue = getEmailSequenceQueue();

  // Remove existing repeatable job if exists
  const repeatableJobs = await queue.getRepeatableJobs();
  for (const job of repeatableJobs) {
    if (job.name === 'process-due-emails') {
      await queue.removeRepeatableByKey(job.key);
    }
  }

  // Add new repeatable job - every 15 minutes
  await queue.add(
    'process-due-emails',
    { type: 'process_due_emails' },
    {
      repeat: {
        pattern: '*/15 * * * *' // Every 15 minutes
      }
    }
  );

  console.log('[EmailSequenceWorker] Scheduled job: process-due-emails (every 15 minutes)');
}

// =============================================================================
// Enroll Lead in Sequence
// =============================================================================

export async function enrollLeadInSequence(
  leadId: string,
  sequenceId: string,
  metadata?: Record<string, unknown>
): Promise<string | null> {
  // Check if already enrolled
  const existing = await db.queryOne<{ id: string; status: string }>(
    `SELECT id, status FROM email_sequence_enrollments 
     WHERE lead_id = $1 AND sequence_id = $2`,
    [leadId, sequenceId]
  );

  if (existing) {
    if (existing.status === 'active') {
      console.log(`[EmailSequenceWorker] Lead ${leadId} already enrolled in sequence ${sequenceId}`);
      return existing.id;
    }
    
    // Re-enroll if previously completed or unsubscribed
    if (existing.status === 'completed') {
      await db.execute(
        `UPDATE email_sequence_enrollments 
         SET status = 'active',
             current_step = 0,
             enrolled_at = NOW(),
             last_email_sent_at = NULL,
             completed_at = NULL,
             metadata = COALESCE($1, metadata),
             updated_at = NOW()
         WHERE id = $2`,
        [metadata ? JSON.stringify(metadata) : null, existing.id]
      );
      
      // Calculate next_email_due_at
      await db.execute(
        `UPDATE email_sequence_enrollments 
         SET next_email_due_at = calculate_next_email_due(id)
         WHERE id = $1`,
        [existing.id]
      );
      
      console.log(`[EmailSequenceWorker] Lead ${leadId} re-enrolled in sequence ${sequenceId}`);
      return existing.id;
    }
    
    // Don't re-enroll if unsubscribed
    console.log(`[EmailSequenceWorker] Lead ${leadId} is unsubscribed from sequence ${sequenceId}`);
    return null;
  }

  // Create new enrollment
  const result = await db.queryOne<{ id: string }>(
    `INSERT INTO email_sequence_enrollments (lead_id, sequence_id, metadata)
     VALUES ($1, $2, $3)
     RETURNING id`,
    [leadId, sequenceId, JSON.stringify(metadata || {})]
  );

  if (result) {
    // Calculate next_email_due_at
    await db.execute(
      `UPDATE email_sequence_enrollments 
       SET next_email_due_at = calculate_next_email_due(id)
       WHERE id = $1`,
      [result.id]
    );

    console.log(`[EmailSequenceWorker] Lead ${leadId} enrolled in sequence ${sequenceId}`);
    return result.id;
  }

  return null;
}

// =============================================================================
// Pause/Resume Enrollment
// =============================================================================

export async function pauseEnrollment(enrollmentId: string): Promise<boolean> {
  const result = await db.execute(
    `UPDATE email_sequence_enrollments 
     SET status = 'paused', updated_at = NOW()
     WHERE id = $1 AND status = 'active'`,
    [enrollmentId]
  );
  return result > 0;
}

export async function resumeEnrollment(enrollmentId: string): Promise<boolean> {
  const result = await db.execute(
    `UPDATE email_sequence_enrollments 
     SET status = 'active', 
         next_email_due_at = calculate_next_email_due(id),
         updated_at = NOW()
     WHERE id = $1 AND status = 'paused'`,
    [enrollmentId]
  );
  return result > 0;
}

// =============================================================================
// Trigger Immediate Send
// =============================================================================

export async function triggerImmediateSend(enrollmentId: string): Promise<void> {
  const queue = getEmailSequenceQueue();
  await queue.add(
    'send-immediate',
    { type: 'send_single_email', enrollment_id: enrollmentId },
    { priority: 1 }
  );
}

export default createEmailSequenceWorker;
