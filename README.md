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
| `index.html` | Access notice — entry page and the IAM hook |
| `dashboard/` | Node dashboard; renders `status.json` |
| `status.json` | Committed telemetry snapshot |
| `tools/collect-fridge-status.sh` | Regenerates the snapshot |
| `fridge-share-shell.css` | **The** stylesheet — every page uses this one |
| `media/warning-wall/` | Video-wall clips |
| `docs/` | Written documentation |
| `index.js`, `tools/`, `d.css`, `docker-compose.yml` | Express dashboard meant to run *on the node*, where real auth is possible |

## Refreshing the dashboard

```sh
tools/collect-fridge-status.sh > status.json
git add status.json && git commit -m "Refresh node status" && git push
```

The collector is **read-only** and needs no elevated privileges. It gathers host facts
over SSH and measures service health by **functional probe** — asking each service
whether it actually answers, rather than asking Docker whether a container is running.
A container that is "up" but no longer serving is a failure, and probing catches it.

Override the target with `FRIDGE_SSH` and `FRIDGE_IP` if addresses change.

## What is real

The previous site blurred this line, so it is stated plainly:

- **Real:** dashboard metrics, service health, disk usage, backup progress, the video wall.
- **Not real:** the "Proceed" button is a plain link, not authentication. Uploads and
  writes are unavailable.

## Why there is no IAM

GitHub Pages serves static files and runs no server-side code, so **any login written in
client-side JavaScript is decoration** — readable and bypassable in page source. Rather
than ship security theatre, the sign-in point is marked as a hook
(`data-iam-hook="proceed"`) and left honest.

Real identity requires one of:

| Approach | Public read | Real auth | Trade-off |
|---|---|---|---|
| Google Apps Script backend | yes | yes, verified server-side | Apps Script becomes the trust boundary |
| Serve from the node | tailnet only | yes | not publicly reachable |
| Reverse proxy on a VPS | yes | yes | recurring cost, another host |

The node is behind **CGNAT** and cannot accept inbound connections. Tailscale solves
reachability for known devices, but **Tailscale Funnel only serves its own `*.ts.net`
hostname** and cannot present a valid certificate for `fridge.run`, so Funnel alone
cannot put this domain in front of the node.

## Share bridge

`fridge-share-config.js` sets `origin` for the share bridge. It is intentionally **empty**.
It used to hold an ephemeral Cloudflare quick-tunnel hostname that had long expired, so
every share link resolved to a dead host. Quick tunnels are randomly named and vanish when
`cloudflared` stops, so they must never be committed as durable config. Set `origin` only
to a hostname the node reliably answers on.

## Related

The node's own operational documentation lives on the machine under
`~/fridge-docs/markdown/` — including the guarded update runbook, which explains why 34
packages are deliberately held and why this Mac boots via the removable EFI fallback path
rather than an NVRAM entry.
