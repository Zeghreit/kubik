# Kubik — current state

Single-file browser 3D low-poly mesh editor. "A fidget for 3D artists":
relaxing, one-handed, mobile-first. three.js from CDN, no build step.

- Live: https://zeghreit.github.io/kubik/
- Repo: `C:\Users\a.bodrov\Projects\kubik` (index.html is ~7900 lines)
- Version at time of writing: **v1.99k**
- Debug: append `?debug=1`. Tap picks log a `[pick] ...` line explaining why
  a tap resolved as it did, every mesh edit logs a `[winding] ...` line (see
  Winding audit), and `window.__kubik` exposes the live app (see Testing
  loop).

This file describes the app AS IT IS, not how it got here. Version numbers
appear only where they explain why something is the way it is. It was
rewritten at v1.93 because it had accumulated per-version sediment and had
begun contradicting itself — a handoff that argues with itself is worse
than none. Prefer rewriting a section over appending to it.

## Versioning

**Numbers for new work or reworks** (v1.85 → v1.86). **Letters for bug
fixes** (v1.85 → v1.85a → v1.85b). A change is a letter unless it lets the
app do something it could not do before. Fixing three broken things is
still a letter — this was got wrong once, at v1.86, which should have been
v1.85d.

## Screen layout

- **Top-left** hamburger → drawer. **Top-centre** tool/mode readout.
  **Top-right** view cube.
- **Top-left, under the drawer button**: the Symmetry pill, a horizontal
  two-state switch. It hung under the view cube until v1.99d, which left
  the top-left empty and the top-right crowded - the cube is a 128px
  object with its own presence, and a pill beneath it read as part of
  the cube rather than as its own control.
- **Bottom-left**: the round Object/Component button.
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
  through, Floor grid, Aim assist, Snap, Add Cube and Tap/Box/Lasso select
  all live in the world ring.

## Controls

**Transforms have no gizmo.** You grab whatever is selected and drag it. The
same drag moves, rotates or scales depending on the active tool.

- Two-finger tap on empty space cycles Move / Rotate / Scale.
- Three-finger tap switches Free / Axis. **Axis is the default** as of
  v1.99d: a drag along one named axis is what is wanted almost every time
  something is moved deliberately, and Free is one tap away. Not persisted
  by save/load, so every session opens in Axis.
- In Axis mode the axis is decided once from the first ~15px of the drag and
  held until you lift; re-deciding mid-drag made curving gestures wander.
- Free rotation takes its axis from the swipe direction, locked at the start.
- Free scale reads the projected axes, so depth is reachable without a
  dedicated gesture; a drag matching no axis scales uniformly.

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

**Object / Component** is the round button, bottom-left. It shows the mode
you are in and cycles on tap. (A two-position edge slider was tried at v1.89
and reverted at v1.92.)

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

**The type lock.** Once something is selected, only that component type can
be picked until you tap empty space. It removes catch-zone ambiguity by
construction — and it must NEVER be silent. A refused tap used to hit
neither branch of `handleTap` (the object under the finger IS the active
object, so nothing to switch to; not empty space, so nothing to clear) and
simply evaporated. It now probes what was actually under the finger and
says so.

**Back-facing components are rejected by face normal**, so picking agrees
with back-face culling. Mirrored (negative-determinant) objects are
sign-corrected.

**Aim assist.** After a vertex or edge tap, if the nearest visible neighbour
is closer than `AIM_CROWD_PX`, the camera eases in (380ms) until neighbours
sit around `AIM_ROOMY_PX` apart, bringing the pick 70% of the way to centre.
It runs AFTER the pick, so it can only make the NEXT tap easier and never
changes what the tap just selected.

The thresholds are **multiples of the catch radius** (2× and 4×), because
that is what they are about: two vertices are tellable apart when the gap
exceeds the target you aim with. A flat 30px was tried and may as well not
have existed — measured on a unit cube, minimum vertex spacing is 85px at
the default framing, 61px at camera distance 12, 42px at 18, 30px at 26. A
30px trigger only fired once the cube was a speck.

Bounded so it cannot run away: one nudge per 700ms, never more than 3×
closer per move, and a distance floor of 1.2.

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
- **Smart camera.** Drifted the view to a three-quarter angle after every
  selection. It answered a question nobody was asking, and being moved for
  no visible reason is worse than a slightly imperfect view. Tagged
  `v1.87-smartcam`.
- **The edge rails.** Five buttons down the viewport sides, now in the world
  ring.

## Hard-won lessons

- **Measure, don't reason.** Every layout, geometry and picking bug in this
  project was found by running numbers or reading a screenshot, and missed
  by reasoning about the code. This is the single most reliable rule here.
- **Ask what "broken" looks like before writing code.** "Nothing happens at
  all" versus "picks the wrong thing" are different bugs with different
  causes. Three plausible fixes were shipped for a selection complaint
  before the symptom was named; naming it found the cause in one read.
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
  Mirror is handled (negative-determinant flip in `combineObjectsInto`);
  **extrude, bridge and subdivide are still unmeasured** — but no longer
  invisible: run the op under `?debug=1` and read the `[winding]` line.
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
were pushed and produced the aim-assist spacing table above.

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

**Next, pick one:**

- **Acknowledging the moment an op lands.** An extrude just happens, with no
  feedback. For something whose identity is a fidget this is the largest
  remaining gap, and it is half of what "alive" was meant to mean.
- **More primitives** — cylinder, sphere, plane. Still in the original v1
  spec and never built. Note this is a DESIGN question, not three
  constructor calls: Add Cube owns a pole of the world ring alone, as the
  one item that makes rather than toggles, and four add-items would wreck
  that. Probably a hold on Add to choose the shape.
- **The `|| mirrored` DoubleSide clause.** Now that Flip and Mirror-Apart
  bake instead of scaling, work out whether anything still needs it. If not,
  picking and rendering would agree everywhere with no special case left.
- **The object ring is getting full** — ten items plus Join. It has not been
  judged on a phone since Flip and Separate joined it.

## Help (v1.99b)

Quick start, then a glossary grouped by task: Getting around, Selecting,
Moving/rotating/scaling, The two rings, Shaping, Whole objects, Symmetry and
Mirror, Keeping your work. 58 rows, built from `HELP_QUICKSTART` and
`HELP_SECTIONS` and rendered with the same `icon()` calls the real buttons
use, so the glyphs cannot drift from the app.

It replaced eleven icon/name pairs and six gesture lines that named the
controls without saying what any of them DID - and that had gone stale
besides, still offering "Smart camera framing" for an icon that has meant
Aim assist since the smart camera was removed at v1.87. **Rows say what the
thing does.** Anything added here should do the same, and note that
double-tap alone does four different things depending on mode, none of which
the old card mentioned.

## Open threads

- **Moving the pivot / re-origining an object.** Deferred. Capturing the
  symmetry plane from geometry buys most of what it would have.
- New cubes should spawn at world centre even if they overlap. Currently
  they offset in a grid pattern.
- No deliberate way to switch component type — you must successfully tap the
  type you want. The type-lock toast now explains the refusal, which may be
  enough.
- Gesture-driven modelling tools (extrude on two-finger tap, etc.).
- `_verify.py` is gitignored, matching the `_`-prefix convention, so it
  lives on one machine only. Consider committing it. Note it CANNOT catch an
  undefined reference — a name that does not exist passes `node --check` and
  throws at runtime. Grep for any identifier you introduce.
- The op sweep and the picking harness that produced the numbers above live
  only in a browser console. Turning them into a committed self-test is the
  obvious way to make "flawless" checkable rather than hoped for.
