# Refrigerator Emoji Initiative — concept subproject

**Organizer:** Charlie  
**Host when approved:** https://fridge.run/emoji/  
**Repository:** `LuckyMonkey/node-home`  
**Working branch:** `emoji-concept-only` (review first; this branch is *not* published by GitHub Pages)  
**Status:** CONCEPT / PRE-LAUNCH — no Unicode approval, no live Change.org petition, no emoji font yet.

## The point

The world has a fax machine emoji and no standard refrigerator emoji. Charlie is organizing a public campaign to change that. Fridge.run is the campaign website, **not** the credited inventor or standards submitter.

This folder is intentionally independent of the home server. It is a static website built from ordinary HTML/CSS/JavaScript and local SVG artwork. No Node build, React, PHP, Docker, identity provider, tunnel, analytics, or API is needed to publish it.

**Do not deploy this branch until Charlie is ready.** The repo currently publishes `main` at the root via GitHub Pages. A merge/push to `main` deploys the `emoji/` folder automatically.

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
| `concepts/samsung-inspired.svg` | Unofficial lighter-outline example |
| `assets/label-3x2.zpl` | Optional Zebra label, **hold printing until petition is live** |
| `DESIGN.md` | Visual requirements and review criteria |
| `DEPLOYMENT.md` | Developer / Claude handoff, local checks, release process |
| `RUNBOOK.md` | Grassroots, industry, communications, standards plan |

**No real emoji font exists in this version.** A previous experimental font, private-use glyph, browser shim, userscript, and Linux installer were removed from this branch. They had been built too early, before the artwork was approved. Do not link to, install, or advertise those removed files.

## First three actions when resuming

1. **Review the concept gallery** and choose the fridge shape. Keep **white enamel, top freezer, black right-side handles**, no gradients, and no GE or other brand logo.
2. **Run the site locally** using the one-command static server in `DEPLOYMENT.md`. Check tiny icon sizes and phones.
3. **When ready to release**, review/merge the GitHub pull request into `main`; this is the publishing trigger. Create and link the new Change.org petition separately when it exists.

## Hard boundaries

- This site must never require the Mac mini to be online.
- No manufacturer or OS vendor is formally affiliated with the concept. Their names illustrate a *style direction*, not their approval or future official drawings.
- Actual Unicode emoji encoding is separate from the campaign petition. Signatures can generate momentum but are **not** Unicode's official evidence of usage.
- No brand logos or names inside the emoji artwork. No sticky note, paper, magnet, or tiny details competing with the handles at 18×18.
- Credit the campaign to **Charlie**. Maintain dated source history without claiming to have first conceived the refrigerator emoji.
- Keep all campaign work under `emoji/`; avoid root-level CSS, CNAME, and deployment workflow changes.
