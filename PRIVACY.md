# Privacy policy — NPPF 2026 Side Panel

_Last updated: 2026-09-14_

This extension does not collect, transmit, sell, or share any data, personal
or otherwise. There is no server, no analytics, no third-party script, and no
network request of any kind — the extension only ever reads the copy of the
National Planning Policy Framework bundled inside it.

## What the extension stores, and where

Everything below is stored **only on your own device**, using Chrome's
built-in extension storage (`chrome.storage.local`/`chrome.storage.session`)
and the panel page's own `localStorage`. None of it is ever sent anywhere —
not to the developer, not to any third party.

| Stored | Purpose | Cleared by |
|---|---|---|
| Which policy or chapter you last had open, and your scroll position | So reopening the side panel returns you to where you left off | Uninstalling the extension, or clearing site data for it |
| Your bookmarked policies/sections | So "bookmarks only" filtering persists between sessions | Same as above |
| The text you right-click and choose "Look up… in the NPPF" | Passed from the browser's context menu to the side panel so it can jump to or search for it | Immediately after the panel reads it |

## What the extension reads from other pages

The right-click "Look up '…' in the NPPF" context menu item reads only the
text you have selected at the moment you click it — nothing else on the page,
and nothing without that explicit action. That text is normalised (whitespace
collapsed, capped at ~120 characters) and used locally to decide whether to
jump to a matching policy or run a search inside the panel. It is never
transmitted, logged, or stored beyond that.

The extension has no host permissions and cannot read any page's content
outside of that one explicit context-menu action.

## Permissions

- **`sidePanel`** — required to show the reader in Chrome's side panel.
- **`contextMenus`** — adds the right-click "Look up in the NPPF" item.
- **`storage`** — the local-only reading-position and bookmark memory
  described above.

No host permissions, no content scripts, no remote code.

## Third-party content

The Framework text itself is © Crown copyright, reproduced under the
[Open Government Licence v3.0](https://www.nationalarchives.gov.uk/doc/open-government-licence/version/3/).
It ships inside the extension package; nothing is fetched from the internet
to display it.

## Changes to this policy

Any future change to what this extension stores or reads will be reflected
here before it ships in a new version.

## Contact

Questions about this policy or the extension can be raised via the
[GitHub repository](https://github.com/j0hn4r/PanelNPPF).
