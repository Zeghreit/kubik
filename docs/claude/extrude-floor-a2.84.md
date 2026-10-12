# Extrude's floor, and the backwards drag it uncovered (a2.84)

Extrude a Plane, and you got a box with no bottom. The note that started this
called it "extrude dissolves the initial face". It does not. Extrude has
never deleted anything.

## The face TRAVELS - it is not destroyed

`extrudeRegionOp` lifts a new vertex per region vertex, then **remaps the
selected groups' triangles onto them**. The face group keeps its identity,
its material and its index; only the indices inside it change. Walls are
then built from the rim down to the OLD positions.

On a closed shell that is exactly right. The old position had a neighbour on
every side, and the walls meet those neighbours. Nothing is missing because
nothing was ever there.

On an OPEN shell there is no neighbour, and nothing is left at the old
level. That is the hole - not a deleted face, an absent one.

## The test is openness, not flatness

A curved imported sheet has the identical hole, so "is the surface flat" is
the wrong question. What matters is whether the mesh has anything on the
other side of the rim.

Count, across the WHOLE mesh, the face groups that use each edge **on their
outline** - once within the group, which is the same rule `computeTopology`
exposes an edge by. One user in total means open. Cap only when EVERY rim
edge is open.

That last word is deliberate. A face at the CORNER of a sheet has a rim that
is half shared and half open, and a floor there would stop halfway across.
It is left alone.

**Stacking needs no special case.** After the first section the rim is
shared with the walls just built, so the second tap counts two users and
adds nothing. Measured: three sections, one floor.

## And then the signed volume asked a question nobody had

`auditWinding` says `ok` when a shell agrees with ITSELF. An entirely
inside-out box passes it. That was fine while extruding an open sheet left
an open sheet, because an open shell has no volume to have a sign.

Closing the mesh made the question askable, so the probe asked it: a
**backwards** drag came out at **signed volume -0.5**. The lifted face keeps
its winding while moving to the far side of where it started, so the face
that pointed up-and-out now points up-and-IN, and the walls follow it. It
had presumably always done this; there was simply never a closed mesh to
notice it on.

`flipAll` reverses the lifted face, the walls and the floor together when
`offset < 0`. It is only safe **because capping means the region IS the
whole open shell** - there is no rest of the mesh for the flipped faces to
disagree with. An uncapped extrude is left exactly as it was.

The reviewer found this pays a second dividend: `[-0.4, +0.4, +0.4]` - the
sequence a real backwards drag produces, since `measureExtrudeAxis`
re-measures after each stack - was non-manifold on a2.83 and is clean now.

## Each and Joined had to agree

The op bar's chips run different code. `own` and `avg` go through
`extrudeRegionOp`; `each` loops `extrudeFaceGroup`, a separate function. So
the first cut of this shipped a Plane that came out solid or bottomless
depending on which chip was lit, with nothing in the UI to explain it.

`extrudeFaceGroup` now takes `allowFloor`, and the caller passes it only
when **one** face is selected. The scan is O(triangles) and Each runs the
function once per face, so an unguarded version would go quadratic on a big
selection.

Nothing is lost by the limit. **Each over several faces of a sheet already
returns an open, non-manifold shell** - 8 open edges and 9 non-manifold
seams on a 2x2 Plane, on a2.83 too - and a floor cannot rescue that. Joined
is the tool for it, and Joined does it. Section 11 of the probe records the
number rather than asserting it is good.

## Known, and not defects

- **`outlineUses` is recomputed on every frame of a live drag.**
  `applyPendingOp` restores from `op.state` first, so the mesh handed in is
  byte-identical each frame and the answer cannot change. Measured on a
  2048-quad Plane: the scan is ~3ms against ~12ms for `rebuildFromEditable`,
  and one drag frame went 33.6ms -> 38.4ms. It is the same complexity class
  `edLogical` and `separateGroupVertices` already impose - not a new one -
  but it is pure repeated work, and it is paid even by an extrude that then
  refuses. It belongs computed once in `beginPendingOp` and carried on the
  op. **This is the obvious a2.84a.**
- **Extruding a whole open sheet doubles the group and material count** -
  one floor group per original face group. An imported 2000-face sheet comes
  back with about 4000. `solidifyOp` is the better tool for that shape.
- **`needsFloor` is decided on a rim that can be incomplete.**
  `getGroupBoundaryLoopAttr` returns `[]` or a partial loop when a group's
  boundary is not one closed simple loop, so `rim` can be missing exactly
  the shared edges that would have vetoed the floor. The invariant the
  comment claims is not quite the invariant the code tests. An annulus face
  group with a shared inner ring reaches it; the result was still manifold,
  and better than a2.83's. No case was found where the gap produces a wrong
  mesh.
- **The floor gets no `smoothGroups` entry**, so it is flat even when the
  source face was smooth - the same as the walls have always been.
- The floor inherits the source face's material clone (so its finish
  follows) and, being at the original positions, its `creases` and
  `edgeShade` marks, which are position-keyed.

## Probe

`_ext_probe.js` / `_ext_probe.py`, eleven sections. Each prints its own
numbers, and it checks its FIXTURES first - that the Plane really has four
open edges before anything happens, that the cube really is closed, that the
two quads of the strip really welded into a sheet with an interior edge -
because a fixture that does not contain the thing being tested passes
vacuously.

`vol()` is the one that earned its place: signed volume, positive when the
faces point out. `auditWinding.ok` cannot see an inverted shell and would
have passed the backwards drag.

## The lesson this one adds

**Closing a thing makes new questions askable.** The inversion was not
introduced by a2.84 and was not a bug anybody could have reported - an open
sheet has no inside to be out. The moment the mesh became watertight, a
one-line measurement that had been meaningless became the sharpest test in
the file. When a change makes a mesh, a set or a state complete, ask what
predicate was previously undefined on it.
