# What Kubik is missing, against a normal Maya / Blender base

Written 2026-08-29 at a2.34. **CLOSED 2026-09-17 at v2.38.**

> ## THIS LIST IS FINISHED. Read this box before the rest.
>
> Two headline claims in the body below are now false, and one of them would
> block work that is currently in flight.
>
> 1. **"Everything ranked on this list is now shipped except booleans"** and
>    **"Kubik has ten of eleven; the one miss is Booleans"** — **Booleans
>    shipped at v2.13.** The eleven-item beginner base is complete. The only
>    things still open below are #11 Spin/lathe (largely subsumed; Lathe
>    shipped at v2.15 and Revolve at v2.11/2.12, so this is effectively done
>    too) and #12 relax vertices, which was always "cheap, moderate value".
> 2. **"UV unwrapping, seams, texel density, UV editors. Decided policy — the
>    material system is triplanar precisely so no UVs are needed."** — **that
>    policy was REVERSED on 12.09.2026.** UV is an optional channel that
>    survives operations (v2.28), imports carry their maps, and six texture
>    channels are assignable by hand (v2.33–v2.35). See
>    `claude/uv-commands-maps-plan.md`, which is the live plan.
>
>    What Kubik still does not have is an **unwrap**: it can carry UVs it was
>    given and it can lose them honestly, but it cannot make them. Stage 4 of
>    the UV plan is about teaching individual operations to preserve the
>    attribute-vertex correspondence, not about unwrapping.
>
> Everything else below is accurate history and worth keeping for the two
> lessons it records.

## The two lessons worth keeping

**The geometry is never the hard part. What the selection MEANS is.** Every
op since confirmed it — a2.78's defects were in the controls, a2.79's in what
"the rim" means at a pinch point, a2.80's in what "the other side" means,
a2.81's in what "the same vertex" means. And at v2.38, the whole reason the
command layer is worth building is that fourteen call sites each had their own
idea of what "the edit finished" means.

**Triangulate would have been an op that did nothing.** Gap 9 used to open by
saying n-gons are not acceptable in exported geometry. That rule does not
apply to this app, and the entry stood unchallenged for three versions.
Kubik's n-gon is a FACE GROUP — a way of talking about a run of triangles —
and it exists nowhere outside the editor. `buildExportGroup` clones the
`BufferGeometry` as it stands, which is indexed triangles, and all three
exporters are three's own. **Read the pipeline before building to the note.**

---

## What we already have, so nobody re-adds it

Component ops: **Extrude** (a mode, with Rotate/Scale inside it), **Inset**,
**Bevel**, **Loop cut** (Even / Slide / Flow), **Slide** (a2.80), **Set
flow**, **Circularize**, **Knife**, **Split**, **Bridge**, **Cap hole**,
**Delete / Dissolve**, **Connect**, **Weld**, **Target weld** (gesture),
**Merge**, **Collapse**, **Detach**, **Mark Sharp**, **Crease**, **Grow /
Shrink**, **Subdivide**, **Smooth by angle**, **Flip normals**, **Spin edge**
(v2.12), **Vertex bevel** (a2.113).

Object ops: **Duplicate**, **Array** (a2.78), **Solidify** (a2.79), **Clean
up** (a2.81), **Mirror**, **Flip**, **Separate**, **Centre**, **Join**,
**Delete**, **Shade**, **Subdivide**, **Smooth by angle**, **Group /
Ungroup** (a2.93), **Booleans** (v2.13).

Curves, as a metacomponent (v2.14): **Lathe** (v2.15), **Tube** (v2.16),
live until baked (v2.20).

Primitives (a2.36): **Cube, Cylinder, Sphere, Torus, Plane**, all spawning at
the world origin (a2.36a).

Import: **`.glb` / `.gltf`**, **`.obj`** (+ `.mtl`), **`.stl`** (a2.68–a2.71),
**`.fbx`** (v2.31), and since v2.33 an import brings its **texture maps** with
it.

Materials: a library that merges rather than grows (v2.29/v2.30), a material
pool (v2.8), mask-driven wear and bump (v2.6/v2.7), and six texture channels
(v2.33–v2.35).

Modes and aids: **Soft selection** (a2.37), **Isolate** (a2.38), **Pivot**
(a2.39), **Snap** off / grid / geometry (a2.41).

Three things easy to assume missing that are already there: **Subdivide
honours creases** (real Catmull-Clark) — though `crosstest-findings.md`
records an unresolved AMBER item claiming a crease is lost through a smooth
Subdivide, and one of the two is wrong; **loop, ring and face-loop SELECTION**
all exist; **symmetry is real and op-aware**.

## What is left on the list

### 11. Spin / lathe / screw — effectively done

Revolve (v2.11, renamed at v2.12), Lathe (v2.15) and Array's Ring cover it.
What a Lathe still cannot do is sweep an **arc** rather than a full turn;
that wants the pendingOp machinery so a slider re-runs the sweep live.

### 12. Smooth / relax vertices — the one genuine remaining gap

Set flow follows implied curvature, Circularize pulls onto a circle, Slide
moves along the ring; a plain averaging relax is a fourth thing again — it
evens out spacing without imposing a shape or a direction. Cheap, moderate
value now that the other three cover the headline cases.

## Deliberately NOT on this list

- ~~**UV unwrapping, seams, texel density, UV editors.**~~ **The policy was
  reversed — see the box at the top.** An unwrap is still absent, but as
  unbuilt work, not as a decision.
- **Baking** (normal / AO / curvature), high-to-low workflows, cages. Note
  that this is now in tension with reality: the masks still do not export,
  and baking them to a texture is what would fix that. It is unbuilt work
  rather than a refusal.
- **LOD chains and decimation.**
- **Retopology tools**, shrinkwrap, poly-build.
- **Sculpting brushes and multi-resolution.**
- **A modifier stack.** Kubik is destructive with a strong undo, which is the
  right trade. Mirror, Array and Boolean are the three where non-destructive
  genuinely pays, so if the stack idea ever returns, those three are the
  argument for it. **a2.78 shipped Array destructively on exactly that
  reasoning** — Separate is the way back.
- **Rigging, skinning, animation.**
- **Clever automatic placement for new objects.** Settled at a2.36a.
- **Triangulate.** Not a policy decision — there is simply nothing for it to
  do. See the lesson above before proposing it again.
