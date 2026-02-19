/**
 * Chat Page
 *
 * Standalone page that shows all conversations in a two-panel layout:
 * conversation list on the left, chat window on the right.
 */
import { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Typography,
  TextField,
  Button,
  CircularProgress,
  Tabs,
  Tab,
  Divider,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Select,
  MenuItem,
  Badge,
  IconButton,
} from '@mui/material';
import {
  Add as AddIcon,
  Search as SearchIcon,
  Chat as ChatIcon,
  Refresh as RefreshIcon,
} from '@mui/icons-material';
import Autocomplete from '@mui/material/Autocomplete';
import { ConversationListItem } from '../../components/Chat';
import ChatWindow from '../../components/Chat/ChatWindow';
import { API_URL, httpClient } from '../../providers/dataProvider';
import '../../components/Chat/ChatPanel.css';

const TABS = [
  { label: 'Alle', filter: {} },
  { label: 'Direkt', filter: { type: 'direct' } },
  { label: 'Intern', filter: { type: 'internal' } },
  { label: 'Gruppe', filter: { type: 'group' } },
];

function ChatPage() {
  const [conversations, setConversations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [tabIndex, setTabIndex] = useState(0);
  const [activeConversationId, setActiveConversationId] = useState(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [newSubject, setNewSubject] = useState('');
  const [newType, setNewType] = useState('direct');
  const [creating, setCreating] = useState(false);
  const [leadOptions, setLeadOptions] = useState([]);
  const [selectedLead, setSelectedLead] = useState(null);
  const [leadSearch, setLeadSearch] = useState('');
  const [leadLoading, setLeadLoading] = useState(false);

  const [currentUserEmail, setCurrentUserEmail] = useState(null);
  useEffect(() => {
    try {
      const user = JSON.parse(localStorage.getItem('auth_user'));
      setCurrentUserEmail(user?.email || null);
    } catch { /* ignore */ }
  }, []);

  const loadConversations = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set('limit', '50');
      params.set('sort_by', 'last_message_at');
      params.set('sort_order', 'desc');

      const tabFilter = TABS[tabIndex]?.filter || {};
      if (tabFilter.type) params.set('type', tabFilter.type);
      if (searchQuery.trim()) params.set('search', searchQuery.trim());

      const { json } = await httpClient(`${API_URL}/conversations?${params}`);
      setConversations(json.data ?? []);
    } catch (err) {
      console.error('Failed to load conversations:', err);
      setConversations([]);
    } finally {
      setLoading(false);
    }
  }, [tabIndex, searchQuery]);

  useEffect(() => {
    loadConversations();
  }, [loadConversations]);

  const totalUnread = conversations.reduce((sum, c) => sum + (c.unread_count || 0), 0);

  // Search leads for create dialog
  useEffect(() => {
    if (!leadSearch || leadSearch.length < 2) {
      setLeadOptions([]);
      return;
    }
    const timer = setTimeout(async () => {
      setLeadLoading(true);
      try {
        const params = new URLSearchParams({ search: leadSearch, limit: '10', page: '1' });
        const { json } = await httpClient(`${API_URL}/leads?${params}`);
        const leads = json.data ?? json ?? [];
        setLeadOptions(
          leads.map((l) => ({
            id: l.id,
            label: `${l.first_name ?? ''} ${l.last_name ?? ''} (${l.email})`.trim(),
            email: l.email,
          }))
        );
      } catch {
        setLeadOptions([]);
      } finally {
        setLeadLoading(false);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [leadSearch]);

  const handleCreate = async () => {
    if (creating || !selectedLead) return;
    setCreating(true);
    try {
      const { json } = await httpClient(`${API_URL}/conversations`, {
        method: 'POST',
        body: JSON.stringify({
          lead_id: selectedLead.id,
          type: newType,
          subject: newSubject.trim() || undefined,
        }),
      });
      const conv = json.data ?? json;
      setCreateOpen(false);
      setNewSubject('');
      setNewType('direct');
      setSelectedLead(null);
      setLeadSearch('');
      setActiveConversationId(conv.id);
      loadConversations();
    } catch (err) {
      console.error('Create conversation failed:', err);
    } finally {
      setCreating(false);
    }
  };

  return (
    <Box className="chat-page-container">
      {/* Left sidebar – conversation list */}
      <Box
        className={`chat-page-sidebar${activeConversationId ? ' chat-page-sidebar--hidden-mobile' : ''}`}
        sx={{
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {/* Header */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, px: 2, py: 1.5, flexShrink: 0 }}>
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
        </Box>

        {/* Search */}
        <Box sx={{ px: 2, py: 1 }}>
          <TextField
            fullWidth
            size="small"
            placeholder="Suchen..."
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
          {TABS.map((t, i) => <Tab key={i} label={t.label} />)}
        </Tabs>

        <Divider />

        {/* List */}
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
              />
            ))
          )}
        </Box>
      </Box>

      {/* Right panel – chat window or empty state */}
      <Box className="chat-page-content">
        {activeConversationId ? (
          <ChatWindow
            conversationId={activeConversationId}
            currentUserEmail={currentUserEmail}
            onBack={() => {
              setActiveConversationId(null);
              loadConversations();
            }}
          />
        ) : (
          <div className="chat-empty-state">
            <ChatIcon className="chat-empty-state-icon" />
            <Typography variant="body1" color="text.secondary">
              Konversation auswählen oder neue erstellen
            </Typography>
          </div>
        )}
      </Box>

      {/* Create dialog */}
      <Dialog open={createOpen} onClose={() => setCreateOpen(false)} fullWidth maxWidth="xs">
        <DialogTitle>Neue Konversation</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
            <Autocomplete
              options={leadOptions}
              value={selectedLead}
              onChange={(_e, val) => setSelectedLead(val)}
              inputValue={leadSearch}
              onInputChange={(_e, val) => setLeadSearch(val)}
              loading={leadLoading}
              isOptionEqualToValue={(opt, val) => opt.id === val?.id}
              getOptionLabel={(opt) => opt.label || ''}
              noOptionsText={leadSearch.length < 2 ? 'Mindestens 2 Zeichen eingeben' : 'Keine Leads gefunden'}
              renderInput={(params) => (
                <TextField
                  {...params}
                  label="Lead *"
                  placeholder="Lead suchen (Name oder E-Mail)"
                  size="small"
                  required
                />
              )}
              size="small"
            />
            <TextField
              label="Betreff (optional)"
              value={newSubject}
              onChange={(e) => setNewSubject(e.target.value)}
              fullWidth
              size="small"
            />
            <Select value={newType} onChange={(e) => setNewType(e.target.value)} fullWidth size="small">
              <MenuItem value="direct">Direkt</MenuItem>
              <MenuItem value="internal">Intern</MenuItem>
              <MenuItem value="group">Gruppe</MenuItem>
            </Select>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCreateOpen(false)} disabled={creating}>Abbrechen</Button>
          <Button variant="contained" onClick={handleCreate} disabled={creating || !selectedLead}>
            {creating ? 'Erstellen...' : 'Erstellen'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

export default ChatPage;
