import { useState, useEffect } from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions,
  TextField, Button, Box, MenuItem, Autocomplete, IconButton,
  Typography, Chip, CircularProgress,
} from '@mui/material';
import { Close as CloseIcon } from '@mui/icons-material';
import { createTask, getTeamMembers } from '../../providers/dataProvider';

const PRIORITY_OPTIONS = [
  { value: 'low', label: 'Low', color: '#64748B' },
  { value: 'medium', label: 'Medium', color: '#F59E0B' },
  { value: 'high', label: 'High', color: '#EF4444' },
  { value: 'critical', label: 'Critical', color: '#DC2626' },
];

const TASK_TYPE_OPTIONS = [
  { value: 'follow_up', label: 'Follow-up' },
  { value: 'call', label: 'Call' },
  { value: 'email', label: 'Email' },
  { value: 'meeting', label: 'Meeting' },
  { value: 'review', label: 'Review' },
  { value: 'other', label: 'Other' },
];

const TaskCreateDialog = ({
  open,
  onClose,
  onSuccess,
  defaultLeadId,
  defaultDealId,
  defaultAssignedTo,
  defaultDescription,
  defaultDueDate,
  defaultPriority,
}) => {
  const [form, setForm] = useState({
    title: '',
    description: '',
    assigned_to: '',
    due_date: '',
    due_time: '',
    priority: 'medium',
    task_type: 'follow_up',
    lead_id: '',
    deal_id: '',
  });
  const [teamMembers, setTeamMembers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (open) {
      setForm({
        title: '',
        description: defaultDescription || '',
        assigned_to: defaultAssignedTo || '',
        due_date: defaultDueDate || '',
        due_time: '',
        priority: defaultPriority || 'medium',
        task_type: 'follow_up',
        lead_id: defaultLeadId || '',
        deal_id: defaultDealId || '',
      });
      setError('');
      loadTeamMembers();
    }
  }, [open, defaultLeadId, defaultDealId, defaultAssignedTo, defaultDescription, defaultDueDate, defaultPriority]);

  const loadTeamMembers = async () => {
    try {
      const result = await getTeamMembers({ limit: 50, is_active: true });
      setTeamMembers(result.data || []);
    } catch {
      setTeamMembers([]);
    }
  };

  const handleChange = (field) => (e) => {
    setForm(prev => ({ ...prev, [field]: e.target.value }));
  };

  const handleSubmit = async () => {
    if (!form.title.trim()) {
      setError('Title is required');
      return;
    }
    if (!form.lead_id && !form.deal_id) {
      setError('Either a Lead or Deal must be linked');
      return;
    }

    setLoading(true);
    setError('');

    try {
      let dueDate = null;
      if (form.due_date) {
        const time = form.due_time || '09:00';
        dueDate = `${form.due_date}T${time}:00.000Z`;
      }

      const taskData = {
        title: form.title.trim(),
        description: form.description.trim() || undefined,
        assigned_to: form.assigned_to || undefined,
        due_date: dueDate || undefined,
        priority: form.priority,
        task_type: form.task_type,
        lead_id: form.lead_id || undefined,
        deal_id: form.deal_id || undefined,
        created_by: 'admin@dna-me.com',
      };

      const result = await createTask(taskData);
      onSuccess?.(result.data);
      onClose();
    } catch (err) {
      setError(err.message || 'Failed to create task');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Typography variant="h6">New Task</Typography>
        <IconButton onClick={onClose} size="small"><CloseIcon /></IconButton>
      </DialogTitle>

      <DialogContent dividers>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
          <TextField
            label="Title"
            value={form.title}
            onChange={handleChange('title')}
            fullWidth
            required
            autoFocus
          />

          <TextField
            label="Description"
            value={form.description}
            onChange={handleChange('description')}
            fullWidth
            multiline
            rows={3}
          />

          <Box sx={{ display: 'flex', gap: 2 }}>
            <TextField
              select
              label="Assigned To"
              value={form.assigned_to}
              onChange={handleChange('assigned_to')}
              fullWidth
            >
              <MenuItem value="">Unassigned</MenuItem>
              {teamMembers.map((m) => (
                <MenuItem key={m.id} value={m.email}>{m.name} ({m.role})</MenuItem>
              ))}
            </TextField>

            <TextField
              select
              label="Priority"
              value={form.priority}
              onChange={handleChange('priority')}
              fullWidth
              required
            >
              {PRIORITY_OPTIONS.map((p) => (
                <MenuItem key={p.value} value={p.value}>
                  <Chip label={p.label} size="small" sx={{ bgcolor: `${p.color}20`, color: p.color, fontWeight: 600 }} />
                </MenuItem>
              ))}
            </TextField>
          </Box>

          <Box sx={{ display: 'flex', gap: 2 }}>
            <TextField
              label="Due Date"
              type="date"
              value={form.due_date}
              onChange={handleChange('due_date')}
              fullWidth
              slotProps={{ inputLabel: { shrink: true } }}
            />
            <TextField
              label="Time"
              type="time"
              value={form.due_time}
              onChange={handleChange('due_time')}
              fullWidth
              slotProps={{ inputLabel: { shrink: true } }}
            />
          </Box>

          <TextField
            select
            label="Task Type"
            value={form.task_type}
            onChange={handleChange('task_type')}
            fullWidth
          >
            {TASK_TYPE_OPTIONS.map((t) => (
              <MenuItem key={t.value} value={t.value}>{t.label}</MenuItem>
            ))}
          </TextField>

          {!defaultLeadId && (
            <TextField
              label="Lead ID"
              value={form.lead_id}
              onChange={handleChange('lead_id')}
              fullWidth
              placeholder="UUID of linked lead"
            />
          )}

          {!defaultDealId && (
            <TextField
              label="Deal ID"
              value={form.deal_id}
              onChange={handleChange('deal_id')}
              fullWidth
              placeholder="UUID of linked deal (optional)"
            />
          )}

          {error && (
            <Typography color="error" variant="body2">{error}</Typography>
          )}
        </Box>
      </DialogContent>

      <DialogActions sx={{ px: 3, py: 2 }}>
        <Button onClick={onClose} disabled={loading}>Cancel</Button>
        <Button
          variant="contained"
          onClick={handleSubmit}
          disabled={loading}
          startIcon={loading ? <CircularProgress size={16} /> : null}
        >
          Create Task
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default TaskCreateDialog;
