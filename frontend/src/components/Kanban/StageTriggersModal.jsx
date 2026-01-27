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
import { httpClient, API_URL } from '../../providers/dataProvider';

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
    id: 'enroll_email_sequence',
    name: 'Email Marketing',
    description: 'Lead in eine E-Mail-Sequenz einschreiben',
    icon: EmailIcon,
    color: '#4A90A4',
    category: 'communication',
    fields: [
      { name: 'sequence_id', label: 'E-Mail-Sequenz', type: 'select', required: true, options: [] },
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
    fields: [],
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
    id: 'create_moco_invoice_draft',
    name: 'Moco Rechnung (Entwurf)',
    description: 'Erstellt eine Rechnung als Entwurf in Moco',
    icon: DescriptionIcon,
    color: '#10B981',
    category: 'moco',
    fields: [
      { name: 'title', label: 'Rechnungstitel', type: 'text', required: false },
      { name: 'tax', label: 'Steuer %', type: 'text', required: false, placeholder: '8' },
      { name: 'due_days', label: 'Fällig in Tagen', type: 'text', required: false, placeholder: '14' },
      { name: 'item_title', label: 'Positionstitel', type: 'text', required: false },
      { name: 'unit_price', label: 'Preis (netto)', type: 'text', required: false },
    ],
  },
  {
    id: 'send_cituro_booking',
    name: 'Cituro Buchungslink',
    description: 'Sendet einen Terminbuchungslink per E-Mail',
    icon: CalendarIcon,
    color: '#8B5CF6',
    category: 'scheduling',
    fields: [
      { name: 'meeting_type', label: 'Meeting-Typ', type: 'select', required: false, options: ['consultation', 'demo', 'follow-up', 'beratung'] },
      { name: 'duration_minutes', label: 'Dauer (Min.)', type: 'text', required: false, placeholder: '30' },
      { name: 'email_subject', label: 'E-Mail Betreff', type: 'text', required: false },
      { name: 'email_html', label: 'E-Mail Text/HTML', type: 'textarea', required: false },
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
  {
    id: 'send_notification_email',
    name: 'Deal Notification',
    description: 'Sendet eine Deal-Notification an ein Team-Postfach',
    icon: EmailIcon,
    color: '#E91E63',
    category: 'notification',
    fields: [],
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
  onExecuted,
}) => {
  // Mehrfach-Auswahl von Aktionen (Objekt mit actionId als Key)
  const [selectedActions, setSelectedActions] = useState({});
  const [executing, setExecuting] = useState(false);
  const [executionResult, setExecutionResult] = useState(null);
  const [expandedCategories, setExpandedCategories] = useState({
    communication: true,
    moco: true,
    scheduling: true,
    notification: true,
  });
  const [emailSequences, setEmailSequences] = useState([]);
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
      setExecutionResult(null);
      setActionFields({});
      setValidationErrors({});
    }
  }, [open]);

  useEffect(() => {
    const loadSequences = async () => {
      if (!open) return;
      try {
        const { data } = await dataProvider.getList('sequences', {
          pagination: { page: 1, perPage: 200 },
          sort: { field: 'created_at', order: 'DESC' },
          filter: {},
        });
        setEmailSequences((data || []).map(seq => ({
          id: seq.id,
          name: seq.name || seq.id,
        })));
      } catch (error) {
        console.error('Failed to load email sequences:', error);
        setEmailSequences([]);
      }
    };

    loadSequences();
  }, [open, dataProvider]);

  // Gruppiere Aktionen nach Kategorie
  const availableActions = useMemo(() => {
    return TRIGGER_ACTIONS.map(action => {
      if (action.id !== 'enroll_email_sequence') return action;
      const fields = action.fields.map(field => (
        field.name === 'sequence_id'
          ? { ...field, options: emailSequences }
          : field
      ));
      return { ...action, fields };
    });
  }, [emailSequences]);

  const actionsByCategory = useMemo(() => {
    const grouped = {};
    availableActions.forEach(action => {
      if (!grouped[action.category]) {
        grouped[action.category] = [];
      }
      grouped[action.category].push(action);
    });
    return grouped;
  }, [availableActions]);

  const dealCount = deals.length;

  // Anzahl ausgewählter Aktionen
  const selectedActionCount = Object.values(selectedActions).filter(Boolean).length;

  // Liste der ausgewählten Aktionen
  const selectedActionsList = useMemo(() => {
    return availableActions.filter(action => selectedActions[action.id]);
  }, [selectedActions, availableActions]);

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

  const NOTIFICATION_TEMPLATE_KEY = 'notification_email_template';

  const loadNotificationSettings = () => {
    try {
      const stored = localStorage.getItem(NOTIFICATION_TEMPLATE_KEY);
      return stored ? JSON.parse(stored) : {};
    } catch {
      return {};
    }
  };

  // Validierung der ausgewählten Aktionen
  const validateActions = useCallback(() => {
    const errors = {};
    let hasErrors = false;
    const notificationSettings = loadNotificationSettings();

    selectedActionsList.forEach(action => {
      const fields = actionFields[action.id] || {};
      const actionErrors = {};

      if (action.id === 'send_notification_email') {
        if (!notificationSettings?.to) {
          actionErrors.to = 'Empfänger fehlt in Einstellungen';
          hasErrors = true;
        }
      }

      if (action.id === 'enroll_email_sequence') {
        if (!fields.sequence_id) {
          actionErrors.sequence_id = 'E-Mail-Sequenz ist erforderlich';
          hasErrors = true;
        }
      }

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
    if (selectedActionCount === 0) {
      notify('Bitte wähle mindestens eine Aktion aus', { type: 'warning' });
      return;
    }

    if (dealCount === 0) {
      notify('Keine Deals in dieser Stage vorhanden', { type: 'warning' });
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
      const selectedDealIds = deals.map((deal) => deal.id);

      const missingLeadActions = new Set(['create_moco_customer', 'create_moco_project', 'send_cituro_booking', 'enroll_email_sequence']);
      const missingLeadDeal = deals.find((deal) => !deal.lead_id && selectedActionsList.some(a => missingLeadActions.has(a.id)));
      if (missingLeadDeal) {
        throw new Error('Mindestens ein Deal hat kein lead_id für die ausgewählten Aktionen.');
      }

      const notificationSettings = loadNotificationSettings();
      const requests = [];
      selectedActionsList.forEach(action => {
        const config = action.id === 'send_notification_email'
          ? notificationSettings
          : (actionFields[action.id] || {});
        deals.forEach(deal => {
          requests.push({
            action: action.id,
            config,
            context: {
              deal_id: deal.id,
              lead_id: deal.lead_id,
              stage_id: stage?.id,
              pipeline_id: deal.pipeline_id || stage?.pipeline_id,
            },
          });
        });
      });

      const results = await Promise.allSettled(
        requests.map((payload) =>
          httpClient(`${API_URL}/triggers/execute`, {
            method: 'POST',
            body: JSON.stringify(payload),
          })
        )
      );

      const failures = [];
      let successCount = 0;

      results.forEach((res, index) => {
        if (res.status === 'fulfilled') {
          const data = res.value?.json;
          if (data?.success) {
            successCount += 1;
          } else {
            failures.push({
              index,
              error: data?.error || data?.result?.error || 'Unbekannter Fehler',
            });
          }
        } else {
          failures.push({ index, error: res.reason?.message || 'Unbekannter Fehler' });
        }
      });

      const actionNames = selectedActionsList.map(a => a.name).join(', ');
      const totalCount = requests.length;
      const failedCount = failures.length;

      const errorPreview = failures.slice(0, 3).map((f) => f.error).filter(Boolean);
      const errorSuffix = errorPreview.length ? ` Fehler: ${errorPreview.join(' | ')}.` : '';

      setExecutionResult({
        success: failedCount === 0,
        message: failedCount === 0
          ? `${selectedActionCount} Aktion(en) erfolgreich für ${selectedDealIds.length} Deal(s) ausgeführt: ${actionNames}`
          : `${successCount}/${totalCount} Trigger erfolgreich, ${failedCount} fehlgeschlagen.${errorSuffix}`,
        details: { total: totalCount, success: successCount, failed: failedCount },
      });

      if (failedCount === 0) {
        notify(`${selectedActionCount} Trigger erfolgreich ausgeführt`, { type: 'success' });
      } else {
        notify(`${failedCount} Trigger fehlgeschlagen`, { type: 'warning' });
      }

      if (successCount > 0 && typeof onExecuted === 'function') {
        onExecuted();
      }
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
              Mehrere Aktionen für alle Deals in dieser Stage konfigurieren und ausführen
            </Typography>
          </Box>
        </Box>
        <IconButton onClick={handleClose} disabled={executing}>
          <CloseIcon />
        </IconButton>
      </DialogTitle>

      <DialogContent sx={{ p: 0, display: 'flex', height: '60vh' }}>
        {/* Linke Seite: Deals in Stage */}
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
              Deals in dieser Stage
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {dealCount} Deal(s) werden automatisch berücksichtigt
            </Typography>
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
                    bgcolor: alpha(DNA_COLORS.border, 0.3),
                    transition: 'all 0.2s ease',
                  }}
                >
                  <CardContent sx={{ p: 1.5, '&:last-child': { pb: 1.5 } }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
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
              <strong style={{ color: stageColor }}>{dealCount}</strong> Deal(s) in dieser Stage
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
                                  <option key={opt.id || opt} value={opt.id || opt}>
                                    {opt.name || opt}
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
                      {action.id === 'send_notification_email'
                        ? 'Konfiguration erfolgt unter Einstellungen → Notifications.'
                        : 'Diese Aktion benötigt keine weitere Konfiguration.'}
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
            disabled={executing || selectedActionCount === 0 || dealCount === 0}
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
              : `${selectedActionCount} Aktion(en) für ${dealCount} Deal(s) ausführen`
            }
          </Button>
        </Box>
      </DialogActions>
    </Dialog>
  );
};

export default StageTriggersModal;
