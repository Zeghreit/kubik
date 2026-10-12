# The outliner pick-up (a2.94) — SHIPPED

Live at https://zeghreit.github.io/kubik/

Hold a row 340ms to lift it, then drag. Between rows reorders; onto a row
groups; a child dragged out of its group leaves it.

## Why a hold

a2.92 spent the row's **horizontal** axis on swipe and handed its **vertical**
to the scroller. There is no third axis, so the third gesture starts where
neither is listening. The hold is dropped by the first 8px of movement, so a
swipe and a scroll still start instantly.

## Two answers, two pictures

- **Middle band** of a row → *into it* (accent outline). Loose object onto
  loose object makes a group; onto a group or its child adds to that group.
- **Edges and gaps** → *between* (a line at that boundary).

They never appear at once, and the line anchors to the edge of a whole
**block** — a group's row plus its children — not to whichever child row the
finger is over.

## The model: two lists and one flatten

`entries` = top-level order (objects and groups); each group owns `childIds`.
A drop edits one or both, then `App.objects` is rebuilt from them.

Index arithmetic over `App.objects` — where a group occupies several slots and
members need not be contiguous — is where the bugs live. `flattenEntries` also
sweeps anything the walk missed onto the end: **reordering a list must not be
able to delete anything.**

## The load-bearing line for touch

`touch-action` is read when the touch sequence *begins*, so flipping it at
lift time would not take the vertical axis back from the scroller until the
next gesture — the row would follow the finger while the tray scrolled under
it. A **non-passive `touchmove` listener calling `preventDefault`** is the only
thing that stops a scroll already in flight. Remember this one.

## Review findings — the lesson

1. **Every downward drop landed a slot too low.** The index was computed
   against the list that still contained the dragged row; the detach then
   shifted everything below its old place. Dragging *up* was correct
   throughout — which is exactly how this survives being tried out by hand.
   Worse, the neutral position quietly moved the row and pushed a history step.
   *Fix: the drop names a row, and the index is worked out after the detach.*
   **My own probe missed it because section 39 dropped at the very end of the
   list, where the clamp hides it. A reorder test that only moves things to
   the end is not a reorder test.**
2. The 4px `gap` between rows resolved to "move to the end" — any pointer not
   inside a row's rect fell to the terminal fallback. One release in ten.
3. A hold whose row was rebuilt away never ended: pointerup goes with the
   element, so the frame loop and four document listeners ran for ever —
   including the touchmove that `preventDefault`s every touch on the page. On
   a phone, app dead until reload. *Fix: `row.isConnected` guards at both lift
   and frame.*
4. The line could be drawn inside a group the drop would step over.
5. The click ending a lift could select a row — marking the row doesn't
   survive, because ending a lift rebuilds the list. A short clock window does.

## And one the probe found by being flaky

Section 39 failed intermittently. Cause was real: the drop was read off the
**last painted frame**, so a fast move plus immediate release landed where the
stale frame said. Now resolved at the lift from the pointer's own position,
and the section moves and releases within one tick so no frame runs between.
**A flaky test is a bug report.**

## Probe

`_out_probe.js`, 47 sections, `_out_probe.py` harness. Six on the pick-up,
five more one per review finding.

## Where the outliner stands now

a2.91 shelf · a2.92 swipe + rename · a2.93 groups · a2.94 pick-up. The list is
feature-complete against what was asked for. Nothing outstanding on it.

## Known and recorded, not fixed

- `outlineUses` is recomputed every live-drag frame in extrude (belongs in
  `beginPendingOp`).
- The toast crosses the view cube at 375px (x 247–281).
- `needsFloor` rim can be incomplete; the extrude floor gets no `smoothGroups`
  entry; Each over several faces is still open/non-manifold.
- glTF/OBJ/STL export flattens groups.
- No horizontal bail-out on a lift: releasing over the viewport still commits,
  resolving by height alone. Design note, not a defect.

## Reminder

`python _verify.py index.html`, then `_out_probe.py`, then `_runprobes.py
<fresh dir>` — always a fresh directory. `_imp_probe` flakes on its CDN fetch
and passes run alone. Then commit and push without asking.
