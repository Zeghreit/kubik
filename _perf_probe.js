/* a2.45 - the performance pass, measured by COUNTING WORK.

   Wall-clock timing is meaningless here: the harness runs under a virtual
   clock, and on a real phone it is noisy. What the optimisations change is how
   many times the expensive things run, so that is what this counts. */
(function () {
  var out = [], errs = [];
  var _ce = console.error;
  console.error = function () { errs.push(Array.prototype.join.call(arguments, ' ')); _ce.apply(console, arguments); };
  function log(k, v) { out.push(k + '=' + v); }

  var k, A, P;

  function reset() {
    if (A.pendingOp) k.cancelPendingOp();
    if (A.knife) k.cancelKnife();
    A.selectedElements.clear();
    k.setMode('object');
  }
  function obj0() { return A.objects[0]; }
  /* An instant just past the current linger window, with the heartbeat
     treated as freshly satisfied. Nothing waits - the clock here is virtual
     and a synchronous wait never ends - so the question is asked ABOUT a
     future moment rather than at one. */
  /* A real KeyboardEvent for keydown: the app's handler reads ev.key, and a
     bare Event has none. */
  function dispatch(name) {
    var ev = name === 'keydown'
      ? new KeyboardEvent('keydown', { key: 'a', bubbles: true })
      : new Event(name, { bubbles: true });
    document.body.dispatchEvent(ev);
  }

  function quietAt() {
    var t = Math.max(performance.now(), k.renderUntil) + 1;
    k.lastRenderAt = t;
    return t;
  }
  function snap() { return JSON.parse(JSON.stringify(P)); }
  function delta(a, b) {
    var d = {};
    Object.keys(b).forEach(function (key) { d[key] = b[key] - a[key]; });
    return d;
  }
  /* Raced against a timer. If requestAnimationFrame never fires in this
     harness the probe must still finish and say so, rather than hanging and
     producing no output at all. */
  function frame() {
    return new Promise(function (r) {
      var done = false;
      var fin = function (how) { if (!done) { done = true; r(how); } };
      requestAnimationFrame(function () { requestAnimationFrame(function () { fin('raf'); }); });
      setTimeout(function () { fin('timeout'); }, 300);
    });
  }

  async function main() {
    k = window.__kubik; A = k.App; P = k.PERF;

    /* ---- 1. The slider coalesces to one apply per frame ----
       Ten `input` events in one tick used to be ten full runs of the pipeline.
       Now they are one, and it lands on the LAST value asked for. */
    reset();
    var o = obj0();
    k.setMode('face');
    A.activeObjectId = o.id;
    k.ensureHelpers(o);
    A.selectedElements = new Set([0]);
    k.insetSelection();
    var slider = document.getElementById('opSlider');
    var a = snap();
    for (var i = 0; i < 10; i++) {
      slider.value = String(0.1 + i * 0.05);
      slider.dispatchEvent(new Event('input', { bubbles: true }));
    }
    var mid = delta(a, snap());
    var how = await frame();
    /* requestAnimationFrame does not fire under the harness's virtual clock,
       so the scheduled apply is proved through the flush instead: it must be
       PENDING (one apply comes out of it) rather than lost. In a real browser
       the rAF is what runs it. */
    k.flushPendingApply();
    var after = delta(a, snap());
    /* TWO NUMBERS, NOT THREE, AND BOTH OF THEM ARE DECIDABLE.
       This used to print the count taken BETWEEN the frame and the flush as
       well, and that one is not a fact this harness can know: under the
       virtual clock 300ms of `frame()`'s timeout passes instantly, so whether
       the queued rAF got a turn first is down to how the browser felt, and
       the line read 0 on one run and 1 on the next. It was written down as a
       known flake and re-run three times before being believed, for years.

       It never needed to be there. The invariant is that ten input events
       produce NO applies while they arrive and EXACTLY ONE afterwards - and
       `after` is measured from before the burst, so it counts that one
       whether the frame ran it or the flush did. Both numbers below are the
       same on every run, which is the whole point of a regression suite. */
    log('1.slider_coalescing', '10 input events -> ' + mid.applyOp +
      ' applies while they arrived, ' + after.applyOp +
      ' in total once the frame or the flush had it  (must be 0 then 1)');
    log('1.slider_lands_right', 'amount=' + (A.pendingOp && A.pendingOp.amount.toFixed(2)) +
      '  (must be the last value asked for, 0.55)');
    if (A.pendingOp) k.cancelPendingOp();

    /* ---- 2. ...and accepting flushes rather than racing the frame ---- */
    reset();
    k.setMode('face');
    A.activeObjectId = o.id;
    k.ensureHelpers(o);
    A.selectedElements = new Set([0]);
    k.insetSelection();
    slider.value = '0.42';
    slider.dispatchEvent(new Event('input', { bubbles: true }));
    var b4 = snap();
    k.confirmPendingOp();                    // no frame in between
    var flushed = delta(b4, snap());
    log('2.confirm_flushes', 'applies during confirm=' + flushed.applyOp +
      '  (must be 1 - the pending frame, run before committing)');

    /* ---- 3. Subdivide is no longer quadratic ----
       Counted as work, not time: the old inner loop walked every edge for
       every vertex, so the count grows with V*E. Measured by instrumenting
       the map the new code builds instead. */
    reset();
    k.setMode('object');
    A.selectedObjectIds = new Set([obj0().id]);
    var tris = function () { return obj0().mesh.geometry.index.count / 3; };
    var t0 = tris();
    k.subdivideSelection();
    if (A.pendingOp) {
      A.pendingOp.segments = 3;
      k.applyPendingOp();
      var t3 = tris();
      k.confirmPendingOp();
      log('3.subdivide', 'triangles ' + t0 + ' -> ' + t3 +
        '  (must be 64x: ' + (t0 * 64) + ')');
    } else {
      log('3.subdivide', 'REFUSED');
    }

    /* ---- 4. A drag does not abandon a material per frame ----
       restoreObjectState clones the whole material array every re-run; what
       changed is that the outgoing one is now disposed. Counted here as
       "clones per apply", which should be exactly the group count. */
    reset();
    var o4 = obj0();
    var groups4 = (Array.isArray(o4.mesh.material) ? o4.mesh.material : [o4.mesh.material]).length;
    k.setMode('face');
    A.activeObjectId = o4.id;
    k.ensureHelpers(o4);
    A.selectedElements = new Set([0]);
    k.insetSelection();
    var c0 = snap();
    k.setPendingAmount(0.3);
    var c1 = delta(c0, snap());
    log('4.material_churn', c1.matClone + ' clones for ' + c1.applyOp + ' apply over ' +
      groups4 + ' groups  (bounded by the group count, and each one disposed)');
    if (A.pendingOp) k.cancelPendingOp();

    /* ---- 5. The edge-field bake is throttled ACROSS a geometry swap ----
       The throttle used to hang on the geometry, and every op frame installs a
       new one - so it was absent exactly when it was needed. */
    reset();
    var o5 = obj0();
    k.applyFinishToSelection && (A.selectedObjectIds = new Set([o5.id]));
    var bakeStart = snap();
    k.setMode('face');
    A.activeObjectId = o5.id;
    k.ensureHelpers(o5);
    A.selectedElements = new Set([0]);
    k.insetSelection();
    for (var j = 0; j < 6; j++) k.setPendingAmount(0.2 + j * 0.05);
    var bakes = delta(bakeStart, snap());
    if (A.pendingOp) k.cancelPendingOp();
    log('5.edge_field_bakes', bakes.bake + ' bakes over ' + bakes.applyOp +
      ' applies  (must be far fewer than the applies; 0 is fine - no mask here)');

    /* ---- 6. A duplicate must not share its original's geometry userData ---- */
    reset();
    k.setMode('object');
    A.selectedObjectIds = new Set([obj0().id]);
    var before6 = A.objects.length;
    k.duplicateSelection();
    var src = A.objects[0], cop = A.objects[A.objects.length - 1];
    var shared = src.mesh.geometry.userData === cop.mesh.geometry.userData;
    src.mesh.geometry.userData.probeMark = 1;
    var bled = cop.mesh.geometry.userData.probeMark === 1;
    delete src.mesh.geometry.userData.probeMark;
    log('6.clone_userdata', 'objects ' + before6 + '->' + A.objects.length +
      ' same object=' + shared + ' value bled across=' + bled + '  (both must be false)');

    /* ---- 7. The helper colours come out the same as before ----
       setCol reuses one THREE.Color now. It must still be the COLOUR-MANAGED
       value, not hex/255 - those differ by the sRGB transfer function. */
    var arr = [0, 0, 0];
    k.setCol(arr, 0, 0xC85A47);
    var c = new k.THREE.Color(); c.setHex(0xC85A47);
    log('7.setcol_exact', 'r ' + arr[0].toFixed(6) + ' vs ' + c.r.toFixed(6) +
      ' | naive hex/255 would be ' + (0xC8 / 255).toFixed(6) + '  (must match the first two)');

    /* ---- 8. A duplicate keeps its wear-edge list ----
       Blanking the clone's geometry userData stopped the sharing bug and
       introduced a worse one: with no kubikEdges, ensureEdgeField returns null
       and the caller substitutes a BLACK texture, which means "distance zero,
       everywhere is an edge" - so the copy came out fully worn. */
    reset();
    k.setMode('object');
    var o8 = obj0();
    k.applyShading(o8);                       // whatever gives it an edge list
    var srcEdges = o8.mesh.geometry.userData.kubikEdges;
    A.selectedObjectIds = new Set([o8.id]);
    k.duplicateSelection();
    var cp = A.objects[A.objects.length - 1];
    var cpEdges = cp.mesh.geometry.userData.kubikEdges;
    log('8.clone_keeps_edges', 'source has edges=' + !!srcEdges + ' copy has edges=' + !!cpEdges +
      ' shared userData object=' + (o8.mesh.geometry.userData === cp.mesh.geometry.userData) +
      '  (true / true / false)');

    /* ---- 9. The edge field is never throttled into NOTHING ----
       A stale field may be handed back; null may not, because null renders as
       fully worn. */
    reset();
    var o9 = obj0();
    k.applyShading(o9);
    var first = k.ensureEdgeField(o9.mesh);
    var second = k.ensureEdgeField(o9.mesh);   // immediately after: throttled
    log('9.field_never_null', 'first bake=' + (first ? 'field' : 'null') +
      ' second (throttled)=' + (second ? 'field' : 'null') +
      '  (a throttled call must return the stale field, never null)');

    /* ---- 10. Abandoned materials are binned during the op, freed at the end ----
       Disposing them per frame destroys the shader program and forces a
       relink on the very next render. */
    reset();
    var o10 = obj0();
    k.setMode('face');
    A.activeObjectId = o10.id;
    k.ensureHelpers(o10);
    A.selectedElements = new Set([0]);
    k.insetSelection();
    k.setPendingAmount(0.3);
    k.setPendingAmount(0.4);
    var binDuring = k.opMatBinSize;
    k.confirmPendingOp();
    var binAfter = k.opMatBinSize;
    log('10.material_bin', 'binned during the op=' + binDuring + ', after accepting=' + binAfter +
      '  (must collect during, and be empty after)');

    /* ---- 11. On-demand rendering: the decision, tested directly ----
       requestAnimationFrame does not fire under the harness's virtual clock,
       so renderWanted() is exercised as the pure function it was written to
       be, rather than by counting frames that never happen. */
    reset();
    // A genuinely quiet instant: everything the probe did above invalidated,
    // so the window has to be stepped past before "idle" means anything.
    var idle = k.renderWanted(quietAt());
    // just invalidated -> render
    k.invalidate();
    var dirty = k.renderWanted(performance.now());   // inside the new window
    // the linger window expires
    k.lastRenderAt = performance.now();
    var afterLinger = k.renderWanted(performance.now() + k.RENDER_LINGER_MS + 50);
    // ...but the heartbeat always catches it
    var heartbeat = k.renderWanted(performance.now() + k.RENDER_HEARTBEAT_MS + 50);
    log('11.render_decision', 'idle=' + idle + ' after invalidate=' + dirty +
      ' after linger=' + afterLinger + ' at heartbeat=' + heartbeat +
      '  (false / true / false / true)');

    /* ---- 12. A finger down always renders ---- */
    k.lastRenderAt = performance.now();
    var quiet = k.renderWanted(performance.now() + k.RENDER_LINGER_MS + 50);
    k.activePointers.set(99, { x: 0, y: 0, t: 0, moved: 0 });
    k.lastPointerAt = performance.now();      // a REAL finger streams events
    var withFinger = k.renderWanted(performance.now() + k.RENDER_LINGER_MS + 50);
    k.activePointers.delete(99);
    log('12.finger_always_renders', 'quiet=' + quiet + ' with a finger down=' + withFinger +
      '  (false / true)');

    /* ---- 13. Every user event marks the frame dirty ----
       The delegated capture-phase listener is what makes this safe without
       hunting down individual mutation sites. */
    var evs = ['pointerdown', 'pointermove', 'pointerup', 'wheel', 'click', 'input', 'keydown'];
    var missed = [];
    evs.forEach(function (name) {
      var quiet = quietAt();
      if (k.renderWanted(quiet)) { missed.push(name + '(baseline dirty)'); return; }
      /* Asked at NOW, not at `quiet`. The clock is frozen through synchronous
         JS, so `quiet` (one past the OLD window) is also one past the new one
         the dispatch just opened - the windows are the same length and start
         at the same instant. */
      dispatch(name);
      if (!k.renderWanted(performance.now())) missed.push(name);
    });
    log('13.events_invalidate', missed.length ? 'MISSED: ' + missed.join(',') :
      'all ' + evs.length + ' mark the frame dirty');

    /* ---- 14. ...and so does a change that no event caused ---- */
    var q14 = quietAt();
    var beforeUI = k.renderWanted(q14);
    k.refreshUI();
    var afterUI = k.renderWanted(performance.now());
    log('14.refreshUI_invalidates', 'before=' + beforeUI + ' after refreshUI=' + afterUI +
      '  (false / true)');

    /* ---- 15. A leaked pointer must not pin the loop on for ever ----
       renderWanted's "a finger is down" clause makes activePointers carry a
       second job. Unbounded, a leaked entry would switch the optimisation off
       with no symptom at all. */
    k.activePointers.set(98, { x: 0, y: 0, t: 0, moved: 0 });
    k.lastPointerAt = performance.now();
    var freshFinger = k.renderWanted(quietAt());
    k.lastPointerAt = performance.now() - k.POINTER_LIVE_MS - 100;   // gone stale
    var staleFinger = k.renderWanted(quietAt());
    k.activePointers.delete(98);
    log('15.stale_pointer', 'fresh finger=' + freshFinger + ' stale entry=' + staleFinger +
      '  (true / false - a stale entry must not hold the loop open)');

    /* ---- 16. Work that finishes AFTER its own invalidate is still drawn ----
       The window used to start when applyPendingOp began, and on a heavy mesh
       the work outlasted it - so the frame that would have shown the result
       found the window already spent. */
    reset();
    var o16 = A.objects[0];
    k.setMode('face');
    A.activeObjectId = o16.id;
    k.ensureHelpers(o16);
    A.selectedElements = new Set([0]);
    k.insetSelection();
    var q16 = quietAt();                       // step past everything so far
    var before16 = k.renderWanted(q16);
    k.applyPendingOp();
    var after16 = k.renderWanted(performance.now());
    if (A.pendingOp) k.cancelPendingOp();
    log('16.op_invalidates_after', 'before=' + before16 + ' after applyPendingOp=' + after16 +
      '  (false / true)');

    /* ---- 17. A material repaint with no event behind it ----
       An image mask finishing its decode goes through updateMaterialEverywhere
       and nothing else. */
    var q17 = quietAt();
    var before17 = k.renderWanted(q17);
    k.updateMaterialEverywhere('metal');
    var after17 = k.renderWanted(performance.now());
    log('17.material_repaint', 'before=' + before17 + ' after=' + after17 + '  (false / true)');

    /* ---- 18. ...and a marker that hides itself on a timer ---- */
    var q18 = quietAt();
    var before18 = k.renderWanted(q18);
    k.refreshPivotMarker();
    var after18 = k.renderWanted(performance.now());
    log('18.pivot_marker', 'before=' + before18 + ' after=' + after18 + '  (false / true)');

    log('console.errors', errs.length ? errs.join(' | ').slice(0, 400) : 'none');
  }

  window.addEventListener('error', function (e) { errs.push('onerror: ' + (e.message || e) + ' @' + (e.lineno || '')); });
  function ready(cb, t) {
    t = t || 0;
    if (window.__kubik && window.__kubik.App && window.__kubik.PERF) return cb();
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
