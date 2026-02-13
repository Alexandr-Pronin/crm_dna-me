/**
 * Pipeline Show/Detail Component
 * Displays pipeline details with stages and metrics
 * Uses REAL API: GET /pipelines/:id and GET /pipelines/:id/metrics
 */
import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { useNotify, useRedirect } from 'react-admin';
import { API_URL } from '../../providers/dataProvider';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Grid,
  Chip,
  IconButton,
  Tooltip,
  CircularProgress,
  Alert,
  LinearProgress,
  Divider,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
} from '@mui/material';
import {
  ArrowBack as BackIcon,
  Refresh as RefreshIcon,
  Timeline as PipelineIcon,
  TrendingUp as TrendingUpIcon,
  AttachMoney as MoneyIcon,
  Handshake as DealsIcon,
  CheckCircle as WonIcon,
  Cancel as LostIcon,
  Percent as PercentIcon,
  Settings as AutomationIcon,
} from '@mui/icons-material';

/**
 * Status Chip
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
 * Metric Card Component
 */
const MetricCard = ({ icon: Icon, label, value, color = '#4A90A4', subtext }) => (
  <Card sx={{ height: '100%' }}>
    <CardContent sx={{ py: 2 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
        <Box
          sx={{
            width: 48,
            height: 48,
            borderRadius: 2,
            bgcolor: `${color}15`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Icon sx={{ color, fontSize: 24 }} />
        </Box>
        <Box>
          <Typography variant="caption" color="text.secondary">
            {label}
          </Typography>
          <Typography variant="h5" fontWeight={600}>
            {value}
          </Typography>
          {subtext && (
            <Typography variant="caption" color="text.secondary">
              {subtext}
            </Typography>
          )}
        </Box>
      </Box>
    </CardContent>
  </Card>
);

/**
 * Stage Row Component
 */
const StageRow = ({ stage, metrics }) => {
  const stageMetric = metrics?.stages?.find(s => s.stage_id === stage.id);
  const hasAutomation = stage.automation_config && stage.automation_config.length > 0;

  return (
    <TableRow hover>
      <TableCell>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Box
            sx={{
              width: 24,
              height: 24,
              borderRadius: '50%',
              bgcolor: 'primary.main',
              color: 'white',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '0.75rem',
              fontWeight: 600,
            }}
          >
            {stage.position}
          </Box>
          <Typography variant="body2" fontWeight={500}>
            {stage.name}
          </Typography>
        </Box>
      </TableCell>
      <TableCell>
        <Typography variant="body2" color="text.secondary">
          {stage.slug}
        </Typography>
      </TableCell>
      <TableCell>
        {stage.stage_type && (
          <Chip label={stage.stage_type} size="small" variant="outlined" />
        )}
      </TableCell>
      <TableCell align="right">
        <Typography variant="body2" fontWeight={600}>
          {stageMetric?.deals_count ?? 0}
        </Typography>
      </TableCell>
      <TableCell align="right">
        <Typography variant="body2">
          €{(stageMetric?.total_value ?? 0).toLocaleString()}
        </Typography>
      </TableCell>
      <TableCell align="center">
        {hasAutomation ? (
          <Tooltip title={`${stage.automation_config.length} automation(s) configured`}>
            <AutomationIcon sx={{ color: 'success.main', fontSize: 20 }} />
          </Tooltip>
        ) : (
          <Typography variant="caption" color="text.secondary">—</Typography>
        )}
      </TableCell>
    </TableRow>
  );
};

/**
 * Automation Config Display
 */
const AutomationConfigCard = ({ stages }) => {
  const stagesWithAutomation = stages.filter(s => s.automation_config && s.automation_config.length > 0);

  if (stagesWithAutomation.length === 0) {
    return (
      <Card>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Stage Automations
          </Typography>
          <Alert severity="info">
            No automations configured for this pipeline. Automations can be set up to trigger actions like sending emails when deals enter specific stages.
          </Alert>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent>
        <Typography variant="h6" gutterBottom>
          Stage Automations
        </Typography>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {stagesWithAutomation.map(stage => (
            <Box key={stage.id} sx={{ p: 2, bgcolor: 'background.default', borderRadius: 1 }}>
              <Typography variant="subtitle2" gutterBottom>
                {stage.name} (Position {stage.position})
              </Typography>
              {stage.automation_config.map((config, index) => (
                <Box key={index} sx={{ ml: 2, mt: 1 }}>
                  <Chip
                    size="small"
                    label={config.type || config.action || 'Custom'}
                    sx={{ mr: 1 }}
                  />
                  {config.template && (
                    <Typography variant="caption" color="text.secondary">
                      Template: {config.template}
                    </Typography>
                  )}
                </Box>
              ))}
            </Box>
          ))}
        </Box>
      </CardContent>
    </Card>
  );
};

/**
 * Main Pipeline Show Component
 */
const PipelineShow = () => {
  const { id } = useParams();
  const [pipeline, setPipeline] = useState(null);
  const [metrics, setMetrics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  const notify = useNotify();
  const redirect = useRedirect();

  const loadPipeline = async () => {
    if (!id) return;
    
    setLoading(true);
    setError(null);
    
    try {
      // Load pipeline with stages and metrics in parallel
      const [pipelineRes, metricsRes] = await Promise.all([
        fetch(`${API_URL}/pipelines/${id}?include_stages=true`, {
          headers: {
            'X-API-Key': 'test123',
            'Accept': 'application/json',
          },
        }),
        fetch(`${API_URL}/pipelines/${id}/metrics`, {
          headers: {
            'X-API-Key': 'test123',
            'Accept': 'application/json',
          },
        }),
      ]);
      
      if (!pipelineRes.ok) {
        throw new Error('Pipeline not found');
      }
      
      const pipelineData = await pipelineRes.json();
      setPipeline(pipelineData);
      
      if (metricsRes.ok) {
        const metricsData = await metricsRes.json();
        setMetrics(metricsData);
      }
    } catch (err) {
      console.error('Failed to load pipeline:', err);
      setError(err.message || 'Failed to load pipeline');
      notify('Failed to load pipeline', { type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPipeline();
  }, [id]);

  const handleBack = () => {
    redirect('list', 'pipelines');
  };

  const formatCurrency = (value) => {
    if (!value && value !== 0) return '—';
    return `€${value.toLocaleString()}`;
  };

  const formatPercent = (value) => {
    if (!value && value !== 0) return '—';
    return `${(value * 100).toFixed(1)}%`;
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: 400 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (error || !pipeline) {
    return (
      <Box sx={{ p: 3 }}>
        <Button startIcon={<BackIcon />} onClick={handleBack} sx={{ mb: 2 }}>
          Back to Pipelines
        </Button>
        <Alert severity="error">
          {error || 'Pipeline not found'}
        </Alert>
      </Box>
    );
  }

  const stages = pipeline.stages || [];

  return (
    <Box sx={{ p: 3, width: '100%', maxWidth: '100%' }}>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 4 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <IconButton onClick={handleBack}>
            <BackIcon />
          </IconButton>
          <Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <Typography variant="h4" sx={{ fontWeight: 300 }}>
                {pipeline.name}
              </Typography>
              <StatusChip isActive={pipeline.is_active} />
              {pipeline.is_default && (
                <Chip label="Default" size="small" color="primary" />
              )}
            </Box>
            <Typography variant="body2" color="text.secondary">
              {pipeline.description || pipeline.slug}
            </Typography>
          </Box>
        </Box>
        <Tooltip title="Refresh">
          <IconButton onClick={loadPipeline}>
            <RefreshIcon />
          </IconButton>
        </Tooltip>
      </Box>

      {/* Metrics Cards */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid item xs={12} sm={6} md={3}>
          <MetricCard
            icon={DealsIcon}
            label="Total Deals"
            value={metrics?.total_deals ?? 0}
            color="#4A90A4"
            subtext={`${metrics?.open_deals ?? 0} open`}
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <MetricCard
            icon={WonIcon}
            label="Won Deals"
            value={metrics?.won_deals ?? 0}
            color="#28A745"
            subtext={formatCurrency(metrics?.won_value)}
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <MetricCard
            icon={MoneyIcon}
            label="Pipeline Value"
            value={formatCurrency(metrics?.total_value)}
            color="#F59E0B"
            subtext={`Avg: ${formatCurrency(metrics?.avg_deal_value)}`}
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <MetricCard
            icon={PercentIcon}
            label="Win Rate"
            value={formatPercent(metrics?.win_rate)}
            color="#6C5CE7"
            subtext={`${metrics?.lost_deals ?? 0} lost`}
          />
        </Grid>
      </Grid>

      {/* Stages Table */}
      <Card sx={{ mb: 4 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Pipeline Stages ({stages.length})
          </Typography>
          
          {stages.length === 0 ? (
            <Alert severity="info">
              No stages configured for this pipeline.
            </Alert>
          ) : (
            <TableContainer component={Paper} variant="outlined">
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>Stage Name</TableCell>
                    <TableCell>Slug</TableCell>
                    <TableCell>Type</TableCell>
                    <TableCell align="right">Deals</TableCell>
                    <TableCell align="right">Value</TableCell>
                    <TableCell align="center">Automation</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {stages
                    .sort((a, b) => a.position - b.position)
                    .map(stage => (
                      <StageRow key={stage.id} stage={stage} metrics={metrics} />
                    ))
                  }
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </CardContent>
      </Card>

      {/* Automation Config */}
      <AutomationConfigCard stages={stages} />

      {/* Pipeline Config */}
      {pipeline.config && Object.keys(pipeline.config).length > 0 && (
        <Card sx={{ mt: 4 }}>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Pipeline Configuration
            </Typography>
            <Box
              component="pre"
              sx={{
                bgcolor: 'background.default',
                p: 2,
                borderRadius: 1,
                overflow: 'auto',
                fontSize: '0.875rem',
              }}
            >
              {JSON.stringify(pipeline.config, null, 2)}
            </Box>
          </CardContent>
        </Card>
      )}
    </Box>
  );
};

export default PipelineShow;
