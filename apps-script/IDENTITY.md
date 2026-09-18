# Identity semantics in Apps Script — why this implementation is shaped as it is

Verified against the official reference, **2026-09-17**:
<https://developers.google.com/apps-script/reference/base/session>

This file exists because the two identity calls look interchangeable, are not,
and choosing wrongly produces a **silent total authentication bypass** rather
than an error.

## The two calls

| Call | Documented meaning |
|---|---|
| `Session.getActiveUser()` | "the current user" — the person interacting |
| `Session.getEffectiveUser()` | "the user under whose authority the script is running" |

The reference states, for `getActiveUser()`:

> `User.getEmail()` returns a blank string [when] security policies [do not allow
> access to the user's identity] … including … **web apps deployed as "execute as me"**.
> These restrictions generally do not apply if the developer runs the script
> themselves or belongs to the same Google Workspace domain as the user.

And for `getEffectiveUser()`:

> For web apps set to "execute as me": returns **the developer's account**.

Both require the `https://www.googleapis.com/auth/userinfo.email` scope.

## Behaviour by deployment mode

| Execute as | Who has access | `getActiveUser()` | `getEffectiveUser()` | Usable for authz? |
|---|---|---|---|---|
| Me | **Only myself** | the owner | the owner | **Yes** — Google also refuses to run it for anyone else |
| Me | Anyone with a Google Account | **blank** | **the owner** | **NO — dangerous** |
| Me | Anyone (anonymous) | blank | the owner | **NO — dangerous** |
| User accessing | Anyone with a Google Account | the accessing user | the accessing user | **Yes** |
| User accessing | Only myself | the owner | the owner | Yes |

## The bypass this creates

An implementation that falls back from active to effective:

```js
return activeEmail || effectiveEmail;   // WRONG
```

under `Execute as: Me` + `Anyone with a Google Account` evaluates, for a
**stranger**, to `"" || owner` → **the owner's email** → passes any allowlist
containing the owner. Every visitor holding the `/exec` URL is authorised as
the owner. There is no error and nothing in the logs looks unusual.

This bug was present in the first version of `Code.gs` in this repository
(commit `be500cb`) and is fixed in the commit that added this document.

## The rule

**Authorise on `getActiveUser()` only. Never fall back to `getEffectiveUser()`.**

`getActiveUser()` is populated in exactly the modes where identifying the caller
is meaningful, and blank in exactly the mode where it is not. Treating blank as
"deny" therefore fails closed precisely when identity is unknowable.

`getEffectiveUser()` is still read, but **only to diagnose misconfiguration**: if
active is blank while effective is populated, the deployment is in the dangerous
mode, and the script refuses to serve protected data and says why.

## Division of responsibility

- **Google** authenticates. It establishes who the caller is; we never accept an
  identity asserted by browser JavaScript, a query parameter, or a header.
- **Apps Script** authorises. It compares the Google-verified identity against an
  allowlist held in Script Properties.
- **Sheets** is an optional datastore *behind* that boundary. It is **not** the
  IAM authority. Losing or replacing the sheet must not grant anyone access.
