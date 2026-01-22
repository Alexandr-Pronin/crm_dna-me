/**
 * Scoring Statistics Dashboard
 * KPIs, Lead Score Distribution Chart, Top Performing Rules
 * Uses REAL API: GET /scoring/stats
 */
import { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Grid,
  CircularProgress,
  Alert,
  IconButton,
  Tooltip,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Chip,
  Skeleton,
  LinearProgress,
} from '@mui/material';
import {
  Refresh as RefreshIcon,
  TrendingUp as TrendingUpIcon,
  Rule as RuleIcon,
  CheckCircle as ActiveIcon,
  Stars as PointsIcon,
  Timeline as HistoryIcon,
  People as LeadsIcon,
  EmojiEvents as TrophyIcon,
  LocalFireDepartment as FireIcon,
  AcUnit as ColdIcon,
  Whatshot as HotIcon,
} from '@mui/icons-material';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  Cell,
  PieChart,
  Pie,
  Legend,
} from 'recharts';
import { getScoringStats } from '../../providers/dataProvider';

/**
 * Tier colors for lead distribution
 */
const TIER_COLORS = {
  very_hot: { color: '#DC2626', bg: 'rgba(220, 38, 38, 0.15)', label: 'Very Hot', icon: FireIcon },
  hot: { color: '#EF4444', bg: 'rgba(239, 68, 68, 0.15)', label: 'Hot', icon: HotIcon },
  warm: { color: '#F59E0B', bg: 'rgba(245, 158, 11, 0.15)', label: 'Warm', icon: TrendingUpIcon },
  cold: { color: '#64748B', bg: 'rgba(100, 116, 139, 0.15)', label: 'Cold', icon: ColdIcon },
};

/**
 * Category colors
 */
const CATEGORY_COLORS = {
  demographic: '#4A90A4',
  engagement: '#6C5CE7',
  behavior: '#28A745',
};

/**
 * KPI Card Component
 */
const KPICard = ({ title, value, subtitle, icon: Icon, color, loading }) => (
  <Card
    sx={{
      height: '100%',
      background: `linear-gradient(135deg, ${color}15 0%, ${color}05 100%)`,
      border: `1px solid ${color}30`,
      transition: 'transform 0.2s, box-shadow 0.2s',
      '&:hover': {
        transform: 'translateY(-2px)',
        boxShadow: `0 8px 24px ${color}20`,
      },
    }}
  >
    <CardContent sx={{ p: 2.5, '&:last-child': { pb: 2.5 } }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <Box sx={{ flex: 1 }}>
          <Typography
            variant="overline"
            sx={{
              color: 'text.secondary',
              fontSize: '0.65rem',
              letterSpacing: 1,
              fontWeight: 600,
            }}
          >
            {title}
          </Typography>
          {loading ? (
            <Skeleton variant="text" width={80} height={48} />
          ) : (
            <Typography
              variant="h3"
              sx={{
                fontWeight: 300,
                mt: 0.5,
                color,
                lineHeight: 1.2,
              }}
            >
              {value}
            </Typography>
          )}
          {subtitle && !loading && (
            <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
              {subtitle}
            </Typography>
          )}
        </Box>
        <Box
          sx={{
            width: 52,
            height: 52,
            borderRadius: 2,
            bgcolor: `${color}20`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          <Icon sx={{ color, fontSize: 26 }} />
        </Box>
      </Box>
    </CardContent>
  </Card>
);

/**
 * Category Breakdown Mini Chart
 */
const CategoryBreakdown = ({ data, loading }) => {
  if (loading) {
    return (
      <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap' }}>
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} variant="rounded" width={100} height={32} />
        ))}
      </Box>
    );
  }

  const categories = [
    { key: 'demographic', label: 'Demographic', color: CATEGORY_COLORS.demographic },
    { key: 'engagement', label: 'Engagement', color: CATEGORY_COLORS.engagement },
    { key: 'behavior', label: 'Behavior', color: CATEGORY_COLORS.behavior },
  ];

  return (
    <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap' }}>
      {categories.map(({ key, label, color }) => (
        <Chip
          key={key}
          label={`${label}: ${data?.[key] || 0}`}
          size="small"
          sx={{
            bgcolor: `${color}20`,
            color,
            border: `1px solid ${color}40`,
            fontWeight: 500,
            fontSize: '0.75rem',
          }}
        />
      ))}
    </Box>
  );
};

/**
 * Lead Distribution Bar Chart
 */
const LeadDistributionChart = ({ data, loading }) => {
  if (loading) {
    return (
      <Box sx={{ height: 280, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <CircularProgress size={40} />
      </Box>
    );
  }

  if (!data || data.length === 0) {
    return (
      <Box
        sx={{
          height: 280,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          bgcolor: 'background.default',
          borderRadius: 2,
          border: '1px dashed',
          borderColor: 'divider',
        }}
      >
        <Typography color="text.secondary">Keine Lead-Daten verfügbar</Typography>
      </Box>
    );
  }

  // Transform data for chart
  const chartData = data.map((item) => ({
    tier: TIER_COLORS[item.tier]?.label || item.tier,
    count: item.count,
    fill: TIER_COLORS[item.tier]?.color || '#64748B',
  }));

  // Sort by tier importance
  const tierOrder = ['very_hot', 'hot', 'warm', 'cold'];
  const sortedData = [...data]
    .sort((a, b) => tierOrder.indexOf(a.tier) - tierOrder.indexOf(b.tier))
    .map((item) => ({
      tier: TIER_COLORS[item.tier]?.label || item.tier,
      count: item.count,
      fill: TIER_COLORS[item.tier]?.color || '#64748B',
    }));

  const CustomTooltip = ({ active, payload }) => {
    if (active && payload && payload.length) {
      return (
        <Box
          sx={{
            bgcolor: 'background.paper',
            border: '1px solid',
            borderColor: 'divider',
            borderRadius: 1,
            p: 1.5,
            boxShadow: 3,
          }}
        >
          <Typography variant="body2" fontWeight={600}>
            {payload[0].payload.tier}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {payload[0].value} Leads
          </Typography>
        </Box>
      );
    }
    return null;
  };

  return (
    <ResponsiveContainer width="100%" height={280}>
      <BarChart data={sortedData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
        <XAxis
          dataKey="tier"
          tick={{ fill: '#a0a0a0', fontSize: 12 }}
          axisLine={{ stroke: 'rgba(255,255,255,0.1)' }}
        />
        <YAxis
          tick={{ fill: '#a0a0a0', fontSize: 12 }}
          axisLine={{ stroke: 'rgba(255,255,255,0.1)' }}
        />
        <RechartsTooltip content={<CustomTooltip />} />
        <Bar dataKey="count" radius={[4, 4, 0, 0]} maxBarSize={60}>
          {sortedData.map((entry, index) => (
            <Cell key={`cell-${index}`} fill={entry.fill} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
};

/**
 * Rules Category Pie Chart
 */
const RulesCategoryChart = ({ data, loading }) => {
  if (loading || !data) {
    return (
      <Box sx={{ height: 200, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <CircularProgress size={32} />
      </Box>
    );
  }

  const chartData = Object.entries(data).map(([key, value]) => ({
    name: key.charAt(0).toUpperCase() + key.slice(1),
    value: value,
    fill: CATEGORY_COLORS[key] || '#64748B',
  }));

  if (chartData.every((d) => d.value === 0)) {
    return (
      <Box
        sx={{
          height: 200,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Typography color="text.secondary" variant="body2">
          Keine Regeln vorhanden
        </Typography>
      </Box>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={200}>
      <PieChart>
        <Pie
          data={chartData}
          cx="50%"
          cy="50%"
          innerRadius={45}
          outerRadius={70}
          paddingAngle={3}
          dataKey="value"
        >
          {chartData.map((entry, index) => (
            <Cell key={`cell-${index}`} fill={entry.fill} />
          ))}
        </Pie>
        <Legend
          verticalAlign="bottom"
          height={36}
          formatter={(value) => <span style={{ color: '#a0a0a0', fontSize: 12 }}>{value}</span>}
        />
      </PieChart>
    </ResponsiveContainer>
  );
};

/**
 * Top Rules Table
 */
const TopRulesTable = ({ rules, loading }) => {
  if (loading) {
    return (
      <Box>
        {[1, 2, 3, 4, 5].map((i) => (
          <Box key={i} sx={{ display: 'flex', gap: 2, py: 1.5, borderBottom: '1px solid', borderColor: 'divider' }}>
            <Skeleton variant="text" width={24} />
            <Skeleton variant="text" width="40%" />
            <Skeleton variant="text" width={60} sx={{ ml: 'auto' }} />
            <Skeleton variant="text" width={60} />
          </Box>
        ))}
      </Box>
    );
  }

  if (!rules || rules.length === 0) {
    return (
      <Box
        sx={{
          py: 6,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          bgcolor: 'background.default',
          borderRadius: 2,
          border: '1px dashed',
          borderColor: 'divider',
        }}
      >
        <TrophyIcon sx={{ fontSize: 48, color: 'text.secondary', opacity: 0.5, mb: 1 }} />
        <Typography color="text.secondary">Keine Scoring-Aktivität in den letzten 30 Tagen</Typography>
      </Box>
    );
  }

  // Calculate max applications for progress bar
  const maxApplications = Math.max(...rules.map((r) => r.applications));

  return (
    <TableContainer component={Paper} sx={{ bgcolor: 'transparent', boxShadow: 'none' }}>
      <Table size="small">
        <TableHead>
          <TableRow>
            <TableCell sx={{ width: 40, fontWeight: 600, color: 'text.secondary', fontSize: '0.75rem' }}>#</TableCell>
            <TableCell sx={{ fontWeight: 600, color: 'text.secondary', fontSize: '0.75rem' }}>Rule Name</TableCell>
            <TableCell align="right" sx={{ fontWeight: 600, color: 'text.secondary', fontSize: '0.75rem' }}>Applications</TableCell>
            <TableCell align="right" sx={{ fontWeight: 600, color: 'text.secondary', fontSize: '0.75rem' }}>Total Points</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {rules.map((rule, index) => (
            <TableRow
              key={rule.rule_slug}
              sx={{
                '&:hover': { bgcolor: 'action.hover' },
                '& td': { borderColor: 'divider' },
              }}
            >
              <TableCell>
                <Box
                  sx={{
                    width: 24,
                    height: 24,
                    borderRadius: '50%',
                    bgcolor: index < 3 ? 'warning.main' : 'action.selected',
                    color: index < 3 ? 'warning.contrastText' : 'text.secondary',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '0.75rem',
                    fontWeight: 600,
                  }}
                >
                  {index + 1}
                </Box>
              </TableCell>
              <TableCell>
                <Box>
                  <Typography variant="body2" fontWeight={500}>
                    {rule.rule_name}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {rule.rule_slug}
                  </Typography>
                  <LinearProgress
                    variant="determinate"
                    value={(rule.applications / maxApplications) * 100}
                    sx={{
                      mt: 0.5,
                      height: 3,
                      borderRadius: 1,
                      bgcolor: 'action.hover',
                      '& .MuiLinearProgress-bar': {
                        bgcolor: index < 3 ? 'warning.main' : 'primary.main',
                      },
                    }}
                  />
                </Box>
              </TableCell>
              <TableCell align="right">
                <Typography variant="body2" fontWeight={500}>
                  {rule.applications.toLocaleString()}
                </Typography>
              </TableCell>
              <TableCell align="right">
                <Chip
                  label={`+${rule.total_points.toLocaleString()}`}
                  size="small"
                  sx={{
                    bgcolor: 'rgba(40, 167, 69, 0.15)',
                    color: '#28A745',
                    fontWeight: 600,
                    fontSize: '0.75rem',
                  }}
                />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  );
};

/**
 * Main Scoring Stats Dashboard Component
 */
const ScoringStats = () => {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  /**
   * Fetch scoring statistics from API
   */
  const fetchStats = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await getScoringStats();
      setStats(response);
    } catch (err) {
      console.error('Failed to fetch scoring stats:', err);
      setError(err.message || 'Fehler beim Laden der Statistiken');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  // Calculate total leads from distribution
  const totalLeads = stats?.lead_distribution?.reduce((sum, item) => sum + item.count, 0) || 0;

  return (
    <Box>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Box>
          <Typography variant="h5" sx={{ fontWeight: 400, display: 'flex', alignItems: 'center', gap: 1 }}>
            <TrendingUpIcon sx={{ color: 'primary.main' }} />
            Scoring Statistics
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Übersicht über Lead-Scoring Aktivität und Performance
          </Typography>
        </Box>
        <Tooltip title="Aktualisieren">
          <span>
            <IconButton onClick={fetchStats} disabled={loading}>
              <RefreshIcon />
            </IconButton>
          </span>
        </Tooltip>
      </Box>

      {/* Error Alert */}
      {error && (
        <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {/* KPI Cards Row */}
      <Grid container spacing={2.5} sx={{ mb: 3 }}>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <KPICard
            title="Total Rules"
            value={stats?.rules?.total_rules ?? '—'}
            subtitle={stats?.rules?.active_rules ? `${stats.rules.active_rules} aktiv` : undefined}
            icon={RuleIcon}
            color="#4A90A4"
            loading={loading}
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <KPICard
            title="Active Rules"
            value={stats?.rules?.active_rules ?? '—'}
            subtitle={stats?.rules?.total_rules ? `von ${stats.rules.total_rules} gesamt` : undefined}
            icon={ActiveIcon}
            color="#28A745"
            loading={loading}
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <KPICard
            title="Points Awarded"
            value={stats?.history?.total_points_awarded?.toLocaleString() ?? '—'}
            subtitle={stats?.history?.total_entries ? `${stats.history.total_entries.toLocaleString()} Einträge` : undefined}
            icon={PointsIcon}
            color="#6C5CE7"
            loading={loading}
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <KPICard
            title="Scored Leads"
            value={totalLeads.toLocaleString()}
            subtitle={stats?.history?.expired_entries ? `${stats.history.expired_entries} expired` : undefined}
            icon={LeadsIcon}
            color="#F59E0B"
            loading={loading}
          />
        </Grid>
      </Grid>

      {/* Charts Row */}
      <Grid container spacing={3} sx={{ mb: 3 }}>
        {/* Lead Score Distribution */}
        <Grid size={{ xs: 12, md: 8 }}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                <Box>
                  <Typography variant="h6" sx={{ fontWeight: 500 }}>
                    Lead Score Distribution
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    Verteilung der Leads nach Score-Tier
                  </Typography>
                </Box>
                <Box sx={{ display: 'flex', gap: 1 }}>
                  {Object.entries(TIER_COLORS).map(([key, config]) => (
                    <Chip
                      key={key}
                      label={config.label}
                      size="small"
                      sx={{
                        bgcolor: config.bg,
                        color: config.color,
                        fontSize: '0.65rem',
                        height: 22,
                      }}
                    />
                  ))}
                </Box>
              </Box>
              <LeadDistributionChart data={stats?.lead_distribution} loading={loading} />
            </CardContent>
          </Card>
        </Grid>

        {/* Rules by Category */}
        <Grid size={{ xs: 12, md: 4 }}>
          <Card sx={{ height: '100%' }}>
            <CardContent>
              <Typography variant="h6" sx={{ fontWeight: 500, mb: 1 }}>
                Rules by Category
              </Typography>
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 2 }}>
                Verteilung der Scoring-Regeln
              </Typography>
              <RulesCategoryChart data={stats?.rules?.rules_by_category} loading={loading} />
              <Box sx={{ mt: 2 }}>
                <CategoryBreakdown data={stats?.rules?.rules_by_category} loading={loading} />
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Top Performing Rules */}
      <Card>
        <CardContent>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
            <TrophyIcon sx={{ color: 'warning.main' }} />
            <Box>
              <Typography variant="h6" sx={{ fontWeight: 500 }}>
                Top Performing Rules
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Meistgenutzte Scoring-Regeln der letzten 30 Tage
              </Typography>
            </Box>
          </Box>
          <TopRulesTable rules={stats?.top_rules_30d} loading={loading} />
        </CardContent>
      </Card>
    </Box>
  );
};

export default ScoringStats;
