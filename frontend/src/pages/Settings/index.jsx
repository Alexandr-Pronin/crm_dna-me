/**
 * Settings Page - Tab-based Layout
 * Integrated with real Team Management API
 */
import { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Grid,
  TextField,
  Button,
  Switch,
  FormControlLabel,
  Divider,
  Avatar,
  Chip,
  Tabs,
  Tab,
} from '@mui/material';
import {
  Person as PersonIcon,
  Notifications as NotificationsIcon,
  People as PeopleIcon,
  Palette as ThemeIcon,
} from '@mui/icons-material';
import TeamManagement from './TeamManagement';

// TabPanel component
const TabPanel = ({ children, value, index, ...other }) => {
  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`settings-tabpanel-${index}`}
      aria-labelledby={`settings-tab-${index}`}
      {...other}
    >
      {value === index && <Box sx={{ pt: 3 }}>{children}</Box>}
    </div>
  );
};

const SettingsPage = () => {
  const [activeTab, setActiveTab] = useState(0);
  const [notifications, setNotifications] = useState({
    email: true,
    push: false,
    hotLeads: true,
    weeklyReport: true,
  });

  // Load notification preferences from localStorage
  useEffect(() => {
    const saved = localStorage.getItem('notification_preferences');
    if (saved) {
      try {
        setNotifications(JSON.parse(saved));
      } catch (error) {
        console.error('Error loading notification preferences:', error);
      }
    }
  }, []);

  const handleTabChange = (event, newValue) => {
    setActiveTab(newValue);
  };

  return (
    <Box sx={{ p: 3 }}>
      {/* Page Header */}
      <Box sx={{ mb: 3 }}>
        <Typography variant="h4" sx={{ fontWeight: 300 }}>
          Settings
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Configure your CRM preferences
        </Typography>
      </Box>

      {/* Tabs */}
      <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 2 }}>
        <Tabs value={activeTab} onChange={handleTabChange} aria-label="settings tabs">
          <Tab icon={<PersonIcon />} label="Profile" iconPosition="start" />
          <Tab icon={<PeopleIcon />} label="Team Management" iconPosition="start" />
          <Tab icon={<NotificationsIcon />} label="Notifications" iconPosition="start" />
          <Tab icon={<ThemeIcon />} label="Appearance" iconPosition="start" />
        </Tabs>
      </Box>

      {/* Tab Panels */}
      
      {/* Profile Tab */}
      <TabPanel value={activeTab} index={0}>
        <Grid container spacing={3}>
          <Grid size={{ xs: 12, md: 6 }}>
            <Card>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 3 }}>
                  <PersonIcon color="primary" />
                  <Typography variant="h6">Profile</Typography>
                </Box>
                <Chip
                  label="MOCK DATA"
                  size="small"
                  sx={{
                    mb: 2,
                    bgcolor: 'warning.main',
                    color: 'warning.contrastText',
                    fontWeight: 600,
                    fontSize: '0.65rem',
                  }}
                />
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3 }}>
                  <Avatar sx={{ width: 64, height: 64, bgcolor: 'primary.main', fontSize: 24 }}>
                    A
                  </Avatar>
                  <Box>
                    <Typography variant="subtitle1" fontWeight={500}>
                      Admin User
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      admin@dna-me.net
                    </Typography>
                    <Chip label="Administrator" size="small" sx={{ mt: 0.5 }} />
                  </Box>
                </Box>
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <TextField
                    label="Full Name"
                    defaultValue="Admin User"
                    fullWidth
                    size="small"
                  />
                  <TextField
                    label="Email"
                    defaultValue="admin@dna-me.net"
                    fullWidth
                    size="small"
                  />
                  <Button variant="outlined" disabled>
                    Update Profile (Mock)
                  </Button>
                </Box>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      </TabPanel>

      {/* Team Management Tab */}
      <TabPanel value={activeTab} index={1}>
        <TeamManagement />
      </TabPanel>

      {/* Notifications Tab */}
      <TabPanel value={activeTab} index={2}>
        <Grid container spacing={3}>
          <Grid size={{ xs: 12, md: 6 }}>
            <Card>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 3 }}>
                  <NotificationsIcon color="primary" />
                  <Typography variant="h6">Notification Preferences</Typography>
                </Box>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                  Preferences are stored locally in your browser
                </Typography>
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={notifications.email}
                        onChange={(e) => {
                          const newNotifications = { ...notifications, email: e.target.checked };
                          setNotifications(newNotifications);
                          localStorage.setItem('notification_preferences', JSON.stringify(newNotifications));
                        }}
                      />
                    }
                    label="Email Notifications"
                  />
                  <FormControlLabel
                    control={
                      <Switch
                        checked={notifications.push}
                        onChange={(e) => {
                          const newNotifications = { ...notifications, push: e.target.checked };
                          setNotifications(newNotifications);
                          localStorage.setItem('notification_preferences', JSON.stringify(newNotifications));
                        }}
                      />
                    }
                    label="Push Notifications"
                  />
                  <Divider sx={{ my: 1 }} />
                  <FormControlLabel
                    control={
                      <Switch
                        checked={notifications.hotLeads}
                        onChange={(e) => {
                          const newNotifications = { ...notifications, hotLeads: e.target.checked };
                          setNotifications(newNotifications);
                          localStorage.setItem('notification_preferences', JSON.stringify(newNotifications));
                        }}
                      />
                    }
                    label="Hot Lead Alerts"
                  />
                  <FormControlLabel
                    control={
                      <Switch
                        checked={notifications.weeklyReport}
                        onChange={(e) => {
                          const newNotifications = { ...notifications, weeklyReport: e.target.checked };
                          setNotifications(newNotifications);
                          localStorage.setItem('notification_preferences', JSON.stringify(newNotifications));
                        }}
                      />
                    }
                    label="Weekly Report Summary"
                  />
                </Box>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      </TabPanel>

      {/* Appearance Tab */}
      <TabPanel value={activeTab} index={3}>
        <Grid container spacing={3}>
          <Grid size={{ xs: 12, md: 6 }}>
            <Card>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 3 }}>
                  <ThemeIcon color="primary" />
                  <Typography variant="h6">Appearance</Typography>
                </Box>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                  Theme customization options
                </Typography>
                <FormControlLabel
                  control={<Switch checked={true} disabled />}
                  label="Dark Mode (Default)"
                />
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      </TabPanel>
    </Box>
  );
};

export default SettingsPage;
