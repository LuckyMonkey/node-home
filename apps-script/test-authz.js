/**
 * Authorisation test harness — runs under Node, NOT in Apps Script.
 *
 *   node apps-script/test-authz.js
 *
 * Apps Script cannot be executed locally, so this loads Code.gs with the Google
 * globals stubbed and drives doGet() through each deployment scenario. It tests
 * the decision logic - the part that was wrong - not Google's authentication.
 *
 * The scenario that matters most is EXECUTE_AS_ME_OTHER_USER: a stranger under
 * "Execute as: Me" + "Anyone with a Google Account". The previous
 * `active || effective` code authorised them as the owner. This must DENY.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const SRC = fs.readFileSync(path.join(__dirname, 'Code.gs'), 'utf8');

function run(scenario) {
  const { activeEmail, effectiveEmail, allowlist, sheetId } = scenario;
  let captured = '';

  const sandbox = {
    Session: {
      getActiveUser: () => ({ getEmail: () => activeEmail }),
      getEffectiveUser: () => ({ getEmail: () => effectiveEmail })
    },
    PropertiesService: {
      getScriptProperties: () => ({
        getProperty: (k) => (k === 'ALLOWLIST' ? allowlist : k === 'SHEET_ID' ? sheetId : null)
      })
    },
    ContentService: {
      MimeType: { JSON: 'json' },
      createTextOutput: (t) => { captured = t; return { setMimeType: () => captured }; }
    },
    HtmlService: {
      createHtmlOutput: (h) => { captured = h; return { setTitle: () => ({ addMetaTag: () => captured }) }; }
    },
    SpreadsheetApp: {
      openById: () => { throw new Error('sheet not available in test'); }
    },
    LockService: { getScriptLock: () => ({ tryLock: () => true, releaseLock: () => {} }) },
    Logger: { log: () => {} }
  };
  vm.createContext(sandbox);
  vm.runInContext(SRC, sandbox);
  sandbox.doGet({ parameter: { format: 'json' } });
  return captured;
}

const OWNER = 'owner@example.com';
const STRANGER = 'stranger@example.com';

const scenarios = [
  { name: '1. Owner, allowlisted                     ', activeEmail: OWNER,    effectiveEmail: OWNER, allowlist: OWNER,          sheetId: '', expect: 'AUTHORIZED' },
  { name: '2. Non-allowlisted Google account         ', activeEmail: STRANGER, effectiveEmail: OWNER, allowlist: OWNER,          sheetId: '', expect: 'DENIED' },
  { name: '3. Allowlist unset (fail closed)          ', activeEmail: OWNER,    effectiveEmail: OWNER, allowlist: '',             sheetId: '', expect: 'DENIED' },
  { name: '4. Allowlist empty string (fail closed)   ', activeEmail: OWNER,    effectiveEmail: OWNER, allowlist: '   ,  ,',      sheetId: '', expect: 'DENIED' },
  { name: '5. EXECUTE_AS_ME, other user (THE BYPASS) ', activeEmail: '',       effectiveEmail: OWNER, allowlist: OWNER,          sheetId: '', expect: 'DENIED' },
  { name: '6. No identity at all                     ', activeEmail: '',       effectiveEmail: '',    allowlist: OWNER,          sheetId: '', expect: 'DENIED' },
  { name: '7. Case-insensitive allowlist match       ', activeEmail: 'OwNeR@Example.com', effectiveEmail: OWNER, allowlist: OWNER, sheetId: '', expect: 'AUTHORIZED' },
  { name: '8. Allowlisted among several              ', activeEmail: STRANGER, effectiveEmail: OWNER, allowlist: OWNER+','+STRANGER, sheetId: '', expect: 'AUTHORIZED' }
];

let pass = 0, fail = 0;
console.log('');
for (const s of scenarios) {
  const out = run(s);
  const got = out.includes('"status": "AUTHORIZED"') ? 'AUTHORIZED'
            : out.includes('"status": "DENIED"') ? 'DENIED' : 'UNKNOWN';
  const ok = got === s.expect;

  // A denial must never leak the identity or the allowlist.
  let leak = '';
  if (got === 'DENIED') {
    if (out.includes(OWNER) || out.includes(STRANGER)) leak = '  <-- LEAKS AN IDENTITY';
  }
  if (!ok || leak) fail++; else pass++;
  console.log(`  ${ok && !leak ? 'PASS' : 'FAIL'}  ${s.name} expect ${s.expect.padEnd(10)} got ${got}${leak}`);
}
console.log(`\n  ${pass} passed, ${fail} failed\n`);
process.exit(fail === 0 ? 0 : 1);
