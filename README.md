# PanelNPPF

A Chrome extension that puts the **National Planning Policy Framework**
(MHCLG, August 2026) into Chrome's side panel — searchable, bookmarkable, and
open alongside whatever you're actually working in: a council portal, an
officer report, a draft statement.

Built on top of [newnppf](https://github.com/j0hn4r/newnppf), a
self-contained reading edition of the Framework generated from the official
PDF. This extension never edits that page — it's read as-is and adapted at
build time and at runtime (see [CLAUDE.md](CLAUDE.md) for why).

## Features

- **Side panel**, not a new tab — opens via the toolbar icon or `Alt+Shift+N`,
  stays docked next to whatever page you're reading.
- **Look up a selection** — select a policy code or phrase on any page,
  right-click → *Look up "…" in the NPPF*. A recognised code jumps straight to
  that policy; anything else runs a search.
- **Search** the full text, with the exact policy jumped to and expanded when
  its own code is searched.
- **Cross-reference and glossary links** — every "policy S1"-style reference
  and every defined term in the running text links to the policy or Annex B
  entry it names.
- **Copy citation** — one click on a policy copies its full text with a
  reference to the official Framework, ready to paste into a statement.
- **Bookmarks, mode/refusal filters, dark mode, and reading-position memory**
  across closing and reopening the panel.

## Building

Requires Python 3.10+ and a checkout of
[newnppf](https://github.com/j0hn4r/newnppf) as a sibling directory
(`../newnppf`).

```bash
python tools/sync.py    # refresh vendor/ from ../newnppf (only needed after upstream changes)
python tools/build.py   # vendor/ + src/  ->  dist/
```

`dist/` is what you load unpacked: open `chrome://extensions`, enable
*Developer mode*, *Load unpacked*, select `dist/`.

## Repository layout

See [PLAN.md](PLAN.md) section 4 for the full breakdown, and section 3 for
the one rule everything else here follows: **PanelNPPF never edits
newnppf.** Every panel addition is either a build-time text transform
(`tools/build.py`) or a runtime DOM injection (`src/panel.js`) — never a
hand-edit of the vendored page.

## Licence and attribution

The Framework text is © Crown copyright, reproduced under the
[Open Government Licence v3.0](https://www.nationalarchives.gov.uk/doc/open-government-licence/version/3/).
This extension is an unofficial reading edition and is not published by
MHCLG; for the authoritative document see
[GOV.UK](https://www.gov.uk/guidance/national-planning-policy-framework).
Checking accuracy against the official Framework remains your
responsibility.
