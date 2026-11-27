/* The note types editor (Settings, Note types): one list of every type, built-in and your own.
   Retire: the type leaves the menus for new and changed notes; notes that have it keep it and show it.
   Delete: the type goes away for good; its notes move to a type that you choose. A built-in type that you
   delete comes back only with "Reset to defaults". Reset to defaults: every built-in type is active again,
   and your own types are removed (their notes move to a type that you choose). */

const typeRetired = (id) => (app.settings.retiredTypes || []).includes(id);
const typeDeleted = (id) => (app.settings.deletedTypes || []).includes(id);
const isBuiltinType = (id) => TYPE_IDS.slice(0, BUILTIN_TYPE_COUNT).includes(id);

/* The types to offer in a menu. The type a note has now stays in the list, so the menu can show it. */
function pickableTypes(current) {
  return NOTE_TYPES.filter(([k]) => (!typeRetired(k) && !typeDeleted(k)) || k === current);
}

/* Give every note of one type another type. */
async function retypeNotes(from, to) {
  const list = vault.all().filter((n) => n.type === from);
  if (app.current) saveCurrent.flush();
  const now = isoLocal();
  for (const n of list) { n.type = to; n.modified = now; ed.forget(n.id); await persistNote(n, { snapshot: false }); }
  vault.touch();
  if (app.current && list.some((n) => n.id === app.current)) fillHeader(cur());
  return list.length;
}

/* A dialog that asks where the notes of a type go. Resolves to a type id, or null for Cancel. */
function chooseTypeDialog(title, msg, exclude, okLabel) {
  return new Promise((res) => {
    let ov;
    const opts = pickableTypes().filter(([k]) => !exclude.includes(k));
    const sel = h('select', { class: 'input', 'aria-label': 'New type for these notes' }, ...opts.map(([k, l]) => h('option', { value: k }, l)));
    sel.value = opts.some(([k]) => k === 'concept') ? 'concept' : (opts[0] || [''])[0];
    const ok = h('button', { class: 'btn btn-danger', onclick: () => ov.close(sel.value) }, okLabel);
    ov = overlay('ov-dialog', h('div', { class: 'dialog' }, h('h3', null, title), h('p', { class: 'muted' }, msg),
      h('label', { class: 'field' }, h('span', null, 'Move these notes to'), sel),
      h('div', { class: 'dialog-actions' }, h('button', { class: 'btn', onclick: () => ov.close(null) }, 'Cancel'), ok)), { onClose: (v) => res(typeof v === 'string' && v ? v : null) });
    sel.focus();
  });
}

function typesChanged() {
  app.settings.customTypes = (app.settings.customTypes || []).slice();
  saveSettings(); applyCustomTypes(app.settings.customTypes); refreshTypeOptions();
}

function renderTypesPane() {
  const s = app.settings;
  const wrap = h('div', { class: 'types-pane' });
  let open = null; // the type whose shape and colour pickers are open
  const count = (id) => { let c = 0; for (const n of vault.notes.values()) if (n.type === id) c++; return c; };

  const retire = (id, on) => {
    const set = new Set(s.retiredTypes || []); if (on) set.add(id); else set.delete(id);
    s.retiredTypes = Array.from(set); typesChanged(); draw();
    toast(on ? `“${TYPE_LABEL[id]}” is retired: it is not offered for new notes` : `“${TYPE_LABEL[id]}” is back in the menus`);
  };
  const remove = async (id) => {
    const label = TYPE_LABEL[id] || id; const used = count(id);
    let to = null;
    if (used) {
      to = await chooseTypeDialog(`Delete the type “${label}”?`, `${used} note${used === 1 ? ' has' : 's have'} this type. Choose a new type for ${used === 1 ? 'it' : 'them'}.${isBuiltinType(id) ? ' A built-in type comes back only with Reset to defaults.' : ''}`, [id], 'Delete type');
      if (!to) return;
    } else if (!(await confirmDialog(`Delete the type “${label}”?`, isBuiltinType(id) ? 'No note has this type. A built-in type comes back only with Reset to defaults.' : 'No note has this type.', 'Delete type', true))) return;
    if (to) await retypeNotes(id, to);
    s.retiredTypes = (s.retiredTypes || []).filter((x) => x !== id);
    if (isBuiltinType(id)) s.deletedTypes = Array.from(new Set([...(s.deletedTypes || []), id]));
    else s.customTypes = (s.customTypes || []).filter((t) => t.id !== id);
    typesChanged(); draw();
    toast(`Type “${label}” deleted` + (to ? `; ${used} note${used === 1 ? '' : 's'} moved to “${TYPE_LABEL[to]}”` : ''));
  };
  const resetAll = async () => {
    const mine = s.customTypes || [];
    const usedMine = mine.reduce((a, t) => a + count(t.id), 0);
    let to = null;
    if (usedMine) {
      to = await chooseTypeDialog('Reset the note types to the defaults?', `Every built-in type is active again. Your ${mine.length} type${mine.length === 1 ? ' is' : 's are'} removed, and ${usedMine} note${usedMine === 1 ? '' : 's'} with ${mine.length === 1 ? 'it' : 'them'} need${usedMine === 1 ? 's' : ''} a new type.`, mine.map((t) => t.id).concat(s.deletedTypes || []), 'Reset');
      if (!to) return;
    } else if (!(await confirmDialog('Reset the note types to the defaults?', `Every built-in type is active again${mine.length ? ` and your ${mine.length} type${mine.length === 1 ? ' is' : 's are'} removed` : ''}.`, 'Reset', true))) return;
    if (to) for (const t of mine) await retypeNotes(t.id, to);
    s.customTypes = []; s.retiredTypes = []; s.deletedTypes = [];
    typesChanged(); draw(); toast('Note types reset to the defaults');
  };
  const add = (input) => {
    const label = input.value.trim(); if (!label) { input.focus(); return; }
    const existing = NOTE_TYPES.find(([, l]) => l.toLowerCase() === label.toLowerCase());
    if (existing && typeDeleted(existing[0])) { s.deletedTypes = s.deletedTypes.filter((x) => x !== existing[0]); typesChanged(); draw(); toast(`“${existing[1]}” is back`); return; }
    if (existing) { toast(`“${existing[1]}” is already a type`); input.select(); return; }
    let id = typeSlug(label) || 'type'; const taken = new Set(TYPE_IDS); let k = 2; const base = id;
    while (taken.has(id)) id = `${base}-${k++}`;
    const usedColors = new Set((s.customTypes || []).map((x) => x.color));
    const color = (ISTARI_PIGMENTS.find(([c]) => !usedColors.has(c)) || ISTARI_PIGMENTS[0])[0];
    s.customTypes = [...(s.customTypes || []), { id, label, shape: 'star', color }];
    open = id; typesChanged(); draw(); toast(`Type “${label}” added`);
  };

  const row = (id, retired) => {
    const custom = (s.customTypes || []).find((t) => t.id === id);
    const used = count(id);
    const label = TYPE_LABEL[id] || id;
    const nameEl = custom
      ? h('input', { class: 'type-name-in', value: label, 'aria-label': 'Name of the type', title: 'Rename' })
      : h('span', { class: 'type-name-fixed' }, label);
    if (custom) nameEl.addEventListener('change', () => { const v = nameEl.value.trim(); if (!v) { nameEl.value = label; return; } custom.label = v; typesChanged(); draw(); });
    const marker = h('button', { class: 'type-marker' + (custom ? ' editable' : ''), title: custom ? 'Shape and colour' : 'Built-in type', 'aria-label': custom ? 'Shape and colour of ' + label : label, disabled: !custom, onclick: () => { open = open === id ? null : id; draw(); } }, h('span', { class: 'dot t-' + id }));
    const el = h('div', { class: 'tl-row' + (retired ? ' retired' : ''), 'data-type': id },
      marker, nameEl,
      h('span', { class: 'tl-meta' }, custom ? 'yours' : 'built-in'),
      h('span', { class: 'tl-count', title: 'Notes with this type' }, used ? String(used) : ''),
      h('span', { class: 'tl-actions' },
        retired ? h('button', { class: 'link-btn', onclick: () => retire(id, false) }, 'restore')
          : h('button', { class: 'link-btn', title: 'Take it out of the menus; notes keep it', onclick: () => retire(id, true) }, 'retire'),
        h('button', { class: 'link-btn danger', title: 'Delete for good; its notes move to another type', onclick: () => remove(id) }, 'delete')));
    const out = [el];
    if (custom && open === id) {
      const color = pigmentVar(custom.color);
      out.push(h('div', { class: 'tl-picks' },
        h('div', { class: 'shape-picks', role: 'radiogroup', 'aria-label': 'Shape' }, ...TYPE_SHAPES.map(([k, l]) => h('button', {
          class: 'shape-btn' + (custom.shape === k ? ' on' : ''), title: l, 'aria-label': l, role: 'radio', 'aria-checked': String(custom.shape === k),
          onclick: () => { custom.shape = k; typesChanged(); draw(); } }, h('span', { class: 'dot shape-' + k, style: '--tc:' + color })))),
        h('div', { class: 'color-picks', role: 'radiogroup', 'aria-label': 'Colour' }, ...ISTARI_PIGMENTS.map(([k, l]) => h('button', {
          class: 'swatch' + (custom.color === k ? ' on' : ''), title: l, 'aria-label': l, role: 'radio', 'aria-checked': String(custom.color === k), style: 'background:' + pigmentVar(k),
          onclick: () => { custom.color = k; typesChanged(); draw(); } }))),
        h('code', { class: 'type-id', title: 'Notes store this in their front matter' }, 'type: ' + id)));
    }
    return out;
  };

  const draw = () => {
    wrap.innerHTML = '';
    const input = h('input', { class: 'input', placeholder: 'A new type, for example Lemma or Experiment', 'aria-label': 'Name of a new type' });
    input.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); add(input); } });
    wrap.appendChild(h('div', { class: 'tl-add' }, input, h('button', { class: 'btn btn-sm btn-cta', onclick: () => add(input) }, 'Add')));
    const active = NOTE_TYPES.filter(([k]) => !typeDeleted(k) && !typeRetired(k));
    const retired = NOTE_TYPES.filter(([k]) => !typeDeleted(k) && typeRetired(k));
    wrap.appendChild(h('div', { class: 'tl-head' }, h('span', null, `In use · ${active.length}`), h('span', { class: 'muted small' }, 'Click the marker of your own type to change its shape and colour.')));
    const list = h('div', { class: 'tl-list' }); for (const [k] of active) list.append(...row(k, false)); wrap.appendChild(list);
    if (retired.length) {
      wrap.appendChild(h('div', { class: 'tl-head' }, h('span', null, `Retired · ${retired.length}`), h('span', { class: 'muted small' }, 'Not offered for new notes. Notes that have them keep them.')));
      const rl = h('div', { class: 'tl-list' }); for (const [k] of retired) rl.append(...row(k, true)); wrap.appendChild(rl);
    }
    const gone = (s.deletedTypes || []).length;
    wrap.appendChild(h('div', { class: 'tl-foot' },
      h('span', { class: 'muted small' }, gone ? `${gone} built-in type${gone === 1 ? ' is' : 's are'} deleted.` : 'A type can have its own template (Settings, Templates). Search with type:name.'),
      h('button', { class: 'btn btn-sm', onclick: resetAll }, 'Reset to defaults')));
  };
  draw();
  return wrap;
}
