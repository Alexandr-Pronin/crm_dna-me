/**
 * DNA ME CRM Custom Sidebar
 * Боковая панель с логотипом сверху, меню и профилем снизу (без верхнего header)
 */
import {
  Sidebar as RASidebar,
  SidebarToggleButton,
  UserMenu,
  Logout,
  useGetIdentity,
  ToggleThemeButton,
  LoadingIndicator,
  useSidebarState,
} from 'react-admin';
import { Box, Typography, IconButton, Tooltip, Divider, Avatar } from '@mui/material';
import { Biotech as BiotechIcon, Notifications as NotificationsIcon } from '@mui/icons-material';

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
 * Кастомный Sidebar: логотип + toggle сверху, меню по центру, профиль и действия снизу
 */
const Sidebar = (props) => {
  const { children, ...rest } = props;
  const [open] = useSidebarState();

  return (
    <RASidebar {...rest}>
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          height: '100%',
          minHeight: '100vh',
          overflow: 'hidden',
        }}
      >
        {/* Верх: кнопка меню + логотип (текст скрыт при свёрнутой панели) */}
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 0.5,
            py: 1.5,
            px: 0.5,
            borderBottom: '1px solid',
            borderColor: 'rgba(0, 128, 255, 0.2)',
            flexShrink: 0,
          }}
        >
          <SidebarToggleButton />
          <Box
            sx={{
              display: open ? 'flex' : 'none',
              alignItems: 'center',
              gap: 1,
              overflow: 'hidden',
              minWidth: 0,
            }}
          >
            <Box
              sx={{
                width: 32,
                height: 32,
                flexShrink: 0,
                borderRadius: 1.5,
                background: 'linear-gradient(135deg, #4A90A4 0%, #6C5CE7 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <BiotechIcon sx={{ color: 'white', fontSize: 18 }} />
            </Box>
            <Box sx={{ overflow: 'hidden', minWidth: 0 }}>
              <Typography
                variant="subtitle2"
                sx={{
                  fontWeight: 600,
                  letterSpacing: '0.05em',
                  color: 'text.primary',
                  lineHeight: 1.2,
                  fontSize: '0.9rem',
                }}
              >
                DNA ME
              </Typography>
              <Typography
                variant="caption"
                sx={{
                  color: 'text.secondary',
                  letterSpacing: '0.03em',
                  fontSize: '0.6rem',
                  display: 'block',
                }}
              >
                CRM DASHBOARD
              </Typography>
            </Box>
          </Box>
        </Box>

        {/* Меню — прокручиваемая область */}
        <Box sx={{ flex: 1, overflow: 'auto', py: 0.5 }}>
          {children}
        </Box>

        {/* Низ: при открытой панели — обновление, тема, уведомления; всегда — профиль */}
        <Box
          sx={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 0.5,
            py: 1.5,
            px: 0.5,
            borderTop: '1px solid',
            borderColor: 'rgba(0, 128, 255, 0.2)',
            flexShrink: 0,
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.25 }}>
            {open && (
              <>
                <LoadingIndicator />
                <ToggleThemeButton />
                <Tooltip title="Notifications">
                  <IconButton color="inherit" size="small">
                    <NotificationsIcon />
                  </IconButton>
                </Tooltip>
              </>
            )}
            <CustomUserMenu />
          </Box>
        </Box>
      </Box>
    </RASidebar>
  );
};

export default Sidebar;
