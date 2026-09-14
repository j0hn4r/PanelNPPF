# PanelNPPF — implementation plan

A Chrome MV3 extension that puts the **NPPF 2026 reading edition**
(`../newnppf`, published at `j0hn4r.github.io/NPPF_2026`) into Chrome's side
panel, alongside whatever you are reading — a council portal, an officer
report, a decision notice, a draft statement.

Decided scope: **panel + context lookup**, **bundled derived copy** of the
page, **loaded unpacked but structured so a Web Store submission later is
paperwork, not a rewrite**.

## Status

- ✅ **Phase 0** — scaffold, manifest, `tools/build.py` script-split. Built
  and verified in a browser: no CSP errors, search/bookmarks/hash-jump all
  survive `nppf.js` becoming an external file.
- ✅ **Phase 1** — `panel.css`/`panel.js` chrome: search relocated into an
  always-visible top bar, brand block moved to the menu's footer. Verified
  against a local static server at 380px. One correction to §5's build
  transform along the way: the original step-4 snippet only showed linking
  `nppf.css` in `<head>`; `build.py` now links `panel.css` right after it so
  its overrides actually apply.
- ✅ **Phase 2** — `background.js` (action/context-menu/command → storage
  handoff) and `panel.js`'s consumer side written. The jump-vs-search
  decision logic (regex → `[data-policy]` DOM check → jump, else search) was
  verified against the real page: `"gb6"` (lowercase) jumps to `#GB6` with
  its chapter auto-expanded and the target clear of the top bar; `"Z9"`
  (matches the regex shape but isn't a real policy) correctly falls through
  to a search instead of a phantom jump; `"grey belt"` searches normally.
- ✅ **Phase 3** — copy-citation button and reading-position restore written
  and verified against the live page: `citationTextFor()` correctly pairs
  each `.mk` marker with its `.tx` text in document order (nested `i./ii./iii.`
  sub-items land after their parent, not interleaved), and strips
  `sup.fnref` footnote markers cleanly — checked specifically against PM1,
  which has one mid-sentence, confirming no fused digit ends up stuck to a
  word. Reading-position restore verified via its `localStorage` fallback
  path (the one exercisable outside a real extension): scroll to `#GB6` →
  saved after the 400ms debounce → fresh reload with no hash in the URL →
  lands back on `#GB6`. The actual clipboard write itself hit
  `NotAllowedError: Document is not focused` in this headless preview
  environment — an artifact of driving an unfocused automated browser, not
  a bug (our `.catch` handled it exactly as designed); a real click inside
  a real, focused side panel carries genuine user-gesture focus.
- ✅ **Phase 4** — chapter-accordion navigation, integrating the model from
  an earlier extension, `../nppfbrowser` (built against the Dec 2024 NPPF):
  no separate nav-tree dropdown at all, each chapter is its own accordion,
  closed by default, directly in the main flow. Concretely: `build.py`
  strips the ` open` attribute from every `<details class="chapter">`/
  `<details class="chapter annex">` tag (26 of them) in the vendored copy;
  `panel.js` hides `#nav` (`.pn-hidden-nav`, CSS `display:none` — its click
  handler and the bookmark mirroring in `nppf.js` keep running against it
  harmlessly, nothing to unwire) and relocates `#count` into the topbar
  next to search, since it was the one thing in the old dropdown still
  worth seeing without opening anything. `focusSearchInput()`/`runSearch()`
  no longer force-open the (now nav-less) dropdown first, since search
  input and match count both live in the always-visible topbar. Verified
  against the live page: chapters render as a closed accordion list on
  load; clicking a `<summary>` expands it and its content renders; search
  for "grey belt"/"green belt" auto-opens exactly the chapters containing a
  match (screenshot-checked) while others stay closed, with the "N MATCHES"
  pill sitting cleanly beside the search box; a `#S5`/`#GB6` jump
  auto-expands its chapter same as before; bookmarking and the copy-citation
  button both still work with the accordion closed initially; reading-position
  restore re-opens the right chapter after a fresh reload. This is a purely
  structural/behavioural port, not a visual one — nppfbrowser's numbered-badge
  card styling wasn't copied, since newnppf's `<details>` already had a
  native accordion triangle to reuse; flag if you'd like that styling ported
  too.
- ✅ **Phase 5** — compact, card-based visual design, again ported from
  `../nppfbrowser` (its bordered `.result-card`/`.chapter-item` look) rather
  than newnppf's long-form single-column spacing. All CSS-only, reusing
  newnppf's existing colour tokens throughout (so dark mode kept working
  with zero extra rules) rather than importing nppfbrowser's own separate
  light-only palette. Concretely: tighter type (`--fs`/`--lh` scaled down —
  these feed every size/leading in nppf.css via `var()`, so nothing
  downstream needed touching); chapters/annexes become bordered, rounded
  cards with a pill-shaped number badge; policies (and, outside policy
  chapters, each top-level paragraph/glossary entry) become individual
  cards; the old `:target`/S4-S5-refusal accent bar — positioned in the page
  margin, which cards no longer have — replaced with an inset `box-shadow`
  that can't clip regardless of available padding. One real bug found and
  fixed along the way: the refusal-highlight box-shadow rule was originally
  written `body.sidepanel body.show-refusal .policy[...]` (two separate
  ancestor `<body>` selectors), which can never match since there's only
  one `<body>` carrying both classes — caught by checking `getComputedStyle`
  directly rather than trusting a screenshot, fixed to the single compound
  selector `body.show-refusal.sidepanel .policy[...]`. Verified end-to-end
  after the fix: chapter cards render correctly closed, policy cards nest
  lettered sub-items without double-boxing, Annex B's glossary (129 entries)
  renders as a card list with its sticky A-Z bar still correctly pinning
  below the top bar mid-scroll, the refusal highlight shows the right inset
  colour on a real tagged policy, dark mode via `prefers-color-scheme`
  renders correctly throughout, and search/jump/bookmark/citation all still
  work. (One dead end during testing, not a real bug: a `location.hash`
  jump appeared not to scroll at all until measured after a long-enough
  wait — the same smooth-scroll-timing trap CLAUDE.md already warns about
  for long jumps, not a regression.) Annex A/B/etc.'s own distinct
  "ANNEX A"-style label was deliberately preserved, not given the same pill
  badge as numbered chapters — see §6b for why that took an explicit
  `:not(.annex)` rather than relying on cascade order.
- ✅ **Phase 6** — the filters menu's layout, requested as a UX review of
  "the menu." Found one real bug and one real priority-ordering problem,
  both stemming from Phase 4 hiding `#nav`: `.panel`'s own content shrank
  to well under half a typical viewport (measured: 325px of content in an
  800px-tall window), and since it has no background sized to fill the
  rest, the actual document behind it — whatever chapter the current
  scroll position happens to land on — was visible directly below the
  filters, with no boundary between "menu" and "page". Fixed with a
  `min-height` matching `.panel`'s own existing max-height (same `vh` →
  `dvh` fallback pair). Separately: "↑ Back to top" opened as the first,
  boldest thing in the menu — the obvious priority when this menu also
  held a long nav tree to escape from, not so much now that it doesn't.
  Reordered via `display:flex` + `order` (pure CSS, nothing moved in the
  DOM, so none of nppf.js's id-based bindings needed to know) so the
  filters come first and `.totop` is demoted below them, restyled down
  from a solid button to a quieter text row to match its new role. Added a
  "FILTERS" caption above the group, reusing `.section-h`'s all-caps label
  language rather than the class itself (which carries filter-visibility
  logic unrelated to a menu caption). One dead end while verifying `.totop`
  afterward, not a bug: clicking it appeared to do nothing under a plain
  `setTimeout` wait, reproduced identically against the **live, unmodified,
  published newnppf site** with the same test — `window.scrollTo(0,0)`'s
  implicit smooth animation needs actual rendering ticks to progress, which
  a backgrounded/non-rendering automation tab doesn't supply on its own;
  forcing real screenshots/`wait` calls (i.e. keeping the pane actively
  painting, as it would be for a real user watching their screen) let it
  complete. Pre-existing in `nppf.js`, unrelated to anything built here.
  Verified end-to-end after the fixes: search, jump, mode filter, bookmark,
  copy-citation and dark mode all still work; the filters group and
  demoted "Back to top" render correctly in both themes.
- ✅ **Phase 7** — Annex B's glossary: the A-Z bar's own links (render.py's
  markup, one per letter) jump to whichever term happens to sort first
  under that letter, arbitrarily -- not anything the reader asked for. The
  `:target` accent bar used everywhere else for something genuinely
  selected (a search result, a footnote, a citation link) made that
  arbitrary landing look like "this exact term was selected", reported
  directly from a screenshot. Fixed two ways at once: `panel.js` inserts a
  plain `<h3 class="pn-gloss-letter">` before each new letter's first entry
  (derived from each `.gloss`'s own `data-term`, already in alphabetical
  order) and repoints the bar's `<a href>`s at those headings instead of a
  specific term -- landing on a neutral heading rather than a `.gloss`
  itself means the highlight styling simply doesn't match anything there
  at all, fixing the *cause*. `panel.css` also disables `:target`
  highlighting on `.gloss` entries directly (`#annexB .gloss:target > .row
  {animation:none;box-shadow:none;background:none}`) as a belt-and-braces
  second layer, in case anything ever links to a specific glossary id some
  other way. Verified: 19 letter headings inserted (matching the bar's 19
  letters exactly), every link repointed, a direct link to a specific term
  no longer highlights it either, non-glossary `:target` (a policy jump)
  still highlights exactly as before, search still works, both themes
  checked visually.
- ✅ **Phase 8** — a policy-code range appended to each policy-carrying
  chapter's title, e.g. "4. Achieving sustainable development (S1-6)" --
  useful on the closed accordion row specifically, since that's where you'd
  otherwise have to open a chapter just to see what it covers. Checked
  against the source first rather than assumed: every one of the 19
  policy-carrying chapters (everything except the introduction) carries
  exactly one prefix, numbered with no gaps, so a plain min-max range is
  always accurate -- confirmed by parsing every chapter's `data-policy`
  values directly rather than hand-writing a chapter->range table that
  would silently drift the next time the source PDF changes. `panel.js`
  computes it the same way at runtime, from the live DOM. Inserted as a
  sibling *after* the title's `.srch` span, not nested inside it, because
  nppf.js snapshots each `.srch` element's `innerHTML` once at load to
  restore after a cleared search and walks its text nodes to highlight
  matches -- living outside `.srch` keeps the suffix out of both, verified
  directly: searching "sustainable development" correctly highlights only
  inside the title text, the range suffix is untouched throughout, and it
  reads back correctly after clearing. Checked in both themes.
- ✅ **Phase 9** — the biggest feature so far: policy text is full of
  cross-references to other policies ("in accordance with policy S1",
  "policies S4 and S5", "policy PM6(1)(c)") -- these are now real links to
  the referenced policy or sub-part, plus a Back control to return to
  wherever following one was clicked from. Checked the actual text first
  (150 raw candidates) rather than guessing the phrasing: single codes,
  multi-code lists joined by and/or/,/and-or, and parenthetical sub-part
  citations like "PM6(1)(c)" (confirmed this maps exactly to
  `id="PM6-1-c"` -- strip the parens, join with hyphens) all appear for
  real, so the regex targets all three rather than just the common case.
  Deliberately conservative: requires "policy"/"policies" immediately
  before the first code, rather than matching any bare code-shaped token
  anywhere -- this document's own single/double-letter prefixes collide
  with real-world things like motorway numbers ("the M1" is not a
  reference to policy M1), and a wrong link is worse than a missed one. A
  small number of loosely-phrased references (a long description with the
  code only appearing much later, parenthetically) aren't caught; noted as
  a known gap rather than loosening the match and risking false links.
  Every generated link is checked against the live DOM before being
  created at all (`document.getElementById(id)`) -- worst case for an
  over-eager regex match is inert plain text, never a broken or wrong
  link, verified directly: 141 links generated, 0 broken.

  **One real bug found empirically, not by inspection:** the sub-part
  pattern initially matched *zero* references, when the source clearly had
  them. The regex ended in `\b` to stop "S1" swallowing part of "S12" --
  but `\b` needs a word/non-word *transition*, and a match ending on a
  closing paren ("PM6(1)(c)") has non-word `)` followed by non-word space,
  never a boundary, so the engine backtracked all the way past every
  parenthetical before it could find a `\b` anywhere, silently losing them
  down to just "PM6". Fixed with a lookahead (`(?![0-9a-zA-Z])`) instead,
  which serves the same purpose without depending on what character came
  before it. Re-verified after the fix: 23 sub-part links, including a
  three-level one ("HO5(1)(a)(ii)" → `#HO5-1-a-ii`).

  **The other real risk, caught before it shipped rather than after:**
  nppf.js snapshots every `.srch` element's original `innerHTML` once at
  load (`el.dataset.orig = el.innerHTML`, to restore verbatim after a
  cleared search) *before* this script ever runs. Left alone, the first
  search-then-clear a reader did would have silently wiped every
  cross-reference link back out to plain text. Fixed by re-snapshotting
  `dataset.orig` for every element this pass actually changed --
  nppf.js's own restore reads it fresh each time, not a cached copy, so
  this alone makes the links durable across searches too. Verified: 141
  links before a search-then-clear cycle, 141 identical links after.
  Accepted, narrower tradeoff from the same interaction: nppf.js's
  highlight() matches within one text node at a time, so a search phrase
  that happens to span across a link boundary (rare -- most searches are
  either a policy code, fully inside one link's own text, or an ordinary
  phrase that doesn't cross one at all) won't be found as a single match.
  Searching "PM6" alone, fully inside its own link, still highlights
  correctly, verified directly.

  **Back control:** the panel has no browser chrome of its own to supply
  one, but a hash-only jump is a normal entry in the panel document's own
  `history` regardless, so a plain `history.back()` already does the right
  thing -- no state of our own to track, and nothing to get out of sync.
  Hidden until the first `hashchange` this session, rather than shown
  unconditionally (there's nothing to go back to on a fresh open, and
  `history.back()` there is a harmless no-op, but a visible control that
  does nothing yet is clutter). Verified end-to-end: clicking a
  cross-reference jumps and shows the target's `:target` accent stripe
  (correctly *kept* here, unlike Annex B's glossary -- following a genuine
  cross-reference is exactly the "this is what you asked for" case that
  styling is for); the Back control appears; clicking it restores both the
  exact prior scroll position and hash via native browser history, with
  zero code written to track either; the chapter open/closed state a
  reader had is untouched throughout, since that's a DOM property with no
  relationship to browser history at all. Checked in both themes.
- ✅ **Phase 10** — a menu/nav cleanup pass covering four separate reports
  at once: a Contents box (long chapters make it easy to lose track of
  where you are -- a compact chapter/annex jump list, not the 131-policy
  tree Phase 4 deliberately removed, now sits above the filters, and marks
  whichever chapter(s) are currently open every time the menu opens, a
  direct answer to "where am I" using state that already existed rather
  than a new scroll-position tracker); the search field given a real
  input's visual boundary (its own background, full border, rounded
  corners) instead of sharing the topbar's own background with only a 1px
  underline; more breathing room between the Back control and the search
  box; and Chrome's native "clear field" control on `<input type="search">`
  suppressed, which is what the reported "a blue x appears alongside the
  dark grey one" actually was -- a second, built-in control layering over
  `#clr`, not a second element added anywhere in this codebase.

  **A real, unrelated bug found while checking the result, not by
  inspection:** a screenshot of the newly-opened menu showed the mode
  filter's three buttons with no visible text. Computed styles showed why
  -- the row measured 11px tall against a natural ~27px (the buttons'
  own padding alone is 7px + 6px). Root cause: a flex item's *automatic*
  minimum size (its floor when the flex algorithm shrinks children) drops
  to 0 instead of its content size when that item has `overflow` other
  than visible along the flex container's main axis -- and `.modebar` has
  `overflow:hidden` (nppf.css's own rule, there to clip the segmented
  control's rounded corners), now a flex item of Phase 6's `.panel{display:
  flex;flex-direction:column}`. This session's own `.pn-toc` has the same
  overflow:hidden for the same clipping reason, and was exactly as
  exposed. Fixed by giving every direct child of the open `.panel`
  `flex-shrink:0` -- this menu is meant to scroll as one piece (`.panel`'s
  own `overflow-y:auto`), never to silently compress an individual
  control instead, regardless of which of its children happen to have
  `overflow:hidden` for unrelated cosmetic reasons. Confirmed by measuring
  `.modebar`'s own height before (11px) and after (28.6px) the fix, not
  just by a screenshot looking right afterward.

  One dead end while verifying the Contents list's own jump behaviour, not
  a bug: clicking a chapter far down the list (a ~8300px jump) appeared to
  never scroll at all even after several seconds of real waiting -- worse
  than the smooth-scroll-timing trap documented earlier in this file,
  which usually resolved within a couple of forced render ticks. Confirmed
  as the same underlying cause taken further: this automation environment
  only advances a smooth-scroll animation while it's actively being asked
  to render a frame (a screenshot or `wait` call), so a distance needing
  many animation frames crawls at roughly one frame per tool call rather
  than the continuous 60fps a real, undistracted browser tab gets for
  free. Forcing `scroll-behavior:auto` (instant) confirmed the underlying
  navigation itself is correct: menu closes, the target chapter
  auto-opens, and the scroll position lands exactly where expected, in one
  step. Nothing here needed fixing.

  Verified end-to-end: 26 Contents entries generated (20 chapters + 6
  annexes) with zero broken targets; clicking one closes the menu and
  jumps correctly; the currently-open chapter is highlighted on reopening
  the menu; the search field, Back control spacing, and the single (no
  longer doubled) clear button all check out visually; search, bookmark,
  citation, cross-reference links and dark mode all still work.
- ✅ **Phase 11** — two direct reports about the new Contents box. First:
  scrolling the menu does nothing while the pointer is over the Contents
  box itself. Confirmed with real scroll input, not a synthetic
  `WheelEvent` (dispatching one doesn't reproduce it -- the browser's own
  scroll-input handling lives below the DOM event layer, so a synthetic
  event proves nothing here either way). **Root cause not conclusively
  identified despite real effort**, worth recording plainly rather than
  overclaiming: `display:flex` on `.pn-toc` was the leading suspect
  (removing it appeared to fix a first test), but a careful, controlled
  A/B test -- same coordinate, same scroll amount, toggling only
  `display:flex` vs `display:block` on an otherwise-unchanged page --
  showed the wheel gesture doing nothing either way. `overflow:hidden` was
  also tested and ruled out on its own. What *is* confirmed directly:
  `.pn-toc` never has genuine overflow of its own to account for this
  (`scrollHeight === clientHeight`, always, since it grows to fit its own
  content rather than being height-constrained). Given that, chasing the
  exact CSS/browser mechanism further was dropped in favour of a fix that
  works regardless of it: `.pn-toc` now forwards its own `wheel` events
  straight to `.panel`'s `scrollTop` and suppresses whatever default
  handling was swallowing them. Re-verified on a fresh, untouched page
  load (not a page already carrying manual test overrides, which is
  exactly the kind of state that produced a misleading result earlier in
  this same investigation): scrolling with the pointer over the Contents
  box now moves the menu correctly.

  Second: clicking a chapter in Contents jumped to it, but didn't touch
  whatever chapter(s) happened to already be open from earlier reading --
  landing you in the right place with an unrelated chapter's content still
  expanded above it. Fixed by having the Contents click handler close
  every chapter except the one just clicked and open that one explicitly,
  rather than leaving it to native fragment-navigation's own auto-expand
  (which, confirmed separately, only reaches an ancestor of a target
  *nested inside* a closed `<details>` -- not a target a closed `<details>`
  *is*, the case here). Verified directly: chapters 4 and 7, deliberately
  left open beforehand, are both closed after clicking chapter 13 in
  Contents, and chapter 13 opens.

  Full regression pass afterward: search, bookmark, citation, cross-
  reference links, menu open/close and the modebar's own height (still
  28.6px, Phase 10's fix intact) all still check out.
- ✅ **Phase 12** — requested directly: Filters above Contents (the
  reverse of Phase 10), asked as a proper layout pass rather than a quick
  swap, so treated as one: the reordering (`order:0-3` for the filter
  group, `4-5` for Contents, gap left at `6-7` matching the scheme's
  existing gap before `.totop`'s `8`), a section divider added above
  "CONTENTS" reusing the exact top-border-then-label pattern `.totop`/
  `.panel-brand` already use for their own breaks (so the whole menu now
  reads as one consistent rhythm -- group, divider, group, divider, group
  -- instead of Contents and Filters only being told apart by a gap), and
  a real pre-existing inconsistency fixed while touching this anyway:
  `.modebar`/`.refusalbar`/`.bookmarkbar` (nppf.css's own rules) used a
  24px horizontal margin against every menu addition in this file's own
  20px, a 4px mismatch invisible while everything just sat in a single
  column but exactly the kind of thing a real layout pass should catch --
  confirmed by measuring all four sections' own left edges directly (20px,
  all four) rather than trusting it by eye. Reasoning for filters-first
  documented directly in the CSS this time, not left to be inferred:
  three compact controls read at a glance before the one large scrollable
  list, not scrolling past 26 entries just to reach a checkbox. Verified:
  mode filter, bookmarks-only toggle, and Contents' own collapse-others-
  and-navigate behaviour (from Phase 11) all still work correctly after
  the reorder; both themes checked visually.
- ✅ **Phase 13** — the main document's own defined terms ("previously
  developed land", "grey belt") linked to their Annex B glossary entries, the
  same TreeWalker/fragment-replace technique as Phase 9's cross-reference
  links, but scoped far more conservatively given the false-positive risk of
  matching ordinary English phrases rather than a distinctive policy code.
  Checked the actual data first: of Annex B's 129 `.gloss` entries, most
  `data-term` values are multi-word ("local planning authority", "strategic
  site"), but a handful are single words that also appear constantly as
  ordinary English ("settlement", "deliverable") — linking every occurrence
  of those would bury the document in noise, not aid it. Rather than a
  hand-maintained denylist that would silently drift as the glossary changes,
  the rule is structural and self-maintaining: **only multi-word terms are
  linked at all**. This one rule also absorbs the two glossary terms that
  carry a parenthetical qualifier in their `data-term` (stripped before
  matching, e.g. "Major development (for the purposes of...)" →
  "major development") without needing separate handling. Terms are matched
  longest-first so a longer phrase always wins over a shorter one it
  contains, and every match is checked against `document.getElementById`
  before linking (Phase 9's same safety net) — an over-matched term degrades
  to plain text, never a broken link. Scoped to first-occurrence-per-policy
  (a `WeakMap` keyed on the enclosing `.policy`/`.node` unit, mirroring
  Phase 9's per-document Back-control state pattern) so a term used
  repeatedly through one policy is linked once, not turned into a wall of
  underlines. Annex B's own text is excluded from the pass entirely — a
  glossary entry doesn't need to link to itself or to neighbouring entries.
  Verified directly: 327 links generated across the document, 0 broken
  targets, zero duplicate term-ids linked within any single policy (checked
  programmatically, not spot-checked), and none of the deliberately-excluded
  single-word terms leak through as link text.

  **Two bugs caught before shipping.** First, the digit-stripping step (some
  `data-term` values end in a disambiguating digit, e.g. "Major
  development71") used `\d+$` unconditionally, which also ate the `16` off
  of the real term "Post-16"; a plain negative lookbehind (`(?<!-)\d+$`)
  still broke on "Post-16" via backtracking, producing "Post-1" — fixed with
  a *positive* lookbehind requiring a letter immediately before the digits
  (`(?<=[a-zA-Z])\d+$`), which strips the trailing digits only when they're
  not part of the term's own text, verified against both cases directly.
  Second, an early draft's tooltip text was built from a `Map` that stored
  only each term's target id, not its canonical (correctly-cased) text,
  leaving the `title` attribute either wrong or a placeholder; fixed by
  having the lookup carry `{term, id}` together so the tooltip reads
  "Glossary: <the actual term>".

  **One existing rule relaxed, not just left alone.** Phase 7 disabled
  `:target` highlighting on every `.gloss` entry, reasoning that nothing
  should ever land on a specific glossary id — true at the time, since the
  only thing pointing at Annex B was the A-Z bar's own arbitrary
  first-letter-match landing (already fixed at its actual source in Phase 7:
  the bar points at plain heading elements now, which can't be `.gloss:
  target` in the first place). Phase 13 deliberately links a specific
  defined term straight to its own glossary entry — exactly the "this is
  what you asked for" case `:target` highlighting exists for elsewhere (a
  search result, a footnote, a Phase 9 cross-reference), so carrying the
  blanket suppression forward would silently swallow the highlight this
  phase's own links earn. The rule was removed rather than special-cased
  further. Verified directly: clicking a `.pn-gloss-ref` link now triggers
  nppf.css's own `landing` animation on the target's `.row` exactly as a
  policy cross-reference jump already does, confirmed by inspecting
  `getComputedStyle(...).animationName` mid-flight rather than trusting a
  screenshot (the animation fades within under 3 seconds, too fast to
  reliably catch by eye).

  Full regression pass afterward, including the specific interaction that
  broke Phase 9 the same way the first time round: a search-then-clear cycle
  leaves all 327 links intact (`nppf.js`'s `dataset.orig` re-snapshotted
  after injection, same pattern as Phase 9), confirmed before === during
  === after rather than assumed from the fix pattern alone. Cross-reference
  links, Contents box (including Phase 11's collapse-others-on-click and
  wheel-scroll fixes), Back control, mode/refusal/bookmark filters, and
  both themes all still check out.

  **Two further bugs, both reported directly from a screenshot/description
  after shipping.** First: the `:target` accent bar (§6b, `box-shadow:inset
  3px 0 0 var(--accent)` on `.node:target>.row`) visibly overlapped the
  glossary text itself, screenshotted against "Large-scale shared living
  accommodation". Every other `.node` has a `.mk` marker column (a number,
  letter, or bullet) giving the bar 39px of empty space to land in before
  text starts; `.gloss` (and, checked while fixing this, `.node.note` — six
  formula-style entries in Annex D with the identical bare-`.tx` structure
  and so the identical exposure) have no marker at all, just `.tx.srch`
  flush against `.row`'s own left edge, so the bar landed squarely on the
  first glyph. Fixed with a permanent 10px `padding-left` on both rows,
  reserving a gutter unconditionally rather than only while `:target`
  matches — the alternative (padding added only on `:target`) would shift
  the text sideways at the exact moment the highlight fires, worse than a
  small indent that's simply always there. Verified directly against the
  same entry: the bar now sits fully clear of the text.

  Second: with "bookmarks only" ticked, clicking a cross-reference or
  glossary link to a policy/section that isn't bookmarked did nothing —
  `nppf.js`'s own `.bhide{display:none!important}` (toggled by
  `#bookmarkToggle`) had hidden the target, and a browser can't scroll to or
  focus an element with no box. Fixed with a delegated click listener on
  `a.pn-xref, a.pn-gloss-ref`: if the filter is on and the link's target (or
  its closest `[data-policy]`/`[data-bm]` ancestor, covering both a direct
  policy link and a cross-reference into one specific sub-part of a policy)
  currently carries `.bhide`, the listener unchecks `#bookmarkToggle` and
  dispatches its own `change` event — the same event `nppf.js`'s own
  listener reacts to — *before* returning. This is safe specifically
  because following a link is a click's *default action*, which the browser
  only carries out once every listener on that click has finished running;
  turning the filter off inside the listener is guaranteed to land before
  the browser's own hash navigation does, so the target is already visible
  by the time the jump happens. Verified directly, not assumed from reading
  the code: bookmarked only PM1, ticked the filter, clicked a live
  cross-reference to S1 (confirmed hidden first) — the filter switched off,
  `#S1` lost `.bhide`, and `:target`/scroll landed on it correctly in one
  click. Regression-checked the untouched path too: with S1 *also*
  bookmarked (so already visible), clicking the same link leaves the filter
  on throughout — the listener only acts when the target was actually
  hidden, never unconditionally on every cross-reference click.

  **A third bug, reported directly against S4 by name:** "some links don't
  seem to be there now... in the S4 policy." Not a regression from either
  fix above — S4's own text was always affected by a gap Phase 9 already
  documented as deliberately left open: "the application of the policies in
  this Framework for existing recreational land and facilities (HC7), Local
  Green Space (HC8), areas of particular importance for biodiversity and
  geodiversity (N6), Protected Landscapes (N4) and development within
  residential curtilages (L2(1)(d))" never has "policy"/"policies"
  immediately before any of those five codes — each one only arrives later,
  alone in its own parentheses, after a description of what it covers.
  REF_SPAN_RE requires that word immediately before the first code
  specifically to avoid linking something that only looks like a code
  (Phase 9's own example: "the M1" is not policy M1); S4 simply turned out
  to be where that documented trade-off had a real, visible cost. Rather
  than loosen the existing pattern and reopen that risk everywhere, a
  second, narrower pass was added for this shape specifically: a
  parenthetical containing *only* a code (plus its own nested sub-part
  parens, same balancing the first pass already uses for "PM6(1)(c)").
  Checked against the whole document before shipping, not assumed safe from
  the pattern alone: exactly 5 such parentheticals exist anywhere in the
  text, all 5 inside S4, and all 5 resolve to a real, correct id (HC7, HC8,
  N6, N4, L2-1-d) — no false hit from a use-class label or anything else
  merely shaped like one. The existing-id safety net (Phase 9's own
  `document.getElementById` check) is still what actually makes this safe
  in general, not the low count — an unrelated bracketed match elsewhere in
  the document would simply fail that check and stay plain text. Only the
  code itself is underlined, its surrounding parentheses left as plain
  punctuation, matching how the first pass never links anything but the
  code. Verified directly: all 5 links render and resolve correctly, one of
  them right beside an unrelated Phase 13 glossary link ("Protected
  Landscapes (N4)" — the term dotted, the code solid, immediately
  adjacent), reused the same `codeToId`/`PREFIX_ALT`/`touchedSrch`
  machinery so the search-then-clear survival check still holds (146 total
  cross-reference links, up from 141, before === after a search cycle), and
  0 broken targets across the full document.

  **A fourth bug, reported directly:** following a link to a non-bookmarked
  policy while "bookmarks only" was on now correctly revealed it (the first
  fix above) — but clicking Back afterwards didn't scroll back to the
  original policy. Investigating turned up the same cause hitting the
  *forward* click too, not just Back — confirmed directly, not assumed:
  clicking a cross-reference from a bookmarked policy to a non-bookmarked
  one left the panel scrolled to a completely unrelated policy several
  chapters away, `getBoundingClientRect().top` deep in negative numbers.
  Root cause: turning the bookmark filter off right before navigating
  changes the page's overall height dramatically (a large amount of
  previously `.bhide`-hidden content reappears at once), and both of the
  ways the browser lands on a hash-linked target compute that landing spot
  against whatever layout exists at that instant — a fresh fragment
  navigation (the forward click) scrolls to the target's position in the
  *old*, filtered-short layout, a moment before the reveal's own reflow
  moves everything; a history navigation (the Back control, built on a
  plain `history.back()`) instead restores the exact pixel offset it
  remembered for that entry, also recorded against the old, filtered-short
  layout, which the now-unfiltered page no longer matches at all. Fixed
  once, generally, rather than patched separately at each call site: a new
  `hashchange` listener re-asserts whatever the current hash points to is
  actually reachable (revealing it from the bookmark filter, opening any
  closed `<details>` ancestor) and then explicitly scrolls to it, on
  *every* hashchange regardless of what caused it — a forward click, the
  Back control, the browser's own native Back/Forward, Contents, or Phase
  14's own search-jump. Deliberately overrides whatever position either of
  the browser's own mechanisms left, rather than trying to predict or time
  around them. Idempotent everywhere it wasn't actually needed (scrolling
  to where you already correctly landed is a no-op), so it's safe to run
  unconditionally rather than only when a reveal just happened. Verified
  directly: PM2 (bookmarked) → its own cross-reference to S1 (not
  bookmarked) now lands exactly at the top of the panel (not several
  chapters away), and clicking Back from there returns to PM2 exactly at
  the top too, both confirmed by measuring `getBoundingClientRect().top`
  rather than trusting a screenshot alone; a plain cross-reference click
  with the filter off entirely is unaffected; Phase 14's search-jump (S5,
  GB7's full content) and the Contents box's own click-to-navigate both
  still work unchanged.

  **A fifth bug, reported directly, that the fourth fix's own generality
  had overcorrected:** returning to a bookmarked policy now bounced to the
  top of its *chapter* instead. Root cause: forcing a fragment-scroll on
  *every* hashchange, including a Back navigation, assumes the current
  hash names the right target precisely -- true for a fresh jump, false for
  Back whenever the reader reached that policy by opening its chapter and
  scrolling to it by hand rather than by jumping there. Manually opening a
  chapter's `<summary>` and scrolling doesn't touch the hash at all, so the
  history entry being returned to had the *chapter's* hash on it (or none),
  never the policy's -- confirmed directly by reproducing that exact
  browsing path rather than assuming the earlier test's hash-based setup
  was representative. Forcing a fragment-scroll there could only ever
  reach the chapter, no matter how it was written.
  
  Fixed by recognising that the *actual* problem was never the hash being
  imprecise -- it's that turning the bookmark filter off changes the page's
  height right as the browser records a scroll position for the entry
  being left, so that entry's remembered *pixel offset* (which browsers
  already track per history entry, independent of and far more precise
  than any hash) no longer lines up once the layout has changed. The fix
  now stamps the filter's current state onto the entry being left
  (`history.replaceState`) every time a link might reveal something, and a
  new `popstate` listener -- the one event that fires specifically for
  history traversal, never for a plain forward `location.hash = …` -- restores
  that remembered filter state before the browser's own scroll-position
  memory resolves against a layout that (once restored) matches again.
  `popstate` also sets a short-lived flag the `hashchange` handler checks,
  so the forced fragment-scroll from the fourth fix now applies *only* to a
  genuine forward jump (a fresh click, Contents, Phase 14's search-jump) --
  exactly the case with no earlier scroll memory to protect -- and Back
  navigation is left to the browser's own, now-accurate, restoration
  instead. Verified end-to-end reproducing the exact reported path: bookmark
  PM2, enable the filter, open chapter 2 by clicking its own `<summary>`
  (no hash), scroll to PM2 by hand (still no hash), click its
  cross-reference to S1 (not bookmarked) -- reveals and lands on S1
  correctly -- then click Back: chapter 2 is still open, the filter is back
  on, and PM2 is at the exact same `getBoundingClientRect().top` (77.5) it
  was at before the forward click, not the chapter's own top. The
  hash-based case from the fourth fix (PM2 reached via a hash jump) still
  works identically; Phase 14's search-jump, GB7's deep-content reveal,
  Contents-box navigation, link survival across search, and a plain
  cross-reference click with the filter off entirely all re-verified
  unchanged.
- ✅ **Phase 14** — the visible search box now prioritises the actual policy
  when its code is searched ("S5" now surfaces the S5 policy itself, not
  just wherever "S5" happens to be mentioned), on top of the existing
  highlight-everywhere search rather than instead of it -- requested
  directly: "that is useful to have too but can we prioritise showing the
  actual policy if it is search for." Reuses Phase 2's own code-vs-search
  decision (`POLICY_CODE_RE` plus a live DOM check, so a shape-only match
  that isn't real -- Phase 2's own "Z9" example -- never jumps to a phantom
  anchor) and its existing `jumpToPolicy()`/hash-navigation machinery,
  rather than building a second parallel mechanism.

  **A real, deeper problem than expected turned up testing this against
  the live page, not assumed from reading nppf.js.** `searchable` there is
  `.srch` elements only, and a policy's own code badge -- `<span
  class="pid">S5:</span>`, sitting right beside its `.srch` title, not
  inside it -- is deliberately excluded (nppf.js has no reason to let a
  policy highlight its own number every time it's mentioned). That means a
  bare code search like "S5" never places a `<mark>` inside the S5 policy
  itself, so nppf.js's own `run()` -- which hides every `.policy`/`.node`
  with no match -- hides the *genuine* policy right along with everything
  that didn't match, exactly backwards for a code search: searching a
  policy's own number could leave that policy invisible while nine other
  mentions of it stayed on screen. A plain `location.hash` jump on top of
  that would have landed on a `display:none` element and visibly done
  nothing. Fixed with a `forceVisible()` helper that walks the target's
  whole ancestor chain removing nppf.js's own `.hide` and opening any
  `<details>` it passes through, run immediately before the jump --
  harmless to nppf.js's own state, since its very next `run()` (triggered
  by the next keystroke) starts with its own `clearAll()` and recomputes
  every `.hide` from scratch regardless.

  **A second bug, also only found by measuring rather than assumed
  correct once linked up:** grabbing the actual target element used
  `document.querySelector('[data-policy="S5"]')`, mirroring Phase 2's own
  `handleLookup` -- except Phase 2 only ever used that selector to check
  *truthiness* before navigating by hash, never needing the element itself.
  Phase 4's hidden `#nav` tree (`.pn-hidden-nav`, kept in the DOM rather
  than removed, for nppf.js's own bookmark-star mirroring) carries `<li
  data-policy="S5">` entries with no class of their own, ahead of the real
  content in document order -- so `querySelector` silently returned the
  *invisible nav item*, not the policy card, and `forceVisible`/reveal logic
  was reaching into the wrong element entirely (caught by logging
  `target.className` mid-flow and finding it empty, not by inspection).
  Fixed by using `document.getElementById(code)` instead, unambiguous since
  a real policy's `id` always equals its code exactly, plus a defensive
  `.classList.contains('policy')` check before trusting it.

  **A third issue, caught by measuring `getBoundingClientRect()` after the
  jump rather than trusting a screenshot alone:** a live search can hide
  most of the document, leaving the page far shorter than usual -- short
  enough that the target policy could already sit partway inside the
  viewport before the jump ran, which left the browser's own native
  fragment-scroll (tuned to bring a target *into view*, not to the *top* of
  it) deciding almost no scrolling was needed and stopping with only the
  policy's top edge peeking over the bottom edge of the panel. An explicit
  `target.scrollIntoView({block:'start'})` after `jumpToPolicy()` always
  aligns the target's top edge to the top of the viewport instead,
  respecting the same `[id]{scroll-margin-top}` clearance every other jump
  in this file already relies on.

  Verified end-to-end on a genuinely fresh page load, at the panel's real
  narrow width: searching "S5" shows "9 matches" exactly as before
  (highlighting every mention elsewhere, S3/S4/HO12's cross-references
  included) *and* scrolls the actual S5 policy card to the top of the
  panel with its `:target` accent bar showing; a shape-only non-existent
  code ("Z9") does not jump, matching Phase 2's own precedent; searching a
  policy's code while "bookmarks only" is on and that policy isn't
  bookmarked turns the filter off and reveals it (reusing the same
  `revealFromBookmarkFilter` helper written for the cross-reference/
  glossary-link fix just above, rather than a third copy of that logic);
  an ordinary text search ("green belt", 83 matches) never triggers a jump
  at all; and a full search-then-clear cycle still leaves all 146
  cross-reference and 327 glossary links intact, 0 broken.

  **A fourth issue, reported directly right after this shipped:** searching
  "GB7" scrolled to the right policy, but showed only its title -- no
  content underneath. Same root cause as the very first bug above, one
  level deeper: nppf.js's own hide pass doesn't stop at the `.policy`
  container -- it independently hides *each numbered paragraph inside it*
  that has no `<mark>` of its own (`document.querySelectorAll('.node')...
  if(!b.querySelector('mark')) b.classList.add('hide')`), and a bare code
  search puts a mark in none of them either, same as the container. The
  original `forceVisible()` only walked *up* the target's ancestor chain,
  so it revealed the now-visible-but-empty policy shell while all 22 of
  GB7's own child nodes stayed individually hidden underneath it --
  confirmed directly by counting `.hide` elements inside the target (22
  before the fix, 0 after), not just by eyeballing a screenshot. Fixed by
  extending `forceVisible()` to also clear `.hide` from every hidden
  descendant of the target, not just its ancestors. Re-verified end-to-end:
  GB7 now shows its full text (all lettered sub-items) at the top of the
  panel; S5 (Phase 14's original test case) still reveals correctly too;
  the fake-code/plain-search/link-survival checks above all still pass
  unchanged.
- ✅ **Phase 15** — reported directly: reopening the panel "quite often"
  scrolled to the bottom rather than back to where reading left off. Root
  cause: `tools/build.py` collapses every chapter closed by default, so a
  fresh load always starts far shorter than a page with a chapter open for
  reading -- and Phase 3's position-restore only ever saved a bare
  `scrollY`, meaningless once the layout it was recorded against no longer
  exists. Restoring that pixel offset against the freshly-collapsed,
  much-shorter page landed deep in the collapsed chapter list, which reads
  exactly like "dumped at the bottom" -- confirmed directly, not assumed:
  reproduced with a chapter opened, scrolled into, then reloaded, landing
  mid-way through the closed accordion rather than back in the chapter.
  Fixed by saving which chapter(s) are open alongside the hash/scrollY, and
  reopening them before restoring scroll -- giving the page the same
  height it had when the position was recorded, the same fix shape as the
  bookmark-filter/scroll-position bugs above (a remembered pixel offset is
  only meaningful once the layout it was recorded against exists again).
  Verified end-to-end: opening one chapter, scrolling into it, and
  reloading now reopens that exact chapter and lands back at the same
  in-content position (confirmed via `elementFromPoint`, not just a
  screenshot, given this session's own well-documented smooth-scroll/
  render-timing quirks); multiple chapters open at once are all correctly
  reopened together; the existing hash-based restore path (reached via a
  cross-reference jump, unaffected by this change) still works unchanged;
  link counts, search-jump, and Contents navigation all re-verified.

  **A second cause of the exact same symptom, reported directly right
  after this shipped:** closing and reopening the panel after ordinary
  reading (no bookmark filter involved this time) still landed far from
  where the reader actually was -- "even if I was not near there
  previously". Root cause: `location.hash` never clears itself on a
  manual scroll. Every cross-reference, glossary, or Contents click sets
  it, and it just sits there afterward with no relationship to wherever
  the reader scrolls to next -- yet `savePosition()` saved it
  unconditionally every time, and the restore always preferred a truthy
  `hash` over `scrollY`. A reader who clicked exactly one link early in a
  session and then read on by scrolling manually would reopen to that old
  click, however far away it happened to be — which reads as "the bottom"
  whenever the click happened to be late in the document, regardless of
  where the reader actually ended up. Fixed by only trusting `hash` as
  current if its target is both on screen (within one viewport height of
  the top) and not sitting inside some other, now-closed chapter;
  otherwise it's saved as empty and scrollY/openChapters (already fixed
  above) take over.

  **A real trap hit twice while verifying this, worth recording:**
  checking "is the target still on screen" with
  `getBoundingClientRect().top` alone very nearly shipped a broken fix --
  Chromium keeps a *cached* layout rect for an element inside a closed
  `<details>` (from before it closed), so both `getBoundingClientRect()`
  and `getClientRects()` report a real-looking box for a target that's
  actually completely hidden, rather than an empty one. Confirmed
  directly by walking the ancestor chain and finding a closed
  `<details class="chapter">` between the target and `<body>` while its
  rect still read a plausible on-screen value. Fixed by checking ancestor
  `<details>` state explicitly (`insideClosedChapter`) rather than
  inferring visibility from geometry at all. Separately, initial testing
  of this fix gave inconsistent, seemingly-random results across
  otherwise-identical runs; tracked down to `document.visibilityState`
  reading `"hidden"` throughout this whole session's testing environment
  regardless of which tab is fronted, which makes Chrome throttle the
  debounced save's `setTimeout` heavily and unpredictably -- resolved by
  triggering saves through actual navigation (`beforeunload`, which fires
  synchronously, no timer involved) rather than waiting out the debounce,
  the same technique already relied on elsewhere in this file's own
  verification history. A second, compounding false lead during the same
  investigation: earlier readings kept showing the *old* code's behaviour
  despite confirmed-correct source and a rebuilt `dist/`, traced to the
  preview server's own port having accumulated browser HTTP cache across
  this session's very extensive testing, immune even to a hard-refresh
  key command; switching to a freshly-used port resolved it immediately.
  Neither of these was a defect in the fix itself, but both cost real
  time to tell apart from one, so recorded here rather than left to
  resurface as "unexplained flakiness" later.

  Verified end-to-end once these were untangled: a stale hash from an
  earlier click is correctly discarded in favour of the actual
  scrollY/openChapters once the reader has scrolled away from it (checked
  by reproducing the exact reported path -- click a cross-reference,
  scroll to a wholly different, later chapter, close and reopen); a hash
  that's still genuinely current (closed immediately after following a
  link, never scrolled away from) still restores via the hash path
  exactly as before, `:target` highlight included; link counts and the
  earlier chapter-reopen fix both re-verified unchanged.
- ⬜ Phase 16 (sync.py, README/CLAUDE.md, store-readiness pass)

**Still unverified regardless of phase, and can't be from here:** this has
never been loaded as an actual unpacked Chrome extension
(`chrome://extensions` → Load unpacked). Phase 2's DOM-side decision logic
was tested by re-running the same code against the live page over
`http://localhost`, where `window.chrome` doesn't exist — so the actual
`chrome.sidePanel.open()`, `chrome.contextMenus.create()`/`onClicked`, and
`chrome.storage.session` calls in `background.js`, plus panel.js's
`consumePendingLookup`/`onChanged` wiring around them, are still unexercised
end-to-end (cold-panel-open vs. warm-panel-already-open, the real context
menu label, the `Alt+Shift+N` binding actually registering). Load `dist/` as
an unpacked extension and run through the §9 QA matrix, particularly: right-click
a selection → panel opens to the right place; the same with the panel
already open; the keyboard command with nothing selected.

---

## 1. What we already have working for us

Checked against `newnppf` at commit `2930558`:

| Finding | Consequence |
|---|---|
| The `@media (max-width:1000px)` layout renders cleanly at 400px — verified in a 400×820 viewport | The panel port is mostly mechanical; no new responsive layer needed |
| **No inline event handlers, no `eval`/`new Function`, no `javascript:` URLs** anywhere in `index.html` | Only *one* MV3 CSP violation to fix: the single inline `<script>` |
| No external network resources — only local `favicon/*` | The extension needs **no host permissions and no network access** |
| `.tblwrap{overflow-x:auto}` already wraps every annex table | Tables survive a 320px panel |
| Every JS hook is bound to an element by id (`#q`, `#clr`, `#count`, `#navtoggle`, `#totop`) | We can **reparent** the search box into the top bar and its listeners still fire |
| Search is driven by a debounced `input` listener on `#q` | The extension drives search by setting `#q.value` + dispatching `input` — no reliance on internal globals |
| `<details>` auto-expands when a `#fragment` targets something inside it (native, documented in CLAUDE.md) | Deep-linking to `#S5` needs zero extra JS |
| Theme is pure `prefers-color-scheme` | Dark mode follows Chrome for free |

## 2. What has to change, and why

1. **The inline `<script>` must become an external file.** MV3's
   `extension_pages` CSP is `script-src 'self'` — inline script is blocked
   outright. Inline `<style>` is *not* restricted, but we externalise it too
   for tidiness. This is the only hard blocker, and Phase 0 retires it first.
2. **The brand block costs ~200px at the top of a 400px panel** — mostly
   dead space once you know what the panel is. Hidden; its attribution and
   disclaimer move into the menu (see §6 — that is a licence obligation, not
   decoration).
3. **Search is behind the hamburger.** In a lookup panel, search is the
   primary action, so it moves into the always-visible top bar.

## 3. The one architectural rule

> **PanelNPPF never edits `newnppf`. It only ever reads `newnppf/index.html`.**

`newnppf`'s governing rule is that `index.html` is a build artefact, verified
character-for-character against the PDF, and CI fails on any hand edit. So:

- The build **derives** the panel page from the committed `index.html`.
- Every panel addition — the citation buttons, the moved search box, the
  attribution block — is a **runtime DOM injection by `panel.js`**, never a
  change to the generated markup. Injecting a `⧉` glyph into `render.py`'s
  output would need a matching exclusion in `verify.py`'s HTML extraction —
  exactly the trap CLAUDE.md documents for `.bookmark-btn` and the
  `Objective`/`Footnotes` labels. Runtime injection sidesteps it entirely:
  the fidelity checks never see the additions.

## 4. Repository layout

```
PanelNPPF/
  manifest.json          hand-written source
  src/
    background.js        service worker: action, context menu, command
    panel.css            panel-width overrides, layered over the page's own CSS
    panel.js             search relocation, citation buttons, state restore
  icons/                 16 / 32 / 48 / 128 px
  vendor/
    nppf-index.html      pinned copy of newnppf's index.html
    favicon/             copied from newnppf
  tools/
    build.py             vendor/ + src/  ->  dist/
    sync.py              refresh vendor/ from ../newnppf, update upstream.lock
  upstream.lock          sha256 of the index.html the overrides were checked against
  dist/                  git-ignored; THIS is what you load unpacked
  README.md
  CLAUDE.md
```

**Why vendor the page rather than read the sibling directory at build time:**
a fresh clone builds without `newnppf` checked out next to it, and the
extension you load is always reproducible from this repo alone. 716KB in git
is a fair price. `tools/sync.py` is the only thing that reaches across to
`../newnppf`, and it records the hash it took, so `build.py` can tell you the
upstream page moved and the panel overrides deserve a re-check.

## 5. The build transform (`tools/build.py`)

Reads `vendor/nppf-index.html`, writes `dist/`:

1. **Assert the hash** matches `upstream.lock`; on mismatch print a loud
   warning listing what to re-verify (§9's QA matrix), but still build.
2. **Split out the inline blocks** using *anchored* patterns, asserting
   exactly one match each and failing hard otherwise — a silent zero-match
   here would ship a page with no JS:
   - `<style>…</style>` → `dist/nppf.css`
   - `<script>…</script>` (the last thing before `</body>`) → `dist/nppf.js`
3. **Strip dead head weight**: the `og:*`/`twitter:*` meta tags (nothing
   crawls an extension page) and `<link rel="manifest" href="favicon/…">`
   (a web app manifest inside an extension page is meaningless).
4. **Append the panel layer**, in this order — `panel.js` must run after
   `nppf.js` so the hooks exist:
   ```html
   <link rel="stylesheet" href="nppf.css">   <!-- in <head> -->
   ...
   <script src="nppf.js"></script>
   <script src="panel.js"></script>
   ```
5. Add `<body class="sidepanel">` so every override in `panel.css` is scoped
   to the panel and nothing leaks into a plain-tab view of the same page.
6. Copy `src/*`, `icons/`, `vendor/favicon/` and `manifest.json` into `dist/`.

## 6. Panel chrome (`panel.css` + `panel.js`)

The top bar is `[☰] [ Search the Framework… ] [N MATCHES] [×]`. The `☰`
button still opens a dropdown, but it's filters now (mode, S4/S5 highlight,
bookmarks-only), not navigation — see §6a for why the nav tree isn't in it.

- `panel.js` moves the existing `.searchbox` and `#count` nodes out of
  `.panel` and into `.mobilehead`. Listeners are element-bound, so they
  survive the move. Because both now live in the always-visible topbar
  rather than inside the collapsible dropdown, `focusSearchInput()`/
  `runSearch()` no longer need to open that dropdown first — a leftover
  from before this move that Phase 4 also cleaned up.
- `--mobilebar-h` grows from 46px to ~52px to fit the search row. **Every
  anchor-clearance rule already derives from that variable** (`[id]`,
  `.chapter`, `.azbar`, `#annexB .gloss[id]` all use
  `calc(var(--mobilebar-h) + …)`), so they self-correct — which is why the
  bump is safe, and why it must stay a variable change rather than a
  hard-coded height.
- `.brand{display:none}` in the panel. `panel.js` appends the tagline, the
  "checking accuracy remains your responsibility" disclaimer and the
  official-NPPF link to the bottom of the open menu. **This is not
  optional**: the text is Crown copyright under OGL v3.0 and the page is
  explicitly an unofficial edition.
- `.doc` inline padding 20px → 14px, to win reading width.
- The `.panel` overlay, `body.nav-open` scroll lock and `#prog` hairline all
  work unmodified. The mobile-menu's collapsed-nav-tree machinery
  (`.nav-expand` carets, `li.nav-ch.expanded`) is now moot — `#nav` itself is
  hidden (§6a) — but nothing needed to be un-wired for that; it just runs
  against a hidden subtree.
- Overrides stay inside the existing `@media (max-width:1000px)` block, so
  dragging the panel wider than 1000px gives you the real two-column desktop
  layout — a free bonus, not a bug to suppress. `.pn-hidden-nav` is the one
  exception, deliberately unscoped by that breakpoint (§6a).

## 6a. Chapter-accordion navigation (no nav-tree dropdown)

Ported from an earlier extension, `../nppfbrowser` (built against the Dec
2024 NPPF as a `default_popup`, not a side panel): instead of one long
scrolling document with a separate "contents" dropdown for jumping around,
each chapter is its own closed-by-default accordion and *is* the
navigation — click a chapter to open it, scroll within it, done. No overlay
to open first.

newnppf already renders every chapter/annex as native `<details
class="chapter">` with a working disclosure triangle (`.chapter>summary::
before`, rotated on `[open]`) — CLAUDE.md's collapsible-sections design was
already most of the way to an accordion, just defaulting *open* with
navigation handled separately by the nav tree. Two changes get the rest of
the way there, both confined to the panel-only layer:

- **`tools/build.py`** strips the literal ` open` from every `<details
  class="chapter…">` tag in the vendored copy (26 matches: 20 chapters + 6
  annexes) — chapters start collapsed. This is a text transform of
  `vendor/nppf-index.html`, the same kind of thing as splitting out
  `<style>`/`<script>`; it never touches that vendored file itself, only
  what `build.py` derives from it into `dist/`.
- **`panel.js`** hides `#nav` (adds `.pn-hidden-nav`, a plain `display:none`
  in `panel.css`) instead of deleting it. Two things in `nppf.js` still
  reference it — `navEl.addEventListener('click', …)` (routes a nav-tree
  link tap to `location.hash`) and `syncBookmarkUI()`'s mirroring of star
  state onto both the content-area and nav-tree buttons — and both keep
  running exactly as before, just against an element nobody can see or
  click. Nothing to unwire.

**Why this doesn't break Phase 2's jump-to-policy or Phase 3's
position-restore:** both already worked by setting `location.hash` and
relying on the browser's native "auto-expand every closed ancestor
`<details>` when scrolling to a fragment" behaviour — documented in
newnppf's CLAUDE.md for footnote links, and already true regardless of a
chapter's *default* state. Closing chapters by default doesn't change that
mechanism at all; it was already handling the closed case. Confirmed by
re-running both against the accordion build: `#S5`/`#GB6` still auto-expand
their chapter, and restoring a saved position still lands on an expanded
target chapter after a fresh reload.

**Why search still works:** `nppf.js`'s `run()` already followed "auto-open
a match, never force-close anything" (CLAUDE.md) for exactly this reason —
it doesn't care whether a chapter's *default* was open or closed, only
whether searching just put a `<mark>` inside it. Verified: searching
"green belt" auto-opens only the chapters actually containing a match,
leaving the rest collapsed, with the "N MATCHES" pill visible the whole
time next to the search box.

**What was left for later, at the time:** this phase ported nppfbrowser's
*behaviour* only, not its bordered-card *look* — newnppf's existing
disclosure triangle covered the interaction, and reskinning risked clashing
with everything else the page does (footnote popovers, the refusal
highlight, dark mode) without a closer look first. That visual porting
became Phase 5 (§6b below), once asked for explicitly.

## 6b. Compact, card-based visual design

Phase 5, ported from the same source as §6a's behaviour: `../nppfbrowser`'s
`.result-card`/`.chapter-item` look (bordered, rounded, tightly spaced) in
place of newnppf's long-form single-column reading spacing. CSS-only, and
throughout it reuses newnppf's *own* colour tokens (`--card`, `--tint`,
`--accent`, `--rule`, etc.) rather than importing nppfbrowser's separate
light-only palette — the two extensions' colours were never meant to match,
but newnppf's tokens already include a dark-mode set
(`@media(prefers-color-scheme:dark)`), so building on them means dark mode
needed zero extra rules to keep working. Also unlike §6a, none of this is
scoped to `@media(max-width:1000px)` — density is a general preference for
the panel, not something that should only apply below one particular width.

**Type scale.** `body{font:var(--fs)/var(--lh) var(--serif)}` is where
every paragraph's text size and leading actually come from (`.tx` has no
font-size of its own); `.mk`'s marker line-height is `var(--line))`, itself
`calc(var(--fs) * var(--lh))`. Because CSS custom properties resolve where
they're *used*, not where they're declared, `body.sidepanel{--fs:14px;
--lh:1.5}` (down from 16.5px/1.66) is enough on its own — nothing
downstream needs touching, the same mechanism §6/Phase1's `--mobilebar-h`
bump already relied on.

**Chapters/annexes become cards.** `<details class="chapter">` gets its own
border, radius and background instead of 56px of top padding separating it
from the last one; `<summary>` becomes the padded, hoverable header row;
the chapter number (`.cn`) becomes a small pill badge. Annexes keep their
existing distinct "ANNEX A" label style rather than also becoming a pill —
this needed an explicit `.chapter:not(.annex) .chapter-h .cn` rather than
trusting cascade order to sort it out, because a naive `body.sidepanel
.chapter-h .cn` is *more* specific than nppf.css's own `.annex .chapter-h
.cn` (equal class count, but the former also matches the `body` element,
and element count is the tiebreaker once id/class counts are tied) — it
would have silently overridden the annex label instead of losing to it.

**Policies (and standalone paragraphs) become cards.** Each `.policy`
becomes one card — title plus all its numbered content as a single box,
which matches how a policy already reads as one cohesive unit here. Outside
policy chapters (the introduction, Annex B's glossary, Annex D/F's
subhead-grouped paragraphs) there's no such larger unit to bundle into, so
each top-level paragraph gets its own card instead, matching nppfbrowser's
one-card-per-paragraph browsing view there. The selector
(`.chapter>.node,.secgrp>.node,.subgrp>.node`) uses a direct-child
combinator specifically so a lettered/roman-numeral sub-item nested several
`.kids` deep inside one of those doesn't *also* get boxed — only the
outermost unit per policy or section does, and everything inside one card
keeps flowing exactly as it did before. nppf.css's own "first policy in a
section" special case (`.secgrp>.policy:first-of-type{padding-top:6px}`,
a leftover from the old flowing top-border design) is more specific than
the new card rule and had to be restored to full padding explicitly, or
that one card alone would've been left visibly thinner-topped than every
other one.

**The `:target`/refusal accent bar had to be replaced, not just restyled.**
It was `position:absolute;left:-17px`, sitting in the page's own margin
outside the text column — a margin the old design had and cards don't. At
`.doc`'s 14px inline padding (set in Phase 1), that bar would land 3px past
the viewport edge, clipped. `box-shadow:inset` was used instead: it can
never extend outside its own element's border box no matter how little
padding is available, so the same replacement works uniformly for a full
policy card, a nested paragraph row with no border of its own, and a
footnote row. **A real bug turned up applying this to the refusal
highlight**, caught by checking `getComputedStyle(el).boxShadow` directly
rather than trusting a screenshot that looked plausible at a glance: the
rule was written `body.sidepanel body.show-refusal .policy[data-refusal]`
— two separate ancestor `<body>` compound selectors, which can never match
anything, since there's only one `<body>` element and it carries both
classes at once, not one nested inside the other. Fixed to the single
compound selector `body.show-refusal.sidepanel .policy[data-refusal]`.
Worth flagging as a class of mistake to watch for elsewhere in this file:
multiple state classes toggled on the same element read naturally as
`body.classA.classB` (compound), never `body.classA body.classB`
(descendant) — the latter silently matches nothing rather than erroring,
so it doesn't announce itself.

**Verified end-to-end**, all against the live build: chapter cards render
closed by default with the pill badge and hover state; a policy card's
lettered/roman-numeral sub-items flow inside it without being separately
boxed; Annex B's 129 glossary entries each render as their own card,
including one (`g-affordable-housing`) genuinely ~1600px tall from five
nested sub-definitions, correctly not mistaken for a rendering gap; the
Annex B A-Z jump bar's `position:sticky` still correctly pins at
`top:var(--mobilebar-h)` once scrolled to (no `overflow:hidden` was added
to the chapter card, specifically to avoid creating a new scroll-container
context that could have confined or broken that); the refusal highlight
shows the right inset colour, correctly, on an actually-tagged policy
(`TC3`) once the bug above was fixed; dark mode renders correctly
throughout with zero dedicated dark-mode rules of its own; search, jump,
bookmark and copy-citation all still work unchanged.

**A second bug, found from a screenshot the user sent after this phase
shipped:** zeroing out `details.chapter`'s own padding (so `.policy`/`.node`
cards could sit flush against the chapter's edge, as intended) also left
every *non*-card piece of chapter content -- `.section-h` group labels like
"PLAN-MAKING POLICIES", the `.objective` disclosure -- with no inset of
their own, since neither has a border/padding box of its own the way a
policy card does; their text ran flush against the chapter's own edge.
Fixed with `details.chapter[open]{padding-bottom:12px}` (guarded to `[open]`
specifically -- unconditionally on the closed state would reserve dead
space below a collapsed chapter's summary even though the rest of its
content is `display:none`, undoing the tight closed-accordion list this
phase was for) plus one general `details.chapter > :not(summary)
{padding-inline:14px}` rather than padding `.section-h`/`.objective`
individually, so nothing added later under a chapter goes missed the same
way. Re-verified after the fix: the group label and objective block both
sit properly inset now, the closed-list is exactly as tight as before this
fix, and search/jump/bookmark still work.

**A UI/UX audit pass** (against WCAG 2.2 target-size/spacing guidance and
this project's own already-established 24px minimum for `.bookmark-btn`)
checked, and cleared, several things that looked risky but measured fine:
the bookmark star and copy-citation button's actual gap is 14px, not the 2px
their own CSS suggested in isolation — `.policy-h`'s pre-existing `gap:12px`
flexbox property already covers it, my button's own `margin-left:2px` is
just redundant on top; every new/moved control still gets the page's global
`:focus-visible` outline (nothing here sets `outline:none` without a
replacement); the new pill badges reuse the same `--tint`/`--accent`
combination already used for table headers elsewhere in the page, not a new
untested pairing. **One real, fixed finding:** `.searchbox .clr` (the "×"
clear button) is nppf.css's own original element, sized to just the glyph
plus 2px padding (~13×15px) — fine tucked inside the old collapsed dropdown,
but Phase 1 moved it into the always-visible topbar, where it's now a
frequently-used control measuring well under the 24×24 CSS px WCAG 2.2 AA
minimum and sitting only 6px from the new `#count` badge (under the 8px
touch-spacing guideline). Sized up to 24×24px (matching `.bookmark-btn`/
`.pn-cite-btn`'s own existing minimum) and given 10px clearance to `#count`;
re-verified both measurements directly and confirmed no visual overlap with
the search input's own text. **One flagged but not changed:** the reduced
`--fs:14px` (§6b) is below the general "16px minimum body text" guideline —
noted, but not reverted, since it's a *narrow desktop panel*, not a phone
screen (the guideline's actual target), reading in a serif face already
chosen for legibility at smaller sizes, and it's the direct, deliberate
result of the "make the overall design more compact" request the size was
reduced for in the first place, not an incidental side effect to silently
correct.

**Three further §6b defects, reported directly from a screenshot after
shipping:** no gap between the document header's bottom rule and the first
chapter card; every card sitting flush against the sides of its containing
chapter, not just the "PLAN-MAKING POLICIES" labels already fixed earlier;
and the chapter box using the exact same `--card` background as the cards
inside it, so the two tiers read as one undifferentiated surface.

- **The docmeta gap** was a one-line miss: `.docmeta` had `padding-bottom`
  and a `border-bottom`, but no `margin-bottom` at all (nppf.css's original
  never needed one, since the old design's next element started its own
  56px `padding-top`) -- measured at 0px before the fix. Added
  `margin-bottom:16px`.
- **The card gutter bug was a real mechanism error, not a missed
  selector.** The earlier fix (this section, "everything else in a
  chapter... needs its own inset") used `details.chapter > :not(summary)
  {padding-inline:14px}` -- container-level *padding*. That works for
  `.objective`/`.section-h`, which have no padding of their own to compete
  with it. It silently does nothing for `.policy`/`.node`: those declare
  their *own* `padding:12px 14px` for their internal text inset, which is
  more specific and always wins the same physical left/right properties --
  so the container's padding-inline never reaches a card's actual border
  box at all, regardless of how deeply it's nested. Measured before the
  fix: a card's own left edge sat 1px from the chapter's edge (only the
  chapter's own 1px border), not the intended 14px. Padding on a container
  can only inset children with no competing padding of their own; it can
  never push a self-padded card's *outer* edge inward. Replaced entirely:
  `.secgrp`/`.subgrp` are now fully transparent grouping divs (no margin,
  no padding of their own), and *every* visual element inside a
  chapter -- card or not -- carries its own `margin-inline:14px`
  (`.policy`, `.chapter/.secgrp/.subgrp > .node`, `.objective`,
  `.section-h`, `.subhead`, `.fnlist`, `.tblwrap`). Margin doesn't compete
  with a card's own padding the way container padding did, and because
  `.secgrp`/`.subgrp` contribute nothing, the gutter stays a uniform 14px
  regardless of nesting depth rather than compounding. One incidental
  improvement from doing it this way: `.objective`'s original 20px *left*
  padding (from nppf.css, for its blockquote-style accent bar) is no
  longer in competition with anything and applies untouched again, instead
  of being flattened to 14px like everything else the way the removed
  padding-inline rule had done to it.
- **The background collision** was simply the wrong token in one place:
  `details.chapter{background:var(--card)}` used the *same* value as the
  card rule just below it. Changed to `background:var(--paper)` --
  reliably a shade darker than `--card` in both of nppf.css's themes, so
  chapters now recede toward the page's own tone (distinguished only by
  their border) while cards genuinely pop forward off them, the two-tier
  contrast this section's own comment already claimed but hadn't actually
  delivered at the chapter tier.

Checked but left alone: Annex B's `.azbar` (the A-Z jump bar) is also a
direct, non-card child of `.chapter` and was flush against the chapter's
edges the same way cards were -- but visually this reads as a deliberate
full-width toolbar (its own top/bottom border rules spanning edge-to-edge),
not a bug, and it sits well clear of the chapter's rounded top corner
(below the summary and a divider), so it wasn't added to the margin-inline
list.

Re-verified end-to-end: the three measurements directly confirmed fixed
(16px docmeta gap, 14/15px card gutter on both sides, distinct chapter vs.
card background colours); menu open/close, search, jump-to-policy,
bookmarking and copy-citation all still work; both themes checked visually.

## 6c. Toolbar icon

Phase 0's placeholder (a plain letter "N" on a flat rounded square,
Pillow-generated in a couple of minutes to get an unpacked build loading at
all) replaced with a small open-book glyph: two angled panels in `--paper`
on a `--accent`-green rounded square, picked over a refined monogram or a
planning/land-use motif because it reads as "reference text" independent of
whichever Framework the panel happens to hold, and holds up at 16px, the
size actually shown in the toolbar.

No AI image generation was available for this (`GEMINI_API_KEY`/
`MUAPI_API_KEY` unset), so it's hand-drawn as plain SVG path data (straight
edges throughout, not the smoother curved pages an early draft used — a
curved version blurred into an unreadable blob at 16px, where anti-aliasing
eats subtle curvature; the wider, straight-edged spine gap survives
downscaling because it stays a hard edge rather than a soft one).
`icons/icon.svg` is the vector source; `icons/gen_icons.py` renders it to
the four PNG sizes the manifest needs by sampling the *same* path data by
hand (no SVG rasterizer -- cairosvg/svglib -- was available either) at 8x
supersampling before a LANCZOS downscale, rather than drawing directly at
each tiny target size. Neither file ships inside the built extension --
`build.py` now copies only `icons/*.png` into `dist/icons`, not the SVG
source or the generator script alongside it (an oversight in the original
`shutil.copytree`, caught immediately once there was a non-PNG file in the
folder to notice it with).

## 6d. Filters-menu layout

Requested as a review of "the menu" -- the `☰`-triggered dropdown that,
since Phase 4 removed its nav tree, holds only the mode filter, the two
checkboxes, `.totop`, and the brand footer.

**The overlay had a hole in it.** `.panel` (nppf.css's own element) has
always sized itself to its own content, with `max-height` only ever
*capping* that at the viewport when content ran long -- reasonable when
its tallest child was a 131-policy nav tree that routinely exceeded the
viewport on its own. Phase 4 removed that child. Measured afterward: 325px
of actual content (mode filter, two checkboxes, `.totop`, brand footer) in
an 800px-tall window. Nothing in `.panel` ever gave it a *minimum* height,
so the remaining ~470px simply fell through to whatever the real document
looked like at the current scroll position, rendered directly below the
filters with no boundary, no backdrop, nothing to say "the menu ends here
and the page begins." Fixed with a `min-height` mirroring `.panel`'s own
existing `max-height` fallback pair (`vh` first, `dvh` after, for the same
reason that pair already exists just above it -- a `dvh`-unaware browser
still gets a usable value). This alone turns it back into a proper overlay
regardless of how little it actually contains.

**Priority order was inherited from a menu that no longer exists.**
`.totop` ("↑ Back to top") rendered first and most prominent -- a solid
tinted button, ahead of every filter. That was the right call when this
menu's main job was escaping a long nav tree; it's the wrong one now that
the filters are essentially the entire menu. Reordered with
`display:flex;flex-direction:column` on `.panel` plus `order` on its
children, rather than moving anything in the DOM: nppf.js's bindings are
all id-based, not position-based, so nothing there needed touching, and
`align-items:stretch` -- the flex default -- keeps every child the same
full-width block-like size it already had. Filters now render first
(`order:1-3`), `.totop` drops to `order:8` and is restyled from a solid
button down to a plain top-bordered text row (still full-width, still an
easy target -- just visually quieter, matching its now-secondary role), and
the brand footer stays last at `order:9`.

**A "FILTERS" caption** was added above the group -- reusing `.section-h`'s
all-caps label *language* (same letter-spacing, same weight, same
`--ink3`) rather than the class itself, since `.section-h` also carries
mode/bookmark visibility-filter logic that has nothing to do with a label
sitting inside this menu. Inserted by `panel.js`, the same "runtime DOM
addition, never a change to what render.py generates" pattern as the
topbar and the citation buttons -- not a new exception to it.

**One dead end while verifying `.totop` afterward, worth recording so it
isn't re-investigated as a regression later:** clicking it appeared to do
nothing -- `window.scrollY` never moved -- under a plain `await new
Promise(r => setTimeout(r, N))` wait, for any `N` tried, including 1200ms.
Reproduced *identically* against the live, unmodified, published newnppf
site (`j0hn4r.github.io/NPPF_2026`) using the exact same test, which rules
out every change in this repository as the cause. The actual mechanism:
`totopBtn`'s handler (nppf.js, untouched) ends with a bare `window.
scrollTo(0, 0)`, which inherits the page's `html{scroll-behavior:smooth}`
-- an animation that needs real rendering/compositor ticks to advance, and
those don't happen for a backgrounded/non-rendering automation tab sitting
inside a `setTimeout`. Confirmed by forcing real ticks instead (a
`computer` `wait` action and screenshots, which keep the pane actively
painting the way it would be for a real user watching their own screen):
the scroll then completed normally. Nothing here needed fixing, and
nothing should be "fixed" in `nppf.js` for it -- nothing is broken.

Verified end-to-end after the layout changes: search, jump-to-policy, the
mode filter, bookmarking, copy-citation and the `.pn-filters-label`'s
one-and-only insertion all still work; the full-height backdrop and the
reordered/restyled menu both render correctly in light and dark.

**A real bug shipped in the first version of this fix, caught immediately
from the user reporting "now the menu is just there all the time":** the
`min-height`/`display:flex` rule above was originally written as `body.
sidepanel .panel{...}`, with no `.nav-open` in the selector at all.
nppf.css's own toggle is `body.nav-open .panel{display:block}` (2 classes +
1 element); the ungated version had *equal* specificity (also 2 classes +
1 element) and loaded later in the cascade, so it silently won regardless
of whether `.nav-open` was present -- forcing the panel permanently
visible, closed state included. The fix folds `display` into a single
selector gated on **both** classes at once, `body.sidepanel.nav-open
.panel{...}` (one compound selector on one `<body>`, not the "two ancestor
`body`s" mistake from earlier in this file's history, though the failure
mode -- a rule that silently doesn't do what it looks like it does -- is
the same shape): now more specific than nppf.css's toggle only when
`.nav-open` actually applies, and simply inert otherwise, leaving the base
`.panel{display:none}` uncontested. Re-verified: hidden by default, opens
correctly on toggle to the full-height flex layout, closes correctly back
to `display:none`, in both themes.

## 7. Extension behaviour

### `background.js` (service worker)

```js
// toolbar icon opens the panel
chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });

// right-click a selection anywhere -> look it up
chrome.contextMenus.create({
  id: 'nppf-lookup',
  title: 'Look up "%s" in the NPPF',
  contexts: ['selection'],
});
```

On click, or on the keyboard command, it normalises the request and hands it
to the panel:

- trim, collapse whitespace, cap at ~120 chars (a selection of three
  paragraphs is not a search term);
- write `{ q, at, ts }` to `chrome.storage.session`;
- `chrome.sidePanel.open({ windowId })` — a context-menu click *is* a user
  gesture, which that API requires.

**The handoff must go through storage, not `sendMessage`.** A cold panel does
not exist yet when `open()` is called, so a message would be sent into the
void. `storage.session` plus a `chrome.storage.onChanged` listener in the
panel covers both cases: a cold panel reads the pending request on load, a
warm panel reacts to the change.

### Deciding search vs jump

If the selection looks like a policy code —
`/^(PM|DM|S|CC|HO|E|TC|CO|W|M|L|GB|DP|TR|HC|P|F|N|HE)\s?\d{1,2}$/i` — jump
straight to it instead of searching. **The validation happens in `panel.js`,
not the worker**, because only the panel has the DOM to confirm the code
actually exists (`[data-policy]`). Otherwise selecting the string "P6" on an
unrelated page would jump to a phantom anchor.

### Keyboard shortcut

```json
"commands": { "open-nppf": {
  "suggested_key": { "default": "Alt+Shift+N" },
  "description": "Open the NPPF panel and focus search" } }
```

Not `Ctrl+Shift+N` — Chrome reserves that for a new Incognito window and will
refuse to bind it. Note also that this **opens and focuses**; it does not
toggle, because `sidePanel.open()` has no reliable counterpart to close the
panel across the Chrome versions worth supporting.

### Copy citation

`panel.js` injects one button beside each existing `.bookmark-btn` on a
`.policy` heading, wired with a single delegated click handler. It copies,
via `navigator.clipboard.writeText` (the panel is focused when you click it,
so no `clipboardWrite` permission is needed):

```
"<full policy text>"

National Planning Policy Framework (MHCLG, August 2026), policy S5.
```

Citing the official Framework, not the unofficial reading edition — that is
what goes into a planning statement. An options toggle can later drop the
quoted text and copy the reference alone.

### Restore your place

The side panel document is **destroyed when the panel closes**, so without
this you lose your position every time. `panel.js` saves the current hash and
scroll offset (debounced) to `chrome.storage.local` and restores on load.

## 8. Manifest

```json
{
  "manifest_version": 3,
  "name": "NPPF 2026 Reader (unofficial)",
  "version": "1.0.0",
  "minimum_chrome_version": "116",
  "permissions": ["sidePanel", "contextMenus", "storage"],
  "background": { "service_worker": "background.js" },
  "side_panel": { "default_path": "panel.html" },
  "action": { "default_title": "NPPF 2026" },
  "icons": { "16": "…", "32": "…", "48": "…", "128": "…" }
}
```

Three permissions, **no host permissions, no content scripts, no remote
code** — about as clean a story as a Web Store reviewer can be given, and
each maps to one visible feature: `sidePanel` is the UI, `contextMenus` the
lookup entry point, `storage` the bookmarks and reading position.
`minimum_chrome_version: 116` is the floor for `sidePanel.open()`.

## 9. QA matrix

Run after Phase 0 and again after every phase:

- **Console clean on load** — a CSP violation is the one failure that breaks
  everything, so check for it first.
- **Panel widths 280 / 320 / 400 / 700 / 1100px**: the A–Z jump bar, annex
  tables, the mode/refusal/bookmark toggles, the chapter accordions.
- **Anchor clearance under the taller bar** — force an *instant*
  (non-smooth) hash jump, then measure with `getBoundingClientRect()`.
  CLAUDE.md's warning applies: measuring during a smooth scroll catches it
  mid-flight and reads as a false failure.
- Search auto-opens collapsed chapters; footnote popovers position sanely
  inside a narrow panel; bookmarks persist across a panel close and a
  browser restart.
- Dark mode via Chrome's theme; printing from the panel.
- Context menu with a selection containing quotes, newlines, an em-dash, and
  one 2,000 characters long.
- A selection of `S5` jumps; a selection of `Z9` searches rather than
  jumping.

## 10. Phasing

| Phase | Deliverable | Retires the risk of… |
|---|---|---|
| **0** | Scaffold, manifest, `build.py` doing nothing but the script split. Loads unpacked and renders. | **CSP** — the only hard blocker |
| **1** | `panel.css` + `panel.js` chrome: search in the bar, brand hidden, attribution relocated, spacing | narrow-width layout surprises |
| **2** | `background.js`: action click, context menu, command, storage handoff | the cold-panel race |
| **3** | Copy citation, restore reading position | — |
| **4** | Chapter-accordion navigation: chapters closed by default, nav-tree dropdown dropped, `#count` moved to the topbar | a redundant, hidden second navigation surface |
| **5** | Compact, card-based visual design: tighter type, chapters/policies/paragraphs as bordered cards, the clipped margin accent bar replaced with an inset one | a design that only worked at the old, wider gutter |
| **6** | Filters-menu layout: full-height backdrop, filters reordered ahead of "Back to top", grouping caption | a menu that reads as broken once its one-time tallest content (the nav tree) is gone |
| **7** | Annex B glossary: inline letter headings, A-Z bar repointed at them instead of an arbitrary term | a jump aid implying false precision about which term you wanted |
| **8** | Policy-code range on each chapter title ("... (S1-6)") | opening every chapter just to see what it covers |
| **9** | Cross-reference links between policies (including specific sub-parts) plus a Back control | having to close and manually find every policy a cross-reference names |
| **10** | Menu/nav cleanup: Contents box, search-field affordance, Back-button spacing, native double clear-button fix | losing track of where you are in a long chapter, and a menu that half-worked |
| **11** | Contents box: fixed a scroll-blocking dead zone over the list, and picking a chapter now closes every other one | a "quick jump" list that fought you and left stray chapters open |
| **12** | Menu layout pass: Filters above Contents, a proper section divider between them, filter-control margins aligned to 20px | two sections told apart only by a gap, and a silent 4px alignment mismatch |
| **13** | Defined-term links from the main document to their own Annex B glossary entry, scoped to multi-word terms and first-occurrence-per-policy | having to leave a policy to go look up a term it just used |
| **14** | Searching a policy's own code jumps straight to that policy, on top of the existing highlight-everywhere search | the actual policy getting lost among every other mention of its own code |
| **15** | `sync.py` + `upstream.lock`, README, CLAUDE.md, icons, store-readiness pass | drifting silently from upstream |

## 11. Deliberately not in v1

- **Scanning the page for cited policies** (the "full companion" option) —
  needs a content script, host permissions and per-site opt-in, and the
  false-positive problem is real: `E4`, `P6`, `M1` are not distinctive
  strings. Revisit as v2, gated to pages that mention "NPPF" nearby.
- **Bookmark sync across devices.** Bookmarks read `localStorage`
  *synchronously* at module load; `chrome.storage.sync` is async, so this
  means either restructuring that code path or a write-through mirror with a
  merge on load. Extension-origin `localStorage` is durable enough that this
  can wait.
- An options page. Nothing yet needs configuring.

## 12. Known issues (not yet fixed)

- **Clearing a policy-code search strands the reader's scroll position.**
  Reported directly: searching a policy code (Phase 14) correctly scrolls
  to that policy, but nppf.js's own search then hides every other policy
  that doesn't contain the query text — reasonable for search generally,
  but it means the reader can't scroll around or check neighbouring
  policies while still "at" the one they searched for, without clearing
  the search first. Clearing it (the `×` button) does bring every policy
  back, but nppf.js's own `clr` handler doesn't preserve scroll position
  across that reveal — the reappearing content shifts the layout under the
  reader, moving them away from the policy they were just looking at. The
  fix likely needs the same shape as Phase 15's chapter-reopen fix and the
  bookmark-filter scroll fixes in Phase 13/14 (PLAN.md's own recurring
  pattern: a remembered position is only meaningful once the layout it was
  recorded against exists again) — e.g. remembering the searched-for
  policy's id across a clear and re-scrolling to it afterward, likely by
  hooking `#clr`'s click alongside nppf.js's own handler rather than
  editing nppf.js itself.
