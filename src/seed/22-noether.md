---
id: 20260101002200
title: Noether's theorem
type: theorem
status: permanent
tags: [physics/mechanics, physics/symmetry]
aliases: [Noether theorem]
created: 2026-01-01T00:22:00
modified: 2026-01-01T00:22:00
---

depends-on::[[Euler–Lagrange equations]]

:::theorem[Noether, mechanics form]
Suppose the Lagrangian is invariant to first order under $q \mapsto q + \eps K(q)$, that is $\delta L = 0$. Then along every solution of the [[Euler–Lagrange equations]]
$$
Q = \pd{L}{\dot q}\, K(q)
$$
is constant in time.
:::

:::proof
Using the Euler–Lagrange equation $\dv{}{t}\pd{L}{\dot q} = \pd{L}{q}$,
$$
\dv{Q}{t} = \left(\dv{}{t}\pd{L}{\dot q}\right) K + \pd{L}{\dot q}\,\dot K = \pd{L}{q} K + \pd{L}{\dot q}\,\dot K = \frac{\delta L}{\eps} = 0 .
$$
:::

## Standard cases

| Symmetry | Conserved quantity |
|---|---|
| Translation in space | Linear momentum |
| Rotation | Angular momentum |
| Translation in time | Energy, see [[Energy conservation from time-translation symmetry]] |

## Why it matters

It turns the question "what is conserved?" into "what are the symmetries?", which is often easier to answer. This is the main reason the [[Principle of stationary action]] is the preferred starting point of modern physics.
