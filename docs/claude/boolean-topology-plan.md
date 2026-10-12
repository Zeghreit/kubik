# Boolean topology — plan (26.09.2026, after v2.77; revised 29.09 after v2.81)

The why and the what. How the code works now lives in CURRENT_STATE,
"Topology after a boolean (2.78)", "Topology types and Generate (2.79)",
"Quads along the cut (2.80)" and "Loops along the cut (2.81)".

## Zeghreit's brief (26.09, refined the same day)

- **Booleans only for now.** The Boolean bar gets a topology menu:
  - chips for the **topology type**;
  - a **Generate** button that cycles through generation variants for the
    chosen type;
  - you pick the one you like before ✓.
- **Going back is Undo**, through the bar's own step stack. No second button.
- **The separate op is deferred.** It will be called **Retopo** and will reuse
  the same algorithms, so they are **pure functions, independent of the
  boolean**: (mesh, region) → new connectivity (and, from v2.80, new points).

## DECISION 29.09 (Zeghreit): curved walls too

> "и кривые тоже — органично сшивать при объединении и пересчитывать
> геометрию в новых зонах при разнице и вычитании, адаптируя к геометрии,
> которая остаётся от оригинала"

So the types are no longer flat-only connectivity games. Along the cut they
**rebuild the band of geometry**:
- **Union:** stitch the two inputs organically — the seam gets flow from both
  sides instead of a ring of slivers.
- **Difference / Intersect:** remesh the new zones (the cutter's imprint, the
  hole walls, the rim) so their edge flow and density continue what is left
  of the original.

### The invariant changes (v2.80+)

v2.78–2.79 promised "no vertex moves, none is added". Quads and Loops break
that on purpose. The promise (measured by `_topo280fx.mjs` and
`_topo281fx.mjs` on every seed):
1. **Outside the band nothing moves** — same positions, same faces.
2. **The band's boundary is the original's own vertices.**
3. **New points lie on the surfaces they came from** — mapped back through
   the source triangle they land in (flat map). The cut only gains points ON
   its edges.
4. **Measured, not argued:** closed and wound, no more open/doubled edges than
   the evaluator's own result, no face folded against its source surface, a
   face's middle within 0.2 of its edge from the surface.
5. **Never worse than N-gon:** a piece that can't be rebuilt cleanly stays
   exactly as N-gon made it.

N-gon and Tris (v2.79) keep the old invariant and stay as the "exact" types.

### The band (as shipped, v2.80a)

Per side: the host (bigger surface) = faces carrying a seam vertex plus one
more ring; the smaller input by default = none, kept exactly as cut
(**DECISION 29.09, Zeghreit**, from a 3-way picture). Never across a crease
over 40°; graze growth; islands of ≤ 6 faces join.

## Topology types (chips) × variants (Generate)

1. **N-gon** (v2.78, default). Exact; flat patches only.
2. **Tris** (v2.79). Exact; flat patches only.
3. **Quads** (v2.80/a, shipped). "Rings around the hole".
4. **Loops** (v2.81, shipped). **DECISION 29.09 (Zeghreit): "the body's grid
   carried to the hole".** No concentric rings around the cut: the body's
   edges arriving at the band continue straight to the cut; 3:1 / 2:1 steps
   sit in the row against the cut. **DECISION 29.09 (Zeghreit, from the
   3-way picture): "норм, оставляем"** — a second row is allowed where one
   row folds (his model: body 3× sparser than the ball). Smaller input always
   kept as cut. Variants: band width (two rings / one), one more row, spoke
   rank (12).

## Versions

- **v2.78:** `topoPatches` + N-gon (shipped).
- **v2.79:** chips, Generate, Tris, hash, undo (shipped).
- **v2.80:** Quads (`9b657f5`); **v2.80a** (`d3f4dcb`) smaller input kept.
- **v2.81:** Loops (`c42feb7`).
- **Later:** Retopo as a separate op on the same functions (`topoQuads` takes
  positions + faces + seam + owner, no App; `opt.loops` for Loops).

## Open

- Zeghreit's verdict on Quads and Loops in the app (only pictures so far).
- A cutter much denser than the host makes the host band busy.
- A cutter as thick as a limb: falls back (both types).
- Which side "yields" is picked by surface area; a chip only if he asks.
- UVs/seams through the band: still dropped, as every boolean today.
