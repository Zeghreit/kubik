# Outliner row gestures (a2.92)

Shipped. Live at https://zeghreit.github.io/kubik/

Zeghreit: *"rename by double tap on name, delete by swipe left and duplicate
by swiping right."*

## The rule underneath all three

A row acts on **the object under the finger, not on the selection**. That is
the point of having a list. Swiping a row you never selected deletes that
row's object, in any mode, with everything else untouched.

## The slot

Each row rides in an `.outSlot` holding two clipped backdrops — **Duplicate**
left, **Delete** right — with the row sliding over the top, so the label you
are uncovering is on the side the row is leaving towards. Commit at 96px,
travel stops at 130, and nothing is decided until the finger lifts. The row
had to become opaque (the hint showed through), and because `--accent-dim` is
translucent the selected state stacks it OVER the panel colour as a gradient
layer rather than replacing it.

`.outRow` takes `touch-action: pan-y` — vertical to the browser, horizontal to
us — and the handler bows out **for good** once a drag reads as mostly
vertical, rather than grabbing it back halfway down the list.

## Double tap, remembered by id

The pair is tracked by **object id, not by element**: the first tap selects,
selecting calls `refreshUI`, and that rebuilds every row, so the element the
first tap landed on is gone by the second. `outlinerRename` looks its row up
by id, and the second tap defers the box by a tick — the click it still has to
fire would rebuild the list and throw the input away.

The box **stops every key**. Single letters are shortcuts here (`x` deletes,
`e` extrudes), so a name typed into a leaky box would edit the mesh it was
naming.

The old `dblclick → focusOnObject` is gone; double-tapping the object in the
viewport already does that.

## Five defects a fresh reviewer found before this shipped

All real, all in the first cut. Worth remembering as a class:

1. **`pointercancel` read as a lift** — a swipe the browser took away past the
   commit distance deleted the object. Android fires it on the long-press menu
   and whenever the compositor claims the touch.
2. **A flick armed the double-tap** — bowing out to the scroller ends with the
   drag never having gone live, which is the same shape as a tap unless the
   distance is checked.
3. **A face selection outlived its object** — `deleteSelection` never had to
   think about it because its object branch only runs in Object mode. It did
   not throw, it *lied*: `data-armed` stayed on and the HUD reported three
   faces with nothing to pick.
4. **Committing a rename rebuilt the list mid-gesture** — the box closes on
   blur, and pressing the next row is what blurs it, so that row recorded its
   origin and was discarded before its own pointerup.
5. **The pointerdown guards left their state behind** — a gesture ending off
   the row never gets its pointerup, and a desktop mouse keeps one pointer id
   forever, so a later press could be measured against a stale origin.

Three probe sections came straight out of the review.

## Probe

`_out_probe.js`, 21 sections, with its own `_out_probe.py` harness (port 8871,
`_chrome_out` profile). Synthetic pointer events throughout. Suite clean apart
from `_imp_probe`'s known CDN flake, which passes run alone.

## Next

**a2.93 — grouping.** Drag a row onto another to group, drag one out to
ungroup, reorder by drag; group/ungroup also in the object bloom ring. This is
a real data-model change: parents, transforms, serialization — not a gesture
layer.
