---
id: 20260101002300
title: Energy conservation from time-translation symmetry
type: derivation
status: permanent
tags: [physics/mechanics, physics/symmetry]
created: 2026-01-01T00:23:00
modified: 2026-01-01T00:23:00
---

example-of::[[Noether's theorem]]

## Setup

Let $L = L(q, \dot q, t)$ and define the energy function $E = \dot q\,\pd{L}{\dot q} - L$.

## Derivation

By the chain rule,
$$
\dv{L}{t} = \pd{L}{q}\dot q + \pd{L}{\dot q}\ddot q + \pd{L}{t} .
$$
Replace $\pd{L}{q}$ with $\dv{}{t}\pd{L}{\dot q}$ (Euler–Lagrange). The first two terms are then $\dv{}{t}\left(\dot q\,\pd{L}{\dot q}\right)$, so
$$
\dv{E}{t} = -\pd{L}{t} . \label{eq:energy}
$$

## Result

If $L$ does not depend explicitly on time, \eqref{eq:energy} gives $\dv{E}{t} = 0$: energy is conserved. For $L = T - V$ with $T$ quadratic in $\dot q$, $E = T + V$.
