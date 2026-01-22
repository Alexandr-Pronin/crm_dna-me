/**
 * Scoring Rule Editor Dialog
 * Create/Edit form with Conditions JSON Editor
 * Uses REAL API: POST/PATCH /scoring/rules
 */
import { useState, useEffect, useMemo } from 'react';
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
  Switch,
  FormControlLabel,
  Collapse,
  Divider,
  Paper,
  Tooltip,
  Chip,
  InputAdornment,
} from '@mui/material';
import {
  Close as CloseIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
  Info as InfoIcon,
  Code as CodeIcon,
  AutoFixHigh as AutoFixHighIcon,
} from '@mui/icons-material';
import {
  createScoringRule,
  updateScoringRule,
} from '../../providers/dataProvider';

/**
 * Rule type definitions
 */
const RULE_TYPES = [
  { value: 'event', label: 'Event', description: 'Triggered by marketing events (page_view, click, etc.)' },
  { value: 'field', label: 'Field', description: 'Based on lead profile fields (industry, job_title, etc.)' },
  { value: 'threshold', label: 'Threshold', description: 'Threshold-based rules (visits > 3, etc.)' },
];

/**
 * Category definitions
 */
const CATEGORIES = [
  { value: 'demographic', label: 'Demographic', color: '#4A90A4', description: 'Profile-based scoring (industry, company size, job title)' },
  { value: 'engagement', label: 'Engagement', color: '#6C5CE7', description: 'Activity-based scoring (page views, clicks, downloads)' },
  { value: 'behavior', label: 'Behavior', color: '#28A745', description: 'Pattern-based scoring (multiple visits, combined actions)' },
];

/**
 * Condition templates for quick setup
 */
const CONDITION_TEMPLATES = {
  event: {
    page_view: { event_type: 'page_view', page: '/pricing' },
    form_submit: { event_type: 'form_submit', form_id: 'demo_request' },
    document_download: { event_type: 'document_downloaded' },
    email_opened: { event_type: 'email_opened' },
    email_clicked: { event_type: 'email_clicked' },
    demo_request: { event_type: 'demo_requested' },
    webinar_attended: { event_type: 'webinar_attended' },
  },
  field: {
    industry_match: { field: 'industry', operator: 'in', value: ['biotech', 'pharma', 'healthcare'] },
    company_size: { field: 'employee_count', operator: 'between', value: [50, 500] },
    job_title_contains: { field: 'job_title', operator: 'contains', value: 'Director' },
    has_linkedin: { field: 'linkedin_url', operator: 'exists' },
  },
  threshold: {
    multiple_visits: { metric: 'visits_7_days', operator: '>=', value: 3 },
    high_engagement: { metric: 'total_score', operator: '>=', value: 50 },
    recent_activity: { metric: 'days_since_last_activity', operator: '<=', value: 7 },
  },
};

/**
 * JSON Syntax Highlighter (simple)
 */
const JsonEditor = ({ value, onChange, error, helperText }) => {
  const [localValue, setLocalValue] = useState('');
  const [parseError, setParseError] = useState(null);

  useEffect(() => {
    try {
      setLocalValue(JSON.stringify(value, null, 2));
      setParseError(null);
    } catch (e) {
      setLocalValue(typeof value === 'string' ? value : '{}');
    }
  }, [value]);

  const handleChange = (e) => {
    const newValue = e.target.value;
    setLocalValue(newValue);
    
    try {
      const parsed = JSON.parse(newValue);
      setParseError(null);
      onChange(parsed);
    } catch (e) {
      setParseError('Invalid JSON syntax');
    }
  };

  return (
    <TextField
      fullWidth
      multiline
      minRows={4}
      maxRows={12}
      value={localValue}
      onChange={handleChange}
      error={!!error || !!parseError}
      helperText={parseError || error || helperText}
      placeholder={'{\n  "event_type": "page_view",\n  "page": "/pricing"\n}'}
      InputProps={{
        sx: {
          fontFamily: 'monospace',
          fontSize: '0.85rem',
          bgcolor: 'rgba(0, 0, 0, 0.02)',
        },
      }}
    />
  );
};

/**
 * Template Selector Component
 */
const TemplateSelector = ({ ruleType, onSelect }) => {
  const templates = CONDITION_TEMPLATES[ruleType] || {};
  const templateKeys = Object.keys(templates);

  if (templateKeys.length === 0) return null;

  return (
    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75, mb: 1.5 }}>
      <Typography variant="caption" color="text.secondary" sx={{ width: '100%', mb: 0.5 }}>
        Quick Templates:
      </Typography>
      {templateKeys.map((key) => (
        <Chip
          key={key}
          label={key.replace(/_/g, ' ')}
          size="small"
          variant="outlined"
          onClick={() => onSelect(templates[key])}
          sx={{
            cursor: 'pointer',
            fontSize: '0.7rem',
            '&:hover': {
              bgcolor: 'primary.main',
              color: 'primary.contrastText',
              borderColor: 'primary.main',
            },
          }}
        />
      ))}
    </Box>
  );
};

/**
 * Default form values
 */
const defaultFormData = {
  slug: '',
  name: '',
  description: '',
  rule_type: 'event',
  category: 'engagement',
  conditions: {},
  points: 10,
  max_per_day: null,
  max_per_lead: null,
  decay_days: null,
  priority: 100,
  is_active: true,
};

/**
 * Main Rule Editor Component
 */
const ScoringRuleEditor = ({ 
  open, 
  onClose, 
  onSuccess, 
  rule = null,  // null for create, object for edit
}) => {
  const isEditMode = !!rule;
  
  const [formData, setFormData] = useState(defaultFormData);
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [apiError, setApiError] = useState(null);
  const [showAdvanced, setShowAdvanced] = useState(false);

  // Initialize form when dialog opens or rule changes
  useEffect(() => {
    if (open) {
      if (rule) {
        setFormData({
          slug: rule.slug || '',
          name: rule.name || '',
          description: rule.description || '',
          rule_type: rule.rule_type || 'event',
          category: rule.category || 'engagement',
          conditions: rule.conditions || {},
          points: rule.points ?? 10,
          max_per_day: rule.max_per_day ?? null,
          max_per_lead: rule.max_per_lead ?? null,
          decay_days: rule.decay_days ?? null,
          priority: rule.priority ?? 100,
          is_active: rule.is_active ?? true,
        });
        // Show advanced if any advanced field has a value
        if (rule.max_per_day || rule.max_per_lead || rule.decay_days || rule.priority !== 100) {
          setShowAdvanced(true);
        }
      } else {
        setFormData(defaultFormData);
        setShowAdvanced(false);
      }
      setErrors({});
      setApiError(null);
    }
  }, [open, rule]);

  /**
   * Handle field change
   */
  const handleChange = (field) => (e) => {
    const value = e.target.type === 'checkbox' ? e.target.checked : e.target.value;
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }));
    // Clear error for this field
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: undefined }));
    }
    setApiError(null);
  };

  /**
   * Handle numeric field change
   */
  const handleNumberChange = (field) => (e) => {
    const rawValue = e.target.value;
    const value = rawValue === '' ? null : parseInt(rawValue, 10);
    setFormData((prev) => ({
      ...prev,
      [field]: isNaN(value) ? null : value,
    }));
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: undefined }));
    }
    setApiError(null);
  };

  /**
   * Handle conditions change
   */
  const handleConditionsChange = (conditions) => {
    setFormData((prev) => ({
      ...prev,
      conditions,
    }));
    if (errors.conditions) {
      setErrors((prev) => ({ ...prev, conditions: undefined }));
    }
  };

  /**
   * Apply condition template
   */
  const handleApplyTemplate = (template) => {
    setFormData((prev) => ({
      ...prev,
      conditions: template,
    }));
    if (errors.conditions) {
      setErrors((prev) => ({ ...prev, conditions: undefined }));
    }
  };

  /**
   * Auto-generate slug from name
   */
  const handleAutoSlug = () => {
    if (formData.name) {
      const slug = formData.name
        .toLowerCase()
        .replace(/[^a-z0-9\s-]/g, '')
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-')
        .substring(0, 50);
      setFormData((prev) => ({ ...prev, slug }));
      if (errors.slug) {
        setErrors((prev) => ({ ...prev, slug: undefined }));
      }
    }
  };

  /**
   * Validate form
   */
  const validateForm = () => {
    const newErrors = {};

    // Slug validation (only for create)
    if (!isEditMode) {
      if (!formData.slug) {
        newErrors.slug = 'Slug is required';
      } else if (!/^[a-z0-9-]+$/.test(formData.slug)) {
        newErrors.slug = 'Slug must be lowercase alphanumeric with hyphens only';
      } else if (formData.slug.length > 100) {
        newErrors.slug = 'Slug must be 100 characters or less';
      }
    }

    // Name validation
    if (!formData.name) {
      newErrors.name = 'Name is required';
    } else if (formData.name.length > 200) {
      newErrors.name = 'Name must be 200 characters or less';
    }

    // Rule type validation
    if (!formData.rule_type) {
      newErrors.rule_type = 'Rule type is required';
    }

    // Category validation
    if (!formData.category) {
      newErrors.category = 'Category is required';
    }

    // Conditions validation
    if (!formData.conditions || Object.keys(formData.conditions).length === 0) {
      newErrors.conditions = 'Conditions are required';
    }

    // Points validation
    if (formData.points === null || formData.points === undefined) {
      newErrors.points = 'Points are required';
    } else if (formData.points < -1000 || formData.points > 1000) {
      newErrors.points = 'Points must be between -1000 and 1000';
    }

    // Optional numeric field validations
    if (formData.max_per_day !== null && (formData.max_per_day < 1 || formData.max_per_day > 1000)) {
      newErrors.max_per_day = 'Must be between 1 and 1000';
    }
    if (formData.max_per_lead !== null && (formData.max_per_lead < 1 || formData.max_per_lead > 1000)) {
      newErrors.max_per_lead = 'Must be between 1 and 1000';
    }
    if (formData.decay_days !== null && (formData.decay_days < 1 || formData.decay_days > 365)) {
      newErrors.decay_days = 'Must be between 1 and 365';
    }
    if (formData.priority !== null && (formData.priority < 1 || formData.priority > 1000)) {
      newErrors.priority = 'Must be between 1 and 1000';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  /**
   * Handle form submit
   */
  const handleSubmit = async () => {
    if (!validateForm()) return;

    setLoading(true);
    setApiError(null);

    try {
      // Prepare data
      const submitData = {
        name: formData.name,
        description: formData.description || null,
        rule_type: formData.rule_type,
        category: formData.category,
        conditions: formData.conditions,
        points: formData.points,
        is_active: formData.is_active,
      };

      // Only include optional fields if they have values
      if (formData.max_per_day !== null) submitData.max_per_day = formData.max_per_day;
      if (formData.max_per_lead !== null) submitData.max_per_lead = formData.max_per_lead;
      if (formData.decay_days !== null) submitData.decay_days = formData.decay_days;
      if (formData.priority !== null) submitData.priority = formData.priority;

      if (isEditMode) {
        // Update existing rule
        await updateScoringRule(rule.id, submitData);
      } else {
        // Create new rule - include slug
        submitData.slug = formData.slug;
        await createScoringRule(submitData);
      }

      onSuccess?.();
      handleClose();
    } catch (error) {
      console.error('Failed to save scoring rule:', error);
      setApiError(error.body?.error?.message || error.message || 'Failed to save rule');
    } finally {
      setLoading(false);
    }
  };

  /**
   * Handle dialog close
   */
  const handleClose = () => {
    if (!loading) {
      setFormData(defaultFormData);
      setErrors({});
      setApiError(null);
      setShowAdvanced(false);
      onClose?.();
    }
  };

  // Get category color for visual feedback
  const selectedCategory = CATEGORIES.find(c => c.value === formData.category);

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      maxWidth="md"
      fullWidth
      PaperProps={{
        sx: {
          bgcolor: 'background.paper',
          backgroundImage: 'none',
          maxHeight: '90vh',
        },
      }}
    >
      <DialogTitle>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <Typography variant="h6">
              {isEditMode ? 'Edit Scoring Rule' : 'Create Scoring Rule'}
            </Typography>
            {selectedCategory && (
              <Chip
                label={selectedCategory.label}
                size="small"
                sx={{
                  bgcolor: `${selectedCategory.color}20`,
                  color: selectedCategory.color,
                  fontWeight: 500,
                }}
              />
            )}
          </Box>
          <IconButton onClick={handleClose} size="small" disabled={loading}>
            <CloseIcon />
          </IconButton>
        </Box>
      </DialogTitle>

      <DialogContent dividers sx={{ p: 0 }}>
        <Box sx={{ p: 3 }}>
          {/* API Error */}
          {apiError && (
            <Alert severity="error" sx={{ mb: 3 }} onClose={() => setApiError(null)}>
              {apiError}
            </Alert>
          )}

          <Grid container spacing={2.5}>
            {/* Slug (only for create) */}
            {!isEditMode && (
              <Grid item xs={12}>
                <TextField
                  label="Slug"
                  value={formData.slug}
                  onChange={handleChange('slug')}
                  fullWidth
                  required
                  error={!!errors.slug}
                  helperText={errors.slug || 'Unique identifier (lowercase, hyphens allowed)'}
                  placeholder="pricing-page-view"
                  InputProps={{
                    endAdornment: formData.name && !formData.slug && (
                      <InputAdornment position="end">
                        <Tooltip title="Generate from name">
                          <IconButton onClick={handleAutoSlug} edge="end" size="small">
                            <AutoFixHighIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      </InputAdornment>
                    ),
                  }}
                />
              </Grid>
            )}

            {/* Name */}
            <Grid item xs={12} sm={isEditMode ? 12 : 12}>
              <TextField
                label="Rule Name"
                value={formData.name}
                onChange={handleChange('name')}
                fullWidth
                required
                error={!!errors.name}
                helperText={errors.name}
                placeholder="Pricing Page Visit"
              />
            </Grid>

            {/* Description */}
            <Grid item xs={12}>
              <TextField
                label="Description"
                value={formData.description}
                onChange={handleChange('description')}
                fullWidth
                multiline
                minRows={2}
                maxRows={3}
                placeholder="Award points when a lead visits the pricing page"
              />
            </Grid>

            {/* Rule Type & Category */}
            <Grid item xs={12} sm={6}>
              <FormControl fullWidth required error={!!errors.rule_type}>
                <InputLabel>Rule Type</InputLabel>
                <Select
                  value={formData.rule_type}
                  onChange={handleChange('rule_type')}
                  label="Rule Type"
                >
                  {RULE_TYPES.map((type) => (
                    <MenuItem key={type.value} value={type.value}>
                      <Box>
                        <Typography>{type.label}</Typography>
                        <Typography variant="caption" color="text.secondary">
                          {type.description}
                        </Typography>
                      </Box>
                    </MenuItem>
                  ))}
                </Select>
                {errors.rule_type && (
                  <Typography variant="caption" color="error" sx={{ mt: 0.5, ml: 1.75 }}>
                    {errors.rule_type}
                  </Typography>
                )}
              </FormControl>
            </Grid>

            <Grid item xs={12} sm={6}>
              <FormControl fullWidth required error={!!errors.category}>
                <InputLabel>Category</InputLabel>
                <Select
                  value={formData.category}
                  onChange={handleChange('category')}
                  label="Category"
                >
                  {CATEGORIES.map((cat) => (
                    <MenuItem key={cat.value} value={cat.value}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Box
                          sx={{
                            width: 12,
                            height: 12,
                            borderRadius: '50%',
                            bgcolor: cat.color,
                          }}
                        />
                        <Box>
                          <Typography>{cat.label}</Typography>
                          <Typography variant="caption" color="text.secondary">
                            {cat.description}
                          </Typography>
                        </Box>
                      </Box>
                    </MenuItem>
                  ))}
                </Select>
                {errors.category && (
                  <Typography variant="caption" color="error" sx={{ mt: 0.5, ml: 1.75 }}>
                    {errors.category}
                  </Typography>
                )}
              </FormControl>
            </Grid>

            {/* Points */}
            <Grid item xs={12} sm={4}>
              <TextField
                label="Points"
                type="number"
                value={formData.points ?? ''}
                onChange={handleNumberChange('points')}
                fullWidth
                required
                error={!!errors.points}
                helperText={errors.points || 'Points to award (negative for penalty)'}
                InputProps={{
                  inputProps: { min: -1000, max: 1000 },
                }}
              />
            </Grid>

            {/* Active Toggle */}
            <Grid item xs={12} sm={8}>
              <Box sx={{ pt: 1 }}>
                <FormControlLabel
                  control={
                    <Switch
                      checked={formData.is_active}
                      onChange={handleChange('is_active')}
                      color="success"
                    />
                  }
                  label={
                    <Box>
                      <Typography>Active</Typography>
                      <Typography variant="caption" color="text.secondary">
                        {formData.is_active 
                          ? 'Rule will be applied to incoming events' 
                          : 'Rule is disabled and will not trigger'}
                      </Typography>
                    </Box>
                  }
                />
              </Box>
            </Grid>

            {/* Conditions Section */}
            <Grid item xs={12}>
              <Divider sx={{ my: 1 }} />
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                <CodeIcon color="action" fontSize="small" />
                <Typography variant="subtitle1" fontWeight={500}>
                  Conditions (JSON)
                </Typography>
                <Tooltip title="Define when this rule should trigger. Use the templates below for common patterns.">
                  <InfoIcon fontSize="small" color="action" sx={{ cursor: 'help' }} />
                </Tooltip>
              </Box>
              
              <TemplateSelector 
                ruleType={formData.rule_type} 
                onSelect={handleApplyTemplate}
              />
              
              <JsonEditor
                value={formData.conditions}
                onChange={handleConditionsChange}
                error={errors.conditions}
                helperText="JSON object defining the rule conditions"
              />
            </Grid>

            {/* Advanced Settings */}
            <Grid item xs={12}>
              <Divider sx={{ my: 1 }} />
              <Button
                onClick={() => setShowAdvanced(!showAdvanced)}
                size="small"
                color="inherit"
                endIcon={showAdvanced ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                sx={{ mb: 1 }}
              >
                Advanced Settings
              </Button>
              
              <Collapse in={showAdvanced}>
                <Paper variant="outlined" sx={{ p: 2, bgcolor: 'rgba(0,0,0,0.01)' }}>
                  <Grid container spacing={2}>
                    <Grid item xs={12} sm={4}>
                      <TextField
                        label="Max per Day"
                        type="number"
                        value={formData.max_per_day ?? ''}
                        onChange={handleNumberChange('max_per_day')}
                        fullWidth
                        error={!!errors.max_per_day}
                        helperText={errors.max_per_day || 'Daily limit (optional)'}
                        InputProps={{
                          inputProps: { min: 1, max: 1000 },
                        }}
                      />
                    </Grid>
                    <Grid item xs={12} sm={4}>
                      <TextField
                        label="Max per Lead"
                        type="number"
                        value={formData.max_per_lead ?? ''}
                        onChange={handleNumberChange('max_per_lead')}
                        fullWidth
                        error={!!errors.max_per_lead}
                        helperText={errors.max_per_lead || 'Limit per lead (optional)'}
                        InputProps={{
                          inputProps: { min: 1, max: 1000 },
                        }}
                      />
                    </Grid>
                    <Grid item xs={12} sm={4}>
                      <TextField
                        label="Decay Days"
                        type="number"
                        value={formData.decay_days ?? ''}
                        onChange={handleNumberChange('decay_days')}
                        fullWidth
                        error={!!errors.decay_days}
                        helperText={errors.decay_days || 'Points expire after X days'}
                        InputProps={{
                          inputProps: { min: 1, max: 365 },
                        }}
                      />
                    </Grid>
                    <Grid item xs={12} sm={4}>
                      <TextField
                        label="Priority"
                        type="number"
                        value={formData.priority ?? ''}
                        onChange={handleNumberChange('priority')}
                        fullWidth
                        error={!!errors.priority}
                        helperText={errors.priority || 'Lower = higher priority (default: 100)'}
                        InputProps={{
                          inputProps: { min: 1, max: 1000 },
                        }}
                      />
                    </Grid>
                  </Grid>
                </Paper>
              </Collapse>
            </Grid>
          </Grid>
        </Box>
      </DialogContent>

      <DialogActions sx={{ px: 3, py: 2 }}>
        <Button onClick={handleClose} color="inherit" disabled={loading}>
          Cancel
        </Button>
        <Button
          onClick={handleSubmit}
          variant="contained"
          disabled={loading}
          startIcon={loading ? <CircularProgress size={18} /> : null}
        >
          {loading 
            ? (isEditMode ? 'Saving...' : 'Creating...') 
            : (isEditMode ? 'Save Changes' : 'Create Rule')}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default ScoringRuleEditor;
