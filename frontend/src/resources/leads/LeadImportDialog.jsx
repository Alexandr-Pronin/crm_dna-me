import { useState, useCallback } from 'react';
import { useDataProvider, useNotify, useRefresh } from 'react-admin';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Box,
  Typography,
  IconButton,
  Chip,
  Divider,
  Alert,
  CircularProgress,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
} from '@mui/material';
import {
  Close as CloseIcon,
  Add as AddIcon,
  Delete as DeleteIcon,
  Upload as UploadIcon,
  SwapVert as SwapIcon,
} from '@mui/icons-material';

function LeadImportDialog({ open, onClose }) {
  const dataProvider = useDataProvider();
  const notify = useNotify();
  const refresh = useRefresh();

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const [lead, setLead] = useState({
    email: '',
    first_name: '',
    last_name: '',
    phone: '',
    job_title: '',
    linkedin_url: '',
  });

  const [messages, setMessages] = useState([]);

  const handleLeadChange = (field) => (e) => {
    setLead((prev) => ({ ...prev, [field]: e.target.value }));
  };

  const addMessage = () => {
    setMessages((prev) => [
      ...prev,
      {
        direction: 'inbound',
        subject: '',
        body_text: '',
        sent_at: new Date().toISOString().slice(0, 16),
      },
    ]);
  };

  const updateMessage = (idx, field, value) => {
    setMessages((prev) =>
      prev.map((m, i) => (i === idx ? { ...m, [field]: value } : m))
    );
  };

  const removeMessage = (idx) => {
    setMessages((prev) => prev.filter((_, i) => i !== idx));
  };

  const handlePasteConversation = useCallback(() => {
    navigator.clipboard.readText().then((text) => {
      if (!text.trim()) return;

      const lines = text.split('\n').filter((l) => l.trim());
      const parsed = [];

      for (const line of lines) {
        const dirMatch = line.match(/^(>>>|<<<|->|<-|out:|in:)\s*/i);
        const direction = dirMatch
          ? /^(>>>|->|out:)/i.test(dirMatch[1])
            ? 'outbound'
            : 'inbound'
          : 'inbound';

        const body = dirMatch ? line.slice(dirMatch[0].length).trim() : line.trim();

        if (body) {
          parsed.push({
            direction,
            subject: '',
            body_text: body,
            sent_at: new Date().toISOString().slice(0, 16),
          });
        }
      }

      if (parsed.length > 0) {
        setMessages((prev) => [...prev, ...parsed]);
        notify(`${parsed.length} Nachrichten aus Zwischenablage eingefügt`, { type: 'info' });
      }
    }).catch(() => {
      notify('Zwischenablage nicht verfügbar', { type: 'warning' });
    });
  }, [notify]);

  const handleSubmit = async () => {
    if (!lead.email.trim()) {
      setError('E-Mail ist erforderlich');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const payload = {
        ...lead,
        email: lead.email.trim().toLowerCase(),
        first_touch_source: 'manual_import',
        messages: messages.map((m) => ({
          ...m,
          sent_at: m.sent_at ? new Date(m.sent_at).toISOString() : undefined,
        })),
      };

      await dataProvider.create('leads/import', { data: payload });

      notify(
        `Lead ${lead.email} importiert${messages.length > 0 ? ` mit ${messages.length} Nachrichten` : ''}`,
        { type: 'success' }
      );
      refresh();
      handleClose();
    } catch (err) {
      setError(err.message || 'Import fehlgeschlagen');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setLead({ email: '', first_name: '', last_name: '', phone: '', job_title: '', linkedin_url: '' });
    setMessages([]);
    setError(null);
    onClose();
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="md" fullWidth>
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <UploadIcon />
          <Typography variant="h6">Lead importieren</Typography>
        </Box>
        <IconButton onClick={handleClose} size="small">
          <CloseIcon />
        </IconButton>
      </DialogTitle>

      <DialogContent dividers sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 2 }}>
        {error && (
          <Alert severity="error" onClose={() => setError(null)}>
            {error}
          </Alert>
        )}

        <Typography variant="subtitle2" color="text.secondary">
          Kontaktdaten
        </Typography>

        <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1.5 }}>
          <TextField
            label="E-Mail *"
            value={lead.email}
            onChange={handleLeadChange('email')}
            size="small"
            type="email"
            fullWidth
          />
          <TextField
            label="Telefon"
            value={lead.phone}
            onChange={handleLeadChange('phone')}
            size="small"
            fullWidth
          />
          <TextField
            label="Vorname"
            value={lead.first_name}
            onChange={handleLeadChange('first_name')}
            size="small"
            fullWidth
          />
          <TextField
            label="Nachname"
            value={lead.last_name}
            onChange={handleLeadChange('last_name')}
            size="small"
            fullWidth
          />
          <TextField
            label="Position"
            value={lead.job_title}
            onChange={handleLeadChange('job_title')}
            size="small"
            fullWidth
          />
          <TextField
            label="LinkedIn URL"
            value={lead.linkedin_url}
            onChange={handleLeadChange('linkedin_url')}
            size="small"
            fullWidth
          />
        </Box>

        <Divider />

        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Typography variant="subtitle2" color="text.secondary">
            E-Mail-Verlauf
            {messages.length > 0 && (
              <Chip label={messages.length} size="small" sx={{ ml: 1 }} />
            )}
          </Typography>
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Button size="small" startIcon={<SwapIcon />} onClick={handlePasteConversation}>
              Einfügen
            </Button>
            <Button size="small" startIcon={<AddIcon />} onClick={addMessage}>
              Nachricht
            </Button>
          </Box>
        </Box>

        <Typography variant="caption" color="text.secondary" sx={{ mt: -1 }}>
          Nachrichten manuell hinzufügen oder aus der Zwischenablage einfügen.
          Format: &quot;{'>>>'} Ausgehend&quot; oder &quot;{'<<<'} Eingehend&quot; pro Zeile.
        </Typography>

        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, maxHeight: 400, overflow: 'auto' }}>
          {messages.map((msg, idx) => (
            <Box
              key={idx}
              sx={{
                p: 1.5,
                border: '1px solid',
                borderColor: msg.direction === 'outbound' ? 'primary.light' : 'grey.300',
                borderRadius: 1,
                bgcolor: msg.direction === 'outbound' ? 'primary.50' : 'grey.50',
              }}
            >
              <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', mb: 1 }}>
                <FormControl size="small" sx={{ minWidth: 130 }}>
                  <InputLabel>Richtung</InputLabel>
                  <Select
                    value={msg.direction}
                    label="Richtung"
                    onChange={(e) => updateMessage(idx, 'direction', e.target.value)}
                  >
                    <MenuItem value="inbound">← Eingehend</MenuItem>
                    <MenuItem value="outbound">→ Ausgehend</MenuItem>
                  </Select>
                </FormControl>

                <TextField
                  label="Betreff"
                  value={msg.subject}
                  onChange={(e) => updateMessage(idx, 'subject', e.target.value)}
                  size="small"
                  sx={{ flex: 1 }}
                />

                <TextField
                  label="Datum"
                  type="datetime-local"
                  value={msg.sent_at}
                  onChange={(e) => updateMessage(idx, 'sent_at', e.target.value)}
                  size="small"
                  sx={{ width: 200 }}
                  slotProps={{ inputLabel: { shrink: true } }}
                />

                <IconButton size="small" color="error" onClick={() => removeMessage(idx)}>
                  <DeleteIcon fontSize="small" />
                </IconButton>
              </Box>

              <TextField
                fullWidth
                multiline
                minRows={2}
                maxRows={5}
                value={msg.body_text}
                onChange={(e) => updateMessage(idx, 'body_text', e.target.value)}
                placeholder="Nachrichtentext..."
                size="small"
              />
            </Box>
          ))}

          {messages.length === 0 && (
            <Box
              sx={{
                textAlign: 'center',
                py: 4,
                color: 'text.disabled',
                border: '1px dashed',
                borderColor: 'grey.300',
                borderRadius: 1,
              }}
            >
              <Typography variant="body2">
                Noch keine Nachrichten. Klicken Sie &quot;Nachricht&quot; oder &quot;Einfügen&quot;.
              </Typography>
            </Box>
          )}
        </Box>
      </DialogContent>

      <DialogActions sx={{ px: 3, py: 2 }}>
        <Button onClick={handleClose} disabled={loading}>
          Abbrechen
        </Button>
        <Button
          variant="contained"
          onClick={handleSubmit}
          disabled={loading || !lead.email.trim()}
          startIcon={loading ? <CircularProgress size={16} /> : <UploadIcon />}
        >
          {loading ? 'Importiere...' : `Importieren${messages.length > 0 ? ` (${messages.length} Nachrichten)` : ''}`}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

export default LeadImportDialog;
