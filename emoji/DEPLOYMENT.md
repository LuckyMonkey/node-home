# Getting the Refrigerator Emoji campaign running
## Operator and Claude handoff / GitHub Pages / concept-only version

**Project owner and credited organizer:** Charlie. **Site:** `https://fridge.run/emoji/`. **Repository:** `LuckyMonkey/node-home`. **Code directory:** `emoji/`. **Review branch:** `emoji-concept-only`. This page is the campaign's concept gallery and petition landing page, plus a working **experimental** fridge: the Fridge Emoji font (U+E900, Private Use, not official Unicode) and an opt-in `:fridge:` shortcode.

This guide is written to be executed by Charlie or an AI coding assistant on a machine with git and a browser. It is intentionally explicit to prevent accidental changes to the rest of Fridge.run.

## Architecture / deployment truth

```
GitHub repository LuckyMonkey/node-home
  ├── index.html          existing fridge.run homepage [LEAVE ALONE]
  ├── CNAME               existing custom-domain binding [LEAVE ALONE]
  ├── .nojekyll           existing Pages behavior [LEAVE ALONE]
  ├── fridge-shell.css    existing shared site shell [LEAVE ALONE]
  ├── ...
  └── emoji/              SELF-CONTAINED CAMPAIGN SUBPROJECT
       ├── index.html
       ├── style.css
       ├── campaign.js
       ├── concepts/*.svg
       ├── assets/label-3x2.zpl
       ├── README.md
       ├── DESIGN.md
       ├── DEPLOYMENT.md
       └── RUNBOOK.md
```

The existing `node-home` README says GitHub Pages uses **legacy branch publishing: `main` at repository root**. The `docs/` directory is NOT the Pages publication directory. The prior GitHub Actions Pages deployment workflow was removed because it appeared successful yet did not publish anything. **Do not reintroduce that workflow.**

The homepage, auth routes, status, CNAME, root CSS and site infrastructure are not part of this subproject. The Mac mini (Fridge node), Caddy, Cloudflare tunnel, PHP, Docker, and Tailscale are not involved in the campaign's public HTML.

## Phase A — Review and local test (NO PUBLIC DEPLOY)

Clone once or use your existing checkout:

```bash
git clone https://github.com/LuckyMonkey/node-home.git
cd node-home
git fetch origin
git switch emoji-concept-only
```

If you already have local changes, **do not forcibly switch or reset**: stash/commit them first, or use a separate clean worktree. Verify your branch:

```bash
git status --short
git branch --show-current  # emoji-concept-only
```

Launch a local static HTTP server from the **repository root**. Choose ONE of these options based on tools you already have:

```bash
npx --yes serve . -l 8080          # Node / npx option, may install serve
# or:
php -S 127.0.0.1:8080 -t .         # PHP option, no npm dependency
```

Open **http://localhost:8080/emoji/**. The favicon, CSS, icons, and JS should resolve relative to `/emoji/`. Do not open `index.html` via `file://` for the final test—relative fetch/CSP and hosting behavior can differ.

Smoke checks:
- [ ] Page heading “WHERE'S OUR FRIDGE EMOJI?” appears; hero contains the **small flat white fridge**, not the old blue one.
- [ ] Four independent OS-inspired SVG thumbnails appear; canonical/iOS/Windows/Android are white top-freezer right-handle models, while Samsung-inspired uses flat stainless French doors over a freezer drawer.
- [ ] The 32px, 24px, and 18px previews are readable.
- [ ] Text states the designs are unofficial, **not** actually made by Apple/Microsoft/Google/Samsung.
- [ ] A pending-petition message appears; **no fake Sign the Petition link**.
- [ ] Share button copies a clean `https://fridge.run/emoji/` link (or opens native share UI).
- [ ] *02 / Try it*: the font glyph shows as a fridge (caption says "Font loaded ✓"); typing `:fridge:` in the box renders a fridge; Copy, Copy U+E900 (with its warning) and Export PNG work.
- [ ] `http://localhost:8080/emoji/tests/shim-test.html` ends with "… passed, 0 failed".
- [ ] Page still contains meaningful content with JS disabled.
- [ ] Mobile view works at ~320, 375, 390, 768 px; Firefox and Safari preferred.
- [ ] Keyboard focus and contrast are acceptable; no page auto-play audio.
- [ ] No request to `go.fridge.run`, `auth.fridge.run`, or the home server is required.

Optional syntax/text checks, from repo root:

```bash
node --check emoji/campaign.js emoji/fridge-emoji.js emoji/demo.js
sh emoji/font/build.sh            # rebuilds the font and runs validate.py (must end "OK: 0 failure(s)")
git status --short emoji/font     # a rebuild from unchanged source must not change the font files
grep -RniE 'linearGradient|radialGradient|GE badge|<script[^>]+fridge-shim' emoji/index.html emoji/concepts || true
git diff --check
```

The grep should find no forbidden markup. Search results in documentation are expected; inspect visuals separately.

## Phase B — GitHub PR review / merge when Charlie approves

All preparation lives on `emoji-concept-only` rather than on `main`. For review, use the draft PR. **Do not merge until Charlie wants the revised public site.** Pages publishing is triggered by merging or pushing these files to `main`.

Before merging:
1. Review all changed files in the PR; confirm only `emoji/` paths are touched.
2. Check that no links point at the *old* removed prototype files (`assets/FridgeEmoji-Regular.ttf.b64`, `fridge-shim.js`, `fridge-emoji.user.js`, `emoji/install-linux.sh`); the new font lives in `emoji/font/`.
3. Check that `emoji/campaign.js` still has `PETITION_URL = ""` unless the actual petition exists.
4. Double-check that default Pages branch and root have not been changed.
5. Merge using GitHub only when ready.

Once merged, Pages publishes `https://fridge.run/emoji/`. No Docker restart, no Caddy configuration, no Cloudflare tunnel change, no DNS change.

## Phase C — Verify published site

After merge, open **https://fridge.run/emoji/** from an incognito mobile browser and verify all assets load. Commands:

```bash
curl -I https://fridge.run/emoji/
curl -I https://fridge.run/emoji/style.css
curl -I https://fridge.run/emoji/concepts/classic-base.svg
curl -I https://fridge.run/emoji/font/FridgeEmoji-Regular.woff2   # 200, content-type font/woff2
curl -I https://fridge.run/emoji/fridge-emoji.js
```

Expect HTTP 200 (some redirects are normal if they resolve to HTTPS and `/emoji/`). If a file 404s, check whether the correct `main` commit was published and whether the URL's case matches the filename.

Use the browser devtools Network panel to ensure **no external runtime dependencies**. A copy-link button may require HTTPS or localhost, which GitHub Pages provides.

Check mobile social shares. An `og:image` PNG is intentionally **not** supplied until a final approved campaign image exists. A future social raster should be saved under `emoji/assets/` and linked with an absolute URL so LinkedIn/Facebook scrapers can retrieve it.

## Phase D — Change.org petition link (configured)

On 17 November 2026 Charlie supplied the petition short link:

`https://c.org/wL4PCmNc9s`

`emoji/campaign.js` now contains:

```js
const PETITION_URL = "https://c.org/wL4PCmNc9s";
```

The validator allows the official `c.org` Change.org short-link host and normal Change.org URLs. Both Sign buttons become visible and the "coming soon" banner hides when JavaScript runs.

**Verification still required:** Open the link in a private browser and confirm it reaches Charlie's **active refrigerator emoji** petition, permits signing, and contains the intended campaign attribution. The redirect could not be independently fetched in the assistant environment. Do not claim a signature count from this configuration alone.

If the petition link changes or closes, edit `PETITION_URL` and recheck both buttons. Keep print QR labels pointing to the permanent `https://fridge.run/emoji/` landing page, not to the short link.

## Phase E — QR sticker pilot AFTER petition works

`emoji/assets/label-3x2.zpl` is a Zebra Programming Language source intended for ~3×2 inch stock at **203 dpi**: `^PW609`, `^LL406`.

- The QR points to `https://fridge.run/emoji/?src=bag`; the front door can be updated even if the external petition URL changes.
- `src=bag` is only a URL tag; there is **no tracking system** installed.
- Different Zebra models accept different command sets. Test with the exact connected printer, media calibration, and a phone camera before any batch.
- Do not print or distribute “SIGN THE PETITION” labels while the petition is pending.
- Get explicit store/manager permission before placing labels on bags, counters, or community boards. Do not obscure any product barcode, price, safety information or food packaging label.
- Pilot ten labels; verify scannability at arm's length, then scale modestly.

A PNG/PDF poster can be designed later using the finalized concept, without altering the emoji source SVGs.

## Phase F — Unicode submission (completely separate)

Follow current submission guidelines: https://www.unicode.org/emoji/proposals.html

A Change.org petition is a public-awareness tool, **not** part of the technical usage-evidence standard. Build a separate empirical research dossier, choose one generic, unbranded reference drawing, and produce the image dimensions and licenses required **at time of submission**. Credit Charlie as organizer and proposer if Charlie writes/submits it. Do not present this site's OS-inspired illustrations as official platform artwork.

## Phase G — The font and the `:fridge:` shortcode (built 2026-11-17)

Implemented on branch `emoji-font`, all under `emoji/`:

- `emoji/font/`: glyph source, `build.py` (fontTools), `validate.py` (OTS, cmap, metrics, FreeType renders at 16/18/24/72),
  `build.sh`, `install-linux.sh` (per-user, no root), `FridgeEmoji-Regular.ttf` + `.woff2`, `OFL.txt`, `README.md`.
- `emoji/fridge-emoji.css` (`@font-face` limited to U+E900) and `emoji/fridge-emoji.js` (opt-in renderer; skips form
  fields, contenteditable, code; DOM nodes only, never HTML parsing).
- `emoji/index.html` section *02 / Try it* + `emoji/demo.js`; `emoji/tests/shim-test.html`.

To change the glyph: edit `emoji/font/src/fridge-glyph.svg`, run `sh emoji/font/build.sh`, look at
`emoji/font/build/previews/`, commit source + fonts together, then go through Phases A–C. Untested platforms are listed
in `emoji/font/README.md`; do not claim support beyond that table.

## Phase H — Rollback

This subproject does not modify the main site's infrastructure. If the **future merged** concept page is faulty, revert the PR merge commit in `node-home` on `main`; let Pages publish the last known-good version. Verify `/emoji/` and the homepage. Do not revert other unrelated concurrent commits.

## Troubleshooting

| Symptom | Check |
|---|---|
| Root homepage still works but `/emoji/` shows old design | PR may not have merged; Pages reads `main` only. |
| CSS/graphics missing locally | Serve repo root, not `emoji/` using the same URL path. |
| White fridge disappears on white background | Ensure the dark outline is present; inspect the 18px variant samples. |
| Share button does nothing | Verify HTTPS/localhost clipboard permission or native share support; fallback shows a prompt. |
| Petition button hidden | This is intentional while `PETITION_URL = ""`. |
| QR scan works but cannot sign | Petition is not live or petition URL is wrong; stop sticker distribution. |
| A font link returns 404 | The new font is `emoji/font/FridgeEmoji-Regular.(ttf|woff2)`; the old `assets/*.b64` prototype is gone on purpose. |
| U+E900 shows a box in Firefox on Ubuntu | Snap Firefox ignores `~/.local/share/fonts`; pages must load the web font (fridge.run/emoji does). See `font/README.md`. |
| Non-emoji SVG appears on other websites | Their pages must independently support/render it; it is not an encoded Unicode emoji. |

**Immediate next action:** Create the Change.org petition, then set `PETITION_URL` (Phase D).
