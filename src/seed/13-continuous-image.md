---
id: 20260101001300
title: Continuous image of a compact set is compact
type: theorem
status: permanent
tags: [math/topology]
created: 2026-01-01T00:13:00
modified: 2026-01-01T00:13:00
---

depends-on::[[Compact space]]

:::theorem[Continuous image of a compact set]
If $f\colon X \to Y$ is continuous and $K \subseteq X$ is compact, then $f(K)$ is compact.
:::

:::proof
Let $\{V_i\}$ be an open cover of $f(K)$. By continuity each $f^{-1}(V_i)$ is open, and these sets cover $K$. Choose a finite subcover $f^{-1}(V_{i_1}), \dots, f^{-1}(V_{i_m})$. Then $V_{i_1}, \dots, V_{i_m}$ cover $f(K)$.
:::

The proof is one line once you see that preimages carry the cover back to $K$. It is the main step of the [[Extreme value theorem]].
