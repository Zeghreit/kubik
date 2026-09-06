/* _v222chk - v2.22: the camera keeps its gestures, a dragged point stays in
   the plane facing you, and the slider follows the selected point.

   Every claim here is about WHICH BRANCH RUNS, so the two that matter are
   driven through the real canvas listener with real PointerEvents. A probe
   that called curveEditPointerDown itself would pass while the press that
   reaches it still switched the camera off. */
(function () {
  const OUT = [];
  let fails = 0;
  const say = s => OUT.push(s);
  const ok = (name, cond, detail) => {
    if (!cond) fails++;
    say((cond ? 'PASS ' : 'FAIL ') + name + (detail === undefined ? '' : '  ' + detail));
  };
  const post = (p, b) => { try { const x = new XMLHttpRequest(); x.open('POST', p, true); x.send(b); } catch (e) {} };
  const mark = s => post('/mark', 'at: ' + s + '\n' + OUT.join('\n'));
  function finish(extra) {
    if (extra) say(extra);
    say('VERDICT=' + (fails ? 'FAIL' : 'PASS') + ' (' + fails + ' failed)');
    post('/done', OUT.join('\n'));
  }

  let K = null, rect = null;
  const V = (x, y, z) => new K.THREE.Vector3(x, y, z);

  function clearScene() {
    K.App.objects.slice().forEach(o => { try { o.mesh.parent.remove(o.mesh); } catch (e) {} });
    K.App.objects.length = 0;
    K.App.selectedObjectIds = new Set();
    K.App.activeObjectId = null;
    K.App.hidden.clear();
    K.App.mode = 'object';
  }
  function mkCurve(name, pts, opts) {
    return K.createCurveObject(name, V(0, 0, 0), pts.map(a => V(a[0], a[1], a[2])), opts || {});
  }
  function at(v) {
    const sp = K.worldToScreenPx(v);
    return sp ? { x: rect.left + sp.x, y: rect.top + sp.y } : null;
  }
  const ev = (x, y) => ({ clientX: x, clientY: y, pointerId: 7, button: 0 });
  const tap = (pt) => {
    K.curveEditPointerDown(ev(pt.x, pt.y));
    K.curveEditPointerUp(ev(pt.x, pt.y));
  };
  function mkMesh(name, kind, x, y, z) {
    const ed = K.buildPrimitiveEditable(kind, {});
    const mats = K.makeMaterialSet(ed.groups.length || 1, 0x9aa3b2);
    return K.createObjectFromEditable(name, V(x || 0, y || 0, z || 0), ed, mats, {});
  }
  const cvOf = (o) => K.curveDataOf(o) || { pts: [], radii: [] };
  const pts = (o) => cvOf(o).pts;
  const radii = (o) => K.normaliseCurveRadii(cvOf(o));
  /* AN EMPTY SPOT, PROVED EMPTY. "240px up and right of the middle" is an
     assumption, and this probe broke on it: its own first append had put a
     control point exactly there, so the second press claimed a point and the
     check read as a regression. Ask the app instead. */
  function clearSpot(obj, from) {
    const tries = [[0, 250], [140, 220], [-160, 230], [250, 120], [-250, 120],
                   [0, -250], [200, -200], [-200, -200], [300, 0], [-300, 0]];
    for (let k = 0; k < tries.length; k++) {
      const q = { x: from.x + tries[k][0], y: from.y + tries[k][1] };
      if (q.x < rect.left + 6 || q.x > rect.right - 6) continue;
      if (q.y < rect.top + 6 || q.y > rect.bottom - 6) continue;
      const e = ev(q.x, q.y);
      if (K.pickCurvePointOn(obj, e, 60)) continue;
      if (K.pickCurveSpanOn(obj, e, 60)) continue;
      return q;
    }
    return null;
  }

  // A control point in WORLD space - the points themselves are local.
  function world(o, i) {
    o.mesh.updateMatrixWorld();
    const a = pts(o)[i];
    return V(a[0], a[1], a[2]).applyMatrix4(o.mesh.matrixWorld);
  }

  /* A REAL press at the canvas, which is the only way to reach the branch
     that decides whether the camera keeps this gesture. Down and up in the
     same place, so nothing orbits and every screen coordinate afterwards
     still means what it meant. */
  function realDown(pt, button) {
    const el = K.canvasEl;
    el.dispatchEvent(new PointerEvent('pointerdown', {
      clientX: pt.x, clientY: pt.y, pointerId: 31, isPrimary: true,
      button: button || 0, buttons: button === 2 ? 2 : 1,
      pointerType: 'mouse', bubbles: true, cancelable: true
    }));
  }
  function realUp(pt, button) {
    const el = K.canvasEl;
    el.dispatchEvent(new PointerEvent('pointerup', {
      clientX: pt.x, clientY: pt.y, pointerId: 31, isPrimary: true,
      button: button || 0, buttons: 0,
      pointerType: 'mouse', bubbles: true, cancelable: true
    }));
  }

  async function run() {
    K = window.__kubik;
    if (!K) { finish('__kubik is undefined - the app never started'); return; }
    rect = document.getElementById('viewport').getBoundingClientRect();
    ok('0.boot  app up, the v2.22 doors exported',
       !!K.App && typeof K.cameraButton === 'function' &&
       typeof K.cameraPlanePoint === 'function' &&
       typeof K.opSliderPoint === 'function' && !!K.canvasEl);
    if (typeof K.cameraButton !== 'function') { finish(); return; }
    mark('0.boot');

    /* 1 -- WHICH BUTTON. Right and middle are the pan and the dolly and are
       never a tool's; touch and pen have one button and mean what they always
       meant; an event with no button at all - every synthetic one in these
       probes - has to read as the primary one or every other probe breaks. */
    ok('1.button a right mouse button is always the camera',
       K.cameraButton({ pointerType: 'mouse', button: 2 }) === true);
    ok('1.button so is the middle one',
       K.cameraButton({ pointerType: 'mouse', button: 1 }) === true);
    ok('1.button the left one is not',
       K.cameraButton({ pointerType: 'mouse', button: 0 }) === false);
    ok('1.button a finger is not, whatever number it carries',
       K.cameraButton({ pointerType: 'touch', button: 2 }) === false);
    ok('1.button and an event with no button reads as the primary one',
       K.cameraButton({}) === false);
    mark('1.button');

    /* 2 -- WHAT A PRESS CLAIMS. The editor may take a press it can act on -
       a point, a ring - and nothing else. This is the whole of the "controls
       act weird" report: one finger on empty space used to be swallowed. */
    clearScene();
    const c2 = mkCurve('C', [[-1, 0, 0], [0, 0, 0], [1, 0, 0]], { type: 'poly', res: 4 });
    K.App.selectedObjectIds = new Set([c2.id]);
    K.startCurveEdit(c2);
    K.curveEdit.plane = 'z';
    const p2 = at(world(c2, 1));
    const away = clearSpot(c2, p2);
    ok('2.claim  there is a spot on screen with nothing under it', !!away);
    if (!away) { finish(); return; }
    ok('2.claim  a press on a point is the editor\'s',
       K.curveEditPointerDown(ev(p2.x, p2.y)) === true);
    K.curveEditPointerUp(ev(p2.x, p2.y));
    ok('2.claim  a press on empty space is not',
       K.curveEditPointerDown(ev(away.x, away.y)) === false);
    K.curveEditPointerUp(ev(away.x, away.y));

    // ...and the canvas listener acts on that. The camera is the check.
    K.startCurveEdit(c2);
    K.curveEdit.plane = 'z';
    const p2b = at(world(c2, 1));
    K.orbitEnabled = true;
    realDown(p2b, 0);
    const heldPoint = K.orbitEnabled;
    realUp(p2b, 0);
    ok('2.claim  taking hold of a point takes the camera away',
       heldPoint === false, 'orbit=' + heldPoint);

    K.orbitEnabled = true;
    const nPre = pts(c2).length;
    const away2 = clearSpot(c2, p2b);
    K.orbitEnabled = true;
    realDown(away2, 0);
    const heldSpace = K.orbitEnabled;
    realUp(away2, 0);
    ok('2.claim  a press on empty space leaves the camera alone',
       heldSpace === true, 'orbit=' + heldSpace);
    ok('2.claim  and the still release still carried the curve on',
       pts(c2).length === nPre + 1, nPre + ' -> ' + pts(c2).length);

    K.orbitEnabled = true;
    const nPre2 = pts(c2).length;
    realDown(at(world(c2, 1)), 2);
    const heldRight = K.orbitEnabled;
    realUp(at(world(c2, 1)), 2);
    ok('2.claim  a right press on a point is the camera\'s, not the point\'s',
       heldRight === true && pts(c2).length === nPre2,
       'orbit=' + heldRight + ' points=' + pts(c2).length);
    K.finishCurveEdit(false);
    mark('2.claim');

    /* 3 -- THE PLANE FACING YOU. A drag is not a placement: nothing under the
       cursor may pull the point off the plane it started on. */
    clearScene();
    /* A SOLID ROUND THE CURVE - which is exactly the case that caused the
       report: inside a tube, the thing under the cursor is the tube. */
    const wall = mkMesh('Wall', 'cube', 0, 0, 0);
    wall.mesh.scale.set(8, 8, 8);
    wall.mesh.updateMatrixWorld(true);
    const c3 = mkCurve('C', [[-1, 0, 0], [0, 0.6, 0], [1, 0, 0]], { type: 'poly', res: 4 });
    K.App.selectedObjectIds = new Set([c3.id]);
    K.startCurveEdit(c3);
    K.curveEdit.plane = 'z';
    const P3 = world(c3, 1);
    const s3 = at(P3);
    const q0 = K.cameraPlanePoint(ev(s3.x, s3.y), P3);
    ok('3.plane  aimed at the point it is through, it IS that point',
       !!q0 && q0.distanceTo(P3) < 1e-3, q0 ? q0.distanceTo(P3).toExponential(2) : 'null');
    const s3b = { x: s3.x + 70, y: s3.y - 40 };
    const q1 = K.cameraPlanePoint(ev(s3b.x, s3b.y), P3);
    const back = q1 ? at(q1) : null;
    ok('3.plane  and it lands under the cursor, wherever that is',
       !!back && Math.hypot(back.x - s3b.x, back.y - s3b.y) < 0.5,
       back ? Math.hypot(back.x - s3b.x, back.y - s3b.y).toFixed(3) + 'px' : 'null');
    const fwd = new K.THREE.Vector3();
    K.camera.getWorldDirection(fwd);
    ok('3.plane  square to the camera, so nothing moves towards it',
       !!q1 && Math.abs(q1.clone().sub(P3).dot(fwd)) < 1e-4,
       q1 ? Math.abs(q1.clone().sub(P3).dot(fwd)).toExponential(2) : 'null');
    // The wall IS under that cursor, and curveResolve snaps to it. That is
    // what a drag must not do - and this is the check that says the two
    // really are different answers rather than the same one twice.
    const rr = K.curveResolve(ev(s3b.x, s3b.y), P3);
    ok('3.plane  and it is NOT what a placement would have answered',
       !!rr && !!q1 && rr.p.distanceTo(q1) > 0.2,
       rr && q1 ? rr.p.distanceTo(q1).toFixed(3) : 'null');
    mark('3.plane');

    // The same thing, through the pointer, on the shape that caused it.
    const before3 = world(c3, 1);
    K.curveEditPointerDown(ev(s3.x, s3.y));
    K.curveEditPointerMove(ev(s3.x + 35, s3.y - 20));
    K.curveEditPointerMove(ev(s3b.x, s3b.y));
    K.curveEditPointerUp(ev(s3b.x, s3b.y));
    const after3 = world(c3, 1);
    const d3 = after3.clone().sub(before3);
    ok('3.plane  a drag over a solid slides ALONG the view, never into it',
       d3.length() > 0.05 && Math.abs(d3.dot(fwd)) < 1e-4,
       'moved ' + d3.length().toFixed(3) + ', into view ' + d3.dot(fwd).toExponential(2));
    K.finishCurveEdit(false);
    mark('3.drag');

    /* 4 -- SELECTING, AND LETTING GO. A second tap on the point you have is
       the only way back to the whole tube, so it has to be a tap and not a
       drag: a drag of the selected point must leave it selected. */
    clearScene();
    const c4 = mkCurve('C', [[-1, 0, 0], [0, 0, 0], [1, 0, 0]], { type: 'poly', res: 4 });
    K.App.selectedObjectIds = new Set([c4.id]);
    K.startCurveEdit(c4);
    K.curveEdit.plane = 'z';
    const m4 = at(world(c4, 1));
    tap(m4);
    ok('4.sel    a tap on a point selects it', K.curveEdit.sel === 1, 'sel=' + K.curveEdit.sel);
    tap(at(world(c4, 1)));
    ok('4.sel    a second tap on the same point lets it go',
       K.curveEdit.sel === -1, 'sel=' + K.curveEdit.sel);
    tap(at(world(c4, 1)));
    ok('4.sel    and a third takes it again', K.curveEdit.sel === 1, 'sel=' + K.curveEdit.sel);
    const y4 = pts(c4)[1][1];
    const g4 = at(world(c4, 1));
    K.curveEditPointerDown(ev(g4.x, g4.y));
    K.curveEditPointerMove(ev(g4.x, g4.y - 40));
    K.curveEditPointerMove(ev(g4.x, g4.y - 80));
    K.curveEditPointerUp(ev(g4.x, g4.y - 80));
    ok('4.sel    DRAGGING the selected point moves it and keeps it selected',
       K.curveEdit.sel === 1 && Math.abs(pts(c4)[1][1] - y4) > 0.05,
       'sel=' + K.curveEdit.sel + ' y=' + pts(c4)[1][1].toFixed(3));
    K.finishCurveEdit(false);
    mark('4.sel');

    /* 5 -- GROWING FROM THE END YOU CHOSE. Select the first point and the
       curve carries on backwards from it; anything else and it carries on
       from the last, the way drawing does. */
    clearScene();
    const c5 = mkCurve('C', [[-1, 0, 0], [0, 0, 0], [1, 0, 0]], { type: 'poly', res: 4 });
    K.App.selectedObjectIds = new Set([c5.id]);
    K.startCurveEdit(c5);
    K.curveEdit.plane = 'z';
    K.curveEdit.sel = -1;
    const head0 = pts(c5)[0].slice();
    const spot5 = clearSpot(c5, at(world(c5, 0)));
    ok('5.end    there is an empty spot to tap', !!spot5);
    if (!spot5) { finish(); return; }
    tap(spot5);
    ok('5.end    with nothing selected it carries on from the LAST point',
       pts(c5).length === 4 &&
       Math.abs(pts(c5)[0][0] - head0[0]) < 1e-9 && K.curveEdit.sel === 3,
       'sel=' + K.curveEdit.sel + ' n=' + pts(c5).length);
    tap(at(world(c5, 0)));
    ok('5.end    the first point can be selected', K.curveEdit.sel === 0);
    const wasHead = pts(c5)[0].slice();
    const spot5b = clearSpot(c5, at(world(c5, 0)));
    if (!spot5b) { ok('5.end    a second empty spot', false); finish(); return; }
    tap(spot5b);
    ok('5.end    and then the curve grows BEFORE it, not after',
       pts(c5).length === 5 && K.curveEdit.sel === 0 &&
       Math.abs(pts(c5)[1][0] - wasHead[0]) < 1e-9 &&
       Math.abs(pts(c5)[0][0] - wasHead[0]) > 1e-6,
       'sel=' + K.curveEdit.sel + ' n=' + pts(c5).length);
    ok('5.end    one radius per point, still, and the new one matches its neighbour',
       radii(c5).length === pts(c5).length,
       radii(c5).length + ' vs ' + pts(c5).length);
    K.finishCurveEdit(false);
    mark('5.end');

    /* 6 -- THE SLIDER'S SUBJECT. No selection: the tube's radius. A point
       selected: that point's own thickness, over the range the weight can
       express, written to the CURVE and not to the bar. */
    clearScene();
    const c6 = mkCurve('C', [[0, -1, 0], [0, 0, 0], [0, 1, 0]], { type: 'poly', res: 4 });
    K.App.selectedObjectIds = new Set([c6.id]);
    K.tubeSelection();
    ok('6.slider the tube bar is open with the editor inside it',
       !!K.opSetup && K.opSetup.kind === 'tube' && !!K.curveEdit && K.curveEdit.hosted === true);
    // Thin, so the rings are too small to offer and a tap reaches the DOT.
    K.opSetup.p.radius = 0.02;
    K.refreshOpSetupMesh();
    K.refreshTubeRings();
    const base = K.opSetup.p.radius;
    ok('6.slider with nothing selected the slider is the tube\'s',
       K.opSliderPoint() === -1 && Math.abs(K.opSliderValue() - base) < 1e-12,
       'i=' + K.opSliderPoint());
    const rngA = K.opSliderRange();
    ok('6.slider and it travels the tube\'s own range',
       Math.abs(rngA.lo - 0.005) < 1e-9, 'lo=' + rngA.lo);

    tap(at(world(c6, 1)));
    ok('6.slider tapping a point aims the slider at that point',
       K.opSliderPoint() === 1, 'i=' + K.opSliderPoint());
    ok('6.slider showing what the tube actually is there',
       Math.abs(K.opSliderValue() - base * radii(c6)[1]) < 1e-12,
       K.opSliderValue());
    const rngB = K.opSliderRange();
    ok('6.slider over exactly the range a point can be',
       Math.abs(rngB.lo - base * K.CURVE_R_MIN) < 1e-12 &&
       Math.abs(rngB.hi - base * K.CURVE_R_MAX) < 1e-12,
       rngB.lo + '..' + rngB.hi);
    ok('6.slider and the bar says which point it means',
       /point 2/.test(document.getElementById('opLabel').textContent),
       document.getElementById('opLabel').textContent);

    K.setOpSetupAmount(base * 2);
    ok('6.slider setting it fattens THAT point',
       Math.abs(radii(c6)[1] - 2) < 1e-9, JSON.stringify(radii(c6)));
    ok('6.slider and leaves the tube\'s own radius alone',
       Math.abs(K.opSetup.p.radius - base) < 1e-12, 'radius=' + K.opSetup.p.radius);
    ok('6.slider and its neighbours alone',
       Math.abs(radii(c6)[0] - 1) < 1e-9 && Math.abs(radii(c6)[2] - 1) < 1e-9,
       JSON.stringify(radii(c6)));
    K.setOpSetupAmount(base * 500);
    ok('6.slider it cannot be pushed past what a point can be',
       Math.abs(radii(c6)[1] - K.CURVE_R_MAX) < 1e-9, radii(c6)[1]);

    tap(at(world(c6, 1)));
    ok('6.slider tapping it again hands the slider back to the tube',
       K.opSliderPoint() === -1 &&
       /radius/.test(document.getElementById('opLabel').textContent) &&
       !/point/.test(document.getElementById('opLabel').textContent),
       document.getElementById('opLabel').textContent);
    const keep6 = radii(c6).slice();
    K.setOpSetupAmount(base * 3);
    ok('6.slider and then it moves the whole tube again',
       Math.abs(K.opSetup.p.radius - base * 3) < 1e-9 &&
       JSON.stringify(radii(c6)) === JSON.stringify(keep6),
       'radius=' + K.opSetup.p.radius + ' radii=' + JSON.stringify(radii(c6)));
    K.finishOpSetup(false);
    mark('6.slider');

    /* 7 -- DRAWING. The press still places a point; a press that travels was
       an orbit and places nothing, and must not complain about the plane
       either - it was never asked for a point. */
    clearScene();
    K.startCurveDraw();
    K.curveDraw.plane = 'y';
    const c7 = { x: rect.left + rect.width * 0.5, y: rect.top + rect.height * 0.5 };
    K.curvePointerDown(ev(c7.x, c7.y));
    K.curvePointerUp();
    ok('7.draw   a still press places a point',
       K.curveDraw.pts.length === 1, 'n=' + K.curveDraw.pts.length);
    K.curvePointerDown(ev(c7.x + 40, c7.y));
    K.curvePointerMove(ev(c7.x + 70, c7.y + 10));
    ok('7.draw   past the threshold it lets the point go',
       K.curveDraw.live === null && K.curveDraw.moved === true,
       'live=' + !!K.curveDraw.live);
    K.curvePointerMove(ev(c7.x + 140, c7.y + 60));
    K.curvePointerUp();
    ok('7.draw   and the release places nothing',
       K.curveDraw.pts.length === 1, 'n=' + K.curveDraw.pts.length);
    K.curvePointerDown(ev(c7.x + 60, c7.y + 40));
    K.curvePointerUp();
    ok('7.draw   the next still press still places one',
       K.curveDraw.pts.length === 2, 'n=' + K.curveDraw.pts.length);
    K.cancelCurveDraw(true);
    mark('7.draw');


    /* 8 -- WHAT THE REVIEW FOUND. Once the slider follows the selection, every
       path that MOVES the selection can leave the bar describing a point it no
       longer writes to - and a readout that lies about what OK will commit is
       the failure this file names most often. One invariant, checked after
       each of them: what the bar shows IS what the model has. */
    clearScene();
    const c8 = mkCurve('C', [[0, -1, 0], [0, 0, 0], [0, 1, 0]], { type: 'poly', res: 4 });
    K.App.selectedObjectIds = new Set([c8.id]);
    K.tubeSelection();
    const lab = () => document.getElementById('opLabel').textContent;
    const box = () => parseFloat(document.getElementById('opValue').value);
    const sld = () => parseFloat(document.getElementById('opSlider').value);
    function barAgrees(where) {
      const spi = K.opSliderPoint();
      const want = K.opSliderValue();
      const named = spi >= 0 ? new RegExp('point ' + (spi + 1) + '\\b').test(lab())
                             : !/point/.test(lab());
      // The range input snaps to min + k*step, so one step is as close as it
      // can get. The number box carries the exact figure.
      const step = parseFloat(document.getElementById('opSlider').step) || 1e-6;
      ok('8.bar    ' + where,
         named && Math.abs(box() - Number(want.toFixed(3))) < 1e-9 &&
         Math.abs(sld() - want) <= step + 1e-9,
         lab() + ' | box ' + box() + ' slider ' + sld() + ' want ' + want);
    }

    // Thin, so a press reaches the DOT rather than the ring.
    K.opSetup.p.radius = 0.02;
    K.refreshOpSetupMesh(); K.refreshTubeRings(); K.showOpSetupBar();
    const onLine = at(world(c8, 0).clone().lerp(world(c8, 1), 0.5));
    tap(onLine);
    ok('8.bar    inserting a point aims the slider at the new one',
       K.opSliderPoint() === 1 && pts(c8).length === 4,
       'i=' + K.opSliderPoint() + ' n=' + pts(c8).length);
    barAgrees('and the bar was redrawn for it');

    K.setOpSetupAmount(K.opSetup.p.radius * 3);
    K.curveEditDelete();
    barAgrees('deleting a point redraws it for whatever took its place');

    /* THE RING WRITES THE SAME NUMBER THE SLIDER SHOWS, so the two have to
       move together. Fat, so there is a ring to take hold of at all. */
    K.opSetup.p.radius = 0.35;
    K.curveEdit.sel = -1;
    K.refreshOpSetupMesh(); K.refreshTubeRings(); K.showOpSetupBar();
    const ring1 = K.tubeRingPts[1];
    const cen = at(ring1[0].clone().lerp(ring1[ring1.length >> 1], 0.5));
    let far8 = 0;
    ring1.forEach(q => {
      const sp = at(q);
      if (sp) far8 = Math.max(far8, Math.hypot(sp.x - cen.x, sp.y - cen.y));
    });
    const grab8 = Math.min(K.RING_GRAB_PX, Math.max(14, far8 * 0.55));
    const v8 = at(ring1[0]);
    ok('8.ring   the ring is big enough to be offered at all',
       far8 >= K.RING_MIN_PX && !!K.pickTubeRingPx(ev(v8.x, v8.y)),
       'far=' + far8.toFixed(0) + ' min=' + K.RING_MIN_PX);
    const dx8 = v8.x - cen.x, dy8 = v8.y - cen.y, L8 = Math.hypot(dx8, dy8) || 1;
    const out8 = { x: v8.x + dx8 / L8 * (grab8 + 12), y: v8.y + dy8 / L8 * (grab8 + 12) };
    ok('8.ring   a press well outside it is left for the camera',
       !K.pickTubeRingPx(ev(out8.x, out8.y)),
       'far=' + far8.toFixed(0) + ' grab=' + grab8.toFixed(0));

    K.curveEditPointerDown(ev(v8.x, v8.y));
    ok('8.ring   and a press on the stroke takes hold of it', !!K.tubeRadiusDrag);
    K.updateTubeRadiusDrag(ev(v8.x + dx8 / L8 * 40, v8.y + dy8 / L8 * 40));
    barAgrees('a ring drag keeps the readout in step');
    K.curveEditPointerUp(ev(v8.x + dx8 / L8 * 40, v8.y + dy8 / L8 * 40));

    /* THE NUMBER BOX. Half-typed text is put back on blur - and what is put
       back has to be the number the box was showing, not the tube's. */
    K.curveEdit.sel = 1; K.curveEditSelChanged();
    K.setOpSetupAmount(K.opSetup.p.radius * 2);
    document.getElementById('opValue').value = '1.2.3';
    document.getElementById('opValue').dispatchEvent(new Event('blur'));
    barAgrees('leaving the number box puts the POINT\'s number back');

    /* A STEP IS A GESTURE. Tapping points is how the slider gets aimed now,
       so a selection must not fill the forty-deep stack and push the real
       edits off the bottom of it. */
    K.opSetup.p.radius = 0.02;
    K.curveEdit.sel = -1;
    K.refreshOpSetupMesh(); K.refreshTubeRings(); K.showOpSetupBar();
    const steps0 = K.opSetup.steps.length;
    tap(at(world(c8, 1)));
    tap(at(world(c8, 1)));
    ok('8.step   selecting and letting go costs no steps',
       K.opSetup.steps.length === steps0,
       steps0 + ' -> ' + K.opSetup.steps.length);
    const g8 = at(world(c8, 1));
    K.curveEditPointerDown(ev(g8.x, g8.y));
    K.curveEditPointerMove(ev(g8.x + 45, g8.y - 45));
    K.curveEditPointerMove(ev(g8.x + 90, g8.y - 90));
    K.curveEditPointerUp(ev(g8.x + 90, g8.y - 90));
    ok('8.step   but a whole drag is exactly one',
       K.opSetup.steps.length === steps0 + 1,
       steps0 + ' -> ' + K.opSetup.steps.length);
    K.finishOpSetup(false);
    mark('8.bar');

    /* 9 -- AIMED BY THE PRESS. The camera is live under a tap now and turns
       from the first pixel, so a release judged against the moved view could
       miss the line the press was plainly on and extend the curve instead of
       inserting into it. Simulated at the extreme: the view is moved right
       between the press and the release. */
    clearScene();
    const c9 = mkCurve('C', [[-1, 0, 0], [0, 0, 0], [1, 0, 0]], { type: 'poly', res: 4 });
    K.App.selectedObjectIds = new Set([c9.id]);
    K.startCurveEdit(c9);
    K.curveEdit.plane = 'z';
    const line9 = at(world(c9, 0).clone().lerp(world(c9, 1), 0.5));
    // Where that press is aimed, measured before anything moves.
    const aim9 = K.pickCurveSpanOn(c9, ev(line9.x, line9.y), 22);
    ok('9.aim    the press is on the line to begin with', !!aim9);
    K.curveEditPointerDown(ev(line9.x, line9.y));
    K.camera.position.set(6, 5, 4);
    K.camera.lookAt(0, 0, 0);
    K.camera.updateMatrixWorld(true);
    K.curveEditPointerUp(ev(line9.x, line9.y));
    const got9 = pts(c9)[1] || [];
    ok('9.aim    a tap inserts exactly where the PRESS was aimed',
       !!aim9 && pts(c9).length === 4 && K.curveEdit.sel === 1 &&
       Math.abs(got9[0] - aim9.local.x) < 1e-6 &&
       Math.abs(got9[1] - aim9.local.y) < 1e-6 &&
       Math.abs(got9[2] - aim9.local.z) < 1e-6,
       'n=' + pts(c9).length + ' sel=' + K.curveEdit.sel +
       ' got=' + JSON.stringify(got9) +
       ' aimed=' + (aim9 ? [aim9.local.x, aim9.local.y, aim9.local.z] : 'null'));
    K.finishCurveEdit(false);
    mark('9.aim');

    finish();
  }

  setTimeout(() => {
    run().catch(e => { say('THREW ' + (e && e.stack ? e.stack : e)); fails++; finish(); });
  }, 3000);
})();
