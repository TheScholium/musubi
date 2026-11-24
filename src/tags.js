/* The tag manager: rename, merge, move and delete tags in every note at once.
   A change applies to front matter tags and to inline #tags in the text (not in code or mathematics),
   and to nested tags: renaming #math to #mathematics also renames #math/topology. Each change can be undone. */

const TAG_OK = /^[\p{L}_][\p{L}\p{N}_\/-]*$/u;
const tagMatches = (t, from) => { const a = t.toLowerCase(); const f = from.toLowerCase(); return a === f || a.startsWith(f + '/'); };
const tagReplace = (t, from, to) => (to == null ? null : to + t.slice(from.length));

/* Change one note. to == null deletes the tag. Returns true if the note changed. */
function retagNote(n, from, to) {
  let changed = false;
  const tags = [];
  for (const t of n.tags || []) {
    if (tagMatches(t, from)) { changed = true; const r = tagReplace(t, from, to); if (r && !tags.some((x) => x.toLowerCase() === r.toLowerCase())) tags.push(r); }
    else if (!tags.some((x) => x.toLowerCase() === t.toLowerCase())) tags.push(t);
  }
  const body = n.body || '';
  const mm = maskCodeMath(body);
  const re = /(^|[\s,;])#([\p{L}_][\p{L}\p{N}_\/-]*)/gu; let m; let out = ''; let last = 0;
  while ((m = re.exec(mm))) {
    const tag = m[2].replace(/[\/-]+$/, '');
    if (!tagMatches(tag, from)) continue;
    const a = m.index + m[1].length; const b = a + 1 + tag.length;
    const r = tagReplace(tag, from, to);
    if (r) { out += body.slice(last, a) + '#' + r; last = b; }
    else {
      // delete "#tag" and one space next to it
      let a2 = a; let b2 = b;
      if (body[b2] === ' ') b2++; else if (a2 > 0 && body[a2 - 1] === ' ') a2--;
      out += body.slice(last, a2); last = b2;
    }
    changed = true;
  }
  if (!changed) return false;
  n.tags = tags;
  let nb = out + body.slice(last);
  if (to == null) nb = nb.replace(/^[ \t]+$/gm, '');
  n.body = nb;
  return true;
}

/* Apply a change to the vault, with an Undo in the toast. */
async function applyTagChange(from, to, opts = {}) {
  const before = [];
  if (app.current) saveCurrent.flush();
  for (const n of vault.all()) {
    const snap = { id: n.id, tags: (n.tags || []).slice(), body: n.body };
    if (retagNote(n, from, to)) before.push(snap);
  }
  if (!before.length) { toast('No note has #' + from); return 0; }
  await commitTagEdits(before.map((s) => s.id));
  if (!opts.quiet) toast(to == null ? `Removed #${from} from ${before.length} note${before.length === 1 ? '' : 's'}` : `#${from} → #${to} in ${before.length} note${before.length === 1 ? '' : 's'}`,
    { ms: 7000, action: { label: 'Undo', run: () => undoTagEdits(before) } });
  return before.length;
}

async function commitTagEdits(ids) {
  const now = isoLocal();
  for (const id of ids) {
    const n = vault.get(id); if (!n) continue;
    n.modified = now; ed.forget(n.id);
    await persistNote(n);
  }
  vault.touch();
  if (app.current && ids.includes(app.current)) { const c = cur(); syncEditorFromNote(); fillHeader(c); renderMentions(); }
  refreshLists();
}

async function undoTagEdits(snaps) {
  for (const s of snaps) { const n = vault.get(s.id); if (n) { n.tags = s.tags; n.body = s.body; } }
  await commitTagEdits(snaps.map((s) => s.id));
  toast('Tag change undone');
}

function cleanTagName(v) {
  return String(v || '').trim().replace(/^#+/, '').replace(/\s+/g, '-').replace(/\/{2,}/g, '/').replace(/^\/|\/$/g, '');
}

async function renameTagDialog(from) {
  const v = await promptDialog(`Rename #${from}`, 'New name (use / to nest it under another tag; an existing name merges the two)', from, 'Rename');
  if (v == null) return;
  const to = cleanTagName(v);
  if (!to || to === from) return;
  if (!TAG_OK.test(to)) { toast('A tag starts with a letter and has letters, digits, _, - and / only.', { kind: 'error' }); return; }
  if (tagMatches(to, from) && to.toLowerCase() !== from.toLowerCase()) { toast('A tag cannot go inside itself.', { kind: 'error' }); return; }
  await applyTagChange(from, to);
}

async function deleteTagDialog(from) {
  const n = tagNoteCount(from);
  const ok = await confirmDialog(`Remove #${from} from every note?`, `${n} note${n === 1 ? '' : 's'} change. Nested tags (#${from}/…) go too. Inline tags leave the text; front matter tags leave the list. You can undo this.`, 'Remove tag', true);
  if (ok) await applyTagChange(from, null);
}

function tagNoteCount(tag) { let c = 0; for (const n of vault.notes.values()) if (noteTags(n).some((t) => tagMatches(t, tag))) c++; return c; }

/* ---------- the manager ---------- */
function openTagManager(focusTag) {
  let ov; const sel = new Set();
  const filter = h('input', { class: 'input input-sm', type: 'search', placeholder: 'Filter tags', 'aria-label': 'Filter tags', value: focusTag || '' });
  const list = h('div', { class: 'tm-list' });
  const detail = h('div', { class: 'tm-detail' });
  const bar = h('div', { class: 'tm-bar' });
  let active = focusTag || null;

  const counts = () => {
    const direct = new Map(); const nested = new Map();
    for (const n of vault.notes.values()) {
      const ts = noteTags(n); const seen = new Set();
      for (const t of ts) {
        direct.set(t, (direct.get(t) || 0) + 1);
        const parts = t.split('/'); let acc = '';
        for (const q of parts) { acc = acc ? acc + '/' + q : q; if (!seen.has(acc)) { seen.add(acc); nested.set(acc, (nested.get(acc) || 0) + 1); } }
      }
    }
    return { direct, nested };
  };
  const draw = () => {
    const { direct, nested } = counts();
    const q = fold(filter.value.trim().replace(/^#/, ''));
    const segCmp = (a, b) => {
      const x = a.split('/'); const y = b.split('/');
      for (let i = 0; i < Math.min(x.length, y.length); i++) {
        const c = x[i].localeCompare(y[i], undefined, { sensitivity: 'base' }); if (c) return c;
        if (x[i] !== y[i]) return x[i] < y[i] ? 1 : -1;
      }
      return x.length - y.length;
    };
    const all = Array.from(nested.keys()).sort(segCmp);
    const shown = all.filter((t) => !q || fold(t).includes(q));
    list.innerHTML = '';
    // case variants are a common reason to merge
    const lower = new Map(); for (const t of all) { const k = t.toLowerCase(); lower.set(k, (lower.get(k) || 0) + 1); }
    if (!shown.length) list.appendChild(h('div', { class: 'side-empty' }, all.length ? 'No tag matches.' : 'No tags yet.'));
    for (const t of shown) {
      const depth = t.split('/').length - 1;
      const cb = h('input', { type: 'checkbox', 'aria-label': 'Select #' + t }); cb.checked = sel.has(t);
      cb.addEventListener('change', () => { if (cb.checked) sel.add(t); else sel.delete(t); drawBar(); });
      const row = h('div', { class: 'tm-row' + (t === active ? ' on' : ''), style: { paddingLeft: (8 + depth * 16) + 'px' } },
        cb,
        h('button', { class: 'tm-name', onclick: () => { active = t; draw(); } }, '#' + (depth ? t.split('/').pop() : t)),
        lower.get(t.toLowerCase()) > 1 ? h('span', { class: 'tm-warn', title: 'The same tag with other capital letters exists. Merge them.' }, 'case') : null,
        h('span', { class: 'count', title: direct.get(t) ? `${direct.get(t)} with exactly this tag` : 'only nested tags' }, String(nested.get(t))),
        h('span', { class: 'tm-actions' },
          h('button', { class: 'link-btn', onclick: () => renameTagDialog(t).then(redraw) }, 'rename'),
          h('button', { class: 'link-btn danger', onclick: () => deleteTagDialog(t).then(redraw) }, 'remove')));
      list.appendChild(row);
    }
    drawDetail();
    drawBar();
  };
  const drawDetail = () => {
    detail.innerHTML = '';
    if (!active) { detail.appendChild(h('div', { class: 'tm-help' },
      h('p', null, 'Choose a tag to see its notes.'),
      h('p', { class: 'muted small' }, 'Rename a tag to change it everywhere: front matter, inline #tags and nested tags. Rename to an existing name to merge the two. Put a slash in the new name to move a tag under another one, for example #topology → #math/topology. Select several tags to merge them in one step.'))); return; }
    const notes = vault.all().filter((n) => noteTags(n).some((t) => tagMatches(t, active))).sort((a, b) => a.title.localeCompare(b.title));
    detail.appendChild(h('div', { class: 'tm-dhead' }, h('b', null, '#' + active), h('span', { class: 'muted small' }, `${notes.length} note${notes.length === 1 ? '' : 's'}`)));
    detail.appendChild(h('div', { class: 'btn-row' },
      h('button', { class: 'btn btn-sm', onclick: () => renameTagDialog(active).then(redraw) }, 'Rename or move'),
      h('button', { class: 'btn btn-sm', onclick: () => { ov.close(); filterByTag(active); } }, 'Show in the list'),
      h('button', { class: 'btn btn-sm btn-danger', onclick: () => deleteTagDialog(active).then(redraw) }, 'Remove')));
    const ul = h('div', { class: 'tm-notes' });
    for (const n of notes.slice(0, 200)) {
      const where = (n.tags || []).some((t) => tagMatches(t, active)) ? 'front matter' : 'in the text';
      ul.appendChild(h('div', { class: 'tm-note' }, h('span', { class: 'dot t-' + n.type }),
        h('a', { class: 'wl', href: '#n-' + n.id, onclick: (e) => { e.preventDefault(); ov.close(); openNote(n.id); } }, n.title),
        h('span', { class: 'muted small' }, noteTags(n).filter((t) => tagMatches(t, active)).map((t) => '#' + t).join(' ') + ' · ' + where)));
    }
    detail.appendChild(ul);
  };
  const drawBar = () => {
    bar.innerHTML = '';
    if (!sel.size) { bar.appendChild(h('span', { class: 'muted small' }, 'Select tags to merge or remove several at once.')); return; }
    bar.appendChild(h('span', null, `${sel.size} selected`));
    bar.appendChild(h('button', { class: 'btn btn-sm btn-primary', onclick: async () => {
      const first = Array.from(sel).sort((a, b) => tagNoteCount(b) - tagNoteCount(a))[0];
      const v = await promptDialog(`Merge ${sel.size} tags`, 'Into this tag (it can be one of them or a new name)', first, 'Merge');
      const to = cleanTagName(v); if (!to) return;
      if (!TAG_OK.test(to)) { toast('That is not a valid tag name.', { kind: 'error' }); return; }
      const snaps = [];
      for (const n of vault.all()) {
        const snap = { id: n.id, tags: (n.tags || []).slice(), body: n.body }; let ch = false;
        for (const t of sel) if (t !== to) ch = retagNote(n, t, to) || ch;
        if (ch) snaps.push(snap);
      }
      await commitTagEdits(snaps.map((s) => s.id));
      toast(`Merged into #${to} in ${snaps.length} note${snaps.length === 1 ? '' : 's'}`, { ms: 7000, action: { label: 'Undo', run: () => undoTagEdits(snaps).then(redraw) } });
      sel.clear(); active = to; redraw();
    } }, 'Merge…'));
    bar.appendChild(h('button', { class: 'btn btn-sm btn-danger', onclick: async () => {
      if (!(await confirmDialog(`Remove ${sel.size} tags from every note?`, Array.from(sel).map((t) => '#' + t).join(', ') + '. You can undo this.', 'Remove', true))) return;
      const snaps = [];
      for (const n of vault.all()) {
        const snap = { id: n.id, tags: (n.tags || []).slice(), body: n.body }; let ch = false;
        for (const t of sel) ch = retagNote(n, t, null) || ch;
        if (ch) snaps.push(snap);
      }
      await commitTagEdits(snaps.map((s) => s.id));
      toast(`Removed ${sel.size} tags from ${snaps.length} note${snaps.length === 1 ? '' : 's'}`, { ms: 7000, action: { label: 'Undo', run: () => undoTagEdits(snaps).then(redraw) } });
      sel.clear(); active = null; redraw();
    } }, 'Remove'));
    bar.appendChild(h('button', { class: 'link-btn', onclick: () => { sel.clear(); draw(); } }, 'clear'));
  };
  const redraw = () => { if (active && !tagNoteCount(active)) active = null; draw(); };
  filter.addEventListener('input', draw);
  ov = overlay('ov-tags', h('div', { class: 'tagman' },
    h('div', { class: 'rv-head' }, h('b', null, 'Tags'), filter, h('button', { class: 'icon-btn', title: 'Close', html: icon('x', 18), onclick: () => ov.close() })),
    h('div', { class: 'tm-body' }, h('div', { class: 'tm-left' }, list, bar), detail)));
  draw();
  filter.focus();
}
