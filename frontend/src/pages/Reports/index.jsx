/**
 * Reports Page - Real Data with Recharts
 * Displays CRM metrics, pipeline funnel, lead sources, and time series data
 */
import { useState, useEffect, useMemo } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Grid,
  Chip,
  CircularProgress,
  Alert,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Skeleton,
  useTheme,
  alpha,
} from '@mui/material';
import {
  TrendingUp as TrendingUpIcon,
  People as PeopleIcon,
  AttachMoney as MoneyIcon,
  EmojiEvents as TrophyIcon,
  Timeline as TimelineIcon,
  PieChart as PieChartIcon,
  Refresh as RefreshIcon,
} from '@mui/icons-material';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
  AreaChart,
  Area,
  FunnelChart,
  Funnel,
  LabelList,
} from 'recharts';
import { format, subDays, parseISO, startOfDay, eachDayOfInterval } from 'date-fns';
import { de } from 'date-fns/locale';

import {
  getRoutingStats,
  getLeadStats,
  getDealStats,
  getPipelineMetrics,
  getPipelinesWithSummary,
  getLeadsTimeSeries,
} from '../../providers/dataProvider';

// Color palette for charts - Deep jewel tones
const CHART_COLORS = [
  '#6C5CE7', // Purple
  '#00CEC9', // Teal
  '#FD79A8', // Pink
  '#FDCB6E', // Yellow
  '#74B9FF', // Blue
  '#55EFC4', // Mint
  '#E17055', // Coral
  '#A29BFE', // Lavender
];

const FUNNEL_COLORS = [
  '#6C5CE7',
  '#7B6CF0',
  '#8A7CF9',
  '#998CFF',
  '#A89CFF',
  '#B7ACFF',
  '#C6BCFF',
  '#D5CCFF',
];

// KPI Card Component
const KPICard = ({ title, value, subtitle, icon: Icon, loading, color = 'primary' }) => {
  const theme = useTheme();
  
  return (
    <Card 
      sx={{ 
        height: '100%',
        background: `linear-gradient(135deg, ${alpha(theme.palette[color].main, 0.08)} 0%, ${alpha(theme.palette[color].main, 0.02)} 100%)`,
        border: `1px solid ${alpha(theme.palette[color].main, 0.12)}`,
        transition: 'transform 0.2s ease, box-shadow 0.2s ease',
        '&:hover': {
          transform: 'translateY(-4px)',
          boxShadow: `0 8px 24px ${alpha(theme.palette[color].main, 0.15)}`,
        }
      }}
    >
      <CardContent sx={{ p: 2.5 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <Box sx={{ flex: 1 }}>
            <Typography 
              variant="overline" 
              sx={{ 
                color: 'text.secondary',
                fontWeight: 600,
                letterSpacing: 1,
                fontSize: '0.65rem'
              }}
            >
              {title}
            </Typography>
            {loading ? (
              <Skeleton width={100} height={48} />
            ) : (
              <Typography 
                variant="h4" 
                sx={{ 
                  fontWeight: 700, 
                  mt: 0.5,
                  background: `linear-gradient(135deg, ${theme.palette[color].main} 0%, ${theme.palette[color].dark} 100%)`,
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  backgroundClip: 'text',
                }}
              >
                {value}
              </Typography>
            )}
            {subtitle && (
              <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
                {subtitle}
              </Typography>
            )}
          </Box>
          <Box
            sx={{
              width: 52,
              height: 52,
              borderRadius: 3,
              background: `linear-gradient(135deg, ${theme.palette[color].main} 0%, ${theme.palette[color].dark} 100%)`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: `0 4px 14px ${alpha(theme.palette[color].main, 0.4)}`,
            }}
          >
            <Icon sx={{ color: 'white', fontSize: 26 }} />
          </Box>
        </Box>
      </CardContent>
    </Card>
  );
};

// Custom Tooltip for Charts
const CustomTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    return (
      <Box
        sx={{
          bgcolor: 'background.paper',
          p: 1.5,
          borderRadius: 2,
          boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
          border: '1px solid',
          borderColor: 'divider',
        }}
      >
        <Typography variant="body2" sx={{ fontWeight: 600, mb: 0.5 }}>
          {label}
        </Typography>
        {payload.map((entry, index) => (
          <Typography 
            key={index} 
            variant="body2" 
            sx={{ color: entry.color }}
          >
            {entry.name}: {typeof entry.value === 'number' ? entry.value.toLocaleString('de-DE') : entry.value}
          </Typography>
        ))}
      </Box>
    );
  }
  return null;
};

// Main Reports Page Component
const ReportsPage = () => {
  const theme = useTheme();
  
  // State
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedPipelineId, setSelectedPipelineId] = useState('');
  
  // Data states
  const [routingStats, setRoutingStats] = useState(null);
  const [leadStats, setLeadStats] = useState(null);
  const [dealStats, setDealStats] = useState(null);
  const [pipelineMetrics, setPipelineMetrics] = useState(null);
  const [pipelines, setPipelines] = useState([]);
  const [leadsTimeSeries, setLeadsTimeSeries] = useState([]);

  // Fetch all data
  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      setError(null);
      
      try {
        // Fetch all stats in parallel
        const [routingRes, leadRes, dealRes, pipelinesRes] = await Promise.all([
          getRoutingStats(),
          getLeadStats(),
          getDealStats(),
          getPipelinesWithSummary(),
        ]);
        
        setRoutingStats(routingRes.data || routingRes);
        setLeadStats(leadRes);
        setDealStats(dealRes);
        setPipelines(pipelinesRes.data || []);
        
        // Set default pipeline if available
        if (pipelinesRes.data?.length > 0) {
          setSelectedPipelineId(pipelinesRes.data[0].id);
        }
        
        // Fetch time series data (last 30 days) - limited to 100 due to API constraint
        const thirtyDaysAgo = subDays(new Date(), 30);
        const timeSeriesRes = await getLeadsTimeSeries({
          created_after: thirtyDaysAgo.toISOString(),
          limit: 100,
        });
        setLeadsTimeSeries(timeSeriesRes.data || []);
        
      } catch (err) {
        console.error('Error fetching reports data:', err);
        setError(err.message || 'Fehler beim Laden der Daten');
      } finally {
        setLoading(false);
      }
    };
    
    fetchData();
  }, []);
  
  // Fetch pipeline metrics when selection changes
  useEffect(() => {
    if (!selectedPipelineId) return;
    
    const fetchPipelineMetrics = async () => {
      try {
        const metrics = await getPipelineMetrics(selectedPipelineId);
        setPipelineMetrics(metrics);
      } catch (err) {
        console.error('Error fetching pipeline metrics:', err);
      }
    };
    
    fetchPipelineMetrics();
  }, [selectedPipelineId]);

  // Process time series data for chart
  const timeSeriesChartData = useMemo(() => {
    if (!leadsTimeSeries.length) return [];
    
    // Group leads by day
    const today = new Date();
    const thirtyDaysAgo = subDays(today, 30);
    const days = eachDayOfInterval({ start: thirtyDaysAgo, end: today });
    
    const leadsByDay = {};
    days.forEach(day => {
      leadsByDay[format(day, 'yyyy-MM-dd')] = 0;
    });
    
    leadsTimeSeries.forEach(lead => {
      if (lead.created_at) {
        const day = format(parseISO(lead.created_at), 'yyyy-MM-dd');
        if (leadsByDay[day] !== undefined) {
          leadsByDay[day]++;
        }
      }
    });
    
    return days.map(day => ({
      date: format(day, 'dd. MMM', { locale: de }),
      leads: leadsByDay[format(day, 'yyyy-MM-dd')] || 0,
    }));
  }, [leadsTimeSeries]);

  // Process funnel data
  const funnelData = useMemo(() => {
    if (!pipelineMetrics?.stages) return [];
    
    return pipelineMetrics.stages
      .sort((a, b) => a.stage_position - b.stage_position)
      .map((stage, index) => ({
        name: stage.stage_name,
        value: stage.deals_count,
        fill: FUNNEL_COLORS[index % FUNNEL_COLORS.length],
      }));
  }, [pipelineMetrics]);

  // Process pie chart data for lead sources (by intent)
  const leadSourceData = useMemo(() => {
    if (!routingStats?.by_intent) return [];
    
    return routingStats.by_intent.map((item, index) => ({
      name: item.intent || 'Unbekannt',
      value: item.count,
      color: CHART_COLORS[index % CHART_COLORS.length],
    }));
  }, [routingStats]);

  // Process pipeline distribution data
  const pipelineDistributionData = useMemo(() => {
    if (!routingStats?.by_pipeline) return [];
    
    return routingStats.by_pipeline.map((item, index) => ({
      name: item.pipeline_name || 'Unbekannt',
      value: item.count,
      color: CHART_COLORS[index % CHART_COLORS.length],
    }));
  }, [routingStats]);

  // Calculate KPI values
  const kpiData = useMemo(() => {
    const totalLeads = routingStats?.total_leads || 0;
    const routedLeads = routingStats?.routed || 0;
    const conversionRate = totalLeads > 0 
      ? ((routedLeads / totalLeads) * 100).toFixed(1) 
      : 0;
    
    // Parse values to numbers (API might return strings for decimal values)
    const totalPipelineValue = pipelines.reduce((sum, p) => sum + (parseFloat(p.total_value) || 0), 0);
    const totalDeals = pipelines.reduce((sum, p) => sum + (parseInt(p.deals_count, 10) || 0), 0);
    const avgDealValue = totalDeals > 0 ? totalPipelineValue / totalDeals : 0;
    
    const wonDeals = parseInt(dealStats?.by_status?.won, 10) || 0;
    const lostDeals = parseInt(dealStats?.by_status?.lost, 10) || 0;
    const closedDeals = wonDeals + lostDeals;
    const winRate = closedDeals > 0 
      ? ((wonDeals / closedDeals) * 100).toFixed(1) 
      : 0;
    
    return {
      totalLeads,
      conversionRate,
      totalPipelineValue,
      avgDealValue,
      winRate,
      openDeals: parseInt(dealStats?.by_status?.open, 10) || 0,
      wonDeals,
    };
  }, [routingStats, pipelines, dealStats]);

  // Format currency - ensures value is parsed as number
  const formatCurrency = (value) => {
    const numValue = typeof value === 'string' ? parseFloat(value) : (value || 0);
    return new Intl.NumberFormat('de-DE', {
      style: 'currency',
      currency: 'EUR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(isNaN(numValue) ? 0 : numValue);
  };

  if (error) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert 
          severity="error" 
          action={
            <RefreshIcon 
              sx={{ cursor: 'pointer' }} 
              onClick={() => window.location.reload()} 
            />
          }
        >
          {error}
        </Alert>
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3, width: '100%', maxWidth: '100%' }}>
      {/* Page Header */}
      <Box sx={{ mb: 4 }}>
        <Typography 
          variant="h4" 
          sx={{ 
            fontWeight: 700,
            background: 'linear-gradient(135deg, #6C5CE7 0%, #A29BFE 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
          }}
        >
          Reports & Analytics
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
          Übersicht über Ihre CRM-Performance-Metriken
        </Typography>
      </Box>

      {/* KPI Cards */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <KPICard
            title="Gesamt Leads"
            value={kpiData.totalLeads.toLocaleString('de-DE')}
            subtitle={`${routingStats?.routed || 0} geroutet`}
            icon={PeopleIcon}
            loading={loading}
            color="primary"
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <KPICard
            title="Routing-Rate"
            value={`${kpiData.conversionRate}%`}
            subtitle="Leads erfolgreich geroutet"
            icon={TrendingUpIcon}
            loading={loading}
            color="success"
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <KPICard
            title="Pipeline-Wert"
            value={formatCurrency(kpiData.totalPipelineValue)}
            subtitle={`${kpiData.openDeals} offene Deals`}
            icon={MoneyIcon}
            loading={loading}
            color="warning"
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <KPICard
            title="Win-Rate"
            value={`${kpiData.winRate}%`}
            subtitle={`${kpiData.wonDeals} gewonnene Deals`}
            icon={TrophyIcon}
            loading={loading}
            color="info"
          />
        </Grid>
      </Grid>

      {/* Charts Row 1 */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        {/* Lead Acquisition Trend */}
        <Grid size={{ xs: 12, lg: 8 }}>
          <Card sx={{ height: '100%' }}>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
                <TimelineIcon sx={{ mr: 1, color: 'primary.main' }} />
                <Typography variant="h6" sx={{ fontWeight: 600 }}>
                  Lead-Akquisition (letzte 30 Tage)
                </Typography>
              </Box>
              
              {loading ? (
                <Skeleton variant="rectangular" height={300} sx={{ borderRadius: 2 }} />
              ) : timeSeriesChartData.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <AreaChart data={timeSeriesChartData}>
                    <defs>
                      <linearGradient id="colorLeads" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#6C5CE7" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="#6C5CE7" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke={alpha(theme.palette.divider, 0.5)} />
                    <XAxis 
                      dataKey="date" 
                      tick={{ fontSize: 11 }}
                      tickLine={false}
                      axisLine={{ stroke: theme.palette.divider }}
                      interval="preserveStartEnd"
                    />
                    <YAxis 
                      tick={{ fontSize: 11 }}
                      tickLine={false}
                      axisLine={{ stroke: theme.palette.divider }}
                      allowDecimals={false}
                    />
                    <Tooltip content={<CustomTooltip />} />
                    <Area
                      type="monotone"
                      dataKey="leads"
                      name="Neue Leads"
                      stroke="#6C5CE7"
                      strokeWidth={2}
                      fillOpacity={1}
                      fill="url(#colorLeads)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <Box 
                  sx={{ 
                    height: 300, 
                    display: 'flex', 
                    alignItems: 'center', 
                    justifyContent: 'center',
                    color: 'text.secondary' 
                  }}
                >
                  <Typography>Keine Daten verfügbar</Typography>
                </Box>
              )}
            </CardContent>
          </Card>
        </Grid>

        {/* Lead Sources Pie Chart */}
        <Grid size={{ xs: 12, lg: 4 }}>
          <Card sx={{ height: '100%' }}>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
                <PieChartIcon sx={{ mr: 1, color: 'primary.main' }} />
                <Typography variant="h6" sx={{ fontWeight: 600 }}>
                  Lead-Quellen (Intent)
                </Typography>
              </Box>
              
              {loading ? (
                <Skeleton variant="circular" width={250} height={250} sx={{ mx: 'auto' }} />
              ) : leadSourceData.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={leadSourceData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={100}
                      paddingAngle={2}
                      dataKey="value"
                    >
                      {leadSourceData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip content={<CustomTooltip />} />
                    <Legend 
                      verticalAlign="bottom" 
                      height={36}
                      formatter={(value) => (
                        <span style={{ color: theme.palette.text.primary, fontSize: 12 }}>
                          {value}
                        </span>
                      )}
                    />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <Box 
                  sx={{ 
                    height: 300, 
                    display: 'flex', 
                    alignItems: 'center', 
                    justifyContent: 'center',
                    color: 'text.secondary' 
                  }}
                >
                  <Typography>Keine Daten verfügbar</Typography>
                </Box>
              )}
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Charts Row 2 */}
      <Grid container spacing={3}>
        {/* Pipeline Funnel */}
        <Grid size={{ xs: 12, lg: 8 }}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3 }}>
                <Box sx={{ display: 'flex', alignItems: 'center' }}>
                  <TrendingUpIcon sx={{ mr: 1, color: 'primary.main' }} />
                  <Typography variant="h6" sx={{ fontWeight: 600 }}>
                    Pipeline Funnel
                  </Typography>
                </Box>
                
                <FormControl size="small" sx={{ minWidth: 200 }}>
                  <InputLabel>Pipeline</InputLabel>
                  <Select
                    value={selectedPipelineId}
                    label="Pipeline"
                    onChange={(e) => setSelectedPipelineId(e.target.value)}
                  >
                    {pipelines.map((pipeline) => (
                      <MenuItem key={pipeline.id} value={pipeline.id}>
                        {pipeline.name}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Box>
              
              {loading ? (
                <Skeleton variant="rectangular" height={350} sx={{ borderRadius: 2 }} />
              ) : funnelData.length > 0 ? (
                <Box>
                  {/* Pipeline Summary */}
                  {pipelineMetrics && (
                    <Box 
                      sx={{ 
                        display: 'flex', 
                        gap: 3, 
                        mb: 3,
                        p: 2,
                        bgcolor: alpha(theme.palette.primary.main, 0.04),
                        borderRadius: 2,
                      }}
                    >
                      <Box>
                        <Typography variant="caption" color="text.secondary">Total Deals</Typography>
                        <Typography variant="h6" sx={{ fontWeight: 600 }}>
                          {parseInt(pipelineMetrics.total_deals, 10) || 0}
                        </Typography>
                      </Box>
                      <Box>
                        <Typography variant="caption" color="text.secondary">Gesamtwert</Typography>
                        <Typography variant="h6" sx={{ fontWeight: 600 }}>
                          {formatCurrency(parseFloat(pipelineMetrics.total_value) || 0)}
                        </Typography>
                      </Box>
                      <Box>
                        <Typography variant="caption" color="text.secondary">Win-Rate</Typography>
                        <Typography variant="h6" sx={{ fontWeight: 600, color: 'success.main' }}>
                          {((parseFloat(pipelineMetrics.win_rate) || 0) * 100).toFixed(1)}%
                        </Typography>
                      </Box>
                      <Box>
                        <Typography variant="caption" color="text.secondary">Ø Deal-Wert</Typography>
                        <Typography variant="h6" sx={{ fontWeight: 600 }}>
                          {formatCurrency(parseFloat(pipelineMetrics.avg_deal_value) || 0)}
                        </Typography>
                      </Box>
                    </Box>
                  )}
                  
                  {/* Horizontal Bar Chart as Funnel alternative */}
                  <ResponsiveContainer width="100%" height={280}>
                    <BarChart
                      data={funnelData}
                      layout="vertical"
                      margin={{ top: 5, right: 30, left: 100, bottom: 5 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                      <XAxis type="number" />
                      <YAxis 
                        dataKey="name" 
                        type="category"
                        tick={{ fontSize: 12 }}
                        width={90}
                      />
                      <Tooltip content={<CustomTooltip />} />
                      <Bar 
                        dataKey="value" 
                        name="Deals"
                        radius={[0, 4, 4, 0]}
                      >
                        {funnelData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.fill} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </Box>
              ) : (
                <Box 
                  sx={{ 
                    height: 350, 
                    display: 'flex', 
                    alignItems: 'center', 
                    justifyContent: 'center',
                    color: 'text.secondary' 
                  }}
                >
                  <Typography>
                    {selectedPipelineId ? 'Keine Deals in dieser Pipeline' : 'Bitte wählen Sie eine Pipeline'}
                  </Typography>
                </Box>
              )}
            </CardContent>
          </Card>
        </Grid>

        {/* Pipeline Distribution */}
        <Grid size={{ xs: 12, lg: 4 }}>
          <Card sx={{ height: '100%' }}>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
                <PieChartIcon sx={{ mr: 1, color: 'primary.main' }} />
                <Typography variant="h6" sx={{ fontWeight: 600 }}>
                  Leads pro Pipeline
                </Typography>
              </Box>
              
              {loading ? (
                <Skeleton variant="circular" width={250} height={250} sx={{ mx: 'auto' }} />
              ) : pipelineDistributionData.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={pipelineDistributionData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={100}
                      paddingAngle={2}
                      dataKey="value"
                    >
                      {pipelineDistributionData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip content={<CustomTooltip />} />
                    <Legend 
                      verticalAlign="bottom" 
                      height={36}
                      formatter={(value) => (
                        <span style={{ color: theme.palette.text.primary, fontSize: 12 }}>
                          {value}
                        </span>
                      )}
                    />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <Box 
                  sx={{ 
                    height: 300, 
                    display: 'flex', 
                    alignItems: 'center', 
                    justifyContent: 'center',
                    color: 'text.secondary' 
                  }}
                >
                  <Typography>Keine Daten verfügbar</Typography>
                </Box>
              )}
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Deal Status Overview */}
      <Grid container spacing={3} sx={{ mt: 1 }}>
        <Grid size={12}>
          <Card>
            <CardContent>
              <Typography variant="h6" sx={{ fontWeight: 600, mb: 3 }}>
                Deal-Status Übersicht
              </Typography>
              
              {loading ? (
                <Skeleton variant="rectangular" height={100} sx={{ borderRadius: 2 }} />
              ) : (
                <Box sx={{ display: 'flex', gap: 3 }}>
                  <Box 
                    sx={{ 
                      flex: 1, 
                      p: 2, 
                      borderRadius: 2,
                      bgcolor: alpha(theme.palette.info.main, 0.08),
                      border: `1px solid ${alpha(theme.palette.info.main, 0.2)}`,
                    }}
                  >
                    <Typography variant="caption" color="text.secondary">Offen</Typography>
                    <Typography variant="h4" sx={{ fontWeight: 700, color: 'info.main' }}>
                      {dealStats?.by_status?.open || 0}
                    </Typography>
                  </Box>
                  <Box 
                    sx={{ 
                      flex: 1, 
                      p: 2, 
                      borderRadius: 2,
                      bgcolor: alpha(theme.palette.success.main, 0.08),
                      border: `1px solid ${alpha(theme.palette.success.main, 0.2)}`,
                    }}
                  >
                    <Typography variant="caption" color="text.secondary">Gewonnen</Typography>
                    <Typography variant="h4" sx={{ fontWeight: 700, color: 'success.main' }}>
                      {dealStats?.by_status?.won || 0}
                    </Typography>
                  </Box>
                  <Box 
                    sx={{ 
                      flex: 1, 
                      p: 2, 
                      borderRadius: 2,
                      bgcolor: alpha(theme.palette.error.main, 0.08),
                      border: `1px solid ${alpha(theme.palette.error.main, 0.2)}`,
                    }}
                  >
                    <Typography variant="caption" color="text.secondary">Verloren</Typography>
                    <Typography variant="h4" sx={{ fontWeight: 700, color: 'error.main' }}>
                      {dealStats?.by_status?.lost || 0}
                    </Typography>
                  </Box>
                </Box>
              )}
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
};

export default ReportsPage;
