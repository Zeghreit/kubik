# v2.0b → v2.3 — the session in one page

Four shipped versions. Full detail lives in `CURRENT_STATE.md`; this is the
index.

| version | what |
|---|---|
| v2.0b / v2.1 / v2.1a | thermals: the distance field, the sleeping loop, the frame cap |
| v2.2 | one rail on the left, named tabs, one rule per cube edge |
| v2.2a | the cube wears the component hues, three pairs |
| v2.2b | Cancel was sitting on the segment stepper's + |
| v2.3 | the cube lights the face you are looking down |

---

## v2.0b / v2.1 / v2.1a — cool running, part two

a2.96 moved "the phone gets hot" from 5–10 minutes to 25–40. This went
further, four ways.

**The one that mattered: the distance field was baking sixty times a second.**
`ensureEdgeField`'s two throttles both test `f` first — deliberately, because
a throttle here may hand back a *stale* field but never *none*.
`rebuildFromEditable` installed a new geometry and disposed the field, and
every op funnels through it once a frame, so `f` was absent on exactly the
path the throttle was written for. The bake behind it is up to 2.5M
`distToSegment` calls plus a 1 MB texture upload, **inside
`renderer.render`**. Measured, 20 frames of an op-slider drag: **20 bakes → 0**
with a finger down, 20 → 3 on a mouse slider.

**The loop sleeps.** a2.46 stopped the app *drawing* when idle; it never
stopped it *waking*. `animate` now schedules its own next tick and
`invalidate()` is the wake. Idle: **1 loop run per second instead of 60**
(`PERF.tick`). Three hardenings from review: the re-arm is in a `finally`,
`cubeAligning` joined `renderWanted`, and `visibilitychange` clears the
`rafPending` latch.

**Half the frames, but late.** A gesture still going after 600 ms is
sustained — a slow orbit, a long drag — which is both where 30 fps is hard to
see and where the heat is. **59.8 fps** inside the window, **30.4** past it.
`schedulePendingApply` got the same cap (v2.1a).

**`LIVE_PIXEL_RATIO` 1.25 → 1.0**, a2.96's first named lever.

Plus: `applyMaskPatch`'s `refresh` stopped building a whole uniform set per
material per slider tick, and `camera.updateMatrixWorld()` before
`flushDirectDrag` — now required, since a capped frame never runs
`renderer.render`.

---

## v2.2 — one rail on the left

Both shelves back on the left; the right edge is the cube's again. **Where the
rail starts is not a chosen number**: the header row is 7..51 and the readout
59..73, so the air between them is 8, and the rail takes the same 8 under the
readout — 73 + 8 = **81**. Materials follows at 185. One shelf at a time.

Each tab carries its own name turned on its side (`writing-mode: vertical-rl`
plus a half turn — **not** `sideways-lr`, still missing from Safari). 64 → 96
tall to fit.

**One rule per edge.** The thick outline was a 5px rect baked into each face
texture, doubled at every visible edge (~4.4 CSS px against the 2px a button
wears), while the `LineSegments` meant to be the outline drew one *device*
pixel. Now a `LineSegments2` at exactly `--rule`, with `polygonOffset` on the
faces so the fat line does not z-fight.

---

## v2.2b — Cancel on the stepper's +

`#opBar button` sets `flex-shrink: 0`, and one ID plus a type beats one ID, so
`#opOk`'s own `flex: 1 1 96px` was overruled on its shrink. The commit group
was stuck at 146px inside about 113, and `justify-content: flex-end` pushed
the overflow out of the **left** edge. Fixed by raising the selector to
`#opBar #opOk`. At 393pt the bar drops from two rows to one.

**It did not reproduce in Chrome** — Chrome honoured the automatic minimum
size and wrapped; Safari shrank the group and overflowed it. The fix does not
depend on that behaviour either way.

**And the `_imp_probe` "CDN flake" was never a CDN race.** No
`--user-data-dir`, so it shared Chrome's default profile; with a Chrome open
the headless run exits in four seconds with an empty DOM. It needs a *fresh*
profile, not a fixed one — a fixed one made the next run open the previous
run's scene out of localStorage. All local probes now take a
`tempfile.mkdtemp()` profile.

---

## v2.3 — the cube lights the face you are looking down

Third try at the cube's colour. a2.107 removed it; v2.2 brought it back as six
tones of the axis triad (the same borrowing in a new coat); v2.2a moved to the
component hues in three pairs, which answered the objection but said something
**static** — a legend on a control nobody reads as a legend.

**The cube already knew something.** Exactly one of its six faces is the one
you are looking down. That one is lit; the other five go dull. It stops being
a chart and becomes a readout.

**And the lit one wears `--accent-mode`** — neutral in Object, acid in Vertex,
cyan in Edge, violet in Face — so the cube joins the rest of the chrome
instead of keeping a private palette. Object mode lands on the near-white
accent, which is the bright grey it wanted to look like anyway, so there is no
special case.

Dull is `#687079`, the midpoint of `--line` and `--text-dim` channel by
channel: 3.35:1 on `--panel2`, the AA floor at 25px/700.

**The cost is on an edge, not the frame.** A colour change is a re-bake, so
`cubeSync` re-bakes only when the facing index changes and `refreshUI`'s
`dataset.mode` block once per mode change. No `m.needsUpdate` (swapping a map
for one of the same kind does not change three's program cache key; setting it
would recompile the cube's shader every flip). `cubeDirty` + `invalidate()`,
or a mode change sits unpainted until the heartbeat — and since v2.1 the loop
is asleep by then.

Measured by `_cubelbl.py`: exactly one face lit in every state, the mode hue
on the lit face for all four modes, each of the six axes lighting its own
face, and the texture objects unchanged across an idle 1.4s.

---

## Probes added this session

All need a real clock and/or a real GPU, so none is in `_runprobes.py` — the
suite runs under SwiftShader with Chrome's virtual clock, where
`requestAnimationFrame` never fires and `performance.now()` reads zero.

- `_field_probe.py [target]` — bakes per frame of an op-slider drag.
- `_loop_probe.py [target]` — idle frames and idle loop runs, the wake, the
  frame cap, the gesture pixel ratio.
- `_traychk.py [target]` — the rail's geometry and the two shelves.
- `_opbarchk.py [target]` — the op bar's row at 430/393/375/360/320.
- `_cubelbl.py [target]` — the cube's lit face and its colour.

## Still on the list

1. **The `#N` program fork.** `applyMaskPatch` appends `'#' + (_maskGen++)`
   when a material returns to a key it already compiled under, and `_maskGen`
   is global, so the suffix is unique per *material*. Painting A → B → A over
   a subdivided object mints one `WebGLProgram` per material — thousands, and
   linking is the expensive half on Apple GPUs.
2. **`renderMatPreviews`** costs N renders and N synchronous `toDataURL`
   readbacks on every material-editor slider release.
3. **`_maskTex` and the preview rig's materials are never pruned** for
   definitions minted by a file open or an import.
4. `backdrop-filter` on the panels over a live canvas, and `antialias: true`
   on the main context.
5. **Re-measure the two remaining "known flakes"** — `_perf_out`'s
   `slider_coalescing` and `_theme_out`'s `8.palette`. Neither has been
   re-checked since the probe profiles were fixed.
