# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

A Chrome MV3 side-panel extension that puts
[newnppf](https://github.com/j0hn4r/newnppf)'s NPPF 2026 reading edition into
Chrome's side panel: search relocated into an always-visible top bar, chapters
as a closed-by-default accordion, cross-reference/glossary links, reading
position memory, bookmarks-filter fixes, and a context-menu lookup — all
layered on top of a page this repo never edits.

## Commands

```bash
python tools/sync.py    # refresh vendor/nppf-index.html from ../newnppf, re-stamp upstream.lock
python tools/build.py   # vendor/ + src/  ->  dist/ (this is what you load unpacked)
```

`sync.py` is the only script that reaches outside this repo — it expects
`../newnppf` checked out as a sibling directory. `build.py` never touches
`../newnppf`; it only ever reads the vendored copy `sync.py` produced, so a
fresh clone builds without `newnppf` present at all.

There is no test suite. Verification throughout this project has been manual:
build, load `dist/` unpacked (or serve it over a plain static server for fast
iteration — see "Testing without Chrome" below), and exercise the feature by
hand. `dist/` is git-ignored; always rebuild before testing, and rebuild again
before committing if you touched `src/` or `tools/build.py` after your last
build.

## The one rule that matters

**PanelNPPF never edits `newnppf`. It only ever reads `vendor/nppf-index.html`.**

newnppf's own rule is that its `index.html` is a build artefact, verified
character-for-character against the source PDF, and its own CI fails on any
hand edit. Every panel addition here is therefore one of exactly two things:

- a **build-time text transform**, in `tools/build.py` (splitting out the
  inline `<style>`/`<script>`, collapsing chapters closed, stripping dead head
  weight, appending the panel's own `<link>`/`<script>` tags); or
- a **runtime DOM injection**, in `src/panel.js` (cross-reference links,
  glossary links, the citation button, the Contents box, everything else that
  touches the rendered page).

Never a hand-edit of `vendor/nppf-index.html` itself, and never a change to
`newnppf`'s own repo from here. If a fix seems to need editing the vendored
copy directly, it doesn't — either it belongs in `build.py` (a transform that
should apply to any future vendored copy too) or in `panel.js` (something only
true at runtime, in a real DOM).

## Layout

```
manifest.json      hand-written source, copied into dist/ as-is
src/
  background.js     service worker: action click, context menu, command -> storage handoff
  panel.css         panel-width overrides, layered over the page's own CSS
  panel.js          search relocation, citation button, cross-ref/glossary links,
                    Contents box, state restore -- everything runtime
icons/              icon.svg is the source; gen_icons.py rasterizes the PNGs the
                    manifest references; only the PNGs are copied into dist/
vendor/
  nppf-index.html   pinned copy of newnppf's index.html -- refreshed by sync.py only
  favicon/          copied from newnppf by sync.py
tools/
  build.py          vendor/ + src/  ->  dist/
  sync.py           refreshes vendor/ from ../newnppf, updates upstream.lock
upstream.lock       sha256 + commit of the newnppf index.html vendor/ was taken from
dist/               git-ignored; load this unpacked
PLAN.md             the full design log -- read this before any non-trivial change,
                    it has the reasoning and the traps below in much more depth
```

## Where to make a change

| You want to change… | Edit | Notes |
|---|---|---|
| Anything about how `newnppf`'s markup gets turned into the extension page | `tools/build.py` | Anchored, fail-hard extraction patterns — a silent zero-match must never ship |
| Search relocation, citation button, cross-reference/glossary links, Contents box, bookmark/position restore | `src/panel.js` | Runs after `nppf.js` — its DOM hooks (`#q`, `#clr`, `.chapter`, `[data-policy]`) already exist |
| Panel-width CSS overrides | `src/panel.css` | Loads after `nppf.css` in the cascade; stays inside newnppf's own `@media (max-width:1000px)` block except `.pn-hidden-nav` |
| Action click, context menu, keyboard command, storage handoff | `src/background.js` | Handoff goes through `chrome.storage.session`, never `sendMessage` — see below |
| What the manifest declares | `manifest.json` | Keep permissions to exactly `sidePanel`/`contextMenus`/`storage` — no host permissions, no content scripts |
| Refreshing the vendored page | `tools/sync.py` | Re-run the QA matrix (PLAN.md §9) before trusting a build against a moved upstream |

## Two mechanisms worth understanding before touching related code

**The cold-panel handoff goes through storage, not messages.** A context-menu
click or the keyboard command fires whether or not the panel document
currently exists. `background.js` writes `{ q, ts }` to
`chrome.storage.session`; `panel.js` reads it once on load (cold panel) and
also listens for `chrome.storage.onChanged` (warm panel already open).
`chrome.runtime.sendMessage` would be sent into the void against a cold panel,
so don't reach for it here.

**A remembered scroll position/hash is only meaningful once the layout it was
recorded against exists again.** This exact shape of bug has recurred across
this whole project (Phase 13's bookmark-filter reveal, Phase 15's
chapter-reopen and stale-hash fixes, Phase 16's search-clear fix — see
PLAN.md for each): something reveals previously-hidden content (a filter
toggling off, a chapter reopening, a search clearing), the page's height
changes under the reader, and a saved pixel offset or hash computed against
the *old* layout now points somewhere else entirely. Whenever you're
restoring a position after any reveal, restore the layout state first (open
the right chapter, turn off the right filter), then the scroll position —
never the offset alone.

## Traps that have already bitten us

- **`html{scroll-behavior:smooth}` (newnppf's own rule) applies to every
  `scrollIntoView`/`scrollTo` call, including ones this repo adds.** A smooth
  scroll doesn't move `scrollTop` synchronously — it schedules an animation
  starting next frame. If something else in the same task already changed the
  page's height (e.g. `clearAll()` revealing hidden content), the *next*
  paint shows the old scroll offset against the *new* layout first — a
  visible jump — before the animation glides to the real target. Pass
  `behavior: 'instant'` explicitly for any corrective scroll that's undoing a
  layout change from the same event, not a fresh forward navigation (where
  the smooth glide is the desired feel).
- **Chromium keeps a cached layout rect for an element inside a closed
  `<details>`.** `getBoundingClientRect()`/`getClientRects()` on such an
  element report a real, non-empty box (from before it closed) rather than an
  empty one — a geometry-only "is this visible" check will lie. Walk the
  ancestor chain checking `<details>.open` explicitly instead.
- **A bare policy-code search never marks the policy itself.** `.pid` (the
  code badge) is deliberately outside nppf.js's own `.srch` searchable text,
  so searching "S5" puts no `<mark>` inside the S5 policy — and nppf.js hides
  every `.policy`/`.node` with no mark, including that one. Anything that
  jumps to a bare-code search result needs to force it visible first (walk
  up *and* down: nppf.js hides each numbered paragraph inside a policy
  independently, not just the policy container).
- **`document.querySelector('[data-policy="S5"]')` can silently return the
  wrong element.** The hidden `#nav` tree (kept in the DOM for bookmark-star
  mirroring, not removed) carries `<li data-policy="…">` entries ahead of the
  real content in document order. Use `document.getElementById(code)` — a
  real policy's id always equals its code — plus a `.classList.contains
  ('policy')` guard.
- **A synthetic `WheelEvent` proves nothing.** Real scroll-wheel input is
  handled below the DOM event layer in this environment; dispatching one to
  "reproduce" a scroll bug will pass even when the real gesture doesn't work.
- **This preview/testing environment reports `document.visibilityState ===
  "hidden"` regardless of which tab is fronted**, which makes Chrome throttle
  `setTimeout`-based work heavily and unpredictably. If a debounced save
  seems to behave inconsistently across otherwise-identical test runs, don't
  trust a plain wait — trigger the save via actual navigation
  (`beforeunload`, synchronous) instead, or force real render frames with
  repeated screenshots.
- **A long-lived local preview server port accumulates browser HTTP cache**
  across a session's testing, immune even to a hard-refresh key command sent
  through automation. If a rebuilt file's behaviour doesn't match its
  (confirmed-correct) source, switch to a fresh, never-before-used port
  before concluding the code itself is wrong.

## Testing without Chrome

Most of this project's iteration has been against `dist/` served over a plain
static server (`python -m http.server <port> --directory dist`) rather than a
real loaded extension — `window.chrome` doesn't exist there, so
`background.js` and the real `chrome.sidePanel`/`chrome.contextMenus`/
`chrome.storage.session` calls aren't exercised, only `panel.js`'s DOM-side
logic (search/jump, links, position restore via its `localStorage` fallback
path). That's sufficient for almost everything in `src/panel.js` and
`src/panel.css`. Load `dist/` unpacked in a real Chrome and run PLAN.md's §9
QA matrix for anything touching `background.js`, the context menu, the
keyboard command, or `chrome.storage.session`.

## Publishing

See PLAN.md's Phase 17 for the store-readiness pass (README, this file,
`sync.py`, privacy policy, store listing copy, screenshots) and §8 for the
manifest MHCLG/Web-Store submission is checked against.
