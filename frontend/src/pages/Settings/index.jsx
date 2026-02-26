/**
 * Settings Page - Tab-based Layout
 * Integrated with real Team Management API
 */
import { useState } from 'react';
import { useGetIdentity, useNotify } from 'react-admin';
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
  IconButton,
  Popover,
} from '@mui/material';
import {
  Person as PersonIcon,
  Notifications as NotificationsIcon,
  People as PeopleIcon,
  Palette as ThemeIcon,
  Extension as IntegrationIcon,
  Settings as SettingsIcon,
  ViewKanban as PipelineIcon,
} from '@mui/icons-material';
import AddPhotoAlternateIcon from '@mui/icons-material/AddPhotoAlternate';
import { API_URL } from '../../providers/dataProvider';

// Avatar-Dateien aus /public/avatars (wie auf RegisterPage)
const AVATAR_FILES = (() => {
  const list = [];
  for (let row = 1; row <= 5; row++) {
    for (let col = 1; col <= 9; col++) list.push(`row-${row}-column-${col}.png`);
  }
  for (let row = 6; row <= 9; row++) {
    for (let col = 5; col <= 9; col++) list.push(`row-${row}-column-${col}.png`);
  }
  return list;
})();
import TeamManagement from './TeamManagement';
import IntegrationSettings from './IntegrationSettings';
import SystemConfig from './SystemConfig';
import NotificationPreferences from './NotificationPreferences';
import { PipelineSettings } from '../Pipelines';

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

const ROLE_LABELS = {
  admin: 'Administrator',
  ae: 'Account Executive',
  bdr: 'BDR',
  partnership_manager: 'Partnership Manager',
  marketing_manager: 'Marketing Manager',
};

function getInitials(name) {
  if (!name) return '?';
  return name.split(' ').slice(0, 2).map((w) => w[0]?.toUpperCase()).join('');
}

const SettingsPage = () => {
  const [activeTab, setActiveTab] = useState(0);
  const { data: identity, refetch: refetchIdentity } = useGetIdentity();
  const [avatarAnchor, setAvatarAnchor] = useState(null);
  const [localAvatar, setLocalAvatar] = useState(null);
  const notify = useNotify();

  const handleTabChange = (event, newValue) => {
    setActiveTab(newValue);
  };

  const avatarPickerOpen = Boolean(avatarAnchor);
  const handleAvatarClick = (e) => setAvatarAnchor(e.currentTarget);
  const handleAvatarPickerClose = () => setAvatarAnchor(null);

  const handleSelectAvatar = async (filename) => {
    const avatarPath = `/avatars/${filename}`;
    if (!identity?.id) return;
    const token = localStorage.getItem('auth_token');
    try {
      const response = await fetch(`${API_URL}/team/${identity.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ avatar: avatarPath }),
      });
      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.message || 'Avatar konnte nicht gespeichert werden');
      }
      const user = JSON.parse(localStorage.getItem('auth_user') || '{}');
      localStorage.setItem('auth_user', JSON.stringify({ ...user, avatar: avatarPath }));
      setLocalAvatar(avatarPath);
      refetchIdentity?.();
      notify('Avatar wurde aktualisiert.', { type: 'success' });
    } catch (e) {
      notify(e.message || 'Fehler beim Speichern des Avatars', { type: 'warning' });
    }
    handleAvatarPickerClose();
  };

  const displayName = identity?.fullName || identity?.name || 'Admin User';
  const displayEmail = identity?.email || 'admin@dna-me.net';
  const roleLabel = identity?.role ? (ROLE_LABELS[identity.role] || identity.role) : 'Administrator';
  const currentAvatar = localAvatar ?? identity?.avatar;

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
          <Tab icon={<PipelineIcon />} label="Pipelines" iconPosition="start" />
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
                  <Box
                    sx={{
                      position: 'relative',
                      '&:hover .profile-avatar-overlay': { opacity: 1 },
                    }}
                  >
                    <IconButton
                      onClick={handleAvatarClick}
                      className="profile-avatar-overlay"
                      size="small"
                      sx={{
                        position: 'absolute',
                        left: '50%',
                        top: '50%',
                        transform: 'translate(-50%, -50%)',
                        zIndex: 1,
                        opacity: currentAvatar ? 0 : 1,
                        transition: 'opacity 0.2s',
                        bgcolor: 'rgba(0,0,0,0.5)',
                        color: 'white',
                        '&:hover': { bgcolor: 'rgba(0,0,0,0.7)' },
                      }}
                    >
                      <AddPhotoAlternateIcon fontSize="small" />
                    </IconButton>
                    <Avatar
                      src={currentAvatar}
                      onClick={handleAvatarClick}
                      sx={{
                        width: 64,
                        height: 64,
                        bgcolor: 'primary.main',
                        fontSize: 24,
                        cursor: 'pointer',
                      }}
                    >
                      {!currentAvatar ? getInitials(displayName) : null}
                    </Avatar>
                  </Box>
                  <Box>
                    <Typography variant="subtitle1" fontWeight={500}>
                      {displayName}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      {displayEmail}
                    </Typography>
                    <Chip label={roleLabel} size="small" sx={{ mt: 0.5 }} />
                  </Box>
                </Box>
                <Popover
                  open={avatarPickerOpen}
                  anchorEl={avatarAnchor}
                  onClose={handleAvatarPickerClose}
                  anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
                  transformOrigin={{ vertical: 'top', horizontal: 'center' }}
                  PaperProps={{
                    sx: {
                      p: 1.5,
                      maxHeight: 320,
                      border: '1px solid',
                      borderColor: 'divider',
                    },
                  }}
                >
                  <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1, px: 0.5 }}>
                    Avatar wählen
                  </Typography>
                  <Box
                    sx={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(6, 1fr)',
                      gap: 0.5,
                      overflow: 'auto',
                    }}
                  >
                    {AVATAR_FILES.map((filename) => (
                      <Box
                        key={filename}
                        component="button"
                        type="button"
                        onClick={() => handleSelectAvatar(filename)}
                        sx={{
                          width: 44,
                          height: 44,
                          p: 0,
                          border: '2px solid transparent',
                          borderRadius: 1,
                          overflow: 'hidden',
                          cursor: 'pointer',
                          bgcolor: 'transparent',
                          '&:hover': { borderColor: 'primary.main' },
                          '&:focus': { outline: 'none', borderColor: 'primary.main' },
                        }}
                      >
                        <img
                          src={`/avatars/${filename}`}
                          alt=""
                          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                        />
                      </Box>
                    ))}
                  </Box>
                </Popover>
                <Divider sx={{ my: 2 }} />
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <TextField
                    label="Full Name"
                    value={displayName}
                    fullWidth
                    size="small"
                    InputProps={{ readOnly: true }}
                  />
                  <TextField
                    label="Email"
                    value={displayEmail}
                    fullWidth
                    size="small"
                    InputProps={{ readOnly: true }}
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

      {/* Pipelines Tab */}
      <TabPanel value={activeTab} index={3}>
        <PipelineSettings />
      </TabPanel>

      {/* System Config Tab */}
      <TabPanel value={activeTab} index={4}>
        <SystemConfig />
      </TabPanel>

      {/* Notifications Tab */}
      <TabPanel value={activeTab} index={5}>
        <NotificationPreferences />
      </TabPanel>

      {/* Appearance Tab */}
      <TabPanel value={activeTab} index={6}>
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
