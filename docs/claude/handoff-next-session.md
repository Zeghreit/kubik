# Handoff — NEXT: v3.14a continues with (a) 1, 2, 4 (the CSG/weld family - fable review of CSG -> weld -> heal first), or (b) the Dynamic booleans design talk. Last shipped: v3.14a Quads may not move volume.

Live: https://zeghreit.github.io/kubik/ · repo `C:\Users\a.bodrov\Projects\kubik` · the project now runs in Claude Code on the PC (rules: `CLAUDE.md`).
Read `CURRENT_STATE.md` first — its last section (v3.14) is the truth for Punch now. Client reference: `EMBED.md` in the repo root.
Standing constraint: **UV transform stays 2D-only.**

**PC BENCH WORKS** (12.10): `py _clean_probe.py <probe>.js out.txt` runs the cloud probes too — headless Chrome, CDN live. `PROBE_TIMEOUT=<s>` (default 120), `PROBE_PORT=<n>` (own port and page, so two runs can share the PC). Only `/result`, `/report`, `/done` end a run; any other POST path is a progress line. Long runs with `run_in_background`.
**`.gitignore` has `_*`** — a new probe needs `git add -f`.

## v3.14 — shipped (12.10)
Arrays (line / ring) + mirror + rounded-square cutter, a second "Pattern" page on the Punch bar; the op bar's readout made visible on a phone (it was 0 px wide beside Punch's slider since v3.12), and Punch's readout now says "N open edges" before OK. All in `CURRENT_STATE.md` → "Punch patterns and a rounded square (v3.14)". Verified: `_punchchk` 86/86, `_punchperf` ALL PASS, `_boolchk` PASS, `_opbarchk` no overlaps 320–430 px, fable review of the placement (3 fixed, 1 made visible, 4 limits written down), opus review of the bar and failure paths (1 bug fixed: a refused build wiped Generate's layout). Below 520 px Lathe and Tube now put their slider on its own line (it used to run off the screen) - 48 px taller bar, worth a look on the phone. Waiting for Zeghreit's feel on the phone: is the Pattern page findable, are the default count 6 / gap 50% right, does the outline on the far side of a ring (drawn on top, like v3.12's) read as help or clutter, and is the extra readout line under the slider worth its 13 px.

## (a) v3.14a candidates — measured, with repro probes
1. **4+ holes through one flat face come back open in N-gon / Tris / Loops** — the plain Boolean too (`_holeschk.js`: bar with 4 cylinders 24 open edges, 8 → 86, 12 → 164; Quads closes to 8, 6 open at 12). Suspect `topoBridge` (or the fall-back merge after it gives up) on faces with several holes. A line of holes makes this the common case.
2. **3+ through-bores crossing inside a solid** (ring of holes through a solid can) — raw three-bvh-csg output closed, the 1e-4 GRID weld + heal in `editableFromCSGResult` open it (`_crosschk.js`: 22 / 293 vertex pairs within 3.5e-4 left apart; a tolerance weld cut 66 open edges to 14, not to 0). Same family as the dense-sphere loose end below — a fable review of CSG → weld → heal is the right first step.
3. ~~Quads on a faceted wall moves volume~~ — FIXED v3.14a (per-piece volume guard, `CURRENT_STATE.md` → "Quads may not move volume"). The "Ring ×6 opens the shell" half did not reproduce on the cloud bench. New sighting: a ring of bosses/dents tapped near the middle of a box's top face is open in EVERY topology (N-gon b18) — belongs to 1/4.
4. Copies whose walls nearly touch (0.9–1.1 × size apart) open now and then; ragged band (numbers in CURRENT_STATE).

## (b) Dynamic booleans (design talk first, no code)
Idea from chat: the cutter stays a separate object linked to its target; grab it with a finger and move → outline/ghost follows live, release → target recomputes (the same live / commit-on-release pattern v3.13a added for the slider). No gizmo. Open questions: where the link lives (save/load/undo), what the cutter looks like in the scene (ghost?), when and how to bake, what Undo steps, cost on a phone (one CSG per release is fine, per move is not), chains of several cutters — and now patterns: is a pattern one linked cutter or N.

## Next / open (after the above)
1. Zeghreit's verdict on Punch feel: tap/slide, default size, depth as %.
2. **Punch on a dense UV sphere gives an open / multi-shell result at 94 of 150 sizes** (already in N-gon → CSG + heal on curved high-density targets). See (a) 2.
3. Remaining slow builds ~1.5–2 s desktop on huge holes — on a phone a few seconds. If it bites: a busy indicator or a smaller budget.
4. Quads var 1 is not the best layout on a punched cube (40q/32t vs 64q via Generate).
5. Cutting with a curve (planned after v3.14, its own version).
6. Declarative select: `select: { mode, where: { normal, angle } | { box } | { side } }` + grow / shrink / loop; answer `{ count, ids, bounds }`.
7. Plain-editor FBX bug (v3.10): `importFbxBuffer` releases the parse before landImport — no FBX map reaches a material.
8. Export button writes one primitive per FACE → `compactForExport` for the button too.
9. Heavy-mesh plan toward ~1M faces.
10. Reviews not done: fable on `compactForExport` + `fitDistance`; opus on the v3.11 layer.
11. Small: Extrude via `op` needs `amount`; Clear creases/seams with nothing to clear answer `refused`; UV ring not in `op`.
12. Old opens: `_gpuchk` NO REPORT; `_projchk` 4494kb fixture; glTF clearcoat/sheen; FBX unit scale.
13. From the stage-1 UI report (ui-hybrid): A1–A6 data loss and keyboard, B1 heat, B3 small targets.

## Harnesses
`_punchchk.js` (~2 min), `_punchperf.js` (~5 min), `_boolchk.js`, `_opbarchk.js` — all via `_clean_probe.py` on the PC (or `_cloudprobe.py` in the cloud). Any probe driving `opSlider` must send 'change' after 'input'. Repro: `_holeschk.js`, `_crosschk.js`. PC (untracked): `py -3 _embedchk.py [page]` on localhost:8996; `_opchk.html` → `_opchk_out.txt`.
