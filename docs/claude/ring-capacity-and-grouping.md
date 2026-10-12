# How many seats, and what goes one layer down

Written 2026-09-04 against index.html at a2.108, in answer to:
*"how to keep balance between functionality and optimal numbers of buttons
and reasonable moving extra icons inside groups."*

> ## DECIDED — Zeghreit, 2026-09-04
> - **Structure: ops + doors.** One ring. Most-used ops direct; the
>   overflow behind 0–2 doors that open a 4-op sub-ring. Not the four
>   TRANSFORM/BUILD/REMOVE/SELECT categories.
> - **All four merges accepted**: select modes → one seat · shade +
>   smooth-by-angle → one · mirror + flip → one · group + ungroup → one.
>
> Not yet built. The design doc gets updated first.

Three numbers decide this. Everything else follows from them.

---

## 1. THE HARD CEILING — 8 seats, 9 at a squeeze

Measured, not guessed. At R=108 with 52px seats (what ships today and is
known to read at arm's length), the distance between neighbouring seats is
`2R x sin(180/n)`, and a2.107 established the floor at **68px** — below
that the words touch.

| seats | pitch | verdict |
|---|---|---|
| 8 | 82.6 | comfortable |
| 9 | 73.9 | fine |
| **10** | **66.8** | **words touch** |
| 12 | 55.9 | overlap |

R cannot simply grow: R=120 buys n=10 but shrinks the band the ring has to
follow your thumb to 51px, and R=132 pins the ring to the middle of the
screen — the exact failure a2.104 and a2.108 were spent removing.

**So: 8 working bearings. That is the budget, and it is not negotiable by
drawing smaller — 44px seats fail the touch-target floor.**

Keep the doc's best rule: **S is Delete's seat or empty, in every ring.**
That leaves **7 bearings for ops.**

---

## 2. THE ACTUAL OVERFLOW IS SMALL

Shipped today:

| mode | ops | non-delete | over 7 |
|---|---|---|---|
| Vertex | 7 | 6 | **0** |
| World | 9 | 9 | 2 |
| Face | 11 | 10 | 3 |
| Edge | 14 | 13 | 6 |
| Object | 17 | 16 | 9 |

**20 placements need a home, not 46.** Vertex already fits. That is the
single most important fact here, and it says the second layer should be
small and targeted — not a full 4 x 8 taxonomy over everything.

---

## 3. MERGE BEFORE YOU GROUP — all four accepted

Some "extra icons" should not go one layer down. They should stop being
separate icons.

| today | becomes | saves |
|---|---|---|
| `Tap select` · `Box select` · `Lasso select` | one **SELECT MODE** seat — they are mutually exclusive, one is always on. That is a segmented control, not three ring seats. | World −2 |
| `Shade` · `Smooth by angle` | one **SHADE** seat; the angle is a slider in the op HUD after it runs. Smooth-by-angle IS shade with a parameter. | Object −1 |
| `Mirror` · `Flip` | one **MIRROR** seat with the axis in the HUD. Both are reflections. | Object −1 |
| `Group` · `Ungroup` | one **GROUP** seat, context-sensitive: groups a multi-selection, ungroups a group. Never both meaningful at once. | Object −1 |
| `Save` · `Load` · `Export` (empty ring) | not ring ops at all — they belong in the drawer. | — |

After the merge pass:

| mode | ops | non-delete | over 7 |
|---|---|---|---|
| Vertex | 7 | 6 | **0** |
| World | 7 | 7 | **0** |
| Face | 11 | 10 | 3 |
| Edge | 14 | 13 | 6 |
| Object | 14 | 13 | 6 |

**Two of five modes now need no second layer at all, and the worst case is
six.** The whole problem is now three doors' worth of ops.

---

## 4. THE STRUCTURE — ops and doors on ONE ring

Not four categories on a surface with everything underneath. Instead: the
ring stays one ring, and the last bearings become **doors** when the mode
needs them.

```
N   NE   E   SE        the mode's most-used ops, always direct
S                      Delete, or empty. Never anything else.
SW  W   NW             ops, or DOORS — doors fill from NW backward
```

A door opens a **4-op sub-ring** at N/E/S/W around the finger, using the
same component and the same swap animation the two-layer doc already
specifies — just triggered by one bearing instead of by the whole ring.
**Lift on a door runs its first op**, so a door's head op still costs one
flick.

### Why this beats 4 categories

| | today (flat 14) | 4 x 8 categories | ops + doors |
|---|---|---|---|
| ops at ONE flick | all — but unusable on a phone | **4** | **7, every mode** |
| ops at two flicks | 0 | everything else | 0 / 0 / 3 / 6 / 6 |
| empty seats drawn | 0 | up to 5 of 8 per category | 0 |

Op frequency in mesh editing is brutally skewed — in Edge, five ops are
~90% of use. A four-category system charges that head two flicks to save
the tail nothing. This charges the tail and leaves the head alone.

### The rule for what earns a direct seat

An op is direct if it is **used in most sessions in that mode**, or if it
is **the entry point to a workflow** (you cannot get anywhere without it).
Everything else goes behind a door. Doors fill from NW backward, so the
direct set is always the first N bearings — never a hole in the middle.

**Growth rule:** a new op joins the door whose word already covers it. If
no door covers it, the app has outgrown this map and it gets a review —
a third door is never added quietly.

---

## 5. THE PROPOSED MAPS

Bearings are fixed for life. An op never moves once placed.
The direct/door split below is my best guess at frequency — **Zeghreit's
call, he is the one who uses it.**

### VERTEX — flat, no doors
```
N  MERGE    NE  WELD      E  CONNECT      SE  SLIDE
S  DELETE   SW  SET FLOW  W  CIRCULARIZE  NW  (empty)
```

### WORLD — flat, no doors, no danger seat
```
N  ADD GEO  NE  PIVOT     E  SNAP       SE  FLOOR GRID
S  (empty)  SW  SEE-THRU  W  FLAT VIEW  NW  SELECT MODE
```

### FACE — 6 direct + 1 door
```
N  EXTRUDE  NE  INSET      E  KNIFE   SE  BRIDGE
S  DELETE   SW  CAP HOLES  W  DETACH  NW  ▣ SURFACE
                                            └ shade · flip normals
                                              set flow · circularize
```

### EDGE — 5 direct + 2 doors
```
N  EXTRUDE  NE  BEVEL   E  LOOP CUT  SE  SLIDE
S  DELETE   SW  BRIDGE  W  ▣ CUT     NW  ▣ FLOW
                           └ knife       └ set flow
                             split         circularize
                             collapse      mark sharp
                             cap hole      crease
```

### OBJECT — 5 direct + 2 doors
```
N  DUPLICATE  NE  ARRAY  E  MIRROR   SE  SUBDIVIDE
S  DELETE     SW  GROUP  W  ▣ MESH   NW  ▣ FINISH
                            └ solidify   └ shade
                              cap holes     flip normals
                              join          clean up
                              separate      centre
```

Five door words in the whole app — **SURFACE · CUT · FLOW · MESH ·
FINISH** — never more than two per mode. Every door holds exactly four,
so every sub-ring is a clean N/E/S/W cross: blind-hittable, and visibly
deliberate rather than five-eighths empty.

---

## 6. A DOOR MUST NOT LOOK LIKE AN OP

If a door draws as a normal seat, lifting on it runs an op whose word you
never saw — the flaw already flagged in the two-layer doc.

A **door is a doubled rhomb**: a second outline 6px inside the first. It is
that doc's own "there is depth here" signal, applied per seat instead of as
a whole plate over the ring — which also removes the sunken layer, its
24% ghosts sitting under the travel path, and its history-dependence.

A door carries **two words**: its own name, and its default op beneath in
the dim text colour.

```
  ╱▔▔╲          ╱▔▔╲
 ╱ ╱▔╲ ╲       ╱ ╱▔▔╲ ╲
│ │CUT│ │     │ │FLOW│ │     an op seat carries ONE word
 ╲ ╲__╱ ╱      ╲ ╲__╱ ╱      a door carries its name + what lifting runs
  ╲_KNIFE       ╲_SET FLOW
```

Now lifting on a door is honest, and the second flick is optional rather
than a surprise.

---

## 7. WHAT THIS KEEPS FROM THE TWO-LAYER DOC

- Words, not icons.
- Fixed bearings for life; an empty seat stays empty; the star is cut
  where a seat is missing.
- S is Delete's seat at both layers — pull down, pull down.
- Two layers, hard stop. A door never holds a door.
- The swap animation, the haptics, the chrome dimming to 35%, the aim
  line, and the back-inside-the-dead-zone gesture.

## WHAT IT DROPS

- The surface plate over the whole ring, and the sunken ghost layer.
- Re-centring the second layer on the finger — a sub-ring opens at the
  door's own seat, which is inside the ring and therefore always legal.
  This is what removes the edge-clamp contradiction.
- MOVE / ROTATE / SCALE as seats. They stay direct-drag. No gizmo.
- SELECT as a category. Grow/loop/ring/similar are not built; the three
  selection MODES become one World seat.

---

## 8. NUMBERS THE DESIGN DOC NEEDS

Replacing the two-layer doc's §3.1, which does not fit a 393px phone
(R=150 with 72px seats needs 215px of half-width against 196.5 available).

| | value | note |
|---|---|---|
| R, both layers | **108** | leaves a ~59px band for the ring to follow the thumb |
| op seat | **52** | tip 36.8; ships today, known to read |
| door seat | 52 | same seat, doubled outline |
| pitch at 8 seats | 82.6 | floor is 68 |
| dead zone | 36 | lift here runs the default |
| arm (commits a door) | **~70** | 88 was 59% of R=150; at R=108 it lands on the seat |
| hold to bloom | **300 ms** | today's tool-ring number, not the World ring's 480 |
| edge clearance | 14 | and the ring shrinks uniformly before the centre moves (a2.108) |

The aim window narrows from 52px to ~34px. That one needs a thumb test,
not a number I can assert.
