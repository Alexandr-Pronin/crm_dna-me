/**
 * DNA ME CRM Data Provider
 * 
 * CRITICAL: Dev Mode - No Authentication
 * API Key is hardcoded as per FRONTEND_PLAN.md requirements
 */
import queryString from 'query-string';
const { stringify } = queryString;

// API Configuration - HARDCODED FOR DEV MODE
const API_URL = 'http://localhost:3000/api/v1';
const API_KEY = 'test123';

/**
 * Custom HTTP Client with hardcoded API Key header
 */
const httpClient = async (url, options = {}) => {
  // Correlation ID for distributed tracing
  const correlationId = `admin_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  
  const headers = new Headers({
    Accept: 'application/json',
    'Content-Type': 'application/json',
    // CRITICAL: Hardcoded API Key for Dev Mode
    'X-API-Key': API_KEY,
    // Correlation ID for request tracing
    'X-Correlation-ID': correlationId,
  });

  const response = await fetch(url, { 
    ...options, 
    headers,
  });

  if (!response.ok) {
    const errorBody = await response.json().catch(() => ({}));
    const error = new Error(errorBody.error?.message || response.statusText);
    error.status = response.status;
    error.body = errorBody;
    throw error;
  }

  const json = await response.json();
  
  return {
    json,
    headers: response.headers,
    status: response.status,
  };
};

/**
 * Flatten nested filter objects for query string
 */
const flattenObject = (obj, prefix = '') => {
  return Object.keys(obj).reduce((acc, key) => {
    const value = obj[key];
    const newKey = prefix ? `${prefix}.${key}` : key;
    
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      Object.assign(acc, flattenObject(value, newKey));
    } else if (value !== undefined && value !== null && value !== '') {
      acc[newKey] = value;
    }
    
    return acc;
  }, {});
};

/**
 * React Admin Data Provider
 */
const dataProvider = {
  getList: async (resource, params) => {
    const { page, perPage } = params.pagination || { page: 1, perPage: 25 };
    const { field, order } = params.sort || { field: 'id', order: 'DESC' };
    
    // Map React-Admin params to backend format
    const query = {
      // Backend uses different param names
      sort_by: field === 'id' ? 'created_at' : field,
      sort_order: order.toLowerCase(),
      page: page,
      limit: perPage,
      // Also support legacy format for compatibility
      _sort: field,
      _order: order,
      _page: page,
      _limit: perPage,
      ...flattenObject(params.filter || {}),
    };
    
    const url = `${API_URL}/${resource}?${stringify(query)}`;
    const { json, headers } = await httpClient(url);
    
    // Handle different response formats
    const data = json.data || json;
    const total = parseInt(
      headers.get('X-Total-Count') || 
      json.pagination?.total ||
      json.meta?.total || 
      json.total || 
      (Array.isArray(data) ? data.length : 0), 
      10
    );
    
    return {
      data: Array.isArray(data) ? data : [],
      total,
    };
  },
  
  getOne: async (resource, params) => {
    const { json } = await httpClient(`${API_URL}/${resource}/${params.id}`);
    return { data: json.data || json };
  },
  
  getMany: async (resource, params) => {
    const query = { id: params.ids };
    const url = `${API_URL}/${resource}?${stringify(query, { arrayFormat: 'comma' })}`;
    const { json } = await httpClient(url);
    return { data: json.data || json };
  },

  getManyReference: async (resource, params) => {
    const { page, perPage } = params.pagination || { page: 1, perPage: 25 };
    const { field, order } = params.sort || { field: 'id', order: 'DESC' };
    
    const query = {
      // Backend uses different param names
      sort_by: field === 'id' ? 'created_at' : field,
      sort_order: order.toLowerCase(),
      page: page,
      limit: perPage,
      // Also support legacy format for compatibility
      _sort: field,
      _order: order,
      _page: page,
      _limit: perPage,
      [params.target]: params.id,
      ...flattenObject(params.filter || {}),
    };
    
    const url = `${API_URL}/${resource}?${stringify(query)}`;
    const { json, headers } = await httpClient(url);
    
    const data = json.data || json;
    const total = parseInt(
      headers.get('X-Total-Count') || 
      json.pagination?.total ||
      json.meta?.total || 
      json.total || 
      (Array.isArray(data) ? data.length : 0), 
      10
    );
    
    return {
      data: Array.isArray(data) ? data : [],
      total,
    };
  },
  
  create: async (resource, params) => {
    const { json } = await httpClient(`${API_URL}/${resource}`, {
      method: 'POST',
      body: JSON.stringify(params.data),
    });
    return { data: json.data || json };
  },
  
  update: async (resource, params) => {
    const { json } = await httpClient(`${API_URL}/${resource}/${params.id}`, {
      method: 'PUT',
      body: JSON.stringify(params.data),
    });
    return { data: json.data || json };
  },
  
  updateMany: async (resource, params) => {
    const responses = await Promise.all(
      params.ids.map(id =>
        httpClient(`${API_URL}/${resource}/${id}`, {
          method: 'PUT',
          body: JSON.stringify(params.data),
        })
      )
    );
    return { data: responses.map(({ json }) => (json.data || json).id) };
  },
  
  delete: async (resource, params) => {
    await httpClient(`${API_URL}/${resource}/${params.id}`, {
      method: 'DELETE',
    });
    return { data: { id: params.id } };
  },
  
  deleteMany: async (resource, params) => {
    await Promise.all(
      params.ids.map(id =>
        httpClient(`${API_URL}/${resource}/${id}`, {
          method: 'DELETE',
        })
      )
    );
    return { data: params.ids };
  },
};

// ==========================================
// Custom API Methods (beyond standard CRUD)
// ==========================================

/**
 * Move deal to a new stage
 * @param {string} dealId - Deal UUID
 * @param {string} newStageId - New stage UUID
 * @returns {Promise<Object>} Updated deal
 */
export const moveDealStage = async (dealId, newStageId) => {
  const { json } = await httpClient(`${API_URL}/deals/${dealId}/move`, {
    method: 'POST',
    body: JSON.stringify({ stage_id: newStageId }),
  });
  return json;
};

/**
 * Move deal to a new stage (alias for moveDealStage)
 * @param {string} dealId - Deal UUID
 * @param {string} newStageId - New stage UUID
 * @returns {Promise<Object>} Updated deal
 */
export const moveDealToStage = async (dealId, newStageId) => {
  return moveDealStage(dealId, newStageId);
};

/**
 * Reorder deals within a stage
 * @param {string} stageId - Stage UUID
 * @param {string[]} orderedIds - Ordered deal UUIDs
 * @returns {Promise<Object>} Result
 */
export const reorderDealsInStage = async (stageId, orderedIds) => {
  const { json } = await httpClient(`${API_URL}/deals/reorder`, {
    method: 'POST',
    body: JSON.stringify({ stage_id: stageId, ordered_ids: orderedIds }),
  });
  return json;
};

/**
 * Update the lead associated with a deal
 * @param {string} dealId - Deal UUID
 * @param {string} leadId - New Lead UUID
 * @returns {Promise<Object>} Updated deal
 */
export const updateDealLead = async (dealId, leadId) => {
  const { json } = await httpClient(`${API_URL}/deals/${dealId}/lead`, {
    method: 'PATCH',
    body: JSON.stringify({ lead_id: leadId }),
  });
  return json;
};

/**
 * Search leads for autocomplete
 * @param {Object} params - Search parameters
 * @param {string} params.search - Search term
 * @param {number} params.limit - Max results (default: 20)
 * @returns {Promise<Array>} List of leads
 */
export const searchLeads = async (params = {}) => {
  const query = stringify({
    search: params.search || '',
    limit: params.limit || 20,
    page: 1,
  });
  const { json } = await httpClient(`${API_URL}/leads?${query}`);
  return json.data || json;
};

/**
 * Get lead timeline/activity
 */
export const getLeadTimeline = async (leadId) => {
  const { json } = await httpClient(`${API_URL}/leads/${leadId}/timeline`);
  return json.data || json;
};

/**
 * Assign lead to user
 */
export const assignLead = async (leadId, userId) => {
  const { json } = await httpClient(`${API_URL}/leads/${leadId}/assign`, {
    method: 'POST',
    body: JSON.stringify({ user_id: userId }),
  });
  return json;
};

/**
 * Bulk assign leads
 */
export const bulkAssignLeads = async (leadIds, userId) => {
  const { json } = await httpClient(`${API_URL}/leads/bulk-assign`, {
    method: 'POST',
    body: JSON.stringify({ lead_ids: leadIds, user_id: userId }),
  });
  return json;
};

/**
 * Test webhook endpoint
 */
export const testWebhook = async (webhookId) => {
  const { json } = await httpClient(`${API_URL}/webhooks/${webhookId}/test`, {
    method: 'POST',
  });
  return json;
};

/**
 * Retry failed webhook
 */
export const retryWebhook = async (logId) => {
  const { json } = await httpClient(`${API_URL}/webhook-logs/${logId}/retry`, {
    method: 'POST',
  });
  return json;
};

/**
 * Get analytics data
 */
export const getAnalytics = async (params = {}) => {
  const query = stringify(params);
  const { json } = await httpClient(`${API_URL}/analytics?${query}`);
  return json.data || json;
};

/**
 * Get funnel analytics
 */
export const getFunnelAnalytics = async (pipelineId) => {
  const { json } = await httpClient(`${API_URL}/analytics/funnel?pipeline_id=${pipelineId}`);
  return json.data || json;
};

// ==========================================
// Lead Events API
// ==========================================

/**
 * Get events for a lead
 * @param {string} leadId - Lead UUID
 * @param {Object} params - Query parameters
 * @param {number} params.limit - Max results (default: 50, max: 100)
 * @param {number} params.offset - Pagination offset (default: 0)
 * @returns {Promise<Array>} List of marketing events
 */
export const getLeadEvents = async (leadId, params = {}) => {
  const query = stringify({
    limit: params.limit || 50,
    offset: params.offset || 0,
  });
  const { json } = await httpClient(`${API_URL}/leads/${leadId}/events?${query}`);
  return json.data || json;
};

/**
 * Ingest a manual event for a lead
 * POST /events/ingest
 */
export const ingestLeadEvent = async (eventData) => {
  const { json } = await httpClient(`${API_URL}/events/ingest`, {
    method: 'POST',
    body: JSON.stringify(eventData),
  });
  return json;
};

// ==========================================
// Scoring API - Lead Score Methods
// ==========================================

/**
 * Get score history for a lead
 * @param {string} leadId - Lead UUID
 * @param {Object} params - Query parameters
 * @param {number} params.limit - Max results (default: 50)
 * @returns {Promise<Array>} Score history entries
 */
export const getScoreHistory = async (leadId, params = {}) => {
  const query = stringify({
    limit: params.limit || 50,
  });
  const { json } = await httpClient(`${API_URL}/scoring/leads/${leadId}/history?${query}`);
  return json.data || json;
};

/**
 * Get score breakdown for a lead (by category)
 * @param {string} leadId - Lead UUID
 * @returns {Promise<Object>} Score breakdown with totals per category
 */
export const getScoreBreakdown = async (leadId) => {
  const { json } = await httpClient(`${API_URL}/scoring/leads/${leadId}/breakdown`);
  return json;
};

/**
 * Recalculate all scores for a lead
 * @param {string} leadId - Lead UUID
 * @returns {Promise<Object>} Old and new scores with change indicator
 */
export const recalculateLeadScores = async (leadId) => {
  const { json } = await httpClient(`${API_URL}/scoring/leads/${leadId}/recalculate`, {
    method: 'POST',
  });
  return json;
};

// Legacy alias for backwards compatibility
export const recalculateLeadScore = recalculateLeadScores;

// ==========================================
// Scoring API - Rules CRUD
// ==========================================

/**
 * Get all scoring rules with pagination and filtering
 * @param {Object} params - Query parameters
 * @param {number} params.page - Page number (default: 1)
 * @param {number} params.limit - Results per page (default: 20, max: 100)
 * @param {string} params.category - Filter by category (demographic|engagement|behavior)
 * @param {boolean} params.is_active - Filter by active status
 * @returns {Promise<Object>} Rules array with pagination info
 */
export const getScoringRules = async (params = {}) => {
  const query = stringify({
    page: params.page || 1,
    limit: params.limit || 20,
    ...(params.category && { category: params.category }),
    ...(params.is_active !== undefined && { is_active: params.is_active }),
  });
  const { json } = await httpClient(`${API_URL}/scoring/rules?${query}`);
  return json;
};

/**
 * Get a single scoring rule by ID with usage statistics
 * @param {string} ruleId - Rule UUID
 * @returns {Promise<Object>} Rule with stats
 */
export const getScoringRule = async (ruleId) => {
  const { json } = await httpClient(`${API_URL}/scoring/rules/${ruleId}`);
  return json;
};

/**
 * Create a new scoring rule
 * @param {Object} ruleData - Rule data
 * @param {string} ruleData.slug - Unique slug (lowercase alphanumeric with hyphens)
 * @param {string} ruleData.name - Display name
 * @param {string} ruleData.description - Optional description
 * @param {string} ruleData.rule_type - Type: event|field|threshold
 * @param {string} ruleData.category - Category: demographic|engagement|behavior
 * @param {Object} ruleData.conditions - Rule conditions
 * @param {number} ruleData.points - Points to award
 * @param {number} ruleData.max_per_day - Optional daily limit
 * @param {number} ruleData.max_per_lead - Optional per-lead limit
 * @param {number} ruleData.decay_days - Optional decay period
 * @param {number} ruleData.priority - Sort priority (default: 100)
 * @param {boolean} ruleData.is_active - Active status (default: true)
 * @returns {Promise<Object>} Created rule
 */
export const createScoringRule = async (ruleData) => {
  const { json } = await httpClient(`${API_URL}/scoring/rules`, {
    method: 'POST',
    body: JSON.stringify(ruleData),
  });
  return json;
};

/**
 * Update an existing scoring rule
 * @param {string} ruleId - Rule UUID
 * @param {Object} ruleData - Fields to update (slug cannot be changed)
 * @returns {Promise<Object>} Updated rule
 */
export const updateScoringRule = async (ruleId, ruleData) => {
  const { json } = await httpClient(`${API_URL}/scoring/rules/${ruleId}`, {
    method: 'PATCH',
    body: JSON.stringify(ruleData),
  });
  return json;
};

/**
 * Delete a scoring rule
 * @param {string} ruleId - Rule UUID
 * @returns {Promise<void>}
 */
export const deleteScoringRule = async (ruleId) => {
  await httpClient(`${API_URL}/scoring/rules/${ruleId}`, {
    method: 'DELETE',
  });
};

// ==========================================
// Scoring API - Configuration & Statistics
// ==========================================

/**
 * Get score threshold configuration
 * @returns {Promise<Object>} Thresholds and tier definitions
 */
export const getScoringThresholds = async () => {
  const { json } = await httpClient(`${API_URL}/scoring/thresholds`);
  return json;
};

/**
 * Get overall scoring statistics
 * @returns {Promise<Object>} Rules stats, history stats, lead distribution, top rules
 */
export const getScoringStats = async () => {
  const { json } = await httpClient(`${API_URL}/scoring/stats`);
  return json;
};

// ==========================================
// Team Management API
// ==========================================

/**
 * Get all team members with pagination and filtering
 * @param {Object} params - Query parameters
 * @param {number} params.page - Page number (default: 1)
 * @param {number} params.limit - Results per page (default: 25)
 * @param {string} params.role - Filter by role
 * @param {string} params.region - Filter by region
 * @param {boolean} params.is_active - Filter by active status
 * @returns {Promise<Object>} Team members array with pagination info
 */
export const getTeamMembers = async (params = {}) => {
  const query = stringify({
    page: params.page || 1,
    limit: params.limit || 25,
    ...(params.role && { role: params.role }),
    ...(params.region && { region: params.region }),
    ...(params.is_active !== undefined && { is_active: params.is_active }),
  });
  const { json } = await httpClient(`${API_URL}/team?${query}`);
  return json;
};

/**
 * Get team statistics
 * @returns {Promise<Object>} Overall team stats
 */
export const getTeamStats = async () => {
  const { json } = await httpClient(`${API_URL}/team/stats`);
  return json;
};

/**
 * Get a single team member by ID
 * @param {string} memberId - Team member UUID
 * @returns {Promise<Object>} Team member details
 */
export const getTeamMember = async (memberId) => {
  const { json } = await httpClient(`${API_URL}/team/${memberId}`);
  return json.data || json;
};

/**
 * Create a new team member
 * @param {Object} memberData - Member data
 * @param {string} memberData.name - Full name
 * @param {string} memberData.email - Email address
 * @param {string} memberData.role - Role (admin|sales_manager|sales_rep|viewer)
 * @param {string} memberData.region - Optional region
 * @param {number} memberData.max_leads - Max concurrent leads (default: 10)
 * @returns {Promise<Object>} Created team member
 */
export const createTeamMember = async (memberData) => {
  const { json } = await httpClient(`${API_URL}/team`, {
    method: 'POST',
    body: JSON.stringify(memberData),
  });
  return json.data || json;
};

/**
 * Update an existing team member
 * @param {string} memberId - Team member UUID
 * @param {Object} memberData - Fields to update
 * @returns {Promise<Object>} Updated team member
 */
export const updateTeamMember = async (memberId, memberData) => {
  const { json } = await httpClient(`${API_URL}/team/${memberId}`, {
    method: 'PATCH',
    body: JSON.stringify(memberData),
  });
  return json.data || json;
};

/**
 * Delete a team member
 * @param {string} memberId - Team member UUID
 * @returns {Promise<void>}
 */
export const deleteTeamMember = async (memberId) => {
  await httpClient(`${API_URL}/team/${memberId}`, {
    method: 'DELETE',
  });
};

/**
 * Deactivate a team member (soft delete)
 * @param {string} memberId - Team member UUID
 * @returns {Promise<Object>} Updated team member
 */
export const deactivateTeamMember = async (memberId) => {
  const { json } = await httpClient(`${API_URL}/team/${memberId}/deactivate`, {
    method: 'POST',
  });
  return json.data || json;
};

/**
 * Get workload information for a team member
 * @param {string} memberId - Team member UUID
 * @returns {Promise<Object>} Workload stats
 */
export const getTeamWorkload = async (memberId) => {
  const { json } = await httpClient(`${API_URL}/team/${memberId}/workload`);
  return json.data || json;
};

// ==========================================
// Integration Status API
// ==========================================

/**
 * Get status of all integrations
 * @returns {Promise<Object>} Status of Moco and Slack integrations
 */
export const getIntegrationsStatus = async () => {
  const { json } = await httpClient(`${API_URL}/integrations/status`);
  return json;
};

/**
 * Get Moco connection status with connection test
 * @returns {Promise<Object>} Moco status with connection details
 */
export const getMocoStatus = async () => {
  const { json } = await httpClient(`${API_URL}/integrations/moco/status`);
  return json;
};

/**
 * Trigger manual Moco sync for a lead
 * @param {string} leadId - Lead UUID
 * @param {Object} options - Sync options
 * @param {string} options.action - Action: 'create_customer'
 * @param {boolean} options.force - Force sync even if already synced
 * @returns {Promise<Object>} Job status
 */
export const triggerMocoLeadSync = async (leadId, options = {}) => {
  const { json } = await httpClient(`${API_URL}/integrations/moco/sync/lead/${leadId}`, {
    method: 'POST',
    body: JSON.stringify({
      action: options.action || 'create_customer',
      force: options.force || false,
    }),
  });
  return json;
};

/**
 * Trigger manual Moco sync for a deal
 * @param {string} dealId - Deal UUID
 * @param {Object} options - Sync options
 * @param {string} options.action - Action: 'create_offer' | 'create_invoice'
 * @param {boolean} options.force - Force sync even if already synced
 * @returns {Promise<Object>} Job status
 */
export const triggerMocoDealSync = async (dealId, options = {}) => {
  const { json } = await httpClient(`${API_URL}/integrations/moco/sync/deal/${dealId}`, {
    method: 'POST',
    body: JSON.stringify({
      action: options.action || 'create_offer',
      force: options.force || false,
    }),
  });
  return json;
};

/**
 * Find Moco customer by email
 * @param {string} email - Customer email
 * @returns {Promise<Object>} Moco customer details
 */
export const findMocoCustomer = async (email) => {
  const { json } = await httpClient(`${API_URL}/integrations/moco/customer/${encodeURIComponent(email)}`);
  return json;
};

// ==========================================
// Routing Configuration API
// ==========================================

/**
 * Get routing configuration
 * @returns {Promise<Object>} Routing config with thresholds and mappings
 */
export const getRoutingConfig = async () => {
  const { json } = await httpClient(`${API_URL}/routing/config`);
  return json;
};

// ==========================================
// Reports & Analytics API
// ==========================================

/**
 * Get routing statistics
 * @returns {Promise<Object>} Routing stats with pipeline and intent breakdown
 */
export const getRoutingStats = async () => {
  const { json } = await httpClient(`${API_URL}/routing/stats`);
  return json;
};

/**
 * Get lead statistics
 * @returns {Promise<Object>} Lead stats by status and routing status
 */
export const getLeadStats = async () => {
  const { json } = await httpClient(`${API_URL}/leads/stats`);
  return json;
};

/**
 * Get deal statistics
 * @param {string} pipelineId - Optional pipeline ID to filter by
 * @returns {Promise<Object>} Deal stats by status
 */
export const getDealStats = async (pipelineId) => {
  const query = pipelineId ? `?pipeline_id=${pipelineId}` : '';
  const { json } = await httpClient(`${API_URL}/deals/stats${query}`);
  return json;
};

/**
 * Get pipeline metrics with stage breakdown
 * @param {string} pipelineId - Pipeline UUID
 * @returns {Promise<Object>} Pipeline metrics including stages
 */
export const getPipelineMetrics = async (pipelineId) => {
  const { json } = await httpClient(`${API_URL}/pipelines/${pipelineId}/metrics`);
  return json;
};

/**
 * Get all pipelines with summary
 * @returns {Promise<Object>} Pipelines with deal counts and values
 */
export const getPipelinesWithSummary = async () => {
  const { json } = await httpClient(`${API_URL}/pipelines?with_summary=true`);
  return json;
};

/**
 * Get leads with date filtering for time series
 * @param {Object} params - Query parameters
 * @returns {Promise<Object>} Leads data
 */
export const getLeadsTimeSeries = async (params = {}) => {
  const query = stringify({
    page: params.page || 1,
    limit: Math.min(params.limit || 100, 100), // API max is 100
    sort_by: 'created_at',
    sort_order: 'asc',
    ...(params.created_after && { created_after: params.created_after }),
    ...(params.created_before && { created_before: params.created_before }),
  });
  const { json } = await httpClient(`${API_URL}/leads?${query}`);
  return json;
};

export default dataProvider;
