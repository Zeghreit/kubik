# Edge / vertex slide — a2.80

Shipped `3963a39`, live as a2.80. Last of the three ops
`op-gap-analysis.md` ranked after Circularize.

Supersedes `slide-a2.80-wip.md`, which was written when the desktop link
dropped mid-patch. That file can be deleted.

## The design

Moves an existing loop along its ring without changing its shape or the
topology round it. Loop cut lets you slide a loop *while placing it*; a loop
already in the mesh could only be deleted and re-cut to move it.

Seat 9 in the Vertex and Edge rings — **Loop's own seat** in the Edge ring:
Loop cut makes a loop, Slide moves one. Amount is a signed fraction of the way
to the neighbouring loop, opening at 0. Face mode is excluded: sliding a face
patch's rim is what Inset already does, and better.

**The selection reading was already paid for.** `flowSelectionItems` answers
"which vertices are the loop, and what are the two vertices across it",
and already refuses poles, boundaries, and corners where the two non-loop
neighbours are not genuinely opposed. Set flow bought that over three review
rounds; Slide inherits it.

**What is not free is which side is which.** The neighbour map's order is
arbitrary per vertex, so a naive slide sends half the loop one way and half
the other. The side is propagated along the loop: two neighbouring loop
vertices agree when the across-vertices they chose are themselves joined by an
edge — the far side of the quad they share.

## The review found six defects, all in that one layer

**1. Symmetry broke the model.** The comment said "per-element, like Set flow,
so the union with the mirror is the right way to be symmetric". That does not
carry: Set flow is per-element *and direction-free*, so it mirrors correctly
on its own. A slide has a global **sign**, and the mirror of "toward +X" is
"toward −X". Measured on a tube along X with X symmetry: both loops slid the
same way through the model and it came out lopsided. Right only by accident,
when the ring runs perpendicular to the mirror plane. Fixed by giving every
mirrored pair the mirror of its partner's side, lowest logical id winning.

**2. Islands each had their own arbitrary seed.** Two loops picked together
could go opposite ways, decided by `topo.edges` insertion order and changing
with every edit. Islands are now aligned to the first one's mean direction.

**3. A partly pairable selection was applied partly, silently.** Vertices with
no across-pair stayed put while their neighbours moved a whole quad — a spike
in the mesh from one drag. Now it is all of the loop or none of it, with a
count.

**4. `alongFrom` was a proxy.** "A selected neighbour that is not my
across-pair" is right on a quad grid and wrong wherever a diagonal is a real
edge — cap-hole fans, knife cuts, imported triangle soup — where it can
propagate the side across the wrong quad. `slideLoopKeys` rebuilds the loop's
actual edge set.

**5. The BFS dropped disagreeing second paths.** A loop that closes with a
twist tore at exactly one edge in silence. Now detected and refused.

**6. The 0.95 stop did not keep its promise.** It is relative; the weld is
absolute (`computeLogicalOf` rounds to 1e-4). On a small enough model — and
Kubik has no unit — a twentieth of the gap is inside the weld tolerance.
Measured: 60 logical vertices → 48. `SLIDE_MIN_GAP` (5e-4) is now an absolute
floor and the tighter of the two wins.

## Verification

- `_verify.py` PASS (23,017 JS lines).
- Regression `_a279f` → `_a280f`: **28 of 28 existing suites identical**, only
  `_slide_out.txt` new. `_theme`'s ring count is unchanged at 13 because it
  measures the Object ring and Slide went into the Vertex and Edge rings.
- New `_slide_probe` (suite 30), 19 sections. Section 2 is the one the op
  exists for: **12 of 12 loop vertices chose the same side.** Sections 16–19
  cover the review's findings; 16 asserts the model is still symmetric
  *after* the slide, not merely that the intent was right.

## Lessons

**An inherited justification has to be re-earned.** "Per-element, like Set
flow" was true of the mechanism and false of the conclusion, because Set flow
is direction-free and Slide is not. Copying a sibling's *reasoning* is as
risky as copying its code — a2.79 learned the same thing about
`extrudeRegionOp`'s rim walk and wall winding.

**A relative guard cannot keep an absolute promise.** The 0.95 stop was
written to prevent a weld and could not, because the weld threshold is a fixed
distance and the stop is a proportion. Whenever a comment promises something,
check the promise is in the same units as the guard.

**Check the fixture contains the thing being tested — twice, here.** The first
cylinder used `def.a`/`def.b`, which do not exist, so it silently built the
DEFAULT cylinder: one band tall, no interior ring at all, and its "middle
ring" was the top rim. Then section 18 set `mesh.scale` to make a "small
model" — but `logicalPos` reads *local* coordinates and the weld rounds those,
so the gap measured 2.5e-1, identical to full size. Both passed as failures /
vacuous successes until the fixture itself was asserted.

**And check the assertion's own numbers.** The corrected section 18 then
failed on a threshold (`gap < 2.1e-3`) that had no reasoning behind it, over a
fixture that was fine. The condition that makes the test mean anything —
`gap × 0.05 < SLIDE_MIN_GAP` — is now written out in the probe.
