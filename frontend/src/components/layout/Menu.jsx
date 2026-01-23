/**
 * DNA ME CRM Sidebar Menu
 * Simplified menu as per Phase 2 requirements
 */
import { Menu as RAMenu, useSidebarState } from 'react-admin';
import { Box, Typography, Divider } from '@mui/material';
import {
  Dashboard as DashboardIcon,
  People as LeadsIcon,
  Handshake as DealsIcon,
  CheckCircle as TasksIcon,
  Business as OrganizationsIcon,
  Analytics as ReportsIcon,
  Settings as SettingsIcon,
  TrendingUp as ScoringIcon,
  Timeline as PipelineIcon,
} from '@mui/icons-material';

/**
 * Menu Section Header
 */
const MenuSection = ({ title, open }) => {
  if (!open) return <Divider sx={{ my: 1.5, mx: 1 }} />;
  
  return (
    <Box sx={{ px: 2, py: 1, mt: 1.5 }}>
      <Typography
        variant="overline"
        sx={{
          color: 'text.secondary',
          fontSize: '0.65rem',
          fontWeight: 600,
          letterSpacing: '0.1em',
        }}
      >
        {title}
      </Typography>
    </Box>
  );
};

/**
 * Custom Sidebar Menu
 * Links: Dashboard, Leads, Deals, Tasks, Reports (placeholder), Settings
 */
const Menu = (props) => {
  const [open] = useSidebarState();

  return (
    <RAMenu {...props}>
      {/* Main Navigation */}
      <RAMenu.DashboardItem
        primaryText="Dashboard"
        leftIcon={<DashboardIcon />}
      />

      {/* CRM Section */}
      <MenuSection title="CRM" open={open} />
      <RAMenu.ResourceItem
        name="leads"
        primaryText="Leads"
        leftIcon={<LeadsIcon />}
      />
      <RAMenu.ResourceItem
        name="deals"
        primaryText="Deals"
        leftIcon={<DealsIcon />}
      />
      <RAMenu.ResourceItem
        name="tasks"
        primaryText="Tasks"
        leftIcon={<TasksIcon />}
      />
      <RAMenu.ResourceItem
        name="organizations"
        primaryText="Organizations"
        leftIcon={<OrganizationsIcon />}
      />
      <RAMenu.ResourceItem
        name="pipelines"
        primaryText="Pipelines"
        leftIcon={<PipelineIcon />}
      />

      {/* Analytics Section */}
      <MenuSection title="Analytics" open={open} />
      <RAMenu.Item
        to="/reports"
        primaryText="Reports"
        leftIcon={<ReportsIcon />}
      />
      <RAMenu.Item
        to="/lead-scoring"
        primaryText="Lead Scoring"
        leftIcon={<ScoringIcon />}
      />

      {/* Settings Section */}
      <MenuSection title="System" open={open} />
      <RAMenu.Item
        to="/settings"
        primaryText="Settings"
        leftIcon={<SettingsIcon />}
      />
    </RAMenu>
  );
};

export default Menu;
