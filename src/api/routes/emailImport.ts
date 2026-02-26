// =============================================================================
// src/api/routes/emailImport.ts
// EML File Import API – parses .eml files and creates chat messages
// Reuses the same lead-lookup / conversation / message flow as EmailSyncService
// =============================================================================

import type { FastifyInstance } from 'fastify';
import { simpleParser, type ParsedMail, type AddressObject } from 'mailparser';
import { convert as htmlToText } from 'html-to-text';
import { z } from 'zod';
import { authenticateOrApiKey } from '../middleware/auth.js';
import { db } from '../../db/index.js';
import { getConversationService } from '../../services/conversationService.js';
import { getMessageService, type CreateMessageInput } from '../../services/messageService.js';
import { getOrganizationService } from '../../services/organizationService.js';
import { ValidationError } from '../../errors/index.js';
import type { MessageAttachment, MessageRecipient } from '../../types/index.js';

// =============================================================================
// Zod Schemas
// =============================================================================

const importEmlSchema = z.object({
  eml_raw: z.string().min(10, 'EML-Inhalt ist zu kurz oder leer'),
  lead_id: z.string().uuid().optional(),
  first_name: z.string().max(255).optional(),
  last_name: z.string().max(255).optional(),
  organization_id: z.string().uuid().optional(),
  new_organization_name: z.string().max(255).optional(),
  new_organization_domain: z.string().max(255).optional(),
}).refine(
  (data) => !data.organization_id || !data.new_organization_name,
  { message: 'Nur organization_id oder new_organization_name angeben, nicht beides.' }
);

const parseEmlSchema = z.object({
  eml_raw: z.string().min(10, 'EML-Inhalt ist zu kurz oder leer'),
});

// =============================================================================
// Types
// =============================================================================

interface ParsedEmailData {
  from: { address: string; name: string };
  to: Array<{ address: string; name: string }>;
  cc: Array<{ address: string; name: string }>;
  subject: string;
  bodyHtml: string | null;
  bodyText: string | null;
  date: Date;
  messageId: string;
  inReplyTo: string | null;
  attachments: MessageAttachment[];
}

// =============================================================================
// Helper: Extract Addresses from mailparser AddressObject
// =============================================================================

function extractFirstAddress(
  addressObj: AddressObject | AddressObject[] | undefined
): { address: string; name: string } {
  if (!addressObj) return { address: 'unknown@unknown.com', name: 'Unknown' };

  const list = Array.isArray(addressObj) ? addressObj : [addressObj];
  for (const group of list) {
    if (group.value?.length) {
      const first = group.value[0];
      return {
        address: first.address ?? 'unknown@unknown.com',
        name: first.name ?? first.address ?? 'Unknown',
      };
    }
  }
  return { address: 'unknown@unknown.com', name: 'Unknown' };
}

function extractAddresses(
  addressObj: AddressObject | AddressObject[] | undefined
): Array<{ address: string; name: string }> {
  if (!addressObj) return [];

  const list = Array.isArray(addressObj) ? addressObj : [addressObj];
  const result: Array<{ address: string; name: string }> = [];
  for (const group of list) {
    if (group.value) {
      for (const addr of group.value) {
        if (addr.address) {
          result.push({ address: addr.address, name: addr.name ?? addr.address });
        }
      }
    }
  }
  return result;
}

/** Derive suggested company name from email domain, e.g. user@dna-me.net → { name: 'dna-me', domain: 'dna-me.net' } */
function suggestCompanyFromEmail(email: string): { name: string; domain: string } | null {
  const at = email.indexOf('@');
  if (at === -1) return null;
  let domain = email.slice(at + 1).toLowerCase().replace(/^www\./, '');
  if (!domain) return null;
  const parts = domain.split('.');
  if (parts.length < 2) return null;
  const name = parts.slice(0, -1).join('.');
  return { name: name || domain, domain };
}

/** Split full name into first and last name. */
function splitFullName(fullName: string): { firstName: string; lastName: string } {
  const parts = (fullName || '').trim().split(/\s+/).filter(Boolean);
  const firstName = parts[0] || '';
  const lastName = parts.slice(1).join(' ') || '';
  return { firstName, lastName };
}

// =============================================================================
// Helper: Parse raw EML string
// =============================================================================

async function parseEmlString(raw: string): Promise<ParsedEmailData> {
  const parsed: ParsedMail = await simpleParser(raw);

  const from = extractFirstAddress(parsed.from);
  const to = extractAddresses(parsed.to);
  const cc = extractAddresses(parsed.cc);

  let bodyText = parsed.text ?? null;
  if (!bodyText && parsed.html) {
    bodyText = htmlToText(parsed.html, {
      wordwrap: 120,
      selectors: [
        { selector: 'img', format: 'skip' },
        { selector: 'a', options: { ignoreHref: true } },
      ],
    });
  }

  const attachments: MessageAttachment[] = (parsed.attachments ?? []).map((att) => ({
    filename: att.filename ?? 'unnamed',
    content_type: att.contentType ?? 'application/octet-stream',
    size: att.size ?? 0,
  }));

  return {
    from,
    to,
    cc,
    subject: parsed.subject ?? '(kein Betreff)',
    bodyHtml: typeof parsed.html === 'string' ? parsed.html : null,
    bodyText,
    date: parsed.date ?? new Date(),
    messageId: parsed.messageId ?? `import-${Date.now()}@eml-drop`,
    inReplyTo: (parsed.inReplyTo as string) ?? null,
    attachments,
  };
}

// =============================================================================
// Route Registration
// =============================================================================

export async function emailImportRoutes(fastify: FastifyInstance): Promise<void> {
  const conversationService = getConversationService();
  const messageService = getMessageService();

  // ===========================================================================
  // POST /api/v1/email/parse-eml
  // Parse .eml only; returns preview fields and suggested company (no DB write)
  // ===========================================================================
  fastify.post(
    '/email/parse-eml',
    {
      preHandler: authenticateOrApiKey,
      bodyLimit: 30 * 1024 * 1024,
      schema: {
        body: {
          type: 'object',
          required: ['eml_raw'],
          properties: { eml_raw: { type: 'string' } },
        },
        response: {
          200: {
            type: 'object',
            properties: {
              first_name: { type: 'string' },
              last_name: { type: 'string' },
              from_email: { type: 'string' },
              from_name: { type: 'string' },
              subject: { type: 'string' },
              date: { type: 'string' },
              body_preview: { type: 'string' },
              suggested_company_name: { type: 'string', nullable: true },
              suggested_company_domain: { type: 'string', nullable: true },
            },
          },
        },
      },
    },
    async (request) => {
      const body = parseEmlSchema.parse(request.body);
      let email: ParsedEmailData;
      try {
        email = await parseEmlString(body.eml_raw);
      } catch {
        throw new ValidationError('Die Datei konnte nicht als E-Mail geparst werden.');
      }
      const contactEmail = email.from.address.toLowerCase();
      const { firstName, lastName } = splitFullName(email.from.name);
      const bodyPreview = (email.bodyText || email.bodyHtml || '').slice(0, 300);
      const suggested = contactEmail !== 'unknown@unknown.com' ? suggestCompanyFromEmail(contactEmail) : null;
      return {
        first_name: firstName || contactEmail.split('@')[0],
        last_name: lastName,
        from_email: contactEmail,
        from_name: email.from.name,
        subject: email.subject,
        date: email.date.toISOString(),
        body_preview: bodyPreview,
        suggested_company_name: suggested?.name ?? null,
        suggested_company_domain: suggested?.domain ?? null,
      };
    },
  );

  // ===========================================================================
  // POST /api/v1/email/import-eml
  // Accepts raw .eml content, parses it, and imports it into the chat system
  // ===========================================================================
  fastify.post(
    '/email/import-eml',
    {
      preHandler: authenticateOrApiKey,
      bodyLimit: 30 * 1024 * 1024, // 30 MB – EML files with attachments can be large
      schema: {
        body: {
          type: 'object',
          required: ['eml_raw'],
          properties: {
            eml_raw: { type: 'string' },
            lead_id: { type: 'string', format: 'uuid' },
            first_name: { type: 'string' },
            last_name: { type: 'string' },
            organization_id: { type: 'string', format: 'uuid' },
            new_organization_name: { type: 'string' },
            new_organization_domain: { type: 'string' },
          },
        },
        response: {
          200: {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              data: {
                type: 'object',
                properties: {
                  lead_id: { type: 'string' },
                  lead_created: { type: 'boolean' },
                  conversation_id: { type: 'string' },
                  message_id: { type: 'string' },
                  from_email: { type: 'string' },
                  from_name: { type: 'string' },
                  subject: { type: 'string' },
                  date: { type: 'string' },
                },
              },
            },
          },
        },
      },
    },
    async (request) => {
      const body = importEmlSchema.parse(request.body);
      const userId = (request as any).user?.id ?? (request as any).apiKeyUserId ?? null;

      // 1. Parse the .eml content
      let email: ParsedEmailData;
      try {
        email = await parseEmlString(body.eml_raw);
      } catch (err) {
        throw new ValidationError('Die Datei konnte nicht als E-Mail geparst werden. Bitte eine gültige .eml-Datei verwenden.');
      }

      const contactEmail = email.from.address.toLowerCase();

      if (contactEmail === 'unknown@unknown.com') {
        throw new ValidationError('Kein gültiger Absender (From) in der E-Mail gefunden.');
      }

      // 2. Check for duplicate by Message-ID
      const existingMsg = await messageService.findByExternalId(email.messageId);
      if (existingMsg) {
        return {
          success: true,
          data: {
            lead_id: null,
            lead_created: false,
            conversation_id: existingMsg.conversation_id,
            message_id: existingMsg.id,
            from_email: contactEmail,
            from_name: email.from.name,
            subject: email.subject,
            date: email.date.toISOString(),
            duplicate: true,
          },
        };
      }

      // 3. Resolve organization_id (existing or create new)
      let organizationId: string | null = body.organization_id ?? null;
      if (body.new_organization_name?.trim()) {
        const orgService = getOrganizationService();
        const domain = body.new_organization_domain?.trim() || suggestCompanyFromEmail(contactEmail)?.domain || null;
        const org = await orgService.createOrganization({
          name: body.new_organization_name.trim(),
          domain: domain ?? undefined,
        });
        organizationId = org.id;
      }

      // 4. Resolve first/last name (body overrides or from email)
      const nameParts = (email.from.name || '').split(/\s+/).filter(Boolean);
      const defaultFirstName = nameParts[0] || contactEmail.split('@')[0];
      const defaultLastName = nameParts.slice(1).join(' ') || '';
      const firstName = (body.first_name?.trim() || defaultFirstName).slice(0, 255);
      const lastName = (body.last_name?.trim() ?? defaultLastName).slice(0, 255);

      // 5. Find or create lead
      let leadId = body.lead_id ?? null;
      let leadCreated = false;

      if (leadId) {
        const existingLead = await db.queryOne<{ id: string }>(
          'SELECT id FROM leads WHERE id = $1',
          [leadId],
        );
        if (!existingLead) {
          throw new ValidationError(`Lead mit ID ${leadId} nicht gefunden.`);
        }
        if (organizationId) {
          await db.execute(
            'UPDATE leads SET organization_id = $1, updated_at = NOW() WHERE id = $2',
            [organizationId, leadId],
          );
        }
      } else {
        const lead = await db.queryOne<{
          id: string;
          first_name: string | null;
          last_name: string | null;
          organization_id: string | null;
        }>(
          'SELECT id, first_name, last_name, organization_id FROM leads WHERE email = $1',
          [contactEmail],
        );

        if (lead) {
          leadId = lead.id;
          await db.execute(
            `UPDATE leads SET
               first_name = COALESCE(NULLIF(TRIM($2), ''), first_name),
               last_name  = COALESCE(NULLIF(TRIM($3), ''), last_name),
               organization_id = COALESCE($4, organization_id),
               updated_at = NOW()
             WHERE id = $1`,
            [lead.id, firstName, lastName, organizationId],
          );
        } else {
          const inserted = await db.queryOne<{ id: string }>(
            `INSERT INTO leads (
              email, first_name, last_name, organization_id, status, lifecycle_stage,
              first_touch_source, first_touch_date, created_at, updated_at
            ) VALUES ($1, $2, $3, $4, 'new', 'subscriber', 'eml_import', NOW(), NOW(), NOW())
            RETURNING id`,
            [contactEmail, firstName, lastName, organizationId],
          );

          if (!inserted) {
            throw new ValidationError('Lead konnte nicht erstellt werden.');
          }

          leadId = inserted.id;
          leadCreated = true;
        }
      }

      // 6. Find or create conversation (same logic as EmailSyncService)
      const deal = await db.queryOne<{ id: string }>(
        `SELECT id FROM deals
         WHERE lead_id = $1 AND status = 'open'
         ORDER BY created_at DESC
         LIMIT 1`,
        [leadId],
      );

      const conversation = await conversationService.findOrCreateConversation(
        leadId,
        deal?.id ?? null,
        userId,
        email.subject,
        true,
      );

      // 7. Build recipients list
      const recipients: MessageRecipient[] = [
        ...email.to.map((r) => ({ email: r.address, name: r.name, type: 'to' as const })),
        ...email.cc.map((r) => ({ email: r.address, name: r.name, type: 'cc' as const })),
      ];

      // 8. Create message with the original email timestamp for correct ordering
      const messageInput: CreateMessageInput = {
        message_type: 'email',
        direction: 'inbound',
        sender_email: contactEmail,
        sender_name: email.from.name !== contactEmail ? email.from.name : undefined,
        recipients,
        subject: email.subject,
        body_html: email.bodyHtml ?? undefined,
        body_text: email.bodyText ?? undefined,
        external_id: email.messageId,
        email_thread_id: email.inReplyTo ?? undefined,
        skip_send: true,
        sent_at: email.date.toISOString(),
        metadata: {
          imported: true,
          import_source: 'eml_drop',
          original_date: email.date.toISOString(),
        },
        attachments: email.attachments.length > 0 ? email.attachments : undefined,
      };

      const message = await messageService.createMessage(
        conversation.id,
        messageInput,
        userId,
      );
      // Activity event + last_activity are recorded inside messageService.createMessage

      return {
        success: true,
        data: {
          lead_id: leadId,
          lead_created: leadCreated,
          conversation_id: conversation.id,
          message_id: message.id,
          from_email: contactEmail,
          from_name: email.from.name,
          subject: email.subject,
          date: email.date.toISOString(),
        },
      };
    },
  );
}

export default emailImportRoutes;
