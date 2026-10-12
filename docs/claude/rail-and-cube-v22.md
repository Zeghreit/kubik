# v2.2 — one rail on the left, and the cube gets its colours back

Zeghreit's, all four. Shipped as `639fae2`.

## Both shelves on the left, under the readout

a3.0 6.1 put the material shelf on the **right** edge opposite the outliner,
reasoning that the cube had shrunk to 56 and freed that edge. The cube went
back to 128 at a2.107 and the reasoning went with it — at 128 the right edge
is the cube's, and a shelf opposite it competes with it. Both tabs are on the
left again, as at a2.103.

**Where the rail starts is not a chosen number.** The strip is a 44px row at
7..51 with the tool readout under it at 59..73, so the air between them is 8.
The rail takes the same 8 under the readout: **73 + 8 = 81**. Materials
follows at 81 + 96 + 8 = **185**. Both shelves derive their max height from
their own tab's top plus 80 of clearance, so nothing drifts.

**One shelf at a time** — both trays roll out to the right of their tab, so
two open ones would be two panels over the same strip of viewport. Opening
either closes the other.

## The tabs say what they are

A chevron says "this opens", which — once the two sat one above the other on
one rail — was the one thing you already knew, while "which of these is this"
was the thing you did not. Each tab now carries its own name on its side:
`writing-mode: vertical-rl` plus a half turn, in the readout's mono caps one
step down. **Not `sideways-lr`**: same bottom-to-top line, but still missing
from Safari on the phone this is built for, and a missing writing-mode falls
back to horizontal — in a 26px column, a word broken one letter to a line.
Tab grew 64 → 96 to fit the name.

## Six faces, six colours

a2.107 made the labels grey, arguing that the axis triad means X/Y/Z during a
drag while a face means look-down-this-axis. Reversed by request, and sharper
than what it removed: before a2.107 a *pair* of opposite faces wore one
colour, so the cube said "X" twice and never said which end. Now the colour is
the axis and the **tone is the sign** — positive face the axis hue lifted
toward `--text`, negative face the axis hue itself.

| face | axis | colour |
|---|---|---|
| RIGHT | +X | `#E08A78` |
| LEFT | −X | `#C85A47` |
| TOP | +Y | `#F2DCA6` |
| BTM | −Y | `#E8C87A` |
| FRONT | +Z | `#7FAEDC` |
| BACK | −Z | `#4A82B8` |

`GIZMO_AXES` remains the only place the three base hues are decided. Darkest
of the six is 4.1:1 on `--panel2`, against a 3:1 floor for text this size.

## One rule per edge, at `--rule`

The thick outline was **not** the edge object — it was a 5px rect baked into
each face's texture, and two faces meet at every visible edge, each showing
its own border, so the line read was double what was drawn: ~4.4 CSS px
against the 2px every button outline wears. Meanwhile the `THREE.LineSegments`
meant to be the outline drew one *device* pixel, because WebGL ignores
`LineBasicMaterial.linewidth`.

Baked border removed; edges are a `LineSegments2` with `LineMaterial` at
`linewidth: 2`. Two non-optional details:

- **`resolution` is the cube's canvas, not the viewport's** — a fixed 128px
  square that never resizes, so it is set once and deliberately *not* pushed
  onto `gizmoStrokes`, which `updateStrokeResolution` walks with the
  viewport's size.
- **`polygonOffset` on the faces, not `depthTest: false` on the line.** A fat
  line is a quad straddling the edge; half of it sits on a face at the same
  depth and would z-fight into a dashed rule. Depth testing off instead would
  show the three edges *behind* the cube — a wireframe, not a solid.

## Measured

`_traychk.py` — a real clock, because a `max-height` transition does not run
under Chrome's virtual time, so every screenshot of an open tray is a picture
of its start value:

```
readout   y=59 h=14 bottom=73     gap header->readout = 8
#outTab   x=0 y=81  w=26 h=96     gap readout->outTab = 8
#matTab   x=0 y=185 w=26 h=96
#viewCube x=348 y=71 w=128 h=128
outliner open:  #outTray x=26 y=81  w=232 h=64,  materials closed
materials open: #matTray x=32 y=185 w=96  h=326, 4 cards, outliner closed
```

Suite: 33 of 35 byte-identical to v2.1a. `_perf_out` is the known
`slider_coalescing` flake. `_theme_out`'s twelve lines are all this change,
and two are the probe going **green**: `left_column_depth` read "THE COLUMN
a2.65 REMOVED IS GROWING BACK" before and now reads "the rail: two seats under
the header"; the material tab's `welded` check — written for a left-edge tab —
went from "STILL TWO CHIPS" to "one silhouette". The help card's Materials lead
was corrected with it (it said "flush to the right edge").
