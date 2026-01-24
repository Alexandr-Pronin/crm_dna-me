/**
 * Stage Triggers Modal
 * Modal für die Konfiguration und Ausführung von Stage-spezifischen Aktionen
 * Ermöglicht mehrere Trigger gleichzeitig, mit Validierung der Pflichtfelder
 */
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box,
  Typography,
  IconButton,
  CircularProgress,
  Alert,
  Chip,
  Card,
  CardContent,
  CardActionArea,
  Checkbox,
  FormControlLabel,
  alpha,
  Tooltip,
  Collapse,
  TextField,
  Badge,
} from '@mui/material';
import {
  Close as CloseIcon,
  Email as EmailIcon,
  Business as BusinessIcon,
  Description as DescriptionIcon,
  CalendarMonth as CalendarIcon,
  Send as SendIcon,
  PlayArrow as PlayIcon,
  Check as CheckIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
  Person as PersonIcon,
  AttachMoney as MoneyIcon,
  Warning as WarningIcon,
  Error as ErrorIcon,
} from '@mui/icons-material';
import { useDataProvider, useNotify } from 'react-admin';

// DNA ME Farbpalette
const DNA_COLORS = {
  primary: '#4A90A4',
  primaryLight: '#6AAFC2',
  secondary: '#6C5CE7',
  success: '#28A745',
  warning: '#F59E0B',
  error: '#DC3545',
  textPrimary: '#e0e0e0',
  textSecondary: '#a0a0a0',
  bgCard: 'rgba(26, 26, 36, 0.95)',
  border: '#2a2a3a',
};

// Definierte Trigger-Aktionen
const TRIGGER_ACTIONS = [
  {
    id: 'send_email',
    name: 'E-Mail senden',
    description: 'Sendet eine E-Mail an den Lead/Kontakt',
    icon: EmailIcon,
    color: '#4A90A4',
    category: 'communication',
    fields: [
      { name: 'subject', label: 'Betreff', type: 'text', required: true },
      { name: 'template', label: 'Template', type: 'select', required: true, options: ['Willkommen', 'Follow-up', 'Angebot', 'Erinnerung'] },
    ],
  },
  {
    id: 'create_moco_customer',
    name: 'Moco Kunde erstellen',
    description: 'Erstellt einen neuen Kunden in Moco',
    icon: PersonIcon,
    color: '#10B981',
    category: 'moco',
    fields: [],
  },
  {
    id: 'create_moco_project',
    name: 'Moco Projekt erstellen',
    description: 'Erstellt ein neues Projekt in Moco',
    icon: BusinessIcon,
    color: '#10B981',
    category: 'moco',
    fields: [
      { name: 'project_name', label: 'Projektname', type: 'text', required: false },
    ],
  },
  {
    id: 'create_moco_offer',
    name: 'Moco Angebot erstellen',
    description: 'Erstellt ein Angebot in Moco',
    icon: DescriptionIcon,
    color: '#10B981',
    category: 'moco',
    fields: [],
  },
  {
    id: 'send_cituro_booking',
    name: 'Cituro Buchungslink',
    description: 'Sendet einen Terminbuchungslink per E-Mail',
    icon: CalendarIcon,
    color: '#8B5CF6',
    category: 'scheduling',
    fields: [
      { name: 'booking_type', label: 'Meeting-Typ', type: 'select', required: true, options: ['Erstgespräch', 'Demo', 'Beratung', 'Follow-up'] },
    ],
  },
  {
    id: 'send_slack_message',
    name: 'Slack Nachricht',
    description: 'Sendet eine Nachricht in einen Slack-Channel',
    icon: SendIcon,
    color: '#E91E63',
    category: 'notification',
    fields: [
      { name: 'channel', label: 'Channel', type: 'text', placeholder: '#sales', required: true },
      { name: 'message', label: 'Nachricht', type: 'textarea', required: true },
    ],
  },
];

// Gruppiere Aktionen nach Kategorie
const ACTION_CATEGORIES = {
  communication: { name: 'Kommunikation', color: '#4A90A4' },
  moco: { name: 'Moco Integration', color: '#10B981' },
  scheduling: { name: 'Terminplanung', color: '#8B5CF6' },
  notification: { name: 'Benachrichtigungen', color: '#E91E63' },
};

const StageTriggersModal = ({
  open,
  onClose,
  stage,
  stageColor = DNA_COLORS.primary,
  deals = [],
}) => {
  // Mehrfach-Auswahl von Aktionen (Objekt mit actionId als Key)
  const [selectedActions, setSelectedActions] = useState({});
  const [selectedDeals, setSelectedDeals] = useState({});
  const [executing, setExecuting] = useState(false);
  const [executionResult, setExecutionResult] = useState(null);
  const [expandedCategories, setExpandedCategories] = useState({
    communication: true,
    moco: true,
    scheduling: true,
    notification: true,
  });
  // Verschachteltes Objekt für Felder: { actionId: { fieldName: value } }
  const [actionFields, setActionFields] = useState({});
  // Validierungsfehler: { actionId: { fieldName: errorMessage } }
  const [validationErrors, setValidationErrors] = useState({});

  const dataProvider = useDataProvider();
  const notify = useNotify();

  // Reset state wenn Modal geöffnet wird
  useEffect(() => {
    if (open) {
      setSelectedActions({});
      setSelectedDeals({});
      setExecutionResult(null);
      setActionFields({});
      setValidationErrors({});
    }
  }, [open]);

  // Gruppiere Aktionen nach Kategorie
  const actionsByCategory = useMemo(() => {
    const grouped = {};
    TRIGGER_ACTIONS.forEach(action => {
      if (!grouped[action.category]) {
        grouped[action.category] = [];
      }
      grouped[action.category].push(action);
    });
    return grouped;
  }, []);

  // Anzahl ausgewählter Deals
  const selectedDealCount = Object.values(selectedDeals).filter(Boolean).length;

  // Anzahl ausgewählter Aktionen
  const selectedActionCount = Object.values(selectedActions).filter(Boolean).length;

  // Liste der ausgewählten Aktionen
  const selectedActionsList = useMemo(() => {
    return TRIGGER_ACTIONS.filter(action => selectedActions[action.id]);
  }, [selectedActions]);

  // Toggle Deal-Auswahl
  const handleToggleDeal = (dealId) => {
    setSelectedDeals(prev => ({
      ...prev,
      [dealId]: !prev[dealId],
    }));
  };

  // Alle Deals auswählen/abwählen
  const handleToggleAllDeals = () => {
    if (selectedDealCount === deals.length) {
      setSelectedDeals({});
    } else {
      const allSelected = {};
      deals.forEach(deal => {
        allSelected[deal.id] = true;
      });
      setSelectedDeals(allSelected);
    }
  };

  // Kategorie ein-/ausklappen
  const toggleCategory = (category) => {
    setExpandedCategories(prev => ({
      ...prev,
      [category]: !prev[category],
    }));
  };

  // Aktion auswählen/abwählen (Toggle)
  const handleToggleAction = (action) => {
    setSelectedActions(prev => {
      const isSelected = !prev[action.id];
      const newState = { ...prev, [action.id]: isSelected };
      
      // Wenn abgewählt, Felder und Fehler für diese Aktion entfernen
      if (!isSelected) {
        setActionFields(prevFields => {
          const { [action.id]: removed, ...rest } = prevFields;
          return rest;
        });
        setValidationErrors(prevErrors => {
          const { [action.id]: removed, ...rest } = prevErrors;
          return rest;
        });
      } else {
        // Wenn ausgewählt, leere Felder initialisieren
        setActionFields(prevFields => ({
          ...prevFields,
          [action.id]: {},
        }));
      }
      
      return newState;
    });
    setExecutionResult(null);
  };

  // Feld-Wert ändern
  const handleFieldChange = (actionId, fieldName, value) => {
    setActionFields(prev => ({
      ...prev,
      [actionId]: {
        ...(prev[actionId] || {}),
        [fieldName]: value,
      },
    }));
    
    // Fehler für dieses Feld entfernen wenn Wert eingegeben wird
    if (value && value.trim()) {
      setValidationErrors(prev => {
        const actionErrors = { ...(prev[actionId] || {}) };
        delete actionErrors[fieldName];
        
        if (Object.keys(actionErrors).length === 0) {
          const { [actionId]: removed, ...rest } = prev;
          return rest;
        }
        
        return {
          ...prev,
          [actionId]: actionErrors,
        };
      });
    }
  };

  // Validierung der ausgewählten Aktionen
  const validateActions = useCallback(() => {
    const errors = {};
    let hasErrors = false;

    selectedActionsList.forEach(action => {
      const fields = actionFields[action.id] || {};
      const actionErrors = {};

      action.fields.forEach(field => {
        if (field.required) {
          const value = fields[field.name];
          if (!value || (typeof value === 'string' && !value.trim())) {
            actionErrors[field.name] = `${field.label} ist erforderlich`;
            hasErrors = true;
          }
        }
      });

      if (Object.keys(actionErrors).length > 0) {
        errors[action.id] = actionErrors;
      }
    });

    setValidationErrors(errors);
    return !hasErrors;
  }, [selectedActionsList, actionFields]);

  // Prüfen ob eine Aktion Validierungsfehler hat
  const hasActionErrors = (actionId) => {
    return validationErrors[actionId] && Object.keys(validationErrors[actionId]).length > 0;
  };

  // Anzahl der Fehler für eine Aktion
  const getActionErrorCount = (actionId) => {
    return validationErrors[actionId] ? Object.keys(validationErrors[actionId]).length : 0;
  };

  // Trigger ausführen
  const handleExecuteTrigger = async () => {
    if (selectedActionCount === 0 || selectedDealCount === 0) {
      notify('Bitte wähle mindestens einen Deal und eine Aktion aus', { type: 'warning' });
      return;
    }

    // Validierung durchführen
    if (!validateActions()) {
      notify('Bitte fülle alle Pflichtfelder aus', { type: 'error' });
      return;
    }

    setExecuting(true);
    setExecutionResult(null);

    try {
      const selectedDealIds = Object.entries(selectedDeals)
        .filter(([_, selected]) => selected)
        .map(([id]) => id);

      // Bereite Trigger-Daten vor
      const triggers = selectedActionsList.map(action => ({
        action: action.id,
        params: actionFields[action.id] || {},
      }));

      // API-Call zum Ausführen der Trigger
      const response = await fetch('/api/v1/triggers/execute', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          triggers,
          stage_id: stage?.id,
          deal_ids: selectedDealIds,
        }),
      });

      if (!response.ok) {
        throw new Error('Trigger-Ausführung fehlgeschlagen');
      }

      const result = await response.json();
      
      const actionNames = selectedActionsList.map(a => a.name).join(', ');
      setExecutionResult({
        success: true,
        message: `${selectedActionCount} Aktion(en) erfolgreich für ${selectedDealIds.length} Deal(s) ausgeführt: ${actionNames}`,
        details: result,
      });

      notify(`${selectedActionCount} Trigger erfolgreich ausgeführt`, { type: 'success' });
    } catch (err) {
      console.error('Trigger execution failed:', err);
      setExecutionResult({
        success: false,
        message: err.message || 'Fehler bei der Ausführung',
      });
      notify('Fehler bei der Trigger-Ausführung', { type: 'error' });
    } finally {
      setExecuting(false);
    }
  };

  // Modal schließen
  const handleClose = () => {
    if (executing) return;
    onClose();
  };

  if (!stage) return null;

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      maxWidth="lg"
      fullWidth
      PaperProps={{
        sx: {
          bgcolor: DNA_COLORS.bgCard,
          backgroundImage: 'none',
          borderRadius: 3,
          border: `1px solid ${DNA_COLORS.border}`,
          maxHeight: '90vh',
        },
      }}
    >
      {/* Header */}
      <DialogTitle
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          borderBottom: `1px solid ${DNA_COLORS.border}`,
          pb: 2,
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <Box
            sx={{
              width: 8,
              height: 48,
              bgcolor: stageColor,
              borderRadius: 1,
            }}
          />
          <Box>
            <Typography variant="h6" fontWeight={600} color="text.primary">
              Stage Trigger: {stage.name}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Mehrere Aktionen für Deals in dieser Stage konfigurieren und ausführen
            </Typography>
          </Box>
        </Box>
        <IconButton onClick={handleClose} disabled={executing}>
          <CloseIcon />
        </IconButton>
      </DialogTitle>

      <DialogContent sx={{ p: 0, display: 'flex', height: '60vh' }}>
        {/* Linke Seite: Deal-Auswahl */}
        <Box
          sx={{
            width: 320,
            borderRight: `1px solid ${DNA_COLORS.border}`,
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          <Box sx={{ p: 2, borderBottom: `1px solid ${DNA_COLORS.border}` }}>
            <Typography variant="subtitle2" fontWeight={600} color="text.primary" sx={{ mb: 1 }}>
              Deals auswählen
            </Typography>
            <FormControlLabel
              control={
                <Checkbox
                  checked={selectedDealCount === deals.length && deals.length > 0}
                  indeterminate={selectedDealCount > 0 && selectedDealCount < deals.length}
                  onChange={handleToggleAllDeals}
                  sx={{ color: stageColor, '&.Mui-checked': { color: stageColor } }}
                />
              }
              label={
                <Typography variant="body2" color="text.secondary">
                  Alle auswählen ({deals.length})
                </Typography>
              }
            />
          </Box>

          <Box sx={{ flex: 1, overflow: 'auto', p: 1 }}>
            {deals.length === 0 ? (
              <Box sx={{ textAlign: 'center', py: 4 }}>
                <Typography variant="body2" color="text.secondary">
                  Keine Deals in dieser Stage
                </Typography>
              </Box>
            ) : (
              deals.map((deal) => (
                <Card
                  key={deal.id}
                  sx={{
                    mb: 1,
                    bgcolor: selectedDeals[deal.id] 
                      ? alpha(stageColor, 0.15) 
                      : alpha(DNA_COLORS.border, 0.3),
                    border: '1px solid',
                    borderColor: selectedDeals[deal.id] ? stageColor : 'transparent',
                    transition: 'all 0.2s ease',
                  }}
                >
                  <CardActionArea onClick={() => handleToggleDeal(deal.id)}>
                    <CardContent sx={{ p: 1.5, '&:last-child': { pb: 1.5 } }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Checkbox
                          checked={!!selectedDeals[deal.id]}
                          sx={{ 
                            p: 0.5,
                            color: stageColor, 
                            '&.Mui-checked': { color: stageColor } 
                          }}
                        />
                        <Box sx={{ flex: 1, minWidth: 0 }}>
                          <Typography
                            variant="body2"
                            fontWeight={600}
                            color="text.primary"
                            sx={{
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                            }}
                          >
                            {deal.title || deal.name || 'Unbenannter Deal'}
                          </Typography>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 0.5 }}>
                            {deal.value > 0 && (
                              <Chip
                                size="small"
                                icon={<MoneyIcon sx={{ fontSize: 12 }} />}
                                label={`€${deal.value.toLocaleString('de-DE')}`}
                                sx={{
                                  height: 20,
                                  fontSize: '0.65rem',
                                  bgcolor: alpha(stageColor, 0.2),
                                  color: stageColor,
                                }}
                              />
                            )}
                            {(deal.contact_name || deal.lead_name) && (
                              <Typography variant="caption" color="text.secondary">
                                {deal.contact_name || deal.lead_name}
                              </Typography>
                            )}
                          </Box>
                        </Box>
                      </Box>
                    </CardContent>
                  </CardActionArea>
                </Card>
              ))
            )}
          </Box>

          <Box
            sx={{
              p: 2,
              borderTop: `1px solid ${DNA_COLORS.border}`,
              bgcolor: alpha(stageColor, 0.05),
            }}
          >
            <Typography variant="body2" color="text.secondary">
              <strong style={{ color: stageColor }}>{selectedDealCount}</strong> von {deals.length} Deals ausgewählt
            </Typography>
          </Box>
        </Box>

        {/* Rechte Seite: Aktionen */}
        <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
          <Box sx={{ p: 2, borderBottom: `1px solid ${DNA_COLORS.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Typography variant="subtitle2" fontWeight={600} color="text.primary">
              Aktionen auswählen (Mehrfachauswahl)
            </Typography>
            {selectedActionCount > 0 && (
              <Chip
                label={`${selectedActionCount} ausgewählt`}
                size="small"
                sx={{
                  bgcolor: alpha(stageColor, 0.2),
                  color: stageColor,
                  fontWeight: 600,
                }}
              />
            )}
          </Box>

          <Box sx={{ flex: 1, overflow: 'auto', p: 2 }}>
            {Object.entries(actionsByCategory).map(([category, actions]) => (
              <Box key={category} sx={{ mb: 2 }}>
                <Box
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    cursor: 'pointer',
                    mb: 1,
                  }}
                  onClick={() => toggleCategory(category)}
                >
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Box
                      sx={{
                        width: 8,
                        height: 8,
                        borderRadius: '50%',
                        bgcolor: ACTION_CATEGORIES[category]?.color || DNA_COLORS.primary,
                      }}
                    />
                    <Typography variant="subtitle2" fontWeight={600} color="text.secondary">
                      {ACTION_CATEGORIES[category]?.name || category}
                    </Typography>
                    <Chip
                      size="small"
                      label={actions.length}
                      sx={{ height: 18, fontSize: '0.65rem' }}
                    />
                  </Box>
                  {expandedCategories[category] ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                </Box>

                <Collapse in={expandedCategories[category]}>
                  <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 1.5 }}>
                    {actions.map((action) => {
                      const ActionIcon = action.icon;
                      const isSelected = !!selectedActions[action.id];
                      const errorCount = getActionErrorCount(action.id);

                      return (
                        <Card
                          key={action.id}
                          sx={{
                            bgcolor: isSelected 
                              ? alpha(action.color, 0.2) 
                              : alpha(DNA_COLORS.border, 0.3),
                            border: '2px solid',
                            borderColor: isSelected 
                              ? (errorCount > 0 ? DNA_COLORS.error : action.color) 
                              : 'transparent',
                            transition: 'all 0.2s ease',
                            '&:hover': {
                              borderColor: alpha(action.color, 0.5),
                              transform: 'translateY(-2px)',
                            },
                          }}
                        >
                          <CardActionArea onClick={() => handleToggleAction(action)}>
                            <CardContent sx={{ p: 2 }}>
                              <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.5 }}>
                                <Box
                                  sx={{
                                    p: 1,
                                    borderRadius: 1.5,
                                    bgcolor: alpha(action.color, 0.15),
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                  }}
                                >
                                  <ActionIcon sx={{ color: action.color, fontSize: 24 }} />
                                </Box>
                                <Box sx={{ flex: 1 }}>
                                  <Typography
                                    variant="subtitle2"
                                    fontWeight={600}
                                    color="text.primary"
                                    sx={{ mb: 0.5 }}
                                  >
                                    {action.name}
                                  </Typography>
                                  <Typography
                                    variant="caption"
                                    color="text.secondary"
                                    sx={{
                                      display: '-webkit-box',
                                      WebkitLineClamp: 2,
                                      WebkitBoxOrient: 'vertical',
                                      overflow: 'hidden',
                                    }}
                                  >
                                    {action.description}
                                  </Typography>
                                  {action.fields.filter(f => f.required).length > 0 && (
                                    <Typography variant="caption" color="warning.main" sx={{ display: 'block', mt: 0.5 }}>
                                      {action.fields.filter(f => f.required).length} Pflichtfeld(er)
                                    </Typography>
                                  )}
                                </Box>
                                {isSelected && errorCount > 0 && (
                                  <Tooltip title={`${errorCount} Pflichtfeld(er) fehlt`}>
                                    <Badge badgeContent={errorCount} color="error">
                                      <ErrorIcon sx={{ color: DNA_COLORS.error, fontSize: 20 }} />
                                    </Badge>
                                  </Tooltip>
                                )}
                                {isSelected && errorCount === 0 && (
                                  <CheckIcon sx={{ color: action.color, fontSize: 20 }} />
                                )}
                              </Box>
                            </CardContent>
                          </CardActionArea>
                        </Card>
                      );
                    })}
                  </Box>
                </Collapse>
              </Box>
            ))}
          </Box>

          {/* Aktions-Konfiguration für alle ausgewählten Aktionen */}
          {selectedActionCount > 0 && (
            <Box
              sx={{
                p: 2,
                borderTop: `1px solid ${DNA_COLORS.border}`,
                bgcolor: alpha(DNA_COLORS.primary, 0.05),
                maxHeight: '40%',
                overflow: 'auto',
              }}
            >
              <Typography variant="subtitle2" fontWeight={600} color="text.primary" sx={{ mb: 2 }}>
                Konfiguration ({selectedActionCount} Aktion(en))
              </Typography>

              {selectedActionsList.map((action) => (
                <Box
                  key={action.id}
                  sx={{
                    mb: 2,
                    p: 2,
                    borderRadius: 2,
                    bgcolor: alpha(action.color, 0.1),
                    border: hasActionErrors(action.id) ? `2px solid ${DNA_COLORS.error}` : `1px solid ${alpha(action.color, 0.3)}`,
                  }}
                >
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
                    {React.createElement(action.icon, { sx: { color: action.color, fontSize: 20 } })}
                    <Typography variant="subtitle2" fontWeight={600} sx={{ color: action.color }}>
                      {action.name}
                    </Typography>
                    {hasActionErrors(action.id) && (
                      <Chip
                        size="small"
                        icon={<WarningIcon sx={{ fontSize: 14 }} />}
                        label="Pflichtfelder fehlen"
                        sx={{
                          height: 20,
                          fontSize: '0.65rem',
                          bgcolor: alpha(DNA_COLORS.error, 0.2),
                          color: DNA_COLORS.error,
                        }}
                      />
                    )}
                  </Box>

                  {action.fields.length > 0 ? (
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                      {action.fields.map((field) => {
                        const fieldError = validationErrors[action.id]?.[field.name];
                        
                        return (
                          <Box key={field.name}>
                            {field.type === 'select' ? (
                              <TextField
                                select
                                fullWidth
                                size="small"
                                label={field.label + (field.required ? ' *' : '')}
                                value={actionFields[action.id]?.[field.name] || ''}
                                onChange={(e) => handleFieldChange(action.id, field.name, e.target.value)}
                                error={!!fieldError}
                                helperText={fieldError}
                                SelectProps={{ native: true }}
                              >
                                <option value="">-- Auswählen --</option>
                                {field.options.map((opt) => (
                                  <option key={opt} value={opt}>
                                    {opt}
                                  </option>
                                ))}
                              </TextField>
                            ) : field.type === 'textarea' ? (
                              <TextField
                                fullWidth
                                size="small"
                                label={field.label + (field.required ? ' *' : '')}
                                value={actionFields[action.id]?.[field.name] || ''}
                                onChange={(e) => handleFieldChange(action.id, field.name, e.target.value)}
                                placeholder={field.placeholder}
                                error={!!fieldError}
                                helperText={fieldError}
                                multiline
                                rows={2}
                              />
                            ) : (
                              <TextField
                                fullWidth
                                size="small"
                                label={field.label + (field.required ? ' *' : '')}
                                value={actionFields[action.id]?.[field.name] || ''}
                                onChange={(e) => handleFieldChange(action.id, field.name, e.target.value)}
                                placeholder={field.placeholder}
                                error={!!fieldError}
                                helperText={fieldError}
                              />
                            )}
                          </Box>
                        );
                      })}
                    </Box>
                  ) : (
                    <Typography variant="body2" color="text.secondary">
                      Diese Aktion benötigt keine weitere Konfiguration.
                    </Typography>
                  )}
                </Box>
              ))}
            </Box>
          )}

          {/* Ergebnis-Anzeige */}
          {executionResult && (
            <Alert
              severity={executionResult.success ? 'success' : 'error'}
              sx={{ m: 2, mt: 0 }}
            >
              {executionResult.message}
            </Alert>
          )}
        </Box>
      </DialogContent>

      {/* Footer mit Aktions-Buttons */}
      <DialogActions
        sx={{
          px: 3,
          py: 2,
          borderTop: `1px solid ${DNA_COLORS.border}`,
          justifyContent: 'space-between',
        }}
      >
        <Box>
          {selectedActionCount > 0 ? (
            <Typography variant="caption" color="text.secondary">
              Ausgewählt:{' '}
              {selectedActionsList.map((action, index) => (
                <React.Fragment key={action.id}>
                  <strong style={{ color: action.color }}>{action.name}</strong>
                  {index < selectedActionsList.length - 1 && ', '}
                </React.Fragment>
              ))}
            </Typography>
          ) : (
            <Typography variant="caption" color="text.secondary">
              Wähle mindestens eine Aktion aus
            </Typography>
          )}
        </Box>
        <Box sx={{ display: 'flex', gap: 2 }}>
          <Button onClick={handleClose} disabled={executing}>
            Abbrechen
          </Button>
          <Button
            variant="contained"
            onClick={handleExecuteTrigger}
            disabled={executing || selectedActionCount === 0 || selectedDealCount === 0}
            startIcon={executing ? <CircularProgress size={16} /> : <PlayIcon />}
            sx={{
              bgcolor: DNA_COLORS.primary,
              '&:hover': {
                bgcolor: alpha(DNA_COLORS.primary, 0.8),
              },
            }}
          >
            {executing 
              ? 'Wird ausgeführt...' 
              : `${selectedActionCount} Aktion(en) für ${selectedDealCount} Deal(s) ausführen`
            }
          </Button>
        </Box>
      </DialogActions>
    </Dialog>
  );
};

export default StageTriggersModal;
