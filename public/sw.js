// public/sw.js

// ─── Install event ──────────────────────────────────────────
self.addEventListener('install', (event) => {
  event.waitUntil(self.skipWaiting());
});

// ─── Activate event ──────────────────────────────────────────
self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

// ─── Handle push notifications ──────────────────────────────
self.addEventListener('push', (event) => {
  let data = {};

  try {
    data = event.data.json();
  } catch (e) {
    // If the data is not JSON, treat it as plain text
    data = {
      title: 'New notification',
      body: event.data ? event.data.text() : 'You have a new notification',
    };
  }

  const title = data.title || '📞 Pakhi is calling';
  const options = {
    body: data.body || 'Your Pakhi is waiting for you ❤️',
    icon: data.icon || '/favicon.ico',
    badge: '/favicon.ico',
    data: data.data || {},
    vibrate: [200, 100, 200, 100, 200],
    // Add actions for call
    actions: data.data?.type === 'call'
      ? [
          { action: 'answer', title: '💖 Answer' },
          { action: 'ignore', title: 'Ignore' },
        ]
      : [],
    requireInteraction: data.data?.type === 'call',
  };

  event.waitUntil(
    self.registration.showNotification(title, options)
  );
});

// ─── Handle notification click ──────────────────────────────
self.addEventListener('notificationclick', (event) => {
  const notification = event.notification;
  const action = event.action;
  const data = notification.data || {};

  notification.close();

  if (action === 'answer' || data.type === 'call') {
    // Open the chat
    event.waitUntil(
      clients.openWindow('/')
    );
  } else {
    // Default: open the app
    event.waitUntil(
      clients.openWindow('/')
    );
  }
});