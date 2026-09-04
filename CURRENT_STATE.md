# Kubik — current state

Single-file browser 3D low-poly mesh editor. "A fidget for 3D artists":
relaxing, one-handed, mobile-first. three.js from CDN, no build step.

- Live: https://zeghreit.github.io/kubik/
- Repo: `C:\Users\a.bodrov\Projects\kubik` (index.html is ~29,200 lines)
- Version at time of writing: **2.2**
- **2.0 is claimed.** The `a2.x` line — alpha 2.0 — ran from a2.0 to a2.113a
  and is finished; everything below that is written `a2.N` is history, and
  the number is kept because the comments in the code cite it. New work from
  here takes a number (`2.1`), fixes a letter (`2.0a`).
- Debug: append `?debug=1`. Tap picks log a `[pick] ...` line explaining why
  a tap resolved as it did, every mesh edit logs a `[winding] ...` line (see
  Winding audit), and `window.__kubik` exposes the live app (see Testing
  loop).

This file describes the app AS IT IS, not how it got here. Version numbers
appear only where they explain why something is the way it is. It was
rewritten at v1.93 because it had accumulated per-version sediment and had
begun contradicting itself — a handoff that argues with itself is worse
than none. Prefer rewriting a section over appending to it.

## Shipping

**Push without asking.** When a version is verified - `_verify.py` passes,
its own probe passes, the suite is clean apart from `_imp_probe`'s known CDN
flake - commit and `git push`. The push IS the ship; the app is live at the
URL above and a commit sitting unpushed helps nobody. Do not stop to ask.

## Versioning

**Numbers for new work or reworks** (v1.85 → v1.86). **Letters for bug
fixes** (v1.85 → v1.85a → v1.85b). A change is a letter unless it lets the
app do something it could not do before. Fixing three broken things is
still a letter — this was got wrong once, at v1.86, which should have been
v1.85d.

## One rail on the left, and the cube gets its colours back (v2.2)

Zeghreit's, all four of it. The right edge belongs to the view cube again and
the left edge is the rail; each tab says its own name; and the cube's labels
and its outline both changed.

### Both shelves on one rail, under the readout

a3.0 6.1 had put the material shelf on the RIGHT edge opposite the outliner,
on the reasoning that the cube had shrunk to 56 and freed that edge. The cube
went back to 128 at a2.107 and the reasoning went with it — at 128 the right
edge is the cube's, and a shelf opposite it is a shelf competing with it. So
both tabs are on the left again, as they were at a2.103.

**Where the rail starts is not a chosen number.** The top strip is a 44px row
running 7..51 with the tool readout under it at 59..73, so the air between
them is 8. The rail takes the same 8 under the readout: **73 + 8 = 81**. The
readout ends up sitting in equal air above and below, and if either half of
the strip moves the gap stops matching and says so. The materials tab follows
at 81 + 96 + 8 = **185**. Both shelves derive their max height from their own
tab's top plus 80 of clearance, so nothing can drift.

Two other things fell out of putting them on one rail:

- **One shelf at a time.** Both trays roll out to the RIGHT of their tab, so
  two open shelves would be two panels over the same strip of viewport.
  Opening either closes the other.
- **The material tab mirrored back to the left**: its border, its 10px cut
  (top-right now, facing the viewport, against the outliner's bottom-right)
  and the tray's shoulder.

### The tabs say what they are

Both handles used to be a chevron. A chevron says "this opens" — which, once
the two sat one above the other on the same rail, was the one thing you
already knew, while "which of these two is this" was the thing you did not.

Each tab now carries its own name, set on its side: `writing-mode:
vertical-rl` plus a half turn, in the readout's mono caps one step down.
**Not `sideways-lr`** — it makes the same bottom-to-top line, but it is still
missing from Safari on the phone this is built for, and a missing
writing-mode falls back to horizontal, which in a 26px column is a word
broken one letter to a line.

The tab grew 64 → **96** to fit the name. Nothing else about it moved: 26
wide, edge-tucked, the cut on the viewport-facing corner. The open/closed
chevron swap is gone from both `setOutlinerOpen` and `setMatTrayOpen`; the
name does not change, so nothing does.

### Six faces, six colours

a2.107 made every cube label grey, arguing that the axis triad means X, Y and
Z during a drag while a face means look-DOWN-this-axis, so sharing the colours
claimed the two were one statement. Reversed by request — and what goes back
is sharper than what came out. Before a2.107 a PAIR of opposite faces wore one
colour, so the cube said "X" twice and never said which end you were looking
at. Now the colour is the axis and the TONE is the sign: the positive face is
the axis hue lifted toward `--text`, the negative face is the axis hue itself.
No two faces read the same, and the cube still carries three colours rather
than six.

| face | axis | colour |
|---|---|---|
| RIGHT | +X | `#E08A78` coral lifted |
| LEFT | −X | `#C85A47` `GIZMO_AXES` x |
| TOP | +Y | `#F2DCA6` amber lifted |
| BTM | −Y | `#E8C87A` `GIZMO_AXES` y |
| FRONT | +Z | `#7FAEDC` dusty blue lifted |
| BACK | −Z | `#4A82B8` `GIZMO_AXES` z |

`GIZMO_AXES` is still the only place the three base hues are decided. The
darkest of the six clears 4.1:1 on `--panel2`; the AA floor for text this size
and weight is 3:1.

### One rule per edge, at --rule

The thick outline you could see on the cube was **not** the edge object — it
was a 5px stroked rect baked into each face's 128px texture. Two faces meet at
every edge that is not on the silhouette, each showing its own border, so the
line you actually read was DOUBLE what was drawn: about 4.4 CSS pixels against
the 2px every button outline in this app wears. And being baked, its weight
depended on how many texture pixels a CSS pixel happened to be.

The `THREE.LineSegments` that was supposed to be the outline drew a single
DEVICE pixel — half a CSS pixel on a phone — because WebGL ignores
`LineBasicMaterial.linewidth` outright. This file has known that since a2.53
and says so at the selection overlay.

So: the baked border is gone, and the edges are a `LineSegments2` with a
`LineMaterial` at `linewidth: 2`, which is `--rule`, in CSS pixels, like every
other fat line in the app. Two details that are not optional:

- **`resolution` is the CUBE's canvas, not the viewport's.** The cube canvas
  is a fixed 128px square that never resizes, so it is set once — and
  deliberately NOT pushed onto `gizmoStrokes`, which `updateStrokeResolution`
  walks with the viewport's size on every resize.
- **`polygonOffset` on the faces, not `depthTest: false` on the line.** A fat
  line is a quad straddling the edge, so half of it lies over a face at
  exactly the same depth and would z-fight into a dashed rule. Turning depth
  testing off instead would have shown the three edges BEHIND the cube as
  well, which is a wireframe, not a solid.

### Measured

`_traychk.py` (a real clock — a `max-height` transition does not run under
Chrome's virtual time, so every screenshot of an open tray is a picture of its
start value):

```
readout  y=59 h=14 bottom=73      gap header->readout = 8
#outTab  x=0 y=81  w=26 h=96      gap readout->outTab = 8
#matTab  x=0 y=185 w=26 h=96
#viewCube x=348 y=71 w=128 h=128
outliner open: #outTray x=26 y=81 w=232 h=64,  materials closed
materials open: #matTray x=32 y=185 w=96 h=326, 4 cards, outliner closed
```

Suite: `_help_probe` PASS after its Materials lead was corrected (it said
"flush to the right edge, below the two buttons under the view cube").
`_theme_probe`'s `left_column_depth` bound moved from 240 to 300 with the
rail's own reach — the DEPTH test that guards a2.65's decision is untouched,
and a third seat would still trip it.

## Cool running, part two — the loop sleeps and the field stops re-baking (v2.0b / v2.1 / v2.1a)

a2.96 was the first pass at the phone getting hot: it capped the gesture-time
render scale at 1.25 and coalesced direct drags to one apply per frame. It
moved the symptom from **five to ten minutes** of modelling to **twenty-five
to forty**. This is the second pass, and it is four separate things — one of
them much larger than the other three.

### The one that mattered: the distance field was baking sixty times a second

`ensureEdgeField` has two throttles and both of them test `f` first — the
existing field — deliberately, because a throttle here may hand back a STALE
field but must never hand back NO field (with no field the shader substitutes
a 1x1 black texture, black is distance zero, and the object renders fully
worn; dropping the `f &&` once turned a slow-but-correct drag into an 8Hz
strobe between correct and wrong).

`rebuildFromEditable` installed a NEW `BufferGeometry` and disposed the old
field. **Every op in the app funnels through it, and an op-slider drag runs
it once a frame.** So `f` was absent on exactly the path the throttle was
written for, both guards short-circuited, and the bake behind them — up to
2.5M `distToSegment` calls plus a 1 MB texture upload, **inside
`renderer.render`** — ran on every frame, for any object wearing a shape
mask or rounded edges. The function's own comment had said since it was
written that carrying the field across the rebuild was the real fix and that
it belonged with the rebuild. v2.0b does that.

Measured by `_field_probe`, twenty frames of an op-slider drag:

| | before | after |
|---|---|---|
| finger down (touch drag) | 20 bakes / 20 frames | **0** |
| mouse on the slider | 20 bakes / 20 frames | **3** (one per 120ms) |
| bakes over the whole probe | 41 | **6** |

What you see: during the drag the wear band lags the shape, because the field
describes the geometry from before this frame's edit. On the frame after the
finger lifts it is right again. `kubikEdges.gen` is a monotonic counter, so a
carried field can never match the new geometry and can never go permanently
stale; and `EDGE_FIELD_MS` (120) is shorter than `RENDER_LINGER_MS` (260), so
the linger window after any gesture always contains a frame in which the
re-bake fires.

### The loop sleeps (v2.1)

a2.46 stopped the app **drawing** when nothing happens. It did not stop it
**waking**: `requestAnimationFrame(animate)` was unconditional, so a phone
sitting in a hand while its owner looked at the model still ran sixty
callbacks a second and kept the display link and the compositor out of their
idle states the whole time. A modelling session is mostly looking.

`animate` now schedules its own next tick: a rAF if `renderWanted` says so,
otherwise a `setTimeout` for the heartbeat. `invalidate()` is the wake —
which costs nothing to arrange, because a2.46 already made every path that
changes the picture end there, with the document-level capture listeners as
its backstop. Measured idle: **1 loop run per second instead of 60**
(`PERF.tick`, which is new and exists to say exactly this).

Three things this needed, two of them found in review:

- **`startLoop()`, and `loopStarted`.** `invalidate()` is called several
  times during `init`; without the flag the first `applyEnvironment` would
  start the loop underneath the code still building what it draws.
- **The re-arm is in a `finally`.** Until v2.1 the next frame was requested
  by the FIRST statement of `animate`, so a throw anywhere in the body still
  left a running loop and the heartbeat kept repainting. Scheduling at the
  end gives that guarantee back only if the schedule cannot be skipped — and
  a throw on the very first frame would otherwise have left the loop
  unstarted, in an app with no reload button on a Home Screen.
- **`cubeAligning` joined `renderWanted`.** It is a state that only the loop
  advances, and the cube leaves it pending for the tick after its animation
  ends. A swing that MOVES the camera gets that tick free from orbit's
  `change` event; tapping the cube face you are already looking at moves
  nothing, so the loop would have slept with the engage still pending.
- **Coming back from the background clears the latch.** `wakeLoop` refuses to
  arm while `rafPending` says a frame is coming; if the browser dropped that
  queued callback while the tab was hidden, nothing could have restarted the
  loop. `visibilitychange` clears it. Double-arming is self-healing.

### Half the frames, but not straight away (v2.1)

a2.96's second named lever was a 30fps cap on the drag loop. Applied to every
gesture it would be felt — a flick is the one place 60 reads as 60, because
the picture moves fast enough for the eye to see each step. So the cap waits:
the first `LIVE_FPS_AFTER_MS` (600) of a gesture run at full rate, and a
gesture still going after that is a SUSTAINED one — a slow orbit, a long
drag, a finger on a slider. Those are both the ones where 30 is hard to see
and the ones that actually make heat, because they last. A flick is over
before the cap arrives.

`LIVE_FRAME_MS` is 32: one frame at 60Hz and three at 120Hz, so it is 30fps
on either. `lastRenderAt` is not moved by a skip, so the gap grows and the
next frame always draws. `capped` can never suppress the heartbeat (32 < 1000
by construction) and can never suppress the full-resolution restore.

It rides the same `liveTouches` tracker as the render scale, so it is
touch-only: a mouse is on a machine with a fan and never qualifies.

**And the op pipeline got the same cap (v2.1a).** One apply per frame is
right when every frame is drawn; running the whole pipeline — snapshot copy,
re-run the op, rebuild, topology, shade, overlays — sixty times to feed
thirty paints is the CPU half of the same waste. `schedulePendingApply`
re-arms rather than drops, so the last value the finger set is always
applied.

Measured by `_loop_probe` at a forced DPR of 2: gesture under 600ms **59.8
fps**, the same gesture past 600ms **30.4 fps**, pixel ratio 2 → 1 during the
gesture and back to 2 on the frame after the finger lifts.

### LIVE_PIXEL_RATIO is 1.0 (v2.1)

a2.96's first named lever. 25% of the fragments of the shipped 2x and 64% of
a2.96's 1.25. It is the floor for two reasons and neither is the screen's own
pixel count (an iPhone reports 3 and this file has capped it at 2 since long
before either lever): it is where the ratio-of-ratios carry-across for Points
sizes round-trips exactly, and it is where the softness is still only visible
on something that is moving.

### The small ones (v2.0b)

- **`applyMaskPatch`'s `refresh` stopped allocating.** It called
  `packUniforms()` purely to copy out of the result — a whole fresh uniform
  set (4 `THREE.Color`, eleven arrays, four `Vector3`, a `Vector2`, a
  `Matrix3`) per material per call, and `updateMaterialEverywhere` reaches
  every material of every object on every `input` event. A subdivided model
  holds over a thousand materials. Both callers now read `maskSlotValues`,
  one definition of the arithmetic, writing into a shared scratch;
  `maskColorLinear` memoises parsed hex. Same numbers, no allocation.
- **`camera.updateMatrixWorld()` before `flushDirectDrag`.** `lookAt`
  recomposes `matrixWorld` from the PREVIOUS quaternion before assigning the
  new one, so the drag was projecting through an orientation one frame old
  whenever the camera was coasting. It is now REQUIRED rather than tidy: on a
  capped frame `renderer.render` never runs, and the render was what used to
  refresh the matrix.

### Two probes that need a real clock and a real GPU

Neither is in `_runprobes.py`, and neither can be: the suite runs under
SwiftShader with Chrome's virtual clock, where `requestAnimationFrame` never
fires and `performance.now()` reads zero — which is precisely the two things
everything above is measured in. Both serve the folder themselves, run
headless Chrome with `--use-angle=d3d11` and no time budget, and have the
page POST its own answer back (`--dump-dom` fires at load, far too early).

- **`_field_probe.py [target.html]`** — bakes per frame of an op-slider drag.
  Takes a filename, so it runs against a `_bak_*.html` for a before number.
- **`_loop_probe.py [target.html]`** — idle frames and idle loop runs, whether
  `invalidate` wakes it, frames per second inside and past the cap window,
  and the pixel ratio through a gesture. Forces `--force-device-scale-factor=2`
  because a DPR-1 box can never exercise the render scale at all.

### What is still on the list, in order

Found by review this session, none of it done:

1. **The `#N` program fork.** `applyMaskPatch` appends `'#' + (_maskGen++)`
   when a material returns to a key it has already compiled under, and
   `_maskGen` is global, so the suffix is unique per MATERIAL. Painting A,
   then B, then A again over a subdivided object mints one distinct
   `WebGLProgram` per material — thousands, and shader linking is the
   expensive half on Apple GPUs. `applyFinishToSelection`'s comment claims it
   bumps a fresh generation to prevent exactly this; its body does not.
2. **`renderMatPreviews` costs N renders and N synchronous `toDataURL`
   readbacks**, on every material-editor slider RELEASE, for the whole
   library. Only the card whose definition changed needs redrawing.
3. **`_maskTex` and the preview rig's materials are never pruned** for
   definitions minted by a file open or an import, so a session that opens
   several files grows all three sets and never shrinks them.
4. The remaining two contributors a2.96 listed and left: `backdrop-filter`
   on the inspector and menu panels composited over a live canvas, and
   `antialias: true` on the main context (fixed at creation, so it cannot be
   traded per gesture — and turning it off once caused a blank canvas on some
   mobile GPUs, which is why it is still on).

**Whether any of this worked is a ten-minute session with the phone in your
hand.** Nothing on a Windows box has an iPhone's thermal envelope, and the
numbers above are frame counts and bake counts, not degrees.

## The help card follows the rings (v2.0a)

The card had drifted badly. It was written before doors (a2.110) and still
described a ring with no fixed seats and no second layer; it filed Connect
under edges when it is vertex-only; it listed Flip as an object tool after
Flip became a chip on Mirror; and it had no row at all for Slide, Array,
Group/Ungroup, Solidify, Clean up or the vertex Bevel.

**The tool sections now mirror the rings** — Vertex tools, Edge tools, Face
tools, Object tools, each in seat order with its doors called out as
`CUT — a door` rows followed by that door's contents. "Marks and cleanup"
and "Edge and face tools" are gone; their rows moved to the ring they
actually belong to. The card's own rule is that what you read matches what
is on screen, and one section per ring is the only arrangement that keeps
that true as the rings change.

**Tool rings** gained rows for the eight fixed seats, doors and backing out
of one, the shape near a border, and what a hatched seat means.

`_help_probe.js` (suite index 34) is what keeps it honest from here. It
opens the card and checks four things: it renders with no blank rows, every
icon a row names exists in the glyph table (a missing one draws an empty box
and throws nothing), **every seat and every door item in every ring has a row
somewhere in the card**, and no tool row names something the rings no longer
have. Terms are matched on the seat's own WORD — what a reader sees and would
search for. The object ring is read live with a selection, because the
grouping seat is conditional.

`window.__kubik` gained `openHelp`, `HELP_SECTIONS`, `HELP_KEYS`, `icon` and
`HUB_TOOLS_OBJECT_BASE` for it.

## The ring is an envelope (v2.0)

Zeghreit, on the bloom ring: *"diamond menus is scaling depending on zoom. I
don't like it... it's better if it would keep its size all the time not
getting narrower or wider."* Then, having watched it again: *"Maybe it is not
zoom depending but place depending on — it getting narrower close to the
border."* Right on both counts about the symptom. A probe at four camera
distances read 160.0 every time; the same probe at four press points read
160.0 in the middle of the screen and **88.8** near the side.

Then the idea this whole version is built on: *"What if we make it change to
triangle instead of diamond if it is near border? Saving functionality and
style."* And, when the first attempt kept the seats on their own rays:
*"You get that icons should distribute along this triangle, right?"*

### What it does now

**One size, everywhere.** `TOOL_RING_R` is 120 (down from 160, which no
longer needed the headroom) and the radius depends only on the window. Press
anywhere: same ring. A marking menu is learned as a SHAPE, and a shape that
is a different size depending on where the thumb landed is not one shape.

**The shape gives way instead.** Two curves, cut by the same four walls:

- the **figure** is the diamond, corners at `ringR*SQRT2` on the axes, clipped
  by Sutherland–Hodgman. One wall leaves a flat side; two leave a triangle.
  Drawn as one closed `polyline`.
- the **seat curve** is the circle of `ringR`, cut by the same walls —
  `rho(a) = min(ringR, wall caps along that ray)` — sampled into 360 points
  and walked by **arc length**. Seat *i* sits at fraction
  `((90 - itsBearing) mod 360)/360` of the way round, clockwise from due
  north of the ring's centre.

Unobstructed, the arc walk reproduces the eight fixed bearings *exactly* — 8
equal steps round an uncut circle ARE the 45s at `ringR`, and the probe
measures the spread at 0.01px. Cut, the seats redistribute along what is
left, so the three behind a wall come to rest evenly spaced in a line ON it.

The two curves are deliberately not the same: the diamond's edges pass
through the diagonal seats and its corners overshoot the cardinal ones. One
consequence is visible and accepted — a wall between `ringR` and
`ringR*SQRT2` nips a corner off the figure while no seat has had to move
yet. The figure gives way first, which is the right way round.

**The centre barely moves.** `minReach = RING_EDGE_PX + TOOL_RING_TIP + 60`
≈ 111px, against the 171 a whole diamond needs. On a 393px phone the ring
blooms exactly under the thumb across **171px** of it, against 51 before.

### Why arc length and not per-seat clamping

a2.104 clamped each seat along its own bearing and drew a star through the
clamped radii; it looked chaotic and was reverted. v2.0's first attempt did
the same thing in new clothes and produced the same result: three seats
behind a wall all clamp to the same small radius and land on top of one
another. **Equal steps round a curve cannot pile up** — that is the whole
argument, and it is what *"distribute along this triangle"* means.

Clearance is measured in **L1**, not euclidean: a seat is a 52px square
turned 45°, so two of them overlap exactly when `|dx| + |dy| < 2*TIP`
(73.5). This matters because the envelope has right-angle corners, where two
seats sit at a euclidean distance well under their arc spacing — but their
L1 separation IS that spacing, because the corner is square and so are they.
The wall floor of 60 is set by this: at 44 a corner press leaves 590px of
curve and eight seats need 588, so they touch; at 60 the curve is 642 and
there are 6.7px between them.

### The pick is a flick DIRECTION

The seats' bearings are compared against the direction the finger has
travelled, measured **from the ring's centre, not from the finger**. v2.0
tried the finger for one afternoon on the reasoning that the bearing you are
pointing at ought to be measured from where you are pointing. It is wrong,
and badly: near a frame the centre is clamped 111px in while the flat it
leaves is only 60, so the finger sits OUTSIDE the seat curve — and from a
point outside a convex curve the entire boundary folds into a narrow wedge.
Measured at a left-edge press: all eight seats inside 110°, the cyclic order
broken, and a flick due north selecting seat 7. Every geometric check still
passed; the seats were drawn correctly and only the pick was wrong.

`_door_probe.js` **section 8** exists because of that hour. It sweeps all 360°
of flick direction at four press points and asserts eight reachable seats,
none under 20°. Current worst: 36°.

### Deliberately absent — do not rebuild these

- **A ring that shrinks near an edge** (a2.108). Constant size was the ask.
- **A per-seat radius clamp** (a2.104, and v2.0's own first draft). Piles
  seats on top of each other; the arc walk is the answer.
- **Cropping the ring at the frame.** Tried at v2.0 and reverted: a corner
  press put 5 of 8 seats off-screen and it read as a menu that had fallen
  off the edge, not as a triangle.
- **A second square in the figure** (removed a2.111a) and **per-seat
  polyline edges** (a2.111, replaced by one closed outline at v2.0).
- **Picking by bearing from the finger.** See above.
- **A ring of more than eight seats near an edge.** A corner press leaves
  ~642px of curve; eight 52px seats need 588. `_ring104_probe.js` keeps a
  14-seat ceiling probe that reports clearance without asserting it, and the
  reason it does not assert is written there.








## Vertex bevel, round by default (a2.113)

The last empty bearing. Zeghreit: *"vertex bevel is most of the time need to
do quick circle of it - it bevels into diamond with edges split in the middle
and connected to outer geo vertices... so lets do bevel do this with also
circularized."*

Every edge meeting the vertex gets a new point a little way along it, each
face that came to a point there stops at two of them instead, and the hole is
capped with a new face. **Round is the default**, and that is the reason the op
is worth having: a bevelled corner left alone comes out a diamond - the new
points sit wherever the incident edges happened to run - and what you wanted
was a circle, which otherwise costs a second trip through Circularize.

`vbevel` in OP_SPECS. Chips **Round / Flat**, toggle **Even** (equal angles as
well as equal radius, which turns a lopsided corner into a regular polygon).
Vertex bearing 7. `symExpand` before `beginPendingOp`, like Bevel and Inset,
because the op is derived from each corner's own geometry.

### Walk the fan; do not sort by angle

The ring's order comes from chaining the incident faces - each is entered from
one neighbour and left toward the next, so the faces chain through the
neighbours and that chain IS the order.

Sorting by angle around an averaged normal was the first version and it is
wrong twice. On a saddle the averaged normal nearly cancels and the order
stops matching the faces. And on a vertex where two separate fans meet - two
pyramids tip to tip, which Merge by distance makes - the sort interleaves both
fans into one self-crossing cap laid over two holes, with no refusal. The walk
cannot do either: it returns to its own start having used every incident face
exactly once, or the corner is not a single closed fan and the op refuses.

### Deliberately absent - do not rebuild these

- **A cap group without a material.** This was the shipped-blocker review
  caught. `rebuildFromEditable` sets `materialIndex = gi` and does not touch
  the material array; three.js silently SKIPS a group whose material is
  undefined. The geometry was right and the corner rendered as a HOLE. Every
  other group-growing op in the file pushes a material in the same breath -
  extrude, inset, `bevelEdgesOp`, cap holes, solidify. Miss it and the probe
  will not see it either: counting `geometry.groups.length` goes 6 -> 7 and
  passes.
- **The mean radius for Round.** The cut distances are each capped against
  their OWN edge, so on a corner with one short edge and three long ones the
  mean lands far past the end of the short one and folds the two faces sharing
  it. **The smallest radius is the safe one** - the tightest edge sets the size
  of the hole - which is how `bevelEdgesOp` guards the same thing.
- **A fan triangulation.** `polygonTriangles` ear-clips; a fan emits zero-area
  triangles on collinear outlines and triangles outside the polygon on concave
  ones, and imports routinely produce concave n-gons.
- **Accepting a partial boundary walk in `outlineOf`.** A group with two loops
  or a pinch walks fine and closes fine, and the rebuild then replaces the
  whole group with that partial loop - deleting every triangle it did not
  cover. `loop.length === open.size` is the guard, and it is the same one
  `trisOutlineLogical` states in as many words.
- **A quiet fallback when a face's ring lookup misses.** Keeping the original
  corner in one face while every other face round it is cut back and a cap is
  laid over the hole leaves overlapping non-manifold geometry and says
  nothing. It refuses.
- **Reusing `flat` / `round` as chip keys.** `refreshOpGrouping` looks a chip's
  tooltip up by KEY in one shared table, so these carried the EDGE bevel's
  words. They are `vround` / `vflat`, and `_vbev_probe.js` section 0 asserts
  it - because setting a key the op does not know falls through to Flat, and
  Flat on a symmetric cube corner IS a circle, so sections 3 and 4 passed
  while testing nothing at all. That happened.

### Known, not fixed

The op rebuilds the whole mesh every slider frame - about four mesh passes and
two topology builds. That is the same shape as every other slider op here and
is fine for a handful of vertices. What is out of line is `findLogicalByPosition`
running once per ring point in `applyPendingOp`: O(targets x valence x
logicalCount), and `symExpand` doubles the target count first. Select an edge
loop's worth of vertices and a drag will crawl. One position -> logical map
built per run collapses it, the way `buildSymmetryMap` already does.

`_vbev_probe.js` (in the suite): the chip keys, a cube corner becoming a
triangular face, Flat sitting exactly on its edges, zero open edges with a
shrinking positive signed volume (a cap wound inside out is the one failure a
screenshot would not show), the selection following the corner to the ring,
cancel restoring, Round giving equal radii, and Even giving 120.00 degree gaps
on a deliberately skewed corner.

## A bearing never empties (a2.112)

Zeghreit: *"there should be 8 icons but now in some menus it's lesser than 8
and there is empty seats which I want to fill with something."*

Three holes, and only one of them needed a new op.

### Object bearing 5 - the disabled seat, at last

`a3.0 2.1` has specified this since the beginning - *"BRIDGE / DISABLED /
Needs 2 faces, you have 1. Still shown, can't be aimed"* - and it was never
built. The grouping seat was withheld whenever neither Group nor Ungroup
would do anything, which for **a single ungrouped object is the commonest
state the app has**. Before a2.110 that silently re-rotated the whole ring;
after it, it left a hole.

`enabled` is now a field on a tool, and it is **purely a look**:

```
.hub-item.off   45deg hatch in --accent-dim over --panel, word dimmed
```

Deliberately NOT the danger stripe, which is orange and means very nearly the
opposite - that one says this WILL work and you may regret it.

**Still aimable**, against the spec's wording. A seat the aim skips over means
pulling toward a seat you can see and lighting a different one, which is a
worse lie than a pull that does nothing. Lifting runs the op, and every op in
the file already refuses with a toast naming what is missing - "Select two or
more objects to group" - which is the answer the user actually wanted. So
`enabled` costs one class and no new plumbing.

A door asks its FIRST op, the same one its second word names.

Carrying it: `grouping` (bearing 5, always present now) and `join` inside the
MESH door, which had its condition removed at a2.110 and gets it back as a
look rather than an absence.

### World bearing 4 - Isolate

Isolation was fully built and reachable only by a **three-finger pinch**,
which is to say not reachable: nobody finds a gesture with no affordance.

Bearing 4 is straight down, and the rule for straight down is that it TAKES
AWAY. Isolate takes away - everything except what you picked - and the second
pull gives it all back. So the bearing keeps its meaning without becoming
dangerous: **this is the one reductive op in the app that destroys nothing**,
which is exactly why it can hold the seat Delete holds everywhere else. No
hazard stripe, for the same reason. The pinch still works.

It is a toggle, so it lights when isolation is on, and hatches when there is
nothing selected to isolate.

### Free recovery: Clear creases

`clearAllCreases` was defined, working, and reachable from nowhere at all
since the Subdivide drawer went. It joins the Edge FLOW door next to Crease,
whose undo-all it is.

### Vertex bearing 7 - still open

The only hole that genuinely needs a new op. Zeghreit chose **Bevel** - turn a
selected vertex into a face, the way Edge's Bevel turns an edge into a strip.
Not built yet; it is real topology work, not a wiring job.

### Deliberately absent - do not rebuild these

- **Grow and Shrink on ring seats.** They held seats 12 and 13 in all three
  component rings until a2.51, when both became the THREE-FINGER SLIDE -
  the gesture a ring seat was always going to be tapped repeatedly to
  imitate. They are the obvious thing to reach for when a bearing needs
  filling, and reaching for them undoes a decision that was right.
- **Withholding a seat because its op cannot run.** That is what a2.112
  replaced. A bearing that comes and goes teaches the hand nothing.
- **Skipping a disabled seat when picking.** See above: the aim must not lie
  about which seat the finger is on.
- **Hazard-striping a disabled seat.** Orange means destructive, not
  unavailable. They are close enough on a small screen that using one for the
  other would cost the stripe its meaning.

## The reach, and one diamond (a2.111)

Zeghreit, testing a2.110a: *"make rings 1.5 times wider away from finger tap,
make icons that sit along diamond line sit on it - now there's different space
between such icons and lines of diamond."*

### The reach

`TOOL_RING_R = 160` joins the `Math.max` that decides the radius. Spacing
alone asks for 107 at eight seats, and that was the radius - but spacing is
the wrong thing to size a ring by once every ring fits in eight. At 160 the
thumb is not sitting on the seats, and the model reads through the middle of
the ring instead of behind a wall of them.

**It raises the ceiling and nothing else.** a2.108 shrinks the ring uniformly
to what the screen affords and only then moves the centre, and the band in
which it blooms exactly under your thumb is set by `seatMinR` (88.8), which
has not moved. Measured: the world ring goes 107 -> 160 with the centre band
unchanged at 234px of 512. On a 393px phone the drawn radius is 145.7 at the
viewport centre - `fits` caps it below 160 - and floors at 88.8 in a corner.

**Only rings that carry seats get it.** Add geo and Pivot have none: they
bloom at the viewport centre after the finger has lifted and are dismissed by
aiming past the items, `dist > radius * 2.2`. At 160 that escape becomes
352px, which on a phone is off the side of the screen in every horizontal
direction - the ring could no longer be dismissed by aiming out of it. They
keep the radius their own spacing asks for, which is right for four items.

`TOOL_RING_ARM_PX` (70 flat) became `TOOL_RING_ARM_FRAC` (0.6) with a floor of
dead zone + 20. A mode ring is drawn anywhere from 89 to 160, and a fixed arm
put the commit two thirds of the way out on a small ring and under half way on
a big one - the same gesture arriving at different moments.

### Every seat sits ON the line, and there is one line

The figure had its **corners** on the seats, so each square touched only its
own four and the other square's line passed 0.293R from the rest - at a
cardinal seat that is 31px against a 37px tip, so the line grazes it; at a
diagonal seat 31px against a 26px flat face, so it floats 5px clear. Four
seats welded to the line and four hovering beside it, out of one figure.

**A chord between two points on a circle cannot pass through a third point on
that circle**, so no radius puts corners on four seats and the line through
the other four. The corners move OUT instead: at `ringR * sqrt2` each edge
passes exactly through the centre of the seat between its two corners.
Measured: worst seat-to-its-own-edge distance **0.01px**.

Then, Zeghreit again: *"let's leave only one diamond square - the square
square can be removed."* Two squares cross eight times at eight seats and the
lattice started competing with what it frames. **The diamond stays** - the
square turned 45 degrees, corners along the axes, four edges each crossing a
diagonal seat.

The cost is real and worth stating: with one square only four seats can be on
a line. The four cardinal ones (N, E, S and Delete's own bearing) sit inside
the diamond, short of its corners, on nothing. That is arithmetic, not a
choice - see the chord argument above.

The cut still applies where there is an edge to cut. A missing DIAGONAL
bearing drops its edge and opens the diamond; a missing cardinal one has no
edge to drop, so the World ring's empty seat 4 is told only by the seat that
is not there.

The points reach 1.41x the seat radius - further out than the 14px edge
clearance guarantees - so a point can run off the side of a large ring bloomed
near an edge. Accepted: the diamond is a lattice with no hit area, and a line
cropped by the frame reads as a figure continuing past it.

### Deliberately absent - do not rebuild these

- **The second square.** Removed on the record at a2.111a. Rebuilding it puts
  all eight seats back on a line and puts the crossings back too.
- **Corners on the seats.** That is the 0.293R mismatch above. If the figure
  ever goes back to corners-on-seats, four seats will float beside it again.
- **`stroke-linejoin: miter` on the star.** Every edge is its own two-point
  polyline, so there is no join to miter - and the default BUTT cap left a 1px
  notch out of the outer corner of all four points, exactly where the figure
  should be sharpest. `stroke-linecap: square` extends each end by half the
  stroke, which lands precisely on the point.
- **`#ringStar polygon`.** Nothing has drawn a polygon since a2.111. `fill:
  none` on the polyline rule is still load-bearing: an open polyline fills by
  default in SVG, and the first version painted a black wedge across the model
  over the very gap the figure was cut to show.
- **The flat reach on Add geo and Pivot.** See above - it breaks their only
  outward escape.

## Eight bearings, and doors (a2.110)

The plan is `claude/ring-capacity-and-grouping.md` in the project. This is
what shipped.

### A seat is a DIRECTION now, not a preference

`seat` was 0..13 and only a hint: the ring spread its tools evenly and
rotated the whole circle to the phase that best matched the seats, so a
tool's real angle shifted with the item count. That was the right answer
while a ring could hold thirteen tools - an exact bearing was impossible.

**`seat` is 0..7 now and the angle is literally `90 - seat * 45`.** 0 is
straight up, clockwise, 4 is straight down. A bearing whose tool is
conditional - Object's grouping seat - simply stands empty; the other seven
do not move. That is the whole promise, and `_door_probe.js` section 2
measures it: adding the grouping seat shifts nothing by more than 0.00deg.

The promise is **per ring**. Delete holds seat 4 everywhere, and Extrude,
Bridge and Knife hold one bearing in every ring that has them, but an op
that is top-level in one ring and behind a door in another cannot - Cap,
Set flow and Circularize are all in that position. The code says so rather
than claiming more.

`TOOL_RING_GAP` drops 40 -> 30, which puts eight seats at R=107 with 82.6px
between them against the 68px floor - and leaves a 59px band on a 393px
phone for the ring to bloom exactly under the thumb.

### Doors

A seat with a `door: [...]` array. Pull past **`TOOL_RING_ARM_PX` (70)**
while aiming one and `swapToolRing` repaints the seats **at the same centre
and the same radius**, so a2.108's edge solution holds for both layers and
there is nothing new to clamp. Come back inside the dead zone (26) and the
parent ring returns. The pointer capture, the aim point and the radius all
survive, so the gesture never breaks.

**A door's ops are placed RELATIVE to the door.** Their `seat` counts steps
clockwise from the door's own bearing: 0 straight on, 1 one step clockwise,
7 one step back, 2 two clockwise. `paintToolRing` takes a `spin` and turns
the whole sub-ring onto the door's bearing.

That is the hinge the gesture turns on, and review caught it the hard way.
Placed absolutely, the first op sat at the top of the ring - and since the
arm (70) is INSIDE the ring radius (107), the door always opened before the
finger reached the seat, so whatever the sub-ring happened to put on that
bearing is what a lift ran. Every door promised its first op in its own
second word and delivered a different one: **Knife promised, Collapse run.**
Placed relatively, pulling west toward CUT and simply continuing lands on
Knife, which is the word the closed seat was already showing.

**A door is not an op, and must not look like one.** It draws a second
outline 6px inside the first - a child `<i class="dr">`, not a
pseudo-element, because a2.106 already learned those paint over the inline
content - and it carries TWO words: its own, and the op a lift would run.
It also reports that op's toggle state, which is how Shade still says which
way it is set from behind SURFACE and FINISH.

### The star is cut

With bearings fixed, a ring can legitimately have an empty one. A star drawn
straight through the gap says the seat is merely absent today; breaking the
line says it is not coming. Runs of two or more surviving points are drawn as
open **polylines**, an isolated corner draws nothing.

`#ringStar polygon, #ringStar polyline` share one rule. They must: an open
polyline still FILLS by default in SVG, and the first version painted a black
wedge across the model over the exact hole the cut existed to show.

### The maps

```
VERTEX   0 merge  1 weld  2 connect  3 slide  4 DELETE  5 set flow
         6 circularize   [7 empty]
WORLD    0 add geo  1 pivot  2 snap  3 floor grid  [4 empty]
         5 see-through  6 flat view  7 select mode
FACE     0 extrude  1 inset  2 knife  3 cap holes  4 DELETE  5 bridge
         6 detach   7 SURFACE {shade, flip normals, set flow, circularize}
EDGE     0 extrude  1 bevel  2 loop  3 slide  4 DELETE  5 bridge
         6 CUT  {knife, split, collapse, cap hole}
         7 FLOW {set flow, circularize, mark sharp, crease}
OBJECT   0 duplicate  1 array  2 mirror  3 subdivide  4 DELETE
         5 grouping (conditional)
         6 MESH   {solidify, cap holes, join, separate}
         7 FINISH {shade, smooth by angle, flip normals, clean up, centre}
```

Seven ops are one flick away in every mode - the five or six direct seats
plus each door's first op, which a lift runs. Nothing was lost: `_door_probe`
section 6 checks every key that had a seat before a2.110 against where it
lives now.

Join lost its conditional seat and rides in MESH unconditionally. One layer
down, a seat that answers "select two things first" costs nothing, and a door
whose contents never change is a door you can learn.

### Deliberately absent - do not rebuild these

- **Four categories over the whole ring** (TRANSFORM / BUILD / REMOVE /
  SELECT), which is what the two-layer design doc asked for. It charges every
  op two flicks to solve an overflow of three to six ops in three modes, and
  leaves most sub-rings five-eighths empty. See
  `claude/bloom-two-layer-critique.md` for the numbers.
- **Re-centring the sub-ring on the finger.** The doc asks for it and it
  cannot be clamped: layer 2 opens an arm-length from the origin, so near an
  edge it has nowhere legal to go. Opening at the parent's own centre and
  radius makes the problem vanish.
- **The surface plate and the sunken ghost layer.** Ghosted ops at 24% sit
  exactly where the thumb travels, and showing the LAST door's contents made
  the depth cue depend on history - the opposite of what fixed bearings are
  for. The depth cue lives on the seats that have depth instead.
- **Absolute bearings inside a door.** See above: it made every door lie.
- **The a2.10 phase-fit spread.** Sorted by a 0..13 seat and rotated the
  circle to the best match. It existed because exact bearings were impossible
  at thirteen tools; every ring that has bearings now has literal ones. Add
  geo, Pivot and the empty-scene ring carry no seat at all and still spread
  evenly from straight up.
- **A `polygon`-only rule for the star.** See the black wedge above.

## Merge before you group (a2.109)

The ring can hold **eight seats**, nine at a squeeze. Measured, not guessed:
at R=108 with 52px seats the gap between neighbours is `2R x sin(180/n)`,
and a2.107 fixed the floor at 68px, below which the words touch. Ten seats
give 66.8. Growing R does not help - R=120 buys the tenth seat but leaves
only 51px of band for the ring to follow your thumb, and R=132 pins it to
the middle of the screen, which is what a2.104 and a2.108 were spent
removing. One of the eight is Delete's or empty, so **seven are for ops**.

Against that: Vertex had 7, World 9, Face 11, Edge 14, Object 17.

The first move is not to push the overflow one layer down. It is to notice
that some of it is not extra ops at all - it is one control drawn several
times.

- **Tap / Box / Lasso are one seat** (`selmode`). They are mutually
  exclusive, so exactly one is the current gesture at all times and the
  other two were always telling you what you are NOT doing. The seat cycles
  Tap -> Box -> Lasso -> Tap and its word says where you landed. **World 9 ->
  7, and the whole world ring now fits.**
- **Mirror and Flip are one seat.** Both reflect the selection across
  `primarySymAxis()`; they differ only in what survives. That is a third
  button on a chooser already asking "what should come out of this", not a
  second bearing. The chooser reads Joined / Apart / **Flip**.
- **Group and Ungroup are one seat** (`grouping`) - see below, because the
  rule matters.

`label` may now be a FUNCTION, exactly as `icon` could. Three seats say
different words in different states, and the ring reads a seat's word in
three places, so the unwrapping happens once in **`toolLabel(t)`**, which is
exported for the probes. Anything new that renders a seat's word must go
through it or it will print the function source.

### The world ring left the halves

It was halved: four view toggles in the top arc, three select gestures in
the bottom, mirroring the rails they came from. With the select gestures
down to one seat that read as four items crowded above and one alone below,
so the world ring joined the component rings on the compass - seven seats,
evenly spread, each still pulling toward the direction it always had. Seat 7
(straight down) stays empty: the world ring makes and shows, it never
destroys.

Measured: the world ring's radius drops 148.8 -> 106, and the band in which
it blooms exactly under your thumb goes **190px -> 254px of 512** - half the
screen instead of a third.

`half` and the halved branch of `toolRingAngles` survive, unused, for
whatever wants them next.

### The grouping seat, and the a2.93 rule it must not break

Group and Ungroup shared a seat once and it was wrong. The test then was
"does the selection touch a group", so Group vanished the moment any part of
the selection was grouped and a group of three could never gain a fourth.
a2.93 split them onto two seats.

They share a seat again, on a different test - is the selection **the thing
you would dissolve**:

```
UNGROUP   exactly one whole group, or a single object that belongs to one
GROUP     anything else with two or more selected - INCLUDING a mixed
          selection where some parts are already grouped
absent    a lone ungrouped object
```

`groupingSeatUngroups()` is asked by both the word and the run, so the seat
cannot say one thing and do another. `_out_probe.js` section 36 is the guard:
a mixed selection must say Group, and running the seat must ADD to the
existing group rather than start over.

**Given up:** ungrouping straight from a mixed selection. It was ambiguous
anyway - which group? - and selecting the group, or any one of its members,
still gets there.

### Deliberately absent - do not rebuild these

- **Folding Smooth by angle into the Shade seat.** Built at a2.109, reviewed,
  reverted at a2.109a. One tap shaded smooth and then opened the op bar on
  the angle, which reads beautifully and is wrong twice: `applyPendingOp`'s
  autosmooth branch CLEARS `edgeShade` - the marks `toggleShading` has just
  written - and opens at the op's default 33 degrees. A cube's edges are 90,
  so every one stays sharp: the seat lit up, the toast said "Shaded smooth",
  and the model was pixel-identical to flat. It also wrote two history steps
  for one tap. Anything reviving this has to open the bar at **180** - which
  is what "shaded smooth" MEANS - and push history once. Smooth by angle
  keeps its own seat until it goes behind the FINISH door, where it was
  always headed.
- **Three select seats.** The point of the merge. Two of the three were
  always inert.
- **A live `icon` function on a new seat.** Nothing has read a tool's `icon`
  since a2.107 put words on the seats. The field survives on the older tools;
  adding a live one is data nobody looks at.
- **Ungroup on its own bearing.** Its whole job was working around the old
  shared-seat test. The new test does not need it.

### Where this is going

`claude/ring-capacity-and-grouping.md` in the project has the decided plan:
after the merge pass the overflow is 0 / 0 / 3 / 6 / 6 across Vertex, World,
Face, Edge and Object, and the next version puts it behind **doors** - the
last bearings of the ring opening a four-op sub-ring - rather than behind
four categories over everything. Seven ops stay one flick away in every mode.

## The ring never deforms (a2.108)

The complaint: *"when finger taps close to border it adapting and not looks
good - we have to thought it out, how to keep it structured and not
chaotic."*

a2.104 kept the ring's centre under the finger and pulled any seat that
would have hung off the edge closer in **along its own bearing**. It
reached well and it kept picking honest, but seats clamped by one edge all
landed on the same LINE, so near a border the ring lost its shape - and
once a2.107 drew the eight-point star through those same radii, the whole
figure buckled. A menu whose shape depends on where you happened to press
reads as broken, not as adaptive.

**The ring is now always regular.** One radius for every seat, at every
press point. `seatRadius(angle)` is gone; there is a single `ringR`, and
the seats, the star and `toolRingActive.radius` are all built from it.

Near an edge the ring **shrinks first, and only then moves**:

```
rFit  = min over both axes of ( min(v, span - v) - RING_EDGE_PX - TIP )
ringR = clamp(rFit, min(seatMinR, R), R)
margin = RING_EDGE_PX + TIP + ringR
cx, cy = clamp(press, margin, span - margin)
```

- `rFit >= R` - full size, centred on the finger.
- `seatMinR <= rFit < R` - shrinks uniformly, still centred on the finger.
  This band is new; a2.104 had no shrink at all.
- `rFit < seatMinR` - holds at the floor and the CENTRE moves instead.

The threshold at which the centre starts to move is `RING_EDGE_PX + TIP +
seatMinR`, **exactly what it was at a2.104** - that was the point at which
a2.104's shortest legal seat also ran out of room. So reach is unchanged
and only the deformation is gone.

`_ring104_probe.js` gained the invariant that catches a regression here:
`maxRadiusSpread`, the largest gap between any two seats' radii over nine
press points including all four corners. a2.104 ran to tens of pixels;
a2.108 measures 0.04px on the 9-seat world ring and 0.05px on a synthetic
14-seat ring, against a 1px tolerance for sub-pixel layout. Spill 0.0,
bearing error 0.01deg, minPitch 68.0 (the floor), both rings.

### Known, not fixed: a crowded ring pins to the middle of a phone

`seatMinR` is derived from the ring's angular gap - the radius at which
neighbouring seats still clear each other by 68px. `R` is capped by `fits`,
what the ring can be while centred. When a ring has enough seats that
`seatMinR` reaches `R`, the shrink band closes, `margin` reaches
`min(w,h)/2`, and `place()` clamps the centre to a single line - the ring
blooms in the middle of the short axis wherever you press, and the finger
can end up outside it.

On a 512-wide layout there is room: the 9-seat world ring leaves a 190px
centre band, a 14-seat ring 106px. On a real 393px phone the 13/14-seat
Vertex/Edge/Face rings do not: `fits` is 145, the spacing floor wants 142
to 153, and the band closes to single digits or nothing. **This is not new
at a2.108** - `margin` has had the same definition since a2.104 - and it is
why `placeRingAim`'s "seat is behind the finger" guard is load-bearing
rather than defensive.

It is not fixable by geometry. Fourteen seats at a 68px pitch need a
952px circumference, so a 152px radius, so a 406px half-width before the
edge clearance - wider than the phone. Something has to give, and the
options rank: a ring that teleports (worst, current), seats that crowd
(cosmetic - picking is by DIRECTION, so a tight pitch costs legibility and
nothing else), seats clipped at the edge. **The real fix is fewer seats per
ring**, which is what the planned category rings are for.

### Deliberately absent - do not rebuild these

- **Clamping seats individually along their own bearing (a2.104).** This is
  what a2.108 removed. It answers "does every seat stay on screen" and
  "does every bearing survive" correctly, and still looks wrong, because it
  answers them one seat at a time.
- **Making the star a separate, fixed-size figure so it stays square while
  the seats clamp.** Then the seats stop sitting on it, which is worse than
  a star that flexes: the star's whole job is to say the seats belong to
  one ring.
- **Letting the ring shrink below `seatMinR` to keep the centre under the
  finger.** Tried on paper: at 14 seats on a phone the pitch falls to about
  36px against 52px seat boxes, so the seats overlap outright. The seat
  count is the problem, not the floor.
- **`RING_EDGE_PX` and the literal `14` in `fits`.** These are the same
  number by necessity - `place()` only stays sane while `margin <= span/2`
  - and `fits` now says so.

## Words on the ring, the star under them (a2.107)

Zeghreit's direction: the seats say what the op IS, the ring gets the
lattice the canvas draws under it, and the view cube goes back to the size
it was but in the chrome's own greys.

### The seat is a word

a3.0 2.5: *"Words, never icons: at this size a word is faster."* Every seat
carries `tool.label` in a `.tx` span at 9px/700 - 1.2's 11px scaled to a 52px
seat rather than the spec's 64, and exactly the floor 1.4 sets.

**This reverses "Tool labels in the ring" in the deliberately-absent list,
and the entry stays because the failure it records was real.** Those labels
were laid out BESIDE the seats, so their width was unbounded and they pushed
the icons into each other. A word inside the seat cannot be wider than the
seat. The rule that keeps it true is in the geometry, not in the CSS: the
ring's clamp floor went from a 56px chord to **68**, because a seat carries a
64px word now and two seats pulled onto the same line by the a2.104 edge
clamp had overlapping labels while their boxes did not. `_ring104_probe`
measures it - `minPitch` is 69.7 at fourteen seats, against 57.4 before.

- The label is **64px wide inside a 52px box**, on purpose: the seat is that
  box turned 45 degrees, so through its middle the diamond is 73.5 across.
  It wraps at spaces only - `overflow-wrap: anywhere` was breaking EXTRUD/E
  and CIRCULA/RIZE, and a word split across two lines is slower to read than
  the glyph it replaced, which is the whole reason for the change.
- **`#ringLabel` stays** and is not a duplicate: your finger is ON the aimed
  seat. The one word the ring cannot show you is the one under your own
  thumb, and that is the one the label carries, outside the ring, at size.
- **DELETE gets a plate.** The hazard stripe has a 5px period, so every 9px
  glyph crossed a band boundary - 11.2:1 on the dark stripe, 4.4:1 on the
  light one. Invisible behind a 20px icon, not behind a word.
- Two states had leaned on the glyph and had to be given words' equivalents:
  `.hub-item.on` set `color` on the SEAT, which a declaration on the span
  beats, so an "on" toggle silently lost half its cue; and **Shade** carried
  its state entirely by its icon being a function - the only tool in the file
  whose glyph was evaluated per bloom - so it now has the `on:` predicate
  every other toggle already had.

`tool.icon` is dead data now and is kept deliberately: it is the only record
of which glyph belongs to which op, and the ring may want one beside the word
later. `icon()` itself is still the drawer's and the help card's.

### The lattice

`#ringStar` is an inline SVG inserted as the ring's FIRST child, so the seats
lay on it. Two closed polygons through alternate seat centres - which at
eight seats is the spec's *"two 210px squares, 0 and 45 degrees, through all
8 centres"*, and at any other count is the same construction: every second
seat, twice round. Below six seats it is one polygon through all of them.

Drawn from the MEASURED centres, so a seat the edge clamp pulled in takes the
lattice with it and the seats keep sitting on their own corners. Stroked in
the mode's hue at 45%: through the ring, not behind it, so the model still
reads. `closeToolRing`'s `innerHTML = ''` takes it with everything else.

### The view cube is chrome

**128 again, at 6.1's place.** 56 is the spec's size and it is the one number
in 6.1 that fights 1.4: three faces in 56px is a 24px tap target against a
44px floor, and the baked labels stop being readable at all. What the spec is
really saying is the POSITION - under the locks, so mode, lock state and
camera read as one column - and that survives at any size.

Its labels were the AXIS colours, which made a 128px control the only place
in the chrome carrying the viewport's vocabulary. Those three colours mean X,
Y and Z during a drag; a face of this cube means look-down-this-axis. Wearing
the same colours claimed they were the same statement. Faces are `--panel2`,
lines `--line`, labels `--text-dim`, and the axis colours are left to say the
one thing they say.

Two things moved out of the bigger cube's way: the readout's max-width (152
of margin, not 80) and **the toast**, which is centred with no width cap and
was crossing the cube's disc for any message over about 22 characters - at
z 33 against the cube's 12, so it painted over the faces. Its row is
`--edge + 118` now, under the cube.

### Deliberately absent - do not rebuild these

- **A glyph as a tool's only state cue.** Shade was the last one and it broke
  the moment the glyph became a word. If a ring tool has a state, it carries
  `on:`.
- **A label wider than the ring's clamp floor.** The two numbers - `.tx`'s
  width and `(TOOL_RING_ITEM + 16)` in `seatMinR` - are one decision written
  twice. Move either and move both.


## The a3.0 frame - one row, two corners, two edges (a2.106)

Step 2 of the a3.0 visual pass, and the big one: section 6.1 of the spec is a
list of layout constants, and this version makes the app match them. Measured
by `_a30_probe.py` (`_a30_out.txt`), which reads every one of them off the
live DOM and prints the delta - the numbers below are its output, not
intentions.

| 6.1 | where it is now |
|---|---|
| hue strip `top 59 . h 3` | `#modeBar`, at the safe-area top |
| drawer frame `14, 66 . 44x44` | `#btnMenu`, FIRST in the row |
| mode block `60, 66 . h 44 . cut 10` | `#hdrMode`, glyph + word |
| axis locks `right 14, 66 . 3x44 gap 2` | `#symAxes`, each with the 6px square |
| readout `14, 118 . mono 10` | `#toolChip` |
| view cube `right 14, 130 . 56x56` | under the locks |
| edge tabs `top 300 . 26x64` | outliner LEFT, materials RIGHT |
| undo/redo `14, bottom 38 . 56x44` | `#quickRow`, bottom LEFT |
| hub `right 14, bottom 34 . 64` | `#hubBtn`, bottom RIGHT, a rhomb |

### A ROW, NOT A BAR

a2.100 brought a top bar back on Zeghreit's direction and it paid for
itself; 6.1 takes the bar away again and keeps everything it carried. The
three controls float on one 44px line with the viewport behind them, so
a2.48's original complaint - a band that costs the model 7.2% of the screen -
is answered outright: there is no band, only the controls.

- `#hdr` is `pointer-events: none` with its children taking events back. A
  transparent flex row spanning the screen would otherwise swallow every tap
  in the gap between the mode block and the locks - a 44px dead stripe across
  the model. **A tap in that gap now deselects, like any other tap on empty
  space.** That is 4.1's grammar and it is deliberate.
- The mode block wears the GLYPH, not the word "Mode" (a3.0 1.3: five
  glyphs, plus square-in-square for Soft). It says what the caption said in
  the space of a square, which is what buys the word room to be 15px inside a
  44px block.
- `--hdr-h` is 73 and no longer means "the bar's height": it is the DEPTH OF
  THE STRIP from the safe-area top - the row runs 7..51 and the readout
  59..73. The view cube hangs below that on the right (71..127) and is the
  one thing `--edge` does not clear, which is why the readout carries its own
  max-width.
- `--rail-top` is gone. The two tabs are opposite each other at 241, not
  stacked on one rail, so there is no first seat for a second to follow.

### THE TWO CORNERS SWAPPED

a3.0 1.5's thumb map is the whole argument. The hub is pressed many times a
minute and belongs in EASY - bottom right, where a right thumb reaches
without moving the hand. Undo is found low-left by the other hand.

The hub is a **64px rhomb with a double line**: `::before` is the clipped
fill, `::after` is a square turned 45 degrees whose border draws the outer
diamond with no path maths (side 53.7 puts its tips 38 from the centre, 6px
outside the fill's 32). Soft mode adds an `outline` on that ring - a third
diamond line, not the inset shadow it used to wear.

`#btnHelp` left the lower-right corner - "the one corner nothing else has
claimed" - because the hub claims it now, and is a row in the drawer, which
is where a3.0's screen 09 puts it.

### What the probe caught that the eye did not

- The cube's canvas stayed **128px inside a 56px box**. `setSize` writes
  inline width/height, and an inline style beats the stylesheet's
  `width: 100%`, so the picture hung 72px off the right of the screen. It
  reads the element now, and `_a30_probe` has a `cube_canvas` line because a
  box is not a picture.
- Rotating the hub's box made its bounding rect **90.5px**, so it sat at
  `right: 14` while its actual point was 1px off the glass and its bottom
  point hung 13px past the bottom. Clipping instead of turning fixes it at
  the root.

### What review caught that the probe did not

Every one of these is something that measured itself against where the hub
used to be, and none of them is subtle once named:

- The hub kept a2.99's **cut-corner clip-path**, which shaved all four points
  of the new rhomb flat and cut the outer ring into four pieces. The clip is
  still there and still doing its other job - keeping the empty corners of
  the box from taking taps meant for the model - but as a rhomb at 110%, so
  the ring's tips stay inside it.
- `.soft`'s **inset shadow follows the border BOX**, which is a square: it
  drew a square halo floating around a diamond.
- The op deck, the geo bar and the pivot bar sat at `--edge-b + 56`, which
  was exact when the hub was 56 tall. **72** is a 64px rhomb plus the 6px its
  ring stands off; the first-run chip moved with them.
- Both shelves' `max-height` were derived from tab tops of 98 and 162. The
  tabs are at 241, so a full shelf ran **past the bottom of the screen** and
  over the hub and the undo row. Both are `100vh - 321px` now - 241 of tab
  plus 80 of clearance - derived from the tab's own top so the two cannot
  drift apart again.
- `_theme`'s `4.*` lines read `#hubBtn`'s own `backgroundColor`, which is
  transparent now that the fill lives on `::before`: all four hues measured
  1.2:1. **The same blind spot the delete seat had at a2.105** - a probe that
  reads one layer and a control that paints on another.

### Deliberately absent - do not rebuild these

- **The 44px touch slop on the edge tabs.** It was a pseudo-element hanging
  outside the tab, and the tab carries a clip-path for its cut corner - which
  clips HIT TESTING as well as paint, so the overhang never existed.
  Deleted rather than left as a rule that looks like it does something. What
  remains is 6.1's 26px, under the 44px floor 1.4 sets: the one place the two
  halves of the spec disagree. The tab is the one control where the edge
  helps - a thumb entering from the bezel is already on the line and only has
  to stop - and widening it means moving the cut off the element, which is
  its own change.
- **A screenshot at 430px.** `_uishot97.py` shoots at 512 since a2.106:
  headless Chrome clamps the WINDOW to about 500 but lays the page out at its
  own minimum, so a 430 capture was the left 430 of a 512-wide page. The last
  axis lock and the whole view cube were cropped out of every shot, which
  reads as a layout bug and is not one. (The rounded dark badge in the
  bottom-right of every capture is Chrome's own overlay, not ours - nothing
  in this app has a corner radius.)


## The a3.0 palette - warm goes cool, Face goes violet (a2.105)

Step 1 of the a3.0 visual pass, and the same shape a2.97 took: one patch,
the whole app at once, judged on the phone. The a3.0 spec keeps every rule
a2.97 established - one hue at a time, dark text on every hue, zero radius,
2px rules - and changes the temperature.

| token | a2.97 | a2.105 |
|---|---|---|
| `--bg` | #0b0c0b | **#0b0d10** |
| `--panel` | #141312 | **#14171c** |
| `--panel2` | #201e1d | **#1b1f25** |
| `--line` | #4a4544 | **#454d56** |
| `--text` | #f3f2f2 | **#eef1f4** |
| `--text-dim` | #9b9797 | **#8b939c** |
| `--accent` (object) | #bab6b6 | **#d5dce4** |
| `--signal` | #ff563c | **#ff5230** |
| `--danger` | #ff4d2e | **#ff5230** - the signal |
| vertex / edge / face | #d6ff4a / #4ee3ff / #ff6fc2 | **#d9ff3d / #46e1ff / #b48cff** |

Two of these are decisions rather than adjustments:

- **Object mode is WHITE.** a3.0: "a fresh scene has no colour in it". Still
  no hue, but a near-white instead of a mid grey, so the neutral accent is
  unmistakably an accent. a2.97's reason for it not being a grey still
  holds and is why it cannot go back: at #8d94a3 the accent and the dim text
  were the same colour, so every "this one is chosen" cue that works by
  colour said exactly what "not chosen" said.
- **Face is VIOLET, and danger is the signal.** a3.0 asks for matched
  lightness - no kind shouting over another - and the magenta sat brightest
  of the three while meaning no more. Moving it also removes the reason
  danger was held apart from the signal as its own orange: two warm hues a
  glance apart, kept separate so neither read as the magenta. One signal
  colour now, and **the HATCH is what says danger**.

**That last rule had to be made true.** Review found `.hub-item.danger.active`
replacing its stripes with a flat `--danger` fill - so an ARMED Delete seat
was pixel-identical to the Apply slab, and the ring blooms over a live op
bar, so the two can be on screen together. The gradient now paints OVER the
fill instead of being replaced by it. `_theme_probe` gained
`3.delete_striped`, which reads `backgroundImage` in both states:
`3.delete_contrast` could never have caught this, because a gradient leaves
`backgroundColor` transparent and it passes at ~18:1 whatever the seat looks
like.

### What a hex sweep misses

Scanning for the old values found four things `:root` does not reach, and
each missed for its own reason - worth knowing before the next palette step:

- `<meta name="theme-color">` - the browser paints it behind the page and
  around the notch before a pixel of ours exists.
- `THREE.HemisphereLight(...)` and the view cube's own `LineBasicMaterial` -
  literals written out a second time rather than read from `THEME` /
  `CUBE_FACE_LINE`, and what the FIRST frame uses.
- `button:hover` / `button:active` - the press states for every plain button
  in the file, warm greys sitting outside the token system entirely.
- `#opOk::after` - written `rgb(11 12 11 / .45)`, in decimal, so no hex
  search finds it.

The sweep that catches all of these is: every `#rrggbb` and `0xRRGGBB` in
the file (skipping the font line), flagged where R - B > 6.

### Contrast, measured

`--text` on `--bg` 17.2:1 · `--text-dim` on `--panel` 5.8:1 · `--line` on
`--panel` 2.09:1 (up from 1.97) · `--on-accent` on the four accents 14.1 /
17.0 / 12.5 / 7.5:1 · on `--signal` 6.0:1 · op-bar chip `#666d76` 3.7:1 on
its track with `--text` at 4.6:1 on it · the four `--accent-dim` tints 1.44 /
1.38 / 1.47 / 1.32:1 against `--panel2`, all inside the stated 1.3-1.5 band.

### Deliberately absent - do not rebuild these

- **`--line-dim` (#2a3038).** a3.0 names a quieter rule for something that
  divides rather than encloses. Declared once, then removed: nothing in the
  file divides that way yet, and a token no rule reads is one more thing to
  keep true for no benefit. Bring it back WITH its first consumer.
- **Cooling the axis guides, the crease mark, or the lighting presets.**
  X/Y/Z (#C85A47 / #E8C87A / #4A82B8), crease #ff7a45 and the preset ground
  colours are the VIEWPORT's vocabulary, decided on the record and separate
  from the chrome by where they appear. Face violet clears the Z blue by
  1.7x in luminance and 50 degrees of hue, and they never share a surface.


## The ring blooms at the finger (a2.104)

> **Partly superseded by a2.108.** The centre placement and `seatMinR` below
> still stand; the per-seat `seatRadius(angle)` clamp does not - the ring
> shrinks uniformly instead. Read "The ring never deforms" first.

From the a3.0 spec critique (`claude/a3.0-spec-critique.md`): the ring's
promise is that it opens under your thumb wherever that is, and the code
was not keeping it.

`margin` used to be `R + TOOL_RING_TIP + 4` - the whole ring held clear of
the edge. On a 393px viewport that leaves a legal band about **13px wide**
for the centre, so the ring bloomed in the middle of the screen almost
wherever you pressed. a2.98 added the separate aim point precisely to keep
picking honest when it did; that patch is still right and still needed, but
it was treating the symptom.

**A seat is picked by DIRECTION, so how far out it sits carries no
information.** That makes the seat, not the ring, the thing that can give
way:

- `RING_EDGE_PX` (14) is the clearance every seat keeps from the viewport
  edge.
- **`seatMinR` - the floor - cannot be a flat number, and review caught this
  before it shipped.** Seats clamped by one edge all land on the SAME line,
  and along that line their spacing is only what the ANGLE between them
  buys. At fourteen seats and a 69px floor that is ~18px, and the icons sit
  on top of each other. So the floor is computed per ring, from the ring's
  own tightest angular gap, as the radius at which neighbours still clear
  each other by 56px centre to centre (against `ideal`'s comfortable 92) -
  never below `TOOL_RING_SEAT_MIN_R` (dead zone + tip + 6 = 69), which keeps
  a pulled-in seat outside the dead zone so it is never read as a cancel.
  Two seats both on the floor are exactly 56px apart and moving either one
  further out only increases that, so the floor alone guarantees the
  spacing whatever shape the clamp draws.
- `margin` is `RING_EDGE_PX + TOOL_RING_TIP + seatMinR`, which depends on
  the shortest SEAT and not on `R` at all - and because the two are built
  from the same number, the room in every direction is at least `seatMinR`,
  so the floor can never fight the edge clearance. A ring that fits is a
  perfect circle again. On a 393px screen the legal band for the centre
  goes 13px -> **~40px for the 14-seat Edge ring** and much wider for the
  smaller rings (the 9-seat world ring measures 45% of the viewport).
- `seatRadius(angle)` inside `bloomToolRing` returns that bearing's own
  radius: start at `R`, then for each of the four sides limit `r` to
  `room / component` for the seats travelling toward it. A seat parallel to
  an edge is not constrained by it, hence the sign test.
- Every seat carries its radius: `itemEls.push({ el, tool, angle, r })`.
  `placeRingAim` and `placeRingLabel` read `it.r`, not `toolRingActive.radius`.
  `toolRingActive.radius` stays the NOMINAL radius and is still what the
  sticky ring's `dist > radius * 2.2` "none of these" test uses. That test
  is the one latent gap: it would be wrong for a STICKY ring bloomed off
  centre, and both sticky callers bloom at the viewport centre today.
- **The aim line is never drawn backwards.** With the centre pushed off the
  finger, a seat on that side can end up BEHIND the finger relative to its
  own bearing - you slide right to light a seat drawn to your left. The
  highlight is still right, but the line read as a drawing fault, so
  `placeRingAim` bails when `cos(bearing - it.angle) <= 0`.

What this looks like: near an edge the ring's outline flattens against that
side, because every seat clamped by one edge lands on the same line. It
reads as the ring meeting the wall rather than fleeing it.

Verified by `_ring104_probe.py` (`_ring104_out.txt`), which blooms both the
9-seat world ring and a synthetic 14-seat ring (the densest the app draws)
at the centre, the four edges and the four corners, and checks the four
things a screenshot cannot:

- **max spill past the 14px margin = 0.0px**
- **max bearing error vs the unclamped reference = 0.01 deg** - clamping is
  purely radial, so picking is untouched
- **min drawn distance between any two seats = 57.4px** at 14 seats, against
  the 54px floor and the ring's own 91.3px at rest. This is the check that
  would have caught the flat-floor bug, and it is why the probe carries a
  dense ring it never sees in normal use.
- the legal band for the centre, measured by blooming across the viewport
  rather than derived

### Deliberately absent - do not rebuild these

- ~~**Shrinking `R` when the ring is near an edge.** Does nothing for the
  problem: `margin` no longer depends on `R`.~~ **SUPERSEDED at a2.108** -
  shrinking `R` is now exactly what happens, and the per-seat clamp
  described above is gone. The reasoning was right about `margin` and wrong
  about the goal: `margin` not depending on `R` is what makes a uniform
  shrink FREE, not what makes it pointless. See "The ring never deforms".
- **An elliptical or squashed ring.** Anisotropic scaling moves a seat's
  ANGLE, so the drawn position and the picked bearing stop agreeing. Radial
  clamping is the only shape change that leaves picking alone.
- **Dropping or re-ordering seats that do not fit.** The ring's shape is
  what the hand learns; a seat that moves closer is still the same seat in
  the same direction.
- **A flat pixel floor for `seatMinR`.** Tried, reviewed, replaced before it
  shipped - see above. Any future change to the floor has to stay a function
  of the angular gap, or the dense rings overlap again.


## The rail, and the deck on the bottom row (a2.103)

Zeghreit's direction (2026-09-03): the header keeps the mode; the LEFT edge
is the rail that carries every shelf, so the right edge holds only the view
cube; and the op deck sits on the bottom row.

- **`--rail-top`** = `hdr-h + 40 + safe-top` (under the readout). Seat 1 is
  the outliner tab (`#outFly`), seat 2 the material tab (`#matFly`) at
  `--rail-top + 64`. Both tabs are 44x56, edge-tucked on the left.
- **Both shelves open as ROWS beside their tab**, never under it - under it
  would cover the other seat. `#outFly.open` is `flex-direction: row`
  (z 26 over the material tab's 25); `#matFly.open` already was.
- **The material fly-out is the mirror of a2.63**: tab welded as the tray's
  LEFT shoulder, tray borderless on the left, `--mat-max` = 100vh - 234
  (top 162, 72 of clearance above the bottom row). `#matEditor` opens inside
  the tray, to the right, as before.
- **The a2.65 rule about the left column is superseded** - the rail IS a
  column, by decision. `_theme` 9.left_column_depth now accepts three deep
  (header + two seats) under y 240. The long comment above the (now empty)
  landscape block describes the pair-beside-the-cube layout that no longer
  exists; the landscape overrides are gone because the header cells and the
  rail are the same in either orientation.
- **The inspector** moved right of the rail: `left: 60px` (44 of tab, 8 of
  air, 8 of margin).
- **The op deck, the geo bar and the pivot bar sit on the bottom row**:
  `bottom: var(--edge-b) + 56px` (the hub's height), the pivot bar 10px
  higher. The deck's lower rule meets the hub's top edge. `#firstHint`
  (`edge-b + 62`) is covered while a deck is up - it is shown once, before
  any op, and dismissed by the first ring.
- Regression: 30/32 identical; `_theme` moves on the shelf's box (now x
  0..128) and the column depth; `_imp` is the CDN flake.

## Drag anywhere sets the amount (a2.102)

The canvas's argument (design-pass-plan.md, decision E): while an op is
being dialled in, the amount is set by dragging ANYWHERE on the viewport -
the pivot marker's own rule - so the slider is a readout you can also grab.

- **The gesture**: one finger on the viewport, NOT on the selection (that
  press is `directCandidate`), while `App.pendingOp` is open, not live, and
  has a range (`amountDragEligible`: slider visible, `activeRange` finite).
  Decided on travel like every candidate: past `dragStartPx` it is
  `amountDrag`, `orbit.enabled = false`, and pointer X sweeps the ACTIVE
  range across the viewport's width, snapped to the op's step, through
  `setPendingAmount(v, true)` - byte-identical to what the slider's `input`
  does. `endAmountDrag()` re-enables orbit and flushes the deferred apply.
- **A still tap is still a tap** (and `handleTap` already refuses to change
  the selection under a pending op). **Two fingers are the camera**: the
  second finger's pointerdown ends the drag beside the other teardowns.
  **Mouse: primary button only** - a right-drag stays OrbitControls' pan.
- **The world ring does not arm under an amount-bearing deck.** A slow start
  on empty space is now a common way to begin setting the amount, and Add
  Cube in the middle of a bevel is not what a pause should mean.
- **Region select loses to the amount** while such an op is open. The
  `boxDrag` record armed on the same press is dropped by `endAmountDrag`,
  or it would block the next direct drag (pointermove gates on `!boxDrag`).
- `endAmountDrag` runs from: lift, the second-finger branch, `pointercancel`
  (NOT `pointerleave` - a mouse crossing the canvas edge is not an end), and
  `hideOpBar` - so Escape, confirm, a mode switch mid-drag never leave orbit
  off behind a finished op.
- **The live extrude is untouched**: its height is pulled by dragging the
  section itself.
- The deck says so: `#opHint` "DRAG ANYWHERE TO SET" beside the name, mono,
  hidden with the slider (`refreshOpAmountVisibility`, the Mirror chooser,
  the Knife bar) and below 520px, where the head had no honest room for it.
- **Probe: `_amt_probe`** (suite index 31), 20 assertions driving the
  controls with synthetic pointer events: arm, threshold, engage, mapping,
  clamping at both rails, tap survival, two fingers, no-op ineligibility.
- `__kubik` exports `amountDragEligible`, `endAmountDrag`, and getters for
  `amountDrag` / `amountCandidate`.

## The design pass, step 5 - the panels (a2.101)

The drawer, inspector, help card, material shelf and outliner in the same
language. The canvas never drew these; this is the vocabulary applied.

- **No blur anywhere.** `#scrim`, `#helpOverlay` and `#inspector` lost their
  `backdrop-filter`. Two reasons that agree: the canvas draws with rules,
  never haze; and a backdrop blur over a live WebGL canvas is recomposited
  on every rendered frame (it was on performance-a2.96's list). The
  `.surfacing/.submerging { backdrop-filter: none }` rule is now a no-op
  and stays only as a guard.
- **Mono caps for every heading and readout**: `.drawer-title`, `#status`,
  `.insp-head` (inspector and help), `.mat-card` labels.
- **The brand** is "KUBIK." at 18px/800 with the full stop in the signal,
  the version beside it in mono. The stop is the version span's `::before`
  - generated content is not textContent, so `checkForUpdate`'s comparison
  of `.brand span` is untouched. **Do not move the version out of that
  span.**
- **The inspector** carries a 3px `--accent-mode` rule down its left edge -
  it belongs to what is selected, and says so the way the header does.
- **The applied material wears the signal** (`.mat-card.active` border and
  the `.mat-edit` pencil, now square): applying is an action taken, not a
  mode you are in (decision A).
- Regression: 30/32 identical; `_theme` 11.tab_box moves 3px on the tray
  height (mono labels are shorter).

## The design pass, step 4 - the header (a2.100)

**A top bar is back, on Zeghreit's direction** (his screenshot of the
canvas's 2c header, 2026-09-03). a2.48 deleted one for costing 7.2% of a
phone screen to hold a hamburger, a wordmark and a status line; that
reasoning still stands and is still in the file. This bar is different in
kind: it CARRIES the menu button, the symmetry axes (which were a 44px strip
under the cube) and the tool readout, so most of the band it takes is band
those already took. `#hdr`, 58px including its 2px bottom rule, plus the
safe-area top as padding.

- **The slab** (`#hdrMode`): "MODE" in mono caps over the mode word,
  `--accent-mode` fill with dark text, right edge cut on a diagonal. It is a
  BUTTON: the same tap as `#hubBtn` (cycleEditMode), so the mode can be
  changed at either end of the screen. `refreshObjComponentBtn` writes the
  word; **soft goes in the small line ("SOFT" over the mode), never in the
  word** - the reviewer measured "vertex soft" pushing the menu cell off a
  390px screen. The slab can shrink (`flex: 0 1 auto; min-width: 0`) and
  clips with an ellipsis; nothing else in the header can.
- **The cells**: `#symAxes` X / Y / Z, 56px each, rules between, then the
  menu `#btnMenu` as the last cell. A lit axis is `--accent-MODE` (ungated)
  on its tint with a 3px inset underline - the gated `--accent` read 1.5:1
  in Object mode.
- **The readout** (`#toolChip`) hangs under the bar, flush left, `--text-dim`
  mono caps: "MOVE · AXIS · 1 FACE · CUBE 3". `refreshToolIndicator` now
  appends the selection count (component modes; "N objects" for a
  multi-select in Object mode) and the SELECTED object's name - not the
  active one: `clearObjectSelection` leaves `activeObjectId` standing, and a
  name with nothing selected is not what a drag will touch. Names are typed
  by the user and go through `textContent`. `refreshUI` calls it, so it
  tracks every selection change. It stops 136px short of the right edge
  (the cube) and clips with an ellipsis.
- **`--edge` includes `--hdr-h`** (58px), so the HUDs, the inspector, the
  toast and the pivot chip stack under the bar without knowing it exists.
  `#viewCube` is at `--hdr-h`; `#outFly`'s tab at `--hdr-h + 40` (under
  the readout); `#matFly` keeps 194, which clears the cube's new bottom (186)
  by 8px - its landscape `top: 132` override is GONE, it was written against
  a cube at `top: 0` and would have put the tab back on the cube's faces.
- **`#modeBar`** (the 3px mode stripe) is the header's bottom rule now, at
  `--hdr-h - 2px`, z 16 over the bar's 15. Under the bar it was invisible.
- The pointerdown guard that keeps a tap on chrome from reaching the model
  lists `#hdr`.
- `_theme_probe.js` section 9 re-baselined: the axes are measured against
  the menu CELL and "clear of the cube" either side; the left-column depth
  is measured from the header's bottom-left, not the menu button, which
  now sits at the right. `_piv` line 15 moves because the readout carries
  the object name.
- **Known**: `frameBox` centres on the full canvas, so a framed model sits
  ~29px above the centre of what is visible under the bar.

## The design pass, step 3 - the op deck and the bottom row (a2.99)

The canvas's 2b op deck on the app's own controls. Same ids, same handlers,
same slot above the thumb row.

- **`#opBar` is a full-width deck**: `left/right: 0` with the safe-area
  insets as PADDING (so it stays welded in landscape), `--panel` ground,
  rules top and bottom only, and a 6px **hazard band** (`--hazard`, signal on
  panel at 135deg) along its top edge via `::before`. `#geoBar` wears the
  same clothes, as its comment always claimed.
- **The rows are in the MARKUP now**: `#opHead` (numeral `#opValue`, name
  `#opLabel`, slider) and `#opCells` (chips, toggle, stepper, then
  `#opCommit` = Cancel + Apply). The first cut re-sequenced the old flat
  flex row with `order` and auto margins; the reviewer measured Cancel on a
  different row from Apply, in the wrong order, in every op with chips, and
  the deck at 231px. `#opCommit` is one flex group with `margin-left: auto`,
  so the pair can only ever wrap TOGETHER. Any probe that walked
  `#opBar.children` would see two children now; none did.
- **The numeral**: `#opValue` is 36px/800, 118px wide, still the same text
  input. Widest readout the app makes is "0.0002" (Merge by distance, four
  decimals) at 106px. **An input scrolls rather than overflows**, so a wider
  readout would clip silently - keep the width honest if a new op needs
  more digits.
- **The name**: `#opLabel` caps 13px/800 with a `--signal` full stop from
  `::after` ("INSET."). Same on `#geoLabel`.
- **Apply** (`#opOk`) is the slab: `flex: 1 1 96px`, max 220px, glyph left,
  a hatched 22px end via `::after`. `#geoDone` matches. **Cancel** is the
  44px cell before it.
- **The slider knob is a diamond** (18px, `rotate(45deg)` on the thumb
  pseudo; WebKit may ignore the transform, leaving a square, which is fine).
- **The deck rises instead of scaling**: `deck-surfacing` / `deck-submerging`
  override the animation-name of `.surfacing` / `.submerging` on `#opBar`
  and `#geoBar` - the full-bleed edges pulling 11px off the screen and
  snapping back read as a bug. The id outranks the reduced-motion class
  rule, so the deck carries its own `animation: none` there.
- **Bottom row**: `#hubBtn` is a 56px square with the right edge cut
  (`clip-path` at 88%, not the canvas's 82% - the cut is empty hit area
  that falls through to the canvas, so it is kept small); `.soft` rings it
  from the INSIDE now (outer shadows are clipped). `#quickRow` is one
  bordered block of two borderless cells with a rule between. `#btnHelp`
  square.
- **`#toolChip`** is `--mono` caps, 11px, .06em. It overlapped the view cube
  by 18px on a 360px screen before this and by ~25px now - `pointer-events:
  none`, visual only, and the spine (design-pass-plan.md decision F) will
  move it anyway.
- Tokens added: `--mono`, `--hazard`.

## The design pass, step 2 - the diamond ring (a2.98)

The canvas's 2b ring. Geometry untouched - same seat angles, same radius
rule, same pick-by-angle, same hold-aim-lift - only the picture, plus two
feedback elements the canvas argued for.

- **A seat is a diamond**: the 52px `.hub-item` box is `rotate(45deg)` and
  `.ic` is turned back. Layout maths unchanged; the TIP now reaches
  `TOOL_RING_TIP` = 37px from the centre instead of a disc's 26, and three
  clearances read it: `fits` (edge), `margin` (the centre clamp, was R+30,
  now R+41) and `RING_LABEL_GAP_PX` (16 -> 27). At 13 seats on a 360px
  viewport neighbouring tips touch; the ring picks by direction, so that
  costs nothing but looks.
- **Delete wears hazard stripes**: `repeating-linear-gradient(135deg,
  --danger-dim, --danger-band)` drawn in the box's frame, which the rotation
  turns horizontal. `--danger-band #c4402a` is a third danger token because
  the dim alone against the panel was a 1.5:1 texture nobody would see. The
  glyph is `--text` on it, not `--danger`.
- **The reticle is the dead zone made visible** - a 37px diamond whose tips
  sit at `TOOL_RING_DEAD_ZONE_PX` (26), at 55% opacity. **It is drawn at the
  AIM POINT, not the ring's centre**: near an edge the clamp moves the ring
  but the bearing is still measured from the finger (`aimX/aimY`), and a
  reticle at the centre would lie in exactly that case.
- **The aim line** (`#ringAim`, `placeRingAim`) runs from the aim point to
  the lit seat's near edge, worked out per bearing (tip on the axes, flat
  side on the diagonals). Shown only while a seat is lit; `closeToolRing`'s
  `innerHTML = ''` takes it with everything else.
- `#ringLabel` is uppercase, 11px/700, .08em, and now clamps VERTICALLY as
  well as horizontally - a seat straight up put the label's centre 53px
  above a ring kept 41px from the edge.
- `radial-pop` carries the rotation in both keyframes. Any future
  reduced-motion rule for it must be `animation: none`, never
  `transform: none`, or the seats un-rotate.
- `.hub-item .tx` is dead (seats are built with `.ic` only) and would render
  at 45 degrees if revived.
- Screenshots: `_uishot97.py` gained `ringaim` (a synthetic pointermove on
  `orbit.domElement` lights a seat).

## The design pass, step 1 - tokens (a2.97)

The first of a planned series that brings the Claude Design canvas into the
app. The plan, the token map, Zeghreit's decisions and the shipping order are
in the project doc `design-pass-plan.md`; the canvas's own text is in
`design-canvas-notes.md`. **Read the plan before touching any chrome.**

- **Palette is the canvas's Turn 2**: `--bg #0b0c0b`, `--panel #141312`,
  `--panel2 #201e1d`, `--line #4a4544`, `--text #f3f2f2`, `--text-dim
  #9b9797` - warm near-blacks, not blue-greys. `THEME.bg`, the grid, the
  unselected vertex/edge greys, the view cube's face and edge colours and the
  hover/press greys moved with it, or the viewport would have stayed blue.
- **`--rule: 2px`** - every border that read a token is `var(--rule)`. Where
  a heavier ring was a state's second cue (`.hub-item.on`) it is now 4px,
  because 2px over 2px was nothing.
- **Zero radius**: `--r-sm / --r-md / --r-pill` are all 0. The names stay.
  Explicit `border-radius: 50%` circles (hub items, dots, sliders, material
  balls) are untouched and are a2.98-a2.100's business.
- **Mode hues from Turn 3**: Vertex `#d6ff4a` acid, Edge `#4ee3ff` cyan,
  Face `#ff6fc2` magenta; `MODE_SELECT` on the model uses the same hex.
  Object stays neutral (`#bab6b6`). **All three take dark text** -
  `--on-accent` is `#0b0c0b`; light text on the magenta is 2.3:1.
- **`--signal #ff563c`** is the one red in the chrome and means THIS
  COMMITS (`#opBar button.ok`). It is not a mode. On the model
  `THEME.select` is the same red and means "chosen".
- **`--danger #ff4d2e`** orange, with `--danger-dim #482018`; the outliner's
  swipe-to-delete hint reads them too.
- **Archivo is embedded** - one variable-weight latin woff2, base64 in the
  `<style>`, ~46 KB. The Google Fonts links are gone, so the app makes ONE
  network request (three.js) instead of three. The view cube's canvas labels
  are re-baked after `document.fonts.load()` resolves, because canvas 2D
  draws with whatever is loaded at the time and the cube is built at module
  scope.
- `--ok` is deleted: no consumer, and it equalled the vertex hue.
- Screenshot harness for the pass: `py -3 _uishot97.py` ->
  `_ui97_{idle,face,ring,world,opbar,drawer}.png` at 430x860 @2x. The older
  `_uishot.py` drives an API that no longer exists and shows idle for
  every state.
- Regression: `_a297` against `_a296` - see `_cmp_out.txt`; `_theme`'s
  `8.palette` line is expected to move.

## Cool running - the gesture-time render scale (a2.96)

An iPhone 15 got hot after 5-10 minutes of modelling. The render loop was
already right (see On-demand rendering, a2.46) and a full audit found no
timer, animation or leaked pointer re-arming it. The heat is in the frames
that DO draw: 2x device pixels, multisampled, PBR under the environment map,
sixty times a second for as long as a finger moves on the glass. Full
write-up in the project doc `performance-a2.96.md`.

- **While a touch GESTURE is live the main renderer draws at
  `LIVE_PIXEL_RATIO` (1.25) instead of the 2.0 cap** - 39% of the pixels.
  The first frame after the finger lifts is full resolution again; the
  restore calls `invalidate()` itself so it never waits for the heartbeat.
- **A gesture, not a touch.** A touch qualifies only once it has travelled
  `LIVE_TOUCH_PX` (8) and only if it landed on the canvas or on a range
  slider (the op bar re-runs its operation per frame, so it is the other path
  that draws continuously). Taps, holds and drawer scrolls never switch the
  scale - switching reallocates the drawing buffer, and a tap would have paid
  for that twice while blurring the ring you were reading.
- **`liveTouches` is its own document-level tracker, not `activePointers`.**
  That Map is canvas-only and has leaked before; each entry here carries its
  own last-move clock and is ignored `POINTER_LIVE_MS` after it, so a leak
  costs four seconds of soft viewport, not a session. Mouse and pen never
  qualify.
- **The switch happens inside `animate()`, right before `renderer.render`,
  never in an event handler** - `setSize` clears the drawing buffer, and
  anywhere else that is a blank flash.
- **Every non-attenuated Points material is carried across by the ratio of
  ratios** (`m.size *= to/from`; 1.25/2 and back round-trips bit-exactly).
  This leans on an invariant that is now literally true: every site that
  sets a Points size reads `renderer.getPixelRatio()` at that moment
  (`knifeDotMat`'s constructor was the one that did not; fixed). **Keep it
  true** - a Points size set without the ratio will be wrong by 1.6x after
  the first gesture. Line2 strokes need nothing: `LineMaterial.resolution`
  is CSS size.
- **Direct drags coalesce to one apply per frame.** The move handler parks
  the event in `pendingDragEv`; `flushDirectDrag()` runs at the top of
  `animate()` (before the render decision) and first thing in
  `endDirectDrag()`, so the final position is the finger's. `beginDirectDrag`
  clears the park. `updateDirectDrag` used to run once per pointermove, and
  an element drag's apply re-shades the whole mesh.
- Not measured, and cannot be here: rAF does not fire under the harness's
  virtual clock and no headless Chrome has a phone's thermal envelope.
  `renderScaleWanted`, `setRenderScale`, `liveTouches`, `pendingDragEv` and
  `PERF.rescale` are on `__kubik`. Next levers if the phone is still warm:
  `LIVE_PIXEL_RATIO` to 1.0; a 30fps cap on the drag loop; the
  `backdrop-filter` panels over a live canvas; the unthrottled edge-field
  bake during an op-slider drag on a shape-masked material.
- Regression: 32 of 32 suites byte-identical, `_a296` against `_a295f`.

## The headlight rig - lighting follows the camera (a2.95)

Zeghreit: *"link light to camera so on rotation we will see model well lit
all the time. If one will want to change it - we already have light turning
feature."*

### Turn splits into two numbers

`App.env.rotation` used to be an absolute world angle. It is now a MANUAL
OFFSET on top of a camera-tracked baseline: `turn = manualTurn +
cameraTurnDeg()`, where `manualTurn` is `App.env.rotation` itself (still what
the light-turn gesture writes, unchanged) and `cameraTurnDeg()` is how far
the camera has orbited, in degrees, from where it started.

### The baseline is the OPENING camera, not zero

`HOME_CAM_AZ_DEG` is the opening camera's own azimuth (about 36.87 degrees,
from the hardcoded `camera.position.set(4.5, 3.5, 6)`), not zero.
`cameraTurnDeg()` is `orbit.getAzimuthalAngle()` minus that constant, so it
reads 0 at the opening view and only departs as the camera actually orbits
away from it. Every preset's az/el numbers were tuned by eye against THAT
framing - the rim light's whole job is to trace the silhouette from there -
so anchoring to it, not to world zero, means every preset looks exactly as
designed at the opening view and nowhere else changes retroactively. A saved
project opens looking exactly as it did before, then relights coherently as
you orbit from wherever it opened.

### The shelf stays still

The material-preview tray runs its own scene, never orbited, so its key
light and its `environmentRotation.y` keep using `manualTurn` alone - the
gesture can still turn it, the viewport camera cannot. Two call sites in
`applyEnvRig()` and `applyEnvLive()` had to be told apart from the three (the
scene's `dir`/`fill`/`rimLight` and `scene.environmentRotation.y`) that do
track the camera. Getting this backwards in either direction was the
likeliest mistake in a change this shape - a reviewer checked both.

### Driven off `orbit`'s own 'change', not a per-frame poll

A second `orbit.addEventListener('change', ...)` (the app already had one,
for the ortho-turn watch) recomputes the rig whenever the camera's azimuth
actually changes - drag, damping settle, or a programmatic flight all reach
it, because `animate()` calls `orbit.update()` every frame regardless and
that is what fires 'change'. A pan or a dolly fires 'change' too without
changing azimuth, so a small epsilon (0.02 degrees) skips the recompute
rather than re-deriving six light directions on frames that did not need it.
`applyEnvLive()`/`applyEnvRig()` only touch colours, positions and two scene
uniforms - no PMREM rebake - so this is cheap enough to run on every frame
that actually turns.

### What a fresh reviewer found before this shipped

**The manual gesture inherited a flick's leftover coast.** `engageLightHold`
cleared `orbit.enabled` to take the camera away from the anchor fingers, but
`enabled` only stops the CONTROLS reading pointers - it does not stop
damping already in flight, and `animate()`'s `orbit.update()` keeps applying
that regardless of `enabled`. Flick-orbit, then immediately hold two fingers
to adjust the light, and the leftover turn kept reaching the headlight rig
for close to a second, drifting the light out from under a gesture whose
entire point is manual control. `cubeAlignTo` had already solved this exact
problem for its own swing - spend the coast with one `orbit.update()` under
`enableDamping = false` before taking over - and `engageLightHold` now does
the same thing first.

### Probe

`_light_probe.py` measures the real light objects and the real
`OrbitControls` angle rather than inferring from pixels: baseline is
untouched at the opening view, a +40 degree orbit shifts `dir`/`fill`/
`rimLight` and the environment rotation by exactly 40, the manual gesture's
offset adds on top rather than replacing it, a round trip back to the
opening azimuth reproduces the original directions with no drift, and a
pan leaves the lights alone. The full regression suite ran clean apart from
the two flakes already on record (`_imp_probe`'s CDN race, `_soft2_probe`'s
headless `releasePointerCapture` warning).

## Hold a row to pick it up (a2.94)

Zeghreit: *"reorder by dragging, group by dragging one row onto another,
ungroup by opening a group and dragging one of its components out."*

### Why it has to be a hold

a2.92 spent the row's **horizontal** axis on swipe and handed its **vertical**
to the scroller. There is no third axis, so the third gesture has to start
somewhere neither of those is listening: **a hold.** 340ms without moving
lifts the row; after that the finger owns both axes until it lets go.

The hold is dropped by the first 8px of movement, so a swipe and a scroll both
still start instantly — nobody waits out a timer to flick the list.

### Two answers, two pictures

- The **middle band** of a row means *into it* — the row gets an accent
  outline. Dropping a loose object onto another makes a group of the two;
  dropping onto a group or one of its children adds to that group.
- The **edges and the gaps** mean *between* — a thin accent line with a dot,
  drawn at the boundary the drop would use.

Confusing those two is the only real failure this gesture can have, so they
never appear at once and the line is anchored to the edge of a whole **block**
— a group's row plus every child under it — not to whichever child row the
finger happens to be over.

Dragging a child out of its group's span takes just that child out; the group
of one it leaves behind dissolves itself, which `pruneGroups` already did.

Escape or a pointercancel aborts: the row goes back, nothing changes, nothing
is recorded.

### The model is two lists and one flatten

`entries` is the top-level order — objects and groups — and each group owns its
`childIds`. A drop edits one or both, then `App.objects` is rebuilt from them.

The alternative was arithmetic on `App.objects` indices, converting a visual
drop position into an array index while groups occupy several slots and their
members need not be contiguous. That is where the bugs live. Rebuilding is
O(objects) over a scene of a few dozen, it cannot desync the two orderings,
and every case is three lines. `flattenEntries` also sweeps anything the walk
missed onto the end: **reordering a list must not be able to delete
anything**, whatever else is wrong.

### The drop names a row, not a number

`resolveOutDrop` returns the row a drop is *relative to*, and the index is
worked out after the dragged row has been detached. The first cut returned a
number computed against the list that still contained it — see below.

### What a fresh reviewer found before this shipped

Five, and the first is the one to learn from:

- **Every downward drop landed a slot too low.** The index was computed
  against the list as it still was, and the detach then shifted everything
  below the row's old place by one. Dragging *up* was correct throughout,
  which is exactly how a bug like this survives being tried out by hand — and
  the position that reads as "leave it where it is" quietly moved the row and
  pushed a history step. The probe missed it too: section 39 dropped at the
  very end of the list, where the clamp hides it. **A reorder test that only
  moves things to the end is not a reorder test.**
- **The 4px gap between rows meant "move to the end".** Any pointer that was
  not inside a row's rect fell through to the terminal fallback, so the line
  snapped to the bottom of the list every time the finger crossed a boundary,
  and a release in that band committed it. On a 40px pitch, one release in ten.
- **A hold whose row was rebuilt away never ended.** Its pointerup goes with
  the element, so the timer fired onto a detached row for a finger already up,
  and nothing would ever stop the frame loop or remove the four document
  listeners — including the non-passive `touchmove` that `preventDefault`s
  **every** touch on the page. On a phone there is no Escape, so that is the
  app dead until reload.
- **The line could be drawn inside a group the drop would step over**, because
  a lifted group resolves against a child row to a boundary of that child's
  whole parent.
- **The click that ends a lift could select a row.** Marking the row the way
  the swipe does does not survive here, because ending a lift rebuilds the
  list — so the click lands on a fresh element with a clean flag. A short
  window on the clock covers the gap the rebuild opens.

### One that the probe found by being flaky

Section 39 failed intermittently, and the cause was real: the drop was being
read off the **last painted frame**. A finger that moves fast and lets go
immediately would land wherever that stale frame said — a row or two out on a
loaded phone. It is resolved at the lift now, from the pointer's own position,
and the section moves and releases within a single tick so that no frame can
run in between. **A flaky test is a bug report.**

### The one line that carries the gesture on touch

`touch-action` is read when the touch sequence BEGINS, so flipping it at lift
time would not take the vertical axis back from the scroller until the *next*
gesture — the row would follow the finger while the tray scrolled underneath
it. A non-passive `touchmove` listener calling `preventDefault` is the only
thing that stops a scroll already in flight.

### Probe

`_out_probe.js`, forty-seven sections. Six on the pick-up itself — a moving
finger does not lift, a still one does, a drop between rows reorders, a drop
onto a row groups and draws only the outline, a child dragged out ungroups,
and Escape changes and records nothing. Five more came one per review finding,
including the exact-landing test the original missed.

## Objects can be grouped (a2.93)

Zeghreit: *"group/ungroup op that will be both in obj bloom menu and in
outliner."*

### A group is a record, not a THREE.Group

`App.groups` holds `{ id, name, childIds, open }` and the meshes stay parented
to the scene exactly as they were. Reparenting into a real `THREE.Group` would
have composed transforms for free and broken everything that assumes
`mesh.parent === scene` — world matrices and the `matrixWorld`-staleness class
of bug this file has been bitten by twice, raycasting, export, symmetry planes,
gizmo attachment.

It buys nothing here anyway, and that was checked rather than assumed before a
line was written: **the multi-object drag is already rigid about the
selection's shared centre** (`selectionCenterWorld`, and the `T · M · T⁻¹`
sandwich in the rotate and scale paths). So selecting a group's members and
dragging moves them as one, and a group never needs a transform of its own.

**One level deep.** A group holds objects, never groups. Nesting would turn
every walk of the object list — and there are 37 of them — into a walk of a
tree, for something nobody has asked for. Dropping a row onto a group will
ADD to it rather than nest.

Group ids come from the same `App.nextId` counter as objects, so one id can
never mean two different rows.

### Upkeep is one hook

`pruneGroups()` runs from `refreshUI`, the same trick `reconcileIsolation`
uses and for the same reason: every op in the app ends by refreshing the UI,
so hooking that one place covers join, separate, delete, collapse, detach and
import at once, and **not one of them had to learn that groups exist**. It
drops dead ids and dissolves a group that is down to one member — a group of
one is not a group, and leaving it would put a disclosure triangle over a
single object for ever.

### What a group does

- **A tap in the viewport on any member takes the whole group.** That is what
  grouping is FOR — a tap that grabbed one leg of a chair would make the group
  an outliner decoration rather than a modelling tool. Region select and
  Shrink expand the same way, or a box over two legs of a three-part group
  would drag two legs with nothing on screen to say so.
- **The outliner is where one member is still reachable.** Unfold the group
  and tap a child row: that child alone. That is what unfolding was for.
- **Group** (seat 12, inboard of Join) and **Ungroup** (seat 4, inboard of
  Separate) — the pairings are the point. Join makes several meshes one mesh
  and only Separate undoes it; Group makes several objects one selection and
  lets go again. Each is offered only where it would do something.
- **On a group row**: the eye hides every member, swipe left takes the group
  and its contents, swipe right copies the assembly AS an assembly, double-tap
  renames it, and the caret unfolds it without selecting anything.
- **The group eye is all-or-nothing.** `hideObject` refuses the last object
  still showing one at a time, so a group taken member by member would hide
  some and refuse the rest — a switch that did most of what it said. Decided
  for the whole group up front instead.

### The file

`groups` is a list of ids and a name. `open` is deliberately not written —
which rows you had unfolded is a way of looking, not part of the model, the
same line the view gizmo drew at a2.90. A file from before this version has no
`groups` key and loads with none.

### What a fresh reviewer found before this shipped

Five, and the first one would have shipped a feature that could not be undone:

- **Grouping recorded no undo step at all.** `pushHistory` dedupes on a
  signature of the model, and `groups` was not in it — so a document that had
  just gained a group looked byte-identical to the one before it and took the
  early return. Group was unrecoverable, Ungroup could be undone back into
  existence by a Redo carrying the old grouping, and a renamed group lost its
  name to the next undo. Serialize and restore were already right; this one
  gate threw the step away.
- **Region select and Shrink bypassed the expansion**, because they write the
  selection set by hand rather than going through the tap.
- **The two Duplicates gave two different answers** — the outliner swipe
  re-grouped its copies and the ring handed back a loose pile, and the ring is
  the common path precisely because a tap already takes the whole group.
- **A partly hidden group could be selected into.** The check asked whether the
  WHOLE group was hidden, so a group with one child hidden on its own fell
  through and selected an object nobody could see — the exact trap the object
  row was fixed for at a2.91.
- **Group and Ungroup shared one seat**, so Group vanished the moment anything
  in the selection was grouped: no way to add a fourth part to a group of
  three except to dissolve it and start over — and the re-parenting
  `groupSelection` does on the way in, the code that makes adding work, could
  never run.

### Probe

`_out_probe.js`, thirty-six sections. Ten cover grouping: the ring groups and
offers each op only where it does something; the list nests with the group
standing where its first member stood; a group row takes the assembly and a
child row takes the child; a viewport tap takes the group; the eye is
all-or-nothing and can never empty the scene; the swipe takes the contents and
undo brings them back; a copy of a group is a group; a group of one dissolves
itself; ungroup keeps every object; and the grouping survives a save/load
round trip while a file without a `groups` key still opens. Five more came
straight out of the review, one per finding — including a box-select fixture
that **proves itself first**, because a box that happened to catch all three
objects would have passed while measuring nothing.

### Then

The pick-up arrived at a2.94, above.

## A row is a handle on an object (a2.92)

Zeghreit: *"rename by double tap on name, delete by swipe left and duplicate
by swiping right."*

Three gestures on an outliner row, and one rule underneath all three: **they
act on the object under the finger, not on the selection.** That is the whole
point of having a list. Swiping a row you never selected deletes that row's
object, in any mode, with whatever else still selected untouched - the probe
selects one cube and swipes the other, and checks the right one went.

### The slot

Each row now rides in an `.outSlot` that holds two fixed backdrops and clips
them: **Duplicate** on the left, **Delete** on the right. The row slides over
the top, so the label you are uncovering is on the side the row is leaving
towards, and it is readable well before the finger has gone far enough to
mean it. The row had to become **opaque** for this - the hint behind it
showed straight through - and `--accent-dim` is translucent, so the selected
state stacks it OVER the panel colour as a gradient layer rather than
replacing it.

**Nothing is decided until the finger lifts.** A swipe started and thought
better of springs back; the commit distance is 96px and the row stops
travelling at 130.

### Not fighting the scroller

`.outRow` takes `touch-action: pan-y`, which hands vertical to the browser
and keeps horizontal. Deciding the axis by hand would fight the scroller for
the first few pixels of every drag. On top of that the handler **bows out for
good** once a drag reads as mostly vertical (`|dy| > 10` and `|dy| > |dx|`)
rather than grabbing it back halfway down the list, and the click that ends
a real swipe is swallowed, or it would select what it had just deleted.

### Double tap, remembered by id

The rename pair is tracked by **object id, not by element**. The first tap
selects, selecting calls `refreshUI`, and that rebuilds every row - so the
element the first tap landed on no longer exists for the second. For the same
reason `outlinerRename` looks its row up by id, and the second tap **defers**
it by a tick: the click that tap still has to fire would rebuild the list and
throw the input away the moment it appeared.

The box **stops every key**. Single letters are shortcuts in this app - `x`
deletes, `e` extrudes - so a name typed into a box that leaked would edit the
mesh it was naming. Enter commits, Escape cancels, blur commits, and removing
the input blurs it, which is why the close is guarded to run once.

The old `dblclick` on a row - focus the camera on that object - is gone.
Double-tapping the object itself in the viewport already does that, so the
row was the second way to reach the same thing, and the name was the better
use of the gesture.

### What a fresh reviewer found before this shipped

Five, all real, all in the first cut:

- **A cancel was being read as a lift.** `pointercancel` ran the same branch
  as `pointerup`, so a swipe the browser took away past the commit distance
  deleted the object. Android fires it on the long-press menu and whenever
  the compositor claims the touch - a gesture you never finished. It settles
  now and commits nothing.
- **A flick counted as the first tap of a pair.** Bowing out to the scroller
  ends with the drag never having gone live, which is the same shape as a
  tap unless the distance is checked. Flicking the list and then tapping the
  same row opened the rename. The tap branch now has to prove it did not
  move.
- **A face selection outlived its object.** `deleteSelection` never had to
  think about this, because its object branch only runs in Object mode - the
  swipe works in any mode. It did not throw; it LIED: `data-armed` stayed on
  the root and the HUD went on reporting three faces with nothing left to
  pick. The four component anchors go with the mesh now.
- **Committing a rename rebuilt the list mid-gesture.** The box closes on
  blur, and pressing the next row is what blurs it - so that row recorded its
  origin and was then thrown away before its own pointerup. The row is
  corrected in place and the rebuild held off. Cancelling rebuilt for no
  reason at all and no longer does.
- **The pointerdown guards left their state behind.** A gesture that ends off
  the row never gets its `pointerup` here, and a desktop mouse keeps one
  pointer id forever - so a later press the guards meant to ignore could be
  measured against a stale origin and go live. Cleared before the guards, not
  after.

### Probe

`_out_probe.js` grew to twenty-one sections and gained a `_out_probe.py`
harness of its own. The nine new ones drive synthetic pointer events: swipe
left deletes the row's object and not the selected one; swipe right makes
exactly one copy; a short swipe springs back; a mostly-vertical drag scrolls
and leaves the row where it was; the rename box commits on Enter with zero
keys reaching the document; and two taps open it - that last one measured
across a tick, because the app defers the box on purpose. Three more came
straight out of the review and would have caught it: a cancel 40px past the
commit distance deletes nothing, a flick followed by a tap does not open the
rename, and three selected faces do not survive the object being swiped away.

## The outliner leaves the drawer (a2.91)

Zeghreit: *"outliner - drawer shelf on the left with list of all objects and
components in scene. It is now already sits in main drawer, but it's not
right."*

The object list was a wrapped row of chips in the drawer's **Scene** section,
under a note that had already half-admitted the problem: *"this list of
objects is the one thing here that isn't duplicated elsewhere."* A settings
drawer is where you go to change how the app behaves. The list of what is IN
your scene is something you consult WHILE working - and consulting it meant
sliding a 340px panel over the model you were looking at.

The materials tray settled this argument once already: *"deliberately NOT a
second drawer - it's a palette, not a settings panel, and the viewport stays
the hero."* The outliner is the same shape on the other edge. A 44px tab
tucked to the left border at y 76 - the menu button ends at 58 - rolling out
a 232px list. Under the drawer's z-index, so opening the drawer covers it
rather than fighting it.

### What came across, and why it matters

Every guard the chips had earned moved with them, because none of them was
about where the list is drawn:

- **A hidden object stays listed**, dimmed and struck through - the list is
  the one place it can still be seen to exist. Tapping that row **brings it
  back** rather than selecting it. That was the trap the chips were fixed
  for: the row selected a hidden object and Delete then acted on a thing
  nobody could see.
- **Switching object from a component mode settles what it is walking away
  from** - a live op committed, any other cancelled, and the knife with them.
  Left open, the knife's points still belonged to the OLD object while the
  helpers showed the new one, so pressing OK cut a mesh you were no longer
  looking at.
- **The lock and the selection move together** (a2.57), or the next trip out
  to Object mode and back silently undoes the row.

### New here

- **An eye per row.** Hiding was only reachable through the three-finger
  isolate pinch; now it is a switch. `hideObject` is the counterpart to
  `unhideObject` and it **refuses the last object still showing**: reconcile
  answers "everything is hidden" by un-hiding the lot, so without the refusal
  the tap that hid the final object would appear to undo itself and bring the
  whole scene back. An empty viewport with no explanation is the failure
  isolation exists to avoid, and a suddenly full one you did not ask for is
  that same failure wearing the opposite face.
- **It is built only while open.** `refreshUI` runs on every selection change
  and every drag frame that touches the UI; a list nobody is looking at costs
  nothing. The probe measures that rather than trusting it - a marker element
  survives five `refreshUI` calls with the shelf closed and is gone the moment
  it opens.
- **An empty scene says so** instead of rolling out a blank panel.

### Still to come

Reorder by drag, and group/ungroup by dragging one row onto another - with
group/ungroup also in the object ring. That is a change to the object model,
and it is its own version. (Rename, delete and duplicate arrived at a2.92.)

### Probe

`_out_probe.js`, twelve sections: the drawer really has lost it; the tab is
edge-tucked below the menu and clear of the hub; it rolls both ways; the list
is the scene in scene order; a row selects; the eye hides without losing the
row; a hidden row unhides instead of selecting; the last one showing is
refused; a row in a component mode settles the op; it is not rebuilt while
closed; it fits at 375px; and an empty scene explains itself.

**The CSS in this version was written twice.** The first patch script hit an
anchor miss on a later substitution and exited before saving - so the
stylesheet was never written, while the markup and the JS were. Everything
still "worked": the shelf appeared, listed objects and toggled, because an
unstyled div in normal flow does all of that. The probe caught it as three
separate failures (a 30x40 tab at the top of the viewport, a tray that was
never `display: none`, and a shelf 375px wide) and they had one cause.
**A patch script that aborts mid-run is a patch script that half-applied**,
and the only reason this was recoverable in one step is that the writes
happen at the end rather than per substitution.

## Symmetry joins the view gizmo, and loses its switch (a2.90)

Zeghreit, after using a2.89: *"what if we change whole conception... imagine
if xyz will sits as a part of view gizmo, no need to turn on/off symmetry -
just activate one or multiple axes and go with the Flow) deactivate all and
sym is off too"*.

### There is no on/off any more

A lit axis IS symmetry on. None lit is off. `App.symmetry` is a derived
property now, not a stored one:

```
symmetryAxes: [],
get symmetry() { return this.symmetryAxes.length > 0; },
```

a2.89 had both a flag and a set, which meant it could express **on with
nothing to mirror about** - and had to write a special case to stop the axis
buttons producing it. A state you have to defend against is usually a state
that should not exist.

The setter is kept, and does something sensible, because assigning to
`App.symmetry` is how this worked for thirty versions and how every older
probe still drives it. A getter alone would have failed those assignments
**silently** - which is the worst of the three options.

**No memory, by decision.** Turning the last axis off forgets the set, so
re-arming is always an explicit tap. A remembered set is state the control
does not show, and the one thing this arrangement buys is that what you see
is all there is.

### And it sits with the cube

The three switches are in the strip under the view cube. a2.90 put them
beside the projection pill; a2.90a moved that pill to the menu corner and
gave them the strip alone, against the right edge - x 213..361 at 375px.

The cube is the app's canonical **this is X, this is Y, this is Z** object,
and axis switches are meaningless without knowing which axis is which. That
is the whole argument for the neighbourhood.

**The honest cost:** the cube is VIEW state and symmetry is MODEL state, and
putting them together risks reading as "this face is mirrored". The switches
therefore stay strictly BELOW the cube and never on its faces - the cube's
own taps mean look-down-this-axis and have to keep meaning only that. The
probe asserts that separation rather than trusting it.

### a2.89's block lasted one version

It measured fine - one 44px row, top-left, 188 wide, ending less than half as
far down as the column a2.65 removed. It was still wrong twice:

- **The toast landed on the switches.** a2.89a pushed the toast down to dodge
  them, which worked and was a patch over a placement that should not have
  needed one. a2.90 moved the switches instead and the collision went with
  them: the toast keeps its own row at y 65..116, the switches sit at
  130..174, and the rule that moved the toast is **deleted** rather than left
  standing as a no-op nobody dares remove.
- **The top-left corner was carrying a control that belongs with the axes.**

The lesson is not "measure the placement" - a2.89 did measure it, and the
numbers were good. It is that **a measurement can only check the question you
thought to ask.** Nothing in a2.89's probe asked what else lives in that band,
because the toast is transient and a static rect never sees it.

### The message that survives

Arming the first axis still reports the pair count, because that is the one
thing the buttons cannot show and it is how you find out the mesh is not
actually symmetric about what you asked for. Adding a second axis says
nothing - the lit letter is the message, and a2.89a's mistake was a toast
repeating the control it was covering.

### The projection pill takes the menu corner (a2.90a) - and leaves it again

> **SUPERSEDED BY a2.90b**, below: the pill is a world-ring seat now and the
> top-left corner is empty. Kept because the cost it names - splitting the
> pill from the cube that a2.87's glance-versus-decision rule pairs it with -
> is still paid, just from a different place.

a2.90 emptied the top-left. A 44px toggle under a 44px button is what goes
back into it: menu ends at y 58, the pill runs 66..110, and it stops there -
two deep, not the three-deep column a2.65 removed for running to 211pt
before the model got a look in.

The strip under the cube is the axes' alone now, against the right edge.
Measured at 375px: axes x 213..361, pill x 14..58. The two corners are
independent and a long way apart.

**What this costs, said out loud.** a2.61 put the pill under the cube BECAUSE
the cube is the other way into the flat view, and a2.87 built the whole
glance-versus-decision distinction on that pairing - tap a cube face for a
look, tap the pill to work in it. Splitting them makes that relationship less
discoverable. Two things hold it together: the pill still shows the
projection you are IN, so wherever it sits you can read where you are; and
the strip now carries only the axes, which are the one thing that genuinely
needs the cube beside them to be legible at all.

**The toast now shares a band with the pill** - both live around y 66..115,
and only a 36px horizontal gap keeps them apart. That is the a2.89a bug one
corner over: a transient thing crossing a control, invisible to any static
measurement that did not think to ask. So `_symaxes_probe` asks, with the
longest message the feature can produce, at the width where a centred toast
is widest.

### The projection pill becomes a ring seat (a2.90b)

Zeghreit: *"I wanted to put perspective switch inside bloom menu that blooms
on empty space tap, not in upper left corner"*.

a2.90a moved it to the menu corner. That was the wrong reading of "the empty
space round the menu", and the right home was already written down - the
world ring's own note says it holds **"everything that used to sit as a
button around the viewport edge, which is how the edges finally got clear."**
The projection pill was the last of them.

It is a seat in the top half now, beside See-through, Floor grid and Snap,
which is the right company: those are view states you set and forget, not
actions on the model. The seat keeps both cues the pill wore since a2.61 -
a function icon that says which projection you are IN, and the accent that
says the flat one is a state rather than the default. Choosing it from the
ring is a **decision** in a2.87's sense, so it engages the sticky kind a turn
does not undo; the cube's own tap is still the glance.

The top-left corner is empty again. a2.89 put a symmetry block there, a2.90a
put this pill there, and both came back out - two items is the most that
corner has ever carried well, and the model is better off with none.

**What it costs:** nothing on screen says which projection you are in until
you bloom the ring. See-through, Floor grid and Snap have had exactly that
property since they moved here and it was accepted then for the same reason.
The flat view also announces itself when you enter it, and the cube is right
beside where it happens.

### A check that stopped being about one control

`_symaxes_probe` section 9 asked, at a2.89a, whether the toast covered the
symmetry switches. At a2.90a it asked whether the toast covered the
projection pill. Asking the same narrow question a third time would have
missed the point, so it now asks whether the longest message in the app
crosses **anything tappable in the viewport** - and it immediately found
something neither version had looked for:

**At 375px the toast crosses the view cube**, x 247..281. That is
pre-existing - the toast has been top-centre since a2.65 and the cube
top-right since long before, and nothing in this version moved either - so it
is reported with its numbers rather than failed. It is recorded here so it is
a decision rather than an oversight.

Elements with `pointer-events: none` are excluded, because something you
cannot tap is not a control the toast can obscure, and `#vignette` covers the
whole viewport - counting it would make the check pass or fail on nothing.

### Probe

`_symaxes_probe.js`, eighteen sections. Beyond the mirror-group work a2.89
already covered: one tap arms it and none-lit is off; the row is level with
the pill and strictly below the cube's faces; the top-left corner is free;
the longest possible symmetry toast and the switches no longer share a band
at all; the second axis is quiet and the first one reports pairs.

## Symmetry takes a SET of axes, in one block (a2.89)

Zeghreit: *"x y z switches for sym switch and the sym switch placement - it
will be one whole block"*, and *"axes is switches too so we can have multiple
axes on at the same time"*.

Two things were wrong, and only one of them was where the controls sat.

### The control was in two places

The on/off toggle lived under the view cube. X/Y/Z lived in a drawer row,
under a note reading *"Symmetry on and off is the button under the view
cube."* **A control that has to apologise for where its other half lives is
one control split in two.**

> **THE PLACEMENT AND THE TOGGLE ARE BOTH SUPERSEDED BY a2.90.** The three
> switches moved to the strip under the view cube, and the on/off toggle is
> gone - a lit axis is symmetry on. What still holds below: why the axes had
> to stop living in a drawer, and every word about the mirror group.

It was one block, top-left under the menu button: the toggle, and three
axis switches that appear only when it is on.

a2.65 tore a column out of that corner and the reason still stands - on a
phone with a 59pt top inset, menu over symmetry over lighting ran from 73pt
to 211pt before the model got a look in. **This is a row.** Measured at 375px:
`x 14..202, y 66..110` - 188 wide, 44 tall, ending less than half as far down
the screen as the column did. It spends width, which a portrait phone has,
instead of height, which it does not.

### And the axes are switches, not a choice

`App.symmetryAxis` (one string) became `App.symmetryAxes` (a set). With X and
Y both on, an edit has **three** mirror images - X, Y, and the diagonal -
because n planes generate a group of 2^n transforms. Measured on a cube
corner: one axis expands the selection to 2, two axes to 4, three to 8.

The map for a subset is the COMPOSITION of the per-axis maps, and a vertex
belongs to it only if every step of the chain had a partner. `symmetryMaps`
returns 1, 3 and 7 maps for 1, 2 and 3 axes.

Turning off the last axis turns symmetry off. Symmetry on with nothing to
mirror about is a state with no meaning, and the toggle and the axes being
one control is exactly where that shows.

### What had to learn to loop

- **`mirrorOfSelection`** unions every image; `mirrorImages` keeps them apart
  for the one caller that needs them separately.
- **`runMirrored`** runs the op once per group element. **Every mark is taken
  before the first pass** - marks are positions and the first pass moves
  geometry, so a mark taken afterwards would describe a mesh that no longer
  exists. The last pass writes history; the rest are quiet, as the first
  always was.
- **The drag** snapshots the whole group with a plane per axis. Clamps come
  first, then mirrors: a vertex pinned to the X plane and mirrored across Y
  wants the reflection of where it actually ended up, not of where the
  pointer would have put it. The claim filter that stops double-writes now
  claims **every** partner, not the first axis's - claiming one would let the
  diagonal write the same vertex twice, which is the bug that filter exists
  to prevent.
- **`extrudeRegionOp`'s `symmetrise`** walks the plane list. Each plane
  touches only its own component, so a vertex can sit on the X plane and
  behind the Y one and get the right answer from both.
- **`resolveEdgeMarks`**, **`opSymmetry`**, **`decideLoopCutFlip`** and the
  snap skip-set likewise.
- **One plane per object per axis.** `userData.symPlane` recaptured whenever
  the axis differed, which was right when only one could be live and is
  thrashing when three can. It is still written, so a file saved here opens
  in a2.88.

`primarySymAxis()` is what Mirror, Flip and Array's default read: those act
across ONE plane by their nature, and take the first of the live set.

### None of this was affordable before a2.88

Three axes need seven maps. At the old O(V^2) that was 4.2 seconds on a
14,641-vertex mesh. The groundwork went first for that reason.

### Probe

`_symaxes_probe.js`, ten sections. The one that matters is section 5, which
asserts **the property the feature exists to create**: after an extrude under
two-axis symmetry, every vertex of the finished mesh has a partner at its
reflection in BOTH planes - asked of the result with the app's own weld
tolerance, so it cannot agree with the code that built it by construction.
0 unmatched of 16, winding clean.

Section 6 is its guard: two-axis symmetry that quietly mirrored across a
third would pass section 5 just as well, so one axis is checked for what it
must NOT do.

`_theme_probe` section 9 kept the strip under the cube and gave up the
symmetry half, which now lives with the block. Both halves in two probes is
how two probes drift apart.

## The symmetry map stops being quadratic (a2.88)

`buildSymmetryMap` found each vertex's mirror partner by walking every
vertex. O(V^2), and it bites hard:

| logical vertices | scan | grid |
|---|---|---|
| 1,681 | 9ms | 2.4ms |
| 6,561 | 118ms | 8.7ms |
| 14,641 | **598ms** | **27.5ms** |

1,681 -> 6,561 is 3.9x the vertices for 13x the time; 6,561 -> 14,641 is
2.2x for 5x. Textbook quadratic. The grid over the same range goes 3.6x and
3.2x for those same steps - linear, with a bucket-overhead tail.

This was survivable while symmetry meant one axis and one map. It stopped
being survivable the moment symmetry needed a SET of axes: the mirror group
for three axes has seven non-identity elements, so **seven maps**. On the
14,641-vertex grid that is 4.2 seconds against 193ms.

### How

Bucket every vertex by its position on a grid whose cell is the existing
tolerance (`max(size) * 1e-3`). Any point within `tol` of the reflection is
then at most one cell away on each side, so 27 cells hold every candidate
and the answer is the one the scan gave.

Two details keep it the same ANSWER rather than merely an equivalent one:

- **The tie-break is spelled out.** The scan ran `k` upward taking
  `d < bestD` strictly, so among equal distances the lowest index won.
  Bucket order is not index order, so that rule had to be written down.
- **The cell key is a number, not a string.** See below.

### The first cut was SLOWER, and that was the useful result

Keying cells as `cx + '_' + cy + '_' + cz` measured **0.2x to 0.9x** - worse
than the scan at every size it could reach. The scan is a tight numeric loop
V8 compiles beautifully; the grid was paying for string concatenation about
thirty times per vertex, once to file and twenty-seven times to look up. A
multiplicative hash folded into one integer removed all of it. Collisions
are harmless because the real squared distance still decides: a foreign cell
landing in the same bucket only adds candidates that fail the tolerance, and
the true partner's own cell is always among the twenty-seven.

### And the fixture did not contain the problem

The second cut asked for `sphere 180x120` and reported it as an
import-sized mesh. `PRIM_SPECS` clamps `h` and `v`, so it came back with the
same **1,986** logical vertices a 72x48 sphere gives - and at two thousand
vertices O(V^2) has not yet overtaken the grid's constant factor, so the
honest speedups (5-6x) looked like the whole story while the 22x case went
unmeasured. The primitives cover the SHAPES; a hand-built N x N grid covers
the SIZE.

**Asking a fixture for a size is not the same as checking it has one.** The
running tally in this file is long and this is another entry on it.

### Probe

`_symrace_probe.js` / `_sym_run.py` carries the pre-a2.88 scan verbatim
beside the shipped implementation and runs both on the same geometry:
8 primitive shapes x 3 axes, 3 hand-built grids, and one deliberately
asymmetric mesh where most vertices have no partner at all and the grid must
not invent any. **27 maps, 0 mismatched.** The interesting line is the diff;
the clock is the second question.

## Two ways into the flat view, and they mean different things (a2.87)

Zeghreit: *"From view cube it is like temporary ortho - it is gone the moment
one turns the camera (not translate or zoom), but ortho from pill is constant
until it switched via same pill."*

a2.61 made every flat view temporary. a2.86 made every flat view permanent.
Both were one rule for two intents, and the argument between them was really
an argument about which intent mattered more.

**A cube tap is a GLANCE.** You wanted to see the front, square on, to check
something. Turning away is you finishing with it, and it should hand the
perspective back without being asked. a2.61's rule was right about this case
all along.

**The pill is a DECISION.** You have said which projection you want to work
in. Orbiting is then ordinary work, not a reason to be overruled, and only
the pill takes it back.

`orthoView.sticky` is the whole difference, and `engageOrtho(via)` sets it
from the call site: `'cube'` is a glance, anything else - the pill, a probe,
any future caller - is a decision, because a glance is a thing only the cube
can ask for.

### The cases that fall out, and the ones that had to be chosen

- **Pan and zoom never end a glance.** They were never the question; the
  measurement is the camera-to-target VECTOR, and a pan moves the camera and
  its target together while a dolly only changes the distance.
- **A cube tap while a pill view is open swings the angle without downgrading
  it.** That falls straight out of `engageOrtho` returning early when it is
  already flat - no special case, and it is the right answer: you asked to
  work in ortho, the cube just changed where you are standing.
- **A pill tap while a glance is open still just toggles to perspective.**
  Chosen, not inherited. The alternative - promoting a glance to a decision -
  makes the pill mean two different things depending on a state you cannot
  see, and leaves no obvious way out. The pill means "perspective" whenever
  it is lit, whichever way you got there.
- **A swing is not a turn.** `cubeAlignTo` clears the watch when it starts,
  or the swing's own arrival reads as a turn and drops you out of the view it
  was heading for.

### Saying which one you are in

The toast, at the moment it matters: *"Orthographic view - stays until you tap
again"* against *"Orthographic view - turn to leave"*. The pill's title
carries the same distinction for anyone who hovers. Nothing else on screen
changes, because a second visual state for the same control would cost more
attention than the difference is worth - the behaviour teaches itself the
first time you turn.

### The measurement, unchanged from a2.61 and still careful

A TURN is the gesture that changes the direction you look FROM. Reading the
vector rather than asking the controls which gesture is running keeps it
working for a wheel, a trackpad pinch and two fingers alike. One degree, not
zero, so a sub-pixel wobble in a pan does not count. And it is **not disarmed
on `end`**: damping keeps a flick turning for about a second after the finger
leaves, and a fast flick has barely moved by lift-off - disarming early let
that coast carry the view thirty degrees while the app still claimed to be
showing a plan view.

### Probes

`_proj_probe` sections 13-15 own this, driven through the widget and the pill
rather than through `engageOrtho`, because `via` is decided at the call site
and calling the worker would be asserting the argument the probe exists to
check. A cube tap lands flat and non-sticky; a pan and a 0.3-degree wobble
leave it alone; six degrees ends it; the pill's view survives twenty degrees,
survives a cube tap on top of that, and still lets go when tapped.

`_theme_probe` section 9 keeps the sticky half only, and says so - both halves
in two probes is how two probes drift apart.

### The lesson

**When a rule is argued about twice, it is usually two rules.** a2.61 and
a2.86 were each right about one intent and wrong about the other, and three
versions went by before anyone asked which of the two entrances the user was
holding in mind. The tell was that both rules had obvious counterexamples the
author had to talk himself past.

## Turning keeps the flat view (a2.86)

Zeghreit, after testing a2.85: *"camera still works the same - it breaks
into perspective after I turn it."*

It did, and it was doing exactly what a2.61 asked for. The rule was right for
what the flat view WAS: an emulation, a long lens pretending, which only
really meant anything looking straight down an axis after a cube tap.
Something you visited and got returned from.

a2.85 removed the reason and left the rule standing. A parallel projection is
just as true from three-quarters as it is from the front - orbiting around a
model in it is the ordinary way to work, not a state to be rescued from.
Every DCC and CAD tool orbits freely in ortho and leaves it only when told.

**Every gesture now stays flat. The pill is the only thing that changes
projection**, and the cube still swings you in.

> **SCOPED BY a2.87.** This holds for the flat view the PILL opens. A cube
> tap opens a glance instead, and a turn still ends that one - which is what
> a2.61's rule was for. Read the a2.87 section above.

### What went with it

`ORTHO_TURN_COS`, `_turnFrom`, `_turnNow`, `watchingTurn`, both listeners'
turn logic, and `cubeAlignTo`'s re-arm. The `start` listener survives only to
cancel a cube swing, which was never about projection.

The care that went into the deleted rule is worth recording, because it was
all real: the watch measured the camera-to-target VECTOR rather than asking
the controls which gesture was running, so it worked for a wheel, a trackpad
pinch and two fingers alike; the threshold was one degree rather than zero so
a sub-pixel wobble in a pan did not count; and it was deliberately not
disarmed on `end`, because damping keeps a flick turning for about a second
after the finger leaves and a fast flick has barely moved by lift-off. None
of it was wrong. The requirement underneath it stopped existing.

### The lesson

**When a change removes the reason for a rule, the rule is part of the
change.** a2.85 was written to preserve behaviour - "the turn rule is decided,
do not touch" - and that was the wrong instinct twice over: it left the app
doing the one thing the user would notice most, and it meant a2.85 shipped
looking to him like nothing had happened at all. A justification that has been
deleted should be re-examined in the same version that deletes it, not
inherited.

### Probes

`_theme_probe` section 9 keeps every one of its assertions and inverts two:
`9.turn_keeps_it` and `9.flick_coast` now check that a six-degree turn and the
whole damped coast after a flick leave the projection alone. `_proj_probe`
section 12 does the same at twenty degrees, and 12 gained
`pill_still_leaves` - because "nothing drops you out" is only half the
requirement, and the other half is that the pill still can, from a turned
angle.

`_theme_probe`'s harness also learned to say WHY it gave up. Its
`ERROR=no __kubik` reads exactly like a hung app, and a stale Chrome profile
lock sent this version chasing an app that was fine; it now prints the page's
own errors, the ready state and whether THREE loaded.

## The flat view is a real camera (a2.85)

From a2.61 to a2.84 "orthographic" was EMULATED: the one PerspectiveCamera
narrowed to fov 2 and backed away by the factor that keeps the framing -
about 27x. One camera, so every raycast, drag and unproject in the file kept
working without being taught anything. That was the whole argument for it,
and it is a good one.

Measured, against a2.84, with two rails that are parallel in the world:

| | convergence | camera distance | fog band |
|---|---|---|---|
| perspective | 15.6127 deg | 8.276 | 15.00 / 42.00 |
| emulated flat | **0.5076 deg** | **221.104** | **227.83 / 254.83** |
| real flat (a2.85) | **0.00000 deg** | 8.276 | 15.00 / 42.00 |

Half a degree is small. It is not zero, and it grows with the depth of the
model - which is the one thing a drafting view cannot do.

### The lens was never the expensive part. The 27x was.

Everything a2.61a had to fix came from moving the camera, not from bending
it. Fog is banded by CAMERA DISTANCE, so the band had to be shifted out to
227.83 / 254.83 and **re-shifted on every camera move**, because a band
frozen at engage is only correct at the distance it was frozen at - three
wheel notches out and the scene was solid background colour. The 0.01 near
plane threw away its precision from 27x out. Past ~37 units of orbit the
tele position landed beyond the 1000 far plane and the scene clipped to
nothing. `frameBox` read `camera.fov` and framed the object as a dot.

A second camera at the SAME position needs none of that. `syncOrthoDepth`,
`orthoFactor` and `ORTHO_FOV` are gone, and so is the fog save/shift/restore
and the ortho branch in the theme code. The band now reads 15.00 / 42.00 in
both projections and across the round trip, because nothing moved.

### How the swap works

`camera` is a `let`, and `perspCam` / `orthoCam` are the two handles. Engage
sizes the ortho frustum to the lens's visible height AT THE ORBIT TARGET -
`d * tan(fov/2)` - so the picture at that plane is identical and only the
convergence goes out of it. Measured: target-plane points move **0.000px**,
off-plane points move 45.9px.

Leaving is the same arithmetic backwards, with one wrinkle. An ortho camera
zooms by SHRINKING ITS FRUSTUM, not by moving, so the height to match on the
way out is the current one - `top / zoom` - not the one engage recorded.
Restoring the engage distance instead sprang a zoomed-in flat view back out
the moment you turned it.

The named handles exist for the code that needs a SPECIFIC lens rather than
the live one: `frameBox` measures its flight with `perspCam.fov` because
`animateCameraTo` disengages on the way out, and the theme's far plane is
set on both so a swap cannot bring in a stale one.

### THE BUG THIS ALMOST SHIPPED WITH

**Neither camera is in the scene graph.** Three refreshes a camera's
`matrixWorld` on the way into a frame, and `matrixWorldInverse` only inside
`renderer.render`. A camera swapped in mid-tick therefore carries whatever
it had last - for the ortho one, the identity it was constructed with. Every
`project` and every `Raycaster` between the swap and the next frame read
that.

One stale matrix, three symptoms: the picture appeared to jump 65px, a
centre raycast at a cube in front of the camera returned **zero hits**, and
the round trip out looked like it had sprung back 150px. Engage and
disengage now settle `matrixWorld` and `matrixWorldInverse` themselves.

### The trap in MEASURING this

The first cut of `_lens_probe.js` reported the emulated flat view as no more
parallel than the lens - the same 15.6127 deg to four decimals. It was
measuring synchronously after the tap, so `project` was combining a STALE
view matrix with the NEW projection matrix. That combination is a uniform
scale, and **a uniform scale preserves angles exactly**. The probe was
reading a picture that had not been drawn yet, and the wrongness was
invisible because it was perfectly self-consistent.

Anything measured through `project` or a `Raycaster` after a camera change
has to wait a frame.

### Known, and not defects

- **The screen-space code that does not go through `worldPerPixel`** was not
  audited for the flat view. `worldPerPixel` got the branch it needed - it
  has no distance term in parallel projection, and the probe checks a near
  and a far point agree to 1e-9 - but any other place that scales by camera
  distance is unexamined. This is the first thing to look at if handles or
  hit radii feel wrong while flat.
- **Focusing while flat leaves you in perspective**, because
  `animateCameraTo` disengages first. Unchanged from a2.61, not revisited.
- **Serialization does not record the projection**, so a document saved
  while flat reloads in perspective. Unchanged from a2.61.
- No fresh reviewer pass ran on this version.

### Probe

`_proj_probe.js` / `_proj_probe.py`, twelve sections: the fixture really is
a converging lens before anything is claimed about parallelism; the swap
holds the target plane and moves everything else; the rails; the picking
rays; `worldPerPixel` has no distance term and matches the frustum; the
frustum survives a resize; a zoomed round trip; the fog band there and back;
the export is a live binding and `orbit.object` follows it; framing while
flat leaves the object filling a sensible part of the frame. Section 12
asserted that a twenty-degree turn dropped back to perspective; a2.86
inverted it.

`_lens_probe.js` / `_lens_run.py <wip|head>` is the comparison harness - it
injects the same probe into `git show HEAD:index.html` or the working copy,
which is how the 0.5076 deg above was got.

## Extrude's floor, and the backwards drag it uncovered (a2.84)

Extrude a Plane, and you got a box with no bottom. The note that started
this called it "extrude dissolves the initial face". It does not. Extrude
has never deleted anything.

### The face TRAVELS - it is not destroyed

`extrudeRegionOp` lifts a new vertex per region vertex, then **remaps the
selected groups' triangles onto them**. The face group keeps its identity,
its material and its index; only the indices inside it change. Walls are
then built from the rim down to the OLD positions.

On a closed shell that is exactly right. The old position had a neighbour on
every side, and the walls meet those neighbours. Nothing is missing because
nothing was ever there.

On an OPEN shell there is no neighbour, and nothing is left at the old
level. That is the hole - not a deleted face, an absent one.

### The test is openness, not flatness

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

### And then the signed volume asked a question nobody had

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

### Each and Joined had to agree

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

### Known, and not defects

- **`outlineUses` is recomputed on every frame of a live drag.**
  `applyPendingOp` restores from `op.state` first, so the mesh handed in is
  byte-identical each frame and the answer cannot change. Measured on a
  2048-quad Plane: the scan is ~3ms against ~12ms for `rebuildFromEditable`,
  and one drag frame went 33.6ms -> 38.4ms. It is the same complexity class
  `edLogical` and `separateGroupVertices` already impose - not a new one -
  but it is pure repeated work, and it is paid even by an extrude that then
  refuses. It belongs computed once in `beginPendingOp` and carried on the
  op.
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

### Probe

`_ext_probe.js` / `_ext_probe.py`, eleven sections. Each one prints its own
numbers. It checks its FIXTURES first - that the Plane really has four open
edges before anything happens, that the cube really is closed, that the two
quads of the strip really welded into a sheet with an interior edge -
because a fixture that does not contain the thing being tested passes
vacuously.

`vol()` is the one that earned its place: signed volume, positive when the
faces point out. `auditWinding.ok` cannot see an inverted shell and would
have passed the backwards drag.

## Import (a2.68 glTF, a2.69 materials, a2.70 OBJ, a2.71 STL) - READ BEFORE OLDER SECTIONS

The pipeline is one line long, because the app already owns both ends of it:

```
a file  ->  { positions, groups:[{triangles}] }  ->  rebuildFromEditable
```

`rebuildFromEditable` derives the topology, the logical vertices, the
finishes and the shading, exactly as it does for extrude, inset and every
other op. **So the importer's entire output contract is that plain object.**

**Welding is free.** `computeLogicalOf` recovers logical vertices by rounding
positions to 1e4, so a file whose vertices are split per face - which is every
file, since that is how normals and UVs are carried - re-merges itself.

**Grouping is the feature.** `computeTopology` exposes an edge only when some
face uses it exactly ONCE. One triangle per group would make every
triangulation diagonal a real, selectable, drawn edge: an imported cube with
18 edges and a seam across all six faces. Coplanar triangles are merged into
one face instead, compared against the SEED triangle's normal rather than the
neighbour's, so the plane cannot drift a degree at a time around a curve.

`IMPORT_COPLANAR_DOT` is 0.9998, about 1.15 degrees, chosen the way
`SHARP_ANGLE` was - to land on no regular polygon. Facets of a regular n-gon
prism meet at 360/n, which is 1.2 degrees at n=300: past anything a person
models by hand or a phone can subdivide.

### ONE SIMPLE LOOP, or it is not merged whole

`getGroupBoundaryLoopAttr` walks ONE boundary loop and has no concept of a
second, and `insetRegionOp` and `extrudeRegionOp` build their rim from what
it returns. Every primitive this app makes is a fan over one convex polygon,
so that limit has existed forever and has never been reachable.

**Coplanar merging makes it reachable**, with the most ordinary imported
geometry there is: a plate with bolt holes, the face of a picture frame, the
ring of triangles left around a boss on a cube's top. Inset one of those and
the outer rim pulls in, the hole's rim stays put, and the face
self-intersects, with no refusal - `rim.length < 3` does not fire.

So a region is merged whole only when its boundary is **one simple loop**:
one connected component, and every boundary vertex carrying exactly two
boundary edges - which also rejects a bowtie and a non-manifold sheet, both
of which truncate that same walk. Anything else falls back to pairing
coplanar triangles into **quads**, which cannot have a hole by construction.
A triangle with no clean partner stays its own face.

**If Inset and Extrude ever learn about multiple boundary loops, this
fallback is the thing to delete.**

### Two budgets, and the second one is the one that matters

`IMPORT_TRI_BUDGET` is 40000. `IMPORT_FACE_BUDGET` is 4000, checked AFTER the
merge because before it there is nothing to count.

Triangles are not what costs. Every face is a geometry group, a
`MeshStandardMaterial` and a draw call, and `ensureMaskPatches` walks all of
them on every `refreshUI` for the rest of the session. On a smooth or scanned
mesh neighbours differ by well over a degree, so the merge yields close to one
face per triangle: a 12k-triangle bust sits comfortably inside the triangle
budget and lands 12k materials. Both refusals say the number out loud.

### Three things a Kubik file could never have taught us

All three were found by review, not by the round trip, and each is a class of
file the app will meet the first time somebody imports something they did not
make here.

- **A negative determinant inverts the model.** `applyMatrix4` transforms
  positions and leaves index order alone, so a mirrored node - Blender
  mirrored objects, most FBX conversions - arrives wound backwards. The
  existing mirrored escape hatch (`matrixWorld.determinant() < 0` ->
  `DoubleSide`) cannot save it, because the importer BAKES the transform and
  the new mesh's own determinant is positive: it gets `FrontSide` and the
  object is invisible from outside and solid from within. Triangles are
  re-wound at import when the determinant is negative.
- **`pos.array.length` is not `pos.count * 3`** for an
  `InterleavedBufferAttribute`, which GLTFLoader builds whenever a bufferView
  is shared - i.e. for anything gltfpack or meshopt produced. Reading the
  array pushed normals and UVs in among the coordinates. Use
  `getX/getY/getZ` over `count`. **Kubik's own exporter writes tightly packed
  data, which is exactly why a round trip could never catch this.**
- **`Infinity` passed as a valid normal.** `l > 1e-12` is true when `l` is
  `Infinity`, so the normal came back `[NaN,NaN,NaN]` - a truthy array - and
  then `NaN < IMPORT_COPLANAR_DOT` is false, so the coplanarity rejection
  never fired either. One bad vertex swallowed the entire connected mesh into
  a single face AND NaN'd every position in the object, after it had been
  pushed to history and handed to the autosave.

### The lesson

**A round-trip test proves the round trip and nothing else.** Every assertion
in `_imp_probe` passed while the importer could not read an optimised .glb,
inverted mirrored models, and produced faces the app's own ops corrupt -
because the suite only ever fed it Kubik's own tightly packed, positively
scaled, single-loop output. It now carries foreign fixtures: a square annulus
with a hole, a negative-scale node, and a hand-built interleaved buffer with
a poison value in the spare channels.

## Performance, measured (a2.74) - READ BEFORE OLDER SECTIONS

**Both standing performance notes were wrong.** Neither had been re-measured
since it was written, and one of them could not have been measured at all
with the tools that existed.

### First, the tools could not measure time

Every probe suite runs under `--virtual-time-budget`, where Chrome advances
the clock only while the page is idle - so synchronous JavaScript takes
**zero virtual time** and `performance.now()` reads 0.0ms across any amount
of work. That is why `_perf_probe` counts operations instead of timing them,
and it is why two timing assertions written this week passed while measuring
nothing at all.

`_time_probe.py` is the answer: no virtual time, a real clock, and the
results come back by **POST** rather than by scraping the DOM (without
virtual time, `--dump-dom` fires long before a probe has finished). Numbers
from it are headless-SwiftShader-on-a-desktop, not an iPhone - but the work
is CPU-side JavaScript, so the SHAPE of a curve and the RELATIVE cost of
phases carry over. An absolute millisecond from this harness means little.

### "Subdivide is superlinear (L5 = 1454ms)" - NOT AS STATED

Measured, one level at a time from a cube:

```
L1     48 tris   16ms
L2    192 tris   11ms  (x0.7)
L3    768 tris   24ms  (x2.2)
L4   3072 tris   64ms  (x2.7)
L5  12288 tris  220ms  (x3.3)
```

Each level multiplies triangles by four, so **4x per level is linear in
output size and is the floor**. Subdivide runs at 2.2-3.3x. It is
*sub*-linear per triangle, and L5 is 220ms rather than 1454ms.

### "The op-bar drag rebuilds the face overlay every frame" - MIS-STATED

Measured: **0 overlay index rebuilds across 12 slider frames.** a2.54 made
the overlay one mesh borrowing the mesh's own position attribute, and
a2.64a's comment already said this claim was mis-stated. It is now measured
as well as argued.

### Where the time actually is: `applyShading`

```
rebuildFromEditable   2.6ms   at 768 triangles
  of which applyShading 2.5ms
```

**`applyShading` is ~95% of `rebuildFromEditable`, and every op in the app
funnels through `rebuildFromEditable`** - so it is the floor under
everything. And it is the thing that is superlinear:

```
applyShading:  48 tri 0.2ms | 192 0.5ms | 768 2.1ms | 3072 8.2ms | 12288 45ms
```

The last step is 5.9x the time for 4x the triangles.

**One op-bar slider frame on a 3072-triangle model costs ~10ms here against a
16.7ms frame budget, and a phone is slower.** Imports made a model that size
one tap away, which is what moves this from theory to the main risk.

### What was ruled out, so nobody re-checks it

- **The topology cache is not the story.** `shadingTopoFor(geo)` is cached
  per geometry, and `rebuildFromEditable` installs a NEW geometry on every
  op - so the cache can never hit during real work. Measured anyway: 7.7ms
  warm vs 9.9ms cold. The topology rebuild is ~2ms of it; the per-call work
  is the rest.
- **The normal arithmetic is not the story.** The same triangle-normal maths
  with no allocation is 0.4ms against applyShading's 9.7ms.
- **The redundant `computeVertexNormals()` is real but load-bearing.**
  applyShading calls it as a safety baseline and then computes its own
  normals, so normals are built twice - 9-11% of the call. It cannot simply
  be moved into the `catch` that already calls it, because the per-vertex
  loop deliberately falls back to that baseline for a degenerate fan
  (`// degenerate fan: keep the baseline`). Removing it means writing a
  cheaper degenerate handler, which is a change to shading CORRECTNESS, not
  a performance tweak. Worth doing; not worth doing carelessly.

### The next candidate, with a reason

The **wear-edge pass** at the end of applyShading walks every edge and
builds the convex/concave edge list for the Cavity and Edges masks. Its own
comment says the distance field it feeds is baked "lazily and throttled, and
only for an object that is actually wearing a shape mask" - but **the list
itself is built on every shade, for every object, whether anything uses it
or not**, which is the common case.

Guarding it needs care: `ensureEdgeField` bakes from
`geo.userData.kubikEdges`, so an object that gains a mask later must fill
the list lazily rather than find it missing. That is the same shape as
`ensureEdgeField`'s own laziness, so there is a pattern to follow.

### The wear-edge pass runs for the objects that use it (a2.75)

The convex/concave edge list that feeds the Cavity and Edges masks was built
on **every shade, for every object**, whether anything used it or not. The
distance field baked from it was already lazy, throttled and masked-objects-
only; the list itself was not.

**Measured against itself** - same object, same run, flag flipped: **1.2ms of
8.5ms, 14% of applyShading**. Cross-run comparison would have been worthless;
the machine drifted 3x on untouched code between two runs an hour apart.

`mesh.userData.wantsWear` is written by `ensureMaskPatches`, which already
walks every material of every object, so the answer costs nothing extra.
`defWantsField` is the predicate that used to be inline in `applyMaskPatch`.

### An absent list is not neutral

`ensureEdgeField` returns null, the caller substitutes a **1x1 black
texture**, and black means "distance zero, everywhere is an edge" - so the
object renders **fully worn**. That is on record from the duplicate path,
which is why `ensureWearLists` exists rather than a comment saying it cannot
happen: it refills for an object that gains a mask later.

The guard is `wantsWear === false`, not falsy. **`undefined` means nobody has
asked yet and the list is built** - so every path that has not been thought
about lands on the safe side. Duplicate, separate, join, import, load, undo
and redo all create meshes with no flag, and all build.

**"Tried and failed" must not look like "never asked."** `ensureWearLists`
retries until `kubikEdges` exists, and applyShading has two exits that used
to leave it absent - an indexless geometry, and the outer catch. For a model
whose shading throws, that turned a once-per-op failure into a full failed
shade on every `refreshUI`. Both exits now stamp an empty list.

### Where the refill hangs, and where it must not

On `refreshUI` and on the two **structural** funnels - `mkStructural` and the
bevel-crossing branch of `meApplyLive`. NOT on `updateMaterialEverywhere`,
which is wired to `input` and therefore runs per pointermove: the live
sliders cannot change the answer anyway, since `defWantsField` reads `bevel`,
`on`, the curvature mode, `colorOn` and `roughOn`, and none of them is what a
live slider writes.

And not from `ensureMaskPatches`, though that is where the flag is set:
`ensureMaskPatches` is reached from `reconcileFinishes` inside
`rebuildFromEditable`, which calls `applyShading` itself a moment later, so a
refill there would shade every masked object twice on every op.

### The cost that moved

Enabling a mask on a material worn by N objects now costs N full shades in
that tap, where before every object always had a list. Net still a win -
1.2ms on every op against N x 8.5ms once - but that is where a2.75's cost
now sits.

### a2.74's own change, honestly

The triangle-normal loop allocated **three** `THREE.Vector3` per triangle
where only one - the normal, kept in `triNormal` - outlives the iteration.
Two are now hoisted scratch vectors. Identical arithmetic, 24,000 fewer
objects per call on a 12k mesh.

**It did not move the number here** (9.7ms vs 9.8ms, against run-to-run
variance of +/-0.5ms). It is kept because it cannot be worse and a phone is
more allocation-sensitive than a desktop V8 - but that is a reason, not a
measurement, and it has not been verified on the target.

## Surfacing (a2.73)

Things in this app do not switch on. They come up through a layer of
something and settle, and go back down into it. `blur(10px) -> 0` with
`scale .94 -> 1`: **260ms rising** on a curve that decelerates hard, **180ms
sinking** on one that accelerates. Rising is slower on purpose - arriving is
an event and wants to be seen, leaving is bookkeeping and wants to be out of
the way.

Applied to the op bar, the pivot bar, the inspector and the isolate chip -
the things that appear out of nowhere. `#firstHint` had been doing it alone
since a2.66; this generalises that prototype.

### `scale`, not `transform: scale()`

Half of these already carry a transform to centre themselves, and a keyframe
animating `transform` overwrites it - which is why the prototype had to bake
`translateX(-50%)` into both of its keyframes and could never be shared. The
independent properties compose: the chain is `translate * rotate * scale *
transform`, so an element's own `transform` is untouched.

The centred ones (`#toast`, `#isoChip`) moved to `translate: -50%` for the
same reason: with `transform` the scale is applied about the pre-centring
origin and the element visibly drifts sideways as it grows. **`#toast.show`
sets a transform of its own, so it had to move too** - otherwise the base
rule and that rule both applied and the toast was centred twice over.

### `backwards`, not `both`

`both` holds the animation's END state, which here is `filter: blur(0px)` -
and a filter of zero is still a filter: the element stays on its own
composited layer, over a live WebGL viewport, for the rest of the session.
The first cut relied on an animationend listener to strip the class, and
**an animationend is not guaranteed to arrive** - a background tab, a
`display: none` ancestor, or reduced motion (where the rule is `animation:
none`) and it never fires. `backwards` fills only BEFORE the animation; when
it ends the element reverts to its own styles, which have no filter.

### HIDDEN MEANS HIDDEN, immediately

The first cut deferred dropping `.show` until the exit animation finished,
and that was wrong in a way no care inside the helper could fix: for 180ms
after closing a panel, `classList.contains('show')` still said it was open.
**Seven probe suites failed on it** - "cancel the op, is the bar gone?" - and
they were right to. Anything in the app asking the same question would have
got the same wrong answer, and the panel stayed hit-testable the whole time,
eating the next tap.

So `.show` is dropped at once and the element is kept painted by freezing its
own computed `display` into an inline style, which outranks the now-absent
`.show` rule. `.submerging` also sets `pointer-events: none`.

### The three states that have to be handled

- **Re-opened while sinking.** Removing `.submerging` cancels its animation,
  which fires animation**cancel**, not animation**end** - so a listener left
  attached survives and then fires on the animationend of the RISE that
  replaced it, hiding a panel 260ms after the user reopened it. Reachable in
  one tap: `refreshInspector` calls `surfaceToggle(false)` then `surfaceIn`
  on the same element when the selection empties. Both directions clear each
  other's listener AND timer through one WeakMap.
- **Already up, including already on the way up.** A repeated `surfaceIn`
  that restarts the animation also resets its own cleanup timer, so it never
  finishes: the element sits pinned at the first frame, invisible and
  blurred. `refreshInspector` runs on every pointermove of a drag, so that
  was a whole gesture with the inspector missing.
- **Closed twice.** The second call must NOT clear the first one's pending
  cleanup, or the frozen inline `display` and `.submerging` stay for ever.

### What it is deliberately not on

- **The drawer and the material tray.** Both already have a considered
  movement - the drawer slides from its edge, the tray rolls out - and that
  IS their character.
- **The toast.** By far the most frequent thing on screen, it fires during
  drags, and blurred text is the least forgiving thing to blur. It keeps its
  own quiet fade.
- **Anything mid-gesture** - the tool ring, the ring label. A blur over the
  live viewport during a drag is the one case that has to be measured on a
  real phone, and **this release does not measure it**: headless Chrome
  freezes `performance.now()` under a virtual time budget, so no timing
  assertion in this harness means anything. The frame cost of the four
  elements it IS on is bounded - the largest is ~746x260 device px for 260ms
  - but the ring is a per-frame question and stays out until someone looks.
- `#inspector` carries `backdrop-filter: blur(6px)`; `.surfacing` and
  `.submerging` set it to `none` for the duration, because blurring the
  backdrop AND the element is a read-back of the live canvas plus a second
  blur on the result, and WebKit has been inconsistent about the pair.

## The baseline shade, and what was still reading it (a2.83)

`applyShading` opened with `geo.computeVertexNormals()`, commented "safe
baseline: if anything below throws, the mesh is still shaded". The per-vertex
pass then overwrote it. It cost **15% of every shade**, and `applyShading` is
~95% of `rebuildFromEditable`, which every operation funnels through.

Three versions of the performance queue called this "the double normals item"
and put it fifth, worth 7-9%. Both numbers were stale: a2.77 and a2.82 shrank
the phases around it, so by the time it came up it was the second biggest
thing in the function.

### What it was still doing, counted rather than assumed

An instrumented copy counted, per attribute vertex, every way out of the
write loop - over every primitive, a subdivided cube, an open plane, a
deliberately broken fixture, and after extrude, inset, bevel, subdivide,
solidify, array, cleanup, crease and slide:

- **32,265 of 32,277** index-referenced attribute vertices were written by the
  union-find. The baseline's answer for them was thrown away.
- The other **12** were all one branch, the `degenerate fan`, and all on the
  fixture built to cause it. `g < 0`, `ufStamp[g] !== stamp` and
  `accStamp[r] !== stamp` never fired once - and the review then showed they
  **cannot**: `g` came from a triangle at this vertex, so `enrol` ran on it in
  the same iteration, and that triangle is in `tris`, so its root was
  accumulated. The measurement of zero is what the code guarantees.
- On those 12 the baseline gave **(0,0,0)**. A fan whose island cancels
  usually cancels for the baseline too, so the fallback rendered them black -
  it did not work in the only case it existed for.
- **104 of 147 calls** arrived with **no normal attribute at all**, because
  `rebuildFromEditable` hands over a brand new `BufferGeometry`. Allocating
  the attribute was the baseline's real remaining job.
- Where it WAS overwritten, the baseline differed from the shading answer by
  up to 0.359 between unit vectors - **21 degrees**. It was never an
  approximation of the answer; it was a different answer that happened to be
  replaced.

### What changed

The shading pass goes; the allocation stays, and only when the attribute is
missing, the wrong length, interleaved, or not a packed `Float32Array` - the
write loop pokes `.array` directly, so nothing else is safe to keep. The two
paths that genuinely need a cheap full shade, the unindexed exit and the
`catch`, each ask for one themselves, and the exit asks **before** the
allocation: three.js creates and fills the attribute in one pass when there
is none and falls back to a JS loop re-zeroing an existing one when there is,
so allocating first would have made those paths slower than before.

**And the degenerate fan gets a real answer.** The fallback is the vertex's
own face group normal - the flat-shaded answer, area-weighted, already
computed, and inside the same shading model instead of borrowed from a
different one. Where even that cancels, because the face group is folded back
on itself and no normal is right, any triangle of the group at this vertex is
a unit vector along one of the two sheets, which beats nothing.

That fallback leans on an invariant nothing else in the file has depended on:
**a face group is exactly one face.** True of everything the app builds, but
`buildShadingTopo` synthesises a single group spanning the whole mesh when
`geo.groups` is empty, and a closed shell's every-triangle sum is zero. It is
written down at the line that would have to change.

### The numbers

With the deleted call injected back into an instrumented copy so both are
measured in ONE run at 3,072 triangles: **`1_baseNormals` is 15% of a warm
shade and 10% of a whole operation.** After: 0%.

The answer was checked as an answer, not as a timing. The same battery of 20
models built under the committed file and under the working copy, comparing
every normal of every model: **18 of 20 digests identical**, and the two that
differ are the folded-fin fixtures, where three zero-length normals became
three unit ones.

### One free thing next door

`createPrimitiveObject` shaded three times. `createCubeObject` shades,
`setPrimitiveGeometry` ends at `rebuildFromEditable` which shades, and then
there was a third `applyShading(obj)` on geometry that had just been shaded
and had not changed since. The first two are unavoidable - the cube has to
exist before its geometry can be replaced. The third is gone.

## Shading's union-find, and a stamp instead of a clear (a2.82)

a2.77 finished by naming the biggest remaining phase of `applyShading`:
`6_unionFind`, 30-36% of a warm shade. This is that phase.

### What it was doing

At each logical vertex, `applyShading` has to work out which of the
attribute vertices sitting there belong to the same smooth island, then
average their normals together. It did that with a union-find built out of
`Map`s - a `parent` Map and an accumulator Map, allocated, filled and thrown
away once **per logical vertex**, tens of thousands of times a shade. The
work per vertex is a handful of pointers; the allocation and the hashing
around it are not.

### What it does now

One module-level scratch, `ufScratch(n)`, of typed arrays that grow and
never shrink, plus a **stamp** - an integer bumped once per logical vertex.
A slot belongs to the vertex being processed only if its stamp matches;
anything left behind by the previous vertex reads as absent. **So nothing is
ever cleared.** `find` walks `Int32Array` slots instead of Map buckets, and
a `touched` list records the few slots this vertex actually used, so the
write-back visits those and no others.

Past 2^31 the counter resets and the stamp arrays are re-filled with -1, so
a session long enough to wrap cannot wrap into a collision.

### The stamp is spent BEFORE the work, not after

The first version wrote the counter back after the per-vertex loop
finished. `applyShading` is wrapped in a try/catch that falls back to flat
normals - a real path, not a hypothetical - so a throw part way through a
shade left the counter where the last SUCCESSFUL shade had put it, and the
next shade re-issued stamps this one had already written into the arrays.
The damage is silent: normals averaged across islands that are not
connected, and not unit length, with no error anywhere. `stamp =
++UF.stamp0;` as the first line of the loop body makes every vertex's stamp
permanently spent whether or not the shade it belongs to ever finishes.

Probe section 4 pins this. A lever injected into the harness's own copy of
index.html - never into the shipped file - makes a shade throw on its 20th
vertex; the shade after it comes back bit-for-bit identical to the one
before the failure, and every normal is still a unit vector, which is
exactly what a stamp collision would have destroyed.

### `sharp` moved onto the record, and the Map that held it is gone

`buildShadingTopo` still kept a `sharp` Map beside the edge records a2.77
introduced. Nothing read it - it had been write-only since a2.77 - so the
Map is deleted and `sharp` is a field of the record, declared in the record
literal rather than assigned afterwards, so every record keeps one hidden
class.

### The numbers

`_race_probe.py` injects the OLD Map-based loop into a copy of index.html
alongside the new one, so both run in the same page, in the same run,
against the same geometry:

| triangles | old | new | |
|---|---|---|---|
| 48 | 0.03ms | 0.03ms | - |
| 192 | 0.15ms | 0.06ms | 58% |
| 768 | 0.56ms | 0.25ms | 56% |
| 3,072 | 1.89ms | 0.84ms | 56% |
| 12,288 | 11.75ms | 7.30ms | 38% |

Over 77 shades: 180.3ms old against 103.0ms new - **43% off the union-find**,
and **all 1,325,952 normal components identical bit for bit**. As a share of
the whole of `applyShading`, `6_unionFind` falls from 30% warm / 23% of the
operation to **13% / 9%**.

### The measurement that lied first

The first race reported -500% at 48 triangles: the new loop five times
SLOWER. That was cold JIT - the race ran each version once, while the
project's own `timeIt` takes a median for exactly this reason. With four
warm-up shades before timing, the small-mesh row went neutral, which is the
honest answer: at 48 triangles there is nothing to win. **A benchmark with
no warm-up measures the compiler, not the code.** The scratch buffer was
added while chasing the phantom and is kept because it is right anyway.

### What is now the biggest thing

`2c_windingComponents` - 8-16%, and its share grows with the model. The
double-normals item was taken at a2.83, and it WAS a shading-correctness
change - see that section, above this one.

## Clean up (a2.81)

Seat 10 ring 0 in the Object ring, **inboard of Subdivide** — the two ops
that change how much mesh there is without changing what shape it is. Two
chips, each carrying its own slider range (the a2.78 machinery).

### Triangulate is not here, and that is a finding

`op-gap-analysis.md` listed it on the general modelling rule that n-gons are
not acceptable in exported geometry. **That rule does not apply to this app.**
Kubik's n-gon is a FACE GROUP — a way of talking about a run of triangles —
and it exists nowhere outside the editor. `buildExportGroup` clones the
`BufferGeometry` as it stands, which is indexed triangles, and all three
exporters are three's own. **No `.glb`, `.obj` or `.stl` this app has ever
written contained an n-gon.** There was nothing to triangulate.

A note is not a measurement, again — and this one was three versions old and
had been repeated in the ranked list every time.

### Tris to quads is a REGROUPING

Not one vertex moves and not one triangle is made or destroyed. Two
single-triangle faces sharing an edge become one two-triangle face, and the
shared edge stops being an outline and becomes that face's own diagonal — a
distinction `getGroupBoundaryLoopAttr` and `edgeUse` already draw.

**Why it is worth having:** `edgeLoopOp`'s ring walk steps only through faces
whose outline has four sides ("a ring can only cross four-sided faces"), so an
imported all-triangle mesh **cannot be loop cut at all**. Pairing is what
turns an import from something you can look at into something you can edit.
Probe section 4 asserts exactly that: the same mesh refuses a loop cut before
and takes one after.

The import path already pairs triangles this way — `emitPairs` inside
`mergeCoplanarTriangles` — but at the fixed `IMPORT_COPLANAR_DOT` of 0.9998,
about 1.15°, which is why a **curved** import arrives as one triangle per face.
This is that idea with the tolerance in your hand.

### The corners have to be the same ATTRIBUTE vertex

The subtlest part, and it was wrong first. `separateGroupVertices` gives every
face group its own private copies of its corners — that is what lets
neighbouring faces hold different normals and be hard-edged — so two faces
meeting at an edge share **positions but not attribute indices**. Dropping
their triangles into one group unchanged leaves six corners at four places,
and `getGroupBoundaryLoopAttr`, which walks attribute indices, then reports a
six-sided outline. The paired mesh still could not be loop cut, so the op
achieved nothing it was built for while reporting success.

### And then it proves the quad rather than assuming it

The op's whole purpose is to produce four-sided faces, so it builds the
candidate and runs `getGroupBoundaryLoopAttr` on it, requiring exactly four
distinct corners. That one call closes two real holes the review found:

- **Two coincident triangles** share all three logical edges, so all three
  candidates score a perfect 1.0 and sort to the *front* of the greedy. The
  remap resolves every corner of the mate into the first triangle's, and the
  "quad" is two triangles over three vertices with no outline at all.
- **A folded pair wound inconsistently** still has agreeing normals, so the
  angle test passes, but both triangles emit the shared edge the same way and
  the outline walk returns a three-entry loop over a four-corner face — not
  loop-cuttable, and it tears the next time `extrudeFaceGroup` or
  `insetRegionOp` builds a rim from it.

### What it refuses to pair

- **Different `finishes`** — the app's own answer to "same material", derived
  by `reconcileFinishes` from the stamp. Pairing across it would silently
  repaint half a face.
- **Different smooth flags.** `smoothGroups` is a separate per-group map the
  finishes guard says nothing about, and the merge keeps only the lower
  group's flag — so group ORDER decided which shading survived.
- **An edge that is not used by exactly two faces**, counted over **every**
  face rather than only the single triangles. Counting the candidates alone
  cannot tell a manifold edge from a triangle meeting a quad, so it bonded
  across T-junctions while a comment claimed it was checking for a clean pair.
- **An already multi-triangle face.** A quad or an n-gon is a statement
  somebody made, and pairing it would undo that.

Greedy on the **flattest first** rather than first-come: a triangle usually
has two or three willing partners, and taking whichever came up first leaves
the better pairing with nobody — which is how a curved surface ends up half
quads and half stripes.

### Merge by distance

Clusters vertices within a fraction of the model's size through a spatial hash
(cells the merge distance wide, so the 27 neighbouring cells are the complete
search) and a union-find, moves each cluster onto its centroid, and lets the
**ordinary weld** finish the job — `computeLogicalOf` already treats two
vertices at the same rounded position as one. Deliberately the same mechanism
the rest of the app welds with, rather than a second one that could disagree.

Merge and Weld already existed, but both want Vertex mode, a hand-made
selection and the fixed `MERGE_EPS`, so "clean up whatever this import left
behind" was not a thing you could ask for.

Triangles whose corners land on each other are dropped, and a face left with
no triangles goes with them. That is what closing a crack means. **It says how
many**, because the app's standard is that throwing something away is said out
loud — Smooth by angle reports the marks it cleared for the same reason.

**And the position-keyed marks move with it.** `creases` and `edgeShade` are
keyed by coordinates, and this op both moves vertices *and* collapses edges —
the exact pair of things Collapse's own note warns about: a mark on a
collapsed edge becomes a key whose two halves are the same point, which is a
crease on nothing and, worse, aliases onto whatever later lands there.
`remapMarksByPoint` now drops those and carries the rest.

### The readout learned to count

`opValueEl` was hardcoded to three decimals, which was enough while the
coarsest step was 0.005. Merge steps by **0.0002**, so its first two stops
both displayed as "0" and about a fifth of its range read as 0 or 0.001 —
including anything typed into the box, because the blur handler writes the
same rounded value back. `amountDecimals` takes them from the active option's
step.

## Edge / vertex slide (a2.80)

Moves an existing loop along its ring without changing its shape or the
topology round it. Loop cut lets you slide a loop **while placing it**; until
now a loop already in the mesh could only be deleted and re-cut to move it.

Seat 9 in the Vertex and Edge rings — **Loop's own seat** in the Edge ring,
because Loop cut makes a loop and Slide moves one, and they sit side by side.
The amount is a signed fraction of the way to the neighbouring loop, opening
at 0. Face mode is left out on purpose: sliding a face patch's rim is what
Inset already does, and better, because Inset keeps the patch's shape instead
of dragging each rim vertex down its own edge.

### The selection reading was already paid for

`flowSelectionItems` answers "which vertices are the loop, and what are the
two vertices ACROSS it from each one", and `flowItemsForLoop` already refuses
where "across" means nothing — a pole, a boundary, and the corner where the
loop turns and its two non-loop neighbours sit at right angles on the *same*
side rather than opposite one another. Set flow needed exactly that and paid
for it in three review rounds. Slide inherits all of it.

### What is not free: which side is which

`a` and `b` come out of the neighbour map in whatever order it built them, and
nothing makes that order agree from one loop vertex to the next. Sliding on
the raw pair sends half the loop one way and half the other.

**The side is propagated along the loop, not chosen per vertex.** Two
neighbouring loop vertices are on the same side when the across-vertices they
chose are themselves joined by an edge — the far side of the quad they share,
the same "step across the quad" `edgeLoopOp` walks a ring with. One vertex is
seeded arbitrarily and the rest follow.

Everything below this line is a defect the review found in that one layer.

### Symmetry has a SIGN, and a sign does not mirror

The first cut called `symExpand` and reasoned "per-element, like Set flow, so
the union with the mirror is the right way to be symmetric". **That does not
carry.** Set flow is per-element *and direction-free* — each vertex goes where
its own neighbourhood says, which is mirror-covariant on its own. A slide has
a global sign, and the mirror of "toward +X" is "toward −X". The mirrored half
was simply a second island with its own arbitrary seed.

Measured on a tube along X with X symmetry: both loops slid the **same way
through the model** and the object came out lopsided. It was right only by
accident, when the ring happened to run perpendicular to the mirror plane.

Now every mirrored pair takes the **mirror of its partner's** side, lowest
logical id winning so the answer does not depend on map order. It is the same
question `decideLoopCutFlip` already asks of a loop being placed.

### Islands, and the seam between them

The BFS removes the arbitrariness *inside* an island and leaves it *between*
islands: two loops picked at once, or the arms either side of a crossing, each
got their own seed off whichever neighbour the map listed first — so one drag
could send one loop up and the other down, and which way round changed with
every edit. Islands are now aligned to the first one's mean direction. Not a
proof, but right whenever the loops are roughly parallel, which is the only
time picking several at once means anything.

A junction where neither pairing is joined still starts its own island. A
**second path that disagrees** with the first, though — a loop that closes
with a twist — is now detected and refused, where before it tore the loop at
exactly one edge in silence.

### All of the loop or none of it

A vertex with no across-pair simply stayed put while its neighbours moved up
to a whole quad: a spike in the mesh from one drag of the slider, with nothing
said about it. Set flow tolerates that because its corrections are small;
a slide's are not. Slide now refuses and says how many points are short.

### "Along the loop" is the loop's own edges

`alongFrom` used "a selected neighbour that is not my own across-pair", which
is only a **proxy**. It is wrong wherever a diagonal is a genuine edge — a
cap-hole fan, a knife cut, imported triangle soup — where a diagonal neighbour
can propagate the side across the wrong quad and flip a stretch of the loop
with nothing on screen to say so. `slideLoopKeys` rebuilds the loop's actual
edge set, the same reading `flowSelectionItems` does internally and discards.

### The stop is relative; the weld is absolute

`SLIDE_LIMIT` of 0.95 exists so the loop never lands exactly on its neighbour
and welds. It does not keep that promise on its own: `computeLogicalOf` welds
two points that round to the same ten-thousandth, and Kubik has no unit, so on
a small enough model a twentieth of the gap is *inside* the weld tolerance.
Measured: a cylinder 0.01 tall went from 60 logical vertices to 48 at 0.95.

`SLIDE_MIN_GAP` (5e-4) is an absolute floor, and the per-frame limit is
whichever is tighter. On the small fixture the cap comes out at 0.80 instead
of 0.95 and the vertex count holds.

### Note for the next person

`ring: 0|1` in the tool tables is carried for consistency but **nothing reads
it** — `toolRingAngles` lays every tool on one circle sorted by `seat` alone,
so two tools sharing a seat come out as neighbours in declaration order rather
than one behind the other. An earlier draft of Slide's own comment said
"outboard of Loop", which is a layout the code does not produce.

## Solidify (a2.79)

Gives an **open** surface a thickness: a plane becomes a slab, an imported
single-sided shell becomes something you could print. Seat 9 of ring 0 in the
Object ring, **inboard of Flip normals** - both ops are about a surface having
only one side. Flip normals answers "it is facing the wrong way"; Solidify
answers "it has no back at all".

### Three options, two numbers

Whatever you pick, the answer is two copies of the surface at `d0` (front,
keeping the winding) and `d1` (back, every triangle reversed), plus one wall
per rim edge joining them:

| option | d0 | d1 |
|---|---|---|
| **Behind** (default) | 0 | −t | the surface you see stays exactly put |
| **Centred** | +t/2 | −t/2 | |
| **In front** | +t | 0 | the surface becomes the back |

Writing them as two numbers rather than three code paths is what stops them
drifting apart. The thickness is a **fraction of the model's own size**, for
the reason Circularize gives for its blend and Array for its spacing: one
range then means the same thing on a business card and on a barn door.

### The wall winding runs the other way to extrude's

Not a typo, and worth the note because the next person will reach for
`extrudeRegionOp` as the model. Extrude keeps the original rim where it is and
puts its moved copy **in front**, so its wall climbs from old to new. Here the
copy that keeps the original winding is the **front** face and the new surface
is **behind** it - the mirror arrangement - so a wall wound extrude's way
faces inward.

**Measured, not reasoned.** With extrude's order the four walls of a
solidified plane each came out at −0.0167 of signed volume against the back
cap's correct +0.0333, and `auditWinding` reported 8 conflicting edges. The
per-group volume breakdown is what localised it; the total alone said only
"inside out or degenerate" and would have sent the next guess to the caps.

### No rim walk - and that is the fix, not a shortcut

The first cut walked the rim into ordered loops the way `extrudeRegionOp`
does. That is wrong here. A `next` map holds ONE outgoing edge per vertex and
a `walked` set blocks any later chain from crossing a vertex an earlier one
claimed, so **two rim loops meeting at a single shared vertex** - which is
every checkerboard of deleted faces - lost the walls on both edges at that
vertex *and* grew a wall across an edge that does not exist, closing the chain
that had been cut short. It returned true and the toast said "solidified".

Every wall depends only on its own two ends, so the loops bought nothing.
Iterating the rim list directly gives exactly the same walls on clean input,
one per rim edge, with no ordering assumption anywhere. Probe section 15 pins
the pinch case: two quads touching at one corner come back watertight with
exactly 4 caps and 8 walls.

Extrude still walks loops, and is still right to: it only ever walks a handful
of user-selected faces, where the failure needs a selection shaped like a
checkerboard. Solidify walks the whole mesh.

### What it refuses, before the bar opens

Array keeps its bar open on a refusal because its refusal is
option-dependent - switching Ring to Line makes it succeed. Solidify's are
true of every option across the whole slider, so a bar opened over one is dead
on arrival. `solidifySurvey` runs the cheap half and `solidifySelection`
refuses without opening:

- **already closed** - two nested shells would be legal, but hollowing is an
  invisible result that doubles the face count. A different tool if ever
  wanted.
- **uneven scale** - the thickness is measured in local space and applied
  along a local normal, so under 1,1,10 it comes out thin at the sides and the
  toast's percentage means nothing you can see. Same reasoning as Array's Ring
  refusal.
- **no area to thicken.**

### A zero-area face is dropped, not just ignored

`loopNormal` returns a normalised vector, so zero length means the outline
encloses nothing - a sliver, which imported `.stl` files are full of. Left in,
it did two kinds of damage: its zero normal made the lean factor come out at
0, which clamps to 0.35 and made every vertex it touched **2.9x too thick**;
and its two coincident outline edges landed on the same undirected key twice,
pushing a genuinely open edge's count to 3 so it read as interior and got no
wall - a hole in a "closed" result.

Merely leaving it out of the normals was not enough either: its middle vertex
then belonged to no face with an area and had no direction to grow in, which
refused the whole op over one stray triangle. So the face is dropped from the
result. You cannot give a face with no area a thickness.

### Marks, materials, and what a wall inherits

Each wall inherits the material, smooth flag and finish of **the face it grew
from** - the owning group travels with the rim edge. Face 0 for all of them
was the first cut and made a multi-coloured shell come back with one arbitrary
colour round its whole edge.

The position-keyed `creases` and `edgeShade` follow the **front** surface
through `remapMarksByPoint` - a point-to-point map, where Array's
`moveMarkKeys` is a matrix, because here every vertex goes its own way. A mark
on a **rim** edge is deliberately dropped: that edge is now the joint between
the face and its new wall, and an explicit "smooth" there beats the angle rule
and smears the one edge of a solidified card that should be crisp.

### Known limits, stated rather than hidden

- **A T-junction produces overlapping walls.** Three collinear rim edges each
  have a count of 1, so all three get walls and two of them pass through
  solid material. The op returns true. Detecting collinear overlap is real
  work and no other op in the app does it either.
- **The vertex normal is unweighted.** A vertex with six small triangles on
  one side and one large quad on the other leans toward the small side;
  Blender weights by corner angle.
- **Past a dihedral of about 41 degrees the surface thins** rather than
  exploding - the lean clamp of 0.35 - and there is no self-intersection
  check, so a sharp valley crease with a large thickness will cross itself.

## Array (a2.78)

**One object, not N.** Twelve bolts come back as one thing you can bevel,
subdivide, shade or drag as a unit; **Separate** breaks it into twelve if you
want them loose. The app already owns both directions, and a modifier stack
is on the do-not-build list - Kubik is destructive with a strong undo, which
is the right trade for a fidget.

Seat 0 of ring 1 in the Object ring: **Duplicate's bearing, one ring out**,
which is the pairing seat 1 is reserved for (Fillet beside Bevel). Array is
what Duplicate is when you want more than one. It also lands beside Mirror
and Flip, which is the right company - those three are the ops that read
`App.symmetryAxis`.

### The three controls

| control | Line | Ring |
|---|---|---|
| stepper | **count**, the total including the original - a ring of 12 is the 12 you would say out loud | same |
| slider | **spacing as a multiple of the shape's own extent** along the axis: 1 is touching, 2 leaves a whole shape's gap | **sweep in degrees**, opening at a full 360 |
| axis | `App.symmetryAxis` | the axis the ring turns about |

The spacing is scale-free for the reason Circularize gives for its blend: one
range then means the same thing on a screw thread and on a hundred-unit wall,
where a distance would need re-scaling for every selection.

**A full turn divides the sweep by n; an arc divides by n-1.** At 360 the
first and last copy would be in the same place, so n steps of 360/n is what
closes a ring evenly; over a quarter turn you want the first copy at one end
and the last at the other, which is n-1 gaps. Getting this wrong is the
classic array bug - a ring of twelve with two bolts on top of each other.

### What a Ring turns around

The **pivot** when one has been placed - that is what the pivot is for, and
why this op waited for a2.39 - and otherwise the **world origin**, which is
the one point in this app you can always aim at (see where primitives land,
a2.36a). Never the shape's own centre: every copy would land on the last one.

### An option can carry its own slider range

New machinery, and Array is why. Line's amount runs 0.5 to 4 and Ring's runs
15 to 360; one range cannot mean both, and two ops would put one idea on two
ring seats. The spec declares `min`/`max`/`step`/`start` **on the option**,
`activeRange(op)` returns the live one, and `applyOptionRange` applies it.

Three things that all had to be true, each of which was wrong first:

- **Every clamp asks `activeRange`, not the spec.** `setPendingAmount` used
  the spec's max, so the first touch of the slider clamped Ring's 360-degree
  sweep to Line's 4 and the ring collapsed to a fan.
- **The amount is remembered per option**, so Line to Ring and back lands
  where Line was rather than inheriting 360 as a spacing - which arrays the
  shape 360 of its own widths apart.
- **It is idempotent, via `op.rangeFor`.** It is reached from
  `refreshOpAmountVisibility`, which the COUNT STEPPER also goes through, so
  without the guard every +/- press re-read the option's `start` and threw
  away the sweep. Array's count is its primary control, so that fired
  constantly.

It engages only for a spec that really declares a per-option range; the other
chip ops (Extrude, Inset, Bevel, Bridge, Subdivide) mean the same thing by
`amount` whichever chip is lit.

### What travels to the copies

Built on `combineObjectsInto`'s shape - the function Join already uses to
concatenate two objects. Every copy gets its **own face groups**, its **own
cloned materials**, and its own `smoothGroups` / `finishes` entries, pushed in
lockstep so the group count and the material array can never disagree (a
geometry with more groups than materials crashes three's raycast).

Sharing one set of groups would have been cheaper and much worse: twelve
bolts would read as one six-faced object, where tapping a face selects it on
all twelve and painting one paints them all.

**The position-keyed marks travel too.** `creases` and `edgeShade` are keyed
by coordinates, not by group, so a copy that lands somewhere else simply had
no entries and fell back to the smoothing angle - a cube with one hand-marked
sharp edge arrayed into one marked cube and eleven unmarked ones.
`moveMarkKeys` reads each key back and re-keys it through the same matrix the
vertices went through.

**The outgoing materials go in the bin.** This op REPLACES the whole material
array rather than appending to it, and re-runs on every stepper press and
slider frame, so without `binMaterials` each frame abandoned one material per
face group and the WebGLProgram refcount was never released.

### The axis is captured, not read live

`op.axis`, set when the bar opens. The axis chip lives in the drawer, which
stays reachable with the bar open and only calls `refreshUI` - so reading
`App.symmetryAxis` live meant tapping Y mid-op changed nothing on screen
while the confirm toast read the NEW axis and announced a Y array over X
geometry. Captured, like the symmetry plane is.

### What it refuses, and when it says so

- a count of 1 - "just the shape you already have"
- a Ring whose centre is inside the shape - the copies would interleave into
  a knot. This is the common case, because every primitive is born at the
  world origin.
- a Ring on an object with **uneven scale across the axis it turns about**.
  Each copy is placed by rotating in local space, so its world transform is
  `M R M-inverse`, which is a rotation only while M scales both perpendicular
  axes alike. Under 2,1,1 the copies come out sheared. Line is unaffected - a
  translation commutes with any scale. Mirror and Flip never meet this
  despite also working locally, because a reflection in an axis plane stays
  axis-aligned: **"local space, exactly as symmetry works" does not carry
  over to a rotation.**

The reason is toasted **while the bar is open**, once per reason.
`refuseOp` only records it, so the first cut did nothing at all when you
tapped Ring, with no explanation, until you pressed the tick.

### Deliberately not done

- **No `multi`.** Arraying several objects at once needs a rule for what each
  one's spacing means, and the honest one - each along its own size - makes a
  mixed selection drift apart at different rates. Join first.
- **Symmetry needs no opt-out.** `App.symmetry` drives `mirrorOfSelection`
  and `symExpand`, which are component-mode only; Array is Object mode.

## The topology build, taken apart and rebuilt (a2.77)

**Both items on the performance queue were the wrong ones.** The queue said
the next win was `applyShading`'s double normal pass (9-11%), and that the
rest of the function was unexamined. Breaking it into phases and timing each
one - `_prof_probe.py`, which instruments a COPY of index.html in memory so
there is no patch to revert - put the truth somewhere else entirely.

### The measured shape of applyShading, before

At 3,072 triangles, as shares of one run (shares, not absolutes: the machine
drifts 3x between runs, but every phase in a run drifts together):

| phase | 3k tris | 12k tris |
|---|---|---|
| `2_topo` **(the topology build)** | **47-51%** | **58%** |
| ↳ `2e_edgeMaps` | 18-25% | **38%** |
| ↳ `2a_computeLogicalOf` | 14% | 11% |
| ↳ `2c_windingComponents` | 8% | 8% |
| `6_unionFind` | 25% | 23% |
| `1_baseNormals` *(the queue's item)* | 9% | 7% |
| `4_triNormals` | 7% | 5% |
| `5_sharpWear` | 5% | 5% |
| `3_signedVolume` | 5% | 3% |

The double-normals item the queue named was the FIFTH biggest thing, and the
biggest - the edge-map build - grew with the model while it shrank.

### And the cache that a2.74 said was hitting was never hitting

a2.74's section 7 reported "the same geometry seven times - six cache hits".
That is wrong. `shadingTopoFor` caches on `geo.userData.shadeTopo` **only
while a direct drag is running** and writes `null` otherwise, on purpose:
outside a gesture the next call has to rebuild or a vertex welded by an edit
would keep the old grouping. So every call outside a drag rebuilds the
topology, and a2.74's "warm" measurement was cold.

### What changed

**`computeLogicalOf` welds with nested numeric Maps, not a string key.** It
built `x + '_' + y + '_' + z` for every attribute vertex of every mesh on
every rebuild. Three nested `Map`s keyed by the rounded numbers are exactly
equivalent - `Map` compares by SameValueZero, so `-0` keys with `0` and
`NaN` with `NaN`, both the answers the string gave - and nothing is packed
into one number, because there is no safe packing without a bound on the
model's scale and a collision here does not lose precision, it **welds two
vertices that are not the same**.

**`buildShadingTopo` keeps one Map of records, not six parallel Maps.**
Every edge lived in `edgeFaces`, `edgeUse`, `edgeOpp`, `edgeTri` and
`edgeEnds` under the same key, so a second triangle arriving on an edge
already seen cost four more Map lookups to find the arrays to append to -
and most edges are seen at least twice. `edges: Map<key, {faces, use, opp,
tri, ends}>` makes that one lookup. `incident` is unchanged.

### The numbers, and how they were taken

Each rewrite was written TWICE and both versions timed in the same run
against the same geometry, before either was put in the app:

- weld: string keys 4.90ms, nested maps 1.90ms - **61% off**, same 6,146
  logical vertices vertex for vertex.
- edges: six Maps 7.30ms, one Map of records 4.00ms - **45% off**, same
  18,432 logical edges.

Then in the app, on `rebuildFromEditable` - the funnel every operation ends
at - with a new geometry each time, which is what a real op does:
**12.07ms → 9.69ms, 20% off every operation in the app.** That comparison is
sound because the phases the change did not touch stayed flat across it
(`1_baseNormals` 0.66→0.63, `3_signedVolume` 0.40→0.36, `4_triNormals`
0.59→0.61, `5_sharpWear` 0.54→0.54, `6_unionFind` 2.54→2.33) while `2_topo`
fell 5.16→3.04. Nearly all of the saving is the topology build, which is
what was changed.

Shares after, at 12k triangles: `2_topo` 58% → **26%**, `2e_edgeMaps` 38% →
**10%**, `2a_computeLogicalOf` 11% → **5%**.

### The benchmark that would have lied

The first weld measurement used a subdivided cube, and that is the BEST case
for nested maps: a handful of distinct rounded x values, so a few dozen
inner Maps serve tens of thousands of vertices. An imported CAD or scanned
mesh is the opposite - nearly every x distinct, so nesting allocates up to
two Maps per vertex - and every import path runs through this function. A
fixture built to be exactly that (40,000 attribute vertices over 20,000
distinct positions, every x its own) says string 12.20ms against nested
4.00ms: **67% off in the bad case, more than in the good one.** A
hash-with-collision-verify variant was written as the fallback and tied
nested exactly, so there was nothing to buy by being cleverer.

The first attempt at that fixture was itself wrong - an LCG whose multiply
overflowed 2^53, so the sequence collapsed and the "scattered" fixture came
back with 6,222 distinct positions out of 40,000, which is the clustered
case again. **A fixture has to be checked for the property it exists to
have.**

### What is now the biggest thing, for whoever comes next

`6_unionFind` (30-36%) and `2c_windingComponents` (8-16%, and it grows).
`6_unionFind` was taken at a2.82 - see that section. `2c_windingComponents`
still has not been looked at. The double-normals item is still there and is
still fifth.

## Box select respects visibility (a2.76)

a2.72 made "you cannot select what you cannot see" true of TAP only, and said
in its own Deliberately-not-done that box select was the obvious next
increment. This is it. Box and lasso now skip components that face away,
unless **See-through** is on - in which case nothing is filtered, which is
what See-through means.

### It is the facing test, not occlusion

`performRegionSelect` calls `vertexVisible` / `edgeVisible` /
`groupFacesCamera` - the same back-face tests the free tap uses first - and
does **not** raycast. That is deliberate: a box can enclose thousands of
components, and `pointOccluded` is one raycast each. The facing test is O(1)
per component off a cached normal.

**The limitation this buys, stated plainly:** `vertexVisible` passes a vertex
if ANY face touching it faces the camera. On a capped shape every rim vertex
also touches the cap, and the cap faces you, so a full-screen box over a
cylinder takes the **back rim too** - and reports nothing skipped, because
nothing was. Probe section 18 pins this: 18 of 24 vertices on a 44-triangle
cylinder, which is exactly what the facing test says and more than you can
see. The toast never claims otherwise; it counts what the filter actually
dropped.

### The facing memo

Before a2.76 the face path called `groupFacesCamera(obj, gi)` per face and
that walks the group's triangles. A box over a dense mesh made it
O(faces x triangles). `beginFacingMemo(obj)` installs a one-shot
`Map` keyed by group index for the duration of one region select;
`groupFacesCamera` reads it if it is live and for the same object, and
`groupFacesCameraUncached` is the old body. `endFacingMemo()` runs in a
**`finally`** - a memo left live across a mesh edit would answer with stale
facing forever, so it must be released even if the select throws.

The face path also tests its corners **before** computing the centroid, which
was a pre-existing cost paid on every face whether or not it was in the box.

### Deliberately still unfiltered

**Grow / shrink, loop select, ring select and symmetry expansion are
topological.** They answer "what is connected to this", not "what is on
screen", and filtering them would make grow stop at the silhouette - which
would be a bug, not a feature. Probe 16 asserts grow still reaches round the
model (5 from 1) with the filter on.

## Picking: you cannot select what you cannot see (a2.72)

**This reverses the rule written into `pointOccluded`'s old comment.** That
note said occlusion is "used ONLY to break ties, never to refuse the last
candidate standing", because a picker that comes back empty was the failure
this whole strand of work existed to remove. The concern was right; the
answer was wrong. It is not "accept a hidden candidate", it is **fall
through** - the free tap tries vertex, then edge, then face, and the face
pick is a raycast that always hits when you are on the model.

### What was actually broken

`vertexVisible` / `edgeVisible` are FACING tests - "is any face touching this
turned toward the camera". On a convex cube that is exactly back-face culling
and it is correct. On anything with an inner wall - which is every model that
is not a cube - a component behind the surface sits on a camera-facing face
and passes. `preferUnoccluded` was a real occlusion test but only ran with TWO
or more candidates and returned the whole list when every one was hidden, so a
**lone** hidden candidate was never refused.

Measured on a two-quad fixture (a big front quad, a smaller one behind it, one
object): tapping a corner of the back wall selected that corner, and a free
tap returned it instead of the face plainly under the finger.

### The shape of the fix

`pickVisibleWinner` takes the candidates a tie-band at a time, **nearest in
pixels first**, and inside each band sorts by depth and returns the first one
that is not occluded. Three consequences, and the last two are why it is
written this way rather than as a filter:

- A band with nothing visible in it is dropped and the **next band gets its
  turn**, so "the near corner is hidden, therefore the one 18px away wins" is
  expressible. A single `dMin` could not say that.
- Returning the first visible member of a z-sorted band is the same answer as
  "test them all, keep the nearest visible" and costs **one** raycast instead
  of one per candidate. Measured: 1 raycast on a 576-face mesh, budget 12.
- The budget therefore stops being reachable in the case that mattered.
  Testing a whole band first meant twelve hidden candidates could exhaust
  `OCC_TEST_BUDGET` and abandon a **visible** candidate in that same band -
  a plain tap on a vertex you could see returning nothing.

### You can always let go of what you are holding

Box select, grow and loop select all reach components occlusion would refuse -
**none of them consults visibility** - and a selected element's dot is drawn.
So a hidden-but-selected candidate is accepted, as a fallback pass that runs
only after every band has failed, so it can never take a tap from something
visible. Without it, dragging a box over a cube and then tapping a back vertex
to drop it was answered with "that is behind the surface", and the only way to
deselect it was to clear everything.

### The refusal messages, and which one wins

**Wrong type beats hidden**, because it is more specific. A hidden vertex has
surface in front of it by definition, so there is always a face under the
thumb, and "that is a face - vertex is locked" is both true and the thing to
act on. Checking `hidden` first (the first cut did) reported "behind the
surface" for a plain tap on a face and pointed at the wrong tool.

So `hidden` fires exactly where nothing else is there: **a single-sided
surface seen from behind**. The renderer culls it, so nothing is drawn and
nothing occludes - but the vertex dots are depth-tested rather than back-face
culled, so you can see dots floating on an invisible surface. Only the facing
test refuses those, and it used to refuse them in silence.

### The facing test is still needed

It is not redundant with occlusion. On a single-sided open surface seen from
behind, the raycast finds no front face along the ray, reports "not occluded",
and would hand back vertices on a surface that is not drawn. `groupFacesCamera`
is the only thing refusing those.

### Deliberately not done

- **Box select and lasso did not consult visibility.** So at a2.72 "you
  cannot select what you cannot see" was true of TAP only. **a2.76 fixed
  that** - see the section above it. Grow/shrink, loop select and symmetry
  expansion are still unfiltered on purpose, because they are topological.
  The dead end box select used to create - select hidden, then be unable to
  deselect - is closed by the fallback above, and still is.
- **Occlusion is within one object.** `pointOccluded` raycasts `obj.mesh`
  only, so with cube B in front of cube A, tapping A's vertex through B still
  selects it.
- **`PICK_RADIUS_PX` is untouched at 28.** The diagnosed defect was
  visibility, not radius, and the history above this section is emphatic that
  a constant pixel threshold is right and that scaling it was removed on
  purpose.

## STL, and the depth band (a2.71)

The format with the least in it: no materials, no objects, no shared
vertices, no units. A triangle, its normal, and 49 more bytes, repeated. So
the reader is short and **the whole quality of the result rests on
`mergeCoplanarTriangles`** - which makes an .stl the honest test of whether
`IMPORT_COPLANAR_DOT` was the right number. On a printable model it usually
is not: a curved surface is thousands of facets differing by well over a
degree, so the merge yields close to one face per triangle and
`IMPORT_FACE_BUDGET` refuses the file. That is the correct answer and the
refusal says the number.

### THE DEPTH BAND FOLLOWS THE SCENE - this is the part that is not about STL

The fog is 15..42 units in the background's own colour, and `frameBox` puts
the camera at about 1.8x the model's largest dimension. **A model bigger than
~23 units is therefore invisible the moment it is framed** - painted as pure
background - while the fog-free helper lines keep drawing. You get vertex dots
and edges floating on an empty screen.

This is the same failure the flat view hit and `engageOrtho`'s note already
describes ("from ~27x further out the whole scene was 100% fogged"), reached
the other way round: by the scene growing instead of the camera retreating.
a2.71 made it the DEFAULT outcome rather than an edge case, because an .stl
carries no units and is nearly always authored in millimetres - a 25mm
printed part is a 25-unit model.

**The alternative was to rescale imports, and that is worse.** Silently
resizing someone's geometry invents a fact the file does not state, and it
would be wrong for a .glb, which does state its units. The scene is not
wrong; the constant is. So `refreshDepthRange()` multiplies the fog band and
the far plane by `contentScale()` - half the largest object dimension,
floored at 1, so every number is exactly what it always was at the app's own
scale. Geometry is left precisely as the file wrote it.

`applyTheme` multiplies by `sceneScale` too, or a theme switch would put the
unscaled band back under a large model. The flat view saves the band it
engaged with, so those saved numbers move as well.

### Binary or ASCII is decided by ARITHMETIC, never by the leading word

A binary .stl's first 80 bytes are a free-form header and plenty of exporters
write `solid <name>` into it. `84 + count*50` against the byte length is the
only sound test. **Trailing bytes are still a binary file** - exact equality
sent a file with one appended newline down the ASCII branch, where it found
no `facet normal` and was refused as "No triangles in that .stl", the
opposite of true. A file SHORT of what its header promises is named as
truncated, which the same arithmetic already knows.

### The stored normals get ONE VOTE for the whole file

Both the normal and the winding are in the file and they disagree more often
than they should: an exporter that mirrors a part transforms the coordinates
and leaves the vertex order alone - the same failure the glTF path meets with
a negative determinant, and it leaves a model invisible from outside and
solid from within.

But **the ecosystem trusts the winding**. three's own STLLoader never reads
the stored normal, and neither does any slicer, because the normal is the
field writers get wrong. So flipping per facet made two things worse: a file
with correct winding and randomly garbage normals came out with MIXED
winding, which breaks the coplanar merge (a flipped triangle reads as -1
against its seed), inflates the face count, and can trip the face budget on a
file that would otherwise have imported fine - silently.

So the disagreement is counted and the file is re-wound only when the normals
are nearly unanimous (>90% of at least half the facets), which is exactly the
mirrored-export case and never the garbage-normals case. **And it is said out
loud in the toast**, because turning a model inside out is the largest thing
this importer does to a file.

### A bound may only refuse in the direction it is sound

The ASCII pre-check was `byteLength / 50`, and 50 bytes is the FLOOR of a
conforming ASCII facet - so it was an UPPER bound on the triangle count, and
refusing when an upper bound is too big refuses files that are fine. Blender
writes ~227 bytes per facet, so a 2.1MB ASCII .stl holding 9,800 triangles
was rejected as "43k triangles". Counting `facet normal` is exact and the
string is needed anyway. The OBJ path counts `f` lines, which is a LOWER
bound, and can therefore only refuse files that really are too big.

## Refusals that name what the file needs (a2.71)

Three known gaps used to surface as "Could not read that file", which tells
the person nothing and reads like a bug in Kubik rather than a property of
their file. `gltfRefusal()` names each one:

- **Draco** and **meshopt** need decoders this app cannot carry - Draco's is
  a WASM blob several times the size of the whole app. Checked in the JSON,
  and caught again off the loader's own message for a compressed `.glb`.
  **meshopt is refused only when it is in `extensionsRequired`**: listed
  under `extensionsUsed` alone it is the fallback form, which carries
  readable buffer data and which three loads correctly - refusing that turns
  a working file into a broken one. Draco has no fallback mode.
- **A `.gltf` with an external `.bin`.** A file input hands over the files it
  was given; there is no directory to resolve a relative uri against, so the
  loader fetches it against the page URL and gets Kubik's own HTML or a 404.
- The JSON is **sniffed before it is decoded** - first non-whitespace byte
  must be `{`. `wireImport` routes everything that is not .obj/.mtl/.stl
  here, so a 200MB .blend picked by mistake was being decoded into a JS
  string twice its size before the loader could fail.

And the autosave quota, which `scheduleAutosave` swallowed: the scene then
silently reverted on the next visit, which looks like data loss with no
cause. Said once per session. **The message points at Download .json, not at
"save it under a name"** - `saveProject` writes the same bytes to the same
origin under one more key, so if the autosave just hit the quota it is
strictly worse and fails too.

## OBJ (a2.70)

**Hand-written, and that is the whole point.** `three/addons/loaders/OBJLoader.js`
fan-triangulates every face on the way in and returns a BufferGeometry, so a
cube's six quads arrive as twelve triangles - and the importer would then have
to GUESS them back together with the coplanar merge, exactly as it must for a
.glb. But an .obj already says, in the file, which triangles are one face.
`f 1 2 3 4` IS a quad. Throwing that away and inferring it again is the one
thing this reader must not do.

**So there is no merge pass on this path at all**, and none of its
compromises. Two coplanar quads a modeller deliberately kept apart stay two
faces; a concave face stays one face. `IMPORT_COPLANAR_DOT` is not consulted.

Read: `v`, `f`, `o`, `g`, `usemtl`, `mtllib`. Ignored: `vt`, `vn`, `s` - this
app has no UVs and derives its own normals.

### Every reader ends at `landImport`

glTF and OBJ agree on nothing except what comes out: a list of `{ name, ed }`
where `ed` is the `{ positions, groups, triCount }` the app's own ops speak.
`landImport` owns **both budgets, the non-finite sweep, the recentring, the
material mapping, the selection, the history step and the toast** - so a third
format is a parser and nothing else, and cannot forget a refusal. Readers may
also refuse early (glTF counts triangles off the geometry before converting,
OBJ counts `f` lines before parsing); those are optimisations, not the rule.

### `g` means two different things and the file says which

Blender writes `o Name` per object. Maya, 3ds Max, SketchUp and most CAD
exporters write `g Name` per object and no `o` at all. And plenty of files
write `o Solid` once and then a `g` per material INSIDE it.

**So: if the file uses `o` anywhere, `g` is a sub-group and never splits. If
it does not, `g` is the only thing that can split, and does.** Splitting on
every `g` turned one cube into one object per material group - and severed the
connectivity, so no op could cross the seam and the halves could never weld.

### An n-gon is ear-clipped, not fanned

A fan over a concave face produces triangles that stick out past the shape,
and their SIGNED areas still sum to the right number, so only an unsigned-area
test catches it. The polygon's Newell normal picks a 2D frame (drop the
dominant axis; all three frames are right-handed, so the projection is never
mirrored), `THREE.ShapeUtils.triangulateShape` clips it, and the winding is
compared back against Newell.

**That comparison is made against the SUM of all triangle normals, never
`tris[0]`.** Ear clipping emits zero-area triangles routinely - a collinear
ear is what you get the moment a neighbouring face's vertex lands on this
face's edge - and `importTriNormal` returns null for one. Testing the first
triangle alone meant that whenever the clipper put a degenerate ear first, the
whole n-gon kept the clipper's winding: a back-facing face in the middle of the
model, which reads as a hole that moves when you orbit.

### Two things that look like tidiness and are not

- **Ring vertices are deduped by WELDED POSITION, not by index.** Two corners
  within 1e-4 are one vertex to `computeLogicalOf`, and Inset and Extrude map
  the boundary loop through exactly that welding - so a sliver corner
  (`v 1 1 0` beside `v 0.99999 1 0`, ordinary in CAD-tessellated .obj) gave a
  rim with a self-edge in it and an inset that tore, with no refusal.
- **Every object gets its own compacted positions array.** Sharing one was a
  correctness bug with a silent symptom: `landImport` recentres in place, so
  the first object subtracted the whole file's centre and was placed back at
  it - correct by luck - and the second measured an already-shifted array, got
  an offset of zero, and went to the origin. A file centred on 0,0,0 (a
  Blender default cube) hides it completely. Compacting also finally delivers
  what the recentring comment always claimed: each object's origin is its own
  centre, so it pivots inside itself.

### A face that does not resolve is dropped WHOLE

`f 1 2 3 99` in a four-vertex file used to become a triangle. A quad quietly
shrinking is worse than a missing face, so the face goes and the toast says
how many. Zero-area faces are dropped too, on `mergeCoplanarTriangles`' rule:
they have no plane, no normal and no raycast hit, so one would be a material
slot and a budget slot the user can neither see, select nor delete.

### The .mtl is a sidecar the browser cannot fetch

An .obj names its `mtllib`, but a file input hands over the files it was given
and there is no directory to resolve against - so the sidecar is whatever was
selected alongside, and its absence is silent: the model opens on Solid. That
is why the control takes `multiple` and says so.

`Kd` is read as sRGB, the space the picker writes. `Ns` is a Blinn-Phong
exponent and is converted - `roughness = sqrt(2 / (Ns + 2))`, so Ns 0 is rough
1 and Ns 1000 is 0.045. `Pr` and `Pm` are the PBR extension nearly every
modern exporter writes; where they exist they win, because they mean exactly
what this app means.

**A material with no `Kd` gets `color: null`, not a grey.** An .mtl that never
states a colour is saying "whatever colour you like", and `color: null` is how
this app already says that - it is what the presets carry and what makes them
follow the theme. Minting a literal grey (even the theme's own current one)
freezes it, and that material stops following the theme for ever. glTF has no
equivalent case: the spec gives `baseColorFactor` a default of `[1,1,1,1]`, so
an unstated colour cannot arrive on that path.

### Materials (a2.69)

glTF's core PBR numbers are the three this app already stores, so the mapping
is direct and nothing is invented: `baseColorFactor` -> colour,
`metallicFactor` -> metalness, `roughnessFactor` -> roughness. Everything else
is dropped **on purpose**: textures (this app has no UVs at all - the masks
are triplanar and procedural), emissive, opacity, normal and AO maps, and
every KHR extension. A textured material lands on its base colour, which is
the tint the exporter already multiplied the map by. A lost texture reads as
"flat colour", which is what this app is.

Each merged face group carries the key of the source material it came from
(the flood fill already refuses to cross a material boundary, so one key per
group is the whole truth), and `importMaterialContext()` turns each source
material into a library id. `applyFinish` stamps the group's material BEFORE
`rebuildFromEditable`, because `reconcileFinishes` derives
`userData.finishes` from that stamp - writing the map by hand is the
bookkeeping a2.24 stopped doing.

**Colour is read with `getHexString()`**, which converts three's linear
working colour to sRGB - the same call `harvestLegacyMaterials` makes and the
same space the picker writes, so an imported red and a hand-picked red of the
same look are ONE entry rather than two nobody can tell apart in the tray.

**Roughness and metalness are quantised to three decimals.** glTF stores them
as float32 and the library stores what a person typed, so Plastic's 0.4 comes
back as 0.4000000059604645 and a signature built from that matches nothing.

`IMPORT_MATERIAL_BUDGET` is 64 minted entries per import. The tray renders a
real sphere per entry and the library is persisted, so a file with hundreds of
materials would own the picker long after the import was undone. Past the cap
faces land on Solid, which is exactly where they all landed before a2.69.

### The presets follow the theme, and a file cannot say so

Solid, Plastic and Metal carry `color: null`, meaning "the theme's default
grey, whatever it is now". A .glb has no such idea and records the grey that
was on screen. So an incoming colour that IS the current default grey, with a
preset's roughness and metalness, is taken to be that preset - otherwise
exporting a plain cube and opening it again minted an explicit grey called
"Imported", and that cube stopped following the theme for ever after.

**That test runs AFTER the library is asked, not before.** The first cut had
it first, which meant a material somebody mixed by hand to be exactly the
theme grey - named, exported, re-imported - was answered with "that is Solid"
and lost its name, while its exact signature sat in the index one line below.
The whole point of putting the name in `materialDefSig` is that two
identical-looking materials with different names are two materials.

### The one-key index, which was wrong everywhere it appeared

A material minted by an import is RENAMED when its name collides ("Metal
(imported)"), and stores `srcSig` - the signature of what it came FROM - so
the next open of the same file recognises it. Both `restoreDoc` and the
importer built their lookup as:

```js
bySig.set(v.srcSig || materialDefSig(v), id);     // WRONG
```

One key. A renamed entry was therefore findable only by the file it came
from, never by what it now IS - so opening a .json that carried it minted
"Metal (imported) (imported)", one level deeper on every open for ever, and
repointed every face that wore it each time. Both sites now index **both**
keys, first writer wins. This was live from a2.65a; a2.69 is what made it
routine, because a plain **name** collision now mints a renamed entry where
only an **id** collision used to.

### Exports carry the material's name (a2.69)

`buildExportGroup` writes `d.name` onto each cloned material. A .glb opened in
Blender used to show `Material.001` six times. `OBJExporter` only emits
`usemtl` for a material with a `.name` and always receives an array here, so
"Exported .obj (geometry only)" stays honest; STL ignores materials.

### Still to do, and known

Deliberately out of this increment, recorded so they are not discovered as
surprises: a multi-solid ASCII .stl lands as ONE object, welded, because STL
has no object concept and there is nothing to name the parts by; a non-planar
quad becomes one face group whose interior
diagonal `computeTopology` will not expose, so a bent face cannot be creased -
the .glb path would have refused to merge those two triangles and given two
selectable faces instead; an imported material's texture,
emissive and opacity are dropped (see Materials above); the material budget is
per-import, not per-library, so ten imports can leave 640 entries in a tray
that renders a sphere for each, and undo does not remove a minted entry - it
is in localStorage before the history step exists; `InstancedMesh` loses every instance but the first and
`SkinnedMesh` imports its bind pose, both silently; Draco and meshopt files
reject with the generic error because no decoder is set; `.gltf` is
advertised but external `.bin` and textures resolve against the page URL and
404; a large import can exceed the autosave quota, which `scheduleAutosave`
swallows, so the scene silently reverts on the next visit; `setMode('object')`
runs after the objects exist, so an open geo setup pushes history first and
one Undo takes back both; and `focusOnAll()` reframes existing work rather
than the import.

## The a2.67 accent rule - READ BEFORE OLDER SECTIONS

**a2.58's rule is reversed here.** That section says the accent means "you
are in a component mode and a tap does something specific". It now means
**something is selected**. Wherever an older section says the chrome takes
the mode's colour, this is the qualifier.

Reported from use: switching from Object into a component mode is already red
before anything is picked. `App.lastComponentMode` defaults to `'face'`, so
the FIRST press of the mode button runs `setMode('face')` and the stripe, the
mode button, both toggles and the op-bar primary all go salmon at once, with
an empty selection. With nothing selected a tap does not do something
specific - it selects - so the hue was promising an armed state the app was
not in.

**Two variables now, and the rule for choosing between them is one question:
does this control answer "what have I got?" or "where am I / what is the app
doing?"**

- `--accent` (and `-dim`, `-rgb`) is gated on `[data-armed]`, written by
  `refreshUI` when a component mode has a non-empty selection, a pending op,
  or a knife running. About forty controls read it. Unarmed, they are Object
  mode's neutral.
- `--accent-mode` (and `-dim`, `-rgb`) is always the mode's hue, ungated. The
  tool ring and its label, the isolation chip, `#selectBox` and `#lassoPath`
  take this one.

What a2.58 bought and this gives up: the mode is no longer readable from any
corner of the screen with nothing selected. The mode button's own glyph is
what says it.

### What the review caught, and the rule it produced

The first cut gated every accent consumer, and three of them were wrong for
reasons worth keeping:

- **`.hub-item.on` is the only accent consumer in the file with no border cue
  in reserve** - the ring item already wears an accent border, so `.on`
  differed from off by tint and glyph alone. At the neutral that is a 1.4:1
  tint and a glyph DIMMER than an off item's text: an "on" toggle read as
  less than an off one. One gesture away, too - `setMode` clears the
  selection, so a press-and-hold straight after any mode switch showed Xray,
  Grid and Snap exactly like that. It now takes `--accent-mode` AND a 2px
  border. **A toggle must not depend on hue alone to say it is on.**
- **The knife clears the selection on purpose** (`startKnife`) and then runs
  a modal session with the op bar up, so the commit button for a destructive
  topology edit was painted the same neutral as an idle hub. `armed` covers
  `App.pendingOp` and `App.knife` for exactly this.
- **The isolation chip drained on deselect** though isolation had not
  changed, and the **marquees took their colour from the PREVIOUS
  selection** - the same drag hued when additive and grey when fresh.

### Probe

Sections 4 and 6 measured the accent and the per-mode tints with an empty
selection, which is now the neutral - they would have reported the object
neutral four times and called it four passes. Both arm the modes they
measure. New **4b** asserts the rule both ways (neutral unarmed, arrives on
select, drains on clear); new **5b** asserts what must NOT go neutral: the
ring keeps `--accent-mode`, its on-state is heavier as well as tinted, and a
pending op keeps the chrome armed with an empty selection.

## The a2.66 first run - READ BEFORE OLDER SECTIONS

The app now says exactly two things unasked, each once in the life of a
browser, and never again.

**The chip.** `#firstHint`, centred above the bottom row: *Press and hold -
tools bloom under your finger*. It is a chip and not a toast on purpose - a
toast times out, and something you have not learned yet must not disappear
while you are still looking at the model wondering what to do. It goes when
a ring blooms, which is the moment it stopped being true, or when you tap
its x. Either way `hold` is written to the store below.

**The sentence about selection.** *Taps add up - tap empty space to clear*,
raised from `selectObjectClick` and `toggleElement` at the tap that takes the
selection from one to two - the tap whose next drag moves something you did
not mean to move. One flag, `taps-add`, shared by objects and components,
because it is one lesson and not two.

**`kubik.learned.v1`** is one key holding one flat object, so the next
one-time hint costs a string rather than another key and another try/catch.
`learnedAll()` reads storage on EVERY call and caches nothing: it is asked a
handful of times a session, a cached copy goes stale against another tab, and
- the reason it was changed - a cache makes the thing untestable, because
clearing the store no longer clears what the app believes.

### What was NOT wrong

`App.multiSelect: true` is a decision, on the record since long before this:
*"permanently on: every tap adds, tap empty space to clear"*, with nothing in
the file writing it and the Free / Box / Lasso seats commented *"choose the
drag gesture, not whether taps add to the selection - that's permanent now"*.
It was written up as a first-five-minutes hazard during the a2.65 stock-take.
That was wrong, and the correction is the same lesson this file keeps
recording: the note was written at the moment of noticing and never checked
against the code.

The help card was not wrong either. `HELP_QUICKSTART` already opens with
*"Hold on empty space, slide to Add geo, lift, then pick a shape"*, and Quick
start is the one section that opens by default. It needed nothing. What was
missing was any reason to open the card at all.

### And one the review missed too (a2.66a)

Shipped, then looked at on a phone: the chip had wrapped to THREE lines and
come out as a fat little block - the exact bulk this stretch of work exists
to remove. **`position: absolute` with `left: 50%` makes shrink-to-fit
measure against the half of the viewport to the RIGHT of the 50% mark**, so
the chip built itself at about 187px on a 375 screen, wrapped, and then
`translateX(-50%)` centred the result so it looked deliberate. `width:
max-content` sizes it to the sentence; the `max-width` cap still wraps it on
a genuinely narrow screen, which is what the original `nowrap` clipped
instead.

The suite had `on_screen` and `clear_of_the_corners` and both passed - a
narrow box is trivially on screen. Nothing measured the SHAPE. Section 13 now
reports the chip's box and line count and refuses more than two lines. **Any
centred, auto-width, absolutely positioned element in this file has the same
trap waiting.**

### Four things the review caught, and one the probe should have

- **`[hidden]` did nothing.** `#firstHint` set `display: flex`, an AUTHOR
  declaration; `[hidden] { display: none }` lives only in the UA sheet, and
  author origin wins. Nothing else in this file uses the hidden attribute, so
  there was no rule to inherit. The chip would have painted on every load for
  every user, ignored its own flag, and - because `dismissFirstHint` returns
  early once `hidden` is set - become permanently un-dismissable, swallowing
  pointerdown in a band across the bottom of the viewport. **`#firstHint[hidden]
  { display: none; }` is load-bearing. Any element that uses the attribute in
  this file needs its own rule.**
- **The chip ate the gesture it described.** It is a child of `#viewport`,
  but press-and-hold lives on `renderer.domElement`, a SIBLING - so a
  pointerdown landing on the chip never armed the ring timer. Reading the one
  sentence the app volunteers and doing exactly what it says produced
  nothing, and the click then recorded it as learned. The body is
  `pointer-events: none` and only the x is hit-testable.
- **The one-time toast could be spent behind the drawer.** `#toast` had no
  z-index at all, and the drawer's object list raises one through the same
  `selectObjectClick`. On a 390px phone a 340px opaque panel covered it.
  Harmless while every toast repeated itself; not harmless for a sentence
  said once in the life of a browser. `#toast` is now `z-index: 33`.
- **Gating on "no autosave came back" was strictly worse than the flag.**
  `init`'s own `pushHistory` schedules an autosave 900ms in, so from the
  second load there is always one - and a first-time user who reloaded, or
  whose iOS tab was evicted while backgrounded, saw the chip for a few
  seconds and never again with nothing learned. The flag alone is the gate.

**And the lesson for the suite:** section 13 originally asserted `fh.hidden`
- the property it had just set - and passed while the chip was painted on
screen regardless. **A test that reads back the property it wrote is not a
test.** Every visibility assertion there now goes through
`getComputedStyle().display`, and there is an assertion that the attribute
hides the element at all. `forgetLearned()` exists so the harness resets
through the app rather than reaching around it to localStorage - a probe that
clears the store while the app holds a cache is testing neither.

`_theme_probe` section 13 covers: the chip shows on an untold browser, the
attribute hides it, it clears the undo row and the three corner buttons, it
fits on screen, its body passes the hold through while its x stays tappable,
tapping the x is remembered, it does not come back, the selection sentence is
silent at one and said at two and never again, and the toast paints over the
drawer. 22 of the 23 suites were byte-identical across the change.

## The a2.65 chrome pass - READ BEFORE OLDER SECTIONS

Everything below describes the chrome BEFORE this pass. Wherever an older
section mentions the Symmetry pill, the lighting pill, the projection pill,
or where the material tab sits, this section wins.

**What the viewport carries now.** Menu, top-left, alone. "Move Axis" status
text, top-centre. View cube, top-right. **Symmetry and projection, a 44px
pair in the strip under the cube** - symmetry left, projection right.
Material tab on the right edge below them. Mode, undo, redo and help along
the bottom. Nine controls, one size, two shapes, no words.

**One size, two shapes.** 44x44 for every chrome control, with two stated
exceptions: `#hubBtn` at 56, because it is the primary, and the view cube at
128, because it is a viewport object rather than a control. A CIRCLE means
app-level - menu, help, mode. A `var(--r-md)` ROUNDED SQUARE means a state
you flip in place - symmetry, projection, undo, redo. A new control has to
answer that question before it gets a shape.

Before this pass there were four control heights (34, 44, 46, 56) and five
radii (50%, 23px, 17px, 12px, `--r-md`). Nothing enforced a scale; each
control had been sized to fit its own corner. That irregularity, not the
count, is what read as clutter - Blender shows far more and does not.

**Symmetry is one button.** It was a 100x46 two-seat edge switch under the
menu. It is a 44px toggle that SHOWS its state: the `mirror` glyph in the
accent when on, `symoff` dim when off - the pattern `#projPill` has worn
since a2.61. The old objection to a cycling button (you cannot tell which
state a tap will leave you in) is answered by showing the state rather than
the action, not by ignoring it. The swipe went with the halves; the tap,
always the primary path, did not.

**Projection is a glyph.** `persp` and `ortho` are the same box drawn with
converging edges and with parallel ones, which is what actually separates
the two projections. The word moved into the title.

**Lighting moved into the drawer**, under Appearance, as a two-column list
of the six presets. `#lightPill`, `#lightMenu`'s floating position, its
`.show` class, `setLightMenuOpen()` and its document-wide outside-click
listener are all gone. The two-finger gesture is untouched and is still the
only way Turn and Strength are set - those are judged live against the
model, and which preset is not.

**The material tray moved down** from 132 to 194 to leave the pair its
strip, and `--mat-max` went from `100vh - 204px` to `100vh - 266px`.

**Edge switches are retired.** `wireEdgeSwitch()` and `MODE_SWIPE_PX` went
with symmetry, their last caller. `#hubBtn` cycles three states and never
used one.

**`refreshProjPill()` has no eager call any more.** It draws an icon now,
and `ICON` is a `const` declared much further down the same script -
calling it at that point in module evaluation lands in the temporal dead
zone and throws. `refreshUI()` owns it instead, which already calls `icon()`
and therefore already runs late enough.

### The first media query in the file

`@media (max-height: 500px)` moves the pair to the LEFT of the cube and puts
the tray back at 132. The strip under the cube costs the shelf 62px, which
is nothing in portrait - 852 tall still leaves 526px - and nearly everything
in landscape: 390 tall drops from 186 to 124, and 320 tall from 116 to 54,
less than one card and its padding, so the tab would have opened onto an
empty sliver. `#matEditor` shares `--mat-max`, so the whole mask stack would
have been scrolling in that sliver too. The pair is two toggles and can
move; the shelf is a panel you work inside and cannot. 500px is below every
phone in landscape and above every window the probe suite runs in, so the
suite keeps measuring the portrait layout.

### Two things the review caught that the screen did not

- **The help card still described the old chrome.** Symmetry as a two-half
  pill at the top left; Appearance as "the pill under Symmetry", which this
  change had deleted. Both sent the reader to an empty corner. The file's
  own rule is that what you read in Help matches what is on screen, and
  nothing on screen enforces it - only reading the help table does.
- **The pair took a right safe-area inset the view cube does not.**
  `#viewCube` is pinned to the physical corner on the record (`right: 0`, no
  inset, because the cube carries its own margin inside its square).
  Anything hanging under it has to use the SAME anchor or the two drift
  apart by a whole notch the moment there is a right inset - portrait has
  none, landscape does. The pair is `right: 14px` / `right: 66px` flat; only
  the media query above takes the inset, because at 142px in there is no
  notch left to argue with.

### What did NOT change

The Mode Hue system (a2.58). `#hubBtn` is still filled with `var(--accent)`,
which is why it reads as a near-white disc in Object mode and salmon in Face
mode. That is the swatch doing its job, not a control shouting - the thing
to change, if it ever matters, is Object's neutral accent, not the button.

### Probe suite

`_theme_probe` section 9 was rewritten, and it was wrong in a way worth
fixing regardless of this change: it compared X RANGES and called any
horizontal overlap a collision. The pair shares a column with the material
tray and clears it VERTICALLY, so the suite reported the new layout as
broken while nothing on screen was touching anything. Section 9 and section
11 now test real rectangle intersection, and section 9 adds: both toggles
are 44x44, they are level with each other, they clear the cube, the tab and
the flyout both open and closed, neither carries a word, and the lighting
list is inside `#drawer`.

**20 of the 22 suites came out byte-identical** across the change.
`_theme_out.txt` changed as described; `_perf_out.txt` flickered once on
`slider_coalescing` - "0 applies after a frame" reading 1 - and came back
clean three runs running. That middle number is a race on whether the
scheduled apply flushed before the probe looked, and it is worth knowing
that it can flake before somebody reads it as a regression.

## The a2.7f -> a2.16a wave (2026-08-24/25) - READ BEFORE OLDER SECTIONS

Everything below this section describes the app before this wave and
stays true unless contradicted here. Deeper detail lives in the project
docs (claude/materials-roadmap.md, claude/crosstest-findings.md,
claude/kubik-orientation.md).

**Icons (a2.7f).** Redesigned: cap (open iso cube + solid lid), bevel
(flat-cut upper-right corner), loop
(dashed seam), bridge (two edges + ghost band), separate (two cubes +
dashed vertical), `mirroraction` (new key for the Object-ring action;
the Symmetry pill keeps `mirror`). The trash `del` serves ALL deletes -
user decision, do not re-split. Pixel laws: dash gaps under ~4.8 units
fuse (round caps eat 1.6 per gap); detail under ~1.8u collapses at ring
size; never dash a diagonal.

**Ring seats (a2.8 + a2.10).** Every tool entry carries `seat` (0 = up,
clockwise, 7 = down) on one 14-seat compass shared across rings - same
op pulls the same DIRECTION in every ring (Delete is always down).
toolRingAngles sorts by seat, spreads evenly over the FULL circle (no
gaps) and rotates by a circular-mean phase to best fit the bearings.
Empty-scene and world rings keep their old layouts.

**Materials are LIVE ASSETS (a2.9 -> a2.15).** The finish system became
a material library:
- MATERIALS Map of defs {id, name, color|null, roughness, metalness,
  envMapIntensity, preset, masks?}. Presets keep ids standard/plastic/
  metal (the old finish keys - old saves parse natively). color null =
  follow the theme (themedDefault still drives applyTheme's retint).
  Chart values: Solid r1.0/m0, Plastic r0.4/m0, Metal r0.25/m1.
- COLOUR LIVES IN THE MATERIAL (user decision). Painting = applying
  materials, Blender-slots style. The drawer colour picker is REMOVED;
  per-face colour no longer exists as a separate thing.
- userData.finishes = per-face-group material-id map (name kept for
  save/undo compat). applyFinish(mat, id) applies the WHOLE definition
  and is the single funnel every path goes through; it has NO blanket
  needsUpdate (it runs per slider tick). updateMaterialEverywhere(id)
  propagates a definition edit to everything wearing it, live.
- The library is GLOBAL AND PERSONAL: localStorage 'kubik.materials.v1'
  {customs, presetOverrides (incl. masks), nextNum}. Project JSON embeds
  materialLib; restoreDoc merges unknown ids into the library (never on
  the undo path - undo never rewinds appearance).
  harvestLegacyMaterials() turns legacy per-slot colours into deduped
  custom defs on load. Applying a material schedules autosave.
- UI: the materials fly-out sits under the view cube - slim tab flush to
  the right SCREEN edge (env safe-area inset only, NOT --edge-r), tray
  of real rendered sphere previews (lazy throwaway 104px renderer), tap
  applies (per-face in Face mode, per-object otherwise), pencil on the
  active card or a 500ms long-press opens the editor INSIDE the tray
  (#matEditor: colour/metal/rough live sliders, presets Reset to chart
  defaults + mask cleared, customs Delete with fallback to Solid, '+'
  forks the applied def and applies it).

**Procedural mask STACK (a2.15, rebuilt a2.20, types a2.21).** def.masks is an ARRAY
of up to MASK_SLOTS (4) masks; mask i owns channel i of ONE 128px RGBA
DataTexture per def (_maskTex map), sampled TRIPLANARLY in OBJECT SPACE
with one tap set for all four. Each mask is
{on, type, blend, colorOn, color, roughOn, rough, amount, scale,
detail, contrast, seed, img?}; blend is normal|multiply|screen|overlay and
the colour and roughness components switch on and off independently.
type is one of MASK_TYPES: fbm (Clouds), voronoi (Cells), scratches, dots,
stripes, image. EVERY field must TILE - the triplanar sample repeats it
three ways and a seam draws a straight line down the model.
DataTexture, not CanvasTexture: Canvas 2D is PREMULTIPLIED, so packing
four masks through a canvas corrupts the channels the shader reads.
Legacy `masks: {color:{...}}` is migrated by normaliseDefMasks, wired
into getMaterialDef - and ALSO called by saveMaterialLibrary and
serializeDoc, which read MATERIALS raw and would otherwise judge a
legacy mask "no change" and delete it on the first save.
WHAT COSTS WHAT: colour, roughness, amount, scale and blend mode are
pure uniforms. detail, contrast and seed re-bake the texture in place.
Adding, removing or switching a mask or a component on or off is ALSO
uniform-only (an off mask is amount 0, and the shader source is the same
for one mask as for four) - the ONLY recompile left is crossing between
"no patch" and "a patch". Nothing in the editor bumps the generation.
TRIPLANAR is decided policy - no UV tools, no box projection.
TWO LAWS, learned the hard way (a2.16a, cross-material GPU corruption
and dead clones before them):
1. customProgramCacheKey must NEVER be constant - three.js runs
   onBeforeCompile only when the material holds no program under the
   key. Key = 'kubik-colormask:' + defId + ':' + d.maskGen, read live
   from the _maskKey WeakMap so a material that CHANGES definition stops
   naming the old one. The generation is per DEFINITION so every wearer
   shares one program. a2.20 broke this law once and the whole stack
   rendered identically - see the a2.20 section.
   AND THE PART THREE.JS WILL NOT DO FOR YOU: on a program cache HIT
   three returns the program without re-running onBeforeCompile AND
   without repointing materialProperties.uniforms, which still names
   whichever program compiled last. So a material coming BACK to a key
   it once compiled under renders from another program's uniforms and
   every slider writes into thin air. _maskUniforms is therefore a Map
   PER KEY per material, and a material returning to a key it already
   used gets a private '#n' suffix that guarantees the miss.
2. NEVER store uniforms/textures in material.userData - Material.clone
   JSON-copies userData. Patch state lives in module WeakSet
   _maskedMats + WeakMap _maskUniforms; ensureMaskPatches (called from
   refreshUI) re-dresses clones after duplicate/separate/detach/join.
   Probe from tests: __kubik.isMaskPatched(mat).

**New ops (a2.11).** Merge (Vertex ring): merge-by-distance,
MERGE_EPS=0.01 grid clustering to centroids (exact coincidence <=1e-4
is already one logical vertex by construction); relational -> runs once
per symmetry side like Weld. Detach (Face ring): selected face groups
become a new object (separateObject's remap pattern; materials/
smoothing/finishes travel; the source keeps the hole via
deleteFaceGroups; refuses detaching every face).

**The view cube is a CONTROL (a2.12/a/b).** Tapping an axis dot swings
the camera (ViewHelper) and snaps to an orthographic look: long-lens
emulation on the SAME PerspectiveCamera - fov to 2, distance x~26.7,
near to 5% of tele distance, far scaled up, and the FOG BAND shifted
out by the same amount (fog silently ate the whole scene before that).
A manual orbit gesture restores perspective exactly. animateCameraTo
leaves the flat view first. LAW: anything
that ever moves the camera far must carry far plane + fog band + near.

**Crease = sharp edge in SHADING too (a2.16/a2.16a).** applyShading
builds per-vertex normal islands (face groups connected through
non-creased edges) and smooth normals average only within an island -
a creased loop is ONE sharp line on a smooth surface, neighbouring
rings untouched. Edge-mode Shade now creases/uncreases the selected
edges instead of flattening adjacent face groups.
creaseSelection/clearAllCreases re-apply shading. undo/redo now
refresh the autosave (it used to resurrect undone edits on reload).

**FIXED a2.16b - the crease-shading "hang" was an INFINITE LOOP, not a
cost problem.** The island flood fill read
`const nbrs = m && m.get(stack.pop())`, so when a vertex had no
adjacency map at all (`adj.get(l)` undefined - EVERY edge around it
creased) the `&&` short-circuited before `stack.pop()` ever ran and the
`while (stack.length)` loop spun forever. Pop first, then look the
neighbours up. Reproduced deterministically by creasing all 12 edges of
a plain cube - it was never about mesh size. Measured after the fix:
applyShading is ~linear (0.3 ms on a 6-group cube fully creased, 55 ms
on 1541 groups fully creased, 160 ms at 6144 groups). The crosstest
guess of "an effectively-unbounded cost in the crease-aware
applyShading" was wrong about the mechanism and right about where.

**FIXED a2.16d - a double-tapped run now JOINS the selection.** The
loop / ring / path / face-strip double-tap was the ONLY non-additive
selection path in the app: it did `App.selectedElements = sel`, a hard
replace, while App.multiSelect is permanently true and every single tap
and region select adds. So a second edge loop silently threw the first
one away and two loops could never be held at once - which is exactly
what Bridge needs, so its own house gesture could not feed it. User
report, and correct.

All four double-tap branches now go through `mergeRunIntoSelection(sel,
tappedIndex, msg, noun)`: it ADDS the run, and takes it back OFF again
if it was already selected, the way a single tap toggles one element.
The first tap of the double-tap has already toggled the tapped element
by the time the handler runs, so that one element is excluded from the
"already selected?" test - without that a fully selected loop always
looks one element short and can never be switched off.

The near-miss fallback (thin edges, second tap lands a few pixels off)
used to read `selectedElements.size === 1`, so it only ever worked on a
virgin selection - with a loop already held, a near miss fell through to
camera Focus. It now remembers the edge the last single tap picked, WITH
its screen position, and reuses it only within 900 ms and 40 px, bounds
-checked against the current edge count.

Measured on a twice-subdivided cube: three loop gestures accumulate
16 -> 32 -> 36 selected; repeating the first drops exactly that loop
(36 -> 20) and leaves the others. Face strips 16 -> 30 -> 14 the same
way. Known and accepted: a run that is entirely CONTAINED in a larger
selection reads as "already selected" and drops - repeat the gesture to
get it back.

**NEW a2.17 - COLLAPSE EDGES, in the Edge ring.** Each connected RUN of
selected edges melts into ONE vertex at the run's centre: a selected loop
becomes a single point, two separate runs become two points, a lone edge
becomes its midpoint. Runs are the connected components of the selected
edges (union-find over their endpoints) and nothing else. Relational, so
like Weld and Merge it goes through runMirrored - handed a selection and
its mirror as one set it would find a run bridging the plane and pull
both halves onto it.

**Seat 2, and LOOP MOVED TO 9 to make room** (user decision). Seat 2 is
Merge's bearing in the Vertex ring, and collapsing an edge run is that
same gesture one component up - several things melting into one point.
Seat 9 is Flip normals in the Face and Object rings, which has no meaning
on edges, so nothing shares a ring with it here.

Three things this op needed that the older melt ops do NOT do:
- `removeTrianglesCarrying(obj, ed, mats, predicate)` - the group-index
  -safe filter. Dropping an empty group renumbers everything after it, so
  smoothGroups and finishes have to be rebuilt against the new numbering.
  It returns {mats, smooth, fin} and writes NOTHING to the mesh, so the
  caller can still find the mesh fully degenerate and bail. **Weld, Merge
  and the delete paths still call the old removeTriangles and still have
  that shift latent in them** - own increment, own testing.
- CREASES ARE KEYED BY POSITION and this op moves vertices, so the crease
  map is rebuilt through the same moves: both ends inside one run means
  the edge is gone and so is its crease; one end inside means the key is
  remapped. Left alone they would silently vanish or alias onto whatever
  later landed on that position.
- logicalPos reads the LIVE mesh while only ed.positions is written, which
  is what makes the runs order-independent. Do not "optimise" it to read
  ed.

Measured: plain cube one edge 8 verts -> 7, 12 edges -> 11, still 1 shell
/ 0 boundary / 0 non-manifold / 0 reversed; two separate edges -> 2
points, clean; twice-subdivided cube, a 16-edge loop -> 1 point, 98 verts
-> 83, audit clean but **2 SHELLS - the cube is pinched into two lobes
meeting at one point.** That is the correct output for this op (it is how
you make a pinch on purpose) but note auditWinding does not look for a
non-manifold VERTEX, so a clean audit is not proof here. Moved and
rotated object: the point lands on the LOCAL midpoint. Symmetry on: one
edge selected collapses on both sides, 40/40 verts, clean. All 12 creases
on a cube: 11 survive the collapse of one edge, none degenerate, none
dangling. capture/restore round-trips all three maps.

The icon (`>` dot `<`) was chosen by SCREENSHOT at the 26px the ring
actually uses. The first try - arrowheads with tails touching a centre
dot - fused into one blob and read as an asterisk.

**FIXED a2.17a - FINISHES IS NOW DERIVED, NOT MAINTAINED.** User report:
"materials behave strangely when geometry changes - one should apply the
material again to reproject". Correct, and it was two bugs wearing one
coat. userData.finishes maps face-group index -> material-def id, and it
was kept by hand, per op. Ops that GROW faces (extrude, inset, bevel,
split, knife, bridge, cap) push a CLONED material per new group and never
added the matching entry; ops that DROP a group renumber everything after
it and shifted the map. updateMaterialEverywhere reads
`fin[gi] || 'standard'`, so a face with no entry silently belongs to the
Solid preset: it renders unmasked and editing the material it visibly
wears does nothing to it, until you re-apply by hand.

Measured before the fix, cube wearing one masked material: extrude 6
groups -> 10 but 6 entries, inset 6 -> 10 / 6, bevel 6 -> 7 / 6, delete
5 groups against 6 stale entries. Subdivide and Collapse were already
right, which is why it looked intermittent rather than systematic.

THE MODEL NOW: **the material remembers its own definition**
(`mat.userData.kubikDef`, stamped by applyFinish) and finishes is DERIVED
from the material array by `reconcileFinishes(obj)`, called inside
rebuildFromEditable - the one funnel every op passes through, and the only
place that sees the finished group list and the finished material array
together. This is the one thing that SHOULD live in userData: Material
.clone JSON-copies it, so a face grown by cloning the material of the face
it came from is BORN wearing the same definition. (The LAW is about live
uniforms and textures, which clone into dead snapshots. A string id is
exactly what wants copying.) A renumber then cannot shift anything,
because the map is rebuilt from the materials rather than carried.

Three supporting pieces:
- `stampFinishesOnMaterials()` runs at the end of restoreDoc. A saved
  scene stores finishes as a plain map and rebuilds materials WITHOUT
  applyFinish, so nothing is stamped on load - and the first op after
  loading would clone an unstamped material and lose the new faces again.
  Measured, and now covered.
- A stamp naming a definition the library no longer has (a custom the user
  DELETED while a face wore it) self-heals to Solid. Skipping it left the
  face showing the dead definition, mask and all, forever, while the UI
  reported Solid.
- `ensureMaskPatches()` is called from reconcileFinishes, not only from
  refreshUI. An id test cannot see whether a material is DRESSED: a clone
  landing at an index that already held the same id passes every check and
  is still unpatched, because the patch lives in a module WeakSet a clone
  is not in. Any path that edited and then saved, exported or rendered
  without a refresh was working on undressed materials.
- bridgeFacesOp no longer wipes finishes - there is nothing to wipe now.

Measured after, every op, cube wearing one masked material, WITHOUT any
manual refresh: applied 6/6, subdivide 24/24, collapse 6/6, delete 5/5,
extrude 10/10, inset 10/10, bevel 7/7, bridge 8/8, every entry correct and
every material mask-patched. Editing the definition after an extrude now
reaches 10 of 10 (was 6 of 10). Mixed materials: extruding a metal face
among plastic ones gives metal walls; deleting a face keeps metal on the
right face through the renumber. Save -> restore -> extrude carries. Cost:
reconcile plus ensureMaskPatches on 1536 groups is 0.4 ms.

**NEXT, from the same review: `smoothGroups` is STILL a hand-maintained
index-keyed map, so the delete-shift bug almost certainly still lives
there** - bridge wiping it is the only thing masking it. Same treatment
(derive it) or at least renumber it with the groups. Also noted: anything
that mutates a material OUTSIDE applyFinish must `delete
m.userData.kubikDef` or reconcile will re-apply the definition over the
manual change; and reconcile assumes group gi is drawn with mats[gi],
which holds because rebuildFromEditable emits identity materialIndex.

## a2.18 - SHADING MOVED OFF THE FACES AND ONTO THE EDGES

The per-face smooth/flat map is GONE. Every face is smooth; what breaks the
smoothing is an EDGE being sharp. This was the user's design, and it also
dissolved the bug queued behind it: `smoothGroups` was keyed by FACE-GROUP
INDEX, exactly like `finishes`, and the a2.17a bug was sitting in it waiting
its turn. There is no index-keyed shading state left to shift.

**How an edge decides it is sharp**, in order:
1. `userData.edgeShade[key] === 'sharp'`
2. `userData.edgeShade[key] === 'smooth'`
3. anything other than exactly TWO faces -> sharp (a rim has nothing to blend
   with, a non-manifold seam must not blend). This is checked BEFORE the
   marks: Shade Smooth writes 'smooth' onto rim edges where it does nothing,
   and a later Bridge or weld giving that edge a second face would otherwise
   let an invisible stale mark beat the angle.
4. otherwise sharp if the two faces turn by more than SHARP_ANGLE.

**SHARP_ANGLE is 33 degrees, not 30, and the comparison carries an epsilon.**
A regular 12-sided prism meets itself at exactly 30, so a 30 threshold puts
every edge of that ring on the knife edge of a float compare - some sharp,
some smooth, changing as the object turns. 33 lands between the 12-gon (30)
and the 10-gon (36) and on no regular polygon at all.

Rule 4 is the point of the whole model: a fresh cube is crisp and a
subdivided sphere is smooth with NOTHING stored, and a wall grown by Extrude
is born crisp without the op having to remember anything.

**SHARP IS NOT CREASE.** They are separate marks in separate maps. Crease
means only "hold this edge through Subdivide"; Sharp means only "break the
shading here". An edge can carry either, both or neither, and creaseSelection
no longer calls applyShading.

**Tools.** Edge ring: `Mark Sharp` (seat 10) is a two-state toggle - marking
edges that are already all sharp CLEARS them, back to angle-decided. `Crease`
(seat 11) is now the same shape of toggle. `Uncrease` is gone, because the
second tap is the off, and `Shade` is gone FROM THIS RING because it did the
same job as Mark Sharp there - it keeps seat 8 in Face and Object. Face and
Object `Shade Smooth` marks every edge of the selection smooth EXCEPT any
already marked sharp - "smooth everything except sharp" - and `Shade Flat`
marks them all sharp.

**Both marks are drawn in the viewport**: crease colour for creases, a warm
`SHARP_COLOR` for sharp, sharp checked last so an edge carrying both reads as
the one you can see in the render.

**POSITION KEYS AND DRAGGING - the thing that nearly shipped broken.** Both
maps are keyed by position pair, and a drag changes positions, so every mark
on a moved vertex's edges was orphaned the instant a drag began: the
sharpness fell back to the angle rule mid-drag and the dead entry stayed in
the map, ready to resurrect on whatever later landed on that spot. A drag
cannot change TOPOLOGY, so `snapshotEdgeMarks` records the marks against
logical edge pairs when the drag context is built and `rewriteEdgeMarks`
rebuilds both maps from that snapshot after every move. **Creases had this
flaw all along** - unnoticed because a crease only pays out at Subdivide,
while sharpness is on screen every frame. Fixed for both.

`captureObjectState` / `restoreObjectState` now carry creases and edgeShade
too. A cancelled op used to put the geometry back and leave whatever creases
it had written - a long-standing gap that started to matter a lot once
shading moved onto the same kind of map.

**Subdivide splits marks onto both halves** of every edge, like it already
did for creases - looked up by the edge's ORIGINAL endpoint positions, since
smooth subdivision MOVES the originals. A first attempt used the moved
positions and silently lost every mark.

**Migration is per MESH, on load, only when a doc has no `edgeShade` key at
all** (an empty map means "all angle-decided", not "not migrated"): every
edge of a face that was flat becomes sharp, and every existing crease also
becomes sharp - creases keep their own map and their Subdivide meaning, they
are merely also marked so the file opens looking the same. Old all-flat cube
-> 12 marks, 6 normals, identical. Old all-smooth ball -> 0 marks. Old
all-smooth + a creased loop -> 32 marks, identical to how a2.16 drew it.

**Measured** (unique normals is the proxy for how it looks): fresh cube 6 / 0
marks; smooth-subdivided 384-face cube 386 / 0; extruded wall 6 / 0; inset
6 / 0. Cube Shade Smooth -> 8 normals and 12 smooth marks, then Shade Flat ->
6 and 12 sharp. Smooth ball + one 32-edge loop marked sharp -> 386 -> 418
(one hard ring); tapping the same loop again -> back to 386 and no marks. A
sharp mark survives a later Shade Smooth. Marks double correctly through two
Subdivides (16 -> 32 -> 64). Creasing changes shading not at all.

**Performance: no regression, and better where it counts.** applyShading now
always does the island work, where the old one early-returned when nothing
was marked - but the pass was rewritten onto NUMERIC edge keys (the old one
built strings like 'l_g' in its hot loop) and does the whole thing one vertex
at a time with nothing global stored. 1536 groups: old 15 ms unmarked / 55 ms
creased, new 15 ms unmarked / 29 ms fully marked. It runs on every drag move,
so this mattered.

**Known and accepted:** Join (`combineObjectsInto`) bakes world transforms
into a new local space, so position keys would be meaningless and it carries
neither creases nor marks - the angle rule takes over. A strongly non-planar
n-gon decides its own boundaries by its area-weighted average normal, which
can read false-sharp or false-smooth; comparing the two TRIANGLES either side
of the edge would be exact. From Face or Object mode there is no way to clear
a stubborn sharp mark - Edge mode's toggle is the escape.

## a2.19 - SMOOTH BY ANGLE, on the Object ring (seat 11)

A live op on the existing op bar: the "amount" is a THRESHOLD IN DEGREES and
the preview is the shading itself, which is the one thing you cannot judge
from a number. OK commits, Cancel puts everything back.

**It stores a per-object angle, not baked marks** (user decision).
`userData.autoSmoothAngle` overrides the global SHARP_ANGLE for that object,
so geometry made LATER still obeys the angle you chose - a face extruded
tomorrow follows today's setting, which a baked set of per-edge marks could
never do. `effectiveSmoothAngle(mesh)` is the single place that knows
"no angle of its own means the app default"; it is written out rather than
`angle || SHARP_ANGLE`, which would quietly treat a deliberate 0 as unset.

**It clears the object's hand marks** (user decision), so the preview shows
exactly what the angle gives with no invisible leftovers fighting it. The
snapshot holds them, so Cancel puts them back - and this doubles as the only
way to clear a stubborn mark from Object mode, which a2.18 had no answer for.
The confirm toast says how many marks it cleared, because that is the one
destructive thing the tool does.

**Range is 0-180, not 0-90.** The test is the angle between two face
normals, which runs the whole half-circle: at 90 an edge whose faces fold
back on each other - a spike, a fin, a thin shell - could never be smoothed.
90 is merely where a plain cube turns over.

**Degrees on disk, radians in memory.** The file carries
`autoSmoothAngleDeg` and it is clamped on load. A bare unitless number in
JSON is a trap: anything later writing 33 meaning degrees would be read as 33
RADIANS and the model would shade like nonsense while the bar read 1891.
Docs without the key simply get the default, so there is nothing to migrate.

**Measured.** Smooth-subdivided cube, 96 faces: sweeping the angle gives 0 deg
288 normals (fully faceted), 20 deg 206, 33 deg 98, 45-90 deg 98 - monotonic
and live. Plain cube: faceted to 89 deg, smooth at 90. Cancel with TWO objects
selected, each carrying 4 hand marks: both lose them during the preview and
both come back to 4 marks, the original shading and the default angle.
Confirm at 47 deg round-trips through save and load. After confirming, an
extrude keeps the object's angle and the new walls obey it.

**Reviewer notes not acted on:** opening a ring op while another op is
pending overwrites the pending one - pre-existing for every entry in every
ring, not specific to this tool. And once an object has its own angle there
is no "back to default" affordance; setting the slider to 33 is the same
value but not the same state.

**KNOWN OPEN ISSUES (crosstest 2026-08-25, unverified findings in
claude/crosstest-findings.md) - fix order as agreed:**
1. DONE (a2.16b) - see above.
2. DONE (a2.16c). Bridge between two CLOSED edge loops. edgeChains walks
   the selected edges and never steps onto a seen vertex, so a RING came
   back as an open path: an n-edge loop read as n vertices / n-1 edges.
   Bridge then built n-1 walls (the open slit) and matched the two runs
   by their ENDS, which for two rings pairs A's near corner with B's far
   one (the overlapping walls). Both symptoms, one cause. Fix: chains
   record `closed`; two closed rims that are each exactly one face
   group's outline now delegate to bridgeFacesOp (the rim of a face IS
   that face - same result as bridging the two faces, caps dropped,
   winding inherited); genuine open rims fall through to a ring path
   that walls all the way round and picks the phase with
   chooseRingOffset; one closed + one open now refuses with a message
   instead of quietly slitting. Measured, two joined cubes, both top
   rims: BEFORE 3 walls, 15 groups, 3 shells, 2 boundary, 6
   non-manifold, audit FAIL. AFTER 4 walls, 14 groups, 1 shell, 0/0/0,
   audit PASS - identical to the face bridge. Also clean at 3 sections
   curved, 2 sections straight, and on rims left open by deleting the
   caps first.
3. AMBER: Connect across a quad's diagonal silently no-ops (violates
   the silent-no-op rule). AMBER unconfirmed: creases may not hold
   through smooth Subdivide - needs a clean repro.
4. Perf backlog: ensureHelpers builds one overlay mesh+material PER
   face group; subdivide rebuild is superlinear - MEASURED a2.16b on a
   cube, smooth subdivide: L3 26 ms, L4 191 ms, L5 1454 ms (roughly
   x7.6 per level for x4 the data), so L6 would be the >10 s freeze the
   crosstest agent hit and probably misattributed to shading; one
   MeshStandardMaterial per face group (structural fix = shared
   instance per material def). Three audit sweeps never ran (mobile/UX,
   static correctness, static perf) - resumable.

**Next planned work:** NORMALS, derived from the masks that already exist -
a mask is a greyscale field and a normal is its slope, so every noise type
becomes a bump for free and it lands as a third checkbox beside Colour and
Roughness. Triplanar normal mapping needs no UVs (each of the three planar
projections has a trivially axis-aligned frame), so the no-UV policy
survives. It needs the environment, which is why a2.22 came first: a bump
is visible because it redirects reflections. Then cavity and curvature.
Other candidates from the backlog: repoint Weld/Merge/delete at
removeTrianglesCarrying (top code-health item); Connect across a quad's
diagonal silently no-ops; the superlinear subdivide rebuild; one
MeshStandardMaterial per face group (a per-def shared instance is the
structural fix and needs its own discussion); masks do not export to glTF
(bake-to-UV at export). Icon sweep findings deferred (weld/connect/merge
now share the Vertex ring - revisit those three icons TOGETHER).

## a2.20 - THE MASK STACK

Four masks per material instead of one, packed one per RGBA channel of a
single texture, each with a colour component and a roughness component
that switch on and off independently, and one of four blend modes.

**The editor is a chip row, not four stacked panels.** #mkChips shows one
numbered chip per mask plus "+" while a slot is free; one set of controls
edits whichever chip is active. Four masks' worth of controls in a 176px
column would have been a scroll from the first mask to the last. Tapping
the chip you are ALREADY on toggles that mask off and on - the same
second-tap-is-the-off rule the edge marks use - and an off mask keeps its
seat, greyed, so you can see it is there and switched off. "Remove"
deletes it outright.

**Uniform-driven end to end.** uKubikCount / uKubikColor[4] /
uKubikAmount[4] / uKubikScale[4] / uKubikBlend[4] / uKubikColorOn[4] /
uKubikRoughOn[4] / uKubikRough[4]. The weights are computed once in
<color_fragment> into a global float kubikW[4] and read again in
<roughnessmap_fragment> - three runs colour first. kubikPick selects a
channel with a dot against a selector rather than s[i], so the shader
stays legal if the renderer ever falls back to WebGL1.

**LAW 1 caught a real bug here.** The first cut of the stack captured
`_maskGen` once and never advanced it, so the cache key was constant,
the first compiled program was the only one that ever ran, and EVERY
mask configuration rendered identically. Per-definition d.maskGen fixed
it. Then the opposite mistake: bumping on every checkbox minted a
program per click that three never releases (its per-material programs
Map is never pruned) - 40 taps, 40 retained programs and 40 compile
stalls. Both gone: structural changes are uniform-only now.

**The frozen thumbnails.** One SHARED preview material walked the whole
library on every pass, so it left and returned to every masked
definition's key constantly and hit the three.js cache-hit wart above -
the thumbnails froze at whatever the first pass compiled, and unrelated
materials bled into each other (6 unique previews out of 10). Now one
preview material PER definition, created once and kept (disposing them
handed the program back to three and recompiled it on the next slider
release). Measured after: 10 unique previews out of 10, and a full
edit-and-churn pass costs 0 new programs.

**Verified, on the real UI and by pixel diff of the viewport:** all four
blend modes distinct; colour and roughness components independently
distinct; add/remove/on/off distinct and exactly reversible (on-off-on
returns to within 2 pixels of +-1); a 4-mask stack round-trips through
save/load byte-for-byte; a legacy `{color:{...}}` library entry survives
the upgrade and migrates to the array; 30 component toggles add 0
programs.

**Known, unchanged by choice:** restoreDoc still only adopts a material
definition the local library does not already have, so opening someone
else's file on a machine that has its own `standard` keeps the local
one - masks and all. Pre-existing rule; it now hides more.

## a2.21 - NOISE TYPES, AND YOUR OWN PICTURES

Six kinds of mask instead of one. Clouds is the old FBM; Cells is Voronoi
F2-F1 (bright inside a cell, dark along the wall); Scratches walks tapered
lines with a wrapping splat; Dots is a jittered grid with a quarter of the
cells left empty so it reads as speckle rather than polka dots; Stripes
rides an INTEGER lattice direction with an FBM wobble; Image is a picture
from your disk.

**Tiling is the constraint everything here is built around.** The site GRID
wraps while the site POSITION does not (Voronoi); the splats index with a
modulo, so a scratch running off one edge comes back on the other; the
stripe phase advances by a whole number of periods across the tile in x AND
in y, which is why the direction is rounded to an integer lattice vector
rather than taken from the angle directly. Measured seam-vs-interior
gradient for all five procedural types: equal to within noise.

**One control doing five jobs.** The Detail slider is relabelled per type -
Detail / Cells / Count / Density / Bands - and hidden for an image, and
"New pattern" hides too because a picture has no seed. The type itself is a
`<select>`, not another chip row: six types would have been three more rows
of buttons in a 176px column, and the native picker is a bigger target on a
phone than anything we could draw.

**Type changes are re-bake only.** The GLSL is type-agnostic - it reads
channel i by uniform and knows nothing about what drew it - so nothing here
recompiles. `rebakeMaskTexture(d, i)` re-bakes ONE channel, which is what
the Detail/Contrast/seed/type paths use; the three untouched masks are left
alone. Full four-type bake: 7.3 ms.

**Pictures.** Loaded through an object URL (never base64 - that would be
~134 MB of string for a 50 MB photo to sample 16384 pixels), redrawn onto a
WHITE ground so a logo on transparency is not black on black, centre
CROPPED rather than squashed, and re-encoded as a 128px PNG data URL. That
small square is what is stored - in the library and in every project file
that references the material - typically about 1 KB. Files over 25 MB are
refused with a toast.

**Three things the review caught, all fixed, all worth remembering:**
1. The decode is ASYNC and used to resolve its target material from
   `matEditingId` when it FINISHED. Close the editor while a phone photo
   decodes and the re-bake went to `standard` (which is what
   `getMaterialDef(null)` answers) while the real material stayed blank
   until a reload. The definition is captured when the file is PICKED, and
   the completion checks `MATERIALS.get(d.id) === d` before touching it.
2. Selecting "Image" used to open the file picker for you. A dismissed
   dialog fires no event you can rely on across browsers, and the mask was
   then stuck as an image with no picture and no control that did anything.
   "Choose picture" is one tap and cannot dead-end.
3. `mk.img` is only ever used after `maskImageSrc` has checked it is a
   `data:image/` URL. A project file is JSON someone handed you; a remote
   URL in there would have the viewer's browser call home the moment they
   opened the model, from a static origin with no CSP to stop it.
`pruneMaskImages()` drops the decoded fields and the data URLs nothing
wears any more - on type change, on replace and on material delete.

**Say it plainly:** a loaded picture is EMBEDDED in the project JSON.
Sharing a .json ships a 128px copy of that photo inside it.

## a2.22 - THE ENVIRONMENT STOPPED BEING ONE HARDCODED ROOM

Six procedural studio setups, baked from parameters instead of loaded from
an .hdr, plus Turn and Strength. Drawer, under Appearance.

**Why this before anything else in materials.** It is the MULTIPLIER on the
rest. Metalness has no diffuse component - a metal IS its reflection, so
with nothing to reflect it renders almost black; roughness blurs
reflections, so it is invisible unless the environment has contrast to
blur; and a normal map (next) shows only because it redirects reflections.
All three were reporting on one fixed RoomEnvironment until now.

**Procedural is a STORAGE decision as much as a look.** A preset is about
fifteen numbers, so a project file carries its own lighting for a couple of
hundred bytes. An .hdr is megabytes and could not be embedded, which is what
made "custom HDRI" awkward when it was first planned.

**A light is a RECTANGULAR PANEL.** The shape of a highlight is most of what
makes a render read as studio: a softbox leaves a soft-edged rectangle on a
glossy surface and the eye knows what that means. Panels are projected onto
their own plane at unit distance, so one seen at an angle foreshortens the
way a real one would.

**FLOAT data, not 8-bit.** The HDR in HDRI is the sources sitting far above
white - the Studio key peaks at 14.1. An 8-bit texture clamps that to 1.0,
which does not error, it just renders flat and plasticky and is very hard to
diagnose afterwards. Same family as the premultiplied-canvas trap.

**THREE'S EQUIRECT CONVENTION, and the bug it caused.** three samples
u = atan2(z,x)/2pi+0.5 and v = asin(y)/pi+0.5, and DataTexture sets
flipY = false, so row 0 is v = 0, which is y = -1, the BOTTOM. The first cut
wrote row 0 as the top and swapped x for z with it - a 180 degree rotation
about (1,0,1). Every key light was under the floor, the ground was overhead
and Turn ran backwards, and it all looked entirely plausible. Caught by
review, then confirmed with one bright panel pointing straight up: top face
6, side face 199. THE TEST THAT SETTLES IT is a six-axis probe - a white
diffuse plane facing each world axis in turn, rendered under a one-panel
environment aimed at that axis; the brightest face must be the one the panel
points at, for all six. It is in the session log and worth rebuilding for
any future change to the bake.

**512x256, measured not guessed.** PMREM derives its cube size as width/4,
so this is the one number that sets reflection sharpness. Against a 1024x512
bake, on mirror-polished metal at roughness 0.02 - the worst case there is -
512 differs by at most 19/255 and 0.01 mean, while 256 reaches 66/255, which
shows. Bake cost 5 / 18 / 89 ms for 256 / 512 / 1024.

**Turn and Strength are FREE.** `scene.environmentRotation` (Euler) and
`scene.environmentIntensity` are live properties in this three - no re-bake,
no prefilter, no recompile. Verified exactly reversible. Only the preset
costs a re-bake (~70-115 ms all in).

**The thumbnails prefilter the same equirect through their OWN renderer**,
because a prefiltered texture belongs to the context that made it. The
source data is plain numbers and travels fine. That work is DEFERRED to
renderMatPreviews rather than done on the preset change, so a preset switch
with the shelf shut pays nothing for pictures nobody is looking at. And
matPreviewRig calls applyEnvLive when it is built: the rig is lazy, so it
missed every earlier call and opened its first shelf lit at rotation 0 while
the viewport was at 180.

**Also from the review:** a zero-width panel divides by zero and ONE NaN
texel is smeared over the whole radiance map by the blur - black materials,
no error anywhere - so w and h are clamped from below as well as above.
DataTexture defaults to NearestFilter, so the downsample into the cube was
point-sampled and panel edges stair-stepped; it is LinearFilter with
RepeatWrapping on S now. Strength has a floor of 0.1 because 0 turns every
metal black with nothing on screen to explain why.

**Known, pre-existing, now more visible:** `scene.environmentIntensity`
REPLACES `material.envMapIntensity` rather than multiplying it (three writes
it straight into the uniform for any standard material with envMap === null
and a scene environment). So the per-definition envMapIntensity - Solid 0.5,
Plastic 0.7, Metal 1.0 - has done nothing since the day scene.environment
was first set. Not introduced here. Decide during the shelf revision whether
to drop the field or make it multiply.

## a2.22a - THE LIGHTS BECAME PART OF THE PRESET

Reported as "environment changed, but switching to other types not changing
anything, so as turning and strength sliders". Real, and my testing had
hidden it twice over.

**What was actually wrong.** Four analytic lights - hemisphere, key, fill,
rim - were doing the lighting, fixed, and the environment was a wash on top.
On the DEFAULT Solid material (roughness 1, metalness 0) a fully-rough
non-metal sees only irradiance, never a reflection, so six presets of
similar total energy all landed in the same place.

**Two testing mistakes worth not repeating.**
1. Every earlier measurement was taken with metalness cranked to 0.9-1,
   because that is what shows an environment best. The default material -
   the one every new scene wears - was never measured. Test the DEFAULT, not
   the flattering case.
2. The pixel metric averaged over the WHOLE FRAME. The object is about 1% of
   the canvas, so a real 48/255 change on the model read as "mean 1.2" and
   looked like nothing. Average over the pixels that CHANGED.

**The fix: the analytic lights are derived from the preset, and no new data
is stored for it.** The preset already describes its lights - a panel has a
direction, a colour and a radiance - so the three directional lights are
aimed at the three brightest panels and tinted to match, and the hemisphere
takes sky/ground/ambient. Weight per panel is
`int * sin(w/2) * sin(h/2)`, normalised against Studio's key (3.708) so the
theme's key intensity keeps meaning what it used to.

**The theme still owns the baseline.** applyTheme sets hemi/key/fill/rim as
before and then calls applyEnvRig, which re-aims and re-tints on top, so the
theme sets the overall level and the preset supplies direction, colour and
the relative weighting. WITHOUT that call the rig snapped back to the
theme's fixed directions. (It mattered most when there were two themes to
switch between; it still holds the split between baseline and preset.)

**Turn now rotates the lights with the reflections.** Verified by
equivalence: turning by 70 degrees is pixel-identical (max 1/255) to baking
the same preset with its panel already at az+70, while turning the other way
differs by 92/255 - so the test is sensitive and the signs agree.

**The shadow caster's elevation is floored at 32 degrees.** Sunset's key sits
at 6, and a shadow cast from the horizon runs off the end of the shadow
camera and smears. Azimuth and colour still follow.

Measured after, on the default Solid material, mean difference per channel
over the object's own pixels: Studio vs Rim 48, vs Sunset 57, vs Neutral 70,
Turn 180 44. Softbox is the closest neighbour at 17 and still reads.

## a2.22b - EXPOSURE, AND LIGHTING LEAVES THE DRAWER

Two reports: too dull even at Strength 3, and "not informative to rule it in
the drawer - i have to close menu to see changes".

**A LIGHTING PRESET CHANGES CHARACTER, NOT EXPOSURE.** That is the rule this
settled on, and it is what the dullness was really about. Rim and Sunset are
authored dark on purpose; honouring that literally left them at half
Studio's brightness with no way back, because Strength scaled everything
including the deficit. A photographer relights and then re-exposes. So:
- every environment is normalised to the same mean radiance
  (`envNorm`, `ENV_TARGET_MEAN = 1.0`, tuned so the default cube lands at
  luminance 107 against the old fixed rig's 101);
- the theme's key+fill+rim is a BUDGET the preset spends by relative panel
  weight, not a per-slot multiplier - a2.22a scaled each slot against
  Studio's key, which starved every preset with smaller panels;
- the hemisphere is flat across presets. Its sky and ground COLOURS still
  come from the preset; its level does not, or the dark presets go dim
  again through the back door.
What still differs is direction, colour and contrast, which is what a preset
is actually for.

Measured on the default Solid material, object luminance at Strength 1,
before -> after: Studio 101 -> 107, Softbox ~95 -> 106, Sunset 43 -> 105,
Neutral 51 -> 86, Overcast 61 -> 77, Rim 54 -> 67. Rim and Overcast stay
lower by design - they are soft and dark setups - and reach 147 and 182 at
Strength 5. Presets remain clearly distinct: 16 to 45 mean per channel
against Studio.

**Strength now runs to 5**, and the shadow caster's elevation floor dropped
from 32 to 24: pushing the key high to keep the shadow tidy also put the
light on the TOP face, which is the one face you are usually not looking at.

**The controls moved into the viewport** as `#lightBar`, above the undo row.
Turn and Strength are judged entirely by what happens to the model, and a
control you have to close a menu to evaluate is a control you guess with.
Six chips plus two compact sliders, wrapping on a narrow screen, quiet
styling (panel background, no accent border) because unlike the op bar it is
always on screen. The drawer keeps a one-line pointer to it.

**Measurement note that cost two rounds here:** to judge "how bright is the
model", build an exact object mask first - render once with the meshes
hidden, once shown, and difference. Thresholding against the background
colour picks up the floor grid, which outnumbers the object and swamped the
average; the first attempt reported luminance 19 and no change at all
between Strength 1 and 3.

## a2.23 - LIGHTING BY GESTURE

The a2.22b bottom bar was rejected outright ("this bar is a mess"). The
replacement splits the two jobs by how often they happen.

**Type is PICKED, rarely: a pill under the Symmetry pill, with a menu that
falls out of it.** `#lightPill` / `#lightMenu`. Six rows, the current one
marked, closes on any pointerdown outside itself.

**Turn and Strength are ADJUSTED, constantly: a gesture, no widget at all.**
Hold TWO fingers still anywhere; the other hand then slides - ONE finger
turns the light, TWO change its strength. Lifting an anchor ends it. A
readout (`#lightHud`) sits top-centre, deliberately away from both hands.

Why a gesture rather than a control: Turn and Strength are judged entirely
by what happens to the model, and nothing you have to look at can be
watched and dragged at the same time. The drawer failed for that reason and
so did the bar.

**The gesture was free to take.** Two fingers already hand control to the
camera, but two fingers held STILL did nothing at all. Stillness is the
whole discriminator, so the test is travel (`LIGHT_HOLD_PX` 12) as well as
time (`LIGHT_HOLD_MS` 420). One finger and three fingers are untouched -
verified.

**Sliding fingers re-baseline whenever their count changes**, so going from
one finger to two does not jump the value it lands on.

**THE ONE THAT BIT: handing the camera back.** OrbitControls keeps its own
pointer list, its own captures and its own state machine, and its POINTERUP
HANDLER IS NOT GUARDED BY `enabled`. Switching it off mid-pinch leaves it
finishing a gesture that was taken away from it: a release for a pointer it
never captured throws inside its own handler, and the cleanup after that
line never runs. Measured: the camera was dead for the rest of the session
after one lighting gesture. Two things fix it -
1. `orbit.enabled = true` is deferred until `activePointers.size === 0`,
   never on the anchor lift, or it drops into a two-finger dolly whose
   starting distance it never measured;
2. it is re-armed from EMPTY - `_pointers` cleared, `_pointerPositions`
   cleared, `state = -1` - each guarded, because these are three's
   internals and not a contract.
Verified: three lighting gestures interleaved with orbits, camera working
throughout.

**And the ordering bug underneath it:** the resume check first lived in the
pointerup handler, which has five exits each calling `trackPointerUp` at a
different moment. It belongs INSIDE `trackPointerUp` - the one place a
pointer actually leaves the tracker. Checked before that removal, the last
finger up still counted as one finger down and the camera never came back.

**Desktop has no path to Turn and Strength** - user's decision, touch only.
The pill still picks the type.

## SHAPE MASKS: Cavity and Edges (a2.24 -> a2.29e)

Two mask types that take their weight from the model instead of a texture.
Cavity darkens crevices, Edges wears the exposed edges. They stack, blend
and drive colour and roughness like any other mask.

**They are built from the EDGES, and it took four wrong architectures to
get there.** Everything before a2.28 inferred where a model's edges were
from the FACES around them, and every version of that was even on some
shapes and wrong on others. The failures are the useful part of this
section - they are all the same mistake in different clothes.

### How it works now

1. `applyShading` writes `geometry.userData.kubikEdges` - the endpoints of
   every WEAR EDGE and whether it is convex or concave. This is O(E) and
   runs on every frame of a drag without noticing.
2. `bakeEdgeField` turns that list into a distance field over the object's
   own box: how far each point is from the nearest convex edge (red) and the
   nearest concave one (green). `ensureEdgeField` caches it on the geometry,
   rebakes when the edge list changes, and never while a finger is down.
3. `mat.onBeforeRender` binds that per-OBJECT field into the per-MATERIAL
   uniforms. It is the only place the two meet.
4. The shader reads the field at the pixel's object-space position, roughens
   it with value noise, and returns `1 - smoothstep(w*(1-blur), w, d)`.

A cube, a tube, a fillet, an L-plate and a ring all get identical treatment.
There is nothing to fit and nothing to fall back from.

**An edge is an edge if `wear` says so.** That map sits beside `sharp` and
answers a different question. It counts a CREASE - which since a2.18 has no
say in shading at all, but "hold this edge through Subdivide" is exactly
"this is an edge of the form", and it is the only thing in the app that can
say so about a fillet deliberately shaded smooth. A hand 'sharp' mark comes
first. The FACE COUNT still outranks a 'smooth' mark, because Object-mode
Shade Smooth writes 'smooth' onto rim edges wholesale and without the rule
one tap on an open plane deletes its whole outline with no visual cue.
`creaseSelection` and `clearAllCreases` call `applyShading` again for this;
a2.18 had deliberately removed that call.

**An outline edge is not any edge.** An edge a face uses TWICE is that
face's own triangulation - the diagonal of a quad - and an edge record's
`use` array counts uses PER FACE so the test is `computeTopology`'s: some
face uses it exactly once. (It was a separate `edgeUse` Map until a2.77.) Without it every quad has a phantom edge down its middle.

**Convex or concave: stand on one face and look at the OTHER face's far
vertex.** Below this face's plane means the surface folds away and the edge
sticks out. The plane is the local TRIANGLE's, not the face group's summed
normal - on a warped face the sum points nowhere useful, and after Flip
Normals it points inward and inverts every edge of it. Only for EXACTLY two
faces: one is a rim and three is a seam, neither of which has a well-defined
inside, and both are treated as exposed.

### The field

A 2D ATLAS of z-slices, not a 3D texture: `sampler3D` needs GLSL ES 3.00 and
three compiles its built-in materials as 1.00. Two bilinear taps and a mix.
The half-texel inset in `kubikFieldTap` is what keeps a tap inside its own
tile; without it every tile boundary draws a line across the model.

**RANGE is 15% of the object's largest dimension** and Width is a FRACTION
of it, so one material reads the same on a matchbox and on a battleship.
Past range the field saturates and the shader treats it as "nowhere near an
edge", which is what stops a wide setting from flooding the object.

**The grid is a BUDGET, not a fixed resolution.** Cost is edges times the
voxels each sweeps; at a fixed resolution a dense model is hundreds of
milliseconds, synchronously, inside the render. Coarsening shrinks both
terms at once and a coarser field is a slightly softer band, which for
weathering is no loss. On top of that: throttled to 120ms, stamped AFTER the
bake rather than before (or the throttle means "120ms between the STARTS"),
skipped entirely while `activePointers.size` is non-zero, and installed only
on a material that actually wears a shape mask.

**The atlas is disposed with its geometry** - `disposeEdgeField` in
`disposeObject` and `rebuildFromEditable`. `geometry.dispose`
frees buffers, not something hanging off userData, and this is up to a
megabyte. Undo alone disposes every object and rebuilds.

**`buildExportGroup` clears `eg.userData`.** `BufferGeometry.copy` assigns
userData by REFERENCE and `GLTFExporter` serialises it into `extras`;
without this every `.glb` carried the edge list and the whole atlas.

**The default when a mesh has no field is BLACK - distance zero, paint
everything.** That is the material preview ball, whose thumbnail has to show
what the mask does. And `onBeforeRender` puts that default back rather than
returning, or the uniform keeps whichever mesh was drawn before.

### Three sliders

**Width** a fraction of the field's reach. **Blur** how much of that width
the falloff takes, 0 a hard line and 1 a fade all the way in. **Noise** how
ragged the rim is. All three are live uniforms - a shape mask has no cloth
to re-bake. `MASK_TYPES` carries per-type label and bounds for all three,
written BEFORE the values or the range element snaps each to the old grid.

### Round edges, and noise that warps (a2.29 -> a2.29b)

Two things a survey of Substance, Blender and Marmoset said were missing.
`claude/wear-shading-prior-art.md` in the project has the survey; its short
version is that nobody publishes a distance-to-EDGE field, and the only
prior technique that works on an unbevelled cube is Substance's ray-traced
Sampling Radius, which is what a2.28 arrived at by another road.

**Round edges is a bevel with no geometry.** Blender, Marmoset and Redshift
all ship one; all three pay for ray probes, and Blender's own docs warn
theirs costs a fifth of render time. Ours is nearly free, because the
GRADIENT of the field already IS the direction to lean the normal. It lives
in the material editor, not the mask panel - it is a property of the
surface, not of a stack layer, and it works with no mask on the material at
all.

- **Four taps, not three.** Forward differences read `f(x)` and `f(x+h)`,
  and within h/2 of an edge the second tap lands on the FAR side of the
  distance function's V - so the normal leaned away and drew a raised ridge
  instead of a chamfer. That zone is a fixed fraction of the field, so at
  small widths it was most of the band. The tetrahedron (`e = vec2(1,-1)*h`)
  straddles the valley in every direction.
- **A gradient that is too short is not a direction - but too short means
  NEARLY ZERO.** Past the field's range every tap reads the same clamped
  1.0, the four cancel exactly, and what is left is 8-bit dust that
  `normalize()` blows up into full-strength speckle. A true distance field's
  gradient has a KNOWN magnitude, `4h^2/range`, so the bar is a physical
  quantity rather than an epsilon - and getting the number wrong cost two
  versions. `1e-12` was ten million times below the byte noise floor and
  never fired once. Half of expect, its replacement, fired everywhere it
  mattered: approaching an edge the taps straddle the V, so the sum
  SHORTENS, and it is under half for the last 9% of the range. Every Round
  edges below 0.09 was inert - the whole bottom of the slider - and
  everything above it got a flat strip down the crest of each edge. The
  length falls near an edge; **the direction does not**, and the direction is
  all `kubikBevelN` uses. The bar is now 10% of expect, about five times the
  quantisation floor. Both settings measured healthy at Round edges 0.5, so
  the probe now also asserts 0.06 - which read exactly `0.00` before.
- It runs after `normal_fragment_maps`, so a normal map still wins where one
  exists; it is skipped under `FLAT_SHADED`; and it needs the custom
  `uKubikNrmMat`, because `object.normalMatrix` is not declared for the
  fragment stage.

**Noise now WARPS the lookup instead of offsetting the result.** Adding
noise to a coverage value moves the whole band in and out together;
displacing the POSITION being sampled makes the rim itself wander, which is
what erosion actually looks like. Substance calls the same node a Warp. The
reach test still runs at the TRUE position (`kubikF0`), so noise can eat
into a band but can never start one on a face with no edge near it.

**Noise scale** joined Width, Blur and Noise, on shape types only. It is
expressed relative to the width, so widening a band does not turn its grain
into a different material - and the warp's AMPLITUDE is divided by it, so
Noisiness means "how deep the bites are relative to how big they are". Left
coupled, fine grain kept a coarse displacement and the top of the slider
moved the lookup thirty features: a scramble, not a warp.

**One predicate decides who gets patched.** `maskWantsPatch(d)` is read by
both `applyMaskPatch`'s early-out and `ensureMaskPatches`. While those were
two separate copies of the same test, `ensureMaskPatches` never learned
about bevel, and a face extruded on a bevel-only material stayed flat
forever.

### Cross-masking: each kind stops at the other (a2.29c)

**The field measures distance through SPACE. It has no idea where the
surface goes.** So a recess whose floor is 0.12 below a lip 0.05 away is
0.13 from a point on the flat top OUTSIDE it - well inside the range - and
Cavity paints straight over the lip and out onto the open deck. On
Zeghreit's tank that put rust along the top edge of every raised hull
plate: the single most exposed line on the model, and the last place dirt
would ever sit. The turret's inward extrude, whose rim is further from
anything concave, looked perfect the whole time.

**The other channel is the answer, and it is already in the same texture.**
If the nearest edge of the OPPOSITE kind is closer than your own, you are
on the wrong side of a corner from it - reaching your own edge means going
round that corner, and neither dirt nor wear does that. So Cavity stops at
the lip and Edges stops at the crease:

    occ = smoothstep(-bar, bar, other - own)

`bar` is 35% of the mask's own Width, so a wide band gets a wide handover
and a tight one a tight one. Substance ships exactly this on every
generator - "Ambient Occlusion Masking" and "Edges Masking, removes dirt
from raised edges" - and it was the one item on the prior-art list that had
not been built. It costs nothing: both numbers were already read.

**Both channels EXACTLY zero is the no-field default**, the material preview
ball, and it must not be cross-masked - a tie halves the result and every
thumbnail in the tray goes pale. The probe caught that one, at -51.87 turning
into -22.64.

The pan test in the probe is this shape: a plate with a shallow square
recess. Before, cavity over its whole mask read -12.43 and the dark band sat
on the outer rim; after, -1.34, and it sits in the recess.

### Which side of the wall (a2.29e)

**A Kubik model is usually a SHELL, and the field does not know that.** It
measures distance through solid material. Zeghreit's fenders are a folded
plate 0.04 thick with a field reaching 0.37: the crease on the HIDDEN
UNDERSIDE, where the front lip folds back under the deck, sat four
centimetres behind the outer chamfer and drew a rust line straight down it.
Cross-masking could not help - there is no convex edge on that chamfer to
lose to, because at 45 degrees it shades smooth and is not an edge at all.

**Ask the field which way it grows along the SURFACE NORMAL.** Step out and
step in:

    behind = (field(p + N*e) - field(p - N*e)) * range / 2e

A crease you could WALK TO lies in the tangent plane, so both steps move you
the same distance away from it and the difference is ZERO. A crease behind
the skin is directly below you: stepping in halves the distance, stepping
out doubles it, and the difference is 1 - the full slope of a distance
field. Above 0.7 the mask returns nothing; 0.35 to 0.7 fades.

The numbers come from the real model, analysed offline against a ray-traced
ambient occlusion: **every painted pixel with `behind` above 0.6 has an AO
of exactly 0.00** - open air, all 933 of them across the nine objects -
while the pixels below 0.35 average 0.14 to 0.55. On the fender plate, 46%
of what Cavity painted was on the wrong side of a wall.

`e` is a TWENTIETH of the range, small enough that both taps land inside one
voxel of the field, where the reconstruction is linear and the answer is
exact. A CENTRAL difference, not a forward one: standing exactly on a real
crease, the forward difference reads 1 and switches off the deepest part of
every cavity. Computed at most once per pixel, and only for a pixel already
within reach of an edge.

Probe: the recessed plate, seen from the side (mostly outer surfaces) went
-1.34 to -0.21, and from ABOVE (where the recess is visible) -3.24 to -2.26.
Both numbers are needed - the side view alone cannot tell "confined to the
recess" from "switched off".

### Winding, and why it was invisible (a2.29d)

**A face wound backwards inverts every edge it touches.** The convex/concave
test stands on one face's plane and asks which side the neighbour's far
vertex falls on - so with the plane the wrong way up, Cavity comes out on
the open lip and Edges goes down in the crease. Half a dozen such faces
somewhere in the middle of a mirrored model is exactly what "sometimes, on
some edges" looks like.

`applyShading` now walks the triangles first and gives each a SIGN relative
to its neighbours: two triangles sharing an edge agree when they cross it in
OPPOSITE directions. That settles a shell against itself. Which way round
the shell goes as a whole is one more question, answered by its SIGNED
VOLUME when it is closed - positive is outward, so an inside-out box, or a
deliberate Flip Normals, still has its cavities where its cavities are - and
otherwise by majority, which keeps an open patch closest to what was drawn.
The bar under the volume is relative to the shell's own size; an absolute
one means "any closed shell under half a millimetre keeps whatever it
arrived with", and Kubik has no unit.

**It must not touch the shading normals, and the first version did.** The
premise was "every material is double-sided, so a backwards face is
invisible" - which is false: since v1.79 the app CULLS back faces, so a
backwards face is already a hole you can see. Negating its normal as well
only turns the hole black, and the raw cross product of any triangle that
survives culling faces the camera by definition. The sign is read in exactly
one place, at the classification.

**A non-manifold edge stops the walk.** Three faces on one edge has no
consistent answer, and guessing one stamps it on the entire sub-shell
beyond: a wall bridged onto two coplanar plates came back inverted about
half the time. Stopping makes the wall its own component, seeded upright,
exactly as it was before the pass existed.

Probe: `pan.oneflipped` and `pan.allflipped` rebuild the recessed plate with
one face group, then every face group, wound backwards. Both were wrong
(14/12 and 8/16) and both now read the same 16 convex as the clean shape.
The one flipped group still adds two edges to the total, because the SMOOTH
ANGLE test compares two face normals and a flipped one reads as 160 degrees.
That path is deliberately left alone - the face it happens on is a hole on
screen anyway, and the fix there is Flip Normals, not a shading heuristic.

### The four architectures that did not work

Kept because each one looked right and measured healthy, and Zeghreit found
every one of them in seconds on a real model.

1. **Per-vertex curvature (a2.24).** Every vertex of a cube is convex, so
   the field is a CONSTANT across each face and no remapping of a constant
   makes a band. **Per-vertex data is blind BETWEEN vertices.**
2. **A bounding box per flat region (a2.25).** Worked on a cube, put the
   band on the corners of anything round, and drew a grid on a subdivided
   one. Its first version measured a clean monotonic response to the width
   slider and was still wrong - only the screenshot showed four corner dots
   instead of a band. **A picture, not only a mean.**
3. **Five fitted models, scored against the region's own rim (a2.26).** A
   fixed 2-degree merge counted a 12-sided tube's 30-degree seams as edges
   though they shade smooth: **"angled" is not "sharp"**, and if a rule about
   edges exists twice in this file the two WILL disagree. Then: no model
   meant "unrestricted", which on a convex shell paints SOLID - invisible on
   a cube, everywhere on a nine-object tank.
4. **The same, checked harder (a2.27a).** On a curved band with one segment
   across it the vertices ARE the boundary, so the test measured each model
   against the points that defined it and could not fail. A cylinder wall
   tapered by 2% scored a perfect ring and came out solid.

The through-line: **a face can only ever say something about its own
interior.** Ask the edges.

## The a2.33 audit — every op run, and what it found

A whole session spent testing rather than building. Three passes: a dead-code
scan, a silent-failure scan, and a harness that runs **every** operation and
checks the same invariants each time. Five defects, of which the first was
three taps from a cube and corrupted saved files.

### 1. Undo re-dressed the geometry from the LIVE materials, by index

`restoreDoc` keeps the current look across an undo (`keepAppearance`), which
is right — undo should not rewind a paint job. It applied it **by index**,
with no check that the two agree about how many face groups there are.

Measured, three taps from a cube: paint face 3 plastic and face 5 metal,
delete face 1, press Undo. The materials came back on faces **2 and 4**, the
face actually painted was grey again, and one group was left unstamped — with
no `finishes` entry, which `reconcileFinishes` describes as belonging to the
Solid preset invisibly: it renders unmasked and ignores every edit to the
material it appears to wear. `serializeDoc` then persisted all of that.

The fix is a length guard. When the counts disagree the RESTORED step's own
materials win, because they are what that step actually looked like.

**The rest of that bug class is closed**, and it is worth writing down why the
per-op search kept coming up empty: `finishes` is no longer a hand-maintained
map but is DERIVED by `reconcileFinishes` from the material array on every
rebuild; `smoothGroups` is dead at runtime (migrated to position-keyed
`edgeShade` on load); the live marks are position-keyed and immune to
renumbering by construction; and `captureObjectState` snapshots all five maps.

### 2. A history entry was a VIEW of the live marks, not a copy

`serializeDoc` wrote `creases`, `edgeShade`, `finishes` and `smoothGroups` as
the live objects. Every doc already in the history therefore aliased the very
maps the next op was about to mutate, and `edgeShadeSet` / `creaseSet` hand
back the live object and write into it.

Consequence: **Mark Sharp, Shade smooth and Shade flat could not be undone.**
Measured — mark an edge sharp, press Undo, the mark is still there, because
the step being restored had been edited in place along with the mesh.
Autosave and the `.json` export read the same function.

Four spread copies. A snapshot has to be a snapshot.

### 3. Three ops did nothing and reported success

`confirmPendingOp` ended `toast(label + ' applied')` unconditionally and
`applyPendingOp` discarded every worker's return value. Bridge was the only op
with a failure channel. So:

- **Extrude two opposite faces** (symmetry off) — their normals sum to zero.
  It fired on `own`, the DEFAULT grouping, which never needed a shared
  direction in the first place. Now `own` extrudes them apart as asked, and
  only the modes that really need one shared direction refuse.
- **Loop cut into a non-quad** — two taps from a cube: Split an edge, then cut
  between the two five-sided faces that made. `applyPendingOp`'s own comment
  claimed `edgeLoopSelection` checked for this. It never did.
- **Inset a closed selection** — every face of a cube: no rim, nothing to
  inset towards.

All three dragged, did nothing, said "applied", and left a history step — so
the next Undo press looked broken too.

**The fix is one channel, not three patches.** `refuseOp(why, value)` sets
`opRefusal` at the point of refusal; `applyPendingOp` clears it before the run
and hands it to `op.lastWhy` after; `confirmPendingOp` restores the snapshot,
pushes NO history and says `"<Op> did nothing — <why>"`. Bridge keeps its own
`lastWhy` and is unchanged. Per-face modes clear the flag when at least one
face worked: one awkward face refusing does not make the op a no-op.

### 4. An Undo press that does nothing is now impossible to record

`pushHistory` compares the new doc against the one already at the cursor and
returns without recording an identical one. Compared on the MODEL only —
`nextId` counts objects that ever existed, so an op that builds a temporary
bumps it, and `selection` moves on its own; neither is something Undo should
have anything to take back. Two stringifies per committed edit, on a path
that already serializes for autosave.

Crease, Shade and Mark Sharp were also counting things they had not changed
("1 crease(s) cleared" over an uncreased edge). They count real changes now
and say "No creases on that edge" instead.

### 5. Smaller, but the same principle

- **Knife and Bridge refused silently** while an op bar was open, where
  Extrude says "Finish the … first". They say it too now.
- **`applyShading`'s two catches** logged to a console this app's users do not
  have. `warnOnce` says it on screen, once per reason per session.
- **A bridge that folds over** said so in the bar's label the whole time and
  then reported a clean "Bridge applied" at OK. The toast carries it now.
- **Mirror threw on a missing axis** instead of using the one the Symmetry
  pill is set to.

### Removed: twelve things nothing reached

Verified by whole-file identifier count (exactly one occurrence — the
declaration) and by reading each site. `selectionRadius` (sized the v1.57
move bars), `bestRingOffset` (superseded duplicate of `chooseRingOffset`,
without the weld avoidance that stopped 2/4/6-section bridges coming out
non-manifold), `isCreased`, `setObjComponentMode` (superseded by
`toggleObjComponentMode`), `INSET_RATIO`, `BEVEL_RATIO`, `SCALE_BASE`, the CSS
for `.lh-on`, `#objectStrip` and `#helpGestures`, and the `colorPicker` DOM
lookup left behind when the drawer's colour picker went — the only
`getElementById` in the file aimed at an id that does not exist, silent
because of its own `if` guard. 54 lines. A declaration diff before and after
confirms exactly seven names left and nothing else moved.

`windingAudit()` is reachable only from `window.__kubik` and STAYS: it is a
test hook, not dead code.

## The ops sweep — `_ops_probe.py`

38 cases, every user-facing op in every mode it works in, each run from the
same cube. For each: the op changed something OR said something (never
neither), winding, `material[]` and `finishes` still agreeing with the face
groups, exactly one history step for a change and none for a refusal, and
**Undo restoring the document exactly**.

Three things make it trustworthy, all learned by getting them wrong first:

- **It measures history by `historyIndex`, not `history.length`.** Every case
  undoes itself, so the next push truncates and refills the same slot and the
  length never moves — which read as "no history step" for ops that had
  pushed one perfectly well.
- **It compares `serializeDoc().objects`, not a hand-rolled fingerprint.**
  The probe and `pushHistory` cannot then disagree about what a change is. A
  hand-rolled one called Mirror on a symmetric cube a no-op and blamed the app
  for recording it; the document differed.
- **The object is re-fetched after every undo.** `restoreDoc` disposes every
  object and builds new ones, so a held reference is a stale one.

Two cases are marked as expecting broken winding, because they are: flipping
one face of a closed cube inverts it against its neighbours by definition, and
a flap extruded from an edge of a closed mesh hangs off an edge that already
had two faces.

## Screen layout

- **Top-left** hamburger → drawer. **Top-centre** tool/mode readout.
  **Top-right** view cube.
> **SUPERSEDED BY a2.89 wherever it describes where symmetry lives.** The
> toggle and the axes are one block, top-left under the menu button. The
> drawer row and its note are gone.

- **Top-left, under the drawer button**: the Symmetry pill, a horizontal
  two-state switch. It hung under the view cube until v1.99d, which left
  the top-left empty and the top-right crowded - the cube is a 128px
  object with its own presence, and a pill beneath it read as part of
  the cube rather than as its own control.
- **Bottom-left**: the round Object/Component button. A plain tap toggle.
  a2.3 gave it a press-and-hold mode ring; a2.4 removed it again.
  **Bottom-centre**: Undo/Redo. **Bottom-right**: Help.
- **The bottom row aligns on BOTTOM EDGES.** All four take a plain
  `bottom: var(--edge-b)`, and `--edge-b` is 4px against the 14px the other
  edges use, so the row sits low and leaves the viewport more air.
  v1.99b aligned it on CENTRES instead, through a `--bar-cy` variable - the
  textbook answer for round buttons of different sizes - and v1.99d reverted
  that after seeing both on screen. **Do not "fix" this back:** the 56px hub
  beside three 44px buttons reads better sharing a bottom edge. `--bar-cy`
  no longer exists.
- **`#thumbZone` is gone (v1.99c), and must not come back around one
  button.** It applied `env(safe-area-inset-*)` itself while `--edge-l` and
  `--bar-cy` applied it AGAIN to the button inside it, so on any phone with
  a home indicator the hub sat a full inset (~34px) above Undo/Redo and
  Help. Every edge-anchored control now measures from the `--edge-*` scale
  and nothing else. The four bottom buttons all take `#viewport` as their
  offsetParent; if one ever doesn't, suspect this.
- **Nothing else.** There is no rail of toggles down either edge — See-
  through, Floor grid, Snap, Add Cube and Tap/Box/Lasso select all live in
  the world ring.

## Controls

**Transforms have no gizmo.** You grab whatever is selected and drag it. The
same drag moves, rotates or scales depending on the active tool. Rotate and
scale turn around the PIVOT, which since a2.39 can be pinned anywhere (world
ring, left pole).

- Two-finger tap on empty space cycles Move / Rotate / Scale.
- **Three fingers carry three gestures, told apart by what the hand DOES.**
  A tap (still) switches Free / Axis. A slide (the centroid moves, the spread
  holds) sizes the soft-selection radius, in Soft mode only. A pinch (the
  spread changes, every finger agreeing in sign) isolates the selection, in
  Object mode only. Soft and Object are mutually exclusive, so no two of the
  three can ever be asked at once. See Isolate for why a pinch cannot be read
  from the mean spread.
- Three-finger tap switches Free / Axis. **Axis is the default** as of
  v1.99d: a drag along one named axis is what is wanted almost every time
  something is moved deliberately, and Free is one tap away. Not persisted
  by save/load, so every session opens in Axis.
- In Axis mode the axis is decided once from the first ~15px of the drag and
  held until you lift; re-deciding mid-drag made curving gestures wander.
- Free rotation takes its axis from the swipe direction, locked at the start.
- Free scale reads the projected axes, so depth is reachable without a
  dedicated gesture; a drag matching no axis scales uniformly.
- **An object-mode SCALE names the OBJECT'S OWN axes** (a2.55), not the
  world's — see below. Move and rotate keep world axes, and so does every
  component drag.

**Two rings bloom under your finger.** Press and hold; what you get depends
on what is under it.

- **On your selection** (300ms) → that selection's tools.
- **On empty space** (480ms) → the world ring: Add Cube, the four view
  toggles, and the select-gesture choice. Empty space waits longer because
  pressing on the background and pausing is also how a careful orbit
  starts, so that gesture has to prove itself before the camera loses it.
- Any travel over `RING_MOVE_CANCEL_PX` (8) cancels a pending bloom.
- The world ring is available in Box/Lasso mode too. It once wasn't, and
  since the ring is the only route back to Tap select, choosing Lasso
  locked you in permanently. A hold now abandons the region drag.

**World ring geometry.** Right-rail items (See-through, Floor grid, Aim
assist, Snap) occupy the TOP half; left-side items (Tap/Box/Lasso) the
BOTTOM half. Add Cube takes the right-hand pole alone — the only item that
makes something rather than toggling something — and the left pole is
deliberately empty so the two arcs read as two arcs.

Three things about the ring are load-bearing:

- **`pointer-events: none` on `#touchToolRing`.** The ring picks by ANGLE,
  so the icons never need touching. While they were hit targets, sliding
  onto one sent pointermove/pointerup to that div; the ring is not a child
  of the canvas so nothing bubbled back, hover froze and the release ran
  nothing.
- **It captures the pointer on the canvas** for its lifetime, so the mode
  button, Undo/Redo, the pill and the view cube cannot swallow a release.
- **The hover test needs `% (2π)` before the wrap.** `atan2` returns
  (−π, π] but the halved layout places items in [0, 2π), so `|ang − angle|`
  can exceed 2π and `2π − diff` then goes NEGATIVE — beating every real
  distance. Two items were unreachable. Do not remove that modulo.

**Ring radius** scales from the CLOSEST pair of items, not the item count,
so unevenly grouped sets still get real spacing.

**Object / Component / Soft** is the round button, bottom-left. It shows the
mode you are in and cycles on tap — three positions since a2.37, with Soft
wearing a ring around the component icon rather than an icon of its own.
(A two-position edge slider was tried at v1.89 and reverted at v1.92.)

**Symmetry** is the horizontal pill under the view cube. Left half on,
right half off; tap a half or swipe toward it. Object symmetry only — the
plane travels with the object.

## Selection

**Screen-space, never 3D ray distance.** Vertex and edge picking measures
pixel distance to the projected point/line. The 3D version failed in a way
no threshold fixes: an edge viewed at 5° claimed 69% of a face.

**Nearest visible wins**, which is a Voronoi split of the screen, so catch
zones can never overlap however far you zoom out. The rule in one sentence:
**we pick the nearest thing you can see.** It is applied in TWO PASSES —
find the closest candidate in pixels, then let depth settle everything
within `VERT_TIE_PX` (8px) of it. Two passes is not a style preference; see
"Why selection felt broken" below for what one pass did.

Edges use the same rule, taking depth at the point along the edge you aimed
at rather than at its midpoint, since an edge running away from the camera
is far nearer at one end. Faces need none of this — `pickFaceOnActive`
raycasts, so it already picks the nearest thing the renderer would draw.

**Marker size and target size are separate numbers, deliberately.**

| constant | value | why |
|---|---|---|
| `VERTEX_DOT_PX` | 2 | the marker should be quiet |
| `PICK_RADIUS_PX` | 28 | the target should be generous |
| `OFF_MODE_PICK_BIAS` | 0.7 | off-mode target stays ~19.6px, as before |
| `GRAB_RADIUS_PX` | 34 | grabbing is a different question (below) |
| `SEL_DOT_PX` / `SEL_EDGE_PX` | 7 / 3.5 | selected geometry reads loudly |

Dots are constant SCREEN size (`sizeAttenuation: false`, × pixel ratio) and
round (a textured sprite — untextured points render as squares). They were
world-sized once, so a dot shrank to ~4px at camera distance 25 while the
catch radius stayed 22px: you aimed at what you could not see. **Dots and
wireframe appear together in every component mode.** Hiding dots outside
Vertex mode was tried and reverted — it meant a tap near a corner could be
claimed by a vertex you could not see.

**Selected components get their own geometry**, not just a different colour:
a second `Points` and a `LineSegments2`, rebuilt from the selection on every
change and torn down in `hideAllHelpers`. This is structural — `PointsMaterial`
carries one size for the whole object and `LineBasicMaterial.linewidth` is
ignored outright by WebGL, so "thicker when selected" is impossible inside
the shared helpers.

**Selection is RED** (`0xff4d47` dark, `0xD1443A` light), deliberately the
one colour the interface never uses. Matching it to the UI accent was tried
and failed: "chosen" agreed with the buttons and vanished against the model.

**Selecting and grabbing use different radii** because they are different
questions. Selecting asks "which of these did you mean" and wants precision;
grabbing asks "are you taking hold of what is already yours" and wants
generosity. `pointerOnSelection()` measures ONLY against selected
components, so an unselected neighbour nearer the finger cannot steal the
grab and turn it into an orbit. Pressing inside the selection's screen
bounding box also grabs (3+ components; skipped when the box covers >60% of
the viewport, so there is always somewhere left to orbit from).

**Tap slop is per pointer type.** Touch gets 12px slop and an 8px drag
start; mouse and pen keep 6px. A thumb rolls further than 6px as it presses
and lifts, so ordinary taps were being discarded as camera drags.

**Two rules, in this order.** WITH A SELECTION the type is LOCKED: only that
same type can be picked until you tap empty space to clear. It removes
catch-zone ambiguity by construction, and it must NEVER be silent — a
refused tap hits neither branch of `handleTap` (the object under the finger
IS the active object, so nothing to switch to; not empty space, so nothing
to clear) and simply evaporates, so it probes what was actually there and
says so. WITH NOTHING SELECTED the tap is FREE: vertex, then edge, then
face, and it moves you into whichever it found.

**a2.3–a2.3a tried the opposite and it was reverted at a2.4, by request.**
The theory was that the free tap is what makes vertices unreachable: tap a
little off a corner, find no vertex within 28px, get the face underneath and
be moved into Face mode, with every tap after that a face. So a2.3 added a
press-and-hold mode ring on the bottom-left button and a2.3a made the mode
sticky. It worked, but declaring a type before every tap is a tax on all
taps to fix a minority, and the ring and the sticky mode are both gone.

**If "I can't select a vertex" returns, this is where it lives** — and the
fix is a bigger vertex catch radius or a better tie-break, NOT a mode you
set by hand. Do not reach for proximity either: measured at a2.2a, the
closest face-centre to its nearest visible vertex is 25.2px on a plain cube,
6.1px subdivided once, 0.8px twice, 0.5px three times. By 96 faces a face's
own centre IS a vertex to within a pixel — the distributions overlap
completely, and a threshold generous enough to catch a deliberate vertex tap
on a cube refused 32 of 48 face centres on a subdivided one.

**A harness cannot see an aiming bug.** Every test here computes its tap
positions with `worldToScreenPx`, the same function the picker uses, so any
offset between the DRAWN dot and the PICKED point cancels out and the sweep
comes back 59/60 with the bug untouched. `?debug=1` toasts the pick line
(nearest-vertex distance, signed dx/dy to it, DPR, viewport-vs-canvas rect
offset) precisely so a phone can report what no harness here can measure.

**The mode ring (a2.3) is what makes the lock liveable.** Hold the bottom-
left button and Object / Vertex / Edge / Face bloom; picking one sets the
mode and clears the selection. Before it, the sub-type was decided purely
by whatever your first free tap landed on — and a tap on the model almost
always finds a FACE, so the lock usually settled on Face and vertices
became unreachable. Reported, correctly, as "I cannot select a vertex no
matter how close or far I zoom": there was no way to ASK for vertices.

**Do not try to infer intent from proximity instead.** Measured at a2.2a:
the closest face-centre to its nearest visible vertex is 25.2px on a plain
cube, 6.1px subdivided once, 0.8px twice, 0.5px three times. By 96 faces a
face's own centre IS a vertex to within a pixel — the distributions overlap
completely, and a threshold generous enough to catch a deliberate vertex
tap on a cube refused 32 of 48 face centres on a subdivided one. Saying
what you want beats guessing it.

**No deliberate way to switch component type** — you must successfully tap
the type you want, or clear and tap again. This was solved at a2.3 and
un-solved at a2.4 on purpose; see above before rebuilding it.

**The ring's radius is capped by the SCREEN, not just by its item count
(a2.7b).** `bloomToolRing` sizes itself from the tightest pair of items, which
is unbounded: the Edge ring is thirteen tools and asks for ~192px, needing a
444px-wide viewport before it fits at all. On a phone the centre clamp then
had no legal position to clamp to, so it pinned to one side and half the ring
hung off the right-hand edge. The radius is now `min(ideal, what fits)` and
the centre falls back to the middle when even that is too big. Squeezing the
icons is much the lesser problem: thirteen items on a 390px screen still sit
~70px apart, and the ring picks by DIRECTION, so you never have to land on
one. Measured on a 400x751 viewport: every ring fits entirely, from any
corner.

**Rings are DRAWN where they fit and AIMED from the finger.**
`bloomToolRing` keeps a ring `R + 30` inside the viewport, so one bloomed
near an edge — or from the corner mode button — lands well away from the
finger that opened it. Hover used to be measured from the drawn centre,
which put the finger outside the dead zone before it had moved: the first
pixel of jitter highlighted whatever lay on that bearing, and lifting in
place RAN it. The optional `aim` argument separates the two, and all three
callers pass it. (The per-set `deg` bearings and the `owner` tag went
with the mode ring at a2.4.)

**Item ORDER inside a ring decides which bearing each tool gets, and a few
of those seats are worth more than others (a2.7e).** `toolRingAngles` puts
whatever is declared first exactly on-axis (straight up, zero angular
guesswork) — and for a ring with an even item count, the item declared
exactly opposite it (index `n/2`) lands on-axis too (straight down), for
the same reason. Every other seat needs a real aim. Reordered three arrays
to spend those free seats on the tool most likely to earn them, using
Blender's own single-key hotkey assignment (Extrude/Inset/Bevel/Loop
cut/Knife/Delete) as a frequency proxy, since Kubik has no usage telemetry
of its own: Edge ring's top-3 is now Extrude/Bevel/Loop cut (Bridge moved
out — it only held that seat because of a two-radius ring layout that's
since been removed, see the a2.7b note above); Face ring's on-axis-bottom
seat is now Cap holes, not Knife; Object ring's on-axis-right seat is now
Delete, not Centre. Full reasoning, plus every other ring's angles measured
the same way: the Bloom Ring Ergonomics doc. No geometry changed — only
declaration order, which is the one thing the angle formula reads.

**Back-facing components are rejected by face normal**, so picking agrees
with back-face culling. Mirrored (negative-determinant) objects are
sign-corrected.

**The camera never moves on a pick.** See the do-not-rebuild list.

## Why selection felt broken (v1.99e-g)

The complaint was "sometimes I tap right on something and nothing selects,
sometimes something near it gets selected" — and it happened whether or not
anything was already selected, which rules out the type lock and the grab
path, since both are inert on a fresh tap.

**Three plausible causes were on the table and measurement killed all
three.** The picker is fine: aiming exactly at a vertex hit it 860/860 times
across 72 camera angles, and with realistic thumb jitter it agreed with
ground truth on 2892 of 2922 taps and **returned NOTHING on zero of them.**
A picker that never comes up empty cannot be why taps come up empty.

So the tap was never reaching it. The only gate above it is

    if (moved > tapSlopPx(ev) || wasOverGizmo) return;

a bare return with no feedback. A thumb rolls well past 12px pressing and
lifting, and the tap was silently discarded — while the camera still
orbited a hair, which is what read as "at some angles". **The same fix had
been made once before, 6 → 12, and under-shot.** Now 22.

Three real defects turned up alongside it, all small, all now fixed:

| | was | measured |
|---|---|---|
| Tie-break compared against a RUNNING best and wrote `bestD = Math.min(...)`, so the recorded distance belonged to a vertex that had already lost — order-dependent, and a vertex 3px from the thumb could lose to one 10px away | v1.99f | 1.03% of jittered taps wrong |
| Edges had **no depth preference at all**, purely nearest-in-pixels | v1.99f | — |
| `groupFacesCamera` judged a face by its FIRST TRIANGLE, used a strict `dot > 0` that failed exactly edge-on, and called `updateMatrixWorld()` AFTER transforming every point | v1.99g | 0.44% of face tests disagreed |
| No occlusion test at all — a vertex facing you but hidden behind a fold stayed a candidate | v1.99g | the last 0.14% |

Wrong picks went 1.03% → 0.14% → **0%**, empty returns stayed at zero
throughout, at 0.47ms per tap including the ray casting.

**The occlusion test can only BREAK TIES, never refuse the last candidate
standing.** An occlusion test is the easiest way to reintroduce "nothing
happened", which is the failure mode this whole strand existed to remove.
See-through is exempt by definition.

**Known cost of the 22px slop:** a deliberate orbit under 22px now also
registers as a tap, so nudging the camera over empty space clears the
selection. If that ever becomes the worse annoyance the answer is NOT a
smaller number, it is a time test — a quick stab and a slow drag are
different gestures at the same distance.

## Rendering

- **Active object's wireframe at `FRAME_ACTIVE` (2.0), others at
  `FRAME_DIM` (0.8).** The gain is applied above 1, which ACES tone mapping
  rolls off rather than clipping. In Object mode the SELECTED set decides
  which is active, not `activeObjectId`, which can point elsewhere.
- **Floor contact shadow is OFF** via `SHOW_FLOOR_SHADOW = false`, not
  deleted. The shadow camera, catcher plane and per-theme opacity are all
  still wired, so it returns by flipping that one word.
- **The view cube is 128×128, flush to the corner, unscaled.** `ViewHelper`
  always draws a 128px square anchored in a corner of its element — `dim`
  is a fixed constant in the library, not a setting. At 96 it was clipped;
  at 1.5× it became a 192px `touch-action: none` element covering ~10% of a
  phone screen and swallowing every tap that started there, which read as
  selection and dragging being broken. **128 is the only size that neither
  clips nor over-claims.**

## Object tools added v1.99h-k

**Flip normals** (face ring and object ring). Reverses face winding — the
manual remedy for what `auditWinding` reports. Face mode flips the
selection, Object mode flips everything in the selected objects. Per-element,
so symmetry expands one face to two. *A whole object flipped once still
audits as ok:* the audit measures whether neighbours agree with each other,
not whether the surface faces outward, and a fully inverted object is
perfectly self-consistent. Global inversion is something you see, not
something the audit can catch.

**Cap holes** (edge, face and object rings). Closes open boundaries.

**In Edge mode a selection NAMES the hole.** Select its rim and only that
hole is capped — one edge of it is enough, so you never have to select the
whole loop to say which one you meant, though a double-tap edge loop hands
you the whole rim anyway. This is the use Zeghreit asked for and it is the
main way in. With nothing selected, or in any other mode, every hole in the
object is fair game, because a hole belongs to the mesh rather than to the
selection.

A face's boundary loop is DIRECTED, and two faces sharing an edge traverse
it in opposite directions — that is what makes their normals agree. So an
edge traversed in only ONE direction has nothing on its other side: it is
rim. `auditWinding` already counted exactly this as `boundary`; Cap uses the
same fact to fix rather than to report. It also hands the new face its
winding for free — fill the rim with its REVERSE and the cap necessarily
agrees with the surface around it, with nothing to guess.

Two things it got wrong first, both caught by measuring rather than reading:

- **A vertex can have more than one outgoing rim edge.** Delete two opposite
  faces of a cube and the rims share corners. Recording only the first
  outgoing edge per vertex stitched two rims into one bogus loop. The walk
  now consumes directed EDGES, never marking vertices visited, because a
  vertex shared by two rims must be walked through twice.
- **Not every rim can be closed by one flat face.** Delete three faces in a
  strip and the rim wraps around the block: non-planar, self-overlapping in
  projection, so ear-clipping emits crossing triangles. Measured boundary 8
  before, **10 after** — it made the mesh worse while reporting success. Cap
  now caps, re-counts the open edges, and **puts the mesh back if the number
  did not fall**, saying the opening is not flat enough. Measured across
  seven cases: six reach boundary 0, the impossible one is left untouched.

**A selection can outlive what it points at, and that used to crash the
app.** `refreshGizmoAttachment` did `topo.edges[ei].forEach(...)` with no
guard. Any op that rebuilds the mesh renumbers every element, so an id left
over from before is not merely stale, it is out of range — and the throw
took the whole app down rather than losing one highlight. Cap holes found
it because it consumes the very edges you selected, but every rebuilding op
could have hit it. All three branches are guarded now, and Cap clears the
consumed selection rather than leaving ids pointing at whatever happens to
sit at those numbers afterwards.


**Separate** (object ring). The inverse of Join: one object per CONNECTED
piece. Connected, not spatially near — two cubes that overlap but share no
vertices are two pieces, two that were bridged are one. The shell walk
compares LOGICAL vertices, because every face owns private copies of its
corners for hard-edge normals and comparing attribute indices would report
a plain cube as six loose quads. Says so when there is only one piece.

**Flip** (object ring, beside Mirror). Reflects an object where it stands.
Same plane rule as Mirror, so the Symmetry pill governs both: off flips
across the world axis (which moves an off-centre object to the other side),
on flips across the object's own captured plane (which does not move it).

**Mirror now asks Joined or Apart**, one tap on the op bar's grouping row,
Joined leading. The choice cannot be deferred: the halves come out welded
at the seam, so Separate sees one connected piece and correctly refuses.

**Baking beats negative scale.** Flip and Mirror-Apart bake the reflection
into the geometry and reverse the winding rather than giving the object a
negative scale. A negative determinant reverses triangle handedness, which
is exactly why mirrored objects are forced to render `DoubleSide` — and
that DoubleSide clause is the last place picking and rendering still
disagree. Anything that keeps a mirrored copy around should bake.

Baking moves the geometry but not the ORIGIN, so `recentreObjectOrigin`
slides the geometry onto its own centre and moves the transform to match —
otherwise the inspector reports the position the object was reflected FROM.

## Deliberately absent — do not rebuild these

- **The transform gizmo.** Iterated for many versions, removed once direct
  dragging worked. Tagged `v1.57-handles`.
- **The fixed-corner fan menu.** Replaced by the press-and-hold ring.
- **A label on EVERY ring item.** They read wider than they measured and
  pushed the icons into each other. Still absent, and should stay absent.
  **This is NOT the hover label shipped in v1.99b** - that is ONE label, for
  the item under your finger, in its own element that no icon's layout
  depends on, sitting outside the ring. The overlap failure needed many
  labels at once, so it cannot return this way. Measured at the ring centre
  and at both edges: never overlaps any icon, and the clamp keeps it on
  screen. Do not delete the hover label thinking it is this entry.
- **Two-ring bloom menus.** Hover picks by angle only, so an outer ring is
  unreachable by construction.
- **Smart camera, and Aim assist after it.** The first drifted the view to
  a three-quarter angle after every selection; the second, its last
  survivor, eased the camera in after a vertex or edge tap when the nearest
  neighbour was closer than twice the catch radius. Both answered a question
  nobody was asking. **Being moved when you did not ask to be moved reads as
  the app losing your place**, and the measurement that justified the second
  one - targets too close together to tell apart - is not something you
  notice while it is happening. Pinch-zoom is one gesture and it is yours.
  Tagged `v1.87-smartcam`; Aim assist went at a2.30a, taking `App.aimAssist`,
  the world-ring toggle, `AIM_CROWD_PX` / `AIM_ROOMY_PX` / `AIM_MAX_ZOOM`,
  `logicalVertexPx` and `nearestVisibleNeighbourPx` with it. `camAnim` and
  `animateCameraTo` STAY - the double-tap framing still uses them.
- **The edge rails.** Five buttons down the viewport sides, now in the world
  ring.
- **The rounded-edges (Fillet) preview.** REMOVED AT a2.50, and this entry is
  the one exception in this list: it is **pending a better construction, not
  rejected**. Zeghreit's words were "needless op for now - later we will
  construct it better but it's not essential". What went: the drawer section,
  the Object-ring item at seat 1, the `fillet` icon, two help rows, `App`'s
  `fillet` / `filletRadius` / `filletProfile` / `filletSegments`,
  `FILLET_ANGLE`, and `findSharpEdges` / `buildFilletedMesh` / `clearFillet` /
  `refreshFillets` / `toggleFilletPreview` with their call sites in
  `pushHistory` and the export path. Tagged `a2.50-fillet` so the
  implementation stays findable. **Seat 1 in the Object ring is deliberately
  free** and whatever replaces this should take it back - the pairing with
  Bevel one ring over was the good part. Do not rebuild it as it was: a live
  preview that clones every object's mesh and materials, rebuilds on every
  history push, and has to be special-cased in export is the shape of the
  problem.

## Hard-won lessons

- **Measure, don't reason.** Every layout, geometry and picking bug in this
  project was found by running numbers or reading a screenshot, and missed
  by reasoning about the code. This is the single most reliable rule here.
- **Ask what "broken" looks like before writing code.** "Nothing happens at
  all" versus "picks the wrong thing" are different bugs with different
  causes. Three plausible fixes were shipped for a selection complaint
  before the symptom was named; naming it found the cause in one read.
- **The update banner is the ONLY way an iOS Home Screen app learns a new
  version exists** — no pull-to-refresh, no reload button. `checkForUpdate`
  matched `/>v(\d+\.\d+)<\/span>/`, which assumed a leading "v" and two
  numeric parts, so the day versions became `a2.0` it matched nothing and
  the banner silently stopped appearing. Anyone on the Home Screen app was
  then stuck on a cached build reading "you shipped nothing". Fixed a2.3a to
  match the ELEMENT and compare its text. **Never encode the version format
  there again.**
- **THREE things are keyed by face-group index**, not one: the `material[]`
  array, `userData.smoothGroups`, and `userData.finishes`. Any op that
  renumbers groups must carry all three, and `captureObjectState` must
  snapshot all three or a revert puts the geometry back and leaves them
  shifted. Dissolve shipped carrying two of them and a reviewer caught the
  third. Grep `finishes` before you renumber anything.
- **A silent no-op is the worst failure mode.** It is indistinguishable from
  a broken app. Several bugs here were "the code correctly decided to do
  nothing and told no one": the type lock, `avgDir` cancelling to zero,
  symmetry finding no pairs. When a guard returns early, say so.
- **Check for DUPLICATE declarations after any rewrite.** A second copy of a
  function is a hard SyntaxError that blanks the whole app, and esprima-based
  `_syntax.py` does NOT catch it. `_verify.py` does.
- **Large deletions need a declaration diff** against the last commit.
  Cutting between line markers has silently swallowed the App object, the
  theme system, the raycaster and the view cube on separate occasions.
- **Never `git add -A` in this repo.** Everything scratch here is
  `_`-prefixed - patch scripts, probes, their generated harnesses, their
  `_out.txt` reports - and until a2.50 that convention lived only in the
  NAMES. One `git add -A` swept 300 of them into a commit. `.gitignore` now
  carries `_*`; add with `-f` if one ever deserves tracking. Commit by naming
  the files.
- **`edit_block` is unreliable above ~20 lines.** Use a Python patch script
  with exact-match assertions so it fails loudly rather than half-applying.
- **Check the library source before designing around it.** The view cube was
  resized twice on assumptions; the real constraint was a fixed `dim = 128`
  that one read of ViewHelper would have shown.
- Zeghreit tends to spot the right conceptual direction early. When a
  reframe is proposed, follow it rather than defending the implementation.

## Watch out

- v1.79 made **winding correctness load-bearing** by switching to FrontSide
  culling. Anything producing reversed winding can render or pick wrongly.
  Mirror is handled (negative-determinant flip in `combineObjectsInto`).
  **Extrude, bridge and subdivide are MEASURED as of a2.33** — the ops sweep
  audits winding after every one of its 38 cases and all of them are clean
  except the two that cannot be (see "The ops sweep"). Under `?debug=1` any
  op still reports its own `[winding]` line.
- **Symmetry only mirrors vertices that already have a twin.** It keeps a
  symmetric model symmetric; it cannot restore lost symmetry.
- Symmetry applies to component edits only, never object drags.
- **One loop cut case is silently NOT symmetric**, and it is worth knowing
  precisely: an edge running ALONG the mirror axis is its own mirror, so no
  second ring is cut — correctly, there is only one ring — but the cut then
  slides along that axis. At the default (Even, one loop) it lands on the
  plane and all is well. **Slid off centre it lands off-plane, on one side
  only.** Measured on a cube at t = 0.25: loop at x = +0.25, model no longer
  symmetric. Fixing it means also cutting at the plane-mirrored position,
  which doubles the loop count and so needs a design call, not just code.
  **That call was made at v1.99d: leave it.** Tested in use and it does not
  get in the way — the case needs a ring parallel to the mirror axis AND the
  slider moved off centre, and the default lands on the plane. Doubling the
  loop count to rescue it would change what the slider means for every other
  ring, which is a worse trade. Accepted limitation, not an open bug.
- **Region inset still walks only its FIRST rim loop.** Two disconnected
  patches inset as one and the second gets nothing — pre-existing, not new,
  but symmetry makes it easy to reach: pick Organic or Keep shape with a
  mirrored pair. `each` (the default for a pair) is unaffected.
- The symmetry plane is captured, not live — see The symmetry plane below. If
  a model stops mirroring after a big change, re-tap Symmetry on.

## The recorded debt, gone through (a2.64)

Seven things had been written down over the versions and never scheduled.
Going through them properly turned out to be as much about **retiring notes
as fixing code** — three of the seven were not what the note said, and one
of the fixes had to be reverted after the review took it apart.

### Fixed

- **Forking a material dropped its masks.** The `+` card copied `color`,
  `roughness`, `metalness`, `envMapIntensity` and `bevel` — so you would
  pick the material you liked, press `+`, and get a plain one. It copies
  `masks` now, one level deep, so the fork owns them: a shallow array would
  hand the new material the SAME mask objects, and editing one would
  silently edit both.
- **`syncSelectionOverlay` had no active-object guard**, the one
  `syncFaceOverlay` was given at a2.54 for exactly the same reason.
  `App.selectedElements` holds indices, not identities, so drawing it
  against any object but the active one paints THAT model's vertex 2
  because vertex 2 of something else is selected. The paths that reach it
  with a passer-by are the ones that refresh colours on a merge or a weld.
  Anything already drawn on a non-active object is torn down rather than
  left behind.
- **The view cube's box swallowed taps that missed the cube.** The box is
  square and the cube is not: at any angle its silhouette is a hexagon
  covering about a third of the square, and the rest was a 128px corner
  that ate taps and did nothing with them. `clip-path: circle(40%)` clips
  HIT TESTING as well as paint, so the corners fall through — at no cost
  and with no JavaScript. 40% is 51.2px against the cube's own 48.4px
  silhouette radius, about 3px of clearance.

### Fixed, then fixed again

Falling through was right for a DRAG — the corner orbits the camera now
instead of dying — and wrong for a TAP: it went through to empty space,
which clears the whole selection. A tap aimed at a control and landing a
few pixels wide of it should not throw your selection away. `onEmptySpaceTap`
exempts the cube's box and nothing else.

### Reverted

**The face overlay's index buffer.** The note said a drag select abandoned a
GL buffer per pointermove. It does abandon buffers — `setIndex` replaces the
attribute, and three keys uploaded buffers by the attribute object in a
WeakMap, so the superseded one is forgotten rather than deleted — but **not
per pointermove**. A marquee drag only moves the marquee;
`performRegionSelect` runs once, on pointerup. The one thing that does run
per frame, `syncHelperGeometry` into `refreshElementColors`, takes the early
return, because a drag cannot change WHICH faces are selected.

a2.64 tried reusing the attribute in place with a draw range. The review
showed it made things worse on both counts: `needsUpdate` with no update
range re-uploads the WHOLE array, so after one 300-face selection every
2-face selection uploaded 900 indices instead of 6 — and growth, which is
the normal direction of a selection, still allocated. **Reverted.** The item
is closed as mis-stated rather than fixed.

### Notes retired without a change

- **`HUB_TOOLS_EMPTY` is not dead code.** `currentHubTools()` returns it
  whenever Object mode has nothing selected. The a2.56 note calling it
  unreachable was wrong.
- **The edge-distance field is not lost across a rebuild.**
  `rebuildFromEditable` disposes it deliberately and `ensureEdgeField`
  rebakes it on the next call. That is a cost, not a bug.

*The lesson worth keeping:* a note written at the moment of noticing is a
hypothesis, not a finding. Three of these seven had drifted from what the
code actually does, and one of them sent a fix in the wrong direction until
the review caught it. Read the code again before believing your own list.

Covered by `_theme_probe` section 12: that an unchanged selection rebuilds
nothing and a changed one does, that a passer-by gets no overlay while the
active object keeps its own, that a fork carries and owns its masks, that
the cube's corners hit-test to the model and its middle to the cube, and
that a near miss at the cube keeps the selection while real empty space
still clears it.

## One primary, one silhouette (a2.63)

The last two picks from the visual review, and with them that whole thread
closes.

### The op bar: three primaries is no primary

The accent used to draw the bar's outline, the chosen segment inside it AND
the confirm button, so the eye had nowhere to land first. Now:

- The bar earns its edge from a shadow and a `--line` hairline.
- The segmented control is neutral-on-recessed — a raised tile in a sunken
  track, which is what a segmented control has always been.
- The slider knob is `--text`: a thing you hold, not a thing you commit
  with.
- The value stopped being a bordered box and became a **readout beside the
  slider that sets it** — still an input, so an exact number can still be
  typed, it just stops shouting about it.
- OK is `✓` rather than `✓ OK`.

**The accent now means exactly one thing on screen: THIS COMMITS.** The
probe counts it — every element in the bar wearing the accent as a fill or a
border, and the answer has to be `opOk` and nothing else.

*Honest about the height:* an op with three grouping chips still wraps to
two rows at phone width — Inset's `Each / Organic / Keep shape` plus a
slider, a value and two buttons will not fit 375px however it is dressed.
What one row buys is every op that has no chips, and the second row is
slimmer than it was.

**One decimal separator, at last.** `#opValue` was `type="number"`, and a
number input renders its value with the BROWSER's separator — so it read
`0,25` while every other readout in the app, all of them spans formatted
with `toFixed`, read `0.25`, a second apart on the same screen. It is
`type="text" inputmode="decimal"` now and always shows a point; `parseAmount`
accepts either.

### The material tray: a handle that holds on to its tray

Open, the tab used to take `margin-right: 26px` and a full radius, which
floated it clear of the panel it is the handle OF — two unrelated chips at
the right edge. The flyout lays out as a ROW when open and the tab becomes
the tray's left shoulder: one silhouette, one border, and the close
affordance sits where your thumb already is.

- 32px wide open, not the 44 it has closed and not the 26 the sketch drew.
  Closed it is the only target there and wants the full 44; open, the whole
  tray is the target and the tab only has to be grabbable.
- The shelf starts level with the tab now rather than below it, so
  `--mat-max` got back the 62px the tab and its gap used to cost it.
- The applied card said so twice — a border AND a recoloured label — for one
  boolean. The border alone is enough. (`.mat-edit` stays: it is a control,
  not a status.)

### What the review found (a2.63a)

- **BLOCKER — the chosen segment was no longer visibly chosen.** Neutral on
  recessed is right, but the first attempt used `--panel2` on the `--bg`
  track: **1.20:1**, where the WCAG minimum for the edge of a control is
  3:1. Worse, the plain `button:hover` fill was BRIGHTER than the chosen
  tile, so on a desktop hovering an unchosen chip made it read as the chosen
  one. `#5c6575` is 3.19:1 against the track, 2.42:1 against hover, with
  `--text` on it at 4.84:1. Every chip carries a transparent border now, so
  the active one is not 2px wider and cannot nudge a wrapping bar onto
  another line.
- **Arrow keys were dead.** A number input supplied ±step natively; a text
  input does not, and the global stepper shortcut bails on any `INPUT`
  target. Up and Down step by the slider's own step. A `blur` handler also
  puts the real amount back, because half-typed text — `1.2.3`, `-`, an
  empty box — parses to something the op never took, and the field went on
  showing it.
- **Every close reflowed mid-animation.** Dropping `.open` in one frame
  flipped the flyout back to a column instantly while the tray was still
  220ms into collapsing, so the still-opaque shelf visibly jumped from
  beside the tab to below it before disappearing. A `.closing` class keeps
  the row layout for one transition longer.
- **The projection pill was 24px under the open tray.** Welding the 32px tab
  on took the flyout's open width from 96 to 128, and the pill's 104px
  offset had been chosen against the closed width. 136 clears both.

Covered by `_theme_probe` section 11: the accent count, the readout's
border and separator, the OK label, the bar height, the chip's measured
contrast against its track, the arrow keys stepping the amount, the welded
geometry, and the pill clearing the flyout open as well as closed.

*Measuring a transitioned property is the trap that caught this suite
twice now:* `getBoundingClientRect` and `getComputedStyle` mid-transition
return the FROM value. Finish the animations first —
`el.getAnimations().forEach(a => a.finish())`.

## Mode, all the way down (a2.62)

The last idea from the design canvas, and the one Zeghreit picked: the
**viewport** answers to the mode, not just the chrome. Before this, every
mode rendered the model identically and you found out which one you were in
by tapping something and seeing what got selected.

| mode | hemi | key | env | wireframe | dots |
|---|---|---|---|---|---|
| Object | 1.00 | 1.00 | 1.00 | ×2.00 | ×1.0 |
| Vertex | 0.55 | 0.45 | 0.50 | ×1.10 | ×1.6 |
| Edge | 0.50 | 0.40 | 0.45 | ×3.40 | ×1.0 |
| Face | 1.95 | 0.28 | 0.40 | ×0.35 | ×1.0, hemisphere **flat** |

**Not one of those numbers touches a material.** That is the whole trick:
the helpers — dots and wireframe — use UNLIT materials and the model does
not, so turning the LIGHTS down steps the surface back while leaving the
components exactly as bright as they were. Nothing is saved and restored, no
user colour is mutated, and the undo history never sees it.

- **Vertex** — the surface steps back so the points can step forward.
- **Edge** — the wireframe becomes the subject. Genuinely thicker lines
  would mean a `Line2` for every object's wireframe; driving the colour past
  1.0 buys the same read at 1px and costs nothing, because the ACES tone
  mapping rolls it off rather than clipping.
- **Face** — flat panels with dark seams. `flat` makes the hemisphere
  UNIFORM by giving it its own sky colour on the ground side: raising the
  ambient alone was not enough, because a HemisphereLight still shades by
  `normal.y`, so the top face stayed brighter and the model went on reading
  as a lit solid. What actually flattens it is taking the KEY and the
  ENVIRONMENT away — they are what models a surface. Face ends up a shade
  darker than Object as a result, which is the honest trade.

**The material tray suspends all of it.** A mode that dims the surface hides
the material you are in the middle of choosing, so while the tray is open
the viewport renders plain and snaps back when it closes. Zeghreit's call,
and it needs no setting.

**The escape is Object mode**, which renders plain by definition and is one
tap away in the corner. It costs you the component selection, which is the
honest price of stepping back to look at the whole thing. Nothing new was
added for it.

### What the review found (a2.62a)

- **The image-based light is a light.** Only the four analytic lights were
  multiplied, so a METAL — lit almost entirely by the environment
  reflection — was barely dimmed in Vertex and Edge and impossible to
  flatten in Face: the reflection kept the gradient the flat hemisphere
  exists to remove. Even the default Solid finish carries an
  `envMapIntensity` of 0.5, so it was never only about metals. The mode's
  `env` factor now lands in `applyEnvLive`, which is where
  `scene.environmentIntensity` lives — and which is documented as free: no
  re-bake, no prefilter, no recompile.
- **THE MARKS ARE NOT THE WIREFRAME.** The mode's weight started life as a
  scalar on the `edgeLines` MATERIAL, and that one colour buffer carries
  four different things: the plain edge, the crease mark, the sharp mark and
  the selected edge. Face's 0.35 dimmed the crease and sharp marks to a
  third — in the mode you set creases in, right before a Subdivide — while
  brightening the surface behind them. Edge's 3.4 drove crease `#ff7a45` and
  sharp `#ff8a3d` up the roll-off toward the same white, when the whole
  point of those two colours is that they never read as the same thing on
  one mesh. The weight is baked per edge now, on the plain wireframe alone,
  and the material multiplier stays at 1. `setColScaled` writes it
  deliberately unclamped, which is what lets a wireframe run hot.
- The dot hierarchy scales together: selected (7px) and soft-falloff (5px)
  dots take the mode's factor alongside the base 2px, so the 3.5:1 ratio
  that makes a selected vertex obvious survives the one mode that grows
  them. The Vertex factor came down from 2.0 to 1.6 to keep the top of that
  range sane.
- The knife's placement dots read `vertexDotSize()` and so were silently
  doubling in Vertex mode. They use their own size now — knife dots have
  nothing to do with which component type you are picking.
- The dot-size refresh sat below `if (!lines) return;`, so it was gated on
  the wireframe existing.

`_theme_probe` section 10 measures all of it per mode, including that the
crease mark is the same colour in every mode, and that the tray suspension
goes 0.50 → 0.90 → 0.50 and clears its flag.

**Section 5 of that suite was rewritten here.** It used to assert that
NOTHING in the viewport moved with the mode — the a2.58 rule. a2.59 gave the
selection the mode's colour and a2.62 gave the wireframe the mode's weight,
both deliberately. What it asserts now is the part that was ever really at
stake: no mode may change the scene's own colours — the background, and the
colour of an unselected vertex dot, whose SIZE carries the mode rather than
its hue.

## Perspective and orthographic (a2.61)

> **SUPERSEDED IN PART BY a2.85.** The long-lens emulation this section
> describes is gone - the flat view is a real `OrthographicCamera` now,
> and with it `syncOrthoDepth`, `orthoFactor` and the fog shifting went
> too. The turn rule went in a2.86 and came back scoped in a2.87: it
> applies to the flat view a CUBE TAP opens, not the one the pill opens.
> What still holds unchanged: the switch and where it sits. Read the a2.87,
> a2.86 and a2.85 sections first.

Zeghreit: *"add perspective/orthogonal switch near axis cube, and after going
into orthographic via tapping the cube, only turning the view (or the switch)
switches back to perspective — moving and zooming stay in ortho."*

**The switch.** `#projPill` under the cube, reading **Perspective** or
**Orthographic** and toggling on tap. It lives under the cube because the
cube is the other way into the flat view, and it is offset far enough left
to clear `#matFly` — which is a shrink-to-fit column whose width is the
TRAY's 96px, not the 44px tab you can see. A pill tucked against the tab had
its right end silently dead to taps.

**Only turning leaves it.** It used to be any gesture at all: the controls
fire `start` for a rotate, a pan and a dolly alike, so nudging the model
sideways or zooming in to check a corner threw you back into perspective and
you had to tap the cube again. That made the flat view something you visited
rather than something you worked in — and drafting is exactly what it is
for.

A TURN is the gesture that changes the direction you look **from**. Pan
moves the camera and its target together; a dolly only changes the distance;
both leave that unit vector alone. So the rule is measured off the vector
rather than asked of the controls, which also means it works for a mouse
wheel, a trackpad pinch and two fingers without knowing anything about any
of them. The threshold is one degree, not zero, so a sub-pixel wobble in a
pan does not count.

The watch is armed on `start` and **not disarmed on `end`**. Damping keeps
turning the view for about a second after the finger leaves, and a fast
flick has barely moved by the time it lifts — disarming on `end` let that
coast carry the view thirty degrees round while the app still claimed to be
showing a plan view. A cube swing is excluded, and re-arms when it lands.

The swap itself is invisible: `disengageOrtho` restores the framing exactly,
so the picture does not jump — only the perspective in it relaxes.

### What the review found (a2.61a)

Letting the zoom stay flat broke two things that had been safe only because
any gesture used to drop you out of it.

- **BLOCKER — zooming out erased the scene.** Fog is banded by camera
  distance, and the flat view sits ~27x further out, so `engageOrtho` shifts
  the band to match. It computed that shift ONCE. Three wheel notches out
  and the model was 100% background colour; further still and it passed the
  far plane and clipped. `syncOrthoDepth()` now recomputes the shift, the
  near plane and the far plane from the CURRENT distance on every camera
  move while flat. The invariant it holds is the one the original comment
  claimed: the band sits the same distance ahead of the model as it does in
  perspective — measured at 9.0, 0.1 and 12.8 units ahead at three zoom
  levels, matching the perspective equivalent every time.
- **BLOCKER — double-tap focus flew ~27x too far.** `frameBox` read
  `camera.fov` to work out how far back to sit, but `animateCameraTo` leaves
  the flat view on the way out — so while flat it measured with the 2 degree
  lens and framed the object as a dot. It reads `orthoView.fov` when there
  is one. (The Scene-list double-tap had this bug already; a tap in the
  viewport used to disengage first, which hid it.)
- **The watch outlived its own gesture.** Nothing cleared it on engage or
  disengage, so a pan, then a programmatic camera flight, then a tap on the
  pill would read the flight as a turn and switch straight back out.

Covered by `_theme_probe` section 9: pan, zoom and a 0.3 degree wobble all
keep the flat view; a 6 degree turn and a flick's coast both leave it; the
fog band and far plane stay healthy across a 2.5x zoom out and back in;
focus frames identically flat or not; the pill toggles both ways and clears
the material flyout at phone width.

### The harness was lying about the right-hand side

Worth knowing before trusting a screenshot again. `_shots.py` asked for
`--window-size=375,812`; **headless Chrome on Windows will not give you a
375px window** — it clamps to about 500 — so the app laid out at **512 CSS
px** and the capture kept the leftmost 375 of it. Everything anchored to the
LEFT looked right, which is why it went unnoticed for several versions;
everything anchored to the RIGHT was outside the frame or cut in half by it.
That is why the view cube never appeared in a single screenshot: it was
drawing correctly, off the edge of the picture.

The shots now ask for a window Chrome will honour, force the APP to 375 with
an injected `html, body { right: auto; width: 375px }`, and crop the PNG
back down afterwards.

## The view cube is a cube (a2.60)

It is called a view cube in the help, in the code and in this file. Until
a2.60 it was three.js's `ViewHelper` — an axis tripod of coloured dots.
Replacing it with a hand-written cube fixes two separate things.

**The colours.** The library draws saturated red / green / blue, hard-coded
in its constructor with no option to change them. The drag guide uses coral
`#C85A47` / amber `#E8C87A` / dusty blue `#4A82B8`, and this file wrote down
why: saturated primaries read as a technical instrument next to a muted
palette, and red-versus-green is the pair that collapses for the commonest
colour blindness. So the app had **two palettes for the same three axes**,
and the one on permanent display was the one it had argued against. The
labels are coloured by axis now, matching `GIZMO_AXES` exactly.

**The shape.** A tripod says which way the axes point. It never says which
way is FRONT — the thing you actually want from a corner widget. Faces do,
and they double as tap targets.

It is deliberately small: one scene, one orthographic camera, six canvas
labels and an edge outline. `MeshBasicMaterial` with an sRGB texture on a
renderer with no tone mapping draws exactly the colours written down.

- **The cube never turns; the little camera orbits it**, on the same unit
  vector as the real one. That keeps the picture a pure function of the
  main camera's direction, which is what lets the render loop skip drawing
  it whenever the quaternion has not moved.
- **A tap uses the face NORMAL, not the material index** — the cube is
  axis-aligned and never rotated, so its local normals are the world axes,
  and a normal cannot fall out of step with a change to the material array.
- **A face tap does not aim exactly down its axis.** The two vertical faces
  are tilted `0.7°` off the pole, because a camera whose direction is
  parallel to its own up vector has no defined roll — `lookAt` spins, and
  OrbitControls clamps away from the pole regardless. Below a degree the
  tilt is invisible, and the orthographic snap that follows makes it read
  as a true plan view. The alternative is swinging `camera.up` mid-flight,
  which OrbitControls reads every frame.
- A miss returns false, so a tap on the empty part of the 128px box is not
  claimed. *Still open:* the box does not forward that miss to the model, so
  the corner is dead for anything but the cube. It always was — the cube now
  covers 34% of it against the tripod's handful of dots — but forwarding is
  the real fix and it is not written yet.

### What the review found (a2.60a)

The reviewer downloaded the actual r184 OrbitControls source rather than
working from memory, which is what turned up the first two:

- **BLOCKER — orbiting during a swing still ended in an ortho snap.** The
  swing rewrote `camera.position` every frame, so a drag started mid-swing
  read as dead; then `engageOrtho` fired anyway when the clock ran out and
  teleported to the long lens at whatever angle the drag had reached. Which
  is not an axis, which is the one thing the flat view is for.
  `viewCube.cancel()` now runs from the controls' own `start` event.
- **The damping coast landed on top of the swing.** `dampingFactor 0.11`
  keeps feeding rotation in for about a second after the finger leaves —
  roughly 95% of the remainder arrives over the next 25 frames. The swing
  derives every frame from the direction captured at tap time, so that
  leftover pushed the *final* frame off-axis and `engageOrtho` locked it in:
  a plan view that was quietly not a plan view. One `orbit.update()` with
  damping switched off spends the whole remainder at once and zeroes it,
  which is public API doing exactly what "stop the coast" means.
- **A focus flight now outranks a swing.** It used to be the other way
  round: the swing nulled `camAnim` from under the flight, which stranded
  `orbit.target` half way through its lerp and silently threw away a focus
  the user had just double-tapped for.
- The cube grew — ortho half-height 1.35 to 1.15 — taking it from 24% to
  34% of its box, which is both a bigger target and less dead corner.

`_theme_probe` section 8 covers it, including the one assertion that matters
most: it renders the cube into its own renderer and **reads the pixels
back** (34% of a 128x128 canvas drawn on, 26 distinct tones). Everything
else in that section could pass on a widget that paints nothing.

*Harness note:* the view cube does not appear in `_shots.py` screenshots and
that is the harness, not the app — its canvas is a second WebGL context and
headless SwiftShader will not provide one. Drawing its scene through the
main renderer instead was tried and also came back blank. The pixel readback
is the check.

## The selection follows the mode (a2.59)

**a2.58 stopped at the chrome on purpose. In use, that was the wrong
place to stop.** The whole screen said "you are editing edges" and the edge
you had picked said something else — two systems that did not agree.
Zeghreit, after looking at it: *"how about making selection color match
component color? now chrome changing its color but selection is still red on
all components."*

```js
const MODE_SELECT = { vertex: 0xFFC24D, edge: 0x4FB0FF, face: 0xFF6A4D };
```

Gold, sky, salmon — the same three hues as the chrome, **pushed brighter and
more saturated**, because they have to sit on a lit grey surface rather than
on a dark panel. The chrome values are tuned for `#181b21` and would sink
into the model. Object mode keeps `THEME.select`: there are no components to
select there, and the frame is what marks a chosen object.

**This does not repeal v1.91.** That decision was *the selection must not
wear a colour that reads as something else on the model* — it was written
after an accent-coloured selection disappeared against a blue-grey cube.
These three are still colours nothing else in the viewport wears: all three
are brighter and more saturated than the axis guides (X `#C85A47`, Y
`#E8C87A`, Z `#4A82B8`), and the crease and sharp marks are orange, not
gold. What changed is that "the one selection colour" became "the one
selection colour *per mode*" — and the mode is now unmistakable, so the
colour is still unambiguous.

`applyModeSelectColor()` runs from the same hook as Mode Hue — the one place
in `refreshUI` that notices the mode changed. It early-returns when the
colour has not actually moved, and repaints the two kinds of consumer:

- **Materials that bake the colour** — `selPoints`, `selLines`,
  `faceOverlay`. They read `SELECT_COLOR` when they are built, not per
  frame.
- **The per-vertex colour arrays**, via `refreshElementColors` on **every
  object, not just the active one**. An object that stops being active
  keeps the buffer it was last painted with, and neither re-target path (the
  Scene chip, `handleTap`) repaints. Before a2.59 that stale buffer always
  held the one red and read as a phantom selection; painting only the active
  object would have made it a phantom in the *wrong hue*, contradicting the
  chrome.

The colour is applied BEFORE the `data-mode` attribute, because the
attribute is the gate: a throw inside the repaint would otherwise leave the
gate satisfied and the colour stuck on the previous mode for the session.

### The crash this uncovered (a2.59a)

Sweeping every object made a latent hole reachable. `refreshElementColors`
had no `topo` guard — every real path builds and drops `topo`,
`vertexPoints` and `edgeLines` together, so a mesh with dots but no
topology was impossible. **a2.57 changed that premise**: "no helpers at
all" became the normal state for anything you are not editing. The first
sweep to meet such a mesh threw `Cannot read properties of null (reading
'logicalCount')` and took the whole refresh with it — and `applyTheme` has
been sweeping every object the same way since long before a2.59, so this
was a live trap, not a new one.

`if (!topo) return;` at the top of `refreshElementColors`. **Fifth entry in
the same ledger**: a change that removes work removes a premise something
else was quietly standing on. Here the removed work was a2.57's "give every
object helpers", and the premise was "an object with dots has topology".

Caught by `_lock_probe`, which nulls `topo` deliberately to prove framing
does not rebuild it — an artificial state that turned out to be the exact
shape of a real one.

Covered by `_theme_probe` section 7: the three overlay colours, that they
are distinct, and the stale-buffer case.

## Mode Hue — the accent IS the mode (a2.58)

**One accent at a time, and which accent tells you what you are editing.**
The chrome takes the colour of the current mode, so the mode is readable
from any corner of the screen without hunting for a label.

| mode | accent | dim tint |
|---|---|---|
| Object | `#a8afbd` neutral | `#363c48` |
| Vertex | `#DDB863` gold | `#4d422a` |
| Edge | `#6EA6D8` sky | `#2f4a63` |
| Face | `#E8836C` salmon | `#573429` |

**How it is done matters more than the colours.** `--accent` ITSELF is the
mode colour — redefined in four `:root[data-mode=…]` blocks — so all forty
`var(--accent)` sites follow with no rule changes at all. The whole
mechanism is one line in `refreshUI`:

```js
if (document.documentElement.dataset.mode !== App.mode) {
  document.documentElement.dataset.mode = App.mode;
}
```

Hooked there for the same reason isolation is: every path that can change
the mode ends by refreshing the UI. Written only when it differs, because
touching an attribute on the root invalidates style for the whole document.

**The one new piece of chrome** is `#modeBar`, a 3px rule along the top edge
in the mode's colour. Absent in Object mode rather than grey — a permanent
stripe would be the top bar coming back, and a2.48 deleted that for costing
7.2% of the screen.

**IT STOPPED AT THE CHROME — until a2.59 moved the line.** Read the
section above for where it ended up; the reasoning below is why the split
was drawn here first, and it still governs everything except the selection
highlight. The decision was Zeghreit's: the canvas proposed giving the selection highlight the mode
colour too, so hairline, mode button and highlight would all agree. The
viewport already has two vocabularies that were decided on the record —
**red means selected** (v1.91: an accent-coloured selection disappeared
against the model) and **coral/amber/blue mean X/Y/Z** during a drag — and
a coral face highlight in a scene where coral already means X is one
meaning too many. So: colour in the CHROME says which mode; colour in the
MODEL says selected, or which axis. No pixel carries both.

That separation is why the chrome hues are TUNED members of the axis family
rather than the axis values themselves. It is also a measured requirement,
not a preference: the axis coral reads 4.1:1 on the panel, which is not a
colour you can put text in.

Nothing in JS reads a CSS custom property — scene colour is JS hex — so the
"stops at the chrome" rule holds by construction, and `_theme_probe`
asserts it by comparing helper vertex colours across all four modes.

### What the review caught (a2.58a)

- **A grey bar on every cold load.** `#modeBar` defaulted to `opacity: 1`
  and was hidden by `:root[data-mode="object"]`, but the attribute is
  written by `refreshUI` — inside the module that waits on the three.js
  CDN. Every cold start painted the rule and then *animated* it away. Now
  hidden by default, `data-mode="object"` sits on `<html>` in the markup,
  and the show rule lists the three component modes **positively**: the
  obvious `:not([data-mode="object"])` is TRUE when the attribute is
  missing and re-created the exact flash it was meant to remove. The probe
  caught that; the reasoning did not.
- **The accent must not simply BE `--text-dim`.** Object's neutral started
  at `#8d94a3`, byte-identical to the dim text colour, so every "this one
  is chosen" cue that works by colour — the applied material's label, the
  light preset, the symmetry half — said exactly what "not chosen" said.
  `#a8afbd` is a step above it.
- **A tint has to look like a tint.** Object's `--accent-dim` at `#23262d`
  measured **1.04:1** against the panel it sits on: `#lightMenu
  button.active` had no visible state left but its font weight, and
  `.hub-item.on` got *dimmer* when switched on. All four dims are now
  1.4–1.7:1. Where such a chip carries TEXT the label moved to `--text`,
  because accent-on-dim is 3.6:1 in Edge mode — fine for a 20px icon, not
  for 13px of type.
- **The delete seat needed more than hue.** `--danger #ff5d5d` beside the
  face accent `#E8836C` is one warm red next to another, on a 1px stroke,
  in peripheral vision, during a hold. It has a dark red FILL now — a disc
  no other seat wears in any mode.

*Known and accepted:* the box-select rectangle, the lasso, the ring itself
and the op/pivot/geo bars all float over the model wearing the mode colour.
They are chrome, not model, and they never co-occur with the axis guides —
those only exist mid-transform, when no ring is open.

## One theme (a2.57a)

**Daylight is gone.** There were two complete looks — Daylight (warm, light,
the CSS `:root` default) and Workshop (dark, applied through
`html[data-theme="dark"]`). The visual review measured Daylight's secondary
text at **2.9:1** against Workshop's 6.2, and the problem was not one token:
warm text on warm panels on a warm viewport has nowhere to go. Zeghreit's
call was to **retire it rather than patch it** — one theme done properly
beats two half-tuned, and every colour decision after this (the mode hues,
the destructive floor) only has to be right once.

What that means in the file:

- `:root` now holds the Workshop values directly. The `html[data-theme]`
  block, the attribute on `<html>`, `App.theme` and the drawer's Theme
  button are all gone. There is no `prefers-color-scheme` branch and never
  was.
- `THEMES = { light, dark }` is now a single `THEME`, and `applyTheme()`
  takes no argument. **It is still a function and still worth having**: it
  is the one place that states what the theme means for the SCENE as well as
  the chrome — background, fog, exposure, the three lights, the grid, the
  selection colours, every helper's vertex colours — and `applyEnvRig`
  layers the lighting preset on top of the baseline it sets.
- A save file from an older build that carries `theme: "light"` still loads;
  `restoreDoc` never read the field.
- The three scene lights are constructed with the theme's own numbers rather
  than Daylight's, so a first frame drawn before `init()` looks like the app
  instead of like a bug. `applyTheme` overwrites all three anyway.

**Two riders, both from the same review.**

- **The help glyph was 3.6:1.** `#btnHelp` wore `--text-dim`, which is a
  control you cannot read, not a control that is politely out of the way. It
  is `--text` now — measured **13:1** — and stays quiet by WEIGHT instead:
  panel-coloured, hairline border, no accent fill.
- **The floor of the ring is destructive, and now looks it.** Delete owns
  seat 7, straight down, nearest the thumb, and wore exactly the border
  every constructive tool wears — eleven identical circles, one of which
  throws work away. `--danger` had been in the tokens since the beginning
  with nothing using it. `.hub-item.danger` gives it a coral border and
  glyph (5.2:1), and `.hub-item.danger.active` fills red when it is under
  your finger, beating `.hub-item.active` on specificity. Marked by key, so
  the four rings carrying Delete cannot disagree.

Covered by `_theme_probe` (13 assertions), which MEASURES rather than
asserts intent: computed colours off the live DOM, contrast ratios computed
from them, and the ring bloomed to check exactly one seat is marked.

*Still open from that review:* the op bar's amount is an
`<input type="number">` and shows the browser's decimal separator, while
every other readout is a span formatted with `toFixed` and shows a point.
Left alone — the fix is either fifteen call sites or a locale guess, and it
needs deciding, not typing.

## The frame marks what a tap can reach (a2.57)

**Two complaints, one idea.** Zeghreit: *"when i select any object —
unselected is getting dull highlighted wireframe too — it is confusing, and
when i switch to component mode i can by accident select something from
other object."* Both come from the same lie: the app was drawing and
accepting more than it meant.

**The frame.** `updateFrameVisibility` used to light EVERY object's
wireframe — the active one at `FRAME_ACTIVE 2.0`, everything else dimmed at
`FRAME_DIM 0.8` — whenever anything at all was selected, as an "editing is
active" cue. Read back, a dim frame says *this is in play*, which in a
component mode is the opposite of true: the pickers only ever look at the
active object. `FRAME_DIM` is gone. What is framed now is the selected
objects in Object mode, and **in a component mode the active one alone.**

**The lock.** In a component mode, a tap that hits no element used to fall
through to `pickObjectAt` and re-target the whole session — mode, selection
and anchors — onto whatever was under the finger. Every fumbled vertex tap
near a neighbour silently moved you to a different model. It now refuses,
with a toast naming the object you are on. The exception is having no
object to be locked TO (after a delete, or on a fresh scene): then a tap
adopts one, which is how you get in at all.

**A lock needs a door, and the toast has to be telling the truth.** The
refusal says *switch objects in Object mode*, and Object mode does not write
`App.activeObjectId` — `selectObjectClick` only touches `selectedObjectIds`,
and `setMode` used to re-target only when the lock was EMPTY. So the
advertised way out did nothing. `setMode` now drops the lock when the held
object is not among the selected ones, and hands it to the selection:
**what you have selected in Object mode is what you edit.** An empty
selection changes nothing — that is the "carry on where you were" case. The
same rule fixed Duplicate, which leaves the selection on the copies and the
lock on the original, and it is why the Scene-list chip now writes
`selectedObjectIds` as well as `activeObjectId` — a chip that moved only the
lock would be silently undone by the next trip out to Object mode and back.

**And the thing the removed work was secretly doing.** Framing every object
also gave every object `ensureHelpers`, and `snapTargetAt` quietly depended
on it: no `userData.topo` means no corners and no edges, so the snap falls
back to *wherever the ray met the surface*. A snap target is by definition
not the thing you are dragging, so it is exactly the object that is no
longer framed — geometry snapping would have degraded to face-only, with no
message at all. `snapTargetAt` now calls `ensureHelpers` on the object it
is refining against. **Fourth time in this series** that an optimisation
removing work removed something undocumented the work was doing (bounding
spheres, shader-program cache entries, vertex welding, and now topology for
snap targets). Assume it every time.

Costs and limits, recorded:

- Framing no longer builds topology for the whole scene on the first tap,
  which is the real win here: one model's topology instead of N.
- `ensureHelpers` inside the snap loop means the first pointermove over a
  heavy neighbour builds its topology synchronously — a one-frame hitch,
  once per object per session. Accepted.
- Detach leaves the lock on the SOURCE, so the new piece is not tappable
  until you go out to Object mode and pick it. Correct as a default — you
  detached a part off the thing you are working on — and the door works.
- Grow-then-Shrink in Object mode leaves the selection on an arbitrary
  member, so entering a component mode re-targets there. Pre-existing
  arbitrariness in `shrinkSelection`, now visible. Not fixed.

Covered by `_lock_probe` (22 assertions), which fails loudly on a2.56:
`1.framed` lists both objects, `4.active_held=JUMPED TO`, `8.door=LOCK
STUCK ON`, `9.snap_kind=face`.

## The help card, rewritten (a2.56)

**A help card is code, and it rots like code.** An audit against this file and
the ring tables found SIX rows that were not thin but WRONG, and the worst of
them had been sending beginners to the wrong corner of the screen since
v1.99d: the Symmetry pill moved to the top left and the card still pointed
under the view cube — in its own section AND in the Quick start, which is the
one section that is open when the card opens.

The others: the snap chip is top CENTRE, not top right (and it also carries a
Pivot marker nobody had documented); Shade left the Edge ring at a2.7f and
**Mark Sharp**, which replaced it, had no row at all; free scale in object mode
reads the object's own axes since a2.55; the drawer's Appearance section was
a Theme button and nothing else, and since a2.57a is two notes and no button
at all; and the Mirror ACTION row drew the Symmetry pill's icon rather than
`mirroraction`.

**The biggest gap was a whole gesture.** Two fingers held still anchor the
light and the other hand aims it — one finger turns, two change strength. The
drawer's own note calls that "the part you cannot discover by looking", and
the card it sends you to said nothing about it.

### The shape follows the app now

`Shaping` had grown to 19 rows meaning three different things; `Move, rotate,
scale` had absorbed Snap, Isolate and Soft; and the multi-finger gestures were
scattered across three sections with the three-finger slide written up twice,
differently. Fourteen sections now, plainly named, because the closed list IS
the table of contents and a stranger has to guess right from it:

Quick start · Camera and view · **Gestures** · Tool rings · Selecting · Move,
rotate, scale · Edge and face tools · **Marks and cleanup** · Object tools ·
Materials · Symmetry and Mirror · The drawer · Saving and exporting · **At a
desk**.

`Gestures` is the single index of everything done without a button. `At a desk`
is the keyboard set — which existed in full and had never been written down —
and it absorbs the QR, which had been a section on its own arguing that a desk
exists while the card refused to talk to one.

### And the rewrite injected six of its own

Which is the lesson of a2.43 and a2.45 arriving in prose: **writing a card has
the same defect rate as fixing one.** Review caught all six.

- **The empty-scene ring cannot be reached.** `HUB_TOOLS_EMPTY` is only
  `bloomToolRing`'s default, and the one call site that omits `tools` requires
  `pointerOnSelection`, which is false whenever nothing is selected. A hold on
  an empty scene always gives the world ring. The row went; the dead table is
  on the list below.
- **The light gesture is not "on the model".** `lightHoldCandidate` does no
  raycast at all — two fingers still, anywhere. The Gestures row was right, the
  drawer row was wrong, and so was the live drawer note, which is fixed here.
- **`N` cycles off / grid / geometry**, and the card said "on or off" two
  sections after saying it cycles three ways.
- **The world ring has eight entries**, and the one the rewrite dropped was
  Tap select — the only way back once box or lasso is armed.
- **The `+` does not carry masks** into the material it forks.
- **Soft is the mode button's third POSITION, which is the second press** from
  Object mode. As an instruction the row sent you one tap too far.

Measured on a 430x860 phone: closed, the whole table of contents is 626px
against a 608px card — one small flick, with two more headings than before.
No heading wraps, nothing overflows sideways, and no row runs past three lines
(six did in the first draft, one to 125px; the card's own note says a row that
needs a paragraph is saying too much). `_uimeasure.py` confirms every screen
position the card now claims.

### Two things the fact-check turned up that are not about the card

- **`HUB_TOOLS_EMPTY` is dead code** — unreachable, and the a2.43 audit found
  this file almost free of it. Either wire it up or remove it.
- **Forking a material with the `+` drops its masks.** It copies colour,
  roughness, metalness, envMapIntensity and bevel only. Documented as it
  stands, but it reads as a bug.

## An axis scale runs along the object's own axis (a2.55)

**The bug was arithmetic, not taste.** `GIZMO_AXES` are WORLD axes. A
world-axis scale multiplied onto a rotated object's matrix produces
non-orthogonal columns — a shear — and `Object3D` holds position, quaternion
and scale, so `Matrix4.decompose` has nowhere to put it and invents a rotation
instead. Measured, on a cube turned 45° about Y and scaled along world X by 2:
decompose returns scale **(1.5811, 1, 1.5811)** — it grew on BOTH X and Z —
plus a twist. On a real drag that reads as 5.12° of unasked-for rotation.

`scaleAlongDir(d, f)` is `I + (f-1)·d⊗d`: a scale of f along one direction,
symmetric, so there is no rotation hidden in it. When `d` is a column of the
object's own rotation it multiplies exactly one component of that object's
scale and touches nothing else — the same matrix gives (2, 1, 1) and no twist.

`transformAxes()` decides what a gesture is measured against: world axes,
except an object-mode scale, which takes the three normalised columns of the
FIRST selected object's captured matrix. That set is used by the axis
resolver, by the free-scale screen matcher and by the guide, so **what you aim
at is what you get** — on a 45° cube the guide now lies along the object's own
edge rather than along the world axis.

Every selected object then scales along **its own** axis of that name: the
factor under the thumb is the selection's, the direction is each object's, so
two models at different angles both stretch along their own length. That needs
one delta per object, so `applyDeltaToSelection` accepts a FUNCTION of the
entry as well as a single matrix (objects only — it says so loudly on an
element drag, where an entry is a vertex and has no axes).

**Elements are deliberately untouched.** A vertex drag moves points, and a
point takes any linear map without complaint, so a world-axis component scale
there is exact. It is also what you want: scaling a face loop along world X is
a real operation, not a bug.

### What review found, and it was the seams again

- **The axis is frozen for the drag; the TOOL is not.** Pressing `s` during a
  live Move drag handed the scale branch a world axis with no `local` tag —
  straight back into the shear, measured at 7.64° of twist. The scale branch
  now names the object's own column itself, from the axis KEY, whoever handed
  it over.
- **A degenerate reference column poisoned the whole gesture.** An object
  scaled flat on the named axis has no direction to offer, and returning the
  untagged world axis for it sent EVERY object in the selection down the world
  path — one flattened plate sheared every healthy rotated object beside it.
  The fallback is tagged now, leaving the per-entry delta (whose own fallback
  is right) in charge.
- **`App.activeObjectId` is never written by object-mode selection** — it is
  set by element-mode taps and by ops like join and mirror — so preferring it
  made which object named the axes depend on history nothing on screen shows.
  The first entry, which is click order.

**Stated rule, not an oversight:** an object flat on an axis takes no scale on
that axis, so it cannot be pulled back out along it.

Verified: `_verify.py` PASS; `_axis_probe.py` (21 assertions, new) green and
loudly RED against a2.54; all 18 existing suites byte-identical to a2.51c;
`_shade_probe.py` unchanged.

## One face overlay, not one per face group (a2.54)

`ensureHelpers` built a `Mesh`, a `BufferGeometry` and a
`MeshBasicMaterial` **per face group**, added every one of them to the mesh,
and left them there for the rest of the session with `visible = false`. Only
the selected ones were ever drawn - but `updateMatrixWorld` recurses into
children whether they are visible or not, so a 128-group sphere carried 130
helper children to be walked on every frame, and a thousand-face model carried
a thousand. It carries **two** now.

`syncFaceOverlay` builds ONE mesh on demand and re-indexes it - the selected
groups' triangles, concatenated - only when that set of groups changes. It
borrows the mesh's live position attribute exactly as the old ones did, so it
follows a drag with nothing running per frame.

**The active-object guard is the correctness part.** `App.selectedElements` is
global, and `updateFrameVisibility` gives every object a topo as soon as
anything is selected - so an overlay drawn for any object but the active one
paints ITS face number 2 because face 2 of something else is selected.
`applyTheme` calls `refreshElementColors` on every object, so switching theme
in Face mode tinted a face on every model in the scene, and it stayed tinted
until a mode or object switch. The per-group version read the same global and
had the same bug; a2.54 would additionally have ALLOCATED on the wrong object,
so `syncFaceOverlay` now returns early unless `obj.id === App.activeObjectId`.

`frustumCulled = false`, for the reason a2.53 gives: a geometry that borrows a
position attribute a drag rewrites keeps the bounding sphere it was built
with, and three recomputes only a null one.

**And a landmine, now written down at `disposeHelpersOnly`:** the overlay
geometry does not own its position attribute, and three's `onGeometryDispose`
removes every attribute of the geometry handed to it with no reference
counting - so disposing the overlay deletes the GL buffer the MODEL is drawn
from. Both callers throw the main geometry away in the same breath, which is
the only reason it is harmless. A future "drop the helpers, keep the mesh"
would freeze the model on screen.

Verified: `_verify.py` PASS; `_shade_probe.py` (44 assertions) green; all 18
existing suites byte-identical to a2.51c.

## The selection overlay is nudged, not rebuilt (a2.53)

`syncSelectionOverlay` threw its GPU objects away and built new ones on every
pointermove: a `BufferGeometry` and a `PointsMaterial` in Vertex mode, a
`LineSegmentsGeometry`, a `LineMaterial` and a `LineSegments2` in Edge mode, a
remove and an add on the scene graph, and a splice and a push through
`gizmoStrokes` - to produce objects naming exactly the components it had just
disposed. A drag cannot change WHAT is selected.

`refreshSelectionOverlayPositions` writes the positions into the buffers that
already exist, which is the move `refreshSoftOverlayPositions` made for the
falloff at a2.40. `selOverlayFits` is the gate: same mode, same selection SIZE
as when the overlay was built, and every id it drew still selected. Anything
else falls back to the full rebuild, which `refreshElementColors` still calls
outright. Measured: **0 rebuilds across a six-frame drag**, in Vertex and Edge
mode both, and the stroke list does not grow.

**And the removed work was doing something nobody had written down.** This is
the same shape as a2.45's clone-blanking and it is worth naming again.
Rebuilding gave every frame a brand-new geometry whose `boundingSphere` was
null - and three only computes one that IS null, so a fresh geometry got a
correct sphere for free, every frame, as a side effect of the churn. Retain the
geometry and that sphere freezes at where the selection was BEFORE the drag.
`THREE.Points` is frustum-culled by default, so **one** selected vertex has a
radius-0 sphere at its old corner: drag it into a spike, orbit until the old
corner leaves the frame, and the dot vanishes while the drawer still says the
vertex is selected. `frustumCulled = false` on the layer, which is what
`knifeDots` and `knifeLine` already do for the same reason - an overlay the
size of the selection has nothing to gain from being culled. **The falloff
overlay has had the identical hole since a2.40** and is fixed with it.

The other thing review caught was a latch: comparing the DRAWN list against
the live selection meant that any element the topology could not place came up
short on every frame and turned the rebuild back on permanently - the whole win
handed back, silently, on exactly the model already in trouble. The count
recorded at build time is what is compared now.

Verified: `_verify.py` PASS; `_shade_probe.py` (34 assertions) green; all 18
existing suites byte-identical to a2.51c.

*Known, pre-existing, not touched here:* `applyTheme` calls
`refreshElementColors` on every object, and in a component mode that paints the
ACTIVE object's selection ids against every inactive object's topology.

## applyShading splits in two (a2.52)

**A drag moves vertices; it cannot change topology.** So `buildShadingTopo`
now builds everything derived from the INDEX - the logical-vertex grouping,
triangle-to-face-group, the winding-agreement components and their relative
signs, and the edge records - and `shadingTopoFor` caches that on
`geo.userData.shadeTopo` for the length of ONE direct drag. Measured: six drag
frames, six shading passes, **one** topology build.

What still runs every frame is what genuinely depends on where the vertices
are: `computeVertexNormals`, the triangle and face normals, the per-component
signed-volume test (on a COPY of the cached relative signs, so a shell that a
drag turns inside out is still caught), the sharp/wear classification, the
per-vertex island averaging, and the wear-edge list.

**The cache is keyed on the GESTURE, not on the geometry alone**: a live
`directDrag`, the same `dragCtx` object, the same index object, index count,
group count and position count. An op installs a new geometry and so has no
cache at all. Outside a drag nothing is stored - which matters, because
`computeLogicalOf` welds attribute vertices by ROUNDED POSITION, so a live
cache holds the welding still.

**Which is the whole of what review found, and it was real.** The cached pass
was also the LAST pass: nothing re-shaded when a drag ended, so dragging one
corner exactly onto another - what snapping is for - left the two unwelded for
ever, with a phantom rim edge that the Edges and Cavity masks paint straight
through the join. Before a2.52 the next frame fixed it. Every site that ends a
direct drag now calls `settleShadingAfterDrag`, which drops the cache and
shades once more without it, so the committed result is the full pass it
always was. `_shade_probe.py` case 8 is that exact drag, and it fails loudly
against the unfixed version: 4 wear edges where there should be 2.

Two consequences worth knowing. **There is a visible weld at finger-up** on
any drag that brings two vertices within tolerance - pre-a2.52 behaviour,
moved from mid-drag to lift. And **a mask can lag by one gesture** on the
second-finger path, where `ensureEdgeField` refuses to re-bake while fingers
are down; it corrects on lift.

Pull-to-extrude gets nothing from this: `extrudeDrag` is deliberately separate
from `directDrag`, and each extrude frame rebuilds the geometry anyway.

Verified: `_verify.py` PASS; `_shade_probe.py` (19 assertions) green, including
byte-identical normals and wear-edge arrays between the cached and the forced
full pass on a cube, a sphere and a marked-sharp sphere; and all 18 existing
suites re-run against a2.51c and a2.52 in turn produce **byte-identical
output**.

## Grow and Shrink become a gesture (a2.51)

Two ring items, six seats across three rings, gone. **In a component mode with
Soft OFF, three fingers sliding right grows the selection a ring at a time and
left shrinks it.** Zeghreit's read: the pair was always going to be tapped
repeatedly - "grow, grow, grow, too far, shrink" - and that is what a slide is
for. Soft mode's own three-finger slide already sizes the falloff, which is the
same question asked of a continuous field, so the two never collide: Soft on
means radius, Soft off means selection. Seats 12 and 13 are now free in all
three component rings.

`growSelection` / `shrinkSelection` stay - `]` and `[` still call them - split
into pure steps `grownElements(obj)` / `shrunkElements(obj)` plus thin command
wrappers, so the gesture and the keyboard run the same code.

**Every level is computed from a SNAPSHOT taken when the slide engaged**, not
from the level before it in the hand's history. Shrink is not the inverse of
Grow - grow spills onto a border, shrink eats one back from wherever the border
now is - so a ratchet would have made sliding back a different journey from
sliding out, with no way to return to what you picked. Levels are cached in two
chains (`softSlide.up`, `softSlide.down`) with saturation latches, so a steady
slide costs one step per step rather than one per frame, and level 0 hands back
the original Set object's contents exactly.

ONE state object for both slides, deliberately: `softSlide` gained
`kind: 'radius' | 'select'`. The slide has five teardown and re-baseline sites
(lift, cancel, a finger arriving mid-slide, the light hold taking over, the
window backstop) and a parallel copy would have had to be added to every one.

### What the two review rounds found, and it is the usual lesson

The feature itself reviewed clean on the parts that were new. **Every defect
was in the seams**, and then **five more were in the fixes**:

- **`softSlideTravel` is `hypot(dx, dy)`.** A three-finger VERTICAL pan - an
  ordinary camera gesture - crossed the engage threshold, took orbit away
  mid-pan and put a HUD on screen reading "Selection 0". Soft mode had always
  been like this and its users know it; the selection slide is reachable in the
  app's default editing state, so it now asks for sideways intent
  (`slideIsHorizontal`). **The first fix took the per-axis maximum over
  DIFFERENT fingers**, so an arced swipe - index finger 100px right while the
  little finger curls 80px down - compared those two against each other and
  refused the gesture. Judged per finger now, satisfied by the most committed
  one, which is the rule `softSlideTravel` already used.
- **`Math.round(dx / 64)` flips at 32px**, so the first step was half a step
  and, worse, jitter held at a boundary flipped the level every frame - each
  flip rebuilding the selection, the whole object list and a haptic tick.
  Replaced with a deadband: a boundary is crossed 0.7 of a step past it, so the
  same spot holds whichever level you came from.
- **The state the slide was allowed under can change under it.** The mode
  button and the keys 1/2/3 are outside the canvas and tear nothing down; a
  vertex-indexed snapshot re-run through the face branch indexes past
  `faceGroups` and throws. `selSlideStale()` is now the single authority, read
  by both the per-frame guard and the re-baseline.
- **The first version of that guard ended the slide when the selection went
  empty**, because it re-used the engage-time predicate - which requires
  something to grow FROM. Shrinking to nothing therefore tore the gesture down
  at exactly the moment you would want to slide back out, and stranded the user
  with an empty selection and no undo, since a selection is not history.
  `selSlideAllowed(running)` skips the emptiness test for a slide already
  holding a snapshot.
- **Ending the slide from inside the guard left `pointerDown` live**, so the
  first finger to lift fell through to the ordinary tap path and selected
  whatever was under it. Every other teardown site cleared it by hand;
  `endSoftSlide` clears it now, which also fixed the window backstop.
- **The level was committed before the step that computes it**, and it went on
  counting past saturation - so overshooting the bottom by nine cost nine dead
  steps of travel, buzzing once per step to say a ring had changed when none
  had. The level is now clamped to the depth the chain actually reaches.
- The window backstop deleted its pointer raw instead of through
  `trackPointerUp`, leaving `tapPeakCount` at three so the next two-finger tap
  was swallowed.

`_sel_probe.py` (42 assertions) covers all of it, including the two that only a
harness can hold still: the deadband holding one spot at two different levels
depending on which side it was approached from, and a slide the guard killed not
leaving a tap behind.

## The fillet preview is gone (a2.50)

Removed whole rather than hidden behind a flag. Leaving ~170 lines that
nothing can reach would have been exactly the dead code the a2.43 audit found
this file to be almost free of, and it would rot before it was ever rebuilt.
Git has it, tagged `a2.50-fillet`.

The cost it was paying for a feature nobody used: a second `THREE.Mesh` per
object with cloned materials, rebuilt on **every** `pushHistory` (that is,
after every committed edit); a branch in `buildExportGroup` deciding whether
to export what you see or what you have; and a `material.visible = false`
convention that no other part of the app used and that quietly outlived the
feature until review caught it. `findSharpEdges` came out with it - the
preview was its only caller. The separate sharp/crease machinery that drives
SHADING (`markSharpSelection`, `creaseSelection`, `applyShading`) is
untouched and must stay that way.

Nothing in the save format ever carried a fillet field, so a2.49 project files
open unchanged.

Verified after removal: `_verify.py` PASS, and the full probe suite re-run
(ops 44, bug 24, circ 23, perf, geo x2, prim, piv, flow, snap, iso x2, soft
x3, tw, sviz) with no new failures and no new console errors. `_uimeasure.py`
still reports zero overlaps in every state, zero tap targets under 44px, and
chrome at 13.2% of a phone screen with the drawer open.

## The chrome pass (a2.47 / a2.48 / a2.49)

### a2.49 — the drawer stops apologising

Five of its rows were notes explaining that the control you are looking for is
somewhere else, and **"Appearance" was one button followed by three paragraphs
of that**. The placements they describe are all deliberate and all documented
in the Help card, so from the drawer they only have to POINT — one line each,
not a paragraph. Eleven lines of note text became four. "Snap step" became
"Snap amounts", because the old name read as a verb when it is a set of values
you set once.

The lighting note kept its gesture ("hold two fingers on the model and slide to
aim it") because that is the part you cannot discover by looking.



Measured at phone size before anything was touched, because "measure, don't
reason" is the rule that has never failed here — and because with no
screenshot available, numbers were the only evidence. `_uimeasure.js` reports
every visible control's rect per state, what fraction of the screen is chrome,
which targets are under 44px, and **whether any two pieces of chrome overlap**.
That last check is what makes moving things around safe without eyes.

|  | before | after |
|---|---|---|
| chrome, idle | 19.3% | **13.0%** |
| chrome, op bar open | 33.0% | **27.3%** |
| persistent elements | 14 | **12** |
| tap targets under 44px | 9 | **0** |

### a2.47 — every tap target reaches 44px

The app's own principle says "touch targets large enough for fingers", and
nine controls were not. The worst were on the op bar, the surface you hold a
thumb on for the whole length of an operation: the slider was **28px tall**,
OK and Cancel 36, the grouping chips 36. Also the materials tab at **30px
wide**, on the screen edge where a thumb is least accurate.

Two things worth keeping:

- The slider's box grew to 44 while the **track stayed 4px and the thumb 24**.
  What was too small was the invisible area your thumb has to land in, not the
  drawing.
- The symmetry pill's **two halves stay two**. Its comment says "tap the half
  you want or swipe toward it — both work without looking, which a button that
  cycles never did", so merging it into one switch is a thing this project
  already tried and rejected. They just got big enough to hit — and the pill
  went to 46 tall, not 44, because the halves live inside its 1px border and a
  44px pill gives 42px halves.

Numbers that look arbitrary are derived, and moved with their inputs: the
materials tab's two margins are `(tray − tab) / 2`, centring it over the tray;
the symmetry knob's width and travel are `(pill − 6) / 2`.

### a2.48 — the top bar is retired

It cost **7.2% of a phone screen** to hold a hamburger, the word "Kubik", and a
status readout. In an app whose first principle is that the viewport is the
hero, a permanent bar for the app's own name is the most expensive thing on
screen per unit of use.

The button floats over the viewport like every other control already does. The
name and the status moved into the drawer — where the version is the thing you
would deliberately go looking for, and where the status sits directly above the
object list it summarises.

**The interesting part is the safe-area inset.** `#topBar` absorbed
`env(safe-area-inset-top)` in its own padding, and `#viewport` simply started
below the bar — so every top-anchored control could use a plain `14px` and be
clear of the notch. With the bar gone the viewport starts at the top of the
screen. Rather than add the inset to a dozen rules (and risk applying it twice,
a mistake this file has already recorded twice), **`--edge` carries it**:
`calc(14px + env(safe-area-inset-top))`. Every control already used that
variable, so none of them needed changing and none of them can double it.

### What the review caught, and why none of it was visible

**Four of the five defects only appear on a notched phone**, because on a
desktop the inset is 0 and every one of them computes to exactly what it always
was. They were found by reading the CSS for "which of these is a TOP offset
measured from a viewport that has moved", not by looking at anything.

- **`#inspector` at a bare `top: 78px`** landed on the notch and, at z-index 16,
  covered the floating menu button completely — the only way out of the
  inspector was its own ✕. Now `calc(var(--edge) + 64px)`, which computes to
  the same 78 on a desktop.
- **`#matFly` kept `top: 108px`** while the view cube took the inset, so the two
  drifted apart by exactly the notch and the newly 44-wide tab ended up *inside*
  the cube's square — at z-index 25 against the cube's 12, so tapping the cube's
  side faces opened the material tray. Moved to 132 + inset, which clears the
  cube outright rather than nicking its corner.
- **Every toast was invisible for a whole isolation session.** The isolate chip
  is persistent, opaque, and sits two pixels below where the toast lives.
- **The geo bar missed a2.47's raise on specificity**: `#geoBar button` (1,0,1)
  out-specifies `.stepper button` (0,1,1), so its ± steppers took the new
  *width* and not the new height — 44×36, beside an identical-looking 44×44
  stepper in the op bar.
- The drawer head had no top inset, which predates all this but started
  mattering when the version string moved into it.

Two dead CSS rules went with the bar: `.spacer`, whose only user it was, and
`.sep`, which the a2.43 dead-code audit had already flagged.

## On-demand rendering (a2.46 / a2.46a)

The loop was an unconditional rAF: a phone on a desk with the app open
rendered the whole scene — **plus a second WebGL context** for the view cube,
which on a tile-based mobile GPU costs a context switch and a framebuffer
flush of its own — sixty times a second, for ever. Nothing about WHAT is drawn
changed; only how often.

**Three layers, because "the screen did not update" is a far worse outcome
than the battery this saves.**

1. **`invalidate()`** marks the coming frames dirty. It is wired to orbit's
   own `change` event — which covers damping, since damping fires `change` on
   every settling frame — and to a **capture-phase document listener** over
   every pointer, wheel, click, input and key event. That is the important
   design choice: any change a *person* causes is covered without hunting down
   individual mutation sites and missing one.
2. **A linger window** (260ms) rather than a single frame, so work that lands
   a moment after the event that caused it is still drawn.
3. **A once-a-second heartbeat.** If a path is missed entirely the screen is
   stale for up to a second rather than for ever. One frame a second is not a
   battery cost; sixty is.

`renderWanted(now)` is a separate pure function so it can be tested directly —
rAF does not fire under the harness's virtual clock, so a probe that counted
frames would prove nothing.

The **view cube** now redraws only when the camera's *orientation* changes.
Its picture is a pure function of the quaternion (verified against r184's
ViewHelper: no hover state, and `center` is read only by `update` and
`handleClick`), so panning and dollying cost it nothing.

### What the review caught: four changes with no event behind them

The heartbeat means nothing can be *permanently* stale, so these were all
"invisible for up to a second, then it pops" — which on a phone, where nothing
moves unless you touch it, is exactly when it is most noticeable.

- **An image mask finishing its decode.** The file input's `change` fires
  *before* the decode, and the code's own comment notes a phone photo "takes
  long enough to close the editor in". Hooked in `updateMaterialEverywhere`
  rather than at the two `onload` callbacks, so the next one written cannot
  forget.
- **`invalidate()` at the TOP of `applyPendingOp`** starts the window when the
  work *starts*, and this is the heaviest synchronous path in the app — on a
  subdivided mesh it can outlast the whole 260ms. The slider is covered by the
  finger being down; the segment stepper and the grouping buttons were not.
  There is a second call at the end now.
- **The view cube had no heartbeat.** The gate was right but the fallback was
  missing: `renderer.render` repaints everything from current state once a
  second whatever happens, and the cube had nothing equivalent — so anything
  that blanked its canvas without turning the camera (a lost-and-restored
  WebGL context, which backgrounding a tab on mobile does routinely) left it
  blank until the user happened to orbit.
- **The pivot marker hides itself on a timer.** `pivotMarkerWanted` is a
  function of the clock, with no event behind it.

### The coupling worth knowing about

`renderWanted`'s first clause is "a finger is down", which makes
`activePointers` carry a second job. A leaked entry used to be a gesture bug;
without a bound it would **also** pin the loop at 60fps for the rest of the
session with no symptom at all — the optimisation silently switching itself
off. So the clause is bounded by `POINTER_LIVE_MS` (4s) since the last real
pointer event: any genuine gesture streams events continuously, so four
seconds of silence means the entry is stale, not that a finger is resting.

### Accepted regression

The edge-distance field is baked from inside the render, so a throttled miss
now waits for the next *rendered* frame rather than the next of sixty. Worst
case the wear/bevel shading trails the geometry by up to the heartbeat instead
of by 120ms, and corrects with a visible pop. It cannot go stale permanently —
both throttle guards short-circuit on `f &&`, so a throttled call always
returns a stale field and never none.

## Performance, part 1 (a2.45 / a2.45a)

Measured by **counting work**, not by timing it: the harness runs under a
virtual clock and a phone is noisy, but how many times the expensive things RUN
is stable and is exactly what these change. `__kubik.PERF` holds the counters
(`applyOp`, `topo`, `shade`, `matClone`, `bake`).

- **One apply per animation frame.** `input` fires per touchmove — 60-120Hz,
  and the browser can deliver two between paints — and each apply ran the whole
  pipeline: snapshot back, re-run the op, rebuild the geometry, recompute
  topology, re-shade, refresh every overlay. Ten events in a tick were ten full
  runs; they are one now. Deferred ONLY on the slider; every discrete path (a
  stepper, a toggle, the keyboard, a probe) still applies synchronously,
  because the caller after it expects the mesh to be correct.
  `confirmPendingOp` / `cancelPendingOp` flush the outstanding frame rather
  than racing it.
- **Subdivide is no longer quadratic.** Its per-vertex loop walked the WHOLE
  edge map for every vertex and split each `"a_b"` key back into two numbers —
  O(V·E) with three allocations a step. Four levels on a cube came to ~317,000
  string splits *per press of the stepper*, since the stepper re-runs levels
  1..N from the snapshot. One incidence pass now.
- **One matrix inversion per drag, not one per vertex.**
  `Object3D.worldToLocal` copies the world matrix and inverts it on every call,
  and a soft-selection drag carries hundreds of entries.
- **`setCol` reuses one `THREE.Color`** instead of allocating ~7,700 of them
  per refresh. It uses `setHex`, not the bit arithmetic it looks like it could
  use: three's ColorManagement converts sRGB into the linear working space on
  the way in, so `hex>>16 / 255` is a *different colour*, not the same one
  faster.
- **`geometry.clone()` no longer shares `userData`.** `BufferGeometry.copy`
  ends with `this.userData = source.userData`, by reference, so a duplicate and
  its original shared one object for ever and a rebuild on either disposed the
  other's distance-field texture.

### The three that had to be walked back

**All three defects the review found were in the optimisations, and two made
things worse than the code they replaced.** Both were the same mistake: an
optimisation that removed work also removed a *value* something downstream
needed, and the fallback for "no value" is not "nothing happens".

- **Blanking the clone's `userData` cost it its wear-edge list.**
  `kubikEdges` is written only by `applyShading`, and nothing on the duplicate
  path calls it — so `ensureEdgeField` returned null, and the caller
  substitutes a 1×1 **black** texture, which means *distance zero: everywhere
  is an edge*. Duplicating an object wearing a curvature mask came out fully
  worn. The edge list is carried across now; nothing else is shared.
- **Moving the edge-field throttle onto the mesh dropped its `f &&` guards.**
  The invariant is that throttling may hand back a **stale** field and never
  nothing, for the same black-texture reason. Without it: an 8Hz strobe between
  correct and fully worn on an op-slider drag, and a solidly wrong render for
  any drag with a finger down. Restored — which means the pre-existing cost
  stays: `rebuildFromEditable` installs a new geometry, so `f` is absent on
  every frame of an op drag and the bake is not throttled there at all.
  Carrying the field across the rebuild is the real fix and belongs with that
  rebuild.
- **Disposing the abandoned materials immediately was a pessimisation.**
  Closing the leak was right — a 1500-face model abandoned 1500 materials per
  pointermove — but the replacement clones have not rendered yet, so the
  outgoing ones were the shader program's last users, `usedTimes` hit zero, the
  GL program was destroyed, and the very next render compiled and linked it
  again: a full shader build per frame, on the exact drag this was meant to
  speed up. They go into a bin now and are released when the op ends.

### Still on the list

- ~~`applyShading` recomputes all its topology every drag frame.~~ Done at
  a2.52, below.
- ~~`syncSelectionOverlay` disposes and rebuilds its GPU objects every
  pointermove.~~ Done at a2.53, below.
- ~~`ensureHelpers` builds one Mesh + geometry + material **per face
  group**.~~ Done at a2.54, below.
- ~~The render loop is an unconditional rAF.~~ Done at a2.46 (on-demand
  rendering); this bullet outlived its fix.

**What a2.52-a2.54 did NOT close**, both found by review and both worth a
version of their own rather than a rushed one:

- **An op-bar drag still rebuilds the face overlay every frame.**
  `applyPendingOp` -> `restoreObjectState` -> `rebuildFromEditable` ->
  `disposeHelpersOnly` runs per pointermove, and it disposes the overlay's
  material as well as its geometry. That material is almost certainly the only
  user of its shader program, so `usedTimes` hits zero, the program is deleted
  and the next frame links it again - which is EXACTLY the pessimisation a2.45
  documented at `opMatBin` and fixed for object materials. The a2.54 design
  makes the fix easy: keep the mesh and the material across a rebuild and let
  the borrow guard re-point the position attribute. Measure first.
- **Superseded index attributes are never released.** `setIndex` replaces
  `geometry.index` without removing the old attribute, and three only removes
  the CURRENT one at dispose. One throwaway element buffer per selection
  change, reclaimed by GC rather than deleted. Soft, bounded, real.

## What survives a round trip (a2.44 / a / b / c)

The other half of the audit: three things that should have come back the way
they went in, and did not.

### A file's own materials now arrive (the oldest outstanding item)

`restoreDoc`'s rule was "keep ours if we already know that id" — and
`loadMaterialLibrary` seeds **every preset id at startup**, so an incoming
preset was ALWAYS the loser. Add scratches to Metal, save, open the file on
another device: plain Metal, no scratches, no warning. Custom `mat_…` ids were
safe only until two collided, which their generator does not prevent.

Now: same id and the same look, keep ours. Same id, a **different** look, and
it comes in under a fresh id with every face that referenced it repointed
(`matIdRemap` → `remapFinishes`).

**The whole difficulty is deciding what "the same look" means.**

- The signature is an **explicit field list**, not "whatever keys the object
  has". `JSON.stringify` emits insertion order, and the same preset arrives as
  `{…masks}` in the session that saved it and `{…masks,bevel:0}` after a
  reload, because `saveMaterialLibrary` writes `bevel: d.bevel || 0`
  unconditionally while the mask button only appends `masks`. That alone made
  a masked preset **fail to match itself**, minting "Metal (imported)" beside
  Metal on every open. Absent-versus-zero did the same.
- The **name is in the signature**. Two materials configured identically but
  named differently are two materials to whoever named them; leaving the name
  out merged them and repointed faces onto whichever came later in iteration
  order.
- An import records **`srcSig`**, the signature it was an import OF, because it
  gets renamed and so no longer matches the file it came from. Without it the
  second open of a file mints another copy, and the third another.
- The remap is written **back into the doc**, which becomes history step 0
  after a load — otherwise an undo down the `keepAppearance` path put the
  file's original ids back and lost the import.

### Painting while an op bar is open

An op re-runs from its snapshot every slider frame, and the snapshot carries
the materials — so painting a face during a Bevel was reverted by the next
nudge, silently, with no history step to recover it from
(`applyFinishToSelection` deliberately pushes none).

The answer is split, because only half of it is possible:

- **Where the op has not changed the face grouping** — Set flow, Circularize,
  Smooth, every transform — the paint is carried by repainting the SNAPSHOT
  (`refreshPendingAppearance`). The geometry still comes back from the
  snapshot every frame, as it must; only the appearance follows.
- **Where it has** — Inset and Bevel add face groups — the paint has nowhere
  to live in the snapshot's numbering, so it is **refused before anything is
  painted**: "Finish the Inset first". Mapping post-op groups back would mean
  threading face provenance through every op, which is far more than this is
  worth. A refusal is a bad outcome; a silent revert one nudge later is worse.
- Both helpers walk **`op.multi[]` as well as `op.state`**. Subdivide and
  Smooth by angle do not re-run from `op.state` at all — they snapshot each
  selected object separately — so a check that looked only at `op.objId` let
  the paint through and then ate it on every object in the selection.

### The symmetry plane is saved

The plane is **captured**, deliberately, so it cannot drift as the model grows
— and then every save and every undo threw it away and silently recaptured it
from the current bounding box. Two numbers (`{axis, offset}`) now travel with
the object.

`App.symmetry` itself travels too, but **only on a real load, never on undo**.
Toggling symmetry pushes no history and is excluded from `pushHistory`'s
dedupe signature, so what a step carries is not "the symmetry state at this
step" but "the state at the last GEOMETRY edit" — arbitrarily stale. Restoring
that on undo meant switching symmetry off and pressing Undo turned it back on,
and the next drag mirrored across a plane the user had just switched off.
`keepAppearance` is undo's flag, and this follows the same rule as the material
library and the environment: **undo is about shape**.

### The pattern across a2.43 and a2.44

**Nine of the ten defects found reviewing these two fix passes were in the
fixes, not in the code they fixed.** Bug-fixing has a higher defect-injection
rate than feature work in this project, and it is the one kind of change that
tends to skip review because each piece looks small.

## Interrupted gestures and stranded state (a2.43 / a2.43a)

A whole-file audit turned up eleven latent bugs; this is the seven that were
about a gesture being interrupted or a piece of state outliving what it named.
**Nothing here is a feature — every entry is a sequence a real user hits.**

- **A cancelled touch now ends a geometry drag.** The `pointercancel` handler
  ended the pivot drag, the soft slide and the tool ring, and left the
  GEOMETRY drag alive. A notification mid-drag on a phone, or a desktop
  release over the top bar, left the mesh following the bare cursor with orbit
  switched off, and the only way out was another press — which committed the
  edit wherever the cursor happened to be. Ending it COMMITS where the drag
  reached, which is what a lift would have done. `pointerleave` deliberately
  does not: straying over the top bar and back is not a cancellation.
- **A second finger no longer swallows a history step.** The two-finger
  camera takeover tore the drag down by hand and never pushed history, so the
  move stayed in the geometry and outside the undo stack — and the next Undo
  reverted that drag AND the edit before it in one press. It calls
  `endDirectDrag` now, like every other way a drag ends.
- **The Mirror chooser has an exit.** It borrows the op bar without a
  `pendingOp` behind it, so ✕ hit `cancelPendingOp`'s "no op, return" line and
  did nothing at all — the bar could not be dismissed, ever. It also mirrored
  whatever was selected when Joined/Apart was finally pressed rather than what
  it was opened on. It now captures its selection at open time and checks the
  mode before touching the live one.
- **A selection can outlive its object.** The six "that collapsed the whole
  mesh — removed the object" paths dropped the object without touching
  `App.selectedObjectIds`, and the next Duplicate or drag dereferenced a ghost
  and threw. Pruned in `refreshUI`, for the same reason isolation is
  reconciled there: every one of those paths ends by refreshing the UI.
- **The object row cancels an open knife**, like every other modal funnel.
  Without it the knife's points still belonged to the OLD object while the
  helpers showed the new one, so OK cut a mesh you were no longer looking at.
- **Redo declines while a primitive setup is open.** Both obvious answers are
  wrong: discarding throws away the shape you are dialling in, and committing
  pushes history — which TRUNCATES the redo tail, destroying the very steps
  Redo was asked to walk into. So it says "Finish the shape first".
- **Bevel and Split guard their edge ids**, which their three siblings already
  did.

### What a2.43a is, and why it matters

**Four of the five defects the reviewer found in a2.43 were introduced by
a2.43's own fixes.** The worst: `mirrorChooser` was cleared only by
`hideOpBar`, but `showOpBar` re-uses the same bar without going through it, so
the flag outlived the chooser — and then swallowed ✕ for whatever op opened
next, leaving a bevel preview baked into the mesh with no bar to reject it.
Also fixed there: a cancelled box drag left the camera dead, and the window
`pointerup` backstop could commit a drag when a second finger tapped Undo.

**A bug-fix pass needs reviewing as carefully as a feature.** This one had a
higher defect-injection rate than any feature in the project.

One thing worth knowing about the backstop: OrbitControls captures the pointer
on the canvas, and capture retargets the release, so the canvas listener
normally fires even over the top bar. The backstop only earns its place when
orbit was already disabled at press time and no capture was taken.

## Circularize (a2.42)

**Pulls a selected loop onto the circle it is trying to be.** Its own best-fit
plane, its own centre and radius, blended from where the loop is to where the
circle is by the op-bar slider. Seat **8.5** in all three component rings —
beside Set flow, because they are the same kind of thing: reshaping a loop
rather than adding to it. `toolRingAngles` sorts by seat and spreads evenly, so
a fractional seat is a legal bearing; the Edge ring was full at 14 and without
the fraction something would have had to be evicted.

- **Amount is a blend, not a distance.** 0 leaves the loop alone, 1 puts it
  exactly on the circle. One range means the same thing on a screw hole and on
  a hundred-unit ring. Opens at 1: "make it round" is the request, pulling back
  is the fine-tuning.
- **Even** is a bar toggle (the mechanism Set flow's option added at a2.34).
  Off, each vertex keeps the angle it already has, which preserves the loop's
  spacing. On, it becomes a regular polygon — what you want after a knife cut
  or a messy bridge.
- Works from Vertex, Edge or Face mode. Face mode uses the RIM of the patch,
  the same once-only edge test Inset and Set flow use.

### Islands: the part that is easy to leave out

Two rims picked together — the top and bottom of a tube, or a loop and its
mirror partner after `symExpand` — are **two circles**. One plane and one
centre across both drags them together, and with symmetry on it folds the model
in half on the first frame of the slider.

- Adjacency comes from the **loop edges the selection names**, not from every
  mesh edge joining two selected vertices. The two rims of a tube are joined by
  the band's own vertical edges, and that reading glues them into one island
  and fits a single circle through the whole cylinder.
- Islands are **walked** (runs first, from their degree-1 ends; then cycles),
  which produces the ring ORDER the plane fit and the even spacing both need,
  and a `closed` flag.
- A vertex with **three or more** loop neighbours is a junction, and a junction
  has no circle to be on. `circularizeIslands` returns `null` and the caller
  refuses **before the bar opens**, rather than fitting something meaningless.
- **Vertex mode narrows its own loop edges**: whichever faces the selection
  fully covers are treated as chosen, and the edges INSIDE that patch are
  dropped, leaving its border. That is what lets "select every vertex of a
  one-segment cylinder" round both rims instead of reading as one junction.
  **Unless the narrowing takes everything** — a closed surface has no border,
  so on a whole cube every edge goes and the selection looks unconnected. The
  unnarrowed set is kept in that case, so a solid reads as the branching
  surface it is and gets refused.
- With **no connectivity at all** and symmetry off, the whole selection is read
  as one circle — three vertices tapped across a grid. Not with symmetry on:
  then the picks and their partners are two groups and one circle across them
  straddles the plane. The test is the symmetry SETTING, not "did symExpand add
  anything" — someone who selected both halves by hand defeats that.

### The maths, and the three things that are not obvious

- **Newell for the plane**, not a cross product of two edges: stable when the
  points are nearly collinear. It sums a POLYGON, so the ORDER matters — four
  coplanar corners in the order TL, BR, TR, BL come back "degenerate". Hence
  the walk. A scattered island has no walk, so it gets a provisional normal
  from the widest triangle among a sample spread ACROSS the set (not the first
  sixteen — those arrive in tap order and can all lie along one side), then an
  angle sort, then Newell.
- **THE CENTROID IS NOT THE CENTRE.** They agree on a regular polygon and
  disagree badly on an arc, where the centroid sits inside the bow rather than
  at the centre of curvature. With the centroid, "round these three corners of
  a cube face" — three points that already lie exactly on a circle and must not
  move at all — pushed the middle one a third of a unit out of the cube. The
  fit is Kasa's algebraic least-squares circle, which returns that circle
  exactly.
- **The fit has to agree with the walk.** A circle fitted to points that do not
  SURROUND it can slide anywhere: four arc vertices with a third of their
  radius in noise fit a circle whose centre lands among them, the run then
  wraps around that centre, and Even spreads those four points right round the
  ring. So a closed island must sweep at least π about the fitted centre and an
  open run at most π; otherwise the fit is dropped for the centroid and the
  mean radius. Less accurate on clean input, and unable to turn an arc inside
  out.
- **Even's phase is least-squares** (a circular mean), the rotation that moves
  the points least — not "start from the first vertex". A vertex anchor breaks
  symmetry, because the mirror image of a loop has a different first vertex, so
  the halves come out as regular polygons rotated against each other. The
  circular mean is invariant to where the walk started AND to which way it
  went.
- **The winding comes from the signed area**, not from the sign of the
  unwrapped span. The unwrap folds any step wider than half a turn, which a rim
  with a reflex corner near the centre really does have, and reading direction
  off the fold laid such a rim out backwards against its own winding.
- **An open run is an ARC, not a ring.** Even spaces it between its two ends.
  Spreading n points over a full 360 turns a five-vertex arc into a pentagon
  and tears the mesh open at both ends.

### Writing it back

Through `toEditable` / `rebuildFromEditable`, which is what Set flow does and
for two reasons that are invisible until you skip it: the rebuild is what drops
the cached topology so the selection dots and edge highlights follow the mesh
instead of hanging in the air, and it is what re-runs `applyShading`, without
which a bare `computeVertexNormals` melts a flat-shaded model smooth on the
first frame of the slider. Crease and Sharp marks are keyed by POSITION, so
they are snapshotted against logical pairs and rewritten after — skipped if the
vertex count changed, because two targets landing on the same point weld and
renumber, and the snapshot holds old ids.

### Known limits

- One degenerate island among several is skipped silently: `moved` is an OR, so
  if one loop of a multi-loop selection cannot be fitted the others still
  report "applied". Harmless for a mirrored pair, which fail together.
- The scattered reading is unavailable while symmetry is on — by design, above.
- An open run sweeping more than 180° always falls back to the centroid, so a
  genuinely lopsided long arc is circularized about its middle rather than its
  true centre.
- Committing at amount 0 says "Circularize applied" over an untouched mesh. No
  empty history step (`pushHistory` dedupes identical documents), so cosmetic.

## Snap to geometry (a2.41)

**Snap cycles through three states now: off, the grid, the model.** One seat on
the world ring, and the top-right chip says which — a seat can only show that
it is on, not which of two it is on.

- **Grid** is what Snap has always meant: round the amount to `snapMove` /
  `snapRotate` / `snapScale`.
- **Geometry** lands the **pivot** exactly on a vertex, an edge or a face you
  point at. Move only — a snap is a translation, and there is no sensible
  reading of "snap this rotation to that corner".

They are **alternatives, not a fallback chain**. Geometry that quietly fell
back to the grid when nothing was under the finger would mean a drag could not
be free at all while snapping was on, and "why did it jump" is a worse question
than "why did it not".

### The pivot is what lands

Not the object's centre by arithmetic, and not "whatever was nearest" — the
pivot, which since a2.39 is a thing you can place on the exact corner you mean.
That is why it had to be built first. Put the pivot on one corner of a part,
point at a corner of another, and those two corners meet.

`App.snap` (boolean) became `App.snapMode` ('off' | 'grid' | 'geo'), with
`gridSnapping()` reading it at all seven sites that used to test the flag.

### Finding a target

Vertex beats edge beats face, judged in **screen space** — how every picker in
this app judges, and the only measure that behaves the same at every zoom. Same
priority the knife resolves with, and for the reason the knife's comment gives:
this is a snap, so it means *exactly this corner*, not *near enough*.

**Two radii, and the difference matters more than the numbers.** A corner is a
point you aim at and can afford a generous catch (`SNAP_VERT_PX` 20). An edge
is a long target you are incidentally near almost anywhere on a face: at one
shared 26px radius, pointing at the dead centre of a face 60px across still
landed on an edge, because the centre is only 30px from one. Faces became
unreachable in practice and the pull felt like the app second-guessing the aim.
`SNAP_EDGE_PX` is 11 — below it you meant the edge, above it you meant the
surface.

The search is **bounded to the face under the ray** and its own corners and
edges. Walking a whole mesh per frame would be the falloff overlay's first
version all over again, and it would not even be better: the corner you mean is
a corner of the face you are pointing at.

### A drag can never snap to the thing it is moving

This is the part that took two goes, and it is worth understanding because it
is not obvious. `beginDirectDrag` is only reachable by grabbing your own
selection, so **the pointer starts on top of the moving surface** — and the
target is recomputed each frame from geometry the previous frame moved. That is
a feedback loop, and it does not fail gently:

- Select a face and drag it: the pivot sits on that face's plane and so did the
  target, so the face **locked into its own plane** and could never be pulled
  out of it.
- The same in axis mode: the wanted offset came out perpendicular to the axis,
  so the face **did not move at all**.
- With the pivot off that plane by some distance δ, the selection **accelerated
  along the normal by δ every frame** — unbounded.

Skipping by vertex id alone was not enough: a face whose corners all move was
caught, but the *face fallback* returned the hit point on it regardless, and an
edge with one moving end was measured from its moved position. So the finder
**walks the hits** and rejects a whole hit when the face it landed on touches
anything that moves.

Two more rules fell out of it:

- **Mirror partners are moving geometry too.** `captureDragContext` deliberately
  drops them from `entries`, so `snapSkipSet` has to add them back — dragging a
  vertex and pointing at its own mirror hit the highest-priority branch, and the
  pivot chased a target running away from it.
- **A target must face you.** Once the dragged face is rejected, the very next
  hit along the ray is the *inside* of the same object: pointing at the top of a
  cube and having the pivot land on its underside. The app culls back faces, so
  a surface pointing away is one you cannot see — the same rule `vertexVisible`
  exists for.

### The marker shows where it will land, not where you pointed

In an axis-locked move the pivot reaches only the target's projection onto the
axis. The first version drew the target either way, so with X locked and a
corner off to one side the ring planted itself on that corner and the object
stopped short of it with nothing saying why. `snapLive.landing` is what the
marker draws — **a marker that promises somewhere the drag cannot reach is
worse than none.**

### Known characteristic

There is **no proximity gate**. If the ray hits anything at all, the pivot goes
there — so with a second object five units behind, an 8px nudge moves the
selection all five units. That is what "land the pivot on the surface I am
pointing at" means, and it is why the mode is one of three rather than always
on: small free adjustments are what Off is for.

Probe: `_snap_probe.py` — the cycle, each target kind and the priority between
them, the pivot (auto and pinned) landing exactly, Off and Grid not snapping to
geometry, rotate and scale taking no target, and the feedback loop measured as
zero drift across six still frames.

## The soft falloff, drawn (a2.40)

**Every component the drag would carry, shown at the strength it will be
carried with** — so the reach and the *shape* of the reach are both readable
before you commit to anything. That is the whole reason the radius is a gesture
rather than a number in a box: you are meant to watch the model.

Three layers, following the component type, because that is what "the things
this drag will move" means: **dots always** (the clearest read of a field at
any size), **edges in Edge mode**, a **surface tint in Face mode**.

### Fading, not hue

Until a2.40 the falloff was a hue blend on the base 2px dots. That was the
cheapest place to put it and the wrong one: a 2px dot has almost no area to
carry a gradient, it said nothing whatever about edges or faces, and hue is a
poor way to read *how much* — the eye reads fading far better than a shift
toward red.

three.js gives per-vertex alpha when the colour attribute has **four**
components (`USE_COLOR_ALPHA`), so the dots and the face tint carry the weight
as real transparency, and the tint's alpha is interpolated **per corner**, so a
face straddling the edge of the field fades across itself rather than stepping.

**Fat lines are the exception.** `LineSegmentsGeometry.setColors` is hardcoded
to three components in r184 — there is no per-vertex alpha on a Line2 at all —
so edges fade by colour instead, from the wireframe colour toward the selection
colour. Same reading, different mechanism, because the mechanism was not on
offer. Worth knowing before anyone tries to "fix" the inconsistency.

The base helpers went quiet again, on the same principle as the selection
overlay: the shared buffers stay dull and a separate object makes the affected
few loud.

### Three things this got wrong first, all worth keeping

**The tint is coplanar with the surface it tints.** It is a copy of the mesh's
own vertex positions parented to the same object, so with `depthTest` on, the
opaque mesh fills the depth buffer first and `gl.LESS` fails on equality — the
tint either vanishes outright or speckles. `depthTest: false` and
`side: DoubleSide`, exactly as the existing face overlays are built. The first
pass copied the *selection* overlay instead and inherited neither. DoubleSide
matters for the same reason `refreshXrayMode` documents: a mirrored object has
negative scale and reversed winding, so front-face culling hides exactly the
half you wanted to see.

**It has to follow the mesh through a drag.** Positions are read at build time,
and a drag moves vertices every frame — so the overlay hung in space over a
model that had moved out from under it, and stayed there after the drag ended,
because nothing on that path calls `refreshElementColors`. But rebuilding per
frame is not the answer either: the field is **frozen** for the length of a
drag (`captureDragContext`), so the weights, the vertex list and the colours
are all still right and only the positions moved. `refreshSoftOverlayPositions`
writes them into the buffers that already exist — a few hundred floats instead
of a fresh geometry, material and GPU upload every frame. Called from
`syncHelperGeometry`, beside the selection overlay's rebuild.

**The walks are bounded by the FIELD, not by the mesh.** `refreshElementColors`
runs on every pointermove of the radius slide, and the first version walked
every edge and every face group each time, allocating two `THREE.Color` objects
per surviving edge. On a subdivided mesh at a large radius that was hundreds of
thousands of array pushes and megabytes of throwaway buffers *per pointer
event* — worst on exactly the meshes where a falloff matters most. Candidates
now come from the field through `vertAdj` (faces) and a new cached
`topo.vertEdges` (edges).

### Known limits

- **Symmetry partners are not drawn.** With symmetry on, the drag also writes
  each entry's mirror partner, and those are not in the field unless they fall
  inside the radius on their own. The picture therefore shows *less* than the
  drag will move — the safe direction to be wrong in, but wrong.
- An unselected edge whose two endpoints are both selected is drawn by neither
  overlay, so it reads at base strength between two full-weight ends.

Also fixed here, pre-existing: `disposeSelectionOverlay` never removed its line
from `gizmoStrokes` while `syncSelectionOverlay` pushed on every rebuild — and
`syncHelperGeometry` rebuilds it every frame of a drag, so Edge mode appended a
dead `LineSegments2` sixty times a second, which `updateStrokeResolution` then
walked on every resize.

Probe: `_sviz_probe.py` — including that each dot's alpha equals that vertex's
weight exactly, that the tint fades across a face, that the overlay moves with
the mesh mid-drag without being rebuilt, and that the stroke list holds steady
across thirty frames.

## The pivot (a2.39)

**Rotate and scale turn around a point you can put where you like.** World
ring, left pole → Pivot, then: To selection, To object, By hand, or Auto.

The pivot has always existed — `App.pivot` is what every rotate and scale in
this app already turns around — but it was invisible and recomputed to the
centre of the selection on every drag, so *"turn this around THAT corner"* was
not expressible. Now `App.pivotMode` is `auto` (exactly the old behaviour) or
`custom` (pinned to a world point in `App.pivotPoint`).

**A pinned pivot is a place in the scene, not a property of the selection.**
Move the object and the mark stays where you put it — Blender's 3D cursor, and
for the same reason: a mark that follows things around is not a mark. It is
view state like the camera and like isolate: never serialized, never a history
step, kept across an undo and dropped on a load (a load is a different scene,
and the point would be left pinning rotation to a spot with no relationship to
what just arrived).

`To object` uses the **bounding-box centre**, not the origin. The origin is
wherever the geometry happened to be built around and is regularly nowhere near
the shape; the box centre is what a person means by "the middle of it".

**Two places position the pivot** and both have to honour a pin —
`recenterPivot` (called at the start *and* end of every drag) and
`refreshGizmoAttachment` (which positions it itself rather than calling that
one, in two separate branches for object and component mode). Miss any of them
and the pin survives exactly until the next thing you touch.

### The drag needs two points, not one

This is the defect worth remembering. `beginDirectDrag` built its
camera-facing drag plane, its `startHit` and its `origin` all from
`pivot.position` — fine while the pivot was always the selection centre, wrong
the moment it could be pinned elsewhere:

- **The plane belongs at the SELECTION's depth.** Screen-to-world scale on a
  camera-facing plane is proportional to camera distance, so pinning the pivot
  three times further away made every drag travel three times as far as the
  finger.
- **The plane intersection is the gate for all three tools.** With the pinned
  point behind the camera, `Ray.intersectPlane` returns null, `beginDirectDrag`
  returns false, and grabbing your own selection silently orbits instead —
  the "sometimes it won't translate" failure this file already fixed once,
  arriving by a new route.

So `directDrag` now carries **`origin`** (the pivot — what rotation turns
around and scale grows from) and **`center`** (where the selection actually is
— what the plane, the start hit and the move axis are measured against). In
auto mode they are the same point and nothing changes.

### Placing it by hand

The bar opens and **a drag anywhere** moves the marker — not just on the 17px
dot, because aiming at a 17px dot with a thumb is exactly what this app does
not ask of people. Free and Axis mean here what they mean everywhere else, the
axis guide draws itself the same way, and the grid applies.

`beginPivotPlacing` settles the knife, any pending op and any geo setup first —
the same opening `startGeoSetup` has, and for a sharper reason than tidiness:
`#opBar` and `#pivotBar` share a slot at the bottom of the screen and the op
bar painted over this one, so Done became unreachable. With the world ring
unable to bloom while placing, and no Escape key anywhere in this app, that was
**an unrecoverable lock** — the only way out was loading a file.

**A tap ends the placing**, and that had to be decided in `endPivotDrag`
(`moved`), not in `handleTap`: every press while placing becomes a pivot drag,
and `pointerup` returns at that branch long before `handleTap` is reached, so
the guard there could never fire. A tap is a drag that went nowhere.

`cancelPivotDrag` runs from `pointercancel` / `pointerleave` and from the
two-finger camera bail-out. Without it a desktop drag released over the top bar
left the drag live with orbit off, and the bare cursor went on dragging the
pivot with the camera dead.

### The marker, and when it is worth drawing

Two dots, one inside the other, reading as a ring — it has to be unmistakable,
because at 2px the mesh dots and at 7px the selected ones are already dots, and
a pivot that could be mistaken for a vertex is worse than no marker: you would
aim at it. Constant screen size, no depth test, and a colour that is neither
the accent nor the selection colour — the pivot is a place, not a thing you are
editing.

**a2.39a: it is not left on.** Drawn permanently it was clutter — a bright dot
parked over the model for the whole session, saying something that only matters
at two moments. `pivotMarkerWanted` draws it at exactly those:

- while you are **placing** it;
- for `PIVOT_FLASH_MS` after it is **set**, so you see where it landed (setting
  it and getting no acknowledgement at all is the other failure);
- throughout a **rotate or scale** drag, because that is when it is doing
  something — you are watching the model swing and the dot is what it swings
  around. Not during a Move: the pivot plays no part in one.

Hiding it the rest of the time would make a pinned pivot invisible state, which
this project keeps having to kill — so the **tool chip carries a permanent
"Pivot"** while the mode is custom. Two words in a corner cost nothing and mean
rotation can never behave surprisingly with no explanation on screen. In auto
the chip says nothing extra and the marker never appears at all.

### The world ring's left pole

Claimed by Pivot at a2.39, after being deliberately empty so the two arcs read
as two arcs. The layout is better for it — pole, arc, pole, arc separates the
groups more firmly than an empty side did — and there was a practical reason
too: the pivot is wanted in **every** mode, and the Edge ring has no free seat
left at all.

Probe: `_piv_probe.py` — including the one that matters, a cube at x=2 with the
pivot pinned at the origin swinging to z=−2 on a quarter turn rather than
spinning where it stands.

## Isolate (a2.38)

**In Object mode, pinch three fingers IN and everything except the selection
goes away. Pinch OUT and it all comes back.** A chip at the top says how many
are hidden and brings them back on tap.

### It stores what is HIDDEN, and that is the whole design

`App.hidden` is a Set of object ids. Empty means everything is on screen.

The first version held the opposite — the ids that SURVIVE — and it was wrong
in a way worth remembering, because it looked equally reasonable. Holding "who
survives" makes **every object the app creates a special case**: join, mirror,
separate and duplicate all build a new object, and each one has to be told to
add itself to the set or it is born invisible. Review found four separate
defects from that one choice — Join made the joined object vanish, Duplicate
produced a copy that was drawn but unpickable, and Separate hid every part it
had just created.

Held as "who is hidden", **a new object is visible because nothing ever named
it**, whatever made it and whenever. There is no creation hook to forget. The
only upkeep left is dropping ids that no longer exist.

### One funnel: `refreshUI`

`reconcileIsolation()` runs from `refreshUI`, and nowhere else that matters.
Every op in the app ends by refreshing the UI, so that single hook covers join,
mirror, separate, duplicate, object delete and the six collapse paths (weld,
target weld, merge, collapse, detach, last-face delete) — none of which the
first version's two hand-placed hooks reached. It does nothing at all when
nothing is hidden.

It has three jobs, each a bug otherwise:

- **Drop dead ids**, or the count on the chip drifts away from the truth.
- **Re-apply visibility**, because `restoreDoc` builds BRAND NEW meshes and a
  new mesh is visible — without it an undo quietly un-hides half the scene
  while the chip goes on claiming otherwise.
- **Never leave nothing on screen.** If everything ends up hidden, hiding is
  over. An empty viewport with no explanation is the failure this whole feature
  exists to avoid.

It also clears `App.activeObjectId` when that object is hidden. Component mode
reads the active id **directly** — it does not go through the pickers — so a
hidden active object meant extrude, bevel and delete all running on a mesh
nobody could see. `enterIsolation` calls reconcile rather than plain apply for
exactly this: the active object is usually one of the ones about to disappear,
because it is whatever you touched last.

### A hidden object must not be pickable

**three.js r184's raycaster tests LAYERS and nothing else** — it does not skip
an object whose `visible` is false. So `pickObjectAt` and `performRegionSelect`
filter through `objectPickable` explicitly. Without that, isolate would have
hidden things you could still tap and drag by accident, which is worse than not
hiding them at all. `focusOnAll` and `focusOnObject` filter too: framing a box
drawn around hidden geometry flies the camera off to nothing.

**The camera does not move on isolate.** Framing the survivors is the obvious
extra touch and it is the wrong one — this app took Smart camera out because
"being moved when you did not ask to be moved reads as the app losing your
place". Isolate hides, and only hides. The chip is what tells you where
everything went.

### Never saved

Nothing about isolation reaches `serializeDoc`. It is a way of looking, like
the camera. `restoreDoc` **drops** it on a load and **keeps** it on an undo,
told apart by `opts.keepSelection` — undo and redo pass it, the three load paths
(a saved model, the autosave, a project file) do not. Without that split the ids
carry over, and since ids are small integers counted from 1 they collide across
documents almost always: isolating object 3 and then opening a different file
opened it with one object showing and the rest hidden.

### The outliner keeps them

Hidden objects stay in the list, dimmed with a struck-through name — it is the
one place a hidden object is still visible AS a thing that exists. **Tapping a
dimmed row brings that one back** rather than selecting something invisible,
which was the trap: the row selected a hidden object and Delete or Ctrl+D then
acted on a thing nobody could see.

### The gesture, and why raw spread cannot work

`ISO_PINCH_RATIO` / `ISO_PINCH_PX` / `armIsoPinch` / `isoPinchMove`.

It fits between the two gestures three fingers already have and disturbs
neither. A three-finger TAP cycles Free/Axis — a tap is still, and this needs
travel. A three-finger SLIDE sizes the soft falloff — and soft cannot be on in
Object mode, so the two can never be asked at once.

**The obvious test — "has the mean distance from the centroid changed" — cannot
be made to work, and the probe caught it firing on an ordinary three-finger
slide.** Pointer moves arrive ONE FINGER AT A TIME: after the first of three
has been updated and the other two have not, the hand genuinely looks squeezed,
and on a 220px slide that phantom squeeze is a third of the spread. Real fingers
stagger exactly the same way.

So each finger is measured on its **own travel along its own outward
direction**, and the gesture only counts when every one of them agrees:

- A real pinch moves all three toward the centre (or all away), so every radial
  reading has the same sign and the smallest is still large.
- A slide moves all three the same way, and since they sit at different bearings
  the readings disagree in sign — the leading finger reads outward while the
  trailing one reads inward.
- A half-updated hand leaves two fingers reading nearly zero, so the smallest is
  nowhere near the threshold.

Judging on the **smallest** rather than the average is what makes all three
cases fall out of one rule. It fires once per gesture (`fired`), or a hand that
keeps closing would isolate the survivors, then one of those, and so on down.

Probes: `_iso_probe.py` (the gesture and what stays pickable) and
`_iso2_probe.py` (the seven review defects, each checking the whole picture
agrees with itself rather than one value).

## Soft selection (a2.37)

**The mode button has three positions now: Object, Component, Soft.** In Soft,
what you drag carries its neighbourhood with it, fading out over a radius.
**Three fingers sliding sets that radius**, and the vertex dots light up to
show its reach as you slide.

### Soft is not a fourth mode — it is a way of DRAGGING

`App.soft` is a boolean; `App.mode` still says which component type you are
picking. That is the whole reason this was cheap and safe: every branch in the
app that reads `App.mode` is untouched, leaving Soft leaves you in the same
component type with the same selection, and the button keeps showing the
component icon and grows a ring rather than swapping to a fourth pictogram.

`cycleEditMode` runs Object → Component → Soft → Object. `setMode('object')`
turns Soft off, so coming back in through the button re-enters Component — the
three positions are a cycle, not a memory.

### Distance is measured ALONG the surface

`softWeights(obj, seeds, radius)` — Dijkstra over `topo.edges` with world-space
edge lengths, seeded from every selected vertex at once, stopped at the radius.
`softHeap` is a small binary heap, there because an unbounded frontier on a
subdivided mesh is thousands of nodes and the alternative is a re-sort per pop.

Straight-line distance is one line of code and wrong on anything folded: the
far wall of a thin box is millimetres away through the air and half a model
away across the mesh. **Measured**: a 4×4 slab 0.2 units thick, radius 1.0 —
the far wall is untouched, the field is the near side only. A separate object
is never reached at all, because there is no path to it.

World space rather than local because the radius is a number dialled against
what you can SEE; a scaled object would otherwise take a different bite at the
same setting.

**One falloff curve**, `softFalloff` — a cosine ease, 1 at the centre, 0 at the
radius, flat at both ends so neither the selection nor the boundary shows a
crease. Deliberately the only curve: a menu of seven is more than a one-handed
fidget needs, and none of the other six changes what the tool is for.

### The weight scales the RESULT, not the matrix

In `applyDeltaToSelection`, an entry carries `w` and lands at
`lerp(where it was, where the full transform would put it, w)`. Blending the
matrix itself would need it decomposed and the rotation slerped, and for a
partial scale is not even well defined. One line, and **Move, Rotate and Scale
all fall off** because all three already funnel through this one function.

`captureDragContext` widens the SNAPSHOT, not the selection: the neighbourhood
rides along as extra entries. Lifting your finger leaves the same vertices
picked you started with, and every op still sees exactly what you chose. The
field is **frozen** at drag start — recomputing it per frame would re-weight
vertices as they move and the falloff would smear outward under your own
finger. Not applied while an extrude section is live; that branch borrows the
same path.

### Symmetry: the invariant nobody knew was there

An entry writes ITSELF and its mirror partner, so **entries and their partners
must be disjoint**. Every selection satisfied that by accident until soft
selection arrived — the field spreads in all directions, so the moment it
crosses the plane the mirror partner of a selected vertex is also an entry,
later in the list, carrying a fraction of the weight. Entry A wrote A at full
travel and A′ at its mirror; entry A′ then overwrote A′ with its own weighted
move and overwrote A with the mirror of that. **The vertex under your finger
went backwards** — measured at −0.25 on a 1.0 drag along the mirror axis.

So a partner that already has an entry loses that entry; it is written by the
vertex it mirrors, which is what symmetry means. The selection is walked first
and always wins the claim. This also settles the older order-dependent case of
selecting a vertex and its own mirror and dragging both.

The filter has to run **after `ctx.mirrorMap` is assigned**. The first attempt
sat with the soft entries a few lines earlier, where the map is still
undefined, so the whole thing silently skipped — the probe caught it unchanged.

### The gesture

`SOFT_SLIDE_ENGAGE_PX` → `endSoftSlide`. Three fingers already handed the whole
gesture to the camera, and a three-finger TAP still cycles Free/Axis, because a
tap is judged on stillness and this needs real travel. Not a slider: the radius
is judged by watching the dots on the MODEL, and you cannot watch a slider and
the model at once — the same argument that gave lighting a gesture.

**Multiplicative.** A radius is a scale, and the meshes here run from a
0.1-unit bead to a 40-unit terrain; a fixed number of units per pixel is either
useless or uncontrollable on one of them. A third of the screen multiplies by e.

Four things the review caught here, all of them the difference between a
gesture that works and one that eats the app:

- **Travel is measured from when the THIRD finger landed** (`softArm`), not
  from each pointer's lifetime maximum. Two fingers mid-orbit have travelled
  hundreds of pixels, so a lifetime maximum meant a third finger or a palm
  engaged on its first move, killed the orbit and started rewriting the radius
  with movement meant for the camera. In Soft, "two fingers that have already
  moved" is the ordinary state.
- **A finger arriving mid-slide belongs to the slide** (`softSyncSlide`).
  Otherwise the two-finger bail-out set `orbit.enabled = true` in the middle of
  a gesture OrbitControls had been shut out of — the exact state
  `maybeResumeOrbit` exists to avoid — and moved the mean the radius is
  measured from without re-baselining, jumping the radius in one frame.
- **`pointercancel` / `pointerleave` end it.** Cancellations are routine on a
  phone. Left open, the HUD stayed up, orbit stayed disabled so the camera was
  dead, and the next SINGLE finger anywhere fell into the slide branch and
  rewrote the radius by most of a screen width.
- `orbit.enabled` is never handed back with fingers still down; it goes through
  `orbitResumePending` / `maybeResumeOrbit`, same as the light hold.

### The radius belongs to the object it was measured against

`seedSoftRadius` takes a quarter of the object's world-space bounding-box
diagonal and records `App.softRadiusFor`. `refreshSoftField` re-measures
whenever the active object is not that one — **not** only when Soft is switched
on, because the active object changes on paths that never pass through
`setSoft`: tapping another object's surface, the outliner chip, and loading a
file (which also carries `App.soft` and the old radius onto a document whose
object ids commonly collide with the previous one's).

A radius is a length in one object's world. Carrying 0.03 from a bead onto a
40-unit terrain gives a Soft mode that does nothing while the button says it is
on — the failure this project keeps having to kill. Re-dialling costs one
slide; being silently inert costs trust.

### The tint, and why it must not lie

The falloff is drawn by its own overlay, on dots, edges and faces, with real
per-vertex alpha — **see "The soft falloff, drawn (a2.40)" above**, which
replaced the hue tint the base dots carried at a2.37. The reach and the SHAPE
of the reach are both visible before you commit, which is the whole reason the
radius is a gesture rather than a number in a box.

Which is why `restoreDoc` calls `clearSoftField()`. The field's signature leans
on the position attribute's `version` to notice a changed mesh, and a rebuilt
attribute starts at version 0 — so **two restores in a row** (undo then redo,
or any two loads) produced identical signatures for different meshes and the
second handed back the first one's field. The drag was always safe, since it
recomputes; a lying picture is worse than none.

`softGraph` memoises the world positions and the adjacency per (object,
attribute version, world matrix). The slide changes the radius every frame and
none of that depends on the radius. **Measured**: 200 radius changes on a
1490-vertex sphere rebuild the graph once, not 200 times. Counted rather than
timed, because a headless run is under virtual time where `performance.now()`
jumps rather than ticks and a rebuild and a cache hit both measure 0.00 ms.

Probes: `_soft_probe.py` (the field and the weighted drag, including the thin
slab), `_soft2_probe.py` (the three positions, the gesture, the tint) and
`_soft3_probe.py` (the eight review defects, each with a control).

## Primitives, and Add geo (a2.36)

**The world ring's Add Cube is now Add geo, and it opens a ring of five
shapes: Cube, Cylinder, Sphere, Torus, Plane.** Pick one and the object is
made immediately, at the size and divisions you can then change live on a bar
at the bottom of the screen. Done keeps it. A tap anywhere off it throws it
away.

### The shapes are built as CAGES, not as three.js geometry

`PRIM_SPECS` / `buildPrimitiveEditable(kind, params)` / `primCube`,
`primPlane`, `primCylinder`, `primSphere`, `primTorus`, all in the
`PRIMITIVES (a2.36)` block.

None of them uses `THREE.CylinderGeometry` and friends, and that is
deliberate. Those arrive as triangle soup split along UV seams: a
CylinderGeometry has no face loop to cut, no ring to walk, its wall in
triangles and its cap in a fan of them. **A cylinder you cannot loop-cut is
not a cylinder this app can use.** So every shape is built here in the app's
own editable form — quads for every side wall, one n-gon per cylinder cap,
triangles only where a sphere meets its poles — with each face carrying its
own vertices, welded by position on rebuild the way every other op here
works.

Sizes are per-axis (`x`, `y`, `z`); divisions are two counts whose meaning
depends on the shape, which is why each spec names its own labels:

| shape | `hLabel` / min | `vLabel` / min | notes |
|---|---|---|---|
| Cube | Across, 1 | Up, 1 | `h` is both horizontal axes |
| Cylinder | Sides, 3 | Up, 1 | caps are n-gons |
| Sphere | Around, 3 | Rings, 2 | tris at the poles only |
| Torus | Around, 3 | Tube, 3 | all quads; `y` is the tube diameter |
| Plane | Across, 1 | Along, 1 | `noY` — no Y size, it is flat |

`primParams` clamps: counts to `[min .. 64]` horizontally and `[min .. 32]`
vertically, sizes to `>= 0.01` (a zero size is a mesh whose normals cannot be
computed). Nothing needs disabling in the UI because of it — press the
stepper past the end and the number simply stops.

`_prim_probe.py` audits all five: face and vertex counts against the
parameters, how many faces are quads, winding, the Euler characteristic (2
for anything closed, **0 for the torus**, which is the cheapest proof its
ring closed both ways), and vertices tested against the exact surface rather
than against a bounding box. **A faceted prism's box is not its diameter** —
a hexagonal prism of radius 1 measures 1.73 across the flats — which read as
a bug twice before the probe started testing the surface instead.

### The chooser is a ring REPLACING a ring, not a second ring

`HUB_TOOLS_GEO` / `openGeoRing` / `armStickyRing`.

This is not the two-ring bloom on the do-not-rebuild list. That one showed
two rings at once, and an outer ring picked by angle is unreachable by
construction. Here the world ring closes and this one opens in its place, at
the centre of the viewport, picked the way every ring here is picked: aim
from the centre, release.

Two things follow from the fact that your finger has already LIFTED by the
time it appears:

- **It waits for a fresh press.** `toolRingActive.sticky` means no pointer
  capture, and the aim is measured from the ring's own centre because the
  gesture that will pick it has not started yet and has no origin of its own.
  `pointerdown` has a branch that claims that press for the ring.
- **It needs a way out that a slide-and-release ring does not.** That one is
  dismissed by lifting near where you started; this one has no "where you
  started". So aiming well past the items (`> radius * 2.2`) means "none of
  these", and the middle still does too.
- `openGeoRing` blooms inside a `setTimeout(…, 0)` because it runs from
  INSIDE `closeToolRing`, which tears the ring element down after the tool
  has run.
- `armStickyRing` installs a **document-level capture-phase `pointerdown`**
  that closes the ring when the press lands anywhere but the canvas.
  Without it, a tap on Undo or the menu never reached the canvas listener,
  so on a phone (no `pointerleave`) the ring stayed up with the camera
  disabled and ate the next canvas tap. `closeToolRing` removes it first
  thing.

### The setup bar

`App.geoSetup = { objId, kind, params }`, `#geoBar`, and
`startGeoSetup` / `applyGeoParams` / `syncGeoBar` / `finishGeoSetup`.

The object is made the moment you pick a shape and edited in place from
there — the bar is not a dialogue describing something you cannot see, it is
a set of handles on the thing itself, sitting in the scene at the size it
will keep. `setPrimitiveGeometry` rebuilds it on every stepper press and
every keystroke, cloning the current material so a theme or a picked
material survives a change of divisions.

**Nothing reaches the history until Done.** Every division you tried would
otherwise be its own undo step, and there would be no single press that takes
the whole primitive back. That one rule is what almost every bug in this
feature came from, and each of these is a fix, not a nicety:

- `endDirectDrag` skips its `pushHistory` while a setup is open. Dragging the
  new shape into place is part of the setup — the tap guard allows it on
  purpose — and a step pushed there left a half-built primitive in the
  history AND in the autosave, which rides on `pushHistory`.
- `finishGeoSetup(false)` calls `scheduleAutosave()`. The history is untouched
  by a discard, but **the autosave is not the history**: it serialises
  `App.objects` when its timer fires, and the primitive is in there from the
  moment it is made. Anything that armed that timer mid-setup — painting a
  material, or the op this setup resolved on its way in — wrote the discarded
  shape to disk, and it came back on the next reload in a document whose
  history has no step that removes it.
- `restoreDoc` drops an open setup. Ids come from the DOCUMENT, so a bar left
  open would silently retarget whatever object in the LOADED model wears that
  id — a stepper press would turn it into a cylinder, a tap on empty space
  would delete it. Undo and Redo close the setup themselves; this covers Load.
- The keydown handler commits the setup before running any shortcut, except
  Ctrl+Z / Ctrl+Y. Unguarded, Ctrl+D duplicated a primitive that was not in
  the history yet and buried the original inside ITS step.
- `startGeoSetup` resolves the knife and any pending op, then calls
  **`setMode('object')` rather than assigning `App.mode`**. The assignment is
  what Add Cube has always done, and it skips everything `setMode` does around
  it: the previous object's dots and red overlay went on hanging over it, and
  its face indices stayed in `App.selectedElements` for an object that was no
  longer active.
- `syncGeoBar(typing)` never writes a clamped number back into a field you
  are typing in. It made them unusable: emptying a field refilled it
  instantly, and the `0` of `0.5` clamped to the 0.01 floor and was written
  back with the caret at the end, so the `.5` landed on `0.01`. Squared up on
  blur instead.

Reaching for another ring, or switching mode, ACCEPTS the shape — you have
clearly moved on, and the alternative is a hold that silently does nothing,
which is the exact failure mode a2.33 spent a day removing.

**Every primitive arrives at the world origin** (a2.36a), whatever is
already standing there. Add Cube used to step new objects across and back
from a slot picked out of `App.objects.length`, and that does not survive
contact: the count moves when you delete something so the slots collide
anyway, the camera is usually looking at the middle of the scene so a new
shape could arrive off-screen, and the offset was invisible arithmetic
nobody could predict or aim at. The origin is a place you can point at.
Overlapping is the user's business — drag it off, the selection is already
on it. `addCubeAction` went with the old slot, since both rings that carried
it now call `openGeoRing`.

Probes: `_geo_probe.py` (the flow end to end: ring, bar, clamps, Done, the
outside tap) and `_geo_probe2.py` (the eight defects two review passes found,
each with a control case where one was needed).

## Target weld, by gesture (a2.35)

**Tap a vertex, then double-tap another: the first moves ONTO the second,
and the second does not budge.**

That last part is the whole point, and it is what separates it from the
ring's Weld. Weld melts its selection into the selection's own middle —
right when you are closing a gap, wrong when you are putting a corner
exactly where another corner already is, which is most of what welding is
for while cleaning topology up. Maya has this as a tool you pick up and
drag with; here the second tap IS the destination, which suits a thumb
better than aiming a drag at a 6px dot.

`weldVerticesOp(obj, ids, at)` gained the optional landing point. Without
it, nothing about Weld changed.

### How the pair is remembered

`App.vertAnchor` is the selection that existed BEFORE the vertex you just
tapped, recorded on every vertex tap — the same shape as the edge anchor
that joins two edges into a run. It is set to null the moment a tap lands on
something already selected, which is what stops a second double-tap on the
same vertex from welding a stale pair.

The sequence matters and is worth spelling out: the first tap of a
double-tap runs `handleTap` and selects the target, so by the time
`handleDoubleTap` fires, the anchor holds exactly the vertex you tapped
before it. The 1500ms freshness window therefore only ever guards a
double-tap whose first tap missed.

**The vertex near-miss fallback is BOUNDED** (`lastVertPick <
logicalCount`), for the reason the edge branch has always stated: every mesh
edit renumbers, so a remembered index can point past the end of the topology
it is being used against. It was not, and the review found it throwing on a
smaller object.

**The anchors die with the active object.** `setMode` and
`switchToComponentType` always cleared them; the third way the active object
changes — tapping a different mesh's surface — did not, and a Target weld
could then fire on the mesh you had just switched TO using ids from the one
you switched FROM. That branch clears both anchors now.

### Symmetry

Target weld handles it itself rather than through `runMirrored`, because it
has two inputs rather than one selection. It mirrors the sources and the
target, remembers the mirrored pair as POSITIONS (the first weld rebuilds
and renumbers), welds one side, re-resolves by position, welds the other —
one history step for both. A pair that is its own mirror runs once. Measured
on a cube with symmetry on: 8 vertices to 6, one Undo step, both sides done.

### WELD BEATS FOCUS — a decision, not an oversight

Double-tap used to mean "frame this". The two cannot both own the gesture:
the first tap of the double-tap is what records the pair, so *a vertex was
selected and I double-tapped another* is the same input whether you meant to
weld or to frame. **Zeghreit chose the weld.**

Framing is still one gesture away in Vertex mode — double-tap the object's
surface clear of any vertex, or empty space, or the vertex that is already
selected, which the anchor rule exempts — and a weld you did not mean costs
one Undo and says what it did.

## Set flow (a2.34)

A loop settles onto the curve the surrounding mesh already implies. It is on
all three component rings and it is also a switch on Loop cut.

**What the two tools it comes from actually do**, checked rather than
remembered. Maya's **Edit Edge Flow** "adjusts the position of edges to fit
the curvature of the surrounding mesh" and has exactly one option, *Adjust
Edge Flow*, 0 to 1, default 1, where 0 "moves the selected edges to the
middle of the other nearby edges, creating a flat transition"; its docs
recommend no more than two non-adjacent loops at a time. Blender's
**EdgeFlow** add-on (BenjaminSauder) does the same job "via a spline
interpolation such that it respects the flow of the surrounding geometry" —
**a Hermite spline with control points taken from the neighbouring edge
loops** — with Mix, Tension, Iterations and a Min Angle guard, and ships
*Set Linear* (the flat end as its own tool) and *Set Vertex Curve* for
vertex selections.

### The maths, and why the obvious version of it is wrong

For each vertex the caller supplies the two vertices ACROSS the loop, `a`
and `b`, and where the vertex belongs between them, `t`. Then with `a2` and
`b2` the next ones out:

```
T0 = tangent at a, in the direction of travel, scaled by |b - a|
T1 = tangent at b, same
v' = lerp(a, b, t) + amount * (H(t) - lerp(a, b, t))
```

Three things in that line are load-bearing:

- **The straight position is subtracted, not assumed.** A Hermite's own
  baseline is a smoothstep, not a lerp, so at any `t` other than the middle —
  which is every vertex of a slid loop cut — building it in directly would
  drag the loop toward the centre as a side effect.
- **amount 0 is exactly Maya's flat transition** and 1 is the curve, so the
  range carries on to 2 and over-bends, which is how a low-poly cage is made
  to read rounder than it is.
- **The tangent DIRECTION is where all the accuracy lives.** The obvious
  estimate — the outer chord `a2 -> a` alone — is wrong by half the angle the
  span turns through, because the two chords meeting at `a` do not cover
  equal arcs: the outer one is one ring step, the span across is two.
  `weightedTangent` weights each chord direction by the OTHER's length (the
  non-uniform Catmull-Rom tangent), which on a circle is exact.

Measured on a five-loop arc of radius 2 with the middle loop flattened onto
its chord (1.8794) and flowed back at 1:

| tangent estimate | radius returned | error |
|---|---|---|
| outer chord alone | 2.0504 | 2.5% proud |
| uniform Catmull-Rom | 1.9228 | 3.9% shy |
| **chord-length weighted** | **1.9964** | **0.18%** |

What is left is the cubic's own error against a circle, not the estimate's.

### Two neighbours is not the same as two neighbours ACROSS

The first version accepted any vertex with exactly two non-loop neighbours.
Where a selection turns a CORNER there are exactly two — and they sit at
right angles on the SAME side. The curve then runs between two points that
are not across anything: measured, a vertex thrown 0.87 units on a DEAD FLAT
grid, in all three modes, on a surface whose implied curve is a straight
line and where nothing at all may move.

So the pair has to be genuinely opposed: `FLOW_MIN_OPPOSITION`, 110 degrees
at the vertex. A loop on any smooth surface reads near 180 (a
20-degree-per-step arc reads 176); a right-angled corner reads 90 and is
refused, as is the corner of a cube's own edge loop, where "across" means no
more than it does on the flat grid.

### What each mode reads as "the loop"

| mode | vertices | edges that run ALONG it |
|---|---|---|
| Vertex | the selection | edges with both ends selected |
| Edge | the endpoints of the selection | the selected edges |
| Face | the rim of the patch | the edges appearing once around it |

Face mode is the rim on purpose: after an Inset or an Extrude the new rim
settles onto the curve running through the face inside it and the surface
outside it. A patch one face wide has nothing on the inside of its rim and
is refused, which is correct rather than a gap.

### Loop cut's Flow switch

Flow is not a third SPACING — Even and Slide answer where the loop goes,
Flow answers what shape it takes when it gets there, and you want both. So
it is an independent switch (`OP_SPECS.toggle`, rendered by
`refreshOpToggle`) rather than a chip in that exclusive row, the way Maya's
Multi-Cut carries edge flow separately from where the loop lands.

**The inserted vertices are recovered, not tracked.** Every one of them lies
on an edge that no longer exists, so `loopCutBeforeState` records the edges
before the cut and `loopCutFlowItems` finds the vertex's original span as
"the vanished edge it sits on", with its own `t` along it. That needs no
instrumentation inside `edgeLoopOp`, it covers the mirrored ring in the same
pass, and handing the flow the ORIGINAL span rather than the immediate
neighbours is what makes two sections and a slid loop come out right.
Measured on the same arc: Flow off lands exactly on the chord (1.9696 =
R·cos 10°), Flow on at 1.9998; two sections at 1.9998 each; a slide at 0.2
and 0.8 both at 1.9999.

### Seats

Set flow holds **seat 8** in all three component rings. The Edge ring had
exactly one free bearing and that was it, so the choice was one bearing
everywhere for Set flow or one for Shade — and **Shade moved to seat 11 in
the Face ring**, keeping 8 in the Object ring where shading a whole model
belongs. Seat 8 already read as "how the surface behaves"; Set flow is that
idea with topology behind it instead of normals.

## Extrude is a MODE (a2.31, Rotate/Scale at a2.32)

Extrude used to be a thing that HAPPENED: it committed a 0.02 nub, toasted
"drag the gizmo to place it", and handed you back to the ordinary move tool.
That made it the only shaping op with no control of its own, and it is what
"an extrude just happens, with no feedback" on the pre-2.0 list meant.

It now opens a mode, built on the pending-op machinery every live op already
uses (`beginPendingOp` snapshots, `applyPendingOp` re-runs from that snapshot
on every tick, `confirmPendingOp` / `cancelPendingOp` end it). `op.live`
marks it, and that flag is the whole switch:

| gesture | meaning |
|---|---|
| drag on the new section (Move) | its height — out, or back in past zero |
| **tap** the new section (Move) | stack ANOTHER section from where this one ended |
| drag it under Rotate / Scale | the ordinary transform — see "settling" below |
| two-finger tap | cycles Move / Rotate / Scale, as everywhere else |
| tap anywhere else, or Done | commit the lot, **one** Undo for all of it |
| the grouping chips | live, and each one re-measures the drag direction |

**The pull has no ceiling** (a2.32). `setPendingAmount` skips the op spec's
range for a live op — that range was only ever the slider's, and this is a
drag. The ±1e5 rail left in place is a guard against a degenerate projection
producing a nonsense number, not a design limit.

The bar is the same `#opBar` wearing a different face: no slider (the drag on
the model IS the control), no Cancel, OK reads **Done**, and the label counts
the sections — "Extrude ×3". `showExtrudeGroupingChooser`, the one-tap modal
that used to ask Joined/Joined/Each, is GONE; its three options are now those
live chips, filtered by `needsMultiple` against `payload.picked` — the count
the user selected BEFORE symmetry expanded it, so one face plus its mirror
still shows no chips, exactly as the chooser refused to ask.

### Which way a drag pulls is MEASURED

`measureExtrudeAxis` runs the op at two heights and reads where the
selection's centroid actually went. One piece of code then answers
Joined-own, Joined-avg, Each and edge extrude — none of which agree about
direction — and it also detects the case that HAS no direction: two opposite
faces in Each mode, whose centroid does not move at all. It runs once when
the mode opens, once per stacked section, and once per grouping chip.

It yields `{dir, scale}`, where scale is how far the centre travels per unit
of amount: 1.000 for a plain face extrude, 0.707 for Each on two faces 90°
apart. Every path divides by it, so the GEOMETRY keeps up with your finger
rather than the number doing so.

### The drag reads the axis's SCREEN direction, and that is not fussiness

The first version slid along the axis in 3D with `axisParamFromPointer`,
which is what every other axis drag here uses. **It blew up**, and the review
caught it before it shipped. That function solves for the closest point
between the view ray and the axis, so its denominator is the sine of the
angle between them and world-units-per-pixel go as 1/sin. Measured at this
app's own 50° fov, 800px high, camera 5 units out:

| angle off the view axis | per 10px drag |
|---|---|
| 90° (side on) | 0.058 |
| 20° | 0.172 |
| 10° | 0.360 |
| 2° | **2.507** — past the whole ±1.5 clamp in one twitch |
| 0° | **null** — the press silently became an orbit |

And **looking head-on at the face you are about to extrude is the normal way
to work**, so that was the common case, not a corner one.

The shipped rule instead projects the pointer's travel onto the direction the
axis POINTS ON SCREEN (`axisScreenDir`, which the direct-drag axis picker
already used), with the 1/sin gain **capped at 2**. Measured on the same
cube, dragging 10px along that screen direction:

| angle | path | per 10px |
|---|---|---|
| 90° | projected, gain 1.00 | 0.101 |
| 45° | projected, gain 1.41 | 0.143 |
| 30° | projected, gain 2.00 | 0.202 |
| 20° / 10° / 7° | projected, gain 2.00 | 0.202 |
| 3° / 0° | up-the-screen | 0.101 |

From 30° out the geometry tracks your finger exactly; below that it merely
slows down. Under `EXTRUDE_MIN_SIN` (0.1, about 6°) the axis projects to
almost nothing and its screen direction is numerical noise, so the drag gives
up on it and reads plain up-the-screen. **Projecting also settles the sign
for free** — dragging the way the axis points grows the section whether the
face looks toward you or away, which a hardcoded "up = grow" got backwards
for every away-facing face.

### Rotate and Scale SETTLE the section (a2.32)

They act on real geometry, and the section being pulled is a preview that
`applyPendingOp` rebuilds from `op.state` on every tick — so a rotation
applied to it would vanish at the next re-run. `settleExtrudeSection` runs at
the top of `beginDirectDrag` and turns what has been pulled into mesh:
`op.state` and `op.baseState` both move up onto it, `op.settled` goes true,
and `applyPendingOp` then returns straight after its restore. A section that
was never pulled is dropped here rather than baked in, exactly as at Done.

Afterwards the mode is still open with nothing pending. A pull then opens a
NEW section (`openExtrudeSection`, which `stackExtrudeSection` also uses) —
the rotation cannot be un-applied by re-running the extrude, so continuing
the same section is not on offer and a new one is the honest answer. This is
the Blender loop: extrude, rotate, extrude, scale.

**A settle enters the history AS IT HAPPENS**, and that is not tidiness. It
runs at the START of a drag, while the push that would record it sits at the
END of `endDirectDrag` — and the pointerdown handler throws a drag away
without ever reaching that push when a second finger arrives, which is simply
how you orbit to check your work. Between those two the section was real
geometry in no history entry at all, `confirmPendingOp` closed the mode
without pushing because it assumed the transform had already pushed, and
`scheduleAutosave` rides on `pushHistory` — so a reload lost the work. The
settle now pushes its own step when it kept anything, and `op.inHistory`
records that everything so far is committed. `confirmPendingOp` pushes only
when that flag is false, or a tap-and-abandon after a settle adds a step that
changes nothing and an Undo press that appears dead.

The flag is cleared by `setPendingAmount` whenever the amount actually
changes — the same call that sets `op.pulled`.

Two consequences worth stating plainly, because both were bugs first:
`op.selectionBefore` is re-captured at the settle (the one from before the
mode opened names arbitrary EDGES after the renumbering), and a cancel on a
settled mode says **"Extrude finished"**, not "cancelled" — nothing is taken
back, because `baseState` has moved up onto real geometry. Undo inside a
settled mode closes it and then performs a real undo; inside an unsettled one
it takes back the preview and holds `historyIndex`.

**A tap only stacks under Move.** Under Rotate or Scale it says "Switch to
Move to add a section" — with the bar reading "Rotate", a tap that quietly
extruded 0.02 obeyed neither the label nor the eye.

### Two things that look like details and are not

- **`op.baseState`** is the mesh before the mode opened and never moves;
  `op.state` walks forward with each stacked section. Cancel and one Undo
  reach back past the whole stack. **Undo INSIDE the mode cancels the
  preview** and does not touch `historyIndex` — nothing has been pushed yet,
  so stepping the index back would have taken away the edit before it.
- **`op.pulled`** is set by `setPendingAmount` only when the value actually
  CHANGES. A section never pulled is dropped at commit rather than welding a
  zero-height wall in (`edLogical` welds positions rounded to 1e-4, so a
  zero-height section is not merely invisible — it is degenerate). The flag
  is needed because the mode opens at `EXTRUDE_COMMIT_NUB` 0.02, not at zero:
  a height test alone could not tell "opened and tapped away" from "pulled to
  0.02 on purpose", and an 8px touch wobble promotes to a drag that lands on
  the amount it started from.

### What the mode must never be left open across

Anything that empties `App.selectedElements` under it, because the mode is
aimed at that selection: `setMode` and the object-list chips both commit a
live op first. `extrudeSelection` also refuses to open over a knife or any
other pending op — it would overwrite that op's snapshot and leave its
geometry applied with no bar and nothing able to take it back. A double-tap
has no separate meaning inside the mode: both taps mean what one tap means,
or a quick second tap off the model would land on the cancel gesture and
throw the whole stack away.

## Symmetry-aware ops (v1.97, completed v1.98)

With symmetry on, every component op is mirrored. **How** depends on the op,
and the difference is not a detail.

| | ops | mechanism |
|---|---|---|
| **Union** | Extrude, Inset, Bevel, Split, Crease/Uncrease, Delete | `symExpand(obj)` adds the mirror to the selection |
| **Relational** | Weld, Connect, Bridge | `runMirrored(obj, fn)` runs the op once per side |
| **Live re-run** | Loop cut | both rings cut on every slider tick |

**Union ops act on each element independently**, so adding the mirror to the
selection is the whole job.

**Relational ops act on the selection AS A GROUP** — weld melts it into one
point, connect wires its members together, bridge joins one half to the
other. Handing those the union is wrong, not merely imprecise: welding
`{A,B}` together with `{A′,B′}` collapses all four onto the plane, and
bridge’s own "exactly 2" guard fails outright on four. `runMirrored` runs
the op on the selection, then again on the mirror.

- The second pass **cannot reuse element ids** — the first pass rebuilds the
  mesh and renumbers everything — so the mirrored side is remembered as
  POSITIONS and looked up again afterwards, the same trick bevel and loop cut
  already use for their own payloads.
- `symQuietHistory` suppresses the first pass’s `pushHistory`, so **one Undo
  takes back both sides**. One Undo leaving the model lopsided would be worse
  than either state.
- A selection that is **its own mirror** runs once, not twice.

Measured: Delete on one face of a cube with symmetry on leaves **4 faces, not
5**, in one undo step. Weld on two +X corners of a split cube goes **12 → 10**
vertices, still fully symmetric, in one undo step. The same weld with a
selection sitting on the plane runs once (10 → 9), and with symmetry off
touches one side only (9 → 8).

### The original design (Extrude, Inset, Bevel — v1.97)

`symExpand(obj)` adds the mirror elements to
`App.selectedElements` in place before the op starts, so the op itself needs
no symmetry code and you can see what it is about to touch. Extrude, Inset
and Bevel run over the selection **union its mirror**, once. `symExpand(obj)` adds the mirror elements to `App.selectedElements` in place
before the op starts, so the op itself needs no symmetry code and you can see
what it is about to touch.

**Topology wants the union.** A region's rim is built from edges appearing
exactly once, so a face and its mirror that MEET at the plane share that edge
— it appears twice, no wall is built there, and **the seam problem solves
itself.** No welding, no merge threshold. An element that is its own mirror
appears once; set semantics handle that for free.

**Direction wants per-side, and only Extrude needs it.** Inset works inside
each face's own plane and Bevel is derived from the geometry, so a mirrored
selection mirrors for free. `extrudeRegionOp` does not: it summed every face
normal for one shared direction, and a symmetric set cancels the axis
components **exactly** — for two opposite faces of a cube it returned `false`
and did nothing, silently. Now, given a plane:

- `avgDir` sums the **plus side only**; a face lying on the plane contributes
  with its axis component removed.
- Each vertex gets that direction with **its axis component negated on the
  mirrored side**, and **zeroed if it sits on the plane** — a vertex that is
  its own mirror has to agree with its own image, so it can only slide along.
- Own-normals mode was already symmetric (the mirrored vertex sums the
  mirrored faces); only the on-plane case needed forcing to zero.

**`extrudeRegionOp` now walks EVERY rim loop, not just the first.** A face
and its mirror are usually nowhere near each other, and the old single-loop
walk gave the second patch no side walls at all — a hole, not an extrusion.

**One face plus its mirror does not raise the grouping chooser.** The chooser
is about a choice the user made; `picked` counts the selection before
symmetry had its say.

Measured on a cube, plane X = 0, selecting the +X face:

| | before | after |
|---|---|---|
| `extrudeRegionOp` returns | `false` (silent) | `true` |
| faces / verts / edges | 6 / 8 / 12 | 14 / 16 / 28 |
| X extent | −0.5…0.5 | **−0.9…0.9** — both nubs grew outward |

And on a cube split by an edge loop on the plane, extruding a top face plus
its mirror across the seam: 16 faces, 18 verts, 32 edges, V−E+F = 2, boundary
0, winding clean, **6 walls not 8** — no membrane at the seam. All 18
vertices still pair (6 pairs, 6 self-mirrored) with the seam at exactly
x = 0: the op left the model symmetric, which is the invariant that matters.

### Loop cut (v1.99, direction fixed v1.99a)

Loop cut fits neither family: the union would hand it two edges when it only
reads the first, and a pass after OK would mean the preview lied. It gets its
own answer, which the op bar makes cheap — **`applyPendingOp` already rebuilds
the whole mesh from a snapshot on every slider tick**, so the mirrored ring is
cut in that same re-run. One op bar, one slider, both sides live, one Undo.

**How other tools handle this, since it shaped the design:** Blender's X
Mirror and Topology Mirror apply only to interactive transforms — Loop Cut is
not mirrored, and the official answer is the Mirror modifier. Maya's Insert
Edge Loop ignores symmetry outright; Multi-Cut inserts symmetric edges but
*refuses to start a cut on the symmetry edge*, a visible guard rather than a
silent skip. Modo mirrors component operations broadly and has an axis offset
like ours — but note its Loop Slice has its own mode called "Symmetry"
meaning something unrelated (mirror the slices about the ring's own 50%
mark), so **do not reuse that word in our op bar.**

**A ring that crosses the plane is detected without walking it.** If the first
cut CONSUMED the mirrored starting edge, the two rings were one ring — a loop
cut splits every edge of the ring it crosses, so the mirrored edge is simply
not there any more. Nothing is said about it: nothing went wrong, and the
geometry is what was asked for. (A ring that cannot be FOUND is a different
matter, and `edgeLoopSelection` says so.)

**Which way the mirrored ring slides is decided PER RING, by trial.** This
was got wrong twice before it was measured properly, and both wrong answers
looked reasonable:

1. v1.99 used a global constant, `LOOPCUT_MIRROR_FLIPS`, "measured" on a
   single ring. It was right for that ring and wrong for others.
2. The obvious repair — pass the mirrored endpoints in the mirrored order —
   does nothing. `edgeLoopOp` keys its start edge with `edgeKey`, which is
   **order-independent**, and measures `t` from `a0 = lp[entry]`: the winding
   of whichever adjacent face happens to be `startGroups[0]`. Arbitrary per
   ring.

So `decideLoopCutFlip` asks the mesh instead. Cut the real ring at an
off-centre `t`, note where the loop landed, mirror that point, then cut the
mirrored ring at `t` and at `1−t` and keep whichever lands nearer. Three
trial cuts and four restores, **once when the op starts** — not per slider
tick — and the answer rides in the payload as `mflip`.

The measurement that settles it: four X-running rings on the same two-nub
cube, slider at 0.25.

| ring | flip | result |
|---|---|---|
| 20 | false | symmetric, ±0.6 |
| 21 | **true** | symmetric, ±0.8 |
| 22 | false | symmetric, ±0.6 |
| 23 | **true** | symmetric, ±0.6 |

**Two of four rings need the flip, on one model.** No constant could have
been right. (21 landing at ±0.8 rather than ±0.6 is only which end of that
ring `t` measures from — still symmetric, which is the thing that matters.)

Measured, two nubs on a cube (rings that do not cross the plane): 14 → 22
faces, 16 → 24 vertices, symmetric, winding clean, loops at **±0.6** with the
slider at 0.25. And a vertical edge on a plain cube, whose mirror is a
different edge on the SAME ring: 6 → 10 faces, 8 → 12 vertices — **one loop,
not two.**

## The symmetry plane (v1.95)

Symmetry no longer reflects about local zero. Each object carries
`mesh.userData.symPlane = {axis, offset}`, where **offset is the geometry's
bounding-box centre on that axis, in the object's local space**.

- **Bbox centre, NOT centre of mass.** A vertex centroid moves when you
  subdivide one half, so the plane would drift because you added edge loops.
- **Captured once**, at two moments only: switching Symmetry **on**, and
  changing the **axis**. Never recomputed live — the bbox centre is set by
  the extremes, so dragging a vertex outward would shift the plane mid-drag.
  With symmetry on every edit is mirrored, so the centre cannot move anyway.
  `symmetryPlane(obj, axis)` captures lazily for objects that never had one
  (loaded from a save, made later). Re-tapping Symmetry on is the escape
  hatch.
- `buildSymmetryMap` reflects `x' = 2·offset − x`; a vertex that is its own
  mirror is clamped to `offset`, not to 0.
- Both toasts name the plane when it isn't at zero, so a wrong plane is
  visible rather than silent.

Measured on a cube whose geometry was drifted +0.7 off its local origin:
**0 vertices paired before, 8 after**, plane captured at 0.7. A centred
object gets `offset = 0` and behaves exactly as it did.

## Mirror (v1.96)

**Mirror uses whichever plane symmetry is describing.** Off → the world axis
plane. On → the object's captured plane. Both arrive as one world
`THREE.Plane`, so the two stop disagreeing the way they used to (world zero
against local zero). `mirrorObject(obj, plane)` reflects with
`I − 2nnᵀ` plus `−2dn`; the axis-aligned cases fall out of it unchanged.

**If the plane CUTS the object, Mirror bisects first.** Mirroring a whole
object about a plane through its middle just lays a second copy over the
first — which is what v1.95 did, and it read as "two cubes inside each
other". Now the object is cut at the plane, the half you are **looking at**
is kept, the other is thrown away, and the mirror rebuilds it. The rim of the
cut becomes an edge loop lying exactly on the plane.

- **Camera-side, deliberately.** A destructive op needs the user to choose,
  and orbiting to the side you want costs no UI at all. The toast says it
  kept the half facing you.
- The cut face is left **OPEN**. A cap would be a wall trapped inside the
  join; the two rims weld into a closed surface instead.
- Sutherland-Hodgman on each face's boundary loop. Clipping a convex polygon
  by a half-space stays convex, so the re-fan is safe.
- Vertices the discarded half owned are **compacted away**, or they hang
  around as orphan dots in Vertex mode.
- **A plane that misses the object still mirrors the whole thing** — that is
  the mirror-an-arm-across-the-body case and it was never broken.

`combineObjectsInto`'s `dropOnPlane` takes an axis letter OR a world
`THREE.Plane`, and **clips near-plane vertices onto the plane** (same 1e-3
relative tolerance as `buildSymmetryMap`) before merging. That is what makes
the seam weld and the coplanar-face drop actually fire — it only ever deleted
faces already within 1e-4 of the plane, and nothing had put them there.

Measured, cutting the default cube through its centre: 6 faces → a 5-face
open half → **10 faces, 12 vertices, 20 edges** merged. V−E+F = 2, boundary
0, winding clean — a closed cube with an edge loop on the plane. The kept
half sits on the camera's side of the plane (+0.25 against −0.25). An object
the plane misses still yields the old two-shell mirror, 12 faces, 16
vertices.

## Winding audit (v1.94)

`auditWinding(obj)` walks every face, takes its boundary loop as the polygon
in winding order (which skips the fan diagonals a raw triangle walk trips
on) and compares each shared edge against its neighbour. **Two faces sharing
an edge agree when they traverse it in OPPOSITE directions.** It then floods
each connected shell, flipping the expected orientation across a conflicting
edge, and counts the SMALLER side of the split — "every face reversed" is
the same mesh seen inside out, not a bug.

Returns `{object, faces, edges, shells, boundary, nonManifold,
conflictEdges, reversed, ok}`.

- **`__kubik.windingAudit()`** audits every object, `(id)` one.
- Every `finishMeshEdit` runs it under `?debug=1`, logs `[winding] {...}` and
  **appends the failure to the op's own toast** rather than staying silent.
- Measured on a clean cube: 6 faces, 12 edges, all zeros. With one face's
  triangles deliberately reversed: `conflictEdges 4, reversed 1, ok false`.
  Verified against a broken mesh, not just a good one.

## Testing loop

Node is installed (portable, no installer) at
`%USERPROFILE%\Tools\node-v24.19.0-win-x64`. `_verify.py` uses it.

**Before every ship:** `python _verify.py index.html` → runs `node --check`
on the extracted script AND scans for duplicate top-level declarations.
Prints `PASS` or `DO NOT SHIP`. Verified against a deliberately broken copy,
not just a good one.

**Driving the app end to end:** `python -m http.server 8765` in the repo,
then Chrome loads `http://localhost:8765/_test.html?debug=1` (`_test.html`
is a gitignored scratch copy, so testing never disturbs `index.html`).
Synthetic PointerEvents dispatched into the canvas exercise taps, holds and
drags; `window.__kubik` exposes `App`, `camera`, `orbit`, `camAnim`,
`vertexSpacing()` and helpers. This has caught several real bugs before they
were pushed and produced the vertex spacing table above.

**Three harnesses now, all untracked, all the same shape** - append a plain
`<script>` to a COPY of index.html, serve the folder on 127.0.0.1, run
headless Chrome from a PYTHON subprocess with a fresh `--user-data-dir`:

- `_probe.py` + `_probe_js.js` - the shape-mask suite. `--dump-dom` for
  numbers, `canvas.toDataURL()` into the DOM for pictures. It builds the
  shapes whose answers are known in advance: a fold, an L-shape, 8- and
  12-sided tubes, and the **pan** - a plate with a shallow square recess,
  which is the shape every cavity bug has needed.
- `_helpshot.py` - UI work. Opens the help card, optionally clicks one
  section open, and takes a real `--screenshot` at
  `--force-device-scale-factor=2` in a 430x860 window.
- `_chk.py` - the one-off. A dozen lines that assert a handful of facts and
  dump them. Use it after a REMOVAL: it is what proved a vertex pick leaves
  the camera at 0.0000 once Aim assist was gone.

**And when a bug is on the USER'S model, ask for the file.** a2.29e was
found by reimplementing `applyShading`'s wear-edge pass in Python and
running it over `kubikTank.json` - no browser, no transfer to the PC. That
killed the winding hypothesis in one run (zero reversed triangles in all
nine objects) and located the real cause. The threshold that fixed it was
then chosen by ray-tracing real ambient occlusion at every painted pixel.
**One round trip for a file buys certainty that hours of synthetic shapes
will not.**

**Verify generated assets end to end.** The help card's QR is checked twice:
its matrix against segno's own, and OpenCV decoding the URL back out of the
rendered screenshot. A QR that does not scan is worse than no QR.

Three traps, all of which cost real time:

- **A backgrounded tab freezes CSS transitions and clamps `setTimeout` to
  ~1s.** A transitioned property reads its START value forever, so
  `getComputedStyle` lied about a slider knob for several rounds, and
  hold-vs-tap timing cannot be told apart. **Check `document.hidden` FIRST.**
- **A desktop check CANNOT see a safe-area bug.** `env(safe-area-inset-*)`
  is 0 in a desktop browser, so anything that mishandles it measures as
  perfect. The hub button's double inset shipped twice this way, and both
  times the numbers said the row was aligned. To test it, override the
  `--edge-*` custom properties with a simulated inset (34px is about an
  iPhone home indicator) and re-measure. That reproduced a -34px centre gap
  in one call, after two rounds of failing to find it by looking.
- **A cached `_test.html` will happily answer questions about the PREVIOUS
  build.** Add a changing query string. One measurement run here was scored
  against the old file before that was spotted.
- **Anything that scrolls must be named in the `touchmove` allow-list.**
  That handler cancels touchmove everywhere else to stop the page moving
  under the app, so an unlisted scrollable is unreachable by finger while
  working perfectly with a mouse wheel. The Help card shipped this way.
- **The ring's hold timer runs off the rAF loop, which a hidden tab stops
  DEAD** - not clamped, stopped. Pressing and waiting longer does not help;
  the ring never blooms at all. `__kubik` exposes `bloomToolRing`,
  `updateToolRingHover`, `closeToolRing` and `HUB_TOOLS_WORLD` so a harness
  can drive the ring directly and skip the question.
- **Synthetic pointer events make OrbitControls throw** `setPointerCapture:
  No active pointer`. Harmless and unreachable with a real finger — filter
  the console by stack, not by count.
- **Dispatching straight onto the canvas bypasses hit-testing**, so it
  cannot reproduce a bug where another element steals the event. Use
  `document.elementFromPoint` to check what is really on top.

## What to build next

**The whole of the previous list has shipped**, v1.94 through v1.97: the
extrude grouping default, the winding audit, the symmetry plane, Mirror, and
symmetry-aware ops. Each has its own section above; nothing here is pending.

**2.0 is being held back deliberately.** Zeghreit is saving the number for a
release that is "alive and flawless" — everything already present working
smoothly, nothing sticking, nothing silently failing. That is why v1.99 has
run to eleven letters rather than becoming 2.0. Do not bump the major
version without being asked.

### The pre-2.0 list, as agreed with Zeghreit

Gathered over several sessions and written down because it is more than
anyone can hold in their head. Roughly in the order it was decided, NOT in
priority order — ask before assuming which comes first.

**1. Two missing ops, both called essential.**

- ~~**Cap / fill hole.**~~ **SHIPPED at a2.0** — see "Cap holes" above,
  including the two ways it was wrong first.
- **Hand cut (knife).** Tap-drag along an edge to drop a start point, then
  the next, and so on; OK applies the cut. **This is the largest single item
  on the list and it introduces a new INTERACTION CLASS** — every op today
  is select-then-run or select-then-slider, and nothing builds a multi-tap
  path with its own pending state. The geometry is less frightening than the
  interaction: it decomposes into "split an edge at an arbitrary t" (today
  `splitEdgeAt` only splits at the midpoint) plus `connectVerticesOp`, which
  already joins two vertices sharing a face by splitting that face. Design
  this before building it.

**2. Reachability — working code with no way in on a phone.**

- `clearAllCreases`: zero callers anywhere.
- `growSelection` / `shrinkSelection`: keyboard `]` and `[` ONLY, and a
  phone has no keyboard. They belong in the component rings; the vertex
  ring has three items and room to spare. STILL OPEN after a2.1 — the
  drawer was the wrong home for them, so they were left alone.
- ~~`subdivideSelection('keep')`~~ and ~~Grow/Shrink~~ **SHIPPED at a2.2** —
  see "Subdivide, and reachability" above. `clearAllCreases` shipped at a2.1
  in the drawer. All three reachability gaps are closed.

**3. ~~The drawer, rearranged.~~ SHIPPED at a2.1** — see "The drawer"
above. What it fixed, for the record:

- Two notes LIE. "Grid, Aim assist and Snap moved under the axis cube" —
  they are in the world ring. "Turn symmetry on with the button under the
  axis cube" — that pill moved to the TOP-LEFT at v1.99d.
- **"Gizmo speed"** names a gizmo that was removed at v1.57 and sits in the
  do-not-rebuild list. It is the drag-speed multiplier (`App.sensitivity`).
- **Two buttons both say "Save"** — Models→Save writes to browser storage,
  File→Save downloads a `.json`. Rename the second to Download.
- Colour is filed under "Precision", where it has no business being.
- ~~"View" is a section header wrapping a single Theme button.~~ Moot:
  the Theme button is gone (a2.57a).

New settings to add, all of which are hard-coded constants today:

- **Snap step.** `SNAP_MOVE` 0.25, `SNAP_ROTATE` 15°, `SNAP_SCALE` 0.1 —
  the toggle is in the world ring but the amounts cannot be changed.
- **Fillet settings, matching Bevel's.** Bevel already offers Flat / Round,
  a width slider and segments. Fillet has `App.filletRadius = 0.04` and
  `FILLET_ANGLE` with NO UI at all — it is on or off. Give it the same
  profile and width controls so the two read as the same idea.
- **Clear creases**, which is rare cleanup and belongs here rather than in
  a ring.
- **Start over** — NOT built. There is still no way to clear the scene short
  of deleting objects one at a time. Flagged as Zeghreit's call because it is
  destructive, and he has not said either way. Ask before adding it.

Proposed sections: **Model** (object list, Start over) · **Appearance**
(Theme, Colour) · **Editing** (Values, Drag speed, Symmetry axis, Snap step,
Fillet, Clear creases) · **Models** (unchanged) · **Files** (Download/Open
plus the three exports).

Open question: Symmetry AXIS lives in the drawer while the Symmetry SWITCH
is now top-left. Two halves of one control in opposite corners.

**3b. After the drawer, but before icons — materials.** Zeghreit wants the
material settings reworked and moved into **their own drawer on the RIGHT
side**, mirroring the tools drawer on the left. Explicitly scheduled after
everything else already planned, so do not start it early. Note today's
material controls are split across three places: the Colour picker in the
drawer, the Material tool in the object ring (which cycles finish), and
Shade in three separate rings.

**4. Icons and design polish.** Zeghreit has feedback that the icons are
confusing and wants every icon to reflect its function. A brainstorm and
some research were agreed for this, deliberately AFTER the tool set stops
moving — no point drawing icons for a ring that is still changing.

**5. Still open from before, not yet scheduled:**

- ~~**Acknowledging the moment an op lands.**~~ **HALF DONE at a2.31** —
  Extrude now opens a mode you are visibly inside of, and the height is a
  drag rather than a thing that already happened. See "Extrude is a MODE"
  above. Every OTHER immediate op — weld, merge, cap, flip, crease, dissolve
  — still just happens with a toast, so the gap is narrower, not closed.
- **More primitives** — cylinder, sphere, plane, from the original v1 spec.
  A DESIGN question, not three constructor calls: Add Cube owns a pole of
  the world ring alone as the one item that makes rather than toggles, and
  four add-items would wreck that. Probably a hold on Add to pick a shape.
- **The `|| mirrored` DoubleSide clause.** Now that Flip and Mirror-Apart
  bake instead of scaling, find out whether anything still needs it. If not,
  picking and rendering agree everywhere with no special case left.
- **The object ring is getting full** — ten items plus Join, and it has not
  been judged by thumb since Flip and Separate joined it.


## Help (v1.99b, folded at a2.30)

Twelve sections, built from `HELP_QUICKSTART` and `HELP_SECTIONS` and
rendered with the same `icon()` calls the real buttons use, so the glyphs
cannot drift from the app: Quick start, Getting around, Selecting, Move /
rotate / scale, The two rings, Shaping, Whole objects, Surface, Symmetry and
Mirror, The drawer, Keeping your work, Open on your phone.

**Every section is a `<details>`, and the closed state IS the table of
contents.** Before a2.30 it was one 60-row scroll - correct, and unusable on
a phone: finding "what does Bridge do" meant a thumb hunt past everything
else. Only one section opens at a time and the one you open is scrolled to
the top, under a title bar that is now `position: sticky` so the close
button never leaves the screen.

Three things that had to be got right and are easy to get wrong again:

- **The exclusive-open handler hangs off the SUMMARY's click, not off
  `toggle`.** Chrome fires `toggle` for a `<details open>` that arrives with
  `innerHTML` too, and that phantom event scrolled the card by exactly the
  height of its own title bar - so Help opened with its heading and close
  button already gone off the top. A click is a tap and nothing else. The
  open flag flips after the handler returns, hence the `setTimeout(0)`.
- **The scroll subtracts the sticky bar's height**, or the section you tapped
  lands underneath it.
- **The name is the first words of its own line**, not a column. A 96px term
  column on a 360px card left about 28 characters for the description, so
  nearly every row wrapped to three lines.

**Rows say what the thing DOES, in one line.** Anything that needed a
paragraph was saying too much for a reference card. The card this replaced
had gone stale besides, still offering "Smart camera framing" for an icon
that has meant Aim assist since v1.87 - and it drew a blank gutter for
Shade, whose ring icon is a FUNCTION (`flat` or `smooth`, whichever it will
switch you to) so the key `shade` has never existed in the icon table.

**Open on your phone** is last, and closes with a QR code for the live URL.
It is a `<path>` of module runs generated from segno at patch time and
pasted in - no library, no network, and it works from a `file://` URL like
everything else here. Verified end to end: the matrix is compared against
segno's own, and OpenCV decodes the string back out of the rendered
screenshot.

## The drawer (a2.1)

Six sections: **Scene** (object list) · **Appearance** (two notes; the
Theme button went with Daylight at a2.57a, and Colour is in the material
tray) ·
**Editing** (Values, Clear creases, Drag speed, Symmetry axis) · **Snap
amounts** · **Models** · **Files**. (Fillet was the seventh until a2.50.)

Its job is unchanged: things set once or used rarely, reachable with the
other hand without crowding the viewport. Tools stay in the rings.

What the rearrangement fixed, three of which were plain errors rather than
taste:

- **Two notes sent you to the wrong corner.** One said Grid, Aim assist and
  Snap were "under the axis cube" — they are in the world ring. The other
  said to switch symmetry on there too; that pill moved to the top-left at
  v1.99d.
- **"Gizmo speed" named a gizmo that was removed at v1.57** and sits in the
  do-not-rebuild list. It is the drag-speed multiplier, and says so now.
- **Two buttons both said "Save"** — one writing to browser storage, one
  downloading a file. Files now says **Download .json** and **Open .json**,
  so exactly one control in the drawer is called Save.
- Colour moved out of "Precision", which is now Editing.

**Snap amounts stopped being constants.** They were fixed values with a
toggle and no way to change them. `App.snapMove`, `App.snapRotate` (held in
DEGREES, converted where used) and `App.snapScale` replace the old module
constants. Fillet got matching profile/width/segment settings in the same
pass; all of that went at a2.50 with the feature.

**The drawer is now tall enough to need scrolling on a phone.** It works
because `.drawer-body` is `overflow-y: auto` AND `#drawer` is named in the
touchmove allow-list. Anything added here must keep both true — an unlisted
scrollable works with a mouse wheel and is dead to a finger.

## Subdivide, and reachability (a2.2)

**Subdivide is a live op now**, not an immediate commit. It opens the op bar
with a **Smooth / Keep shape** chooser and a **count**, and re-runs from the
snapshot on every change — so the stepper is a PREVIEW of the finished
result rather than a number you apply blind.

- `noAmount` on the spec hides the slider outright, the way loop cut hides
  it in Even mode. There is no amount here; the stepper counts LEVELS.
- **Capped at 4** via `maxSegments`. Each level multiplies faces by four, so
  a cube runs 6 → 24 → 96 → 384, and the shared default of 10 would be
  unusable on a phone.
- Pending ops were built around ONE object. Object-mode ops act on the whole
  selection, so a spec marked `multi` also snapshots every selected object
  into `op.multi`, and both apply and cancel walk that list. Component ops
  keep the single `state` and never look at it.

Both modes were always implemented; `keep` simply had nothing calling it.
Measured on a cube — they are genuinely different, which was worth checking
rather than assuming: `keep` holds the silhouette at exactly 1.0 at every
level, `smooth` rounds it to 0.8785 by level 2, and the summed positions
differ from level 1 (68 against 96).

**Grow and Shrink were put in all three component rings** (they had been
reachable only from the keyboard keys `]` and `[`, which is to say not at all
on the phone this app is built for). **They left the rings again at a2.51** —
see "Grow and Shrink become a gesture" below.

**Still wanted, not built:** a non-destructive *smooth preview* - a
display-only smooth you can leave switched on while modelling, changing what
you see and not the mesh. The op-bar preview above is a preview of the real
result, which is a different thing. (The rounded-edges preview used to be
the working example of this shape of feature; see a2.50 for why it went.)

## Delete, and what dissolve means (a2.5)

**Face delete cuts. Vertex and edge delete DISSOLVE.** Deleting an edge used
to delete both faces touching it, and deleting a vertex deleted the whole fan
around it — a hole where the user asked for one fewer edge. Now the faces
close over what was removed. Face delete is unchanged, because that is the
tool for making a hole.

**The trick is that a face is a GROUP of triangles.** `computeTopology` only
exposes an edge when some face uses it exactly once, so dissolving an edge is
not a geometric operation at all: concatenate the two groups' triangles into
one group and the edge stops being on any outline, which is to say it stops
existing. No retriangulation, no new vertices, not one position touched. A
vertex needs one more step, because merging its fan leaves it sitting INSIDE
the merged face, still drawn and still selectable — so that face is rebuilt
from its own outline, which no longer mentions the corner.

**Merged corners must be welded first.** `separateGroupVertices` gives every
face private copies of its corners, so two faces meeting along an edge hold
four different attribute indices for its two ends. Concatenate without
welding and the shared edge never cancels: the outline comes back a figure of
eight and the winding audit reports two new open edges. Measured on the first
run — dissolve one edge of a cube, boundary 0 → 2, and the safety check
correctly threw the whole edit away.

**The edge-exposure rule was wrong and dissolve found it.** It used to read
"internal iff exactly two occurrences in exactly one group". That misses a
line that is an internal diagonal of TWO neighbouring faces at once — four
occurrences, no face using it singly — which is routine as soon as an n-gon
is retriangulated. Four of a cube's eight corners came back with phantom
edges and Euler 0 or 1. The rule is now "exposed iff some group uses it
exactly once", which also makes `topo.edges` agree with `groupsByEdge`.

**Three guards, all of which have fired:** a merge that would leave a face
with no outline at all is refused before anything is rebuilt (dissolve all 12
edges of a cube → 1 face, 0 edges, and no way back but Undo); a face whose
outline is not one closed loop aborts the whole vertex op rather than
committing half of it; and the open-edge count is compared before and after,
restoring a snapshot if it grew. The second one matters because merging faces
does not change the open-edge count, so the audit cannot see a half-edit.

**A free tap chooses its type by DISTANCE, not by rank (a2.6a).** Vertex
used to be tried first at the full 28px, so any vertex within 28px beat an
edge the finger was sitting exactly on — and on a mesh with real detail there
is always one. A vertex still wins ties and near-ties (`VERT_TIE_PX`), because
a vertex sits ON its edges: aim at a corner and both distances are ~0, so the
more specific thing should win; aim at the middle of an edge and the nearest
vertex is half the spacing away while the edge is at zero.

Measured on a 386-vertex cube, tapping dead centre of a visible edge in Edge
mode, before → after:

| median vertex spacing | before | after |
|---|---|---|
| 8.9 px | 0 / 388 | 164 / 388 |
| 17.9 px | 99 / 356 | 309 / 356 |
| 30.2 px | 209 / 316 | 301 / 316 |
| 50.7 px | 224 / 254 | 241 / 254 |

Every earlier miss came back as a vertex. Vertices did not regress (98–100%
at every zoom), a plain cube is 27/27 edges and 7/7 vertices from either
mode, and with ±8px of thumb jitter edges run 59% / 88% / 94% at those three
spacings. Below ~20px spacing the targets are genuinely smaller than a thumb;
that is what pinch-zoom is for.

**The edge catch zone IS aligned with the drawn edge** — this was checked
directly, not assumed: on a sparse mesh, taps placed exactly on the line hit
that edge 45/45 at every point along it. The old failure was never
misalignment, it was the type order.

**Dissolving edges takes the run's INTERIOR vertices with it (a2.5a).**
Leaving them behind is only half the job — they sit on the merged face doing
nothing, still drawn and still selectable, and a dissolved edge loop leaves a
whole ring of them. Interior means "used by two or more of the dissolved
edges". The two ENDS of a partial run are used by one and they stay: they are
still junctions of edges that survive. A closed loop has no ends, so all of it
goes. Measured: loop-cut a cube (12v/20e/10f), dissolve the whole ring of 4 →
back to a clean 8/12/6 with every mid vertex gone; dissolve 3 of the 4 →
10v/15e/7f with exactly the two ends left; dissolve one edge → both ends stay.

**Only what was actually dissolved is filtered out.** Vertices reported as
skipped must not be dropped from the outlines of the faces being rebuilt —
select an interior vertex and a lone corner together and the corner was being
removed while the toast said "skipped 1".

Verified on a cube: any one of 12 edges → 8v/11e/5f, any one of 8 vertices →
7v/9e/4f, every one identical, Euler 2 and closed throughout.

## The knife (a2.6)

**Hand-cut geometry.** Pick Knife from the Edge or Face ring, press-slide-lift
to place each point, OK to cut. A point snaps to a VERTEX within 16px, else
slides along an EDGE, else sits anywhere on a FACE. Green dots are the points,
the yellow line is the cut. Back pops the last point, Cancel drops the lot.

**Nothing touches geometry until OK**, which is why the knife is NOT a
pendingOp: there is nothing to re-run from a snapshot. Points are stored as
LOCAL POSITIONS, not indices, so they survive anything that renumbers.

**A cut is an outline split.** A face is a patch with an outline and an edge
only exists where a face uses it once, so cutting a face means splitting its
outline in two where the cut enters and leaves, and giving each half its own
face. Points inside the face join both halves, which is how they end up ON
the new edge instead of floating.

**Which is why a cut cannot END inside a face.** A slit that does not reach
the far side would need an edge with the same face on both sides, and this
mesh cannot express that. Such a run is skipped and said so. ONE CUT PER FACE
per operation, for the same don't-guess reason: a chain re-entering a face
would need aiming at whichever half it landed in.

**Splitting a RIM edge legitimately adds one open edge**, and the
before/after open-edge guard has to know that or it reverts every honest cut
on a face touching a hole - which made the knife useless on any open sheet.
`applyKnifeOp` counts those splits from the outlines BEFORE the splice and
returns `rimSplits`; the guard allows exactly that many.

**The knife owns one pointer.** It takes orbit on every press and hands it
back in `cancelKnife` and `applyKnife` rather than in the pointer handlers -
a press that ends off-canvas never sees a pointerup, and that left the camera
dead for the rest of the session. Lifting the first of two fingers does NOT
place a point: orbiting mid-cut is the normal thing to do, and the old code
committed a point aimed where that finger first landed.

**`pushHistory` and `restoreDoc` abandon a cut in progress.** Both move the
ground the points were aimed at, and the bar is DOM, so Undo is reachable the
whole time a cut is being placed.

Verified on a cube: edge to edge across one face 8/12/6 → 10/15/7; edge to
face-interior to edge → 11/16/7 with the interior point a real vertex on the
cut; a chain across two faces → 11/17/8, "Cut 2 faces"; corner to edge →
9/14/7. Euler 2 and closed throughout, Undo restores.

## Bridge in sections (a2.7)

**Bridge is a live op now**, with a section stepper and a Straight/Curved
choice, and every change re-runs it from the snapshot. One section is the old
single band of quads; more sections insert that many rings in between.
STRAIGHT interpolates each pair of matching corners along a line. CURVED
leaves each end the way that end was already going and eases into the other —
a Hermite whose tangents are the ends' own outward directions. Two faces
pointing AT each other come out straight either way, because their tangents
already run along the join; the curve only shows when the ends disagree,
which is when you asked for it. `minSegments: 2` on the Curved option keeps
it off the bar until there is something between the ends to bend, and
`stepSegments` falls the mode back when it goes away.

For an edge-run bridge the "outward direction" is NOT the surface normal —
that points off the sheet, and a bridge leaving an open rim straight upward
continues nothing. It is the direction that lies IN the neighbouring face and
points away from it, so the normal component is projected back out.

**The pairing and the wall winding are ONE decision (a2.7a).** There are
exactly two consistent ways to wall a tube, and choosing one fixes the other:

    FORM 1  walls [a0, a1, b1, b0], A forwards, B BACKWARDS
    FORM 2  walls [a0, b0, b1, a1], A BACKWARDS, B forwards

A wall stands in for a face being deleted, so it must traverse that face's
outline the way the face did, or it disagrees with the side faces still using
those edges. Form 1 is right when the faces LOOK AT each other, form 2 when
they point the SAME way. a2.7 got half of it — it chose the pairing from the
normals and left the walls in form 1, so same-facing bridges came out with 5
reversed faces and 4 conflicting edges. That was the "bridge flips normals"
report. There is also no per-quad "point it away from the tube axis" test any
more: it guessed outwardness from a made-up axis, said nothing at all when
the band was flat, and was free to flip single quads out of agreement with
their neighbours.

**An EDGE-run bridge takes its winding from the rim too (a2.7c).** Two faces
sharing an edge traverse it in opposite directions - that is what makes them
agree - so a strip laid along a rim has to run against the face on the other
side of it. `bridgeEdgesOp` had no such rule at all: it wound every quad the
same way regardless, so whether a bridge came out facing the right way
depended on which end of the chain the walk started from. The bug report is
the proof, and it is a good one: two mirrored cubes, the same two-edge
bridge, correct on one side and inside out on the other - the mirror runs its
rim the other way round, so one fixed winding opposed one face and agreed
with the other.

TWO knobs, and both are needed. Flipping the quad fixes the A end but flips
the B end with it; reversing B's chain then fixes B without disturbing A.
Measured with only the first: two of four mirrored edge pairs still came back
with 5 reversed faces. With both: all four clean.

**An order-reversing pairing is forced, so the connectors look crossed, and
that is fine** — a tube is allowed to be an arch. What is NOT fine is the
rotation where two connectors run head-on and share a midpoint, because a
ring landing exactly there welds two corners and goes non-manifold.
`chooseRingOffset` refuses such a rotation; when every rotation does it (two
coplanar tops), `bridgeRings` nudges that one ring a thousandth off the
meeting point instead. Measured: with neither guard, every EVEN section count
on two box tops came back non-manifold.

**Bridging two faces that point the same way can still fold through itself**
at some section counts — the geometry has no better answer, so the op bar
says `Bridge · folds over` while it does, live, with the count under your
thumb. Faces that look at each other, the ordinary case, are clean at every
count in both modes.

**Ring pairing direction comes from the two faces' NORMALS, not from
distance.** Each face is wound about its own outward normal, so two faces
looking at each other wind oppositely in space and B must be reversed; two
faces pointing the same way must not be. The old code reversed
unconditionally, which on the same-way case paired every corner with the one
diagonally opposite: the walls crossed and every ring in between collapsed
onto the twist. Measured — two box tops bridged in two sections gave 2 new
vertices where there should have been 4, and the winding audit was perfectly
happy, because a twisted tube is still closed. One band hid it; sections made
it plain. Bearing around the joining axis cannot decide it either: for two
coplanar tops the axis lies IN both faces and all four corners collapse onto
two bearings. Distance is still fine for the ROTATION, which is a choice
among same-handed pairings and has a clear minimum.

**Symmetry no longer goes through `runMirrored`.** The mirrored elements are
captured with `markElements` when the op begins and re-found with
`resolveElements` inside every re-run, after the primary pass has renumbered
the mesh — so the bar previews both sides while you change the count, and
`confirmPendingOp` pushes ONE undo entry covering both (which is what
`symQuietHistory` used to fake). Both the "no pairs here" and the "could not
find the mirrored side" answers still have to be said out loud; a silent
half-symmetric result is indistinguishable from symmetry being off.

Verified: sections 1–12 on faces and edges, both modes, watertight and Euler
2 every time; the curve lifts the middle rings to 1.1 and 1.3 above two box
tops at 0.5 while Straight keeps them flat; symmetry bridges both pairs in
one re-run (4 cubes, Euler 8 → 4).

## Open threads

- **Moving the pivot / re-origining an object.** Deferred. Capturing the
  symmetry plane from geometry buys most of what it would have.
- New cubes should spawn at world centre even if they overlap. Currently
  they offset in a grid pattern.
- Gesture-driven modelling tools (extrude on two-finger tap, etc.).
- `_verify.py` is gitignored, matching the `_`-prefix convention, so it
  lives on one machine only. Consider committing it. Note it CANNOT catch an
  undefined reference — a name that does not exist passes `node --check` and
  throws at runtime. Grep for any identifier you introduce.
- The op sweep and the picking harness that produced the numbers above live
  only in a browser console. Turning them into a committed self-test is the
  obvious way to make "flawless" checkable rather than hoped for.
- ~~**Masks added to a PRESET material do not survive a project file.**~~
  **NOT TRUE, retested at a2.65a.** Measured twice - once by hand in the live
  app with a real reload and a cleared localStorage, once by `_mat_probe`,
  which now guards it. A mask put on Metal is written into the JSON, and
  opening that file in a library that has never seen it brings the mask back
  as **"Metal (imported)"**, with every face repointed onto it. Nothing is
  dropped, and the preset stays plain, which is the policy the note said
  nobody had chosen: **import under a new id**, decided by the code.
  What made it true once and false now is `materialDefSig` learning to
  include `masks` - the file's masked Metal stopped matching the local plain
  one, so the import path adopted it instead of recognising it. The note was
  never re-measured after that.
- **Normals from the masks** is the agreed next feature - a cloth mask is a
  greyscale field and a normal is its slope, so every noise type already
  built becomes a bump for free, as a third checkbox beside Colour and
  Roughness. Triplanar, so the no-UV policy survives.
- ~~**`material.envMapIntensity` has been inert**~~ **- RETIRED at a2.65a.**
  The note was right; the reason it gave was not, and the mechanism matters
  because it decides the fix. three does not "overwrite" the value: in r184
  a material's `envMapIntensity` applies **only when the material owns an
  `envMap`**. The environment here is `scene.environment`, scaled by
  `scene.environmentIntensity` alone, and nothing in the file ever assigns
  `material.envMap` - so the per-material value could never have applied.
  Measured in the live app with a forced render: 6 -> 0.05 on a metal cube is
  pixel-identical; `scene.environmentIntensity` 1 -> 8 is plainly different;
  the same 0.05 **with `mat.envMap` bound** crushes the cube to black.

  It was never exposed in the UI either - no slider, no readout - so "drop it
  or make it multiply" was a smaller choice than it looked. Making it
  multiply would have meant binding `scene.environment` per material and
  would have changed how every existing model looks, because the presets were
  written around it (Solid 0.5, Plastic 0.7, Metal 1.0) and none of that had
  ever reached the screen. Dropped.

  The one thing it really did was ride in `materialDefSig`, where a number
  with no effect could make two identical materials read as two and mint a
  spurious "(imported)" copy. Removing it from the signature **changed the
  signature's format**, which is the part that needed care: `srcSig` is a
  stored signature string, persisted into localStorage and into every saved
  file, so every material imported before a2.65a holds a string the current
  code can no longer produce. Left alone, each would have minted one more
  copy of itself on the next open - the exact failure `srcSig` exists to
  prevent. `migrateSig()` strips the retired key from a stored signature and
  restates it, on every path a signature arrives by, and heals it in place so
  the library stops being in the old format. Guarded by `_mat_probe`
  section 5. **Any future change to the signature has to do the same.**
- **`_mat_probe` (suite 23, a2.65a)** is the material library across a file:
  a mask on a preset reaching the JSON, coming back into a library that has
  never seen it, the preset left alone, faces repointed, reopening the same
  file minting nothing, the retired field gone from definitions / signature /
  file, and a pre-a2.65a signature still matching. It exists because a note
  in this file was believed for a year without being retested.

  Its first run reported the app losing a mask it had never been given:
  `serializeDoc`'s `materialLib` is `Array.from(MATERIALS.values())
  .map(normaliseDefMasks)`, and `normaliseDefMasks` returns its ARGUMENT when
  `masks` is already an array - so the "file" aliases the live definitions,
  and clearing the local mask emptied the file too. Harmless in the app,
  where a save stringifies immediately; fatal to any test that holds a doc
  and then edits state. **Deep-copy a serialised doc before touching
  anything.**
- Two probe lines are known to FLAKE, and neither is a regression:
  `_perf_out` `slider_coalescing` (the middle number, a race on whether the
  scheduled apply flushed before the probe looked) and `_theme_out`
  `8.palette` (26 vs 28 tones off the view cube's SwiftShader canvas). Re-run
  three times before believing either.
- Unmeasured on a phone: the environment's full-float DataTexture
  (`OES_texture_float_linear` is missing on many mobile GPUs), the atlas's
  two-tap slice interpolation, and the four extra field fetches a2.29c and
  a2.29e added per pixel.
