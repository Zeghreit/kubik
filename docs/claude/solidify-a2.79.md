# Solidify — a2.79

Shipped `1e09488`, live as a2.79. Second of the two ops
`op-gap-analysis.md` ranked after Array.

## The design

Gives an **open** surface a thickness. Seat 9 of ring 0 in the Object ring,
inboard of Flip normals — both ops are about a surface having only one side.

Three options, expressed as two numbers rather than three code paths: two
copies of the surface at `d0` (front, keeping the winding) and `d1` (back,
every triangle reversed), plus one wall per rim edge.

| option | d0 | d1 |
|---|---|---|
| Behind (default) | 0 | −t | the surface stays exactly put |
| Centred | +t/2 | −t/2 |
| In front | +t | 0 |

Thickness is a **fraction of the model's own size** — the same scale-free
reasoning as Circularize's blend and Array's spacing. The per-vertex offset
direction and its lean correction are lifted from `extrudeRegionOp`, which
solved the same problem for its side walls.

## Two findings worth keeping

### The wall winding is the mirror of extrude's

Extrude keeps the original rim in place and puts its moved copy **in front**,
so its wall climbs old → new. Solidify's winding-keeping copy is the **front**
face and the new surface is **behind** it, so a wall wound extrude's way faces
inward.

Caught by measurement, not reasoning: the total signed volume came back
−0.0333 where +0.1 was expected, which says "wrong" but not "where". The
**per-group breakdown** localised it in one run — back cap +0.0333 (correct),
four walls −0.0167 each. `auditWinding` agreed: 8 conflicting edges, 2
reversed faces. After the flip every group is positive and the audit is clean.

**Print the parts, not just the total.** A single number that is wrong tells
you almost nothing about which half to look at.

### The rim walk was unnecessary *and* wrong

The first cut walked the rim into ordered loops the way `extrudeRegionOp`
does. A `next` map holds one outgoing edge per vertex and a `walked` set
blocks later chains from crossing a claimed vertex — so **two rim loops
meeting at one shared vertex** (every checkerboard of deleted faces) lost the
walls on both edges there *and* grew a wall across an edge that does not
exist, closing the truncated chain. It returned `true` and toasted success.

Every wall depends only on its own two ends, so the walk bought nothing.
Iterating the rim list directly gives identical walls on clean input with no
ordering assumption. **The fix removed code.** Extrude still walks loops and is
still right to — it walks a handful of selected faces, where the failure needs
a checkerboard selection; Solidify walks the whole mesh.

## Everything else the review found

- **Walls inherited face 0's material** — a multi-coloured shell came back with
  one arbitrary colour round its whole edge. The owning group now travels with
  the rim edge (`directed.set(k, [a, b, gi])`), which fell out of the rim-list
  rewrite for free.
- **A zero-area sliver inflated its neighbours 2.9×.** `loopNormal` returns a
  normalised vector, so zero length means no area; its zero normal made the
  lean factor 0, which clamps to 0.35. It also put a second copy of the same
  undirected key into the rim tally, pushing a genuinely open edge's count to
  3 so it read as interior and got **no wall** — a hole in a "closed" result.
  Merely ignoring it was not enough: its middle vertex then belonged to no
  face with an area and had no direction to grow in, refusing the whole op.
  The face is now **dropped**.
- **Uneven scale** is refused, matching Array's Ring precedent: local
  thickness along a local normal comes out lumpy under 1,1,10.
- **The bar opened over a mesh that could never work.** Array keeps its bar
  open because its refusal is option-dependent; Solidify's are true of every
  option across the whole slider. `solidifySurvey` now runs the cheap half and
  `solidifySelection` refuses without opening.
- **A rim crease is deliberately dropped** rather than carried — that edge is
  now the joint with the new wall, and an explicit "smooth" there beats the
  angle rule and smears the one edge of a card that should be crisp.

## Known limits, documented not hidden

- A **T-junction** produces overlapping walls: three collinear rim edges each
  have count 1, so all three get walls and two pass through solid material.
  Detecting collinear overlap is real work no op in this app does.
- The vertex normal is **unweighted** — six small triangles outvote one large
  quad. Blender weights by corner angle.
- Past a dihedral of ~41° the surface **thins** (the 0.35 lean clamp) and
  there is no self-intersection check.

## Verification

- `_verify.py` PASS (22,667 JS lines).
- Regression `_a278` → `_a279f`: **27 of 27 existing suites identical**; the
  only intended difference is `_theme`'s `3.ring_items` 12 → 13 seats.
- New `_solid_probe` (suite 29), 19 sections. Section 15 is the pinch-point
  case **none of the first 14 would have caught** — it builds two quads
  touching at one corner by hand (no primitive makes one) and asserts 4 caps
  plus exactly 8 walls, watertight.
- `_impcheck.py` again settled `_imp_probe`'s failure as the CDN flake rather
  than the change. Its labels were hardcoded to old version numbers and now
  say HEAD / WIP, because a test that reports something untrue about which
  version passed is worse than no test.

## Lessons

**Print the parts, not just the total.** A wrong aggregate localises nothing.
The per-group volume breakdown found the reversed walls in one run.

**Copying a sibling op's structure copies its assumptions too.** The rim walk
is correct in `extrudeRegionOp` because of *how much mesh it walks*, and that
premise does not survive the move to whole-mesh. Same for the wall winding,
which is correct there and backwards here.

**When the fix removes code, it is probably the right fix.**

**A fixture has to contain the thing being tested.** Section 9 creased an edge
of a *plane* and expected it to survive — but every edge of a single quad is a
rim edge, and rim creases are dropped by design, so the test asserted the
opposite of the rule. It needed two quads sharing an edge.
