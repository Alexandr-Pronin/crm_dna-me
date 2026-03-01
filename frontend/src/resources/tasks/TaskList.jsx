import { useState, useCallback } from 'react';
import {
  Box, Typography, IconButton, Tooltip, ToggleButton, ToggleButtonGroup,
  Button, MenuItem, TextField,
} from '@mui/material';
import {
  Refresh as RefreshIcon,
  ViewList as ListIcon,
  CalendarMonth as CalendarIcon,
  Add as AddIcon,
} from '@mui/icons-material';
import TaskListView from './TaskListView';
import TaskCalendarView from './TaskCalendarView';
import TaskCreateDialog from '../../components/tasks/TaskCreateDialog';

const TaskList = () => {
  const [viewMode, setViewMode] = useState('list');
  const [createOpen, setCreateOpen] = useState(false);
  const [createDefaults, setCreateDefaults] = useState({});
  const [refreshKey, setRefreshKey] = useState(0);
  const [filters, setFilters] = useState({ status: '', priority: '', assignee: '' });

  const handleRefresh = () => setRefreshKey(k => k + 1);

  const handleCreateTask = useCallback((defaults = {}) => {
    setCreateDefaults(defaults);
    setCreateOpen(true);
  }, []);

  const handleTaskCreated = () => {
    handleRefresh();
  };

  return (
    <Box sx={{ p: 2 }}>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Box>
          <Typography variant="h4" sx={{ fontWeight: 300 }}>Tasks</Typography>
          <Typography variant="body2" color="text.secondary">
            Manage your tasks and to-dos
          </Typography>
        </Box>

        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <ToggleButtonGroup
            value={viewMode}
            exclusive
            onChange={(_, v) => v && setViewMode(v)}
            size="small"
          >
            <ToggleButton value="list"><Tooltip title="List View"><ListIcon fontSize="small" /></Tooltip></ToggleButton>
            <ToggleButton value="calendar"><Tooltip title="Calendar View"><CalendarIcon fontSize="small" /></Tooltip></ToggleButton>
          </ToggleButtonGroup>

          <Tooltip title="Refresh">
            <IconButton onClick={handleRefresh}><RefreshIcon /></IconButton>
          </Tooltip>

          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => handleCreateTask()}
            size="small"
          >
            Create Task
          </Button>
        </Box>
      </Box>

      {/* Filters */}
      <Box sx={{ display: 'flex', gap: 2, mb: 3 }}>
        <TextField
          select
          label="Status"
          value={filters.status}
          onChange={(e) => setFilters(f => ({ ...f, status: e.target.value }))}
          size="small"
          sx={{ minWidth: 140 }}
        >
          <MenuItem value="">All</MenuItem>
          <MenuItem value="open">Open</MenuItem>
          <MenuItem value="in_progress">In Progress</MenuItem>
          <MenuItem value="completed">Completed</MenuItem>
        </TextField>

        <TextField
          select
          label="Priority"
          value={filters.priority}
          onChange={(e) => setFilters(f => ({ ...f, priority: e.target.value }))}
          size="small"
          sx={{ minWidth: 140 }}
        >
          <MenuItem value="">All</MenuItem>
          <MenuItem value="critical">Critical</MenuItem>
          <MenuItem value="high">High</MenuItem>
          <MenuItem value="medium">Medium</MenuItem>
          <MenuItem value="low">Low</MenuItem>
        </TextField>
      </Box>

      {/* Content */}
      {viewMode === 'list' ? (
        <TaskListView key={`list-${refreshKey}`} filters={filters} />
      ) : (
        <TaskCalendarView
          key={`cal-${refreshKey}`}
          onCreateTask={handleCreateTask}
          assigneeFilter={filters.assignee || undefined}
        />
      )}

      {/* Create Dialog */}
      <TaskCreateDialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onSuccess={handleTaskCreated}
        defaultDueDate={createDefaults.defaultDueDate}
        defaultLeadId={createDefaults.defaultLeadId}
        defaultDealId={createDefaults.defaultDealId}
      />
    </Box>
  );
};

export default TaskList;
