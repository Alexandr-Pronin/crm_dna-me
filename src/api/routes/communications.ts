// =============================================================================
// src/api/routes/communications.ts
// Communication CRUD API Routes
// =============================================================================

import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { getCommunicationService } from '../../services/communicationService.js';
import { ValidationError } from '../../errors/index.js';

const createCommSchema = z.object({
  lead_id: z.string().uuid(),
  deal_id: z.string().uuid().optional(),
  comm_type: z.enum(['notiz', 'cituro', 'einladung', 'email']),
  subject: z.string().max(500).optional(),
  body: z.string().min(1).max(10000),
  direction: z.enum(['inbound', 'outbound', 'internal']).default('outbound'),
  created_by: z.string().max(255).optional(),
  metadata: z.record(z.unknown()).optional()
});

export async function communicationsRoutes(fastify: FastifyInstance): Promise<void> {
  const commService = getCommunicationService();

  // GET /leads/:leadId/communications
  fastify.get<{
    Params: { leadId: string };
    Querystring: { comm_type?: string; limit?: string; offset?: string }
  }>('/leads/:leadId/communications', async (request, reply) => {
    const { leadId } = request.params;
    if (!z.string().uuid().safeParse(leadId).success) {
      throw new ValidationError('Invalid lead ID format');
    }
    const { comm_type, limit, offset } = request.query;
    const comms = await commService.getCommunicationsByLead(leadId, {
      comm_type: comm_type as any,
      limit: limit ? parseInt(limit, 10) : undefined,
      offset: offset ? parseInt(offset, 10) : undefined
    });
    return reply.status(200).send({ data: comms, meta: { lead_id: leadId, count: comms.length } });
  });

  // POST /communications
  fastify.post<{
    Body: z.infer<typeof createCommSchema>
  }>('/communications', async (request, reply) => {
    const data = createCommSchema.parse(request.body);
    const comm = await commService.createCommunication(data);
    return reply.status(201).send({ data: comm, message: 'Communication created successfully' });
  });

  // GET /communications/:id
  fastify.get<{
    Params: { id: string }
  }>('/communications/:id', async (request, reply) => {
    const { id } = request.params;
    if (!z.string().uuid().safeParse(id).success) {
      throw new ValidationError('Invalid communication ID format');
    }
    const comm = await commService.getCommunicationById(id);
    return reply.status(200).send({ data: comm });
  });

  // DELETE /communications/:id
  fastify.delete<{
    Params: { id: string }
  }>('/communications/:id', async (request, reply) => {
    const { id } = request.params;
    if (!z.string().uuid().safeParse(id).success) {
      throw new ValidationError('Invalid communication ID format');
    }
    await commService.deleteCommunication(id);
    return reply.status(200).send({ message: 'Communication deleted successfully' });
  });

  // GET /leads/:leadId/timeline (communications + tasks merged)
  fastify.get<{
    Params: { leadId: string }
  }>('/leads/:leadId/timeline', async (request, reply) => {
    const { leadId } = request.params;
    if (!z.string().uuid().safeParse(leadId).success) {
      throw new ValidationError('Invalid lead ID format');
    }
    const timeline = await commService.getLeadTimeline(leadId);
    return reply.status(200).send({ data: timeline, meta: { lead_id: leadId, count: timeline.length } });
  });
}

export default communicationsRoutes;
