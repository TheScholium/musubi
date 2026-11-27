/* Tabs, split view and the navigation arrows.
   There are two panes. Each pane has tabs; a tab holds a note (or an empty "new tab") or a PDF.
   There is one editor. It lives in the "note pane". The other pane shows its note rendered, as on a page;
   a click there moves the editor to that pane. So every editor feature works the same in both panes. */

const panes = {
  list: [{ tabs: [], active: 0 }, { tabs: [], active: 0 }],
  notePane: 0,
  split: false,
  pdf: [null, null], // the PDF viewer of each pane, when its active tab is a PDF
};

const tabOf = (p) => panes.list[p].tabs[panes.list[p].active] || null;
const otherPane = (p) => 1 - p;
const sameTab = (a, b) => a && b && a.k === b.k && (a.k === 'pdf' ? a.name === b.name : a.id === b.id);

function panesSave() {
  app.settings.tabs = { list: panes.list.map((p) => ({ tabs: p.tabs.map((t) => Object.assign({}, t)), active: p.active })), notePane: panes.notePane };
  app.settings.split = panes.split;
  saveSettings();
}

/* Restore the tabs from the settings. Tabs whose note is gone are dropped. */
function panesRestore() {
  const t = app.settings.tabs;
  if (t && Array.isArray(t.list)) {
    panes.list = [0, 1].map((i) => {
      const src = t.list[i] || { tabs: [], active: 0 };
      const tabs = (src.tabs || []).filter((x) => x && (x.k === 'pdf' ? !!x.name : x.k === 'slides' ? !!(x.id && vault.get(x.id)) : x.id == null || vault.get(x.id)));
      return { tabs, active: Math.max(0, Math.min(tabs.length - 1, src.active | 0)) };
    });
    panes.notePane = t.notePane === 1 ? 1 : 0;
  }
  panes.split = !!app.settings.split && panes.list[1].tabs.length > 0;
  if (!panes.split && panes.list[1].tabs.length) { panes.list[0].tabs.push(...panes.list[1].tabs); panes.list[1] = { tabs: [], active: 0 }; }
  if (!panes.split) panes.notePane = 0;
  if (tabOf(panes.notePane) && tabOf(panes.notePane).k !== 'note' && tabOf(otherPane(panes.notePane)) && tabOf(otherPane(panes.notePane)).k === 'note') panes.notePane = otherPane(panes.notePane);
}

/* The note the editor should show at start, if the tabs know one. */
function panesStartNote() { const t = tabOf(panes.notePane); return t && t.k === 'note' && t.id && vault.get(t.id) ? t.id : null; }

/* ---------- DOM ---------- */
function buildPanes() {
  const scroll = $('#note-scroll');
  const mk = (i) => h('section', { class: 'pane', id: 'pane' + i, 'data-pane': String(i) },
    h('div', { class: 'tabbar', id: 'tabbar' + i, role: 'tablist', 'aria-label': i ? 'Tabs of the right pane' : 'Tabs' }),
    h('div', { class: 'pane-body', id: 'pbody' + i }));
  const p0 = mk(0); const p1 = mk(1);
  const div = h('div', { class: 'pane-divider', id: 'pane-divider', role: 'separator', 'aria-orientation': 'vertical', title: 'Drag to resize. Double-click to make the panes equal.' });
  const wrap = h('div', { class: 'panes', id: 'panes' }, p0, div, p1);
  scroll.replaceWith(wrap);
  $('#pbody0').appendChild(scroll);
  $('#main').appendChild(buildNavDock());
  bindDivider(div);
  wrap.addEventListener('mousedown', (e) => {
    const pane = e.target.closest('.pane'); if (!pane) return;
    const p = +pane.dataset.pane;
    if (p !== panes.notePane && !e.target.closest('.tabbar') && tabOf(p) && tabOf(p).k !== 'note') markFocusPane(p);
  }, true);
  applySplit();
}

function applySplit() {
  const w = $('#panes'); if (!w) return;
  w.classList.toggle('split', panes.split);
  $('#pane1').hidden = !panes.split; $('#pane-divider').hidden = !panes.split;
  const r = Math.max(0.2, Math.min(0.8, app.settings.splitRatio || 0.5));
  $('#pane0').style.flex = panes.split ? `${r} 1 0` : '1 1 0';
  $('#pane1').style.flex = `${1 - r} 1 0`;
}

function bindDivider(div) {
  div.addEventListener('dblclick', () => { app.settings.splitRatio = 0.5; saveSettings(); applySplit(); });
  div.addEventListener('pointerdown', (e) => {
    e.preventDefault(); div.setPointerCapture(e.pointerId); document.body.classList.add('resizing');
    const box = $('#panes').getBoundingClientRect();
    const move = (ev) => { app.settings.splitRatio = Math.max(0.2, Math.min(0.8, (ev.clientX - box.left) / box.width)); applySplit(); };
    const up = () => { div.removeEventListener('pointermove', move); div.removeEventListener('pointerup', up); document.body.classList.remove('resizing'); saveSettings(); };
    div.addEventListener('pointermove', move); div.addEventListener('pointerup', up);
  });
}

/* ---------- the navigation arrows (bottom of the screen) ----------
   Drawn with KaTeX, like \xleftarrow{label}: the title of the note you go to sits over the arrow. */
function buildNavDock() {
  const arrow = (dir) => {
    const tex = dir < 0 ? '\\longleftarrow' : '\\longrightarrow';
    let glyph = ''; try { glyph = katex.renderToString(tex, { throwOnError: false }); } catch (e) { glyph = dir < 0 ? '⟵' : '⟶'; }
    return h('button', { class: 'nav-arrow ' + (dir < 0 ? 'nav-back' : 'nav-fwd'), id: dir < 0 ? 'btn-back' : 'btn-fwd', type: 'button',
      'aria-label': dir < 0 ? 'Back' : 'Forward', onclick: () => navGo(dir) },
    h('span', { class: 'nav-label' }), h('span', { class: 'nav-glyph', html: glyph }));
  };
  return h('div', { class: 'nav-dock', id: 'nav-dock' }, arrow(-1), h('span', { class: 'nav-pos', id: 'nav-pos', 'aria-hidden': 'true' }), arrow(1));
}

function navTarget(d) {
  let j = nav.idx + d;
  while (j >= 0 && j < nav.stack.length && !vault.get(nav.stack[j])) j += d;
  return j >= 0 && j < nav.stack.length ? vault.get(nav.stack[j]) : null;
}

function updateNavDock() {
  for (const d of [-1, 1]) {
    const b = $(d < 0 ? '#btn-back' : '#btn-fwd'); if (!b) continue;
    const t = navTarget(d);
    b.disabled = !t;
    const keys = d < 0 ? `${modKey()} Alt ←` : `${modKey()} Alt →`;
    b.title = t ? `${d < 0 ? 'Back to' : 'Forward to'} “${t.title}” (${keys})` : (d < 0 ? 'Back' : 'Forward');
    const lab = b.querySelector('.nav-label');
    lab.textContent = t ? t.title : '';
  }
  const pos = $('#nav-pos');
  if (pos) pos.textContent = nav.stack.length > 1 ? `${nav.idx + 1}/${nav.stack.length}` : '';
}

/* ---------- opening notes in tabs ---------- */
/* Called by openNote before it fills the page. opts.newTab opens a new tab; opts.pane chooses the pane. */
function paneWillOpen(id, opts) {
  if (opts.pane != null && opts.pane !== panes.notePane) {
    if (opts.pane === 1 && !panes.split) { panes.split = true; applySplit(); }
    moveEditorTo(opts.pane);
  }
  const P = panes.list[panes.notePane];
  if (opts.newTab || !P.tabs.length) { P.tabs.splice(P.tabs.length ? P.active + 1 : 0, 0, { k: 'note', id }); P.active = P.tabs.length === 1 ? 0 : P.active + 1; }
  else {
    const t = tabOf(panes.notePane);
    if (t.k === 'note') t.id = id;
    else {
      const k = P.tabs.findIndex((x) => x.k === 'note' && x.id === id);
      if (k >= 0) P.active = k; else { P.tabs.splice(P.active + 1, 0, { k: 'note', id }); P.active++; }
    }
  }
}

/* Called by openNote and showEmpty when they are done. */
function paneDidChange() {
  renderTabbars();
  renderGhost(otherPane(panes.notePane));
  panesSave();
}

/* Move the editor (with its page) into pane p. The old pane shows its note rendered. */
function moveEditorTo(p) {
  if (p === panes.notePane) return;
  if (app.current) { saveCurrent.flush(); app.cursor.set(app.current, { top: $('#note-scroll').scrollTop }); }
  const ghost = $('#pbody' + p + ' .ghost');
  const gt = tabOf(p);
  if (ghost && gt && gt.k === 'note' && gt.id) app.cursor.set(gt.id, { top: ghost.scrollTop });
  const old = panes.notePane;
  panes.notePane = p;
  destroyPdf(p);
  $('#pbody' + p).innerHTML = '';
  $('#pbody' + p).appendChild($('#note-scroll'));
  $('#note-scroll').hidden = false;
  renderPaneBody(old);
}

/* Give pane p the focus. A note there takes the editor; a PDF there only takes the keyboard focus. */
function focusPane(p) {
  const t = tabOf(p);
  if (!t) return;
  if (t.k !== 'note') { markFocusPane(p); return; }
  if (p !== panes.notePane) moveEditorTo(p);
  if (t.id && vault.get(t.id)) openNote(t.id, { fromPane: true });
  else showEmpty();
  markFocusPane(p);
}

function markFocusPane(p) {
  panes.focus = p;
  for (const i of [0, 1]) { const el = $('#pane' + i); if (el) el.classList.toggle('focused', panes.split && i === p); }
}

/* ---------- tab bars ---------- */
function tabLabel(t) {
  if (t.k === 'pdf') return { text: t.name.replace(/\.pdf$/i, ''), cls: 'tab-pdf', title: t.name };
  if (t.k === 'slides') { const sn = vault.get(t.id); return { text: (sn ? sn.title : 'Slides'), cls: 'tab-slides', title: 'Slide preview: ' + (sn ? sn.title : '') }; }
  const n = t.id ? vault.get(t.id) : null;
  return n ? { text: n.title || 'Untitled', cls: 't-' + n.type, title: n.title } : { text: 'New tab', cls: 'tab-empty', title: 'New tab' };
}

function renderTabbars() {
  for (const p of [0, 1]) {
    const bar = $('#tabbar' + p); if (!bar) continue;
    bar.innerHTML = '';
    const P = panes.list[p];
    P.tabs.forEach((t, i) => {
      const L = tabLabel(t);
      const on = i === P.active;
      const el = h('div', { class: 'tab' + (on ? ' on' : '') + (on && p === panes.notePane && t.k === 'note' ? ' editing' : ''), role: 'tab', 'aria-selected': String(on), tabindex: '0', title: L.title, draggable: 'true', 'data-i': String(i) },
        t.k === 'pdf' ? h('span', { class: 'tab-ic', html: icon('scroll', 13) }) : t.k === 'slides' ? h('span', { class: 'tab-ic', html: icon('easel', 13) }) : h('span', { class: 'dot ' + L.cls }),
        h('span', { class: 'tab-title' }, L.text),
        h('button', { class: 'tab-x', title: 'Close tab (Alt W)', 'aria-label': 'Close tab', onclick: (e) => { e.stopPropagation(); closeTab(p, i); } }, '×'));
      el.addEventListener('click', () => activateTab(p, i));
      el.addEventListener('auxclick', (e) => { if (e.button === 1) { e.preventDefault(); closeTab(p, i); } });
      el.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); activateTab(p, i); } });
      el.addEventListener('contextmenu', (e) => { e.preventDefault(); openTabMenu(el, p, i); });
      el.addEventListener('dragstart', (e) => { e.dataTransfer.setData('application/x-musubi-tab', JSON.stringify({ p, i })); e.dataTransfer.effectAllowed = 'move'; });
      bar.appendChild(el);
    });
    bar.appendChild(h('button', { class: 'tab-new', title: 'New tab (Alt T)', 'aria-label': 'New tab', html: icon('plus', 14), onclick: () => newTab(p) }));
    bar.appendChild(h('span', { class: 'tab-fill' }));
    if (p === 0) bar.appendChild(h('button', { class: 'tab-split' + (panes.split ? ' on' : ''), title: panes.split ? 'Close the split (Alt \\)' : 'Split: a second pane on the right (Alt \\)', 'aria-label': 'Split view', html: splitIcon(), onclick: toggleSplit }));
    else bar.appendChild(h('button', { class: 'tab-split', title: 'Close this pane', 'aria-label': 'Close this pane', html: icon('x', 14), onclick: () => closeSplit() }));
    bar.ondragover = (e) => { if (Array.from(e.dataTransfer.types).includes('application/x-musubi-tab')) { e.preventDefault(); bar.classList.add('drop'); } };
    bar.ondragleave = () => bar.classList.remove('drop');
    bar.ondrop = (e) => {
      bar.classList.remove('drop');
      const raw = e.dataTransfer.getData('application/x-musubi-tab'); if (!raw) return;
      e.preventDefault();
      const { p: fp, i: fi } = JSON.parse(raw);
      const over = e.target.closest('.tab'); const ti = over ? +over.dataset.i : panes.list[p].tabs.length;
      moveTab(fp, fi, p, ti);
    };
  }
  markFocusPane(panes.focus == null ? panes.notePane : panes.focus);
}

function splitIcon() {
  return '<svg class="ic" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><rect x="3.5" y="4.5" width="17" height="15" rx="1.2"/><path d="M12 4.5v15"/></svg>';
}

function activateTab(p, i) {
  const P = panes.list[p]; if (!P.tabs[i]) return;
  P.active = i;
  const t = P.tabs[i];
  if (t.k === 'note') focusPane(p);
  else {
    if (p === panes.notePane) {
      // the editor cannot show a PDF: it moves to the other pane if a note is there
      const o = otherPane(p); const ot = tabOf(o);
      if (panes.split && ot && ot.k === 'note') { moveEditorTo(o); if (ot.id) openNote(ot.id, { fromPane: true }); else showEmpty(); }
      else { if (app.current) saveCurrent.flush(); $('#note-scroll').hidden = true; renderPaneBody(p); }
    } else renderPaneBody(p);
    markFocusPane(p);
    paneDidChange();
  }
}

function newTab(p = panes.notePane) {
  const P = panes.list[p];
  P.tabs.splice(P.tabs.length ? P.active + 1 : 0, 0, { k: 'note', id: null });
  P.active = P.tabs.length === 1 ? 0 : P.active + 1;
  focusPane(p);
  setTimeout(() => openPalette(''), 30);
}

const closedTabs = [];
function closeTab(p, i) {
  const P = panes.list[p]; if (!P.tabs[i]) return;
  if (P.tabs[i].k === 'pdf' || P.tabs[i].id) { closedTabs.push(Object.assign({}, P.tabs[i])); if (closedTabs.length > 20) closedTabs.shift(); }
  const wasActive = i === P.active;
  if (p === panes.notePane && wasActive && app.current) saveCurrent.flush();
  if (P.tabs[i].k !== 'note' && wasActive) destroyPdf(p);
  P.tabs.splice(i, 1);
  if (!P.tabs.length) {
    if (panes.split) { closeSplit(p); return; }
    P.tabs.push({ k: 'note', id: null });
  }
  if (i < P.active) P.active--;
  else if (wasActive) P.active = Math.min(i, P.tabs.length - 1);
  if (!wasActive) { paneDidChange(); return; }
  const t = tabOf(p);
  if (t.k !== 'note') { activateTab(p, P.active); return; }
  if (p === panes.notePane) { $('#note-scroll').hidden = false; if (t.id && vault.get(t.id)) openNote(t.id, { fromPane: true }); else showEmpty(); }
  else { renderPaneBody(p); paneDidChange(); }
}

function moveTab(fp, fi, tp, ti) {
  const tab = panes.list[fp].tabs[fi]; if (!tab) return;
  if (fp === tp) {
    const P = panes.list[fp]; const activeTab = P.tabs[P.active];
    P.tabs.splice(fi, 1); P.tabs.splice(ti > fi ? ti - 1 : ti, 0, tab);
    P.active = P.tabs.indexOf(activeTab);
    paneDidChange(); return;
  }
  openTabInPane(tab, tp, ti);
  closeTab(fp, panes.list[fp].tabs.indexOf(tab));
}

/* Open a tab (a copy of one, or a new one) in pane p, opening the split if needed. */
function openTabInPane(tab, p, at) {
  if (p === 1 && !panes.split) { panes.split = true; applySplit(); }
  const P = panes.list[p];
  const copy = Object.assign({}, tab);
  const k = at == null ? (P.tabs.length ? P.active + 1 : 0) : at;
  P.tabs.splice(k, 0, copy); P.active = k;
  if (copy.k === 'note') focusPane(p); else activateTab(p, k);
}

function openTabMenu(anchor, p, i) {
  const t = panes.list[p].tabs[i];
  const o = otherPane(p);
  openMenu(anchor, [
    { icon: 'x', label: 'Close', keys: 'Alt W', run: () => closeTab(p, i) },
    { icon: 'x', label: 'Close the other tabs', run: () => { const P = panes.list[p]; P.tabs = [t]; P.active = 0; activateTab(p, 0); } },
    '-',
    { icon: 'fwd', label: panes.split ? (p === 0 ? 'Move to the right pane' : 'Move to the left pane') : 'Move to a split pane', run: () => moveTab(p, i, panes.split ? o : 1, null) },
    { icon: 'copy', label: panes.split ? 'Open a copy in the other pane' : 'Open a copy in a split pane', run: () => openTabInPane(t, panes.split ? o : 1) },
  ]);
}

/* Open a note or a PDF from a link, a list or a command, honouring the modifier keys:
   Ctrl/Cmd: new tab. Ctrl/Cmd+Shift: the other pane. */
function openWithKeys(e, id, opts = {}) {
  const mod = e && (e.ctrlKey || e.metaKey);
  if (mod && e.shiftKey) return openNote(id, Object.assign({}, opts, { pane: panes.split ? otherPane(panes.notePane) : 1, newTab: true }));
  if (mod || (e && e.button === 1)) return openNote(id, Object.assign({}, opts, { newTab: true }));
  return openNote(id, opts);
}

function toggleSplit() { if (panes.split) closeSplit(); else openSplit(); }
function openSplit() {
  if (panes.split) return;
  const t = tabOf(panes.notePane) || { k: 'note', id: app.current };
  panes.split = true; applySplit();
  panes.list[1] = { tabs: [Object.assign({}, t)], active: 0 };
  renderPaneBody(1);
  paneDidChange();
}
/* Close the split. The tabs of the closed pane join the other pane. */
function closeSplit(which = 1) {
  if (!panes.split) return;
  const keep = otherPane(which);
  if (panes.notePane === which) {
    const kt = tabOf(keep);
    if (kt && kt.k === 'note') moveEditorTo(keep);
  }
  const moved = panes.list[which].tabs.filter((t) => !panes.list[keep].tabs.some((x) => sameTab(x, t)));
  destroyPdf(which); destroyPdf(keep);
  panes.list[0] = { tabs: [...panes.list[keep].tabs, ...moved], active: panes.list[keep].active };
  panes.list[1] = { tabs: [], active: 0 };
  if (panes.notePane !== keep) { /* the editor was in the closed pane and the kept pane shows a PDF */ $('#pbody' + keep).innerHTML = ''; $('#pbody' + keep).appendChild($('#note-scroll')); }
  if (keep === 1) { $('#pbody0').innerHTML = ''; $('#pbody0').appendChild($('#note-scroll')); }
  panes.notePane = 0; panes.split = false; panes.focus = 0;
  $('#pbody1').innerHTML = '';
  applySplit();
  if (!panes.list[0].tabs.length) panes.list[0].tabs.push({ k: 'note', id: app.current });
  const t = tabOf(0);
  if (t.k === 'note') { $('#note-scroll').hidden = false; if (t.id && vault.get(t.id)) openNote(t.id, { fromPane: true }); else showEmpty(); }
  else activateTab(0, panes.list[0].active);
  paneDidChange();
}

/* ---------- the pane without the editor ---------- */
function renderPaneBody(p) {
  if (p === panes.notePane && tabOf(p) && tabOf(p).k === 'note') return;
  const body = $('#pbody' + p); if (!body) return;
  const t = tabOf(p);
  if (!t) { destroyPdf(p); if (p !== panes.notePane) body.innerHTML = ''; return; }
  if (t.k === 'pdf') {
    if (panes.pdf[p] && panes.pdf[p].name === t.name) return;
    destroyPdf(p);
    for (const el of Array.from(body.children)) if (el.id !== 'note-scroll') el.remove();
    const host = h('div', { class: 'pdf-host' });
    body.appendChild(host);
    panes.pdf[p] = mountPdf(host, t, p);
    return;
  }
  if (t.k === 'slides') {
    const cv = slidesState.previews[p];
    if (cv && cv.id === t.id && cv.wrap && body.contains(cv.wrap)) return;
    destroyPdf(p);
    for (const el of Array.from(body.children)) if (el.id !== 'note-scroll') el.remove();
    slidesState.previews[p] = mountSlidePreview(body, t, p);
    return;
  }
  renderGhost(p);
}

function destroyPdf(p) {
  const v = panes.pdf[p];
  if (v) { try { v.destroy(); } catch (e) { /* ignore */ } panes.pdf[p] = null; }
  const sv = slidesState.previews[p];
  if (sv) { try { sv.destroy(); } catch (e) { /* ignore */ } slidesState.previews[p] = null; }
  const body = $('#pbody' + p); if (body) for (const el of Array.from(body.querySelectorAll('.pdf-host'))) el.remove();
}

/* A note in the pane without the editor: rendered as in read view. A click moves the editor here. */
function renderGhost(p) {
  if (!panes.split && p === 1) return;
  if (p === panes.notePane) return;
  const t = tabOf(p); const body = $('#pbody' + p); if (!body || !t || t.k !== 'note') { if (t && t.k !== 'note') renderPaneBody(p); return; }
  destroyPdf(p);
  let ghost = body.querySelector('.ghost');
  const keep = ghost ? ghost.scrollTop : (t.id && app.cursor.get(t.id) ? app.cursor.get(t.id).top : 0);
  if (!ghost) { body.innerHTML = ''; ghost = h('div', { class: 'note-scroll ghost', tabindex: '-1' }); body.appendChild(ghost); bindGhost(ghost, p); }
  const n = t.id ? vault.get(t.id) : null;
  ghost.innerHTML = '';
  if (!n) { ghost.appendChild(h('div', { class: 'page ghost-page' }, h('div', { class: 'ghost-empty' }, h('p', { class: 'muted' }, 'No note is open in this pane.'), h('button', { class: 'btn btn-sm', onclick: () => { focusPane(p); openPalette(''); } }, 'Find a note')))); return; }
  const art = h('article', { class: 'prose' });
  try { art.innerHTML = renderMarkdown(n.body, { note: n, idPrefix: 'g' + p + n.id + '-' }); } catch (e) { art.textContent = e.message; }
  enhanceRendered(art, 'g' + p + n.id + '-');
  ghost.appendChild(h('div', { class: 'page ghost-page' },
    h('h1', { class: 'ghost-title' }, n.title),
    h('div', { class: 'props ghost-props' }, h('span', { class: 'prop' }, h('span', { class: 'dot t-' + n.type }), (TYPE_LABEL[n.type] || n.type).toLowerCase()),
      h('span', { class: 'prop-sep' }, '·'), h('span', null, n.status),
      ...noteTags(n).map((tg) => h('span', { class: 'chip' }, '#' + tg)),
      h('span', { class: 'ghost-hint' }, 'click to edit here')),
    art));
  ghost.scrollTop = keep;
}
const renderGhostsSoon = debounce(() => { if (panes.split) renderGhost(otherPane(panes.notePane)); renderTabbars(); }, 400);

function bindGhost(ghost, p) {
  ghost.addEventListener('click', (e) => {
    const a = e.target.closest('a');
    if (a && (a.classList.contains('wl') || a.classList.contains('cite-ref'))) {
      e.preventDefault();
      if (a.dataset.id) { panes.list[p].tabs[panes.list[p].active] = { k: 'note', id: a.dataset.id }; focusPane(p); if (a.dataset.block) setTimeout(() => scrollToBlock(a.dataset.block), 80); else if (a.dataset.heading) setTimeout(() => scrollToHeading(a.dataset.heading), 60); }
      else if (a.dataset.target) createFromBroken(a.dataset.target);
      return;
    }
    if (a && (a.dataset.anchor || a.classList.contains('tag') || a.dataset.att)) { onRenderedClick(e); return; }
    if (a || e.target.closest('button, input, .att-card, video, audio')) return;
    if (window.getSelection && String(window.getSelection()).length) return;
    focusPane(p);
  });
}

/* ---------- when notes change ---------- */
/* A note was deleted: close its tabs. Returns true if the editor's note was among them. */
function panesForget(id) {
  let hit = false;
  for (const p of [0, 1]) {
    const P = panes.list[p];
    for (let i = P.tabs.length - 1; i >= 0; i--) {
      if ((P.tabs[i].k === 'note' || P.tabs[i].k === 'slides') && P.tabs[i].id === id) {
        if (P.tabs[i].k === 'note' && p === panes.notePane && i === P.active) hit = true;
        if (P.tabs[i].k === 'slides' && i === P.active) destroyPdf(p);
        P.tabs.splice(i, 1); if (P.active > i || P.active >= P.tabs.length) P.active = Math.max(0, P.active - 1);
      }
    }
  }
  // keep the editor's page (#note-scroll) before a pane is emptied: it may be inside that pane
  if (panes.split && !panes.list[1].tabs.length) { const ns = $('#note-scroll'); destroyPdf(1); panes.split = false; applySplit(); $('#pbody1').innerHTML = ''; if (panes.notePane === 1) { panes.notePane = 0; $('#pbody0').innerHTML = ''; } if (ns && !ns.isConnected) $('#pbody0').appendChild(ns); }
  if (panes.split && !panes.list[0].tabs.length) { const ns = $('#note-scroll'); destroyPdf(0); destroyPdf(1); panes.list[0] = panes.list[1]; panes.list[1] = { tabs: [], active: 0 }; panes.split = false; applySplit(); $('#pbody0').innerHTML = ''; $('#pbody1').innerHTML = ''; if (ns) $('#pbody0').appendChild(ns); panes.notePane = 0; }
  if (!panes.list[panes.notePane].tabs.length) { panes.list[panes.notePane].tabs.push({ k: 'note', id: null }); panes.list[panes.notePane].active = 0; }
  renderTabbars(); renderGhost(otherPane(panes.notePane)); panesSave();
  return hit;
}

/* Open a PDF in a tab. By default it goes to the other pane, so that the note stays beside it. */
function openPdfTab(name, opts = {}) {
  const tab = { k: 'pdf', name, page: opts.page || null };
  const target = opts.pane != null ? opts.pane : (opts.here ? panes.notePane : (panes.split ? otherPane(panes.notePane) : 1));
  const P = panes.list[target];
  const k = P.tabs.findIndex((x) => x.k === 'pdf' && x.name === name);
  if (target === 1 && !panes.split) { panes.split = true; applySplit(); }
  if (k >= 0) { P.active = k; if (opts.page) P.tabs[k].page = opts.page; }
  else { P.tabs.splice(P.tabs.length ? P.active + 1 : 0, 0, tab); P.active = P.tabs.length === 1 ? 0 : P.active + 1; }
  activateTab(target, P.active);
  if (opts.page && panes.pdf[target]) panes.pdf[target].goto(opts.page);
}

/* Keyboard: Alt T new tab, Alt W close, Alt 1–9 choose a tab, Alt \ split. */
function paneShortcut(code) {
  const p = panes.focus == null ? panes.notePane : panes.focus;
  if (code === 'KeyT') { newTab(panes.notePane); return true; }
  if (code === 'KeyW') { closeTab(p, panes.list[p].active); return true; }
  if (code === 'Backslash') { toggleSplit(); return true; }
  const m = /^Digit([1-9])$/.exec(code);
  if (m) { const P = panes.list[p]; const i = m[1] === '9' ? P.tabs.length - 1 : +m[1] - 1; if (P.tabs[i]) activateTab(p, i); return true; }
  return false;
}

/* Cmd/Ctrl+Shift+T: the last closed tab comes back, in the pane that has the focus. */
function reopenClosedTab() {
  while (closedTabs.length) {
    const t = closedTabs.pop();
    if (t.k === 'note' && !vault.get(t.id)) continue;
    if (t.k === 'pdf' && !vault.assets.has(t.name)) continue;
    if (t.k === 'pdf') openPdfTab(t.name, { page: t.page });
    else if (t.k === 'slides') openSlidePreview(t.id);
    else openNote(t.id, { newTab: true });
    return;
  }
  toast('No closed tab to open again');
}

/* Ctrl+Tab and Cmd/Ctrl+Shift+] go to the next tab of the focused pane; with Shift or [ the previous one. */
function cycleTab(d) {
  const p = panes.focus == null ? panes.notePane : panes.focus; const P = panes.list[p];
  if (P.tabs.length < 2) return;
  activateTab(p, (P.active + d + P.tabs.length) % P.tabs.length);
}
