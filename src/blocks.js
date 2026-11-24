/* Block references, in the Obsidian syntax.
   A block is a paragraph, a list item, a ::: statement box, a display equation, a table or a code block.
   It has an ID when its last line ends with " ^id", or when the line after it is "^id" alone.
   Link: [[Note#^id]] (or [[#^id]] in the same note). Embed: ![[Note#^id]]. */

const BLOCK_ID_END = /(^|[ \t])\^([A-Za-z0-9][A-Za-z0-9-]*)[ \t]*$/;
const BLOCK_ID_LINE = /^[ \t]*\^([A-Za-z0-9][A-Za-z0-9-]*)[ \t]*$/;
const isBlockRef = (heading) => typeof heading === 'string' && heading.startsWith('^');

/* Split a note body into blocks: [{ kind, from, to, text, id, idFrom, idTo, idLine }].
   from/to are character offsets of the block (without an ID line after it). */
function listBlocks(body) {
  body = String(body || '');
  if (listBlocks._b === body) return listBlocks._r;
  const masked = maskCode(body);
  const lines = body.split('\n'); const ml = masked.split('\n');
  const starts = []; { let p = 0; for (const l of lines) { starts.push(p); p += l.length + 1; } }
  const fences = fencedRanges(body);
  const inFence = (i) => fences.find(([a, b]) => starts[i] >= a && starts[i] < b);
  const out = [];
  const lineEnd = (i) => starts[i] + lines[i].length;
  const push = (kind, i0, i1) => {
    const b = { kind, from: starts[i0], to: lineEnd(i1), id: null, idFrom: -1, idTo: -1, idLine: false, first: i0, last: i1 };
    const m = BLOCK_ID_END.exec(ml[i1]);
    if (m && kind !== 'code' && !BLOCK_ID_LINE.test(ml[i1])) {
      b.id = m[2]; b.idFrom = starts[i1] + m.index + m[1].length; b.idTo = lineEnd(i1);
    } else {
      // an ID on the line after the block, or after one blank line
      for (const j of [i1 + 1, i1 + 2]) {
        if (j >= lines.length) break;
        const im = BLOCK_ID_LINE.exec(ml[j]);
        if (im) { b.id = im[1]; b.idFrom = starts[j]; b.idTo = lineEnd(j); b.idLine = true; break; }
        if (j === i1 + 1 && ml[j].trim()) break;
      }
    }
    let text = body.slice(b.from, b.id && !b.idLine ? b.idFrom : b.to);
    b.text = text.replace(/[ \t]+$/, '');
    out.push(b);
  };
  let i = 0;
  const N = lines.length;
  const isList = (s) => /^\s*(?:[-*+]|\d+[.)])\s+/.test(s);
  const indentOf = (s) => (/^\s*/.exec(s) || [''])[0].replace(/\t/g, '    ').length;
  while (i < N) {
    const s = ml[i];
    if (!s.trim() || BLOCK_ID_LINE.test(s)) { i++; continue; }
    if (/^---\s*$/.test(lines[i]) && i === 0) { let j = 1; while (j < N && !/^---\s*$/.test(lines[j])) j++; i = j + 1; continue; }
    const fr = inFence(i);
    if (fr) { let j = i; while (j + 1 < N && starts[j + 1] < fr[1]) j++; push('code', i, j); i = j + 1; continue; }
    if (/^ {0,3}:{3,}[ \t]*[A-Za-z]/.test(s)) {
      let depth = 1; let j = i + 1;
      for (; j < N; j++) {
        if (/^ {0,3}:{3,}[ \t]*[A-Za-z]/.test(ml[j])) depth++;
        else if (/^ {0,3}:{3,}[ \t]*$/.test(ml[j]) && --depth === 0) break;
      }
      push('env', i, Math.min(j, N - 1)); i = j + 1; continue;
    }
    if (/^\s*\$\$/.test(s)) {
      let j = i;
      if (!/\$\$/.test(s.trim().slice(2))) { j = i + 1; while (j < N && !/\$\$/.test(ml[j])) j++; }
      push('math', i, Math.min(j, N - 1)); i = j + 1; continue;
    }
    if (/^\\begin\{/.test(s)) {
      const env = (/^\\begin\{([^}]+)\}/.exec(s) || [])[1]; let j = i;
      while (j < N && !ml[j].includes('\\end{' + env + '}')) j++;
      push('math', i, Math.min(j, N - 1)); i = j + 1; continue;
    }
    if (/^#{1,6}\s/.test(s)) { push('heading', i, i); i++; continue; }
    if (/^\s*\|/.test(s)) { let j = i; while (j + 1 < N && /^\s*\|/.test(ml[j + 1])) j++; push('table', i, j); i = j + 1; continue; }
    if (isList(s)) {
      const ind = indentOf(s); let j = i;
      while (j + 1 < N && ml[j + 1].trim() && !isList(ml[j + 1]) && indentOf(ml[j + 1]) > ind && !BLOCK_ID_LINE.test(ml[j + 1])) j++;
      push('item', i, j); i = j + 1; continue;
    }
    let j = i;
    while (j + 1 < N && ml[j + 1].trim() && !BLOCK_ID_LINE.test(ml[j + 1]) && !isList(ml[j + 1]) && !/^(#{1,6}\s| {0,3}:{3,}|\s*\$\$|\s*\|)/.test(ml[j + 1]) && !inFence(j + 1)) j++;
    if (BLOCK_ID_END.test(ml[i]) && !BLOCK_ID_LINE.test(ml[i])) j = i;
    else for (let k = i; k < j; k++) if (BLOCK_ID_END.test(ml[k])) { j = k; break; }
    push(/^\s*>/.test(s) ? 'quote' : 'para', i, j); i = j + 1;
  }
  listBlocks._b = body; listBlocks._r = out;
  return out;
}

function findBlock(body, id) {
  const hit = listBlocks(body).find((b) => b.id === id);
  if (hit) return hit;
  // an ID inside a ::: box: the block is the paragraph or list item around it
  const lines = String(body || '').split('\n'); const ml = maskCode(String(body || '')).split('\n');
  let p = 0; const starts = lines.map((l) => { const s0 = p; p += l.length + 1; return s0; });
  for (let i = 0; i < lines.length; i++) {
    const m = BLOCK_ID_END.exec(ml[i]);
    if (!m || m[2] !== id || BLOCK_ID_LINE.test(ml[i])) continue;
    let a = i; const stop = (s) => !s.trim() || /^ {0,3}:{3,}/.test(s) || BLOCK_ID_LINE.test(s);
    if (!/^\s*(?:[-*+]|\d+[.)])\s+/.test(ml[i])) while (a > 0 && !stop(ml[a - 1]) && !/^\s*(?:[-*+]|\d+[.)])\s+/.test(ml[a])) a--;
    const idFrom = starts[i] + m.index + m[1].length;
    return { kind: 'para', from: starts[a], to: starts[i] + lines[i].length, id, idFrom, idTo: starts[i] + lines[i].length, idLine: false, text: body.slice(starts[a], idFrom).replace(/[ \t]+$/, '') };
  }
  return null;
}
function blockAt(body, pos) { return listBlocks(body).find((b) => pos >= b.from && pos <= (b.idLine ? b.idTo : b.to)) || null; }

/* Plain text of a block for labels and lists. */
function blockSnippet(b, max = 60) {
  let t = b.text.replace(/^ {0,3}:{3,}[ \t]*([A-Za-z][\w-]*)[ \t]*(?:\[(.*?)\])?.*$/m, (m, k, nm) => (ENV_DEFS[k] ? ENV_DEFS[k].label : k) + (nm ? ': ' + nm : '')).replace(/^ {0,3}:{3,}\s*$/gm, '');
  t = t.replace(/^\s*(?:[-*+]|\d+[.)])\s+(\[[ xX]\]\s+)?/, '').replace(/^#{1,6}\s+/, '').replace(/^>\s?/gm, '')
    .replace(/!?\[\[([^\]|]*\|)?([^\]]*)\]\]/g, '$2').replace(/[*_=`]/g, '').replace(/\s+/g, ' ').trim();
  return t.length > max ? t.slice(0, max - 1).replace(/\s+\S*$/, '') + '…' : t;
}

function newBlockId(body) {
  let id; do { id = Math.random().toString(36).slice(2, 8); } while (!/^[a-z]/.test(id) || findBlock(body, id));
  return id;
}

/* Give a block an ID if it has none. Returns { body, id }. */
function ensureBlockId(body, b) {
  if (b.id) return { body, id: b.id };
  const id = newBlockId(body);
  const lineOwn = b.kind === 'env' || b.kind === 'math' || b.kind === 'table' || b.kind === 'code' || b.kind === 'quote';
  const ins = lineOwn ? '\n^' + id : ' ^' + id;
  return { body: body.slice(0, b.to) + ins + body.slice(b.to), id };
}

/* Read view: hide the markers, leave an anchor that links can scroll to. */
function blockAnchorHtml(id, pre) { return `<span class="block-anchor" id="${esc(pre + 'b-' + id)}" data-block="${esc(id)}"></span>`; }

/* Scroll the open note to a block and make it flash. */
function scrollToBlock(id) {
  const n = cur(); if (!n) return;
  if (app.settings.mode === 'read') {
    const a = $(`#preview [data-block="${CSS.escape(id)}"]`);
    if (!a) { toast('No block ^' + id + ' in this note'); return; }
    const host = a.closest('li, p, .env, .math-display, .table-wrap, pre, blockquote, .qa') || a.previousElementSibling || a.parentElement;
    (host || a).scrollIntoView({ behavior: 'smooth', block: 'center' }); flash(host || a);
    return;
  }
  const b = findBlock(n.body, id);
  if (!b) { toast('No block ^' + id + ' in this note'); return; }
  ed.view.dispatch({ selection: { anchor: b.from }, effects: CM.EditorView.scrollIntoView(b.from, { y: 'center' }) });
  requestAnimationFrame(() => {
    try {
      const dom = ed.view.domAtPos(b.from).node; const el = dom.nodeType === 1 ? dom : dom.parentElement;
      const line = el && el.closest('.cm-line'); if (line) flash(line);
    } catch (e) { /* the line is not drawn yet */ }
  });
}

/* Copy a link to the block under the cursor; give it an ID first if it has none. */
function copyBlockLink() {
  const n = cur(); if (!n) return;
  if (app.settings.mode === 'read') { toast('Switch to editing and put the cursor in a block.'); return; }
  const pos = ed.selection().from;
  const b = blockAt(ed.getText(), pos);
  if (!b || b.kind === 'heading') { toast(b ? 'For a heading, link to it with [[Title#Heading]].' : 'Put the cursor in a paragraph, list item, box or equation.'); return; }
  const r = ensureBlockId(ed.getText(), b);
  if (r.body !== ed.getText()) { const sel = ed.selection(); ed.setText(r.body); n.body = r.body; markDirty(); ed.setSelection(sel.from, sel.to); }
  const t = linkText(n).replace(/\]\]$/, '').replace(/^\[\[([^|\]]*)(\|.*)?$/, (m, a, lab) => `[[${a}#^${r.id}${lab || ''}`) + ']]';
  copyText(t, 'Block link copied: ' + t);
}

/* Completion for [[Note#^ and [[#^: the blocks of the note; choosing one without an ID gives it one. */
function blockCompletions(context, before) {
  const m = /\[\[([^\[\]\n|#]*)#\^([^\[\]\n|]*)$/.exec(before);
  if (!m) return null;
  const tid = m[1].trim() ? resolveTarget(m[1].trim()) : app.current;
  const tn = tid && vault.get(tid); if (!tn) return null;
  const q = fold(m[2]);
  const isSelf = tn.id === app.current;
  const body = isSelf ? ed.getText() : tn.body;
  const blocks = listBlocks(body).filter((b) => b.kind !== 'heading');
  const from = context.pos - m[2].length;
  const after = context.state.sliceDoc(context.pos, context.pos + 2);
  const options = blocks.map((b) => ({ b, s: blockSnippet(b, 80) })).filter((x) => !q || fold(x.s).includes(q) || (x.b.id && x.b.id.startsWith(q))).slice(0, 40).map((x, i) => ({
    label: x.s || '(empty)', detail: x.b.id ? '^' + x.b.id : x.b.kind, boost: 99 - i,
    apply: (view, c, f, t) => {
      let id = x.b.id;
      if (!id) {
        if (isSelf) {
          const r = ensureBlockId(view.state.doc.toString(), x.b); id = r.id;
          const ins = r.body.slice(x.b.to, x.b.to + (r.body.length - view.state.doc.length));
          view.dispatch({ changes: { from: x.b.to, insert: ins } });
          const shift = x.b.to < from ? ins.length : 0;
          const end = after === ']]' ? t + shift + 2 : t + shift;
          view.dispatch({ changes: { from: from + shift, to: Math.max(end, t + shift), insert: id + ']]' }, selection: { anchor: from + shift + id.length + 2 } });
          return;
        }
        const r = ensureBlockId(tn.body, x.b); id = r.id;
        tn.body = r.body; tn.modified = isoLocal(); vault.touch(); ed.forget(tn.id); persistNote(tn);
      }
      const end = after === ']]' ? t + 2 : t;
      view.dispatch({ changes: { from, to: Math.max(end, t), insert: id + ']]' }, selection: { anchor: from + id.length + 2 } });
    },
  }));
  return options.length ? { from, options, filter: false } : null;
}

/* Completion for [[Note# : the headings of the note, and a hint for blocks. */
function headingCompletions(context, before) {
  const m = /\[\[([^\[\]\n|#]*)#([^\[\]\n|^]*)$/.exec(before);
  if (!m) return null;
  const tid = m[1].trim() ? resolveTarget(m[1].trim()) : app.current;
  const tn = tid && vault.get(tid); if (!tn) return null;
  const body = tn.id === app.current ? ed.getText() : tn.body;
  const q = fold(m[2]); const from = context.pos - m[2].length;
  const after = context.state.sliceDoc(context.pos, context.pos + 2);
  const heads = [];
  for (const l of maskCode(body).split('\n')) { const hm = /^(#{1,6})[ \t]+(.+?)[ \t#]*$/.exec(l); if (hm) heads.push({ level: hm[1].length, text: hm[2] }); }
  const options = heads.filter((x) => !q || fold(x.text).includes(q)).map((x, i) => ({ label: x.text, detail: 'H' + x.level, boost: 50 - i,
    apply: (view, c, f, t) => { const end = after === ']]' ? t + 2 : t; view.dispatch({ changes: { from, to: Math.max(end, t), insert: x.text + ']]' }, selection: { anchor: from + x.text.length + 2 } }); } }));
  options.push({ label: '^', detail: 'link to a block', boost: -1, apply: (view, c, f, t) => { view.dispatch({ changes: { from, to: t, insert: '^' }, selection: { anchor: from + 1 } }); setTimeout(() => CM.startCompletion(view), 0); } });
  return { from, options, filter: false };
}
