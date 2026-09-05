/* a2.73 - the surfacing transition.

   What can go wrong here is not how it looks - a harness cannot judge that,
   and the phone is the only place that can. What a harness CAN catch is
   everything around the animation:

   - A panel that never comes back, because the hide waits for an
     animationend that never arrives.
   - A panel that vanishes a moment after you reopened it, because the
     exit it was halfway through finished anyway.
   - An element left wearing `filter: blur(0)` for the rest of the session,
     which keeps it on its own composited layer over a live WebGL viewport.
     `animation: both` holds exactly that end state, so this is the default
     outcome unless something strips the class.
   - A centred element that drifts sideways as it scales, because the scale
     was applied about its pre-centring origin.

   Those are the assertions. */
(function () {
  var out = [], errs = [];
  var _ce = console.error;
  console.error = function () { errs.push(Array.prototype.join.call(arguments, ' ')); _ce.apply(console, arguments); };
  function log(k, v) { out.push(k + '=' + v); }
  var k, A;

  function cs(el, p) { return getComputedStyle(el).getPropertyValue(p); }
  function shown(el) { return cs(el, 'display') !== 'none'; }
  function wait(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
  // Animations are the thing under test, so let them actually finish rather
  // than sampling mid-flight - this project has been caught reading a
  // transitioned property mid-transition and getting the FROM value.
  function settle(el) { el.getAnimations().forEach(function (a) { a.finish(); }); }

  async function main() {
    k = window.__kubik; A = k.App;
    /* The first-run chip animates on load and is legitimately mid-blur
       while this runs. Dismiss it, or section 10's sweep counts it as a
       leak. */
    if (k.dismissFirstHint) k.dismissFirstHint();
    await wait(400);

    var bar = document.getElementById('opBar');
    var chip = document.getElementById('isoChip');
    var insp = document.getElementById('inspector');

    /* ---- 1. The classes exist and mean what they say ---- */
    var sheetHas = { surfacing: false, submerging: false, reduced: false };
    for (var si = 0; si < document.styleSheets.length; si++) {
      var rules;
      try { rules = document.styleSheets[si].cssRules; } catch (e) { continue; }
      for (var ri = 0; ri < rules.length; ri++) {
        var t = rules[ri].cssText || '';
        if (/@keyframes surfacing/.test(t)) sheetHas.surfacing = true;
        if (/@keyframes submerging/.test(t)) sheetHas.submerging = true;
        if (/prefers-reduced-motion/.test(t) && /surfacing/.test(t)) sheetHas.reduced = true;
      }
    }
    log('1.keyframes', 'surfacing=' + sheetHas.surfacing + ' submerging=' +
      sheetHas.submerging + ' reduced-motion=' + sheetHas.reduced);
    log('1.reduced_motion_honoured', sheetHas.reduced
      ? 'reduced motion takes the plain state at both ends'
      : 'NO REDUCED-MOTION RULE');

    /* ---- 2. It comes up ---- */
    k.surfaceIn(bar);
    log('2.up', shown(bar) && bar.classList.contains('surfacing')
      ? 'the op bar is displayed and animating in'
      : 'IT DID NOT COME UP (display=' + cs(bar, 'display') + ')');
    /* PAST THE FALLBACK, not just past the animation. Animation.finish()
       does not deliver an animationend under headless virtual time, which
       is exactly the situation the fallback timeout is there for - so
       waiting only the animation's length measured the wrong thing. */
    settle(bar);
    await wait(k.SURFACE_MS + 200);
    log('2.class_stripped', !bar.classList.contains('surfacing')
      ? 'and the class is gone once the animation ends'
      : 'THE .surfacing CLASS IS STILL ON IT');
    /* THE ONE THAT COSTS FRAMES FOR THE REST OF THE SESSION. */
    log('2.no_lingering_filter', cs(bar, 'filter') === 'none'
      ? 'and no filter is left behind - nothing is stuck on its own layer'
      : 'IT IS STILL WEARING filter: ' + cs(bar, 'filter'));

    /* ---- 3. Coming up again while already up must not replay ----
       showOpBar is called again by paths that only mean to refresh the
       bar's contents; replaying there makes it flicker on every one. */
    k.surfaceIn(bar);
    log('3.no_replay_when_up', !bar.classList.contains('surfacing')
      ? 'calling it again while already up does nothing'
      : 'IT REPLAYED THE ANIMATION AND WOULD FLICKER');

    /* ---- 4. It goes down, and only then hides ---- */
    k.submergeOut(bar);
    log('4.still_shown_while_sinking', shown(bar) && bar.classList.contains('submerging')
      ? 'it is still displayed while sinking - the hide waits for the animation'
      : 'IT WAS HIDDEN INSTANTLY (display=' + cs(bar, 'display') + ')');
    settle(bar);
    await wait(k.SUBMERGE_MS + 200);
    log('4.down', !shown(bar) && !bar.classList.contains('submerging')
      ? 'and then it is hidden, with the class cleaned up'
      : 'IT DID NOT HIDE (display=' + cs(bar, 'display') +
        ' submerging=' + bar.classList.contains('submerging') + ')');
    log('4.no_lingering_filter', cs(bar, 'filter') === 'none'
      ? 'no filter left behind on the way down either'
      : 'IT IS STILL WEARING filter: ' + cs(bar, 'filter'));

    /* ---- 5. REOPENED WHILE SINKING must come back, not vanish ----
       The exit is 180ms of pending timeout and a live animationend
       listener. Without cancelling both, the panel you just reopened
       disappears a moment later. */
    k.surfaceIn(bar);
    settle(bar); await wait(k.SURFACE_MS + 200);
    k.submergeOut(bar);              // start sinking
    k.surfaceIn(bar);                // change your mind immediately
    settle(bar);
    await wait(k.SUBMERGE_MS + 200); // well past when the exit would have landed
    log('5.reopen_survives', shown(bar) && !bar.classList.contains('submerging')
      ? 'reopening mid-exit brings it back and it stays'
      : 'IT VANISHED AFTER BEING REOPENED (display=' + cs(bar, 'display') + ')');

    /* ---- 6. Closed twice must not queue a second hide ---- */
    k.submergeOut(bar);
    k.submergeOut(bar);
    settle(bar);
    await wait(k.SUBMERGE_MS + 200);
    var hidTwice = !shown(bar);
    k.surfaceIn(bar);
    settle(bar);
    await wait(k.SUBMERGE_MS + 200);
    log('6.double_close', hidTwice && shown(bar)
      ? 'closing twice hides once, and a later open is not undone by a stale listener'
      : 'A SECOND CLOSE LEFT A LISTENER BEHIND (hid=' + hidTwice +
        ' shownAfter=' + shown(bar) + ')');
    k.submergeOut(bar); settle(bar); await wait(k.SUBMERGE_MS + 200);

    /* ---- 7. Closing something that was never open ---- */
    k.submergeOut(insp);
    await wait(20);
    log('7.close_when_closed', !shown(insp) && !insp.classList.contains('submerging')
      ? 'closing something already closed is a no-op, not a stuck class'
      : 'IT LEFT A CLASS ON A CLOSED PANEL');

    /* ---- 8. A CENTRED element must not drift as it scales ----
       #isoChip centres itself. With `transform: translateX(-50%)` the
       shared `scale` would be applied about the pre-centring origin and the
       chip would slide sideways while it grew. `translate: -50%` composes
       correctly. Measured at the animation's MIDPOINT, where any drift is
       at its largest. */
    document.getElementById('isoChipN').textContent = '3 hidden';
    k.surfaceIn(chip);
    var mid = chip.getAnimations()[0];
    var startX = null, midX = null, endX = null;
    if (mid) {
      mid.currentTime = 0;
      startX = chip.getBoundingClientRect();
      mid.currentTime = 130;              // halfway through 260ms
      midX = chip.getBoundingClientRect();
      mid.finish();
      endX = chip.getBoundingClientRect();
    }
    var vpw = document.documentElement.clientWidth;
    function centreOf(r) { return r ? (r.left + r.right) / 2 : NaN; }
    log('8.centres', 'start ' + centreOf(startX).toFixed(1) + ', mid ' +
      centreOf(midX).toFixed(1) + ', end ' + centreOf(endX).toFixed(1) +
      ' (viewport centre ' + (vpw / 2).toFixed(1) + ')');
    log('8.no_drift', midX && Math.abs(centreOf(midX) - centreOf(endX)) < 1.5
      ? 'a centred chip scales in place - it does not slide as it grows'
      : 'IT DRIFTS ' + Math.abs(centreOf(midX) - centreOf(endX)).toFixed(1) +
        'px MID-ANIMATION');
    log('8.ends_centred', endX && Math.abs(centreOf(endX) - vpw / 2) < 2
      ? 'and it lands centred'
      : 'IT LANDS OFF CENTRE BY ' + Math.abs(centreOf(endX) - vpw / 2).toFixed(1) + 'px');
    await wait(k.SURFACE_MS + 200);
    log('8.chip_clean', cs(chip, 'filter') === 'none'
      ? 'with no filter left on it'
      : 'CHIP STILL WEARING filter: ' + cs(chip, 'filter'));

    /* ---- 9. The toast keeps its own fade, and centres ONCE ----
       Its .show rule sets a transform of its own, so moving the base rule
       to `translate` without moving that one too would have centred it
       twice - 100% of its width off to the left. */
    var toastEl = document.getElementById('toast');
    k.toast('measuring');
    await wait(260);
    var tr = toastEl.getBoundingClientRect();
    log('9.toast_centred', Math.abs((tr.left + tr.right) / 2 - vpw / 2) < 2
      ? 'the toast is centred once, not twice (' +
        ((tr.left + tr.right) / 2).toFixed(1) + ' vs ' + (vpw / 2).toFixed(1) + ')'
      : 'THE TOAST IS OFF CENTRE BY ' +
        Math.abs((tr.left + tr.right) / 2 - vpw / 2).toFixed(1) + 'px');
    log('9.toast_unblurred', cs(toastEl, 'filter') === 'none'
      ? 'and it is not blurred - it kept its own quiet fade'
      : 'THE TOAST IS BEING BLURRED: ' + cs(toastEl, 'filter'));

    /* ---- 10. Nothing anywhere is left wearing a filter ----
       The blanket version of 2 and 4, over every element in the document. */
    var wearing = [];
    document.querySelectorAll('*').forEach(function (el) {
      var f = getComputedStyle(el).filter;
      if (f && f !== 'none' && /blur/.test(f)) wearing.push((el.id || el.className || el.tagName) + ':' + f);
    });
    log('10.filters_in_the_document', wearing.length ? wearing.join(' | ').slice(0, 200) : 'none');
    log('10.nothing_stuck_on_a_layer', wearing.length === 0
      ? 'no element anywhere is left with a blur filter'
      : wearing.length + ' ELEMENTS ARE STILL WEARING A BLUR');

    /* ---- 11. HIDDEN MEANS HIDDEN, IMMEDIATELY ----
       The first cut kept `.show` until the animation ended, so for 180ms
       after closing a panel the app said it was still open. Seven probe
       suites failed on exactly that question, and they were right to. */
    k.surfaceIn(bar); settle(bar); await wait(k.SURFACE_MS + 200);
    k.submergeOut(bar);
    log('11.show_dropped_at_once', !bar.classList.contains('show')
      ? 'the class is gone the moment you close it, not 180ms later'
      : 'IT IS STILL MARKED SHOWN');
    log('11.still_painted', cs(bar, 'display') !== 'none'
      ? 'while the pixels take a beat to leave (display ' + cs(bar, 'display') + ')'
      : 'IT VANISHED WITH NO ANIMATION');
    log('11.ghost_takes_no_taps', cs(bar, 'pointer-events') === 'none'
      ? 'and the ghost cannot eat a tap meant for what is behind it'
      : 'THE GHOST IS STILL HIT-TESTABLE');
    settle(bar); await wait(k.SUBMERGE_MS + 200);
    log('11.cleans_up', cs(bar, 'display') === 'none' && !bar.style.display &&
      !bar.classList.contains('submerging')
      ? 'and it cleans up after itself - no inline style, no class left'
      : 'LEFTOVERS: display=' + cs(bar, 'display') + ' inline="' + bar.style.display +
        '" submerging=' + bar.classList.contains('submerging'));

    /* ---- 12. A CANCELLED EXIT MUST NOT FIRE LATER ----
       Removing `.submerging` cancels its animation, which fires
       animationCANCEL, not animationEND - so a listener left attached
       survives and then fires on the animationend of the RISE that replaced
       it, hiding a panel a quarter-second after the user reopened it.
       Dispatched by hand: headless virtual time never delivers a real
       animationend, which is why section 5 passed while this was broken. */
    k.surfaceIn(bar); settle(bar); await wait(k.SURFACE_MS + 200);
    k.submergeOut(bar);                       // arm the exit
    k.surfaceIn(bar);                         // change your mind
    bar.dispatchEvent(new AnimationEvent('animationend', { animationName: 'surfacing' }));
    await wait(30);
    log('12.stale_listener_gone', bar.classList.contains('show')
      ? 'the cancelled exit does not fire on the rise that replaced it'
      : 'A STALE LISTENER HID THE PANEL AFTER IT WAS REOPENED');

    /* ---- 13. Repeated opens must not latch ----
       refreshInspector runs on every pointermove of a drag. If a repeated
       surfaceIn restarts the animation, the restart resets its own cleanup
       timer and it never finishes - the element sits pinned at the first
       frame, invisible and blurred, for the whole gesture. */
    k.submergeOut(bar); settle(bar); await wait(k.SUBMERGE_MS + 200);
    k.surfaceIn(bar);
    for (var r13 = 0; r13 < 30; r13++) k.surfaceIn(bar);   // a drag's worth
    var anims13 = bar.getAnimations().length;
    settle(bar);
    log('13.no_latch', anims13 <= 1 && parseFloat(cs(bar, 'opacity')) > 0.9
      ? 'thirty opens in a row leave one animation and a visible panel'
      : 'IT LATCHED (' + anims13 + ' animations, opacity ' + cs(bar, 'opacity') + ')');
    await wait(k.SURFACE_MS + 200);
    log('13.settles_clean', !bar.classList.contains('surfacing') && cs(bar, 'filter') === 'none'
      ? 'and it still settles with no class and no filter'
      : 'IT DID NOT SETTLE (surfacing=' + bar.classList.contains('surfacing') +
        ' filter=' + cs(bar, 'filter') + ')');
    k.submergeOut(bar); settle(bar); await wait(k.SUBMERGE_MS + 200);

    log('console.errors', errs.length ? errs.join(' | ').slice(0, 400) : 'none');
  }

  function ready(cb, t) {
    t = t || 0;
    if (window.__kubik && window.__kubik.App) return cb();
    if (t > 250) { out.push('ERROR=no __kubik'); return finish(); }
    setTimeout(function () { ready(cb, t + 1); }, 20);
  }
  function finish() {
    var pre = document.createElement('pre');
    pre.id = 'probeOut';
    pre.textContent = '<<<PROBE\n' + out.join('\n') + '\nPROBE>>>';
    document.body.appendChild(pre);
    document.title = 'PROBE-DONE';
  }
  window.addEventListener('error', function (e) { errs.push('onerror: ' + (e.message || e)); });
  setTimeout(function () {
    ready(function () {
      setTimeout(function () {
        main().catch(function (e) {
          out.push('ERROR=' + (e && e.stack ? e.stack.split('\n').slice(0, 6).join(' / ') : e));
        }).then(finish);
      }, 600);
    });
  }, 300);
})();
