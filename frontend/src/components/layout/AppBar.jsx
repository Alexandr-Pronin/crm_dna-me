/**
 * DNA ME CRM Custom App Bar
 */
import { AppBar as RAAppBar, TitlePortal, UserMenu, useGetIdentity } from 'react-admin';
import { Box, Typography, Chip, IconButton, Tooltip } from '@mui/material';
import {
  Biotech as BiotechIcon,
  Notifications as NotificationsIcon,
  DarkMode as DarkModeIcon,
} from '@mui/icons-material';

/**
 * Custom App Bar with DNA ME branding
 */
const AppBar = (props) => {
  const { data: identity } = useGetIdentity();

  return (
    <RAAppBar
      {...props}
      sx={{
        backgroundColor: 'background.paper',
        backgroundImage: 'none',
        borderBottom: '1px solid',
        borderColor: 'divider',
        '& .RaAppBar-toolbar': {
          minHeight: 64,
        },
      }}
    >
      {/* Logo and Brand */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mr: 2 }}>
        <Box
          sx={{
            width: 36,
            height: 36,
            borderRadius: 2,
            background: 'linear-gradient(135deg, #4A90A4 0%, #6C5CE7 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <BiotechIcon sx={{ color: 'white', fontSize: 22 }} />
        </Box>
        <Box>
          <Typography
            variant="subtitle1"
            sx={{
              fontWeight: 600,
              letterSpacing: '0.05em',
              color: 'text.primary',
              lineHeight: 1.2,
            }}
          >
            DNA ME
          </Typography>
          <Typography
            variant="caption"
            sx={{
              color: 'text.secondary',
              letterSpacing: '0.03em',
              fontSize: '0.65rem',
            }}
          >
            CRM DASHBOARD
          </Typography>
        </Box>
      </Box>

      {/* Page Title Portal */}
      <TitlePortal />

      {/* Spacer */}
      <Box sx={{ flex: 1 }} />

      {/* Dev Mode Badge */}
      <Chip
        label="DEV MODE"
        size="small"
        sx={{
          bgcolor: 'warning.main',
          color: 'warning.contrastText',
          fontWeight: 600,
          fontSize: '0.65rem',
          height: 22,
          mr: 2,
        }}
      />

      {/* Notifications */}
      <Tooltip title="Notifications">
        <IconButton color="inherit" sx={{ mr: 1 }}>
          <NotificationsIcon />
        </IconButton>
      </Tooltip>

      {/* Theme Toggle (placeholder) */}
      <Tooltip title="Dark Mode">
        <IconButton color="inherit" sx={{ mr: 1 }}>
          <DarkModeIcon />
        </IconButton>
      </Tooltip>

      {/* User Menu */}
      <UserMenu>
        <Box sx={{ px: 2, py: 1 }}>
          <Typography variant="body2" fontWeight={500}>
            {identity?.fullName || 'Admin'}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            Administrator
          </Typography>
        </Box>
      </UserMenu>
    </RAAppBar>
  );
};

export default AppBar;
