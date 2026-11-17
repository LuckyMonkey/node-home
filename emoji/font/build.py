#!/usr/bin/env python3
"""Build Fridge Emoji (FridgeEmoji-Regular.ttf + .woff2) from src/fridge-glyph.svg.

Reproducible: same source + same pinned tools (requirements.txt) = byte-identical fonts. Timestamps are fixed.
One glyph, mapped to U+E900 in the Private Use Area. That is this project's own convention, NOT an official
Unicode refrigerator character, and it maps nothing else (no emoji code points, no letters).

Usage: ./build.sh   (makes .venv, installs requirements, runs this, then validate.py)
"""
import os
import sys
import xml.etree.ElementTree as ET

from fontTools.fontBuilder import FontBuilder
from fontTools.pens.ttGlyphPen import TTGlyphPen
from fontTools.ttLib import TTFont

HERE = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.join(HERE, "src", "fridge-glyph.svg")
OUT = HERE
CODEPOINT = 0xE900
VERSION = "1.000"
UPM = 1000
ASCENT, DESCENT = 800, -200
GRID = 64
SCALE = UPM / GRID              # 15.625 font units per grid unit
BASELINE_Y = 52                 # grid y that sits on the baseline (feet hang below it, like a "g")
# Fixed for reproducible bytes: 2026-11-17 00:00:00 UTC in Mac epoch seconds (since 1904).
STAMP = 3846441600

FAMILY = "Fridge Emoji"
PS_NAME = "FridgeEmoji-Regular"
COPYRIGHT = "Copyright 2026 Charlie (https://fridge.run/emoji/)"
LICENSE = "This Font Software is licensed under the SIL Open Font License, Version 1.1."
LICENSE_URL = "https://openfontlicense.org"
DESCRIPTION = ("Experimental refrigerator glyph at U+E900 (Private Use Area) for the Refrigerator Emoji campaign. "
               "Not an official Unicode emoji; U+E900 may mean something else in other fonts.")


def rects(path):
    """The source's <rect> elements as (kind, x, y, w, h, rx) in grid units. Anything else is an error."""
    ns = "{http://www.w3.org/2000/svg}"
    root = ET.parse(path).getroot()
    out = []
    for el in root.iter():
        tag = el.tag.replace(ns, "")
        if tag in ("svg", "style", "title", "desc") or not isinstance(el.tag, str):
            continue
        if tag != "rect":
            sys.exit(f"build: only <rect> is supported in {path}, found <{tag}>")
        kind = el.get("class")
        if kind not in ("fill", "hole"):
            sys.exit(f"build: rect {el.get('id')} needs class=\"fill\" or class=\"hole\"")
        x, y, w, h = (float(el.get(k)) for k in ("x", "y", "width", "height"))
        out.append((kind, x, y, w, h, float(el.get("rx", 0))))
    if not any(k == "fill" for k, *_ in out):
        sys.exit("build: the glyph has no ink")
    return out


def contour(x, y, w, h, r, hole):
    """A rounded rectangle as a TrueType contour in font units: clockwise for ink, counter-clockwise for a hole.
    Each corner is one quadratic segment with its control point on the corner."""
    fx = lambda gx: round(gx * SCALE)
    fy = lambda gy: round((BASELINE_Y - gy) * SCALE)
    x0, x1, y0, y1 = fx(x), fx(x + w), fy(y + h), fy(y)        # y0 bottom, y1 top (font y is up)
    rr = round(min(r, w / 2, h / 2) * SCALE)
    if rr == 0:
        pts = [((x0, y0), True), ((x0, y1), True), ((x1, y1), True), ((x1, y0), True)]
    else:
        pts = [((x0, y0 + rr), True), ((x0, y1 - rr), True), ((x0, y1), False), ((x0 + rr, y1), True),
               ((x1 - rr, y1), True), ((x1, y1), False), ((x1, y1 - rr), True), ((x1, y0 + rr), True),
               ((x1, y0), False), ((x1 - rr, y0), True), ((x0 + rr, y0), True), ((x0, y0), False)]
    if hole:
        pts = [pts[0]] + pts[:0:-1]                      # same start point, opposite direction
    return pts


def draw(pen, pts):
    """Feed (point, on_curve) lists to a pen; each off-curve point sits between two on-curve points."""
    pen.moveTo(pts[0][0])
    i, n = 1, len(pts)
    while i < n:
        p, on = pts[i]
        if on:
            pen.lineTo(p)
            i += 1
        else:
            nxt = pts[(i + 1) % n][0]
            pen.qCurveTo(p, nxt)
            i += 2
    pen.closePath()


def glyph_fridge():
    pen = TTGlyphPen(None)
    for kind, x, y, w, h, r in rects(SRC):
        draw(pen, contour(x, y, w, h, r, kind == "hole"))
    return pen.glyph()


def glyph_notdef():
    pen = TTGlyphPen(None)
    draw(pen, [((100, -100), True), ((100, 700), True), ((500, 700), True), ((500, -100), True)])
    draw(pen, [((150, -50), True), ((450, -50), True), ((450, 650), True), ((150, 650), True)])
    return pen.glyph()


def build():
    fb = FontBuilder(UPM, isTTF=True)
    fb.font.recalcTimestamp = False
    order = [".notdef", "uniE900"]
    fb.setupGlyphOrder(order)
    fb.setupCharacterMap({CODEPOINT: "uniE900"})
    fb.setupGlyf({".notdef": glyph_notdef(), "uniE900": glyph_fridge()})
    glyf = fb.font["glyf"]
    metrics = {}
    for name in order:
        g = glyf[name]
        g.recalcBounds(glyf)
        metrics[name] = (600 if name == ".notdef" else UPM, getattr(g, "xMin", 0))
    fb.setupHorizontalMetrics(metrics)
    fb.setupHorizontalHeader(ascent=ASCENT, descent=DESCENT, lineGap=0)
    fb.setupNameTable({
        "copyright": COPYRIGHT, "familyName": FAMILY, "styleName": "Regular",
        "uniqueFontIdentifier": f"{VERSION};NONE;{PS_NAME}", "fullName": f"{FAMILY} Regular",
        "version": f"Version {VERSION}", "psName": PS_NAME, "designer": "Charlie",
        "manufacturer": "fridge.run", "vendorURL": "https://fridge.run/emoji/", "designerURL": "https://fridge.run/emoji/",
        "description": DESCRIPTION, "licenseDescription": LICENSE, "licenseInfoURL": LICENSE_URL,
    }, mac=False)
    fb.setupOS2(sTypoAscender=ASCENT, sTypoDescender=DESCENT, sTypoLineGap=0, usWinAscent=ASCENT,
                usWinDescent=-DESCENT, sxHeight=500, sCapHeight=700, achVendID="NONE", fsType=0,
                usWeightClass=400, usWidthClass=5, fsSelection=0x40 | 0x80,        # REGULAR | USE_TYPO_METRICS
                ulUnicodeRange1=0, ulUnicodeRange2=1 << (60 - 32), ulUnicodeRange3=0, ulUnicodeRange4=0,  # bit 60: PUA
                ulCodePageRange1=0, ulCodePageRange2=0, usDefaultChar=0, usBreakChar=CODEPOINT, version=4)
    fb.setupPost(keepGlyphNames=True)
    fb.font["head"].created = fb.font["head"].modified = STAMP
    fb.font["head"].fontRevision = float(VERSION)
    from fontTools.ttLib.tables._g_a_s_p import table__g_a_s_p
    gasp = table__g_a_s_p()
    gasp.gaspRange = {0xFFFF: 0x000F}            # smooth at every size: no hinting, grayscale + symmetric
    fb.font["gasp"] = gasp
    ttf = os.path.join(OUT, PS_NAME + ".ttf")
    fb.save(ttf)
    w2 = TTFont(ttf, recalcTimestamp=False)
    w2.flavor = "woff2"
    w2.save(os.path.join(OUT, PS_NAME + ".woff2"))
    print(f"built {PS_NAME}.ttf and {PS_NAME}.woff2 (U+{CODEPOINT:04X})")


if __name__ == "__main__":
    build()
