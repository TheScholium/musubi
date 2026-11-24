---
id: 20260101001000
title: Open cover
type: definition
status: permanent
tags: [math/topology]
created: 2026-01-01T00:10:00
modified: 2026-01-01T00:10:00
---

:::definition[Open cover]
Let $X$ be a topological space and $A \subseteq X$. A family $\mathcal{U} = \{U_i\}_{i \in I}$ of open subsets of $X$ is an **open cover** of $A$ if $A \subseteq \bigcup_{i \in I} U_i$. A **subcover** is a subfamily $\{U_i\}_{i \in J}$, $J \subseteq I$, that still covers $A$. It is **finite** if $J$ is finite.
:::

## Examples

- The intervals $(-n, n)$, $n \in \N$, cover $\R$. No finite subfamily covers $\R$.
- The intervals $(1/n, 1)$, $n \ge 2$, cover $(0,1)$. No finite subfamily covers $(0,1)$.

These two examples are the standard non-examples for [[Compact space|compactness]].
