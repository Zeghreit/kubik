# Materials — roadmap and state

## Status: everything through v2.9 is PUSHED and live. Masks are a four-deep
## stack, six cloth types plus your own pictures, and two SHAPE types
## (Cavity, Edges) read out of the mesh itself. Since a2.27a they also drive
## NORMALS (v2.6, signed at v2.7), share ONE material instance per definition
## (v2.8), and show honestly in the tray (v2.9). The first two have their own
## docs — `bump-from-masks-v26.md` and `material-pool-v28.md` — and this file
## is not a substitute for them.

## THE onBeforeCompile LESSON (critical for all future shader work)

three.js runs material.onBeforeCompile ONLY when that material has no
program cached under its customProgramCacheKey (per-material programs map,
surviving needsUpdate). A CONSTANT key breaks every re-patch: the material
reuses its stale program, added uniforms are orphaned from
materialProperties.uniforms → sliders freeze AND the GPU retains whichever
values the last-drawn masked material uploaded. Key = 'kubik-colormask:' +
defId + ':' + d.maskGen. **a2.20 broke this law again** (captured `_maskGen`
once and never advanced it) and EVERY mask configuration rendered
identically. NEVER go back to a constant key.

**The other half — three.js will not do this for you.** On a program cache
HIT three returns the cached program WITHOUT re-running onBeforeCompile *and
without repointing materialProperties.uniforms*. Therefore `_maskUniforms`
is a Map **per cache key** per material; `_maskKey` (WeakMap) holds the key
a material should compile under and `customProgramCacheKey` reads it live; a
material returning to a key it already used gets a `#n` suffix. **The `#n`
fork was removed at v2.8c and put straight back** — `_gpuchk` proved that
without it, moving a mask's colour after a component had been switched off
and on again did not change one pixel. See CURRENT_STATE.

**And the opposite mistake:** bumping the generation on every checkbox mints
a program per click that three never releases. **Nothing in the material
editor may bump.** Count, type, source, components and blend modes are all
uniforms. The only genuine recompile is crossing between "no patch" and "a
patch" — and since v2.8c that crossing happens when the FIRST mask is added
and the LAST removed, not every time one is toggled off.

**The third half — a custom uniform is only uploaded on a material CHANGE.**
three sets `refreshMaterial` in `setProgram` and skips it when the material
is the same object as the last draw, so several meshes sharing one instance
all draw with whatever the first one uploaded. This is why the v2.8 material
pool keys on `definition|side|owner` and a definition wanting a per-object
uniform still gets an instance per object.

**The fourth — `material.onBeforeRender` fires BEFORE the compile.** three
calls it from `renderObject`, and `setProgram` (and therefore
`onBeforeCompile` and `packUniforms`) runs inside `renderBufferDirect`
after. That ordering is load-bearing and easy to break: the hook stashes the
object's edge field in `_matField` and then bails, because the uniform store
is still empty — and `packUniforms` reads `_matField` a moment later for its
compile-time defaults. It is why the FIRST frame of a newly applied shape
mask is right in the viewport, and why a v2.9 thumbnail, which is one single
draw captured to a data URL and never gets a second frame, is right at all.

**LAW 2:** never store live uniforms/textures in material.userData —
Material.clone JSON-copies it. The exception: a plain string id
(`mat.userData.kubikDef`).

**LAW 3 (v2.8d):** never hang a cache key off the definition object either.
Anything written onto `d` rides into `materialDefSig` and into every saved
file, and a material carrying a key an older one does not is a material that
stops matching itself across a file. Side maps keyed by definition id.

## a2.20 / a2.21 — the mask stack and the cloth types

`def.masks` is an ARRAY of up to 4. Mask i owns channel i of ONE 128px RGBA
**DataTexture** per definition, sampled triplanar in object space with a
single tap set for all four. DataTexture not CanvasTexture: canvas 2D is
PREMULTIPLIED and would corrupt the packed channels.

`MASK_TYPES` = fbm (Clouds), voronoi (Cells), scratches, dots, stripes,
image — all behind `bakeNoiseField(mk, size)`. **TILING IS THE CONSTRAINT**:
the site GRID wraps while the site POSITION does not (Voronoi); `maskSplat`
indexes with a modulo; the stripe direction is ROUNDED TO AN INTEGER LATTICE
VECTOR.

**Pictures**: object URL, never `readAsDataURL`; white ground before
drawImage; centre CROP not squash; re-encoded to a 128px PNG data URL.
`maskImageSrc` gates every use on `/^data:image\//` — a project file is JSON
someone handed you. A loaded picture is EMBEDDED in the project JSON.

**A SHAPE MASK'S THREE SLIDERS ARE THE CLOTH ONES REUSED.** `scale` is
Width, `contrast` is Blur, `detail` is Noise, and which shape it reads comes
from the TYPE — `curv` lives on the catalogue entry (cavity 1, edges 2), not
on the mask object. Build a shape mask with a `curv` or a `width` key of its
own and you get a mask that is live, patched, and completely inert.

**Preview thumbnails: one material PER definition, kept.** A shared preview
material walking the library hit the cache-hit wart every pass. Do not
"optimise" it back, and do not dispose them per pass.

**Editor:** a chip row picks which mask you are editing; tapping the chip
you are on toggles that mask off/on.

## a2.24 → a2.27a — the SHAPE masks

Cavity and Edges read the mesh, not a texture. Four rounds to get right, and
every round's bug was found by Zeghreit in seconds of use on a real model,
on code whose measurements all looked healthy. **The failures are the
valuable part of this section.**

### How they actually work — A DISTANCE FIELD, not vertex attributes

**Corrected at v2.9.** This section used to describe `kubikCurv`, `kubikRimA`
and `kubikRimB` — a per-vertex curvature float and two vec4s carrying a
fitted geometric model of each shell, with a table of what `A.w` and `B.w`
meant and a warning never to remove a `defaultAttributeValues` pin. **None of
those three attributes exists in the file. Neither does the pin.** Searched:
`kubikCurv` appears once, inside the comment that replaced it; `kubikRimA`,
`kubikRimB` and `defaultAttributeValues` appear zero times. That design was
replaced by the one below and this doc kept describing it — the same failure
as the preset-mask note and the export-toast note, and the third time on this
project that a section was believed rather than re-read.

What is there now:

- `applyShading` builds **`geo.userData.kubikEdges`** — `{pos: Float32Array
  (6 floats an edge, object space), kind: Uint8Array (1 convex, 2 concave),
  gen}` — over the OUTLINE edges only, classifying each by which side the
  opposite vertex falls on relative to the local triangle normal.
- `bakeEdgeField` turns that into a **3D distance field**, stored as a
  z-slice atlas in one RGBA texture: **R is distance to the nearest CONVEX
  edge, G to the nearest CONCAVE one**, both normalised against
  `range = maxDim * 0.15`, initialised to 255 (= nothing near). `Edges`
  (source 2) reads R, `Cavity` (source 1) reads G.
- `ensureEdgeField` bakes lazily from the render, throttled to 120ms, and
  **both its guards test the existing field FIRST** — throttling may hand
  back a stale field, never nothing, because nothing means the 1x1 black
  fallback and the object flashes fully worn.
- The only varyings are `vKubikPos` and `vKubikNrm`, both from built-in
  `position` and `normal`. There is no custom attribute to be absent, which
  is why a plain `SphereGeometry` renders these masks at all.

Three things the shader does on top of the raw distance, each of which was a
bug report first: **cross-masking** (a band dies where the opposite kind's
edge is nearer than its own, so cavity dirt stops at the lip instead of
painting over it), the **behind-the-wall test** (step ±normal and difference
the field: a crease you could walk to is in the tangent plane and cancels, a
crease behind a 0.04-thick shell does not), and the **tie-break** at
`d + other == 0`, which is the no-field default and must read fully worn.

### The five failures, in order

**1. Per-vertex data is blind BETWEEN vertices (a2.24 → a2.25).** Every
vertex of a cube is convex, so curvature interpolates to a CONSTANT across
each face and no remapping of a constant makes a band. This is what drove the
whole design toward something sampled per PIXEL — first the fitted rim models,
and in the end the distance field, which is per pixel by construction.

**2. "Angled" is not "sharp" (a2.25 → a2.26).** Shells were merged by a
fixed 2-degree test, so a 12-sided tube's 30-degree seams counted as edges
though they shade smooth. Shells now merge across every edge `sharp` says is
not sharp. **If a rule about edges exists twice in this file, the two WILL
disagree.**

**3. An outline edge is not any edge (a2.26).** An edge a face uses TWICE is
its own triangulation — the diagonal of a quad — and the "not exactly two
faces" rule was marking every one of them sharp. Shading never noticed; the
rim pass reads sharp edges as a boundary, so every quad had a phantom edge
down its middle and the whole feature fell back. `edgeUse` counts uses PER
FACE; the test is `computeTopology`'s: **some face uses it exactly once.**

**4. The fallback was backwards (a2.26 → a2.26a).** No model meant
"unrestricted", so the face was PAINTED SOLID. On a cube and a tube nearly
everything fits and it never showed; on a nine-object tank plenty of shells do
not. **Missing wear is a quiet, honest failure; solid wear is
indistinguishable from the original bug.** The surviving form of this rule is
the 1x1 black fallback, which is the opposite choice for the opposite reason —
see below.

**5. A model must COVER the shell, not touch its rim (a2.27a).** On a curved
band with one segment across it the vertices ARE the boundary, so the
boundary test measures the model against the points that defined it and
cannot fail. A cylinder wall tapered by 2% scored a PERFECT ring and came
out solid. Checked against TRIANGLE CENTROIDS, which are interior by
construction.

### a2.27 — wear is its own question

`wear` is a second map beside `sharp`. `sharp` still decides shading,
untouched. `wear` differs twice: **a CREASE counts** (since a2.18 it has no
say in shading, but "hold this edge through Subdivide" is exactly "this is
an edge of the form", and it is the only thing that can say so about a
fillet deliberately shaded smooth), and **a hand 'sharp' mark comes first**.

The FACE COUNT still outranks a 'smooth' mark, for shading's own reason:
Object-mode Shade Smooth writes 'smooth' onto rim edges wholesale, and
without the rule one tap on an open plane deletes its entire outline with no
visual cue.

`creaseSelection` and `clearAllCreases` call `applyShading` again — a2.18
removed that deliberately, and a2.27 gave creases a second reader.

## v2.9 — the tray stops lying

The preview ball is a `SphereGeometry`, a sphere has no outline edges, so
`ensureEdgeField` returned null for it and the shader fell back to
`edgeFieldNone` — a **1x1 BLACK** texture, distance zero, meaning *everywhere
is an edge*. Every shape-masked thumbnail was a uniform flood: 100% of the
ball, Cavity indistinguishable from Edges, and the v2.6 bump invisible,
because a bump is the SLOPE of the mask and a flood has no slope. Measured
against the fix: bump-only versus the same mask at depth zero differed by a
mean luma of **0.00**.

`previewBallEdges` stamps the ball with a `kubikEdges` of its own — two
20-segment rings, convex at 32 degrees and concave at 13 from the camera
axis. Everything downstream is unchanged and cannot tell. **They are not a
claim about the sphere**; they are the feature a thumbnail is for. After:
14.9% / 8.5% of the ball, 0% overlap, bump 8.85, carve 11.16. Guarded by
`_thumbchk.py`, verified against two broken copies.

Two lessons worth more than the feature:

- **`sin(t)` is not where a ring lands on the tile.** The camera is 3.5 radii
  out, so perspective magnifies what is nearer and the silhouette is both the
  widest ring and the one pushed furthest out; the ratio that matters is
  `R sin t / (camDist − R cos t)` against the silhouette's. 46 degrees reads
  as 72% out by sin and draws at 86%. Two tries were spent on rings that came
  out as a halo, and only the PICTURE showed it — the numbers were healthy.
- **`edgeFieldNone` now has no legitimate user.** It existed for the preview
  ball, and two comments said so. What reaches it now is only failure paths,
  which is why it still returns fully worn rather than blank. Do not restore
  it as anything's intended path.

## a2.17a — finishes is DERIVED, not maintained

`applyFinish` stamps `mat.userData.kubikDef`, clone copies it, and
`reconcileFinishes(obj)` inside rebuildFromEditable derives the whole map
from the material array. `stampFinishesOnMaterials()` at the end of
restoreDoc; a stamp naming a deleted definition self-heals to Solid;
`ensureMaskPatches()` is called from reconcileFinishes, not only refreshUI.
Anything that mutates a material OUTSIDE applyFinish must
`delete m.userData.kubikDef`.

**Since v2.8 `reconcileFinishes` no longer calls `applyFinish` at all** — it
derives the map and hands the object to `dressFromPool`. A pooled instance is
shared, so dressing it to whatever one object happens to want corrupts every
other wearer; `applyFinish` refuses a pooled material stamped for a different
definition for the same reason.

## a2.18 / a2.19 — shading left the faces

`userData.smoothGroups` is dead. Shading is per-EDGE (`userData.edgeShade`,
position-keyed, 'sharp' | 'smooth') with an angle fallback, and each object
may carry its own threshold (`userData.autoSmoothAngle`). Sharp and Crease
are separate marks — but since a2.27 a crease has a second meaning for the
Edges mask.

## Still open

*Audited at v2.8d against the code, and again at v2.9. What later work fixed
is struck out, with the mechanism, because three of these had been believed
for a year.*

- ~~`restoreDoc` only adopts a definition the local library does not already
  have, so a mask on Solid / Plastic / Metal is silently dropped on open.~~
  **Retested at a2.65a — not true.** `materialDefSig` learned to include
  `masks`, so a file's masked Metal stops matching the local plain one and
  takes the import path instead: it comes back as **"Metal (imported)"** under
  a new id with every face repointed, and the preset stays plain. That was the
  policy choice the note was waiting for, and the code made it. `_mat_probe`
  section 5 guards it, by hand and headless.
- ~~A shape mask's bump does not show in the tray thumbnail.~~ **Fixed at
  v2.9**, above, by giving the preview ball edges of its own rather than by
  changing anything the masks do.
- ~~One MeshStandardMaterial per face group (1541 on an L4 cube).~~ **Done at
  v2.8.** `pooledMaterial` keys one instance on `definition|side|owner`; a
  22-group mesh holds 2 instances instead of 22, and an apply clones 0
  materials instead of 640. The `owner` leg is not optional — a definition
  that wants a per-object uniform (an edge field, a bump normal matrix) still
  gets an instance per object, because three uploads custom uniforms only when
  the material object differs from the last draw.
- **Masks do not export to glTF.** Still true, and bigger than "bake to UV at
  export". `buildExportGroup` wipes `userData` and clones the materials, and
  a clone loses `onBeforeCompile` — but the real obstacle is that **there is
  no UV attribute anywhere in the file**, deliberately, which is the reason
  the whole mask system is triplanar. An export would need an unwrap first.
- **The bump facets on the field's grid.** The bump takes screen-space
  derivatives of a trilinearly reconstructed field, so the C0 seams between
  voxels come through as flat facets in the normal — visible in the v2.9
  thumbnails as a stepped ridge, and present in the viewport all along. The
  ball resolves the range six voxels deep, which is as good as it gets:
  `EDGE_FIELD_STEPS` caps the grid at 40 a side, `EDGE_FIELD_DIM` at 64, and
  64³ RGBA is already 1 MB. The fix is a smoother reconstruction, not a
  bigger grid.
- **Weld, Merge and the delete paths still call the plain `removeTriangles`**
  rather than `removeTrianglesCarrying`, so the per-face maps are dropped
  across the renumber. **Audited at v2.8d: harmless.** `finishes` is re-derived
  from each group's `kubikDef` stamp by `reconcileFinishes`, not carried by
  index, and `smoothGroups` has exactly one reader — `migrateEdgeShade`, run
  once at load for files written before a2.18. Tidy it if you are in there
  anyway; it is not a bug, and the comment in the code now says so.
- **Two** custom varyings ride on MeshStandardMaterial — `vKubikPos` and
  `vKubikNrm`, 6 components. (The old note here said three; counted at v2.8d.)
  Well inside the 60-component ES 3.00 minimum. v2.6's bump cost no varying at
  all: it takes its slope from screen-space derivatives of the position
  varying that was already there.
- If Kubik ever grows a dense-mesh mode: compute the rim pass only while
  some material wears a shape mask, and force a re-shade of every object
  when the first one appears.

## Architecture facts

applyFinish = the funnel (colour included, NO blanket needsUpdate — it runs
per slider tick, and it stamps kubikDef); updateMaterialEverywhere = live
propagation; library global 'kubik.materials.v1' + files embed the palette;
harvest on legacy load; undo never rewinds appearance; painting schedules
autosave. Editor in #matEditor; mask controls are ids mk*.

`mkStructural` is the funnel every SHAPE change in the editor goes through.
It calls `rebakeMaskTexture` unconditionally and `rebakeMaskTexture` decides
(v2.8d): a signature of exactly the fields the bake reads — on, type, detail,
contrast, seed, per mask, plus the count — skips the 65,536-byte re-bake when
nothing it reads has moved. A picture mask opts out.

## Traps (still true)

Hidden Chrome-MCP tab: rAF dead, screenshots force repaint. localStorage
per-origin. PowerShell mangles inline python — patch FILES, and anchor a
version bump on the brand `<span>`, never on the bare version string. Chrome
caches the served file — add `&cb=N`.

**Palette variables are `--panel` and `--panel2`** — no hyphen before the
digit. Check both themes on any new control.

**Measuring shader changes:** `gl.readPixels` in the SAME synchronous block
as `renderer.render` — the canvas does not preserve its drawing buffer.
Average over an EXACT object mask (render once with meshes hidden, once
shown, difference), never over the whole frame.

**A PICTURE, NOT ONLY A MEAN.** The first a2.25 rim model measured a clean
monotonic response to the width slider and was wrong — it lit four corner
dots, not a band. Only the screenshot showed it. v2.9 spent two tries on a
ring whose numbers were healthy and whose picture was a halo. The probe emits
`canvas.toDataURL()` into the DOM and the runner writes the PNGs out; Desktop
Commander's `read_file` returns them as images. **Look at them.**

**Build the shape whose answer you already know.** The probe builds a ridge,
four coplanar quads, n-gons, a lone triangle, an annulus, an L-shape, a
sphere, a filleted cylinder and 8-, 12- and tapered tubes, and asserts which
model each must choose. That harness is what turned this from guesswork into
a fifteen-minute loop.

**Add the check BEFORE the change it is meant to catch.** v2.8c removed the
`#n` fork on a reading of the code that looked airtight; the check written
one commit earlier caught it in the same run. That is the only reason the
fork is still there.

**A broken copy, or the check proves nothing.** Every `_*chk` is run against
a deliberately broken build as well as a good one. v2.9 needed TWO: the first
removed the rings and the probe stopped at check one, proving only that check
one worked; the second kept them and starved `ensureEdgeField` instead, which
reached the five checks that describe the actual bug and failed all five.
**If a broken copy stops early, it is not the broken copy you need.**

**Run a reviewer after any substantial shader or geometry work.** Across
a2.24–a2.27a it found 3, 5, 7, 4 and 4 real defects and zero false alarms —
including two regressions the measurements could not see. On v2.9 it found no
correctness defect but four real things: a camera position written twice
nineteen lines apart, two comments the change had made false, an undocumented
side effect on bevel thumbnails, and a debug export that builds what it is
asked about. It also disproved a comment I had reasoned rather than measured.
