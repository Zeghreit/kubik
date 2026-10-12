# Import — the design, before any code

Decided 2026-08-31, after a2.67. Read `CURRENT_STATE.md` first. This is the
plan for the last 2.0 blocker: reading meshes back in, so a model can travel
desktop → phone and a Kubik export can be reopened in Kubik.

## The job is smaller than `op-gap-analysis.md` assumed

That doc says the work is "converting an arbitrary imported mesh into the
app's editable representation (welding, face-group assignment, n-gon
handling)". Two of those three are already solved by code that exists.

**Every op in the app already goes through one funnel:**

```
toEditable(mesh)  ->  { positions, groups: [ { triangles: [[i,i,i], …] } ] }
     …change the arrays…
rebuildFromEditable(obj, editable)
```

`rebuildFromEditable` calls `separateGroupVertices`, rebuilds the geometry and
its groups, recomputes the bounding volumes, then `reconcileFinishes` and
`applyShading`. Extrude, inset, bevel, bridge, knife, separate and join all
ride it. **So an importer's whole output contract is that one plain object:
`{ positions, groups }`. Everything else is derived.**

**Welding is free.** `computeLogicalOf` recovers logical vertices by rounding
positions to 1e4 and grouping. Buffer vertices are duplicated per face group
by design (`separateGroupVertices`), and the logical layer merges them back.
An imported mesh with split vertices re-welds itself, with no code from us.

**Face groups survive glTF.** Measured: exporting the default cube produced
**6 primitives for 6 geometry groups**, one per material. `buildExportGroup`
writes one node per object, each with one primitive per face group — so a
Kubik glTF already carries its face structure, and node → object,
primitive → face group is the whole mapping for our own files.

## The one thing that decides whether an import is editable

`computeTopology`, on the exposed-edge rule:

> An edge is EXPOSED when it lies on some face's outline, which is to say
> when there is a face whose triangles use it exactly ONCE. Used twice by the
> same face, it is that face's internal triangulation and invisible.

So **grouping is everything.** One triangle per group means every triangle
diagonal is a real, selectable, drawable edge: an imported cube would have 18
edges instead of 12 and a seam across every face. Grouping coplanar
triangles together makes those diagonals internal and invisible.

The merge is not a nicety. It is the feature.

## Decisions taken

1. **Foreign meshes get coplanar merging.** Adjacent triangles that share an
   edge, share a material, and whose normals agree within a tight epsilon
   become one face group. A cube from anywhere arrives as 6 faces.
2. **All three formats**, in this order: **glTF/GLB** first (what we export;
   carries groups and materials), then **OBJ** (text, universal, faces may
   already be quads/n-gons), then **STL** (triangle soup, no groups, no
   materials — leans entirely on the merge to be usable at all).

## The merge, and the thing to get right

Flood-fill over triangle adjacency, per material, gated on coplanarity.

The danger is the epsilon. A finely tessellated sphere has adjacent triangles
that are *nearly* coplanar; a loose threshold merges the whole sphere into
one face and the model becomes uneditable in a different way. Start tight —
normals agreeing to ~0.5–1°, i.e. dot > 0.9999 — and treat any loosening as a
measured decision, not a taste one.

Note the existing precedent for exactly this class of bug, in `SHARP_ANGLE`:

> 33 degrees, not 30 … A regular 12-sided prism meets itself at exactly 30, so
> a threshold there puts every edge of the ring on the knife edge of a
> floating-point comparison.

Pick a threshold that lands on no regular polygon, and say why in the code.

## Increments (each one opens and runs)

1. **glTF in, merged.** Load .gltf/.glb, take triangle primitives only (skip
   the LINES primitive — the exported mesh carries a second entry for the
   edge outline), merge coplanar per material, build `{positions, groups}`,
   make an object. No material mapping yet: everything lands on `standard`.
2. **Materials.** Map glTF PBR (baseColorFactor, metallic, roughness) onto
   the material library. `harvestLegacyMaterials` is the existing precedent
   for turning raw surface numbers into library entries — reuse its shape.
3. **OBJ.** Its faces can be n-gons already, so they become groups directly
   with no merging needed. `usemtl` gives the material split.
4. **STL.** Triangle soup, one material, merge does all the work.
5. **The entry point.** Where import lives in the UI — the drawer's Files
   section is the obvious home, beside the exports.

## Refusals, decided up front

An import that lands a 200k-triangle mesh gives you an app that cannot
subdivide (already superlinear: L5 = 1454ms) and a picker whose 28px radius
holds twenty vertices. Decide a triangle budget, say so in a toast, and
refuse above it rather than appearing to work. Also refuse: skinned and
animated meshes, and scenes with many nodes — take the first mesh or ask.

## A false alarm, recorded so it is not "found" again

While measuring I reported that every exported .glb carries
`extras.kubikEdges` — the wear-edge field the Cavity and Edges masks use —
because `GLTFExporter` serialises `geometry.userData` into `extras`.

**It does not.** `buildExportGroup` already sets `eg.userData = {}` on the
cloned geometry, with a comment recording the same discovery:

> Without this every .glb carried the edge list as a 12000-key object plus
> the whole distance atlas as an array of 600000 numbers, per object.

The finding came from calling `GLTFExporter` on `o.mesh` directly in the
console instead of going through the real export path. **Test the path the
app actually takes, not a shortcut to the same library** — the same mistake
`_mat_probe` made when it held a doc that aliased the live definitions.

## Worth knowing before writing the round trip

If we want our OWN files to come back perfectly — creases, sharp marks,
per-face materials, symmetry — the place to put that is a small, versioned
`extras.kubik` block written deliberately in `buildExportGroup`, after the
`userData = {}` wipe. Marks are keyed by position pair (`creaseKeyFor`),
which survives a round trip through any format that preserves coordinates
exactly.
