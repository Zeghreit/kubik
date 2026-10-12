# Инвентарь пробелов (бывш. next-session-plan)

Переименован 19.09.2026. Очередь работ, которая тут была, мертва — актуальная в `handoff-next-session.md`. Живое в этом файле: раздел про зафиксированные пробелы (инварианты shading, история normals, ufScratch, ограничения Clean up / Slide / Array, picking per-object, region select по facing, стоимость масок) и два неисследованных перф-пункта `2c_windingComponents` и `2e_edgeMaps`. Номера версий и строк внутри — историчны, проект на v2.67.

> **Actualised 17.09.2026.** This file was two things: an a2.83-era queue, and
> the project's accumulated method notes bolted underneath. The queue is spent.
> The notes are the most-reused reference in the doc set, so they moved to
> **`claude/method-and-tooling.md`** — go there for the lessons, the shell
> traps, the harness recipes and the model invariants.
>
> Where the queue lives now:
> - **`claude/uv-commands-maps-plan.md`** — the live plan (stages 0–4, UV and
>   the command layer).
> - **`CURRENT_STATE.md` § Loose ends** — everything recorded as unfinished
>   across all 61 docs, gathered in one place on 17.09.2026.

## What the queue said, and what happened to it

1. ~~**Fillet's replacement.**~~ Still unbuilt, but the premise is gone: seat 1
   of the Object ring was taken by **Array** (corrected at v2.13), and the
   whole ring UI was replaced at a2.97–a2.108 — icons became **words on
   seats**. What survives of the entry is the PAIRING: whatever replaces
   Fillet wants to sit one ring over from Bevel, wherever that turns out to
   be. Do not rebuild the old live preview — see the do-not-rebuild list.
2. **`2c_windingComponents`** — 8–16% of `applyShading` at mid sizes,
   **18–19% at 49k triangles**, and its share grows with the model. **Still
   never examined.** Method: write the rewrite twice, race both in one run on
   the same geometry, assert bit-identical output, all before touching the
   app — `_race_probe.py` is a working template.
3. **`2e_edgeMaps`** — was the single largest sub-phase (16–29% of a shade)
   even after a2.77 halved it. Worth a second look. **These percentages are
   a2.83 measurements; the file has grown ~4,000 lines since.** The doc's own
   rule applies to itself: a note is not a measurement, and an old note is not
   even a hypothesis. Re-measure before believing either of these.
4. ~~**The tool ring and ring label get the surfacing transition.**~~ Blocked
   then on a real-device frame measurement, and still is. Same blocker as
   stage 2 of the UV plan: the phone has to answer.
5. ~~**Booleans.**~~ **SHIPPED at v2.13.**

## The gaps it recorded, still worth having

Most of these remain true. The ones that turned out to be real bugs have been
promoted into `CURRENT_STATE.md § Loose ends`; these are the ones that are
limits rather than defects.

- **Shading:** the degenerate-fan fallback leans on an invariant nothing else
  depends on — **a face group is exactly one face**. `buildShadingTopo`
  synthesises a single group spanning the whole mesh when `geo.groups` is
  empty, and a closed shell's every-triangle sum is zero, so such a geometry
  would fall through to a scan-order answer. Nothing reaches `applyShading`
  that way today. Same for `groupOfAttr`, last-triangle-wins and unambiguous
  only because `separateGroupVertices` splits attribute vertices per group.
- **Shading:** a vertex the write loop declines to write keeps the PREVIOUS
  frame's normal rather than a freshly computed baseline. Better looking, but
  history-dependent — a harness built on fresh geometries would not catch it.
- **Shading:** the union-find stamp counter resets past 2^31 by re-filling the
  stamp arrays with −1; correct, but a pause, not free. `ufScratch` grows and
  never shrinks, so one very large model holds its arrays for the session.
- **Clean up:** Tris to quads only pairs SINGLE triangles — a quad or n-gon is
  a statement somebody made and is left alone. It refuses pairs across
  differing `finishes`, differing smooth flags, and any edge not used by
  exactly two faces. Merge by distance can leave a zero-area triangle if two
  corners land in different clusters whose centroids fall inside the 1e-4 weld
  tolerance; contrived.
- **Slide:** islands are aligned by their MEAN direction, right when the loops
  are roughly parallel and a guess otherwise. `ring: 0|1` in the tool tables is
  dead metadata — `toolRingAngles` sorts by `seat` alone.
- **Array** is single-object and refuses a count of 1, a ring whose centre is
  inside the shape, and a ring under uneven scale.
- **Picking is per-object.** With cube B in front of cube A, tapping A's
  vertex through B still selects it.
- **Region select filters by FACING, not occlusion** (a2.76, on purpose) —
  which is why it takes the back half of a cylinder.
- **`shadingTopoFor` caches only while a direct drag runs.**
- **Enabling a mask on a material worn by N objects costs N full shades** in
  that tap.
- **Imports:** the material budget is per-import, not per-library, and undo
  does not remove a minted entry; a non-planar quad from an .obj is one face
  whose diagonal cannot be creased; a multi-solid ASCII .stl lands as one
  welded object. (The "textures/emissive/opacity dropped, no UVs" line that
  used to be here is **dead** — v2.28 gave the app UVs and v2.33 gave the
  importers maps.)

## Shipped, for the record (2026-08-31 → 09-02)

a2.65–a2.67 the chrome pass, first run, accent rule · a2.68–a2.71 import ·
a2.72 picking · a2.73 surfacing · a2.74 performance measured (both standing
perf notes were wrong) · a2.75 the wear-edge pass runs only for objects that
use it · a2.76 box select respects visibility · a2.77 the topology build,
**20% off every operation** · a2.78 Array · a2.79 Solidify · a2.80 Slide ·
a2.81 Clean up · a2.82 the shading union-find, **43% off the phase**,
bit-identical output · a2.83 the baseline shade deleted, **15% off every
shade**.
