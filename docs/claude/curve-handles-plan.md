# Curve handles — plan (v2.75), decided 24.09.2026

Zeghreit's calls, from the scope question at the end of the v2.74a chat.
The code has not been read yet — recon comes first, and the code decides where
it disagrees with this note.

## What he chose

1. **Handles show only on the selected point** in the curve point editor.
   Tap a point and its two handles appear. Nothing on the other points, so the
   screen stays clear and a finger can hit what it aims at.
2. **Smooth by default, plus a Corner chip.** Dragging one handle mirrors the
   other's DIRECTION so the curve stays smooth. A **Corner** chip in the
   point's bar breaks the pair, and then each handle moves on its own.
3. **An Auto chip** beside Corner sends the point back to what every point
   does today: handles worked out from its neighbours. Auto is the default
   state of every point, so drawing still needs nothing but taps.

## What is already known (from `curves-v214.md`, which is a note, not a measurement)

- The file format already reserves `hIn` / `hOut`, so saved files do not
  change shape. Today the handles are worked out from the neighbours.
- A curve is an ordinary `App.objects` entry whose mesh is a `Line2`.
- The point editor is `App.curveEdit`. It has its own step-back
  (`curveEditStepBack`) and its own bar (`hideCurveEditBar`), and
  pushHistory closes it.
- Lathe and Tube sweep the evaluated curve. Check that they read the
  evaluator rather than rebuilding the handles themselves.

## Questions for recon

- Where do the handles get worked out (the evaluator), and does it read
  `hIn` / `hOut` at all yet?
- The point's mode must be stored per point (`auto` / `smooth` / `corner`)
  and saved. Is there a reserved field for it, or does it need a new one?
  Older files have no mode, so they should load as auto.
- Picking a handle: the point pick already exists, and a handle is one more
  target of the same kind. Handle targets must be sized for a finger.
- Dragging a handle is direct manipulation along the view plane, the same way
  a point is dragged. No gizmo.
- What does "smooth" mirror: the direction only, or the length too? The
  proposal is direction only, the way Blender's Aligned handles work.
- Does a closed curve's first/last point need anything special?

## Verify

- Node fixture for the evaluator: auto = today's output, byte for byte.
  Corner handles give a kink. Smooth keeps the tangent continuous.
- A Chrome probe for integration: pick, drag, Corner/Auto chips, Undo inside
  the editor, save/load round trip, and Lathe/Tube following the handles.
- Fable on the evaluator and the mirroring maths, opus on the lifecycle.
