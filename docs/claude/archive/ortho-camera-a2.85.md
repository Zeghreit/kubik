⛔ АРХИВ — ОПАСНО ЧИТАТЬ В ОДИНОЧКУ. Правило «поворот возвращает камеру в перспективу» описано здесь как действующее, но **a2.86 отменил его намеренно**. Действовать по этому документу = вернуть ровно тот баг, который a2.86 убрал. Читать только вместе с `turn-keeps-flat-a2.86.md`.

# The flat view is a real camera (a2.85)

From a2.61 to a2.84 "orthographic" was EMULATED: the one PerspectiveCamera
narrowed to fov 2 and backed away by the factor that keeps the framing —
about 27x. One camera, so every raycast, drag and unproject in the file kept
working without being taught anything. That was the whole argument for it,
and it is a good one.

Measured, against a2.84, with two rails that are parallel in the world:

| | convergence | camera distance | fog band |
|---|---|---|---|
| perspective | 15.6127 deg | 8.276 | 15.00 / 42.00 |
| emulated flat | **0.5076 deg** | **221.104** | **227.83 / 254.83** |
| real flat (a2.85) | **0.00000 deg** | 8.276 | 15.00 / 42.00 |

Half a degree is small. It is not zero, and it grows with the depth of the
model — which is the one thing a drafting view cannot do.

## The lens was never the expensive part. The 27x was.

Everything a2.61a had to fix came from moving the camera, not from bending
it. Fog is banded by CAMERA DISTANCE, so the band had to be shifted out to
227.83 / 254.83 and **re-shifted on every camera move**, because a band
frozen at engage is only correct at the distance it was frozen at — three
wheel notches out and the scene was solid background colour. The 0.01 near
plane threw away its precision from 27x out. Past ~37 units of orbit the
tele position landed beyond the 1000 far plane and the scene clipped to
nothing. `frameBox` read `camera.fov` and framed the object as a dot.

A second camera at the SAME position needs none of that. `syncOrthoDepth`,
`orthoFactor` and `ORTHO_FOV` are gone, and so is the fog save/shift/restore
and the ortho branch in the theme code. `_theme_probe` now reads the band at
15..42 at camera distance 3, 8 and 21 alike.

## How the swap works

`camera` is a `let`, and `perspCam` / `orthoCam` are the two handles. Engage
sizes the ortho frustum to the lens's visible height AT THE ORBIT TARGET —
`d * tan(fov/2)` — so the picture at that plane is identical and only the
convergence goes out of it. Measured: target-plane points move **0.000px**,
off-plane points move 45.9px.

Leaving is the same arithmetic backwards, with one wrinkle. An ortho camera
zooms by SHRINKING ITS FRUSTUM, not by moving, so the height to match on the
way out is the current one — `top / zoom` — not the one engage recorded.
Restoring the engage distance instead sprang a zoomed-in flat view back out
the moment you turned it.

The named handles exist for the code that needs a SPECIFIC lens rather than
the live one: `frameBox` measures its flight with `perspCam.fov` because
`animateCameraTo` disengages on the way out, and the theme's far plane is set
on both so a swap cannot bring in a stale one.

## THE BUG THIS ALMOST SHIPPED WITH

**Neither camera is in the scene graph.** Three refreshes a camera's
`matrixWorld` on the way into a frame, and `matrixWorldInverse` only inside
`renderer.render`. A camera swapped in mid-tick therefore carries whatever it
had last — for the ortho one, the identity it was constructed with. Every
`project` and every `Raycaster` between the swap and the next frame read that.

One stale matrix, three symptoms: the picture appeared to jump 65px, a centre
raycast at a cube in front of the camera returned **zero hits**, and the round
trip out looked like it had sprung back 150px. Engage and disengage now settle
`matrixWorld` and `matrixWorldInverse` themselves.

## The trap in MEASURING this

The first cut of `_lens_probe.js` reported the emulated flat view as no more
parallel than the lens — the same 15.6127 deg to four decimals. It was
measuring synchronously after the tap, so `project` was combining a STALE view
matrix with the NEW projection matrix. That combination is a uniform scale,
and **a uniform scale preserves angles exactly**. The probe was reading a
picture that had not been drawn yet, and the wrongness was invisible because
it was perfectly self-consistent.

## A capture is a liability once the object swaps

`_theme_probe` section 9 took `var cam = k.camera` at the top and then moved
it through four gestures. Once the pill started swapping the object, it was
moving the lens that was no longer being drawn while the flat one stayed put —
so the direction the turn-watch measures changed under it and **every pan and
zoom read as a turn**. Four sections failed and none of them was the app's
fault.

The app itself stores a camera in exactly one place — `OrbitControls`, built
with the perspective one — and `engageOrtho` repoints `orbit.object`.
Everything else reads `camera.` at call time. The `__kubik` export became a
getter for the same reason.

## Known, and not defects

- **The screen-space code that does not go through `worldPerPixel`** was not
  audited for the flat view. `worldPerPixel` got the branch it needed — no
  distance term in parallel projection, and the probe checks a near and a far
  point agree to 1e-9 — but any other place that scales by camera distance is
  unexamined. First thing to look at if handles or hit radii feel wrong while
  flat.
- **Focusing while flat leaves you in perspective**, because `animateCameraTo`
  disengages first. Unchanged from a2.61. `_theme_probe` reports it frames at
  1.82 either way, so the framing itself is right.
- **Serialization does not record the projection**, so a document saved while
  flat reloads in perspective. Unchanged from a2.61.
- No fresh reviewer pass ran on this version.

## Probes

`_proj_probe.js` / `_proj_probe.py`, twelve sections: the fixture really is a
converging lens before anything is claimed about parallelism; the swap holds
the target plane and moves everything else; the rails; the picking rays;
`worldPerPixel`; the frustum across a resize; a zoomed round trip; the fog
band there and back; the export as a live binding; framing while flat; and a
twenty-degree turn still dropping back to perspective.

`_lens_probe.js` / `_lens_run.py <wip|head>` injects the same probe into
`git show HEAD:index.html` or the working copy — how the 0.5076 deg was got.

## The lesson this one adds

**A wrong answer that is internally consistent is the hardest kind to see.**
The stale-matrix bug and the bad measurement were the same mistake wearing two
faces, and in both cases the output looked plausible: zero raycast hits reads
as "nothing there", and an unchanged angle reads as "no improvement". Both
were a matrix that had not caught up. When a measurement comes back suspiciously
equal, suspect the instrument before the result.
