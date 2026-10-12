# Grouping — a2.93 SHIPPED, a2.94 planned

Live at https://zeghreit.github.io/kubik/

## What shipped in a2.93

A group is a **record** — `{ id, name, childIds, open }` in `App.groups` —
not a `THREE.Group`. The meshes stay parented to the scene.

**Both open questions from the plan were answered by reading the code first:**

1. *Does the multi-select drag move objects as a rigid unit?* **Yes.**
   `selectionCenterWorld()` averages the selected positions, and rotate and
   scale both apply `T · M · T⁻¹` about it. So a logical group needs no
   transform of its own — selecting its members and dragging moves them as
   one.
2. *Can group records live in `App.objects`?* **No** — 55 references, 37 of
   them iterating and assuming `.mesh`. Groups went in their own
   `App.groups` array, and the outliner interleaves them.

### Decisions held

- One level deep. Group ids share `App.nextId` with objects, so one id can
  never mean two rows.
- Swipe-left on a group row takes the group **and its contents**; undo brings
  it all back. Ungroup is how you keep the members.
- Two versions: model + ops now, drag gestures next.

### The good structural move

`pruneGroups()` runs from `refreshUI`, exactly as `reconcileIsolation` does.
Every op in the app ends by refreshing the UI, so join, separate, delete,
collapse, detach and import are all covered and **not one of them had to
learn that groups exist**. It drops dead ids and dissolves a group down to
one member.

### Behaviour

- Viewport tap on any member → the whole group. Region select and Shrink
  expand the same way.
- Outliner child row → that one member. That is what unfolding is for.
- Ring: **Group** at seat 12 (inboard of Join), **Ungroup** at seat 4
  (inboard of Separate). Join/Separate is meshes; Group/Ungroup is selections.
- Group row: eye hides all (all-or-nothing), swipe left deletes contents,
  swipe right copies the assembly as an assembly, double-tap renames, caret
  unfolds without selecting.
- File carries ids and names; `open` is not written.

## Review findings — worth remembering as a class

Five, all real. The first is the one to learn from:

1. **Grouping recorded no undo step.** `pushHistory` dedupes on a signature
   of the model and `groups` was not in it, so a doc that had just gained a
   group looked byte-identical to the previous one and took the early return.
   *Lesson: when you add a field to the model, check the history signature.*
2. Region select and Shrink write the selection set by hand and bypassed the
   group expansion.
3. Ring Duplicate vs row-swipe Duplicate gave two different answers.
4. A partly hidden group could be selected into (`groupIsHidden` requires
   ALL hidden; the guard needed ANY).
5. Group and Ungroup shared a seat, making Group unreachable once anything
   was grouped — and the add-to-existing-group code dead.

## Probe

`_out_probe.js`, 36 sections, `_out_probe.py` harness (port 8871). Ten on
grouping, five more one per review finding. The box-select fixture **proves
itself first** — it measures the ungrouped hit count and fails loudly if the
box caught all three, because otherwise a bad fixture passes while measuring
nothing. Worth copying.

## Next — a2.94, long-press pick-up

a2.92 spent the row's horizontal axis on swipe and its vertical on scroll, so
**reorder cannot be a plain drag**. Long-press ~350ms to lift a row, then:

- drop **between** rows (thin insertion line) → reorder `App.objects`
- drop **onto** a row (highlighted outline) → group / add to that group
- drag a child **outside its parent's span** → ungroup that one child

Auto-scroll the tray near its edges. The hold must abort into a swipe on
horizontal movement and into a scroll on vertical. `pushHistory()` on a
completed drop, none on a cancel. No drag handle — a 44px row already carries
a caret or swatch, a name, a count and an eye.

Probe: a hold turning horizontal swipes instead of lifting; a hold turning
vertical scrolls; a completed lift dropped between rows reorders and nothing
else changes; dropped onto a row groups; a cancel changes nothing and pushes
no history.

## Reminder

`python _verify.py index.html`, then `_out_probe.py`, then `_runprobes.py
<fresh dir>` — always a fresh directory. `_imp_probe` flakes on its CDN fetch
and passes run alone. Then commit and push without asking.
