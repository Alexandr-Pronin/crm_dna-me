/**
 * Settings Page - Tab-based Layout
 * Integrated with real Team Management API
 */
import { useState } from 'react';
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
  Extension as IntegrationIcon,
  Settings as SettingsIcon,
} from '@mui/icons-material';
import TeamManagement from './TeamManagement';
import IntegrationSettings from './IntegrationSettings';
import SystemConfig from './SystemConfig';
import NotificationPreferences from './NotificationPreferences';

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

  const handleTabChange = (event, newValue) => {
    setActiveTab(newValue);
  };

  return (
    <Box sx={{ p: 3, width: '100%', maxWidth: '100%' }}>
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
          <Tab icon={<IntegrationIcon />} label="Integrations" iconPosition="start" />
          <Tab icon={<SettingsIcon />} label="System Config" iconPosition="start" />
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
                <Divider sx={{ my: 2 }} />
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
                  <Typography variant="caption" color="text.secondary" sx={{ mt: 1 }}>
                    Profile updates will be available in a future version.
                  </Typography>
                </Box>
              </CardContent>
            </Card>
          </Grid>
          <Grid size={{ xs: 12, md: 6 }}>
            <Card>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 3 }}>
                  <SettingsIcon color="primary" />
                  <Typography variant="h6">Account Settings</Typography>
                </Box>
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <TextField
                    label="Current Password"
                    type="password"
                    fullWidth
                    size="small"
                  />
                  <TextField
                    label="New Password"
                    type="password"
                    fullWidth
                    size="small"
                  />
                  <TextField
                    label="Confirm Password"
                    type="password"
                    fullWidth
                    size="small"
                  />
                  <Typography variant="caption" color="text.secondary" sx={{ mt: 1 }}>
                    Password change functionality will be available in a future version.
                  </Typography>
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

      {/* Integrations Tab */}
      <TabPanel value={activeTab} index={2}>
        <IntegrationSettings />
      </TabPanel>

      {/* System Config Tab */}
      <TabPanel value={activeTab} index={3}>
        <SystemConfig />
      </TabPanel>

      {/* Notifications Tab */}
      <TabPanel value={activeTab} index={4}>
        <NotificationPreferences />
      </TabPanel>

      {/* Appearance Tab */}
      <TabPanel value={activeTab} index={5}>
        <Grid container spacing={3}>
          <Grid size={{ xs: 12, md: 6 }}>
            <Card>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 3 }}>
                  <ThemeIcon color="primary" />
                  <Typography variant="h6">Appearance</Typography>
                </Box>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                  Customize the look and feel of your CRM
                </Typography>
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <FormControlLabel
                    control={<Switch checked={true} />}
                    label="Dark Mode"
                  />
                  <Typography variant="caption" color="text.secondary">
                    Dark mode is currently enabled by default. Theme switching will be available in a future version.
                  </Typography>
                  <Divider sx={{ my: 1 }} />
                  <Typography variant="subtitle2" fontWeight={500}>
                    Color Theme
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    DNA-ME Brand Colors (Active)
                  </Typography>
                </Box>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      </TabPanel>
    </Box>
  );
};

export default SettingsPage;
