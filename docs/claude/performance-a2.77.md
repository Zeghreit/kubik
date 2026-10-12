# The topology build — a2.77

Shipped `b8d3813`, live as a2.77. **20% off every operation in the app.**

## The queue was wrong about which item mattered

The plan named two performance candidates: the double `computeVertexNormals`
(9–11%) and "what the other ~75% of applyShading is". Taking the function
apart by phase settled it — and the answer was neither.

`_prof_probe.py` instruments a **copy** of index.html in memory (the same
trick `_time_probe.py` uses to build its page), so there is no timing patch
to remember to revert and none can ship. Eight marks in `applyShading`, five
more inside `buildShadingTopo`.

Shares of one run, at 3,072 and 12,288 triangles. Shares, not absolutes: the
machine drifts 3× between runs, but every phase inside a run drifts together.

| phase | 3k | 12k |
|---|---|---|
| `2_topo` **(topology build)** | **47–51%** | **58%** |
| ↳ `2e_edgeMaps` | 18–25% | **38%** |
| ↳ `2a_computeLogicalOf` | 14% | 11% |
| ↳ `2c_windingComponents` | 8% | 8% |
| ↳ `2d_trisAt` | 3% | 2% |
| `6_unionFind` | 25% | 23% |
| `1_baseNormals` *(the queue's item)* | 9% | 7% |
| `4_triNormals` | 7% | 5% |
| `5_sharpWear` | 5% | 5% |
| `3_signedVolume` | 5% | 3% |

The item the queue named was **fifth**, and the largest phase grew with the
model while it shrank.

## A correction to a2.74

a2.74's section 7 reported "the same geometry seven times — six cache hits".
Not so. `shadingTopoFor` writes `geo.userData.shadeTopo = live ? topo : null`
— it caches **only while a direct drag is running**, deliberately, because
outside a gesture the next call must rebuild or a vertex welded by an edit
would keep the old grouping. Every call outside a drag rebuilds the topology,
so a2.74's "warm" number was cold.

## The two changes

**`computeLogicalOf` → nested numeric Maps.** It built `x + '_' + y + '_' + z`
per attribute vertex, of every mesh, on every rebuild. Three nested `Map`s on
the rounded numbers are exactly equivalent: `Map` compares by SameValueZero,
so `-0` keys with `0` and `NaN` with `NaN` — both the answers the string form
gave.

Deliberately **not** packed into one number, which would be faster still:
there is no safe packing without a bound on the model's scale, and Kubik has
no unit. A collision here does not cost a little precision — it welds two
vertices that are not the same, which is a hole in the mesh and a wrong
normal.

**`buildShadingTopo` → one Map of records.** Every edge lived in `edgeFaces`,
`edgeUse`, `edgeOpp`, `edgeTri`, `edgeEnds` under the same key, so a second
triangle arriving on an edge already seen cost four more Map lookups to find
the arrays to append to — and most edges are seen at least twice.
`edges: Map<key, {faces, use, opp, tri, ends}>` makes that one lookup.
`incident` is unchanged. Consumers are all inside `applyShading`; the
identically-named `edgeFaces` in subdivide, bridge and loop-select are their
own locals off `computeTopology` and were correctly left alone.

## How the numbers were taken

Each rewrite was written **twice** and both versions timed against each other
on the same geometry in the same run, before either went into the app:

- weld: string 4.90ms vs nested 1.90ms — **61% off**, same 6,146 logical
  vertices, vertex for vertex.
- edges: six Maps 7.30ms vs one Map of records 4.00ms — **45% off**, same
  18,432 logical edges.

Then in the app, on `rebuildFromEditable` with a new geometry each time,
which is what a real op does: **12.07ms → 9.69ms**.

That cross-version comparison is trustworthy because the phases the change
did not touch stayed flat across it — `1_baseNormals` 0.66→0.63,
`3_signedVolume` 0.40→0.36, `4_triNormals` 0.59→0.61, `5_sharpWear`
0.54→0.54, `6_unionFind` 2.54→2.33 — while `2_topo` fell 5.16→3.04. Nearly
all of the saving is in the one thing that changed.

Shares after, at 12k: `2_topo` 58% → **26%**, `2e_edgeMaps` 38% → **10%**,
`2a_computeLogicalOf` 11% → **5%**.

## The benchmark that would have lied

The review caught it: the weld was measured on a **subdivided cube**, which
is the best case for nested maps — a handful of distinct rounded x values, so
a few dozen inner Maps serve tens of thousands of vertices. An imported CAD or
scanned mesh is the opposite: nearly every x distinct, so nesting allocates up
to two Maps **per vertex**. Every import path runs through this function.

So a fixture was built to be exactly that — 40,000 attribute vertices over
20,000 distinct positions, every x its own. String 12.20ms, nested 4.00ms:
**67% off in the bad case, more than in the good one.** A
hash-with-collision-verify variant was written as the fallback and tied nested
exactly (4.00ms), so there was nothing to buy by being cleverer.

**The first attempt at that fixture was itself wrong.** Its LCG multiply
overflowed 2^53, the sequence collapsed, and the "scattered" fixture came back
with 6,222 distinct positions out of 40,000 — the clustered case again, under
a name that claimed otherwise. It was caught only by printing the distinct
count next to the claim.

## Verification

- `_verify.py` PASS (21,946 JS lines).
- Full regression `_a277` → `_a277f`: **27 of 27 suites identical**, the only
  difference being `_perf`'s `slider_coalescing` middle number, which is on
  the known-flake list. A pure performance refactor should change nothing
  observable, and it changed nothing observable.
- Review also fixed: the stale "five Maps" count in
  `settleShadingAfterDrag`, `edgeUse` and "the five edge maps" in
  `CURRENT_STATE.md`, a vestigial `const byX = map` alias, and
  `importWeldKey`'s comment — it must keep the `Math.round(… * 1e4)` in
  lockstep with `computeLogicalOf`, but no longer shares the key form.

## Lessons

**A profile beats a note, again.** Two sessions running, the standing
performance note named the wrong thing. The instrument to take a function
apart now exists and costs one command.

**A benchmark's fixture is part of its claim.** "60% faster" was true of the
mesh it was measured on and said nothing about the mesh every import produces.
The review found that, not the measurement.

**Check a fixture has the property it exists to have.** The scattered fixture
was not scattered. Printing the distinct count beside the claim is what
caught it — the same shape of error as a2.76's vacuous "441 of 441" and
a2.75's "identical of 0 edges".

**Write the rewrite twice and race it before putting it in the app.** Both
changes here were proven — for speed *and* for producing identical output —
before a line of the app moved.
