# Getting the Refrigerator Emoji campaign running
## Operator and Claude handoff / GitHub Pages / concept-only version

**Project owner and credited organizer:** Charlie. **Site:** `https://fridge.run/emoji/`. **Repository:** `LuckyMonkey/node-home`. **Code directory:** `emoji/`. **Review branch:** `emoji-concept-only`. This page is a **concept gallery** and petition landing page, not a functioning Unicode emoji font.

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
- [ ] Page still contains meaningful content with JS disabled.
- [ ] Mobile view works at ~320, 375, 390, 768 px; Firefox and Safari preferred.
- [ ] Keyboard focus and contrast are acceptable; no page auto-play audio.
- [ ] No request to `go.fridge.run`, `auth.fridge.run`, or the home server is required.

Optional syntax/text checks, from repo root:

```bash
node --check emoji/campaign.js
grep -RniE 'linearGradient|radialGradient|GE badge|<script[^>]+fridge-shim' emoji/index.html emoji/concepts || true
git diff --check
```

The grep should find no forbidden markup. Search results in documentation are expected; inspect visuals separately.

## Phase B — GitHub PR review / merge when Charlie approves

All preparation lives on `emoji-concept-only` rather than on `main`. For review, use the draft PR. **Do not merge until Charlie wants the revised public site.** Pages publishing is triggered by merging or pushing these files to `main`.

Before merging:
1. Review all changed files in the PR; confirm only `emoji/` paths are touched.
2. Check that no removed font/installer links remain.
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
```

Expect HTTP 200 (some redirects are normal if they resolve to HTTPS and `/emoji/`). If a file 404s, check whether the correct `main` commit was published and whether the URL's case matches the filename.

Use the browser devtools Network panel to ensure **no external runtime dependencies**. A copy-link button may require HTTPS or localhost, which GitHub Pages provides.

Check mobile social shares. An `og:image` PNG is intentionally **not** supplied until a final approved campaign image exists. A future social raster should be saved under `emoji/assets/` and linked with an absolute URL so LinkedIn/Facebook scrapers can retrieve it.

## Phase D — Connect Change.org LATER (only after creation)

The petition does not exist yet. Once Charlie creates it, edit exactly this line in **`emoji/campaign.js`**:

```js
const PETITION_URL = "https://www.change.org/p/your-real-petition-slug";
```

The script currently accepts `https://www.change.org/` URLs; confirm the actual destination and update the validator only if Change.org supplies a different legitimate hostname. Do not use the previous **closed** petition. Sign buttons automatically unhide, and the pending banner hides.

**Before changing live site:** open new Change.org link in a private browser; check the campaign title, Charlie attribution, status and ability to sign. Test both buttons after deploy. Do not invent a signature count.

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

## Phase G — LATER: actual emoji font and compatibility shims (Claude task)

**NOT IN SCOPE FOR THIS BRANCH. No font should be generated during concept review.**

Once Charlie approves the shape, open a **new branch** such as `emoji-font-prototype` and create a nested folder `emoji/font/` (keep this subproject isolated).

The future Claude handoff should implement the following in order:

1. Read `emoji/DESIGN.md` and pick the final base concept. Make small-pixel optical adjustments at 16, 18, 24 and 72 px.
2. Define license, source provenance and font build pipeline first; commit actual generator/source files.
3. Make a monochrome single glyph in a TTF using an appropriate font builder. Use a **private-use area** codepoint solely for opt-in demos, and record why it **isn't** universal or officially assigned.
4. Optionally generate WOFF2 if dependency/runtime constraints justify it; test with fontTools/`ots-sanitize` or equivalent. Never store arbitrary unverified base64 blobs as the sole source of truth.
5. Create a *separate* full-color SVG/PNG rendering for the website. Do not promise that a basic monochrome TTF becomes a color emoji on every OS.
6. Add a simple opt-in `:fridge:` shortcode renderer in a new isolated module, transforming only rendered text nodes, not text users type into forms. No global monkeypatching or intercepting private data.
7. Add automated checks for missing glyph, collisions, CSS loading, and fallback when the font is absent.
8. Consider platform-specific integrations only with explicit user installation; iOS/Android native emoji pickers cannot be universally modified by shipping an HTML page or ordinary font.
9. Keep all experimental files under `emoji/font/` and version them independently; do not auto-edit the parent website's `main` branch.
10. Re-review accessibility, licensing, CSP, privacy, and deployment before merging any font work.

### Definition of done for the LATER font project

A reproducible build, readable glyph at 18px, screenshots on at least 2 desktop browsers and a mobile browser, clear limitations, tested fallback, portable `:fridge:` convention, and written rollback steps. Then and only then replace the current **concept-only** language on `/emoji/` with accurate functional claims.

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
| A font/installer link returns 404 | Correct: the concept-only branch deliberately **removed** premature font artifacts. |
| Non-emoji SVG appears on other websites | Their pages must independently support/render it; it is not an encoded Unicode emoji. |

**Immediate next action:** Review `emoji/concepts/classic-base.svg` and gallery; give Charlie final say on the silhouette before any font work.
