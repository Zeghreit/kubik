# Kubik

A fidget for 3D artists.

Kubik is a low-poly mesh editor that runs in a browser tab. It's built to be
used one-handed — drag with a left thumb, tools bloom wherever it's touching,
with an occasional assist from the other hand's index finger — because the
point isn't to finish a model. It's to have something pleasant to turn over
while you think.

No install, no account, no project files. Open it and push a cube around.

**[Try it →](https://zeghreit.github.io/kubik/)**

<img src="qr.png" alt="QR code linking to https://zeghreit.github.io/kubik/" width="200">

Scan with a phone camera. It's built for a phone, so that's the way to see it
properly — then **Share → Add to Home Screen** for fullscreen.

---

## What it does

**Modeling** — extrude, inset, bevel, bridge, edge loops, subdivide
(Catmull-Clark or shape-preserving), creases, weld, mirror, join.

**Selection** — object, vertex, edge and face modes; box and lasso region
select; grow and shrink; double-tap for a whole edge loop, ring or face loop.

**Transforms** — grab whatever's selected and drag it; the same gesture
moves, rotates or scales depending on which tool is active. A two-finger tap
switches Move / Rotate / Scale, a three-finger tap switches between free
movement and axis-locked movement — the axis is read from the first few
pixels of the drag, not chosen from a menu.

**Tools** — press and hold on a selection and the relevant tools bloom
around your finger, a different set for vertices, edges, faces and whole
objects. Slide onto one and lift to run it.

**Appearance** — three finishes (standard, matte, metal), per-face colour,
smooth and flat shading, non-destructive rounded-edge preview, and a toggle
for whether a selection reads as solid or see-through.

**Comfort** — a smart camera that drifts to a useful angle after you select
something, live-adjustable operations with an OK/Cancel bar, symmetry,
snapping, two themes, and an in-app help card explaining the controls.

**Export** — glTF (.glb), OBJ, STL. Projects save and load as JSON.

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
It launches fullscreen with no browser chrome, and the layout accounts for the
notch and home indicator.

### Debugging

Append `?debug=1` to the URL to get an on-screen JavaScript console. Useful on
a phone, where there's no other way to see errors without a desktop.

## Built with

[three.js](https://threejs.org) via CDN. No build step, no dependencies to
install, no bundler. The whole app is one file you can read top to bottom.

## Status

Working, and actively changing. The mesh operations are tested against a
closed-surface check (every edge shared by exactly two faces) rather than by
eye — that caught several bugs that looked fine in a render.

## Licence

See [LICENSE](LICENSE).
