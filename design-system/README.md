# Kubik design system

The visual vocabulary of **Kubik** — a browser-based low-poly 3D mesh editor
that ships as one self-contained HTML file. Live: https://zeghreit.github.io/kubik/

This folder exists so Claude Design (and anyone else) can work on Kubik's
visuals without guessing. Everything here is lifted from the app's real CSS,
not redrawn from screenshots.

## The rules

- **Zero radius.** `--r-sm`, `--r-md`, `--r-pill` are all `0`. Nothing in
  Kubik is rounded. Ever.
- **2px rules do the organising.** `--rule: 2px`. Borders separate things;
  shadows and cards do not.
- **One control size.** 44px is the standard target, 34px for `.small`.
  Nothing that a thumb must hit is smaller than 44px.
- **The accent IS the mode.** Object is neutral `#d5dce4`; Vertex `#d9ff3d`,
  Edge `#46e1ff`, Face `#b48cff`. Colour only appears once something is being
  edited. `--accent` is gated on a selection existing; `--accent-mode` always
  reflects the current mode.
- **Signal orange `#ff5230`** means commit / danger / hazard, and is the only
  hue that is not a mode.
- **Archivo** for everything, weights up to 800, uppercase with wide letter
  spacing for labels. `--mono` for every numeric readout.
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
