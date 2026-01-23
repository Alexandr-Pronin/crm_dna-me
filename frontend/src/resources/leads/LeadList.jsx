/**
 * Lead List Component
 * Displays leads from the REAL backend API (GET /leads)
 */
import { useState, useEffect, useCallback } from 'react';
import {
  List as RaList,
  Datagrid,
  TextField,
  DateField,
  FunctionField,
  useRefresh,
  useNotify,
  useDataProvider,
  ReferenceField,
  TopToolbar,
  FilterButton,
  CreateButton,
  ExportButton,
  SearchInput,
  SelectInput,
  TextInput,
} from 'react-admin';
import {
  Box,
  Typography,
  Chip,
  IconButton,
  Tooltip,
  Card,
  CardContent,
  List as MuiList,
  ListItem,
  ListItemIcon,
  ListItemText,
  Divider,
  CircularProgress,
  Alert,
  Pagination,
  Link,
} from '@mui/material';
import {
  Refresh as RefreshIcon,
  Visibility as ViewIcon,
  Edit as EditIcon,
  EventNote as EventNoteIcon,
} from '@mui/icons-material';
import { ScoreBadge, StatusBadge } from '../../components/common';
import LeadCreateModal from './LeadCreateModal';
import { getLeadEvents } from '../../providers/dataProvider';
import { formatDistanceToNow, parseISO, isValid } from 'date-fns';
import { de } from 'date-fns/locale';

/**
 * Custom filters for the lead list
 */
const leadFilters = [
  <SearchInput source="q" alwaysOn placeholder="Search leads..." />,
  <SelectInput
    source="status"
    choices={[
      { id: 'new', name: 'New' },
      { id: 'contacted', name: 'Contacted' },
      { id: 'qualified', name: 'Qualified' },
      { id: 'nurturing', name: 'Nurturing' },
      { id: 'customer', name: 'Customer' },
      { id: 'churned', name: 'Churned' },
    ]}
  />,
  <SelectInput
    source="lifecycle_stage"
    label="Stage"
    choices={[
      { id: 'lead', name: 'Lead' },
      { id: 'mql', name: 'MQL' },
      { id: 'sql', name: 'SQL' },
      { id: 'opportunity', name: 'Opportunity' },
      { id: 'customer', name: 'Customer' },
    ]}
  />,
  <SelectInput
    source="primary_intent"
    label="Intent"
    choices={[
      { id: 'research', name: 'Research' },
      { id: 'b2b', name: 'B2B' },
      { id: 'co_creation', name: 'Co-Creation' },
    ]}
  />,
  <TextInput source="email" label="Email" />,
];

const SOURCE_LABELS = {
  waalaxy: 'Waalaxy',
  portal: 'Portal',
  lemlist: 'Lemlist',
  ads: 'Ads',
  conference: 'Conference',
  website: 'Website',
  linkedin: 'LinkedIn',
  manual: 'Manual',
  api: 'API',
  import: 'Import',
};

const formatRelativeTime = (value) => {
  if (!value) return 'Unbekannt';
  const dateValue = typeof value === 'string' ? parseISO(value) : new Date(value);
  if (!isValid(dateValue)) return 'Unbekannt';
  return formatDistanceToNow(dateValue, { addSuffix: true, locale: de });
};

const humanizeEventType = (eventType) => {
  if (!eventType) return 'Aktivität aktualisiert';
  return eventType
    .split('_')
    .map((word) => (word ? word[0].toUpperCase() + word.slice(1) : ''))
    .join(' ');
};

const buildLeadLabel = (lead) => {
  if (!lead) return 'Unbekannter Lead';
  const fullName = [lead.first_name, lead.last_name].filter(Boolean).join(' ').trim();
  if (fullName && lead.email) return `${fullName} (${lead.email})`;
  if (fullName) return fullName;
  return lead.email || lead.id || 'Unbekannter Lead';
};

/**
 * Custom actions toolbar
 */
const ListActions = ({ onCreateClick }) => (
  <TopToolbar>
    <FilterButton />
    <CreateButton onClick={onCreateClick} label="Create Lead" />
    <ExportButton />
  </TopToolbar>
);

/**
 * Full Name field renderer
 */
const FullNameField = ({ record }) => {
  if (!record) return null;
  const firstName = record.first_name || '';
  const lastName = record.last_name || '';
  const fullName = `${firstName} ${lastName}`.trim();
  
  return (
    <Box>
      <Typography variant="body2" fontWeight={500}>
        {fullName || '—'}
      </Typography>
      {record.job_title && (
        <Typography variant="caption" color="text.secondary">
          {record.job_title}
        </Typography>
      )}
    </Box>
  );
};

/**
 * Intent field with confidence indicator
 */
const IntentField = ({ record }) => {
  if (!record?.primary_intent) return <Typography color="text.secondary">—</Typography>;
  
  const intentColors = {
    research: '#4A90A4',
    b2b: '#6C5CE7',
    co_creation: '#28A745',
  };
  
  const color = intentColors[record.primary_intent] || '#64748B';
  const confidence = record.intent_confidence || 0;
  
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
      <StatusBadge status={record.primary_intent} />
      {confidence > 0 && (
        <Typography variant="caption" color="text.secondary">
          {Math.round(confidence * 100)}%
        </Typography>
      )}
    </Box>
  );
};

/**
 * Score field with breakdown tooltip
 */
const ScoreField = ({ record }) => {
  if (!record) return null;
  
  return (
    <ScoreBadge
      score={record.total_score || 0}
      breakdown={{
        demographic: record.demographic_score || 0,
        engagement: record.engagement_score || 0,
        behavior: record.behavior_score || 0,
      }}
    />
  );
};

/**
 * Actions column
 */
const ActionsField = ({ record }) => {
  if (!record) return null;
  
  return (
    <Box sx={{ display: 'flex', gap: 0.5 }}>
      <Tooltip title="View Details">
        <IconButton size="small" href={`#/leads/${record.id}/show`}>
          <ViewIcon fontSize="small" />
        </IconButton>
      </Tooltip>
      <Tooltip title="Edit">
        <IconButton size="small" href={`#/leads/${record.id}`}>
          <EditIcon fontSize="small" />
        </IconButton>
      </Tooltip>
    </Box>
  );
};

/**
 * Main Lead List Component
 */
const LeadList = () => {
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [recentActivities, setRecentActivities] = useState([]);
  const [activitiesLoading, setActivitiesLoading] = useState(false);
  const [activitiesError, setActivitiesError] = useState(null);
  const [activitiesPage, setActivitiesPage] = useState(1);
  const [activitiesTotal, setActivitiesTotal] = useState(0);
  const activitiesPerPage = 10;
  const refresh = useRefresh();
  const notify = useNotify();
  const dataProvider = useDataProvider();

  const handleCreateClick = (e) => {
    e.preventDefault();
    setCreateModalOpen(true);
  };

  const handleCreateSuccess = () => {
    setCreateModalOpen(false);
    refresh();
    notify('Lead created successfully', { type: 'success' });
  };

  const handleCreateClose = () => {
    setCreateModalOpen(false);
  };

  const loadRecentActivities = useCallback(async () => {
    setActivitiesLoading(true);
    setActivitiesError(null);
    try {
      const { data: leads, total } = await dataProvider.getList('leads', {
        pagination: { page: activitiesPage, perPage: activitiesPerPage },
        sort: { field: 'last_activity', order: 'DESC' },
        filter: {},
      });

      setActivitiesTotal(total || 0);

      const leadsWithActivity = (leads || []).filter((lead) => lead.last_activity);
      const activityResults = await Promise.all(
        leadsWithActivity.map(async (lead) => {
          let lastEvent = null;
          try {
            const events = await getLeadEvents(lead.id, { limit: 1 });
            lastEvent = Array.isArray(events) ? events[0] : null;
          } catch (error) {
            lastEvent = null;
          }

          return {
            id: lastEvent?.id || `${lead.id}-activity`,
            lead,
            event: lastEvent,
            occurredAt:
              lastEvent?.occurred_at || lead.last_activity || lead.updated_at || lead.created_at,
          };
        })
      );

      const sortedActivities = activityResults
        .filter((entry) => entry.occurredAt)
        .sort((a, b) => new Date(b.occurredAt) - new Date(a.occurredAt))
        .slice(0, activitiesPerPage);

      setRecentActivities(sortedActivities);
    } catch (error) {
      console.error('Failed to load recent activities:', error);
      setActivitiesError('Aktivitäten konnten nicht geladen werden.');
    } finally {
      setActivitiesLoading(false);
    }
  }, [dataProvider, activitiesPage, activitiesPerPage]);

  useEffect(() => {
    loadRecentActivities();
  }, [loadRecentActivities]);

  return (
    <Box sx={{ p: 2 }}>
      {/* Page Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Box>
          <Typography variant="h4" sx={{ fontWeight: 300 }}>
            Leads
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Manage and track your sales leads
          </Typography>
        </Box>
        <Tooltip title="Refresh">
          <IconButton onClick={refresh}>
            <RefreshIcon />
          </IconButton>
        </Tooltip>
      </Box>

      {/* Recent Activity */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
            <Typography variant="h6">Letzte Aktivitäten</Typography>
            <Tooltip title="Aktivitäten aktualisieren">
              <IconButton size="small" onClick={loadRecentActivities} disabled={activitiesLoading}>
                {activitiesLoading ? <CircularProgress size={18} /> : <RefreshIcon fontSize="small" />}
              </IconButton>
            </Tooltip>
          </Box>

          {activitiesError && <Alert severity="error">{activitiesError}</Alert>}

          {!activitiesError && (
            <MuiList disablePadding>
              {recentActivities.length === 0 && !activitiesLoading && (
                <ListItem>
                  <ListItemText primary="Keine Aktivitäten gefunden." />
                </ListItem>
              )}

              {recentActivities.map((entry, index) => {
                const eventLabel = humanizeEventType(entry.event?.event_type);
                const leadLabel = buildLeadLabel(entry.lead);
                const sourceLabel = entry.event?.source
                  ? SOURCE_LABELS[entry.event.source] || entry.event.source
                  : null;
                const secondaryText = [
                  formatRelativeTime(entry.occurredAt),
                  sourceLabel ? `Quelle: ${sourceLabel}` : null,
                ]
                  .filter(Boolean)
                  .join(' • ');
                const leadUrl = entry.lead?.id ? `#/leads/${entry.lead.id}/show` : null;

                return (
                  <Box key={entry.id}>
                    <ListItem alignItems="flex-start" disableGutters>
                      <ListItemIcon sx={{ minWidth: 36, mt: 0.5 }}>
                        <EventNoteIcon fontSize="small" />
                      </ListItemIcon>
                      <ListItemText
                        primary={
                          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                            <Typography component="span" variant="body1">
                              {leadLabel}
                            </Typography>
                            <Typography component="span" variant="body1" color="text.secondary">
                              —
                            </Typography>
                            <Typography component="span" variant="body1">
                              {eventLabel}
                            </Typography>
                            {sourceLabel && (
                              <Chip size="small" label={sourceLabel} sx={{ ml: 0.5 }} />
                            )}
                          </Box>
                        }
                        secondary={secondaryText}
                      />
                      {leadUrl && (
                        <Link
                          href={leadUrl}
                          underline="hover"
                          sx={{ ml: 1, alignSelf: 'center', whiteSpace: 'nowrap' }}
                        >
                          Lead öffnen
                        </Link>
                      )}
                    </ListItem>
                    {index < recentActivities.length - 1 && <Divider component="li" />}
                  </Box>
                );
              })}
            </MuiList>
          )}

          {activitiesTotal > activitiesPerPage && (
            <Box sx={{ display: 'flex', justifyContent: 'center', mt: 2 }}>
              <Pagination
                count={Math.max(1, Math.ceil(activitiesTotal / activitiesPerPage))}
                page={activitiesPage}
                onChange={(_, page) => setActivitiesPage(page)}
                color="primary"
                size="small"
              />
            </Box>
          )}
        </CardContent>
      </Card>

      {/* Lead List */}
      <RaList
        filters={leadFilters}
        actions={<ListActions onCreateClick={handleCreateClick} />}
        sort={{ field: 'created_at', order: 'DESC' }}
        perPage={25}
        sx={{
          '& .RaList-main': {
            bgcolor: 'background.paper',
            borderRadius: 2,
            overflow: 'hidden',
          },
        }}
      >
        <Datagrid
          rowClick="show"
          bulkActionButtons={false}
          sx={{
            '& .RaDatagrid-headerCell': {
              fontWeight: 600,
              bgcolor: 'background.default',
            },
            '& .RaDatagrid-row': {
              '&:hover': {
                bgcolor: 'action.hover',
              },
            },
          }}
        >
          <TextField source="email" label="Email" />
          <FunctionField label="Name" render={(record) => <FullNameField record={record} />} />
          <ReferenceField
            source="organization_id"
            reference="organizations"
            label="Company"
            link="edit"
            emptyText="—"
          >
            <TextField source="name" />
          </ReferenceField>
          <FunctionField label="Score" render={(record) => <ScoreField record={record} />} />
          <FunctionField label="Status" render={(record) => <StatusBadge status={record?.status} />} />
          <FunctionField label="Stage" render={(record) => <StatusBadge status={record?.lifecycle_stage} />} />
          <FunctionField label="Intent" render={(record) => <IntentField record={record} />} />
          <TextField source="first_touch_source" label="Source" emptyText="—" />
          <DateField source="created_at" label="Created" showTime={false} />
          <FunctionField label="" render={(record) => <ActionsField record={record} />} />
        </Datagrid>
      </RaList>

      {/* Create Lead Modal */}
      <LeadCreateModal
        open={createModalOpen}
        onClose={handleCreateClose}
        onSuccess={handleCreateSuccess}
      />
    </Box>
  );
};

export default LeadList;
