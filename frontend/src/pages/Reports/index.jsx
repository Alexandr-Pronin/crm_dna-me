/**
 * Reports Page - MOCK DATA
 * As per FRONTEND_PLAN.md: Reports & Analytics use MOCKS
 */
import {
  Box,
  Typography,
  Card,
  CardContent,
  Grid,
  Chip,
} from '@mui/material';
import {
  Analytics as AnalyticsIcon,
  TrendingUp as TrendingUpIcon,
  People as PeopleIcon,
  AttachMoney as MoneyIcon,
} from '@mui/icons-material';

// Mock KPI Data
const mockKPIs = [
  { title: 'Total Leads', value: '2,847', change: '+12.5%', positive: true, icon: PeopleIcon },
  { title: 'Conversion Rate', value: '23.4%', change: '+3.2%', positive: true, icon: TrendingUpIcon },
  { title: 'Pipeline Value', value: '€487,230', change: '+18.7%', positive: true, icon: MoneyIcon },
  { title: 'Avg. Deal Size', value: '€12,450', change: '-2.1%', positive: false, icon: AnalyticsIcon },
];

const KPICard = ({ title, value, change, positive, icon: Icon }) => (
  <Card sx={{ height: '100%' }}>
    <CardContent>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <Box>
          <Typography variant="overline" color="text.secondary">
            {title}
          </Typography>
          <Typography variant="h4" sx={{ fontWeight: 300, mt: 0.5 }}>
            {value}
          </Typography>
          <Chip
            label={change}
            size="small"
            sx={{
              mt: 1,
              bgcolor: positive ? 'success.main' : 'error.main',
              color: 'white',
              fontSize: '0.7rem',
              height: 22,
            }}
          />
        </Box>
        <Box
          sx={{
            width: 48,
            height: 48,
            borderRadius: 2,
            bgcolor: 'primary.main',
            opacity: 0.1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Icon sx={{ color: 'primary.main', fontSize: 24 }} />
        </Box>
      </Box>
    </CardContent>
  </Card>
);

const ReportsPage = () => {
  return (
    <Box sx={{ p: 3, width: '100%', maxWidth: '100%' }}>
      {/* Page Header */}
      <Box sx={{ mb: 4 }}>
        <Typography variant="h4" sx={{ fontWeight: 300 }}>
          Reports & Analytics
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Track your CRM performance metrics
        </Typography>
        <Chip
          label="MOCK DATA"
          size="small"
          sx={{
            mt: 1,
            bgcolor: 'warning.main',
            color: 'warning.contrastText',
            fontWeight: 600,
            fontSize: '0.65rem',
          }}
        />
      </Box>

      {/* KPI Cards */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        {mockKPIs.map((kpi, index) => (
          <Grid key={index} size={{ xs: 12, sm: 6, md: 3 }}>
            <KPICard {...kpi} />
          </Grid>
        ))}
      </Grid>

      {/* Chart Placeholders */}
      <Grid container spacing={3}>
        <Grid size={{ xs: 12, md: 8 }}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Lead Acquisition Trend
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
                <Box sx={{ textAlign: 'center' }}>
                  <AnalyticsIcon sx={{ fontSize: 48, color: 'text.secondary', mb: 1 }} />
                  <Typography color="text.secondary">
                    Charts will be implemented with Recharts
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    Using mock data until Analytics API is ready
                  </Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid size={{ xs: 12, md: 4 }}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Lead Sources
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
                  Pie Chart Placeholder
                </Typography>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid size={12}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Pipeline Funnel
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
                  Funnel Chart Placeholder
                </Typography>
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
};

export default ReportsPage;
