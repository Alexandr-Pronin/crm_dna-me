/**
 * Lead Show/Detail Component
 * Displays detailed lead information with tabs for Score History and Events
 */
import { useState, useEffect, useCallback } from 'react';
import {
  Show,
  SimpleShowLayout,
  TextField,
  DateField,
  FunctionField,
  useRecordContext,
  ReferenceField,
  useNotify,
  useDataProvider,
} from 'react-admin';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Grid,
  Chip,
  Divider,
  LinearProgress,
  Tabs,
  Tab,
  Button,
  CircularProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField as MuiTextField,
  IconButton,
  Alert,
} from '@mui/material';
import {
  Email as EmailIcon,
  Phone as PhoneIcon,
  Business as BusinessIcon,
  LinkedIn as LinkedInIcon,
  CalendarToday as CalendarIcon,
  Timeline as TimelineIcon,
  Refresh as RefreshIcon,
  Event as EventIcon,
} from '@mui/icons-material';
import { ScoreBadge, StatusBadge } from '../../components/common';
import { ScoreHistory, EventTimeline } from './components';
import { recalculateLeadScores, ingestLeadEvent, getLeadEvents } from '../../providers/dataProvider';
import AssociatedObjectsPanel from '../../components/AssociatedObjectsPanel';
import { formatDistanceToNow, parseISO, isValid } from 'date-fns';
import { de } from 'date-fns/locale';

const ACTIVITY_CONFIG = {
  note: { label: 'Note', eventType: 'note_created' },
  email: { label: 'Email', eventType: 'email_sent' },
  call: { label: 'Call', eventType: 'call_completed' },
  meeting: { label: 'Meeting', eventType: 'meeting_completed' },
  task: { label: 'Task' },
};

const formatRelativeTime = (value) => {
  if (!value) return 'Unbekannt';
  const dateValue = typeof value === 'string' ? parseISO(value) : new Date(value);
  if (!isValid(dateValue)) return 'Unbekannt';
  return formatDistanceToNow(dateValue, { addSuffix: true, locale: de });
};

const getEmailDomain = (email) => {
  if (!email) return null;
  const parts = email.split('@');
  return parts.length > 1 ? parts[1].toLowerCase() : null;
};

/**
 * Score Breakdown Card
 */
const ScoreBreakdown = () => {
  const record = useRecordContext();
  if (!record) return null;

  const scores = [
    { label: 'Demographic', value: record.demographic_score || 0, max: 40, color: '#4A90A4' },
    { label: 'Engagement', value: record.engagement_score || 0, max: 60, color: '#6C5CE7' },
    { label: 'Behavior', value: record.behavior_score || 0, max: 100, color: '#28A745' },
  ];

  return (
    <Card>
      <CardContent>
        <Typography variant="h6" gutterBottom>
          Score Breakdown
        </Typography>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3 }}>
          <ScoreBadge score={record.total_score || 0} showLabel />
          <Typography variant="body2" color="text.secondary">
            Total Score
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {scores.map((score) => (
            <Box key={score.label}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                <Typography variant="body2">{score.label}</Typography>
                <Typography variant="body2" fontWeight={600}>
                  {score.value}/{score.max}
                </Typography>
              </Box>
              <LinearProgress
                variant="determinate"
                value={(score.value / score.max) * 100}
                sx={{
                  height: 8,
                  borderRadius: 4,
                  bgcolor: 'background.default',
                  '& .MuiLinearProgress-bar': {
                    bgcolor: score.color,
                    borderRadius: 4,
                  },
                }}
              />
            </Box>
          ))}
        </Box>
      </CardContent>
    </Card>
  );
};

/**
 * Intent Summary Card
 */
const IntentSummary = () => {
  const record = useRecordContext();
  if (!record) return null;

  const intentSummary = record.intent_summary || { research: 0, b2b: 0, co_creation: 0 };
  const intents = [
    { id: 'research', label: 'Research', value: intentSummary.research || 0, color: '#4A90A4' },
    { id: 'b2b', label: 'B2B', value: intentSummary.b2b || 0, color: '#6C5CE7' },
    { id: 'co_creation', label: 'Co-Creation', value: intentSummary.co_creation || 0, color: '#28A745' },
  ];

  const total = intents.reduce((sum, i) => sum + i.value, 0);

  return (
    <Card>
      <CardContent>
        <Typography variant="h6" gutterBottom>
          Intent Signals
        </Typography>
        {record.primary_intent && (
          <Box sx={{ mb: 2 }}>
            <Typography variant="body2" color="text.secondary" gutterBottom>
              Primary Intent
            </Typography>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <StatusBadge status={record.primary_intent} />
              <Typography variant="body2">
                {Math.round((record.intent_confidence || 0) * 100)}% confidence
              </Typography>
            </Box>
          </Box>
        )}
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
          {intents.map((intent) => (
            <Box key={intent.id} sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <Box
                sx={{
                  width: 12,
                  height: 12,
                  borderRadius: '50%',
                  bgcolor: intent.color,
                }}
              />
              <Typography variant="body2" sx={{ flex: 1 }}>
                {intent.label}
              </Typography>
              <Typography variant="body2" fontWeight={600}>
                {intent.value}
              </Typography>
            </Box>
          ))}
        </Box>
      </CardContent>
    </Card>
  );
};

/**
 * Contact Info Card
 */
const ContactInfo = () => {
  const record = useRecordContext();
  if (!record) return null;

  const contactItems = [
    { icon: EmailIcon, label: 'Email', value: record.email },
    { icon: PhoneIcon, label: 'Phone', value: record.phone },
    { icon: BusinessIcon, label: 'Job Title', value: record.job_title },
    { icon: LinkedInIcon, label: 'LinkedIn', value: record.linkedin_url, isLink: true },
  ].filter((item) => item.value);

  return (
    <Card>
      <CardContent>
        <Typography variant="h6" gutterBottom>
          Contact Information
        </Typography>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {contactItems.map((item, index) => (
            <Box key={index} sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <item.icon sx={{ color: 'text.secondary', fontSize: 20 }} />
              <Box>
                <Typography variant="caption" color="text.secondary">
                  {item.label}
                </Typography>
                {item.isLink ? (
                  <Typography variant="body2">
                    <a
                      href={item.value}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ color: '#4A90A4' }}
                    >
                      {item.value}
                    </a>
                  </Typography>
                ) : (
                  <Typography variant="body2">{item.value}</Typography>
                )}
              </Box>
            </Box>
          ))}
        </Box>
      </CardContent>
    </Card>
  );
};

/**
 * Activity Composer Card
 */
const ActivityComposer = ({ onActivityLogged }) => {
  const record = useRecordContext();
  const notify = useNotify();
  const dataProvider = useDataProvider();
  const [activeType, setActiveType] = useState(null);
  const [title, setTitle] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  if (!record) return null;

  const handleOpen = (type) => {
    setActiveType(type);
    setTitle('');
    setNotes('');
  };

  const handleClose = () => {
    if (saving) return;
    setActiveType(null);
    setTitle('');
    setNotes('');
  };

  const handleSave = async () => {
    if (!activeType || saving) return;

    if (activeType === 'task' && !title.trim()) {
      notify('Title is required for a task', { type: 'warning' });
      return;
    }

    if (!record.email) {
      notify('Lead email is required to log activities', { type: 'warning' });
      return;
    }

    setSaving(true);
    try {
      if (activeType === 'task') {
        await dataProvider.create('tasks', {
          data: {
            lead_id: record.id,
            title: title.trim(),
            description: notes.trim() || undefined,
            task_type: 'manual',
          },
        });
        notify('Task created', { type: 'success' });
      } else {
        const config = ACTIVITY_CONFIG[activeType];
        await ingestLeadEvent({
          event_type: config.eventType,
          source: 'manual',
          occurred_at: new Date().toISOString(),
          lead_identifier: { email: record.email },
          event_category: 'activity',
          metadata: {
            title: title.trim() || undefined,
            notes: notes.trim() || undefined,
          },
        });
        notify(`${config.label} logged`, { type: 'success' });
      }

      onActivityLogged?.();
      handleClose();
    } catch (error) {
      notify(error?.message || 'Failed to log activity', { type: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const dialogLabel = activeType ? ACTIVITY_CONFIG[activeType].label : 'Activity';

  return (
    <Card>
      <CardContent>
        <Typography variant="h6" gutterBottom>
          Log Activity
        </Typography>
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
          {Object.keys(ACTIVITY_CONFIG).map((type) => (
            <Button key={type} variant="outlined" onClick={() => handleOpen(type)}>
              {ACTIVITY_CONFIG[type].label}
            </Button>
          ))}
        </Box>
      </CardContent>

      <Dialog open={Boolean(activeType)} onClose={handleClose} fullWidth maxWidth="sm">
        <DialogTitle>{dialogLabel}</DialogTitle>
        <DialogContent sx={{ pt: 1 }}>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
            <MuiTextField
              label="Title"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              fullWidth
            />
            <MuiTextField
              label="Notes"
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              fullWidth
              multiline
              minRows={3}
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleClose} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={handleSave} variant="contained" disabled={saving}>
            {saving ? 'Saving...' : 'Save'}
          </Button>
        </DialogActions>
      </Dialog>
    </Card>
  );
};

/**
 * Notes List Card
 */
const NotesList = ({ refreshKey }) => {
  const record = useRecordContext();
  const [notes, setNotes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const loadNotes = useCallback(async () => {
    if (!record?.id) return;
    setLoading(true);
    setError(null);
    try {
      const events = await getLeadEvents(record.id, { limit: 50 });
      const filteredNotes = (Array.isArray(events) ? events : [])
        .filter((event) => event.event_type === 'note_created')
        .sort((a, b) => new Date(b.occurred_at) - new Date(a.occurred_at))
        .slice(0, 10);
      setNotes(filteredNotes);
    } catch (err) {
      setError('Notizen konnten nicht geladen werden.');
    } finally {
      setLoading(false);
    }
  }, [record?.id]);

  useEffect(() => {
    loadNotes();
  }, [loadNotes, refreshKey]);

  if (!record) return null;

  return (
    <Card>
      <CardContent>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
          <Typography variant="h6">Notes</Typography>
          <IconButton size="small" onClick={loadNotes} disabled={loading}>
            {loading ? <CircularProgress size={18} /> : <RefreshIcon fontSize="small" />}
          </IconButton>
        </Box>

        {error && <Alert severity="error">{error}</Alert>}

        {!error && notes.length === 0 && !loading && (
          <Typography variant="body2" color="text.secondary">
            Keine Notizen vorhanden.
          </Typography>
        )}

        {!error && notes.length > 0 && (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
            {notes.map((note, index) => (
              <Box key={note.id || `${note.occurred_at}-${index}`}>
                <Typography variant="subtitle2">
                  {note.metadata?.title || 'Note'}
                </Typography>
                {note.metadata?.notes && (
                  <Typography variant="body2" color="text.secondary" sx={{ whiteSpace: 'pre-wrap' }}>
                    {note.metadata.notes}
                  </Typography>
                )}
                <Typography variant="caption" color="text.secondary">
                  {formatRelativeTime(note.occurred_at)}
                </Typography>
                {index < notes.length - 1 && <Divider sx={{ mt: 1.5 }} />}
              </Box>
            ))}
          </Box>
        )}
      </CardContent>
    </Card>
  );
};

/**
 * Company Info Card
 */
const CompanyInfo = () => {
  const record = useRecordContext();
  if (!record?.organization_id) return null;

  return (
    <Card>
      <CardContent>
        <Typography variant="h6" gutterBottom>
          Company
        </Typography>
        <ReferenceField source="organization_id" reference="organizations" link="edit">
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
            <Typography variant="body2" fontWeight={600}>
              <TextField source="name" />
            </Typography>
            <Typography variant="caption" color="text.secondary">
              <TextField source="domain" />
            </Typography>
            <Typography variant="caption" color="text.secondary">
              <TextField source="industry" />
            </Typography>
          </Box>
        </ReferenceField>
      </CardContent>
    </Card>
  );
};

/**
 * Attribution Card
 */
const Attribution = () => {
  const record = useRecordContext();
  if (!record) return null;

  return (
    <Card>
      <CardContent>
        <Typography variant="h6" gutterBottom>
          Attribution
        </Typography>
        <Grid container spacing={2}>
          <Grid size={6}>
            <Typography variant="caption" color="text.secondary">
              First Touch Source
            </Typography>
            <Typography variant="body2">
              {record.first_touch_source || '—'}
            </Typography>
          </Grid>
          <Grid size={6}>
            <Typography variant="caption" color="text.secondary">
              First Touch Campaign
            </Typography>
            <Typography variant="body2">
              {record.first_touch_campaign || '—'}
            </Typography>
          </Grid>
          <Grid size={6}>
            <Typography variant="caption" color="text.secondary">
              Last Touch Source
            </Typography>
            <Typography variant="body2">
              {record.last_touch_source || '—'}
            </Typography>
          </Grid>
          <Grid size={6}>
            <Typography variant="caption" color="text.secondary">
              Last Touch Campaign
            </Typography>
            <Typography variant="body2">
              {record.last_touch_campaign || '—'}
            </Typography>
          </Grid>
        </Grid>
      </CardContent>
    </Card>
  );
};

/**
 * Lead Header
 */
const LeadHeader = () => {
  const record = useRecordContext();
  if (!record) return null;

  const fullName = `${record.first_name || ''} ${record.last_name || ''}`.trim() || record.email;

  return (
    <Box sx={{ mb: 3 }}>
      <Typography variant="h4" sx={{ fontWeight: 300 }}>
        {fullName}
      </Typography>
      <Box sx={{ display: 'flex', gap: 1, mt: 1, flexWrap: 'wrap' }}>
        <StatusBadge status={record.status} />
        <StatusBadge status={record.lifecycle_stage} />
        {record.routing_status && <StatusBadge status={record.routing_status} />}
      </Box>
    </Box>
  );
};

/**
 * Tab Panel Component
 */
const TabPanel = ({ children, value, index, ...other }) => {
  return (
    <Box
      role="tabpanel"
      hidden={value !== index}
      id={`lead-tabpanel-${index}`}
      aria-labelledby={`lead-tab-${index}`}
      {...other}
    >
      {value === index && <Box sx={{ pt: 3 }}>{children}</Box>}
    </Box>
  );
};

/**
 * Recalculate Score Button
 */
const RecalculateButton = ({ onRecalculate }) => {
  const record = useRecordContext();
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);

  const handleRecalculate = async () => {
    if (!record?.id) return;
    
    setLoading(true);
    setResult(null);
    
    try {
      const response = await recalculateLeadScores(record.id);
      setResult({
        success: true,
        message: response.changed 
          ? `Score updated: ${response.old_score} → ${response.new_score}` 
          : 'Score unchanged',
      });
      // Trigger parent callback to refresh data if provided
      if (onRecalculate) onRecalculate();
    } catch (err) {
      setResult({
        success: false,
        message: err.message || 'Failed to recalculate scores',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
      <Button
        variant="outlined"
        size="small"
        startIcon={loading ? <CircularProgress size={16} /> : <RefreshIcon />}
        onClick={handleRecalculate}
        disabled={loading}
        sx={{ textTransform: 'none' }}
      >
        {loading ? 'Recalculating...' : 'Recalculate Score'}
      </Button>
      {result && (
        <Typography 
          variant="body2" 
          color={result.success ? 'success.main' : 'error.main'}
        >
          {result.message}
        </Typography>
      )}
    </Box>
  );
};

/**
 * Lead Content with Tabs
 */
const LeadContent = () => {
  const record = useRecordContext();
  const dataProvider = useDataProvider();
  const [tabValue, setTabValue] = useState(0);
  const [refreshKey, setRefreshKey] = useState(0);
  const [notesRefreshKey, setNotesRefreshKey] = useState(0);
  const [associations, setAssociations] = useState({ companies: [] });

  const handleRecalculate = () => {
    // Increment key to force ScoreHistory refresh
    setRefreshKey((k) => k + 1);
  };

  const handleActivityLogged = () => {
    setNotesRefreshKey((k) => k + 1);
  };

  useEffect(() => {
    if (!record?.id) return;

    let isActive = true;

    const buildAssociations = async () => {
      let organization = null;

      if (record.organization_id) {
        try {
          const response = await dataProvider.getOne('organizations', {
            id: record.organization_id,
          });
          organization = response?.data || null;
        } catch {
          organization = null;
        }
      }

      const domain = organization?.domain || getEmailDomain(record.email);
      const companyName = organization?.name || domain;

      const companies = companyName
        ? [
            {
              id: organization?.id || `${record.id}-company`,
              name: companyName,
              domain: domain || null,
              phone: null,
              associationLabel: 'Primary Company',
              contacts: [
                {
                  id: record.id,
                  name:
                    `${record.first_name || ''} ${record.last_name || ''}`.trim() ||
                    record.email,
                  email: record.email,
                  phone: record.phone,
                  associationLabel: 'Contact with Primary Company',
                },
              ],
            },
          ]
        : [];

      if (isActive) {
        setAssociations({ companies });
      }
    };

    buildAssociations();

    return () => {
      isActive = false;
    };
  }, [record, dataProvider]);

  if (!record) return null;

  return (
    <Box sx={{ p: 3 }}>
      <LeadHeader />

      <Box sx={{ display: 'flex', gap: 3 }}>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          {/* Main Content */}
          <Grid container spacing={3}>
            {/* Left Column - Scores */}
            <Grid size={{ xs: 12, md: 4 }}>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                <ScoreBreakdown />
                <IntentSummary />
                <ActivityComposer onActivityLogged={handleActivityLogged} />
                <NotesList refreshKey={notesRefreshKey} />
              </Box>
            </Grid>

            {/* Right Column - Tabs */}
            <Grid size={{ xs: 12, md: 8 }}>
              <Card>
                <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
                  <Tabs
                    value={tabValue}
                    onChange={(_, newValue) => setTabValue(newValue)}
                    aria-label="Lead detail tabs"
                    sx={{
                      px: 2,
                      '& .MuiTab-root': {
                        textTransform: 'none',
                        fontWeight: 500,
                        minHeight: 48,
                      },
                    }}
                  >
                    <Tab
                      label="Overview"
                      id="lead-tab-0"
                      aria-controls="lead-tabpanel-0"
                    />
                    <Tab
                      icon={<TimelineIcon sx={{ fontSize: 18 }} />}
                      iconPosition="start"
                      label="Score History"
                      id="lead-tab-1"
                      aria-controls="lead-tabpanel-1"
                    />
                    <Tab
                      icon={<EventIcon sx={{ fontSize: 18 }} />}
                      iconPosition="start"
                      label="Events"
                      id="lead-tab-2"
                      aria-controls="lead-tabpanel-2"
                    />
                  </Tabs>
                </Box>

                <CardContent>
                  {/* Overview Tab */}
                  <TabPanel value={tabValue} index={0}>
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                      <ContactInfo />
                      <CompanyInfo />
                      <Attribution />
                    </Box>
                  </TabPanel>

                  {/* Score History Tab */}
                  <TabPanel value={tabValue} index={1}>
                    <Box sx={{ mb: 3 }}>
                      <RecalculateButton onRecalculate={handleRecalculate} />
                    </Box>
                    <ScoreHistory key={refreshKey} leadId={record.id} limit={50} />
                  </TabPanel>

                  {/* Events Tab */}
                  <TabPanel value={tabValue} index={2}>
                    <EventTimeline leadId={record.id} limit={50} />
                  </TabPanel>
                </CardContent>
              </Card>
            </Grid>
          </Grid>
        </Box>

        <AssociatedObjectsPanel associations={associations} />
      </Box>
    </Box>
  );
};

/**
 * Main Lead Show Component
 */
const LeadShow = () => {
  return (
    <Show>
      <LeadContent />
    </Show>
  );
};

export default LeadShow;
