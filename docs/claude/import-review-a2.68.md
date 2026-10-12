# Import, increment 1 — reviewed, fixed, SHIPPED as a2.68

Live. All five blockers the review found are fixed and covered by
`_imp_probe` (suite 24). 23 of 23 existing suites byte-identical.

## What shipped

A `.glb`/`.gltf` comes in through the drawer's Files section ("Bring in
.glb"), lands as editable objects, and a Kubik export reopens in Kubik with
the faces it left with.

The pipeline is one line, because the app already owns both ends:
`file -> { positions, groups:[{triangles}] } -> rebuildFromEditable`.
Welding is free (`computeLogicalOf` rounds to 1e4). Grouping is the feature,
because `computeTopology` exposes an edge only when some face uses it exactly
once.

## The design blocker, and how it was resolved

**A merged face with a hole breaks Inset and Extrude.**
`getGroupBoundaryLoopAttr` walks ONE boundary loop and has no concept of a
second. Every primitive the app makes is a fan over one convex polygon, so
that limit had never been reachable — coplanar merging made it reachable with
the most ordinary imported geometry there is.

**Resolved by option 1**: a region is merged whole only when its boundary is
one simple loop — one connected component, every boundary vertex with exactly
two boundary edges, which also rejects bowties and non-manifold sheets.
Anything else falls back to pairing coplanar triangles into quads, which
cannot have a hole. A triangle with no clean partner stays its own face.

Verified: a square annulus (a washer) comes out as 9 quad/single faces, not
one face with a hole; a hole-free coplanar pair still merges to one face, so
the fallback is not eating the feature.

**If Inset and Extrude ever learn about multiple boundary loops, the fallback
is the thing to delete.**

## The other four, all fixed

- **Negative determinant** re-wound at import. Verified by signed volume: a
  `scale(-1,1,1)` node comes in at +1.000, and an unmirrored one is untouched.
- **Interleaved attributes** read with `getX/getY/getZ` over `count`.
  Verified with a hand-built interleaved buffer carrying a poison value in
  the spare channels — 36 clean vertices, 6 faces, no leak.
- **`Number.isFinite`** on normals and on every position; a non-finite
  coordinate refuses the mesh rather than NaN-ing an object that has already
  been pushed to history.
- **`IMPORT_FACE_BUDGET` = 4000**, checked after the merge, beside the
  40000-triangle budget. Faces are what cost — each is a group, a material
  and a draw call.

## The lesson, kept

**A round-trip test proves the round trip and nothing else.** Every assertion
passed while the importer could not read an optimised `.glb`, inverted
mirrored models, and produced faces the app's own ops corrupt — because the
suite only ever fed it Kubik's own tightly packed, positively scaled,
single-loop output. It now carries foreign fixtures.

## Deliberately still to do

Recorded in `CURRENT_STATE.md` too, so none of these is discovered as a
surprise:

- Materials are not mapped — everything lands on `standard` (increment 2).
- OBJ (increment 3) and STL (increment 4) are not read yet.
- `InstancedMesh` loses every instance but the first; `SkinnedMesh` imports
  its bind pose. Both silent.
- Draco and meshopt files reject with the generic error — no decoder is set.
- `.gltf` is advertised but external `.bin` and textures resolve against the
  page URL and 404, which matters because the app is meant to open from
  `file://`.
- A large import can exceed the autosave quota; `scheduleAutosave` swallows
  it, so the scene silently reverts on the next visit.
- `setMode('object')` runs after the objects exist, so an open geo setup
  pushes history first and one Undo takes back both.
- `focusOnAll()` reframes existing work rather than the import — which this
  project's own record argues against twice.
