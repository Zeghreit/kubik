# Handoff — NEXT: v3.14 Punch patterns (decided 12.10, Zeghreit: "do as you see fit"). Last shipped: v3.13a (Punch freeze fix, 2a44837, confirmed on the phone). v3.13 Measure over embed (dc1320b), v3.12 Punch (28fe227).

**12.10: v3.14 recon DONE, plan agreed, NO code written, nothing pushed. Paused to move the project to Claude Code — continue there from "v3.14 — recon findings" below.**

Live: https://zeghreit.github.io/kubik/ · repo `C:\Users\a.bodrov\Projects\kubik` (**PC needs `git pull` to 2a44837**)
Read `CURRENT_STATE.md` first — its last sections (v3.12 Punch, v3.13a) are the truth. Client reference: `EMBED.md` in the repo root.
Standing constraint: **UV transform stays 2D-only.**

**CLOUD BENCH WORKS** (re-confirmed 12.10: `_punchchk` ALL GREEN on 2a44837). Build and test entirely in the cloud: add_repo with push, `python3 _cloudprobe.py <probe>.js out.txt` (headless Chromium, `_dev/csg` committed). Env: `VIEWPORT=390x844 TOUCH=1 SHOT=file.png` gives a phone-size run plus a screenshot. Push from the cloud, `git pull` on the PC.
**Probe tricks (v3.13a):** a hung page blocks `_cloudprobe`'s `pg.title()` forever — post progress with a SYNC XHR to `/p` and print it in the route handler; to locate a hang, enable `Debugger` over CDP BEFORE `goto`, then `Debugger.pause` and print `callFrames`. CPU profile: `Profiler.start` before `goto`, stop after the probe says done.
**BRIDGE TRAP (04.10): Desktop Commander `write_file` of ~100+ lines killed the bridge three times. ≤30-line chunks.**
**`.gitignore` has `_*`** — a new probe needs `git add -f`.

## v3.14 — Punch patterns
Scope: **arrays (line / ring) + mirror + rounded-rectangle cutter**, one version. Cutting with a curve = later, its own version. Dynamic booleans = after that, START WITH A DESIGN TALK, no code (see below).

### Recon findings (12.10, measured / read in code at 2a44837)
- **Overlap trap is already solved by the engine.** `booleanBuild(objs, kind)` (~l.36853) chains: `acc = ev.evaluate(acc, brush_i, OP)` for every input. So pass `[target, c1..cN]` — each cutter is its own valid subtraction/union, overlapping copies never form one self-intersecting brush. No pre-union, no spacing clamp needed. Cost = N evaluates → measure with `_punchperf`, cap count at 24. Cache key = kind + all ids joined, so per-copy ids just work.
- **Exact duplicates must be dropped**, not chained: an even ring of THROUGH holes on a solid cylinder gives pairs of cutters on the same line with coincident walls (coplanar CSG). Rule: drop a copy if near an existing one (|Δp| < 0.25·size, n·n' > 0.9), and for holes also if (anti)parallel and within 0.05·size of an existing bore's line.
- **Bar at 390px (screenshot taken):** 244 px tall, 3 rows of cells. Row 1 = Hole/Dent/Boss (x 12..185), ~190 px free to its right. Row 2 = topology chips + Square toggle. Row 3 = sides stepper + Generate + ✕✓. `#opCells` is `flex-wrap`, cells in DOM order: opGrouping, opGrouping2, opToggleWrap, opSegments, opSegments2, opExtraWrap, commit. Steppers 116 px, commit 152 px, chips ~45 px each.
- `p.square` read at 5 places (punchCutter ×2, refreshPunchOutline, punchPointerMove, stepper2.hidden). `spec.toggle` for SETUPS only flipped in `toggleOpSetupSwitch` (~l.43270) and drawn in `showOpSetupBar` (~l.43370); l.18379/18415/55787 are OP_SPECS (pending ops / command layer) — punch is not there (`OP_GESTURE`), safe.
- `hideOpBar` (~l.18564) hides cells by id — a new bar cell must be hidden there too, or it stays up under the next op's bar.
- `_punchchk` finds the outline as `c.isLineLoop && renderOrder === 999` and clicks `#opToggle` expecting Square — both need updating with the change below.

### The plan (agreed, Claude's call)
1. **`punchCopies(s, size)`** → list of frames {point, normal, u, mi}, memoised on the pattern params + size. Base = the tap (not re-hit). Axis = one of the target's world axes (matrixWorld columns), centre = bbox centre.
   - **Line**: N copies centred on the tap, centre-to-centre `size·(1 + gap/10)`. March along the surface from copy to copy: tangent = axis flattened against the current normal (axis ∥ n → base u), step, re-hit; stop a side when the tangent vanishes or a ray misses. Follows a cylinder wall.
   - **Ring**: N copies, point/normal/u rotated by 2πk/N about the axis through the centre, each re-hit. Tap on the axis (radius < 0.05·size) → only the base, say so.
   - **Mirror** (toggle, composes with both): reflect every frame across the plane ⟂ axis through the centre, re-hit, dedupe.
   - Re-hit = `punchHit` along −n' from `p' + n'·(size+…)`, fallback from `p' + n'·diag`; reject a hit farther than ~0.5·diag from p'. Missed copies dropped; readout prefix "k of N ·".
2. **Build**: `punchBuild` → `booleanBuild([o, ...cutters])`; cutter id = shape params + each copy's frame. `spec.build` compares the joined ids (topoBooks/seed reset as now).
3. **Shape**: Square toggle → cycling button Round → Square → Rounded (`p.shape`; label = current shape, active when not round). Needs `toggle.cycle(s)` / `toggle.active(p)` / label-as-function support in `toggleOpSetupSwitch` + `showOpSetupBar`. Round keeps `buildPrimitiveEditable('cylinder')`, Square keeps 'cube' (exact volumes in `_punchchk`). Rounded = own convex prism from a 2D profile (4 segments per corner, corner radius = `corner/10` × half-size, stepper2 shows %), winding fixed per triangle against the centroid. Stepper2 for Round = sides with "3 = triangle" in its text/tip. Drag sizing for Rounded = the square rule. One `punchProfile(p, r)` feeds both the prism and the outline.
4. **UI — a pattern page**, state on `s` (NOT in `s.p`, so it is no undo step and no rebuild): new cell `#opPageWrap` after `#opGrouping` (row 1). Main page label "Pattern" (or "Ring ×6 + Mirror Y" when on); pattern page label "Back". On the pattern page, via getters on `OP_SETUP.punch`: chips One/Line/Ring (`pat`), chips2 X/Y/Z (`axis`, default Y), toggle Mirror, stepper count (2..24, hidden for One), stepper2 gap % (Line only, 10..500%), Generate hidden. Fits in 3 rows at 390 px (row 2: XYZ 135 + Mirror 73 + count 116 = 336).
   Defaults: shape round, corner 3, pat one, axis y, mirror off, count 6, gap 5.
5. **Outline**: `punchLine` → `LineSegments`, one loop per landed copy; live slider recomputes copies at the live size.
6. **Verify**: extend `_punchchk` (line on a flat face: volume = N × one hole; ring of holes on a cylinder: closed and wound, one shell; mirror pair symmetric; even-ring dedupe; rounded volume vs analytic `s² − (4−π)cr²` × height; outline shows N loops) + `_punchperf` (24-copy timing) + `_boolchk` + `_opbarchk` (pattern page at 390 px). Fable review on the copy placement maths (re-hit, marching, dedupe tolerances).

## Dynamic booleans (after v3.14, design talk first)
Idea from chat: the cutter stays a separate object linked to its target; grab it with a finger and move → outline/ghost follows live, release → target recomputes (the same live / commit-on-release pattern v3.13a added for the slider). No gizmo. Open questions: where the link lives (save/load/undo), what the cutter looks like in the scene (ghost?), when and how to bake, what Undo steps, cost on a phone (one CSG per release is fine, per move is not), chains of several cutters.

## Next / open (after the above)
1. Zeghreit's verdict on Punch feel: tap/slide, default size, depth as %.
2. **Punch on a dense UV sphere gives an open / multi-shell result at 94 of 150 sizes** (already in N-gon → CSG + heal on curved high-density targets). Candidate for a fable review of CSG → heal on curved targets.
3. Remaining slow builds ~1.5–2 s desktop on huge holes — on a phone a few seconds. If it bites: a busy indicator or a smaller budget.
4. Quads var 1 is not the best layout on a punched cube (40q/32t vs 64q via Generate).
5. Declarative select: `select: { mode, where: { normal, angle } | { box } | { side } }` + grow / shrink / loop; answer `{ count, ids, bounds }`.
6. Plain-editor FBX bug (v3.10): `importFbxBuffer` releases the parse before landImport — no FBX map reaches a material.
7. Export button writes one primitive per FACE → `compactForExport` for the button too.
8. Heavy-mesh plan toward ~1M faces.
9. Reviews not done: fable on `compactForExport` + `fitDistance`; opus on the v3.11 layer.
10. Small: Extrude via `op` needs `amount`; Clear creases/seams with nothing to clear answer `refused`; UV ring not in `op`.
11. Old opens: `_gpuchk` NO REPORT; `_projchk` 4494kb fixture; glTF clearcoat/sheen; FBX unit scale.

## Harnesses
Cloud: `_punchchk.js` (~1 min), `_punchperf.js` (~4 min), `_boolchk.js`, `_opbarchk.js`. Any probe driving `opSlider` must send 'change' after 'input'. PC (untracked): `py -3 _embedchk.py [page]` on localhost:8996; `_opchk.html` → `_opchk_out.txt`.
