#!/usr/bin/env bash
# Fridge Emoji v0.2 — opt-in local font installation for Linux/fontconfig.
# This is NOT a system emoji replacement. A program must use "Fridge Emoji"
# to display the experimental private-use codepoint U+E900.
set -euo pipefail
URL="https://fridge.run/emoji/assets/FridgeEmoji-Regular.ttf.b64"
EXPECTED_SHA="13d21b2983c151c2b991bdfab0cb500560da88d916e1ba8dbe1c0a2661703414"
TARGET="${XDG_DATA_HOME:-$HOME/.local/share}/fonts/FridgeEmoji-Regular.ttf"
command -v curl >/dev/null || { echo "curl is required" >&2; exit 1; }
command -v base64 >/dev/null || { echo "base64 is required" >&2; exit 1; }
command -v sha256sum >/dev/null || { echo "sha256sum is required" >&2; exit 1; }
command -v fc-cache >/dev/null || { echo "fontconfig (fc-cache) is required" >&2; exit 1; }
TMP="$(mktemp)"; trap 'rm -f "$TMP"' EXIT
echo "Fetching font data from $URL"
curl --fail --location --silent --show-error "$URL" | base64 --decode > "$TMP"
test -s "$TMP" || { echo "No font data received" >&2; exit 1; }
echo "$EXPECTED_SHA  $TMP" | sha256sum --check --status || { echo "Font checksum mismatch. Installation aborted." >&2; exit 1; }
install -D -m 0644 "$TMP" "$TARGET"
fc-cache -f "$(dirname "$TARGET")"
echo "Installed $TARGET"
echo "Use font family 'Fridge Emoji' to display U+E900."
echo "This does not patch the system emoji keyboard or make the glyph universal."
echo "To uninstall: rm '$TARGET' && fc-cache -f"
