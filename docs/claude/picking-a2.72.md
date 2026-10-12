# a2.72 — component picking. Measured, fixed, reviewed, SHIPPED.

Commit `eb2db3e`. This closes the oldest open thread in the project: the
"hard to select an edge or vertex, and sometimes it picks something that
should be culled" report from the a2.68 session.

## The discipline that mattered here

The defect had been *diagnosed* at a2.68 and written down, but never
demonstrated. So the first thing built was a probe that **fails against the
existing code**, and it did:

```
1.facing_test_says=VISIBLE - the facing test passes a corner behind a wall
1.occlusion_test_says=occluded - the raycast knows perfectly well it is behind the front quad
2.tap_on_hidden_corner=IT SELECTED THE HIDDEN CORNER (logical 6)
3.free_tap_is_the_front=A FREE TAP RETURNED vertex 6
6.tap_on_hidden_edge=IT SELECTED THE HIDDEN EDGE (5)
```

The controls were green from the start — a visible corner still picked, a
20px-sloppy tap still picked, See-through still reached through, and 7 of 7
front-facing cube corners still picked themselves. So the fix had a target
and a fence around it before a line of it was written.

The fixture is the smallest thing with an inner wall: two quads facing the
camera in **one** object, a big one in front and a smaller one behind. Every
corner of the back quad is on a camera-facing face *and* behind the front
quad. That is a wall inside a box, which is what every model that is not a
cube has.

## What was wrong

- `vertexVisible` / `edgeVisible` are **facing** tests — "is any face
  touching this turned toward the camera". On a convex cube that is exactly
  back-face culling and it is right. Anywhere else it is not.
- `preferUnoccluded` was a real occlusion test, but it only ran with **two or
  more** candidates and returned the whole list when every one of them was
  hidden. So a **lone** hidden candidate was never refused — which is the
  common case, because your thumb is usually near one thing.

## The rule that got reversed

`pointOccluded`'s comment said occlusion is *"used ONLY to break ties, never
to refuse the last candidate standing"*, because a picker that comes back
empty was the failure this whole strand of work existed to remove.

**The concern was right and the answer was wrong.** It is not "accept a hidden
candidate", it is **fall through**: the free tap tries vertex, then edge, then
face, and the face pick is a raycast that always hits when you are on the
model. A tap on the model still always lands on something — it just lands on
the thing you can see.

That comment was the spec, so rewriting it was part of the change.

## Banded, and why

`pickVisibleWinner` takes candidates a tie-band at a time, **nearest in pixels
first**, and inside a band sorts by **depth** and returns the first unoccluded
one. Three things follow:

1. A band with nothing visible in it is dropped and the next band gets its
   turn — so "the near corner is hidden, therefore the visible one 18px away
   wins" is expressible. A single `dMin` could not say that.
2. Returning the first visible member of a z-sorted band is the *same answer*
   as "test them all, keep the nearest visible", at **one** raycast instead of
   one per candidate. Measured: 1 raycast on a 576-face mesh against a budget
   of 12. That matters because the knife runs both pickers on every
   pointermove and three's raycast is a brute-force triangle loop.
3. The budget stops being reachable in the case that mattered.

## What review caught

Two of the four were mine, freshly introduced:

- **The budget could kill a pick that had a visible candidate in it.** The
  first cut tested a whole band before choosing, so twelve hidden candidates
  could exhaust `OCC_TEST_BUDGET` and abandon a *visible* candidate sitting in
  the same band — a plain tap on a vertex you could see returning nothing and
  dropping you into Face mode. The z-first early return fixes this and the
  cost at once.
- **A hidden component you had already selected became impossible to
  deselect.** Box select, grow and loop select all reach components occlusion
  refuses — none of them consults visibility — and a selected element's dot is
  drawn. Drag a box over a cube, tap a back vertex to drop it, get "that is
  behind the surface". A selected candidate is now accepted as a fallback that
  runs only after every band has failed, so it can never steal a tap from
  something visible. *You can always let go of what you are holding.*

And two older ones:

- **The occlusion epsilon ignored object scale** — a local bounding-sphere
  radius used as a world tolerance, so at scale 0.01 it was 4% of the object.
- **"Hidden" was outranking "wrong type" in the refusal message**, on a
  rationale that was factually wrong (the other-type probes cannot reset the
  flag, since nothing ever clears it). Tapping a face in Edge mode reported
  "behind the surface" and pointed at See-through when the honest answer was
  "that is a face, and edge is locked".

## Where "behind the surface" legitimately fires

Nowhere obvious, until you look: a hidden vertex always has surface in front
of it, so there is always a face under the thumb and *wrong type* wins. The
message fires on **a single-sided surface seen from behind** — the renderer
culls it so nothing is drawn and nothing occludes, but the vertex dots are
depth-tested rather than back-face culled, so you can see dots floating on an
invisible surface. Only the facing test refuses those, and it used to refuse
them in total silence.

Which is also the answer to "is the facing test now redundant?" — no. On that
surface the occlusion raycast finds no front face along the ray, reports "not
occluded", and would hand back vertices on a surface that is not drawn.

## Deliberately not done

- **Box select, lasso, grow/shrink, loop select and symmetry expansion do not
  consult visibility.** "You cannot select what you cannot see" is currently
  true of **tap only**. Most 3D apps do restrict box select to visible
  components outside x-ray, and that is the obvious next increment — it is a
  behaviour change of its own. The dead end it used to create is closed by the
  already-selected fallback.
- **Occlusion is within one object.** With cube B in front of cube A, tapping
  A's vertex through B still selects it.
- **`PICK_RADIUS_PX` is untouched at 28.** The diagnosed defect was
  visibility, not radius, and the file's own history is emphatic that a
  constant pixel threshold is right and that scaling it was removed on
  purpose. If "hard to select" comes back, that is the next thing to measure —
  but it should be measured, not assumed.

## Lessons

**Measure the defect before fixing it.** The probe that fails first is what
distinguishes a fix from a belief — and this project has five documented cases
of a confident note turning out to be wrong.

**A timing assertion in this harness is not an assertion.** The first cost
test read `0.0ms` and passed: headless Chrome under `--virtual-time-budget`
freezes `performance.now()`. It was replaced with a raycast counter, which is
deterministic and is exactly what the budget bounds. Same trap as asserting
`el.hidden` after setting it, in another costume.

**A comment in this codebase is a spec, and a stale one is a lie a future
reader will act on.** `pointOccluded`'s note said the opposite of what the
code now does; rewriting it was not optional.

**A fix that only refuses is half a fix.** Every refusal added here had to be
paired with either a fall-through or a sentence.
