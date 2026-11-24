/* ---------- LaTeX Suite compatibility ----------
   Snippets in the format of Obsidian LaTeX Suite (https://github.com/artisticat1/obsidian-latex-suite),
   with its tabstops, auto-fraction, tabout, matrix shortcuts, auto-enlarged brackets and auto-delete of $.
   Options: t text, m math, M display math, n inline math, A automatic, r regex, w word boundary, v visual.
   Tabstops: $0, $1, … and ${0:text}; the same number in two places makes linked cursors. */

const LS_MACROS_BUILTIN = __KATEX_MACROS__;
const LS_WORD_DELIMITERS = '., +-\n\t:;!?\\/{}[]()=~$\'"|`<>*^%#@&';
const LS_CLOSING = [')', ']', '\\rbrack', '\\}', '\\rbrace', '\\rangle', '\\rvert', '\\rVert', '\\rfloor', '\\rceil', '\\urcorner', '}'];
const LS_MATRIX_ENVS = ['pmatrix', 'cases', 'align', 'gather', 'bmatrix', 'Bmatrix', 'vmatrix', 'Vmatrix', 'array', 'matrix', 'aligned', 'align*', 'gather*', 'gathered', 'split', 'alignat', 'alignat*', 'smallmatrix', 'rcases', 'dcases'];
const LS_ENLARGE = ['sum', 'int', 'frac', 'prod', 'bigcup', 'bigcap'];
const LS_TEXT_MACROS = ['text', 'textrm', 'textit', 'textbf', 'textsf', 'texttt', 'textup', 'textnormal', 'mbox', 'intertext'];
const LS_ESC = ''; // stands for a literal $ inside captured text while tabstops are parsed

let lsMacroCache = { key: null, list: [] };
function lsAllMacros() {
  const key = (typeof app !== 'undefined' && app.settings && app.settings.macros) || '';
  if (lsMacroCache.key !== key) {
    const own = Array.from(new Set((key.match(/\\[A-Za-z]+/g) || [])));
    lsMacroCache = { key, list: LS_MACROS_BUILTIN.concat(own, ['\\ce', '\\pu']) };
  }
  return lsMacroCache.list;
}

function lsSetting(k) {
  const s = (typeof app !== 'undefined' && app.settings) || {};
  return s[k] === undefined ? (typeof DEFAULT_SETTINGS !== 'undefined' ? DEFAULT_SETTINGS[k] : true) : s[k];
}

/* "dm": display math on its own lines. */
function lsDisplayMath(match, { state, range }) {
  const line = state.doc.lineAt(range.to);
  const before = line.text.slice(0, range.from - line.from);
  const after = line.text.slice(range.to - line.from);
  if (/\S/.test(after)) return false;
  if (/^[\s>]*$/.test(before)) return '$$\n$0\n$$';
  return '\n$$\n$0\n$$';
}

/* ---------- parsing a LaTeX Suite snippet file (a JavaScript array literal) ---------- */
function lsParseSource(src) {
  let s = String(src || '').replace(/\r\n?/g, '\n');
  const fence = /```[a-z]*\n([\s\S]*?)```/i.exec(s); if (fence) s = fence[1];
  let i = 0; const n = s.length; const errors = [];
  const fail = (msg) => { throw new Error(msg + ' (at character ' + i + ')'); };
  const ws = () => {
    for (;;) {
      while (i < n && /\s/.test(s[i])) i++;
      if (s.startsWith('//', i)) { const j = s.indexOf('\n', i); i = j < 0 ? n : j; continue; }
      if (s.startsWith('/*', i)) { const j = s.indexOf('*/', i + 2); i = j < 0 ? n : j + 2; continue; }
      break;
    }
  };
  const str = () => {
    const q = s[i++]; let out = '';
    while (i < n && s[i] !== q) {
      let c = s[i++];
      if (c === '\\') {
        const e = s[i++];
        if (e === 'n') c = '\n'; else if (e === 't') c = '\t'; else if (e === 'r') c = '\r'; else if (e === 'b') c = '\b'; else if (e === 'f') c = '\f'; else if (e === 'v') c = '\v'; else if (e === '0') c = '\0';
        else if (e === 'u') { if (s[i] === '{') { const j = s.indexOf('}', i); c = String.fromCodePoint(parseInt(s.slice(i + 1, j), 16)); i = j + 1; } else { c = String.fromCharCode(parseInt(s.substr(i, 4), 16)); i += 4; } }
        else if (e === 'x') { c = String.fromCharCode(parseInt(s.substr(i, 2), 16)); i += 2; }
        else if (e === '\n') c = '';
        else c = e;
      }
      out += c;
    }
    if (s[i] !== q) fail('Unclosed string');
    i++; return out;
  };
  const regex = () => {
    let j = i + 1; let cls = false;
    while (j < n) { const c = s[j]; if (c === '\\') { j += 2; continue; } if (c === '[') cls = true; else if (c === ']') cls = false; else if (c === '/' && !cls) break; else if (c === '\n') fail('Unclosed regular expression'); j++; }
    const body = s.slice(i + 1, j); j++;
    const fm = /^[a-z]*/.exec(s.slice(j))[0]; i = j + fm.length;
    return new RegExp(body, fm);
  };
  const skipBalanced = () => { // from an opening bracket to its partner, over strings, comments, regex and template literals
    const open = s[i]; const close = { '{': '}', '(': ')', '[': ']' }[open]; let depth = 0;
    while (i < n) {
      const c = s[i];
      if (c === '"' || c === "'" || c === '`') { const q = c; i++; while (i < n && s[i] !== q) { if (s[i] === '\\') i++; i++; } i++; continue; }
      if (s.startsWith('//', i)) { const j = s.indexOf('\n', i); i = j < 0 ? n : j; continue; }
      if (s.startsWith('/*', i)) { const j = s.indexOf('*/', i + 2); i = j < 0 ? n : j + 2; continue; }
      if (c === open) depth++;
      else if (c === close) { depth--; if (!depth) { i++; return; } }
      i++;
    }
    fail('Unbalanced brackets');
  };
  const fn = (start) => { // capture the source of a function and build it with new Function
    if (s.startsWith('function', i) || s.startsWith('async', i)) { while (i < n && s[i] !== '(') i++; skipBalanced(); ws(); skipBalanced(); }
    else {
      if (s[i] === '(') skipBalanced(); else while (i < n && /[\w$]/.test(s[i])) i++;
      ws(); if (!s.startsWith('=>', i)) fail('Expected =>'); i += 2; ws();
      if (s[i] === '{') skipBalanced();
      else { // expression body: up to a comma or closing bracket at depth 0
        let depth = 0;
        while (i < n) {
          const c = s[i];
          if (c === '"' || c === "'" || c === '`') { const q = c; i++; while (i < n && s[i] !== q) { if (s[i] === '\\') i++; i++; } i++; continue; }
          if ('([{'.includes(c)) depth++;
          else if (')]}'.includes(c)) { if (!depth) break; depth--; }
          else if (c === ',' && !depth) break;
          i++;
        }
      }
    }
    const code = s.slice(start, i);
    try { return new Function('require', 'return (' + code + ');')(lsRequire); }
    catch (e) { errors.push('A function snippet could not be loaded: ' + (e && e.message || e)); return null; }
  };
  const value = () => {
    ws(); const c = s[i];
    if (c === '[') { i++; const arr = []; for (;;) { ws(); if (s[i] === ']') { i++; return arr; } arr.push(value()); ws(); if (s[i] === ',') i++; else if (s[i] !== ']') fail('Expected , or ]'); } }
    if (c === '{') {
      i++; const obj = {};
      for (;;) {
        ws(); if (s[i] === '}') { i++; return obj; }
        let key;
        if (s[i] === '"' || s[i] === "'") key = str(); else { const m = /^[A-Za-z_$][\w$]*/.exec(s.slice(i)); if (!m) fail('Expected a key'); key = m[0]; i += key.length; }
        ws();
        if (s[i] === '(') { const st = i - key.length; skipBalanced(); ws(); const b0 = i; skipBalanced(); const code = 'function ' + s.slice(st, b0).replace(/^\s*/, '') + s.slice(b0, i); try { obj[key] = new Function('require', 'return (' + code + ');')(lsRequire); } catch (e) { errors.push('A function snippet could not be loaded: ' + e.message); obj[key] = null; } }
        else { if (s[i] !== ':') fail('Expected :'); i++; obj[key] = value(); }
        ws(); if (s[i] === ',') i++; else if (s[i] !== '}') fail('Expected , or }');
      }
    }
    if (c === '"' || c === "'" || c === '`') return str();
    if (c === '/') return regex();
    const start = i;
    if (s.startsWith('function', i) || s.startsWith('async', i)) return fn(start);
    if (c === '(') { // arrow function or parenthesised value
      const save = i; skipBalanced(); ws(); const arrow = s.startsWith('=>', i); i = save;
      if (arrow) return fn(start);
      i++; const v = value(); ws(); if (s[i] === ')') i++; return v;
    }
    const m = /^-?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?/i.exec(s.slice(i));
    if (m) { i += m[0].length; return +m[0]; }
    const id = /^[A-Za-z_$][\w$]*/.exec(s.slice(i));
    if (id) {
      const w = id[0];
      if (w === 'true') { i += 4; return true; } if (w === 'false') { i += 5; return false; }
      if (w === 'null') { i += 4; return null; } if (w === 'undefined') { i += 9; return undefined; }
      const after = s.slice(i + w.length).replace(/^\s*/, '');
      if (after.startsWith('=>')) return fn(start);
      fail('Unknown name ' + w);
    }
    fail('Unexpected character ' + JSON.stringify(c || 'end of text'));
  };
  ws();
  const lead = /^(?:export\s+default|module\.exports\s*=)\s*/.exec(s.slice(i)); if (lead) i += lead[0].length;
  ws();
  if (i >= n) return { value: undefined, errors };
  let v;
  try { v = value(); } catch (e) { errors.push(e.message); }
  return { value: v, errors };
}
const lsRequire = (name) => (name === 'latex-suite' ? { snippetVariables: LS_DEFAULT_VARIABLES, ALL_MACROS: lsAllMacros() } : undefined);

/* ---------- compiling ---------- */
let lsCompiled = { key: null };
function lsSnippets() {
  const key = [lsSetting('lsDefaults'), lsSetting('lsSnippets'), lsSetting('lsVariables')].join('\u0001');
  if (lsCompiled.key === key) return lsCompiled;
  const errors = [];
  let vars = Object.assign({}, LS_DEFAULT_VARIABLES);
  if (String(lsSetting('lsVariables') || '').trim()) {
    const r = lsParseSource(lsSetting('lsVariables')); errors.push(...r.errors.map((e) => 'Variables: ' + e));
    if (r.value && typeof r.value === 'object' && !Array.isArray(r.value)) vars = Object.assign(vars, r.value);
    else if (!r.errors.length) errors.push('Variables: the text is not an object such as { "${NAME}": "a|b" }.');
  }
  let own = [];
  if (String(lsSetting('lsSnippets') || '').trim()) {
    const r = lsParseSource(lsSetting('lsSnippets')); errors.push(...r.errors);
    if (Array.isArray(r.value)) own = r.value; else if (!r.errors.length) errors.push('The snippets are not an array such as [ {trigger: "mk", replacement: "$$0$", options: "tA"} ].');
  }
  const raw = own.concat(lsSetting('lsDefaults') !== false ? LS_DEFAULT_SNIPPETS : []);
  const list = [];
  raw.forEach((sn, k) => {
    try { const c = lsCompile(sn, vars); if (c) list.push(Object.assign(c, { order: k })); }
    catch (e) { errors.push('Snippet ' + JSON.stringify(sn && String(sn.trigger)) + ': ' + e.message); }
  });
  list.sort((a, b) => (b.priority - a.priority) || (b.len - a.len) || (a.order - b.order));
  lsCompiled = { key, list, auto: list.filter((x) => x.auto || x.visual), tab: list.filter((x) => !x.auto && !x.visual), errors };
  return lsCompiled;
}

function lsCompile(sn, vars) {
  if (!sn || typeof sn !== 'object' || sn.trigger === undefined || sn.replacement === undefined || sn.replacement === null) return null;
  const o = String(sn.options || '');
  const modes = { t: o.includes('t'), m: o.includes('m'), M: o.includes('M'), n: o.includes('n') };
  if (!modes.t && !modes.m && !modes.M && !modes.n) { modes.t = true; modes.m = true; }
  const isRe = sn.trigger instanceof RegExp || o.includes('r');
  const sub = (src) => { for (const [k, v] of Object.entries(vars)) src = src.split(k).join(v); return src; };
  let trigger = sn.trigger; let len;
  if (o.includes('v')) { trigger = String(trigger); len = trigger.length; }
  else if (isRe) {
    const source = sub(trigger instanceof RegExp ? trigger.source : String(trigger));
    const flags = (trigger instanceof RegExp ? trigger.flags : '').replace(/[gy]/g, '');
    trigger = new RegExp('(?:' + source + ')$', flags); len = source.length;
  } else { trigger = String(trigger); len = trigger.length; }
  return { trigger, isRe: isRe && !o.includes('v'), replacement: sn.replacement, modes, auto: o.includes('A'), word: o.includes('w'),
    visual: o.includes('v'), undo: !o.includes('U'), priority: +sn.priority || 0, len,
    excludedMacros: sn.excludedMacros || null, excludedEnvironments: sn.excludedEnvironments || null };
}

/* ---------- context: text, inline math or display math ---------- */
const lsDocCache = new WeakMap();
function lsDocInfo(doc) {
  let info = lsDocCache.get(doc);
  if (info) return info;
  const text = doc.toString();
  const fenced = fencedRanges(text);
  const t1 = applyMask(text, fenced.slice());
  const code = fenced.concat(inlineCodeRanges(t1));
  const t = applyMask(t1, inlineCodeRanges(t1));
  const maths = findMath(t).map((m) => {
    let a = 2; let b = 2;
    if (m.env) { a = ('\\begin{' + m.env + '}').length; b = ('\\end{' + m.env + '}').length; }
    else if (t[m.start] === '$' && t[m.start + 1] !== '$') { a = 1; b = 1; }
    let is = m.start + a; let ie = m.end - b;
    if (a === 1) { // "${}x{}$", the padding that the mk snippet adds, is not part of the equation
      const p1 = /^\{\}[ \t]?/.exec(t.slice(is, ie)); if (p1) is += p1[0].length;
      const p2 = /[ \t]?\{\}$/.exec(t.slice(is, ie)); if (p2) ie -= p2[0].length;
    }
    return { outerStart: m.start, outerEnd: m.end, innerStart: is, innerEnd: ie, display: m.display, env: m.env || null };
  });
  info = { text, code, maths };
  lsDocCache.set(doc, info);
  return info;
}

/* Is pos inside the argument of \name{…}? text is the equation source, pos relative to it. */
function lsInsideMacro(text, pos, names) {
  let depth = 0;
  for (let k = pos - 1; k >= 0; k--) {
    const c = text[k];
    if (c === '}' && text[k - 1] !== '\\') depth++;
    else if (c === '{' && text[k - 1] !== '\\') {
      if (depth) { depth--; continue; }
      const m = /\\([A-Za-z]+)\*?\s*$/.exec(text.slice(Math.max(0, k - 40), k));
      if (m && names.includes(m[1])) return true;
    }
  }
  return false;
}
/* Is pos inside open…close, where open ends with a brace, such as "^{" … "}"? */
function lsInsideEnv(text, pos, open, close) {
  let from = text.lastIndexOf(open, pos - 1);
  while (from >= 0) {
    let depth = 0; let k = from + open.length - 1; let end = -1;
    for (; k < text.length; k++) {
      if (text[k] === '\\') { k++; continue; }
      if (text[k] === '{') depth++;
      else if (text[k] === '}' && --depth === 0) { end = k; break; }
    }
    if (close !== '}') end = text.indexOf(close, from + open.length);
    if (end < 0 || end >= pos) return true;
    from = text.lastIndexOf(open, from - 1);
  }
  return false;
}

function lsContext(state, pos) {
  const info = lsDocInfo(state.doc);
  if (info.code.some(([a, b]) => pos > a && pos < b)) return { mode: 'code' };
  const m = info.maths.find((x) => x.innerStart <= pos && pos <= x.innerEnd);
  if (!m) return { mode: 'text' };
  const eq = state.doc.sliceString(m.innerStart, m.innerEnd); const rel = pos - m.innerStart;
  if (lsInsideMacro(eq, rel, LS_TEXT_MACROS)) return { mode: 'text', bounds: m, eq, rel, inText: true };
  return { mode: m.display ? 'M' : 'n', bounds: m, eq, rel };
}
const lsMathMode = (ctx) => ctx.mode === 'M' || ctx.mode === 'n';
function lsModeOk(sn, ctx) {
  if (ctx.mode === 'code') return false;
  if (ctx.mode === 'text') return sn.modes.t;
  if (sn.modes.m) return true;
  return ctx.mode === 'M' ? sn.modes.M : sn.modes.n;
}

/* ---------- tabstops ---------- */
const lsSetStack = StateEffect.define();
function lsInField(inst, sel) { return inst.fields.some((rs) => rs.some((r) => sel.from >= r.from && sel.to <= r.to)); }
const lsStackField = StateField.define({
  create: () => [],
  update(stack, tr) {
    for (const e of tr.effects) if (e.is(lsSetStack)) return e.value;
    if (!stack.length) return stack;
    let st = stack;
    // a change that is not typing (sync, import, undo) ends all snippets
    if (tr.docChanged && !tr.isUserEvent('input') && !tr.isUserEvent('delete')) return [];
    if (tr.docChanged) st = st.map((inst) => ({ fields: inst.fields.map((rs) => rs.map((r) => ({ from: tr.changes.mapPos(r.from, -1), to: tr.changes.mapPos(r.to, 1) }))), at: inst.at }));
    if (tr.selection || tr.docChanged) {
      const sel = tr.state.selection.main;
      while (st.length && !lsInField(st[st.length - 1], sel)) st = st.slice(0, -1);
    }
    return st;
  },
  provide: (f) => EditorView.decorations.from(f, (stack) => {
    const marks = [];
    for (const inst of stack) inst.fields.forEach((rs, k) => { if (k > inst.at) for (const r of rs) if (r.to > r.from) marks.push(Decoration.mark({ class: 'cm-ls-tabstop' }).range(r.from, r.to)); });
    try { return Decoration.set(marks, true); } catch (e) { return Decoration.none; }
  }),
});
const lsFieldSel = (rs) => EditorSelection.create(rs.map((r) => EditorSelection.range(r.from, r.to)));

function lsMoveField(view, dir) {
  let stack = view.state.field(lsStackField, false);
  if (!stack || !stack.length) return false;
  stack = stack.slice();
  while (stack.length) {
    const top = stack[stack.length - 1]; const next = top.at + dir;
    if (next < 0) return false;
    if (next < top.fields.length) {
      const last = next === top.fields.length - 1;
      const nst = last ? stack.slice(0, -1) : stack.slice(0, -1).concat([{ fields: top.fields, at: next }]);
      view.dispatch({ selection: lsFieldSel(top.fields[next]), effects: lsSetStack.of(nst), scrollIntoView: true });
      return true;
    }
    stack.pop();
  }
  view.dispatch({ effects: lsSetStack.of([]) });
  return false;
}

/* Template to text and fields. Literal $ in captures is LS_ESC. */
function lsTemplate(tpl) {
  const re = /\$(\d+)|\$\{(\d+)(?::((?:[^{}]|\{(?:[^{}]|\{[^{}]*\})*\})*))?\}/g;
  let out = ''; let last = 0; const fields = new Map(); let m;
  while ((m = re.exec(tpl))) {
    out += tpl.slice(last, m.index);
    const idx = +(m[1] !== undefined ? m[1] : m[2]); const def = m[3] || '';
    const from = out.length; out += def;
    if (!fields.has(idx)) fields.set(idx, []);
    fields.get(idx).push({ from, to: out.length });
    last = m.index + m[0].length;
  }
  out += tpl.slice(last);
  const order = Array.from(fields.keys()).sort((a, b) => a - b);
  return { text: out.split(LS_ESC).join('$'), fields: order.map((k) => fields.get(k)) };
}

/* The prefix that continues a quotation, callout or list on new lines. */
function lsLinePrefix(state, pos) {
  const t = state.doc.lineAt(pos).text;
  const q = /^((?:\s*>)*\s*)/.exec(t)[1];
  const li = /^((?:\s*>)*\s*)([-*+]|\d+[.)])(\s+)/.exec(t);
  return li ? li[1] + ' '.repeat(li[2].length + li[3].length) : q;
}

/* Replace from…to with a template; key is the typed character, inserted first so that undo restores it. */
function lsExpand(view, from, to, tpl, opt = {}) {
  let st = view.state;
  if (opt.key) {
    view.dispatch({ changes: { from: to, insert: opt.key }, selection: { anchor: to + opt.key.length }, userEvent: 'input.type' });
    to += opt.key.length; st = view.state;
  }
  if (typeof tpl === 'string') {
    const pre = lsLinePrefix(st, from);
    if (pre) tpl = tpl.replace(/\n/g, '\n' + pre);
    tpl = lsTemplate(tpl);
  }
  const { text, fields } = tpl;
  if (opt.selectAll && !fields.length) fields.push([{ from: 0, to: text.length }]);
  const abs = fields.map((rs) => rs.map((r) => ({ from: from + r.from, to: from + r.to })));
  const spec = { changes: { from, to, insert: text }, userEvent: 'input.snippet', scrollIntoView: true };
  const stack = st.field(lsStackField, false) || [];
  if (abs.length) {
    spec.selection = lsFieldSel(abs[0]);
    // map the outer tabstops through this change before pushing the new snippet
    const ch = st.changes({ from, to, insert: text });
    const mapped = stack.map((inst) => ({ fields: inst.fields.map((rs) => rs.map((r) => ({ from: ch.mapPos(r.from, -1), to: ch.mapPos(r.to, 1) }))), at: inst.at }));
    if (abs.length > 1) spec.effects = lsSetStack.of(mapped.concat([{ fields: abs, at: 0 }]));
    else spec.effects = lsSetStack.of(mapped);
  } else spec.selection = { anchor: from + text.length };
  view.dispatch(spec);
  if (lsSetting('lsEnlarge') !== false && LS_ENLARGE.some((w) => text.includes('\\' + w))) lsEnlarge(view);
  return true;
}

/* \sum, \int, \frac … inside ( ), [ ] or \{ \} make the brackets \left … \right. */
function lsEnlarge(view) {
  const pos = view.state.selection.main.head; const ctx = lsContext(view.state, pos);
  if (!lsMathMode(ctx)) return;
  const eq = ctx.eq; const rel = ctx.rel; const base = ctx.bounds.innerStart;
  const pairs = { '(': ')', '[': ']', '\\{': '\\}' };
  // innermost unmatched opening bracket before the cursor
  const stack = [];
  for (let k = 0; k < rel; k++) {
    if (eq.startsWith('\\{', k)) { stack.push({ k, o: '\\{' }); k++; continue; }
    if (eq.startsWith('\\}', k)) { const j = stack.map((x) => x.o).lastIndexOf('\\{'); if (j >= 0) stack.splice(j); k++; continue; }
    if (eq[k] === '\\') { k++; continue; }
    if (eq[k] === '(' || eq[k] === '[') stack.push({ k, o: eq[k] });
    else if (eq[k] === ')' || eq[k] === ']') { const o = eq[k] === ')' ? '(' : '['; const j = stack.map((x) => x.o).lastIndexOf(o); if (j >= 0) stack.splice(j); }
  }
  for (let s = stack.length - 1; s >= 0; s--) {
    const { k, o } = stack[s]; const c = pairs[o];
    if (/\\(left|bigl|Bigl|biggl|Biggl)\s*$/.test(eq.slice(0, k))) return;
    let depth = 0; let end = -1;
    for (let j = k + o.length; j < eq.length; j++) {
      if (eq.startsWith(o, j) && !(o !== '\\{' && eq[j - 1] === '\\')) { depth++; j += o.length - 1; continue; }
      if (eq.startsWith(c, j) && !(c !== '\\}' && eq[j - 1] === '\\')) { if (!depth) { end = j; break; } depth--; j += c.length - 1; }
    }
    if (end < rel) continue;
    if (/\\(right|bigr|Bigr|biggr|Biggr)\s*$/.test(eq.slice(0, end))) return;
    const sp = lsSetting('lsEnlargeSpace') !== false ? ' ' : '';
    view.dispatch({ changes: [{ from: base + k, to: base + k + o.length, insert: '\\left' + o + sp }, { from: base + end, to: base + end + c.length, insert: sp + '\\right' + c }], userEvent: 'input.snippet' });
    return;
  }
}

/* ---------- running snippets ---------- */
function lsWordBoundary(state, a, b) {
  const before = a > 0 ? state.doc.sliceString(a - 1, a) : '';
  const after = state.doc.sliceString(b, b + 1);
  return (!before || LS_WORD_DELIMITERS.includes(before)) && (!after || LS_WORD_DELIMITERS.includes(after));
}

/* key: the typed character, or '' for the Tab trigger. Returns true when a snippet ran. */
function lsRun(view, key, list) {
  const st = view.state; const sel = st.selection.main;
  if (st.selection.ranges.length > 1) return false;
  const ctx = lsContext(st, sel.from);
  if (ctx.mode === 'code') return false;
  const base = Math.max(0, sel.to - 1500);
  const line = st.doc.sliceString(base, sel.to) + key;
  const selText = st.sliceDoc(sel.from, sel.to);
  for (const sn of list) {
    if (!lsModeOk(sn, ctx)) continue;
    if (sn.visual !== !sel.empty) continue;
    if (sn.excludedMacros && ctx.eq !== undefined && lsInsideMacro(ctx.eq, ctx.rel, sn.excludedMacros)) continue;
    if (sn.excludedEnvironments && ctx.eq !== undefined && sn.excludedEnvironments.some((p) => Array.isArray(p) && lsInsideEnv(ctx.eq, ctx.rel, p[0], p[1]))) continue;
    let triggerPos; let tpl; let matchText;
    if (sn.visual) {
      if (!line.endsWith(sn.trigger)) continue;
      triggerPos = sel.from;
      const vis = selText.split('$').join(LS_ESC);
      tpl = typeof sn.replacement === 'function' ? sn.replacement(selText, { view, state: st, range: { from: sel.from, to: sel.to } }) : String(sn.replacement);
      if (typeof tpl !== 'string') continue;
      tpl = tpl.split('${VISUAL}').join(vis).split('${VISUAL_ORIGINAL}').join(vis);
      matchText = null;
    } else if (sn.isRe) {
      const m = sn.trigger.exec(line);
      if (!m) continue;
      triggerPos = base + m.index; matchText = m[0];
      if (typeof sn.replacement === 'function') {
        tpl = sn.replacement(m, { view, state: st, range: { from: triggerPos, to: sel.to } });
        if (typeof tpl !== 'string') continue;
      } else tpl = String(sn.replacement).replace(/\[\[(\d+)\]\]/g, (x, k) => (m[+k + 1] || '').split('$').join(LS_ESC));
    } else {
      if (!line.endsWith(sn.trigger)) continue;
      triggerPos = base + line.length - sn.trigger.length; matchText = sn.trigger;
      if (typeof sn.replacement === 'function') {
        tpl = sn.replacement(sn.trigger, { view, state: st, range: { from: triggerPos, to: sel.to } });
        if (typeof tpl !== 'string') continue;
      } else tpl = String(sn.replacement);
    }
    if (sn.word && !lsWordBoundary(st, triggerPos, sel.to)) continue;
    // a replacement equal to the trigger means "type normally" (used while a macro name is being typed)
    if (matchText !== null && tpl === matchText) return false;
    if (ctx.mode === 'n') tpl = tpl.replace(/[ \t]+((?:\$\d+|\$\{\d+(?::[^{}]*)?\})?)$/, '$1');
    if (triggerPos > sel.from) continue;
    const typed = key && sn.undo && !sn.visual ? key : '';
    return lsExpand(view, triggerPos, sel.to, typed ? tpl : tpl, { key: typed, selectAll: sn.visual });
  }
  return false;
}

/* ---------- auto-fraction ---------- */
const LS_FRAC_GREEK = /(alpha|beta|gamma|Gamma|delta|Delta|epsilon|varepsilon|zeta|eta|theta|Theta|iota|kappa|lambda|Lambda|mu|nu|omicron|xi|Xi|pi|Pi|rho|sigma|Sigma|tau|upsilon|Upsilon|varphi|phi|Phi|chi|psi|Psi|omega|Omega) ([^ ])/g;
function lsMatchOpen(s, i) {
  const close = s[i]; const open = { ')': '(', ']': '[', '}': '{' }[close]; let depth = 0;
  for (let k = i; k >= 0; k--) { if (s[k] === close) depth++; else if (s[k] === open && --depth === 0) return k; }
  return null;
}
function lsAutofraction(view) {
  const st = view.state; const sel = st.selection.main; const ctx = lsContext(st, sel.to);
  if (!lsMathMode(ctx)) return false;
  if (lsInsideEnv(ctx.eq, ctx.rel, '^{', '}') || lsInsideEnv(ctx.eq, ctx.rel, '\\pu{', '}')) return false;
  const eqStart = ctx.bounds.innerStart; let start = eqStart;
  if (!sel.empty) start = sel.from;
  else {
    LS_FRAC_GREEK.lastIndex = 0;
    const cur = st.sliceDoc(eqStart, sel.to).replace(LS_FRAC_GREEK, '$1#$2');
    for (let k = cur.length - 1; k >= 0; k--) {
      const c = cur[k];
      if (c === ')' || c === ']' || c === '}') { const j = lsMatchOpen(cur, k); if (j === null) return false; k = j; continue; }
      if (' $([{\n+-=\t'.includes(c)) { start = k + 1 + eqStart; break; }
    }
  }
  if (start === sel.to) return false;
  let num = st.sliceDoc(start, sel.to);
  if (num[0] === '(' && num[num.length - 1] === ')' && lsMatchOpen(num, num.length - 1) === 0) num = num.slice(1, -1);
  const head = '\\frac{'; let tpl;
  if (num === '') tpl = { text: head + '}{}', fields: [[{ from: 6, to: 6 }], [{ from: 8, to: 8 }], [{ from: 9, to: 9 }]] };
  else { const t = head + num + '}{}'; tpl = { text: t, fields: [[{ from: t.length - 1, to: t.length - 1 }], [{ from: t.length, to: t.length }]] }; }
  return lsExpand(view, start, sel.to, tpl, { key: sel.empty ? '/' : '' });
}

/* ---------- tabout ---------- */
function lsTabout(view) {
  const st = view.state; const sel = st.selection.main; if (!sel.empty) return false;
  const ctx = lsContext(st, sel.head); if (!lsMathMode(ctx)) return false;
  const eq = ctx.eq; const b = ctx.bounds;
  for (let k = ctx.rel; k < eq.length; k++) {
    if (eq[k] === '\\') {
      const m = /^\\(?:right|bigr|Bigr|biggr|Biggr)\s*(\\[A-Za-z]+|\\.|.)/.exec(eq.slice(k));
      if (m) { lsCursor(view, b.innerStart + k + m[0].length); return true; }
      const cmd = /^\\(?:[A-Za-z]+|.)/.exec(eq.slice(k))[0];
      if (/^\\(?:left|bigl|Bigl|biggl|Biggl)$/.test(cmd)) { const d = /^\s*(\\[A-Za-z]+|\\.|.)/.exec(eq.slice(k + cmd.length)); k += cmd.length + (d ? d[0].length : 0) - 1; continue; }
      if (LS_CLOSING.includes(cmd)) { lsCursor(view, b.innerStart + k + cmd.length); return true; }
      k += cmd.length - 1; continue;
    }
    if (LS_CLOSING.includes(eq[k])) { lsCursor(view, b.innerStart + k + 1); return true; }
  }
  if (eq.slice(ctx.rel).trim()) return false;
  const multi = st.doc.lineAt(b.innerStart).number !== st.doc.lineAt(b.innerEnd).number;
  if (!multi) { lsCursor(view, b.outerEnd); return true; }
  const endLine = st.doc.lineAt(b.outerEnd);
  if (endLine.number === st.doc.lines) view.dispatch({ changes: { from: endLine.to, insert: '\n' }, selection: { anchor: endLine.to + 1 } });
  else lsCursor(view, st.doc.line(endLine.number + 1).from);
  return true;
}
function lsReverseTabout(view) {
  const st = view.state; const sel = st.selection.main; if (!sel.empty) return false;
  const ctx = lsContext(st, sel.head); if (!lsMathMode(ctx)) return false;
  const eq = ctx.eq; const b = ctx.bounds;
  for (let k = ctx.rel - 1; k >= 0; k--) {
    const c = eq[k];
    if ('([{'.includes(c) && eq[k - 1] !== '\\') { lsCursor(view, b.innerStart + k); return true; }
    const m = /\\(?:left|bigl|Bigl|biggl|Biggl)\s*$/.exec(eq.slice(0, k));
    if (m && k < ctx.rel - 1) { lsCursor(view, b.innerStart + m.index); return true; }
  }
  if (ctx.rel > 0) { lsCursor(view, b.innerStart); return true; }
  lsCursor(view, b.outerStart); return true;
}
function lsCursor(view, pos) { view.dispatch({ selection: { anchor: pos }, scrollIntoView: true }); }

/* ---------- matrix shortcuts ---------- */
function lsEnvAt(eq, rel) {
  const stack = []; const re = /\\(begin|end)\{([^}]*)\}/g; let m;
  while ((m = re.exec(eq)) && m.index < rel) { if (m[1] === 'begin') { if (m.index + m[0].length <= rel) stack.push(m[2]); } else stack.pop(); }
  return stack.length ? stack[stack.length - 1] : null;
}
function lsInMatrix(view) {
  const ctx = lsContext(view.state, view.state.selection.main.head);
  if (!lsMathMode(ctx)) return null;
  const env = lsEnvAt(ctx.eq, ctx.rel) || (ctx.bounds.env && LS_MATRIX_ENVS.includes(ctx.bounds.env) ? ctx.bounds.env : null);
  return env && LS_MATRIX_ENVS.includes(env) ? ctx : null;
}
function lsMatrixCell(view) {
  const ctx = lsInMatrix(view); if (!ctx || !view.state.selection.main.empty) return false;
  if (/^\s*(?:\)|\]|\}|\\\}|\\right|\\rangle|\\rvert|\\rVert)/.test(ctx.eq.slice(ctx.rel))) return lsTabout(view);
  view.dispatch(view.state.replaceSelection(' & '), { userEvent: 'input.type' });
  return true;
}
function lsMatrixNewline(view) {
  const ctx = lsInMatrix(view); if (!ctx) return false;
  const st = view.state; const multi = st.doc.lineAt(ctx.bounds.innerStart).number !== st.doc.lineAt(ctx.bounds.innerEnd).number;
  if (multi) { const pre = lsLinePrefix(st, st.selection.main.head); view.dispatch(st.replaceSelection(' \\\\\n' + pre), { userEvent: 'input.type' }); }
  else view.dispatch(st.replaceSelection(' \\\\ '), { userEvent: 'input.type' });
  return true;
}
function lsMatrixExit(view) {
  const ctx = lsInMatrix(view); if (!ctx) return false;
  const st = view.state; const b = ctx.bounds; const head = st.selection.main.head;
  const after = st.doc.sliceString(head, b.innerEnd); const m = /\\end\{[^}]*\}/.exec(after);
  lsCursor(view, m ? head + m.index + m[0].length : b.outerEnd);
  return true;
}

/* ---------- Backspace in empty inline math ---------- */
function lsAutoDelete(view) {
  if (lsSetting('lsAutoDelete') === false) return false;
  const st = view.state; const sel = st.selection.main; if (!sel.empty) return false;
  const p = sel.head; const around = (a, b) => st.doc.sliceString(Math.max(0, p - a), Math.min(st.doc.length, p + b));
  for (const [l, r] of [['${}', '{}$'], ['${} ', ' {}$'], ['$', '$']]) {
    if (around(l.length, 0) === l && around(0, r.length) === r && st.doc.sliceString(p - l.length - 1, p - l.length) !== '$') {
      view.dispatch({ changes: { from: p - l.length, to: p + r.length }, userEvent: 'delete' });
      return true;
    }
  }
  return false;
}

/* ---------- wiring ---------- */
function lsEnabled() { return lsSetting('lsEnabled') !== false; }
function lsInput(view, from, to, text) {
  if (!lsEnabled() || view.composing || text.length !== 1 || view.state.readOnly) return false;
  const sel = view.state.selection.main;
  if (sel.from !== from || sel.to !== to) return false;
  try {
    const c = lsSnippets();
    if (lsRun(view, text, c.auto)) return true;
    if (text === '/' && lsSetting('lsAutofraction') !== false && lsAutofraction(view)) return true;
    if (')]}'.includes(text) && sel.empty && lsSetting('lsTabout') !== false) {
      const ctx = lsContext(view.state, sel.head);
      if (lsMathMode(ctx) && view.state.doc.sliceString(sel.head, sel.head + 1) === text) { lsCursor(view, sel.head + 1); return true; }
    }
  } catch (e) { console.error('LaTeX Suite snippet error', e); }
  return false;
}
function lsTab(view) {
  if (acceptCompletion(view)) return true;
  if (!lsEnabled()) return false;
  try {
    if (lsRun(view, '', lsSnippets().tab)) return true;
    if (lsMoveField(view, 1)) return true;
    if (lsSetting('lsMatrix') !== false && lsMatrixCell(view)) return true;
    if (lsSetting('lsTabout') !== false && lsTabout(view)) return true;
  } catch (e) { console.error('LaTeX Suite error', e); }
  return false;
}
function lsShiftTab(view) {
  if (!lsEnabled()) return false;
  if (lsMoveField(view, -1)) return true;
  if (lsSetting('lsTabout') !== false && lsReverseTabout(view)) return true;
  return false;
}
function latexSuiteExt() {
  return [
    lsStackField,
    EditorState.allowMultipleSelections.of(true),
    Prec.highest(EditorView.inputHandler.of(lsInput)),
    Prec.highest(keymap.of([
      { key: 'Tab', run: lsTab, shift: lsShiftTab },
      { key: 'Enter', run: (v) => lsEnabled() && lsSetting('lsMatrix') !== false && lsMatrixNewline(v) },
      { key: 'Shift-Enter', run: (v) => lsEnabled() && lsSetting('lsMatrix') !== false && lsMatrixExit(v) },
      { key: 'Backspace', run: (v) => lsEnabled() && lsAutoDelete(v) },
      { key: 'Escape', run: (v) => { const s = v.state.field(lsStackField, false); if (s && s.length) { v.dispatch({ effects: lsSetStack.of([]) }); return true; } return false; } },
    ])),
  ];
}
