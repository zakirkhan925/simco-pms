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
  // phase table (which modules have moved), and uploads, which the new
  // system cannot store yet and should refuse before the file is sent.
  // A local answer of undefined means "not mine": the call goes to the server.
  const local = window.PMS_PORT && PMS_PORT.local[fn];
  const answer = local ? local(...args) : undefined;
  if (answer !== undefined) {
    if (answer.success === false) {
      return Promise.reject(Object.assign(new Error(answer.message), { code: answer.code, payload: answer }));
    }
    return Promise.resolve(answer);
  }

  return fetch(PMS_API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    // JSON is what google.script.run approximated too: undefined arguments
    // arrive as null, Dates as strings. The screens already avoided both.
    body: JSON.stringify({ fn: fn, args: args })
  }).then(response => response.text().then(text => {
    let res;
    try { res = JSON.parse(text); }
    catch (e) { throw new Error('Server error (HTTP ' + response.status + '). Try again in a moment.'); }
    if (res && res.success === false) {
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
  }), () => {
    // Only the request itself failing lands here; a refusal above passes by.
    throw new Error('Cannot reach the server. Check the connection and try again.');
  });
}
