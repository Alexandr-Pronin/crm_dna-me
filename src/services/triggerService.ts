// =============================================================================
// src/services/triggerService.ts
// Trigger Service - Führt verschiedene Aktionen für Stage-Trigger aus
// =============================================================================

import { db } from '../db/index.js';
import { getEmailService, EmailOptions } from './emailService.js';
import { getMocoService } from '../integrations/moco.js';
import { getSlackService } from '../integrations/slack.js';
import { getCituroService } from '../integrations/cituro.js';
import { enrollLeadInSequence, triggerImmediateSend } from '../workers/emailSequenceWorker.js';
import { getConversationService } from './conversationService.js';
import { getMessageService } from './messageService.js';
import { recordActivity } from './activityService.js';
import { NotFoundError, ValidationError } from '../errors/index.js';
import type { Lead, Deal } from '../types/index.js';

// =============================================================================
// Types
// =============================================================================

export type TriggerAction =
  | 'send_notification_email'
  | 'send_email'
  | 'enroll_email_sequence'
  | 'create_moco_project'
  | 'create_moco_customer'
  | 'create_moco_offer'
  | 'create_moco_invoice_draft'
  | 'send_cituro_booking'
  | 'send_slack_message'
  | 'create_task';

export interface TriggerActionConfig {
  action: TriggerAction;
  config: Record<string, unknown>;
}

export interface TriggerContext {
  deal_id?: string;
  lead_id?: string;
  stage_id?: string;
  pipeline_id?: string;
}

export interface TriggerResult {
  success: boolean;
  action: TriggerAction;
  result?: unknown;
  error?: string;
}

// =============================================================================
// Trigger Service Class
// =============================================================================

export class TriggerService {
  private emailService = getEmailService();
  private mocoService = getMocoService();
  private slackService = getSlackService();
  private cituroService = getCituroService();

  /**
   * Ermittelt eine System-User-ID für Automatisierungs-Aktionen (z. B. Konversation anlegen).
   * Bevorzugt ersten Admin, sonst ersten aktiven Team-Member.
   */
  private async getSystemUserId(): Promise<string | null> {
    const admin = await db.queryOne<{ id: string }>(
      `SELECT id FROM team_members WHERE is_active = true AND role = 'admin' LIMIT 1`
    );
    if (admin?.id) return admin.id;
    const anyUser = await db.queryOne<{ id: string }>(
      `SELECT id FROM team_members WHERE is_active = true LIMIT 1`
    );
    return anyUser?.id ?? null;
  }

  /**
   * Schreibt eine Automatisierungs-Nachricht in die Lead-Konversation und zeichnet Activity auf.
   */
  private async addAutomationToLeadConversation(
    leadId: string,
    eventType: string,
    eventLabel: string,
    messageBody: string,
    metadata: Record<string, unknown>
  ): Promise<void> {
    try {
      await recordActivity({
        lead_id: leadId,
        event_type: eventType,
        event_category: 'marketing',
        source: 'trigger',
        metadata: { ...metadata, label: eventLabel },
      });
      const systemUserId = await this.getSystemUserId();
      if (!systemUserId) return;
      const conversationService = getConversationService();
      const conversation = await conversationService.findOrCreateConversation(
        leadId,
        null,
        systemUserId,
        undefined,
        false
      );
      const messageService = getMessageService();
      await messageService.createMessage(
        conversation.id,
        {
          message_type: 'internal_note',
          direction: 'internal',
          body_text: messageBody,
          body_html: `<p>${messageBody.replace(/</g, '&lt;')}</p>`,
          metadata: { automation: true, ...metadata },
        },
        systemUserId
      );
    } catch (err) {
      console.warn('[TriggerService] addAutomationToLeadConversation failed:', err);
    }
  }

  // ===========================================================================
  // Execute Trigger Action
  // ===========================================================================

  /**
   * Führt eine Trigger-Aktion für einen Deal/Lead aus
   */
  async executeAction(
    action: TriggerAction,
    config: Record<string, unknown>,
    context: TriggerContext
  ): Promise<TriggerResult> {
    console.log(`[TriggerService] Executing action: ${action}`, { config, context });

    try {
      switch (action) {
        case 'send_notification_email':
          return await this.actionSendNotificationEmail(config, context);

        case 'enroll_email_sequence':
          return await this.actionEnrollEmailSequence(config, context);

        case 'create_moco_project':
          return await this.actionCreateMocoProject(config, context);

        case 'create_moco_customer':
          return await this.actionCreateMocoCustomer(config, context);

        case 'create_moco_offer':
          return await this.actionCreateMocoOffer(config, context);

        case 'create_moco_invoice_draft':
          return await this.actionCreateMocoInvoiceDraft(config, context);

        case 'send_cituro_booking':
          return await this.actionSendCituroBooking(config, context);

        case 'send_slack_message':
          return await this.actionSendSlackMessage(config, context);

        case 'create_task':
          return await this.actionCreateTask(config, context);

        default:
          throw new ValidationError(`Unbekannte Aktion: ${action}`);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unbekannter Fehler';
      console.error(`[TriggerService] Fehler bei Aktion ${action}:`, errorMessage);
      
      return {
        success: false,
        action,
        error: errorMessage
      };
    }
  }

  // ===========================================================================
  // Action: Send Email
  // ===========================================================================

  private async actionSendEmail(
    config: Record<string, unknown>,
    context: TriggerContext
  ): Promise<TriggerResult> {
    const { to, subject, html, text, from, fromName } = config;

    if (!to || !subject) {
      throw new ValidationError('E-Mail benötigt: to, subject');
    }

    // Lade Lead/Deal Daten für Template-Variablen
    const variables: Record<string, string | number> = {};
    
    if (context.lead_id) {
      const lead = await db.queryOne<Lead>(
        'SELECT * FROM leads WHERE id = $1',
        [context.lead_id]
      );
      
      if (lead) {
        variables.first_name = lead.first_name || '';
        variables.last_name = lead.last_name || '';
        variables.email = lead.email;
        variables.company = lead.organization_id ? await this.getOrganizationName(lead.organization_id) : '';
      }
    }

    if (context.deal_id) {
      const deal = await db.queryOne<Deal>(
        'SELECT * FROM deals WHERE id = $1',
        [context.deal_id]
      );
      
      if (deal) {
        variables.deal_name = deal.name || '';
        variables.deal_value = deal.value ? Number(deal.value) : 0;
      }
    }

    const emailOptions: EmailOptions = {
      to: String(to),
      subject: String(subject),
      html: html ? String(html) : undefined,
      text: text ? String(text) : undefined,
      from: from ? String(from) : undefined,
      fromName: fromName ? String(fromName) : undefined
    };

    const result = await this.emailService.sendTemplatedEmail(emailOptions, variables);

    if (result.success && context.lead_id) {
      const subject = String(config.subject ?? '').trim() || '(ohne Betreff)';
      await this.addAutomationToLeadConversation(
        context.lead_id,
        'email_sent',
        'E-Mail (Automatisierung)',
        `Automatisierung: E-Mail gesendet. Betreff: ${subject}`,
        { trigger_action: 'send_email', subject }
      );
    }

    return {
      success: result.success,
      action: 'send_email',
      result: result.messageId ? { messageId: result.messageId } : undefined,
      error: result.error
    };
  }

  // ===========================================================================
  // Action: Enroll Lead in Email Sequence
  // ===========================================================================

  private async actionEnrollEmailSequence(
    config: Record<string, unknown>,
    context: TriggerContext
  ): Promise<TriggerResult> {
    let leadId = context.lead_id;
    if (!leadId && context.deal_id) {
      const deal = await db.queryOne<Deal>(
        'SELECT lead_id FROM deals WHERE id = $1',
        [context.deal_id]
      );
      leadId = deal?.lead_id;
    }

    if (!leadId) {
      throw new ValidationError('lead_id benötigt für enroll_email_sequence');
    }

    const sequenceId = config.sequence_id as string | undefined;
    if (!sequenceId) {
      throw new ValidationError('sequence_id benötigt für enroll_email_sequence');
    }

    const sequence = await db.queryOne<{ id: string; name: string; is_active: boolean }>(
      'SELECT id, name, is_active FROM email_sequences WHERE id = $1',
      [sequenceId]
    );

    if (!sequence) {
      throw new NotFoundError('Sequenz', sequenceId);
    }

    if (!sequence.is_active) {
      throw new ValidationError('Sequenz ist nicht aktiv');
    }

    const metadata = {
      source: 'trigger',
      deal_id: context.deal_id || undefined,
      pipeline_id: context.pipeline_id || undefined,
      stage_id: context.stage_id || undefined
    };

    const enrollmentId = await enrollLeadInSequence(leadId, sequenceId, metadata, {
      dealId: context.deal_id,
      stageId: context.stage_id
    });

    if (!enrollmentId) {
      throw new ValidationError('Lead konnte nicht eingeschrieben werden');
    }

    // In "Letzte Aktivitäten" anzeigen
    await this.addAutomationToLeadConversation(
      leadId,
      'enrolled_in_sequence',
      'In E-Mail-Sequenz eingeschrieben',
      `Automatisierung: Lead in E-Mail-Sequenz „${sequence.name}“ eingeschrieben.`,
      { sequence_id: sequenceId, sequence_name: sequence.name, deal_id: context.deal_id }
    );

    // Trigger immediate send so the first email goes out right away
    try {
      await triggerImmediateSend(enrollmentId);
    } catch (err) {
      console.warn('[TriggerService] Could not queue immediate send:', err);
    }

    return {
      success: true,
      action: 'enroll_email_sequence',
      result: { enrollment_id: enrollmentId, sequence_id: sequenceId }
    };
  }

  // ===========================================================================
  // Action: Send Notification Email (Deal Summary)
  // ===========================================================================

  private async actionSendNotificationEmail(
    config: Record<string, unknown>,
    context: TriggerContext
  ): Promise<TriggerResult> {
    if (!context.deal_id) {
      throw new ValidationError('deal_id benötigt für send_notification_email');
    }

    const deal = await db.queryOne<Deal & { lead_email?: string; lead_name?: string; org_name?: string; stage_name?: string; pipeline_name?: string }>(
      `SELECT d.*, l.email as lead_email,
              CONCAT_WS(' ', l.first_name, l.last_name) as lead_name,
              o.name as org_name,
              ps.name as stage_name,
              p.name as pipeline_name
       FROM deals d
       JOIN leads l ON d.lead_id = l.id
       LEFT JOIN organizations o ON l.organization_id = o.id
       LEFT JOIN pipeline_stages ps ON ps.id = d.stage_id
       LEFT JOIN pipelines p ON p.id = d.pipeline_id
       WHERE d.id = $1`,
      [context.deal_id]
    );

    if (!deal) {
      throw new NotFoundError('Deal', context.deal_id);
    }

    const to = config.to as string | undefined;
    if (!to) {
      throw new ValidationError('Notification benötigt: to');
    }

    const dealName = deal.name || `Deal ${deal.id.slice(0, 8)}`;
    const dealValue = deal.value ? Number(deal.value) : 0;
    const leadName = deal.lead_name || deal.lead_email || '';
    const companyName = deal.org_name || '';
    const dealLinkBase = process.env.DEAL_LINK_BASE || process.env.FRONTEND_URL || '';
    const buildDealLink = (base: string) => {
      if (!base) return '';
      const trimmed = base.replace(/\/$/, '');
      if (trimmed.includes('#')) {
        return `${trimmed.replace(/#$/, '')}/deals/${deal.id}/show`;
      }
      return `${trimmed}/#/deals/${deal.id}/show`;
    };
    const dealLink = buildDealLink(dealLinkBase);

    const totalLeadsResult = await db.queryOne<{ count: string }>(
      'SELECT COUNT(*)::text as count FROM leads'
    );
    const totalCustomersResult = await db.queryOne<{ count: string }>(
      'SELECT COUNT(*)::text as count FROM organizations'
    );
    const totalDealsResult = await db.queryOne<{ count: string }>(
      'SELECT COUNT(*)::text as count FROM deals'
    );
    const totalRevenueWonResult = await db.queryOne<{ total: string | null }>(
      "SELECT COALESCE(SUM(value), 0)::text as total FROM deals WHERE status = 'won'"
    );
    const totalRevenueAllResult = await db.queryOne<{ total: string | null }>(
      'SELECT COALESCE(SUM(value), 0)::text as total FROM deals'
    );
    const dealStatusCounts = await db.queryOne<{
      open_count: string;
      won_count: string;
      lost_count: string;
      avg_value: string | null;
    }>(
      `SELECT
         COUNT(*) FILTER (WHERE status = 'open')::text as open_count,
         COUNT(*) FILTER (WHERE status = 'won')::text as won_count,
         COUNT(*) FILTER (WHERE status = 'lost')::text as lost_count,
         COALESCE(AVG(value), 0)::text as avg_value
       FROM deals`
    );

    const totalLeads = Number.parseInt(totalLeadsResult?.count || '0', 10);
    const totalCustomers = Number.parseInt(totalCustomersResult?.count || '0', 10);
    const totalDeals = Number.parseInt(totalDealsResult?.count || '0', 10);
    const totalRevenueWon = Number.parseFloat(totalRevenueWonResult?.total || '0');
    const totalRevenueAll = Number.parseFloat(totalRevenueAllResult?.total || '0');
    const openDeals = Number.parseInt(dealStatusCounts?.open_count || '0', 10);
    const wonDeals = Number.parseInt(dealStatusCounts?.won_count || '0', 10);
    const lostDeals = Number.parseInt(dealStatusCounts?.lost_count || '0', 10);
    const avgDealValue = Number.parseFloat(dealStatusCounts?.avg_value || '0');

    const createdDate = deal.created_at
      ? new Date(deal.created_at as unknown as string).toISOString().slice(0, 10)
      : '';
    const variables: Record<string, string> = {
      'deal.name': dealName,
      'deal.value': dealValue.toLocaleString(),
      'deal.currency': deal.currency || 'EUR',
      'deal.date': createdDate,
      'deal.link': dealLink,
      'lead.name': leadName,
      'lead.email': deal.lead_email || '',
      'company.name': companyName,
      'stage.name': deal.stage_name || '',
      'pipeline.name': deal.pipeline_name || '',
      'stats.leads': totalLeads.toLocaleString(),
      'stats.customers': totalCustomers.toLocaleString(),
      'stats.deals': totalDeals.toLocaleString(),
      'stats.revenue_won': totalRevenueWon.toLocaleString(),
      'stats.revenue_total': totalRevenueAll.toLocaleString(),
      'stats.open_deals': openDeals.toLocaleString(),
      'stats.won_deals': wonDeals.toLocaleString(),
      'stats.lost_deals': lostDeals.toLocaleString(),
      'stats.avg_deal': avgDealValue.toLocaleString()
    };

    const renderTemplate = (template: string) => {
      return template.replace(/{{\s*([\w.]+)\s*}}/g, (match, key) => {
        return Object.prototype.hasOwnProperty.call(variables, key) ? variables[key] : match;
      });
    };

    const defaultSubject = `🔥 New Deal: {{deal.name}} ({{deal.value}} {{deal.currency}})`;
    const defaultHtml = `
      <div style="font-family: Inter, Arial, sans-serif; background:#f6f7fb; padding:24px; color:#111827;">
        <div style="max-width:640px; margin:0 auto; background:#ffffff; border-radius:12px; padding:24px; border:1px solid #e5e7eb;">
          <div style="display:flex; align-items:center; gap:10px; margin-bottom:16px;">
            <div style="width:10px; height:10px; border-radius:999px; background:#10b981;"></div>
            <div style="font-size:14px; color:#6b7280;">Deal Notification</div>
          </div>
          <h2 style="margin:0 0 12px; font-size:20px;">🔥 {{deal.name}}</h2>
          <div style="display:grid; gap:8px; font-size:14px;">
            <div><strong>Kunde:</strong> {{company.name}}</div>
            <div><strong>Kontakt:</strong> {{lead.name}} {{lead.email}}</div>
            <div><strong>Betrag:</strong> {{deal.value}} {{deal.currency}}</div>
            <div><strong>Datum:</strong> {{deal.date}}</div>
            <div><strong>Pipeline:</strong> {{pipeline.name}} / {{stage.name}}</div>
          </div>
          ${dealLink ? `<a href="{{deal.link}}" target="_blank" rel="noopener noreferrer" style="display:inline-block;margin-top:16px;padding:10px 14px;border-radius:8px;background:#4A90A4;color:#ffffff;text-decoration:none;">Deal öffnen</a>` : ''}
          <hr style="border:none;border-top:1px solid #e5e7eb; margin:20px 0;" />
          <div style="display:grid; grid-template-columns: repeat(2, minmax(0,1fr)); gap:12px; font-size:13px; color:#374151;">
            <div style="padding:12px; background:#f9fafb; border-radius:8px;">
              <div style="font-size:12px; color:#6b7280;">Kunden insgesamt</div>
              <div style="font-size:16px; font-weight:600;">{{stats.customers}}</div>
            </div>
            <div style="padding:12px; background:#f9fafb; border-radius:8px;">
              <div style="font-size:12px; color:#6b7280;">Leads insgesamt</div>
              <div style="font-size:16px; font-weight:600;">{{stats.leads}}</div>
            </div>
            <div style="padding:12px; background:#f9fafb; border-radius:8px;">
              <div style="font-size:12px; color:#6b7280;">Deals insgesamt</div>
              <div style="font-size:16px; font-weight:600;">{{stats.deals}}</div>
            </div>
            <div style="padding:12px; background:#f9fafb; border-radius:8px;">
              <div style="font-size:12px; color:#6b7280;">Umsatz (Won)</div>
              <div style="font-size:16px; font-weight:600;">{{stats.revenue_won}} {{deal.currency}}</div>
            </div>
            <div style="padding:12px; background:#f9fafb; border-radius:8px;">
              <div style="font-size:12px; color:#6b7280;">Umsatz (Total)</div>
              <div style="font-size:16px; font-weight:600;">{{stats.revenue_total}} {{deal.currency}}</div>
            </div>
            <div style="padding:12px; background:#f9fafb; border-radius:8px;">
              <div style="font-size:12px; color:#6b7280;">Deals (Open/Won/Lost)</div>
              <div style="font-size:16px; font-weight:600;">{{stats.open_deals}} / {{stats.won_deals}} / {{stats.lost_deals}}</div>
            </div>
            <div style="padding:12px; background:#f9fafb; border-radius:8px;">
              <div style="font-size:12px; color:#6b7280;">Ø Deal Value</div>
              <div style="font-size:16px; font-weight:600;">{{stats.avg_deal}} {{deal.currency}}</div>
            </div>
          </div>
        </div>
      </div>
    `;

    const subjectTemplate = (config.subject as string | undefined) || defaultSubject;
    const htmlTemplate = (config.html as string | undefined) || defaultHtml;
    const subject = renderTemplate(subjectTemplate);
    const html = renderTemplate(htmlTemplate);

    const result = await this.emailService.sendEmail({
      to,
      subject,
      html
    });

    // In "Letzte Aktivitäten" anzeigen (Lead aus Deal)
    if (result.success && deal.lead_id) {
      await this.addAutomationToLeadConversation(
        deal.lead_id,
        'deal_notification_sent',
        'Deal-Benachrichtigung gesendet',
        `Automatisierung: Deal-Benachrichtigung per E-Mail gesendet (Deal: ${dealName}).`,
        { deal_id: context.deal_id, stage_id: context.stage_id }
      );
    }

    return {
      success: result.success,
      action: 'send_notification_email',
      result: result.messageId ? { messageId: result.messageId } : undefined,
      error: result.error
    };
  }

  // ===========================================================================
  // Action: Create Moco Project
  // ===========================================================================

  private async actionCreateMocoProject(
    config: Record<string, unknown>,
    context: TriggerContext
  ): Promise<TriggerResult> {
    if (!context.deal_id) {
      throw new ValidationError('deal_id benötigt für create_moco_project');
    }

    const deal = await db.queryOne<Deal & { lead_email?: string; lead_name?: string; org_name?: string }>(
      `SELECT d.*, l.email as lead_email,
              CONCAT_WS(' ', l.first_name, l.last_name) as lead_name,
              o.name as org_name
       FROM deals d
       JOIN leads l ON d.lead_id = l.id
       LEFT JOIN organizations o ON l.organization_id = o.id
       WHERE d.id = $1`,
      [context.deal_id]
    );

    if (!deal) {
      throw new NotFoundError('Deal', context.deal_id);
    }

    const customerResult = await this.actionCreateMocoCustomer({}, {
      lead_id: deal.lead_id,
      deal_id: context.deal_id
    });

    if (!customerResult.success || !customerResult.result) {
      throw new ValidationError('Konnte Moco-Kunde nicht erstellen');
    }

    const customerId = (customerResult.result as { moco_id: string }).moco_id;
    const leaderId = await this.mocoService.getDefaultLeaderId();
    if (!leaderId) {
      throw new ValidationError('Kein aktiver Moco-User gefunden (leader_id)');
    }

    const projectName = deal.name || `Deal ${deal.id.slice(0, 8)}`;
    const currency = process.env.MOCO_CURRENCY_ID || deal.currency || 'EUR';

    const startDate = new Date();
    const finishDate = new Date();
    finishDate.setMonth(finishDate.getMonth() + 12);

    const projectId = await this.mocoService.createProject({
      name: projectName,
      currency,
      leader_id: leaderId,
      customer_id: customerId,
      start_date: startDate.toISOString().slice(0, 10),
      finish_date: finishDate.toISOString().slice(0, 10),
      fixed_price: true,
      retainer: false,
      billing_variant: 'project',
      info: `Deal: ${projectName}\nLead: ${deal.lead_name || deal.lead_email || ''}\nCompany: ${deal.org_name || ''}`.trim()
    });

    await db.execute(
      `UPDATE deals
       SET metadata = jsonb_set(COALESCE(metadata, '{}'::jsonb), '{moco_project_id}', to_jsonb($1::text), true)
       WHERE id = $2`,
      [projectId, context.deal_id]
    );

    return {
      success: true,
      action: 'create_moco_project',
      result: { moco_project_id: projectId }
    };
  }

  // ===========================================================================
  // Action: Create Moco Customer
  // ===========================================================================

  private async actionCreateMocoCustomer(
    config: Record<string, unknown>,
    context: TriggerContext
  ): Promise<TriggerResult> {
    if (!context.lead_id) {
      throw new ValidationError('lead_id benötigt für create_moco_customer');
    }

    const lead = await db.queryOne<Lead>(
      `SELECT l.*, o.name as org_name, o.country
       FROM leads l
       LEFT JOIN organizations o ON l.organization_id = o.id
       WHERE l.id = $1`,
      [context.lead_id]
    );

    if (!lead) {
      throw new NotFoundError('Lead', context.lead_id);
    }

    // Prüfe ob bereits ein Moco-Kunde existiert
    if (lead.organization_id) {
      const org = await db.queryOne<{ moco_id?: string }>(
        'SELECT moco_id FROM organizations WHERE id = $1',
        [lead.organization_id]
      );

      if (org?.moco_id) {
        return {
          success: true,
          action: 'create_moco_customer',
          result: { moco_id: org.moco_id, already_exists: true }
        };
      }
    }

    const configName = (config.customer_name as string | undefined) || (config.project_name as string | undefined);
    const customerName = configName ||
                         (lead as Lead & { org_name?: string }).org_name || 
                         `${lead.first_name || ''} ${lead.last_name || ''}`.trim() || 
                         lead.email;

    const mocoId = await this.mocoService.createCustomer({
      name: customerName,
      email: lead.email,
      country: (lead as Lead & { country?: string }).country
    });

    // Speichere Moco-ID in Organization
    if (lead.organization_id) {
      await db.execute(
        'UPDATE organizations SET moco_id = $1 WHERE id = $2',
        [mocoId, lead.organization_id]
      );
    }

    return {
      success: true,
      action: 'create_moco_customer',
      result: { moco_id: mocoId }
    };
  }

  // ===========================================================================
  // Action: Create Moco Offer
  // ===========================================================================

  private async actionCreateMocoOffer(
    config: Record<string, unknown>,
    context: TriggerContext
  ): Promise<TriggerResult> {
    if (!context.deal_id) {
      throw new ValidationError('deal_id benötigt für create_moco_offer');
    }

    const deal = await db.queryOne<Deal>(
      `SELECT d.*, l.email, o.moco_id as customer_moco_id
       FROM deals d
       JOIN leads l ON d.lead_id = l.id
       LEFT JOIN organizations o ON l.organization_id = o.id
       WHERE d.id = $1`,
      [context.deal_id]
    );

    if (!deal) {
      throw new NotFoundError('Deal', context.deal_id);
    }

    const customerMocoId = (deal as Deal & { customer_moco_id?: string }).customer_moco_id;

    if (!customerMocoId) {
      // Erstelle zuerst den Kunden
      const customerResult = await this.actionCreateMocoCustomer({}, {
        lead_id: deal.lead_id,
        deal_id: context.deal_id
      });

      if (!customerResult.success || !customerResult.result) {
        throw new ValidationError('Konnte Moco-Kunde nicht erstellen');
      }

      const newCustomerMocoId = (customerResult.result as { moco_id: string }).moco_id;

      // Lade Deal erneut mit aktualisierter customer_moco_id
      const updatedDeal = await db.queryOne<Deal & { customer_moco_id?: string }>(
        `SELECT d.*, o.moco_id as customer_moco_id
         FROM deals d
         JOIN leads l ON d.lead_id = l.id
         LEFT JOIN organizations o ON l.organization_id = o.id
         WHERE d.id = $1`,
        [context.deal_id]
      );

      if (!updatedDeal?.customer_moco_id) {
        throw new ValidationError('Moco-Kunde konnte nicht verknüpft werden');
      }

      const offerId = await this.mocoService.createOffer({
        customer_id: updatedDeal.customer_moco_id,
        title: deal.name || 'Angebot',
        value: deal.value ? Number(deal.value) : 0
      });

      await db.execute(
        'UPDATE deals SET moco_offer_id = $1 WHERE id = $2',
        [offerId, context.deal_id]
      );

      return {
        success: true,
        action: 'create_moco_offer',
        result: { moco_offer_id: offerId }
      };
    }

    const offerId = await this.mocoService.createOffer({
      customer_id: customerMocoId,
      title: deal.name || 'Angebot',
      value: deal.value ? Number(deal.value) : 0
    });

    await db.execute(
      'UPDATE deals SET moco_offer_id = $1 WHERE id = $2',
      [offerId, context.deal_id]
    );

    return {
      success: true,
      action: 'create_moco_offer',
      result: { moco_offer_id: offerId }
    };
  }

  // ===========================================================================
  // Action: Create Moco Invoice (Draft)
  // ===========================================================================

  private async actionCreateMocoInvoiceDraft(
    config: Record<string, unknown>,
    context: TriggerContext
  ): Promise<TriggerResult> {
    if (!context.deal_id) {
      throw new ValidationError('deal_id benötigt für create_moco_invoice_draft');
    }

    const deal = await db.queryOne<Deal & { lead_email?: string; lead_name?: string; org_name?: string; customer_moco_id?: string; org_metadata?: Record<string, unknown> }>(
      `SELECT d.*, l.email as lead_email,
              CONCAT_WS(' ', l.first_name, l.last_name) as lead_name,
              o.name as org_name,
              o.moco_id as customer_moco_id,
              o.metadata as org_metadata
       FROM deals d
       JOIN leads l ON d.lead_id = l.id
       LEFT JOIN organizations o ON l.organization_id = o.id
       WHERE d.id = $1`,
      [context.deal_id]
    );

    if (!deal) {
      throw new NotFoundError('Deal', context.deal_id);
    }

    let customerId = deal.customer_moco_id;
    if (!customerId) {
      const customerResult = await this.actionCreateMocoCustomer({}, {
        lead_id: deal.lead_id,
        deal_id: context.deal_id
      });

      if (!customerResult.success || !customerResult.result) {
        throw new ValidationError('Konnte Moco-Kunde nicht erstellen');
      }

      customerId = (customerResult.result as { moco_id: string }).moco_id;
    }

    const today = new Date();
    const metadata = (deal.metadata as Record<string, unknown> | null) || {};
    const orgMetadata = (deal.org_metadata as Record<string, unknown> | null) || {};
    const dueDaysConfig = Number.parseInt(String(config.due_days ?? metadata.due_days ?? ''), 10);
    const dueDaysEnv = Number.parseInt(process.env.MOCO_INVOICE_DUE_DAYS || '14', 10);
    const resolvedDueDays = Number.isNaN(dueDaysConfig)
      ? (Number.isNaN(dueDaysEnv) ? 14 : dueDaysEnv)
      : dueDaysConfig;
    const dueDate = new Date();
    dueDate.setDate(today.getDate() + resolvedDueDays);

    const title = (config.title as string | undefined)
      || (metadata.invoice_title as string | undefined)
      || deal.name
      || `Invoice ${deal.id.slice(0, 8)}`;
    const currency = process.env.MOCO_CURRENCY_ID || deal.currency || 'EUR';
    const taxConfig = Number.parseFloat(String(config.tax ?? metadata.tax ?? orgMetadata.tax_rate ?? ''));
    const taxEnv = Number.parseFloat(process.env.MOCO_TAX_RATE || '');
    const tax = Number.isNaN(taxConfig)
      ? (Number.isNaN(taxEnv) ? 0 : taxEnv)
      : taxConfig;
    const amount = deal.value ? Number(deal.value) : 0;

    const recipientAddress = (config.recipient_address as string | undefined)
      || (metadata.recipient_address as string | undefined)
      || (orgMetadata.billing_address as string | undefined)
      || [
        deal.org_name || '',
        deal.lead_name || '',
        deal.lead_email || ''
      ].filter(Boolean).join('\n')
      || 'N/A';

    const projectId = (metadata.moco_project_id as string | undefined)
      || (metadata.project_id as string | undefined);
    const unitPriceConfig = Number.parseFloat(String(config.unit_price ?? metadata.unit_price ?? ''));
    const unitPrice = Number.isNaN(unitPriceConfig) ? amount : unitPriceConfig;
    const itemTitle = (config.item_title as string | undefined)
      || (metadata.item_title as string | undefined)
      || title;

    const tagsValue = metadata.tags;
    const tags = Array.isArray(tagsValue)
      ? (tagsValue as string[])
      : (typeof tagsValue === 'string'
        ? tagsValue.split(',').map(tag => tag.trim()).filter(Boolean)
        : undefined);

    const invoiceId = await this.mocoService.createInvoice({
      customer_id: customerId,
      recipient_address: recipientAddress,
      date: today.toISOString().slice(0, 10),
      due_date: dueDate.toISOString().slice(0, 10),
      title,
      tax,
      currency,
      status: 'draft',
      project_id: projectId,
      service_period_from: metadata.service_period_from as string | undefined,
      service_period_to: metadata.service_period_to as string | undefined,
      change_address: (metadata.change_address as 'invoice' | 'project' | 'customer' | undefined),
      salutation: metadata.salutation as string | undefined,
      footer: metadata.footer as string | undefined,
      discount: metadata.discount as number | undefined,
      cash_discount: metadata.cash_discount as number | undefined,
      cash_discount_days: metadata.cash_discount_days as number | undefined,
      internal_contact_id: metadata.internal_contact_id as number | undefined,
      tags,
      custom_properties: (metadata.custom_properties as Record<string, unknown> | undefined),
      items: [
        {
          type: 'item',
          title: itemTitle,
          quantity: 1,
          unit: 'Pauschale',
          unit_price: unitPrice || 0,
          net_total: unitPrice || 0
        }
      ]
    });

    return {
      success: true,
      action: 'create_moco_invoice_draft',
      result: { moco_invoice_id: invoiceId }
    };
  }

  // ===========================================================================
  // Action: Send Cituro Booking Link
  // ===========================================================================

  private async actionSendCituroBooking(
    config: Record<string, unknown>,
    context: TriggerContext
  ): Promise<TriggerResult> {
    if (!context.lead_id) {
      throw new ValidationError('lead_id benötigt für send_cituro_booking');
    }

    const lead = await db.queryOne<Lead>(
      'SELECT * FROM leads WHERE id = $1',
      [context.lead_id]
    );

    if (!lead) {
      throw new NotFoundError('Lead', context.lead_id);
    }

    const meetingType = (config.meeting_type as string) || 'consultation';
    const durationMinutes = (config.duration_minutes as number) || 30;
    const message = config.message as string | undefined;

    // Generiere Booking-Link
    const bookingLink = await this.cituroService.generateBookingLink({
      lead_email: lead.email,
      lead_name: `${lead.first_name || ''} ${lead.last_name || ''}`.trim() || undefined,
      meeting_type: meetingType,
      duration_minutes: durationMinutes,
      message
    });

    // Sende E-Mail mit Booking-Link (Vorlage aus Einstellungen, Trigger-Konfiguration oder Fallback)
    const emailSubject = (config.email_subject as string) || 'Terminvereinbarung - DNA ME';
    let emailHtml = (config.email_html as string)?.trim();
    if (!emailHtml) {
      const { getCituroTemplate } = await import('../config/integrationSettings.js');
      emailHtml = (await getCituroTemplate()).trim();
    }
    if (!emailHtml) {
      const { CITURO_INVITE_HTML_DEFAULT } = await import('../templates/cituroInviteEmail.js');
      emailHtml = CITURO_INVITE_HTML_DEFAULT;
    }
    // Platzhalter bzw. statische Cituro-URL in der Vorlage durch dynamischen Buchungslink ersetzen
    emailHtml = emailHtml
      .replace(/\{BOOKING_LINK\}/g, bookingLink.url)
      .replace(/\{booking_link\}/g, bookingLink.url)
      .replace(/https:\/\/app\.cituro\.com\/booking\/[a-zA-Z0-9-]+/g, bookingLink.url);

    const emailResult = await this.emailService.sendEmail({
      to: lead.email,
      subject: emailSubject,
      html: emailHtml
    });

    const success = emailResult.success && !!bookingLink.url;
    if (success) {
      await this.addAutomationToLeadConversation(
        context.lead_id!,
        'cituro_invite_sent',
        'Termin-Einladung gesendet',
        'Termin-Einladung (Buchungslink) per E-Mail gesendet.',
        { trigger_action: 'send_cituro_booking', cituro_invite: true }
      );
    }

    return {
      success,
      action: 'send_cituro_booking',
      result: {
        booking_link: bookingLink.url,
        booking_link_id: bookingLink.id,
        email_sent: emailResult.success
      },
      error: emailResult.error
    };
  }

  // ===========================================================================
  // Action: Send Slack Message
  // ===========================================================================

  private async actionSendSlackMessage(
    config: Record<string, unknown>,
    context: TriggerContext
  ): Promise<TriggerResult> {
    const channel = config.channel as string;
    const message = config.message as string;

    if (!channel || !message) {
      throw new ValidationError('Slack benötigt: channel, message');
    }

    // Lade zusätzliche Daten für Template-Variablen
    let templatedMessage = message;

    if (context.deal_id) {
      const deal = await db.queryOne<Deal>(
        'SELECT * FROM deals WHERE id = $1',
        [context.deal_id]
      );

      if (deal) {
        templatedMessage = templatedMessage
          .replace(/{deal\.name}/g, deal.name || 'Unbenannt')
          .replace(/{deal\.value}/g, deal.value ? String(deal.value) : '0');
      }
    }

    if (context.lead_id) {
      const lead = await db.queryOne<Lead>(
        'SELECT * FROM leads WHERE id = $1',
        [context.lead_id]
      );

      if (lead) {
        templatedMessage = templatedMessage
          .replace(/{lead\.email}/g, lead.email)
          .replace(/{lead\.first_name}/g, lead.first_name || '')
          .replace(/{lead\.last_name}/g, lead.last_name || '');
      }
    }

    const success = await this.slackService.sendMessage(channel, templatedMessage);

    return {
      success,
      action: 'send_slack_message',
      result: { channel, sent: success }
    };
  }

  // ===========================================================================
  // Helper Methods
  // ===========================================================================

  private async getOrganizationName(organizationId: string): Promise<string> {
    const org = await db.queryOne<{ name?: string }>(
      'SELECT name FROM organizations WHERE id = $1',
      [organizationId]
    );

    return org?.name || '';
  }

  // ===========================================================================
  // Get Available Actions
  // ===========================================================================

  /**
   * Gibt alle verfügbaren Trigger-Aktionen zurück
   */
  getAvailableActions(): Array<{ action: TriggerAction; description: string; required_fields: string[] }> {
    return [
      {
        action: 'send_notification_email',
        description: 'Deal-Notification per E-Mail senden',
        required_fields: ['deal_id', 'to']
      },
      {
        action: 'enroll_email_sequence',
        description: 'Lead in E-Mail-Sequenz einschreiben',
        required_fields: ['lead_id', 'sequence_id']
      },
      {
        action: 'create_moco_project',
        description: 'Projekt in Moco erstellen (wird als Kunde erstellt)',
        required_fields: ['lead_id']
      },
      {
        action: 'create_moco_customer',
        description: 'Kunde in Moco erstellen',
        required_fields: ['lead_id']
      },
      {
        action: 'create_moco_offer',
        description: 'Angebot in Moco erstellen',
        required_fields: ['deal_id']
      },
      {
        action: 'create_moco_invoice_draft',
        description: 'Rechnung in Moco als Entwurf erstellen',
        required_fields: ['deal_id']
      },
      {
        action: 'send_cituro_booking',
        description: 'Buchungslink per E-Mail versenden',
        required_fields: ['lead_id']
      },
      {
        action: 'send_slack_message',
        description: 'Nachricht in Slack-Channel senden',
        required_fields: ['channel', 'message']
      }
    ];
  }

  // ===========================================================================
  // Action: Create Task
  // ===========================================================================

  private async actionCreateTask(
    config: Record<string, unknown>,
    context: TriggerContext
  ): Promise<TriggerResult> {
    if (!context.lead_id && !context.deal_id) {
      throw new ValidationError('lead_id oder deal_id benötigt für create_task');
    }

    const titleTemplate = (config.title_template as string) || 'Aufgabe';
    const descriptionTemplate = config.description_template as string | undefined;
    const assignStrategy = (config.assign_strategy as string) || 'deal_owner';
    const priority = (config.priority as string) || 'medium';
    const dueDaysOffset = Number(config.due_days_offset) || 2;

    let leadData: Record<string, unknown> | null = null;
    let dealData: Record<string, unknown> | null = null;

    if (context.lead_id) {
      const rows = await db.query<Record<string, unknown>>(
        'SELECT * FROM leads WHERE id = $1', [context.lead_id]
      );
      leadData = rows[0] || null;
    }
    if (context.deal_id) {
      const rows = await db.query<Record<string, unknown>>(
        'SELECT * FROM deals WHERE id = $1', [context.deal_id]
      );
      dealData = rows[0] || null;
    }

    const leadName = leadData
      ? `${leadData.first_name || ''} ${leadData.last_name || ''}`.trim() || (leadData.email as string)
      : '';
    const dealName = dealData ? (dealData.name as string || '') : '';

    const replaceVars = (template: string) =>
      template
        .replace(/\{lead_name\}/g, leadName)
        .replace(/\{lead_email\}/g, (leadData?.email as string) || '')
        .replace(/\{deal_name\}/g, dealName)
        .replace(/\{deal_value\}/g, dealData?.value ? String(dealData.value) : '')
        .replace(/\{trigger_date\}/g, new Date().toISOString().split('T')[0]);

    const title = replaceVars(titleTemplate);
    const description = descriptionTemplate ? replaceVars(descriptionTemplate) : undefined;

    let assignedTo: string | undefined;
    if (assignStrategy === 'deal_owner' && dealData?.assigned_to) {
      assignedTo = dealData.assigned_to as string;
    } else if (assignStrategy === 'lead_owner') {
      const ownerRows = await db.query<Record<string, unknown>>(
        `SELECT tm.email FROM team_members tm
         JOIN deals d ON d.assigned_to = tm.email
         WHERE d.lead_id = $1 AND tm.is_active = true LIMIT 1`,
        [context.lead_id]
      );
      assignedTo = ownerRows[0]?.email as string | undefined;
    }

    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + dueDaysOffset);

    const taskRows = await db.query<Record<string, unknown>>(
      `INSERT INTO tasks (lead_id, deal_id, title, description, task_type, assigned_to, due_date, status, priority, created_by, created_at, updated_at)
       VALUES ($1, $2, $3, $4, 'follow_up', $5, $6, 'open', $7, 'system', NOW(), NOW())
       RETURNING id`,
      [
        context.lead_id || null,
        context.deal_id || null,
        title,
        description || null,
        assignedTo || null,
        dueDate.toISOString(),
        priority,
      ]
    );

    const taskId = taskRows[0]?.id as string;
    console.log(`[TriggerService] Task erstellt: ${taskId} — "${title}"`);

    return {
      success: true,
      action: 'create_task',
      details: `Aufgabe "${title}" erstellt${assignedTo ? ` → ${assignedTo}` : ''}, fällig: ${dueDate.toLocaleDateString('de-DE')}`,
    };
  }
}

// =============================================================================
// Singleton Export
// =============================================================================

let triggerServiceInstance: TriggerService | null = null;

export function getTriggerService(): TriggerService {
  if (!triggerServiceInstance) {
    triggerServiceInstance = new TriggerService();
  }
  return triggerServiceInstance;
}

export default getTriggerService;
