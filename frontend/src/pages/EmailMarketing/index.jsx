/**
 * Email Marketing Page
 * Übersicht und Verwaltung von E-Mail-Sequenzen
 */
import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDataProvider, useNotify } from 'react-admin';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Button,
  Chip,
  IconButton,
  Tooltip,
  Switch,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  CircularProgress,
  Alert,
  TextField,
  MenuItem,
  InputAdornment,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TablePagination,
  Paper,
  LinearProgress,
  Avatar,
  AvatarGroup,
} from '@mui/material';
import {
  Add as AddIcon,
  Delete as DeleteIcon,
  Edit as EditIcon,
  Refresh as RefreshIcon,
  Search as SearchIcon,
  Email as EmailIcon,
  PlayArrow as PlayIcon,
  Pause as PauseIcon,
  BarChart as StatsIcon,
  Schedule as ScheduleIcon,
  People as PeopleIcon,
  Send as SendIcon,
  OpenInNew as OpenIcon,
  ContentCopy as DuplicateIcon,
  Visibility as ViewIcon,
  MoreVert as MoreIcon,
  AutoAwesome as AutomationIcon,
  TrendingUp as TrendingUpIcon,
  CheckCircle as CheckCircleIcon,
  AccessTime as TimeIcon,
} from '@mui/icons-material';

/**
 * Mock Data - Wird später durch API ersetzt
 */
const mockSequences = [
  {
    id: '1',
    name: 'Willkommens-Serie',
    description: 'Automatische Begrüßung für neue Leads',
    trigger_event: 'lead_created',
    is_active: true,
    steps_count: 5,
    enrolled_count: 128,
    completed_count: 89,
    open_rate: 0.68,
    click_rate: 0.24,
    created_at: '2025-12-15T10:00:00Z',
    last_sent_at: '2026-01-22T14:30:00Z',
  },
  {
    id: '2',
    name: 'Demo Follow-Up',
    description: 'Nachfass-E-Mails nach Demo-Buchung',
    trigger_event: 'deal_stage_changed',
    is_active: true,
    steps_count: 3,
    enrolled_count: 45,
    completed_count: 32,
    open_rate: 0.82,
    click_rate: 0.41,
    created_at: '2025-12-20T10:00:00Z',
    last_sent_at: '2026-01-21T09:15:00Z',
  },
  {
    id: '3',
    name: 'Reaktivierungs-Kampagne',
    description: 'Inaktive Leads wieder aktivieren',
    trigger_event: 'manual',
    is_active: false,
    steps_count: 4,
    enrolled_count: 256,
    completed_count: 180,
    open_rate: 0.35,
    click_rate: 0.12,
    created_at: '2025-11-10T10:00:00Z',
    last_sent_at: '2026-01-15T11:00:00Z',
  },
  {
    id: '4',
    name: 'Angebots-Erinnerung',
    description: 'Reminder für ausstehende Angebote',
    trigger_event: 'deal_stage_changed',
    is_active: true,
    steps_count: 2,
    enrolled_count: 67,
    completed_count: 54,
    open_rate: 0.71,
    click_rate: 0.38,
    created_at: '2026-01-05T10:00:00Z',
    last_sent_at: '2026-01-23T08:45:00Z',
  },
  {
    id: '5',
    name: 'Onboarding-Serie',
    description: 'Einführung für neue Kunden',
    trigger_event: 'deal_won',
    is_active: true,
    steps_count: 7,
    enrolled_count: 89,
    completed_count: 45,
    open_rate: 0.79,
    click_rate: 0.52,
    created_at: '2026-01-10T10:00:00Z',
    last_sent_at: '2026-01-22T16:20:00Z',
  },
];

/**
 * Stats Card Component
 */
const StatsCard = ({ title, value, subvalue, icon: Icon, color, trend }) => (
  <Card sx={{ flex: 1, minWidth: 200 }}>
    <CardContent sx={{ py: 2.5, px: 3, '&:last-child': { pb: 2.5 } }}>
      <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <Box>
          <Typography
            variant="caption"
            color="text.secondary"
            sx={{ textTransform: 'uppercase', letterSpacing: 0.5, fontWeight: 500 }}
          >
            {title}
          </Typography>
          <Typography variant="h4" sx={{ fontWeight: 600, color, mt: 0.5 }}>
            {value}
          </Typography>
          {subvalue && (
            <Typography variant="caption" color="text.secondary">
              {subvalue}
            </Typography>
          )}
        </Box>
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
          <Icon sx={{ fontSize: 24, color }} />
        </Box>
      </Box>
      {trend && (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mt: 1 }}>
          <TrendingUpIcon sx={{ fontSize: 16, color: 'success.main' }} />
          <Typography variant="caption" color="success.main">
            {trend}
          </Typography>
        </Box>
      )}
    </CardContent>
  </Card>
);

/**
 * Rate Display Component
 */
const RateDisplay = ({ rate, label }) => {
  const percentage = (rate * 100).toFixed(1);
  const isGood = rate >= 0.5;
  const isMedium = rate >= 0.25 && rate < 0.5;

  return (
    <Box sx={{ textAlign: 'center' }}>
      <Typography
        variant="body2"
        fontWeight={600}
        sx={{
          color: isGood ? 'success.main' : isMedium ? 'warning.main' : 'text.secondary',
        }}
      >
        {percentage}%
      </Typography>
      <Typography variant="caption" color="text.secondary">
        {label}
      </Typography>
    </Box>
  );
};

/**
 * Progress Bar Component
 */
const SequenceProgress = ({ enrolled, completed }) => {
  const progress = enrolled > 0 ? (completed / enrolled) * 100 : 0;

  return (
    <Box sx={{ minWidth: 120 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
        <Typography variant="caption" color="text.secondary">
          {completed}/{enrolled}
        </Typography>
        <Typography variant="caption" color="text.secondary">
          {progress.toFixed(0)}%
        </Typography>
      </Box>
      <LinearProgress
        variant="determinate"
        value={progress}
        sx={{
          height: 6,
          borderRadius: 3,
          bgcolor: 'rgba(255,255,255,0.1)',
          '& .MuiLinearProgress-bar': {
            borderRadius: 3,
            bgcolor: progress >= 70 ? 'success.main' : progress >= 40 ? 'warning.main' : 'primary.main',
          },
        }}
      />
    </Box>
  );
};

/**
 * Delete Confirmation Dialog
 */
const DeleteDialog = ({ open, sequence, onClose, onConfirm, loading }) => (
  <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
    <DialogTitle>Sequenz löschen</DialogTitle>
    <DialogContent>
      <DialogContentText>
        Möchten Sie die Sequenz <strong>"{sequence?.name}"</strong> wirklich löschen?
        <br /><br />
        <Typography variant="body2" color="error.main">
          Achtung: {sequence?.enrolled_count || 0} aktive Enrollments werden abgebrochen.
        </Typography>
      </DialogContentText>
    </DialogContent>
    <DialogActions>
      <Button onClick={onClose} disabled={loading}>Abbrechen</Button>
      <Button
        onClick={onConfirm}
        color="error"
        variant="contained"
        disabled={loading}
        startIcon={loading ? <CircularProgress size={16} /> : <DeleteIcon />}
      >
        Löschen
      </Button>
    </DialogActions>
  </Dialog>
);

/**
 * Main Email Marketing Page Component
 */
const EmailMarketingPage = () => {
  const navigate = useNavigate();
  const dataProvider = useDataProvider();
  const notify = useNotify();

  // State
  const [sequences, setSequences] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  // Dialog state
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [sequenceToDelete, setSequenceToDelete] = useState(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [toggleLoading, setToggleLoading] = useState({});

  /**
   * Load sequences from API
   */
  useEffect(() => {
    loadSequences();
  }, []);

  const loadSequences = async () => {
    setLoading(true);
    setError(null);
    try {
      const { data } = await dataProvider.getList('sequences', {
        pagination: { page: 1, perPage: 1000 },
        sort: { field: 'created_at', order: 'DESC' },
        filter: {},
      });
      setSequences(data || []);
    } catch (err) {
      console.error('Failed to load sequences:', err);
      setError('Fehler beim Laden der Sequenzen');
      notify('Fehler beim Laden der Sequenzen', { type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  /**
   * Handle toggle active status
   */
  const handleToggleActive = async (sequence) => {
    setToggleLoading((prev) => ({ ...prev, [sequence.id]: true }));

    try {
      await dataProvider.update('sequences', {
        id: sequence.id,
        data: { is_active: !sequence.is_active },
        previousData: sequence
      });
      setSequences((prev) =>
        prev.map((s) => (s.id === sequence.id ? { ...s, is_active: !s.is_active } : s))
      );
      notify(sequence.is_active ? 'Sequenz deaktiviert' : 'Sequenz aktiviert', { type: 'success' });
    } catch (err) {
      console.error('Failed to toggle sequence:', err);
      notify('Fehler beim Aktualisieren', { type: 'error' });
    } finally {
      setToggleLoading((prev) => ({ ...prev, [sequence.id]: false }));
    }
  };

  /**
   * Handle delete click
   */
  const handleDeleteClick = (sequence) => {
    setSequenceToDelete(sequence);
    setDeleteDialogOpen(true);
  };

  /**
   * Handle delete confirm
   */
  const handleDeleteConfirm = async () => {
    if (!sequenceToDelete) return;

    setDeleteLoading(true);

    try {
      await dataProvider.delete('sequences', {
        id: sequenceToDelete.id,
        previousData: sequenceToDelete
      });
      setSequences((prev) => prev.filter((s) => s.id !== sequenceToDelete.id));
      notify('Sequenz gelöscht', { type: 'success' });
    } catch (err) {
      console.error('Failed to delete sequence:', err);
      notify('Fehler beim Löschen', { type: 'error' });
    } finally {
      setDeleteDialogOpen(false);
      setSequenceToDelete(null);
      setDeleteLoading(false);
    }
  };

  /**
   * Handle delete cancel
   */
  const handleDeleteCancel = () => {
    setDeleteDialogOpen(false);
    setSequenceToDelete(null);
  };

  /**
   * Handle create new sequence
   */
  const handleCreateClick = () => {
    navigate('/email-marketing/new');
  };

  /**
   * Handle edit sequence
   */
  const handleEditClick = (sequence) => {
    navigate(`/email-marketing/${sequence.id}`);
  };

  /**
   * Handle duplicate sequence
   */
  const handleDuplicateClick = async (sequence) => {
    try {
      const { data } = await dataProvider.create('sequences', {
        data: {
          ...sequence,
          id: undefined,
          name: `${sequence.name} (Kopie)`,
          is_active: false,
        }
      });
      setSequences((prev) => [data, ...prev]);
      notify('Sequenz dupliziert', { type: 'success' });
    } catch (err) {
      console.error('Failed to duplicate sequence:', err);
      notify('Fehler beim Duplizieren', { type: 'error' });
    }
  };

  /**
   * Handle refresh
   */
  const handleRefresh = () => {
    loadSequences();
  };

  /**
   * Filter sequences
   */
  const filteredSequences = sequences.filter((seq) => {
    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      if (
        !seq.name?.toLowerCase().includes(query) &&
        !seq.description?.toLowerCase().includes(query)
      ) {
        return false;
      }
    }

    // Status filter
    if (statusFilter === 'active' && !seq.is_active) return false;
    if (statusFilter === 'inactive' && seq.is_active) return false;

    return true;
  });

  /**
   * Handle page change
   */
  const handleChangePage = (event, newPage) => {
    setPage(newPage);
  };

  /**
   * Handle rows per page change
   */
  const handleChangeRowsPerPage = (event) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

  // Calculate stats
  const totalSequences = sequences.length;
  const activeSequences = sequences.filter((s) => s.is_active).length;
  const totalEnrolled = sequences.reduce((sum, s) => sum + (s.enrolled_count || 0), 0);
  const avgOpenRate =
    sequences.length > 0
      ? sequences.reduce((sum, s) => sum + (s.open_rate || 0), 0) / sequences.length
      : 0;

  /**
   * Format date
   */
  const formatDate = (dateString) => {
    if (!dateString) return '—';
    const date = new Date(dateString);
    return date.toLocaleDateString('de-DE', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  };

  return (
    <Box sx={{ p: 3, width: '100%', maxWidth: '100%' }}>
      {/* Page Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 3 }}>
        <Box>
          <Typography
            variant="h4"
            sx={{ fontWeight: 300, display: 'flex', alignItems: 'center', gap: 1.5 }}
          >
            <EmailIcon sx={{ color: 'primary.main' }} />
            E-Mail Marketing
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
            Automatisierte E-Mail-Sequenzen verwalten
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Tooltip title="Aktualisieren">
            <span>
              <IconButton onClick={handleRefresh} disabled={loading}>
                <RefreshIcon />
              </IconButton>
            </span>
          </Tooltip>
          <Button variant="contained" startIcon={<AddIcon />} onClick={handleCreateClick}>
            Neue Sequenz
          </Button>
        </Box>
      </Box>

      {/* Stats Cards */}
      <Box sx={{ display: 'flex', gap: 2, mb: 3, flexWrap: 'wrap' }}>
        <StatsCard
          title="Sequenzen"
          value={totalSequences}
          subvalue={`${activeSequences} aktiv`}
          icon={EmailIcon}
          color="#4A90A4"
        />
        <StatsCard
          title="Aktive Enrollments"
          value={totalEnrolled.toLocaleString()}
          icon={PeopleIcon}
          color="#6C5CE7"
          trend="+12% diese Woche"
        />
        <StatsCard
          title="Ø Öffnungsrate"
          value={`${(avgOpenRate * 100).toFixed(1)}%`}
          icon={OpenIcon}
          color="#28A745"
        />
        <StatsCard
          title="Gesendet (7 Tage)"
          value="1,284"
          icon={SendIcon}
          color="#F59E0B"
        />
      </Box>

      {/* Error Alert */}
      {error && (
        <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {/* Filters */}
      <Card sx={{ mb: 3 }}>
        <CardContent sx={{ py: 2, '&:last-child': { pb: 2 } }}>
          <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', alignItems: 'center' }}>
            <TextField
              placeholder="Sequenzen suchen..."
              size="small"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon color="action" fontSize="small" />
                  </InputAdornment>
                ),
              }}
              sx={{ minWidth: 250 }}
            />
            <TextField
              select
              label="Status"
              size="small"
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setPage(0);
              }}
              sx={{ minWidth: 150 }}
            >
              <MenuItem value="">Alle</MenuItem>
              <MenuItem value="active">Aktiv</MenuItem>
              <MenuItem value="inactive">Inaktiv</MenuItem>
            </TextField>
            {(searchQuery || statusFilter) && (
              <Button
                size="small"
                onClick={() => {
                  setSearchQuery('');
                  setStatusFilter('');
                  setPage(0);
                }}
              >
                Filter zurücksetzen
              </Button>
            )}
          </Box>
        </CardContent>
      </Card>

      {/* Sequences Table */}
      <Card>
        <TableContainer component={Paper} sx={{ bgcolor: 'background.paper' }}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Sequenz</TableCell>
                <TableCell align="center">Schritte</TableCell>
                <TableCell>Fortschritt</TableCell>
                <TableCell align="center">Performance</TableCell>
                <TableCell>Letzte Aktivität</TableCell>
                <TableCell align="center">Status</TableCell>
                <TableCell align="right">Aktionen</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={8} align="center" sx={{ py: 8 }}>
                    <CircularProgress size={32} />
                  </TableCell>
                </TableRow>
              ) : filteredSequences.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} align="center" sx={{ py: 8 }}>
                    <Box sx={{ textAlign: 'center' }}>
                      <EmailIcon sx={{ fontSize: 48, color: 'text.secondary', mb: 1 }} />
                      <Typography color="text.secondary">
                        {searchQuery || statusFilter
                          ? 'Keine Sequenzen gefunden'
                          : 'Noch keine Sequenzen vorhanden'}
                      </Typography>
                      {!searchQuery && !statusFilter && (
                        <Button
                          variant="outlined"
                          startIcon={<AddIcon />}
                          onClick={handleCreateClick}
                          sx={{ mt: 2 }}
                        >
                          Erste Sequenz erstellen
                        </Button>
                      )}
                    </Box>
                  </TableCell>
                </TableRow>
              ) : (
                filteredSequences
                  .slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage)
                  .map((sequence) => (
                    <TableRow
                      key={sequence.id}
                      hover
                      sx={{
                        '&:hover': { bgcolor: 'action.hover' },
                        opacity: sequence.is_active ? 1 : 0.6,
                        cursor: 'pointer',
                      }}
                      onClick={() => handleEditClick(sequence)}
                    >
                      <TableCell>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                          <Avatar
                            sx={{
                              width: 40,
                              height: 40,
                              bgcolor: sequence.is_active ? 'primary.main' : 'action.disabled',
                            }}
                          >
                            <EmailIcon sx={{ fontSize: 20 }} />
                          </Avatar>
                          <Box>
                            <Typography variant="body2" fontWeight={600}>
                              {sequence.name}
                            </Typography>
                            <Typography
                              variant="caption"
                              color="text.secondary"
                              sx={{
                                display: 'block',
                                maxWidth: 200,
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap',
                              }}
                            >
                              {sequence.description}
                            </Typography>
                          </Box>
                        </Box>
                      </TableCell>
                      <TableCell align="center">
                        <Chip
                          label={`${sequence.steps_count} E-Mails`}
                          size="small"
                          variant="outlined"
                          sx={{ fontSize: '0.75rem' }}
                        />
                      </TableCell>
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <SequenceProgress
                          enrolled={sequence.enrolled_count}
                          completed={sequence.completed_count}
                        />
                      </TableCell>
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <Box sx={{ display: 'flex', gap: 3, justifyContent: 'center' }}>
                          <RateDisplay rate={sequence.open_rate} label="Opens" />
                          <RateDisplay rate={sequence.click_rate} label="Clicks" />
                        </Box>
                      </TableCell>
                      <TableCell>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                          <TimeIcon sx={{ fontSize: 14, color: 'text.secondary' }} />
                          <Typography variant="caption" color="text.secondary">
                            {formatDate(sequence.last_sent_at)}
                          </Typography>
                        </Box>
                      </TableCell>
                      <TableCell align="center" onClick={(e) => e.stopPropagation()}>
                        <Tooltip title={sequence.is_active ? 'Deaktivieren' : 'Aktivieren'}>
                          <span>
                            <Switch
                              checked={sequence.is_active}
                              onChange={() => handleToggleActive(sequence)}
                              disabled={toggleLoading[sequence.id]}
                              size="small"
                              color="success"
                            />
                          </span>
                        </Tooltip>
                      </TableCell>
                      <TableCell align="right" onClick={(e) => e.stopPropagation()}>
                        <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 0.5 }}>
                          <Tooltip title="Bearbeiten">
                            <IconButton size="small" onClick={() => handleEditClick(sequence)}>
                              <EditIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                          <Tooltip title="Duplizieren">
                            <IconButton size="small" onClick={() => handleDuplicateClick(sequence)}>
                              <DuplicateIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                          <Tooltip title="Löschen">
                            <IconButton
                              size="small"
                              onClick={() => handleDeleteClick(sequence)}
                              color="error"
                            >
                              <DeleteIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        </Box>
                      </TableCell>
                    </TableRow>
                  ))
              )}
            </TableBody>
          </Table>
        </TableContainer>
        <TablePagination
          component="div"
          count={filteredSequences.length}
          page={page}
          onPageChange={handleChangePage}
          rowsPerPage={rowsPerPage}
          onRowsPerPageChange={handleChangeRowsPerPage}
          rowsPerPageOptions={[5, 10, 25]}
          labelRowsPerPage="Zeilen pro Seite:"
        />
      </Card>

      {/* Delete Confirmation Dialog */}
      <DeleteDialog
        open={deleteDialogOpen}
        sequence={sequenceToDelete}
        onClose={handleDeleteCancel}
        onConfirm={handleDeleteConfirm}
        loading={deleteLoading}
      />
    </Box>
  );
};

export default EmailMarketingPage;
