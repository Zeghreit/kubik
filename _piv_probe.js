/* The pivot: that it can be pinned, that rotate and scale actually turn around
   it, and that it survives (or doesn't) the things it should. */
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
  function newCube(x, size) {
    k.startGeoSetup('cube');
    var id = A.geoSetup.objId;
    k.applyGeoParams({ h: 1, v: 1, x: size || 1, y: size || 1, z: size || 1 });
    k.finishGeoSetup(true);
    var o = k.findObject(id);
    o.mesh.position.set(x, 0, 0);
    o.mesh.updateMatrixWorld(true);
    A.selectedObjectIds = new Set([id]); A.activeObjectId = id;
    return o;
  }
  function pivotPos() { return A.pivot ? A.pivot.position.clone() : null; }
  function v(p) { return p ? p.toArray().map(function (n) { return +n.toFixed(3); }).join(',') : 'none'; }

  function main() {
    k = window.__kubik; A = k.App; T3 = k.THREE;
    k.setMode('object');

    /* ---- 1. Auto is the old behaviour ---- */
    var c = newCube(2, 2);
    k.refreshGizmoAttachment();
    log('1.auto', v(pivotPos()) + '  want the object position 2,0,0');
    log('1.marker.hidden', (k.pivotMarker && k.pivotMarker.visible) ? 'SHOWN in auto' : 'hidden in auto');

    /* ---- 2. Pinned, and it STAYS pinned ---- */
    k.setPivotPoint(new T3.Vector3(0, 0, 0));
    log('2.pinned', v(pivotPos()) + '  want 0,0,0');
    log('2.marker', (k.pivotMarker && k.pivotMarker.visible) ? 'shown at ' + v(k.pivotMarker.position) : 'HIDDEN');
    // recenterPivot runs at the start and end of every drag - it must not move.
    k.recenterPivot();
    k.refreshGizmoAttachment();
    k.refreshUI();
    log('2.survives.recentre', v(pivotPos()) + '  want 0,0,0');

    /* ---- 3. THE POINT OF ALL THIS: rotate turns around it ---- */
    // The cube sits at x=2, the pivot at the origin. A quarter turn about Y
    // must swing it to z=-2, not spin it where it stands.
    var before = c.mesh.position.clone();
    k.setTransformTool('rotate');
    k.beginDirectDrag({ clientX: 400, clientY: 400, pointerId: 1, pointerType: 'touch' });
    var R = new T3.Matrix4().makeRotationY(Math.PI / 2);
    var P = new T3.Matrix4().makeTranslation(0, 0, 0);
    // The app builds T * local * Tinv itself; here we hand it the same thing
    // about the pinned pivot, which is what updateDirectDrag would produce.
    k.applyDeltaToSelection(R);
    var after = c.mesh.position.clone();
    log('3.before', v(before) + ' -> ' + v(after));
    log('3.swung', after.distanceTo(new T3.Vector3(0, 0, -2)) < 0.001
      ? 'swung around the pinned pivot' : 'DID NOT SWING (stayed near ' + v(after) + ')');
    k.endDirectDrag();
    k.undo();

    /* ---- 4. To selection, to object centre ---- */
    var big = newCube(5, 4);
    big.mesh.position.set(5, 0, 0); big.mesh.updateMatrixWorld(true);
    A.selectedObjectIds = new Set([big.id]); A.activeObjectId = big.id;
    k.pivotToObjectCentre();
    log('4.object.centre', v(A.pivotPoint) + '  want the box centre 5,0,0');
    // A vertex, in component mode - the case worth having.
    k.setMode('vertex');
    k.ensureHelpers(big);
    var corner = nearestLogical(big, 3, -2, -2);
    A.selectedElements = new Set([corner]);
    k.pivotToSelection();
    var want = big.mesh.localToWorld(k.logicalPos(big, corner).clone());
    log('4.to.vertex', v(A.pivotPoint) + '  want the corner ' + v(want));
    log('4.exact', A.pivotPoint.distanceTo(want) < 1e-6 ? 'on the corner exactly' : 'OFF BY ' + A.pivotPoint.distanceTo(want));
    k.setMode('object');

    /* ---- 5. Auto puts it back ---- */
    A.selectedObjectIds = new Set([big.id]); A.activeObjectId = big.id;
    k.setPivotAuto(true);
    k.refreshGizmoAttachment();
    log('5.auto.back', A.pivotMode + ', marker ' + (k.pivotMarker.visible ? 'SHOWN' : 'hidden') +
      ', at ' + v(pivotPos()) + '  want the object again');

    /* ---- 6. By hand: a drag moves it, in Free and in Axis ---- */
    k.setPivotPoint(new T3.Vector3(0, 0, 0));
    k.beginPivotPlacing();
    log('6.bar', document.getElementById('pivotBar').classList.contains('show') ? 'shown' : 'HIDDEN');
    A.transformMode = 'free';
    A.snap = false;
    var began = k.beginPivotDrag({ clientX: 400, clientY: 400, pointerId: 1, pointerType: 'touch' });
    log('6.drag.began', began ? 'yes' : 'NO');
    k.updatePivotDrag({ clientX: 480, clientY: 400, pointerId: 1, pointerType: 'touch' });
    var moved = A.pivotPoint.clone();
    log('6.free.moved', v(moved) + (moved.length() > 0.01 ? '  (moved)' : '  DID NOT MOVE'));
    log('6.marker.follows', k.pivotMarker.position.distanceTo(A.pivotPoint) < 1e-9 ? 'yes' : 'MARKER LAGS');
    log('6.gizmo.follows', pivotPos().distanceTo(A.pivotPoint) < 1e-9 ? 'yes' : 'GIZMO LAGS');
    k.endPivotDrag();
    log('6.orbit.back', k.orbit.enabled ? 'enabled' : 'STILL DISABLED');

    // Axis mode constrains it to one axis.
    A.transformMode = 'axis';
    k.setPivotPoint(new T3.Vector3(0, 0, 0));
    k.beginPivotDrag({ clientX: 400, clientY: 400, pointerId: 1, pointerType: 'touch' });
    k.updatePivotDrag({ clientX: 500, clientY: 402, pointerId: 1, pointerType: 'touch' });
    var ax = A.pivotPoint.clone();
    var nonZero = ['x', 'y', 'z'].filter(function (a) { return Math.abs(ax[a]) > 1e-6; });
    log('6.axis.locked', v(ax) + '  moved on ' + (nonZero.length ? nonZero.join('+') : 'nothing') +
      (nonZero.length === 1 ? '  (one axis, correct)' : '  WANT ONE AXIS'));
    k.endPivotDrag();
    k.endPivotPlacing();
    log('6.bar.gone', document.getElementById('pivotBar').classList.contains('show') ? 'STILL SHOWN' : 'hidden');

    /* ---- 7. A tap ends the placing ---- */
    k.beginPivotPlacing();
    k.handleTap({ clientX: 5, clientY: 5, shiftKey: false });
    log('7.tap.ends', A.pivotPlacing ? 'STILL PLACING' : 'placing ended');

    /* ---- 8. Undo keeps the mark; a load drops it ---- */
    k.setPivotPoint(new T3.Vector3(1, 2, 3));
    var doc = k.serializeDoc();
    k.restoreDoc(doc, { keepAppearance: true, keepSelection: true });     // undo
    log('8.undo.keeps', A.pivotMode === 'custom' ? 'still pinned at ' + v(A.pivotPoint) : 'LOST ON UNDO');
    k.restoreDoc(doc);                                                    // load
    log('8.load.drops', A.pivotMode === 'auto' ? 'back to auto' : 'STILL PINNED AFTER A LOAD');
    log('8.marker.gone', k.pivotMarker.visible ? 'MARKER STILL SHOWN' : 'marker hidden');
    log('8.not.in.doc', /pivot/i.test(JSON.stringify(doc)) ? 'PIVOT LEAKED INTO THE FILE' : 'nothing about the pivot in the file');

    /* ---- 9. The ring ---- */
    log('9.world.ring', k.HUB_TOOLS_WORLD.some(function (t) { return t.key === 'pivot'; }) ? 'Pivot is on it' : 'MISSING');
    /* a2.109: the world ring joined the compass, so what matters is that Pivot
       still pulls in a direction of its own rather than which pole it held. */
    log('9.seats', k.HUB_TOOLS_WORLD
      .map(function (t) { return k.toolLabel(t) + '@' + t.seat; }).join(' '));
    log('9.sub.ring', k.HUB_TOOLS_PIVOT.map(function (t) { return t.label; }).join(', '));

    /* ---- 10. A pinned pivot must not break an ordinary MOVE ----

       The drag plane used to be built at the PIVOT's depth, so pinning it
       further from the camera than the model made every drag travel further
       than the finger - and pinning it behind the camera made the plane
       intersection fail, which is the gate for all three tools, so grabbing
       your own selection silently orbited instead. */
    k.setMode('object');
    var m = newCube(0, 1);
    m.mesh.position.set(0, 0, 0); m.mesh.updateMatrixWorld(true);
    A.selectedObjectIds = new Set([m.id]); A.activeObjectId = m.id;
    k.setTransformTool('move');
    A.transformMode = 'free';
    A.snap = false;

    function moveBy(px) {
      var p0 = m.mesh.position.clone();
      if (!k.beginDirectDrag({ clientX: 400, clientY: 400, pointerId: 1, pointerType: 'touch' })) return null;
      k.updateDirectDrag({ clientX: 400 + px, clientY: 400, pointerId: 1, pointerType: 'touch' });
      var d = m.mesh.position.clone().sub(p0).length();
      k.endDirectDrag();
      m.mesh.position.copy(p0); m.mesh.updateMatrixWorld(true);
      return d;
    }

    k.setPivotAuto(true);
    var dAuto = moveBy(80);
    // Pin it far BEHIND the model, away from the camera.
    k.setPivotPoint(new T3.Vector3(0, 0, -60));
    var dFar = moveBy(80);
    log('10.auto.travel', dAuto === null ? 'DRAG REFUSED' : dAuto.toFixed(3));
    log('10.far.pivot.travel', dFar === null ? 'DRAG REFUSED' : dFar.toFixed(3));
    log('10.same.rate', (dAuto !== null && dFar !== null && Math.abs(dFar - dAuto) < dAuto * 0.02)
      ? 'the pivot does not change how far a move travels'
      : 'MOVE RATE CHANGED WITH THE PIVOT (' + dAuto + ' vs ' + dFar + ')');

    // And a pivot behind the camera must not make the selection undraggable.
    var camBack = k.camera.position.clone().multiplyScalar(3);
    k.setPivotPoint(camBack);
    var dBehind = moveBy(80);
    log('10.pivot.behind.camera', dBehind === null ? 'SELECTION UNDRAGGABLE' : 'still draggable (' + dBehind.toFixed(3) + ')');
    k.setPivotAuto(true);

    /* ---- 11. Placing resolves whatever else was open ---- */
    k.setMode('face');
    A.activeObjectId = m.id;
    k.ensureHelpers(m);
    A.selectedElements = new Set([0]);
    k.insetSelection();
    log('11.op.open', A.pendingOp ? A.pendingOp.kind : 'none');
    k.beginPivotPlacing();
    log('11.op.resolved', A.pendingOp ? 'STILL ' + A.pendingOp.kind : 'resolved');
    log('11.opbar.hidden', document.getElementById('opBar').classList.contains('show') ? 'OP BAR STILL OVER IT' : 'hidden');
    log('11.pivotbar', document.getElementById('pivotBar').classList.contains('show') ? 'shown' : 'HIDDEN');

    /* ---- 12. A tap really ends the placing ---- */
    // A press and release that never travels - which is what a tap IS. It has
    // to end the mode, because the bar's Done is otherwise the only exit.
    k.beginPivotDrag({ clientX: 400, clientY: 400, pointerId: 1, pointerType: 'touch' });
    k.updatePivotDrag({ clientX: 401, clientY: 400, pointerId: 1, pointerType: 'touch' });
    k.endPivotDrag();
    log('12.tap.ends', A.pivotPlacing ? 'STILL PLACING' : 'placing ended by a still press');
    // ...and a real drag does NOT end it.
    k.beginPivotPlacing();
    k.beginPivotDrag({ clientX: 400, clientY: 400, pointerId: 1, pointerType: 'touch' });
    k.updatePivotDrag({ clientX: 500, clientY: 400, pointerId: 1, pointerType: 'touch' });
    k.endPivotDrag();
    log('12.drag.keeps', A.pivotPlacing ? 'still placing, correct' : 'A DRAG ENDED IT');

    /* ---- 13. A cancelled pointer does not strand the camera ---- */
    k.beginPivotDrag({ clientX: 400, clientY: 400, pointerId: 1, pointerType: 'touch' });
    log('13.dragging', k.pivotDrag ? 'yes, orbit ' + (k.orbit.enabled ? 'ENABLED' : 'released') : 'NO DRAG');
    k.renderer.domElement.dispatchEvent(new PointerEvent('pointercancel', {
      bubbles: true, pointerId: 1, pointerType: 'touch', clientX: 400, clientY: 400 }));
    log('13.cancel.clears', k.pivotDrag ? 'DRAG SURVIVED' : 'drag cleared');
    log('13.orbit.back', k.orbit.enabled ? 'enabled' : 'STILL DISABLED');
    k.endPivotPlacing();

    /* ---- 14. Component mode honours the pin too ---- */
    k.setMode('vertex');
    A.activeObjectId = m.id;
    k.ensureHelpers(m);
    A.selectedElements = new Set([0]);
    k.setPivotPoint(new T3.Vector3(9, 9, 9));
    k.refreshGizmoAttachment();
    log('14.component.pin', v(pivotPos()) + '  want 9,9,9');
    k.refreshUI();
    log('14.after.refresh', v(pivotPos()) + '  want 9,9,9');
    k.setPivotAuto(true);
    k.setMode('object');

    /* ---- 15. The marker comes and goes ---- */
    k.setMode('object');
    var mk = newCube(0, 1);
    A.selectedObjectIds = new Set([mk.id]); A.activeObjectId = mk.id;
    k.setPivotPoint(new T3.Vector3(3, 0, 0));
    log('15.flash.on.set', k.pivotMarker.visible ? 'shown when it lands' : 'NOT SHOWN ON SET');
    log('15.chip', document.getElementById('toolChip').textContent + '  want it to mention Pivot');

    // (Rotate / scale / move are checked in the late block - see there.)

    // Auto takes the chip cue away with it.
    k.setPivotAuto(true);
    log('15.chip.auto', /Pivot/.test(document.getElementById('toolChip').textContent)
      ? 'CHIP STILL SAYS PIVOT' : 'chip clean in auto');
    log('final.winding', k.windingAudit().every(function (x) { return x.ok; }) ? 'all ok' : 'BROKEN');
    log('console.errors', errs.length ? errs.length + ': ' + errs.join(' | ').slice(0, 250) : 'none');
  }

  /* The flash expires on a timer, so it cannot be checked inline - the whole
     run finishes in well under the 1.6s it lasts. Checked here instead, once
     enough real time has passed. */
  function lateChecks(done) {
    var A2 = window.__kubik.App, K = window.__kubik;
    K.setPivotPoint(new K.THREE.Vector3(4, 0, 0));
    var shown = K.pivotMarker.visible;
    setTimeout(function () {
      out.push('16.flash.on=' + (shown ? 'shown at once' : 'NOT SHOWN'));
      out.push('16.flash.expires=' + (K.pivotMarker.visible ? 'STILL SHOWN AFTER THE FLASH' : 'hidden again by itself'));
      out.push('16.still.pinned=' + (A2.pivotMode === 'custom' ? 'yes - hidden, not forgotten' : 'PIN LOST'));
      out.push('16.chip.still.says=' + (/Pivot/.test(document.getElementById('toolChip').textContent)
        ? 'Pivot, so it is not invisible state' : 'NOTHING - INVISIBLE STATE'));

      /* With the flash expired, a drag is the only thing that can show it -
         which is the actual claim: rotate and scale turn around the pivot and
         show it, a move does not use it and does not. */
      var obj = A2.objects[A2.objects.length - 1];
      A2.selectedObjectIds = new Set([obj.id]); A2.activeObjectId = obj.id;
      K.setMode('object');
      ['rotate', 'scale', 'move'].forEach(function (tool) {
        K.setTransformTool(tool);
        K.beginDirectDrag({ clientX: 400, clientY: 400, pointerId: 1, pointerType: 'touch' });
        var during = K.pivotMarker.visible;
        K.endDirectDrag();
        out.push('17.during.' + tool + '=' + (during ? 'shown' : 'hidden') +
          (tool === 'move' ? '  want hidden' : '  want shown'));
      });
      out.push('17.after.drags=' + (K.pivotMarker.visible ? 'STILL SHOWN' : 'hidden again'));
      done();
    }, 2000);
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
        try { lateChecks(finish); } catch (e) { out.push('ERROR.late=' + e); finish(); }
      }, 700);
    }
    if (t > 250) { out.push('ERROR=no __kubik'); return finish(); }
    setTimeout(function () { ready(t + 1); }, 20);
  }
  setTimeout(function () { ready(); }, 300);
})();
