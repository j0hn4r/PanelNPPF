#!/usr/bin/env python3
"""Build dist/ from vendor/nppf-index.html + src/.

PanelNPPF never edits newnppf's index.html. This script only ever *reads*
vendor/nppf-index.html and derives the panel page from it:

  1. verify the vendored copy still matches upstream.lock (warn, don't fail,
     if it has moved -- see the QA matrix in PLAN.md)
  2. split the single inline <style> and <script> out into external files,
     because MV3's extension-page CSP (script-src 'self') blocks inline
     script outright
  3. strip head weight that means nothing inside an extension page
     (og:*/twitter:* meta, the web-app manifest link)
  4. append the panel layer: nppf.css, then nppf.js, then panel.js (in that
     order -- panel.js's hooks depend on nppf.js having already run)
  5. tag <body class="sidepanel"> so panel.css can scope every override
  6. copy src/*, icons/, vendor/favicon/, manifest.json into dist/

Run: python tools/build.py
"""
import hashlib
import json
import re
import shutil
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
VENDOR_HTML = ROOT / 'vendor' / 'nppf-index.html'
LOCK = ROOT / 'upstream.lock'
DIST = ROOT / 'dist'
SRC = ROOT / 'src'


def check_upstream_hash(html_bytes: bytes) -> None:
    if not LOCK.exists():
        print('warning: no upstream.lock found -- skipping hash check', file=sys.stderr)
        return
    lock = json.loads(LOCK.read_text())
    actual = hashlib.sha256(html_bytes).hexdigest()
    if actual != lock.get('sha256'):
        print('=' * 70, file=sys.stderr)
        print('WARNING: vendor/nppf-index.html no longer matches upstream.lock.', file=sys.stderr)
        print(f"  locked sha256:  {lock.get('sha256')}", file=sys.stderr)
        print(f"  actual sha256:  {actual}", file=sys.stderr)
        print('The panel overrides (panel.css/panel.js) were checked against the', file=sys.stderr)
        print('locked version. Re-run the QA matrix in PLAN.md section 9 before', file=sys.stderr)
        print('trusting this build, then refresh upstream.lock (see tools/sync.py).', file=sys.stderr)
        print('Building anyway.', file=sys.stderr)
        print('=' * 70, file=sys.stderr)
    else:
        print('upstream.lock matches vendor/nppf-index.html — ok')


def extract_one(pattern: str, html: str, label: str):
    matches = re.findall(pattern, html, flags=re.DOTALL)
    if len(matches) != 1:
        raise SystemExit(
            f'build failed: expected exactly one {label} block, found {len(matches)}. '
            f'newnppf/index.html\'s structure changed -- update tools/build.py\'s '
            f'extraction pattern to match, don\'t silently ship a page missing its {label}.'
        )
    return matches[0]


def main() -> None:
    if not VENDOR_HTML.exists():
        raise SystemExit(f'missing {VENDOR_HTML} -- run tools/sync.py first')

    html_bytes = VENDOR_HTML.read_bytes()
    check_upstream_hash(html_bytes)
    html = html_bytes.decode('utf-8')

    # 1. split out the inline <style> and <script>
    css = extract_one(r'<style>(.*?)</style>', html, '<style>')
    js = extract_one(r'<script>(.*?)</script>', html, '<script>')

    # panel.css loads after nppf.css so its overrides win the cascade at
    # equal specificity.
    html = re.sub(
        r'<style>.*?</style>',
        '<link rel="stylesheet" href="nppf.css">\n'
        '<link rel="stylesheet" href="panel.css">',
        html, count=1, flags=re.DOTALL,
    )
    html = re.sub(r'<script>.*?</script>', '', html, count=1, flags=re.DOTALL)

    # 2. strip dead head weight -- nothing crawls an extension page, and a
    #    web-app manifest link is meaningless inside one
    html = re.sub(r'\s*<meta property="og:[^"]*"[^>]*>', '', html)
    html = re.sub(r'\s*<meta name="twitter:[^"]*"[^>]*>', '', html)
    html = re.sub(r'\s*<link rel="manifest"[^>]*>', '', html)

    # 2b. chapters/annexes default to CLOSED, not open -- the panel drops
    # the separate nav-tree "contents" dropdown in favour of browsing each
    # chapter as its own accordion (see PLAN.md's chapter-accordion
    # section), so they need to start collapsed for that to read as an
    # accordion list rather than one long expanded document. Every chapter
    # and annex is `<details class="chapter" ...>` or `<details class=
    # "chapter annex" ...>`, always ending in a literal ` open` before the
    # closing `>` -- this only strips that one attribute, nothing else
    # about the tag. `.objective`/`.fnlist` are untouched; they already
    # default closed. This is still just a build-time transform of the
    # vendored copy, same as splitting out <style>/<script> above -- it
    # never touches vendor/nppf-index.html itself.
    (html, n_chapters) = re.subn(r'(<details class="chapter(?: annex)?"[^>]*?) open>', r'\1>', html)
    print(f'collapsed {n_chapters} chapters/annexes to closed-by-default')

    # 3. tag the body so panel.css can scope every override to the panel,
    #    and inject the panel script layer right before </body>. panel.js
    #    must load after nppf.js so its DOM hooks (#q, #clr, .bookmark-btn,
    #    the .chapter <details> elements) already exist.
    html = html.replace('<body>', '<body class="sidepanel">', 1)
    html = html.replace(
        '</body>',
        '<script src="nppf.js"></script>\n'
        '<script src="panel.js"></script>\n'
        '</body>',
    )

    # rebuild output
    if DIST.exists():
        shutil.rmtree(DIST)
    DIST.mkdir(parents=True)

    (DIST / 'panel.html').write_text(html, encoding='utf-8')
    (DIST / 'nppf.css').write_text(css, encoding='utf-8')
    (DIST / 'nppf.js').write_text(js, encoding='utf-8')

    for name in ('panel.css', 'panel.js', 'background.js'):
        src_file = SRC / name
        if src_file.exists():
            shutil.copy(src_file, DIST / name)
        else:
            print(f'note: {src_file} does not exist yet -- skipping', file=sys.stderr)

    manifest_src = ROOT / 'manifest.json'
    if manifest_src.exists():
        shutil.copy(manifest_src, DIST / 'manifest.json')
    else:
        print('warning: manifest.json not found at repo root', file=sys.stderr)

    # only the PNGs the manifest actually references -- icons/ also holds
    # icon.svg (the vector source) and gen_icons.py (the rasterizer that
    # produced the PNGs from it), neither of which belongs inside the
    # shipped extension package.
    icons_src = ROOT / 'icons'
    icon_pngs = sorted(icons_src.glob('*.png')) if icons_src.exists() else []
    if icon_pngs:
        (DIST / 'icons').mkdir(parents=True, exist_ok=True)
        for png in icon_pngs:
            shutil.copy(png, DIST / 'icons' / png.name)
    else:
        print('note: icons/ has no PNGs -- manifest icon paths will 404 until added', file=sys.stderr)

    favicon_src = ROOT / 'vendor' / 'favicon'
    if favicon_src.exists():
        shutil.copytree(favicon_src, DIST / 'favicon')

    print(f'built dist/ ({(DIST / "panel.html").stat().st_size} byte panel.html, '
          f'{(DIST / "nppf.css").stat().st_size} byte nppf.css, '
          f'{(DIST / "nppf.js").stat().st_size} byte nppf.js)')


if __name__ == '__main__':
    main()
