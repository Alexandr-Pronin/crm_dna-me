// =============================================================================
// src/api/middleware/conversationAuth.ts
// Middleware for conversation-level access control
// Checks that the authenticated user has access to the requested conversation
// =============================================================================

import type { FastifyRequest, FastifyReply } from 'fastify';
import { getConversationService } from '../../services/conversationService.js';

/**
 * Fastify preHandler that verifies the current user has access to the
 * conversation identified by `request.params.id`.
 *
 * Must be used AFTER `authenticateOrApiKey` so that `request.user` is populated.
 */
export async function checkConversationAccess(
  request: FastifyRequest<{ Params: { id: string } }>,
  reply: FastifyReply
): Promise<void> {
  const conversationId = request.params.id;
  const user = request.user;

  if (!user) {
    reply.code(401).send({
      statusCode: 401,
      error: 'Unauthorized',
      message: 'Authentication required',
    });
    return;
  }

  const conversationService = getConversationService();
  const hasAccess = await conversationService.checkAccess(
    conversationId,
    user.id,
    user.email,
    user.role
  );

  if (!hasAccess) {
    reply.code(403).send({
      statusCode: 403,
      error: 'Forbidden',
      message: 'You do not have access to this conversation',
    });
    return;
  }
}
