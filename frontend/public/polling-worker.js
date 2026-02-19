/**
 * polling-worker.js – Shared Worker for optimised message polling
 *
 * When multiple browser tabs are open for the same conversation,
 * only ONE fetch request is made per interval.  The result is
 * broadcast to every connected tab, reducing server load and
 * avoiding duplicate network traffic.
 *
 * Communication protocol (port.postMessage):
 *
 *   Tab → Worker:
 *     { action: 'subscribe',   conversationId, interval, apiUrl, apiKey, token }
 *     { action: 'unsubscribe', conversationId }
 *
 *   Worker → Tab:
 *     { conversationId, newMessages: [...] }
 *     { conversationId, error: '...' }
 */

// Map<conversationId, { ports: Set<MessagePort>, timer, interval, apiUrl, apiKey, token, lastFetch }>
const subscriptions = new Map();

/**
 * Fetch new messages for a conversation.
 */
async function fetchMessages(conversationId) {
  const sub = subscriptions.get(conversationId);
  if (!sub || sub.ports.size === 0) return;

  const headers = {
    'Accept': 'application/json',
    'Content-Type': 'application/json',
  };
  if (sub.apiKey) headers['X-API-Key'] = sub.apiKey;
  if (sub.token) headers['Authorization'] = `Bearer ${sub.token}`;

  const params = sub.lastFetch
    ? `?since=${encodeURIComponent(sub.lastFetch)}`
    : '?limit=50&sort_order=asc';

  try {
    const response = await fetch(
      `${sub.apiUrl}/conversations/${conversationId}/messages${params}`,
      { headers }
    );

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const json = await response.json();
    const messages = json.data ?? json;

    if (Array.isArray(messages) && messages.length > 0) {
      // Update last-fetch timestamp
      const newest = messages[messages.length - 1];
      sub.lastFetch = newest.created_at || new Date().toISOString();

      // Broadcast to all connected tabs
      for (const port of sub.ports) {
        try {
          port.postMessage({ conversationId, newMessages: messages });
        } catch {
          // Port may have been disconnected
          sub.ports.delete(port);
        }
      }
    }
  } catch (err) {
    // Broadcast error to all connected tabs
    for (const port of sub.ports) {
      try {
        port.postMessage({ conversationId, error: err.message });
      } catch {
        sub.ports.delete(port);
      }
    }
  }
}

/**
 * Start polling for a conversation.
 */
function startPolling(conversationId) {
  const sub = subscriptions.get(conversationId);
  if (!sub || sub.timer) return;

  // Immediately fetch once
  fetchMessages(conversationId);

  sub.timer = setInterval(
    () => fetchMessages(conversationId),
    sub.interval || 5000
  );
}

/**
 * Stop polling for a conversation and clean up.
 */
function stopPolling(conversationId) {
  const sub = subscriptions.get(conversationId);
  if (!sub) return;

  if (sub.timer) {
    clearInterval(sub.timer);
    sub.timer = null;
  }
  subscriptions.delete(conversationId);
}

// =============================================================================
// SharedWorker connection handler
// =============================================================================

// eslint-disable-next-line no-restricted-globals
self.onconnect = (event) => {
  const port = event.ports[0];
  port.start();

  port.onmessage = (e) => {
    const { action, conversationId, interval, apiUrl, apiKey, token } = e.data || {};

    if (!conversationId) return;

    if (action === 'subscribe') {
      if (!subscriptions.has(conversationId)) {
        subscriptions.set(conversationId, {
          ports: new Set(),
          timer: null,
          interval: interval || 5000,
          apiUrl: apiUrl || '',
          apiKey: apiKey || '',
          token: token || '',
          lastFetch: null,
        });
      }

      const sub = subscriptions.get(conversationId);
      sub.ports.add(port);

      // Update credentials (latest tab's credentials win)
      if (apiUrl) sub.apiUrl = apiUrl;
      if (apiKey) sub.apiKey = apiKey;
      if (token) sub.token = token;
      if (interval) sub.interval = interval;

      // Start polling if not already running
      startPolling(conversationId);

    } else if (action === 'unsubscribe') {
      const sub = subscriptions.get(conversationId);
      if (!sub) return;

      sub.ports.delete(port);

      // If no more subscribers, stop polling
      if (sub.ports.size === 0) {
        stopPolling(conversationId);
      }
    }
  };
};
