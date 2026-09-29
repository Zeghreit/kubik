# Kubik design system

The visual vocabulary of **Kubik** — a browser-based low-poly 3D mesh editor
that ships as one self-contained HTML file. Live: https://zeghreit.github.io/kubik/

This folder exists so Claude Design (and anyone else) can work on Kubik's
visuals without guessing. Everything here is lifted from the app's real CSS,
not redrawn from screenshots.

## The rules

- **Zero radius.** `--r-sm`, `--r-md`, `--r-pill` are all `0`. Nothing in
  Kubik is rounded. Ever.
- **Plates over the model (the hybrid, v2.79-v2.86).** Floating chrome is
  glass: `--glass` (the panel at 56%) over a `--glass-blur` of the scene,
  with a `--hair` edge and a `--glass-hi` line along the top. Anything read
  for a while - trays, decks, drawer, help - is `--glass-thick` (86%).
  `html.lite` (the drawer's Glass switch) makes every plate solid and drops
  the blur; it is the setting for a phone that runs warm.
- **1px rules.** `--rule: 1px` since v2.79; the colour is unchanged. Plates
  separate things by tone, the rule only finishes the edge.
- **One cut.** Every plate and every control 30px or taller loses its
  bottom-right corner by `--ch` (10px): one size, one corner, everywhere,
  so a row of them keeps its rhythm. `--cut` is the clip; `--cut-line` is a
  background layer that draws the rule along the cut. State rules set
  `background-color`, never the `background` shorthand, which would wipe it.
- **Lit underline = on.** A chosen thing lights an edge in the mode's hue:
  the symmetry axes (bottom), the rail tabs (right edge), the op deck's
  chips (bottom), the selected outliner row (left edge), section titles in
  the drawer (a short bar).
- **One control size.** 44px is the standard target, 34px for `.small`.
  Nothing that a thumb must hit is smaller than 44px.
- **The accent IS the mode.** Object is neutral `#d5dce4`; Vertex `#d9ff3d`,
  Edge `#46e1ff`, Face `#b48cff`. Colour only appears once something is being
  edited. `--accent` is gated on a selection existing; `--accent-mode` always
  reflects the current mode.
- **Signal orange `#ff5230`** means commit / danger / hazard, and is the only
  hue that is not a mode.
- **Archivo** for everything you press, with its width axis embedded
  (62-125%): the display voice - the mode word, the op numeral, deck names -
  is Archivo at 125%. **Geist Mono** (`--mono`, embedded) for every readout
  and caption. Micro captions (SYM under the axes, UNDO/REDO, the rail's
  01/02) are 9px mono caps and only ever repeat what the control already
  says.
- **Depth.** A sheet (drawer, help) pushes the scene back to 94%; while the
  camera turns, the header, rail and bottom row drift up to 6px against it
  and ease home. Motion is transform and opacity only - no `filter: blur`
  in any animation.
- **The viewport is the hero.** Chrome floats over it at the edges and gets
  out of the way; there is no top bar and no gizmo.

## What's in here

- `tokens.css` — **generated**, never hand-edited. Every custom property in
  the app, extracted verbatim from `index.html`.
- `_build.py` — regenerates `tokens.css`. Run `py design-system/_build.py`
  after any change to the app's `:root` block, so this folder cannot drift.
- `components/` — the control families, each a standalone page that links
  `tokens.css` and uses the real values.
- `screens/` — the whole interface at phone size: at rest, and mid-operation.
- `directions/` — the redesign's exploration: static mockups A-L and, in
  `proto/kubik-ui-lab.html`, a live three.js prototype of every direction
  including N · Гибрид, the one that shipped as v2.79-v2.86.

Open any file directly in a browser; there is no build step.

## Using this with Claude Design

Attach `github.com/Zeghreit/kubik` as a design system, then design against it.
Anything Claude Design produces will come out in Kubik's own vocabulary
instead of generic dark-UI defaults.

To bring a result back into the app: export the design as HTML (or hand it
off to Claude Code), and the changed values get ported into `index.html` by
hand — the design system is a picture of the app, not a source of truth that
compiles into it. Token changes are the ones worth porting; they move
everything at once.

## Not in here

The 3D viewport itself, the view cube and the tool-ring bloom geometry are
runtime-drawn (three.js and JS-positioned seats). Where they appear in
`screens/`, they are static stand-ins — do not treat them as spec.
