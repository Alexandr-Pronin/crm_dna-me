import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Box, Typography, Card, CardContent, Tabs, Tab, Chip, Button,
  CircularProgress, Grid, IconButton, Tooltip, Divider,
} from '@mui/material';
import {
  ArrowBack as BackIcon,
  Person as PersonIcon,
  AttachMoney as MoneyIcon,
  CalendarMonth as CalendarIcon,
} from '@mui/icons-material';
import { useGetOne } from 'react-admin';
import DealAutoTasks from './DealAutoTasks';
import CommunicationPanel from '../../components/communications/CommunicationPanel';

const STAGE_COLORS = {
  awareness: '#64748B', interest: '#F59E0B', consideration: '#4A90A4',
  evaluation: '#6C5CE7', decision: '#E84393', closed_won: '#28A745', closed_lost: '#DC3545',
};

const DealShow = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState(0);

  const { data: deal, isLoading, error } = useGetOne('deals', { id });

  if (isLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 10 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (error || !deal) {
    return (
      <Box sx={{ p: 3 }}>
        <Typography color="error">Failed to load deal</Typography>
        <Button onClick={() => navigate('/deals')} startIcon={<BackIcon />}>Back to Deals</Button>
      </Box>
    );
  }

  return (
    <Box sx={{ p: 2 }}>
      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3 }}>
        <Tooltip title="Back to Deals">
          <IconButton onClick={() => navigate('/deals')}><BackIcon /></IconButton>
        </Tooltip>
        <Box>
          <Typography variant="h5" sx={{ fontWeight: 400 }}>
            {deal.name || `Deal #${deal.id?.slice(0, 8)}`}
          </Typography>
          <Box sx={{ display: 'flex', gap: 1, mt: 0.5 }}>
            <Chip label={deal.status} size="small" color={deal.status === 'won' ? 'success' : deal.status === 'lost' ? 'error' : 'default'} sx={{ textTransform: 'capitalize' }} />
            {deal.value && (
              <Chip icon={<MoneyIcon sx={{ fontSize: 14 }} />} label={`€${Number(deal.value).toLocaleString()}`} size="small" variant="outlined" />
            )}
          </Box>
        </Box>
      </Box>

      {/* Info Cards */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid size={{ xs: 12, md: 4 }}>
          <Card sx={{ bgcolor: 'background.paper' }}>
            <CardContent>
              <Typography variant="caption" color="text.secondary">Assigned To</Typography>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 0.5 }}>
                <PersonIcon sx={{ fontSize: 18, color: 'primary.main' }} />
                <Typography variant="body2">{deal.assigned_to || 'Unassigned'}</Typography>
              </Box>
            </CardContent>
          </Card>
        </Grid>
        <Grid size={{ xs: 12, md: 4 }}>
          <Card sx={{ bgcolor: 'background.paper' }}>
            <CardContent>
              <Typography variant="caption" color="text.secondary">Expected Close</Typography>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 0.5 }}>
                <CalendarIcon sx={{ fontSize: 18, color: 'primary.main' }} />
                <Typography variant="body2">
                  {deal.expected_close_date
                    ? new Date(deal.expected_close_date).toLocaleDateString('de-DE')
                    : '—'}
                </Typography>
              </Box>
            </CardContent>
          </Card>
        </Grid>
        <Grid size={{ xs: 12, md: 4 }}>
          <Card sx={{ bgcolor: 'background.paper' }}>
            <CardContent>
              <Typography variant="caption" color="text.secondary">Pipeline / Stage</Typography>
              <Typography variant="body2" sx={{ mt: 0.5 }}>
                {deal.pipeline_id?.slice(0, 8)} / {deal.stage_id?.slice(0, 8)}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Tabs */}
      <Card sx={{ bgcolor: 'background.paper' }}>
        <Tabs value={activeTab} onChange={(_, v) => setActiveTab(v)} sx={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
          <Tab label="Overview" />
          <Tab label="Tasks" />
          <Tab label="Communications" />
          <Tab label="Auto-Tasks" />
        </Tabs>

        <Box sx={{ p: 2 }}>
          {activeTab === 0 && (
            <Box>
              <Typography variant="body2" color="text.secondary">
                Deal details and metadata will be shown here.
              </Typography>
              {deal.metadata && Object.keys(deal.metadata).length > 0 && (
                <Box sx={{ mt: 2 }}>
                  <Typography variant="subtitle2" sx={{ mb: 1 }}>Metadata</Typography>
                  <pre style={{ fontSize: 12, opacity: 0.7 }}>
                    {JSON.stringify(deal.metadata, null, 2)}
                  </pre>
                </Box>
              )}
            </Box>
          )}

          {activeTab === 1 && (
            <Typography variant="body2" color="text.secondary">
              Tasks linked to this deal. Use the Tasks page for full management.
            </Typography>
          )}

          {activeTab === 2 && (
            <CommunicationPanel leadId={deal.lead_id} dealId={deal.id} />
          )}

          {activeTab === 3 && (
            <DealAutoTasks dealId={deal.id} pipelineId={deal.pipeline_id} />
          )}
        </Box>
      </Card>
    </Box>
  );
};

export default DealShow;
