# Cross-test findings — 2026-08-25 (fleet stopped early at user request)

Five-auditor workflow launched; concurrency allowed 2 at a time; user
stopped it after the first pair (functional QA + performance) were ~70%
done. Findings below are salvaged from their transcripts — REAL but NOT
adversarially verified. Three sweeps never ran: mobile/UX audit, static
correctness review, static perf review (prompts preserved in the
workflow script kubik-crosstest-wf_ed821aec-42a.js; resumable).

## RESOLVED

1. **~~a2.16 crease+smooth shading hangs on large meshes~~ — FIXED in
   a2.16b.** It was an INFINITE LOOP, not a cost blow-up, and it had
   nothing to do with mesh size. In applyShading's normal-island flood
   fill:

       const nbrs = m && m.get(stack.pop());

   `m` is `adj.get(l)`, which is `undefined` for any logical vertex with
   no non-creased bridging edge — i.e. a vertex where EVERY incident
   edge is creased. `&&` short-circuits, so `stack.pop()` never runs,
   the stack never drains and `while (stack.length)` spins forever.
   Fix: pop into a local first, then look the neighbours up.

   Deterministic repro (no subdivision needed): plain cube, crease all
   12 edges, Shade Smooth → tab freezes. The perf agent's L4 cube hit it
   only because it happened to leave some vertex fully surrounded by
   creases.

   Measured after the fix, on the real build in Chrome:
   - applyShading, all faces smooth + EVERY edge creased:
     6 groups 0.3 ms · 1541 groups 55 ms · 6144 groups 160 ms — linear.
   - full Shade Smooth path on 1541 groups: faceGroupsForShadingTarget
     0.2 ms, setGroupsShading 45 ms, serializeDoc 5 ms, pushHistory 6 ms,
     refreshUI 1 ms. Nothing to optimise here.
   - Correctness held: all-creased + all-smooth gives exactly the 6 axis
     normals (fully flat); no creases gives the 8 corner normals.

   Reviewed by a fresh agent: diagnosis and fix confirmed, fix is
   behaviourally identical wherever the old code terminated. It flagged
   two non-blocking follow-ups — a zero-length `acc` writes a (0,0,0)
   normal (black vertex) on degenerate fans, and the downstream fan
   average is O(deg²) per vertex (cacheable per `(l, tag)`).

2. **~~Bridge between edge loops of two joined cubes produces broken
   geometry~~ — FIXED in a2.16c.** One cause, both symptoms.
   `edgeChains` walks the selected edges and never steps onto an
   already-seen vertex, so a RING comes back as an open path: a 4-edge
   loop reads as 4 vertices / 3 edges. `bridgeEdgesOp` then built 3
   walls instead of 4 (**the open slit**) and matched the two runs by
   their ENDS, which for two rings facing each other pairs A's near
   corner with B's FAR corner, so the connectors crossed (**the
   overlapping walls**).

   Fix, three parts:
   - chains now carry `closed` (last vertex adjacent to first, length>2);
   - two closed rims that are each exactly one face group's outline
     **delegate to `bridgeFacesOp`** — the rim of a face IS that face, so
     bridging the four edges round a cube's top must mean what bridging
     the top face means (caps dropped, winding and phase inherited from
     the proven path);
   - genuine open rims (caps already deleted) fall through to a ring
     path that walls all the way round (`legs = r0.length`, wrap with
     `(i+1) % n`) and picks the phase with `chooseRingOffset` AFTER the
     winding rule, never before;
   - one closed run + one open run now refuses with a message instead of
     quietly producing a slit.

   Measured, two joined cubes, both top rims selected (auditWinding:
   shells / boundary / non-manifold / reversed):
   - BEFORE (HEAD): 3 walls, 15 groups, 3 shells, 2 boundary, 6
     non-manifold — audit FAIL.
   - AFTER: 4 walls, 14 groups, 1 shell, 0 / 0 / 0 — audit PASS,
     byte-for-byte the same result as bridging the two FACES.
   - 3 sections curved: 12 walls, 22 groups, clean. 2 sections straight
     (the historical weld trap): 8 walls, clean.
   - caps deleted first, then the two open rims bridged: 4 walls, closed
     solid again, clean.
   - untouched open-run path (two 2-edge runs): 2 walls, 0 reversed, 0
     conflicts, unchanged.

   Reviewer follow-ups, NOT fixed (neither is a regression):
   - `edgeChains` silently drops edges at any vertex of degree > 2, so a
     BRANCHING edge selection (triangle plus a spur, figure-eight, two
     loops sharing a vertex) still produces junk quietly. A degree check
     plus "selection branches" refusal would turn that into a message.
   - `ringGroup` compares the rim to a face outline as a SET of logical
     ids; the same set in a different cyclic order (needs the diagonals
     to exist AND be selected) would delegate to the face bridge and
     bridge the face's loop rather than the selected ring. Comparing as
     a cyclic sequence under rotation and reflection closes it.

## AMBER

3. **Connect on a quad's diagonal silently does nothing** — violates the
   house "a silent no-op is the worst failure mode" rule; needs a toast
   (or the op). Vertex pair on the same face, no existing edge between.

4. **Crease may not hold edges through smooth Subdivide** — the agent
   observed creased edges NOT influencing Catmull-Clark smoothing and
   was checking the help card's promise when stopped. Could be a
   regression, could be harness misuse. Needs a clean repro: cube,
   crease one loop, subdivide smooth ×1, compare creased-edge sharpness.

## PASSED (worth knowing)

Extrude/inset/bevel/split/loop cut/knife (incl. 2-face chains, driven by
real synthetic pointers), delete in all 4 modes, cap holes, detach→undo
across objects, duplicate/join, merge (correctly refuses non-coincident),
weld-all (graceful object removal + toast), undo/redo via keyboard after
deep chains, autosave/reload, a2.16 crease-shading islands CORRECTNESS on
normal-size meshes.

## PERF notes

- **Subdivide rebuild is superlinear — now measured (a2.16b).** Cube,
  smooth subdivide, cumulative: L1 10 ms, L2 6 ms, L3 26 ms, L4 191 ms,
  L5 1454 ms. Each level multiplies the data by 4 and the time by ~7.6,
  so L6 lands around 11 s — that is almost certainly the ">10 s freeze"
  the perf agent force-terminated and attributed to shading. This is the
  real remaining perf bug in that area.
- ensureHelpers builds one overlay mesh+material PER FACE GROUP — helper
  rebuild is heavy on subdivided meshes; runs after every op.
- Known pre-existing: one MeshStandardMaterial per face group (1541 mats
  on an L4 cube) — memory/draw calls; a per-def shared-instance refactor
  is the structural fix (ties into the materials asset model).

## Harness note (cheap, worth reusing)

Both fixes were diagnosed by copying index.html to `_test.html`, adding
the internals under test to the `window.__kubik` export with a Python
patch script, serving on :8765 and driving it from javascript_tool.
Useful specifics:

- `git show HEAD:index.html > _orig.html` + the same probe patch gives a
  side-by-side BEFORE build on the same server — that is where the
  15-groups / 3-shells / 6-non-manifold "before" numbers came from.
- When a call hangs, the Chrome MCP tool returns `Internal error` rather
  than a timeout — **that error IS the signal**. Bisect by re-running the
  algorithm in the page with a `stopAfter` stage argument; it localises
  the hang in three calls.
- `K.auditWinding(obj)` after every op is the whole regression suite for
  geometry work: shells / boundary / nonManifold / conflictEdges /
  reversed, and `ok`.
- `removeObjects` takes objects, not ids; `combineObjectsInto(objs,name)`
  returns the joined object but leaves the sources in `App.objects`.
- Scene builders worth keeping: `addCubeAction()` ×2 → `combineObjectsInto`
  → drop the sources → `ensureHelpers` gives the two-joined-cubes fixture.

## Not yet run (future sweep candidates)

Mobile/UX audit (hit sizes, contrast both themes, thumb reachability,
gesture discoverability vs Help), static correctness review (three-maps
invariant in newer ops, dispose leaks incl. _maskTex never disposed on
def delete, capture/restore covering creases), static perf review
(per-frame allocations, pointToLogical scans, serializeDoc-per-pushHistory
memory on big meshes, renderMatPreviews making a WebGLRenderer per tray
rebuild).
