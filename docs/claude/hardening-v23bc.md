# v2.3b / v2.3c + the harness — improving what was already there

No new features. Two fresh reviews over areas untouched this session (the
op/undo/document core, and the selection/UI/gesture layer), then the harness
underneath both. Shipped as `fe78e40`, `7a4eeda`, `0b74bec`.

## v2.3b — four things that were quietly wrong

**1. Loading a file with an op bar open corrupted the model you just opened.**
`restoreDoc` abandons the knife and the geo setup before disposing the scene,
and the note on the second says why: *"ids come from the DOCUMENT, so a setup
bar left open would go on pointing at 'object 2' and quietly retarget whatever
object in the LOADED model wears that id."* `App.pendingOp` is the third such
state and wasn't guarded — and it's worse, because it carries a
`captureObjectState` snapshot of the *previous* document's mesh. Bevel open →
menu → open a model, and the next slider nudge overwrote an unrelated object
with the old document's geometry, materials, creases and edge marks; ✓ then
committed it. Abandoned rather than cancelled, because `cancelPendingOp` would
restore that snapshot into an object about to be disposed and re-run the op
first. `flushMatBin` goes with it.

**2. Undo with an op bar open took back a committed step as well.** `undo`
handles a live extrude correctly and explains why; every other op fell through
to a line that dropped the preview *without restoring it* and stepped history
back anyway. Extrude → ✓ → bevel → drag → Undo, and the extrude was gone. Same
in `redo`. A slider op's preview is a preview by the same argument, so it now
gets the same answer: cancel and stop.

**3. The material card's long-press survived a scroll.** The 500 ms timer was
cleared on `pointerup`/`pointerleave` only. The tray is a scroller, so a finger
that starts on a card and flicks hands the touch to the browser:
`pointercancel` fires, `pointerup` never does, and touch's implicit capture
means `pointerleave` doesn't either. The editor opened half a second later on a
material you were only scrolling past.

**4. Multi-axis symmetry planes were dropped by every save and every undo.**
a2.44 fixed exactly this drift for `symPlane`; a2.89 then added a plane *per
axis* in `symPlanes` and nobody extended the save. `symmetryPlane`'s fallback
accepts the singular plane only when its axis matches, so after a reopen every
other axis was recaptured from the live bounding box.

**Verified against the broken copy, not just the good one.** `_fixchk.py`
against `_bak_v23a.html` fails 6 of 12 and names each bug; against the ship it
is `VERDICT=PASS (13 checks)`.

## v2.3c — two pieces of work nobody could see

**The material editor re-rendered the whole library into a hidden panel.**
While the editor is open the card column is `display: none`, yet `meCommit`
nulled the preview cache and called `buildMatTray`, re-rendering every material
(a GPU draw plus a synchronous `toDataURL` readback and PNG encode, on the main
thread). All eleven editor controls commit through there. Now
`renderMatPreviews(onlyId)` renders one definition and writes it into both
places it shows. The branch that must not be dropped is `if (!_matPreviews)` —
a partial cache is truthy, and `setMatTrayOpen` tests exactly that.

**The two mask predicates allocated per material slot per `refreshUI`.**
`maskOf` and `defWantsField` both went through `maskList`'s `slice`;
`ensureMaskPatches` asks both once per slot, `refreshUI` runs it every call, and
a subdivided model holds 1536 materials. Both walk the live array now.
Deliberately not a cache — that would mean a new invariant, and these are read
from paths that mutate a definition in place.

Measured (`_matperf.py`, 20 objects / 120 slots, 3-material library):

| | before | after |
|---|---|---|
| `toDataURL` per slider release | 3.0 | **1.0** |
| `refreshUI` | 0.059 ms | **0.046 ms** |

The readback count *is* the library size — one now, whatever it holds.

## The harness — two full runs, 35 of 35 identical

Underneath everything. Got wrong in two directions, both written down as
"known flakes" rather than found:

- **No `--user-data-dir` at all** (23 of 35 probes) — shares Chrome's default
  profile, exits in ~4 s with an empty DOM whenever a Chrome is open. That is
  what `_imp_probe`'s "CDN race" actually looked like.
- **A *fixed* `--user-data-dir`** (the other 12) — the app autosaves into
  localStorage, so the next run opens the previous run's scene. It also lets
  Chrome restore a saved window size, which is why five probes' pixel numbers
  moved when this was fixed: they'd been measuring at whatever size the last
  run left behind.

Now: a `tempfile.mkdtemp()` profile per run, a **shared** `--disk-cache-dir`
(the app pulls three.js from a CDN every load, so a fresh profile means a cold
cache means a real fetch inside a virtual-time budget — the smaller grain of
truth in the CDN note), and the `--no-first-run` automation set (a brand-new
profile registers with GCM and installs default web apps before reaching the
page, enough on its own to blow `_imp_probe`'s budget).

**And `slider_coalescing` printed a number the harness could not know** — the
apply count taken *between* the frame and the flush, where the virtual clock
makes 300 ms pass instantly. Deleted; the invariant it was reaching for (no
applies during the burst, exactly one after) was already in the other number.

`py _runprobes.py _a` / `_b` / `py _cmpdirs.py _a _b` → **35 of 35 identical**.
Do that before believing any diff.

## Still open, from the same reviews

1. `opRefusal` is never cleared when an op ends, and `slideSelection` reads it
   outside a run — so Slide can show Circularize's refusal message.
2. `flushMatBin` still missed on `applyPendingOp`'s object-gone branch (undo
   and redo now route through `cancelPendingOp`, which flushes).
3. `cancelPendingOp` runs a full op re-apply purely to discard it — a stall on
   ✕ on a dense mesh.
4. `serializeDoc`'s `materialLib` is a VIEW of the live library
   (`normaliseDefMasks` returns its argument). No live symptom, because
   `restoreDoc` skips the library under `keepAppearance` — but it pre-empts
   ever making material edits undoable.
5. `refreshOutliner` rebuilds the whole list on every `refreshUI`; the hub
   glyph and tool readout re-parse `innerHTML` every call.
6. `applyPendingOp` is not exception-safe: `op.lastWhy` is written last, so a
   throw mid-op leaves the previous run's value and `confirmPendingOp` can
   commit a half-applied mesh. Theoretical — no throwing input found.
7. The `#N` program fork in `applyMaskPatch` (from the earlier session review)
   — still the largest suspected GPU item.
