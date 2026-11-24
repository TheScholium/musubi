---
id: 20260101001200
title: Heine–Borel theorem
type: theorem
status: permanent
tags: [math/analysis, math/topology]
created: 2026-01-01T00:12:00
modified: 2026-01-01T00:12:00
---

depends-on::[[Compact space]]

:::theorem[Heine–Borel]
A subset $K \subseteq \R^n$ is compact if and only if it is closed and bounded.
:::

:::proof
($\Rightarrow$) The open balls $B(0,m)$, $m \in \N$, cover $K$. A finite subcover gives $K \subseteq B(0,M)$, so $K$ is bounded. For closedness, take $x \notin K$. The open sets $U_m = \{y : \abs{y-x} > 1/m\}$ cover $K$, so finitely many do, and then $K \subseteq U_M$. Thus $B(x, 1/M)$ misses $K$, and the complement of $K$ is open.

($\Leftarrow$) A bounded $K$ lies in a cube $C = [-R,R]^n$. Suppose an open cover of $C$ has no finite subcover. Bisect $C$ into $2^n$ cubes; one of them has no finite subcover. Repeat to get nested closed cubes $C \supseteq C_1 \supseteq C_2 \supseteq \cdots$ with diameters tending to $0$ and no finite subcovers. By completeness of $\R^n$ they meet in a point $p$. Some member $U$ of the cover contains $p$ and, being open, contains $C_k$ for large $k$: a contradiction. So $C$ is compact. Finally, a closed subset of a compact space is compact: add the open set $\R^n \setminus K$ to any cover of $K$.
:::

## Why it is true (in one sentence)

Bisection plus completeness turns "no finite subcover" into a single point where the cover cannot fail.

## Warning

The theorem is about $\R^n$. In an infinite-dimensional normed space the closed unit ball is closed and bounded but **not** compact.
