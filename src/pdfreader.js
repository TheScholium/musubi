/* The PDF reader. pdf.js (Apache-2.0) is in the file as text and loads the first time a PDF opens, so a
   start without PDFs costs nothing and nothing comes from the network. A PDF opens in a tab, by default in the
   pane beside the note, so you can read and write side by side.
   Features: continuous pages, zoom and fit, page numbers, contents (the PDF outline), find, links in the PDF,
   dark pages, highlights that Musubi keeps, and "Quote into the note" with a page reference. */

let pdfjsPromise = null;
function loadPdfjs() {
  if (pdfjsPromise) return pdfjsPromise;
  pdfjsPromise = (async () => {
    const el = document.getElementById('musubi-pdfjs');
    if (!el) throw new Error('This build of Musubi has no PDF reader.');
    const src = JSON.parse(el.textContent);
    const lib = await import(URL.createObjectURL(new Blob([src.lib], { type: 'text/javascript' })));
    lib.GlobalWorkerOptions.workerSrc = URL.createObjectURL(new Blob([src.worker], { type: 'text/javascript' }));
    return lib;
  })();
  pdfjsPromise.catch(() => { pdfjsPromise = null; });
  return pdfjsPromise;
}

async function assetBlob(name) {
  const a = vault.assets.get(name); if (!a) return null;
  if (a.blob) return a.blob;
  if (a.path && typeof readFolderFile === 'function') { const b = await readFolderFile(a.path); if (b) return b; }
  return null;
}

const pdfMarks = (name) => { const all = app.settings.pdfMarks || (app.settings.pdfMarks = {}); return all[name] || (all[name] = []); };
const pdfPos = (name) => (app.settings.pdfPos || {})[name] || {};
function savePdfPos(name, v) { const all = app.settings.pdfPos || (app.settings.pdfPos = {}); all[name] = Object.assign(all[name] || {}, v); saveSettings(); }
const pdfDarkPages = () => { const v = app.settings.pdfDark; return v == null ? !themeInfo(resolvedTheme()).light : !!v; };

/* The quote text: one line, with words broken at line ends joined again. */
function cleanPdfText(s) {
  return String(s || '').replace(/­/g, '').replace(/(\w)-\s*\n\s*(\w)/g, '$1$2').replace(/\s*\n\s*/g, ' ').replace(/\s{2,}/g, ' ').trim();
}

/* The reference after a quote: [@citekey, p. N] in a literature note with a citekey, else a link to the page. */
function pdfCite(name, page, note) {
  if (note && note.citekey) return `[@${note.citekey}, p. ${page}]`;
  return `[[${name}#page=${page}|p. ${page}]]`;
}

/* Put a quote into the note that the editor holds, at its cursor (or at the end in read view). */
function quoteIntoNote(name, page, text) {
  const n = cur();
  if (!n) { toast('Open a note to quote into it. A note in the other pane works well.'); return false; }
  const body = `> ${cleanPdfText(text)}\n> — ${pdfCite(name, page, n)}\n`;
  if (app.settings.mode === 'read') {
    n.body = n.body.replace(/\s*$/, '') + '\n\n' + body;
    ed.setText(n.body); markDirty(); renderPreview();
  } else {
    const t = ed.getText(); const { from, to } = ed.selection();
    const before = t.slice(0, from); const after = t.slice(to);
    const pre = !before ? '' : /\n\n$/.test(before) ? '' : /\n$/.test(before) ? '\n' : '\n\n';
    const post = !after || /^\n/.test(after) ? '' : '\n';
    ed.replaceRange(from, to, pre + body + post);
  }
  toast(`Quoted into “${n.title}”`);
  return true;
}

function mountPdf(host, tab, paneIdx) {
  const name = tab.name;
  const saved = pdfPos(name);
  const st = { name, pdf: null, lib: null, scale: 1, zoom: saved.zoom || 'fit', pages: [], base: null, destroyed: false, cur: tab.page || saved.page || 1, texts: [], find: { q: '', hits: [], k: -1 } };
  host.innerHTML = '';
  host.classList.add('pdf-reader'); host.classList.toggle('pdf-dark', pdfDarkPages());
  const tb = (ic, title, fn, cls) => h('button', { class: 'icon-btn pdf-btn' + (cls ? ' ' + cls : ''), title, 'aria-label': title, html: typeof ic === 'string' && ic.startsWith('<') ? ic : icon(ic, 16), onclick: fn });
  const pageIn = h('input', { class: 'pdf-pagein', value: String(st.cur), 'aria-label': 'Page', inputmode: 'numeric' });
  const pageOf = h('span', { class: 'pdf-pageof' }, '/ …');
  const zoomLab = h('button', { class: 'pdf-zoomlab', title: 'Fit the width', onclick: () => setZoom('fit') }, 'fit');
  const findIn = h('input', { class: 'pdf-find', type: 'search', placeholder: 'Find', 'aria-label': 'Find in the PDF', spellcheck: 'false' });
  const findCount = h('span', { class: 'pdf-findcount' });
  const side = h('aside', { class: 'pdf-side', hidden: !saved.side });
  const scroller = h('div', { class: 'pdf-scroll', tabindex: '0' });
  const pagesEl = h('div', { class: 'pdf-pages' });
  scroller.appendChild(pagesEl);
  const selbar = h('div', { class: 'pdf-selbar', hidden: true });
  const status = h('div', { class: 'pdf-status' }, 'Opening ', h('b', null, name), '…');
  const bar = h('div', { class: 'pdf-bar' },
    tb('<svg class="ic" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><rect x="3.5" y="4.5" width="17" height="15" rx="1.2"/><path d="M9 4.5v15M5.5 8h1.5M5.5 11h1.5M5.5 14h1.5"/></svg>', 'Contents and highlights', () => { side.hidden = !side.hidden; savePdfPos(name, { side: !side.hidden }); if (!side.hidden) drawSide(); }),
    tb('back', 'Previous page', () => goto(st.cur - 1)), pageIn, pageOf, tb('fwd', 'Next page', () => goto(st.cur + 1)),
    h('span', { class: 'pdf-sep' }),
    tb('<svg class="ic" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M6 12h12"/></svg>', 'Zoom out', () => setZoom(st.scale / 1.15)),
    zoomLab,
    tb('plus', 'Zoom in', () => setZoom(st.scale * 1.15)),
    h('span', { class: 'pdf-sep' }),
    findIn, findCount,
    h('span', { class: 'pdf-fill' }),
    tb('<svg class="ic" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M12 3a9 9 0 1 0 9 9 7 7 0 0 1-9-9z"/></svg>', 'Dark pages (the colours of the page invert)', () => { app.settings.pdfDark = !pdfDarkPages(); saveSettings(); host.classList.toggle('pdf-dark', pdfDarkPages()); }, 'pdf-darkbtn'),
    tb('<svg class="ic" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/></svg>', 'Open in the browser’s own viewer', () => openAttachment(name, { external: true })));
  host.append(bar, h('div', { class: 'pdf-main' }, side, scroller), selbar, status);

  pageIn.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); goto(parseInt(pageIn.value, 10) || 1); scroller.focus(); } });
  pageIn.addEventListener('focus', () => pageIn.select());
  findIn.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); runFind(e.shiftKey ? -1 : 1); } if (e.key === 'Escape') { findIn.value = ''; runFind(0); } });
  findIn.addEventListener('input', debounce(() => runFind(0, true), 350));
  scroller.addEventListener('keydown', (e) => {
    if (e.target !== scroller) return;
    if (e.key === 'ArrowRight') { e.preventDefault(); goto(st.cur + 1); }
    else if (e.key === 'ArrowLeft') { e.preventDefault(); goto(st.cur - 1); }
    else if ((e.ctrlKey || e.metaKey) && (e.key === '=' || e.key === '+')) { e.preventDefault(); setZoom(st.scale * 1.15); }
    else if ((e.ctrlKey || e.metaKey) && e.key === '-') { e.preventDefault(); setZoom(st.scale / 1.15); }
    else if ((e.ctrlKey || e.metaKey) && e.key === '0') { e.preventDefault(); setZoom('fit'); }
    else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'f') { e.preventDefault(); findIn.focus(); }
  });
  host.addEventListener('keydown', (e) => { if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'f' && host.contains(document.activeElement)) { e.preventDefault(); findIn.focus(); findIn.select(); } });
  scroller.addEventListener('wheel', (e) => { if (e.ctrlKey) { e.preventDefault(); setZoom(st.scale * (e.deltaY < 0 ? 1.08 : 1 / 1.08)); } }, { passive: false });

  /* ---------- pages ---------- */
  const fitScale = () => { const w = scroller.clientWidth - 36; return st.base ? Math.max(0.25, Math.min(4, w / st.base.w)) : 1; };
  const sizePages = () => {
    for (const pg of st.pages) {
      const sz = pg.size || st.base;
      pg.el.style.width = Math.floor(sz.w * st.scale) + 'px'; pg.el.style.height = Math.floor(sz.h * st.scale) + 'px';
      pg.el.style.setProperty('--scale-factor', st.scale);
    }
  };
  function setZoom(z) {
    if (!st.pdf) return;
    const keep = st.cur; const frac = pageFraction();
    st.zoom = z === 'fit' ? 'fit' : Math.max(0.25, Math.min(5, z));
    st.scale = st.zoom === 'fit' ? fitScale() : st.zoom;
    zoomLab.textContent = st.zoom === 'fit' ? 'fit' : Math.round(st.scale * 100) + '%';
    for (const pg of st.pages) unrender(pg);
    sizePages();
    const el = st.pages[keep - 1] && st.pages[keep - 1].el;
    if (el) scroller.scrollTop = el.offsetTop - 12 + frac * el.offsetHeight;
    savePdfPos(name, { zoom: st.zoom });
    update();
  }
  const pageFraction = () => { const pg = st.pages[st.cur - 1]; if (!pg) return 0; return Math.max(0, (scroller.scrollTop + 12 - pg.el.offsetTop) / (pg.el.offsetHeight || 1)); };
  function unrender(pg) {
    if (pg.task) { try { pg.task.cancel(); } catch (e) { /* done */ } pg.task = null; }
    pg.el.querySelectorAll('canvas, .textLayer, .pdf-links').forEach((x) => x.remove());
    pg.rendered = 0; pg.rendering = false;
  }
  async function renderPage(pg) {
    if (pg.rendered === st.scale || pg.rendering || st.destroyed) return;
    pg.rendering = true; const scale = st.scale;
    try {
      const page = await st.pdf.getPage(pg.n);
      if (st.destroyed || scale !== st.scale) { pg.rendering = false; return; }
      const vp0 = page.getViewport({ scale: 1 }); pg.size = { w: vp0.width, h: vp0.height };
      const vp = page.getViewport({ scale });
      pg.el.style.width = Math.floor(vp.width) + 'px'; pg.el.style.height = Math.floor(vp.height) + 'px'; pg.el.style.setProperty('--scale-factor', scale);
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const canvas = document.createElement('canvas');
      canvas.width = Math.floor(vp.width * dpr); canvas.height = Math.floor(vp.height * dpr);
      canvas.style.width = Math.floor(vp.width) + 'px'; canvas.style.height = Math.floor(vp.height) + 'px';
      pg.task = page.render({ canvasContext: canvas.getContext('2d'), viewport: vp, transform: dpr !== 1 ? [dpr, 0, 0, dpr, 0, 0] : undefined });
      await pg.task.promise; pg.task = null;
      if (st.destroyed || scale !== st.scale) { pg.rendering = false; return; }
      pg.el.querySelectorAll('canvas, .textLayer, .pdf-links').forEach((x) => x.remove());
      pg.el.prepend(canvas);
      const tl = h('div', { class: 'textLayer' }); pg.el.appendChild(tl);
      const layer = new st.lib.TextLayer({ textContentSource: page.streamTextContent(), container: tl, viewport: vp });
      await layer.render();
      markFindHits(pg);
      // links inside the PDF
      const annots = await page.getAnnotations({ intent: 'display' });
      const links = h('div', { class: 'pdf-links' });
      for (const an of annots) {
        if (an.subtype !== 'Link' || !an.rect) continue;
        const [x1, y1, x2, y2] = vp.convertToViewportRectangle(an.rect);
        const a = h('a', { class: 'pdf-link', style: { left: Math.min(x1, x2) + 'px', top: Math.min(y1, y2) + 'px', width: Math.abs(x2 - x1) + 'px', height: Math.abs(y2 - y1) + 'px' } });
        if (an.url) { a.href = an.url; a.target = '_blank'; a.rel = 'noopener noreferrer'; a.title = an.url; }
        else if (an.dest) { a.href = '#'; a.title = 'Go to the place in this PDF'; a.addEventListener('click', (e) => { e.preventDefault(); gotoDest(an.dest); }); }
        else continue;
        links.appendChild(a);
      }
      pg.el.appendChild(links);
      drawMarks(pg);
      pg.rendered = scale;
    } catch (e) {
      if (e && e.name !== 'RenderingCancelledException') console.warn('[musubi] pdf page', e);
    } finally { pg.rendering = false; }
  }
  /* Render the pages near the screen; let pages far away go, to keep memory low. */
  function update() {
    if (!st.pdf || st.destroyed) return;
    const top = scroller.scrollTop; const bottom = top + scroller.clientHeight;
    let curP = 1; let best = Infinity;
    for (const pg of st.pages) {
      const a = pg.el.offsetTop; const b = a + pg.el.offsetHeight;
      const mid = top + scroller.clientHeight * 0.35;
      if (a <= mid && b >= mid) { curP = pg.n; best = 0; } else if (best && Math.abs(a - mid) < best) { best = Math.abs(a - mid); curP = pg.n; }
      const near = b > top - scroller.clientHeight * 1.2 && a < bottom + scroller.clientHeight * 1.2;
      const far = b < top - scroller.clientHeight * 5 || a > bottom + scroller.clientHeight * 5;
      if (near) renderPage(pg); else if (far && (pg.rendered || pg.rendering)) unrender(pg);
    }
    if (curP !== st.cur) { st.cur = curP; if (document.activeElement !== pageIn) pageIn.value = String(curP); tab.page = curP; savePdfPosSoon(); }
  }
  const savePdfPosSoon = debounce(() => { savePdfPos(name, { page: st.cur }); if (typeof panesSave === 'function') panesSave(); }, 800);
  let raf = 0;
  scroller.addEventListener('scroll', () => { selbar.hidden = true; if (!raf) raf = requestAnimationFrame(() => { raf = 0; update(); }); }, { passive: true });
  const ro = new ResizeObserver(debounce(() => { if (st.zoom === 'fit' && st.pdf && Math.abs(fitScale() - st.scale) > 0.01) setZoom('fit'); else update(); }, 150));
  ro.observe(scroller);

  function goto(n, frac = 0) {
    if (!st.pdf) { st.cur = n; return; }
    n = Math.max(1, Math.min(st.pdf.numPages, n | 0));
    const pg = st.pages[n - 1];
    scroller.scrollTop = pg.el.offsetTop - 12 + frac * pg.el.offsetHeight;
    st.cur = n; pageIn.value = String(n); tab.page = n; savePdfPosSoon();
    update();
  }
  async function gotoDest(dest) {
    try {
      const d = typeof dest === 'string' ? await st.pdf.getDestination(dest) : dest;
      if (!d) return;
      const idx = typeof d[0] === 'object' ? await st.pdf.getPageIndex(d[0]) : d[0];
      let frac = 0;
      if (d[1] && d[1].name === 'XYZ' && d[3] != null) { const sz = st.pages[idx].size || st.base; frac = Math.max(0, Math.min(1, 1 - d[3] / sz.h)); }
      goto(idx + 1, frac);
    } catch (e) { console.warn('[musubi] pdf destination', e); }
  }

  /* ---------- find ---------- */
  async function pageText(i) {
    if (st.texts[i] != null) return st.texts[i];
    const page = await st.pdf.getPage(i + 1); const tc = await page.getTextContent();
    st.texts[i] = tc.items.map((it) => it.str + (it.hasEOL ? '\n' : '')).join('').toLowerCase().replace(/\s+/g, ' ');
    return st.texts[i];
  }
  let findRun = 0;
  async function runFind(dir, typing) {
    const q = findIn.value.trim().toLowerCase().replace(/\s+/g, ' ');
    if (!st.pdf) return;
    if (q !== st.find.q) {
      const run = ++findRun; st.find = { q, hits: [], k: -1 };
      st.pages.forEach(markFindHits);
      if (!q) { findCount.textContent = ''; return; }
      findCount.textContent = 'searching…';
      for (let i = 0; i < st.pdf.numPages; i++) {
        const t = await pageText(i); if (run !== findRun) return;
        let c = 0; let k = -1; while ((k = t.indexOf(q, k + 1)) >= 0) c++;
        if (c) st.find.hits.push({ page: i + 1, count: c });
      }
      st.pages.forEach(markFindHits);
      if (!st.find.hits.length) { findCount.textContent = 'none'; return; }
      dir = dir || 1;
      st.find.k = dir > 0 ? st.find.hits.findIndex((x) => x.page >= st.cur) : -1;
      if (st.find.k < 0) st.find.k = 0;
    } else if (st.find.hits.length) {
      st.find.k = (st.find.k + (dir || 1) + st.find.hits.length) % st.find.hits.length;
    }
    if (!st.find.hits.length) return;
    const total = st.find.hits.reduce((s, x) => s + x.count, 0);
    findCount.textContent = `page ${st.find.k + 1} of ${st.find.hits.length} · ${total}`;
    if (!typing || st.find.hits[st.find.k].page !== st.cur) goto(st.find.hits[st.find.k].page);
  }
  function markFindHits(pg) {
    const q = st.find.q;
    for (const s of pg.el.querySelectorAll('.textLayer span')) s.classList.toggle('pdf-hit', !!q && s.textContent.toLowerCase().includes(q.split(' ')[0]) && (q.length < 3 || (st.texts[pg.n - 1] || '').includes(q)));
  }

  /* ---------- selection: quote, highlight, copy ---------- */
  const selInfo = () => {
    const sel = window.getSelection(); if (!sel || sel.isCollapsed) return null;
    const text = String(sel); if (!text.trim()) return null;
    const node = sel.anchorNode && (sel.anchorNode.nodeType === 1 ? sel.anchorNode : sel.anchorNode.parentElement);
    const pageEl = node && node.closest('.pdf-page'); if (!pageEl || !host.contains(pageEl)) return null;
    return { sel, text, page: +pageEl.dataset.n, pageEl };
  };
  scroller.addEventListener('mouseup', () => setTimeout(() => {
    const s = selInfo(); if (!s) { selbar.hidden = true; return; }
    const r = s.sel.getRangeAt(0).getBoundingClientRect(); const hr = host.getBoundingClientRect();
    selbar.innerHTML = '';
    selbar.append(
      h('button', { class: 'btn btn-sm btn-primary', title: 'Put this text in the open note as a quote, with the page', onclick: () => { const m = makeMark(s); if (quoteIntoNote(name, s.page, s.text)) { if (m) { m.quoted = true; saveMark(m); } } window.getSelection().removeAllRanges(); selbar.hidden = true; } }, 'Quote into note'),
      h('button', { class: 'btn btn-sm', onclick: () => { const m = makeMark(s); if (m) saveMark(m); s.sel.removeAllRanges(); selbar.hidden = true; } }, 'Highlight'),
      h('button', { class: 'btn btn-sm', onclick: () => { copyText(cleanPdfText(s.text), 'Copied'); selbar.hidden = true; } }, 'Copy'));
    selbar.hidden = false;
    selbar.style.left = Math.max(6, Math.min(hr.width - selbar.offsetWidth - 6, r.left - hr.left + r.width / 2 - selbar.offsetWidth / 2)) + 'px';
    selbar.style.top = Math.max(44, r.top - hr.top - selbar.offsetHeight - 8) + 'px';
  }, 10));
  function makeMark(s) {
    const pr = s.pageEl.getBoundingClientRect();
    const rects = Array.from(s.sel.getRangeAt(0).getClientRects()).filter((r) => r.width > 1 && r.height > 1)
      .map((r) => [(r.left - pr.left) / pr.width, (r.top - pr.top) / pr.height, r.width / pr.width, r.height / pr.height].map((v) => +v.toFixed(5)));
    if (!rects.length) return null;
    return { id: Math.random().toString(36).slice(2, 9), page: s.page, rects: mergeRects(rects), text: cleanPdfText(s.text), created: isoLocal(), quoted: false };
  }
  function saveMark(m) {
    pdfMarks(name).push(m); saveSettings();
    const pg = st.pages[m.page - 1]; if (pg) drawMarks(pg);
    if (!side.hidden) drawSide();
  }
  function mergeRects(rs) {
    rs.sort((a, b) => a[1] - b[1] || a[0] - b[0]); const out = [];
    for (const r of rs) {
      const l = out[out.length - 1];
      if (l && Math.abs(l[1] - r[1]) < 0.004 && r[0] <= l[0] + l[2] + 0.01) { const right = Math.max(l[0] + l[2], r[0] + r[2]); l[0] = Math.min(l[0], r[0]); l[2] = right - l[0]; l[3] = Math.max(l[3], r[3]); }
      else out.push(r.slice());
    }
    return out;
  }
  function drawMarks(pg) {
    pg.el.querySelectorAll('.pdf-hl').forEach((x) => x.remove());
    for (const m of pdfMarks(name).filter((x) => x.page === pg.n)) {
      for (const r of m.rects) {
        const d = h('div', { class: 'pdf-hl', 'data-mark': m.id, title: 'Highlight: click for actions', style: { left: r[0] * 100 + '%', top: r[1] * 100 + '%', width: r[2] * 100 + '%', height: r[3] * 100 + '%' } });
        d.addEventListener('click', (e) => { e.stopPropagation(); markMenu(d, m); });
        pg.el.appendChild(d);
      }
    }
  }
  function markMenu(anchor, m) {
    openMenu(anchor, [
      { icon: 'scroll', label: 'Quote into the open note', run: () => { if (quoteIntoNote(name, m.page, m.text)) { m.quoted = true; saveSettings(); } } },
      { icon: 'copy', label: 'Copy the text', run: () => copyText(m.text, 'Copied') },
      '-',
      { icon: 'trash', label: 'Remove the highlight', danger: true, run: () => { const list = pdfMarks(name); list.splice(list.indexOf(m), 1); saveSettings(); const pg = st.pages[m.page - 1]; if (pg) drawMarks(pg); if (!side.hidden) drawSide(); } },
    ]);
  }

  /* ---------- side panel: contents and highlights ---------- */
  let sideTab = saved.sideTab || 'contents'; let outline = null;
  async function drawSide() {
    side.innerHTML = '';
    const tabs = h('div', { class: 'pdf-sidetabs' }, ...[['contents', 'Contents'], ['marks', 'Highlights']].map(([k, l]) => h('button', { class: k === sideTab ? 'on' : '', onclick: () => { sideTab = k; savePdfPos(name, { sideTab: k }); drawSide(); } }, l + (k === 'marks' && pdfMarks(name).length ? ` ${pdfMarks(name).length}` : ''))));
    side.appendChild(tabs);
    const box = h('div', { class: 'pdf-sidebody' }); side.appendChild(box);
    if (sideTab === 'marks') {
      const marks = pdfMarks(name).slice().sort((a, b) => a.page - b.page);
      if (!marks.length) { box.appendChild(h('p', { class: 'muted small pdf-sidehint' }, 'Select text on a page, then choose Highlight or Quote into note.')); return; }
      box.appendChild(h('div', { class: 'btn-row pdf-sideactions' },
        h('button', { class: 'btn btn-sm', title: 'Quote every highlight into the open note', onclick: () => { const n = cur(); if (!n) { toast('Open a note first.'); return; } for (const m of marks) quoteIntoNote(name, m.page, m.text); } }, 'Quote all into note')));
      for (const m of marks) box.appendChild(h('button', { class: 'pdf-markrow', onclick: () => { goto(m.page, Math.max(0, m.rects[0][1] - 0.05)); } },
        h('span', { class: 'pdf-markpage' }, 'p. ' + m.page), h('span', { class: 'pdf-marktext' }, m.text.length > 180 ? m.text.slice(0, 180) + '…' : m.text), m.quoted ? h('span', { class: 'pdf-markq', title: 'Quoted into a note' }, '❝') : null));
      return;
    }
    if (!st.pdf) return;
    if (!outline) { try { outline = (await st.pdf.getOutline()) || []; } catch (e) { outline = []; } }
    if (!outline.length) { box.appendChild(h('p', { class: 'muted small pdf-sidehint' }, 'This PDF has no table of contents.')); return; }
    const lvl = (items, depth) => { for (const it of items) { box.appendChild(h('button', { class: 'pdf-outrow', style: { paddingLeft: (8 + depth * 12) + 'px' }, title: it.title, onclick: () => { if (it.dest) gotoDest(it.dest); else if (it.url) window.open(it.url, '_blank', 'noopener'); } }, it.title)); if (it.items && it.items.length && depth < 4) lvl(it.items, depth + 1); } };
    lvl(outline, 0);
  }

  /* ---------- load ---------- */
  (async () => {
    try {
      const [lib, blob] = await Promise.all([loadPdfjs(), assetBlob(name)]);
      if (st.destroyed) return;
      if (!blob) { status.textContent = 'The file could not be read. Is the folder still linked?'; return; }
      st.lib = lib;
      const data = new Uint8Array(await blob.arrayBuffer());
      st.loading = lib.getDocument({ data, isEvalSupported: false, useSystemFonts: true, enableXfa: false });
      st.pdf = await st.loading.promise;
      if (st.destroyed) { st.pdf.destroy(); return; }
      const p1 = await st.pdf.getPage(1); const v1 = p1.getViewport({ scale: 1 });
      st.base = { w: v1.width, h: v1.height };
      pageOf.textContent = '/ ' + st.pdf.numPages;
      for (let i = 1; i <= st.pdf.numPages; i++) {
        const el = h('div', { class: 'pdf-page', 'data-n': String(i) }, h('span', { class: 'pdf-pagenum' }, String(i)));
        pagesEl.appendChild(el); st.pages.push({ n: i, el, rendered: 0 });
      }
      status.remove();
      st.scale = st.zoom === 'fit' ? fitScale() : st.zoom;
      zoomLab.textContent = st.zoom === 'fit' ? 'fit' : Math.round(st.scale * 100) + '%';
      sizePages();
      goto(st.cur);
      if (!side.hidden) drawSide();
      if (typeof panes !== 'undefined') { const t = tabOf(paneIdx); if (t && t.k === 'pdf' && t.name === name) renderTabbars(); }
    } catch (e) {
      console.error(e);
      status.innerHTML = '';
      status.append(h('p', null, 'The PDF reader could not open this file: ' + (e && e.message ? e.message : e)),
        h('button', { class: 'btn btn-sm', onclick: () => openAttachment(name, { external: true }) }, 'Open it in the browser’s viewer'));
    }
  })();

  return {
    name,
    goto: (n) => goto(n),
    destroy() {
      st.destroyed = true; ro.disconnect();
      for (const pg of st.pages) unrender(pg);
      try { if (st.pdf) st.pdf.destroy(); else if (st.loading) st.loading.destroy(); } catch (e) { /* closed */ }
      host.innerHTML = '';
    },
  };
}

/* The PDFs in the vault, for the command palette. */
function openPdfPicker() {
  const pdfs = Array.from(vault.assets.keys()).filter((n) => /\.pdf$/i.test(n)).sort((a, b) => a.localeCompare(b));
  let ov;
  const input = h('input', { class: 'pal-input', placeholder: pdfs.length ? 'Find a PDF' : 'No PDFs yet', autocomplete: 'off', spellcheck: 'false' });
  const list = h('div', { class: 'pal-list' });
  const file = h('input', { type: 'file', accept: '.pdf,application/pdf', hidden: true });
  file.addEventListener('change', async () => { const f = file.files[0]; if (!f) return; const nm = await saveAsset(f, f.name, cur()); ov.close(); openPdfTab(nm); });
  const draw = () => {
    list.innerHTML = ''; const q = fold(input.value.trim());
    const items = pdfs.filter((n) => !q || fold(n).includes(q));
    for (const n of items.slice(0, 60)) { const a = vault.assets.get(n); list.appendChild(h('div', { class: 'pal-item', onclick: () => { ov.close(); openPdfTab(n); } }, h('span', { class: 'pal-cmd-ic', html: icon('scroll', 13) }), h('div', { class: 'pal-main' }, h('div', { class: 'pal-title' }, n), a && a.path ? h('div', { class: 'pal-sub' }, a.path) : null), h('span', { class: 'pal-meta' }, (pdfMarks(n).length ? pdfMarks(n).length + ' highlights · ' : '') + fmtSize(a && a.size)))); }
    list.appendChild(h('div', { class: 'pal-item pal-create', onclick: () => file.click() }, h('span', { class: 'pal-cmd-ic', html: icon('plus', 13) }), h('div', { class: 'pal-main' }, h('div', { class: 'pal-title' }, 'Add a PDF from this computer…'))));
  };
  input.addEventListener('input', draw);
  input.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); const f = list.querySelector('.pal-item'); if (f) f.click(); } });
  ov = overlay('ov-palette', h('div', { class: 'palette' }, input, list, file));
  draw(); input.focus();
}
