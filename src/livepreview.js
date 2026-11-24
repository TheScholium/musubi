/* Musubi live preview: a CodeMirror 6 editor that renders Markdown and TeX in place
   and shows the source of a construct while the cursor is inside it. */

const {
  EditorState, StateField, StateEffect, EditorSelection, Prec, Compartment,
  EditorView, Decoration, WidgetType, keymap, drawSelection, placeholder, ViewPlugin,
  defaultKeymap, history: cmHistory, historyKeymap, indentMore, indentLess,
  syntaxTree, ensureSyntaxTree, HighlightStyle, syntaxHighlighting, indentUnit,
  markdown, markdownLanguage, insertNewlineContinueMarkup,
  autocompletion, completionKeymap, closeBrackets, closeBracketsKeymap, acceptCompletion,
  searchKeymap, tags: T,
} = CM;

/* ---------- widgets ---------- */
class HtmlWidget extends WidgetType {
  constructor(html, cls, opts = {}) { super(); this.html = html; this.cls = cls; this.opts = opts; }
  eq(o) { return o.html === this.html && o.cls === this.cls && o.opts.key === this.opts.key; }
  toDOM(view) {
    const el = document.createElement(this.opts.block ? 'div' : 'span');
    el.className = this.cls; el.innerHTML = this.html;
    if (this.opts.onDom) this.opts.onDom(el, view);
    if (this.opts.ignore) el.addEventListener('mousedown', lpAnchorDown);
    return el;
  }
  ignoreEvent(e) { return this.opts.ignore ? this.opts.ignore(e) : false; }
}

class LinkWidget extends WidgetType {
  constructor(spec) { super(); this.s = spec; }
  eq(o) { return JSON.stringify(o.s) === JSON.stringify(this.s); }
  toDOM() {
    const s = this.s; const wrap = document.createElement('span'); wrap.className = 'cm-lp-link';
    if (s.rel) { const r = document.createElement('span'); r.className = 'rel rel-' + REL_CLASS(s.rel); r.textContent = s.rel; wrap.appendChild(r); }
    const a = document.createElement('a');
    a.textContent = s.label;
    if (s.att) { a.className = 'att att-' + attKind(s.att); a.dataset.att = s.att; a.dataset.ext = attExt(s.att); a.href = '#att'; if (s.page) a.dataset.page = String(s.page); }
    else if (s.missing) { a.className = 'asset-missing'; a.textContent = 'Missing file: ' + s.target; }
    else { a.className = 'wl' + (s.id ? '' : ' broken'); if (s.id) { a.dataset.id = s.id; a.href = '#n-' + s.id; if (s.heading) a.dataset.heading = s.heading; if (s.block) a.dataset.block = s.block; } else a.dataset.target = s.target; }
    wrap.appendChild(a);
    wrap.addEventListener('mousedown', lpAnchorDown);
    return wrap;
  }
  ignoreEvent(e) { return e.type === 'mousedown' && !e.altKey && e.button === 0; }
}

class CheckboxWidget extends WidgetType {
  constructor(checked, pos) { super(); this.checked = checked; this.pos = pos; }
  eq(o) { return o.checked === this.checked && o.pos === this.pos; }
  toDOM(view) {
    const el = document.createElement('input'); el.type = 'checkbox'; el.checked = this.checked; el.className = 'cm-lp-task';
    el.addEventListener('mousedown', (e) => {
      e.preventDefault();
      view.dispatch({ changes: { from: this.pos + 1, to: this.pos + 2, insert: this.checked ? ' ' : 'x' } });
    });
    return el;
  }
  ignoreEvent() { return true; }
}

const focusEffect = StateEffect.define();
const refreshEffect = StateEffect.define();
const focusField = StateField.define({
  create: () => false,
  update(v, tr) { for (const e of tr.effects) if (e.is(focusEffect)) return e.value; return v; },
});

/* ---------- analysis: everything that does not depend on the selection ---------- */
function lpAnalyze(state, noteRef) {
  const text = state.doc.toString();
  const items = []; // {from, to, kind, reveal: 'inline'|'line'|'block', ...}
  const protectedR = []; // ranges other scanners must not touch
  const fr = fencedRanges(text);
  const masked = maskCode(text);
  const note = noteRef ? noteRef() : null;
  const lineAt = (pos) => state.doc.lineAt(pos);

  // statement environments (::: blocks), including nesting
  const envs = []; const stack = []; let counter = 0;
  {
    let pos = 0;
    for (const line of masked.split('\n')) {
      const from = pos; const to = pos + line.length; pos = to + 1;
      const o = /^ {0,3}(:{3,})[ \t]*([A-Za-z][\w-]*)[ \t]*(?:\[(.*)\])?[ \t]*(.*)$/.exec(line);
      if (o) {
        const kind = o[2].toLowerCase();
        const def = ENV_DEFS[kind] || { label: kind[0].toUpperCase() + kind.slice(1), num: false, style: 'rem' };
        const label = def.num ? def.label + ' ' + (++counter) : def.label;
        const nameRaw = o[3] != null ? text.slice(from, to).replace(/^ {0,3}:{3,}[ \t]*[A-Za-z][\w-]*[ \t]*\[/, '').replace(/\][^\]]*$/, '') : '';
        stack.push({ kind, def, label, name: nameRaw, colons: o[1].length, headFrom: from, headTo: to });
        continue;
      }
      const c = /^ {0,3}(:{3,})[ \t]*$/.exec(line);
      if (c && stack.length) {
        let k = stack.length - 1;
        for (let j = stack.length - 1; j >= 0; j--) if (stack[j].colons === c[1].length) { k = j; break; }
        while (stack.length > k) {
          const e = stack.pop();
          envs.push(Object.assign(e, { closeFrom: from, closeTo: to, depth: stack.length }));
        }
      }
    }
  }
  for (const e of envs) {
    protectedR.push([e.headFrom, e.headTo], [e.closeFrom, e.closeTo]);
    items.push({ kind: 'env', from: e.headFrom, to: e.closeTo, env: e });
  }

  // math (display numbering is per note, in document order)
  const mm = findMath(masked).filter((m) => !protectedR.some(([a, b]) => m.start < b && m.end > a));
  const maths = mm.map((m) => ({ start: m.start, end: m.end, tex: text.slice(m.start, m.end), display: m.display, env: m.env }))
    .map((m, i) => Object.assign(m, { tex: mm[i].tex }));
  const eqLabels = numberEquations(maths, !(app.settings && app.settings.autoNumber === false));
  const hasDefs = /\\(newcommand|renewcommand|def|gdef|edef|let)(?![A-Za-z])/.test(masked);
  const macros = Object.assign({}, baseMacros);
  for (const m of maths) {
    const html = texToHtml(m.tex, m.display, macros, !hasDefs);
    const lf = lineAt(m.start); const lt = lineAt(m.end);
    const wholeLines = m.display && /^\s*$/.test(text.slice(lf.from, m.start)) && /^\s*$/.test(text.slice(m.end, lt.to));
    items.push({ kind: wholeLines ? 'mathblock' : 'math', from: wholeLines ? lf.from : m.start, to: wholeLines ? lt.to : m.end, html, display: m.display });
    protectedR.push([m.start, m.end]);
  }

  const mmask = applyMask(masked, maths.map((m) => [m.start, m.end]));
  const free = (a, b) => !protectedR.some(([x, y]) => a < y && b > x);
  let m;

  // embeds alone on a line
  const embedRe = /^[ \t]*!\[\[([^\[\]\n|]+?)(?:\|([^\[\]\n]*?))?\]\][ \t]*$/gm;
  while ((m = embedRe.exec(mmask))) {
    const a = m.index; const b = a + m[0].length;
    const html = renderMarkdown(text.slice(a, b).trim(), { note, idPrefix: 'lpe' + a + '-' });
    items.push({ kind: 'embed', from: a, to: b, html });
    protectedR.push([a, b]);
  }
  // typed links, links, inline embeds
  const linkRe = /(?:(^|[\s(>*_])([A-Za-z][\w-]*)::)?(!?)\[\[([^\[\]\n|]+?)(?:\|([^\[\]\n]*?))?\]\]/gm;
  while ((m = linkRe.exec(mmask))) {
    const pfx = m[1] || ''; const a = m.index + pfx.length; const b = m.index + m[0].length;
    if (!free(a, b)) continue;
    const raw = text.slice(b - 2 - (m[5] != null ? m[5].length + 1 : 0) - m[4].length, b - 2 - (m[5] != null ? m[5].length + 1 : 0));
    const { target, heading } = splitTarget(raw);
    const id = target ? resolveTarget(target) : (note ? note.id : null);
    const blockId = isBlockRef(heading) ? heading.slice(1) : '';
    const blk = blockId && id ? findBlock(id === (note && note.id) ? text : vault.get(id).body, blockId) : null;
    const label = m[5] != null ? m[5] : (id ? (blockId ? (target ? vault.get(id).title + ' › ' : '') + (blk ? blockSnippet(blk, 48) : '^' + blockId) : heading ? (target ? vault.get(id).title + ' › ' : '') + heading : vault.get(id).title) : raw);
    if (m[3]) {
      const html = renderMarkdown(text.slice(a, b), { note, idPrefix: 'lpi' + a + '-' }).replace(/^\s*<p>|<\/p>\s*$/g, '');
      items.push({ kind: 'inlineembed', from: a, to: b, html });
    } else {
      const att = !id && hasFileExt(target) ? findAsset(target, note) : null;
      const pdfPage = att ? pageOfHeading(heading) : 0;
      items.push({ kind: 'link', from: a, to: b, spec: { id, target, heading: heading && !blockId && !pdfPage ? slugify(heading) : '', block: blockId, page: pdfPage, label: att && pdfPage && m[5] == null ? `${target}, p. ${pdfPage}` : label, rel: m[2] ? m[2].toLowerCase() : '', att: att ? att.name : '', missing: !id && hasFileExt(target) && !att } });
    }
    protectedR.push([a, b]);
  }
  // citations
  const citeRe = /\[(@[^\]\n]+)\](?!\()/g;
  while ((m = citeRe.exec(mmask))) {
    const a = m.index; const b = a + m[0].length;
    if (!free(a, b)) continue;
    const html = renderMarkdown(text.slice(a, b), { note, idPrefix: 'lpc-' }).replace(/^\s*<p>|<\/p>\s*$/g, '');
    items.push({ kind: 'cite', from: a, to: b, html });
    protectedR.push([a, b]);
  }
  // equation references outside math
  const eqRe = /\\(eqref|ref)\{([^}\n]*)\}/g;
  while ((m = eqRe.exec(mmask))) {
    const a = m.index; const b = a + m[0].length;
    if (!free(a, b)) continue;
    const v = eqLabels[m[2].trim()];
    items.push({ kind: 'eqref', from: a, to: b, label: v ? (m[1] === 'eqref' ? '(' + v + ')' : v) : '(??)', broken: !v });
    protectedR.push([a, b]);
  }
  // cloze deletions
  const clozeRe = /\{\{c(\d*)::([\s\S]*?)(?:::([^{}\n]*))?\}\}/g;
  while ((m = clozeRe.exec(mmask))) {
    const a = m.index; const b = a + m[0].length;
    if (!free(a, b) || m[0].includes('\n\n')) continue;
    const openLen = m[0].indexOf('::') + 2; const innerTo = a + openLen + m[2].length;
    items.push({ kind: 'cloze', from: a, to: b, innerFrom: a + openLen, innerTo });
  }
  // tags
  const tagRe = /(^|[\s,;])#([\p{L}_][\p{L}\p{N}_\/-]*)/gu;
  while ((m = tagRe.exec(mmask))) {
    const a = m.index + m[1].length; const t = m[2].replace(/[\/-]+$/, ''); const b = a + 1 + t.length;
    if (!free(a, b)) continue;
    const ln = lineAt(a);
    if (/^#{1,6}\s/.test(text.slice(ln.from, ln.to)) && a === ln.from) continue;
    items.push({ kind: 'tag', from: a, to: b, tag: t });
  }
  // block IDs: faint at the end of a line, or on their own line
  const bidRe = /(^|[ \t])\^([A-Za-z0-9][A-Za-z0-9-]*)[ \t]*$/gm;
  while ((m = bidRe.exec(mmask))) { const a = m.index + m[1].length; const b = a + 1 + m[2].length; if (free(a, b)) items.push({ kind: 'blockid', from: a, to: b }); }
  // highlights ==text==
  const hiRe = /==(?=\S)([^=\n]+?)==/g;
  while ((m = hiRe.exec(mmask))) { const a = m.index; const b = a + m[0].length; if (free(a, b)) items.push({ kind: 'mark', from: a, to: b }); }
  // footnote references and definitions
  const fnRe = /\[\^([^\]\s]+)\](?!:)/g; const fnOrder = [];
  while ((m = fnRe.exec(mmask))) {
    const a = m.index; const b = a + m[0].length; if (!free(a, b)) continue;
    let k = fnOrder.indexOf(m[1]); if (k < 0) { fnOrder.push(m[1]); k = fnOrder.length - 1; }
    items.push({ kind: 'fnref', from: a, to: b, n: k + 1 });
  }
  const fnDefRe = /^\[\^([^\]\s]+)\]:/gm;
  while ((m = fnDefRe.exec(mmask))) items.push({ kind: 'fndef', from: m.index, to: m.index + m[0].length });
  // Q/A labels
  const qaRe = /^(Q|A):(?=[ \t{])/gm; let mlines = null;
  while ((m = qaRe.exec(mmask))) {
    items.push({ kind: 'qa', from: m.index, to: m.index + 2 });
    if (m[1] !== 'A') continue;
    // A:{ … } answer block: the braces hide, and the body lines are marked as the answer
    const ln = lineAt(m.index); const ob = ANSWER_OPEN_RE.exec(mmask.slice(ln.from, ln.to));
    if (!ob) continue;
    if (!mlines) mlines = mmask.split('\n');
    const close = findAnswerClose(mlines, ln.number - 1, ob[0].length - 1);
    if (!close) continue;
    const cl = state.doc.line(close.line + 1);
    items.push({ kind: 'ablock', from: ln.from, to: cl.to, open: ln.from + ob[0].length - 1, close: cl.from + close.col,
      closeAlone: cl.text.trim() === '}' && close.line > ln.number - 1 });
  }
  // argument rows inside argument environments
  for (const e of envs) {
    if (e.kind !== 'argument') continue;
    let p = lineAt(e.headTo).number + 1; const last = lineAt(e.closeFrom).number;
    for (; p < last; p++) {
      const ln = state.doc.line(p); const s = ln.text;
      const am = /^(\s*)\(?((?:P|C|L|IC|SC)\d*'?|\d+)\)?[.:)](?=[ \t])/.exec(s) || /^(\s*)(∴|Therefore,?|Hence,?)(?=[ \t])/i.exec(s);
      if (am) {
        items.push({ kind: 'arglabel', from: ln.from + am[1].length, to: ln.from + am[0].length, concl: /^(C|IC|∴|Therefore|Hence)/i.test(am[2]) });
        const jm = /[ \t]+(\[[^\[\]]+\])[ \t]*$/.exec(s);
        if (jm && !/^\[[@^]/.test(jm[1])) items.push({ kind: 'argjust', from: ln.from + jm.index + jm[0].indexOf('['), to: ln.from + jm.index + jm[0].indexOf('[') + jm[1].length });
      }
      else if (/^\s*(-{3,}|_{3,})\s*$/.test(s)) items.push({ kind: 'argrule', from: ln.from, to: ln.to });
    }
  }

  // Markdown syntax tree
  const tree = ensureSyntaxTree(state, state.doc.length, 250) || syntaxTree(state);
  const partial = tree.length < state.doc.length;
  const fenceSet = fr;
  tree.iterate({
    enter: (node) => {
      const name = node.name; const a = node.from; const b = node.to;
      if (name === 'FencedCode' || name === 'CodeBlock') {
        items.push({ kind: 'codeblock', from: a, to: b });
        if (name === 'FencedCode') {
          const info = node.node.getChild('CodeInfo'); const ct = node.node.getChild('CodeText');
          if (info && isPlotFence(text.slice(info.from, info.to) + text.slice(info.to, lineAt(info.to).to))) {
            const code = ct ? text.slice(lineAt(ct.from).from, ct.to) : '';
            items.push({ kind: 'plotblock', from: lineAt(a).from, to: lineAt(b).to, html: plotBlockHtml(code, false) });
          }
        }
        return false;
      }
      if (name === 'Table') {
        // Markdown continues a table over a ::: line; a fence ends the table here.
        let end = b;
        for (const e of envs) for (const f of [e.headFrom, e.closeFrom]) if (f > a && f <= end) end = Math.max(a, f - 1);
        end = Math.max(a, lineAt(end).to);
        if (/^\s*$/.test(text.slice(lineAt(end).from, end)) && end > a) end = Math.max(a, lineAt(end).from - 1);
        const html = renderMarkdown(text.slice(a, end), { note, idPrefix: 'lpt' + a + '-' });
        items.push({ kind: 'table', from: lineAt(a).from, to: lineAt(end).to, html });
        return false;
      }
      if (!free(a, b) && !/^(Blockquote|BulletList|OrderedList|ListItem|Paragraph|Document|ATXHeading\d)$/.test(name)) return false;
      if (/^ATXHeading(\d)$/.test(name)) {
        const lvl = +name.slice(-1); const mark = node.node.getChild('HeaderMark');
        items.push({ kind: 'heading', from: a, to: b, level: lvl, markTo: mark ? Math.min(b, mark.to + (text[mark.to] === ' ' ? 1 : 0)) : a });
      } else if (name === 'Emphasis' || name === 'StrongEmphasis' || name === 'Strikethrough') {
        const marks = [];
        for (let c = node.node.firstChild; c; c = c.nextSibling) if (c.name === 'EmphasisMark' || c.name === 'StrikethroughMark') marks.push([c.from, c.to]);
        items.push({ kind: name === 'Emphasis' ? 'em' : name === 'StrongEmphasis' ? 'strong' : 'strike', from: a, to: b, marks });
      } else if (name === 'InlineCode') {
        const marks = [];
        for (let c = node.node.firstChild; c; c = c.nextSibling) if (c.name === 'CodeMark') marks.push([c.from, c.to]);
        items.push({ kind: 'icode', from: a, to: b, marks });
        return false;
      } else if (name === 'Link') {
        const marks = []; let url = '';
        for (let c = node.node.firstChild; c; c = c.nextSibling) {
          if (c.name === 'LinkMark') marks.push([c.from, c.to]);
          if (c.name === 'URL') url = text.slice(c.from, c.to);
        }
        if (marks.length >= 2 && url) {
          const textTo = marks[1][0];
          items.push({ kind: 'mdlink', from: a, to: b, textFrom: marks[0][1], textTo, url });
        }
        return false;
      } else if (name === 'Image') {
        let url = ''; for (let c = node.node.firstChild; c; c = c.nextSibling) if (c.name === 'URL') url = text.slice(c.from, c.to);
        const w = imgWidthFromAlt((/^!\[([^\]]*)\]/.exec(text.slice(a, b)) || [])[1] || ''); let html;
        const ws = w.width ? ` style="width:${w.width}px"` : '';
        if (/^(?:[a-z][\w+.-]*:|\/\/)/i.test(url)) html = `<img src="${esc(url)}" alt="${esc(w.alt)}"${ws}>`;
        else { const f = findAsset(url, note); html = f && f.a.url ? `<img class="asset" src="${f.a.url}" alt="${esc(w.alt)}"${ws}>` : f ? attLinkHtml(f.name, w.alt) : `<span class="asset-missing">Missing image: ${esc(url)}</span>`; }
        items.push({ kind: 'image', from: a, to: b, url, html });
        return false;
      } else if (name === 'URL' && node.node.parent && node.node.parent.name !== 'Link' && node.node.parent.name !== 'Image') {
        items.push({ kind: 'url', from: a, to: b, url: text.slice(a, b) });
      } else if (name === 'QuoteMark') {
        items.push({ kind: 'quotemark', from: a, to: Math.min(lineAt(a).to, b + (text[b] === ' ' ? 1 : 0)) });
      } else if (name === 'Blockquote') {
        const first = lineAt(a); const cm = /^(\s*>\s*)\[!([A-Za-z-]+)\][+-]?\s*/.exec(first.text);
        items.push({ kind: 'quote', from: a, to: b, callout: cm ? cm[2].toLowerCase() : '' });
        if (cm) items.push({ kind: 'calloutmark', from: first.from + cm[1].length, to: first.from + cm[0].length, label: cm[2] });
      } else if (name === 'ListMark') {
        const item = node.node.parent; const parent = item && item.parent;
        const bullet = parent && parent.name === 'BulletList';
        let task = false;
        for (let c = item && item.firstChild; c; c = c.nextSibling) if (c.name === 'Task') { task = true; break; }
        items.push({ kind: bullet ? (task ? 'taskbullet' : 'bullet') : 'olmark', from: a, to: b });
      } else if (name === 'TaskMarker') {
        items.push({ kind: 'task', from: a, to: b, checked: /x/i.test(text.slice(a, b)) });
      } else if (name === 'HorizontalRule') {
        items.push({ kind: 'hr', from: a, to: b });
      } else if (name === 'Escape') {
        items.push({ kind: 'escape', from: a, to: a + 1 });
      }
      return undefined;
    },
  });
  void fenceSet;
  items.sort((x, y) => x.from - y.from || y.to - x.to);
  return { items, partial, docLen: state.doc.length };
}

/* ---------- decorations: depend on the selection ---------- */
function lpDecorations(state, an) {
  const sel = state.selection.ranges; const focused = state.field(focusField, false);
  const out = [];
  const touches = (a, b) => focused && sel.some((r) => r.from <= b && r.to >= a);
  const lineTouch = (a, b) => {
    if (!focused) return false;
    const la = state.doc.lineAt(a).from; const lb = state.doc.lineAt(b).to;
    return sel.some((r) => r.from <= lb && r.to >= la);
  };
  const hide = (a, b) => { if (b > a) out.push(Decoration.replace({}).range(a, b)); };
  const markC = (a, b, cls, attrs) => { if (b > a) out.push(Decoration.mark({ class: cls, attributes: attrs }).range(a, b)); };
  const lineC = (pos, cls) => out.push(Decoration.line({ class: cls }).range(state.doc.lineAt(pos).from));
  const blockRanges = []; // [a,b] replaced by block widgets: nothing else may sit inside
  const inBlock = (a, b) => blockRanges.some(([x, y]) => a >= x && b <= y);

  // Block widgets inside a ::: environment carry its classes, so that the box stays whole.
  const envs = an.items.filter((it) => it.kind === 'env').map((it) => it.env);
  const envClsOf = (e) => `cm-env cm-env-style-${e.def.style} cm-env-d${Math.min(e.depth, 2)}`;
  const envAt = (pos) => {
    let best = null;
    for (const e of envs) if (e.headTo < pos && pos < e.closeFrom && (!best || e.depth > best.depth)) best = e;
    const ab = ablocks.some((it) => state.doc.lineAt(it.from).to < pos && pos <= it.close) ? ' cm-lp-ablock' : '';
    return (best ? ' ' + envClsOf(best) + ' cm-env-block' : '') + ab;
  };
  const ablocks = an.items.filter((it) => it.kind === 'ablock');

  // first pass: blocks that are not revealed
  for (const it of an.items) {
    if (it.kind === 'mathblock' && !lineTouch(it.from, it.to)) {
      const ec = envAt(it.from);
      out.push(Decoration.replace({ widget: new HtmlWidget(it.html, 'cm-lp-mathblock' + ec, { block: true, key: it.html + ec }), block: true }).range(it.from, it.to));
      blockRanges.push([it.from, it.to]);
    } else if (it.kind === 'table' && !lineTouch(it.from, it.to)) {
      const ec = envAt(it.from);
      out.push(Decoration.replace({ widget: new HtmlWidget(it.html, 'cm-lp-table prose' + ec, { block: true, key: it.html + ec }), block: true }).range(it.from, it.to));
      blockRanges.push([it.from, it.to]);
    } else if (it.kind === 'ablock' && it.closeAlone && !lineTouch(it.close, it.close + 1)) {
      const cl = state.doc.lineAt(it.close);
      out.push(Decoration.replace({ widget: new HtmlWidget('', 'cm-lp-aclose' + envAt(cl.from).replace(' cm-lp-ablock', '').replace(' cm-env-block', ''), { block: true, key: 'aclose' + envAt(cl.from) }), block: true }).range(cl.from, cl.to));
      blockRanges.push([cl.from, cl.to]);
    } else if (it.kind === 'plotblock' && !lineTouch(it.from, it.to)) {
      const ec = envAt(it.from);
      out.push(Decoration.replace({ widget: new HtmlWidget(it.html, 'cm-lp-plot' + ec, { block: true, key: it.html + ec }), block: true }).range(it.from, it.to));
      blockRanges.push([it.from, it.to]);
    } else if (it.kind === 'embed' && !lineTouch(it.from, it.to)) {
      const ec = envAt(it.from);
      out.push(Decoration.replace({ widget: new HtmlWidget(it.html, 'cm-lp-embed prose' + ec, { block: true, key: it.html + ec, ignore: lpLinkIgnore, onDom: enhanceAttachments }), block: true }).range(state.doc.lineAt(it.from).from, state.doc.lineAt(it.to).to));
      blockRanges.push([state.doc.lineAt(it.from).from, state.doc.lineAt(it.to).to]);
    }
  }
  for (const it of an.items) {
    const { from: a, to: b } = it;
    if (it.kind === 'env') {
      const e = it.env;
      const lines = []; for (let p = state.doc.lineAt(e.headFrom).number; p <= state.doc.lineAt(e.closeTo).number; p++) lines.push(state.doc.line(p).from);
      const envCls = envClsOf(e);
      const closeHidden = !lineTouch(e.closeFrom, e.closeTo);
      lines.forEach((pos, i) => {
        if (inBlock(pos, pos)) return;
        if (i === lines.length - 1 && closeHidden) return;
        out.push(Decoration.line({ class: envCls + (i === 0 ? ' cm-env-first' : '') + (i === lines.length - 1 ? ' cm-env-last' : '') }).range(pos));
      });
      if (!lineTouch(e.headFrom, e.headTo)) {
        let nameHtml = '';
        if (e.name) nameHtml = lpInline(e.name);
        const head = e.def.style === 'quote' ? '' : `<span class="env-label">${esc(e.label)}</span>${nameHtml ? `<span class="env-colon">:</span> <span class="env-name">${nameHtml}</span>` : '<span class="env-dot">.</span>'}`;
        out.push(Decoration.replace({ widget: new HtmlWidget(head || '&nbsp;', 'cm-lp-envhead' + (head ? '' : ' cm-lp-envhead-empty'), { key: e.kind + e.label + e.name }) }).range(e.headFrom, e.headTo));
      } else markC(e.headFrom, e.headTo, 'cm-lp-src');
      if (closeHidden) {
        const end = e.kind === 'proof' || e.kind === 'solution' ? '∎' : (e.kind === 'quote' && e.name ? '— ' + lpInline(e.name) : '');
        out.push(Decoration.replace({ widget: new HtmlWidget(end, 'cm-lp-envclose ' + envCls + (end ? '' : ' empty'), { block: true, key: envCls + end }), block: true }).range(e.closeFrom, e.closeTo));
      } else markC(e.closeFrom, e.closeTo, 'cm-lp-src');
      continue;
    }
    if (inBlock(a, b)) continue;
    switch (it.kind) {
      case 'math':
        if (touches(a, b)) markC(a, b, 'cm-lp-mathsrc');
        else out.push(Decoration.replace({ widget: new HtmlWidget(it.html, it.display ? 'cm-lp-math cm-lp-math-d' : 'cm-lp-math', { key: it.html }) }).range(a, b));
        break;
      case 'mathblock':
        for (let p = state.doc.lineAt(a).number; p <= state.doc.lineAt(b).number; p++) lineC(state.doc.line(p).from, 'cm-lp-mathsrc-line');
        { const ec = envAt(a); out.push(Decoration.widget({ widget: new HtmlWidget(it.html, 'cm-lp-mathpreview' + ec, { block: true, key: 'pv' + it.html + ec }), block: true, side: 1 }).range(b)); }
        break;
      case 'table': for (let p = state.doc.lineAt(a).number; p <= state.doc.lineAt(b).number; p++) lineC(state.doc.line(p).from, 'cm-lp-tablesrc'); break;
      case 'embed': markC(a, b, 'cm-lp-src'); break;
      case 'link':
        if (touches(a, b)) markC(a, b, 'cm-lp-linksrc');
        else out.push(Decoration.replace({ widget: new LinkWidget(it.spec) }).range(a, b));
        break;
      case 'inlineembed': case 'cite':
        if (touches(a, b)) markC(a, b, 'cm-lp-linksrc');
        else out.push(Decoration.replace({ widget: new HtmlWidget(it.html, 'cm-lp-' + it.kind, { key: it.html, ignore: lpLinkIgnore, onDom: enhanceAttachments }) }).range(a, b));
        break;
      case 'eqref':
        if (touches(a, b)) markC(a, b, 'cm-lp-src');
        else out.push(Decoration.replace({ widget: new HtmlWidget(esc(it.label), 'cm-lp-eqref' + (it.broken ? ' broken' : ''), { key: it.label }) }).range(a, b));
        break;
      case 'cloze':
        if (touches(a, b)) markC(a, b, 'cm-lp-src');
        else { hide(a, it.innerFrom); markC(it.innerFrom, it.innerTo, 'cloze'); hide(it.innerTo, b); }
        break;
      case 'tag': markC(a, b, 'cm-lp-tag', { 'data-tag': it.tag }); break;
      case 'mark':
        if (touches(a, b)) markC(a, b, 'cm-lp-hl');
        else { hide(a, a + 2); markC(a + 2, b - 2, 'cm-lp-hl'); hide(b - 2, b); }
        break;
      case 'fnref':
        if (touches(a, b)) markC(a, b, 'cm-lp-src');
        else out.push(Decoration.replace({ widget: new HtmlWidget(String(it.n), 'cm-lp-fnref', { key: 'fn' + it.n }) }).range(a, b));
        break;
      case 'fndef': lineC(a, 'cm-lp-fndef'); markC(a, b, 'cm-lp-faint'); break;
      case 'qa': markC(a, b, 'cm-lp-qa'); break;
      case 'blockid': markC(a, b, 'cm-lp-blockid', { title: 'Block ID: link with [[Title#' + state.sliceDoc(a, b) + ']]' }); break;
      case 'ablock': {
        const l0 = state.doc.lineAt(a).number; const l1 = state.doc.lineAt(b).number;
        for (let p = l0 + 1; p <= l1; p++) { const lf = state.doc.line(p).from; if (!inBlock(lf, lf)) lineC(lf, 'cm-lp-ablock' + (p === l1 ? ' cm-lp-ablock-last' : '')); }
        for (const pos of [it.open, it.close]) {
          if (inBlock(pos, pos + 1)) continue;
          if (lineTouch(pos, pos + 1)) markC(pos, pos + 1, 'cm-lp-src');
          else if (pos === it.open && /[^ \t]/.test(state.doc.sliceString(pos + 1, Math.min(pos + 2, state.doc.lineAt(pos).to)))) {
            // keep a space between "A:" and the answer when the brace hides
            out.push(Decoration.replace({ widget: new HtmlWidget(' ', 'cm-lp-agap', { key: 'agap' }) }).range(pos, pos + 1));
          } else hide(pos, pos + 1);
        }
        break;
      }
      case 'arglabel': markC(a, b, 'cm-lp-arglabel' + (it.concl ? ' concl' : '')); if (it.concl) lineC(a, 'cm-lp-argconcl'); break;
      case 'argjust':
        if (touches(a, b)) markC(a, b, 'cm-lp-argjust');
        else { hide(a, a + 1); markC(a + 1, b - 1, 'cm-lp-argjust'); hide(b - 1, b); }
        break;
      case 'argrule': if (!lineTouch(a, b)) out.push(Decoration.replace({ widget: new HtmlWidget('', 'cm-lp-argrule', { key: 'ar' }) }).range(a, b)); break;
      case 'heading':
        lineC(a, 'cm-h cm-h' + it.level);
        if (!lineTouch(a, b)) hide(a, it.markTo); else markC(a, it.markTo, 'cm-lp-faint');
        break;
      case 'em': case 'strong': case 'strike':
        markC(a, b, 'cm-lp-' + it.kind);
        if (!touches(a, b)) for (const [x, y] of it.marks) hide(x, y); else for (const [x, y] of it.marks) markC(x, y, 'cm-lp-faint');
        break;
      case 'icode':
        markC(a, b, 'cm-lp-icode');
        if (!touches(a, b)) for (const [x, y] of it.marks) hide(x, y);
        break;
      case 'mdlink':
        if (touches(a, b)) markC(a, b, 'cm-lp-linksrc');
        else { hide(a, it.textFrom); markC(it.textFrom, it.textTo, 'cm-lp-mdlink', { 'data-href': it.url }); hide(it.textTo, b); }
        break;
      case 'url': markC(a, b, 'cm-lp-mdlink', { 'data-href': it.url }); break;
      case 'image':
        if (touches(a, b)) markC(a, b, 'cm-lp-src');
        else out.push(Decoration.replace({ widget: new HtmlWidget(it.html, 'cm-lp-image', { key: it.html, ignore: lpLinkIgnore }) }).range(a, b));
        break;
      case 'quote': {
        for (let p = state.doc.lineAt(a).number; p <= state.doc.lineAt(b).number; p++) lineC(state.doc.line(p).from, 'cm-lp-quote' + (it.callout ? ' cm-lp-callout cm-lp-callout-' + it.callout : ''));
        if (it.callout) lineC(a, 'cm-lp-callout-first');
        break;
      }
      case 'calloutmark':
        if (!lineTouch(a, b)) out.push(Decoration.replace({ widget: new HtmlWidget(esc(it.label[0].toUpperCase() + it.label.slice(1).toLowerCase()), 'cm-lp-calloutlabel', { key: it.label }) }).range(a, b));
        break;
      case 'quotemark': if (!lineTouch(a, b)) hide(a, b); else markC(a, b, 'cm-lp-faint'); break;
      case 'bullet':
        if (!touches(a, b)) out.push(Decoration.replace({ widget: new HtmlWidget('•', 'cm-lp-bullet', { key: 'b' }) }).range(a, b));
        else markC(a, b, 'cm-lp-faint');
        break;
      case 'olmark': markC(a, b, 'cm-lp-olmark'); break;
      case 'taskbullet': if (!lineTouch(a, b)) hide(a, Math.min(b + 1, state.doc.lineAt(a).to)); else markC(a, b, 'cm-lp-faint'); break;
      case 'task':
        if (!touches(a, b)) out.push(Decoration.replace({ widget: new CheckboxWidget(it.checked, a) }).range(a, b));
        break;
      case 'hr':
        if (!lineTouch(a, b)) out.push(Decoration.replace({ widget: new HtmlWidget('', 'cm-lp-hr', { key: 'hr' }) }).range(a, b));
        else markC(a, b, 'cm-lp-faint');
        break;
      case 'codeblock':
        for (let p = state.doc.lineAt(a).number; p <= state.doc.lineAt(b).number; p++) {
          const ln = state.doc.line(p);
          const fence = /^ {0,3}(`{3,}|~{3,})/.test(ln.text);
          lineC(ln.from, 'cm-lp-codeblock' + (fence ? ' cm-lp-fence' : ''));
        }
        break;
      case 'plotblock': out.push(Decoration.widget({ widget: new HtmlWidget(it.html, 'cm-lp-plot cm-lp-plotpreview', { block: true, key: 'pv' + it.html }), block: true, side: 1 }).range(b)); break;
      case 'escape': if (!touches(a, b + 1)) hide(a, b); break;
      default: break;
    }
  }
  try { return Decoration.set(out, true); }
  catch (e) { console.warn('[musubi] live preview decoration error', e); return Decoration.none; }
}

/* Widgets that hold links get their own handler, because CodeMirror does not see events a widget ignores. */
function lpAnchorDown(e) {
  if (e.button !== 0 || e.altKey) return;
  const a = e.target.closest && e.target.closest('a.wl, a.cite-ref, a.att');
  if (!a) return;
  e.preventDefault(); e.stopPropagation();
  if (a.dataset.att) openAttachment(a.dataset.att, +a.dataset.page || 0);
  else if (a.dataset.id) openWithKeys(e, a.dataset.id, { heading: a.dataset.heading, block: a.dataset.block });
  else if (a.dataset.target) createFromBroken(a.dataset.target);
  else if (a.dataset.cite) newNoteDialog({ title: a.dataset.cite, type: 'literature', citekey: a.dataset.cite });
}
function lpLinkIgnore(e) { return e.type === 'mousedown' && !e.altKey && !!(e.target.closest && e.target.closest('a, button, video, audio, iframe, summary')); }

const lpInlineCache = new Map();
function lpInline(src) {
  if (lpInlineCache.has(src)) return lpInlineCache.get(src);
  const html = renderMarkdown(src, { idPrefix: 'lpn-' }).replace(/^\s*<p>|<\/p>\s*$/g, '');
  if (lpInlineCache.size > 500) lpInlineCache.clear();
  lpInlineCache.set(src, html);
  return html;
}

function livePreviewExt(noteRef) {
  const field = StateField.define({
    create(state) { const an = lpAnalyze(state, noteRef); return { an, deco: lpDecorations(state, an) }; },
    update(v, tr) {
      const refresh = tr.effects.some((e) => e.is(refreshEffect));
      const focusChange = tr.effects.some((e) => e.is(focusEffect));
      if (!tr.docChanged && !tr.selection && !refresh && !focusChange) return v;
      const an = tr.docChanged || refresh ? lpAnalyze(tr.state, noteRef) : v.an;
      return { an, deco: lpDecorations(tr.state, an) };
    },
    provide: (f) => EditorView.decorations.from(f, (v) => v.deco),
  });
  const reparse = ViewPlugin.fromClass(class {
    update(u) {
      const v = u.state.field(field);
      if (v.an.partial && syntaxTree(u.state).length >= u.state.doc.length) setTimeout(() => u.view.dispatch({ effects: refreshEffect.of(null) }), 0);
    }
  });
  return [field, reparse];
}

/* ---------- autocompletion ---------- */
function lpCompletions(context) {
  const line = context.state.doc.lineAt(context.pos);
  const before = line.text.slice(0, context.pos - line.from);
  let m;
  const bc = blockCompletions(context, before) || headingCompletions(context, before);
  if (bc) return bc;
  if ((m = /\[\[([^\[\]\n|]*)$/.exec(before))) {
    const q = m[1]; const from = context.pos - m[0].length;
    const after = context.state.sliceDoc(context.pos, context.pos + 2);
    const opts = linkSuggestions(q).map((s, i) => ({
      label: s.create ? s.label : s.note.title, detail: s.detail, boost: 99 - i, type: s.note ? 'type-' + s.note.type : 'create',
      apply: (view, c, f, t) => {
        let note = s.note;
        if (s.create) { note = createNote({ title: s.create, type: 'concept', status: 'draft', body: '' }, { open: false }); toast(`Created “${note.title}”`); }
        const end = after === ']]' ? context.pos + 2 : t;
        const ins = linkText(note);
        view.dispatch({ changes: { from, to: Math.max(end, t), insert: ins }, selection: { anchor: from + ins.length } });
      },
    }));
    return { from: from + 2, options: opts, filter: false };
  }
  if ((m = /\[@([\w:.\-\/]*)$/.exec(before)) || (m = /;\s*@([\w:.\-\/]*)$/.exec(before))) {
    const q = m[1].toLowerCase();
    const options = vault.all().filter((n) => n.citekey && (n.citekey.toLowerCase().includes(q) || normTitle(n.title).includes(q)))
      .slice(0, 20).map((n) => ({ label: '@' + n.citekey, detail: n.title, apply: '@' + n.citekey }));
    return options.length ? { from: context.pos - m[1].length - 1, options, filter: false } : null;
  }
  if ((m = /^ {0,3}:::([a-z]*)$/.exec(before))) {
    const from = line.from + before.indexOf(':::');
    const options = ENV_NAMES.filter((k) => k.startsWith(m[1])).map((k) => {
      const snip = ['proof', 'intuition', 'remark', 'note', 'solution'].includes(k) ? `:::${k}\n|\n:::` : k === 'argument' ? ':::argument[|]\nP1. \nP2. \nC. \n:::' : `:::${k}[|]\n\n:::`;
      return { label: ':::' + k, detail: ENV_DEFS[k].label || 'quotation', apply: snippetApply(snip, from) };
    });
    return options.length ? { from, options, filter: false } : null;
  }
  if ((m = /(?:^|[\s,;])#([\p{L}\p{N}_\/-]+)$/u.exec(before))) {
    const q = m[1].toLowerCase(); const idx = vault.index();
    const options = Array.from(idx.tagCount.keys()).filter((t) => t.toLowerCase().includes(q) && t.toLowerCase() !== q)
      .sort((x, y) => idx.tagCount.get(y) - idx.tagCount.get(x)).slice(0, 10)
      .map((t) => ({ label: '#' + t, detail: idx.tagCount.get(t) + ' notes', apply: '#' + t }));
    return options.length ? { from: context.pos - m[1].length - 1, options, filter: false } : null;
  }
  if ((m = /\\([A-Za-z]{2,})$/.exec(before))) {
    const q = '\\' + m[1]; const from = context.pos - q.length; const seen = new Set();
    const all = [...Object.keys(baseMacros).map((k) => [k, k]), ...LATEX_SNIPPETS];
    const options = all.filter(([k]) => k.startsWith(q) && k !== q && !seen.has(k) && seen.add(k)).slice(0, 14)
      .map(([k, snip]) => ({ label: k, detail: snip.includes('|') ? snip.replace('|', '…') : '', apply: snippetApply(snip.includes('|') ? snip : snip, from) }));
    return options.length ? { from, options, filter: false } : null;
  }
  return null;
}
function snippetApply(snip, from) {
  return (view, c, f, t) => {
    const k = snip.indexOf('|'); const ins = snip.replace('|', '');
    view.dispatch({ changes: { from, to: t, insert: ins }, selection: { anchor: from + (k >= 0 ? k : ins.length) } });
  };
}

/* ---------- commands ---------- */
function lpWrap(before, after = before) {
  return (view) => {
    const tr = view.state.changeByRange((r) => {
      const t = view.state.sliceDoc(r.from, r.to);
      return { changes: { from: r.from, to: r.to, insert: before + t + after }, range: EditorSelection.range(r.from + before.length, r.to + before.length) };
    });
    view.dispatch(tr); return true;
  };
}
function lpPremiseEnter(view) {
  const r = view.state.selection.main; if (!r.empty) return false;
  const line = view.state.doc.lineAt(r.head); const before = line.text.slice(0, r.head - line.from);
  const m = /^(P|L)(\d+)([.:)])\s+\S/.exec(before);
  if (!m || r.head !== line.to) return false;
  const ins = '\n' + m[1] + (+m[2] + 1) + m[3] + ' ';
  view.dispatch({ changes: { from: r.head, insert: ins }, selection: { anchor: r.head + ins.length } });
  return true;
}

/* ---------- editor facade ---------- */
const ed = {
  view: null, mode: 'live', states: new Map(), noteId: null, quiet: false,
  modeConf: new Compartment(), spellConf: new Compartment(), baConf: new Compartment(),
  onChange: null,

  baseExtensions() {
    const self = this;
    return [
      cmHistory(), drawSelection(), EditorView.lineWrapping,
      latexSuiteExt(),
      markdown({ base: markdownLanguage, addKeymap: true }),
      syntaxHighlighting(lpHighlight),
      EditorState.languageData.of(() => [{ closeBrackets: { brackets: ['(', '[', '{'] } }]),
      closeBrackets(),
      autocompletion({ override: [lpCompletions], icons: false, activateOnTyping: true, defaultKeymap: true, maxRenderedOptions: 30 }),
      indentUnit.of('  '),
      focusField,
      EditorView.focusChangeEffect.of((state, focusing) => focusEffect.of(focusing)),
      placeholder('Write. Type [[ to link a note, $ for mathematics, ::: for a theorem block.'),
      Prec.high(keymap.of([
        { key: 'Tab', run: (v) => acceptCompletion(v) || indentMore(v), shift: indentLess },
        { key: 'Enter', run: lpPremiseEnter },
        { key: 'Mod-b', run: lpWrap('**') }, { key: 'Mod-i', run: lpWrap('*') }, { key: 'Mod-m', run: lpWrap('$') },
        { key: 'Mod-Shift-m', run: lpWrap('$$\n', '\n$$') }, { key: 'Mod-Shift-l', run: lpWrap('[[', ']]') },
        { key: 'Mod-Shift-d', run: lpWrap('{{c1::', '}}') }, { key: 'Mod-Shift-h', run: lpWrap('==') },
      ])),
      keymap.of([...closeBracketsKeymap, ...completionKeymap, ...searchKeymap, ...historyKeymap, ...defaultKeymap]),
      this.modeConf.of(this.mode === 'live' ? livePreviewExt(() => cur()) : []),
      this.baConf.of(this.anchorExt()),
      this.spellConf.of(EditorView.contentAttributes.of({ spellcheck: String(app.settings.spellcheck !== false), autocorrect: 'off', autocapitalize: 'sentences' })),
      EditorView.updateListener.of((u) => { if (u.docChanged && !self.quiet && self.onChange) self.onChange(u); }),
      EditorView.domEventHandlers({
        mousedown(e, view) { return lpMouseDown(e, view); },
        paste(e, view) { return lpPaste(e, view); },
        drop(e, view) { return lpDrop(e, view); },
      }),
    ];
  },
  init(parent, onChange) {
    this.onChange = onChange;
    this.view = new EditorView({ state: EditorState.create({ doc: '', extensions: this.baseExtensions() }), parent });
  },
  load(noteId, text, sel) {
    if (this.noteId && this.view) this.states.set(this.noteId, this.view.state);
    this.noteId = noteId;
    let st = this.states.get(noteId);
    if (!st || st.doc.toString() !== text || st.__mode !== this.mode) {
      st = EditorState.create({ doc: text, extensions: this.baseExtensions(), selection: sel ? EditorSelection.single(Math.min(sel, text.length)) : undefined });
      st.__mode = this.mode;
    }
    this.quiet = true; this.view.setState(st); this.quiet = false;
  },
  forget(noteId) { this.states.delete(noteId); },
  getText() { return this.view.state.doc.toString(); },
  setText(text) {
    const old = this.getText(); if (old === text) return;
    let a = 0; while (a < old.length && a < text.length && old[a] === text[a]) a++;
    let b = 0; while (b < old.length - a && b < text.length - a && old[old.length - 1 - b] === text[text.length - 1 - b]) b++;
    this.quiet = true;
    this.view.dispatch({ changes: { from: a, to: old.length - b, insert: text.slice(a, text.length - b) } });
    this.quiet = false;
  },
  selection() { const r = this.view.state.selection.main; return { from: r.from, to: r.to }; },
  setSelection(a, b = a) { this.view.dispatch({ selection: EditorSelection.single(a, b), scrollIntoView: true }); },
  replaceRange(from, to, text, selFrom, selTo) {
    const s = selFrom == null ? from + text.length : selFrom;
    this.view.dispatch({ changes: { from, to, insert: text }, selection: EditorSelection.single(s, selTo == null ? s : selTo), scrollIntoView: true });
    this.view.focus();
  },
  insertAtCursor(text) { const r = this.selection(); this.replaceRange(r.from, r.to, text); },
  focus() { this.view.focus(); },
  hasFocus() { return this.view.hasFocus; },
  scrollTop() { return this.view.scrollDOM.scrollTop; },
  setScrollTop(t) { this.view.scrollDOM.scrollTop = t; },
  setMode(mode) {
    this.mode = mode; this.states.clear();
    this.view.dispatch({ effects: [this.modeConf.reconfigure(mode === 'live' ? livePreviewExt(() => cur()) : []), this.baConf.reconfigure(this.anchorExt())] });
    if (this.view.state) this.view.state.__mode = mode;
  },
  anchorExt() { return app.settings.boldAnchors && this.mode === 'live' ? boldAnchorExt() : []; },
  setAnchors() { this.states.clear(); if (this.view) this.view.dispatch({ effects: this.baConf.reconfigure(this.anchorExt()) }); },
  setSpellcheck(on) { this.view.dispatch({ effects: this.spellConf.reconfigure(EditorView.contentAttributes.of({ spellcheck: String(on), autocorrect: 'off', autocapitalize: 'sentences' })) }); },
  refresh() { this.view.dispatch({ effects: refreshEffect.of(null) }); },
};

const lpHighlight = HighlightStyle.define([
  { tag: T.heading, class: 'cm-tok-heading' },
  { tag: T.emphasis, fontStyle: 'italic' },
  { tag: T.strong, class: 'cm-tok-strong' },
  { tag: T.strikethrough, textDecoration: 'line-through' },
  { tag: T.monospace, class: 'cm-tok-mono' },
  { tag: [T.link, T.url], class: 'cm-tok-link' },
  { tag: T.quote, class: 'cm-tok-quote' },
  { tag: [T.processingInstruction, T.contentSeparator, T.meta], class: 'cm-tok-meta' },
]);

function lpMouseDown(e, view) {
  if (e.button !== 0) return false;
  const t = e.target;
  const a = t.closest && t.closest('a.wl, a.cite-ref, a.att');
  if (a && !e.altKey) {
    e.preventDefault();
    if (a.dataset.att) openAttachment(a.dataset.att, +a.dataset.page || 0);
    else if (a.dataset.id) openWithKeys(e, a.dataset.id, { heading: a.dataset.heading, block: a.dataset.block });
    else if (a.dataset.target) createFromBroken(a.dataset.target);
    else if (a.dataset.cite) newNoteDialog({ title: a.dataset.cite, type: 'literature', citekey: a.dataset.cite });
    return true;
  }
  const tag = t.closest && t.closest('.cm-lp-tag');
  if (tag && (e.ctrlKey || e.metaKey)) { e.preventDefault(); filterByTag(tag.dataset.tag); return true; }
  const md = t.closest && t.closest('.cm-lp-mdlink');
  if (md && (e.ctrlKey || e.metaKey) && md.dataset.href) {
    e.preventDefault();
    const href = md.dataset.href;
    if (/^(?:[a-z][\w+.-]*:|\/\/)/i.test(href)) { window.open(href, '_blank', 'noopener'); return true; }
    let path = href; try { path = decodeURIComponent(href); } catch (err) { /* keep */ }
    const p0 = path.split('#')[0];
    if (NOTE_EXT.test(p0)) { const id = resolveTarget(p0.split('/').pop().replace(NOTE_EXT, '')); if (id) openNote(id); return true; }
    const f = findAsset(p0, cur()); if (f) openAttachment(f.name); else toast('No file at ' + p0);
    return true;
  }
  return false;
}
/* Pasting or dropping a file saves it as an attachment (Settings, Data, Attachments says where)
   and inserts a link: ![[name]] for images, PDFs, audio and video, [[name]] for other files.
   Markdown, ZIP, JSON and BibTeX files dropped here are imported as notes instead. */
const LP_IMPORT_EXT = /\.(md|markdown|zip|json|bib)$/i;
function lpFiles(list) { return Array.from(list || []).filter((f) => f && !LP_IMPORT_EXT.test(f.name || '')); }
function lpPaste(e, view) {
  const items = Array.from((e.clipboardData && e.clipboardData.items) || []);
  const files = lpFiles(items.filter((i) => i.kind === 'file').map((i) => i.getAsFile()));
  if (!files.length) return false;
  e.preventDefault();
  const note = cur();
  Promise.all(files.map((f) => saveAsset(f, f.type.startsWith('image/') && /^image\.\w+$/i.test(f.name || '') ? 'pasted' : (f.name || 'pasted'), note)))
    .then((names) => ed.insertAtCursor(names.map(attachmentLink).join('\n')));
  return true;
}
function lpDrop(e, view) {
  const all = Array.from((e.dataTransfer && e.dataTransfer.files) || []);
  const files = lpFiles(all);
  if (!files.length || files.length !== all.length) return false;
  e.preventDefault(); e.stopPropagation();
  const pos = view.posAtCoords({ x: e.clientX, y: e.clientY });
  const note = cur();
  Promise.all(files.map((f) => saveAsset(f, f.name, note))).then((names) => {
    const ins = names.map(attachmentLink).join('\n');
    if (pos != null) ed.replaceRange(pos, pos, ins); else ed.insertAtCursor(ins);
  });
  return true;
}
