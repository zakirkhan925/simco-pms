/**
 * The server bridge, repointed. Replaces call() in src/JavaScript.html at
 * build time (site/build.ts); nothing else in the screens changes.
 *
 * The original wrapped google.script.run. This posts the same function name
 * and the same arguments to the Edge Function, which answers with the same
 * { success, message, data } envelope, and resolves or rejects exactly as the
 * original did: a refusal rejects with .code and .payload, anything else that
 * goes wrong rejects with a plain message.
 *
 * The token is not added here. api() already passes it as the first argument,
 * where every server function expects it, and call() is used bare for the
 * functions that take no token (login) or take it explicitly (bootstrap).
 */
const PMS_API_URL = 'https://hmbebzxiirnjkrlbkylx.supabase.co/functions/v1/api';

function call(fn, ...args) {
  // A few names are answered in the page rather than by the server: the
  // phase table (which modules have moved) and the Apps Script file check
  // (see site/port.js).
  // A local answer of undefined means "not mine": the call goes to the server.
  const local = window.PMS_PORT && PMS_PORT.local[fn];
  const answer = local ? local(...args) : undefined;
  if (answer !== undefined) {
    if (answer.success === false) {
      return Promise.reject(Object.assign(new Error(answer.message), { code: answer.code, payload: answer }));
    }
    return Promise.resolve(answer);
  }

  // JSON is what google.script.run approximated too: undefined arguments
  // arrive as null, Dates as strings. The screens already avoided both.
  const body = JSON.stringify({ fn: fn, args: args });
  // One round trip: the parsed answer (null if it is not JSON), the raw text
  // and the status. Only the request itself failing rejects.
  const send = () => fetch(PMS_API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: body
  }).then(response => response.text().then(text => {
    let res = null;
    try { res = JSON.parse(text); } catch (e) { /* not ours: settle says so */ }
    return { res: res, text: text, status: response.status };
  }), () => {
    throw new Error('Cannot reach the server. Check the connection and try again.');
  });

  // The platform itself sometimes turns a request away for a moment
  // (Supabase's SUPABASE_EDGE_RUNTIME_SERVICE_DEGRADED, seen on the first
  // morning live). That is refused at the door, before the server's code
  // runs, so nothing was done and sending it once more cannot do anything
  // twice. Only that refusal is retried — never a request that may have run.
  const turnedAway = r => !isEnvelope(r.res) && /SERVICE_DEGRADED/.test(r.text);

  return send().then(first => turnedAway(first)
    ? new Promise(wait => setTimeout(wait, 1500)).then(send).then(settle)
    : settle(first));

  /** Our server always answers { success, message, data }; anything else is not an answer. */
  function isEnvelope(res) {
    return !!res && typeof res === 'object' && typeof res.success === 'boolean';
  }

  function settle(r) {
    let res = r.res;
    // Before this check, a platform error that happened to be JSON resolved as
    // if it were data, and the screen showed nothing rather than saying so.
    if (!isEnvelope(res)) {
      throw new Error(turnedAway(r)
        ? 'The server is busy for a moment. Nothing was saved. Try again shortly.'
        // Anything else (a gateway timeout, say) may have arrived after the
        // server did the work, so it must not promise that nothing happened.
        : 'No answer from the server (HTTP ' + r.status + '). Check whether it went through before trying again.');
    }
    if (res.success === false) {
      // A function the new server does not have yet is a module that has not
      // moved, not a fault — say so in those words.
      if (res.code === 'UNKNOWN_FUNCTION') {
        res = Object.assign({}, res, {
          code: 'NOT_MOVED',
          message: 'This part has not moved to the new system yet (' + fn + ').'
        });
      }
      throw Object.assign(new Error(res.message), { code: res.code, payload: res });
    }
    return res;
  }
}
