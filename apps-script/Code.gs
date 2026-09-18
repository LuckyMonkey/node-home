/**
 * fridge.run — identity-gated admin surface
 * ============================================================================
 *
 * WHY THIS EXISTS
 * fridge.run is GitHub Pages: static files, no server-side code. A static page
 * cannot enforce identity — anything it checks in JavaScript is bypassable by
 * reading the source. This Apps Script web app is the trust boundary instead.
 * Google authenticates the user; this script reads the resulting identity
 * server-side, where the browser cannot influence it.
 *
 * ----------------------------------------------------------------------------
 * DEPLOYMENT — THE PART EVERYONE GETS WRONG
 *
 * Deploy > New deployment > type "Web app", then:
 *
 *   Execute as:      Me (your@gmail.com)
 *   Who has access:  Only myself
 *
 * With that combination Google itself refuses to even run the script for
 * anyone else, and Session.getEffectiveUser() is you. That is the strongest
 * and simplest setting, and it is right if you are the only admin.
 *
 * If you ever need to let OTHER people in, you must change BOTH:
 *   Execute as:      User accessing the web app
 *   Who has access:  Anyone with a Google Account
 * because with "Execute as: Me", Session.getActiveUser().getEmail() returns an
 * EMPTY STRING for everyone except the owner — Google withholds it for privacy.
 * People hit that, see a blank email, and conclude identity is broken.
 * The trade-off: "Execute as: User accessing" runs with THEIR permissions, so
 * the Sheet must be shared with them too.
 *
 * ----------------------------------------------------------------------------
 * SETUP
 * 1. Create a Google Sheet. Copy its ID from the URL:
 *      docs.google.com/spreadsheets/d/<THIS_PART>/edit
 * 2. Project Settings > Script Properties, add:
 *      SHEET_ID   = <the id>
 *      ALLOWLIST  = you@gmail.com,someone@else.com     (comma separated)
 * 3. Deploy as above, copy the /exec URL.
 * 4. Put that URL in fridge-run's fridge-iam-config.js as `endpoint`.
 *
 * Secrets live in Script Properties, never in this file, so this file is safe
 * to commit to the public repo.
 * ============================================================================
 */

var SHEET_TAB = 'fridge';

/** Verified identity. Cannot be forged by the browser. */
function currentUser_() {
  // getEffectiveUser: whose authority the script runs under.
  // getActiveUser:    who is hitting it (empty for non-owners under "Execute as: Me").
  var effective = Session.getEffectiveUser().getEmail() || '';
  var active = '';
  try { active = Session.getActiveUser().getEmail() || ''; } catch (err) { active = ''; }
  return active || effective;
}

function allowlist_() {
  var raw = PropertiesService.getScriptProperties().getProperty('ALLOWLIST') || '';
  return raw.split(',').map(function (s) { return s.trim().toLowerCase(); })
            .filter(function (s) { return s.length > 0; });
}

function isAuthorised_(email) {
  var list = allowlist_();
  // Fail CLOSED. An unset allowlist denies everyone rather than admitting all.
  if (list.length === 0) return false;
  return list.indexOf(String(email).toLowerCase()) !== -1;
}

function sheet_() {
  var id = PropertiesService.getScriptProperties().getProperty('SHEET_ID');
  if (!id) throw new Error('SHEET_ID script property is not set.');
  var ss = SpreadsheetApp.openById(id);
  var sh = ss.getSheetByName(SHEET_TAB);
  if (!sh) {
    sh = ss.insertSheet(SHEET_TAB);
    sh.appendRow(['timestamp', 'user', 'key', 'value']);
  }
  return sh;
}

function json_(obj, code) {
  return ContentService
    .createTextOutput(JSON.stringify(obj, null, 2))
    .setMimeType(ContentService.MimeType.JSON);
}

function page_(title, bodyHtml) {
  var html =
    '<!doctype html><html><head><meta charset="utf-8">' +
    '<meta name="viewport" content="width=device-width,initial-scale=1">' +
    '<title>' + title + '</title><style>' +
    ':root{color-scheme:dark}' +
    'body{margin:0;padding:24px;background:#020202;color:#f3f3f3;' +
    'font-family:"IBM Plex Sans","Segoe UI",Roboto,sans-serif;display:grid;place-items:start center}' +
    '.card{width:min(680px,100%);border:1px solid rgba(255,255,255,.1);border-radius:20px;' +
    'background:rgba(12,12,12,.9);padding:20px 22px;box-shadow:0 24px 70px rgba(0,0,0,.45)}' +
    '.eyebrow{margin:0 0 6px;letter-spacing:.14em;text-transform:uppercase;font-size:11px;color:#9a9a9a;font-weight:700}' +
    'h1{margin:0 0 12px;font-size:22px}' +
    'table{width:100%;border-collapse:collapse;font-size:13px;margin:12px 0}' +
    'th,td{text-align:left;padding:8px 10px;border-bottom:1px solid rgba(255,255,255,.1)}' +
    'th{color:#9a9a9a;font-size:11px;letter-spacing:.1em;text-transform:uppercase}' +
    'input,button{font:inherit;padding:9px 12px;border-radius:10px;border:1px solid rgba(255,255,255,.15);' +
    'background:rgba(255,255,255,.05);color:#f3f3f3}' +
    'button{background:#fff;color:#020202;font-weight:700;cursor:pointer;border-color:#fff}' +
    '.note{margin:12px 0 0;padding:11px 13px;border-left:2px solid rgba(255,255,255,.3);' +
    'background:rgba(255,255,255,.03);border-radius:0 10px 10px 0;font-size:12.5px;color:#9a9a9a}' +
    'a{color:inherit}code{background:rgba(255,255,255,.08);padding:1px 5px;border-radius:4px}' +
    '</style></head><body><div class="card">' + bodyHtml + '</div></body></html>';
  return HtmlService.createHtmlOutput(html)
    .setTitle(title)
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

function esc_(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

/** GET: serve the admin surface, or a clear refusal. */
function doGet(e) {
  var user = currentUser_();
  var wantsJson = e && e.parameter && e.parameter.api === 'status';

  if (!isAuthorised_(user)) {
    if (wantsJson) return json_({ ok: false, error: 'not authorised', user: user || null });
    var why = user
      ? 'The account <code>' + esc_(user) + '</code> is not on this node\'s allowlist.'
      : 'No verified identity was returned. If the deployment is set to ' +
        '<code>Execute as: Me</code>, Google withholds the email of anyone except the owner — ' +
        'switch to <code>Execute as: User accessing</code> to identify other people.';
    return page_('fridge.run — access denied',
      '<p class="eyebrow">fridge.run · Identity</p><h1>Not authorised</h1><p>' + why + '</p>' +
      '<p class="note">This check runs server-side in Apps Script. Nothing in the browser ' +
      'can change the outcome.</p>' +
      '<p style="margin-top:14px"><a href="https://fridge.run/dashboard/">Back to the public dashboard</a></p>');
  }

  if (wantsJson) {
    return json_({ ok: true, user: user, rows: readRows_(25) });
  }

  var rows = readRows_(25);
  var body =
    '<p class="eyebrow">fridge.run · Admin</p>' +
    '<h1>Signed in as ' + esc_(user) + '</h1>' +
    '<form method="post" action="">' +
    '<input type="hidden" name="action" value="append">' +
    '<input name="key" placeholder="key" required style="width:32%">' +
    '<input name="value" placeholder="value" required style="width:40%">' +
    '<button type="submit">Write</button></form>' +
    '<table><tr><th>when</th><th>who</th><th>key</th><th>value</th></tr>';
  rows.forEach(function (r) {
    body += '<tr><td>' + esc_(r[0]) + '</td><td>' + esc_(r[1]) + '</td><td>' +
            esc_(r[2]) + '</td><td>' + esc_(r[3]) + '</td></tr>';
  });
  body += '</table>' +
    '<p class="note">Writes are recorded against your verified Google identity, ' +
    'so every row is attributable. The public dashboard at ' +
    '<a href="https://fridge.run/dashboard/">fridge.run</a> can read this data; ' +
    'only allowlisted accounts can change it.</p>';
  return page_('fridge.run — admin', body);
}

/** POST: accept a write, identity-checked. */
function doPost(e) {
  var user = currentUser_();
  if (!isAuthorised_(user)) {
    return json_({ ok: false, error: 'not authorised', user: user || null });
  }
  var p = (e && e.parameter) || {};
  if (p.action !== 'append') {
    return json_({ ok: false, error: 'unknown action' });
  }
  var key = String(p.key || '').slice(0, 200);
  var value = String(p.value || '').slice(0, 2000);
  if (!key) return json_({ ok: false, error: 'key required' });

  // Serialise writes so two clients cannot interleave rows.
  var lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    sheet_().appendRow([new Date(), user, key, value]);
  } finally {
    lock.releaseLock();
  }
  return doGet(e);
}

function readRows_(limit) {
  var sh = sheet_();
  var last = sh.getLastRow();
  if (last < 2) return [];
  var start = Math.max(2, last - limit + 1);
  var values = sh.getRange(start, 1, last - start + 1, 4).getValues();
  return values.reverse().map(function (r) {
    var t = r[0];
    return [t instanceof Date ? t.toISOString().replace('T', ' ').slice(0, 19) : String(t),
            r[1], r[2], r[3]];
  });
}

/** Run once from the editor to confirm identity and config before deploying. */
function selfTest() {
  var user = currentUser_();
  Logger.log('effective user : %s', Session.getEffectiveUser().getEmail());
  Logger.log('resolved user  : %s', user);
  Logger.log('allowlist      : %s', JSON.stringify(allowlist_()));
  Logger.log('authorised     : %s', isAuthorised_(user));
  Logger.log('SHEET_ID set   : %s',
    !!PropertiesService.getScriptProperties().getProperty('SHEET_ID'));
}
