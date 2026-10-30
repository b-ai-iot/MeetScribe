"""Validate local documentation links, images and EN/VI coverage without network access."""
from pathlib import Path
import re
import sys
from urllib.parse import unquote, urlsplit

ROOT = Path(__file__).resolve().parents[1]
GUIDES = {
    "installation", "usage", "export-format", "privacy", "development",
    "troubleshooting", "architecture",
}
PAIRS = ["README", "CONTRIBUTING", "SECURITY", "CODE_OF_CONDUCT", "CHANGELOG"]


def readable_markdown(path):
    text = path.read_text(encoding="utf-8")
    return re.sub(r"(?ms)^\s*(```|~~~).*?^\s*\1\s*$", "", text)


def headings(path):
    seen, anchors = {}, set()
    for title in re.findall(r"(?m)^#{1,6}\s+(.+?)\s*#*\s*$", readable_markdown(path)):
        slug = re.sub(r"[^\w\- ]", "", title.lower()).replace(" ", "-")
        count = seen.get(slug, 0)
        seen[slug] = count + 1
        anchors.add(slug + (f"-{count}" if count else ""))
    return anchors


def main():
    errors, links = [], 0
    for name in PAIRS:
        for suffix in (".md", ".vi.md"):
            if not (ROOT / (name + suffix)).is_file():
                errors.append(f"Missing bilingual entry: {name}{suffix}")
    for language, other in (("en", "vi"), ("vi", "en")):
        names = {p.stem for p in (ROOT / "docs" / language).glob("*.md")}
        for name in sorted(GUIDES - names):
            errors.append(f"Missing guide: docs/{language}/{name}.md")
        opposite = {p.stem for p in (ROOT / "docs" / other).glob("*.md")}
        if names != opposite:
            errors.append(f"Guide parity differs: {language}={sorted(names)}, {other}={sorted(opposite)}")
        for name in names:
            path = ROOT / "docs" / language / (name + ".md")
            if f"../{other}/{name}.md" not in path.read_text(encoding="utf-8"):
                errors.append(f"Missing language switch: {path.relative_to(ROOT)}")

    pages = sorted(ROOT.glob("*.md")) + sorted((ROOT / "docs").glob("*.md"))
    pages += sorted((ROOT / "docs" / "en").glob("*.md"))
    pages += sorted((ROOT / "docs" / "vi").glob("*.md"))
    for page in pages:
        text = readable_markdown(page)
        targets = re.findall(r"!?\[[^\]\n]*\]\(([^\s)]+)(?:\s+[^)]*)?\)", text)
        targets += re.findall(r'<(?:img|a)\b[^>]*(?:src|href)=["\']([^"\']+)["\']', text)
        for raw in targets:
            parsed = urlsplit(raw.strip("<>"))
            if parsed.scheme or parsed.netloc:
                continue
            links += 1
            target = (page.parent / unquote(parsed.path)).resolve() if parsed.path else page
            if not target.is_relative_to(ROOT):
                errors.append(f"{page.relative_to(ROOT)}: link escapes repository: {raw}")
            elif not target.exists():
                errors.append(f"{page.relative_to(ROOT)}: missing target: {raw}")
            elif parsed.fragment and target.suffix == ".md":
                if unquote(parsed.fragment) not in headings(target):
                    errors.append(f"{page.relative_to(ROOT)}: missing heading: {raw}")
    for name in ("toolbar.png", "library.png", "settings.png", "library-mobile.png"):
        path = ROOT / "docs" / "images" / name
        if not path.is_file() or path.read_bytes()[:8] != b"\x89PNG\r\n\x1a\n":
            errors.append(f"Missing or invalid screenshot: docs/images/{name}")
    if errors:
        print("Documentation validation failed:\n" + "\n".join("- " + e for e in errors))
        return 1
    print(f"Documentation OK: {len(pages)} pages, {links} local links, EN/VI guide parity and 4 PNGs.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
