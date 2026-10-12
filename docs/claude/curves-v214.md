# Curves — shipped, v2.14 / v2.15 / v2.16

Live: https://zeghreit.github.io/kubik/ · commits `557b0aa`, `6bc89a7`, `d312e21`
Full record in `CURRENT_STATE.md`. This is the short version plus what the
session actually taught.

## What shipped

- **v2.14 — the Curve entity.** Draw, edit, select, save. Add geo → Curve
  makes one; a curve selection gets its own ring.
- **v2.15 — Lathe.** Curve ring seat 6, three axis chips, full turn, steps
  from the curve's own Segments.
- **v2.16 — Tube.** Seat 7, with a live radius / sides / caps setup bar.

## The decision everything rests on

**A curve is an ordinary `App.objects` entry whose `mesh` is a `Line2`.** A
second array beside `App.objects` was checked against the code and rejected:
about twenty sites touch `o.mesh` unguarded, `flattenEntries` rebuilds
`App.objects` from the outliner's drag order, and `pushHistory`'s `modelSig`
hashes `objects` — so a curve outside it would record no undo step at all.
`Line2` extends `Mesh`, so picking, framing, hide, group, reorder, duplicate
and undo all work with no new branch.

Four layers stop a `Line2` reaching `toEditable` (which returns plausible
nonsense rather than throwing): the ring, `refuseCurves`, early returns in
`ensureHelpers`/`applyShading`, and a named error as the backstop.

## Three things worth carrying forward

**1. "Watertight and wrong" is the failure mode of this whole area.** It has
now appeared four times in one session — twice in Booleans, twice in Curves.
A shell that is inside out is closed, consistently wound, one shell, and
passes everything `auditWinding` can assert, *by design*. Any op that builds a
surface needs an orientation test written on purpose, and **signed volume**
(`sum a·(b×c)/6`, calibrated against a cube) is the cheapest one that works
for anything closed.

**2. A probe that tests the easy shape proves nothing.** Both orientation bugs
survived their probes because both probes used a straight profile parallel to
the axis — the one shape whose first quad gives a clean answer. The fix was
not a better assertion, it was a better *input*: a closed profile started at
every corner in both directions, sixteen of them. The same lesson turned up in
`_tubechk`, where the first control curve did not provoke the naive frame's
failure at all and the control test failed correctly.

**3. Notes in this repo go stale in exactly the way the repo warns about.**
`CURRENT_STATE` said Revolve was guarded by `_spinchk`'s 35 checks. It was
not — v2.12 took that name for Spin Edge, so the sweep was refactored this
session with no live measurements behind it. Two other stale notes turned up
too (a "deliberately free" ring seat that Array had taken two releases
earlier). **Run the probe before believing the note.**

## On the reviewers

Second session running both opus and fable adversarially, and the split was
the same both times: **opus finds the lifecycle and integration defects, fable
finds the numerical ones.** Between them, 17 real defects here and 9 on
Booleans, with no false alarms from either. They disagreed once on Booleans
(fable said the library handled mirrored brushes; opus said it did not; opus
was right) — and the probe settled it, which is the only way that should ever
be settled. Run both.

## What a curve does not have yet

Each is its own increment, and none is a gap left by accident:

- **Draggable Bezier handles.** The file format already reserves `hIn`/`hOut`,
  so adding them changes no saved file. Handles are derived from the
  neighbours today, which is what keeps drawing to taps alone.
- **Edge snapping while drawing.** Vertex and surface snapping are in; edge
  needs each hit object's own topology, which the knife gets from
  `pickEdgeOnActive` and a curve cannot, because the active object while
  drawing is the curve or nothing.
- **Lathe over an ARC** rather than a full turn. Wants the `pendingOp`
  machinery so a slider re-runs the sweep live — which is the right way to
  build it.
