# Kubik

A fidget for 3D artists.

Kubik is a low-poly mesh editor that runs in a browser tab. It's built for a
phone and meant to be used one-handed — you drag with a thumb, and tools
bloom wherever it's touching. The point isn't to finish a model. It's to
have something pleasant to turn over while you think.

No install, no account, no sign-up. Open it and push a cube around.

**[Try it →](https://zeghreit.github.io/kubik/)**

<img src="qr.png" alt="QR code linking to https://zeghreit.github.io/kubik/" width="200">

Scan with a phone camera — it's built for one, so that's the way to see it
properly. Then **Share → Add to Home Screen** for fullscreen.

---

## What it's like

**There is no gizmo.** You grab what's selected and drag it. No arrows to
hunt for, no handle to miss on a small screen.

**Nothing is on screen that doesn't need to be.** Press and hold, and the
tools that apply right now appear around your finger. Lift, and they're gone.

Underneath that it's a real modelling app: object, vertex, edge and face
selection, extrude, inset, bevel, bridge, loop cuts, subdivide, symmetry and
mirroring, undo, and export to glTF, OBJ or STL.

There's a Help card in the app that explains the gestures properly.

## Running it

It's one self-contained HTML file. Serve it from anywhere:

```bash
python -m http.server 8000   # then open http://localhost:8000
```

It won't work opened straight from disk as a `file://` URL — it loads
three.js as an ES module, and browsers block module imports from local
files. GitHub Pages, Netlify and itch.io all serve it as-is.

Add `?debug=1` for an on-screen console and diagnostics.

## Built with

[three.js](https://threejs.org) via CDN. No build step, no bundler, no
dependencies to install.

If you want to work on it, read `CURRENT_STATE.md` first — it describes the
app as it stands, and lists several obvious-sounding features that were
built, tried and deliberately removed.

## Licence

See [LICENSE](LICENSE).
