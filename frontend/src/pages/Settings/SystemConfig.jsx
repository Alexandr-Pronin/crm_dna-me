/**
 * System Config Settings
 * Displays routing configuration, scoring thresholds, feature flags, and database clear
 */
import { useState, useEffect } from 'react';
import { useGetIdentity, useNotify } from 'react-admin';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Grid,
  Chip,
  CircularProgress,
  Alert,
  Divider,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
} from '@mui/material';
import { Autocomplete, TextField } from '@mui/material';
import {
  Settings as SettingsIcon,
  Score as ScoreIcon,
  ToggleOn as ToggleOnIcon,
  Info as InfoIcon,
  DeleteForever as ClearDbIcon,
  AccountTree as SchemaIcon,
  ArrowForward as ArrowIcon,
} from '@mui/icons-material';
import { getRoutingConfig, getScoringThresholds, getClearDatabasesSchema, clearDatabases } from '../../providers/dataProvider';

const SystemConfig = () => {
  const { data: identity } = useGetIdentity();
  const notify = useNotify();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [routingConfig, setRoutingConfig] = useState(null);
  const [scoringThresholds, setScoringThresholds] = useState(null);
  const [clearDialogOpen, setClearDialogOpen] = useState(false);
  const [clearLoading, setClearLoading] = useState(false);
  const [clearDbSchema, setClearDbSchema] = useState(null);
  const [schemaLoading, setSchemaLoading] = useState(false);
  const [selectedClearGroupIds, setSelectedClearGroupIds] = useState([]);
  const isAdmin = identity?.role === 'admin';

  const loadClearDbSchema = async () => {
    if (clearDbSchema) return;
    setSchemaLoading(true);
    try {
      const data = await getClearDatabasesSchema();
      setClearDbSchema(data);
    } catch (err) {
      console.error('Failed to load clear-db schema', err);
      notify(err?.message || 'Не удалось загрузить схему', { type: 'error' });
    } finally {
      setSchemaLoading(false);
    }
  };

  useEffect(() => {
    loadConfigData();
  }, []);

  const loadConfigData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [routingData, thresholdsData] = await Promise.all([
        getRoutingConfig(),
        getScoringThresholds(),
      ]);
      setRoutingConfig(routingData);
      setScoringThresholds(thresholdsData);
    } catch (err) {
      console.error('Error loading config data:', err);
      setError(err.message || 'Failed to load configuration');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Alert severity="error" sx={{ mb: 2 }}>
        {error}
      </Alert>
    );
  }

  // Score tier definitions with colors
  const scoreTiers = [
    { name: 'Cold Lead', min: 0, max: 19, color: 'default', bgcolor: '#616161' },
    { name: 'Warm Lead', min: 20, max: 39, color: 'warning', bgcolor: '#ffa726' },
    { name: 'MQL', min: 40, max: 79, color: 'info', bgcolor: '#29b6f6' },
    { name: 'SQL', min: 80, max: 119, color: 'success', bgcolor: '#66bb6a' },
    { name: 'Hot Lead', min: 120, max: '∞', color: 'error', bgcolor: '#ef5350' },
  ];

  const handleClearDatabases = async (clearAll = false) => {
    setClearLoading(true);
    try {
      const groupIds = clearAll ? null : selectedClearGroupIds;
      await clearDatabases(groupIds);
      notify(groupIds?.length ? 'Выбранные базы данных очищены.' : 'Все базы данных успешно очищены.', { type: 'success' });
      setClearDialogOpen(false);
      setSelectedClearGroupIds([]);
      loadConfigData();
    } catch (err) {
      notify(err?.message || 'Ошибка при очистке баз данных', { type: 'error' });
    } finally {
      setClearLoading(false);
    }
  };

  const selectedGroups = (clearDbSchema?.groups || []).filter((g) => selectedClearGroupIds.includes(g.id));
  const cascadeSummary = selectedGroups.flatMap((g) => g.cascadeTo || []).filter((c, i, a) => a.findIndex((x) => x.table === c.table) === i);

  // Feature flags (derived from config or environment)
  const featureFlags = [
    { name: 'Moco Sync', enabled: routingConfig?.moco_sync_enabled !== false },
    { name: 'Slack Alerts', enabled: routingConfig?.slack_alerts_enabled !== false },
    { name: 'Automation Engine', enabled: routingConfig?.automation_enabled !== false },
  ];

  return (
    <Box>
      {/* Info Banner */}
      <Alert severity="info" icon={<InfoIcon />} sx={{ mb: 3 }}>
        Diese Einstellungen sind schreibgeschützt und werden über die Backend-Konfiguration verwaltet.
        Änderungen erfordern eine Anpassung der Umgebungsvariablen.
      </Alert>

      <Grid container spacing={3}>
        {/* Routing Configuration */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 3 }}>
                <SettingsIcon color="primary" />
                <Typography variant="h6">Routing Configuration</Typography>
              </Box>

              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                {/* Min Score Threshold */}
                <Box>
                  <Typography variant="caption" color="text.secondary" display="block">
                    Min Score Threshold
                  </Typography>
                  <Typography variant="h5" fontWeight={600}>
                    {routingConfig?.min_score_threshold || 40}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    Mindestpunktzahl für automatisches Routing
                  </Typography>
                </Box>

                <Divider />

                {/* Min Intent Confidence */}
                <Box>
                  <Typography variant="caption" color="text.secondary" display="block">
                    Min Intent Confidence
                  </Typography>
                  <Typography variant="h5" fontWeight={600}>
                    {routingConfig?.min_intent_confidence || 60}%
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    Minimale Konfidenz für Intent Detection
                  </Typography>
                </Box>

                <Divider />

                {/* Intent Confidence Margin */}
                <Box>
                  <Typography variant="caption" color="text.secondary" display="block">
                    Intent Confidence Margin
                  </Typography>
                  <Typography variant="h5" fontWeight={600}>
                    {routingConfig?.intent_confidence_margin || 15}%
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    Mindestabstand zwischen Top Intents
                  </Typography>
                </Box>

                <Divider />

                {/* Max Unrouted Days */}
                <Box>
                  <Typography variant="caption" color="text.secondary" display="block">
                    Max Unrouted Days
                  </Typography>
                  <Typography variant="h5" fontWeight={600}>
                    {routingConfig?.max_unrouted_days || 14} Tage
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    Maximale Wartezeit im Lead Pool
                  </Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        {/* Scoring Thresholds */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 3 }}>
                <ScoreIcon color="primary" />
                <Typography variant="h6">Score Tiers</Typography>
              </Box>

              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                {scoreTiers.map((tier, index) => (
                  <Box
                    key={index}
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      p: 1.5,
                      borderRadius: 1,
                      bgcolor: 'background.default',
                      border: '1px solid',
                      borderColor: 'divider',
                    }}
                  >
                    <Box>
                      <Typography variant="subtitle2" fontWeight={600}>
                        {tier.name}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {tier.min} - {tier.max} Punkte
                      </Typography>
                    </Box>
                    <Chip
                      label={tier.name}
                      size="small"
                      sx={{
                        bgcolor: tier.bgcolor,
                        color: 'white',
                        fontWeight: 600,
                      }}
                    />
                  </Box>
                ))}
              </Box>

              <Alert severity="info" sx={{ mt: 2 }}>
                Score Tiers werden basierend auf der Gesamtpunktzahl automatisch zugewiesen
              </Alert>
            </CardContent>
          </Card>
        </Grid>

        {/* Intent → Pipeline Mapping */}
        <Grid item xs={12}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                <SettingsIcon color="primary" />
                <Typography variant="h6">Intent → Pipeline Mapping</Typography>
              </Box>

              <TableContainer component={Paper} variant="outlined">
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell><strong>Intent Type</strong></TableCell>
                      <TableCell><strong>Pipeline</strong></TableCell>
                      <TableCell><strong>Initial Stage</strong></TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {routingConfig?.intent_pipeline_mapping ? (
                      Object.entries(routingConfig.intent_pipeline_mapping).map(([intent, config]) => (
                        <TableRow key={intent}>
                          <TableCell>
                            <Chip label={intent} size="small" color="primary" variant="outlined" />
                          </TableCell>
                          <TableCell>{config.pipeline_name || config.pipeline_id}</TableCell>
                          <TableCell>{config.stage_name || config.initial_stage}</TableCell>
                        </TableRow>
                      ))
                    ) : (
                      // Fallback to default mapping if not in config
                      <>
                        <TableRow>
                          <TableCell>
                            <Chip label="research_lab" size="small" color="primary" variant="outlined" />
                          </TableCell>
                          <TableCell>Research Lab</TableCell>
                          <TableCell>Initial Contact</TableCell>
                        </TableRow>
                        <TableRow>
                          <TableCell>
                            <Chip label="b2b_lab_enablement" size="small" color="primary" variant="outlined" />
                          </TableCell>
                          <TableCell>B2B Lab Enablement</TableCell>
                          <TableCell>Initial Contact</TableCell>
                        </TableRow>
                        <TableRow>
                          <TableCell>
                            <Chip label="panel_co_creation" size="small" color="primary" variant="outlined" />
                          </TableCell>
                          <TableCell>Panel Co-Creation</TableCell>
                          <TableCell>Initial Contact</TableCell>
                        </TableRow>
                        <TableRow>
                          <TableCell>
                            <Chip label="discovery" size="small" color="primary" variant="outlined" />
                          </TableCell>
                          <TableCell>Discovery</TableCell>
                          <TableCell>Initial Contact</TableCell>
                        </TableRow>
                      </>
                    )}
                  </TableBody>
                </Table>
              </TableContainer>

              <Alert severity="info" sx={{ mt: 2 }}>
                Leads werden basierend auf ihrem erkannten Intent automatisch der entsprechenden Pipeline zugewiesen
              </Alert>
            </CardContent>
          </Card>
        </Grid>

        {/* Feature Flags */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 3 }}>
                <ToggleOnIcon color="primary" />
                <Typography variant="h6">Feature Flags</Typography>
              </Box>

              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                {featureFlags.map((flag, index) => (
                  <Box
                    key={index}
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      p: 1.5,
                      borderRadius: 1,
                      bgcolor: 'background.default',
                      border: '1px solid',
                      borderColor: 'divider',
                    }}
                  >
                    <Typography variant="subtitle2" fontWeight={500}>
                      {flag.name}
                    </Typography>
                    <Chip
                      label={flag.enabled ? 'Enabled' : 'Disabled'}
                      size="small"
                      color={flag.enabled ? 'success' : 'default'}
                      sx={{ fontWeight: 600 }}
                    />
                  </Box>
                ))}
              </Box>

              <Alert severity="info" sx={{ mt: 2 }}>
                Feature Flags werden über Umgebungsvariablen gesteuert
              </Alert>
            </CardContent>
          </Card>
        </Grid>

        {/* Clear databases – interactive (действие только для admin) */}
        <Grid item xs={12}>
          <Card sx={{ borderColor: 'error.light', borderWidth: 1, borderStyle: 'solid' }}>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                <ClearDbIcon color="error" />
                <Typography variant="h6">Очистка баз данных</Typography>
              </Box>
              {!isAdmin && (
                <Alert severity="warning" sx={{ mb: 2 }}>
                  Доступно только для пользователей с ролью Administrator.
                </Alert>
              )}
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                Выберите, какие данные удалить. Схема связей и каскадное удаление показаны в диалоге.
                Не затрагиваются: команда, пайплайны, правила скоринга, настройки интеграций.
              </Typography>
              <Button
                variant="outlined"
                color="error"
                startIcon={<SchemaIcon />}
                disabled={!isAdmin}
                onClick={() => { setClearDialogOpen(true); loadClearDbSchema(); }}
              >
                Выбрать и очистить базы данных
              </Button>
            </CardContent>
          </Card>
        </Grid>

        {/* Scoring Thresholds Details */}
        {scoringThresholds && (
          <Grid item xs={12} md={6}>
            <Card>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 3 }}>
                  <ScoreIcon color="primary" />
                  <Typography variant="h6">Scoring Thresholds</Typography>
                </Box>

                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  {scoringThresholds.tiers?.map((tier, index) => (
                    <Box
                      key={index}
                      sx={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        p: 1.5,
                        borderRadius: 1,
                        bgcolor: 'background.default',
                        border: '1px solid',
                        borderColor: 'divider',
                      }}
                    >
                      <Box>
                        <Typography variant="subtitle2" fontWeight={600}>
                          {tier.label}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          Threshold: {tier.threshold}
                        </Typography>
                      </Box>
                      <Chip
                        label={tier.label}
                        size="small"
                        color={tier.color || 'default'}
                        sx={{ fontWeight: 600 }}
                      />
                    </Box>
                  ))}
                </Box>
              </CardContent>
            </Card>
          </Grid>
        )}
      </Grid>

      <Dialog open={clearDialogOpen} onClose={() => !clearLoading && setClearDialogOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>Очистка баз данных: выбор и каскад</DialogTitle>
        <DialogContent>
          <DialogContentText sx={{ mb: 2 }}>
            Выберите группы таблиц для очистки. Стрелка A → B означает: у таблицы B есть внешний ключ на A;
            при очистке A каскадно удаляются все такие B (и далее по цепочке). Нормализация сохраняется.
          </DialogContentText>

          {schemaLoading && (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 2 }}>
              <CircularProgress size={24} />
            </Box>
          )}

          {clearDbSchema && !schemaLoading && (
            <>
              <Typography variant="subtitle2" sx={{ mt: 2, mb: 1 }}>Схема связей (внешние ключи)</Typography>
              <Paper variant="outlined" sx={{ p: 1.5, mb: 2, maxHeight: 220, overflow: 'auto', bgcolor: 'background.default' }}>
                <Box component="ul" sx={{ m: 0, pl: 2.5, listStyle: 'none' }}>
                  {clearDbSchema.edges.map((e, i) => (
                    <Box key={i} component="li" sx={{ display: 'flex', alignItems: 'center', gap: 0.5, py: 0.25 }}>
                      <Chip size="small" label={clearDbSchema.tableLabels[e.from] || e.from} sx={{ fontFamily: 'monospace' }} />
                      <ArrowIcon sx={{ fontSize: 16, color: 'text.secondary' }} />
                      <Chip size="small" variant="outlined" label={clearDbSchema.tableLabels[e.to] || e.to} sx={{ fontFamily: 'monospace' }} />
                    </Box>
                  ))}
                </Box>
              </Paper>

              <Typography variant="subtitle2" sx={{ mb: 1 }}>Что очистить</Typography>
              <Autocomplete
                multiple
                options={clearDbSchema.groups}
                getOptionLabel={(opt) => opt.label}
                isOptionEqualToValue={(a, b) => a.id === b.id}
                value={selectedGroups}
                onChange={(_, newVal) => setSelectedClearGroupIds(newVal.map((g) => g.id))}
                renderInput={(params) => <TextField {...params} size="small" placeholder="Выберите группы таблиц" />}
                renderOption={(props, option) => (
                  <li {...props} key={option.id}>
                    <Box>
                      <Typography variant="body2">{option.label}</Typography>
                      <Typography variant="caption" color="text.secondary">{option.description}</Typography>
                    </Box>
                  </li>
                )}
                sx={{ mb: 2 }}
              />

              {selectedGroups.length > 0 && (
                <Alert severity="warning" sx={{ mb: 2 }}>
                  <Typography variant="subtitle2" gutterBottom>При очистке выбранного каскадно удалятся также:</Typography>
                  <Typography variant="body2" component="span">
                    {cascadeSummary.map((c) => c.label).join(', ')}
                  </Typography>
                </Alert>
              )}
            </>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => !clearLoading && setClearDialogOpen(false)} disabled={clearLoading}>
            Отмена
          </Button>
          {selectedGroups.length > 0 && (
            <Button color="error" variant="outlined" onClick={() => handleClearDatabases(false)} disabled={clearLoading}>
              {clearLoading ? 'Очистка…' : 'Очистить выбранное'}
            </Button>
          )}
          <Button color="error" variant="contained" onClick={() => handleClearDatabases(true)} disabled={clearLoading}>
            {clearLoading ? 'Очистка…' : 'Очистить всё'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default SystemConfig;
