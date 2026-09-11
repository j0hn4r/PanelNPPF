// PanelNPPF — panel chrome, layered over the page's own nppf.js.
// Only ever moves/adds DOM nodes; never edits vendor/nppf-index.html or
// nppf.js. See PLAN.md for full design rationale.

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

  // ---------- relocate search box + brand block ----------

  // Moved nodes keep whatever listeners nppf.js already bound to them by
  // id/class.
  const topbar = document.createElement('div');
  topbar.className = 'pn-topbar';
  mobilehead.insertBefore(topbar, navtoggle);
  topbar.appendChild(navtoggle);
  topbar.appendChild(searchbox);
  topbar.appendChild(countEl);

  // Crown-copyright attribution (licence requirement, not decoration) --
  // moved to the menu footer so it isn't ~200px at the top of a narrow panel.
  if (brand) {
    brand.classList.add('panel-brand');
    panelMenu.appendChild(brand);
  }

  // Hidden, not removed: nppf.js's own nav click handler and bookmark-star
  // mirroring still reference #nav harmlessly.
  navEl.classList.add('pn-hidden-nav');

  // ---------- menu layout: group + reprioritise the filters ----------

  const modebar = document.querySelector('.modebar');
  if (modebar) {
    const label = document.createElement('div');
    label.className = 'pn-filters-label';
    label.textContent = 'Filters';
    modebar.parentElement.insertBefore(label, modebar);
  }

  // ---------- context-menu / command handoff ----------

  // Validated against the DOM (not just the regex) so a stray shape-alike
  // selection doesn't jump to a phantom anchor.
  const POLICY_CODE_RE = /^(PM|DM|S|CC|HO|E|TC|CO|W|M|L|GB|DP|TR|HC|P|F|N|HE)\d{1,2}$/i;

  // Existence checks differ per call site (see the search-jump listener
  // below), so only the shape check is shared here.
  function matchPolicyCode(raw) {
    const compact = raw.replace(/\s+/g, '');
    return POLICY_CODE_RE.test(compact) ? compact.toUpperCase() : null;
  }

  function focusSearchInput() {
    searchInput.focus();
  }

  function runSearch(q) {
    searchInput.value = q;
    searchInput.dispatchEvent(new Event('input', { bubbles: true }));
    searchInput.focus();
  }

  function jumpToPolicy(code) {
    document.body.classList.remove('nav-open');
    location.hash = '#' + code;
  }

  function handleLookup(q) {
    if (!q) {
      focusSearchInput();
      return;
    }
    const code = matchPolicyCode(q);
    if (code && document.querySelector('[data-policy="' + code + '"]')) {
      jumpToPolicy(code);
      return;
    }
    runSearch(q);
  }

  function consumeLookup(pending) {
    if (!pending) return;
    chrome.storage.session.remove('pendingLookup');
    handleLookup(pending.q || '');
  }

  function consumePendingLookup() {
    if (!(window.chrome && chrome.storage && chrome.storage.session)) return;
    chrome.storage.session.get('pendingLookup', (result) => {
      consumeLookup(result && result.pendingLookup);
    });
  }

  // Cold panel: read whatever's already waiting on load.
  consumePendingLookup();

  // Warm panel: background.js just wrote a new request while we were open.
  if (window.chrome && chrome.storage && chrome.storage.onChanged) {
    chrome.storage.onChanged.addListener((changes, areaName) => {
      if (areaName !== 'session' || !changes.pendingLookup) return;
      consumeLookup(changes.pendingLookup.newValue);
    });
  }

  // ---------- copy citation ----------

  function normalizeWS(s) {
    return s.replace(/\s+/g, ' ').trim();
  }

  // Operates on a detached clone: footnote markers and buttons must be
  // stripped before reading textContent, or a footnote number fuses onto
  // the preceding word.
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
      if (!h3) return;
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'pn-cite-btn';
      btn.title = 'Copy citation';
      btn.setAttribute('aria-label', 'Copy citation for ' + policyEl.id);
      btn.textContent = '⧉';
      h3.appendChild(btn);
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
    // Cites the official Framework, not this unofficial reading edition.
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

  // ---------- restore reading position ----------

  // The panel's document is destroyed when it closes, so position has to be
  // persisted explicitly. Falls back to localStorage outside an extension.
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

  // A pending context-menu lookup or an explicit #fragment on open both take
  // priority over resuming a saved position.
  if (!location.hash) {
    positionStore.get((pos) => {
      if (!pos) return;
      if (window.chrome && chrome.storage && chrome.storage.session) {
        chrome.storage.session.get('pendingLookup', (result) => {
          if (result && result.pendingLookup) return;
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

  // The A-Z bar's own links jump to whichever entry happens to sort first
  // under that letter, not anything the reader asked for -- misleading with
  // the same :target highlight used elsewhere for a genuine selection.
  // Fixed by inserting a plain letter heading before each new letter's first
  // entry and repointing the bar at that instead of a specific term.
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

    azbar.querySelectorAll('a').forEach((a) => {
      const letter = a.textContent.trim().toUpperCase();
      if (document.getElementById('pn-gloss-' + letter)) {
        a.setAttribute('href', '#pn-gloss-' + letter);
      }
    });
  }

  // ---------- policy-code range on each policy-carrying chapter's title ----------

  // Reused by the Contents box below too -- the chapter set doesn't change.
  const numberedChapters = document.querySelectorAll('details.chapter:not(.annex)');

  // Read straight off each chapter's [data-policy] attributes rather than a
  // hand-maintained table that would drift if the source PDF changes.
  numberedChapters.forEach((chapter) => {
    const policies = chapter.querySelectorAll('.policy[data-policy]');
    if (!policies.length) return;

    const ranges = new Map();
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
    // .srch element's innerHTML for search-restore, and this suffix must
    // stay out of that snapshot and out of the highlighter's text walk.
    const titleSpan = chapter.querySelector('summary .chapter-h .srch');
    if (!titleSpan) return;
    const suffix = document.createElement('span');
    suffix.className = 'pn-policy-range';
    suffix.textContent = ` (${rangeText})`;
    titleSpan.after(suffix);
  });

  // ---------- cross-reference links + a Back control ----------

  // Every prefix this document uses; longer prefixes first defensively.
  const POLICY_PREFIXES = ['PM','DM','CC','HO','TC','CO','GB','DP','TR','HC','HE','S','E','W','M','L','P','F','N']
    .sort((a, b) => b.length - a.length);
  const PREFIX_ALT = POLICY_PREFIXES.join('|');

  // Matches "policy"/"policies" followed by one or more codes chained by
  // and/or/to/, connectors, each optionally with parenthetical sub-parts
  // ("PM6(1)(c)" -> id="PM6-1-c"). Deliberately requires the word
  // "policy"/"policies" first rather than matching any bare code-shaped
  // token -- this document's own prefixes collide with unrelated things
  // ("the M1" is not policy M1), and a wrong link is worse than a missed
  // one. The code+subparts piece ends in a lookahead `(?![0-9a-zA-Z])`
  // rather than `\b`: a match ending on a closing paren ("PM6(1)(c)") has
  // non-word `)` followed by non-word space, so `\b` is never satisfied and
  // the engine backtracks past every sub-part, silently losing them.
  const REF_SPAN_RE = new RegExp(
    '\\bpolic(?:y|ies)\\b((?:\\s*(?:and\\/or|and|or|to|,)?\\s*(?:' +
      PREFIX_ALT + ')\\d{1,2}(?:\\([0-9a-z]+\\)){0,3}(?![0-9a-zA-Z]))+)',
    'gi'
  );
  const ONE_CODE_RE = new RegExp('(' + PREFIX_ALT + ')(\\d{1,2})((?:\\([0-9a-z]+\\)){0,3})', 'g');

  function codeToId(prefix, num, subparts) {
    return prefix + num + subparts.replace(/\(([0-9a-z]+)\)/gi, '-$1');
  }

  // Shared by every pass below that splices new <a>s into a .srch element's
  // text nodes.
  function collectTextNodes(el) {
    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    const nodes = [];
    let tn;
    while ((tn = walker.nextNode())) nodes.push(tn);
    return nodes;
  }

  // nppf.js snapshots each .srch element's original innerHTML at load to
  // restore after a cleared search; anything that spliced links into one
  // must re-snapshot it here or the first search-then-clear undoes them.
  function resnapshotOrig(touched) {
    touched.forEach((el) => { el.dataset.orig = el.innerHTML; });
  }

  // The set of .srch elements doesn't change across the passes below (only
  // their text nodes do), so it's queried once and reused.
  const srchEls = document.querySelectorAll('.doc .srch');

  const touchedSrch = new Set();
  srchEls.forEach((el) => {
    const textNodes = collectTextNodes(el);

    textNodes.forEach((node) => {
      const t = node.nodeValue;
      REF_SPAN_RE.lastIndex = 0;
      if (!REF_SPAN_RE.test(t)) return;
      REF_SPAN_RE.lastIndex = 0;

      const frag = document.createDocumentFragment();
      let last = 0, spanMatch, linkedAny = false;
      while ((spanMatch = REF_SPAN_RE.exec(t))) {
        const tail = spanMatch[1];
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
            // No element with that id -- leave text unchanged rather than
            // link to nothing.
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

  // A second, narrower pass for references phrased as a description with
  // the code arriving afterwards alone in parentheses (e.g. "...Local
  // Green Space (HC8)..."), which REF_SPAN_RE above deliberately doesn't
  // catch. Looser than requiring "policy" first, but the same existing-id
  // check below still refuses to link anything that doesn't resolve.
  const BARE_CODE_RE = new RegExp(
    '\\((' + PREFIX_ALT + ')(\\d{1,2})((?:\\([0-9a-z]+\\)){0,3})\\)', 'g'
  );
  srchEls.forEach((el) => {
    const textNodes = collectTextNodes(el);

    textNodes.forEach((node) => {
      // Only plain text is a candidate -- skip anything the pass above
      // (or nppf.js's own footnote markup) already wrapped in a link.
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
        // Only the code is underlined, not its surrounding parentheses.
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

  resnapshotOrig(touchedSrch);

  // A hash-only jump is a normal history entry regardless of source, so a
  // plain history.back() already does the right thing. Hidden until the
  // first hashchange -- nothing to go back to on a fresh open.
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

  // A cross-reference/glossary link can point at a policy hidden by the
  // "bookmarks only" filter (nppf.js's `.bhide`, toggled by
  // #bookmarkToggle); landing on a hidden target turns the filter off
  // first rather than silently doing nothing. Also stamps the filter's
  // current state onto the history entry being left, so a later `popstate`
  // (Back/Forward) can restore it -- necessary because turning the filter
  // off changes page height right as history records a scroll position for
  // that entry, and the remembered pixel offset only lines up again once
  // the layout it was recorded against exists again.
  const bookmarkToggle = document.getElementById('bookmarkToggle');

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

  // Shared by the hashchange handler below and forceVisible: opens any
  // closed <details> ancestor. Needed explicitly because native
  // auto-expand-on-fragment-navigation only reaches an ancestor of a target
  // *nested inside* a closed <details>, never a target a closed <details>
  // itself is.
  function openAncestorDetails(el) {
    let node = el;
    while (node && node !== document.body) {
      if (node.tagName === 'DETAILS') node.open = true;
      node = node.parentElement;
    }
  }

  // `popstate` fires for history traversal (Back/Forward); a plain forward
  // `location.hash =` assignment does not. `poppingHistory` flags the
  // hashchange handler below that this was a traversal, so it leaves scroll
  // position to the browser's own (now-relevant-again) memory instead of
  // forcing a fragment-scroll over it. Self-clears on a timer rather than
  // waiting for that hashchange, in case this traversal didn't change the
  // hash at all.
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

  // A fresh forward jump (cross-reference/glossary link, Contents, or the
  // search-jump below) whose target was just revealed from the bookmark
  // filter right before the browser's native fragment-scroll ran: that
  // native scroll computes against the *old*, filtered-short layout a
  // moment before the reveal's reflow moves everything, so it's overridden
  // explicitly here. No earlier scroll memory to protect in this case
  // (unlike Back, above).
  window.addEventListener('hashchange', () => {
    if (poppingHistory) return;
    const target = document.getElementById(location.hash.slice(1));
    if (!target) return;
    revealFromBookmarkFilter(target);
    openAncestorDetails(target);
    target.scrollIntoView({ block: 'start' });
  });

  // ---------- prioritise the exact policy when its code is searched ----------

  // The search box highlights every occurrence of a query in the running
  // text, which for a policy code leaves the policy itself as just one hit
  // among many cross-reference mentions. This jumps straight to the actual
  // policy on top of the existing search. Reuses the code-vs-search shape
  // check above (plus a live DOM check, so a shape-only match never jumps
  // to a phantom anchor).
  //
  // A policy's own code badge (`.pid`) is deliberately not part of
  // nppf.js's searchable `.srch` text, so a bare code search never marks
  // the policy itself and nppf.js's own hide-non-matching pass hides the
  // genuine policy along with everything that didn't match -- backwards
  // for a code search. forceVisible below undoes that hide on the whole
  // target (ancestors, the element itself, and every hidden descendant --
  // nppf.js hides each numbered paragraph independently of its parent
  // policy too), regardless of whether the body text happened to also
  // match. Harmless to nppf.js's own state: its next run(), from the very
  // next keystroke, recomputes every `.hide` from scratch anyway.
  function forceVisible(el) {
    let node = el;
    while (node && node !== document.body) {
      node.classList.remove('hide');
      node = node.parentElement;
    }
    openAncestorDetails(el);
    el.querySelectorAll('.hide').forEach((d) => d.classList.remove('hide'));
  }
  let searchJumpTimer = null;
  searchInput.addEventListener('input', () => {
    clearTimeout(searchJumpTimer);
    // Behind nppf.js's own 140ms debounce, so its hide/show pass has
    // already run by the time this fires.
    searchJumpTimer = setTimeout(() => {
      const code = matchPolicyCode(searchInput.value);
      if (!code) return;
      // getElementById, not `[data-policy="…"]` -- the hidden #nav tree
      // carries the same attribute on unrelated <li> elements and would
      // win a querySelector by document order.
      const target = document.getElementById(code);
      if (!target || !target.classList.contains('policy')) return;
      revealFromBookmarkFilter(target);
      forceVisible(target);
      jumpToPolicy(code);
      // A live search can shrink the page enough that the target already
      // sits partway inside the viewport, so the browser's own native
      // scroll decides barely any scrolling is needed. This always aligns
      // the target's top edge to the viewport top instead.
      target.scrollIntoView({ block: 'start' });
    }, 170);
  });

  // ---------- Contents: a compact chapter/annex jump list ----------

  // Reads each chapter/annex's own live title (including the policy-range
  // suffix above) rather than the full policy tree -- one item per chapter.
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

  numberedChapters.forEach(addTocLink);
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

    // .pn-toc never needs to scroll itself (its content always fits), but
    // the pointer being over it otherwise blocks the menu's own scroll --
    // forwarded manually to .panel instead.
    toc.addEventListener('wheel', (e) => {
      panelMenu.scrollTop += e.deltaY;
      e.preventDefault();
    }, { passive: false });

    // Closes every other chapter and opens the target explicitly, rather
    // than relying on native auto-expand-on-fragment-navigation -- that
    // only reaches an ancestor of a target *nested inside* a closed
    // <details>, not a target a closed <details> itself is.
    toc.addEventListener('click', (e) => {
      const link = e.target.closest('a');
      if (!link) return;
      document.body.classList.remove('nav-open');
      const targetId = link.getAttribute('href').slice(1);
      document.querySelectorAll('details.chapter').forEach((ch) => {
        ch.open = (ch.id === targetId);
      });
    });

    // nppf.js's own #navtoggle handler runs first (its script loads
    // first), so by the time this listener sees the same click,
    // .nav-open already reflects the post-toggle state.
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

  // ---------- link defined terms to their glossary entries ----------

  // Same splice technique as the cross-reference passes above, scoped much
  // more conservatively: many of the 129 glossary terms ("Settlement",
  // "Deliverable") are also ordinary English words, so linking every
  // occurrence would be mostly noise. Two rules limit that:
  //  1. Multi-word terms only -- a single word is far more likely to
  //     collide with ordinary prose; this also naturally drops the couple
  //     of terms whose defined form carries a parenthetical qualifier.
  //  2. First occurrence per policy/paragraph "unit", not per document --
  //     a term reused within one chapter is linked once per policy that
  //     uses it, not on every repeat within one paragraph.
  // Terms are read from the live glossary, never a hand-maintained list.
  const glossaryTerms = [];
  glossEntries.forEach((entry) => {
    const raw = entry.dataset.term || '';
    // Strip a trailing digit some entries carry as a data artifact (e.g.
    // "Major development71"), but only when glued directly onto a letter
    // -- some terms legitimately end in a hyphen-digit ("Post-16").
    let cleaned = raw.replace(/(?<=[a-zA-Z])\d+$/, '');
    // Strip a trailing parenthetical qualifier some entries define with --
    // nobody writes that qualifier inline in body text.
    cleaned = cleaned.replace(/\s*\([^)]*\)\s*$/, '').trim();
    if (!cleaned.includes(' ')) return;
    glossaryTerms.push({ term: cleaned, id: entry.id });
  });
  // Longest first, so "Brownfield land registers" wins over the shorter
  // "Brownfield land" that's a substring of it.
  glossaryTerms.sort((a, b) => b.term.length - a.term.length);

  if (glossaryTerms.length) {
    const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    // Keyed by lowercase match text (body text may not use the glossary's
    // own capitalisation); valued with the id and the canonical term text.
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
    srchEls.forEach((el) => {
      if (el.closest('#annexB')) return;
      const unit = findUnit(el);
      if (!unit) return;
      let seenIds = linkedInUnit.get(unit);
      if (!seenIds) { seenIds = new Set(); linkedInUnit.set(unit, seenIds); }

      const textNodes = collectTextNodes(el);

      textNodes.forEach((node) => {
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
          if (found && !seenIds.has(found.id) && document.getElementById(found.id)) {
            const a = document.createElement('a');
            a.className = 'pn-gloss-ref';
            a.href = '#' + found.id;
            a.title = 'Glossary: ' + found.term;
            a.textContent = m[0];
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

    resnapshotOrig(touchedGlossSrch);
  }
})();
