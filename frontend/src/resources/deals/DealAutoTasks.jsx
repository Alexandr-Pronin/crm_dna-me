import { useState, useEffect } from 'react';
import {
  Box, Typography, Card, CardContent, Button, IconButton,
  Chip, Dialog, DialogTitle, DialogContent, DialogActions,
  TextField, MenuItem, CircularProgress, Switch, FormControlLabel,
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  AutoFixHigh as AutoIcon,
  Close as CloseIcon,
} from '@mui/icons-material';
import {
  getAutomationRules, createAutomationRule, updateAutomationRule, deleteAutomationRule,
} from '../../providers/dataProvider';

const TRIGGER_TYPES = [
  { value: 'stage_change', label: 'Stage Change' },
  { value: 'score_threshold', label: 'Score Threshold' },
  { value: 'intent_detected', label: 'Intent Detected' },
  { value: 'event', label: 'Event Received' },
];

const ASSIGN_STRATEGIES = [
  { value: 'lead_owner', label: 'Lead Owner' },
  { value: 'deal_owner', label: 'Deal Owner' },
  { value: 'round_robin', label: 'Round Robin' },
  { value: 'specific', label: 'Specific Person' },
];

const PRIORITY_OPTIONS = ['low', 'medium', 'high', 'critical'];

const TEMPLATE_VARS = [
  '{lead_name}', '{lead_email}', '{deal_name}',
  '{deal_value}', '{pipeline_name}', '{stage_name}',
  '{assigned_to}', '{trigger_date}',
];

const AutoTaskRuleDialog = ({ open, onClose, onSave, rule, pipelineId }) => {
  const [form, setForm] = useState({
    name: '',
    description: '',
    trigger_type: 'stage_change',
    trigger_stage: '',
    trigger_score: 40,
    trigger_intent: 'research',
    title_template: '',
    description_template: '',
    assign_strategy: 'lead_owner',
    assign_to: '',
    priority: 'medium',
    due_days_offset: 2,
    is_active: true,
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      if (rule) {
        setForm({
          name: rule.name || '',
          description: rule.description || '',
          trigger_type: rule.trigger_type || 'stage_change',
          trigger_stage: rule.trigger_config?.to_stage || '',
          trigger_score: rule.trigger_config?.threshold || 40,
          trigger_intent: rule.trigger_config?.intent || 'research',
          title_template: rule.action_config?.title_template || '',
          description_template: rule.action_config?.description_template || '',
          assign_strategy: rule.action_config?.assign_strategy || 'lead_owner',
          assign_to: rule.action_config?.assign_to || '',
          priority: rule.action_config?.priority || 'medium',
          due_days_offset: rule.action_config?.due_days_offset || 2,
          is_active: rule.is_active !== false,
        });
      } else {
        setForm({
          name: '', description: '', trigger_type: 'stage_change', trigger_stage: '',
          trigger_score: 40, trigger_intent: 'research', title_template: '',
          description_template: '', assign_strategy: 'lead_owner', assign_to: '',
          priority: 'medium', due_days_offset: 2, is_active: true,
        });
      }
    }
  }, [open, rule]);

  const handleChange = (field) => (e) => {
    const value = e.target.type === 'checkbox' ? e.target.checked : e.target.value;
    setForm(prev => ({ ...prev, [field]: value }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const triggerConfig = {};
      if (form.trigger_type === 'stage_change') triggerConfig.to_stage = form.trigger_stage;
      if (form.trigger_type === 'score_threshold') triggerConfig.threshold = Number(form.trigger_score);
      if (form.trigger_type === 'intent_detected') triggerConfig.intent = form.trigger_intent;

      const ruleData = {
        name: form.name,
        description: form.description || undefined,
        is_active: form.is_active,
        pipeline_id: pipelineId || undefined,
        trigger_type: form.trigger_type,
        trigger_config: triggerConfig,
        action_type: 'create_task',
        action_config: {
          title_template: form.title_template,
          description_template: form.description_template || undefined,
          assign_strategy: form.assign_strategy,
          assign_to: form.assign_strategy === 'specific' ? form.assign_to : undefined,
          priority: form.priority,
          due_days_offset: Number(form.due_days_offset),
        },
      };

      if (rule?.id) {
        await updateAutomationRule(rule.id, ruleData);
      } else {
        await createAutomationRule(ruleData);
      }
      onSave?.();
      onClose();
    } catch (err) {
      console.error('Failed to save rule:', err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between' }}>
        <Typography variant="h6">{rule ? 'Edit' : 'New'} Auto-Task Rule</Typography>
        <IconButton onClick={onClose} size="small"><CloseIcon /></IconButton>
      </DialogTitle>

      <DialogContent dividers>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
          <TextField label="Rule Name" value={form.name} onChange={handleChange('name')} fullWidth required />
          <TextField label="Description" value={form.description} onChange={handleChange('description')} fullWidth multiline rows={2} />

          <Typography variant="subtitle2" sx={{ mt: 1 }}>Trigger</Typography>
          <TextField select label="Trigger Type" value={form.trigger_type} onChange={handleChange('trigger_type')} fullWidth>
            {TRIGGER_TYPES.map(t => <MenuItem key={t.value} value={t.value}>{t.label}</MenuItem>)}
          </TextField>

          {form.trigger_type === 'stage_change' && (
            <TextField label="Target Stage Slug" value={form.trigger_stage} onChange={handleChange('trigger_stage')} fullWidth placeholder="e.g. consultation" />
          )}
          {form.trigger_type === 'score_threshold' && (
            <TextField label="Score Threshold" type="number" value={form.trigger_score} onChange={handleChange('trigger_score')} fullWidth />
          )}
          {form.trigger_type === 'intent_detected' && (
            <TextField select label="Intent" value={form.trigger_intent} onChange={handleChange('trigger_intent')} fullWidth>
              <MenuItem value="research">Research</MenuItem>
              <MenuItem value="b2b">B2B</MenuItem>
              <MenuItem value="co_creation">Co-Creation</MenuItem>
            </TextField>
          )}

          <Typography variant="subtitle2" sx={{ mt: 1 }}>Task Template</Typography>
          <TextField label="Task Title Template" value={form.title_template} onChange={handleChange('title_template')} fullWidth required placeholder="Follow-up with {lead_name}" />
          <TextField label="Task Description Template" value={form.description_template} onChange={handleChange('description_template')} fullWidth multiline rows={2} />

          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
            <Typography variant="caption" color="text.secondary">Variables: </Typography>
            {TEMPLATE_VARS.map(v => <Chip key={v} label={v} size="small" variant="outlined" sx={{ fontSize: 11, height: 22 }} />)}
          </Box>

          <Box sx={{ display: 'flex', gap: 2 }}>
            <TextField select label="Assign Strategy" value={form.assign_strategy} onChange={handleChange('assign_strategy')} fullWidth>
              {ASSIGN_STRATEGIES.map(s => <MenuItem key={s.value} value={s.value}>{s.label}</MenuItem>)}
            </TextField>
            <TextField select label="Priority" value={form.priority} onChange={handleChange('priority')} fullWidth>
              {PRIORITY_OPTIONS.map(p => <MenuItem key={p} value={p} sx={{ textTransform: 'capitalize' }}>{p}</MenuItem>)}
            </TextField>
          </Box>

          {form.assign_strategy === 'specific' && (
            <TextField label="Assign To (email)" value={form.assign_to} onChange={handleChange('assign_to')} fullWidth />
          )}

          <TextField label="Due Days After Trigger" type="number" value={form.due_days_offset} onChange={handleChange('due_days_offset')} fullWidth />

          <FormControlLabel control={<Switch checked={form.is_active} onChange={handleChange('is_active')} />} label="Active" />
        </Box>
      </DialogContent>

      <DialogActions sx={{ px: 3, py: 2 }}>
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="contained" onClick={handleSave} disabled={saving || !form.name || !form.title_template}>
          {saving ? <CircularProgress size={16} /> : rule ? 'Update Rule' : 'Create Rule'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

const DealAutoTasks = ({ dealId, pipelineId }) => {
  const [rules, setRules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editRule, setEditRule] = useState(null);

  const loadRules = async () => {
    setLoading(true);
    try {
      const result = await getAutomationRules({
        action_type: 'create_task',
        pipeline_id: pipelineId,
      });
      setRules(result.data || []);
    } catch {
      setRules([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadRules(); }, [pipelineId]);

  const handleEdit = (rule) => {
    setEditRule(rule);
    setDialogOpen(true);
  };

  const handleCreate = () => {
    setEditRule(null);
    setDialogOpen(true);
  };

  const handleDelete = async (ruleId) => {
    try {
      await deleteAutomationRule(ruleId);
      await loadRules();
    } catch (err) {
      console.error('Failed to delete rule:', err);
    }
  };

  if (loading) {
    return <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}><CircularProgress size={24} /></Box>;
  }

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="subtitle2">
          Auto-Task Rules ({rules.length})
        </Typography>
        <Button startIcon={<AddIcon />} onClick={handleCreate} size="small" variant="outlined">
          New Auto-Task Rule
        </Button>
      </Box>

      {rules.length === 0 ? (
        <Card sx={{ textAlign: 'center', py: 4 }}>
          <CardContent>
            <AutoIcon sx={{ fontSize: 40, color: 'text.secondary', mb: 1 }} />
            <Typography variant="body2" color="text.secondary">
              No auto-task rules configured for this pipeline.
            </Typography>
          </CardContent>
        </Card>
      ) : (
        rules.map((rule) => (
          <Card key={rule.id} sx={{ mb: 1.5, bgcolor: 'background.default' }}>
            <CardContent sx={{ py: 1.5, '&:last-child': { pb: 1.5 } }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Box>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <AutoIcon sx={{ fontSize: 18, color: rule.is_active ? 'primary.main' : 'text.disabled' }} />
                    <Typography variant="body2" sx={{ fontWeight: 500 }}>{rule.name}</Typography>
                    {!rule.is_active && <Chip label="Inactive" size="small" sx={{ height: 18, fontSize: 10 }} />}
                  </Box>
                  <Typography variant="caption" color="text.secondary" sx={{ ml: 3.5 }}>
                    Trigger: {rule.trigger_type} → Task: {rule.action_config?.title_template || '—'}
                  </Typography>
                  <Box sx={{ display: 'flex', gap: 0.5, ml: 3.5, mt: 0.5 }}>
                    <Chip label={`Priority: ${rule.action_config?.priority || 'medium'}`} size="small" sx={{ height: 18, fontSize: 10 }} />
                    <Chip label={`Due: +${rule.action_config?.due_days_offset || 0} days`} size="small" sx={{ height: 18, fontSize: 10 }} />
                    <Chip label={`Assign: ${rule.action_config?.assign_strategy || 'lead_owner'}`} size="small" sx={{ height: 18, fontSize: 10 }} />
                  </Box>
                </Box>
                <Box>
                  <IconButton size="small" onClick={() => handleEdit(rule)}><EditIcon fontSize="small" /></IconButton>
                  <IconButton size="small" onClick={() => handleDelete(rule.id)}><DeleteIcon fontSize="small" /></IconButton>
                </Box>
              </Box>
            </CardContent>
          </Card>
        ))
      )}

      <AutoTaskRuleDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        onSave={loadRules}
        rule={editRule}
        pipelineId={pipelineId}
      />
    </Box>
  );
};

export default DealAutoTasks;
