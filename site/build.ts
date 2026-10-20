/**
 * site/build.ts — assembles the existing Apps Script screens into one static
 * page that talks to the Edge Function.
 *
 *     deno run --allow-read --allow-write site/build.ts
 *
 * writes site/dist/index.html. The sources in src/ are read, never edited.
 *
 * What Apps Script did, and what this does in its place:
 *
 *   doGet()            createTemplateFromFile('Index'), version = APP_VERSION,
 *                      setTitle(APP_NAME), viewport meta tag.
 *   include(name)      <?!= include('Name'); ?> is replaced by src/Name.html,
 *                      verbatim, in the same place.
 *   <?= version ?>     the version from src/Config.gs, HTML-escaped as the
 *                      template's <?= ?> did.
 *
 * Then a short list of exact-text changes, each of which must match exactly
 * once or the build stops — so a change to src/ can never leave a patch
 * silently unapplied:
 *
 *   - call() in JavaScript.html is replaced by site/bridge.js;
 *   - "arrives in Phase N" wording becomes "not moved to the new system yet";
 *   - site/port.js is added after the last screen file, before boot runs;
 *   - a standing notice that this copy is for checking only.
 *
 * Any other scriptlet left in the output stops the build too.
 */

const ROOT = new URL('../', import.meta.url);
const SRC = new URL('src/', ROOT);
const OUT_DIR = new URL('site/dist/', ROOT);

const read = (url: URL) => Deno.readTextFileSync(url);
const fail = (msg: string): never => { console.error('build failed: ' + msg); Deno.exit(1); };

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

/** Replace text that must occur exactly once in `where`. */
function once(text: string, find: string, replace: string, where: string): string {
  const first = text.indexOf(find);
  if (first === -1) fail(`${where}: expected text not found:\n${find}`);
  if (text.indexOf(find, first + 1) !== -1) fail(`${where}: expected text occurs more than once:\n${find}`);
  // Sliced rather than String.replace, so `$` in the new text is never a pattern.
  return text.slice(0, first) + replace + text.slice(first + find.length);
}

/* ------------------------------------------------- what doGet() supplied */

const config = read(new URL('Config.gs', SRC));
const pick = (name: string) =>
  (config.match(new RegExp(`var ${name}\\s*=\\s*'([^']*)'`)) || [])[1] ?? fail(`${name} not found in Config.gs`);
const APP_NAME = pick('APP_NAME');
const APP_VERSION = pick('APP_VERSION');

/* --------------------------------------------- the changes to the sources */

const bridge = read(new URL('site/bridge.js', ROOT));
const port = read(new URL('site/port.js', ROOT));

/** Per-file changes, applied to a partial before it is inlined. */
const PATCHES: Record<string, (text: string) => string> = {
  JavaScript: (t) => {
    // The bridge: the whole of call(), from its comment to its closing brace.
    const start = t.indexOf('/** Promise wrapper over google.script.run');
    const end = t.indexOf('\n}\n', t.indexOf('function call(fn, ...args) {'));
    if (start === -1 || end === -1) fail('JavaScript.html: call() not found where expected');
    const original = t.slice(start, end + 3);
    if ((original.match(/google\.script\.run/g) || []).length !== 3) {
      fail('JavaScript.html: call() no longer holds exactly the three google.script.run references');
    }
    if (/google\.script/.test(t.slice(0, start) + t.slice(end + 3))) {
      fail('JavaScript.html: google.script is referenced outside call()');
    }
    t = t.slice(0, start) + bridge.trimEnd() + '\n' + t.slice(end + 3);

    // Menu entries that are not built: say "not moved", not "arrives in Phase N".
    t = once(t, 'title: !built ? `${item.label} \\u2014 arrives in Phase ${item.phase}`',
      'title: !built ? `${item.label} \\u2014 not moved to the new system yet`', 'nav title');
    t = once(t, '(!built ? `<span class="nav-phase">Phase ${item.phase}</span>`',
      '(!built ? `<span class="nav-phase">Not moved yet</span>`', 'nav chip');

    // Project page tabs, likewise.
    t = once(t, "b.title = t.label + ' arrives in Phase ' + t.phase;",
      "b.title = t.label + ' has not moved to the new system yet';", 'project tab title');
    t = once(t, 'color:var(--text-muted)">P${t.phase}</span>`',
      'color:var(--text-muted)">not moved</span>`', 'project tab chip');
    return t;
  }
};

/* --------------------------------------------------------- the notice */

const NOTICE_CSS = `<style>
/* site/build.ts: the standing notice that this copy is for checking only. */
.port-notice{background:var(--warn-soft);color:var(--warn);border-bottom:1px solid var(--warn);
  font-size:13px;line-height:1.45;padding:8px 16px;text-align:center}
.port-notice strong{font-weight:700}
</style>`;

const NOTICE_HTML = `<div class="port-notice" role="note">
    <strong>For checking only.</strong> This is the new system, working on a copy of the data.
    Keep doing real work in the live system; nothing entered here reaches it.
  </div>`;

/* ------------------------------------------------------------ assemble */

let page = read(new URL('Index.html', SRC));
const included: string[] = [];

// Page-level additions go into Index.html before the partials are inlined:
// the partials carry their own </body> and </head> (the print window writes a
// whole document), so afterwards those tags are no longer unique.
// doGet(): setTitle and the viewport tag. Also carried over from the status
// card this page replaces on pms.simcodevelopers.com: keep it out of search
// engines, and an inline icon so no load asks for a favicon that is not there.
page = once(page, '<title>SIMCO Construction PMS</title>',
  `<meta name="viewport" content="width=device-width, initial-scale=1">\n` +
  `  <meta name="robots" content="noindex,nofollow">\n` +
  `  <link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'%3E%3Crect width='32' height='32' rx='7' fill='%2315325C'/%3E%3Ctext x='16' y='21' font-family='system-ui,sans-serif' font-size='13' font-weight='700' fill='%23fff' text-anchor='middle'%3ESC%3C/text%3E%3C/svg%3E">\n` +
  `  <title>${escapeHtml(APP_NAME)}</title>`,
  'Index.html title');
page = once(page, '</head>', `${NOTICE_CSS}\n</head>`, 'Index.html head end');
page = once(page, '<body>\n', `<body>\n  ${NOTICE_HTML}\n`, 'Index.html body start');
page = once(page, '</body>', `<script>\n/* site/port.js, added by site/build.ts */\n${port}</script>\n</body>`,
  'Index.html body end');

page = page.replace(/<\?!=\s*include\('([A-Za-z]+)'\);?\s*\?>/g, (_m, name: string) => {
  let text: string;
  try { text = read(new URL(`${name}.html`, SRC)); }
  catch { return fail(`Index.html includes ${name}, but src/${name}.html cannot be read`); }
  included.push(name);
  const patch = PATCHES[name];
  return patch ? patch(text) : text;
});
for (const name of Object.keys(PATCHES)) {
  if (!included.includes(name)) fail(`${name}.html has changes to apply but Index.html no longer includes it`);
}

page = page.replace(/<\?=\s*version\s*\?>/g, () => escapeHtml(APP_VERSION));

const lastInclude = included[included.length - 1];
const leftover = page.match(/<\?[\s\S]*?\?>/);
if (leftover) fail(`a template scriptlet is left in the output: ${leftover[0]}`);

Deno.mkdirSync(OUT_DIR, { recursive: true });
Deno.writeTextFileSync(new URL('index.html', OUT_DIR), page);
console.log(`site/dist/index.html: ${APP_NAME} ${APP_VERSION}, ` +
  `${included.length} partials (${included.join(', ')}; port.js after ${lastInclude}), ` +
  `${(page.length / 1024).toFixed(0)} KB`);
