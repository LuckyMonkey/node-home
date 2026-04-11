#!/usr/bin/env python3
from __future__ import annotations

import argparse
import os
import re
import subprocess
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Iterable, Iterator


URL_RE = re.compile(r"https?://\S+", re.IGNORECASE)
DAY_RE = re.compile(
    r"^(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday),\s+[A-Z][a-z]+\s+\d{1,2},\s+\d{4}$"
)
TIME_RE = re.compile(r"^\d{1,2}:\d{2}\s*(AM|PM)$", re.IGNORECASE)


def slugify(value: str) -> str:
    lowered = value.strip().lower()
    lowered = lowered.replace("&", " and ")
    lowered = re.sub(r"[^a-z0-9]+", "_", lowered)
    lowered = re.sub(r"_+", "_", lowered).strip("_")
    return lowered or "untitled"


def run_strings(path: Path, min_len: int = 8) -> Iterator[str]:
    proc = subprocess.Popen(
        ["strings", "-n", str(min_len), str(path)],
        stdout=subprocess.PIPE,
        stderr=subprocess.DEVNULL,
        text=True,
        errors="replace",
    )
    assert proc.stdout is not None
    for line in proc.stdout:
        yield line.rstrip("\n")
    proc.stdout.close()
    proc.wait()


def is_probably_noise(line: str) -> bool:
    if not line:
        return True
    if len(line) > 240:
        return True
    if URL_RE.search(line):
        stripped = line.strip()
        lowered = stripped.lower()
        if (
            lowered.startswith("<")
            or "xmlns:" in lowered
            or "rdf:rdf" in lowered
            or "xmp:" in lowered
            or "xpacket" in lowered
            or "xmpmeta" in lowered
        ):
            return True
        return False

    stripped = line.strip()
    if not stripped:
        return True

    lowered = stripped.lower()
    # Embedded PDF / document internals that commonly appear in binary exports.
    if any(
        token in lowered
        for token in (
            "flatedecode",
            "objstm",
            "endstream",
            " endobj",
            "xref",
            "trailer",
            "startxref",
            "cidtogidmap",
            "basefont",
            "/type/font",
            "/type/page",
            "/type/xobject",
            "producer",
            "skia",
            "applemark",
            "cdefghijstuvwxyz",
            "xpacket",
            "xmpmeta",
            "rdf:rdf",
            "xmlns:",
        )
    ):
        return True
    if lowered.startswith("<</") or lowered.endswith(">>stream") or lowered == "stream":
        return True
    if re.fullmatch(r"\d+\s+\d+\s+obj", stripped):
        return True

    letters = sum(1 for ch in stripped if ch.isalpha())
    digits = sum(1 for ch in stripped if ch.isdigit())
    spaces = sum(1 for ch in stripped if ch.isspace())
    punct = sum(1 for ch in stripped if (not ch.isalnum() and not ch.isspace()))
    vowels = sum(1 for ch in stripped.lower() if ch in "aeiou")

    if letters == 0 and digits == 0:
        return True

    # Repeated token pattern like "BI>RBI>R" or "d?DRd?DR".
    if spaces == 0 and len(stripped) >= 8 and len(stripped) % 2 == 0:
        half = len(stripped) // 2
        if stripped[:half] == stripped[half:]:
            return True

    # High-punctuation / high-entropy token soup (common in OneNote binaries).
    if spaces == 0 and letters < 4 and punct >= 2:
        return True

    # Repeated weird marker patterns seen in exports.
    if re.fullmatch(r"[$;=\\?@A-Za-z0-9><\\[\\]{}()|\\\\/\\-]{8,}", stripped) and letters < 5:
        return True

    # Long no-space strings with lots of punctuation.
    if spaces == 0 and len(stripped) >= 24 and punct / max(1, len(stripped)) > 0.2:
        return True

    # Long-ish consonant soup (often binary artifacts), keep short acronyms like MBTA.
    if spaces == 0 and digits == 0 and len(stripped) >= 8 and vowels == 0:
        return True

    # Long-ish alnum soup with digits (often binary artifacts).
    if spaces == 0 and len(stripped) >= 12 and digits > 0 and vowels == 0 and punct == 0:
        return True
    if spaces == 0 and len(stripped) >= 8 and vowels == 0 and re.fullmatch(r"[A-Z0-9]+", stripped):
        return True

    # PDF-ish compressed tokens (often include "...U0P...").
    if spaces == 0 and digits > 0 and letters > 0 and ("0p" in lowered or "0s" in lowered) and len(stripped) >= 10:
        return True

    # Generic token soup (compressed/encrypted-ish artifacts): mixed letters+digits with almost no vowels.
    if spaces == 0 and len(stripped) >= 16 and digits > 0 and letters > 0 and vowels <= 1:
        return True

    # No-space tokens containing binary-ish punctuation.
    if spaces == 0 and len(stripped) >= 8 and punct > 0 and any(ch in "%<>\\`^[]" for ch in stripped):
        return True

    # Repeated-char runs ("IIIIIIIIII...") are almost never meaningful notes.
    if spaces == 0 and len(stripped) >= 20:
        longest_run = 1
        run = 1
        for a, b in zip(stripped, stripped[1:]):
            run = run + 1 if a == b else 1
            longest_run = max(longest_run, run)
        if longest_run / len(stripped) > 0.35:
            return True

    # Very short fragments that aren't a date/time.
    if len(stripped) < 4 and not (DAY_RE.match(stripped) or TIME_RE.match(stripped)):
        return True

    # Mostly punctuation.
    if punct / max(1, len(stripped)) > 0.35 and letters < 6:
        return True

    # If it still doesn't look like human text, drop it.
    if not is_humanish_text(stripped):
        return True

    # Keep.
    return False


def extract_clean_lines(path: Path) -> list[str]:
    out: list[str] = []
    prev: str | None = None
    for raw in run_strings(path, min_len=8):
        line = raw.strip()
        if is_probably_noise(line):
            continue
        if prev == line:
            continue
        prev = line
        out.append(line)
    return out


EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


def is_humanish_text(text: str) -> bool:
    if URL_RE.search(text):
        stripped = text.strip()
        lowered = stripped.lower()
        if (
            lowered.startswith("<")
            or "xmlns:" in lowered
            or "rdf:rdf" in lowered
            or "xmp:" in lowered
            or "xpacket" in lowered
            or "xmpmeta" in lowered
        ):
            return False
        return True
    if DAY_RE.match(text) or TIME_RE.match(text):
        return True

    if "\t" in text or "\x00" in text:
        return False

    stripped = text.strip()
    lowered = stripped.lower()

    # Explicitly allow common code-ish/command-ish lines.
    if "docker " in lowered or lowered.startswith(("sudo ", "brew ", "npm ", "apt ", "ifconfig ", "netsh ")):
        return True

    letters = sum(1 for ch in stripped if ch.isalpha())
    digits = sum(1 for ch in stripped if ch.isdigit())
    vowels = sum(1 for ch in lowered if ch in "aeiou")

    # Allow emails/phones/ids (best effort).
    if EMAIL_RE.match(stripped):
        return True
    if re.fullmatch(r"[0-9()\-+. ]{7,}", stripped):
        return True
    if "-" in stripped and digits >= 6 and letters >= 1 and len(stripped) <= 24:
        return True

    # Single word (or token) that's mostly letters.
    if " " not in stripped and re.fullmatch(r"[A-Za-z][A-Za-z'/_-]{2,}", stripped):
        # Require at least one vowel unless it's a short acronym.
        if vowels >= 1:
            return True
        if stripped.isupper() and len(stripped) <= 6:
            return True
        return False

    # Alphanumeric IDs/keys (best effort) — keep and let the surrounding context decide usefulness.
    if " " not in stripped and re.fullmatch(r"[A-Za-z0-9]{8,20}", stripped) and any(ch.isdigit() for ch in stripped):
        return True

    # Multi-word: require some real words.
    words = re.findall(r"[A-Za-z]{2,}", stripped)
    if len(words) >= 2 and vowels >= 2 and letters >= 6:
        return True

    # Mixed digits/letters with spaces (addresses, recipes, etc).
    if " " in stripped and digits >= 1 and letters >= 3:
        return True

    return False


def is_heading_candidate(line: str) -> bool:
    if not line:
        return False
    if URL_RE.search(line):
        return False
    if len(line) < 3 or len(line) > 80:
        return False
    if line.endswith((".", "?", "!", ";")):
        return False
    if DAY_RE.match(line) or TIME_RE.match(line):
        return False
    letters = sum(1 for ch in line if ch.isalpha())
    if letters < 4:
        return False
    words = line.split()
    if len(words) > 12:
        return False
    return True


@dataclass(frozen=True)
class Section:
    title: str
    lines: list[str]


def split_into_sections(lines: list[str]) -> list[Section]:
    if not lines:
        return []

    sections: list[Section] = []
    current_title = "Notes"
    current_lines: list[str] = []

    i = 0
    while i < len(lines):
        line = lines[i]
        nxt = lines[i + 1] if i + 1 < len(lines) else ""

        # OneNote often stores: "<Page Title>" then a date line.
        if is_heading_candidate(line) and (DAY_RE.match(nxt) or TIME_RE.match(nxt)):
            if current_lines:
                sections.append(Section(title=current_title, lines=current_lines))
            current_title = line
            current_lines = []
            i += 1
            continue

        current_lines.append(line)
        i += 1

    if current_lines:
        sections.append(Section(title=current_title, lines=current_lines))

    # If the first section is just "Notes" and begins with a strong title-like line, rename it.
    if sections and sections[0].title == "Notes":
        first_line = sections[0].lines[0] if sections[0].lines else ""
        if is_heading_candidate(first_line):
            sections[0] = Section(title=first_line, lines=sections[0].lines[1:])

    return sections


def dokuwiki_escape(text: str) -> str:
    # Keep it simple; avoid accidentally creating formatting. (We still want URLs to work.)
    # If a line contains wiki markup open/close tokens, force literal rendering.
    if any(token in text for token in ("[[", "]]", "{{", "}}", "~~")):
        return f"<nowiki>{text}</nowiki>"
    return text.replace("**", "\\\\*\\\\*").replace("__", "\\\\_\\\\_")


def is_readable_line(text: str) -> bool:
    if URL_RE.search(text):
        stripped = text.strip()
        lowered = stripped.lower()
        if (
            lowered.startswith("<")
            or "xmlns:" in lowered
            or "rdf:rdf" in lowered
            or "xmp:" in lowered
            or "xpacket" in lowered
            or "xmpmeta" in lowered
        ):
            return False
        return True
    if DAY_RE.match(text) or TIME_RE.match(text):
        return True

    if "\t" in text or "\x00" in text:
        return False

    stripped = text.strip()
    if not stripped:
        return False
    if stripped.startswith("<") or stripped.startswith("<?"):
        return False

    lowered = stripped.lower()
    if stripped.startswith('"') and "id=" in lowered:
        return False
    if any(ch in "`~{}|" for ch in stripped):
        return False
    if "docker " in lowered or lowered.startswith(("sudo ", "brew ", "npm ", "apt ", "ifconfig ", "netsh ")):
        return True

    # Strip common trailing list punctuation.
    normalized = stripped.rstrip(" *,:;.")

    letters = sum(1 for ch in normalized if ch.isalpha())
    digits = sum(1 for ch in normalized if ch.isdigit())
    vowels = sum(1 for ch in normalized.lower() if ch in "aeiou")

    # Single word / short token.
    if " " not in normalized:
        if re.fullmatch(r"[A-Za-z][A-Za-z'/_-]{2,}", normalized):
            if normalized.islower() or normalized.istitle():
                return vowels >= 1
            if normalized.isupper() and len(normalized) <= 6:
                return True
            # Allow common mixed-case product names (OneNote, iPhone, WiFi, etc.).
            if re.fullmatch(r"[A-Z][a-z]+(?:[A-Z][a-z]+)+", normalized):
                return True
            if re.fullmatch(r"[a-z][a-z]+[A-Z][a-z]+", normalized):
                return True
            return False
        return False

    # Multi-word: require at least two word-ish tokens OR a plausible address-ish mix.
    words = re.findall(r"[A-Za-z]{2,}", normalized)
    def is_natural_word(word: str) -> bool:
        wl = word.lower()
        wv = sum(1 for ch in wl if ch in "aeiou")
        if word.isupper() and 3 <= len(word) <= 6:
            return True
        if (word.islower() or word.istitle()) and wv >= 1:
            return True
        return False

    has_natural = any(is_natural_word(w) for w in words)

    if has_natural and len(words) >= 2 and letters >= 6 and vowels >= 2:
        return True
    if has_natural and digits >= 1 and letters >= 3:
        return True

    return False


def render_lines(lines: list[str], max_lines: int = 4000) -> str:
    rendered: list[str] = []
    clipped = lines[:max_lines]
    dropped = 0
    for line in clipped:
        if not is_readable_line(line):
            dropped += 1
            continue
        if DAY_RE.match(line) or TIME_RE.match(line):
            rendered.append(f"//{dokuwiki_escape(line)}//")
            continue
        # Treat most lines as bullets for consistency.
        rendered.append(f"  * {dokuwiki_escape(line)}")
    if len(lines) > max_lines:
        rendered.append("")
        rendered.append(f"//(Clipped: showing first {max_lines} lines of this section)//")
    if dropped:
        rendered.append("")
        rendered.append(f"//(Dropped {dropped} low-signal lines; see original OneNote file for full fidelity)//")
    return "\n".join(rendered).rstrip() + "\n"


def write_page(path: Path, content: str, *, dry_run: bool) -> None:
    if dry_run:
        return
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(content, encoding="utf-8")


def human_bytes(num: int) -> str:
    for unit in ["B", "KB", "MB", "GB", "TB"]:
        if num < 1024:
            return f"{num:.0f}{unit}"
        num /= 1024
    return f"{num:.0f}PB"


def main() -> int:
    parser = argparse.ArgumentParser(description="Import OneNote .one files into DokuWiki pages (best-effort).")
    parser.add_argument(
        "--src",
        default="/home/fridge/docker/oneNoteOffload",
        help="Directory containing .one files",
    )
    parser.add_argument(
        "--pages-root",
        default="/home/fridge/dokuwiki-config/dokuwiki/data/pages",
        help="DokuWiki pages root (contains start.txt, tech/, etc)",
    )
    parser.add_argument(
        "--namespace",
        default="onenote",
        help="Top-level DokuWiki namespace to write into",
    )
    parser.add_argument("--dry-run", action="store_true", help="Analyze but do not write files")
    args = parser.parse_args()

    src_dir = Path(args.src)
    pages_root = Path(args.pages_root)
    namespace = slugify(args.namespace)
    out_root = pages_root / namespace

    one_files = sorted(src_dir.glob("*.one"), key=lambda p: p.name.lower())
    if not one_files:
        raise SystemExit(f"No .one files found in: {src_dir}")

    imported_at = datetime.now(timezone.utc).isoformat(timespec="seconds")
    max_sections_per_notebook = 200

    index_lines: list[str] = []
    index_lines.append("====== OneNote import ======")
    index_lines.append("")
    index_lines.append(f"**Source directory:** ``{src_dir}``  ")
    index_lines.append(f"**Imported at:** {imported_at}  ")
    index_lines.append("")
    index_lines.append("This is a best-effort import built from recovered plain text inside `.one` files.")
    index_lines.append("Anything that can't be reliably extracted remains in the original files for later export/conversion.")
    index_lines.append("")
    index_lines.append("  * [[onenote:raw_files|Raw OneNote files (originals)]]")
    index_lines.append("")
    index_lines.append("===== Notebooks =====")

    raw_lines: list[str] = []
    raw_lines.append("====== Raw OneNote files ======")
    raw_lines.append("")
    raw_lines.append("These are the original `.one` files. If anything looks missing/garbled in the imported pages, this is the source of truth.")
    raw_lines.append("")
    raw_lines.append("===== Location =====")
    raw_lines.append(f"  * ``{src_dir}``")
    raw_lines.append("")
    raw_lines.append("===== Inventory =====")
    raw_lines.append("^ Notebook ^ Size ^ Path ^")

    for one_path in one_files:
        notebook_title = one_path.stem
        notebook_slug = slugify(notebook_title)
        notebook_ns_dir = out_root / notebook_slug
        start_page = notebook_ns_dir / "start.txt"

        size = one_path.stat().st_size
        raw_lines.append(f"| [[{namespace}:{notebook_slug}|{notebook_title}]] | {human_bytes(size)} | ``{one_path}`` |")
        clean_lines = extract_clean_lines(one_path)
        sections = split_into_sections(clean_lines)
        clipped_sections = False

        # If we didn't find meaningful section breaks, treat as a single section.
        if len(sections) == 0:
            sections = [Section(title="Notes", lines=clean_lines)]
        elif len(sections) > max_sections_per_notebook:
            sections = sections[:max_sections_per_notebook]
            clipped_sections = True

        index_lines.append(f"  * [[{namespace}:{notebook_slug}|{notebook_title}]] ({human_bytes(size)})")

        notebook_lines: list[str] = []
        notebook_lines.append(f"====== {notebook_title} (OneNote) ======")
        notebook_lines.append("")
        notebook_lines.append("===== Meta =====")
        notebook_lines.append(f"  * **Original file:** ``{one_path}``")
        notebook_lines.append(f"  * **Size:** {human_bytes(size)}")
        notebook_lines.append("  * **Note:** Attachments/ink/layout from OneNote may not be captured here.")
        if clipped_sections:
            notebook_lines.append(f"  * **Warning:** Too many sections detected; kept first {max_sections_per_notebook}.")
        notebook_lines.append("")

        # Section index
        notebook_lines.append("===== Sections =====")

        # If it's small-ish, inline sections on the start page.
        inline = len(clean_lines) <= 1200 and len(sections) <= 8
        if inline:
            notebook_lines.append("//Inlined on this page.//")
            notebook_lines.append("")
            for section in sections:
                title = section.title
                notebook_lines.append(f"===== {dokuwiki_escape(title)} =====")
                notebook_lines.append("")
                notebook_lines.append(render_lines(section.lines, max_lines=2000).rstrip())
                notebook_lines.append("")
        else:
            notebook_lines.append("  * //Split across subpages for readability.//")
            notebook_lines.append("")
            for idx, section in enumerate(sections, start=1):
                title = section.title
                section_slug = slugify(title)
                section_page = notebook_ns_dir / f"{idx:02d}_{section_slug}.txt"
                notebook_lines.append(f"  * [[{namespace}:{notebook_slug}:{idx:02d}_{section_slug}|{dokuwiki_escape(title)}]]")

                page_lines: list[str] = []
                page_lines.append(f"====== {notebook_title}: {title} ======")
                page_lines.append("")
                page_lines.append(f"  * Up: [[{namespace}:{notebook_slug}|{notebook_title}]]")
                page_lines.append(f"  * Source: ``{one_path}``")
                page_lines.append("")
                page_lines.append(render_lines(section.lines, max_lines=4000).rstrip())
                page_lines.append("")
                write_page(section_page, "\n".join(page_lines).rstrip() + "\n", dry_run=args.dry_run)

        # Simple cross-links based on notebook name.
        notebook_lines.append("----")
        notebook_lines.append("")
        notebook_lines.append("===== Related =====")
        if notebook_slug in {"computer", "hacking"}:
            notebook_lines.append("  * [[tech:start|Tech]]")
            notebook_lines.append("  * [[tech:docker_projects|Docker projects inventory]]")
            notebook_lines.append("  * [[tech:mycomputer|Freezer workstation]]")
            notebook_lines.append("  * [[tech:fridge|Fridge server]]")
        if notebook_slug == "food":
            notebook_lines.append("  * [[food:recipes|Recipes]]")
            notebook_lines.append("  * [[projects:cookbook|Cookbook project]]")
        if notebook_slug == "health":
            notebook_lines.append("  * [[health:start|Health]]")
            notebook_lines.append("  * [[health:information|Health information]]")
            notebook_lines.append("  * [[providers:start|Providers]]")
            notebook_lines.append("  * [[medical:start|Medical]]")
        if notebook_slug == "people":
            notebook_lines.append("  * [[ppl:charlie|Charlie]]")
            notebook_lines.append("  * [[ppl:start|People]] (create if missing)")
        if notebook_slug == "places":
            notebook_lines.append("  * [[xyz:start|Places]]")
        if notebook_slug == "art_projects":
            notebook_lines.append("  * [[projects:start|Projects]]")
        if notebook_slug == "misc":
            notebook_lines.append("  * [[date:start|Day logs]]")
            notebook_lines.append("  * [[tips:start|Tips & Tricks]]")

        write_page(start_page, "\n".join(notebook_lines).rstrip() + "\n", dry_run=args.dry_run)

    write_page(out_root / "start.txt", "\n".join(index_lines).rstrip() + "\n", dry_run=args.dry_run)
    write_page(out_root / "raw_files.txt", "\n".join(raw_lines).rstrip() + "\n", dry_run=args.dry_run)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
