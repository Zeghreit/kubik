# Booleans — shipped at v2.13

Live: https://zeghreit.github.io/kubik/ · commit `6d4e908`
Full record in `CURRENT_STATE.md` ("Booleans (v2.13)"). This is the short
version, plus the things worth carrying into Curves.

## What shipped

Union / Difference / Intersect on whole objects. MESH door, seat 6, one in
from Join. One seat; the op bar asks which, the way Mirror asks Joined /
Apart / Flip. **Keep originals** is an independent toggle, remembered across
runs. A is the first object you tapped, and the toast names both sides.

Engine: `three-bvh-csg@0.0.18` + `three-mesh-bvh@0.9.7`, in the importmap,
lazy-loaded on the first boolean of a session. ~100 KB gzipped, two requests,
nothing fetched for anyone who never runs one. `useCDTClipping = true`.

## The three things that were not obvious

1. **A CSG result is unwelded.** Every triangle owns its three vertices, so a
   quad's diagonal is two different index pairs and reads as a boundary edge.
   Found by a union of two DISJOINT cubes coming back with 8 shells.
2. **T-junctions have to be healed, not tolerated.** `booleanSurvey` refuses
   an open object, so an unhealed result cannot be fed to a second boolean.
3. **The library is only half the job.** `mergeCoplanarTriangles` — the
   importer's, unchanged — is what turns the soup back into editable faces,
   and it already refuses regions with holes. That existing function is the
   reason this took one session rather than three.

## What the review caught that testing had not

Two adversarial reviewers, opus and fable (first fable run here). Nine
defects, three found by both, no false alarms from either. **Both of the two
worst were "watertight and wrong"** — a result that passes every topology
check and is the wrong solid:

- cloned brush materials stopped coplanar faces merging across the A/B seam
  (the evaluator collapses materials by reference identity)
- a mirrored input removed nothing at all (negative determinant on the brush
  reverses every triangle normal, so the cutter reads as its own complement)

Neither was visible to the probe as it stood. `_boolchk` now asserts SHAPE,
not just closure, for both.

**On fable specifically, since it was unproven here:** worth using again for
this kind of work. It found the three sharpest numerical defects — a
self-referencing split candidate, slivers filtered on the wrong side of the
healing pass, and a parametric tolerance that should have been absolute — and
it read the library's own source to reach two of them. Opus found the two
most valuable ones and every lifecycle defect. They overlapped on three and
contradicted each other once (fable said the library handled mirrored brushes;
opus said it did not — opus was right, and the probe settled it). Run both,
not one.

## Carried into Curves

- The op-bar chooser pattern (chips + one independent toggle, wired by hand
  around `OP_SPECS`) now has a second user and is worth treating as a pattern.
- `booleanSurvey`'s shape — refuse before the bar opens, name the object and
  the count, name the op that fixes it — is the model for any Curve op that
  needs a precondition.
- `_boolchk`'s shape — assert the SHAPE and not only the topology, and verify
  the probe against a deliberately broken copy — is the bar for the Curves
  probe. A probe that only checks "it did not crash" would have passed both
  of the worst defects here.
