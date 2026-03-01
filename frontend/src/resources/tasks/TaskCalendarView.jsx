import { useState, useCallback } from 'react';
import {
  Box, Typography, Chip, Card, CardContent,
  Dialog, DialogTitle, DialogContent, IconButton, CircularProgress,
} from '@mui/material';
import { Close as CloseIcon, Person as PersonIcon } from '@mui/icons-material';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin from '@fullcalendar/interaction';
import listPlugin from '@fullcalendar/list';
import { getTasksCalendar } from '../../providers/dataProvider';

const PRIORITY_COLORS = {
  critical: '#DC2626',
  high: '#EF4444',
  medium: '#F59E0B',
  low: '#64748B',
};

const ASSIGNEE_COLORS = [
  '#4A90A4', '#6C5CE7', '#28A745', '#E84393',
  '#00B894', '#FDCB6E', '#E17055', '#0984E3',
];

const getAssigneeColor = (assignee, assigneeMap) => {
  if (!assignee) return '#64748B';
  if (!assigneeMap.has(assignee)) {
    assigneeMap.set(assignee, ASSIGNEE_COLORS[assigneeMap.size % ASSIGNEE_COLORS.length]);
  }
  return assigneeMap.get(assignee);
};

const TaskDetailPopup = ({ task, open, onClose }) => {
  if (!task) return null;

  const priorityColor = PRIORITY_COLORS[task.priority] || PRIORITY_COLORS.medium;

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', pb: 1 }}>
        <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>{task.title}</Typography>
        <IconButton onClick={onClose} size="small"><CloseIcon /></IconButton>
      </DialogTitle>
      <DialogContent>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
          {task.description && (
            <Typography variant="body2" color="text.secondary">{task.description}</Typography>
          )}

          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
            <Chip label={task.priority} size="small" sx={{ bgcolor: `${priorityColor}20`, color: priorityColor, fontWeight: 600, textTransform: 'capitalize' }} />
            <Chip label={task.status} size="small" sx={{ textTransform: 'capitalize' }} />
            {task.task_type && <Chip label={task.task_type} size="small" variant="outlined" />}
          </Box>

          {task.assigned_to && (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <PersonIcon sx={{ fontSize: 16, color: 'text.secondary' }} />
              <Typography variant="body2">{task.assigned_to}</Typography>
            </Box>
          )}

          {task.lead_email && (
            <Typography variant="body2" color="text.secondary">
              Lead: {task.lead_name?.trim() || task.lead_email}
            </Typography>
          )}

          {task.deal_name && (
            <Typography variant="body2" color="text.secondary">
              Deal: {task.deal_name}
            </Typography>
          )}

          {task.due_date && (
            <Typography variant="body2" color="text.secondary">
              Due: {new Date(task.due_date).toLocaleString('de-DE')}
            </Typography>
          )}
        </Box>
      </DialogContent>
    </Dialog>
  );
};

const TaskCalendarView = ({ onCreateTask, assigneeFilter }) => {
  const [selectedTask, setSelectedTask] = useState(null);
  const [loading, setLoading] = useState(false);
  const assigneeMap = new Map();

  const fetchEvents = useCallback(async (fetchInfo, successCallback, failureCallback) => {
    setLoading(true);
    try {
      const result = await getTasksCalendar(
        fetchInfo.startStr,
        fetchInfo.endStr,
        assigneeFilter
      );
      const events = (result.data || []).map(task => {
        const color = getAssigneeColor(task.assigned_to, assigneeMap);
        const borderColor = PRIORITY_COLORS[task.priority] || PRIORITY_COLORS.medium;
        return {
          id: task.id,
          title: task.title,
          start: task.due_date,
          backgroundColor: color,
          borderColor: borderColor,
          textColor: '#fff',
          extendedProps: task,
        };
      });
      successCallback(events);
    } catch (err) {
      failureCallback(err);
    } finally {
      setLoading(false);
    }
  }, [assigneeFilter]);

  const handleEventClick = (info) => {
    setSelectedTask(info.event.extendedProps);
  };

  const handleDateClick = (info) => {
    onCreateTask?.({ defaultDueDate: info.dateStr });
  };

  return (
    <Box sx={{ position: 'relative' }}>
      {loading && (
        <Box sx={{ position: 'absolute', top: 8, right: 8, zIndex: 10 }}>
          <CircularProgress size={20} />
        </Box>
      )}

      <Card sx={{ p: 2, bgcolor: 'background.paper' }}>
        <FullCalendar
          plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin, listPlugin]}
          initialView="dayGridMonth"
          headerToolbar={{
            left: 'prev,next today',
            center: 'title',
            right: 'dayGridMonth,timeGridWeek,listWeek',
          }}
          events={fetchEvents}
          eventClick={handleEventClick}
          dateClick={handleDateClick}
          height="auto"
          locale="de"
          firstDay={1}
          eventDisplay="block"
          dayMaxEvents={3}
          nowIndicator
        />
      </Card>

      <TaskDetailPopup
        task={selectedTask}
        open={!!selectedTask}
        onClose={() => setSelectedTask(null)}
      />
    </Box>
  );
};

export default TaskCalendarView;
