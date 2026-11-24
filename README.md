# Musubi

**An offline Zettelkasten for mathematics, physics and philosophy.**

Musubi is a note platform in one HTML file. It needs no server, no account and no network. Open `dist/musubi.html` in a browser and write. Notes are plain Markdown files with YAML front matter, so they stay readable in any editor and in Obsidian.

It is set in **Istari**, a dark, book-like design system: warm ink, parchment text, one gold pigment, Garamond type, and rules instead of boxes. The fonts are embedded, so the file never loads anything from the internet.

## The name

**Musubi** (結び) is Japanese for a knot or a tie, from the verb *musubu* (結ぶ): to tie, to bind, to join. In Shinto, *musubi* (産霊) is also the power by which things come into being; two of the first three deities named in the *Kojiki*, Takamimusubi and Kamimusubi, carry it in their names. A Zettelkasten works in both senses: links tie separate notes together, and new ideas come out of the ties.

---

## What is special about it

| Need | Musubi |
|---|---|
| Write mathematics without a second pane | **Live preview.** Markdown and TeX render in place. Put the cursor inside a construct and its source appears: `**`, `$…$`, `#`, `[[…]]`. While you edit a display equation, a rendered copy shows under the source. |
| Formal statements | `:::theorem[Name]` … `:::` becomes a numbered theorem in the Istari callout style. Also definition, lemma, proposition, corollary, proof (ends with ∎), axiom, postulate, law, principle, example, exercise, remark, intuition, objection, reply, quote. |
| Philosophical arguments | `:::argument` blocks with premises `P1.`, conclusion `C.`, an inference rule, and justifications `[from P1, P2]`. |
| Numbered equations | `\label{eq:x}` and `\eqref{eq:x}`, numbered per note, in `$$`, `\[…\]`, `align`, `gather`, `multline` and `equation`. |
| Links | Plain links `[[Title]]` need nothing else. A relation is optional: `supports::[[…]]`, `refutes::[[…]]`, `depends-on::[[…]]`, or any word. |
| Sources | Literature notes with a citekey, citations `[@gettier1963, p. 122]`, BibTeX import and export. |
| Retention | Spaced repetition. Named definitions and theorems become flashcards with no extra work; so do `{{c1::cloze}}` and `Q:`/`A:` pairs. A long answer goes in braces, `A:{ … }`, and can hold lists, display math and paragraphs. |

## Features

**Writing**
- Live preview, source mode (plain Markdown) and read mode. `Ctrl/⌘ E` switches between writing and reading; `Ctrl/⌘ Shift E` toggles source mode.
- Click a rendered link to open it; `Alt`-click to edit it instead. Click a formula to edit its TeX.
- Completion for `[[links]]` (with "create note"), `#tags`, `[@citations]`, `:::environments`, LaTeX commands and your own macros.
- `Ctrl/⌘ B`, `I`, `M` (inline math), `Shift M` (display math), `Shift L` (link), `Shift D` (cloze), `Shift H` (highlight). Lists continue on Enter; `P1.` premises continue too.
- **LaTeX Suite snippets**, compatible with the Obsidian plugin: `mk` and `dm` open math, `x/` makes a fraction, `sr`, `@a`, `x1`, `RR`, `sum`, `pmat` and about 200 more expand as you type. Tab moves through fields and out of brackets; matrix shortcuts, auto-enlarged brackets, visual snippets on a selection, and undo that keeps what you typed. Paste your own LaTeX Suite snippet file in Settings, Mathematics.
- **Attachments:** paste or drop any file. Images, PDFs, audio and video show in the note (`![[file]]`); other files become links (`[[file]]`). Settings → Data chooses where new attachments go: a fixed folder, a folder next to each note, the note's own folder, or the vault folder. Musubi finds attachments anywhere in the folder by name or relative path, so Markdown links such as `![fig|300](figures/fig.png)` and `[paper](../library/paper.pdf)` work. PDFs and other large files stay in the folder and are read only when opened; images changed in another app load again.
- Footnotes, tables (rendered when the cursor is outside), task lists, callouts (`> [!tip]`), highlights (`==…==`), code blocks.
- A template for each of the 14 note types, editable in Settings.

**Linking and navigation**
- Links by title, alias or ID; `[[Title|label]]`, `[[Title#Heading]]`; embeds `![[Note]]` and `![[Note#Heading]]`.
- **Add a link** from the note menu or the `+ link` button: choose a note, and optionally a relation.
- Renaming a note rewrites every link to it.
- Under each note, in the Istari "mentions" style: its links, the notes that link to it (with the sentence around each link), and unlinked mentions with a one-click *link*.
- Hover previews, a command palette and fuzzy quick switcher (`Ctrl/⌘ K`; `>` for commands), full-text search with `tag:`, `type:`, `status:`, `"phrases"` and `-exclusions`.
- Global and local graph. Markers are shaped by field and coloured by type.

**The type key**
A compass floats at the foot of the note list. Rest the pointer on it for a moment and the key opens: circles for general notes, diamonds for mathematics, squares for physics, triangles for philosophy, one Istari pigment per type. Click a type to filter the list.

**Zettelkasten workflow**
- Stable timestamp IDs. Quick capture (`Alt C`) to an inbox of fleeting notes.
- *Branch* (`Alt B`): a new note that continues the current one, linked both ways.
- *Extract*: move a selection into a new note and leave a link.
- *Maintain* tab: orphans, unresolved links, stale fleeting notes.

**First start**
A thirteen-step tour, skippable at any step, uses two practice notes to show live preview, links, statements, mentions, the type key, capture, search, graph, review and data. When it ends (or is skipped), Musubi deletes every note, history entry, review schedule, trash entry and image made during the tour, and shows an empty setup screen: write the first note, link a folder, or import. The tour resumes after a reload. When a new version changes the tour, it opens once more for every user, and existing notes stay as they are. It can also be replayed from Settings without touching existing notes. Example notes are available on request in Settings, Data.

**Data and safety**
- Storage in IndexedDB; in-memory mode with a warning if the browser blocks storage.
- Two-way folder sync in Chromium browsers: one `.md` file per note, named after its title; outside edits load when you return to the tab.
- Version history with a line diff, a trash with undo, and synchronisation between tabs.
- Export: Markdown ZIP (with images and review data), JSON backup, BibTeX. Import: Markdown files or folders (Obsidian, Zettlr), ZIP, JSON, BibTeX, images, pasted text, or drag and drop.
- All rendered HTML passes through DOMPurify.

## Install as an app

Open **https://thescholium.github.io/musubi/** in Chrome, Edge, Brave or Arc and choose **Install Musubi** (the install icon at the right of the address bar, or in Chrome *Cast, save and share → Install page as app*). Musubi then has its own Dock or taskbar icon and its own windows (<kbd>⌘/Ctrl N</kbd> opens another). It works offline and updates itself.

Musubi draws its own top bar in place of the title bar (window controls overlay); if a grey title bar shows, click the small ⌃ button at its right end.

Then link your vault folder in Settings → Data. Every note is a Markdown file in that folder, as in Obsidian. When the browser asks, choose **Allow on every visit**. Right-click the Dock icon for *New note*, *Quick capture* and *Review*.

The same file also runs without installing: open `dist/musubi.html` directly, or host `dist/site/` on any static web server.

## Quick start

1. Open `dist/musubi.html` in a current browser. The tests run in Chromium; the code uses only standard features of current Firefox and Safari. Folder sync needs a Chromium browser (Chrome, Edge, Brave, Arc).
2. Take the tour, or skip it.
3. Write the first note.

## Note format

```markdown
---
id: 20260101001200
title: Heine–Borel theorem
type: theorem
status: permanent
tags: [math/analysis]
created: 2026-01-01T00:12:00
modified: 2026-01-01T00:12:00
---

Uses [[Compact space]].

:::theorem[Heine–Borel]
A subset $K \subseteq \R^n$ is compact if and only if it is closed and bounded.
:::
```

Unknown front-matter keys are kept as they are. Notes without front matter take their title from the first heading or the file name and get an ID on import.

## Build from source

```sh
npm install          # CodeMirror, KaTeX, marked, DOMPurify, esbuild
node build.mjs       # bundles CodeMirror, inlines fonts and libraries, writes dist/musubi.html and the web app in dist/site/
```

| File | Contents |
|---|---|
| `src/core.js` | Utilities, front matter, masking of code and math, link and tag analysis, vault index, IndexedDB store, ZIP, BibTeX, line diff |
| `src/render.js` | Markdown + KaTeX pipeline for read view, embeds and cards; equation numbering, environments, arguments, citations, flashcards |
| `src/livepreview.js` | CodeMirror 6 live preview: analysis, decorations that reveal source at the cursor, widgets, completion, editor facade |
| `src/graph.js` | Canvas force-directed graph (Barnes–Hut), shaped markers |
| `src/ui.js` | Shell, note page, sidebar, type key, mentions, context panel, search |
| `src/features.js` | Palette, dialogs, graph view, review, history, settings, import/export, folder sync, boot |
| `src/latexsuite.js` | LaTeX Suite engine: snippet parser, tabstops, auto-fraction, tabout, matrix shortcuts |
| `src/latexsuite-defaults.js` | LaTeX Suite default snippets and variables (MIT, artisticat1) |
| `src/pwa.js`, `src/pwa/` | Installed-app support: manifest, offline service worker, icons (a Hopf link), Dock shortcuts, update prompt, folder-permission banner |
| `tools/icons.py` | Renders the PNG icons from the SVGs |
| `src/tour.js` | Onboarding tour with full cleanup, add-link dialog, migration from version 1 |
| `src/style.css` | The Istari theme for the whole interface, with a Paper theme for print |
| `vendor/` | CodeMirror bundle entry and the Istari fonts (OFL) |

## Tests

```sh
python3 test/test_app.py      # renderer, live preview reveal rules, palette, completion, rename, add link, type key, modes, review, import/export, persistence, display math and tables inside boxes, block answers, line breaks in flashcards (79 checks)
python3 test/test_more.py     # tour cleanup and resume, replay, version-1 migration, branch, extract, mentions, hover, blocked storage, data carried over from the old name, tour reopening after a tour change (30 checks)
python3 test/test_folder.py   # folder sync, using the Origin Private File System as the folder (7 checks)
python3 test/test_latexsuite.py  # LaTeX Suite snippets, tabstops, auto-fraction, tabout, matrices, user snippet files, speed (48 checks)
python3 test/test_pwa.py       # installed app: manifest, installability, offline start, Dock shortcuts, update prompt, folder banner (15 checks)
python3 test/test_attach.py    # attachments: location setting, paste and drop, Markdown paths, PDF and audio cards, lazy files, changed images, ZIP paths (24 checks)
python3 test/test_sandbox.py  # runs inside a sandboxed srcdoc iframe, as an embedded artifact does (6 checks)
```

## Privacy

Musubi makes no network requests. Notes never leave your device unless you export them or link a folder that a sync service watches.

## Licence

MIT. See `LICENSE`. Third-party notices are in `THIRD_PARTY_LICENSES.txt`: CodeMirror and Lezer (MIT), KaTeX and mhchem (MIT), marked (MIT), DOMPurify (Apache-2.0 or MPL-2.0), the Istari fonts (SIL OFL 1.1), and the LaTeX Suite default snippets (MIT).
