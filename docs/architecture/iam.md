# fridge.run IAM architecture — decision document

Status: **proposal, nothing implemented.** No IdP installed, no DNS or MX change,
no ports opened, no users created. The working Apps Script boundary is untouched.

Scope: how `charlie@fridge.run` becomes a *real* identity, and who is allowed to
assert it.

## The invariant

```
IdP           proves   WHO YOU ARE
fridge.run IAM decides WHAT YOU MAY DO
each service decides   WHAT THOSE PERMISSIONS MEAN
```

Nothing under caller control — browser JavaScript, a form field, a header, a
query parameter, a claimed email — may ever become authoritative identity.

---

## 1. What was verified, and what was not

Security-relevant claims, checked against primary sources on **2026-09-17**:

| Claim | Source | Result |
|---|---|---|
| `getActiveUser().getEmail()` returns blank for web apps deployed "execute as me" | [Class Session](https://developers.google.com/apps-script/reference/base/session) | **Confirmed.** Basis of the bypass fixed in `bb46c71` |
| `getEffectiveUser()` returns the developer's account in that mode | same | **Confirmed** |
| OIDC `sub` is stable and never reassigned | [OIDC Core §2](https://openid.net/specs/openid-connect-core-1_0.html) | **Confirmed verbatim**: "A locally unique and **never reassigned** identifier within the Issuer for the End-User" |
| Cloud Identity **Free**: custom domain, ~50 users, **no Gmail**, no cost | [Cloud Identity editions](https://docs.cloud.google.com/identity/docs/editions) | **Confirmed** |
| Keycloak ≈1 GB RAM; Authentik ≈250–350 MB; Authelia <30 MB (forward-auth); Pocket ID ≈256 MB, passkey-first | vendor/comparison sources (secondary) | **Indicative, not primary.** Verify before committing |

**Not verified — do not rely on these as quoted:**

- OIDC Core **§5.7 Claim Stability and Uniqueness** and the **`email_verified`**
  definition could not be extracted from the spec page (large, anchor-driven
  document). The `sub` definition above is quoted directly and is sufficient to
  justify the keying decision below, but §5.7's exact wording remains unread.
  **Read it before relying on any email-stability argument.**
- Whether Cloud Identity Free domain verification can be completed **without**
  touching MX. It should be TXT/CNAME-based since no Gmail is involved, but this
  was not confirmed against Google's verification docs, and MX changes are
  explicitly out of scope. **Verify before adopting Option A.**

---

## 2. Six things `charlie@fridge.run` could mean

Conflating these is the central risk. They are independent.

| Concept | What it is | Who can assert it | Trustworthy alone? |
|---|---|---|---|
| **Email address** | a mailbox route (MX) | anyone who controls MX for the domain | **No** — proves delivery, not identity |
| **Username / account id** | a login handle in some system | that system | Only within it |
| **OIDC `sub`** | issuer-local, **never reassigned** id | the issuer | **Yes, with `iss`** |
| **Display name** | human label | anyone | **No** — cosmetic |
| **`email_verified` claim** | issuer asserts it checked control *at some past moment* | the issuer | Only as strong as the issuer, and **only about the past** |
| **Domain ownership** | DNS control over `fridge.run` | whoever holds the registrar account | Foundational, but a different fact |

**The rule that follows:** authorization must key on **`(iss, sub)`**, never on an
email string. Email is a *label* that may be displayed and may be used for
initial enrolment, never a key.

> **This is a live defect.** `apps-script/Code.gs` currently keys `ALLOWLIST` on
> lowercased email (`isAuthorised_`). It is safe *today* only because Google is
> the sole issuer and controls the mailbox namespace. It becomes unsafe the
> moment a second issuer exists, or an address is reassigned. Fixing this is the
> recommended next step (§8).

### Today's DNS reality

`fridge.run` already has **MX → Namecheap email forwarding** plus an SPF record.
So `charlie@fridge.run` may already *receive mail*. That is email hosting, and it
is **not** identity. Any design must keep these separable — and note that
adopting a Google-hosted mailbox would collide with the existing forwarding.

---

## 3. Architecture A — Google-first (Cloud Identity Free)

```
charlie@fridge.run  ──►  Google (Cloud Identity Free, domain fridge.run)
                              │  authenticates, issues ID token / session
                              ▼
                         Apps Script  ──►  authorizes on (iss, sub)
                              ▼
                         fridge.run services
```

| Question | Answer |
|---|---|
| Authoritative IdP | **Google** |
| Authenticates the user | Google |
| Issues sessions/tokens | Google |
| Apps verify tokens | Google libraries / Apps Script's built-in identity |
| Authorization & roles | **fridge.run**, in Apps Script (and later a roles store) |
| Email address | Independent. Cloud Identity Free has **no Gmail**, so existing Namecheap MX forwarding can remain |
| OIDC/OAuth2 | Yes, mature |
| MFA / passkeys | Yes — Google supports passkeys and hardware keys today |
| Public reachability needed | **None.** Google is already public; fridge stays unreachable |
| TLS / reverse proxy | None required |

**Strengths.** Zero new attack surface on fridge. Zero cost. Real
`charlie@fridge.run` identities. MFA and passkeys are already implemented, by a
team that does this full time. Nothing to patch, back up, or restore. Works
regardless of whether fridge is up.

**Weaknesses — argued adversarially.**
- **Google becomes authoritative for your domain's identity namespace.** Account
  suspension is famously abrupt and hard to appeal; it would revoke *every*
  identity at once, including the administrator's.
- Requires trusting Google's verification of domain ownership, and reversing it
  later is fiddly.
- Ties the design to Apps Script's identity model, which has already produced one
  subtle bypass.

---

## 4. Architecture B — Self-hosted IdP on fridge

```
charlie@fridge.run  ──►  IdP on fridge (Keycloak / Authentik / Pocket ID)
                              │  authenticates, issues OIDC tokens
                              ▼
                         fridge.run services verify JWT via JWKS
```

| Question | Answer |
|---|---|
| Authoritative IdP | **fridge** |
| Issues tokens | the IdP, signed with its own keys |
| Apps verify tokens | JWT signature via the IdP's JWKS endpoint |
| Authorization & roles | in the IdP (groups/roles) **or** still in fridge.run |
| Public reachability | **Required** for browser redirects from anywhere but the LAN/tailnet |
| TLS | Required; an IdP on plain HTTP is not an IdP |

Candidates (footprints indicative, unverified):

| | RAM | Character |
|---|---|---|
| **Keycloak** | ~1 GB | Full enterprise IdP. Realms, federation, fine-grained roles. Heaviest ops burden |
| **Authentik** | ~250–350 MB | Full IdP, friendlier UI, multi-container |
| **Pocket ID** | ~256 MB | **Passkey-first**, single container, deliberately minimal |
| **Authelia** | <30 MB | Primarily **forward-auth**; not a general-purpose IdP for third-party OIDC clients |

fridge has ~13 GB RAM free and 4 cores, so **resources are not the constraint.**

**Two blockers specific to this environment:**

1. **Circular dependency.** The IdP would run on the machine it protects — a 2012
   Mac Mini with a documented boot-failure history, one network path, and 34
   deliberately held packages. *If fridge is down, you cannot authenticate to fix
   fridge.* The IAM system would become the least reliable component protecting
   the least reliable machine.
2. **fridge is not publicly reachable.** Under the assume-CGNAT decision there is
   no inbound path. OIDC requires the *browser* to reach the IdP, so remote login
   would be impossible without exactly the tunnel/VPS that was ruled out.

---

## 5. Threat model

`A` = Google-first, `B` = self-hosted. **✔** mitigated, **⚠** residual.

| Threat | A | B |
|---|---|---|
| **Forged browser identity** | ✔ identity never leaves the server side | ✔ signed token, verified server-side |
| **Direct endpoint access** | ✔ fails closed; URL knowledge grants nothing | ✔ if every route validates the token — **⚠** one unguarded route is a hole |
| **Token theft / replay** | ✔ Google session controls, revocation | ⚠ **you** must set lifetimes, rotation, revocation |
| **CSRF** | ⚠ Apps Script gives no CSRF token; state-changing POSTs need their own | ⚠ standard `state`/`nonce` + per-form tokens required |
| **Redirect URI abuse** | ✔ Google enforces exact-match registration | ⚠ **your** misconfiguration; wildcards are the classic own-goal |
| **Compromised client app** | ⚠ can act as the user within its scopes | ⚠ same, plus it may hold a client secret |
| **Compromised fridge** | ✔ **identity survives** — IdP is elsewhere | ✘ **total compromise**: signing keys, all sessions, all identities |
| **Compromised Google account** | ✘ **total compromise** | ✔ unaffected |
| **Privilege escalation / role confusion** | ✔ roles live in fridge.run, not the IdP | ⚠ roles in IdP tokens; a token minted with extra roles is believed |
| **Stale / revoked users** | ✔ revoke centrally at Google | ⚠ needs deliberate revocation + short token lifetimes |
| **Lost MFA / passkey** | ✔ Google account recovery | ✘ **you** are the recovery process; easy to lock yourself out permanently |
| **IAM database loss** | ✔ nothing local to lose | ✘ lose the DB and every identity and client registration is gone |
| **Signing-key compromise** | ✔ Google's problem, rotated centrally | ⚠ **your** problem; rotation must be designed *before* it is needed |

**The threat models are near mirror images.** A concentrates risk in *Google*;
B concentrates it in *fridge*. The honest question is which single point of
failure you would rather have — and in this environment, fridge is measurably the
less reliable of the two.

---

## 6. What happens when something is down

| Unavailable | A (Google) | B (self-hosted) |
|---|---|---|
| **Comcast / WAN** | ✘ no login (Google unreachable) | ✔ LAN/tailnet login still works |
| **Google** | ✘ no login at all | ✔ unaffected |
| **fridge** | ✔ **identity unaffected**; protected services are down anyway | ✘ **no login anywhere**, including to fix fridge |
| **LAN** | ✔ login works from anywhere | ✘ no access |
| **Cloudflare** | ✔ not used | ✔ not used |

B's one genuine advantage: **it still works during an internet outage.** That
matters if local services must be reachable when the WAN is down — worth weighing,
since fridge already serves household DNS.

---

## 7. Operational burden

| | A | B |
|---|---|---|
| Install / upgrade | none | container lifecycle, DB migrations, breaking releases |
| Backup / restore | none | DB + signing keys + client registrations, **and a tested restore** |
| TLS certs | none | required, renewed, monitored |
| Public exposure | none | required for remote login |
| Cost | $0 | $0 + your time, indefinitely |
| Break-glass | Google account recovery | **you must design it**, without leaving a permanent bypass |

Tardigrade doctrine applies directly: *do not claim rollback exists until it is
implemented and tested.* Option B adds a component whose restore procedure would
have to be **tested on real hardware** before it could be trusted — and until
then, self-hosted IAM is an untested dependency in the authentication path.

---

## 8. Recommendation

**Stay with Google as the IdP. Do not self-host IAM on fridge — yet.**

Reasoning specific to this environment, not in general:

1. **Self-hosting IAM on fridge is circular.** The IdP would guard the machine it
   runs on, and that machine is the fragile one. Losing fridge would mean losing
   the ability to authenticate in order to repair fridge.
2. **fridge cannot be reached from outside.** Under assume-CGNAT, browser-based
   OIDC redirects cannot complete remotely. Self-hosted IAM would require
   precisely the tunnel/VPS already rejected.
3. **The security benefit is a swap, not a gain.** It moves the single point of
   failure from Google to a 2012 Mac Mini with a boot-failure history.
4. **Cloud Identity Free already delivers the actual goal** — real
   `charlie@fridge.run` identities, $0, no Gmail, no MX change, MFA and passkeys
   already implemented.

**Staged plan:**

- **Stage 0 (now, independent of everything else).** Re-key authorization from
  email to **`(iss, sub)`**. This is correct under *every* future architecture and
  removes the latent defect described in §2.
- **Stage 1 (when `charlie@fridge.run` is genuinely wanted).** Adopt **Cloud
  Identity Free**, after verifying domain verification needs no MX change. Keep
  Namecheap forwarding for mail. Identity and email stay separate.
- **Stage 2 (only if a real trigger appears).** Self-host an IdP — and if so,
  **not on fridge**, and passkey-first (Pocket ID) over Keycloak unless SAML or
  federation is genuinely needed. Triggers: needing login during WAN outages;
  refusing to depend on Google; or more than a handful of users.

**Do not build Homemade Keycloak™.** The line: fridge.run may store *roles and
policy* (what an identity may do). It must never store *credentials*, mint
*sessions*, or verify *passwords*. The moment Sheets or Apps Script holds a
secret that authenticates a human, that line has been crossed.

---

## 9. Migration path from the current Apps Script IAM

The current design survives either future, because it already separates
authentication (Google) from authorization (Apps Script).

1. **Re-key to `(iss, sub)`** — email becomes a display label only.
2. **Move the allowlist to a roles map** — `sub → [roles]` — still in Script
   Properties, still fail-closed.
3. **Services consume roles, not identities** — a service asks "does this caller
   hold role X", never "is this caller charlie".
4. **Swap the issuer later** if ever needed. Only step 1's key changes; steps 2
   and 3 are unaffected. That is the whole point of keying on `(iss, sub)`.

---

## 10. Lock-in and recovery dependencies

**Things that would create lock-in — avoid:**
- Keying authorization on email (today's defect). Re-keying later requires
  re-enrolling every user.
- Letting the IdP own roles. Roles in fridge.run stay portable across issuers.
- Making fridge.run services depend on Apps Script *specifically*, rather than on
  "a verified `(iss, sub)` plus roles".
- Adopting Cloud Identity without first confirming how to **un-verify** the domain.

**Recovery must never depend on IAM being alive:**
- **SSH to fridge must remain independent of fridge.run IAM.** It is the
  break-glass path. Never put the IdP in front of it.
- Backups and restore drills must not require authenticating through the IdP.
- Break-glass must be **physical console access**, not a standing bypass
  credential. A permanent emergency account is a permanent vulnerability; console
  access is a capability an attacker must be in the room to use.
- Recovery documentation must live somewhere readable when everything is down —
  which today means fridge's markdown *and* a copy off-machine.
