# a2.70 (OBJ) and a2.71 (STL) — reviewed, fixed, SHIPPED

Live at https://zeghreit.github.io/kubik/ — a2.70 `266e34f`, a2.71 `c71adb0`.

Two fresh opus reviewers, one per increment, each given the patch scripts and
the code they touch. **Between them they found eleven real defects**, three of
which would have shipped as visible breakage. All fixed and covered by probe
sections before either release went out.

The import pipeline is now complete for the three formats that were on the
list: **.glb / .gltf, .obj (+ .mtl), .stl**.

---

## The shape it settled into

Every reader ends at **`landImport(built, label, skipped, rewound)`**, which
owns both budgets, the non-finite sweep, the recentring, the material
mapping, the selection, the history step and the toast. A reader's whole job
is to produce `[{ name, ed }]` where `ed` is the `{ positions, groups,
triCount }` the app's own ops already speak. **A fourth format is a parser and
nothing else, and cannot forget a refusal.**

| | faces come from | materials |
|---|---|---|
| glTF | coplanar merge (inferred) | PBR → library entries |
| OBJ | the file says so (`f`) | `usemtl` + `.mtl` |
| STL | coplanar merge (inferred) | none — all Solid |

---

## a2.70 — the three that mattered

### Every object after the first was displaced

`editableFromObjText` handed every object the same `verts` array, and
`landImport` recentres by subtracting the bbox centre **in place**. Object A
subtracted the whole file's centre and was placed back at it — correct by
luck. Object B then measured an already-shifted array, got an offset of
exactly zero, and went to the origin.

**A file centred on 0,0,0 — a Blender default cube — hides this completely**,
which is why it survived the first probe pass. Fixed by compacting each
object's positions, which also finally delivers what the recentring comment
always claimed: each object's origin is its own centre, so it pivots inside
itself.

### `g` split one mesh into one object per material group

Blender writes `o Name` per object. Maya, 3ds Max, SketchUp and most CAD
exporters write `g Name` per object and no `o`. And plenty of files write
`o Solid` once and a `g` per material *inside* it — splitting those severed
the connectivity, so no op could cross the seam.

**The file says which:** if it uses `o` anywhere, `g` is a sub-group and never
splits. If it does not, `g` is the only thing that can split, and does.

### The winding test rested on one triangle

`triangulatePolygon` compared `tris[0]`'s normal against the polygon's Newell
normal. Ear clipping emits zero-area triangles routinely — a collinear ear is
what you get the moment a neighbouring face's vertex lands on this face's
edge — and `importTriNormal` returns null for one. Whenever the clipper put a
degenerate ear first the test was skipped and **the whole n-gon kept the
clipper's winding**: a back-facing face in the middle of the model. Now asked
of the area-weighted sum of every triangle.

### Also taken

Ring vertices deduped by **welded position**, not index (a sliver corner
1e-5 away gave a rim with a self-edge in it and an inset that tore, with no
refusal); a face whose indices do not resolve is dropped **whole** and
counted rather than quietly shrunk from a quad to a triangle; zero-area faces
dropped; `.stl` removed from `accept` until the reader existed; two models in
one selection no longer silently discarded; `Kd 0.8` read as grey per spec.

### A material with no `Kd` is not a grey

An `.mtl` that never states a colour is saying "whatever colour you like",
and this app already has a way to say that: `color: null`, which is what the
presets carry and what makes them follow the theme. Minting a literal grey —
even the theme's own current one — freezes it. glTF has no equivalent case;
the spec gives `baseColorFactor` a default of `[1,1,1,1]`.

---

## a2.71 — the biggest finding was not about STL at all

### The fog ate every imported model

Fog is 15..42 units in the background's own colour, and `frameBox` puts the
camera at ~1.8× the model's largest dimension. **Any model over ~23 units was
painted as pure background the moment it was framed**, while the fog-free
helper lines kept drawing — vertex dots and edges floating on an empty
screen.

The same failure `engageOrtho`'s own note describes ("from ~27x further out
the whole scene was 100% fogged"), reached the other way round: by the scene
growing instead of the camera retreating. a2.71 made it the **default**
outcome, because an .stl carries no units and is nearly always authored in
millimetres — a 25mm printed part is a 25-unit model.

Rescaling imports would have been worse: it invents a fact the file does not
state, and it would be wrong for a .glb, which *does* state its units. The
scene was not wrong; the constant was. `refreshDepthRange()` multiplies the
fog band and the far plane by the content's scale, floored at 1, so every
number is unchanged at the app's own scale.

### The stored normals get one vote, not one per facet

Both the normal and the winding are in an .stl and they disagree more often
than they should — a mirrored export transforms the coordinates and leaves
the vertex order alone. But **the ecosystem trusts the winding**: three's own
STLLoader never reads the stored normal, and neither does any slicer, because
the normal is the field writers get wrong.

Flipping per facet made a file with garbage normals come out in **mixed**
winding — and a flipped triangle reads as −1 against its merge seed, so one
flat plane splits into several faces, the face count inflates, and the face
budget can refuse a file that would otherwise have imported fine. Silently.

Now the disagreement is counted and the file is re-wound only when the
normals are near-unanimous, and the toast says it happened.

### A bound may only refuse in the direction it is sound

The ASCII pre-check was `byteLength / 50`. 50 bytes is the **floor** of a
conforming ASCII facet, so that is an *upper* bound on the triangle count —
and refusing when an upper bound is too big refuses files that are fine.
Blender writes ~227 bytes per facet, so a 2.1MB file holding 9,800 triangles
was rejected as "43k triangles" in a release about honest refusal. The OBJ
path counts `f` lines, a *lower* bound, and can only refuse files that really
are too big.

### Also taken

A binary .stl one byte off (padding, or truncation) was diagnosed as "No
triangles in that .stl", the opposite of true — padding is now tolerated and
truncation is named. `gltfRefusal` sniffs for `{` before decoding, so a
200MB .blend picked by mistake is no longer decoded into a string twice its
size. **meshopt is refused only when `extensionsRequired`** — listed under
`extensionsUsed` alone it is the fallback form, which carries readable buffer
data and which three loads correctly. And the autosave-quota message points
at Download .json rather than "save it under a name", which writes the same
bytes to the same full origin and fails too.

---

## Lessons

**A fixture centred on the origin hides an origin bug.** The displacement bug
survived a passing probe suite because every fixture in it was a cube at
0,0,0. Deliberately-off-centre fixtures now exist.

**A bound has a direction.** Both the OBJ and STL pre-checks estimate a
triangle count from a file size, and only one of them was sound. Ask which
way an estimate errs before refusing on it.

**Following the ecosystem beats following the spec** when a field is known to
be unreliable. The STL normal is in the file and is authoritative on paper;
every real consumer ignores it, and there is a reason.

**The reviewer's biggest finding was in code the patch never touched.** The
fog constant had been there since long before import existed. What a change
does is not bounded by what it edits.

**Two of a2.69's four defects were in code faithfully mirroring an
established precedent — and the precedent was the bug.** Worth repeating
because it happened again: a2.70's `landImport` extraction was correct, and
the thing it extracted had a latent in-place-mutation hazard that only became
reachable once a second reader existed.
