import { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Button,
  Card,
  CardContent,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  IconButton,
  Chip,
  LinearProgress,
  Alert,
  Snackbar,
  FormHelperText,
} from '@mui/material';
import {
  DataGrid,
  GridToolbarContainer,
  GridToolbarFilterButton,
  GridToolbarDensitySelector,
} from '@mui/x-data-grid';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  PersonOff as DeactivateIcon,
  Refresh as RefreshIcon,
} from '@mui/icons-material';
import {
  getTeamMembers,
  getTeamStats,
  createTeamMember,
  updateTeamMember,
  deleteTeamMember,
  deactivateTeamMember,
  getTeamWorkload,
} from '../../providers/dataProvider';

const ROLES = [
  { value: 'admin', label: 'Administrator' },
  { value: 'sales_manager', label: 'Sales Manager' },
  { value: 'sales_rep', label: 'Sales Representative' },
  { value: 'viewer', label: 'Viewer' },
];

const REGIONS = [
  { value: 'DACH', label: 'DACH' },
  { value: 'EU', label: 'EU' },
  { value: 'US', label: 'US' },
  { value: 'APAC', label: 'APAC' },
];

const TeamManagement = () => {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState(null);
  const [paginationModel, setPaginationModel] = useState({ page: 0, pageSize: 25 });
  const [totalRows, setTotalRows] = useState(0);
  const [filterModel, setFilterModel] = useState({ items: [] });
  
  // Dialog states
  const [openDialog, setOpenDialog] = useState(false);
  const [dialogMode, setDialogMode] = useState('create'); // 'create' or 'edit'
  const [currentMember, setCurrentMember] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    role: 'sales_rep',
    region: '',
    max_leads: 10,
  });
  const [formErrors, setFormErrors] = useState({});
  
  // Delete confirmation
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [memberToDelete, setMemberToDelete] = useState(null);
  
  // Notification
  const [notification, setNotification] = useState({ open: false, message: '', severity: 'success' });

  // Load team members
  const loadTeamMembers = async () => {
    setLoading(true);
    try {
      const params = {
        page: paginationModel.page + 1,
        limit: paginationModel.pageSize,
      };
      
      // Add filters
      filterModel.items.forEach(filter => {
        if (filter.value !== undefined && filter.value !== null && filter.value !== '') {
          params[filter.field] = filter.value;
        }
      });
      
      const response = await getTeamMembers(params);
      const members = response.data || response;
      const total = response.pagination?.total || response.total || members.length;
      
      setRows(Array.isArray(members) ? members : []);
      setTotalRows(total);
    } catch (error) {
      console.error('Error loading team members:', error);
      showNotification('Fehler beim Laden der Team-Mitglieder', 'error');
      setRows([]);
      setTotalRows(0);
    } finally {
      setLoading(false);
    }
  };

  // Load team stats
  const loadTeamStats = async () => {
    try {
      const statsData = await getTeamStats();
      setStats(statsData.data || statsData);
    } catch (error) {
      console.error('Error loading team stats:', error);
    }
  };

  useEffect(() => {
    loadTeamMembers();
  }, [paginationModel, filterModel]);

  useEffect(() => {
    loadTeamStats();
  }, []);

  const showNotification = (message, severity = 'success') => {
    setNotification({ open: true, message, severity });
  };

  const handleCloseNotification = () => {
    setNotification({ ...notification, open: false });
  };

  // Open create dialog
  const handleCreate = () => {
    setDialogMode('create');
    setFormData({
      name: '',
      email: '',
      role: 'sales_rep',
      region: '',
      max_leads: 10,
    });
    setFormErrors({});
    setCurrentMember(null);
    setOpenDialog(true);
  };

  // Open edit dialog
  const handleEdit = (member) => {
    setDialogMode('edit');
    setFormData({
      name: member.name || '',
      email: member.email || '',
      role: member.role || 'sales_rep',
      region: member.region || '',
      max_leads: member.max_leads || 10,
    });
    setFormErrors({});
    setCurrentMember(member);
    setOpenDialog(true);
  };

  // Validate form
  const validateForm = () => {
    const errors = {};
    
    if (!formData.name || formData.name.trim() === '') {
      errors.name = 'Name ist erforderlich';
    }
    
    if (!formData.email || formData.email.trim() === '') {
      errors.email = 'E-Mail ist erforderlich';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      errors.email = 'Ungültige E-Mail-Adresse';
    }
    
    if (!formData.role) {
      errors.role = 'Rolle ist erforderlich';
    }
    
    if (formData.max_leads < 1 || formData.max_leads > 100) {
      errors.max_leads = 'Max Leads muss zwischen 1 und 100 liegen';
    }
    
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // Save member (create or update)
  const handleSave = async () => {
    if (!validateForm()) {
      return;
    }
    
    setLoading(true);
    try {
      if (dialogMode === 'create') {
        await createTeamMember(formData);
        showNotification('Team-Mitglied erfolgreich erstellt', 'success');
      } else {
        await updateTeamMember(currentMember.id, formData);
        showNotification('Team-Mitglied erfolgreich aktualisiert', 'success');
      }
      
      setOpenDialog(false);
      await loadTeamMembers();
      await loadTeamStats();
    } catch (error) {
      console.error('Error saving team member:', error);
      showNotification(
        error.body?.error?.message || 'Fehler beim Speichern des Team-Mitglieds',
        'error'
      );
    } finally {
      setLoading(false);
    }
  };

  // Open delete confirmation
  const handleDeleteClick = (member) => {
    setMemberToDelete(member);
    setDeleteDialogOpen(true);
  };

  // Confirm delete
  const handleDeleteConfirm = async () => {
    if (!memberToDelete) return;
    
    setLoading(true);
    try {
      await deleteTeamMember(memberToDelete.id);
      showNotification('Team-Mitglied erfolgreich gelöscht', 'success');
      setDeleteDialogOpen(false);
      setMemberToDelete(null);
      await loadTeamMembers();
      await loadTeamStats();
    } catch (error) {
      console.error('Error deleting team member:', error);
      showNotification(
        error.body?.error?.message || 'Fehler beim Löschen des Team-Mitglieds',
        'error'
      );
    } finally {
      setLoading(false);
    }
  };

  // Deactivate member
  const handleDeactivate = async (member) => {
    if (!window.confirm(`Team-Mitglied "${member.name}" deaktivieren?`)) {
      return;
    }
    
    setLoading(true);
    try {
      await deactivateTeamMember(member.id);
      showNotification('Team-Mitglied erfolgreich deaktiviert', 'success');
      await loadTeamMembers();
      await loadTeamStats();
    } catch (error) {
      console.error('Error deactivating team member:', error);
      showNotification(
        error.body?.error?.message || 'Fehler beim Deaktivieren des Team-Mitglieds',
        'error'
      );
    } finally {
      setLoading(false);
    }
  };

  // DataGrid columns
  const columns = [
    {
      field: 'name',
      headerName: 'Name',
      flex: 1,
      minWidth: 150,
    },
    {
      field: 'email',
      headerName: 'E-Mail',
      flex: 1,
      minWidth: 200,
    },
    {
      field: 'role',
      headerName: 'Rolle',
      width: 150,
      renderCell: (params) => {
        const roleLabel = ROLES.find(r => r.value === params.value)?.label || params.value;
        return <Chip label={roleLabel} size="small" variant="outlined" />;
      },
    },
    {
      field: 'region',
      headerName: 'Region',
      width: 100,
      renderCell: (params) => params.value ? <Chip label={params.value} size="small" /> : '-',
    },
    {
      field: 'current_leads',
      headerName: 'Aktuelle Leads',
      width: 120,
      type: 'number',
      renderCell: (params) => params.value || 0,
    },
    {
      field: 'max_leads',
      headerName: 'Max Leads',
      width: 100,
      type: 'number',
    },
    {
      field: 'utilization_percentage',
      headerName: 'Auslastung',
      width: 150,
      renderCell: (params) => {
        const utilization = params.value || 0;
        const color = utilization >= 90 ? 'error' : utilization >= 70 ? 'warning' : 'success';
        return (
          <Box sx={{ width: '100%' }}>
            <LinearProgress
              variant="determinate"
              value={Math.min(utilization, 100)}
              color={color}
              sx={{ height: 8, borderRadius: 1 }}
            />
            <Typography variant="caption" sx={{ mt: 0.5 }}>
              {utilization.toFixed(0)}%
            </Typography>
          </Box>
        );
      },
    },
    {
      field: 'is_active',
      headerName: 'Status',
      width: 100,
      renderCell: (params) => (
        <Chip
          label={params.value ? 'Aktiv' : 'Inaktiv'}
          size="small"
          color={params.value ? 'success' : 'default'}
        />
      ),
    },
    {
      field: 'actions',
      headerName: 'Aktionen',
      width: 150,
      sortable: false,
      filterable: false,
      renderCell: (params) => (
        <Box>
          <IconButton
            size="small"
            onClick={() => handleEdit(params.row)}
            title="Bearbeiten"
          >
            <EditIcon fontSize="small" />
          </IconButton>
          <IconButton
            size="small"
            onClick={() => handleDeactivate(params.row)}
            title="Deaktivieren"
            disabled={!params.row.is_active}
          >
            <DeactivateIcon fontSize="small" />
          </IconButton>
          <IconButton
            size="small"
            onClick={() => handleDeleteClick(params.row)}
            title="Löschen"
            color="error"
          >
            <DeleteIcon fontSize="small" />
          </IconButton>
        </Box>
      ),
    },
  ];

  // Custom toolbar
  const CustomToolbar = () => (
    <GridToolbarContainer>
      <GridToolbarFilterButton />
      <GridToolbarDensitySelector />
      <Box sx={{ flexGrow: 1 }} />
      <Button
        size="small"
        startIcon={<RefreshIcon />}
        onClick={loadTeamMembers}
      >
        Aktualisieren
      </Button>
      <Button
        size="small"
        startIcon={<AddIcon />}
        variant="contained"
        onClick={handleCreate}
        sx={{ ml: 1 }}
      >
        Mitglied hinzufügen
      </Button>
    </GridToolbarContainer>
  );

  return (
    <Box>
      {/* Stats Cards */}
      {stats && (
        <Box sx={{ mb: 3, display: 'flex', gap: 2, flexWrap: 'wrap' }}>
          <Card sx={{ flex: 1, minWidth: 200 }}>
            <CardContent>
              <Typography variant="body2" color="text.secondary">
                Gesamt Mitglieder
              </Typography>
              <Typography variant="h4">
                {stats.total_members || 0}
              </Typography>
            </CardContent>
          </Card>
          <Card sx={{ flex: 1, minWidth: 200 }}>
            <CardContent>
              <Typography variant="body2" color="text.secondary">
                Aktive Mitglieder
              </Typography>
              <Typography variant="h4">
                {stats.active_members || 0}
              </Typography>
            </CardContent>
          </Card>
          <Card sx={{ flex: 1, minWidth: 200 }}>
            <CardContent>
              <Typography variant="body2" color="text.secondary">
                Durchschnittliche Auslastung
              </Typography>
              <Typography variant="h4">
                {stats.average_utilization ? `${stats.average_utilization.toFixed(0)}%` : '0%'}
              </Typography>
            </CardContent>
          </Card>
        </Box>
      )}

      {/* DataGrid */}
      <Card>
        <CardContent sx={{ p: 0 }}>
          <DataGrid
            rows={rows}
            columns={columns}
            loading={loading}
            paginationMode="server"
            paginationModel={paginationModel}
            onPaginationModelChange={setPaginationModel}
            rowCount={totalRows}
            pageSizeOptions={[10, 25, 50, 100]}
            filterMode="server"
            onFilterModelChange={setFilterModel}
            slots={{
              toolbar: CustomToolbar,
            }}
            autoHeight
            disableRowSelectionOnClick
            sx={{
              border: 'none',
              '& .MuiDataGrid-cell:focus': {
                outline: 'none',
              },
              '& .MuiDataGrid-row:hover': {
                backgroundColor: 'action.hover',
              },
            }}
          />
        </CardContent>
      </Card>

      {/* Create/Edit Dialog */}
      <Dialog
        open={openDialog}
        onClose={() => setOpenDialog(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          {dialogMode === 'create' ? 'Neues Team-Mitglied' : 'Team-Mitglied bearbeiten'}
        </DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
            <TextField
              label="Name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              error={!!formErrors.name}
              helperText={formErrors.name}
              fullWidth
              required
            />
            <TextField
              label="E-Mail"
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              error={!!formErrors.email}
              helperText={formErrors.email}
              fullWidth
              required
              disabled={dialogMode === 'edit'}
            />
            <FormControl fullWidth required error={!!formErrors.role}>
              <InputLabel>Rolle</InputLabel>
              <Select
                value={formData.role}
                onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                label="Rolle"
              >
                {ROLES.map((role) => (
                  <MenuItem key={role.value} value={role.value}>
                    {role.label}
                  </MenuItem>
                ))}
              </Select>
              {formErrors.role && <FormHelperText>{formErrors.role}</FormHelperText>}
            </FormControl>
            <FormControl fullWidth>
              <InputLabel>Region</InputLabel>
              <Select
                value={formData.region}
                onChange={(e) => setFormData({ ...formData, region: e.target.value })}
                label="Region"
              >
                <MenuItem value="">
                  <em>Keine</em>
                </MenuItem>
                {REGIONS.map((region) => (
                  <MenuItem key={region.value} value={region.value}>
                    {region.label}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <TextField
              label="Max Leads"
              type="number"
              value={formData.max_leads}
              onChange={(e) => setFormData({ ...formData, max_leads: parseInt(e.target.value, 10) })}
              error={!!formErrors.max_leads}
              helperText={formErrors.max_leads || 'Maximale Anzahl gleichzeitiger Leads'}
              fullWidth
              required
              inputProps={{ min: 1, max: 100 }}
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenDialog(false)}>
            Abbrechen
          </Button>
          <Button
            onClick={handleSave}
            variant="contained"
            disabled={loading}
          >
            {dialogMode === 'create' ? 'Erstellen' : 'Speichern'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={deleteDialogOpen}
        onClose={() => setDeleteDialogOpen(false)}
      >
        <DialogTitle>Team-Mitglied löschen?</DialogTitle>
        <DialogContent>
          <Alert severity="warning" sx={{ mb: 2 }}>
            Diese Aktion kann nicht rückgängig gemacht werden.
          </Alert>
          <Typography>
            Möchten Sie das Team-Mitglied <strong>{memberToDelete?.name}</strong> wirklich löschen?
          </Typography>
          {memberToDelete?.current_leads > 0 && (
            <Alert severity="error" sx={{ mt: 2 }}>
              Achtung: Diesem Mitglied sind aktuell {memberToDelete.current_leads} Lead(s) zugewiesen.
            </Alert>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialogOpen(false)}>
            Abbrechen
          </Button>
          <Button
            onClick={handleDeleteConfirm}
            color="error"
            variant="contained"
            disabled={loading}
          >
            Löschen
          </Button>
        </DialogActions>
      </Dialog>

      {/* Notification Snackbar */}
      <Snackbar
        open={notification.open}
        autoHideDuration={6000}
        onClose={handleCloseNotification}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        <Alert
          onClose={handleCloseNotification}
          severity={notification.severity}
          sx={{ width: '100%' }}
        >
          {notification.message}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default TeamManagement;
