/**
 * ChatPanel
 *
 * Slide-in side panel that displays conversations for a lead or deal.
 * Two views:
 *   1. Conversation list  – filtered by lead_id / deal_id
 *   2. Chat window        – single conversation detail
 *
 * Usage:
 *   <ChatPanel leadId={...} dealId={...} onClose={fn} />
 */
import { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Typography,
  IconButton,
  TextField,
  Button,
  CircularProgress,
  Tabs,
  Tab,
  Drawer,
  Badge,
  Divider,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Select,
  MenuItem,
  Avatar,
} from '@mui/material';
import {
  Close as CloseIcon,
  Add as AddIcon,
  Search as SearchIcon,
  Chat as ChatIcon,
  Refresh as RefreshIcon,
} from '@mui/icons-material';
import ConversationListItem from './ConversationListItem';
import ChatWindow from './ChatWindow';
import { API_URL, httpClient, getTeamMembers } from '../../providers/dataProvider';
import './ChatPanel.css';

const TABS = [
  { label: 'Alle', filter: {} },
  { label: 'Direkt', filter: { type: 'direct' } },
  { label: 'Intern', filter: { type: 'internal' } },
  { label: 'Gruppe', filter: { type: 'group' } },
  { label: 'Archiv', filter: { status: 'archived' } },
];

function ChatPanel({ leadId, dealId, onClose }) {
  const [conversations, setConversations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [tabIndex, setTabIndex] = useState(0);
  const [activeConversationId, setActiveConversationId] = useState(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [newSubject, setNewSubject] = useState('');
  const [newType, setNewType] = useState('direct');
  const [creating, setCreating] = useState(false);
  const [assignOpen, setAssignOpen] = useState(false);
  const [assignConversation, setAssignConversation] = useState(null);
  const [teamMembers, setTeamMembers] = useState([]);
  const [assigning, setAssigning] = useState(false);

  // Get current user info for message ownership and visibility
  const [currentUserEmail, setCurrentUserEmail] = useState(null);
  const [currentUserId, setCurrentUserId] = useState(null);
  useEffect(() => {
    try {
      const user = JSON.parse(localStorage.getItem('auth_user'));
      setCurrentUserEmail(user?.email || null);
      setCurrentUserId(user?.id || null);
    } catch { /* ignore */ }
  }, []);

  // --- Load conversations ---------------------------------------------------
  const loadConversations = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (leadId) params.set('lead_id', leadId);
      if (dealId) params.set('deal_id', dealId);
      params.set('limit', '50');
      params.set('sort_by', 'last_message_at');
      params.set('sort_order', 'desc');

      // Tab filter
      const tabFilter = TABS[tabIndex]?.filter || {};
      if (tabFilter.type) params.set('type', tabFilter.type);
      if (tabFilter.status) params.set('status', tabFilter.status);
      else params.set('status', 'active'); // без Архив — только активные чаты

      // Search
      if (searchQuery.trim()) params.set('search', searchQuery.trim());

      const { json } = await httpClient(`${API_URL}/conversations?${params}`);
      setConversations(json.data ?? []);
    } catch (err) {
      console.error('Failed to load conversations:', err);
      setConversations([]);
    } finally {
      setLoading(false);
    }
  }, [leadId, dealId, tabIndex, searchQuery]);

  useEffect(() => {
    loadConversations();
  }, [loadConversations]);

  // --- Total unread count ---------------------------------------------------
  const totalUnread = conversations.reduce((sum, c) => sum + (c.unread_count || 0), 0);

  // --- Create conversation ---------------------------------------------------
  const handleCreate = async () => {
    if (creating) return;
    setCreating(true);
    try {
      const { json } = await httpClient(`${API_URL}/conversations`, {
        method: 'POST',
        body: JSON.stringify({
          lead_id: leadId || undefined,
          deal_id: dealId || undefined,
          type: newType,
          subject: newSubject.trim() || undefined,
        }),
      });
      const conv = json.data ?? json;
      setCreateOpen(false);
      setNewSubject('');
      setNewType('direct');
      setActiveConversationId(conv.id);
      loadConversations();
    } catch (err) {
      console.error('Create conversation failed:', err);
    } finally {
      setCreating(false);
    }
  };

  const handleDeleteChat = async (conv) => {
    if (!conv?.id) return;
    if (!window.confirm('Chat wirklich unwiderruflich löschen? Alle Nachrichten gehen verloren.')) return;
    try {
      await httpClient(`${API_URL}/conversations/${conv.id}?hard=true`, { method: 'DELETE' });
      if (activeConversationId === conv.id) setActiveConversationId(null);
      loadConversations();
    } catch (err) {
      console.error('Delete conversation failed:', err);
    }
  };

  const handleArchiveChat = async (conv) => {
    if (!conv?.id) return;
    try {
      await httpClient(`${API_URL}/conversations/${conv.id}`, { method: 'DELETE' });
      if (activeConversationId === conv.id) setActiveConversationId(null);
      loadConversations();
    } catch (err) {
      console.error('Archive conversation failed:', err);
    }
  };

  const handleAssignChat = (conv) => {
    setAssignConversation(conv);
    setAssignOpen(true);
    getTeamMembers({ limit: 100 }).then((res) => {
      setTeamMembers(res.data ?? res ?? []);
    }).catch(() => setTeamMembers([]));
  };

  const handleVisibilityChange = async (conv, newAssignedToId) => {
    try {
      await httpClient(`${API_URL}/conversations/${conv.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ assigned_to_id: newAssignedToId }),
      });
      loadConversations();
    } catch (err) {
      console.error('Visibility change failed:', err);
    }
  };

  const handleAssignSelect = async (memberId) => {
    if (!assignConversation?.id || !memberId) return;
    setAssigning(true);
    try {
      await httpClient(`${API_URL}/conversations/${assignConversation.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ assigned_to_id: memberId }),
      });
      setAssignOpen(false);
      setAssignConversation(null);
      loadConversations();
    } catch (err) {
      console.error('Assign conversation failed:', err);
    } finally {
      setAssigning(false);
    }
  };

  // --- Render ---------------------------------------------------------------
  const showList = !activeConversationId;

  return (
    <Drawer
      anchor="right"
      open
      onClose={onClose}
      variant="temporary"
      ModalProps={{ keepMounted: true }}
      PaperProps={{
        className: 'chat-panel-drawer',
        sx: {
          width: { xs: '100vw', sm: 440 },
          maxWidth: '100vw',
          bgcolor: 'rgba(10, 14, 35, 0.95)',
          backdropFilter: 'blur(16px)',
          borderLeft: '1px solid',
          borderColor: 'rgba(0, 128, 255, 0.12)',
        },
      }}
    >
      {showList ? (
        /* ================================================================
         * CONVERSATION LIST VIEW
         * ================================================================ */
        <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
          {/* Header */}
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 1,
              px: 2,
              py: 1.5,
              borderBottom: '1px solid',
              borderColor: 'divider',
              flexShrink: 0,
            }}
          >
            <Badge badgeContent={totalUnread} color="primary">
              <ChatIcon sx={{ color: 'primary.main' }} />
            </Badge>
            <Typography variant="h6" sx={{ flex: 1, fontWeight: 600, fontSize: '1rem' }}>
              Chats
            </Typography>
            <IconButton size="small" onClick={loadConversations} disabled={loading}>
              <RefreshIcon sx={{ fontSize: 18 }} />
            </IconButton>
            <IconButton size="small" onClick={() => setCreateOpen(true)}>
              <AddIcon sx={{ fontSize: 20 }} />
            </IconButton>
            <IconButton size="small" onClick={onClose}>
              <CloseIcon sx={{ fontSize: 20 }} />
            </IconButton>
          </Box>

          {/* Search */}
          <Box sx={{ px: 2, py: 1 }}>
            <TextField
              fullWidth
              size="small"
              placeholder="Konversation suchen..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="chat-search-bar"
              slotProps={{
                input: {
                  startAdornment: <SearchIcon sx={{ mr: 1, fontSize: 18, color: 'text.disabled' }} />,
                },
              }}
            />
          </Box>

          {/* Tabs */}
          <Tabs
            value={tabIndex}
            onChange={(_, v) => setTabIndex(v)}
            variant="scrollable"
            scrollButtons="auto"
            className="chat-tabs"
            sx={{ px: 1 }}
          >
            {TABS.map((t, i) => (
              <Tab key={i} label={t.label} />
            ))}
          </Tabs>

          <Divider />

          {/* Conversation list */}
          <Box sx={{ flex: 1, overflowY: 'auto', py: 0.5 }}>
            {loading ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
                <CircularProgress size={28} />
              </Box>
            ) : conversations.length === 0 ? (
              <div className="chat-empty-state">
                <ChatIcon className="chat-empty-state-icon" />
                <Typography variant="body2" color="text.secondary">
                  Keine Konversationen gefunden.
                </Typography>
                <Button
                  variant="outlined"
                  size="small"
                  startIcon={<AddIcon />}
                  onClick={() => setCreateOpen(true)}
                  sx={{ mt: 2 }}
                >
                  Neue Konversation
                </Button>
              </div>
            ) : (
              conversations.map((conv) => (
                <ConversationListItem
                  key={conv.id}
                  conversation={conv}
                  isActive={activeConversationId === conv.id}
                  onClick={() => setActiveConversationId(conv.id)}
                  onDeleteChat={handleDeleteChat}
                  onArchiveChat={handleArchiveChat}
                  onAssignChat={handleAssignChat}
                  onVisibilityChange={handleVisibilityChange}
                  currentUserId={currentUserId}
                />
              ))
            )}
          </Box>
        </Box>
      ) : (
        /* ================================================================
         * CHAT WINDOW VIEW
         * ================================================================ */
        <ChatWindow
          conversationId={activeConversationId}
          currentUserEmail={currentUserEmail}
          onBack={() => {
            setActiveConversationId(null);
            loadConversations();
          }}
        />
      )}

      {/* ================================================================
       * ASSIGN CONVERSATION DIALOG
       * ================================================================ */}
      <Dialog
        open={assignOpen}
        onClose={() => { setAssignOpen(false); setAssignConversation(null); }}
        fullWidth
        maxWidth="xs"
      >
        <DialogTitle>Chat zuweisen</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Wählen Sie ein Teammitglied – der Lead wird dieser Person zugeordnet (Icon in der Chat-Liste).
          </Typography>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
            <Button
              size="small"
              variant="outlined"
              onClick={() => handleAssignSelect(null)}
              disabled={assigning}
              sx={{ justifyContent: 'flex-start' }}
            >
              Zuweisung aufheben
            </Button>
            {teamMembers.map((member) => (
              <Button
                key={member.id}
                size="small"
                variant="outlined"
                onClick={() => handleAssignSelect(member.id)}
                disabled={assigning}
                sx={{ justifyContent: 'flex-start', textTransform: 'none' }}
              >
                <Avatar src={member.avatar} sx={{ width: 24, height: 24, mr: 1.5, fontSize: 12 }}>
                  {(member.name || member.email || '?').slice(0, 2).toUpperCase()}
                </Avatar>
                {member.name || member.email}
              </Button>
            ))}
          </Box>
        </DialogContent>
      </Dialog>

      {/* ================================================================
       * CREATE CONVERSATION DIALOG
       * ================================================================ */}
      <Dialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        fullWidth
        maxWidth="xs"
        className="chat-create-dialog"
      >
        <DialogTitle>Neue Konversation</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
            <TextField
              label="Betreff (optional)"
              value={newSubject}
              onChange={(e) => setNewSubject(e.target.value)}
              fullWidth
              size="small"
            />
            <Select
              value={newType}
              onChange={(e) => setNewType(e.target.value)}
              fullWidth
              size="small"
            >
              <MenuItem value="direct">Direkt</MenuItem>
              <MenuItem value="internal">Intern</MenuItem>
              <MenuItem value="group">Gruppe</MenuItem>
            </Select>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCreateOpen(false)} disabled={creating}>
            Abbrechen
          </Button>
          <Button variant="contained" onClick={handleCreate} disabled={creating}>
            {creating ? 'Erstellen...' : 'Erstellen'}
          </Button>
        </DialogActions>
      </Dialog>
    </Drawer>
  );
}

export default ChatPanel;
