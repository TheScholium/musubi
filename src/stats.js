/* Review statistics. Each answer adds to a log per day (app.srs._log), so the log travels with the
   review data in backups and ZIP exports. Card states come from the schedule itself. */

const STAT_KEYS = ['a', 'h', 'g', 'e'];
function statsLog(card, prev, grade, ms) {
  const L = app.srs._log || (app.srs._log = {});
  const day = todayKey();
  const d = L[day] || (L[day] = { n: 0, a: 0, h: 0, g: 0, e: 0, nw: 0, lr: 0, yr: 0, yf: 0, mr: 0, mf: 0, ms: 0 });
  d.n++; d[STAT_KEYS[grade - 1]]++;
  if (!prev) d.nw++;
  else if (prev.ivl < 1) d.lr++;
  else if (prev.ivl >= 21) { d.mr++; if (grade === 1) d.mf++; }
  else { d.yr++; if (grade === 1) d.yf++; }
  d.ms += Math.max(0, Math.min(ms || 0, 60000));
}

function dayKeyOffset(k) { const d = new Date(); d.setHours(12, 0, 0, 0); d.setDate(d.getDate() + k); return isoLocal(d).slice(0, 10); }
function startOfToday() { const d = new Date(); d.setHours(0, 0, 0, 0); return d.getTime(); }

function reviewStats() {
  const L = app.srs._log || {};
  const cards = cardsAll(); const now = Date.now(); const t0 = startOfToday();
  const state = { new: 0, learning: 0, young: 0, mature: 0 };
  const forecast = new Array(31).fill(0); const ivls = [];
  const byNote = new Map();
  for (const c of cards) {
    const s = app.srs[c.id];
    if (!s) { state.new++; continue; }
    if (s.ivl < 1) state.learning++; else if (s.ivl < 21) state.young++; else state.mature++;
    const k = Math.max(0, Math.floor((s.due - t0) / DAY)); if (k <= 30) forecast[k]++;
    if (s.ivl >= 1) ivls.push(s.ivl);
    if (s.lapses) { const e = byNote.get(c.noteId) || { lapses: 0, cards: 0 }; e.lapses += s.lapses; e.cards++; byNote.set(c.noteId, e); }
  }
  const dueNow = dueQueue().length;
  const sum = (days) => {
    const o = { n: 0, a: 0, h: 0, g: 0, e: 0, nw: 0, yr: 0, yf: 0, mr: 0, mf: 0, ms: 0, days: 0 };
    for (let k = 0; k > -days; k--) { const d = L[dayKeyOffset(k)]; if (!d) continue; o.days++; for (const key of Object.keys(o)) if (key !== 'days' && d[key]) o[key] += d[key]; }
    return o;
  };
  let streak = 0; { let k = L[dayKeyOffset(0)] && L[dayKeyOffset(0)].n ? 0 : -1; while (L[dayKeyOffset(k)] && L[dayKeyOffset(k)].n) { streak++; k--; } }
  let best = 0; { const days = Object.keys(L).filter((k) => L[k].n).sort(); let run = 0; let prev = null; for (const k of days) { const t = Date.parse(k + 'T12:00:00'); run = prev != null && Math.round((t - prev) / DAY) === 1 ? run + 1 : 1; prev = t; best = Math.max(best, run); } }
  const hardest = Array.from(byNote, ([id, e]) => ({ note: vault.get(id), ...e })).filter((x) => x.note).sort((a, b) => b.lapses - a.lapses).slice(0, 10);
  return { L, total: cards.length, state, forecast, ivls, dueNow, today: sum(1), month: sum(30), year: sum(365), streak, best, hardest, now };
}

const pctStr = (x) => (Number.isFinite(x) ? Math.round(x * 100) + '%' : '–');
const minStr = (ms) => (ms < 60000 ? Math.round(ms / 1000) + ' s' : ms < 3600000 ? Math.round(ms / 60000) + ' min' : (ms / 3600000).toFixed(1) + ' h');

/* A bar chart in SVG. series: [{ key, label, cls, values }], stacked bottom to top. */
function statBars(labels, series, opts = {}) {
  const W = 640; const H = opts.h || 170; const ml = 34; const mr = 6; const mt = 10; const mb = 24;
  const n = labels.length; const pw = W - ml - mr; const ph = H - mt - mb;
  const totals = labels.map((_, i) => series.reduce((s, sr) => s + (sr.values[i] || 0), 0));
  const max = Math.max(1, ...totals);
  let { ticks } = niceTicks(0, max, 4); ticks = ticks.filter(Number.isInteger); if (ticks.length < 2) ticks = [0, max]; const top = Math.max(max, ticks[ticks.length - 1]);
  const Y = (v) => mt + ph - (v / top) * ph;
  const bw = pw / n; const gap = Math.max(1, Math.min(4, bw * 0.22));
  const out = [];
  for (const t of ticks) out.push(`<line class="st-grid" x1="${ml}" x2="${W - mr}" y1="${Y(t).toFixed(1)}" y2="${Y(t).toFixed(1)}"/><text class="st-tick" x="${ml - 6}" y="${(Y(t) + 4).toFixed(1)}" text-anchor="end">${t}</text>`);
  labels.forEach((lab, i) => {
    let base = 0; const x = ml + i * bw + gap / 2; const w = Math.max(1, bw - gap);
    const tip = esc(lab.long || lab.text) + ': ' + series.map((s) => { const v = s.values[i] || 0; return `${v} ${v === 1 ? s.one || s.label : s.label}`; }).join(', ');
    const segs = series.map((s) => ({ s, v: s.values[i] || 0 })).filter((x2) => x2.v > 0);
    segs.forEach((sg, j) => {
      const y0 = Y(base); const y1 = Y(base + sg.v); base += sg.v;
      const hgt = Math.max(0, y0 - y1 - (j < segs.length - 1 ? 2 : 0)); // 2px gap between stacked segments
      const r = j === segs.length - 1 ? Math.min(4, w / 2, hgt) : 0;
      const yt = y0 - hgt;
      out.push(r > 0
        ? `<path class="${sg.s.cls}" d="M${x.toFixed(1)},${y0.toFixed(1)}V${(yt + r).toFixed(1)}Q${x.toFixed(1)},${yt.toFixed(1)} ${(x + r).toFixed(1)},${yt.toFixed(1)}H${(x + w - r).toFixed(1)}Q${(x + w).toFixed(1)},${yt.toFixed(1)} ${(x + w).toFixed(1)},${(yt + r).toFixed(1)}V${y0.toFixed(1)}Z"/>`
        : `<rect class="${sg.s.cls}" x="${x.toFixed(1)}" y="${yt.toFixed(1)}" width="${w.toFixed(1)}" height="${hgt.toFixed(1)}"/>`);
    });
    out.push(`<rect class="st-hit" x="${(ml + i * bw).toFixed(1)}" y="${mt}" width="${bw.toFixed(1)}" height="${ph}" data-tip="${tip}"/>`);
    if (lab.show) out.push(`<text class="st-tick" x="${(ml + i * bw + bw / 2).toFixed(1)}" y="${H - 6}" text-anchor="middle">${esc(lab.text)}</text>`);
  });
  out.push(`<line class="st-axis" x1="${ml}" x2="${W - mr}" y1="${Y(0)}" y2="${Y(0)}"/>`);
  return `<svg class="st-svg" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(opts.aria || 'Bar chart')}">${out.join('')}</svg>`;
}

function statTable(head, rows) {
  return `<table class="st-table"><thead><tr>${head.map((x) => `<th>${esc(x)}</th>`).join('')}</tr></thead><tbody>${rows.map((r) => `<tr>${r.map((x) => `<td>${esc(String(x))}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
}

function openStats() {
  let ov; let range = app.settings.statsRange || 30;
  const box = h('div', { class: 'stats' });
  const tip = h('div', { class: 'st-tip', hidden: true });
  const draw = () => {
    const S = reviewStats();
    box.innerHTML = '';
    box.appendChild(h('div', { class: 'rv-head' }, h('b', null, 'Review statistics'),
      h('button', { class: 'btn btn-sm btn-primary', onclick: () => { ov.close(); openReview(); }, disabled: !S.dueNow }, S.dueNow ? `Review ${S.dueNow} due` : 'Nothing due'),
      h('button', { class: 'icon-btn', title: 'Close', html: icon('x', 18), onclick: () => ov.close() })));
    const body = h('div', { class: 'st-body' });
    box.appendChild(body);
    if (!S.total) { body.appendChild(h('div', { class: 'rv-done' }, h('h3', null, 'No cards yet'), h('p', { class: 'muted' }, 'Make cards with {{c1::cloze}}, Q:/A: lines, or named :::definition and :::theorem blocks.'))); return; }

    // headline numbers
    const m = S.month; const retained = m.yr + m.mr; const retention = retained ? 1 - (m.yf + m.mf) / retained : NaN;
    const tile = (label, value, sub) => h('div', { class: 'st-tile' }, h('div', { class: 'st-tile-label' }, label), h('div', { class: 'st-tile-value' }, value), sub ? h('div', { class: 'st-tile-sub' }, sub) : null);
    body.appendChild(h('div', { class: 'st-tiles' },
      tile('Due now', String(S.dueNow), `${S.forecast[1] || 0} tomorrow`),
      tile('Today', String(S.today.n), S.today.n ? `${minStr(S.today.ms)} · ${S.today.nw} new` : 'no reviews yet'),
      tile('Streak', S.streak + (S.streak === 1 ? ' day' : ' days'), `longest ${S.best}`),
      tile('Retention', pctStr(retention), retained ? `last 30 days · ${retained} reviews` : 'needs reviews of seen cards'),
      tile('Cards', String(S.total), `${S.state.mature} mature · ${S.state.new} new`)));

    // maturity bar: one composite figure
    const st = S.state; const tot = S.total;
    const seg = (k, label, cls) => (st[k] ? h('div', { class: 'st-mat-seg ' + cls, style: { flex: String(st[k]) }, 'data-tip': `${label}: ${st[k]} card${st[k] === 1 ? '' : 's'} (${pctStr(st[k] / tot)})` }) : null);
    body.appendChild(h('section', { class: 'st-sec' }, h('div', { class: 'st-sec-head' }, h('h4', null, 'Where the cards are')),
      h('div', { class: 'st-mat' }, seg('new', 'New (never reviewed)', 'm-new'), seg('learning', 'Learning (interval under a day)', 'm-learn'), seg('young', 'Young (interval under 21 days)', 'm-young'), seg('mature', 'Mature (21 days or more)', 'm-mature')),
      h('div', { class: 'st-mat-legend' }, ...[['new', 'New', 'm-new'], ['learning', 'Learning', 'm-learn'], ['young', 'Young', 'm-young'], ['mature', 'Mature', 'm-mature']].map(([k, l, c]) => h('span', null, h('i', { class: 'st-key ' + c }), `${l} ${st[k]}`)))));

    // reviews per day
    const days = []; for (let k = -range + 1; k <= 0; k++) days.push(k);
    const L = S.L;
    const every = range <= 30 ? 5 : range <= 90 ? 15 : 60;
    const labs = days.map((k, i) => { const key = dayKeyOffset(k); const d = new Date(key + 'T12:00:00'); return { text: k === 0 ? 'today' : d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }), long: d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' }), show: k === 0 || (days.length - 1 - i) % every === 0 && i > 2 }; });
    const rev = days.map((k) => { const d = L[dayKeyOffset(k)]; return d ? d.n - d.nw : 0; });
    const nw = days.map((k) => { const d = L[dayKeyOffset(k)]; return d ? d.nw : 0; });
    const rangeSel = h('div', { class: 'st-range', role: 'group', 'aria-label': 'Time range' }, ...[[30, '30 days'], [90, '3 months'], [365, '1 year']].map(([v, l]) => h('button', { class: 'st-range-btn' + (v === range ? ' on' : ''), 'aria-pressed': String(v === range), onclick: () => { range = v; app.settings.statsRange = v; saveSettings(); draw(); } }, l)));
    const totalRange = rev.reduce((a, b) => a + b, 0) + nw.reduce((a, b) => a + b, 0);
    body.appendChild(statSection('Reviews per day', `${totalRange} in this period`, rangeSel,
      statBars(labs, [{ label: 'reviews', one: 'review', cls: 'st-a', values: rev }, { label: 'new cards', one: 'new card', cls: 'st-b', values: nw }], { aria: 'Reviews per day' }),
      h('div', { class: 'st-legend' }, h('span', null, h('i', { class: 'st-key st-a' }), 'reviews'), h('span', null, h('i', { class: 'st-key st-b' }), 'new cards')),
      () => statTable(['Day', 'Reviews', 'New cards'], days.map((k, i) => [dayKeyOffset(k), rev[i], nw[i]]).filter((r) => r[1] || r[2]).reverse())));

    // answers in the last 30 days
    const ans = m.a + m.h + m.g + m.e;
    if (ans) body.appendChild(h('div', { class: 'st-answers' }, h('span', { class: 'muted small' }, 'Answers, last 30 days:'),
      ...[['Again', m.a], ['Hard', m.h], ['Good', m.g], ['Easy', m.e]].map(([l, v]) => h('span', null, h('b', null, l), ` ${v} (${pctStr(v / ans)})`)),
      h('span', { class: 'muted small' }, `· ${minStr(m.ms)} in all, ${ans ? Math.round(m.ms / ans / 1000) : 0} s a card`)));

    // forecast
    const fl = S.forecast.map((_, k) => { const d = new Date(Date.now() + k * DAY); return { text: k === 0 ? 'today' : k === 1 ? '+1' : '+' + k, long: k === 0 ? 'Today (and overdue)' : d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' }), show: k === 0 || k % 5 === 0 }; });
    body.appendChild(statSection('Due in the next 30 days', `${S.forecast.reduce((a, b) => a + b, 0)} reviews`, null,
      statBars(fl, [{ label: 'due', cls: 'st-a', values: S.forecast }], { aria: 'Forecast of due cards', h: 150 }), null,
      () => statTable(['Day', 'Due'], S.forecast.map((v, k) => [dayKeyOffset(k), v]).filter((r) => r[1]))));

    // intervals
    const buckets = [['1 d', 1, 2], ['2–3 d', 2, 4], ['4–7 d', 4, 8], ['1–2 wk', 8, 15], ['2–4 wk', 15, 31], ['1–3 mo', 31, 92], ['3–6 mo', 92, 183], ['6–12 mo', 183, 366], ['1 y +', 366, Infinity]];
    const bc = buckets.map(([, a, b]) => S.ivls.filter((x) => x >= a && x < b).length);
    if (S.ivls.length) body.appendChild(statSection('How far apart reviews are', 'the interval of each seen card', null,
      statBars(buckets.map(([l]) => ({ text: l, long: 'Interval ' + l, show: true })), [{ label: 'cards', one: 'card', cls: 'st-a', values: bc }], { aria: 'Card intervals', h: 150 }), null,
      () => statTable(['Interval', 'Cards'], buckets.map(([l], i) => [l, bc[i]]))));

    // calendar heatmap: the last 26 weeks
    const weeks = 26; const cells = [];
    const today = new Date(); today.setHours(12, 0, 0, 0);
    const startOff = -((weeks - 1) * 7 + (today.getDay() + 6) % 7);
    const maxN = Math.max(1, ...Object.values(L).map((d) => d.n || 0));
    for (let k = startOff; k <= 0; k++) {
      const key = dayKeyOffset(k); const v = L[key] ? L[key].n : 0; const lvl = v ? Math.min(4, 1 + Math.floor((v / maxN) * 4)) : 0;
      cells.push(h('i', { class: 'st-day l' + lvl, 'data-tip': `${new Date(key + 'T12:00:00').toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}: ${v} review${v === 1 ? '' : 's'}` }));
    }
    body.appendChild(h('section', { class: 'st-sec' }, h('div', { class: 'st-sec-head' }, h('h4', null, 'Calendar'), h('span', { class: 'muted small' }, 'the last six months; a darker square, more reviews')),
      h('div', { class: 'st-cal' }, ...cells),
      h('div', { class: 'st-cal-key' }, h('span', { class: 'muted small' }, 'fewer'), ...[0, 1, 2, 3, 4].map((l) => h('i', { class: 'st-day l' + l })), h('span', { class: 'muted small' }, 'more'))));

    // notes whose cards you forget most
    if (S.hardest.length) {
      const list = h('div', { class: 'st-hard' });
      for (const x of S.hardest) list.appendChild(h('div', { class: 'st-hard-row' }, h('span', { class: 'dot t-' + x.note.type }),
        h('a', { class: 'wl', href: '#n-' + x.note.id, onclick: (e) => { e.preventDefault(); ov.close(); openNote(x.note.id); } }, x.note.title),
        h('span', { class: 'muted small' }, `${x.lapses} lapse${x.lapses === 1 ? '' : 's'} in ${x.cards} card${x.cards === 1 ? '' : 's'}`),
        h('button', { class: 'link-btn', onclick: () => { ov.close(); openReview({ noteId: x.note.id }); } }, 'study')));
      body.appendChild(h('section', { class: 'st-sec' }, h('div', { class: 'st-sec-head' }, h('h4', null, 'Cards you forget most'), h('span', { class: 'muted small' }, 'rewrite these, split them, or link them to what you know')), list));
    }
  };
  box.addEventListener('mouseover', (e) => {
    const t = e.target.closest('[data-tip]'); if (!t) { tip.hidden = true; return; }
    tip.textContent = t.dataset.tip; tip.hidden = false;
    const r = t.getBoundingClientRect(); const br = box.getBoundingClientRect();
    tip.style.left = Math.min(br.width - 230, Math.max(4, r.left - br.left + r.width / 2 - 110)) + 'px';
    tip.style.top = (r.top - br.top - 34 + box.scrollTop) + 'px';
  });
  box.addEventListener('mouseleave', () => { tip.hidden = true; });
  ov = overlay('ov-stats', h('div', { class: 'stats-wrap' }, box, tip));
  draw();
}

function statSection(title, sub, controls, svg, legend, tableFn) {
  const chart = h('div', { class: 'st-chart', html: svg });
  const table = h('div', { class: 'st-tablewrap', hidden: true });
  const toggle = h('button', { class: 'link-btn', onclick: () => { const show = table.hidden; table.hidden = !show; chart.hidden = show; if (legend) legend.hidden = show; if (show && !table.innerHTML) table.innerHTML = tableFn(); toggle.textContent = show ? 'chart' : 'table'; } }, 'table');
  return h('section', { class: 'st-sec' }, h('div', { class: 'st-sec-head' }, h('h4', null, title), h('span', { class: 'muted small' }, sub), controls || null, toggle), chart, legend || null, table);
}
