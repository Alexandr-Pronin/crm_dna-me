// =============================================================================
// src/services/conversationService.ts
// Conversation Service – CRUD and business logic for chat conversations
// Provides access control, filtering, and integration with MessageService
// =============================================================================

import { db } from '../db/index.js';
import { getMessageService } from './messageService.js';
import {
  NotFoundError,
  ValidationError,
  AuthorizationError,
  BusinessLogicError,
} from '../errors/index.js';
import type {
  Conversation,
  ConversationType,
  ConversationStatus,
  PaginatedResponse,
} from '../types/index.js';
import type { MessageWithSender, GetMessagesOptions } from './messageService.js';

// =============================================================================
// Input / DTO Types
// =============================================================================

export interface CreateConversationInput {
  lead_id?: string;
  deal_id?: string;
  type?: ConversationType;
  subject?: string;
  participant_emails?: string[];
}

export interface UpdateConversationInput {
  subject?: string;
  status?: ConversationStatus;
  participant_emails?: string[];
  type?: ConversationType;
  assigned_to_id?: string | null;
}

export interface ConversationFilters {
  lead_id?: string;
  deal_id?: string;
  type?: ConversationType;
  status?: ConversationStatus;
  search?: string;
  page?: number;
  limit?: number;
  sort_by?: 'created_at' | 'updated_at' | 'last_message_at';
  sort_order?: 'asc' | 'desc';
}

export interface ConversationWithDetails extends Conversation {
  lead_email?: string;
  lead_name?: string;
  deal_name?: string;
  deal_status?: string;
  created_by_name?: string;
  created_by_email?: string;
  created_by_avatar?: string | null;
  initiated_by_lead?: boolean;
  assigned_to_name?: string | null;
  assigned_to_avatar?: string | null;
  unread_count?: number;
  message_count?: number;
  last_message_preview?: string;
}

// =============================================================================
// ConversationService Class
// =============================================================================

export class ConversationService {

  // ===========================================================================
  // Access Control Check
  // ===========================================================================

  /**
   * Checks whether a user has access to a given conversation.
   *
   * Access is granted if:
   *  - The user created the conversation
   *  - The user's email is in participant_emails
   *  - The user is assigned to a deal linked to the conversation
   *  - The user is assigned to a deal whose lead matches the conversation lead
   *  - The user has role 'admin'
   */
  async checkAccess(conversationId: string, userId: string, userEmail: string, userRole: string): Promise<boolean> {
    if (userRole === 'admin') return true;

    const result = await db.queryOne<{ has_access: boolean }>(
      `SELECT EXISTS(
        SELECT 1 FROM conversations c
        LEFT JOIN deals d ON d.id = c.deal_id
        LEFT JOIN leads l ON l.id = c.lead_id
        LEFT JOIN deals dl ON dl.lead_id = l.id
        WHERE c.id = $1 AND (
          c.created_by_id = $2
          OR c.participant_emails @> $3::jsonb
          OR d.assigned_to = $4
          OR dl.assigned_to = $4
        )
      ) AS has_access`,
      [conversationId, userId, JSON.stringify([userEmail]), userEmail]
    );

    return result?.has_access ?? false;
  }

  /**
   * Asserts that a user has access to a conversation, throws AuthorizationError otherwise.
   */
  async assertAccess(conversationId: string, userId: string, userEmail: string, userRole: string): Promise<void> {
    const hasAccess = await this.checkAccess(conversationId, userId, userEmail, userRole);
    if (!hasAccess) {
      throw new AuthorizationError('You do not have access to this conversation');
    }
  }

  // ===========================================================================
  // Get Conversations (paginated, filtered, with access control)
  // ===========================================================================

  async getConversations(
    filters: ConversationFilters,
    userId: string,
    userEmail: string,
    userRole: string
  ): Promise<PaginatedResponse<ConversationWithDetails>> {
    const page = filters.page ?? 1;
    const limit = Math.min(filters.limit ?? 20, 100);
    const offset = (page - 1) * limit;
    const sortBy = filters.sort_by ?? 'last_message_at';
    const sortOrder = (filters.sort_order ?? 'desc').toUpperCase();

    const allowedSortColumns: Record<string, string> = {
      created_at: 'c.created_at',
      updated_at: 'c.updated_at',
      last_message_at: 'c.last_message_at',
    };
    const sortColumn = allowedSortColumns[sortBy] ?? 'c.last_message_at';

    // Build WHERE clauses
    const conditions: string[] = [];
    const params: unknown[] = [];
    let paramIdx = 1;

    // Access control: admins see all; non-admins see:
    //  - own conversations (created_by_id = me)
    //  - conversations where I'm a participant
    //  - conversations assigned to me
    //  - imported conversations that are not assigned to anyone (visible to whole team)
    //  - conversations whose deal/lead is assigned to me
    if (userRole !== 'admin') {
      conditions.push(`(
        c.created_by_id = $${paramIdx}
        OR c.participant_emails @> $${paramIdx + 1}::jsonb
        OR c.assigned_to_id = $${paramIdx}
        OR (c.imported_at IS NOT NULL AND c.assigned_to_id IS NULL)
        OR d.assigned_to = $${paramIdx + 2}
        OR dl.assigned_to = $${paramIdx + 2}
      )`);
      params.push(userId, JSON.stringify([userEmail]), userEmail);
      paramIdx += 3;
    }

    if (filters.lead_id) {
      conditions.push(`c.lead_id = $${paramIdx}`);
      params.push(filters.lead_id);
      paramIdx++;
    }

    if (filters.deal_id) {
      conditions.push(`c.deal_id = $${paramIdx}`);
      params.push(filters.deal_id);
      paramIdx++;
    }

    if (filters.type) {
      conditions.push(`c.type = $${paramIdx}`);
      params.push(filters.type);
      paramIdx++;
    }

    if (filters.status) {
      conditions.push(`c.status = $${paramIdx}`);
      params.push(filters.status);
      paramIdx++;
    }

    if (filters.search) {
      conditions.push(`(
        c.subject ILIKE $${paramIdx}
        OR l.email ILIKE $${paramIdx}
        OR l.first_name ILIKE $${paramIdx}
        OR l.last_name ILIKE $${paramIdx}
      )`);
      params.push(`%${filters.search}%`);
      paramIdx++;
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    // Count query
    const countResult = await db.queryOne<{ count: string }>(
      `SELECT COUNT(DISTINCT c.id) AS count
       FROM conversations c
       LEFT JOIN deals d ON d.id = c.deal_id
       LEFT JOIN leads l ON l.id = c.lead_id
       LEFT JOIN deals dl ON dl.lead_id = l.id AND dl.id != COALESCE(c.deal_id, '00000000-0000-0000-0000-000000000000')
       ${whereClause}`,
      params
    );

    const total = parseInt(countResult?.count ?? '0', 10);
    const totalPages = Math.ceil(total / limit);

    // Data query with details (optional assigned_to_id/ta for DBs that have the migration)
    const queryWithAssign = `SELECT DISTINCT ON (c.id)
        c.*,
        l.email AS lead_email,
        COALESCE(l.first_name || ' ' || l.last_name, l.email) AS lead_name,
        d_main.name AS deal_name,
        d_main.status AS deal_status,
        tm.name AS created_by_name,
        tm.email AS created_by_email,
        tm.avatar AS created_by_avatar,
        ta.name AS assigned_to_name,
        ta.avatar AS assigned_to_avatar,
        (
          SELECT COUNT(*)::int FROM messages m
          WHERE m.conversation_id = c.id
            AND m.read_at IS NULL
            AND m.direction = 'inbound'
        ) AS unread_count,
        (
          SELECT COUNT(*)::int FROM messages m
          WHERE m.conversation_id = c.id
        ) AS message_count,
        (
          SELECT COALESCE(
            SUBSTRING(m2.body_text FROM 1 FOR 100),
            SUBSTRING(m2.body_html FROM 1 FOR 100)
          )
          FROM messages m2
          WHERE m2.conversation_id = c.id
          ORDER BY COALESCE(m2.sent_at, m2.created_at) DESC
          LIMIT 1
        ) AS last_message_preview
       FROM conversations c
       LEFT JOIN deals d ON d.id = c.deal_id
       LEFT JOIN deals d_main ON d_main.id = c.deal_id
       LEFT JOIN leads l ON l.id = c.lead_id
       LEFT JOIN deals dl ON dl.lead_id = l.id AND dl.id != COALESCE(c.deal_id, '00000000-0000-0000-0000-000000000000')
       LEFT JOIN team_members tm ON tm.id = c.created_by_id
       LEFT JOIN team_members ta ON ta.id = c.assigned_to_id
       ${whereClause}
       ORDER BY c.id, ${sortColumn} ${sortOrder} NULLS LAST
       LIMIT $${paramIdx} OFFSET $${paramIdx + 1}`;
    const queryWithoutAssign = `SELECT DISTINCT ON (c.id)
        c.*,
        l.email AS lead_email,
        COALESCE(l.first_name || ' ' || l.last_name, l.email) AS lead_name,
        d_main.name AS deal_name,
        d_main.status AS deal_status,
        tm.name AS created_by_name,
        tm.email AS created_by_email,
        tm.avatar AS created_by_avatar,
        (
          SELECT COUNT(*)::int FROM messages m
          WHERE m.conversation_id = c.id
            AND m.read_at IS NULL
            AND m.direction = 'inbound'
        ) AS unread_count,
        (
          SELECT COUNT(*)::int FROM messages m
          WHERE m.conversation_id = c.id
        ) AS message_count,
        (
          SELECT COALESCE(
            SUBSTRING(m2.body_text FROM 1 FOR 100),
            SUBSTRING(m2.body_html FROM 1 FOR 100)
          )
          FROM messages m2
          WHERE m2.conversation_id = c.id
          ORDER BY COALESCE(m2.sent_at, m2.created_at) DESC
          LIMIT 1
        ) AS last_message_preview
       FROM conversations c
       LEFT JOIN deals d ON d.id = c.deal_id
       LEFT JOIN deals d_main ON d_main.id = c.deal_id
       LEFT JOIN leads l ON l.id = c.lead_id
       LEFT JOIN deals dl ON dl.lead_id = l.id AND dl.id != COALESCE(c.deal_id, '00000000-0000-0000-0000-000000000000')
       LEFT JOIN team_members tm ON tm.id = c.created_by_id
       ${whereClause}
       ORDER BY c.id, ${sortColumn} ${sortOrder} NULLS LAST
       LIMIT $${paramIdx} OFFSET $${paramIdx + 1}`;
    const queryParams = [...params, limit, offset];
    let conversations: ConversationWithDetails[];
    try {
      conversations = await db.query<ConversationWithDetails>(queryWithAssign, queryParams);
    } catch (err) {
      const msg = (err as Error)?.message ?? '';
      if (msg.includes('assigned_to_id') && msg.includes('does not exist')) {
        conversations = await db.query<ConversationWithDetails>(queryWithoutAssign, queryParams);
      } else {
        throw err;
      }
    }

    // Re-sort because DISTINCT ON forces a specific first ORDER BY column
    const sortedConversations = this.sortResults(conversations, sortBy, filters.sort_order ?? 'desc');

    return {
      data: sortedConversations,
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
  // Get Conversations By Lead
  // ===========================================================================

  async getConversationsByLead(
    leadId: string,
    userId: string,
    userEmail: string,
    userRole: string
  ): Promise<ConversationWithDetails[]> {
    const result = await this.getConversations(
      { lead_id: leadId, limit: 100 },
      userId,
      userEmail,
      userRole
    );
    return result.data;
  }

  // ===========================================================================
  // Get Conversations By Deal
  // ===========================================================================

  async getConversationsByDeal(
    dealId: string,
    userId: string,
    userEmail: string,
    userRole: string
  ): Promise<ConversationWithDetails[]> {
    const result = await this.getConversations(
      { deal_id: dealId, limit: 100 },
      userId,
      userEmail,
      userRole
    );
    return result.data;
  }

  // ===========================================================================
  // Get Single Conversation
  // ===========================================================================

  async getConversationById(conversationId: string): Promise<ConversationWithDetails> {
    const queryWithAssign = `SELECT
        c.*,
        l.email AS lead_email,
        COALESCE(l.first_name || ' ' || l.last_name, l.email) AS lead_name,
        d.name AS deal_name,
        d.status AS deal_status,
        tm.name AS created_by_name,
        tm.email AS created_by_email,
        tm.avatar AS created_by_avatar,
        ta.name AS assigned_to_name,
        ta.avatar AS assigned_to_avatar,
        (
          SELECT COUNT(*)::int FROM messages m
          WHERE m.conversation_id = c.id
            AND m.read_at IS NULL
            AND m.direction = 'inbound'
        ) AS unread_count,
        (
          SELECT COUNT(*)::int FROM messages m
          WHERE m.conversation_id = c.id
        ) AS message_count
       FROM conversations c
       LEFT JOIN deals d ON d.id = c.deal_id
       LEFT JOIN leads l ON l.id = c.lead_id
       LEFT JOIN team_members tm ON tm.id = c.created_by_id
       LEFT JOIN team_members ta ON ta.id = c.assigned_to_id
       WHERE c.id = $1`;
    const queryWithoutAssign = `SELECT
        c.*,
        l.email AS lead_email,
        COALESCE(l.first_name || ' ' || l.last_name, l.email) AS lead_name,
        d.name AS deal_name,
        d.status AS deal_status,
        tm.name AS created_by_name,
        tm.email AS created_by_email,
        tm.avatar AS created_by_avatar,
        (
          SELECT COUNT(*)::int FROM messages m
          WHERE m.conversation_id = c.id
            AND m.read_at IS NULL
            AND m.direction = 'inbound'
        ) AS unread_count,
        (
          SELECT COUNT(*)::int FROM messages m
          WHERE m.conversation_id = c.id
        ) AS message_count
       FROM conversations c
       LEFT JOIN deals d ON d.id = c.deal_id
       LEFT JOIN leads l ON l.id = c.lead_id
       LEFT JOIN team_members tm ON tm.id = c.created_by_id
       WHERE c.id = $1`;
    let conversation: ConversationWithDetails | null;
    try {
      conversation = await db.queryOne<ConversationWithDetails>(queryWithAssign, [conversationId]);
    } catch (err) {
      const msg = (err as Error)?.message ?? '';
      if (msg.includes('assigned_to_id') && msg.includes('does not exist')) {
        conversation = await db.queryOne<ConversationWithDetails>(queryWithoutAssign, [conversationId]);
      } else {
        throw err;
      }
    }

    if (!conversation) {
      throw new NotFoundError('Conversation', conversationId);
    }

    return conversation;
  }

  // ===========================================================================
  // Get Conversation With Messages
  // ===========================================================================

  async getConversationWithMessages(
    conversationId: string,
    userId: string,
    userEmail: string,
    userRole: string,
    pagination?: GetMessagesOptions
  ): Promise<{ conversation: ConversationWithDetails; messages: PaginatedResponse<MessageWithSender> }> {
    await this.assertAccess(conversationId, userId, userEmail, userRole);

    const conversation = await this.getConversationById(conversationId);

    const messageService = getMessageService();
    const messages = await messageService.getMessages(conversationId, pagination);

    return { conversation, messages };
  }

  // ===========================================================================
  // Create Conversation
  // ===========================================================================

  async createConversation(
    data: CreateConversationInput,
    userId: string
  ): Promise<ConversationWithDetails> {
    // Validate that at least lead_id or deal_id is provided
    if (!data.lead_id && !data.deal_id) {
      throw new ValidationError('Either lead_id or deal_id must be provided');
    }

    // If deal_id is provided, validate it exists
    if (data.deal_id) {
      const deal = await db.queryOne<{ id: string; lead_id: string }>(
        'SELECT id, lead_id FROM deals WHERE id = $1',
        [data.deal_id]
      );
      if (!deal) {
        throw new NotFoundError('Deal', data.deal_id);
      }
      // Auto-populate lead_id from the deal if not provided
      if (!data.lead_id && deal.lead_id) {
        data.lead_id = deal.lead_id;
      }
    }

    // If lead_id is provided, validate it exists
    if (data.lead_id) {
      const lead = await db.queryOne<{ id: string }>(
        'SELECT id FROM leads WHERE id = $1',
        [data.lead_id]
      );
      if (!lead) {
        throw new NotFoundError('Lead', data.lead_id);
      }
    }

    const conversationType = data.type ?? 'direct';
    const participantEmails = data.participant_emails ?? [];

    const conversation = await db.queryOne<Conversation>(
      `INSERT INTO conversations (
        lead_id, deal_id, type, status, subject,
        participant_emails, created_by_id,
        created_at, updated_at
      ) VALUES (
        $1, $2, $3, 'active', $4,
        $5::jsonb, $6,
        NOW(), NOW()
      )
      RETURNING *`,
      [
        data.lead_id ?? null,
        data.deal_id ?? null,
        conversationType,
        data.subject ?? null,
        JSON.stringify(participantEmails),
        userId,
      ]
    );

    if (!conversation) {
      throw new BusinessLogicError('Failed to create conversation');
    }

    return this.getConversationById(conversation.id);
  }

  // ===========================================================================
  // Update Conversation
  // ===========================================================================

  async updateConversation(
    conversationId: string,
    data: UpdateConversationInput,
    userId: string,
    userEmail: string,
    userRole: string
  ): Promise<ConversationWithDetails> {
    await this.assertAccess(conversationId, userId, userEmail, userRole);

    // Verify conversation exists
    const existing = await db.queryOne<Conversation>(
      'SELECT * FROM conversations WHERE id = $1',
      [conversationId]
    );
    if (!existing) {
      throw new NotFoundError('Conversation', conversationId);
    }

    const setClauses: string[] = ['updated_at = NOW()'];
    const params: unknown[] = [conversationId];
    let paramIdx = 2;

    if (data.subject !== undefined) {
      setClauses.push(`subject = $${paramIdx}`);
      params.push(data.subject);
      paramIdx++;
    }

    if (data.status !== undefined) {
      setClauses.push(`status = $${paramIdx}`);
      params.push(data.status);
      paramIdx++;
    }

    if (data.participant_emails !== undefined) {
      setClauses.push(`participant_emails = $${paramIdx}::jsonb`);
      params.push(JSON.stringify(data.participant_emails));
      paramIdx++;
    }

    if (data.type !== undefined) {
      setClauses.push(`type = $${paramIdx}`);
      params.push(data.type);
      paramIdx++;
    }

    if (data.assigned_to_id !== undefined) {
      setClauses.push(`assigned_to_id = $${paramIdx}`);
      params.push(data.assigned_to_id);
      paramIdx++;
    }

    if (setClauses.length === 1) {
      // Only updated_at – nothing to change
      return this.getConversationById(conversationId);
    }

    try {
      await db.execute(
        `UPDATE conversations SET ${setClauses.join(', ')} WHERE id = $1`,
        params
      );
    } catch (err) {
      const msg = (err as Error)?.message ?? '';
      if (msg.includes('assigned_to_id') && msg.includes('does not exist') && data.assigned_to_id !== undefined) {
        const idx = setClauses.findIndex((c) => c.startsWith('assigned_to_id'));
        if (idx !== -1) {
          setClauses.splice(idx, 1);
          params.pop();
          if (setClauses.length > 1) {
            await db.execute(
              `UPDATE conversations SET ${setClauses.join(', ')} WHERE id = $1`,
              params
            );
          }
        }
      } else {
        throw err;
      }
    }

    return this.getConversationById(conversationId);
  }

  // ===========================================================================
  // Archive Conversation
  // ===========================================================================

  async archiveConversation(
    conversationId: string,
    userId: string,
    userEmail: string,
    userRole: string
  ): Promise<ConversationWithDetails> {
    await this.assertAccess(conversationId, userId, userEmail, userRole);

    const existing = await db.queryOne<Conversation>(
      'SELECT * FROM conversations WHERE id = $1',
      [conversationId]
    );
    if (!existing) {
      throw new NotFoundError('Conversation', conversationId);
    }

    if (existing.status === 'archived') {
      throw new BusinessLogicError('Conversation is already archived');
    }

    await db.execute(
      `UPDATE conversations SET status = 'archived', updated_at = NOW() WHERE id = $1`,
      [conversationId]
    );

    return this.getConversationById(conversationId);
  }

  // ===========================================================================
  // Close Conversation
  // ===========================================================================

  async closeConversation(
    conversationId: string,
    userId: string,
    userEmail: string,
    userRole: string
  ): Promise<ConversationWithDetails> {
    await this.assertAccess(conversationId, userId, userEmail, userRole);

    const existing = await db.queryOne<Conversation>(
      'SELECT * FROM conversations WHERE id = $1',
      [conversationId]
    );
    if (!existing) {
      throw new NotFoundError('Conversation', conversationId);
    }

    if (existing.status === 'closed') {
      throw new BusinessLogicError('Conversation is already closed');
    }

    await db.execute(
      `UPDATE conversations SET status = 'closed', updated_at = NOW() WHERE id = $1`,
      [conversationId]
    );

    return this.getConversationById(conversationId);
  }

  // ===========================================================================
  // Reopen Conversation
  // ===========================================================================

  async reopenConversation(
    conversationId: string,
    userId: string,
    userEmail: string,
    userRole: string
  ): Promise<ConversationWithDetails> {
    await this.assertAccess(conversationId, userId, userEmail, userRole);

    const existing = await db.queryOne<Conversation>(
      'SELECT * FROM conversations WHERE id = $1',
      [conversationId]
    );
    if (!existing) {
      throw new NotFoundError('Conversation', conversationId);
    }

    if (existing.status === 'active') {
      throw new BusinessLogicError('Conversation is already active');
    }

    await db.execute(
      `UPDATE conversations SET status = 'active', updated_at = NOW() WHERE id = $1`,
      [conversationId]
    );

    return this.getConversationById(conversationId);
  }

  // ===========================================================================
  // Update Last Message At (called by MessageService)
  // ===========================================================================

  async updateLastMessageAt(conversationId: string): Promise<void> {
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
  // Find or Create Conversation for Lead/Deal
  // ===========================================================================

  /**
   * Finds an active conversation for a lead/deal pair, or creates a new one.
   * Used by EmailSyncService when matching incoming emails.
   * @param initiatedByLead - true when the conversation was started by the lead (e.g. first message was inbound)
   * @param options.imported - if true, sets imported_at = NOW() (for CSV/lead-import chats)
   */
  async findOrCreateConversation(
    leadId: string | null,
    dealId: string | null,
    createdById: string,
    subject?: string,
    initiatedByLead: boolean = false,
    options?: { imported?: boolean }
  ): Promise<Conversation> {
    if (!leadId && !dealId) {
      throw new ValidationError('Either lead_id or deal_id must be provided');
    }

    // Try to find existing active conversation
    const conditions: string[] = [`status = 'active'`];
    const params: unknown[] = [];
    let paramIdx = 1;

    if (dealId) {
      conditions.push(`deal_id = $${paramIdx}`);
      params.push(dealId);
      paramIdx++;
    }

    if (leadId && !dealId) {
      conditions.push(`lead_id = $${paramIdx}`);
      params.push(leadId);
      paramIdx++;
      conditions.push('deal_id IS NULL');
    }

    const existing = await db.queryOne<Conversation>(
      `SELECT * FROM conversations
       WHERE ${conditions.join(' AND ')}
       ORDER BY last_message_at DESC NULLS LAST
       LIMIT 1`,
      params
    );

    if (existing) return existing;

    // Always use INSERT without imported_at so it works even if migration not run yet
    const conversation = await db.queryOne<Conversation>(
      `INSERT INTO conversations (
        lead_id, deal_id, type, status, subject,
        participant_emails, created_by_id, initiated_by_lead,
        created_at, updated_at
      ) VALUES (
        $1, $2, 'direct', 'active', $3,
        '[]'::jsonb, $4, $5,
        NOW(), NOW()
      )
      RETURNING *`,
      [leadId, dealId, subject ?? null, createdById, initiatedByLead]
    );

    if (!conversation) {
      throw new BusinessLogicError('Failed to create conversation');
    }

    if (options?.imported === true) {
      try {
        await db.execute(
          'UPDATE conversations SET imported_at = NOW() WHERE id = $1',
          [conversation.id]
        );
        (conversation as Conversation).imported_at = new Date();
      } catch {
        // Column imported_at may not exist yet (migration not run); ignore
      }
    }

    return conversation;
  }

  // ===========================================================================
  // Delete Conversation (hard delete, admin only or cascade scenario)
  // ===========================================================================

  async deleteConversation(
    conversationId: string,
    userId: string,
    userEmail: string,
    userRole: string
  ): Promise<void> {
    await this.assertAccess(conversationId, userId, userEmail, userRole);

    const existing = await db.queryOne<Conversation>(
      'SELECT * FROM conversations WHERE id = $1',
      [conversationId]
    );
    if (!existing) {
      throw new NotFoundError('Conversation', conversationId);
    }

    // Messages will be cascade-deleted by FK constraint
    await db.execute('DELETE FROM conversations WHERE id = $1', [conversationId]);
  }

  // ===========================================================================
  // Private: Sort results after DISTINCT ON
  // ===========================================================================

  private sortResults(
    conversations: ConversationWithDetails[],
    sortBy: string,
    sortOrder: string
  ): ConversationWithDetails[] {
    const key = sortBy as keyof ConversationWithDetails;
    const direction = sortOrder === 'asc' ? 1 : -1;

    return [...conversations].sort((a, b) => {
      const aVal = a[key];
      const bVal = b[key];

      if (aVal == null && bVal == null) return 0;
      if (aVal == null) return 1;
      if (bVal == null) return -1;

      if (aVal < bVal) return -1 * direction;
      if (aVal > bVal) return 1 * direction;
      return 0;
    });
  }
}

// =============================================================================
// Singleton Export
// =============================================================================

let conversationServiceInstance: ConversationService | null = null;

export function getConversationService(): ConversationService {
  if (!conversationServiceInstance) {
    conversationServiceInstance = new ConversationService();
  }
  return conversationServiceInstance;
}

export const conversationService = {
  get instance() {
    return getConversationService();
  },
};

export default conversationService;
