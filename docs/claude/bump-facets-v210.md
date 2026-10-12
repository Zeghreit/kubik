# The stepped bump (v2.10) — what it was, and the four things it wasn't

Short version: **v2.9's thumbnails looked faceted because the tray tile was
being stretched, not because anything about the shading was wrong.** The note
written at v2.9 blamed the distance field's voxel grid and claimed the
viewport shared the problem. Both halves were wrong, and both were written
from reasoning rather than measurement.

## The actual cause

`.mat-card img` is `width: 50px; height: 50px`. The rig drew the tile at
104×104. On a desktop that is 2.08× — fine. On the phone this app is built
for, `devicePixelRatio` is 3, so the card asks for **150 device pixels and was
handed 104 to stretch**. The v2.9 bump is a thin ridge about ten pixels wide;
upscaled by 1.4× with the browser's filter, it steps.

`PREVIEW_TILE = 208` — at least 1.4× what any current device asks for, so the
tile is always downsampled and never blown up.

| | v2.9 | v2.10 |
|---|---|---|
| tile drawn / shown at DPR 3 | 104 / 150 px | 208 / 150 px |
| ridge wobble | 3.20 | 2.77 |
| a plain ball, for scale | 0.10 | 0.11 |
| full tray rebuild, per definition | 8.6 ms | 18.3 ms |

The cost is real and is the reason to state it: four times the fragments,
which is nothing, and four times the `toDataURL` readback, which is not. It
lands at 2.15× rather than 4× because much of the per-thumbnail cost is
fixed. A slider RELEASE re-renders one definition and pays 18 ms, not 165 —
which is what `renderMatPreviews(onlyId)` has existed for since v2.3c.

## The metric had to be replaced before it could answer anything

The first attempt was a Laplacian over the ball. It answers to any hard line,
and **a bump ridge is a hard line** — so a crisp ridge and a stepped one both
scored high. It read 11 on a ridge that was visibly smooth, which means it
could not have told me whether any of the experiments below helped.

The replacement uses the geometry as ground truth. Both preview rings are
circles about the axis the ball is viewed down, so a correct render varies
around them only as smoothly as the light does — **every abrupt change around
the circle is defect and nothing else.** Walk each radius in polar
coordinates, bilinearly, and take the mean absolute second difference in the
angle. Smooth lighting differences away to nothing; a step does not.

And take it at **150 pixels**, the size the eye gets, not the size the
renderer made. That one decision is what turned the tile size from an
invisible variable into the answer.

> **The general lesson.** A metric that cannot separate the defect from the
> feature is worse than no metric, because it produces numbers that look like
> evidence. Test a new metric against a case you have already judged by eye.

## Four suspects, measured and cleared

Each of these is a plausible half-hour. Nobody should spend it twice.

**1. The trilinear reconstruction.** Linear interpolation is continuous in
value and kinked in slope at every cell face, and a bump is that slope — so
Perlin's `f*f*(3-2f)` fade is the textbook fix, and it costs no extra taps if
you shift the sample position so the hardware's own blend lands on the
smoothed weight rather than fetching corners and blending by hand. Written,
measured, **removed: 6.15 → 6.95, worse.** The fade swings the reconstructed
gradient from zero at a cell face to 1.5× at the centre, and a distance field
is very nearly linear already, so it trades a kink for a ripple.

If a genuine lattice crease ever does turn up, the answer is a **cubic
B-spline**: it reproduces a linear function exactly, so it has no ripple to
trade for. Four taps a slice instead of one.

**2. The lattice itself.** `EDGE_FIELD_DIM` 64 → 128, `EDGE_FIELD_STEPS`
40 → 100, and the bake budget lifted 250× so neither of the first two binds:
2.77 → 2.61. Not it.

**3. The preview ball's own tessellation.** `vKubikPos` is `position`
interpolated across a triangle, so the field is sampled on the flat facet
rather than on the sphere — a periodic error at exactly the frequency the
wobble metric answers to, which made it a strong candidate. 16×12 measured
2.68; 192×128 measured 2.94. The **coarse** ball was better. Not it.

**4. The ring's own chords.** Real, but saturating: 8 segments 3.91, 20
segments 2.77, 40 segments 2.71. Twenty is already past the knee, which is
where `PREVIEW_RING_SEGS` was.

## And a third of what's left is not a defect

Removing `scene.environment` takes the wobble from 2.77 to 1.77. A bump ridge
is a **curved mirror** and the environment is a room with windows in it, so it
reflects high-frequency detail around the circle. That is correct behaviour.
The check's threshold is set at 3.0 — a regression guard against the stretched
tile, deliberately not an aspiration.

## The part worth remembering

`_bumpchk` has been shooting an Edges-driven bump on a **cube** since v2.6,
and the bands in it are clean and straight. A cube is drawn across hundreds
of pixels; a tray card is fifty. That picture, and the same ball rendered at
416px (also smooth), were both obtainable before a word of the v2.9 note was
written — and either would have contradicted it.

The v2.9 note was the fourth stale claim this project has found in two
sessions, and the first one *I* wrote. The others were inherited. The pattern
is identical each time: a mechanism that sounds right, written down without a
measurement, and believed afterwards because it is written down.

**Write the measurement or write nothing.**
