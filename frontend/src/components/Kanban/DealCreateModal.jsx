/**
 * Deal Create Modal
 * Modal für die Erstellung eines neuen Deals
 */
import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box,
  Typography,
  TextField,
  Grid,
  IconButton,
  CircularProgress,
  Alert,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Divider,
} from '@mui/material';
import {
  Close as CloseIcon,
  Add as AddIcon,
} from '@mui/icons-material';
import { useDataProvider, useNotify } from 'react-admin';

const DealCreateModal = ({ open, onClose, selectedPipelineId, onDealCreated }) => {
  const [pipelines, setPipelines] = useState([]);
  const [stages, setStages] = useState([]);
  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  
  // Form state
  const [formData, setFormData] = useState({
    lead_id: '',
    pipeline_id: selectedPipelineId || '',
    stage_id: '',
    name: '',
    value: '',
    currency: 'EUR',
    expected_close_date: '',
  });

  const dataProvider = useDataProvider();
  const notify = useNotify();

  // Load initial data
  useEffect(() => {
    if (!open) return;

    const loadInitialData = async () => {
      setLoading(true);
      setError(null);
      try {
        const [pipelinesRes, leadsRes] = await Promise.all([
          dataProvider.getList('pipelines', {
            pagination: { page: 1, perPage: 100 },
            sort: { field: 'name', order: 'ASC' },
            filter: {},
          }),
          dataProvider.getList('leads', {
            pagination: { page: 1, perPage: 100 },
            sort: { field: 'email', order: 'ASC' },
            filter: {},
          }),
        ]);
        
        setPipelines(pipelinesRes.data || []);
        setLeads(leadsRes.data || []);
        
        // Set default pipeline if provided
        if (selectedPipelineId) {
          setFormData(prev => ({ ...prev, pipeline_id: selectedPipelineId }));
        } else if (pipelinesRes.data?.length > 0) {
          setFormData(prev => ({ ...prev, pipeline_id: pipelinesRes.data[0].id }));
        }
      } catch (err) {
        console.error('Failed to load data:', err);
        setError('Fehler beim Laden der Daten');
      } finally {
        setLoading(false);
      }
    };

    loadInitialData();
  }, [open, selectedPipelineId, dataProvider]);

  // Load stages when pipeline changes
  useEffect(() => {
    if (!formData.pipeline_id) {
      setStages([]);
      return;
    }

    const loadStages = async () => {
      try {
        const { data } = await dataProvider.getList(`pipelines/${formData.pipeline_id}/stages`, {
          pagination: { page: 1, perPage: 50 },
          sort: { field: 'position', order: 'ASC' },
          filter: {},
        });
        setStages(data || []);
        
        // Auto-select first stage if available
        if (data?.length > 0 && !formData.stage_id) {
          setFormData(prev => ({ ...prev, stage_id: data[0].id }));
        }
      } catch (err) {
        console.error('Failed to load stages:', err);
        setStages([]);
      }
    };

    loadStages();
  }, [formData.pipeline_id, dataProvider]);

  const handleChange = (field) => (event) => {
    const value = event.target.value;
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!formData.lead_id || !formData.pipeline_id) {
      setError('Lead und Pipeline sind erforderlich');
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const payload = {
        lead_id: formData.lead_id,
        pipeline_id: formData.pipeline_id,
        ...(formData.stage_id && { stage_id: formData.stage_id }),
        ...(formData.name && { name: formData.name }),
        ...(formData.value && { value: parseFloat(formData.value) }),
        currency: formData.currency,
        ...(formData.expected_close_date && { expected_close_date: formData.expected_close_date }),
      };

      const { data } = await dataProvider.create('deals', { data: payload });
      
      notify('Deal erfolgreich erstellt', { type: 'success' });
      
      if (onDealCreated) {
        onDealCreated(data);
      }
      
      handleClose();
    } catch (err) {
      console.error('Failed to create deal:', err);
      setError(err.message || 'Fehler beim Erstellen des Deals');
      notify('Fehler beim Erstellen des Deals', { type: 'error' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleClose = () => {
    if (submitting) return;
    
    setFormData({
      lead_id: '',
      pipeline_id: selectedPipelineId || '',
      stage_id: '',
      name: '',
      value: '',
      currency: 'EUR',
      expected_close_date: '',
    });
    setError(null);
    onClose();
  };

  const pipelineChoices = pipelines.map(p => ({ id: p.id, name: p.name }));
  const stageChoices = stages.map(s => ({ id: s.id, name: s.name }));
  const leadChoices = leads.map(l => ({
    id: l.id,
    name: `${l.email}${l.first_name ? ` (${l.first_name} ${l.last_name || ''})` : ''}`.trim(),
  }));

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      maxWidth="md"
      fullWidth
      PaperProps={{
        sx: {
          borderRadius: 3,
          boxShadow: '0 8px 32px rgba(0,0,0,0.12)',
        },
      }}
    >
      <DialogTitle
        sx={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          pb: 2,
          borderBottom: '1px solid',
          borderColor: 'divider',
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <AddIcon color="primary" />
          <Typography variant="h6" fontWeight={600}>
            Neuen Deal erstellen
          </Typography>
        </Box>
        <IconButton
          onClick={handleClose}
          disabled={submitting}
          size="small"
          sx={{
            color: 'text.secondary',
            '&:hover': {
              bgcolor: 'action.hover',
            },
          }}
        >
          <CloseIcon />
        </IconButton>
      </DialogTitle>

      <DialogContent sx={{ pt: 3 }}>
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
            <CircularProgress />
          </Box>
        ) : (
          <form id="deal-create-form" onSubmit={handleSubmit}>
            {error && (
              <Alert severity="error" sx={{ mb: 3 }}>
                {error}
              </Alert>
            )}

            <Grid container spacing={3}>
              {/* Lead Selection */}
              <Grid item xs={12}>
                <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1.5, fontWeight: 600 }}>
                  Lead Information
                </Typography>
                <FormControl fullWidth required>
                  <InputLabel>Lead</InputLabel>
                  <Select
                    value={formData.lead_id}
                    onChange={handleChange('lead_id')}
                    label="Lead"
                  >
                    {leadChoices.map((lead) => (
                      <MenuItem key={lead.id} value={lead.id}>
                        {lead.name}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>

              <Grid item xs={12}>
                <Divider />
              </Grid>

              {/* Pipeline & Stage */}
              <Grid item xs={12}>
                <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1.5, fontWeight: 600 }}>
                  Pipeline
                </Typography>
                <Grid container spacing={2}>
                  <Grid item xs={12} sm={6}>
                    <FormControl fullWidth required>
                      <InputLabel>Pipeline</InputLabel>
                      <Select
                        value={formData.pipeline_id}
                        onChange={handleChange('pipeline_id')}
                        label="Pipeline"
                      >
                        {pipelineChoices.map((pipeline) => (
                          <MenuItem key={pipeline.id} value={pipeline.id}>
                            {pipeline.name}
                          </MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <FormControl fullWidth>
                      <InputLabel>Stage</InputLabel>
                      <Select
                        value={formData.stage_id}
                        onChange={handleChange('stage_id')}
                        label="Stage"
                        disabled={!formData.pipeline_id || stages.length === 0}
                      >
                        {stageChoices.map((stage) => (
                          <MenuItem key={stage.id} value={stage.id}>
                            {stage.name}
                          </MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                  </Grid>
                </Grid>
              </Grid>

              <Grid item xs={12}>
                <Divider />
              </Grid>

              {/* Deal Details */}
              <Grid item xs={12}>
                <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1.5, fontWeight: 600 }}>
                  Deal Details
                </Typography>
                <Grid container spacing={2}>
                  <Grid item xs={12}>
                    <TextField
                      fullWidth
                      label="Deal Name"
                      value={formData.name}
                      onChange={handleChange('name')}
                      helperText="Optional - wird automatisch generiert falls leer"
                    />
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <TextField
                      fullWidth
                      type="number"
                      label="Wert"
                      value={formData.value}
                      onChange={handleChange('value')}
                      inputProps={{ min: 0, step: 0.01 }}
                    />
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <FormControl fullWidth>
                      <InputLabel>Währung</InputLabel>
                      <Select
                        value={formData.currency}
                        onChange={handleChange('currency')}
                        label="Währung"
                      >
                        <MenuItem value="EUR">EUR (€)</MenuItem>
                        <MenuItem value="USD">USD ($)</MenuItem>
                        <MenuItem value="GBP">GBP (£)</MenuItem>
                        <MenuItem value="CHF">CHF</MenuItem>
                      </Select>
                    </FormControl>
                  </Grid>
                  <Grid item xs={12}>
                    <TextField
                      fullWidth
                      type="date"
                      label="Erwartetes Abschlussdatum"
                      value={formData.expected_close_date}
                      onChange={handleChange('expected_close_date')}
                      InputLabelProps={{
                        shrink: true,
                      }}
                    />
                  </Grid>
                </Grid>
              </Grid>
            </Grid>
          </form>
        )}
      </DialogContent>

      <DialogActions
        sx={{
          px: 3,
          py: 2,
          borderTop: '1px solid',
          borderColor: 'divider',
        }}
      >
        <Button
          onClick={handleClose}
          disabled={submitting}
          sx={{ color: 'text.secondary' }}
        >
          Abbrechen
        </Button>
        <Button
          type="submit"
          form="deal-create-form"
          variant="contained"
          disabled={submitting || !formData.lead_id || !formData.pipeline_id}
          startIcon={submitting ? <CircularProgress size={16} /> : <AddIcon />}
          sx={{
            bgcolor: 'primary.main',
            '&:hover': {
              bgcolor: 'primary.dark',
            },
          }}
        >
          {submitting ? 'Wird erstellt...' : 'Deal erstellen'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default DealCreateModal;
