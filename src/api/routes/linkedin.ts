// =============================================================================
// src/api/routes/linkedin.ts
// LinkedIn Integration API Routes
//
// Provides endpoints for:
//  - Checking LinkedIn API availability and integration mode
//  - OAuth authentication flow (when credentials are configured)
//  - Managing LinkedIn connections
//  - Sending messages (via SNAP/gateway) or falling back to manual link
//  - Saving LinkedIn profile links (manual fallback)
// =============================================================================

import type { FastifyInstance } from 'fastify';
import crypto from 'crypto';
import { z } from 'zod';
import { authenticateOrApiKey } from '../middleware/auth.js';
import { getLinkedInService } from '../../services/linkedinService.js';
import { ValidationError, BusinessLogicError } from '../../errors/index.js';

// =============================================================================
// Zod Schemas
// =============================================================================

const oauthCallbackSchema = z.object({
  code: z.string().min(1),
  state: z.string().min(1),
});

const sendMessageSchema = z.object({
  conversation_id: z.string().uuid(),
  recipient_profile_url: z.string().url().refine(
    (url) => url.includes('linkedin.com/'),
    { message: 'Must be a valid LinkedIn profile URL' }
  ),
  message: z.string().min(1).max(5000),
});

const saveProfileLinkSchema = z.object({
  conversation_id: z.string().uuid(),
  linkedin_profile_url: z.string().min(1).refine(
    (url) => url.includes('linkedin.com'),
    { message: 'Must be a valid LinkedIn URL' }
  ),
  profile_name: z.string().max(255).optional(),
});

// =============================================================================
// In-memory OAuth state store (production: use Redis)
// =============================================================================

const oauthStates = new Map<string, { userId: string; createdAt: number }>();

function cleanupExpiredStates(): void {
  const now = Date.now();
  const maxAgeMs = 10 * 60 * 1000; // 10 minutes
  for (const [key, val] of oauthStates) {
    if (now - val.createdAt > maxAgeMs) {
      oauthStates.delete(key);
    }
  }
}

// =============================================================================
// Route Registration
// =============================================================================

export async function linkedinRoutes(fastify: FastifyInstance): Promise<void> {
  const linkedinService = getLinkedInService();

  // ===========================================================================
  // GET /api/v1/linkedin/status
  // Check LinkedIn API availability, integration mode, and capabilities
  // ===========================================================================
  fastify.get(
    '/linkedin/status',
    {
      preHandler: authenticateOrApiKey,
      schema: {
        response: {
          200: {
            type: 'object',
            properties: {
              mode: { type: 'string' },
              messaging_available: { type: 'boolean' },
              profile_read_available: { type: 'boolean' },
              oauth_configured: { type: 'boolean' },
              gateway_configured: { type: 'boolean' },
              snap_configured: { type: 'boolean' },
              details: { type: 'string' },
              required_scopes: { type: 'array', items: { type: 'string' } },
              detected_scopes: { type: 'array', items: { type: 'string' } },
              recommendations: { type: 'array', items: { type: 'string' } },
            },
          },
        },
      },
    },
    async (_request, _reply) => {
      const status = await linkedinService.checkApiAvailability();
      return status;
    }
  );

  // ===========================================================================
  // GET /api/v1/linkedin/auth
  // Generate LinkedIn OAuth authorization URL
  // ===========================================================================
  fastify.get(
    '/linkedin/auth',
    {
      preHandler: authenticateOrApiKey,
      schema: {
        response: {
          200: {
            type: 'object',
            properties: {
              auth_url: { type: 'string' },
              state: { type: 'string' },
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
      if (!linkedinService.isOAuthConfigured()) {
        throw new BusinessLogicError(
          'LinkedIn OAuth is not configured. Set LINKEDIN_CLIENT_ID and LINKEDIN_CLIENT_SECRET environment variables.',
          {
            required_env_vars: [
              'LINKEDIN_CLIENT_ID',
              'LINKEDIN_CLIENT_SECRET',
              'LINKEDIN_REDIRECT_URI',
            ],
          }
        );
      }

      // Generate CSRF state token
      const state = crypto.randomBytes(20).toString('hex');
      cleanupExpiredStates();
      oauthStates.set(state, {
        userId: request.user.id,
        createdAt: Date.now(),
      });

      const authUrl = linkedinService.getAuthUrl(state);

      return { auth_url: authUrl, state };
    }
  );

  // ===========================================================================
  // POST /api/v1/linkedin/callback
  // Handle OAuth callback (exchange code for tokens)
  // ===========================================================================
  fastify.post(
    '/linkedin/callback',
    {
      preHandler: authenticateOrApiKey,
      schema: {
        body: {
          type: 'object',
          required: ['code', 'state'],
          properties: {
            code: { type: 'string' },
            state: { type: 'string' },
          },
        },
        response: {
          200: {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              profile: { type: 'object', additionalProperties: true },
              message: { type: 'string' },
            },
          },
        },
      },
    },
    async (request, _reply) => {
      const body = oauthCallbackSchema.safeParse(request.body);
      if (!body.success) {
        throw new ValidationError('Invalid callback data', {
          validationErrors: body.error.errors,
        });
      }

      const { code, state } = body.data;

      // Verify CSRF state
      const storedState = oauthStates.get(state);
      if (!storedState) {
        throw new ValidationError('Invalid or expired OAuth state. Please restart the authentication flow.');
      }
      oauthStates.delete(state);

      // Verify the state belongs to the requesting user
      if (storedState.userId !== request.user.id) {
        throw new ValidationError('OAuth state does not match the current user.');
      }

      // Exchange code for tokens
      const tokens = await linkedinService.exchangeCodeForToken(code);

      // Fetch profile
      const profile = await linkedinService.getProfile(tokens.access_token);

      // Store connection
      await linkedinService.storeConnection(request.user.id, tokens, profile);

      request.log.info(
        { teamMemberId: request.user.id, linkedInProfileId: profile.id },
        'LinkedIn connection established'
      );

      return {
        success: true,
        profile: {
          id: profile.id,
          first_name: profile.localizedFirstName,
          last_name: profile.localizedLastName,
          picture: profile.profilePicture,
        },
        message: 'LinkedIn account connected successfully',
      };
    }
  );

  // ===========================================================================
  // POST /api/v1/linkedin/disconnect
  // Disconnect LinkedIn account
  // ===========================================================================
  fastify.post(
    '/linkedin/disconnect',
    {
      preHandler: authenticateOrApiKey,
      schema: {
        response: {
          200: {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              message: { type: 'string' },
            },
          },
        },
      },
    },
    async (request, _reply) => {
      await linkedinService.disconnect(request.user.id);

      request.log.info(
        { teamMemberId: request.user.id },
        'LinkedIn connection disconnected'
      );

      return {
        success: true,
        message: 'LinkedIn account disconnected',
      };
    }
  );

  // ===========================================================================
  // GET /api/v1/linkedin/connection
  // Get current user's LinkedIn connection status
  // ===========================================================================
  fastify.get(
    '/linkedin/connection',
    {
      preHandler: authenticateOrApiKey,
      schema: {
        response: {
          200: {
            type: 'object',
            properties: {
              connected: { type: 'boolean' },
              profile_id: { type: 'string', nullable: true },
              profile_data: { type: 'object', additionalProperties: true, nullable: true },
              token_expires_at: { type: 'string', nullable: true },
              last_sync_at: { type: 'string', nullable: true },
            },
          },
        },
      },
    },
    async (request, _reply) => {
      const connection = await linkedinService.getConnection(request.user.id);

      if (!connection) {
        return {
          connected: false,
          profile_id: null,
          profile_data: null,
          token_expires_at: null,
          last_sync_at: null,
        };
      }

      return {
        connected: true,
        profile_id: connection.linkedin_profile_id ?? null,
        profile_data: connection.profile_data ?? null,
        token_expires_at: connection.token_expires_at
          ? new Date(connection.token_expires_at).toISOString()
          : null,
        last_sync_at: connection.last_sync_at
          ? new Date(connection.last_sync_at).toISOString()
          : null,
      };
    }
  );

  // ===========================================================================
  // POST /api/v1/linkedin/send-message
  // Send a LinkedIn message (mode-dependent)
  // ===========================================================================
  fastify.post(
    '/linkedin/send-message',
    {
      preHandler: authenticateOrApiKey,
      schema: {
        body: {
          type: 'object',
          required: ['conversation_id', 'recipient_profile_url', 'message'],
          properties: {
            conversation_id: { type: 'string', format: 'uuid' },
            recipient_profile_url: { type: 'string' },
            message: { type: 'string', minLength: 1, maxLength: 5000 },
          },
        },
        response: {
          200: {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              mode: { type: 'string' },
              details: { type: 'string' },
              messaging_url: { type: 'string', nullable: true },
            },
          },
        },
      },
    },
    async (request, _reply) => {
      const body = sendMessageSchema.safeParse(request.body);
      if (!body.success) {
        throw new ValidationError('Invalid message data', {
          validationErrors: body.error.errors,
        });
      }

      const result = await linkedinService.sendMessage(
        request.user.id,
        body.data.recipient_profile_url,
        body.data.message
      );

      // If messaging isn't available, provide a direct URL
      const messagingUrl = !result.success
        ? linkedinService.getMessagingUrl(body.data.recipient_profile_url)
        : null;

      return {
        success: result.success,
        mode: result.mode,
        details: result.details,
        messaging_url: messagingUrl,
      };
    }
  );

  // ===========================================================================
  // POST /api/v1/linkedin/save-profile-link
  // Save a LinkedIn profile link (manual fallback)
  // ===========================================================================
  fastify.post(
    '/linkedin/save-profile-link',
    {
      preHandler: authenticateOrApiKey,
      schema: {
        body: {
          type: 'object',
          required: ['conversation_id', 'linkedin_profile_url'],
          properties: {
            conversation_id: { type: 'string', format: 'uuid' },
            linkedin_profile_url: { type: 'string' },
            profile_name: { type: 'string', maxLength: 255 },
          },
        },
        response: {
          200: {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              profile_url: { type: 'string' },
              messaging_url: { type: 'string' },
            },
          },
        },
      },
    },
    async (request, _reply) => {
      const body = saveProfileLinkSchema.safeParse(request.body);
      if (!body.success) {
        throw new ValidationError('Invalid profile link data', {
          validationErrors: body.error.errors,
        });
      }

      const result = await linkedinService.saveProfileLink(body.data);
      const messagingUrl = linkedinService.getMessagingUrl(result.profile_url);

      request.log.info(
        { conversationId: body.data.conversation_id, profileUrl: result.profile_url },
        'LinkedIn profile link saved'
      );

      return {
        success: result.success,
        profile_url: result.profile_url,
        messaging_url: messagingUrl,
      };
    }
  );
}

export default linkedinRoutes;
