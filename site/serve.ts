/**
 * site/serve.ts — serves site/dist on http://localhost:8080 for checking.
 *
 *     deno run --allow-read --allow-net site/serve.ts
 *
 * Port 8080 because the Edge Function's CORS list names
 * http://localhost:8080 and http://127.0.0.1:8080 (index.ts, ALLOWED_ORIGINS);
 * from any other origin the browser refuses the server's answers.
 */
const DIST = new URL('dist/', import.meta.url);
const TYPES: Record<string, string> = {
  html: 'text/html; charset=utf-8', js: 'text/javascript', css: 'text/css',
  png: 'image/png', svg: 'image/svg+xml', ico: 'image/x-icon', json: 'application/json',
};

Deno.serve({ port: 8080, hostname: '127.0.0.1' }, async (req) => {
  let path = decodeURIComponent(new URL(req.url).pathname);
  if (path.endsWith('/')) path += 'index.html';
  if (path.split('/').includes('..')) return new Response('Bad path', { status: 400 });
  try {
    const body = await Deno.readFile(new URL('.' + path, DIST));
    const ext = path.split('.').pop() ?? '';
    return new Response(body, {
      headers: { 'content-type': TYPES[ext] ?? 'application/octet-stream', 'cache-control': 'no-store' },
    });
  } catch {
    return new Response('Not found', { status: 404 });
  }
});
