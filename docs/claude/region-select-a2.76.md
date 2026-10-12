# Box select respects visibility — a2.76

Shipped `9690717`, live as a2.76.

## What changed

Box and lasso now skip components facing away from the camera, unless
**See-through** is on. This closes the item a2.72 wrote into its own
*Deliberately not done*: "you cannot select what you cannot see" was true of
tap only.

Grow, shrink, loop, ring and symmetry expansion are **still unfiltered, on
purpose**. They answer "what is connected to this", not "what is on screen".
Filtering them would make grow stop at the silhouette, which is a bug, not a
feature. Probe 16 asserts grow still reaches round the model (5 from 1) with
the filter on.

## The facing test, not occlusion

`performRegionSelect` filters through `vertexVisible` / `edgeVisible` /
`groupFacesCamera` and does not raycast. A box can enclose thousands of
components and `pointOccluded` is one raycast each; the facing test is O(1)
per component off a cached normal.

**The limitation this buys, stated rather than hidden:** `vertexVisible`
passes a vertex if ANY face touching it faces the camera. On a capped shape
every rim vertex also touches the cap, and the cap faces you, so a full-screen
box over a cylinder takes the **back rim too** — and reports nothing skipped,
because nothing was. Probe section 18 pins it: 18 of 24 vertices on a
44-triangle cylinder, exactly what the facing test says and more than you can
see. The comment in the code names the cylinder case explicitly; the toast
counts only what the filter actually dropped (`· N hidden`).

## The facing memo

The face path called `groupFacesCamera(obj, gi)` per face, and that walks the
group's triangles — O(faces × triangles) over a dense mesh.

```js
let _facingMemo = null;
function beginFacingMemo(obj) { _facingMemo = { obj: obj, map: new Map() }; }
function endFacingMemo() { _facingMemo = null; }
```

`groupFacesCamera` reads the memo when it is live and for the same object;
`groupFacesCameraUncached` is the old body. `endFacingMemo()` runs in a
**`finally`** — a memo left live across a mesh edit would answer with stale
facing forever, so it must be released even if the select throws. The face
path also now tests its corners **before** computing the centroid, a
pre-existing cost that was paid on every face whether or not it was in the box.

## Verification

- `_verify.py` PASS (21,896 JS lines).
- Full regression `_a275f` vs `_a276`: **24 files identical**; only `_imp_out`
  (known CDN flake, recovered), `_perf_out` (known flake) and `_pick_out` (the
  new sections) differ.
- New probe sections 14–18 in `_pick_probe.js`:
  - 14 — 7 of 8 cube vertices from a full-screen box (7 face the camera)
  - 15 — a box over a cube selects the three faces you can see, not all six
  - 16 — See-through takes all 6; grow still reaches round the model
  - 17 — a flat sheet facing the camera keeps every vertex (441 of 441): the
    filter costs nothing it should not
  - 18 — the cylinder limit, pinned

## Lesson recorded

Section 18 took five attempts because I kept guessing at the primitive API
instead of reading it: `addPrimitive` does not exist; my fallback grabbed the
flat sheet and produced a **vacuous** "441 of 441"; `createPrimitiveObject`
was called with three arguments when the signature is
`(kind, params, name, position)`; the guard read `userData.topo` before
`ensureHelpers` had built it. Reading `PRIM_SPECS` (line 4491) and
`createPrimitiveObject` (line 4613) settled it in one go.

**A test that quietly changes its subject stops being a test.** The vacuous
run reported a green line. The fix was to log what was actually built
(`18.built=Cyl18, 44 triangles`) before asserting anything about it — the same
lesson as a2.75's "identical of 0 edges".
