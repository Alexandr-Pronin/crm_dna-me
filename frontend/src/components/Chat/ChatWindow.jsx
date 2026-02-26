/**
 * ChatWindow
 *
 * Displays a single conversation: header, messages, typing indicator,
 * and message composer.  Loads initial messages from the API and then
 * receives real-time updates via the useConversationPolling hook.
 */
import { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Typography,
  IconButton,
  Chip,
  Tooltip,
  CircularProgress,
  Divider,
} from '@mui/material';
import {
  ArrowBack as BackIcon,
  MoreVert as MoreIcon,
  Archive as ArchiveIcon,
  FiberManualRecord as StatusDot,
} from '@mui/icons-material';
import MessageList from './MessageList';
import MessageComposer from './MessageComposer';
import TypingIndicator from './TypingIndicator';
import { useConversationPolling } from '../../hooks/useConversationPolling';
import { API_URL, httpClient } from '../../providers/dataProvider';

function ChatWindow({ conversationId, onBack, currentUserEmail }) {
  const [conversation, setConversation] = useState(null);
  const [initialMessages, setInitialMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Single hook provides both messages AND typing users (via SSE)
  const {
    messages: liveMessages,
    typingUsers,
    connectionStatus,
    appendMessage,
  } = useConversationPolling(conversationId);

  // Filter out current user from typing users
  const filteredTyping = typingUsers.filter(
    (u) => u.name !== currentUserEmail
  );

  // --- Load conversation & initial messages --------------------------------
  useEffect(() => {
    if (!conversationId) return;

    let cancelled = false;
    setLoading(true);
    setError(null);
    setConversation(null);
    setInitialMessages([]);

    (async () => {
      try {
        const [convRes, msgRes] = await Promise.all([
          httpClient(`${API_URL}/conversations/${conversationId}`),
          httpClient(`${API_URL}/conversations/${conversationId}/messages?limit=50&sort_order=asc`),
        ]);

        if (cancelled) return;
        setConversation(convRes.json.data ?? convRes.json);
        setInitialMessages(msgRes.json.data ?? []);

        // Mark as read
        httpClient(`${API_URL}/conversations/${conversationId}/read`, {
          method: 'POST',
          body: JSON.stringify({}),
        }).catch(() => {});
      } catch (err) {
        if (!cancelled) {
          setError(err.message || 'Konversation konnte nicht geladen werden');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [conversationId]);

  // Merge initial + live messages (dedup by id)
  const allMessages = (() => {
    const map = new Map();
    for (const m of initialMessages) map.set(m.id, m);
    for (const m of liveMessages) map.set(m.id, m);
    return Array.from(map.values()).sort((a, b) => {
      const aTime = a.sent_at ?? a.created_at;
      const bTime = b.sent_at ?? b.created_at;
      return new Date(aTime) - new Date(bTime);
    });
  })();

  // --- Retry handler -------------------------------------------------------
  const handleRetry = useCallback(async (messageId) => {
    try {
      await httpClient(
        `${API_URL}/conversations/${conversationId}/messages/${messageId}/retry`,
        { method: 'POST', body: JSON.stringify({}) }
      );
    } catch (err) {
      console.error('Retry failed:', err);
    }
  }, [conversationId]);

  // --- Send handler --------------------------------------------------------
  const handleSend = useCallback(async (payload) => {
    const { json } = await httpClient(
      `${API_URL}/conversations/${conversationId}/messages`,
      { method: 'POST', body: JSON.stringify(payload) }
    );
    const msg = json.data ?? json;
    appendMessage(msg);
    setInitialMessages((prev) => {
      if (prev.some((m) => m.id === msg.id)) return prev;
      return [...prev, msg];
    });
  }, [conversationId, appendMessage]);

  // --- Connection status badge ---------------------------------------------
  const statusColor =
    connectionStatus === 'connected'    ? '#80c856' :
    connectionStatus === 'polling'      ? '#F59E0B' :
    connectionStatus === 'reconnecting' ? '#F59E0B' :
    connectionStatus === 'error'        ? '#ff6666' : '#98a2b3';

  if (loading) {
    return (
      <Box sx={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <CircularProgress size={32} />
      </Box>
    );
  }

  if (error) {
    return (
      <Box sx={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', p: 3 }}>
        <Typography color="error" variant="body2">{error}</Typography>
      </Box>
    );
  }

  const displayName =
    conversation?.subject ||
    conversation?.deal_name ||
    conversation?.lead_name ||
    'Konversation';

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0, overflow: 'hidden' }}>
      {/* Header */}
      <div className="chat-header">
        <IconButton size="small" onClick={onBack}>
          <BackIcon sx={{ fontSize: 20 }} />
        </IconButton>

        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography variant="subtitle2" noWrap className="chat-header-title">
            {displayName}
          </Typography>
          {conversation?.lead_email && (
            <Typography variant="caption" noWrap className="chat-header-subtitle">
              {conversation.lead_email}
            </Typography>
          )}
        </Box>

        {/* Connection status */}
        <Tooltip title={
          connectionStatus === 'connected'    ? 'Echtzeit verbunden (SSE)' :
          connectionStatus === 'polling'      ? 'Polling-Modus (alle 5s)' :
          connectionStatus === 'reconnecting' ? 'Verbindung wird wiederhergestellt...' :
          connectionStatus === 'error'        ? 'Verbindung fehlgeschlagen' :
          'Verbindung wird hergestellt...'
        }>
          <StatusDot
            className={`chat-connection-dot chat-connection-dot--${connectionStatus}`}
            sx={{ fontSize: 10 }}
          />
        </Tooltip>

        {/* Status chips */}
        {conversation?.status && conversation.status !== 'active' && (
          <Chip
            label={conversation.status === 'archived' ? 'Archiviert' : 'Geschlossen'}
            size="small"
            sx={{ height: 22, fontSize: 11 }}
          />
        )}
      </div>

      {/* Messages – scrollable area */}
      <MessageList
        messages={allMessages}
        conversation={conversation}
        currentUserEmail={currentUserEmail}
        onRetry={handleRetry}
      />

      {/* Typing indicator */}
      <TypingIndicator typingUsers={filteredTyping} />

      {/* Composer – fixed at bottom */}
      <Box sx={{ flexShrink: 0 }}>
        <MessageComposer
        conversationId={conversationId}
        onSend={handleSend}
        disabled={conversation?.status !== 'active'}
        />
      </Box>
    </Box>
  );
}

export default ChatWindow;
