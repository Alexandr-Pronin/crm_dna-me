/**
 * useConversationPolling
 *
 * Primary real-time messaging hook.  Strategy (in order of preference):
 *
 *   1. **SSE** (Server-Sent Events) via the /messages/stream endpoint
 *      – Authentication via query-parameters (EventSource limitation)
 *      – Receives both `message` and `typing` events in one stream
 *      – Auto-reconnect with exponential backoff
 *
 *   2. **Shared Worker polling** (multi-tab optimised)
 *      – Only one fetch per interval across all tabs
 *      – Falls back automatically when SSE is unavailable
 *
 *   3. **Regular interval polling** (ultimate fallback)
 *      – For environments where SharedWorker is unsupported
 *
 * Returns `typingUsers` alongside messages so that consumers don't
 * need a separate `useTypingIndicator` call when SSE is active.
 */
import { useState, useEffect, useRef, useCallback } from 'react';
import { API_URL, API_KEY, httpClient } from '../providers/dataProvider';

// ---------------------------------------------------------------------------
// Configuration constants
// ---------------------------------------------------------------------------
const POLL_INTERVAL_MS = 5000;
const TYPING_POLL_INTERVAL_MS = 2500;
const SSE_RECONNECT_MIN_MS = 1000;
const SSE_RECONNECT_MAX_MS = 30000;
const SSE_MAX_RECONNECT_ATTEMPTS = 15;
const TYPING_TTL_MS = 3500;

// ---------------------------------------------------------------------------
// Helper: build authenticated SSE URL
// ---------------------------------------------------------------------------
function buildSSEUrl(conversationId) {
  const params = new URLSearchParams();
  const token = localStorage.getItem('auth_token');
  if (token) params.set('token', token);
  if (API_KEY) params.set('api_key', API_KEY);
  return `${API_URL}/conversations/${conversationId}/messages/stream?${params}`;
}

// ---------------------------------------------------------------------------
// useConversationPolling
// ---------------------------------------------------------------------------

/**
 * @param {string|null} conversationId
 * @returns {{
 *   messages: Array,
 *   typingUsers: Array<{userId: string, name: string}>,
 *   connectionStatus: 'idle'|'connecting'|'connected'|'reconnecting'|'polling'|'error',
 *   appendMessage: (msg: object) => void,
 *   clearMessages: () => void,
 * }}
 */
export function useConversationPolling(conversationId) {
  const [messages, setMessages] = useState([]);
  const [typingUsers, setTypingUsers] = useState([]);
  const [connectionStatus, setConnectionStatus] = useState('idle');

  // Refs for cleanup
  const eventSourceRef = useRef(null);
  const reconnectTimerRef = useRef(null);
  const reconnectDelayRef = useRef(SSE_RECONNECT_MIN_MS);
  const reconnectAttemptsRef = useRef(0);
  const pollTimerRef = useRef(null);
  const typingPollTimerRef = useRef(null);
  const workerRef = useRef(null);
  const lastFetchRef = useRef(null);
  const typingTimersRef = useRef(new Map());
  const sseGaveUpRef = useRef(false);

  // -- Stable callbacks -------------------------------------------------------

  const appendMessage = useCallback((msg) => {
    setMessages((prev) => {
      const idx = prev.findIndex((m) => m.id === msg.id);
      if (idx >= 0) {
        // Update existing message (e.g. status change: draft → sent / error)
        const updated = [...prev];
        updated[idx] = { ...prev[idx], ...msg };
        return updated;
      }
      return [...prev, msg];
    });
  }, []);

  const clearMessages = useCallback(() => {
    setMessages([]);
    lastFetchRef.current = null;
  }, []);

  const scheduleTypingClear = useCallback((userId) => {
    const existing = typingTimersRef.current.get(userId);
    if (existing) clearTimeout(existing);
    const timer = setTimeout(() => {
      setTypingUsers((prev) => prev.filter((u) => u.userId !== userId));
      typingTimersRef.current.delete(userId);
    }, TYPING_TTL_MS);
    typingTimersRef.current.set(userId, timer);
  }, []);

  // -- Main effect ------------------------------------------------------------

  useEffect(() => {
    if (!conversationId) {
      setConnectionStatus('idle');
      setMessages([]);
      setTypingUsers([]);
      return;
    }

    // Clear messages when switching to another conversation so the previous
    // conversation’s messages (e.g. a note we just sent) don’t appear in the new one.
    setMessages([]);
    lastFetchRef.current = null;
    setTypingUsers([]);

    let cancelled = false;
    sseGaveUpRef.current = false;

    // =====================================================================
    // SSE STRATEGY
    // =====================================================================
    function connectSSE() {
      if (cancelled || sseGaveUpRef.current) {
        startPolling();
        return;
      }

      const isReconnect = reconnectAttemptsRef.current > 0;
      setConnectionStatus(isReconnect ? 'reconnecting' : 'connecting');

      let es;
      try {
        es = new EventSource(buildSSEUrl(conversationId));
        eventSourceRef.current = es;
      } catch {
        sseGaveUpRef.current = true;
        startPolling();
        return;
      }

      // Connection timeout – if no "connected" event within 10s, fall to polling
      const openTimeout = setTimeout(() => {
        if (cancelled) return;
        if (eventSourceRef.current === es && connectionStatus !== 'connected') {
          es.close();
          eventSourceRef.current = null;
          sseGaveUpRef.current = true;
          startPolling();
        }
      }, 10_000);

      // -- Server confirmed connection ----------------------------------------
      es.addEventListener('connected', () => {
        clearTimeout(openTimeout);
        if (cancelled) return;
        setConnectionStatus('connected');
        reconnectDelayRef.current = SSE_RECONNECT_MIN_MS;
        reconnectAttemptsRef.current = 0;
      });

      // -- New message --------------------------------------------------------
      es.addEventListener('message', (e) => {
        if (cancelled) return;
        try {
          const payload = JSON.parse(e.data);
          const msg = payload.message ?? payload;
          if (msg && msg.id) appendMessage(msg);
        } catch { /* ignore */ }
      });

      // -- Typing event -------------------------------------------------------
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
        } catch { /* ignore */ }
      });

      // -- Status changes (message delivery updates) --------------------------
      es.addEventListener('status', (e) => {
        if (cancelled) return;
        try {
          const data = JSON.parse(e.data);
          if (data.type === 'message_status_update' && data.message) {
            setMessages((prev) =>
              prev.map((m) =>
                m.id === data.message.id ? { ...m, ...data.message } : m
              )
            );
          }
        } catch { /* ignore */ }
      });

      // -- Fallback (Redis unavailable on server) -----------------------------
      es.addEventListener('fallback', () => {
        clearTimeout(openTimeout);
        if (cancelled) return;
        // Keep SSE open for heartbeats, but activate polling alongside
        setConnectionStatus('connected');
        startPollingAlongside();
      });

      // -- Error / disconnect -------------------------------------------------
      es.onerror = () => {
        clearTimeout(openTimeout);
        if (cancelled) return;
        es.close();
        eventSourceRef.current = null;

        reconnectAttemptsRef.current += 1;

        if (reconnectAttemptsRef.current > SSE_MAX_RECONNECT_ATTEMPTS) {
          sseGaveUpRef.current = true;
          startPolling();
          return;
        }

        setConnectionStatus('reconnecting');
        const delay = reconnectDelayRef.current;
        reconnectDelayRef.current = Math.min(delay * 2, SSE_RECONNECT_MAX_MS);

        reconnectTimerRef.current = setTimeout(() => {
          if (!cancelled) connectSSE();
        }, delay);
      };
    }

    // =====================================================================
    // POLLING STRATEGY (Shared Worker → regular interval fallback)
    // =====================================================================
    function startPolling() {
      if (cancelled) return;
      setConnectionStatus('polling');
      activatePolling();
      activateTypingPolling();
    }

    /** Start polling alongside SSE (when Redis Pub/Sub is unavailable) */
    function startPollingAlongside() {
      if (cancelled) return;
      activatePolling();
      // Typing polling not needed – heartbeat SSE still works
    }

    function activatePolling() {
      if (cancelled || pollTimerRef.current) return;

      // --- Try Shared Worker first -------------------------------------------
      if (typeof SharedWorker !== 'undefined') {
        try {
          const worker = new SharedWorker('/polling-worker.js');
          workerRef.current = worker;
          worker.port.start();

          worker.port.onmessage = (e) => {
            if (cancelled) return;
            const { conversationId: cId, newMessages, error: _err } = e.data || {};
            if (cId !== conversationId || !Array.isArray(newMessages)) return;

            setMessages((prev) => {
              const idMap = new Map(prev.map((m) => [m.id, m]));
              let changed = false;
              for (const msg of newMessages) {
                const existing = idMap.get(msg.id);
                if (!existing) {
                  idMap.set(msg.id, msg);
                  changed = true;
                } else if (existing.status !== msg.status || existing.updated_at !== msg.updated_at) {
                  idMap.set(msg.id, { ...existing, ...msg });
                  changed = true;
                }
              }
              if (!changed) return prev;

              const allMsgs = Array.from(idMap.values());
              const newest = newMessages[newMessages.length - 1];
              lastFetchRef.current = newest.created_at ?? new Date().toISOString();
              return allMsgs;
            });
          };

          worker.port.postMessage({
            action: 'subscribe',
            conversationId,
            interval: POLL_INTERVAL_MS,
            apiUrl: API_URL,
            apiKey: API_KEY,
            token: localStorage.getItem('auth_token'),
          });

          return; // Shared Worker handles polling
        } catch {
          workerRef.current = null;
          // SharedWorker failed, fall through to regular polling
        }
      }

      // --- Regular polling fallback ------------------------------------------
      const poll = async () => {
        if (cancelled) return;
        try {
          const params = lastFetchRef.current
            ? `?since=${encodeURIComponent(lastFetchRef.current)}`
            : '';
          const { json } = await httpClient(
            `${API_URL}/conversations/${conversationId}/messages${params}`
          );
          const incoming = json.data ?? json;
          if (Array.isArray(incoming) && incoming.length > 0) {
            setMessages((prev) => {
              const idMap = new Map(prev.map((m) => [m.id, m]));
              let changed = false;
              for (const msg of incoming) {
                const existing = idMap.get(msg.id);
                if (!existing) {
                  idMap.set(msg.id, msg);
                  changed = true;
                } else if (existing.status !== msg.status || existing.updated_at !== msg.updated_at) {
                  idMap.set(msg.id, { ...existing, ...msg });
                  changed = true;
                }
              }
              if (!changed) return prev;
              return Array.from(idMap.values());
            });
            const newest = incoming[incoming.length - 1];
            lastFetchRef.current = newest.created_at ?? new Date().toISOString();
          }
        } catch {
          // Silently ignore polling errors
        }
      };

      poll();
      pollTimerRef.current = setInterval(poll, POLL_INTERVAL_MS);
    }

    function activateTypingPolling() {
      if (cancelled || typingPollTimerRef.current) return;

      const pollTyping = async () => {
        if (cancelled) return;
        try {
          const { json } = await httpClient(
            `${API_URL}/conversations/${conversationId}/typing`
          );
          if (!cancelled) {
            setTypingUsers(Array.isArray(json) ? json : []);
          }
        } catch {
          if (!cancelled) setTypingUsers([]);
        }
      };

      pollTyping();
      typingPollTimerRef.current = setInterval(pollTyping, TYPING_POLL_INTERVAL_MS);
    }

    // =====================================================================
    // CONNECT
    // =====================================================================
    connectSSE();

    // =====================================================================
    // CLEANUP
    // =====================================================================
    return () => {
      cancelled = true;

      // Close SSE
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = null;
      }

      // Stop polling
      if (pollTimerRef.current) {
        clearInterval(pollTimerRef.current);
        pollTimerRef.current = null;
      }
      if (typingPollTimerRef.current) {
        clearInterval(typingPollTimerRef.current);
        typingPollTimerRef.current = null;
      }

      // Unsubscribe Shared Worker
      if (workerRef.current) {
        try {
          workerRef.current.port.postMessage({
            action: 'unsubscribe',
            conversationId,
          });
        } catch { /* ignore */ }
        workerRef.current = null;
      }

      // Clear typing timers
      for (const timer of typingTimersRef.current.values()) {
        clearTimeout(timer);
      }
      typingTimersRef.current.clear();

      // Reset reconnect state
      reconnectDelayRef.current = SSE_RECONNECT_MIN_MS;
      reconnectAttemptsRef.current = 0;
    };
  }, [conversationId, appendMessage, scheduleTypingClear]);

  return { messages, typingUsers, connectionStatus, appendMessage, clearMessages };
}

// ---------------------------------------------------------------------------
// useTypingIndicator – standalone typing indicator hook (polling-based)
//
// Kept for backwards compatibility.  When using useConversationPolling the
// typing data is already included via SSE events, making this unnecessary.
// ---------------------------------------------------------------------------

/**
 * @param {string|null} conversationId
 * @param {number} interval – poll interval in ms (default 2500)
 * @returns {Array<{userId: string, name: string}>}
 */
export function useTypingIndicator(conversationId, interval = 2500) {
  const [typingUsers, setTypingUsers] = useState([]);

  useEffect(() => {
    if (!conversationId) {
      setTypingUsers([]);
      return;
    }

    let cancelled = false;

    const poll = async () => {
      if (cancelled) return;
      try {
        const { json } = await httpClient(
          `${API_URL}/conversations/${conversationId}/typing`
        );
        if (!cancelled) setTypingUsers(Array.isArray(json) ? json : []);
      } catch {
        if (!cancelled) setTypingUsers([]);
      }
    };

    poll();
    const timer = setInterval(poll, interval);

    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [conversationId, interval]);

  return typingUsers;
}

export default useConversationPolling;
