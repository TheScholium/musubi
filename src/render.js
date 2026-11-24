/* Musubi renderer: Markdown + KaTeX + Zettelkasten syntax.
   Pipeline: protect code -> number and typeset math -> inline syntax -> footnotes ->
   block environments -> marked -> DOMPurify -> restore trusted fragments. */

const PH_O = '', PH_C = '';
const PH_RE_ANY = /([TBC])(\d+)/g;

const ENV_DEFS = {
  definition: { label: 'Definition', num: true, style: 'def', card: true },
  theorem: { label: 'Theorem', num: true, style: 'thm', card: true },
  lemma: { label: 'Lemma', num: true, style: 'thm', card: true },
  proposition: { label: 'Proposition', num: true, style: 'thm', card: true },
  corollary: { label: 'Corollary', num: true, style: 'thm', card: true },
  conjecture: { label: 'Conjecture', num: true, style: 'thm', card: false },
  claim: { label: 'Claim', num: true, style: 'thm', card: false },
  axiom: { label: 'Axiom', num: true, style: 'def', card: true },
  postulate: { label: 'Postulate', num: true, style: 'def', card: true },
  law: { label: 'Law', num: true, style: 'def', card: true },
  principle: { label: 'Principle', num: true, style: 'def', card: true },
  example: { label: 'Example', num: true, style: 'ex', card: false },
  exercise: { label: 'Exercise', num: true, style: 'ex', card: false },
  solution: { label: 'Solution', num: false, style: 'proof', card: false },
  proof: { label: 'Proof', num: false, style: 'proof', card: false },
  remark: { label: 'Remark', num: false, style: 'rem', card: false },
  note: { label: 'Note', num: false, style: 'rem', card: false },
  intuition: { label: 'Intuition', num: false, style: 'rem', card: false },
  warning: { label: 'Caution', num: false, style: 'warn', card: false },
  argument: { label: 'Argument', num: false, style: 'arg', card: false },
  objection: { label: 'Objection', num: false, style: 'con', card: false },
  reply: { label: 'Reply', num: false, style: 'rep', card: false },
  quote: { label: '', num: false, style: 'quote', card: false },
};
const ENV_NAMES = Object.keys(ENV_DEFS);

/* ---------- KaTeX ---------- */
const KCACHE = new Map();
let baseMacros = {};
function setMacros(text) {
  const m = {};
  for (const line of String(text || '').split('\n')) {
    const mm = /^\s*(\\[A-Za-z@]+)\s*[:=]\s*(.+?)\s*$/.exec(line);
    if (mm && !line.trim().startsWith('%')) m[mm[1]] = mm[2];
  }
  baseMacros = m;
  KCACHE.clear();
}
function texToHtml(tex, display, macros, useCache) {
  const key = (display ? 'D' : 'I') + tex;
  if (useCache && KCACHE.has(key)) return KCACHE.get(key);
  let out;
  try {
    out = katex.renderToString(tex, { displayMode: display, throwOnError: false, errorColor: 'var(--danger)', macros,
      strict: 'ignore', trust: false, output: 'htmlAndMathml', globalGroup: true, maxExpand: 2000 });
  } catch (e) {
    out = `<span class="math-error" title="${esc(e.message)}">${esc(tex)}</span>`;
  }
  if (useCache) { if (KCACHE.size > 5000) KCACHE.clear(); KCACHE.set(key, out); }
  return out;
}

/* Split TeX rows at top-level \\ (ignoring braces and nested environments). */
function splitRows(s) {
  const rows = []; const seps = []; let cur = ''; let depth = 0; let env = 0; let i = 0;
  while (i < s.length) {
    if (s.startsWith('\\begin{', i)) { env++; const j = s.indexOf('}', i); cur += s.slice(i, j + 1); i = j + 1; continue; }
    if (s.startsWith('\\end{', i)) { env--; const j = s.indexOf('}', i); cur += s.slice(i, j + 1); i = j + 1; continue; }
    const c = s[i];
    if (c === '\\' && s[i + 1] === '\\' && depth === 0 && env === 0) {
      let sep = '\\\\'; i += 2;
      const om = /^\s*\[[^\]]*\]/.exec(s.slice(i));
      if (om) { sep += om[0]; i += om[0].length; }
      rows.push(cur); seps.push(sep); cur = ''; continue;
    }
    if (c === '\\') { cur += s.slice(i, i + 2); i += 2; continue; }
    if (c === '{') depth++; else if (c === '}') depth--;
    cur += c; i++;
  }
  rows.push(cur);
  return { rows, seps };
}

function numberEquations(maths, autoNumber) {
  let n = 0; const labels = {};
  const numberRow = (r, auto, m) => {
    let lab = null;
    r = r.replace(/\\label\{([^}]*)\}/g, (_, k) => { lab = k.trim(); return ''; });
    const no = /\\(nonumber|notag)(?![A-Za-z])/.test(r);
    r = r.replace(/\\(nonumber|notag)(?![A-Za-z])/g, '');
    const tm = /\\tag\*?\{([^}]*)\}/.exec(r);
    if (tm) { if (lab) { labels[lab] = tm[1]; m.labels.push(lab); } return r; }
    if (no || !r.trim() || (!auto && !lab)) return r;
    n++;
    if (lab) { labels[lab] = String(n); m.labels.push(lab); }
    return r + `\\tag{${n}}`;
  };
  for (const m of maths) {
    m.labels = [];
    if (!m.display) continue;
    const em = /^\s*\\begin\{([A-Za-z]+)(\*?)\}([\s\S]*)\\end\{\1\*?\}\s*$/.exec(m.tex);
    if (em && MATH_ENVS.has(em[1] + em[2]) && em[1] !== 'CD') {
      let name = em[1]; const auto = autoNumber && !em[2]; let inner = em[3]; let args = '';
      if (name === 'alignat') { const am = /^\s*\{\d+\}/.exec(inner); if (am) { args = am[0]; inner = inner.slice(am[0].length); } }
      if (name === 'eqnarray' || name === 'flalign') name = 'align';
      if (name === 'multline') {
        const { rows, seps } = splitRows(inner);
        const last = rows.length - 1 - [...rows].reverse().findIndex((r) => r.trim());
        const out = rows.map((r, k) => (k === last ? numberRow(r, auto, m) : numberRow(r, false, m)));
        m.tex = `\\begin{gather*}${out.map((r, k) => r + (seps[k] || '')).join('')}\\end{gather*}`;
        continue;
      }
      if (/^(align|alignat|gather)$/.test(name)) {
        const { rows, seps } = splitRows(inner);
        const out = rows.map((r) => numberRow(r, auto, m));
        m.tex = `\\begin{${name}*}${args}${out.map((r, k) => r + (seps[k] || '')).join('')}\\end{${name}*}`;
      } else {
        m.tex = `\\begin{${name}*}${numberRow(inner, auto, m)}\\end{${name}*}`;
      }
    } else {
      m.tex = numberRow(m.tex, false, m);
    }
  }
  for (const m of maths) {
    m.tex = m.tex.replace(/\\(eqref|ref)\{([^}]*)\}/g, (_, c, k) => {
      const v = labels[k.trim()];
      return '\\text{' + (v ? (c === 'eqref' ? '(' + v + ')' : v) : '(??)') + '}';
    });
  }
  return labels;
}

/* ---------- helpers ---------- */
function shortAuthor(a) {
  if (!a) return '';
  const names = a.split(/\s+and\s+|;\s*/).map((s) => s.trim()).filter(Boolean);
  const last = (s) => (s.includes(',') ? s.split(',')[0].trim() : s.split(/\s+/).pop());
  if (names.length === 1) return last(names[0]);
  if (names.length === 2) return last(names[0]) + ' & ' + last(names[1]);
  return last(names[0]) + ' et al.';
}

function extractSection(body, heading) {
  const mc = maskCode(body); const lines = mc.split('\n'); const orig = body.split('\n');
  const want = slugify(heading); let start = -1; let level = 0;
  for (let i = 0; i < lines.length; i++) {
    const m = /^(#{1,6})[ \t]+(.+?)[ \t#]*$/.exec(lines[i]);
    if (!m) continue;
    if (start < 0) { if (slugify(m[2]) === want || normTitle(m[2]) === normTitle(heading)) { start = i; level = m[1].length; } }
    else if (m[1].length <= level) return orig.slice(start, i).join('\n');
  }
  return start < 0 ? null : orig.slice(start).join('\n');
}

const IMG_EXT = /\.(png|jpe?g|gif|svg|webp|avif|bmp)$/i;

/* ---------- attachments ----------
   vault.assets maps a file name to { path, blob, url, mtime, size, type, lazy }. Names are unique in the vault.
   Images keep their bytes (blob) so that notes render at once; other files found in a linked folder are "lazy":
   only their path is known, and the bytes are read from the folder when the file is opened. */
const NOTE_EXT = /\.(md|markdown)$/i;
function attKind(name) {
  if (IMG_EXT.test(name)) return 'image';
  if (/\.pdf$/i.test(name)) return 'pdf';
  if (/\.(mp3|wav|m4a|ogg|oga|flac|aac|opus)$/i.test(name)) return 'audio';
  if (/\.(mp4|webm|mov|m4v|ogv)$/i.test(name)) return 'video';
  return 'file';
}
function hasFileExt(t) { return /\.[A-Za-z0-9]{1,8}$/.test(String(t || '')) && !NOTE_EXT.test(t); }
function normPath(p) {
  const out = [];
  for (const seg of String(p || '').replace(/\\/g, '/').split('/')) { if (!seg || seg === '.') continue; if (seg === '..') out.pop(); else out.push(seg); }
  return out.join('/');
}
function noteDir(note) { return note && note.file && note.file.includes('/') ? note.file.slice(0, note.file.lastIndexOf('/') + 1) : ''; }
function unescapeHtml(s) { return String(s).replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&'); }
/* Find an attachment by path (relative to the note's folder or to the vault) or by file name. */
function findAsset(target, note) {
  if (!target) return null;
  let t = String(target).trim().replace(/^<|>$/g, '');
  try { t = decodeURIComponent(t); } catch (e) { /* keep as written */ }
  if (!t) return null;
  const cands = [normPath(noteDir(note) + t), normPath(t)];
  for (const [name, a] of vault.assets) if (a.path && cands.includes(a.path)) return { name, a };
  const base = t.split('/').pop();
  const a = vault.assets.get(base);
  return a ? { name: base, a } : null;
}
async function assetUrl(name) {
  const a = vault.assets.get(name); if (!a) return null;
  if (a.url) return a.url;
  if (!a.blob && a.path && typeof readFolderFile === 'function') a.blob = await readFolderFile(a.path);
  if (!a.blob) return null;
  a.url = URL.createObjectURL(a.blob);
  return a.url;
}
function fmtSize(n) {
  if (!n) return '';
  const u = ['B', 'KB', 'MB', 'GB']; let i = 0; while (n >= 1024 && i < u.length - 1) { n /= 1024; i++; }
  return (i ? n.toFixed(n < 10 ? 1 : 0) : n) + ' ' + u[i];
}
const attExt = (name) => (String(name).split('.').pop() || '').toLowerCase();
function attLinkHtml(name, label, page) {
  return `<a class="att att-${attKind(name)}" data-att="${esc(name)}" data-ext="${esc(attExt(name))}"${page ? ` data-page="${+page}"` : ''} href="#att" title="Open ${esc(name)}${page ? ' at page ' + +page : ''}">${esc(label || name)}</a>`;
}
const pageOfHeading = (hd) => { const m = /^page=(\d+)$/i.exec(String(hd || '').trim()); return m ? +m[1] : 0; };
function imgWidthFromAlt(alt) {
  const m = /^(.*?)\|(\d+)(?:x\d+)?$/.exec(alt || '');
  return m ? { alt: m[1], width: +m[2] } : { alt: alt || '', width: 0 };
}
/* Markdown images and links with a relative path: ![alt](attachments/fig.png), [text](paper.pdf), [text](Note.md). */
function resolveRelativeRefs(html, note) {
  const absolute = /^(?:[a-z][\w+.-]*:|\/\/|#)/i;
  html = html.replace(/<img\b([^>]*?)\ssrc="([^"]*)"([^>]*)>/g, (all, pre, src, post) => {
    if (absolute.test(src)) return all;
    const raw = unescapeHtml(src); const f = findAsset(raw, note);
    if (!f || !f.a.url) return `<span class="asset-missing">Missing image: ${esc(raw)}</span>`;
    let attrs = pre + post; let style = '';
    attrs = attrs.replace(/\salt="([^"]*)"/, (m0, alt) => { const w = imgWidthFromAlt(unescapeHtml(alt)); if (w.width) style = ` style="width:${w.width}px"`; return ` alt="${esc(w.alt)}"`; });
    return `<img class="asset"${attrs} src="${f.a.url}"${style}>`;
  });
  html = html.replace(/<a\b([^>]*?)\shref="([^"]*)"([^>]*)>/g, (all, pre, href, post) => {
    if (absolute.test(href) || !href) return all;
    const raw = unescapeHtml(href); let path = raw; try { path = decodeURIComponent(raw); } catch (e) { /* keep */ }
    const [p0, frag] = path.split('#');
    if (NOTE_EXT.test(p0)) {
      const byFile = vault.all().find((n) => n.file && (n.file === normPath(noteDir(note) + p0) || n.file === normPath(p0)));
      const id = byFile ? byFile.id : resolveTarget(p0.split('/').pop().replace(NOTE_EXT, ''));
      if (id) return `<a class="wl" data-id="${esc(id)}"${frag ? ` data-heading="${esc(slugify(frag))}"` : ''} href="#n-${esc(id)}">`;
      return all;
    }
    const f = findAsset(p0, note);
    if (f) return `<a class="att att-${attKind(f.name)}" data-att="${esc(f.name)}" data-ext="${esc(attExt(f.name))}" href="#att">`;
    return all;
  });
  return html;
}
/* Fill attachment cards (PDF, audio, video, other files) after the HTML is in the page. */
function enhanceAttachments(root) {
  if (!root || !root.querySelectorAll) return;
  for (const el of root.querySelectorAll('.att-card[data-att]:not([data-ready])')) {
    el.dataset.ready = '1';
    const name = el.dataset.att; const a = vault.assets.get(name); const kind = el.dataset.kind || attKind(name);
    if (!a) continue;
    const head = h('div', { class: 'att-head' },
      h('span', { class: 'att-kind' }, kind === 'file' ? attExt(name) || 'file' : kind),
      h('span', { class: 'att-name' }, name),
      a.size ? h('span', { class: 'att-size' }, fmtSize(a.size)) : null,
      h('span', { class: 'att-actions' },
        kind === 'pdf' ? h('button', { class: 'link-btn att-read', title: 'Open in the PDF reader, beside the note', onclick: (e) => { e.preventDefault(); e.stopPropagation(); openPdfTab(name); } }, 'Read') : null,
        kind === 'pdf' ? h('button', { class: 'link-btn att-toggle', onclick: (e) => { e.preventDefault(); e.stopPropagation(); toggleAttFrame(el, name); } }, 'Show') : null,
        h('button', { class: 'link-btn', onclick: (e) => { e.preventDefault(); e.stopPropagation(); openAttachment(name, { external: true }); } }, 'Open')));
    el.appendChild(head);
    if (kind === 'audio' || kind === 'video') {
      const media = h(kind, { controls: '', preload: 'metadata', class: 'att-media' });
      el.appendChild(media);
      assetUrl(name).then((u) => { if (u) media.src = u; });
    }
  }
}
async function toggleAttFrame(el, name) {
  const btn = el.querySelector('.att-toggle'); let fr = el.querySelector('iframe');
  if (fr) { fr.remove(); if (btn) btn.textContent = 'Show'; return; }
  const u = await assetUrl(name); if (!u) { toast('The file could not be read. Is the folder still linked?', { kind: 'error' }); return; }
  fr = h('iframe', { class: 'att-frame', src: u, title: name });
  el.appendChild(fr); if (btn) btn.textContent = 'Hide';
}
async function openAttachment(name, opts) {
  const o = typeof opts === 'number' ? { page: opts } : (opts || {});
  if (/\.pdf$/i.test(name) && !o.external && typeof openPdfTab === 'function') { openPdfTab(name, { page: o.page || null }); return; }
  const u = await assetUrl(name);
  if (!u) { toast('The file could not be read. Is the folder still linked?', { kind: 'error' }); return; }
  const kind = attKind(name);
  if (kind !== 'file' || /\.(txt|csv|json|html?)$/i.test(name)) { if (window.open(u, '_blank', 'noopener')) return; }
  const a = document.createElement('a'); a.href = u; a.download = name; document.body.appendChild(a); a.click(); a.remove();
}

function stripTitleHeading(body, title) {
  const m = /^\s*#[ \t]+(.+?)[ \t#]*(\n|$)/.exec(body);
  if (m && normTitle(m[1]) === normTitle(title)) return body.slice(m[0].length);
  return body;
}

/* ---------- main renderer ---------- */
function renderMarkdown(src, opt = {}) {
  const note = opt.note || null;
  const depth = opt.depth || 0;
  const stack = opt.stack || new Set(note ? [note.id] : []);
  const pre = opt.idPrefix || (note ? 'n' + note.id + '-' : 'x' + hashStr(String(src).slice(0, 200)) + '-');
  const settings = (typeof app !== 'undefined' && app.settings) || {};
  const tokens = []; const codes = [];
  const tok = (html, block) => { tokens.push(html); return PH_O + (block ? 'B' : 'T') + (tokens.length - 1) + PH_C; };
  const ctok = (s) => { codes.push(s); return PH_O + 'C' + (codes.length - 1) + PH_C; };
  const restoreCodes = (s) => s.replace(/C(\d+)/g, (_, k) => codes[+k]);

  let text = String(src || '').replace(/\r\n?/g, '\n').replace(/[]/g, '');

  /* 1. protect code */
  {
    const fr = fencedRanges(text); let out = ''; let last = 0;
    for (const [a, b] of fr) {
      const blockSrc = text.slice(a, b); const lines = blockSrc.split('\n');
      const fm = /^ {0,3}(`{3,}|~{3,})(.*)$/.exec(lines[0]);
      if (fm && isPlotFence(fm[2])) {
        const closed = lines.length > 1 && new RegExp('^ {0,3}' + fm[1][0] + '{' + fm[1].length + ',}[ \\t]*$').test(lines[lines.length - 1]);
        const code = lines.slice(1, closed ? -1 : undefined).join('\n');
        out += text.slice(last, a) + '\n' + tok(plotBlockHtml(code, !opt.noPlotCode), true) + '\n'; last = b; continue;
      }
      out += text.slice(last, a) + ctok(blockSrc); last = b;
    }
    text = out + text.slice(last);
    const ir = inlineCodeRanges(text); out = ''; last = 0;
    for (const [a, b] of ir) { out += text.slice(last, a) + ctok(text.slice(a, b)); last = b; }
    text = out + text.slice(last);
  }

  /* 2. math */
  const macros = Object.assign({}, baseMacros);
  const hasDefs = /\\(newcommand|renewcommand|def|gdef|edef|let)(?![A-Za-z])/.test(text);
  const maths = findMath(text);
  const eqLabels = numberEquations(maths, settings.autoNumber !== false);
  {
    let out = ''; let last = 0;
    for (const m of maths) {
      let html = texToHtml(m.tex, m.display, macros, !hasDefs);
      if (m.display) {
        const anchors = m.labels.map((l) => `<span class="eq-anchor" id="${esc(pre + 'eq-' + slugify(l))}"></span>`).join('');
        html = `<span class="math-display">${anchors}${html}</span>`;
      } else html = `<span class="math-inline">${html}</span>`;
      out += text.slice(last, m.start) + tok(html); last = m.end;
    }
    text = out + text.slice(last);
  }

  /* 3. inline Zettelkasten syntax */
  const linkHtml = (rawTarget, label, rel) => {
    const { target, heading } = splitTarget(rawTarget);
    const id = target ? resolveTarget(target) : (note ? note.id : null);
    const relHtml = rel ? `<span class="rel rel-${REL_CLASS(rel)}" title="typed link">${esc(rel)}</span>` : '';
    if (!id) {
      if (hasFileExt(target)) {
        const f = findAsset(target, note);
        return relHtml + (f ? attLinkHtml(f.name, label || (pageOfHeading(heading) ? `${target}, p. ${pageOfHeading(heading)}` : target), pageOfHeading(heading)) : `<span class="asset-missing">Missing file: ${esc(target)}</span>`);
      }
      return relHtml + `<a class="wl broken" data-target="${esc(target)}" title="No note yet. Click to create “${esc(target)}”.">${esc(label || rawTarget)}</a>`;
    }
    const tn = vault.get(id);
    if (isBlockRef(heading)) {
      const bid = heading.slice(1); const blk = findBlock(tn.body, bid);
      const shown = label || (target ? tn.title + ' › ' : '') + (blk ? blockSnippet(blk, 48) : '^' + bid);
      return relHtml + `<a class="wl${blk ? '' : ' broken-block'}" data-id="${esc(id)}" data-block="${esc(bid)}" href="#n-${esc(id)}"${blk ? '' : ` title="No block ^${esc(bid)} in “${esc(tn.title)}”"`}>${esc(shown)}</a>`;
    }
    const shown = label || (heading ? (target ? tn.title + ' › ' : '') + heading : tn.title);
    return relHtml + `<a class="wl" data-id="${esc(id)}"${heading ? ` data-heading="${esc(slugify(heading))}"` : ''} href="#n-${esc(id)}">${esc(shown)}</a>`;
  };
  const embedHtml = (rawTarget, label) => {
    const { target, heading } = splitTarget(rawTarget);
    if (hasFileExt(target) && !resolveTarget(target)) {
      const f = findAsset(target, note);
      if (!f) return `<span class="asset-missing">Missing ${IMG_EXT.test(target) ? 'image' : 'file'}: ${esc(target)}</span>`;
      if (attKind(f.name) !== 'image') return `<div class="att-card att-${attKind(f.name)}" data-att="${esc(f.name)}" data-kind="${attKind(f.name)}"></div>`;
      const a = f.a;
      if (!a.url) return attLinkHtml(f.name, label);
      const w = /^\d+$/.test((label || '').trim()) ? ` style="width:${+label}px"` : '';
      return `<img class="asset" src="${a.url}" alt="${esc(label && !w ? label : target)}"${w}>`;
    }
    const id = target ? resolveTarget(target) : (note ? note.id : null);
    if (!id) return `<div class="embed embed-missing">Cannot embed: ${linkHtml(rawTarget, label, '')}</div>`;
    const tn = vault.get(id);
    if ((stack.has(id) && !heading) || depth >= 3) return `<div class="embed embed-cycle">Embed stopped (cycle or depth limit): ${linkHtml(rawTarget, label, '')}</div>`;
    let body = stripTitleHeading(tn.body, tn.title);
    if (isBlockRef(heading)) {
      const bid = heading.slice(1); const blk = findBlock(tn.body, bid);
      if (!blk) return `<div class="embed embed-missing">No block ^${esc(bid)} in ${linkHtml(target, '', '')}</div>`;
      const inner = renderMarkdown(blk.text, { note: tn, depth: depth + 1, stack: new Set([...stack, id]), idPrefix: pre + 'e' + depth + id + bid + '-' });
      return `<div class="embed embed-block" data-id="${esc(id)}"><div class="embed-body">${inner}</div><div class="embed-src"><a class="wl" data-id="${esc(id)}" data-block="${esc(bid)}" href="#n-${esc(id)}">${esc(label || tn.title)}</a></div></div>`;
    }
    if (heading) {
      const sec = extractSection(tn.body, heading);
      if (sec == null) return `<div class="embed embed-missing">No heading “${esc(heading)}” in ${linkHtml(target, '', '')}</div>`;
      body = sec;
    }
    const inner = renderMarkdown(body, { note: tn, depth: depth + 1, stack: new Set([...stack, id]), idPrefix: pre + 'e' + depth + id + '-' });
    return `<div class="embed" data-id="${esc(id)}"><div class="embed-head"><a class="wl" data-id="${esc(id)}" href="#n-${esc(id)}">${esc(label || tn.title)}${heading ? ' › ' + esc(heading) : ''}</a><span class="embed-type t-${esc(tn.type)}">${esc(TYPE_LABEL[tn.type] || tn.type)}</span></div><div class="embed-body">${inner}</div></div>`;
  };

  const inlineTransforms = (s) => {
    // block IDs: a line "^id" alone, or " ^id" at the end of a line, become anchors
    s = s.replace(/^[ \t]*\^([A-Za-z0-9][A-Za-z0-9-]*)[ \t]*$/gm, (m, id) => '\n' + tok(blockAnchorHtml(id, pre), true) + '\n');
    s = s.replace(/([ \t])\^([A-Za-z0-9][A-Za-z0-9-]*)[ \t]*$/gm, (m, sp, id) => tok(blockAnchorHtml(id, pre)));
    // embeds alone on a line -> block token
    s = s.replace(/^[ \t]*!\[\[([^\[\]\n|]+?)(?:\|([^\[\]\n]*?))?\]\][ \t]*$/gm, (m, t, l) => '\n' + tok(embedHtml(t, l || ''), true) + '\n');
    // typed links, links, inline embeds
    s = s.replace(/(^|[\s(>*_])([A-Za-z][\w-]*)::\[\[([^\[\]\n|]+?)(?:\|([^\[\]\n]*?))?\]\]/gm,
      (m, pfx, rel, t, l) => pfx + tok(linkHtml(t, l || '', rel.toLowerCase())));
    s = s.replace(/(!?)\[\[([^\[\]\n|]+?)(?:\|([^\[\]\n]*?))?\]\]/g,
      (m, bang, t, l) => (bang ? tok(embedHtml(t, l || ''), false) : tok(linkHtml(t, l || '', ''))));
    // citations [@key, p. 3; @other]
    s = s.replace(/\[(@[^\]\n]+)\](?!\()/g, (m, inner) => {
      const parts = inner.split(';').map((p) => p.trim()).filter(Boolean);
      const html = parts.map((p) => {
        const km = /^@([\w:.\-\/]+?)[.:]*(?:,\s*(.*))?$/.exec(p);
        if (!km) return esc(p);
        const id = vault.index().byCite.get(km[1]);
        const loc = km[2] ? ', ' + esc(km[2]) : '';
        if (!id) return `<a class="cite-ref broken" data-cite="${esc(km[1])}" title="No literature note has citekey ${esc(km[1])}">@${esc(km[1])}${loc}</a>`;
        const ln = vault.get(id);
        const label = ln.author ? esc(shortAuthor(ln.author)) + (ln.year ? ' ' + esc(ln.year) : '') : esc(km[1]);
        return `<a class="cite-ref" data-id="${esc(id)}" href="#n-${esc(id)}" title="${esc(ln.title)}">${label}${loc}</a>`;
      }).join('; ');
      return tok(`<span class="cite">(${html})</span>`);
    });
    // equation references outside math
    s = s.replace(/\\(eqref|ref)\{([^}\n]*)\}/g, (m, c, k) => {
      const v = eqLabels[k.trim()];
      if (!v) return tok(`<span class="eqref broken" title="Unknown label">(??)</span>`);
      return tok(`<a class="eqref" data-anchor="${esc(pre + 'eq-' + slugify(k.trim()))}">${c === 'eqref' ? '(' + esc(v) + ')' : esc(v)}</a>`);
    });
    // cloze deletions
    s = s.replace(/\{\{c(\d*)::([\s\S]*?)(?:::([^{}\n]*))?\}\}/g, (m, num, body) => `<mark class="cloze" data-c="${num || 1}">${body}</mark>`);
    // tags
    s = s.replace(/(^|[\s,;])#([\p{L}_][\p{L}\p{N}_\/-]*)/gu, (m, pfx, tag) => {
      const t = tag.replace(/[\/-]+$/, ''); const rest = tag.slice(t.length);
      return pfx + tok(`<a class="tag" data-tag="${esc(t)}">#${esc(t)}</a>`) + rest;
    });
    return s;
  };
  const inl = (s) => marked.parseInline(restoreCodes(s));

  text = inlineTransforms(text);

  /* 4. footnotes */
  const fnDefs = {}; const fnOrder = [];
  text = text.replace(/^\[\^([^\]\s]+)\]:[ \t]*(.*(?:\n(?: {2,}|\t).*)*)/gm, (m, id, content) => { fnDefs[id] = content.replace(/\n[ \t]+/g, ' '); return ''; });
  text = text.replace(/\[\^([^\]\s]+)\](?!:)/g, (m, id) => {
    if (!(id in fnDefs)) return m;
    let k = fnOrder.indexOf(id);
    if (k < 0) { fnOrder.push(id); k = fnOrder.length - 1; }
    const sid = esc(slugify(id));
    return `<sup class="fnref"><a data-anchor="${pre}fn-${sid}" id="${pre}fnref-${sid}">${k + 1}</a></sup>`;
  });

  /* 5. block environments, arguments, Q/A */
  text = blockTransforms(text, inl);
  if (fnOrder.length) {
    text += '\n\n<section class="footnotes"><ol>' + fnOrder.map((id) => {
      const sid = esc(slugify(id));
      return `<li id="${pre}fn-${sid}">${inl(fnDefs[id])} <a class="fnback" data-anchor="${pre}fnref-${sid}" title="Back">↩</a></li>`;
    }).join('') + '</ol></section>\n';
  }

  /* 6. markdown, sanitize, restore */
  let html = marked.parse(restoreCodes(text), { gfm: true, breaks: !!opt.breaks, async: false });
  html = DOMPurify.sanitize(html, { ADD_ATTR: ['target'], FORBID_TAGS: ['style', 'form', 'button', 'textarea', 'select'], FORBID_ATTR: ['onerror', 'onload'] });
  html = resolveRelativeRefs(html, note);
  for (let pass = 0; pass < 5 && html.includes(PH_O); pass++) {
    html = html.replace(/<p>\s*B(\d+)\s*<\/p>/g, (_, k) => tokens[+k]);
    html = html.replace(/[TB](\d+)/g, (_, k) => tokens[+k]);
  }
  return html;
}

/* A:{ … } answer block. lines are the note lines with code and math masked, so that only
   real braces count. i is the line of "A:", col the index of "{". Returns the line and the
   column of the matching "}", or null when the block does not close. */
function findAnswerClose(lines, i, col) {
  let depth = 0;
  for (let j = i; j < lines.length; j++) {
    const s = lines[j];
    for (let k = j === i ? col : 0; k < s.length; k++) {
      const c = s[k];
      if (c === '\\') { k++; continue; }
      if (c === '{') depth++;
      else if (c === '}' && --depth === 0) return { line: j, col: k };
    }
  }
  return null;
}
const ANSWER_OPEN_RE = /^A:[ \t]*\{/;

function blockTransforms(text, inl, st = { counter: 0 }) {
  const lines = text.split('\n'); const out = []; const stack = [];
  const openRe = /^ {0,3}(:{3,})[ \t]*([A-Za-z][\w-]*)[ \t]*(?:\[(.*)\])?[ \t]*(.*)$/;
  const closeRe = /^ {0,3}(:{3,})[ \t]*$/;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const open = openRe.exec(line);
    if (open) {
      const kind = open[2].toLowerCase(); const name = (open[3] || '').trim();
      const def = ENV_DEFS[kind] || { label: kind[0].toUpperCase() + kind.slice(1), num: false, style: 'rem' };
      const label = def.num ? def.label + ' ' + (++st.counter) : def.label;
      if (kind === 'argument') {
        const body = []; const colons = open[1].length; let j = i + 1;
        for (; j < lines.length; j++) { const c = closeRe.exec(lines[j]); if (c && c[1].length === colons) break; body.push(lines[j]); }
        i = j;
        out.push('', argumentHtml(name, body, inl), '');
        continue;
      }
      out.push('', `<div class="env env-${esc(kind)} env-style-${def.style}" data-env="${esc(kind)}">`);
      if (def.style !== 'quote') {
        out.push(`<div class="env-head"><span class="env-label">${esc(label)}</span>${name ? `<span class="env-colon">:</span> <span class="env-name">${inl(name)}</span>` : '<span class="env-dot">.</span>'}</div>`);
      }
      out.push('');
      stack.push({ colons: open[1].length, kind, name });
      continue;
    }
    const close = closeRe.exec(line);
    if (close && stack.length) {
      let k = stack.length - 1;
      for (let j = stack.length - 1; j >= 0; j--) if (stack[j].colons === close[1].length) { k = j; break; }
      while (stack.length > k) {
        const e = stack.pop();
        out.push('');
        if (e.kind === 'quote' && e.name) out.push(`<div class="quote-src">— ${inl(e.name)}</div>`, '');
        out.push('</div>', '');
      }
      continue;
    }
    const q = /^Q:[ \t]+(.*)$/.exec(line);
    if (q) {
      const ql = [q[1]]; let j = i + 1; let a = null;
      for (; j < lines.length; j++) {
        const am = /^A:[ \t]*(.*)$/.exec(lines[j]);
        if (am) { a = [am[1]]; j++; break; }
        if (!lines[j].trim()) break;
        ql.push(lines[j]);
      }
      const aLine = j - 1;
      const ob = a ? ANSWER_OPEN_RE.exec(lines[aLine]) : null;
      const close = ob ? findAnswerClose(lines, aLine, ob[0].length - 1) : null;
      if (close) {
        // Block answer: the body is ordinary Markdown, with lists, display math and environments.
        const first = lines[aLine].slice(ob[0].length, close.line === aLine ? close.col : undefined);
        const body = [];
        if (first.trim()) body.push(first);
        for (let k = aLine + 1; k <= close.line; k++) {
          const t = k === close.line ? lines[k].slice(0, close.col) : lines[k];
          if (k < close.line || t.trim()) body.push(t);
        }
        out.push('', `<div class="qa qa-block"><div class="qa-q"><span class="qa-k">Q</span><div>${ql.map(inl).join('<br>')}</div></div><div class="qa-a"><span class="qa-k">A</span><div class="qa-body">`, '');
        out.push(...blockTransforms(body.join('\n'), inl, st).split('\n'));
        out.push('', '</div></div></div>', '');
        const rest = lines[close.line].slice(close.col + 1);
        if (rest.trim()) out.push(rest);
        i = close.line;
        continue;
      }
      if (a) {
        for (; j < lines.length && lines[j].trim(); j++) a.push(lines[j]);
        out.push('', `<div class="qa"><div class="qa-q"><span class="qa-k">Q</span><div>${ql.map(inl).join('<br>')}</div></div><div class="qa-a"><span class="qa-k">A</span><div>${a.filter((x) => x.trim()).map(inl).join('<br>')}</div></div></div>`, '');
        i = j - 1;
        continue;
      }
    }
    out.push(line);
  }
  while (stack.length) { stack.pop(); out.push('', '</div>', ''); }
  return out.join('\n');
}

function argumentHtml(name, lines, inl) {
  const rows = []; let prevRule = false;
  for (const raw of lines) {
    const l = raw.trim();
    if (!l) continue;
    if (/^(-{3,}|_{3,}|={3,})$/.test(l)) { if (rows.length) rows.push('<div class="arg-rule"></div>'); prevRule = true; continue; }
    let m = /^\(?((?:P|C|L|IC|SC)\d*'?|\d+)\)?[.:)][ \t]+(.+)$/.exec(l);
    let label; let body; let concl = false;
    if (m) { label = m[1]; body = m[2]; concl = /^(C|IC)/.test(label); }
    else if ((m = /^(∴|\\therefore|Therefore,?|Hence,?)[ \t]+(.+)$/i.exec(l))) { label = '∴'; body = m[2]; concl = true; }
    else { rows.push(`<div class="arg-row arg-note"><span class="arg-label"></span><span class="arg-text">${inl(l)}</span></div>`); prevRule = false; continue; }
    let just = '';
    const jm = /[ \t]+\[([^\[\]]+)\][ \t]*$/.exec(body);
    if (jm && !/^[@^]/.test(jm[1])) { just = jm[1]; body = body.slice(0, jm.index); }
    if (concl && !prevRule && rows.length) rows.push('<div class="arg-rule"></div>');
    prevRule = false;
    rows.push(`<div class="arg-row ${concl ? 'arg-concl' : 'arg-prem'}"><span class="arg-label">${esc(label)}</span><span class="arg-text">${inl(body)}</span>${just ? `<span class="arg-just">${inl(just)}</span>` : ''}</div>`);
  }
  return `<div class="env env-argument env-style-arg" data-env="argument"><div class="env-head"><span class="env-label">Argument</span>${name ? `<span class="env-colon">:</span> <span class="env-name">${inl(name)}</span>` : '<span class="env-dot">.</span>'}</div><div class="arg-body">${rows.join('')}</div></div>`;
}

/* Post-process a rendered container: heading ids, callouts, tasks, external links. */
function enhanceRendered(root, prefix) {
  enhanceAttachments(root);
  const seen = new Map();
  for (const hd of root.querySelectorAll('h1,h2,h3,h4,h5,h6')) {
    if (hd.closest('.embed-body')) continue;
    let s = slugify(hd.textContent); const c = seen.get(s) || 0; seen.set(s, c + 1);
    if (c) s += '-' + c;
    hd.id = (prefix || '') + 'h-' + s;
    hd.dataset.slug = s;
  }
  for (const bq of root.querySelectorAll('blockquote')) {
    const p = bq.firstElementChild;
    if (!p || p.tagName !== 'P') continue;
    const m = /^\s*\[!([A-Za-z-]+)\][+-]?[ \t]*([^\n]*)/.exec(p.textContent);
    if (!m) continue;
    bq.classList.add('callout', 'callout-' + m[1].toLowerCase());
    const first = p.firstChild;
    if (first && first.nodeType === 3) {
      first.textContent = first.textContent.replace(/^\s*\[![A-Za-z-]+\][+-]?[ \t]*/, '');
    }
    const title = h('div', { class: 'callout-title' }, m[2] ? '' : m[1][0].toUpperCase() + m[1].slice(1).toLowerCase());
    if (m[2]) {
      // move the first line of the paragraph into the title
      const lineEnd = p.innerHTML.indexOf('\n');
      if (lineEnd >= 0) { title.innerHTML = p.innerHTML.slice(0, lineEnd); p.innerHTML = p.innerHTML.slice(lineEnd + 1); }
      else { title.innerHTML = p.innerHTML; p.remove(); }
    }
    bq.insertBefore(title, bq.firstChild);
  }
  let ti = 0;
  for (const cb of root.querySelectorAll('input[type=checkbox]')) {
    if (cb.closest('.embed-body')) { cb.disabled = true; continue; }
    cb.disabled = false; cb.dataset.task = String(ti++);
    const li = cb.closest('li'); if (li) li.classList.add('task');
  }
  for (const a of root.querySelectorAll('a[href]')) {
    const href = a.getAttribute('href') || '';
    if (/^(https?:|mailto:)/i.test(href)) { a.target = '_blank'; a.rel = 'noopener noreferrer'; a.classList.add('ext'); }
  }
  for (const t of root.querySelectorAll('table')) {
    if (t.parentElement && t.parentElement.classList.contains('table-wrap')) continue;
    const w = h('div', { class: 'table-wrap' }); t.replaceWith(w); w.appendChild(t);
  }
  if (typeof app !== 'undefined' && app.settings && app.settings.boldAnchors) boldAnchorsDom(root);
}

/* ---------- flashcards ---------- */
function extractCards(n) {
  const cards = []; const body = n.body || '';
  const mm = maskCodeMath(body);
  // cloze: per paragraph, one card per cloze number
  let pos = 0;
  for (const para of mm.split(/\n[ \t]*\n/)) {
    const start = mm.indexOf(para, pos); pos = start + para.length;
    const re = /\{\{c(\d*)::/g; const nums = new Set(); let m;
    while ((m = re.exec(para))) nums.add(m[1] || '1');
    if (!nums.size) continue;
    const raw = body.slice(start, start + para.length);
    for (const num of nums) {
      const front = raw.replace(/\{\{c(\d*)::([\s\S]*?)(?:::([^{}\n]*))?\}\}/g, (x, k, txt, hint) =>
        ((k || '1') === num ? `<span class="cloze-blank">[${hint ? esc(hint) : '…'}]</span>` : txt));
      const back = raw.replace(/\{\{c(\d*)::([\s\S]*?)(?:::([^{}\n]*))?\}\}/g, (x, k, txt) =>
        ((k || '1') === num ? `<mark class="cloze-reveal">${txt}</mark>` : txt));
      cards.push({ id: n.id + ':z' + hashStr(raw) + ':' + num, noteId: n.id, kind: 'cloze', front, back });
    }
  }
  // Q/A pairs
  const lines = body.split('\n'); const ml = mm.split('\n');
  for (let i = 0; i < lines.length; i++) {
    if (!/^Q:[ \t]+/.test(ml[i]) || !/^Q:[ \t]+/.test(lines[i])) continue;
    const q = [lines[i].replace(/^Q:[ \t]+/, '')]; let j = i + 1; let a = null;
    for (; j < lines.length; j++) {
      if (/^A:[ \t]*/.test(lines[j])) { a = [lines[j].replace(/^A:[ \t]*/, '')]; j++; break; }
      if (!lines[j].trim()) break;
      q.push(lines[j]);
    }
    if (!a) continue;
    const aLine = j - 1;
    const ob = ANSWER_OPEN_RE.exec(ml[aLine]) && ANSWER_OPEN_RE.exec(lines[aLine]);
    const close = ob ? findAnswerClose(ml, aLine, ob[0].length - 1) : null;
    if (close) {
      const parts = [];
      const first = lines[aLine].slice(ob[0].length, close.line === aLine ? close.col : undefined);
      if (first.trim()) parts.push(first);
      for (let k = aLine + 1; k <= close.line; k++) {
        const t = k === close.line ? lines[k].slice(0, close.col) : lines[k];
        if (k < close.line || t.trim()) parts.push(t);
      }
      cards.push({ id: n.id + ':q' + hashStr(q.join('\n')), noteId: n.id, kind: 'qa', front: q.join('\n'), back: parts.join('\n').replace(/^\n+|\n+$/g, ''), frontBreaks: true });
      i = close.line;
      continue;
    }
    for (; j < lines.length && lines[j].trim(); j++) a.push(lines[j]);
    // plain Q:/A: lines keep their line breaks, as in the note
    cards.push({ id: n.id + ':q' + hashStr(q.join('\n')), noteId: n.id, kind: 'qa', front: q.join('\n'), back: a.join('\n'), breaks: true });
    i = j - 1;
  }
  // named statement environments
  const auto = !(typeof app !== 'undefined' && app.settings && app.settings.autoCards === false);
  if (auto) {
    const openRe = /^ {0,3}(:{3,})[ \t]*([A-Za-z][\w-]*)[ \t]*(?:\[(.*)\])?[ \t]*(.*)$/;
    for (let i = 0; i < ml.length; i++) {
      const o = openRe.exec(ml[i]);
      if (!o) continue;
      const kind = o[2].toLowerCase(); const def = ENV_DEFS[kind];
      if (!def || !def.card) continue;
      const name = (openRe.exec(lines[i]) || [])[3];
      if (!name || /\bnocard\b/.test(o[4] || '')) continue;
      const content = []; let depthC = 1;
      for (let j = i + 1; j < lines.length; j++) {
        const oo = openRe.exec(ml[j]); const cc = /^ {0,3}(:{3,})[ \t]*$/.exec(ml[j]);
        if (oo) depthC++;
        else if (cc) { depthC--; if (depthC === 0) break; }
        content.push(lines[j]);
      }
      if (!content.join('').trim()) continue;
      cards.push({ id: n.id + ':e' + hashStr(kind + '|' + name.trim()), noteId: n.id, kind: 'env', env: kind,
        front: `State the ${def.label.toLowerCase()}: **${name.trim()}**`, back: content.join('\n') });
    }
  }
  return cards;
}
