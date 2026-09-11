// PanelNPPF — panel chrome, layered over the page's own nppf.js.
//
// This only ever moves existing nodes around the DOM and adds new ones of
// its own (the .pn-topbar wrapper) -- it never edits vendor/nppf-index.html
// or touches nppf.js's behaviour. Every element it moves keeps whatever
// listeners nppf.js bound to it by id/class, because those bindings don't
// care where in the tree the element lives.
//
// Phase 1: relocate the search box into an always-visible top bar, and move
// the brand/attribution block out of the way.
// Phase 2: consume the background.js -> storage.session handoff (context
// menu / keyboard command), deciding whether a lookup is a policy-code jump
// or a text search.
// Phase 3: a "copy citation" button beside each bookmark star, and
// restoring the reading position across the panel closing/reopening.
// Phase 4: chapter-accordion navigation, integrating the model from an
// earlier NPPF Browser extension (nppfbrowser) -- no separate nav-tree
// "contents" dropdown at all; each chapter is its own accordion (closed by
// default, thanks to tools/build.py stripping the `open` attribute) and
// *is* the navigation. #count moves in next to search, since it's the one
// piece of the old dropdown's content still worth seeing without opening
// anything.
// Phase 6: the filters menu left behind by hiding #nav in Phase 4 --
// reordered so the filters (what you almost always opened it for) come
// before "Back to top" (what you occasionally want once you're deep in a
// chapter), given a "FILTERS" caption, and given a min-height so it reads
// as a real overlay instead of a short strip with the document showing
// through underneath it.
// Phase 7: Annex B's glossary -- inline letter headings between each
// letter's entries, and the A-Z bar repointed at those instead of an
// arbitrary first term, so jumping there no longer implies a specific
// term was selected.
// Phase 8: a policy-code range appended to each policy-carrying chapter's
// title ("... (S1-6)"), visible on the closed accordion row.
// Phase 9: policy text is full of cross-references to *other* policies
// ("in accordance with policy S1", "policies S4 and S5", "policy
// PM6(1)(c)") -- turned into real links to the referenced policy or
// sub-part, plus a Back control (native `history.back()`, since the panel
// itself has no browser chrome of its own to supply one) to return to
// wherever following one was clicked from.
// Phase 10: a compact Contents list (chapters + annexes, not the full
// 131-policy tree Phase 4 deliberately dropped) back in the filters menu,
// so getting lost in a long chapter has a quick way out -- and marking
// whichever chapter(s) are currently open when the menu opens, since
// that's a real answer to "where am I", not just "where can I go".
// Phase 13: the main document's own defined terms ("previously developed
// land", "grey belt") linked to their Annex B glossary entries, the same
// technique as Phase 9's cross-reference links but scoped much more
// conservatively -- see the comment at the top of that code for why.
// See PLAN.md sections 6-7 and the chapter-accordion section.

(function () {
  if (!document.body.classList.contains('sidepanel')) return;

  const mobilehead = document.querySelector('.mobilehead');
  const navtoggle = document.getElementById('navtoggle');
  const searchbox = document.querySelector('.searchbox');
  const countEl = document.getElementById('count');
  const panelMenu = document.getElementById('panel');
  const brand = document.querySelector('.brand');
  const searchInput = document.getElementById('q');
  const navEl = document.getElementById('nav');

  if (!mobilehead || !navtoggle || !searchbox || !countEl || !panelMenu || !searchInput || !navEl) {
    console.warn('PanelNPPF: expected page structure not found -- skipping panel chrome. ' +
      'newnppf\'s markup may have changed; re-check tools/build.py and src/panel.js.');
    return;
  }

  // ---------- Phase 1: relocate search box + brand block ----------

  // Build [hamburger][search][count][clear] as one row, always visible
  // above the dropdown menu. All three moved children already have their
  // own listeners/behaviour bound by nppf.js (#navtoggle's click handler,
  // #q's input handler, #clr's click handler, #count's own
  // block/none toggling from run()) -- moving them doesn't touch any of
  // that.
  const topbar = document.createElement('div');
  topbar.className = 'pn-topbar';
  mobilehead.insertBefore(topbar, navtoggle);
  topbar.appendChild(navtoggle);
  topbar.appendChild(searchbox);
  topbar.appendChild(countEl);

  // Move the brand block (tagline, Crown-copyright disclaimer, link to the
  // official NPPF) to the foot of the dropdown menu, after the nav tree.
  // This text isn't decoration -- see PLAN.md section 6 -- so it has to
  // stay somewhere, just not eating ~200px at the very top of a narrow
  // panel. Restyled compactly by panel.css's .panel-brand rules.
  if (brand) {
    brand.classList.add('panel-brand');
    panelMenu.appendChild(brand);
  }

  // Phase 4: no separate "contents" dropdown -- each chapter is its own
  // accordion (closed by default, per tools/build.py) directly in the main
  // flow, so the nav tree is redundant for browsing, and Phase 2's
  // location.hash jump already worked without it (relies on the browser's
  // native fragment-auto-expand, not on nav). Hidden rather than removed:
  // its click handler in nppf.js (`navEl.addEventListener('click', ...)`)
  // and the bookmark-star mirroring in syncBookmarkUI() both still run
  // harmlessly against a hidden, unreachable element -- no JS there needs
  // touching for this to be inert.
  navEl.classList.add('pn-hidden-nav');

  // NOTE: if the panel is ever dragged wider than 1000px, nppf.css's own
  // desktop layout takes over (.mobilehead/.panel both become
  // display:contents) and these moved nodes render in their new DOM
  // positions rather than the original sidebar order -- search box, count
  // and menu button first, brand block at the very end, hidden nav tree
  // last of all (and still hidden -- .pn-hidden-nav isn't scoped to the
  // narrow breakpoint). Cosmetic only (nothing breaks), and side panels
  // don't get anywhere near 1000px in practice, so this is left as a known
  // v1 tradeoff rather than adding a resize listener to re-parent nodes
  // back and forth.

  // ---------- menu layout: group + reprioritise the filters ----------

  // A small "FILTERS" caption above the mode/refusal/bookmark controls, so
  // that group reads as one thing at a glance -- panel.css's `order`
  // handles the actual visual reordering (filters first, .totop and the
  // brand footer pushed down), this just adds the one label those rules
  // reference that didn't already exist anywhere in the markup. Inserted
  // right before .modebar in the DOM (not just visually, via `order`) so
  // it still reads in a sensible position for anyone not looking at the
  // CSS-driven layout -- a screen reader in source order, e.g.
  const modebar = document.querySelector('.modebar');
  if (modebar && !document.querySelector('.pn-filters-label')) {
    const label = document.createElement('div');
    label.className = 'pn-filters-label';
    label.textContent = 'Filters';
    modebar.parentElement.insertBefore(label, modebar);
  }

  // ---------- Phase 2: context-menu / command handoff ----------

  // A policy code like "S5" or "GB6" jumps straight to it; anything else is
  // a search term. Validated against the DOM (not just the regex) so that
  // selecting a stray "P6" on an unrelated page doesn't jump to a phantom
  // anchor -- only background.js normalises the raw string, this file is
  // the only place with the DOM to confirm the code actually exists.
  const POLICY_CODE_RE = /^(PM|DM|S|CC|HO|E|TC|CO|W|M|L|GB|DP|TR|HC|P|F|N|HE)\d{1,2}$/i;

  // Phase 4 note: the search box and #count both live in the always-visible
  // topbar now (not the filters dropdown), so none of these need to open
  // anything to be seen -- unlike Phase 2's original version of this file.

  function focusSearchInput() {
    searchInput.focus();
  }

  function runSearch(q) {
    searchInput.value = q;
    searchInput.dispatchEvent(new Event('input', { bubbles: true }));
    searchInput.focus();
  }

  function jumpToPolicy(code) {
    // Close the filters dropdown if it happened to be open (a jump is a
    // destination, not something to keep filtering from) and land on the
    // target the way a bare #fragment URL would -- native <details>
    // auto-expand handles anything the id is nested inside, no extra JS
    // needed.
    document.body.classList.remove('nav-open');
    location.hash = '#' + code;
  }

  function handleLookup(q) {
    if (!q) {
      focusSearchInput();
      return;
    }
    const compact = q.replace(/\s+/g, '');
    const m = compact.match(POLICY_CODE_RE);
    if (m) {
      const code = compact.toUpperCase();
      if (document.querySelector('[data-policy="' + code + '"]')) {
        jumpToPolicy(code);
        return;
      }
    }
    runSearch(q);
  }

  function consumePendingLookup() {
    if (!(window.chrome && chrome.storage && chrome.storage.session)) return;
    chrome.storage.session.get('pendingLookup', (result) => {
      const pending = result && result.pendingLookup;
      if (!pending) return;
      chrome.storage.session.remove('pendingLookup');
      handleLookup(pending.q || '');
    });
  }

  // Cold panel: read whatever's already waiting the moment this page loads.
  consumePendingLookup();

  // Warm panel: background.js just wrote a new request while we were
  // already open.
  if (window.chrome && chrome.storage && chrome.storage.onChanged) {
    chrome.storage.onChanged.addListener((changes, areaName) => {
      if (areaName !== 'session' || !changes.pendingLookup) return;
      const pending = changes.pendingLookup.newValue;
      if (!pending) return;
      chrome.storage.session.remove('pendingLookup');
      handleLookup(pending.q || '');
    });
  }

  // ---------- Phase 3a: copy citation ----------

  function normalizeWS(s) {
    return s.replace(/\s+/g, ' ').trim();
  }

  // Reads the verbatim policy text straight out of the DOM rather than
  // maintaining a separate copy of it: the title from .policy-title .srch
  // (skipping the leading ".pid" code, which the reference line below
  // already states), then one line per para/item/subitem node found within
  // -- each node's own ":scope > .row" pairs its ".mk" marker ("1.", "a)")
  // with its ".tx" text, so nested sub-items (in a later, deeper ".node")
  // still come out one per line, in document order.
  //
  // Works on a detached clone, never the live DOM, because footnote
  // markers (sup.fnref) and the star/citation buttons have to be stripped
  // out first -- textContent on the real nodes would otherwise fuse a
  // footnote's number straight onto the end of the preceding word.
  function citationTextFor(policyEl) {
    const clone = policyEl.cloneNode(true);
    clone.querySelectorAll('sup.fnref, .bookmark-btn, .pn-cite-btn').forEach((el) => el.remove());

    const titleSrch = clone.querySelector(':scope > h3.policy-h .policy-title .srch');
    const title = titleSrch ? normalizeWS(titleSrch.textContent) : '';

    const lines = [];
    clone.querySelectorAll('.node').forEach((node) => {
      const row = node.querySelector(':scope > .row');
      const tx = row && row.querySelector(':scope > .tx');
      if (!tx) return;
      const mk = row.querySelector(':scope > .mk');
      const mkText = mk ? normalizeWS(mk.textContent) : '';
      const txText = normalizeWS(tx.textContent);
      lines.push(mkText ? mkText + ' ' + txText : txText);
    });

    return { title, body: lines.join('\n') };
  }

  function addCiteButtons() {
    document.querySelectorAll('.policy').forEach((policyEl) => {
      const h3 = policyEl.querySelector(':scope > h3.policy-h');
      if (!h3 || h3.querySelector('.pn-cite-btn')) return;
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'pn-cite-btn';
      btn.title = 'Copy citation';
      btn.setAttribute('aria-label', 'Copy citation for ' + policyEl.id);
      btn.textContent = '⧉'; // ⧉
      h3.appendChild(btn); // after the existing bookmark star, which is h3's only other child button
    });
  }
  addCiteButtons();

  document.addEventListener('click', (e) => {
    const btn = e.target.closest('.pn-cite-btn');
    if (!btn) return;
    const policyEl = btn.closest('.policy');
    if (!policyEl || !navigator.clipboard) return;

    const pid = policyEl.id;
    const { title, body } = citationTextFor(policyEl);
    const quoted = title && body ? title + '\n\n' + body : (title || body);
    // Citing the official Framework, not this unofficial reading edition --
    // that's what belongs in a planning statement. See PLAN.md section 7.
    const text = '"' + quoted + '"\n\n' +
      'National Planning Policy Framework (MHCLG, August 2026), policy ' + pid + '.';

    navigator.clipboard.writeText(text).then(() => {
      btn.classList.add('copied');
      const prevLabel = btn.getAttribute('aria-label');
      btn.setAttribute('aria-label', 'Citation copied');
      setTimeout(() => {
        btn.classList.remove('copied');
        btn.setAttribute('aria-label', prevLabel);
      }, 1200);
    }).catch((err) => {
      console.error('PanelNPPF: clipboard write failed', err);
    });
  });

  // ---------- Phase 3b: restore reading position ----------

  // The side panel's document is destroyed when the panel closes (unlike a
  // normal tab, which just goes to the background) -- without this, every
  // close loses your place. Falls back to localStorage if chrome.storage
  // isn't available (e.g. this preview build running outside an extension).
  const POSITION_KEY = 'pn-position';

  function getPositionStore() {
    if (window.chrome && chrome.storage && chrome.storage.local) {
      return {
        get: (cb) => chrome.storage.local.get(POSITION_KEY, (r) => cb(r && r[POSITION_KEY])),
        set: (value) => chrome.storage.local.set({ [POSITION_KEY]: value }),
      };
    }
    return {
      get: (cb) => {
        try { cb(JSON.parse(localStorage.getItem(POSITION_KEY))); } catch (e) { cb(null); }
      },
      set: (value) => {
        try { localStorage.setItem(POSITION_KEY, JSON.stringify(value)); } catch (e) { /* ignore */ }
      },
    };
  }
  const positionStore = getPositionStore();

  function savePosition() {
    positionStore.set({ hash: location.hash, scrollY: window.scrollY, ts: Date.now() });
  }

  let saveTimer = null;
  function schedulePositionSave() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(savePosition, 400);
  }
  window.addEventListener('scroll', schedulePositionSave, { passive: true });
  window.addEventListener('hashchange', schedulePositionSave);
  window.addEventListener('beforeunload', savePosition);

  // Restoring only makes sense when nothing else already claimed the
  // opening view -- a pending context-menu lookup (Phase 2) or an explicit
  // #fragment the panel was opened with both take priority over resuming
  // wherever you last scrolled to.
  if (!location.hash) {
    positionStore.get((pos) => {
      if (!pos) return;
      if (window.chrome && chrome.storage && chrome.storage.session) {
        chrome.storage.session.get('pendingLookup', (result) => {
          if (result && result.pendingLookup) return; // Phase 2 already owns this load
          if (pos.hash) location.hash = pos.hash;
          else window.scrollTo(0, pos.scrollY || 0);
        });
      } else {
        if (pos.hash) location.hash = pos.hash;
        else window.scrollTo(0, pos.scrollY || 0);
      }
    });
  }

  // ---------- Annex B glossary: letter dividers + A-Z bar repoint ----------

  // The A-Z bar's own links (render.py's own markup, one per letter that
  // actually has a term) jump to the *first* glossary entry starting with
  // that letter -- picked arbitrarily by whichever term happens to sort
  // first, not anything the reader actually asked for. Landing there with
  // the same :target highlight used everywhere else for something
  // genuinely selected (a search result, a footnote, a direct citation
  // link) implies a precision that isn't real here, and the reader is
  // often scanning past several entries under one letter anyway. Two
  // changes fix this at the source rather than only hiding the symptom:
  // insert a plain, unhighlightable letter heading before each new
  // letter's first entry, and repoint the bar at *that* instead of a
  // specific term. panel.css's `#annexB .gloss:target` rule (unreachable
  // once nothing links to a gloss id from here on, but see its own
  // comment) is the belt to this belt-and-braces pair, for any other way
  // a specific term's id might still be linked to directly.
  const annexB = document.getElementById('annexB');
  const azbar = annexB ? annexB.querySelector(':scope > .azbar') : null;
  const glossEntries = annexB
    ? Array.from(annexB.querySelectorAll(':scope > .node.gloss'))
    : [];

  if (azbar && glossEntries.length) {
    let lastLetter = null;
    glossEntries.forEach((entry) => {
      const term = entry.dataset.term || '';
      const letter = term.charAt(0).toUpperCase();
      if (!letter || letter === lastLetter) return;
      lastLetter = letter;
      const heading = document.createElement('h3');
      heading.className = 'pn-gloss-letter';
      heading.id = 'pn-gloss-' + letter;
      heading.textContent = letter;
      entry.parentElement.insertBefore(heading, entry);
    });

    // The bar's own <a> text IS the letter ("A", "B", ...), so the
    // matching heading id can be derived directly -- no lookup table, and
    // nothing to keep in sync if newnppf's own term list ever changes,
    // since these headings are generated from that same list moments
    // earlier in this function.
    azbar.querySelectorAll('a').forEach((a) => {
      const letter = a.textContent.trim().toUpperCase();
      if (document.getElementById('pn-gloss-' + letter)) {
        a.setAttribute('href', '#pn-gloss-' + letter);
      }
    });
  }

  // ---------- policy-code range on each policy-carrying chapter's title ----------

  // Every numbered chapter that carries policies at all carries exactly
  // one prefix, numbered with no gaps (PM1-17, S1-6, GB1-8, ...) --
  // checked directly against the source rather than assumed. Read
  // straight off each chapter's own [data-policy] attributes rather than
  // hand-maintaining a chapter->range table that would silently drift the
  // next time the source PDF changes.
  document.querySelectorAll('details.chapter:not(.annex)').forEach((chapter) => {
    const policies = chapter.querySelectorAll('.policy[data-policy]');
    if (!policies.length) return; // the introduction, and any chapter with none

    const ranges = new Map(); // prefix -> {min, max}
    policies.forEach((p) => {
      const m = p.dataset.policy.match(/^([A-Z]+)(\d+)$/);
      if (!m) return;
      const num = parseInt(m[2], 10);
      const r = ranges.get(m[1]);
      if (r) { r.min = Math.min(r.min, num); r.max = Math.max(r.max, num); }
      else ranges.set(m[1], { min: num, max: num });
    });
    if (!ranges.size) return;

    const rangeText = Array.from(ranges, ([prefix, { min, max }]) =>
      min === max ? `${prefix}${min}` : `${prefix}${min}-${max}`
    ).join(', ');

    // Sibling of .srch, not appended inside it: nppf.js snapshots each
    // .srch element's innerHTML once at load (`el.dataset.orig =
    // el.innerHTML`) to restore on a cleared search, and its highlight()
    // walks each .srch element's own text nodes when searching. Living
    // outside .srch keeps this suffix out of both -- it can't be
    // captured into a stale snapshot, and a search match inside it would
    // never have anything to restore correctly afterward.
    const titleSpan = chapter.querySelector('summary .chapter-h .srch');
    if (!titleSpan) return;
    const suffix = document.createElement('span');
    suffix.className = 'pn-policy-range';
    suffix.textContent = ` (${rangeText})`;
    titleSpan.after(suffix);
  });

  // ---------- cross-reference links + a Back control ----------

  // Every prefix this document actually uses (render.py's own
  // REFUSAL_POLICIES/POL_MODE cover the same set). Longer prefixes sorted
  // first in the alternation purely defensively -- none of these actually
  // share a leading letter today (no bare "H" or "T" prefix exists
  // alongside "HO"/"HC"/"HE" or "TC"/"TR"), but trying two-letter options
  // before any single-letter one costs nothing and avoids relying on that
  // staying true.
  const POLICY_PREFIXES = ['PM','DM','CC','HO','TC','CO','GB','DP','TR','HC','HE','S','E','W','M','L','P','F','N']
    .sort((a, b) => b.length - a.length);
  const PREFIX_ALT = POLICY_PREFIXES.join('|');

  // A "policy"/"policies" reference span: the word itself, then one or
  // more codes chained by and / or / and\/or / to / , connectors, each
  // optionally followed by parenthetical sub-parts -- "PM6(1)(c)" cites
  // the same thing as id="PM6-1-c" (verified against the source: every
  // "PREFIX\d+(\(x\))+" in the running text has a matching id built
  // exactly that way). Deliberately conservative: requires "policy"/
  // "policies" immediately before the first code, which is how every
  // *confirmed* cross-reference in this document actually reads --
  // rather than matching any bare code-shaped token anywhere, which risks
  // linking something that only looks like one (this document's own
  // prefixes happen to collide with real-world things like motorway
  // numbers -- "the M1" is not a reference to policy M1). The cost of
  // that caution: a handful of references phrased as a long description
  // followed by a parenthetical code much later ("the policies … for
  // Local Green Space (HC8)") aren't caught. Left as a known gap rather
  // than loosened, since a wrong link is worse than a missed one.
  // NB: the code+subparts piece ends in `(?![0-9a-zA-Z])`, not `\b`. `\b`
  // needs a word/non-word *transition*; a match ending on a closing paren
  // ("PM6(1)(c)") has non-word `)` followed by non-word space or another
  // paren, so `\b` is never satisfied there -- the engine backtracks all
  // the way past every parenthetical sub-part before it can find a `\b`
  // at all, silently losing them (found by testing this exact regex
  // against real "PM6(1)(c)" text, not by inspection: it matched only
  // "PM6"). A lookahead against the next character serves the same
  // purpose (stopping "S1" from swallowing part of "S12" or "S1a") without
  // caring what character came just before it.
  const REF_SPAN_RE = new RegExp(
    '\\bpolic(?:y|ies)\\b((?:\\s*(?:and\\/or|and|or|to|,)?\\s*(?:' +
      PREFIX_ALT + ')\\d{1,2}(?:\\([0-9a-z]+\\)){0,3}(?![0-9a-zA-Z]))+)',
    'gi'
  );
  const ONE_CODE_RE = new RegExp('(' + PREFIX_ALT + ')(\\d{1,2})((?:\\([0-9a-z]+\\)){0,3})', 'g');

  function codeToId(prefix, num, subparts) {
    return prefix + num + subparts.replace(/\(([0-9a-z]+)\)/gi, '-$1');
  }

  // Same technique nppf.js's own highlight() already uses for <mark>:
  // walk each .srch element's text nodes (never innerHTML-replace a whole
  // element, which would also clobber unrelated markup already inside it
  // -- footnote markers, <strong>, existing external links) and splice in
  // a mixed fragment of plain text and new <a>s only where something
  // actually matched.
  const touchedSrch = new Set();
  document.querySelectorAll('.doc .srch').forEach((el) => {
    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    const textNodes = [];
    let tn;
    while ((tn = walker.nextNode())) textNodes.push(tn);

    textNodes.forEach((node) => {
      const t = node.nodeValue;
      REF_SPAN_RE.lastIndex = 0;
      if (!REF_SPAN_RE.test(t)) return;
      REF_SPAN_RE.lastIndex = 0;

      const frag = document.createDocumentFragment();
      let last = 0, spanMatch, linkedAny = false;
      while ((spanMatch = REF_SPAN_RE.exec(t))) {
        const tail = spanMatch[1]; // the codes-and-connectors portion
        const tailStart = spanMatch.index + spanMatch[0].length - tail.length;
        frag.appendChild(document.createTextNode(t.slice(last, tailStart)));

        let tailLast = 0, codeMatch;
        ONE_CODE_RE.lastIndex = 0;
        while ((codeMatch = ONE_CODE_RE.exec(tail))) {
          frag.appendChild(document.createTextNode(tail.slice(tailLast, codeMatch.index)));
          const id = codeToId(codeMatch[1], codeMatch[2], codeMatch[3]);
          const target = document.getElementById(id);
          if (target) {
            const a = document.createElement('a');
            a.className = 'pn-xref';
            a.href = '#' + id;
            a.textContent = codeMatch[0];
            frag.appendChild(a);
            linkedAny = true;
          } else {
            // No element with that id exists -- leave the text exactly as
            // it was rather than link to nothing. Not expected given the
            // source's own numbering, but never silently drop text either
            // way if it does happen.
            frag.appendChild(document.createTextNode(codeMatch[0]));
          }
          tailLast = codeMatch.index + codeMatch[0].length;
        }
        frag.appendChild(document.createTextNode(tail.slice(tailLast)));
        last = spanMatch.index + spanMatch[0].length;
      }
      frag.appendChild(document.createTextNode(t.slice(last)));

      if (linkedAny) {
        node.parentNode.replaceChild(frag, node);
        touchedSrch.add(el);
      }
    });
  });

  // A real gap in the pattern above, reported directly against S4: some
  // references are phrased as a description with the code arriving
  // afterwards, alone in parentheses -- S4's own text reads "...existing
  // recreational land and facilities (HC7), Local Green Space (HC8),
  // areas of particular importance for biodiversity and geodiversity (N6),
  // Protected Landscapes (N4) and development within residential
  // curtilages (L2(1)(d))" -- none of which has "policy"/"policies"
  // immediately before the code, so REF_SPAN_RE above correctly leaves
  // every one of them as plain text. A second, narrower pass catches this
  // shape instead: a parenthetical containing *only* a code (plus its own
  // nested sub-part parens, same balancing as above). This alone is looser
  // than requiring the word "policy" first, but checked against the whole
  // document before shipping, not assumed safe: exactly 5 matches exist
  // anywhere, all 5 inside S4, and all 5 resolve to a real, correct policy
  // id (HC7, HC8, N6, N4, L2-1-d) -- no false hit from a use-class label or
  // anything else shaped like a code. The same existing-id check below is
  // still what actually makes this safe in general, not the low count: a
  // wrongly-shaped match anywhere else in the document would simply fail
  // that check and fall back to plain text, same as the first pass.
  const BARE_CODE_RE = new RegExp(
    '\\((' + PREFIX_ALT + ')(\\d{1,2})((?:\\([0-9a-z]+\\)){0,3})\\)', 'g'
  );
  document.querySelectorAll('.doc .srch').forEach((el) => {
    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    const textNodes = [];
    let tn;
    while ((tn = walker.nextNode())) textNodes.push(tn);

    textNodes.forEach((node) => {
      // Skip text nppf.js's own footnote markup or the pass above already
      // linked -- this only needs to catch what's still plain text.
      if (node.parentElement.closest('a')) return;
      const t = node.nodeValue;
      BARE_CODE_RE.lastIndex = 0;
      if (!BARE_CODE_RE.test(t)) return;
      BARE_CODE_RE.lastIndex = 0;

      const frag = document.createDocumentFragment();
      let last = 0, m, linkedAny = false;
      while ((m = BARE_CODE_RE.exec(t))) {
        frag.appendChild(document.createTextNode(t.slice(last, m.index)));
        const codeText = m[1] + m[2] + m[3];
        const id = codeToId(m[1], m[2], m[3]);
        const target = document.getElementById(id);
        // Only the code itself is underlined, not its surrounding
        // parentheses -- matching how the "policy CODE" pass above only
        // ever links the code, never any punctuation around it.
        frag.appendChild(document.createTextNode('('));
        if (target) {
          const a = document.createElement('a');
          a.className = 'pn-xref';
          a.href = '#' + id;
          a.textContent = codeText;
          frag.appendChild(a);
          linkedAny = true;
        } else {
          frag.appendChild(document.createTextNode(codeText));
        }
        frag.appendChild(document.createTextNode(')'));
        last = m.index + m[0].length;
      }
      frag.appendChild(document.createTextNode(t.slice(last)));

      if (linkedAny) {
        node.parentNode.replaceChild(frag, node);
        touchedSrch.add(el);
      }
    });
  });

  // nppf.js snapshots every .srch element's *original* innerHTML once at
  // load (`el.dataset.orig = el.innerHTML`, run before this script even
  // starts) to restore verbatim after a cleared search. Left alone, that
  // snapshot is the pre-link text -- the first search-then-clear a reader
  // does would silently wipe every cross-reference link back out. Only
  // elements either pass above actually changed need re-snapshotting;
  // nppf.js's own restore reads dataset.orig fresh each time, not a cached
  // copy, so this is enough to make the links durable across searches too.
  touchedSrch.forEach((el) => { el.dataset.orig = el.innerHTML; });

  // A Back control: the panel has no browser chrome of its own offering
  // one, but a hash-only jump (a cross-reference above, a search result,
  // any #fragment navigation) is a normal history entry in this document's
  // own `history` object regardless, so a plain history.back() already
  // does the right thing with zero state of our own to track. Hidden until
  // the first hashchange, rather than shown unconditionally from load --
  // there's nothing to go back to on a fresh open, and `history.back()`
  // at the very start of this document's history is a harmless no-op, but
  // showing a control that does nothing yet is just clutter.
  const backBtn = document.createElement('button');
  backBtn.type = 'button';
  backBtn.className = 'pn-back-btn';
  backBtn.setAttribute('aria-label', 'Go back');
  backBtn.title = 'Go back';
  backBtn.textContent = '←';
  backBtn.hidden = true;
  topbar.insertBefore(backBtn, searchbox);
  backBtn.addEventListener('click', () => history.back());
  window.addEventListener('hashchange', () => { backBtn.hidden = false; });

  // A cross-reference or glossary link (and, below, a search-box jump to a
  // policy code) can point at a policy/section that's currently hidden by
  // the "bookmarks only" filter (nppf.js's own
  // `.bhide{display:none!important}`, toggled by #bookmarkToggle) --
  // reported directly: following such a link while that filter is on
  // silently does nothing, since there's no visible element to jump to.
  // Rather than leaving the reader to notice the filter is on and turn it
  // off themselves, landing on a currently-hidden target turns the filter
  // off first. Shared by both call sites below, run synchronously before
  // whatever triggers the actual jump -- a clicked link's own navigation is
  // its *default action*, which only runs once every listener on that
  // click has already finished, so this is guaranteed to land in time.
  const bookmarkToggle = document.getElementById('bookmarkToggle');

  // A first attempt at the bug below force-rescrolled to the current hash's
  // target on *every* hashchange, including a Back navigation -- which
  // fixed Back landing on a stale position, but overcorrected: Back only
  // ever restores whatever hash was actually on the entry being returned
  // to, and a reader who reached a bookmarked policy by opening its chapter
  // and scrolling (not by jumping to it) left that entry's hash at the
  // *chapter*, not the policy -- so force-rescrolling to "the current
  // hash's target" landed at the top of the chapter instead, reported
  // directly. The real, narrower problem was never the hash being coarse;
  // it's that turning the bookmark filter off to reveal a link's target
  // (the fix two above this one) changes the page's overall height right
  // as history remembers a scroll position for the entry being left, and a
  // history entry's remembered pixel offset only lines up again once the
  // *layout* it was recorded against exists again. So instead of
  // overriding position with a fragment scroll on every hashchange, this
  // now: (a) stamps the filter's current state onto the entry being left,
  // every time a link might reveal something, so (b) a `popstate` (Back,
  // Forward, or the Back control's own `history.back()`) can restore that
  // remembered state before the browser's *own* scroll-position memory
  // (accurate down to the exact pixel the reader was actually at, unlike
  // any hash) resolves against a matching layout again. The forced
  // fragment-scroll below is now reserved for the one case it was actually
  // needed for -- a fresh forward jump, where there's no earlier scroll
  // memory to restore in the first place.
  function revealFromBookmarkFilter(target) {
    if (!bookmarkToggle) return;
    history.replaceState({ bookmarkOnly: bookmarkToggle.checked }, '', location.href);
    if (!bookmarkToggle.checked || !target) return;
    const bookmarkable = target.closest('[data-policy], [data-bm]');
    if (bookmarkable && bookmarkable.classList.contains('bhide')) {
      bookmarkToggle.checked = false;
      bookmarkToggle.dispatchEvent(new Event('change'));
    }
  }
  document.addEventListener('click', (e) => {
    const link = e.target.closest('a.pn-xref, a.pn-gloss-ref');
    if (!link) return;
    revealFromBookmarkFilter(document.getElementById(link.getAttribute('href').slice(1)));
  });

  // `popstate` (not `hashchange`) is the one event that fires specifically
  // for history traversal -- Back/Forward, native or via the Back control
  // -- never for a plain forward `location.hash = …` assignment, which is
  // exactly the distinction needed here. `poppingHistory` flags the
  // hashchange handler below that this one was a traversal, so it leaves
  // scroll position alone rather than forcing a fragment-scroll over
  // whatever the browser's own (now-relevant-again) memory just restored.
  // Self-clears on a fresh timer rather than waiting for that hashchange,
  // in case this particular back/forward didn't actually change the hash
  // at all (nothing to leave stale otherwise).
  let poppingHistory = false;
  window.addEventListener('popstate', (e) => {
    poppingHistory = true;
    setTimeout(() => { poppingHistory = false; }, 0);
    if (bookmarkToggle && e.state && typeof e.state.bookmarkOnly === 'boolean'
        && bookmarkToggle.checked !== e.state.bookmarkOnly) {
      bookmarkToggle.checked = e.state.bookmarkOnly;
      bookmarkToggle.dispatchEvent(new Event('change'));
    }
  });

  // The remaining case: a fresh forward jump (a clicked cross-reference or
  // glossary link, Contents, or Phase 14's own search-jump) whose target
  // was just revealed from the bookmark filter right before the browser's
  // native fragment-scroll ran -- confirmed directly, not assumed: the
  // native scroll landed on an unrelated policy several chapters away,
  // `getBoundingClientRect().top` deep in negative numbers, because it
  // computed against the *old*, filtered-short layout a moment before the
  // reveal's own reflow moved everything. There's no earlier scroll memory
  // to protect here (unlike the Back case above), so overriding with an
  // explicit fragment-scroll is exactly right, not a second wrong fix.
  window.addEventListener('hashchange', () => {
    if (poppingHistory) return;
    const target = document.getElementById(location.hash.slice(1));
    if (!target) return;
    revealFromBookmarkFilter(target);
    let node = target;
    while (node && node !== document.body) {
      if (node.tagName === 'DETAILS') node.open = true;
      node = node.parentElement;
    }
    target.scrollIntoView({ block: 'start' });
  });

  // ---------- Phase 14: prioritise the exact policy when its code is searched ----------

  // The visible search box highlights *every* occurrence of a query
  // anywhere in the running text (nppf.js's own run()) -- genuinely useful
  // on its own for finding every place a topic comes up, and left
  // completely unchanged here. But for a query that's actually a policy
  // code, that leaves the policy itself as just one highlighted hit among
  // however many other mentions and cross-reference links happen to
  // contain the same code, scattered across whichever chapters those
  // happen to be in, with nothing telling the reader which hit is the real
  // policy. Reuses Phase 2's own code-vs-search decision (POLICY_CODE_RE
  // plus a live DOM check, so a shape-only match that isn't a real policy
  // -- Phase 2's own "Z9" example -- never jumps to a phantom anchor) to
  // jump straight to the actual policy on top of the existing search, not
  // instead of it.
  //
  // A second, worse problem turned up testing this against the live page,
  // not assumed from reading nppf.js: `searchable` there is `.srch`
  // elements only, and a policy's own code badge -- `<span class="pid">
  // S5:</span>`, right beside its `.srch` title -- is deliberately *not*
  // one of them (nppf.js has no reason to let a policy's own number
  // highlight itself every time it's mentioned). That means a bare code
  // search like "S5" never puts a <mark> inside the S5 policy at all, so
  // nppf.js's own run() -- which hides every `.policy`/`.node` with no
  // match -- hides the genuine policy along with everything else that
  // didn't match, which is exactly backwards for a code search. Jumping
  // there with a plain `location.hash` alone would land on a
  // `display:none` element and visibly do nothing. Fixed by force-revealing
  // the target's whole ancestor chain (removing `.hide`, opening any
  // `<details>`) right before the jump, undoing nppf.js's own hide
  // specifically for this one element regardless of whether its body text
  // happened to also match -- harmless to nppf.js's own state, since its
  // next run() (triggered by the very next keystroke) starts with its own
  // clearAll() and recomputes every `.hide` from scratch anyway.
  //
  // Reported directly, one step further than the first fix caught: jumping
  // to a code search like "GB7" showed the policy card itself but nothing
  // inside it -- just the title, no numbered paragraphs. Cause is the same
  // one, one level down: nppf.js's own `.node` pass (`if(!b.querySelector(
  // 'mark')) b.classList.add('hide')`) hides each individual numbered
  // paragraph independently of its parent `.policy`, and a bare code search
  // puts no <mark> inside *any* of them either, same as the policy
  // container itself. Un-hiding only the ancestor chain left every one of
  // GB7's own 22 child nodes still individually `.hide`d underneath an
  // now-visible-but-empty-looking shell. Fixed by also clearing `.hide` off
  // every hidden descendant, not just ancestors.
  function forceVisible(el) {
    let node = el;
    while (node && node !== document.body) {
      node.classList.remove('hide');
      if (node.tagName === 'DETAILS') node.open = true;
      node = node.parentElement;
    }
    el.querySelectorAll('.hide').forEach((d) => d.classList.remove('hide'));
  }
  let searchJumpTimer = null;
  searchInput.addEventListener('input', () => {
    clearTimeout(searchJumpTimer);
    // A little behind nppf.js's own 140ms debounce, so run() has already
    // done its own hide/show pass by the time this fires -- otherwise it
    // would just re-hide the target a moment after this reveals it.
    searchJumpTimer = setTimeout(() => {
      const compact = searchInput.value.replace(/\s+/g, '');
      const m = compact.match(POLICY_CODE_RE);
      if (!m) return;
      const code = compact.toUpperCase();
      // getElementById, not `[data-policy="…"]` -- Phase 4 hid #nav's own
      // 131-policy tree (.pn-hidden-nav, display:none) rather than removing
      // it, and its <li> elements carry the *same* data-policy attribute as
      // the real .policy card for nppf.js's own bookmark-star mirroring.
      // querySelector returns whichever comes first in document order --
      // the (invisible) nav tree, here -- so grabbing an actual element to
      // reveal/reopen needs the id instead, which is unambiguous. Phase 2's
      // own existing jumpToPolicy() never hit this: it only ever checked
      // `[data-policy]` for *truthiness* before navigating by hash, and
      // never needed the element itself.
      const target = document.getElementById(code);
      if (!target || !target.classList.contains('policy')) return;
      revealFromBookmarkFilter(target);
      forceVisible(target);
      jumpToPolicy(code);
      // Belt-and-braces on top of jumpToPolicy's own location.hash: a live
      // search can hide most of the document, so the page is often far
      // shorter than usual -- short enough that the target can already sit
      // partway inside the viewport before this runs, which leaves the
      // browser's own native fragment-scroll (tuned for "bring it into
      // view", not "put it at the top") deciding barely any scrolling is
      // needed and stopping with only the target's top edge peeking over
      // the bottom, found directly by measuring getBoundingClientRect()
      // after the jump rather than assumed from a screenshot. An explicit
      // scrollIntoView here always aligns the target's top edge to the top
      // of the viewport (respecting the same [id]{scroll-margin-top}
      // clearance every other jump in this file already relies on),
      // regardless of how little native scrolling the hash change alone
      // decided to do.
      target.scrollIntoView({ block: 'start' });
    }, 170);
  });

  // ---------- Contents: a compact chapter/annex jump list ----------

  // Not the 131-policy nav tree Phase 4 removed -- reading its own text
  // straight off each chapter/annex's live title (including Phase 8's own
  // "(S1-6)" range suffix, already part of that same heading) means one
  // list item per chapter, not one per policy. Built once at load; chapter
  // titles don't change while the panel is open.
  const tocLabel = document.createElement('div');
  tocLabel.className = 'pn-toc-label';
  tocLabel.textContent = 'Contents';

  const toc = document.createElement('nav');
  toc.className = 'pn-toc';
  toc.setAttribute('aria-label', 'Contents');

  function addTocLink(chapterEl) {
    const titleEl = chapterEl.querySelector(':scope > summary .chapter-h');
    if (!titleEl) return;
    const a = document.createElement('a');
    a.className = 'pn-toc-link';
    a.href = '#' + chapterEl.id;
    a.textContent = titleEl.textContent.replace(/\s+/g, ' ').trim();
    toc.appendChild(a);
  }

  document.querySelectorAll('details.chapter:not(.annex)').forEach(addTocLink);
  const annexes = document.querySelectorAll('details.chapter.annex');
  if (annexes.length) {
    const divider = document.createElement('div');
    divider.className = 'pn-toc-divider';
    divider.textContent = 'Annexes';
    toc.appendChild(divider);
    annexes.forEach(addTocLink);
  }

  if (toc.childElementCount) {
    panelMenu.appendChild(tocLabel);
    panelMenu.appendChild(toc);

    // Reported directly: hovering the Contents box blocks scrolling
    // entirely. Confirmed with real scroll input (a synthetic WheelEvent
    // doesn't reproduce it -- the browser's own scroll-input handling
    // lives below the DOM event layer): the wheel gesture simply does
    // nothing while the pointer is over .pn-toc, in every combination of
    // `display`/`overflow` tried (flex or block, hidden or visible) --
    // and .pn-toc never has any overflow of its own to legitimately
    // account for that (scrollHeight === clientHeight always, since it
    // grows to fit its own content; verified directly, not assumed). The
    // exact browser mechanism wasn't pinned down despite real effort, so
    // rather than keep guessing at the right CSS incantation, this
    // sidesteps it: .pn-toc can never need to scroll itself, so its own
    // wheel events are forwarded straight to .panel (the thing that
    // actually should scroll) and the browser's own default handling for
    // them is suppressed, whatever that handling was doing.
    toc.addEventListener('wheel', (e) => {
      panelMenu.scrollTop += e.deltaY;
      e.preventDefault();
    }, { passive: false });

    // A link jumps (native href="#...") and should also close the menu it
    // was clicked from -- same as .totop already does before its own jump
    // -- and, reported directly: make picking a chapter from Contents
    // actually *go there*, not add one more open chapter to whatever was
    // already open from earlier reading. Every other chapter is closed and
    // the target opened explicitly here, rather than leaving the target to
    // the browser's own native auto-expand-on-fragment-navigation: that
    // only reaches ancestors of a target *nested inside* a closed
    // <details>, not a target that a closed <details> *is* -- confirmed
    // separately, jumping straight to a chapter id (not something inside
    // one) doesn't auto-open it on its own. Setting `.open` directly here
    // is also simply more immediate than depending on that mechanism at
    // all.
    toc.addEventListener('click', (e) => {
      const link = e.target.closest('a');
      if (!link) return;
      document.body.classList.remove('nav-open');
      const targetId = link.getAttribute('href').slice(1);
      document.querySelectorAll('details.chapter').forEach((ch) => {
        ch.open = (ch.id === targetId);
      });
    });

    // "Where am I" -- mark whichever chapter(s) are currently expanded
    // every time the menu opens, not just once at load, since a reader can
    // open/close chapters freely while the menu itself stays closed.
    // nppf.js's own #navtoggle click handler (setNav(!nav-open)) is bound
    // *before* this one (its script runs first), so by the time this
    // listener sees the same click, .nav-open already reflects the new,
    // post-toggle state -- checking it here means "sync only when the menu
    // just opened", not "the state before this click".
    function syncTocCurrent() {
      toc.querySelectorAll('.pn-toc-link').forEach((a) => {
        const target = document.getElementById(a.getAttribute('href').slice(1));
        a.classList.toggle('pn-toc-current', !!(target && target.open));
      });
    }
    navtoggle.addEventListener('click', () => {
      if (document.body.classList.contains('nav-open')) syncTocCurrent();
    });
  }

  // ---------- Phase 13: link defined terms to their glossary entries ----------

  // Same underlying technique as Phase 9 (walk .srch text nodes, splice in
  // <a>s, re-snapshot dataset.orig so a search-then-clear can't wipe them
  // out) but a much more conservative *scope*, because the risk profile is
  // completely different: a policy code ("S1", "GB6") essentially never
  // collides with ordinary prose, but a fair fraction of the 129 glossary
  // terms are, out of context, everyday English words -- checked directly
  // against the actual list rather than assumed: "Settlement",
  // "Deliverable", "Contamination", "Masterplan" are all real defined
  // terms here, and all routinely mean nothing more than their plain
  // dictionary sense elsewhere in 700KB of running text. Linking every
  // instance of "settlement" across the whole document would be far more
  // noise than help. Two independent decisions cut that risk down instead
  // of trying to guess sense from context (well beyond what's worth
  // building here):
  //
  //  1. Multi-word terms only. A cleaned term with no space in it (by a
  //     bare whitespace check) is disproportionately likely to double as
  //     ordinary vocabulary; a multi-word technical phrase ("previously
  //     developed land", "best and most versatile agricultural land")
  //     essentially never collides with ordinary prose this way. This
  //     single rule also happens to correctly drop the two terms whose
  //     *defined* form carries a parenthetical qualifier nobody actually
  //     writes inline ("Significance (for heritage policy)" cleans to the
  //     single, far-too-generic word "Significance") -- one rule, not a
  //     separate hand-maintained denylist for those.
  //  2. First occurrence per policy/paragraph "unit" (the same grouping
  //     Phase 3's citation text and Phase 5's card boxes already treat as
  //     one thing), not per document. A term reused across a 13-policy
  //     chapter gets linked again in each policy that actually uses it,
  //     since a reader jumping straight to one policy still gets the
  //     link, but not every single time within the one paragraph that
  //     happens to repeat it.
  //
  // Terms are read from the live glossary itself, never a hand-maintained
  // duplicate list, so this can't silently drift from Annex B's own
  // content the next time the source PDF changes.
  const glossaryTerms = [];
  document.querySelectorAll('#annexB .node.gloss').forEach((entry) => {
    const raw = entry.dataset.term || '';
    // Strip a trailing digit run some entries carry as a data artifact
    // (e.g. "Major development71", matching id="g-major-development71" --
    // an existing quirk in the extraction pipeline, not introduced here)
    // -- but only when it's glued directly onto a letter. Some terms
    // legitimately end in a hyphen-digit ("Post-16"); requiring a letter
    // immediately before the digits, not just "not a hyphen", avoids
    // partially mangling those into nonsense like "Post-1".
    let cleaned = raw.replace(/(?<=[a-zA-Z])\d+$/, '');
    // Strip a trailing parenthetical qualifier some entries define WITH
    // ("Conservation/conserve (for heritage policy)") -- nobody actually
    // writes that qualifier inline in body text, only the bare word.
    cleaned = cleaned.replace(/\s*\([^)]*\)\s*$/, '').trim();
    if (!cleaned.includes(' ')) return; // rule 1 above
    glossaryTerms.push({ term: cleaned, id: entry.id });
  });
  // Longest first, so "Brownfield land registers" is tried -- and wins --
  // before the shorter "Brownfield land" that's a substring of it.
  glossaryTerms.sort((a, b) => b.term.length - a.term.length);

  if (glossaryTerms.length) {
    const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    // Keyed by the matched text's lowercase form (body text may not use
    // the glossary's own capitalisation, e.g. "grey belt" vs "Grey belt"),
    // valued with both the id to link to and the canonical, correctly-
    // cased term for the tooltip -- regardless of how the match itself
    // happened to be capitalised where it was found.
    const termByLower = new Map(glossaryTerms.map((t) => [t.term.toLowerCase(), t]));
    const GLOSS_RE = new RegExp(
      '\\b(?:' + glossaryTerms.map((t) => escapeRe(t.term)).join('|') + ')\\b',
      'gi'
    );

    const linkedInUnit = new WeakMap();
    function findUnit(el) {
      return el.closest('.policy, .chapter > .node, .secgrp > .node, .subgrp > .node');
    }

    const touchedGlossSrch = new Set();
    document.querySelectorAll('.doc .srch').forEach((el) => {
      if (el.closest('#annexB')) return; // never link the glossary to itself
      const unit = findUnit(el);
      if (!unit) return; // nothing to track "already seen in this unit" against
      let seenIds = linkedInUnit.get(unit);
      if (!seenIds) { seenIds = new Set(); linkedInUnit.set(unit, seenIds); }

      const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
      const textNodes = [];
      let tn;
      while ((tn = walker.nextNode())) textNodes.push(tn);

      textNodes.forEach((node) => {
        // Don't relink text already inside a link this page added (a
        // Phase 9 cross-reference, in practice) -- only plain text is
        // ever a candidate.
        if (node.parentElement.closest('a')) return;
        const t = node.nodeValue;
        GLOSS_RE.lastIndex = 0;
        if (!GLOSS_RE.test(t)) return;
        GLOSS_RE.lastIndex = 0;

        const frag = document.createDocumentFragment();
        let last = 0, m, linkedAny = false;
        while ((m = GLOSS_RE.exec(t))) {
          frag.appendChild(document.createTextNode(t.slice(last, m.index)));
          const found = termByLower.get(m[0].toLowerCase());
          // Link only the first time this particular term turns up in
          // this unit, and only if it still resolves to a real element
          // (it always should, but never link to nothing regardless).
          if (found && !seenIds.has(found.id) && document.getElementById(found.id)) {
            const a = document.createElement('a');
            a.className = 'pn-gloss-ref';
            a.href = '#' + found.id;
            a.title = 'Glossary: ' + found.term;
            a.textContent = m[0]; // the exact text as written, not the glossary's own casing
            frag.appendChild(a);
            seenIds.add(found.id);
            linkedAny = true;
          } else {
            frag.appendChild(document.createTextNode(m[0]));
          }
          last = m.index + m[0].length;
        }
        frag.appendChild(document.createTextNode(t.slice(last)));

        if (linkedAny) {
          node.parentNode.replaceChild(frag, node);
          touchedGlossSrch.add(el);
        }
      });
    });

    // Same reason as Phase 9: nppf.js snapshots every .srch element's
    // *original* innerHTML once at load to restore verbatim after a
    // cleared search. Re-snapshot only what this pass actually changed.
    touchedGlossSrch.forEach((el) => { el.dataset.orig = el.innerHTML; });
  }
})();
