// =============================================================================
// src/services/triggerService.ts
// Trigger Service - Führt verschiedene Aktionen für Stage-Trigger aus
// =============================================================================

import { db } from '../db/index.js';
import { getEmailService, EmailOptions } from './emailService.js';
import { getMocoService } from '../integrations/moco.js';
import { getSlackService } from '../integrations/slack.js';
import { getCituroService } from '../integrations/cituro.js';
import { NotFoundError, ValidationError } from '../errors/index.js';
import type { Lead, Deal } from '../types/index.js';

// =============================================================================
// Types
// =============================================================================

export type TriggerAction =
  | 'send_email'
  | 'create_moco_project'
  | 'create_moco_customer'
  | 'create_moco_offer'
  | 'send_cituro_booking'
  | 'send_slack_message';

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
        case 'send_email':
          return await this.actionSendEmail(config, context);

        case 'create_moco_project':
          return await this.actionCreateMocoProject(config, context);

        case 'create_moco_customer':
          return await this.actionCreateMocoCustomer(config, context);

        case 'create_moco_offer':
          return await this.actionCreateMocoOffer(config, context);

        case 'send_cituro_booking':
          return await this.actionSendCituroBooking(config, context);

        case 'send_slack_message':
          return await this.actionSendSlackMessage(config, context);

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

    return {
      success: result.success,
      action: 'send_email',
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
    // Hinweis: Moco hat keine explizite "Projekt"-API, daher erstellen wir einen Kunden
    // Falls später Projekte unterstützt werden, kann dies erweitert werden
    console.warn('[TriggerService] create_moco_project wird als create_moco_customer ausgeführt');
    return this.actionCreateMocoCustomer(config, context);
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
      `SELECT l.*, o.name as org_name, o.vat_id, o.address, o.country
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

    const customerName = (lead as Lead & { org_name?: string }).org_name || 
                         `${lead.first_name || ''} ${lead.last_name || ''}`.trim() || 
                         lead.email;

    const mocoId = await this.mocoService.createCustomer({
      name: customerName,
      email: lead.email,
      vat_id: (lead as Lead & { vat_id?: string }).vat_id,
      address: (lead as Lead & { address?: string }).address,
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

    // Sende E-Mail mit Booking-Link
    const emailSubject = (config.email_subject as string) || 'Terminvereinbarung - DNA ME';
    const emailHtml = (config.email_html as string) || 
      `<p>Hallo ${lead.first_name || 'Liebe/r Interessent/in'},</p>
       <p>Vielen Dank für Ihr Interesse. Bitte wählen Sie einen passenden Termin:</p>
       <p><a href="${bookingLink.url}" style="background-color: #6C5CE7; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; display: inline-block;">Termin buchen</a></p>
       <p>Oder kopieren Sie diesen Link: ${bookingLink.url}</p>
       <p>Mit freundlichen Grüßen<br>Ihr DNA ME Team</p>`;

    const emailResult = await this.emailService.sendEmail({
      to: lead.email,
      subject: emailSubject,
      html: emailHtml
    });

    return {
      success: emailResult.success && !!bookingLink.url,
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
        action: 'send_email',
        description: 'E-Mail über SMTP senden',
        required_fields: ['to', 'subject']
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
