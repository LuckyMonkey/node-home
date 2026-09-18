# node-home — fridge.run

Public front door for **fridge**, a 2012 Mac mini (Macmini6,1) running Ubuntu Server
that provides DNS, ingress, chat and backup quorum for a home network.

Live at **https://fridge.run**

## Deployment — one path only

GitHub Pages is configured in **legacy mode**, publishing the `main` branch at `/`
(the repository root). Push to `main` and it deploys.

> A `Deploy GitHub Pages` workflow previously uploaded `./docs` and reported success on
> every push **while being completely ignored**, because legacy branch mode takes
> precedence. Editing `docs/` looked like it worked and changed nothing. That workflow has
> been removed so there is exactly one deployment path. If you ever switch Pages to
> `workflow` build type, restore it deliberately — don't run both.

## Layout

| Path | Purpose |
|---|---|
| `index.html` | Access notice — entry page and the sign-in button |
| `status/` | Live node status; renders the node's own status document |
| `login/` | OpenID Connect handoff to Keycloak |
| `404.html` | Not-found page |
| `fridge-shell.css` | **The** stylesheet — every page uses this one |
| `fridge-iam-config.js` | Identity provider endpoint |
| `.well-known/webfinger` | OIDC issuer discovery for `@fridge.run` addresses |
| `media/warning-wall/` | Video-wall clips |
| `docs/architecture/` | Design documentation |

This site is **four pages**. It deliberately links to no dashboards and no group
panels: those live behind identity, on the node, where a server can actually enforce
access. A static site cannot, so it does not pretend to.

## Status is measured, not committed

`status/` fetches `https://auth.fridge.run/status.json`, which is produced on the node
by `/usr/local/bin/fridge-status-probe` under a systemd timer, once a minute.

This replaced a hand-committed `status.json` snapshot. That snapshot was frozen at the
moment someone last ran the collector, which meant the page reported every service
healthy for as long as nobody refreshed it — a status page that could not go red.

Design rules for that page:

- **Stale is not healthy.** Past three intervals the lights go grey and say so.
- **Unreachable is not healthy.** If the fetch fails, grey, not green.
- **Colour is never the only signal.** Every row carries a colour, a glyph shape and a
  text label, so the page still reads under colour-blindness or in greyscale.
- **Names and states only.** No addresses, ports, versions or counts are published.

## Identity

Sign-in goes to **Keycloak on this network's own domain** (`auth.fridge.run`), not to a
third-party identity provider. Keycloak is first in line: identity is resolved on the
public internet, and only then does SSH over the tailnet become relevant.

The node is **not** behind CGNAT — an earlier version of this file assumed it was. That
was disproven directly: Let's Encrypt's validation servers reached this box from the
public internet over `tls-alpn-01` on port 443 and issued a publicly trusted certificate
for `auth.fridge.run`. ACME can only validate by connecting inbound, so the certificate
is itself the proof.

## Related

The node's own operational documentation lives on the machine under
`~/fridge-docs/markdown/` — including the guarded update runbook, which explains why 34
packages are deliberately held and why this Mac boots via the removable EFI fallback path
rather than an NVRAM entry.
