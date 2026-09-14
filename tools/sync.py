#!/usr/bin/env python3
"""Refresh vendor/ from ../newnppf and update upstream.lock.

The only script that reaches outside this repo (see PLAN.md section 4).
build.py never touches ../newnppf -- it only reads the vendored copy this
script produces, so a fresh clone of PanelNPPF builds without newnppf
checked out next to it.

Run: python tools/sync.py
"""
import hashlib
import json
import shutil
import subprocess
import sys
from datetime import date
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
UPSTREAM = ROOT.parent / 'newnppf'
UPSTREAM_HTML = UPSTREAM / 'index.html'
UPSTREAM_FAVICON = UPSTREAM / 'favicon'
VENDOR_HTML = ROOT / 'vendor' / 'nppf-index.html'
VENDOR_FAVICON = ROOT / 'vendor' / 'favicon'
LOCK = ROOT / 'upstream.lock'


def upstream_commit() -> str:
    try:
        result = subprocess.run(
            ['git', '-C', str(UPSTREAM), 'rev-parse', '--short', 'HEAD'],
            capture_output=True, text=True, check=True,
        )
        return result.stdout.strip()
    except (OSError, subprocess.CalledProcessError):
        return 'unknown'


def main() -> None:
    if not UPSTREAM_HTML.exists():
        raise SystemExit(
            f'missing {UPSTREAM_HTML} -- expected ../newnppf checked out '
            f'next to this repo'
        )

    old_sha = json.loads(LOCK.read_text())['sha256'] if LOCK.exists() else None

    html_bytes = UPSTREAM_HTML.read_bytes()
    new_sha = hashlib.sha256(html_bytes).hexdigest()

    VENDOR_HTML.write_bytes(html_bytes)

    if VENDOR_FAVICON.exists():
        shutil.rmtree(VENDOR_FAVICON)
    if UPSTREAM_FAVICON.exists():
        shutil.copytree(UPSTREAM_FAVICON, VENDOR_FAVICON)

    LOCK.write_text(json.dumps({
        'source': '../newnppf/index.html',
        'sha256': new_sha,
        'bytes': len(html_bytes),
        'vendored_at': date.today().isoformat(),
        'upstream_commit': upstream_commit(),
    }, indent=2) + '\n')

    if old_sha == new_sha:
        print('vendor/nppf-index.html unchanged -- upstream.lock re-stamped only')
    else:
        print(f'vendor/nppf-index.html updated ({len(html_bytes)} bytes)')
        print('=' * 70)
        print('upstream moved -- re-run the QA matrix in PLAN.md section 9')
        print('before trusting a build against the new copy.')
        print('=' * 70)


if __name__ == '__main__':
    main()
