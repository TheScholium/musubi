/* Musubi editor helpers: LaTeX snippets and link text used by autocompletion. */

const LATEX_SNIPPETS = [
  ['\\frac', '\\frac{|}{}'], ['\\dfrac', '\\dfrac{|}{}'], ['\\sqrt', '\\sqrt{|}'], ['\\int', '\\int_{|}^{}'], ['\\iint', '\\iint'],
  ['\\oint', '\\oint'], ['\\sum', '\\sum_{|}^{}'], ['\\prod', '\\prod_{|}^{}'], ['\\lim', '\\lim_{| \\to }'], ['\\partial', '\\partial'],
  ['\\nabla', '\\nabla'], ['\\infty', '\\infty'], ['\\mathbb', '\\mathbb{|}'], ['\\mathcal', '\\mathcal{|}'], ['\\mathfrak', '\\mathfrak{|}'],
  ['\\mathrm', '\\mathrm{|}'], ['\\mathbf', '\\mathbf{|}'], ['\\boldsymbol', '\\boldsymbol{|}'], ['\\operatorname', '\\operatorname{|}'],
  ['\\text', '\\text{|}'], ['\\vec', '\\vec{|}'], ['\\hat', '\\hat{|}'], ['\\dot', '\\dot{|}'], ['\\ddot', '\\ddot{|}'], ['\\bar', '\\bar{|}'],
  ['\\overline', '\\overline{|}'], ['\\tilde', '\\tilde{|}'], ['\\widetilde', '\\widetilde{|}'], ['\\left(', '\\left( | \\right)'],
  ['\\left[', '\\left[ | \\right]'], ['\\left\\{', '\\left\\{ | \\right\\}'], ['\\langle', '\\langle | \\rangle'], ['\\begin{align}', '\\begin{align}\n|\n\\end{align}'],
  ['\\begin{pmatrix}', '\\begin{pmatrix} | \\end{pmatrix}'], ['\\begin{bmatrix}', '\\begin{bmatrix} | \\end{bmatrix}'], ['\\begin{cases}', '\\begin{cases} | \\end{cases}'],
  ['\\label', '\\label{eq:|}'], ['\\eqref', '\\eqref{eq:|}'], ['\\tag', '\\tag{|}'], ['\\hbar', '\\hbar'], ['\\otimes', '\\otimes'], ['\\oplus', '\\oplus'],
  ['\\cdot', '\\cdot'], ['\\cdots', '\\cdots'], ['\\ldots', '\\ldots'], ['\\times', '\\times'], ['\\leq', '\\leq'], ['\\geq', '\\geq'], ['\\neq', '\\neq'],
  ['\\approx', '\\approx'], ['\\equiv', '\\equiv'], ['\\sim', '\\sim'], ['\\simeq', '\\simeq'], ['\\cong', '\\cong'], ['\\propto', '\\propto'],
  ['\\to', '\\to'], ['\\mapsto', '\\mapsto'], ['\\rightarrow', '\\rightarrow'], ['\\Rightarrow', '\\Rightarrow'], ['\\implies', '\\implies'],
  ['\\iff', '\\iff'], ['\\forall', '\\forall'], ['\\exists', '\\exists'], ['\\nexists', '\\nexists'], ['\\in', '\\in'], ['\\notin', '\\notin'],
  ['\\subset', '\\subset'], ['\\subseteq', '\\subseteq'], ['\\supseteq', '\\supseteq'], ['\\cup', '\\cup'], ['\\cap', '\\cap'], ['\\bigcup', '\\bigcup_{|}'],
  ['\\bigcap', '\\bigcap_{|}'], ['\\setminus', '\\setminus'], ['\\emptyset', '\\emptyset'], ['\\varnothing', '\\varnothing'], ['\\circ', '\\circ'],
  ['\\neg', '\\neg'], ['\\land', '\\land'], ['\\lor', '\\lor'], ['\\vdash', '\\vdash'], ['\\models', '\\models'], ['\\Box', '\\Box'], ['\\Diamond', '\\Diamond'],
  ['\\therefore', '\\therefore'], ['\\because', '\\because'], ['\\top', '\\top'], ['\\bot', '\\bot'], ['\\wedge', '\\wedge'], ['\\vee', '\\vee'],
  ['\\dagger', '\\dagger'], ['\\ell', '\\ell'], ['\\Re', '\\Re'], ['\\Im', '\\Im'], ['\\aleph', '\\aleph'], ['\\ket', '\\ket{|}'], ['\\bra', '\\bra{|}'],
  ['\\braket', '\\braket{|}'], ['\\ce', '\\ce{|}'], ['\\pu', '\\pu{|}'], ['\\underbrace', '\\underbrace{|}_{}'], ['\\overset', '\\overset{|}{}'],
  ['\\quad', '\\quad'], ['\\qquad', '\\qquad'], ['\\displaystyle', '\\displaystyle'],
  ...['alpha', 'beta', 'gamma', 'Gamma', 'delta', 'Delta', 'epsilon', 'varepsilon', 'zeta', 'eta', 'theta', 'Theta', 'vartheta', 'iota', 'kappa',
    'lambda', 'Lambda', 'mu', 'nu', 'xi', 'Xi', 'pi', 'Pi', 'rho', 'varrho', 'sigma', 'Sigma', 'tau', 'upsilon', 'phi', 'Phi', 'varphi', 'chi',
    'psi', 'Psi', 'omega', 'Omega'].map((g) => ['\\' + g, '\\' + g]),
];

function linkSuggestions(q) {
  const res = quickFind(q, 9).map((n) => ({ label: n.title, detail: TYPE_LABEL[n.type] || n.type, dot: n.type, note: n }));
  const qt = q.trim();
  if (qt && !res.some((r) => normTitle(r.note.title) === normTitle(qt)) && !resolveTarget(qt)) {
    res.push({ label: 'Create “' + qt + '”', detail: 'new note', create: qt });
  }
  return res;
}

function linkText(note, label) {
  const style = app.settings.linkStyle || 'title';
  const idx = vault.index();
  const unique = idx.byTitle.get(normTitle(note.title)) === note.id && !/[\[\]|#]/.test(note.title);
  if (style === 'id' || !unique) return `[[${note.id}|${label || note.title}]]`;
  return label && label !== note.title ? `[[${note.title}|${label}]]` : `[[${note.title}]]`;
}

