#!/bin/sh
# Install Fridge Emoji for the current user only (Linux, fontconfig). No root, no system fonts touched,
# no emoji font replaced: it adds one font that maps only U+E900. Safe to run again (idempotent).
#
#   sh install-linux.sh              install (or update) from the .ttf next to this script
#   sh install-linux.sh --uninstall  remove it again
#   sh install-linux.sh --check      just report whether it is installed
#
# Installs to ${XDG_DATA_HOME:-~/.local/share}/fonts/fridge-emoji/FridgeEmoji-Regular.ttf
set -eu
NAME=FridgeEmoji-Regular.ttf
DIR="${XDG_DATA_HOME:-$HOME/.local/share}/fonts/fridge-emoji"
SRC="$(cd "$(dirname "$0")" && pwd)/$NAME"

if [ "$(id -u)" = 0 ]; then
  echo "Run this as yourself, not root: it installs for your user only." >&2
  exit 1
fi
command -v fc-cache >/dev/null 2>&1 || { echo "fontconfig (fc-cache) is not installed." >&2; exit 1; }

verify() {
  if fc-list ':charset=e900' family file | grep -F "$DIR/$NAME" >/dev/null; then
    echo "OK: 'Fridge Emoji' is installed and provides U+E900"
    echo "    fc-match: $(fc-match -f '%{family} (%{file})' 'Fridge Emoji')"
    return 0
  fi
  echo "Not installed (no font at $DIR/$NAME provides U+E900)."
  return 1
}

case "${1:-}" in
  --check) verify; exit $? ;;
  --uninstall)
    if [ -e "$DIR/$NAME" ]; then
      rm -f "$DIR/$NAME"
      rmdir "$DIR" 2>/dev/null || true
      fc-cache -f "${XDG_DATA_HOME:-$HOME/.local/share}/fonts" >/dev/null 2>&1 || true
      echo "Removed $DIR/$NAME"
    else
      echo "Nothing to remove."
    fi
    exit 0 ;;
  "") ;;
  *) echo "usage: sh install-linux.sh [--check|--uninstall]" >&2; exit 2 ;;
esac

[ -f "$SRC" ] || { echo "Can't find $SRC (run this from the emoji/font folder or download the .ttf next to it)." >&2; exit 1; }
mkdir -p "$DIR"
if [ -f "$DIR/$NAME" ] && cmp -s "$SRC" "$DIR/$NAME"; then
  echo "Already up to date: $DIR/$NAME"
else
  cp "$SRC" "$DIR/$NAME.tmp" && chmod 644 "$DIR/$NAME.tmp" && mv "$DIR/$NAME.tmp" "$DIR/$NAME"
  echo "Installed $DIR/$NAME"
fi
fc-cache -f "$DIR" >/dev/null
verify
echo "Type it: U+E900 (GTK: Ctrl+Shift+U, e900, Space). It shows as a fridge only where 'Fridge Emoji' is the"
echo "chosen font or the fallback for U+E900; other fonts may draw something else there (it is a Private Use code point)."
