/**
 * MessageList
 *
 * Renders a chronological list of messages grouped by date.
 * Supports email, linkedin, internal_note, and task types.
 * Shows sender info, message content, status icons, and timestamps.
 */
import { useEffect, useRef } from 'react';
import { Box, Typography, Chip, Avatar, Tooltip } from '@mui/material';
import {
  Email as EmailIcon,
  LinkedIn as LinkedInIcon,
  StickyNote2 as NoteIcon,
  Task as TaskIcon,
  CallReceived as InboundIcon,
  CallMade as OutboundIcon,
} from '@mui/icons-material';
import MessageStatusIcon from './MessageStatusIcon';
import { format, parseISO, isValid, isToday, isYesterday } from 'date-fns';
import { de } from 'date-fns/locale';

const TYPE_CONFIG = {
  email: { icon: EmailIcon, color: '#4A90A4', label: 'E-Mail' },
  linkedin: { icon: LinkedInIcon, color: '#0A66C2', label: 'LinkedIn' },
  internal_note: { icon: NoteIcon, color: '#F59E0B', label: 'Notiz' },
  task: { icon: TaskIcon, color: '#6C5CE7', label: 'Aufgabe' },
};

function formatDate(value) {
  if (!value) return '';
  const d = typeof value === 'string' ? parseISO(value) : new Date(value);
  if (!isValid(d)) return '';
  return format(d, 'HH:mm', { locale: de });
}

function formatDateGroup(value) {
  if (!value) return '';
  const d = typeof value === 'string' ? parseISO(value) : new Date(value);
  if (!isValid(d)) return '';
  if (isToday(d)) return 'Heute';
  if (isYesterday(d)) return 'Gestern';
  return format(d, 'dd. MMMM yyyy', { locale: de });
}

function dateKey(value) {
  if (!value) return 'unknown';
  const d = typeof value === 'string' ? parseISO(value) : new Date(value);
  if (!isValid(d)) return 'unknown';
  return format(d, 'yyyy-MM-dd');
}

function groupByDate(messages) {
  const groups = {};
  for (const msg of messages) {
    const key = dateKey(msg.sent_at ?? msg.created_at);
    if (!groups[key]) {
      groups[key] = { label: formatDateGroup(msg.sent_at ?? msg.created_at), messages: [] };
    }
    groups[key].messages.push(msg);
  }
  return Object.values(groups);
}

function senderName(msg) {
  return msg.sender_member_name || msg.sender_name || msg.sender_email || 'System';
}

function initials(name) {
  if (!name) return '?';
  return name.split(' ').slice(0, 2).map((w) => w[0]?.toUpperCase()).join('');
}

function stripHtml(html) {
  if (!html) return '';
  return html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
}

function MessageBubble({ msg, isOwn, currentUserEmail, onRetry }) {
  const config = TYPE_CONFIG[msg.message_type] || TYPE_CONFIG.email;
  const TypeIcon = config.icon;
  const isInternal = msg.direction === 'internal';

  const bubbleClassName = [
    'chat-message-bubble',
    isInternal
      ? 'chat-message-bubble--internal'
      : isOwn
        ? 'chat-message-bubble--outbound'
        : 'chat-message-bubble--inbound',
    msg.message_type === 'linkedin' && 'chat-message-bubble--linkedin',
  ].filter(Boolean).join(' ');

  return (
    <Box
      className="chat-message-enter"
      sx={{
        display: 'flex',
        flexDirection: isOwn ? 'row-reverse' : 'row',
        gap: 1,
        mb: 1.5,
        maxWidth: '85%',
        alignSelf: isOwn ? 'flex-end' : 'flex-start',
      }}
    >
      {/* Avatar */}
      <Avatar
        src={msg.sender_avatar}
        className="chat-message-avatar"
        sx={{
          width: 32,
          height: 32,
          bgcolor: isOwn ? 'primary.dark' : 'rgba(255,255,255,0.08)',
          fontSize: 12,
          flexShrink: 0,
          mt: 0.5,
        }}
      >
        {!msg.sender_avatar ? initials(senderName(msg)) : null}
      </Avatar>

      {/* Content */}
      <Box sx={{ minWidth: 0, maxWidth: '100%' }}>
        {/* Header */}
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 0.75,
            mb: 0.25,
            flexDirection: isOwn ? 'row-reverse' : 'row',
          }}
        >
          <Typography variant="caption" sx={{ fontWeight: 600, color: 'text.primary' }}>
            {senderName(msg)}
          </Typography>
          <span className={`chat-type-badge chat-type-badge--${msg.message_type}`}>
            <TypeIcon sx={{ fontSize: 12 }} />
            {config.label}
          </span>
          {msg.direction === 'inbound' && (
            <InboundIcon sx={{ fontSize: 12, color: '#4A90A4' }} />
          )}
          {msg.direction === 'outbound' && (
            <OutboundIcon sx={{ fontSize: 12, color: '#6C5CE7' }} />
          )}
          <Typography variant="caption" color="text.disabled" sx={{ fontSize: '0.7rem' }}>
            {formatDate(msg.sent_at ?? msg.created_at)}
          </Typography>
        </Box>

        {/* Subject (email) */}
        {msg.subject && msg.message_type === 'email' && (
          <Typography variant="caption" sx={{ display: 'block', fontWeight: 600, mb: 0.5, color: 'text.secondary' }}>
            {msg.subject}
          </Typography>
        )}

        {/* Body */}
        <Box
          className={bubbleClassName}
          sx={{ p: 1.5, wordBreak: 'break-word' }}
        >
          {msg.body_html ? (
            <Typography
              variant="body2"
              component="div"
              className="chat-message-body"
              dangerouslySetInnerHTML={{ __html: msg.body_html }}
              sx={{
                color: 'text.primary',
                lineHeight: 1.6,
                fontSize: '0.8125rem',
              }}
            />
          ) : (
            <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap', lineHeight: 1.6, fontSize: '0.8125rem' }}>
              {msg.body_text || '(Kein Inhalt)'}
            </Typography>
          )}

          {/* Attachments */}
          {Array.isArray(msg.attachments) && msg.attachments.length > 0 && (
            <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap', mt: 1 }}>
              {msg.attachments.map((att, i) => (
                <Chip
                  key={i}
                  label={att.filename || 'Anhang'}
                  size="small"
                  variant="outlined"
                  className="chat-attachment-chip"
                  sx={{ height: 22, fontSize: 11 }}
                  onClick={att.url ? () => window.open(att.url, '_blank') : undefined}
                />
              ))}
            </Box>
          )}
        </Box>

        {/* Status row for outbound */}
        {msg.direction === 'outbound' && (
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: isOwn ? 'flex-end' : 'flex-start',
              gap: 0.5,
              mt: 0.25,
              px: 0.5,
            }}
          >
            <MessageStatusIcon
              status={msg.status}
              errorMessage={msg.error_message}
              onRetry={
                msg.status === 'error' && onRetry
                  ? () => onRetry(msg.id)
                  : undefined
              }
            />
          </Box>
        )}
      </Box>
    </Box>
  );
}

function MessageList({ messages = [], currentUserEmail, onRetry }) {
  const endRef = useRef(null);
  const containerRef = useRef(null);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    if (endRef.current) {
      endRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages.length]);

  const groups = groupByDate(messages);

  if (messages.length === 0) {
    return (
      <Box sx={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', p: 4 }}>
        <Typography variant="body2" color="text.secondary">
          Noch keine Nachrichten. Starten Sie die Konversation!
        </Typography>
      </Box>
    );
  }

  return (
    <Box
      ref={containerRef}
      sx={{
        flex: 1,
        overflowY: 'auto',
        px: 2,
        py: 1,
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {groups.map((group, gi) => (
        <Box key={gi}>
          {/* Date separator */}
          <div className="chat-date-separator">
            <span className="chat-date-label">{group.label}</span>
          </div>

          {/* Messages in this date group */}
          <Box sx={{ display: 'flex', flexDirection: 'column' }}>
            {group.messages.map((msg) => {
              const isOwn =
                msg.direction === 'outbound' ||
                (currentUserEmail && msg.sender_email === currentUserEmail);

              return (
                <MessageBubble
                  key={msg.id}
                  msg={msg}
                  isOwn={isOwn}
                  currentUserEmail={currentUserEmail}
                  onRetry={onRetry}
                />
              );
            })}
          </Box>
        </Box>
      ))}

      <div ref={endRef} />
    </Box>
  );
}

export default MessageList;
