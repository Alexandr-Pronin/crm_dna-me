import { useState, useEffect, useCallback } from 'react';
import {
  Box, Typography, Chip, IconButton, Tooltip, Collapse,
  Checkbox, Card, CardContent, CircularProgress, Divider,
} from '@mui/material';
import {
  ExpandMore as ExpandIcon,
  ExpandLess as CollapseIcon,
  Person as PersonIcon,
  Link as LinkIcon,
  AccessTime as TimeIcon,
} from '@mui/icons-material';
import { getTasksGrouped, completeTask, updateTask } from '../../providers/dataProvider';

const PRIORITY_COLORS = {
  critical: '#DC2626',
  high: '#EF4444',
  medium: '#F59E0B',
  low: '#64748B',
};

const STATUS_COLORS = {
  open: '#4A90A4',
  in_progress: '#F59E0B',
  completed: '#28A745',
  cancelled: '#64748B',
};

const TaskItem = ({ task, onStatusChange }) => {
  const isCompleted = task.status === 'completed';
  const isOverdue = task.due_date && new Date(task.due_date) < new Date() && !isCompleted;
  const priorityColor = PRIORITY_COLORS[task.priority] || PRIORITY_COLORS.medium;

  const handleToggle = async () => {
    if (isCompleted) {
      await updateTask(task.id, { status: 'open' });
    } else {
      await completeTask(task.id);
    }
    onStatusChange?.();
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return null;
    return new Date(dateStr).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
  };

  return (
    <Box
      sx={{
        display: 'flex', alignItems: 'flex-start', gap: 1.5, py: 1.5, px: 2,
        borderLeft: `3px solid ${priorityColor}`,
        bgcolor: isOverdue ? 'rgba(239,68,68,0.05)' : 'transparent',
        opacity: isCompleted ? 0.6 : 1,
        '&:hover': { bgcolor: 'rgba(255,255,255,0.03)' },
        borderRadius: 1, mb: 0.5,
      }}
    >
      <Checkbox
        checked={isCompleted}
        onChange={handleToggle}
        size="small"
        sx={{ mt: -0.5, color: priorityColor, '&.Mui-checked': { color: '#28A745' } }}
      />

      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography
          variant="body2"
          sx={{
            fontWeight: 500,
            textDecoration: isCompleted ? 'line-through' : 'none',
            color: isCompleted ? 'text.secondary' : 'text.primary',
          }}
        >
          {task.title}
        </Typography>

        <Box sx={{ display: 'flex', gap: 1, mt: 0.5, flexWrap: 'wrap', alignItems: 'center' }}>
          {task.lead_email && (
            <Chip
              icon={<PersonIcon sx={{ fontSize: 14 }} />}
              label={task.lead_name?.trim() || task.lead_email}
              size="small"
              variant="outlined"
              sx={{ height: 22, fontSize: 11 }}
            />
          )}
          {task.deal_name && (
            <Chip
              icon={<LinkIcon sx={{ fontSize: 14 }} />}
              label={task.deal_name}
              size="small"
              variant="outlined"
              sx={{ height: 22, fontSize: 11 }}
            />
          )}
        </Box>
      </Box>

      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexShrink: 0 }}>
        <Chip
          label={task.priority}
          size="small"
          sx={{
            bgcolor: `${priorityColor}20`, color: priorityColor,
            fontWeight: 600, fontSize: 11, height: 22,
            textTransform: 'capitalize',
          }}
        />
        {task.due_date && (
          <Chip
            icon={<TimeIcon sx={{ fontSize: 14 }} />}
            label={formatDate(task.due_date)}
            size="small"
            sx={{
              height: 22, fontSize: 11,
              bgcolor: isOverdue ? 'rgba(239,68,68,0.15)' : 'transparent',
              color: isOverdue ? '#EF4444' : 'text.secondary',
              border: isOverdue ? '1px solid rgba(239,68,68,0.3)' : '1px solid rgba(255,255,255,0.1)',
            }}
          />
        )}
      </Box>
    </Box>
  );
};

const AssigneeGroup = ({ assignee, tasks, onStatusChange }) => {
  const [expanded, setExpanded] = useState(true);
  const openCount = tasks.filter(t => t.status !== 'completed' && t.status !== 'cancelled').length;

  return (
    <Card sx={{ mb: 2, bgcolor: 'background.paper' }}>
      <Box
        sx={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          px: 2, py: 1.5, cursor: 'pointer',
          '&:hover': { bgcolor: 'rgba(255,255,255,0.02)' },
        }}
        onClick={() => setExpanded(!expanded)}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <PersonIcon sx={{ fontSize: 20, color: 'primary.main' }} />
          <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
            {assignee === 'unassigned' ? 'Unassigned' : assignee}
          </Typography>
          <Chip label={`${openCount} open`} size="small" sx={{ height: 20, fontSize: 11 }} />
        </Box>
        <IconButton size="small">
          {expanded ? <CollapseIcon /> : <ExpandIcon />}
        </IconButton>
      </Box>

      <Collapse in={expanded}>
        <Divider />
        <Box sx={{ py: 0.5 }}>
          {tasks.map((task) => (
            <TaskItem key={task.id} task={task} onStatusChange={onStatusChange} />
          ))}
        </Box>
      </Collapse>
    </Card>
  );
};

const TaskListView = ({ filters }) => {
  const [grouped, setGrouped] = useState({});
  const [loading, setLoading] = useState(true);

  const loadTasks = useCallback(async () => {
    setLoading(true);
    try {
      const result = await getTasksGrouped({
        status: filters?.status,
        priority: filters?.priority,
      });
      setGrouped(result.data || {});
    } catch {
      setGrouped({});
    } finally {
      setLoading(false);
    }
  }, [filters?.status, filters?.priority]);

  useEffect(() => { loadTasks(); }, [loadTasks]);

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
        <CircularProgress />
      </Box>
    );
  }

  const assignees = Object.keys(grouped);

  if (assignees.length === 0) {
    return (
      <Card sx={{ textAlign: 'center', py: 6 }}>
        <CardContent>
          <Typography variant="h6" color="text.secondary">No Tasks</Typography>
          <Typography variant="body2" color="text.secondary">
            Create a task to get started.
          </Typography>
        </CardContent>
      </Card>
    );
  }

  return (
    <Box>
      {assignees.map((assignee) => (
        <AssigneeGroup
          key={assignee}
          assignee={assignee}
          tasks={grouped[assignee]}
          onStatusChange={loadTasks}
        />
      ))}
    </Box>
  );
};

export default TaskListView;
