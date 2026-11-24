/* The folder tree: an optional sidebar tab (Settings, General, Folder tree).
   A note's folder is the folder part of its file path (n.file). With a linked folder these are the real
   folders on disk; in browser storage the same paths are kept, and they become real folders when you link one
   or export a ZIP. Empty folders that you make are kept in the settings until a note goes into them. */

const FOLDER_IC = '<path d="M3.5 7V17.8a1.5 1.5 0 0 0 1.5 1.5h14a1.5 1.5 0 0 0 1.5-1.5V9.6A1.5 1.5 0 0 0 19 8.1h-7.2l-2-2.6H5A1.5 1.5 0 0 0 3.5 7z"/>';
const FOLDER_OPEN_IC = '<path d="M3.5 17.5V7A1.5 1.5 0 0 1 5 5.5h4.8l2 2.6H19a1.5 1.5 0 0 1 1.5 1.5v1"/><path d="M3.5 17.8 6 11.6a1.5 1.5 0 0 1 1.4-1h13.3a1 1 0 0 1 .9 1.4l-2.4 6.4a1.5 1.5 0 0 1-1.4 1H5a1.5 1.5 0 0 1-1.5-1.5z"/>';
const svgIc = (paths, size = 15) => `<svg class="ic" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round" aria-hidden="true">${paths}</svg>`;

function noteFolder(n) { return n && n.file && n.file.includes('/') ? n.file.slice(0, n.file.lastIndexOf('/') + 1) : ''; }
function cleanFolder(p) { const s = String(p || '').replace(/\\/g, '/').split('/').map((x) => x.trim().replace(/[:*?"<>|]+/g, '-')).filter((x) => x && x !== '.' && x !== '..').join('/'); return s ? s + '/' : ''; }

function allFolders() {
  const set = new Set();
  const add = (dir) => { const parts = dir.split('/').filter(Boolean); let acc = ''; for (const q of parts) { acc += q + '/'; set.add(acc); } };
  for (const n of vault.notes.values()) add(noteFolder(n));
  for (const d of app.settings.folders || []) add(d);
  return Array.from(set).sort((a, b) => a.localeCompare(b));
}

function renderFolderTree(body) {
  const open = app.settings.folderOpen || (app.settings.folderOpen = {});
  const notesIn = new Map();
  for (const n of vault.notes.values()) { const d = noteFolder(n); if (!notesIn.has(d)) notesIn.set(d, []); notesIn.get(d).push(n); }
  for (const list of notesIn.values()) list.sort((a, b) => a.title.localeCompare(b.title));
  const folders = allFolders();
  const kids = (parent) => folders.filter((f) => f !== parent && f.startsWith(parent) && !f.slice(parent.length, -1).includes('/'));
  const count = (dir) => { let c = 0; for (const [d, l] of notesIn) if (d.startsWith(dir)) c += l.length; return c; };

  body.appendChild(h('div', { class: 'ft-head' },
    h('span', { class: 'muted small' }, app.folder.status === 'linked' ? app.folder.name : 'In this browser'),
    h('button', { class: 'link-btn', title: 'New folder', onclick: () => newFolderDialog('') }, '+ folder'),
    h('button', { class: 'link-btn', title: 'Collapse all', onclick: () => { app.settings.folderOpen = {}; saveSettings(); renderSidebar(); } }, 'fold')));

  const tree = h('div', { class: 'ft', role: 'tree' });
  const level = (dir, depth) => {
    for (const f of kids(dir)) {
      const name = f.slice(dir.length, -1); const isOpen = !!open[f];
      const row = h('div', { class: 'ft-folder' + (isOpen ? ' open' : ''), role: 'treeitem', 'aria-expanded': String(isOpen), tabindex: '0', 'data-folder': f, style: { paddingLeft: (12 + depth * 14) + 'px' } },
        h('span', { class: 'ft-caret' }, isOpen ? '▾' : '▸'),
        h('span', { class: 'ft-ic', html: svgIc(isOpen ? FOLDER_OPEN_IC : FOLDER_IC) }),
        h('span', { class: 'ft-name' }, name), h('span', { class: 'count' }, String(count(f) || '')));
      const toggle = () => { open[f] = !isOpen; saveSettings(); renderSidebar(); };
      row.addEventListener('click', toggle);
      row.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle(); } });
      row.addEventListener('contextmenu', (e) => { e.preventDefault(); folderMenu(row, f); });
      dropTarget(row, f);
      tree.appendChild(row);
      if (isOpen) level(f, depth + 1);
    }
    for (const n of notesIn.get(dir) || []) {
      const it = sideItem(n);
      it.classList.add('ft-note'); it.style.paddingLeft = (16 + depth * 14 + (dir ? 14 : 0)) + 'px';
      it.draggable = true;
      it.addEventListener('dragstart', (e) => { e.dataTransfer.setData('application/x-musubi-note', n.id); e.dataTransfer.effectAllowed = 'move'; });
      tree.appendChild(it);
    }
  };
  level('', 0);
  const rootDrop = h('div', { class: 'ft-root-drop' }, 'Drop here to move a note to the top folder');
  dropTarget(rootDrop, '');
  body.appendChild(tree);
  body.appendChild(rootDrop);
  if (!vault.notes.size) body.appendChild(h('div', { class: 'side-empty' }, 'No notes yet.'));
}

function dropTarget(el, dir) {
  el.addEventListener('dragover', (e) => { if (Array.from(e.dataTransfer.types).includes('application/x-musubi-note')) { e.preventDefault(); el.classList.add('drop'); } });
  el.addEventListener('dragleave', () => el.classList.remove('drop'));
  el.addEventListener('drop', (e) => {
    el.classList.remove('drop');
    const id = e.dataTransfer.getData('application/x-musubi-note'); if (!id) return;
    e.preventDefault(); const n = vault.get(id); if (n) moveNoteToFolder(n, dir);
  });
}

function folderMenu(anchor, f) {
  openMenu(anchor, [
    { icon: 'plus', label: 'New note in this folder', run: () => newNoteDialog({ folder: f }) },
    { icon: 'plus', label: 'New folder inside', run: () => newFolderDialog(f) },
    '-',
    { icon: 'pen', label: 'Rename folder', run: () => renameFolderDialog(f) },
    { icon: 'trash', label: 'Delete folder (notes move up one level)', danger: true, run: () => deleteFolder(f) },
  ]);
}

async function newFolderDialog(parent) {
  const v = await promptDialog(parent ? `New folder in “${parent.slice(0, -1)}”` : 'New folder', 'Name (use / for subfolders)', '', 'Create');
  const name = cleanFolder(v); if (!name) return;
  const path = parent + name;
  app.settings.folders = Array.from(new Set([...(app.settings.folders || []), path]));
  const open = app.settings.folderOpen || (app.settings.folderOpen = {});
  let acc = ''; for (const q of path.split('/').filter(Boolean)) { acc += q + '/'; open[acc] = true; }
  saveSettings();
  if (app.folder.status === 'linked') { try { let d = app.folder.handle; for (const q of path.split('/').filter(Boolean)) d = await d.getDirectoryHandle(q, { create: true }); } catch (e) { toast('Could not make the folder on disk: ' + e.message, { kind: 'error' }); } }
  app.settings.sidebarTab = 'folders'; renderSidebar();
}

/* Move a note into a folder ('' is the top). With a linked folder the file moves on disk. */
async function moveNoteToFolder(n, dir) {
  dir = cleanFolder(dir);
  if (noteFolder(n) === dir) return;
  const old = n.file;
  let name = (old ? old.split('/').pop() : safeName(n.title) + '.md');
  if (vault.all().some((o) => o !== n && o.file && o.file.toLowerCase() === (dir + name).toLowerCase())) name = safeName(n.title) + ' ' + n.id + '.md';
  n.file = dir + name;
  if (app.folder.status === 'linked') {
    try {
      const fh = await getFileHandle(n.file, true);
      const w = await fh.createWritable(); await w.write(serializeNote(n)); await w.close();
      n.fileMtime = (await fh.getFile()).lastModified;
      if (old && old !== n.file) await removePath(old).catch(() => {});
    } catch (e) { toast('Could not move the file: ' + e.message, { kind: 'error' }); n.file = old; return; }
  }
  await store.putNote(n);
  app.settings.folders = (app.settings.folders || []).filter((d) => d !== dir);
  saveSettings(); vault.touch();
  if (app.current === n.id) renderPanel();
  renderSidebar();
  toast(`Moved “${n.title}” to ${dir ? dir.slice(0, -1) : 'the top folder'}`);
}

async function renameFolderDialog(f) {
  const parent = f.slice(0, f.slice(0, -1).lastIndexOf('/') + 1);
  const v = await promptDialog('Rename folder', 'New name', f.slice(parent.length, -1), 'Rename');
  const name = cleanFolder(v); if (!name) return;
  const to = parent + name; if (to === f) return;
  const affected = vault.all().filter((n) => noteFolder(n).startsWith(f));
  for (const n of affected) await moveNoteToFolder(n, to + noteFolder(n).slice(f.length));
  app.settings.folders = (app.settings.folders || []).map((d) => (d.startsWith(f) ? to + d.slice(f.length) : d));
  const open = app.settings.folderOpen || {}; if (open[f]) open[to] = true;
  saveSettings();
  if (app.folder.status === 'linked') await removeEmptyDir(f);
  renderSidebar();
}

async function deleteFolder(f) {
  const parent = f.slice(0, f.slice(0, -1).lastIndexOf('/') + 1);
  const affected = vault.all().filter((n) => noteFolder(n).startsWith(f));
  if (affected.length && !(await confirmDialog(`Delete the folder “${f.slice(0, -1)}”?`, `${affected.length} note${affected.length === 1 ? '' : 's'} move${affected.length === 1 ? 's' : ''} to ${parent ? '“' + parent.slice(0, -1) + '”' : 'the top folder'}. No note is deleted.`, 'Delete folder'))) return;
  for (const n of affected) await moveNoteToFolder(n, parent + noteFolder(n).slice(f.length));
  app.settings.folders = (app.settings.folders || []).filter((d) => !d.startsWith(f));
  saveSettings();
  if (app.folder.status === 'linked') await removeEmptyDir(f);
  renderSidebar();
}

async function removeEmptyDir(f) {
  try {
    const parts = f.split('/').filter(Boolean); let dir = app.folder.handle;
    for (const q of parts.slice(0, -1)) dir = await dir.getDirectoryHandle(q);
    await dir.removeEntry(parts[parts.length - 1]);
  } catch (e) { /* not empty or already gone */ }
}

function moveToFolderDialog(n) {
  let ov;
  const list = h('div', { class: 'pal-list' });
  const input = h('input', { class: 'pal-input', placeholder: 'Folder (type a new path to make one)', autocomplete: 'off', spellcheck: 'false' });
  const draw = () => {
    list.innerHTML = '';
    const q = input.value.trim().toLowerCase();
    const opts = ['', ...allFolders()].filter((f) => !q || f.toLowerCase().includes(q));
    const typed = cleanFolder(input.value);
    if (typed && !opts.includes(typed)) opts.unshift(typed);
    for (const f of opts.slice(0, 30)) list.appendChild(h('div', { class: 'pal-item', onclick: () => { ov.close(); moveNoteToFolder(n, f); } },
      h('span', { class: 'ft-ic', html: svgIc(FOLDER_IC, 14) }), h('div', { class: 'pal-main' }, h('div', { class: 'pal-title' }, f ? f.slice(0, -1) : '(top folder)')),
      f === noteFolder(n) ? h('span', { class: 'pal-meta' }, 'here now') : null));
  };
  input.addEventListener('input', draw);
  input.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); const first = list.querySelector('.pal-item'); if (first) first.click(); } });
  ov = overlay('ov-palette', h('div', { class: 'palette' }, h('div', { class: 'pal-foot' }, `Move “${n.title}” to a folder`), input, list));
  draw(); input.focus();
}
