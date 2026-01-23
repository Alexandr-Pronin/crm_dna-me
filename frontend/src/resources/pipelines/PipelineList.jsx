/**
 * Pipeline List Component
 * Displays all pipelines with summary metrics
 * Uses REAL API: GET /pipelines?with_summary=true
 */
import { useState, useEffect } from 'react';
import { useDataProvider, useNotify, useRedirect } from 'react-admin';
import {
  Box,
  Typography,
  Card,
  CardContent,
  CardActions,
  Grid,
  Chip,
  Button,
  IconButton,
  Tooltip,
  CircularProgress,
  Alert,
  LinearProgress,
  Divider,
} from '@mui/material';
import {
  Refresh as RefreshIcon,
  Visibility as ViewIcon,
  Timeline as PipelineIcon,
  TrendingUp as TrendingUpIcon,
  AttachMoney as MoneyIcon,
  Handshake as DealsIcon,
  Layers as StagesIcon,
} from '@mui/icons-material';

/**
 * Status Chip for active/inactive
 */
const StatusChip = ({ isActive }) => (
  <Chip
    label={isActive ? 'Active' : 'Inactive'}
    size="small"
    sx={{
      bgcolor: isActive ? 'rgba(40, 167, 69, 0.15)' : 'rgba(108, 117, 125, 0.15)',
      color: isActive ? '#28A745' : '#6C757D',
      fontWeight: 500,
    }}
  />
);

/**
 * Metric Display Component
 */
const MetricItem = ({ icon: Icon, label, value, color = 'primary.main' }) => (
  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
    <Box
      sx={{
        width: 36,
        height: 36,
        borderRadius: 1,
        bgcolor: `${color}15`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Icon sx={{ color, fontSize: 18 }} />
    </Box>
    <Box>
      <Typography variant="caption" color="text.secondary" display="block">
        {label}
      </Typography>
      <Typography variant="body2" fontWeight={600}>
        {value}
      </Typography>
    </Box>
  </Box>
);

/**
 * Pipeline Card Component
 */
const PipelineCard = ({ pipeline, onClick }) => {
  const formatCurrency = (value) => {
    if (!value && value !== 0) return '—';
    return `€${value.toLocaleString()}`;
  };

  return (
    <Card
      sx={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        transition: 'all 0.2s ease',
        cursor: 'pointer',
        '&:hover': {
          boxShadow: 4,
          transform: 'translateY(-2px)',
        },
      }}
      onClick={() => onClick(pipeline.id)}
    >
      <CardContent sx={{ flex: 1 }}>
        {/* Header */}
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
          <Box>
            <Typography variant="h6" sx={{ fontWeight: 500 }}>
              {pipeline.name}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {pipeline.slug}
            </Typography>
          </Box>
          <StatusChip isActive={pipeline.is_active} />
        </Box>

        {/* Description */}
        {pipeline.description && (
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2, minHeight: 40 }}>
            {pipeline.description}
          </Typography>
        )}

        <Divider sx={{ my: 2 }} />

        {/* Metrics */}
        <Grid container spacing={2}>
          <Grid item xs={6}>
            <MetricItem
              icon={DealsIcon}
              label="Deals"
              value={pipeline.deals_count ?? 0}
              color="#4A90A4"
            />
          </Grid>
          <Grid item xs={6}>
            <MetricItem
              icon={MoneyIcon}
              label="Total Value"
              value={formatCurrency(pipeline.total_value)}
              color="#28A745"
            />
          </Grid>
          <Grid item xs={6}>
            <MetricItem
              icon={StagesIcon}
              label="Stages"
              value={pipeline.stages_count ?? 0}
              color="#6C5CE7"
            />
          </Grid>
          <Grid item xs={6}>
            <MetricItem
              icon={TrendingUpIcon}
              label="Cycle"
              value={pipeline.sales_cycle_days ? `${pipeline.sales_cycle_days}d` : '—'}
              color="#F59E0B"
            />
          </Grid>
        </Grid>

        {/* Target Persona */}
        {pipeline.target_persona && (
          <Box sx={{ mt: 2 }}>
            <Typography variant="caption" color="text.secondary">
              Target Persona
            </Typography>
            <Typography variant="body2">
              {pipeline.target_persona}
            </Typography>
          </Box>
        )}
      </CardContent>

      <CardActions sx={{ px: 2, pb: 2, pt: 0 }}>
        <Button
          size="small"
          startIcon={<ViewIcon />}
          onClick={(e) => {
            e.stopPropagation();
            onClick(pipeline.id);
          }}
        >
          View Details
        </Button>
      </CardActions>
    </Card>
  );
};

/**
 * Main Pipeline List Component
 */
const PipelineList = () => {
  const [pipelines, setPipelines] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  const dataProvider = useDataProvider();
  const notify = useNotify();
  const redirect = useRedirect();

  const loadPipelines = async () => {
    setLoading(true);
    setError(null);
    
    try {
      // Use custom API call with summary
      const response = await fetch('http://localhost:3000/api/v1/pipelines?with_summary=true', {
        headers: {
          'X-API-Key': 'test123',
          'Accept': 'application/json',
        },
      });
      
      if (!response.ok) {
        throw new Error('Failed to load pipelines');
      }
      
      const data = await response.json();
      setPipelines(data.data || []);
    } catch (err) {
      console.error('Failed to load pipelines:', err);
      setError(err.message || 'Failed to load pipelines');
      notify('Failed to load pipelines', { type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPipelines();
  }, []);

  const handlePipelineClick = (pipelineId) => {
    redirect('show', 'pipelines', pipelineId);
  };

  // Calculate totals
  const totalDeals = pipelines.reduce((sum, p) => sum + (p.deals_count || 0), 0);
  const totalValue = pipelines.reduce((sum, p) => sum + (p.total_value || 0), 0);
  const activePipelines = pipelines.filter(p => p.is_active).length;

  return (
    <Box sx={{ p: 3, width: '100%', maxWidth: '100%' }}>
      {/* Page Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 4 }}>
        <Box>
          <Typography variant="h4" sx={{ fontWeight: 300, display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <PipelineIcon sx={{ color: 'primary.main' }} />
            Pipelines
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
            Manage your sales pipelines and stages
          </Typography>
        </Box>
        <Tooltip title="Refresh">
          <IconButton onClick={loadPipelines} disabled={loading}>
            <RefreshIcon />
          </IconButton>
        </Tooltip>
      </Box>

      {/* Summary Stats */}
      <Grid container spacing={2} sx={{ mb: 4 }}>
        <Grid item xs={12} sm={4}>
          <Card>
            <CardContent sx={{ py: 2 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Box>
                  <Typography variant="caption" color="text.secondary">
                    Active Pipelines
                  </Typography>
                  <Typography variant="h5" fontWeight={600}>
                    {loading ? '—' : activePipelines}
                  </Typography>
                </Box>
                <PipelineIcon sx={{ color: 'primary.main', fontSize: 32, opacity: 0.7 }} />
              </Box>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={4}>
          <Card>
            <CardContent sx={{ py: 2 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Box>
                  <Typography variant="caption" color="text.secondary">
                    Total Deals
                  </Typography>
                  <Typography variant="h5" fontWeight={600}>
                    {loading ? '—' : totalDeals}
                  </Typography>
                </Box>
                <DealsIcon sx={{ color: '#28A745', fontSize: 32, opacity: 0.7 }} />
              </Box>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={4}>
          <Card>
            <CardContent sx={{ py: 2 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Box>
                  <Typography variant="caption" color="text.secondary">
                    Pipeline Value
                  </Typography>
                  <Typography variant="h5" fontWeight={600}>
                    {loading ? '—' : `€${totalValue.toLocaleString()}`}
                  </Typography>
                </Box>
                <MoneyIcon sx={{ color: '#F59E0B', fontSize: 32, opacity: 0.7 }} />
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Error Display */}
      {error && (
        <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {/* Loading State */}
      {loading && (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
          <CircularProgress />
        </Box>
      )}

      {/* Pipeline Cards */}
      {!loading && pipelines.length === 0 && (
        <Card sx={{ textAlign: 'center', py: 8 }}>
          <CardContent>
            <PipelineIcon sx={{ fontSize: 48, color: 'text.secondary', mb: 2 }} />
            <Typography variant="h6" color="text.secondary" gutterBottom>
              No Pipelines Found
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Pipelines will appear here when configured in the system.
            </Typography>
          </CardContent>
        </Card>
      )}

      {!loading && pipelines.length > 0 && (
        <Grid container spacing={3}>
          {pipelines.map((pipeline) => (
            <Grid item xs={12} sm={6} lg={4} key={pipeline.id}>
              <PipelineCard pipeline={pipeline} onClick={handlePipelineClick} />
            </Grid>
          ))}
        </Grid>
      )}
    </Box>
  );
};

export default PipelineList;
