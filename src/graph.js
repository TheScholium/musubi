/* Musubi graph: canvas force-directed layout with a Barnes–Hut quadtree. */

class ForceGraph {
  constructor(canvas, opts = {}) {
    this.cv = canvas; this.ctx = canvas.getContext('2d');
    this.opts = opts;
    this.nodes = []; this.edges = []; this.byId = new Map();
    this.scale = 1; this.tx = 0; this.ty = 0;
    this.alpha = 1; this.running = false; this.hover = null; this.focusId = null;
    this.drag = null; this.highlight = null; this.labels = opts.labels !== false;
    this._raf = null;
    this.resize();
    this._ro = new ResizeObserver(() => { this.resize(); this.draw(); });
    this._ro.observe(canvas.parentElement || canvas);
    this.bind();
  }
  destroy() { this.stop(); this._ro.disconnect(); this._unbind && this._unbind(); }

  resize() {
    const r = this.cv.getBoundingClientRect(); const dpr = window.devicePixelRatio || 1;
    this.w = Math.max(10, r.width); this.hgt = Math.max(10, r.height);
    this.cv.width = Math.round(this.w * dpr); this.cv.height = Math.round(this.hgt * dpr);
    this.dpr = dpr;
  }

  setData(nodes, edges, keepPositions = true) {
    const old = this.byId; this.byId = new Map();
    const n = nodes.length; const R = 30 * Math.sqrt(n + 1);
    nodes.forEach((nd, i) => {
      const prev = keepPositions && old.get(nd.id);
      const a = i * 2.399963; const rr = R * Math.sqrt((i + 0.5) / (n + 1));
      Object.assign(nd, { x: prev ? prev.x : Math.cos(a) * rr, y: prev ? prev.y : Math.sin(a) * rr, vx: 0, vy: 0, deg: 0 });
      if (nd.pinned) { nd.x = 0; nd.y = 0; }
      this.byId.set(nd.id, nd);
    });
    this.nodes = nodes;
    this.edges = edges.filter((e) => this.byId.has(e.s) && this.byId.has(e.t) && e.s !== e.t);
    for (const e of this.edges) { this.byId.get(e.s).deg++; this.byId.get(e.t).deg++; }
    for (const nd of nodes) nd.r = nd.r || (3.5 + Math.sqrt(nd.deg) * 1.8 + (nd.type === 'structure' ? 2.5 : 0));
    this.neigh = new Map();
    for (const e of this.edges) {
      if (!this.neigh.has(e.s)) this.neigh.set(e.s, new Set());
      if (!this.neigh.has(e.t)) this.neigh.set(e.t, new Set());
      this.neigh.get(e.s).add(e.t); this.neigh.get(e.t).add(e.s);
    }
    this.alpha = 1; this.userMoved = false;
    this.fit(true);
    this.start();
  }

  readColors() {
    const cs = getComputedStyle(document.documentElement);
    const v = (n) => cs.getPropertyValue(n).trim();
    const c = {};
    for (const t of TYPE_IDS) c[t] = v('--t-' + t) || '#948b76';
    c.edge = v('--graph-line'); c.plainEdge = v('--graph-plain') || '#5b4f37'; c.text = v('--graph-text');
    c.bg = v('--ist-bg-0'); c.accent = v('--ist-gold');
    c.pro = v('--rel-pro'); c.con = v('--rel-con'); c.struct = v('--rel-struct'); c.seq = v('--rel-seq');
    c.muted = v('--ist-text-muted');
    c.font = v('--font-text');
    this.colors = c;
  }

  start() { if (!this.running) { this.running = true; this.readColors(); this.loop(); } }
  stop() { this.running = false; if (this._raf) cancelAnimationFrame(this._raf); this._raf = null; }
  loop() {
    if (!this.running) return;
    for (let k = 0; k < 2; k++) this.tick();
    if (!this.userMoved && this.alpha > 0.02) this.fit(false); else this.draw();
    if (this.alpha < 0.004 && !this.drag) { this.running = false; this.draw(); return; }
    this._raf = requestAnimationFrame(() => this.loop());
  }
  reheat(a = 0.5) { this.alpha = Math.max(this.alpha, a); this.start(); }

  tick() {
    const nodes = this.nodes; if (!nodes.length) return;
    const alpha = this.alpha; const rep = (this.opts.repulsion || 70);
    const tree = buildQuadtree(nodes);
    for (const nd of nodes) applyRepulsion(tree, nd, rep * alpha, 0.81);
    const L = this.opts.linkLength || 40;
    for (const e of this.edges) {
      const a = this.byId.get(e.s); const b = this.byId.get(e.t);
      let dx = b.x + b.vx - a.x - a.vx; let dy = b.y + b.vy - a.y - a.vy; const d = Math.sqrt(dx * dx + dy * dy) || 0.01;
      const k = ((d - L) / d) * alpha / Math.max(1, Math.min(a.deg, b.deg));
      dx *= k; dy *= k;
      const bias = a.deg / (a.deg + b.deg);
      b.vx -= dx * bias; b.vy -= dy * bias; a.vx += dx * (1 - bias); a.vy += dy * (1 - bias);
    }
    const g = (this.opts.gravity || 0.04) * alpha;
    for (const nd of nodes) {
      nd.vx -= nd.x * g; nd.vy -= nd.y * g;
      if (nd === (this.drag && this.drag.node) || nd.pinned) { nd.vx = 0; nd.vy = 0; continue; }
      const sp = Math.sqrt(nd.vx * nd.vx + nd.vy * nd.vy);
      if (sp > 40) { nd.vx *= 40 / sp; nd.vy *= 40 / sp; }
      nd.x += nd.vx; nd.y += nd.vy;
      nd.vx *= 0.6; nd.vy *= 0.6;
    }
    this.alpha *= 0.985;
  }

  fit(initial) {
    if (!this.nodes.length) return;
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const n of this.nodes) { x0 = Math.min(x0, n.x); y0 = Math.min(y0, n.y); x1 = Math.max(x1, n.x); y1 = Math.max(y1, n.y); }
    const padX = Math.min(180, this.w * 0.45); const padY = 70; const w = (x1 - x0) || 1; const hh = (y1 - y0) || 1;
    this.scale = Math.min(1.8, Math.max(0.12, Math.min((this.w - padX) / w, (this.hgt - padY) / hh) * (initial ? 0.8 : 1)));
    this.tx = this.w / 2 - ((x0 + x1) / 2) * this.scale; this.ty = this.hgt / 2 - ((y0 + y1) / 2) * this.scale;
    this.draw();
  }

  toWorld(px, py) { return { x: (px - this.tx) / this.scale, y: (py - this.ty) / this.scale }; }
  nodeAt(px, py) {
    const p = this.toWorld(px, py); let best = null; let bd = Infinity;
    for (const n of this.nodes) {
      const d = (n.x - p.x) ** 2 + (n.y - p.y) ** 2; const rr = (n.r + 4 / this.scale) ** 2;
      if (d < rr && d < bd) { bd = d; best = n; }
    }
    return best;
  }

  bind() {
    const cv = this.cv; let down = null; let moved = false;
    const pos = (e) => { const r = cv.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; };
    const onDown = (e) => {
      cv.setPointerCapture(e.pointerId);
      const p = pos(e); const n = this.nodeAt(p.x, p.y); moved = false;
      down = { p, tx: this.tx, ty: this.ty, node: n }; this.userMoved = true;
      if (n) { this.drag = { node: n }; this.reheat(0.3); }
    };
    const onMove = (e) => {
      const p = pos(e);
      if (down) {
        if (Math.abs(p.x - down.p.x) + Math.abs(p.y - down.p.y) > 3) moved = true;
        if (this.drag) { const w = this.toWorld(p.x, p.y); this.drag.node.x = w.x; this.drag.node.y = w.y; this.reheat(0.2); }
        else { this.tx = down.tx + p.x - down.p.x; this.ty = down.ty + p.y - down.p.y; this.draw(); }
        return;
      }
      const n = this.nodeAt(p.x, p.y);
      if (n !== this.hover) {
        this.hover = n; cv.style.cursor = n ? 'pointer' : 'grab'; this.draw();
        this.opts.onHover && this.opts.onHover(n, e);
      }
    };
    const onUp = (e) => {
      if (down && !moved && down.node && this.opts.onClick) this.opts.onClick(down.node, e);
      down = null; this.drag = null;
    };
    const onWheel = (e) => {
      e.preventDefault(); this.userMoved = true;
      const p = pos(e); const f = Math.exp(-e.deltaY * 0.0015);
      const ns = Math.min(6, Math.max(0.05, this.scale * f));
      this.tx = p.x - (p.x - this.tx) * (ns / this.scale); this.ty = p.y - (p.y - this.ty) * (ns / this.scale);
      this.scale = ns; this.draw();
    };
    const onLeave = () => { if (this.hover) { this.hover = null; this.draw(); this.opts.onHover && this.opts.onHover(null); } };
    cv.addEventListener('pointerdown', onDown); cv.addEventListener('pointermove', onMove);
    cv.addEventListener('pointerup', onUp); cv.addEventListener('pointercancel', onUp);
    cv.addEventListener('wheel', onWheel, { passive: false }); cv.addEventListener('pointerleave', onLeave);
    this._unbind = () => {
      cv.removeEventListener('pointerdown', onDown); cv.removeEventListener('pointermove', onMove);
      cv.removeEventListener('pointerup', onUp); cv.removeEventListener('pointercancel', onUp);
      cv.removeEventListener('wheel', onWheel); cv.removeEventListener('pointerleave', onLeave);
    };
  }

  draw() {
    const ctx = this.ctx; const c = this.colors || (this.readColors(), this.colors);
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.clearRect(0, 0, this.w, this.hgt);
    ctx.save(); ctx.translate(this.tx, this.ty); ctx.scale(this.scale, this.scale);
    const focus = this.hover || (this.dimFocus && this.focusId && this.byId.get(this.focusId));
    const nb = focus ? this.neigh.get(focus.id) || new Set() : null;
    const hl = this.highlight; // Set of ids matching a search
    for (const e of this.edges) {
      const a = this.byId.get(e.s); const b = this.byId.get(e.t);
      const active = focus && (a === focus || b === focus);
      ctx.globalAlpha = focus ? (active ? 0.95 : 0.12) : (hl ? 0.15 : 0.55);
      ctx.strokeStyle = e.cls && e.cls !== 'plain' ? c[e.cls] : (active ? c.accent : c.plainEdge);
      ctx.lineWidth = (active ? 1.6 : 1) / Math.sqrt(this.scale);
      ctx.setLineDash(e.cls === 'seq' ? [4 / this.scale, 3 / this.scale] : []);
      ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
      if (e.cls && e.cls !== 'plain' && (active || this.scale > 1.2)) {
        const ang = Math.atan2(b.y - a.y, b.x - a.x); const ex = b.x - Math.cos(ang) * (b.r + 2); const ey = b.y - Math.sin(ang) * (b.r + 2);
        const s = 5 / Math.sqrt(this.scale);
        ctx.setLineDash([]); ctx.fillStyle = ctx.strokeStyle; ctx.beginPath();
        ctx.moveTo(ex, ey); ctx.lineTo(ex - s * Math.cos(ang - 0.45), ey - s * Math.sin(ang - 0.45));
        ctx.lineTo(ex - s * Math.cos(ang + 0.45), ey - s * Math.sin(ang + 0.45)); ctx.closePath(); ctx.fill();
      }
    }
    ctx.setLineDash([]);
    for (const n of this.nodes) {
      const dim = (focus && n !== focus && !nb.has(n.id)) || (hl && !hl.has(n.id));
      ctx.globalAlpha = dim ? 0.18 : 1;
      const col = c[n.type] || c.muted;
      nodePath(ctx, n.x, n.y, n.r, TYPE_SHAPE[n.type] || 'circle');
      if (TYPE_SHAPE[n.type] === 'ring') { ctx.fillStyle = c.bg; ctx.fill(); ctx.strokeStyle = col; ctx.lineWidth = 1.8; ctx.stroke(); }
      else { ctx.fillStyle = col; ctx.fill(); }
      if (n.status === 'fleeting') { ctx.strokeStyle = c.bg; ctx.lineWidth = 1.2 / this.scale; ctx.setLineDash([2 / this.scale, 2 / this.scale]); ctx.stroke(); ctx.setLineDash([]); }
      if (n.id === this.focusId || n === this.hover) {
        ctx.strokeStyle = c.accent; ctx.lineWidth = 1.5 / this.scale; ctx.beginPath(); ctx.arc(n.x, n.y, n.r + 4 / this.scale, 0, Math.PI * 2); ctx.stroke();
      }
    }
    const showAll = this.labels && (this.scale > 0.9 || this.nodes.length < 40);
    ctx.font = `${13 / this.scale}px ${c.font}`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'top';
    for (const n of this.nodes) {
      const isF = focus && (n === focus || nb.has(n.id));
      const isH = hl && hl.has(n.id);
      if (!(showAll || isF || isH || n.id === this.focusId)) continue;
      if (focus && !isF && !isH) { if (!showAll) continue; ctx.globalAlpha = 0.25; } else ctx.globalAlpha = 0.95;
      const label = n.label.length > 42 ? n.label.slice(0, 40) + '…' : n.label;
      ctx.lineWidth = 3 / this.scale; ctx.strokeStyle = c.bg; ctx.strokeText(label, n.x, n.y + n.r + 3 / this.scale);
      ctx.fillStyle = c.text; ctx.fillText(label, n.x, n.y + n.r + 3 / this.scale);
    }
    ctx.restore(); ctx.globalAlpha = 1;
  }
}

function buildQuadtree(nodes) {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const n of nodes) { if (n.x < x0) x0 = n.x; if (n.y < y0) y0 = n.y; if (n.x > x1) x1 = n.x; if (n.y > y1) y1 = n.y; }
  const size = Math.max(x1 - x0, y1 - y0) + 1;
  const root = { x: x0, y: y0, s: size, m: 0, cx: 0, cy: 0, kids: null, pt: null };
  const insert = (q, n, d) => {
    if (q.m === 0 && !q.kids) { q.pt = n; q.m = 1; q.cx = n.x; q.cy = n.y; return; }
    if (!q.kids) {
      if (d > 40) { q.cx = (q.cx * q.m + n.x) / (q.m + 1); q.cy = (q.cy * q.m + n.y) / (q.m + 1); q.m++; return; }
      const hs = q.s / 2;
      q.kids = [0, 1, 2, 3].map((k) => ({ x: q.x + (k & 1) * hs, y: q.y + (k >> 1) * hs, s: hs, m: 0, cx: 0, cy: 0, kids: null, pt: null }));
      const p = q.pt; q.pt = null;
      const kp = ((p.x >= q.x + hs) ? 1 : 0) + ((p.y >= q.y + hs) ? 2 : 0); insert(q.kids[kp], p, d + 1);
    }
    const hs = q.s / 2;
    const k = ((n.x >= q.x + hs) ? 1 : 0) + ((n.y >= q.y + hs) ? 2 : 0);
    insert(q.kids[k], n, d + 1);
    q.cx = (q.cx * q.m + n.x) / (q.m + 1); q.cy = (q.cy * q.m + n.y) / (q.m + 1); q.m++;
  };
  for (const n of nodes) insert(root, n, 0);
  return root;
}

function applyRepulsion(q, n, strength, theta2) {
  if (!q || q.m === 0) return;
  let dx = q.cx - n.x; let dy = q.cy - n.y; let d2 = dx * dx + dy * dy;
  if (!q.kids) {
    if (q.pt === n) return;
    if (d2 < 0.01) { dx = Math.random() - 0.5; dy = Math.random() - 0.5; d2 = 0.5; }
  } else if ((q.s * q.s) / d2 > theta2) {
    for (const k of q.kids) applyRepulsion(k, n, strength, theta2);
    return;
  }
  const f = (strength * q.m) / Math.max(d2, 16);
  n.vx -= dx * f; n.vy -= dy * f;
}

function nodePath(ctx, x, y, r, shape) {
  ctx.beginPath();
  if (shape === 'diamond') { const k = r * 1.25; ctx.moveTo(x, y - k); ctx.lineTo(x + k, y); ctx.lineTo(x, y + k); ctx.lineTo(x - k, y); ctx.closePath(); }
  else if (shape === 'square') { const k = r * 0.9; ctx.rect(x - k, y - k, 2 * k, 2 * k); }
  else if (shape === 'triangle') { const k = r * 1.3; ctx.moveTo(x, y - k); ctx.lineTo(x + k * 0.95, y + k * 0.7); ctx.lineTo(x - k * 0.95, y + k * 0.7); ctx.closePath(); }
  else if (shape === 'star' || shape === 'sun') {
    const n = shape === 'star' ? 5 : 12; const R = r * (shape === 'star' ? 1.45 : 1.3); const q = shape === 'star' ? 0.42 : 0.66;
    for (let k = 0; k < 2 * n; k++) { const rr = k % 2 ? R * q : R; const a = (k / (2 * n)) * 2 * Math.PI - Math.PI / 2; const px = x + rr * Math.cos(a); const py = y + rr * Math.sin(a); if (k) ctx.lineTo(px, py); else ctx.moveTo(px, py); }
    ctx.closePath();
  } else if (shape === 'moon') {
    // crescent: disc 1 minus disc 2; draw the outer arc outside disc 2, then the inner arc inside disc 1
    const R = r * 1.12; const x2 = x + R * 0.48; const y2 = y - R * 0.34; const R2 = R * 0.84;
    const dx = x2 - x; const dy = y2 - y; const d = Math.hypot(dx, dy);
    const aa = (R * R - R2 * R2 + d * d) / (2 * d); const hh = Math.sqrt(Math.max(0, R * R - aa * aa));
    const px = x + (aa * dx) / d; const py = y + (aa * dy) / d; const nx = -dy / d; const ny = dx / d;
    const p1 = [px + hh * nx, py + hh * ny]; const p2 = [px - hh * nx, py - hh * ny];
    const arcMid = (cx, cy, rr, t0, t1, ccw) => { let span = ccw ? t0 - t1 : t1 - t0; span = ((span % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI); const tm = ccw ? t0 - span / 2 : t0 + span / 2; return [cx + rr * Math.cos(tm), cy + rr * Math.sin(tm)]; };
    const t1 = Math.atan2(p1[1] - y, p1[0] - x); const t2 = Math.atan2(p2[1] - y, p2[0] - x);
    const m = arcMid(x, y, R, t1, t2, false); const outCcw = (m[0] - x2) ** 2 + (m[1] - y2) ** 2 < R2 * R2;
    const s2 = Math.atan2(p2[1] - y2, p2[0] - x2); const s1 = Math.atan2(p1[1] - y2, p1[0] - x2);
    const m2 = arcMid(x2, y2, R2, s2, s1, false); const inCcw = (m2[0] - x) ** 2 + (m2[1] - y) ** 2 > R * R;
    ctx.moveTo(p1[0], p1[1]); ctx.arc(x, y, R, t1, t2, outCcw); ctx.arc(x2, y2, R2, s2, s1, inCcw); ctx.closePath();
  } else ctx.arc(x, y, r, 0, Math.PI * 2);
}
