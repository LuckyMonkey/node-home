# Refrigerator Emoji — concept brief v0.3

## Visual direction (approved canonical reference)

**Object:** ordinary full-height, white-enamel, top-freezer refrigerator. The upper freezer is smaller; the lower fridge is taller. Door split is horizontal. **Two black handles, both on the viewer's RIGHT.** Unbranded. Flat color, dark borders, light-gray solid shading only where needed. The thing must be unmistakably a refrigerator at emoji size.

### Forbidden in this concept pass

- GE logo or any other appliance company badge.
- Gradients, metallic gleam, shiny 3D chrome rendering, unnecessary glows.
- Huge detailed cabinet illustration when a small glyph silhouette does the job.
- Sticky notes, magnets, stickers, or text on the doors (can revisit, but not in v0.3).
- Side-by-side doors, French doors, dispenser, or bottom freezer drawer **in the canonical reference**. The Samsung-inspired variant deliberately explores stainless French doors and a bottom freezer drawer.
- Claims that Apple, Microsoft, Google, Samsung, or Unicode endorsed or generated any of these drawings.

## Why multiple visual directions?

A future Unicode refrigerator character, if approved, would be an *encoded concept*. Apple and other platform vendors generally create their own emoji drawings. We are designing examples of how **one unmistakable refrigerator** can survive different stylistic treatments and, in the Samsung-inspired variant, a different recognizable door configuration. These are independent, **platform-inspired** concepts, not copied corporate emoji assets.

## The five SVGs

| File | Intended distinction |
|---|---|
| `classic-base.svg` | Reference geometry; white doors, black handles, simple dark seam |
| `ios-inspired.svg` | Softer silhouette, rounded door corners, gentle **flat** gray highlights |
| `windows-inspired.svg` | Geometric, square-ish, crisp uniform outlines |
| `android-inspired.svg` | Bold high-contrast line work for small UI sizes |
| `samsung-inspired.svg` | Flat stainless steel, split French doors, paired center handles, horizontal-handled bottom freezer drawer |

Names are internal design tags only. A company can draw an entirely different fridge if Unicode eventually encodes one.

## Acceptance checklist

- [ ] At **16×16 px**: appears as a fridge, not a cabinet, tower PC, or washing machine.
- [ ] At **18×18 px**: canonical top-freezer seam and right-side handles remain legible. Samsung variant instead retains central split and lower freezer drawer.
- [ ] At **24×24 px**: canonical white top-freezer fridge is unmistakable; Samsung-inspired stainless French-door version is also recognizable.
- [ ] At **72×72 px**: consistent line widths, no rogue dots or tiny artifacts.
- [ ] On **white background**: contrast doesn't disappear.
- [ ] On **dark background**: dark strokes/handles stay visible or have sufficient contrasting border.
- [ ] In **grayscale**: still identifiable without tint.
- [ ] No gradient elements: no `<linearGradient>`, `<radialGradient>`, CSS `linear-gradient` or filter-generated shine in the drawings.
- [ ] No corporate trademarks, pseudo-badges, note stickers, tiny illegible text.
- [ ] All variants are unmistakable refrigerators. Canonical/iOS/Windows/Android keep top-freezer proportions and right handles; Samsung-inspired deliberately uses French doors over a bottom freezer drawer.

## Standards artwork later (NOT produced in this phase)

When the design is locked, create one generic candidate suitable for a Unicode proposal with exact image dimensions required by the **then-current** Unicode emoji guidelines (the historical examples used 18×18 and 72×72, color and black-and-white). Convert the chosen vector to raster with deliberate pixel hinting; do not rely on arbitrary shrink-to-fit. Check design licensing, edit rights, and Unicode's agreement. The current 64px SVGs are **concept art, not a submitted/approved emoji**.

## Font (built 2026-11-17)

The **Fridge Emoji** font is built from the classic reference only (never the Samsung-inspired variant): a monochrome
glyph traced on the same 64-unit grid (`font/src/fridge-glyph.svg`), with 4-unit walls so the freezer seam and both
right-side handles survive at 16 px. It maps one Private Use code point, **U+E900**, which is this project's
convention and **not** a Unicode emoji; `:fridge:` text stays the portable form. Build, validation, install and licence
details: `font/README.md`. The colour SVGs stay the reference artwork; a font glyph is one colour like text.

Rules that still hold: no hijacking of OS emoji fonts, installers only with the user's explicit opt-in, no claim that
U+E900 is universal, and a new design pass here before any change to the glyph.
