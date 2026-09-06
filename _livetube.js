/* _livetube - a tube that is still a tube (v2.20).

   The tube stops being a mesh the moment you accept it. It remembers the
   curve and the numbers, Component mode opens the same bar again on the same
   object, and Make geo is the one door out. Everything here drives the real
   doors - setMode, the bar, the pointer - because the interesting failures
   are all in the lifecycle rather than in the sweep. */
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
  const ev = (x, y) => ({ clientX: x, clientY: y, pointerId: 9, button: 0 });
  const tap = (pt) => {
    K.curveEditPointerDown(ev(pt.x, pt.y));
    K.curveEditPointerUp(ev(pt.x, pt.y));
  };
  const pts = (o) => cvOf(o).pts;
  const faces = (o) => o.mesh.geometry.groups.length;

  /* A SECTION THAT THROWS IS A SECTION THAT FAILED, not a run that stopped.
     The broken copy takes the guards out, so the very first dereference after
     one of them can be null - and the first draft of this probe reported ONE
     failure and hid the thirty checks behind it. */
  /* NEVER DEREFERENCE WHAT A BROKEN BUILD CAN LEAVE NULL. A probe that
     THROWS reports one failure and hides the thirty checks behind it, which
     is exactly the run the broken copy exists to produce - so the two things
     a live tube is made of are read through these. */
  const tubeP = (o) => (K.tubeDataOf(o) || {}).p || {};
  const cvOf = (o) => K.curveDataOf(o) || { pts: [], radii: [], res: 0 };

  // A live tube, made the way a finger makes one.
  function makeTube(curve) {
    K.App.selectedObjectIds = new Set([curve.id]);
    K.tubeSelection();
    K.finishOpSetup(true);
    return K.App.objects.filter(o => !K.isCurve(o)).slice(-1)[0];
  }

  async function run() {
    K = window.__kubik;
    if (!K) { finish('__kubik is undefined - the app never started'); return; }
    rect = document.getElementById('viewport').getBoundingClientRect();
    ok('0.boot  app up, the live tube exported',
       !!K.App && typeof K.isLiveTube === 'function' && typeof K.makeTubeGeo === 'function');
    if (typeof K.makeTubeGeo !== 'function') { finish(); return; }
    mark('0.boot');

    /* 1 -- ACCEPTING A TUBE LEAVES A TUBE, and takes the curve inside it. */
    clearScene();
    const c1 = mkCurve('C', [[0, 0, 0], [0, 1, 0], [0, 2, 0]], { type: 'bezier', res: 6 });
    const t1 = makeTube(c1);
    ok('1.live   the object remembers it is a tube',
       !!t1 && K.isLiveTube(t1) && K.hasCurveData(t1),
       t1 && JSON.stringify(K.tubeDataOf(t1) && tubeP(t1)));
    ok('1.live   and it remembers what it was dialled to',
       tubeP(t1).sides === 8 && tubeP(t1).profile === 'round',
       JSON.stringify(tubeP(t1)));
    /* THE CURVE IS INSIDE IT, not beside it. One object, so nothing that
       walks the scene has to know a tube is special - which is the whole
       reason this stopped being a second object at v2.20a. */
    ok('1.live   the curve went inside the tube, not beside it',
       !K.findObject(c1.id) && K.App.objects.length === 1,
       'objects=' + K.App.objects.length);
    ok('1.live   and it is NOT a curve, so nothing refuses it as one',
       !K.isCurve(t1) && K.hasCurveData(t1),
       'isCurve=' + K.isCurve(t1));
    ok('1.live   the spine came across into the tube\'s own space',
       cvOf(t1).pts.length === 3,
       JSON.stringify(cvOf(t1).pts.map(a => a.map(v => +v.toFixed(2)))));
    mark('1.live');

    /* 2 -- COMPONENT MODE OPENS THE SAME BAR, on the SAME object. A second
       object with a new id would lose every group, selection and isolation
       entry that named the first. */
    K.App.selectedObjectIds = new Set([t1.id]);
    K.setMode('vertex');
    ok('2.reopen Component mode on a tube opens its own bar again',
       !!K.opSetup && K.opSetup.kind === 'tube', K.opSetup && K.opSetup.kind);
    ok('2.reopen on the SAME object, not a copy of it',
       K.opSetup.objId === t1.id && K.opSetup.adopted === true,
       'objId=' + K.opSetup.objId + ' vs ' + t1.id);
    ok('2.reopen with the numbers it kept',
       K.opSetup.p.sides === 8 && K.opSetup.p.profile === 'round',
       JSON.stringify(K.opSetup.p));
    ok('2.reopen with the point editor inside it, as a guest',
       !!K.curveEdit && K.curveEdit.hosted === true &&
       K.curveEdit.objId === t1.id, 'edit=' + !!K.curveEdit);
    ok('2.reopen and App.mode is still object underneath it',
       K.App.mode === 'object', 'mode=' + K.App.mode);

    // The two counters, and the rings.
    const f0 = faces(t1);
    K.stepOpSetup(4);
    ok('2.reopen the roundness counter makes it rounder',
       K.opSetup.p.sides === 12 && faces(t1) > f0, 'sides=' + K.opSetup.p.sides);
    const f1 = faces(t1);
    K.stepOpSetup2(4);
    ok('2.reopen the length counter divides it along',
       K.opSetup.p.res === 10 && cvOf(t1).res === 10 && faces(t1) > f1,
       'res=' + K.opSetup.p.res + ' faces ' + f1 + '->' + faces(t1));
    ok('2.reopen every point wears a ring at its own thickness',
       K.tubeRingPts.length === cvOf(t1).pts.length, 'rings=' + K.tubeRingPts.length);
    mark('2.reopen');

    /* 3 -- ✕ ON A TUBE THAT WAS ALREADY THERE puts the settings back and
       leaves the object alone. There was nothing to remove: it was here
       first, and deleting it would throw away work over a change of mind. */
    const before = faces(t1);
    K.finishOpSetup(false);
    ok('3.cancel Cancel keeps the object and puts the numbers back',
       !!K.findObject(t1.id) && tubeP(t1).sides === 8 &&
       faces(t1) < before, 'faces ' + before + ' -> ' + faces(t1));
    ok('3.cancel and the guest editor goes with the bar',
       !K.curveEdit && K.tubeRingPts.length === 0,
       'edit=' + !!K.curveEdit + ' rings=' + K.tubeRingPts.length);
    mark('3.cancel');

    /* 4 -- POINTS, edited from the tube's own bar. Add one and the tube grows
       with it, in the same rebuild. */
    K.App.selectedObjectIds = new Set([t1.id]);
    K.setMode('vertex');
    K.opSetup.p.radius = 0.15;
    K.refreshOpSetupMesh();
    K.curveEdit.plane = 'z';
    const n0 = cvOf(t1).pts.length, fA = faces(t1);
    tap(at(V(2.5, 1, 0)));                      // out in space: append
    ok('4.points a tap in space adds a point and the tube follows it',
       cvOf(t1).pts.length === n0 + 1 && faces(t1) > fA,
       'points ' + n0 + '->' + cvOf(t1).pts.length + ' faces ' + fA + '->' + faces(t1));

    // ...and a drag on the DOT moves it, rather than changing its thickness.
    const grab = at(V(2.5, 1, 0));
    const r0 = cvOf(t1).radii[cvOf(t1).pts.length - 1];
    K.curveEditPointerDown(ev(grab.x, grab.y));
    K.curveEditPointerMove(ev(grab.x, grab.y - 70));
    K.curveEditPointerUp(ev(grab.x, grab.y - 70));
    /* IN WORLD SPACE. The points are local to the tube, and the tube's own
       origin is its bounding-box centre - so a local y says nothing until it
       has been through the object's transform. */
    const lastW = (o) => {
      const a = cvOf(o).pts.slice(-1)[0];
      o.mesh.updateMatrixWorld();
      return new K.THREE.Vector3(a[0], a[1], a[2]).applyMatrix4(o.mesh.matrixWorld);
    };
    ok('4.points dragging the dot MOVES the point, at its own thickness',
       Math.abs(cvOf(t1).radii[cvOf(t1).pts.length - 1] - r0) < 1e-9 &&
       lastW(t1).y > 1.4,
       'world y=' + lastW(t1).y.toFixed(2) +
       ' r=' + cvOf(t1).radii[cvOf(t1).pts.length - 1]);
    ok('4.points nothing has reached the history yet',
       tubeP(t1).sides === 8, 'stored sides=' + tubeP(t1).sides);
    mark('4.points');

    /* 5 -- THE RING is the radius handle, and only when it is big enough on
       screen to aim at separately from the dot underneath it.

       THIN FIRST, so the rule is tested in the direction that matters: a ring
       drawn inside the dot's own grab radius is two handles in one place, and
       the app offers neither rather than guessing. The slider still sets it. */
    K.opSetup.p.radius = 0.02;
    K.refreshOpSetupMesh();
    const thin = at(K.tubeRingPts[0][0]);
    ok('5.ring   a ring too small to aim at is not offered',
       !K.pickTubeRingPx(ev(thin.x, thin.y)));

    K.opSetup.p.radius = 0.6;
    K.refreshOpSetupMesh();
    const ringed = K.pickTubeRingPx(ev(
      at(K.tubeRingPts[0][0]).x, at(K.tubeRingPts[0][0]).y));
    ok('5.ring   a press on the ring finds that ring',
       !!ringed && ringed.i === 0, ringed && ('i=' + ringed.i));
    const rr0 = cvOf(t1).radii[0];
    const rpx = at(K.tubeRingPts[0][0]);
    K.curveEditPointerDown(ev(rpx.x, rpx.y));
    ok('5.ring   and takes hold of it as a radius drag, not a move',
       !!K.tubeRadiusDrag, 'drag=' + !!K.tubeRadiusDrag);
    K.updateTubeRadiusDrag(ev(rpx.x + 40, rpx.y));
    K.curveEditPointerUp(ev(rpx.x + 40, rpx.y));
    ok('5.ring   dragging it changes that point\'s thickness alone',
       cvOf(t1).radii[0] !== rr0 &&
       Math.abs(cvOf(t1).pts[0][0]) < 1e-9 && !K.tubeRadiusDrag,
       rr0 + ' -> ' + cvOf(t1).radii[0]);
    mark('5.ring');

    /* 6 -- MAKE GEO is the one door out. It keeps what is on screen, drops
       the link and drops the curve - and what is left is an ordinary mesh,
       which is the point: every other op in this app works on those. */
    const wasFaces = faces(t1);
    K.makeTubeGeo(t1);
    ok('6.bake   the tube is geometry now',
       !K.isLiveTube(t1) && !!K.findObject(t1.id) && faces(t1) === wasFaces,
       'live=' + K.isLiveTube(t1) + ' faces=' + faces(t1));
    ok('6.bake   and the curve went with the link',
       !K.findObject(c1.id) && K.App.objects.length === 1 && K.App.hidden.size === 0,
       'objects=' + K.App.objects.length + ' hidden=' + K.App.hidden.size);
    K.App.selectedObjectIds = new Set([t1.id]);
    K.setMode('vertex');
    ok('6.bake   Component mode on it edits VERTICES again, like any mesh',
       K.App.mode === 'vertex' && !K.opSetup, 'mode=' + K.App.mode);
    K.setMode('object');
    mark('6.bake');

    /* 7 -- SAVED, LOADED AND UNDONE as a tube. Ids survive a restore, which
       is what the link is made of. */
    clearScene();
    const c7 = mkCurve('C', [[0, 0, 0], [0, 1, 0], [0, 2, 0]], { type: 'bezier', res: 6 });
    const t7 = makeTube(c7);
    K.restoreDoc(K.serializeDoc(), {});
    const t7b = K.App.objects.filter(o => !K.isCurve(o))[0];
    ok('7.doc    a tube comes back from a document as a tube',
       !!t7b && K.isLiveTube(t7b), t7b && ('live=' + K.isLiveTube(t7b)));
    ok('7.doc    with its spine, its radii and its numbers',
       !!t7b && K.hasCurveData(t7b) && cvOf(t7b).pts.length === 3 &&
       cvOf(t7b).radii.length === 3 && tubeP(t7b).sides === 8,
       t7b && JSON.stringify(tubeP(t7b)));
    ok('7.doc    and it is still ONE object, with nothing hidden',
       K.App.objects.length === 1 && K.App.hidden.size === 0,
       'objects=' + K.App.objects.length + ' hidden=' + K.App.hidden.size);

    /* A COPY IS A WHOLE TUBE, not a mesh that looks like one. The spine is a
       field on the mesh, so it comes with it - which is what the second
       object could never do. */
    K.App.selectedObjectIds = new Set([t7b.id]);
    const dup = K.cloneObjectInto(t7b, 'Copy');
    ok('7.doc    a duplicate is a tube in its own right',
       !!dup && K.isLiveTube(dup) && K.hasCurveData(dup) &&
       cvOf(dup) !== cvOf(t7b) && !!K.curveDataOf(dup),
       'live=' + (dup && K.isLiveTube(dup)));

    K.removeObjects([t7b, dup]);
    ok('7.doc    deleting a tube leaves nothing behind',
       K.App.objects.length === 0 && K.App.hidden.size === 0,
       'objects=' + K.App.objects.length + ' hidden=' + K.App.hidden.size);
    mark('7.doc');

    /* 8 -- IT LETS GO OF EVERYTHING. A bar that owns the pointer and hides
       an object has two things to hand back on every exit, including the one
       restoreDoc takes. */
    clearScene();
    const c8 = mkCurve('C', [[0, 0, 0], [0, 1, 0], [0, 2, 0]], { type: 'bezier', res: 6 });
    const t8 = makeTube(c8);
    K.App.selectedObjectIds = new Set([t8.id]);
    K.setMode('vertex');
    K.restoreDoc(K.serializeDoc(), {});
    ok('8.release a document loading under it drops the bar and the guest',
       !K.opSetup && !K.curveEdit && K.orbit.enabled === true,
       'setup=' + !!K.opSetup + ' edit=' + !!K.curveEdit);
    ok('8.release and leaves no rings hanging in the scene',
       K.tubeRingPts.length === 0, 'rings=' + K.tubeRingPts.length);
    mark('8.release');

    /* 9 -- STEPPING BACK INSIDE THE BAR (v2.21) ----------------------------
       One wrong drag used to cost the whole setup: the only way back was ✕,
       so the fix for a single bad move was to start the tube again. Undo now
       steps back one GESTURE at a time, and only backs out of the op once
       there is nothing left inside it to give back. */
    clearScene();
    const c9 = mkCurve('C', [[0, 0, 0], [0, 1, 0], [0, 2, 0]], { type: 'bezier', res: 6 });
    const t9 = makeTube(c9);
    K.App.selectedObjectIds = new Set([t9.id]);
    K.setMode('vertex');
    ok('9.back   a fresh bar has nothing to step back yet',
       !K.opSetupHasSteps(), 'steps=' + !!K.opSetupHasSteps());

    const sides0 = tubeP(t9).sides;
    K.stepOpSetup(4);
    K.stepOpSetup2(2);
    ok('9.back   two counter taps are two steps',
       K.opSetup.steps.length === 2 && K.opSetup.p.sides === sides0 + 4,
       'steps=' + K.opSetup.steps.length + ' sides=' + K.opSetup.p.sides);

    K.undo();
    ok('9.back   Undo takes back the LAST one, and stays in the bar',
       !!K.opSetup && K.opSetup.p.res === 6 && K.opSetup.p.sides === sides0 + 4,
       K.opSetup && ('res=' + K.opSetup.p.res + ' sides=' + K.opSetup.p.sides));
    K.undo();
    ok('9.back   and then the one before it',
       !!K.opSetup && K.opSetup.p.sides === sides0,
       K.opSetup && ('sides=' + K.opSetup.p.sides));

    /* A POINT EDIT IS A STEP TOO, and it is the one that hurt: a mis-drag
       used to mean starting over. */
    K.curveEdit.plane = 'z';
    const n9 = cvOf(t9).pts.length;
    tap(at(V(2.5, 1, 0)));
    ok('9.back   adding a point is one step',
       cvOf(t9).pts.length === n9 + 1 && K.opSetup.steps.length === 1,
       'points=' + cvOf(t9).pts.length + ' steps=' + K.opSetup.steps.length);
    K.undo();
    ok('9.back   Undo takes the point back without closing anything',
       !!K.opSetup && !!K.curveEdit && cvOf(t9).pts.length === n9,
       'points=' + cvOf(t9).pts.length + ' setup=' + !!K.opSetup);

    // ...and the last press, with the stack empty, backs out of the op.
    ok('9.back   the stack is empty again', !K.opSetupHasSteps());
    K.undo();
    ok('9.back   with nothing left inside, Undo backs out of the op',
       !K.opSetup && !!K.findObject(t9.id) && K.isLiveTube(t9),
       'setup=' + !!K.opSetup + ' tube=' + K.isLiveTube(t9));
    mark('9.back');

    finish();
  }

  setTimeout(() => {
    run().catch(e => { say('THREW ' + (e && e.stack ? e.stack : e)); fails++; finish(); });
  }, 3000);
})();
