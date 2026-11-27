/* Slides: present a note as a slide deck. The syntax is that of the Obsidian plugin Advanced Slides
   (reveal.js): --- between slides, -- between vertical slides, note: for speaker notes, <style> blocks,
   <!-- slide --> and <!-- element --> annotations, + lists and fragments, <split> and <grid> layouts,
   and front matter options (theme, transition, width, height, slideNumber, ...).

   Two parts:
   1. The app side (buildDeck and the glue at the end) turns a note into a deck of rendered HTML,
      with Musubi's own Markdown, KaTeX, links, embeds and attachments.
   2. musubiSlideRuntime() shows a deck: scaling, transitions, fragments, overview, speaker view,
      print. It uses nothing from the rest of Musubi, so the same code runs in an exported HTML file.
   Each deck lives in a shadow root, so the CSS of a deck (".reveal h2 {...}") cannot reach the app. */

/* ---------- options ---------- */
const SLIDE_SIZES = { '960x700': [960, 700], '1280x720': [1280, 720], '1920x1080': [1920, 1080], '1024x768': [1024, 768], '1200x900': [1200, 900] };
const SLIDE_TRANSITIONS = ['slide', 'fade', 'convex', 'concave', 'zoom', 'none'];

/* Front matter keys that are not Musubi fields stay in note.extra as raw YAML lines. */
function slideFrontmatter(n) {
  const o = {};
  for (const raw of (n && n.extra) || []) {
    const m = /^([A-Za-z][\w-]*)[ \t]*:[ \t]*(.*)$/.exec(String(raw).split('\n')[0]);
    if (!m) continue;
    let v = m[2].trim();
    if (/^(['"]).*\1$/.test(v)) v = v.slice(1, -1);
    else if (/^(true|yes|on)$/i.test(v)) v = true;
    else if (/^(false|no|off)$/i.test(v)) v = false;
    else if (/^-?\d+(\.\d+)?$/.test(v)) v = +v;
    o[m[1]] = v;
  }
  return o;
}

function slideConfig(fm) {
  const s = (typeof app !== 'undefined' && app.settings) || {};
  const [w, hh] = SLIDE_SIZES[s.slidesSize] || SLIDE_SIZES['960x700'];
  const cfg = {
    theme: s.slidesTheme || 'istari', transition: s.slidesTransition || 'slide', transitionSpeed: 'default',
    controls: s.slidesControls !== false, progress: s.slidesProgress !== false, slideNumber: s.slidesNumbers !== false,
    center: true, width: w, height: hh, margin: 0.04, minScale: 0.2, maxScale: 2.0, loop: false, autoSlide: 0,
    timeForPresentation: 0, separator: '', verticalSeparator: '', showNotes: false, bg: '', fragments: true, autoFit: s.slidesAutoFit !== false,
  };
  for (const [k, v] of Object.entries(fm || {})) {
    if (k === 'transition' && typeof v === 'string') { cfg.transition = v.split(/[\s-]/)[0]; continue; }
    if (k in cfg || ['theme', 'transitionSpeed', 'slideNumber'].includes(k)) cfg[k] = v;
  }
  if (!SLIDE_TRANSITIONS.includes(cfg.transition)) cfg.transition = 'slide';
  cfg.width = +cfg.width || 960; cfg.height = +cfg.height || 700;
  cfg.margin = typeof cfg.margin === 'number' ? cfg.margin : 0.04;
  cfg.timeForPresentation = +cfg.timeForPresentation || 0;
  cfg.autoSlide = +cfg.autoSlide || 0;
  return cfg;
}

/* ---------- splitting a note into slides ---------- */
function slideSepRe(custom, dflt) {
  let s = String(custom || '').trim();
  if (!s) return new RegExp('^' + dflt + '[ \\t]*$');
  s = s.replace(/\\r\?\\n/g, '').replace(/\\n/g, '').replace(/^\^/, '').replace(/\$$/, '');
  try { return new RegExp('^(?:' + s + ')[ \\t]*$'); } catch (e) { return new RegExp('^' + dflt + '[ \\t]*$'); }
}

/* Returns horizontal slides, each a list of vertical parts { start, end, src }. Offsets are into text. */
function splitDeck(text, cfg) {
  const masked = maskCodeOnly(text);
  const hre = slideSepRe(cfg.separator, '---'); const vre = slideSepRe(cfg.verticalSeparator, '--');
  const stacks = [[{ start: 0, end: text.length }]];
  let pos = 0;
  for (const line of masked.split('\n')) {
    const end = pos + line.length;
    const last = stacks[stacks.length - 1];
    if (hre.test(line)) { last[last.length - 1].end = pos; stacks.push([{ start: Math.min(end + 1, text.length), end: text.length }]); }
    else if (vre.test(line)) { last[last.length - 1].end = pos; last.push({ start: Math.min(end + 1, text.length), end: text.length }); }
    pos = end + 1;
  }
  for (const st of stacks) for (const p of st) p.src = text.slice(p.start, p.end);
  return stacks;
}

/* The slide that holds a position of the text: { h, v }. */
function slideIndexAt(text, pos, cfg) {
  const stacks = splitDeck(text, cfg); let r = { h: 0, v: 0 };
  stacks.forEach((st, h) => st.forEach((p, v) => { if (p.start <= pos) r = { h, v }; }));
  return r;
}

/* Run a regular expression over text outside code; fn gets the match of the original text. */
function replaceOutsideCode(src, re, fn) {
  const masked = maskCodeOnly(src);
  const g = new RegExp(re.source, re.flags.includes('g') ? re.flags : re.flags + 'g');
  const one = new RegExp(re.source, re.flags.replace('g', ''));
  let out = ''; let last = 0; let m;
  while ((m = g.exec(masked))) {
    if (!m[0].length) { g.lastIndex++; continue; }
    const om = one.exec(src.slice(m.index, m.index + m[0].length)) || [src.slice(m.index, m.index + m[0].length)];
    out += src.slice(last, m.index) + fn(...om); last = m.index + m[0].length;
  }
  return out + src.slice(last);
}

function parseSlideAttrs(s) {
  const out = {}; const re = /([A-Za-z_:][\w:.-]*)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+)))?/g; let m;
  while ((m = re.exec(String(s || '')))) out[m[1]] = m[2] != null ? m[2] : m[3] != null ? m[3] : m[4] != null ? m[4] : '';
  return out;
}

/* ---------- layouts from Advanced Slides: <split> and <grid> ---------- */
const GRID_DROPS = { center: [0.5, 0.5], top: [0.5, 0], bottom: [0.5, 1], left: [0, 0.5], right: [1, 0.5], topleft: [0, 0], topright: [1, 0], bottomleft: [0, 1], bottomright: [1, 1] };
function gridLen(v, total) { const s = String(v).trim(); return /px$/.test(s) ? { v: parseFloat(s), u: 'px' } : { v: parseFloat(s) || 0, u: '%' }; }
function gridStyle(a) {
  const st = ['position:absolute', 'display:flex', 'box-sizing:border-box'];
  const drag = String(a.drag || '100 100').trim().split(/\s+/); const w = gridLen(drag[0]); const hh = gridLen(drag[1] || drag[0]);
  st.push(`width:${w.v}${w.u}`, `height:${hh.v}${hh.u}`);
  const drop = String(a.drop || 'center').trim().toLowerCase();
  if (GRID_DROPS[drop]) {
    const [fx, fy] = GRID_DROPS[drop];
    st.push(`left:calc(${fx * 100}% - ${fx} * ${w.v}${w.u})`, `top:calc(${fy * 100}% - ${fy} * ${hh.v}${hh.u})`);
  } else {
    const d = drop.split(/\s+/); const x = gridLen(d[0]); const y = gridLen(d[1] || '0');
    st.push(x.v < 0 ? `right:${-x.v}${x.u}` : `left:${x.v}${x.u}`, y.v < 0 ? `bottom:${-y.v}${y.u}` : `top:${y.v}${y.u}`);
  }
  const row = String(a.flow || 'col').toLowerCase() === 'row';
  st.push('flex-direction:' + (row ? 'row' : 'column'));
  const al = String(a.align || 'center').toLowerCase();
  const main = /top/.test(al) ? 'flex-start' : /bottom/.test(al) ? 'flex-end' : 'center';
  const cross = /left/.test(al) ? 'flex-start' : /right/.test(al) ? 'flex-end' : al === 'stretch' || al === 'block' || al === 'justify' ? 'stretch' : 'center';
  st.push('justify-content:' + (row ? cross : main), 'align-items:' + (row ? main : cross));
  st.push('text-align:' + (/left/.test(al) ? 'left' : /right/.test(al) ? 'right' : al === 'justify' ? 'justify' : al === 'block' ? 'left' : 'center'));
  if (al === 'block') st[1] = 'display:block';
  if (a.pad) st.push('padding:' + a.pad);
  if (a.border) st.push('border:' + a.border);
  if (a.rotate) st.push(`transform:rotate(${parseFloat(a.rotate) || 0}deg)`);
  if (a.opacity) st.push('opacity:' + (parseFloat(a.opacity) || 1));
  if (a.bg && !slideImageRef(a.bg)) st.push('background:' + a.bg);
  if (a.style) st.push(a.style);
  return st.join(';').replace(/"/g, "'");
}
function slideImageRef(v) {
  const s = String(v || '').trim(); const wm = /^!?\[\[([^\]|]+)(?:\|[^\]]*)?\]\]$/.exec(s);
  if (wm) return wm[1];
  const um = /^url\((['"]?)(.*?)\1\)$/.exec(s); if (um) return um[2];
  if (IMG_EXT.test(s.split(/[?#]/)[0]) || /^(https?:|data:image)/.test(s)) return s;
  return null;
}

/* ---------- rendering one slide ---------- */
function slideMarker(attrs) { return `<span data-mus-el="${esc(JSON.stringify(attrs))}"></span>`; }

function expandSlideEmbeds(src, note, depth) {
  if (depth > 2) return src;
  return replaceOutsideCode(src, /^[ \t]*!\[\[([^\[\]\n|]+?)(?:\|[^\[\]\n]*)?\]\][ \t]*$/m, (all, raw) => {
    const { target, heading } = splitTarget(raw);
    if (hasFileExt(target) && !resolveTarget(target)) return all;
    const id = target ? resolveTarget(target) : null; const tn = id && vault.get(id);
    if (!tn || (note && tn.id === note.id && !heading)) return all;
    let body = stripTitleHeading(tn.body, tn.title);
    if (heading && isBlockRef(heading)) { const b = findBlock(tn.body, heading.slice(1)); body = b ? b.text : ''; }
    else if (heading) body = extractSection(tn.body, heading) || '';
    return expandSlideEmbeds(body, tn, depth + 1);
  });
}

function renderSlide(part, note, prefix, out) {
  let src = part.src.replace(/^\s*\n/, '').replace(/\s+$/, '');
  const attrs = {}; let notes = ''; let grid = false;
  // speaker notes: the first line that starts with "note:" begins them; <aside class="notes"> also works
  {
    const masked = maskCodeOnly(src); const m = /^[ \t]*notes?:[ \t]?/im.exec(masked);
    if (m) { notes = src.slice(m.index + m[0].length); src = src.slice(0, m.index); }
    src = replaceOutsideCode(src, /<aside\b[^>]*class=["'][^"']*\bnotes\b[^"']*["'][^>]*>([\s\S]*?)<\/aside>/i, (all, inner) => { notes = inner + '\n\n' + notes; return ''; });
  }
  // <style> blocks apply to the whole deck
  src = replaceOutsideCode(src, /<style\b[^>]*>([\s\S]*?)<\/style>/i, (all, css) => { out.css.push(css); return ''; });
  // <!-- slide ... --> and <!-- .slide: ... -->
  src = replaceOutsideCode(src, /<!--\s*(?:\.slide:|slide\b)([\s\S]*?)-->/, (all, a) => { Object.assign(attrs, parseSlideAttrs(a)); return ''; });
  // <!-- element ... --> and <!-- .element: ... --> apply to the element before them
  src = replaceOutsideCode(src, /<!--\s*(?:\.element:|element\b)([\s\S]*?)-->/, (all, a) => slideMarker(parseSlideAttrs(a)));
  // other notes embedded alone on a line become part of the slide, as in Advanced Slides
  src = expandSlideEmbeds(src, note, 0);
  // "+ item" lists appear one item at a time
  if (out.cfg.fragments !== false) src = replaceOutsideCode(src, /^([ \t]*\+[ \t]+)(.*)$/m, (all, b, t) => b + t + ' ' + slideMarker({ class: 'fragment' }));
  // layouts
  src = replaceOutsideCode(src, /<split\b([^>]*)>/i, (all, a) => `<div class="mus-split" data-split="${esc(JSON.stringify(parseSlideAttrs(a)))}">`);
  src = replaceOutsideCode(src, /<\/split\s*>/i, () => '</div>');
  src = replaceOutsideCode(src, /<grid\b([^>]*)>/i, (all, a) => {
    grid = true; const at = parseSlideAttrs(a); const img = at.bg ? slideImageRef(at.bg) : null;
    const frag = at.frag != null ? ` data-fragment-index="${esc(at.frag)}"` : '';
    return `<div class="mus-grid${at.class ? ' ' + esc(at.class) : ''}${at.frag != null ? ' fragment' : ''}"${frag} style="${esc(gridStyle(at))}"${img ? ` data-mus-bg="${esc(img)}"` : ''}>`;
  });
  src = replaceOutsideCode(src, /<\/grid\s*>/i, () => '</div>');
  // video and audio embeds: filled in after sanitizing, because their blob: addresses do not pass DOMPurify
  src = replaceOutsideCode(src, /!\[\[([^\[\]\n|]+?)(?:\|([^\[\]\n]*?))?\]\]/, (all, t, l) => {
    const { target } = splitTarget(t);
    if (!hasFileExt(target) || resolveTarget(target)) return all;
    const f = findAsset(target, note); if (!f) return all;
    const kind = attKind(f.name); if (kind !== 'video' && kind !== 'audio') return all;
    const w = /^\d+$/.test((l || '').trim()) ? ` style="width:${+l}px"` : '';
    out.media.add(f.name);
    return `<${kind} class="mus-media" data-mus-asset="${esc(f.name)}" controls${w}></${kind}>`;
  });
  let html = renderMarkdown(src, { note, idPrefix: prefix, slides: true });
  html = finishSlideHtml(html, prefix, out);
  const notesHtml = notes.trim() ? finishSlideHtml(renderMarkdown(notes.trim(), { note, idPrefix: prefix + 'n-' }), prefix + 'n-', out) : '';
  const bg = slideBackground(attrs, note, out);
  for (const k of ['bg', 'data-background', 'data-background-color', 'data-background-image', 'data-background-size', 'data-background-position', 'data-background-repeat', 'data-background-opacity', 'data-background-gradient', 'data-background-video']) delete attrs[k];
  return { html, notes: notesHtml, attrs, bg, grid };
}

function slideBackground(a, note, out) {
  const raw = a.bg || a['data-background'] || '';
  const bg = {};
  if (a['data-background-color']) bg.color = a['data-background-color'];
  if (a['data-background-gradient']) bg.gradient = a['data-background-gradient'];
  const imgRaw = a['data-background-image'] || (raw && slideImageRef(raw)) || '';
  if (raw && !imgRaw) { if (/gradient\(/.test(raw)) bg.gradient = raw; else bg.color = raw; }
  if (imgRaw) {
    const ref = slideImageRef(imgRaw) || imgRaw;
    if (/^(https?:|data:|blob:)/.test(ref)) bg.image = ref;
    else { const f = findAsset(ref, note); if (f) { bg.asset = f.name; out.media.add(f.name); } }
  }
  if (a['data-background-size']) bg.size = a['data-background-size'];
  if (a['data-background-position']) bg.position = a['data-background-position'];
  if (a['data-background-repeat']) bg.repeat = a['data-background-repeat'];
  if (a['data-background-opacity']) bg.opacity = +a['data-background-opacity'];
  return Object.keys(bg).length ? bg : null;
}

/* After rendering: element annotations, layouts, media, and the Musubi enhancements (callouts, links). */
function finishSlideHtml(html, prefix, out) {
  const t = document.createElement('template'); t.innerHTML = html; const root = t.content;
  for (const m of Array.from(root.querySelectorAll('span[data-mus-el]'))) {
    let attrs = {}; try { attrs = JSON.parse(m.getAttribute('data-mus-el')); } catch (e) { /* ignore */ }
    let n = m.previousSibling; while (n && n.nodeType === 3 && !n.textContent.trim()) n = n.previousSibling;
    let target = n && n.nodeType === 1 && n.tagName !== 'BR' ? n : m.parentElement;
    const par = m.parentElement;
    if (par && target === par && par.tagName === 'P' && !par.textContent.trim() && par.children.length === 1 && par.previousElementSibling) { target = par.previousElementSibling; par.remove(); }
    m.remove();
    if (!target || target.nodeType !== 1) continue;
    for (const [k, v] of Object.entries(attrs)) {
      if (/^on/i.test(k)) continue;
      if (k === 'class') target.classList.add(...String(v).split(/\s+/).filter(Boolean));
      else if (k === 'style') target.setAttribute('style', ((target.getAttribute('style') || '') + ';' + v).replace(/^;/, ''));
      else target.setAttribute(k, v);
    }
  }
  for (const el of Array.from(root.querySelectorAll('.mus-split[data-split]'))) {
    let a = {}; try { a = JSON.parse(el.getAttribute('data-split')); } catch (e) { /* ignore */ }
    el.removeAttribute('data-split');
    const n = el.children.length || 1; const gap = a.gap != null ? (/^\d+(\.\d+)?$/.test(String(a.gap)) ? a.gap + '%' : a.gap) : '3%';
    const st = ['display:grid', 'column-gap:' + gap, 'row-gap:.6em', 'align-items:center'];
    if (a.left != null || a.middle != null || a.right != null) st.push('grid-template-columns:' + [a.left, a.middle, a.right].filter((x) => x != null).map((x) => (parseFloat(x) || 1) + 'fr').join(' '));
    else if (a.wrap != null) st.push(`grid-template-columns:repeat(${parseInt(a.wrap, 10) || 1}, 1fr)`);
    else if (a.even != null) st.push(`grid-template-columns:repeat(${n}, 1fr)`);
    else st.push('grid-auto-flow:column', 'grid-auto-columns:auto', 'justify-content:center');
    el.setAttribute('style', st.join(';'));
  }
  for (const el of Array.from(root.querySelectorAll('.att-card'))) {
    const name = el.getAttribute('data-att') || '';
    el.replaceWith(Object.assign(document.createElement('span'), { className: 'mus-file', textContent: name }));
  }
  enhanceRendered(root, prefix, { slides: true });
  for (const cb of root.querySelectorAll('input[type=checkbox]')) cb.disabled = true;
  for (const a of root.querySelectorAll('a.ext')) a.target = '_blank';
  return t.innerHTML;
}

/* Fill in media addresses (blob: URLs of attachments) in rendered HTML. */
function fillSlideMedia(html, urls) {
  if (!/data-mus-(asset|bg)/.test(html)) return html;
  const t = document.createElement('template'); t.innerHTML = html;
  for (const el of t.content.querySelectorAll('[data-mus-asset]')) { const u = urls.get(el.getAttribute('data-mus-asset')); if (u) el.setAttribute('src', u); el.removeAttribute('data-mus-asset'); }
  for (const el of t.content.querySelectorAll('[data-mus-bg]')) {
    const ref = el.getAttribute('data-mus-bg'); el.removeAttribute('data-mus-bg');
    const u = /^(https?:|data:)/.test(ref) ? ref : urls.get(ref) || (findAsset(ref) ? urls.get(findAsset(ref).name) : null);
    if (u) { el.style.backgroundImage = `url("${u}")`; el.style.backgroundSize = 'cover'; el.style.backgroundPosition = 'center'; }
  }
  return t.innerHTML;
}

/* The deck of a note. opts.text replaces the note's body (for the live preview). */
async function buildDeck(note, opts = {}) {
  const body = opts.text != null ? opts.text : note.body;
  const fm = slideFrontmatter(note);
  const cfg = slideConfig(fm);
  const out = { css: [], media: new Set(), cfg };
  const stacks = splitDeck(body, cfg);
  // a --- at the very end leaves an empty slide: drop it
  while (stacks.length > 1 && stacks[stacks.length - 1].length === 1 && !stacks[stacks.length - 1][0].src.trim()) stacks.pop();
  const prefix = 's' + note.id + '-';
  const slides = stacks.map((st, hh) => {
    const parts = st.map((p, v) => renderSlide(p, note, prefix + hh + '-' + v + '-', out));
    return parts.length > 1 ? { children: parts, attrs: {}, html: '' } : parts[0];
  });
  // grid backgrounds named in [[...]]
  for (const m of body.matchAll(/\bbg=["']\[\[([^\]|"']+)/g)) { const f = findAsset(m[1], note); if (f) out.media.add(f.name); }
  const urls = new Map();
  for (const name of out.media) { try { const u = await assetUrl(name); if (u) urls.set(name, u); } catch (e) { /* missing */ } }
  for (const [name, a] of vault.assets) if (a.url && !urls.has(name)) urls.set(name, a.url);
  const fill = (s) => {
    s.html = fillSlideMedia(s.html, urls);
    if (s.bg && s.bg.asset) s.bg.image = urls.get(s.bg.asset) || '';
    if (s.children) s.children.forEach(fill);
  };
  slides.forEach(fill);
  if (cfg.bg) cfg.bgSpec = slideBackground({ bg: cfg.bg }, note, out);
  if (cfg.bgSpec && cfg.bgSpec.asset) cfg.bgSpec.image = await assetUrl(cfg.bgSpec.asset);
  // theme: css/name.css or a .css file in the vault
  let themeCss = '';
  if (typeof cfg.theme === 'string' && /\.css$/i.test(cfg.theme)) {
    const f = findAsset(cfg.theme, note) || findAsset(cfg.theme.split('/').pop(), note);
    if (f) { try { const a = f.a; const blob = a.blob || (a.path && typeof readFolderFile === 'function' ? await readFolderFile(a.path) : null); if (blob) themeCss = await blob.text(); } catch (e) { /* ignore */ } }
    cfg.theme = themeCss ? 'none' : 'black';
  }
  return { title: note.title, config: cfg, slides, css: out.css.join('\n'), themeCss };
}

/* ---------- CSS ---------- */
/* reveal.js core layout and its theme template, rewritten for Musubi (MIT, reveal.js by Hakim El Hattab). */
const SLIDE_BASE_CSS = `
:host { display: block; }
*, *::before, *::after { box-sizing: border-box; }
.reveal-viewport { position: absolute; inset: 0; overflow: hidden; background: var(--r-background, var(--r-background-color)); background-color: var(--r-background-color); -webkit-print-color-adjust: exact; print-color-adjust: exact; }
.reveal { position: relative; width: 100%; height: 100%; overflow: hidden; touch-action: pinch-zoom; font-family: var(--r-main-font); font-size: var(--r-main-font-size); font-weight: normal; color: var(--r-main-color); line-height: 1.3; }
.reveal ::selection { background: var(--r-selection-background-color); color: var(--r-selection-color); }
.reveal .slides { position: absolute; text-align: center; z-index: 1; pointer-events: none; perspective: 600px; perspective-origin: 50% 40%; }
.reveal .slides.mus-stage { left: 50%; top: 50%; transform-origin: 50% 50%; }
.reveal .slides > section, .reveal .slides > section > section { position: absolute; left: 0; right: 0; top: 0; bottom: 0; margin: auto 0; width: 100%; height: fit-content; pointer-events: auto; z-index: 10; transform-style: flat;
  transition: transform var(--mus-speed) cubic-bezier(.26,.86,.44,.985), opacity var(--mus-speed) cubic-bezier(.26,.86,.44,.985), visibility var(--mus-speed) cubic-bezier(.26,.86,.44,.985); }
.reveal .slides > section.stack { height: 100%; margin: 0; }
.reveal .slides section.mus-has-grid, .reveal.mus-top .slides section:not(.stack) { height: 100%; margin: 0; }
.reveal .slides section.mus-overflow { bottom: auto; margin: 0; }
.reveal .slides section.present { visibility: visible; opacity: 1; z-index: 11; }
.reveal .slides section.past, .reveal .slides section.future { visibility: hidden; pointer-events: none; }
.reveal .slides > section[data-transition=slide].past { transform: translate(-150%, 0); }
.reveal .slides > section[data-transition=slide].future { transform: translate(150%, 0); }
.reveal .slides > section > section[data-transition=slide].past { transform: translate(0, -150%); }
.reveal .slides > section > section[data-transition=slide].future { transform: translate(0, 150%); }
.reveal .slides section[data-transition=fade].past, .reveal .slides section[data-transition=fade].future { opacity: 0; transform: none; }
.reveal .slides section[data-transition=none] { transition: none; }
.reveal .slides section[data-transition=none].past, .reveal .slides section[data-transition=none].future { opacity: 0; transform: none; }
.reveal .slides > section[data-transition=convex].past { opacity: 0; transform: translate3d(-100%,0,0) rotateY(-90deg) translate3d(-100%,0,0); }
.reveal .slides > section[data-transition=convex].future { opacity: 0; transform: translate3d(100%,0,0) rotateY(90deg) translate3d(100%,0,0); }
.reveal .slides > section[data-transition=concave].past { opacity: 0; transform: translate3d(-100%,0,0) rotateY(90deg) translate3d(-100%,0,0); }
.reveal .slides > section[data-transition=concave].future { opacity: 0; transform: translate3d(100%,0,0) rotateY(-90deg) translate3d(100%,0,0); }
.reveal .slides > section > section[data-transition=convex].past { opacity: 0; transform: translate3d(0,-300px,0) rotateX(70deg) translate3d(0,-300px,0); }
.reveal .slides > section > section[data-transition=convex].future { opacity: 0; transform: translate3d(0,300px,0) rotateX(-70deg) translate3d(0,300px,0); }
.reveal .slides > section > section[data-transition=concave].past { opacity: 0; transform: translate3d(0,-300px,0) rotateX(-70deg) translate3d(0,-300px,0); }
.reveal .slides > section > section[data-transition=concave].future { opacity: 0; transform: translate3d(0,300px,0) rotateX(70deg) translate3d(0,300px,0); }
.reveal .slides section[data-transition=zoom].past { opacity: 0; transform: scale(16); visibility: hidden; }
.reveal .slides section[data-transition=zoom].future { opacity: 0; transform: scale(.2); visibility: hidden; }
.reveal-viewport.mus-no-anim .slides section, .reveal-viewport.mus-no-anim .slide-background, .reveal-viewport.mus-no-anim .fragment { transition: none !important; }
.reveal .backgrounds { position: absolute; inset: 0; z-index: 0; }
.reveal .slide-background { position: absolute; inset: 0; opacity: 0; visibility: hidden; transition: opacity .6s ease, visibility .6s; }
.reveal .slide-background.present { opacity: 1; visibility: visible; }
.reveal .slide-background-content { position: absolute; inset: 0; background-size: cover; background-position: center; background-repeat: no-repeat; }
/* fragments */
.reveal .fragment { opacity: 0; visibility: hidden; transition: all .25s ease; }
.reveal .fragment.visible { opacity: 1; visibility: inherit; }
.reveal .fragment.fade-in-then-out.visible:not(.current-fragment), .reveal .fragment.current-visible.visible:not(.current-fragment) { opacity: 0; visibility: hidden; }
.reveal .fragment.fade-out { opacity: 1; visibility: inherit; } .reveal .fragment.fade-out.visible { opacity: 0; visibility: hidden; }
.reveal .fragment.semi-fade-out { opacity: 1; visibility: inherit; } .reveal .fragment.semi-fade-out.visible { opacity: .5; }
.reveal .fragment.fade-in-then-semi-out.visible:not(.current-fragment) { opacity: .5; }
.reveal .fragment.fade-up { transform: translate(0, 40px); } .reveal .fragment.fade-down { transform: translate(0, -40px); }
.reveal .fragment.fade-left { transform: translate(40px, 0); } .reveal .fragment.fade-right { transform: translate(-40px, 0); }
.reveal .fragment.fade-up.visible, .reveal .fragment.fade-down.visible, .reveal .fragment.fade-left.visible, .reveal .fragment.fade-right.visible { transform: none; }
.reveal .fragment.grow { opacity: 1; visibility: inherit; } .reveal .fragment.grow.visible { transform: scale(1.3); }
.reveal .fragment.shrink { opacity: 1; visibility: inherit; } .reveal .fragment.shrink.visible { transform: scale(.7); }
.reveal .fragment.zoom-in { transform: scale(.1); } .reveal .fragment.zoom-in.visible { transform: none; }
.reveal .fragment.strike { opacity: 1; visibility: inherit; } .reveal .fragment.strike.visible { text-decoration: line-through; }
.reveal .fragment.highlight-red, .reveal .fragment.highlight-green, .reveal .fragment.highlight-blue, .reveal .fragment.highlight-current-red, .reveal .fragment.highlight-current-green, .reveal .fragment.highlight-current-blue { opacity: 1; visibility: inherit; }
.reveal .fragment.highlight-red.visible { color: #ff2c2d; } .reveal .fragment.highlight-green.visible { color: #17ff2e; } .reveal .fragment.highlight-blue.visible { color: #1b91ff; }
.reveal .fragment.highlight-current-red.current-fragment { color: #ff2c2d; } .reveal .fragment.highlight-current-green.current-fragment { color: #17ff2e; } .reveal .fragment.highlight-current-blue.current-fragment { color: #1b91ff; }
.reveal .mus-grid.fragment.visible { visibility: visible; }
/* theme template */
.reveal h1, .reveal h2, .reveal h3, .reveal h4, .reveal h5, .reveal h6 { margin: var(--r-heading-margin); color: var(--r-heading-color); font-family: var(--r-heading-font); font-weight: var(--r-heading-font-weight); line-height: var(--r-heading-line-height); letter-spacing: var(--r-heading-letter-spacing); text-transform: var(--r-heading-text-transform); text-shadow: var(--r-heading-text-shadow); word-wrap: break-word; }
.reveal h1 { font-size: var(--r-heading1-size); text-shadow: var(--r-heading1-text-shadow); } .reveal h2 { font-size: var(--r-heading2-size); } .reveal h3 { font-size: var(--r-heading3-size); } .reveal h4 { font-size: var(--r-heading4-size); }
.reveal h1:last-child, .reveal h2:last-child, .reveal h3:last-child, .reveal h4:last-child, .reveal h5:last-child, .reveal h6:last-child { margin-bottom: 0; }
.reveal p { margin: var(--r-block-margin) 0; line-height: 1.3; }
.reveal img, .reveal video, .reveal iframe { max-width: 95%; max-height: 95%; }
.reveal img { margin: var(--r-block-margin) 0; }
.reveal strong, .reveal b { font-weight: bold; }
.reveal em { font-style: italic; }
.reveal ol, .reveal dl, .reveal ul { display: inline-block; text-align: left; margin: 0 0 0 1em; padding-left: 1em; }
.reveal ol { list-style-type: decimal; } .reveal ul { list-style-type: disc; } .reveal ul ul { list-style-type: square; } .reveal ul ul ul { list-style-type: circle; }
.reveal ul ul, .reveal ul ol, .reveal ol ol, .reveal ol ul { display: block; margin-left: 40px; }
.reveal li > p { margin: .2em 0; }
.reveal dt { font-weight: bold; } .reveal dd { margin-left: 40px; }
.reveal blockquote { display: block; position: relative; width: 70%; margin: var(--r-block-margin) auto; padding: 5px; font-style: italic; background: rgba(255,255,255,.05); box-shadow: 0 0 2px rgba(0,0,0,.2); }
.reveal blockquote p:first-child, .reveal blockquote p:last-child { display: inline-block; }
.reveal q { font-style: italic; }
.reveal pre { display: block; position: relative; width: 90%; margin: var(--r-block-margin) auto; text-align: left; font-size: .55em; font-family: var(--r-code-font); line-height: 1.2em; word-wrap: break-word; box-shadow: 0 5px 15px rgba(0,0,0,.15); }
.reveal code { font-family: var(--r-code-font); text-transform: none; tab-size: 2; }
.reveal pre code { display: block; padding: 5px; overflow: auto; max-height: 400px; word-wrap: normal; background: rgba(0,0,0,.25); }
.reveal table { margin: auto; border-collapse: collapse; border-spacing: 0; }
.reveal table th { font-weight: bold; }
.reveal table th, .reveal table td { text-align: left; padding: .2em .5em; border-bottom: 1px solid; }
.reveal table th[align=center], .reveal table td[align=center] { text-align: center; }
.reveal table th[align=right], .reveal table td[align=right] { text-align: right; }
.reveal table tbody tr:last-child th, .reveal table tbody tr:last-child td { border-bottom: none; }
.reveal sup { vertical-align: super; font-size: smaller; } .reveal sub { vertical-align: sub; font-size: smaller; }
.reveal small { display: inline-block; font-size: .6em; line-height: 1.2em; vertical-align: top; }
.reveal a { color: var(--r-link-color); text-decoration: none; transition: color .15s ease; }
.reveal a:hover { color: var(--r-link-color-hover); }
.reveal hr { border: 0; border-top: 1px solid currentColor; opacity: .4; margin: var(--r-block-margin) auto; width: 60%; }
.reveal .r-stretch { max-width: none; max-height: none; }
.reveal .r-frame { border: 4px solid var(--r-main-color); box-shadow: 0 0 10px rgba(0,0,0,.15); }
/* Musubi constructs inside slides */
.reveal .math-display { display: block; margin: .45em 0; } .reveal .math-display .katex-display { margin: 0; } .reveal .eq-anchor, .reveal .blk-anchor { display: none; }
.reveal .katex-display > .katex { white-space: nowrap; }
.reveal .math-error, .reveal .katex-error { color: #d5978d; }
.reveal .env, .reveal .callout { text-align: left; margin: .6em auto; padding: .45em .9em .55em; border-left: 3px solid var(--r-link-color); background: color-mix(in srgb, var(--r-link-color) 9%, transparent); font-size: .82em; font-style: normal; width: auto; box-shadow: none; }
.reveal .env-head, .reveal .callout-title { font-variant-caps: small-caps; letter-spacing: .06em; color: var(--r-link-color); font-weight: 600; margin-bottom: .2em; }
.reveal .env-name { font-style: italic; } .reveal .env-style-thm > p { font-style: italic; }
.reveal .env > p:first-of-type, .reveal .callout > p { margin-top: .2em; } .reveal .env > :last-child, .reveal .callout > :last-child { margin-bottom: 0; }
.reveal .env-style-proof { background: transparent; } .reveal .env-style-proof::after { content: '\\220E'; display: block; text-align: right; }
.reveal .env-style-proof .env-head, .reveal .env-style-rem .env-head { font-style: italic; font-variant-caps: normal; letter-spacing: 0; }
.reveal .env-style-warn, .reveal .callout-warning, .reveal .callout-danger, .reveal .callout-caution { border-left-color: #d5978d; }
.reveal .env-style-quote { border-left-width: 1px; background: transparent; font-style: italic; }
.reveal .blk-ic { display: inline-block; width: .92em; height: .92em; vertical-align: -.12em; margin-right: .45em; }
.reveal .arg-body { display: grid; grid-template-columns: auto 1fr auto; column-gap: .8em; row-gap: .15em; align-items: baseline; }
.reveal .arg-row { display: contents; } .reveal .arg-label { color: var(--r-link-color); text-align: right; font-variant-caps: small-caps; }
.reveal .arg-just { font-size: .8em; font-style: italic; opacity: .8; } .reveal .arg-rule { grid-column: 2 / 3; border-top: 1px solid currentColor; opacity: .6; }
.reveal .arg-concl .arg-label::before { content: '∴ '; }
.reveal .qa { text-align: left; margin: .5em auto; font-size: .85em; } .reveal .qa-q, .reveal .qa-a { display: flex; gap: .7em; } .reveal .qa-k { color: var(--r-link-color); font-variant-caps: small-caps; }
.reveal mark { background: color-mix(in srgb, var(--r-link-color) 30%, transparent); color: inherit; padding: 0 .1em; }
.reveal a.wl, .reveal a.cite-ref, .reveal a.tag { color: var(--r-link-color); }
.reveal a.wl.broken { opacity: .7; text-decoration: underline dotted; }
.reveal .rel { font-size: .7em; opacity: .7; margin-right: .3em; font-variant-caps: small-caps; }
.reveal .asset-missing, .reveal .mus-file { display: inline-block; font-size: .5em; padding: .3em .6em; border: 1px dashed currentColor; opacity: .75; }
.reveal .embed { text-align: left; margin: .5em 0; } .reveal .embed-head { display: none; }
.reveal .footnotes { font-size: .45em; text-align: left; margin-top: 1em; opacity: .8; }
.reveal .footnotes ol { display: block; }
.reveal .table-wrap { overflow: visible; }
.reveal li.task { list-style: none; } .reveal li.task input { margin-right: .4em; }
.reveal .mus-media { max-width: 95%; }
.reveal .plot { margin: .5em auto; }
`;

const SLIDE_THEMES = {
  istari: { bg: '#12100e', main: '#d6ccb4', head: '#ebe1c8', link: '#c4a24d', hover: '#e3c46c', font: '"EB Garamond", Garamond, "Times New Roman", serif', head_font: '"Cormorant Garamond", "EB Garamond", Garamond, serif', size: '40px', weight: 500, transform: 'none', sel: 'rgba(196,162,77,.35)',
    extra: '.reveal { font-variant-numeric: oldstyle-nums; } .reveal h2 { color: #c4a24d; } .reveal strong, .reveal b { font-weight: 600; font-variant-caps: small-caps; letter-spacing: .04em; } .reveal table { border-top: 1.5px solid #8f7639; border-bottom: 1.5px solid #8f7639; } .reveal table th { border-bottom: 1px solid #8f7639; font-weight: 500; font-variant-caps: small-caps; } .reveal table td, .reveal table th { border-color: transparent; font-variant-numeric: lining-nums tabular-nums; } .reveal li::marker { color: #8f7639; } .reveal hr { border: 0; height: 1px; background: linear-gradient(90deg, transparent, #8f7639, transparent); opacity: 1; }' },
  paper: { bg: '#f3ecdc', main: '#2e2820', head: '#1f1b15', link: '#8a6a1c', hover: '#6d5313', font: '"EB Garamond", Garamond, "Times New Roman", serif', head_font: '"Cormorant Garamond", "EB Garamond", Garamond, serif', size: '40px', weight: 500, transform: 'none', sel: 'rgba(138,106,28,.25)',
    extra: '.reveal { font-variant-numeric: oldstyle-nums; } .reveal h2 { color: #8a6a1c; } .reveal strong, .reveal b { font-weight: 600; font-variant-caps: small-caps; letter-spacing: .04em; } .reveal li::marker { color: #8a6a1c; }' },
  black: { bg: '#191919', main: '#fff', head: '#fff', link: '#42affa', hover: '#8dcffc', font: '"Source Sans Pro", Helvetica, Arial, sans-serif', size: '42px', weight: 600, transform: 'uppercase', sel: '#bee4fd', selColor: '#fff' },
  white: { bg: '#fff', main: '#222', head: '#222', link: '#2a76dd', hover: '#6ca0e8', font: '"Source Sans Pro", Helvetica, Arial, sans-serif', size: '42px', weight: 600, transform: 'uppercase', sel: '#98bdef', selColor: '#fff' },
  league: { bg: '#2b2b2b', gradient: 'radial-gradient(#555a5f, #1c1e20)', main: '#eee', head: '#eee', link: '#13daec', hover: '#71e9f4', font: 'Lato, "Helvetica Neue", Helvetica, sans-serif', head_font: '"League Gothic", Impact, "Arial Narrow", sans-serif', size: '40px', weight: 'normal', transform: 'uppercase', shadow: '0 1px 0 #ccc, 0 2px 0 #c9c9c9, 0 3px 0 #bbb, 0 4px 0 #b9b9b9, 0 5px 0 #aaa, 0 6px 1px rgba(0,0,0,.1), 0 0 5px rgba(0,0,0,.1), 0 1px 3px rgba(0,0,0,.3), 0 3px 5px rgba(0,0,0,.2), 0 5px 10px rgba(0,0,0,.25), 0 20px 20px rgba(0,0,0,.15)', h1shadow: true, sel: '#ff5e99' },
  beige: { bg: '#f7f3de', gradient: 'radial-gradient(rgb(255,255,255), rgb(247,242,211))', main: '#333', head: '#333', link: '#8b743d', hover: '#c0a86e', font: 'Lato, "Helvetica Neue", Helvetica, sans-serif', head_font: '"League Gothic", Impact, "Arial Narrow", sans-serif', size: '40px', weight: 'normal', transform: 'uppercase', sel: 'rgba(79,64,28,.99)', selColor: '#fff' },
  sky: { bg: '#f7fbfc', gradient: 'radial-gradient(#f7fbfc, #add9e4)', main: '#333', head: '#333', link: '#3b759e', hover: '#74a7cb', font: '"Open Sans", Helvetica, sans-serif', head_font: 'Quicksand, Helvetica, sans-serif', size: '40px', weight: 'normal', transform: 'uppercase', spacing: '-.08em', sel: '#134674', selColor: '#fff' },
  night: { bg: '#111', main: '#eee', head: '#eee', link: '#e7ad52', hover: '#f3d7ac', font: '"Open Sans", Helvetica, sans-serif', head_font: 'Montserrat, Impact, sans-serif', size: '40px', weight: 'normal', transform: 'none', spacing: '-.03em', sel: '#e7ad52' },
  serif: { bg: '#f0f1eb', main: '#000', head: '#383d3d', link: '#51483d', hover: '#8b7c69', font: '"Palatino Linotype", "Book Antiqua", Palatino, FreeSerif, serif', size: '40px', weight: 'normal', transform: 'none', sel: '#26351c', selColor: '#fff' },
  simple: { bg: '#fff', main: '#000', head: '#000', link: '#00008b', hover: '#0000f1', font: 'Lato, sans-serif', head_font: '"News Cycle", Impact, sans-serif', size: '40px', weight: 'normal', transform: 'none', sel: 'rgba(0,0,0,.99)', selColor: '#fff' },
  solarized: { bg: '#fdf6e3', main: '#657b83', head: '#586e75', link: '#268bd2', hover: '#78b9e6', font: 'Lato, sans-serif', head_font: '"League Gothic", Impact, sans-serif', size: '40px', weight: 'normal', transform: 'uppercase', sel: '#d33682' },
  moon: { bg: '#002b36', main: '#93a1a1', head: '#eee8d5', link: '#268bd2', hover: '#78b9e6', font: 'Lato, sans-serif', head_font: '"League Gothic", Impact, sans-serif', size: '40px', weight: 'normal', transform: 'uppercase', sel: '#d33682' },
  blood: { bg: '#222', main: '#eee', head: '#eee', link: '#a23', hover: '#dd5566', font: 'Ubuntu, "sans-serif"', size: '40px', weight: 'normal', transform: 'uppercase', shadow: '2px 2px 2px #222', sel: '#a23' },
  dracula: { bg: '#282a36', main: '#f8f8f2', head: '#bd93f9', link: '#ff79c6', hover: '#8be9fd', font: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Oxygen, Ubuntu, Cantarell, "Fira Sans", "Droid Sans", "Helvetica Neue", sans-serif', size: '40px', weight: 'bold', transform: 'none', sel: '#44475a', extra: '.reveal strong, .reveal b { color: #ffb86c; } .reveal em, .reveal i { color: #f1fa8c; }' },
};
const SLIDE_THEME_LABELS = [['istari', 'Istari (dark, the Musubi look)'], ['paper', 'Istari Paper (light)'], ['black', 'Black (reveal.js and Advanced Slides default)'], ['white', 'White'], ['league', 'League'], ['beige', 'Beige'], ['sky', 'Sky'], ['night', 'Night'], ['serif', 'Serif'], ['simple', 'Simple'], ['solarized', 'Solarized'], ['moon', 'Moon'], ['blood', 'Blood'], ['dracula', 'Dracula']];

function slideThemeCss(name) {
  if (name === 'none') return '.reveal-viewport { --r-background-color: #191919; --r-main-font: sans-serif; --r-main-font-size: 40px; --r-main-color: #fff; --r-heading-color: #fff; --r-heading-font: sans-serif; --r-link-color: #42affa; --r-heading-margin: 0 0 20px 0; --r-block-margin: 20px; --r-heading-line-height: 1.2; --r-heading1-size: 2.5em; --r-heading2-size: 1.6em; --r-heading3-size: 1.3em; --r-heading4-size: 1em; --r-code-font: monospace; }';
  const t = SLIDE_THEMES[name] || SLIDE_THEMES.istari;
  const vars = {
    '--r-background-color': t.bg, '--r-background': t.gradient || t.bg, '--r-main-font': t.font, '--r-main-font-size': t.size, '--r-main-color': t.main,
    '--r-block-margin': '20px', '--r-heading-margin': '0 0 20px 0', '--r-heading-font': t.head_font || t.font, '--r-heading-color': t.head,
    '--r-heading-line-height': '1.2', '--r-heading-letter-spacing': t.spacing || 'normal', '--r-heading-text-transform': t.transform,
    '--r-heading-text-shadow': t.shadow || 'none', '--r-heading-font-weight': String(t.weight), '--r-heading1-text-shadow': t.h1shadow ? t.shadow : 'none',
    '--r-heading1-size': '2.5em', '--r-heading2-size': '1.6em', '--r-heading3-size': '1.3em', '--r-heading4-size': '1em',
    '--r-code-font': '"JetBrains Mono", monospace', '--r-link-color': t.link, '--r-link-color-dark': t.link, '--r-link-color-hover': t.hover,
    '--r-selection-background-color': t.sel, '--r-selection-color': t.selColor || 'inherit',
  };
  return '.reveal-viewport {' + Object.entries(vars).map(([k, v]) => `${k}: ${v};`).join(' ') + '}\n' + (t.extra || '');
}

/* The chrome around the slides: controls, progress, toolbars, overview, help, speaker view. */
const SLIDE_CHROME_CSS = `
.reveal-viewport { --mus-speed: .8s; outline: none; }
.reveal-viewport[data-speed=fast] { --mus-speed: .4s; } .reveal-viewport[data-speed=slow] { --mus-speed: 1.2s; }
.reveal .controls { position: absolute; right: 14px; bottom: 14px; width: 92px; height: 92px; z-index: 12; color: var(--r-link-color); pointer-events: none; }
.reveal .controls button { position: absolute; width: 30px; height: 30px; padding: 0; border: 0; background: none; color: inherit; cursor: pointer; opacity: .1; pointer-events: none; transition: opacity .2s, transform .2s; }
.reveal .controls button.enabled { opacity: .75; pointer-events: auto; } .reveal .controls button.enabled:hover { opacity: 1; }
.reveal .controls svg { width: 100%; height: 100%; display: block; }
.reveal .controls .navigate-left { left: 0; top: 31px; } .reveal .controls .navigate-right { right: 0; top: 31px; }
.reveal .controls .navigate-up { left: 31px; top: 0; } .reveal .controls .navigate-down { left: 31px; bottom: 0; }
.reveal .controls .navigate-up, .reveal .controls .navigate-down { display: none; } .reveal.mus-has-v .controls .navigate-up, .reveal.mus-has-v .controls .navigate-down { display: block; }
.reveal .progress { position: absolute; left: 0; right: 0; bottom: 0; height: 3px; z-index: 12; background: rgba(0,0,0,.2); color: var(--r-link-color); }
.reveal .progress span { display: block; height: 100%; width: 0; background: currentColor; transition: width .8s cubic-bezier(.26,.86,.44,.985); }
.reveal .slide-number { position: absolute; right: 8px; bottom: 8px; z-index: 31; font-family: Helvetica, sans-serif; font-size: 12px; line-height: 1; color: #fff; background: rgba(0,0,0,.4); padding: 5px; }
.reveal .mus-timebar { position: absolute; left: 0; right: 0; top: 0; height: 3px; z-index: 12; } .reveal .mus-timebar span { display: block; height: 100%; width: 0; background: var(--r-link-color); opacity: .6; transition: width 1s linear; }
.mus-mode-preview .reveal .controls { transform: scale(.8); transform-origin: 100% 100%; right: 6px; bottom: 6px; }
.mus-tools { position: absolute; top: 12px; right: 12px; z-index: 40; display: flex; gap: 2px; padding: 3px; border-radius: 8px; background: rgba(13,12,10,.62); backdrop-filter: blur(6px); transition: opacity .35s; }
.mus-tools button { width: 34px; height: 34px; border: 0; border-radius: 6px; background: none; color: #d6ccb4; cursor: pointer; display: grid; place-items: center; }
.mus-tools button:hover { background: rgba(196,162,77,.18); color: #ebe1c8; } .mus-tools svg { width: 19px; height: 19px; }
.reveal-viewport.mus-idle .mus-tools { opacity: 0; pointer-events: none; } .reveal-viewport.mus-idle { cursor: none; }
.mus-mode-preview .mus-tools, .mus-mode-print .mus-tools { display: none; }
.mus-black { position: absolute; inset: 0; z-index: 45; background: #000; display: none; } .reveal-viewport.mus-blackout .mus-black { display: block; }
.mus-jump { position: absolute; left: 50%; top: 40%; transform: translate(-50%,-50%); z-index: 46; font: 500 42px/1 "Cormorant Garamond", Georgia, serif; color: #ebe1c8; background: rgba(13,12,10,.85); padding: 14px 26px; border: 1px solid #8f7639; border-radius: 6px; display: none; }
.mus-layer { position: absolute; inset: 0; z-index: 42; display: none; overflow: auto; background: rgba(13,12,10,.94); color: #d6ccb4; font-family: "EB Garamond", Georgia, serif; }
.reveal-viewport.mus-ov-on .mus-overview, .reveal-viewport.mus-help-on .mus-help, .reveal-viewport.mus-spk-on .mus-spk-inline { display: block; }
.mus-overview-grid { display: flex; flex-wrap: wrap; gap: 22px; padding: 30px; align-items: flex-start; justify-content: center; }
.mus-ov-col { display: flex; flex-direction: column; gap: 14px; }
.mus-ov-item { position: relative; padding: 0; border: 1px solid #2a251d; background: #0d0c0a; cursor: pointer; overflow: hidden; transition: border-color .15s, transform .15s; }
.mus-ov-item:hover { border-color: #8f7639; } .mus-ov-item.sel { border-color: #c4a24d; box-shadow: 0 0 0 2px rgba(196,162,77,.45); }
.mus-ov-item.cur::after { content: ''; position: absolute; left: 0; right: 0; bottom: 0; height: 3px; background: #c4a24d; }
.mus-ov-num { position: absolute; left: 6px; top: 4px; z-index: 5; font: 12px/1 Helvetica, sans-serif; color: #ebe1c8; background: rgba(0,0,0,.55); padding: 3px 5px; }
.mus-thumb { position: relative; overflow: hidden; }
.mus-thumb > .reveal { position: absolute; inset: 0; width: auto; height: auto; background: var(--r-background, var(--r-background-color)); }
.mus-thumb .slides.mus-thumb-slides { left: 0; top: 0; transform-origin: 0 0; }
.mus-thumb .slides.mus-thumb-slides > section { display: block !important; visibility: visible !important; opacity: 1 !important; transform: none !important; transition: none !important; }
.mus-thumb .fragment { transition: none !important; }
.mus-help-box { max-width: 560px; margin: 8vh auto; padding: 24px 32px; border-left: 2px solid #c4a24d; background: #12100e; }
.mus-help-box h3 { margin: 0 0 10px; font: 500 28px "Cormorant Garamond", Georgia, serif; color: #c4a24d; }
.mus-help-box table { width: 100%; border-collapse: collapse; font-size: 17px; } .mus-help-box td { padding: 4px 8px; border-bottom: 1px solid #2a251d; }
.mus-help-box td:first-child { white-space: nowrap; color: #ebe1c8; font-family: "JetBrains Mono", monospace; font-size: 14px; }
.mus-print { display: none; }
@media print {
  .reveal-viewport { display: none !important; }
  .mus-print { display: block; }
  .mus-print-page { position: relative; overflow: hidden; break-after: page; page-break-after: always; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  .mus-print-page > .reveal-viewport { display: block !important; }
  .mus-print-page .fragment { opacity: 1 !important; visibility: visible !important; }
}
`;

const SLIDE_SPEAKER_CSS = `
.spk { position: absolute; inset: 0; display: grid; grid-template-rows: auto 1fr; background: #0d0c0a; color: #d6ccb4; font-family: "EB Garamond", Georgia, serif; }
body > .spk { position: fixed; }
.spk-top { display: flex; align-items: center; gap: 22px; padding: 10px 18px; border-bottom: 1px solid #2a251d; font-size: 17px; }
.spk-title { font: 500 21px "Cormorant Garamond", Georgia, serif; color: #ebe1c8; flex: 1; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.spk-count { color: #948b76; font-variant-numeric: lining-nums tabular-nums; }
.spk-time { display: flex; align-items: center; gap: 8px; font-variant-numeric: lining-nums tabular-nums; }
.spk-elapsed { font: 600 26px "JetBrains Mono", monospace; color: #c4a24d; } .spk-elapsed.over { color: #d5978d; } .spk-elapsed.paused { opacity: .5; }
.spk-left { color: #948b76; font-size: 15px; }
.spk-clock { color: #948b76; font-family: "JetBrains Mono", monospace; font-size: 15px; }
.spk button { font: inherit; font-size: 14px; color: #d6ccb4; background: #1a1714; border: 1px solid #2a251d; border-radius: 5px; padding: 3px 10px; cursor: pointer; }
.spk button:hover { border-color: #8f7639; color: #ebe1c8; }
.spk-main { display: grid; grid-template-columns: 1.55fr 1fr; gap: 16px; padding: 16px; min-height: 0; }
.spk-col { display: flex; flex-direction: column; gap: 12px; min-height: 0; }
.spk-label { font-variant-caps: all-small-caps; letter-spacing: .12em; color: #948b76; font-size: 15px; display: flex; align-items: center; gap: 8px; }
.spk-label .grow { flex: 1; }
.spk-frame { position: relative; flex: 1; min-height: 0; }
.spk-next-wrap { flex: 0 0 34%; display: flex; flex-direction: column; min-height: 0; }
.spk-frame > .mus-thumb-host { position: absolute; inset: 0; }
.spk-end { position: absolute; inset: 0; display: grid; place-items: center; color: #948b76; border: 1px dashed #2a251d; font-style: italic; }
.spk-notes { flex: 1; overflow: auto; padding: 10px 14px; border-left: 2px solid #8f7639; background: #12100e; font-size: var(--spk-size, 24px); line-height: 1.4; }
.spk-notes p { margin: 0 0 .6em; } .spk-notes .katex { font-size: 1.05em; } .spk-notes a { color: #c4a24d; }
.spk-notes .spk-none { color: #948b76; font-style: italic; }
.spk-nav { display: flex; gap: 8px; }
`;

/* ---------- the runtime (self-contained: also written into exported HTML files) ---------- */
function musubiSlideRuntime(env) {
  const doc = env.host.ownerDocument; const win = doc.defaultView;
  const mode = env.mode || 'present';
  let deck = env.deck; let cfg = deck.config;
  const W = () => +cfg.width || 960; const H = () => +cfg.height || 700;
  const mk = (d, tag, cls, html) => { const el = d.createElement(tag); if (cls) el.className = cls; if (html != null) el.innerHTML = html; return el; };
  const ico = (p) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">${p}</svg>`;
  const IC = {
    left: ico('<path d="M15 5 8 12l7 7"/>'), right: ico('<path d="M9 5l7 7-7 7"/>'), up: ico('<path d="M5 15l7-7 7 7"/>'), down: ico('<path d="M5 9l7 7 7-7"/>'),
    grid: ico('<rect x="3.5" y="3.5" width="7" height="7"/><rect x="13.5" y="3.5" width="7" height="7"/><rect x="3.5" y="13.5" width="7" height="7"/><rect x="13.5" y="13.5" width="7" height="7"/>'),
    speaker: ico('<rect x="3" y="4" width="18" height="12" rx="1"/><path d="M7 20h10M12 16v4"/><path d="M6.5 8h6M6.5 11h4"/>'),
    full: ico('<path d="M4 9V4h5M15 4h5v5M20 15v5h-5M9 20H4v-5"/>'),
    print: ico('<path d="M7 9V3.5h10V9"/><rect x="3.5" y="9" width="17" height="8" rx="1"/><path d="M7 14h10v6.5H7z"/>'),
    help: ico('<circle cx="12" cy="12" r="8.6"/><path d="M9.6 9.6a2.5 2.5 0 1 1 3.5 2.3c-.7.3-1.1.8-1.1 1.5v.7"/><circle cx="12" cy="16.9" r=".6" fill="currentColor"/>'),
    exit: ico('<path d="M6 6l12 12M18 6 6 18"/>'),
  };
  const root = env.host.shadowRoot || env.host.attachShadow({ mode: 'open' });
  root.innerHTML = '';
  const styleEl = mk(doc, 'style'); styleEl.textContent = env.css || ''; root.appendChild(styleEl);
  const vp = mk(doc, 'div', 'reveal-viewport mus-no-anim mus-mode-' + mode); vp.tabIndex = -1;
  const rv = mk(doc, 'div', 'reveal');
  const bgLayer = mk(doc, 'div', 'backgrounds'); const slidesEl = mk(doc, 'div', 'slides mus-stage');
  const controls = mk(doc, 'aside', 'controls');
  const btn = (cls, label, html, fn) => { const b = mk(doc, 'button', cls, html); b.type = 'button'; b.setAttribute('aria-label', label); b.title = label; b.addEventListener('click', (e) => { e.stopPropagation(); fn(); }); return b; };
  const bL = btn('navigate-left', 'Previous slide', IC.left, () => left()); const bR = btn('navigate-right', 'Next slide', IC.right, () => right());
  const bU = btn('navigate-up', 'Slide above', IC.up, () => up()); const bD = btn('navigate-down', 'Slide below', IC.down, () => down());
  controls.append(bL, bR, bU, bD);
  const progress = mk(doc, 'div', 'progress', '<span></span>'); const number = mk(doc, 'div', 'slide-number'); const timebar = mk(doc, 'div', 'mus-timebar', '<span></span>');
  rv.append(bgLayer, slidesEl, controls, progress, number, timebar);
  const tools = mk(doc, 'div', 'mus-tools');
  tools.append(btn('', 'Overview (O)', IC.grid, () => toggleOverview()), btn('', 'Speaker view (S)', IC.speaker, () => openSpeaker()),
    btn('', 'Full screen (F)', IC.full, () => toggleFullscreen()), btn('', 'Print or save as PDF', IC.print, () => (env.onPrint ? env.onPrint() : printPages())),
    btn('', 'Keys (?)', IC.help, () => toggleHelp()));
  if (mode === 'present') tools.append(btn('', 'End the presentation (Esc)', IC.exit, () => exit()));
  const overview = mk(doc, 'div', 'mus-layer mus-overview'); const help = mk(doc, 'div', 'mus-layer mus-help'); const spkInline = mk(doc, 'div', 'mus-layer mus-spk-inline');
  const black = mk(doc, 'div', 'mus-black'); const jump = mk(doc, 'div', 'mus-jump');
  vp.append(rv, tools, overview, help, spkInline, black, jump);
  root.appendChild(vp);

  let stacks = []; let flat = []; let st = { h: 0, v: 0, f: -1 }; let ovOpen = false; let ovSel = 0; let helpOpen = false; let jumpBuf = ''; let jumpT = null;
  let curScale = 1; let spk = null; let spkInlineObj = null; let autoT = null; let idleT = null; let destroyed = false;
  const timer = { start: Date.now(), paused: 0, pausedAt: 0 };
  const elapsed = () => Math.max(0, ((timer.pausedAt || Date.now()) - timer.start - timer.paused) / 1000);

  function applyAttrs(el, a) {
    for (const [k, v] of Object.entries(a || {})) {
      if (/^on/i.test(k)) continue;
      if (k === 'class') el.classList.add(...String(v).split(/\s+/).filter(Boolean));
      else if (k === 'style') el.setAttribute('style', ((el.getAttribute('style') || '') + ';' + v).replace(/^;/, ''));
      else el.setAttribute(k, v);
    }
  }
  function mkSection(s) {
    const el = mk(doc, 'section'); el.innerHTML = s.html || ''; applyAttrs(el, s.attrs);
    if (!el.getAttribute('data-transition')) el.setAttribute('data-transition', String(cfg.transition || 'slide').split(/[\s-]/)[0]);
    if (s.grid) el.classList.add('mus-has-grid');
    return el;
  }
  function paintBg(target, spec) {
    const c = mk(doc, 'div', 'slide-background-content');
    if (spec) {
      if (spec.color) target.style.backgroundColor = spec.color;
      const imgs = []; if (spec.image) imgs.push(`url("${spec.image}")`); if (spec.gradient) imgs.push(spec.gradient);
      if (imgs.length) c.style.backgroundImage = imgs.join(',');
      if (spec.size) c.style.backgroundSize = spec.size; if (spec.position) c.style.backgroundPosition = spec.position; if (spec.repeat) c.style.backgroundRepeat = spec.repeat;
      if (spec.opacity != null && !isNaN(spec.opacity)) c.style.opacity = spec.opacity;
    }
    target.appendChild(c);
  }
  function fragGroups(sec) {
    const els = Array.from(sec.querySelectorAll('.fragment')).filter((el) => el.closest('section') === sec);
    const idx = new Map(); const loose = [];
    for (const el of els) {
      if (el.hasAttribute('data-fragment-index')) { const k = +el.getAttribute('data-fragment-index') || 0; if (!idx.has(k)) idx.set(k, []); idx.get(k).push(el); }
      else loose.push([el]);
    }
    return [...Array.from(idx.keys()).sort((a, b) => a - b).map((k) => idx.get(k)), ...loose];
  }
  function setFrags(groups, f) { groups.forEach((g, i) => g.forEach((el) => { el.classList.toggle('visible', i <= f); el.classList.toggle('current-fragment', i === f); })); }

  function build() {
    slidesEl.innerHTML = ''; bgLayer.innerHTML = ''; stacks = []; flat = [];
    (deck.slides || []).forEach((s, h) => {
      if (s.children && s.children.length) {
        const el = mk(doc, 'section', 'stack'); applyAttrs(el, s.attrs);
        el.setAttribute('data-transition', String(cfg.transition || 'slide').split(/[\s-]/)[0]);
        const kids = s.children.map((c, v) => { const k = mkSection(c); el.appendChild(k); flat.push({ h, v, el: k, data: c }); return k; });
        slidesEl.appendChild(el); stacks.push({ el, kids });
      } else {
        const el = mkSection(s); slidesEl.appendChild(el); stacks.push({ el, kids: null }); flat.push({ h, v: 0, el, data: s });
      }
    });
    if (!stacks.length) { const el = mkSection({ html: '' }); slidesEl.appendChild(el); stacks.push({ el, kids: null }); flat.push({ h: 0, v: 0, el, data: { html: '' } }); }
    const noFrags = cfg.fragments === false || mode === 'preview'; // the preview shows each slide whole
    flat.forEach((e, i) => { e.i = i; e.frags = noFrags ? [] : fragGroups(e.el); if (noFrags) e.el.querySelectorAll('.fragment').forEach((x) => x.classList.add('visible')); e.bg = mk(doc, 'div', 'slide-background'); paintBg(e.bg, e.data.bg || cfg.bgSpec); bgLayer.appendChild(e.bg); });
    rv.classList.toggle('mus-has-v', stacks.some((s) => s.kids));
    rv.classList.toggle('mus-top', cfg.center === false);
    vp.setAttribute('data-speed', String(cfg.transitionSpeed || 'default'));
    controls.style.display = cfg.controls === false && mode !== 'preview' ? 'none' : '';
    progress.style.display = cfg.progress === false ? 'none' : '';
    timebar.style.display = cfg.timeForPresentation > 0 && mode !== 'preview' ? '' : 'none';
    layout();
  }
  const entryAt = (h, v) => flat.find((e) => e.h === h && e.v === v) || flat[0];
  const cur = () => entryAt(st.h, st.v);

  function setPos(el, d) { el.classList.toggle('past', d < 0); el.classList.toggle('present', d === 0); el.classList.toggle('future', d > 0); }
  function go(h, v, f, quiet) {
    if (!stacks.length) return;
    h = Math.max(0, Math.min(stacks.length - 1, h | 0));
    const S = stacks[h]; v = S.kids ? Math.max(0, Math.min(S.kids.length - 1, v | 0)) : 0;
    const e = entryAt(h, v); const n = e.frags.length;
    if (f === 'last') f = n - 1; f = Math.max(-1, Math.min(n - 1, f == null ? -1 : f));
    const moved = h !== st.h || v !== st.v;
    st = { h, v, f };
    stacks.forEach((s, i) => {
      setPos(s.el, i - h); s.el.style.display = Math.abs(i - h) <= 1 ? '' : 'none';
      if (s.kids) {
        const vv = i === h ? v : i < h ? s.kids.length - 1 : 0;
        s.kids.forEach((k, j) => { setPos(k, j - vv); k.style.display = Math.abs(j - vv) <= 1 ? '' : 'none'; });
      }
    });
    for (const x of flat) {
      if (x === e) continue;
      const before = x.h < h || (x.h === h && x.v < v);
      setFrags(x.frags, before ? x.frags.length - 1 : -1);
    }
    setFrags(e.frags, f);
    flat.forEach((x) => x.bg.classList.toggle('present', x === e));
    if (moved) media(e);
    updateChrome(); fit(e);
    if (env.hash) { try { win.history.replaceState(null, '', '#/' + h + (v ? '/' + v : '')); } catch (err) { /* file: URLs */ } }
    if (autoT) clearTimeout(autoT);
    if (cfg.autoSlide > 0 && mode !== 'preview') autoT = setTimeout(() => next(), cfg.autoSlide);
    if (!quiet && env.onChange) env.onChange(Object.assign({}, st));
    renderSpeaker();
  }
  function media(e) {
    for (const x of flat) if (x !== e) x.el.querySelectorAll('video, audio').forEach((m) => { try { m.pause(); } catch (err) { /* ignore */ } });
    e.el.querySelectorAll('video[data-autoplay], audio[data-autoplay]').forEach((m) => { try { m.play(); } catch (err) { /* ignore */ } });
  }
  /* A slide taller than the slide box: shrink it to fit (autoFit), or show it from the top. */
  function fitSection(el) {
    el.classList.remove('mus-overflow'); el.style.zoom = '';
    if (el.classList.contains('mus-has-grid') || el.classList.contains('stack')) return;
    // offsetHeight ignores transforms; under CSS zoom the text reflows at full width and the visual height is offsetHeight × zoom
    const h0 = el.offsetHeight; const room = H() * 0.97;
    if (!h0 || h0 <= H() + 1) return;
    if (cfg.autoFit !== false) {
      let z = room / h0;
      for (let k = 0; k < 4 && z >= 0.5; k++) {
        el.style.zoom = z; const vis = el.offsetHeight * z;
        if (vis <= H() + 1 && vis > room * 0.94) break;
        const nz = Math.min(1, z * room / vis);
        if (Math.abs(nz - z) < 0.004) break;
        z = nz;
      }
      if (el.offsetHeight * z <= H() + 1 && z >= 0.5) { el.style.zoom = z; return; }
      el.style.zoom = '';
    }
    if (cfg.center !== false) el.classList.add('mus-overflow');
  }
  function fit(e) { fitSection(e.el); }
  function routes() {
    const S = stacks[st.h]; const last = stacks.length - 1;
    return { left: st.h > 0 || !!cfg.loop, right: st.h < last || !!cfg.loop, up: !!S.kids && st.v > 0, down: !!S.kids && st.v < S.kids.length - 1 };
  }
  function updateChrome() {
    const r = routes(); const e = cur();
    bL.classList.toggle('enabled', r.left); bR.classList.toggle('enabled', r.right); bU.classList.toggle('enabled', r.up); bD.classList.toggle('enabled', r.down);
    progress.firstChild.style.width = (flat.length > 1 ? (e.i / (flat.length - 1)) * 100 : 100) + '%';
    const sn = cfg.slideNumber;
    if (sn) {
      const fmt = sn === true ? 'h.v' : String(sn); const hv = st.h + 1; const vv = st.v + 1; const hasV = !!stacks[st.h].kids;
      number.textContent = fmt === 'c' ? String(e.i + 1) : fmt === 'c/t' ? (e.i + 1) + ' / ' + flat.length : fmt === 'h/v' ? hv + (hasV ? ' / ' + vv : '') : hv + (hasV ? '.' + vv : '');
      number.style.display = '';
    } else number.style.display = 'none';
  }
  function layout() {
    const r = env.host.getBoundingClientRect(); const w = r.width || win.innerWidth; const hh = r.height || win.innerHeight;
    const m = cfg.margin == null ? 0.04 : +cfg.margin;
    let s = Math.min((w - w * m) / W(), (hh - hh * m) / H());
    s = Math.max(+cfg.minScale || 0.05, Math.min(+cfg.maxScale || 2, s));
    if (mode === 'preview') s = Math.min((w - w * m) / W(), (hh - hh * m) / H());
    slidesEl.style.width = W() + 'px'; slidesEl.style.height = H() + 'px';
    slidesEl.style.transform = `translate(-50%, -50%) scale(${s})`; curScale = s;
  }

  /* navigation */
  function next() {
    const e = cur();
    if (st.f < e.frags.length - 1) return go(st.h, st.v, st.f + 1);
    const S = stacks[st.h];
    if (S.kids && st.v < S.kids.length - 1) return go(st.h, st.v + 1, -1);
    if (st.h < stacks.length - 1) return go(st.h + 1, 0, -1);
    if (cfg.loop) return go(0, 0, -1);
  }
  function prev() {
    if (st.f > -1) return go(st.h, st.v, st.f - 1);
    if (st.v > 0) return go(st.h, st.v - 1, 'last');
    if (st.h > 0) { const P = stacks[st.h - 1]; return go(st.h - 1, P.kids ? P.kids.length - 1 : 0, 'last'); }
    if (cfg.loop) { const P = stacks[stacks.length - 1]; return go(stacks.length - 1, P.kids ? P.kids.length - 1 : 0, 'last'); }
  }
  function right() { const e = cur(); if (st.f < e.frags.length - 1) return go(st.h, st.v, st.f + 1); if (st.h < stacks.length - 1) go(st.h + 1, 0, -1); else if (cfg.loop) go(0, 0, -1); }
  function left() { if (st.f > -1) return go(st.h, st.v, st.f - 1); if (st.h > 0) go(st.h - 1, 0, 'last'); else if (cfg.loop) go(stacks.length - 1, 0, 'last'); }
  function down() { const S = stacks[st.h]; if (S.kids && st.v < S.kids.length - 1) go(st.h, st.v + 1, -1); else next(); }
  function up() { if (st.v > 0) go(st.h, st.v - 1, 'last'); else prev(); }
  function peekNext() {
    const e = cur(); const S = stacks[st.h];
    if (st.f < e.frags.length - 1) return { e, f: st.f + 1 };
    if (S.kids && st.v < S.kids.length - 1) return { e: entryAt(st.h, st.v + 1), f: -1 };
    if (st.h < stacks.length - 1) return { e: entryAt(st.h + 1, 0), f: -1 };
    return null;
  }

  /* thumbnails: a clone of a slide in a fragment state, scaled into a box */
  function thumbInto(box, e, f, d, scale) {
    const rvx = mk(d, 'div', 'reveal');
    const bg = mk(d, 'div', 'slide-background present'); paintBg(bg, e.data.bg || cfg.bgSpec);
    const bgs = mk(d, 'div', 'backgrounds'); bgs.appendChild(bg);
    const sl = mk(d, 'div', 'slides mus-thumb-slides'); sl.style.width = W() + 'px'; sl.style.height = H() + 'px'; sl.style.transform = `scale(${scale})`;
    const c = e.el.cloneNode(true); c.classList.remove('past', 'future', 'mus-overflow'); c.classList.add('present'); c.style.display = '';
    c.querySelectorAll('video,audio').forEach((m) => { m.removeAttribute('autoplay'); m.removeAttribute('data-autoplay'); });
    if (f !== null) setFrags(fragGroups(c), f === 'last' ? 1e9 : f);
    sl.appendChild(c); rvx.append(bgs, sl); rvx.classList.toggle('mus-top', cfg.center === false);
    box.innerHTML = ''; box.appendChild(rvx);
    fitSection(c);
  }
  function shadowThumb(d, frame) {
    const host = mk(d, 'div', 'mus-thumb-host'); frame.innerHTML = ''; frame.appendChild(host);
    const sr = host.attachShadow({ mode: 'open' }); const s = mk(d, 'style'); s.textContent = env.css || ''; sr.appendChild(s);
    const vpx = mk(d, 'div', 'reveal-viewport'); const box = mk(d, 'div', 'mus-thumb'); box.style.position = 'absolute'; box.style.boxShadow = '0 0 0 1px #3a3328'; vpx.appendChild(box); sr.appendChild(vpx);
    let last = null;
    const place = () => {
      const r = frame.getBoundingClientRect(); if (!r.width || !r.height) return 0;
      const sc = Math.min(r.width / W(), r.height / H()); const bw = W() * sc; const bh = H() * sc;
      vpx.style.cssText = 'position:absolute;inset:0;background:transparent';
      Object.assign(box.style, { width: bw + 'px', height: bh + 'px', left: (r.width - bw) / 2 + 'px', top: (r.height - bh) / 2 + 'px' });
      return sc;
    };
    const RO = d.defaultView.ResizeObserver; let ro = null;
    const api = { show(e, f) { last = [e, f]; const sc = place(); if (e) thumbInto(box, e, f, d, sc || 0.2); else box.innerHTML = ''; }, destroy() { if (ro) ro.disconnect(); } };
    if (RO) { ro = new RO(() => { if (last) api.show(last[0], last[1]); }); ro.observe(frame); }
    return api;
  }

  /* overview */
  function toggleOverview(on) {
    ovOpen = on == null ? !ovOpen : !!on;
    vp.classList.toggle('mus-ov-on', ovOpen);
    if (ovOpen) { if (helpOpen) toggleHelp(false); ovSel = cur().i; buildOverview(); }
    if (ovOpen) { const it = overview.querySelector('.mus-ov-item.sel'); if (it) it.scrollIntoView({ block: 'nearest' }); }
  }
  function buildOverview() {
    overview.innerHTML = ''; const grid = mk(doc, 'div', 'mus-overview-grid'); overview.appendChild(grid);
    const tw = Math.max(160, Math.min(300, (env.host.getBoundingClientRect().width - 120) / 5)); const sc = tw / W(); const thh = H() * sc;
    let col = null; let lastH = -1;
    for (const e of flat) {
      if (e.h !== lastH) { col = mk(doc, 'div', 'mus-ov-col'); grid.appendChild(col); lastH = e.h; }
      const it = mk(doc, 'button', 'mus-ov-item' + (e.i === ovSel ? ' sel' : '') + (e === cur() ? ' cur' : '')); it.type = 'button';
      it.style.width = tw + 'px'; it.style.height = thh + 'px'; it.dataset.i = e.i;
      const box = mk(doc, 'div', 'mus-thumb'); box.style.width = tw + 'px'; box.style.height = thh + 'px';
      it.append(mk(doc, 'span', 'mus-ov-num', String(e.h + 1) + (stacks[e.h].kids ? '.' + (e.v + 1) : '')), box);
      it.addEventListener('click', () => { toggleOverview(false); go(e.h, e.v, -1); });
      col.appendChild(it);
      thumbInto(box, e, 'last', doc, sc);
    }
  }
  function ovMove(dx, dy) {
    const e = flat[ovSel]; let t = null;
    if (dy) t = flat.find((x) => x.h === e.h && x.v === e.v + dy);
    if (dx) t = flat.find((x) => x.h === e.h + dx && x.v === 0);
    if (!t) return;
    ovSel = t.i;
    overview.querySelectorAll('.mus-ov-item').forEach((el) => el.classList.toggle('sel', +el.dataset.i === ovSel));
    const it = overview.querySelector('.mus-ov-item.sel'); if (it) it.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }

  function toggleHelp(on) {
    helpOpen = on == null ? !helpOpen : !!on;
    if (helpOpen && !help.firstChild) {
      const rows = [['→ ↓ Space N', 'Next'], ['← ↑ P Backspace', 'Previous'], ['Home  End', 'First and last slide'], ['3 Enter', 'Go to slide 3'], ['O', 'Overview'], ['S', 'Speaker view: notes, next slide, timer'], ['F', 'Full screen'], ['B or .', 'Black screen'], ['?', 'These keys'], [mode === 'present' ? 'Esc' : 'Esc', mode === 'present' ? 'End the presentation' : 'Close']];
      help.innerHTML = '<div class="mus-help-box"><h3>Keys</h3><table>' + rows.map(([k, v]) => `<tr><td>${k}</td><td>${v}</td></tr>`).join('') + '</table></div>';
      help.addEventListener('click', () => toggleHelp(false));
    }
    vp.classList.toggle('mus-help-on', helpOpen);
  }

  /* speaker view: a second window with the current slide, the next one, the notes and a timer */
  const fmtT = (s) => { s = Math.floor(Math.abs(s)); const hh = Math.floor(s / 3600); const mm = Math.floor((s % 3600) / 60); const ss = s % 60; return (hh ? hh + ':' + String(mm).padStart(2, '0') : String(mm).padStart(2, '0')) + ':' + String(ss).padStart(2, '0'); };
  function buildSpeaker(d, container) {
    const sp = mk(d, 'div', 'spk');
    sp.innerHTML = '<header class="spk-top"><span class="spk-title"></span><span class="spk-count"></span><span class="spk-time"><span class="spk-elapsed">00:00</span><span class="spk-left"></span><button class="spk-pause" type="button">Pause</button><button class="spk-reset" type="button">Reset</button></span><span class="spk-clock"></span></header>'
      + '<div class="spk-main"><div class="spk-col"><div class="spk-label">Current slide<span class="grow"></span><span class="spk-nav"><button class="spk-prev" type="button">‹ Previous</button><button class="spk-next" type="button">Next ›</button></span></div><div class="spk-frame spk-cur"></div></div>'
      + '<div class="spk-col"><div class="spk-next-wrap"><div class="spk-label">Next</div><div class="spk-frame spk-upnext"></div></div><div class="spk-label">Notes<span class="grow"></span><button class="spk-smaller" type="button">A−</button><button class="spk-bigger" type="button">A+</button></div><div class="spk-notes"></div></div></div>';
    container.appendChild(sp);
    const q = (s) => sp.querySelector(s);
    q('.spk-title').textContent = deck.title || 'Slides';
    let size = 24;
    q('.spk-smaller').onclick = () => { size = Math.max(14, size - 2); sp.style.setProperty('--spk-size', size + 'px'); };
    q('.spk-bigger').onclick = () => { size = Math.min(48, size + 2); sp.style.setProperty('--spk-size', size + 'px'); };
    q('.spk-prev').onclick = () => prev(); q('.spk-next').onclick = () => next();
    q('.spk-pause').onclick = () => { if (timer.pausedAt) { timer.paused += Date.now() - timer.pausedAt; timer.pausedAt = 0; } else timer.pausedAt = Date.now(); tick(); };
    q('.spk-reset').onclick = () => { timer.start = Date.now(); timer.paused = 0; timer.pausedAt = timer.pausedAt ? Date.now() : 0; tick(); };
    const curT = shadowThumb(d, q('.spk-cur')); const nextT = shadowThumb(d, q('.spk-upnext'));
    return { el: sp, q, curT, nextT, destroy() { curT.destroy(); nextT.destroy(); sp.remove(); } };
  }
  function fillSpeaker(o) {
    if (!o) return;
    const e = cur(); o.curT.show(e, st.f);
    const nx = peekNext(); const up = o.q('.spk-upnext');
    if (nx) { const end = up.querySelector('.spk-end'); if (end) end.remove(); o.nextT.show(nx.e, nx.f); }
    else { o.nextT.show(null); if (!up.querySelector('.spk-end')) { const d = up.ownerDocument; up.appendChild(mk(d, 'div', 'spk-end', 'End of the presentation')); } }
    o.q('.spk-notes').innerHTML = e.data.notes || '<p class="spk-none">No notes for this slide.</p>';
    o.q('.spk-notes').scrollTop = 0;
    const frag = e.frags.length ? ` · step ${st.f + 2} of ${e.frags.length + 1}` : '';
    o.q('.spk-count').textContent = `Slide ${e.i + 1} of ${flat.length}${frag}`;
    tickOne(o);
  }
  function tickOne(o) {
    if (!o) return;
    const s = elapsed(); const el = o.q('.spk-elapsed'); el.textContent = fmtT(s); el.classList.toggle('paused', !!timer.pausedAt);
    const T = cfg.timeForPresentation; el.classList.toggle('over', T > 0 && s > T);
    o.q('.spk-left').textContent = T > 0 ? (s > T ? fmtT(s - T) + ' over' : fmtT(T - s) + ' left') : '';
    o.q('.spk-pause').textContent = timer.pausedAt ? 'Resume' : 'Pause';
    const now = new Date(); o.q('.spk-clock').textContent = String(now.getHours()).padStart(2, '0') + ':' + String(now.getMinutes()).padStart(2, '0');
  }
  function tick() {
    if (spk && spk.win.closed) closeSpeakerWin();
    tickOne(spk && spk.o); tickOne(spkInlineObj);
    if (cfg.timeForPresentation > 0) timebar.firstChild.style.width = Math.min(100, (elapsed() / cfg.timeForPresentation) * 100) + '%';
  }
  function renderSpeaker() { if (spk && !spk.win.closed) fillSpeaker(spk.o); if (spkInlineObj) fillSpeaker(spkInlineObj); }
  function closeSpeakerWin() { if (spk) { try { spk.o.destroy(); } catch (e) { /* closed */ } spk = null; } }
  function openSpeaker() {
    if (mode === 'preview' && env.onSpeaker) { env.onSpeaker(Object.assign({}, st)); return; }
    if (spk && !spk.win.closed) { spk.win.focus(); return; }
    let w = null;
    try { w = win.open('', 'musubi-speaker', 'popup=yes,width=1240,height=800'); } catch (e) { w = null; }
    if (!w) { toggleInlineSpeaker(); return; }
    const d = w.document;
    d.open(); d.write('<!DOCTYPE html><html><head><meta charset="utf-8"><title>Speaker view</title></head><body style="margin:0;background:#0d0c0a"></body></html>'); d.close();
    d.title = 'Speaker view · ' + (deck.title || 'Slides');
    const s = mk(d, 'style'); s.textContent = (env.fontCss || '') + (env.speakerCss || ''); d.head.appendChild(s);
    spk = { win: w, o: buildSpeaker(d, d.body) };
    w.addEventListener('keydown', (e) => onKey(e, true), true);
    w.addEventListener('pagehide', () => { spk = null; });
    fillSpeaker(spk.o);
  }
  function toggleInlineSpeaker(on) {
    const want = on == null ? !spkInlineObj : !!on;
    if (want && !spkInlineObj) { spkInlineObj = buildSpeaker(doc, spkInline); vp.classList.add('mus-spk-on'); fillSpeaker(spkInlineObj); }
    else if (!want && spkInlineObj) { spkInlineObj.destroy(); spkInlineObj = null; vp.classList.remove('mus-spk-on'); }
  }

  /* print: one page per slide, every fragment shown */
  function printPages() {
    const holder = mk(doc, 'div', 'mus-print');
    const page = doc.createElement('style');
    page.textContent = `@page { size: ${W()}px ${H()}px; margin: 0; } @media print { html, body { height: auto !important; overflow: visible !important; background: #000 !important; margin: 0 !important; } body > *:not(.mus-print-host) { display: none !important; } .mus-print-host { position: static !important; inset: auto !important; left: auto !important; top: auto !important; width: auto !important; height: auto !important; transform: none !important; display: block !important; visibility: visible !important; } }`;
    for (const e of flat) {
      const pg = mk(doc, 'div', 'mus-print-page'); pg.style.width = W() + 'px'; pg.style.height = H() + 'px';
      const vpx = mk(doc, 'div', 'reveal-viewport'); const box = mk(doc, 'div', 'mus-thumb'); box.style.cssText = `position:absolute;inset:0;width:${W()}px;height:${H()}px`;
      vpx.appendChild(box); pg.appendChild(vpx); holder.appendChild(pg);
      thumbInto(box, e, 'last', doc, 1);
    }
    root.appendChild(holder); doc.head.appendChild(page); env.host.classList.add('mus-print-host');
    const done = () => { holder.remove(); page.remove(); env.host.classList.remove('mus-print-host'); win.removeEventListener('afterprint', done); if (env.onPrinted) env.onPrinted(); };
    win.addEventListener('afterprint', done);
    // measure the overflow of every page once it is laid out
    holder.style.cssText = 'display:block;position:fixed;left:-100000px;top:0';
    holder.querySelectorAll('.mus-thumb-slides > section').forEach((c) => fitSection(c));
    holder.style.cssText = '';
    const imgs = Array.from(holder.querySelectorAll('img')).map((im) => (im.decode ? im.decode().catch(() => {}) : null));
    Promise.all([doc.fonts ? doc.fonts.ready : null, ...imgs]).then(() => setTimeout(() => { win.print(); if (!('onafterprint' in win)) done(); }, 60));
  }

  function toggleFullscreen() {
    const target = mode === 'standalone' ? doc.documentElement : env.host;
    try { if (doc.fullscreenElement) doc.exitFullscreen(); else if (target.requestFullscreen) target.requestFullscreen(); } catch (e) { /* not allowed */ }
  }
  function exit() { if (env.onExit) env.onExit(); }

  /* keys */
  function onKey(e, fromSpeaker) {
    if (destroyed) return;
    if (mode !== 'preview') e.stopImmediatePropagation();
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    const t = e.target; if (t && t.closest && t.closest('input, textarea, select, [contenteditable=true]')) return;
    const k = e.key; let ok = true;
    if (helpOpen) { toggleHelp(false); e.preventDefault(); return; }
    if (ovOpen) {
      if (k === 'ArrowRight' || k === 'l') ovMove(1, 0); else if (k === 'ArrowLeft' || k === 'h') ovMove(-1, 0);
      else if (k === 'ArrowDown' || k === 'j') ovMove(0, 1); else if (k === 'ArrowUp' || k === 'k') ovMove(0, -1);
      else if (k === 'Enter' || k === ' ') { const x = flat[ovSel]; toggleOverview(false); go(x.h, x.v, -1); }
      else if (k === 'Escape' || k === 'o' || k === 'O') toggleOverview(false);
      else ok = false;
      if (ok) e.preventDefault();
      return;
    }
    if (/^[0-9]$/.test(k)) { jumpBuf += k; jump.textContent = jumpBuf; jump.style.display = 'block'; clearTimeout(jumpT); jumpT = setTimeout(() => { jumpBuf = ''; jump.style.display = 'none'; }, 2200); e.preventDefault(); return; }
    if (k === 'Enter' && jumpBuf) { const n = +jumpBuf; jumpBuf = ''; jump.style.display = 'none'; const x = flat[Math.max(0, Math.min(flat.length - 1, n - 1))]; go(x.h, x.v, -1); e.preventDefault(); return; }
    switch (k) {
      case 'ArrowRight': case 'l': right(); break;
      case 'ArrowLeft': case 'h': left(); break;
      case 'ArrowDown': case 'j': down(); break;
      case 'ArrowUp': case 'k': up(); break;
      case ' ': if (e.shiftKey) prev(); else next(); break;
      case 'PageDown': case 'n': case 'N': next(); break;
      case 'PageUp': case 'p': case 'P': case 'Backspace': prev(); break;
      case 'Home': go(0, 0, -1); break;
      case 'End': { const L = stacks.length - 1; go(L, stacks[L].kids ? stacks[L].kids.length - 1 : 0, 'last'); break; }
      case 'o': case 'O': toggleOverview(); break;
      case 's': case 'S': if (fromSpeaker) { if (spk) spk.win.blur(); win.focus(); } else if (spkInlineObj) toggleInlineSpeaker(false); else openSpeaker(); break;
      case 'f': case 'F': if (!fromSpeaker) toggleFullscreen(); break;
      case 'b': case 'B': case '.': vp.classList.toggle('mus-blackout'); break;
      case '?': toggleHelp(); break;
      case 'Escape':
        if (vp.classList.contains('mus-blackout')) vp.classList.remove('mus-blackout');
        else if (spkInlineObj) toggleInlineSpeaker(false);
        else if (mode === 'present') exit();
        else if (mode === 'standalone') toggleOverview();
        else ok = false;
        break;
      default: ok = false;
    }
    if (ok) e.preventDefault();
  }
  const keyTarget = mode === 'preview' ? env.host : win;
  const keyFn = (e) => onKey(e, false);
  keyTarget.addEventListener('keydown', keyFn, mode !== 'preview');
  if (mode === 'preview') env.host.tabIndex = 0;

  /* pointer: swipes, links, idle cursor */
  let px = null;
  vp.addEventListener('pointerdown', (e) => { if (e.pointerType !== 'mouse') px = [e.clientX, e.clientY]; });
  vp.addEventListener('pointerup', (e) => {
    if (!px) return; const dx = e.clientX - px[0]; const dy = e.clientY - px[1]; px = null;
    if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy)) (dx < 0 ? right : left)(); else if (Math.abs(dy) > 50) (dy < 0 ? down : up)();
  });
  vp.addEventListener('click', (e) => {
    const a = e.target.closest && e.target.closest('a');
    if (!a) return;
    if (a.classList.contains('wl') || a.classList.contains('cite-ref') || a.classList.contains('tag') || a.classList.contains('att') || a.hasAttribute('data-anchor')) {
      e.preventDefault();
      if (env.onLink) env.onLink(a.dataset.id || null, a);
    }
  });
  const wake = () => { vp.classList.remove('mus-idle'); clearTimeout(idleT); idleT = setTimeout(() => vp.classList.add('mus-idle'), 2600); };
  if (mode !== 'preview') { vp.addEventListener('mousemove', wake); wake(); }
  root.addEventListener('load', (e) => { if (e.target && e.target.tagName === 'IMG') fit(cur()); }, true);

  const RO = win.ResizeObserver; const ro = RO ? new RO(() => { layout(); fit(cur()); }) : null;
  if (ro) ro.observe(env.host); else win.addEventListener('resize', layout);
  const iv = setInterval(tick, 1000);

  build();
  let start = env.start || { h: 0, v: 0, f: -1 };
  if (env.hash) { const m = /^#\/(\d+)(?:\/(\d+))?/.exec(win.location.hash || ''); if (m) start = { h: +m[1], v: +(m[2] || 0), f: -1 }; }
  go(start.h || 0, start.v || 0, start.f == null ? -1 : start.f, true);
  requestAnimationFrame(() => requestAnimationFrame(() => vp.classList.remove('mus-no-anim')));
  if (mode !== 'preview') { try { vp.focus({ preventScroll: true }); } catch (e) { /* ignore */ } }

  const api = {
    go, next, prev, left, right, up, down, toggleOverview, openSpeaker, toggleInlineSpeaker, printPages, toggleFullscreen, layout,
    state: () => Object.assign({}, st),
    count: () => flat.length,
    setDeck(d2, css) {
      deck = d2; cfg = d2.config; if (css != null) styleEl.textContent = css; env.css = styleEl.textContent;
      vp.classList.add('mus-no-anim'); const keep = Object.assign({}, st);
      build(); go(keep.h, keep.v, keep.f, true);
      requestAnimationFrame(() => requestAnimationFrame(() => vp.classList.remove('mus-no-anim')));
    },
    focus() { try { (mode === 'preview' ? env.host : vp).focus({ preventScroll: true }); } catch (e) { /* ignore */ } },
    destroy() {
      destroyed = true; clearInterval(iv); clearTimeout(autoT); clearTimeout(idleT);
      keyTarget.removeEventListener('keydown', keyFn, mode !== 'preview');
      if (ro) ro.disconnect();
      if (spk && !spk.win.closed) { try { spk.win.close(); } catch (e) { /* ignore */ } }
      spk = null; if (spkInlineObj) spkInlineObj.destroy();
      root.innerHTML = '';
    },
  };
  return api;
}

/* ---------- app glue ---------- */
let slideKatexRules = null; let slideFontCss = null; let slidePlotCss = null;
function slideDocCss() {
  if (slideKatexRules == null) {
    const styles = Array.from(document.querySelectorAll('head style')).map((s) => s.textContent);
    const kx = styles.find((s) => s.includes('.katex{') || s.includes('.katex {')) || '';
    const kxFonts = (kx.match(/@font-face\{[^}]*\}/g) || []).join('\n');
    slideKatexRules = kx.replace(/@font-face\{[^}]*\}/g, '');
    const fonts = styles.filter((s) => s.includes("font-family:'EB Garamond'") || s.includes("font-family:'JetBrains Mono'")).join('\n');
    slideFontCss = fonts + '\n' + kxFonts;
    const plot = [];
    for (const sh of Array.from(document.styleSheets)) {
      let rules; try { rules = sh.cssRules; } catch (e) { continue; }
      for (const r of Array.from(rules || [])) if (r.selectorText && /(^|[\s,])\.plot/.test(r.selectorText)) plot.push(r.cssText);
    }
    slidePlotCss = plot.join('\n');
  }
  return { katex: slideKatexRules, fonts: slideFontCss, plot: slidePlotCss };
}
/* The Istari colour variables, for exported files (inside the app they come from the page). */
function slideIstariVars() {
  const cs = getComputedStyle(document.documentElement); const names = new Set();
  for (const s of Array.from(document.querySelectorAll('head style'))) for (const m of s.textContent.matchAll(/(--(?:ist|c|font|track)-[\w-]+)\s*:/g)) names.add(m[1]);
  return ':host {' + Array.from(names).map((n) => `${n}: ${cs.getPropertyValue(n).trim()};`).filter((x) => !/:\s*;$/.test(x)).join(' ') + '}';
}
/* The deck's own CSS: remote @import lines are dropped (Musubi makes no network requests), and :root means the deck. */
function slideUserCss(css) {
  return String(css || '').replace(/@import\s+url\(\s*['"]?https?:[^)]*\)\s*[^;]*;?/gi, '').replace(/@import\s+['"]https?:[^'"]*['"]\s*[^;]*;?/gi, '').replace(/:root\b/g, ':host');
}
function slideCss(deck, extra) {
  const d = slideDocCss();
  return [d.katex, SLIDE_BASE_CSS, slideThemeCss(deck.config.theme), deck.themeCss ? slideUserCss(deck.themeCss) : '', SLIDE_CHROME_CSS, SLIDE_SPEAKER_CSS, d.plot, extra || '', slideUserCss(deck.css)].join('\n');
}

const slidesState = { present: null, previews: [null, null] };

function slideStartFor(n, deck) {
  if (n.id === app.current && app.settings.mode !== 'read' && ed.view) return slideIndexAt(ed.getText(), ed.selection().from, deck.config);
  return { h: 0, v: 0 };
}

async function presentNote(id, opts = {}) {
  const n = vault.get(id || app.current);
  if (!n) { toast('Open a note to present it'); return; }
  if (n.id === app.current) saveCurrent.flush();
  if (slidesState.present) slidesState.present.close();
  let deck;
  try { deck = await buildDeck(n); } catch (e) { console.error(e); toast('The slides could not be made: ' + e.message, { kind: 'error' }); return; }
  const start = opts.start || (opts.fromStart ? { h: 0, v: 0 } : slideStartFor(n, deck));
  const host = h('div', { class: 'slides-present', role: 'dialog', 'aria-label': 'Slides: ' + n.title });
  document.body.appendChild(host);
  const close = () => {
    if (!slidesState.present || slidesState.present.host !== host) return;
    slidesState.present = null;
    rt.destroy(); host.remove();
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    document.removeEventListener('fullscreenchange', onFs);
  };
  const onFs = () => { if (rt) rt.layout(); };
  document.addEventListener('fullscreenchange', onFs);
  const d = slideDocCss();
  const rt = musubiSlideRuntime({
    host, deck, css: slideCss(deck), fontCss: d.fonts, speakerCss: SLIDE_SPEAKER_CSS, mode: 'present', start,
    onExit: close, onPrint: () => printSlides(n.id),
    onLink: (lid) => { if (lid && vault.get(lid)) { close(); openNote(lid); } },
  });
  slidesState.present = { host, rt, close, id: n.id };
  if (opts.speaker) rt.openSpeaker();
  if (app.settings.slidesFullscreen !== false && host.requestFullscreen && !opts.noFullscreen) host.requestFullscreen().catch(() => {});
}

async function printSlides(id) {
  const n = vault.get(id || app.current); if (!n) return;
  if (n.id === app.current) saveCurrent.flush();
  const deck = await buildDeck(n);
  const host = h('div', { class: 'slides-print-host' }); document.body.appendChild(host);
  let rt = null;
  const cleanup = () => setTimeout(() => { if (rt) rt.destroy(); host.remove(); }, 300);
  rt = musubiSlideRuntime({ host, deck, css: slideCss(deck), mode: 'print', onPrinted: cleanup });
  rt.printPages();
}

/* Blob addresses (attachments) become data: addresses, so that an exported file stands alone. */
async function slideInlineBlobs(text) {
  const re = /blob:[^"'\\)\s]+/g;
  const urls = Array.from(new Set(String(text).match(re) || []));
  const byUrl = new Map(); for (const a of vault.assets.values()) if (a.url) byUrl.set(a.url, a);
  const map = new Map();
  for (const u of urls) {
    try {
      const a = byUrl.get(u);
      const b = a && a.blob ? a.blob : await (await fetch(u)).blob();
      map.set(u, await new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = rej; r.readAsDataURL(b); }));
    } catch (e) { /* leave it */ }
  }
  return String(text).replace(re, (u) => map.get(u) || u);
}

async function slidesHtml(n) {
  const deck = await buildDeck(n);
  const d = slideDocCss();
  for (const walk of [deck.slides]) walk.forEach(function strip(s) { if (s.html) s.html = s.html.replace(/\shref="#n-[^"]*"/g, ''); if (s.children) s.children.forEach(strip); });
  const css = slideCss(deck, slideIstariVars());
  const json = (x) => JSON.stringify(x).replace(/</g, '\\u003c').replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029');
  const payload = await slideInlineBlobs(json({ deck, css, fontCss: d.fonts, speakerCss: SLIDE_SPEAKER_CSS }));
  const runtime = musubiSlideRuntime.toString().replace(/<\/script/gi, '<\\/script').replace(/<!--/g, '<\\!--');
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="generator" content="Musubi">
<title>${esc(n.title)}</title>
<style>${d.fonts}</style>
<style>html, body { margin: 0; height: 100%; overflow: hidden; background: #000; } #deck { position: fixed; inset: 0; }</style>
</head>
<body>
<div id="deck"></div>
<script>
${runtime}
(function () {
  var P = ${payload};
  musubiSlideRuntime({ host: document.getElementById('deck'), deck: P.deck, css: P.css, fontCss: P.fontCss, speakerCss: P.speakerCss, mode: 'standalone', hash: true });
})();
</script>
</body>
</html>
`;
}

async function exportSlides(id) {
  const n = vault.get(id || app.current); if (!n) return;
  if (n.id === app.current) saveCurrent.flush();
  try { download(new Blob([await slidesHtml(n)], { type: 'text/html' }), safeName(n.title) + ' (slides).html'); }
  catch (e) { console.error(e); toast('The slides could not be exported: ' + e.message, { kind: 'error' }); }
}

/* A window of its own, for a projector: the exported file, opened from memory. */
async function presentInWindow(id) {
  const n = vault.get(id || app.current); if (!n) return;
  if (n.id === app.current) saveCurrent.flush();
  const w = window.open('', '_blank', 'popup=yes,width=1280,height=800');
  if (!w) { toast('The browser blocked the new window. Allow pop-ups for Musubi, or use Present.', { kind: 'error' }); return; }
  const html = await slidesHtml(n);
  w.location.href = URL.createObjectURL(new Blob([html], { type: 'text/html' }));
}

/* ---------- the slide preview tab (beside the note) ---------- */
function openSlidePreview(id) {
  const nid = id || app.current; if (!nid || !vault.get(nid)) { toast('Open a note first'); return; }
  const target = panes.split ? otherPane(panes.notePane) : 1;
  const P = panes.list[target];
  if (target === 1 && !panes.split) { panes.split = true; applySplit(); }
  const k = P.tabs.findIndex((x) => x.k === 'slides' && x.id === nid);
  if (k >= 0) P.active = k;
  else { P.tabs.splice(P.tabs.length ? P.active + 1 : 0, 0, { k: 'slides', id: nid }); P.active = P.tabs.length === 1 ? 0 : P.active + 1; }
  activateTab(target, P.active);
}

function mountSlidePreview(body, t, p) {
  const n = vault.get(t.id);
  const count = h('span', { class: 'slides-count' });
  const stage = h('div', { class: 'slides-stage' });
  const host = h('div', { class: 'slides-host', 'aria-label': 'Slide preview' });
  stage.appendChild(host);
  const viewer = { id: t.id, rt: null, deck: null, destroyed: false, follow: true };
  const bar = h('div', { class: 'slides-bar' },
    h('span', { class: 'slides-bar-title' }, h('span', { class: 'slides-bar-ic', html: icon('easel', 15) }), n ? n.title : ''),
    h('span', { class: 'slides-bar-fill' }),
    h('button', { class: 'icon-btn', title: 'Previous slide', 'aria-label': 'Previous slide', html: icon('back', 16), onclick: () => viewer.rt && viewer.rt.left() }),
    count,
    h('button', { class: 'icon-btn', title: 'Next slide', 'aria-label': 'Next slide', html: icon('fwd', 16), onclick: () => viewer.rt && viewer.rt.right() }),
    h('button', { class: 'btn btn-sm slides-present-btn', title: 'Present from this slide (' + (hotkeyHint('slides.present') || '') + ')', onclick: () => presentNote(t.id, { start: viewer.rt ? viewer.rt.state() : null }) }, 'Present'),
    h('button', { class: 'icon-btn', title: 'More', 'aria-label': 'More', html: icon('more', 16), onclick: (e) => openMenu(e.currentTarget, [
      { icon: 'easel', label: 'Present with the speaker view', run: () => presentNote(t.id, { start: viewer.rt ? viewer.rt.state() : null, speaker: true }) },
      { icon: 'window', label: 'Present in a new window (for a projector)', run: () => presentInWindow(t.id) },
      { icon: 'copy', label: 'Export the slides as one HTML file', run: () => exportSlides(t.id) },
      { icon: 'scroll', label: 'Print the slides or save them as PDF', run: () => printSlides(t.id) },
      '-',
      { icon: 'gear', label: 'Slide settings', run: () => openSettings('slides') },
    ]) }));
  const wrap = h('div', { class: 'slides-pane' }, bar, stage);
  body.appendChild(wrap);
  viewer.wrap = wrap;
  const upd = () => { if (viewer.rt) { const s = viewer.rt.state(); count.textContent = `${s.h + 1}${viewer.deck && viewer.deck.slides[s.h] && viewer.deck.slides[s.h].children ? '.' + (s.v + 1) : ''} / ${viewer.deck ? viewer.deck.slides.length : 0}`; } };
  viewer.refresh = async () => {
    const note = vault.get(viewer.id); if (!note || viewer.destroyed) return;
    const text = note.id === app.current && ed.view ? ed.getText() : note.body;
    let deck; try { deck = await buildDeck(note, { text }); } catch (e) { console.error(e); return; }
    if (viewer.destroyed) return;
    viewer.deck = deck;
    const css = slideCss(deck);
    if (!viewer.rt) {
      const start = note.id === app.current && ed.view ? slideIndexAt(text, ed.selection().from, deck.config) : { h: 0, v: 0 };
      viewer.rt = musubiSlideRuntime({ host, deck, css, mode: 'preview', start: Object.assign(start, { f: 'last' }), onChange: upd,
        onSpeaker: (s) => presentNote(viewer.id, { start: s, speaker: true }),
        onLink: (lid) => { if (lid && vault.get(lid)) openNote(lid); } });
    } else viewer.rt.setDeck(deck, css);
    upd();
  };
  viewer.cursor = (pos) => {
    if (!viewer.rt || !viewer.deck || !viewer.follow) return;
    const s = slideIndexAt(ed.getText(), pos, viewer.deck.config); const c = viewer.rt.state();
    if (s.h !== c.h || s.v !== c.v) viewer.rt.go(s.h, s.v, 'last');
  };
  viewer.destroy = () => { viewer.destroyed = true; if (viewer.rt) viewer.rt.destroy(); wrap.remove(); };
  viewer.refresh();
  return viewer;
}

const slidesRefreshSoon = debounce((id) => { for (const v of slidesState.previews) if (v && v.id === id) v.refresh(); }, 350);
/* Called by the editor when the open note changes or its cursor moves. */
function slidesNoteChanged(id) { if (slidesState.previews.some((v) => v && v.id === id)) slidesRefreshSoon(id); }
const slidesCursorSoon = debounce((pos) => { for (const v of slidesState.previews) if (v && v.id === app.current) v.cursor(pos); }, 120);
function slidesOnCursor(pos) { if (slidesState.previews.some((v) => v && v.id === app.current)) slidesCursorSoon(pos); }
