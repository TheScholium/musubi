---
id: 20260101000100
title: Musubi syntax reference
type: structure
status: permanent
tags: [musubi, reference]
aliases: [Syntax, Cheat sheet]
created: 2026-01-01T00:01:00
modified: 2026-01-01T00:01:00
---

Put the cursor inside any construct to see its source. <kbd>Ctrl Shift E</kbd> shows the whole note as plain Markdown, and <kbd>Ctrl E</kbd> switches to reading.

## Links

- A plain link: [[Compact space]]. With a label: [[Compact space|compactness]].
- A link to a heading: [[Euler–Lagrange equations#Example: Newton's second law]].
- A typed link states *how* two ideas relate: depends-on::[[Open cover]], supports::[[Zettelkasten method]].
- A link to a note that does not exist yet: [[Banach fixed-point theorem]]. Click it to create the note.
- Type `[[` in the editor to search titles as you write.

An embed shows another note (or one section of it) in place:

![[Compact space]]

## Mathematics

Inline math: $e^{i\pi} + 1 = 0$. Display math, numbered because it has a label:

$$
\int_{\partial M} \omega = \int_M \dd\omega \label{eq:stokes}
$$

Environments such as `align` number each row. Use `\nonumber` to skip one:

\begin{align}
\nabla \cdot \mathbf{E} &= \frac{\rho}{\varepsilon_0} \label{eq:gauss} \\
\nabla \times \mathbf{B} - \mu_0\varepsilon_0 \pd{\mathbf{E}}{t} &= \mu_0 \mathbf{J} \label{eq:ampere}
\end{align}

References work anywhere in the note: the divergence theorem, a special case of \eqref{eq:stokes}, turns Gauss's law \eqref{eq:gauss} into its integral form. Macros such as `\pd`, `\abs`, `\inner` and `\C` come from Settings → Mathematics.

Chemistry uses mhchem: $\ce{2H2 + O2 -> 2H2O}$.

Code stays literal, so `$x$` here is not math.

## Statements

:::theorem[Cantor]
For every set $X$ there is no surjection $X \to \mathcal{P}(X)$.
:::

:::proof
Given $f\colon X \to \mathcal{P}(X)$, let $D = \{x \in X : x \notin f(x)\}$. If $D = f(d)$, then $d \in D \iff d \notin D$. So $D$ is not in the image of $f$.
:::

:::remark
Named `theorem`, `definition`, `lemma`, `proposition`, `corollary`, `axiom`, `postulate`, `law` and `principle` blocks become flashcards. Write `nocard` after the brackets to stop that.
:::

## Arguments

:::argument[Modus tollens example]
P1. If the theory is true, the needle moves.
P2. The needle does not move.
C. The theory is false. [from P1, P2]
:::

:::objection[Duhem–Quine]
The test also assumes auxiliary hypotheses, so P1 is too simple.
:::

:::quote[Wittgenstein, *Tractatus* 7]
Whereof one cannot speak, thereof one must be silent.
:::

## Sources, tags, footnotes

A citation resolves to a literature note: [@gettier1963, p. 123]. Tags: #musubi #physics/mechanics. Footnotes are numbered automatically.[^why]

[^why]: Footnotes collect at the end of the note.

## Flashcards

The {{c1::Heine–Borel theorem}} says that a subset of $\R^n$ is compact if and only if it is {{c2::closed and bounded}}.

Q: What does Noether's theorem give for a symmetry under time translation?
A: Conservation of energy.

For a longer answer, put it in braces after `A:`. The braces can hold lists, display math and more than one paragraph.

Q: What are the properties of the scalar product?
A:{For all vectors $A, B, C$ and each scalar $c$:

* $A \cdot B = B \cdot A$
* $A \cdot (B + C) = A \cdot B + A \cdot C$
* $(cA) \cdot B = c(A \cdot B) = A \cdot (cB)$
}

## Other Markdown

> [!warning] Callouts
> Write `> [!note]`, `> [!tip]` or `> [!warning]` on the first line of a quotation.

- [x] Task lists work
- [ ] Click a box to tick it

| Field | Typical note types |
|---|---|
| Mathematics | definition, theorem, proof, example |
| Physics | law, derivation, example |
| Philosophy | position, argument, objection, question |

```python
# code blocks keep $dollars$ and [[brackets]] as they are
print("hello")
```
