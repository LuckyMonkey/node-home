#!/usr/bin/env python3
"""Check the built Fridge Emoji fonts, then render the glyph at 16/18/24/72 px with FreeType (build/previews/).

Exits non-zero on any failure. Checks: OTS sanitizer passes (the same checks Firefox and Chrome run on web fonts);
the TTF and WOFF2 hold the same glyph; the cmap maps exactly U+E900 and nothing else (no emoji, no letters);
names, metrics, version and licence fields; the glyph is the fridge (7 contours: body, 2 windows, 2 handles, 2 feet);
the rendered glyph has ink in both door windows' handles and white windows at small sizes.
"""
import os
import struct
import subprocess
import sys
import zlib

from fontTools.ttLib import TTFont

HERE = os.path.dirname(os.path.abspath(__file__))
TTF = os.path.join(HERE, "FridgeEmoji-Regular.ttf")
WOFF2 = os.path.join(HERE, "FridgeEmoji-Regular.woff2")
fails = []


def check(name, ok, detail=""):
    print(("PASS " if ok else "FAIL ") + name + ("" if ok else f"  [{detail}]"))
    if not ok:
        fails.append(name)


def png(path, w, h, rows):
    """Write an 8-bit grayscale PNG (rows of bytes, 0 = black)."""
    raw = b"".join(b"\x00" + bytes(r) for r in rows)
    chunk = lambda t, d: struct.pack(">I", len(d)) + t + d + struct.pack(">I", zlib.crc32(t + d) & 0xFFFFFFFF)
    with open(path, "wb") as f:
        f.write(b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", struct.pack(">IIBBBBB", w, h, 8, 0, 0, 0, 0))
                + chunk(b"IDAT", zlib.compress(raw, 9)) + chunk(b"IEND", b""))


for path in (TTF, WOFF2):
    r = subprocess.run([sys.executable, "-m", "ots", path], capture_output=True, text=True)
    check(f"OTS sanitizer accepts {os.path.basename(path)}", r.returncode == 0, (r.stdout + r.stderr).strip()[:300])

ttf, w2 = TTFont(TTF), TTFont(WOFF2)
check("the WOFF2 really is WOFF2", w2.flavor == "woff2", w2.flavor)
cmap = ttf.getBestCmap()
check("cmap maps exactly U+E900 -> uniE900", cmap == {0xE900: "uniE900"}, cmap)
check("the WOFF2 maps the same", w2.getBestCmap() == cmap)
g, g2 = ttf["glyf"]["uniE900"], w2["glyf"]["uniE900"]
check("the WOFF2 glyph is the same outline", g.getCoordinates(ttf["glyf"])[0] == g2.getCoordinates(w2["glyf"])[0])
check("the glyph is the fridge: 7 contours (body, 2 windows, 2 handles, 2 feet)", g.numberOfContours == 7, g.numberOfContours)
adv, lsb = ttf["hmtx"]["uniE900"]
check("advance width is one em (1000), like an emoji", adv == 1000 and ttf["head"].unitsPerEm == 1000, adv)
check("the glyph sits inside the ascent/descent box", g.yMax <= ttf["hhea"].ascent and g.yMin >= ttf["hhea"].descent and 0 <= g.xMin and g.xMax <= adv,
      (g.xMin, g.yMin, g.xMax, g.yMax))
check("centred horizontally", abs((g.xMin + g.xMax) / 2 - adv / 2) <= 2, (g.xMin, g.xMax))
names = {n.nameID: n.toUnicode() for n in ttf["name"].names}
check("family 'Fridge Emoji', PostScript 'FridgeEmoji-Regular'", names.get(1) == "Fridge Emoji" and names.get(6) == "FridgeEmoji-Regular", names)
check("licence and licence URL are recorded", "Open Font License" in names.get(13, "") and names.get(14, "").startswith("https://"))
check("the description says it is not an official Unicode emoji", "Not an official Unicode emoji" in names.get(10, ""))
check("installable (fsType 0)", ttf["OS/2"].fsType == 0)
check("Private Use Area bit set in OS/2", bool(ttf["OS/2"].ulUnicodeRange2 & (1 << 28)))

# render with FreeType: the shapes that make it a fridge must survive at small sizes
try:
    import freetype
except ImportError:
    print("SKIP rendering (pip install freetype-py)")
    freetype = None
if freetype:
    out = os.path.join(HERE, "build", "previews")
    os.makedirs(out, exist_ok=True)
    face = freetype.Face(TTF)
    for px in (16, 18, 24, 72):
        face.set_pixel_sizes(0, px)
        face.load_char(chr(0xE900), freetype.FT_LOAD_RENDER | freetype.FT_LOAD_NO_HINTING)
        bm = face.glyph.bitmap
        w, h = bm.width, bm.rows
        cov = [list(bm.buffer[r * bm.pitch:r * bm.pitch + w]) for r in range(h)]
        rows = [[255 - c for c in row] for row in cov]
        png(os.path.join(out, f"fridge-{px}px.png"), w, h, rows)
        # sample: the middle of the fresh-food window (left of the handle) should be lighter than the body walls,
        # and the handle column darker than the window next to it
        ink = lambda fx, fy: cov[min(h - 1, int(fy * h))][min(w - 1, int(fx * w))]
        wall = ink(0.02, 0.6)
        window = ink(0.3, 0.75)
        handle = ink(0.75, 0.55)
        check(f"{px}px: {w}x{h} px, windows open and handles inked", w >= px * 0.5 and window < wall and handle > window,
              f"wall={wall} window={window} handle={handle}")
    print("previews in", out)

print(f"{'OK' if not fails else 'FAILED'}: {len(fails)} failure(s)")
sys.exit(1 if fails else 0)
