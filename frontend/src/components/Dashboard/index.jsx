/**
 * DNA ME CRM Dashboard
 * Placeholder for Phase 2 implementation
 */
import { Card, CardContent, Typography, Box, Grid, Chip } from '@mui/material';
import {
  TrendingUp,
  People,
  Handshake,
  AttachMoney,
  Speed,
} from '@mui/icons-material';

/**
 * KPI Card Component
 */
const KPICard = ({ title, value, change, icon: Icon, color }) => (
  <Card
    sx={{
      height: '100%',
      background: `linear-gradient(135deg, ${color}15 0%, ${color}05 100%)`,
      border: `1px solid ${color}30`,
    }}
  >
    <CardContent>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <Box>
          <Typography variant="overline" color="text.secondary">
            {title}
          </Typography>
          <Typography variant="h4" sx={{ fontWeight: 300, mt: 0.5 }}>
            {value}
          </Typography>
          {change && (
            <Chip
              icon={<TrendingUp sx={{ fontSize: 14 }} />}
              label={change}
              size="small"
              sx={{
                mt: 1,
                bgcolor: 'success.main',
                color: 'success.contrastText',
                fontSize: '0.7rem',
                height: 22,
              }}
            />
          )}
        </Box>
        <Box
          sx={{
            width: 48,
            height: 48,
            borderRadius: 2,
            bgcolor: `${color}20`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Icon sx={{ color, fontSize: 24 }} />
        </Box>
      </Box>
    </CardContent>
  </Card>
);

/**
 * Main Dashboard Component
 */
const Dashboard = () => {
  // Placeholder data - will be replaced with real API data in Phase 2
  const kpiData = [
    { title: 'Total Leads', value: '1,247', change: '+12.5%', icon: People, color: '#4A90A4' },
    { title: 'Qualified Leads', value: '328', change: '+8.3%', icon: Speed, color: '#6C5CE7' },
    { title: 'Active Deals', value: '89', change: '+15.2%', icon: Handshake, color: '#28A745' },
    { title: 'Pipeline Value', value: '€487K', change: '+22.1%', icon: AttachMoney, color: '#F59E0B' },
  ];

  return (
    <Box sx={{ p: 3 }}>
      {/* Header */}
      <Box sx={{ mb: 4 }}>
        <Typography variant="h4" sx={{ fontWeight: 300 }}>
          Dashboard
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Welcome to DNA ME CRM - Dev Mode Active
        </Typography>
      </Box>

      {/* KPI Cards */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        {kpiData.map((kpi, index) => (
          <Grid key={index} size={{ xs: 12, sm: 6, md: 3 }}>
            <KPICard {...kpi} />
          </Grid>
        ))}
      </Grid>

      {/* Placeholder for charts and other dashboard components */}
      <Grid container spacing={3}>
        <Grid size={{ xs: 12, md: 8 }}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Pipeline Overview
              </Typography>
              <Box
                sx={{
                  height: 300,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  bgcolor: 'background.default',
                  borderRadius: 2,
                  border: '1px dashed',
                  borderColor: 'divider',
                }}
              >
                <Typography color="text.secondary">
                  Pipeline Charts - Coming in Phase 2
                </Typography>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid size={{ xs: 12, md: 4 }}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Hot Leads
              </Typography>
              <Box
                sx={{
                  height: 300,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  bgcolor: 'background.default',
                  borderRadius: 2,
                  border: '1px dashed',
                  borderColor: 'divider',
                }}
              >
                <Typography color="text.secondary">
                  Hot Leads List - Coming in Phase 2
                </Typography>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid size={{ xs: 12 }}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Recent Activity
              </Typography>
              <Box
                sx={{
                  height: 200,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  bgcolor: 'background.default',
                  borderRadius: 2,
                  border: '1px dashed',
                  borderColor: 'divider',
                }}
              >
                <Typography color="text.secondary">
                  Activity Feed - Coming in Phase 2
                </Typography>
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
};

export default Dashboard;
