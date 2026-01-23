/**
 * Deal Preview/Edit Modal
 * Ermöglicht Vorschau und Bearbeitung eines Deals im Modal
 */
import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box,
  Typography,
  TextField,
  Grid,
  Chip,
  Avatar,
  IconButton,
  Divider,
  CircularProgress,
  Alert,
  alpha,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  InputAdornment,
} from '@mui/material';
import {
  Close as CloseIcon,
  Edit as EditIcon,
  Save as SaveIcon,
  Cancel as CancelIcon,
  Business as BusinessIcon,
  Person as PersonIcon,
  Email as EmailIcon,
  Phone as PhoneIcon,
  Event as EventIcon,
  AttachMoney as MoneyIcon,
  OpenInNew as OpenInNewIcon,
  Notes as NotesIcon,
} from '@mui/icons-material';
import { useDataProvider, useNotify } from 'react-admin';
import { useNavigate } from 'react-router-dom';

// DNA ME Farben
const DNA_COLORS = {
  primary: '#4A90A4',
  primaryLight: '#6AAFC2',
  secondary: '#6C5CE7',
  success: '#28A745',
  warning: '#F59E0B',
  error: '#DC3545',
  textPrimary: '#e0e0e0',
  textSecondary: '#a0a0a0',
  textMuted: '#666666',
  bgCard: 'rgba(26, 26, 36, 0.95)',
  border: '#2a2a3a',
};

const DealPreviewModal = ({
  open,
  onClose,
  deal: initialDeal,
  stageColor = DNA_COLORS.primary,
  stages = [],
  onDealUpdated,
}) => {
  const [deal, setDeal] = useState(initialDeal);
  const [isEditing, setIsEditing] = useState(false);
  const [editedDeal, setEditedDeal] = useState({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  
  const dataProvider = useDataProvider();
  const notify = useNotify();
  const navigate = useNavigate();

  // Aktualisiere deal wenn sich initialDeal ändert
  useEffect(() => {
    if (initialDeal) {
      setDeal(initialDeal);
      setEditedDeal({
        title: initialDeal.title || '',
        value: initialDeal.value || 0,
        expected_close: initialDeal.expected_close || '',
        notes: initialDeal.notes || '',
        stage_id: initialDeal.stage_id || '',
      });
    }
  }, [initialDeal]);

  const handleClose = () => {
    setIsEditing(false);
    setError(null);
    onClose();
  };

  const handleEdit = () => {
    setIsEditing(true);
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
    setEditedDeal({
      title: deal.title || '',
      value: deal.value || 0,
      expected_close: deal.expected_close || '',
      notes: deal.notes || '',
      stage_id: deal.stage_id || '',
    });
    setError(null);
  };

  const handleSave = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const { data } = await dataProvider.update('deals', {
        id: deal.id,
        data: editedDeal,
        previousData: deal,
      });
      
      setDeal(data);
      setIsEditing(false);
      notify('Deal erfolgreich aktualisiert', { type: 'success' });
      
      if (onDealUpdated) {
        onDealUpdated(data);
      }
    } catch (err) {
      console.error('Failed to update deal:', err);
      setError(err.message || 'Fehler beim Speichern');
      notify('Fehler beim Speichern', { type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (field) => (event) => {
    setEditedDeal(prev => ({
      ...prev,
      [field]: event.target.value,
    }));
  };

  const handleOpenFullPage = () => {
    navigate(`/deals/${deal.id}/show`);
    handleClose();
  };

  const handleContactClick = () => {
    if (deal.lead_id) {
      navigate(`/leads/${deal.lead_id}/show`);
    } else if (deal.contact_id) {
      navigate(`/contacts/${deal.contact_id}/show`);
    }
  };

  // Format helpers
  const formatCurrency = (value) => {
    if (!value && value !== 0) return '—';
    return new Intl.NumberFormat('de-DE', {
      style: 'currency',
      currency: 'EUR',
      minimumFractionDigits: 0,
    }).format(value);
  };

  const formatDate = (dateString) => {
    if (!dateString) return '—';
    try {
      return new Date(dateString).toLocaleDateString('de-DE', {
        day: '2-digit',
        month: 'long',
        year: 'numeric',
      });
    } catch {
      return '—';
    }
  };

  const getInitials = (name) => {
    if (!name) return '?';
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  if (!deal) return null;

  const contactName = deal.contact_name || deal.lead_name;
  const companyName = deal.company_name || deal.lead_company;
  const email = deal.lead_email || deal.contact_email;
  const phone = deal.lead_phone || deal.contact_phone;
  const hasContactLink = deal.lead_id || deal.contact_id;

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      maxWidth="md"
      fullWidth
      PaperProps={{
        sx: {
          bgcolor: DNA_COLORS.bgCard,
          backgroundImage: 'none',
          borderRadius: 2,
          border: `1px solid ${DNA_COLORS.border}`,
        },
      }}
    >
      <DialogTitle sx={{ 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'space-between',
        borderBottom: `1px solid ${DNA_COLORS.border}`,
        pb: 2,
      }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <Box
            sx={{
              width: 6,
              height: 40,
              bgcolor: stageColor,
              borderRadius: 1,
            }}
          />
          <Box>
            {isEditing ? (
              <TextField
                value={editedDeal.title}
                onChange={handleInputChange('title')}
                variant="standard"
                fullWidth
                sx={{
                  '& .MuiInput-input': {
                    fontSize: '1.25rem',
                    fontWeight: 600,
                    color: DNA_COLORS.textPrimary,
                  },
                }}
              />
            ) : (
              <Typography variant="h6" fontWeight={600} color="text.primary">
                {deal.title || 'Unbenannter Deal'}
              </Typography>
            )}
            <Typography variant="body2" color="text.secondary">
              {deal.pipeline_name || 'Pipeline'} → {deal.stage_name || 'Stage'}
            </Typography>
          </Box>
        </Box>
        
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          {!isEditing && (
            <IconButton onClick={handleEdit} size="small" sx={{ color: DNA_COLORS.primary }}>
              <EditIcon />
            </IconButton>
          )}
          <IconButton onClick={handleOpenFullPage} size="small" sx={{ color: DNA_COLORS.textSecondary }}>
            <OpenInNewIcon />
          </IconButton>
          <IconButton onClick={handleClose} size="small">
            <CloseIcon />
          </IconButton>
        </Box>
      </DialogTitle>

      <DialogContent sx={{ pt: 3 }}>
        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        <Grid container spacing={3}>
          {/* Linke Spalte - Hauptinfos */}
          <Grid item xs={12} md={7}>
            {/* Wert */}
            <Box sx={{ mb: 3 }}>
              <Typography variant="overline" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>
                Deal-Wert
              </Typography>
              {isEditing ? (
                <TextField
                  type="number"
                  value={editedDeal.value}
                  onChange={handleInputChange('value')}
                  fullWidth
                  size="small"
                  InputProps={{
                    startAdornment: <InputAdornment position="start">€</InputAdornment>,
                  }}
                />
              ) : (
                <Typography variant="h4" fontWeight={700} sx={{ color: stageColor }}>
                  {formatCurrency(deal.value)}
                </Typography>
              )}
            </Box>

            {/* Stage (nur beim Bearbeiten) */}
            {isEditing && stages.length > 0 && (
              <Box sx={{ mb: 3 }}>
                <FormControl fullWidth size="small">
                  <InputLabel>Stage</InputLabel>
                  <Select
                    value={editedDeal.stage_id}
                    onChange={handleInputChange('stage_id')}
                    label="Stage"
                  >
                    {stages.map((stage) => (
                      <MenuItem key={stage.id} value={stage.id}>
                        {stage.name}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Box>
            )}

            {/* Abschlussdatum */}
            <Box sx={{ mb: 3 }}>
              <Typography variant="overline" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>
                Erwarteter Abschluss
              </Typography>
              {isEditing ? (
                <TextField
                  type="date"
                  value={editedDeal.expected_close ? editedDeal.expected_close.split('T')[0] : ''}
                  onChange={handleInputChange('expected_close')}
                  fullWidth
                  size="small"
                />
              ) : (
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <EventIcon sx={{ color: DNA_COLORS.textMuted, fontSize: 20 }} />
                  <Typography variant="body1" color="text.primary">
                    {formatDate(deal.expected_close)}
                  </Typography>
                </Box>
              )}
            </Box>

            {/* Notizen */}
            <Box sx={{ mb: 3 }}>
              <Typography variant="overline" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>
                Notizen
              </Typography>
              {isEditing ? (
                <TextField
                  value={editedDeal.notes}
                  onChange={handleInputChange('notes')}
                  multiline
                  rows={4}
                  fullWidth
                  placeholder="Notizen zum Deal..."
                />
              ) : (
                <Box sx={{ 
                  p: 2, 
                  bgcolor: alpha(DNA_COLORS.border, 0.3), 
                  borderRadius: 1,
                  minHeight: 80,
                }}>
                  <Typography variant="body2" color={deal.notes ? 'text.primary' : 'text.secondary'}>
                    {deal.notes || 'Keine Notizen vorhanden'}
                  </Typography>
                </Box>
              )}
            </Box>
          </Grid>

          {/* Rechte Spalte - Kontaktinfos */}
          <Grid item xs={12} md={5}>
            <Box sx={{ 
              bgcolor: alpha(DNA_COLORS.border, 0.2), 
              borderRadius: 2, 
              p: 2,
            }}>
              <Typography variant="subtitle2" fontWeight={600} color="text.primary" sx={{ mb: 2 }}>
                Kontaktinformationen
              </Typography>

              {/* Firma */}
              {companyName && (
                <InfoRow 
                  icon={<BusinessIcon />}
                  label="Unternehmen"
                  value={companyName}
                />
              )}

              {/* Kontakt */}
              {contactName && (
                <InfoRow 
                  icon={<PersonIcon />}
                  label="Kontakt"
                  value={contactName}
                  isLink={hasContactLink}
                  onClick={hasContactLink ? handleContactClick : undefined}
                />
              )}

              {/* E-Mail */}
              {email && (
                <InfoRow 
                  icon={<EmailIcon />}
                  label="E-Mail"
                  value={email}
                  isLink
                  href={`mailto:${email}`}
                />
              )}

              {/* Telefon */}
              {phone && (
                <InfoRow 
                  icon={<PhoneIcon />}
                  label="Telefon"
                  value={phone}
                  isLink
                  href={`tel:${phone}`}
                />
              )}

              {/* Zugewiesen an */}
              {deal.assigned_to_name && (
                <Box sx={{ mt: 3, pt: 2, borderTop: `1px solid ${DNA_COLORS.border}` }}>
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
                    Zugewiesen an
                  </Typography>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                    <Avatar 
                      sx={{ 
                        width: 32, 
                        height: 32, 
                        bgcolor: alpha(stageColor, 0.2),
                        color: stageColor,
                        fontSize: '0.75rem',
                      }}
                    >
                      {getInitials(deal.assigned_to_name)}
                    </Avatar>
                    <Typography variant="body2" color="text.primary">
                      {deal.assigned_to_name}
                    </Typography>
                  </Box>
                </Box>
              )}
            </Box>

            {/* Zeitstempel */}
            <Box sx={{ mt: 2, px: 1 }}>
              <Typography variant="caption" color="text.secondary">
                Erstellt: {formatDate(deal.created_at)}
              </Typography>
              {deal.updated_at && deal.updated_at !== deal.created_at && (
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                  Aktualisiert: {formatDate(deal.updated_at)}
                </Typography>
              )}
            </Box>
          </Grid>
        </Grid>
      </DialogContent>

      {isEditing && (
        <DialogActions sx={{ px: 3, py: 2, borderTop: `1px solid ${DNA_COLORS.border}` }}>
          <Button
            onClick={handleCancelEdit}
            startIcon={<CancelIcon />}
            disabled={loading}
          >
            Abbrechen
          </Button>
          <Button
            onClick={handleSave}
            variant="contained"
            startIcon={loading ? <CircularProgress size={16} /> : <SaveIcon />}
            disabled={loading}
            sx={{ bgcolor: DNA_COLORS.primary }}
          >
            Speichern
          </Button>
        </DialogActions>
      )}
    </Dialog>
  );
};

// Hilfskomponente für Info-Zeilen
const InfoRow = ({ icon, label, value, isLink, href, onClick }) => (
  <Box sx={{ mb: 2 }}>
    <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.25 }}>
      {label}
    </Typography>
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
      {React.cloneElement(icon, { sx: { fontSize: 18, color: DNA_COLORS.textMuted } })}
      {isLink ? (
        <Typography
          component={href ? 'a' : 'button'}
          href={href}
          onClick={onClick}
          sx={{
            color: DNA_COLORS.primary,
            textDecoration: 'none',
            cursor: 'pointer',
            fontSize: '0.875rem',
            background: 'none',
            border: 'none',
            p: 0,
            '&:hover': {
              color: DNA_COLORS.primaryLight,
              textDecoration: 'underline',
            },
          }}
        >
          {value}
        </Typography>
      ) : (
        <Typography variant="body2" color="text.primary">
          {value}
        </Typography>
      )}
    </Box>
  </Box>
);

export default DealPreviewModal;
