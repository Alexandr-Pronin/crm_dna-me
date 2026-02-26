// =============================================================================
// src/api/routes/webhooks.ts
// Webhook endpoints for external services (Cituro, etc.)
// =============================================================================

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { createHmac, timingSafeEqual } from 'crypto';
import { config } from '../../config/index.js';

// =============================================================================
// Cituro Webhook – Event & payload types
// =============================================================================

interface CituroWebhookPayload {
  type?: string;
  event?: string;
  data?: {
    booking?: {
      customerId?: string;
      [key: string]: unknown;
    };
    appointment?: Record<string, unknown>;
    [key: string]: unknown;
  };
  [key: string]: unknown;
}

// =============================================================================
// Cituro signature verification (X-CITURO-SIGNATURE: t=timestamp, s=signature)
// Reconstruct: payloadString = t + '.' + JSON.stringify(request.body)
// HMAC-SHA256(payloadString, webhookSecret) must equal s; t must be within 5 min (replay protection)
// =============================================================================

const CITURO_SIGNATURE_MAX_AGE_MS = 5 * 60 * 1000;

function verifyCituroSignature(
  header: string | undefined,
  rawPayload: string,
  secret: string
): boolean {
  if (!header || !secret) return false;
  const tMatch = header.match(/t=(\d+)/);
  const sMatch = header.match(/s=([^,\s]+)/);
  const t = tMatch?.[1];
  const s = sMatch?.[1];
  if (!t || !s) return false;
  const timestamp = parseInt(t, 10);
  if (Number.isNaN(timestamp)) return false;
  const age = Date.now() - timestamp;
  if (age < 0 || age > CITURO_SIGNATURE_MAX_AGE_MS) return false; // replay protection
  const payloadString = `${t}.${rawPayload}`;
  const expected = createHmac('sha256', secret).update(payloadString).digest('hex');
  const expectedBuffer = Buffer.from(expected, 'hex');
  const providedBuffer = Buffer.from(s, 'hex');
  if (expectedBuffer.length !== providedBuffer.length) return false;
  return timingSafeEqual(expectedBuffer, providedBuffer);
}

// =============================================================================
// Routes
// =============================================================================

export async function webhooksRoutes(fastify: FastifyInstance): Promise<void> {
  // -------------------------------------------------------------------------
  // POST /webhooks/cituro – Cituro booking.created (and other events)
  // Security: X-CITURO-SIGNATURE verification (t=timestamp, s=hmac); raw body captured in preParsing
  // -------------------------------------------------------------------------
  fastify.post<{ Body: CituroWebhookPayload }>(
    '/webhooks/cituro',
    async (request: FastifyRequest<{ Body: CituroWebhookPayload }>, reply: FastifyReply) => {
      const secret = config.cituro?.webhookSecret;
      if (!secret) {
        request.log.warn('Cituro webhook received but CITURO_WEBHOOK_SECRET is not set');
        return reply.code(503).send({ error: 'Webhook not configured' });
      }

      const signatureHeader = request.headers['x-cituro-signature'] as string | undefined;
      const rawPayload = JSON.stringify(request.body ?? {});

      if (!verifyCituroSignature(signatureHeader, rawPayload, secret)) {
        request.log.warn({ header: signatureHeader ? 'present' : 'missing' }, 'Cituro webhook signature invalid');
        return reply.code(401).send({ error: 'Invalid signature' });
      }

      const body = request.body ?? {};
      const event = (body.event ?? body.type) as string | undefined;
      if (!event) {
        request.log.info(body, 'Cituro webhook with no event/type');
        return { received: true };
      }

      if (event === 'booking.created') {
        const data = body.data ?? {};
        const booking = data.booking ?? {};
        const customerId = booking.customerId ?? (booking as { customer_id?: string }).customer_id;
        const appointment = data.appointment ?? {};
        request.log.info(
          { customerId, appointment, booking: Object.keys(booking) },
          'TODO: Create CRM Task from Cituro booking.created'
        );
        // TODO: Create CRM Task – e.g. link to lead by customerId, create task "Follow-up: Meeting booked"
      }

      return { received: true, event };
    }
  );
}
