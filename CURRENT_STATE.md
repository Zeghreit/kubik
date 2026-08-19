# Kubik — current state

Single-file browser 3D low-poly mesh editor. "A fidget for 3D artists":
relaxing, one-handed, mobile-first. three.js from CDN, no build step.

- Live: https://zeghreit.github.io/kubik/
- Repo: C:\Users\a.bodrov\Projects\kubik  (index.html is ~7000 lines)
- Version at time of writing: v1.76
- Debug console: append ?debug=1 to the URL

## How the app works now

**Transforms have no gizmo at all.** You grab whatever is selected and drag
it. The same drag moves, rotates or scales depending on the active tool.

- Two-finger tap on empty space: cycles Move / Rotate / Scale
- Three-finger tap: switches Free / Axis
- In Axis mode the axis is read from the first ~15px of the drag and holds
  until you lift. In Free mode the drag works across the camera plane.
- A pill under the header shows the current tool and mode.

**Tools bloom at your finger.** Press and hold on a selected component and
the relevant tools appear in a single ring around the touch point. Slide
onto one and lift to run it. Different sets for object / vertex / edge /
face. Ring radius scales with how many tools are in the set.

**Everything else:** tap to select, tap empty space to clear, one finger on
empty space orbits, pinch zooms.

## Deliberately absent — do not rebuild these

- **The transform gizmo.** Built, iterated on for many versions, then
  removed entirely once direct dragging worked. Tagged `v1.57-handles` if
  it's ever needed for reference.
- **The fixed-corner fan menu.** Replaced by the press-and-hold ring.
- **Tool labels in the ring.** Icon-only; labels made items read wider than
  they measured and caused overlap bugs.

## Hard-won lessons

- **Measure, don't reason.** Every layout/geometry bug this project has had
  was found by running numbers or reading a screenshot, and missed by
  reasoning about the code. Overlap claims especially.
- **Large deletions need a declaration diff** against the last commit
  before shipping. Cutting between two line markers has silently swallowed
  the App state object, the theme system, the raycaster and the view cube
  on separate occasions — each time the app failed to start.
- **Ask for `?debug=1` console output** when something's broken on device.
  One line of real error text solved what three rounds of analysis didn't.
- **`edit_block` is unreliable above ~20 lines.** Use a Python patch script.
- Zeghreit tends to spot the right conceptual direction early. When a
  reframe is proposed, follow it rather than defending the existing
  implementation — the gizmo removal and the single-ring fix both came
  this way.

## Open threads

- Cube spawn position and auto-select behaviour (never revisited)
- Whether the help card's content matches what people actually find
  confusing
- Possible floating labels near buttons, if the single help card isn't
  enough
- Gesture-driven modelling tools (extrude on two-finger tap, etc.) —
  discussed, not built
