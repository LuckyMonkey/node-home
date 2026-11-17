# Fridge Emoji v0.1 — local implementation and compatibility

**Initiated by Charlie at fridge.run.** This is an **unofficial experimental emoji implementation**, released to show a missing concept before Unicode acceptance. It is not a new Unicode character, not an official emoji, not a new system keyboard key, and not a claim to have invented the refrigerator emoji concept. All first-party components are static on GitHub Pages.

## What works now

| Environment | How it works | Limitations |
|---|---|---|
| **fridge.run/emoji/** | The page loads `fridge-shim.js` and renders `:fridge:` (or `:refrigerator:`) using a colored SVG | Browser-specific implementation, not universally recognized |
| **Another website** | Site owner adds a script tag to load the shim; ordinary visible text `:fridge:` becomes the emoji | Must opt in; strict CSP can block external scripts/images |
| **Web custom font** | `assets/fridge-emoji.css` embeds an original WOFF2 glyph for U+E900 | Monochrome, and PUA is not globally standardized |
| **Linux desktop** | `install-linux.sh` verifies and installs the original TTF to `~/.local/share/fonts` | Apps must select “Fridge Emoji” or have a suitable font fallback. This is *not* a universal emoji keyboard install |
| **Windows or macOS** | Decode `FridgeEmoji-Regular.ttf.b64` and install using the native font manager | Same private-use/font-selection limits |
| **Unknown app, chat, clipboard, messaging** | Plain `:fridge:` shortcode is the human-readable transport | Without integration it stays literal text |

## Shortcode / glyph contract

- Canonical portable text: `:fridge:`
- Alternate token: `:refrigerator:`
- Experimental PUA character: **U+E900** — a private agreement inside the Fridge Emoji implementation.
- Unicode's Private Use Area does not assign meaning to U+E900. Another font could map that codepoint to an unrelated shape. It is **never** safe to use it as a universal interchange substitute.
- Suggested accessible label: **“refrigerator emoji”**.
- The rendered emoji graphic lives at `https://fridge.run/emoji/assets/fridge-emoji.svg`.
- The font glyph is intentionally a monochrome silhouette and has a different visual style from the color SVG.

The CSS is embedded WOFF2 data to avoid relying on cross-site font CORS headers, and works as a normal CSS stylesheet. The font's standalone original TTF is distributed as an auditable Base64 text payload so interested users can install it locally.

## Opt in a different website

Add one script tag to the HTML (ideally late in the document or with `defer`):

```html
<script src="https://fridge.run/emoji/fridge-shim.js" defer></script>
<p>Put the milk in the :fridge:!</p>
```

The shim:
- Adds its own small stylesheet and color SVG.
- Scans only ordinary **visible DOM text nodes** for the two shortcodes and U+E900.
- Uses semantic `role="img"` and `aria-label="refrigerator emoji"`.
- Observes newly inserted nodes so dynamic sites can opt in too.
- Skips textareas, inputs, code, scripts, contenteditable regions, etc., so it won't rewrite what users are typing.
- Does not collect data, send telemetry, open a connection to the Fridge server, or require cookies/accounts.
- Exposes `window.FridgeEmoji.render(element)` and `window.FridgeEmoji.createElement()` for app integrations.
- Only loads static assets from `fridge.run`; if the host site has restrictive Content Security Policy settings, it may need explicit `script-src`, `style-src`, `img-src`, and font/data permissions or a self-hosted copy.

To create an emoji in JavaScript without touching text:
```js
document.querySelector('#target').append(window.FridgeEmoji.createElement());
```

**Do not** rewrite user-entered form fields, serialized JSON, and message database values. Store the shortcode and transform *only at presentation time*.

## Linux (Xubuntu / XFCE / fontconfig)

The optional installer changes only the user's font directory. Nothing is written to `/usr/share/fonts`, no root permissions are needed, and no system font is replaced.

```bash
curl -fsSLo /tmp/install-fridge-emoji.sh https://fridge.run/emoji/install-linux.sh
less /tmp/install-fridge-emoji.sh  # inspect before running
bash /tmp/install-fridge-emoji.sh
fc-match 'Fridge Emoji'
```

Use the named font in an application, and type/insert U+E900. If your editor lets you select a font for a specific span, use **Fridge Emoji**. Example browser HTML: `<span class="fridge-emoji-pua">&#xE900;</span>` with the campaign CSS stylesheet loaded.

**Uninstall:**
```bash
rm -f "${XDG_DATA_HOME:-$HOME/.local/share}/fonts/FridgeEmoji-Regular.ttf"
fc-cache -f
```

### Windows

Download the `FridgeEmoji-Regular.ttf.b64` text from the site, decode it to a TTF using PowerShell, and then use **Install** from Windows Font Viewer. Select the “Fridge Emoji” font in a capable app; this does not replace Segoe UI Emoji.

```powershell
$b64 = (Invoke-WebRequest 'https://fridge.run/emoji/assets/FridgeEmoji-Regular.ttf.b64').Content.Trim()
$p = Join-Path $env:TEMP 'FridgeEmoji-Regular.ttf'
[IO.File]::WriteAllBytes($p, [Convert]::FromBase64String($b64))
Start-Process $p
```

### macOS

Decode the same Base64 text and install with **Font Book**. It still does not create an emoji in the system's native picker, or override Apple's emoji font.

```bash
curl -fsSL https://fridge.run/emoji/assets/FridgeEmoji-Regular.ttf.b64 | base64 -D > "$HOME/Downloads/FridgeEmoji-Regular.ttf"
open "$HOME/Downloads/FridgeEmoji-Regular.ttf"
```

### Android/iOS

A website can render the SVG and webfont without installation. System-wide emoji keyboards, font fallbacks, and third-party messaging apps are not universally patchable through a downloaded font. Use app-specific stickers, custom keyboards or user-approved app integrations; never claim true Unicode-level support.

## Optional browser userscript (advanced, opt-in)

The file `fridge-emoji.user.js` is a template for Violentmonkey/Tampermonkey. Its metadata matches only an invalid placeholder host. **Before enabling**, users must explicitly replace the placeholder `@match` with the domain(s) on which they want fridge-shortcode rendering. Do not silently inject into every website. Sites with strict CSP may still block the external script.

For a one-page browser test, paste this *in the developer console of a page you control*:

```js
const s = document.createElement('script');
s.src = 'https://fridge.run/emoji/fridge-shim.js';
document.head.append(s);
```

## Security, privacy, portability

- User input is never sent anywhere by the shim.
- The shim only inserts known fixed SVG/img elements and ordinary text nodes; it does not use HTML string interpolation for user data.
- Third-party page text or any dynamic content still belongs to its site; obey site permissions and avoid injecting extensions into work/finance/medical pages.
- The HTTPS campaign domain loads static resources only, without node/server dependencies.
- Avoid global font replacements. Many systems protect color emoji fonts and installing a PUA font does not give that private codepoint a default glyph everywhere.
- If Unicode eventually encodes a refrigerator emoji, migrate the shortcode to the real codepoint **only after** it is standardized and widely supported; preserve older content and don't assume approval in advance.

## Source / build provenance

The original glyph was authored specifically for this initiative using FontTools from self-drawn geometric outlines, not copied from any existing commercial font. Source geometry: a refrigerator outer silhouette, two door apertures, two handles, and feet. The original font has a single U+E900 mapped glyph. The CSS embeds WOFF2 data; the optional OS file derives from the TrueType data archive.

SHA-256 of decoded TTF:

```
f7958830a28b2f50da10d6a3d1592d489196d6f6db22205ddc4c99745d8866f2  FridgeEmoji-Regular.ttf
```

Both the original color icon and the font are unofficial campaign artwork, not Unicode-authorized sample images.

**Future development:** publish the browser shim and icon under a documented permissive license after Charlie selects one; add a small set of platform-native emoji designs, client-specific keyboard shortcuts, a tiny sticker package, a branded Markdown shortcode plugin, and a versioned compatibility suite. Keep the independent Unicode submission separate from brand artwork.
