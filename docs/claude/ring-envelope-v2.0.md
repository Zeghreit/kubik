# The bloom ring as an envelope — v2.0

Zeghreit's idea, in his words: *"What if we make it change to triangle
instead of diamond if it is near border? Saving functionality and style."*
Then, when the first build kept each seat on its own ray: *"You get that
icons should distribute along this triangle, right?"*

## The problem it solves

Three properties were in conflict on a phone:

1. the ring is one constant size (a shape you learn),
2. the seats sit on fixed 45° bearings (a direction you learn),
3. the ring blooms under your thumb.

A circular ring cannot have all three near a screen edge. Every earlier
answer gave up one of them: a2.104 deformed per seat, a2.108 shrank the
whole ring, and v2.0's first draft cropped it at the frame. Measured, a2.108
drew the ring at 160px in the middle of the screen and 88.8px near the side.

## The answer

Give up **the circle**, not any of the three.

Two curves, cut by the same four walls (a wall = how far the ring may reach
that way before a seat's tip crosses the 14px frame margin):

- **The figure**: a diamond with corners at `ringR*√2` on the axes, clipped
  by Sutherland–Hodgman. One wall leaves a flat side; two leave a triangle.
  Drawn as one closed polyline.
- **The seat curve**: the circle of `ringR`, cut by the same walls —
  `ρ(a) = min(ringR, wall caps along that ray)`. Sampled into 360 points and
  walked by **arc length**; seat *i* sits at `((90 − bearing) mod 360)/360`
  of the way round, clockwise from due north of the ring's centre.

Unobstructed, eight equal steps round an uncut circle **are** the eight
fixed bearings at `ringR` — measured spread 0.01px, so nothing changes where
there is room. Cut, the seats redistribute along what is left.

## The two lessons

**Equal steps round a curve cannot pile up.** Clamping each seat along its
own bearing looks like the same thing and is not: near a wall three seats
clamp to the same small radius and land on top of each other. That is what
a2.104 did, and what v2.0 accidentally re-did before the screenshots caught
it. Dividing the *curve* evenly, rather than the *angle* evenly, is the
whole difference — and it is what "distribute along the triangle" means.

**A gesture is a direction, not a line to a target.** Picking compares the
flick direction against each seat's bearing *from the ring's centre*.
Measuring it from the finger instead was tried and reverted within the hour:
near a frame the centre is clamped 111px in while the flat it leaves is only
60, so the finger sits **outside** the seat curve — and from a point outside
a convex curve the entire boundary folds into a narrow wedge. At a left-edge
press all eight seats landed inside 110°, the cyclic order broke, and a
flick due north selected seat 7. Every geometric check still passed: the
seats were drawn in the right places, in the right order, on the right
curve. Only the pick was wrong, and nothing was measuring it away from the
middle of the screen. `_door_probe.js` section 8 now is.

## Numbers worth keeping

- `TOOL_RING_R` 120 (was 160); constant for a whole session on a phone.
- `minReach` = `RING_EDGE_PX + TOOL_RING_TIP + 60` ≈ 111px, against the 171
  a whole diamond needs. The thumb-exact bloom band on a 393px phone goes
  from 51px to 171px.
- Clearance is **L1**, not euclidean: a seat is a 52px square turned 45°, so
  two overlap exactly when `|dx| + |dy| < 2·TIP` (73.5). The envelope has
  right-angle corners, where two seats sit at a euclidean distance well
  under their arc spacing — but their L1 separation *is* that spacing,
  because the corner is square and so are they.
- The wall floor of 60 is set by that: at 44 a corner press leaves 590px of
  curve and eight seats need 588 (they touch); at 60 the curve is 642 and
  there are 6.7px between them.
- Eight seats is the ceiling near an edge. Every mode ring is exactly eight
  since a2.113; the rings that are not (Add geo, Pivot, empty scene) bloom
  at the viewport centre where nothing is cut.
