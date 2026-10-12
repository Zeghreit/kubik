# v2.22 — the camera keeps its gestures, and the slider follows the point

Shipped 2026-09-06. Live at https://zeghreit.github.io/kubik/

## What Zeghreit asked for

1. *"then i try to drag point in edit mode no matter tube or curve - this point
   goes twisting towards camera - let it move in camera based plane"*
2. *"make circles that editing thicknes of point bigger - now it is hard to catch"*
3. *"let zoom rotate and translate of camera work as usual in curve, tube and
   edit modes"*
4. *"let radius around point changing by slider - if i tap on point and select
   it, tube radius slider turns to point radius slider. tap on this point again
   and it wil be deselected. also u can select one of end points before append
   a new one to it"*

## The four answers

**A drag is not a placement.** `curveResolve` raycasts the scene and snaps to
whatever is under the cursor, which is right for placing a NEW point and wrong
for moving one that exists — inside a tube the thing under the cursor is the
tube. `cameraPlanePoint(ev, through)` moves a dragged point in the plane facing
the camera, through the point it started on. The X/Y/Z/Free chips still decide
where new points land.

**A tool may claim only a press it has something to do with.** `cameraButton()`
is true for a non-primary mouse button and no tool ever claims one, so pan and
dolly work inside every bar. `curveEditPointerDown` returns true only when it
grabbed a ring or a point, and the canvas disables orbit only then. The draw
tool never disables orbit at all.

**So the press is what a tap was aimed at.** OrbitControls turns from the first
pixel, so a release judged against the moved camera could miss the line the
press was plainly on. The press stores `ce.tapSpan` / `ce.tapEnd`, stamped with
the object id and point count; the release only decides *whether* it was a tap.
The release-time `pickCurvePointOn` is gone. `tapDriftPx()` is 26px on touch,
15 for a mouse — a thumb rolls as it presses and again as it lifts.

**The selection decides what the slider is for.** Nothing selected: the tube's
radius. A point selected: that point's own thickness, over exactly the range
the weight can express, written to the CURVE not the bar, with the label saying
"Tube · point 3 radius". Tap the point again to hand it back. Every path that
moves the selection redraws the bar.

Rings: grab 26→34px, but bounded by the ring's own size and offered only from
30px — a flat 34px band round a small ring swallowed every press within 52px of
a control point, which is the orbit this version set out to give back.

## Two review passes, 13 defects

The first (opus) found 7, all in the same family: the bar and the shape
drifting apart once the slider started following the selection — an insert or
a delete leaving the slider aimed at the wrong point, a ring drag leaving the
readout stale, the number box putting the tube's radius into a point's box.

The second (opus, fresh eyes, reviewing the fixes) found 6 more, mostly in the
fixes themselves: nothing ended a point drag on `pointercancel`, the press-time
aim was never revalidated against a curve a second finger could renumber,
`opSetupStepBack` left `ce.sel` past the end, and a mouse's second button
committed the first button's held press (one `pointerId` for every button).

**The lesson worth keeping:** a fix is where the next defect lives. Both passes
were worth their cost; the second found things the first could not have,
because they did not exist yet.

## Probes

- `_v222chk.js` / `.py` — 56 checks, 9 sections. Two of them dispatch real
  `PointerEvent`s at the canvas, because the whole change is about which branch
  of that listener runs; a probe calling the handlers underneath would prove
  nothing.
- `_mkv222broken.py` — 16 breaks, 27 failures. `_mkv222broken.py late` builds a
  second copy for the one check the first masks.
- `_mkpteditbroken.py` re-anchored: three of its eighteen breaks aimed at lines
  this version rewrote.
