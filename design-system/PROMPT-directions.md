# Brief for Claude Design — three restylings, three approaches

The exploratory counterpart to `PROMPT.md`. That one pushes the current look
further; this one asks what else Kubik could be, without touching how it works.

---

You have Kubik's design system attached — `tokens.css`, `components/`,
`screens/`. Read it before anything else.

Kubik is a browser-based low-poly 3D mesh editor in a single HTML file,
operated one-handed on a phone as much as on a desktop. The viewport is the
hero: chrome floats at the edges, over the model, and gets out of the way.
Today it is near-black, zero radius, 2px rules everywhere, mono readouts,
hazard stripes, diamonds, Archivo.

I am **not** asking you to improve that look. I want three genuinely different
restylings of the same app, each built on its own organising principle, so I
can see what else this could be.

**Fixed — this is the app, not the style. Every option keeps it:**

- Same screens, same controls, same positions, same count. Nothing added,
  nothing removed, nothing moved to another corner.
- 44px minimum target, 34px small. A thumb operates this.
- The accent IS the mode: Object, Vertex, Edge and Face each get one hue, and
  colour appears only once something is being edited. You may repick the four
  hues. You may not break the rule.
- One colour reserved for commit / danger / hazard, never used as a mode.
- Dark ground. The model is the subject and needs it.
- No gizmo. No top bar. No fake phone status bar. No icons inside the ring
  seats — they carry words.

**Open — everything else.** Palette, type, rule weights, borders or no
borders, texture, silhouette motifs, density, radius, the lot.

Three options, each on a different way of organising the screen. Start from
these unless you can name a better one:

- **A · Surface** — hierarchy from value steps between surfaces. Borders
  mostly disappear; things sit at different depths. Quiet, deep, the model
  floats.
- **B · Type** — hierarchy from labels, numbers and spacing. Almost no chrome
  at all: the most viewport, and the most severe.
- **C · Material** — hierarchy from texture. Take the hazard stripes,
  hatching and cut corners that already exist and make them the whole system:
  a printed instrument. Physical, loud.

Rules for the set:

- Commit to each one. If two could be mistaken for each other you have
  failed — five shades of one aesthetic is not three options.
- Give each a name, a one-line thesis, and an honest cost: what it gives up.
  Make the case for the ones you like least, too.
- No gradient wash backgrounds, no glassmorphism, no emoji, no soft rounded
  cards with a coloured left border. If it looks like every other AI dark UI,
  start again.

For each option, draw the two screens from `screens/screens.html` at 390×844
— object mode at rest, and vertex mode with the op deck open. Same content in
all six frames, so I can compare like for like.

Finish with a plain list of every CSS value each option sets, in the form
`--panel2: #1b1f25 → #191d24`, grouped by option, so whichever one I pick can
be ported into the app.
