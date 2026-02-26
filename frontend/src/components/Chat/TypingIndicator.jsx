/**
 * TypingIndicator
 *
 * Shows an animated "X tippt..." indicator when other users
 * are actively typing in the current conversation.
 */
import { Typography } from '@mui/material';

function TypingIndicator({ typingUsers = [] }) {
  if (typingUsers.length === 0) return null;

  const names = typingUsers.slice(0, 2).map((u) => u.name);
  let text;
  if (typingUsers.length === 1) {
    text = `${names[0]} tippt`;
  } else if (typingUsers.length === 2) {
    text = `${names[0]} und ${names[1]} tippen`;
  } else {
    text = `${names.join(', ')} und ${typingUsers.length - 2} weitere tippen`;
  }

  return (
    <div className="chat-typing-indicator">
      <div className="chat-typing-dots">
        <span className="chat-typing-dot" />
        <span className="chat-typing-dot" />
        <span className="chat-typing-dot" />
      </div>

      <Typography variant="caption" color="text.secondary" noWrap>
        {text}...
      </Typography>
    </div>
  );
}

export default TypingIndicator;
