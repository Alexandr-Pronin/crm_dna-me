/**
 * Deal List Component
 * Placeholder - connects to REAL API (GET /deals)
 * Full Kanban implementation in later phase
 */
import { useState } from 'react';
import {
  List,
  Datagrid,
  TextField,
  DateField,
  FunctionField,
  NumberField,
  useRefresh,
  TopToolbar,
  FilterButton,
  CreateButton,
  SearchInput,
  SelectInput,
} from 'react-admin';
import {
  Box,
  Typography,
  Chip,
  IconButton,
  Tooltip,
  Card,
  CardContent,
  ToggleButton,
  ToggleButtonGroup,
} from '@mui/material';
import {
  Refresh as RefreshIcon,
  ViewKanban as KanbanIcon,
  ViewList as ListIcon,
} from '@mui/icons-material';

const dealFilters = [
  <SearchInput source="q" alwaysOn placeholder="Search deals..." />,
  <SelectInput
    source="pipeline_id"
    label="Pipeline"
    choices={[
      { id: 'research-lab', name: 'Research Lab' },
      { id: 'b2b-lab', name: 'B2B Lab Enablement' },
      { id: 'co-creation', name: 'Panel Co-Creation' },
    ]}
  />,
  <SelectInput
    source="stage"
    choices={[
      { id: 'awareness', name: 'Awareness' },
      { id: 'interest', name: 'Interest' },
      { id: 'consideration', name: 'Consideration' },
      { id: 'decision', name: 'Decision' },
      { id: 'won', name: 'Won' },
      { id: 'lost', name: 'Lost' },
    ]}
  />,
];

const PipelineChip = ({ pipelineId }) => {
  const pipelineConfig = {
    'research-lab': { color: '#4A90A4', label: 'Research Lab' },
    'b2b-lab': { color: '#6C5CE7', label: 'B2B Lab' },
    'co-creation': { color: '#28A745', label: 'Co-Creation' },
  };
  
  const config = pipelineConfig[pipelineId] || { color: '#64748B', label: pipelineId || 'Unknown' };
  
  return (
    <Chip
      label={config.label}
      size="small"
      sx={{
        bgcolor: `${config.color}20`,
        color: config.color,
        fontWeight: 500,
      }}
    />
  );
};

const StageChip = ({ stage }) => {
  const stageColors = {
    awareness: '#64748B',
    interest: '#F59E0B',
    consideration: '#4A90A4',
    decision: '#6C5CE7',
    purchase: '#17A2B8',
    won: '#28A745',
    lost: '#DC3545',
  };
  
  const color = stageColors[stage] || '#64748B';
  const label = stage?.charAt(0).toUpperCase() + stage?.slice(1) || 'Unknown';
  
  return (
    <Chip
      label={label}
      size="small"
      sx={{
        bgcolor: `${color}20`,
        color: color,
        fontWeight: 500,
      }}
    />
  );
};

const ValueField = ({ value }) => {
  if (!value) return <Typography color="text.secondary">—</Typography>;
  
  return (
    <Typography variant="body2" fontWeight={600} color="primary.main">
      €{value.toLocaleString()}
    </Typography>
  );
};

const ListActions = ({ viewMode, onViewChange }) => (
  <TopToolbar sx={{ gap: 1 }}>
    <ToggleButtonGroup
      value={viewMode}
      exclusive
      onChange={onViewChange}
      size="small"
    >
      <ToggleButton value="list">
        <ListIcon fontSize="small" />
      </ToggleButton>
      <ToggleButton value="kanban">
        <KanbanIcon fontSize="small" />
      </ToggleButton>
    </ToggleButtonGroup>
    <FilterButton />
    <CreateButton label="Create Deal" />
  </TopToolbar>
);

const KanbanPlaceholder = () => (
  <Card sx={{ textAlign: 'center', py: 6, mt: 2 }}>
    <CardContent>
      <KanbanIcon sx={{ fontSize: 48, color: 'text.secondary', mb: 2 }} />
      <Typography variant="h6" color="text.secondary" gutterBottom>
        Kanban Board
      </Typography>
      <Typography variant="body2" color="text.secondary">
        The drag-and-drop Kanban board will be implemented in a later phase.
        <br />
        Switch to List view to see deals.
      </Typography>
    </CardContent>
  </Card>
);

const DealList = () => {
  const [viewMode, setViewMode] = useState('list');
  const refresh = useRefresh();

  const handleViewChange = (event, newValue) => {
    if (newValue) setViewMode(newValue);
  };

  return (
    <Box sx={{ p: 2 }}>
      {/* Page Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Box>
          <Typography variant="h4" sx={{ fontWeight: 300 }}>
            Deals
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Manage your sales pipeline
          </Typography>
        </Box>
        <Tooltip title="Refresh">
          <IconButton onClick={refresh}>
            <RefreshIcon />
          </IconButton>
        </Tooltip>
      </Box>

      {viewMode === 'kanban' ? (
        <KanbanPlaceholder />
      ) : (
        <List
          filters={dealFilters}
          actions={<ListActions viewMode={viewMode} onViewChange={handleViewChange} />}
          sort={{ field: 'created_at', order: 'DESC' }}
          perPage={25}
          empty={
            <Card sx={{ textAlign: 'center', py: 6 }}>
              <CardContent>
                <Typography variant="h6" color="text.secondary" gutterBottom>
                  No Deals Yet
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Deals will appear here when connected to the backend.
                </Typography>
              </CardContent>
            </Card>
          }
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
            }}
          >
            <TextField source="title" label="Deal" />
            <FunctionField
              label="Pipeline"
              render={(record) => <PipelineChip pipelineId={record?.pipeline_id} />}
            />
            <FunctionField
              label="Stage"
              render={(record) => <StageChip stage={record?.stage} />}
            />
            <FunctionField
              label="Value"
              render={(record) => <ValueField value={record?.value} />}
            />
            <TextField source="contact_name" label="Contact" emptyText="—" />
            <DateField source="expected_close" label="Expected Close" />
            <DateField source="created_at" label="Created" showTime={false} />
          </Datagrid>
        </List>
      )}
    </Box>
  );
};

export default DealList;
