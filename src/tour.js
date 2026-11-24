/* Musubi onboarding tour and the add-link dialog.
   The tour practises on notes of its own. When it ends, it removes every note, history entry,
   flashcard schedule, trash entry and image made after it started. */

/* ---------- add a link (plain by default, relation optional) ---------- */
function addLinkDialog() {
  const c = cur(); if (!c) return;
  const atCursor = app.settings.mode !== 'read' && ed.view && document.activeElement && ed.view.dom.contains(document.activeElement);
  const pos = atCursor ? ed.selection().to : null;
  let ov; let items = []; let sel = 0;
  const input = h('input', { class: 'input', placeholder: 'Find the note to link to', 'aria-label': 'Note', autocomplete: 'off', spellcheck: 'false' });
  const list = h('div', { class: 'pal-list dl-list', role: 'listbox' });
  const rel = h('select', { class: 'input', 'aria-label': 'Relation' }, h('option', { value: '' }, 'no relation (plain link)'),
    ...REL_SUGGEST.map((r) => h('option', { value: r }, r)));
  const update = () => {
    const q = input.value; list.innerHTML = '';
    items = quickFind(q, 8).filter((n) => n.id !== c.id).map((n) => ({ note: n }));
    if (q.trim() && !resolveTarget(q.trim())) items.push({ create: q.trim() });
    sel = Math.min(sel, Math.max(0, items.length - 1));
    items.forEach((it, i) => {
      const row = it.note
        ? h('div', { class: 'pal-item' + (i === sel ? ' sel' : '') }, h('span', { class: 'dot t-' + it.note.type }), h('div', { class: 'pal-main' }, h('div', { class: 'pal-title' }, it.note.title)), h('span', { class: 'pal-meta' }, TYPE_LABEL[it.note.type] || ''))
        : h('div', { class: 'pal-item pal-create' + (i === sel ? ' sel' : '') }, h('div', { class: 'pal-main' }, h('div', { class: 'pal-title' }, `Create “${it.create}” and link it`)));
      row.addEventListener('click', () => { sel = i; choose(); });
      list.appendChild(row);
    });
    if (!items.length) list.appendChild(h('div', { class: 'pal-empty' }, 'Type a title.'));
  };
  const choose = () => {
    const it = items[sel]; if (!it) return;
    ov.close();
    const target = it.note || createNote({ title: it.create, type: 'concept', status: 'draft', body: '' }, { open: false });
    const text = (rel.value ? rel.value + '::' : '') + linkText(target);
    if (app.settings.mode !== 'read' && app.current === c.id) {
      const body = ed.getText();
      if (pos != null) {
        const pre = pos > 0 && !/\s/.test(body[pos - 1]) ? ' ' : '';
        ed.replaceRange(pos, pos, pre + text);
      } else {
        const sep = body.length && !body.endsWith('\n') ? '\n\n' : body.length && !body.endsWith('\n\n') ? '\n' : '';
        ed.replaceRange(body.length, body.length, sep + text);
      }
    } else {
      c.body = c.body.replace(/\s*$/, '') + (c.body.trim() ? '\n\n' : '') + text + '\n';
      markDirty(); syncEditorFromNote(); renderMentions();
    }
    toast(`Linked to “${target.title}”`);
  };
  input.addEventListener('input', () => { sel = 0; update(); });
  input.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); sel = Math.min(items.length - 1, sel + 1); update(); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); sel = Math.max(0, sel - 1); update(); }
    else if (e.key === 'Enter') { e.preventDefault(); choose(); }
  });
  ov = overlay('ov-dialog', h('div', { class: 'dialog dialog-link' }, h('h3', null, 'Add a link'),
    input, list,
    h('label', { class: 'field' }, h('span', null, 'Relation (optional)'), rel),
    h('p', { class: 'muted small' }, pos != null ? 'The link goes in at the cursor.' : 'The link goes at the end of the note.')));
  update(); input.focus();
}

/* ---------- tour ---------- */
const TOUR_A = 'Musubi';
const TOUR_B = 'Linking number';

function tourNote(title) { return vault.all().find((n) => n.title === title && app.settings.tour && !app.settings.tour.baseline.includes(n.id)); }
function tourEnsureA() {
  let a = tourNote(TOUR_A);
  if (!a) {
    a = createNote({ title: TOUR_A, type: 'concept', status: 'draft', body:
      '**Musubi** (結び) is Japanese for a *knot* or a *tie*. It comes from the verb *musubu* (結ぶ): to tie, to bind, to join. ' +
      'The same word names a bond between people, the ending that ties up a story, and *omusubi*, a rice ball pressed together by hand.\n\n' +
      'In Shinto, *musubi* (産霊) is also the power of becoming: the force by which things come into being. ' +
      'Takamimusubi and Kamimusubi, two of the first three deities named in the *Kojiki*, carry it in their names.\n\n' +
      'A Zettelkasten works in both senses. Links tie notes together, and new ideas come out of the ties.\n\n' +
      'Mathematicians study knots too. When two closed curves are tied together, Gauss\'s integral counts how many times one winds around the other:\n\n' +
      '$$\n\\operatorname{lk}(K_1, K_2) = \\frac{1}{4\\pi} \\oint_{K_1} \\oint_{K_2} \\frac{(\\mathbf{r}_1 - \\mathbf{r}_2) \\cdot (\\dd\\mathbf{r}_1 \\times \\dd\\mathbf{r}_2)}{\\abs{\\mathbf{r}_1 - \\mathbf{r}_2}^3}\n$$\n' }, { open: false });
  }
  return a;
}
function tourEnsureB() {
  let b = tourNote(TOUR_B);
  if (!b) b = createNote({ title: TOUR_B, type: 'definition', status: 'draft', body: 'An integer that counts how many times one closed curve winds around another. It stays the same when the curves move without passing through each other.\n' }, { open: false });
  return b;
}
function tourHasLink() {
  const a = tourNote(TOUR_A); const b = tourNote(TOUR_B);
  if (!a || !b) return false;
  return (vault.index().out.get(a.id) || []).some((l) => l.to === b.id);
}
function tourOpen(n) { if (app.settings.mode === 'read') setMode('live'); openNote(n.id, { replace: true }); }

const TOUR_STEPS = [
  { id: 'welcome', place: 'center', modal: true, title: 'Welcome to Musubi',
    get body() { return '<p><i>Musubi</i> (結び) means a knot or a tie. This Musubi is a Zettelkasten for mathematics, physics and philosophy: small notes, each holding one idea, tied together by links.</p><p>The tour takes about three minutes. You practise on two notes about the name itself. When the tour ends, Musubi deletes them' + (tourHadNotes() ? '. Your own notes stay as they are.</p>' : ', and you start with an empty vault.</p>'); },
    next: 'Start the tour' },
  { id: 'note', target: '#cm-host', place: 'side', title: 'A note renders as you write',
    enter: () => tourOpen(tourEnsureA()),
    body: '<p>Click into the formula below. Its TeX source appears, ready to edit. Click outside it and it renders again.</p><p>Bold, headings, lists and links work the same way: the marks show only where the cursor is.</p>' },
  { id: 'props', target: '#props', place: 'below', title: 'Title, type and status',
    enter: () => tourOpen(tourEnsureA()),
    body: '<p>Each note has a <b>type</b> (definition, theorem, law, argument, …) and a <b>status</b>, from <i>fleeting</i> to <i>permanent</i>.</p><p>Add tags here, or write <code>#tag</code> in the text.</p>' },
  { id: 'link', target: '#cm-host', place: 'side', title: 'Link one idea to another',
    enter: () => { tourEnsureB(); tourOpen(tourEnsureA()); },
    body: '<p>On a new line, type <code>[[</code> and then <code>link</code>. Choose <i>Linking number</i> and press Enter.</p><p>A plain link needs nothing else. To say <i>how</i> two ideas relate, write a word first, such as <code>depends-on::[[…]]</code>. That is optional.</p>',
    check: tourHasLink, done: 'Linked. The link renders as a name you can click.',
    leave: () => { if (!tourHasLink()) { const a = tourEnsureA(); a.body = a.body.replace(/\s*$/, '') + '\n\nSee also [[' + TOUR_B + ']].\n'; ed.forget(a.id); markDirtyFor(a); } } },
  { id: 'theorem', target: '#cm-host', place: 'side', title: 'Statements look like statements',
    enter: () => {
      const a = tourEnsureA();
      if (!a.body.includes(':::theorem')) { a.body = a.body.replace(/\s*$/, '') + '\n\n:::theorem[Gauss]\nFor two disjoint closed curves in $\\R^3$, the linking integral is always an integer.\n:::\n'; ed.forget(a.id); markDirtyFor(a); }
      tourOpen(a);
    },
    body: '<p>A block from <code>:::theorem[Name]</code> to <code>:::</code> becomes a numbered theorem. Definitions, lemmas, proofs, axioms, laws, examples and arguments work the same way. Type <code>:::</code> to choose one.</p><p>Each named statement is also a flashcard.</p>' },
  { id: 'mentions', target: '#mentions', place: 'above', title: 'Links in both directions',
    enter: () => { const b = tourEnsureB(); tourOpen(b); setTimeout(() => $('#mentions').scrollIntoView({ block: 'center' }), 60); },
    body: '<p>This is <i>Linking number</i>. Under every note, Musubi lists its links, the notes that link to it with the sentence around each link, and notes that mention its title without a link.</p>' },
  { id: 'key', target: '.sb-listwrap', place: 'right', title: 'The type key',
    body: '<p>Hold the pointer over the compass for a moment and the key opens.</p><p>The shape of a marker shows the field: circle for general notes, diamond for mathematics, square for physics, triangle for philosophy. Its colour shows the type. Click a type in the key to filter the list.</p>' },
  { id: 'capture', target: '#btn-capture', place: 'right', title: 'Capture, then process',
    body: '<p>Catch a passing thought with <kbd>Alt C</kbd>. It goes to the <i>Inbox</i> as a fleeting note.</p><p>Later, rewrite it in your own words, link it, and mark it permanent.</p>' },
  { id: 'find', target: '#btn-search', place: 'right', title: 'Find anything',
    body: '<p>Press <kbd>Ctrl K</kbd> (<kbd>⌘ K</kbd> on a Mac) to find a note by title or text. Type <code>&gt;</code> to run a command.</p>' },
  { id: 'study', target: '.sb-foot', place: 'right', title: 'Graph and review',
    body: '<p>The <b>graph</b> shows every note and link. <b>Review</b> shows your flashcards, each one just before you would forget it.</p>' },
  { id: 'actions', target: '#btn-more', place: 'below-left', title: 'Note actions',
    body: '<p>Branch a new note from this one, extract a selection into its own note, add a link, see the version history, or switch to source mode.</p><p>The eye beside it switches to reading.</p>' },
  { id: 'data', place: 'center', title: 'Your notes are yours',
    body: '<p>Every note is a plain Markdown file. By default they stay in this browser. In <i>Settings, Data</i> you can link a folder so that each note is a file on your disk, import an Obsidian vault, or export a backup.</p>' },
  { id: 'finish', place: 'center', modal: true, title: 'Ready',
    get body() { return '<p>Musubi will now delete the practice notes and everything made during the tour. ' + (tourHadNotes() ? 'Your own notes stay as they were before the tour.' : 'The vault will be empty and ready for your first note.') + '</p>'; },
    next: 'Clean up and begin' },
];

function markDirtyFor(n) { n.modified = isoLocal(); vault.touch(); persistNote(n); }

/* Raise TOUR_VERSION when the tour changes, so that it opens again once for every user. */
const TOUR_VERSION = 2;
function tourHadNotes() { const t = app.settings.tour; return !!(t && t.baseline && t.baseline.length); }
function tourDue() { return (app.settings.tourSeen || 0) < TOUR_VERSION; }

let tourUI = null;
async function startTour(opts = {}) {
  if (app.settings.tour && app.settings.tour.active) { resumeTour(); return; }
  if (!opts.firstRun && vault.notes.size) {
    const ok = await confirmDialog('Take the tour?', 'The tour adds two practice notes. When it ends, it deletes them and any other note made during the tour. Your existing notes stay as they are.', 'Start the tour');
    if (!ok) return;
  }
  app.settings.tour = { active: true, step: 0, started: Date.now(), baseline: Array.from(vault.notes.keys()),
    assets: Array.from(vault.assets.keys()), srs: Object.keys(app.srs), prevMode: app.settings.mode, current: app.current };
  saveSettings();
  if (app.settings.mode === 'read') setMode('live');
  renderTourStep();
}
function resumeTour() { if (app.settings.tour && app.settings.tour.active) renderTourStep(); }

function renderTourStep() {
  const t = app.settings.tour; if (!t || !t.active) return;
  const step = TOUR_STEPS[Math.max(0, Math.min(TOUR_STEPS.length - 1, t.step))];
  closeTourUI();
  try { step.enter && step.enter(); } catch (e) { console.error(e); }
  const scrim = h('div', { class: 'tour-scrim' + (step.modal || step.place === 'center' ? ' on' : '') });
  const hole = h('div', { class: 'tour-hole', hidden: true });
  const isLast = t.step === TOUR_STEPS.length - 1;
  const status = h('div', { class: 'tour-done', hidden: true });
  const nextBtn = h('button', { class: 'btn btn-cta', onclick: () => tourGo(1) }, step.next || (isLast ? 'Finish' : 'Next'));
  const card = h('div', { class: 'tour-card', role: 'dialog', 'aria-label': step.title },
    h('div', { class: 'tour-count' }, `${t.step + 1} of ${TOUR_STEPS.length}`),
    h('h3', { class: 'tour-title' }, step.title),
    h('div', { class: 'tour-body', html: step.body }),
    status,
    h('div', { class: 'tour-actions' },
      isLast ? null : h('button', { class: 'link-btn tour-skip', title: 'Ends the tour and removes the practice notes', onclick: () => endTour(true) }, 'Skip the tour'),
      h('span', { class: 'grow' }),
      t.step > 0 && !isLast ? h('button', { class: 'btn btn-outline', onclick: () => tourGo(-1) }, 'Back') : null,
      nextBtn));
  document.body.append(scrim, hole, card);
  tourUI = { scrim, hole, card, step, timer: null };
  const place = () => tourPlace(step, hole, card);
  tourUI.place = place;
  requestAnimationFrame(() => { place(); setTimeout(place, 120); setTimeout(place, 400); });
  window.addEventListener('resize', place);
  $('#note-scroll').addEventListener('scroll', place, { passive: true });
  if (step.check) {
    tourUI.timer = setInterval(() => {
      if (step.check()) { status.hidden = false; status.textContent = step.done || 'Done.'; nextBtn.classList.add('pulse'); }
    }, 400);
  }
  setTimeout(() => { if (step.modal || step.place === 'center') nextBtn.focus(); }, 30);
}

function tourPlace(step, hole, card) {
  const vw = window.innerWidth; const vh = window.innerHeight; const cw = Math.min(360, vw - 24);
  card.style.width = cw + 'px';
  const el = step.target ? $(step.target) : null;
  if (!el || step.place === 'center' || el.offsetParent === null) {
    hole.hidden = true;
    card.style.left = Math.round((vw - cw) / 2) + 'px'; card.style.top = Math.round(Math.max(24, (vh - card.offsetHeight) / 2.4)) + 'px';
    return;
  }
  const r = el.getBoundingClientRect(); const pad = 6;
  const top = Math.max(4, r.top - pad); const bottom = Math.min(vh - 4, r.bottom + pad);
  hole.hidden = false;
  Object.assign(hole.style, { left: (r.left - pad) + 'px', top: top + 'px', width: (r.width + pad * 2) + 'px', height: Math.max(12, bottom - top) + 'px' });
  const ch = card.offsetHeight; let x; let y;
  if (step.place === 'right' || (step.place === 'side' && r.left > vw - r.right)) {
    x = step.place === 'right' ? r.right + 16 : r.left - cw - 16; y = r.top;
    if (step.place === 'side' && x < 12) x = r.right + 16;
  } else if (step.place === 'side') { x = r.right + 16; y = r.top + 20; }
  else if (step.place === 'above') { x = r.left + 20; y = r.top - ch - 14; }
  else if (step.place === 'below-left') { x = r.right - cw; y = r.bottom + 12; }
  else { x = r.left; y = r.bottom + 12; }
  if (x + cw > vw - 12) x = vw - cw - 12;
  if (x < 12) x = 12;
  if (y + ch > vh - 12) y = vh - ch - 12;
  if (y < 12) y = 12;
  // never cover the target: if the card overlaps it, put the card at the bottom right
  const ov = !(x > r.right || x + cw < r.left || y > r.bottom || y + ch < r.top);
  if (ov && step.place !== 'right') { x = vw - cw - 16; y = vh - ch - 16; }
  card.style.left = Math.round(x) + 'px'; card.style.top = Math.round(y) + 'px';
}

function closeTourUI() {
  if (!tourUI) return;
  clearInterval(tourUI.timer);
  window.removeEventListener('resize', tourUI.place);
  const ns = $('#note-scroll'); if (ns) ns.removeEventListener('scroll', tourUI.place);
  tourUI.scrim.remove(); tourUI.hole.remove(); tourUI.card.remove();
  tourUI = null;
}

function tourGo(d) {
  const t = app.settings.tour; if (!t) return;
  const step = TOUR_STEPS[t.step];
  if (d > 0) { try { step.leave && step.leave(); } catch (e) { console.error(e); } }
  if (d > 0 && t.step >= TOUR_STEPS.length - 1) { endTour(false); return; }
  t.step = Math.max(0, Math.min(TOUR_STEPS.length - 1, t.step + d));
  saveSettings();
  renderTourStep();
}

async function endTour(skipped) {
  const t = app.settings.tour;
  closeTourUI();
  if (!t) return;
  saveCurrent.cancel(); app.dirty = false;
  const base = new Set(t.baseline);
  const removed = vault.all().filter((n) => !base.has(n.id));
  for (const n of removed) {
    vault.notes.delete(n.id); ed.forget(n.id);
    try { await store.deleteNote(n.id); await store.deleteHistoryFor(n.id); } catch (e) { console.error(e); }
    if (app.folder.status === 'linked') await folderRemove(n);
  }
  try {
    for (const rec of await store.allTrash()) {
      if (!base.has(rec.id) && (rec.deletedAt || 0) >= t.started) { await store.delTrash(rec.id); await store.deleteHistoryFor(rec.id); }
    }
  } catch (e) { console.error(e); }
  const keepSrs = new Set(t.srs);
  for (const k of Object.keys(app.srs)) if (!keepSrs.has(k)) delete app.srs[k];
  saveSrs();
  const keepAssets = new Set(t.assets);
  for (const [name, a] of Array.from(vault.assets)) {
    if (keepAssets.has(name)) continue;
    try { URL.revokeObjectURL(a.url); await store.delAsset(name); } catch (e) { /* ignore */ }
    vault.assets.delete(name);
  }
  vault.touch();
  const s = app.settings;
  s.tour = null; s.onboarded = true; s.tourSeen = TOUR_VERSION; s.typeFilter = []; s.sidebarTab = 'notes';
  s.recent = s.recent.filter((id) => vault.notes.has(id));
  if (!vault.notes.has(s.lastNote)) s.lastNote = null;
  if (s.mode !== t.prevMode && ['live', 'source', 'read'].includes(t.prevMode)) setMode(t.prevMode);
  saveSettings();
  const f = $('#filter'); if (f) f.value = '';
  lpInlineCache.clear();
  refreshLists();
  const back = t.current && vault.get(t.current) ? t.current : null;
  if (back) openNote(back, { replace: true });
  else { clearHash(); showEmpty(); }
  toast(skipped ? 'Tour skipped. The vault is ready.' : 'The practice notes are gone. The vault is ready.');
}

/* Version 1 added example notes on first start. If the vault holds only those, untouched by
   a tour, move them to the trash so that a first start is empty, as the tour promises. */
async function migrateStarterNotes() {
  if (app.settings.onboarded || !vault.notes.size) return;
  const ids = new Set(starterNotes().map((r) => parseNote(r).id));
  const all = vault.all();
  if (!app.settings.seeded || !all.every((n) => ids.has(n.id))) { app.settings.onboarded = true; saveSettings(); return; }
  for (const n of all) {
    await store.putTrash(Object.assign(plainNote(n), { deletedAt: Date.now() }));
    await store.deleteNote(n.id);
    vault.notes.delete(n.id);
  }
  vault.touch();
  app.settings.seeded = false; app.settings.lastNote = null; app.settings.recent = [];
  saveSettings();
}
