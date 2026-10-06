/**
 * Golden Minute Emergency Response System — Service Worker
 * Handles background push notifications, lock-screen visibility, and click navigation.
 */

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('push', (event) => {
  let data = {};
  if (event.data) {
    try {
      data = event.data.json();
    } catch (e) {
      data = { title: '🚨 GOLDEN MINUTE EMERGENCY', body: event.data.text() };
    }
  }

  const title = data.title || '🚨 EMERGENCY DETECTED — GOLDEN MINUTE';
  const cleanType = (data.incidentType || 'EMERGENCY').replace(/_/g, ' ');
  const source = data.sourceType || 'MONITORING SYSTEM';
  const loc = data.latitude && data.longitude ? `📍 (${Number(data.latitude).toFixed(4)}, ${Number(data.longitude).toFixed(4)})` : '';
  const body = data.body || `CRITICAL: ${cleanType} detected by ${source}. Immediate response required. ${loc}`;

  const options = {
    body: body,
    icon: '/favicon.svg',
    badge: '/favicon.svg',
    vibrate: [600, 250, 600, 250, 1000, 300],
    tag: data.incidentId || 'golden-minute-emergency',
    renotify: true,
    requireInteraction: true,
    data: {
      incidentId: data.incidentId,
      url: data.incidentId ? `/incidents/${data.incidentId}` : '/admin',
      timestamp: data.timestamp || new Date().toISOString()
    },
    actions: [
      { action: 'open', title: 'Open Incident' },
      { action: 'dashboard', title: 'Emergency Dashboard' }
    ]
  };

  event.waitUntil(
    self.registration.showNotification(title, options)
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const incidentId = event.notification.data?.incidentId;
  let targetUrl = '/admin';
  if (event.action === 'open' && incidentId) {
    targetUrl = `/incidents/${incidentId}`;
  } else if (incidentId) {
    targetUrl = `/incidents/${incidentId}`;
  }

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      // If a Golden Minute window is already open, focus it and navigate
      for (let client of windowClients) {
        if ('focus' in client) {
          if ('navigate' in client) {
            client.navigate(targetUrl);
          }
          return client.focus();
        }
      }
      // Otherwise open a new window
      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl);
      }
    })
  );
});
