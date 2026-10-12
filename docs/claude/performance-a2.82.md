# a2.82 — shading's union-find: a stamp instead of a clear

Shipped `3ecace7`, live. Performance round three, following a2.77's parting
note that `6_unionFind` was the biggest remaining phase of `applyShading`.

## The change

At every logical vertex `applyShading` has to work out which of the attribute
vertices sitting there belong to the same smooth island, then average their
normals. It did that with a union-find built out of `Map`s — a `parent` Map
and an accumulator Map, allocated, filled and discarded **once per logical
vertex**, tens of thousands of times a shade. The work per vertex is a
handful of pointers; the allocation and hashing around it are not.

It now uses:

- `ufScratch(n)` — one module-level scratch of typed arrays (`Int32Array`
  parent/stamp, `Float64Array` accumulators) that grow and never shrink.
- a **stamp**, bumped once per logical vertex. A slot belongs to the current
  vertex only if its stamp matches; anything left by the previous vertex
  reads as absent. Nothing is ever cleared.
- a `touched` list, so the write-back visits only the slots this vertex
  actually used.
- a counter reset past 2^31 (arrays re-filled with −1) so a long session
  cannot wrap into a collision.

## Measured

`_race_probe.py` injects the OLD Map-based loop into a copy of index.html
alongside the new one, so both run in the same page, in the same run, against
the same geometry.

| triangles | old | new | |
|---|---|---|---|
| 48 | 0.03 ms | 0.03 ms | — |
| 192 | 0.15 ms | 0.06 ms | 58% |
| 768 | 0.56 ms | 0.25 ms | 56% |
| 3,072 | 1.89 ms | 0.84 ms | 56% |
| 12,288 | 11.75 ms | 7.30 ms | 38% |

Over 77 shades: **180.3 ms → 103.0 ms, 43% off the union-find**, with **all
1,325,952 normal components bit-for-bit identical**. As a share of the whole
of `applyShading`, `6_unionFind` falls from 30% warm / 23% of the operation
to **13% / 9%**.

## The correctness defect the review found (D1)

The first version wrote the stamp counter back *after* the per-vertex loop.
`applyShading` is wrapped in a try/catch that falls back to flat normals — a
real path, not a hypothetical — so a throw part way through a shade left the
counter where the last **successful** shade had put it, and the next shade
re-issued stamps already written into the arrays. The damage is silent:
normals averaged across islands that are not connected, and not unit length,
with no error anywhere.

Fix: `stamp = ++UF.stamp0;` as the first line of the loop body, write-back
deleted. Every vertex's stamp is permanently spent whether or not its shade
finishes.

Probe section 4 pins it. A lever injected into the harness's own copy of
index.html — never into the shipped file — makes a shade throw on its 20th
vertex; the shade after it is bit-for-bit what it was before the failure and
every normal is still a unit vector.

## Two smaller review findings

- **D2** — `buildShadingTopo` still kept a `sharp` Map beside the edge
  records a2.77 introduced. It had been **write-only since a2.77**. Map
  deleted; `sharp` is a field of the record.
- **D3** — `rec.sharp` was assigned after construction, forcing a hidden-class
  transition on every edge. Now declared in the record literal.

## The measurement that lied first

The first race reported **−500% at 48 triangles** — the new loop five times
slower. It was cold JIT: the race ran each version once, while the project's
own `timeIt` takes a median for exactly this reason. Four warm-up shades
before timing and the small-mesh row went neutral, which is the honest
answer — at 48 triangles there is nothing to win.

**A benchmark with no warm-up measures the compiler, not the code.** The
scratch buffer was added while chasing this phantom and is kept because it is
right on its own merits.

## Probe hygiene note

The first attempt at section 4 reached for `geo.userData.shadeTopo` from the
probe. That cache is `null` outside a direct drag, so the section logged "NO
CACHED TOPO — section 4 tested nothing" while two assertions below it passed
**vacuously**. The lever approach replaced it. Also `_race_probe.py`'s ANCHOR
went stale when D1's fix changed the line it anchored on; it aborted with
`ANCHOR MISS (0)` and left a stale `_race_out.txt` behind — read the harness's
own status line, not just its output file.

## Regression

Full sweep `_a282f` against `_a281f`: 30 of 32 suites byte-identical.
`_imp_probe` is the known CDN-fetch flake — settled with `_impcheck.py`
(WIP passed, HEAD failed on the same code, which is the flake, not the
change). `_perf`'s `slider_coalescing` and `_theme`'s `8.palette` were stable
this round.

## What is now the biggest thing

- `2c_windingComponents` — 8–16%, and its share grows with the model. Never
  looked at.
- The degenerate-fan handler / duplicate `computeVertexNormals` — 7–9%, but
  it is a shading-**correctness** change, not just a saving.
