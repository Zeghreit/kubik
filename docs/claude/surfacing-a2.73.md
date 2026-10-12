# a2.73 — the surfacing transition. Built, reviewed, SHIPPED.

Commit `d75b1d0`. The effect asked for back in the chrome-pass session —
*"like it is submerging into a layer of some blurry surface and manifesting
out of it"* — deferred four times, now real.

`blur(10px) → 0` with `scale .94 → 1`. **260ms rising** on a curve that
decelerates hard, **180ms sinking** on one that accelerates. Rising is
slower on purpose: arriving is an event and wants to be seen, leaving is
bookkeeping and wants to be out of the way.

On the op bar, the pivot bar, the inspector and the isolate chip.

## Three things the CSS had to get right

**`scale`, not `transform: scale()`.** Half of these already carry a
transform to centre themselves, and a keyframe animating `transform`
overwrites it — which is exactly why the `#firstHint` prototype had to bake
`translateX(-50%)` into both of its own keyframes and could never be shared.
The independent properties compose: the chain is `translate * rotate * scale
* transform`, so an element's own transform is untouched. The centred ones
moved to `translate: -50%` so the scale is applied about the already-centred
box rather than the pre-centring origin.

**`#toast.show` sets a transform of its own**, so moving the base rule
without moving that one would have applied both and centred the toast twice
over — 100% of its width off to the left. Caught by the probe, not by
reading.

**`backwards`, not `both`.** `both` holds the animation's end state, which
here is `filter: blur(0px)` — and a filter of zero is still a filter: the
element stays on its own composited layer, over a live WebGL viewport, for
the rest of the session. The first cut stripped the class on `animationend`,
and **an animationend is not guaranteed to arrive**: a background tab, a
`display:none` ancestor, or reduced motion (where the rule is `animation:
none`) and it never fires. `backwards` fills only *before* the animation, so
when it ends the element reverts to its own filterless styles and the
cleanup stops being load-bearing.

The prototype had carried that same leak since a2.66.

## HIDDEN MEANS HIDDEN — the regression suite made this call

The first cut deferred dropping `.show` until the exit animation finished.
**Seven probe suites failed on it** — "cancel the op, is the bar gone?" —
and they were right to. For 180ms after closing a panel,
`classList.contains('show')` still said it was open. Anything in the app
asking the same question would have got the same wrong answer, and the
review separately found the panel stayed hit-testable that whole time,
eating the next tap.

The fix is better than the one the reviewer proposed for the hit-testing
symptom: `.show` is dropped **at once**, and the element is kept painted by
freezing its own computed `display` into an inline style, which outranks the
now-absent `.show` rule. Hidden the moment you ask; the pixels take a beat to
leave. `.submerging` is `pointer-events: none` on top of that.

*This is the second time this stretch that a failing regression suite was
pointing at a design flaw rather than at a broken test.*

## The three states a fade-out has to handle

Every one of these was a real defect, and two came from review:

- **Re-opened while sinking.** Removing `.submerging` cancels its animation,
  which fires animation**cancel**, not animation**end** — so a listener left
  attached survives and then fires on the animationend of the *rise that
  replaced it*, hiding a panel 260ms after the user reopened it. Reachable
  in one tap: `refreshInspector` calls `surfaceToggle(false)` and then
  `surfaceIn` on the same element when the selection empties.
- **Already up — including already on the way up.** A repeated `surfaceIn`
  that restarts the animation also resets its own cleanup timer, so it never
  finishes: the element sits pinned at the first frame, invisible and
  blurred. `refreshInspector` runs on every pointermove of a drag, so this
  was an entire gesture with the inspector missing and a blurred layer over
  the live canvas. **I introduced this one in a patch meant to fix the
  cleanup.**
- **Closed twice.** The second call must not clear the first one's pending
  cleanup, or the frozen inline `display` and `.submerging` stay for ever.
  Found by the probe, not by review.

## The probe caught what a probe can catch

A harness cannot judge how this looks — the phone is the only place that can.
What it can catch is everything around the animation, and it did: a stuck
panel, a vanished panel, a lingering filter, a doubly-centred toast.

One blind spot worth recording: the "re-opened while sinking" section
**passed while the bug was live**, because the defect only fires when an
`animationend` is actually delivered and headless virtual time never
delivers one. The fix was to dispatch a synthetic `AnimationEvent` by hand.

```
11.show_dropped_at_once=the class is gone the moment you close it, not 180ms later
11.ghost_takes_no_taps=and the ghost cannot eat a tap meant for what is behind it
12.stale_listener_gone=the cancelled exit does not fire on the rise that replaced it
13.no_latch=thirty opens in a row leave one animation and a visible panel
10.nothing_stuck_on_a_layer=no element anywhere is left with a blur filter
```

## Two probes were measuring the wrong thing

- `_theme_probe` read the op bar's height right after showing it and got
  60px instead of 64 — the bar is at `scale .94` mid-animation. This file's
  own notes already say a *transitioned* property must be settled before
  measuring; an *animated* one is the same trap.
- `_iso2_probe`'s state summary read the isolate chip's **text**. Since the
  chip now keeps its last count while it sinks (blanking it mid-fade reads
  as breakage), the text of an already-hidden chip says nothing about the
  app. It now reports whether the chip is up, which is the observable fact.

## Deliberately not on

- **The drawer and the material tray.** Both already have a considered
  movement — the drawer slides from its edge, the tray rolls out — and that
  *is* their character. Replacing it would be undoing design.
- **The toast.** By far the most frequent thing on screen, it fires during
  drags, and blurred text is the least forgiving thing to blur. It keeps its
  own quiet fade — but its centring was made consistent so it *could* take
  the effect later without the double-transform trap.
- **Anything mid-gesture** — the tool ring, the ring label. A blur over the
  live viewport during a drag is the one case the plan said to measure on a
  real phone first, and **this release does not measure it**: headless Chrome
  freezes `performance.now()` under a virtual time budget, so no timing
  assertion in this harness means anything. The four elements it *is* on are
  bounded (largest ~746×260 device px for 260ms). The ring is a per-frame
  question and stays out until someone looks at it on the phone.
- `#inspector` carries `backdrop-filter: blur(6px)`; the classes set it to
  `none` for the duration, because blurring the backdrop *and* the element
  is a read-back of the live canvas plus a second blur on the result, and
  WebKit has been inconsistent about the pair.

## Next, on this thread

Look at it on the iPhone. If it feels right, the ring and the ring label are
the remaining candidates — and those need the frame measurement first, which
means measuring on the device rather than in the harness.
