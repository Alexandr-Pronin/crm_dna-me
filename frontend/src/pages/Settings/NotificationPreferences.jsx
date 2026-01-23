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
} from '@mui/material';
import {
  Notifications as NotificationsIcon,
  Email as EmailIcon,
  NotificationsActive as PushIcon,
  Whatshot as HotLeadIcon,
  Assessment as ReportIcon,
} from '@mui/icons-material';

const STORAGE_KEY = 'notification_preferences';

const NotificationPreferences = () => {
  const [notifications, setNotifications] = useState({
    email: true,
    push: false,
    hotLeads: true,
    weeklyReport: true,
  });
  const [lastSaved, setLastSaved] = useState(null);

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

  // Save preference changes to localStorage
  const handleToggle = (key) => (event) => {
    const newValue = event.target.checked;
    const newNotifications = { ...notifications, [key]: newValue };
    
    setNotifications(newNotifications);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(newNotifications));
    setLastSaved(new Date());
    
    console.log(`Updated ${key} to ${newValue}`);
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
