---
id: 20260101001100
title: Compact space
type: definition
status: permanent
tags: [math/topology, math/analysis]
aliases: [compactness, compact set]
created: 2026-01-01T00:11:00
modified: 2026-01-01T00:11:00
---

depends-on::[[Open cover]]

:::definition[Compact space]
A topological space $X$ is **compact** if every open cover of $X$ has a finite subcover. A subset $K \subseteq X$ is compact if it is compact in the subspace topology; equivalently, every cover of $K$ by open sets of $X$ has a finite subcover.
:::

## Intuition

Compactness is the topological form of "finite". Local facts that hold near each point join into one global fact, because finitely many neighbourhoods are enough. In $\R^n$ the [[Heine–Borel theorem]] makes it concrete: compact means closed and bounded.

## Examples and non-examples

- $[0,1]$ is compact; $(0,1)$ and $\R$ are not (see [[Open cover]]).
- Every finite space is compact.
- A closed subset of a compact space is compact.

## Consequences

- [[Continuous image of a compact set is compact]]
- [[Extreme value theorem]]
