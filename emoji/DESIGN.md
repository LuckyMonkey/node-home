# Refrigerator Emoji — concept brief v0.3

## Visual direction (approved requirements from Charlie)

**Object:** ordinary full-height, white-enamel, top-freezer refrigerator. The upper freezer is smaller; the lower fridge is taller. Door split is horizontal. **Two black handles, both on the viewer's RIGHT.** Unbranded. Flat color, dark borders, light-gray solid shading only where needed. The thing must be unmistakably a refrigerator at emoji size.

### Forbidden in this concept pass

- GE logo or any other appliance company badge.
- Gradients, metallic gleam, shiny 3D chrome rendering, unnecessary glows.
- Huge detailed cabinet illustration when a small glyph silhouette does the job.
- Sticky notes, magnets, stickers, or text on the doors (can revisit, but not in v0.3).
- Side-by-side doors, french doors, dispenser, bottom freezer drawer (different future concepts).
- Claims that Apple, Microsoft, Google, Samsung, or Unicode endorsed or generated any of these drawings.

## Why multiple visual directions?

A future Unicode refrigerator character, if approved, would be an *encoded concept*. Apple and other platform vendors generally create their own emoji drawings. We are designing examples of how **one unmistakable refrigerator** can survive different stylistic treatments. These are independent, **platform-inspired** concepts, not copied corporate emoji assets.

## The five SVGs

| File | Intended distinction |
|---|---|
| `classic-base.svg` | Reference geometry; white doors, black handles, simple dark seam |
| `ios-inspired.svg` | Softer silhouette, rounded door corners, gentle **flat** gray highlights |
| `windows-inspired.svg` | Geometric, square-ish, crisp uniform outlines |
| `android-inspired.svg` | Bold high-contrast line work for small UI sizes |
| `samsung-inspired.svg` | Light border, clean enamel, still readable at 18px |

Names are internal design tags only. A company can draw an entirely different fridge if Unicode eventually encodes one.

## Acceptance checklist

- [ ] At **16×16 px**: appears as a fridge, not a cabinet, tower PC, or washing machine.
- [ ] At **18×18 px**: top freezer seam survives; both right-side handles remain identifiable (if visually merged, must still read as one clear handle arrangement).
- [ ] At **24×24 px**: unmistakable white top-freezer fridge.
- [ ] At **72×72 px**: consistent line widths, no rogue dots or tiny artifacts.
- [ ] On **white background**: contrast doesn't disappear.
- [ ] On **dark background**: dark strokes/handles stay visible or have sufficient contrasting border.
- [ ] In **grayscale**: still identifiable without tint.
- [ ] No gradient elements: no `<linearGradient>`, `<radialGradient>`, CSS `linear-gradient` or filter-generated shine in the drawings.
- [ ] No corporate trademarks, pseudo-badges, note stickers, tiny illegible text.
- [ ] All variants use the **same freezer-above-fridge proportions** and right-handle arrangement.

## Standards artwork later (NOT produced in this phase)

When the design is locked, create one generic candidate suitable for a Unicode proposal with exact image dimensions required by the **then-current** Unicode emoji guidelines (the historical examples used 18×18 and 72×72, color and black-and-white). Convert the chosen vector to raster with deliberate pixel hinting; do not rely on arbitrary shrink-to-fit. Check design licensing, edit rights, and Unicode's agreement. The current 64px SVGs are **concept art, not a submitted/approved emoji**.

## Future font project / Claude handoff

The font will be a **later** deliverable:
1. Agree on the single base glyph.
2. Create **separate** monochrome glyph paths that scale cleanly; build a test font with a deliberately scoped private-use mapping only after sign-off.
3. Optionally export WOFF2, TTF, SVG, and PNG for browser/community usage.
4. Document that **PUA characters are not universal Unicode emoji** and can collide with other fonts. Use `:fridge:` text for portable app integrations.
5. Keep a future font builder and sources under `emoji/font/`, with a separate readme, reproducible build, tests and release tag.
6. Later create platform-specific installers/user scripts only with explicit opt-in, no hijacking OS emoji fonts.

**Do not auto-create or deploy a font merely because the SVG concepts exist.**
