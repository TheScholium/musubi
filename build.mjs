// Build Musubi into one self-contained HTML file: dist/musubi.html
// Usage: node build.mjs
import { readFileSync, writeFileSync, mkdirSync, readdirSync, existsSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(fileURLToPath(import.meta.url));
const r = (p) => readFileSync(join(root, p), 'utf8');
const nm = (p) => join('node_modules', p);

// Bundle CodeMirror 6 (editor and Markdown parser) into one IIFE that exposes the global CM.
try {
  execSync('npx esbuild vendor/cm-entry.js --bundle --minify --format=iife --global-name=CM --outfile=vendor/cm.min.js --legal-comments=none', { cwd: root, stdio: 'ignore' });
} catch (e) {
  if (!existsSync(join(root, 'vendor/cm.min.js'))) throw new Error('esbuild is needed once to bundle CodeMirror: npm install');
}

// KaTeX stylesheet with WOFF2 fonts inlined as data URIs
let katexCss = r(nm('katex/dist/katex.min.css'));
katexCss = katexCss.replace(/src:url\(fonts\/([^)]+?)\.woff2\) format\("woff2"\)(?:,url\([^)]+\) format\("[^"]+"\))*/g, (m, name) => {
  const b64 = readFileSync(join(root, nm(`katex/dist/fonts/${name}.woff2`))).toString('base64');
  return `src:url(data:font/woff2;base64,${b64}) format("woff2")`;
});
if (/url\(fonts\//.test(katexCss)) throw new Error('A KaTeX font was not inlined');

const safeScript = (js) => js.replace(/<\/script/gi, '<\\/script').replace(/<!--/g, '<\\!--').replace(/\/\/# sourceMappingURL=.*$/gm, '');

const vendor = [
  r(nm('katex/dist/katex.min.js')),
  r(nm('katex/dist/contrib/mhchem.min.js')),
  r(nm('marked/lib/marked.umd.js')),
  r(nm('dompurify/dist/purify.min.js')),
  r('vendor/cm.min.js'),
].map(safeScript).join('\n;\n');

const seedDir = join(root, 'src/seed');
const seeds = readdirSync(seedDir).filter((f) => f.endsWith('.md')).sort().map((f) => readFileSync(join(seedDir, f), 'utf8'));
const seedJs = `function starterNotes() { return ${JSON.stringify(seeds)}; }\nconst PHILOSOPHY_MD = ${JSON.stringify(r('src/philosophy.md'))};`;

const icons = r('src/istari-icons.json');
// Macro names known to KaTeX, for the LaTeX Suite rule that adds a space after a finished macro.
const katexSrc = r(nm('katex/dist/katex.js'));
const katexMacros = Array.from(new Set(Array.from(katexSrc.matchAll(/"(\\\\[A-Za-z]+)"/g), (m) => m[1].replace(/^\\\\/, '\\')))).sort();
if (katexMacros.length < 500 || !katexMacros.includes('\\alpha')) throw new Error('Could not read the KaTeX macro names');
const appJs = ['core.js', 'render.js', 'blocks.js', 'editorutil.js', 'livepreview.js', 'anchors.js', 'latexsuite-defaults.js', 'latexsuite.js', 'graph.js', 'plot.js', 'ui.js', 'types.js', 'hotkeys.js', 'panes.js', 'folders.js', 'features.js', 'tags.js', 'stats.js', 'pdfreader.js', 'slides.js', 'tour.js', 'pwa.js'].map((f) => r('src/' + f)).join('\n\n')
  .replace('__ISTARI_ICONS__', icons.trim()).replace('__KATEX_MACROS__', () => JSON.stringify(katexMacros));
// Istari fonts (SIL OFL 1.1), embedded so that the file never loads anything from the network
const LATIN = 'U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+0304,U+0308,U+0329,U+2000-206F,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD';
const LATIN_EXT = 'U+0100-02BA,U+02BD-02C5,U+02C7-02CC,U+02CE-02D7,U+02DD-02FF,U+0304,U+0308,U+0329,U+1D00-1DBF,U+1E00-1E9F,U+1EF2-1EFF,U+2020,U+20A0-20AB,U+20AD-20C0,U+2113,U+2C60-2C7F,U+A720-A7FF';
const font = (file, family, style, weight, range) => `@font-face{font-family:'${family}';font-style:${style};font-weight:${weight};font-display:swap;${range ? 'unicode-range:' + range + ';' : ''}src:url(data:font/woff2;base64,${readFileSync(join(root, 'vendor/fonts/' + file)).toString('base64')}) format('woff2')}`;
const fontCss = [
  font('eb-garamond-normal.woff2', 'EB Garamond', 'normal', '400 800'),
  font('eb-garamond-italic.woff2', 'EB Garamond', 'italic', '400 800'),
  font('cormorant-garamond-normal.woff2', 'Cormorant Garamond', 'normal', '300 700'),
  font('cormorant-garamond-italic.woff2', 'Cormorant Garamond', 'italic', '300 700'),
  font('jetbrains-mono-normal.woff2', 'JetBrains Mono', 'normal', '100 800'),
  // Silkscreen, for the coloured pixel titles, links and bold text of the pixel-art themes
  ...[['', LATIN], ['-ext', LATIN_EXT]].flatMap(([x, range]) => [
    font(`silkscreen-latin${x}-400-normal.woff2`, 'Silkscreen', 'normal', '400', range),
    font(`silkscreen-latin${x}-700-normal.woff2`, 'Silkscreen', 'normal', '700', range),
  ]),
].join('\n');
const app = safeScript(`(function () {\n'use strict';\n${seedJs}\n${appJs.replace(/^'use strict';$/m, '')}\n})();`);

// pdf.js (Apache-2.0) for the PDF reader. It stays as JSON text until a PDF opens.
const stripMap = (js) => js.replace(/\/\/# sourceMappingURL=\S*\s*$/gm, '');
const pdfjsJson = JSON.stringify({ lib: stripMap(r(nm('pdfjs-dist/build/pdf.min.mjs'))), worker: stripMap(r(nm('pdfjs-dist/build/pdf.worker.min.mjs'))) })
  .replace(/<\//g, '<\\/').replace(/<!--/g, '<\\u0021--');

const pkg = JSON.parse(r('package.json'));
const thirdParty = [
  ['KaTeX ' + JSON.parse(r(nm('katex/package.json'))).version + ' (including mhchem)', r(nm('katex/LICENSE'))],
  ['marked ' + JSON.parse(r(nm('marked/package.json'))).version, r(nm('marked/LICENSE'))],
  ['DOMPurify ' + JSON.parse(r(nm('dompurify/package.json'))).version, 'DOMPurify is (c) Cure53 and other contributors. It is released under the Apache License 2.0 and the Mozilla Public License 2.0. Full texts: https://github.com/cure53/DOMPurify/blob/main/LICENSE'],
  ['CodeMirror ' + JSON.parse(r(nm('@codemirror/view/package.json'))).version + ' and Lezer', r(nm('@codemirror/view/LICENSE'))],
  ['Istari fonts: EB Garamond, Cormorant Garamond, JetBrains Mono', r('vendor/fonts/OFL-1.1.txt')],
  ['Silkscreen (pixel-art themes)', r('vendor/fonts/OFL-Silkscreen.txt')],
  ['Obsidian LaTeX Suite default snippets (src/latexsuite-defaults.js)', r('vendor/latex-suite-LICENSE.txt')],
  ['pdf.js ' + JSON.parse(r(nm('pdfjs-dist/package.json'))).version + ' (Mozilla, Apache License 2.0)', r(nm('pdfjs-dist/LICENSE'))],
  ['reveal.js layout, theme values and fragment styles, rewritten in src/slides.js', `MIT License

Copyright (C) 2011-2024 Hakim El Hattab, http://hakim.se, and reveal.js contributors

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.`],
];
const notices = thirdParty.map(([n, t]) => `===== ${n} =====\n${t.trim()}`).join('\n\n');
writeFileSync(join(root, 'THIRD_PARTY_LICENSES.txt'), notices + '\n');
const html = `<!DOCTYPE html>
<!--
  Musubi ${pkg.version}: an offline Zettelkasten for mathematics, physics and philosophy.
  MIT License. Source, build script and tests: see README.md in the source archive.
  This file bundles third-party software. Their notices follow.

${notices.replace(/-->/g, '- ->')}
-->
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="dark">
<meta name="description" content="Musubi: an offline Zettelkasten for mathematics, physics and philosophy.">
<meta name="generator" content="Musubi ${pkg.version}">
<title>Musubi</title>
<link rel="icon" href="data:image/svg+xml,${encodeURIComponent(r('src/pwa/icon.svg').replace(/\s*\n\s*/g, ' '))}">
<style>${fontCss}</style>
<style>${katexCss}</style>
<style>${r('src/style.css')}</style>
<script type="application/json" id="musubi-pdfjs">${pdfjsJson}</script>
</head>
<body>
<noscript><p style="padding:2em;font-family:serif">Musubi needs JavaScript. It runs entirely in this file; nothing is sent anywhere.</p></noscript>
<script>${vendor}</script>
<script>${app}</script>
</body>
</html>
`;
mkdirSync(join(root, 'dist'), { recursive: true });
writeFileSync(join(root, 'dist/musubi.html'), html);
console.log(`dist/musubi.html  ${(html.length / 1024).toFixed(0)} KiB`);

// The installable web app: dist/site/ is what GitHub Pages (or any static host) serves.
import { createHash } from 'node:crypto';
import { copyFileSync } from 'node:fs';
const site = join(root, 'dist/site');
mkdirSync(join(site, 'icons'), { recursive: true });
const pkgVersion = JSON.parse(r('package.json')).version;
const buildHash = createHash('sha256').update(html).digest('hex').slice(0, 10);
writeFileSync(join(site, 'index.html'), html);
writeFileSync(join(site, 'sw.js'), r('src/pwa/sw.js').replace('__VERSION__', pkgVersion + '-' + buildHash));
copyFileSync(join(root, 'src/pwa/manifest.webmanifest'), join(site, 'manifest.webmanifest'));
for (const f of ['icon-192.png', 'icon-512.png', 'maskable-512.png', 'apple-touch-icon.png', 'icon-32.png', 'icon.svg']) copyFileSync(join(root, 'src/pwa', f), join(site, 'icons', f));
writeFileSync(join(site, '.nojekyll'), '');
writeFileSync(join(site, '404.html'), '<!doctype html><meta charset="utf-8"><meta http-equiv="refresh" content="0; url=./"><title>Musubi</title>');
console.log(`dist/site/        version ${pkgVersion}-${buildHash}`);
