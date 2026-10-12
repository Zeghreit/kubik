# a2.96 — cool running: the phone stopped heating up (or should have)

Report: an iPhone 15 gets hot after 5–10 minutes of modelling. Performance
round four, and the first one about the GPU rather than `applyShading`.

## What was measured before anything was changed

The render loop was already right. a2.46's on-demand rendering draws nothing
when nothing happens (one heartbeat frame a second), and a fresh audit of the
whole file found no timer, CSS animation or leaked pointer that re-arms it.
The view cube's second context redraws only when the camera turns. Shadows
are off, there is no post-processing, no transmission, no physical material.

So the heat is in the frames that DO draw. Every one of them, for the whole
duration of a finger on the glass, was:

- **2x device pixels** (DPR 3 on the phone, capped to 2) — about 1.3M
  fragments a frame on an iPhone 15 — **multisampled**, PBR under a PMREM
  environment map, at 60 frames a second. Fragment work scales with the pixel
  count and nothing else the app does comes close.
- **`updateDirectDrag` once per pointermove**, not once per frame. An element
  drag's apply re-shades the WHOLE mesh, recomputes both bounds and rewrites
  every overlay buffer. The op bar has coalesced its slider since a2.46
  (`schedulePendingApply`); direct drags never did.

Two smaller contributors were noted and left alone: `backdrop-filter: blur`
on the inspector and menu panels composited over a live canvas (a known iOS
compositor cost, only while a panel is open during a drag), and the
self-documented gap where the edge-field bake is unthrottled during an
op-slider drag on a shape-masked material (structural; belongs with the
rebuild, not here).

## The change

**1. Gesture-time render scale.** While a touch GESTURE is live the main
renderer draws at `LIVE_PIXEL_RATIO = 1.25` instead of 2 — 39% of the pixels,
so 39% of the fragment work, for every orbit, every drag and every op-bar
slide. The first frame after the finger lifts is full resolution again (the
linger window guarantees that frame, and the restore itself calls
`invalidate()` so it never waits for the heartbeat). Nothing you look AT is
soft; only what you are moving.

A gesture, not a touch. The review's biggest finding was that the first
version keyed on `activePointers.size > 0`, so every tap and every hold — the
two most common things a finger does here, both on a picture nobody is moving
— would have reallocated the drawing buffer twice and blurred the ring you
were reading. Now a touch qualifies only once it has travelled
`LIVE_TOUCH_PX = 8`, and only if it landed on the canvas or on a range slider.
The tracker (`liveTouches`) is document-level and its own: `activePointers`
is canvas-only and has leaked before, and a leaked entry here would mean a
viewport soft for the rest of the session. Each entry carries its own
last-move clock and is ignored `POINTER_LIVE_MS` after it, so the worst a
leak can do is four seconds. Mouse and pen never qualify.

The switch happens inside `animate()`, immediately before `renderer.render`,
never in an event handler: `setSize` reallocates and clears the drawing
buffer, and doing that anywhere but right before the frame that refills it
is a blank flash.

Vertex dots are sized in DEVICE pixels (`gl_PointSize`), and every site that
sets a Points size reads `renderer.getPixelRatio()` at that moment — so
`setRenderScale` carries every non-attenuated Points material across by the
ratio of ratios (1.25/2 and its inverse round-trip bit-exactly) rather than
re-deriving each from its own formula. `knifeDotMat` was the one constructor
that skipped the ratio; fixed so the invariant is literally true. Line2
strokes need nothing: `LineMaterial` works in CSS pixels through
`resolution`, which is the viewport's CSS size and does not move.

**2. Direct drags coalesce to one apply per frame.** The move handler parks
the event in `pendingDragEv`; `flushDirectDrag()` runs at the top of
`animate()` — before the render decision, so the frame that follows shows it
— and first thing in `endDirectDrag()`, so the final position is the finger's
final position and not a frame behind. `beginDirectDrag` clears the park so a
move belonging to one drag can never land on the next. The first apply of a
drag stays synchronous: the axis is resolved from the event that promoted the
candidate.

## What the review caught

- **D1** — the trigger was contact, not motion (above). Would have made the
  most common interaction pay for the rarest.
- **D2** — the op-bar slider, the other path that draws continuously, was not
  covered because it is a DOM pointer that never enters `activePointers`.
  The document-level tracker covers it.
- **D3** — `flushDirectDrag`'s `if (directDrag)` checks that A drag is live,
  not that it is the same drag. Unreachable today (the one teardown that
  bypasses `endDirectDrag` also blocks a new drag), hardened anyway.
- **D4** — a leaked entry plus any UI touch would have kept the viewport
  soft indefinitely, and even a clean end waited for the heartbeat to
  restore. Per-entry clocks and the explicit `invalidate()` on restore.
- **D5** — a hybrid laptop's mouse hover during a touch drag would have
  toggled the scale every frame. The pointer type is decided once, at down.

## Not measured, and why

The harness cannot measure this. Probe suites run under Chrome's virtual
clock, where `requestAnimationFrame` does not fire and `performance.now()`
reads zero; and no headless Chrome on a Windows box has an iPhone's thermal
envelope. `renderScaleWanted(now)` and `setRenderScale` are exported on
`__kubik` and are pure enough to be asserted; the thing that matters — does
the phone stay cool — is a ten-minute session with the phone in your hand.
**Zeghreit tests it.** If it is still warm, the next levers in order are:
`LIVE_PIXEL_RATIO` down to 1.0; a 30fps cap on the drag loop (iOS itself
throttles rAF to 30 under Low Power Mode, so 30 is an Apple-sanctioned
"good enough"); and the two contributors left alone above.

## Regression

`_a296` against `_a295f`, both taken this session on the same machine: see
`_cmp_out.txt`. `_imp_probe` remains the known CDN flake.

## Debug

`?debug=1` → `__kubik.renderScaleLive`, `__kubik.liveTouches`,
`__kubik.pendingDragEv`, `__kubik.renderScaleWanted(now)`,
`__kubik.setRenderScale(bool)`, `PERF.rescale` (count of actual switches).
