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
| Plots | A code block that starts with ` ```python plot ` draws a figure. numpy, math and matplotlib.pyplot run offline, in a sandbox. |
| Reading | A PDF reader beside the note: select a passage and *Quote into note* adds it with `[@citekey, p. 12]`. |
| Talks | **Slides** from any note, in the Advanced Slides (reveal.js) syntax: `---` between slides, `note:` for speaker notes, `<style>` for the deck. A speaker view, an overview, a live preview beside the note, export to one HTML file, and print to PDF. |
| Retention | Spaced repetition. Named definitions and theorems become flashcards with no extra work; so do `{{c1::cloze}}` and `Q:`/`A:` pairs. A long answer goes in braces, `A:{ … }`, and can hold lists, display math and paragraphs. |

## Features

**Writing**
- Live preview, source mode (plain Markdown) and read mode. `Ctrl/⌘ E` switches between writing and reading; `Ctrl/⌘ Shift E` toggles source mode.
- Click a rendered link to open it; `Alt`-click to edit it instead. Click a formula to edit its TeX.
- Completion for `[[links]]` (a title with no note yet completes to `[[Title]]`; the note is made when you click the link), `#tags`, `[@citations]`, `:::environments`, LaTeX commands and your own macros.
- `Ctrl/⌘ B`, `I`, `M` (inline math), `Shift M` (display math), `Shift L` (link), `Shift D` (cloze), `Shift H` (highlight). Lists continue on Enter; `P1.` premises continue too.
- **LaTeX Suite snippets**, compatible with the Obsidian plugin: `mk` and `dm` open math, `x/` makes a fraction, `sr`, `@a`, `x1`, `RR`, `sum`, `pmat` and about 200 more expand as you type. Tab moves through fields and out of brackets; matrix shortcuts, auto-enlarged brackets, visual snippets on a selection, and undo that keeps what you typed. Paste your own LaTeX Suite snippet file in Settings, Mathematics.
- **Attachments:** paste or drop any file. Images, PDFs, audio and video show in the note (`![[file]]`); other files become links (`[[file]]`). Settings → Data chooses where new attachments go: a fixed folder, a folder next to each note, the note's own folder, or the vault folder. Musubi finds attachments anywhere in the folder by name or relative path, so Markdown links such as `![fig|300](figures/fig.png)` and `[paper](../library/paper.pdf)` work. PDFs and other large files stay in the folder and are read only when opened; images changed in another app load again.
- Footnotes, tables (rendered when the cursor is outside), task lists, callouts (`> [!tip]`), highlights (`==…==`), code blocks.
- Statement blocks and callouts carry a small line glyph before their label, as in the Istari Obsidian theme: a page for theorems, an open book for definitions, a column for axioms and laws, a ticked square for proofs, a lamp for intuitions, scales for arguments, and one for each callout type.
- A template for each of the 14 note types, editable in Settings.
- **A list of note types** (Settings → Note types): add a type by name, then choose its marker shape (circle, ring, square, diamond, triangle, star, moon, sun) and an Istari pigment. **Retire** a type to stop offering it for new notes while old notes keep it; **delete** a type to remove it, and Musubi asks which type its notes move to. Each row shows how many notes use the type. **Reset to defaults** at the bottom brings back the 14 built-in types. Types appear in the type menu, the note list, the type key, the graph and `type:` search.
- **Handwriting from Supernote:** notes from the [Archive](https://github.com/TheScholium/archive) plugin load as they are; images marked `|ink` are drawn in parchment on the dark theme and in black when printed.

**Slides**
- Any note is a slide deck, written in the syntax of the Obsidian plugin **Advanced Slides**, so decks made there run as they are: `---` alone on a line starts a slide, `--` a slide below it (press ↓), and a line that starts with `note:` begins the speaker notes.
- A `<style>` block styles the whole deck with reveal.js selectors (`.reveal h2 { … }`, `.reveal .card { … }`); `:root` means the deck. Each deck draws in its own shadow root, so its CSS never reaches the rest of Musubi. Remote `@import` lines are left out, because Musubi makes no network requests; EB Garamond, Cormorant Garamond and JetBrains Mono are already in the file.
- Raw HTML works with Markdown, mathematics and embeds inside it: columns of `<div>` cards, inline SVG, `![[image.gif|300]]`, `$…$` in headings and tables. A `<div>` left open stays inside its slide.
- `<!-- slide bg="[[photo.jpg]]" class="…" data-transition="fade" -->` sets a slide; `<!-- element class="fragment" -->` sets the element before it; `+` list items appear one at a time; all the reveal.js fragment styles (fade-up, grow, highlight-red, …). Layouts: `<split even gap="3">` and `<grid drag="40 60" drop="right">`. Another note embedded alone on a line becomes part of the slide.
- Front matter sets a deck: `theme` (Istari, Istari Paper, and the reveal.js themes black, white, league, beige, sky, night, serif, simple, solarized, moon, blood, dracula, or a `.css` file in the vault), `transition`, `transitionSpeed`, `width`, `height`, `slideNumber`, `controls`, `progress`, `center`, `loop`, `autoSlide`, `bg`, `timeForPresentation`, `autoFit`. Settings → Slides has the defaults.
- **Present** (the easel at the top of a note, `Ctrl/⌘ Alt P`) starts at the slide under the cursor, in full screen. Slides are drawn at a fixed size (960 × 700 by default) and scaled to the screen. → ↓ Space next, ← ↑ previous, **O** overview, **S** speaker view, **F** full screen, **B** black screen, a number and Enter to jump, **?** the keys, **Esc** to end.
- **Speaker view** in its own window, for a second screen: the current slide, the next step, the notes (A− A+), a timer with pause and reset, the time left when `timeForPresentation` is set, and the clock. If the browser blocks the window, the speaker view opens inside the presentation.
- **Auto-fit:** a slide whose content runs past the bottom shrinks just enough to fit (Settings → Slides, or `autoFit: false` in a note, for the Advanced Slides behaviour).
- **Slide preview** beside the note (right-click the easel, or `Ctrl/⌘ Alt Shift P`): a tab that updates while you type and follows the cursor from slide to slide.
- **Export** a deck as one HTML file that runs anywhere with its images, fonts, notes, speaker view and overview inside; **present in a new window** for a projector; **print** one page per slide, or save as PDF.

**Plots from Python**
- A code block that starts with ` ```python plot ` (or ` ```plot `) draws a figure in the Istari pigments, in light and dark. Labels with `$…$` are KaTeX.
- Musubi runs a part of Python offline, with no download: `def`, `for`, `if`, `while`, `lambda`, list comprehensions, f-strings and slicing; a part of numpy (`np`) and `math`; and matplotlib.pyplot (`plt`) and Axes: `plot`, `scatter`, `bar`, `barh`, `hist`, `fill_between`, `errorbar`, `step`, `stem`, `quiver`, `axhline`, `axvline`, spans, `text`, `annotate`, `legend`, `grid`, `subplots`, log scales. `np`, `plt` and `math` are there without an import.
- The code can reach no file, no network and no page element. A step limit stops endless loops. Long lines are thinned to what the screen can show.
- In live preview the figure takes the place of the code; while the cursor is in the code, the figure updates below it. Read view can show the code.

**PDF reader**
- `![[paper.pdf]]` cards have *Read*; `[[paper.pdf#page=12]]` opens the reader at page 12; `Alt P` opens any PDF in the vault, or one from the computer.
- The PDF opens in a tab beside the note: continuous pages, zoom and fit width, contents from the PDF outline, find, links inside the PDF, dark pages, and the last place is remembered.
- Select text: *Quote into note* puts the passage in the open note with `[@citekey, p. N]` (in a literature note with a citekey) or `[[paper.pdf#page=N|p. N]]`; *Highlight* keeps a highlight; a side list shows them and can quote them all.
- pdf.js (Apache-2.0) is in the file and loads only when the first PDF opens.

**Linking and navigation**
- Links by title, alias or ID; `[[Title|label]]`, `[[Title#Heading]]`; embeds `![[Note]]` and `![[Note#Heading]]`.
- **Block references** in the Obsidian syntax: end a paragraph or list item with `^id`, or put `^id` on the line after a box, an equation or a table. Link with `[[Note#^id]]` (the link shows the block's first words), embed with `![[Note#^id]]`. Type `[[Note#^` to search the blocks of a note; a block without an ID gets one. *Copy a link to the block at the cursor* is in the note menu. Maintain lists broken block links.
- **Tabs and split view.** Each pane has tabs; `Ctrl/⌘`-click opens a link in a new tab, `Ctrl/⌘ Shift`-click in the other pane. `Alt \` splits the view: one editor moves to the pane you click, and the other pane shows its note as a page. Drag tabs to reorder them or to move them between panes. Tabs and the split survive a reload.
- **Back and forward** with two small long arrows ($\longleftarrow$, $\longrightarrow$) at the bottom right; the title of the note you go to appears when you point at an arrow. Also `Ctrl/⌘ Alt ←/→` and the mouse's side buttons.
- **Shortcuts as in other note apps:** `Ctrl/⌘ N` makes a note and selects its title; `Ctrl/⌘ T` and `Ctrl/⌘ W` open and close tabs, `Ctrl/⌘ Shift T` opens the last closed tab again, `Ctrl Tab` or `Ctrl/⌘ Shift ]` goes to the next tab, `Ctrl/⌘ 1`–`9` to a tab, `Ctrl/⌘ O` opens a note by name, `Ctrl/⌘`-click opens a link in a new tab (also on the raw text of a link), and `Alt Enter` follows the link at the cursor. In a browser tab Chrome keeps `Ctrl/⌘ N`, `T` and `W` for itself; the installed app gets them, and the `Alt` versions work everywhere.
- **Editable hotkeys** (Settings → Hotkeys and syntax), as in Obsidian: about 45 commands, each with one or more keys. Filter by name or key, click **+** and press a key to add it, **×** to remove one, **↺** to reset one command. Musubi marks a key that two commands share, and **Reset all hotkeys** puts back the defaults.
- **Folder tree** (Settings → General, off at first): a Folders tab. A note's folder is part of its file path, so with a linked folder these are the folders on disk. New folder, rename, delete (notes move up one level), drag notes onto folders, *Move to a folder…*.
- Right-click a note in the list to open it in a tab or the other pane, move it, present it, or move it to the trash.
- **Add a link** from the note menu or the `+ link` button: choose a note, and optionally a relation.
- Renaming a note rewrites every link to it.
- Under each note, in the Istari "mentions" style: its links, the notes that link to it (with the sentence around each link), and unlinked mentions with a one-click *link*.
- Hover previews, a command palette and fuzzy quick switcher (`Ctrl/⌘ K`; `>` for commands), full-text search with `tag:`, `type:`, `status:`, `"phrases"` and `-exclusions`.
- Global and local graph. Markers are shaped by field and coloured by type.
- **Tag manager** (Tags tab → *manage*, or right-click a tag): rename, merge, move under another tag, and remove, in every note at once. Front matter tags, inline `#tags` (not in code or mathematics) and nested tags change together; tags that differ only in capital letters are flagged. Every change has *Undo*.

**The interface**
Indentation is drawn wider than two spaces, with a faint guide line at each level, as in a code editor; wrapped lines stay under their indent. The file keeps two spaces for each level, because four spaces before a paragraph make a code block in Markdown. Settings → General → *Indentation* sets the width and turns the guides off.

Settings → General → *Theme* shows the current theme. Click it, or *Explore themes*, to open the gallery of all themes in its own window; each card is drawn in its own theme, and a click tries it at once.

| Theme | Named for | Ground and pigment | Heading sigil |
|---|---|---|---|
| **Istari** | the order of wizards | warm ink, parchment text, one gold pigment | four-point star |
| **Istari Paper** | (light) | dark ink on parchment, a deeper gold | four-point star |
| **Mithrandir** | Gandalf, the Grey Pilgrim, who kept Narya, the Ring of Fire | storm-grey stone, ash-silver text, an ember pigment, a faint glow from below | flame |
| **Ithryn Luin** | the Blue Wizards, who went into the East | lapis night, moonlit silver text, a star-blue pigment, star-gold for examples | eight-point star |
| **Aiwendil** | Radagast, friend of birds, in the forest at Rhosgobel | moss-dark ground, lichen text, a fern-gold pigment, russet for warnings | leaf |

**Pixel-art themes.** Twenty-eight themes add pixel art to the Istari type. Body text stays in EB Garamond and Cormorant, and nothing is drawn behind it. Each theme has a pixel-art banner across the top of every note, behind the title; the note title, top headings, `[[links]]` and `**bold**` are set in coloured pixel type (Silkscreen, SIL OFL 1.1) with a hard pixel shadow; a colour sigil stands before each second-level heading and as the section break; a pixel colour band runs under the title; the landscape also runs along the foot of the graph and fills the theme's picker card.

| Group | Theme | Banner | Sigil |
|---|---|---|---|
| Time | **Kairos** (*kairos*, the right moment) | a protostar over the gold rim of a dark world | gold star |
| | **Aion** (*aion*, the age of the cosmos) | nebula gas, a dust lane, a young cluster | orbit |
| | **Chronos** (*chronos*, counted time; Saturn) | Saturn over the ice plains of a moon | ringed planet |
| Landscapes | **Silva** | pines, mist, fireflies, a crescent moon | pine |
| | **Mons** | alpine ranges at dawn, snow caps, alpenglow | peak |
| | **Torrens** | a forested gorge, rapids round boulders, a red kayak | wave |
| | **Aurora** | the northern lights over snow and pines | aurora |
| | **Mars** | rust dunes, craters, Phobos and Deimos | Mars |
| Places | **Bibliotheca** | candlelit shelves of gilt-tooled spines | books |
| | **Shire** | round doors in green hills, chimney smoke, a great tree | round door |
| After NASA images | **Earthrise** (Apollo 8, 1968) | the half-lit Earth above the grey lunar horizon | Earth |
| | **Pale Blue Dot** (Voyager 1, 1990) | bands of scattered sunlight and one pale blue pixel | the dot |
| | **Deep Field** (JWST, 2022) | a galaxy cluster, lensed arcs, stars with eight-point spikes | spiked star |
| | **Pluto** (New Horizons, 2015) | backlit mountains under layers of blue haze | haze |
| | **Jupiter** (Juno) | the limb of the planet, its belts and the Great Red Spot | Jupiter |
| Subjects | **Solarpunk** | garden towers at dusk, a low sun, turbines on the far hills, lanterns | sun and panel |
| | **Urbs** | a city across a river at night, a tower with a red light, reflections | tower |
| | **Flora** | a night meadow of flower silhouettes, a dandelion clock against the moon, fireflies | flower |
| | **Cortex** | one large neuron, its dendrites, an axon carrying a spike, faint neurons beyond | neuron |
| | **Medicina** | a DNA double helix in soft light, cells drifting beyond | helix |
| Minds and masterpieces | **Leonardo** | Florence at dusk, the dome and the bell tower, a flying machine | dome |
| | **Newton** | an apple tree under a full moon, a falling apple, the manor with a lit window | apple |
| | **Einstein** | an Einstein ring: a galaxy lensing the light behind it, over curved spacetime | ring |
| | **Starry Night** (van Gogh, 1889) | the painting: the cypress, the swirls, the stars and the moon | star |
| | **The Scream** (Munch, 1893) | the painting: the figure, the railing, the fjord | bands |
| | **Great Wave** (Hokusai, c. 1831) | the print: the wave, its claws of foam, the boats, Fuji | wave |
| | **Water Lilies** (Monet, 1906) | the painting: lily pads, willow, the reflected sky | lily |
| | **Klimt** (*The Tree of Life*, 1905-11) | the frieze: the spiralling branches and the embrace | gold square |

The five painting themes show the real works, which are in the public domain: each is cropped to a wide band, reduced to 240 x 46 pixels and 24 colours by `tools/paintings.py`, and shown at 5x across the full width of the banner, with a scrim under the title so it stays readable. The sources and their provenance are in `tools/paintings/SOURCES.md`. The three scientists appear through their work, not as portraits.

The landscapes are drawn at 384 x 48 pixels by `tools/pixelart.py` and tile without a seam; `tools/pixel-themes.py` writes the colour blocks into `src/style.css`.

**Symbol colours follow the theme.** Every theme maps the 13 Istari pigments that note types use (gold, ochre, vermilion, oxblood, rose, plum, slate, sky, verdigris, moss, parchment, bone, ash) to its own colours, by role: gold is the theme's main pigment, slate its blue, verdigris its green, and so on. Pigments that would come out too close are pushed apart, so the 13 stay distinct. Your own note types, and the colour picker for them, use these mapped colours. `tools/pigments.py` writes the mapping; run it after you change a theme's colours.

The Istari themes share the same type, rules and layout; the note-type pigments, plots, graph, statistics and handwriting from Supernote follow the theme. *Follow the system* uses Istari Paper by day and the dark theme you chose by night. Printing always uses the Paper colours.

*Bold anchors* make the first letters of each word bold, as a lead-in for the eye, in live preview and read view (light, medium or strong); code, mathematics and links do not change, and neither do the words in the file. Some readers with ADHD say it helps them keep their place. A 2024 controlled study (Acta Psychologica 247, 104304) found no difference in reading speed, so treat it as a comfort setting, not a speed aid.

The sidebar tabs (notes, tags, inbox, maintain) are icons; the open tab shows its name. `Ctrl/⌘ ,` opens Settings. The welcome screen has a foldout essay, *Zettelkasten and the Musubi philosophy*: a history of slip boxes, commonplace books, brush notes, glosses and knotted cords from China, Korea, Japan, the Islamic world, West Africa, South Asia, the Andes and Europe; the case for the method in mathematics and physics; and why each part of Musubi works as it does, with 82 sources, and a section on the modern revival: Reddit, YouTube and forum testimony from mathematicians and physicists, and the method's return to China, Korea, Japan and India. The command palette opens it too.

**The type key**
A compass floats at the foot of the note list. Rest the pointer on it for a moment and the key opens: circles for general notes, diamonds for mathematics, squares for physics, triangles for philosophy, one Istari pigment per type. Click a type to filter the list.

**Zettelkasten workflow**
- Stable timestamp IDs. Quick capture (`Alt C`) to an inbox of fleeting notes; the inbox has its own capture box (`Ctrl/⌘ Enter` saves, the first line is the title).
- *Branch* (`Alt B`): a new note that continues the current one, linked both ways.
- *Extract*: move a selection into a new note and leave a link.
- *Maintain* tab: orphans, unresolved links, stale fleeting notes.

**First start**
A thirteen-step tour, skippable at any step, uses two practice notes to show live preview, links, statements, mentions, the type key, capture, search, graph, review and data. When it ends (or is skipped), Musubi deletes every note, history entry, review schedule, trash entry and image made during the tour, and shows an empty setup screen: write the first note, link a folder, or import. The tour resumes after a reload. When a new version changes the tour, it opens once more for every user, and existing notes stay as they are. It can also be replayed from Settings without touching existing notes. Example notes are available on request in Settings, Data.

**Review statistics**
- Due now, today, streak, retention over the last 30 days, where the cards are (new, learning, young, mature), reviews per day (30 days, 3 months, a year), the answers you gave, a 30-day forecast, how far apart reviews are, a six-month calendar, and the notes whose cards you forget most.
- Every chart has hover values and a table view. Open it from the review screen, by right-clicking the review button, or from the command palette.
- The log is part of the review data, so JSON backups and ZIP exports carry it.

**Data and safety**
- Storage in IndexedDB; in-memory mode with a warning if the browser blocks storage.
- Two-way folder sync in Chromium browsers: one `.md` file per note, named after its title; Musubi writes a note's file 0.65 s after you stop typing; outside edits load when Musubi starts, when its window gets focus again, or with Settings → Data → Sync now.
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
npm install          # CodeMirror, KaTeX, marked, DOMPurify, pdf.js, esbuild
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
| `src/panes.js` | Tabs, split view, the navigation arrows |
| `src/folders.js` | The optional folder tree |
| `src/blocks.js` | Block references: blocks, IDs, completion, jump to a block |
| `src/tags.js` | The tag manager |
| `src/plot.js` | The Python subset, numpy, math and pyplot, and the SVG renderer for plots |
| `src/stats.js` | Review log and statistics |
| `src/pdfreader.js` | The PDF reader (pdf.js) |
| `src/slides.js` | Slides: the Advanced Slides syntax, the presenter (also used in exported decks), themes, speaker view, overview, preview tab, export and print |
| `src/anchors.js` | Bold anchors and the theme list |
| `src/tour.js` | Onboarding tour with full cleanup, add-link dialog, migration from version 1 |
| `src/style.css` | The Istari design system for the whole interface: Istari, Istari Paper (also used for print), Mithrandir, Ithryn Luin, Aiwendil, and twenty-eight pixel-art themes |
| `vendor/` | CodeMirror bundle entry and the Istari fonts (OFL) |

## Tests

```sh
python3 test/test_app.py      # renderer, live preview reveal rules, palette, completion, rename, add link, type key, modes, review, import/export, persistence, display math and tables inside boxes, block answers, line breaks in flashcards (79 checks)
python3 test/test_more.py     # tour cleanup and resume, replay, version-1 migration, branch, extract, mentions, hover, blocked storage, data carried over from the old name, tour reopening after a tour change (30 checks)
python3 test/test_folder.py   # folder sync, using the Origin Private File System as the folder (7 checks)
python3 test/test_latexsuite.py  # LaTeX Suite snippets, tabstops, auto-fraction, tabout, matrices, user snippet files, speed (48 checks)
python3 test/test_pwa.py       # installed app: manifest, installability, offline start, Dock shortcuts, update prompt, folder banner (15 checks)
python3 test/test_attach.py    # attachments: location setting, paste and drop, Markdown paths, PDF and audio cards, lazy files, changed images, ZIP paths (24 checks)
python3 test/test_v26.py       # icon tabs, custom note types, Ctrl/⌘ comma, the knot mark, the philosophy essay and its footnotes (36 checks)
python3 test/test_archive.py   # a note from the Archive Supernote plugin in folder mode: fields kept, file not rewritten, stable ID, ink image recoloured (7 checks)
python3 test/test_sandbox.py  # runs inside a sandboxed srcdoc iframe, as an embedded artifact does (6 checks)
python3 test/test_slides.py   # slides: splitting, notes, deck CSS kept to the deck, fragments, vertical slides, split and grid, auto-fit, overview, jump, speaker view, preview tab, export, print; tags not read from CSS; block glyphs; link completion without new notes; delete from the note list (51 checks)
python3 test/test_v27.py      # arrows, tabs and split view, folder tree, block references, tag manager, plots, statistics, PDF reader, light theme and bold anchors, indent guides, hotkeys, inbox, note types list, the 2.8 themes and theme picker, the pixel-art themes (125 checks)
```

## Privacy

Musubi makes no network requests. Notes never leave your device unless you export them or link a folder that a sync service watches.

## Licence

MIT. See `LICENSE`. Third-party notices are in `THIRD_PARTY_LICENSES.txt`: CodeMirror and Lezer (MIT), KaTeX and mhchem (MIT), marked (MIT), DOMPurify (Apache-2.0 or MPL-2.0), pdf.js (Apache-2.0), the Istari fonts (SIL OFL 1.1), the LaTeX Suite default snippets (MIT), and the reveal.js layout and theme values that the slides follow (MIT).
