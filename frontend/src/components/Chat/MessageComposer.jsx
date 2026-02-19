/**
 * MessageComposer
 *
 * Text input area for composing messages in a conversation.
 * Supports message type selection (email / internal note),
 * draft auto-save to localStorage, typing indicator emission,
 * and a send button with disabled state during sending.
 */
import { useState, useEffect, useRef, useCallback } from 'react';
import {
  Box,
  TextField,
  IconButton,
  Tooltip,
  Select,
  MenuItem,
  CircularProgress,
  InputAdornment,
  Alert,
  Collapse,
} from '@mui/material';
import {
  Send as SendIcon,
  Email as EmailIcon,
  StickyNote2 as NoteIcon,
  AttachFile as AttachIcon,
} from '@mui/icons-material';
import { API_URL, httpClient } from '../../providers/dataProvider';

const DRAFT_PREFIX = 'chat_draft_';
const AUTO_SAVE_INTERVAL = 5000; // 5 s
const TYPING_DEBOUNCE = 1500; // 1.5 s

function MessageComposer({ conversationId, onSend, disabled = false }) {
  const [text, setText] = useState('');
  const [subject, setSubject] = useState('');
  const [messageType, setMessageType] = useState('email');
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState(null);
  const typingTimerRef = useRef(null);
  const autoSaveTimerRef = useRef(null);

  // --- Draft auto-restore ------------------------------------------------
  useEffect(() => {
    if (!conversationId) return;
    const saved = localStorage.getItem(`${DRAFT_PREFIX}${conversationId}`);
    if (saved) {
      try {
        const draft = JSON.parse(saved);
        setText(draft.text || '');
        if (draft.messageType) setMessageType(draft.messageType);
      } catch { /* ignore */ }
    }
  }, [conversationId]);

  // --- Draft auto-save every 5 s ----------------------------------------
  useEffect(() => {
    if (!conversationId) return;
    autoSaveTimerRef.current = setInterval(() => {
      if (text.trim()) {
        localStorage.setItem(
          `${DRAFT_PREFIX}${conversationId}`,
          JSON.stringify({ text, messageType })
        );
      }
    }, AUTO_SAVE_INTERVAL);

    return () => clearInterval(autoSaveTimerRef.current);
  }, [conversationId, text, messageType]);

  // --- Typing indicator --------------------------------------------------
  const emitTyping = useCallback(() => {
    if (!conversationId) return;
    clearTimeout(typingTimerRef.current);
    typingTimerRef.current = setTimeout(async () => {
      try {
        await httpClient(`${API_URL}/conversations/${conversationId}/typing`, {
          method: 'POST',
          body: JSON.stringify({}),
        });
      } catch { /* non-critical */ }
    }, 300); // short delay to debounce rapid keystrokes
  }, [conversationId]);

  // Cleanup typing timer on unmount
  useEffect(() => {
    return () => clearTimeout(typingTimerRef.current);
  }, []);

  // --- Send handler ------------------------------------------------------
  const handleSend = async () => {
    const trimmed = text.trim();
    if (!trimmed || sending || disabled || !conversationId) return;

    setSending(true);
    setSendError(null);
    try {
      const direction = messageType === 'internal_note' ? 'internal' : 'outbound';
      const payload = {
        message_type: messageType,
        direction,
        ...(messageType === 'email' && { subject: subject.trim() || undefined }),
        body_text: trimmed,
        body_html: `<p>${trimmed.replace(/\n/g, '<br/>')}</p>`,
      };

      if (onSend) {
        await onSend(payload);
      } else {
        await httpClient(`${API_URL}/conversations/${conversationId}/messages`, {
          method: 'POST',
          body: JSON.stringify(payload),
        });
      }

      setText('');
      setSubject('');
      localStorage.removeItem(`${DRAFT_PREFIX}${conversationId}`);
    } catch (err) {
      console.error('Message send failed:', err);
      setSendError(err.message || 'Senden fehlgeschlagen');
    } finally {
      setSending(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <Box
      className="chat-composer"
      sx={{
        display: 'flex',
        flexDirection: 'column',
        gap: 1,
        p: 1.5,
      }}
    >
      {/* Type selector row */}
      <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
        <Select
          value={messageType}
          onChange={(e) => setMessageType(e.target.value)}
          size="small"
          variant="outlined"
          sx={{
            minWidth: 120,
            height: 36,
            '& .MuiSelect-select': { display: 'flex', alignItems: 'center', gap: 0.5, py: 0.5 },
          }}
        >
          <MenuItem value="internal_note">
            <NoteIcon sx={{ fontSize: 16, mr: 0.5, color: '#F59E0B' }} />
            Notiz
          </MenuItem>
          <MenuItem value="email">
            <EmailIcon sx={{ fontSize: 16, mr: 0.5, color: '#4A90A4' }} />
            E-Mail
          </MenuItem>
        </Select>

        {messageType === 'email' && (
          <TextField
            size="small"
            placeholder="Betreff..."
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            disabled={sending || disabled}
            sx={{ flex: 1 }}
            slotProps={{ input: { sx: { height: 36 } } }}
          />
        )}
      </Box>

      {/* Input + send row */}
      <Box sx={{ display: 'flex', gap: 1, alignItems: 'flex-end' }}>
        <TextField
          fullWidth
          multiline
          maxRows={6}
          size="small"
          className="chat-composer-input"
          placeholder={
            messageType === 'internal_note'
              ? 'Interne Notiz schreiben...'
              : 'Nachricht schreiben...'
          }
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            emitTyping();
          }}
          onKeyDown={handleKeyDown}
          disabled={sending || disabled}
          slotProps={{
            input: {
              endAdornment: (
                <InputAdornment position="end">
                  <Tooltip title="Anhang">
                    <IconButton size="small" disabled>
                      <AttachIcon sx={{ fontSize: 18 }} />
                    </IconButton>
                  </Tooltip>
                </InputAdornment>
              ),
            },
          }}
        />

        {/* Send button */}
        <Tooltip title="Senden (Enter)">
          <span>
            <IconButton
              color="primary"
              onClick={handleSend}
              disabled={!text.trim() || sending || disabled}
              className="chat-send-button"
              sx={{
                bgcolor: 'primary.main',
                color: '#fff',
                width: 40,
                height: 40,
                '&:hover': { bgcolor: 'primary.dark' },
                '&.Mui-disabled': { bgcolor: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.3)' },
              }}
            >
              {sending ? (
                <CircularProgress size={18} sx={{ color: '#fff' }} />
              ) : (
                <SendIcon sx={{ fontSize: 18 }} />
              )}
            </IconButton>
          </span>
        </Tooltip>
      </Box>
      <Collapse in={!!sendError}>
        <Alert
          severity="error"
          onClose={() => setSendError(null)}
          sx={{ mt: 0.5, fontSize: '0.8rem' }}
        >
          {sendError}
        </Alert>
      </Collapse>
    </Box>
  );
}

export default MessageComposer;
