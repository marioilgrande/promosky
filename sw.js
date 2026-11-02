// Service worker del portale Promo Sky E2K: serve solo alle notifiche push.
// Niente cache, di proposito: le offerte devono arrivare sempre dalla rete,
// mai da una copia vecchia salvata sul telefono.

const SB_URL = 'https://fvoiswsclfvdtxicomvk.supabase.co';
const SB_KEY = 'sb_publishable_flKoZ93pOFQBLlWIt_u2jQ_gKuwHgT0';

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));

self.addEventListener('push', (e) => {
  let d = {};
  try { d = e.data ? e.data.json() : {}; }
  catch (_) { d = { testo: e.data ? e.data.text() : '' }; }

  const titolo = d.titolo || 'Promo Sky aggiornate';
  const opzioni = {
    body: d.testo || 'Apri il portale per vedere le offerte aggiornate.',
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    tag: 'promo-aggiornate',   // una notifica nuova sostituisce la precedente
    renotify: true,
    data: { url: d.url || '/' }
  };

  e.waitUntil((async () => {
    await self.registration.showNotification(titolo, opzioni);
    // se il portale e' aperto, mostra anche il banner "Ricarica"
    const finestre = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    finestre.forEach((c) => c.postMessage({ tipo: 'promo-aggiornate', titolo, testo: opzioni.body }));
  })());
});

self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  const url = new URL((e.notification.data && e.notification.data.url) || '/', self.location.origin).href;
  e.waitUntil((async () => {
    const finestre = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const c of finestre) {
      if (new URL(c.url).origin === self.location.origin) {
        await c.focus();
        c.postMessage({ tipo: 'ricarica' });   // porta subito la versione nuova
        return;
      }
    }
    await self.clients.openWindow(url);
  })());
});

// Il browser a volte rinnova l'iscrizione da solo: la registro di nuovo,
// altrimenti quel dispositivo smetterebbe di ricevere le notifiche.
self.addEventListener('pushsubscriptionchange', (e) => {
  e.waitUntil((async () => {
    const r = await fetch(`${SB_URL}/functions/v1/invia-notifica`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ azione: 'chiave' })
    });
    const { chiave } = await r.json();
    const pad = '='.repeat((4 - chiave.length % 4) % 4);
    const raw = atob((chiave + pad).replace(/-/g, '+').replace(/_/g, '/'));
    const key = Uint8Array.from(raw, (ch) => ch.charCodeAt(0));
    const sub = await self.registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: key });
    const j = sub.toJSON();
    await fetch(`${SB_URL}/rest/v1/rpc/registra_push`, {
      method: 'POST',
      headers: { apikey: SB_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({ p_endpoint: j.endpoint, p_p256dh: j.keys.p256dh, p_auth: j.keys.auth })
    });
  })());
});
