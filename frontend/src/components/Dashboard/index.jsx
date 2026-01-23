/**
 * DNA ME CRM Dashboard
 * Displays real-time KPIs from the API
 */
import { useState, useEffect } from 'react';
import { useDataProvider, useRedirect } from 'react-admin';
import {
  Card,
  CardContent,
  Typography,
  Box,
  Grid,
  Chip,
  CircularProgress,
  List,
  ListItem,
  ListItemText,
  ListItemAvatar,
  Avatar,
  Divider,
  Skeleton,
  Button,
  LinearProgress,
} from '@mui/material';
import {
  TrendingUp,
  People,
  Handshake,
  AttachMoney,
  Speed,
  Whatshot as HotIcon,
  ArrowForward as ArrowIcon,
  Email as EmailIcon,
  Phone as PhoneIcon,
  Business as BusinessIcon,
} from '@mui/icons-material';

/**
 * KPI Card Component
 */
const KPICard = ({ title, value, subtext, icon: Icon, color, loading }) => (
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
          {loading ? (
            <Skeleton variant="text" width={80} height={40} />
          ) : (
            <Typography variant="h4" sx={{ fontWeight: 300, mt: 0.5 }}>
              {value}
            </Typography>
          )}
          {subtext && !loading && (
            <Typography variant="caption" color="text.secondary">
              {subtext}
            </Typography>
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
 * Hot Lead Item Component
 */
const HotLeadItem = ({ lead, onClick }) => {
  const fullName = `${lead.first_name || ''} ${lead.last_name || ''}`.trim() || lead.email;
  const scoreColor = lead.total_score >= 70 ? '#28A745' : lead.total_score >= 40 ? '#F59E0B' : '#4A90A4';

  return (
    <ListItem
      sx={{
        cursor: 'pointer',
        '&:hover': { bgcolor: 'action.hover' },
        borderRadius: 1,
      }}
      onClick={() => onClick(lead.id)}
    >
      <ListItemAvatar>
        <Avatar sx={{ bgcolor: `${scoreColor}20`, color: scoreColor }}>
          {lead.total_score}
        </Avatar>
      </ListItemAvatar>
      <ListItemText
        primary={fullName}
        secondary={
          <Box component="span" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Typography variant="caption" color="text.secondary">
              {lead.email}
            </Typography>
            {lead.primary_intent && (
              <Chip label={lead.primary_intent} size="small" sx={{ height: 18, fontSize: '0.65rem' }} />
            )}
          </Box>
        }
        primaryTypographyProps={{ variant: 'body2', fontWeight: 500 }}
        secondaryTypographyProps={{ component: 'div' }}
      />
    </ListItem>
  );
};

/**
 * Pipeline Stage Bar Component
 */
const PipelineStageBar = ({ stages, total }) => {
  if (!stages || stages.length === 0) return null;

  const colors = ['#4A90A4', '#6C5CE7', '#F59E0B', '#17A2B8', '#28A745', '#DC3545'];

  return (
    <Box sx={{ mt: 2 }}>
      <Box sx={{ display: 'flex', height: 8, borderRadius: 1, overflow: 'hidden', mb: 1 }}>
        {stages.map((stage, index) => (
          <Box
            key={stage.stage_id}
            sx={{
              flex: stage.deals_count || 1,
              bgcolor: colors[index % colors.length],
              minWidth: stage.deals_count > 0 ? 4 : 0,
            }}
          />
        ))}
      </Box>
      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1.5 }}>
        {stages.slice(0, 5).map((stage, index) => (
          <Box key={stage.stage_id} sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <Box
              sx={{
                width: 8,
                height: 8,
                borderRadius: '50%',
                bgcolor: colors[index % colors.length],
              }}
            />
            <Typography variant="caption" color="text.secondary">
              {stage.stage_name}: {stage.deals_count}
            </Typography>
          </Box>
        ))}
      </Box>
    </Box>
  );
};

/**
 * Recent Deal Component
 */
const RecentDealItem = ({ deal }) => {
  const formatCurrency = (value) => {
    if (!value) return '—';
    return `€${value.toLocaleString()}`;
  };

  return (
    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', py: 1 }}>
      <Box>
        <Typography variant="body2" fontWeight={500}>
          {deal.name || `Deal ${deal.id?.slice(0, 8)}`}
        </Typography>
        <Typography variant="caption" color="text.secondary">
          {deal.pipeline_name || 'Pipeline'} • {deal.stage_name || 'Stage'}
        </Typography>
      </Box>
      <Typography variant="body2" fontWeight={600} color="primary.main">
        {formatCurrency(deal.value)}
      </Typography>
    </Box>
  );
};

/**
 * Main Dashboard Component
 */
const Dashboard = () => {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalLeads: 0,
    qualifiedLeads: 0,
    activeDeals: 0,
    pipelineValue: 0,
  });
  const [hotLeads, setHotLeads] = useState([]);
  const [recentDeals, setRecentDeals] = useState([]);
  const [pipelineMetrics, setPipelineMetrics] = useState(null);

  const dataProvider = useDataProvider();
  const redirect = useRedirect();

  useEffect(() => {
    const loadDashboardData = async () => {
      setLoading(true);
      try {
        // Load leads, deals, and pipeline data in parallel
        const [leadsRes, dealsRes, pipelinesRes] = await Promise.all([
          dataProvider.getList('leads', {
            pagination: { page: 1, perPage: 100 },
            sort: { field: 'total_score', order: 'DESC' },
            filter: {},
          }),
          dataProvider.getList('deals', {
            pagination: { page: 1, perPage: 50 },
            sort: { field: 'created_at', order: 'DESC' },
            filter: {},
          }),
          fetch('http://localhost:3000/api/v1/pipelines?with_summary=true', {
            headers: {
              'X-API-Key': 'test123',
              'Accept': 'application/json',
            },
          }).then(res => res.json()).catch(() => ({ data: [] })),
        ]);

        const leads = leadsRes.data || [];
        const deals = dealsRes.data || [];
        const pipelines = pipelinesRes.data || [];

        // Calculate stats
        const totalLeads = leadsRes.total || leads.length;
        const qualifiedLeads = leads.filter(l => 
          l.lifecycle_stage === 'mql' || l.lifecycle_stage === 'sql' || l.lifecycle_stage === 'opportunity'
        ).length;
        const activeDeals = deals.filter(d => d.status === 'open').length;
        const pipelineValue = deals
          .filter(d => d.status === 'open')
          .reduce((sum, d) => sum + (d.value || 0), 0);

        setStats({
          totalLeads,
          qualifiedLeads,
          activeDeals,
          pipelineValue,
        });

        // Get hot leads (top 5 by score)
        const sortedLeads = [...leads].sort((a, b) => (b.total_score || 0) - (a.total_score || 0));
        setHotLeads(sortedLeads.slice(0, 5));

        // Get recent deals
        setRecentDeals(deals.slice(0, 5));

        // Get pipeline metrics for the first pipeline
        if (pipelines.length > 0) {
          try {
            const metricsRes = await fetch(`http://localhost:3000/api/v1/pipelines/${pipelines[0].id}/metrics`, {
              headers: {
                'X-API-Key': 'test123',
                'Accept': 'application/json',
              },
            });
            if (metricsRes.ok) {
              const metrics = await metricsRes.json();
              setPipelineMetrics(metrics);
            }
          } catch (err) {
            console.error('Failed to load pipeline metrics:', err);
          }
        }
      } catch (err) {
        console.error('Failed to load dashboard data:', err);
      } finally {
        setLoading(false);
      }
    };

    loadDashboardData();
  }, [dataProvider]);

  const formatCurrency = (value) => {
    if (value >= 1000000) {
      return `€${(value / 1000000).toFixed(1)}M`;
    }
    if (value >= 1000) {
      return `€${(value / 1000).toFixed(0)}K`;
    }
    return `€${value.toLocaleString()}`;
  };

  const handleLeadClick = (leadId) => {
    redirect('show', 'leads', leadId);
  };

  const kpiData = [
    {
      title: 'Total Leads',
      value: stats.totalLeads.toLocaleString(),
      subtext: 'All tracked leads',
      icon: People,
      color: '#4A90A4',
    },
    {
      title: 'Qualified Leads',
      value: stats.qualifiedLeads.toLocaleString(),
      subtext: 'MQL, SQL, Opportunity',
      icon: Speed,
      color: '#6C5CE7',
    },
    {
      title: 'Active Deals',
      value: stats.activeDeals.toLocaleString(),
      subtext: 'Open opportunities',
      icon: Handshake,
      color: '#28A745',
    },
    {
      title: 'Pipeline Value',
      value: formatCurrency(stats.pipelineValue),
      subtext: 'Total open deal value',
      icon: AttachMoney,
      color: '#F59E0B',
    },
  ];

  return (
    <Box sx={{ p: 3, width: '100%', maxWidth: '100%' }}>
      {/* Header */}
      <Box sx={{ mb: 4 }}>
        <Typography variant="h4" sx={{ fontWeight: 300 }}>
          Dashboard
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Welcome to DNA ME CRM - Real-time data from your pipeline
        </Typography>
      </Box>

      {/* KPI Cards */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        {kpiData.map((kpi, index) => (
          <Grid key={index} item xs={12} sm={6} md={3}>
            <KPICard {...kpi} loading={loading} />
          </Grid>
        ))}
      </Grid>

      {/* Main Content */}
      <Grid container spacing={3}>
        {/* Pipeline Overview */}
        <Grid item xs={12} md={8}>
          <Card sx={{ height: '100%' }}>
            <CardContent>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                <Typography variant="h6">
                  Pipeline Overview
                </Typography>
                <Button
                  size="small"
                  endIcon={<ArrowIcon />}
                  onClick={() => redirect('list', 'deals')}
                >
                  View All Deals
                </Button>
              </Box>

              {loading ? (
                <Box sx={{ py: 4 }}>
                  <Skeleton variant="rectangular" height={100} />
                </Box>
              ) : pipelineMetrics ? (
                <Box>
                  <Grid container spacing={2} sx={{ mb: 3 }}>
                    <Grid item xs={6} sm={3}>
                      <Typography variant="caption" color="text.secondary">Total Deals</Typography>
                      <Typography variant="h6">{pipelineMetrics.total_deals}</Typography>
                    </Grid>
                    <Grid item xs={6} sm={3}>
                      <Typography variant="caption" color="text.secondary">Won</Typography>
                      <Typography variant="h6" color="success.main">{pipelineMetrics.won_deals}</Typography>
                    </Grid>
                    <Grid item xs={6} sm={3}>
                      <Typography variant="caption" color="text.secondary">Win Rate</Typography>
                      <Typography variant="h6">{((pipelineMetrics.win_rate || 0) * 100).toFixed(1)}%</Typography>
                    </Grid>
                    <Grid item xs={6} sm={3}>
                      <Typography variant="caption" color="text.secondary">Won Value</Typography>
                      <Typography variant="h6">{formatCurrency(pipelineMetrics.won_value || 0)}</Typography>
                    </Grid>
                  </Grid>
                  <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                    {pipelineMetrics.pipeline_name || 'Pipeline'} Stage Distribution
                  </Typography>
                  <PipelineStageBar
                    stages={pipelineMetrics.stages}
                    total={pipelineMetrics.total_deals}
                  />
                </Box>
              ) : (
                <Box sx={{ textAlign: 'center', py: 4 }}>
                  <Typography color="text.secondary">
                    No pipeline data available
                  </Typography>
                </Box>
              )}

              {/* Recent Deals */}
              {!loading && recentDeals.length > 0 && (
                <Box sx={{ mt: 3 }}>
                  <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                    Recent Deals
                  </Typography>
                  <Divider sx={{ mb: 1 }} />
                  {recentDeals.map((deal, index) => (
                    <Box key={deal.id}>
                      <RecentDealItem deal={deal} />
                      {index < recentDeals.length - 1 && <Divider />}
                    </Box>
                  ))}
                </Box>
              )}
            </CardContent>
          </Card>
        </Grid>

        {/* Hot Leads */}
        <Grid item xs={12} md={4}>
          <Card sx={{ height: '100%' }}>
            <CardContent>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <HotIcon sx={{ color: '#DC3545' }} />
                  <Typography variant="h6">
                    Hot Leads
                  </Typography>
                </Box>
                <Button
                  size="small"
                  endIcon={<ArrowIcon />}
                  onClick={() => redirect('list', 'leads')}
                >
                  View All
                </Button>
              </Box>

              {loading ? (
                <Box>
                  {[1, 2, 3, 4, 5].map(i => (
                    <Box key={i} sx={{ display: 'flex', alignItems: 'center', gap: 2, py: 1 }}>
                      <Skeleton variant="circular" width={40} height={40} />
                      <Box sx={{ flex: 1 }}>
                        <Skeleton variant="text" width="60%" />
                        <Skeleton variant="text" width="40%" />
                      </Box>
                    </Box>
                  ))}
                </Box>
              ) : hotLeads.length > 0 ? (
                <List disablePadding>
                  {hotLeads.map((lead, index) => (
                    <Box key={lead.id}>
                      <HotLeadItem lead={lead} onClick={handleLeadClick} />
                      {index < hotLeads.length - 1 && <Divider />}
                    </Box>
                  ))}
                </List>
              ) : (
                <Box sx={{ textAlign: 'center', py: 4 }}>
                  <Typography color="text.secondary">
                    No leads with scores yet
                  </Typography>
                </Box>
              )}
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
};

export default Dashboard;
