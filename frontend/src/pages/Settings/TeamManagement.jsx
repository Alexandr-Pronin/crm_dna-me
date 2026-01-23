/**
 * Team Management Component
 * Full CRUD with Real API (GET /api/v1/team)
 */
import { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Button,
  IconButton,
  Tooltip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  MenuItem,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TablePagination,
  TableSortLabel,
  Paper,
  Chip,
  Avatar,
  LinearProgress,
  Alert,
  CircularProgress,
  InputAdornment,
  Switch,
  FormControlLabel,
  Grid,
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Refresh as RefreshIcon,
  Search as SearchIcon,
  PersonOff as DeactivateIcon,
  PersonAdd as ActivateIcon,
  Group as TeamIcon,
  Work as WorkloadIcon,
} from '@mui/icons-material';
import {
  getTeamMembers,
  getTeamStats,
  createTeamMember,
  updateTeamMember,
  deleteTeamMember,
  deactivateTeamMember,
} from '../../providers/dataProvider';

// =============================================================================
// Role Configuration
// =============================================================================

const ROLES = [
  { id: 'bdr', name: 'Business Development Rep', color: '#4A90A4' },
  { id: 'ae', name: 'Account Executive', color: '#6C5CE7' },
  { id: 'partnership_manager', name: 'Partnership Manager', color: '#28A745' },
  { id: 'marketing_manager', name: 'Marketing Manager', color: '#F59E0B' },
  { id: 'admin', name: 'Administrator', color: '#DC3545' },
];

const getRoleConfig = (role) => ROLES.find(r => r.id === role) || { name: role, color: '#64748B' };

// =============================================================================
// Stats Card Component
// =============================================================================

const StatsCard = ({ title, value, icon: Icon, color, subtitle }) => (
  <Card sx={{ height: '100%' }}>
    <CardContent sx={{ py: 2 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Box>
          <Typography variant="caption" color="text.secondary" sx={{ textTransform: 'uppercase' }}>
            {title}
          </Typography>
          <Typography variant="h4" sx={{ fontWeight: 600, color }}>
            {value}
          </Typography>
          {subtitle && (
            <Typography variant="caption" color="text.secondary">
              {subtitle}
            </Typography>
          )}
        </Box>
        <Icon sx={{ fontSize: 40, color, opacity: 0.7 }} />
      </Box>
    </CardContent>
  </Card>
);

// =============================================================================
// Role Badge Component
// =============================================================================

const RoleBadge = ({ role }) => {
  const config = getRoleConfig(role);
  return (
    <Chip
      label={config.name}
      size="small"
      sx={{
        bgcolor: `${config.color}20`,
        color: config.color,
        fontWeight: 500,
        fontSize: '0.7rem',
      }}
    />
  );
};

// =============================================================================
// Workload Indicator Component
// =============================================================================

const WorkloadIndicator = ({ current, max }) => {
  const percentage = max > 0 ? Math.round((current / max) * 100) : 0;
  const color = percentage >= 90 ? 'error' : percentage >= 70 ? 'warning' : 'success';
  
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, minWidth: 120 }}>
      <LinearProgress
        variant="determinate"
        value={percentage}
        color={color}
        sx={{ flex: 1, height: 8, borderRadius: 4 }}
      />
      <Typography variant="caption" color="text.secondary" sx={{ minWidth: 45 }}>
        {current}/{max}
      </Typography>
    </Box>
  );
};

// =============================================================================
// Create/Edit Dialog Component
// =============================================================================

const MemberDialog = ({ open, member, onClose, onSave, loading }) => {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    role: 'bdr',
    region: '',
    max_leads: 50,
    is_active: true,
  });
  const [errors, setErrors] = useState({});

  useEffect(() => {
    if (member) {
      setFormData({
        name: member.name || '',
        email: member.email || '',
        role: member.role || 'bdr',
        region: member.region || '',
        max_leads: member.max_leads || 50,
        is_active: member.is_active !== false,
      });
    } else {
      setFormData({
        name: '',
        email: '',
        role: 'bdr',
        region: '',
        max_leads: 50,
        is_active: true,
      });
    }
    setErrors({});
  }, [member, open]);

  const validate = () => {
    const newErrors = {};
    if (!formData.name.trim()) newErrors.name = 'Name is required';
    if (!formData.email.trim()) newErrors.email = 'Email is required';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = 'Invalid email format';
    }
    if (!formData.role) newErrors.role = 'Role is required';
    if (formData.max_leads < 1 || formData.max_leads > 1000) {
      newErrors.max_leads = 'Max leads must be between 1 and 1000';
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = () => {
    if (validate()) {
      onSave(formData);
    }
  };

  const handleChange = (field) => (event) => {
    const value = field === 'is_active' ? event.target.checked : event.target.value;
    setFormData(prev => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: undefined }));
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>
        {member ? 'Edit Team Member' : 'Add Team Member'}
      </DialogTitle>
      <DialogContent>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
          <TextField
            label="Full Name"
            value={formData.name}
            onChange={handleChange('name')}
            error={!!errors.name}
            helperText={errors.name}
            fullWidth
            required
          />
          <TextField
            label="Email Address"
            type="email"
            value={formData.email}
            onChange={handleChange('email')}
            error={!!errors.email}
            helperText={errors.email}
            fullWidth
            required
            disabled={!!member} // Cannot change email of existing member
          />
          <TextField
            label="Role"
            select
            value={formData.role}
            onChange={handleChange('role')}
            error={!!errors.role}
            helperText={errors.role}
            fullWidth
            required
          >
            {ROLES.map(role => (
              <MenuItem key={role.id} value={role.id}>
                {role.name}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            label="Region"
            value={formData.region}
            onChange={handleChange('region')}
            fullWidth
            placeholder="e.g., DACH, EU, US"
          />
          <TextField
            label="Max Leads Capacity"
            type="number"
            value={formData.max_leads}
            onChange={handleChange('max_leads')}
            error={!!errors.max_leads}
            helperText={errors.max_leads || 'Maximum concurrent leads this member can handle'}
            fullWidth
            inputProps={{ min: 1, max: 1000 }}
          />
          <FormControlLabel
            control={
              <Switch
                checked={formData.is_active}
                onChange={handleChange('is_active')}
                color="success"
              />
            }
            label="Active"
          />
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={loading}>
          Cancel
        </Button>
        <Button
          onClick={handleSubmit}
          variant="contained"
          disabled={loading}
          startIcon={loading ? <CircularProgress size={16} /> : null}
        >
          {member ? 'Update' : 'Create'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

// =============================================================================
// Delete Confirmation Dialog
// =============================================================================

const DeleteDialog = ({ open, member, onClose, onConfirm, loading }) => (
  <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
    <DialogTitle>Delete Team Member</DialogTitle>
    <DialogContent>
      <Typography>
        Are you sure you want to delete <strong>{member?.name}</strong>?
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
        This action cannot be undone. Consider deactivating instead if they have assigned deals or tasks.
      </Typography>
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

// =============================================================================
// Main Team Management Component
// =============================================================================

const TeamManagement = () => {
  // State
  const [members, setMembers] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [total, setTotal] = useState(0);
  const [orderBy, setOrderBy] = useState('name');
  const [order, setOrder] = useState('asc');
  
  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  
  // Dialogs
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedMember, setSelectedMember] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);

  // =============================================================================
  // Data Fetching
  // =============================================================================

  const fetchMembers = useCallback(async () => {
    setLoading(true);
    setError(null);
    
    try {
      const params = {
        page: page + 1,
        limit: rowsPerPage,
        sort_by: orderBy,
        sort_order: order,
      };
      
      if (roleFilter) params.role = roleFilter;
      if (statusFilter !== '') params.is_active = statusFilter === 'active';
      if (searchQuery) params.search = searchQuery;
      
      const response = await getTeamMembers(params);
      setMembers(response.data || []);
      setTotal(response.pagination?.total || response.data?.length || 0);
    } catch (err) {
      console.error('Failed to fetch team members:', err);
      setError(err.message || 'Failed to load team members');
      setMembers([]);
    } finally {
      setLoading(false);
    }
  }, [page, rowsPerPage, orderBy, order, roleFilter, statusFilter, searchQuery]);

  const fetchStats = useCallback(async () => {
    try {
      const response = await getTeamStats();
      setStats(response);
    } catch (err) {
      console.error('Failed to fetch team stats:', err);
    }
  }, []);

  useEffect(() => {
    fetchMembers();
  }, [fetchMembers]);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  // =============================================================================
  // Handlers
  // =============================================================================

  const handleSort = (property) => {
    const isAsc = orderBy === property && order === 'asc';
    setOrder(isAsc ? 'desc' : 'asc');
    setOrderBy(property);
  };

  const handleChangePage = (event, newPage) => {
    setPage(newPage);
  };

  const handleChangeRowsPerPage = (event) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

  const handleCreateClick = () => {
    setSelectedMember(null);
    setEditDialogOpen(true);
  };

  const handleEditClick = (member) => {
    setSelectedMember(member);
    setEditDialogOpen(true);
  };

  const handleDeleteClick = (member) => {
    setSelectedMember(member);
    setDeleteDialogOpen(true);
  };

  const handleSave = async (formData) => {
    setActionLoading(true);
    
    try {
      if (selectedMember) {
        await updateTeamMember(selectedMember.id, formData);
      } else {
        await createTeamMember(formData);
      }
      setEditDialogOpen(false);
      setSelectedMember(null);
      fetchMembers();
      fetchStats();
    } catch (err) {
      console.error('Failed to save team member:', err);
      setError(err.body?.error?.message || err.message || 'Failed to save team member');
    } finally {
      setActionLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedMember) return;
    
    setActionLoading(true);
    
    try {
      await deleteTeamMember(selectedMember.id);
      setDeleteDialogOpen(false);
      setSelectedMember(null);
      fetchMembers();
      fetchStats();
    } catch (err) {
      console.error('Failed to delete team member:', err);
      setError(err.body?.error?.message || err.message || 'Failed to delete team member');
    } finally {
      setActionLoading(false);
    }
  };

  const handleToggleActive = async (member) => {
    setActionLoading(true);
    
    try {
      if (member.is_active) {
        await deactivateTeamMember(member.id);
      } else {
        await updateTeamMember(member.id, { is_active: true });
      }
      fetchMembers();
      fetchStats();
    } catch (err) {
      console.error('Failed to toggle member status:', err);
      setError(err.body?.error?.message || err.message || 'Failed to update status');
    } finally {
      setActionLoading(false);
    }
  };

  // =============================================================================
  // Render
  // =============================================================================

  return (
    <Box>
      {/* Stats Cards */}
      {stats && (
        <Grid container spacing={2} sx={{ mb: 3 }}>
          <Grid item xs={12} sm={6} md={3}>
            <StatsCard
              title="Total Members"
              value={stats.total_members}
              icon={TeamIcon}
              color="#4A90A4"
            />
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <StatsCard
              title="Active Members"
              value={stats.active_members}
              icon={TeamIcon}
              color="#28A745"
            />
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <StatsCard
              title="Total Capacity"
              value={stats.total_capacity}
              icon={WorkloadIcon}
              color="#6C5CE7"
              subtitle={`${stats.total_assigned} assigned`}
            />
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <StatsCard
              title="Utilization"
              value={`${stats.utilization_percentage}%`}
              icon={WorkloadIcon}
              color={stats.utilization_percentage >= 80 ? '#DC3545' : '#F59E0B'}
            />
          </Grid>
        </Grid>
      )}

      {/* Actions Bar */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="h6" sx={{ fontWeight: 500 }}>
          Team Members
        </Typography>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Tooltip title="Refresh">
            <IconButton onClick={() => { fetchMembers(); fetchStats(); }} disabled={loading}>
              <RefreshIcon />
            </IconButton>
          </Tooltip>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={handleCreateClick}
          >
            Add Member
          </Button>
        </Box>
      </Box>

      {/* Error Alert */}
      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {/* Filters */}
      <Card sx={{ mb: 2 }}>
        <CardContent sx={{ py: 2, '&:last-child': { pb: 2 } }}>
          <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', alignItems: 'center' }}>
            <TextField
              placeholder="Search members..."
              size="small"
              value={searchQuery}
              onChange={(e) => { setSearchQuery(e.target.value); setPage(0); }}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon color="action" fontSize="small" />
                  </InputAdornment>
                ),
              }}
              sx={{ minWidth: 200 }}
            />
            <TextField
              select
              label="Role"
              size="small"
              value={roleFilter}
              onChange={(e) => { setRoleFilter(e.target.value); setPage(0); }}
              sx={{ minWidth: 180 }}
            >
              <MenuItem value="">All Roles</MenuItem>
              {ROLES.map(role => (
                <MenuItem key={role.id} value={role.id}>{role.name}</MenuItem>
              ))}
            </TextField>
            <TextField
              select
              label="Status"
              size="small"
              value={statusFilter}
              onChange={(e) => { setStatusFilter(e.target.value); setPage(0); }}
              sx={{ minWidth: 130 }}
            >
              <MenuItem value="">All Status</MenuItem>
              <MenuItem value="active">Active</MenuItem>
              <MenuItem value="inactive">Inactive</MenuItem>
            </TextField>
            {(roleFilter || statusFilter || searchQuery) && (
              <Button
                size="small"
                onClick={() => {
                  setRoleFilter('');
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

      {/* Table */}
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
                    Member
                  </TableSortLabel>
                </TableCell>
                <TableCell>
                  <TableSortLabel
                    active={orderBy === 'role'}
                    direction={orderBy === 'role' ? order : 'asc'}
                    onClick={() => handleSort('role')}
                  >
                    Role
                  </TableSortLabel>
                </TableCell>
                <TableCell>Region</TableCell>
                <TableCell>Workload</TableCell>
                <TableCell align="center">Status</TableCell>
                <TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={6} align="center" sx={{ py: 4 }}>
                    <CircularProgress size={32} />
                  </TableCell>
                </TableRow>
              ) : members.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} align="center" sx={{ py: 4 }}>
                    <Typography color="text.secondary">
                      {searchQuery || roleFilter || statusFilter 
                        ? 'No members match your filters' 
                        : 'No team members found'}
                    </Typography>
                  </TableCell>
                </TableRow>
              ) : (
                members.map((member) => (
                  <TableRow
                    key={member.id}
                    hover
                    sx={{ opacity: member.is_active ? 1 : 0.6 }}
                  >
                    <TableCell>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                        <Avatar sx={{ bgcolor: getRoleConfig(member.role).color, width: 36, height: 36 }}>
                          {member.name?.charAt(0) || '?'}
                        </Avatar>
                        <Box>
                          <Typography variant="body2" fontWeight={500}>
                            {member.name}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            {member.email}
                          </Typography>
                        </Box>
                      </Box>
                    </TableCell>
                    <TableCell>
                      <RoleBadge role={member.role} />
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" color="text.secondary">
                        {member.region || '—'}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <WorkloadIndicator
                        current={member.current_leads || 0}
                        max={member.max_leads || 50}
                      />
                    </TableCell>
                    <TableCell align="center">
                      <Chip
                        label={member.is_active ? 'Active' : 'Inactive'}
                        size="small"
                        color={member.is_active ? 'success' : 'default'}
                        variant={member.is_active ? 'filled' : 'outlined'}
                      />
                    </TableCell>
                    <TableCell align="right">
                      <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 0.5 }}>
                        <Tooltip title={member.is_active ? 'Deactivate' : 'Activate'}>
                          <IconButton
                            size="small"
                            onClick={() => handleToggleActive(member)}
                            disabled={actionLoading}
                          >
                            {member.is_active ? <DeactivateIcon fontSize="small" /> : <ActivateIcon fontSize="small" />}
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Edit">
                          <IconButton
                            size="small"
                            onClick={() => handleEditClick(member)}
                          >
                            <EditIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Delete">
                          <IconButton
                            size="small"
                            onClick={() => handleDeleteClick(member)}
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

      {/* Dialogs */}
      <MemberDialog
        open={editDialogOpen}
        member={selectedMember}
        onClose={() => { setEditDialogOpen(false); setSelectedMember(null); }}
        onSave={handleSave}
        loading={actionLoading}
      />
      
      <DeleteDialog
        open={deleteDialogOpen}
        member={selectedMember}
        onClose={() => { setDeleteDialogOpen(false); setSelectedMember(null); }}
        onConfirm={handleDelete}
        loading={actionLoading}
      />
    </Box>
  );
};

export default TeamManagement;
