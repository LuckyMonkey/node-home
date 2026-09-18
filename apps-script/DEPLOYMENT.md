# Deploying the fridge.run authentication boundary

Read `IDENTITY.md` first. The deployment settings are not cosmetic — the wrong
combination produces a **silent total bypass**, not an error.

## 1. Script Properties (all configuration lives here, never in the repo)

Apps Script editor → **Project Settings** → **Script properties**:

| Property | Required | Value |
|---|---|---|
| `ALLOWLIST` | **yes** | comma-separated Google accounts, e.g. `you@gmail.com,someone@else.com` |
| `SHEET_ID` | no | the id from `docs.google.com/spreadsheets/d/<ID>/edit` |

`ALLOWLIST` unset or empty **denies everyone**. That is deliberate: the failure
mode of a missing config must be "no access", never "all access".

`SHEET_ID` is optional on purpose. Authentication must work without it — Sheets
is a datastore behind the boundary, not the IAM authority.

## 2. Choose ONE deployment configuration

**Deploy → New deployment → type: Web app.**

### A. Single admin — recommended, strongest

```
Execute as:      Me (your account)
Who has access:  Only myself
```

Google itself refuses to invoke the script for anyone else, so there are two
independent layers: Google's access control, then the allowlist check. Use this
unless you actually need to admit other people.

### B. Multiple people

```
Execute as:      User accessing the web app
Who has access:  Anyone with a Google Account
```

Required if others must sign in, because **only this mode populates
`getActiveUser()` for non-owners**.

Consequences to plan for:
- The script runs with **each caller's** permissions, so any Sheet it touches
  must be shared with them. If it is not, the page still authenticates and shows
  AUTHORIZED, then reports the datastore as unavailable — by design.
- Each new user is prompted once to authorise the script's scopes.

### NEVER use

```
Execute as:      Me
Who has access:  Anyone with a Google Account   (or Anyone)
```

`getActiveUser()` is blank for every caller but you, so callers are
indistinguishable. This script **detects that combination and refuses to serve
protected content**, but do not rely on that — do not deploy it this way.

## 3. Wire up the button

Copy the deployment's `/exec` URL into `fridge-iam-config.js` at the repo root:

```js
window.__FRIDGE_IAM__ = { endpoint: 'https://script.google.com/macros/s/AKfyc.../exec' };
```

Until that is set, the LOGIN WITH FRIDGE button renders **disabled** with an
explanation rather than pretending to work.

---

# Test procedure

Run `selfTest()` from the editor first. It logs both identity calls, the
allowlist size and whether `SHEET_ID` is set. Note its own caveat: **running
from the editor you are always the owner**, so it cannot prove the deployed mode
is safe. Only the `/exec` URL can.

| # | Test | How | Expected |
|---|---|---|---|
| 1 | **Owner succeeds** | Open `/exec` signed in as an allowlisted account | `AUTHORIZED` + `Signed in as <you>` |
| 2 | **Non-allowlisted account fails** | Open `/exec` in a private window as a *different* Google account (or add a second account and switch) | `DENIED`, no sheet data, no allowlist contents |
| 3 | **Missing allowlist fails closed** | Delete the `ALLOWLIST` property, reload `/exec` as the owner | `DENIED` — absence of config must not grant access |
| 4 | **URL knowledge grants nothing** | Send `/exec` to a non-allowlisted account, or open it signed out | Google login wall, then `DENIED`. Never protected content |
| 5 | **No identity leakage on denial** | View source of a `DENIED` response | No email addresses, no allowlist, no sheet rows |
| 6 | **JSON path is equally gated** | `GET /exec?format=json` as a non-allowlisted account | `{"ok":false,"status":"DENIED",...}` and nothing else |
| 7 | **Writes are attributed** | Submit the write form as an allowlisted user (needs `SHEET_ID`) | New row carries the verified email, not a client-supplied one |

Restore `ALLOWLIST` after test 3.

## What a pass actually demonstrates

- Identity originates from **Google, server-side**. The browser never supplies
  it, so there is no field to tamper with.
- Authorisation **fails closed** on: blank identity, empty allowlist, unlisted
  identity, and unidentifiable deployment mode.
- Knowing the `/exec` URL conveys no access.
- Sheets can be absent, broken, or unshared and the boundary still holds.

## What it does NOT demonstrate

- Nothing about the public static site. `fridge.run` remains world-readable, and
  anything it fetches (`status.json`) is public. Sensitive data must be served
  **by this script**, never from the static page.
- No protection against a compromised Google account. Google is the
  authentication authority; this inherits its security properties.
