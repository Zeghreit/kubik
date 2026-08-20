# Kubik — current state

Single-file browser 3D low-poly mesh editor. "A fidget for 3D artists":
relaxing, one-handed, mobile-first. three.js from CDN, no build step.

- Live: https://zeghreit.github.io/kubik/
- Repo: C:\Users\a.bodrov\Projects\kubik  (index.html is ~6600 lines)
- Version at time of writing: v1.89
- Debug console: append ?debug=1 to the URL. Tap picks also log a
  `[pick] ...` line explaining exactly why a tap resolved as it did.

## Versioning

Numbers for new work or reworks (v1.85 -> v1.86). Letters for bug fixes
(v1.85 -> v1.85a -> v1.85b).

## How the app works now

**Transforms have no gizmo at all.** You grab whatever is selected and drag
it. The same drag moves, rotates or scales depending on the active tool.

- Two-finger tap on empty space: cycles Move / Rotate / Scale
- Three-finger tap: switches Free / Axis
- In Axis mode the axis is decided once from the first ~15px of the drag and
  held until you lift. Free mode works across the camera plane.
- Free rotation takes its axis from the swipe direction, locked at the start.
- Free scale reads the projected axes, so depth is reachable without a
  dedicated gesture; a drag matching no axis scales uniformly.
- A plain-text readout under the header shows tool and mode.

**Tools bloom at your finger.** Press and hold on a selected component and
the relevant tools appear in a single ring around the touch point. Slide
onto one and lift to run it. Ring radius scales with the number of tools -
measured from the CLOSEST pair of items, not from the count, so unevenly
grouped sets still get real spacing.

**The world ring** (v1.89). Press and hold on EMPTY SPACE, in any mode,
whatever is selected, and you get Add Cube plus everything that used to be
a button around the viewport edge. The right rail (See-through, Floor grid,
Aim assist, Snap) occupies the TOP half of the ring; the left-side controls
(Symmetry, and Tap/Box/Lasso select) occupy the BOTTOM half, so anything
you had muscle memory for is still grouped with what it sat beside. Add
Cube takes the right-hand pole alone - it is the only item that makes
something rather than toggling something - and the left pole is left empty
so the two arcs read as two arcs.
- It waits longer than the selection ring (480ms vs 300ms). Pressing on
  your own selection and pausing means one thing; pressing on the
  background and pausing is also how a careful orbit starts, so that
  gesture has to prove itself before the camera loses it.
- Not armed while Box or Lasso select is on - there the press IS the
  gesture.
- `.on` (toggle is currently on) and `.active` (your finger is over it)
  are deliberately different looks.

**Object / Component is a two-position switch** on the middle of the left
edge (v1.89), replacing the round corner button. Tap the half you want or
swipe toward it; Object is the upper half. A button that cycled was fine to
hit and impossible to read - you could not tell which mode a tap would
leave you in without looking at the icon and reasoning backwards. The lower
half shows the component type it would put you IN, not a generic glyph.

**Selection**
- Vertex and edge picking is SCREEN-SPACE (pixel distance to the projected
  point/line), never 3D ray distance.
- v1.86: vertex dots are drawn at a CONSTANT SCREEN SIZE (11 CSS px, times
  the pixel ratio, `sizeAttenuation: false`). They used to be 0.11 world
  units, so on a unit cube at camera distance 25 a dot measured ~4px while
  the catch radius stayed 22px - you aimed at something you could not see,
  and neighbouring catch zones overlapped. Constant size makes what you SEE
  the thing you can HIT at every zoom.
- v1.86a: dots are 8px ROUND sprites (PointsMaterial draws untextured points
  as squares, which read as UI chrome once they stopped shrinking), and they
  now show in VERTEX MODE ONLY. Edge lines still show in every component
  mode - they double as the wireframe. Note this means a tap near a corner
  in Edge or Face mode can still be claimed by a vertex you cannot see, as
  vertex keeps tap priority; deliberate, but worth watching.
- Nearest visible vertex wins, which is a Voronoi split of the screen, so
  catch zones can never overlap. Vertices projecting within `VERT_TIE_PX`
  (8px) of each other are a tie, settled by DEPTH - the one nearest the
  camera is the one you meant.

- v1.87/v1.88: dot 8px -> 6px -> 2px, catch radius 22px -> 28px. Deliberately
  opposite directions - the MARKER should be quiet, the TARGET generous, and
  there is no reason they must match. `OFF_MODE_PICK_BIAS` went 0.9 -> 0.7 at
  the same time so an off-mode target still measures ~19.6px, exactly as
  before; only the in-mode radius grew.

**Aim assist** (v1.87). After a vertex tap, if the nearest visible neighbour
is under 30px away, the camera eases in (380ms) until neighbours sit around
60px apart, bringing the picked vertex 70% of the way to centre. Runs AFTER
the pick, so it can only make the NEXT tap easier and never changes what the
tap just selected. Rate-limited to one nudge per 700ms, never more than 2.2x
closer per move, and it stops at a distance floor of 1.2 so a dense mesh
can't be nudged into the near plane one tap at a time. Simulated: converges
in 1-3 nudges from every starting spacing tried. It owns the third button on the right rail and is ON
by default.

**Selecting and grabbing use different radii.** They are different
questions: selecting asks "which of these did you mean" and wants
precision (`PICK_RADIUS_PX` 22); grabbing asks "are you taking hold of what
is already yours" and wants generosity (`GRAB_RADIUS_PX` 34). Sharing one
radius was the "sometimes it refuses to translate" bug.
- `pointerOnSelection()` now measures ONLY against selected components, so
  an unselected neighbour nearer the finger can no longer steal the grab
  and turn it into a camera orbit.
- Pressing anywhere inside the selection's screen bounding box grabs it too
  (3+ components, and skipped when the box covers >60% of the viewport, so
  there is always somewhere left to orbit from).
- A selected face is grabbable anywhere its surface is under the finger.

**Tap slop is per pointer type** (v1.86). A thumb rolls a few pixels as it
presses and lifts; one shared 6px slop threw ordinary taps away as camera
drags. Touch gets 12px tap slop and 8px drag start, mouse and pen keep 6px.
- Back-facing vertices and edges are rejected by face normal, so picking
  agrees with back-face culling. Mirrored (negative-determinant) objects are
  sign-corrected.
- Once something is selected the component TYPE IS LOCKED - only that type
  can be picked until you tap empty space. This removes overlapping-catch-
  zone ambiguity by construction.
- Vertex dots and edge lines are visible in ANY component mode, so the first
  tap has something to aim at.

**Solid vs see-through.** Solid mode culls back faces and hides back-side
components. The eye toggle (right rail) restores the old X-ray behaviour.

**Everything else:** tap to select, tap empty space to clear, one finger on
empty space orbits, pinch zooms.

## Deliberately absent — do not rebuild these

- **The transform gizmo.** Built, iterated on for many versions, then
  removed once direct dragging worked. Tagged `v1.57-handles`.
- **The fixed-corner fan menu.** Replaced by the press-and-hold ring.
- **Tool labels in the ring.** Icon-only; labels made items read wider than
  they measured and caused overlap bugs.
- **Two-ring bloom menus.** Hover picks by angle only, so an outer ring was
  unreachable. Always one ring now.

## Hard-won lessons

- **Measure, don't reason.** Every layout, geometry and picking bug in this
  project was found by running numbers or reading a screenshot, and missed
  by reasoning about the code.
- **Ask what "broken" looks like before writing code.** Twice in one session
  a plausible theory burned a version fixing the wrong thing.
- **Check for DUPLICATE declarations after any rewrite.** A second copy of a
  function left behind is a hard SyntaxError that blanks the whole app, and
  esprima-based _syntax.py does NOT catch it.
- **Large deletions need a declaration diff** against the last commit. Cutting
  between line markers has silently swallowed the App object, the theme
  system, the raycaster and the view cube on separate occasions.
- **`?debug=1` console output beats analysis.** It has settled in one line
  what several rounds of reasoning got wrong.
- **`edit_block` is unreliable above ~20 lines.** Use a Python patch script.
- Zeghreit tends to spot the right conceptual direction early. When a reframe
  is proposed, follow it rather than defending the existing implementation.

## Watch out

- v1.79 made **winding correctness load-bearing** by switching to FrontSide
  culling. Anything producing reversed winding (mirror, and possibly extrude,
  bridge, subdivide) can now render or pick wrongly. Mirror is handled; the
  others are untested.
- Symmetry only mirrors vertices that already have a mirror twin - it keeps a
  symmetric model symmetric, it cannot restore lost symmetry.
- Symmetry applies to component edits only, never object drags.

## Open threads

- Symmetry Local vs World mode switch (agreed, not built) - UI placement
  undecided; long-press the symmetry button is the leading idea.
- "Centre selection to world origin" tool for the object ring (agreed, not
  built).
- New cubes should spawn at world centre even if they overlap (agreed, not
  built). Currently they offset in a grid pattern.
- No deliberate way to switch component type - you must successfully tap the
  type you want. May need an explicit control.
- Gesture-driven modelling tools (extrude on two-finger tap, etc.) -
  discussed, not built.

## Removed in v1.88

- **Smart camera.** Drifted the view to a three-quarter angle after every
  selection. Removed because it answered a question nobody was asking - the
  angle was usually fine, and being moved for no visible reason is worse than
  a slightly imperfect view. Aim assist replaced it on the same button and
  only moves when there is a measurable problem. Tagged `v1.87-smartcam`.
- **Floor contact shadow.** Off via `SHOW_FLOOR_SHADOW = false`, not deleted -
  the light's shadow camera, the catcher plane and the per-theme opacity are
  all still wired up, so it comes back by flipping that one word. It was the
  strongest depth cue the scene had without postprocessing, so it may well be
  wanted again.

## Also in v1.88

- The ACTIVE object's wireframe renders at full strength; every other
  object's is dimmed to `FRAME_DIM` (0.4). They used to be identical, so with
  more than one cube on screen nothing said which one your taps would hit.
  v1.89 fixed the Object-mode case: there the SELECTED set decides, not
  `activeObjectId`, which can point at something you aren't editing.

## Testing loop (set up v1.89)

The app can be driven from a Claude session end to end: `python -m
http.server 8765` in the repo folder, then Chrome on the same machine loads
`http://localhost:8765/index.html?debug=1` and synthetic PointerEvents
dispatched into the canvas exercise taps, holds and drags. This caught two
real problems in v1.89 before anything was pushed.

Two traps, both of which cost time:
- **A backgrounded tab freezes CSS transitions and clamps `setTimeout` to
  ~1s.** A transitioned property reads its START value forever, so
  `getComputedStyle` lied about the slider knob, and hold-vs-tap timing
  could not be told apart. Check `document.hidden` FIRST; disable the
  transition before measuring a transitioned property.
- **Synthetic pointer events make OrbitControls throw**
  `setPointerCapture: No active pointer`. Harmless and unreachable with a
  real finger - but it fills the console, so filter by stack, not by count.

## Still open after v1.89

- Symmetry Local vs World: the mode switch AND its mechanics. Agreed, not
  built. It belongs next to Symmetry in the world ring's bottom half.
