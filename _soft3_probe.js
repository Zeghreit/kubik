/* The eight defects the a2.37 review found, each driven the way a user hits
   it, with a control wherever one was needed to tell a fix from a fluke. */
(function () {
  var out = [], errs = [];
  var _ce = console.error;
  console.error = function () { errs.push(Array.prototype.join.call(arguments, ' ')); _ce.apply(console, arguments); };
  function log(k, v) { out.push(k + '=' + v); }
  var k, A, T3;

  function lp(obj, l) { return k.logicalPos(obj, l).clone(); }
  function nearestLogical(obj, x, y, z) {
    var t = obj.mesh.userData.topo, best = -1, bd = 1e9, want = new T3.Vector3(x, y, z);
    for (var l = 0; l < t.logicalCount; l++) { var d = lp(obj, l).distanceTo(want); if (d < bd) { bd = d; best = l; } }
    return best;
  }
  function down(id, x, y) {
    k.renderer.domElement.dispatchEvent(new PointerEvent('pointerdown', {
      bubbles: true, pointerId: id, pointerType: 'touch', clientX: x, clientY: y, isPrimary: id === 1 }));
  }
  function move(id, x, y) {
    k.renderer.domElement.dispatchEvent(new PointerEvent('pointermove', {
      bubbles: true, pointerId: id, pointerType: 'touch', clientX: x, clientY: y }));
  }
  function up(id, x, y) {
    k.renderer.domElement.dispatchEvent(new PointerEvent('pointerup', {
      bubbles: true, pointerId: id, pointerType: 'touch', clientX: x, clientY: y }));
  }
  function cancel(id, x, y) {
    k.renderer.domElement.dispatchEvent(new PointerEvent('pointercancel', {
      bubbles: true, pointerId: id, pointerType: 'touch', clientX: x, clientY: y }));
  }
  function hudShown() { return document.getElementById('softHud').classList.contains('show'); }

  var gridN = 0;
  function newGrid(n, size) {
    gridN++;
    k.startGeoSetup('plane');
    if (!A.geoSetup) { log('newGrid.' + gridN, 'STARTGEOSETUP MADE NOTHING'); return null; }
    k.applyGeoParams({ h: n, v: n, x: size, y: 1, z: size });
    /* Keep the id BEFORE finishing. A synthetic tap on empty space earlier in
       the run can have cleared App.activeObjectId, and reading the new object
       back through it then returns undefined - the harness losing its own
       pointer, not the app losing the mesh. */
    var id = A.geoSetup.objId;
    k.finishGeoSetup(true);
    var g = k.findObject(id);
    if (!g) {
      log('newGrid.' + gridN, 'object ' + id + ' vanished; scene holds ' +
        A.objects.map(function (o) { return o.id; }).join(',') + ' (history ' + A.historyIndex + ')');
      return null;
    }
    A.selectedObjectIds = new Set([id]); A.activeObjectId = id;
    k.ensureHelpers(g);
    return g;
  }

  function main() {
    k = window.__kubik; A = k.App; T3 = k.THREE;

    /* ---- 1. Symmetry: the dragged vertex must go where the finger goes ---- */
    var grid = newGrid(8, 8);
    k.setMode('vertex');
    // A vertex off the mirror plane, with the field wide enough to cross it.
    var seed = nearestLogical(grid, 1, 0, 0);
    A.selectedElements = new Set([seed]);
    /* a2.89: the axis became a SET. Written as a one-element set here so
       these sections keep meaning exactly what they meant before. */
    A.symmetry = true; A.symmetryAxes = ['x'];
    k.setSoft(true);
    A.softRadius = 3;
    var partner = nearestLogical(grid, -1, 0, 0);
    var x0 = lp(grid, seed).x, px0 = lp(grid, partner).x;
    var f = k.softWeights(grid, new Set([seed]), 3);
    log('1.field.crosses', (f && f.has(partner)) ? 'yes, the partner is in the field (' + f.get(partner).toFixed(3) + ')' : 'NO - test is not exercising the bug');
    k.beginDirectDrag({ clientX: 400, clientY: 400, pointerId: 1, pointerType: 'touch' });
    var ents = k.dragCtx.entries.length;
    var hasPartner = k.dragCtx.entries.some(function (e) { return e.logical === partner; });
    log('1.partner.dropped', hasPartner ? 'STILL AN ENTRY - will clobber' : 'not an entry, written by its mirror');
    // Drag ALONG the mirror axis: the direction the bug reversed.
    k.applyDeltaToSelection(new T3.Matrix4().makeTranslation(1, 0, 0));
    var dx = lp(grid, seed).x - x0;
    log('1.seed.moved', dx.toFixed(3) + '  want 1.000 (full travel, the right way)');
    log('1.partner.mirrored', (lp(grid, partner).x - px0).toFixed(3) + '  want -1.000 (the mirror of it)');
    k.endDirectDrag();
    A.symmetry = false;

    /* ---- 2. A cancelled touch ends the slide ---- */
    /* A FRESH grid, not an undo. newGrid pushes exactly one history step, so
       undoing the drag from case 1 takes the GRID away with it, and everything
       after that reads a disposed object - which looks like the app losing its
       mesh and is the harness undoing its own fixture. */
    grid = newGrid(8, 8);
    k.setMode('vertex');
    A.selectedElements = new Set([nearestLogical(grid, 0, 0, 0)]);
    k.setSoft(true);
    down(1, 300, 400); down(2, 340, 400); down(3, 380, 400);
    move(1, 340, 400); move(2, 380, 400); move(3, 420, 400);
    log('2.engaged', k.softSlide ? 'yes' : 'NO');
    var rCancel = A.softRadius;
    cancel(1, 340, 400); cancel(2, 380, 400); cancel(3, 420, 400);
    log('2.cancel.ends', k.softSlide ? 'STILL SLIDING' : 'ended');
    log('2.hud.gone', hudShown() ? 'STILL SHOWN' : 'hidden');
    log('2.orbit.back', k.orbit.enabled ? 'enabled' : 'STILL DISABLED');
    // The killer: one finger afterwards must not rewrite the radius.
    down(1, 100, 400); move(1, 800, 400); up(1, 800, 400);
    log('2.stray.finger', Math.abs(A.softRadius - rCancel) < 1e-9
      ? 'radius untouched' : 'REWROTE the radius ' + rCancel.toFixed(2) + ' -> ' + A.softRadius.toFixed(2));

    /* ---- 3. A third finger during an orbit must not engage instantly ---- */
    var r0 = A.softRadius;
    down(1, 300, 400); down(2, 340, 400);
    for (var i = 0; i < 10; i++) { move(1, 300 + i * 20, 400); move(2, 340 + i * 20, 400); }  // a 200px orbit
    down(3, 380, 400);                       // a third finger lands, still
    move(1, 482, 400); move(2, 522, 400); move(3, 382, 400);   // 2px of new travel
    log('3.no.instant', k.softSlide ? 'ENGAGED ON THE ORBIT’S OLD TRAVEL' : 'not engaged');
    log('3.radius.safe', Math.abs(A.softRadius - r0) < 1e-9 ? 'untouched' : 'CHANGED');
    // ... and it still engages once the NEW hand commits.
    move(1, 522, 400); move(2, 562, 400); move(3, 422, 400);
    log('3.engages.after', k.softSlide ? 'yes, once the hand travels' : 'NEVER ENGAGES');
    up(1, 522, 400); up(2, 562, 400); up(3, 422, 400);

    /* ---- 4. A fourth finger re-baselines instead of jumping ---- */
    A.softRadius = 2;
    down(1, 300, 400); down(2, 340, 400); down(3, 380, 400);
    move(1, 340, 400); move(2, 380, 400); move(3, 420, 400);
    var rBefore = A.softRadius, orbitDuring = k.orbit.enabled;
    down(4, 900, 400);                      // far away, so a raw mean would leap
    move(4, 902, 400);
    log('4.orbit.held', k.orbit.enabled ? 'RE-ENABLED MID-GESTURE' : 'still released to the gesture');
    log('4.no.jump', Math.abs(A.softRadius - rBefore) / rBefore < 0.05
      ? 'radius steady across the new finger' : 'JUMPED ' + rBefore.toFixed(2) + ' -> ' + A.softRadius.toFixed(2));
    up(1, 340, 400); up(2, 380, 400); up(3, 420, 400); up(4, 902, 400);
    log('4.ended', k.softSlide ? 'STILL SLIDING' : 'ended');

    /* ---- 5. TWO rebuilds in a row must not be mistaken for one mesh ----

       The signature leans on the position attribute's version to notice a
       changed mesh, and restoreDoc builds a BRAND NEW attribute every time -
       which starts at version 0. So two restores in a row (undo then redo, or
       any two loads) produced identical signatures for different meshes, and
       the second handed back the first one's field. One restore alone cannot
       show it: the version before the restore is non-zero, so the signature
       differs by luck. */
    var coarse = newGrid(4, 4);
    k.setMode('vertex');
    var cid = coarse.id;
    A.selectedElements = new Set([nearestLogical(coarse, 0, 0, 0)]);
    k.setSoft(true); A.softRadius = 2.5;
    var docCoarse = k.serializeDoc();
    // The same object, made denser in place, so the two documents differ in
    // vertex count while agreeing on everything the signature reads.
    k.setPrimitiveGeometry(coarse, 'plane', k.primParams('plane', { h: 10, v: 10, x: 4, y: 1, z: 4 }));
    k.ensureHelpers(coarse);
    var docFine = k.serializeDoc();

    function fieldAfter(doc) {
      k.restoreDoc(doc, { keepAppearance: true, keepSelection: true });
      var o = k.findObject(cid);
      if (!o) return { n: -1, verts: -1 };
      k.ensureHelpers(o);
      A.selectedObjectIds = new Set([cid]); A.activeObjectId = cid;
      A.selectedElements = new Set([nearestLogical(o, 0, 0, 0)]);
      var f = k.refreshSoftField(o);
      return { n: f ? f.size : 0, verts: o.mesh.userData.topo.logicalCount };
    }
    var a = fieldAfter(docCoarse);
    var b = fieldAfter(docFine);
    var c = fieldAfter(docCoarse);
    log('5.coarse', a.n + ' of ' + a.verts + ' verts');
    log('5.fine', b.n + ' of ' + b.verts + ' verts');
    log('5.coarse.again', c.n + ' of ' + c.verts + ' verts');
    log('5.distinguishes', (a.n === c.n && b.n !== a.n)
      ? 'each rebuild read its own mesh'
      : 'STALE: the field did not follow the mesh (' + a.n + '/' + b.n + '/' + c.n + ')');
    log('5.field.valid', (function () {
      var o = k.findObject(cid);
      if (!k.softField || !o) return 'no field';
      var n = o.mesh.userData.topo.logicalCount, bad = 0;
      k.softField.forEach(function (w, l) { if (l >= n) bad++; });
      return bad ? bad + ' WEIGHTS POINT PAST THE MESH' : 'every weight is a real vertex';
    })());

    /* ---- 6. Switching the ACTIVE object re-measures the radius ----

       The path that was missed: not setSoft, but a tap on another object's
       surface while already in Soft. Both objects are made FIRST, because
       making one goes through setMode('object'), which drops Soft by design. */
    var bead = newGrid(4, 0.4);
    var terrain = newGrid(4, 40);
    k.setMode('vertex');
    A.selectedObjectIds = new Set([bead.id]); A.activeObjectId = bead.id;
    k.ensureHelpers(bead);
    A.selectedElements = new Set([nearestLogical(bead, 0, 0, 0)]);
    k.setSoft(true);
    k.refreshSoftField(bead);
    var rBead = A.softRadius, nBead = k.softField ? k.softField.size : 0;
    log('6.bead', 'radius ' + rBead.toFixed(3) + ' reaching ' + nBead + ' verts');

    // Now the tap: active object changes, Soft stays on, setSoft is never called.
    A.selectedObjectIds = new Set([terrain.id]); A.activeObjectId = terrain.id;
    k.ensureHelpers(terrain);
    A.selectedElements = new Set([nearestLogical(terrain, 0, 0, 0)]);
    k.refreshSoftField(terrain);
    log('6.terrain', 'radius ' + A.softRadius.toFixed(2) + ' reaching ' +
      (k.softField ? k.softField.size : 0) + ' verts  want re-measured from ' + rBead.toFixed(3));
    log('6.not.inert', (k.softField && k.softField.size > 1)
      ? 'the field is real on the new object' : 'SOFT IS INERT ON THE NEW OBJECT');
    log('6.radius.for', A.softRadiusFor === terrain.id ? 'measured against the terrain' : 'STILL POINTS AT ' + A.softRadiusFor);

    /* ---- 7. Soft turned on with nothing active recovers on first use ---- */
    A.soft = false; A.softRadius = 0; A.softRadiusFor = null;
    A.selectedObjectIds = new Set(); A.activeObjectId = null;
    k.setSoft(true);
    log('7.blind.on', A.softRadius.toFixed(3) + '  (nothing active to measure yet)');
    A.selectedObjectIds = new Set([terrain.id]); A.activeObjectId = terrain.id;
    A.soft = true;
    A.selectedElements = new Set([nearestLogical(terrain, 0, 0, 0)]);
    k.refreshSoftField(terrain);
    log('7.recovers', (A.softRadius > 0 && k.softField && k.softField.size > 1)
      ? 'seeded on first use: ' + A.softRadius.toFixed(2) + ', ' + k.softField.size + ' verts'
      : 'STILL INERT (radius ' + A.softRadius + ')');

    /* ---- 8. The walk reuses its graph instead of rebuilding it ---- */
    var ball;
    k.startGeoSetup('sphere');
    k.applyGeoParams({ h: 48, v: 32, x: 2, y: 2, z: 2 });
    k.finishGeoSetup(true);
    ball = k.findObject(A.activeObjectId);
    k.ensureHelpers(ball);
    var seeds = new Set([0]);
    /* COUNTED, not timed: a headless run is under virtual time, where
       performance.now() jumps rather than ticks, so both a rebuild and a
       cache hit measure 0.00ms. Whether the graph was rebuilt is exact. */
    k.clearSoftField();
    var b0 = k.softGraphBuilds;
    for (var j = 0; j < 200; j++) k.softWeights(ball, seeds, 1.2 + j * 0.0001);   // as the slide does
    var warmBuilds = k.softGraphBuilds - b0;
    var b1 = k.softGraphBuilds;
    for (j = 0; j < 200; j++) { k.clearSoftField(); k.softWeights(ball, seeds, 1.2 + j * 0.0001); }
    var coldBuilds = k.softGraphBuilds - b1;
    log('8.sphere', ball.mesh.userData.topo.logicalCount + ' verts, 200 radius changes');
    log('8.rebuilds', warmBuilds + ' rebuild(s) reusing, ' + coldBuilds + ' when forced  want 1 and 200');
    log('8.reuses', warmBuilds === 1 ? 'the graph survives a radius change' : 'REBUILT ' + warmBuilds + ' TIMES');
    // And it must still notice a mesh that actually changed.
    var before8 = k.softWeights(ball, seeds, 1.2).size;
    ball.mesh.scale.set(3, 3, 3); ball.mesh.updateMatrixWorld(true);
    var after8 = k.softWeights(ball, seeds, 1.2).size;
    log('8.notices.scale', after8 < before8 ? 'yes (' + before8 + ' -> ' + after8 + ' at 3x scale)' : 'NO - STALE GRAPH');

    log('final.winding', k.windingAudit().every(function (x) { return x.ok; }) ? 'all ok' : 'BROKEN');
    log('console.errors', errs.length ? errs.length + ' (see the a2.37 control: synthetic pointers make OrbitControls throw on release)' : 'none');
  }

  window.addEventListener('error', function (e) { errs.push('onerror: ' + (e.message || e) + ' @' + (e.lineno || '')); });
  function finish() {
    var pre = document.createElement('pre');
    pre.id = 'probeOut';
    pre.textContent = '<<<PROBE\n' + out.join('\n') + '\nPROBE>>>';
    document.body.appendChild(pre);
    document.title = 'PROBE-DONE';
  }
  function ready(t) {
    t = t || 0;
    if (window.__kubik && window.__kubik.App) {
      return setTimeout(function () {
        try { main(); } catch (e) { out.push('ERROR=' + (e && e.stack ? e.stack.split('\n').slice(0, 5).join(' / ') : e)); }
        finish();
      }, 700);
    }
    if (t > 250) { out.push('ERROR=no __kubik'); return finish(); }
    setTimeout(function () { ready(t + 1); }, 20);
  }
  setTimeout(function () { ready(); }, 300);
})();
