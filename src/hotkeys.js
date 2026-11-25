/* Hotkeys you can change, as in Obsidian (Settings, Hotkeys).
   Every command has default keys. Your changes are kept in app.settings.hotkeys as { id: [keys] }.
   A key string is written like "Mod-Shift-N": Mod is Cmd on a Mac and Ctrl elsewhere; on a Mac, Ctrl is
   the Control key. Keys come from the physical key (KeyN, Digit1, BracketLeft), so Option on a Mac and
   other keyboard layouts do not change them. One listener, in the capture phase, runs a matching command
   before the editor sees the key; so editor commands such as Bold can have other keys too. */

const IS_MAC = /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent);
const curPane = () => (panes.focus == null ? panes.notePane : panes.focus);
const edCmd = (fn) => () => { if (!ed.view || app.settings.mode === 'read') return false; return fn(ed.view) !== false; };

const HOTKEY_COMMANDS = [
  // General
  { id: 'palette.open', group: 'General', label: 'Find a note or run a command', keys: ['Mod-K', 'Mod-P', 'Mod-O'], run: () => openPalette('') },
  { id: 'palette.commands', group: 'General', label: 'Command list', keys: ['Mod-Shift-K', 'Mod-Shift-P'], run: () => openPalette('>') },
  { id: 'note.new', group: 'General', label: 'New note, title selected', keys: ['Mod-N'], run: () => newUntitledNote() },
  { id: 'note.newDialog', group: 'General', label: 'New note: choose the type first', keys: ['Mod-Shift-N', 'Alt-N'], run: () => newNoteDialog() },
  { id: 'capture', group: 'General', label: 'Quick capture to the inbox', keys: ['Alt-C'], run: () => captureDialog() },
  { id: 'note.branch', group: 'General', label: 'Branch: a new note that continues this one', keys: ['Alt-B'], run: () => branchNote() },
  { id: 'note.save', group: 'General', label: 'Save now (saving is automatic)', keys: ['Mod-S'], run: () => { saveCurrent.flush(); setSaveState('saved'); } },
  { id: 'view.read', group: 'General', label: 'Read view on or off', keys: ['Mod-E'], run: () => setMode(app.settings.mode === 'read' ? 'live' : 'read') },
  { id: 'view.source', group: 'General', label: 'Source view on or off', keys: ['Mod-Shift-E'], run: () => setMode(app.settings.mode === 'source' ? 'live' : 'source') },
  { id: 'sidebar.toggle', group: 'General', label: 'Show or hide the sidebar', keys: [], run: () => toggleSidebar() },
  { id: 'graph.open', group: 'General', label: 'Open the graph', keys: ['Alt-G'], run: () => openGraph() },
  { id: 'review.open', group: 'General', label: 'Review flashcards', keys: ['Alt-R'], run: () => openReview() },
  { id: 'stats.open', group: 'General', label: 'Review statistics', keys: [], run: () => openStats() },
  { id: 'pdf.open', group: 'General', label: 'Open a PDF in the reader', keys: ['Alt-P'], run: () => openPdfPicker() },
  { id: 'tags.manage', group: 'General', label: 'Manage tags', keys: [], run: () => openTagManager() },
  { id: 'settings.open', group: 'General', label: 'Settings', keys: ['Mod-,'], run: () => openSettings() },
  { id: 'help.hotkeys', group: 'General', label: 'Show the hotkeys', keys: ['Shift-/'], run: () => openSettings('shortcuts') },
  { id: 'app.newWindow', group: 'General', label: 'New window (installed app)', keys: [], run: () => pwaNewWindow() },
  // Navigation and tabs
  { id: 'nav.back', group: 'Navigation and tabs', label: 'Go back', keys: ['Mod-Alt-ArrowLeft', 'Alt-ArrowLeft'], run: () => navGo(-1) },
  { id: 'nav.forward', group: 'Navigation and tabs', label: 'Go forward', keys: ['Mod-Alt-ArrowRight', 'Alt-ArrowRight'], run: () => navGo(1) },
  { id: 'tab.new', group: 'Navigation and tabs', label: 'New tab', keys: ['Mod-T', 'Alt-T'], run: () => newTab() },
  { id: 'tab.close', group: 'Navigation and tabs', label: 'Close tab', keys: ['Mod-W', 'Alt-W'], run: () => { const p = curPane(); closeTab(p, panes.list[p].active); } },
  { id: 'tab.reopen', group: 'Navigation and tabs', label: 'Open the last closed tab again', keys: ['Mod-Shift-T'], run: () => reopenClosedTab() },
  { id: 'tab.next', group: 'Navigation and tabs', label: 'Next tab', keys: ['Ctrl-Tab', 'Mod-Shift-]'], run: () => cycleTab(1) },
  { id: 'tab.prev', group: 'Navigation and tabs', label: 'Previous tab', keys: ['Ctrl-Shift-Tab', 'Mod-Shift-['], run: () => cycleTab(-1) },
  ...[1, 2, 3, 4, 5, 6, 7, 8].map((k) => ({ id: 'tab.go' + k, group: 'Navigation and tabs', label: 'Go to tab ' + k, keys: ['Mod-' + k, 'Alt-' + k], run: () => paneShortcut('Digit' + k) })),
  { id: 'tab.goLast', group: 'Navigation and tabs', label: 'Go to the last tab', keys: ['Mod-9', 'Alt-9'], run: () => paneShortcut('Digit9') },
  { id: 'split.toggle', group: 'Navigation and tabs', label: 'Split view on or off', keys: ['Mod-\\', 'Alt-\\'], run: () => toggleSplit() },
  { id: 'link.follow', group: 'Navigation and tabs', label: 'Follow the link at the cursor', keys: ['Alt-Enter'], editor: true, run: () => followLinkAtCursor(false) },
  { id: 'link.followTab', group: 'Navigation and tabs', label: 'Follow the link at the cursor in a new tab', keys: ['Alt-Shift-Enter'], editor: true, run: () => followLinkAtCursor(true) },
  // Editing
  { id: 'edit.bold', group: 'Editing', label: 'Bold', keys: ['Mod-B'], editor: true, run: edCmd(lpWrap('**')) },
  { id: 'edit.italic', group: 'Editing', label: 'Italic', keys: ['Mod-I'], editor: true, run: edCmd(lpWrap('*')) },
  { id: 'edit.highlight', group: 'Editing', label: 'Highlight', keys: ['Mod-Shift-H'], editor: true, run: edCmd(lpWrap('==')) },
  { id: 'edit.math', group: 'Editing', label: 'Inline mathematics', keys: ['Mod-M'], editor: true, run: edCmd(lpWrap('$')) },
  { id: 'edit.displayMath', group: 'Editing', label: 'Display mathematics', keys: ['Mod-Shift-M'], editor: true, run: edCmd(lpWrap('$$\n', '\n$$')) },
  { id: 'edit.link', group: 'Editing', label: 'Wrap as a link', keys: ['Mod-Shift-L'], editor: true, run: edCmd(lpWrap('[[', ']]')) },
  { id: 'edit.cloze', group: 'Editing', label: 'Wrap as a cloze deletion', keys: ['Mod-Shift-D'], editor: true, run: edCmd(lpWrap('{{c1::', '}}')) },
  { id: 'edit.blockLink', group: 'Editing', label: 'Copy a link to the block at the cursor', keys: [], editor: true, run: () => copyBlockLink() },
];
const HOTKEY_BY_ID = new Map(HOTKEY_COMMANDS.map((c) => [c.id, c]));

const CODE_KEY = { Backslash: '\\', BracketLeft: '[', BracketRight: ']', Comma: ',', Period: '.', Slash: '/', Semicolon: ';', Quote: "'", Minus: '-', Equal: '=', Backquote: '`', Space: 'Space', IntlBackslash: '\\' };
const MOD_ONLY = new Set(['Shift', 'Control', 'Alt', 'Meta', 'OS', 'AltGraph', 'CapsLock', 'Fn']);

/* The key part of an event: from the physical key for letters, digits and punctuation. */
function eventKeyName(e) {
  const c = e.code || '';
  if (/^Key[A-Z]$/.test(c)) return c.slice(3);
  if (/^Digit\d$/.test(c)) return c.slice(5);
  if (/^Numpad\d$/.test(c)) return c.slice(6);
  if (CODE_KEY[c]) return CODE_KEY[c];
  if (MOD_ONLY.has(e.key)) return null;
  return e.key.length === 1 ? e.key.toUpperCase() : e.key;
}
const isPrintableKey = (k) => k && (k.length === 1 || k === 'Space');

/* Build "Mod-Alt-Shift-K" from an event. On a Mac in a text field, Ctrl+Option+key counts as Option+key,
   because Option+key alone types a character there. */
function eventCombo(e, inField) {
  const key = eventKeyName(e); if (!key) return null;
  let mod = IS_MAC ? e.metaKey : e.ctrlKey; let ctrl = IS_MAC ? e.ctrlKey : false;
  if (IS_MAC && inField && e.altKey && e.ctrlKey && !e.metaKey) ctrl = false;
  const parts = [];
  if (mod) parts.push('Mod'); if (ctrl) parts.push('Ctrl'); if (e.altKey) parts.push('Alt'); if (e.shiftKey) parts.push('Shift');
  if (!IS_MAC && e.metaKey) parts.unshift('Meta');
  parts.push(key);
  return parts.join('-');
}
/* Write a key string in the one order that eventCombo makes. On Windows and Linux, Ctrl and Mod are the same key. */
function normCombo(s) {
  const toks = String(s).split('-'); let key = toks.pop(); if (key === '' && toks.length && toks[toks.length - 1] === '') { toks.pop(); key = '-'; }
  const set = new Set(toks.map((t) => (t === 'Cmd' || t === 'Command' ? 'Mod' : t === 'Option' ? 'Alt' : t === 'Control' ? 'Ctrl' : t)));
  if (!IS_MAC && set.has('Ctrl')) { set.delete('Ctrl'); set.add('Mod'); }
  const order = ['Meta', 'Mod', 'Ctrl', 'Alt', 'Shift'].filter((t) => set.has(t));
  return [...order, key.length === 1 ? key.toUpperCase() : key].join('-');
}
const KEY_GLYPH = { ArrowLeft: '←', ArrowRight: '→', ArrowUp: '↑', ArrowDown: '↓', Enter: IS_MAC ? '↩' : 'Enter', Backspace: IS_MAC ? '⌫' : 'Backspace', Delete: IS_MAC ? '⌦' : 'Delete', Escape: 'Esc', Tab: IS_MAC ? '⇥' : 'Tab', Space: 'Space' };
function comboLabel(s) {
  const toks = normCombo(s).split('-'); const key = toks.pop() || '-';
  const names = IS_MAC ? { Mod: '⌘', Ctrl: '⌃', Alt: '⌥', Shift: '⇧', Meta: 'Meta' } : { Mod: 'Ctrl', Ctrl: 'Ctrl', Alt: 'Alt', Shift: 'Shift', Meta: 'Win' };
  const mods = toks.map((t) => names[t] || t);
  const k = KEY_GLYPH[key] || key;
  return IS_MAC ? mods.join('') + k : [...mods, k].join('+');
}

function hotkeysOf(id) {
  const c = HOTKEY_BY_ID.get(id); if (!c) return [];
  const user = app.settings.hotkeys && app.settings.hotkeys[id];
  return (Array.isArray(user) ? user : c.keys).map(normCombo);
}
const hotkeyChanged = (id) => !!(app.settings.hotkeys && Array.isArray(app.settings.hotkeys[id]));
/* The label of the first key of a command, for menus. */
function hotkeyHint(id) { const k = hotkeysOf(id)[0]; return k ? comboLabel(k) : ''; }

let hotkeyIndex = null;
function rebuildHotkeyIndex() {
  hotkeyIndex = new Map();
  for (const c of HOTKEY_COMMANDS) for (const k of hotkeysOf(c.id)) { if (!hotkeyIndex.has(k)) hotkeyIndex.set(k, []); hotkeyIndex.get(k).push(c); }
}
function setHotkeys(id, keys) {
  const c = HOTKEY_BY_ID.get(id); const list = Array.from(new Set(keys.map(normCombo)));
  const def = c.keys.map(normCombo);
  app.settings.hotkeys = Object.assign({}, app.settings.hotkeys);
  if (list.length === def.length && list.every((k, i) => k === def[i])) delete app.settings.hotkeys[id];
  else app.settings.hotkeys[id] = list;
  saveSettings(); rebuildHotkeyIndex();
}

/* The one key listener. Returns true if it ran a command. */
function handleHotkey(e) {
  if (e.isComposing || e.repeat && !/^(Arrow|Tab)/.test(e.key)) return false;
  if (document.body.classList.contains('recording-hotkey')) return false;
  const ae = document.activeElement;
  const inEditor = !!(ae && ae.closest && ae.closest('.cm-editor'));
  const inField = inEditor || (!!ae && (/^(INPUT|TEXTAREA|SELECT)$/.test(ae.tagName) || ae.isContentEditable));
  const combo = eventCombo(e, inField); if (!combo) return false;
  if (!hotkeyIndex) rebuildHotkeyIndex();
  const cmds = hotkeyIndex.get(combo); if (!cmds) return false;
  const toks = combo.split('-'); const key = toks[toks.length - 1];
  const hasMod = toks.includes('Mod') || toks.includes('Ctrl');
  if (inField && !hasMod) {
    if (!toks.includes('Alt')) return false; // a bare key or Shift+key types text
    if (/^Arrow/.test(key)) return false; // Option+arrow moves by word
    if (IS_MAC && isPrintableKey(key) && !e.ctrlKey) return false; // Option+letter types a character on a Mac
  }
  for (const c of cmds) {
    if (app.overlays.length && !c.overlays) continue;
    if (c.editor && !inEditor) continue;
    if (c.run() === false) continue;
    e.preventDefault(); e.stopPropagation();
    return true;
  }
  return false;
}

/* ---------- Settings, Hotkeys ---------- */
function renderHotkeysPane() {
  const wrap = h('div', { class: 'hk-pane' });
  const search = h('input', { class: 'input', type: 'search', placeholder: 'Filter: a command or a key', 'aria-label': 'Filter hotkeys' });
  const onlyChanged = h('input', { type: 'checkbox' });
  const list = h('div', { class: 'hk-list' });
  let recording = null;
  const stopRecording = () => { if (recording) { window.removeEventListener('keydown', recording, true); recording = null; document.body.classList.remove('recording-hotkey'); } };
  const draw = () => {
    stopRecording();
    list.innerHTML = '';
    const q = search.value.trim().toLowerCase();
    const used = new Map(); for (const c of HOTKEY_COMMANDS) for (const k of hotkeysOf(c.id)) { if (!used.has(k)) used.set(k, []); used.get(k).push(c); }
    let group = null; let shown = 0;
    for (const c of HOTKEY_COMMANDS) {
      const keys = hotkeysOf(c.id);
      if (onlyChanged.checked && !hotkeyChanged(c.id)) continue;
      if (q && !c.label.toLowerCase().includes(q) && !keys.some((k) => comboLabel(k).toLowerCase().includes(q) || k.toLowerCase().includes(q))) continue;
      if (c.group !== group) { group = c.group; list.appendChild(h('div', { class: 'hk-group' }, group)); }
      shown++;
      const chips = keys.map((k) => {
        const clash = (used.get(k) || []).filter((o) => o !== c);
        const reserved = /^Mod-(Shift-)?[NTW]$/.test(k);
        return h('span', { class: 'hk-chip' + (clash.length ? ' clash' : ''), title: clash.length ? 'Also used by: ' + clash.map((o) => o.label).join(', ') : reserved ? 'In a browser tab, Chrome keeps this key. The installed app gets it.' : k },
          h('kbd', null, comboLabel(k)), reserved ? h('span', { class: 'hk-app' }, 'app') : null,
          h('button', { class: 'hk-x', title: 'Remove this key', 'aria-label': 'Remove ' + comboLabel(k), onclick: () => { setHotkeys(c.id, keys.filter((x) => x !== k)); draw(); } }, '×'));
      });
      const add = h('button', { class: 'hk-add', title: 'Add a key', 'aria-label': 'Add a key for ' + c.label }, '+');
      add.addEventListener('click', () => {
        stopRecording();
        add.textContent = 'Press the keys…'; add.classList.add('rec');
        document.body.classList.add('recording-hotkey');
        recording = (ev) => {
          if (!wrap.isConnected) { stopRecording(); return; }
          ev.preventDefault(); ev.stopPropagation();
          if (ev.key === 'Escape' && !ev.ctrlKey && !ev.metaKey && !ev.altKey && !ev.shiftKey) { draw(); return; }
          const combo = eventCombo(ev, false); if (!combo) return;
          setHotkeys(c.id, [...keys, combo]); draw();
          const clash = HOTKEY_COMMANDS.filter((o) => o !== c && hotkeysOf(o.id).includes(normCombo(combo)));
          if (clash.length) toast(`${comboLabel(combo)} is also the key for “${clash[0].label}”. Remove one of them.`, { kind: 'error', ms: 6000 });
        };
        window.addEventListener('keydown', recording, true);
      });
      list.appendChild(h('div', { class: 'hk-row' + (hotkeyChanged(c.id) ? ' changed' : '') },
        h('span', { class: 'hk-label' }, c.label, c.editor ? h('span', { class: 'hk-scope', title: 'Works while the cursor is in a note' }, 'editor') : null),
        h('span', { class: 'hk-keys' }, ...chips, add,
          h('button', { class: 'hk-reset', title: 'Back to the default keys', 'aria-label': 'Reset ' + c.label, disabled: !hotkeyChanged(c.id), onclick: () => { setHotkeys(c.id, c.keys); draw(); } }, '↺'))));
    }
    if (!shown) list.appendChild(h('p', { class: 'muted' }, 'No command matches.'));
  };
  search.addEventListener('input', draw);
  onlyChanged.addEventListener('change', draw);
  wrap.append(
    h('div', { class: 'hk-top' }, search, h('label', { class: 'check' }, onlyChanged, 'Changed only')),
    list,
    h('div', { class: 'hk-foot' },
      h('span', { class: 'muted small' }, IS_MAC ? 'In a text field, keys with ⌥ alone type characters; use ⌃⌥ there. Keys marked “app” work in the installed app, not in a Chrome tab.' : 'Keys marked “app” work in the installed app; in a browser tab, the browser keeps them.'),
      h('button', { class: 'btn btn-sm', onclick: async () => { if (await confirmDialog('Reset every hotkey?', 'All commands go back to their default keys.', 'Reset all', true)) { app.settings.hotkeys = {}; saveSettings(); rebuildHotkeyIndex(); draw(); } } }, 'Reset all')));
  draw();
  return wrap;
}
