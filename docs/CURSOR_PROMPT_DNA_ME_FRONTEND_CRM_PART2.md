# DNA ME CRM Dashboard - Cursor Agent Prompt (Part 2 of 2)

## 🛠️ IMPLEMENTATION REQUIREMENTS

### Required Features (MVP - Priority 1)

#### 1. Dashboard
```jsx
// Dashboard must include:
- 6 KPI cards with trend indicators (Total Leads, Qualified Leads, Pipeline Value, Closed Deals, Conversion Rate, Avg Deal Size)
- 3-column Pipeline Funnel visualization (one per pipeline)
- Hot Leads list (score > 80) with quick actions
- Recent Activity feed (last 20 events)
- Lead Acquisition chart (area chart, 30 days)
- Lead Sources pie chart
- Auto-refresh every 60 seconds
```

#### 2. Leads Resource (Full CRUD)
```jsx
// LeadList requirements:
- DataGrid with columns: Name, Company, Email, Score (badge), Pipeline (chip), Source, Created, Actions
- Sidebar filters: Score range, Pipeline, Source, Date range, Tags
- Bulk actions: Assign to rep, Add tags, Export selected
- Quick search by name/email/company
- Score badge with color coding (Cold/Warm/Hot/Very Hot)

// LeadShow requirements:
- Tabbed layout: Overview | Activity | Deals | Notes
- Overview tab: Contact card, Company card, Score breakdown, Attribution data
- Activity tab: Full timeline with event icons and colors
- Deals tab: Related deals in this pipeline
- Notes tab: Internal notes with rich text

// LeadEdit requirements:
- Sections: Contact Info, Company Info, Pipeline Assignment, Acquisition Data, Tags
- Inline company creation (if new company)
- Score displayed but not editable (calculated field)
- Quick actions: Recalculate Score, Sync to HubSpot, Create Deal
```

#### 3. Deals Resource (Kanban + List)
```jsx
// DealList requirements:
- Toggle between Kanban and List views
- Pipeline selector (Research Lab / B2B Lab / Co-Creation)
- Kanban with drag-drop stage changes
- Stage columns show total value and deal count
- Deal cards show: Title, Value, Contact avatar, Close date, Days in stage

// KanbanBoard requirements:
- Use @hello-pangea/dnd (fork of react-beautiful-dnd)
- On drop: Call API to update stage, optimistic update
- Stage columns are sortable (by value, date, etc.)
- Visual indicator when dragging (placeholder)

// DealShow requirements:
- Stage stepper showing progress through pipeline
- Deal info: Value, Contact, Company, Expected close
- Activity timeline
- Related samples/orders (if applicable)
- Notes and tasks
```

#### 4. Lead Scoring Configuration Page
```jsx
// LeadScoring page requirements:
- Display all scoring rules organized by category (Demographic/Engagement/Behavior)
- Edit rule points (admin only)
- Add/remove rules
- Configure score thresholds (Cold/Warm/Hot/Very Hot boundaries)
- Score decay settings (decay period, decay rate)
- Test calculator: Input lead attributes → See calculated score breakdown
```

#### 5. Webhook Monitor Page
```jsx
// WebhookMonitor requirements:
- Real-time log table: Timestamp, Event Type, Source → Destination, Status, Duration, Actions
- Filters: Status (Success/Failed/Pending), Endpoint, Date range
- Search by correlation_id or event content
- Health cards per endpoint: Success rate, Avg response time, 24h trend chart
- Retry button for failed webhooks
- Test webhook button per endpoint
- Auto-refresh toggle (30 second interval)
```

#### 6. Analytics Page
```jsx
// Analytics requirements:
- Date range selector: Last 7/30/90 days, MTD, QTD, YTD
- Pipeline filter
- KPI cards with vs. previous period comparison
- Conversion Funnel chart (Awareness → Interest → Decision → Customer)
- Lead Sources performance table: Source, Leads, Conversion %, CAC
- Campaign Performance table: Name, Channel, Impressions, Clicks, Leads, Conv Rate, Spend, CPL, ROI
- Revenue trend chart (ComposedChart: Area for revenue + Line for deals)
- Export to CSV/PDF
```

---

### Required Features (Phase 2 - Priority 2)

#### 7. Contacts & Companies Resources
```jsx
// Standard CRUD with:
- Company → Contacts relationship (one-to-many)
- Inline contact creation from company
- Activity log per contact
- Merge duplicates feature
- LinkedIn/website links
```

#### 8. Orders & Samples Resources
```jsx
// Orders:
- Order status stepper (pending → confirmed → processing → completed)
- Related samples list
- Payment status (from Stripe/Moco)
- Delivery tracking

// Samples:
- QC Results display (pass/fail/needs_review)
- Sample timeline (registered → shipped → received → processing → completed)
- Link to analysis results
```

#### 9. Campaigns Resource
```jsx
// Campaign management:
- Campaign list with performance metrics
- Campaign create/edit with target audience
- UTM parameter generator
- Related leads list
- ROI calculation
```

#### 10. Automations Resource
```jsx
// Automation rules:
- List of automation rules
- Rule builder: Trigger → Conditions → Actions
- Enable/disable toggles
- Execution log
- Test automation button
```

---

### Required Features (Phase 3 - Priority 3)

#### 11. Journey Builder (Visual)
```jsx
// Visual customer journey builder:
- Drag-drop nodes: Trigger, Wait, Condition, Action
- Canvas with connections between nodes
- Node types:
  - Triggers: Form submitted, Page viewed, Score changed, Deal stage changed
  - Conditions: If score > X, If tag contains, If pipeline is
  - Actions: Send email, Assign to rep, Add tag, Create deal, Notify Slack
- Save/publish/pause journeys
```

#### 12. Advanced Reporting
```jsx
// Custom report builder:
- Select metrics
- Group by dimensions
- Filter conditions
- Chart type selector
- Save report templates
- Schedule email delivery
```

#### 13. Real-Time Features
```jsx
// WebSocket integration:
- Live notifications for hot leads
- Real-time dashboard updates
- Activity feed live streaming
- Collaboration features (who's viewing this lead)
```

---

## 📝 CODE EXAMPLES

### Data Provider Implementation
```javascript
// src/providers/dataProvider.js
import { fetchUtils } from 'react-admin';
import { stringify } from 'query-string';

const API_URL = import.meta.env.VITE_API_URL || 'https://api.dna-me.net/v1';

const httpClient = async (url, options = {}) => {
  const headers = new Headers({
    Accept: 'application/json',
    'Content-Type': 'application/json',
  });
  
  const token = localStorage.getItem('auth_token');
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }
  
  // Correlation ID for distributed tracing
  const correlationId = `admin_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  headers.set('X-Correlation-ID', correlationId);
  
  return fetchUtils.fetchJson(url, { ...options, headers });
};

const dataProvider = {
  getList: async (resource, params) => {
    const { page, perPage } = params.pagination;
    const { field, order } = params.sort;
    
    const query = {
      _sort: field,
      _order: order,
      _page: page,
      _limit: perPage,
      ...flattenObject(params.filter),
    };
    
    const url = `${API_URL}/${resource}?${stringify(query)}`;
    const { json, headers } = await httpClient(url);
    
    const total = parseInt(headers.get('X-Total-Count') || json.total || '0', 10);
    
    return {
      data: json.data || json,
      total,
    };
  },
  
  getOne: async (resource, params) => {
    const { json } = await httpClient(`${API_URL}/${resource}/${params.id}`);
    return { data: json.data || json };
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
  
  delete: async (resource, params) => {
    await httpClient(`${API_URL}/${resource}/${params.id}`, {
      method: 'DELETE',
    });
    return { data: { id: params.id } };
  },
  
  // ... getMany, getManyReference, updateMany, deleteMany
  
  // Custom methods
  recalculateScore: async (leadId) => {
    const { json } = await httpClient(`${API_URL}/leads/${leadId}/recalculate-score`, {
      method: 'POST',
    });
    return json;
  },
  
  syncToHubSpot: async (resource, ids) => {
    const { json } = await httpClient(`${API_URL}/integrations/hubspot/sync`, {
      method: 'POST',
      body: JSON.stringify({ resource, ids }),
    });
    return json;
  },
  
  moveDealStage: async (dealId, newStage) => {
    const { json } = await httpClient(`${API_URL}/deals/${dealId}/stage`, {
      method: 'PUT',
      body: JSON.stringify({ stage: newStage }),
    });
    return json;
  },
  
  getLeadTimeline: async (leadId) => {
    const { json } = await httpClient(`${API_URL}/leads/${leadId}/timeline`);
    return json.data || json;
  },
  
  testWebhook: async (webhookId) => {
    const { json } = await httpClient(`${API_URL}/webhooks/${webhookId}/test`, {
      method: 'POST',
    });
    return json;
  },
  
  retryWebhook: async (logId) => {
    const { json } = await httpClient(`${API_URL}/webhook-logs/${logId}/retry`, {
      method: 'POST',
    });
    return json;
  },
};

export default dataProvider;
```

### Score Badge Component
```jsx
// src/components/common/ScoreBadge.jsx
import { Chip, Tooltip, Box, LinearProgress } from '@mui/material';
import { TrendingUp, TrendingDown, TrendingFlat } from '@mui/icons-material';

const SCORE_CONFIG = {
  cold: { min: 0, max: 40, color: '#64748B', label: 'Cold' },
  warm: { min: 41, max: 80, color: '#F59E0B', label: 'Warm' },
  hot: { min: 81, max: 120, color: '#EF4444', label: 'Hot' },
  veryHot: { min: 121, max: 200, color: '#DC2626', label: 'Very Hot' },
};

const getScoreConfig = (score) => {
  if (score >= 121) return SCORE_CONFIG.veryHot;
  if (score >= 81) return SCORE_CONFIG.hot;
  if (score >= 41) return SCORE_CONFIG.warm;
  return SCORE_CONFIG.cold;
};

export const ScoreBadge = ({ score, trend, showBreakdown, breakdown }) => {
  const config = getScoreConfig(score);
  
  const TrendIcon = trend > 0 ? TrendingUp : trend < 0 ? TrendingDown : TrendingFlat;
  const trendColor = trend > 0 ? 'success.main' : trend < 0 ? 'error.main' : 'text.secondary';
  
  const tooltipContent = showBreakdown && breakdown ? (
    <Box sx={{ p: 1 }}>
      <Box sx={{ mb: 1 }}>
        <strong>Score Breakdown</strong>
      </Box>
      <Box>Demographic: {breakdown.demographic}/40</Box>
      <Box>Engagement: {breakdown.engagement}/60</Box>
      <Box>Behavior: {breakdown.behavior}/100</Box>
    </Box>
  ) : config.label;
  
  return (
    <Tooltip title={tooltipContent} arrow>
      <Chip
        label={
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <span>{score}</span>
            {trend !== undefined && (
              <TrendIcon sx={{ fontSize: 14, color: trendColor }} />
            )}
          </Box>
        }
        size="small"
        sx={{
          bgcolor: `${config.color}20`,
          color: config.color,
          fontWeight: 600,
          borderRadius: 1,
        }}
      />
    </Tooltip>
  );
};
```

### Kanban Board Component
```jsx
// src/resources/deals/components/KanbanBoard.jsx
import { useState } from 'react';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import { Box, Paper, Typography, Chip } from '@mui/material';
import { useDataProvider, useNotify, useRefresh } from 'react-admin';
import { DealCard } from './DealCard';

export const KanbanBoard = ({ deals, stages, pipeline }) => {
  const dataProvider = useDataProvider();
  const notify = useNotify();
  const refresh = useRefresh();
  const [localDeals, setLocalDeals] = useState(deals);
  
  const handleDragEnd = async (result) => {
    if (!result.destination) return;
    
    const { draggableId, source, destination } = result;
    
    if (source.droppableId === destination.droppableId) return;
    
    const dealId = draggableId;
    const newStage = destination.droppableId;
    
    // Optimistic update
    setLocalDeals((prev) =>
      prev.map((deal) =>
        deal.id === dealId ? { ...deal, stage: newStage } : deal
      )
    );
    
    try {
      await dataProvider.moveDealStage(dealId, newStage);
      notify('Deal moved successfully', { type: 'success' });
    } catch (error) {
      // Revert on error
      setLocalDeals(deals);
      notify('Failed to move deal', { type: 'error' });
    }
  };
  
  const getDealsByStage = (stageId) =>
    localDeals.filter((deal) => deal.stage === stageId);
  
  const getStageTotal = (stageId) =>
    getDealsByStage(stageId).reduce((sum, deal) => sum + (deal.value || 0), 0);
  
  return (
    <DragDropContext onDragEnd={handleDragEnd}>
      <Box sx={{ display: 'flex', gap: 2, overflowX: 'auto', p: 2 }}>
        {stages.map((stage) => (
          <Droppable key={stage.id} droppableId={stage.id}>
            {(provided, snapshot) => (
              <Paper
                ref={provided.innerRef}
                {...provided.droppableProps}
                sx={{
                  minWidth: 280,
                  maxWidth: 320,
                  bgcolor: snapshot.isDraggingOver ? 'action.hover' : 'background.paper',
                  p: 2,
                  borderRadius: 2,
                }}
              >
                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
                  <Typography variant="subtitle1" fontWeight={600}>
                    {stage.name}
                  </Typography>
                  <Chip
                    label={`€${getStageTotal(stage.id).toLocaleString()}`}
                    size="small"
                    color="primary"
                  />
                </Box>
                
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                  {getDealsByStage(stage.id).map((deal, index) => (
                    <Draggable key={deal.id} draggableId={deal.id} index={index}>
                      {(provided, snapshot) => (
                        <div
                          ref={provided.innerRef}
                          {...provided.draggableProps}
                          {...provided.dragHandleProps}
                        >
                          <DealCard
                            deal={deal}
                            isDragging={snapshot.isDragging}
                          />
                        </div>
                      )}
                    </Draggable>
                  ))}
                </Box>
                
                {provided.placeholder}
              </Paper>
            )}
          </Droppable>
        ))}
      </Box>
    </DragDropContext>
  );
};
```

### Webhook Monitor Component
```jsx
// src/pages/WebhookMonitor/index.jsx
import { useState, useEffect, useCallback } from 'react';
import {
  Box, Paper, Typography, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, Chip, IconButton, Tooltip, Button, TextField,
  FormControl, InputLabel, Select, MenuItem,
} from '@mui/material';
import { Refresh, Visibility, Replay, CheckCircle, Error, Schedule } from '@mui/icons-material';
import { useDataProvider, useNotify } from 'react-admin';
import { formatDistanceToNow } from 'date-fns';

const StatusBadge = ({ status }) => {
  const config = {
    success: { icon: CheckCircle, color: 'success', label: 'Success' },
    failed: { icon: Error, color: 'error', label: 'Failed' },
    pending: { icon: Schedule, color: 'warning', label: 'Pending' },
    retrying: { icon: Replay, color: 'info', label: 'Retrying' },
  };
  
  const { icon: Icon, color, label } = config[status] || config.pending;
  
  return (
    <Chip
      icon={<Icon sx={{ fontSize: 16 }} />}
      label={label}
      size="small"
      color={color}
    />
  );
};

export const WebhookMonitor = () => {
  const dataProvider = useDataProvider();
  const notify = useNotify();
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({ status: 'all', endpoint: 'all' });
  const [autoRefresh, setAutoRefresh] = useState(true);
  
  const loadLogs = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await dataProvider.getList('webhook-logs', {
        pagination: { page: 1, perPage: 100 },
        sort: { field: 'timestamp', order: 'DESC' },
        filter: filters.status !== 'all' ? { status: filters.status } : {},
      });
      setLogs(data);
    } catch (error) {
      notify('Failed to load webhook logs', { type: 'error' });
    } finally {
      setLoading(false);
    }
  }, [dataProvider, filters, notify]);
  
  useEffect(() => {
    loadLogs();
  }, [loadLogs]);
  
  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(loadLogs, 30000);
    return () => clearInterval(interval);
  }, [autoRefresh, loadLogs]);
  
  const handleRetry = async (logId) => {
    try {
      await dataProvider.retryWebhook(logId);
      notify('Retry initiated', { type: 'success' });
      loadLogs();
    } catch (error) {
      notify('Retry failed', { type: 'error' });
    }
  };
  
  return (
    <Box sx={{ p: 3 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 3 }}>
        <Typography variant="h4" fontWeight={300}>
          Webhook Monitor
        </Typography>
        <Box sx={{ display: 'flex', gap: 2 }}>
          <Chip
            label={autoRefresh ? 'Auto-refresh ON' : 'Auto-refresh OFF'}
            color={autoRefresh ? 'success' : 'default'}
            onClick={() => setAutoRefresh(!autoRefresh)}
            sx={{ cursor: 'pointer' }}
          />
          <Button
            variant="outlined"
            startIcon={<Refresh />}
            onClick={loadLogs}
            disabled={loading}
          >
            Refresh
          </Button>
        </Box>
      </Box>
      
      {/* Filters */}
      <Box sx={{ display: 'flex', gap: 2, mb: 3 }}>
        <FormControl size="small" sx={{ minWidth: 150 }}>
          <InputLabel>Status</InputLabel>
          <Select
            value={filters.status}
            onChange={(e) => setFilters({ ...filters, status: e.target.value })}
            label="Status"
          >
            <MenuItem value="all">All Status</MenuItem>
            <MenuItem value="success">Success</MenuItem>
            <MenuItem value="failed">Failed</MenuItem>
            <MenuItem value="pending">Pending</MenuItem>
          </Select>
        </FormControl>
      </Box>
      
      {/* Logs Table */}
      <TableContainer component={Paper}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Timestamp</TableCell>
              <TableCell>Event Type</TableCell>
              <TableCell>Source → Dest</TableCell>
              <TableCell>Duration</TableCell>
              <TableCell>Status</TableCell>
              <TableCell align="right">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {logs.map((log) => (
              <TableRow key={log.id} hover>
                <TableCell>
                  <Tooltip title={log.timestamp}>
                    <span>{formatDistanceToNow(new Date(log.timestamp), { addSuffix: true })}</span>
                  </Tooltip>
                </TableCell>
                <TableCell>
                  <Chip label={log.event_type} size="small" variant="outlined" />
                </TableCell>
                <TableCell>{log.source} → {log.destination}</TableCell>
                <TableCell>{log.duration_ms}ms</TableCell>
                <TableCell><StatusBadge status={log.status} /></TableCell>
                <TableCell align="right">
                  <Tooltip title="View Details">
                    <IconButton size="small">
                      <Visibility fontSize="small" />
                    </IconButton>
                  </Tooltip>
                  {log.status === 'failed' && (
                    <Tooltip title="Retry">
                      <IconButton size="small" onClick={() => handleRetry(log.id)}>
                        <Replay fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  );
};
```

---

## 🚀 IMPLEMENTATION INSTRUCTIONS FOR CURSOR

### Step 1: Project Initialization
```bash
# Create Vite React project
npm create vite@latest dna-me-admin -- --template react
cd dna-me-admin

# Install core dependencies
npm install react-admin @mui/material @mui/icons-material @emotion/react @emotion/styled
npm install recharts date-fns query-string @hello-pangea/dnd lodash
npm install zustand @tanstack/react-query

# Dev dependencies
npm install -D @types/react @types/node vite-plugin-svgr
```

### Step 2: Build Order
1. **Theme & Layout** (2 hours)
   - Create theme configuration
   - Custom AppBar, Menu, Layout components
   
2. **Auth & Data Providers** (3 hours)
   - Implement authProvider with JWT
   - Implement dataProvider with all endpoints
   
3. **Dashboard** (4 hours)
   - KPI cards
   - Pipeline funnel visualization
   - Charts (Recharts)
   - Activity feed
   
4. **Leads Resource** (6 hours)
   - LeadList with filters
   - LeadShow with timeline
   - LeadEdit form
   - Score badge component
   
5. **Deals Resource** (6 hours)
   - KanbanBoard with drag-drop
   - DealCard component
   - Stage management
   - Pipeline selector
   
6. **Lead Scoring Page** (4 hours)
   - Rule editor
   - Threshold configuration
   - Test calculator
   
7. **Webhook Monitor** (3 hours)
   - Log table
   - Status badges
   - Retry functionality
   
8. **Analytics Page** (4 hours)
   - Funnel charts
   - Source performance
   - Campaign ROI

### Step 3: Testing Checklist
- [ ] Authentication flow (login, logout, token refresh)
- [ ] Lead CRUD operations
- [ ] Deal kanban drag-drop
- [ ] Score calculation display
- [ ] Webhook log display
- [ ] Dashboard metrics load
- [ ] Filter persistence
- [ ] Mobile responsiveness
- [ ] Error handling (API failures, network errors)

---

## 📋 ACCEPTANCE CRITERIA

### Must Pass
1. ✅ Login/logout works with JWT
2. ✅ All CRUD operations work for leads and deals
3. ✅ Kanban drag-drop updates deal stage
4. ✅ Lead scores display with correct colors
5. ✅ Dashboard shows real data (or good mock data)
6. ✅ Webhook monitor shows log entries
7. ✅ Mobile-friendly (responsive layout)

### Nice to Have
- Real-time updates via WebSocket
- Offline support
- Export to CSV/Excel
- Bulk operations
- Advanced filtering
- Custom reports

---

## 🔧 ENVIRONMENT VARIABLES

```env
# .env.local
VITE_API_URL=https://api.dna-me.net/v1
VITE_HUBSPOT_PORTAL_ID=your-portal-id
VITE_SENTRY_DSN=your-sentry-dsn
VITE_WS_URL=wss://api.dna-me.net/ws
```

---

## 📚 REFERENCE MATERIALS

### API Documentation
The backend API follows these conventions:
- All responses wrapped in `{ data: ..., meta: { total, page } }`
- Error responses: `{ error: { code, message, details } }`
- Pagination: `_page`, `_limit`, `_sort`, `_order` query params
- Filtering: Field names as query params (e.g., `?status=active&score_gte=80`)

### HubSpot Integration
- Contacts sync: On lead creation/update
- Deals sync: On deal creation/stage change
- Two-way sync: HubSpot changes reflected in dashboard (read-only)

### Moco Integration
- Invoice sync: On order payment confirmation
- Customer sync: On registration (for invoice address)
- Testatfähigkeit requirement: All financial data must be in Moco

---

## 🎯 SUCCESS METRICS

The dashboard should enable:
1. **Sales Team:** See all hot leads immediately, move deals through pipeline
2. **Marketing:** Track campaign performance, lead sources ROI
3. **Management:** Dashboard overview of all KPIs
4. **Operations:** Monitor webhook health, debug integration issues

---

# END OF PROMPT

Now you have complete context to build the DNA ME CRM Dashboard. Start with the project structure, then implement features in the order specified. Ask questions if any business logic is unclear.

Good luck! 🚀
