/**
 * Lead List Component
 * Displays leads from the REAL backend API (GET /leads)
 */
import { useState } from 'react';
import {
  List,
  Datagrid,
  TextField,
  DateField,
  FunctionField,
  useRefresh,
  useNotify,
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
} from '@mui/material';
import {
  Refresh as RefreshIcon,
  Visibility as ViewIcon,
  Edit as EditIcon,
} from '@mui/icons-material';
import { ScoreBadge, StatusBadge } from '../../components/common';
import LeadCreateModal from './LeadCreateModal';

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
  const refresh = useRefresh();
  const notify = useNotify();

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

      {/* Lead List */}
      <List
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
          <FunctionField label="Score" render={(record) => <ScoreField record={record} />} />
          <FunctionField label="Status" render={(record) => <StatusBadge status={record?.status} />} />
          <FunctionField label="Stage" render={(record) => <StatusBadge status={record?.lifecycle_stage} />} />
          <FunctionField label="Intent" render={(record) => <IntentField record={record} />} />
          <TextField source="first_touch_source" label="Source" emptyText="—" />
          <DateField source="created_at" label="Created" showTime={false} />
          <FunctionField label="" render={(record) => <ActionsField record={record} />} />
        </Datagrid>
      </List>

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
