// PanelNPPF — service worker
//
// Handoff to the panel goes through chrome.storage.session (see panel.js's
// consumePendingLookup/onChanged pair), not chrome.runtime.sendMessage --
// a context-menu click or command fires whether or not the panel document
// currently exists, and sendMessage would be sent into the void against a
// cold panel.

const MAX_LOOKUP_LEN = 120;
const MENU_ID = 'nppf-lookup';

function normalizeSelection(text) {
  if (!text) return '';
  return text.replace(/\s+/g, ' ').trim().slice(0, MAX_LOOKUP_LEN);
}

// Called first, before any storage write, since sidePanel.open() must run
// synchronously within the gesture handler or it loses the user-gesture
// context it needs.
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
  // No selection here -- panel.js focuses the search box on an empty q.
  openPanel(tab);
});
