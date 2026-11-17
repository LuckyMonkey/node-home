# Fridge Emoji: the font

**An experimental refrigerator glyph you can install and use today, while the campaign asks Unicode for a real one.**

| | |
|---|---|
| Files | `FridgeEmoji-Regular.ttf` (desktop install), `FridgeEmoji-Regular.woff2` (websites) |
| Family / PostScript name | `Fridge Emoji` / `FridgeEmoji-Regular`, version 1.000 |
| Character | **U+E900**, one monochrome glyph, advance 1 em (square, like an emoji) |
| Design basis | `../concepts/classic-base.svg`: white top-freezer fridge, both handles on the right, two feet |
| Licence | SIL Open Font License 1.1 (`OFL.txt`); build scripts MIT (`../LICENSE-CODE.txt`) |

## What U+E900 is, and is not

U+E900 is in Unicode's **Private Use Area**. This project uses it as its own convention. It is **not** an official
Unicode refrigerator emoji and nobody else has agreed to it: other fonts (icon fonts especially) put their own symbols
at U+E900, and a device without Fridge Emoji shows an empty box, a hex box, or one of those other symbols. The font
maps **only** U+E900 (no letters, no existing emoji), so installing it cannot change any other text.

For anything portable (chat, posts, documents shared with others) write `:fridge:`. For custom-emoji uploads (Slack,
Discord, Mastodon) export the transparent PNG from https://fridge.run/emoji/. The colour SVG remains the reference artwork.

## Install it

### Linux (tested on Xubuntu, fontconfig)

```sh
sh install-linux.sh             # installs for you only: ${XDG_DATA_HOME:-~/.local/share}/fonts/fridge-emoji/
sh install-linux.sh --check     # is it installed? (fc-list / fc-match)
sh install-linux.sh --uninstall # remove it
```

No root, no system fonts touched, no emoji font replaced; running it twice is harmless. Then type the character in GTK
apps with **Ctrl+Shift+U, e900, Space**. Tested 2026-11-17 on the organizer's Xubuntu laptop: `fc-list`/`fc-match` find
it for U+E900, Pango (GTK/Xfce text) draws the fridge both when "Fridge Emoji" is chosen and as the automatic fallback
for U+E900 in "Sans", ImageMagick finds it by name, and `fc-match emoji` is still Noto Color Emoji.

**Snap Firefox (Ubuntu's default Firefox) does not use fonts from `~/.local/share/fonts`** (for any font, not just this
one), so in Firefox U+E900 shows as a hex box unless the page loads the font itself. fridge.run/emoji does load it,
so the site works everywhere; this only matters for U+E900 typed into other websites.

### Windows and macOS (not tested by this project)

- **Windows 10/11:** right-click `FridgeEmoji-Regular.ttf` → *Install* (for you only). Remove it in Settings → Personalization → Fonts.
- **macOS:** double-click the `.ttf` → *Install Font* in Font Book. Remove it from Font Book.

Neither changes the system emoji font. Whether an app shows U+E900 with it depends on that app's font fallback.

## Use it on a website

```html
<link rel="stylesheet" href="https://fridge.run/emoji/fridge-emoji.css">
<span class="fridge-glyph" role="img" aria-label="Refrigerator">&#xE900;</span>
```

`fridge-emoji.css` declares the font with `unicode-range: U+E900`, so it never applies to other characters, and only
elements with `class="fridge-glyph"` ask for it. For the `:fridge:` shortcode use `../fridge-emoji.js`
(`FridgeEmoji.render(element)`); see the header of that file and `../tests/shim-test.html`.

## Build it

```sh
./build.sh      # makes .venv, installs the pinned tools (requirements.txt), runs build.py, then validate.py
```

- **Source:** `src/fridge-glyph.svg`, a 64×64 grid of `<rect>`s: `class="fill"` is ink, `class="hole"` is cut out.
  Edit it in a text editor or Inkscape (keep rects as rects). Keep strokes at 4 grid units or more: at 16 px one unit is a quarter pixel.
- **`build.py`** (fontTools) turns each rect into a rounded TrueType contour (ink clockwise, holes counter-clockwise),
  scales 64 units to the 1000-unit em with grid y=52 on the baseline, and writes the TTF and WOFF2 with fixed
  timestamps: the same source and tools give byte-identical files.
- **`validate.py`** must pass before a release. It runs the OTS sanitizer (the same check Firefox and Chrome apply to
  web fonts), checks that the TTF and WOFF2 hold the same outline, that the cmap is exactly U+E900, the names, metrics,
  licence fields, the 7 contours, and renders the glyph with FreeType at 16/18/24/72 px into `build/previews/`
  (git-ignored) checking that the windows stay open and the handles inked.

Release: bump `VERSION` in `build.py`, rebuild, validate, commit the source and both font files together.

## Test status (2026-11-17)

| Check | Result |
|---|---|
| OTS sanitizer, TTF + WOFF2 | pass |
| FreeType render 16 / 18 / 24 / 72 px | pass (readable top-freezer fridge with right handles at every size) |
| Reproducible build (two builds, same hashes) | pass |
| Linux user install, fontconfig, Pango, ImageMagick | pass |
| Firefox 150 (snap, Linux), web font via `@font-face` | pass |
| Firefox 150 (snap), installed font by family name | not used (snap limitation, see above) |
| Chromium, Safari / iOS, Windows, macOS | **not tested** (not available on the build machine) |
