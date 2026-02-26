/**
 * useConversationSSE
 *
 * Dedicated Server-Sent Events hook for real-time conversation updates.
 * Connects to the SSE stream endpoint with proper authentication via
 * query parameters (EventSource cannot send custom headers).
 *
 * Features:
 *  - Automatic reconnection with exponential backoff
 *  - Typing indicator events received through the same stream
 *  - Connection status tracking (connecting, connected, reconnecting, error)
 *  - Graceful cleanup on unmount / conversation change
 */
import { useState, useEffect, useRef, useCallback } from 'react';
import { API_URL, API_KEY } from '../providers/dataProvider';

const RECONNECT_MIN_MS = 1000;
const RECONNECT_MAX_MS = 30000;
const TYPING_TTL_MS = 3500;
const MAX_RECONNECT_ATTEMPTS = 20;

/**
 * Build the authenticated SSE URL.
 * Injects JWT token and API key as query parameters.
 */
function buildSSEUrl(conversationId) {
  const params = new URLSearchParams();
  const token = localStorage.getItem('auth_token');
  if (token) params.set('token', token);
  if (API_KEY) params.set('api_key', API_KEY);
  return `${API_URL}/conversations/${conversationId}/messages/stream?${params}`;
}

/**
 * @param {string|null} conversationId
 * @returns {{
 *   messages: Array,
 *   typingUsers: Array<{userId: string, name: string}>,
 *   connectionStatus: 'idle'|'connecting'|'connected'|'reconnecting'|'error'|'closed',
 *   appendMessage: Function,
 *   clearMessages: Function,
 * }}
 */
export function useConversationSSE(conversationId) {
  const [messages, setMessages] = useState([]);
  const [typingUsers, setTypingUsers] = useState([]);
  const [connectionStatus, setConnectionStatus] = useState('idle');

  const eventSourceRef = useRef(null);
  const reconnectTimerRef = useRef(null);
  const reconnectDelayRef = useRef(RECONNECT_MIN_MS);
  const reconnectAttemptsRef = useRef(0);
  const typingTimersRef = useRef(new Map());

  // -- Helpers ----------------------------------------------------------------

  const appendMessage = useCallback((msg) => {
    setMessages((prev) => {
      if (prev.some((m) => m.id === msg.id)) return prev;
      return [...prev, msg];
    });
  }, []);

  const clearMessages = useCallback(() => {
    setMessages([]);
  }, []);

  /** Clear a typing user after TTL */
  const scheduleTypingClear = useCallback((userId) => {
    const existing = typingTimersRef.current.get(userId);
    if (existing) clearTimeout(existing);

    const timer = setTimeout(() => {
      setTypingUsers((prev) => prev.filter((u) => u.userId !== userId));
      typingTimersRef.current.delete(userId);
    }, TYPING_TTL_MS);

    typingTimersRef.current.set(userId, timer);
  }, []);

  // -- Main SSE Effect --------------------------------------------------------

  useEffect(() => {
    if (!conversationId) {
      setConnectionStatus('idle');
      setMessages([]);
      setTypingUsers([]);
      return;
    }

    let cancelled = false;

    function connect() {
      if (cancelled) return;

      const isReconnect = reconnectAttemptsRef.current > 0;
      setConnectionStatus(isReconnect ? 'reconnecting' : 'connecting');

      const url = buildSSEUrl(conversationId);
      let es;

      try {
        es = new EventSource(url);
        eventSourceRef.current = es;
      } catch {
        // EventSource constructor failed (e.g. unsupported environment)
        setConnectionStatus('error');
        return;
      }

      // -- connected event from server ----------------------------------------
      es.addEventListener('connected', () => {
        if (cancelled) return;
        setConnectionStatus('connected');
        reconnectDelayRef.current = RECONNECT_MIN_MS;
        reconnectAttemptsRef.current = 0;
      });

      // -- new message event --------------------------------------------------
      es.addEventListener('message', (e) => {
        if (cancelled) return;
        try {
          const payload = JSON.parse(e.data);
          const msg = payload.message ?? payload;
          if (msg && msg.id) {
            appendMessage(msg);
          }
        } catch {
          // ignore malformed data
        }
      });

      // -- typing event -------------------------------------------------------
      es.addEventListener('typing', (e) => {
        if (cancelled) return;
        try {
          const data = JSON.parse(e.data);
          if (!data.userId) return;

          setTypingUsers((prev) => {
            const without = prev.filter((u) => u.userId !== data.userId);
            if (data.typing !== false) {
              without.push({ userId: data.userId, name: data.name });
            }
            return without;
          });

          scheduleTypingClear(data.userId);
        } catch {
          // ignore
        }
      });

      // -- status event (conversation updates) --------------------------------
      es.addEventListener('status', (e) => {
        if (cancelled) return;
        // Forward status changes – consumers can handle as needed
        try {
          const data = JSON.parse(e.data);
          if (data.type === 'message_status_update' && data.message) {
            setMessages((prev) =>
              prev.map((m) => (m.id === data.message.id ? { ...m, ...data.message } : m))
            );
          }
        } catch {
          // ignore
        }
      });

      // -- fallback event (Redis unavailable on server) -----------------------
      es.addEventListener('fallback', () => {
        if (cancelled) return;
        // Server can't do Pub/Sub; keep heartbeat-only connection open
        // but signal consumers that polling may be needed alongside SSE
        setConnectionStatus('connected');
      });

      // -- error / disconnect -------------------------------------------------
      es.onerror = () => {
        if (cancelled) return;
        es.close();
        eventSourceRef.current = null;

        reconnectAttemptsRef.current += 1;

        if (reconnectAttemptsRef.current > MAX_RECONNECT_ATTEMPTS) {
          setConnectionStatus('error');
          return;
        }

        setConnectionStatus('reconnecting');

        const delay = reconnectDelayRef.current;
        reconnectDelayRef.current = Math.min(delay * 2, RECONNECT_MAX_MS);

        reconnectTimerRef.current = setTimeout(() => {
          if (!cancelled) connect();
        }, delay);
      };
    }

    connect();

    // -- Cleanup --------------------------------------------------------------
    return () => {
      cancelled = true;

      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = null;
      }

      // Clear all typing timers
      for (const timer of typingTimersRef.current.values()) {
        clearTimeout(timer);
      }
      typingTimersRef.current.clear();

      reconnectDelayRef.current = RECONNECT_MIN_MS;
      reconnectAttemptsRef.current = 0;
    };
  }, [conversationId, appendMessage, scheduleTypingClear]);

  return { messages, typingUsers, connectionStatus, appendMessage, clearMessages };
}

export default useConversationSSE;
