# Camera-linked lighting - the headlight rig (a2.95)

Shipped and pushed (`e5a69f8`). Zeghreit: "link light to camera so on
rotation we will see model well lit all the time. If one will want to
change it - we already have light turning feature."

## Design

`App.env.rotation` used to be an absolute world angle driving both the
analytic scene lights (`hemi`/`dir`/`fill`/`rimLight`) and the IBL
environment map rotation, via `applyEnvRig()`/`applyEnvLive()`. It is now
a MANUAL OFFSET on top of a camera-tracked baseline:

    turn = manualTurn + cameraTurnDeg()
    manualTurn = App.env.rotation           // unchanged - the gesture still writes this
    cameraTurnDeg() = orbit.getAzimuthalAngle()°  - HOME_CAM_AZ_DEG

`HOME_CAM_AZ_DEG` is the OPENING camera's own azimuth (~36.87°, from the
hardcoded initial camera position), not zero - every preset's az/el
numbers were hand-tuned against that specific framing, so anchoring the
delta to it (not to world zero) means every preset looks exactly as
designed at the opening view, and a saved project opens looking exactly
as it always did, then relights coherently as the camera orbits away
from wherever it opened.

A second `orbit.addEventListener('change', ...)` recomputes the rig on
every real camera turn (drag, damping settle, and programmatic flights
all reach it, since `animate()` calls `orbit.update()` unconditionally
every frame). An epsilon guard (0.02°) skips the recompute when 'change'
fires from a pure pan or dolly, which move `camera.position` without
changing azimuth.

The material-preview tray is deliberately excluded: it's its own scene,
never orbited, so its key light and `environmentRotation.y` keep using
`manualTurn` alone - the light-turn gesture can still spin it, the
viewport camera cannot.

## What a fresh reviewer found

One real bug, caught before ship: `engageLightHold()` cleared
`orbit.enabled` to take the camera away from the anchor fingers, but
`enabled` only stops the controls reading pointers - it does not stop
OrbitControls' damping already in flight, and `animate()`'s
`orbit.update()` applies that regardless of `enabled`. A flick
immediately followed by the light-hold gesture kept feeding the
headlight rig for close to a second of leftover momentum, drifting the
light out from under a gesture whose whole point is manual control.
`cubeAlignTo` had already solved this exact class of bug for its own
swing (`orbit.enableDamping = false; orbit.update(); orbit.enableDamping
= damp;` - "spend the coast first") - `engageLightHold` now does the
same thing before clearing `enabled`.

Everything else the reviewer checked came back clean: the az convention
(`atan2(x,z)`, matching three.js's `Spherical.theta` and confirmed
against the three.js source) matches `envDirFromAzEl`'s own; `turn` vs
`manualTurn` is used consistently everywhere (no accidental cross-over
between the scene and the preview tray); the new listener can't fire
before `App`/`orbit` exist; old saved projects still open looking
exactly as they did (camera position is never touched by `restoreDoc`,
so `cameraTurnDeg()` is still 0 at load); and `applyEnvLive()`/
`applyEnvRig()` never rebake the PMREM environment, so running them on
every turning frame is cheap.

## Testing

`_light_probe.py`/`_light_probe.js` measure the real light objects
(`hemi`/`dir`/`fill`/`rimLight`, exported to `window.__kubik` for this)
and the real `OrbitControls` angle directly, not pixels: baseline
untouched at the opening view; a +40° orbit shifts every scene light and
`scene.environmentRotation.y` by exactly 40°; the manual gesture's offset
adds on top rather than replacing the camera term; a round trip back to
the opening azimuth reproduces the original directions with zero drift;
a pan leaves the lights alone (epsilon guard). Full existing regression
suite (`_runprobes.py`) ran clean apart from the two flakes already on
record (`_imp_probe`'s CDN race, `_soft2_probe`'s headless
`releasePointerCapture` warning under synthetic pointer events).

## Known and not addressed

- No dedicated probe section exercises the reviewer's exact "flick then
  immediately hold" scenario (simulating three.js's internal damping
  state from outside isn't part of the app's own public/`__kubik` API,
  and reaching into `OrbitControls`' private closure state the way
  `maybeResumeOrbit` reaches into its `_pointers`/`state` properties
  wasn't attempted here). The fix reuses an idiom already proven
  elsewhere in this exact file (`cubeAlignTo`), which is the basis for
  confidence rather than a fresh measurement of this specific gesture
  interaction. Worth a targeted probe if this class of bug recurs.
- Desktop has no path to Turn/Strength at all (a2.23's decision, touch
  only) - camera-linking doesn't change that; a mouse-only session gets
  the tracking behavior with no way to override it by gesture.
