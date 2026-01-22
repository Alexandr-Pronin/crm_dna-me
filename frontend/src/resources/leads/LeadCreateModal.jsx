/**
 * Lead Create Modal
 * Creates a new lead via POST /leads (REAL API)
 */
import { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Grid,
  Box,
  Typography,
  IconButton,
  CircularProgress,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Alert,
} from '@mui/material';
import { Close as CloseIcon } from '@mui/icons-material';
import { useCreate, useNotify } from 'react-admin';

const LeadCreateModal = ({ open, onClose, onSuccess }) => {
  const [formData, setFormData] = useState({
    email: '',
    first_name: '',
    last_name: '',
    phone: '',
    job_title: '',
    status: 'new',
    lifecycle_stage: 'lead',
    first_touch_source: '',
    first_touch_campaign: '',
    linkedin_url: '',
  });
  const [errors, setErrors] = useState({});
  
  const [create, { isLoading }] = useCreate();
  const notify = useNotify();

  const handleChange = (field) => (e) => {
    setFormData((prev) => ({
      ...prev,
      [field]: e.target.value,
    }));
    // Clear error for this field
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: undefined }));
    }
  };

  const validateForm = () => {
    const newErrors = {};
    
    if (!formData.email) {
      newErrors.email = 'Email is required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = 'Invalid email format';
    }
    
    if (formData.linkedin_url && !formData.linkedin_url.startsWith('http')) {
      newErrors.linkedin_url = 'Must be a valid URL';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validateForm()) return;

    // Clean up empty strings
    const cleanData = Object.fromEntries(
      Object.entries(formData).filter(([_, v]) => v !== '')
    );

    try {
      await create(
        'leads',
        { data: cleanData },
        {
          onSuccess: () => {
            onSuccess?.();
            resetForm();
          },
          onError: (error) => {
            notify(`Error: ${error.message || 'Failed to create lead'}`, { type: 'error' });
          },
        }
      );
    } catch (error) {
      notify(`Error: ${error.message || 'Failed to create lead'}`, { type: 'error' });
    }
  };

  const resetForm = () => {
    setFormData({
      email: '',
      first_name: '',
      last_name: '',
      phone: '',
      job_title: '',
      status: 'new',
      lifecycle_stage: 'lead',
      first_touch_source: '',
      first_touch_campaign: '',
      linkedin_url: '',
    });
    setErrors({});
  };

  const handleClose = () => {
    resetForm();
    onClose?.();
  };

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      maxWidth="sm"
      fullWidth
      PaperProps={{
        sx: {
          bgcolor: 'background.paper',
          backgroundImage: 'none',
        },
      }}
    >
      <DialogTitle>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Typography variant="h6">Create New Lead</Typography>
          <IconButton onClick={handleClose} size="small">
            <CloseIcon />
          </IconButton>
        </Box>
      </DialogTitle>

      <DialogContent dividers>
        <Box sx={{ pt: 1 }}>
          <Grid container spacing={2}>
            {/* Email - Required */}
            <Grid size={12}>
              <TextField
                label="Email"
                value={formData.email}
                onChange={handleChange('email')}
                fullWidth
                required
                error={!!errors.email}
                helperText={errors.email}
                placeholder="lead@company.com"
              />
            </Grid>

            {/* Name Fields */}
            <Grid size={6}>
              <TextField
                label="First Name"
                value={formData.first_name}
                onChange={handleChange('first_name')}
                fullWidth
              />
            </Grid>
            <Grid size={6}>
              <TextField
                label="Last Name"
                value={formData.last_name}
                onChange={handleChange('last_name')}
                fullWidth
              />
            </Grid>

            {/* Contact Info */}
            <Grid size={6}>
              <TextField
                label="Phone"
                value={formData.phone}
                onChange={handleChange('phone')}
                fullWidth
                placeholder="+49 123 456789"
              />
            </Grid>
            <Grid size={6}>
              <TextField
                label="Job Title"
                value={formData.job_title}
                onChange={handleChange('job_title')}
                fullWidth
                placeholder="Lab Director"
              />
            </Grid>

            {/* Status Fields */}
            <Grid size={6}>
              <FormControl fullWidth>
                <InputLabel>Status</InputLabel>
                <Select
                  value={formData.status}
                  onChange={handleChange('status')}
                  label="Status"
                >
                  <MenuItem value="new">New</MenuItem>
                  <MenuItem value="contacted">Contacted</MenuItem>
                  <MenuItem value="qualified">Qualified</MenuItem>
                  <MenuItem value="nurturing">Nurturing</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid size={6}>
              <FormControl fullWidth>
                <InputLabel>Lifecycle Stage</InputLabel>
                <Select
                  value={formData.lifecycle_stage}
                  onChange={handleChange('lifecycle_stage')}
                  label="Lifecycle Stage"
                >
                  <MenuItem value="lead">Lead</MenuItem>
                  <MenuItem value="mql">MQL</MenuItem>
                  <MenuItem value="sql">SQL</MenuItem>
                  <MenuItem value="opportunity">Opportunity</MenuItem>
                </Select>
              </FormControl>
            </Grid>

            {/* Attribution */}
            <Grid size={12}>
              <Typography variant="subtitle2" color="text.secondary" sx={{ mt: 1, mb: 1 }}>
                Attribution
              </Typography>
            </Grid>
            <Grid size={6}>
              <TextField
                label="Source"
                value={formData.first_touch_source}
                onChange={handleChange('first_touch_source')}
                fullWidth
                placeholder="website, linkedin, referral..."
              />
            </Grid>
            <Grid size={6}>
              <TextField
                label="Campaign"
                value={formData.first_touch_campaign}
                onChange={handleChange('first_touch_campaign')}
                fullWidth
                placeholder="q1_email_blast"
              />
            </Grid>

            {/* LinkedIn */}
            <Grid size={12}>
              <TextField
                label="LinkedIn URL"
                value={formData.linkedin_url}
                onChange={handleChange('linkedin_url')}
                fullWidth
                error={!!errors.linkedin_url}
                helperText={errors.linkedin_url}
                placeholder="https://linkedin.com/in/username"
              />
            </Grid>
          </Grid>
        </Box>
      </DialogContent>

      <DialogActions sx={{ px: 3, py: 2 }}>
        <Button onClick={handleClose} color="inherit">
          Cancel
        </Button>
        <Button
          onClick={handleSubmit}
          variant="contained"
          disabled={isLoading}
          startIcon={isLoading ? <CircularProgress size={18} /> : null}
        >
          {isLoading ? 'Creating...' : 'Create Lead'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default LeadCreateModal;
