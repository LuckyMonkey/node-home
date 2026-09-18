/**
 * fridge.run — authentication boundary
 * ============================================================================
 *
 * Milestone: prove the round trip end to end.
 *
 *   fridge.run  ->  LOGIN WITH FRIDGE  ->  Google authenticates
 *               ->  Apps Script        ->  server-side allowlist
 *               ->  AUTHORIZED / DENIED
 *
 * fridge.run is GitHub Pages: static files, no server-side code. A static page
 * cannot enforce identity, so it does not try. THIS SCRIPT is the boundary.
 *
 * Division of responsibility:
 *   Google      authenticates - establishes who the caller is.
 *   Apps Script authorises    - compares that identity to an allowlist.
 *   Sheets      is an optional datastore BEHIND the boundary. It is NOT the
 *               IAM authority; removing it must not grant anyone access.
 *
 * Read apps-script/IDENTITY.md before changing anything in this file. The
 * identity semantics are counter-intuitive and getting them wrong produces a
 * silent total bypass rather than an error.
 * ============================================================================
 */

var SHEET_TAB = 'fridge';

/* -------------------------------------------------------------------------
 * IDENTITY
 * ---------------------------------------------------------------------- */

/**
 * The Google-verified identity of the CALLER, or '' if Google will not tell us.
 *
 * Deliberately reads getActiveUser() ONLY.
 *
 * Per https://developers.google.com/apps-script/reference/base/session
 * (verified 2026-09-17), getActiveUser().getEmail() returns a blank string for
 * "web apps deployed as 'execute as me'", while getEffectiveUser() returns THE
 * DEVELOPER'S account in that same mode.
 *
 * So falling back from active to effective - as the first version of this file
 * did - resolves a STRANGER to the OWNER's email, which then passes any
 * allowlist containing the owner. That is a complete authentication bypass for
 * anyone holding the /exec URL. Never do it.
 *
 * Blank is therefore the correct, safe answer whenever the caller cannot be
 * identified, and callers of this function must treat blank as "deny".
 */
function authenticatedUser_() {
  try {
    return (Session.getActiveUser().getEmail() || '').trim();
  } catch (err) {
    // Throwing means we could not establish identity; that is a denial.
    return '';
  }
}

/**
 * Identify a dangerous deployment so we can refuse rather than misbehave.
 * Used ONLY for diagnostics - never to authorise.
 */
function deploymentDiagnosis_() {
  var active = authenticatedUser_();
  var effective = '';
  try { effective = (Session.getEffectiveUser().getEmail() || '').trim(); } catch (e) { effective = ''; }

  if (active) return { ok: true, mode: 'identifiable', active: active };

  if (effective) {
    // Blank caller + known authority == "Execute as: Me" with access opened up
    // beyond the owner. We cannot tell callers apart in this mode.
    return {
      ok: false,
      mode: 'execute-as-me-anonymous-callers',
      effective: effective,
      message:
        'This web app is deployed as "Execute as: Me" with access granted beyond ' +
        'the owner. In that mode Google does not reveal the caller\'s identity, so ' +
        'this script cannot tell one visitor from another and refuses to serve ' +
        'protected content. Redeploy with "Execute as: User accessing the web app" ' +
        '(and "Anyone with a Google Account"), or restrict access to "Only myself".'
    };
  }

  return {
    ok: false,
    mode: 'no-identity',
    message: 'Google did not provide a verified identity for this request.'
  };
}

/* -------------------------------------------------------------------------
 * AUTHORISATION  (fails closed)
 * ---------------------------------------------------------------------- */

function allowlist_() {
  var raw = PropertiesService.getScriptProperties().getProperty('ALLOWLIST') || '';
  return raw.split(',')
    .map(function (s) { return s.trim().toLowerCase(); })
    .filter(function (s) { return s.length > 0; });
}

/**
 * Fails closed in every uncertain case:
 *   - empty/unset allowlist  -> deny everyone (NOT "allow everyone")
 *   - blank identity         -> deny
 *   - identity not listed    -> deny
 */
function isAuthorised_(email) {
  if (!email) return false;
  var list = allowlist_();
  if (list.length === 0) return false;
  return list.indexOf(String(email).toLowerCase()) !== -1;
}

/* -------------------------------------------------------------------------
 * OPTIONAL DATASTORE  (behind the boundary; never the authority)
 * ---------------------------------------------------------------------- */

function sheetId_() {
  return PropertiesService.getScriptProperties().getProperty('SHEET_ID') || '';
}

function sheet_() {
  var id = sheetId_();
  if (!id) throw new Error('SHEET_ID script property is not set.');
  var ss = SpreadsheetApp.openById(id);
  var sh = ss.getSheetByName(SHEET_TAB);
  if (!sh) {
    sh = ss.insertSheet(SHEET_TAB);
    sh.appendRow(['timestamp', 'user', 'key', 'value']);
  }
  return sh;
}

function readRows_(limit) {
  var sh = sheet_();
  var last = sh.getLastRow();
  if (last < 2) return [];
  var start = Math.max(2, last - limit + 1);
  return sh.getRange(start, 1, last - start + 1, 4).getValues()
    .reverse()
    .map(function (r) {
      var t = r[0];
      return [t instanceof Date ? t.toISOString().replace('T', ' ').slice(0, 19) : String(t),
              r[1], r[2], r[3]];
    });
}

/* -------------------------------------------------------------------------
 * PRESENTATION
 * ---------------------------------------------------------------------- */

function esc_(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj, null, 2))
    .setMimeType(ContentService.MimeType.JSON);
}

function page_(title, bodyHtml) {
  var html =
    '<!doctype html><html lang="en"><head><meta charset="utf-8">' +
    '<meta name="viewport" content="width=device-width,initial-scale=1">' +
    '<title>' + esc_(title) + '</title><style>' +
    ':root{color-scheme:dark}' +
    'body{margin:0;padding:24px;background:#020202;color:#f3f3f3;' +
    'font-family:"IBM Plex Sans","Segoe UI",Roboto,sans-serif;display:grid;place-items:start center}' +
    '.card{width:min(660px,100%);border:1px solid rgba(255,255,255,.1);border-radius:20px;' +
    'background:rgba(12,12,12,.9);padding:22px 24px;box-shadow:0 24px 70px rgba(0,0,0,.45)}' +
    '.eyebrow{margin:0 0 6px;letter-spacing:.14em;text-transform:uppercase;font-size:11px;color:#9a9a9a;font-weight:700}' +
    'h1{margin:0 0 10px;font-size:23px}' +
    '.verdict{display:inline-flex;align-items:center;gap:8px;padding:7px 14px;border-radius:999px;' +
    'font-weight:700;font-size:13px;letter-spacing:.06em;border:1px solid}' +
    '.ok{color:#3fb950;border-color:#3fb950}.no{color:#d4553c;border-color:#d4553c}' +
    '.who{font-size:15px;margin:14px 0 0}.who b{font-weight:700}' +
    '.note{margin:16px 0 0;padding:11px 13px;border-left:2px solid rgba(255,255,255,.3);' +
    'background:rgba(255,255,255,.03);border-radius:0 10px 10px 0;font-size:12.5px;color:#9a9a9a;line-height:1.55}' +
    'table{width:100%;border-collapse:collapse;font-size:13px;margin:14px 0}' +
    'th,td{text-align:left;padding:8px 10px;border-bottom:1px solid rgba(255,255,255,.1)}' +
    'th{color:#9a9a9a;font-size:11px;letter-spacing:.1em;text-transform:uppercase}' +
    'input,button{font:inherit;padding:9px 12px;border-radius:10px;' +
    'border:1px solid rgba(255,255,255,.15);background:rgba(255,255,255,.05);color:#f3f3f3}' +
    'button{background:#fff;color:#020202;font-weight:700;cursor:pointer;border-color:#fff}' +
    'a{color:inherit}code{background:rgba(255,255,255,.08);padding:1px 5px;border-radius:4px}' +
    '</style></head><body><div class="card">' + bodyHtml + '</div></body></html>';
  return HtmlService.createHtmlOutput(html).setTitle(title)
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

/** Denial. Deliberately contains NO protected data and no allowlist contents. */
function denied_(reason, wantsJson) {
  if (wantsJson) {
    // Note: no identity echoed back, no allowlist, no sheet data.
    return json_({ ok: false, status: 'DENIED', reason: reason });
  }
  return page_('fridge.run — denied',
    '<p class="eyebrow">fridge.run · Identity</p>' +
    '<h1>Access denied</h1>' +
    '<p><span class="verdict no">DENIED</span></p>' +
    '<p class="who">' + esc_(reason) + '</p>' +
    '<p class="note">This decision is made server-side by Apps Script using an identity ' +
    'supplied by Google. Nothing in your browser can change it, and knowing this URL ' +
    'grants nothing on its own.</p>' +
    '<p style="margin-top:16px"><a href="https://fridge.run/dashboard/">' +
    'Back to the public dashboard</a> — reading that needs no account.</p>');
}

/* -------------------------------------------------------------------------
 * ENTRY POINTS
 * ---------------------------------------------------------------------- */

function doGet(e) {
  var wantsJson = !!(e && e.parameter && e.parameter.format === 'json');

  var diag = deploymentDiagnosis_();
  if (!diag.ok) {
    // Misconfigured or unidentifiable: refuse, and do not leak anything.
    return denied_(diag.message, wantsJson);
  }

  var user = diag.active;
  if (!isAuthorised_(user)) {
    return denied_('This Google account is not on the allowlist for this node.', wantsJson);
  }

  if (wantsJson) {
    return json_({ ok: true, status: 'AUTHORIZED', user: user });
  }

  // --- the milestone: visible proof of the full round trip ---
  var body =
    '<p class="eyebrow">fridge.run · Identity</p>' +
    '<h1>Authenticated</h1>' +
    '<p><span class="verdict ok">AUTHORIZED</span></p>' +
    '<p class="who">Signed in as <b>' + esc_(user) + '</b></p>' +
    '<p class="note">Google verified this identity; Apps Script checked it against an ' +
    'allowlist held in Script Properties. The identity was never supplied by the ' +
    'browser, so it cannot be spoofed by editing the page or the request.</p>';

  // Sheets is optional and strictly behind the boundary. If it is not
  // configured, authentication still works - that is the point.
  if (sheetId_()) {
    try {
      var rows = readRows_(15);
      body +=
        '<form method="post" action="">' +
        '<input type="hidden" name="action" value="append">' +
        '<input name="key" placeholder="key" required style="width:30%">' +
        '<input name="value" placeholder="value" required style="width:38%">' +
        '<button type="submit">Write</button></form>' +
        '<table><tr><th>when</th><th>who</th><th>key</th><th>value</th></tr>';
      rows.forEach(function (r) {
        body += '<tr><td>' + esc_(r[0]) + '</td><td>' + esc_(r[1]) + '</td><td>' +
                esc_(r[2]) + '</td><td>' + esc_(r[3]) + '</td></tr>';
      });
      body += '</table><p class="note">Rows are attributed to the verified identity above.</p>';
    } catch (err) {
      body += '<p class="note">Datastore unavailable: ' + esc_(err.message) +
              '. Authentication is unaffected — Sheets is not the IAM authority.</p>';
    }
  } else {
    body += '<p class="note">No <code>SHEET_ID</code> configured. That is fine: the ' +
            'authentication boundary does not depend on it.</p>';
  }
  return page_('fridge.run — authorized', body);
}

function doPost(e) {
  var wantsJson = !!(e && e.parameter && e.parameter.format === 'json');

  var diag = deploymentDiagnosis_();
  if (!diag.ok) return denied_(diag.message, wantsJson);

  var user = diag.active;
  if (!isAuthorised_(user)) {
    return denied_('This Google account is not on the allowlist for this node.', wantsJson);
  }

  var p = (e && e.parameter) || {};
  if (p.action !== 'append') return json_({ ok: false, error: 'unknown action' });

  var key = String(p.key || '').slice(0, 200);
  var value = String(p.value || '').slice(0, 2000);
  if (!key) return json_({ ok: false, error: 'key required' });

  // Serialise writes: two concurrent submissions must not interleave or clobber.
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(10000)) {
    return json_({ ok: false, error: 'busy, try again' });
  }
  try {
    sheet_().appendRow([new Date(), user, key, value]);
  } finally {
    lock.releaseLock();
  }
  return doGet(e);
}

/* -------------------------------------------------------------------------
 * SELF TEST — run from the Apps Script editor BEFORE deploying.
 * ---------------------------------------------------------------------- */
function selfTest() {
  var active = '';
  var effective = '';
  try { active = Session.getActiveUser().getEmail() || ''; } catch (e) { active = '<threw>'; }
  try { effective = Session.getEffectiveUser().getEmail() || ''; } catch (e) { effective = '<threw>'; }

  Logger.log('getActiveUser()    : "%s"', active);
  Logger.log('getEffectiveUser() : "%s"', effective);
  Logger.log('ALLOWLIST entries  : %s', allowlist_().length);
  Logger.log('SHEET_ID set       : %s', sheetId_() ? 'yes' : 'no (optional)');
  Logger.log('authorised as self : %s', isAuthorised_(active));

  if (allowlist_().length === 0) {
    Logger.log('WARNING: ALLOWLIST is empty. Everyone is denied (fail closed). ' +
               'Set the ALLOWLIST script property.');
  }
  if (!active && effective) {
    Logger.log('WARNING: caller identity is blank while authority is known. In a ' +
               'deployed web app this is the "Execute as: Me" + wider access mode, ' +
               'where callers cannot be told apart. See apps-script/IDENTITY.md.');
  }
  Logger.log('NOTE: run from the editor you ARE the owner, so active is populated. ' +
             'This does not prove the deployed mode is safe - test the /exec URL ' +
             'from a second Google account.');
}
