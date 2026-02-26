import { FastifyRequest, FastifyReply } from 'fastify';
import { validateApiKey } from './apiKey.js';

export async function authenticateOrApiKey(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  let jwtError = null;
  
  // 1. Try JWT
  if (request.headers.authorization) {
    try {
      await request.jwtVerify();
      return;
      } catch (err: any) {
      jwtError = err;
    }
  }

  // 2. Try API Key
  try {
    await validateApiKey(request, reply);
    return;
  } catch (apiKeyError: any) {
    // If both failed, throw error
    // If JWT was attempted and failed, maybe return that error?
    // Or return a generic 401.
    reply.code(401).send({
      statusCode: 401,
      error: 'Unauthorized',
      message: 'Authentication required (JWT or API Key)',
      // Only include details in dev/debug if needed, but for now helpful
      details: {
        jwt: jwtError?.message,
        apiKey: apiKeyError.message
      }
    });
    return; // Stop execution
  }
}
