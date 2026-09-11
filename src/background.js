// PanelNPPF — service worker
//
// Owns three entry points into the panel: the toolbar icon, a right-click
// "Look up in the NPPF" context menu on any text selection, and the
// Alt+Shift+N keyboard command. None of them can reach into the panel
// directly -- a context-menu click or a command fires whether or not the
// panel document currently exists, so the handoff goes through
// chrome.storage.session (see panel.js's readPendingLookup/onChanged pair)
// rather than chrome.runtime.sendMessage, which would be sent into the void
// against a cold panel. See PLAN.md section 7.

const MAX_LOOKUP_LEN = 120;
const MENU_ID = 'nppf-lookup';

function normalizeSelection(text) {
  if (!text) return '';
  return text.replace(/\s+/g, ' ').trim().slice(0, MAX_LOOKUP_LEN);
}

// sidePanel.open() must be called synchronously from within the gesture
// handler (the context-menu click, the command) -- it's called first, before
// any storage write, so an await elsewhere in the handler never risks
// losing the user-gesture context it needs.
function openPanel(tab) {
  const windowId = tab && tab.windowId;
  if (windowId == null) return;
  chrome.sidePanel.open({ windowId }).catch((err) => {
    console.error('PanelNPPF: sidePanel.open failed', err);
  });
}

function sendLookup(q) {
  chrome.storage.session.set({ pendingLookup: { q, ts: Date.now() } }).catch((err) => {
    console.error('PanelNPPF: failed to store pending lookup', err);
  });
}

chrome.runtime.onInstalled.addListener(() => {
  chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch((err) => {
    console.error('PanelNPPF: failed to set panel behavior', err);
  });

  // removeAll first: onInstalled can fire again on extension update/reload,
  // and a duplicate menu id throws.
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({
      id: MENU_ID,
      title: 'Look up “%s” in the NPPF',
      contexts: ['selection'],
    });
  });
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId !== MENU_ID) return;
  const q = normalizeSelection(info.selectionText);
  if (!q) return;
  openPanel(tab);
  sendLookup(q);
});

chrome.commands.onCommand.addListener((command, tab) => {
  if (command !== 'open-nppf') return;
  // No selection to look up -- just open and let panel.js focus the search
  // box. An empty q is a valid "no pending lookup" signal, see panel.js.
  openPanel(tab);
});
