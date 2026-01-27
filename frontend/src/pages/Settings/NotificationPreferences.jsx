/**
 * Notification Preferences Component
 * Manages notification settings with LocalStorage persistence
 */
import { useState, useEffect } from 'react';
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
} from '@mui/material';
import {
  Notifications as NotificationsIcon,
  Email as EmailIcon,
  NotificationsActive as PushIcon,
  Whatshot as HotLeadIcon,
  Assessment as ReportIcon,
} from '@mui/icons-material';

const STORAGE_KEY = 'notification_preferences';
const TEMPLATE_KEY = 'notification_email_template';

const DEFAULT_TEMPLATE = `
<div style="font-family: Inter, Arial, sans-serif; background:#f6f7fb; padding:24px; color:#111827;">
  <div style="max-width:640px; margin:0 auto; background:#ffffff; border-radius:12px; padding:24px; border:1px solid #e5e7eb;">
    <div style="display:flex; align-items:center; gap:10px; margin-bottom:16px;">
      <div style="width:10px; height:10px; border-radius:999px; background:#10b981;"></div>
      <div style="font-size:14px; color:#6b7280;">Deal Notification</div>
    </div>
    <h2 style="margin:0 0 12px; font-size:20px;">🔥 {{deal.name}}</h2>
    <div style="display:grid; gap:8px; font-size:14px;">
      <div><strong>Kunde:</strong> {{company.name}}</div>
      <div><strong>Kontakt:</strong> {{lead.name}} {{lead.email}}</div>
      <div><strong>Betrag:</strong> {{deal.value}} {{deal.currency}}</div>
      <div><strong>Datum:</strong> {{deal.date}}</div>
      <div><strong>Pipeline:</strong> {{pipeline.name}} / {{stage.name}}</div>
    </div>
    <a href="{{deal.link}}" target="_blank" rel="noopener noreferrer" style="display:inline-block;margin-top:16px;padding:10px 14px;border-radius:8px;background:#4A90A4;color:#ffffff;text-decoration:none;">Deal öffnen</a>
    <div style="margin-top:8px; font-size:12px; color:#6b7280;">
      {{deal.link}}
    </div>
    <hr style="border:none;border-top:1px solid #e5e7eb; margin:20px 0;" />
    <div style="display:grid; grid-template-columns: repeat(2, minmax(0,1fr)); gap:12px; font-size:13px; color:#374151;">
      <div style="padding:12px; background:#f9fafb; border-radius:8px;">
        <div style="font-size:12px; color:#6b7280;">Kunden insgesamt</div>
        <div style="font-size:16px; font-weight:600;">{{stats.customers}}</div>
      </div>
      <div style="padding:12px; background:#f9fafb; border-radius:8px;">
        <div style="font-size:12px; color:#6b7280;">Leads insgesamt</div>
        <div style="font-size:16px; font-weight:600;">{{stats.leads}}</div>
      </div>
      <div style="padding:12px; background:#f9fafb; border-radius:8px;">
        <div style="font-size:12px; color:#6b7280;">Deals insgesamt</div>
        <div style="font-size:16px; font-weight:600;">{{stats.deals}}</div>
      </div>
      <div style="padding:12px; background:#f9fafb; border-radius:8px;">
        <div style="font-size:12px; color:#6b7280;">Umsatz (Won)</div>
        <div style="font-size:16px; font-weight:600;">{{stats.revenue_won}} {{deal.currency}}</div>
      </div>
      <div style="padding:12px; background:#f9fafb; border-radius:8px;">
        <div style="font-size:12px; color:#6b7280;">Umsatz (Total)</div>
        <div style="font-size:16px; font-weight:600;">{{stats.revenue_total}} {{deal.currency}}</div>
      </div>
      <div style="padding:12px; background:#f9fafb; border-radius:8px;">
        <div style="font-size:12px; color:#6b7280;">Deals (Open/Won/Lost)</div>
        <div style="font-size:16px; font-weight:600;">{{stats.open_deals}} / {{stats.won_deals}} / {{stats.lost_deals}}</div>
      </div>
      <div style="padding:12px; background:#f9fafb; border-radius:8px;">
        <div style="font-size:12px; color:#6b7280;">Ø Deal Value</div>
        <div style="font-size:16px; font-weight:600;">{{stats.avg_deal}} {{deal.currency}}</div>
      </div>
    </div>
  </div>
</div>
`;

const NotificationPreferences = () => {
  const [notifications, setNotifications] = useState({
    email: true,
    push: false,
    hotLeads: true,
    weeklyReport: true,
  });
  const [lastSaved, setLastSaved] = useState(null);
  const [emailTemplate, setEmailTemplate] = useState({
    to: '',
    subject: '🔥 New Deal: {{deal.name}} ({{deal.value}} {{deal.currency}})',
    html: DEFAULT_TEMPLATE,
  });

  // Load preferences from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setNotifications(parsed);
        console.log('Loaded notification preferences from localStorage:', parsed);
      } catch (error) {
        console.error('Error loading notification preferences:', error);
      }
    }
  }, []);

  useEffect(() => {
    const savedTemplate = localStorage.getItem(TEMPLATE_KEY);
    if (savedTemplate) {
      try {
        const parsed = JSON.parse(savedTemplate);
        setEmailTemplate(prev => ({ ...prev, ...parsed }));
      } catch (error) {
        console.error('Error loading notification template:', error);
      }
    } else {
      localStorage.setItem(TEMPLATE_KEY, JSON.stringify(emailTemplate));
    }
  }, []);

  // Save preference changes to localStorage
  const handleToggle = (key) => (event) => {
    const newValue = event.target.checked;
    const newNotifications = { ...notifications, [key]: newValue };
    
    setNotifications(newNotifications);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(newNotifications));
    setLastSaved(new Date());
    
    console.log(`Updated ${key} to ${newValue}`);
  };

  const handleTemplateChange = (field) => (event) => {
    const next = { ...emailTemplate, [field]: event.target.value };
    setEmailTemplate(next);
    localStorage.setItem(TEMPLATE_KEY, JSON.stringify(next));
    setLastSaved(new Date());
  };

  return (
    <Grid container spacing={3}>
      <Grid item xs={12} md={8} lg={6}>
        <Card>
          <CardContent>
            {/* Header */}
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
              <NotificationsIcon color="primary" />
              <Typography variant="h6">Notification Preferences</Typography>
            </Box>

            {/* Info Alert */}
            <Alert severity="info" sx={{ mb: 3 }}>
              <Typography variant="body2">
                Diese Einstellungen werden lokal in Ihrem Browser gespeichert und gelten nur für dieses Gerät.
              </Typography>
            </Alert>

            {/* General Notifications */}
            <Box sx={{ mb: 3 }}>
              <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 2, fontWeight: 600 }}>
                Allgemeine Benachrichtigungen
              </Typography>
              
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <Box>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={notifications.email}
                        onChange={handleToggle('email')}
                        color="primary"
                      />
                    }
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
                    control={
                      <Switch
                        checked={notifications.push}
                        onChange={handleToggle('push')}
                        color="primary"
                      />
                    }
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

            {/* Email Notification Template */}
            <Box sx={{ mb: 3 }}>
              <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 2, fontWeight: 600 }}>
                Deal Notification E-Mail
              </Typography>
              <TextField
                label="Empfänger (To)"
                value={emailTemplate.to}
                onChange={handleTemplateChange('to')}
                fullWidth
                placeholder="fadmin@dna-me.net"
                sx={{ mb: 2 }}
              />
              <TextField
                label="Betreff"
                value={emailTemplate.subject}
                onChange={handleTemplateChange('subject')}
                fullWidth
                sx={{ mb: 2 }}
              />
              <TextField
                label="Template (Text/HTML)"
                value={emailTemplate.html}
                onChange={handleTemplateChange('html')}
                fullWidth
                multiline
                rows={8}
              />
              <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
                Verfügbare Variablen: {"{{deal.name}}"}, {"{{deal.value}}"}, {"{{deal.currency}}"}, {"{{deal.date}}"},
                {"{{deal.link}}"}, {"{{lead.name}}"}, {"{{lead.email}}"}, {"{{company.name}}"}, {"{{stage.name}}"}, {"{{pipeline.name}}"},
                {"{{stats.customers}}"}, {"{{stats.leads}}"}, {"{{stats.deals}}"}, {"{{stats.revenue_won}}"}, {"{{stats.revenue_total}}"},
                {"{{stats.open_deals}}"}, {"{{stats.won_deals}}"}, {"{{stats.lost_deals}}"}, {"{{stats.avg_deal}}"}
              </Typography>
            </Box>

            <Divider sx={{ my: 3 }} />

            {/* Lead & Sales Notifications */}
            <Box>
              <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 2, fontWeight: 600 }}>
                Lead & Sales Benachrichtigungen
              </Typography>
              
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <Box>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={notifications.hotLeads}
                        onChange={handleToggle('hotLeads')}
                        color="primary"
                      />
                    }
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
                    control={
                      <Switch
                        checked={notifications.weeklyReport}
                        onChange={handleToggle('weeklyReport')}
                        color="primary"
                      />
                    }
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

            {/* Last Saved Indicator */}
            {lastSaved && (
              <Box sx={{ mt: 3, pt: 2, borderTop: 1, borderColor: 'divider' }}>
                <Typography variant="caption" color="success.main">
                  ✓ Einstellungen gespeichert um {lastSaved.toLocaleTimeString('de-DE')}
                </Typography>
              </Box>
            )}
          </CardContent>
        </Card>

        {/* Current Settings Summary */}
        <Card sx={{ mt: 3 }}>
          <CardContent>
            <Typography variant="subtitle2" sx={{ mb: 2, fontWeight: 600 }}>
              Aktuelle Einstellungen
            </Typography>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                <Typography variant="body2" color="text.secondary">Email Notifications:</Typography>
                <Typography variant="body2" fontWeight={500}>
                  {notifications.email ? '✅ Aktiviert' : '❌ Deaktiviert'}
                </Typography>
              </Box>
              <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                <Typography variant="body2" color="text.secondary">Push Notifications:</Typography>
                <Typography variant="body2" fontWeight={500}>
                  {notifications.push ? '✅ Aktiviert' : '❌ Deaktiviert'}
                </Typography>
              </Box>
              <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                <Typography variant="body2" color="text.secondary">Hot Lead Alerts:</Typography>
                <Typography variant="body2" fontWeight={500}>
                  {notifications.hotLeads ? '✅ Aktiviert' : '❌ Deaktiviert'}
                </Typography>
              </Box>
              <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                <Typography variant="body2" color="text.secondary">Weekly Report:</Typography>
                <Typography variant="body2" fontWeight={500}>
                  {notifications.weeklyReport ? '✅ Aktiviert' : '❌ Deaktiviert'}
                </Typography>
              </Box>
            </Box>
          </CardContent>
        </Card>
      </Grid>
    </Grid>
  );
};

export default NotificationPreferences;
