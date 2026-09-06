# Brief for Claude Design — push Kubik further, same direction

Paste everything below the line into Claude Design with `design-system/`
attached. Edit the weak-points list as the app changes; it is the part that
goes stale fastest.

---

You have Kubik's design system attached — `tokens.css`, `components/`,
`screens/`. Read it before anything else; everything below assumes it.

Kubik is a browser-based low-poly 3D mesh editor that ships as one
self-contained HTML file. It is operated one-handed on a phone as much as on
a desktop. The viewport is the hero: chrome floats at the edges, over the
model, and gets out of the way.

I want this interface pushed further in the direction it already has — not
redirected. These are settled, and every move has to survive them:

- Radius 0 everywhere. Nothing is ever rounded.
- 2px rules do the organising. No cards, no shadows used as structure.
- 44px minimum target, 34px for small. A thumb operates this.
- The accent IS the mode — Object neutral `#d5dce4`, Vertex `#d9ff3d`, Edge
  `#46e1ff`, Face `#b48cff`. Colour appears only once something is being edited.
- Signal orange `#ff5230` means commit, danger, hazard. It is never a mode.
- Archivo up to 800; uppercase with wide tracking for labels; mono for every
  number.
- No gizmo. No top bar. No rounded floating cards. No icons inside ring seats
  (they carry words). No fake phone status bar.
- This is a restyle, not a feature pass. Do not add controls, sections or
  copy. The control count stays as it is.

What I think is weak. Attack these — and tell me plainly if you think I am
wrong about one:

1. Everything is one rule weight and one border colour, so nothing recedes.
   There is no quiet layer.
2. `--bg #0b0d10`, `--panel #14171c` and `--panel2 #1b1f25` sit very close in
   value. The surfaces read as one flat plane while the borders shout.
3. Disabled is a flat 35% opacity — blunt beside the care taken over the
   hatched and hazard states.
4. The 9–10px mono readouts at .12em tracking are at the edge of legibility
   on a phone held at arm's length.
5. The 10px corner cut appears on the mode slab and the rail tabs but is not
   yet a system.
6. At rest the screen is nearly empty and the single hint chip is a plain
   rectangle — and that is the first thing a new person sees.

Give me three options, each pushing a different axis, and name the axis:

- one that changes **only token values** — no new elements. The cheapest to ship.
- one that adds **one hierarchy device**: a second rule weight, a surface
  step, or a spacing rhythm. Pick the one that buys the most.
- one that goes **further than I would**, so I can see what I am leaving on
  the table.

For each option, draw the two screens from `screens/screens.html` at
390×844 — object mode at rest, and vertex mode with the op deck open — plus
one sentence on what it is for and one on what it costs.

Finish with a plain list of every CSS value you changed, in the form
`--panel2: #1b1f25 → #191d24`, grouped by option. That list is what gets
ported into the app, so anything missing from it does not ship.
