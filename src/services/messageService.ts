// =============================================================================
// src/services/messageService.ts
// Message Service – core business logic for all chat message types
// Used by EmailSyncService, Chat API routes, and Background Workers
// =============================================================================

import nodemailer, { type Transporter } from 'nodemailer';
import { db } from '../db/index.js';
import { getRedisConnection } from '../config/redis.js';
import { getEmailService } from './emailService.js';
import { NotFoundError, ValidationError, AuthorizationError, BusinessLogicError } from '../errors/index.js';
import { decrypt } from '../utils/crypto.js';
import { getLinkedInService } from './linkedinService.js';
import { recordActivity, type ActivitySource } from './activityService.js';
import type {
  Message,
  MessageType,
  MessageDirection,
  MessageStatus,
  MessageRecipient,
  MessageAttachment,
  Conversation,
  EmailAccount,
  PaginatedResponse,
} from '../types/index.js';

// =============================================================================
// Input / DTO Types
// =============================================================================

export interface CreateMessageInput {
  message_type: MessageType;
  direction?: MessageDirection;
  sender_email?: string;
  sender_name?: string;
  recipients?: MessageRecipient[];
  subject?: string;
  body_html?: string;
  body_text?: string;
  metadata?: Record<string, unknown>;
  attachments?: MessageAttachment[];
  external_id?: string;
  email_thread_id?: string;
  /** If true, skip sending and just persist (used by sync workers). */
  skip_send?: boolean;
  /** Override the sent_at timestamp (e.g. when importing historical emails). */
  sent_at?: string;
}

export interface GetMessagesOptions {
  page?: number;
  limit?: number;
  sort_order?: 'asc' | 'desc';
}

export interface MessageWithSender extends Message {
  sender_member_name?: string;
  sender_member_email?: string;
  sender_avatar?: string | null;
}

// =============================================================================
// Redis Pub/Sub Channel Helpers
// =============================================================================

function channelMessages(conversationId: string): string {
  return `conversation:${conversationId}:messages`;
}

function channelTyping(conversationId: string): string {
  return `conversation:${conversationId}:typing`;
}

// =============================================================================
// MessageService Class
// =============================================================================

export class MessageService {

  // ===========================================================================
  // Create Message
  // ===========================================================================

  /**
   * Creates a new message inside a conversation.
   *
   * Flow:
   *  1. Validate conversation exists (and optionally check access)
   *  2. Insert message with status='draft'
   *  3. If type='email' and !skip_send → send via SMTP, update status
   *  4. Update conversation.last_message_at
   *  5. Publish real-time event via Redis Pub/Sub
   */
  async createMessage(
    conversationId: string,
    data: CreateMessageInput,
    userId?: string
  ): Promise<Message> {
    // 1. Verify conversation exists
    const conversation = await db.queryOne<Conversation>(
      'SELECT * FROM conversations WHERE id = $1',
      [conversationId]
    );

    if (!conversation) {
      throw new NotFoundError('Conversation', conversationId);
    }

    // Determine direction
    const direction: MessageDirection =
      data.direction ?? (data.message_type === 'internal_note' || data.message_type === 'task'
        ? 'internal'
        : 'outbound');

    // Auto-populate recipients for outbound emails from the lead's email
    if (
      data.message_type === 'email' &&
      direction === 'outbound' &&
      (!data.recipients || data.recipients.length === 0) &&
      conversation.lead_id
    ) {
      const lead = await db.queryOne<{ email: string; first_name: string | null; last_name: string | null }>(
        'SELECT email, first_name, last_name FROM leads WHERE id = $1',
        [conversation.lead_id]
      );
      if (lead?.email) {
        const name = [lead.first_name, lead.last_name].filter(Boolean).join(' ') || undefined;
        data.recipients = [{ email: lead.email, name, type: 'to' as const }];
      }
    }

    // Auto-populate sender info from team member if not provided
    if (direction === 'outbound' && userId && !data.sender_email) {
      const member = await db.queryOne<{ email: string; name: string | null }>(
        'SELECT email, name FROM team_members WHERE id = $1',
        [userId]
      );
      if (member) {
        data.sender_email = member.email;
        data.sender_name = data.sender_name ?? member.name ?? undefined;
      }
    }

    // Determine initial status
    const initialStatus: MessageStatus =
      data.skip_send || direction === 'internal' || direction === 'inbound'
        ? 'sent'
        : 'draft';

    // Generate thread ID for outbound emails if not provided
    let emailThreadId = data.email_thread_id ?? null;
    if (!emailThreadId && data.message_type === 'email' && direction === 'outbound') {
      emailThreadId = `<conv-${conversationId}@dna-me.crm>`;
    }

    // 2. Insert message
    const message = await db.queryOne<Message>(
      `INSERT INTO messages (
        conversation_id, sender_id, message_type, direction, status,
        sender_email, sender_name, recipients, subject,
        body_html, body_text, metadata, attachments,
        external_id, email_thread_id, sent_at,
        created_at, updated_at
      ) VALUES (
        $1, $2, $3, $4, $5,
        $6, $7, $8::jsonb, $9,
        $10, $11, $12::jsonb, $13::jsonb,
        $14, $15, $16,
        NOW(), NOW()
      )
      RETURNING *`,
      [
        conversationId,
        userId ?? null,
        data.message_type,
        direction,
        initialStatus,
        data.sender_email ?? null,
        data.sender_name ?? null,
        JSON.stringify(data.recipients ?? []),
        data.subject ?? null,
        data.body_html ?? null,
        data.body_text ?? null,
        JSON.stringify(data.metadata ?? {}),
        JSON.stringify(data.attachments ?? []),
        data.external_id ?? null,
        emailThreadId,
        data.sent_at ?? (initialStatus === 'sent' ? new Date().toISOString() : null),
      ]
    );

    if (!message) {
      throw new BusinessLogicError('Failed to create message');
    }

    // 3. If outbound and not skipped → send via appropriate channel (non-blocking)
    //    Fire-and-forget: the HTTP response returns immediately with the created message.
    //    The actual send updates message status in the DB asynchronously.
    if (direction === 'outbound' && !data.skip_send) {
      const sendPromise = (async () => {
        try {
          if (data.message_type === 'email') {
            await this.sendEmailForMessage(message, conversation, userId);
          } else if (data.message_type === 'linkedin') {
            await this.sendLinkedInForMessage(message, userId);
          }
        } catch (err) {
          console.error(`[MessageService] Async send failed for message ${message.id}:`, err);
        }
      })();

      // Don't await — let the send happen in the background
      sendPromise.catch(() => {});
    }

    // 4. Update conversation.last_message_at
    await this.updateConversationLastMessage(conversationId);

    // 5. Publish real-time event
    await this.publishMessageEvent(conversationId, message);

    // 6. Record activity for "Letzte Aktivitäten" (dashboard)
    if (conversation.lead_id) {
      const meta = (data.metadata ?? {}) as Record<string, unknown>;
      const eventType =
        direction === 'inbound'
          ? 'email_received'
          : direction === 'outbound'
            ? 'email_sent'
            : 'note_created';
      const source: ActivitySource =
        meta.import_source === 'eml_drop'
          ? 'import'
          : meta.sync_source === 'imap'
            ? 'api'
            : 'manual';
      const recipient =
        direction === 'outbound'
          ? (data.recipients?.[0] as { email?: string; name?: string } | undefined)
          : undefined;
      recordActivity({
        lead_id: conversation.lead_id,
        event_type: eventType,
        event_category: 'activity',
        source,
        metadata: {
          subject: data.subject,
          sender_email: data.sender_email,
          sender_name: data.sender_name,
          direction,
          message_id: message.id,
          ...(recipient && { to_email: recipient.email, to_name: recipient.name }),
        },
        occurred_at: message.sent_at ? new Date(message.sent_at) : undefined,
        update_lead_activity: true,
      }).catch((err) => {
        console.warn('[MessageService] Failed to record activity event:', (err as Error).message);
      });
    }

    return message;
  }

  // ===========================================================================
  // Get Messages (paginated)
  // ===========================================================================

  async getMessages(
    conversationId: string,
    options: GetMessagesOptions = {}
  ): Promise<PaginatedResponse<MessageWithSender>> {
    // Verify conversation exists
    const conversation = await db.queryOne<Conversation>(
      'SELECT id FROM conversations WHERE id = $1',
      [conversationId]
    );
    if (!conversation) {
      throw new NotFoundError('Conversation', conversationId);
    }

    const page = options.page ?? 1;
    const limit = Math.min(options.limit ?? 50, 100);
    const offset = (page - 1) * limit;
    const sortOrder = (options.sort_order ?? 'asc').toUpperCase();

    // Count total
    const countResult = await db.queryOne<{ count: string }>(
      'SELECT COUNT(*) as count FROM messages WHERE conversation_id = $1',
      [conversationId]
    );
    const total = parseInt(countResult?.count ?? '0', 10);
    const totalPages = Math.ceil(total / limit);

    // Fetch with sender info
    const messages = await db.query<MessageWithSender>(
      `SELECT
        m.*,
        tm.name  AS sender_member_name,
        tm.email AS sender_member_email,
        tm.avatar AS sender_avatar
       FROM messages m
       LEFT JOIN team_members tm ON tm.id = m.sender_id
       WHERE m.conversation_id = $1
       ORDER BY m.sent_at ${sortOrder} NULLS LAST, m.created_at ${sortOrder}
       LIMIT $2 OFFSET $3`,
      [conversationId, limit, offset]
    );

    return {
      data: messages,
      pagination: {
        page,
        limit,
        total,
        total_pages: totalPages,
        has_next: page < totalPages,
        has_prev: page > 1,
      },
    };
  }

  // ===========================================================================
  // Get Messages Since (for polling / SSE catch-up)
  // ===========================================================================

  async getMessagesSince(
    conversationId: string,
    since: string
  ): Promise<MessageWithSender[]> {
    return db.query<MessageWithSender>(
      `SELECT
        m.*,
        tm.name  AS sender_member_name,
        tm.email AS sender_member_email,
        tm.avatar AS sender_avatar
       FROM messages m
       LEFT JOIN team_members tm ON tm.id = m.sender_id
       WHERE m.conversation_id = $1
         AND m.created_at > $2
       ORDER BY m.created_at ASC`,
      [conversationId, since]
    );
  }

  // ===========================================================================
  // Get Single Message
  // ===========================================================================

  async getMessageById(messageId: string): Promise<Message> {
    const message = await db.queryOne<Message>(
      'SELECT * FROM messages WHERE id = $1',
      [messageId]
    );
    if (!message) {
      throw new NotFoundError('Message', messageId);
    }
    return message;
  }

  // ===========================================================================
  // Mark As Read
  // ===========================================================================

  async markAsRead(messageId: string, _userId: string): Promise<Message> {
    const message = await this.getMessageById(messageId);

    if (message.read_at) {
      return message;
    }

    const updated = await db.queryOne<Message>(
      `UPDATE messages
       SET read_at = NOW(), updated_at = NOW()
       WHERE id = $1
       RETURNING *`,
      [messageId]
    );

    return updated!;
  }

  // ===========================================================================
  // Mark Conversation Messages As Read
  // ===========================================================================

  async markConversationAsRead(
    conversationId: string,
    userId: string
  ): Promise<number> {
    const result = await db.execute(
      `UPDATE messages
       SET read_at = NOW(), updated_at = NOW()
       WHERE conversation_id = $1
         AND read_at IS NULL
         AND direction = 'inbound'`,
      [conversationId]
    );
    return result;
  }

  // ===========================================================================
  // Update Message Status
  // ===========================================================================

  async updateMessageStatus(
    messageId: string,
    status: MessageStatus,
    errorMessage?: string
  ): Promise<Message> {
    const setClauses = ['status = $2', 'updated_at = NOW()'];
    const params: unknown[] = [messageId, status];
    let paramIdx = 3;

    if (status === 'sent') {
      setClauses.push('sent_at = COALESCE(sent_at, NOW())');
    }

    if (status === 'error' && errorMessage) {
      setClauses.push(`error_message = $${paramIdx}`);
      params.push(errorMessage);
      paramIdx++;
    }

    if (status === 'sent' || status === 'draft') {
      setClauses.push('error_message = NULL');
    }

    const updated = await db.queryOne<Message>(
      `UPDATE messages
       SET ${setClauses.join(', ')}
       WHERE id = $1
       RETURNING *`,
      params
    );

    if (!updated) {
      throw new NotFoundError('Message', messageId);
    }

    // Publish status change to BOTH channels so SSE clients get the update
    await this.publishMessageEvent(updated.conversation_id, updated);
    await this.publishStatusChangeEvent(updated.conversation_id, updated);

    return updated;
  }

  // ===========================================================================
  // Retry Failed Message
  // ===========================================================================

  async retryMessage(messageId: string, userId: string): Promise<Message> {
    const message = await this.getMessageById(messageId);

    if (message.status !== 'error') {
      throw new BusinessLogicError('Only messages with status "error" can be retried', {
        current_status: message.status,
      });
    }

    const conversation = await db.queryOne<Conversation>(
      'SELECT * FROM conversations WHERE id = $1',
      [message.conversation_id]
    );

    if (!conversation) {
      throw new NotFoundError('Conversation', message.conversation_id);
    }

    // Reset to 'sending'
    await this.updateMessageStatus(messageId, 'sending');

    // Re-send
    if (message.message_type === 'email') {
      await this.sendEmailForMessage(message, conversation, userId);
    } else if (message.message_type === 'linkedin') {
      await this.sendLinkedInForMessage(message, userId);
    }

    return this.getMessageById(messageId);
  }

  // ===========================================================================
  // Get Unread Count
  // ===========================================================================

  async getUnreadCount(conversationId: string): Promise<number> {
    const result = await db.queryOne<{ count: string }>(
      `SELECT COUNT(*) as count
       FROM messages
       WHERE conversation_id = $1
         AND read_at IS NULL
         AND direction = 'inbound'`,
      [conversationId]
    );
    return parseInt(result?.count ?? '0', 10);
  }

  // ===========================================================================
  // Get Unread Counts (batch – for conversation list)
  // ===========================================================================

  async getUnreadCounts(
    conversationIds: string[]
  ): Promise<Record<string, number>> {
    if (conversationIds.length === 0) return {};

    const rows = await db.query<{ conversation_id: string; count: string }>(
      `SELECT conversation_id, COUNT(*) as count
       FROM messages
       WHERE conversation_id = ANY($1::uuid[])
         AND read_at IS NULL
         AND direction = 'inbound'
       GROUP BY conversation_id`,
      [conversationIds]
    );

    const counts: Record<string, number> = {};
    for (const id of conversationIds) {
      counts[id] = 0;
    }
    for (const row of rows) {
      counts[row.conversation_id] = parseInt(row.count, 10);
    }
    return counts;
  }

  // ===========================================================================
  // Find Message by External ID (for dedup during email sync)
  // ===========================================================================

  async findByExternalId(externalId: string): Promise<Message | null> {
    return db.queryOne<Message>(
      'SELECT * FROM messages WHERE external_id = $1',
      [externalId]
    );
  }

  // ===========================================================================
  // Delete Message
  // ===========================================================================

  async deleteMessage(messageId: string, userId: string): Promise<void> {
    const message = await this.getMessageById(messageId);

    // Only drafts or internal notes by the same user can be deleted
    if (message.sender_id !== userId && message.status !== 'draft') {
      throw new AuthorizationError('You can only delete your own draft or internal messages');
    }

    await db.execute('DELETE FROM messages WHERE id = $1', [messageId]);

    // Update last_message_at
    await this.updateConversationLastMessage(message.conversation_id);
  }

  // ===========================================================================
  // PRIVATE: Send Email for a Message record
  // ===========================================================================

  /**
   * Sends an email for the given message using either the user's own
   * email account (from email_accounts table) or the system SMTP.
   */
  private async sendEmailForMessage(
    message: Message,
    conversation: Conversation,
    userId?: string
  ): Promise<void> {
    // Set status to 'sending'
    await this.updateMessageStatus(message.id, 'sending');

    try {
      const recipients = (message.recipients ?? []) as MessageRecipient[];
      const toAddresses = recipients
        .filter((r) => r.type === 'to')
        .map((r) => r.email);
      const ccAddresses = recipients
        .filter((r) => r.type === 'cc')
        .map((r) => r.email);
      const bccAddresses = recipients
        .filter((r) => r.type === 'bcc')
        .map((r) => r.email);

      if (toAddresses.length === 0) {
        throw new ValidationError('No "to" recipients specified');
      }

      // Try user's own email account first
      let sent = false;
      if (userId) {
        sent = await this.sendViaUserAccount(
          userId,
          message,
          toAddresses,
          ccAddresses,
          bccAddresses
        );
      }

      // Fall back to system SMTP
      if (!sent) {
        const emailService = getEmailService();
        const replyTo = message.sender_email ?? undefined;
        const result = await emailService.sendEmail({
          to: toAddresses,
          cc: ccAddresses.length > 0 ? ccAddresses : undefined,
          bcc: bccAddresses.length > 0 ? bccAddresses : undefined,
          subject: message.subject || 'Nachricht von DNA ME',
          html: message.body_html ?? undefined,
          text: message.body_text ?? undefined,
          fromName: message.sender_name ?? undefined,
          replyTo,
        });

        if (!result.success) {
          throw new Error(result.error ?? 'Unknown SMTP error');
        }

        // Store external message-id
        if (result.messageId) {
          await db.execute(
            `UPDATE messages SET external_id = $1 WHERE id = $2 AND external_id IS NULL`,
            [result.messageId, message.id]
          );
        }
      }

      // Mark as sent
      await this.updateMessageStatus(message.id, 'sent');
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : 'Unknown send error';
      console.error(`[MessageService] Email send failed for message ${message.id}:`, errMsg);
      await this.updateMessageStatus(message.id, 'error', errMsg);
    }
  }

  // ===========================================================================
  // PRIVATE: Send via user's own SMTP account
  // ===========================================================================

  private async sendViaUserAccount(
    userId: string,
    message: Message,
    to: string[],
    cc: string[],
    bcc: string[]
  ): Promise<boolean> {
    // Look up user's email account
    const account = await db.queryOne<EmailAccount>(
      `SELECT * FROM email_accounts
       WHERE team_member_id = $1
         AND smtp_host IS NOT NULL
         AND smtp_username IS NOT NULL
         AND smtp_password IS NOT NULL
       LIMIT 1`,
      [userId]
    );

    if (!account) return false;

    let transport: Transporter | null = null;
    try {
      const smtpPassword = this.decryptSafe(account.smtp_password!);

      transport = nodemailer.createTransport({
        host: account.smtp_host!,
        port: account.smtp_port ?? 587,
        secure: (account.smtp_port ?? 587) === 465,
        auth: {
          user: account.smtp_username!,
          pass: smtpPassword,
        },
        tls: { rejectUnauthorized: false },
      });

      const info = await transport.sendMail({
        from: message.sender_name
          ? `${message.sender_name} <${account.email_address}>`
          : account.email_address,
        to: to.join(', '),
        cc: cc.length > 0 ? cc.join(', ') : undefined,
        bcc: bcc.length > 0 ? bcc.join(', ') : undefined,
        subject: message.subject ?? '',
        html: message.body_html ?? undefined,
        text: message.body_text ?? undefined,
        inReplyTo: message.email_thread_id ?? undefined,
        references: message.email_thread_id ?? undefined,
      });

      // Store external message-id
      if (info.messageId) {
        await db.execute(
          `UPDATE messages SET external_id = $1 WHERE id = $2 AND external_id IS NULL`,
          [info.messageId, message.id]
        );
      }

      console.log(
        `[MessageService] Email sent via user account ${account.email_address}: ${message.subject}`
      );
      return true;
    } catch (error) {
      console.warn(
        `[MessageService] User SMTP send failed, will fall back to system SMTP:`,
        (error as Error).message
      );
      return false;
    } finally {
      if (transport) {
        transport.close();
      }
    }
  }

  // ===========================================================================
  // PRIVATE: Send LinkedIn message for a Message record
  // ===========================================================================

  /**
   * Attempts to send a LinkedIn message using the LinkedInService.
   * Falls back gracefully when messaging is not available (manual fallback mode).
   */
  private async sendLinkedInForMessage(
    message: Message,
    userId?: string
  ): Promise<void> {
    await this.updateMessageStatus(message.id, 'sending');

    try {
      if (!userId) {
        throw new Error('User ID required for LinkedIn messaging');
      }

      const recipients = (message.recipients ?? []) as MessageRecipient[];
      const recipientUrl = recipients[0]?.email; // LinkedIn profile URL stored in email field
      const linkedinUrl = (message.metadata as Record<string, unknown>)?.linkedin_profile_url as string | undefined;
      const targetUrl = linkedinUrl || recipientUrl;

      if (!targetUrl || !targetUrl.includes('linkedin.com')) {
        throw new Error(
          'No valid LinkedIn profile URL found. ' +
          'Provide the LinkedIn URL in metadata.linkedin_profile_url or as the first recipient.'
        );
      }

      const linkedinService = getLinkedInService();
      const result = await linkedinService.sendMessage(
        userId,
        targetUrl,
        message.body_text || message.body_html || ''
      );

      if (result.success) {
        await this.updateMessageStatus(message.id, 'sent');
      } else {
        // Not a hard error – messaging may not be available in current mode
        await this.updateMessageStatus(
          message.id,
          'error',
          `LinkedIn ${result.mode}: ${result.details}`
        );
      }
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : 'Unknown LinkedIn error';
      console.error(`[MessageService] LinkedIn send failed for message ${message.id}:`, errMsg);
      await this.updateMessageStatus(message.id, 'error', errMsg);
    }
  }

  // ===========================================================================
  // PRIVATE: Update conversation.last_message_at
  // ===========================================================================

  private async updateConversationLastMessage(conversationId: string): Promise<void> {
    await db.execute(
      `UPDATE conversations
       SET last_message_at = (
         SELECT MAX(COALESCE(sent_at, created_at))
         FROM messages
         WHERE conversation_id = $1
       ),
       updated_at = NOW()
       WHERE id = $1`,
      [conversationId]
    );
  }

  // ===========================================================================
  // PRIVATE: Publish real-time event via Redis Pub/Sub
  // ===========================================================================

  private async publishMessageEvent(
    conversationId: string,
    message: Message
  ): Promise<void> {
    try {
      const redis = getRedisConnection();
      const payload = JSON.stringify({
        type: 'new_message',
        conversation_id: conversationId,
        message,
      });
      await redis.publish(channelMessages(conversationId), payload);
    } catch (error) {
      // Non-critical – log but don't fail the operation
      console.warn(
        '[MessageService] Failed to publish Redis event:',
        (error as Error).message
      );
    }
  }

  // ===========================================================================
  // PRIVATE: Publish message status change to the dedicated status channel
  // ===========================================================================

  private async publishStatusChangeEvent(
    conversationId: string,
    message: Message
  ): Promise<void> {
    try {
      const redis = getRedisConnection();
      const payload = JSON.stringify({
        type: 'message_status_update',
        conversation_id: conversationId,
        message,
      });
      await redis.publish(`conversation:${conversationId}:status`, payload);
    } catch (error) {
      console.warn(
        '[MessageService] Failed to publish status change event:',
        (error as Error).message
      );
    }
  }

  // ===========================================================================
  // PRIVATE: Safe decrypt helper
  // ===========================================================================

  private decryptSafe(value: string): string {
    try {
      return decrypt(value);
    } catch {
      // If decryption fails, assume plaintext (dev/migration scenario)
      return value;
    }
  }

  // ===========================================================================
  // Typing Indicator helpers
  // ===========================================================================

  /**
   * Publish a typing event for a conversation.
   * Stores a short-lived key in Redis (TTL 3s) and broadcasts via Pub/Sub.
   */
  async publishTypingEvent(
    conversationId: string,
    userId: string,
    userName: string
  ): Promise<void> {
    try {
      const redis = getRedisConnection();
      const data = JSON.stringify({ userId, name: userName });

      await redis.setex(`typing:${conversationId}:${userId}`, 3, data);

      await redis.publish(
        channelTyping(conversationId),
        JSON.stringify({ userId, name: userName, typing: true })
      );
    } catch (error) {
      console.warn(
        '[MessageService] Failed to publish typing event:',
        (error as Error).message
      );
    }
  }

  /**
   * Get currently typing users for a conversation.
   */
  async getTypingUsers(
    conversationId: string
  ): Promise<Array<{ userId: string; name: string }>> {
    try {
      const redis = getRedisConnection();
      const pattern = `typing:${conversationId}:*`;
      const keys = await redis.keys(pattern);

      if (keys.length === 0) return [];

      const pipeline = redis.pipeline();
      for (const key of keys) {
        pipeline.get(key);
      }
      const results = await pipeline.exec();

      const users: Array<{ userId: string; name: string }> = [];
      if (results) {
        for (const [err, val] of results) {
          if (!err && val) {
            try {
              users.push(JSON.parse(val as string));
            } catch {
              // skip malformed entries
            }
          }
        }
      }
      return users;
    } catch {
      return [];
    }
  }
}

// =============================================================================
// Singleton Export
// =============================================================================

let messageServiceInstance: MessageService | null = null;

export function getMessageService(): MessageService {
  if (!messageServiceInstance) {
    messageServiceInstance = new MessageService();
  }
  return messageServiceInstance;
}

export const messageService = {
  get instance() {
    return getMessageService();
  },
};

export default messageService;
