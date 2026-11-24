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

/* Theme: dark (Istari), light (Istari Paper), or the system setting. */
const themeQuery = typeof matchMedia === 'function' ? matchMedia('(prefers-color-scheme: light)') : null;
function resolvedTheme() {
  const t = (app.settings && app.settings.theme) || 'dark';
  if (t === 'light') return 'istari-light';
  if (t === 'auto' && themeQuery && themeQuery.matches) return 'istari-light';
  return 'istari';
}
if (themeQuery && themeQuery.addEventListener) themeQuery.addEventListener('change', () => { if (app.settings.theme === 'auto') applyTheme(); });
