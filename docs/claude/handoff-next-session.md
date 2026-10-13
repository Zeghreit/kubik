# Handoff — NEXT (Zeghreit's order 12.10): 5 done (v3.14c), 2 done (v3.16 Cut with curve: Knife / Split) -> 3 boolean residue -> 6 heavy-mesh plan. Then: Punch shapes from a curve (inside Punch). Last shipped: v3.16a Punch multi-material fix; v3.16 Cut with curve; before it v3.15 embed `export obj` (for AF) + .obj/.stl buttons export objects where they stand.

Live: https://zeghreit.github.io/kubik/ · repo `C:\Users\a.bodrov\Projects\kubik` · the project now runs in Claude Code on the PC (rules: `CLAUDE.md`).
Read `CURRENT_STATE.md` first — its last section (v3.14) is the truth for Punch now. Client reference: `EMBED.md` in the repo root.
Standing constraint: **UV transform stays 2D-only.**

**PC BENCH WORKS** (12.10): `py _clean_probe.py <probe>.js out.txt` runs the cloud probes too — headless Chrome, CDN live. `PROBE_TIMEOUT=<s>` (default 120), `PROBE_PORT=<n>` (own port and page, so two runs can share the PC). Only `/result`, `/report`, `/done` end a run; any other POST path is a progress line. Long runs with `run_in_background`.
**`.gitignore` has `_*`** — a new probe needs `git add -f`.

## v3.15 — shipped (13.10)
Embed `export {format:'obj'}` for AF's `af_to_obj` (FBX -> OBJ for Mixamo; AF switched its preview, mesh gate, map wiring and OBJ steps to Kubik by default). One `objText` for the button and embed. Found on the way and fixed for the buttons too: OBJExporter/STLExporter read `matrixWorld`, which buildExportGroup's new meshes never had updated - a moved/turned/scaled object's .obj and .stl came out where it was made. V by source in embed: FBX/OBJ meshes keep their UVs, the rest get 1 - v. Verified: `_objchk.html` 11/11 (`py -3 _embedchk.py _objchk.html`), `_embedchk` regression, and AF against Blender on five Tripo FBX (vertices, UVs, shells, bbox identical). All in `CURRENT_STATE.md` -> "Export .obj for a host (v3.15)". Loose end there: the BUTTON still turns V over on FBX imports (needs the source format kept per object).

## v3.14 — shipped (12.10)
Arrays (line / ring) + mirror + rounded-square cutter, a second "Pattern" page on the Punch bar; the op bar's readout made visible on a phone (it was 0 px wide beside Punch's slider since v3.12), and Punch's readout now says "N open edges" before OK. All in `CURRENT_STATE.md` → "Punch patterns and a rounded square (v3.14)". Verified: `_punchchk` 86/86, `_punchperf` ALL PASS, `_boolchk` PASS, `_opbarchk` no overlaps 320–430 px, fable review of the placement (3 fixed, 1 made visible, 4 limits written down), opus review of the bar and failure paths (1 bug fixed: a refused build wiped Generate's layout). Below 520 px Lathe and Tube now put their slider on its own line (it used to run off the screen) - 48 px taller bar, worth a look on the phone. Waiting for Zeghreit's feel on the phone: is the Pattern page findable, are the default count 6 / gap 50% right, does the outline on the far side of a ring (drawn on top, like v3.12's) read as help or clutter, and is the extra readout line under the slider worth its 13 px.

## (a) v3.14a candidates — measured, with repro probes
1. ~~4+ holes through one face open~~ — FIXED v3.14b: a CSG "twin" corner's sliver is collapsed instead of dropped (`CURRENT_STATE.md` → "A sliver's short edge is collapsed"). Also closed the box ring of bosses.
2. 3+ through-bores crossing — mostly FIXED v3.14b; residue `_crosschk` -9/6, -9/8 (4 and 12 open edges, triple crossing). Dense UV sphere sweep now 56/150 open (was 94).
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
7a. Export button .obj of an FBX import is upside down against the FBX pictures (v3.15 loose end; embed is right - needs the source format kept per object).
8. ~~Export button one primitive per face~~ — FIXED v3.14c (compacted + `_KUBIKFACE` face numbers keep the round trip).
9. Heavy-mesh plan toward ~1M faces.
10. Reviews not done: fable on `compactForExport` + `fitDistance`; opus on the v3.11 layer.
11. Small: Extrude via `op` needs `amount`; Clear creases/seams with nothing to clear answer `refused`; UV ring not in `op`.
12. Old opens: `_gpuchk` NO REPORT; `_projchk` 4494kb fixture; glTF clearcoat/sheen; FBX unit scale.
13. From the stage-1 UI report (ui-hybrid): A1–A6 data loss and keyboard, B1 heat, B3 small targets.

## Harnesses
`_punchchk.js` (~2 min), `_punchperf.js` (~5 min), `_boolchk.js`, `_opbarchk.js` — all via `_clean_probe.py` on the PC (or `_cloudprobe.py` in the cloud). Any probe driving `opSlider` must send 'change' after 'input'. Repro: `_holeschk.js`, `_crosschk.js`. PC (untracked): `py -3 _embedchk.py [page]` on localhost:8996; `_opchk.html` → `_opchk_out.txt`.
