# a2.74 — performance, measured. Both standing notes were wrong.

Commit `0e5a22b`, live. **This increment produced almost no speedup, and
that is the honest result.** What it produced instead is the ability to
measure at all, two corrected notes, and a target for the next one that has
a number attached.

## The tools could not measure time

Every probe suite runs under `--virtual-time-budget`, where Chrome advances
the clock only while the page is idle — so synchronous JavaScript takes
**zero virtual time** and `performance.now()` reads `0.0ms` across any
amount of work.

That is why `_perf_probe` counts operations rather than timing them. It is
also why **two timing assertions written this week passed while measuring
nothing** — a2.72's picking-cost test read 0.0ms for twenty raycasts and was
replaced with a raycast counter, and a2.73's would have done the same.

`_time_probe.py` is the new capability: no virtual time, a real clock, and
the results come back by **POST** rather than by scraping the DOM (without
virtual time, `--dump-dom` fires long before a probe has finished).

Numbers from it are headless-SwiftShader-on-a-desktop, not an iPhone. The
work is CPU-side JavaScript, so the **shape** of a curve and the **relative**
cost of phases carry over; an absolute millisecond does not.

## Note 1: "Subdivide is superlinear (L5 = 1454ms)" — not as stated

```
L1     48 tris   16ms
L2    192 tris   11ms  (x0.7)
L3    768 tris   24ms  (x2.2)
L4   3072 tris   64ms  (x2.7)
L5  12288 tris  220ms  (x3.3)
```

A level multiplies triangles by four, so **4× per level is linear in output
size and is the floor**. Subdivide runs at 2.2–3.3×: *sub*-linear per
triangle. And L5 is 220ms, not 1454ms.

## Note 2: "The op-bar drag rebuilds the face overlay every frame" — mis-stated

**Zero** overlay index rebuilds across twelve slider frames. a2.54 made the
overlay a single mesh borrowing the mesh's own position attribute, and
a2.64a's comment already argued this claim was wrong. Now it is measured.

## Where the time actually is

```
rebuildFromEditable   2.6ms   at 768 triangles
  of which applyShading 2.5ms
```

**`applyShading` is ~95% of `rebuildFromEditable`, and every op in the app
funnels through `rebuildFromEditable`.** It is the floor under everything —
and it is the thing that is actually superlinear:

```
applyShading:  48 tri 0.2ms | 192 0.5 | 768 2.1 | 3072 8.2 | 12288 45
```

5.9× the time for 4× the triangles at the top end.

**One op-bar slider frame on a 3072-triangle model costs ~10ms against a
16.7ms frame budget, and a phone is slower.** Imports made a model that size
one tap away, which is what turns this from theory into the main risk.

## Ruled out, so nobody re-checks

- **The topology cache is not the story.** `shadingTopoFor(geo)` is cached
  per geometry and `rebuildFromEditable` installs a new geometry every op, so
  the cache can never hit during real work — a promising-looking hypothesis.
  Measured: 7.7ms warm vs 9.9ms cold. The topology rebuild is ~2ms of it.
- **The normal arithmetic is not the story.** The same triangle-normal maths
  with zero allocation is 0.4ms against applyShading's 9.7ms.
- **The redundant `computeVertexNormals()` is real but load-bearing.**
  applyShading calls it as a safety baseline and then computes its own
  normals — 9–11% of the call, spent twice. It cannot just move into the
  `catch` that already calls it, because the per-vertex loop deliberately
  falls back to that baseline for a degenerate fan
  (`// degenerate fan: keep the baseline`). Removing it means writing a
  cheaper degenerate handler, which is a change to shading **correctness**,
  not a performance tweak. Worth doing; not worth doing carelessly at the end
  of a long session on the most visually obvious code path in the app.

## The one change, reported honestly

The triangle-normal loop allocated **three** `THREE.Vector3` per triangle
where only one — the normal, kept in `triNormal` — outlives the iteration.
Two are now hoisted scratch vectors. Identical arithmetic, 24,000 fewer
objects per call on a 12k mesh.

**It did not move the number** (9.7ms vs 9.8ms, against run-to-run variance
of ±0.5ms). Kept because it cannot be worse and a phone is more
allocation-sensitive than a desktop V8 — but **that is a reason, not a
measurement**, and it has not been verified on the target.

## The next candidate, with a reason

The **wear-edge pass** at the end of `applyShading` walks every edge and
builds the convex/concave edge list for the Cavity and Edges masks. Its own
comment says the distance field it feeds is baked "lazily and throttled, and
only for an object that is actually wearing a shape mask" — but **the list
itself is built on every shade, for every object, whether anything uses it
or not**, which is the common case.

Guarding it needs care: `ensureEdgeField` bakes from
`geo.userData.kubikEdges`, so an object that gains a mask later must fill the
list lazily rather than find it missing. That is the same shape as
`ensureEdgeField`'s own laziness, so there is a pattern to follow.

Second candidate: the degenerate-fan handler that would let the redundant
`computeVertexNormals()` go.

## Lessons

**A note is not a measurement, and an old note is not even a hypothesis.**
Both items on the performance queue had sat there long enough to be treated
as facts. One was wrong in magnitude (220ms, not 1454ms) and in kind
(sub-linear, not superlinear); the other had already been refuted in a code
comment by a previous session and nobody had propagated it back to the queue.

**Check that your instrument can read the quantity before trusting a
reading of zero.** Three separate timing assertions in this project have now
reported 0.0ms and passed. The failure is silent and looks like success.

**Reporting no speedup is a result.** The alternative — restructuring the
shading path late in a session to have something to show — is how a visually
obvious regression gets shipped. The profile is worth more than a rushed
change, because the next session starts from data instead of from a note.
