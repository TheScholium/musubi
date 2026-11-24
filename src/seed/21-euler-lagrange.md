---
id: 20260101002100
title: Euler–Lagrange equations
type: derivation
status: permanent
tags: [physics/mechanics, math/calculus-of-variations]
aliases: [Euler-Lagrange equation, Lagrange's equations]
created: 2026-01-01T00:21:00
modified: 2026-01-01T00:21:00
---

derived-from::[[Principle of stationary action]]

## Setup

Take the action
$$
S[q] = \int_{t_1}^{t_2} L(q, \dot q, t)\, \dd t \label{eq:action}
$$
and a variation $q \mapsto q + \eps\eta$ with $\eta(t_1) = \eta(t_2) = 0$.

## Derivation

To first order in $\eps$,
$$
\delta S = \eps \int_{t_1}^{t_2} \left( \pd{L}{q}\,\eta + \pd{L}{\dot q}\,\dot\eta \right) \dd t . \label{eq:first-variation}
$$
Integrate the second term by parts:
$$
\delta S = \eps \left[ \pd{L}{\dot q}\,\eta \right]_{t_1}^{t_2} + \eps \int_{t_1}^{t_2} \left( \pd{L}{q} - \dv{}{t}\pd{L}{\dot q} \right) \eta \, \dd t .
$$
The boundary term vanishes because $\eta$ vanishes at the end points. The integral must vanish for every such $\eta$, so by the fundamental lemma of the calculus of variations:

\begin{equation}
\dv{}{t}\left(\pd{L}{\dot q}\right) - \pd{L}{q} = 0 . \label{eq:el}
\end{equation}

## Result

Equation \eqref{eq:el} holds for each coordinate $q_i$. It is a second-order ODE, so initial position and velocity fix the motion.

## Example: Newton's second law

With $L = \tfrac12 m \dot q^2 - V(q)$ we get $\pd{L}{\dot q} = m\dot q$ and $\pd{L}{q} = -V'(q)$, and \eqref{eq:el} becomes
$$
m \ddot q = -V'(q) .
$$

## Assumptions and domain of validity

$L$ is twice differentiable and the end points are fixed. Non-conservative forces such as friction need extra terms.

Q: Why does the boundary term in the first variation vanish?
A: The variation $\eta$ is zero at both end points, because the end points of the path are fixed.
