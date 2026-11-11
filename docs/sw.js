// SIMCO PMS service worker (11 Nov 2026). It lets a phone install the app and
// says so plainly when there is no connection. It stores nothing: every screen
// and every figure comes from the server each time, so nobody ever sees stale
// numbers.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', e => e.waitUntil(self.clients.claim()));
const OFFLINE = `<!doctype html><html><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><title>SIMCO PMS</title>
<style>body{margin:0;min-height:100vh;display:grid;place-items:center;font:15px system-ui,sans-serif;
background:#15325C;color:#fff;text-align:center;padding:24px;box-sizing:border-box}
button{margin-top:18px;font:inherit;padding:10px 22px;border:0;border-radius:6px;background:#fff;color:#15325C;font-weight:600}</style>
</head><body><div><div style="font-size:18px;font-weight:700">No connection</div>
<p style="opacity:.85">SIMCO PMS needs the internet. Check your connection and try again.</p>
<button onclick="location.reload()">Try again</button></div></body></html>`;
self.addEventListener('fetch', e => {
  if (e.request.mode !== 'navigate') return;          // everything else: straight to the network
  e.respondWith(fetch(e.request).catch(() =>
    new Response(OFFLINE, { headers: { 'Content-Type': 'text/html; charset=utf-8' } })));
});
