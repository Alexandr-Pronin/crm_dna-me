// =============================================================================
// src/services/taskService.ts
// Task Management Service
// =============================================================================

import { db } from '../db/index.js';
import { NotFoundError, ValidationError } from '../errors/index.js';
import type {
  Task,
  TaskStatus,
  PaginatedResponse
} from '../types/index.js';

// =============================================================================
// Types
// =============================================================================

export interface CreateTaskInput {
  lead_id?: string;
  deal_id?: string;
  title: string;
  description?: string;
  task_type?: string;
  assigned_to?: string;
  due_date?: string;
  automation_rule_id?: string;
}

export interface UpdateTaskInput {
  title?: string;
  description?: string;
  task_type?: string;
  assigned_to?: string | null;
  due_date?: string | null;
  status?: TaskStatus;
}

export interface TaskFiltersInput {
  lead_id?: string;
  deal_id?: string;
  assigned_to?: string;
  status?: TaskStatus;
  task_type?: string;
  due_before?: string;
  due_after?: string;
  overdue?: boolean;
  page?: number;
  limit?: number;
  sort_by?: string;
  sort_order?: 'asc' | 'desc';
}

export interface TaskWithRelations extends Task {
  lead_email?: string;
  lead_name?: string;
  deal_name?: string;
}

// =============================================================================
// Task Service Class
// =============================================================================

export class TaskService {
  // ===========================================================================
  // Create Task
  // ===========================================================================
  
  async createTask(data: CreateTaskInput): Promise<Task> {
    // Validate at least one reference (lead or deal) is provided
    if (!data.lead_id && !data.deal_id) {
      throw new ValidationError('Either lead_id or deal_id is required');
    }
    
    // Verify lead exists if provided
    if (data.lead_id) {
      const lead = await db.queryOne<{ id: string }>(
        'SELECT id FROM leads WHERE id = $1',
        [data.lead_id]
      );
      if (!lead) {
        throw new NotFoundError('Lead', data.lead_id);
      }
    }
    
    // Verify deal exists if provided
    if (data.deal_id) {
      const deal = await db.queryOne<{ id: string }>(
        'SELECT id FROM deals WHERE id = $1',
        [data.deal_id]
      );
      if (!deal) {
        throw new NotFoundError('Deal', data.deal_id);
      }
    }
    
    const sql = `
      INSERT INTO tasks (
        lead_id, deal_id, title, description, task_type, 
        assigned_to, due_date, status, automation_rule_id,
        created_at, updated_at
      ) VALUES (
        $1, $2, $3, $4, $5, 
        $6, $7, 'open', $8,
        NOW(), NOW()
      )
      RETURNING *
    `;
    
    const params = [
      data.lead_id || null,
      data.deal_id || null,
      data.title,
      data.description || null,
      data.task_type || 'follow_up',
      data.assigned_to || null,
      data.due_date || null,
      data.automation_rule_id || null
    ];
    
    const tasks = await db.query<Task>(sql, params);
    return tasks[0];
  }

  // ===========================================================================
  // Get Task by ID
  // ===========================================================================
  
  async getTaskById(id: string): Promise<Task> {
    const task = await db.queryOne<Task>(
      'SELECT * FROM tasks WHERE id = $1',
      [id]
    );
    
    if (!task) {
      throw new NotFoundError('Task', id);
    }
    
    return task;
  }

  // ===========================================================================
  // Get Task with Relations
  // ===========================================================================
  
  async getTaskWithRelations(id: string): Promise<TaskWithRelations> {
    const task = await db.queryOne<TaskWithRelations>(`
      SELECT 
        t.*,
        l.email as lead_email,
        CONCAT(l.first_name, ' ', l.last_name) as lead_name,
        d.name as deal_name
      FROM tasks t
      LEFT JOIN leads l ON l.id = t.lead_id
      LEFT JOIN deals d ON d.id = t.deal_id
      WHERE t.id = $1
    `, [id]);
    
    if (!task) {
      throw new NotFoundError('Task', id);
    }
    
    return task;
  }

  // ===========================================================================
  // Get Tasks by Assignee
  // ===========================================================================
  
  async getTasksByAssignee(
    assignedTo: string, 
    options?: { status?: TaskStatus; limit?: number }
  ): Promise<Task[]> {
    let sql = `
      SELECT t.*, l.email as lead_email, d.name as deal_name
      FROM tasks t
      LEFT JOIN leads l ON l.id = t.lead_id
      LEFT JOIN deals d ON d.id = t.deal_id
      WHERE t.assigned_to = $1
    `;
    const params: unknown[] = [assignedTo];
    let paramIndex = 2;
    
    if (options?.status) {
      sql += ` AND t.status = $${paramIndex++}`;
      params.push(options.status);
    }
    
    sql += ' ORDER BY t.due_date ASC NULLS LAST, t.created_at DESC';
    
    if (options?.limit) {
      sql += ` LIMIT $${paramIndex}`;
      params.push(options.limit);
    }
    
    return await db.query<Task>(sql, params);
  }

  // ===========================================================================
  // Get Tasks by Lead
  // ===========================================================================
  
  async getTasksByLead(leadId: string): Promise<Task[]> {
    return await db.query<Task>(`
      SELECT t.*, d.name as deal_name
      FROM tasks t
      LEFT JOIN deals d ON d.id = t.deal_id
      WHERE t.lead_id = $1
      ORDER BY t.due_date ASC NULLS LAST, t.created_at DESC
    `, [leadId]);
  }

  // ===========================================================================
  // Get Tasks by Deal
  // ===========================================================================
  
  async getTasksByDeal(dealId: string): Promise<Task[]> {
    return await db.query<Task>(`
      SELECT t.*, l.email as lead_email
      FROM tasks t
      LEFT JOIN leads l ON l.id = t.lead_id
      WHERE t.deal_id = $1
      ORDER BY t.due_date ASC NULLS LAST, t.created_at DESC
    `, [dealId]);
  }

  // ===========================================================================
  // Search Tasks
  // ===========================================================================
  
  async searchTasks(filters: TaskFiltersInput): Promise<PaginatedResponse<TaskWithRelations>> {
    const conditions: string[] = [];
    const params: unknown[] = [];
    let paramIndex = 1;
    
    if (filters.lead_id) {
      conditions.push(`t.lead_id = $${paramIndex++}`);
      params.push(filters.lead_id);
    }
    
    if (filters.deal_id) {
      conditions.push(`t.deal_id = $${paramIndex++}`);
      params.push(filters.deal_id);
    }
    
    if (filters.assigned_to) {
      conditions.push(`t.assigned_to = $${paramIndex++}`);
      params.push(filters.assigned_to);
    }
    
    if (filters.status) {
      conditions.push(`t.status = $${paramIndex++}`);
      params.push(filters.status);
    }
    
    if (filters.task_type) {
      conditions.push(`t.task_type = $${paramIndex++}`);
      params.push(filters.task_type);
    }
    
    if (filters.due_before) {
      conditions.push(`t.due_date <= $${paramIndex++}`);
      params.push(filters.due_before);
    }
    
    if (filters.due_after) {
      conditions.push(`t.due_date >= $${paramIndex++}`);
      params.push(filters.due_after);
    }
    
    if (filters.overdue === true) {
      conditions.push(`t.due_date < NOW() AND t.status NOT IN ('completed', 'cancelled')`);
    }
    
    const whereClause = conditions.length > 0 
      ? `WHERE ${conditions.join(' AND ')}`
      : '';
    
    // Count total
    const countSql = `SELECT COUNT(*) as count FROM tasks t ${whereClause}`;
    const countResult = await db.queryOne<{ count: string }>(countSql, params);
    const total = parseInt(countResult?.count || '0', 10);
    
    // Calculate pagination
    const page = filters.page || 1;
    const limit = filters.limit || 20;
    const offset = (page - 1) * limit;
    const totalPages = Math.ceil(total / limit);
    
    // Build order clause
    const validSortColumns = ['created_at', 'updated_at', 'due_date', 'title', 'status'];
    const sortBy = validSortColumns.includes(filters.sort_by || '') ? filters.sort_by : 'due_date';
    const sortOrder = (filters.sort_order || 'asc').toUpperCase();
    const orderClause = `ORDER BY t.${sortBy} ${sortOrder} NULLS LAST`;
    
    // Get data with relations
    const dataSql = `
      SELECT 
        t.*,
        l.email as lead_email,
        CONCAT(l.first_name, ' ', l.last_name) as lead_name,
        d.name as deal_name
      FROM tasks t
      LEFT JOIN leads l ON l.id = t.lead_id
      LEFT JOIN deals d ON d.id = t.deal_id
      ${whereClause}
      ${orderClause}
      LIMIT $${paramIndex++} OFFSET $${paramIndex}
    `;
    
    const dataParams = [...params, limit, offset];
    const data = await db.query<TaskWithRelations>(dataSql, dataParams);
    
    return {
      data,
      pagination: {
        page,
        limit,
        total,
        total_pages: totalPages,
        has_next: page < totalPages,
        has_prev: page > 1
      }
    };
  }

  // ===========================================================================
  // Update Task
  // ===========================================================================
  
  async updateTask(id: string, data: UpdateTaskInput): Promise<Task> {
    // Check if task exists
    await this.getTaskById(id);
    
    // Build dynamic update query
    const updates: string[] = [];
    const params: unknown[] = [];
    let paramIndex = 1;
    
    if (data.title !== undefined) {
      updates.push(`title = $${paramIndex++}`);
      params.push(data.title);
    }
    
    if (data.description !== undefined) {
      updates.push(`description = $${paramIndex++}`);
      params.push(data.description);
    }
    
    if (data.task_type !== undefined) {
      updates.push(`task_type = $${paramIndex++}`);
      params.push(data.task_type);
    }
    
    if (data.assigned_to !== undefined) {
      updates.push(`assigned_to = $${paramIndex++}`);
      params.push(data.assigned_to);
    }
    
    if (data.due_date !== undefined) {
      updates.push(`due_date = $${paramIndex++}`);
      params.push(data.due_date);
    }
    
    if (data.status !== undefined) {
      updates.push(`status = $${paramIndex++}`);
      params.push(data.status);
      
      // Set completed_at if status is completed
      if (data.status === 'completed') {
        updates.push('completed_at = NOW()');
      } else if (data.status === 'open' || data.status === 'in_progress') {
        updates.push('completed_at = NULL');
      }
    }
    
    if (updates.length === 0) {
      return this.getTaskById(id);
    }
    
    params.push(id);
    
    const sql = `
      UPDATE tasks 
      SET ${updates.join(', ')}, updated_at = NOW()
      WHERE id = $${paramIndex}
      RETURNING *
    `;
    
    const tasks = await db.query<Task>(sql, params);
    return tasks[0];
  }

  // ===========================================================================
  // Complete Task
  // ===========================================================================
  
  async completeTask(id: string): Promise<Task> {
    const task = await this.getTaskById(id);
    
    if (task.status === 'completed') {
      throw new ValidationError('Task is already completed');
    }
    
    if (task.status === 'cancelled') {
      throw new ValidationError('Cannot complete a cancelled task');
    }
    
    const updatedTask = await db.queryOne<Task>(`
      UPDATE tasks 
      SET status = 'completed', completed_at = NOW(), updated_at = NOW()
      WHERE id = $1
      RETURNING *
    `, [id]);
    
    return updatedTask!;
  }

  // ===========================================================================
  // Cancel Task
  // ===========================================================================
  
  async cancelTask(id: string): Promise<Task> {
    const task = await this.getTaskById(id);
    
    if (task.status === 'completed') {
      throw new ValidationError('Cannot cancel a completed task');
    }
    
    const updatedTask = await db.queryOne<Task>(`
      UPDATE tasks 
      SET status = 'cancelled', updated_at = NOW()
      WHERE id = $1
      RETURNING *
    `, [id]);
    
    return updatedTask!;
  }

  // ===========================================================================
  // Reopen Task
  // ===========================================================================
  
  async reopenTask(id: string): Promise<Task> {
    const task = await this.getTaskById(id);
    
    if (task.status === 'open' || task.status === 'in_progress') {
      throw new ValidationError('Task is already open');
    }
    
    const updatedTask = await db.queryOne<Task>(`
      UPDATE tasks 
      SET status = 'open', completed_at = NULL, updated_at = NOW()
      WHERE id = $1
      RETURNING *
    `, [id]);
    
    return updatedTask!;
  }

  // ===========================================================================
  // Delete Task
  // ===========================================================================
  
  async deleteTask(id: string): Promise<void> {
    await this.getTaskById(id);
    await db.execute('DELETE FROM tasks WHERE id = $1', [id]);
  }

  // ===========================================================================
  // Get Overdue Tasks Count
  // ===========================================================================
  
  async getOverdueTasksCount(assignedTo?: string): Promise<number> {
    let sql = `
      SELECT COUNT(*) as count 
      FROM tasks 
      WHERE due_date < NOW() 
      AND status NOT IN ('completed', 'cancelled')
    `;
    const params: unknown[] = [];
    
    if (assignedTo) {
      sql += ' AND assigned_to = $1';
      params.push(assignedTo);
    }
    
    const result = await db.queryOne<{ count: string }>(sql, params);
    return parseInt(result?.count || '0', 10);
  }

  // ===========================================================================
  // Get Task Statistics
  // ===========================================================================
  
  async getTaskStatistics(assignedTo?: string): Promise<{
    total: number;
    open: number;
    in_progress: number;
    completed: number;
    cancelled: number;
    overdue: number;
  }> {
    let baseCondition = '';
    const params: unknown[] = [];
    
    if (assignedTo) {
      baseCondition = ' WHERE assigned_to = $1';
      params.push(assignedTo);
    }
    
    const stats = await db.queryOne<{
      total: string;
      open: string;
      in_progress: string;
      completed: string;
      cancelled: string;
    }>(`
      SELECT 
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE status = 'open') as open,
        COUNT(*) FILTER (WHERE status = 'in_progress') as in_progress,
        COUNT(*) FILTER (WHERE status = 'completed') as completed,
        COUNT(*) FILTER (WHERE status = 'cancelled') as cancelled
      FROM tasks
      ${baseCondition}
    `, params);
    
    const overdueCount = await this.getOverdueTasksCount(assignedTo);
    
    return {
      total: parseInt(stats?.total || '0', 10),
      open: parseInt(stats?.open || '0', 10),
      in_progress: parseInt(stats?.in_progress || '0', 10),
      completed: parseInt(stats?.completed || '0', 10),
      cancelled: parseInt(stats?.cancelled || '0', 10),
      overdue: overdueCount
    };
  }

  // ===========================================================================
  // Get Due Soon Tasks
  // ===========================================================================
  
  async getDueSoonTasks(
    daysAhead: number = 3, 
    assignedTo?: string
  ): Promise<Task[]> {
    let sql = `
      SELECT t.*, l.email as lead_email, d.name as deal_name
      FROM tasks t
      LEFT JOIN leads l ON l.id = t.lead_id
      LEFT JOIN deals d ON d.id = t.deal_id
      WHERE t.due_date IS NOT NULL
      AND t.due_date <= NOW() + INTERVAL '${daysAhead} days'
      AND t.status NOT IN ('completed', 'cancelled')
    `;
    const params: unknown[] = [];
    
    if (assignedTo) {
      sql += ' AND t.assigned_to = $1';
      params.push(assignedTo);
    }
    
    sql += ' ORDER BY t.due_date ASC';
    
    return await db.query<Task>(sql, params);
  }
}

// =============================================================================
// Singleton Export
// =============================================================================

let taskServiceInstance: TaskService | null = null;

export function getTaskService(): TaskService {
  if (!taskServiceInstance) {
    taskServiceInstance = new TaskService();
  }
  return taskServiceInstance;
}

export const taskService = {
  get instance() {
    return getTaskService();
  }
};

export default taskService;
