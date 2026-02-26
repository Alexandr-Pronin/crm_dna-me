/**
 * MessageStatusIcon
 *
 * Displays a status indicator for outbound messages:
 *  - sending  → spinning indicator
 *  - sent     → green check
 *  - error    → red X with tooltip and optional retry
 *  - draft    → grey pencil
 */
import { CircularProgress, Tooltip, IconButton, Box } from '@mui/material';
import {
  Check as CheckIcon,
  ErrorOutline as ErrorIcon,
  Edit as DraftIcon,
  Replay as RetryIcon,
} from '@mui/icons-material';

function MessageStatusIcon({ status, errorMessage, onRetry }) {
  switch (status) {
    case 'sending':
      return (
        <Box component="span" className="message-status-sending" sx={{ display: 'inline-flex', alignItems: 'center' }}>
          <CircularProgress size={14} thickness={5} sx={{ color: 'inherit' }} />
        </Box>
      );

    case 'sent':
      return (
        <Tooltip title="Gesendet">
          <CheckIcon className="message-status-sent" sx={{ fontSize: 16 }} />
        </Tooltip>
      );

    case 'error':
      return (
        <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.25 }}>
          <Tooltip title={errorMessage || 'Senden fehlgeschlagen'}>
            <ErrorIcon className="message-status-error" sx={{ fontSize: 16 }} />
          </Tooltip>
          {onRetry && (
            <Tooltip title="Erneut senden">
              <IconButton size="small" onClick={onRetry} className="message-retry-button" sx={{ p: 0.25 }}>
                <RetryIcon sx={{ fontSize: 14, color: 'inherit' }} />
              </IconButton>
            </Tooltip>
          )}
        </Box>
      );

    case 'draft':
      return (
        <Tooltip title="Entwurf">
          <DraftIcon sx={{ fontSize: 14, color: '#98a2b3' }} />
        </Tooltip>
      );

    default:
      return null;
  }
}

export default MessageStatusIcon;
