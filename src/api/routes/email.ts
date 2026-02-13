// =============================================================================
// src/api/routes/email.ts
// E-Mail Tracking API Routes (Opens, Clicks, Unsubscribe)
// =============================================================================

import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { getEmailService, EmailService } from '../../services/emailService.js';
import { db } from '../../db/index.js';
import { NotFoundError, ValidationError } from '../../errors/index.js';

// =============================================================================
// Zod Schemas
// =============================================================================

const trackingIdParamSchema = z.object({
  trackingId: z.string().uuid()
});

const enrollmentIdParamSchema = z.object({
  enrollmentId: z.string().uuid()
});

const clickQuerySchema = z.object({
  url: z.string().url()
});

// =============================================================================
// Type Definitions
// =============================================================================

interface TrackingIdParams {
  trackingId: string;
}

interface EnrollmentIdParams {
  enrollmentId: string;
}

interface ClickQuery {
  url?: string;
}

// =============================================================================
// Route Registration
// =============================================================================

export async function emailRoutes(fastify: FastifyInstance): Promise<void> {
  const emailService = getEmailService();

  // ===========================================================================
  // GET /api/v1/email/track/open/:trackingId.gif
  // ===========================================================================
  /**
   * Tracking-Pixel für E-Mail-Opens.
   * Gibt ein transparentes 1x1 GIF zurück und zeichnet den Open auf.
   */
  fastify.get<{
    Params: TrackingIdParams;
  }>(
    '/email/track/open/:trackingId.gif',
    {
      schema: {
        params: {
          type: 'object',
          required: ['trackingId'],
          properties: {
            trackingId: { type: 'string' }
          }
        },
        response: {
          200: {
            type: 'string',
            description: 'Transparent 1x1 GIF image'
          }
        }
      }
    },
    async (request, reply) => {
      // Extract tracking ID (remove .gif extension)
      const trackingIdWithExt = request.params.trackingId;
      const trackingId = trackingIdWithExt.replace(/\.gif$/i, '');

      // Validate UUID format
      const parseResult = trackingIdParamSchema.safeParse({ trackingId });
      
      if (parseResult.success) {
        // Record the open (fire and forget, don't block response)
        emailService.recordOpen(trackingId).catch(err => {
          request.log.error({ err, trackingId }, 'Failed to record email open');
        });
      }

      // Always return the tracking pixel (don't reveal if tracking ID is valid)
      const pixel = EmailService.getTransparentPixel();

      return reply
        .header('Content-Type', 'image/gif')
        .header('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate')
        .header('Pragma', 'no-cache')
        .header('Expires', '0')
        .send(pixel);
    }
  );

  // ===========================================================================
  // GET /api/v1/email/track/click/:trackingId
  // ===========================================================================
  /**
   * Link-Tracking für E-Mail-Clicks.
   * Zeichnet den Click auf und leitet zur ursprünglichen URL weiter.
   */
  fastify.get<{
    Params: TrackingIdParams;
    Querystring: ClickQuery;
  }>(
    '/email/track/click/:trackingId',
    {
      schema: {
        params: {
          type: 'object',
          required: ['trackingId'],
          properties: {
            trackingId: { type: 'string', format: 'uuid' }
          }
        },
        querystring: {
          type: 'object',
          properties: {
            url: { type: 'string' }
          }
        },
        response: {
          302: {
            type: 'null',
            description: 'Redirect to original URL'
          }
        }
      }
    },
    async (request, reply) => {
      const { trackingId } = request.params;
      const { url } = request.query;

      // Validate tracking ID
      const paramResult = trackingIdParamSchema.safeParse({ trackingId });
      if (!paramResult.success) {
        // Invalid tracking ID - redirect to fallback or homepage
        return redirectToFallback(reply, url);
      }

      // Decode URL
      let targetUrl: string;
      try {
        targetUrl = url ? decodeURIComponent(url) : '';
        
        // Validate it's actually a URL
        if (targetUrl) {
          new URL(targetUrl);
        }
      } catch {
        return redirectToFallback(reply, undefined);
      }

      // Record the click (fire and forget)
      emailService.recordClick(trackingId, targetUrl).catch(err => {
        request.log.error({ err, trackingId, url: targetUrl }, 'Failed to record email click');
      });

      // Redirect to the original URL
      if (targetUrl) {
        return reply.redirect(302, targetUrl);
      }

      // No URL provided - redirect to homepage
      return redirectToFallback(reply, undefined);
    }
  );

  // ===========================================================================
  // GET /api/v1/email/unsubscribe/:enrollmentId
  // ===========================================================================
  /**
   * Abmelde-Seite für E-Mail-Sequenzen.
   * Zeigt eine Bestätigungsseite an.
   */
  fastify.get<{
    Params: EnrollmentIdParams;
  }>(
    '/email/unsubscribe/:enrollmentId',
    {
      schema: {
        params: {
          type: 'object',
          required: ['enrollmentId'],
          properties: {
            enrollmentId: { type: 'string', format: 'uuid' }
          }
        },
        response: {
          200: {
            type: 'string',
            description: 'HTML unsubscribe confirmation page'
          }
        }
      }
    },
    async (request, reply) => {
      const { enrollmentId } = request.params;

      // Validate enrollment ID
      const parseResult = enrollmentIdParamSchema.safeParse({ enrollmentId });
      if (!parseResult.success) {
        return reply
          .status(400)
          .type('text/html')
          .send(generateUnsubscribePage('error', 'Ungültiger Abmelde-Link.'));
      }

      // Check if enrollment exists
      const enrollment = await db.queryOne<{
        id: string;
        status: string;
        lead_id: string;
      }>(
        `SELECT ese.id, ese.status, l.email
         FROM email_sequence_enrollments ese
         JOIN leads l ON ese.lead_id = l.id
         WHERE ese.id = $1`,
        [enrollmentId]
      );

      if (!enrollment) {
        return reply
          .status(404)
          .type('text/html')
          .send(generateUnsubscribePage('error', 'Dieser Abmelde-Link ist nicht mehr gültig.'));
      }

      if (enrollment.status === 'unsubscribed') {
        return reply
          .type('text/html')
          .send(generateUnsubscribePage('already_unsubscribed', 'Sie wurden bereits von dieser E-Mail-Liste abgemeldet.'));
      }

      // Return unsubscribe confirmation page
      return reply
        .type('text/html')
        .send(generateUnsubscribePage('confirm', 'Möchten Sie sich wirklich abmelden?', enrollmentId));
    }
  );

  // ===========================================================================
  // POST /api/v1/email/unsubscribe/:enrollmentId
  // ===========================================================================
  /**
   * Führt die Abmeldung durch.
   */
  fastify.post<{
    Params: EnrollmentIdParams;
  }>(
    '/email/unsubscribe/:enrollmentId',
    {
      schema: {
        params: {
          type: 'object',
          required: ['enrollmentId'],
          properties: {
            enrollmentId: { type: 'string', format: 'uuid' }
          }
        },
        response: {
          200: {
            type: 'string',
            description: 'HTML confirmation page'
          }
        }
      }
    },
    async (request, reply) => {
      const { enrollmentId } = request.params;

      // Validate enrollment ID
      const parseResult = enrollmentIdParamSchema.safeParse({ enrollmentId });
      if (!parseResult.success) {
        return reply
          .status(400)
          .type('text/html')
          .send(generateUnsubscribePage('error', 'Ungültiger Abmelde-Link.'));
      }

      // Process unsubscribe
      const success = await emailService.recordUnsubscribe(enrollmentId);

      if (success) {
        request.log.info({ enrollmentId }, 'User unsubscribed from email sequence');
        return reply
          .type('text/html')
          .send(generateUnsubscribePage('success', 'Sie wurden erfolgreich von unserer E-Mail-Liste abgemeldet.'));
      } else {
        return reply
          .type('text/html')
          .send(generateUnsubscribePage('error', 'Die Abmeldung konnte nicht durchgeführt werden. Bitte versuchen Sie es später erneut.'));
      }
    }
  );

  // ===========================================================================
  // GET /api/v1/email/stats/:trackingId
  // ===========================================================================
  /**
   * Holt Tracking-Statistiken für eine einzelne E-Mail (nur für API-Zugriff).
   */
  fastify.get<{
    Params: TrackingIdParams;
  }>(
    '/email/stats/:trackingId',
    {
      schema: {
        params: {
          type: 'object',
          required: ['trackingId'],
          properties: {
            trackingId: { type: 'string', format: 'uuid' }
          }
        },
        response: {
          200: {
            type: 'object',
            properties: {
              tracking_id: { type: 'string' },
              sent_at: { type: 'string' },
              opened_at: { type: 'string', nullable: true },
              open_count: { type: 'integer' },
              clicked_at: { type: 'string', nullable: true },
              click_count: { type: 'integer' },
              bounced_at: { type: 'string', nullable: true },
              unsubscribed_at: { type: 'string', nullable: true }
            }
          },
          404: {
            type: 'object',
            properties: {
              error: {
                type: 'object',
                properties: {
                  code: { type: 'string' },
                  message: { type: 'string' }
                }
              }
            }
          }
        }
      }
    },
    async (request) => {
      const { trackingId } = request.params;

      // Validate tracking ID
      const parseResult = trackingIdParamSchema.safeParse({ trackingId });
      if (!parseResult.success) {
        throw new ValidationError('Ungültige Tracking-ID');
      }

      const stats = await emailService.getTrackingStats(trackingId);

      if (!stats) {
        throw new NotFoundError('Tracking-Eintrag', trackingId);
      }

      return {
        tracking_id: stats.id,
        sent_at: stats.sent_at,
        opened_at: stats.opened_at || null,
        open_count: stats.open_count,
        clicked_at: stats.clicked_at || null,
        click_count: stats.click_count,
        bounced_at: stats.bounced_at || null,
        unsubscribed_at: stats.unsubscribed_at || null
      };
    }
  );
}

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Redirect to fallback URL or homepage
 */
function redirectToFallback(reply: FastifyReply, originalUrl?: string): FastifyReply {
  const fallbackUrl = process.env.APP_URL || 'https://dna-me.com';
  return reply.redirect(302, fallbackUrl);
}

/**
 * Generate HTML for unsubscribe pages
 */
function generateUnsubscribePage(
  status: 'confirm' | 'success' | 'error' | 'already_unsubscribed',
  message: string,
  enrollmentId?: string
): string {
  const companyName = process.env.COMPANY_NAME || 'DNA ME';
  const primaryColor = '#6C5CE7';
  
  let content: string;
  
  switch (status) {
    case 'confirm':
      content = `
        <p style="font-size: 16px; color: #333; margin-bottom: 24px;">${message}</p>
        <form method="POST" action="">
          <button type="submit" style="
            background-color: ${primaryColor};
            color: white;
            border: none;
            padding: 14px 32px;
            font-size: 16px;
            border-radius: 6px;
            cursor: pointer;
            transition: background-color 0.2s;
          " onmouseover="this.style.backgroundColor='#5b4bd5'" onmouseout="this.style.backgroundColor='${primaryColor}'">
            Abmelden
          </button>
        </form>
        <p style="margin-top: 20px; font-size: 14px; color: #666;">
          Wenn Sie sich nicht abmelden möchten, können Sie dieses Fenster einfach schließen.
        </p>
      `;
      break;
      
    case 'success':
      content = `
        <div style="
          background-color: #d4edda;
          border: 1px solid #c3e6cb;
          border-radius: 6px;
          padding: 20px;
          margin-bottom: 20px;
        ">
          <p style="color: #155724; margin: 0; font-size: 16px;">
            ✓ ${message}
          </p>
        </div>
        <p style="font-size: 14px; color: #666;">
          Sie werden keine weiteren E-Mails von dieser Sequenz erhalten.
        </p>
      `;
      break;
      
    case 'already_unsubscribed':
      content = `
        <div style="
          background-color: #cce5ff;
          border: 1px solid #b8daff;
          border-radius: 6px;
          padding: 20px;
        ">
          <p style="color: #004085; margin: 0; font-size: 16px;">
            ${message}
          </p>
        </div>
      `;
      break;
      
    case 'error':
    default:
      content = `
        <div style="
          background-color: #f8d7da;
          border: 1px solid #f5c6cb;
          border-radius: 6px;
          padding: 20px;
        ">
          <p style="color: #721c24; margin: 0; font-size: 16px;">
            ${message}
          </p>
        </div>
      `;
      break;
  }

  return `
<!DOCTYPE html>
<html lang="de">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>E-Mail Abmeldung - ${companyName}</title>
  <style>
    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      background-color: #f5f5f5;
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 20px;
    }
    .container {
      background-color: white;
      border-radius: 12px;
      box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
      padding: 40px;
      max-width: 480px;
      width: 100%;
      text-align: center;
    }
    .logo {
      font-size: 28px;
      font-weight: bold;
      color: ${primaryColor};
      margin-bottom: 24px;
    }
    h1 {
      font-size: 24px;
      color: #333;
      margin-bottom: 16px;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="logo">${companyName}</div>
    <h1>E-Mail Abmeldung</h1>
    ${content}
  </div>
</body>
</html>
  `.trim();
}

export default emailRoutes;
