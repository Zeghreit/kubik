/* a2.102 - drag anywhere sets the amount.

   Drives the CONTROLS, not the worker: synthetic pointer events on the
   canvas, the way a finger would, and reads what the op ended up with. */
(function () {
  var out = [], errs = [];
  var _ce = console.error;
  console.error = function () { errs.push(Array.prototype.join.call(arguments, ' ')); _ce.apply(console, arguments); };
  function log(k, v) { out.push(k + '=' + v); }
  var k, A;

  function pev(type, x, y, id) {
    return new PointerEvent(type, { clientX: x, clientY: y, pointerId: id || 1, pointerType: 'touch',
      isPrimary: true, bubbles: true, cancelable: true, button: 0, buttons: type === 'pointerup' ? 0 : 1 });
  }
  function press(x, y) { k.orbit.domElement.dispatchEvent(pev('pointerdown', x, y)); }
  function move(x, y) { k.orbit.domElement.dispatchEvent(pev('pointermove', x, y)); }
  function lift(x, y) { k.orbit.domElement.dispatchEvent(pev('pointerup', x, y)); }

  function emptySpot() {
    // Low on the viewport, away from the model, above the thumb row and the
    // deck: y at 70% of the height is empty in the default scene.
    var r = k.viewportEl.getBoundingClientRect();
    return { x: r.left + r.width * 0.25, y: r.top + r.height * 0.62 };
  }

  function main() {
    k = window.__kubik; A = k.App;
    var o = A.objects[0];
    k.setMode('face');
    A.activeObjectId = o.id; A.selectedObjectIds = new Set([o.id]);
    k.ensureHelpers(o);
    A.selectedElements = new Set([0]);
    k.refreshUI();
    k.insetSelection();
    k.refreshUI();

    var op = A.pendingOp;
    log('1.op_open', op ? op.kind + ' amount ' + op.amount : 'NO PENDING OP');
    log('1.eligible', k.amountDragEligible() ? 'an op with a range' : 'NOT ELIGIBLE');
    var range = k.activeRange(op);
    var before = op.amount;
    var s = emptySpot();

    /* ---- 2. a drag on empty space moves the amount ---- */
    press(s.x, s.y);
    log('2.candidate_on_press', k.amountCandidate ? 'armed' : 'NOT ARMED');
    move(s.x + 4, s.y);        // under the threshold: still a candidate
    log('2.still_candidate_under_threshold', !k.amountDrag && k.amountCandidate ? 'yes' : 'ENGAGED TOO EARLY');
    move(s.x + 60, s.y);
    log('2.engaged_on_travel', k.amountDrag ? 'dragging' : 'DID NOT ENGAGE');
    log('2.orbit_off_while_dragging', k.orbit.enabled ? 'ORBIT STILL ON' : 'orbit off');
    var w = k.viewportEl.clientWidth;
    var expect = before + 60 / w * (range.max - range.min);
    var got = A.pendingOp ? A.pendingOp.amount : NaN;
    log('2.amount_moved', Math.abs(got - expect) <= (range.step || 0.01) + 1e-9
      ? 'from ' + before + ' to ' + got.toFixed(3) + ' (expected ' + expect.toFixed(3) + ')'
      : 'WRONG: ' + before + ' -> ' + got + ', expected ' + expect.toFixed(3));
    log('2.in_range', got >= range.min - 1e-9 && got <= range.max + 1e-9 ? 'clamped inside the rail' : 'OUTSIDE THE RANGE');
    log('2.slider_follows', Math.abs(parseFloat(document.getElementById('opSlider').value) - got) < 1e-6 ? 'slider shows it' : 'SLIDER DISAGREES');
    lift(s.x + 60, s.y);
    log('2.orbit_back_on_lift', k.orbit.enabled ? 'orbit on' : 'ORBIT LEFT OFF');
    log('2.cleared_on_lift', !k.amountDrag && !k.amountCandidate ? 'clean' : 'STATE LEFT BEHIND');
    log('2.op_survives', A.pendingOp && A.pendingOp.kind === op.kind ? 'still pending' : 'THE DRAG ENDED THE OP');
    log('2.selection_survives', A.selectedElements.size === 1 ? 'one face still selected' : 'SELECTION CHANGED: ' + A.selectedElements.size);

    /* ---- 3. the whole width sweeps the whole range, and clamps ---- */
    var v0 = A.pendingOp.amount;
    press(s.x, s.y); move(s.x + 30, s.y); move(s.x + w * 3, s.y);
    log('3.clamps_at_max', Math.abs(A.pendingOp.amount - range.max) < 1e-6 ? 'stops at ' + range.max : 'OVERSHOT: ' + A.pendingOp.amount);
    lift(s.x + w * 3, s.y);
    press(s.x, s.y); move(s.x - 30, s.y); move(s.x - w * 3, s.y);
    log('3.clamps_at_min', Math.abs(A.pendingOp.amount - range.min) < 1e-6 ? 'stops at ' + range.min : 'UNDERSHOT: ' + A.pendingOp.amount);
    lift(s.x - w * 3, s.y);
    k.setPendingAmount(v0);

    /* ---- 4. a still tap is still a tap (it is not swallowed) ---- */
    var pendingBefore = !!A.pendingOp;
    press(s.x, s.y); move(s.x + 2, s.y + 1);
    log('4.tap_not_engaged', !k.amountDrag ? 'a still press is not a drag' : 'A TAP BECAME A DRAG');
    lift(s.x + 2, s.y + 1);
    log('4.tap_reached_the_tap_path', 'pending before ' + pendingBefore + ', after ' + !!A.pendingOp +
      ' - the tap did whatever a tap does, the drag did not eat it');

    /* ---- 5. two fingers are the camera, not the amount ---- */
    if (!A.pendingOp) { A.selectedElements = new Set([0]); k.refreshUI(); k.insetSelection(); k.refreshUI(); }
    var v1 = A.pendingOp.amount;
    press(s.x, s.y);
    k.orbit.domElement.dispatchEvent(pev('pointerdown', s.x + 80, s.y + 40, 2));
    move(s.x + 90, s.y);
    log('5.two_fingers_do_not_set', A.pendingOp && Math.abs(A.pendingOp.amount - v1) < 1e-9 && !k.amountDrag
      ? 'amount untouched' : 'A PINCH MOVED THE AMOUNT');
    lift(s.x + 90, s.y);
    k.orbit.domElement.dispatchEvent(pev('pointerup', s.x + 80, s.y + 40, 2));

    /* ---- 6. an op with no amount is not eligible ---- */
    k.cancelPendingOp();
    log('6.no_op_not_eligible', k.amountDragEligible() ? 'ELIGIBLE WITH NO OP' : 'nothing to drag');
    press(s.x, s.y); move(s.x + 60, s.y);
    log('6.no_op_no_drag', !k.amountDrag ? 'the camera keeps the press' : 'A DRAG WITH NO OP');
    lift(s.x + 60, s.y);

    log('7.page_errors', errs.length ? errs.join(' | ').slice(0, 400) : 'none');
  }

  function ready(cb, t) {
    t = t || 0;
    if (window.__kubik && window.__kubik.App) return cb();
    if (t > 250) { out.push('ERROR=no __kubik'); out.push('page.errors=' + (errs.join(' | ') || 'none')); return finish(); }
    setTimeout(function () { ready(cb, t + 1); }, 20);
  }
  function finish() {
    var pre = document.createElement('pre');
    pre.id = 'probeOut';
    pre.textContent = '<<<PROBE\n' + out.join('\n') + '\nPROBE>>>';
    document.body.appendChild(pre);
    document.title = 'PROBE-DONE';
  }
  setTimeout(function () {
    ready(function () {
      setTimeout(function () {
        try { main(); } catch (e) {
          out.push('ERROR=' + (e && e.stack ? e.stack.split('\n').slice(0, 6).join(' / ') : e));
        }
        finish();
      }, 600);
    });
  }, 300);
})();
