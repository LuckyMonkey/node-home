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
| `media/wall/` | Video-wall clips (web encodes of the three Sora originals) and their posters |
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

## Background music (optional)

**"Cellar Light"** - an original ambient loop: a quiet wander through a strange, roomy place. A soft low frame drum
and a muted higher hand drum keep a slow pulse (68 BPM, no dance beat); faint irregular shakers and seed-pod rattles sit
well back; a dark, breathing pad moves through D dorian (Dm9 - Bbmaj7 - Gm9 - C6/9) under sparse kalimba-like plucks
with echo. 32 bars, about 1 min 53 s, seamless.

- **Source and licence:** synthesised from scratch by `tools/ambient/compose.py` (Python + numpy; drums, shakers,
  pad, plucks and reverb are all generated - no samples, no third-party audio). Written for fridge.run; it is the
  site's own, under the repository's terms. It is not based on, and does not imitate, any existing track.
- **Files:** `media/music/cellar-light.ogg` (Ogg Opus, 72 kb/s, ~1 MB) and `cellar-light.m4a` (AAC, ~1.4 MB) for
  browsers without Ogg (older Safari / iOS). Each holds one loop plus a few seconds of the same audio either side;
  the player loops between `LOOP_START` (1.0 s) and `LOOP_START + LOOP_LEN` (112.941176 s), so the loop stays
  gapless even when a decoder adds priming delay. Peak -9 dBFS, average about -26 dBFS: quiet, lots of headroom.
- **Player:** `fridge-music.js` (the control's look is in `fridge-shell.css`, `.fm`). Off until pressed - nothing
  is downloaded or played before a click. Play/pause, mute and volume are remembered in this browser; the loop
  position is kept for the tab, and after a link the music resumes on the first click or key press on the new
  page (never before). One tab plays at a time. Fades in and out; still indicator under reduced motion; works
  with keyboard and screen readers; a missing file or old browser just shows "Music unavailable". Nothing is sent
  anywhere.
- **On which pages:** the ones that load the script - `index.html`, `404.html`, `status/`, `phone/` (not the
  redirect-only pages).
- **Replace it:** put new files at the same paths (a seamless loop, with the loop's start and length in
  `LOOP_START`/`LOOP_LEN` at the top of `fridge-music.js`), or edit and re-run `python3 tools/ambient/compose.py`
  (needs numpy and ffmpeg with libopus). **Disable it:** remove the `<script src="/fridge-music.js" defer>` line
  from a page, or from all four to drop it from the site.
- **Checks** (no build step here, so a checklist): no request for `media/music/` until the play button is pressed;
  Enter/Space on the focused play button toggles it; mute and volume survive a reload; following a link keeps the
  choice and resumes only after a click; paused stays paused after a reload; one control per page; with
  prefers-reduced-motion the playing bars stay still; blocking the music file shows a message and the page still
  works. These were run in headless Firefox (20/20) - see the commit message.
