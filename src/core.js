/* Musubi core: utilities, note model, analysis, storage, archive formats.
   Licensed under the MIT License. See LICENSE. */
'use strict';

/* ---------- small utilities ---------- */
const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
const ESC_MAP = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ESC_MAP[c]);

function h(tag, attrs, ...kids) {
  const el = document.createElement(tag);
  if (attrs) {
    for (const k in attrs) {
      const v = attrs[k];
      if (v == null || v === false) continue;
      if (k === 'class') el.className = v;
      else if (k === 'html') el.innerHTML = v;
      else if (k === 'text') el.textContent = v;
      else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2), v);
      else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
      else if (k === 'dataset') Object.assign(el.dataset, v);
      else el.setAttribute(k, v === true ? '' : v);
    }
  }
  for (const kid of kids.flat(Infinity)) {
    if (kid == null || kid === false) continue;
    el.appendChild(typeof kid === 'string' || typeof kid === 'number' ? document.createTextNode(String(kid)) : kid);
  }
  return el;
}

function debounce(fn, ms) {
  let t = null;
  const d = (...a) => { clearTimeout(t); t = setTimeout(() => { t = null; fn(...a); }, ms); };
  d.flush = (...a) => { if (t) { clearTimeout(t); t = null; fn(...a); } };
  d.cancel = () => { clearTimeout(t); t = null; };
  return d;
}

function slugify(s) {
  return String(s || '').normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-+|-+$/g, '').slice(0, 80) || 'section';
}

function normTitle(s) {
  return String(s || '').normalize('NFKC').toLowerCase()
    .replace(/[‐-―−]/g, '-').replace(/[‘’]/g, "'").replace(/[“”]/g, '"')
    .replace(/\s+/g, ' ').trim();
}

/* cyrb53: fast, well-distributed 53-bit string hash */
function hashStr(str, seed = 0) {
  let h1 = 0xdeadbeef ^ seed, h2 = 0x41c6ce57 ^ seed;
  for (let i = 0; i < str.length; i++) {
    const ch = str.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(36);
}

const pad2 = (n) => String(n).padStart(2, '0');
function isoLocal(d = new Date()) {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}T${pad2(d.getHours())}:${pad2(d.getMinutes())}:${pad2(d.getSeconds())}`;
}
function parseDate(s) {
  if (!s) return 0;
  const t = Date.parse(s);
  return isNaN(t) ? 0 : t;
}
function relTime(ms) {
  if (!ms) return '';
  const s = (Date.now() - ms) / 1000;
  if (s < 45) return 'just now';
  if (s < 3600) return Math.round(s / 60) + ' min ago';
  if (s < 86400) return Math.round(s / 3600) + ' h ago';
  if (s < 86400 * 30) return Math.round(s / 86400) + ' d ago';
  const d = new Date(ms);
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

/* ---------- note vocabulary ---------- */
const NOTE_TYPES = [
  ['concept', 'Concept'], ['definition', 'Definition'], ['theorem', 'Theorem'], ['proof', 'Proof'],
  ['example', 'Example'], ['derivation', 'Derivation'], ['law', 'Law / principle'],
  ['argument', 'Argument'], ['objection', 'Objection'], ['position', 'Position'],
  ['question', 'Question'], ['literature', 'Literature'], ['person', 'Person'], ['structure', 'Structure note'],
];
const TYPE_IDS = NOTE_TYPES.map((t) => t[0]);
/* Families decide the marker shape; pigments come from the Istari palette. */
const TYPE_FAMILIES = [
  ['general', 'General', 'circle', ['concept', 'question', 'literature', 'person', 'structure']],
  ['mathematics', 'Mathematics', 'diamond', ['definition', 'theorem', 'proof', 'example']],
  ['physics', 'Physics', 'square', ['law', 'derivation']],
  ['philosophy', 'Philosophy', 'triangle', ['argument', 'objection', 'position']],
];
const TYPE_SHAPE = {};
for (const [, , shape, ids] of TYPE_FAMILIES) for (const id of ids) TYPE_SHAPE[id] = shape;
const TYPE_LABEL = Object.fromEntries(NOTE_TYPES);
TYPE_SHAPE.structure = 'ring';

/* ---------- note types made by the user ----------
   A custom type is { id, label, shape, color }: one of TYPE_SHAPES and one of the Istari pigments.
   A pigment is drawn as var(--pg-<name>): every theme maps the 13 pigments to its own colours (tools/pigments.py).
   The id is fixed when the type is made (it is what notes store in front matter); the label can change. */
const TYPE_SHAPES = [['circle', 'Circle'], ['ring', 'Ring'], ['square', 'Square'], ['diamond', 'Diamond'], ['triangle', 'Triangle'], ['star', 'Star'], ['moon', 'Moon'], ['sun', 'Sun']];
const ISTARI_PIGMENTS = [
  ['gold', 'Gold', '#c4a24d'], ['ochre', 'Ochre', '#c7844f'], ['vermilion', 'Vermilion', '#be6052'], ['oxblood', 'Oxblood', '#9a4a3e'],
  ['rose', 'Rose', '#b87884'], ['plum', 'Plum', '#a07f98'], ['slate', 'Slate', '#7f93b4'], ['sky', 'Sky', '#829eb6'],
  ['verdigris', 'Verdigris', '#6d9a90'], ['moss', 'Moss', '#8a9a62'], ['parchment', 'Parchment', '#c8b79a'], ['bone', 'Bone', '#ebe1c8'], ['ash', 'Ash', '#948b76'],
];
const PIGMENT = Object.fromEntries(ISTARI_PIGMENTS.map(([k, , c]) => [k, c]));
const pigmentVar = (k) => 'var(--pg-' + (PIGMENT[k] ? k : 'ash') + ')';
const BUILTIN_TYPE_COUNT = NOTE_TYPES.length;
const CUSTOM_FAMILY = ['custom', 'Your types', null, []];
TYPE_FAMILIES.push(CUSTOM_FAMILY);
function typeSlug(label) {
  return String(label || '').toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40);
}
/* CSS for a marker (.dot) of each shape; 'var(--tc)' is the type colour. */
const SHAPE_CSS = {
  circle: 'border-radius: 50%;',
  ring: 'border-radius: 50%; background: transparent; box-shadow: inset 0 0 0 1.6px var(--tc);',
  square: 'border-radius: 0; width: 7.5px; height: 7.5px;',
  diamond: 'border-radius: 0; width: 7px; height: 7px; transform: rotate(45deg); margin-left: 1px; margin-right: 1px;',
  triangle: 'border-radius: 0; width: 9px; height: 8px; clip-path: polygon(50% 0, 100% 100%, 0 100%);',
  star: 'border-radius: 0; width: 10px; height: 10px; clip-path: polygon(50% 0%, 61.8% 35.5%, 99% 35.5%, 69% 57.5%, 80% 93%, 50% 71%, 20% 93%, 31% 57.5%, 1% 35.5%, 38.2% 35.5%);',
  moon: 'width: 9px; height: 9px; border-radius: 50%; background: radial-gradient(circle at 70% 30%, transparent 0 3.4px, var(--tc) 3.8px);',
  sun: 'border-radius: 0; width: 10px; height: 10px; clip-path: ' + (() => {
    const pts = []; for (let k = 0; k < 24; k++) { const r = k % 2 ? 31 : 50; const a = (k / 24) * 2 * Math.PI - Math.PI / 2; pts.push(`${(50 + r * Math.cos(a)).toFixed(1)}% ${(50 + r * Math.sin(a)).toFixed(1)}%`); }
    return 'polygon(' + pts.join(', ') + ');';
  })(),
};
function customTypesValid(list) {
  const seen = new Set(TYPE_IDS.slice(0, BUILTIN_TYPE_COUNT));
  return (Array.isArray(list) ? list : []).filter((t) => {
    if (!t || !t.id || seen.has(t.id) || !/^[a-z0-9][a-z0-9-]*$/.test(t.id)) return false;
    seen.add(t.id); return true;
  });
}
/* Put the user's types into NOTE_TYPES, TYPE_IDS, TYPE_LABEL, TYPE_SHAPE and the "Your types" family,
   and write their colours and marker shapes as CSS. */
function applyCustomTypes(list) {
  for (const id of TYPE_IDS.splice(BUILTIN_TYPE_COUNT)) { delete TYPE_LABEL[id]; delete TYPE_SHAPE[id]; }
  NOTE_TYPES.splice(BUILTIN_TYPE_COUNT); CUSTOM_FAMILY[3].length = 0;
  let css = '';
  for (const t of customTypesValid(list)) {
    const label = String(t.label || t.id).trim() || t.id;
    const shape = SHAPE_CSS[t.shape] ? t.shape : 'circle';
    const color = pigmentVar(t.color);
    NOTE_TYPES.push([t.id, label]); TYPE_IDS.push(t.id); TYPE_LABEL[t.id] = label; TYPE_SHAPE[t.id] = shape; CUSTOM_FAMILY[3].push(t.id);
    css += `:root { --t-${t.id}: ${color}; } .t-${t.id} { --tc: var(--t-${t.id}); } .dot.t-${t.id} { ${SHAPE_CSS[shape]} }\n`;
  }
  if (typeof document !== 'undefined') {
    let el = document.getElementById('custom-type-css');
    if (!el) { el = document.createElement('style'); el.id = 'custom-type-css'; document.head.appendChild(el); }
    el.textContent = css + Object.entries(SHAPE_CSS).map(([k, v]) => `.dot.shape-${k} { ${v} }`).join('\n');
  }
}
const STATUSES = [['fleeting', 'Fleeting'], ['draft', 'Draft'], ['permanent', 'Permanent'], ['archived', 'Archived']];
const STATUS_IDS = STATUSES.map((s) => s[0]);

const REL_INVERSE = {
  supports: 'supported by', refutes: 'refuted by', 'objects-to': 'objected to by', 'replies-to': 'replied to by',
  generalizes: 'generalized by', specializes: 'specialized by', 'example-of': 'has example', 'depends-on': 'needed by',
  implies: 'implied by', equivalent: 'equivalent', contrasts: 'contrasts', follows: 'followed by', 'part-of': 'has part',
  answers: 'answered by', motivates: 'motivated by', cites: 'cited by', 'derived-from': 'used to derive', refines: 'refined by',
  'proves': 'proved by', 'applies': 'applied in', 'contradicts': 'contradicts',
};
const REL_SUGGEST = Object.keys(REL_INVERSE);
const REL_CLASS = (rel) => {
  if (!rel) return 'plain';
  if (/^(supports|proves|answers|motivates|implies)$/.test(rel)) return 'pro';
  if (/^(refutes|objects-to|contradicts|contrasts)$/.test(rel)) return 'con';
  if (/^(follows|replies-to)$/.test(rel)) return 'seq';
  return 'struct';
};

/* ---------- frontmatter (YAML subset with lossless passthrough) ---------- */
const FM_KNOWN = ['id', 'title', 'type', 'status', 'tags', 'aliases', 'citekey', 'author', 'year', 'source', 'url', 'doi', 'created', 'modified'];
const FM_LIST = new Set(['tags', 'aliases']);

function yamlUnquote(s) {
  s = s.trim();
  if (s.length >= 2 && s[0] === '"' && s[s.length - 1] === '"') {
    try { return JSON.parse(s); } catch (e) { return s.slice(1, -1); }
  }
  if (s.length >= 2 && s[0] === "'" && s[s.length - 1] === "'") return s.slice(1, -1).replace(/''/g, "'");
  return s;
}
function yamlSplitFlow(s) {
  const out = []; let cur = ''; let q = null;
  for (const ch of s) {
    if (q) { cur += ch; if (ch === q) q = null; continue; }
    if (ch === '"' || ch === "'") { q = ch; cur += ch; continue; }
    if (ch === ',') { out.push(cur); cur = ''; continue; }
    cur += ch;
  }
  out.push(cur);
  return out.map(yamlUnquote).map((x) => x.trim()).filter((x) => x !== '');
}
function yamlQuote(s) {
  s = String(s);
  if (s === '' || /^[\s\-?:,\[\]{}#&*!|>'"%@`]/.test(s) || /:\s|\s#|:$|\s$|[\n\t]/.test(s) ||
      /^(true|false|yes|no|null|on|off|~)$/i.test(s)) return JSON.stringify(s);
  return s;
}
function yamlQuoteItem(s) {
  s = String(s);
  return /[,\[\]{}]/.test(s) ? JSON.stringify(s) : yamlQuote(s);
}

function parseFrontmatter(text) {
  text = text.replace(/^﻿/, '').replace(/\r\n?/g, '\n');
  const m = /^---[ \t]*\n([\s\S]*?)\n(?:---|\.\.\.)[ \t]*(?:\n|$)/.exec(text);
  if (!m && /^---[ \t]*\n(?:---|\.\.\.)[ \t]*(?:\n|$)/.test(text)) {
    return { data: {}, extra: [], body: text.replace(/^---[ \t]*\n(?:---|\.\.\.)[ \t]*\n?/, '').replace(/^\n/, '') };
  }
  if (!m) return { data: {}, extra: [], body: text };
  const blocks = [];
  for (const line of m[1].split('\n')) {
    if (/^[A-Za-z_][\w-]*[ \t]*:/.test(line)) blocks.push([line]);
    else if (blocks.length) blocks[blocks.length - 1].push(line);
  }
  const data = {}; const extra = [];
  for (const b of blocks) {
    const mm = /^([A-Za-z_][\w-]*)[ \t]*:[ \t]*(.*)$/.exec(b[0]);
    const key = mm[1]; const raw = mm[2].trim();
    if (!FM_KNOWN.includes(key)) { extra.push(b.join('\n').replace(/\s+$/, '')); continue; }
    let val;
    if (raw === '' || raw === '|' || raw === '>' || raw === '|-' || raw === '>-') {
      const rest = b.slice(1);
      const items = rest.map((l) => /^\s*-\s+(.*)$/.exec(l)).filter(Boolean).map((x) => yamlUnquote(x[1]));
      if (items.length) val = items;
      else val = rest.map((l) => l.trim()).filter(Boolean).join(raw.startsWith('|') ? '\n' : ' ');
    } else if (/^\[.*\]$/.test(raw)) val = yamlSplitFlow(raw.slice(1, -1));
    else val = yamlUnquote(raw);
    if (FM_LIST.has(key)) {
      if (!Array.isArray(val)) val = String(val).split(',').map((x) => x.trim()).filter(Boolean);
      if (key === 'tags') val = val.map((t) => String(t).replace(/^#/, ''));
    } else if (Array.isArray(val)) val = val.join(key === 'author' ? ' and ' : ', ');
    data[key] = val;
  }
  return { data, extra, body: text.slice(m[0].length).replace(/^\n/, '') };
}

function firstHeading(body) {
  const m = /^#[ \t]+(.+?)[ \t#]*$/m.exec(maskCode(body));
  return m ? body.substr(m.index, m[0].length).replace(/^#[ \t]+/, '').replace(/[ \t#]*$/, '') : '';
}

function parseNote(text, opts = {}) {
  const { data, extra, body } = parseFrontmatter(text);
  const now = isoLocal();
  const fileStem = opts.filename ? opts.filename.split('/').pop().replace(/\.(md|markdown|txt)$/i, '') : '';
  const note = {
    id: data.id != null && String(data.id).trim() ? String(data.id).trim() : '',
    title: String(data.title || firstHeading(body) || fileStem || 'Untitled').trim(),
    type: TYPE_IDS.includes(data.type) ? data.type : (data.type ? String(data.type) : 'concept'),
    status: STATUS_IDS.includes(data.status) ? data.status : (data.status ? String(data.status) : 'permanent'),
    tags: Array.isArray(data.tags) ? data.tags.map(String) : [],
    aliases: Array.isArray(data.aliases) ? data.aliases.map(String) : [],
    citekey: data.citekey ? String(data.citekey) : '',
    author: data.author ? String(data.author) : '',
    year: data.year ? String(data.year) : '',
    source: data.source ? String(data.source) : '',
    url: data.url ? String(data.url) : '',
    doi: data.doi ? String(data.doi) : '',
    created: data.created ? String(data.created) : (opts.mtime ? isoLocal(new Date(opts.mtime)) : now),
    modified: data.modified ? String(data.modified) : (opts.mtime ? isoLocal(new Date(opts.mtime)) : now),
    extra,
    body,
  };
  if (opts.filename) note.file = opts.filename;
  return note;
}

function serializeNote(n) {
  const L = ['---'];
  L.push('id: ' + n.id);
  L.push('title: ' + yamlQuote(n.title));
  L.push('type: ' + yamlQuote(n.type || 'concept'));
  L.push('status: ' + yamlQuote(n.status || 'permanent'));
  if (n.tags && n.tags.length) L.push('tags: [' + n.tags.map(yamlQuoteItem).join(', ') + ']');
  if (n.aliases && n.aliases.length) L.push('aliases: [' + n.aliases.map(yamlQuoteItem).join(', ') + ']');
  for (const k of ['citekey', 'author', 'year', 'source', 'url', 'doi']) if (n[k]) L.push(k + ': ' + yamlQuote(n[k]));
  L.push('created: ' + n.created);
  L.push('modified: ' + n.modified);
  for (const x of n.extra || []) L.push(x);
  L.push('---');
  return L.join('\n') + '\n\n' + (n.body || '');
}

/* ---------- masking: blank out code (and optionally math) while keeping offsets ---------- */
const blank = (s) => s.replace(/[^\n]/g, ' ');

function fencedRanges(text) {
  const ranges = []; const lines = text.split('\n');
  let pos = 0; let open = null;
  for (const line of lines) {
    const end = pos + line.length;
    if (!open) {
      const m = /^ {0,3}(`{3,}|~{3,})/.exec(line);
      if (m && !(m[1][0] === '`' && line.slice(m[0].length).includes('`'))) open = { start: pos, ch: m[1][0], len: m[1].length };
    } else {
      const m = /^ {0,3}(`{3,}|~{3,})[ \t]*$/.exec(line);
      if (m && m[1][0] === open.ch && m[1].length >= open.len) { ranges.push([open.start, end]); open = null; }
    }
    pos = end + 1;
  }
  if (open) ranges.push([open.start, text.length]);
  return ranges;
}

function inlineCodeRanges(text) {
  const ranges = []; const re = /(`+)(?!`)([\s\S]*?[^`])\1(?!`)/g; let m;
  while ((m = re.exec(text))) {
    if (m[0].includes('\n\n')) { re.lastIndex = m.index + m[1].length; continue; }
    ranges.push([m.index, m.index + m[0].length]);
  }
  return ranges;
}

function applyMask(text, ranges) {
  if (!ranges.length) return text;
  let out = ''; let last = 0;
  for (const [a, b] of ranges.sort((x, y) => x[0] - y[0])) {
    if (a < last) continue;
    out += text.slice(last, a) + blank(text.slice(a, b)); last = b;
  }
  return out + text.slice(last);
}

function maskCode(text) {
  const t1 = applyMask(text, fencedRanges(text));
  return applyMask(t1, inlineCodeRanges(t1));
}

/* Math scanner. Works on code-masked text; returns ranges with the TeX source. */
const MATH_ENVS = new Set(['equation', 'equation*', 'align', 'align*', 'alignat', 'alignat*', 'gather', 'gather*',
  'multline', 'multline*', 'eqnarray', 'eqnarray*', 'flalign', 'flalign*', 'CD']);

function findMath(t) {
  const out = []; const n = t.length; let i = 0;
  while (i < n) {
    const c = t[i];
    if (c === '\\') {
      const nx = t[i + 1];
      if (nx === '[') {
        const j = t.indexOf('\\]', i + 2);
        if (j >= 0) { out.push({ start: i, end: j + 2, tex: t.slice(i + 2, j), display: true }); i = j + 2; continue; }
      } else if (nx === '(') {
        const j = t.indexOf('\\)', i + 2);
        if (j >= 0 && !/\n[ \t]*\n/.test(t.slice(i, j))) { out.push({ start: i, end: j + 2, tex: t.slice(i + 2, j), display: false }); i = j + 2; continue; }
      } else if (nx === 'b' && t.startsWith('\\begin{', i) && (i === 0 || /\s/.test(t[i - 1]))) {
        const m = /^\\begin\{([A-Za-z]+\*?)\}/.exec(t.slice(i, i + 40));
        if (m && MATH_ENVS.has(m[1])) {
          const endTok = '\\end{' + m[1] + '}';
          const j = t.indexOf(endTok, i);
          if (j >= 0) { out.push({ start: i, end: j + endTok.length, tex: t.slice(i, j + endTok.length), display: true, env: m[1] }); i = j + endTok.length; continue; }
        }
      }
      i += 2; continue;
    }
    if (c === '$') {
      if (t[i + 1] === '$') {
        let j = i + 2; let found = -1;
        while ((j = t.indexOf('$$', j)) >= 0) { if (t[j - 1] !== '\\') { found = j; break; } j += 2; }
        if (found >= 0) { out.push({ start: i, end: found + 2, tex: t.slice(i + 2, found), display: true }); i = found + 2; continue; }
        i += 2; continue;
      }
      const nx = t[i + 1];
      if (nx && !/\s/.test(nx)) {
        let j = i + 1; let found = -1;
        while (j < n) {
          const ch = t[j];
          if (ch === '\\') { j += 2; continue; }
          if (ch === '\n' && /^\n[ \t]*\n/.test(t.slice(j, j + 40))) break;
          if (ch === '$') { if (!/\s/.test(t[j - 1]) && !/\d/.test(t[j + 1] || '')) found = j; break; }
          j++;
        }
        if (found > 0) { out.push({ start: i, end: found + 1, tex: t.slice(i + 1, found), display: false }); i = found + 1; continue; }
      }
      i++; continue;
    }
    i++;
  }
  return out;
}

function maskedBody(n) {
  if (n._mmBody !== n.body) { n._mm = maskCodeMath(n.body || ''); n._mmBody = n.body; }
  return n._mm;
}

function maskCodeMath(text) {
  const t = maskCode(text);
  return applyMask(t, findMath(t).map((m) => [m.start, m.end]));
}

/* ---------- note analysis: links, tags, cards ---------- */
const WIKILINK_RE = /(!?)\[\[([^\[\]\n|]+?)(?:\|([^\[\]\n]*?))?\]\]/g;
const REL_PREFIX_RE = /(?:^|[\s(>*_])([A-Za-z][\w-]*)::$/;
const TAG_RE = /(^|[\s,;])#([\p{L}_][\p{L}\p{N}_\/-]*)/gu;

function splitTarget(raw) {
  const s = raw.trim(); const k = s.indexOf('#');
  return k >= 0 ? { target: s.slice(0, k).trim(), heading: s.slice(k + 1).trim() } : { target: s, heading: '' };
}

function lineContext(text, idx) {
  const a = text.lastIndexOf('\n', idx - 1) + 1; let b = text.indexOf('\n', idx);
  if (b < 0) b = text.length;
  return text.slice(a, b).trim();
}

function analyzeNote(n) {
  if (n._an && n._anBody === n.body) return n._an;
  const body = n.body || '';
  const mc = maskCode(body);
  const links = []; let m;
  WIKILINK_RE.lastIndex = 0;
  while ((m = WIKILINK_RE.exec(mc))) {
    const { target, heading } = splitTarget(body.substr(m.index + m[1].length + 2, m[2].length));
    if (!target && !heading) continue;
    const before = mc.slice(Math.max(0, m.index - 40), m.index);
    const rm = m[1] ? null : REL_PREFIX_RE.exec(before);
    links.push({ target, heading, label: m[3] != null ? body.substr(m.index + m[0].length - 2 - m[3].length, m[3].length) : '',
      embed: !!m[1], rel: rm ? rm[1].toLowerCase() : '', index: m.index, ctx: lineContext(body, m.index) });
  }
  const mm = maskCodeMath(body);
  const tags = new Set();
  TAG_RE.lastIndex = 0;
  while ((m = TAG_RE.exec(mm))) tags.add(m[2].replace(/[\/-]+$/, ''));
  const cites = new Set();
  const cre = /\[(@[^\]\n]+)\]/g;
  while ((m = cre.exec(mm))) for (const part of m[1].split(';')) { const k = /@([\w:.\-\/]+)/.exec(part); if (k) cites.add(k[1].replace(/[.:]+$/, '')); }
  const words = (mm.match(/[\p{L}\p{N}]+/gu) || []).length;
  n._an = { links, tags, cites, words };
  n._anBody = body;
  return n._an;
}

function noteTags(n) {
  const s = new Set(n.tags || []);
  for (const t of analyzeNote(n).tags) s.add(t);
  return Array.from(s);
}

/* ---------- vault ---------- */
const vault = {
  notes: new Map(),
  assets: new Map(), // name -> { path, blob, url, mtime, size, type, lazy } (see render.js)
  version: 0,
  _idx: null,
  touch() { this.version++; },
  get(id) { return this.notes.get(id); },
  all() { return Array.from(this.notes.values()); },
  index() {
    if (this._idx && this._idx.v === this.version) return this._idx;
    this._idx = buildIndex();
    return this._idx;
  },
};

function buildIndex() {
  const byTitle = new Map(); const byAlias = new Map(); const byCite = new Map();
  const sorted = vault.all().sort((a, b) => (a.created < b.created ? -1 : a.created > b.created ? 1 : 0));
  for (const n of sorted) {
    const t = normTitle(n.title);
    if (!byTitle.has(t)) byTitle.set(t, n.id);
    for (const a of n.aliases || []) { const k = normTitle(a); if (k && !byAlias.has(k)) byAlias.set(k, n.id); }
    if (n.citekey && !byCite.has(n.citekey)) byCite.set(n.citekey, n.id);
  }
  const idx = { v: vault.version, byTitle, byAlias, byCite, back: new Map(), out: new Map(), unresolved: new Map(), tagCount: new Map(), citedBy: new Map() };
  const resolveT = (target) => resolveTarget(target, idx);
  for (const n of sorted) {
    const an = analyzeNote(n);
    const outs = [];
    for (const l of an.links) {
      const rid = l.target ? resolveT(l.target) : n.id;
      const rec = { from: n.id, to: rid, rel: l.rel, embed: l.embed, heading: l.heading, ctx: l.ctx, target: l.target };
      outs.push(rec);
      if (rid) {
        if (rid === n.id) continue;
        if (!idx.back.has(rid)) idx.back.set(rid, []);
        idx.back.get(rid).push(rec);
      } else {
        if (hasFileExt(l.target) && findAsset(l.target, n)) continue; // a link to an attachment, not to a missing note
        const k = normTitle(l.target);
        if (!idx.unresolved.has(k)) idx.unresolved.set(k, { target: l.target, refs: [] });
        idx.unresolved.get(k).refs.push(rec);
      }
    }
    for (const c of an.cites) {
      const lit = byCite.get(c);
      if (lit && lit !== n.id) {
        outs.push({ from: n.id, to: lit, rel: 'cites', embed: false, heading: '', ctx: '[@' + c + ']', target: lit });
        if (!idx.citedBy.has(lit)) idx.citedBy.set(lit, []);
        idx.citedBy.get(lit).push(n.id);
      }
    }
    idx.out.set(n.id, outs);
    for (const t of noteTags(n)) idx.tagCount.set(t, (idx.tagCount.get(t) || 0) + 1);
  }
  return idx;
}

function resolveTarget(target, idx = vault.index()) {
  if (!target) return null;
  let t = String(target).trim();
  if (vault.notes.has(t)) return t;
  t = t.replace(/\.(md|markdown)$/i, '');
  const base = t.includes('/') ? t.split('/').pop() : t;
  if (vault.notes.has(base)) return base;
  const k = normTitle(base);
  return idx.byTitle.get(k) || idx.byAlias.get(k) || null;
}

/* ---------- IndexedDB storage with graceful fallback ---------- */
const store = {
  db: null,
  mode: 'none', // 'idb' | 'memory'
  mem: { notes: new Map(), meta: new Map(), history: [], trash: new Map(), assets: new Map() },
  async open() {
    try {
      if (!window.indexedDB) throw new Error('no indexedDB');
      this.db = await new Promise((res, rej) => {
        const rq = indexedDB.open('musubi', 1);
        rq.onupgradeneeded = () => {
          const db = rq.result;
          if (!db.objectStoreNames.contains('notes')) db.createObjectStore('notes', { keyPath: 'id' });
          if (!db.objectStoreNames.contains('meta')) db.createObjectStore('meta');
          if (!db.objectStoreNames.contains('history')) {
            const hs = db.createObjectStore('history', { keyPath: 'hid', autoIncrement: true });
            hs.createIndex('noteId', 'noteId');
          }
          if (!db.objectStoreNames.contains('trash')) db.createObjectStore('trash', { keyPath: 'id' });
          if (!db.objectStoreNames.contains('assets')) db.createObjectStore('assets', { keyPath: 'name' });
        };
        rq.onsuccess = () => res(rq.result);
        rq.onerror = () => rej(rq.error);
        rq.onblocked = () => rej(new Error('blocked'));
        setTimeout(() => rej(new Error('timeout')), 4000);
      });
      this.mode = 'idb';
      await this._migrateLegacy();
    } catch (e) {
      console.warn('[musubi] IndexedDB unavailable, using memory store:', e);
      this.mode = 'memory';
      try {
        const raw = localStorage.getItem('musubi-fallback') || localStorage.getItem('organon-fallback');
        if (raw) {
          const d = JSON.parse(raw);
          for (const n of d.notes || []) this.mem.notes.set(n.id, n);
          for (const [k, v] of Object.entries(d.meta || {})) this.mem.meta.set(k, v);
        }
      } catch (e2) { /* storage blocked */ }
    }
  },
  /* Musubi was called Organon before version 2.1. On the first start after the rename, copy the
     old database once (notes, settings, review data, history, trash, images) and leave it in place. */
  async _migrateLegacy() {
    const LEGACY = 'organon';
    try {
      if (await this._tx('meta', 'readonly', (os) => this._req(os.get('migratedFrom')))) return;
      const n = await this._tx('notes', 'readonly', (os) => this._req(os.count()));
      const m = await this._tx('meta', 'readonly', (os) => this._req(os.count()));
      if (n || m) return;
      if (indexedDB.databases) { const list = await indexedDB.databases(); if (!list.some((d) => d.name === LEGACY)) return; }
      const old = await new Promise((res) => {
        const rq = indexedDB.open(LEGACY);
        rq.onupgradeneeded = () => { try { rq.transaction.abort(); } catch (e) { /* ignore */ } };
        rq.onsuccess = () => res(rq.result); rq.onerror = () => res(null); rq.onblocked = () => res(null);
      });
      if (!old) return;
      let copied = 0;
      for (const name of ['notes', 'meta', 'history', 'trash', 'assets']) {
        if (!old.objectStoreNames.contains(name)) continue;
        const [keys, vals] = await new Promise((res, rej) => {
          const tx = old.transaction(name, 'readonly'); const os = tx.objectStore(name);
          const a = os.getAllKeys(); const b = os.getAll();
          tx.oncomplete = () => res([a.result, b.result]); tx.onerror = () => rej(tx.error);
        });
        if (!vals.length) continue;
        await this._tx(name, 'readwrite', (os) => { vals.forEach((v, i) => (os.keyPath ? os.put(v) : os.put(v, keys[i]))); });
        copied += vals.length;
      }
      old.close();
      await this._tx('meta', 'readwrite', (os) => { os.put(LEGACY, 'migratedFrom'); });
      if (copied) console.info('[musubi] copied ' + copied + ' records from the Organon database');
    } catch (e) { console.warn('[musubi] could not copy the old Organon data', e); }
  },
  _tx(name, mode, fn) {
    return new Promise((res, rej) => {
      const tx = this.db.transaction(name, mode);
      const os = tx.objectStore(name);
      let result;
      Promise.resolve(fn(os)).then((r) => { result = r; });
      tx.oncomplete = () => res(result);
      tx.onerror = () => rej(tx.error);
      tx.onabort = () => rej(tx.error);
    });
  },
  _req(rq) { return new Promise((res, rej) => { rq.onsuccess = () => res(rq.result); rq.onerror = () => rej(rq.error); }); },
  _persistFallback: debounce(function () {
    try {
      localStorage.setItem('musubi-fallback', JSON.stringify({
        notes: Array.from(store.mem.notes.values()),
        meta: Object.fromEntries(Array.from(store.mem.meta.entries()).filter(([k]) => k !== 'folderHandle')),
      }));
    } catch (e) { /* quota or blocked */ }
  }, 800),
  async allNotes() {
    if (this.mode === 'memory') return Array.from(this.mem.notes.values());
    return this._tx('notes', 'readonly', (os) => this._req(os.getAll()));
  },
  async getNote(id) {
    if (this.mode === 'memory') return this.mem.notes.get(id);
    return this._tx('notes', 'readonly', (os) => this._req(os.get(id)));
  },
  async putNote(n) {
    const rec = plainNote(n);
    if (this.mode === 'memory') { this.mem.notes.set(rec.id, rec); this._persistFallback(); return; }
    return this._tx('notes', 'readwrite', (os) => { os.put(rec); });
  },
  async putNotes(list) {
    if (this.mode === 'memory') { for (const n of list) this.mem.notes.set(n.id, plainNote(n)); this._persistFallback(); return; }
    return this._tx('notes', 'readwrite', (os) => { for (const n of list) os.put(plainNote(n)); });
  },
  async deleteNote(id) {
    if (this.mode === 'memory') { this.mem.notes.delete(id); this._persistFallback(); return; }
    return this._tx('notes', 'readwrite', (os) => { os.delete(id); });
  },
  async clearNotes() {
    if (this.mode === 'memory') { this.mem.notes.clear(); this._persistFallback(); return; }
    return this._tx('notes', 'readwrite', (os) => { os.clear(); });
  },
  async getMeta(key) {
    if (this.mode === 'memory') return this.mem.meta.get(key);
    return this._tx('meta', 'readonly', (os) => this._req(os.get(key)));
  },
  async setMeta(key, val) {
    if (this.mode === 'memory') { this.mem.meta.set(key, val); this._persistFallback(); return; }
    return this._tx('meta', 'readwrite', (os) => { os.put(val, key); });
  },
  async delMeta(key) {
    if (this.mode === 'memory') { this.mem.meta.delete(key); return; }
    return this._tx('meta', 'readwrite', (os) => { os.delete(key); });
  },
  async addHistory(noteId, text) {
    const rec = { noteId, ts: Date.now(), text };
    if (this.mode === 'memory') {
      this.mem.history.push(rec);
      const mine = this.mem.history.filter((r) => r.noteId === noteId);
      if (mine.length > 40) this.mem.history.splice(this.mem.history.indexOf(mine[0]), 1);
      return;
    }
    await this._tx('history', 'readwrite', (os) => { os.add(rec); });
    const all = await this.history(noteId);
    if (all.length > 40) {
      const drop = all.slice(40);
      await this._tx('history', 'readwrite', (os) => { for (const r of drop) os.delete(r.hid); });
    }
  },
  async history(noteId) {
    let list;
    if (this.mode === 'memory') list = this.mem.history.filter((r) => r.noteId === noteId);
    else list = await this._tx('history', 'readonly', (os) => this._req(os.index('noteId').getAll(noteId)));
    return list.sort((a, b) => b.ts - a.ts);
  },
  async deleteHistoryFor(noteId) {
    if (this.mode === 'memory') { this.mem.history = this.mem.history.filter((r) => r.noteId !== noteId); return; }
    const all = await this.history(noteId);
    if (all.length) await this._tx('history', 'readwrite', (os) => { for (const r of all) os.delete(r.hid); });
  },
  async putTrash(rec) {
    if (this.mode === 'memory') { this.mem.trash.set(rec.id, rec); return; }
    return this._tx('trash', 'readwrite', (os) => { os.put(rec); });
  },
  async allTrash() {
    if (this.mode === 'memory') return Array.from(this.mem.trash.values());
    return this._tx('trash', 'readonly', (os) => this._req(os.getAll()));
  },
  async delTrash(id) {
    if (this.mode === 'memory') { this.mem.trash.delete(id); return; }
    return this._tx('trash', 'readwrite', (os) => { os.delete(id); });
  },
  async clearTrash() {
    if (this.mode === 'memory') { this.mem.trash.clear(); return; }
    return this._tx('trash', 'readwrite', (os) => { os.clear(); });
  },
  async putAsset(name, blob, meta = {}) {
    // blob is null for a file that stays only in the linked folder (read when opened)
    const rec = { name, blob: blob || null, path: meta.path || '', type: meta.type || (blob && blob.type) || '', size: meta.size || (blob && blob.size) || 0, mtime: meta.mtime || 0 };
    if (this.mode === 'memory') { this.mem.assets.set(name, rec); return; }
    return this._tx('assets', 'readwrite', (os) => { os.put(rec); });
  },
  async allAssets() {
    if (this.mode === 'memory') return Array.from(this.mem.assets.values());
    return this._tx('assets', 'readonly', (os) => this._req(os.getAll()));
  },
  async delAsset(name) {
    if (this.mode === 'memory') { this.mem.assets.delete(name); return; }
    return this._tx('assets', 'readwrite', (os) => { os.delete(name); });
  },
};

function plainNote(n) {
  const r = {};
  for (const k of ['id', 'title', 'type', 'status', 'tags', 'aliases', 'citekey', 'author', 'year', 'source', 'url', 'doi', 'created', 'modified', 'extra', 'body', 'file', 'fileMtime']) {
    if (n[k] !== undefined) r[k] = Array.isArray(n[k]) ? n[k].slice() : n[k];
  }
  return r;
}

/* ---------- ZIP (store on write; store + deflate on read) ---------- */
const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let i = 0; i < 256; i++) { let c = i; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[i] = c >>> 0; }
  return t;
})();
function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

async function makeZip(files) { // files: [{name, data: string|Uint8Array|Blob}]
  const enc = new TextEncoder(); const parts = []; const central = []; let offset = 0;
  const d = new Date();
  const dosTime = (d.getHours() << 11) | (d.getMinutes() << 5) | (d.getSeconds() >> 1);
  const dosDate = ((d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate();
  for (const f of files) {
    let data = f.data;
    if (data instanceof Blob) data = new Uint8Array(await data.arrayBuffer());
    else if (typeof data === 'string') data = enc.encode(data);
    const name = enc.encode(f.name); const crc = crc32(data);
    const lh = new DataView(new ArrayBuffer(30));
    lh.setUint32(0, 0x04034b50, true); lh.setUint16(4, 20, true); lh.setUint16(6, 0x0800, true); lh.setUint16(8, 0, true);
    lh.setUint16(10, dosTime, true); lh.setUint16(12, dosDate, true); lh.setUint32(14, crc, true);
    lh.setUint32(18, data.length, true); lh.setUint32(22, data.length, true); lh.setUint16(26, name.length, true); lh.setUint16(28, 0, true);
    parts.push(new Uint8Array(lh.buffer), name, data);
    const ch = new DataView(new ArrayBuffer(46));
    ch.setUint32(0, 0x02014b50, true); ch.setUint16(4, 20, true); ch.setUint16(6, 20, true); ch.setUint16(8, 0x0800, true);
    ch.setUint16(10, 0, true); ch.setUint16(12, dosTime, true); ch.setUint16(14, dosDate, true); ch.setUint32(16, crc, true);
    ch.setUint32(20, data.length, true); ch.setUint32(24, data.length, true); ch.setUint16(28, name.length, true);
    ch.setUint16(30, 0, true); ch.setUint16(32, 0, true); ch.setUint16(34, 0, true); ch.setUint16(36, 0, true);
    ch.setUint32(38, 0, true); ch.setUint32(42, offset, true);
    central.push(new Uint8Array(ch.buffer), name);
    offset += 30 + name.length + data.length;
  }
  const cdSize = central.reduce((s, p) => s + p.length, 0);
  const end = new DataView(new ArrayBuffer(22));
  end.setUint32(0, 0x06054b50, true); end.setUint16(8, files.length, true); end.setUint16(10, files.length, true);
  end.setUint32(12, cdSize, true); end.setUint32(16, offset, true);
  return new Blob([...parts, ...central, new Uint8Array(end.buffer)], { type: 'application/zip' });
}

async function readZip(buf) { // ArrayBuffer -> [{name, data: Uint8Array}]
  const u8 = new Uint8Array(buf); const dv = new DataView(buf);
  let eocd = -1;
  for (let i = u8.length - 22; i >= Math.max(0, u8.length - 65557); i--) if (dv.getUint32(i, true) === 0x06054b50) { eocd = i; break; }
  if (eocd < 0) throw new Error('Not a ZIP archive');
  const count = dv.getUint16(eocd + 10, true); let p = dv.getUint32(eocd + 16, true);
  const dec = new TextDecoder(); const out = [];
  for (let k = 0; k < count; k++) {
    if (dv.getUint32(p, true) !== 0x02014b50) break;
    const method = dv.getUint16(p + 10, true); const csize = dv.getUint32(p + 20, true);
    const nlen = dv.getUint16(p + 28, true); const xlen = dv.getUint16(p + 30, true); const clen = dv.getUint16(p + 32, true);
    const lho = dv.getUint32(p + 42, true);
    const name = dec.decode(u8.subarray(p + 46, p + 46 + nlen));
    p += 46 + nlen + xlen + clen;
    if (name.endsWith('/')) continue;
    const dstart = lho + 30 + dv.getUint16(lho + 26, true) + dv.getUint16(lho + 28, true);
    const raw = u8.subarray(dstart, dstart + csize);
    let data;
    if (method === 0) data = raw.slice();
    else if (method === 8) {
      if (typeof DecompressionStream === 'undefined') throw new Error('This browser cannot read compressed ZIP files');
      const ds = new Blob([raw]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
      data = new Uint8Array(await new Response(ds).arrayBuffer());
    } else continue;
    out.push({ name, data });
  }
  return out;
}

/* ---------- BibTeX ---------- */
const TEX_ACCENTS = { '"': '̈', "'": '́', '`': '̀', '^': '̂', '~': '̃', '=': '̄', '.': '̇', 'c': '̧', 'v': '̌', 'u': '̆', 'H': '̋' };
function cleanTex(s) {
  return String(s)
    .replace(/\{?\\([`'^"~=.])\s*\{?([A-Za-z])\}?\}?/g, (m, a, ch) => (ch + TEX_ACCENTS[a]).normalize('NFC'))
    .replace(/\{?\\([cvuH])\{([A-Za-z])\}\}?/g, (m, a, ch) => (ch + TEX_ACCENTS[a]).normalize('NFC'))
    .replace(/\\ss\b/g, 'ß').replace(/\\o\b/g, 'ø').replace(/\\O\b/g, 'Ø').replace(/\\ae\b/g, 'æ').replace(/\\l\b/g, 'ł')
    .replace(/\\&/g, '&').replace(/\\%/g, '%').replace(/\\_/g, '_').replace(/--/g, '–')
    .replace(/[{}]/g, '').replace(/\s+/g, ' ').trim();
}
function parseBibtex(src) {
  const entries = []; let i = 0;
  while ((i = src.indexOf('@', i)) >= 0) {
    const m = /^@(\w+)\s*([{(])/.exec(src.slice(i));
    if (!m) { i++; continue; }
    const type = m[1].toLowerCase(); const close = m[2] === '{' ? '}' : ')';
    let j = i + m[0].length; let depth = 1; const start = j;
    while (j < src.length && depth > 0) {
      const ch = src[j];
      if (ch === '{' || (ch === '(' && close === ')')) depth++;
      else if (ch === '}' || (ch === ')' && close === ')')) depth--;
      j++;
    }
    const content = src.slice(start, j - 1); i = j;
    if (type === 'comment' || type === 'preamble' || type === 'string') continue;
    const comma = content.indexOf(',');
    if (comma < 0) continue;
    const key = content.slice(0, comma).trim(); const fields = {};
    let k = comma + 1;
    while (k < content.length) {
      const fm = /^\s*([\w-]+)\s*=\s*/.exec(content.slice(k));
      if (!fm) break;
      k += fm[0].length;
      let val = '';
      if (content[k] === '{') {
        let d = 0; const s0 = k;
        for (; k < content.length; k++) { if (content[k] === '{') d++; else if (content[k] === '}') { d--; if (d === 0) { k++; break; } } }
        val = content.slice(s0 + 1, k - 1);
      } else if (content[k] === '"') {
        const s0 = ++k; let d = 0;
        for (; k < content.length; k++) { if (content[k] === '{') d++; else if (content[k] === '}') d--; else if (content[k] === '"' && d === 0) break; }
        val = content.slice(s0, k); k++;
      } else {
        const vm = /^[^,]*/.exec(content.slice(k)); val = vm[0]; k += vm[0].length;
      }
      fields[fm[1].toLowerCase()] = cleanTex(val);
      const cm = /^\s*,?/.exec(content.slice(k)); k += cm[0].length;
    }
    entries.push({ type, key, fields });
  }
  return entries;
}

/* ---------- line diff (LCS) for history view ---------- */
function lineDiff(a, b) {
  const A = a.split('\n'); const B = b.split('\n');
  const n = A.length; const m = B.length;
  if (n * m > 4e6) return null;
  const dp = Array.from({ length: n + 1 }, () => new Uint32Array(m + 1));
  for (let i = n - 1; i >= 0; i--) for (let j = m - 1; j >= 0; j--) dp[i][j] = A[i] === B[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
  const out = []; let i = 0; let j = 0;
  while (i < n && j < m) {
    if (A[i] === B[j]) { out.push([' ', A[i]]); i++; j++; }
    else if (dp[i + 1][j] >= dp[i][j + 1]) { out.push(['-', A[i]]); i++; }
    else { out.push(['+', B[j]]); j++; }
  }
  while (i < n) out.push(['-', A[i++]]);
  while (j < m) out.push(['+', B[j++]]);
  return out;
}
