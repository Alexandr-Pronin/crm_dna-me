/**
 * Lead List Component
 * Displays leads from the REAL backend API (GET /leads)
 */
import { useState } from 'react';
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
  IconButton,
  Tooltip,
  Button,
} from '@mui/material';
import {
  Refresh as RefreshIcon,
  Visibility as ViewIcon,
  Edit as EditIcon,
  TableChart as TableChartIcon,
  Email as EmailIcon,
} from '@mui/icons-material';
import { ScoreBadge, StatusBadge } from '../../components/common';
import LeadCreateModal from './LeadCreateModal';
import CsvImportDialog from './CsvImportDialog';
import { EmailDropZone as EmailImportDialog } from './components';
import { useRightDrawer } from '../../contexts/RightDrawerContext';

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
  const { openRecord } = useRightDrawer();
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [csvImportOpen, setCsvImportOpen] = useState(false);
  const [emlImportOpen, setEmlImportOpen] = useState(false);
  const refresh = useRefresh();
  const notify = useNotify();
  const dataProvider = useDataProvider();

  const handleCreateClick = (e) => {
    e.preventDefault();
    setCreateModalOpen(true);
  };

  const handleCsvImportClick = (e) => {
    e?.preventDefault();
    setCsvImportOpen(true);
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
      <Box sx={{ mb: 2 }}>
        <Typography variant="h4" sx={{ fontWeight: 300 }}>Leads</Typography>
        <Typography variant="body2" color="text.secondary">
          Manage and track your sales leads
        </Typography>
      </Box>
      <RaList
        title=" "
        filters={leadFilters}
        actions={
          <TopToolbar sx={{ minHeight: 'auto', p: 0 }}>
            <FilterButton />
            <CreateButton onClick={handleCreateClick} label="Create Lead" />
            <Button
              size="small"
              startIcon={<TableChartIcon />}
              onClick={handleCsvImportClick}
              sx={{ fontSize: '0.8125rem' }}
            >
              CSV Import
            </Button>
            <Button
              size="small"
              startIcon={<EmailIcon />}
              onClick={() => setEmlImportOpen(true)}
              sx={{ fontSize: '0.8125rem' }}
            >
              EML Import
            </Button>
            <ExportButton />
            <Tooltip title="Refresh">
              <IconButton onClick={refresh} size="small" sx={{ ml: 0.5 }}>
                <RefreshIcon />
              </IconButton>
            </Tooltip>
          </TopToolbar>
        }
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
          rowClick={(id) => { openRecord('leads', id); return false; }}
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

      {/* CSV Import Dialog */}
      <CsvImportDialog
        open={csvImportOpen}
        onClose={() => setCsvImportOpen(false)}
      />

      {/* EML Email Import Dialog */}
      <EmailImportDialog
        open={emlImportOpen}
        onClose={() => setEmlImportOpen(false)}
        onImported={() => refresh()}
      />
    </Box>
  );
};

export default LeadList;
