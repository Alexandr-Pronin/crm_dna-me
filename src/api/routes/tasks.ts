// =============================================================================
// src/api/routes/tasks.ts
// Task Management API Routes
// =============================================================================

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { getTaskService } from '../../services/taskService.js';
import { ValidationError } from '../../errors/index.js';
import type { TaskStatus } from '../../types/index.js';

// =============================================================================
// Validation Schemas
// =============================================================================

const createTaskSchema = z.object({
  lead_id: z.string().uuid().optional(),
  deal_id: z.string().uuid().optional(),
  title: z.string().min(1).max(500),
  description: z.string().max(2000).optional(),
  task_type: z.string().max(50).optional(),
  assigned_to: z.string().email().optional(),
  due_date: z.string().datetime().optional()
}).refine(data => data.lead_id || data.deal_id, {
  message: 'Either lead_id or deal_id is required'
});

const updateTaskSchema = z.object({
  title: z.string().min(1).max(500).optional(),
  description: z.string().max(2000).nullable().optional(),
  task_type: z.string().max(50).optional(),
  assigned_to: z.string().email().nullable().optional(),
  due_date: z.string().datetime().nullable().optional(),
  status: z.enum(['open', 'in_progress', 'completed', 'cancelled']).optional()
});

const taskFiltersSchema = z.object({
  lead_id: z.string().uuid().optional(),
  deal_id: z.string().uuid().optional(),
  assigned_to: z.string().email().optional(),
  status: z.enum(['open', 'in_progress', 'completed', 'cancelled']).optional(),
  task_type: z.string().optional(),
  due_before: z.string().datetime().optional(),
  due_after: z.string().datetime().optional(),
  overdue: z.enum(['true', 'false']).transform(v => v === 'true').optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  sort_by: z.enum(['created_at', 'updated_at', 'due_date', 'title', 'status']).default('due_date'),
  sort_order: z.enum(['asc', 'desc']).default('asc')
});

// =============================================================================
// Routes
// =============================================================================

export async function tasksRoutes(fastify: FastifyInstance): Promise<void> {
  const taskService = getTaskService();

  // ===========================================================================
  // GET /tasks - Search/list tasks
  // ===========================================================================
  
  fastify.get<{
    Querystring: z.infer<typeof taskFiltersSchema>
  }>('/tasks', async (request, reply) => {
    const filters = taskFiltersSchema.parse(request.query);
    const result = await taskService.searchTasks(filters);
    
    return reply.status(200).send(result);
  });

  // ===========================================================================
  // GET /tasks/statistics - Get task statistics
  // ===========================================================================
  
  fastify.get<{
    Querystring: { assigned_to?: string }
  }>('/tasks/statistics', async (request, reply) => {
    const { assigned_to } = request.query;
    const stats = await taskService.getTaskStatistics(assigned_to);
    
    return reply.status(200).send({ data: stats });
  });

  // ===========================================================================
  // GET /tasks/due-soon - Get tasks due soon
  // ===========================================================================
  
  fastify.get<{
    Querystring: { days?: string; assigned_to?: string }
  }>('/tasks/due-soon', async (request, reply) => {
    const { days, assigned_to } = request.query;
    const daysAhead = days ? parseInt(days, 10) : 3;
    const tasks = await taskService.getDueSoonTasks(daysAhead, assigned_to);
    
    return reply.status(200).send({ 
      data: tasks,
      meta: {
        days_ahead: daysAhead,
        count: tasks.length
      }
    });
  });

  // ===========================================================================
  // GET /tasks/overdue - Get overdue tasks
  // ===========================================================================
  
  fastify.get<{
    Querystring: { assigned_to?: string }
  }>('/tasks/overdue', async (request, reply) => {
    const { assigned_to } = request.query;
    
    // Get overdue tasks by setting due_before to now
    const result = await taskService.searchTasks({
      assigned_to,
      overdue: true,
      sort_by: 'due_date',
      sort_order: 'asc'
    });
    
    return reply.status(200).send(result);
  });

  // ===========================================================================
  // GET /tasks/:id - Get task by ID
  // ===========================================================================
  
  fastify.get<{
    Params: { id: string }
  }>('/tasks/:id', async (request, reply) => {
    const { id } = request.params;
    
    if (!z.string().uuid().safeParse(id).success) {
      throw new ValidationError('Invalid task ID format');
    }
    
    const task = await taskService.getTaskWithRelations(id);
    return reply.status(200).send({ data: task });
  });

  // ===========================================================================
  // POST /tasks - Create task
  // ===========================================================================
  
  fastify.post<{
    Body: z.infer<typeof createTaskSchema>
  }>('/tasks', async (request, reply) => {
    const validatedData = createTaskSchema.parse(request.body);
    const task = await taskService.createTask(validatedData);
    
    return reply.status(201).send({ 
      data: task,
      message: 'Task created successfully'
    });
  });

  // ===========================================================================
  // PATCH /tasks/:id - Update task
  // ===========================================================================
  
  fastify.patch<{
    Params: { id: string };
    Body: z.infer<typeof updateTaskSchema>
  }>('/tasks/:id', async (request, reply) => {
    const { id } = request.params;
    
    if (!z.string().uuid().safeParse(id).success) {
      throw new ValidationError('Invalid task ID format');
    }
    
    const validatedData = updateTaskSchema.parse(request.body);
    const task = await taskService.updateTask(id, validatedData);
    
    return reply.status(200).send({ 
      data: task,
      message: 'Task updated successfully'
    });
  });

  // ===========================================================================
  // POST /tasks/:id/complete - Complete task
  // ===========================================================================
  
  fastify.post<{
    Params: { id: string }
  }>('/tasks/:id/complete', async (request, reply) => {
    const { id } = request.params;
    
    if (!z.string().uuid().safeParse(id).success) {
      throw new ValidationError('Invalid task ID format');
    }
    
    const task = await taskService.completeTask(id);
    
    return reply.status(200).send({ 
      data: task,
      message: 'Task completed successfully'
    });
  });

  // ===========================================================================
  // POST /tasks/:id/cancel - Cancel task
  // ===========================================================================
  
  fastify.post<{
    Params: { id: string }
  }>('/tasks/:id/cancel', async (request, reply) => {
    const { id } = request.params;
    
    if (!z.string().uuid().safeParse(id).success) {
      throw new ValidationError('Invalid task ID format');
    }
    
    const task = await taskService.cancelTask(id);
    
    return reply.status(200).send({ 
      data: task,
      message: 'Task cancelled successfully'
    });
  });

  // ===========================================================================
  // POST /tasks/:id/reopen - Reopen task
  // ===========================================================================
  
  fastify.post<{
    Params: { id: string }
  }>('/tasks/:id/reopen', async (request, reply) => {
    const { id } = request.params;
    
    if (!z.string().uuid().safeParse(id).success) {
      throw new ValidationError('Invalid task ID format');
    }
    
    const task = await taskService.reopenTask(id);
    
    return reply.status(200).send({ 
      data: task,
      message: 'Task reopened successfully'
    });
  });

  // ===========================================================================
  // DELETE /tasks/:id - Delete task
  // ===========================================================================
  
  fastify.delete<{
    Params: { id: string }
  }>('/tasks/:id', async (request, reply) => {
    const { id } = request.params;
    
    if (!z.string().uuid().safeParse(id).success) {
      throw new ValidationError('Invalid task ID format');
    }
    
    await taskService.deleteTask(id);
    
    return reply.status(200).send({ 
      message: 'Task deleted successfully'
    });
  });

  // ===========================================================================
  // GET /leads/:leadId/tasks - Get tasks for a lead
  // ===========================================================================
  
  fastify.get<{
    Params: { leadId: string }
  }>('/leads/:leadId/tasks', async (request, reply) => {
    const { leadId } = request.params;
    
    if (!z.string().uuid().safeParse(leadId).success) {
      throw new ValidationError('Invalid lead ID format');
    }
    
    const tasks = await taskService.getTasksByLead(leadId);
    
    return reply.status(200).send({ 
      data: tasks,
      meta: {
        lead_id: leadId,
        count: tasks.length
      }
    });
  });

  // ===========================================================================
  // GET /deals/:dealId/tasks - Get tasks for a deal
  // ===========================================================================
  
  fastify.get<{
    Params: { dealId: string }
  }>('/deals/:dealId/tasks', async (request, reply) => {
    const { dealId } = request.params;
    
    if (!z.string().uuid().safeParse(dealId).success) {
      throw new ValidationError('Invalid deal ID format');
    }
    
    const tasks = await taskService.getTasksByDeal(dealId);
    
    return reply.status(200).send({ 
      data: tasks,
      meta: {
        deal_id: dealId,
        count: tasks.length
      }
    });
  });
}

export default tasksRoutes;
