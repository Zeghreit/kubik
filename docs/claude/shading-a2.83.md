# a2.83 — the baseline shade, and what was still reading it

Shipped `5280fee`, live. The last item on the a2.74 performance table, and the
one that had survived three rewrites of the queue with a stale number attached
to it.

## The premise, and why it was wrong twice

`applyShading` opened with `geo.computeVertexNormals()`, commented "safe
baseline: if anything below throws, the mesh is still shaded". The per-vertex
union-find then overwrote it.

The queue called this "the double normals item", ranked it fifth, and put it
at 7–9%. Both numbers were from a2.74, before a2.77 and a2.82 shrank the
phases around it. Re-measured, it was **15% of a warm shade and 10% of a whole
operation** — the second-biggest thing left in the function.

## What it was still doing, counted rather than assumed

`_fan_probe.py` instruments a copy of index.html and counts, per attribute
vertex, every way out of the write loop. Battery: every primitive, a
subdivided cube, an open plane, two deliberately-folded fixtures, and the mesh
after extrude, inset, bevel, subdivide, solidify, array, cleanup, crease and
slide.

| | |
|---|---|
| index-referenced attribute vertices | 32,277 |
| written by the union-find | 32,265 |
| left to the baseline | **12** |
| of those, the `degenerate fan` branch | 12 |
| `g < 0` / `notEnrolled` / `noAcc` | **0** |
| calls arriving with no normal attribute | **104 of 147** |
| worst baseline-vs-answer gap where overwritten | **0.359 → 21°** |

All 12 were on the fixture built to cause them. And on all 12 the baseline
gave **(0,0,0)** — a fan whose island cancels usually cancels for the baseline
too, so the fallback rendered them **black**. It did not work in the only case
it existed for.

The review then upgraded "never fired" to **cannot fire**: `g` came from a
triangle at this vertex, so `enrol` ran on it in the same iteration; that
triangle is in `tris`, so its root was accumulated. The measured zero is what
the code guarantees.

So the baseline's real remaining job was **allocating the attribute** —
`rebuildFromEditable` hands over a brand new `BufferGeometry`.

## The change

- The shading pass goes. The allocation stays, and now also refuses an
  attribute that is interleaved or not a packed `Float32Array` — the write
  loop pokes `.array` directly with `normals[ai * 3] = x`, which a glTF
  importer's interleaved or Int16-normalised normals would send into the wrong
  slots. Not a regression (the old loop clobbered them the same way), but this
  `if` is the only place it can be refused.
- The unindexed exit and the `catch` each ask for their own cheap shade. The
  exit asks **before** the allocation: three.js creates-and-fills in one pass
  when there is no attribute, and falls back to a JS loop re-zeroing an
  existing one when there is — allocating first would have made both paths
  slower than a2.82.
- **The degenerate fan gets a real answer.** Fallback is the vertex's own face
  group normal: the flat-shaded answer, area-weighted, already computed, and
  inside the same shading model instead of borrowed from a different one.
  Where that cancels too — the face group folded back on itself, where no
  normal is right — any triangle of the group at this vertex is a unit vector
  along one of the two sheets.
- `createPrimitiveObject` shaded **three** times: `createCubeObject`,
  then `setPrimitiveGeometry` → `rebuildFromEditable`, then a bare
  `applyShading` on geometry that had just been shaded and had not changed.
  The third is gone.

## The invariant the fallback leans on

**A face group is exactly one face.** True of everything the app builds, but
`buildShadingTopo` synthesises a *single* group spanning the whole mesh when
`geo.groups` is empty — and a closed shell's every-triangle sum is zero by the
divergence theorem. Such a geometry would fall past `groupNormal` to the
triangle scan, whose answer is then scan order rather than geometry. Nothing
reaches `applyShading` that way today. It is written down at the line that
would have to change.

`groupOfAttr[ai]` is likewise last-triangle-wins, and is only unambiguous
because `separateGroupVertices` gives every face group its own attribute
vertices. Pre-a2.83 an ambiguous `g` only chose which island root to read;
now it also chooses which flat normal to stamp. Same blast radius as the
above, and recorded with it.

## Proof, as an answer rather than a timing

`_norm_probe.py` builds the same 20 models under the committed file and under
the working copy — two pages, one JS — and diffs a digest of every normal.

**18 of 20 identical.** The two that differ are the folded-fin fixtures, where
**three zero-length normals became three unit normals**. That is the whole
behavioural change, and it is the bug being fixed.

Timing is measured in ONE run: `_prof_probe.py <js> <out> baseline`
re-injects the deleted call, so `1_baseNormals`'s share is read off the same
page as everything else. 15% of a shade, 10% of an operation. Without it: 0%.

## Regression

`_a283f` against `_a282f`: 31 of 32 suites byte-identical. `_imp_probe`
flaked on both runs (CDN); `_impcheck.py` settled it — WIP passed, HEAD
flaked on the same code.

## Method notes worth keeping

- **Count the branch before deleting the code that feeds it.** The whole
  decision came from one instrumented run: 12 of 32,277, all on one branch,
  all on a synthetic fixture, and the fallback broken anyway. Reasoning about
  it would have got the "is it safe" part right and missed the black vertices.
- **A stale estimate outranks no estimate in the wrong direction.** 7–9%
  kept this at position five in the queue for three versions. It was 15%.
- **The reviewer's best finding was the ordering nobody would have noticed** —
  allocating before an exit that then calls `computeVertexNormals` makes that
  exit take three.js's slow branch. Not a bug; a change that would have made
  two paths worse while the headline said "faster".
