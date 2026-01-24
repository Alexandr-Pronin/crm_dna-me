/**
 * Email Sequence Builder
 * Editor zum Erstellen und Bearbeiten von E-Mail-Sequenzen
 * Features: Timeline-Ansicht, WYSIWYG-Editor, Variablen, Test-Versand
 */
import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Button,
  IconButton,
  Tooltip,
  TextField,
  MenuItem,
  Switch,
  FormControlLabel,
  Divider,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  CircularProgress,
  Alert,
  Snackbar,
  Paper,
  Tabs,
  Tab,
  InputAdornment,
  Collapse,
  Fade,
  Slider,
  Grid,
  Avatar,
  Menu,
  ListItemIcon,
  ListItemText,
} from '@mui/material';
import {
  ArrowBack as BackIcon,
  Save as SaveIcon,
  Send as SendIcon,
  Add as AddIcon,
  Delete as DeleteIcon,
  Edit as EditIcon,
  Email as EmailIcon,
  Schedule as ScheduleIcon,
  Preview as PreviewIcon,
  ContentCopy as CopyIcon,
  Code as CodeIcon,
  FormatBold as BoldIcon,
  FormatItalic as ItalicIcon,
  FormatUnderlined as UnderlineIcon,
  Link as LinkIcon,
  Image as ImageIcon,
  DragIndicator as DragIcon,
  ExpandMore as ExpandIcon,
  ExpandLess as CollapseIcon,
  PlayArrow as PlayIcon,
  AccessTime as TimeIcon,
  Person as PersonIcon,
  Business as BusinessIcon,
  CheckCircle as CheckIcon,
  MoreVert as MoreIcon,
  Visibility as ViewIcon,
  Settings as SettingsIcon,
  Psychology as AIIcon,
} from '@mui/icons-material';

/**
 * Available template variables
 */
const TEMPLATE_VARIABLES = [
  { key: '{{first_name}}', label: 'Vorname', icon: PersonIcon },
  { key: '{{last_name}}', label: 'Nachname', icon: PersonIcon },
  { key: '{{email}}', label: 'E-Mail', icon: EmailIcon },
  { key: '{{company}}', label: 'Firma', icon: BusinessIcon },
  { key: '{{position}}', label: 'Position', icon: PersonIcon },
  { key: '{{deal_name}}', label: 'Deal Name', icon: BusinessIcon },
  { key: '{{deal_value}}', label: 'Deal Wert', icon: BusinessIcon },
];

/**
 * Trigger events for sequences
 */
const TRIGGER_EVENTS = [
  { value: 'lead_created', label: 'Lead erstellt', description: 'Wenn ein neuer Lead erstellt wird' },
  { value: 'deal_created', label: 'Deal erstellt', description: 'Wenn ein neuer Deal erstellt wird' },
  { value: 'deal_stage_changed', label: 'Stage geändert', description: 'Wenn ein Deal in eine bestimmte Stage verschoben wird' },
  { value: 'deal_won', label: 'Deal gewonnen', description: 'Wenn ein Deal als gewonnen markiert wird' },
  { value: 'deal_lost', label: 'Deal verloren', description: 'Wenn ein Deal als verloren markiert wird' },
  { value: 'manual', label: 'Manuell', description: 'Nur durch manuelle Enrollment-Aktion' },
];

/**
 * Mock sequence data
 */
const mockSequenceData = {
  id: '1',
  name: 'Willkommens-Serie',
  description: 'Automatische Begrüßung für neue Leads',
  trigger_event: 'lead_created',
  is_active: true,
  steps: [
    {
      id: 'step-1',
      position: 1,
      delay_days: 0,
      delay_hours: 0,
      subject: 'Willkommen bei DNA ME! 🧬',
      body_html: `<p>Hallo {{first_name}},</p>
<p>herzlich willkommen bei DNA ME! Wir freuen uns, Sie als neuen Kontakt begrüßen zu dürfen.</p>
<p>Als führendes Biotech-Unternehmen bieten wir Ihnen innovative Lösungen für Ihre Forschung.</p>
<p>In den nächsten Tagen werden wir Ihnen weitere Informationen zu unseren Services zusenden.</p>
<p>Mit freundlichen Grüßen,<br/>Ihr DNA ME Team</p>`,
    },
    {
      id: 'step-2',
      position: 2,
      delay_days: 2,
      delay_hours: 0,
      subject: 'Entdecken Sie unsere Research Lab Services',
      body_html: `<p>Hallo {{first_name}},</p>
<p>haben Sie schon von unseren Research Lab Services gehört?</p>
<p>Wir unterstützen Sie bei:</p>
<ul>
<li>Genomanalysen</li>
<li>Proteomik</li>
<li>Custom Assay Development</li>
</ul>
<p>Vereinbaren Sie jetzt ein unverbindliches Beratungsgespräch!</p>
<p>Beste Grüße,<br/>Ihr DNA ME Team</p>`,
    },
    {
      id: 'step-3',
      position: 3,
      delay_days: 5,
      delay_hours: 0,
      subject: 'Kostenlose Demo buchen',
      body_html: `<p>Hallo {{first_name}},</p>
<p>möchten Sie unsere Plattform in Aktion sehen?</p>
<p>Buchen Sie jetzt Ihre kostenlose Demo und erfahren Sie, wie DNA ME Ihre Forschung beschleunigen kann.</p>
<p>👉 <a href="#">Demo buchen</a></p>
<p>Wir freuen uns auf Sie!</p>
<p>Ihr DNA ME Team</p>`,
    },
  ],
};

/**
 * Email Step Editor Component
 */
const EmailStepEditor = ({
  step,
  index,
  expanded,
  onToggle,
  onChange,
  onDelete,
  onDuplicate,
  isFirst,
}) => {
  const [anchorEl, setAnchorEl] = useState(null);
  const [variableMenuAnchor, setVariableMenuAnchor] = useState(null);
  const subjectRef = useRef(null);
  const bodyRef = useRef(null);
  const [activeField, setActiveField] = useState(null);

  const handleMenuOpen = (event) => {
    event.stopPropagation();
    setAnchorEl(event.currentTarget);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
  };

  const handleVariableClick = (event) => {
    setVariableMenuAnchor(event.currentTarget);
  };

  const handleVariableClose = () => {
    setVariableMenuAnchor(null);
  };

  const handleInsertVariable = (variable) => {
    if (activeField === 'subject') {
      const newValue = step.subject + variable.key;
      onChange({ ...step, subject: newValue });
    } else if (activeField === 'body') {
      const newValue = step.body_html + variable.key;
      onChange({ ...step, body_html: newValue });
    }
    handleVariableClose();
  };

  const totalDelay = step.delay_days * 24 + step.delay_hours;
  const delayText = isFirst
    ? 'Sofort'
    : totalDelay === 0
    ? 'Sofort nach vorheriger'
    : step.delay_days > 0
    ? `${step.delay_days} Tag${step.delay_days > 1 ? 'e' : ''}${
        step.delay_hours > 0 ? ` ${step.delay_hours}h` : ''
      } Wartezeit`
    : `${step.delay_hours} Stunde${step.delay_hours > 1 ? 'n' : ''} Wartezeit`;

  return (
    <Paper
      elevation={expanded ? 4 : 1}
      sx={{
        border: '1px solid',
        borderColor: expanded ? 'primary.main' : 'divider',
        borderRadius: 2,
        overflow: 'hidden',
        transition: 'all 0.2s ease',
      }}
    >
      {/* Step Header */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 2,
          p: 2,
          bgcolor: expanded ? 'rgba(74, 144, 164, 0.08)' : 'transparent',
          cursor: 'pointer',
          '&:hover': { bgcolor: 'action.hover' },
        }}
        onClick={onToggle}
      >
        {/* Step Number & Icon */}
        <Avatar
          sx={{
            width: 36,
            height: 36,
            bgcolor: expanded ? 'primary.main' : 'action.selected',
            fontSize: '0.9rem',
            fontWeight: 600,
          }}
        >
          {index + 1}
        </Avatar>

        {/* Step Info */}
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography variant="body2" fontWeight={600} noWrap>
            {step.subject || 'Kein Betreff'}
          </Typography>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 0.25 }}>
            <Chip
              icon={<TimeIcon sx={{ fontSize: 14 }} />}
              label={delayText}
              size="small"
              sx={{
                height: 20,
                fontSize: '0.7rem',
                bgcolor: isFirst ? 'success.main' : 'action.selected',
                color: isFirst ? 'white' : 'text.secondary',
                '& .MuiChip-icon': { fontSize: 12 },
              }}
            />
          </Box>
        </Box>

        {/* Actions */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
          <IconButton size="small" onClick={handleMenuOpen}>
            <MoreIcon fontSize="small" />
          </IconButton>
          <IconButton size="small">
            {expanded ? <CollapseIcon /> : <ExpandIcon />}
          </IconButton>
        </Box>
      </Box>

      {/* Step Content */}
      <Collapse in={expanded}>
        <Box sx={{ p: 2, pt: 0 }}>
          <Divider sx={{ mb: 2 }} />

          {/* Delay Settings */}
          {!isFirst && (
            <Box sx={{ mb: 3 }}>
              <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                Wartezeit nach vorheriger E-Mail
              </Typography>
              <Grid container spacing={2}>
                <Grid item xs={6}>
                  <TextField
                    label="Tage"
                    type="number"
                    size="small"
                    fullWidth
                    value={step.delay_days}
                    onChange={(e) =>
                      onChange({ ...step, delay_days: Math.max(0, parseInt(e.target.value) || 0) })
                    }
                    InputProps={{
                      inputProps: { min: 0 },
                    }}
                  />
                </Grid>
                <Grid item xs={6}>
                  <TextField
                    label="Stunden"
                    type="number"
                    size="small"
                    fullWidth
                    value={step.delay_hours}
                    onChange={(e) =>
                      onChange({
                        ...step,
                        delay_hours: Math.min(23, Math.max(0, parseInt(e.target.value) || 0)),
                      })
                    }
                    InputProps={{
                      inputProps: { min: 0, max: 23 },
                    }}
                  />
                </Grid>
              </Grid>
            </Box>
          )}

          {/* Subject Line */}
          <Box sx={{ mb: 3 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
              <Typography variant="subtitle2" color="text.secondary">
                Betreff
              </Typography>
              <Button
                size="small"
                startIcon={<CodeIcon sx={{ fontSize: 14 }} />}
                onClick={handleVariableClick}
                onMouseDown={() => setActiveField('subject')}
              >
                Variable einfügen
              </Button>
            </Box>
            <TextField
              ref={subjectRef}
              fullWidth
              size="small"
              placeholder="E-Mail Betreff eingeben..."
              value={step.subject}
              onChange={(e) => onChange({ ...step, subject: e.target.value })}
              onFocus={() => setActiveField('subject')}
            />
          </Box>

          {/* Email Body */}
          <Box sx={{ mb: 2 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
              <Typography variant="subtitle2" color="text.secondary">
                E-Mail Inhalt
              </Typography>
              <Box sx={{ display: 'flex', gap: 0.5 }}>
                <Tooltip title="Fett">
                  <IconButton size="small">
                    <BoldIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
                <Tooltip title="Kursiv">
                  <IconButton size="small">
                    <ItalicIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
                <Tooltip title="Unterstrichen">
                  <IconButton size="small">
                    <UnderlineIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
                <Divider orientation="vertical" flexItem sx={{ mx: 0.5 }} />
                <Tooltip title="Link einfügen">
                  <IconButton size="small">
                    <LinkIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
                <Tooltip title="Bild einfügen">
                  <IconButton size="small">
                    <ImageIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
                <Divider orientation="vertical" flexItem sx={{ mx: 0.5 }} />
                <Button
                  size="small"
                  startIcon={<CodeIcon sx={{ fontSize: 14 }} />}
                  onClick={handleVariableClick}
                  onMouseDown={() => setActiveField('body')}
                >
                  Variable
                </Button>
              </Box>
            </Box>
            <TextField
              ref={bodyRef}
              fullWidth
              multiline
              rows={10}
              placeholder="E-Mail Inhalt eingeben (HTML wird unterstützt)..."
              value={step.body_html}
              onChange={(e) => onChange({ ...step, body_html: e.target.value })}
              onFocus={() => setActiveField('body')}
              sx={{
                '& .MuiInputBase-root': {
                  fontFamily: 'monospace',
                  fontSize: '0.85rem',
                },
              }}
            />
          </Box>

          {/* Preview Button */}
          <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
            <Button size="small" startIcon={<PreviewIcon />} variant="outlined">
              Vorschau
            </Button>
          </Box>
        </Box>
      </Collapse>

      {/* Step Actions Menu */}
      <Menu anchorEl={anchorEl} open={Boolean(anchorEl)} onClose={handleMenuClose}>
        <MenuItem onClick={() => { onDuplicate(); handleMenuClose(); }}>
          <ListItemIcon>
            <CopyIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>Duplizieren</ListItemText>
        </MenuItem>
        <MenuItem onClick={() => { onDelete(); handleMenuClose(); }} sx={{ color: 'error.main' }}>
          <ListItemIcon>
            <DeleteIcon fontSize="small" color="error" />
          </ListItemIcon>
          <ListItemText>Löschen</ListItemText>
        </MenuItem>
      </Menu>

      {/* Variable Insert Menu */}
      <Menu
        anchorEl={variableMenuAnchor}
        open={Boolean(variableMenuAnchor)}
        onClose={handleVariableClose}
      >
        {TEMPLATE_VARIABLES.map((variable) => (
          <MenuItem key={variable.key} onClick={() => handleInsertVariable(variable)}>
            <ListItemIcon>
              <variable.icon fontSize="small" />
            </ListItemIcon>
            <ListItemText
              primary={variable.label}
              secondary={
                <Typography variant="caption" sx={{ fontFamily: 'monospace' }}>
                  {variable.key}
                </Typography>
              }
            />
          </MenuItem>
        ))}
      </Menu>
    </Paper>
  );
};

/**
 * Test Email Dialog
 */
const TestEmailDialog = ({ open, onClose, onSend, loading }) => {
  const [testEmail, setTestEmail] = useState('');
  const [selectedStep, setSelectedStep] = useState('all');

  const handleSend = () => {
    onSend(testEmail, selectedStep);
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Test-E-Mail senden</DialogTitle>
      <DialogContent>
        <Box sx={{ pt: 1 }}>
          <TextField
            fullWidth
            label="E-Mail Adresse"
            placeholder="test@example.com"
            value={testEmail}
            onChange={(e) => setTestEmail(e.target.value)}
            type="email"
            sx={{ mb: 2 }}
          />
          <TextField
            select
            fullWidth
            label="Welche E-Mail senden?"
            value={selectedStep}
            onChange={(e) => setSelectedStep(e.target.value)}
          >
            <MenuItem value="all">Alle E-Mails der Sequenz</MenuItem>
            <MenuItem value="1">Nur E-Mail 1</MenuItem>
            <MenuItem value="2">Nur E-Mail 2</MenuItem>
            <MenuItem value="3">Nur E-Mail 3</MenuItem>
          </TextField>
          <Alert severity="info" sx={{ mt: 2 }}>
            Die Test-E-Mail wird mit Beispieldaten für Variablen gesendet.
          </Alert>
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={loading}>
          Abbrechen
        </Button>
        <Button
          onClick={handleSend}
          variant="contained"
          disabled={!testEmail || loading}
          startIcon={loading ? <CircularProgress size={16} /> : <SendIcon />}
        >
          Test senden
        </Button>
      </DialogActions>
    </Dialog>
  );
};

/**
 * Main Sequence Builder Component
 */
const SequenceBuilder = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const isNew = id === 'new';

  // State
  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [sequence, setSequence] = useState({
    name: '',
    description: '',
    trigger_event: 'lead_created',
    is_active: false,
    steps: [],
  });
  const [expandedStep, setExpandedStep] = useState(0);
  const [hasChanges, setHasChanges] = useState(false);

  // Dialog state
  const [testDialogOpen, setTestDialogOpen] = useState(false);
  const [testLoading, setTestLoading] = useState(false);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });

  /**
   * Load sequence data
   */
  useEffect(() => {
    if (!isNew && id) {
      setLoading(true);
      // Simulate API call
      setTimeout(() => {
        setSequence(mockSequenceData);
        setLoading(false);
      }, 500);
    }
  }, [id, isNew]);

  /**
   * Handle field change
   */
  const handleFieldChange = (field, value) => {
    setSequence((prev) => ({ ...prev, [field]: value }));
    setHasChanges(true);
  };

  /**
   * Handle step change
   */
  const handleStepChange = (index, updatedStep) => {
    setSequence((prev) => ({
      ...prev,
      steps: prev.steps.map((step, i) => (i === index ? updatedStep : step)),
    }));
    setHasChanges(true);
  };

  /**
   * Handle add step
   */
  const handleAddStep = () => {
    const newStep = {
      id: `step-${Date.now()}`,
      position: sequence.steps.length + 1,
      delay_days: 1,
      delay_hours: 0,
      subject: '',
      body_html: '',
    };
    setSequence((prev) => ({
      ...prev,
      steps: [...prev.steps, newStep],
    }));
    setExpandedStep(sequence.steps.length);
    setHasChanges(true);
  };

  /**
   * Handle delete step
   */
  const handleDeleteStep = (index) => {
    if (sequence.steps.length <= 1) {
      setSnackbar({
        open: true,
        message: 'Eine Sequenz muss mindestens einen Schritt haben',
        severity: 'warning',
      });
      return;
    }
    setSequence((prev) => ({
      ...prev,
      steps: prev.steps
        .filter((_, i) => i !== index)
        .map((step, i) => ({ ...step, position: i + 1 })),
    }));
    setExpandedStep(Math.max(0, index - 1));
    setHasChanges(true);
  };

  /**
   * Handle duplicate step
   */
  const handleDuplicateStep = (index) => {
    const stepToDuplicate = sequence.steps[index];
    const newStep = {
      ...stepToDuplicate,
      id: `step-${Date.now()}`,
      position: sequence.steps.length + 1,
    };
    setSequence((prev) => ({
      ...prev,
      steps: [...prev.steps, newStep],
    }));
    setExpandedStep(sequence.steps.length);
    setHasChanges(true);
  };

  /**
   * Handle save
   */
  const handleSave = async () => {
    setSaving(true);
    // Simulate API call
    setTimeout(() => {
      setSaving(false);
      setHasChanges(false);
      setSnackbar({
        open: true,
        message: isNew ? 'Sequenz erfolgreich erstellt' : 'Änderungen gespeichert',
        severity: 'success',
      });
      if (isNew) {
        navigate('/email-marketing');
      }
    }, 1000);
  };

  /**
   * Handle test email send
   */
  const handleTestSend = (email, step) => {
    setTestLoading(true);
    setTimeout(() => {
      setTestLoading(false);
      setTestDialogOpen(false);
      setSnackbar({
        open: true,
        message: `Test-E-Mail an ${email} gesendet`,
        severity: 'success',
      });
    }, 1500);
  };

  /**
   * Handle back navigation
   */
  const handleBack = () => {
    if (hasChanges) {
      if (window.confirm('Es gibt ungespeicherte Änderungen. Möchten Sie wirklich zurück?')) {
        navigate('/email-marketing');
      }
    } else {
      navigate('/email-marketing');
    }
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '50vh' }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3, width: '100%', maxWidth: '100%' }}>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 2 }}>
          <IconButton onClick={handleBack} sx={{ mt: 0.5 }}>
            <BackIcon />
          </IconButton>
          <Box>
            <Typography variant="h4" sx={{ fontWeight: 300 }}>
              {isNew ? 'Neue Sequenz erstellen' : sequence.name || 'Sequenz bearbeiten'}
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
              {isNew
                ? 'Erstellen Sie eine automatisierte E-Mail-Sequenz'
                : `${sequence.steps.length} E-Mail${sequence.steps.length !== 1 ? 's' : ''} in dieser Sequenz`}
            </Typography>
            {hasChanges && (
              <Chip
                label="Ungespeicherte Änderungen"
                size="small"
                color="warning"
                sx={{ mt: 1 }}
              />
            )}
          </Box>
        </Box>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button
            variant="outlined"
            startIcon={<SendIcon />}
            onClick={() => setTestDialogOpen(true)}
            disabled={sequence.steps.length === 0}
          >
            Test senden
          </Button>
          <Button
            variant="contained"
            startIcon={saving ? <CircularProgress size={16} color="inherit" /> : <SaveIcon />}
            onClick={handleSave}
            disabled={saving || !sequence.name}
          >
            {saving ? 'Speichern...' : 'Speichern'}
          </Button>
        </Box>
      </Box>

      <Grid container spacing={3}>
        {/* Left Column - Settings */}
        <Grid item xs={12} md={4}>
          <Card sx={{ position: 'sticky', top: 24 }}>
            <CardContent>
              <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <SettingsIcon sx={{ fontSize: 20 }} />
                Einstellungen
              </Typography>
              <Divider sx={{ mb: 2 }} />

              {/* Name */}
              <TextField
                fullWidth
                label="Sequenz Name"
                placeholder="z.B. Willkommens-Serie"
                value={sequence.name}
                onChange={(e) => handleFieldChange('name', e.target.value)}
                sx={{ mb: 2 }}
                required
              />

              {/* Description */}
              <TextField
                fullWidth
                label="Beschreibung"
                placeholder="Kurze Beschreibung der Sequenz..."
                value={sequence.description}
                onChange={(e) => handleFieldChange('description', e.target.value)}
                multiline
                rows={2}
                sx={{ mb: 2 }}
              />

              {/* Trigger Event */}
              <TextField
                select
                fullWidth
                label="Trigger Event"
                value={sequence.trigger_event}
                onChange={(e) => handleFieldChange('trigger_event', e.target.value)}
                sx={{ mb: 2 }}
                helperText={
                  TRIGGER_EVENTS.find((t) => t.value === sequence.trigger_event)?.description
                }
              >
                {TRIGGER_EVENTS.map((trigger) => (
                  <MenuItem key={trigger.value} value={trigger.value}>
                    {trigger.label}
                  </MenuItem>
                ))}
              </TextField>

              {/* Active Toggle */}
              <FormControlLabel
                control={
                  <Switch
                    checked={sequence.is_active}
                    onChange={(e) => handleFieldChange('is_active', e.target.checked)}
                    color="success"
                  />
                }
                label={
                  <Box>
                    <Typography variant="body2">
                      {sequence.is_active ? 'Aktiv' : 'Inaktiv'}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {sequence.is_active
                        ? 'Sequenz wird automatisch ausgeführt'
                        : 'Sequenz ist pausiert'}
                    </Typography>
                  </Box>
                }
                sx={{ ml: 0, mt: 1 }}
              />

              {/* Variables Reference */}
              <Box sx={{ mt: 3 }}>
                <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                  Verfügbare Variablen
                </Typography>
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                  {TEMPLATE_VARIABLES.map((variable) => (
                    <Chip
                      key={variable.key}
                      label={variable.key}
                      size="small"
                      sx={{
                        fontFamily: 'monospace',
                        fontSize: '0.7rem',
                        bgcolor: 'action.selected',
                      }}
                    />
                  ))}
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        {/* Right Column - Email Steps */}
        <Grid item xs={12} md={8}>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
            <Typography variant="h6" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <EmailIcon sx={{ fontSize: 20 }} />
              E-Mail Schritte
            </Typography>
            <Button variant="outlined" startIcon={<AddIcon />} onClick={handleAddStep}>
              E-Mail hinzufügen
            </Button>
          </Box>

          {/* Timeline */}
          <Box sx={{ position: 'relative' }}>
            {/* Timeline Line */}
            {sequence.steps.length > 1 && (
              <Box
                sx={{
                  position: 'absolute',
                  left: 18,
                  top: 48,
                  bottom: 48,
                  width: 2,
                  bgcolor: 'divider',
                  zIndex: 0,
                }}
              />
            )}

            {/* Steps */}
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              {sequence.steps.length === 0 ? (
                <Paper
                  sx={{
                    p: 4,
                    textAlign: 'center',
                    border: '2px dashed',
                    borderColor: 'divider',
                    borderRadius: 2,
                  }}
                >
                  <EmailIcon sx={{ fontSize: 48, color: 'text.secondary', mb: 1 }} />
                  <Typography color="text.secondary" gutterBottom>
                    Noch keine E-Mails in dieser Sequenz
                  </Typography>
                  <Button
                    variant="contained"
                    startIcon={<AddIcon />}
                    onClick={handleAddStep}
                    sx={{ mt: 1 }}
                  >
                    Erste E-Mail hinzufügen
                  </Button>
                </Paper>
              ) : (
                sequence.steps.map((step, index) => (
                  <EmailStepEditor
                    key={step.id}
                    step={step}
                    index={index}
                    expanded={expandedStep === index}
                    onToggle={() => setExpandedStep(expandedStep === index ? -1 : index)}
                    onChange={(updatedStep) => handleStepChange(index, updatedStep)}
                    onDelete={() => handleDeleteStep(index)}
                    onDuplicate={() => handleDuplicateStep(index)}
                    isFirst={index === 0}
                  />
                ))
              )}
            </Box>

            {/* Add Step Button at Bottom */}
            {sequence.steps.length > 0 && (
              <Box sx={{ display: 'flex', justifyContent: 'center', mt: 2 }}>
                <Button
                  variant="outlined"
                  startIcon={<AddIcon />}
                  onClick={handleAddStep}
                  sx={{ borderStyle: 'dashed' }}
                >
                  Weitere E-Mail hinzufügen
                </Button>
              </Box>
            )}
          </Box>
        </Grid>
      </Grid>

      {/* Test Email Dialog */}
      <TestEmailDialog
        open={testDialogOpen}
        onClose={() => setTestDialogOpen(false)}
        onSend={handleTestSend}
        loading={testLoading}
      />

      {/* Snackbar */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={4000}
        onClose={() => setSnackbar((prev) => ({ ...prev, open: false }))}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        <Alert
          onClose={() => setSnackbar((prev) => ({ ...prev, open: false }))}
          severity={snackbar.severity}
          sx={{ width: '100%' }}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default SequenceBuilder;
