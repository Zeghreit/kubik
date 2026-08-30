# Kubik — current state

Single-file browser 3D low-poly mesh editor. "A fidget for 3D artists":
relaxing, one-handed, mobile-first. three.js from CDN, no build step.

- Live: https://zeghreit.github.io/kubik/
- Repo: `C:\Users\a.bodrov\Projects\kubik` (index.html is ~16,800 lines)
- Version at time of writing: **a2.43a**
- **Versions are now named `a2.0`** — alpha 2.0 — and stay that way through
  the pre-2.0 list below. The clean **2.0** is claimed at release and not
  before. Fixes still take a letter (`a2.0a`); new work takes a number
  (`a2.1`).
- Debug: append `?debug=1`. Tap picks log a `[pick] ...` line explaining why
  a tap resolved as it did, every mesh edit logs a `[winding] ...` line (see
  Winding audit), and `window.__kubik` exposes the live app (see Testing
  loop).

This file describes the app AS IT IS, not how it got here. Version numbers
appear only where they explain why something is the way it is. It was
rewritten at v1.93 because it had accumulated per-version sediment and had
begun contradicting itself — a handoff that argues with itself is worse
than none. Prefer rewriting a section over appending to it.

## Versioning

**Numbers for new work or reworks** (v1.85 → v1.86). **Letters for bug
fixes** (v1.85 → v1.85a → v1.85b). A change is a letter unless it lets the
app do something it could not do before. Fixing three broken things is
still a letter — this was got wrong once, at v1.86, which should have been
v1.85d.


## The a2.7f -> a2.16a wave (2026-08-24/25) - READ BEFORE OLDER SECTIONS

Everything below this section describes the app before this wave and
stays true unless contradicted here. Deeper detail lives in the project
docs (claude/materials-roadmap.md, claude/crosstest-findings.md,
claude/kubik-orientation.md).

**Icons (a2.7f).** Redesigned: cap (open iso cube + solid lid), bevel
(flat-cut upper-right corner) + NEW `fillet` key (round corner), loop
(dashed seam), bridge (two edges + ghost band), separate (two cubes +
dashed vertical), `mirroraction` (new key for the Object-ring action;
the Symmetry pill keeps `mirror`). The trash `del` serves ALL deletes -
user decision, do not re-split. Pixel laws: dash gaps under ~4.8 units
fuse (round caps eat 1.6 per gap); detail under ~1.8u collapses at ring
size; never dash a diagonal.

**Ring seats (a2.8 + a2.10).** Every tool entry carries `seat` (0 = up,
clockwise, 7 = down) on one 14-seat compass shared across rings - same
op pulls the same DIRECTION in every ring (Delete is always down).
toolRingAngles sorts by seat, spreads evenly over the FULL circle (no
gaps) and rotates by a circular-mean phase to best fit the bearings.
Empty-scene and world rings keep their old layouts.

**Materials are LIVE ASSETS (a2.9 -> a2.15).** The finish system became
a material library:
- MATERIALS Map of defs {id, name, color|null, roughness, metalness,
  envMapIntensity, preset, masks?}. Presets keep ids standard/plastic/
  metal (the old finish keys - old saves parse natively). color null =
  follow the theme (themedDefault still drives applyTheme's retint).
  Chart values: Solid r1.0/m0, Plastic r0.4/m0, Metal r0.25/m1.
- COLOUR LIVES IN THE MATERIAL (user decision). Painting = applying
  materials, Blender-slots style. The drawer colour picker is REMOVED;
  per-face colour no longer exists as a separate thing.
- userData.finishes = per-face-group material-id map (name kept for
  save/undo compat). applyFinish(mat, id) applies the WHOLE definition
  and is the single funnel every path goes through; it has NO blanket
  needsUpdate (it runs per slider tick). updateMaterialEverywhere(id)
  propagates a definition edit to everything wearing it, live.
- The library is GLOBAL AND PERSONAL: localStorage 'kubik.materials.v1'
  {customs, presetOverrides (incl. masks), nextNum}. Project JSON embeds
  materialLib; restoreDoc merges unknown ids into the library (never on
  the undo path - undo never rewinds appearance).
  harvestLegacyMaterials() turns legacy per-slot colours into deduped
  custom defs on load. Applying a material schedules autosave.
- UI: the materials fly-out sits under the view cube - slim tab flush to
  the right SCREEN edge (env safe-area inset only, NOT --edge-r), tray
  of real rendered sphere previews (lazy throwaway 104px renderer), tap
  applies (per-face in Face mode, per-object otherwise), pencil on the
  active card or a 500ms long-press opens the editor INSIDE the tray
  (#matEditor: colour/metal/rough live sliders, presets Reset to chart
  defaults + mask cleared, customs Delete with fallback to Solid, '+'
  forks the applied def and applies it).

**Procedural mask STACK (a2.15, rebuilt a2.20, types a2.21).** def.masks is an ARRAY
of up to MASK_SLOTS (4) masks; mask i owns channel i of ONE 128px RGBA
DataTexture per def (_maskTex map), sampled TRIPLANARLY in OBJECT SPACE
with one tap set for all four. Each mask is
{on, type, blend, colorOn, color, roughOn, rough, amount, scale,
detail, contrast, seed, img?}; blend is normal|multiply|screen|overlay and
the colour and roughness components switch on and off independently.
type is one of MASK_TYPES: fbm (Clouds), voronoi (Cells), scratches, dots,
stripes, image. EVERY field must TILE - the triplanar sample repeats it
three ways and a seam draws a straight line down the model.
DataTexture, not CanvasTexture: Canvas 2D is PREMULTIPLIED, so packing
four masks through a canvas corrupts the channels the shader reads.
Legacy `masks: {color:{...}}` is migrated by normaliseDefMasks, wired
into getMaterialDef - and ALSO called by saveMaterialLibrary and
serializeDoc, which read MATERIALS raw and would otherwise judge a
legacy mask "no change" and delete it on the first save.
WHAT COSTS WHAT: colour, roughness, amount, scale and blend mode are
pure uniforms. detail, contrast and seed re-bake the texture in place.
Adding, removing or switching a mask or a component on or off is ALSO
uniform-only (an off mask is amount 0, and the shader source is the same
for one mask as for four) - the ONLY recompile left is crossing between
"no patch" and "a patch". Nothing in the editor bumps the generation.
TRIPLANAR is decided policy - no UV tools, no box projection.
TWO LAWS, learned the hard way (a2.16a, cross-material GPU corruption
and dead clones before them):
1. customProgramCacheKey must NEVER be constant - three.js runs
   onBeforeCompile only when the material holds no program under the
   key. Key = 'kubik-colormask:' + defId + ':' + d.maskGen, read live
   from the _maskKey WeakMap so a material that CHANGES definition stops
   naming the old one. The generation is per DEFINITION so every wearer
   shares one program. a2.20 broke this law once and the whole stack
   rendered identically - see the a2.20 section.
   AND THE PART THREE.JS WILL NOT DO FOR YOU: on a program cache HIT
   three returns the program without re-running onBeforeCompile AND
   without repointing materialProperties.uniforms, which still names
   whichever program compiled last. So a material coming BACK to a key
   it once compiled under renders from another program's uniforms and
   every slider writes into thin air. _maskUniforms is therefore a Map
   PER KEY per material, and a material returning to a key it already
   used gets a private '#n' suffix that guarantees the miss.
2. NEVER store uniforms/textures in material.userData - Material.clone
   JSON-copies userData. Patch state lives in module WeakSet
   _maskedMats + WeakMap _maskUniforms; ensureMaskPatches (called from
   refreshUI) re-dresses clones after duplicate/separate/detach/join.
   Probe from tests: __kubik.isMaskPatched(mat).
The fillet preview re-dresses its cloned materials from finishes.

**New ops (a2.11).** Merge (Vertex ring): merge-by-distance,
MERGE_EPS=0.01 grid clustering to centroids (exact coincidence <=1e-4
is already one logical vertex by construction); relational -> runs once
per symmetry side like Weld. Detach (Face ring): selected face groups
become a new object (separateObject's remap pattern; materials/
smoothing/finishes travel; the source keeps the hole via
deleteFaceGroups; refuses detaching every face).

**The view cube is a CONTROL (a2.12/a/b).** Tapping an axis dot swings
the camera (ViewHelper) and snaps to an orthographic look: long-lens
emulation on the SAME PerspectiveCamera - fov to 2, distance x~26.7,
near to 5% of tele distance, far scaled up, and the FOG BAND shifted
out by the same amount (fog silently ate the whole scene before that).
A manual orbit gesture restores perspective exactly. animateCameraTo
leaves the flat view first. LAW: anything
that ever moves the camera far must carry far plane + fog band + near.

**Crease = sharp edge in SHADING too (a2.16/a2.16a).** applyShading
builds per-vertex normal islands (face groups connected through
non-creased edges) and smooth normals average only within an island -
a creased loop is ONE sharp line on a smooth surface, neighbouring
rings untouched. Edge-mode Shade now creases/uncreases the selected
edges instead of flattening adjacent face groups.
creaseSelection/clearAllCreases re-apply shading. undo/redo now
refresh the autosave (it used to resurrect undone edits on reload).

**FIXED a2.16b - the crease-shading "hang" was an INFINITE LOOP, not a
cost problem.** The island flood fill read
`const nbrs = m && m.get(stack.pop())`, so when a vertex had no
adjacency map at all (`adj.get(l)` undefined - EVERY edge around it
creased) the `&&` short-circuited before `stack.pop()` ever ran and the
`while (stack.length)` loop spun forever. Pop first, then look the
neighbours up. Reproduced deterministically by creasing all 12 edges of
a plain cube - it was never about mesh size. Measured after the fix:
applyShading is ~linear (0.3 ms on a 6-group cube fully creased, 55 ms
on 1541 groups fully creased, 160 ms at 6144 groups). The crosstest
guess of "an effectively-unbounded cost in the crease-aware
applyShading" was wrong about the mechanism and right about where.

**FIXED a2.16d - a double-tapped run now JOINS the selection.** The
loop / ring / path / face-strip double-tap was the ONLY non-additive
selection path in the app: it did `App.selectedElements = sel`, a hard
replace, while App.multiSelect is permanently true and every single tap
and region select adds. So a second edge loop silently threw the first
one away and two loops could never be held at once - which is exactly
what Bridge needs, so its own house gesture could not feed it. User
report, and correct.

All four double-tap branches now go through `mergeRunIntoSelection(sel,
tappedIndex, msg, noun)`: it ADDS the run, and takes it back OFF again
if it was already selected, the way a single tap toggles one element.
The first tap of the double-tap has already toggled the tapped element
by the time the handler runs, so that one element is excluded from the
"already selected?" test - without that a fully selected loop always
looks one element short and can never be switched off.

The near-miss fallback (thin edges, second tap lands a few pixels off)
used to read `selectedElements.size === 1`, so it only ever worked on a
virgin selection - with a loop already held, a near miss fell through to
camera Focus. It now remembers the edge the last single tap picked, WITH
its screen position, and reuses it only within 900 ms and 40 px, bounds
-checked against the current edge count.

Measured on a twice-subdivided cube: three loop gestures accumulate
16 -> 32 -> 36 selected; repeating the first drops exactly that loop
(36 -> 20) and leaves the others. Face strips 16 -> 30 -> 14 the same
way. Known and accepted: a run that is entirely CONTAINED in a larger
selection reads as "already selected" and drops - repeat the gesture to
get it back.

**NEW a2.17 - COLLAPSE EDGES, in the Edge ring.** Each connected RUN of
selected edges melts into ONE vertex at the run's centre: a selected loop
becomes a single point, two separate runs become two points, a lone edge
becomes its midpoint. Runs are the connected components of the selected
edges (union-find over their endpoints) and nothing else. Relational, so
like Weld and Merge it goes through runMirrored - handed a selection and
its mirror as one set it would find a run bridging the plane and pull
both halves onto it.

**Seat 2, and LOOP MOVED TO 9 to make room** (user decision). Seat 2 is
Merge's bearing in the Vertex ring, and collapsing an edge run is that
same gesture one component up - several things melting into one point.
Seat 9 is Flip normals in the Face and Object rings, which has no meaning
on edges, so nothing shares a ring with it here.

Three things this op needed that the older melt ops do NOT do:
- `removeTrianglesCarrying(obj, ed, mats, predicate)` - the group-index
  -safe filter. Dropping an empty group renumbers everything after it, so
  smoothGroups and finishes have to be rebuilt against the new numbering.
  It returns {mats, smooth, fin} and writes NOTHING to the mesh, so the
  caller can still find the mesh fully degenerate and bail. **Weld, Merge
  and the delete paths still call the old removeTriangles and still have
  that shift latent in them** - own increment, own testing.
- CREASES ARE KEYED BY POSITION and this op moves vertices, so the crease
  map is rebuilt through the same moves: both ends inside one run means
  the edge is gone and so is its crease; one end inside means the key is
  remapped. Left alone they would silently vanish or alias onto whatever
  later landed on that position.
- logicalPos reads the LIVE mesh while only ed.positions is written, which
  is what makes the runs order-independent. Do not "optimise" it to read
  ed.

Measured: plain cube one edge 8 verts -> 7, 12 edges -> 11, still 1 shell
/ 0 boundary / 0 non-manifold / 0 reversed; two separate edges -> 2
points, clean; twice-subdivided cube, a 16-edge loop -> 1 point, 98 verts
-> 83, audit clean but **2 SHELLS - the cube is pinched into two lobes
meeting at one point.** That is the correct output for this op (it is how
you make a pinch on purpose) but note auditWinding does not look for a
non-manifold VERTEX, so a clean audit is not proof here. Moved and
rotated object: the point lands on the LOCAL midpoint. Symmetry on: one
edge selected collapses on both sides, 40/40 verts, clean. All 12 creases
on a cube: 11 survive the collapse of one edge, none degenerate, none
dangling. capture/restore round-trips all three maps.

The icon (`>` dot `<`) was chosen by SCREENSHOT at the 26px the ring
actually uses. The first try - arrowheads with tails touching a centre
dot - fused into one blob and read as an asterisk.

**FIXED a2.17a - FINISHES IS NOW DERIVED, NOT MAINTAINED.** User report:
"materials behave strangely when geometry changes - one should apply the
material again to reproject". Correct, and it was two bugs wearing one
coat. userData.finishes maps face-group index -> material-def id, and it
was kept by hand, per op. Ops that GROW faces (extrude, inset, bevel,
split, knife, bridge, cap) push a CLONED material per new group and never
added the matching entry; ops that DROP a group renumber everything after
it and shifted the map. updateMaterialEverywhere reads
`fin[gi] || 'standard'`, so a face with no entry silently belongs to the
Solid preset: it renders unmasked and editing the material it visibly
wears does nothing to it, until you re-apply by hand.

Measured before the fix, cube wearing one masked material: extrude 6
groups -> 10 but 6 entries, inset 6 -> 10 / 6, bevel 6 -> 7 / 6, delete
5 groups against 6 stale entries. Subdivide and Collapse were already
right, which is why it looked intermittent rather than systematic.

THE MODEL NOW: **the material remembers its own definition**
(`mat.userData.kubikDef`, stamped by applyFinish) and finishes is DERIVED
from the material array by `reconcileFinishes(obj)`, called inside
rebuildFromEditable - the one funnel every op passes through, and the only
place that sees the finished group list and the finished material array
together. This is the one thing that SHOULD live in userData: Material
.clone JSON-copies it, so a face grown by cloning the material of the face
it came from is BORN wearing the same definition. (The LAW is about live
uniforms and textures, which clone into dead snapshots. A string id is
exactly what wants copying.) A renumber then cannot shift anything,
because the map is rebuilt from the materials rather than carried.

Three supporting pieces:
- `stampFinishesOnMaterials()` runs at the end of restoreDoc. A saved
  scene stores finishes as a plain map and rebuilds materials WITHOUT
  applyFinish, so nothing is stamped on load - and the first op after
  loading would clone an unstamped material and lose the new faces again.
  Measured, and now covered.
- A stamp naming a definition the library no longer has (a custom the user
  DELETED while a face wore it) self-heals to Solid. Skipping it left the
  face showing the dead definition, mask and all, forever, while the UI
  reported Solid.
- `ensureMaskPatches()` is called from reconcileFinishes, not only from
  refreshUI. An id test cannot see whether a material is DRESSED: a clone
  landing at an index that already held the same id passes every check and
  is still unpatched, because the patch lives in a module WeakSet a clone
  is not in. Any path that edited and then saved, exported or rendered
  without a refresh was working on undressed materials.
- bridgeFacesOp no longer wipes finishes - there is nothing to wipe now.

Measured after, every op, cube wearing one masked material, WITHOUT any
manual refresh: applied 6/6, subdivide 24/24, collapse 6/6, delete 5/5,
extrude 10/10, inset 10/10, bevel 7/7, bridge 8/8, every entry correct and
every material mask-patched. Editing the definition after an extrude now
reaches 10 of 10 (was 6 of 10). Mixed materials: extruding a metal face
among plastic ones gives metal walls; deleting a face keeps metal on the
right face through the renumber. Save -> restore -> extrude carries. Cost:
reconcile plus ensureMaskPatches on 1536 groups is 0.4 ms.

**NEXT, from the same review: `smoothGroups` is STILL a hand-maintained
index-keyed map, so the delete-shift bug almost certainly still lives
there** - bridge wiping it is the only thing masking it. Same treatment
(derive it) or at least renumber it with the groups. Also noted: anything
that mutates a material OUTSIDE applyFinish must `delete
m.userData.kubikDef` or reconcile will re-apply the definition over the
manual change; and reconcile assumes group gi is drawn with mats[gi],
which holds because rebuildFromEditable emits identity materialIndex.

## a2.18 - SHADING MOVED OFF THE FACES AND ONTO THE EDGES

The per-face smooth/flat map is GONE. Every face is smooth; what breaks the
smoothing is an EDGE being sharp. This was the user's design, and it also
dissolved the bug queued behind it: `smoothGroups` was keyed by FACE-GROUP
INDEX, exactly like `finishes`, and the a2.17a bug was sitting in it waiting
its turn. There is no index-keyed shading state left to shift.

**How an edge decides it is sharp**, in order:
1. `userData.edgeShade[key] === 'sharp'`
2. `userData.edgeShade[key] === 'smooth'`
3. anything other than exactly TWO faces -> sharp (a rim has nothing to blend
   with, a non-manifold seam must not blend). This is checked BEFORE the
   marks: Shade Smooth writes 'smooth' onto rim edges where it does nothing,
   and a later Bridge or weld giving that edge a second face would otherwise
   let an invisible stale mark beat the angle.
4. otherwise sharp if the two faces turn by more than SHARP_ANGLE.

**SHARP_ANGLE is 33 degrees, not 30, and the comparison carries an epsilon.**
A regular 12-sided prism meets itself at exactly 30, so a 30 threshold puts
every edge of that ring on the knife edge of a float compare - some sharp,
some smooth, changing as the object turns. 33 lands between the 12-gon (30)
and the 10-gon (36) and on no regular polygon at all.

Rule 4 is the point of the whole model: a fresh cube is crisp and a
subdivided sphere is smooth with NOTHING stored, and a wall grown by Extrude
is born crisp without the op having to remember anything.

**SHARP IS NOT CREASE.** They are separate marks in separate maps. Crease
means only "hold this edge through Subdivide"; Sharp means only "break the
shading here". An edge can carry either, both or neither, and creaseSelection
no longer calls applyShading.

**Tools.** Edge ring: `Mark Sharp` (seat 10) is a two-state toggle - marking
edges that are already all sharp CLEARS them, back to angle-decided. `Crease`
(seat 11) is now the same shape of toggle. `Uncrease` is gone, because the
second tap is the off, and `Shade` is gone FROM THIS RING because it did the
same job as Mark Sharp there - it keeps seat 8 in Face and Object. Face and
Object `Shade Smooth` marks every edge of the selection smooth EXCEPT any
already marked sharp - "smooth everything except sharp" - and `Shade Flat`
marks them all sharp.

**Both marks are drawn in the viewport**: crease colour for creases, a warm
`SHARP_COLOR` for sharp, sharp checked last so an edge carrying both reads as
the one you can see in the render.

**POSITION KEYS AND DRAGGING - the thing that nearly shipped broken.** Both
maps are keyed by position pair, and a drag changes positions, so every mark
on a moved vertex's edges was orphaned the instant a drag began: the
sharpness fell back to the angle rule mid-drag and the dead entry stayed in
the map, ready to resurrect on whatever later landed on that spot. A drag
cannot change TOPOLOGY, so `snapshotEdgeMarks` records the marks against
logical edge pairs when the drag context is built and `rewriteEdgeMarks`
rebuilds both maps from that snapshot after every move. **Creases had this
flaw all along** - unnoticed because a crease only pays out at Subdivide,
while sharpness is on screen every frame. Fixed for both.

`captureObjectState` / `restoreObjectState` now carry creases and edgeShade
too. A cancelled op used to put the geometry back and leave whatever creases
it had written - a long-standing gap that started to matter a lot once
shading moved onto the same kind of map.

**Subdivide splits marks onto both halves** of every edge, like it already
did for creases - looked up by the edge's ORIGINAL endpoint positions, since
smooth subdivision MOVES the originals. A first attempt used the moved
positions and silently lost every mark.

**Migration is per MESH, on load, only when a doc has no `edgeShade` key at
all** (an empty map means "all angle-decided", not "not migrated"): every
edge of a face that was flat becomes sharp, and every existing crease also
becomes sharp - creases keep their own map and their Subdivide meaning, they
are merely also marked so the file opens looking the same. Old all-flat cube
-> 12 marks, 6 normals, identical. Old all-smooth ball -> 0 marks. Old
all-smooth + a creased loop -> 32 marks, identical to how a2.16 drew it.

**Measured** (unique normals is the proxy for how it looks): fresh cube 6 / 0
marks; smooth-subdivided 384-face cube 386 / 0; extruded wall 6 / 0; inset
6 / 0. Cube Shade Smooth -> 8 normals and 12 smooth marks, then Shade Flat ->
6 and 12 sharp. Smooth ball + one 32-edge loop marked sharp -> 386 -> 418
(one hard ring); tapping the same loop again -> back to 386 and no marks. A
sharp mark survives a later Shade Smooth. Marks double correctly through two
Subdivides (16 -> 32 -> 64). Creasing changes shading not at all.

**Performance: no regression, and better where it counts.** applyShading now
always does the island work, where the old one early-returned when nothing
was marked - but the pass was rewritten onto NUMERIC edge keys (the old one
built strings like 'l_g' in its hot loop) and does the whole thing one vertex
at a time with nothing global stored. 1536 groups: old 15 ms unmarked / 55 ms
creased, new 15 ms unmarked / 29 ms fully marked. It runs on every drag move,
so this mattered.

**Known and accepted:** Join (`combineObjectsInto`) bakes world transforms
into a new local space, so position keys would be meaningless and it carries
neither creases nor marks - the angle rule takes over. A strongly non-planar
n-gon decides its own boundaries by its area-weighted average normal, which
can read false-sharp or false-smooth; comparing the two TRIANGLES either side
of the edge would be exact. From Face or Object mode there is no way to clear
a stubborn sharp mark - Edge mode's toggle is the escape.

## a2.19 - SMOOTH BY ANGLE, on the Object ring (seat 11)

A live op on the existing op bar: the "amount" is a THRESHOLD IN DEGREES and
the preview is the shading itself, which is the one thing you cannot judge
from a number. OK commits, Cancel puts everything back.

**It stores a per-object angle, not baked marks** (user decision).
`userData.autoSmoothAngle` overrides the global SHARP_ANGLE for that object,
so geometry made LATER still obeys the angle you chose - a face extruded
tomorrow follows today's setting, which a baked set of per-edge marks could
never do. `effectiveSmoothAngle(mesh)` is the single place that knows
"no angle of its own means the app default"; it is written out rather than
`angle || SHARP_ANGLE`, which would quietly treat a deliberate 0 as unset.

**It clears the object's hand marks** (user decision), so the preview shows
exactly what the angle gives with no invisible leftovers fighting it. The
snapshot holds them, so Cancel puts them back - and this doubles as the only
way to clear a stubborn mark from Object mode, which a2.18 had no answer for.
The confirm toast says how many marks it cleared, because that is the one
destructive thing the tool does.

**Range is 0-180, not 0-90.** The test is the angle between two face
normals, which runs the whole half-circle: at 90 an edge whose faces fold
back on each other - a spike, a fin, a thin shell - could never be smoothed.
90 is merely where a plain cube turns over.

**Degrees on disk, radians in memory.** The file carries
`autoSmoothAngleDeg` and it is clamped on load. A bare unitless number in
JSON is a trap: anything later writing 33 meaning degrees would be read as 33
RADIANS and the model would shade like nonsense while the bar read 1891.
Docs without the key simply get the default, so there is nothing to migrate.

**Measured.** Smooth-subdivided cube, 96 faces: sweeping the angle gives 0 deg
288 normals (fully faceted), 20 deg 206, 33 deg 98, 45-90 deg 98 - monotonic
and live. Plain cube: faceted to 89 deg, smooth at 90. Cancel with TWO objects
selected, each carrying 4 hand marks: both lose them during the preview and
both come back to 4 marks, the original shading and the default angle.
Confirm at 47 deg round-trips through save and load. After confirming, an
extrude keeps the object's angle and the new walls obey it.

**Reviewer notes not acted on:** opening a ring op while another op is
pending overwrites the pending one - pre-existing for every entry in every
ring, not specific to this tool. And once an object has its own angle there
is no "back to default" affordance; setting the slider to 33 is the same
value but not the same state.

**KNOWN OPEN ISSUES (crosstest 2026-08-25, unverified findings in
claude/crosstest-findings.md) - fix order as agreed:**
1. DONE (a2.16b) - see above.
2. DONE (a2.16c). Bridge between two CLOSED edge loops. edgeChains walks
   the selected edges and never steps onto a seen vertex, so a RING came
   back as an open path: an n-edge loop read as n vertices / n-1 edges.
   Bridge then built n-1 walls (the open slit) and matched the two runs
   by their ENDS, which for two rings pairs A's near corner with B's far
   one (the overlapping walls). Both symptoms, one cause. Fix: chains
   record `closed`; two closed rims that are each exactly one face
   group's outline now delegate to bridgeFacesOp (the rim of a face IS
   that face - same result as bridging the two faces, caps dropped,
   winding inherited); genuine open rims fall through to a ring path
   that walls all the way round and picks the phase with
   chooseRingOffset; one closed + one open now refuses with a message
   instead of quietly slitting. Measured, two joined cubes, both top
   rims: BEFORE 3 walls, 15 groups, 3 shells, 2 boundary, 6
   non-manifold, audit FAIL. AFTER 4 walls, 14 groups, 1 shell, 0/0/0,
   audit PASS - identical to the face bridge. Also clean at 3 sections
   curved, 2 sections straight, and on rims left open by deleting the
   caps first.
3. AMBER: Connect across a quad's diagonal silently no-ops (violates
   the silent-no-op rule). AMBER unconfirmed: creases may not hold
   through smooth Subdivide - needs a clean repro.
4. Perf backlog: ensureHelpers builds one overlay mesh+material PER
   face group; subdivide rebuild is superlinear - MEASURED a2.16b on a
   cube, smooth subdivide: L3 26 ms, L4 191 ms, L5 1454 ms (roughly
   x7.6 per level for x4 the data), so L6 would be the >10 s freeze the
   crosstest agent hit and probably misattributed to shading; one
   MeshStandardMaterial per face group (structural fix = shared
   instance per material def). Three audit sweeps never ran (mobile/UX,
   static correctness, static perf) - resumable.

**Next planned work:** NORMALS, derived from the masks that already exist -
a mask is a greyscale field and a normal is its slope, so every noise type
becomes a bump for free and it lands as a third checkbox beside Colour and
Roughness. Triplanar normal mapping needs no UVs (each of the three planar
projections has a trivially axis-aligned frame), so the no-UV policy
survives. It needs the environment, which is why a2.22 came first: a bump
is visible because it redirects reflections. Then cavity and curvature.
Other candidates from the backlog: repoint Weld/Merge/delete at
removeTrianglesCarrying (top code-health item); Connect across a quad's
diagonal silently no-ops; the superlinear subdivide rebuild; one
MeshStandardMaterial per face group (a per-def shared instance is the
structural fix and needs its own discussion); masks do not export to glTF
(bake-to-UV at export). Icon sweep findings deferred (weld/connect/merge
now share the Vertex ring - revisit those three icons TOGETHER).

## a2.20 - THE MASK STACK

Four masks per material instead of one, packed one per RGBA channel of a
single texture, each with a colour component and a roughness component
that switch on and off independently, and one of four blend modes.

**The editor is a chip row, not four stacked panels.** #mkChips shows one
numbered chip per mask plus "+" while a slot is free; one set of controls
edits whichever chip is active. Four masks' worth of controls in a 176px
column would have been a scroll from the first mask to the last. Tapping
the chip you are ALREADY on toggles that mask off and on - the same
second-tap-is-the-off rule the edge marks use - and an off mask keeps its
seat, greyed, so you can see it is there and switched off. "Remove"
deletes it outright.

**Uniform-driven end to end.** uKubikCount / uKubikColor[4] /
uKubikAmount[4] / uKubikScale[4] / uKubikBlend[4] / uKubikColorOn[4] /
uKubikRoughOn[4] / uKubikRough[4]. The weights are computed once in
<color_fragment> into a global float kubikW[4] and read again in
<roughnessmap_fragment> - three runs colour first. kubikPick selects a
channel with a dot against a selector rather than s[i], so the shader
stays legal if the renderer ever falls back to WebGL1.

**LAW 1 caught a real bug here.** The first cut of the stack captured
`_maskGen` once and never advanced it, so the cache key was constant,
the first compiled program was the only one that ever ran, and EVERY
mask configuration rendered identically. Per-definition d.maskGen fixed
it. Then the opposite mistake: bumping on every checkbox minted a
program per click that three never releases (its per-material programs
Map is never pruned) - 40 taps, 40 retained programs and 40 compile
stalls. Both gone: structural changes are uniform-only now.

**The frozen thumbnails.** One SHARED preview material walked the whole
library on every pass, so it left and returned to every masked
definition's key constantly and hit the three.js cache-hit wart above -
the thumbnails froze at whatever the first pass compiled, and unrelated
materials bled into each other (6 unique previews out of 10). Now one
preview material PER definition, created once and kept (disposing them
handed the program back to three and recompiled it on the next slider
release). Measured after: 10 unique previews out of 10, and a full
edit-and-churn pass costs 0 new programs.

**Verified, on the real UI and by pixel diff of the viewport:** all four
blend modes distinct; colour and roughness components independently
distinct; add/remove/on/off distinct and exactly reversible (on-off-on
returns to within 2 pixels of +-1); a 4-mask stack round-trips through
save/load byte-for-byte; a legacy `{color:{...}}` library entry survives
the upgrade and migrates to the array; 30 component toggles add 0
programs.

**Known, unchanged by choice:** restoreDoc still only adopts a material
definition the local library does not already have, so opening someone
else's file on a machine that has its own `standard` keeps the local
one - masks and all. Pre-existing rule; it now hides more.

## a2.21 - NOISE TYPES, AND YOUR OWN PICTURES

Six kinds of mask instead of one. Clouds is the old FBM; Cells is Voronoi
F2-F1 (bright inside a cell, dark along the wall); Scratches walks tapered
lines with a wrapping splat; Dots is a jittered grid with a quarter of the
cells left empty so it reads as speckle rather than polka dots; Stripes
rides an INTEGER lattice direction with an FBM wobble; Image is a picture
from your disk.

**Tiling is the constraint everything here is built around.** The site GRID
wraps while the site POSITION does not (Voronoi); the splats index with a
modulo, so a scratch running off one edge comes back on the other; the
stripe phase advances by a whole number of periods across the tile in x AND
in y, which is why the direction is rounded to an integer lattice vector
rather than taken from the angle directly. Measured seam-vs-interior
gradient for all five procedural types: equal to within noise.

**One control doing five jobs.** The Detail slider is relabelled per type -
Detail / Cells / Count / Density / Bands - and hidden for an image, and
"New pattern" hides too because a picture has no seed. The type itself is a
`<select>`, not another chip row: six types would have been three more rows
of buttons in a 176px column, and the native picker is a bigger target on a
phone than anything we could draw.

**Type changes are re-bake only.** The GLSL is type-agnostic - it reads
channel i by uniform and knows nothing about what drew it - so nothing here
recompiles. `rebakeMaskTexture(d, i)` re-bakes ONE channel, which is what
the Detail/Contrast/seed/type paths use; the three untouched masks are left
alone. Full four-type bake: 7.3 ms.

**Pictures.** Loaded through an object URL (never base64 - that would be
~134 MB of string for a 50 MB photo to sample 16384 pixels), redrawn onto a
WHITE ground so a logo on transparency is not black on black, centre
CROPPED rather than squashed, and re-encoded as a 128px PNG data URL. That
small square is what is stored - in the library and in every project file
that references the material - typically about 1 KB. Files over 25 MB are
refused with a toast.

**Three things the review caught, all fixed, all worth remembering:**
1. The decode is ASYNC and used to resolve its target material from
   `matEditingId` when it FINISHED. Close the editor while a phone photo
   decodes and the re-bake went to `standard` (which is what
   `getMaterialDef(null)` answers) while the real material stayed blank
   until a reload. The definition is captured when the file is PICKED, and
   the completion checks `MATERIALS.get(d.id) === d` before touching it.
2. Selecting "Image" used to open the file picker for you. A dismissed
   dialog fires no event you can rely on across browsers, and the mask was
   then stuck as an image with no picture and no control that did anything.
   "Choose picture" is one tap and cannot dead-end.
3. `mk.img` is only ever used after `maskImageSrc` has checked it is a
   `data:image/` URL. A project file is JSON someone handed you; a remote
   URL in there would have the viewer's browser call home the moment they
   opened the model, from a static origin with no CSP to stop it.
`pruneMaskImages()` drops the decoded fields and the data URLs nothing
wears any more - on type change, on replace and on material delete.

**Say it plainly:** a loaded picture is EMBEDDED in the project JSON.
Sharing a .json ships a 128px copy of that photo inside it.

## a2.22 - THE ENVIRONMENT STOPPED BEING ONE HARDCODED ROOM

Six procedural studio setups, baked from parameters instead of loaded from
an .hdr, plus Turn and Strength. Drawer, under Appearance.

**Why this before anything else in materials.** It is the MULTIPLIER on the
rest. Metalness has no diffuse component - a metal IS its reflection, so
with nothing to reflect it renders almost black; roughness blurs
reflections, so it is invisible unless the environment has contrast to
blur; and a normal map (next) shows only because it redirects reflections.
All three were reporting on one fixed RoomEnvironment until now.

**Procedural is a STORAGE decision as much as a look.** A preset is about
fifteen numbers, so a project file carries its own lighting for a couple of
hundred bytes. An .hdr is megabytes and could not be embedded, which is what
made "custom HDRI" awkward when it was first planned.

**A light is a RECTANGULAR PANEL.** The shape of a highlight is most of what
makes a render read as studio: a softbox leaves a soft-edged rectangle on a
glossy surface and the eye knows what that means. Panels are projected onto
their own plane at unit distance, so one seen at an angle foreshortens the
way a real one would.

**FLOAT data, not 8-bit.** The HDR in HDRI is the sources sitting far above
white - the Studio key peaks at 14.1. An 8-bit texture clamps that to 1.0,
which does not error, it just renders flat and plasticky and is very hard to
diagnose afterwards. Same family as the premultiplied-canvas trap.

**THREE'S EQUIRECT CONVENTION, and the bug it caused.** three samples
u = atan2(z,x)/2pi+0.5 and v = asin(y)/pi+0.5, and DataTexture sets
flipY = false, so row 0 is v = 0, which is y = -1, the BOTTOM. The first cut
wrote row 0 as the top and swapped x for z with it - a 180 degree rotation
about (1,0,1). Every key light was under the floor, the ground was overhead
and Turn ran backwards, and it all looked entirely plausible. Caught by
review, then confirmed with one bright panel pointing straight up: top face
6, side face 199. THE TEST THAT SETTLES IT is a six-axis probe - a white
diffuse plane facing each world axis in turn, rendered under a one-panel
environment aimed at that axis; the brightest face must be the one the panel
points at, for all six. It is in the session log and worth rebuilding for
any future change to the bake.

**512x256, measured not guessed.** PMREM derives its cube size as width/4,
so this is the one number that sets reflection sharpness. Against a 1024x512
bake, on mirror-polished metal at roughness 0.02 - the worst case there is -
512 differs by at most 19/255 and 0.01 mean, while 256 reaches 66/255, which
shows. Bake cost 5 / 18 / 89 ms for 256 / 512 / 1024.

**Turn and Strength are FREE.** `scene.environmentRotation` (Euler) and
`scene.environmentIntensity` are live properties in this three - no re-bake,
no prefilter, no recompile. Verified exactly reversible. Only the preset
costs a re-bake (~70-115 ms all in).

**The thumbnails prefilter the same equirect through their OWN renderer**,
because a prefiltered texture belongs to the context that made it. The
source data is plain numbers and travels fine. That work is DEFERRED to
renderMatPreviews rather than done on the preset change, so a preset switch
with the shelf shut pays nothing for pictures nobody is looking at. And
matPreviewRig calls applyEnvLive when it is built: the rig is lazy, so it
missed every earlier call and opened its first shelf lit at rotation 0 while
the viewport was at 180.

**Also from the review:** a zero-width panel divides by zero and ONE NaN
texel is smeared over the whole radiance map by the blur - black materials,
no error anywhere - so w and h are clamped from below as well as above.
DataTexture defaults to NearestFilter, so the downsample into the cube was
point-sampled and panel edges stair-stepped; it is LinearFilter with
RepeatWrapping on S now. Strength has a floor of 0.1 because 0 turns every
metal black with nothing on screen to explain why.

**Known, pre-existing, now more visible:** `scene.environmentIntensity`
REPLACES `material.envMapIntensity` rather than multiplying it (three writes
it straight into the uniform for any standard material with envMap === null
and a scene environment). So the per-definition envMapIntensity - Solid 0.5,
Plastic 0.7, Metal 1.0 - has done nothing since the day scene.environment
was first set. Not introduced here. Decide during the shelf revision whether
to drop the field or make it multiply.

## a2.22a - THE LIGHTS BECAME PART OF THE PRESET

Reported as "environment changed, but switching to other types not changing
anything, so as turning and strength sliders". Real, and my testing had
hidden it twice over.

**What was actually wrong.** Four analytic lights - hemisphere, key, fill,
rim - were doing the lighting, fixed, and the environment was a wash on top.
On the DEFAULT Solid material (roughness 1, metalness 0) a fully-rough
non-metal sees only irradiance, never a reflection, so six presets of
similar total energy all landed in the same place.

**Two testing mistakes worth not repeating.**
1. Every earlier measurement was taken with metalness cranked to 0.9-1,
   because that is what shows an environment best. The default material -
   the one every new scene wears - was never measured. Test the DEFAULT, not
   the flattering case.
2. The pixel metric averaged over the WHOLE FRAME. The object is about 1% of
   the canvas, so a real 48/255 change on the model read as "mean 1.2" and
   looked like nothing. Average over the pixels that CHANGED.

**The fix: the analytic lights are derived from the preset, and no new data
is stored for it.** The preset already describes its lights - a panel has a
direction, a colour and a radiance - so the three directional lights are
aimed at the three brightest panels and tinted to match, and the hemisphere
takes sky/ground/ambient. Weight per panel is
`int * sin(w/2) * sin(h/2)`, normalised against Studio's key (3.708) so the
theme's key intensity keeps meaning what it used to.

**The theme still owns the baseline.** applyTheme sets hemi/key/fill/rim as
before and then calls applyEnvRig, which re-aims and re-tints on top. So
Daylight stays gentler than Workshop while the preset supplies direction,
colour and the relative weighting. WITHOUT that call the rig snapped back to
the theme's fixed directions on every theme switch.

**Turn now rotates the lights with the reflections.** Verified by
equivalence: turning by 70 degrees is pixel-identical (max 1/255) to baking
the same preset with its panel already at az+70, while turning the other way
differs by 92/255 - so the test is sensitive and the signs agree.

**The shadow caster's elevation is floored at 32 degrees.** Sunset's key sits
at 6, and a shadow cast from the horizon runs off the end of the shadow
camera and smears. Azimuth and colour still follow.

Measured after, on the default Solid material, mean difference per channel
over the object's own pixels: Studio vs Rim 48, vs Sunset 57, vs Neutral 70,
Turn 180 44. Softbox is the closest neighbour at 17 and still reads.

## a2.22b - EXPOSURE, AND LIGHTING LEAVES THE DRAWER

Two reports: too dull even at Strength 3, and "not informative to rule it in
the drawer - i have to close menu to see changes".

**A LIGHTING PRESET CHANGES CHARACTER, NOT EXPOSURE.** That is the rule this
settled on, and it is what the dullness was really about. Rim and Sunset are
authored dark on purpose; honouring that literally left them at half
Studio's brightness with no way back, because Strength scaled everything
including the deficit. A photographer relights and then re-exposes. So:
- every environment is normalised to the same mean radiance
  (`envNorm`, `ENV_TARGET_MEAN = 1.0`, tuned so the default cube lands at
  luminance 107 against the old fixed rig's 101);
- the theme's key+fill+rim is a BUDGET the preset spends by relative panel
  weight, not a per-slot multiplier - a2.22a scaled each slot against
  Studio's key, which starved every preset with smaller panels;
- the hemisphere is flat across presets. Its sky and ground COLOURS still
  come from the preset; its level does not, or the dark presets go dim
  again through the back door.
What still differs is direction, colour and contrast, which is what a preset
is actually for.

Measured on the default Solid material, object luminance at Strength 1,
before -> after: Studio 101 -> 107, Softbox ~95 -> 106, Sunset 43 -> 105,
Neutral 51 -> 86, Overcast 61 -> 77, Rim 54 -> 67. Rim and Overcast stay
lower by design - they are soft and dark setups - and reach 147 and 182 at
Strength 5. Presets remain clearly distinct: 16 to 45 mean per channel
against Studio.

**Strength now runs to 5**, and the shadow caster's elevation floor dropped
from 32 to 24: pushing the key high to keep the shadow tidy also put the
light on the TOP face, which is the one face you are usually not looking at.

**The controls moved into the viewport** as `#lightBar`, above the undo row.
Turn and Strength are judged entirely by what happens to the model, and a
control you have to close a menu to evaluate is a control you guess with.
Six chips plus two compact sliders, wrapping on a narrow screen, quiet
styling (panel background, no accent border) because unlike the op bar it is
always on screen. The drawer keeps a one-line pointer to it.

**Measurement note that cost two rounds here:** to judge "how bright is the
model", build an exact object mask first - render once with the meshes
hidden, once shown, and difference. Thresholding against the background
colour picks up the floor grid, which outnumbers the object and swamped the
average; the first attempt reported luminance 19 and no change at all
between Strength 1 and 3.

## a2.23 - LIGHTING BY GESTURE

The a2.22b bottom bar was rejected outright ("this bar is a mess"). The
replacement splits the two jobs by how often they happen.

**Type is PICKED, rarely: a pill under the Symmetry pill, with a menu that
falls out of it.** `#lightPill` / `#lightMenu`. Six rows, the current one
marked, closes on any pointerdown outside itself.

**Turn and Strength are ADJUSTED, constantly: a gesture, no widget at all.**
Hold TWO fingers still anywhere; the other hand then slides - ONE finger
turns the light, TWO change its strength. Lifting an anchor ends it. A
readout (`#lightHud`) sits top-centre, deliberately away from both hands.

Why a gesture rather than a control: Turn and Strength are judged entirely
by what happens to the model, and nothing you have to look at can be
watched and dragged at the same time. The drawer failed for that reason and
so did the bar.

**The gesture was free to take.** Two fingers already hand control to the
camera, but two fingers held STILL did nothing at all. Stillness is the
whole discriminator, so the test is travel (`LIGHT_HOLD_PX` 12) as well as
time (`LIGHT_HOLD_MS` 420). One finger and three fingers are untouched -
verified.

**Sliding fingers re-baseline whenever their count changes**, so going from
one finger to two does not jump the value it lands on.

**THE ONE THAT BIT: handing the camera back.** OrbitControls keeps its own
pointer list, its own captures and its own state machine, and its POINTERUP
HANDLER IS NOT GUARDED BY `enabled`. Switching it off mid-pinch leaves it
finishing a gesture that was taken away from it: a release for a pointer it
never captured throws inside its own handler, and the cleanup after that
line never runs. Measured: the camera was dead for the rest of the session
after one lighting gesture. Two things fix it -
1. `orbit.enabled = true` is deferred until `activePointers.size === 0`,
   never on the anchor lift, or it drops into a two-finger dolly whose
   starting distance it never measured;
2. it is re-armed from EMPTY - `_pointers` cleared, `_pointerPositions`
   cleared, `state = -1` - each guarded, because these are three's
   internals and not a contract.
Verified: three lighting gestures interleaved with orbits, camera working
throughout.

**And the ordering bug underneath it:** the resume check first lived in the
pointerup handler, which has five exits each calling `trackPointerUp` at a
different moment. It belongs INSIDE `trackPointerUp` - the one place a
pointer actually leaves the tracker. Checked before that removal, the last
finger up still counted as one finger down and the camera never came back.

**Desktop has no path to Turn and Strength** - user's decision, touch only.
The pill still picks the type.

## SHAPE MASKS: Cavity and Edges (a2.24 -> a2.29e)

Two mask types that take their weight from the model instead of a texture.
Cavity darkens crevices, Edges wears the exposed edges. They stack, blend
and drive colour and roughness like any other mask.

**They are built from the EDGES, and it took four wrong architectures to
get there.** Everything before a2.28 inferred where a model's edges were
from the FACES around them, and every version of that was even on some
shapes and wrong on others. The failures are the useful part of this
section - they are all the same mistake in different clothes.

### How it works now

1. `applyShading` writes `geometry.userData.kubikEdges` - the endpoints of
   every WEAR EDGE and whether it is convex or concave. This is O(E) and
   runs on every frame of a drag without noticing.
2. `bakeEdgeField` turns that list into a distance field over the object's
   own box: how far each point is from the nearest convex edge (red) and the
   nearest concave one (green). `ensureEdgeField` caches it on the geometry,
   rebakes when the edge list changes, and never while a finger is down.
3. `mat.onBeforeRender` binds that per-OBJECT field into the per-MATERIAL
   uniforms. It is the only place the two meet.
4. The shader reads the field at the pixel's object-space position, roughens
   it with value noise, and returns `1 - smoothstep(w*(1-blur), w, d)`.

A cube, a tube, a fillet, an L-plate and a ring all get identical treatment.
There is nothing to fit and nothing to fall back from.

**An edge is an edge if `wear` says so.** That map sits beside `sharp` and
answers a different question. It counts a CREASE - which since a2.18 has no
say in shading at all, but "hold this edge through Subdivide" is exactly
"this is an edge of the form", and it is the only thing in the app that can
say so about a fillet deliberately shaded smooth. A hand 'sharp' mark comes
first. The FACE COUNT still outranks a 'smooth' mark, because Object-mode
Shade Smooth writes 'smooth' onto rim edges wholesale and without the rule
one tap on an open plane deletes its whole outline with no visual cue.
`creaseSelection` and `clearAllCreases` call `applyShading` again for this;
a2.18 had deliberately removed that call.

**An outline edge is not any edge.** An edge a face uses TWICE is that
face's own triangulation - the diagonal of a quad - and `edgeUse` counts
uses PER FACE so the test is `computeTopology`'s: some face uses it exactly
once. Without it every quad has a phantom edge down its middle.

**Convex or concave: stand on one face and look at the OTHER face's far
vertex.** Below this face's plane means the surface folds away and the edge
sticks out. The plane is the local TRIANGLE's, not the face group's summed
normal - on a warped face the sum points nowhere useful, and after Flip
Normals it points inward and inverts every edge of it. Only for EXACTLY two
faces: one is a rim and three is a seam, neither of which has a well-defined
inside, and both are treated as exposed.

### The field

A 2D ATLAS of z-slices, not a 3D texture: `sampler3D` needs GLSL ES 3.00 and
three compiles its built-in materials as 1.00. Two bilinear taps and a mix.
The half-texel inset in `kubikFieldTap` is what keeps a tap inside its own
tile; without it every tile boundary draws a line across the model.

**RANGE is 15% of the object's largest dimension** and Width is a FRACTION
of it, so one material reads the same on a matchbox and on a battleship.
Past range the field saturates and the shader treats it as "nowhere near an
edge", which is what stops a wide setting from flooding the object.

**The grid is a BUDGET, not a fixed resolution.** Cost is edges times the
voxels each sweeps; at a fixed resolution a dense model is hundreds of
milliseconds, synchronously, inside the render. Coarsening shrinks both
terms at once and a coarser field is a slightly softer band, which for
weathering is no loss. On top of that: throttled to 120ms, stamped AFTER the
bake rather than before (or the throttle means "120ms between the STARTS"),
skipped entirely while `activePointers.size` is non-zero, and installed only
on a material that actually wears a shape mask.

**The atlas is disposed with its geometry** - `disposeEdgeField` in
`disposeObject`, `rebuildFromEditable` and `clearFillet`. `geometry.dispose`
frees buffers, not something hanging off userData, and this is up to a
megabyte. Undo alone disposes every object and rebuilds.

**`buildExportGroup` clears `eg.userData`.** `BufferGeometry.copy` assigns
userData by REFERENCE and `GLTFExporter` serialises it into `extras`;
without this every `.glb` carried the edge list and the whole atlas.

**The default when a mesh has no field is BLACK - distance zero, paint
everything.** That is the material preview ball, whose thumbnail has to show
what the mask does. And `onBeforeRender` puts that default back rather than
returning, or the uniform keeps whichever mesh was drawn before.

### Three sliders

**Width** a fraction of the field's reach. **Blur** how much of that width
the falloff takes, 0 a hard line and 1 a fade all the way in. **Noise** how
ragged the rim is. All three are live uniforms - a shape mask has no cloth
to re-bake. `MASK_TYPES` carries per-type label and bounds for all three,
written BEFORE the values or the range element snaps each to the old grid.

### Round edges, and noise that warps (a2.29 -> a2.29b)

Two things a survey of Substance, Blender and Marmoset said were missing.
`claude/wear-shading-prior-art.md` in the project has the survey; its short
version is that nobody publishes a distance-to-EDGE field, and the only
prior technique that works on an unbevelled cube is Substance's ray-traced
Sampling Radius, which is what a2.28 arrived at by another road.

**Round edges is a bevel with no geometry.** Blender, Marmoset and Redshift
all ship one; all three pay for ray probes, and Blender's own docs warn
theirs costs a fifth of render time. Ours is nearly free, because the
GRADIENT of the field already IS the direction to lean the normal. It lives
in the material editor, not the mask panel - it is a property of the
surface, not of a stack layer, and it works with no mask on the material at
all.

- **Four taps, not three.** Forward differences read `f(x)` and `f(x+h)`,
  and within h/2 of an edge the second tap lands on the FAR side of the
  distance function's V - so the normal leaned away and drew a raised ridge
  instead of a chamfer. That zone is a fixed fraction of the field, so at
  small widths it was most of the band. The tetrahedron (`e = vec2(1,-1)*h`)
  straddles the valley in every direction.
- **A gradient that is too short is not a direction - but too short means
  NEARLY ZERO.** Past the field's range every tap reads the same clamped
  1.0, the four cancel exactly, and what is left is 8-bit dust that
  `normalize()` blows up into full-strength speckle. A true distance field's
  gradient has a KNOWN magnitude, `4h^2/range`, so the bar is a physical
  quantity rather than an epsilon - and getting the number wrong cost two
  versions. `1e-12` was ten million times below the byte noise floor and
  never fired once. Half of expect, its replacement, fired everywhere it
  mattered: approaching an edge the taps straddle the V, so the sum
  SHORTENS, and it is under half for the last 9% of the range. Every Round
  edges below 0.09 was inert - the whole bottom of the slider - and
  everything above it got a flat strip down the crest of each edge. The
  length falls near an edge; **the direction does not**, and the direction is
  all `kubikBevelN` uses. The bar is now 10% of expect, about five times the
  quantisation floor. Both settings measured healthy at Round edges 0.5, so
  the probe now also asserts 0.06 - which read exactly `0.00` before.
- It runs after `normal_fragment_maps`, so a normal map still wins where one
  exists; it is skipped under `FLAT_SHADED`; and it needs the custom
  `uKubikNrmMat`, because `object.normalMatrix` is not declared for the
  fragment stage.

**Noise now WARPS the lookup instead of offsetting the result.** Adding
noise to a coverage value moves the whole band in and out together;
displacing the POSITION being sampled makes the rim itself wander, which is
what erosion actually looks like. Substance calls the same node a Warp. The
reach test still runs at the TRUE position (`kubikF0`), so noise can eat
into a band but can never start one on a face with no edge near it.

**Noise scale** joined Width, Blur and Noise, on shape types only. It is
expressed relative to the width, so widening a band does not turn its grain
into a different material - and the warp's AMPLITUDE is divided by it, so
Noisiness means "how deep the bites are relative to how big they are". Left
coupled, fine grain kept a coarse displacement and the top of the slider
moved the lookup thirty features: a scramble, not a warp.

**One predicate decides who gets patched.** `maskWantsPatch(d)` is read by
both `applyMaskPatch`'s early-out and `ensureMaskPatches`. While those were
two separate copies of the same test, `ensureMaskPatches` never learned
about bevel, and a face extruded on a bevel-only material stayed flat
forever.

### Cross-masking: each kind stops at the other (a2.29c)

**The field measures distance through SPACE. It has no idea where the
surface goes.** So a recess whose floor is 0.12 below a lip 0.05 away is
0.13 from a point on the flat top OUTSIDE it - well inside the range - and
Cavity paints straight over the lip and out onto the open deck. On
Zeghreit's tank that put rust along the top edge of every raised hull
plate: the single most exposed line on the model, and the last place dirt
would ever sit. The turret's inward extrude, whose rim is further from
anything concave, looked perfect the whole time.

**The other channel is the answer, and it is already in the same texture.**
If the nearest edge of the OPPOSITE kind is closer than your own, you are
on the wrong side of a corner from it - reaching your own edge means going
round that corner, and neither dirt nor wear does that. So Cavity stops at
the lip and Edges stops at the crease:

    occ = smoothstep(-bar, bar, other - own)

`bar` is 35% of the mask's own Width, so a wide band gets a wide handover
and a tight one a tight one. Substance ships exactly this on every
generator - "Ambient Occlusion Masking" and "Edges Masking, removes dirt
from raised edges" - and it was the one item on the prior-art list that had
not been built. It costs nothing: both numbers were already read.

**Both channels EXACTLY zero is the no-field default**, the material preview
ball, and it must not be cross-masked - a tie halves the result and every
thumbnail in the tray goes pale. The probe caught that one, at -51.87 turning
into -22.64.

The pan test in the probe is this shape: a plate with a shallow square
recess. Before, cavity over its whole mask read -12.43 and the dark band sat
on the outer rim; after, -1.34, and it sits in the recess.

### Which side of the wall (a2.29e)

**A Kubik model is usually a SHELL, and the field does not know that.** It
measures distance through solid material. Zeghreit's fenders are a folded
plate 0.04 thick with a field reaching 0.37: the crease on the HIDDEN
UNDERSIDE, where the front lip folds back under the deck, sat four
centimetres behind the outer chamfer and drew a rust line straight down it.
Cross-masking could not help - there is no convex edge on that chamfer to
lose to, because at 45 degrees it shades smooth and is not an edge at all.

**Ask the field which way it grows along the SURFACE NORMAL.** Step out and
step in:

    behind = (field(p + N*e) - field(p - N*e)) * range / 2e

A crease you could WALK TO lies in the tangent plane, so both steps move you
the same distance away from it and the difference is ZERO. A crease behind
the skin is directly below you: stepping in halves the distance, stepping
out doubles it, and the difference is 1 - the full slope of a distance
field. Above 0.7 the mask returns nothing; 0.35 to 0.7 fades.

The numbers come from the real model, analysed offline against a ray-traced
ambient occlusion: **every painted pixel with `behind` above 0.6 has an AO
of exactly 0.00** - open air, all 933 of them across the nine objects -
while the pixels below 0.35 average 0.14 to 0.55. On the fender plate, 46%
of what Cavity painted was on the wrong side of a wall.

`e` is a TWENTIETH of the range, small enough that both taps land inside one
voxel of the field, where the reconstruction is linear and the answer is
exact. A CENTRAL difference, not a forward one: standing exactly on a real
crease, the forward difference reads 1 and switches off the deepest part of
every cavity. Computed at most once per pixel, and only for a pixel already
within reach of an edge.

Probe: the recessed plate, seen from the side (mostly outer surfaces) went
-1.34 to -0.21, and from ABOVE (where the recess is visible) -3.24 to -2.26.
Both numbers are needed - the side view alone cannot tell "confined to the
recess" from "switched off".

### Winding, and why it was invisible (a2.29d)

**A face wound backwards inverts every edge it touches.** The convex/concave
test stands on one face's plane and asks which side the neighbour's far
vertex falls on - so with the plane the wrong way up, Cavity comes out on
the open lip and Edges goes down in the crease. Half a dozen such faces
somewhere in the middle of a mirrored model is exactly what "sometimes, on
some edges" looks like.

`applyShading` now walks the triangles first and gives each a SIGN relative
to its neighbours: two triangles sharing an edge agree when they cross it in
OPPOSITE directions. That settles a shell against itself. Which way round
the shell goes as a whole is one more question, answered by its SIGNED
VOLUME when it is closed - positive is outward, so an inside-out box, or a
deliberate Flip Normals, still has its cavities where its cavities are - and
otherwise by majority, which keeps an open patch closest to what was drawn.
The bar under the volume is relative to the shell's own size; an absolute
one means "any closed shell under half a millimetre keeps whatever it
arrived with", and Kubik has no unit.

**It must not touch the shading normals, and the first version did.** The
premise was "every material is double-sided, so a backwards face is
invisible" - which is false: since v1.79 the app CULLS back faces, so a
backwards face is already a hole you can see. Negating its normal as well
only turns the hole black, and the raw cross product of any triangle that
survives culling faces the camera by definition. The sign is read in exactly
one place, at the classification.

**A non-manifold edge stops the walk.** Three faces on one edge has no
consistent answer, and guessing one stamps it on the entire sub-shell
beyond: a wall bridged onto two coplanar plates came back inverted about
half the time. Stopping makes the wall its own component, seeded upright,
exactly as it was before the pass existed.

Probe: `pan.oneflipped` and `pan.allflipped` rebuild the recessed plate with
one face group, then every face group, wound backwards. Both were wrong
(14/12 and 8/16) and both now read the same 16 convex as the clean shape.
The one flipped group still adds two edges to the total, because the SMOOTH
ANGLE test compares two face normals and a flipped one reads as 160 degrees.
That path is deliberately left alone - the face it happens on is a hole on
screen anyway, and the fix there is Flip Normals, not a shading heuristic.

### The four architectures that did not work

Kept because each one looked right and measured healthy, and Zeghreit found
every one of them in seconds on a real model.

1. **Per-vertex curvature (a2.24).** Every vertex of a cube is convex, so
   the field is a CONSTANT across each face and no remapping of a constant
   makes a band. **Per-vertex data is blind BETWEEN vertices.**
2. **A bounding box per flat region (a2.25).** Worked on a cube, put the
   band on the corners of anything round, and drew a grid on a subdivided
   one. Its first version measured a clean monotonic response to the width
   slider and was still wrong - only the screenshot showed four corner dots
   instead of a band. **A picture, not only a mean.**
3. **Five fitted models, scored against the region's own rim (a2.26).** A
   fixed 2-degree merge counted a 12-sided tube's 30-degree seams as edges
   though they shade smooth: **"angled" is not "sharp"**, and if a rule about
   edges exists twice in this file the two WILL disagree. Then: no model
   meant "unrestricted", which on a convex shell paints SOLID - invisible on
   a cube, everywhere on a nine-object tank.
4. **The same, checked harder (a2.27a).** On a curved band with one segment
   across it the vertices ARE the boundary, so the test measured each model
   against the points that defined it and could not fail. A cylinder wall
   tapered by 2% scored a perfect ring and came out solid.

The through-line: **a face can only ever say something about its own
interior.** Ask the edges.

## The a2.33 audit — every op run, and what it found

A whole session spent testing rather than building. Three passes: a dead-code
scan, a silent-failure scan, and a harness that runs **every** operation and
checks the same invariants each time. Five defects, of which the first was
three taps from a cube and corrupted saved files.

### 1. Undo re-dressed the geometry from the LIVE materials, by index

`restoreDoc` keeps the current look across an undo (`keepAppearance`), which
is right — undo should not rewind a paint job. It applied it **by index**,
with no check that the two agree about how many face groups there are.

Measured, three taps from a cube: paint face 3 plastic and face 5 metal,
delete face 1, press Undo. The materials came back on faces **2 and 4**, the
face actually painted was grey again, and one group was left unstamped — with
no `finishes` entry, which `reconcileFinishes` describes as belonging to the
Solid preset invisibly: it renders unmasked and ignores every edit to the
material it appears to wear. `serializeDoc` then persisted all of that.

The fix is a length guard. When the counts disagree the RESTORED step's own
materials win, because they are what that step actually looked like.

**The rest of that bug class is closed**, and it is worth writing down why the
per-op search kept coming up empty: `finishes` is no longer a hand-maintained
map but is DERIVED by `reconcileFinishes` from the material array on every
rebuild; `smoothGroups` is dead at runtime (migrated to position-keyed
`edgeShade` on load); the live marks are position-keyed and immune to
renumbering by construction; and `captureObjectState` snapshots all five maps.

### 2. A history entry was a VIEW of the live marks, not a copy

`serializeDoc` wrote `creases`, `edgeShade`, `finishes` and `smoothGroups` as
the live objects. Every doc already in the history therefore aliased the very
maps the next op was about to mutate, and `edgeShadeSet` / `creaseSet` hand
back the live object and write into it.

Consequence: **Mark Sharp, Shade smooth and Shade flat could not be undone.**
Measured — mark an edge sharp, press Undo, the mark is still there, because
the step being restored had been edited in place along with the mesh.
Autosave and the `.json` export read the same function.

Four spread copies. A snapshot has to be a snapshot.

### 3. Three ops did nothing and reported success

`confirmPendingOp` ended `toast(label + ' applied')` unconditionally and
`applyPendingOp` discarded every worker's return value. Bridge was the only op
with a failure channel. So:

- **Extrude two opposite faces** (symmetry off) — their normals sum to zero.
  It fired on `own`, the DEFAULT grouping, which never needed a shared
  direction in the first place. Now `own` extrudes them apart as asked, and
  only the modes that really need one shared direction refuse.
- **Loop cut into a non-quad** — two taps from a cube: Split an edge, then cut
  between the two five-sided faces that made. `applyPendingOp`'s own comment
  claimed `edgeLoopSelection` checked for this. It never did.
- **Inset a closed selection** — every face of a cube: no rim, nothing to
  inset towards.

All three dragged, did nothing, said "applied", and left a history step — so
the next Undo press looked broken too.

**The fix is one channel, not three patches.** `refuseOp(why, value)` sets
`opRefusal` at the point of refusal; `applyPendingOp` clears it before the run
and hands it to `op.lastWhy` after; `confirmPendingOp` restores the snapshot,
pushes NO history and says `"<Op> did nothing — <why>"`. Bridge keeps its own
`lastWhy` and is unchanged. Per-face modes clear the flag when at least one
face worked: one awkward face refusing does not make the op a no-op.

### 4. An Undo press that does nothing is now impossible to record

`pushHistory` compares the new doc against the one already at the cursor and
returns without recording an identical one. Compared on the MODEL only —
`nextId` counts objects that ever existed, so an op that builds a temporary
bumps it, and `selection` moves on its own; neither is something Undo should
have anything to take back. Two stringifies per committed edit, on a path
that already serializes for autosave.

Crease, Shade and Mark Sharp were also counting things they had not changed
("1 crease(s) cleared" over an uncreased edge). They count real changes now
and say "No creases on that edge" instead.

### 5. Smaller, but the same principle

- **Knife and Bridge refused silently** while an op bar was open, where
  Extrude says "Finish the … first". They say it too now.
- **`applyShading`'s two catches** logged to a console this app's users do not
  have. `warnOnce` says it on screen, once per reason per session.
- **A bridge that folds over** said so in the bar's label the whole time and
  then reported a clean "Bridge applied" at OK. The toast carries it now.
- **Mirror threw on a missing axis** instead of using the one the Symmetry
  pill is set to.

### Removed: twelve things nothing reached

Verified by whole-file identifier count (exactly one occurrence — the
declaration) and by reading each site. `selectionRadius` (sized the v1.57
move bars), `bestRingOffset` (superseded duplicate of `chooseRingOffset`,
without the weld avoidance that stopped 2/4/6-section bridges coming out
non-manifold), `isCreased`, `setObjComponentMode` (superseded by
`toggleObjComponentMode`), `INSET_RATIO`, `BEVEL_RATIO`, `SCALE_BASE`, the CSS
for `.lh-on`, `#objectStrip` and `#helpGestures`, and the `colorPicker` DOM
lookup left behind when the drawer's colour picker went — the only
`getElementById` in the file aimed at an id that does not exist, silent
because of its own `if` guard. 54 lines. A declaration diff before and after
confirms exactly seven names left and nothing else moved.

`windingAudit()` is reachable only from `window.__kubik` and STAYS: it is a
test hook, not dead code.

## The ops sweep — `_ops_probe.py`

38 cases, every user-facing op in every mode it works in, each run from the
same cube. For each: the op changed something OR said something (never
neither), winding, `material[]` and `finishes` still agreeing with the face
groups, exactly one history step for a change and none for a refusal, and
**Undo restoring the document exactly**.

Three things make it trustworthy, all learned by getting them wrong first:

- **It measures history by `historyIndex`, not `history.length`.** Every case
  undoes itself, so the next push truncates and refills the same slot and the
  length never moves — which read as "no history step" for ops that had
  pushed one perfectly well.
- **It compares `serializeDoc().objects`, not a hand-rolled fingerprint.**
  The probe and `pushHistory` cannot then disagree about what a change is. A
  hand-rolled one called Mirror on a symmetric cube a no-op and blamed the app
  for recording it; the document differed.
- **The object is re-fetched after every undo.** `restoreDoc` disposes every
  object and builds new ones, so a held reference is a stale one.

Two cases are marked as expecting broken winding, because they are: flipping
one face of a closed cube inverts it against its neighbours by definition, and
a flap extruded from an edge of a closed mesh hangs off an edge that already
had two faces.

## Screen layout

- **Top-left** hamburger → drawer. **Top-centre** tool/mode readout.
  **Top-right** view cube.
- **Top-left, under the drawer button**: the Symmetry pill, a horizontal
  two-state switch. It hung under the view cube until v1.99d, which left
  the top-left empty and the top-right crowded - the cube is a 128px
  object with its own presence, and a pill beneath it read as part of
  the cube rather than as its own control.
- **Bottom-left**: the round Object/Component button. A plain tap toggle.
  a2.3 gave it a press-and-hold mode ring; a2.4 removed it again.
  **Bottom-centre**: Undo/Redo. **Bottom-right**: Help.
- **The bottom row aligns on BOTTOM EDGES.** All four take a plain
  `bottom: var(--edge-b)`, and `--edge-b` is 4px against the 14px the other
  edges use, so the row sits low and leaves the viewport more air.
  v1.99b aligned it on CENTRES instead, through a `--bar-cy` variable - the
  textbook answer for round buttons of different sizes - and v1.99d reverted
  that after seeing both on screen. **Do not "fix" this back:** the 56px hub
  beside three 44px buttons reads better sharing a bottom edge. `--bar-cy`
  no longer exists.
- **`#thumbZone` is gone (v1.99c), and must not come back around one
  button.** It applied `env(safe-area-inset-*)` itself while `--edge-l` and
  `--bar-cy` applied it AGAIN to the button inside it, so on any phone with
  a home indicator the hub sat a full inset (~34px) above Undo/Redo and
  Help. Every edge-anchored control now measures from the `--edge-*` scale
  and nothing else. The four bottom buttons all take `#viewport` as their
  offsetParent; if one ever doesn't, suspect this.
- **Nothing else.** There is no rail of toggles down either edge — See-
  through, Floor grid, Snap, Add Cube and Tap/Box/Lasso select all live in
  the world ring.

## Controls

**Transforms have no gizmo.** You grab whatever is selected and drag it. The
same drag moves, rotates or scales depending on the active tool. Rotate and
scale turn around the PIVOT, which since a2.39 can be pinned anywhere (world
ring, left pole).

- Two-finger tap on empty space cycles Move / Rotate / Scale.
- **Three fingers carry three gestures, told apart by what the hand DOES.**
  A tap (still) switches Free / Axis. A slide (the centroid moves, the spread
  holds) sizes the soft-selection radius, in Soft mode only. A pinch (the
  spread changes, every finger agreeing in sign) isolates the selection, in
  Object mode only. Soft and Object are mutually exclusive, so no two of the
  three can ever be asked at once. See Isolate for why a pinch cannot be read
  from the mean spread.
- Three-finger tap switches Free / Axis. **Axis is the default** as of
  v1.99d: a drag along one named axis is what is wanted almost every time
  something is moved deliberately, and Free is one tap away. Not persisted
  by save/load, so every session opens in Axis.
- In Axis mode the axis is decided once from the first ~15px of the drag and
  held until you lift; re-deciding mid-drag made curving gestures wander.
- Free rotation takes its axis from the swipe direction, locked at the start.
- Free scale reads the projected axes, so depth is reachable without a
  dedicated gesture; a drag matching no axis scales uniformly.

**Two rings bloom under your finger.** Press and hold; what you get depends
on what is under it.

- **On your selection** (300ms) → that selection's tools.
- **On empty space** (480ms) → the world ring: Add Cube, the four view
  toggles, and the select-gesture choice. Empty space waits longer because
  pressing on the background and pausing is also how a careful orbit
  starts, so that gesture has to prove itself before the camera loses it.
- Any travel over `RING_MOVE_CANCEL_PX` (8) cancels a pending bloom.
- The world ring is available in Box/Lasso mode too. It once wasn't, and
  since the ring is the only route back to Tap select, choosing Lasso
  locked you in permanently. A hold now abandons the region drag.

**World ring geometry.** Right-rail items (See-through, Floor grid, Aim
assist, Snap) occupy the TOP half; left-side items (Tap/Box/Lasso) the
BOTTOM half. Add Cube takes the right-hand pole alone — the only item that
makes something rather than toggling something — and the left pole is
deliberately empty so the two arcs read as two arcs.

Three things about the ring are load-bearing:

- **`pointer-events: none` on `#touchToolRing`.** The ring picks by ANGLE,
  so the icons never need touching. While they were hit targets, sliding
  onto one sent pointermove/pointerup to that div; the ring is not a child
  of the canvas so nothing bubbled back, hover froze and the release ran
  nothing.
- **It captures the pointer on the canvas** for its lifetime, so the mode
  button, Undo/Redo, the pill and the view cube cannot swallow a release.
- **The hover test needs `% (2π)` before the wrap.** `atan2` returns
  (−π, π] but the halved layout places items in [0, 2π), so `|ang − angle|`
  can exceed 2π and `2π − diff` then goes NEGATIVE — beating every real
  distance. Two items were unreachable. Do not remove that modulo.

**Ring radius** scales from the CLOSEST pair of items, not the item count,
so unevenly grouped sets still get real spacing.

**Object / Component / Soft** is the round button, bottom-left. It shows the
mode you are in and cycles on tap — three positions since a2.37, with Soft
wearing a ring around the component icon rather than an icon of its own.
(A two-position edge slider was tried at v1.89 and reverted at v1.92.)

**Symmetry** is the horizontal pill under the view cube. Left half on,
right half off; tap a half or swipe toward it. Object symmetry only — the
plane travels with the object.

## Selection

**Screen-space, never 3D ray distance.** Vertex and edge picking measures
pixel distance to the projected point/line. The 3D version failed in a way
no threshold fixes: an edge viewed at 5° claimed 69% of a face.

**Nearest visible wins**, which is a Voronoi split of the screen, so catch
zones can never overlap however far you zoom out. The rule in one sentence:
**we pick the nearest thing you can see.** It is applied in TWO PASSES —
find the closest candidate in pixels, then let depth settle everything
within `VERT_TIE_PX` (8px) of it. Two passes is not a style preference; see
"Why selection felt broken" below for what one pass did.

Edges use the same rule, taking depth at the point along the edge you aimed
at rather than at its midpoint, since an edge running away from the camera
is far nearer at one end. Faces need none of this — `pickFaceOnActive`
raycasts, so it already picks the nearest thing the renderer would draw.

**Marker size and target size are separate numbers, deliberately.**

| constant | value | why |
|---|---|---|
| `VERTEX_DOT_PX` | 2 | the marker should be quiet |
| `PICK_RADIUS_PX` | 28 | the target should be generous |
| `OFF_MODE_PICK_BIAS` | 0.7 | off-mode target stays ~19.6px, as before |
| `GRAB_RADIUS_PX` | 34 | grabbing is a different question (below) |
| `SEL_DOT_PX` / `SEL_EDGE_PX` | 7 / 3.5 | selected geometry reads loudly |

Dots are constant SCREEN size (`sizeAttenuation: false`, × pixel ratio) and
round (a textured sprite — untextured points render as squares). They were
world-sized once, so a dot shrank to ~4px at camera distance 25 while the
catch radius stayed 22px: you aimed at what you could not see. **Dots and
wireframe appear together in every component mode.** Hiding dots outside
Vertex mode was tried and reverted — it meant a tap near a corner could be
claimed by a vertex you could not see.

**Selected components get their own geometry**, not just a different colour:
a second `Points` and a `LineSegments2`, rebuilt from the selection on every
change and torn down in `hideAllHelpers`. This is structural — `PointsMaterial`
carries one size for the whole object and `LineBasicMaterial.linewidth` is
ignored outright by WebGL, so "thicker when selected" is impossible inside
the shared helpers.

**Selection is RED** (`0xff4d47` dark, `0xD1443A` light), deliberately the
one colour the interface never uses. Matching it to the UI accent was tried
and failed: "chosen" agreed with the buttons and vanished against the model.

**Selecting and grabbing use different radii** because they are different
questions. Selecting asks "which of these did you mean" and wants precision;
grabbing asks "are you taking hold of what is already yours" and wants
generosity. `pointerOnSelection()` measures ONLY against selected
components, so an unselected neighbour nearer the finger cannot steal the
grab and turn it into an orbit. Pressing inside the selection's screen
bounding box also grabs (3+ components; skipped when the box covers >60% of
the viewport, so there is always somewhere left to orbit from).

**Tap slop is per pointer type.** Touch gets 12px slop and an 8px drag
start; mouse and pen keep 6px. A thumb rolls further than 6px as it presses
and lifts, so ordinary taps were being discarded as camera drags.

**Two rules, in this order.** WITH A SELECTION the type is LOCKED: only that
same type can be picked until you tap empty space to clear. It removes
catch-zone ambiguity by construction, and it must NEVER be silent — a
refused tap hits neither branch of `handleTap` (the object under the finger
IS the active object, so nothing to switch to; not empty space, so nothing
to clear) and simply evaporates, so it probes what was actually there and
says so. WITH NOTHING SELECTED the tap is FREE: vertex, then edge, then
face, and it moves you into whichever it found.

**a2.3–a2.3a tried the opposite and it was reverted at a2.4, by request.**
The theory was that the free tap is what makes vertices unreachable: tap a
little off a corner, find no vertex within 28px, get the face underneath and
be moved into Face mode, with every tap after that a face. So a2.3 added a
press-and-hold mode ring on the bottom-left button and a2.3a made the mode
sticky. It worked, but declaring a type before every tap is a tax on all
taps to fix a minority, and the ring and the sticky mode are both gone.

**If "I can't select a vertex" returns, this is where it lives** — and the
fix is a bigger vertex catch radius or a better tie-break, NOT a mode you
set by hand. Do not reach for proximity either: measured at a2.2a, the
closest face-centre to its nearest visible vertex is 25.2px on a plain cube,
6.1px subdivided once, 0.8px twice, 0.5px three times. By 96 faces a face's
own centre IS a vertex to within a pixel — the distributions overlap
completely, and a threshold generous enough to catch a deliberate vertex tap
on a cube refused 32 of 48 face centres on a subdivided one.

**A harness cannot see an aiming bug.** Every test here computes its tap
positions with `worldToScreenPx`, the same function the picker uses, so any
offset between the DRAWN dot and the PICKED point cancels out and the sweep
comes back 59/60 with the bug untouched. `?debug=1` toasts the pick line
(nearest-vertex distance, signed dx/dy to it, DPR, viewport-vs-canvas rect
offset) precisely so a phone can report what no harness here can measure.

**The mode ring (a2.3) is what makes the lock liveable.** Hold the bottom-
left button and Object / Vertex / Edge / Face bloom; picking one sets the
mode and clears the selection. Before it, the sub-type was decided purely
by whatever your first free tap landed on — and a tap on the model almost
always finds a FACE, so the lock usually settled on Face and vertices
became unreachable. Reported, correctly, as "I cannot select a vertex no
matter how close or far I zoom": there was no way to ASK for vertices.

**Do not try to infer intent from proximity instead.** Measured at a2.2a:
the closest face-centre to its nearest visible vertex is 25.2px on a plain
cube, 6.1px subdivided once, 0.8px twice, 0.5px three times. By 96 faces a
face's own centre IS a vertex to within a pixel — the distributions overlap
completely, and a threshold generous enough to catch a deliberate vertex
tap on a cube refused 32 of 48 face centres on a subdivided one. Saying
what you want beats guessing it.

**No deliberate way to switch component type** — you must successfully tap
the type you want, or clear and tap again. This was solved at a2.3 and
un-solved at a2.4 on purpose; see above before rebuilding it.

**The ring's radius is capped by the SCREEN, not just by its item count
(a2.7b).** `bloomToolRing` sizes itself from the tightest pair of items, which
is unbounded: the Edge ring is thirteen tools and asks for ~192px, needing a
444px-wide viewport before it fits at all. On a phone the centre clamp then
had no legal position to clamp to, so it pinned to one side and half the ring
hung off the right-hand edge. The radius is now `min(ideal, what fits)` and
the centre falls back to the middle when even that is too big. Squeezing the
icons is much the lesser problem: thirteen items on a 390px screen still sit
~70px apart, and the ring picks by DIRECTION, so you never have to land on
one. Measured on a 400x751 viewport: every ring fits entirely, from any
corner.

**Rings are DRAWN where they fit and AIMED from the finger.**
`bloomToolRing` keeps a ring `R + 30` inside the viewport, so one bloomed
near an edge — or from the corner mode button — lands well away from the
finger that opened it. Hover used to be measured from the drawn centre,
which put the finger outside the dead zone before it had moved: the first
pixel of jitter highlighted whatever lay on that bearing, and lifting in
place RAN it. The optional `aim` argument separates the two, and all three
callers pass it. (The per-set `deg` bearings and the `owner` tag went
with the mode ring at a2.4.)

**Item ORDER inside a ring decides which bearing each tool gets, and a few
of those seats are worth more than others (a2.7e).** `toolRingAngles` puts
whatever is declared first exactly on-axis (straight up, zero angular
guesswork) — and for a ring with an even item count, the item declared
exactly opposite it (index `n/2`) lands on-axis too (straight down), for
the same reason. Every other seat needs a real aim. Reordered three arrays
to spend those free seats on the tool most likely to earn them, using
Blender's own single-key hotkey assignment (Extrude/Inset/Bevel/Loop
cut/Knife/Delete) as a frequency proxy, since Kubik has no usage telemetry
of its own: Edge ring's top-3 is now Extrude/Bevel/Loop cut (Bridge moved
out — it only held that seat because of a two-radius ring layout that's
since been removed, see the a2.7b note above); Face ring's on-axis-bottom
seat is now Cap holes, not Knife; Object ring's on-axis-right seat is now
Delete, not Centre. Full reasoning, plus every other ring's angles measured
the same way: the Bloom Ring Ergonomics doc. No geometry changed — only
declaration order, which is the one thing the angle formula reads.

**Back-facing components are rejected by face normal**, so picking agrees
with back-face culling. Mirrored (negative-determinant) objects are
sign-corrected.

**The camera never moves on a pick.** See the do-not-rebuild list.

## Why selection felt broken (v1.99e-g)

The complaint was "sometimes I tap right on something and nothing selects,
sometimes something near it gets selected" — and it happened whether or not
anything was already selected, which rules out the type lock and the grab
path, since both are inert on a fresh tap.

**Three plausible causes were on the table and measurement killed all
three.** The picker is fine: aiming exactly at a vertex hit it 860/860 times
across 72 camera angles, and with realistic thumb jitter it agreed with
ground truth on 2892 of 2922 taps and **returned NOTHING on zero of them.**
A picker that never comes up empty cannot be why taps come up empty.

So the tap was never reaching it. The only gate above it is

    if (moved > tapSlopPx(ev) || wasOverGizmo) return;

a bare return with no feedback. A thumb rolls well past 12px pressing and
lifting, and the tap was silently discarded — while the camera still
orbited a hair, which is what read as "at some angles". **The same fix had
been made once before, 6 → 12, and under-shot.** Now 22.

Three real defects turned up alongside it, all small, all now fixed:

| | was | measured |
|---|---|---|
| Tie-break compared against a RUNNING best and wrote `bestD = Math.min(...)`, so the recorded distance belonged to a vertex that had already lost — order-dependent, and a vertex 3px from the thumb could lose to one 10px away | v1.99f | 1.03% of jittered taps wrong |
| Edges had **no depth preference at all**, purely nearest-in-pixels | v1.99f | — |
| `groupFacesCamera` judged a face by its FIRST TRIANGLE, used a strict `dot > 0` that failed exactly edge-on, and called `updateMatrixWorld()` AFTER transforming every point | v1.99g | 0.44% of face tests disagreed |
| No occlusion test at all — a vertex facing you but hidden behind a fold stayed a candidate | v1.99g | the last 0.14% |

Wrong picks went 1.03% → 0.14% → **0%**, empty returns stayed at zero
throughout, at 0.47ms per tap including the ray casting.

**The occlusion test can only BREAK TIES, never refuse the last candidate
standing.** An occlusion test is the easiest way to reintroduce "nothing
happened", which is the failure mode this whole strand existed to remove.
See-through is exempt by definition.

**Known cost of the 22px slop:** a deliberate orbit under 22px now also
registers as a tap, so nudging the camera over empty space clears the
selection. If that ever becomes the worse annoyance the answer is NOT a
smaller number, it is a time test — a quick stab and a slow drag are
different gestures at the same distance.

## Rendering

- **Active object's wireframe at `FRAME_ACTIVE` (2.0), others at
  `FRAME_DIM` (0.8).** The gain is applied above 1, which ACES tone mapping
  rolls off rather than clipping. In Object mode the SELECTED set decides
  which is active, not `activeObjectId`, which can point elsewhere.
- **Floor contact shadow is OFF** via `SHOW_FLOOR_SHADOW = false`, not
  deleted. The shadow camera, catcher plane and per-theme opacity are all
  still wired, so it returns by flipping that one word.
- **The view cube is 128×128, flush to the corner, unscaled.** `ViewHelper`
  always draws a 128px square anchored in a corner of its element — `dim`
  is a fixed constant in the library, not a setting. At 96 it was clipped;
  at 1.5× it became a 192px `touch-action: none` element covering ~10% of a
  phone screen and swallowing every tap that started there, which read as
  selection and dragging being broken. **128 is the only size that neither
  clips nor over-claims.**

## Object tools added v1.99h-k

**Flip normals** (face ring and object ring). Reverses face winding — the
manual remedy for what `auditWinding` reports. Face mode flips the
selection, Object mode flips everything in the selected objects. Per-element,
so symmetry expands one face to two. *A whole object flipped once still
audits as ok:* the audit measures whether neighbours agree with each other,
not whether the surface faces outward, and a fully inverted object is
perfectly self-consistent. Global inversion is something you see, not
something the audit can catch.

**Cap holes** (edge, face and object rings). Closes open boundaries.

**In Edge mode a selection NAMES the hole.** Select its rim and only that
hole is capped — one edge of it is enough, so you never have to select the
whole loop to say which one you meant, though a double-tap edge loop hands
you the whole rim anyway. This is the use Zeghreit asked for and it is the
main way in. With nothing selected, or in any other mode, every hole in the
object is fair game, because a hole belongs to the mesh rather than to the
selection.

A face's boundary loop is DIRECTED, and two faces sharing an edge traverse
it in opposite directions — that is what makes their normals agree. So an
edge traversed in only ONE direction has nothing on its other side: it is
rim. `auditWinding` already counted exactly this as `boundary`; Cap uses the
same fact to fix rather than to report. It also hands the new face its
winding for free — fill the rim with its REVERSE and the cap necessarily
agrees with the surface around it, with nothing to guess.

Two things it got wrong first, both caught by measuring rather than reading:

- **A vertex can have more than one outgoing rim edge.** Delete two opposite
  faces of a cube and the rims share corners. Recording only the first
  outgoing edge per vertex stitched two rims into one bogus loop. The walk
  now consumes directed EDGES, never marking vertices visited, because a
  vertex shared by two rims must be walked through twice.
- **Not every rim can be closed by one flat face.** Delete three faces in a
  strip and the rim wraps around the block: non-planar, self-overlapping in
  projection, so ear-clipping emits crossing triangles. Measured boundary 8
  before, **10 after** — it made the mesh worse while reporting success. Cap
  now caps, re-counts the open edges, and **puts the mesh back if the number
  did not fall**, saying the opening is not flat enough. Measured across
  seven cases: six reach boundary 0, the impossible one is left untouched.

**A selection can outlive what it points at, and that used to crash the
app.** `refreshGizmoAttachment` did `topo.edges[ei].forEach(...)` with no
guard. Any op that rebuilds the mesh renumbers every element, so an id left
over from before is not merely stale, it is out of range — and the throw
took the whole app down rather than losing one highlight. Cap holes found
it because it consumes the very edges you selected, but every rebuilding op
could have hit it. All three branches are guarded now, and Cap clears the
consumed selection rather than leaving ids pointing at whatever happens to
sit at those numbers afterwards.


**Separate** (object ring). The inverse of Join: one object per CONNECTED
piece. Connected, not spatially near — two cubes that overlap but share no
vertices are two pieces, two that were bridged are one. The shell walk
compares LOGICAL vertices, because every face owns private copies of its
corners for hard-edge normals and comparing attribute indices would report
a plain cube as six loose quads. Says so when there is only one piece.

**Flip** (object ring, beside Mirror). Reflects an object where it stands.
Same plane rule as Mirror, so the Symmetry pill governs both: off flips
across the world axis (which moves an off-centre object to the other side),
on flips across the object's own captured plane (which does not move it).

**Mirror now asks Joined or Apart**, one tap on the op bar's grouping row,
Joined leading. The choice cannot be deferred: the halves come out welded
at the seam, so Separate sees one connected piece and correctly refuses.

**Baking beats negative scale.** Flip and Mirror-Apart bake the reflection
into the geometry and reverse the winding rather than giving the object a
negative scale. A negative determinant reverses triangle handedness, which
is exactly why mirrored objects are forced to render `DoubleSide` — and
that DoubleSide clause is the last place picking and rendering still
disagree. Anything that keeps a mirrored copy around should bake.

Baking moves the geometry but not the ORIGIN, so `recentreObjectOrigin`
slides the geometry onto its own centre and moves the transform to match —
otherwise the inspector reports the position the object was reflected FROM.

## Deliberately absent — do not rebuild these

- **The transform gizmo.** Iterated for many versions, removed once direct
  dragging worked. Tagged `v1.57-handles`.
- **The fixed-corner fan menu.** Replaced by the press-and-hold ring.
- **A label on EVERY ring item.** They read wider than they measured and
  pushed the icons into each other. Still absent, and should stay absent.
  **This is NOT the hover label shipped in v1.99b** - that is ONE label, for
  the item under your finger, in its own element that no icon's layout
  depends on, sitting outside the ring. The overlap failure needed many
  labels at once, so it cannot return this way. Measured at the ring centre
  and at both edges: never overlaps any icon, and the clamp keeps it on
  screen. Do not delete the hover label thinking it is this entry.
- **Two-ring bloom menus.** Hover picks by angle only, so an outer ring is
  unreachable by construction.
- **Smart camera, and Aim assist after it.** The first drifted the view to
  a three-quarter angle after every selection; the second, its last
  survivor, eased the camera in after a vertex or edge tap when the nearest
  neighbour was closer than twice the catch radius. Both answered a question
  nobody was asking. **Being moved when you did not ask to be moved reads as
  the app losing your place**, and the measurement that justified the second
  one - targets too close together to tell apart - is not something you
  notice while it is happening. Pinch-zoom is one gesture and it is yours.
  Tagged `v1.87-smartcam`; Aim assist went at a2.30a, taking `App.aimAssist`,
  the world-ring toggle, `AIM_CROWD_PX` / `AIM_ROOMY_PX` / `AIM_MAX_ZOOM`,
  `logicalVertexPx` and `nearestVisibleNeighbourPx` with it. `camAnim` and
  `animateCameraTo` STAY - the double-tap framing still uses them.
- **The edge rails.** Five buttons down the viewport sides, now in the world
  ring.

## Hard-won lessons

- **Measure, don't reason.** Every layout, geometry and picking bug in this
  project was found by running numbers or reading a screenshot, and missed
  by reasoning about the code. This is the single most reliable rule here.
- **Ask what "broken" looks like before writing code.** "Nothing happens at
  all" versus "picks the wrong thing" are different bugs with different
  causes. Three plausible fixes were shipped for a selection complaint
  before the symptom was named; naming it found the cause in one read.
- **The update banner is the ONLY way an iOS Home Screen app learns a new
  version exists** — no pull-to-refresh, no reload button. `checkForUpdate`
  matched `/>v(\d+\.\d+)<\/span>/`, which assumed a leading "v" and two
  numeric parts, so the day versions became `a2.0` it matched nothing and
  the banner silently stopped appearing. Anyone on the Home Screen app was
  then stuck on a cached build reading "you shipped nothing". Fixed a2.3a to
  match the ELEMENT and compare its text. **Never encode the version format
  there again.**
- **THREE things are keyed by face-group index**, not one: the `material[]`
  array, `userData.smoothGroups`, and `userData.finishes`. Any op that
  renumbers groups must carry all three, and `captureObjectState` must
  snapshot all three or a revert puts the geometry back and leaves them
  shifted. Dissolve shipped carrying two of them and a reviewer caught the
  third. Grep `finishes` before you renumber anything.
- **A silent no-op is the worst failure mode.** It is indistinguishable from
  a broken app. Several bugs here were "the code correctly decided to do
  nothing and told no one": the type lock, `avgDir` cancelling to zero,
  symmetry finding no pairs. When a guard returns early, say so.
- **Check for DUPLICATE declarations after any rewrite.** A second copy of a
  function is a hard SyntaxError that blanks the whole app, and esprima-based
  `_syntax.py` does NOT catch it. `_verify.py` does.
- **Large deletions need a declaration diff** against the last commit.
  Cutting between line markers has silently swallowed the App object, the
  theme system, the raycaster and the view cube on separate occasions.
- **`edit_block` is unreliable above ~20 lines.** Use a Python patch script
  with exact-match assertions so it fails loudly rather than half-applying.
- **Check the library source before designing around it.** The view cube was
  resized twice on assumptions; the real constraint was a fixed `dim = 128`
  that one read of ViewHelper would have shown.
- Zeghreit tends to spot the right conceptual direction early. When a
  reframe is proposed, follow it rather than defending the implementation.

## Watch out

- v1.79 made **winding correctness load-bearing** by switching to FrontSide
  culling. Anything producing reversed winding can render or pick wrongly.
  Mirror is handled (negative-determinant flip in `combineObjectsInto`).
  **Extrude, bridge and subdivide are MEASURED as of a2.33** — the ops sweep
  audits winding after every one of its 38 cases and all of them are clean
  except the two that cannot be (see "The ops sweep"). Under `?debug=1` any
  op still reports its own `[winding]` line.
- **Symmetry only mirrors vertices that already have a twin.** It keeps a
  symmetric model symmetric; it cannot restore lost symmetry.
- Symmetry applies to component edits only, never object drags.
- **One loop cut case is silently NOT symmetric**, and it is worth knowing
  precisely: an edge running ALONG the mirror axis is its own mirror, so no
  second ring is cut — correctly, there is only one ring — but the cut then
  slides along that axis. At the default (Even, one loop) it lands on the
  plane and all is well. **Slid off centre it lands off-plane, on one side
  only.** Measured on a cube at t = 0.25: loop at x = +0.25, model no longer
  symmetric. Fixing it means also cutting at the plane-mirrored position,
  which doubles the loop count and so needs a design call, not just code.
  **That call was made at v1.99d: leave it.** Tested in use and it does not
  get in the way — the case needs a ring parallel to the mirror axis AND the
  slider moved off centre, and the default lands on the plane. Doubling the
  loop count to rescue it would change what the slider means for every other
  ring, which is a worse trade. Accepted limitation, not an open bug.
- **Region inset still walks only its FIRST rim loop.** Two disconnected
  patches inset as one and the second gets nothing — pre-existing, not new,
  but symmetry makes it easy to reach: pick Organic or Keep shape with a
  mirrored pair. `each` (the default for a pair) is unaffected.
- The symmetry plane is captured, not live — see The symmetry plane below. If
  a model stops mirroring after a big change, re-tap Symmetry on.

## Interrupted gestures and stranded state (a2.43 / a2.43a)

A whole-file audit turned up eleven latent bugs; this is the seven that were
about a gesture being interrupted or a piece of state outliving what it named.
**Nothing here is a feature — every entry is a sequence a real user hits.**

- **A cancelled touch now ends a geometry drag.** The `pointercancel` handler
  ended the pivot drag, the soft slide and the tool ring, and left the
  GEOMETRY drag alive. A notification mid-drag on a phone, or a desktop
  release over the top bar, left the mesh following the bare cursor with orbit
  switched off, and the only way out was another press — which committed the
  edit wherever the cursor happened to be. Ending it COMMITS where the drag
  reached, which is what a lift would have done. `pointerleave` deliberately
  does not: straying over the top bar and back is not a cancellation.
- **A second finger no longer swallows a history step.** The two-finger
  camera takeover tore the drag down by hand and never pushed history, so the
  move stayed in the geometry and outside the undo stack — and the next Undo
  reverted that drag AND the edit before it in one press. It calls
  `endDirectDrag` now, like every other way a drag ends.
- **The Mirror chooser has an exit.** It borrows the op bar without a
  `pendingOp` behind it, so ✕ hit `cancelPendingOp`'s "no op, return" line and
  did nothing at all — the bar could not be dismissed, ever. It also mirrored
  whatever was selected when Joined/Apart was finally pressed rather than what
  it was opened on. It now captures its selection at open time and checks the
  mode before touching the live one.
- **A selection can outlive its object.** The six "that collapsed the whole
  mesh — removed the object" paths dropped the object without touching
  `App.selectedObjectIds`, and the next Duplicate or drag dereferenced a ghost
  and threw. Pruned in `refreshUI`, for the same reason isolation is
  reconciled there: every one of those paths ends by refreshing the UI.
- **The object row cancels an open knife**, like every other modal funnel.
  Without it the knife's points still belonged to the OLD object while the
  helpers showed the new one, so OK cut a mesh you were no longer looking at.
- **Redo declines while a primitive setup is open.** Both obvious answers are
  wrong: discarding throws away the shape you are dialling in, and committing
  pushes history — which TRUNCATES the redo tail, destroying the very steps
  Redo was asked to walk into. So it says "Finish the shape first".
- **Bevel and Split guard their edge ids**, which their three siblings already
  did.

### What a2.43a is, and why it matters

**Four of the five defects the reviewer found in a2.43 were introduced by
a2.43's own fixes.** The worst: `mirrorChooser` was cleared only by
`hideOpBar`, but `showOpBar` re-uses the same bar without going through it, so
the flag outlived the chooser — and then swallowed ✕ for whatever op opened
next, leaving a bevel preview baked into the mesh with no bar to reject it.
Also fixed there: a cancelled box drag left the camera dead, and the window
`pointerup` backstop could commit a drag when a second finger tapped Undo.

**A bug-fix pass needs reviewing as carefully as a feature.** This one had a
higher defect-injection rate than any feature in the project.

One thing worth knowing about the backstop: OrbitControls captures the pointer
on the canvas, and capture retargets the release, so the canvas listener
normally fires even over the top bar. The backstop only earns its place when
orbit was already disabled at press time and no capture was taken.

## Circularize (a2.42)

**Pulls a selected loop onto the circle it is trying to be.** Its own best-fit
plane, its own centre and radius, blended from where the loop is to where the
circle is by the op-bar slider. Seat **8.5** in all three component rings —
beside Set flow, because they are the same kind of thing: reshaping a loop
rather than adding to it. `toolRingAngles` sorts by seat and spreads evenly, so
a fractional seat is a legal bearing; the Edge ring was full at 14 and without
the fraction something would have had to be evicted.

- **Amount is a blend, not a distance.** 0 leaves the loop alone, 1 puts it
  exactly on the circle. One range means the same thing on a screw hole and on
  a hundred-unit ring. Opens at 1: "make it round" is the request, pulling back
  is the fine-tuning.
- **Even** is a bar toggle (the mechanism Set flow's option added at a2.34).
  Off, each vertex keeps the angle it already has, which preserves the loop's
  spacing. On, it becomes a regular polygon — what you want after a knife cut
  or a messy bridge.
- Works from Vertex, Edge or Face mode. Face mode uses the RIM of the patch,
  the same once-only edge test Inset and Set flow use.

### Islands: the part that is easy to leave out

Two rims picked together — the top and bottom of a tube, or a loop and its
mirror partner after `symExpand` — are **two circles**. One plane and one
centre across both drags them together, and with symmetry on it folds the model
in half on the first frame of the slider.

- Adjacency comes from the **loop edges the selection names**, not from every
  mesh edge joining two selected vertices. The two rims of a tube are joined by
  the band's own vertical edges, and that reading glues them into one island
  and fits a single circle through the whole cylinder.
- Islands are **walked** (runs first, from their degree-1 ends; then cycles),
  which produces the ring ORDER the plane fit and the even spacing both need,
  and a `closed` flag.
- A vertex with **three or more** loop neighbours is a junction, and a junction
  has no circle to be on. `circularizeIslands` returns `null` and the caller
  refuses **before the bar opens**, rather than fitting something meaningless.
- **Vertex mode narrows its own loop edges**: whichever faces the selection
  fully covers are treated as chosen, and the edges INSIDE that patch are
  dropped, leaving its border. That is what lets "select every vertex of a
  one-segment cylinder" round both rims instead of reading as one junction.
  **Unless the narrowing takes everything** — a closed surface has no border,
  so on a whole cube every edge goes and the selection looks unconnected. The
  unnarrowed set is kept in that case, so a solid reads as the branching
  surface it is and gets refused.
- With **no connectivity at all** and symmetry off, the whole selection is read
  as one circle — three vertices tapped across a grid. Not with symmetry on:
  then the picks and their partners are two groups and one circle across them
  straddles the plane. The test is the symmetry SETTING, not "did symExpand add
  anything" — someone who selected both halves by hand defeats that.

### The maths, and the three things that are not obvious

- **Newell for the plane**, not a cross product of two edges: stable when the
  points are nearly collinear. It sums a POLYGON, so the ORDER matters — four
  coplanar corners in the order TL, BR, TR, BL come back "degenerate". Hence
  the walk. A scattered island has no walk, so it gets a provisional normal
  from the widest triangle among a sample spread ACROSS the set (not the first
  sixteen — those arrive in tap order and can all lie along one side), then an
  angle sort, then Newell.
- **THE CENTROID IS NOT THE CENTRE.** They agree on a regular polygon and
  disagree badly on an arc, where the centroid sits inside the bow rather than
  at the centre of curvature. With the centroid, "round these three corners of
  a cube face" — three points that already lie exactly on a circle and must not
  move at all — pushed the middle one a third of a unit out of the cube. The
  fit is Kasa's algebraic least-squares circle, which returns that circle
  exactly.
- **The fit has to agree with the walk.** A circle fitted to points that do not
  SURROUND it can slide anywhere: four arc vertices with a third of their
  radius in noise fit a circle whose centre lands among them, the run then
  wraps around that centre, and Even spreads those four points right round the
  ring. So a closed island must sweep at least π about the fitted centre and an
  open run at most π; otherwise the fit is dropped for the centroid and the
  mean radius. Less accurate on clean input, and unable to turn an arc inside
  out.
- **Even's phase is least-squares** (a circular mean), the rotation that moves
  the points least — not "start from the first vertex". A vertex anchor breaks
  symmetry, because the mirror image of a loop has a different first vertex, so
  the halves come out as regular polygons rotated against each other. The
  circular mean is invariant to where the walk started AND to which way it
  went.
- **The winding comes from the signed area**, not from the sign of the
  unwrapped span. The unwrap folds any step wider than half a turn, which a rim
  with a reflex corner near the centre really does have, and reading direction
  off the fold laid such a rim out backwards against its own winding.
- **An open run is an ARC, not a ring.** Even spaces it between its two ends.
  Spreading n points over a full 360 turns a five-vertex arc into a pentagon
  and tears the mesh open at both ends.

### Writing it back

Through `toEditable` / `rebuildFromEditable`, which is what Set flow does and
for two reasons that are invisible until you skip it: the rebuild is what drops
the cached topology so the selection dots and edge highlights follow the mesh
instead of hanging in the air, and it is what re-runs `applyShading`, without
which a bare `computeVertexNormals` melts a flat-shaded model smooth on the
first frame of the slider. Crease and Sharp marks are keyed by POSITION, so
they are snapshotted against logical pairs and rewritten after — skipped if the
vertex count changed, because two targets landing on the same point weld and
renumber, and the snapshot holds old ids.

### Known limits

- One degenerate island among several is skipped silently: `moved` is an OR, so
  if one loop of a multi-loop selection cannot be fitted the others still
  report "applied". Harmless for a mirrored pair, which fail together.
- The scattered reading is unavailable while symmetry is on — by design, above.
- An open run sweeping more than 180° always falls back to the centroid, so a
  genuinely lopsided long arc is circularized about its middle rather than its
  true centre.
- Committing at amount 0 says "Circularize applied" over an untouched mesh. No
  empty history step (`pushHistory` dedupes identical documents), so cosmetic.

## Snap to geometry (a2.41)

**Snap cycles through three states now: off, the grid, the model.** One seat on
the world ring, and the top-right chip says which — a seat can only show that
it is on, not which of two it is on.

- **Grid** is what Snap has always meant: round the amount to `snapMove` /
  `snapRotate` / `snapScale`.
- **Geometry** lands the **pivot** exactly on a vertex, an edge or a face you
  point at. Move only — a snap is a translation, and there is no sensible
  reading of "snap this rotation to that corner".

They are **alternatives, not a fallback chain**. Geometry that quietly fell
back to the grid when nothing was under the finger would mean a drag could not
be free at all while snapping was on, and "why did it jump" is a worse question
than "why did it not".

### The pivot is what lands

Not the object's centre by arithmetic, and not "whatever was nearest" — the
pivot, which since a2.39 is a thing you can place on the exact corner you mean.
That is why it had to be built first. Put the pivot on one corner of a part,
point at a corner of another, and those two corners meet.

`App.snap` (boolean) became `App.snapMode` ('off' | 'grid' | 'geo'), with
`gridSnapping()` reading it at all seven sites that used to test the flag.

### Finding a target

Vertex beats edge beats face, judged in **screen space** — how every picker in
this app judges, and the only measure that behaves the same at every zoom. Same
priority the knife resolves with, and for the reason the knife's comment gives:
this is a snap, so it means *exactly this corner*, not *near enough*.

**Two radii, and the difference matters more than the numbers.** A corner is a
point you aim at and can afford a generous catch (`SNAP_VERT_PX` 20). An edge
is a long target you are incidentally near almost anywhere on a face: at one
shared 26px radius, pointing at the dead centre of a face 60px across still
landed on an edge, because the centre is only 30px from one. Faces became
unreachable in practice and the pull felt like the app second-guessing the aim.
`SNAP_EDGE_PX` is 11 — below it you meant the edge, above it you meant the
surface.

The search is **bounded to the face under the ray** and its own corners and
edges. Walking a whole mesh per frame would be the falloff overlay's first
version all over again, and it would not even be better: the corner you mean is
a corner of the face you are pointing at.

### A drag can never snap to the thing it is moving

This is the part that took two goes, and it is worth understanding because it
is not obvious. `beginDirectDrag` is only reachable by grabbing your own
selection, so **the pointer starts on top of the moving surface** — and the
target is recomputed each frame from geometry the previous frame moved. That is
a feedback loop, and it does not fail gently:

- Select a face and drag it: the pivot sits on that face's plane and so did the
  target, so the face **locked into its own plane** and could never be pulled
  out of it.
- The same in axis mode: the wanted offset came out perpendicular to the axis,
  so the face **did not move at all**.
- With the pivot off that plane by some distance δ, the selection **accelerated
  along the normal by δ every frame** — unbounded.

Skipping by vertex id alone was not enough: a face whose corners all move was
caught, but the *face fallback* returned the hit point on it regardless, and an
edge with one moving end was measured from its moved position. So the finder
**walks the hits** and rejects a whole hit when the face it landed on touches
anything that moves.

Two more rules fell out of it:

- **Mirror partners are moving geometry too.** `captureDragContext` deliberately
  drops them from `entries`, so `snapSkipSet` has to add them back — dragging a
  vertex and pointing at its own mirror hit the highest-priority branch, and the
  pivot chased a target running away from it.
- **A target must face you.** Once the dragged face is rejected, the very next
  hit along the ray is the *inside* of the same object: pointing at the top of a
  cube and having the pivot land on its underside. The app culls back faces, so
  a surface pointing away is one you cannot see — the same rule `vertexVisible`
  exists for.

### The marker shows where it will land, not where you pointed

In an axis-locked move the pivot reaches only the target's projection onto the
axis. The first version drew the target either way, so with X locked and a
corner off to one side the ring planted itself on that corner and the object
stopped short of it with nothing saying why. `snapLive.landing` is what the
marker draws — **a marker that promises somewhere the drag cannot reach is
worse than none.**

### Known characteristic

There is **no proximity gate**. If the ray hits anything at all, the pivot goes
there — so with a second object five units behind, an 8px nudge moves the
selection all five units. That is what "land the pivot on the surface I am
pointing at" means, and it is why the mode is one of three rather than always
on: small free adjustments are what Off is for.

Probe: `_snap_probe.py` — the cycle, each target kind and the priority between
them, the pivot (auto and pinned) landing exactly, Off and Grid not snapping to
geometry, rotate and scale taking no target, and the feedback loop measured as
zero drift across six still frames.

## The soft falloff, drawn (a2.40)

**Every component the drag would carry, shown at the strength it will be
carried with** — so the reach and the *shape* of the reach are both readable
before you commit to anything. That is the whole reason the radius is a gesture
rather than a number in a box: you are meant to watch the model.

Three layers, following the component type, because that is what "the things
this drag will move" means: **dots always** (the clearest read of a field at
any size), **edges in Edge mode**, a **surface tint in Face mode**.

### Fading, not hue

Until a2.40 the falloff was a hue blend on the base 2px dots. That was the
cheapest place to put it and the wrong one: a 2px dot has almost no area to
carry a gradient, it said nothing whatever about edges or faces, and hue is a
poor way to read *how much* — the eye reads fading far better than a shift
toward red.

three.js gives per-vertex alpha when the colour attribute has **four**
components (`USE_COLOR_ALPHA`), so the dots and the face tint carry the weight
as real transparency, and the tint's alpha is interpolated **per corner**, so a
face straddling the edge of the field fades across itself rather than stepping.

**Fat lines are the exception.** `LineSegmentsGeometry.setColors` is hardcoded
to three components in r184 — there is no per-vertex alpha on a Line2 at all —
so edges fade by colour instead, from the wireframe colour toward the selection
colour. Same reading, different mechanism, because the mechanism was not on
offer. Worth knowing before anyone tries to "fix" the inconsistency.

The base helpers went quiet again, on the same principle as the selection
overlay: the shared buffers stay dull and a separate object makes the affected
few loud.

### Three things this got wrong first, all worth keeping

**The tint is coplanar with the surface it tints.** It is a copy of the mesh's
own vertex positions parented to the same object, so with `depthTest` on, the
opaque mesh fills the depth buffer first and `gl.LESS` fails on equality — the
tint either vanishes outright or speckles. `depthTest: false` and
`side: DoubleSide`, exactly as the existing face overlays are built. The first
pass copied the *selection* overlay instead and inherited neither. DoubleSide
matters for the same reason `refreshXrayMode` documents: a mirrored object has
negative scale and reversed winding, so front-face culling hides exactly the
half you wanted to see.

**It has to follow the mesh through a drag.** Positions are read at build time,
and a drag moves vertices every frame — so the overlay hung in space over a
model that had moved out from under it, and stayed there after the drag ended,
because nothing on that path calls `refreshElementColors`. But rebuilding per
frame is not the answer either: the field is **frozen** for the length of a
drag (`captureDragContext`), so the weights, the vertex list and the colours
are all still right and only the positions moved. `refreshSoftOverlayPositions`
writes them into the buffers that already exist — a few hundred floats instead
of a fresh geometry, material and GPU upload every frame. Called from
`syncHelperGeometry`, beside the selection overlay's rebuild.

**The walks are bounded by the FIELD, not by the mesh.** `refreshElementColors`
runs on every pointermove of the radius slide, and the first version walked
every edge and every face group each time, allocating two `THREE.Color` objects
per surviving edge. On a subdivided mesh at a large radius that was hundreds of
thousands of array pushes and megabytes of throwaway buffers *per pointer
event* — worst on exactly the meshes where a falloff matters most. Candidates
now come from the field through `vertAdj` (faces) and a new cached
`topo.vertEdges` (edges).

### Known limits

- **Symmetry partners are not drawn.** With symmetry on, the drag also writes
  each entry's mirror partner, and those are not in the field unless they fall
  inside the radius on their own. The picture therefore shows *less* than the
  drag will move — the safe direction to be wrong in, but wrong.
- An unselected edge whose two endpoints are both selected is drawn by neither
  overlay, so it reads at base strength between two full-weight ends.

Also fixed here, pre-existing: `disposeSelectionOverlay` never removed its line
from `gizmoStrokes` while `syncSelectionOverlay` pushed on every rebuild — and
`syncHelperGeometry` rebuilds it every frame of a drag, so Edge mode appended a
dead `LineSegments2` sixty times a second, which `updateStrokeResolution` then
walked on every resize.

Probe: `_sviz_probe.py` — including that each dot's alpha equals that vertex's
weight exactly, that the tint fades across a face, that the overlay moves with
the mesh mid-drag without being rebuilt, and that the stroke list holds steady
across thirty frames.

## The pivot (a2.39)

**Rotate and scale turn around a point you can put where you like.** World
ring, left pole → Pivot, then: To selection, To object, By hand, or Auto.

The pivot has always existed — `App.pivot` is what every rotate and scale in
this app already turns around — but it was invisible and recomputed to the
centre of the selection on every drag, so *"turn this around THAT corner"* was
not expressible. Now `App.pivotMode` is `auto` (exactly the old behaviour) or
`custom` (pinned to a world point in `App.pivotPoint`).

**A pinned pivot is a place in the scene, not a property of the selection.**
Move the object and the mark stays where you put it — Blender's 3D cursor, and
for the same reason: a mark that follows things around is not a mark. It is
view state like the camera and like isolate: never serialized, never a history
step, kept across an undo and dropped on a load (a load is a different scene,
and the point would be left pinning rotation to a spot with no relationship to
what just arrived).

`To object` uses the **bounding-box centre**, not the origin. The origin is
wherever the geometry happened to be built around and is regularly nowhere near
the shape; the box centre is what a person means by "the middle of it".

**Two places position the pivot** and both have to honour a pin —
`recenterPivot` (called at the start *and* end of every drag) and
`refreshGizmoAttachment` (which positions it itself rather than calling that
one, in two separate branches for object and component mode). Miss any of them
and the pin survives exactly until the next thing you touch.

### The drag needs two points, not one

This is the defect worth remembering. `beginDirectDrag` built its
camera-facing drag plane, its `startHit` and its `origin` all from
`pivot.position` — fine while the pivot was always the selection centre, wrong
the moment it could be pinned elsewhere:

- **The plane belongs at the SELECTION's depth.** Screen-to-world scale on a
  camera-facing plane is proportional to camera distance, so pinning the pivot
  three times further away made every drag travel three times as far as the
  finger.
- **The plane intersection is the gate for all three tools.** With the pinned
  point behind the camera, `Ray.intersectPlane` returns null, `beginDirectDrag`
  returns false, and grabbing your own selection silently orbits instead —
  the "sometimes it won't translate" failure this file already fixed once,
  arriving by a new route.

So `directDrag` now carries **`origin`** (the pivot — what rotation turns
around and scale grows from) and **`center`** (where the selection actually is
— what the plane, the start hit and the move axis are measured against). In
auto mode they are the same point and nothing changes.

### Placing it by hand

The bar opens and **a drag anywhere** moves the marker — not just on the 17px
dot, because aiming at a 17px dot with a thumb is exactly what this app does
not ask of people. Free and Axis mean here what they mean everywhere else, the
axis guide draws itself the same way, and the grid applies.

`beginPivotPlacing` settles the knife, any pending op and any geo setup first —
the same opening `startGeoSetup` has, and for a sharper reason than tidiness:
`#opBar` and `#pivotBar` share a slot at the bottom of the screen and the op
bar painted over this one, so Done became unreachable. With the world ring
unable to bloom while placing, and no Escape key anywhere in this app, that was
**an unrecoverable lock** — the only way out was loading a file.

**A tap ends the placing**, and that had to be decided in `endPivotDrag`
(`moved`), not in `handleTap`: every press while placing becomes a pivot drag,
and `pointerup` returns at that branch long before `handleTap` is reached, so
the guard there could never fire. A tap is a drag that went nowhere.

`cancelPivotDrag` runs from `pointercancel` / `pointerleave` and from the
two-finger camera bail-out. Without it a desktop drag released over the top bar
left the drag live with orbit off, and the bare cursor went on dragging the
pivot with the camera dead.

### The marker, and when it is worth drawing

Two dots, one inside the other, reading as a ring — it has to be unmistakable,
because at 2px the mesh dots and at 7px the selected ones are already dots, and
a pivot that could be mistaken for a vertex is worse than no marker: you would
aim at it. Constant screen size, no depth test, and a colour that is neither
the accent nor the selection colour — the pivot is a place, not a thing you are
editing.

**a2.39a: it is not left on.** Drawn permanently it was clutter — a bright dot
parked over the model for the whole session, saying something that only matters
at two moments. `pivotMarkerWanted` draws it at exactly those:

- while you are **placing** it;
- for `PIVOT_FLASH_MS` after it is **set**, so you see where it landed (setting
  it and getting no acknowledgement at all is the other failure);
- throughout a **rotate or scale** drag, because that is when it is doing
  something — you are watching the model swing and the dot is what it swings
  around. Not during a Move: the pivot plays no part in one.

Hiding it the rest of the time would make a pinned pivot invisible state, which
this project keeps having to kill — so the **tool chip carries a permanent
"Pivot"** while the mode is custom. Two words in a corner cost nothing and mean
rotation can never behave surprisingly with no explanation on screen. In auto
the chip says nothing extra and the marker never appears at all.

### The world ring's left pole

Claimed by Pivot at a2.39, after being deliberately empty so the two arcs read
as two arcs. The layout is better for it — pole, arc, pole, arc separates the
groups more firmly than an empty side did — and there was a practical reason
too: the pivot is wanted in **every** mode, and the Edge ring has no free seat
left at all.

Probe: `_piv_probe.py` — including the one that matters, a cube at x=2 with the
pivot pinned at the origin swinging to z=−2 on a quarter turn rather than
spinning where it stands.

## Isolate (a2.38)

**In Object mode, pinch three fingers IN and everything except the selection
goes away. Pinch OUT and it all comes back.** A chip at the top says how many
are hidden and brings them back on tap.

### It stores what is HIDDEN, and that is the whole design

`App.hidden` is a Set of object ids. Empty means everything is on screen.

The first version held the opposite — the ids that SURVIVE — and it was wrong
in a way worth remembering, because it looked equally reasonable. Holding "who
survives" makes **every object the app creates a special case**: join, mirror,
separate and duplicate all build a new object, and each one has to be told to
add itself to the set or it is born invisible. Review found four separate
defects from that one choice — Join made the joined object vanish, Duplicate
produced a copy that was drawn but unpickable, and Separate hid every part it
had just created.

Held as "who is hidden", **a new object is visible because nothing ever named
it**, whatever made it and whenever. There is no creation hook to forget. The
only upkeep left is dropping ids that no longer exist.

### One funnel: `refreshUI`

`reconcileIsolation()` runs from `refreshUI`, and nowhere else that matters.
Every op in the app ends by refreshing the UI, so that single hook covers join,
mirror, separate, duplicate, object delete and the six collapse paths (weld,
target weld, merge, collapse, detach, last-face delete) — none of which the
first version's two hand-placed hooks reached. It does nothing at all when
nothing is hidden.

It has three jobs, each a bug otherwise:

- **Drop dead ids**, or the count on the chip drifts away from the truth.
- **Re-apply visibility**, because `restoreDoc` builds BRAND NEW meshes and a
  new mesh is visible — without it an undo quietly un-hides half the scene
  while the chip goes on claiming otherwise.
- **Never leave nothing on screen.** If everything ends up hidden, hiding is
  over. An empty viewport with no explanation is the failure this whole feature
  exists to avoid.

It also clears `App.activeObjectId` when that object is hidden. Component mode
reads the active id **directly** — it does not go through the pickers — so a
hidden active object meant extrude, bevel and delete all running on a mesh
nobody could see. `enterIsolation` calls reconcile rather than plain apply for
exactly this: the active object is usually one of the ones about to disappear,
because it is whatever you touched last.

### A hidden object must not be pickable

**three.js r184's raycaster tests LAYERS and nothing else** — it does not skip
an object whose `visible` is false. So `pickObjectAt` and `performRegionSelect`
filter through `objectPickable` explicitly. Without that, isolate would have
hidden things you could still tap and drag by accident, which is worse than not
hiding them at all. `focusOnAll` and `focusOnObject` filter too: framing a box
drawn around hidden geometry flies the camera off to nothing.

**The camera does not move on isolate.** Framing the survivors is the obvious
extra touch and it is the wrong one — this app took Smart camera out because
"being moved when you did not ask to be moved reads as the app losing your
place". Isolate hides, and only hides. The chip is what tells you where
everything went.

### Never saved

Nothing about isolation reaches `serializeDoc`. It is a way of looking, like
the camera. `restoreDoc` **drops** it on a load and **keeps** it on an undo,
told apart by `opts.keepSelection` — undo and redo pass it, the three load paths
(a saved model, the autosave, a project file) do not. Without that split the ids
carry over, and since ids are small integers counted from 1 they collide across
documents almost always: isolating object 3 and then opening a different file
opened it with one object showing and the rest hidden.

### The outliner keeps them

Hidden objects stay in the list, dimmed with a struck-through name — it is the
one place a hidden object is still visible AS a thing that exists. **Tapping a
dimmed row brings that one back** rather than selecting something invisible,
which was the trap: the row selected a hidden object and Delete or Ctrl+D then
acted on a thing nobody could see.

### The gesture, and why raw spread cannot work

`ISO_PINCH_RATIO` / `ISO_PINCH_PX` / `armIsoPinch` / `isoPinchMove`.

It fits between the two gestures three fingers already have and disturbs
neither. A three-finger TAP cycles Free/Axis — a tap is still, and this needs
travel. A three-finger SLIDE sizes the soft falloff — and soft cannot be on in
Object mode, so the two can never be asked at once.

**The obvious test — "has the mean distance from the centroid changed" — cannot
be made to work, and the probe caught it firing on an ordinary three-finger
slide.** Pointer moves arrive ONE FINGER AT A TIME: after the first of three
has been updated and the other two have not, the hand genuinely looks squeezed,
and on a 220px slide that phantom squeeze is a third of the spread. Real fingers
stagger exactly the same way.

So each finger is measured on its **own travel along its own outward
direction**, and the gesture only counts when every one of them agrees:

- A real pinch moves all three toward the centre (or all away), so every radial
  reading has the same sign and the smallest is still large.
- A slide moves all three the same way, and since they sit at different bearings
  the readings disagree in sign — the leading finger reads outward while the
  trailing one reads inward.
- A half-updated hand leaves two fingers reading nearly zero, so the smallest is
  nowhere near the threshold.

Judging on the **smallest** rather than the average is what makes all three
cases fall out of one rule. It fires once per gesture (`fired`), or a hand that
keeps closing would isolate the survivors, then one of those, and so on down.

Probes: `_iso_probe.py` (the gesture and what stays pickable) and
`_iso2_probe.py` (the seven review defects, each checking the whole picture
agrees with itself rather than one value).

## Soft selection (a2.37)

**The mode button has three positions now: Object, Component, Soft.** In Soft,
what you drag carries its neighbourhood with it, fading out over a radius.
**Three fingers sliding sets that radius**, and the vertex dots light up to
show its reach as you slide.

### Soft is not a fourth mode — it is a way of DRAGGING

`App.soft` is a boolean; `App.mode` still says which component type you are
picking. That is the whole reason this was cheap and safe: every branch in the
app that reads `App.mode` is untouched, leaving Soft leaves you in the same
component type with the same selection, and the button keeps showing the
component icon and grows a ring rather than swapping to a fourth pictogram.

`cycleEditMode` runs Object → Component → Soft → Object. `setMode('object')`
turns Soft off, so coming back in through the button re-enters Component — the
three positions are a cycle, not a memory.

### Distance is measured ALONG the surface

`softWeights(obj, seeds, radius)` — Dijkstra over `topo.edges` with world-space
edge lengths, seeded from every selected vertex at once, stopped at the radius.
`softHeap` is a small binary heap, there because an unbounded frontier on a
subdivided mesh is thousands of nodes and the alternative is a re-sort per pop.

Straight-line distance is one line of code and wrong on anything folded: the
far wall of a thin box is millimetres away through the air and half a model
away across the mesh. **Measured**: a 4×4 slab 0.2 units thick, radius 1.0 —
the far wall is untouched, the field is the near side only. A separate object
is never reached at all, because there is no path to it.

World space rather than local because the radius is a number dialled against
what you can SEE; a scaled object would otherwise take a different bite at the
same setting.

**One falloff curve**, `softFalloff` — a cosine ease, 1 at the centre, 0 at the
radius, flat at both ends so neither the selection nor the boundary shows a
crease. Deliberately the only curve: a menu of seven is more than a one-handed
fidget needs, and none of the other six changes what the tool is for.

### The weight scales the RESULT, not the matrix

In `applyDeltaToSelection`, an entry carries `w` and lands at
`lerp(where it was, where the full transform would put it, w)`. Blending the
matrix itself would need it decomposed and the rotation slerped, and for a
partial scale is not even well defined. One line, and **Move, Rotate and Scale
all fall off** because all three already funnel through this one function.

`captureDragContext` widens the SNAPSHOT, not the selection: the neighbourhood
rides along as extra entries. Lifting your finger leaves the same vertices
picked you started with, and every op still sees exactly what you chose. The
field is **frozen** at drag start — recomputing it per frame would re-weight
vertices as they move and the falloff would smear outward under your own
finger. Not applied while an extrude section is live; that branch borrows the
same path.

### Symmetry: the invariant nobody knew was there

An entry writes ITSELF and its mirror partner, so **entries and their partners
must be disjoint**. Every selection satisfied that by accident until soft
selection arrived — the field spreads in all directions, so the moment it
crosses the plane the mirror partner of a selected vertex is also an entry,
later in the list, carrying a fraction of the weight. Entry A wrote A at full
travel and A′ at its mirror; entry A′ then overwrote A′ with its own weighted
move and overwrote A with the mirror of that. **The vertex under your finger
went backwards** — measured at −0.25 on a 1.0 drag along the mirror axis.

So a partner that already has an entry loses that entry; it is written by the
vertex it mirrors, which is what symmetry means. The selection is walked first
and always wins the claim. This also settles the older order-dependent case of
selecting a vertex and its own mirror and dragging both.

The filter has to run **after `ctx.mirrorMap` is assigned**. The first attempt
sat with the soft entries a few lines earlier, where the map is still
undefined, so the whole thing silently skipped — the probe caught it unchanged.

### The gesture

`SOFT_SLIDE_ENGAGE_PX` → `endSoftSlide`. Three fingers already handed the whole
gesture to the camera, and a three-finger TAP still cycles Free/Axis, because a
tap is judged on stillness and this needs real travel. Not a slider: the radius
is judged by watching the dots on the MODEL, and you cannot watch a slider and
the model at once — the same argument that gave lighting a gesture.

**Multiplicative.** A radius is a scale, and the meshes here run from a
0.1-unit bead to a 40-unit terrain; a fixed number of units per pixel is either
useless or uncontrollable on one of them. A third of the screen multiplies by e.

Four things the review caught here, all of them the difference between a
gesture that works and one that eats the app:

- **Travel is measured from when the THIRD finger landed** (`softArm`), not
  from each pointer's lifetime maximum. Two fingers mid-orbit have travelled
  hundreds of pixels, so a lifetime maximum meant a third finger or a palm
  engaged on its first move, killed the orbit and started rewriting the radius
  with movement meant for the camera. In Soft, "two fingers that have already
  moved" is the ordinary state.
- **A finger arriving mid-slide belongs to the slide** (`softSyncSlide`).
  Otherwise the two-finger bail-out set `orbit.enabled = true` in the middle of
  a gesture OrbitControls had been shut out of — the exact state
  `maybeResumeOrbit` exists to avoid — and moved the mean the radius is
  measured from without re-baselining, jumping the radius in one frame.
- **`pointercancel` / `pointerleave` end it.** Cancellations are routine on a
  phone. Left open, the HUD stayed up, orbit stayed disabled so the camera was
  dead, and the next SINGLE finger anywhere fell into the slide branch and
  rewrote the radius by most of a screen width.
- `orbit.enabled` is never handed back with fingers still down; it goes through
  `orbitResumePending` / `maybeResumeOrbit`, same as the light hold.

### The radius belongs to the object it was measured against

`seedSoftRadius` takes a quarter of the object's world-space bounding-box
diagonal and records `App.softRadiusFor`. `refreshSoftField` re-measures
whenever the active object is not that one — **not** only when Soft is switched
on, because the active object changes on paths that never pass through
`setSoft`: tapping another object's surface, the outliner chip, and loading a
file (which also carries `App.soft` and the old radius onto a document whose
object ids commonly collide with the previous one's).

A radius is a length in one object's world. Carrying 0.03 from a bead onto a
40-unit terrain gives a Soft mode that does nothing while the button says it is
on — the failure this project keeps having to kill. Re-dialling costs one
slide; being silently inert costs trust.

### The tint, and why it must not lie

The falloff is drawn by its own overlay, on dots, edges and faces, with real
per-vertex alpha — **see "The soft falloff, drawn (a2.40)" above**, which
replaced the hue tint the base dots carried at a2.37. The reach and the SHAPE
of the reach are both visible before you commit, which is the whole reason the
radius is a gesture rather than a number in a box.

Which is why `restoreDoc` calls `clearSoftField()`. The field's signature leans
on the position attribute's `version` to notice a changed mesh, and a rebuilt
attribute starts at version 0 — so **two restores in a row** (undo then redo,
or any two loads) produced identical signatures for different meshes and the
second handed back the first one's field. The drag was always safe, since it
recomputes; a lying picture is worse than none.

`softGraph` memoises the world positions and the adjacency per (object,
attribute version, world matrix). The slide changes the radius every frame and
none of that depends on the radius. **Measured**: 200 radius changes on a
1490-vertex sphere rebuild the graph once, not 200 times. Counted rather than
timed, because a headless run is under virtual time where `performance.now()`
jumps rather than ticks and a rebuild and a cache hit both measure 0.00 ms.

Probes: `_soft_probe.py` (the field and the weighted drag, including the thin
slab), `_soft2_probe.py` (the three positions, the gesture, the tint) and
`_soft3_probe.py` (the eight review defects, each with a control).

## Primitives, and Add geo (a2.36)

**The world ring's Add Cube is now Add geo, and it opens a ring of five
shapes: Cube, Cylinder, Sphere, Torus, Plane.** Pick one and the object is
made immediately, at the size and divisions you can then change live on a bar
at the bottom of the screen. Done keeps it. A tap anywhere off it throws it
away.

### The shapes are built as CAGES, not as three.js geometry

`PRIM_SPECS` / `buildPrimitiveEditable(kind, params)` / `primCube`,
`primPlane`, `primCylinder`, `primSphere`, `primTorus`, all in the
`PRIMITIVES (a2.36)` block.

None of them uses `THREE.CylinderGeometry` and friends, and that is
deliberate. Those arrive as triangle soup split along UV seams: a
CylinderGeometry has no face loop to cut, no ring to walk, its wall in
triangles and its cap in a fan of them. **A cylinder you cannot loop-cut is
not a cylinder this app can use.** So every shape is built here in the app's
own editable form — quads for every side wall, one n-gon per cylinder cap,
triangles only where a sphere meets its poles — with each face carrying its
own vertices, welded by position on rebuild the way every other op here
works.

Sizes are per-axis (`x`, `y`, `z`); divisions are two counts whose meaning
depends on the shape, which is why each spec names its own labels:

| shape | `hLabel` / min | `vLabel` / min | notes |
|---|---|---|---|
| Cube | Across, 1 | Up, 1 | `h` is both horizontal axes |
| Cylinder | Sides, 3 | Up, 1 | caps are n-gons |
| Sphere | Around, 3 | Rings, 2 | tris at the poles only |
| Torus | Around, 3 | Tube, 3 | all quads; `y` is the tube diameter |
| Plane | Across, 1 | Along, 1 | `noY` — no Y size, it is flat |

`primParams` clamps: counts to `[min .. 64]` horizontally and `[min .. 32]`
vertically, sizes to `>= 0.01` (a zero size is a mesh whose normals cannot be
computed). Nothing needs disabling in the UI because of it — press the
stepper past the end and the number simply stops.

`_prim_probe.py` audits all five: face and vertex counts against the
parameters, how many faces are quads, winding, the Euler characteristic (2
for anything closed, **0 for the torus**, which is the cheapest proof its
ring closed both ways), and vertices tested against the exact surface rather
than against a bounding box. **A faceted prism's box is not its diameter** —
a hexagonal prism of radius 1 measures 1.73 across the flats — which read as
a bug twice before the probe started testing the surface instead.

### The chooser is a ring REPLACING a ring, not a second ring

`HUB_TOOLS_GEO` / `openGeoRing` / `armStickyRing`.

This is not the two-ring bloom on the do-not-rebuild list. That one showed
two rings at once, and an outer ring picked by angle is unreachable by
construction. Here the world ring closes and this one opens in its place, at
the centre of the viewport, picked the way every ring here is picked: aim
from the centre, release.

Two things follow from the fact that your finger has already LIFTED by the
time it appears:

- **It waits for a fresh press.** `toolRingActive.sticky` means no pointer
  capture, and the aim is measured from the ring's own centre because the
  gesture that will pick it has not started yet and has no origin of its own.
  `pointerdown` has a branch that claims that press for the ring.
- **It needs a way out that a slide-and-release ring does not.** That one is
  dismissed by lifting near where you started; this one has no "where you
  started". So aiming well past the items (`> radius * 2.2`) means "none of
  these", and the middle still does too.
- `openGeoRing` blooms inside a `setTimeout(…, 0)` because it runs from
  INSIDE `closeToolRing`, which tears the ring element down after the tool
  has run.
- `armStickyRing` installs a **document-level capture-phase `pointerdown`**
  that closes the ring when the press lands anywhere but the canvas.
  Without it, a tap on Undo or the menu never reached the canvas listener,
  so on a phone (no `pointerleave`) the ring stayed up with the camera
  disabled and ate the next canvas tap. `closeToolRing` removes it first
  thing.

### The setup bar

`App.geoSetup = { objId, kind, params }`, `#geoBar`, and
`startGeoSetup` / `applyGeoParams` / `syncGeoBar` / `finishGeoSetup`.

The object is made the moment you pick a shape and edited in place from
there — the bar is not a dialogue describing something you cannot see, it is
a set of handles on the thing itself, sitting in the scene at the size it
will keep. `setPrimitiveGeometry` rebuilds it on every stepper press and
every keystroke, cloning the current material so a theme or a picked
material survives a change of divisions.

**Nothing reaches the history until Done.** Every division you tried would
otherwise be its own undo step, and there would be no single press that takes
the whole primitive back. That one rule is what almost every bug in this
feature came from, and each of these is a fix, not a nicety:

- `endDirectDrag` skips its `pushHistory` while a setup is open. Dragging the
  new shape into place is part of the setup — the tap guard allows it on
  purpose — and a step pushed there left a half-built primitive in the
  history AND in the autosave, which rides on `pushHistory`.
- `finishGeoSetup(false)` calls `scheduleAutosave()`. The history is untouched
  by a discard, but **the autosave is not the history**: it serialises
  `App.objects` when its timer fires, and the primitive is in there from the
  moment it is made. Anything that armed that timer mid-setup — painting a
  material, or the op this setup resolved on its way in — wrote the discarded
  shape to disk, and it came back on the next reload in a document whose
  history has no step that removes it.
- `restoreDoc` drops an open setup. Ids come from the DOCUMENT, so a bar left
  open would silently retarget whatever object in the LOADED model wears that
  id — a stepper press would turn it into a cylinder, a tap on empty space
  would delete it. Undo and Redo close the setup themselves; this covers Load.
- The keydown handler commits the setup before running any shortcut, except
  Ctrl+Z / Ctrl+Y. Unguarded, Ctrl+D duplicated a primitive that was not in
  the history yet and buried the original inside ITS step.
- `startGeoSetup` resolves the knife and any pending op, then calls
  **`setMode('object')` rather than assigning `App.mode`**. The assignment is
  what Add Cube has always done, and it skips everything `setMode` does around
  it: the previous object's dots and red overlay went on hanging over it, and
  its face indices stayed in `App.selectedElements` for an object that was no
  longer active.
- `syncGeoBar(typing)` never writes a clamped number back into a field you
  are typing in. It made them unusable: emptying a field refilled it
  instantly, and the `0` of `0.5` clamped to the 0.01 floor and was written
  back with the caret at the end, so the `.5` landed on `0.01`. Squared up on
  blur instead.

Reaching for another ring, or switching mode, ACCEPTS the shape — you have
clearly moved on, and the alternative is a hold that silently does nothing,
which is the exact failure mode a2.33 spent a day removing.

**Every primitive arrives at the world origin** (a2.36a), whatever is
already standing there. Add Cube used to step new objects across and back
from a slot picked out of `App.objects.length`, and that does not survive
contact: the count moves when you delete something so the slots collide
anyway, the camera is usually looking at the middle of the scene so a new
shape could arrive off-screen, and the offset was invisible arithmetic
nobody could predict or aim at. The origin is a place you can point at.
Overlapping is the user's business — drag it off, the selection is already
on it. `addCubeAction` went with the old slot, since both rings that carried
it now call `openGeoRing`.

Probes: `_geo_probe.py` (the flow end to end: ring, bar, clamps, Done, the
outside tap) and `_geo_probe2.py` (the eight defects two review passes found,
each with a control case where one was needed).

## Target weld, by gesture (a2.35)

**Tap a vertex, then double-tap another: the first moves ONTO the second,
and the second does not budge.**

That last part is the whole point, and it is what separates it from the
ring's Weld. Weld melts its selection into the selection's own middle —
right when you are closing a gap, wrong when you are putting a corner
exactly where another corner already is, which is most of what welding is
for while cleaning topology up. Maya has this as a tool you pick up and
drag with; here the second tap IS the destination, which suits a thumb
better than aiming a drag at a 6px dot.

`weldVerticesOp(obj, ids, at)` gained the optional landing point. Without
it, nothing about Weld changed.

### How the pair is remembered

`App.vertAnchor` is the selection that existed BEFORE the vertex you just
tapped, recorded on every vertex tap — the same shape as the edge anchor
that joins two edges into a run. It is set to null the moment a tap lands on
something already selected, which is what stops a second double-tap on the
same vertex from welding a stale pair.

The sequence matters and is worth spelling out: the first tap of a
double-tap runs `handleTap` and selects the target, so by the time
`handleDoubleTap` fires, the anchor holds exactly the vertex you tapped
before it. The 1500ms freshness window therefore only ever guards a
double-tap whose first tap missed.

**The vertex near-miss fallback is BOUNDED** (`lastVertPick <
logicalCount`), for the reason the edge branch has always stated: every mesh
edit renumbers, so a remembered index can point past the end of the topology
it is being used against. It was not, and the review found it throwing on a
smaller object.

**The anchors die with the active object.** `setMode` and
`switchToComponentType` always cleared them; the third way the active object
changes — tapping a different mesh's surface — did not, and a Target weld
could then fire on the mesh you had just switched TO using ids from the one
you switched FROM. That branch clears both anchors now.

### Symmetry

Target weld handles it itself rather than through `runMirrored`, because it
has two inputs rather than one selection. It mirrors the sources and the
target, remembers the mirrored pair as POSITIONS (the first weld rebuilds
and renumbers), welds one side, re-resolves by position, welds the other —
one history step for both. A pair that is its own mirror runs once. Measured
on a cube with symmetry on: 8 vertices to 6, one Undo step, both sides done.

### WELD BEATS FOCUS — a decision, not an oversight

Double-tap used to mean "frame this". The two cannot both own the gesture:
the first tap of the double-tap is what records the pair, so *a vertex was
selected and I double-tapped another* is the same input whether you meant to
weld or to frame. **Zeghreit chose the weld.**

Framing is still one gesture away in Vertex mode — double-tap the object's
surface clear of any vertex, or empty space, or the vertex that is already
selected, which the anchor rule exempts — and a weld you did not mean costs
one Undo and says what it did.

## Set flow (a2.34)

A loop settles onto the curve the surrounding mesh already implies. It is on
all three component rings and it is also a switch on Loop cut.

**What the two tools it comes from actually do**, checked rather than
remembered. Maya's **Edit Edge Flow** "adjusts the position of edges to fit
the curvature of the surrounding mesh" and has exactly one option, *Adjust
Edge Flow*, 0 to 1, default 1, where 0 "moves the selected edges to the
middle of the other nearby edges, creating a flat transition"; its docs
recommend no more than two non-adjacent loops at a time. Blender's
**EdgeFlow** add-on (BenjaminSauder) does the same job "via a spline
interpolation such that it respects the flow of the surrounding geometry" —
**a Hermite spline with control points taken from the neighbouring edge
loops** — with Mix, Tension, Iterations and a Min Angle guard, and ships
*Set Linear* (the flat end as its own tool) and *Set Vertex Curve* for
vertex selections.

### The maths, and why the obvious version of it is wrong

For each vertex the caller supplies the two vertices ACROSS the loop, `a`
and `b`, and where the vertex belongs between them, `t`. Then with `a2` and
`b2` the next ones out:

```
T0 = tangent at a, in the direction of travel, scaled by |b - a|
T1 = tangent at b, same
v' = lerp(a, b, t) + amount * (H(t) - lerp(a, b, t))
```

Three things in that line are load-bearing:

- **The straight position is subtracted, not assumed.** A Hermite's own
  baseline is a smoothstep, not a lerp, so at any `t` other than the middle —
  which is every vertex of a slid loop cut — building it in directly would
  drag the loop toward the centre as a side effect.
- **amount 0 is exactly Maya's flat transition** and 1 is the curve, so the
  range carries on to 2 and over-bends, which is how a low-poly cage is made
  to read rounder than it is.
- **The tangent DIRECTION is where all the accuracy lives.** The obvious
  estimate — the outer chord `a2 -> a` alone — is wrong by half the angle the
  span turns through, because the two chords meeting at `a` do not cover
  equal arcs: the outer one is one ring step, the span across is two.
  `weightedTangent` weights each chord direction by the OTHER's length (the
  non-uniform Catmull-Rom tangent), which on a circle is exact.

Measured on a five-loop arc of radius 2 with the middle loop flattened onto
its chord (1.8794) and flowed back at 1:

| tangent estimate | radius returned | error |
|---|---|---|
| outer chord alone | 2.0504 | 2.5% proud |
| uniform Catmull-Rom | 1.9228 | 3.9% shy |
| **chord-length weighted** | **1.9964** | **0.18%** |

What is left is the cubic's own error against a circle, not the estimate's.

### Two neighbours is not the same as two neighbours ACROSS

The first version accepted any vertex with exactly two non-loop neighbours.
Where a selection turns a CORNER there are exactly two — and they sit at
right angles on the SAME side. The curve then runs between two points that
are not across anything: measured, a vertex thrown 0.87 units on a DEAD FLAT
grid, in all three modes, on a surface whose implied curve is a straight
line and where nothing at all may move.

So the pair has to be genuinely opposed: `FLOW_MIN_OPPOSITION`, 110 degrees
at the vertex. A loop on any smooth surface reads near 180 (a
20-degree-per-step arc reads 176); a right-angled corner reads 90 and is
refused, as is the corner of a cube's own edge loop, where "across" means no
more than it does on the flat grid.

### What each mode reads as "the loop"

| mode | vertices | edges that run ALONG it |
|---|---|---|
| Vertex | the selection | edges with both ends selected |
| Edge | the endpoints of the selection | the selected edges |
| Face | the rim of the patch | the edges appearing once around it |

Face mode is the rim on purpose: after an Inset or an Extrude the new rim
settles onto the curve running through the face inside it and the surface
outside it. A patch one face wide has nothing on the inside of its rim and
is refused, which is correct rather than a gap.

### Loop cut's Flow switch

Flow is not a third SPACING — Even and Slide answer where the loop goes,
Flow answers what shape it takes when it gets there, and you want both. So
it is an independent switch (`OP_SPECS.toggle`, rendered by
`refreshOpToggle`) rather than a chip in that exclusive row, the way Maya's
Multi-Cut carries edge flow separately from where the loop lands.

**The inserted vertices are recovered, not tracked.** Every one of them lies
on an edge that no longer exists, so `loopCutBeforeState` records the edges
before the cut and `loopCutFlowItems` finds the vertex's original span as
"the vanished edge it sits on", with its own `t` along it. That needs no
instrumentation inside `edgeLoopOp`, it covers the mirrored ring in the same
pass, and handing the flow the ORIGINAL span rather than the immediate
neighbours is what makes two sections and a slid loop come out right.
Measured on the same arc: Flow off lands exactly on the chord (1.9696 =
R·cos 10°), Flow on at 1.9998; two sections at 1.9998 each; a slide at 0.2
and 0.8 both at 1.9999.

### Seats

Set flow holds **seat 8** in all three component rings. The Edge ring had
exactly one free bearing and that was it, so the choice was one bearing
everywhere for Set flow or one for Shade — and **Shade moved to seat 11 in
the Face ring**, keeping 8 in the Object ring where shading a whole model
belongs. Seat 8 already read as "how the surface behaves"; Set flow is that
idea with topology behind it instead of normals.

## Extrude is a MODE (a2.31, Rotate/Scale at a2.32)

Extrude used to be a thing that HAPPENED: it committed a 0.02 nub, toasted
"drag the gizmo to place it", and handed you back to the ordinary move tool.
That made it the only shaping op with no control of its own, and it is what
"an extrude just happens, with no feedback" on the pre-2.0 list meant.

It now opens a mode, built on the pending-op machinery every live op already
uses (`beginPendingOp` snapshots, `applyPendingOp` re-runs from that snapshot
on every tick, `confirmPendingOp` / `cancelPendingOp` end it). `op.live`
marks it, and that flag is the whole switch:

| gesture | meaning |
|---|---|
| drag on the new section (Move) | its height — out, or back in past zero |
| **tap** the new section (Move) | stack ANOTHER section from where this one ended |
| drag it under Rotate / Scale | the ordinary transform — see "settling" below |
| two-finger tap | cycles Move / Rotate / Scale, as everywhere else |
| tap anywhere else, or Done | commit the lot, **one** Undo for all of it |
| the grouping chips | live, and each one re-measures the drag direction |

**The pull has no ceiling** (a2.32). `setPendingAmount` skips the op spec's
range for a live op — that range was only ever the slider's, and this is a
drag. The ±1e5 rail left in place is a guard against a degenerate projection
producing a nonsense number, not a design limit.

The bar is the same `#opBar` wearing a different face: no slider (the drag on
the model IS the control), no Cancel, OK reads **Done**, and the label counts
the sections — "Extrude ×3". `showExtrudeGroupingChooser`, the one-tap modal
that used to ask Joined/Joined/Each, is GONE; its three options are now those
live chips, filtered by `needsMultiple` against `payload.picked` — the count
the user selected BEFORE symmetry expanded it, so one face plus its mirror
still shows no chips, exactly as the chooser refused to ask.

### Which way a drag pulls is MEASURED

`measureExtrudeAxis` runs the op at two heights and reads where the
selection's centroid actually went. One piece of code then answers
Joined-own, Joined-avg, Each and edge extrude — none of which agree about
direction — and it also detects the case that HAS no direction: two opposite
faces in Each mode, whose centroid does not move at all. It runs once when
the mode opens, once per stacked section, and once per grouping chip.

It yields `{dir, scale}`, where scale is how far the centre travels per unit
of amount: 1.000 for a plain face extrude, 0.707 for Each on two faces 90°
apart. Every path divides by it, so the GEOMETRY keeps up with your finger
rather than the number doing so.

### The drag reads the axis's SCREEN direction, and that is not fussiness

The first version slid along the axis in 3D with `axisParamFromPointer`,
which is what every other axis drag here uses. **It blew up**, and the review
caught it before it shipped. That function solves for the closest point
between the view ray and the axis, so its denominator is the sine of the
angle between them and world-units-per-pixel go as 1/sin. Measured at this
app's own 50° fov, 800px high, camera 5 units out:

| angle off the view axis | per 10px drag |
|---|---|
| 90° (side on) | 0.058 |
| 20° | 0.172 |
| 10° | 0.360 |
| 2° | **2.507** — past the whole ±1.5 clamp in one twitch |
| 0° | **null** — the press silently became an orbit |

And **looking head-on at the face you are about to extrude is the normal way
to work**, so that was the common case, not a corner one.

The shipped rule instead projects the pointer's travel onto the direction the
axis POINTS ON SCREEN (`axisScreenDir`, which the direct-drag axis picker
already used), with the 1/sin gain **capped at 2**. Measured on the same
cube, dragging 10px along that screen direction:

| angle | path | per 10px |
|---|---|---|
| 90° | projected, gain 1.00 | 0.101 |
| 45° | projected, gain 1.41 | 0.143 |
| 30° | projected, gain 2.00 | 0.202 |
| 20° / 10° / 7° | projected, gain 2.00 | 0.202 |
| 3° / 0° | up-the-screen | 0.101 |

From 30° out the geometry tracks your finger exactly; below that it merely
slows down. Under `EXTRUDE_MIN_SIN` (0.1, about 6°) the axis projects to
almost nothing and its screen direction is numerical noise, so the drag gives
up on it and reads plain up-the-screen. **Projecting also settles the sign
for free** — dragging the way the axis points grows the section whether the
face looks toward you or away, which a hardcoded "up = grow" got backwards
for every away-facing face.

### Rotate and Scale SETTLE the section (a2.32)

They act on real geometry, and the section being pulled is a preview that
`applyPendingOp` rebuilds from `op.state` on every tick — so a rotation
applied to it would vanish at the next re-run. `settleExtrudeSection` runs at
the top of `beginDirectDrag` and turns what has been pulled into mesh:
`op.state` and `op.baseState` both move up onto it, `op.settled` goes true,
and `applyPendingOp` then returns straight after its restore. A section that
was never pulled is dropped here rather than baked in, exactly as at Done.

Afterwards the mode is still open with nothing pending. A pull then opens a
NEW section (`openExtrudeSection`, which `stackExtrudeSection` also uses) —
the rotation cannot be un-applied by re-running the extrude, so continuing
the same section is not on offer and a new one is the honest answer. This is
the Blender loop: extrude, rotate, extrude, scale.

**A settle enters the history AS IT HAPPENS**, and that is not tidiness. It
runs at the START of a drag, while the push that would record it sits at the
END of `endDirectDrag` — and the pointerdown handler throws a drag away
without ever reaching that push when a second finger arrives, which is simply
how you orbit to check your work. Between those two the section was real
geometry in no history entry at all, `confirmPendingOp` closed the mode
without pushing because it assumed the transform had already pushed, and
`scheduleAutosave` rides on `pushHistory` — so a reload lost the work. The
settle now pushes its own step when it kept anything, and `op.inHistory`
records that everything so far is committed. `confirmPendingOp` pushes only
when that flag is false, or a tap-and-abandon after a settle adds a step that
changes nothing and an Undo press that appears dead.

The flag is cleared by `setPendingAmount` whenever the amount actually
changes — the same call that sets `op.pulled`.

Two consequences worth stating plainly, because both were bugs first:
`op.selectionBefore` is re-captured at the settle (the one from before the
mode opened names arbitrary EDGES after the renumbering), and a cancel on a
settled mode says **"Extrude finished"**, not "cancelled" — nothing is taken
back, because `baseState` has moved up onto real geometry. Undo inside a
settled mode closes it and then performs a real undo; inside an unsettled one
it takes back the preview and holds `historyIndex`.

**A tap only stacks under Move.** Under Rotate or Scale it says "Switch to
Move to add a section" — with the bar reading "Rotate", a tap that quietly
extruded 0.02 obeyed neither the label nor the eye.

### Two things that look like details and are not

- **`op.baseState`** is the mesh before the mode opened and never moves;
  `op.state` walks forward with each stacked section. Cancel and one Undo
  reach back past the whole stack. **Undo INSIDE the mode cancels the
  preview** and does not touch `historyIndex` — nothing has been pushed yet,
  so stepping the index back would have taken away the edit before it.
- **`op.pulled`** is set by `setPendingAmount` only when the value actually
  CHANGES. A section never pulled is dropped at commit rather than welding a
  zero-height wall in (`edLogical` welds positions rounded to 1e-4, so a
  zero-height section is not merely invisible — it is degenerate). The flag
  is needed because the mode opens at `EXTRUDE_COMMIT_NUB` 0.02, not at zero:
  a height test alone could not tell "opened and tapped away" from "pulled to
  0.02 on purpose", and an 8px touch wobble promotes to a drag that lands on
  the amount it started from.

### What the mode must never be left open across

Anything that empties `App.selectedElements` under it, because the mode is
aimed at that selection: `setMode` and the object-list chips both commit a
live op first. `extrudeSelection` also refuses to open over a knife or any
other pending op — it would overwrite that op's snapshot and leave its
geometry applied with no bar and nothing able to take it back. A double-tap
has no separate meaning inside the mode: both taps mean what one tap means,
or a quick second tap off the model would land on the cancel gesture and
throw the whole stack away.

## Symmetry-aware ops (v1.97, completed v1.98)

With symmetry on, every component op is mirrored. **How** depends on the op,
and the difference is not a detail.

| | ops | mechanism |
|---|---|---|
| **Union** | Extrude, Inset, Bevel, Split, Crease/Uncrease, Delete | `symExpand(obj)` adds the mirror to the selection |
| **Relational** | Weld, Connect, Bridge | `runMirrored(obj, fn)` runs the op once per side |
| **Live re-run** | Loop cut | both rings cut on every slider tick |

**Union ops act on each element independently**, so adding the mirror to the
selection is the whole job.

**Relational ops act on the selection AS A GROUP** — weld melts it into one
point, connect wires its members together, bridge joins one half to the
other. Handing those the union is wrong, not merely imprecise: welding
`{A,B}` together with `{A′,B′}` collapses all four onto the plane, and
bridge’s own "exactly 2" guard fails outright on four. `runMirrored` runs
the op on the selection, then again on the mirror.

- The second pass **cannot reuse element ids** — the first pass rebuilds the
  mesh and renumbers everything — so the mirrored side is remembered as
  POSITIONS and looked up again afterwards, the same trick bevel and loop cut
  already use for their own payloads.
- `symQuietHistory` suppresses the first pass’s `pushHistory`, so **one Undo
  takes back both sides**. One Undo leaving the model lopsided would be worse
  than either state.
- A selection that is **its own mirror** runs once, not twice.

Measured: Delete on one face of a cube with symmetry on leaves **4 faces, not
5**, in one undo step. Weld on two +X corners of a split cube goes **12 → 10**
vertices, still fully symmetric, in one undo step. The same weld with a
selection sitting on the plane runs once (10 → 9), and with symmetry off
touches one side only (9 → 8).

### The original design (Extrude, Inset, Bevel — v1.97)

`symExpand(obj)` adds the mirror elements to
`App.selectedElements` in place before the op starts, so the op itself needs
no symmetry code and you can see what it is about to touch. Extrude, Inset
and Bevel run over the selection **union its mirror**, once. `symExpand(obj)` adds the mirror elements to `App.selectedElements` in place
before the op starts, so the op itself needs no symmetry code and you can see
what it is about to touch.

**Topology wants the union.** A region's rim is built from edges appearing
exactly once, so a face and its mirror that MEET at the plane share that edge
— it appears twice, no wall is built there, and **the seam problem solves
itself.** No welding, no merge threshold. An element that is its own mirror
appears once; set semantics handle that for free.

**Direction wants per-side, and only Extrude needs it.** Inset works inside
each face's own plane and Bevel is derived from the geometry, so a mirrored
selection mirrors for free. `extrudeRegionOp` does not: it summed every face
normal for one shared direction, and a symmetric set cancels the axis
components **exactly** — for two opposite faces of a cube it returned `false`
and did nothing, silently. Now, given a plane:

- `avgDir` sums the **plus side only**; a face lying on the plane contributes
  with its axis component removed.
- Each vertex gets that direction with **its axis component negated on the
  mirrored side**, and **zeroed if it sits on the plane** — a vertex that is
  its own mirror has to agree with its own image, so it can only slide along.
- Own-normals mode was already symmetric (the mirrored vertex sums the
  mirrored faces); only the on-plane case needed forcing to zero.

**`extrudeRegionOp` now walks EVERY rim loop, not just the first.** A face
and its mirror are usually nowhere near each other, and the old single-loop
walk gave the second patch no side walls at all — a hole, not an extrusion.

**One face plus its mirror does not raise the grouping chooser.** The chooser
is about a choice the user made; `picked` counts the selection before
symmetry had its say.

Measured on a cube, plane X = 0, selecting the +X face:

| | before | after |
|---|---|---|
| `extrudeRegionOp` returns | `false` (silent) | `true` |
| faces / verts / edges | 6 / 8 / 12 | 14 / 16 / 28 |
| X extent | −0.5…0.5 | **−0.9…0.9** — both nubs grew outward |

And on a cube split by an edge loop on the plane, extruding a top face plus
its mirror across the seam: 16 faces, 18 verts, 32 edges, V−E+F = 2, boundary
0, winding clean, **6 walls not 8** — no membrane at the seam. All 18
vertices still pair (6 pairs, 6 self-mirrored) with the seam at exactly
x = 0: the op left the model symmetric, which is the invariant that matters.

### Loop cut (v1.99, direction fixed v1.99a)

Loop cut fits neither family: the union would hand it two edges when it only
reads the first, and a pass after OK would mean the preview lied. It gets its
own answer, which the op bar makes cheap — **`applyPendingOp` already rebuilds
the whole mesh from a snapshot on every slider tick**, so the mirrored ring is
cut in that same re-run. One op bar, one slider, both sides live, one Undo.

**How other tools handle this, since it shaped the design:** Blender's X
Mirror and Topology Mirror apply only to interactive transforms — Loop Cut is
not mirrored, and the official answer is the Mirror modifier. Maya's Insert
Edge Loop ignores symmetry outright; Multi-Cut inserts symmetric edges but
*refuses to start a cut on the symmetry edge*, a visible guard rather than a
silent skip. Modo mirrors component operations broadly and has an axis offset
like ours — but note its Loop Slice has its own mode called "Symmetry"
meaning something unrelated (mirror the slices about the ring's own 50%
mark), so **do not reuse that word in our op bar.**

**A ring that crosses the plane is detected without walking it.** If the first
cut CONSUMED the mirrored starting edge, the two rings were one ring — a loop
cut splits every edge of the ring it crosses, so the mirrored edge is simply
not there any more. Nothing is said about it: nothing went wrong, and the
geometry is what was asked for. (A ring that cannot be FOUND is a different
matter, and `edgeLoopSelection` says so.)

**Which way the mirrored ring slides is decided PER RING, by trial.** This
was got wrong twice before it was measured properly, and both wrong answers
looked reasonable:

1. v1.99 used a global constant, `LOOPCUT_MIRROR_FLIPS`, "measured" on a
   single ring. It was right for that ring and wrong for others.
2. The obvious repair — pass the mirrored endpoints in the mirrored order —
   does nothing. `edgeLoopOp` keys its start edge with `edgeKey`, which is
   **order-independent**, and measures `t` from `a0 = lp[entry]`: the winding
   of whichever adjacent face happens to be `startGroups[0]`. Arbitrary per
   ring.

So `decideLoopCutFlip` asks the mesh instead. Cut the real ring at an
off-centre `t`, note where the loop landed, mirror that point, then cut the
mirrored ring at `t` and at `1−t` and keep whichever lands nearer. Three
trial cuts and four restores, **once when the op starts** — not per slider
tick — and the answer rides in the payload as `mflip`.

The measurement that settles it: four X-running rings on the same two-nub
cube, slider at 0.25.

| ring | flip | result |
|---|---|---|
| 20 | false | symmetric, ±0.6 |
| 21 | **true** | symmetric, ±0.8 |
| 22 | false | symmetric, ±0.6 |
| 23 | **true** | symmetric, ±0.6 |

**Two of four rings need the flip, on one model.** No constant could have
been right. (21 landing at ±0.8 rather than ±0.6 is only which end of that
ring `t` measures from — still symmetric, which is the thing that matters.)

Measured, two nubs on a cube (rings that do not cross the plane): 14 → 22
faces, 16 → 24 vertices, symmetric, winding clean, loops at **±0.6** with the
slider at 0.25. And a vertical edge on a plain cube, whose mirror is a
different edge on the SAME ring: 6 → 10 faces, 8 → 12 vertices — **one loop,
not two.**

## The symmetry plane (v1.95)

Symmetry no longer reflects about local zero. Each object carries
`mesh.userData.symPlane = {axis, offset}`, where **offset is the geometry's
bounding-box centre on that axis, in the object's local space**.

- **Bbox centre, NOT centre of mass.** A vertex centroid moves when you
  subdivide one half, so the plane would drift because you added edge loops.
- **Captured once**, at two moments only: switching Symmetry **on**, and
  changing the **axis**. Never recomputed live — the bbox centre is set by
  the extremes, so dragging a vertex outward would shift the plane mid-drag.
  With symmetry on every edit is mirrored, so the centre cannot move anyway.
  `symmetryPlane(obj, axis)` captures lazily for objects that never had one
  (loaded from a save, made later). Re-tapping Symmetry on is the escape
  hatch.
- `buildSymmetryMap` reflects `x' = 2·offset − x`; a vertex that is its own
  mirror is clamped to `offset`, not to 0.
- Both toasts name the plane when it isn't at zero, so a wrong plane is
  visible rather than silent.

Measured on a cube whose geometry was drifted +0.7 off its local origin:
**0 vertices paired before, 8 after**, plane captured at 0.7. A centred
object gets `offset = 0` and behaves exactly as it did.

## Mirror (v1.96)

**Mirror uses whichever plane symmetry is describing.** Off → the world axis
plane. On → the object's captured plane. Both arrive as one world
`THREE.Plane`, so the two stop disagreeing the way they used to (world zero
against local zero). `mirrorObject(obj, plane)` reflects with
`I − 2nnᵀ` plus `−2dn`; the axis-aligned cases fall out of it unchanged.

**If the plane CUTS the object, Mirror bisects first.** Mirroring a whole
object about a plane through its middle just lays a second copy over the
first — which is what v1.95 did, and it read as "two cubes inside each
other". Now the object is cut at the plane, the half you are **looking at**
is kept, the other is thrown away, and the mirror rebuilds it. The rim of the
cut becomes an edge loop lying exactly on the plane.

- **Camera-side, deliberately.** A destructive op needs the user to choose,
  and orbiting to the side you want costs no UI at all. The toast says it
  kept the half facing you.
- The cut face is left **OPEN**. A cap would be a wall trapped inside the
  join; the two rims weld into a closed surface instead.
- Sutherland-Hodgman on each face's boundary loop. Clipping a convex polygon
  by a half-space stays convex, so the re-fan is safe.
- Vertices the discarded half owned are **compacted away**, or they hang
  around as orphan dots in Vertex mode.
- **A plane that misses the object still mirrors the whole thing** — that is
  the mirror-an-arm-across-the-body case and it was never broken.

`combineObjectsInto`'s `dropOnPlane` takes an axis letter OR a world
`THREE.Plane`, and **clips near-plane vertices onto the plane** (same 1e-3
relative tolerance as `buildSymmetryMap`) before merging. That is what makes
the seam weld and the coplanar-face drop actually fire — it only ever deleted
faces already within 1e-4 of the plane, and nothing had put them there.

Measured, cutting the default cube through its centre: 6 faces → a 5-face
open half → **10 faces, 12 vertices, 20 edges** merged. V−E+F = 2, boundary
0, winding clean — a closed cube with an edge loop on the plane. The kept
half sits on the camera's side of the plane (+0.25 against −0.25). An object
the plane misses still yields the old two-shell mirror, 12 faces, 16
vertices.

## Winding audit (v1.94)

`auditWinding(obj)` walks every face, takes its boundary loop as the polygon
in winding order (which skips the fan diagonals a raw triangle walk trips
on) and compares each shared edge against its neighbour. **Two faces sharing
an edge agree when they traverse it in OPPOSITE directions.** It then floods
each connected shell, flipping the expected orientation across a conflicting
edge, and counts the SMALLER side of the split — "every face reversed" is
the same mesh seen inside out, not a bug.

Returns `{object, faces, edges, shells, boundary, nonManifold,
conflictEdges, reversed, ok}`.

- **`__kubik.windingAudit()`** audits every object, `(id)` one.
- Every `finishMeshEdit` runs it under `?debug=1`, logs `[winding] {...}` and
  **appends the failure to the op's own toast** rather than staying silent.
- Measured on a clean cube: 6 faces, 12 edges, all zeros. With one face's
  triangles deliberately reversed: `conflictEdges 4, reversed 1, ok false`.
  Verified against a broken mesh, not just a good one.

## Testing loop

Node is installed (portable, no installer) at
`%USERPROFILE%\Tools\node-v24.19.0-win-x64`. `_verify.py` uses it.

**Before every ship:** `python _verify.py index.html` → runs `node --check`
on the extracted script AND scans for duplicate top-level declarations.
Prints `PASS` or `DO NOT SHIP`. Verified against a deliberately broken copy,
not just a good one.

**Driving the app end to end:** `python -m http.server 8765` in the repo,
then Chrome loads `http://localhost:8765/_test.html?debug=1` (`_test.html`
is a gitignored scratch copy, so testing never disturbs `index.html`).
Synthetic PointerEvents dispatched into the canvas exercise taps, holds and
drags; `window.__kubik` exposes `App`, `camera`, `orbit`, `camAnim`,
`vertexSpacing()` and helpers. This has caught several real bugs before they
were pushed and produced the vertex spacing table above.

**Three harnesses now, all untracked, all the same shape** - append a plain
`<script>` to a COPY of index.html, serve the folder on 127.0.0.1, run
headless Chrome from a PYTHON subprocess with a fresh `--user-data-dir`:

- `_probe.py` + `_probe_js.js` - the shape-mask suite. `--dump-dom` for
  numbers, `canvas.toDataURL()` into the DOM for pictures. It builds the
  shapes whose answers are known in advance: a fold, an L-shape, 8- and
  12-sided tubes, and the **pan** - a plate with a shallow square recess,
  which is the shape every cavity bug has needed.
- `_helpshot.py` - UI work. Opens the help card, optionally clicks one
  section open, and takes a real `--screenshot` at
  `--force-device-scale-factor=2` in a 430x860 window.
- `_chk.py` - the one-off. A dozen lines that assert a handful of facts and
  dump them. Use it after a REMOVAL: it is what proved a vertex pick leaves
  the camera at 0.0000 once Aim assist was gone.

**And when a bug is on the USER'S model, ask for the file.** a2.29e was
found by reimplementing `applyShading`'s wear-edge pass in Python and
running it over `kubikTank.json` - no browser, no transfer to the PC. That
killed the winding hypothesis in one run (zero reversed triangles in all
nine objects) and located the real cause. The threshold that fixed it was
then chosen by ray-tracing real ambient occlusion at every painted pixel.
**One round trip for a file buys certainty that hours of synthetic shapes
will not.**

**Verify generated assets end to end.** The help card's QR is checked twice:
its matrix against segno's own, and OpenCV decoding the URL back out of the
rendered screenshot. A QR that does not scan is worse than no QR.

Three traps, all of which cost real time:

- **A backgrounded tab freezes CSS transitions and clamps `setTimeout` to
  ~1s.** A transitioned property reads its START value forever, so
  `getComputedStyle` lied about a slider knob for several rounds, and
  hold-vs-tap timing cannot be told apart. **Check `document.hidden` FIRST.**
- **A desktop check CANNOT see a safe-area bug.** `env(safe-area-inset-*)`
  is 0 in a desktop browser, so anything that mishandles it measures as
  perfect. The hub button's double inset shipped twice this way, and both
  times the numbers said the row was aligned. To test it, override the
  `--edge-*` custom properties with a simulated inset (34px is about an
  iPhone home indicator) and re-measure. That reproduced a -34px centre gap
  in one call, after two rounds of failing to find it by looking.
- **A cached `_test.html` will happily answer questions about the PREVIOUS
  build.** Add a changing query string. One measurement run here was scored
  against the old file before that was spotted.
- **Anything that scrolls must be named in the `touchmove` allow-list.**
  That handler cancels touchmove everywhere else to stop the page moving
  under the app, so an unlisted scrollable is unreachable by finger while
  working perfectly with a mouse wheel. The Help card shipped this way.
- **The ring's hold timer runs off the rAF loop, which a hidden tab stops
  DEAD** - not clamped, stopped. Pressing and waiting longer does not help;
  the ring never blooms at all. `__kubik` exposes `bloomToolRing`,
  `updateToolRingHover`, `closeToolRing` and `HUB_TOOLS_WORLD` so a harness
  can drive the ring directly and skip the question.
- **Synthetic pointer events make OrbitControls throw** `setPointerCapture:
  No active pointer`. Harmless and unreachable with a real finger — filter
  the console by stack, not by count.
- **Dispatching straight onto the canvas bypasses hit-testing**, so it
  cannot reproduce a bug where another element steals the event. Use
  `document.elementFromPoint` to check what is really on top.

## What to build next

**The whole of the previous list has shipped**, v1.94 through v1.97: the
extrude grouping default, the winding audit, the symmetry plane, Mirror, and
symmetry-aware ops. Each has its own section above; nothing here is pending.

**2.0 is being held back deliberately.** Zeghreit is saving the number for a
release that is "alive and flawless" — everything already present working
smoothly, nothing sticking, nothing silently failing. That is why v1.99 has
run to eleven letters rather than becoming 2.0. Do not bump the major
version without being asked.

### The pre-2.0 list, as agreed with Zeghreit

Gathered over several sessions and written down because it is more than
anyone can hold in their head. Roughly in the order it was decided, NOT in
priority order — ask before assuming which comes first.

**1. Two missing ops, both called essential.**

- ~~**Cap / fill hole.**~~ **SHIPPED at a2.0** — see "Cap holes" above,
  including the two ways it was wrong first.
- **Hand cut (knife).** Tap-drag along an edge to drop a start point, then
  the next, and so on; OK applies the cut. **This is the largest single item
  on the list and it introduces a new INTERACTION CLASS** — every op today
  is select-then-run or select-then-slider, and nothing builds a multi-tap
  path with its own pending state. The geometry is less frightening than the
  interaction: it decomposes into "split an edge at an arbitrary t" (today
  `splitEdgeAt` only splits at the midpoint) plus `connectVerticesOp`, which
  already joins two vertices sharing a face by splitting that face. Design
  this before building it.

**2. Reachability — working code with no way in on a phone.**

- `clearAllCreases`: zero callers anywhere.
- `growSelection` / `shrinkSelection`: keyboard `]` and `[` ONLY, and a
  phone has no keyboard. They belong in the component rings; the vertex
  ring has three items and room to spare. STILL OPEN after a2.1 — the
  drawer was the wrong home for them, so they were left alone.
- ~~`subdivideSelection('keep')`~~ and ~~Grow/Shrink~~ **SHIPPED at a2.2** —
  see "Subdivide, and reachability" above. `clearAllCreases` shipped at a2.1
  in the drawer. All three reachability gaps are closed.

**3. ~~The drawer, rearranged.~~ SHIPPED at a2.1** — see "The drawer"
above. What it fixed, for the record:

- Two notes LIE. "Grid, Aim assist and Snap moved under the axis cube" —
  they are in the world ring. "Turn symmetry on with the button under the
  axis cube" — that pill moved to the TOP-LEFT at v1.99d.
- **"Gizmo speed"** names a gizmo that was removed at v1.57 and sits in the
  do-not-rebuild list. It is the drag-speed multiplier (`App.sensitivity`).
- **Two buttons both say "Save"** — Models→Save writes to browser storage,
  File→Save downloads a `.json`. Rename the second to Download.
- Colour is filed under "Precision", where it has no business being.
- "View" is a section header wrapping a single Theme button.

New settings to add, all of which are hard-coded constants today:

- **Snap step.** `SNAP_MOVE` 0.25, `SNAP_ROTATE` 15°, `SNAP_SCALE` 0.1 —
  the toggle is in the world ring but the amounts cannot be changed.
- **Fillet settings, matching Bevel's.** Bevel already offers Flat / Round,
  a width slider and segments. Fillet has `App.filletRadius = 0.04` and
  `FILLET_ANGLE` with NO UI at all — it is on or off. Give it the same
  profile and width controls so the two read as the same idea.
- **Clear creases**, which is rare cleanup and belongs here rather than in
  a ring.
- **Start over** — NOT built. There is still no way to clear the scene short
  of deleting objects one at a time. Flagged as Zeghreit's call because it is
  destructive, and he has not said either way. Ask before adding it.

Proposed sections: **Model** (object list, Start over) · **Appearance**
(Theme, Colour) · **Editing** (Values, Drag speed, Symmetry axis, Snap step,
Fillet, Clear creases) · **Models** (unchanged) · **Files** (Download/Open
plus the three exports).

Open question: Symmetry AXIS lives in the drawer while the Symmetry SWITCH
is now top-left. Two halves of one control in opposite corners.

**3b. After the drawer, but before icons — materials.** Zeghreit wants the
material settings reworked and moved into **their own drawer on the RIGHT
side**, mirroring the tools drawer on the left. Explicitly scheduled after
everything else already planned, so do not start it early. Note today's
material controls are split across three places: the Colour picker in the
drawer, the Material tool in the object ring (which cycles finish), and
Shade in three separate rings.

**4. Icons and design polish.** Zeghreit has feedback that the icons are
confusing and wants every icon to reflect its function. A brainstorm and
some research were agreed for this, deliberately AFTER the tool set stops
moving — no point drawing icons for a ring that is still changing.

**5. Still open from before, not yet scheduled:**

- ~~**Acknowledging the moment an op lands.**~~ **HALF DONE at a2.31** —
  Extrude now opens a mode you are visibly inside of, and the height is a
  drag rather than a thing that already happened. See "Extrude is a MODE"
  above. Every OTHER immediate op — weld, merge, cap, flip, crease, dissolve
  — still just happens with a toast, so the gap is narrower, not closed.
- **More primitives** — cylinder, sphere, plane, from the original v1 spec.
  A DESIGN question, not three constructor calls: Add Cube owns a pole of
  the world ring alone as the one item that makes rather than toggles, and
  four add-items would wreck that. Probably a hold on Add to pick a shape.
- **The `|| mirrored` DoubleSide clause.** Now that Flip and Mirror-Apart
  bake instead of scaling, find out whether anything still needs it. If not,
  picking and rendering agree everywhere with no special case left.
- **The object ring is getting full** — ten items plus Join, and it has not
  been judged by thumb since Flip and Separate joined it.


## Help (v1.99b, folded at a2.30)

Twelve sections, built from `HELP_QUICKSTART` and `HELP_SECTIONS` and
rendered with the same `icon()` calls the real buttons use, so the glyphs
cannot drift from the app: Quick start, Getting around, Selecting, Move /
rotate / scale, The two rings, Shaping, Whole objects, Surface, Symmetry and
Mirror, The drawer, Keeping your work, Open on your phone.

**Every section is a `<details>`, and the closed state IS the table of
contents.** Before a2.30 it was one 60-row scroll - correct, and unusable on
a phone: finding "what does Bridge do" meant a thumb hunt past everything
else. Only one section opens at a time and the one you open is scrolled to
the top, under a title bar that is now `position: sticky` so the close
button never leaves the screen.

Three things that had to be got right and are easy to get wrong again:

- **The exclusive-open handler hangs off the SUMMARY's click, not off
  `toggle`.** Chrome fires `toggle` for a `<details open>` that arrives with
  `innerHTML` too, and that phantom event scrolled the card by exactly the
  height of its own title bar - so Help opened with its heading and close
  button already gone off the top. A click is a tap and nothing else. The
  open flag flips after the handler returns, hence the `setTimeout(0)`.
- **The scroll subtracts the sticky bar's height**, or the section you tapped
  lands underneath it.
- **The name is the first words of its own line**, not a column. A 96px term
  column on a 360px card left about 28 characters for the description, so
  nearly every row wrapped to three lines.

**Rows say what the thing DOES, in one line.** Anything that needed a
paragraph was saying too much for a reference card. The card this replaced
had gone stale besides, still offering "Smart camera framing" for an icon
that has meant Aim assist since v1.87 - and it drew a blank gutter for
Shade, whose ring icon is a FUNCTION (`flat` or `smooth`, whichever it will
switch you to) so the key `shade` has never existed in the icon table.

**Open on your phone** is last, and closes with a QR code for the live URL.
It is a `<path>` of module runs generated from segno at patch time and
pasted in - no library, no network, and it works from a `file://` URL like
everything else here. Verified end to end: the matrix is compared against
segno's own, and OpenCV decodes the string back out of the rendered
screenshot.

## The drawer (a2.1)

Seven sections: **Scene** (object list) · **Appearance** (Theme, Colour) ·
**Editing** (Values, Clear creases, Drag speed, Symmetry axis) · **Snap
step** · **Fillet** · **Models** · **Files**.

Its job is unchanged: things set once or used rarely, reachable with the
other hand without crowding the viewport. Tools stay in the rings.

What the rearrangement fixed, three of which were plain errors rather than
taste:

- **Two notes sent you to the wrong corner.** One said Grid, Aim assist and
  Snap were "under the axis cube" — they are in the world ring. The other
  said to switch symmetry on there too; that pill moved to the top-left at
  v1.99d.
- **"Gizmo speed" named a gizmo that was removed at v1.57** and sits in the
  do-not-rebuild list. It is the drag-speed multiplier, and says so now.
- **Two buttons both said "Save"** — one writing to browser storage, one
  downloading a file. Files now says **Download .json** and **Open .json**,
  so exactly one control in the drawer is called Save.
- Colour moved out of "Precision", which is now Editing.

**Snap amounts and fillet shape stopped being constants.** Both were fixed
values with a toggle and no way to change them. `App.snapMove`,
`App.snapRotate` (held in DEGREES, converted where used) and `App.snapScale`
replace the old module constants; `App.filletProfile` and
`App.filletSegments` join `filletRadius`.

Fillet was nearly free: `bevelEdgesOp` already took `segments` and `profile`
with defaults, and `buildFilletedMesh` simply never passed them. Fillet and
Bevel are the same idea applied two ways and now take the same settings.
Measured: flat/1 segment 44 triangles, round/2 92, round/4 188.

**The drawer is now tall enough to need scrolling on a phone.** It works
because `.drawer-body` is `overflow-y: auto` AND `#drawer` is named in the
touchmove allow-list. Anything added here must keep both true — an unlisted
scrollable works with a mouse wheel and is dead to a finger.

## Subdivide, and reachability (a2.2)

**Subdivide is a live op now**, not an immediate commit. It opens the op bar
with a **Smooth / Keep shape** chooser and a **count**, and re-runs from the
snapshot on every change — so the stepper is a PREVIEW of the finished
result rather than a number you apply blind.

- `noAmount` on the spec hides the slider outright, the way loop cut hides
  it in Even mode. There is no amount here; the stepper counts LEVELS.
- **Capped at 4** via `maxSegments`. Each level multiplies faces by four, so
  a cube runs 6 → 24 → 96 → 384, and the shared default of 10 would be
  unusable on a phone.
- Pending ops were built around ONE object. Object-mode ops act on the whole
  selection, so a spec marked `multi` also snapshots every selected object
  into `op.multi`, and both apply and cancel walk that list. Component ops
  keep the single `state` and never look at it.

Both modes were always implemented; `keep` simply had nothing calling it.
Measured on a cube — they are genuinely different, which was worth checking
rather than assuming: `keep` holds the silhouette at exactly 1.0 at every
level, `smooth` rounds it to 0.8785 by level 2, and the summed positions
differ from level 1 (68 against 96).

**Grow and Shrink are in all three component rings.** They existed and
worked, reachable only from the keyboard keys `]` and `[` — which is to say
not at all on the phone this app is built for.

**Still wanted, not built:** a non-destructive *smooth preview*, the way
Fillet previews rounded edges without changing the mesh. The op-bar preview
above is a preview of the real result; this would be a display-only smooth
you can leave switched on while modelling.

## Delete, and what dissolve means (a2.5)

**Face delete cuts. Vertex and edge delete DISSOLVE.** Deleting an edge used
to delete both faces touching it, and deleting a vertex deleted the whole fan
around it — a hole where the user asked for one fewer edge. Now the faces
close over what was removed. Face delete is unchanged, because that is the
tool for making a hole.

**The trick is that a face is a GROUP of triangles.** `computeTopology` only
exposes an edge when some face uses it exactly once, so dissolving an edge is
not a geometric operation at all: concatenate the two groups' triangles into
one group and the edge stops being on any outline, which is to say it stops
existing. No retriangulation, no new vertices, not one position touched. A
vertex needs one more step, because merging its fan leaves it sitting INSIDE
the merged face, still drawn and still selectable — so that face is rebuilt
from its own outline, which no longer mentions the corner.

**Merged corners must be welded first.** `separateGroupVertices` gives every
face private copies of its corners, so two faces meeting along an edge hold
four different attribute indices for its two ends. Concatenate without
welding and the shared edge never cancels: the outline comes back a figure of
eight and the winding audit reports two new open edges. Measured on the first
run — dissolve one edge of a cube, boundary 0 → 2, and the safety check
correctly threw the whole edit away.

**The edge-exposure rule was wrong and dissolve found it.** It used to read
"internal iff exactly two occurrences in exactly one group". That misses a
line that is an internal diagonal of TWO neighbouring faces at once — four
occurrences, no face using it singly — which is routine as soon as an n-gon
is retriangulated. Four of a cube's eight corners came back with phantom
edges and Euler 0 or 1. The rule is now "exposed iff some group uses it
exactly once", which also makes `topo.edges` agree with `groupsByEdge`.

**Three guards, all of which have fired:** a merge that would leave a face
with no outline at all is refused before anything is rebuilt (dissolve all 12
edges of a cube → 1 face, 0 edges, and no way back but Undo); a face whose
outline is not one closed loop aborts the whole vertex op rather than
committing half of it; and the open-edge count is compared before and after,
restoring a snapshot if it grew. The second one matters because merging faces
does not change the open-edge count, so the audit cannot see a half-edit.

**A free tap chooses its type by DISTANCE, not by rank (a2.6a).** Vertex
used to be tried first at the full 28px, so any vertex within 28px beat an
edge the finger was sitting exactly on — and on a mesh with real detail there
is always one. A vertex still wins ties and near-ties (`VERT_TIE_PX`), because
a vertex sits ON its edges: aim at a corner and both distances are ~0, so the
more specific thing should win; aim at the middle of an edge and the nearest
vertex is half the spacing away while the edge is at zero.

Measured on a 386-vertex cube, tapping dead centre of a visible edge in Edge
mode, before → after:

| median vertex spacing | before | after |
|---|---|---|
| 8.9 px | 0 / 388 | 164 / 388 |
| 17.9 px | 99 / 356 | 309 / 356 |
| 30.2 px | 209 / 316 | 301 / 316 |
| 50.7 px | 224 / 254 | 241 / 254 |

Every earlier miss came back as a vertex. Vertices did not regress (98–100%
at every zoom), a plain cube is 27/27 edges and 7/7 vertices from either
mode, and with ±8px of thumb jitter edges run 59% / 88% / 94% at those three
spacings. Below ~20px spacing the targets are genuinely smaller than a thumb;
that is what pinch-zoom is for.

**The edge catch zone IS aligned with the drawn edge** — this was checked
directly, not assumed: on a sparse mesh, taps placed exactly on the line hit
that edge 45/45 at every point along it. The old failure was never
misalignment, it was the type order.

**Dissolving edges takes the run's INTERIOR vertices with it (a2.5a).**
Leaving them behind is only half the job — they sit on the merged face doing
nothing, still drawn and still selectable, and a dissolved edge loop leaves a
whole ring of them. Interior means "used by two or more of the dissolved
edges". The two ENDS of a partial run are used by one and they stay: they are
still junctions of edges that survive. A closed loop has no ends, so all of it
goes. Measured: loop-cut a cube (12v/20e/10f), dissolve the whole ring of 4 →
back to a clean 8/12/6 with every mid vertex gone; dissolve 3 of the 4 →
10v/15e/7f with exactly the two ends left; dissolve one edge → both ends stay.

**Only what was actually dissolved is filtered out.** Vertices reported as
skipped must not be dropped from the outlines of the faces being rebuilt —
select an interior vertex and a lone corner together and the corner was being
removed while the toast said "skipped 1".

Verified on a cube: any one of 12 edges → 8v/11e/5f, any one of 8 vertices →
7v/9e/4f, every one identical, Euler 2 and closed throughout.

## The knife (a2.6)

**Hand-cut geometry.** Pick Knife from the Edge or Face ring, press-slide-lift
to place each point, OK to cut. A point snaps to a VERTEX within 16px, else
slides along an EDGE, else sits anywhere on a FACE. Green dots are the points,
the yellow line is the cut. Back pops the last point, Cancel drops the lot.

**Nothing touches geometry until OK**, which is why the knife is NOT a
pendingOp: there is nothing to re-run from a snapshot. Points are stored as
LOCAL POSITIONS, not indices, so they survive anything that renumbers.

**A cut is an outline split.** A face is a patch with an outline and an edge
only exists where a face uses it once, so cutting a face means splitting its
outline in two where the cut enters and leaves, and giving each half its own
face. Points inside the face join both halves, which is how they end up ON
the new edge instead of floating.

**Which is why a cut cannot END inside a face.** A slit that does not reach
the far side would need an edge with the same face on both sides, and this
mesh cannot express that. Such a run is skipped and said so. ONE CUT PER FACE
per operation, for the same don't-guess reason: a chain re-entering a face
would need aiming at whichever half it landed in.

**Splitting a RIM edge legitimately adds one open edge**, and the
before/after open-edge guard has to know that or it reverts every honest cut
on a face touching a hole - which made the knife useless on any open sheet.
`applyKnifeOp` counts those splits from the outlines BEFORE the splice and
returns `rimSplits`; the guard allows exactly that many.

**The knife owns one pointer.** It takes orbit on every press and hands it
back in `cancelKnife` and `applyKnife` rather than in the pointer handlers -
a press that ends off-canvas never sees a pointerup, and that left the camera
dead for the rest of the session. Lifting the first of two fingers does NOT
place a point: orbiting mid-cut is the normal thing to do, and the old code
committed a point aimed where that finger first landed.

**`pushHistory` and `restoreDoc` abandon a cut in progress.** Both move the
ground the points were aimed at, and the bar is DOM, so Undo is reachable the
whole time a cut is being placed.

Verified on a cube: edge to edge across one face 8/12/6 → 10/15/7; edge to
face-interior to edge → 11/16/7 with the interior point a real vertex on the
cut; a chain across two faces → 11/17/8, "Cut 2 faces"; corner to edge →
9/14/7. Euler 2 and closed throughout, Undo restores.

## Bridge in sections (a2.7)

**Bridge is a live op now**, with a section stepper and a Straight/Curved
choice, and every change re-runs it from the snapshot. One section is the old
single band of quads; more sections insert that many rings in between.
STRAIGHT interpolates each pair of matching corners along a line. CURVED
leaves each end the way that end was already going and eases into the other —
a Hermite whose tangents are the ends' own outward directions. Two faces
pointing AT each other come out straight either way, because their tangents
already run along the join; the curve only shows when the ends disagree,
which is when you asked for it. `minSegments: 2` on the Curved option keeps
it off the bar until there is something between the ends to bend, and
`stepSegments` falls the mode back when it goes away.

For an edge-run bridge the "outward direction" is NOT the surface normal —
that points off the sheet, and a bridge leaving an open rim straight upward
continues nothing. It is the direction that lies IN the neighbouring face and
points away from it, so the normal component is projected back out.

**The pairing and the wall winding are ONE decision (a2.7a).** There are
exactly two consistent ways to wall a tube, and choosing one fixes the other:

    FORM 1  walls [a0, a1, b1, b0], A forwards, B BACKWARDS
    FORM 2  walls [a0, b0, b1, a1], A BACKWARDS, B forwards

A wall stands in for a face being deleted, so it must traverse that face's
outline the way the face did, or it disagrees with the side faces still using
those edges. Form 1 is right when the faces LOOK AT each other, form 2 when
they point the SAME way. a2.7 got half of it — it chose the pairing from the
normals and left the walls in form 1, so same-facing bridges came out with 5
reversed faces and 4 conflicting edges. That was the "bridge flips normals"
report. There is also no per-quad "point it away from the tube axis" test any
more: it guessed outwardness from a made-up axis, said nothing at all when
the band was flat, and was free to flip single quads out of agreement with
their neighbours.

**An EDGE-run bridge takes its winding from the rim too (a2.7c).** Two faces
sharing an edge traverse it in opposite directions - that is what makes them
agree - so a strip laid along a rim has to run against the face on the other
side of it. `bridgeEdgesOp` had no such rule at all: it wound every quad the
same way regardless, so whether a bridge came out facing the right way
depended on which end of the chain the walk started from. The bug report is
the proof, and it is a good one: two mirrored cubes, the same two-edge
bridge, correct on one side and inside out on the other - the mirror runs its
rim the other way round, so one fixed winding opposed one face and agreed
with the other.

TWO knobs, and both are needed. Flipping the quad fixes the A end but flips
the B end with it; reversing B's chain then fixes B without disturbing A.
Measured with only the first: two of four mirrored edge pairs still came back
with 5 reversed faces. With both: all four clean.

**An order-reversing pairing is forced, so the connectors look crossed, and
that is fine** — a tube is allowed to be an arch. What is NOT fine is the
rotation where two connectors run head-on and share a midpoint, because a
ring landing exactly there welds two corners and goes non-manifold.
`chooseRingOffset` refuses such a rotation; when every rotation does it (two
coplanar tops), `bridgeRings` nudges that one ring a thousandth off the
meeting point instead. Measured: with neither guard, every EVEN section count
on two box tops came back non-manifold.

**Bridging two faces that point the same way can still fold through itself**
at some section counts — the geometry has no better answer, so the op bar
says `Bridge · folds over` while it does, live, with the count under your
thumb. Faces that look at each other, the ordinary case, are clean at every
count in both modes.

**Ring pairing direction comes from the two faces' NORMALS, not from
distance.** Each face is wound about its own outward normal, so two faces
looking at each other wind oppositely in space and B must be reversed; two
faces pointing the same way must not be. The old code reversed
unconditionally, which on the same-way case paired every corner with the one
diagonally opposite: the walls crossed and every ring in between collapsed
onto the twist. Measured — two box tops bridged in two sections gave 2 new
vertices where there should have been 4, and the winding audit was perfectly
happy, because a twisted tube is still closed. One band hid it; sections made
it plain. Bearing around the joining axis cannot decide it either: for two
coplanar tops the axis lies IN both faces and all four corners collapse onto
two bearings. Distance is still fine for the ROTATION, which is a choice
among same-handed pairings and has a clear minimum.

**Symmetry no longer goes through `runMirrored`.** The mirrored elements are
captured with `markElements` when the op begins and re-found with
`resolveElements` inside every re-run, after the primary pass has renumbered
the mesh — so the bar previews both sides while you change the count, and
`confirmPendingOp` pushes ONE undo entry covering both (which is what
`symQuietHistory` used to fake). Both the "no pairs here" and the "could not
find the mirrored side" answers still have to be said out loud; a silent
half-symmetric result is indistinguishable from symmetry being off.

Verified: sections 1–12 on faces and edges, both modes, watertight and Euler
2 every time; the curve lifts the middle rings to 1.1 and 1.3 above two box
tops at 0.5 while Straight keeps them flat; symmetry bridges both pairs in
one re-run (4 cubes, Euler 8 → 4).

## Open threads

- **Moving the pivot / re-origining an object.** Deferred. Capturing the
  symmetry plane from geometry buys most of what it would have.
- New cubes should spawn at world centre even if they overlap. Currently
  they offset in a grid pattern.
- Gesture-driven modelling tools (extrude on two-finger tap, etc.).
- `_verify.py` is gitignored, matching the `_`-prefix convention, so it
  lives on one machine only. Consider committing it. Note it CANNOT catch an
  undefined reference — a name that does not exist passes `node --check` and
  throws at runtime. Grep for any identifier you introduce.
- The op sweep and the picking harness that produced the numbers above live
  only in a browser console. Turning them into a committed self-test is the
  obvious way to make "flawless" checkable rather than hoped for.
- **Masks added to a PRESET material do not survive a project file.**
  `restoreDoc` adopts a definition only when its id is absent, and Solid /
  Plastic / Metal are always seeded by `loadMaterialLibrary` - so a mask put
  on one of those three is written into the JSON and silently dropped on
  open. Custom materials travel fine. Pre-existing, found by review at a2.24,
  and the fix is a POLICY choice nobody has made yet: file wins, local wins,
  or import under a new id.
- **Normals from the masks** is the agreed next feature - a cloth mask is a
  greyscale field and a normal is its slope, so every noise type already
  built becomes a bump for free, as a third checkbox beside Colour and
  Roughness. Triplanar, so the no-UV policy survives.
- **`material.envMapIntensity` has been inert** since `scene.environment` was
  set - three overwrites it with `scene.environmentIntensity`. Drop the field
  or make it multiply.
- Unmeasured on a phone: the environment's full-float DataTexture
  (`OES_texture_float_linear` is missing on many mobile GPUs), the atlas's
  two-tap slice interpolation, and the four extra field fetches a2.29c and
  a2.29e added per pixel.
