/* Snap to geometry: that the three states cycle, that a target is found and
   is the right KIND, that the pivot is what lands on it, and that the moving
   geometry is never its own target. */
(function () {
  var out = [], errs = [];
  var _ce = console.error;
  console.error = function () { errs.push(Array.prototype.join.call(arguments, ' ')); _ce.apply(console, arguments); };
  function log(k, v) { out.push(k + '=' + v); }
  var k, A, T3, vr;

  function newCube(x, y, z, size) {
    k.startGeoSetup('cube');
    var id = A.geoSetup.objId;
    k.applyGeoParams({ h: 1, v: 1, x: size || 2, y: size || 2, z: size || 2 });
    k.finishGeoSetup(true);
    var o = k.findObject(id);
    o.mesh.position.set(x, y, z);
    o.mesh.updateMatrixWorld(true);
    return o;
  }
  // A pointer event aimed at a world point.
  function evAt(p) {
    var sp = k.worldToScreenPx(p.clone());
    return sp ? { clientX: sp.x + vr.left, clientY: sp.y + vr.top, pointerId: 1, pointerType: 'touch' } : null;
  }
  function v(p) { return p ? p.toArray().map(function (n) { return +n.toFixed(3); }).join(',') : 'none'; }

  function main() {
    k = window.__kubik; A = k.App; T3 = k.THREE;
    vr = document.getElementById('viewport').getBoundingClientRect();
    k.setMode('object');
    /* An EMPTY scene first. The session opens with a 1-unit cube at y=0.5, so
       its top-face corners sit at (+-0.5, 1, +-0.5) - right on top of a
       2-unit target cube built at the origin, whose top face is also y=1. The
       snap then correctly returns the startup cube's corner and the test reads
       as a priority bug. Two overlapping cubes is the harness, not the app. */
    if (A.objects.length) {
      k.removeObjects(A.objects.slice());
      A.selectedObjectIds = new Set(); A.activeObjectId = null;
    }

    /* ---- 1. Three states, cycling ---- */
    A.snapMode = 'off';
    var seen = [A.snapMode];
    for (var i = 0; i < 3; i++) { k.toggleSnapping(); seen.push(A.snapMode); }
    log('1.cycle', seen.join(' -> '));
    log('1.returns', seen[3] === seen[0] ? 'back to the start' : 'DOES NOT CYCLE');
    A.snapMode = 'grid';
    log('1.grid.only', (k.gridSnapping() && !k.geoSnapping()) ? 'grid on, geo off' : 'WRONG');
    A.snapMode = 'geo';
    log('1.geo.only', (!k.gridSnapping() && k.geoSnapping()) ? 'geo on, grid off (they are alternatives)' : 'WRONG');
    k.refreshToolIndicator();   // toggleSnapping repaints it; assigning the mode does not
    log('1.chip', document.getElementById('toolChip').textContent + '  want it to mention the snap');

    /* ---- 2. A target, and the right KIND of one ---- */
    // A 2-unit cube at the origin: corners at +-1, so its top face spans
    // x,z in [-1,1] at y=1.
    var target = newCube(0, 0, 0, 2);
    var mover = newCube(6, 0, 0, 2);
    A.selectedObjectIds = new Set([mover.id]); A.activeObjectId = mover.id;

    var corner = new T3.Vector3(1, 1, 1);
    var midEdge = new T3.Vector3(0, 1, 1);
    var midFace = new T3.Vector3(0, 1, 0);
    var skip = { objects: new Set([mover.id]) };

    var tc = k.snapTargetAt(evAt(corner), skip);
    log('2.corner', tc ? tc.kind + ' at ' + v(tc.point) : 'NONE');
    log('2.corner.exact', (tc && tc.kind === 'vertex' && tc.point.distanceTo(corner) < 1e-6)
      ? 'exactly the corner' : 'NOT THE CORNER');

    var te = k.snapTargetAt(evAt(midEdge), skip);
    log('2.edge', te ? te.kind + ' at ' + v(te.point) : 'NONE');
    log('2.edge.on.it', (te && te.kind === 'edge' && Math.abs(te.point.y - 1) < 1e-6 && Math.abs(Math.abs(te.point.z) - 1) < 1e-6)
      ? 'a point along the edge' : 'NOT ON THE EDGE');

    var tf = k.snapTargetAt(evAt(midFace), skip);
    log('2.face', tf ? tf.kind + ' at ' + v(tf.point) : 'NONE');
    log('2.priority', (tc && tc.kind === 'vertex' && te && te.kind === 'edge' && tf && tf.kind === 'face')
      ? 'vertex > edge > face, as the knife resolves' : 'PRIORITY WRONG');

    /* ---- 3. The moving object is never its own target ---- */
    var own = k.snapTargetAt(evAt(new T3.Vector3(7, 1, 1)), skip);
    log('3.self', own ? 'SNAPPED TO ITSELF (' + own.kind + ')' : 'nothing - it cannot be its own target');
    var noSkip = k.snapTargetAt(evAt(new T3.Vector3(7, 1, 1)), { objects: new Set() });
    log('3.control', noSkip ? 'found it when not skipped (' + noSkip.kind + ')' : 'CONTROL FAILED');

    /* ---- 4. THE POINT: the pivot lands on the target ---- */
    A.snapMode = 'geo';
    k.setTransformTool('move');
    A.transformMode = 'free';
    k.setPivotAuto(true);
    A.selectedObjectIds = new Set([mover.id]); A.activeObjectId = mover.id;
    k.refreshGizmoAttachment();
    var pivot0 = k.pivot.position.clone();
    log('4.pivot.at', v(pivot0) + '  (auto: the object centre)');

    var start = evAt(mover.mesh.position.clone());
    k.beginDirectDrag(start);
    var aim = evAt(corner);
    k.updateDirectDrag(aim);
    log('4.landed', v(mover.mesh.position) + '  want the corner ' + v(corner));
    log('4.exact', mover.mesh.position.distanceTo(corner) < 1e-5
      ? 'the pivot is ON the target' : 'OFF BY ' + mover.mesh.position.distanceTo(corner).toFixed(4));
    log('4.marker', k.snapMarker && k.snapMarker.visible ? 'shown at ' + v(k.snapMarker.position) : 'HIDDEN');
    log('4.marker.agrees', (k.snapMarker && k.snapLive && k.snapMarker.position.distanceTo(k.snapLive.point) < 1e-9)
      ? 'the marker and the offset are the same answer' : 'THEY DISAGREE');
    k.endDirectDrag();
    log('4.cleared', k.snapLive ? 'TARGET SURVIVED THE DRAG' : 'cleared');
    log('4.marker.gone', k.snapMarker.visible ? 'STILL SHOWN' : 'hidden');
    k.undo();

    /* ---- 5. A PINNED pivot is what lands, not the centre ---- */
    mover = k.findObject(A.objects[A.objects.length - 1].id) || mover;
    A.selectedObjectIds = new Set([mover.id]); A.activeObjectId = mover.id;
    // Pin the pivot on the mover's own left face centre.
    var pin = mover.mesh.position.clone().add(new T3.Vector3(-1, 0, 0));
    k.setPivotPoint(pin);
    var before5 = mover.mesh.position.clone();
    k.beginDirectDrag(evAt(mover.mesh.position.clone()));
    k.updateDirectDrag(evAt(corner));
    var moved5 = mover.mesh.position.clone().sub(before5);
    var pinNow = pin.clone().add(moved5);
    log('5.pinned.lands', pinNow.distanceTo(corner) < 1e-5
      ? 'the PINNED point met the target, not the centre' : 'OFF BY ' + pinNow.distanceTo(corner).toFixed(4));
    log('5.centre.did.not', mover.mesh.position.distanceTo(corner) > 0.5
      ? 'and the centre did not' : 'THE CENTRE LANDED INSTEAD');
    k.endDirectDrag();
    k.setPivotAuto(true);
    k.undo();

    /* ---- 6. Off and Grid do not snap to geometry ---- */
    mover = A.objects[A.objects.length - 1];
    A.selectedObjectIds = new Set([mover.id]); A.activeObjectId = mover.id;
    ['off', 'grid'].forEach(function (m) {
      A.snapMode = m;
      var b = mover.mesh.position.clone();
      k.beginDirectDrag(evAt(mover.mesh.position.clone()));
      k.updateDirectDrag(evAt(corner));
      var hitTarget = mover.mesh.position.distanceTo(corner) < 1e-5;
      log('6.' + m, hitTarget ? 'SNAPPED TO GEOMETRY IN ' + m.toUpperCase() : 'did not snap to geometry');
      log('6.' + m + '.marker', k.snapMarker.visible ? 'MARKER SHOWN' : 'no marker');
      k.endDirectDrag();
      mover.mesh.position.copy(b); mover.mesh.updateMatrixWorld(true);
    });
    A.snapMode = 'geo';

    /* ---- 7. Rotate and scale ask for none of it ---- */
    ['rotate', 'scale'].forEach(function (tool) {
      k.setTransformTool(tool);
      k.beginDirectDrag(evAt(mover.mesh.position.clone()));
      k.updateDirectDrag(evAt(corner));
      log('7.' + tool, k.snapLive ? 'A TARGET WAS TAKEN' : 'no target - a snap is a translation');
      k.endDirectDrag();
    });
    k.setTransformTool('move');

    /* ---- 8. Component mode: the moving vertices are not targets ---- */
    k.setMode('vertex');
    var solo = k.findObject(A.objects[0].id);
    A.selectedObjectIds = new Set([solo.id]); A.activeObjectId = solo.id;
    k.ensureHelpers(solo);
    A.selectedElements = new Set([0]);
    k.beginDirectDrag(evAt(solo.mesh.localToWorld(k.logicalPos(solo, 0).clone())));
    var sk = k.snapSkipSet();
    log('8.skips', sk.verts ? sk.verts.size + ' moving vertex/vertices excluded' : 'NO VERT SKIP SET');
    log('8.not.objects', sk.objects ? 'OBJECTS SKIPPED IN COMPONENT MODE' : 'objects not skipped - the rest of the mesh is fair game');
    k.endDirectDrag();
    k.setMode('object');

    /* ---- 9. A drag can never snap to the thing it is moving ----

       This is the one that ran away. beginDirectDrag is only reachable by
       grabbing your own selection, so the pointer STARTS on the moving
       surface - and a target taken from geometry the previous frame moved
       feeds back on itself.

       A FRESH cube per pass, and no undo between them. Undoing a drag that
       moved nothing is a no-op (pushHistory skips an identical step), so the
       undo took back the cube instead and the second pass ran against a
       different object - which is how this case reported a fix as broken
       twice before the harness was the thing at fault. */
    ['free', 'axis'].forEach(function (mode) {
      k.setMode('object');
      if (A.objects.length) { k.removeObjects(A.objects.slice()); A.selectedObjectIds = new Set(); A.activeObjectId = null; }
      var cube9 = newCube(0, 0, 0, 2);
      A.selectedObjectIds = new Set([cube9.id]); A.activeObjectId = cube9.id;
      k.setMode('face');
      k.ensureHelpers(cube9);
      var topo9 = cube9.mesh.userData.topo;
      var topGi = -1;
      for (var g = 0; g < topo9.faceGroups.length; g++) {
        var vs = topo9.faceGroups[g].logicalVerts;
        if (vs.every(function (l) { return Math.abs(k.logicalPos(cube9, l).y - 1) < 1e-6; })) { topGi = g; break; }
      }
      A.selectedElements = new Set([topGi]);
      k.refreshGizmoAttachment();

      A.snapMode = 'geo';
      k.setTransformTool('move');
      A.transformMode = mode;

      var probeVert = topo9.faceGroups[topGi].logicalVerts[0];
      var y0 = k.logicalPos(cube9, probeVert).y;
      var aimPt = new T3.Vector3(0.2, 1, 0.2);      // on the face being dragged
      var began9 = k.beginDirectDrag(evAt(aimPt));
      log('9.' + mode + '.began', (began9 && k.dragCtx && k.dragCtx.entries.length)
        ? 'yes, ' + k.dragCtx.entries.length + ' vertices moving'
        : 'NO / NOTHING SELECTED - the rest of this case proves nothing');
      var t9 = k.snapTargetAt(evAt(aimPt), k.snapSkipSet());
      var ys = [];
      for (var f = 0; f < 6; f++) {
        k.updateDirectDrag(evAt(aimPt));
        ys.push(+k.logicalPos(cube9, probeVert).y.toFixed(3));
      }
      k.endDirectDrag();
      log('9.' + mode + '.target', t9 ? 'A TARGET ON THE MOVING FACE (' + t9.kind + ')'
        : 'none - the moving face is not a target');
      var drift = Math.max.apply(null, ys.map(function (y) { return Math.abs(y - y0); }));
      log('9.' + mode + '.runaway', drift < 1e-6 ? 'no drift across six still frames'
        : 'MOVED WITH A STILL FINGER: ' + y0.toFixed(3) + ' -> ' + ys.join(' '));
    });

    /* ---- 10. Symmetry partners are not targets either ----
       They move with the drag but captureDragContext deliberately drops them
       from `entries`, so without help the finder thinks they are standing
       still - and the highest-priority branch accepts them. */
    k.setMode('object');
    if (A.objects.length) { k.removeObjects(A.objects.slice()); A.selectedObjectIds = new Set(); A.activeObjectId = null; }
    var sym10 = newCube(0, 0, 0, 2);
    A.selectedObjectIds = new Set([sym10.id]); A.activeObjectId = sym10.id;
    k.setMode('vertex');
    k.ensureHelpers(sym10);
    /* a2.89: the axis became a SET. Written as a one-element set here so
       these sections keep meaning exactly what they meant before. */
    A.symmetry = true; A.symmetryAxes = ['x'];
    var tp = sym10.mesh.userData.topo;
    var vPlus = -1;
    for (var l2 = 0; l2 < tp.logicalCount; l2++) {
      var q = k.logicalPos(sym10, l2);
      if (q.x > 0.9 && q.y > 0.9 && q.z > 0.9) { vPlus = l2; break; }
    }
    A.selectedElements = new Set([vPlus]);
    A.snapMode = 'geo'; k.setTransformTool('move'); A.transformMode = 'free';
    var began10 = k.beginDirectDrag(evAt(sym10.mesh.localToWorld(k.logicalPos(sym10, vPlus).clone())));
    var sk10 = k.snapSkipSet();
    log('10.began', began10 ? 'yes' : 'NO');
    log('10.skip.size', sk10.verts.size + ' excluded  want 2 (the vertex and its mirror)');
    var mirrorPt = sym10.mesh.localToWorld(new T3.Vector3(-1, 1, 1));
    var t10 = k.snapTargetAt(evAt(mirrorPt), sk10);
    log('10.mirror', (t10 && t10.kind === 'vertex') ? 'SNAPPED TO ITS OWN MIRROR' : 'the mirror is not a target');
    k.endDirectDrag();
    A.symmetry = false;

    /* ---- 11. In axis mode the marker shows where it will really land ---- */
    k.setMode('object');
    if (A.objects.length) { k.removeObjects(A.objects.slice()); A.selectedObjectIds = new Set(); A.activeObjectId = null; }
    var tgt11 = newCube(0, 0, 0, 2);
    var mov11 = newCube(6, 0, 0, 2);
    A.selectedObjectIds = new Set([mov11.id]); A.activeObjectId = mov11.id;
    k.setPivotAuto(true); k.refreshGizmoAttachment();
    A.snapMode = 'geo'; k.setTransformTool('move'); A.transformMode = 'axis';
    var corner11 = new T3.Vector3(1, 1, 1);      // off-axis in Y and Z
    k.beginDirectDrag(evAt(mov11.mesh.position.clone()));
    k.updateDirectDrag(evAt(corner11));
    var landed11 = mov11.mesh.position.clone();
    log('11.marker.at', v(k.snapMarker.position));
    log('11.object.at', v(landed11));
    log('11.honest', k.snapMarker.position.distanceTo(landed11) < 1e-5
      ? 'the marker is where the object actually went' : 'MARKER PROMISES SOMEWHERE IT CANNOT REACH');
    k.endDirectDrag();

    log('final.winding', k.windingAudit().every(function (x) { return x.ok; }) ? 'all ok' : 'BROKEN');
    log('console.errors', errs.length ? errs.length + ': ' + errs.join(' | ').slice(0, 250) : 'none');
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
