/* v2.16 Tube. The frame is the whole risk, so it is measured directly AND
   against the naive method it replaces - a test that cannot fail on the old
   way is not testing the new one. */
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

  let K = null;
  const V = (x, y, z) => new K.THREE.Vector3(x, y, z);

  function clearScene() {
    K.App.objects.slice().forEach(o => { try { o.mesh.parent.remove(o.mesh); } catch (e) {} });
    K.App.objects.length = 0;
    K.App.selectedObjectIds = new Set();
    K.App.activeObjectId = null;
    K.App.mode = 'object';
  }

  function mkCurve(name, pts, opts) {
    return K.createCurveObject(name, V(0, 0, 0), pts.map(a => V(a[0], a[1], a[2])), opts || {});
  }

  function tangents(pts, closed) {
    const n = pts.length;
    return pts.map((p, i) => {
      const a = closed ? pts[(i - 1 + n) % n] : pts[Math.max(0, i - 1)];
      const b = closed ? pts[(i + 1) % n] : pts[Math.min(n - 1, i + 1)];
      return b.clone().sub(a).normalize();
    });
  }

  async function run() {
    K = window.__kubik;
    if (!K) { finish('__kubik is undefined - the app never started'); return; }
    ok('0.boot  app up, tube exported',
       !!K.App && typeof K.tubeCurveOp === 'function' && typeof K.tubeFrames === 'function');
    if (typeof K.tubeCurveOp !== 'function') { finish(); return; }
    mark('0.boot');

    /* 1 -- THE FRAME, measured, and against the method it replaces ---------
       An S in the XY plane. Its middle tangent is EXACTLY world up, which is
       where "cross the tangent with world up" collapses to a zero vector, and
       either side of that the cross flips sign - so the ring spins through
       half a turn in one step. That is the failure rotation-minimising frames
       exist to remove, and a curve that does not provoke it would let this
       whole section pass on the old method too.

       (The first draft used a half-circle arc, which does NOT provoke it: for
       a tangent in the XY plane the cross with world up is always +-Z, and it
       never changes sign along that arc. The control test failed, correctly,
       and it was the test that was wrong.) */
    const arc = [V(0, 0, 0), V(1, 1, 0), V(0, 2, 0), V(-1, 3, 0), V(0, 4, 0)];
    const T = tangents(arc, false);
    const R = K.tubeFrames(arc, T, false);

    let worstPerp = 0;
    R.forEach((r, i) => { worstPerp = Math.max(worstPerp, Math.abs(r.dot(T[i]))); });
    ok('1.frame  every frame is perpendicular to its tangent',
       worstPerp < 1e-6, 'worst |r·t| = ' + worstPerp.toExponential(2));

    let worstStep = 1;
    for (let i = 0; i + 1 < R.length; i++) worstStep = Math.min(worstStep, R[i].dot(R[i + 1]));
    ok('1.frame  and no step spins the ring',
       worstStep > 0.9, 'worst consecutive r·r = ' + worstStep.toFixed(4));

    // The naive frame, on the same curve, so this test is shown to discriminate.
    const up = V(0, 1, 0);
    const naive = T.map(t => {
      const r = new K.THREE.Vector3().crossVectors(t, up);
      return r.lengthSq() < 1e-12 ? V(NaN, NaN, NaN) : r.normalize();
    });
    let naiveWorst = 1, naiveBad = false;
    for (let i = 0; i + 1 < naive.length; i++) {
      const d = naive[i].dot(naive[i + 1]);
      if (!Number.isFinite(d)) { naiveBad = true; continue; }
      naiveWorst = Math.min(naiveWorst, d);
    }
    ok('1.frame  the naive up-vector frame DOES break on this curve',
       naiveBad || naiveWorst < 0.5,
       naiveBad ? 'it goes degenerate' : ('worst = ' + naiveWorst.toFixed(4)));
    mark('1.frame');

    // 2 -- a closed curve's frame comes back to itself ---------------------
    const ring = [];
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      ring.push(V(Math.cos(a) * 2, Math.sin(a) * 2, Math.sin(a * 2) * 0.4));
    }
    const Tc = tangents(ring, true);
    const Rc = K.tubeFrames(ring, Tc, true);
    let wrapStep = 1;
    for (let i = 0; i < Rc.length; i++) wrapStep = Math.min(wrapStep, Rc[i].dot(Rc[(i + 1) % Rc.length]));
    ok('2.seam   a closed curve has no jump at the seam either',
       wrapStep > 0.85, 'worst step including the wrap = ' + wrapStep.toFixed(4));
    let perp2 = 0;
    Rc.forEach((r, i) => { perp2 = Math.max(perp2, Math.abs(r.dot(Tc[i]))); });
    ok('2.seam   and the correction did not tilt them off the tangent',
       perp2 < 1e-6, 'worst |r·t| = ' + perp2.toExponential(2));
    mark('2.seam');

    // 3 -- the mesh a tube makes -------------------------------------------
    clearScene();
    const line = mkCurve('Line', [[0, 0, 0], [0, 1, 0], [0, 2, 0]], { type: 'poly', res: 8 });
    let r = K.tubeCurveOp(line, 0.2, 8, true);
    ok('3.mesh   an open curve with caps: sides x spans, plus two ends',
       r.ok && r.count === 8 * 2 + 2, JSON.stringify(r.ok ? { count: r.count } : r));
    let made = r.ok ? K.createObjectFromEditable('T', V(0, 0, 0), r.ed, r.mats, {}) : null;
    let w = made ? K.auditWinding(made) : null;
    ok('3.mesh   and it is closed', !!w && w.boundary === 0, w && JSON.stringify(w));
    ok('3.mesh   wound consistently, one shell',
       !!w && w.conflictEdges === 0 && w.nonManifold === 0 && w.reversed === 0 && w.shells === 1,
       w && JSON.stringify(w));

    clearScene();
    const line2 = mkCurve('Line', [[0, 0, 0], [0, 1, 0], [0, 2, 0]], { type: 'poly', res: 8 });
    r = K.tubeCurveOp(line2, 0.2, 8, false);
    made = r.ok ? K.createObjectFromEditable('T', V(0, 0, 0), r.ed, r.mats, {}) : null;
    w = made ? K.auditWinding(made) : null;
    ok('3.mesh   no caps leaves exactly the two rims open',
       r.ok && r.count === 16 && !!w && w.boundary === 16,
       (r.ok ? 'faces=' + r.count + ' ' : '') + (w ? JSON.stringify(w) : ''));
    mark('3.mesh');

    // 4 -- a closed curve makes a torus, with no caps and no holes ----------
    clearScene();
    const loop = mkCurve('Loop',
      [[2, 0, 0], [0, 2, 0], [-2, 0, 0], [0, -2, 0]],
      { type: 'bezier', res: 6, closed: true });
    r = K.tubeCurveOp(loop, 0.3, 8, true);
    made = r.ok ? K.createObjectFromEditable('T', V(0, 0, 0), r.ed, r.mats, {}) : null;
    w = made ? K.auditWinding(made) : null;
    ok('4.loop   a closed curve needs no caps and has no holes',
       !!w && w.boundary === 0 && w.shells === 1, w && JSON.stringify(w));
    ok('4.loop   wound consistently all the way round',
       !!w && w.conflictEdges === 0 && w.nonManifold === 0 && w.reversed === 0,
       w && JSON.stringify(w));
    ok('4.loop   sides x samples, and nothing doubled at the seam',
       r.ok && r.count === 8 * 24, r.ok && ('faces=' + r.count));
    mark('4.loop');

    // 5 -- it faces outward ------------------------------------------------
    // Same question the lathe asks, and the same reason: a shell that is
    // inside out is watertight, consistently wound, and invisible to the audit.
    clearScene();
    const st = mkCurve('S', [[0, 0, 0], [0, 2, 0]], { type: 'poly', res: 8 });
    r = K.tubeCurveOp(st, 0.25, 8, false);
    made = r.ok ? K.createObjectFromEditable('T', V(0, 0, 0), r.ed, r.mats, {}) : null;
    if (made) {
      const ed = K.toEditable(made.mesh);
      const loop0 = K.getGroupBoundaryLoopAttr(ed, 0);
      const pts = loop0.map(a => V(ed.positions[a * 3], ed.positions[a * 3 + 1], ed.positions[a * 3 + 2]));
      const nrm = V(0, 0, 0), cen = V(0, 0, 0);
      for (let i = 0; i < pts.length; i++) {
        const a = pts[i], b = pts[(i + 1) % pts.length];
        nrm.x += (a.y - b.y) * (a.z + b.z);
        nrm.y += (a.z - b.z) * (a.x + b.x);
        nrm.z += (a.x - b.x) * (a.y + b.y);
        cen.add(a);
      }
      cen.multiplyScalar(1 / pts.length);
      made.mesh.updateMatrixWorld();
      const cw = cen.clone().applyMatrix4(made.mesh.matrixWorld);
      // The curve runs up Y, so the radial is whatever is left after Y.
      const radial = V(cw.x, 0, cw.z);
      const nw = nrm.clone().transformDirection(made.mesh.matrixWorld);
      ok('5.facing the wall faces away from the curve',
         radial.lengthSq() > 1e-9 && nw.dot(radial) > 0,
         'normal·radial = ' + nw.dot(radial).toFixed(4));
    } else {
      ok('5.facing the wall faces away from the curve', false, 'no mesh');
    }
    mark('5.facing');

    // 6 -- refusals and clamps ---------------------------------------------
    clearScene();
    const lone = mkCurve('Lone', [[0, 0, 0]], { type: 'poly' });
    ok('6.refuse a one-point curve is refused',
       K.tubeCurveOp(lone, 0.2, 8, true).ok === false,
       JSON.stringify(K.tubeCurveOp(lone, 0.2, 8, true)));

    clearScene();
    const dup = mkCurve('Dup', [[0, 0, 0], [0, 0, 0], [0, 1, 0]], { type: 'poly' });
    const rd = K.tubeCurveOp(dup, 0.2, 6, false);
    ok('6.refuse a repeated point is dropped, not tripped over',
       rd.ok === true && rd.count === 6, JSON.stringify(rd.ok ? { count: rd.count } : rd));

    clearScene();
    const cl = mkCurve('Cl', [[0, 0, 0], [0, 1, 0]], { type: 'poly' });
    const r2 = K.tubeCurveOp(cl, 0.2, 2, false);
    const r99 = K.tubeCurveOp(cl, 0.2, 999, false);
    ok('6.refuse sides are clamped at both ends, not refused',
       r2.ok && r2.sides === 3 && r99.ok && r99.sides === K.TUBE_SIDES_MAX,
       (r2.sides) + ' and ' + (r99.sides));
    mark('6.refuse');

    // 7 -- the setup bar: made at once, dialled in, history only on OK ------
    clearScene();
    const sc = mkCurve('Rail', [[0, 0, 0], [0, 1, 0], [1, 2, 0]], { type: 'bezier', res: 6 });
    K.App.selectedObjectIds = new Set([sc.id]);
    K.tubeSelection();
    ok('7.setup  a tube appears the moment you tap it',
       !!K.tubeSetup && K.App.objects.length === 2, 'objects=' + K.App.objects.length);
    let tobj = K.tubeSetup ? K.findObject(K.tubeSetup.objId) : null;
    const faces0 = tobj ? tobj.mesh.geometry.groups.length : -1;
    const r0 = K.tubeSetup ? K.tubeSetup.radius : -1;

    K.stepTubeSides(4);
    tobj = K.tubeSetup ? K.findObject(K.tubeSetup.objId) : null;
    ok('7.setup  the stepper changes how many sides it has',
       !!K.tubeSetup && K.tubeSetup.sides === 12 &&
       tobj && tobj.mesh.geometry.groups.length > faces0,
       (K.tubeSetup && K.tubeSetup.sides) + ' sides, ' +
       faces0 + ' -> ' + (tobj && tobj.mesh.geometry.groups.length));

    const box0 = tobj ? new K.THREE.Box3().setFromObject(tobj.mesh) : null;
    K.setTubeRadius(r0 * 3);
    tobj = K.tubeSetup ? K.findObject(K.tubeSetup.objId) : null;
    const box1 = tobj ? new K.THREE.Box3().setFromObject(tobj.mesh) : null;
    ok('7.setup  and the slider actually makes it fatter',
       !!box0 && !!box1 &&
       box1.getSize(new K.THREE.Vector3()).z > box0.getSize(new K.THREE.Vector3()).z + 1e-4,
       box0 && box1 ? (box0.getSize(new K.THREE.Vector3()).z.toFixed(3) + ' -> ' +
                       box1.getSize(new K.THREE.Vector3()).z.toFixed(3)) : 'no box');

    const capsBefore = K.auditWinding(tobj).boundary;
    K.tubeSetup.caps = false;
    K.refreshTubeMesh();
    tobj = K.findObject(K.tubeSetup.objId);
    ok('7.setup  turning the caps off opens the two ends',
       capsBefore === 0 && K.auditWinding(tobj).boundary > 0,
       capsBefore + ' -> ' + K.auditWinding(tobj).boundary);
    mark('7.setup');

    // 8 -- Cancel takes it away, OK keeps it and is one undo step -----------
    K.finishTubeSetup(false);
    ok('8.commit Cancel removes the tube and leaves the curve',
       !K.tubeSetup && K.App.objects.length === 1 && K.isCurve(K.App.objects[0]),
       'objects=' + K.App.objects.length);

    clearScene();
    const sc2 = mkCurve('Rail', [[0, 0, 0], [0, 1, 0], [1, 2, 0]], { type: 'bezier', res: 6 });
    K.App.selectedObjectIds = new Set([sc2.id]);
    K.pushHistory();
    K.tubeSelection();
    K.stepTubeSides(2);
    K.setTubeRadius(0.3);
    K.finishTubeSetup(true);
    const kept = K.App.objects.length;
    K.undo();
    ok('8.commit OK keeps it, and every radius tried on the way is ONE step',
       kept === 2 && K.App.objects.length === 1 && K.isCurve(K.App.objects[0]),
       kept + ' -> ' + K.App.objects.length);
    mark('8.commit');

    // 9 -- the ring -----------------------------------------------------------
    clearScene();
    const rc = mkCurve('C', [[0, 0, 0], [0, 1, 0]], {});
    K.App.selectedObjectIds = new Set([rc.id]);
    const ring2 = K.currentHubTools();
    ok('9.ring   Tube holds seat 7, Lathe seat 6',
       ring2.some(t => t.key === 'tube' && t.seat === 7) &&
       ring2.some(t => t.key === 'lathe' && t.seat === 6),
       ring2.map(t => t.key + '@' + t.seat).join(','));
    ok('9.ring   and the eight seats are all taken, none twice',
       new Set(ring2.map(t => t.seat)).size === ring2.length && ring2.length === 8,
       'n=' + ring2.length + ' distinct=' + new Set(ring2.map(t => t.seat)).size);
    mark('9.ring');

    /* 10 -- ORIENTATION ON THE SHAPE THE REVIEW BROKE IT WITH ---------------
       Section 5 measures a STRAIGHT tube, where the first quad's centroid
       carries half a step along a tangent that is exactly that step - so
       projecting the tangent out removed it and the measurement was clean.
       On a CLOSED curve the tangent at the seam is a central difference
       across the corner, half the step survives it, and on a square of side 1
       at the default radius that residual is three times the true radial and
       points the other way. The whole wall flipped, and which way round you
       drew the square decided it.

       Signed volume catches it outright, and it is calibrated against a cube
       first because the sign convention is the app's, not arithmetic's. */
    function signedVolume(obj) {
      const ed = K.toEditable(obj.mesh);
      let v = 0;
      const g = (i) => V(ed.positions[i * 3], ed.positions[i * 3 + 1], ed.positions[i * 3 + 2]);
      ed.groups.forEach(grp => grp.triangles.forEach(t => {
        v += g(t[0]).dot(new K.THREE.Vector3().crossVectors(g(t[1]), g(t[2]))) / 6;
      }));
      return v;
    }

    clearScene();
    const ced = K.buildPrimitiveEditable('cube', {});
    const cube = K.createObjectFromEditable('Cube', V(0, 0, 0), ced,
      K.makeMaterialSet(ced.groups.length || 1, 0x9aa3b2), {});
    ok('10.orient a cube reads POSITIVE, so positive is outward here',
       signedVolume(cube) > 0, 'volume = ' + signedVolume(cube).toFixed(4));

    const square = [[0, 0, 0], [0, 0, 1], [1, 0, 1], [1, 0, 0]];
    let worst = Infinity, worstName = '';
    for (let start = 0; start < 4; start++) {
      for (let dir = 0; dir < 2; dir++) {
        const pts = [];
        for (let i = 0; i < 4; i++) pts.push(square[(start + i) % 4]);
        if (dir) pts.reverse();
        clearScene();
        const c = mkCurve('Sq', pts, { type: 'poly', res: 4, closed: true });
        const rr = K.tubeCurveOp(c, 0.085, 8, false);
        if (!rr.ok) { worst = -1; worstName = 'refused: ' + rr.why; continue; }
        const m = K.createObjectFromEditable('T', V(0, 0, 0), rr.ed, rr.mats, {});
        const v = signedVolume(m);
        if (v < worst) { worst = v; worstName = 'start ' + start + (dir ? ' reversed' : ''); }
      }
    }
    ok('10.orient a closed square tubes SOLID from every corner, both ways',
       worst > 0, 'worst was ' + worstName + ' at ' + worst.toFixed(4));

    // And a capped straight tube, which is also closed and so also has a sign.
    clearScene();
    const strt = mkCurve('St', [[0, 0, 0], [0, 1, 0], [0, 2, 0]], { type: 'poly', res: 4 });
    const rs = K.tubeCurveOp(strt, 0.2, 8, true);
    const sm = rs.ok ? K.createObjectFromEditable('T', V(0, 0, 0), rs.ed, rs.mats, {}) : null;
    ok('10.orient and a capped straight tube is solid too',
       !!sm && signedVolume(sm) > 0, sm ? signedVolume(sm).toFixed(4) : 'no mesh');
    mark('10.orient');

    // 11 -- a closed curve with two points is not a loop --------------------
    clearScene();
    const two = mkCurve('Two', [[0, 0, 0], [0, 1, 0]], { type: 'poly', res: 4, closed: true });
    const rt = K.tubeCurveOp(two, 0.1, 6, true);
    const tm = rt.ok ? K.createObjectFromEditable('T', V(0, 0, 0), rt.ed, rt.mats, {}) : null;
    const tw = tm ? K.auditWinding(tm) : null;
    ok('11.degen a closed two-point curve is tubed as the open line it is',
       !!tw && tw.conflictEdges === 0 && tw.nonManifold === 0 && tw.boundary === 0,
       tw && JSON.stringify(tw));
    mark('11.degen');

    finish();
  }

  setTimeout(() => {
    run().catch(e => { say('THREW ' + (e && e.stack ? e.stack : e)); fails++; finish(); });
  }, 3000);
})();
