# Handoff — NEXT (Zeghreit's order 12.10): 5 done (v3.14c), 2 done (v3.16 Cut with curve: Knife / Split) -> 3 boolean residue (DONE v3.16b) -> 6 heavy-mesh plan (WRITTEN; next: step A). Then: Punch shapes from a curve (inside Punch). Last shipped: v3.16a Punch multi-material fix; v3.16 Cut with curve; before it v3.15 embed `export obj` (for AF) + .obj/.stl buttons export objects where they stand.

Live: https://zeghreit.github.io/kubik/ · repo `C:\Users\a.bodrov\Projects\kubik` · the project now runs in Claude Code on the PC (rules: `CLAUDE.md`).
Read `CURRENT_STATE.md` first — its last section (v3.14) is the truth for Punch now. Client reference: `EMBED.md` in the repo root.
Standing constraint: **UV transform stays 2D-only.**

**PC BENCH WORKS** (12.10): `py _clean_probe.py <probe>.js out.txt` runs the cloud probes too — headless Chrome, CDN live. `PROBE_TIMEOUT=<s>` (default 120), `PROBE_PORT=<n>` (own port and page, so two runs can share the PC). Only `/result`, `/report`, `/done` end a run; any other POST path is a progress line. Long runs with `run_in_background`.
**`.gitignore` has `_*`** — a new probe needs `git add -f`.

## v3.15 — shipped (13.10)
Embed `export {format:'obj'}` for AF's `af_to_obj` (FBX -> OBJ for Mixamo; AF switched its preview, mesh gate, map wiring and OBJ steps to Kubik by default). One `objText` for the button and embed. Found on the way and fixed for the buttons too: OBJExporter/STLExporter read `matrixWorld`, which buildExportGroup's new meshes never had updated - a moved/turned/scaled object's .obj and .stl came out where it was made. V by source in embed: FBX/OBJ meshes keep their UVs, the rest get 1 - v. Verified: `_objchk.html` 11/11 (`py -3 _embedchk.py _objchk.html`), `_embedchk` regression, and AF against Blender on five Tripo FBX (vertices, UVs, shells, bbox identical). All in `CURRENT_STATE.md` -> "Export .obj for a host (v3.15)". Loose end there: the BUTTON still turns V over on FBX imports (needs the source format kept per object).

## v3.14 — shipped (12.10)
Arrays (line / ring) + mirror + rounded-square cutter, a second "Pattern" page on the Punch bar; the op bar's readout made visible on a phone (it was 0 px wide beside Punch's slider since v3.12), and Punch's readout now says "N open edges" before OK. All in `CURRENT_STATE.md` → "Punch patterns and a rounded square (v3.14)". Verified: `_punchchk` 86/86, `_punchperf` ALL PASS, `_boolchk` PASS, `_opbarchk` no overlaps 320–430 px, fable review of the placement (3 fixed, 1 made visible, 4 limits written down), opus review of the bar and failure paths (1 bug fixed: a refused build wiped Generate's layout). Below 520 px Lathe and Tube now put their slider on its own line (it used to run off the screen) - 48 px taller bar, worth a look on the phone. Waiting for Zeghreit's feel on the phone: is the Pattern page findable, are the default count 6 / gap 50% right, does the outline on the far side of a ring (drawn on top, like v3.12's) read as help or clutter, and is the extra readout line under the slider worth its 13 px.

## v3.17 - shipped (18.10): embed `transform` / `getTransform`
Numeric object move/turn/scale for a host (EMBED.md -> transform; CURRENT_STATE -> Embed mode). Made for AssetForge's new MCP server `assetforge/kubikmcp.py` (one persistent headless Kubik, tools `kubik_*`). Verified by numbers on `sepgen_r01_attach_asm_join.glb` (7 parts joined): move +[1,2,3] shifts bbox exactly; rot Y 90 swaps X/Z size; scale 2 doubles; obj export bbox == measure bbox; 3x undo restores. `_verify.py` PASS. Not run: the `_embedchk` battery and the opus review. Known: Join drops UV, so a textured assembly must stay separate objects (placed with `transform`). Open: `add` rotation turns about the object's origin, not its bbox centre (documented).

## (a) v3.14a candidates — measured, with repro probes
1. ~~4+ holes through one face open~~ — FIXED v3.14b: a CSG "twin" corner's sliver is collapsed instead of dropped (`CURRENT_STATE.md` → "A sliver's short edge is collapsed"). Also closed the box ring of bosses.
2. ~~3+ through-bores crossing~~ — FIXED v3.16b (collapse link condition + closed slivers kept). Dense sphere sweep 24/150 open, 20 of them a stale-preview artifact of the probe (`_punchperf` should skip refused sizes).
3. ~~Quads on a faceted wall moves volume~~ — FIXED v3.14a (per-piece volume guard, `CURRENT_STATE.md` → "Quads may not move volume"). The "Ring ×6 opens the shell" half did not reproduce on the cloud bench. New sighting: a ring of bosses/dents tapped near the middle of a box's top face is open in EVERY topology (N-gon b18) — belongs to 1/4.
4. Copies whose walls nearly touch (0.9–1.1 × size apart) open now and then; ragged band (numbers in CURRENT_STATE).

## (b) Dynamic booleans (design talk first, no code)
Idea from chat: the cutter stays a separate object linked to its target; grab it with a finger and move → outline/ghost follows live, release → target recomputes (the same live / commit-on-release pattern v3.13a added for the slider). No gizmo. Open questions: where the link lives (save/load/undo), what the cutter looks like in the scene (ghost?), when and how to bake, what Undo steps, cost on a phone (one CSG per release is fine, per move is not), chains of several cutters — and now patterns: is a pattern one linked cutter or N.

## Next / open (after the above)
1. Zeghreit's verdict on Punch feel: tap/slide, default size, depth as %.
2. **Punch on a dense UV sphere gives an open / multi-shell result at 94 of 150 sizes** (already in N-gon → CSG + heal on curved high-density targets). See (a) 2.
3. Remaining slow builds ~1.5–2 s desktop on huge holes — on a phone a few seconds. If it bites: a busy indicator or a smaller budget.
4. Quads var 1 is not the best layout on a punched cube (40q/32t vs 64q via Generate).
5. ~~Cutting with a curve~~ — v3.16 Knife / Split shipped (CURRENT_STATE "Cut with a curve"). Still to do: a curve as a Punch shape (Zeghreit: inside Punch, later). Punch multi-material crash: FIXED v3.16a.
6. Declarative select: `select: { mode, where: { normal, angle } | { box } | { side } }` + grow / shrink / loop; answer `{ count, ids, bounds }`.
7. ~~Plain-editor FBX bug~~ — FIXED v3.14c.
7a. Export button .obj: fixed 18.10 for single-format scenes via App.uvBottom (last import wins; not saved in the file). Still open: source format per object for mixed scenes.
8. ~~Export button one primitive per face~~ — FIXED v3.14c (compacted + `_KUBIKFACE` face numbers keep the round trip).
9. ~~Heavy-mesh plan toward ~1M faces~~ — WRITTEN 13.10 with measurements (`claude/heavy-mesh-plan.md`, top section; bench `_heavyscale.js`). Next step from it: A (incremental applyShading on drag), then B (history without full snapshots).
10. Reviews not done: fable on `compactForExport` + `fitDistance`; opus on the v3.11 layer.
11. Small: Extrude via `op` needs `amount`; Clear creases/seams with nothing to clear answer `refused`; UV ring not in `op`.
12. Old opens: `_gpuchk` NO REPORT; `_projchk` 4494kb fixture; glTF clearcoat/sheen; FBX unit scale.
13. From the stage-1 UI report (ui-hybrid): A1–A6 data loss and keyboard, B1 heat, B3 small targets.

## Harnesses
`_punchchk.js` (~2 min), `_punchperf.js` (~5 min), `_boolchk.js`, `_opbarchk.js` — all via `_clean_probe.py` on the PC (or `_cloudprobe.py` in the cloud). Any probe driving `opSlider` must send 'change' after 'input'. Repro: `_holeschk.js`, `_crosschk.js`. PC (untracked): `py -3 _embedchk.py [page]` on localhost:8996; `_opchk.html` → `_opchk_out.txt`.

## v3.18 / v3.19 - shipped (31.10): heavy-mesh stages 0 and A1, both measured
Stage 0 (v3.18): `separateGroupVertices` no longer builds a Map per FACE (508k
Maps on a 508k rebuild); `rebuildFromEditable` no longer calls `geo.addGroup`
per face for `mergeDrawGroups` to throw away; `Float32BufferAttribute` no
longer copies buffers that are already float32. Import build at 508k 7.31s ->
5.54s, one operation 3.16s -> 2.98s (single shot, before/after the same bench).
Stage A1 (v3.19): triangle and face-group normals are two reused Float64Arrays
instead of 1.08M Vector3s, and the wear list is a flag on the edge record
instead of a Map with 1.1M entries plus a second key-rebuild pass. Proven
identical by `_shadecmpt.js` (15 rows, hashes of the whole normal buffer, the
whole edge list and the face map, against a saved v3.18) - and proven NOT
faster: 3.83s vs 3.51s median at 508k, spread +-0.3s.

Bench method changed with this: `_heavytarget.js` now takes the median of
three with a forced GC, because the same operation on the same build read
2.73/2.82/3.64s across three single-shot runs. Any claim under ~30% at 500k
needs two runs of the same harness. Older numbers in
`claude/heavy-mesh-plan.md` are single-shot and optimistic by about a third.

Not run: the full `_runprobes.py` battery after v3.19 - only probes 0 (ops),
3 (perf), 18 (shade) and 23 (imp) were run, all clean; the whole 36-probe
suite was run and clean on v3.18. No opus/fable review on either patch.

Next, in order, from `claude/heavy-mesh-plan.md`: **A2 - applyShading on a
dirty set** (a drag frame must be O(moved), not O(N)), then B (delta history:
one step is 190MB at 500k, which is above the 128MB hard ceiling, so undo
today is one step deep), then D (GPU picking: one tap is 1.0-2.1s), then C
(rebuild in a Worker), then E+F (typed arrays + chunks), then G (helper LOD).

## v3.20 (A2, dirty-set shading) - ATTEMPTED 31.10, NOT SHIPPED, reverted
`applyShading(obj, dirty)` with a 1-ring was written and does not work yet: the
dirty set comes out EMPTY and the pass silently falls back to the full one, so
every "result matches a full shade" row was true for the wrong reason. Caught by
`_dirtycmpt.js`, whose witness is `normal.updateRanges` - the dirty path always
leaves one, the full pass never does; a missing range is a FAIL there, by name.

What is already known for the next attempt:
- the fallback is now LOUD (`warnOnce('dirty', ...)`), which it was not in the
  first cut - that silence is what let the probe pass vacuously.
- `logicalOf` has to be in applyShading's destructure of the shading topo; the
  first cut forgot it, which threw inside the dirty-set try and fell back.
  Fixed, and the set was still empty, so there is a SECOND reason.
- `computeTopology` and `buildShadingTopo` both call `computeLogicalOf(pos)`, so
  their logical numbering ought to be identical - the open question is why
  `trisAt.get(id)` misses for ids taken from `topo.logicalGroups[l]`.
- a candidate that removes the question entirely: pass an ATTRIBUTE index
  (`topo.logicalGroups[l][0]`) instead of a logical id, and map it inside
  applyShading with its own `logicalOf`.

The work is in `_a2_wip.diff` (scratch, untracked) - index.html was reverted to
the shipped v3.19, which is what is live. Each probe run took ~10 minutes, so
budget for that: the probe itself is fast, the headless boot is not.

## v3.20 (A2) - SECOND attempt 31.10, still not shipped, reverted
The root cause of the empty dirty set was found: `buildShadingTopo` did not
return `logicalOf`, so the first lookup threw, the throw was caught, and every
frame fell back to the full pass. With `logicalOf` returned (and the caller now
passing an ATTRIBUTE index, `topo.logicalGroups[l][0]`, mapped inside
applyShading with its own `logicalOf`), the dirty path RUNS: the update range
appears, and `geo.userData.shadeStats` reports a sane set - a box corner gives
3 of 6 faces, 6 of 12 triangles, 7 of 8 vertices.

`_dirtycmpt.js` then says the buffer is WRONG on some shapes and right on
others: sphere 4/4 match, box 3/4 (the single-vertex case differs), torus 0/4.
So the 1-ring is too small somewhere, or a cached value is not refreshed.
The probe is ready and prints groups/tris/verts per row - the next step is to
have it report WHICH attribute vertices differ (index + old/new normal) rather
than only that the hash differs; that is what will say whether the misses are
outside the ring or inside it.

Two smaller things learned, both worth keeping:
- the probe must prove the dirty path RAN before it proves it was right. The
  witness is `geometry.attributes.normal.updateRanges.length`: the dirty path
  always leaves one, the full pass never does.
- an object per `edges.forEach` was avoided on purpose in v3.19 and the same
  care applies here: `shadeStats` is one small object per dirty FRAME, which is
  fine, but nothing inside a per-edge or per-vertex loop may allocate.
- wrapping console.log in the probe made the whole run hang for 10 minutes.
  Do not do that again; report through `geo.userData` instead.

Work is in `_a2_wip2_utf8.diff` (scratch, untracked). index.html is back at the
shipped v3.19.

## v3.20 (A2) - THIRD attempt 31.10: the shading is right, the mask list is not
Progress this time, and it is real. `_dirtycmpt.js` now classifies every
difference instead of only counting it, and that split found the bug in one run:
the 1-ring was too small. A normal went from a BLEND of two faces to a single
face normal, which is an island changing shape, not a face turning - an edge
flag is a dot of two face normals, so a face one ring out can flip an edge on
the ring. Widening to the corners of every triangle at a ring vertex, and
re-asking sharp for EVERY edge at every ring vertex (idempotent, so
over-asking cannot be wrong), made all 9 cases match a full pass exactly.

Three more defects, all found by the probes and all fixed:
- `triSign` (the winding pass, O(triangles)) ran on every dirty frame and was
  never read - it only feeds the convex/concave test in the wear list.
- a TDZ bug: `moved.push(ais[0])` was written above `const ais = ...`. Caught by
  `_shade_probe`, not by `node --check`.
- `rec.wear` is only assigned by the full edge loop, so skipping that loop left
  a freshly built topology with no wear flags and an EMPTY edge list.

The last one is where it stands. With the edge loop restored, the drag case in
`_shade_probe` is identical again, but the sphere case still reports
`wear_positions LENGTH 48 vs 60` - 8 edges instead of 10. Something about which
records carry `wear` across a topology rebuild is still not right, and it is
NOT worth guessing at: the next step is to count `rec.wear` set vs the number of
edges the list expects, on the frame that rebuilds the topology.

Do not skip the edge list to make it faster. `_shade_probe` pins that the list
follows the shape across a drag, and it is right to.

Work is in `_a2_wip3.diff` (scratch, untracked). index.html is back at v3.19.

## v3.20 (A2) - round 7: the ordering bug, and a botched apply
Found it, or very nearly. In the A2 dirty path the recompute of the DIRTY
GROUPS' normals was written at the shadeVertex site, i.e. AFTER the edge loop
(`edges.forEach` -> sharpOf -> rec.sharp / rec.wear). So on a dirty frame the
edge flags were decided against STALE face normals - which is exactly why
`_shade_probe` reported `wear_positions 48 vs 60` (8 edges where 10 are right)
while the normals themselves matched.

The fix is a move, not a rewrite: recompute the dirty groups' normals right
after the `if (!dirtyVerts) { ...full normal pass... }` block, BEFORE the edge
loop. Once the edge loop always runs (it does now, see the previous entry) the
separate "re-ask sharp for every edge on the ring" step becomes redundant and
should be deleted with it.

What NOT to do again: the move was attempted with a text search for the closing
`  }\n` of the normal block, and that anchor also matches inside a try - the
result failed `node --check` with "Missing catch or finally after try" and was
reverted. Do this edit with an exact, unique anchor (the three lines of the
normal pass plus the `if (!dirtyVerts) {` line above them), or restructure the
block by hand and read it back before verifying.

State: index.html is v3.19, `_a2_wip3_utf8.diff` holds the A2 work, and the
edit above is the ONLY thing between this stage and a measured drag frame.

## B (delta history) - DESIGN ONLY, not started. Read this before writing code.

The number: one history step at 500k faces is 190MB. `HISTORY_MAX_BYTES` is
48MB and `HISTORY_HARD_BYTES` is 128MB, so past ~330k faces a single step is
over the hard ceiling and `trimHistory` collapses the stack to one step - undo
becomes "one press, or nothing". `estimateDocBytes` counts a step by walking the
serialized doc, and `serializeDoc` deep-copies EVERY object into EVERY step.

Why this is not a quick patch: history is the app's only undo, and a delta that
is subtly wrong silently corrupts a user's model on the SECOND undo, not the
first. It has to be proven, not argued.

The first step, and the smallest thing that pays: STOP COPYING THE OBJECTS THAT
DID NOT CHANGE. An operation touches one object; the others can travel by
REFERENCE into the new step. `serializeDoc` already builds a fresh doc per step,
so the change is inside it, per object.

The correctness question that decides the design, and it must be answered by
reading the code, not from memory: WHAT can change an object without replacing
`obj.mesh.geometry`? Every op funnels through `rebuildFromEditable`, which makes
a NEW BufferGeometry - that part is safe to key on identity. The dangerous ones
are the in-place mutations: a vertex drag writes `attributes.position` and sets
`needsUpdate` (so `position.version` moves), `edgeShade` / `creases` / `seams` /
`finishes` are plain maps on userData that some paths rewrite without a rebuild,
and materials are POOLED and shared, so a material's own state can change while
the object's geometry does not.

So the key for "unchanged" has to cover: geometry IDENTITY, `position.version`,
the identity of the material array AND of each pooled material in it, and a
version stamp on each of the userData maps. The last part means adding a counter
that those writers bump - and that is the part that has to be found by grepping
every writer, because a missed one is a wrong undo.

Second step, once sharing works and is proven: a topology-preserving step stores
positions as a Float32Array of the whole object (12 bytes per vertex) instead of
a JS array of doubles (24 plus slot overhead), and a MOVE-ONLY step stores just
the moved indices and their old values - a drag then costs bytes, not megabytes.

How to prove it, before trusting any of it: build a fixture, apply a known
sequence of ten edits, then undo ten times and compare the whole doc (positions,
face map, materials, userData maps) at every step against a run that took the
same steps with history DISABLED and re-applied from scratch. Anything that
differs is a defect. Do not ship on "the undo looked right".
