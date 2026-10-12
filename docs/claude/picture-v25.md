# A picture of the view (v2.5)

Shipped and live: `Save a picture` in the drawer's Files section, under the
`.glb / .obj / .stl` chips. Writes `kubik-picture.png` at the viewport's own
buffer size and hands it to the same share-sheet-or-download path v2.4 built.

## Why it belongs in this app

The three model exports send the geometry somewhere else to be opened. Most
of what comes out of a session here is not that — it is something you want to
look at or send to somebody, and the only way to get it was a phone
screenshot with the whole UI in shot.

## One rule decides what is in the picture

Not a list of names — a list is a thing to forget to add to, and this app
grows helpers.

- Everything the scene holds that is **not a model** goes dark: the grid, the
  pivot, the pivot marker, the axis guide, the knife dots and line, the snap
  marker.
- **Every child of a model** goes dark too, because every child of a model IS
  an overlay: `vertexPoints`, `edgeLines`, `faceOverlay`, `selPoints`,
  `selLines`, `softPoints`, `softLines`, `softFaces`.
- **Lights stay** — they are not things you can see.
- **The background stays** — it is the theme's own colour, and a model
  standing on it is the picture this app should make.

Two properties fall out of the rule rather than being written:

- An object the user has hidden stays out, because only what was *visible* is
  recorded, and only what was recorded is restored.
- A model parented into anything puts that thing in the keep set (the walk
  goes up `parent` to the scene), so the picture cannot go blank the day the
  pivot stops being a pure reference frame. Nothing re-parents today —
  there is no `.attach(` anywhere in the file — but the guard is four lines.

## The two things that must happen in one tick

The viewport renderer is `preserveDrawingBuffer: false`.

1. **`toDataURL` goes on the line after `render`.** The buffer is valid until
   the end of the task that drew it and empty afterwards, so a read one tick
   later decodes into a perfectly good picture of nothing. This is also why
   the shot does not go through the frame loop at all: a picture scheduled
   for the next frame is a picture of black.
2. **The whole path stays synchronous into `downloadBlob`.** The iOS share
   sheet needs the tap's transient activation, and `toBlob` would hand its
   result back in a later task. `toDataURL` + `atob` costs one string the
   size of the picture, once, on a button somebody pressed on purpose.

`setRenderScale(false)` first, so a picture taken with a finger still down is
not a frame of a gesture at `LIVE_PIXEL_RATIO`.

## Three fixes a fresh reviewer caught before it shipped

- **The hiding happens inside the `try`, into a list the caller already
  owns.** Hide-then-enter-the-try means a throw half way through the hiding
  leaves the grid switched off for the rest of the session with nothing
  holding a record of what to put back.
- **A `catch`, or the button looks dead.** `toDataURL` can throw — a failed
  allocation on a phone is the realistic way — and the exception would walk
  out past both toasts.
- **The workshop is drawn back in the same task.** The dimmed frame is the
  one the browser is about to composite, so without a second render the grid
  and the dots blink out for a frame on the way to the share sheet.

## Measured

`_shotchk.py` — 26 checks, real clock, POSTs its own answer back. Shown to
**fail** against two broken copies, not only to pass against a good one:

- `_bak_v24.html`: no button, no function — 4 of 4 fail.
- `_bak_v25pre.html` (built by `_mkbroken25.py` with the last two fixes
  undone): the same-task check fails, and the mid-hide throw walks out of
  `savePictureAction` and takes the probe with it — which is exactly the bug.

It **counts pixels** rather than trusting the file, the same trap the v2.4
icon fell into: the shot must have more than 2000 pixels that are not its own
corner colour, and *fewer* of them than the same frame rendered with the grid
in it.

Full suite after the change: **35 of 35 files identical** to the `_det2`
baseline.

## Two notes this work turned up

- **Every export toasts before the share sheet has been answered.** All five
  paths — .glb, .obj, .stl, the JSON and now the picture — say
  "Exported"/"saved" synchronously, so cancelling the iOS sheet still reads
  as success. The fix belongs in `downloadBlob` (return a promise, toast on
  the outcome): one change for five call sites.
- **Named saves already exist** and have for a long time — the drawer's
  "Models" section (`#projName`, `#btnProjSave`, `#projList`), kept in
  localStorage, with the last state restored automatically on return. It was
  proposed again at v2.4 as though it were new. Read the drawer markup before
  proposing anything that stores something.
