# Design pipeline — Kubik ⇄ Claude Design

Established 2026-09-06. How Kubik's visuals go out to **claude.ai/design**,
get worked on there, and come back into `index.html`.

## The route: design system in the repo

Kubik's repo is public (`github.com/Zeghreit/kubik`), and Claude Design can
attach a design system from a GitHub repo. So the design system lives in the
repo, at `design-system/`:

- `tokens.css` — **generated**, never hand-edited. Every custom property in
  the app, extracted verbatim from `index.html`.
- `_build.py` — regenerates it (`py design-system/_build.py`). Run after any
  change to the app's `:root` block so the folder cannot drift. Prints the
  version it found in the drawer brand line.
- `_check.py` — tag-balance and dead-link check across every preview page.
- `components/` — foundations, controls, chrome, surfaces, icons.
- `screens/screens.html` — 390×844, object at rest and vertex mid-extrude.

Both scripts are `git add -f`'d past the repo's `_*` ignore rule.

Attached at v2.13, commits `3fc6efb` + `061a3d6`.

## The loop

1. **Out** — Claude keeps `design-system/` honest against `index.html`,
   commits, pushes.
2. **In Claude Design** — Zeghreit attaches `github.com/Zeghreit/kubik` as a
   design system, then designs against it. Output comes back in Kubik's own
   vocabulary instead of generic dark-UI defaults.
3. **Back** — he exports the result (HTML / zip, or Handoff to Claude Code)
   and drops it into the kubik folder; Claude reads it with Desktop Commander,
   diffs it against `design-system/`, and lists the changes as concrete CSS
   deltas.
4. **Into the app** — only the accepted deltas are patched into `index.html`
   with a Python patch script + `py _verify.py index.html`. Letter version for
   a pure restyle (2.13 → 2.13a).

## Rules

- **Token changes are the ones worth porting.** `--accent`, `--panel2`,
  `--line`, `--signal`, `--text-dim` move the whole app at once. Per-element
  edits are worth porting only when that element is genuinely wrong.
- **The design system is a picture of the app, not a source that compiles
  into it.** Nothing crosses back automatically.
- **Known stand-ins — never port from these:** the 3D viewport, the view
  cube, the hub glyph in Object mode, and the tool-ring bloom geometry are
  runtime-drawn; in `screens/` they are static placeholders.
- On this machine Python is `py`, not `python`.

## Also live

Editable canvas of the same two screens (Claude Design preview inside Claude
Code, not the Design section):
https://claude.ai/code/artifact/aa0d5063-d941-4182-b0f3-63b01c766590 —
working files were in the session container and are gone with it; re-extract
from the artifact if it needs updating.

Earlier screenshot-based exploration canvas (four turns, 2026-09-03):
https://claude.ai/code/artifact/0fc45564-558a-46b7-8509-344684d96e7d —
full text in `claude/design-canvas-notes.md`.
