/**
 * Notification Preferences Component
 * Manages notification settings with LocalStorage persistence.
 * E-Mail-Vorlagen pro Event-Typ: Deal-Stage, Neuer Lead, wöchentliche Pipeline-Übersicht.
 */
import { useState, useEffect, useMemo } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  FormControlLabel,
  Switch,
  Divider,
  Alert,
  Grid,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Button,
} from '@mui/material';
import {
  Notifications as NotificationsIcon,
  Email as EmailIcon,
  NotificationsActive as PushIcon,
  Whatshot as HotLeadIcon,
  Assessment as ReportIcon,
} from '@mui/icons-material';
import {
  EVENT_TYPE_IDS,
  EVENT_TYPE_LABELS,
  DEFAULT_SUBJECTS,
  DEFAULT_HTML,
} from './notificationEmailTemplates';

const STORAGE_KEY = 'notification_preferences';
const TEMPLATE_KEY = 'notification_email_template';
const TEMPLATES_STORAGE_KEY = 'notification_email_templates';

const VARIABLES_BY_EVENT = {
  [EVENT_TYPE_IDS.DEAL_STAGE_CHANGE]:
    '{{deal.name}}, {{deal.value}}, {{deal.currency}}, {{deal.date}}, {{deal.link}}, {{lead.name}}, {{lead.email}}, {{company.name}}, {{stage.name}}, {{pipeline.name}}, {{stats.*}}',
  [EVENT_TYPE_IDS.NEW_LEAD]:
    '{{lead.name}}, {{lead.email}}, {{deal.date}}, {{deal.link}}, {{company.name}}',
  [EVENT_TYPE_IDS.WEEKLY_REPORT]:
    '{{deal.date}}, {{stats.revenue_won}}, {{stats.won_deals}}, {{stats.open_deals}}, {{stats.lost_deals}}, {{stats.leads}}, {{stats.customers}}, {{stats.avg_deal}}',
};

function getDefaultTemplates() {
  return {
    [EVENT_TYPE_IDS.DEAL_STAGE_CHANGE]: {
      to: '',
      subject: DEFAULT_SUBJECTS[EVENT_TYPE_IDS.DEAL_STAGE_CHANGE],
      html: DEFAULT_HTML[EVENT_TYPE_IDS.DEAL_STAGE_CHANGE],
    },
    [EVENT_TYPE_IDS.NEW_LEAD]: {
      to: '',
      subject: DEFAULT_SUBJECTS[EVENT_TYPE_IDS.NEW_LEAD],
      html: DEFAULT_HTML[EVENT_TYPE_IDS.NEW_LEAD],
    },
    [EVENT_TYPE_IDS.WEEKLY_REPORT]: {
      to: '',
      subject: DEFAULT_SUBJECTS[EVENT_TYPE_IDS.WEEKLY_REPORT],
      html: DEFAULT_HTML[EVENT_TYPE_IDS.WEEKLY_REPORT],
    },
  };
}

function loadTemplatesFromStorage() {
  try {
    const stored = localStorage.getItem(TEMPLATES_STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      const defaults = getDefaultTemplates();
      return {
        [EVENT_TYPE_IDS.DEAL_STAGE_CHANGE]: { ...defaults[EVENT_TYPE_IDS.DEAL_STAGE_CHANGE], ...parsed[EVENT_TYPE_IDS.DEAL_STAGE_CHANGE] },
        [EVENT_TYPE_IDS.NEW_LEAD]: { ...defaults[EVENT_TYPE_IDS.NEW_LEAD], ...parsed[EVENT_TYPE_IDS.NEW_LEAD] },
        [EVENT_TYPE_IDS.WEEKLY_REPORT]: { ...defaults[EVENT_TYPE_IDS.WEEKLY_REPORT], ...parsed[EVENT_TYPE_IDS.WEEKLY_REPORT] },
      };
    }
    // Migration: alte einzelne Vorlage → deal_stage_change
    const legacy = localStorage.getItem(TEMPLATE_KEY);
    if (legacy) {
      const parsed = JSON.parse(legacy);
      const defaults = getDefaultTemplates();
      const migrated = {
        ...defaults,
        [EVENT_TYPE_IDS.DEAL_STAGE_CHANGE]: {
          to: parsed.to ?? '',
          subject: parsed.subject ?? defaults[EVENT_TYPE_IDS.DEAL_STAGE_CHANGE].subject,
          html: parsed.html ?? defaults[EVENT_TYPE_IDS.DEAL_STAGE_CHANGE].html,
        },
      };
      localStorage.setItem(TEMPLATES_STORAGE_KEY, JSON.stringify(migrated));
      return migrated;
    }
  } catch (e) {
    console.error('Error loading notification templates:', e);
  }
  return getDefaultTemplates();
}

const NotificationPreferences = () => {
  const [notifications, setNotifications] = useState({
    email: true,
    push: false,
    hotLeads: true,
    weeklyReport: true,
  });
  const [lastSaved, setLastSaved] = useState(null);
  const [selectedEventType, setSelectedEventType] = useState(EVENT_TYPE_IDS.DEAL_STAGE_CHANGE);
  const [templatesByEvent, setTemplatesByEvent] = useState(getDefaultTemplates);

  const eventTypes = useMemo(() => [
    { id: EVENT_TYPE_IDS.DEAL_STAGE_CHANGE, label: EVENT_TYPE_LABELS[EVENT_TYPE_IDS.DEAL_STAGE_CHANGE] },
    { id: EVENT_TYPE_IDS.NEW_LEAD, label: EVENT_TYPE_LABELS[EVENT_TYPE_IDS.NEW_LEAD] },
    { id: EVENT_TYPE_IDS.WEEKLY_REPORT, label: EVENT_TYPE_LABELS[EVENT_TYPE_IDS.WEEKLY_REPORT] },
  ], []);

  const currentTemplate = templatesByEvent[selectedEventType] || {
    to: '',
    subject: DEFAULT_SUBJECTS[selectedEventType] || '',
    html: DEFAULT_HTML[selectedEventType] || '',
  };

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        setNotifications(JSON.parse(saved));
      } catch (error) {
        console.error('Error loading notification preferences:', error);
      }
    }
  }, []);

  useEffect(() => {
    setTemplatesByEvent(loadTemplatesFromStorage());
  }, []);

  const handleToggle = (key) => (event) => {
    const newValue = event.target.checked;
    const next = { ...notifications, [key]: newValue };
    setNotifications(next);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    setLastSaved(new Date());
  };

  const persistTemplates = (next) => {
    setTemplatesByEvent(next);
    localStorage.setItem(TEMPLATES_STORAGE_KEY, JSON.stringify(next));
    setLastSaved(new Date());
  };

  const handleTemplateFieldChange = (field) => (event) => {
    const value = event.target.value;
    const next = {
      ...templatesByEvent,
      [selectedEventType]: { ...currentTemplate, [field]: value },
    };
    persistTemplates(next);
  };

  const handleEventTypeChange = (event) => {
    setSelectedEventType(event.target.value);
  };

  const handleResetTemplateToDefault = () => {
    const defaultForEvent = {
      to: currentTemplate.to,
      subject: DEFAULT_SUBJECTS[selectedEventType],
      html: DEFAULT_HTML[selectedEventType],
    };
    const next = {
      ...templatesByEvent,
      [selectedEventType]: defaultForEvent,
    };
    persistTemplates(next);
  };

  return (
    <Grid container spacing={3}>
      <Grid item xs={12} md={8} lg={6}>
        <Card>
          <CardContent>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
              <NotificationsIcon color="primary" />
              <Typography variant="h6">Notification Preferences</Typography>
            </Box>

            <Alert severity="info" sx={{ mb: 3 }}>
              <Typography variant="body2">
                Diese Einstellungen werden lokal in Ihrem Browser gespeichert und gelten nur für dieses Gerät.
              </Typography>
            </Alert>

            <Box sx={{ mb: 3 }}>
              <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 2, fontWeight: 600 }}>
                Allgemeine Benachrichtigungen
              </Typography>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <Box>
                  <FormControlLabel
                    control={<Switch checked={notifications.email} onChange={handleToggle('email')} color="primary" />}
                    label={
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <EmailIcon fontSize="small" />
                        <Typography variant="body1">Email Notifications</Typography>
                      </Box>
                    }
                  />
                  <Typography variant="caption" color="text.secondary" sx={{ ml: 5, display: 'block' }}>
                    Erhalten Sie wichtige Updates per E-Mail
                  </Typography>
                </Box>
                <Box>
                  <FormControlLabel
                    control={<Switch checked={notifications.push} onChange={handleToggle('push')} color="primary" />}
                    label={
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <PushIcon fontSize="small" />
                        <Typography variant="body1">Push Notifications</Typography>
                      </Box>
                    }
                  />
                  <Typography variant="caption" color="text.secondary" sx={{ ml: 5, display: 'block' }}>
                    Desktop-Benachrichtigungen für zeitkritische Events
                  </Typography>
                </Box>
              </Box>
            </Box>

            <Divider sx={{ my: 3 }} />

            {/* E-Mail-Vorlagen pro Event */}
            <Box sx={{ mb: 3 }}>
              <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 2, fontWeight: 600 }}>
                E-Mail-Vorlagen pro Event
              </Typography>
              <FormControl fullWidth sx={{ mb: 2 }}>
                <InputLabel id="notification-event-label">Event-Typ</InputLabel>
                <Select
                  labelId="notification-event-label"
                  id="notification-event-select"
                  value={selectedEventType}
                  label="Event-Typ"
                  onChange={handleEventTypeChange}
                >
                  {eventTypes.map(({ id, label }) => (
                    <MenuItem key={id} value={id}>{label}</MenuItem>
                  ))}
                </Select>
              </FormControl>
              <Typography variant="caption" color="text.secondary" sx={{ mb: 2, display: 'block' }}>
                {selectedEventType === EVENT_TYPE_IDS.DEAL_STAGE_CHANGE && 'Wird bei Pipeline-Automation „Benachrichtigung“ ausgelöst, wenn ein Deal in diese Stage wechselt.'}
                {selectedEventType === EVENT_TYPE_IDS.NEW_LEAD && 'Wird bei neuem Lead ausgelöst (Import, unbekannte Absender, Cituro-Webhook).'}
                {selectedEventType === EVENT_TYPE_IDS.WEEKLY_REPORT && 'Wird für die wöchentliche Pipeline-Übersicht verwendet.'}
              </Typography>
              <TextField
                label="Empfänger (To)"
                value={currentTemplate.to}
                onChange={handleTemplateFieldChange('to')}
                fullWidth
                placeholder="fadmin@dna-me.net"
                sx={{ mb: 2 }}
              />
              <TextField
                label="Betreff"
                value={currentTemplate.subject}
                onChange={handleTemplateFieldChange('subject')}
                fullWidth
                sx={{ mb: 2 }}
              />
              <TextField
                label="Template (Text/HTML)"
                value={currentTemplate.html}
                onChange={handleTemplateFieldChange('html')}
                fullWidth
                multiline
                rows={10}
              />
              <Box sx={{ mt: 2, display: 'flex', alignItems: 'center', gap: 2 }}>
                <Button size="small" variant="outlined" onClick={handleResetTemplateToDefault}>
                  Vorlage auf Standard zurücksetzen
                </Button>
              </Box>
              <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
                Verfügbare Variablen: {VARIABLES_BY_EVENT[selectedEventType]}
              </Typography>
            </Box>

            <Divider sx={{ my: 3 }} />

            <Box>
              <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 2, fontWeight: 600 }}>
                Lead & Sales Benachrichtigungen
              </Typography>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <Box>
                  <FormControlLabel
                    control={<Switch checked={notifications.hotLeads} onChange={handleToggle('hotLeads')} color="primary" />}
                    label={
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <HotLeadIcon fontSize="small" sx={{ color: 'error.main' }} />
                        <Typography variant="body1">Hot Lead Alerts</Typography>
                      </Box>
                    }
                  />
                  <Typography variant="caption" color="text.secondary" sx={{ ml: 5, display: 'block' }}>
                    Sofortige Benachrichtigung bei Leads mit Score ≥ 80
                  </Typography>
                </Box>
                <Box>
                  <FormControlLabel
                    control={<Switch checked={notifications.weeklyReport} onChange={handleToggle('weeklyReport')} color="primary" />}
                    label={
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <ReportIcon fontSize="small" />
                        <Typography variant="body1">Weekly Report Summary</Typography>
                      </Box>
                    }
                  />
                  <Typography variant="caption" color="text.secondary" sx={{ ml: 5, display: 'block' }}>
                    Wöchentliche Zusammenfassung Ihrer Performance-Metriken
                  </Typography>
                </Box>
              </Box>
            </Box>

            {lastSaved && (
              <Box sx={{ mt: 3, pt: 2, borderTop: 1, borderColor: 'divider' }}>
                <Typography variant="caption" color="success.main">
                  ✓ Einstellungen gespeichert um {lastSaved.toLocaleTimeString('de-DE')}
                </Typography>
              </Box>
            )}
          </CardContent>
        </Card>

        <Card sx={{ mt: 3 }}>
          <CardContent>
            <Typography variant="subtitle2" sx={{ mb: 2, fontWeight: 600 }}>
              Aktuelle Einstellungen
            </Typography>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                <Typography variant="body2" color="text.secondary">Email Notifications:</Typography>
                <Typography variant="body2" fontWeight={500}>{notifications.email ? '✅ Aktiviert' : '❌ Deaktiviert'}</Typography>
              </Box>
              <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                <Typography variant="body2" color="text.secondary">Push Notifications:</Typography>
                <Typography variant="body2" fontWeight={500}>{notifications.push ? '✅ Aktiviert' : '❌ Deaktiviert'}</Typography>
              </Box>
              <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                <Typography variant="body2" color="text.secondary">Hot Lead Alerts:</Typography>
                <Typography variant="body2" fontWeight={500}>{notifications.hotLeads ? '✅ Aktiviert' : '❌ Deaktiviert'}</Typography>
              </Box>
              <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                <Typography variant="body2" color="text.secondary">Weekly Report:</Typography>
                <Typography variant="body2" fontWeight={500}>{notifications.weeklyReport ? '✅ Aktiviert' : '❌ Deaktiviert'}</Typography>
              </Box>
            </Box>
          </CardContent>
        </Card>
      </Grid>
    </Grid>
  );
};

export default NotificationPreferences;
export { loadTemplatesFromStorage, TEMPLATES_STORAGE_KEY, EVENT_TYPE_IDS };
