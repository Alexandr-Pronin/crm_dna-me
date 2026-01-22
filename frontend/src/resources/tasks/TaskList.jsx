/**
 * Task List Component
 * Connects to REAL API (GET /tasks)
 * TODO: Implement full functionality in later phase
 */
import { useState } from 'react';
import {
  List,
  Datagrid,
  TextField,
  DateField,
  FunctionField,
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
} from '@mui/material';
import {
  Refresh as RefreshIcon,
  CheckCircle as CompletedIcon,
  Schedule as PendingIcon,
  PlayArrow as InProgressIcon,
} from '@mui/icons-material';

const taskFilters = [
  <SearchInput source="q" alwaysOn placeholder="Search tasks..." />,
  <SelectInput
    source="status"
    choices={[
      { id: 'pending', name: 'Pending' },
      { id: 'in_progress', name: 'In Progress' },
      { id: 'completed', name: 'Completed' },
    ]}
  />,
  <SelectInput
    source="priority"
    choices={[
      { id: 'low', name: 'Low' },
      { id: 'medium', name: 'Medium' },
      { id: 'high', name: 'High' },
    ]}
  />,
];

const StatusBadge = ({ status }) => {
  const config = {
    pending: { icon: PendingIcon, color: '#F59E0B', label: 'Pending' },
    in_progress: { icon: InProgressIcon, color: '#4A90A4', label: 'In Progress' },
    completed: { icon: CompletedIcon, color: '#28A745', label: 'Completed' },
  };
  
  const { icon: Icon, color, label } = config[status] || config.pending;
  
  return (
    <Chip
      icon={<Icon sx={{ fontSize: 16 }} />}
      label={label}
      size="small"
      sx={{
        bgcolor: `${color}20`,
        color: color,
        fontWeight: 500,
        '& .MuiChip-icon': { color: color },
      }}
    />
  );
};

const PriorityBadge = ({ priority }) => {
  const colors = {
    low: '#64748B',
    medium: '#F59E0B',
    high: '#EF4444',
  };
  
  const color = colors[priority] || colors.medium;
  
  return (
    <Chip
      label={priority?.charAt(0).toUpperCase() + priority?.slice(1) || 'Medium'}
      size="small"
      sx={{
        bgcolor: `${color}20`,
        color: color,
        fontWeight: 500,
      }}
    />
  );
};

const ListActions = () => (
  <TopToolbar>
    <FilterButton />
    <CreateButton label="Create Task" />
  </TopToolbar>
);

const TaskList = () => {
  const refresh = useRefresh();

  return (
    <Box sx={{ p: 2 }}>
      {/* Page Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Box>
          <Typography variant="h4" sx={{ fontWeight: 300 }}>
            Tasks
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Manage your tasks and to-dos
          </Typography>
        </Box>
        <Tooltip title="Refresh">
          <IconButton onClick={refresh}>
            <RefreshIcon />
          </IconButton>
        </Tooltip>
      </Box>

      {/* Task List */}
      <List
        filters={taskFilters}
        actions={<ListActions />}
        sort={{ field: 'due_date', order: 'ASC' }}
        perPage={25}
        empty={
          <Card sx={{ textAlign: 'center', py: 6 }}>
            <CardContent>
              <Typography variant="h6" color="text.secondary" gutterBottom>
                No Tasks Yet
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Tasks will appear here when connected to the backend.
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
          rowClick="edit"
          bulkActionButtons={false}
          sx={{
            '& .RaDatagrid-headerCell': {
              fontWeight: 600,
              bgcolor: 'background.default',
            },
          }}
        >
          <TextField source="title" label="Title" />
          <TextField source="description" label="Description" />
          <FunctionField
            label="Status"
            render={(record) => <StatusBadge status={record?.status} />}
          />
          <FunctionField
            label="Priority"
            render={(record) => <PriorityBadge priority={record?.priority} />}
          />
          <DateField source="due_date" label="Due Date" />
          <TextField source="assignee" label="Assignee" emptyText="—" />
        </Datagrid>
      </List>
    </Box>
  );
};

export default TaskList;
