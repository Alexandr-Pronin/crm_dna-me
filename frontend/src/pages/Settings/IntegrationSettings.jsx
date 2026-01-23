/**
 * Integration Settings Component
 * Shows status of Moco and Slack integrations with connection test functionality
 */
import { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Grid,
  Button,
  Chip,
  CircularProgress,
  Alert,
  Divider,
  IconButton,
  Tooltip,
  Skeleton,
  Paper,
} from '@mui/material';
import {
  CheckCircle as ConnectedIcon,
  Warning as WarningIcon,
  Error as ErrorIcon,
  Refresh as RefreshIcon,
  ContentCopy as CopyIcon,
  CloudSync as SyncIcon,
  Link as LinkIcon,
  Settings as SettingsIcon,
} from '@mui/icons-material';
import { getIntegrationsStatus, getMocoStatus } from '../../providers/dataProvider';

// Status color mapping
const getStatusColor = (status) => {
  switch (status) {
    case 'connected':
      return 'success';
    case 'configured':
      return 'warning';
    case 'not_configured':
    case 'disconnected':
    default:
      return 'error';
  }
};

// Status icon component
const StatusIcon = ({ status, size = 'medium' }) => {
  const iconSize = size === 'small' ? 18 : 24;
  
  switch (status) {
    case 'connected':
      return <ConnectedIcon sx={{ fontSize: iconSize, color: 'success.main' }} />;
    case 'configured':
      return <WarningIcon sx={{ fontSize: iconSize, color: 'warning.main' }} />;
    case 'not_configured':
    case 'disconnected':
    default:
      return <ErrorIcon sx={{ fontSize: iconSize, color: 'error.main' }} />;
  }
};

// Status label mapping
const getStatusLabel = (integration) => {
  if (!integration.configured) {
    return { text: 'Nicht konfiguriert', status: 'not_configured' };
  }
  if (integration.connected) {
    return { text: 'Verbunden', status: 'connected' };
  }
  return { text: 'Konfiguriert (nicht verbunden)', status: 'configured' };
};

const IntegrationSettings = () => {
  const [loading, setLoading] = useState(true);
  const [testingConnection, setTestingConnection] = useState(false);
  const [error, setError] = useState(null);
  const [integrationStatus, setIntegrationStatus] = useState(null);
  const [mocoDetails, setMocoDetails] = useState(null);
  const [lastRefresh, setLastRefresh] = useState(null);
  const [copySuccess, setCopySuccess] = useState(null);

  // Webhook URL for event ingestion (constructed from window location)
  const webhookUrl = `${window.location.protocol}//${window.location.hostname}:3000/api/v1/events/ingest`;

  // Fetch integration status
  const fetchStatus = useCallback(async (showLoader = true) => {
    if (showLoader) setLoading(true);
    setError(null);
    
    try {
      const status = await getIntegrationsStatus();
      setIntegrationStatus(status);
      setLastRefresh(new Date());
    } catch (err) {
      console.error('Error fetching integration status:', err);
      setError('Fehler beim Laden des Integration-Status');
    } finally {
      if (showLoader) setLoading(false);
    }
  }, []);

  // Test Moco connection
  const testMocoConnection = async () => {
    setTestingConnection(true);
    setError(null);
    
    try {
      const details = await getMocoStatus();
      setMocoDetails(details);
      
      // Also refresh the overall status
      await fetchStatus(false);
      
      if (details.status === 'connected') {
        // Success notification handled in UI
      }
    } catch (err) {
      console.error('Error testing Moco connection:', err);
      setError('Fehler beim Testen der Moco-Verbindung');
      setMocoDetails(null);
    } finally {
      setTestingConnection(false);
    }
  };

  // Copy to clipboard
  const copyToClipboard = async (text, label) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopySuccess(label);
      setTimeout(() => setCopySuccess(null), 2000);
    } catch (err) {
      console.error('Copy failed:', err);
    }
  };

  // Initial fetch
  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  if (loading) {
    return (
      <Grid container spacing={3}>
        {[1, 2, 3].map((i) => (
          <Grid key={i} size={{ xs: 12, md: 6, lg: 4 }}>
            <Card>
              <CardContent>
                <Skeleton variant="rectangular" height={150} />
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>
    );
  }

  const mocoStatus = integrationStatus?.moco || {};
  const slackStatus = integrationStatus?.slack || {};
  const mocoLabel = getStatusLabel(mocoStatus);
  const slackLabel = getStatusLabel(slackStatus);

  return (
    <Box>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Box>
          <Typography variant="h6" fontWeight={600}>
            Integration Einstellungen
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Status und Konfiguration der externen Integrationen
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          {lastRefresh && (
            <Typography variant="caption" color="text.secondary">
              Zuletzt aktualisiert: {lastRefresh.toLocaleTimeString('de-DE')}
            </Typography>
          )}
          <Tooltip title="Status aktualisieren">
            <IconButton onClick={() => fetchStatus()} size="small">
              <RefreshIcon />
            </IconButton>
          </Tooltip>
        </Box>
      </Box>

      {/* Error Alert */}
      {error && (
        <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      <Grid container spacing={3}>
        {/* Moco Integration Card */}
        <Grid size={{ xs: 12, md: 6 }}>
          <Card 
            sx={{ 
              height: '100%',
              border: '1px solid',
              borderColor: mocoStatus.connected ? 'success.main' : 'divider',
              transition: 'border-color 0.3s ease',
            }}
          >
            <CardContent>
              {/* Header */}
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                  <Box
                    sx={{
                      width: 40,
                      height: 40,
                      borderRadius: 2,
                      bgcolor: 'primary.main',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: 'primary.contrastText',
                      fontWeight: 700,
                      fontSize: '0.875rem',
                    }}
                  >
                    M
                  </Box>
                  <Box>
                    <Typography variant="subtitle1" fontWeight={600}>
                      Moco
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      ERP & Buchhaltung
                    </Typography>
                  </Box>
                </Box>
                <Chip
                  icon={<StatusIcon status={mocoLabel.status} size="small" />}
                  label={mocoLabel.text}
                  color={getStatusColor(mocoLabel.status)}
                  size="small"
                  variant="outlined"
                />
              </Box>

              <Divider sx={{ my: 2 }} />

              {/* Status Details */}
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                  <Typography variant="body2" color="text.secondary">
                    API konfiguriert:
                  </Typography>
                  <Typography variant="body2" fontWeight={500}>
                    {mocoStatus.configured ? 'Ja' : 'Nein'}
                  </Typography>
                </Box>
                
                <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                  <Typography variant="body2" color="text.secondary">
                    Sync aktiviert:
                  </Typography>
                  <Chip
                    label={mocoStatus.enabled ? 'Aktiviert' : 'Deaktiviert'}
                    color={mocoStatus.enabled ? 'success' : 'default'}
                    size="small"
                  />
                </Box>

                {mocoDetails?.subdomain && (
                  <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                    <Typography variant="body2" color="text.secondary">
                      Subdomain:
                    </Typography>
                    <Typography variant="body2" fontWeight={500} fontFamily="monospace">
                      {mocoDetails.subdomain}
                    </Typography>
                  </Box>
                )}

                {mocoDetails?.message && (
                  <Alert 
                    severity={mocoDetails.status === 'connected' ? 'success' : 'warning'} 
                    sx={{ mt: 1 }}
                    icon={false}
                  >
                    <Typography variant="caption">{mocoDetails.message}</Typography>
                  </Alert>
                )}
              </Box>

              <Divider sx={{ my: 2 }} />

              {/* Actions */}
              <Box sx={{ display: 'flex', gap: 1 }}>
                <Button
                  variant="outlined"
                  size="small"
                  startIcon={testingConnection ? <CircularProgress size={16} /> : <SyncIcon />}
                  onClick={testMocoConnection}
                  disabled={testingConnection || !mocoStatus.configured}
                  fullWidth
                >
                  {testingConnection ? 'Teste...' : 'Verbindung testen'}
                </Button>
              </Box>

              {/* Info Note */}
              <Paper 
                variant="outlined" 
                sx={{ mt: 2, p: 1.5, bgcolor: 'action.hover', borderRadius: 1 }}
              >
                <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1 }}>
                  <SettingsIcon fontSize="small" color="action" sx={{ mt: 0.2 }} />
                  <Typography variant="caption" color="text.secondary">
                    API Key und Subdomain werden via Environment Variables konfiguriert (.env Datei).
                    Änderungen erfordern einen Server-Neustart.
                  </Typography>
                </Box>
              </Paper>
            </CardContent>
          </Card>
        </Grid>

        {/* Slack Integration Card */}
        <Grid size={{ xs: 12, md: 6 }}>
          <Card 
            sx={{ 
              height: '100%',
              border: '1px solid',
              borderColor: slackStatus.connected ? 'success.main' : 'divider',
              transition: 'border-color 0.3s ease',
            }}
          >
            <CardContent>
              {/* Header */}
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                  <Box
                    sx={{
                      width: 40,
                      height: 40,
                      borderRadius: 2,
                      bgcolor: '#4A154B',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: '#fff',
                      fontWeight: 700,
                      fontSize: '0.875rem',
                    }}
                  >
                    S
                  </Box>
                  <Box>
                    <Typography variant="subtitle1" fontWeight={600}>
                      Slack
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      Benachrichtigungen
                    </Typography>
                  </Box>
                </Box>
                <Chip
                  icon={<StatusIcon status={slackLabel.status} size="small" />}
                  label={slackLabel.text}
                  color={getStatusColor(slackLabel.status)}
                  size="small"
                  variant="outlined"
                />
              </Box>

              <Divider sx={{ my: 2 }} />

              {/* Status Details */}
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                  <Typography variant="body2" color="text.secondary">
                    Webhook konfiguriert:
                  </Typography>
                  <Typography variant="body2" fontWeight={500}>
                    {slackStatus.configured ? 'Ja' : 'Nein'}
                  </Typography>
                </Box>
                
                <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                  <Typography variant="body2" color="text.secondary">
                    Alerts aktiviert:
                  </Typography>
                  <Chip
                    label={slackStatus.enabled ? 'Aktiviert' : 'Deaktiviert'}
                    color={slackStatus.enabled ? 'success' : 'default'}
                    size="small"
                  />
                </Box>
              </Box>

              <Divider sx={{ my: 2 }} />

              {/* Actions */}
              <Box sx={{ display: 'flex', gap: 1 }}>
                <Button
                  variant="outlined"
                  size="small"
                  startIcon={<SyncIcon />}
                  disabled={true}
                  fullWidth
                >
                  Test-Nachricht senden
                </Button>
              </Box>

              {/* Info Note */}
              <Paper 
                variant="outlined" 
                sx={{ mt: 2, p: 1.5, bgcolor: 'action.hover', borderRadius: 1 }}
              >
                <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1 }}>
                  <SettingsIcon fontSize="small" color="action" sx={{ mt: 0.2 }} />
                  <Typography variant="caption" color="text.secondary">
                    Webhook URL wird via Environment Variables konfiguriert (.env Datei).
                    Test-Nachrichten werden in einer zukünftigen Version unterstützt.
                  </Typography>
                </Box>
              </Paper>
            </CardContent>
          </Card>
        </Grid>

        {/* Webhook Endpoints Card */}
        <Grid size={{ xs: 12 }}>
          <Card>
            <CardContent>
              {/* Header */}
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2 }}>
                <LinkIcon color="primary" />
                <Box>
                  <Typography variant="subtitle1" fontWeight={600}>
                    Webhook Endpoints
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    URLs für externe Event-Integration
                  </Typography>
                </Box>
              </Box>

              <Divider sx={{ my: 2 }} />

              <Grid container spacing={2}>
                {/* Event Ingestion Webhook */}
                <Grid size={{ xs: 12, md: 6 }}>
                  <Paper 
                    variant="outlined" 
                    sx={{ p: 2, bgcolor: 'background.default', borderRadius: 1 }}
                  >
                    <Typography variant="body2" fontWeight={500} gutterBottom>
                      Event Ingestion
                    </Typography>
                    <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 1 }}>
                      Endpunkt für Marketing-Events (Formulare, Pageviews, etc.)
                    </Typography>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Typography
                        variant="body2"
                        fontFamily="monospace"
                        sx={{
                          flex: 1,
                          bgcolor: 'action.hover',
                          p: 1,
                          borderRadius: 1,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                          fontSize: '0.75rem',
                        }}
                      >
                        {webhookUrl}
                      </Typography>
                      <Tooltip title={copySuccess === 'webhook' ? 'Kopiert!' : 'URL kopieren'}>
                        <IconButton 
                          size="small" 
                          onClick={() => copyToClipboard(webhookUrl, 'webhook')}
                          color={copySuccess === 'webhook' ? 'success' : 'default'}
                        >
                          <CopyIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </Box>
                  </Paper>
                </Grid>

                {/* HMAC Secret Status */}
                <Grid size={{ xs: 12, md: 6 }}>
                  <Paper 
                    variant="outlined" 
                    sx={{ p: 2, bgcolor: 'background.default', borderRadius: 1 }}
                  >
                    <Typography variant="body2" fontWeight={500} gutterBottom>
                      HMAC-Authentifizierung
                    </Typography>
                    <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 1 }}>
                      Webhook-Signatur zur Absicherung eingehender Requests
                    </Typography>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Chip
                        icon={<StatusIcon status="connected" size="small" />}
                        label="Webhook Secret konfiguriert"
                        color="success"
                        size="small"
                        variant="outlined"
                      />
                    </Box>
                    <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 1 }}>
                      Header: <code style={{ backgroundColor: 'rgba(255,255,255,0.1)', padding: '2px 4px', borderRadius: 2 }}>X-Webhook-Signature</code>
                    </Typography>
                  </Paper>
                </Grid>
              </Grid>

              {/* Info Note */}
              <Paper 
                variant="outlined" 
                sx={{ mt: 2, p: 1.5, bgcolor: 'action.hover', borderRadius: 1 }}
              >
                <Typography variant="caption" color="text.secondary">
                  <strong>Hinweis:</strong> Externe Systeme sollten HMAC-SHA256 Signaturen im Header 
                  <code style={{ backgroundColor: 'rgba(255,255,255,0.1)', padding: '2px 4px', margin: '0 4px', borderRadius: 2 }}>X-Webhook-Signature</code>
                  senden. Das Secret wird via <code style={{ backgroundColor: 'rgba(255,255,255,0.1)', padding: '2px 4px', borderRadius: 2 }}>WEBHOOK_SECRET</code> in der .env konfiguriert.
                </Typography>
              </Paper>
            </CardContent>
          </Card>
        </Grid>

        {/* Feature Flags Info */}
        <Grid size={{ xs: 12 }}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2 }}>
                <SettingsIcon color="primary" />
                <Box>
                  <Typography variant="subtitle1" fontWeight={600}>
                    Feature Flags
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    Aktivierte System-Features
                  </Typography>
                </Box>
              </Box>

              <Divider sx={{ my: 2 }} />

              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                <Chip
                  label="Moco Sync"
                  color={mocoStatus.enabled ? 'success' : 'default'}
                  variant={mocoStatus.enabled ? 'filled' : 'outlined'}
                  size="small"
                />
                <Chip
                  label="Slack Alerts"
                  color={slackStatus.enabled ? 'success' : 'default'}
                  variant={slackStatus.enabled ? 'filled' : 'outlined'}
                  size="small"
                />
                <Chip
                  label="Score Decay"
                  color="success"
                  variant="filled"
                  size="small"
                />
                <Chip
                  label="Smart Routing"
                  color="success"
                  variant="filled"
                  size="small"
                />
                <Chip
                  label="Intent Detection"
                  color="success"
                  variant="filled"
                  size="small"
                />
              </Box>

              <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 2 }}>
                Feature Flags werden via Environment Variables gesteuert. Score Decay, Smart Routing 
                und Intent Detection sind Kernfunktionen und immer aktiviert.
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
};

export default IntegrationSettings;
