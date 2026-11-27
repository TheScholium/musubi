/* Bold anchors: the first letters of each word are bold, as a lead-in for the eye.
   Some readers with ADHD find that the bold starts keep their place in the line. The text itself does not change:
   the read view wraps the starts in <b class="ba">, and the editor draws them with mark decorations. */

const BA_SKIP = 'code, pre, kbd, script, style, svg, .katex, .math-inline, .math-display, b.ba, a.tag, .plot, .eqref, .fnref, .cloze-blank, .rel, .embed-type, .env-label';
const BA_WORD = /[\p{L}\p{N}][\p{L}\p{N}\p{M}'’]*/gu;

/* How many letters of a word are bold. Short words get one; longer words get a fraction set by the strength. */
function anchorLength(len, strength) {
  if (len <= 1) return len;
  const f = strength === 'light' ? 0.3 : strength === 'strong' ? 0.5 : 0.4;
  if (len <= 3) return 1;
  return Math.max(1, Math.min(len - 1, Math.ceil(len * f)));
}

function boldAnchorsDom(root) {
  if (!root || !root.ownerDocument) return;
  const strength = (app.settings && app.settings.anchorStrength) || 'medium';
  const walker = root.ownerDocument.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      if (!node.nodeValue || !/[\p{L}\p{N}]/u.test(node.nodeValue)) return NodeFilter.FILTER_REJECT;
      const p = node.parentElement;
      if (!p || p.closest(BA_SKIP)) return NodeFilter.FILTER_REJECT;
      return NodeFilter.FILTER_ACCEPT;
    },
  });
  const nodes = [];
  while (walker.nextNode()) nodes.push(walker.currentNode);
  for (const node of nodes) {
    const text = node.nodeValue; const frag = document.createDocumentFragment(); let last = 0; let m;
    BA_WORD.lastIndex = 0;
    while ((m = BA_WORD.exec(text))) {
      const w = m[0]; const chars = Array.from(w); const k = anchorLength(chars.length, strength);
      const head = chars.slice(0, k).join('');
      if (m.index > last) frag.appendChild(document.createTextNode(text.slice(last, m.index)));
      const b = document.createElement('b'); b.className = 'ba'; b.textContent = head;
      frag.appendChild(b);
      frag.appendChild(document.createTextNode(w.slice(head.length)));
      last = m.index + w.length;
    }
    if (last < text.length) frag.appendChild(document.createTextNode(text.slice(last)));
    node.replaceWith(frag);
  }
}

/* The editor: mark decorations over the start of each visible word, outside code, math, links and front matter. */
function boldAnchorExt() {
  const deco = CM.Decoration.mark({ class: 'cm-ba' });
  const SKIP_NODES = /^(FencedCode|CodeBlock|InlineCode|URL|LinkMark|CodeMark|CodeInfo|HeaderMark|HTMLBlock|HTMLTag|Comment)$/;
  const build = (view) => {
    const b = new CM.RangeSetBuilder();
    const doc = view.state.doc; const strength = app.settings.anchorStrength || 'medium';
    const full = doc.toString();
    let masked = maskCodeMath(full).replace(/!?\[\[[^\]\n]*\]\]|\[@[^\]\n]*\]|\{\{c\d*::|\}\}|\\[A-Za-z]+|(?:^|\s)\^[\w-]+$/gm, (s) => ' '.repeat(s.length));
    const tree = CM.syntaxTree(view.state);
    for (const { from, to } of view.visibleRanges) {
      const skip = [];
      tree.iterate({ from, to, enter: (n) => { if (SKIP_NODES.test(n.name)) { skip.push([n.from, n.to]); return false; } return undefined; } });
      const seg = masked.slice(from, to); let m;
      BA_WORD.lastIndex = 0;
      while ((m = BA_WORD.exec(seg))) {
        const a = from + m.index; const chars = Array.from(m[0]);
        if (skip.some(([x, y]) => a >= x && a < y)) continue;
        const k = anchorLength(chars.length, strength);
        const len = chars.slice(0, k).join('').length;
        b.add(a, a + len, deco);
      }
    }
    return b.finish();
  };
  return CM.ViewPlugin.fromClass(class {
    constructor(view) { this.decorations = build(view); }
    update(u) { if (u.docChanged || u.viewportChanged || syntaxTree(u.startState) !== syntaxTree(u.state)) this.decorations = build(u.view); }
  }, { decorations: (v) => v.decorations });
}

/* Theme: Istari (dark), Istari Paper (light), the three other Istari (dark), the pixel-art themes, or the system setting. */
const THEMES = [
  { id: 'dark', attr: 'istari', name: 'Istari', epithet: 'Warm ink and one gold pigment', group: 'Istari' },
  { id: 'light', attr: 'istari-light', name: 'Istari Paper', epithet: 'Dark ink on parchment', light: true, group: 'Istari' },
  { id: 'mithrandir', attr: 'mithrandir', name: 'Mithrandir', epithet: 'Storm-grey, lit by an ember', group: 'The Istari order' },
  { id: 'ithryn', attr: 'ithryn', name: 'Ithryn Luin', epithet: 'Lapis night and starlight', group: 'The Istari order' },
  { id: 'aiwendil', attr: 'aiwendil', name: 'Aiwendil', epithet: 'Moss, lichen and fern-gold', group: 'The Istari order' },
  { id: 'kairos', attr: 'kairos', name: 'Kairos', epithet: 'A protostar, stellar gold', pixel: true, group: 'Pixel art: time' },
  { id: 'aion', attr: 'aion', name: 'Aion', epithet: 'Nebula gas and a young cluster', pixel: true, group: 'Pixel art: time' },
  { id: 'chronos', attr: 'chronos', name: 'Chronos', epithet: 'Saturn over an ice moon', pixel: true, group: 'Pixel art: time' },
  { id: 'silva', attr: 'silva', name: 'Silva', epithet: 'Pines, mist and fireflies', pixel: true, group: 'Pixel art: landscapes' },
  { id: 'mons', attr: 'mons', name: 'Mons', epithet: 'Alpine ranges at dawn', pixel: true, group: 'Pixel art: landscapes' },
  { id: 'torrens', attr: 'torrens', name: 'Torrens', epithet: 'Rapids, boulders, a red kayak', pixel: true, group: 'Pixel art: landscapes' },
  { id: 'spelunca', attr: 'spelunca', name: 'Spelunca', epithet: 'Glowworms, crystals, still water', pixel: true, group: 'Pixel art: landscapes' },
  { id: 'aurora', attr: 'aurora', name: 'Aurora', epithet: 'Northern lights over snow', pixel: true, group: 'Pixel art: landscapes' },
  { id: 'ignis', attr: 'ignis', name: 'Ignis', epithet: 'Flames and rising embers', pixel: true, group: 'Pixel art: landscapes' },
  { id: 'mars', attr: 'mars', name: 'Mars', epithet: 'Rust dunes, two small moons', pixel: true, group: 'Pixel art: landscapes' },
  { id: 'bibliotheca', attr: 'bibliotheca', name: 'Bibliotheca', epithet: 'Candlelit shelves, gilt spines', pixel: true, group: 'Pixel art: places' },
  { id: 'castellum', attr: 'castellum', name: 'Castellum', epithet: 'A castle and its village at dusk', pixel: true, group: 'Pixel art: places' },
  { id: 'shire', attr: 'shire', name: 'Shire', epithet: 'Round doors in green hills', pixel: true, group: 'Pixel art: places' },
  { id: 'earthrise', attr: 'earthrise', name: 'Earthrise', epithet: 'Apollo 8, 1968', pixel: true, group: 'Pixel art: after NASA images' },
  { id: 'palebluedot', attr: 'palebluedot', name: 'Pale Blue Dot', epithet: 'Voyager 1, 1990', pixel: true, group: 'Pixel art: after NASA images' },
  { id: 'deepfield', attr: 'deepfield', name: 'Deep Field', epithet: 'JWST, 2022', pixel: true, group: 'Pixel art: after NASA images' },
  { id: 'pluto', attr: 'pluto', name: 'Pluto', epithet: 'New Horizons, 2015', pixel: true, group: 'Pixel art: after NASA images' },
  { id: 'jupiter', attr: 'jupiter', name: 'Jupiter', epithet: 'Juno, from 2016', pixel: true, group: 'Pixel art: after NASA images' },
];
const themeQuery = typeof matchMedia === 'function' ? matchMedia('(prefers-color-scheme: light)') : null;
function themeInfo(attr) { return THEMES.find((t) => t.attr === attr) || THEMES[0]; }
function resolvedTheme() {
  const t = (app.settings && app.settings.theme) || 'dark';
  if (t === 'auto') {
    if (themeQuery && themeQuery.matches) return 'istari-light';
    const night = THEMES.find((x) => x.id === app.settings.themeNight && !x.light);
    return night ? night.attr : 'istari';
  }
  return (THEMES.find((x) => x.id === t) || THEMES[0]).attr;
}
if (themeQuery && themeQuery.addEventListener) themeQuery.addEventListener('change', () => { if (app.settings.theme === 'auto') applyTheme(); });
