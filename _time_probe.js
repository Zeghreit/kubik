/* a2.74 - where does the time actually go?

   Runs WITHOUT --virtual-time-budget, so performance.now() is a real clock,
   and posts its results back rather than waiting to be scraped. Numbers here
   are headless-SwiftShader-on-a-desktop, not an iPhone - but the work being
   measured is CPU-side JavaScript, so the SHAPE of the curve and the
   RELATIVE cost of the phases are what carry over. An absolute millisecond
   figure from this harness means very little; "this phase is 80% of it" and
   "it grows 4x per level" mean a lot. */
(function () {
  var out = [], errs = [];
  var _ce = console.error;
  console.error = function () { errs.push(Array.prototype.join.call(arguments, ' ')); _ce.apply(console, arguments); };
  function log(k, v) { out.push(k + '=' + v); }
  var k, A, THREE;

  // Median of several runs: one run on a cold JIT is noise, not a number.
  function timeIt(runs, fn) {
    var ts = [];
    for (var i = 0; i < runs; i++) {
      var t0 = performance.now();
      fn(i);
      ts.push(performance.now() - t0);
    }
    ts.sort(function (a, b) { return a - b; });
    return ts[Math.floor(ts.length / 2)];
  }
  function ms(x) { return x.toFixed(1) + 'ms'; }

  function freshCube() {
    var o = k.createCubeObject('T', new THREE.Vector3(0, 0, 0));
    A.selectedObjectIds = new Set([o.id]);
    A.activeObjectId = o.id;
    /* The app runs a UI pass after every committed op, and that pass is
       what decides whether an object needs a wear-edge list. Without it the
       flag is undefined and a2.75's guard falls back to "build it", which
       is a state the app is never actually in. */
    k.refreshUI();
    return o;
  }
  function selectAllFaces(o) {
    k.setMode('face');
    var n = o.mesh.geometry.groups.length;
    A.selectedElements = new Set();
    for (var i = 0; i < n; i++) A.selectedElements.add(i);
  }
  /* Subdivide is an OBJECT-mode op that opens a pending op rather than
     doing anything: it has to be applied and confirmed, which is what the
     slider and the tick do. `amount` is whatever the op's own spec means by
     it, and is left alone here - one call, one level. */
  function subdivideOnce(o) {
    k.setMode('object');
    A.selectedObjectIds = new Set([o.id]);
    A.activeObjectId = o.id;
    A.selectedElements = new Set();
    k.subdivideSelection();
    if (!A.pendingOp) return false;
    k.flushPendingApply();
    k.confirmPendingOp();
    return true;
  }
  function tris(o) { return o.mesh.geometry.index.count / 3; }

  function main() {
    k = window.__kubik; A = k.App; THREE = k.THREE;

    /* ---- 1. Subdivide, level by level ----
       The standing note says superlinear, L5 = 1454ms. Superlinear in WHAT
       is the question: each level multiplies the triangle count by 4, so
       4x per level is LINEAR in output size and is the floor. Anything
       steeper than 4x is the actual problem. */
    var o = freshCube();
    var rows = [], prev = 0, ok1 = true;
    for (var lv = 1; lv <= 5; lv++) {
      var before = tris(o);
      var t = timeIt(1, function () { ok1 = subdivideOnce(o) && ok1; });
      var n = tris(o);
      if (n === before) { rows.push('L' + lv + ' DID NOT SUBDIVIDE'); break; }
      rows.push('L' + lv + ' ' + n + ' tris ' + ms(t) +
        (prev ? ' (x' + (t / prev).toFixed(1) + ')' : ''));
      prev = t;
      if (n > 200000) break;
    }
    log('1.subdivide', rows.join(' | '));

    /* THE SLIDER IS THE OTHER HALF, and probably the worse one. A pending op
       re-runs from its own snapshot on every change, so dragging a subdivide
       slider up through the levels does not add a level - it redoes ALL of
       them, from the cube, on every frame of the drag. */
    var o1b = freshCube();
    k.setMode('object');
    A.selectedObjectIds = new Set([o1b.id]);
    A.activeObjectId = o1b.id;
    k.subdivideSelection();
    if (A.pendingOp) {
      var spec = A.pendingOp.kind + ' amount=' + A.pendingOp.amount;
      var srows = [];
      for (var amt = 1; amt <= 4; amt++) {
        var ta = timeIt(1, function () {
          k.setPendingAmount(amt);
          k.flushPendingApply();
        });
        srows.push('amount ' + amt + ' -> ' + tris(o1b) + ' tris ' + ms(ta));
      }
      log('1b.pending', spec);
      log('1b.slider_frames', srows.join(' | '));
      k.cancelPendingOp();
    } else {
      log('1b.slider_frames', 'no pending op to drive');
    }
    var last = rows[rows.length - 1];
    log('1.growth', 'a level multiplies triangles by 4, so 4x time per level is LINEAR ' +
      'in output and is the floor; more than that is the superlinearity');

    /* ---- 2. Where does one subdivide SPEND it? ----
       Rebuilt at a size big enough to matter but small enough to repeat. */
    var o2 = freshCube();
    subdivideOnce(o2); subdivideOnce(o2); subdivideOnce(o2);
    log('2.mesh', tris(o2) + ' triangles, ' + o2.mesh.geometry.groups.length + ' faces, ' +
      o2.mesh.userData.topo.logicalCount + ' vertices');

    var ed = null;
    var tEditable = timeIt(5, function () { ed = k.toEditable(o2.mesh); });
    var tRebuild = timeIt(5, function () { k.rebuildFromEditable(o2, k.toEditable(o2.mesh)); });
    var tShade = timeIt(5, function () { k.applyShading(o2); });
    var tField = timeIt(5, function () {
      k.disposeEdgeField && k.disposeEdgeField(o2.mesh.geometry);
      k.ensureEdgeField(o2.mesh.geometry);
    });
    log('2.phases', 'toEditable ' + ms(tEditable) + ' | rebuildFromEditable ' + ms(tRebuild) +
      ' (includes topology + shading) | applyShading ' + ms(tShade) +
      ' | ensureEdgeField ' + ms(tField));
    log('2.rebuild_share', 'rebuildFromEditable is the funnel every op ends at, so its cost ' +
      'is the floor under every single operation in the app');

    /* ---- 3. THE OP-BAR DRAG. The claim on the queue is that it rebuilds
       the face overlay every frame. a2.64a's own comment says that was
       measured and found mis-stated. Settle it: count how many times the
       overlay's index is replaced across a slider drag, and time the frame. */
    var o3 = freshCube();
    subdivideOnce(o3); subdivideOnce(o3);
    k.setMode('face');
    A.selectedElements = new Set([0, 1, 2, 3]);
    k.refreshUI();
    var ov = o3.mesh.userData.faceOverlay;
    var setIndexCalls = 0;
    if (ov) {
      var realSetIndex = ov.geometry.setIndex.bind(ov.geometry);
      ov.geometry.setIndex = function (x) { setIndexCalls++; return realSetIndex(x); };
    }
    log('3.overlay_exists', ov ? 'the face overlay is built' : 'NO OVERLAY - test is inconclusive');

    k.extrudeSelection && k.extrudeSelection();
    log('3.pending', A.pendingOp ? A.pendingOp.kind : 'NO PENDING OP - frame test is inconclusive');
    var frames = 0;
    var tFrame = timeIt(12, function (i) {
      k.setPendingAmount(0.1 + i * 0.02);
      k.flushPendingApply();
      frames++;
    });
    log('3.drag_frame', ms(tFrame) + ' per slider frame on a ' + tris(o3) +
      '-triangle mesh, over ' + frames + ' frames');
    log('3.overlay_rebuilds', setIndexCalls + ' overlay index rebuilds across ' + frames +
      ' frames' + (setIndexCalls <= 1
        ? ' - the standing note is MIS-STATED, it does not rebuild per frame'
        : ' - IT REALLY DOES REBUILD PER FRAME'));
    k.cancelPendingOp && k.cancelPendingOp();

    /* ---- 4. refreshUI on a dense mesh ----
       It runs after every committed op and walks every material. */
    var tUI = timeIt(8, function () { k.refreshUI(); });
    log('4.refreshUI', ms(tUI) + ' on ' + tris(o3) + ' triangles / ' +
      o3.mesh.geometry.groups.length + ' faces');

    /* ---- 5. And the picker, now that it raycasts ---- */
    k.setMode('vertex');
    A.selectedElements = new Set();
    k.camera.position.set(3, 2.4, 3.6);
    k.camera.lookAt(0, 0, 0);
    k.camera.updateMatrixWorld(true);
    var vp = document.getElementById('viewport').getBoundingClientRect();
    var tPick = timeIt(20, function () {
      k.pickVertexOnActive({ clientX: vp.left + 450, clientY: vp.top + 350 });
    });
    log('5.pick', ms(tPick) + ' per vertex pick on ' + tris(o3) + ' triangles');

    /* ---- 6. INSIDE applyShading, which is where the time is ----
       Section 2 put rebuildFromEditable at 2.6ms and applyShading at 2.5ms
       of it. Every op in the app ends at rebuildFromEditable, so this is the
       floor under all of them - and worth taking apart.

       Two things stand out on reading it. It calls geo.computeVertexNormals()
       as a safety baseline and then computes its own normals anyway, so
       normals are built TWICE per call. And the triangle-normal loop
       allocates three THREE.Vector3 objects per triangle. */
    var o6 = freshCube();
    for (var d6 = 0; d6 < 4; d6++) subdivideOnce(o6);      // 3072 triangles
    var geo6 = o6.mesh.geometry;
    log('6.mesh', tris(o6) + ' triangles, ' + geo6.groups.length + ' faces');

    log('6.wants_wear', 'wantsWear=' + o6.mesh.userData.wantsWear +
      ' (false means the wear-edge pass is skipped for it, which is the ' +
      'common case - no shape mask on the material)');
    var tShade6 = timeIt(7, function () { k.applyShading(o6); });
    var tNormals = timeIt(7, function () { geo6.computeVertexNormals(); });
    log('6.applyShading', ms(tShade6));
    log('6.computeVertexNormals_alone', ms(tNormals) + ' - ' +
      (100 * tNormals / tShade6).toFixed(0) + '% of applyShading, and it is run as a ' +
      'SAFETY BASELINE before the function computes its own normals anyway');

    /* What an allocation-free triangle-normal pass costs, for comparison
       with the one inside applyShading that news three Vector3s per
       triangle. Same arithmetic, same reads, flat arrays. */
    var idx6 = geo6.index, pos6 = geo6.attributes.position;
    var tRaw = timeIt(7, function () {
      var nT = idx6.count / 3, acc = 0;
      for (var t = 0; t < nT; t++) {
        var ia = idx6.getX(t * 3), ib = idx6.getX(t * 3 + 1), ic = idx6.getX(t * 3 + 2);
        var ax = pos6.getX(ia), ay = pos6.getY(ia), az = pos6.getZ(ia);
        var ux = pos6.getX(ib) - ax, uy = pos6.getY(ib) - ay, uz = pos6.getZ(ib) - az;
        var vx = pos6.getX(ic) - ax, vy = pos6.getY(ic) - ay, vz = pos6.getZ(ic) - az;
        acc += (uy * vz - uz * vy) + (uz * vx - ux * vz) + (ux * vy - uy * vx);
      }
      return acc;
    });
    log('6.raw_normal_pass', ms(tRaw) + ' for the same arithmetic with no allocation, ' +
      'against ' + ms(tShade6) + ' for the whole of applyShading');

    /* And how the whole thing scales, since that is the question the
       "superlinear" note was really about. */
    var o6b = freshCube();
    var srows6 = [];
    for (var d = 0; d < 5; d++) {
      subdivideOnce(o6b);
      var tS = timeIt(3, function () { k.applyShading(o6b); });
      srows6.push(tris(o6b) + 'tri ' + ms(tS));
      if (tris(o6b) > 20000) break;
    }
    log('6.shading_curve', srows6.join(' | '));

    /* ---- 7. THE CACHE THAT CANNOT HIT ----
       applyShading gets its topology from shadingTopoFor(geo), cached per
       geometry. Section 6 measured seven calls on one geometry, so six of
       them hit that cache. But rebuildFromEditable installs a NEW geometry
       on every op, so during real work the cache misses EVERY time. The gap
       between the two is the part of the cost that section 6 could not see -
       and it is paid on every frame of an op-bar drag. */
    var o7 = freshCube();
    for (var d7 = 0; d7 < 4; d7++) subdivideOnce(o7);
    var n7 = tris(o7);
    var edCache = k.toEditable(o7.mesh);

    var tWarm = timeIt(7, function () { k.applyShading(o7); });
    // A fresh geometry each time, which is what an op hands it.
    var tCold = timeIt(7, function () {
      k.rebuildFromEditable(o7, k.toEditable(o7.mesh));
    });
    log('7.mesh', n7 + ' triangles');
    log('7.shading_warm_cache', ms(tWarm) + ' (same geometry seven times - six cache hits)');
    log('7.rebuild_cold_cache', ms(tCold) + ' (a new geometry each time, which is what every op does)');
    log('7.verdict', tCold > tWarm * 1.5
      ? 'the topology rebuild is ' + ms(tCold - tWarm) + ' of it, and NOTHING can cache it ' +
        'while every op installs a new geometry'
      : 'the cache is not the story - the per-call work is');
    void edCache;

    /* And what that means for a drag, at the size an import now makes one
       tap away. */
    log('7.drag_budget', 'a 60fps frame is 16.7ms; one op-bar frame on ' + n7 +
      ' triangles costs ' + ms(tCold) + ' here, and a phone is slower still');

    /* ---- 8. WHAT THE WEAR PASS COSTS, measured against itself ----
       a2.75 skips the convex/concave edge list for objects that do not wear
       a shape mask. The flag is the only difference, so flipping it on the
       same object in the same run isolates the pass exactly - no machine
       drift, no JIT difference, no other variable. */
    var o8 = freshCube();
    for (var d8 = 0; d8 < 4; d8++) subdivideOnce(o8);
    log('8.mesh', tris(o8) + ' triangles, wantsWear=' + o8.mesh.userData.wantsWear);

    o8.mesh.userData.wantsWear = true;
    var tWith = timeIt(9, function () { k.applyShading(o8); });
    var hadList = !!o8.mesh.geometry.userData.kubikEdges;
    o8.mesh.userData.wantsWear = false;
    var tWithout = timeIt(9, function () { k.applyShading(o8); });
    var noList = !o8.mesh.geometry.userData.kubikEdges;

    log('8.with_wear_pass', ms(tWith) + (hadList ? ' (list built)' : ' (NO LIST - test invalid)'));
    log('8.without_wear_pass', ms(tWithout) + (noList ? ' (list skipped)' : ' (LIST STILL BUILT - guard not working)'));
    log('8.saving', hadList && noList
      ? ms(tWith - tWithout) + ', which is ' + (100 * (tWith - tWithout) / tWith).toFixed(0) +
        '% of applyShading - and applyShading is ~95% of rebuildFromEditable, ' +
        'which every op funnels through'
      : 'INCONCLUSIVE - the guard did not do what the flag says');

    /* And it must come BACK when a mask arrives, or the object renders
       fully worn - an absent list means "distance zero, everywhere is an
       edge", which is the failure on record from the duplicate path. */
    o8.mesh.userData.wantsWear = true;
    k.ensureWearLists();
    log('8.refill', o8.mesh.geometry.userData.kubikEdges
      ? 'a mask arriving later refills the list rather than finding it missing'
      : 'THE REFILL DID NOT RUN - the object would render fully worn');

    log('console.errors', errs.length ? errs.join(' | ').slice(0, 300) : 'none');
  }

  function post() {
    try {
      fetch('/result', { method: 'POST', body: out.join('\n') });
    } catch (e) { /* nothing else to try */ }
  }
  function ready(cb, t) {
    t = t || 0;
    if (window.__kubik && window.__kubik.App) return cb();
    if (t > 400) { out.push('ERROR=no __kubik'); return post(); }
    setTimeout(function () { ready(cb, t + 1); }, 20);
  }
  window.addEventListener('error', function (e) { errs.push('onerror: ' + (e.message || e)); });
  setTimeout(function () {
    ready(function () {
      setTimeout(function () {
        try { main(); }
        catch (e) { out.push('ERROR=' + (e && e.stack ? e.stack.split('\n').slice(0, 8).join(' / ') : e)); }
        post();
      }, 800);
    });
  }, 400);
})();
