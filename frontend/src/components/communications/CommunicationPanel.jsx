import { useState, useEffect } from 'react';
import {
  Box, Typography, TextField, Button, MenuItem, IconButton,
  Tooltip, Card, Chip, Divider, CircularProgress,
} from '@mui/material';
import {
  Send as SendIcon,
  Add as AddIcon,
  Email as EmailIcon,
  Note as NoteIcon,
  Event as EventIcon,
  Mail as InviteIcon,
} from '@mui/icons-material';
import {
  getLeadCommunications,
  createCommunication,
} from '../../providers/dataProvider';
import TaskCreateDialog from '../tasks/TaskCreateDialog';

const COMM_TYPES = [
  { value: 'notiz', label: 'Notiz', icon: NoteIcon, color: '#4A90A4' },
  { value: 'email', label: 'Email', icon: EmailIcon, color: '#6C5CE7' },
  { value: 'cituro', label: 'Cituro', icon: EventIcon, color: '#28A745' },
  { value: 'einladung', label: 'Einladung', icon: InviteIcon, color: '#E84393' },
];

const TimelineEntry = ({ item }) => {
  const commConfig = COMM_TYPES.find(c => c.value === item.comm_type) || COMM_TYPES[0];
  const Icon = commConfig.icon;

  return (
    <Box sx={{ display: 'flex', gap: 1.5, py: 1.5 }}>
      <Box sx={{
        width: 32, height: 32, borderRadius: '50%',
        bgcolor: `${commConfig.color}20`,
        display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
      }}>
        <Icon sx={{ fontSize: 16, color: commConfig.color }} />
      </Box>
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Chip label={commConfig.label} size="small" sx={{ height: 20, fontSize: 11, bgcolor: `${commConfig.color}15`, color: commConfig.color }} />
          <Typography variant="caption" color="text.secondary">
            {new Date(item.created_at).toLocaleString('de-DE', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
          </Typography>
        </Box>
        {item.subject && (
          <Typography variant="body2" sx={{ fontWeight: 500, mt: 0.5 }}>{item.subject}</Typography>
        )}
        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.25, whiteSpace: 'pre-wrap' }}>
          {item.body}
        </Typography>
        {item.created_by && (
          <Typography variant="caption" color="text.disabled">by {item.created_by}</Typography>
        )}
      </Box>
    </Box>
  );
};

const CommunicationPanel = ({ leadId, dealId }) => {
  const [communications, setCommunications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [commType, setCommType] = useState('notiz');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [sending, setSending] = useState(false);
  const [taskDialogOpen, setTaskDialogOpen] = useState(false);

  const loadCommunications = async () => {
    try {
      const result = await getLeadCommunications(leadId, { limit: 50 });
      setCommunications(result.data || []);
    } catch {
      setCommunications([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (leadId) loadCommunications();
  }, [leadId]);

  const handleSend = async () => {
    if (!body.trim()) return;
    setSending(true);
    try {
      await createCommunication({
        lead_id: leadId,
        deal_id: dealId || undefined,
        comm_type: commType,
        subject: subject.trim() || undefined,
        body: body.trim(),
        created_by: 'admin@dna-me.com',
      });
      setBody('');
      setSubject('');
      await loadCommunications();
    } catch (err) {
      console.error('Failed to send:', err);
    } finally {
      setSending(false);
    }
  };

  return (
    <Card sx={{ bgcolor: 'background.paper', overflow: 'hidden' }}>
      <Box sx={{ p: 2, borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
        <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>Communications</Typography>
      </Box>

      {/* Timeline */}
      <Box sx={{ maxHeight: 400, overflowY: 'auto', px: 2 }}>
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
            <CircularProgress size={24} />
          </Box>
        ) : communications.length === 0 ? (
          <Typography variant="body2" color="text.secondary" sx={{ py: 4, textAlign: 'center' }}>
            No communications yet
          </Typography>
        ) : (
          communications.map((item, i) => (
            <Box key={item.id}>
              <TimelineEntry item={item} />
              {i < communications.length - 1 && <Divider />}
            </Box>
          ))
        )}
      </Box>

      <Divider />

      {/* Input Area */}
      <Box sx={{ p: 2, display: 'flex', flexDirection: 'column', gap: 1.5 }}>
        <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
          <TextField
            select
            value={commType}
            onChange={(e) => setCommType(e.target.value)}
            size="small"
            sx={{ minWidth: 130 }}
          >
            {COMM_TYPES.map((t) => (
              <MenuItem key={t.value} value={t.value}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                  <t.icon sx={{ fontSize: 16, color: t.color }} />
                  {t.label}
                </Box>
              </MenuItem>
            ))}
          </TextField>

          <TextField
            placeholder="Subject (optional)"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            size="small"
            fullWidth
          />
        </Box>

        <Box sx={{ display: 'flex', gap: 1, alignItems: 'flex-end' }}>
          <TextField
            placeholder="Message..."
            value={body}
            onChange={(e) => setBody(e.target.value)}
            size="small"
            fullWidth
            multiline
            maxRows={4}
          />

          <Tooltip title="Create Task">
            <IconButton
              onClick={() => setTaskDialogOpen(true)}
              sx={{
                bgcolor: 'primary.main', color: '#fff',
                '&:hover': { bgcolor: 'primary.dark' },
                width: 36, height: 36,
              }}
            >
              <AddIcon fontSize="small" />
            </IconButton>
          </Tooltip>

          <Button
            variant="contained"
            onClick={handleSend}
            disabled={!body.trim() || sending}
            startIcon={sending ? <CircularProgress size={14} /> : <SendIcon />}
            sx={{ minWidth: 90 }}
          >
            Send
          </Button>
        </Box>
      </Box>

      <TaskCreateDialog
        open={taskDialogOpen}
        onClose={() => setTaskDialogOpen(false)}
        onSuccess={() => setTaskDialogOpen(false)}
        defaultLeadId={leadId}
        defaultDealId={dealId}
        defaultDescription={body}
      />
    </Card>
  );
};

export default CommunicationPanel;
