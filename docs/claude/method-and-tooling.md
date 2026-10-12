# Method and tooling — the lessons this project keeps relearning

Lifted out of `next-session-plan.md` on 17.09.2026. That file was an a2.83-era
queue with the project's accumulated method notes bolted underneath; the queue
is long spent and the notes are the most-reused reference in the whole doc set,
so they now live on their own.

**The newest harness rules — real wall clock, threaded probe server, a
watchdog that forces FAIL, and five more from v2.36–v2.38 — are at the bottom
of `claude/uv-commands-maps-plan.md` under «Правило на весь заход».** Read both.

---

## The lessons

**Count the branch before deleting the code that feeds it.** a2.83's whole
decision came from one instrumented run: of 32,277 referenced vertices the
baseline still served 12, all on one branch, all on a synthetic fixture — and
it served them **(0,0,0)**, so the fallback rendered them black. Reasoning
about it would have got "is it safe to delete" right and missed the bug.

**A stale estimate outranks no estimate, in the wrong direction.** "7–9%, and
fifth" kept a2.83's item at position five for three versions. Re-measured
after the work around it, it was 15% and second.

**Read the pipeline before building to the note.** a2.81 was going to ship
Triangulate because the gap analysis said n-gons are unacceptable in exports —
but Kubik's n-gon is a face group that exists nowhere outside the editor, and
every exporter already writes triangles.

**A benchmark with no warm-up measures the compiler, not the code.** a2.82's
first race said the new loop was five times SLOWER at 48 triangles. Cold JIT.

**Ask what happens when the thing THROWS.** a2.82's stamp counter was advanced
on the success path only, which is correct on every path except the one
`applyShading` exists to survive. **Any state that survives a call has to be
advanced where it is consumed, not where the call succeeds.**

**An inherited justification has to be re-earned.** a2.80 copied Set flow's
"per-element, so the mirror union is right" — true of the mechanism, false of
the conclusion. a2.79 copied `extrudeRegionOp`'s rim walk and wall winding,
both correct there and wrong here.

**A test that cannot reach its subject passes vacuously.** a2.82's first
forced-throw section reached for `geo.userData.shadeTopo`, which is `null`
outside a direct drag; it printed "section 4 tested nothing" while two
assertions below it reported green. **This is the single most repeated failure
in the harness** — see the v2.33–2.38 run of it in the plan doc.

**Prove it as an ANSWER, not as a timing.** a2.82 compared every normal
component against the loop it replaced; a2.83 built the same 20 models under
HEAD and under the change and diffed the normals. Both times the interesting
line was the diff, not the clock.

**Assert the property the op exists to create.** a2.81's Tris to quads is
*for* producing four-sided faces, so checking that it did — with the same
function that consumes them — caught two malformed-quad cases at once.

**A worker function is not a tool.** (a2.78: twelve green sections while the
controls were broken in six places.) **Drive the controls.** And its v2.38
corollary: **do not export the thing under test.** `finishMeshEdit` is
deliberately not on `__kubik`, so a probe has to drive the real tools — one
that called the door directly would agree with any bug in the corridor.

**Print the parts, not just the total.** (a2.79)

**A relative guard cannot keep an absolute promise.** (a2.80)

**Check the fixture contains the thing being tested, and check the
assertion's own numbers.** The running tally: a2.75's "identical" of zero
edges; a2.76's cylinder that was a flat sheet; a2.77's "scattered" fixture
that was clustered; a2.80's cylinder built with field names that do not exist
AND a "small model" made by scaling the object when the weld rounds local
coordinates AND a threshold with no reasoning behind it; a2.81's "curved" grid
using `y = f(x)+g(z)`, which leaves every axis-aligned quad **planar**;
a2.83's own report line that called a 0.359 gap between unit vectors "close"
until it was made to print the angle (21°); v2.37's texture fixture that
weighed half a real bake because the noise sat in the middle and JPEG ate the
flat border.

**Dead code lies about intent.** a2.82 deleted a `sharp` Map that had been
write-only since a2.77 — and the comment above it described what it was *for*.
**Grep for the reads before believing the comment.**

**Write down the invariant a new fallback leans on.** a2.83's degenerate-fan
answer is the first thing in the file to depend on "a face group is exactly
one face". Nothing violated it, but the synthetic-single-group branch in
`buildShadingTopo` quietly could.

**A note is not a measurement, and an old note is not even a hypothesis.**

**Write the rewrite twice and race it before it goes in the app.** (a2.77,
a2.82)

**Compare within a run, not across runs** — the machine drifts 3x.

**When the fix removes code, it is probably the right fix.** (a2.79, a2.82,
a2.83)

**Stop guessing at an API after the second failure and read it.** (a2.76) — and
a delegated exploration that comes back hedged ("likely", "around line ~11600")
has not read it either.

**Reporting no speedup is a result.** (a2.74)

**The reviewer's biggest finding is often in code the patch never touched** —
or in the measurement, or in the premise. a2.83's best was an ORDERING: the
attribute was allocated before an exit that then calls
`computeVertexNormals`, which makes that exit take three.js's slow branch. Not
a bug — a change that would have made two paths worse under a headline that
said faster. At v2.36 and v2.37 the pattern held: both blockers the review
found were in how a failure was *ordered*, not in what the code computed.

**A broken build that PASSES can be right.** v2.38 aimed a break at a line
that every current caller still duplicates by hand, so removing it changed
nothing observable. The break was re-aimed; the line stayed. A break that the
probe shrugs at is usually a break aimed at the wrong line.

**Map the code before designing against the plan.** Stage 3 opened with a
read of how operations are actually invoked, and it corrected the plan in
three places at once — including "there are no Web Workers in this app",
which the plan's own slicing order was written around.

## Working notes that keep saving time

### The shell

- PowerShell mangles inline Python, its console is cp1251, and **`&` is not a
  valid separator in a PowerShell command line** — including between a
  `cmd /c "..."` and a following command. One `cmd /c` per chain. Inline
  `python -c "..."` breaks on nested quotes; **write a two-line `.py`**.
- On this machine Python is **`py`**, not `python`.
- **`findstr` is unreliable on `CURRENT_STATE.md`** (silently matches nothing
  on some patterns). `py _heads.py <file> <prefix>` lists matching lines.
- **A timed-out run leaves Chrome alive**, holding the profile lock and port.
  `taskkill /F /IM chrome.exe /T` before a run.
- **Long commands time out at the device bridge (~60s), not in the shell.**
  The process keeps running — re-read the output rather than re-running. For
  anything slower, launch it with `Start-Process -WindowStyle Hidden` writing
  to a log and a done-flag, then poll the flag.
- **`timeout /t N /nobreak >nul` fails under the bridge** ("redirection not
  supported") and can swallow the rest of the chain. Don't sleep in a chain.

### The harness

- **`py _jscheck.py <probe>.js` BEFORE debugging a probe.** A syntax error
  makes the script tag never run, so nothing posts and the harness says only
  `NO PROBE OUTPUT (timed out)` — which reads exactly like a hang.
- **A patch script's anchor must be UNIQUE**, and **an anchor in a HARNESS
  goes stale when the app line it quotes is edited.** Two anchors in
  `_mktexbroken.py` stopped applying at v2.35 and nobody noticed until v2.36
  ran the whole suite. **Run the whole broken-build suite after a refactor,
  not only the sections you touched.**
- `_runprobes.py <dir> 0 31` runs the older suites in ~2min. `_cmp.py <a> <b>`
  writes `_cmp_out.txt`. Neither prints to stdout.
- **`_prof_probe.py` instruments a COPY of index.html in memory**, and can
  re-inject the `computeVertexNormals` call a2.83 deleted so its cost is
  readable in one run.
- **`_race_probe.py`** injects the OLD implementation into a copy beside the
  new one, times both in one page, and compares output element by element. It
  carries a `THROW_LEVER` so a failure path can be forced **without any test
  hook in the shipped file**.
- **`_fan_probe.py`** counts, per attribute vertex, every way out of
  `applyShading`'s write loop.
- **`_norm_probe.py`** builds 20 models under `git show HEAD:index.html` and
  under the working copy and diffs a digest of every normal.
- **`_impcheck.py`** settles "did my change break import, or is it the CDN?"
- Newer suites, each with its own runner and its own broken-build maker:
  `_texchk` (textures, 23 sections), `_projchk` (named saves, 9),
  `_opchk` (the command layer, 8), `_nmapchk` (normal-map composition),
  `_heavychk` (the stage-2 measurement), `_wbev_probe` (bevel).
- Three older probe lines flake: `_perf`'s `slider_coalescing`, `_theme`'s
  `8.palette`, and `_imp_probe` losing its CDN fetch.

### The app, from a probe

- **`?debug=1` is the only way to reach `window.__kubik`.**
- **`PRIM_SPECS[kind].def` fields are `h`, `v`, `x`/`y`/`z`.** A cylinder needs
  `v >= 2` to have any interior ring. Kinds: cube, cylinder, sphere, torus,
  plane. **A cylinder's radial parameter is `h`, not `radialSegments`.**
- **Building a fixture no primitive makes:** `createObjectFromEditable(name,
  position, {positions, groups}, mats, smoothGroups)` — `groups` is
  `[{triangles: [[a,b,c], ...]}]`, `mats` from `makeMaterialSet(n)`.
- **`createPrimitiveObject(kind, def, name, position)`** — name is THIRD.
- **Driving the op bar:** any `*Selection()` then `setPendingAmount`,
  `stepSegments`, `refreshOpGrouping`, `refreshOpAmountVisibility`,
  `flushPendingApply`, `confirmPendingOp` / `cancelPendingOp` — all exported.
  `A.selectedElements` is a Set of plain indices for the current mode.
- **`applyPendingOp` does NOT commit.** It changes the mesh and leaves the op
  open, and the next `beginPendingOp` restores its snapshot first. A probe
  measuring a second op without confirming the first measures the first being
  rolled back. Commit with the real button: `opOk.click()`.
- **`clearScene` removes objects, not DEFINITIONS.** A fixture built on "the
  first definition with maps" sits on something nothing wears.
- **A section that builds its fixture outside the history cannot ask the
  history about it** — building a cube writes no step.
- **`auditWinding(obj)`** returns `{boundary, reversed, conflictEdges,
  nonManifold, ok}` — assert it after any op that builds a closed shell.
- **`Subdivide` is an OBJECT-mode op** and takes `selectedObjectIds`.

### The model

- **`logicalPos` reads LOCAL coordinates**, and `computeLogicalOf` rounds
  those — `mesh.scale` affects neither welding nor any local measurement.
- **Three different meanings of "the same vertex":** same position, same
  logical vertex, same ATTRIBUTE index. `separateGroupVertices` gives every
  face group private copies.
- **Union-find nodes in `applyShading` are FACE GROUPS, not triangles.**
- **A position-keyed mark (`creases`, `edgeShade`) does not follow moved
  geometry** unless something re-keys it — `moveMarkKeys` (matrix, a2.78) or
  `remapMarksByPoint` (point to point, a2.79).
- **An op that REPLACES the material array must `binMaterials` the outgoing
  one.** Appending ops do not.
- **An option may carry its own slider range** (`activeRange` /
  `applyOptionRange`). Every clamp must ask `activeRange`, and the value
  readout takes its DECIMALS from the active step.
- **`edgeKey` is a `const` arrow, not a `function`.**
- **`serializeDoc().materialLib` aliases the live definitions** — deep-copy
  before touching anything.
- **`toEditable` takes the MESH; `rebuildFromEditable` takes the OBJECT**, and
  it installs a BRAND NEW `BufferGeometry`.
- **A geometry with more groups than materials crashes three's raycast.**
- **A stored signature is a file format.** `srcSig` is persisted, so changing
  what `materialDefSig` produces leaves every saved material unable to match
  itself. `migrateSig()` restates an old signature on every path one arrives
  by. **Any future change to the signature has to do the same.**
- **A material definition is copied by hand in THREE places** (`materialDefSig`,
  the preset overrides in `saveMaterialLibrary`, the `+` button in the tray).
  A field added to fewer than three is lost in the one that was missed.
- **Key presence is the switch; absent is not false** in `materialDefSig`.
  Adding an always-present key moves every old material's signature. This
  trap has now been hit three times (`envMapIntensity`, masks, `maps`).
- **The material pool key is `id | side | nouv | own`**, and `nouv` must sit
  BEFORE `own`: `disposeObject` retires private instances by SUFFIX.
- **`finishSceneEdit` / `finishMeshEdit` / `finishObjectGone` are the three
  endings of an immediate edit**, and the only place `pushHistory` is called
  on that path apart from `runMirrored`.
