# Chrome Web Store listing — copy to paste into the Developer Dashboard

Not part of the build; this is reference copy for the submission form at
https://chrome.google.com/webstore/devconsole. Fields marked **[fill in]**
are yours to decide — they're not something this repo can determine on its
own.

## Store listing tab

**Extension name** (from `manifest.json`, 45-char limit)
```
NPPF 2026 Side Panel
```

**Summary** (from `manifest.json`'s `description`, 132-char limit)
```
Search, bookmark and read the NPPF (Aug 2026) in Chrome's side panel. Unofficial reading edition, not published by MHCLG.
```

**Description** (long-form, no hard limit — Chrome trims trailing whitespace)
```
The National Planning Policy Framework (MHCLG, August 2026) — searchable,
bookmarkable, and open in Chrome's side panel alongside whatever you're
actually working in: a council portal, an officer report, a draft statement.

FEATURES

- Opens as a side panel, not a new tab — via the toolbar icon or Alt+Shift+N,
  stays docked next to the page you're reading.
- Select a policy code or phrase anywhere on the web, right-click, "Look up
  in the NPPF" — a recognised code jumps straight to that policy, anything
  else runs a search.
- Full-text search, with the actual policy jumped to and expanded when its
  own code is searched.
- Every "policy S1"-style cross-reference and defined term in the running
  text links to the policy or glossary entry it names.
- One click copies a policy's full text with a reference to the official
  Framework, ready to paste into a planning statement.
- Bookmarks, a plan-making/decision-making filter, dark mode, and your
  reading position remembered across closing and reopening the panel.

This is an unofficial reading edition, generated from the official PDF and
checked character-for-character against it, but not published by MHCLG. For
the authoritative document see GOV.UK. The Framework text is Crown copyright,
reproduced under the Open Government Licence v3.0. Checking accuracy against
the official Framework remains your responsibility.

The extension has no host permissions, uses no content scripts, and sends
no data anywhere — everything it remembers (your reading position,
bookmarks) stays on your own device. See the privacy policy link for detail.

Source: https://github.com/j0hn4r/PanelNPPF
```

**Category**: Productivity (or Tools, if the dashboard's taxonomy has moved on)

**Language**: English (United Kingdom) / English

## Privacy practices tab

**Single purpose**
```
Provides quick access to the National Planning Policy Framework (NPPF) 2026
as a searchable, bookmarkable reference in Chrome's side panel, with an
optional right-click lookup for text selected on any page.
```

**Permission justifications**

| Permission | Justification |
|---|---|
| `sidePanel` | Required to show the NPPF reader in Chrome's side panel — the extension's entire UI. |
| `contextMenus` | Adds the right-click "Look up '…' in the NPPF" item, the extension's lookup entry point. |
| `storage` | Remembers your reading position and bookmarks locally, and hands off a context-menu selection to the panel. Nothing is transmitted anywhere. |

**Are you using remote code?** No.

**Data usage** — none of the below are collected: Personally identifiable
information, Health information, Financial and payment information,
Authentication information, Personal communications, Location, Web history,
User activity, Website content. The extension makes no network requests at
all.

**Privacy policy URL** — once pushed, the rendered file on GitHub works
directly as this URL:
```
https://github.com/j0hn4r/PanelNPPF/blob/master/PRIVACY.md
```

## Assets

- **Icon**: pulled automatically from `manifest.json` (128px source in
  `icons/icon128.png`).
- **Screenshots** (1280×800, `store/screenshots/`):
  - `search-view.png` — searching a policy code, cross-reference links visible
  - `menu-view.png` — the Filters/Contents menu open
- **Promotional images** — optional; not produced here. Add a 440×280 small
  tile if you want extra placement eligibility.

## Package to upload

Zip the *contents* of `dist/` (not the `dist/` folder itself — its files
must sit at the zip root). `python tools/build.py` first, then:

```bash
cd dist && zip -r ../store/panelnppf-1.0.0.zip . -x '.*' && cd ..
```

No `zip` on your PATH (this project's own dev environment doesn't have one)?
`python3 -c "import shutil; shutil.make_archive('store/panelnppf-1.0.0', 'zip', 'dist')"`
does the same thing — `root_dir='dist'` roots the archive at `dist`'s own
contents, so files still land at the zip root.

## [fill in] before submitting

- **Developer/publisher display name** — whatever you want shown as the
  publisher on the listing page.
- **Support email / website** — required by the Dashboard; can be the GitHub
  repo URL for "website" and any email you're happy to receive extension
  queries at.
- **Distribution** — public vs. unlisted vs. private; public is the
  default assumption above.
- A **Chrome Web Store developer account** (one-time $5 registration fee) if
  you don't already have one — https://chrome.google.com/webstore/devconsole.

## Before you submit: load-unpacked verification

This has been rebuilt, but the real `chrome.sidePanel`/`chrome.contextMenus`/
`chrome.storage.session` calls have never been exercised in an actual loaded
extension in this project — only against `dist/` served over a plain static
server, where `window.chrome` doesn't exist. `chrome://` pages and native
file pickers aren't reachable by browser automation, so this step needs your
own hands:

1. `chrome://extensions` → enable **Developer mode** (top right) → **Load
   unpacked** → select this repo's `dist/` folder.
2. Run PLAN.md's §9 QA matrix, particularly:
   - Console clean on load (no CSP violation).
   - Toolbar icon opens the panel.
   - Select text on any page → right-click → "Look up '…' in the NPPF" →
     panel opens to the right place, both cold (panel not already open) and
     warm (panel already open).
   - `Alt+Shift+N` opens and focuses search with nothing selected.
   - Close and reopen the panel — reading position and bookmarks survive.
3. Only submit once that passes — it's the one part of this project that
   automation genuinely cannot verify for you.
