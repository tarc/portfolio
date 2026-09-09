---
title: "Adjunctions"
description: "Example of an adjunction."
pubDate: 2026-09-08
---

Suppose a real world problem $P$ is solved by some theory $T$ by Vassili. Vassili is well known for his work on $T$ and this particular problem $P$ is such that you can see it as a pratical isomorphism of $T$, once you known $T$ well enough.

Is it possible to find another theory $U$ that is also a solution to $P$? Such $U$ should be different enough from $T$ as to mask its connection with Vassili, which we are trying to preserve.

We don't care about any generality here at all. It suffices to show some specific examples of $T$, $P$, and $U$.

## Definition

Formally, an adjunction between functors $F \dashv G$ gives a natural bijection

$$
\mathrm{Hom}_D(F(X), Y) \;\cong\; \mathrm{Hom}_C(X, G(Y))
$$

for all $X$ in $C$ and $Y$ in $D$. Masking Vassili's fingerprints on $T$ amounts to finding a $U$ related to $T$ by such an adjunction, rather than an outright isomorphism.
