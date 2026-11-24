/* Plots from Python: ```python plot (or ```plot, ```matplotlib) code blocks.
   Musubi runs no real Python: that needs a 30 MB download and the network. Instead this file holds a small,
   offline interpreter for the part of Python that plotting code uses (expressions, assignments, def, for,
   if, while, lambda, list comprehensions, f-strings), a part of numpy (np) and of math, and the common
   functions of matplotlib.pyplot (plt) and of Axes. It draws SVG in the Istari pigments, and $…$ in labels
   becomes KaTeX. The interpreter can reach nothing outside its own objects: no files, no network, no DOM. */

const ownProp = (o, k) => (o && Object.prototype.hasOwnProperty.call(o, k) ? o[k] : undefined);
function arrMax(d) { let m = -Infinity; for (const x of d) if (x > m) m = x; return m; }
function pushAll(t, a) { for (let i = 0; i < a.length; i++) t.push(a[i]); }
function arrMin(d) { let m = Infinity; for (const x of d) if (x < m) m = x; return m; }

class PyError extends Error { constructor(msg, line) { super(msg); this.pyLine = line; } }

/* ---------- tokenizer ---------- */
const PY_OPS = ['**=', '//=', '>>=', '<<=', '...', '**', '//', '==', '!=', '<=', '>=', '+=', '-=', '*=', '/=', '%=', '@=', '->', '<<', '>>', '+', '-', '*', '/', '%', '@', '<', '>', '=', '(', ')', '[', ']', '{', '}', ',', ':', '.', ';', '|', '&', '^', '~'];
function pyTokenize(src) {
  const out = []; const indents = [0]; let depth = 0; let i = 0; let line = 1; let atLineStart = true;
  const n = src.length;
  const push = (t, v) => out.push({ t, v, line });
  while (i < n) {
    if (atLineStart && depth === 0) {
      let col = 0; let j = i;
      while (j < n && (src[j] === ' ' || src[j] === '\t')) { col += src[j] === '\t' ? 4 : 1; j++; }
      if (j >= n || src[j] === '\n' || src[j] === '#' || src[j] === '\r') {
        // blank or comment-only line
        while (j < n && src[j] !== '\n') j++;
        i = j + 1; line++; continue;
      }
      if (col > indents[indents.length - 1]) { indents.push(col); push('indent'); }
      while (col < indents[indents.length - 1]) { indents.pop(); push('dedent'); }
      if (col !== indents[indents.length - 1]) throw new PyError('The indentation does not match an outer block', line);
      i = j; atLineStart = false;
    }
    const c = src[i];
    if (c === '\n') { if (depth === 0) { push('nl'); atLineStart = true; } i++; line++; continue; }
    if (c === ' ' || c === '\t' || c === '\r') { i++; continue; }
    if (c === '\\' && src[i + 1] === '\n') { i += 2; line++; continue; }
    if (c === '#') { while (i < n && src[i] !== '\n') i++; continue; }
    const sm = /^([rRfFbBuU]{0,2})('''|"""|'|")/.exec(src.slice(i, i + 5));
    if (sm && (sm[1] === '' || /^[rRfFbBuU]+$/.test(sm[1])) && (sm[1].length || /['"]/.test(c))) {
      const pre = sm[1].toLowerCase(); const q = sm[2]; let j = i + sm[0].length; let s = '';
      const raw = pre.includes('r');
      while (true) {
        if (j >= n) throw new PyError('A string has no closing quote', line);
        if (src.startsWith(q, j)) { j += q.length; break; }
        const ch = src[j];
        if (ch === '\n') { if (q.length === 1) throw new PyError('A string has no closing quote', line); line++; }
        if (ch === '\\' && !raw) {
          const e = src[j + 1]; const map = { n: '\n', t: '\t', r: '\r', '\\': '\\', "'": "'", '"': '"', '0': '\0', '\n': '' };
          if (e in map) { s += map[e]; j += 2; continue; }
          s += ch; j++; continue;
        }
        if (ch === '\\' && raw && (src[j + 1] === q[0])) { s += ch + src[j + 1]; j += 2; continue; }
        s += ch; j++;
      }
      push(pre.includes('f') ? 'fstr' : 'str', s); i = j; continue;
    }
    const nm = /^(?:\d[\d_]*\.?[\d_]*(?:[eE][+-]?\d+)?|\.\d[\d_]*(?:[eE][+-]?\d+)?)j?/.exec(src.slice(i, i + 40));
    if (nm && nm[0]) {
      if (nm[0].endsWith('j')) throw new PyError('Complex numbers are not supported', line);
      push('num', parseFloat(nm[0].replace(/_/g, ''))); i += nm[0].length; continue;
    }
    const id = /^[A-Za-z_\u00C0-\uFFFF][\w\u00C0-\uFFFF]*/.exec(src.slice(i, i + 80));
    if (id) { push('name', id[0]); i += id[0].length; continue; }
    const op = PY_OPS.find((o) => src.startsWith(o, i));
    if (op) {
      if ('([{'.includes(op)) depth++; else if (')]}'.includes(op)) depth = Math.max(0, depth - 1);
      push('op', op); i += op.length; continue;
    }
    throw new PyError(`Unexpected character “${c}”`, line);
  }
  if (out.length && out[out.length - 1].t !== 'nl') push('nl');
  while (indents.length > 1) { indents.pop(); push('dedent'); }
  push('eof');
  return out;
}

/* ---------- parser ---------- */
function pyParse(src) {
  const toks = pyTokenize(src); let p = 0;
  const peek = (k = 0) => toks[p + k];
  const is = (t, v) => { const x = toks[p]; return x.t === t && (v === undefined || x.v === v); };
  const isOp = (v) => is('op', v);
  const isKw = (v) => is('name', v);
  const next = () => toks[p++];
  const expect = (t, v) => { if (!is(t, v)) { const x = toks[p]; throw new PyError(`Expected ${v || t} but found ${x.v != null ? '“' + x.v + '”' : x.t === 'nl' ? 'the end of the line' : x.t}`, x.line); } return next(); };
  const KW = new Set(['if', 'else', 'elif', 'for', 'while', 'in', 'not', 'and', 'or', 'def', 'return', 'lambda', 'import', 'from', 'as', 'pass', 'break', 'continue', 'True', 'False', 'None', 'is', 'global', 'nonlocal', 'del', 'with', 'class', 'try', 'except', 'finally', 'raise', 'yield', 'assert']);

  const block = () => {
    if (!is('nl')) { const s = simpleStmts(); return s; }
    next(); expect('indent'); const body = [];
    while (!is('dedent') && !is('eof')) body.push(...statement());
    if (is('dedent')) next();
    return body;
  };
  const statement = () => {
    const t = peek(); const line = t.line;
    if (t.t === 'name') {
      switch (t.v) {
        case 'def': {
          next(); const name = expect('name').v; expect('op', '('); const params = [];
          while (!isOp(')')) {
            if (isOp('*') || isOp('**')) throw new PyError('*args and **kwargs in a def are not supported', line);
            const pn = expect('name').v; let def = null;
            if (isOp(':')) { next(); expr(); }
            if (isOp('=')) { next(); def = expr(); }
            params.push({ name: pn, def });
            if (!isOp(')')) expect('op', ',');
          }
          next(); if (isOp('->')) { next(); expr(); }
          expect('op', ':');
          return [{ type: 'def', name, params, body: block(), line }];
        }
        case 'if': {
          next(); const test = expr(); expect('op', ':'); const body = block(); let orelse = [];
          if (isKw('elif')) { toks[p] = Object.assign({}, toks[p], { v: 'if' }); orelse = statement(); }
          else if (isKw('else')) { next(); expect('op', ':'); orelse = block(); }
          return [{ type: 'if', test, body, orelse, line }];
        }
        case 'for': {
          next(); const target = targetList(); expect('name', 'in'); const iter = exprList(); expect('op', ':');
          const body = block(); let orelse = [];
          if (isKw('else')) { next(); expect('op', ':'); orelse = block(); }
          return [{ type: 'for', target, iter, body, orelse, line }];
        }
        case 'while': {
          next(); const test = expr(); expect('op', ':'); return [{ type: 'while', test, body: block(), line }];
        }
        case 'with': case 'class': case 'try': case 'yield': case 'async':
          throw new PyError(`“${t.v}” is not supported in plot code`, line);
        default: break;
      }
    }
    return simpleStmts();
  };
  const simpleStmts = () => {
    const out = [small()];
    while (isOp(';')) { next(); if (is('nl')) break; out.push(small()); }
    if (!is('eof')) expect('nl');
    return out;
  };
  const small = () => {
    const t = peek(); const line = t.line;
    if (t.t === 'name') {
      if (t.v === 'pass') { next(); return { type: 'pass', line }; }
      if (t.v === 'break') { next(); return { type: 'break', line }; }
      if (t.v === 'continue') { next(); return { type: 'continue', line }; }
      if (t.v === 'return') { next(); return { type: 'return', value: is('nl') || isOp(';') ? null : exprList(), line }; }
      if (t.v === 'global' || t.v === 'nonlocal') { next(); const names = [expect('name').v]; while (isOp(',')) { next(); names.push(expect('name').v); } return { type: 'global', names, line }; }
      if (t.v === 'assert') { next(); const test = expr(); let msg = null; if (isOp(',')) { next(); msg = expr(); } return { type: 'assert', test, msg, line }; }
      if (t.v === 'del') { next(); exprList(); return { type: 'pass', line }; }
      if (t.v === 'import') {
        next(); const names = [];
        do { if (names.length) next(); let mod = expect('name').v; while (isOp('.')) { next(); mod += '.' + expect('name').v; } let as = null; if (isKw('as')) { next(); as = expect('name').v; } names.push({ mod, as }); } while (isOp(','));
        return { type: 'import', names, line };
      }
      if (t.v === 'from') {
        next(); let mod = expect('name').v; while (isOp('.')) { next(); mod += '.' + expect('name').v; }
        expect('name', 'import'); const names = []; const paren = isOp('(') ? (next(), true) : false;
        if (isOp('*')) { next(); names.push({ name: '*' }); }
        else do { if (names.length) next(); if (paren && isOp(')')) break; const nm = expect('name').v; let as = null; if (isKw('as')) { next(); as = expect('name').v; } names.push({ name: nm, as }); } while (isOp(','));
        if (paren) expect('op', ')');
        return { type: 'from', mod, names, line };
      }
    }
    const e = exprList();
    if (isOp('=')) {
      const targets = [e];
      while (isOp('=')) { next(); targets.push(exprList()); }
      const value = targets.pop();
      for (const tg of targets) checkTarget(tg);
      return { type: 'assign', targets, value, line };
    }
    const aug = ['+=', '-=', '*=', '/=', '//=', '%=', '**=', '@='].find((o) => isOp(o));
    if (aug) { next(); checkTarget(e); return { type: 'aug', target: e, op: aug.slice(0, -1), value: exprList(), line }; }
    return { type: 'expr', value: e, line };
  };
  const checkTarget = (e) => {
    if (e.type === 'name' || e.type === 'sub' || e.type === 'attr') return;
    if (e.type === 'tuple' || e.type === 'list') { e.items.forEach(checkTarget); return; }
    throw new PyError('Cannot assign to this expression', e.line);
  };
  const targetList = () => {
    const line = peek().line; const items = [primary()];
    while (isOp(',')) { next(); if (isKw('in')) break; items.push(primary()); }
    return items.length === 1 ? items[0] : { type: 'tuple', items, line };
  };
  const exprList = () => {
    const line = peek().line; const first = starOrExpr();
    if (!isOp(',')) return first;
    const items = [first];
    while (isOp(',')) { next(); if (is('nl') || isOp('=') || isOp(')') || isOp(';') || is('eof') || isOp(':') || isOp(']')) break; items.push(starOrExpr()); }
    return { type: 'tuple', items, line };
  };
  const starOrExpr = () => { if (isOp('*')) { const line = next().line; return { type: 'star', value: orExpr(), line }; } return expr(); };
  const expr = () => {
    if (isKw('lambda')) {
      const line = next().line; const params = [];
      while (!isOp(':')) { const pn = expect('name').v; let def = null; if (isOp('=')) { next(); def = expr(); } params.push({ name: pn, def }); if (!isOp(':')) expect('op', ','); }
      next();
      return { type: 'lambda', params, body: expr(), line };
    }
    const line = peek().line; const a = orExpr();
    if (isKw('if') && !inComp) {
      next(); const test = orExpr(); expect('name', 'else'); const b = expr();
      return { type: 'ifexp', test, a, b, line };
    }
    return a;
  };
  let inComp = false;
  const orExpr = () => { let a = andExpr(); while (isKw('or')) { const line = next().line; a = { type: 'bool', op: 'or', a, b: andExpr(), line }; } return a; };
  const andExpr = () => { let a = notExpr(); while (isKw('and')) { const line = next().line; a = { type: 'bool', op: 'and', a, b: notExpr(), line }; } return a; };
  const notExpr = () => { if (isKw('not')) { const line = next().line; return { type: 'not', a: notExpr(), line }; } return comparison(); };
  const comparison = () => {
    const line = peek().line; const first = bitor(); const ops = []; const rest = [];
    while (true) {
      let op = null;
      if (['<', '>', '==', '!=', '<=', '>='].some((o) => isOp(o))) op = next().v;
      else if (isKw('in')) { next(); op = 'in'; }
      else if (isKw('not') && peek(1).t === 'name' && peek(1).v === 'in') { next(); next(); op = 'not in'; }
      else if (isKw('is')) { next(); if (isKw('not')) { next(); op = 'is not'; } else op = 'is'; }
      if (!op) break;
      ops.push(op); rest.push(bitor());
    }
    return ops.length ? { type: 'cmp', first, ops, rest, line } : first;
  };
  const bitor = () => { let a = bitand(); while (isOp('|')) { const line = next().line; a = { type: 'bin', op: '|', a, b: bitand(), line }; } return a; };
  const bitand = () => { let a = arith(); while (isOp('&')) { const line = next().line; a = { type: 'bin', op: '&', a, b: arith(), line }; } return a; };
  const arith = () => { let a = term(); while (isOp('+') || isOp('-')) { const t = next(); a = { type: 'bin', op: t.v, a, b: term(), line: t.line }; } return a; };
  const term = () => { let a = unary(); while (['*', '/', '//', '%', '@'].some((o) => isOp(o))) { const t = next(); a = { type: 'bin', op: t.v, a, b: unary(), line: t.line }; } return a; };
  const unary = () => {
    if (isOp('-') || isOp('+') || isOp('~')) { const t = next(); return { type: 'unary', op: t.v, a: unary(), line: t.line }; }
    return power();
  };
  const power = () => {
    const a = primary();
    if (isOp('**')) { const line = next().line; return { type: 'bin', op: '**', a, b: unary(), line }; }
    return a;
  };
  const primary = () => {
    let e = atom();
    while (true) {
      if (isOp('(')) {
        const line = next().line; const args = []; const kwargs = [];
        while (!isOp(')')) {
          if (is('name') && peek(1).t === 'op' && peek(1).v === '=') { const k = next().v; next(); kwargs.push({ k, v: expr() }); }
          else if (isOp('**')) { next(); kwargs.push({ k: null, v: expr() }); }
          else if (isOp('*')) { const l2 = next().line; args.push({ type: 'star', value: expr(), line: l2 }); }
          else {
            const a = expr();
            if (isKw('for')) { args.push(comprehension(a, 'gen', line)); }
            else args.push(a);
          }
          if (!isOp(')')) expect('op', ',');
        }
        next(); e = { type: 'call', fn: e, args, kwargs, line };
      } else if (isOp('[')) {
        const line = next().line; const idx = subscriptList(); expect('op', ']');
        e = { type: 'sub', obj: e, idx, line };
      } else if (isOp('.')) {
        const line = next().line; const nm = expect('name').v;
        if (nm.startsWith('__')) throw new PyError('Names that start with __ are not available', line);
        e = { type: 'attr', obj: e, name: nm, line };
      } else break;
    }
    return e;
  };
  const subscriptList = () => {
    const line = peek().line; const items = [subscript()];
    while (isOp(',')) { next(); if (isOp(']')) break; items.push(subscript()); }
    return items.length === 1 ? items[0] : { type: 'tuple', items, line };
  };
  const subscript = () => {
    const line = peek().line;
    let a = null; let b = null; let c = null;
    if (!isOp(':')) { a = expr(); if (!isOp(':')) return a; }
    next();
    if (!isOp(':') && !isOp(']') && !isOp(',')) b = expr();
    if (isOp(':')) { next(); if (!isOp(']') && !isOp(',')) c = expr(); }
    return { type: 'slice', a, b, c, line };
  };
  const comprehension = (elt, kind, line, valueElt) => {
    const gens = [];
    const save = inComp; inComp = true;
    while (isKw('for')) {
      next(); const target = targetList(); expect('name', 'in'); const iter = orExpr(); const ifs = [];
      while (isKw('if')) { next(); ifs.push(orExpr()); }
      gens.push({ target, iter, ifs });
    }
    inComp = save;
    return { type: 'comp', kind, elt, valueElt, gens, line };
  };
  const atom = () => {
    const t = peek(); const line = t.line;
    if (t.t === 'num') { next(); return { type: 'const', v: t.v, line }; }
    if (t.t === 'str' || t.t === 'fstr') {
      const parts = [];
      while (is('str') || is('fstr')) { const s = next(); parts.push(s.t === 'fstr' ? parseFString(s.v, s.line) : { type: 'const', v: s.v, line: s.line }); }
      return parts.length === 1 ? parts[0] : { type: 'concat', parts, line };
    }
    if (t.t === 'name') {
      if (t.v === 'True') { next(); return { type: 'const', v: true, line }; }
      if (t.v === 'False') { next(); return { type: 'const', v: false, line }; }
      if (t.v === 'None') { next(); return { type: 'const', v: null, line }; }
      if (KW.has(t.v) && !['print'].includes(t.v)) throw new PyError(`Unexpected “${t.v}”`, line);
      next();
      if (t.v.startsWith('__')) throw new PyError('Names that start with __ are not available', line);
      return { type: 'name', id: t.v, line };
    }
    if (isOp('(')) {
      next();
      if (isOp(')')) { next(); return { type: 'tuple', items: [], line }; }
      const first = starOrExpr();
      if (isKw('for')) { const c = comprehension(first, 'gen', line); expect('op', ')'); return c; }
      if (isOp(',')) {
        const items = [first];
        while (isOp(',')) { next(); if (isOp(')')) break; items.push(starOrExpr()); }
        expect('op', ')'); return { type: 'tuple', items, line };
      }
      expect('op', ')'); return first;
    }
    if (isOp('[')) {
      next(); const items = [];
      if (isOp(']')) { next(); return { type: 'list', items, line }; }
      const first = starOrExpr();
      if (isKw('for')) { const c = comprehension(first, 'list', line); expect('op', ']'); return c; }
      items.push(first);
      while (isOp(',')) { next(); if (isOp(']')) break; items.push(starOrExpr()); }
      expect('op', ']'); return { type: 'list', items, line };
    }
    if (isOp('{')) {
      next(); const keys = []; const vals = [];
      if (isOp('}')) { next(); return { type: 'dict', keys, vals, line }; }
      const k0 = expr();
      if (!isOp(':')) {
        const items = [k0];
        if (isKw('for')) { const c = comprehension(k0, 'set', line); expect('op', '}'); return c; }
        while (isOp(',')) { next(); if (isOp('}')) break; items.push(expr()); }
        expect('op', '}'); return { type: 'list', items, line, set: true };
      }
      next(); const v0 = expr();
      if (isKw('for')) { const c = comprehension(k0, 'dict', line, v0); expect('op', '}'); return c; }
      keys.push(k0); vals.push(v0);
      while (isOp(',')) { next(); if (isOp('}')) break; keys.push(expr()); expect('op', ':'); vals.push(expr()); }
      expect('op', '}'); return { type: 'dict', keys, vals, line };
    }
    if (t.t === 'nl' || t.t === 'eof') throw new PyError('The line ends too early', line);
    throw new PyError(`Unexpected “${t.v != null ? t.v : t.t}”`, line);
  };
  const parseFString = (s, line) => {
    const parts = []; let i = 0; let buf = '';
    while (i < s.length) {
      const c = s[i];
      if (c === '{' && s[i + 1] === '{') { buf += '{'; i += 2; continue; }
      if (c === '}' && s[i + 1] === '}') { buf += '}'; i += 2; continue; }
      if (c === '{') {
        if (buf) { parts.push({ type: 'const', v: buf, line }); buf = ''; }
        let depth = 1; let j = i + 1; let inner = '';
        while (j < s.length && depth) { if (s[j] === '{') depth++; else if (s[j] === '}') { depth--; if (!depth) break; } inner += s[j]; j++; }
        let spec = ''; let conv = '';
        const cm = /^(.*?)(?:!([rsa]))?(?::([^:]*))?$/s.exec(inner);
        let exprSrc = inner;
        // a format spec after the last top-level colon
        { let d = 0; for (let k = 0; k < inner.length; k++) { const ch = inner[k]; if ('([{'.includes(ch)) d++; else if (')]}'.includes(ch)) d--; else if (ch === ':' && d === 0) { exprSrc = inner.slice(0, k); spec = inner.slice(k + 1); break; } } }
        if (/!([rsa])$/.test(exprSrc)) { conv = exprSrc.slice(-1); exprSrc = exprSrc.slice(0, -2); }
        void cm; void conv;
        const eqDebug = /=\s*$/.test(exprSrc) && !/[=!<>]=\s*$/.test(exprSrc);
        if (eqDebug) { parts.push({ type: 'const', v: exprSrc, line }); exprSrc = exprSrc.replace(/=\s*$/, ''); }
        const sub = pyParse(exprSrc.trim() + '\n');
        if (sub.length !== 1 || sub[0].type !== 'expr') throw new PyError('An f-string field must hold one expression', line);
        parts.push({ type: 'fmt', value: sub[0].value, spec, line });
        i = j + 1; continue;
      }
      buf += c; i++;
    }
    if (buf) parts.push({ type: 'const', v: buf, line });
    return { type: 'concat', parts, line };
  };
  const prog = [];
  while (!is('eof')) { if (is('nl')) { next(); continue; } prog.push(...statement()); }
  return prog;
}

/* ---------- values ---------- */
class NDArray {
  constructor(data, shape) { this.data = data instanceof Float64Array ? data : Float64Array.from(data); this.shape = shape || [this.data.length]; this.bool = false; }
  get size() { return this.data.length; }
  get ndim() { return this.shape.length; }
}
const isArr = (v) => v instanceof NDArray;
const isList = (v) => Array.isArray(v);
const mkTuple = (arr) => { Object.defineProperty(arr, '__tuple', { value: true }); return arr; };
const isTuple = (v) => Array.isArray(v) && v.__tuple === true;
const PY_LIMIT = { steps: 3e6, size: 2e6 };
const NONE = null;

function pyType(v) {
  if (v === null || v === undefined) return 'NoneType';
  if (typeof v === 'boolean') return 'bool';
  if (typeof v === 'number') return Number.isInteger(v) ? 'int' : 'float';
  if (typeof v === 'string') return 'str';
  if (isArr(v)) return 'ndarray';
  if (isTuple(v)) return 'tuple';
  if (isList(v)) return 'list';
  if (v instanceof Map) return 'dict';
  if (typeof v === 'function' || (v && v.__pyfn)) return 'function';
  return (v && v.__kind) || 'object';
}

function pyRepr(v, top = true) {
  if (v === null || v === undefined) return 'None';
  if (v === true) return 'True'; if (v === false) return 'False';
  if (typeof v === 'number') { if (Number.isNaN(v)) return 'nan'; if (!Number.isFinite(v)) return v > 0 ? 'inf' : '-inf'; return Number.isInteger(v) ? String(v) : String(+v.toPrecision(12)); }
  if (typeof v === 'string') return top ? v : `'${v}'`;
  if (isArr(v)) return '[' + Array.from(v.data.slice(0, 12), (x) => pyRepr(v.bool ? !!x : x, false)).join(' ') + (v.size > 12 ? ' …' : '') + ']';
  if (isTuple(v)) return '(' + v.map((x) => pyRepr(x, false)).join(', ') + (v.length === 1 ? ',' : '') + ')';
  if (isList(v)) return '[' + v.map((x) => pyRepr(x, false)).join(', ') + ']';
  if (v instanceof Map) return '{' + Array.from(v, ([k, x]) => pyRepr(k, false) + ': ' + pyRepr(x, false)).join(', ') + '}';
  return '<' + pyType(v) + '>';
}

function truthy(v, line) {
  if (v === null || v === undefined || v === false) return false;
  if (typeof v === 'number') return v !== 0;
  if (typeof v === 'string' || isList(v)) return v.length > 0;
  if (v instanceof Map) return v.size > 0;
  if (isArr(v)) { if (v.size === 1) return v.data[0] !== 0; throw new PyError('The truth value of an array with more than one element is ambiguous. Use a.any() or a.all()', line); }
  return true;
}

function toArr(v, line) {
  if (isArr(v)) return v;
  if (typeof v === 'number' || typeof v === 'boolean') return new NDArray([+v]);
  if (isList(v)) {
    if (v.length && (isList(v[0]) || isArr(v[0]))) {
      const rows = v.map((r) => toArr(r, line)); const m = rows[0].size;
      if (rows.some((r) => r.size !== m)) throw new PyError('Rows of different length cannot make an array', line);
      const d = new Float64Array(rows.length * m); rows.forEach((r, i) => d.set(r.data, i * m));
      return new NDArray(d, [rows.length, m]);
    }
    const a = new NDArray(v.map((x) => { if (typeof x === 'number' || typeof x === 'boolean') return +x; if (x === null) return NaN; throw new PyError('An array can hold only numbers', line); }));
    if (v.length && v.every((x) => typeof x === 'boolean')) a.bool = true;
    return a;
  }
  throw new PyError(`Cannot make an array from ${pyType(v)}`, line);
}
const numOrArr = (v) => typeof v === 'number' || typeof v === 'boolean' || isArr(v) || isList(v);

function elementwise(a, b, f, line, bool) {
  const A = toArr(a, line); const B = toArr(b, line);
  let shape;
  if (A.size === 1) shape = B.shape; else if (B.size === 1) shape = A.shape;
  else if (A.size === B.size) shape = A.shape;
  else if (A.ndim === 2 && B.ndim === 1 && A.shape[1] === B.size) shape = A.shape;
  else if (B.ndim === 2 && A.ndim === 1 && B.shape[1] === A.size) shape = B.shape;
  else throw new PyError(`Arrays of shapes (${A.shape.join(',')}) and (${B.shape.join(',')}) do not match`, line);
  const n = shape.reduce((x, y) => x * y, 1); const out = new Float64Array(n);
  const ga = A.size === 1 ? () => A.data[0] : A.size === n ? (i) => A.data[i] : (i) => A.data[i % A.size];
  const gb = B.size === 1 ? () => B.data[0] : B.size === n ? (i) => B.data[i] : (i) => B.data[i % B.size];
  for (let i = 0; i < n; i++) out[i] = f(ga(i), gb(i));
  const r = new NDArray(out, shape.slice()); r.bool = !!bool; return r;
}
function mapArr(a, f, line) { const A = toArr(a, line); const out = new Float64Array(A.size); for (let i = 0; i < A.size; i++) out[i] = f(A.data[i]); return new NDArray(out, A.shape.slice()); }

const pyMod = (a, b) => { const r = a % b; return r !== 0 && (r < 0) !== (b < 0) ? r + b : r; };
const NUM_OPS = {
  '+': (a, b) => a + b, '-': (a, b) => a - b, '*': (a, b) => a * b, '/': (a, b) => a / b,
  '//': (a, b) => Math.floor(a / b), '%': pyMod, '**': (a, b) => a ** b,
  '<': (a, b) => +(a < b), '>': (a, b) => +(a > b), '<=': (a, b) => +(a <= b), '>=': (a, b) => +(a >= b), '==': (a, b) => +(a === b), '!=': (a, b) => +(a !== b),
  '&': (a, b) => +(!!a && !!b), '|': (a, b) => +(!!a || !!b),
};

function binop(op, a, b, line) {
  if (isArr(a) || isArr(b) || ((isList(a) || isList(b)) && (isArr(a) || isArr(b)))) {
    if (op === '@') return dot(a, b, line);
    const f = NUM_OPS[op]; if (!f) throw new PyError(`Operator ${op} does not work on arrays`, line);
    return elementwise(a, b, f, line, ['<', '>', '<=', '>=', '==', '!=', '&', '|'].includes(op));
  }
  if (typeof a === 'boolean') a = +a; if (typeof b === 'boolean') b = +b;
  if (typeof a === 'number' && typeof b === 'number') {
    if ((op === '/' || op === '//' || op === '%') && b === 0) throw new PyError('Division by zero', line);
    const f = NUM_OPS[op]; if (!f) throw new PyError(`Operator ${op} does not work on numbers`, line);
    const r = f(a, b); return ['<', '>', '<=', '>=', '==', '!='].includes(op) ? !!r : r;
  }
  if (op === '+' && typeof a === 'string' && typeof b === 'string') return a + b;
  if (op === '*' && typeof a === 'string' && typeof b === 'number') return a.repeat(Math.max(0, b));
  if (op === '*' && typeof b === 'string' && typeof a === 'number') return b.repeat(Math.max(0, a));
  if (op === '%' && typeof a === 'string') return percentFormat(a, b, line);
  if (op === '+' && isList(a) && isList(b)) { const r = a.concat(b); return isTuple(a) ? mkTuple(r) : r; }
  if (op === '*' && isList(a) && typeof b === 'number') { let r = []; for (let i = 0; i < b; i++) r = r.concat(a); return r; }
  if (op === '==' ) return pyEq(a, b);
  if (op === '!=') return !pyEq(a, b);
  if (['<', '>', '<=', '>='].includes(op) && typeof a === 'string' && typeof b === 'string') return !!NUM_OPS[op](a, b);
  throw new PyError(`Operator ${op} does not work on ${pyType(a)} and ${pyType(b)}`, line);
}
function pyEq(a, b) {
  if (a === b) return true;
  if (isList(a) && isList(b)) return a.length === b.length && a.every((x, i) => pyEq(x, b[i]));
  return false;
}
function dot(a, b, line) {
  const A = toArr(a, line); const B = toArr(b, line);
  if (A.ndim === 1 && B.ndim === 1) { if (A.size !== B.size) throw new PyError('Vectors of different length', line); let s = 0; for (let i = 0; i < A.size; i++) s += A.data[i] * B.data[i]; return s; }
  const [n, m] = A.ndim === 2 ? A.shape : [1, A.size]; const [m2, k] = B.ndim === 2 ? B.shape : [B.size, 1];
  if (m !== m2) throw new PyError('Shapes do not match for @', line);
  const out = new Float64Array(n * k);
  for (let i = 0; i < n; i++) for (let j = 0; j < k; j++) { let s = 0; for (let t = 0; t < m; t++) s += A.data[i * m + t] * B.data[t * k + j]; out[i * k + j] = s; }
  return new NDArray(out, B.ndim === 1 ? [n] : A.ndim === 1 ? [k] : [n, k]);
}

function formatSpec(v, spec, line) {
  if (!spec) return pyRepr(v);
  const m = /^(?:(.)?([<>^=]))?([+\- ])?(#)?(0)?(\d+)?([,_])?(?:\.(\d+))?([bcdeEfFgGnosxX%])?$/.exec(spec);
  if (!m) throw new PyError(`Unknown format “${spec}”`, line);
  const [, fill = ' ', align, sign, , zero, width, group, prec, type] = m;
  let s;
  if (typeof v === 'number' || typeof v === 'boolean') {
    const x = +v; const p = prec != null ? +prec : null;
    switch (type) {
      case 'f': case 'F': s = x.toFixed(p == null ? 6 : p); break;
      case 'e': case 'E': s = x.toExponential(p == null ? 6 : p).replace(/e([+-])(\d)$/, 'e$10$2'); if (type === 'E') s = s.toUpperCase(); break;
      case '%': s = (x * 100).toFixed(p == null ? 6 : p) + '%'; break;
      case 'd': case 'n': s = String(Math.round(x)); break;
      case 'x': s = Math.round(x).toString(16); break;
      case 'g': case 'G': default: s = p != null ? String(+x.toPrecision(Math.max(1, p))) : pyRepr(x); break;
    }
    if (group) s = s.replace(/^(-?\d+)/, (d) => d.replace(/\B(?=(\d{3})+(?!\d))/g, group));
    if (sign === '+' && x >= 0) s = '+' + s; else if (sign === ' ' && x >= 0) s = ' ' + s;
  } else s = pyRepr(v);
  const w = width ? +width : 0;
  if (s.length < w) {
    const pad = (zero && !align ? '0' : fill).repeat(w - s.length);
    const al = align || (typeof v === 'number' ? '>' : '<');
    s = al === '<' ? s + pad : al === '^' ? pad.slice(0, pad.length >> 1) + s + pad.slice(pad.length >> 1) : (zero && !align && /^[+-]/.test(s) ? s[0] + pad + s.slice(1) : pad + s);
  }
  return s;
}
function percentFormat(fmt, args, line) {
  const list = isTuple(args) ? args.slice() : [args]; let k = 0;
  return fmt.replace(/%([-+ 0#]*)(\d+)?(?:\.(\d+))?([sdifeEgGr%])/g, (m, flags, w, p, t) => {
    if (t === '%') return '%';
    const v = list[k++];
    const spec = (flags.includes('-') ? '<' : '') + (flags.includes('+') ? '+' : '') + (flags.includes('0') ? '0' : '') + (w || '') + (p != null ? '.' + p : '') + (t === 's' || t === 'r' ? '' : t === 'i' ? 'd' : t);
    return t === 's' || t === 'r' ? formatSpec(pyRepr(v), (flags.includes('-') ? '<' : '') + (w || ''), line) : formatSpec(v, spec, line);
  });
}

/* ---------- interpreter ---------- */
class Scope {
  constructor(parent, globals) { this.vars = new Map(); this.parent = parent; this.globals = globals || this; this.globalNames = new Set(); }
  get(name, line) {
    let s = this;
    while (s) { if (s.vars.has(name)) return s.vars.get(name); s = s.parent; }
    if (PY_BUILTINS.has(name)) return PY_BUILTINS.get(name);
    throw new PyError(`Name “${name}” is not defined` + (name === 'plt' || name === 'np' ? ` (add: import ${name === 'plt' ? 'matplotlib.pyplot as plt' : 'numpy as np'})` : ''), line);
  }
  set(name, v) { if (this.globalNames.has(name)) this.globals.vars.set(name, v); else this.vars.set(name, v); }
}
const BREAK = { brk: 1 }; const CONTINUE = { cont: 1 };
class ReturnSignal { constructor(v) { this.v = v; } }

function pyRun(src, ctx) {
  const prog = pyParse(src);
  const g = new Scope(null); g.globals = g;
  ctx.steps = 0;
  const tick = (line) => { if (++ctx.steps > PY_LIMIT.steps) throw new PyError('The code runs too long (more than 3 million steps)', line); };

  const iterate = (v, line) => {
    if (isList(v)) return v;
    if (typeof v === 'string') return Array.from(v);
    if (isArr(v)) { if (v.ndim === 2) { const [r, c] = v.shape; return Array.from({ length: r }, (_, i) => new NDArray(v.data.slice(i * c, (i + 1) * c))); } return Array.from(v.data); }
    if (v instanceof Map) return Array.from(v.keys());
    if (v && v.__iter) return v.__iter();
    throw new PyError(`Cannot loop over ${pyType(v)}`, line);
  };
  const assign = (target, value, scope) => {
    if (target.type === 'name') { scope.set(target.id, value); return; }
    if (target.type === 'tuple' || target.type === 'list') {
      const vals = iterate(value, target.line);
      const starAt = target.items.findIndex((x) => x.type === 'star');
      if (starAt < 0) {
        if (vals.length !== target.items.length) throw new PyError(`Cannot unpack ${vals.length} values into ${target.items.length} names`, target.line);
        target.items.forEach((t, i) => assign(t, vals[i], scope));
      } else {
        const after = target.items.length - starAt - 1;
        target.items.slice(0, starAt).forEach((t, i) => assign(t, vals[i], scope));
        assign(target.items[starAt].value, vals.slice(starAt, vals.length - after), scope);
        target.items.slice(starAt + 1).forEach((t, i) => assign(t, vals[vals.length - after + i], scope));
      }
      return;
    }
    if (target.type === 'sub') {
      const obj = ev(target.obj, scope); const idx = ev(target.idx, scope);
      setItem(obj, idx, value, target.line); return;
    }
    if (target.type === 'attr') {
      const obj = ev(target.obj, scope);
      if (obj && obj.__setattr) { obj.__setattr(target.name, value); return; }
      throw new PyError('Cannot set this attribute', target.line);
    }
    throw new PyError('Cannot assign here', target.line);
  };
  const callFn = (fn, args, kwargs, line) => {
    if (typeof fn === 'function') { tick(line); return fn(args, kwargs || Object.create(null), line); }
    if (fn && fn.__pyfn) {
      tick(line);
      if (ctx.depth > 200) throw new PyError('Too much recursion', line);
      const s = new Scope(fn.closure, g);
      fn.params.forEach((pp, i) => {
        if (i < args.length) s.vars.set(pp.name, args[i]);
        else if (kwargs && ownProp(kwargs, pp.name) !== undefined) s.vars.set(pp.name, kwargs[pp.name]);
        else if (pp.defVal !== undefined) s.vars.set(pp.name, pp.defVal);
        else throw new PyError(`${fn.name}() needs the argument “${pp.name}”`, line);
      });
      if (args.length > fn.params.length) throw new PyError(`${fn.name}() takes ${fn.params.length} arguments but got ${args.length}`, line);
      ctx.depth = (ctx.depth || 0) + 1;
      try {
        if (fn.lambda) return ev(fn.body, s);
        const r = exec(fn.body, s);
        if (r instanceof ReturnSignal) return r.v;
        return null;
      } finally { ctx.depth--; }
    }
    throw new PyError(`${pyType(fn)} is not callable`, line);
  };
  ctx.call = callFn;
  const exec = (stmts, scope) => {
    for (const st of stmts) {
      tick(st.line);
      const r = execOne(st, scope);
      if (r) return r;
    }
    return null;
  };
  const execOne = (st, scope) => {
    switch (st.type) {
      case 'expr': ev(st.value, scope); return null;
      case 'assign': { const v = ev(st.value, scope); for (const t of st.targets) assign(t, v, scope); return null; }
      case 'aug': {
        const cur = ev(st.target, scope); const v = ev(st.value, scope);
        if (st.op === '+' && isList(cur) && !isTuple(cur) && st.target.type === 'name') { pushAll(cur, iterate(v, st.line)); return null; }
        assign(st.target, binop(st.op, cur, v, st.line), scope); return null;
      }
      case 'pass': case 'global': if (st.type === 'global') st.names.forEach((n) => scope.globalNames.add(n)); return null;
      case 'break': return BREAK;
      case 'continue': return CONTINUE;
      case 'return': return new ReturnSignal(st.value ? ev(st.value, scope) : null);
      case 'assert': if (!truthy(ev(st.test, scope), st.line)) throw new PyError('Assertion failed' + (st.msg ? ': ' + pyRepr(ev(st.msg, scope)) : ''), st.line); return null;
      case 'import': for (const im of st.names) { const mod = pyModule(im.mod, st.line, ctx); scope.set(im.as || im.mod.split('.')[0], im.as ? mod : pyModule(im.mod.split('.')[0], st.line, ctx)); } return null;
      case 'from': {
        const mod = pyModule(st.mod, st.line, ctx);
        for (const nm of st.names) {
          if (nm.name === '*') { for (const k of Object.keys(mod)) if (!k.startsWith('_')) scope.set(k, mod[k]); continue; }
          if (!Object.prototype.hasOwnProperty.call(mod, nm.name)) throw new PyError(`${st.mod} has no “${nm.name}” in Musubi`, st.line);
          scope.set(nm.as || nm.name, mod[nm.name]);
        }
        return null;
      }
      case 'def': {
        const fn = { __pyfn: true, name: st.name, params: st.params.map((pp) => ({ name: pp.name, defVal: pp.def ? ev(pp.def, scope) : undefined })), body: st.body, closure: scope };
        scope.set(st.name, fn); return null;
      }
      case 'if': return truthy(ev(st.test, scope), st.line) ? exec(st.body, scope) : exec(st.orelse, scope);
      case 'while': {
        while (truthy(ev(st.test, scope), st.line)) {
          const r = exec(st.body, scope);
          if (r === BREAK) break; if (r === CONTINUE) continue; if (r) return r;
        }
        return null;
      }
      case 'for': {
        const items = iterate(ev(st.iter, scope), st.line); let broke = false;
        for (const it of items) {
          assign(st.target, it, scope);
          const r = exec(st.body, scope);
          if (r === BREAK) { broke = true; break; } if (r === CONTINUE) continue; if (r) return r;
        }
        if (!broke && st.orelse.length) return exec(st.orelse, scope);
        return null;
      }
      default: throw new PyError('Unknown statement', st.line);
    }
  };
  const evArgs = (list, scope) => {
    const out = [];
    for (const a of list) { if (a.type === 'star') pushAll(out, iterate(ev(a.value, scope), a.line)); else out.push(ev(a, scope)); }
    return out;
  };
  const ev = (e, scope) => {
    switch (e.type) {
      case 'const': return e.v;
      case 'name': return scope.get(e.id, e.line);
      case 'concat': return e.parts.map((x) => { const v = ev(x, scope); return typeof v === 'string' ? v : pyRepr(v); }).join('');
      case 'fmt': return formatSpec(ev(e.value, scope), e.spec, e.line);
      case 'tuple': return mkTuple(evArgs(e.items, scope));
      case 'list': { const v = evArgs(e.items, scope); return e.set ? Array.from(new Set(v)) : v; }
      case 'dict': { const m = new Map(); e.keys.forEach((k, i) => m.set(ev(k, scope), ev(e.vals[i], scope))); return m; }
      case 'star': throw new PyError('* is not allowed here', e.line);
      case 'bool': { const a = ev(e.a, scope); if (e.op === 'and') return truthy(a, e.line) ? ev(e.b, scope) : a; return truthy(a, e.line) ? a : ev(e.b, scope); }
      case 'not': return !truthy(ev(e.a, scope), e.line);
      case 'ifexp': return truthy(ev(e.test, scope), e.line) ? ev(e.a, scope) : ev(e.b, scope);
      case 'unary': {
        const a = ev(e.a, scope);
        if (e.op === '-') return isArr(a) || isList(a) ? mapArr(a, (x) => -x, e.line) : -a;
        if (e.op === '~') return isArr(a) ? Object.assign(mapArr(a, (x) => +!x, e.line), { bool: true }) : ~a;
        return a;
      }
      case 'bin': return binop(e.op, ev(e.a, scope), ev(e.b, scope), e.line);
      case 'cmp': {
        let left = ev(e.first, scope); let result = true;
        for (let i = 0; i < e.ops.length; i++) {
          const right = ev(e.rest[i], scope); const op = e.ops[i]; let r;
          if (op === 'in' || op === 'not in') {
            let has;
            if (typeof right === 'string') has = right.includes(left);
            else if (right instanceof Map) has = right.has(left);
            else if (isArr(right)) has = Array.from(right.data).includes(+left);
            else if (isList(right)) has = right.some((x) => pyEq(x, left));
            else throw new PyError(`“in” does not work on ${pyType(right)}`, e.line);
            r = op === 'in' ? has : !has;
          } else if (op === 'is') r = left === right || (left == null && right == null);
          else if (op === 'is not') r = !(left === right || (left == null && right == null));
          else r = binop(op, left, right, e.line);
          if (isArr(r)) { if (e.ops.length > 1) throw new PyError('Chained comparisons of arrays are not supported', e.line); return r; }
          if (!r) return false;
          result = r; left = right;
        }
        return result;
      }
      case 'call': {
        const fn = ev(e.fn, scope);
        const args = evArgs(e.args, scope); const kw = Object.create(null);
        for (const k of e.kwargs) { if (k.k == null) { const m = ev(k.v, scope); if (m instanceof Map) for (const [a, b] of m) kw[a] = b; } else kw[k.k] = ev(k.v, scope); }
        return callFn(fn, args, kw, e.line);
      }
      case 'attr': return getAttr(ev(e.obj, scope), e.name, e.line, ctx);
      case 'sub': return getItem(ev(e.obj, scope), ev(e.idx, scope), e.line);
      case 'slice': return { __slice: true, a: e.a ? ev(e.a, scope) : null, b: e.b ? ev(e.b, scope) : null, c: e.c ? ev(e.c, scope) : null };
      case 'lambda': return { __pyfn: true, lambda: true, name: '<lambda>', params: e.params.map((pp) => ({ name: pp.name, defVal: pp.def ? ev(pp.def, scope) : undefined })), body: e.body, closure: scope };
      case 'comp': {
        const out = e.kind === 'dict' ? new Map() : [];
        const inner = new Scope(scope, g);
        const loop = (k) => {
          if (k === e.gens.length) {
            if (e.kind === 'dict') out.set(ev(e.elt, inner), ev(e.valueElt, inner)); else out.push(ev(e.elt, inner));
            if (out.length > PY_LIMIT.size) throw new PyError('The list is too long', e.line);
            return;
          }
          const gen = e.gens[k];
          for (const it of iterate(ev(gen.iter, inner), e.line)) {
            tick(e.line); assign(gen.target, it, inner);
            if (gen.ifs.every((c) => truthy(ev(c, inner), e.line))) loop(k + 1);
          }
        };
        loop(0);
        return e.kind === 'set' ? Array.from(new Set(out)) : out;
      }
      default: throw new PyError('Unknown expression', e.line);
    }
  };
  ctx.globals = g;
  // np, plt and math are there without an import, as in many notebooks
  g.vars.set('np', pyModule('numpy', 0, ctx)); g.vars.set('plt', pyModule('matplotlib.pyplot', 0, ctx)); g.vars.set('math', pyModule('math', 0, ctx));
  exec(prog, g);
}

/* ---------- indexing ---------- */
function normIndex(i, n, line) { if (typeof i === 'boolean') i = +i; if (typeof i !== 'number' || !Number.isInteger(i)) throw new PyError('An index must be a whole number', line); const k = i < 0 ? n + i : i; if (k < 0 || k >= n) throw new PyError(`Index ${i} is out of range (length ${n})`, line); return k; }
function sliceIdx(sl, n) {
  const step = sl.c == null ? 1 : sl.c; if (step === 0) throw new PyError('A slice step cannot be zero');
  const clamp = (v, def) => { if (v == null) return def; let k = v < 0 ? n + v : v; return step > 0 ? Math.max(0, Math.min(n, k)) : Math.max(-1, Math.min(n - 1, k)); };
  const a = clamp(sl.a, step > 0 ? 0 : n - 1); const b = clamp(sl.b, step > 0 ? n : -1);
  const out = []; for (let i = a; step > 0 ? i < b : i > b; i += step) out.push(i);
  return out;
}
function getItem(obj, idx, line) {
  if (obj instanceof Map) { if (!obj.has(idx)) throw new PyError(`Key ${pyRepr(idx, false)} is not in the dict`, line); return obj.get(idx); }
  if (isArr(obj)) {
    if (obj.ndim === 2 && isTuple(idx)) {
      const [r, c] = obj.shape; const [ri, ci] = idx;
      const rows = ri && ri.__slice ? sliceIdx(ri, r) : [normIndex(ri, r, line)];
      const cols = ci && ci.__slice ? sliceIdx(ci, c) : [normIndex(ci, c, line)];
      if (!(ri && ri.__slice) && !(ci && ci.__slice)) return obj.data[rows[0] * c + cols[0]];
      const out = []; for (const i of rows) for (const j of cols) out.push(obj.data[i * c + j]);
      const res = new NDArray(out, (ri && ri.__slice) && (ci && ci.__slice) ? [rows.length, cols.length] : [out.length]);
      return res;
    }
    if (obj.ndim === 2 && typeof idx === 'number') { const [r, c] = obj.shape; const i = normIndex(idx, r, line); return new NDArray(obj.data.slice(i * c, (i + 1) * c)); }
    if (idx && idx.__slice) { const ids = sliceIdx(idx, obj.size); const r = new NDArray(ids.map((i) => obj.data[i])); r.bool = obj.bool; return r; }
    if (isArr(idx) || isList(idx)) {
      const I = toArr(idx, line);
      if (I.bool || (isList(idx) && idx.every((x) => typeof x === 'boolean'))) { if (I.size !== obj.size) throw new PyError('A mask must have the length of the array', line); const out = []; for (let i = 0; i < obj.size; i++) if (I.data[i]) out.push(obj.data[i]); return new NDArray(out); }
      return new NDArray(Array.from(I.data, (k) => obj.data[normIndex(k, obj.size, line)]));
    }
    const v = obj.data[normIndex(idx, obj.size, line)]; return obj.bool ? !!v : v;
  }
  if (isList(obj) || typeof obj === 'string') {
    if (isTuple(idx) && isList(obj)) { let o = obj; for (const k of idx) o = getItem(o, k, line); return o; }
    if (idx && idx.__slice) { const ids = sliceIdx(idx, obj.length); if (typeof obj === 'string') return ids.map((i) => obj[i]).join(''); const r = ids.map((i) => obj[i]); return isTuple(obj) ? mkTuple(r) : r; }
    return obj[normIndex(idx, obj.length, line)];
  }
  if (obj && obj.__getitem) return obj.__getitem(idx, line);
  throw new PyError(`${pyType(obj)} cannot be indexed`, line);
}
function setItem(obj, idx, value, line) {
  if (obj instanceof Map) { obj.set(idx, value); return; }
  if (isArr(obj)) {
    if (obj.ndim === 2 && isTuple(idx)) { const [r, c] = obj.shape; obj.data[normIndex(idx[0], r, line) * c + normIndex(idx[1], c, line)] = +value; return; }
    if (idx && idx.__slice) { const ids = sliceIdx(idx, obj.size); const V = numOrArr(value) && !(typeof value === 'number') ? toArr(value, line) : null; ids.forEach((i, k) => { obj.data[i] = V ? V.data[k % V.size] : +value; }); return; }
    if (isArr(idx) && idx.bool) { const V = isArr(value) ? value : null; let k = 0; for (let i = 0; i < obj.size; i++) if (idx.data[i]) obj.data[i] = V ? V.data[k++ % V.size] : +value; return; }
    obj.data[normIndex(idx, obj.size, line)] = +value; return;
  }
  if (isList(obj) && !isTuple(obj)) { obj[normIndex(idx, obj.length, line)] = value; return; }
  throw new PyError(`${pyType(obj)} does not support item assignment`, line);
}

/* ---------- attributes ---------- */
function getAttr(obj, name, line, ctx) {
  if (obj && obj.__module) { if (Object.prototype.hasOwnProperty.call(obj, name)) return obj[name]; throw new PyError(`${obj.__module} has no “${name}” in Musubi`, line); }
  if (obj && obj.__attrs) { const v = obj.__attrs(name, line); if (v !== undefined) return v; throw new PyError(`${obj.__kind || 'object'} has no attribute “${name}” in Musubi`, line); }
  if (isArr(obj)) return arrAttr(obj, name, line);
  if (typeof obj === 'string') return strAttr(obj, name, line);
  if (isList(obj)) return listAttr(obj, name, line, ctx);
  if (obj instanceof Map) return dictAttr(obj, name, line);
  if (typeof obj === 'number') { if (name === 'real') return obj; if (name === 'imag') return 0; if (name === 'is_integer') return () => Number.isInteger(obj); }
  throw new PyError(`${pyType(obj)} has no attribute “${name}”`, line);
}
const bound = (f) => (args, kw, line) => f(args, kw, line);
function arrAttr(a, name, line) {
  const red = (fn) => bound((args, kw) => { const ax = args[0] != null ? args[0] : kw.axis; return ax == null ? fn(a.data) : reduceAxis(a, ax, fn, line); });
  switch (name) {
    case 'shape': return mkTuple(a.shape.slice()); case 'size': return a.size; case 'ndim': return a.ndim;
    case 'T': return transpose(a);
    case 'sum': return red(arrSum); case 'mean': return red((d) => arrSum(d) / d.length);
    case 'max': return red((d) => arrMax(d)); case 'min': return red((d) => arrMin(d));
    case 'std': return red(arrStd); case 'var': return red((d) => arrStd(d) ** 2);
    case 'argmax': return bound(() => a.data.indexOf(arrMax(a.data))); case 'argmin': return bound(() => a.data.indexOf(arrMin(a.data)));
    case 'cumsum': return bound(() => cumsum(a)); case 'copy': return bound(() => new NDArray(a.data.slice(), a.shape.slice()));
    case 'tolist': return bound(() => Array.from(a.data)); case 'flatten': case 'ravel': return bound(() => new NDArray(a.data.slice()));
    case 'reshape': return bound((args) => reshape(a, args.length === 1 && isList(args[0]) ? args[0] : args, line));
    case 'any': return bound(() => a.data.some((x) => x !== 0)); case 'all': return bound(() => a.data.every((x) => x !== 0));
    case 'round': return bound((args) => { const k = 10 ** (args[0] || 0); return mapArr(a, (x) => Math.round(x * k) / k); });
    case 'astype': return bound(() => new NDArray(a.data.slice(), a.shape.slice()));
    case 'dot': return bound((args) => dot(a, args[0], line));
    default: throw new PyError(`An array has no “${name}” in Musubi`, line);
  }
}
function strAttr(s, name, line) {
  const m = {
    upper: () => s.toUpperCase(), lower: () => s.toLowerCase(), strip: (args) => (args[0] ? s.replace(new RegExp(`^[${args[0].replace(/[\]\\^-]/g, '\\$&')}]+|[${args[0].replace(/[\]\\^-]/g, '\\$&')}]+$`, 'g'), '') : s.trim()),
    title: () => s.replace(/\b\w/g, (c) => c.toUpperCase()), capitalize: () => s.charAt(0).toUpperCase() + s.slice(1).toLowerCase(),
    replace: (args) => s.split(args[0]).join(args[1]), split: (args) => (args[0] == null ? s.trim().split(/\s+/) : s.split(args[0])),
    join: (args) => args[0].map((x) => (typeof x === 'string' ? x : pyRepr(x))).join(s), startswith: (args) => s.startsWith(args[0]), endswith: (args) => s.endsWith(args[0]),
    find: (args) => s.indexOf(args[0]), count: (args) => s.split(args[0]).length - 1, zfill: (args) => s.padStart(args[0], '0'),
    format: (args, kw) => { let k = 0; return s.replace(/\{([^{}]*)\}/g, (mm, f) => { const [key, spec] = f.split(':'); const v = key === '' ? args[k++] : /^\d+$/.test(key) ? args[+key] : kw[key]; return formatSpec(v, spec || '', line); }); },
  };
  if (!ownProp(m, name)) throw new PyError(`A string has no “${name}” in Musubi`, line);
  return bound(m[name]);
}
function listAttr(l, name, line, ctx) {
  const m = {
    append: (args) => { if (isTuple(l)) throw new PyError('A tuple cannot change', line); l.push(args[0]); return null; },
    extend: (args) => { pushAll(l, isArr(args[0]) ? Array.from(args[0].data) : args[0]); return null; },
    pop: (args) => { if (!l.length) throw new PyError('pop from an empty list', line); return args.length ? l.splice(normIndex(args[0], l.length, line), 1)[0] : l.pop(); },
    insert: (args) => { l.splice(args[0], 0, args[1]); return null; }, index: (args) => { const k = l.findIndex((x) => pyEq(x, args[0])); if (k < 0) throw new PyError('Not in the list', line); return k; },
    count: (args) => l.filter((x) => pyEq(x, args[0])).length, copy: () => l.slice(), reverse: () => { l.reverse(); return null; },
    flatten: () => l.flat(Infinity), ravel: () => l.flat(Infinity),
    sort: (args, kw) => { const key = kw.key ? (x) => ctx.call(kw.key, [x], {}, line) : (x) => x; l.sort((a, b) => { const x = key(a); const y = key(b); return x < y ? -1 : x > y ? 1 : 0; }); if (kw.reverse) l.reverse(); return null; },
  };
  if (name === 'flat') return l.flat(Infinity);
  if (!ownProp(m, name)) throw new PyError(`A list has no “${name}” in Musubi`, line);
  return bound(m[name]);
}
function dictAttr(d, name, line) {
  const m = { keys: () => Array.from(d.keys()), values: () => Array.from(d.values()), items: () => Array.from(d, ([k, v]) => mkTuple([k, v])), get: (args) => (d.has(args[0]) ? d.get(args[0]) : args[1] == null ? null : args[1]) };
  if (!ownProp(m, name)) throw new PyError(`A dict has no “${name}” in Musubi`, line);
  return bound(m[name]);
}

/* ---------- numeric helpers ---------- */
function arrSum(d) { let s = 0; for (const x of d) s += x; return s; }
function arrStd(d) { const m = arrSum(d) / d.length; let s = 0; for (const x of d) s += (x - m) ** 2; return Math.sqrt(s / d.length); }
function cumsum(a) { const out = new Float64Array(a.size); let s = 0; for (let i = 0; i < a.size; i++) { s += a.data[i]; out[i] = s; } return new NDArray(out); }
function transpose(a) { if (a.ndim < 2) return a; const [r, c] = a.shape; const out = new Float64Array(r * c); for (let i = 0; i < r; i++) for (let j = 0; j < c; j++) out[j * r + i] = a.data[i * c + j]; return new NDArray(out, [c, r]); }
function reshape(a, shape, line) {
  let s = shape.map((x) => +x); const known = s.filter((x) => x !== -1).reduce((x, y) => x * y, 1);
  s = s.map((x) => (x === -1 ? a.size / known : x));
  if (s.reduce((x, y) => x * y, 1) !== a.size || s.length > 2) throw new PyError('Cannot reshape the array to this shape', line);
  return new NDArray(a.data.slice(), s.length === 1 ? [s[0]] : s);
}
function reduceAxis(a, ax, fn, line) {
  if (a.ndim !== 2) return fn(a.data);
  const [r, c] = a.shape;
  if (ax === 0) return new NDArray(Array.from({ length: c }, (_, j) => fn(Array.from({ length: r }, (__, i) => a.data[i * c + j]))));
  if (ax === 1 || ax === -1) return new NDArray(Array.from({ length: r }, (_, i) => fn(Array.from(a.data.slice(i * c, (i + 1) * c)))));
  throw new PyError('axis must be 0 or 1', line);
}
function mulberry32(seed) { let s = seed >>> 0; return () => { s = (s + 0x6D2B79F5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
function erf(x) { const s = Math.sign(x); x = Math.abs(x); const t = 1 / (1 + 0.3275911 * x); const y = 1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-x * x); return s * y; }
function gammaFn(z) { if (z < 0.5) return Math.PI / (Math.sin(Math.PI * z) * gammaFn(1 - z)); z -= 1; const g = 7; const c = [0.99999999999980993, 676.5203681218851, -1259.1392167224028, 771.32342877765313, -176.61503916999185, 12.507343278686905, -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7]; let x = c[0]; for (let i = 1; i < g + 2; i++) x += c[i] / (z + i); const t = z + g + 0.5; return Math.sqrt(2 * Math.PI) * t ** (z + 0.5) * Math.exp(-t) * x; }
function solveLinear(A, b) {
  const n = b.length; const M = A.map((r, i) => [...r, b[i]]);
  for (let i = 0; i < n; i++) {
    let p = i; for (let k = i + 1; k < n; k++) if (Math.abs(M[k][i]) > Math.abs(M[p][i])) p = k;
    [M[i], M[p]] = [M[p], M[i]];
    for (let k = i + 1; k < n; k++) { const f = M[k][i] / M[i][i]; for (let j = i; j <= n; j++) M[k][j] -= f * M[i][j]; }
  }
  const x = new Array(n).fill(0);
  for (let i = n - 1; i >= 0; i--) { let s = M[i][n]; for (let j = i + 1; j < n; j++) s -= M[i][j] * x[j]; x[i] = s / M[i][i]; }
  return x;
}

/* ---------- builtins and modules ---------- */
const fnArg = (args, kw, i, name, def) => (args.length > i ? args[i] : (name in kw ? kw[name] : def));
const PY_BUILTINS = new Map();
function defBuiltins() {
  const B = PY_BUILTINS;
  const iter = (v, line) => (isArr(v) ? Array.from(v.data) : isList(v) ? v : typeof v === 'string' ? Array.from(v) : v instanceof Map ? Array.from(v.keys()) : (() => { throw new PyError(`Cannot loop over ${pyType(v)}`, line); })());
  B.set('print', (args, kw, line) => { const ctx = plotCtx(); ctx.out.push(args.map((a) => (typeof a === 'string' ? a : pyRepr(a))).join(kw.sep != null ? kw.sep : ' ')); return null; });
  B.set('range', (args, kw, line) => {
    let [a, b, c] = args.length === 1 ? [0, args[0], 1] : [args[0], args[1], args[2] == null ? 1 : args[2]];
    if (c === 0) throw new PyError('range() step cannot be zero', line);
    if (Math.abs((b - a) / c) > PY_LIMIT.size) throw new PyError('The range is too long', line);
    const out = []; for (let i = a; c > 0 ? i < b : i > b; i += c) out.push(i); return out;
  });
  B.set('len', (args, kw, line) => { const v = args[0]; if (isArr(v)) return v.shape[0]; if (isList(v) || typeof v === 'string') return v.length; if (v instanceof Map) return v.size; throw new PyError(`${pyType(v)} has no length`, line); });
  B.set('abs', (args, kw, line) => (isArr(args[0]) || isList(args[0]) ? mapArr(args[0], Math.abs, line) : Math.abs(args[0])));
  const minmax = (f) => (args, kw, line) => { const xs = args.length === 1 ? iter(args[0], line) : args; if (!xs.length) throw new PyError('An empty sequence has no ' + (f === Math.min ? 'minimum' : 'maximum'), line); if (kw.key) { let best = xs[0]; let bk = plotCtx().call(kw.key, [best], {}, line); for (const x of xs.slice(1)) { const k = plotCtx().call(kw.key, [x], {}, line); if (f(k, bk) === k && k !== bk) { best = x; bk = k; } } return best; } return f(...xs); };
  B.set('min', minmax(Math.min)); B.set('max', minmax(Math.max));
  B.set('sum', (args, kw, line) => iter(args[0], line).reduce((s, x) => binop('+', s, x, line), args[1] || 0));
  B.set('round', (args) => { const k = 10 ** (args[1] || 0); const v = args[0]; if (isArr(v)) return mapArr(v, (x) => Math.round(x * k) / k); return args[1] == null ? Math.round(v) : Math.round(v * k) / k; });
  B.set('int', (args, kw, line) => { const v = args[0]; if (typeof v === 'string') { const n = parseInt(v, args[1] || 10); if (Number.isNaN(n)) throw new PyError(`Not a whole number: “${v}”`, line); return n; } return Math.trunc(v || 0); });
  B.set('float', (args, kw, line) => { const v = args[0]; if (typeof v === 'string') { const t = v.trim().toLowerCase(); if (t === 'inf' || t === '+inf') return Infinity; if (t === '-inf') return -Infinity; if (t === 'nan') return NaN; const n = parseFloat(v); if (Number.isNaN(n)) throw new PyError(`Not a number: “${v}”`, line); return n; } return +(v || 0); });
  B.set('str', (args) => (args.length ? (typeof args[0] === 'string' ? args[0] : pyRepr(args[0])) : ''));
  B.set('repr', (args) => pyRepr(args[0], false));
  B.set('bool', (args, kw, line) => truthy(args[0], line));
  B.set('list', (args, kw, line) => (args.length ? iter(args[0], line).slice() : []));
  B.set('tuple', (args, kw, line) => mkTuple(args.length ? iter(args[0], line).slice() : []));
  B.set('dict', (args, kw) => { const m = new Map(args[0] instanceof Map ? args[0] : (args[0] || []).map((p) => [p[0], p[1]])); for (const k of Object.keys(kw)) m.set(k, kw[k]); return m; });
  B.set('set', (args, kw, line) => Array.from(new Set(args.length ? iter(args[0], line) : [])));
  B.set('zip', (args, kw, line) => { const ls = args.map((a) => iter(a, line)); const n = Math.min(...ls.map((l) => l.length)); return Array.from({ length: n }, (_, i) => mkTuple(ls.map((l) => l[i]))); });
  B.set('enumerate', (args, kw, line) => iter(args[0], line).map((x, i) => mkTuple([i + (args[1] || kw.start || 0), x])));
  B.set('sorted', (args, kw, line) => { const l = iter(args[0], line).slice(); listAttr(l, 'sort', line, plotCtx())([], kw, line); return l; });
  B.set('reversed', (args, kw, line) => iter(args[0], line).slice().reverse());
  B.set('map', (args, kw, line) => { const ls = args.slice(1).map((a) => iter(a, line)); const n = Math.min(...ls.map((l) => l.length)); return Array.from({ length: n }, (_, i) => plotCtx().call(args[0], ls.map((l) => l[i]), {}, line)); });
  B.set('filter', (args, kw, line) => iter(args[1], line).filter((x) => truthy(args[0] == null ? x : plotCtx().call(args[0], [x], {}, line), line)));
  B.set('any', (args, kw, line) => iter(args[0], line).some((x) => truthy(x, line)));
  B.set('all', (args, kw, line) => iter(args[0], line).every((x) => truthy(x, line)));
  B.set('pow', (args) => args[0] ** args[1]);
  B.set('divmod', (args) => mkTuple([Math.floor(args[0] / args[1]), pyMod(args[0], args[1])]));
  B.set('isinstance', () => true);
  B.set('type', (args) => pyType(args[0]));
  B.set('input', (args, kw, line) => { throw new PyError('input() cannot run in a note', line); });
  B.set('open', (args, kw, line) => { throw new PyError('Plot code cannot open files', line); });
}

let PLOT_CTX = null;
const plotCtx = () => PLOT_CTX;

function makeModule(name, entries) { const m = Object.create(null); Object.defineProperty(m, '__module', { value: name }); Object.assign(m, entries); return m; }

function pyModule(name, line, ctx) {
  if (name === 'numpy' || name === 'np') return ctx.np || (ctx.np = makeNumpy(ctx));
  if (name === 'math') return makeMath();
  if (name === 'matplotlib.pyplot' || name === 'pylab') return ctx.plt || (ctx.plt = makePyplot(ctx));
  if (name === 'matplotlib') return makeModule('matplotlib', { pyplot: ctx.plt || (ctx.plt = makePyplot(ctx)), rcParams: new Map(), use: () => null });
  if (name === 'random') { const r = ctx.rng; return makeModule('random', { random: () => r(), seed: (a) => { ctx.rng = mulberry32(a[0] | 0); return null; }, uniform: (a) => a[0] + (a[1] - a[0]) * ctx.rng(), randint: (a) => a[0] + Math.floor(ctx.rng() * (a[1] - a[0] + 1)), gauss: (a) => a[0] + a[1] * gauss(ctx), choice: (a) => a[0][Math.floor(ctx.rng() * a[0].length)] }); }
  if (name === 'scipy' || name.startsWith('scipy.') || name === 'pandas' || name === 'sympy') throw new PyError(`${name} is not available in Musubi plots. numpy (as np), math and matplotlib.pyplot (as plt) are.`, line);
  throw new PyError(`The module “${name}” is not available. numpy (as np), math and matplotlib.pyplot (as plt) are.`, line);
}
function gauss(ctx) { let u = 0; let v = 0; while (u === 0) u = ctx.rng(); while (v === 0) v = ctx.rng(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); }

function makeMath() {
  const f1 = (f) => (args, kw, line) => { if (isArr(args[0]) || isList(args[0])) throw new PyError('math functions take one number. Use np. for arrays', line); return f(+args[0]); };
  return makeModule('math', {
    pi: Math.PI, e: Math.E, tau: 2 * Math.PI, inf: Infinity, nan: NaN,
    sin: f1(Math.sin), cos: f1(Math.cos), tan: f1(Math.tan), asin: f1(Math.asin), acos: f1(Math.acos), atan: f1(Math.atan),
    sinh: f1(Math.sinh), cosh: f1(Math.cosh), tanh: f1(Math.tanh), exp: f1(Math.exp), sqrt: f1(Math.sqrt), fabs: f1(Math.abs),
    log: (args) => (args[1] ? Math.log(args[0]) / Math.log(args[1]) : Math.log(args[0])), log10: f1(Math.log10), log2: f1(Math.log2),
    floor: f1(Math.floor), ceil: f1(Math.ceil), trunc: f1(Math.trunc), radians: f1((x) => (x * Math.PI) / 180), degrees: f1((x) => (x * 180) / Math.PI),
    atan2: (args) => Math.atan2(args[0], args[1]), hypot: (args) => Math.hypot(...args), pow: (args) => args[0] ** args[1],
    factorial: (args, kw, line) => { let r = 1; for (let i = 2; i <= args[0]; i++) r *= i; return r; }, gamma: f1(gammaFn), erf: f1(erf),
    isclose: (args, kw) => Math.abs(args[0] - args[1]) <= Math.max((kw.rel_tol || 1e-9) * Math.max(Math.abs(args[0]), Math.abs(args[1])), kw.abs_tol || 0),
    isfinite: f1(Number.isFinite), isnan: f1(Number.isNaN), copysign: (args) => Math.abs(args[0]) * Math.sign(args[1] || 1), comb: (args) => { let r = 1; for (let i = 1; i <= args[1]; i++) r = (r * (args[0] - args[1] + i)) / i; return Math.round(r); },
  });
}

function makeNumpy(ctx) {
  const u = (f) => (args, kw, line) => { const v = args[0]; return isArr(v) || isList(v) ? mapArr(v, f, line) : f(+v); };
  const u2 = (f) => (args, kw, line) => { const [a, b] = args; return isArr(a) || isArr(b) || isList(a) || isList(b) ? elementwise(a, b, f, line) : f(+a, +b); };
  const size = (s, line) => { const n = isList(s) ? s.reduce((x, y) => x * y, 1) : (s == null ? null : s); if (n != null && n > PY_LIMIT.size) throw new PyError('The array is too large', line); return n; };
  const shapeOf = (s) => (isList(s) ? (s.length === 1 ? [s[0]] : s.slice(0, 2)) : [s]);
  const fill = (s, v, line) => { const n = size(s, line); return new NDArray(new Float64Array(n).fill(v), shapeOf(s)); };
  const reducer = (fn) => (args, kw, line) => { const a = toArr(args[0], line); const ax = args[1] != null ? args[1] : kw.axis; return ax == null ? fn(a.data) : reduceAxis(a, ax, fn, line); };
  const rnd = (gen) => (args, kw, line) => { const s = args.length ? args : null; if (!s || s[0] == null) return gen(); const n = size(s, line); return new NDArray(Array.from({ length: n }, gen), shapeOf(s.length === 1 && isList(s[0]) ? s[0] : s)); };
  const sized = (gen, k) => (args, kw, line) => { const s = args.length > k ? args[k] : kw.size; if (s == null) return gen(args, kw); const n = size(s, line); return new NDArray(Array.from({ length: n }, () => gen(args, kw)), shapeOf(s)); };
  const random = makeModule('numpy.random', {
    seed: (args) => { ctx.rng = mulberry32((args[0] | 0) + 1); return null; },
    rand: rnd(() => ctx.rng()), random: (args, kw, line) => rnd(() => ctx.rng())(args.length && isList(args[0]) ? args[0] : args, kw, line), randn: rnd(() => gauss(ctx)),
    normal: sized((a, kw) => fnArg(a, kw, 0, 'loc', 0) + fnArg(a, kw, 1, 'scale', 1) * gauss(ctx), 2),
    uniform: sized((a, kw) => { const lo = fnArg(a, kw, 0, 'low', 0); const hi = fnArg(a, kw, 1, 'high', 1); return lo + (hi - lo) * ctx.rng(); }, 2),
    randint: sized((a, kw) => { const lo = a[1] == null ? 0 : a[0]; const hi = a[1] == null ? a[0] : a[1]; return lo + Math.floor(ctx.rng() * (hi - lo)); }, 2),
    exponential: sized((a, kw) => -Math.log(1 - ctx.rng()) * fnArg(a, kw, 0, 'scale', 1), 1),
    poisson: sized((a, kw) => { const lam = fnArg(a, kw, 0, 'lam', 1); let L = Math.exp(-lam); let k = 0; let p = 1; do { k++; p *= ctx.rng(); } while (p > L); return k - 1; }, 1),
    choice: (args, kw, line) => { const pool = typeof args[0] === 'number' ? Array.from({ length: args[0] }, (_, i) => i) : isArr(args[0]) ? Array.from(args[0].data) : args[0]; const pick = () => pool[Math.floor(ctx.rng() * pool.length)]; const s = args[1] != null ? args[1] : kw.size; return s == null ? pick() : new NDArray(Array.from({ length: size(s, line) }, pick)); },
    default_rng: (args) => { ctx.rng = mulberry32((args[0] | 0) + 1); return random; },
  });
  const np = makeModule('numpy', {
    pi: Math.PI, e: Math.E, inf: Infinity, nan: NaN, newaxis: null, random,
    array: (args, kw, line) => { const a = toArr(args[0], line); return new NDArray(a.data.slice(), a.shape.slice()); },
    asarray: (args, kw, line) => toArr(args[0], line),
    linspace: (args, kw, line) => {
      const a = +fnArg(args, kw, 0, 'start'); const b = +fnArg(args, kw, 1, 'stop'); const n = size(fnArg(args, kw, 2, 'num', 50), line);
      const end = kw.endpoint !== false; const d = n > 1 ? (b - a) / (end ? n - 1 : n) : 0;
      return new NDArray(Float64Array.from({ length: n }, (_, i) => a + i * d));
    },
    logspace: (args, kw, line) => { const a = args[0]; const b = args[1]; const n = size(args[2] == null ? 50 : args[2], line); const base = kw.base || 10; return new NDArray(Float64Array.from({ length: n }, (_, i) => base ** (a + (i * (b - a)) / (n - 1)))); },
    arange: (args, kw, line) => {
      const [a, b, c] = args.length === 1 ? [0, args[0], 1] : [args[0], args[1], args[2] == null ? 1 : args[2]];
      const n = Math.max(0, Math.ceil((b - a) / c)); size(n, line);
      return new NDArray(Float64Array.from({ length: n }, (_, i) => a + i * c));
    },
    zeros: (args, kw, line) => fill(args[0], 0, line), ones: (args, kw, line) => fill(args[0], 1, line), empty: (args, kw, line) => fill(args[0], 0, line),
    full: (args, kw, line) => fill(args[0], args[1], line),
    zeros_like: (args, kw, line) => { const a = toArr(args[0], line); return new NDArray(new Float64Array(a.size), a.shape.slice()); },
    ones_like: (args, kw, line) => { const a = toArr(args[0], line); return new NDArray(new Float64Array(a.size).fill(1), a.shape.slice()); },
    full_like: (args, kw, line) => { const a = toArr(args[0], line); return new NDArray(new Float64Array(a.size).fill(args[1]), a.shape.slice()); },
    copy: (args, kw, line) => { const a = toArr(args[0], line); return new NDArray(a.data.slice(), a.shape.slice()); },
    concatenate: (args, kw, line) => new NDArray(args[0].flatMap((x) => Array.from(toArr(x, line).data))),
    append: (args, kw, line) => new NDArray([...toArr(args[0], line).data, ...toArr(args[1], line).data]),
    stack: (args, kw, line) => toArr(args[0].map((x) => Array.from(toArr(x, line).data)), line),
    vstack: (args, kw, line) => toArr(args[0].map((x) => Array.from(toArr(x, line).data)), line),
    column_stack: (args, kw, line) => transpose(toArr(args[0].map((x) => Array.from(toArr(x, line).data)), line)),
    meshgrid: (args, kw, line) => { const x = toArr(args[0], line); const y = toArr(args[1], line); const X = new Float64Array(x.size * y.size); const Y = new Float64Array(x.size * y.size); for (let i = 0; i < y.size; i++) for (let j = 0; j < x.size; j++) { X[i * x.size + j] = x.data[j]; Y[i * x.size + j] = y.data[i]; } return mkTuple([new NDArray(X, [y.size, x.size]), new NDArray(Y, [y.size, x.size])]); },
    sin: u(Math.sin), cos: u(Math.cos), tan: u(Math.tan), arcsin: u(Math.asin), arccos: u(Math.acos), arctan: u(Math.atan),
    sinh: u(Math.sinh), cosh: u(Math.cosh), tanh: u(Math.tanh), arcsinh: u(Math.asinh), arccosh: u(Math.acosh), arctanh: u(Math.atanh),
    exp: u(Math.exp), expm1: u(Math.expm1), log: u(Math.log), log10: u(Math.log10), log2: u(Math.log2), log1p: u(Math.log1p),
    sqrt: u(Math.sqrt), cbrt: u(Math.cbrt), square: u((x) => x * x), abs: u(Math.abs), absolute: u(Math.abs), fabs: u(Math.abs), sign: u(Math.sign),
    floor: u(Math.floor), ceil: u(Math.ceil), trunc: u(Math.trunc), rint: u(Math.round), round: (args) => { const k = 10 ** (args[1] || 0); return isArr(args[0]) || isList(args[0]) ? mapArr(args[0], (x) => Math.round(x * k) / k) : Math.round(args[0] * k) / k; },
    sinc: u((x) => (x === 0 ? 1 : Math.sin(Math.PI * x) / (Math.PI * x))), deg2rad: u((x) => (x * Math.PI) / 180), rad2deg: u((x) => (x * 180) / Math.PI),
    radians: u((x) => (x * Math.PI) / 180), degrees: u((x) => (x * 180) / Math.PI), heaviside: u2((x, h0) => (x < 0 ? 0 : x > 0 ? 1 : h0)),
    isfinite: u((x) => +Number.isFinite(x)), isnan: u((x) => +Number.isNaN(x)), isinf: u((x) => +(!Number.isFinite(x) && !Number.isNaN(x))),
    arctan2: u2(Math.atan2), hypot: u2(Math.hypot), power: u2((a, b) => a ** b), maximum: u2(Math.max), minimum: u2(Math.min), mod: u2(pyMod), fmod: u2((a, b) => a % b),
    add: u2((a, b) => a + b), subtract: u2((a, b) => a - b), multiply: u2((a, b) => a * b), divide: u2((a, b) => a / b),
    sum: reducer(arrSum), mean: reducer((d) => arrSum(d) / d.length), average: (args, kw, line) => { if (!kw.weights) return arrSum(toArr(args[0], line).data) / toArr(args[0], line).size; const a = toArr(args[0], line); const w = toArr(kw.weights, line); let s = 0; let ws = 0; for (let i = 0; i < a.size; i++) { s += a.data[i] * w.data[i]; ws += w.data[i]; } return s / ws; },
    std: reducer(arrStd), var: reducer((d) => arrStd(d) ** 2), median: reducer((d) => { const s = Array.from(d).sort((a, b) => a - b); const m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; }),
    max: reducer((d) => arrMax(d)), min: reducer((d) => arrMin(d)), amax: reducer((d) => arrMax(d)), amin: reducer((d) => arrMin(d)),
    prod: reducer((d) => d.reduce((x, y) => x * y, 1)), ptp: reducer((d) => arrMax(d) - arrMin(d)),
    argmax: (args, kw, line) => { const d = toArr(args[0], line).data; return d.indexOf(arrMax(d)); }, argmin: (args, kw, line) => { const d = toArr(args[0], line).data; return d.indexOf(arrMin(d)); },
    cumsum: (args, kw, line) => cumsum(toArr(args[0], line)), cumprod: (args, kw, line) => { const a = toArr(args[0], line); let p = 1; return new NDArray(Array.from(a.data, (x) => (p *= x))); },
    diff: (args, kw, line) => { let a = toArr(args[0], line); for (let k = 0; k < (args[1] || kw.n || 1); k++) a = new NDArray(Array.from({ length: Math.max(0, a.size - 1) }, (_, i) => a.data[i + 1] - a.data[i])); return a; },
    sort: (args, kw, line) => new NDArray(Array.from(toArr(args[0], line).data).sort((a, b) => a - b)),
    argsort: (args, kw, line) => { const d = toArr(args[0], line).data; return new NDArray(Array.from(d.keys()).sort((a, b) => d[a] - d[b])); },
    unique: (args, kw, line) => new NDArray(Array.from(new Set(toArr(args[0], line).data)).sort((a, b) => a - b)),
    flip: (args, kw, line) => new NDArray(Array.from(toArr(args[0], line).data).reverse()),
    clip: (args, kw, line) => { const lo = fnArg(args, kw, 1, 'a_min', -Infinity); const hi = fnArg(args, kw, 2, 'a_max', Infinity); return mapArr(args[0], (x) => Math.min(hi == null ? Infinity : hi, Math.max(lo == null ? -Infinity : lo, x)), line); },
    where: (args, kw, line) => { const c = toArr(args[0], line); if (args.length === 1) return mkTuple([new NDArray(Array.from(c.data.keys()).filter((i) => c.data[i]))]); return elementwise(elementwise(c, args[1], (cc, a) => (cc ? a : NaN), line), args[2], (a, b) => (Number.isNaN(a) ? b : a), line); },
    dot: (args, kw, line) => dot(args[0], args[1], line), outer: (args, kw, line) => { const a = toArr(args[0], line); const b = toArr(args[1], line); const out = new Float64Array(a.size * b.size); for (let i = 0; i < a.size; i++) for (let j = 0; j < b.size; j++) out[i * b.size + j] = a.data[i] * b.data[j]; return new NDArray(out, [a.size, b.size]); },
    cross: (args, kw, line) => { const a = toArr(args[0], line).data; const b = toArr(args[1], line).data; return new NDArray([a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]); },
    transpose: (args, kw, line) => transpose(toArr(args[0], line)), reshape: (args, kw, line) => reshape(toArr(args[0], line), isList(args[1]) ? args[1] : [args[1]], line),
    interp: (args, kw, line) => { const xp = toArr(args[1], line).data; const fp = toArr(args[2], line).data; const f = (x) => { if (x <= xp[0]) return fp[0]; if (x >= xp[xp.length - 1]) return fp[fp.length - 1]; let k = 1; while (xp[k] < x) k++; const t = (x - xp[k - 1]) / (xp[k] - xp[k - 1]); return fp[k - 1] + t * (fp[k] - fp[k - 1]); }; return isArr(args[0]) || isList(args[0]) ? mapArr(args[0], f, line) : f(args[0]); },
    trapz: (args, kw, line) => npTrapz(args, kw, line), trapezoid: (args, kw, line) => npTrapz(args, kw, line),
    gradient: (args, kw, line) => { const y = toArr(args[0], line).data; const n = y.length; const x = args[1] == null ? null : typeof args[1] === 'number' ? Float64Array.from({ length: n }, (_, i) => i * args[1]) : toArr(args[1], line).data; const X = x || Float64Array.from({ length: n }, (_, i) => i); const out = new Float64Array(n); for (let i = 0; i < n; i++) { const a = Math.max(0, i - 1); const b = Math.min(n - 1, i + 1); out[i] = (y[b] - y[a]) / (X[b] - X[a]); } return new NDArray(out); },
    polyfit: (args, kw, line) => {
      const x = toArr(args[0], line).data; const y = toArr(args[1], line).data; const deg = args[2];
      const A = Array.from({ length: deg + 1 }, (_, i) => Array.from({ length: deg + 1 }, (__, j) => { let s = 0; for (const xi of x) s += xi ** (2 * deg - i - j); return s; }));
      const b = Array.from({ length: deg + 1 }, (_, i) => { let s = 0; for (let k = 0; k < x.length; k++) s += y[k] * x[k] ** (deg - i); return s; });
      return new NDArray(solveLinear(A, b));
    },
    polyval: (args, kw, line) => { const p = toArr(args[0], line).data; const f = (x) => p.reduce((s, c) => s * x + c, 0); return isArr(args[1]) || isList(args[1]) ? mapArr(args[1], f, line) : f(args[1]); },
    poly1d: (args, kw, line) => { const p = toArr(args[0], line).data; const f = (x) => p.reduce((s, c) => s * x + c, 0); return (a) => (isArr(a[0]) || isList(a[0]) ? mapArr(a[0], f, line) : f(a[0])); },
    histogram: (args, kw, line) => { const { counts, edges } = histogramData(toArr(args[0], line).data, fnArg(args, kw, 1, 'bins', 10), kw.range, kw.density); return mkTuple([new NDArray(counts), new NDArray(edges)]); },
    convolve: (args, kw, line) => { const a = toArr(args[0], line).data; const v = toArr(args[1], line).data; const out = new Float64Array(a.length + v.length - 1); for (let i = 0; i < a.length; i++) for (let j = 0; j < v.length; j++) out[i + j] += a[i] * v[j]; const mode = args[2] || kw.mode || 'full'; if (mode === 'same') { const s = Math.floor((v.length - 1) / 2); return new NDArray(out.slice(s, s + a.length)); } if (mode === 'valid') return new NDArray(out.slice(v.length - 1, a.length)); return new NDArray(out); },
    any: (args, kw, line) => toArr(args[0], line).data.some((x) => x !== 0), all: (args, kw, line) => toArr(args[0], line).data.every((x) => x !== 0),
    isclose: (args, kw, line) => elementwise(args[0], args[1], (a, b) => +(Math.abs(a - b) <= (kw.atol == null ? 1e-8 : kw.atol) + (kw.rtol == null ? 1e-5 : kw.rtol) * Math.abs(b)), line, true),
    allclose: (args, kw, line) => elementwise(args[0], args[1], (a, b) => +(Math.abs(a - b) <= 1e-8 + 1e-5 * Math.abs(b)), line).data.every((x) => x),
    shape: (args, kw, line) => mkTuple(toArr(args[0], line).shape.slice()), size: (args, kw, line) => toArr(args[0], line).size,
    float64: (args) => +args[0], int64: (args) => Math.trunc(args[0]),
  });
  np.linalg = makeModule('numpy.linalg', {
    norm: (args, kw, line) => Math.sqrt(arrSum(Array.from(toArr(args[0], line).data, (x) => x * x))),
    solve: (args, kw, line) => { const A = toArr(args[0], line); const [n] = A.shape; return new NDArray(solveLinear(Array.from({ length: n }, (_, i) => Array.from(A.data.slice(i * n, (i + 1) * n))), Array.from(toArr(args[1], line).data))); },
  });
  return np;
}
function npTrapz(args, kw, line) { const y = toArr(args[0], line).data; const x = args[1] != null ? toArr(args[1], line).data : kw.x ? toArr(kw.x, line).data : null; const dx = kw.dx || 1; let s = 0; for (let i = 1; i < y.length; i++) s += ((x ? x[i] - x[i - 1] : dx) * (y[i] + y[i - 1])) / 2; return s; }
function histogramData(d, bins, range, density) {
  const vals = Array.from(d).filter(Number.isFinite);
  let edges;
  if (isList(bins) || isArr(bins)) edges = Array.from(isArr(bins) ? bins.data : bins);
  else {
    const n = bins | 0 || 10; const lo = range ? range[0] : arrMin(vals); let hi = range ? range[1] : arrMax(vals); if (hi === lo) hi = lo + 1;
    edges = Array.from({ length: n + 1 }, (_, i) => lo + (i * (hi - lo)) / n);
  }
  const counts = new Array(edges.length - 1).fill(0);
  for (const v of vals) { if (v < edges[0] || v > edges[edges.length - 1]) continue; let k = edges.findIndex((e, i) => i > 0 && v < e) - 1; if (k < 0) k = counts.length - 1; counts[k]++; }
  if (density) { const tot = vals.length; for (let i = 0; i < counts.length; i++) counts[i] /= tot * (edges[i + 1] - edges[i]); }
  return { counts, edges };
}

/* ---------- matplotlib.pyplot ---------- */
const PLOT_CYCLE = ['var(--ist-gold)', 'var(--ist-slate)', 'var(--ist-verdigris)', 'var(--c-red)', 'var(--ist-plum)', 'var(--c-orange)', 'var(--c-cyan)', 'var(--c-pink)', 'var(--ist-text-muted)', 'var(--ist-gold-dim)'];
const PLOT_COLORS = {
  b: 'var(--ist-slate)', blue: 'var(--ist-slate)', g: 'var(--ist-verdigris)', green: 'var(--ist-verdigris)', r: 'var(--c-red)', red: 'var(--c-red)',
  c: 'var(--c-cyan)', cyan: 'var(--c-cyan)', m: 'var(--ist-plum)', magenta: 'var(--ist-plum)', purple: 'var(--ist-plum)', violet: 'var(--ist-plum)',
  y: 'var(--ist-gold)', yellow: 'var(--ist-gold)', gold: 'var(--ist-gold)', k: 'var(--ist-text-bright)', black: 'var(--ist-text-bright)',
  w: 'var(--ist-bg-1)', white: 'var(--ist-bg-1)', orange: 'var(--c-orange)', gray: 'var(--ist-text-muted)', grey: 'var(--ist-text-muted)',
  pink: 'var(--c-pink)', brown: 'var(--ist-oxblood)', navy: 'var(--ist-slate)', teal: 'var(--ist-verdigris)', olive: 'var(--ist-gold-dim)',
  darkred: 'var(--ist-oxblood)', darkblue: 'var(--ist-slate)', darkgreen: 'var(--ist-verdigris)', lightgray: 'var(--ist-rule)', lightgrey: 'var(--ist-rule)',
};
function plotColor(c, line) {
  if (c == null) return null;
  if (isList(c) && c.length >= 3 && c.every((x) => typeof x === 'number')) { const [r, g, b] = c.map((x) => Math.round(Math.max(0, Math.min(1, x)) * 255)); return `rgb(${r},${g},${b})`; }
  if (typeof c === 'number') { const v = Math.round(Math.max(0, Math.min(1, c)) * 255); return `rgb(${v},${v},${v})`; }
  const s = String(c).trim(); const k = s.toLowerCase().replace(/^tab:/, '').replace(/^xkcd:/, '');
  if (/^c\d$/i.test(s)) return PLOT_CYCLE[+s.slice(1)];
  if (PLOT_COLORS[k]) return PLOT_COLORS[k];
  if (/^#[0-9a-f]{3,8}$/i.test(s)) return s;
  if (/^0?\.\d+$|^[01](\.0*)?$/.test(s)) { const v = Math.round(+s * 255); return `rgb(${v},${v},${v})`; }
  if (/^[a-z]+$/i.test(s)) return s;
  throw new PyError(`Unknown colour “${s}”`, line);
}
function parseFmt(fmt) {
  const out = {}; if (!fmt) return out;
  let s = String(fmt);
  const ls = /--|-\.|-|:/.exec(s); if (ls) { out.ls = ls[0]; s = s.replace(ls[0], ''); }
  const mk = /[.,ov^<>1234sp*hH+xXDd|_]/.exec(s); if (mk) { out.marker = mk[0]; s = s.replace(mk[0], ''); }
  const col = /[bgrcmykw]/.exec(s); if (col) out.color = col[0];
  if (out.marker && !out.ls) out.ls = 'none';
  return out;
}

function makePyplot(ctx) {
  ctx.figures = []; let fig = null; let ax = null;
  const newFig = (kw = {}) => {
    const fs = kw.figsize ? Array.from(isArr(kw.figsize) ? kw.figsize.data : kw.figsize) : [6.4, 4.8];
    fig = { w: fs[0], h: fs[1], axes: [], rows: 1, cols: 1, suptitle: '' };
    ctx.figures.push(fig); ax = null; return fig;
  };
  const newAx = (f, row = 0, col = 0, rs = 1, cs = 1) => { const a = makeAxes(f, row, col, rs, cs); f.axes.push(a); return a; };
  const gca = () => { if (!fig) newFig(); if (!ax) ax = fig.axes[0] || newAx(fig); return ax; };
  const figObj = (f) => {
    const o = { __kind: 'Figure', __fig: f };
    o.__attrs = (name) => ownProp({
      suptitle: (a) => { f.suptitle = String(a[0]); return null; }, tight_layout: () => null, savefig: () => null, show: () => null,
      add_subplot: (a) => { const [r, c, i] = a.length === 1 ? String(a[0]).split('').map(Number) : a; f.rows = r; f.cols = c; ax = newAx(f, Math.floor((i - 1) / c), (i - 1) % c); return axesObj(ax); },
      set_size_inches: (a) => { f.w = a[0]; f.h = a[1]; return null; }, gca: () => axesObj(gca()), subplots_adjust: () => null, legend: (a, kw) => { gca().legend = { loc: kw.loc || 'best' }; return null; },
      colorbar: () => null, set_facecolor: () => null, axes: f.axes.map(axesObj),
    }, name);
    return o;
  };
  const axesCache = new WeakMap();
  const axesObj = (a) => { if (axesCache.has(a)) return axesCache.get(a); const o = { __kind: 'Axes', __ax: a }; o.__attrs = (name) => ownProp(axesMethods(a, ctx), name); axesCache.set(a, o); return o; };
  const plt = makeModule('matplotlib.pyplot', {
    figure: (args, kw) => figObj(newFig(kw)),
    subplots: (args, kw, line) => {
      const r = fnArg(args, kw, 0, 'nrows', 1); const c = fnArg(args, kw, 1, 'ncols', 1);
      const f = newFig(kw.figsize ? kw : (r * c > 1 ? { figsize: [Math.min(12, 4.2 * c), Math.min(14, 3.4 * r)] } : {})); f.rows = r; f.cols = c;
      const grid = []; for (let i = 0; i < r; i++) { const row = []; for (let j = 0; j < c; j++) row.push(axesObj(newAx(f, i, j))); grid.push(row); }
      if (kw.sharex) f.sharex = true; if (kw.sharey) f.sharey = true;
      ax = f.axes[0];
      const axes = r === 1 && c === 1 ? grid[0][0] : r === 1 ? grid[0] : c === 1 ? grid.map((x) => x[0]) : grid;
      return mkTuple([figObj(f), axes]);
    },
    subplot: (args, kw, line) => {
      const [r, c, i] = args.length === 1 ? String(args[0]).split('').map(Number) : args;
      if (!fig) newFig(r * c > 1 ? { figsize: [Math.min(12, 4.2 * c), Math.min(14, 3.4 * r)] } : {});
      fig.rows = Math.max(fig.rows, r); fig.cols = Math.max(fig.cols, c);
      const row = Math.floor((i - 1) / c); const col = (i - 1) % c;
      ax = fig.axes.find((a) => a.row === row && a.col === col) || newAx(fig, row, col);
      return axesObj(ax);
    },
    gca: () => axesObj(gca()), gcf: () => { if (!fig) newFig(); return figObj(fig); },
    show: () => null, close: () => null, savefig: () => null, tight_layout: () => null, ion: () => null, ioff: () => null, draw: () => null, pause: () => null, clf: () => { if (fig) { fig.axes = []; ax = null; } return null; },
    suptitle: (args) => { if (!fig) newFig(); fig.suptitle = String(args[0]); return null; },
    style: makeModule('matplotlib.style', { use: () => null }), rcParams: new Map(), colorbar: () => null, subplots_adjust: () => null,
    cm: makeModule('matplotlib.cm', {}),
  });
  const forward = ['plot', 'scatter', 'bar', 'barh', 'hist', 'fill_between', 'axhline', 'axvline', 'errorbar', 'step', 'stem', 'text', 'annotate', 'grid', 'legend', 'xlabel', 'ylabel', 'title', 'xlim', 'ylim', 'xscale', 'yscale', 'axis', 'loglog', 'semilogx', 'semilogy', 'xticks', 'yticks', 'axhspan', 'axvspan', 'quiver', 'contour', 'contourf', 'imshow', 'pie', 'polar', 'minorticks_on', 'margins', 'hlines', 'vlines', 'twinx', 'gca'];
  const AX_NAME = { xlabel: 'set_xlabel', ylabel: 'set_ylabel', title: 'set_title', xlim: 'set_xlim', ylim: 'set_ylim', xscale: 'set_xscale', yscale: 'set_yscale', xticks: 'set_xticks', yticks: 'set_yticks' };
  for (const f of forward) if (!plt[f]) plt[f] = (args, kw, line) => { const m = ownProp(axesMethods(gca(), ctx), AX_NAME[f] || f); if (!m) throw new PyError(`plt.${f}() is not available in Musubi`, line); return m(args, kw, line); };
  return plt;
}

function makeAxes(f, row, col) {
  return { fig: f, row, col, series: [], xlabel: '', ylabel: '', title: '', xlim: null, ylim: null, xscale: 'linear', yscale: 'linear', grid: false, legend: null, aspect: null, texts: [], spans: [], cycle: 0, xticks: null, yticks: null, xticklabels: null, yticklabels: null, polar: false };
}

function axesMethods(a, ctx) {
  const nextColor = () => PLOT_CYCLE[a.cycle++ % PLOT_CYCLE.length];
  const arr = (v, line) => Array.from(toArr(v, line).data);
  const common = (kw, line) => ({
    color: plotColor(kw.color != null ? kw.color : kw.c != null && typeof kw.c === 'string' ? kw.c : null, line),
    label: kw.label != null ? String(kw.label) : '', alpha: kw.alpha != null ? +kw.alpha : 1,
    lw: kw.linewidth != null ? +kw.linewidth : kw.lw != null ? +kw.lw : 1.6,
    ls: kw.linestyle != null ? String(kw.linestyle) : kw.ls != null ? String(kw.ls) : null,
    marker: kw.marker != null ? String(kw.marker) : null, ms: kw.markersize != null ? +kw.markersize : kw.ms != null ? +kw.ms : 5,
    zorder: kw.zorder != null ? +kw.zorder : 2,
  });
  const lineSeries = (args, kw, line, extra = {}) => {
    const groups = []; let i = 0;
    while (i < args.length) {
      let x; let y; let fmt = '';
      const a0 = args[i]; const a1 = args[i + 1]; const a2 = args[i + 2];
      if (a1 !== undefined && typeof a1 !== 'string' && (numOrArr(a1) || typeof a1 === 'number')) { x = a0; y = a1; i += 2; if (typeof a2 === 'string') { fmt = a2; i++; } }
      else { y = a0; i++; if (typeof a1 === 'string') { fmt = a1; i++; } }
      if (y && y.__pyfn) throw new PyError('plot() needs numbers. Call the function first, for example y = f(x)', line);
      let Y = toArr(y, line); let X = x === undefined ? Array.from({ length: Y.shape[0] }, (_, k) => k) : arr(x, line);
      if (Y.ndim === 2) { const [r, c] = Y.shape; for (let j = 0; j < c; j++) groups.push({ x: X, y: Array.from({ length: r }, (_, k) => Y.data[k * c + j]), fmt }); continue; }
      groups.push({ x: X, y: Array.from(Y.data), fmt });
    }
    for (const g of groups) {
      if (g.x.length !== g.y.length) throw new PyError(`x and y must have the same length (they have ${g.x.length} and ${g.y.length})`, line);
      const f = parseFmt(g.fmt); const c = common(kw, line);
      a.series.push(Object.assign({ kind: 'line', x: g.x, y: g.y }, c, { color: c.color || plotColor(f.color, line) || nextColor(), ls: c.ls || f.ls || '-', marker: c.marker || f.marker || null }, extra));
    }
    return groups.map(() => ({ __kind: 'Line2D', __attrs: (n) => ownProp({ set_data: () => null, set_label: () => null, get_color: () => '' }, n) }));
  };
  const setLim = (key) => (args, kw) => {
    let lo; let hi;
    if (args.length === 1 && isList(args[0])) [lo, hi] = args[0]; else { lo = args[0]; hi = args[1]; }
    if (kw.left != null || kw.bottom != null) lo = kw.left != null ? kw.left : kw.bottom; if (kw.right != null || kw.top != null) hi = kw.right != null ? kw.right : kw.top;
    a[key] = [lo == null ? null : +lo, hi == null ? null : +hi]; return mkTuple([lo, hi]);
  };
  const M = {
    plot: lineSeries,
    step: (args, kw, line) => lineSeries(args, kw, line, { step: kw.where || 'pre' }),
    loglog: (args, kw, line) => { a.xscale = 'log'; a.yscale = 'log'; return lineSeries(args, kw, line); },
    semilogx: (args, kw, line) => { a.xscale = 'log'; return lineSeries(args, kw, line); },
    semilogy: (args, kw, line) => { a.yscale = 'log'; return lineSeries(args, kw, line); },
    scatter: (args, kw, line) => {
      const x = arr(fnArg(args, kw, 0, 'x'), line); const y = arr(fnArg(args, kw, 1, 'y'), line);
      const c = common(kw, line); const s = fnArg(args, kw, 2, 's', 20);
      const cv = kw.c != null && typeof kw.c !== 'string' ? arr(kw.c, line) : null;
      a.series.push(Object.assign({ kind: 'scatter', x, y }, c, { color: c.color || nextColor(), s: typeof s === 'number' ? s : arr(s, line), cvals: cv, marker: c.marker || 'o' }));
      return null;
    },
    bar: (args, kw, line) => {
      const xs = fnArg(args, kw, 0, 'x'); const x = isList(xs) && xs.some((v) => typeof v === 'string') ? xs : arr(xs, line); const hgt = arr(fnArg(args, kw, 1, 'height'), line);
      const w = fnArg(args, kw, 2, 'width', 0.8); const c = common(kw, line);
      const bottom = kw.bottom != null ? (typeof kw.bottom === 'number' ? hgt.map(() => kw.bottom) : arr(kw.bottom, line)) : hgt.map(() => 0);
      let xn = x; if (x.some((v) => typeof v === 'string')) { a.xticks = x.map((_, i) => i); a.xticklabels = x.map(String); xn = x.map((_, i) => i); }
      a.series.push(Object.assign({ kind: 'bar', x: xn, h: hgt, w: typeof w === 'number' ? hgt.map(() => w) : arr(w, line), bottom }, c, { color: c.color || nextColor(), edge: plotColor(kw.edgecolor, line) }));
      return null;
    },
    barh: (args, kw, line) => {
      const ys = fnArg(args, kw, 0, 'y'); const y = isList(ys) && ys.some((v) => typeof v === 'string') ? ys : arr(ys, line); const wid = arr(fnArg(args, kw, 1, 'width'), line);
      const h = fnArg(args, kw, 2, 'height', 0.8); const c = common(kw, line);
      let yn = y; if (y.some((v) => typeof v === 'string')) { a.yticks = y.map((_, i) => i); a.yticklabels = y.map(String); yn = y.map((_, i) => i); }
      a.series.push(Object.assign({ kind: 'barh', y: yn, wd: wid, h: typeof h === 'number' ? wid.map(() => h) : arr(h, line), left: kw.left != null ? (typeof kw.left === 'number' ? wid.map(() => kw.left) : arr(kw.left, line)) : wid.map(() => 0) }, c, { color: c.color || nextColor() }));
      return null;
    },
    hist: (args, kw, line) => {
      const data = fnArg(args, kw, 0, 'x'); const sets = isList(data) && data.length && (isList(data[0]) || isArr(data[0])) ? data : [data];
      const c = common(kw, line); let out = null;
      for (const d of sets) {
        const { counts, edges } = histogramData(toArr(d, line).data, fnArg(args, kw, 1, 'bins', 10), kw.range ? Array.from(kw.range) : null, kw.density);
        const htype = kw.histtype || 'bar';
        a.series.push(Object.assign({ kind: 'bar', x: counts.map((_, i) => (edges[i] + edges[i + 1]) / 2), h: counts, w: counts.map((_, i) => edges[i + 1] - edges[i]), bottom: counts.map(() => 0), hist: true }, c, { color: c.color || nextColor(), alpha: kw.alpha != null ? +kw.alpha : htype === 'step' ? 1 : 0.85, edge: plotColor(kw.edgecolor || kw.ec, line) || 'var(--ist-bg-1)', stepOnly: htype === 'step' }));
        out = mkTuple([new NDArray(counts), new NDArray(edges), null]);
      }
      return out;
    },
    fill_between: (args, kw, line) => {
      const x = arr(fnArg(args, kw, 0, 'x'), line); const y1v = fnArg(args, kw, 1, 'y1'); const y2v = fnArg(args, kw, 2, 'y2', 0);
      const y1 = typeof y1v === 'number' ? x.map(() => y1v) : arr(y1v, line); const y2 = typeof y2v === 'number' ? x.map(() => y2v) : arr(y2v, line);
      const c = common(kw, line); const where = kw.where != null ? arr(kw.where, line) : null;
      a.series.push(Object.assign({ kind: 'fill', x, y1, y2, where }, c, { color: c.color || nextColor(), alpha: kw.alpha != null ? +kw.alpha : 0.3 }));
      return null;
    },
    fill: (args, kw, line) => { const x = arr(args[0], line); const y = arr(args[1], line); const c = common(kw, line); a.series.push(Object.assign({ kind: 'poly', x, y }, c, { color: c.color || plotColor(args[2], line) || nextColor(), alpha: kw.alpha != null ? +kw.alpha : 0.4 })); return null; },
    errorbar: (args, kw, line) => {
      const x = arr(fnArg(args, kw, 0, 'x'), line); const y = arr(fnArg(args, kw, 1, 'y'), line);
      const errs = (v) => (v == null ? null : typeof v === 'number' ? x.map(() => v) : arr(v, line));
      const f = parseFmt(kw.fmt || (typeof args[2] === 'string' ? args[2] : '')); const c = common(kw, line);
      a.series.push(Object.assign({ kind: 'errorbar', x, y, yerr: errs(fnArg(args, kw, 2, 'yerr')), xerr: errs(kw.xerr) }, c, { color: c.color || plotColor(f.color, line) || nextColor(), ls: c.ls || f.ls || (kw.fmt ? 'none' : '-'), marker: c.marker || f.marker || 'o', capsize: kw.capsize != null ? +kw.capsize : 3 }));
      return null;
    },
    stem: (args, kw, line) => { const x = args.length > 1 ? arr(args[0], line) : null; const y = arr(args.length > 1 ? args[1] : args[0], line); const c = common(kw, line); a.series.push(Object.assign({ kind: 'stem', x: x || y.map((_, i) => i), y }, c, { color: c.color || nextColor() })); return null; },
    axhline: (args, kw, line) => { const c = common(kw, line); a.spans.push(Object.assign({ kind: 'h', v: +fnArg(args, kw, 0, 'y', 0) }, c, { color: c.color || 'var(--ist-text-muted)', lw: kw.linewidth || kw.lw || 1, ls: c.ls || '-' })); return null; },
    axvline: (args, kw, line) => { const c = common(kw, line); a.spans.push(Object.assign({ kind: 'v', v: +fnArg(args, kw, 0, 'x', 0) }, c, { color: c.color || 'var(--ist-text-muted)', lw: kw.linewidth || kw.lw || 1, ls: c.ls || '-' })); return null; },
    hlines: (args, kw, line) => { const ys = typeof args[0] === 'number' ? [args[0]] : arr(args[0], line); const c = common(kw, line); for (const y of ys) a.series.push(Object.assign({ kind: 'line', x: [+args[1], +args[2]], y: [y, y] }, c, { color: c.color || 'var(--ist-text-muted)', ls: c.ls || '-', lw: kw.lw || 1 })); return null; },
    vlines: (args, kw, line) => { const xs = typeof args[0] === 'number' ? [args[0]] : arr(args[0], line); const c = common(kw, line); for (const x of xs) a.series.push(Object.assign({ kind: 'line', x: [x, x], y: [+args[1], +args[2]] }, c, { color: c.color || 'var(--ist-text-muted)', ls: c.ls || '-', lw: kw.lw || 1 })); return null; },
    axhspan: (args, kw, line) => { const c = common(kw, line); a.spans.push(Object.assign({ kind: 'hs', a: +args[0], b: +args[1] }, c, { color: c.color || 'var(--ist-gold)', alpha: kw.alpha != null ? +kw.alpha : 0.15 })); return null; },
    axvspan: (args, kw, line) => { const c = common(kw, line); a.spans.push(Object.assign({ kind: 'vs', a: +args[0], b: +args[1] }, c, { color: c.color || 'var(--ist-gold)', alpha: kw.alpha != null ? +kw.alpha : 0.15 })); return null; },
    text: (args, kw, line) => { a.texts.push({ x: +args[0], y: +args[1], s: String(args[2]), ha: kw.ha || kw.horizontalalignment || 'left', va: kw.va || kw.verticalalignment || 'baseline', size: kw.fontsize || kw.size || null, color: plotColor(kw.color, line), transform: kw.transform && kw.transform.__axesFraction }); return null; },
    annotate: (args, kw, line) => { const xy = kw.xy || args[1]; const xt = kw.xytext || xy; a.texts.push({ x: +xt[0], y: +xt[1], s: String(args[0] != null ? args[0] : kw.text), ha: kw.ha || 'left', va: kw.va || 'baseline', size: kw.fontsize || null, color: plotColor(kw.color, line), arrow: kw.arrowprops ? { x: +xy[0], y: +xy[1] } : null }); return null; },
    grid: (args, kw) => { a.grid = args.length ? truthy(args[0]) : (kw.visible != null ? !!kw.visible : true); if (kw.which === 'minor') a.grid = a.grid; return null; },
    legend: (args, kw) => { a.legend = { loc: kw.loc || 'best', labels: args.length && isList(args[0]) ? args[0].map(String) : null, title: kw.title || '' }; return null; },
    set_xlabel: (args) => { a.xlabel = String(args[0] == null ? '' : args[0]); return null; }, set_ylabel: (args) => { a.ylabel = String(args[0] == null ? '' : args[0]); return null; },
    set_title: (args) => { a.title = String(args[0] == null ? '' : args[0]); return null; },
    set_xlim: setLim('xlim'), set_ylim: setLim('ylim'),
    get_xlim: () => mkTuple(a.xlim || [0, 1]), get_ylim: () => mkTuple(a.ylim || [0, 1]),
    set_xscale: (args, kw, line) => { a.xscale = String(args[0]); if (!['linear', 'log', 'symlog'].includes(a.xscale)) throw new PyError('Scale must be "linear" or "log"', line); if (a.xscale === 'symlog') a.xscale = 'linear'; return null; },
    set_yscale: (args, kw, line) => { a.yscale = String(args[0]); if (!['linear', 'log', 'symlog'].includes(a.yscale)) throw new PyError('Scale must be "linear" or "log"', line); if (a.yscale === 'symlog') a.yscale = 'linear'; return null; },
    set_xticks: (args) => { a.xticks = Array.from(isArr(args[0]) ? args[0].data : args[0]); if (args[1]) a.xticklabels = args[1].map(String); return null; },
    set_yticks: (args) => { a.yticks = Array.from(isArr(args[0]) ? args[0].data : args[0]); if (args[1]) a.yticklabels = args[1].map(String); return null; },
    set_xticklabels: (args) => { a.xticklabels = args[0].map(String); return null; }, set_yticklabels: (args) => { a.yticklabels = args[0].map(String); return null; },
    set_aspect: (args) => { a.aspect = args[0] === 'equal' || args[0] === 1 ? 'equal' : null; return null; },
    axis: (args, kw) => { const v = args[0]; if (v === 'equal' || v === 'scaled' || v === 'square') a.aspect = 'equal'; else if (v === 'off') a.off = true; else if (isList(v) && v.length === 4) { a.xlim = [v[0], v[1]]; a.ylim = [v[2], v[3]]; } return null; },
    set: (args, kw) => { if (kw.xlabel != null) a.xlabel = String(kw.xlabel); if (kw.ylabel != null) a.ylabel = String(kw.ylabel); if (kw.title != null) a.title = String(kw.title); if (kw.xlim) a.xlim = Array.from(kw.xlim); if (kw.ylim) a.ylim = Array.from(kw.ylim); if (kw.xscale) a.xscale = kw.xscale; if (kw.yscale) a.yscale = kw.yscale; return null; },
    tick_params: () => null, minorticks_on: () => null, margins: () => null, set_facecolor: () => null, invert_yaxis: () => { a.invertY = true; return null; }, invert_xaxis: () => { a.invertX = true; return null; },
    spines: new Map([['top', { __kind: 'Spine', __attrs: (n) => ownProp({ set_visible: () => null }, n) }], ['right', { __kind: 'Spine', __attrs: (n) => ownProp({ set_visible: () => null }, n) }], ['left', { __kind: 'Spine', __attrs: (n) => ownProp({ set_visible: () => null }, n) }], ['bottom', { __kind: 'Spine', __attrs: (n) => ownProp({ set_visible: () => null }, n) }]]),
    transAxes: { __kind: 'Transform', __axesFraction: true, __attrs: () => undefined },
    twinx: (args, kw, line) => { throw new PyError('twinx() is not available in Musubi plots', line); },
    quiver: (args, kw, line) => {
      const [X, Y, U, V] = args.map((v) => arr(v, line)); const c = common(kw, line);
      a.series.push(Object.assign({ kind: 'quiver', x: X, y: Y, u: U, v: V, scale: kw.scale != null ? +kw.scale : null }, c, { color: c.color || nextColor() })); return null;
    },
    contour: (args, kw, line) => { throw new PyError('contour() is not available in Musubi plots yet. Plot level curves with plot(), or use a heat map in a note image.', line); },
    contourf: (args, kw, line) => { throw new PyError('contourf() is not available in Musubi plots yet.', line); },
    imshow: (args, kw, line) => { throw new PyError('imshow() is not available in Musubi plots.', line); },
    pie: (args, kw, line) => { throw new PyError('pie() is not available in Musubi plots. A bar chart shows the same numbers more clearly.', line); },
  };
  return M;
}

/* ---------- rendering to SVG ---------- */
function niceTicks(lo, hi, target = 6) {
  if (!(hi > lo)) { const d = Math.abs(lo) || 1; lo -= d * 0.5; hi += d * 0.5; }
  const raw = (hi - lo) / target; const mag = 10 ** Math.floor(Math.log10(raw)); const f = raw / mag;
  const step = (f < 1.5 ? 1 : f < 3 ? 2 : f < 7 ? 5 : 10) * mag;
  const out = []; for (let v = Math.ceil(lo / step - 1e-9) * step; v <= hi + step * 1e-9; v += step) out.push(Math.abs(v) < step * 1e-9 ? 0 : v);
  return { ticks: out, step };
}
function fmtTick(v, step) {
  if (v === 0) return '0';
  const a = Math.abs(v);
  if (a >= 1e5 || a < 1e-3) return v.toExponential(Math.max(0, Math.min(3, -Math.floor(Math.log10(step)) + Math.floor(Math.log10(a))))).replace(/\.?0+e/, 'e').replace('e+', 'e');
  const dec = Math.max(0, -Math.floor(Math.log10(step) + 1e-9));
  return v.toFixed(Math.min(dec, 6)).replace(/^-/, '−');
}
function labelHtml(s) {
  // matplotlib mathtext: $…$ segments become KaTeX
  const parts = String(s).split(/(\$[^$]+\$)/);
  return parts.map((p) => (/^\$[^$]+\$$/.test(p) ? texToHtml(p.slice(1, -1), false, Object.assign({}, baseMacros), true) : esc(p))).join('');
}
const svgEsc = (s) => esc(String(s));

function renderFigure(fig) {
  const W = Math.round(Math.max(3, Math.min(14, fig.w)) * 100); const H = Math.round(Math.max(2, Math.min(16, fig.h)) * 100);
  const sup = fig.suptitle ? 28 : 0;
  const fsz = (14 * Math.max(1, W / 700)).toFixed(1);
  const parts = []; const overlays = [];
  const pct = (v, d) => (100 * v / d).toFixed(3) + '%';
  const rows = Math.max(fig.rows, ...fig.axes.map((x) => x.row + 1)); const cols = Math.max(fig.cols, ...fig.axes.map((x) => x.col + 1));
  const cw = W / cols; const ch = (H - sup) / rows;
  if (fig.suptitle) overlays.push(`<div class="plot-lab plot-suptitle" style="left:50%;top:${pct(4, H)};transform:translateX(-50%)">${labelHtml(fig.suptitle)}</div>`);
  for (const a of fig.axes) {
    const ox = a.col * cw; const oy = sup + a.row * ch;
    const ml = 58 + (a.ylabel ? 18 : 0); const mr = 14; const mt = a.title ? 32 : 14; const mb = 36 + (a.xlabel ? 20 : 0);
    let px = ox + ml; let py = oy + mt; let pw = cw - ml - mr; let ph = ch - mt - mb;
    // data ranges
    let xs = []; let ys = [];
    for (const s of a.series) {
      if (s.kind === 'bar') { s.x.forEach((x, i) => { xs.push(x - s.w[i] / 2, x + s.w[i] / 2); ys.push(s.bottom[i], s.bottom[i] + s.h[i]); }); }
      else if (s.kind === 'barh') { s.y.forEach((y, i) => { ys.push(y - s.h[i] / 2, y + s.h[i] / 2); xs.push(s.left[i], s.left[i] + s.wd[i]); }); }
      else if (s.kind === 'fill') { pushAll(xs, s.x); pushAll(ys, s.y1); pushAll(ys, s.y2); }
      else if (s.kind === 'errorbar') { s.x.forEach((x, i) => { const dx = s.xerr ? s.xerr[i] : 0; const dy = s.yerr ? s.yerr[i] : 0; xs.push(x - dx, x + dx); ys.push(s.y[i] - dy, s.y[i] + dy); }); }
      else if (s.kind === 'stem') { pushAll(xs, s.x); pushAll(ys, s.y); ys.push(0); }
      else if (s.kind === 'quiver') { s.x.forEach((x, i) => { xs.push(x, x + s.u[i] * 0.1); ys.push(s.y[i], s.y[i] + s.v[i] * 0.1); }); }
      else { pushAll(xs, s.x); pushAll(ys, s.y); }
    }
    for (const sp of a.spans) { if (sp.kind === 'h') ys.push(sp.v); if (sp.kind === 'v') xs.push(sp.v); if (sp.kind === 'hs') ys.push(sp.a, sp.b); if (sp.kind === 'vs') xs.push(sp.a, sp.b); }
    for (const t of a.texts) if (!t.transform) { xs.push(t.x); ys.push(t.y); if (t.arrow) { xs.push(t.arrow.x); ys.push(t.arrow.y); } }
    const logx = a.xscale === 'log'; const logy = a.yscale === 'log';
    xs = xs.filter((v) => Number.isFinite(v) && (!logx || v > 0)); ys = ys.filter((v) => Number.isFinite(v) && (!logy || v > 0));
    const range = (vals, log, lim, hasBars) => {
      let lo = vals.length ? arrMin(vals) : 0; let hi = vals.length ? arrMax(vals) : 1;
      if (log) { lo = Math.log10(lo || 1); hi = Math.log10(hi || 10); }
      if (hi === lo) { lo -= 0.5; hi += 0.5; }
      const pad = (hi - lo) * 0.05; if (!hasBars || lo < 0) lo -= pad; hi += pad; if (hasBars && lo >= 0 && !log) lo = Math.min(lo, 0);
      if (lim) { if (lim[0] != null) lo = log ? Math.log10(lim[0]) : lim[0]; if (lim[1] != null) hi = log ? Math.log10(lim[1]) : lim[1]; }
      return [lo, hi];
    };
    const bars = a.series.some((s) => s.kind === 'bar');
    let [x0, x1] = range(xs, logx, a.xlim, a.series.some((s) => s.kind === 'barh'));
    let [y0, y1] = range(ys, logy, a.ylim, bars || a.series.some((s) => s.kind === 'stem'));
    if (a.aspect === 'equal' && !logx && !logy) {
      const sx = pw / (x1 - x0); const sy = ph / (y1 - y0);
      if (sx > sy) { const nw = (x1 - x0) * sy; px += (pw - nw) / 2; pw = nw; } else { const nh = (y1 - y0) * sx; py += (ph - nh) / 2; ph = nh; }
    }
    const X = (v) => { const t = ((logx ? Math.log10(v) : v) - x0) / (x1 - x0); return px + (a.invertX ? 1 - t : t) * pw; };
    const Y = (v) => { const t = ((logy ? Math.log10(v) : v) - y0) / (y1 - y0); return py + (a.invertY ? t : 1 - t) * ph; };
    const ok = (x, y) => Number.isFinite(x) && Number.isFinite(y) && (!logx || x > 0) && (!logy || y > 0);
    const clipId = 'pc' + Math.random().toString(36).slice(2, 9);
    parts.push(`<defs><clipPath id="${clipId}"><rect x="${px.toFixed(1)}" y="${py.toFixed(1)}" width="${pw.toFixed(1)}" height="${ph.toFixed(1)}"/></clipPath></defs>`);
    // ticks
    const tickList = (lo, hi, log, given, labels) => {
      if (given) return given.map((v, i) => ({ v, l: labels ? labels[i] || '' : fmtTick(v, Math.abs(given[1] - given[0]) || 1) }));
      if (log) { const out = []; for (let k = Math.ceil(lo - 1e-9); k <= Math.floor(hi + 1e-9); k++) out.push({ v: 10 ** k, l: `10^{${k}}`, tex: true }); return out; }
      const { ticks, step } = niceTicks(lo, hi, Math.max(3, Math.round((log ? 6 : 6) * Math.min(1, pw / 420))));
      return ticks.map((v) => ({ v, l: fmtTick(v, step) }));
    };
    const xt = tickList(x0, x1, logx, a.xticks, a.xticklabels).filter((t) => { const p = X(t.v); return p >= px - 0.5 && p <= px + pw + 0.5; });
    const yt = tickList(y0, y1, logy, a.yticks, a.yticklabels).filter((t) => { const p = Y(t.v); return p >= py - 0.5 && p <= py + ph + 0.5; });
    if (!a.off) {
      if (a.grid) {
        for (const t of xt) parts.push(`<line class="plot-grid" x1="${X(t.v).toFixed(1)}" y1="${py}" x2="${X(t.v).toFixed(1)}" y2="${(py + ph).toFixed(1)}"/>`);
        for (const t of yt) parts.push(`<line class="plot-grid" x1="${px}" y1="${Y(t.v).toFixed(1)}" x2="${(px + pw).toFixed(1)}" y2="${Y(t.v).toFixed(1)}"/>`);
      }
      parts.push(`<path class="plot-axis" d="M${px},${py}V${(py + ph).toFixed(1)}H${(px + pw).toFixed(1)}"/>`);
      for (const t of xt) {
        const xp = X(t.v); parts.push(`<line class="plot-tick" x1="${xp.toFixed(1)}" y1="${py + ph}" x2="${xp.toFixed(1)}" y2="${py + ph + 5}"/>`);
        if (t.tex) overlays.push(`<div class="plot-lab plot-tl" style="left:${pct(xp, W)};top:${pct(py + ph + 8, H)};transform:translateX(-50%)">${texToHtml(t.l, false, {}, true)}</div>`);
        else parts.push(`<text class="plot-ticklabel" x="${xp.toFixed(1)}" y="${(py + ph + 20).toFixed(1)}" text-anchor="middle" font-size="${fsz}">${svgEsc(t.l)}</text>`);
      }
      for (const t of yt) {
        const yp = Y(t.v); parts.push(`<line class="plot-tick" x1="${px - 5}" y1="${yp.toFixed(1)}" x2="${px}" y2="${yp.toFixed(1)}"/>`);
        if (t.tex) overlays.push(`<div class="plot-lab plot-tl" style="right:${pct(W - px + 8, W)};top:${pct(yp, H)};transform:translateY(-50%)">${texToHtml(t.l, false, {}, true)}</div>`);
        else parts.push(`<text class="plot-ticklabel" x="${px - 8}" y="${(yp + 4.5).toFixed(1)}" text-anchor="end" font-size="${fsz}">${svgEsc(t.l)}</text>`);
      }
    }
    // spans
    const dash = (ls, lw) => { const s = String(ls || '-'); const k = Math.max(1, lw); return s === '--' || s === 'dashed' ? `stroke-dasharray="${6 * k} ${4 * k}"` : s === ':' || s === 'dotted' ? `stroke-dasharray="${1.2 * k} ${2.6 * k}" stroke-linecap="round"` : s === '-.' || s === 'dashdot' ? `stroke-dasharray="${6 * k} ${3 * k} ${1.2 * k} ${3 * k}"` : ''; };
    const body = [];
    for (const sp of a.spans) {
      const st = `stroke="${sp.color}" stroke-width="${sp.lw}" ${dash(sp.ls, sp.lw)} opacity="${sp.alpha}"`;
      if (sp.kind === 'h') body.push(`<line x1="${px}" x2="${px + pw}" y1="${Y(sp.v).toFixed(1)}" y2="${Y(sp.v).toFixed(1)}" ${st}/>`);
      if (sp.kind === 'v') body.push(`<line y1="${py}" y2="${py + ph}" x1="${X(sp.v).toFixed(1)}" x2="${X(sp.v).toFixed(1)}" ${st}/>`);
      if (sp.kind === 'hs') body.push(`<rect x="${px}" width="${pw}" y="${Math.min(Y(sp.a), Y(sp.b)).toFixed(1)}" height="${Math.abs(Y(sp.a) - Y(sp.b)).toFixed(1)}" fill="${sp.color}" fill-opacity="${sp.alpha}"/>`);
      if (sp.kind === 'vs') body.push(`<rect y="${py}" height="${ph}" x="${Math.min(X(sp.a), X(sp.b)).toFixed(1)}" width="${Math.abs(X(sp.a) - X(sp.b)).toFixed(1)}" fill="${sp.color}" fill-opacity="${sp.alpha}"/>`);
    }
    const marker = (m, x, y, r, color) => {
      const f = `fill="${color}"`;
      switch (m) {
        case 's': return `<rect x="${(x - r).toFixed(1)}" y="${(y - r).toFixed(1)}" width="${(2 * r).toFixed(1)}" height="${(2 * r).toFixed(1)}" ${f}/>`;
        case '^': return `<path d="M${x.toFixed(1)},${(y - r * 1.2).toFixed(1)}L${(x + r * 1.1).toFixed(1)},${(y + r * 0.8).toFixed(1)}H${(x - r * 1.1).toFixed(1)}Z" ${f}/>`;
        case 'v': return `<path d="M${x.toFixed(1)},${(y + r * 1.2).toFixed(1)}L${(x + r * 1.1).toFixed(1)},${(y - r * 0.8).toFixed(1)}H${(x - r * 1.1).toFixed(1)}Z" ${f}/>`;
        case 'D': case 'd': return `<path d="M${x.toFixed(1)},${(y - r * 1.25).toFixed(1)}L${(x + r).toFixed(1)},${y.toFixed(1)}L${x.toFixed(1)},${(y + r * 1.25).toFixed(1)}L${(x - r).toFixed(1)},${y.toFixed(1)}Z" ${f}/>`;
        case 'x': case 'X': return `<path d="M${x - r},${y - r}L${x + r},${y + r}M${x + r},${y - r}L${x - r},${y + r}" stroke="${color}" stroke-width="1.5"/>`;
        case '+': case 'P': return `<path d="M${x - r},${y}H${x + r}M${x},${y - r}V${y + r}" stroke="${color}" stroke-width="1.5"/>`;
        case '*': return `<path d="M${x},${y - r * 1.3}L${x + r * 0.38},${y - r * 0.4}L${x + r * 1.25},${y - r * 0.4}L${x + r * 0.55},${y + r * 0.15}L${x + r * 0.8},${y + r * 1.05}L${x},${y + r * 0.5}L${x - r * 0.8},${y + r * 1.05}L${x - r * 0.55},${y + r * 0.15}L${x - r * 1.25},${y - r * 0.4}L${x - r * 0.38},${y - r * 0.4}Z" ${f}/>`;
        case '.': return `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${(r * 0.5).toFixed(1)}" ${f}/>`;
        case ',': return `<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="1" height="1" ${f}/>`;
        default: return `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${r.toFixed(1)}" ${f}/>`;
      }
    };
    const pathOf = (xsA, ysA, step) => {
      if (!step && xsA.length > 3000) [xsA, ysA] = decimate(xsA, ysA, X);
      let d = ''; let pen = false;
      for (let i = 0; i < xsA.length; i++) {
        if (!ok(xsA[i], ysA[i])) { pen = false; continue; }
        const x = X(xsA[i]); const y = Y(ysA[i]);
        if (Math.abs(y) > 1e6 || Math.abs(x) > 1e6) { pen = false; continue; }
        if (!pen) { d += `M${x.toFixed(2)},${y.toFixed(2)}`; pen = true; }
        else if (step === 'pre') d += `V${y.toFixed(2)}H${x.toFixed(2)}`;
        else if (step === 'post') d += `H${x.toFixed(2)}V${y.toFixed(2)}`;
        else if (step === 'mid') { const xm = (X(xsA[i - 1]) + x) / 2; d += `H${xm.toFixed(2)}V${y.toFixed(2)}H${x.toFixed(2)}`; }
        else d += `L${x.toFixed(2)},${y.toFixed(2)}`;
      }
      return d;
    };
    const ordered = a.series.slice().sort((p, q) => p.zorder - q.zorder);
    for (const s of ordered) {
      const op = s.alpha;
      if (s.kind === 'line') {
        if (s.ls !== 'none' && s.ls !== '' && s.ls !== 'None') body.push(`<path d="${pathOf(s.x, s.y, s.step)}" fill="none" stroke="${s.color}" stroke-width="${s.lw}" stroke-linejoin="round" ${dash(s.ls, s.lw)} opacity="${op}"/>`);
        if (s.marker && s.marker !== 'None') { const r = Math.max(1, s.ms / 2); s.x.forEach((x, i) => { if (ok(x, s.y[i])) body.push(marker(s.marker, X(x), Y(s.y[i]), r, s.color).replace('/>', ` opacity="${op}"/>`)); }); }
      } else if (s.kind === 'scatter') {
        const cv = s.cvals; let lo = 0; let hi = 1; if (cv) { lo = arrMin(cv); hi = arrMax(cv); }
        s.x.forEach((x, i) => {
          if (!ok(x, s.y[i])) return;
          const area = Array.isArray(s.s) ? s.s[i % s.s.length] : s.s; const r = Math.max(1, Math.sqrt(area) / 2 * 0.9);
          const col = cv ? `color-mix(in srgb, var(--ist-slate) ${((1 - (cv[i] - lo) / ((hi - lo) || 1)) * 100).toFixed(0)}%, var(--ist-gold))` : s.color;
          body.push(marker(s.marker, X(x), Y(s.y[i]), r, col).replace('/>', ` opacity="${op}"/>`));
        });
      } else if (s.kind === 'bar') {
        if (s.stepOnly) { let d = ''; s.x.forEach((x, i) => { const l = X(x - s.w[i] / 2); const r = X(x + s.w[i] / 2); const t = Y(s.h[i]); d += (i ? `V${t.toFixed(1)}` : `M${l.toFixed(1)},${Y(0).toFixed(1)}V${t.toFixed(1)}`) + `H${r.toFixed(1)}`; }); d += `V${Y(0).toFixed(1)}`; body.push(`<path d="${d}" fill="none" stroke="${s.color}" stroke-width="${s.lw}"/>`); continue; }
        s.x.forEach((x, i) => {
          const l = X(x - s.w[i] / 2); const r = X(x + s.w[i] / 2); const t = Y(s.bottom[i] + s.h[i]); const b = Y(logy ? Math.max(s.bottom[i], 10 ** y0) : s.bottom[i]);
          if (![l, r, t, b].every(Number.isFinite)) return;
          body.push(`<rect x="${Math.min(l, r).toFixed(1)}" y="${Math.min(t, b).toFixed(1)}" width="${Math.max(0.5, Math.abs(r - l)).toFixed(1)}" height="${Math.abs(b - t).toFixed(1)}" fill="${s.color}" fill-opacity="${op}"${s.edge ? ` stroke="${s.edge}" stroke-width="${s.hist ? 0.8 : 1}"` : ''}/>`);
        });
      } else if (s.kind === 'barh') {
        s.y.forEach((y, i) => { const t = Y(y + s.h[i] / 2); const b = Y(y - s.h[i] / 2); const l = X(s.left[i]); const r = X(s.left[i] + s.wd[i]); body.push(`<rect x="${Math.min(l, r).toFixed(1)}" y="${Math.min(t, b).toFixed(1)}" width="${Math.abs(r - l).toFixed(1)}" height="${Math.abs(b - t).toFixed(1)}" fill="${s.color}" fill-opacity="${op}"/>`); });
      } else if (s.kind === 'fill') {
        let segs = [[]];
        s.x.forEach((x, i) => { const keep = !s.where || s.where[i]; if (keep && ok(x, s.y1[i]) && ok(x, s.y2[i])) segs[segs.length - 1].push(i); else if (segs[segs.length - 1].length) segs.push([]); });
        for (const seg of segs) {
          if (seg.length < 2) continue;
          const top = seg.map((i) => `${X(s.x[i]).toFixed(2)},${Y(s.y1[i]).toFixed(2)}`); const bot = seg.slice().reverse().map((i) => `${X(s.x[i]).toFixed(2)},${Y(s.y2[i]).toFixed(2)}`);
          body.push(`<path d="M${top.join('L')}L${bot.join('L')}Z" fill="${s.color}" fill-opacity="${op}" stroke="none"/>`);
        }
      } else if (s.kind === 'poly') {
        body.push(`<path d="M${s.x.map((x, i) => `${X(x).toFixed(2)},${Y(s.y[i]).toFixed(2)}`).join('L')}Z" fill="${s.color}" fill-opacity="${op}" stroke="${s.color}" stroke-width="1"/>`);
      } else if (s.kind === 'errorbar') {
        const cap = s.capsize;
        s.x.forEach((x, i) => {
          const y = s.y[i]; if (!ok(x, y)) return; const xp = X(x); const yp = Y(y);
          if (s.yerr) { const a1 = Y(y - s.yerr[i]); const a2 = Y(y + s.yerr[i]); body.push(`<path d="M${xp.toFixed(1)},${a1.toFixed(1)}V${a2.toFixed(1)}${cap ? `M${(xp - cap).toFixed(1)},${a1.toFixed(1)}h${2 * cap}M${(xp - cap).toFixed(1)},${a2.toFixed(1)}h${2 * cap}` : ''}" stroke="${s.color}" stroke-width="1.2" fill="none" opacity="${op}"/>`); }
          if (s.xerr) { const b1 = X(x - s.xerr[i]); const b2 = X(x + s.xerr[i]); body.push(`<path d="M${b1.toFixed(1)},${yp.toFixed(1)}H${b2.toFixed(1)}${cap ? `M${b1.toFixed(1)},${(yp - cap).toFixed(1)}v${2 * cap}M${b2.toFixed(1)},${(yp - cap).toFixed(1)}v${2 * cap}` : ''}" stroke="${s.color}" stroke-width="1.2" fill="none" opacity="${op}"/>`); }
        });
        if (s.ls !== 'none' && s.ls !== '') body.push(`<path d="${pathOf(s.x, s.y)}" fill="none" stroke="${s.color}" stroke-width="${s.lw}" ${dash(s.ls, s.lw)} opacity="${op}"/>`);
        if (s.marker) s.x.forEach((x, i) => { if (ok(x, s.y[i])) body.push(marker(s.marker, X(x), Y(s.y[i]), Math.max(1, s.ms / 2), s.color)); });
      } else if (s.kind === 'stem') {
        s.x.forEach((x, i) => { if (!ok(x, s.y[i])) return; body.push(`<line x1="${X(x).toFixed(1)}" x2="${X(x).toFixed(1)}" y1="${Y(0).toFixed(1)}" y2="${Y(s.y[i]).toFixed(1)}" stroke="${s.color}" stroke-width="1.2"/>`, marker('o', X(x), Y(s.y[i]), 3.2, s.color)); });
        body.push(`<line x1="${px}" x2="${px + pw}" y1="${Y(0).toFixed(1)}" y2="${Y(0).toFixed(1)}" stroke="var(--ist-text-muted)" stroke-width="1"/>`);
      } else if (s.kind === 'quiver') {
        const mags = s.u.map((u, i) => Math.hypot(u, s.v[i])); const maxm = arrMax(mags) || 1;
        const span = Math.min(pw, ph) / Math.max(4, Math.sqrt(s.x.length)) * 0.9; const k = s.scale ? 1 / s.scale : span / maxm;
        s.x.forEach((x, i) => {
          const x0p = X(x); const y0p = Y(s.y[i]); const dx = s.u[i] * k; const dy = -s.v[i] * k; const len = Math.hypot(dx, dy); if (len < 0.5) return;
          const ux = dx / len; const uy = dy / len; const hx = x0p + dx; const hy = y0p + dy; const hs = Math.min(5, len * 0.4);
          body.push(`<path d="M${x0p.toFixed(1)},${y0p.toFixed(1)}L${hx.toFixed(1)},${hy.toFixed(1)}M${(hx - ux * hs - uy * hs * 0.6).toFixed(1)},${(hy - uy * hs + ux * hs * 0.6).toFixed(1)}L${hx.toFixed(1)},${hy.toFixed(1)}L${(hx - ux * hs + uy * hs * 0.6).toFixed(1)},${(hy - uy * hs - ux * hs * 0.6).toFixed(1)}" stroke="${s.color}" stroke-width="1.2" fill="none" opacity="${s.alpha}"/>`);
        });
      }
    }
    parts.push(`<g clip-path="url(#${clipId})">${body.join('')}</g>`);
    // texts and annotations
    for (const t of a.texts) {
      const xp = t.transform ? px + t.x * pw : X(t.x); const yp = t.transform ? py + (1 - t.y) * ph : Y(t.y);
      if (!Number.isFinite(xp) || !Number.isFinite(yp)) continue;
      if (t.arrow) { const ax2 = X(t.arrow.x); const ay2 = Y(t.arrow.y); const dx = ax2 - xp; const dy = ay2 - yp; const L = Math.hypot(dx, dy) || 1; const ux = dx / L; const uy = dy / L; parts.push(`<path d="M${xp.toFixed(1)},${yp.toFixed(1)}L${ax2.toFixed(1)},${ay2.toFixed(1)}M${(ax2 - ux * 7 - uy * 4).toFixed(1)},${(ay2 - uy * 7 + ux * 4).toFixed(1)}L${ax2.toFixed(1)},${ay2.toFixed(1)}L${(ax2 - ux * 7 + uy * 4).toFixed(1)},${(ay2 - uy * 7 - ux * 4).toFixed(1)}" stroke="var(--ist-text-muted)" stroke-width="1" fill="none"/>`); }
      const tx = t.ha === 'center' ? '-50%' : t.ha === 'right' ? '-100%' : '0'; const ty = t.va === 'center' ? '-50%' : t.va === 'top' ? '0' : t.va === 'bottom' ? '-100%' : '-80%';
      overlays.push(`<div class="plot-lab plot-text" style="left:${pct(xp, W)};top:${pct(yp, H)};transform:translate(${tx},${ty});${t.color ? `color:${t.color};` : ''}${t.size ? `font-size:${Math.max(8, Math.min(28, +t.size || 12)) / 12}em;` : ''}">${labelHtml(t.s)}</div>`);
    }
    if (a.title) overlays.push(`<div class="plot-lab plot-title" style="left:${pct(px + pw / 2, W)};top:${pct(oy + 6, H)};transform:translateX(-50%)">${labelHtml(a.title)}</div>`);
    if (a.xlabel) overlays.push(`<div class="plot-lab plot-xlabel" style="left:${pct(px + pw / 2, W)};top:${pct(py + ph + 28, H)};transform:translateX(-50%)">${labelHtml(a.xlabel)}</div>`);
    if (a.ylabel) overlays.push(`<div class="plot-lab plot-ylabel" style="left:${pct(ox + 4, W)};top:${pct(py + ph / 2, H)};transform:translate(-50%,-50%) rotate(-90deg) translateY(50%)">${labelHtml(a.ylabel)}</div>`);
    // legend
    const labelled = a.series.filter((s) => s.label && !s.label.startsWith('_')).concat(a.spans.filter((s) => s.label));
    if (a.legend) {
      const items = a.legend && a.legend.labels ? a.series.map((s, i) => Object.assign({}, s, { label: a.legend.labels[i] })).filter((s) => s.label) : labelled;
      if (items.length) {
        let loc = String(a.legend.loc || 'best');
        if (loc === 'best') {
          const cnt = { 'upper right': 0, 'upper left': 0, 'lower left': 0, 'lower right': 0 };
          for (const s of a.series) (s.x || []).forEach((x, i) => { const yv = s.y ? s.y[i] : s.h ? s.h[i] : null; if (yv == null || !ok(x, yv)) return; const fx = (X(x) - px) / pw; const fy = (Y(yv) - py) / ph; if (fy < 0.45 && fx > 0.55) cnt['upper right']++; if (fy < 0.45 && fx < 0.45) cnt['upper left']++; if (fy > 0.55 && fx < 0.45) cnt['lower left']++; if (fy > 0.55 && fx > 0.55) cnt['lower right']++; });
          loc = Object.keys(cnt).sort((p, q) => cnt[p] - cnt[q] || ['upper right', 'upper left', 'lower left', 'lower right'].indexOf(p) - ['upper right', 'upper left', 'lower left', 'lower right'].indexOf(q))[0];
        }
        const top = /upper/.test(loc) ? `top:${pct(py + 8, H)}` : /lower/.test(loc) ? `bottom:${pct(H - py - ph + 8, H)}` : `top:${pct(py + ph / 2, H)}`;
        const side = /right/.test(loc) ? `right:${pct(W - px - pw + 8, W)}` : /left/.test(loc) ? `left:${pct(px + 8, W)}` : `left:${pct(px + pw / 2, W)}`;
        const tf = (/center/.test(loc) && !/(left|right)/.test(loc) ? 'translateX(-50%)' : '') + (loc === 'center' || /^center (left|right)$/.test(loc) || loc === 'right' ? ' translateY(-50%)' : '');
        const sw = (s) => s.kind === 'bar' || s.kind === 'barh' || s.kind === 'fill' || s.kind === 'hs' || s.kind === 'vs' || s.kind === 'poly'
          ? `<span class="plot-sw plot-sw-box" style="background:${s.color};opacity:${Math.max(0.35, s.alpha)}"></span>`
          : s.kind === 'scatter' || ((s.kind === 'line' || s.kind === 'errorbar') && (s.ls === 'none' || s.ls === '')) ? `<span class="plot-sw plot-sw-dot" style="background:${s.color}"></span>`
          : `<span class="plot-sw plot-sw-line" style="border-top:${Math.max(1.5, s.lw)}px ${String(s.ls) === '--' ? 'dashed' : String(s.ls) === ':' ? 'dotted' : 'solid'} ${s.color}"></span>`;
        overlays.push(`<div class="plot-legend" style="${top};${side};transform:${tf || 'none'}">${a.legend.title ? `<div class="plot-legend-title">${labelHtml(a.legend.title)}</div>` : ''}${items.map((s) => `<div class="plot-legend-item">${sw(s)}<span>${labelHtml(s.label)}</span></div>`).join('')}</div>`);
      }
    }
  }
  return `<div class="plot-fig" style="aspect-ratio:${W}/${H};max-width:${Math.round(W * 1.1)}px"><svg class="plot-svg" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid meet" role="img" aria-label="Plot">${parts.join('')}</svg>${overlays.join('')}</div>`;
}

/* Thin a long line to the first, lowest, highest and last point of each half-pixel column. The drawn shape stays the same. */
function decimate(xs, ys, X) {
  const ox = []; const oy = []; let key = null; let b = null;
  const flush = () => { if (!b) return; const pts = [[b.fi, b.fy], [b.mini, b.miny], [b.maxi, b.maxy], [b.li, b.ly]].sort((p, q) => p[0] - q[0]); let last = -1; for (const [i] of pts) { if (i === last) continue; last = i; ox.push(xs[i]); oy.push(ys[i]); } };
  for (let i = 0; i < xs.length; i++) {
    const y = ys[i];
    if (!Number.isFinite(y) || !Number.isFinite(xs[i])) { flush(); b = null; key = null; ox.push(xs[i]); oy.push(NaN); continue; }
    const k = Math.round(X(xs[i]) * 2);
    if (k !== key) { flush(); key = k; b = { fi: i, fy: y, mini: i, miny: y, maxi: i, maxy: y, li: i, ly: y }; continue; }
    if (y < b.miny) { b.miny = y; b.mini = i; } if (y > b.maxy) { b.maxy = y; b.maxi = i; } b.li = i; b.ly = y;
  }
  flush();
  return [ox, oy];
}

/* Run a plot block and return its HTML. Results are cached by source. */
const plotCache = new Map();
function plotHtml(src) {
  const key = src + '\u0000' + (typeof app !== 'undefined' && app.settings ? (app.settings.theme || '') : '');
  if (plotCache.has(key)) return plotCache.get(key);
  if (!PY_BUILTINS.size) defBuiltins();
  const ctx = { out: [], figures: [], rng: mulberry32(1), steps: 0 };
  let html;
  const prev = PLOT_CTX; PLOT_CTX = ctx;
  try {
    pyRun(src, ctx);
    const figs = (ctx.figures || []).filter((f) => f.axes.length);
    html = figs.map(renderFigure).join('') || '<div class="plot-empty">The code ran but drew nothing. Call plt.plot(), plt.scatter(), plt.bar() or plt.hist().</div>';
    if (ctx.out.length) html += `<pre class="plot-out">${esc(ctx.out.join('\n').slice(0, 4000))}</pre>`;
  } catch (e) {
    const line = e.pyLine; const srcLine = line ? String(src).split('\n')[line - 1] : '';
    html = `<div class="plot-error"><b>Plot error${line ? ' on line ' + line : ''}:</b> ${esc(e instanceof PyError ? e.message : 'internal error: ' + e.message)}${srcLine ? `<pre>${esc(srcLine.trim())}</pre>` : ''}<div class="plot-help">Musubi runs a part of Python offline: numpy as np, math, and matplotlib.pyplot as plt (plot, scatter, bar, hist, fill_between, errorbar, axhline, text, legend, subplots, labels with $…$).</div></div>`;
    if (!(e instanceof PyError)) console.warn('[musubi] plot', e);
  } finally { PLOT_CTX = prev; }
  if (plotCache.size > 120) plotCache.clear();
  plotCache.set(key, html);
  return html;
}

/* A fence is a plot when its info string is "plot", "matplotlib", "pyplot", or "python plot". */
function isPlotFence(info) {
  const w = String(info || '').trim().toLowerCase().split(/[\s{},]+/).filter(Boolean);
  if (!w.length) return false;
  if (['plot', 'matplotlib', 'pyplot'].includes(w[0])) return true;
  return (w[0] === 'python' || w[0] === 'py' || w[0] === 'python3') && w.includes('plot');
}
function plotBlockHtml(code, withCode) {
  return `<figure class="plot" data-plot="1">${plotHtml(code)}${withCode ? `<details class="plot-code"><summary>Python</summary><pre><code>${esc(code)}</code></pre></details>` : ''}</figure>`;
}
