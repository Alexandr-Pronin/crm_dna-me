// =============================================================================
// src/api/routes/conversations.ts
// Conversation Management API Routes
// =============================================================================

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { authenticateOrApiKey } from '../middleware/auth.js';
import { checkConversationAccess } from '../middleware/conversationAuth.js';
import { db } from '../../db/index.js';
import { getRedisConnection } from '../../config/redis.js';
import {
  getConversationService,
  type CreateConversationInput,
  type UpdateConversationInput,
  type ConversationFilters,
  type ConversationWithDetails,
} from '../../services/conversationService.js';
import { getMessageService, type CreateMessageInput } from '../../services/messageService.js';
import { getCituroService } from '../../integrations/cituro.js';
import { getCituroTemplate } from '../../config/integrationSettings.js';
import { getEmailService } from '../../services/emailService.js';
import { CITURO_INVITE_HTML_DEFAULT } from '../../templates/cituroInviteEmail.js';
import { ValidationError, NotFoundError } from '../../errors/index.js';

// =============================================================================
// Zod Schemas
// =============================================================================

const createConversationSchema = z.object({
  lead_id: z.string().uuid().optional(),
  deal_id: z.string().uuid().optional(),
  type: z.enum(['direct', 'group', 'internal']).optional(),
  subject: z.string().max(500).optional(),
  participant_emails: z.array(z.string().email()).optional(),
}).refine(
  (data) => data.lead_id || data.deal_id,
  { message: 'Either lead_id or deal_id must be provided' }
);

const updateConversationSchema = z.object({
  subject: z.string().max(500).optional(),
  status: z.enum(['active', 'archived', 'closed']).optional(),
  participant_emails: z.array(z.string().email()).optional(),
  type: z.enum(['direct', 'group', 'internal']).optional(),
});

const conversationFiltersSchema = z.object({
  lead_id: z.string().uuid().optional(),
  deal_id: z.string().uuid().optional(),
  type: z.enum(['direct', 'group', 'internal']).optional(),
  status: z.enum(['active', 'archived', 'closed']).optional(),
  search: z.string().max(255).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  sort_by: z.enum(['created_at', 'updated_at', 'last_message_at']).default('last_message_at'),
  sort_order: z.enum(['asc', 'desc']).default('desc'),
});

const conversationIdParamSchema = z.object({
  id: z.string().uuid(),
});

const messagesPaginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  sort_order: z.enum(['asc', 'desc']).default('asc'),
  since: z.string().datetime().optional(),
});

const createMessageSchema = z.object({
  message_type: z.enum(['email', 'linkedin', 'internal_note', 'task']),
  direction: z.enum(['inbound', 'outbound', 'internal']).optional(),
  sender_email: z.string().email().optional(),
  sender_name: z.string().max(255).optional(),
  recipients: z.array(z.object({
    email: z.string().email(),
    name: z.string().max(255).optional(),
    type: z.enum(['to', 'cc', 'bcc']),
  })).optional(),
  subject: z.string().max(500).optional(),
  body_html: z.string().optional(),
  body_text: z.string().optional(),
  metadata: z.record(z.unknown()).optional(),
  attachments: z.array(z.object({
    filename: z.string(),
    content_type: z.string(),
    size: z.number(),
    url: z.string().optional(),
    storage_key: z.string().optional(),
  })).optional(),
  external_id: z.string().max(255).optional(),
  email_thread_id: z.string().max(255).optional(),
  skip_send: z.boolean().optional(),
  sent_at: z.string().datetime().optional(),
});

const messageIdParamSchema = z.object({
  messageId: z.string().uuid(),
});

// =============================================================================
// Type Definitions
// =============================================================================

interface IdParams {
  id: string;
}

interface MessageIdParams extends IdParams {
  messageId: string;
}

// =============================================================================
// Helper Functions
// =============================================================================

function transformConversationResponse(conversation: ConversationWithDetails) {
  return {
    id: conversation.id,
    lead_id: conversation.lead_id ?? null,
    deal_id: conversation.deal_id ?? null,
    type: conversation.type,
    status: conversation.status,
    subject: conversation.subject ?? null,
    participant_emails: conversation.participant_emails ?? [],
    last_message_at: conversation.last_message_at
      ? (typeof conversation.last_message_at === 'string'
          ? conversation.last_message_at
          : (conversation.last_message_at as Date).toISOString?.() ?? conversation.last_message_at)
      : null,
    created_by_id: conversation.created_by_id ?? null,
    created_at: typeof conversation.created_at === 'string'
      ? conversation.created_at
      : (conversation.created_at as Date).toISOString?.() ?? conversation.created_at,
    updated_at: typeof conversation.updated_at === 'string'
      ? conversation.updated_at
      : (conversation.updated_at as Date).toISOString?.() ?? conversation.updated_at,
    // Relations
    lead_email: conversation.lead_email ?? null,
    lead_name: conversation.lead_name ?? null,
    deal_name: conversation.deal_name ?? null,
    deal_status: conversation.deal_status ?? null,
    created_by_name: conversation.created_by_name ?? null,
    created_by_email: conversation.created_by_email ?? null,
    created_by_avatar: conversation.created_by_avatar ?? null,
    initiated_by_lead: conversation.initiated_by_lead ?? false,
    // Counts
    unread_count: conversation.unread_count ?? 0,
    message_count: conversation.message_count ?? 0,
    last_message_preview: conversation.last_message_preview ?? null,
  };
}

// =============================================================================
// SSE Authentication (supports query-parameter auth for EventSource)
// =============================================================================

/**
 * EventSource cannot send custom headers.  This pre-handler injects
 * `token` / `api_key` query-parameters into the corresponding headers
 * so the existing `authenticateOrApiKey` middleware works transparently.
 */
async function authenticateSSE(
  request: FastifyRequest<{ Querystring: { token?: string; api_key?: string } }>,
  reply: FastifyReply
): Promise<void> {
  const query = request.query as Record<string, string | undefined>;

  if (query.token && !request.headers.authorization) {
    (request.headers as Record<string, string>).authorization = `Bearer ${query.token}`;
  }
  if (query.api_key && !request.headers['x-api-key']) {
    (request.headers as Record<string, string>)['x-api-key'] = query.api_key;
  }

  return authenticateOrApiKey(request, reply);
}

// =============================================================================
// Route Registration
// =============================================================================

export async function conversationsRoutes(fastify: FastifyInstance): Promise<void> {
  const conversationService = getConversationService();
  const messageService = getMessageService();

  // ===========================================================================
  // GET /api/v1/conversations
  // ===========================================================================
  fastify.get<{
    Querystring: ConversationFilters;
  }>(
    '/conversations',
    {
      preHandler: authenticateOrApiKey,
      schema: {
        querystring: {
          type: 'object',
          properties: {
            lead_id: { type: 'string', format: 'uuid' },
            deal_id: { type: 'string', format: 'uuid' },
            type: { type: 'string', enum: ['direct', 'group', 'internal'] },
            status: { type: 'string', enum: ['active', 'archived', 'closed'] },
            search: { type: 'string', maxLength: 255 },
            page: { type: 'integer', minimum: 1, default: 1 },
            limit: { type: 'integer', minimum: 1, maximum: 100, default: 20 },
            sort_by: { type: 'string', enum: ['created_at', 'updated_at', 'last_message_at'], default: 'last_message_at' },
            sort_order: { type: 'string', enum: ['asc', 'desc'], default: 'desc' },
          },
        },
        response: {
          200: {
            type: 'object',
            properties: {
              data: { type: 'array', items: { type: 'object', additionalProperties: true } },
              pagination: {
                type: 'object',
                properties: {
                  page: { type: 'integer' },
                  limit: { type: 'integer' },
                  total: { type: 'integer' },
                  total_pages: { type: 'integer' },
                  has_next: { type: 'boolean' },
                  has_prev: { type: 'boolean' },
                },
              },
            },
          },
        },
      },
    },
    async (request, _reply) => {
      const parseResult = conversationFiltersSchema.safeParse(request.query);

      if (!parseResult.success) {
        throw new ValidationError('Invalid query parameters', {
          validationErrors: parseResult.error.errors,
        });
      }

      const user = request.user;
      const result = await conversationService.getConversations(
        parseResult.data,
        user.id,
        user.email,
        user.role
      );

      return {
        data: result.data.map(transformConversationResponse),
        pagination: result.pagination,
      };
    }
  );

  // ===========================================================================
  // GET /api/v1/conversations/:id
  // ===========================================================================
  fastify.get<{
    Params: IdParams;
  }>(
    '/conversations/:id',
    {
      preHandler: [authenticateOrApiKey, checkConversationAccess],
      schema: {
        params: {
          type: 'object',
          required: ['id'],
          properties: {
            id: { type: 'string', format: 'uuid' },
          },
        },
        response: {
          200: { type: 'object', additionalProperties: true },
          403: {
            type: 'object',
            properties: {
              statusCode: { type: 'integer' },
              error: { type: 'string' },
              message: { type: 'string' },
            },
          },
          404: {
            type: 'object',
            properties: {
              error: {
                type: 'object',
                properties: {
                  code: { type: 'string' },
                  message: { type: 'string' },
                },
              },
            },
          },
        },
      },
    },
    async (request, _reply) => {
      const paramResult = conversationIdParamSchema.safeParse(request.params);
      if (!paramResult.success) {
        throw new ValidationError('Invalid conversation ID', {
          validationErrors: paramResult.error.errors,
        });
      }

      const conversation = await conversationService.getConversationById(paramResult.data.id);
      return transformConversationResponse(conversation);
    }
  );

  // ===========================================================================
  // POST /api/v1/conversations
  // ===========================================================================
  fastify.post<{
    Body: CreateConversationInput;
  }>(
    '/conversations',
    {
      preHandler: authenticateOrApiKey,
      schema: {
        body: {
          type: 'object',
          properties: {
            lead_id: { type: 'string', format: 'uuid' },
            deal_id: { type: 'string', format: 'uuid' },
            type: { type: 'string', enum: ['direct', 'group', 'internal'] },
            subject: { type: 'string', maxLength: 500 },
            participant_emails: { type: 'array', items: { type: 'string', format: 'email' } },
          },
        },
        response: {
          201: { type: 'object', additionalProperties: true },
          400: {
            type: 'object',
            properties: {
              error: {
                type: 'object',
                properties: {
                  code: { type: 'string' },
                  message: { type: 'string' },
                },
              },
            },
          },
          404: {
            type: 'object',
            properties: {
              error: {
                type: 'object',
                properties: {
                  code: { type: 'string' },
                  message: { type: 'string' },
                },
              },
            },
          },
        },
      },
    },
    async (request, reply) => {
      const parseResult = createConversationSchema.safeParse(request.body);

      if (!parseResult.success) {
        throw new ValidationError('Invalid conversation data', {
          validationErrors: parseResult.error.errors,
        });
      }

      const user = request.user;
      const conversation = await conversationService.createConversation(
        parseResult.data,
        user.id
      );

      request.log.info(
        { conversationId: conversation.id, leadId: conversation.lead_id, dealId: conversation.deal_id },
        'Conversation created'
      );

      return reply.code(201).send(transformConversationResponse(conversation));
    }
  );

  // ===========================================================================
  // PATCH /api/v1/conversations/:id
  // ===========================================================================
  fastify.patch<{
    Params: IdParams;
    Body: UpdateConversationInput;
  }>(
    '/conversations/:id',
    {
      preHandler: [authenticateOrApiKey, checkConversationAccess],
      schema: {
        params: {
          type: 'object',
          required: ['id'],
          properties: {
            id: { type: 'string', format: 'uuid' },
          },
        },
        body: {
          type: 'object',
          properties: {
            subject: { type: 'string', maxLength: 500 },
            status: { type: 'string', enum: ['active', 'archived', 'closed'] },
            participant_emails: { type: 'array', items: { type: 'string', format: 'email' } },
            type: { type: 'string', enum: ['direct', 'group', 'internal'] },
          },
        },
        response: {
          200: { type: 'object', additionalProperties: true },
          403: {
            type: 'object',
            properties: {
              statusCode: { type: 'integer' },
              error: { type: 'string' },
              message: { type: 'string' },
            },
          },
          404: {
            type: 'object',
            properties: {
              error: {
                type: 'object',
                properties: {
                  code: { type: 'string' },
                  message: { type: 'string' },
                },
              },
            },
          },
        },
      },
    },
    async (request, _reply) => {
      const paramResult = conversationIdParamSchema.safeParse(request.params);
      if (!paramResult.success) {
        throw new ValidationError('Invalid conversation ID', {
          validationErrors: paramResult.error.errors,
        });
      }

      const bodyResult = updateConversationSchema.safeParse(request.body);
      if (!bodyResult.success) {
        throw new ValidationError('Invalid conversation data', {
          validationErrors: bodyResult.error.errors,
        });
      }

      const user = request.user;
      const conversation = await conversationService.updateConversation(
        paramResult.data.id,
        bodyResult.data,
        user.id,
        user.email,
        user.role
      );

      request.log.info({ conversationId: conversation.id }, 'Conversation updated');

      return transformConversationResponse(conversation);
    }
  );

  // ===========================================================================
  // DELETE /api/v1/conversations/:id  (soft-archives by default)
  // ===========================================================================
  fastify.delete<{
    Params: IdParams;
    Querystring: { hard?: string };
  }>(
    '/conversations/:id',
    {
      preHandler: [authenticateOrApiKey, checkConversationAccess],
      schema: {
        params: {
          type: 'object',
          required: ['id'],
          properties: {
            id: { type: 'string', format: 'uuid' },
          },
        },
        querystring: {
          type: 'object',
          properties: {
            hard: { type: 'string', enum: ['true', 'false'] },
          },
        },
        response: {
          200: {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              message: { type: 'string' },
            },
          },
          403: {
            type: 'object',
            properties: {
              statusCode: { type: 'integer' },
              error: { type: 'string' },
              message: { type: 'string' },
            },
          },
          404: {
            type: 'object',
            properties: {
              error: {
                type: 'object',
                properties: {
                  code: { type: 'string' },
                  message: { type: 'string' },
                },
              },
            },
          },
        },
      },
    },
    async (request, _reply) => {
      const paramResult = conversationIdParamSchema.safeParse(request.params);
      if (!paramResult.success) {
        throw new ValidationError('Invalid conversation ID', {
          validationErrors: paramResult.error.errors,
        });
      }

      const user = request.user;
      const hardDelete = request.query.hard === 'true';

      if (hardDelete) {
        await conversationService.deleteConversation(
          paramResult.data.id,
          user.id,
          user.email,
          user.role
        );
        request.log.info({ conversationId: paramResult.data.id }, 'Conversation hard-deleted');
        return { success: true, message: 'Conversation deleted permanently' };
      }

      await conversationService.archiveConversation(
        paramResult.data.id,
        user.id,
        user.email,
        user.role
      );
      request.log.info({ conversationId: paramResult.data.id }, 'Conversation archived');
      return { success: true, message: 'Conversation archived' };
    }
  );

  // ===========================================================================
  // POST /api/v1/conversations/:id/send-cituro-invite – Termin-Einladung an Lead senden
  // ===========================================================================
  fastify.post<{ Params: IdParams }>(
    '/conversations/:id/send-cituro-invite',
    {
      preHandler: [authenticateOrApiKey, checkConversationAccess],
      schema: {
        params: {
          type: 'object',
          required: ['id'],
          properties: { id: { type: 'string', format: 'uuid' } },
        },
        response: {
          200: {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              booking_link: { type: 'string' },
              email_sent: { type: 'boolean' },
            },
          },
        },
      },
    },
    async (request, reply) => {
      const paramResult = conversationIdParamSchema.safeParse(request.params);
      if (!paramResult.success) {
        throw new ValidationError('Invalid conversation ID', { validationErrors: paramResult.error.errors });
      }
      const conversation = await conversationService.getConversationById(paramResult.data.id);
      if (!conversation.lead_id) {
        throw new ValidationError('Conversation has no lead; Cituro invite requires a lead.');
      }
      const lead = await db.queryOne<{ email: string; first_name?: string; last_name?: string }>(
        'SELECT email, first_name, last_name FROM leads WHERE id = $1',
        [conversation.lead_id]
      );
      if (!lead) {
        throw new NotFoundError('Lead', conversation.lead_id);
      }
      const cituroService = getCituroService();
      if (!cituroService.isConfigured()) {
        throw new ValidationError('Cituro is not configured.');
      }
      const bookingLink = await cituroService.generateBookingLink({
        lead_email: lead.email,
        lead_name: [lead.first_name, lead.last_name].filter(Boolean).join(' ').trim() || undefined,
        meeting_type: 'consultation',
        duration_minutes: 30,
      });
      let emailHtml = (await getCituroTemplate()).trim();
      if (!emailHtml) {
        emailHtml = CITURO_INVITE_HTML_DEFAULT;
      }
      emailHtml = emailHtml
        .replace(/\{BOOKING_LINK\}/g, bookingLink.url)
        .replace(/\{booking_link\}/g, bookingLink.url)
        .replace(/https:\/\/app\.cituro\.com\/booking\/[a-zA-Z0-9-]+/g, bookingLink.url);
      const emailService = getEmailService();
      const emailResult = await emailService.sendEmail({
        to: lead.email,
        subject: 'Terminvereinbarung - DNA ME',
        html: emailHtml,
      });
      return reply.send({
        success: emailResult.success && !!bookingLink.url,
        booking_link: bookingLink.url,
        email_sent: emailResult.success,
      });
    }
  );

  // ===========================================================================
  // GET /api/v1/conversations/:id/messages
  // ===========================================================================
  fastify.get<{
    Params: IdParams;
    Querystring: { page?: number; limit?: number; sort_order?: string; since?: string };
  }>(
    '/conversations/:id/messages',
    {
      preHandler: [authenticateOrApiKey, checkConversationAccess],
      schema: {
        params: {
          type: 'object',
          required: ['id'],
          properties: {
            id: { type: 'string', format: 'uuid' },
          },
        },
        querystring: {
          type: 'object',
          properties: {
            page: { type: 'integer', minimum: 1, default: 1 },
            limit: { type: 'integer', minimum: 1, maximum: 100, default: 50 },
            sort_order: { type: 'string', enum: ['asc', 'desc'], default: 'asc' },
            since: { type: 'string', format: 'date-time' },
          },
        },
        response: {
          200: {
            type: 'object',
            properties: {
              data: { type: 'array', items: { type: 'object', additionalProperties: true } },
              pagination: {
                type: 'object',
                properties: {
                  page: { type: 'integer' },
                  limit: { type: 'integer' },
                  total: { type: 'integer' },
                  total_pages: { type: 'integer' },
                  has_next: { type: 'boolean' },
                  has_prev: { type: 'boolean' },
                },
              },
            },
          },
        },
      },
    },
    async (request, _reply) => {
      const paramResult = conversationIdParamSchema.safeParse(request.params);
      if (!paramResult.success) {
        throw new ValidationError('Invalid conversation ID', {
          validationErrors: paramResult.error.errors,
        });
      }

      const queryResult = messagesPaginationSchema.safeParse(request.query);
      if (!queryResult.success) {
        throw new ValidationError('Invalid pagination parameters', {
          validationErrors: queryResult.error.errors,
        });
      }

      const { since, ...paginationOptions } = queryResult.data;

      // If `since` is provided, use the polling endpoint
      if (since) {
        const messages = await messageService.getMessagesSince(
          paramResult.data.id,
          since
        );
        return {
          data: messages,
          pagination: {
            page: 1,
            limit: messages.length,
            total: messages.length,
            total_pages: 1,
            has_next: false,
            has_prev: false,
          },
        };
      }

      return messageService.getMessages(paramResult.data.id, paginationOptions);
    }
  );

  // ===========================================================================
  // POST /api/v1/conversations/:id/messages
  // ===========================================================================
  fastify.post<{
    Params: IdParams;
    Body: CreateMessageInput;
  }>(
    '/conversations/:id/messages',
    {
      preHandler: [authenticateOrApiKey, checkConversationAccess],
      schema: {
        params: {
          type: 'object',
          required: ['id'],
          properties: {
            id: { type: 'string', format: 'uuid' },
          },
        },
        body: {
          type: 'object',
          required: ['message_type'],
          properties: {
            message_type: { type: 'string', enum: ['email', 'linkedin', 'internal_note', 'task'] },
            direction: { type: 'string', enum: ['inbound', 'outbound', 'internal'] },
            sender_email: { type: 'string', format: 'email' },
            sender_name: { type: 'string', maxLength: 255 },
            recipients: {
              type: 'array',
              items: {
                type: 'object',
                required: ['email', 'type'],
                properties: {
                  email: { type: 'string', format: 'email' },
                  name: { type: 'string', maxLength: 255 },
                  type: { type: 'string', enum: ['to', 'cc', 'bcc'] },
                },
              },
            },
            subject: { type: 'string', maxLength: 500 },
            body_html: { type: 'string' },
            body_text: { type: 'string' },
            metadata: { type: 'object', additionalProperties: true },
            attachments: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  filename: { type: 'string' },
                  content_type: { type: 'string' },
                  size: { type: 'number' },
                  url: { type: 'string' },
                  storage_key: { type: 'string' },
                },
              },
            },
            external_id: { type: 'string', maxLength: 255 },
            email_thread_id: { type: 'string', maxLength: 255 },
            skip_send: { type: 'boolean' },
            sent_at: { type: 'string', format: 'date-time' },
          },
        },
        response: {
          201: { type: 'object', additionalProperties: true },
          400: {
            type: 'object',
            properties: {
              error: {
                type: 'object',
                properties: {
                  code: { type: 'string' },
                  message: { type: 'string' },
                },
              },
            },
          },
        },
      },
    },
    async (request, reply) => {
      const paramResult = conversationIdParamSchema.safeParse(request.params);
      if (!paramResult.success) {
        throw new ValidationError('Invalid conversation ID', {
          validationErrors: paramResult.error.errors,
        });
      }

      const bodyResult = createMessageSchema.safeParse(request.body);
      if (!bodyResult.success) {
        throw new ValidationError('Invalid message data', {
          validationErrors: bodyResult.error.errors,
        });
      }

      const user = request.user;
      const message = await messageService.createMessage(
        paramResult.data.id,
        bodyResult.data,
        user.id
      );

      request.log.info(
        { messageId: message.id, conversationId: paramResult.data.id, type: message.message_type },
        'Message created'
      );

      return reply.code(201).send(message);
    }
  );

  // ===========================================================================
  // PATCH /api/v1/conversations/:id/messages/:messageId
  // (Mark as read, update status)
  // ===========================================================================
  fastify.patch<{
    Params: MessageIdParams;
    Body: { read?: boolean };
  }>(
    '/conversations/:id/messages/:messageId',
    {
      preHandler: [authenticateOrApiKey, checkConversationAccess],
      schema: {
        params: {
          type: 'object',
          required: ['id', 'messageId'],
          properties: {
            id: { type: 'string', format: 'uuid' },
            messageId: { type: 'string', format: 'uuid' },
          },
        },
        body: {
          type: 'object',
          properties: {
            read: { type: 'boolean' },
          },
        },
        response: {
          200: { type: 'object', additionalProperties: true },
        },
      },
    },
    async (request, _reply) => {
      const msgParamResult = messageIdParamSchema.safeParse({ messageId: request.params.messageId });
      if (!msgParamResult.success) {
        throw new ValidationError('Invalid message ID', {
          validationErrors: msgParamResult.error.errors,
        });
      }

      const user = request.user;
      const body = request.body as { read?: boolean } | undefined;

      if (body?.read) {
        return messageService.markAsRead(msgParamResult.data.messageId, user.id);
      }

      return messageService.getMessageById(msgParamResult.data.messageId);
    }
  );

  // ===========================================================================
  // POST /api/v1/conversations/:id/messages/:messageId/retry
  // ===========================================================================
  fastify.post<{
    Params: MessageIdParams;
  }>(
    '/conversations/:id/messages/:messageId/retry',
    {
      preHandler: [authenticateOrApiKey, checkConversationAccess],
      schema: {
        params: {
          type: 'object',
          required: ['id', 'messageId'],
          properties: {
            id: { type: 'string', format: 'uuid' },
            messageId: { type: 'string', format: 'uuid' },
          },
        },
        response: {
          200: { type: 'object', additionalProperties: true },
        },
      },
    },
    async (request, _reply) => {
      const msgParamResult = messageIdParamSchema.safeParse({ messageId: request.params.messageId });
      if (!msgParamResult.success) {
        throw new ValidationError('Invalid message ID', {
          validationErrors: msgParamResult.error.errors,
        });
      }

      const user = request.user;
      return messageService.retryMessage(msgParamResult.data.messageId, user.id);
    }
  );

  // ===========================================================================
  // POST /api/v1/conversations/:id/read
  // Mark all inbound messages in a conversation as read
  // ===========================================================================
  fastify.post<{
    Params: IdParams;
  }>(
    '/conversations/:id/read',
    {
      preHandler: [authenticateOrApiKey, checkConversationAccess],
      schema: {
        params: {
          type: 'object',
          required: ['id'],
          properties: {
            id: { type: 'string', format: 'uuid' },
          },
        },
        response: {
          200: {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              marked_count: { type: 'integer' },
            },
          },
        },
      },
    },
    async (request, _reply) => {
      const paramResult = conversationIdParamSchema.safeParse(request.params);
      if (!paramResult.success) {
        throw new ValidationError('Invalid conversation ID', {
          validationErrors: paramResult.error.errors,
        });
      }

      const user = request.user;
      const count = await messageService.markConversationAsRead(
        paramResult.data.id,
        user.id
      );

      return { success: true, marked_count: count };
    }
  );

  // ===========================================================================
  // POST /api/v1/conversations/:id/typing
  // Publish typing indicator event
  // ===========================================================================
  fastify.post<{
    Params: IdParams;
  }>(
    '/conversations/:id/typing',
    {
      preHandler: [authenticateOrApiKey, checkConversationAccess],
      schema: {
        params: {
          type: 'object',
          required: ['id'],
          properties: {
            id: { type: 'string', format: 'uuid' },
          },
        },
        response: {
          200: {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
            },
          },
        },
      },
    },
    async (request, _reply) => {
      const paramResult = conversationIdParamSchema.safeParse(request.params);
      if (!paramResult.success) {
        throw new ValidationError('Invalid conversation ID', {
          validationErrors: paramResult.error.errors,
        });
      }

      const user = request.user;

      // Resolve user name from team_members if not embedded in JWT
      const member = await db.queryOne<{ name: string }>(
        'SELECT name FROM team_members WHERE id = $1',
        [user.id]
      );

      await messageService.publishTypingEvent(
        paramResult.data.id,
        user.id,
        member?.name ?? user.email
      );

      return { success: true };
    }
  );

  // ===========================================================================
  // GET /api/v1/conversations/:id/typing
  // Get currently typing users
  // ===========================================================================
  fastify.get<{
    Params: IdParams;
  }>(
    '/conversations/:id/typing',
    {
      preHandler: [authenticateOrApiKey, checkConversationAccess],
      schema: {
        params: {
          type: 'object',
          required: ['id'],
          properties: {
            id: { type: 'string', format: 'uuid' },
          },
        },
        response: {
          200: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                userId: { type: 'string' },
                name: { type: 'string' },
              },
            },
          },
        },
      },
    },
    async (request, _reply) => {
      const paramResult = conversationIdParamSchema.safeParse(request.params);
      if (!paramResult.success) {
        throw new ValidationError('Invalid conversation ID', {
          validationErrors: paramResult.error.errors,
        });
      }

      return messageService.getTypingUsers(paramResult.data.id);
    }
  );

  // ===========================================================================
  // GET /api/v1/conversations/:id/messages/stream
  // Server-Sent Events (SSE) for real-time message updates
  //
  // EventSource cannot send custom headers, so authentication is also
  // accepted via query parameters: ?token=<JWT>&api_key=<KEY>
  // ===========================================================================
  fastify.get<{
    Params: IdParams;
    Querystring: { token?: string; api_key?: string };
  }>(
    '/conversations/:id/messages/stream',
    {
      preHandler: [authenticateSSE, checkConversationAccess],
      schema: {
        params: {
          type: 'object',
          required: ['id'],
          properties: {
            id: { type: 'string', format: 'uuid' },
          },
        },
        querystring: {
          type: 'object',
          properties: {
            token: { type: 'string' },
            api_key: { type: 'string' },
          },
        },
      },
    },
    async (request, reply) => {
      const paramResult = conversationIdParamSchema.safeParse(request.params);
      if (!paramResult.success) {
        throw new ValidationError('Invalid conversation ID', {
          validationErrors: paramResult.error.errors,
        });
      }

      const conversationId = paramResult.data.id;

      // SSE headers
      reply.raw.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'X-Accel-Buffering': 'no',
        'Access-Control-Allow-Origin': '*',
      });

      // Send initial connection event
      reply.raw.write(`event: connected\ndata: ${JSON.stringify({ conversationId, timestamp: new Date().toISOString() })}\n\n`);

      // Heartbeat to keep the connection alive and detect dead clients
      const heartbeat = setInterval(() => {
        try {
          reply.raw.write(`:heartbeat ${Date.now()}\n\n`);
        } catch {
          clearInterval(heartbeat);
        }
      }, 25_000);

      // Subscribe to Redis Pub/Sub channels for this conversation
      let subscriber: ReturnType<typeof getRedisConnection> | null = null;

      try {
        const redis = getRedisConnection();
        subscriber = redis.duplicate();

        const messageChannel = `conversation:${conversationId}:messages`;
        const typingChannel = `conversation:${conversationId}:typing`;
        const statusChannel = `conversation:${conversationId}:status`;

        await subscriber.subscribe(messageChannel, typingChannel, statusChannel);

        subscriber.on('message', (channel: string, message: string) => {
          try {
            if (channel === messageChannel) {
              reply.raw.write(`event: message\ndata: ${message}\n\n`);
            } else if (channel === typingChannel) {
              reply.raw.write(`event: typing\ndata: ${message}\n\n`);
            } else if (channel === statusChannel) {
              reply.raw.write(`event: status\ndata: ${message}\n\n`);
            }
          } catch {
            // Client disconnected, cleanup will happen below
          }
        });

        request.log.debug(
          { conversationId, channels: [messageChannel, typingChannel, statusChannel] },
          'SSE client connected with Redis Pub/Sub'
        );
      } catch (error) {
        // Redis not available — fall back to heartbeat-only SSE (client uses polling)
        request.log.warn(
          { err: error },
          'Redis Pub/Sub not available for SSE, falling back to heartbeat-only mode'
        );

        // Notify the client that Pub/Sub is unavailable so it can activate polling
        reply.raw.write(`event: fallback\ndata: ${JSON.stringify({ reason: 'redis_unavailable' })}\n\n`);
      }

      // Cleanup when client disconnects
      request.raw.on('close', async () => {
        clearInterval(heartbeat);

        if (subscriber) {
          try {
            await subscriber.unsubscribe();
            subscriber.quit();
          } catch {
            // Ignore cleanup errors
          }
        }

        request.log.debug(
          { conversationId },
          'SSE client disconnected'
        );
      });
    }
  );
}

export default conversationsRoutes;
