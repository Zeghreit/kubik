# Kubik — current state

Single-file browser 3D low-poly mesh editor. "A fidget for 3D artists":
relaxing, one-handed, mobile-first. three.js from CDN, no build step.

- Live: https://zeghreit.github.io/kubik/
- Repo: C:\Users\a.bodrov\Projects\kubik  (index.html is ~6600 lines)
- Version at time of writing: v1.85c
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
onto one and lift to run it. Ring radius scales with the number of tools.

**Selection**
- Vertex and edge picking is SCREEN-SPACE (pixel distance to the projected
  point/line), never 3D ray distance.
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
