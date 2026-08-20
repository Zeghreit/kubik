# Kubik

A fidget for 3D artists.

Kubik is a low-poly mesh editor that runs in a browser tab. It's built to be
used one-handed — drag with a left thumb, tools bloom wherever it's touching,
with an occasional assist from the other hand's index finger — because the
point isn't to finish a model. It's to have something pleasant to turn over
while you think.

No install, no account, no sign-up. Open it and push a cube around.

**[Try it →](https://zeghreit.github.io/kubik/)**

<img src="qr.png" alt="QR code linking to https://zeghreit.github.io/kubik/" width="200">

Scan with a phone camera. It's built for a phone, so that's the way to see it
properly — then **Share → Add to Home Screen** for fullscreen.

---

## The idea

Two rules shape everything here.

**The viewport is the hero.** What's permanently on screen: a menu, the view
cube, Symmetry, a mode button, Undo/Redo and Help. That's it. Everything else
appears under your finger when you ask for it and disappears when you're
done — there's no rail of toggles down either edge.

**There is no gizmo.** You grab what's selected and drag it. No arrows to
hunt for, no handle to miss on a phone screen. The same drag moves, rotates
or scales depending on which tool is live.

## What it does

**Modelling** — extrude, inset, bevel, bridge, connect, weld, split, edge
loops, subdivide, creases, mirror, join. The ops with a value to choose open
a bar with a slider and preview live, so you set the amount by looking at it
rather than by typing a number.

**Selection** — object, vertex, edge and face modes, with multi-select
always on. Box and lasso region select. Double-tap does different useful
things per mode: in Face mode it selects a strip of faces running across the
mesh, in Edge mode the whole edge loop — or, if you tapped another edge in
the last second and a half, the shortest run of edges between the two.

Picking is measured in **screen pixels, not 3D distance**, so whatever looks
nearest your finger is what you get at any zoom. Aim assist eases the camera
in when neighbouring vertices are too crowded to tell apart — after the pick,
so it only ever makes the next tap easier.

**Transforms** — grab and drag. A two-finger tap cycles Move / Rotate /
Scale; a three-finger tap switches Axis and Free. Axis is the default: the
axis is read from the first few pixels of the drag and held until you lift,
so a curving gesture can't wander onto a different one.

**Two rings** — press and hold on your selection and its tools bloom around
your finger, a different set for vertices, edges, faces and objects. Hold on
empty space instead and you get the world ring: Add Cube, see-through, floor
grid, aim assist, snap, and the box/lasso/tap choice. Slide toward one — its
name appears beside it — and lift to run it. The ring picks by direction, so
you never have to land on the icon itself.

## Symmetry

Symmetry is a mode you leave switched on while you work, not a command you
run afterwards, and it's the part with the most thought behind it.

The plane is **captured from the geometry** the moment you switch symmetry
on — the middle of the object's bounding box on the chosen axis — and it
travels with the object. Objects that have drifted away from their own
origin still mirror correctly.

Every component op is mirrored, and *how* depends on the op. Extrude, inset,
bevel, split, crease and delete run **once over the selection plus its
mirror**: because a region's rim is built from edges appearing exactly once,
a face and its mirror that meet at the plane share that edge, so no wall is
built at the seam and the seam closes itself. Weld, connect and bridge act
on the selection *as a group*, so handing them the union would be wrong —
welding a pair together with its mirror collapses all four onto the plane —
and they run once per side instead. Either way, **one Undo takes back both
halves**.

**Mirror** knows whether the plane cuts the object. If it does, mirroring
the whole thing would just lay a second copy over the first, so instead it
keeps the half you're looking at, throws the other away and rebuilds it —
leaving an edge loop exactly on the plane. If the plane misses the object,
it mirrors the whole thing, which is what you want for mirroring an arm
across a body.

**Appearance** — three finishes (standard, matte, metal), per-face colour,
smooth and flat shading, a non-destructive rounded-edge preview, and two
themes.

**Export** — glTF (.glb), OBJ, STL. Projects save and load as JSON, and
there's an autosave.

## Running it

It's a single self-contained HTML file. Open `index.html` from any web server
and it works.

It will **not** work opened straight from disk as a `file://` URL — the app
loads three.js as an ES module, and browsers block module imports from local
files for security reasons. Use a server:

```bash
python -m http.server 8000   # then open http://localhost:8000
```

GitHub Pages, Netlify, Cloudflare Pages and itch.io all serve it as-is.

### On a phone

Open the hosted URL in Safari or Chrome, then **Share → Add to Home Screen**.
It launches fullscreen with no browser chrome, and the layout accounts for
the notch and the home indicator.

### Debugging

Append `?debug=1` to the URL. You get:

- an on-screen JavaScript console, which on a phone is otherwise the one
  thing you can't have
- `window.__kubik`, exposing the live app — the scene, the camera, the real
  op entry points and the ring, so a browser harness can drive the actual
  tools rather than reimplementing them
- a `[pick]` line for every tap explaining why it resolved the way it did
- a `[winding]` line after every mesh edit, reporting faces whose normals
  disagree with their neighbours, plus boundary and non-manifold edge counts

## Built with

[three.js](https://threejs.org) via CDN. No build step, no dependencies to
install, no bundler. The whole app is one file you can read top to bottom.

## How it's built

One rule has earned its place above the rest: **measure, don't reason.**
Essentially every layout, geometry and picking bug in this project was found
by running numbers or reading a screenshot, and missed by reasoning about
the code. A few that were only ever going to be caught that way:

- an edge viewed at 5° claimed 69% of a face, until picking moved to screen
  space
- a vertex marker shrank to 4px while its catch radius stayed 22px, so you
  were aiming at something you couldn't see
- the direction a mirrored loop cut slides turned out to vary *per ring* on
  the same model — two of four rings needed the flip, so no constant could
  ever have been right
- a button aligned perfectly on every desktop and sat a full 34px out on any
  phone with a home indicator, because a safe-area inset was applied twice
  and `env(safe-area-inset-*)` is zero on a desktop

Before anything ships, `python _verify.py index.html` runs `node --check` on
the extracted script and scans for duplicate top-level declarations — a
second copy of a function is a hard SyntaxError that blanks the whole app,
and it's the kind of thing a large edit does quietly.

The repo carries a `CURRENT_STATE.md` written for whoever picks this up
next. It includes a **"Deliberately absent — do not rebuild these"** section:
the transform gizmo, the fixed-corner fan menu, the smart camera and others
were each built, lived in the app for a while, and were removed on purpose.

## Status

Working, and actively changing.

## Licence

See [LICENSE](LICENSE).
