# Clean up — a2.81

Shipped `574e50c`, live as a2.81. Seat 10 ring 0 in the Object ring, inboard
of Subdivide — the two ops that change how much mesh there is without
changing what shape it is.

## The finding that changed the scope

`op-gap-analysis.md` had listed **triangulate** since a2.34, on the general
modelling rule that n-gons are not acceptable in exported geometry. Reading
the export path first — rather than building to the note — showed the rule
does not apply here.

**Kubik's n-gon is a FACE GROUP**, a way of talking about a run of triangles,
and it exists nowhere outside the editor. `buildExportGroup` clones the
`BufferGeometry` as it stands, which is indexed triangles, and all three
exporters (`GLTFExporter`, `OBJExporter`, `STLExporter`) are three's own.
**No `.glb`, `.obj` or `.stl` this app has ever written contained an n-gon.**

A note is not a measurement — and this one was three versions old, repeated in
the ranked list every time, and would have produced an op that did nothing.

## Tris to quads

A **regrouping**: not one vertex moves, not one triangle is made or destroyed.
Two single-triangle faces sharing an edge become one two-triangle face, and
the shared edge becomes that face's own diagonal.

**Why it matters:** `edgeLoopOp`'s ring walk steps only through four-sided
faces, so an imported all-triangle mesh **cannot be loop cut at all**. Probe
section 4 is the whole case for the op — the same mesh refuses a loop cut
before and takes one (cutting 3 faces) after.

The import path already pairs triangles this way (`emitPairs` inside
`mergeCoplanarTriangles`) but at a fixed 1.15°, which is exactly why a
**curved** import arrives unusable. The tolerance is now on the slider.

### The bug that made the first version pointless

`separateGroupVertices` gives every face group private copies of its corners —
that is what lets neighbouring faces be hard-edged — so two faces meeting at
an edge share **positions but not attribute indices**. Dropping their
triangles into one group unchanged leaves six corners at four places, and
`getGroupBoundaryLoopAttr` walks attribute indices, so it reported a six-sided
outline. The paired mesh still could not be loop cut. The op reported success
and achieved nothing it existed for.

## Merge by distance

Spatial hash (cells the merge distance wide, so 27 neighbours is a complete
search) plus union-find, each cluster moved onto its centroid, and the
**ordinary weld** finishes the job — deliberately the same mechanism the rest
of the app welds with rather than a second one that could disagree. Merge and
Weld already existed but both want Vertex mode, a hand-made selection and a
fixed epsilon.

## The review found seven defects

1. **Merge silently corrupted `creases` and `edgeShade`.** Both are
   position-keyed, and this op moves vertices *and* collapses edges — the
   exact pair Collapse's own note warns about: a mark on a collapsed edge
   becomes a key whose two halves are the same point, which aliases onto
   whatever later lands there. `remapMarksByPoint` now drops those.
2. **Tris to quads never verified its result was a 4-ring.** Two coincident
   triangles share all three edges, score a perfect 1.0, and sort to the
   *front* of the greedy — producing a face with no outline at all. A folded
   pair wound inconsistently produced a three-entry loop over four corners.
   It now proves the quad **with the same function that will later consume
   it**, which is both the cheapest check and the most honest one.
3. **The manifold test counted only single-triangle faces**, so a triangle
   meeting a quad looked like a clean pair and it bonded across T-junctions —
   while a comment claimed it was checking exactly that.
4. **Pairing a smooth face with a flat one** let group *order* decide which
   shading survived. Refused now.
5. Dropped triangle and face counts were computed and never reported.
6. **The value readout was hardcoded to three decimals**, so Merge's 0.0002
   step showed its first two stops as "0" — including anything typed in, since
   the blur handler writes the same rounded value back. Decimals now come from
   the active option's step.
7. Two contrived degenerate cases, documented.

## Verification

- `_verify.py` PASS (23,479 JS lines).
- Regression `_a280f` → `_a281f`: **28 of 28 existing suites identical**; only
  `_clean_out.txt` new and `_theme`'s ring count 13 → 14, both intended.
- New `_clean_probe` (suite 31), 21 sections. Sections 16–21 each cover one
  review finding; 16 and 17 build the two malformed-quad fixtures by hand.

## Lessons

**Read the pipeline before building to the note.** Triangulate would have been
a whole op that did nothing, and the note asserting it was three versions old
and had survived several rewrites of the doc.

**Assert the property the op exists to create.** Tris to quads is *for*
producing four-sided faces, so checking that it did — with the same function
that consumes them — was one call and caught both malformed-quad cases at
once. The first version asserted the pair count instead, which is the number
that is easy to get and says nothing.

**Two things can be "the same vertex" and it matters which you mean.** Same
position, same logical vertex, same attribute index are three different
statements, and the op needed the third where it had the second.

**Check the fixture warps.** Section 5's "curved" grid used
`y = bend·(x² + z²)` — but any height of the form `f(x) + g(z)` leaves every
axis-aligned quad *planar*, because the corner heights satisfy
`yA + yC = yB + yD`. The angle threshold had nothing to bite on and measured
9 pairs at both 2° and 45°. A product term (`bend·x·z`) actually warps one.
Same class as a2.80's two fixture failures and a2.77's.
