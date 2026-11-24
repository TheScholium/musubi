---
id: 20260101001400
title: Extreme value theorem
type: theorem
status: permanent
tags: [math/analysis]
created: 2026-01-01T00:14:00
modified: 2026-01-01T00:14:00
---

depends-on::[[Continuous image of a compact set is compact]]
depends-on::[[Heine–Borel theorem]]

:::theorem[Extreme value theorem]
A continuous function $f\colon K \to \R$ on a nonempty compact space $K$ attains a maximum and a minimum.
:::

:::proof
$f(K)$ is compact in $\R$, so it is closed and bounded by [[Heine–Borel theorem|Heine–Borel]]. A nonempty bounded set has a supremum $s$, and a closed set contains its supremum. So $s = f(x_0)$ for some $x_0 \in K$. The minimum is the same argument for $-f$.
:::

:::example
$f(x) = x$ on $(0,1)$ has no maximum: the domain is not compact.
:::

On a {{c1::compact}} domain, a {{c2::continuous}} real function attains its extreme values.
