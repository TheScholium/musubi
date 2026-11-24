/* Musubi features: overlays, palette, graph view, review, history, settings, import/export, folder sync, boot. */

/* ---------- overlay infrastructure ---------- */
app.overlays = [];
function overlay(cls, content, opts = {}) {
  const ov = { el: null, closed: false };
  ov.close = (val) => {
    if (ov.closed) return; ov.closed = true;
    ov.el.remove(); app.overlays = app.overlays.filter((o) => o !== ov);
    opts.onClose && opts.onClose(val);
    if (!app.overlays.length && ov.prevFocus && document.body.contains(ov.prevFocus)) { try { ov.prevFocus.focus({ preventScroll: true }); } catch (e) { /* ignore */ } }
  };
  ov.prevFocus = document.activeElement;
  ov.el = h('div', { class: 'overlay ' + cls },
    h('div', { class: 'ov-backdrop', onclick: () => ov.close() }),
    h('div', { class: 'ov-panel', role: 'dialog', 'aria-modal': 'true' }, content));
  $('#overlays').appendChild(ov.el);
  app.overlays.push(ov);
  return ov;
}

function confirmDialog(title, msg, okLabel = 'OK', danger = false) {
  return new Promise((res) => {
    let ov;
    const ok = h('button', { class: 'btn ' + (danger ? 'btn-danger' : 'btn-primary'), onclick: () => { ov.close(true); } }, okLabel);
    const content = h('div', { class: 'dialog' }, h('h3', null, title), msg ? h('p', { class: 'muted' }, msg) : null,
      h('div', { class: 'dialog-actions' }, h('button', { class: 'btn', onclick: () => ov.close(false) }, 'Cancel'), ok));
    ov = overlay('ov-dialog', content, { onClose: (v) => res(v === true) });
    ok.focus();
  });
}

function promptDialog(title, label, value = '', okLabel = 'OK') {
  return new Promise((res) => {
    let ov;
    const inp = h('input', { class: 'input', value, 'aria-label': label });
    const submit = () => ov.close(inp.value);
    inp.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); submit(); } });
    const content = h('div', { class: 'dialog' }, h('h3', null, title), h('label', { class: 'field' }, h('span', null, label), inp),
      h('div', { class: 'dialog-actions' }, h('button', { class: 'btn', onclick: () => ov.close(null) }, 'Cancel'), h('button', { class: 'btn btn-primary', onclick: submit }, okLabel)));
    ov = overlay('ov-dialog', content, { onClose: (v) => res(typeof v === 'string' ? v : null) });
    inp.focus(); inp.select();
  });
}

function newNoteDialog(opts = {}) {
  let ov;
  const title = h('input', { class: 'input input-lg', placeholder: 'Title of the idea', value: opts.title || '', 'aria-label': 'Title' });
  const type = h('select', { class: 'input', 'aria-label': 'Type' }, ...NOTE_TYPES.map(([k, l]) => h('option', { value: k }, l)));
  type.value = opts.type || 'concept';
  const status = h('select', { class: 'input', 'aria-label': 'Status' }, ...STATUSES.map(([k, l]) => h('option', { value: k }, l)));
  status.value = opts.status || 'draft';
  const hint = opts.branchFrom ? `This note continues “${vault.get(opts.branchFrom).title}”. A link goes both ways.`
    : opts.extract ? 'The selected text moves into the new note. A link replaces it.'
    : opts.folder ? `The note goes in the folder “${opts.folder.replace(/\/$/, '')}”.`
    : 'Each note holds one idea. Give it a title that states the idea.';
  const create = () => {
    const t = title.value.trim();
    if (!t) { title.focus(); title.classList.add('shake'); setTimeout(() => title.classList.remove('shake'), 400); return; }
    const existing = resolveTarget(t);
    const fields = { title: t, type: type.value, status: status.value };
    if (opts.folder) fields.folder = opts.folder;
    if (opts.citekey) fields.citekey = opts.citekey;
    let body;
    if (opts.extract) body = opts.extract.text.trim() + '\n';
    if (opts.branchFrom) {
      const src = vault.get(opts.branchFrom);
      body = 'follows::' + linkText(src) + '\n\n' + (app.settings.templates[type.value] || '').replace(/\{\{title\}\}/g, t);
    }
    if (body != null) fields.body = body;
    ov.close();
    if (existing && normTitle(vault.get(existing).title) === normTitle(t) && !opts.extract && !opts.branchFrom) {
      toast('A note with this title exists. Opening it.'); openNote(existing); return;
    }
    const n = createNote(fields, { open: false });
    if (opts.extract) {
      const src = vault.get(opts.extract.from);
      if (src && src.body.slice(opts.extract.s, opts.extract.e) === opts.extract.text) {
        src.body = src.body.slice(0, opts.extract.s) + linkText(n) + src.body.slice(opts.extract.e);
        if (app.current === src.id) syncEditorFromNote(); else ed.forget(src.id);
        src.modified = isoLocal(); vault.touch(); persistNote(src);
      }
    }
    if (opts.branchFrom) {
      const src = vault.get(opts.branchFrom);
      if (app.current === src.id && app.settings.mode !== 'read' && opts.branchPos != null) {
        const pos = Math.min(opts.branchPos, src.body.length);
        src.body = src.body.slice(0, pos) + (pos > 0 && !/\s/.test(src.body[pos - 1]) ? ' ' : '') + linkText(n) + src.body.slice(pos);
      } else src.body = src.body.replace(/\s*$/, '') + '\n\nContinued in ' + linkText(n) + '\n';
      if (app.current === src.id) syncEditorFromNote(); else ed.forget(src.id);
      src.modified = isoLocal(); vault.touch(); persistNote(src);
    }
    openNote(n.id, { focusEditor: true });
  };
  title.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); create(); } });
  const content = h('div', { class: 'dialog dialog-new' },
    h('h3', null, opts.branchFrom ? 'Branch a new note' : opts.extract ? 'Extract to a new note' : 'New note'),
    title,
    h('div', { class: 'row' }, h('label', { class: 'field' }, h('span', null, 'Type'), type), h('label', { class: 'field' }, h('span', null, 'Status'), status)),
    h('p', { class: 'muted small' }, hint),
    h('div', { class: 'dialog-actions' }, h('button', { class: 'btn', onclick: () => ov.close() }, 'Cancel'), h('button', { class: 'btn btn-primary', onclick: create }, 'Create')));
  ov = overlay('ov-dialog', content);
  title.focus(); title.select();
}

function captureDialog() {
  let ov;
  const ta = h('textarea', { class: 'input capture-input', rows: 6, placeholder: 'Write the thought. The first line becomes the title.\nCtrl+Enter saves it to the inbox.' });
  const save = () => { if (captureText(ta.value)) ov.close(); else ta.focus(); };
  ta.addEventListener('keydown', (e) => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); save(); } });
  ov = overlay('ov-dialog', h('div', { class: 'dialog' }, h('h3', null, 'Quick capture'), ta,
    h('p', { class: 'muted small' }, 'Fleeting notes go to the inbox. Process them later into permanent notes.'),
    h('div', { class: 'dialog-actions' }, h('button', { class: 'btn', onclick: () => ov.close() }, 'Cancel'), h('button', { class: 'btn btn-primary', onclick: save }, 'Capture'))));
  ta.focus();
}

/* ---------- command palette ---------- */
function commands() {
  const c = cur();
  const list = [
    { label: 'New note', keys: 'Alt+N', run: () => newNoteDialog() },
    ...NOTE_TYPES.map(([k, l]) => ({ label: 'New note: ' + l, run: () => newNoteDialog({ type: k }) })),
    { label: 'Quick capture to inbox', keys: 'Alt+C', run: () => captureDialog() },
    { label: 'Open graph view', keys: 'Alt+G', run: () => openGraph() },
    { label: 'Review due flashcards', keys: 'Alt+R', run: () => openReview() },
    { label: 'Random note (serendipity)', run: () => { const all = vault.all(); if (all.length) openNote(all[Math.floor(Math.random() * all.length)].id); } },
    { label: 'View: live preview', keys: modKey() + '+E', run: () => setMode('live') },
    { label: 'View: source (plain Markdown)', keys: modKey() + '+Shift+E', run: () => setMode('source') },
    { label: 'View: read', run: () => setMode('read') },
    { label: 'Toggle sidebar', run: toggleSidebar },
    { label: 'Manage tags: rename, merge, move, remove', run: () => openTagManager() },
    { label: 'New tab', keys: 'Alt+T', run: () => newTab() },
    { label: 'Close tab', keys: 'Alt+W', run: () => { const p = panes.focus == null ? panes.notePane : panes.focus; closeTab(p, panes.list[p].active); } },
    { label: panes.split ? 'Close the split' : 'Split view: open a second pane', keys: 'Alt+\\', run: toggleSplit },
    { label: 'Go back', keys: modKey() + '+Alt+←', run: () => navGo(-1) },
    { label: 'Go forward', keys: modKey() + '+Alt+→', run: () => navGo(1) },
    { label: 'Toggle context panel', run: togglePanel },
    { label: 'Settings', keys: modKey() + '+,', run: () => openSettings() },
    { label: 'Settings: note types', run: () => openSettings('types') },
    { label: 'Read: Zettelkasten and the Musubi philosophy', run: () => openPhilosophy() },
    { label: 'Keyboard shortcuts and syntax', keys: '?', run: () => openSettings('shortcuts') },
    { label: 'Import files (Markdown, ZIP, JSON, BibTeX, images)', run: () => $('#file-input').click() },
    { label: 'Import a folder of Markdown', run: () => $('#dir-input').click() },
    { label: 'Export vault as Markdown ZIP', run: exportZip },
    { label: 'Export full backup (JSON)', run: exportJSON },
    { label: 'Export bibliography (BibTeX)', run: exportBib },
    { label: 'Link a folder on disk (two-way sync)', run: linkFolder },
    { label: 'Install Musubi as an app', run: pwaInstall },
    { label: 'New window', keys: modKey() + '+N (installed app)', run: pwaNewWindow },
    { label: 'Take the tour', run: () => startTour() },
    { label: 'Add example notes', run: () => seedVault(true) },
    { label: 'Open the inbox', run: () => { app.settings.sidebarTab = 'inbox'; renderSidebar(); if (!app.settings.sidebar) toggleSidebar(); } },
  ];
  if (c) list.push(
    { label: 'Branch from this note', keys: 'Alt+B', run: branchNote },
    { label: 'Extract selection to new note', run: extractSelection },
    { label: 'Study cards in this note', run: () => openReview({ noteId: c.id }) },
    { label: 'Local graph of this note', run: () => openGraph({ focus: c.id, depth: 2 }) },
    { label: 'Version history of this note', run: openHistory },
    { label: 'Copy link to this note', run: () => copyText(linkText(c), 'Link copied') },
    { label: 'Copy a link to the block at the cursor', run: copyBlockLink },
    { label: 'Copy this note as Markdown', run: () => copyText(serializeNote(c), 'Markdown copied') },
    { label: 'Print or save this note as PDF', run: () => { setMode('read'); setTimeout(() => window.print(), 120); } },
    { label: 'Move this note to the trash', run: () => deleteNote(c.id) },
  );
  return list;
}

function openPalette(initial = '') {
  if (app.overlays.some((o) => o.el.classList.contains('ov-palette'))) return;
  let ov; let items = []; let sel = 0;
  const input = h('input', { class: 'pal-input', placeholder: 'Find a note. Type > for commands.', value: initial, 'aria-label': 'Search', autocomplete: 'off', spellcheck: 'false' });
  const list = h('div', { class: 'pal-list', role: 'listbox' });
  const foot = h('div', { class: 'pal-foot' }, h('span', null, '↑↓ choose'), h('span', null, 'Enter open'), h('span', null, modKey() + '+Enter insert link'), h('span', null, 'Shift+Enter new tab'), h('span', null, '> commands'));
  const update = () => {
    const q = input.value; items = []; list.innerHTML = '';
    if (q.startsWith('>')) {
      const cq = fold(q.slice(1).trim());
      items = commands().map((c) => ({ c, s: cq ? fuzzyScore(fold(c.label), cq) : 1 })).filter((x) => x.s > 0).sort((a, b) => b.s - a.s)
        .map((x) => ({ kind: 'cmd', label: x.c.label, keys: x.c.keys, run: x.c.run }));
    } else {
      const quick = quickFind(q, 8); const seen = new Set(quick.map((n) => n.id));
      items = quick.map((n) => ({ kind: 'note', note: n }));
      if (q.trim().length >= 2) {
        for (const r of searchNotes(q, 30)) if (!seen.has(r.note.id)) { items.push({ kind: 'note', note: r.note, snippet: snippetAt(r.note, r.hit, 110) }); seen.add(r.note.id); if (items.length > 24) break; }
        if (!resolveTarget(q.trim())) items.push({ kind: 'create', label: q.trim() });
      }
    }
    sel = 0;
    items.forEach((it, i) => {
      let row;
      if (it.kind === 'note') {
        row = h('div', { class: 'pal-item', role: 'option' }, h('span', { class: 'dot t-' + it.note.type }),
          h('div', { class: 'pal-main' }, h('div', { class: 'pal-title' }, it.note.title), it.snippet ? h('div', { class: 'pal-sub' }, it.snippet) : null),
          h('span', { class: 'pal-meta' }, TYPE_LABEL[it.note.type] || it.note.type));
      } else if (it.kind === 'cmd') {
        row = h('div', { class: 'pal-item', role: 'option' }, h('span', { class: 'pal-cmd-ic', html: icon('fwd', 13) }), h('div', { class: 'pal-main' }, h('div', { class: 'pal-title' }, it.label)), it.keys ? h('kbd', null, it.keys) : null);
      } else {
        row = h('div', { class: 'pal-item pal-create', role: 'option' }, h('span', { class: 'pal-cmd-ic', html: icon('plus', 13) }), h('div', { class: 'pal-main' }, h('div', { class: 'pal-title' }, `Create note “${it.label}”`)));
      }
      row.addEventListener('mousemove', () => { if (sel !== i) { sel = i; mark(); } });
      row.addEventListener('click', (e) => choose(e.ctrlKey || e.metaKey));
      list.appendChild(row);
    });
    if (!items.length) list.appendChild(h('div', { class: 'pal-empty' }, q.startsWith('>') ? 'No command matches.' : 'No notes match.'));
    mark();
  };
  const mark = () => { $$('.pal-item', list).forEach((r, i) => r.classList.toggle('sel', i === sel)); const r = list.children[sel]; if (r && r.scrollIntoView) r.scrollIntoView({ block: 'nearest' }); };
  const choose = (insert, shift) => {
    const it = items[sel]; if (!it) return;
    ov.close();
    if (it.kind === 'cmd') { setTimeout(it.run, 0); return; }
    if (it.kind === 'create') { newNoteDialog({ title: it.label }); return; }
    if (insert && cur() && app.settings.mode !== 'read') {
      ed.insertAtCursor(linkText(it.note)); return;
    }
    openNote(it.note.id, shift ? { newTab: true } : {});
  };
  input.addEventListener('input', update);
  input.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); sel = Math.min(items.length - 1, sel + 1); mark(); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); sel = Math.max(0, sel - 1); mark(); }
    else if (e.key === 'Enter') { e.preventDefault(); choose(e.ctrlKey || e.metaKey, e.shiftKey); }
  });
  ov = overlay('ov-palette', h('div', { class: 'palette' }, input, list, foot));
  update();
  input.focus(); input.setSelectionRange(input.value.length, input.value.length);
}

/* ---------- graph view ---------- */
function openGraph(opts = {}) {
  const state = { focus: opts.focus || null, depth: opts.depth || 2, types: [], hideOrphans: false, tag: '' };
  let ov;
  const cv = h('canvas', { class: 'graph-canvas' });
  const tip = h('div', { class: 'graph-tip', hidden: true });
  const search = h('input', { class: 'input input-sm', type: 'search', placeholder: 'Highlight…', 'aria-label': 'Highlight notes' });
  const scope = h('select', { class: 'input input-sm', 'aria-label': 'Scope' }, h('option', { value: 'all' }, 'Whole vault'), h('option', { value: 'local' }, 'Around a note'));
  scope.value = state.focus ? 'local' : 'all';
  const depth = h('select', { class: 'input input-sm', 'aria-label': 'Depth' }, ...[1, 2, 3, 4].map((d) => h('option', { value: d }, 'Depth ' + d)));
  depth.value = String(state.depth);
  const orphans = h('label', { class: 'check' }, h('input', { type: 'checkbox' }), 'Hide orphans');
  const labels = h('label', { class: 'check' }, h('input', { type: 'checkbox', checked: true }), 'Labels');
  const chips = h('div', { class: 'graph-chips' });
  const counts = h('span', { class: 'muted small' });
  const counter = {}; for (const n of vault.notes.values()) counter[n.type] = (counter[n.type] || 0) + 1;
  for (const [k, l] of NOTE_TYPES) {
    if (!counter[k]) continue;
    const b = h('button', { class: 'type-chip', onclick: () => {
      state.types = state.types.includes(k) ? state.types.filter((x) => x !== k) : [...state.types, k];
      b.classList.toggle('on', state.types.includes(k)); load();
    } }, h('span', { class: 'dot t-' + k }), l);
    chips.appendChild(b);
  }
  const legend = h('div', { class: 'graph-legend' },
    h('span', null, h('i', { class: 'lg lg-pro' }), 'supports'), h('span', null, h('i', { class: 'lg lg-con' }), 'objects / refutes'),
    h('span', null, h('i', { class: 'lg lg-struct' }), 'structural'), h('span', null, h('i', { class: 'lg lg-seq' }), 'sequence'),
    h('span', null, h('i', { class: 'lg lg-plain' }), 'plain link'));
  const fitBtn = h('button', { class: 'btn btn-sm', onclick: () => g.fit() }, 'Fit');
  const head = h('div', { class: 'graph-head' }, h('b', { class: 'graph-title' }, 'Graph'), scope, depth, search, orphans, labels, fitBtn, counts,
    h('button', { class: 'icon-btn', title: 'Close', html: icon('x', 18), onclick: () => ov.close() }));
  const wrap = h('div', { class: 'graph-wrap' }, cv, tip, legend);
  ov = overlay('ov-graph', h('div', { class: 'graph-view' }, head, chips, wrap), { onClose: () => { g.destroy(); app.graphView = null; } });
  const g = new ForceGraph(cv, {
    onClick: (node) => { ov.close(); openNote(node.id); },
    onHover: (node, e) => {
      if (!node) { tip.hidden = true; return; }
      const n = vault.get(node.id);
      tip.innerHTML = `<b>${esc(n.title)}</b><span>${esc(TYPE_LABEL[n.type] || n.type)} · ${(vault.index().back.get(n.id) || []).length} backlinks</span>`;
      tip.hidden = false;
      const r = wrap.getBoundingClientRect();
      tip.style.left = Math.min(r.width - 240, e.clientX - r.left + 14) + 'px'; tip.style.top = (e.clientY - r.top + 14) + 'px';
    },
  });
  app.graphView = g;
  const load = () => {
    const local = scope.value === 'local' && (state.focus || app.current);
    if (local && !state.focus) state.focus = app.current;
    depth.hidden = !local;
    const { nodes, edges } = graphData({ focus: local ? state.focus : null, depth: +depth.value, types: state.types, hideOrphans: orphans.firstChild.checked, pin: false });
    g.focusId = local ? state.focus : app.current;
    g.labels = labels.firstChild.checked;
    g.setData(nodes, edges);
    counts.textContent = `${nodes.length} notes · ${edges.length} links`;
    applyHighlight();
  };
  const applyHighlight = () => {
    const q = fold(search.value.trim());
    g.highlight = q ? new Set(g.nodes.filter((n) => fold(n.label).includes(q)).map((n) => n.id)) : null;
    g.draw();
  };
  scope.addEventListener('change', load); depth.addEventListener('change', load);
  orphans.firstChild.addEventListener('change', load);
  labels.firstChild.addEventListener('change', () => { g.labels = labels.firstChild.checked; g.draw(); });
  search.addEventListener('input', applyHighlight);
  search.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && g.highlight && g.highlight.size) { const id = g.highlight.values().next().value; ov.close(); openNote(id); }
  });
  requestAnimationFrame(() => { g.resize(); load(); });
}

/* ---------- spaced repetition ---------- */
const DAY = 86400000;
function cardsAll() {
  const out = [];
  for (const n of vault.notes.values()) {
    const key = n.body + '|' + (app.settings.autoCards !== false);
    if (n._cardsKey !== key) { n._cards = extractCards(n); n._cardsKey = key; }
    out.push(...n._cards);
  }
  return out;
}
function todayKey() { return isoLocal().slice(0, 10); }
function newIntroducedToday() { const log = app.srs._new || {}; return log[todayKey()] || 0; }

function dueQueue(scope = {}) {
  const now = Date.now();
  let cards = scope.noteId ? cardsAll().filter((c) => c.noteId === scope.noteId) : cardsAll();
  if (scope.noteId) return cards.sort((a, b) => ((app.srs[a.id] || {}).due || 0) - ((app.srs[b.id] || {}).due || 0));
  const due = []; const fresh = [];
  for (const c of cards) { const st = app.srs[c.id]; if (!st) fresh.push(c); else if (st.due <= now) due.push(c); }
  due.sort((a, b) => app.srs[a.id].due - app.srs[b.id].due);
  const allowance = Math.max(0, (app.settings.newPerDay | 0) - newIntroducedToday());
  return [...due, ...fresh.slice(0, allowance)];
}
function updateDueBadge() {
  const b = $('#due-badge'); if (!b) return;
  const n = dueQueue().length;
  b.hidden = !n; b.textContent = n > 99 ? '99+' : String(n);
}

function schedule(st, g) {
  const now = Date.now();
  const s = st ? Object.assign({}, st) : { ease: 2.5, ivl: 0, reps: 0, lapses: 0, due: now };
  const isNew = !st;
  if (g === 1) { s.lapses += st && s.ivl >= 1 ? 1 : 0; s.ease = Math.max(1.3, s.ease - 0.2); s.ivl = 0; s.due = now + 60 * 1000; }
  else if (g === 2) {
    if (s.ivl < 1) { s.ivl = 0; s.due = now + 6 * 60 * 1000; }
    else { s.ivl = Math.max(s.ivl + 1, s.ivl * 1.2); s.ease = Math.max(1.3, s.ease - 0.15); s.due = now + s.ivl * DAY; }
  } else if (g === 3) {
    s.ivl = s.ivl < 1 ? 1 : Math.max(s.ivl + 1, s.ivl * s.ease); s.due = now + s.ivl * DAY;
  } else {
    s.ivl = s.ivl < 1 ? 4 : Math.max(s.ivl + 1, s.ivl * s.ease * 1.3); s.ease += 0.15; s.due = now + s.ivl * DAY;
  }
  if (s.ivl > 2) { const fuzz = 1 + (Math.random() - 0.5) * 0.1; s.due = now + s.ivl * fuzz * DAY; }
  s.reps += 1; s.last = now;
  return { s, isNew };
}
function ivlLabel(st, g) {
  const { s } = schedule(st, g); const ms = s.due - Date.now();
  if (ms < 3600000) return Math.max(1, Math.round(ms / 60000)) + ' min';
  const d = ms / DAY;
  if (d < 30) return Math.round(d) + ' d';
  if (d < 365) return (d / 30).toFixed(1).replace(/\.0$/, '') + ' mo';
  return (d / 365).toFixed(1).replace(/\.0$/, '') + ' y';
}

function openReview(scope = {}) {
  let queue = dueQueue(scope);
  let ov; let card = null; let shown = false; const stats = { done: 0, again: 0 };
  const box = h('div', { class: 'review' });
  const render = () => {
    box.innerHTML = '';
    const head = h('div', { class: 'rv-head' }, h('b', null, scope.noteId ? 'Study: ' + vault.get(scope.noteId).title : 'Review'),
      h('span', { class: 'muted small' }, `${queue.length} left · ${stats.done} done`),
      h('button', { class: 'icon-btn', title: 'Close', html: icon('x', 18), onclick: () => ov.close() }));
    box.appendChild(head);
    card = queue[0];
    if (!card) {
      const total = cardsAll().length;
      box.appendChild(h('div', { class: 'rv-done' }, h('div', { class: 'empty-mark' }, '∎'),
        h('h3', null, stats.done ? 'Session complete' : 'Nothing is due'),
        h('p', { class: 'muted' }, stats.done ? `${stats.done} reviews, ${stats.again} lapses.` : total ? `You have ${total} cards. New cards arrive at ${app.settings.newPerDay} per day.` : 'Make cards with {{c1::cloze}}, Q:/A: lines, or named :::definition / :::theorem blocks.'),
        h('button', { class: 'btn', onclick: () => ov.close() }, 'Close')));
      updateDueBadge();
      return;
    }
    const n = vault.get(card.noteId);
    const st = app.srs[card.id];
    const front = h('div', { class: 'rv-card prose' });
    front.innerHTML = renderMarkdown(card.front, { note: n, idPrefix: 'rv-', breaks: !!(card.breaks || card.frontBreaks) });
    const back = h('div', { class: 'rv-back prose', hidden: !shown });
    back.innerHTML = renderMarkdown(card.back, { note: n, idPrefix: 'rvb-', breaks: !!card.breaks });
    enhanceRendered(front, 'rv-'); enhanceRendered(back, 'rvb-');
    const src = h('div', { class: 'rv-src' }, h('span', { class: 'dot t-' + n.type }),
      h('a', { class: 'wl', 'data-id': n.id, href: '#n-' + n.id, onclick: (e) => { e.preventDefault(); ov.close(); openNote(n.id); } }, n.title),
      h('span', { class: 'muted small' }, st ? `seen ${st.reps}× · ease ${st.ease.toFixed(2)}` : 'new card'));
    const actions = h('div', { class: 'rv-actions' });
    if (!shown) actions.appendChild(h('button', { class: 'btn btn-primary btn-lg', onclick: () => { shown = true; render(); } }, 'Show answer', h('kbd', null, 'Space')));
    else {
      [[1, 'Again'], [2, 'Hard'], [3, 'Good'], [4, 'Easy']].forEach(([g, l]) => actions.appendChild(
        h('button', { class: 'btn grade g' + g, onclick: () => grade(g) }, h('span', null, l), h('small', null, ivlLabel(st, g)), h('kbd', null, String(g)))));
    }
    box.appendChild(h('div', { class: 'rv-body' }, src, front, shown ? h('div', { class: 'rv-sep' }) : null, back, actions));
  };
  const grade = (g) => {
    const { s, isNew } = schedule(app.srs[card.id], g);
    app.srs[card.id] = s;
    if (isNew) { app.srs._new = app.srs._new || {}; const k = todayKey(); app.srs._new = { [k]: (app.srs._new[k] || 0) + 1 }; }
    saveSrs();
    queue.shift(); stats.done++;
    if (g === 1) { stats.again++; queue.splice(Math.min(queue.length, 3), 0, card); }
    shown = false; render();
  };
  const onKey = (e) => {
    if (app.overlays[app.overlays.length - 1] !== ov || !card) return;
    if (e.key === ' ' || e.key === 'Enter') { if (!shown) { e.preventDefault(); shown = true; render(); } else if (e.key === ' ') { e.preventDefault(); grade(3); } }
    else if (shown && /^[1-4]$/.test(e.key)) { e.preventDefault(); grade(+e.key); }
  };
  document.addEventListener('keydown', onKey);
  ov = overlay('ov-review', box, { onClose: () => { document.removeEventListener('keydown', onKey); updateDueBadge(); } });
  render();
}

/* ---------- version history ---------- */
async function openHistory() {
  const n = cur(); if (!n) return;
  saveCurrent.flush();
  const list = await store.history(n.id);
  let ov; let selected = list[0] || null;
  const left = h('div', { class: 'hist-list' }); const right = h('div', { class: 'hist-diff' });
  const current = serializeNote(n);
  const show = () => {
    left.innerHTML = '';
    for (const r of list) left.appendChild(h('button', { class: 'hist-item' + (r === selected ? ' on' : ''), onclick: () => { selected = r; show(); } },
      new Date(r.ts).toLocaleString(), h('span', { class: 'muted small' }, relTime(r.ts))));
    right.innerHTML = '';
    if (!selected) { right.appendChild(h('p', { class: 'muted' }, 'No earlier versions yet. While you edit, Musubi keeps the previous text at most every five minutes.')); return; }
    const d = lineDiff(selected.text, current);
    const pre = h('div', { class: 'diff' });
    if (!d) pre.appendChild(h('pre', null, selected.text));
    else {
      const changed = d.some((x) => x[0] !== ' ');
      if (!changed) pre.appendChild(h('p', { class: 'muted' }, 'This version is the same as the current text.'));
      for (const [k, line] of d) pre.appendChild(h('div', { class: 'dl dl-' + (k === '+' ? 'add' : k === '-' ? 'del' : 'eq') }, h('span', { class: 'dk' }, k), line || ' '));
    }
    right.appendChild(h('div', { class: 'hist-tools' }, h('span', { class: 'muted small' }, 'Red lines are in this version only; green lines are in the current text only.'),
      h('button', { class: 'btn btn-primary btn-sm', onclick: async () => {
        await store.addHistory(n.id, serializeNote(n));
        const old = parseNote(selected.text);
        Object.assign(n, { title: old.title, type: old.type, status: old.status, tags: old.tags, aliases: old.aliases, body: old.body,
          citekey: old.citekey, author: old.author, year: old.year, source: old.source, url: old.url, doi: old.doi, extra: old.extra });
        n.modified = isoLocal(); vault.touch(); await persistNote(n, { snapshot: false });
        ov.close(); ed.forget(n.id); openNote(n.id, { replace: true }); fillHeader(n); syncEditorFromNote(); refreshLists(); toast('Version restored. The previous text is in the history.');
      } }, 'Restore this version')));
    right.appendChild(pre);
  };
  ov = overlay('ov-history', h('div', { class: 'history' }, h('div', { class: 'rv-head' }, h('b', null, 'History: ' + n.title),
    h('button', { class: 'icon-btn', title: 'Close', html: icon('x', 18), onclick: () => ov.close() })), h('div', { class: 'hist-body' }, left, right)));
  show();
}

/* ---------- settings ---------- */
function openSettings(tab = 'general') {
  let ov;
  const s = app.settings;
  const tabs = [['general', 'General'], ['editor', 'Editor'], ['math', 'Mathematics'], ['study', 'Study'], ['types', 'Note types'], ['templates', 'Templates'], ['data', 'Data'], ['shortcuts', 'Shortcuts and syntax'], ['install', 'Install as an app'], ['about', 'About']];
  const nav = h('nav', { class: 'set-nav' }); const pane = h('div', { class: 'set-pane' });
  const sel = (key, options, onchange) => {
    const el = h('select', { class: 'input' }, ...options.map(([v, l]) => h('option', { value: v }, l)));
    el.value = String(s[key]);
    el.addEventListener('change', () => { const v = el.value; s[key] = typeof DEFAULT_SETTINGS[key] === 'number' ? +v : v; saveSettings(); onchange && onchange(); });
    return el;
  };
  const chk = (key, label, onchange) => {
    const el = h('input', { type: 'checkbox' }); el.checked = !!s[key];
    el.addEventListener('change', () => { s[key] = el.checked; saveSettings(); onchange && onchange(); });
    return h('label', { class: 'check' }, el, label);
  };
  const row = (label, control, help) => h('div', { class: 'set-row' }, h('div', { class: 'set-label' }, h('b', null, label), help ? h('div', { class: 'muted small' }, help) : null), h('div', { class: 'set-ctl' }, control));
  const renderers = {
    general: () => [
      row('Theme', sel('theme', [['dark', 'Istari (dark)'], ['light', 'Istari Paper (light)'], ['auto', 'Follow the system']], applyTheme), 'Istari Paper is the same design on parchment: dark ink and a deeper gold.'),
      row('Bold anchors', h('div', { class: 'check-col' },
        chk('boldAnchors', 'Make the first letters of each word bold', () => { applyTheme(); ed.setAnchors(); renderPreview(); }),
        sel('anchorStrength', [['light', 'Light (about a third of each word)'], ['medium', 'Medium (about two fifths)'], ['strong', 'Strong (about half)']], () => { applyTheme(); ed.setAnchors(); renderPreview(); })),
      'A lead-in for the eye, in live preview and in read view. Some readers with ADHD find it easier to keep their place. Code, mathematics and links do not change. The words in your files do not change.'),
      row('Text size', sel('fontSize', [16, 17, 18, 19, 20, 21, 22].map((x) => [x, x + ' px']), applyTheme), 'Istari sets body text at 19 px.'),
      row('Measure', sel('width', [['istari', 'Istari (42 rem)'], ['vellum', 'Vellum (34 rem, justified)'], ['wide', 'Wide (52 rem)']], applyTheme)),
      row('View', sel('mode', [['live', 'Live preview'], ['source', 'Source'], ['read', 'Read']], () => setMode(s.mode))),
      row('Folder tree', chk('folderTree', 'Show a Folders tab in the sidebar', () => { renderSidebar(); }), 'Notes keep their folder as part of the file path. With a linked folder these are the folders on disk. A Zettelkasten does not need folders, so this is off at first.'),
      row('Link style', sel('linkStyle', [['title', '[[Title]] (readable)'], ['id', '[[ID|Title]] (stable IDs)']]), 'Both styles survive renames: Musubi rewrites links when you change a title.'),
    ],
    editor: () => [
      row('Source font size', sel('editorFontSize', [13, 14, 15, 16, 17, 18].map((x) => [x, x + ' px']), applyTheme), 'For source mode and code.'),
      row('Spell check', chk('spellcheck', 'Check spelling while you write', () => ed.setSpellcheck(s.spellcheck))),
    ],
    math: () => {
      const ta = h('textarea', { class: 'input mono', rows: 16, spellcheck: 'false' }); ta.value = s.macros;
      const prev = h('div', { class: 'prose macro-preview' });
      const upd = debounce(() => { s.macros = ta.value; setMacros(s.macros); saveSettings(); renderPreview();
        prev.innerHTML = renderMarkdown('Preview: $\\abs{x}\\le\\norm{v}$, $\\inner{u}{v}$, $\\pd{f}{x}$, $\\C$, $\\eps$', { idPrefix: 'mp-' }); }, 300);
      ta.addEventListener('input', upd); upd();
      // LaTeX Suite snippets
      const sta = h('textarea', { class: 'input mono', rows: 12, spellcheck: 'false', placeholder: '[\n  {trigger: "RR", replacement: "\\\\mathbb{R}", options: "mA"},\n]' }); sta.value = s.lsSnippets || '';
      const vta = h('textarea', { class: 'input mono', rows: 5, spellcheck: 'false', placeholder: '{\n  "${GREEK}": "alpha|beta|gamma"\n}' }); vta.value = s.lsVariables || '';
      const status = h('div', { class: 'muted small ls-status' });
      const showStatus = () => {
        const c = lsSnippets(); status.textContent = '';
        status.appendChild(document.createTextNode(`${c.list.length} snippets active.`));
        for (const e of c.errors.slice(0, 6)) status.appendChild(h('div', { class: 'ls-error' }, e));
      };
      const saveLs = debounce(() => { s.lsSnippets = sta.value; s.lsVariables = vta.value; saveSettings(); showStatus(); }, 400);
      sta.addEventListener('input', saveLs); vta.addEventListener('input', saveLs);
      const file = h('input', { type: 'file', accept: '.js,.json,.md,.txt', hidden: true });
      file.addEventListener('change', async () => { const f = file.files[0]; if (!f) return; sta.value = await f.text(); file.value = ''; saveLs(); });
      showStatus();
      const lsChk = (key, label) => chk(key, label, showStatus);
      return [
        row('Equation numbers', chk('autoNumber', 'Number equation, align and gather environments', () => { renderPreview(); }), 'Use \\label{eq:name} and \\eqref{eq:name}. Starred forms and \\nonumber stay unnumbered.'),
        h('div', { class: 'set-block' }, h('b', null, 'KaTeX macros'), h('div', { class: 'muted small' }, 'These apply to every note. A note can also define its own with \\newcommand.'), ta, prev),
        h('h3', { class: 'set-h' }, 'LaTeX Suite snippets'),
        h('p', { class: 'muted small' }, 'Shortcuts from the Obsidian plugin LaTeX Suite: mk for inline math, dm for display math, // or x/ for a fraction, sr for a square, @a for \\alpha, Tab to jump to the next field or out of brackets, and more. The snippet format is the same, so you can paste your own LaTeX Suite snippets here.'),
        row('Snippets', h('div', { class: 'check-col' }, lsChk('lsEnabled', 'Expand snippets while typing'), lsChk('lsDefaults', 'Include the LaTeX Suite default snippets'))),
        row('Editing aids', h('div', { class: 'check-col' }, lsChk('lsAutofraction', 'Auto-fraction: x/ becomes \\frac{x}{}'), lsChk('lsTabout', 'Tabout: Tab leaves brackets and the equation'),
          lsChk('lsMatrix', 'Matrix shortcuts: Tab adds &, Enter adds \\\\ in matrix, cases and align'), lsChk('lsEnlarge', 'Enlarge brackets around \\sum, \\int and \\frac'), lsChk('lsAutoDelete', 'Backspace in empty inline math deletes both $'))),
        h('div', { class: 'set-block' }, h('b', null, 'Your snippets'),
          h('div', { class: 'muted small' }, 'A JavaScript array in LaTeX Suite format. Your snippets come before the defaults. Options: t text, m math, M display math, n inline math, A automatic, r regex, w word boundary, v visual. Tabstops: $0, $1, ${0:default}.'),
          sta, h('div', { class: 'btn-row' }, h('button', { class: 'btn btn-sm', onclick: () => file.click() }, 'Load a snippet file'), file,
            h('button', { class: 'btn btn-sm', onclick: () => { sta.value = ''; vta.value = ''; saveLs(); } }, 'Clear')),
          h('details', null, h('summary', { class: 'muted small' }, 'Snippet variables'), h('div', { class: 'muted small' }, 'An object that adds to or replaces ${GREEK}, ${SYMBOL}, ${MORE_SYMBOLS} and ${ACCENT}.'), vta),
          status),
      ];
    },
    study: () => {
      const total = cardsAll().length; const known = Object.keys(app.srs).filter((k) => !k.startsWith('_')).length;
      return [
        row('New cards per day', sel('newPerDay', [0, 5, 10, 20, 30, 50, 100].map((x) => [x, String(x)]), updateDueBadge)),
        row('Cards from statements', chk('autoCards', 'Make a card from each named definition, theorem, lemma, axiom or law block', updateDueBadge), 'Add the word nocard after the brackets to skip one block.'),
        h('p', { class: 'muted' }, `${total} cards in the vault; ${known} have a review history.`),
        row('Reset schedule', h('button', { class: 'btn btn-danger btn-sm', onclick: async () => {
          if (await confirmDialog('Reset all review history?', 'All cards become new again.', 'Reset', true)) { app.srs = {}; saveSrs(); updateDueBadge(); toast('Review history reset'); }
        } }, 'Reset')),
      ];
    },
    types: () => {
      const wrap = h('div', { class: 'types-pane' });
      const commit = () => { s.customTypes = (s.customTypes || []).slice(); saveSettings(); applyCustomTypes(s.customTypes); refreshTypeOptions(); };
      const draw = () => {
        wrap.innerHTML = '';
        wrap.appendChild(h('p', { class: 'muted' }, 'Every note has a type. Its marker shows the type in the note list, the type key and the graph. Make your own types with a name, a shape and an Istari pigment.'));
        wrap.appendChild(h('div', { class: 'type-chips' }, ...NOTE_TYPES.slice(0, BUILTIN_TYPE_COUNT).map(([id, l]) => h('span', { class: 'type-chip', title: 'Built-in type' }, h('span', { class: 'dot t-' + id }), l))));
        wrap.appendChild(h('h3', { class: 'set-h' }, 'Your types'));
        const list = s.customTypes || [];
        if (!list.length) wrap.appendChild(h('p', { class: 'muted small' }, 'None yet. Add one below, for example "Lemma", "Conjecture", "Experiment" or "Thought experiment".'));
        list.forEach((t, i) => {
          const color = PIGMENT[t.color] || PIGMENT.ash;
          const used = vault.all().filter((n) => n.type === t.id).length;
          const name = h('input', { class: 'input type-name', value: t.label, 'aria-label': 'Name of the type' });
          name.addEventListener('change', () => { const v = name.value.trim(); if (!v) { name.value = t.label; return; } t.label = v; commit(); draw(); });
          wrap.appendChild(h('div', { class: 'type-row', 'data-type': t.id },
            h('div', { class: 'type-row-head' },
              h('span', { class: 'dot type-preview t-' + t.id }), name,
              h('code', { class: 'type-id', title: 'Notes store this in their front matter' }, 'type: ' + t.id),
              h('span', { class: 'muted small' }, used ? `${used} note${used === 1 ? '' : 's'}` : ''),
              h('button', { class: 'link-btn type-del', onclick: async () => {
                const msg = used ? `${used} note${used === 1 ? ' keeps' : 's keep'} “type: ${t.id}” and show a plain marker until you make the type again.` : 'No note uses this type.';
                if (!(await confirmDialog(`Delete the type “${t.label}”?`, msg, 'Delete', true))) return;
                s.customTypes = list.filter((x) => x !== t); commit(); draw();
              } }, 'Delete')),
            h('div', { class: 'type-picks' },
              h('div', { class: 'shape-picks', role: 'radiogroup', 'aria-label': 'Shape' }, ...TYPE_SHAPES.map(([k, l]) => h('button', {
                class: 'shape-btn' + (t.shape === k ? ' on' : ''), title: l, 'aria-label': l, role: 'radio', 'aria-checked': String(t.shape === k),
                onclick: () => { t.shape = k; commit(); draw(); } }, h('span', { class: 'dot shape-' + k, style: '--tc:' + color })))),
              h('div', { class: 'color-picks', role: 'radiogroup', 'aria-label': 'Colour' }, ...ISTARI_PIGMENTS.map(([k, l, c]) => h('button', {
                class: 'swatch' + (t.color === k ? ' on' : ''), title: l, 'aria-label': l, role: 'radio', 'aria-checked': String(t.color === k), style: 'background:' + c,
                onclick: () => { t.color = k; commit(); draw(); } }))))));
        });
        const nameIn = h('input', { class: 'input', placeholder: 'Name of a new type', 'aria-label': 'Name of a new type' });
        const add = () => {
          const label = nameIn.value.trim(); if (!label) { nameIn.focus(); return; }
          let id = typeSlug(label) || 'type'; const taken = new Set(TYPE_IDS); let k = 2; const base = id;
          while (taken.has(id)) id = `${base}-${k++}`;
          const usedColors = new Set((s.customTypes || []).map((x) => x.color));
          const color = (ISTARI_PIGMENTS.find(([c]) => !usedColors.has(c)) || ISTARI_PIGMENTS[0])[0];
          s.customTypes = [...(s.customTypes || []), { id, label, shape: 'star', color }];
          commit(); draw(); toast(`Type “${label}” added`);
        };
        nameIn.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); add(); } });
        wrap.appendChild(h('div', { class: 'btn-row type-add' }, nameIn, h('button', { class: 'btn btn-sm btn-cta', onclick: add }, 'Add type')));
        wrap.appendChild(h('p', { class: 'muted small' }, 'A type can have its own template (Settings, Templates). Search with type:name.'));
      };
      draw();
      return [wrap];
    },
    templates: () => {
      const typeSel = h('select', { class: 'input' }, ...NOTE_TYPES.map(([k, l]) => h('option', { value: k }, l)));
      const ta = h('textarea', { class: 'input mono', rows: 14, spellcheck: 'false' });
      const load = () => { ta.value = s.templates[typeSel.value] || ''; };
      typeSel.addEventListener('change', load);
      ta.addEventListener('input', () => { s.templates = Object.assign({}, s.templates, { [typeSel.value]: ta.value }); saveSettings(); });
      load();
      return [h('p', { class: 'muted' }, 'A new note starts from the template of its type. {{title}} becomes the title.'),
        row('Type', typeSel), ta,
        h('button', { class: 'btn btn-sm', onclick: () => { s.templates = Object.assign({}, s.templates, { [typeSel.value]: DEFAULT_TEMPLATES[typeSel.value] || '' }); saveSettings(); load(); } }, 'Restore default for this type')];
    },
    data: () => {
      const trashBox = h('div', { class: 'trash-list' }, h('p', { class: 'muted small' }, 'Loading…'));
      store.allTrash().then((items) => {
        trashBox.innerHTML = '';
        if (!items.length) { trashBox.appendChild(h('p', { class: 'muted small' }, 'The trash is empty.')); return; }
        items.sort((a, b) => b.deletedAt - a.deletedAt);
        for (const it of items) trashBox.appendChild(h('div', { class: 'trash-item' }, h('span', null, it.title), h('span', { class: 'muted small' }, relTime(it.deletedAt)),
          h('button', { class: 'btn btn-sm', onclick: async () => { await restoreFromTrash(it.id); ov.close(); } }, 'Restore')));
        trashBox.appendChild(h('button', { class: 'btn btn-danger btn-sm', onclick: async () => {
          if (await confirmDialog('Empty the trash?', 'This deletes the notes for ever.', 'Empty trash', true)) { await store.clearTrash(); ov.close(); openSettings('data'); }
        } }, 'Empty trash'));
      });
      const fsOK = 'showDirectoryPicker' in window;
      return [
        h('div', { class: 'set-note' }, store.mode === 'idb'
          ? 'Your notes live in this browser (IndexedDB). They stay on this device. Export often, or link a folder.'
          : 'This page cannot use browser storage. Notes last only until you close it. Export now, or open Musubi as a downloaded file.'),
        row('Folder sync', fsOK ? (app.folder.status === 'linked'
          ? h('div', { class: 'btn-row' }, h('span', null, `Linked to “${app.folder.name}”`), h('button', { class: 'btn btn-sm', onclick: () => folderRescan(true) }, 'Sync now'), h('button', { class: 'btn btn-sm', onclick: async () => { await unlinkFolder(); ov.close(); openSettings('data'); } }, 'Unlink'))
          : h('button', { class: 'btn btn-sm', onclick: async () => { await linkFolder(); ov.close(); openSettings('data'); } }, app.folder.status === 'needs-permission' ? 'Reconnect folder' : 'Link a folder'))
          : h('span', { class: 'muted small' }, 'This browser cannot open folders. Use Chrome, Edge or another Chromium browser, or use export and import.'),
        'Each note becomes a Markdown file with YAML front matter. Edits made in other editors load when you return to this tab.'),
        (() => {
          const sel = h('select', { class: 'input' },
            ...[['folder', 'In a fixed folder'], ['subfolder', 'In a folder next to each note'], ['note', 'In the same folder as the note'], ['root', 'In the vault folder itself']]
              .map(([v, l]) => h('option', { value: v }, l)));
          sel.value = s.attachLocation || 'folder';
          const inp = h('input', { class: 'input mono', spellcheck: 'false' });
          const sync = () => {
            const loc = sel.value; inp.hidden = loc === 'note' || loc === 'root';
            inp.value = loc === 'subfolder' ? (s.attachSubfolder || 'assets') : (s.attachFolder || 'assets');
            inp.placeholder = 'assets';
          };
          sel.addEventListener('change', () => { s.attachLocation = sel.value; saveSettings(); sync(); });
          inp.addEventListener('input', () => { if (sel.value === 'subfolder') s.attachSubfolder = inp.value.trim(); else s.attachFolder = inp.value.trim(); saveSettings(); });
          sync();
          return row('Attachments', h('div', { class: 'btn-row' }, sel, inp),
            'Where a pasted or dropped file goes in the linked folder. Images, PDFs, audio and video show in the note; other files appear as links. Existing files stay where they are. Musubi finds attachments anywhere in the folder by name or by relative path.');
        })(),
        row('Export', h('div', { class: 'btn-row' }, h('button', { class: 'btn btn-sm', onclick: exportZip }, 'Markdown ZIP'), h('button', { class: 'btn btn-sm', onclick: exportJSON }, 'Backup JSON'),
          h('button', { class: 'btn btn-sm', onclick: exportBib }, 'BibTeX'), h('button', { class: 'btn btn-sm', onclick: async () => copyText(JSON.stringify(await backupObject(false)), 'Backup copied to the clipboard') }, 'Copy backup')),
        'If a download does not start (some embedded pages block downloads), use Copy backup and paste it into a .json file.'),
        row('Import', h('div', { class: 'btn-row' }, h('button', { class: 'btn btn-sm', onclick: () => $('#file-input').click() }, 'Files'), h('button', { class: 'btn btn-sm', onclick: () => $('#dir-input').click() }, 'Folder'),
          h('button', { class: 'btn btn-sm', onclick: pasteImport }, 'Paste')),
        'Markdown (Obsidian and Zettlr vaults work), ZIP, Musubi JSON backups, BibTeX (.bib) and images. You can also drop files on the window.'),
        row('Learn', h('div', { class: 'btn-row' }, h('button', { class: 'btn btn-sm', onclick: () => { ov.close(); startTour(); } }, 'Take the tour'),
          h('button', { class: 'btn btn-sm', onclick: () => { ov.close(); seedVault(true); } }, 'Add example notes')), 'The tour removes its practice notes when it ends. Example notes stay until you delete them.'),
        h('div', { class: 'set-block' }, h('b', null, 'Trash'), trashBox),
        row('Delete everything', h('button', { class: 'btn btn-danger btn-sm', onclick: async () => {
          const v = await promptDialog('Delete all notes?', 'Type DELETE to confirm. Export first if you want a copy.', '', 'Delete all');
          if (v !== 'DELETE') return;
          for (const n of vault.all()) await store.putTrash(Object.assign(plainNote(n), { deletedAt: Date.now() }));
          await store.clearNotes(); vault.notes.clear(); vault.touch(); app.current = null; refreshLists(); showEmpty(); ov.close(); toast('All notes moved to the trash');
        } }, 'Delete all notes'), 'Notes move to the trash first.'),
      ];
    },
    shortcuts: () => [h('div', { class: 'prose shortcuts', html: renderMarkdown(SHORTCUTS_MD, { idPrefix: 'sc-' }) })],
    about: () => [h('div', { class: 'prose', html: renderMarkdown(ABOUT_MD, { idPrefix: 'ab-' }) })],
    install: () => [h('div', { class: 'prose', html: renderMarkdown(INSTALL_MD(), { idPrefix: 'in-' }) }),
      PWA.can && !pwaStandalone() ? h('div', { class: 'btn-row' }, h('button', { class: 'btn btn-cta', onclick: pwaInstall }, 'Install Musubi')) : null].filter(Boolean),
  };
  const show = (k) => {
    tab = k;
    $$('button', nav).forEach((b) => b.classList.toggle('on', b.dataset.k === k));
    pane.innerHTML = ''; pane.appendChild(h('h2', null, tabs.find((t) => t[0] === k)[1]));
    for (const el of renderers[k]()) pane.appendChild(el);
    pane.scrollTop = 0;
  };
  for (const [k, l] of tabs) nav.appendChild(h('button', { 'data-k': k, onclick: () => show(k) }, l));
  ov = overlay('ov-settings', h('div', { class: 'settings' }, h('div', { class: 'rv-head' }, h('b', null, 'Settings'),
    h('button', { class: 'icon-btn', title: 'Close', html: icon('x', 18), onclick: () => ov.close() })), h('div', { class: 'set-body' }, nav, pane)),
  { onClose: () => { renderPreview(); refreshLists(); } });
  show(tab);
}

const SHORTCUTS_MD = `
| Keys | Action |
|---|---|
| <kbd>Ctrl/⌘ K</kbd> | Find a note, or type \`>\` for commands |
| <kbd>Ctrl/⌘ Shift K</kbd> | Command list |
| <kbd>Ctrl/⌘ E</kbd> | Read or edit |
| <kbd>Ctrl/⌘ Shift E</kbd> | Source mode (plain Markdown) or live preview |
| <kbd>Alt</kbd> + click | Edit a rendered link instead of following it |
| <kbd>Ctrl/⌘ S</kbd> | Save now (saving is automatic) |
| <kbd>Alt N</kbd> / <kbd>Alt C</kbd> | New note / quick capture (on a Mac, while typing: <kbd>Ctrl Option</kbd>) |
| <kbd>Alt B</kbd> | Branch: new note that continues this one |
| <kbd>Alt G</kbd> / <kbd>Alt R</kbd> | Graph / review |
| <kbd>Ctrl/⌘ B</kbd>, <kbd>I</kbd> | Bold, italic |
| <kbd>Ctrl/⌘ M</kbd> / <kbd>Shift M</kbd> | Inline math / display math |
| <kbd>Ctrl/⌘ Shift L</kbd> | Wrap as a link |
| <kbd>Ctrl/⌘ Shift D</kbd> | Wrap as a cloze deletion |
| <kbd>Tab</kbd> / <kbd>Shift Tab</kbd> | Indent / outdent lines |
| <kbd>Alt</kbd> + hover | Preview a note from the sidebar |
| <kbd>Ctrl/⌘ ,</kbd> | Settings |
| <kbd>?</kbd> | This page (when the cursor is not in a note or field) |

## Typing mathematics (LaTeX Suite)

These follow the Obsidian plugin LaTeX Suite. Change them in Settings, Mathematics.

| Type | Result |
|---|---|
| \`mk\` / \`dm\` | Inline math / display math |
| \`x/\`, \`(a+b)/\`, \`//\` | \`\\frac{x}{}\`, \`\\frac{a+b}{}\`, \`\\frac{}{}\` |
| \`sr\`, \`cb\`, \`rd\`, \`_\` | \`^{2}\`, \`^{3}\`, \`^{}\`, \`_{}\` |
| \`x1\`, \`@a\`, \`alpha\` | \`x_{1}\`, \`\\alpha\`, \`\\alpha\` |
| \`sq\`, \`ooo\`, \`->\`, \`<=\`, \`!=\`, \`xx\`, \`**\` | \`\\sqrt{}\`, \`\\infty\`, \`\\to\`, \`\\leq\`, \`\\neq\`, \`\\times\`, \`\\cdot\` |
| \`xhat\`, \`xbar\`, \`xvec\`, \`x,.\` | \`\\hat{x}\`, \`\\bar{x}\`, \`\\vec{x}\`, \`\\mathbf{x}\` |
| \`RR\`, \`CC\`, \`NN\`, \`LL\` | \`\\mathbb{R}\`, \`\\mathbb{C}\`, \`\\mathbb{N}\`, \`\\mathcal{L}\` |
| \`sum\` <kbd>Tab</kbd>, \`lim\`, \`dint\`, \`par\` <kbd>Tab</kbd> | Sums, limits, integrals and partial derivatives with fields |
| \`pmat\`, \`bmat\`, \`cases\`, \`align\` | Environments; then <kbd>Tab</kbd> adds \`&\`, <kbd>Enter</kbd> adds \`\\\\\` |
| Select, then \`U\`, \`O\`, \`C\`, \`S\`, \`(\` | Underbrace, overbrace, cancel, square root, brackets around the selection |
| <kbd>Tab</kbd> / <kbd>Shift Tab</kbd> | Next / previous field; out of brackets; out of the equation |
| <kbd>Ctrl/⌘ Z</kbd> | Undo an expansion and keep what you typed |

## Syntax

- Links: \`[[Title]]\`, \`[[Title|label]]\`, \`[[Title#Heading]]\`, embed with \`![[Title]]\` or \`![[Title#Heading]]\`.
- Block references: end a paragraph or list item with \`^my-id\` (or put \`^my-id\` on the line after a box, an equation or a table). Link with \`[[Title#^my-id]]\`, embed with \`![[Title#^my-id]]\`. Type \`[[Title#^\` to search the blocks of a note; Musubi adds the ID for you.
- Typed links: \`supports::[[Note]]\`, \`refutes::[[Note]]\`, \`depends-on::[[Note]]\`, \`generalizes::[[Note]]\`, \`example-of::[[Note]]\`, \`follows::[[Note]]\`. Any word works.
- Math: \`$…$\`, \`$$…$$\`, \`\\[…\\]\`, and \`\\begin{align}…\\end{align}\` at the start of a line. \`\\label{eq:x}\` and \`\\eqref{eq:x}\` work across a note. Chemistry: \`\\ce{H2O}\`.
- Statements: \`:::theorem[Name]\` … \`:::\`. Also definition, lemma, proposition, corollary, axiom, postulate, law, principle, example, exercise, proof, remark, intuition, objection, reply, quote.
- Arguments: \`:::argument[Name]\` with lines \`P1. …\`, \`P2. …\`, \`C. …\`. Add \`[from P1, P2]\` at the end of a line for a justification.
- Citations: \`[@citekey]\`, \`[@citekey, p. 12; @other]\`. A literature note owns the citekey.
- Tags: \`#topology\`, nested \`#physics/quantum\`. Footnotes: \`[^1]\` and \`[^1]: text\`.
- Flashcards: \`{{c1::hidden text}}\`, or a line \`Q: …\` followed by \`A: …\`, or any named definition or theorem block.
- Long answers: \`A:{ … }\`. Everything between the braces is the answer, with lists, display math and paragraphs. Put the closing \`}\` at the end of the answer, on its own line if you like.
- Callouts: \`> [!note] Title\`. Tasks: \`- [ ] item\` (click to tick).
- Plots: a code block that starts with \`\`\`python plot\` draws a figure. Musubi runs a part of Python offline: numpy (\`np\`), \`math\` and matplotlib.pyplot (\`plt\`): plot, scatter, bar, barh, hist, fill_between, errorbar, step, stem, quiver, axhline, axvline, text, annotate, legend, grid, subplots, log scales, and labels with \`$…$\`. def, for, if, while, lambda, list comprehensions and f-strings work. Files, the network and other modules do not.
- Attachments: paste or drop any file. \`![[figure.png]]\`, \`![[figure.png|300]]\` (width), \`![[paper.pdf]]\` (a card that can show the PDF), \`![[talk.mp3]]\`, \`[[data.csv]]\` (a link). Markdown paths work too: \`![caption|300](figures/fig.png)\`, \`[paper](../library/paper.pdf)\`, \`[note](Other.md)\`.
`;

const ABOUT_MD = `
**Musubi** is a free and open-source note platform for Zettelkasten work in mathematics, physics and philosophy. It is one HTML file. It needs no server, no account and no network.

- Version 2.6.1. MIT License. Web app: https://thescholium.github.io/musubi/
- Set in the Istari design system: EB Garamond, Cormorant Garamond and JetBrains Mono (SIL Open Font License 1.1), embedded in the file.
- Bundled libraries: CodeMirror 6 and Lezer (MIT), KaTeX and mhchem (MIT), marked (MIT), DOMPurify (Apache-2.0 or MPL-2.0). Default snippets from Obsidian LaTeX Suite (MIT).
- Your notes are plain Markdown with YAML front matter. You can read them in any editor, and they work in Obsidian.

**Musubi** (結び) is Japanese for a knot or a tie, from the verb *musubu* (結ぶ): to tie, to bind, to join. In Shinto, *musubi* (産霊) is also the power by which things come into being; two of the first three deities named in the *Kojiki*, Takamimusubi and Kamimusubi, carry it in their names. A Zettelkasten works in both senses: links tie separate notes together, and new ideas come out of the ties.
`;

/* ---------- import ---------- */
function idFromDate(ms) {
  const d = new Date(ms || Date.now());
  let id = `${d.getFullYear()}${pad2(d.getMonth() + 1)}${pad2(d.getDate())}${pad2(d.getHours())}${pad2(d.getMinutes())}${pad2(d.getSeconds())}`;
  while (vault.notes.has(id)) id = String(BigInt(id) + 1n);
  return id;
}

/* Where a new attachment goes, by the setting "attachLocation":
   root: the vault's top folder; folder: a fixed folder (attachFolder); note: the note's folder;
   subfolder: a folder (attachSubfolder) inside the note's folder. */
function attachmentPath(name, note) {
  const st = app.settings; const dir = noteDir(note);
  const clean = (p, d) => normPath(p) || d;
  switch (st.attachLocation) {
    case 'root': return name;
    case 'note': return dir + name;
    case 'subfolder': return dir + clean(st.attachSubfolder, 'assets') + '/' + name;
    default: return clean(st.attachFolder, 'assets') + '/' + name;
  }
}
function attachmentLink(name) { return (attKind(name) === 'file' ? '' : '!') + `[[${name}]]`; }
async function saveAsset(blob, hint, note, path) {
  const hintName = String(hint || '').split('/').pop();
  const hintExt = (/\.([A-Za-z0-9]{1,8})$/.exec(hintName) || [])[1];
  const mimeExt = (String(blob.type || '').split('/')[1] || '').replace('svg+xml', 'svg').replace('jpeg', 'jpg').replace(/^x-/, '').replace(/[^a-z0-9]/gi, '');
  const ext = (hintExt || mimeExt || 'bin').toLowerCase();
  let base = hintName.replace(/\.[^.]+$/, '').replace(/[^\w.-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60);
  if (!base || base === 'pasted' || base === 'image' || base === 'file') base = (attKind('x.' + ext) === 'image' ? 'img-' : 'file-') + isoLocal().replace(/[-:T]/g, '');
  let name = base + '.' + ext; let k = 1;
  while (vault.assets.has(name)) name = `${base}-${k++}.${ext}`;
  const entry = { blob, url: URL.createObjectURL(blob), path: path ? normPath(path.replace(/[^/]*$/, '') + name) : attachmentPath(name, note), mtime: 0, size: blob.size || 0, type: blob.type || mimeFor(name), lazy: false };
  vault.assets.set(name, entry);
  await store.putAsset(name, blob, entry);
  if (app.folder.status === 'linked') await folderWriteAsset(entry.path, blob, name).catch(() => {});
  vault.touch();
  return name;
}

async function importFiles(fileList) {
  const files = Array.from(fileList || []);
  if (!files.length) return;
  const incoming = []; let assets = 0; const errors = [];
  const handleText = (name, text, mtime) => {
    const low = name.toLowerCase();
    if (/\.(md|markdown|txt)$/.test(low)) { const n = parseNote(text, { filename: name, mtime }); delete n.file; incoming.push(n); }
    else if (low.endsWith('.json')) {
      const d = JSON.parse(text);
      const notes = Array.isArray(d) ? d : d.notes || [];
      for (const raw of notes) {
        if (typeof raw === 'string') incoming.push(parseNote(raw));
        else if (raw && typeof raw === 'object') incoming.push(Object.assign(parseNote(''), raw, { tags: raw.tags || [], aliases: raw.aliases || [], extra: raw.extra || [] }));
      }
      if (d.srs && typeof d.srs === 'object') for (const [k, v] of Object.entries(d.srs)) if (!(k in app.srs)) app.srs[k] = v;
      if (d.assets) return d.assets;
    } else if (low.endsWith('.bib')) {
      for (const e of parseBibtex(text)) {
        const f = e.fields;
        incoming.push(Object.assign(parseNote(''), {
          title: f.title || e.key, type: 'literature', status: 'draft', citekey: e.key, author: f.author || f.editor || '',
          year: f.year || (f.date || '').slice(0, 4), source: f.journal || f.journaltitle || f.booktitle || f.publisher || f.howpublished || '',
          url: f.url || '', doi: f.doi || '', tags: ['literature'],
          body: (f.abstract ? '> ' + f.abstract + '\n\n' : '') + DEFAULT_TEMPLATES.literature,
          _bib: true,
        }));
      }
    }
    return null;
  };
  for (const f of files) {
    const name = f.webkitRelativePath || f.name;
    if (/(^|\/)\.[^/]/.test(name) || /(^|\/)node_modules\//.test(name)) continue;
    try {
      if (/\.zip$/i.test(name)) {
        const entries = await readZip(await f.arrayBuffer());
        const dec = new TextDecoder();
        for (const en of entries) {
          if (/(^|\/)(\.|__MACOSX)/.test(en.name) && !/\.(musubi|organon)\//.test(en.name)) continue;
          if (/\.(musubi|organon)\/srs\.json$/.test(en.name)) { const d = JSON.parse(dec.decode(en.data)); for (const [k, v] of Object.entries(d)) if (!(k in app.srs)) app.srs[k] = v; }
          else if (/\.(md|markdown|txt|bib)$/i.test(en.name)) handleText(en.name.replace(/^[^/]+\/(?=.*\/)/, ''), dec.decode(en.data), Date.now());
          else if (!/\/$/.test(en.name) && !/\.(json|zip)$/i.test(en.name)) {
            // any other file is an attachment; it keeps its place in the vault
            const base = en.name.split('/').pop(); const ex = vault.assets.get(base);
            if (ex && ex.size === en.data.length) continue;
            await saveAsset(new Blob([en.data], { type: mimeFor(en.name) }), base, null, en.name.replace(/^[^/]+\/(?=.*\/)/, '')); assets++;
          }
        }
      } else if (!/\.(md|markdown|txt|json|bib)$/i.test(name)) {
        const ex = vault.assets.get(f.name);
        if (!(ex && ex.size === f.size)) { await saveAsset(f, f.name); assets++; }
      } else {
        const extraAssets = handleText(name, await f.text(), f.lastModified);
        if (extraAssets) for (const [an, dataUrl] of Object.entries(extraAssets)) {
          await saveAsset(dataUrlToBlob(dataUrl), an); assets++;
        }
      }
    } catch (e) { console.error(e); errors.push(name + ': ' + e.message); }
  }
  const res = await mergeNotes(incoming);
  saveSrs();
  refreshLists();
  const parts = [];
  if (res.added) parts.push(`${res.added} added`); if (res.updated) parts.push(`${res.updated} updated`);
  if (res.skipped) parts.push(`${res.skipped} unchanged`); if (assets) parts.push(`${assets} attachment${assets === 1 ? '' : 's'}`);
  toast('Import: ' + (parts.join(', ') || 'nothing to import') + (errors.length ? ` · ${errors.length} failed` : ''), { kind: errors.length ? 'error' : '', ms: 5000 });
  if (errors.length) console.warn('Import errors', errors);
  if (!app.current && res.firstId) openNote(res.firstId);
}
function dataUrlToBlob(u) {
  const m = /^data:([^;,]*)(;base64)?,(.*)$/s.exec(u);
  if (!m) throw new Error('Bad data URL');
  if (!m[2]) return new Blob([decodeURIComponent(m[3])], { type: m[1] });
  const bin = atob(m[3]); const arr = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
  return new Blob([arr], { type: m[1] || 'application/octet-stream' });
}
function mimeFor(name) {
  const e = name.split('.').pop().toLowerCase();
  return { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif', svg: 'image/svg+xml', webp: 'image/webp', avif: 'image/avif', bmp: 'image/bmp', pdf: 'application/pdf', mp3: 'audio/mpeg', wav: 'audio/wav', m4a: 'audio/mp4', ogg: 'audio/ogg', flac: 'audio/flac', mp4: 'video/mp4', webm: 'video/webm', mov: 'video/quicktime', txt: 'text/plain', csv: 'text/csv' }[e] || 'application/octet-stream';
}

async function mergeNotes(incoming) {
  let added = 0; let updated = 0; let skipped = 0; let firstId = null; const toSave = [];
  for (const n of incoming) {
    if (n._bib) {
      delete n._bib;
      const ex = vault.all().find((x) => x.citekey === n.citekey);
      if (ex) { skipped++; continue; }
    }
    if (!n.id) n.id = idFromDate(parseDate(n.created) || Date.now());
    const ex = vault.get(n.id);
    if (ex) {
      if (ex.body === n.body && ex.title === n.title) { skipped++; continue; }
      if ((n.modified || '') < (ex.modified || '')) { skipped++; continue; }
      Object.assign(ex, n); toSave.push(ex); updated++;
    } else { vault.notes.set(n.id, n); toSave.push(n); added++; if (!firstId) firstId = n.id; }
  }
  vault.touch();
  await store.putNotes(toSave);
  if (app.folder.status === 'linked') for (const n of toSave) await folderWrite(n);
  for (const n of toSave) ed.forget(n.id);
  if (app.current && toSave.some((n) => n.id === app.current)) syncEditorFromNote();
  return { added, updated, skipped, firstId };
}

async function pasteImport() {
  let ov;
  const ta = h('textarea', { class: 'input mono', rows: 12, placeholder: 'Paste Markdown (one note), a JSON backup, or BibTeX entries.' });
  ov = overlay('ov-dialog', h('div', { class: 'dialog' }, h('h3', null, 'Import from text'), ta,
    h('div', { class: 'dialog-actions' }, h('button', { class: 'btn', onclick: () => ov.close() }, 'Cancel'),
      h('button', { class: 'btn btn-primary', onclick: async () => {
        const t = ta.value.trim(); if (!t) return;
        const name = t.startsWith('{') || t.startsWith('[') ? 'paste.json' : /^\s*@\w+\s*[{(]/.test(t) ? 'paste.bib' : 'paste.md';
        ov.close(); await importFiles([new File([t], name, { type: 'text/plain' })]);
      } }, 'Import'))));
  ta.focus();
}

/* ---------- export ---------- */
function safeName(title) {
  return String(title || 'Untitled').replace(/[\\/:*?"<>|#^\[\]]+/g, '-').replace(/\s+/g, ' ').replace(/^[.\s-]+|[.\s]+$/g, '').slice(0, 100) || 'Untitled';
}
function download(blob, name) {
  const url = URL.createObjectURL(blob);
  const a = h('a', { href: url, download: name, style: { display: 'none' } });
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30000);
  toast(`Download: ${name}`);
}
function fileNamesFor(notes) {
  const used = new Set(); const map = new Map();
  for (const n of notes) {
    const dir = typeof noteFolder === 'function' ? noteFolder(n) : '';
    let base = safeName(n.title); let name = dir + base + '.md';
    if (used.has(name.toLowerCase())) name = `${dir}${base} ${n.id}.md`;
    used.add(name.toLowerCase()); map.set(n.id, name);
  }
  return map;
}
async function exportZip() {
  saveCurrent.flush();
  const notes = vault.all().sort((a, b) => (a.id < b.id ? -1 : 1));
  const names = fileNamesFor(notes);
  const files = notes.map((n) => ({ name: 'musubi-vault/' + names.get(n.id), data: serializeNote(n) }));
  for (const [name, a] of vault.assets) {
    const blob = a.blob || (a.path ? await readFolderFile(a.path) : null);
    if (blob) files.push({ name: 'musubi-vault/' + (a.path || 'assets/' + name), data: blob });
  }
  files.push({ name: 'musubi-vault/.musubi/srs.json', data: JSON.stringify(app.srs) });
  files.push({ name: 'musubi-vault/.musubi/settings.json', data: JSON.stringify(app.settings, null, 2) });
  download(await makeZip(files), `musubi-vault-${todayKey()}.zip`);
}
async function backupObject(withAssets) {
  const o = { format: 'musubi', version: 1, exported: isoLocal(), notes: vault.all().map(plainNote), srs: app.srs, settings: app.settings };
  if (withAssets && vault.assets.size) {
    o.assets = {};
    for (const [name, a] of vault.assets) if (a.blob) o.assets[name] = await new Promise((res) => { const r = new FileReader(); r.onload = () => res(r.result); r.readAsDataURL(a.blob); });
  }
  return o;
}
async function exportJSON() {
  saveCurrent.flush();
  download(new Blob([JSON.stringify(await backupObject(true), null, 1)], { type: 'application/json' }), `musubi-backup-${todayKey()}.json`);
}
function exportBib() {
  const lit = vault.all().filter((n) => n.citekey);
  if (!lit.length) { toast('No note has a citekey yet.'); return; }
  const texEsc = (s) => String(s).replace(/([&%#_])/g, '\\$1');
  const out = lit.map((n) => {
    const f = [['title', n.title], ['author', n.author], ['year', n.year], ['journal', n.source], ['doi', n.doi], ['url', n.url]].filter((x) => x[1]);
    return `@misc{${n.citekey},\n${f.map(([k, v]) => `  ${k} = {${k === 'url' || k === 'doi' ? v : texEsc(v)}}`).join(',\n')}\n}`;
  }).join('\n\n');
  download(new Blob([out + '\n'], { type: 'text/plain' }), 'musubi-bibliography.bib');
}

/* ---------- folder sync (File System Access API) ---------- */
async function verifyPerm(handle, ask) {
  const o = { mode: 'readwrite' };
  try {
    if ((await handle.queryPermission(o)) === 'granted') return true;
    if (ask && (await handle.requestPermission(o)) === 'granted') return true;
  } catch (e) { /* ignore */ }
  return false;
}
async function linkFolder() {
  if (!('showDirectoryPicker' in window)) { toast('This browser cannot open folders. Use export and import.', { kind: 'error' }); return; }
  let handle;
  try { handle = await window.showDirectoryPicker({ id: 'musubi', mode: 'readwrite' }); }
  catch (e) { if (e.name !== 'AbortError') toast('The folder could not be opened here: ' + e.message, { kind: 'error' }); return; }
  await useFolderHandle(handle);
}
async function useFolderHandle(handle) {
  saveCurrent.flush();
  app.folder = { handle, name: handle.name, status: 'linked', files: new Map() };
  try { await store.setMeta('folderHandle', handle); } catch (e) { /* handles cannot persist in the memory store */ }
  await folderRescan(true, true);
  renderSidebar();
}
async function reconnectFolder() {
  const handle = app.folder.handle; if (!handle) return linkFolder();
  if (await verifyPerm(handle, true)) { app.folder.status = 'linked'; await folderRescan(true); renderSidebar(); }
}
async function unlinkFolder() {
  await store.delMeta('folderHandle').catch(() => {});
  app.folder = { handle: null, name: '', status: 'none', files: new Map() };
  renderSidebar(); toast('Folder unlinked. Notes stay in the browser.');
}
async function walkDir(dir, prefix = '', out = []) {
  for await (const [name, h2] of dir.entries()) {
    if (name.startsWith('.') || name === 'node_modules') continue;
    if (h2.kind === 'directory') await walkDir(h2, prefix + name + '/', out);
    else out.push({ path: prefix + name, handle: h2 });
  }
  return out;
}
async function getFileHandle(path, create) {
  const parts = path.split('/'); let dir = app.folder.handle;
  for (const p of parts.slice(0, -1)) dir = await dir.getDirectoryHandle(p, { create });
  return dir.getFileHandle(parts[parts.length - 1], { create });
}
let rescanning = false;
async function folderRescan(manual, initial) {
  if (app.folder.status !== 'linked' || rescanning) return;
  rescanning = true;
  try {
    const entries = await walkDir(app.folder.handle);
    const byPath = new Map(vault.all().filter((n) => n.file).map((n) => [n.file, n]));
    const seen = new Set(); const incoming = []; let changed = 0; const seenAssets = new Set(); let assetChanges = 0;
    for (const en of entries) {
      if (!NOTE_EXT.test(en.path)) {
        // an attachment: images are loaded, other files are only registered and read when opened
        const nm = en.path.split('/').pop(); seenAssets.add(nm);
        const ex = vault.assets.get(nm);
        if (ex && ex.path && ex.path !== en.path) continue; // another file with the same name: the first one wins
        const f = await en.handle.getFile();
        if (ex && !ex.mtime && ex.blob) { ex.path = en.path; ex.mtime = f.lastModified; await store.putAsset(nm, ex.blob, ex); continue; }
        if (ex && ex.mtime && f.lastModified <= ex.mtime) { if (!ex.path) ex.path = en.path; continue; }
        const eager = attKind(nm) === 'image';
        if (ex && ex.url) URL.revokeObjectURL(ex.url);
        const entry = { path: en.path, mtime: f.lastModified, size: f.size, type: f.type || mimeFor(nm), blob: eager ? f : null, url: eager ? URL.createObjectURL(f) : null, lazy: !eager };
        vault.assets.set(nm, entry); await store.putAsset(nm, eager ? f : null, entry);
        assetChanges++;
        continue;
      }
      seen.add(en.path);
      const file = await en.handle.getFile();
      const known = byPath.get(en.path);
      if (known && known.fileMtime && file.lastModified <= known.fileMtime) continue;
      const n = parseNote(await file.text(), { filename: en.path, mtime: file.lastModified });
      n.fileMtime = file.lastModified;
      if (known) {
        if (!n.id) n.id = known.id;
        if (known.id === n.id && serializeNote(known) === serializeNote(Object.assign({}, n, { file: known.file }))) { known.fileMtime = file.lastModified; continue; }
        if (n.id === app.current && app.dirty) continue;
        Object.assign(known, n); await store.putNote(known); changed++;
      } else {
        if (n.id && vault.get(n.id)) {
          const ex = vault.get(n.id);
          if (!ex.file) { ex.file = n.file; ex.fileMtime = n.fileMtime; if (n.modified > ex.modified) Object.assign(ex, n); await store.putNote(ex); continue; }
        }
        incoming.push(n);
      }
    }
    for (const n of incoming) { if (!n.id) n.id = idFromDate(n.fileMtime); vault.notes.set(n.id, n); changed++; }
    if (incoming.length) await store.putNotes(incoming);
    // notes whose file vanished: deleted in another editor
    for (const [p, n] of byPath) {
      if (!seen.has(p) && !initial) {
        await store.putTrash(Object.assign(plainNote(n), { deletedAt: Date.now() })); await store.deleteNote(n.id);
        vault.notes.delete(n.id); changed++;
        if (app.current === n.id) app.current = null;
      }
    }
    // attachments that exist only in the folder and were deleted there
    if (!initial) for (const [nm, a] of Array.from(vault.assets)) if (a.lazy && !seenAssets.has(nm)) { vault.assets.delete(nm); await store.delAsset(nm).catch(() => {}); assetChanges++; }
    vault.touch();
    if (initial) {
      for (const n of vault.all()) if (!n.file || !seen.has(n.file)) await folderWrite(n);
      for (const [name, a] of vault.assets) if (a.blob && !seenAssets.has(name)) await folderWriteAsset(a.path || attachmentPath(name, null), a.blob, name).catch(() => {});
    }
    if (assetChanges && app.current) { ed.refresh(); if (app.settings.mode === 'read') renderPreview(); }
    if (changed || initial) {
      refreshLists();
      if (app.current && vault.get(app.current) && !app.dirty) {
        const c = cur(); syncEditorFromNote();
        fillHeader(c); renderMentions(); renderPanel();
      } else if (!app.current) { const f = vault.all()[0]; if (f) openNote(f.id, { replace: true }); else showEmpty(); }
    }
    if (manual) toast(initial ? `Folder linked: ${app.folder.name}` : `Synced${changed ? `: ${changed} change(s)` : ''}`);
  } catch (e) {
    console.error(e); toast('Folder sync failed: ' + e.message, { kind: 'error' });
    if (e.name === 'NotAllowedError') { app.folder.status = 'needs-permission'; renderSidebar(); }
  } finally { rescanning = false; }
}
async function folderWrite(n) {
  if (app.folder.status !== 'linked') return;
  try {
    let path = n.file;
    const desired = safeName(n.title) + '.md';
    const dir = path && path.includes('/') ? path.slice(0, path.lastIndexOf('/') + 1) : '';
    if (!path || (path.split('/').pop() !== desired && !vault.all().some((o) => o !== n && o.file === dir + desired))) {
      const old = path; path = dir + desired;
      if (vault.all().some((o) => o !== n && o.file && o.file.toLowerCase() === path.toLowerCase())) path = dir + safeName(n.title) + ' ' + n.id + '.md';
      if (old && old !== path) { try { await removePath(old); } catch (e) { /* missing */ } }
    }
    const fh = await getFileHandle(path, true);
    const w = await fh.createWritable(); await w.write(serializeNote(n)); await w.close();
    n.file = path; n.fileMtime = (await fh.getFile()).lastModified;
    await store.putNote(n);
  } catch (e) {
    console.error(e);
    if (e.name === 'NotAllowedError') { app.folder.status = 'needs-permission'; renderSidebar(); }
    toast('Could not write to the folder: ' + e.message, { kind: 'error' });
  }
}
async function folderWriteAsset(path, blob, name) {
  const fh = await getFileHandle(path, true);
  const w = await fh.createWritable(); await w.write(blob); await w.close();
  const a = name && vault.assets.get(name);
  if (a) { a.path = path; a.mtime = (await fh.getFile()).lastModified; await store.putAsset(name, a.lazy ? null : a.blob, a).catch(() => {}); }
}
/* Read a file of the linked folder (for attachments that stay only there). */
async function readFolderFile(path) {
  if (app.folder.status !== 'linked') return null;
  try { const fh = await getFileHandle(path, false); return await fh.getFile(); } catch (e) { return null; }
}
async function removePath(path) {
  const parts = path.split('/'); let dir = app.folder.handle;
  for (const p of parts.slice(0, -1)) dir = await dir.getDirectoryHandle(p);
  await dir.removeEntry(parts[parts.length - 1]);
}
async function folderRemove(n) {
  if (app.folder.status !== 'linked' || !n.file) return;
  try { await removePath(n.file); } catch (e) { /* already gone */ }
}

/* ---------- keyboard, routing, boot ---------- */
function bindGlobal() {
  // In-page links (#n-…, #heading) must never navigate the document: inside a srcdoc frame
  // a fragment URL resolves against the parent's address and would unload the app.
  document.addEventListener('click', (e) => {
    const a = e.target.closest && e.target.closest('a[href^="#"]');
    if (!a) return;
    e.preventDefault();
    // attachment links outside the editor (the editor opens them on mousedown)
    if (a.dataset.att && !a.closest('.cm-editor') && e.button === 0 && !e.altKey) openAttachment(a.dataset.att);
  }, true);
  document.addEventListener('keydown', (e) => {
    const mod = e.ctrlKey || e.metaKey; const k = e.key.toLowerCase();
    if (e.key === 'Escape') {
      if (app.overlays.length) { e.preventDefault(); app.overlays[app.overlays.length - 1].close(); return; }
      hideHoverCard(); document.body.classList.remove('side-open', 'panel-open');
      return;
    }
    if (app.overlays.length) {
      if (mod && k === 'k') { e.preventDefault(); }
      return;
    }
    if (mod && e.key === ',') { e.preventDefault(); openSettings(); return; }
    if (mod && k === 'k') { e.preventDefault(); openPalette(e.shiftKey ? '>' : ''); return; }
    if (mod && e.shiftKey && k === 'p') { e.preventDefault(); openPalette('>'); return; }
    if (mod && !e.shiftKey && k === 'p') { e.preventDefault(); openPalette(''); return; }
    if (mod && !e.shiftKey && k === 'e') { e.preventDefault(); setMode(app.settings.mode === 'read' ? 'live' : 'read'); return; }
    if (mod && e.shiftKey && k === 'e') { e.preventDefault(); setMode(app.settings.mode === 'source' ? 'live' : 'source'); return; }
    if (mod && k === 's') { e.preventDefault(); saveCurrent.flush(); setSaveState('saved'); return; }
    // Typing in any text field, including the editor (a contenteditable element), must never trigger
    // one-key shortcuts. On a Mac, Option+letter types characters (ç, ∫, ®), so in a text field
    // the Alt shortcuts there need Ctrl+Option.
    const ae = document.activeElement;
    const inField = !!ae && (/^(INPUT|TEXTAREA|SELECT)$/.test(ae.tagName) || ae.isContentEditable || !!(ae.closest && ae.closest('.cm-editor')));
    const mac = /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent);
    const altShortcut = e.altKey && !e.metaKey && (mac && inField ? e.ctrlKey : !e.ctrlKey);
    if (mod && e.altKey && (e.key === 'ArrowLeft' || e.key === 'ArrowRight')) { e.preventDefault(); navGo(e.key === 'ArrowLeft' ? -1 : 1); return; }
    if (!inField && e.altKey && !mod && (e.key === 'ArrowLeft' || e.key === 'ArrowRight')) { e.preventDefault(); navGo(e.key === 'ArrowLeft' ? -1 : 1); return; }
    if (altShortcut) {
      const c = e.code;
      if (paneShortcut(c)) { e.preventDefault(); return; }
      if (c === 'KeyN') { e.preventDefault(); newNoteDialog(); return; }
      if (c === 'KeyC') { e.preventDefault(); captureDialog(); return; }
      if (c === 'KeyG') { e.preventDefault(); openGraph(); return; }
      if (c === 'KeyR') { e.preventDefault(); openReview(); return; }
      if (c === 'KeyB') { e.preventDefault(); branchNote(); return; }
    }
    if (!inField && e.key === '?') { e.preventDefault(); openSettings('shortcuts'); }
  });
  window.addEventListener('hashchange', () => {
    const m = /^#n-(.+)$/.exec(readHash());
    if (m && vault.get(decodeURIComponent(m[1])) && decodeURIComponent(m[1]) !== app.current) openNote(decodeURIComponent(m[1]), { fromHash: true });
  });
  // drop files to import
  let dragDepth = 0;
  document.addEventListener('dragenter', (e) => { if (e.dataTransfer && Array.from(e.dataTransfer.types || []).includes('Files')) { dragDepth++; document.body.classList.add('dropping'); } });
  document.addEventListener('dragleave', () => { dragDepth = Math.max(0, dragDepth - 1); if (!dragDepth) document.body.classList.remove('dropping'); });
  document.addEventListener('dragover', (e) => { if (e.dataTransfer && Array.from(e.dataTransfer.types || []).includes('Files')) e.preventDefault(); });
  document.addEventListener('drop', (e) => {
    dragDepth = 0; document.body.classList.remove('dropping');
    if (e.defaultPrevented) return;
    if (e.dataTransfer && e.dataTransfer.files.length) { e.preventDefault(); importFiles(e.dataTransfer.files); }
  });
  $('#file-input').addEventListener('change', (e) => { importFiles(e.target.files); e.target.value = ''; });
  $('#dir-input').addEventListener('change', (e) => { importFiles(e.target.files); e.target.value = ''; });
  window.addEventListener('focus', () => { if (app.folder.status === 'linked') folderRescan(false); });
  // the back and forward buttons of a mouse
  window.addEventListener('mouseup', (e) => { if ((e.button === 3 || e.button === 4) && !app.overlays.length) { e.preventDefault(); navGo(e.button === 3 ? -1 : 1); } });
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') saveCurrent.flush(); });
  window.addEventListener('beforeunload', () => { saveCurrent.flush(); });
  window.addEventListener('resize', debounce(() => { applyLayout(); sizeTitle(); }, 150));
  setInterval(updateDueBadge, 60000);
}

function mergeSettings(saved) {
  const s = JSON.parse(JSON.stringify(DEFAULT_SETTINGS));
  for (const k of Object.keys(saved || {})) {
    if (k === 'sections' || k === 'templates') s[k] = Object.assign({}, s[k], saved[k]);
    else s[k] = saved[k];
  }
  if (!['live', 'source', 'read'].includes(s.mode)) s.mode = 'live';
  if (!['istari', 'vellum', 'wide'].includes(s.width)) s.width = 'istari';
  if (s.fontSize < 16) s.fontSize = 19;
  for (const k of Object.keys(s.templates)) if (/::\[\[ \]\]/.test(s.templates[k])) s.templates[k] = DEFAULT_TEMPLATES[k];
  return s;
}

async function boot() {
  buildShell();
  bindNoteView();
  bindGlobal();
  pwaInit();
  await store.open();
  try { app.settings = mergeSettings(await store.getMeta('settings')); } catch (e) { /* defaults */ }
  applyCustomTypes(app.settings.customTypes); refreshTypeOptions();
  try { app.srs = (await store.getMeta('srs')) || {}; } catch (e) { app.srs = {}; }
  setMacros(app.settings.macros);
  applyTheme(); applyLayout();
  const notes = await store.allNotes().catch(() => []);
  for (const n of notes) {
    n.tags = Array.isArray(n.tags) ? n.tags : []; n.aliases = Array.isArray(n.aliases) ? n.aliases : []; n.extra = n.extra || []; n.body = n.body || '';
    vault.notes.set(n.id, n);
  }
  vault.touch();
  try { for (const a of await store.allAssets()) vault.assets.set(a.name, { blob: a.blob || null, url: a.blob ? URL.createObjectURL(a.blob) : null, path: a.path || '', mtime: a.mtime || 0, size: a.size || (a.blob && a.blob.size) || 0, type: a.type || (a.blob && a.blob.type) || '', lazy: !a.blob }); } catch (e) { /* none */ }
  await migrateStarterNotes();
  try {
    const handle = await store.getMeta('folderHandle');
    if (handle && handle.kind === 'directory') {
      app.folder = { handle, name: handle.name, status: (await verifyPerm(handle, false)) ? 'linked' : 'needs-permission', files: new Map() };
      if (app.folder.status === 'linked') folderRescan(false);
    }
  } catch (e) { /* not supported */ }
  try {
    app.bc = new BroadcastChannel('musubi');
    app.bc.onmessage = async (ev) => {
      const { type, id } = ev.data || {};
      if (type === 'put') {
        const rec = await store.getNote(id); if (!rec) return;
        const ex = vault.get(id);
        if (ex && app.current === id && app.dirty) return;
        if (ex) Object.assign(ex, rec); else vault.notes.set(id, rec);
        vault.touch(); refreshListsSoon();
        if (app.current === id) { syncEditorFromNote(); fillHeader(cur()); renderMentions(); } else ed.forget(id);
      } else if (type === 'del') {
        vault.notes.delete(id); vault.touch(); refreshListsSoon();
        if (app.current === id) { app.current = null; showEmpty(); }
      }
    };
  } catch (e) { app.bc = null; }
  renderSidebar();
  updateDueBadge();
  panesRestore(); applySplit();
  const m = /^#n-(.+)$/.exec(readHash());
  const hashId = m && vault.get(decodeURIComponent(m[1])) ? decodeURIComponent(m[1]) : null;
  const t0 = tabOf(panes.notePane);
  let target = hashId || panesStartNote();
  if (!target && !(t0 && t0.k === 'note' && t0.id == null)) target = (vault.get(app.settings.lastNote) && app.settings.lastNote) || (vault.all().sort(byModified)[0] || {}).id;
  if (tabOf(panes.notePane) && tabOf(panes.notePane).k === 'pdf') activateTab(panes.notePane, panes.list[panes.notePane].active);
  else if (target) openNote(target, { replace: true }); else showEmpty();
  if (panes.split) renderPaneBody(otherPane(panes.notePane));
  document.documentElement.classList.add('ready');
  pwaLaunchAction();
  updateFolderBanner();
  window.musubi = { app, vault, store, ed, applyTheme, setMode, renderPreview, openSettings, renderSidebar, refreshLists, renderMarkdown, extractCards, openNote, createNote, searchNotes, parseNote, serializeNote, importFiles, makeZip, readZip, parseBibtex, dueQueue, graphData, useFolderHandle, folderRescan, startTour, endTour, seedVault, addLinkDialog, lsSnippets, lsParseSource, openReview, openPhilosophy, updateFolderBanner, saveAsset, assetUrl, findAsset, attachmentPath };
  if (app.settings.tour && app.settings.tour.active) resumeTour();
  else if (tourDue()) startTour({ firstRun: true });
}

document.addEventListener('DOMContentLoaded', () => { boot().catch((e) => { console.error(e); document.body.innerHTML = `<pre style="padding:2em;white-space:pre-wrap">Musubi could not start: ${esc(e && e.stack || e)}</pre>`; }); });
