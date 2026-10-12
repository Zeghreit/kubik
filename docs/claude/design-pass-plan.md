# Design pass — from the Claude Design canvas to index.html

Canvas: https://claude.ai/code/artifact/0fc45564-558a-46b7-8509-344684d96e7d
(four turns, 40 phone frames, 393×852, read from the published HTML — values
below are the canvas's own, not eyeballed).

## What Zeghreit picked (2026-09-03)

- **Turn 2 (tactical HUD) is the base** — near-black ground, 2px rules,
  bracketed corners, mono telemetry readouts, hazard stripes, oversized
  numerals, zero radius. Of its three intensities, **2b "Hazard"** has the
  **diamond ring** he named specifically.
- **The reddish panels of Turn 1** — the #ff563c-on-dark accent slabs
  (Turn 2 already uses the same accent; 1b's full-bleed red sheet is the
  loudest form of it).
- **Turn 3's colours** — the "extraction-shooter" mode hues: acid
  **#D6FF4A**, cyan **#4EE3FF**, magenta **#FF6FC2**, danger orange
  **#FF4D2E**, on #0B0C0B / #151715 / #1F221F / #2E322E greys, ink #ECEEE6,
  dim #8A8F86.
- "**Marathon** game vibes" — that IS the Turn 2/3 vocabulary: acid signal on
  near-black, hard diagonal cuts, ticks and reticles, dense small caps.

## Token map — canvas → app (`:root` at index.html:39)

| app var | today | proposed | from |
|---|---|---|---|
| `--bg` | #101216 | **#0B0C0B** | t3 ground (t2: #141312) |
| `--panel` | #181b21 | **#141312** | t2 panel |
| `--panel2` | #1f232b | **#201e1d** | t2 raised |
| `--line` | #2a2f3a | **#4a4544** (2px, not hairline) | t2 rule |
| `--text` | #e7e9ee | **#f3f2f2** | t2 ink |
| `--text-dim` | #8d94a3 | **#9b9797** | t2 dim |
| `--accent` (object) | #a8afbd | **#ff563c** red signal *or* stay neutral — decision A | t1/t2 |
| vertex / edge / face | #DDB863 / #6EA6D8 / #E8836C | **#D6FF4A / #4EE3FF / #FF6FC2** | t3 |
| `--danger` | #ff5d5d | **#FF4D2E** + hazard stripe, *or* stripes only — decision B | t3 |
| `--ok` | #46c98a | #D6FF4A (acid = "on") | t3 |
| `--r-sm/-md/-pill` | rounded | **0 / 0 / 0** | all turns |
| font | Noto Sans | **Archivo** 400/600/800 — decision C | all turns |

New tokens: `--rule: 2px`, `--stripe: repeating-linear-gradient(135deg,
#2d2b2b 0 6px, #201e1d 6px 12px)` (t2 hazard), `--mono: ui-monospace,
"SF Mono", Menlo, monospace` for readouts, `--cut: polygon(0 0,100% 0,86%
100%,0 100%)` (t2 diagonal cut).

## Shapes that are code, not tokens

- **Diamond ring (2b).** Seats are DOM nodes placed by angle
  (`toolRingAngles`, ~24002). Change: seat `clip-path: polygon(50% 0,100%
  50%,50% 100%,0 50%)`, 2px rule, word inside; ring lattice as one inline
  SVG behind the seats (t2 draws the four diamonds as
  `polygon(50% 0,100% 25%,50% 50%,0 25%)` quadrants). Keeps a2.72's picking,
  the seat pitch and the hold-aim-lift gesture untouched — geometry is the
  same, only the silhouette changes. The `Deliberately absent` list is not
  touched (no gizmo, no hover states).
- **Op bar** → 2b's op deck: big numeral (`0.42` at ~56px, 800), mono
  caption row (`UP · EACH · SNAP 0.25 · 1 → 5 FACES`), segmented Each /
  Joined as equal cells, CANCEL small-left / APPLY red slab-right with the
  diagonal cut. Same controls, same ids, restyled.
- **Bottom row** (hub / undo / redo / help): mode word in the accent slab
  with the cut edge (2b `FACE.`), undo/redo as one 2-cell block.
- **Hazard stripe band** as the op-bar's top edge and the drawer's header —
  structure, not decoration (2b's rule).
- **Behaviour changes ship separately:** Turn 3's ergonomic proposals (hub to the
  thumb corner, hexagon hub, drag-anywhere amount, help into the drawer).
  Each is a behaviour change with its own version, not a restyle.
- **WebGL stays as is:** vertex dots, Line2 strokes, view cube colours are
  code; the mode hue on the model already follows `--accent-mode` via JS —
  check `SELECT_COLOR` / axis palette still read against the new hues.

## Order of shipping

**Status:** a2.97 shipped 2026-09-03 (`b08537e`). Review findings folded in:
THEME.bg/grid/vert/edge and the view cube's greys moved with the chrome (the
viewport would otherwise have stayed blue-grey); `.hub-item.on` ring 2→4px;
hover/press greys warmed; cube labels re-baked after `document.fonts.load`;
mode dims raised to ≥1.3:1 vs `--panel2`; `--ok` deleted. Screenshots:
`_uishot97.py`. **a2.98 shipped** (`c33fa3f`): diamond seats, striped Delete, dead-zone
reticle + aim line at the aim point, uppercase label with vertical clamp.
**a2.99 shipped** (`8b52dfd`): full-width deck with hazard band, numeral + caps
name + diamond-knob slider on one row, Cancel+Apply grouped (`#opCommit`),
hub cut corner, Undo/Redo block, mono tool readout, geoBar matched. Rows
live in the MARKUP (`#opHead`/`#opCells`) - the flex-`order` version failed
review. **a2.100 shipped** (`8a6806f`): THE HEADER, from Zeghreit's 2c screenshot -
mode slab (cut edge, also cycles the mode), X/Y/Z symmetry cells + menu as
header cells, mono readout under the bar with selection count + object name.
A top bar is back on his direction; it carries the menu, the axes strip and the
readout, so it mostly pays for itself. **a2.101 shipped** (`8c76256`): panels - mono-caps headings, KUBIK. brand,
inspector mode rule, applied material in the signal, no backdrop blur. The
restyle is complete. **a2.102 shipped** (`3d71737`): drag-anywhere amount, with
`_amt_probe` (suite index 31). Decision F resolved 2026-09-03: the header KEEPS the mode (no vertical word);
the left edge becomes the rail for every shelf instead. **a2.103 shipped**
(`fb58df9`): outliner + material tabs stacked on the left, both opening as rows,
right edge free but for the cube; op deck / geo bar / pivot bar sit on the
bottom row. The design pass from the canvas is complete.

1. **a2.97 — tokens.** Palette, 2px rules, zero radius, font. One patch, the
   whole app changes at once, judged on the phone in a day. Contrast checked
   for every text/ground pair (AA), since the acid and cyan need dark text
   on them (`--on-accent` per mode).
2. **a2.98 — the ring** (diamond seats + lattice, both rings).
3. **a2.99 — op bar + bottom row** (numeral, stripes, cut slab).
4. **a2.100 — drawer, inspector, material tray, outliner** in the same
   language (t2's bracketed panels, t3's hexagon material balls if wanted).

Each: `_patch_a2XX.py` → `_verify.py` → probe suite vs previous run →
reviewer → push. `_theme`'s `8.palette` probe line will change on purpose
at step 1 and is re-baselined.

## Decisions (Zeghreit, 2026-09-03)

F. **RESOLVED (a2.103): the spine as a RAIL, not a mode word.** The header
   keeps the mode slab; the left rail carries the outliner and the material
   shelf, the deck sits on the bottom row. Original note: Zeghreit likes 1c's left column: a
   56px rail down the left edge carrying the selected component's name
   VERTICALLY (rotated text - "FACE", "VERTEX"...) with the X / Y / Z axis
   buttons stacked below it. Not part of a2.99-a2.100; it moves the mode
   word and the axis pill off the top-right, which is a layout change with
   its own version (after a2.101) and its own `_uimeasure` pass. Note it
   conflicts with nothing in "Deliberately absent"; it does compete with the
   outliner tab on the left edge - decide who owns that edge first.

A. **Red only for actions.** Object mode stays neutral grey; #ff563c is
   Apply / confirm / New cube / the applied-material mark. Acid / cyan /
   magenta are Vertex / Edge / Face. a2.58's rule holds.
B. **Danger = hazard stripes + orange #FF4D2E** (2b).
C. **Archivo embedded** — latin subset, 400/600/800, base64 woff2 in the
   <style>, ~170 KB. Offline stays true.
D. Dark only.
E. **Scope: restyle + drag-anywhere amount.** The op's amount can be set by
   dragging anywhere on the viewport (the pivot marker's own rule); the
   slider becomes the readout you can also grab. That one is a behaviour
   change and ships as its own version (a2.101) after the restyle, with its
   own probe. Hexagon hub and Help-to-drawer stay out.
G. **The header (2026-09-03, from a screenshot of the canvas's 2c frame).**
   MODE slab left, X/Y/Z cells right, mono readout beneath. Shipped as
   a2.100 - see CURRENT_STATE for what it carries and why a top bar is
   acceptable again.
