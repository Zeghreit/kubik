# Array / radial repeat — a2.78

Shipped `c09f256`, live as a2.78. The first new modelling tool since
Circularize (a2.42), and the one `op-gap-analysis.md` ranked next.

## The design, and the two decisions behind it

**One object, not N.** Twelve bolts come back as one thing you can bevel,
subdivide, shade or drag as a unit; Separate breaks it into twelve. The app
owns both directions and has no modifier stack by choice — destructive with a
strong undo is the right trade for a fidget.

**The axis is `App.symmetryAxis`** — the same one Mirror and Flip read, and
they are Array's neighbours in the ring. No second axis picker to keep in
sync. The ring centre is the a2.39 pivot when placed, else the world origin.

Seat 0 of ring 1 in the Object ring: Duplicate's bearing, one ring out —
the pairing seat 1 is reserved for (Fillet beside Bevel).

| control | Line | Ring |
|---|---|---|
| stepper | count, total including the original | same |
| slider | spacing as a **multiple of the shape's own extent** | **sweep in degrees**, opens at 360 |

A full turn divides by n; an arc by n−1, so it ends *on* the sweep.

## New machinery: an option may carry its own slider range

Line runs 0.5–4, Ring 15–360. One range cannot mean both, and two ops would
put one idea on two ring seats. The spec declares the range **on the option**;
`activeRange(op)` returns the live one; `applyOptionRange` applies it, keyed
per option so switching back lands where you left it, and idempotent via
`op.rangeFor`.

## The review found ten defects — and where they were is the lesson

My probe had **twelve green sections** and the tool was broken in six places.
Every one of those twelve called `arrayOp` directly. **A worker function is
not a tool**; the defects lived in the controls:

1. `setPendingAmount` clamped to the SPEC's max, so the first touch of the
   slider crushed Ring's 360° sweep to Line's 4.
2. `applyOptionRange` early-returned for an option with no declared range, so
   Ring → Line kept 360 and arrayed the shape 360 of its own widths apart.
3. It was reached from `refreshOpAmountVisibility`, which the **count
   stepper** also goes through — so every +/− press reset the sweep. Array's
   count is its primary control, so this fired constantly.
4. Material leak: the op *replaces* the whole material array (rather than
   appending, as every sibling does) and re-runs per frame, so each frame
   abandoned one material per face group without `binMaterials`.
5. The axis was read live: tapping Y mid-op changed nothing on screen while
   the confirm toast read the *new* axis and announced a Y array over X
   geometry — the exact lie the toast's own comment claims to prevent.
6. Position-keyed `creases`/`edgeShade` didn't travel, so a hand-marked cube
   arrayed into one marked copy and eleven unmarked ones.
7. The refusal was silent until the tick — and the common case (a shape still
   at the world origin, where every primitive is born) hit it.
8. A ring under non-uniform scale shears every copy: the world transform is
   `M R M⁻¹`, a rotation only when M scales both perpendicular axes alike.
   **"Local space, exactly as symmetry works" does not carry over to a
   rotation** — a reflection in an axis plane stays axis-aligned, a rotation
   does not.
9. Two silent-success paths returning `false` without `refuseOp`, so confirm
   toasted success over an untouched mesh and pushed an empty history step.
10. `arraySelection` preferred `activeObjectId`, which can point at whatever
    was last edited in a component mode.

All ten fixed; nine new probe sections drive the op **bar** and each would
have caught its defect.

## The probe harness taught me two things

**A syntax error in a probe reads exactly like a hang.** An unescaped
apostrophe made the script tag never run, so nothing posted and the harness
said only `NO PROBE OUTPUT (timed out)` — through four runs, while I looked
for an infinite loop that was not there. `_verify.py` checks index.html, not
the probes. **New: `_jscheck.py`** runs `node --check` on a probe file, and
the probe now carries a 30-second **watchdog** that posts whatever it has
logged, so the last line is the bisection.

**A device-level timeout leaves Chrome running.** Thirty-two orphaned
processes held the profile lock and the port, and every subsequent probe then
timed out for a reason that had nothing to do with the code.
`taskkill /F /IM chrome.exe /T` before a run.

## Verification

- `_verify.py` PASS (22,331 JS lines).
- Regression `_a277f` → `_a278`: **25 of 25 existing suites identical**. The
  only intended difference is `_theme`'s `3.ring_items` going 11 → 12 seats.
  `_perf`'s `slider_coalescing` is the known flake.
- `_imp_probe` failed twice, which is one more than the known flake deserves,
  so it was checked properly rather than waved through: `_impcheck.py` runs it
  against the **committed a2.77** and the working copy back to back. a2.77
  failed and a2.78 passed on the same machine minutes apart — the CDN fetch,
  not the change. `_imp_out.txt` then matched the baseline byte for byte.
- New `_array_probe` (suite 28): 21 sections, 12 on the op and 9 on the bar.

## Lessons

**A worker function is not a tool.** Twelve green sections on `arrayOp` while
the thing a finger touches was broken in six places. Test the control surface.

**Check the probe compiles before you debug the app.** Four runs lost to an
apostrophe, because the failure message for "your test does not parse" and
for "your app hangs" is the same string.

**A bounding box cannot tell a ring from a hexagon.** Six copies of a cube in
a perfect ring have x and z spans 0.7 apart; the first pass called that a
failure. Measure the property that defines the thing — here, equal radii and
equal angles.

**Get the arithmetic right before calling the app wrong.** Two of the first
pass's four "failures" were my own expectations: 4 copies at spacing 1.5 span
5.5 widths, not 4.5, and three.js rotates +X toward −Z.
