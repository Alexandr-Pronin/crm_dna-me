// =============================================================================
// src/api/routes/emailAccounts.ts
// Email Account Management API Routes
//
// Provides endpoints for:
//  - CRUD operations on email accounts (IMAP/SMTP configuration)
//  - Manual email sync trigger
//  - IMAP connection testing
//  - Passwords are encrypted at rest via AES-256-GCM
// =============================================================================

import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { authenticateOrApiKey } from '../middleware/auth.js';
import { db } from '../../db/index.js';
import { encrypt, isEncrypted } from '../../utils/crypto.js';
import { getEmailSyncService } from '../../services/emailSyncService.js';
import {
  ValidationError,
  NotFoundError,
  AuthorizationError,
} from '../../errors/index.js';
import type { EmailAccount } from '../../types/index.js';

// =============================================================================
// Zod Schemas
// =============================================================================

const createEmailAccountSchema = z.object({
  email_address: z.string().email(),
  imap_host: z.string().min(1).max(255).optional(),
  imap_port: z.number().int().min(1).max(65535).optional(),
  imap_username: z.string().max(255).optional(),
  imap_password: z.string().max(500).optional(),
  smtp_host: z.string().min(1).max(255).optional(),
  smtp_port: z.number().int().min(1).max(65535).optional(),
  smtp_username: z.string().max(255).optional(),
  smtp_password: z.string().max(500).optional(),
  sync_enabled: z.boolean().optional(),
});

const updateEmailAccountSchema = z.object({
  email_address: z.string().email().optional(),
  imap_host: z.string().min(1).max(255).optional().nullable(),
  imap_port: z.number().int().min(1).max(65535).optional().nullable(),
  imap_username: z.string().max(255).optional().nullable(),
  imap_password: z.string().max(500).optional().nullable(),
  smtp_host: z.string().min(1).max(255).optional().nullable(),
  smtp_port: z.number().int().min(1).max(65535).optional().nullable(),
  smtp_username: z.string().max(255).optional().nullable(),
  smtp_password: z.string().max(500).optional().nullable(),
  sync_enabled: z.boolean().optional(),
});

const accountIdParamSchema = z.object({
  id: z.string().uuid(),
});

// =============================================================================
// Type Definitions
// =============================================================================

interface IdParams {
  id: string;
}

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Strips sensitive fields (passwords, tokens) from the account before
 * returning it to the client. Replaces encrypted values with a boolean
 * flag indicating whether they are configured.
 */
function sanitizeAccountResponse(account: EmailAccount) {
  return {
    id: account.id,
    team_member_id: account.team_member_id,
    email_address: account.email_address,
    imap_host: account.imap_host ?? null,
    imap_port: account.imap_port ?? null,
    imap_username: account.imap_username ?? null,
    imap_configured: !!(account.imap_host && account.imap_username && account.imap_password),
    smtp_host: account.smtp_host ?? null,
    smtp_port: account.smtp_port ?? null,
    smtp_username: account.smtp_username ?? null,
    smtp_configured: !!(account.smtp_host && account.smtp_username && account.smtp_password),
    sync_enabled: account.sync_enabled,
    last_sync_at: account.last_sync_at
      ? (typeof account.last_sync_at === 'string'
          ? account.last_sync_at
          : (account.last_sync_at as Date).toISOString?.() ?? account.last_sync_at)
      : null,
    sync_status: account.sync_status,
    sync_error: account.sync_error ?? null,
    created_at: typeof account.created_at === 'string'
      ? account.created_at
      : (account.created_at as Date).toISOString?.() ?? account.created_at,
    updated_at: typeof account.updated_at === 'string'
      ? account.updated_at
      : (account.updated_at as Date).toISOString?.() ?? account.updated_at,
  };
}

/**
 * Encrypts a password if it's not already encrypted.
 */
function encryptPassword(password: string): string {
  if (isEncrypted(password)) {
    return password;
  }
  return encrypt(password);
}

/**
 * Verifies that the authenticated user owns the email account or is an admin.
 */
async function verifyAccountOwnership(
  accountId: string,
  userId: string,
  userRole: string
): Promise<EmailAccount> {
  const account = await db.queryOne<EmailAccount>(
    'SELECT * FROM email_accounts WHERE id = $1',
    [accountId]
  );

  if (!account) {
    throw new NotFoundError('Email account', accountId);
  }

  if (account.team_member_id !== userId && userRole !== 'admin') {
    throw new AuthorizationError('You can only manage your own email accounts');
  }

  return account;
}

// =============================================================================
// Route Registration
// =============================================================================

export async function emailAccountsRoutes(fastify: FastifyInstance): Promise<void> {
  const emailSyncService = getEmailSyncService();

  // ===========================================================================
  // GET /api/v1/email-accounts
  // List email accounts for the current user (admins see all)
  // ===========================================================================
  fastify.get(
    '/email-accounts',
    {
      preHandler: authenticateOrApiKey,
      schema: {
        response: {
          200: {
            type: 'object',
            properties: {
              data: { type: 'array', items: { type: 'object', additionalProperties: true } },
            },
          },
        },
      },
    },
    async (request, _reply) => {
      const user = request.user;

      let accounts: EmailAccount[];

      if (user.role === 'admin') {
        accounts = await db.query<EmailAccount>(
          `SELECT * FROM email_accounts ORDER BY created_at DESC`
        );
      } else {
        accounts = await db.query<EmailAccount>(
          `SELECT * FROM email_accounts WHERE team_member_id = $1 ORDER BY created_at DESC`,
          [user.id]
        );
      }

      return {
        data: accounts.map(sanitizeAccountResponse),
      };
    }
  );

  // ===========================================================================
  // GET /api/v1/email-accounts/:id
  // Get a single email account by ID
  // ===========================================================================
  fastify.get<{
    Params: IdParams;
  }>(
    '/email-accounts/:id',
    {
      preHandler: authenticateOrApiKey,
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
      const paramResult = accountIdParamSchema.safeParse(request.params);
      if (!paramResult.success) {
        throw new ValidationError('Invalid email account ID', {
          validationErrors: paramResult.error.errors,
        });
      }

      const user = request.user;
      const account = await verifyAccountOwnership(
        paramResult.data.id,
        user.id,
        user.role
      );

      return sanitizeAccountResponse(account);
    }
  );

  // ===========================================================================
  // POST /api/v1/email-accounts
  // Create a new email account for the current user
  // ===========================================================================
  fastify.post(
    '/email-accounts',
    {
      preHandler: authenticateOrApiKey,
      schema: {
        body: {
          type: 'object',
          required: ['email_address'],
          properties: {
            email_address: { type: 'string', format: 'email' },
            imap_host: { type: 'string', maxLength: 255 },
            imap_port: { type: 'integer', minimum: 1, maximum: 65535 },
            imap_username: { type: 'string', maxLength: 255 },
            imap_password: { type: 'string', maxLength: 500 },
            smtp_host: { type: 'string', maxLength: 255 },
            smtp_port: { type: 'integer', minimum: 1, maximum: 65535 },
            smtp_username: { type: 'string', maxLength: 255 },
            smtp_password: { type: 'string', maxLength: 500 },
            sync_enabled: { type: 'boolean' },
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
      const parseResult = createEmailAccountSchema.safeParse(request.body);
      if (!parseResult.success) {
        throw new ValidationError('Invalid email account data', {
          validationErrors: parseResult.error.errors,
        });
      }

      const user = request.user;
      const data = parseResult.data;

      // Check for duplicate email address for this user
      const existing = await db.queryOne<{ id: string }>(
        `SELECT id FROM email_accounts
         WHERE team_member_id = $1 AND email_address = $2`,
        [user.id, data.email_address]
      );

      if (existing) {
        throw new ValidationError(
          `Email account ${data.email_address} is already configured for your account`
        );
      }

      // Encrypt passwords before storage
      const imapPassword = data.imap_password
        ? encryptPassword(data.imap_password)
        : null;
      const smtpPassword = data.smtp_password
        ? encryptPassword(data.smtp_password)
        : null;

      const account = await db.queryOne<EmailAccount>(
        `INSERT INTO email_accounts (
          team_member_id, email_address,
          imap_host, imap_port, imap_username, imap_password,
          smtp_host, smtp_port, smtp_username, smtp_password,
          sync_enabled, sync_status,
          created_at, updated_at
        ) VALUES (
          $1, $2,
          $3, $4, $5, $6,
          $7, $8, $9, $10,
          $11, 'idle',
          NOW(), NOW()
        )
        RETURNING *`,
        [
          user.id,
          data.email_address,
          data.imap_host ?? null,
          data.imap_port ?? null,
          data.imap_username ?? null,
          imapPassword,
          data.smtp_host ?? null,
          data.smtp_port ?? null,
          data.smtp_username ?? null,
          smtpPassword,
          data.sync_enabled ?? false,
        ]
      );

      if (!account) {
        throw new ValidationError('Failed to create email account');
      }

      request.log.info(
        { accountId: account.id, email: account.email_address },
        'Email account created'
      );

      return reply.code(201).send(sanitizeAccountResponse(account));
    }
  );

  // ===========================================================================
  // PATCH /api/v1/email-accounts/:id
  // Update an email account
  // ===========================================================================
  fastify.patch<{
    Params: IdParams;
  }>(
    '/email-accounts/:id',
    {
      preHandler: authenticateOrApiKey,
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
            email_address: { type: 'string', format: 'email' },
            imap_host: { type: 'string', maxLength: 255, nullable: true },
            imap_port: { type: 'integer', minimum: 1, maximum: 65535, nullable: true },
            imap_username: { type: 'string', maxLength: 255, nullable: true },
            imap_password: { type: 'string', maxLength: 500, nullable: true },
            smtp_host: { type: 'string', maxLength: 255, nullable: true },
            smtp_port: { type: 'integer', minimum: 1, maximum: 65535, nullable: true },
            smtp_username: { type: 'string', maxLength: 255, nullable: true },
            smtp_password: { type: 'string', maxLength: 500, nullable: true },
            sync_enabled: { type: 'boolean' },
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
      const paramResult = accountIdParamSchema.safeParse(request.params);
      if (!paramResult.success) {
        throw new ValidationError('Invalid email account ID', {
          validationErrors: paramResult.error.errors,
        });
      }

      const bodyResult = updateEmailAccountSchema.safeParse(request.body);
      if (!bodyResult.success) {
        throw new ValidationError('Invalid email account data', {
          validationErrors: bodyResult.error.errors,
        });
      }

      const user = request.user;
      await verifyAccountOwnership(paramResult.data.id, user.id, user.role);

      const data = bodyResult.data;

      // Build dynamic SET clause
      const setClauses: string[] = ['updated_at = NOW()'];
      const params: unknown[] = [paramResult.data.id];
      let paramIdx = 2;

      const fieldMap: Record<string, unknown> = {
        email_address: data.email_address,
        imap_host: data.imap_host,
        imap_port: data.imap_port,
        imap_username: data.imap_username,
        smtp_host: data.smtp_host,
        smtp_port: data.smtp_port,
        smtp_username: data.smtp_username,
        sync_enabled: data.sync_enabled,
      };

      for (const [column, value] of Object.entries(fieldMap)) {
        if (value !== undefined) {
          setClauses.push(`${column} = $${paramIdx}`);
          params.push(value);
          paramIdx++;
        }
      }

      // Handle password fields separately (encrypt before storing)
      if (data.imap_password !== undefined) {
        setClauses.push(`imap_password = $${paramIdx}`);
        params.push(data.imap_password ? encryptPassword(data.imap_password) : null);
        paramIdx++;
      }

      if (data.smtp_password !== undefined) {
        setClauses.push(`smtp_password = $${paramIdx}`);
        params.push(data.smtp_password ? encryptPassword(data.smtp_password) : null);
        paramIdx++;
      }

      if (setClauses.length === 1) {
        // Only 'updated_at = NOW()' — nothing to update
        const account = await db.queryOne<EmailAccount>(
          'SELECT * FROM email_accounts WHERE id = $1',
          [paramResult.data.id]
        );
        return sanitizeAccountResponse(account!);
      }

      const account = await db.queryOne<EmailAccount>(
        `UPDATE email_accounts
         SET ${setClauses.join(', ')}
         WHERE id = $1
         RETURNING *`,
        params
      );

      if (!account) {
        throw new NotFoundError('Email account', paramResult.data.id);
      }

      request.log.info(
        { accountId: account.id, email: account.email_address },
        'Email account updated'
      );

      return sanitizeAccountResponse(account);
    }
  );

  // ===========================================================================
  // DELETE /api/v1/email-accounts/:id
  // Delete an email account
  // ===========================================================================
  fastify.delete<{
    Params: IdParams;
  }>(
    '/email-accounts/:id',
    {
      preHandler: authenticateOrApiKey,
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
      const paramResult = accountIdParamSchema.safeParse(request.params);
      if (!paramResult.success) {
        throw new ValidationError('Invalid email account ID', {
          validationErrors: paramResult.error.errors,
        });
      }

      const user = request.user;
      const account = await verifyAccountOwnership(
        paramResult.data.id,
        user.id,
        user.role
      );

      await db.execute('DELETE FROM email_accounts WHERE id = $1', [paramResult.data.id]);

      request.log.info(
        { accountId: paramResult.data.id, email: account.email_address },
        'Email account deleted'
      );

      return { success: true, message: 'Email account deleted' };
    }
  );

  // ===========================================================================
  // POST /api/v1/email-accounts/:id/sync
  // Trigger manual email synchronization for an account
  // ===========================================================================
  fastify.post<{
    Params: IdParams;
  }>(
    '/email-accounts/:id/sync',
    {
      preHandler: authenticateOrApiKey,
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
              result: { type: 'object', additionalProperties: true },
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
          422: {
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
      const paramResult = accountIdParamSchema.safeParse(request.params);
      if (!paramResult.success) {
        throw new ValidationError('Invalid email account ID', {
          validationErrors: paramResult.error.errors,
        });
      }

      const user = request.user;
      const account = await verifyAccountOwnership(
        paramResult.data.id,
        user.id,
        user.role
      );

      // Check sync prerequisites
      if (!account.imap_host || !account.imap_username || !account.imap_password) {
        throw new ValidationError(
          'IMAP configuration is incomplete. Please configure IMAP settings first.'
        );
      }

      // Check if already syncing
      const status = await emailSyncService.getAccountStatus(paramResult.data.id);
      if (status?.sync_status === 'syncing') {
        return {
          success: false,
          result: {
            message: 'Sync is already in progress',
            sync_status: 'syncing',
          },
        };
      }

      request.log.info(
        { accountId: paramResult.data.id, email: account.email_address },
        'Manual email sync triggered'
      );

      const result = await emailSyncService.syncEmailAccount(paramResult.data.id);

      return {
        success: result.success,
        result: {
          new_messages: result.newMessages,
          skipped_duplicates: result.skippedDuplicates,
          errors: result.errors,
          email: result.email,
        },
      };
    }
  );

  // ===========================================================================
  // POST /api/v1/email-accounts/:id/test
  // Test IMAP connection for an email account
  // ===========================================================================
  fastify.post<{
    Params: IdParams;
  }>(
    '/email-accounts/:id/test',
    {
      preHandler: authenticateOrApiKey,
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
              error: { type: 'string', nullable: true },
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
      const paramResult = accountIdParamSchema.safeParse(request.params);
      if (!paramResult.success) {
        throw new ValidationError('Invalid email account ID', {
          validationErrors: paramResult.error.errors,
        });
      }

      const user = request.user;
      await verifyAccountOwnership(paramResult.data.id, user.id, user.role);

      request.log.info(
        { accountId: paramResult.data.id },
        'Testing IMAP connection'
      );

      const result = await emailSyncService.testImapConnection(paramResult.data.id);

      return {
        success: result.success,
        error: result.error ?? null,
      };
    }
  );
}

export default emailAccountsRoutes;
