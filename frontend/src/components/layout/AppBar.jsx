/**
 * DNA ME CRM Custom App Bar
 */
import {
  AppBar as RAAppBar,
  TitlePortal,
  UserMenu,
  Logout,
  useGetIdentity,
  ToggleThemeButton,
  LoadingIndicator,
} from 'react-admin';
import { Box, Typography, Chip, IconButton, Tooltip, Divider, Avatar } from '@mui/material';
import { Biotech as BiotechIcon, Notifications as NotificationsIcon } from '@mui/icons-material';

const ROLE_LABELS = {
  admin: 'Administrator',
  ae: 'Account Executive',
  bdr: 'BDR',
  partnership_manager: 'Partnership Manager',
  marketing_manager: 'Marketing Manager',
};

/**
 * Custom UserMenu with role above logout
 */
function getInitials(name) {
  if (!name) return '?';
  return name.split(' ').slice(0, 2).map((w) => w[0]?.toUpperCase()).join('');
}

const CustomUserMenu = () => {
  const { data: identity } = useGetIdentity();
  const role = identity?.role || 'admin';
  const roleLabel = ROLE_LABELS[role] || role;
  const displayName = identity?.fullName || identity?.name || 'Admin';

  return (
    <UserMenu>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, px: 2, py: 1.5 }}>
        <Avatar
          src={identity?.avatar}
          sx={{ width: 40, height: 40, bgcolor: 'primary.main', fontSize: '0.9rem' }}
        >
          {!identity?.avatar ? getInitials(displayName) : null}
        </Avatar>
        <Box>
          <Typography variant="body2" fontWeight={500}>
            {displayName}
          </Typography>
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.25 }}>
            {roleLabel}
          </Typography>
        </Box>
      </Box>
      <Divider sx={{ my: 1 }} />
      <Logout />
    </UserMenu>
  );
};

/**
 * Custom toolbar: one theme toggle, notifications, loading, user menu
 */
const AppBarToolbar = () => (
  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
    <LoadingIndicator />
    <ToggleThemeButton />
    <Tooltip title="Notifications">
      <IconButton color="inherit" size="small">
        <NotificationsIcon />
      </IconButton>
    </Tooltip>
    <CustomUserMenu />
  </Box>
);

/**
 * Custom App Bar with DNA ME branding
 */
const AppBar = (props) => {
  return (
    <RAAppBar
      {...props}
      userMenu={null}
      toolbar={<AppBarToolbar />}
      sx={{
        backgroundColor: 'rgba(18, 18, 26, 0.85)',
        backdropFilter: 'blur(10px)',
        WebkitBackdropFilter: 'blur(10px)',
        backgroundImage: 'none',
        borderBottom: '1px solid',
        borderColor: 'rgba(0, 128, 255, 0.2)',
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
    </RAAppBar>
  );
};

export default AppBar;
