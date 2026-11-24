/* Musubi application shell: state, layout, note page, sidebar, mentions, context panel. */

const ISTARI_ICONS = __ISTARI_ICONS__;
const PLAIN_ICONS = {
  plus: '<path d="M12 5v14M5 12h14"/>',
  back: '<path d="M15 18l-6-6 6-6"/>',
  fwd: '<path d="M9 18l6-6-6-6"/>',
  x: '<path d="M6 6l12 12M18 6L6 18"/>',
  more: '<circle cx="5" cy="12" r="1.2"/><circle cx="12" cy="12" r="1.2"/><circle cx="19" cy="12" r="1.2"/>',
  eye: '<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
  pen: '<path d="M4 20h4L19 9l-4-4L4 16z"/>',
  trash: '<path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/>',
  history: '<path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5M12 7v5l3 2"/>',
  copy: '<rect x="9" y="9" width="11" height="11" rx="1.5"/><path d="M5 15V5a2 2 0 0 1 2-2h8"/>',
  scissors: '<circle cx="6" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><path d="M8.1 8.1L20 20M8.1 15.9L20 4"/>',
  branch: '<circle cx="6" cy="5" r="2"/><circle cx="6" cy="19" r="2"/><circle cx="18" cy="9" r="2"/><path d="M6 7v10M18 11c0 4-6 3-11 6.5"/>',
  dice: '<rect x="3.5" y="3.5" width="17" height="17" rx="2.5"/><circle cx="8.5" cy="8.5" r="1"/><circle cx="15.5" cy="15.5" r="1"/><circle cx="12" cy="12" r="1"/>',
  gear: '<circle cx="12" cy="12" r="3.2"/><path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5.3 5.3l2.1 2.1M16.6 16.6l2.1 2.1M5.3 18.7l2.1-2.1M16.6 7.4l2.1-2.1"/>',
  source: '<path d="M8 6l-6 6 6 6M16 6l6 6-6 6"/>',
};
const icon = (name, size = 16) => `<svg class="ic" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ISTARI_ICONS[name] || PLAIN_ICONS[name] || ''}</svg>`;

const DEFAULT_MACROS = `% One macro per line:  \\name = expansion   (#1, #2 for arguments)
\\C = \\mathbb{C}
\\Q = \\mathbb{Q}
\\F = \\mathbb{F}
\\eps = \\varepsilon
\\dd = \\mathrm{d}
\\abs = \\left|#1\\right|
\\norm = \\left\\lVert#1\\right\\rVert
\\inner = \\left\\langle#1,#2\\right\\rangle
\\pd = \\frac{\\partial #1}{\\partial #2}
\\dv = \\frac{\\mathrm{d} #1}{\\mathrm{d} #2}
\\tr = \\operatorname{tr}
\\Hom = \\operatorname{Hom}
\\id = \\mathrm{id}
\\Lag = \\mathcal{L}`;

const DEFAULT_TEMPLATES = {
  concept: '',
  definition: ':::definition[{{title}}]\n\n:::\n\n## Intuition\n\n## Examples and non-examples\n',
  theorem: ':::theorem[{{title}}]\n\n:::\n\n:::proof\n\n:::\n\n## Why it is true, in one sentence\n',
  proof: ':::proof\n\n:::\n\n## Key idea\n',
  example: ':::example[{{title}}]\n\n:::\n',
  derivation: '## Setup\n\n## Derivation\n\n$$\n\\begin{aligned}\n\n\\end{aligned}\n$$\n\n## Result\n\n## Assumptions\n',
  law: ':::law[{{title}}]\n\n:::\n\n## Domain of validity\n\n## Evidence or derivation\n',
  argument: ':::argument[{{title}}]\nP1. \nP2. \nC. \n:::\n\n## Is it valid? Is it sound?\n',
  objection: ':::objection[{{title}}]\n\n:::\n\n## Replies\n',
  position: '## Thesis\n\n## For\n\n## Against\n',
  question: '## Why it matters\n\n## Candidate answers\n',
  literature: '## Summary, in my own words\n\n## Key claims\n\n## My response\n',
  person: '## Main ideas\n\n## Works\n',
  structure: '',
};

const DEFAULT_SETTINGS = {
  fontSize: 19, editorFontSize: 15, mode: 'live', width: 'istari',
  macros: DEFAULT_MACROS, autoNumber: true, autoCards: true, newPerDay: 20, spellcheck: true, linkStyle: 'title',
  sidebar: true, panel: false, lastNote: null, sidebarTab: 'notes', sort: 'modified', typeFilter: [],
  sections: { outline: true, relations: true, localgraph: true, info: false },
  templates: DEFAULT_TEMPLATES, recent: [], seeded: false, onboarded: false, tourSeen: 0, tour: null,
  attachLocation: 'folder', attachFolder: 'assets', attachSubfolder: 'assets',
  lsEnabled: true, lsDefaults: true, lsAutofraction: true, lsTabout: true, lsMatrix: true, lsEnlarge: true, lsEnlargeSpace: true, lsAutoDelete: true, lsSnippets: '', lsVariables: '',
};

const app = {
  settings: JSON.parse(JSON.stringify(DEFAULT_SETTINGS)),
  srs: {},
  current: null,
  dirty: false,
  cursor: new Map(),
  bc: null,
  folder: { handle: null, name: '', status: 'none' },
};

const cur = () => (app.current ? vault.get(app.current) : null);

/* ---------- toasts ---------- */
function toast(msg, opts = {}) {
  const root = $('#toasts'); if (!root) return;
  const el = h('div', { class: 'toast' + (opts.kind ? ' toast-' + opts.kind : '') }, h('span', null, msg));
  if (opts.action) el.appendChild(h('button', { class: 'btn btn-sm', onclick: () => { opts.action.run(); el.remove(); } }, opts.action.label));
  root.appendChild(el);
  setTimeout(() => el.classList.add('out'), opts.ms || 3200);
  setTimeout(() => el.remove(), (opts.ms || 3200) + 400);
}

/* ---------- settings persistence ---------- */
const saveSettings = debounce(() => { store.setMeta('settings', app.settings).catch(() => {}); }, 400);
const saveSrs = debounce(() => { store.setMeta('srs', app.srs).catch(() => {}); }, 400);

function applyTheme() {
  const s = app.settings; const root = document.documentElement;
  root.dataset.theme = 'istari';
  root.dataset.width = s.width;
  root.style.setProperty('--reading-size', s.fontSize + 'px');
  root.style.setProperty('--editor-size', s.editorFontSize + 'px');
  if (app.graphView) { app.graphView.readColors(); app.graphView.draw(); }
  if (app.localGraph) { app.localGraph.readColors(); app.localGraph.draw(); }
}

/* ---------- note lifecycle ---------- */
function newId() {
  const d = new Date();
  let id = `${d.getFullYear()}${pad2(d.getMonth() + 1)}${pad2(d.getDate())}${pad2(d.getHours())}${pad2(d.getMinutes())}${pad2(d.getSeconds())}`;
  while (vault.notes.has(id)) id = String(BigInt(id) + 1n);
  return id;
}

function createNote(fields = {}, opts = {}) {
  const now = isoLocal();
  const type = fields.type || 'concept';
  const title = (fields.title || 'Untitled').trim();
  let body = fields.body;
  if (body == null) body = (app.settings.templates[type] || '').replace(/\{\{title\}\}/g, title);
  const n = {
    id: fields.id || newId(), title, type, status: fields.status || 'draft',
    tags: fields.tags || [], aliases: fields.aliases || [], citekey: fields.citekey || '', author: fields.author || '',
    year: fields.year || '', source: fields.source || '', url: fields.url || '', doi: fields.doi || '',
    created: now, modified: now, extra: [], body,
  };
  vault.notes.set(n.id, n); vault.touch();
  persistNote(n, { snapshot: false });
  refreshLists();
  if (opts.open !== false) openNote(n.id, { focusTitle: opts.focusTitle, focusEditor: opts.focusEditor });
  return n;
}

async function persistNote(n, opts = {}) {
  try {
    if (opts.snapshot !== false) await maybeSnapshot(n);
    await store.putNote(n);
    if (app.folder.status === 'linked') await folderWrite(n);
    if (app.bc) app.bc.postMessage({ type: 'put', id: n.id });
    setSaveState('saved');
  } catch (e) {
    console.error(e);
    setSaveState('error');
    toast('Could not save: ' + e.message, { kind: 'error' });
  }
}

const lastSnap = new Map();
/* Keep the text as it was before this save, at most every five minutes per note. */
async function maybeSnapshot(n) {
  const t = lastSnap.get(n.id) || 0;
  if (Date.now() - t < 5 * 60 * 1000) return;
  const prev = await store.getNote(n.id);
  if (!prev || (prev.body === n.body && prev.title === n.title)) return;
  lastSnap.set(n.id, Date.now());
  await store.addHistory(n.id, serializeNote(prev));
}

const saveCurrent = debounce(() => {
  const n = cur(); if (!n || !app.dirty) return;
  n.modified = isoLocal(); app.dirty = false;
  setSaveState('saving');
  persistNote(n);
  refreshLists();
}, 650);

function markDirty() {
  app.dirty = true; setSaveState('dirty');
  vault.touch(); saveCurrent();
}

function setSaveState(s) {
  const el = $('#save-state'); if (!el) return;
  const map = { dirty: 'edited', saving: 'saving', saved: app.folder.status === 'linked' ? 'saved to folder' : 'saved', error: 'save failed' };
  el.textContent = map[s] || ''; el.dataset.state = s;
}

/* Replace the current note's text from outside the editor (rename, sync, restore). */
function syncEditorFromNote() {
  const n = cur(); if (!n) return;
  if (ed.getText() !== n.body) ed.setText(n.body);
  if (app.settings.mode === 'read') renderPreview();
}

async function deleteNote(id, ask = true) {
  const n = vault.get(id); if (!n) return;
  if (ask) {
    const back = (vault.index().back.get(id) || []).length;
    const ok = await confirmDialog(`Move “${n.title}” to the trash?`, back ? `${back} link(s) to this note will become unresolved. You can restore it from Settings, Data.` : 'You can restore it from Settings, Data.', 'Move to trash', true);
    if (!ok) return;
  }
  if (app.current === id) { saveCurrent.cancel(); app.dirty = false; }
  await store.putTrash(Object.assign(plainNote(n), { deletedAt: Date.now() }));
  await store.deleteNote(id);
  if (app.folder.status === 'linked') await folderRemove(n);
  vault.notes.delete(id); vault.touch(); ed.forget(id);
  if (app.bc) app.bc.postMessage({ type: 'del', id });
  app.settings.recent = app.settings.recent.filter((x) => x !== id); saveSettings();
  refreshLists();
  if (app.current === id) {
    app.current = null;
    const next = app.settings.recent.find((x) => vault.notes.has(x)) || (vault.all().sort(byModified)[0] || {}).id;
    if (next) openNote(next, { replace: true }); else showEmpty();
  }
  toast(`Moved “${n.title}” to the trash`, { action: { label: 'Undo', run: () => restoreFromTrash(id) } });
}

async function restoreFromTrash(id) {
  const all = await store.allTrash(); const rec = all.find((r) => r.id === id);
  if (!rec) return;
  delete rec.deletedAt;
  if (vault.notes.has(rec.id)) rec.id = newId();
  vault.notes.set(rec.id, rec); vault.touch();
  await persistNote(rec, { snapshot: false });
  await store.delTrash(id);
  refreshLists(); openNote(rec.id);
  toast(`Restored “${rec.title}”`);
}

const byModified = (a, b) => (a.modified < b.modified ? 1 : a.modified > b.modified ? -1 : 0);

/* ---------- rename with link maintenance ---------- */
function renameNote(n, newTitle, oldTitle) {
  newTitle = newTitle.trim() || 'Untitled';
  n.title = newTitle;
  if (!oldTitle || normTitle(oldTitle) === normTitle(newTitle)) return 0;
  vault.touch();
  const oldNorm = normTitle(oldTitle);
  const clash = vault.all().some((o) => o !== n && normTitle(o.title) === normTitle(newTitle));
  let changed = 0;
  for (const other of vault.all()) {
    if (!other.body.includes('[[')) continue;
    const mc = maskCode(other.body); let out = ''; let last = 0; let touched = false;
    const re = /(!?)\[\[([^\[\]\n|]+?)(?:\|([^\[\]\n]*?))?\]\]/g; let m;
    while ((m = re.exec(mc))) {
      const raw = other.body.substr(m.index + m[1].length + 2, m[2].length);
      const { target, heading } = splitTarget(raw);
      let label = m[3] != null ? other.body.substr(m.index + m[0].length - 2 - m[3].length, m[3].length) : null;
      let newTarget = null;
      if (target === n.id) { if (label != null && normTitle(label) === oldNorm) label = newTitle; else continue; newTarget = target; }
      else if (normTitle(target) === oldNorm && resolveTarget(target) !== null && resolveTarget(target) !== n.id) continue;
      else if (normTitle(target) === oldNorm) { newTarget = clash ? n.id : newTitle; if (clash && label == null) label = newTitle; }
      else continue;
      const rebuilt = `${m[1]}[[${newTarget}${heading ? '#' + heading : ''}${label != null ? '|' + label : ''}]]`;
      out += other.body.slice(last, m.index) + rebuilt; last = m.index + m[0].length; touched = true;
    }
    if (!touched) continue;
    other.body = out + other.body.slice(last);
    if (other.id !== n.id) { other.modified = isoLocal(); persistNote(other); ed.forget(other.id); }
    changed++;
  }
  vault.touch();
  if (changed && app.current) syncEditorFromNote();
  return changed;
}

/* ---------- layout ---------- */
function buildShell() {
  document.body.innerHTML = '';
  const side = h('aside', { id: 'sidebar' },
    h('div', { class: 'wco-bar', 'aria-hidden': 'true' }),
    h('div', { class: 'sb-head' },
      h('span', { class: 'wordmark', title: 'Musubi (結び): a knot, a tie' }, 'Musubi', h('span', { class: 'wordmark-kanji', lang: 'ja' }, '結び')),
      h('span', { class: 'sb-actions' },
        iconBtn('loupe', 'Find a note or run a command (Ctrl K)', () => openPalette(''), 'btn-search'),
        iconBtn('scroll', 'Quick capture to the inbox (Alt C)', () => captureDialog(), 'btn-capture'),
        iconBtn('plus', 'New note (Alt N)', () => newNoteDialog(), 'btn-new'))),
    h('div', { class: 'sb-filter' },
      h('input', { id: 'filter', type: 'search', placeholder: 'Filter', autocomplete: 'off', spellcheck: 'false', title: 'Words, tag:x, type:theorem, status:fleeting', oninput: debounce(renderSidebar, 120) }),
      h('select', { id: 'sort', title: 'Sort order', 'aria-label': 'Sort order', onchange: (e) => { app.settings.sort = e.target.value; saveSettings(); renderSidebar(); } },
        h('option', { value: 'modified' }, 'Edited'), h('option', { value: 'created' }, 'Created'),
        h('option', { value: 'title' }, 'Title'), h('option', { value: 'links' }, 'Links'))),
    h('nav', { class: 'sb-tabs', role: 'tablist' },
      ...[['notes', 'Notes'], ['tags', 'Tags'], ['inbox', 'Inbox'], ['maint', 'Maintain']].map(([k, l]) =>
        h('button', { class: 'sb-tab', 'data-tab': k, role: 'tab', onclick: () => { app.settings.sidebarTab = k; saveSettings(); renderSidebar(); } }, l, k === 'inbox' ? h('span', { class: 'count', id: 'inbox-count' }) : null))),
    h('div', { class: 'sb-listwrap' },
      h('div', { id: 'side-body', class: 'side-body' }),
      h('div', { class: 'type-key', id: 'type-key' },
        h('button', { class: 'key-fab', id: 'key-fab', 'aria-label': 'Type key', 'aria-expanded': 'false', html: icon('compass', 18) }),
        h('div', { class: 'key-pop', id: 'key-pop', role: 'dialog', 'aria-label': 'Type key', hidden: true }))),
    h('div', { class: 'sb-foot' },
      iconBtn('blackhole', 'Graph (Alt G)', () => openGraph(), 'btn-graph'),
      h('button', { class: 'icon-btn', id: 'btn-review', title: 'Review flashcards (Alt R)', 'aria-label': 'Review', onclick: () => openReview(), html: icon('hourglass') }, h('span', { class: 'badge', id: 'due-badge', hidden: true })),
      iconBtn('gear', 'Settings', () => openSettings(), 'btn-settings'),
      h('span', { class: 'sb-status', id: 'side-foot' })));

  const main = h('main', { id: 'main' },
    h('div', { class: 'mtop' },
      iconBtn('codex', 'Toggle the note list', toggleSidebar, 'btn-sidebar'),
      iconBtn('back', 'Back', () => navGo(-1), 'btn-back'),
      iconBtn('fwd', 'Forward', () => navGo(1), 'btn-fwd'),
      h('span', { class: 'mtop-crumb', id: 'crumb' }),
      h('span', { class: 'save-state', id: 'save-state' }),
      iconBtn('eye', 'Read or edit (Ctrl E)', () => setMode(app.settings.mode === 'read' ? 'live' : 'read'), 'btn-mode'),
      iconBtn('more', 'Note actions', (e) => openNoteMenu(e.currentTarget), 'btn-more'),
      iconBtn('spectacles', 'Outline, relations and local graph', togglePanel, 'btn-panel')),
    h('div', { id: 'note-scroll', class: 'note-scroll' },
      h('div', { id: 'note-view', class: 'page', hidden: true },
        h('textarea', { id: 'title', class: 'inline-title', rows: 1, placeholder: 'Title', spellcheck: 'true', autocomplete: 'off', 'aria-label': 'Title' }),
        h('div', { class: 'props', id: 'props' },
          h('span', { class: 'prop' }, h('span', { class: 'dot', id: 'type-dot' }),
            h('select', { id: 'type', title: 'Type', 'aria-label': 'Type' }, ...NOTE_TYPES.map(([k, l]) => h('option', { value: k }, l.toLowerCase())))),
          h('span', { class: 'prop-sep' }, '·'),
          h('select', { id: 'status', title: 'Status', 'aria-label': 'Status' }, ...STATUSES.map(([k, l]) => h('option', { value: k }, l.toLowerCase()))),
          h('span', { class: 'prop-sep' }, '·'),
          h('span', { class: 'tag-editor', id: 'tag-editor' }, h('input', { id: 'tag-input', placeholder: 'add tag', autocomplete: 'off', spellcheck: 'false', 'aria-label': 'Add tag' })),
          h('button', { class: 'link-btn props-more', id: 'details-toggle', onclick: toggleDetails, title: 'Aliases and source fields' }, 'more')),
        h('div', { class: 'details', id: 'details', hidden: true },
          detailField('aliases', 'Aliases', 'comma separated'), detailField('citekey', 'Citekey', 'gettier1963'),
          detailField('author', 'Author', 'Last, First and Last, First'), detailField('year', 'Year', ''),
          detailField('source', 'Source', 'journal, book'), detailField('url', 'URL', 'https://'), detailField('doi', 'DOI', '10.…'),
          h('div', { class: 'detail-id' }, h('span', null, 'ID'), h('code', { id: 'note-id', title: 'Click to copy a link to this note' }))),
        h('div', { id: 'cm-host', class: 'cm-host' }),
        h('article', { class: 'prose', id: 'preview', hidden: true }),
        h('section', { class: 'mentions', id: 'mentions' })),
      h('div', { id: 'empty-view', class: 'empty-view', hidden: true })));

  const panel = h('aside', { id: 'panel' });
  const shell = h('div', { id: 'app' }, side, main, panel, h('div', { id: 'scrim', onclick: () => { document.body.classList.remove('side-open', 'panel-open'); } }));
  document.body.appendChild(shell);
  document.body.appendChild(h('div', { id: 'overlays' }));
  document.body.appendChild(h('div', { id: 'toasts', role: 'status', 'aria-live': 'polite' }));
  document.body.appendChild(h('div', { id: 'hover-card', class: 'hover-card prose', hidden: true }));
  document.body.appendChild(h('div', { id: 'menu', class: 'menu', hidden: true, role: 'menu' }));
  document.body.appendChild(h('input', { type: 'file', id: 'file-input', multiple: true, hidden: true, accept: '.md,.markdown,.txt,.json,.zip,.bib,.png,.jpg,.jpeg,.gif,.svg,.webp' }));
  document.body.appendChild(h('input', { type: 'file', id: 'dir-input', multiple: true, hidden: true, webkitdirectory: true }));
}

function iconBtn(ic, title, fn, id) { return h('button', { class: 'icon-btn', title, 'aria-label': title, html: icon(ic, 17), onclick: fn, id: id || null }); }
function detailField(key, label, ph) {
  return h('label', { class: 'detail-field' }, h('span', null, label), h('input', { 'data-field': key, placeholder: ph, autocomplete: 'off', spellcheck: 'false' }));
}
const modKey = () => (/Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent) ? '⌘' : 'Ctrl');

function toggleSidebar() {
  if (window.innerWidth < 760) { document.body.classList.toggle('side-open'); return; }
  app.settings.sidebar = !app.settings.sidebar; saveSettings(); applyLayout();
}
function togglePanel() {
  if (window.innerWidth < 1100) { document.body.classList.toggle('panel-open'); if (document.body.classList.contains('panel-open')) renderPanel(); return; }
  app.settings.panel = !app.settings.panel; saveSettings(); applyLayout(); renderPanel();
}
function toggleDetails() { const d = $('#details'); d.hidden = !d.hidden; $('#details-toggle').textContent = d.hidden ? 'more' : 'less'; }
function applyLayout() {
  const a = $('#app');
  a.classList.toggle('no-sidebar', !app.settings.sidebar);
  a.classList.toggle('no-panel', !app.settings.panel);
  $('#main').dataset.mode = app.settings.mode;
  $('#btn-mode').innerHTML = icon(app.settings.mode === 'read' ? 'pen' : 'eye', 17);
  $('#btn-mode').title = app.settings.mode === 'read' ? 'Edit (Ctrl E)' : 'Read (Ctrl E)';
  $('#btn-panel').classList.toggle('on', !!app.settings.panel);
}
function setMode(mode) {
  const prev = app.settings.mode;
  app.settings.mode = mode; saveSettings();
  if (mode !== 'read' && mode !== ed.mode) ed.setMode(mode);
  applyLayout();
  const n = cur();
  $('#cm-host').hidden = mode === 'read'; $('#preview').hidden = mode !== 'read';
  if (mode === 'read') renderPreview();
  else if (n) { if (prev === 'read' || ed.getText() !== n.body) ed.load(n.id, n.body); ed.focus(); }
}

/* ---------- note page ---------- */
function showEmpty() {
  app.current = null;
  $('#note-view').hidden = true; const ev = $('#empty-view'); ev.hidden = false;
  $('#crumb').textContent = '';
  document.title = 'Musubi';
  ev.innerHTML = '';
  const fs = 'showDirectoryPicker' in window;
  const first = vault.notes.size === 0;
  ev.appendChild(h('div', { class: 'setup' },
    h('div', { class: 'setup-mark', html: icon('compass', 34) }),
    h('h1', { class: 'setup-title' }, first ? 'Begin your Zettelkasten' : 'No note is open'),
    h('p', { class: 'setup-lede' }, first
      ? 'The vault is empty and ready. Start with one idea in your own words, or bring notes you already have.'
      : 'Choose a note from the list, or make a new one.'),
    h('div', { class: 'setup-actions' },
      h('button', { class: 'btn btn-cta', id: 'setup-new', onclick: () => newNoteDialog() }, 'Write the first note'),
      first && fs ? h('button', { class: 'btn btn-outline', onclick: linkFolder }, 'Keep notes in a folder') : null,
      first ? h('button', { class: 'btn btn-outline', onclick: () => $('#file-input').click() }, 'Import notes') : null),
    first ? h('ul', { class: 'setup-list' },
      h('li', null, h('b', null, 'Folder.'), ' Each note becomes a Markdown file on your disk', fs ? '.' : ' (needs Chrome or Edge).'),
      h('li', null, h('b', null, 'Import.'), ' Markdown, an Obsidian vault as a ZIP, an Musubi backup, or BibTeX.'),
      h('li', null, h('b', null, 'Browser.'), ' Without a folder, notes stay in this browser. Export often.')) : null,
    h('p', { class: 'setup-foot' },
      h('button', { class: 'link-btn', onclick: () => startTour() }, 'Take the tour'), ' · ',
      h('button', { class: 'link-btn', onclick: () => openSettings('shortcuts') }, 'Syntax and shortcuts'))));
  renderPanel();
}

function openNote(id, opts = {}) {
  const n = vault.get(id);
  if (!n) { toast('Note not found'); return; }
  if (app.current && app.current !== id) {
    saveCurrent.flush();
    app.cursor.set(app.current, { top: $('#note-scroll').scrollTop });
  }
  app.current = id;
  app.settings.lastNote = id;
  app.settings.recent = [id, ...app.settings.recent.filter((x) => x !== id)].slice(0, 30);
  saveSettings();
  $('#empty-view').hidden = true; $('#note-view').hidden = false;
  fillHeader(n);
  const read = app.settings.mode === 'read';
  $('#cm-host').hidden = read; $('#preview').hidden = !read;
  ed.load(id, n.body);
  if (read) renderPreview();
  const c = app.cursor.get(id);
  $('#note-scroll').scrollTop = c ? c.top : 0;
  setSaveState('');
  navRecord(id, opts);
  document.title = n.title + ' · Musubi';
  highlightSidebar();
  renderMentions();
  renderPanel();
  document.body.classList.remove('side-open');
  if (opts.heading) setTimeout(() => scrollToHeading(opts.heading), 40);
  if (opts.focusTitle) { const t = $('#title'); t.focus(); t.select(); }
  else if (opts.focusEditor && !read) { ed.focus(); const len = ed.getText().length; ed.setSelection(len); }
}

function sizeTitle() { const t = $('#title'); t.style.height = 'auto'; t.style.height = t.scrollHeight + 'px'; }
/* Navigation history of our own. Embedded pages (an artifact frame, a srcdoc iframe) may
   refuse history.pushState and replaceState, so the address hash is a best-effort mirror only. */
const nav = { stack: [], idx: -1, moving: false };
function navRecord(id, opts = {}) {
  if (!nav.moving) {
    if (opts.replace && nav.idx >= 0) nav.stack[nav.idx] = id;
    else if (nav.stack[nav.idx] !== id) {
      nav.stack = nav.stack.slice(0, nav.idx + 1); nav.stack.push(id);
      if (nav.stack.length > 300) nav.stack.shift();
      nav.idx = nav.stack.length - 1;
    }
  }
  updateNavButtons();
  if (!opts.fromHash) setHash('n-' + id, !!opts.replace);
}
function navGo(d) {
  let j = nav.idx + d;
  while (j >= 0 && j < nav.stack.length && !vault.get(nav.stack[j])) j += d;
  if (j < 0 || j >= nav.stack.length) return;
  nav.idx = j; nav.moving = true;
  try { openNote(nav.stack[j]); } finally { nav.moving = false; }
  updateNavButtons();
}
function updateNavButtons() {
  const b = $('#btn-back'); const f = $('#btn-fwd');
  if (b) b.disabled = nav.idx <= 0;
  if (f) f.disabled = nav.idx >= nav.stack.length - 1;
}
function readHash() { try { return location.hash || ''; } catch (e) { return ''; } }
function setHash(want, replace) {
  try {
    if (readHash().slice(1) === want) return;
    if (replace) history.replaceState(null, '', '#' + want); else location.hash = want;
  } catch (e) { /* this frame does not allow changes to its address */ }
}
function clearHash() {
  try { if (readHash()) history.replaceState(null, '', location.pathname + location.search); } catch (e) { /* not allowed here */ }
}

function fillHeader(n) {
  $('#title').value = n.title; requestAnimationFrame(sizeTitle);
  const ts = $('#type');
  if (!TYPE_IDS.includes(n.type) && !$$('option', ts).some((o) => o.value === n.type)) ts.appendChild(h('option', { value: n.type }, n.type));
  ts.value = n.type;
  $('#type-dot').className = 'dot t-' + n.type;
  const ss = $('#status');
  if (!STATUS_IDS.includes(n.status) && !$$('option', ss).some((o) => o.value === n.status)) ss.appendChild(h('option', { value: n.status }, n.status));
  ss.value = n.status; ss.dataset.status = n.status;
  $('#note-id').textContent = n.id;
  $('#crumb').textContent = TYPE_LABEL[n.type] || n.type;
  renderTagChips(n);
  for (const inp of $$('#details input')) {
    const k = inp.dataset.field;
    inp.value = k === 'aliases' ? (n.aliases || []).join(', ') : (n[k] || '');
  }
  const show = n.type === 'literature' || !!n.citekey;
  $('#details').hidden = !show; $('#details-toggle').textContent = show ? 'less' : 'more';
}

function renderTagChips(n) {
  const edt = $('#tag-editor'); const inp = $('#tag-input');
  $$('.chip', edt).forEach((c) => c.remove());
  for (const t of n.tags) {
    edt.insertBefore(h('span', { class: 'chip' }, '#' + t, h('button', { class: 'chip-x', title: 'Remove tag', 'aria-label': 'Remove tag ' + t, onclick: () => {
      n.tags = n.tags.filter((x) => x !== t); renderTagChips(n); markDirty(); refreshLists();
    } }, '×')), inp);
  }
}

function bindNoteView() {
  ed.init($('#cm-host'), () => {
    const n = cur(); if (!n) return;
    n.body = ed.getText(); markDirty();
    renderMentionsSoon(); renderPanelSoon();
  });
  let titleAtFocus = null;
  const title = $('#title');
  title.addEventListener('focus', () => { titleAtFocus = cur() ? cur().title : null; });
  title.addEventListener('input', () => { if (/\n/.test(title.value)) title.value = title.value.replace(/\n/g, ' '); sizeTitle(); const n = cur(); if (!n) return; n.title = title.value; document.title = n.title + ' · Musubi'; markDirty(); refreshListsSoon(); });
  const commitTitle = () => {
    const n = cur(); if (!n || titleAtFocus == null) return;
    const old = titleAtFocus; titleAtFocus = n.title;
    const k = renameNote(n, title.value, old);
    if (title.value.trim() === '') title.value = n.title;
    markDirty(); refreshLists(); renderMentions(); renderPanel();
    const twin = vault.all().find((o) => o !== n && normTitle(o.title) === normTitle(n.title));
    if (twin) toast(`Another note has this title. Links to this note use its ID.`, { kind: 'error', ms: 6000 });
    else if (k) toast(`Updated links in ${k} note${k > 1 ? 's' : ''}`);
  };
  title.addEventListener('change', commitTitle);
  title.addEventListener('keydown', (e) => { if (e.key === 'Enter' || (e.key === 'ArrowDown' && !e.shiftKey)) { e.preventDefault(); commitTitle(); if (app.settings.mode !== 'read') { ed.focus(); ed.setSelection(0); } } });
  $('#type').addEventListener('change', (e) => {
    const n = cur(); if (!n) return;
    const old = n.type; n.type = e.target.value; $('#type-dot').className = 'dot t-' + n.type; $('#crumb').textContent = TYPE_LABEL[n.type] || n.type;
    markDirty(); refreshLists();
    const oldT = (app.settings.templates[old] || '').replace(/\{\{title\}\}/g, n.title).trim();
    if ((!n.body.trim() || n.body.trim() === oldT) && app.settings.templates[n.type] != null) {
      n.body = app.settings.templates[n.type].replace(/\{\{title\}\}/g, n.title); syncEditorFromNote();
    }
    if (n.type === 'literature') { $('#details').hidden = false; $('#details-toggle').textContent = 'less'; }
    if (app.settings.mode === 'read') renderPreview();
  });
  $('#status').addEventListener('change', (e) => { const n = cur(); if (!n) return; n.status = e.target.value; e.target.dataset.status = n.status; markDirty(); refreshLists(); });
  const tagInput = $('#tag-input');
  const addTag = () => {
    const n = cur(); if (!n) return;
    const vals = tagInput.value.split(/[,\s]+/).map((t) => t.replace(/^#/, '').trim()).filter(Boolean);
    let changed = false;
    for (const v of vals) if (!n.tags.includes(v)) { n.tags.push(v); changed = true; }
    tagInput.value = '';
    if (changed) { renderTagChips(n); markDirty(); refreshLists(); }
  };
  tagInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); addTag(); }
    else if (e.key === 'Backspace' && !tagInput.value) { const n = cur(); if (n && n.tags.length) { n.tags.pop(); renderTagChips(n); markDirty(); refreshLists(); } }
  });
  tagInput.addEventListener('blur', addTag);
  for (const inp of $$('#details input')) {
    inp.addEventListener('input', () => {
      const n = cur(); if (!n) return; const k = inp.dataset.field;
      if (k === 'aliases') n.aliases = inp.value.split(',').map((x) => x.trim()).filter(Boolean);
      else n[k] = inp.value.trim();
      markDirty();
    });
  }
  $('#note-id').addEventListener('click', () => { const n = cur(); if (n) copyText(linkText(n), 'Link copied: ' + linkText(n)); });

  const pv = $('#preview');
  pv.addEventListener('click', onRenderedClick);
  pv.addEventListener('change', (e) => {
    const cb = e.target.closest('input[type=checkbox][data-task]'); if (!cb) return;
    toggleTask(+cb.dataset.task, cb.checked);
  });
  pv.addEventListener('dblclick', (e) => { if (!e.target.closest('a,input')) setMode('live'); });
  $('#mentions').addEventListener('click', (e) => { if (e.target.closest('.mn-ctx')) onRenderedClick(e); });
  bindHoverPreview(document.body);
  bindTypeKey();
}

function onRenderedClick(e) {
  const a = e.target.closest('a'); if (!a) return;
  if (a.classList.contains('wl') || a.classList.contains('cite-ref')) {
    e.preventDefault();
    hideHoverCard();
    if (a.dataset.id) { openNote(a.dataset.id, { heading: a.dataset.heading }); return; }
    if (a.dataset.target) { createFromBroken(a.dataset.target); return; }
    if (a.dataset.cite) { newNoteDialog({ title: a.dataset.cite, type: 'literature', citekey: a.dataset.cite }); return; }
  }
  if (a.classList.contains('tag')) { e.preventDefault(); filterByTag(a.dataset.tag); return; }
  if (a.dataset.anchor) {
    e.preventDefault();
    const el = document.getElementById(a.dataset.anchor);
    if (el) { el.scrollIntoView({ behavior: 'smooth', block: 'center' }); flash(el.closest('.math-display, li, sup') || el); }
  }
}

function flash(el) { el.classList.remove('flash'); void el.offsetWidth; el.classList.add('flash'); }
function createFromBroken(target) { newNoteDialog({ title: target }); }

function filterByTag(tag) {
  app.settings.sidebarTab = 'notes';
  $('#filter').value = 'tag:' + tag;
  if (window.innerWidth < 760) document.body.classList.add('side-open');
  else if (!app.settings.sidebar) { app.settings.sidebar = true; applyLayout(); }
  renderSidebar();
}

function toggleTask(k, checked) {
  const n = cur(); if (!n) return;
  const mc = maskCode(n.body); const re = /^(\s*(?:[-*+]|\d+[.)])\s+)\[([ xX])\]/gm; let m; let i = 0;
  while ((m = re.exec(mc))) {
    if (i === k) {
      const pos = m.index + m[1].length + 1;
      n.body = n.body.slice(0, pos) + (checked ? 'x' : ' ') + n.body.slice(pos + 1);
      syncEditorFromNote(); markDirty();
      return;
    }
    i++;
  }
}

function scrollToHeading(slug) {
  const n = cur(); if (!n) return;
  if (app.settings.mode === 'read') {
    const el = $(`#preview [data-slug="${CSS.escape(slug)}"]`);
    if (el) { el.scrollIntoView({ behavior: 'smooth', block: 'start' }); flash(el); }
    return;
  }
  const lines = n.body.split('\n'); let pos = 0;
  for (const l of lines) {
    const m = /^#{1,6}\s+(.+?)\s*#*$/.exec(l);
    if (m && slugify(m[1]) === slug) {
      ed.view.dispatch({ selection: { anchor: pos }, effects: CM.EditorView.scrollIntoView(pos, { y: 'start', yMargin: 60 }) });
      return;
    }
    pos += l.length + 1;
  }
}

function renderPreview() {
  const n = cur(); if (!n) return;
  if (app.settings.mode !== 'read') return;
  const pv = $('#preview');
  let body;
  try { body = renderMarkdown(n.body, { note: n }); }
  catch (e) { console.error(e); body = `<pre class="render-error">Render error: ${esc(e.message)}</pre>`; }
  pv.innerHTML = body;
  enhanceRendered(pv, 'n' + n.id + '-');
}
const renderPreviewSoon = debounce(renderPreview, 140);

/* ---------- note actions menu ---------- */
function openMenu(anchor, items) {
  const m = $('#menu'); m.innerHTML = '';
  for (const it of items) {
    if (it === '-') { m.appendChild(h('div', { class: 'menu-sep' })); continue; }
    m.appendChild(h('button', { class: 'menu-item' + (it.danger ? ' danger' : ''), role: 'menuitem', onclick: () => { closeMenu(); it.run(); } },
      h('span', { class: 'menu-ic', html: it.icon ? icon(it.icon, 15) : '' }), h('span', { class: 'menu-label' }, it.label), it.keys ? h('kbd', null, it.keys) : null));
  }
  m.hidden = false;
  const r = anchor.getBoundingClientRect();
  m.style.top = (r.bottom + 6) + 'px';
  m.style.left = Math.max(8, Math.min(window.innerWidth - m.offsetWidth - 8, r.right - m.offsetWidth)) + 'px';
  setTimeout(() => document.addEventListener('mousedown', menuOutside, true), 0);
}
function menuOutside(e) { if (!$('#menu').contains(e.target)) closeMenu(); }
function closeMenu() { $('#menu').hidden = true; document.removeEventListener('mousedown', menuOutside, true); }
function openNoteMenu(anchor) {
  const c = cur();
  const items = [];
  if (c) items.push(
    { icon: 'chainout', label: 'Add a link', run: () => addLinkDialog() },
    { icon: 'branch', label: 'Branch a new note from this one', keys: 'Alt B', run: branchNote },
    { icon: 'scissors', label: 'Extract the selection to a new note', run: extractSelection },
    '-',
    { icon: 'hourglass', label: 'Study the cards in this note', run: () => openReview({ noteId: c.id }) },
    { icon: 'blackhole', label: 'Local graph', run: () => openGraph({ focus: c.id, depth: 2 }) },
    { icon: 'history', label: 'Version history', run: openHistory },
    '-',
    { icon: 'source', label: app.settings.mode === 'source' ? 'Live preview' : 'Source mode', run: () => setMode(app.settings.mode === 'source' ? 'live' : 'source') },
    { icon: 'copy', label: 'Copy as Markdown', run: () => copyText(serializeNote(c), 'Markdown copied') },
    { icon: 'trash', label: 'Move to trash', danger: true, run: () => deleteNote(c.id) });
  else items.push({ icon: 'plus', label: 'New note', run: () => newNoteDialog() });
  openMenu(anchor, items);
}

/* ---------- type key (floating, opens on a short hover) ---------- */
function bindTypeKey() {
  const wrap = $('#type-key'); const fab = $('#key-fab'); const pop = $('#key-pop');
  let openT = null; let closeT = null;
  const open = () => { renderTypeKey(); pop.hidden = false; fab.setAttribute('aria-expanded', 'true'); wrap.classList.add('open'); };
  const close = () => { pop.hidden = true; fab.setAttribute('aria-expanded', 'false'); wrap.classList.remove('open'); };
  wrap.addEventListener('mouseenter', () => { clearTimeout(closeT); openT = setTimeout(open, 450); });
  wrap.addEventListener('mouseleave', () => { clearTimeout(openT); closeT = setTimeout(close, 300); });
  fab.addEventListener('click', () => (pop.hidden ? open() : close()));
  fab.addEventListener('keydown', (e) => { if (e.key === 'Escape') close(); });
}
function renderTypeKey() {
  const pop = $('#key-pop'); pop.innerHTML = '';
  const counts = {}; for (const n of vault.notes.values()) counts[n.type] = (counts[n.type] || 0) + 1;
  pop.appendChild(h('div', { class: 'key-title' }, 'Type key'));
  for (const [, label, , ids] of TYPE_FAMILIES) {
    pop.appendChild(h('div', { class: 'key-family' }, label));
    for (const id of ids) {
      const on = app.settings.typeFilter.includes(id);
      pop.appendChild(h('button', { class: 'key-row' + (on ? ' on' : ''), title: 'Show only this type (click again to clear)', onclick: () => {
        const f = app.settings.typeFilter; app.settings.typeFilter = on ? f.filter((x) => x !== id) : [...f, id];
        saveSettings(); app.settings.sidebarTab = 'notes'; renderSidebar(); renderTypeKey();
      } }, h('span', { class: 'dot t-' + id }), h('span', { class: 'key-label' }, TYPE_LABEL[id]), h('span', { class: 'count' }, counts[id] ? String(counts[id]) : '')));
    }
  }
  if (app.settings.typeFilter.length) pop.appendChild(h('button', { class: 'link-btn key-clear', onclick: () => { app.settings.typeFilter = []; saveSettings(); renderSidebar(); renderTypeKey(); } }, 'Clear the filter'));
  pop.appendChild(h('div', { class: 'key-foot' }, 'Shape shows the field; colour shows the kind.'));
}

/* ---------- hover previews ---------- */
let hoverTimer = null; let hoverFor = null;
function bindHoverPreview(root) {
  root.addEventListener('mouseover', (e) => {
    const a = e.target.closest && e.target.closest('a.wl[data-id], a.cite-ref[data-id], .side-item[data-id]');
    if (!a || a === hoverFor) return;
    if (a.classList.contains('side-item') && !e.altKey) return;
    hoverFor = a; clearTimeout(hoverTimer);
    hoverTimer = setTimeout(() => showHoverCard(a), 520);
  });
  root.addEventListener('mouseout', (e) => {
    const a = e.target.closest && e.target.closest('a.wl[data-id], a.cite-ref[data-id], .side-item[data-id]');
    if (!a) return;
    if (e.relatedTarget && (a.contains(e.relatedTarget) || $('#hover-card').contains(e.relatedTarget))) return;
    clearTimeout(hoverTimer); hoverFor = null;
    setTimeout(() => { if (!hoverFor && !$('#hover-card').matches(':hover')) hideHoverCard(); }, 200);
  });
  $('#hover-card').addEventListener('mouseleave', () => { if (!hoverFor) hideHoverCard(); });
  $('#hover-card').addEventListener('click', (e) => { onRenderedClick(e); });
}
function showHoverCard(a) {
  if (!document.body.contains(a)) return;
  const n = vault.get(a.dataset.id); if (!n) return;
  const card = $('#hover-card');
  let body = stripTitleHeading(n.body, n.title);
  if (a.dataset.heading) { const sec = extractSection(n.body, a.dataset.heading.replace(/-/g, ' ')); if (sec) body = sec; }
  if (body.length > 2200) body = body.slice(0, 2200) + '\n\n…';
  card.innerHTML = `<div class="hc-head"><span class="dot t-${esc(n.type)}"></span><span class="hc-title">${esc(n.title)}</span><span class="hc-type">${esc(TYPE_LABEL[n.type] || n.type)}</span></div>` +
    (body.trim() ? renderMarkdown(body, { note: n, depth: 2, idPrefix: 'hc-' }) : '<p class="muted"><i>Empty note.</i></p>');
  enhanceRendered(card, 'hc-');
  card.hidden = false;
  const r = a.getBoundingClientRect(); const cw = card.offsetWidth; const ch = card.offsetHeight;
  const left = Math.min(window.innerWidth - cw - 12, Math.max(12, r.left));
  let top = r.bottom + 8; if (top + ch > window.innerHeight - 12) top = Math.max(12, r.top - ch - 8);
  card.style.left = left + 'px'; card.style.top = top + 'px';
}
function hideHoverCard() { const c = $('#hover-card'); if (c) c.hidden = true; hoverFor = null; }

/* ---------- search ---------- */
function parseQuery(q) {
  const out = { terms: [], phrases: [], neg: [], tags: [], types: [], statuses: [] };
  const re = /(-?)(?:(tag|type|status|is):("[^"]*"|\S+)|"([^"]+)"|(\S+))/g; let m;
  while ((m = re.exec(q))) {
    const neg = !!m[1];
    if (m[2]) {
      const v = m[3].replace(/^"|"$/g, '').replace(/^#/, '').toLowerCase();
      const key = m[2] === 'is' ? 'statuses' : m[2] === 'tag' ? 'tags' : m[2] + 's';
      out[key].push({ v, neg });
    } else if (m[4]) (neg ? out.neg : out.phrases).push(fold(m[4]));
    else if (m[5]) (neg ? out.neg : out.terms).push(fold(m[5]));
  }
  return out;
}
const fold = (s) => String(s).normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase();

function noteLc(n) {
  if (n._lc && n._lcBody === n.body && n._lcTitle === n.title) return n._lc;
  n._lc = { title: fold(n.title), body: fold(n.body), aliases: (n.aliases || []).map(fold), tags: noteTags(n).map((t) => t.toLowerCase()) };
  n._lcBody = n.body; n._lcTitle = n.title;
  return n._lc;
}

function searchNotes(q, limit = 200) {
  const pq = parseQuery(q);
  const res = [];
  for (const n of vault.notes.values()) {
    const lc = noteLc(n);
    let ok = true;
    for (const f of pq.tags) { const has = lc.tags.some((t) => t === f.v || t.startsWith(f.v + '/')); if (has === f.neg) { ok = false; break; } }
    if (!ok) continue;
    for (const f of pq.types) if ((n.type === f.v) === f.neg) { ok = false; break; }
    if (!ok) continue;
    for (const f of pq.statuses) if ((n.status === f.v) === f.neg) { ok = false; break; }
    if (!ok) continue;
    let score = 0; let firstHit = -1;
    for (const t of pq.terms) {
      let s = 0;
      if (lc.title.includes(t)) s += lc.title.startsWith(t) ? 14 : 9;
      if (lc.aliases.some((a) => a.includes(t))) s += 6;
      if (lc.tags.some((x) => x.includes(t))) s += 4;
      const bi = lc.body.indexOf(t);
      if (bi >= 0) { s += 1 + Math.min(4, countOcc(lc.body, t) * 0.5); if (firstHit < 0) firstHit = bi; }
      if (!s) { ok = false; break; }
      score += s;
    }
    if (!ok) continue;
    for (const p of pq.phrases) {
      const inT = lc.title.includes(p); const bi = lc.body.indexOf(p);
      if (!inT && bi < 0) { ok = false; break; }
      score += inT ? 10 : 3; if (bi >= 0 && firstHit < 0) firstHit = bi;
    }
    if (!ok) continue;
    for (const ng of pq.neg) if (lc.title.includes(ng) || lc.body.includes(ng)) { ok = false; break; }
    if (!ok) continue;
    res.push({ note: n, score, hit: firstHit });
  }
  const hasText = pq.terms.length || pq.phrases.length;
  res.sort((a, b) => (hasText ? b.score - a.score : 0) || byModified(a.note, b.note));
  return res.slice(0, limit);
}
function countOcc(s, t) { let c = 0; let i = 0; while ((i = s.indexOf(t, i)) >= 0 && c < 20) { c++; i += t.length; } return c; }

function snippetAt(n, hit, len = 140) {
  if (hit < 0) return '';
  const a = Math.max(0, hit - 50); const s = n.body.slice(a, a + len).replace(/\s+/g, ' ');
  return (a > 0 ? '…' : '') + s + (a + len < n.body.length ? '…' : '');
}

function quickFind(q, limit = 12) {
  const fq = fold(q.trim());
  const all = vault.all();
  if (!fq) {
    const rec = app.settings.recent.map((id) => vault.get(id)).filter(Boolean);
    const rest = all.filter((n) => !rec.includes(n)).sort(byModified);
    return [...rec, ...rest].slice(0, limit);
  }
  const scored = [];
  for (const n of all) {
    const lc = noteLc(n);
    let s = fuzzyScore(lc.title, fq);
    for (const a of lc.aliases) s = Math.max(s, fuzzyScore(a, fq) * 0.9);
    if (n.citekey && n.citekey.toLowerCase().includes(fq)) s = Math.max(s, 50);
    if (n.id.startsWith(fq)) s = Math.max(s, 60);
    if (s > 0) scored.push([s, n]);
  }
  scored.sort((a, b) => b[0] - a[0] || byModified(a[1], b[1]));
  return scored.slice(0, limit).map((x) => x[1]);
}
function fuzzyScore(text, q) {
  if (!q) return 1;
  const i = text.indexOf(q);
  if (i >= 0) {
    const wordStart = i === 0 || !/[\p{L}\p{N}]/u.test(text[i - 1]);
    return 100 - Math.min(40, i) + (i === 0 ? 20 : 0) + (wordStart ? 10 : 0) + (text.length === q.length ? 30 : 0);
  }
  const qq = q.replace(/\s+/g, '');
  if (qq.length < 2) return 0;
  let ti = 0; let score = 0; let prev = -2;
  for (const ch of qq) {
    let j = -1;
    if (prev >= 0 && text[prev + 1] === ch) j = prev + 1;
    else {
      for (let k = Math.max(ti, prev + 1); k < text.length; k++) {
        if (text[k] === ch && (k === 0 || !/[\p{L}\p{N}]/u.test(text[k - 1]))) { j = k; break; }
      }
    }
    if (j < 0) return 0;
    score += j === prev + 1 ? 3 : 5;
    prev = j; ti = j + 1;
  }
  return Math.min(60, score);
}

/* ---------- sidebar ---------- */
const refreshLists = () => { renderSidebar(); updateDueBadge(); };
const refreshListsSoon = debounce(refreshLists, 300);

function renderSidebar() {
  const tab = app.settings.sidebarTab;
  $$('.sb-tab').forEach((b) => b.classList.toggle('on', b.dataset.tab === tab));
  const body = $('#side-body'); body.innerHTML = '';
  $('.sb-filter').hidden = tab !== 'notes';
  const inboxN = vault.all().filter((n) => n.status === 'fleeting').length;
  $('#inbox-count').textContent = inboxN ? String(inboxN) : '';
  $('#sort').value = app.settings.sort;
  if (tab === 'notes') renderNoteList(body);
  else if (tab === 'tags') renderTagTree(body);
  else if (tab === 'inbox') renderInbox(body);
  else renderMaintenance(body);
  const foot = $('#side-foot');
  const where = app.folder.status === 'linked' ? `folder ${app.folder.name}` : app.folder.status === 'needs-permission' ? 'folder disconnected' : store.mode === 'idb' ? 'this browser' : 'memory only';
  foot.innerHTML = '';
  foot.appendChild(h('span', { title: 'Where the notes are kept' }, `${vault.notes.size} · ${where}`));
  if (app.folder.status === 'needs-permission') foot.appendChild(h('button', { class: 'link-btn', onclick: reconnectFolder }, 'reconnect'));
  if (typeof updateFolderBanner === 'function') updateFolderBanner();
  if (store.mode === 'memory') foot.appendChild(h('button', { class: 'link-btn', title: 'Browser storage is blocked here. Export often.', onclick: () => openSettings('data') }, 'export'));
  $('#key-fab').classList.toggle('filtering', app.settings.typeFilter.length > 0);
  highlightSidebar();
}

function sideItem(n, extra) {
  return h('div', { class: 'side-item' + (n.id === app.current ? ' on' : ''), 'data-id': n.id, tabindex: '0', role: 'button',
    onclick: () => openNote(n.id), onkeydown: (e) => { if (e.key === 'Enter') openNote(n.id); } },
  h('span', { class: 'dot t-' + n.type, title: TYPE_LABEL[n.type] || n.type }),
  h('div', { class: 'si-main' },
    h('div', { class: 'si-title' }, n.title || 'Untitled', n.status === 'fleeting' ? h('span', { class: 'si-flag' }, 'fleeting') : null),
    extra ? h('div', { class: 'si-sub' }, extra) : null));
}

function renderNoteList(body) {
  const q = $('#filter').value.trim();
  let res = searchNotes(q, 100000);
  const tf = app.settings.typeFilter;
  if (tf.length) res = res.filter((r) => tf.includes(r.note.type));
  const hasText = /\S/.test(q.replace(/(-?)(tag|type|status|is):\S+/g, ''));
  if (!hasText) {
    const s = app.settings.sort; const idx = vault.index();
    const cmp = s === 'title' ? (a, b) => a.note.title.localeCompare(b.note.title)
      : s === 'created' ? (a, b) => (a.note.created < b.note.created ? 1 : -1)
      : s === 'links' ? (a, b) => ((idx.back.get(b.note.id) || []).length - (idx.back.get(a.note.id) || []).length)
      : (a, b) => byModified(a.note, b.note);
    res.sort(cmp);
  }
  if (tf.length) body.appendChild(h('div', { class: 'side-filter-note' }, 'Showing ' + tf.map((t) => TYPE_LABEL[t].toLowerCase()).join(', '),
    h('button', { class: 'link-btn', onclick: () => { app.settings.typeFilter = []; saveSettings(); renderSidebar(); } }, 'clear')));
  if (!res.length) {
    body.appendChild(h('div', { class: 'side-empty' }, q || tf.length ? 'No notes match.' : vault.notes.size ? 'No notes.' : 'No notes yet. Your first note will appear here.'));
    return;
  }
  const frag = document.createDocumentFragment();
  const max = 600;
  for (const r of res.slice(0, max)) frag.appendChild(sideItem(r.note, hasText && r.hit >= 0 ? snippetAt(r.note, r.hit, 90) : ''));
  body.appendChild(frag);
  if (res.length > max) body.appendChild(h('div', { class: 'side-empty' }, `${res.length - max} more. Refine the filter.`));
}

function renderTagTree(body) {
  const idx = vault.index();
  const tags = Array.from(idx.tagCount.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  if (!tags.length) { body.appendChild(h('div', { class: 'side-empty' }, 'No tags yet. Write #tag in a note, or add one under the title.')); return; }
  const tree = {};
  for (const [t, c] of tags) {
    let node = tree; const parts = t.split('/'); let path = '';
    for (const p of parts) { path = path ? path + '/' + p : p; node[p] = node[p] || { _path: path, _count: 0, _kids: {} }; if (path === t) node[p]._count = c; node = node[p]._kids; }
  }
  const renderLevel = (obj, depth) => {
    const box = h('div', { class: 'tag-level' });
    for (const k of Object.keys(obj).sort()) {
      const nd = obj[k];
      box.appendChild(h('button', { class: 'tag-row', style: { paddingLeft: (12 + depth * 14) + 'px' }, onclick: () => filterByTag(nd._path) },
        h('span', { class: 'tag-name' }, '#' + k), h('span', { class: 'count' }, nd._count ? String(nd._count) : '')));
      if (Object.keys(nd._kids).length) box.appendChild(renderLevel(nd._kids, depth + 1));
    }
    return box;
  };
  body.appendChild(renderLevel(tree, 0));
}

function renderInbox(body) {
  const ta = h('textarea', { class: 'inbox-capture', placeholder: 'Capture a thought. The first line is the title. Ctrl+Enter saves.', rows: 3 });
  ta.addEventListener('keydown', (e) => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); if (captureText(ta.value)) ta.value = ''; } });
  body.appendChild(h('div', { class: 'inbox-head' }, ta, h('button', { class: 'btn btn-sm btn-outline', onclick: () => { if (captureText(ta.value)) ta.value = ''; } }, 'Capture')));
  const list = vault.all().filter((n) => n.status === 'fleeting').sort((a, b) => (a.created < b.created ? 1 : -1));
  body.appendChild(h('div', { class: 'side-hint' }, list.length ? 'Rewrite each one in your own words, link it, then mark it permanent.' : 'The inbox is empty.'));
  for (const n of list) body.appendChild(sideItem(n, relTime(parseDate(n.created))));
}

function renderMaintenance(body) {
  const idx = vault.index();
  const section = (title, items, hint) => {
    body.appendChild(h('div', { class: 'side-section' }, h('span', null, title), h('span', { class: 'count' }, String(items.length))));
    if (hint && items.length) body.appendChild(h('div', { class: 'side-hint' }, hint));
    for (const it of items.slice(0, 80)) body.appendChild(it);
    if (!items.length) body.appendChild(h('div', { class: 'side-empty small' }, 'None.'));
  };
  const orphans = vault.all().filter((n) => !(idx.back.get(n.id) || []).length && !(idx.out.get(n.id) || []).some((l) => l.to && l.to !== n.id) && n.type !== 'structure');
  section('Orphans', orphans.map((n) => sideItem(n, 'no links in or out')), 'Link each to a related idea, or it will be hard to find again.');
  const unres = Array.from(idx.unresolved.values()).sort((a, b) => b.refs.length - a.refs.length);
  section('Unresolved links', unres.map((u) => h('div', { class: 'side-item' },
    h('span', { class: 'dot broken-dot' }),
    h('div', { class: 'si-main' }, h('div', { class: 'si-title' }, u.target), h('div', { class: 'si-sub' }, `${u.refs.length} · from ${vault.get(u.refs[0].from).title}`)),
    h('button', { class: 'btn btn-sm btn-outline', onclick: (e) => { e.stopPropagation(); newNoteDialog({ title: u.target }); } }, 'Create'))), 'These links point to notes that do not exist yet.');
  const weekAgo = isoLocal(new Date(Date.now() - 7 * 86400000));
  const stale = vault.all().filter((n) => n.status === 'fleeting' && n.created < weekAgo);
  section('Fleeting for over a week', stale.map((n) => sideItem(n, relTime(parseDate(n.created)))));
}

function highlightSidebar() {
  $$('#side-body .side-item').forEach((el) => el.classList.toggle('on', el.dataset.id === app.current));
}

/* ---------- mentions at the foot of the note ---------- */
const renderMentionsSoon = debounce(() => renderMentions(), 600);
function renderMentions() {
  const box = $('#mentions'); if (!box) return;
  const n = cur(); box.innerHTML = '';
  if (!n) return;
  const idx = vault.index();
  const outs = (idx.out.get(n.id) || []).filter((l) => l.to && l.to !== n.id);
  const outById = new Map();
  for (const l of outs) { if (!outById.has(l.to)) outById.set(l.to, new Set()); if (l.rel) outById.get(l.to).add(l.rel); }
  const back = idx.back.get(n.id) || [];
  const bySrc = new Map();
  for (const l of back) { if (!bySrc.has(l.from)) bySrc.set(l.from, { ctx: [], rels: new Set() }); bySrc.get(l.from).ctx.push(l.ctx); if (l.rel) bySrc.get(l.from).rels.add(l.rel); }
  for (const id of idx.citedBy.get(n.id) || []) if (!bySrc.has(id)) bySrc.set(id, { ctx: [], rels: new Set(['cites']) });

  const head = (label, count, extra) => h('div', { class: 'mn-head' }, h('span', null, label), h('span', { class: 'count' }, count ? String(count) : ''), extra || null);
  box.appendChild(h('div', { class: 'mn-rule' }));
  box.appendChild(head('Links', outById.size, h('button', { class: 'link-btn mn-add', id: 'add-link', onclick: () => addLinkDialog() }, '+ link')));
  if (outById.size) {
    const row = h('div', { class: 'mn-links' });
    for (const [id, rels] of outById) {
      const o = vault.get(id); if (!o) continue;
      row.appendChild(h('span', { class: 'mn-link' }, ...Array.from(rels).map((r) => h('span', { class: 'rel rel-' + REL_CLASS(r) }, r)),
        h('a', { class: 'wl', 'data-id': id, href: '#n-' + id, onclick: (e) => { e.preventDefault(); openNote(id); } }, o.title)));
    }
    box.appendChild(row);
  } else box.appendChild(h('div', { class: 'mn-none' }, 'No links yet. Type [[ in the text, or use + link.'));

  box.appendChild(head('Linked mentions', bySrc.size));
  if (!bySrc.size) box.appendChild(h('div', { class: 'mn-none' }, 'No note links here yet.'));
  for (const [from, info] of bySrc) {
    const src = vault.get(from); if (!src) continue;
    box.appendChild(h('div', { class: 'mn-item' },
      h('div', { class: 'mn-src' }, h('span', { class: 'dot t-' + src.type }),
        h('a', { class: 'wl mn-title', 'data-id': from, href: '#n-' + from, onclick: (e) => { e.preventDefault(); openNote(from); } }, src.title),
        ...Array.from(info.rels).map((r) => h('span', { class: 'rel rel-' + REL_CLASS(r) }, REL_INVERSE[r] || r))),
      ...Array.from(new Set(info.ctx)).slice(0, 2).map((c) => h('div', { class: 'mn-ctx', html: contextHtml(c, src) }))));
  }

  const um = unlinkedMentions(n);
  box.appendChild(head('Unlinked mentions', um.length));
  if (!um.length) box.appendChild(h('div', { class: 'mn-none' }, 'None.'));
  for (const u of um.slice(0, 15)) {
    box.appendChild(h('div', { class: 'mn-item' },
      h('div', { class: 'mn-src' }, h('span', { class: 'dot t-' + u.note.type }),
        h('a', { class: 'wl mn-title', 'data-id': u.note.id, href: '#n-' + u.note.id, onclick: (e) => { e.preventDefault(); openNote(u.note.id); } }, u.note.title),
        h('button', { class: 'link-btn mn-linkit', onclick: () => linkMention(u, n) }, 'link')),
      h('div', { class: 'mn-ctx', html: esc(u.before) + '<b>' + esc(u.match) + '</b>' + esc(u.after) })));
  }
}

function contextHtml(c, src) {
  let s = c.replace(/^ {0,3}:{3,}[ \t]*[A-Za-z][\w-]*[ \t]*(?:\[(.*)\])?.*$/, '$1')
    .replace(/^\s*(?:[-*+]|\d+[.)]|>|#{1,6})\s+/, '').replace(/!\[\[/g, '[[');
  if (s.length > 260) s = s.slice(0, 260) + '…';
  try {
    const html = renderMarkdown(s, { note: src, depth: 3, idPrefix: 'bl' + hashStr(s) + '-' });
    return html.replace(/^\s*<p>/, '').replace(/<\/p>\s*$/, '');
  } catch (e) { return esc(s); }
}

function unlinkedMentions(n) {
  const terms = [n.title, ...(n.aliases || [])].map((t) => t.trim()).filter((t) => t.length >= 4);
  if (!terms.length) return [];
  const escRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = new RegExp('(?<![\\p{L}\\p{N}])(' + terms.map(escRe).sort((a, b) => b.length - a.length).join('|') + ')(?![\\p{L}\\p{N}])', 'giu');
  const idx = vault.index(); const out = [];
  for (const o of vault.notes.values()) {
    if (o.id === n.id) continue;
    if ((idx.out.get(o.id) || []).some((l) => l.to === n.id)) continue;
    const masked = maskedBody(o).replace(/!?\[\[[^\]\n]*\]\]|\[[^\]\n]*\]\([^)\n]*\)|<[^>\n]+>|^ {0,3}:::.*$/gm, blank);
    re.lastIndex = 0; const m = re.exec(masked);
    if (!m) continue;
    const a = Math.max(0, m.index - 50); const b = Math.min(o.body.length, m.index + m[0].length + 50);
    out.push({ note: o, index: m.index, match: o.body.substr(m.index, m[0].length), before: (a > 0 ? '…' : '') + o.body.slice(a, m.index).replace(/\s+/g, ' '), after: o.body.slice(m.index + m[0].length, b).replace(/\s+/g, ' ') + (b < o.body.length ? '…' : '') });
  }
  return out;
}

function linkMention(u, target) {
  const o = u.note;
  if (o.body.substr(u.index, u.match.length) !== u.match) { toast('That note changed. Try again.'); renderMentions(); return; }
  const label = u.match === target.title ? null : u.match;
  o.body = o.body.slice(0, u.index) + linkText(target, label || undefined) + o.body.slice(u.index + u.match.length);
  o.modified = isoLocal(); vault.touch(); ed.forget(o.id); persistNote(o);
  toast(`Linked in “${o.title}”`);
  renderMentions();
}

/* ---------- context panel ---------- */
const renderPanelSoon = debounce(() => renderPanel(), 500);

function panelSection(key, title, count, content, actions) {
  const open = app.settings.sections[key] !== false;
  return h('section', { class: 'pn-sec' + (open ? ' open' : '') },
    h('button', { class: 'pn-head', 'aria-expanded': String(open), onclick: () => {
      app.settings.sections[key] = !open; saveSettings(); renderPanel();
    } }, h('span', { class: 'pn-title' }, title), count != null ? h('span', { class: 'count' }, String(count)) : null, h('span', { class: 'pn-caret' }, open ? '–' : '+')),
    open ? h('div', { class: 'pn-body' }, content, actions || null) : null);
}

function renderPanel() {
  const panel = $('#panel'); if (!panel) return;
  if (app.localGraph) { app.localGraph.destroy(); app.localGraph = null; }
  if (!app.settings.panel && !document.body.classList.contains('panel-open')) { panel.innerHTML = ''; return; }
  const n = cur();
  panel.innerHTML = '';
  if (!n) { panel.appendChild(h('div', { class: 'pn-empty' }, 'Open a note to see its outline and graph.')); return; }
  const idx = vault.index();

  const heads = [];
  const mc = maskCode(n.body);
  for (const l of mc.split('\n')) { const m = /^(#{1,6})[ \t]+(.+?)[ \t#]*$/.exec(l); if (m) heads.push({ level: m[1].length, text: m[2] }); }
  const minL = Math.min(...heads.map((x) => x.level), 6);
  const outline = h('div', { class: 'outline' }, heads.length ? heads.map((x) => h('button', { class: 'ol-item', style: { paddingLeft: (4 + (x.level - minL) * 12) + 'px' },
    onclick: () => scrollToHeading(slugify(x.text)) }, x.text.replace(/\$[^$]*\$/g, (s) => s.slice(1, -1)))) : h('div', { class: 'pn-none' }, 'No headings.'));
  panel.appendChild(panelSection('outline', 'Outline', heads.length || null, outline));

  const outs = (idx.out.get(n.id) || []).filter((l) => l.rel && l.to);
  const ins = (idx.back.get(n.id) || []).filter((l) => l.rel);
  const relBox = h('div', { class: 'relations' });
  const group = new Map();
  for (const l of outs) { const k = l.rel; if (!group.has(k)) group.set(k, []); group.get(k).push(l.to); }
  for (const l of ins) { const k = '← ' + (REL_INVERSE[l.rel] || l.rel); if (!group.has(k)) group.set(k, []); group.get(k).push(l.from); }
  for (const [k, ids] of group) {
    const rel = k.startsWith('← ') ? Object.keys(REL_INVERSE).find((r) => '← ' + REL_INVERSE[r] === k) || '' : k;
    relBox.appendChild(h('div', { class: 'rel-group' }, h('div', { class: 'rel-name rel-' + REL_CLASS(rel) }, k.replace('← ', '')),
      ...Array.from(new Set(ids)).map((id) => noteLinkRow(vault.get(id)))));
  }
  if (!group.size) relBox.appendChild(h('div', { class: 'pn-none' }, 'Optional. A relation word before a link names the relation: supports::[[…]], depends-on::[[…]]. Plain links need none.'));
  panel.appendChild(panelSection('relations', 'Relations', group.size ? outs.length + ins.length : null, relBox));

  const lgOpen = app.settings.sections.localgraph !== false;
  panel.appendChild(panelSection('localgraph', 'Local graph', null, h('div', { class: 'local-graph' }, h('canvas', { id: 'local-canvas' })),
    h('div', { class: 'pn-actions' }, h('button', { class: 'link-btn', onclick: () => openGraph({ focus: n.id, depth: 2 }) }, 'open in graph view'))));
  if (lgOpen) requestAnimationFrame(() => {
    const cv = $('#local-canvas'); if (!cv) return;
    const { nodes, edges } = graphData({ focus: n.id, depth: 1 });
    app.localGraph = new ForceGraph(cv, { labels: true, linkLength: 60, repulsion: 120, gravity: 0.05, onClick: (node) => openNote(node.id) });
    app.localGraph.focusId = n.id;
    app.localGraph.setData(nodes, edges, false);
  });

  const an = analyzeNote(n); const cards = extractCards(n); const back = idx.back.get(n.id) || [];
  const info = h('dl', { class: 'info' },
    h('dt', null, 'ID'), h('dd', null, n.id),
    h('dt', null, 'Created'), h('dd', null, n.created.replace('T', ' ')),
    h('dt', null, 'Modified'), h('dd', null, n.modified.replace('T', ' ')),
    h('dt', null, 'Words'), h('dd', null, String(an.words)),
    h('dt', null, 'Links'), h('dd', null, `${(idx.out.get(n.id) || []).filter((l) => l.to).length} out, ${back.length} in`),
    h('dt', null, 'Cards'), h('dd', null, String(cards.length)),
    n.file ? h('dt', null, 'File') : null, n.file ? h('dd', null, n.file) : null);
  panel.appendChild(panelSection('info', 'Note info', null, info));
}

function noteLinkRow(n) {
  if (!n) return h('span');
  return h('a', { class: 'pn-link', 'data-id': n.id, href: '#n-' + n.id, onclick: (e) => { e.preventDefault(); openNote(n.id); } },
    h('span', { class: 'dot t-' + n.type }), h('span', null, n.title));
}

/* ---------- graph data ---------- */
function graphData(opts = {}) {
  const idx = vault.index();
  let ids;
  if (opts.focus) {
    ids = new Set([opts.focus]); let frontier = [opts.focus];
    for (let d = 0; d < (opts.depth || 1); d++) {
      const next = [];
      for (const id of frontier) {
        for (const l of idx.out.get(id) || []) if (l.to && !ids.has(l.to)) { ids.add(l.to); next.push(l.to); }
        for (const l of idx.back.get(id) || []) if (!ids.has(l.from)) { ids.add(l.from); next.push(l.from); }
        for (const f of idx.citedBy.get(id) || []) if (!ids.has(f)) { ids.add(f); next.push(f); }
      }
      frontier = next;
    }
  } else ids = new Set(vault.notes.keys());
  const types = opts.types && opts.types.length ? new Set(opts.types) : null;
  const nodes = []; const keep = new Set();
  for (const id of ids) {
    const n = vault.get(id); if (!n) continue;
    if (types && !types.has(n.type) && id !== opts.focus) continue;
    keep.add(id);
    nodes.push({ id, label: n.title, type: n.type, status: n.status, pinned: id === opts.focus && opts.pin });
  }
  const edges = []; const seen = new Set();
  for (const id of keep) {
    for (const l of idx.out.get(id) || []) {
      if (!l.to || !keep.has(l.to) || l.to === id) continue;
      const k = id + '>' + l.to + '>' + l.rel;
      if (seen.has(k)) continue; seen.add(k);
      edges.push({ s: id, t: l.to, cls: l.rel ? REL_CLASS(l.rel) : 'plain', rel: l.rel });
    }
  }
  if (opts.hideOrphans) {
    const deg = new Set(); for (const e of edges) { deg.add(e.s); deg.add(e.t); }
    return { nodes: nodes.filter((nd) => deg.has(nd.id) || nd.id === opts.focus), edges };
  }
  return { nodes, edges };
}

/* ---------- note creation flows ---------- */
function captureText(text) {
  text = String(text || '').trim();
  if (!text) return null;
  const lines = text.split('\n');
  let title = lines[0].replace(/^#+\s*/, '').trim();
  let body = lines.slice(1).join('\n').trim();
  if (title.length > 90) { body = text; title = title.slice(0, 80).replace(/\s+\S*$/, '') + '…'; }
  const n = createNote({ title, body: body ? body + '\n' : '', status: 'fleeting', type: 'concept' }, { open: false });
  toast(`Captured “${n.title}” to the inbox`, { action: { label: 'Open', run: () => openNote(n.id) } });
  return n;
}

function branchNote() {
  const c = cur(); if (!c) return;
  newNoteDialog({ title: '', type: c.type, branchFrom: c.id, branchPos: app.settings.mode !== 'read' ? ed.selection().to : null });
}

function extractSelection() {
  const c = cur(); if (!c) return;
  if (app.settings.mode === 'read') { toast('Switch to editing and select some text first.'); return; }
  const { from: s, to: e } = ed.selection();
  if (s === e) { toast('Select some text in the note first.'); return; }
  const text = ed.getText().slice(s, e);
  const firstLine = text.trim().split('\n')[0].replace(/^#+\s*/, '').replace(/[*_`$]/g, '').trim();
  newNoteDialog({ title: firstLine.slice(0, 80), type: 'concept', extract: { from: c.id, s, e, text } });
}

async function seedVault(open) {
  const seeds = starterNotes();
  const existingTitles = new Set(vault.all().map((n) => normTitle(n.title)));
  const add = [];
  for (const raw of seeds) {
    const n = parseNote(raw);
    if (vault.notes.has(n.id) || existingTitles.has(normTitle(n.title))) continue;
    add.push(n);
  }
  for (const n of add) vault.notes.set(n.id, n);
  vault.touch();
  await store.putNotes(add);
  if (app.folder.status === 'linked') for (const n of add) await folderWrite(n);
  app.settings.seeded = true; saveSettings();
  refreshLists();
  if (open) { const w = add.find((n) => n.id === '20260101000100') || add[0]; if (w) openNote(w.id); }
  toast(add.length ? `Added ${add.length} example notes` : 'The example notes are already here');
}

function copyText(text, msg) {
  const done = () => toast(msg || 'Copied');
  try { navigator.clipboard.writeText(text).then(done, () => fallbackCopy(text) && done()); }
  catch (e) { if (fallbackCopy(text)) done(); }
}
function fallbackCopy(text) {
  const ta = h('textarea', { style: { position: 'fixed', opacity: '0' } }); ta.value = text; document.body.appendChild(ta); ta.select();
  let ok = false; try { ok = document.execCommand('copy'); } catch (e) { ok = false; }
  ta.remove();
  if (!ok) toast('The browser blocked the clipboard.', { kind: 'error' });
  return ok;
}
