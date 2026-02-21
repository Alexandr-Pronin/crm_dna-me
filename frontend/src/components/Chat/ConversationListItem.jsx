/**
 * ConversationListItem
 *
 * Single row inside the conversation sidebar list.
 * Shows avatar, name, last message preview, time, and unread badge.
 */
import { Box, Typography, Badge, Avatar, Chip } from '@mui/material';
import {
  Email as EmailIcon,
  LinkedIn as LinkedInIcon,
  StickyNote2 as NoteIcon,
  Task as TaskIcon,
  Warning as LeadInitiatedIcon,
} from '@mui/icons-material';
import { formatDistanceToNow, parseISO, isValid } from 'date-fns';
import { de } from 'date-fns/locale';

const TYPE_ICONS = {
  email: EmailIcon,
  linkedin: LinkedInIcon,
  internal_note: NoteIcon,
  task: TaskIcon,
};

const TYPE_COLORS = {
  email: '#4A90A4',
  linkedin: '#0A66C2',
  internal_note: '#F59E0B',
  task: '#6C5CE7',
};

function relativeTime(value) {
  if (!value) return '';
  const d = typeof value === 'string' ? parseISO(value) : new Date(value);
  if (!isValid(d)) return '';
  return formatDistanceToNow(d, { addSuffix: false, locale: de });
}

function initials(name) {
  if (!name) return '?';
  return name
    .split(' ')
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join('');
}

function ConversationListItem({ conversation, onClick, isActive }) {
  const {
    subject,
    lead_name,
    deal_name,
    last_message_at,
    last_message_preview,
    unread_count = 0,
    type: convType,
    status,
    created_by_avatar,
    created_by_name,
    initiated_by_lead,
  } = conversation;

  const displayName = subject || deal_name || lead_name || 'Konversation';
  const avatarName = created_by_name || displayName;
  const preview = last_message_preview
    ? last_message_preview.replace(/<[^>]*>/g, '').slice(0, 80)
    : 'Keine Nachrichten';

  const itemClassName = [
    'chat-conversation-item',
    isActive && 'chat-conversation-item--active',
    unread_count > 0 && 'chat-conversation-item--unread',
  ].filter(Boolean).join(' ');

  return (
    <Box
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === 'Enter' && onClick?.()}
      className={itemClassName}
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 1.5,
        px: 1.5,
        py: 1.25,
        borderRadius: 2,
        cursor: 'pointer',
        bgcolor: isActive
          ? 'rgba(74, 144, 164, 0.12)'
          : 'transparent',
        borderLeft: '3px solid',
        borderColor: isActive ? 'primary.main' : 'transparent',
      }}
    >
      {/* Avatar: red circle + ! for lead-initiated chats, else creator avatar */}
      <Badge
        badgeContent={unread_count}
        color="primary"
        overlap="circular"
        invisible={unread_count === 0}
        sx={{ '& .MuiBadge-badge': { fontSize: 10, minWidth: 18, height: 18 } }}
      >
        {initiated_by_lead ? (
          <Box
            sx={{
              width: 40,
              height: 40,
              borderRadius: '50%',
              bgcolor: 'error.main',
              color: 'error.contrastText',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
            title="Chat vom Lead gestartet"
          >
            <LeadInitiatedIcon sx={{ fontSize: 22 }} />
          </Box>
        ) : (
          <Avatar
            src={created_by_avatar}
            sx={{
              width: 40,
              height: 40,
              bgcolor: isActive ? 'primary.dark' : 'rgba(255,255,255,0.08)',
              fontSize: 14,
              fontWeight: 600,
            }}
          >
            {!created_by_avatar ? initials(avatarName) : null}
          </Avatar>
        )}
      </Badge>

      {/* Text content */}
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Typography
            variant="body2"
            noWrap
            sx={{
              fontWeight: unread_count > 0 ? 700 : 500,
              color: unread_count > 0 ? 'text.primary' : 'text.secondary',
              flex: 1,
            }}
          >
            {displayName}
          </Typography>
          <Typography variant="caption" color="text.disabled" sx={{ ml: 1, flexShrink: 0 }}>
            {relativeTime(last_message_at)}
          </Typography>
        </Box>

        <Typography
          variant="caption"
          color="text.disabled"
          noWrap
          sx={{ display: 'block', mt: 0.25 }}
        >
          {preview}
        </Typography>

        {/* Status chips */}
        <Box sx={{ display: 'flex', gap: 0.5, mt: 0.5 }}>
          {status === 'archived' && (
            <Chip label="Archiviert" size="small" sx={{ height: 18, fontSize: 10 }} />
          )}
          {status === 'closed' && (
            <Chip label="Geschlossen" size="small" color="error" sx={{ height: 18, fontSize: 10 }} />
          )}
          {convType === 'internal' && (
            <Chip label="Intern" size="small" color="warning" sx={{ height: 18, fontSize: 10 }} />
          )}
        </Box>
      </Box>
    </Box>
  );
}

export default ConversationListItem;
