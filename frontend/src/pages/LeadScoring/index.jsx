/**
 * Lead Scoring Management Page
 * ScoringRulesList with DataGrid, Filters, and Actions
 * Uses REAL API: GET /scoring/rules
 */
import { useState, useEffect, useCallback } from 'react';
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
  TableSortLabel,
  Paper,
  Skeleton,
  Tabs,
  Tab,
} from '@mui/material';
import {
  Add as AddIcon,
  Delete as DeleteIcon,
  Edit as EditIcon,
  Refresh as RefreshIcon,
  Search as SearchIcon,
  FilterList as FilterIcon,
  TrendingUp as ScoringIcon,
  Category as CategoryIcon,
  Stars as PointsIcon,
  BarChart as StatsIcon,
  Rule as RulesIcon,
} from '@mui/icons-material';
import {
  getScoringRules,
  updateScoringRule,
  deleteScoringRule,
  getScoringRule,
} from '../../providers/dataProvider';
import ScoringRuleEditor from './RuleEditor';
import ScoringStats from './ScoringStats';

/**
 * Category color mapping
 */
const CATEGORY_COLORS = {
  demographic: { bg: 'rgba(74, 144, 164, 0.15)', color: '#4A90A4', label: 'Demographic' },
  engagement: { bg: 'rgba(108, 92, 231, 0.15)', color: '#6C5CE7', label: 'Engagement' },
  behavior: { bg: 'rgba(40, 167, 69, 0.15)', color: '#28A745', label: 'Behavior' },
};

/**
 * Rule type color mapping
 */
const RULE_TYPE_COLORS = {
  event: { bg: 'rgba(245, 158, 11, 0.15)', color: '#F59E0B', label: 'Event' },
  field: { bg: 'rgba(23, 162, 184, 0.15)', color: '#17A2B8', label: 'Field' },
  threshold: { bg: 'rgba(220, 53, 69, 0.15)', color: '#DC3545', label: 'Threshold' },
};

/**
 * Category Badge Component
 */
const CategoryBadge = ({ category }) => {
  const config = CATEGORY_COLORS[category] || CATEGORY_COLORS.engagement;
  return (
    <Chip
      label={config.label}
      size="small"
      sx={{
        bgcolor: config.bg,
        color: config.color,
        border: `1px solid ${config.color}40`,
        fontWeight: 500,
        fontSize: '0.7rem',
      }}
    />
  );
};

/**
 * Rule Type Badge Component
 */
const RuleTypeBadge = ({ ruleType }) => {
  const config = RULE_TYPE_COLORS[ruleType] || RULE_TYPE_COLORS.event;
  return (
    <Chip
      label={config.label}
      size="small"
      variant="outlined"
      sx={{
        borderColor: config.color,
        color: config.color,
        fontWeight: 500,
        fontSize: '0.7rem',
      }}
    />
  );
};

/**
 * Points Display Component
 */
const PointsDisplay = ({ points }) => {
  const isPositive = points >= 0;
  return (
    <Box
      sx={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 0.5,
        px: 1,
        py: 0.25,
        borderRadius: 1,
        bgcolor: isPositive ? 'rgba(40, 167, 69, 0.1)' : 'rgba(220, 53, 69, 0.1)',
        color: isPositive ? '#28A745' : '#DC3545',
        fontWeight: 600,
        fontSize: '0.85rem',
      }}
    >
      {isPositive ? '+' : ''}{points}
    </Box>
  );
};

/**
 * Limits Display Component
 */
const LimitsDisplay = ({ maxPerDay, maxPerLead }) => {
  if (!maxPerDay && !maxPerLead) {
    return <Typography color="text.secondary" variant="body2">—</Typography>;
  }
  
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.25 }}>
      {maxPerDay && (
        <Typography variant="caption" color="text.secondary">
          {maxPerDay}/day
        </Typography>
      )}
      {maxPerLead && (
        <Typography variant="caption" color="text.secondary">
          {maxPerLead}/lead
        </Typography>
      )}
    </Box>
  );
};

/**
 * Delete Confirmation Dialog
 */
const DeleteDialog = ({ open, rule, onClose, onConfirm, loading }) => (
  <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
    <DialogTitle>Delete Scoring Rule</DialogTitle>
    <DialogContent>
      <DialogContentText>
        Are you sure you want to delete the rule <strong>"{rule?.name}"</strong>?
        This action cannot be undone.
      </DialogContentText>
    </DialogContent>
    <DialogActions>
      <Button onClick={onClose} disabled={loading}>Cancel</Button>
      <Button
        onClick={onConfirm}
        color="error"
        variant="contained"
        disabled={loading}
        startIcon={loading ? <CircularProgress size={16} /> : <DeleteIcon />}
      >
        Delete
      </Button>
    </DialogActions>
  </Dialog>
);

/**
 * Loading Skeleton for Table
 */
const TableSkeleton = ({ rows = 5 }) => (
  <>
    {[...Array(rows)].map((_, i) => (
      <TableRow key={i}>
        <TableCell><Skeleton variant="text" width={120} /></TableCell>
        <TableCell><Skeleton variant="rounded" width={80} height={24} /></TableCell>
        <TableCell><Skeleton variant="rounded" width={60} height={24} /></TableCell>
        <TableCell><Skeleton variant="text" width={40} /></TableCell>
        <TableCell><Skeleton variant="text" width={50} /></TableCell>
        <TableCell><Skeleton variant="rounded" width={50} height={24} /></TableCell>
        <TableCell><Skeleton variant="rounded" width={80} height={24} /></TableCell>
      </TableRow>
    ))}
  </>
);

/**
 * Stats Card Component
 */
const StatsCard = ({ title, value, icon: Icon, color }) => (
  <Card sx={{ flex: 1, minWidth: 140 }}>
    <CardContent sx={{ py: 2, px: 2.5, '&:last-child': { pb: 2 } }}>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Box>
          <Typography variant="caption" color="text.secondary" sx={{ textTransform: 'uppercase', letterSpacing: 0.5 }}>
            {title}
          </Typography>
          <Typography variant="h4" sx={{ fontWeight: 600, color }}>
            {value}
          </Typography>
        </Box>
        <Icon sx={{ fontSize: 32, color, opacity: 0.7 }} />
      </Box>
    </CardContent>
  </Card>
);

/**
 * Tab Panel Component
 */
const TabPanel = ({ children, value, index, ...other }) => (
  <div
    role="tabpanel"
    hidden={value !== index}
    id={`scoring-tabpanel-${index}`}
    aria-labelledby={`scoring-tab-${index}`}
    {...other}
  >
    {value === index && <Box sx={{ pt: 3 }}>{children}</Box>}
  </div>
);

/**
 * Main Lead Scoring Page Component
 */
const LeadScoringPage = () => {
  // Tab state
  const [activeTab, setActiveTab] = useState(0);
  
  // State
  const [rules, setRules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [total, setTotal] = useState(0);
  const [orderBy, setOrderBy] = useState('name');
  const [order, setOrder] = useState('asc');
  
  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  
  // Dialog state
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [ruleToDelete, setRuleToDelete] = useState(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [toggleLoading, setToggleLoading] = useState({});
  
  // Editor dialog state
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingRule, setEditingRule] = useState(null);
  const [loadingRule, setLoadingRule] = useState({});

  /**
   * Handle tab change
   */
  const handleTabChange = (event, newValue) => {
    setActiveTab(newValue);
  };

  /**
   * Fetch scoring rules from API
   */
  const fetchRules = useCallback(async () => {
    setLoading(true);
    setError(null);
    
    try {
      const params = {
        page: page + 1,
        limit: rowsPerPage,
      };
      
      if (categoryFilter) {
        params.category = categoryFilter;
      }
      if (statusFilter !== '') {
        params.is_active = statusFilter === 'active';
      }
      
      const response = await getScoringRules(params);
      setRules(response.data || []);
      setTotal(response.meta?.total || response.data?.length || 0);
    } catch (err) {
      console.error('Failed to fetch scoring rules:', err);
      setError(err.message || 'Failed to load scoring rules');
      setRules([]);
    } finally {
      setLoading(false);
    }
  }, [page, rowsPerPage, categoryFilter, statusFilter]);

  useEffect(() => {
    fetchRules();
  }, [fetchRules]);

  /**
   * Handle sort change
   */
  const handleSort = (property) => {
    const isAsc = orderBy === property && order === 'asc';
    setOrder(isAsc ? 'desc' : 'asc');
    setOrderBy(property);
  };

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

  /**
   * Handle toggle active status
   */
  const handleToggleActive = async (rule) => {
    setToggleLoading(prev => ({ ...prev, [rule.id]: true }));
    
    try {
      await updateScoringRule(rule.id, { is_active: !rule.is_active });
      // Update local state
      setRules(prev => prev.map(r => 
        r.id === rule.id ? { ...r, is_active: !r.is_active } : r
      ));
    } catch (err) {
      console.error('Failed to toggle rule status:', err);
      setError(`Failed to update rule: ${err.message}`);
    } finally {
      setToggleLoading(prev => ({ ...prev, [rule.id]: false }));
    }
  };

  /**
   * Handle delete click
   */
  const handleDeleteClick = (rule) => {
    setRuleToDelete(rule);
    setDeleteDialogOpen(true);
  };

  /**
   * Handle delete confirm
   */
  const handleDeleteConfirm = async () => {
    if (!ruleToDelete) return;
    
    setDeleteLoading(true);
    
    try {
      await deleteScoringRule(ruleToDelete.id);
      setDeleteDialogOpen(false);
      setRuleToDelete(null);
      // Refresh the list
      fetchRules();
    } catch (err) {
      console.error('Failed to delete rule:', err);
      setError(`Failed to delete rule: ${err.message}`);
    } finally {
      setDeleteLoading(false);
    }
  };

  /**
   * Handle delete cancel
   */
  const handleDeleteCancel = () => {
    setDeleteDialogOpen(false);
    setRuleToDelete(null);
  };

  /**
   * Handle create new rule
   */
  const handleCreateClick = () => {
    setEditingRule(null);
    setEditorOpen(true);
  };

  /**
   * Handle edit rule click
   */
  const handleEditClick = async (rule) => {
    setLoadingRule(prev => ({ ...prev, [rule.id]: true }));
    
    try {
      // Fetch fresh rule data with full details
      const freshRule = await getScoringRule(rule.id);
      setEditingRule(freshRule.data || freshRule);
      setEditorOpen(true);
    } catch (err) {
      console.error('Failed to fetch rule details:', err);
      setError(`Failed to load rule: ${err.message}`);
    } finally {
      setLoadingRule(prev => ({ ...prev, [rule.id]: false }));
    }
  };

  /**
   * Handle editor close
   */
  const handleEditorClose = () => {
    setEditorOpen(false);
    setEditingRule(null);
  };

  /**
   * Handle editor success
   */
  const handleEditorSuccess = () => {
    fetchRules();
  };

  /**
   * Filter rules by search query (client-side)
   */
  const filteredRules = rules.filter(rule => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      rule.name?.toLowerCase().includes(query) ||
      rule.slug?.toLowerCase().includes(query) ||
      rule.description?.toLowerCase().includes(query)
    );
  });

  /**
   * Sort rules (client-side)
   */
  const sortedRules = [...filteredRules].sort((a, b) => {
    const aValue = a[orderBy] ?? '';
    const bValue = b[orderBy] ?? '';
    
    if (typeof aValue === 'string') {
      return order === 'asc' 
        ? aValue.localeCompare(bValue)
        : bValue.localeCompare(aValue);
    }
    
    return order === 'asc' ? aValue - bValue : bValue - aValue;
  });

  // Calculate stats
  const totalRules = total;
  const activeRules = rules.filter(r => r.is_active).length;
  const totalPoints = rules.reduce((sum, r) => sum + (r.points || 0), 0);

  return (
    <Box sx={{ p: 3 }}>
      {/* Page Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 3 }}>
        <Box>
          <Typography variant="h4" sx={{ fontWeight: 300, display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <ScoringIcon sx={{ color: 'primary.main' }} />
            Lead Scoring
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
            Manage scoring rules and view statistics
          </Typography>
        </Box>
        {activeTab === 0 && (
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Tooltip title="Refresh">
              <span>
                <IconButton onClick={fetchRules} disabled={loading}>
                  <RefreshIcon />
                </IconButton>
              </span>
            </Tooltip>
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={handleCreateClick}
            >
              Create Rule
            </Button>
          </Box>
        )}
      </Box>

      {/* Tabs */}
      <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 0 }}>
        <Tabs 
          value={activeTab} 
          onChange={handleTabChange}
          sx={{
            '& .MuiTab-root': {
              textTransform: 'none',
              fontWeight: 500,
              minHeight: 48,
            },
          }}
        >
          <Tab 
            icon={<RulesIcon sx={{ fontSize: 20 }} />} 
            iconPosition="start" 
            label="Rules" 
            id="scoring-tab-0"
            aria-controls="scoring-tabpanel-0"
          />
          <Tab 
            icon={<StatsIcon sx={{ fontSize: 20 }} />} 
            iconPosition="start" 
            label="Statistics" 
            id="scoring-tab-1"
            aria-controls="scoring-tabpanel-1"
          />
        </Tabs>
      </Box>

      {/* Statistics Tab */}
      <TabPanel value={activeTab} index={1}>
        <ScoringStats />
      </TabPanel>

      {/* Rules Tab */}
      <TabPanel value={activeTab} index={0}>
        {/* Stats Cards */}
        <Box sx={{ display: 'flex', gap: 2, mb: 3, flexWrap: 'wrap' }}>
          <StatsCard 
            title="Total Rules" 
            value={loading ? '—' : totalRules} 
            icon={ScoringIcon} 
            color="#4A90A4" 
          />
          <StatsCard 
            title="Active Rules" 
            value={loading ? '—' : activeRules} 
            icon={CategoryIcon} 
            color="#28A745" 
          />
          <StatsCard 
            title="Avg Points" 
            value={loading || rules.length === 0 ? '—' : Math.round(totalPoints / rules.length)} 
            icon={PointsIcon} 
            color="#6C5CE7" 
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
              placeholder="Search rules..."
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
              sx={{ minWidth: 220 }}
            />
            <TextField
              select
              label="Category"
              size="small"
              value={categoryFilter}
              onChange={(e) => {
                setCategoryFilter(e.target.value);
                setPage(0);
              }}
              sx={{ minWidth: 150 }}
            >
              <MenuItem value="">All Categories</MenuItem>
              <MenuItem value="demographic">Demographic</MenuItem>
              <MenuItem value="engagement">Engagement</MenuItem>
              <MenuItem value="behavior">Behavior</MenuItem>
            </TextField>
            <TextField
              select
              label="Status"
              size="small"
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setPage(0);
              }}
              sx={{ minWidth: 130 }}
            >
              <MenuItem value="">All Status</MenuItem>
              <MenuItem value="active">Active</MenuItem>
              <MenuItem value="inactive">Inactive</MenuItem>
            </TextField>
            {(categoryFilter || statusFilter || searchQuery) && (
              <Button
                size="small"
                onClick={() => {
                  setCategoryFilter('');
                  setStatusFilter('');
                  setSearchQuery('');
                  setPage(0);
                }}
              >
                Clear Filters
              </Button>
            )}
          </Box>
        </CardContent>
      </Card>

      {/* Rules Table */}
      <Card>
        <TableContainer component={Paper} sx={{ bgcolor: 'background.paper' }}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>
                  <TableSortLabel
                    active={orderBy === 'name'}
                    direction={orderBy === 'name' ? order : 'asc'}
                    onClick={() => handleSort('name')}
                  >
                    Rule Name
                  </TableSortLabel>
                </TableCell>
                <TableCell>
                  <TableSortLabel
                    active={orderBy === 'category'}
                    direction={orderBy === 'category' ? order : 'asc'}
                    onClick={() => handleSort('category')}
                  >
                    Category
                  </TableSortLabel>
                </TableCell>
                <TableCell>Type</TableCell>
                <TableCell align="right">
                  <TableSortLabel
                    active={orderBy === 'points'}
                    direction={orderBy === 'points' ? order : 'asc'}
                    onClick={() => handleSort('points')}
                  >
                    Points
                  </TableSortLabel>
                </TableCell>
                <TableCell>Limits</TableCell>
                <TableCell align="center">Status</TableCell>
                <TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {loading ? (
                <TableSkeleton rows={rowsPerPage} />
              ) : sortedRules.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} align="center" sx={{ py: 8 }}>
                    <Typography color="text.secondary">
                      {searchQuery || categoryFilter || statusFilter 
                        ? 'No rules match your filters' 
                        : 'No scoring rules found'}
                    </Typography>
                  </TableCell>
                </TableRow>
              ) : (
                sortedRules.map((rule) => (
                  <TableRow
                    key={rule.id}
                    hover
                    sx={{
                      '&:hover': { bgcolor: 'action.hover' },
                      opacity: rule.is_active ? 1 : 0.6,
                    }}
                  >
                    <TableCell>
                      <Box>
                        <Typography variant="body2" fontWeight={500}>
                          {rule.name}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {rule.slug}
                        </Typography>
                      </Box>
                    </TableCell>
                    <TableCell>
                      <CategoryBadge category={rule.category} />
                    </TableCell>
                    <TableCell>
                      <RuleTypeBadge ruleType={rule.rule_type} />
                    </TableCell>
                    <TableCell align="right">
                      <PointsDisplay points={rule.points} />
                    </TableCell>
                    <TableCell>
                      <LimitsDisplay 
                        maxPerDay={rule.max_per_day} 
                        maxPerLead={rule.max_per_lead} 
                      />
                    </TableCell>
                    <TableCell align="center">
                      <Tooltip title={rule.is_active ? 'Click to deactivate' : 'Click to activate'}>
                        <span>
                          <Switch
                            checked={rule.is_active}
                            onChange={() => handleToggleActive(rule)}
                            disabled={toggleLoading[rule.id]}
                            size="small"
                            color="success"
                          />
                        </span>
                      </Tooltip>
                    </TableCell>
                    <TableCell align="right">
                      <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 0.5 }}>
                        <Tooltip title="Edit Rule">
                          <span>
                            <IconButton 
                              size="small" 
                              onClick={() => handleEditClick(rule)}
                              disabled={loadingRule[rule.id]}
                            >
                              {loadingRule[rule.id] ? (
                                <CircularProgress size={16} />
                              ) : (
                                <EditIcon fontSize="small" />
                              )}
                            </IconButton>
                          </span>
                        </Tooltip>
                        <Tooltip title="Delete">
                          <IconButton 
                            size="small" 
                            onClick={() => handleDeleteClick(rule)}
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
          count={total}
          page={page}
          onPageChange={handleChangePage}
          rowsPerPage={rowsPerPage}
          onRowsPerPageChange={handleChangeRowsPerPage}
          rowsPerPageOptions={[5, 10, 25, 50]}
        />
      </Card>
      </TabPanel>

      {/* Delete Confirmation Dialog */}
      <DeleteDialog
        open={deleteDialogOpen}
        rule={ruleToDelete}
        onClose={handleDeleteCancel}
        onConfirm={handleDeleteConfirm}
        loading={deleteLoading}
      />

      {/* Scoring Rule Editor Dialog */}
      <ScoringRuleEditor
        open={editorOpen}
        onClose={handleEditorClose}
        onSuccess={handleEditorSuccess}
        rule={editingRule}
      />
    </Box>
  );
};

export default LeadScoringPage;
