# Refrigerator Emoji Initiative — concept subproject

**Organizer:** Charlie  
**Host when approved:** https://fridge.run/emoji/  
**Repository:** `LuckyMonkey/node-home`  
**Branches:** `emoji-concept-only` (artwork review, PR #3) → `emoji-font` (working font + shortcode). GitHub Pages publishes `main`.  
**Status:** Campaign petition link supplied by Charlie and connected to the site's signing CTA on 17 November 2026: https://c.org/wL4PCmNc9s. The destination's live signing status still needs an independent browser test. No Unicode approval. An **experimental** font (one glyph at Private Use code point U+E900) and an opt-in `:fridge:` shortcode exist and work; neither is an official emoji.

## The point

The world has a fax machine emoji and no standard refrigerator emoji. Charlie is organizing a public campaign to change that. Fridge.run is the campaign website, **not** the credited inventor or standards submitter.

This folder is intentionally independent of the home server. It is a static website built from ordinary HTML/CSS/JavaScript and local SVG artwork. No Node build, React, PHP, Docker, identity provider, tunnel, analytics, or API is needed to publish it.

**Deployment:** The campaign is published from `main` at the repository root through GitHub Pages. Keep future changes isolated under `emoji/`.

## Current deliverables

| Path | Purpose |
|---|---|
| `index.html` | Campaign landing page with **concept-only** gallery |
| `style.css` | Standalone responsive design; no parent CSS dependencies |
| `campaign.js` | Share/copy link and *disabled-until-configured* petition CTA |
| `concepts/classic-base.svg` | Canonical unbranded fridge silhouette |
| `concepts/ios-inspired.svg` | Unofficial soft/rounded example |
| `concepts/windows-inspired.svg` | Unofficial geometric/flat example |
| `concepts/android-inspired.svg` | Unofficial bold/high-contrast example |
| `concepts/samsung-inspired.svg` | Unofficial flat stainless French-door refrigerator with bottom freezer drawer |
| `assets/label-3x2.zpl` | Optional Zebra label, **hold printing until petition is live** |
| `font/` | **Fridge Emoji** font: glyph source, reproducible build, validator, Linux installer, TTF + WOFF2 (see `font/README.md`) |
| `fridge-emoji.css` | `@font-face` (U+E900 only) and `.fridge-glyph` for pages that opt in |
| `fridge-emoji.js` | Opt-in `:fridge:` / `:refrigerator:` renderer, `FridgeEmoji.render(element)`; no dependencies, no tracking |
| `demo.js` | The page's *Try it* section: playground, copy buttons, transparent PNG export |
| `tests/shim-test.html` | In-browser self-test for `fridge-emoji.js` (open it; every line should say PASS) |
| `LICENSE-CODE.txt` | MIT for the scripts; the font is OFL 1.1 (`font/OFL.txt`) |
| `DESIGN.md` | Visual requirements and review criteria |
| `DEPLOYMENT.md` | Developer / Claude handoff, local checks, release process |
| `RUNBOOK.md` | Grassroots, industry, communications, standards plan |

**The font exists and is experimental.** `font/` builds *Fridge Emoji* from the approved classic reference (white, top freezer, right-side handles). It maps only **U+E900**, a Private Use code point that is this project's convention, not Unicode's: it shows as a fridge only where the font is installed or loaded. The older prototype font, userscript and installer that were removed during concept review stay removed; the new ones live under `font/` with their sources.

## First three actions when resuming

1. **Check the live page** https://fridge.run/emoji/ (or run it locally, `DEPLOYMENT.md` Phase A) and its *Try it* section.
2. **Changing the glyph?** Edit `font/src/fridge-glyph.svg`, run `font/build.sh` (it validates), commit source and fonts together.
3. **Petition live?** Set `PETITION_URL` in `campaign.js` (`DEPLOYMENT.md` Phase D). Never invent a URL.

## Hard boundaries

- This site must never require the Mac mini to be online.
- No manufacturer or OS vendor is formally affiliated with the concept. Their names illustrate a *style direction*, not their approval or future official drawings.
- Actual Unicode emoji encoding is separate from the campaign petition. Signatures can generate momentum but are **not** Unicode's official evidence of usage.
- No brand logos or names inside the emoji artwork. No sticky note, paper, magnet, or tiny details competing with the handles at 18×18.
- Credit the campaign to **Charlie**. Maintain dated source history without claiming to have first conceived the refrigerator emoji.
- Keep all campaign work under `emoji/`; avoid root-level CSS, CNAME, and deployment workflow changes.
