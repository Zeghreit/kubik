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
       !!K.opSetup && K.App.objects.length === 2, 'objects=' + K.App.objects.length);
    let tobj = K.opSetup ? K.findObject(K.opSetup.objId) : null;
    const faces0 = tobj ? tobj.mesh.geometry.groups.length : -1;
    const r0 = K.opSetup ? K.opSetup.p.radius : -1;

    K.stepOpSetup(4);
    tobj = K.opSetup ? K.findObject(K.opSetup.objId) : null;
    ok('7.setup  the stepper changes how many sides it has',
       !!K.opSetup && K.opSetup.p.sides === 12 &&
       tobj && tobj.mesh.geometry.groups.length > faces0,
       (K.opSetup && K.opSetup.p.sides) + ' sides, ' +
       faces0 + ' -> ' + (tobj && tobj.mesh.geometry.groups.length));

    const box0 = tobj ? new K.THREE.Box3().setFromObject(tobj.mesh) : null;
    K.setOpSetupAmount(r0 * 3);
    tobj = K.opSetup ? K.findObject(K.opSetup.objId) : null;
    const box1 = tobj ? new K.THREE.Box3().setFromObject(tobj.mesh) : null;
    ok('7.setup  and the slider actually makes it fatter',
       !!box0 && !!box1 &&
       box1.getSize(new K.THREE.Vector3()).z > box0.getSize(new K.THREE.Vector3()).z + 1e-4,
       box0 && box1 ? (box0.getSize(new K.THREE.Vector3()).z.toFixed(3) + ' -> ' +
                       box1.getSize(new K.THREE.Vector3()).z.toFixed(3)) : 'no box');

    const capsBefore = K.auditWinding(tobj).boundary;
    K.opSetup.p.caps = false;
    K.refreshOpSetupMesh();
    tobj = K.findObject(K.opSetup.objId);
    ok('7.setup  turning the caps off opens the two ends',
       capsBefore === 0 && K.auditWinding(tobj).boundary > 0,
       capsBefore + ' -> ' + K.auditWinding(tobj).boundary);
    mark('7.setup');

    // 8 -- Cancel takes it away, OK keeps it and is one undo step -----------
    K.finishOpSetup(false);
    ok('8.commit Cancel removes the tube and leaves the curve',
       !K.opSetup && K.App.objects.length === 1 && K.isCurve(K.App.objects[0]),
       'objects=' + K.App.objects.length);

    clearScene();
    const sc2 = mkCurve('Rail', [[0, 0, 0], [0, 1, 0], [1, 2, 0]], { type: 'bezier', res: 6 });
    K.App.selectedObjectIds = new Set([sc2.id]);
    K.pushHistory();
    K.tubeSelection();
    K.stepOpSetup(2);
    K.setOpSetupAmount(0.3);
    K.finishOpSetup(true);
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

    /* 12 -- THE FOUR CROSS-SECTIONS (v2.18) --------------------------------
       One sweep, four profiles, and the sweep does not know which it was
       handed. What has to hold for each: the ring is as wide as the profile
       says, the solid is closed, and the wall is not inside-out - the outward
       vote reads the profile's own offsets now, not a circle's. */
    clearScene();
    const pc = mkCurve('P', [[0, 0, 0], [0, 1, 0], [0, 2, 0]], { type: 'poly', res: 4 });
    // Ring width at sides=8: round takes all eight, the two four-cornered
    // ones take four whatever the stepper says, half takes half the arc + 1.
    const want = { round: 8, square: 4, flat: 4, half: 5 };
    const vols = {};
    Object.keys(want).forEach(kind => {
      const r = K.tubeCurveOp(pc, 0.2, 8, true, kind);
      if (!r.ok) { ok('12.prof  ' + kind + ' builds at all', false, r.why); return; }
      const m = K.createObjectFromEditable('T' + kind, V(0, 0, 0), r.ed, r.mats, {});
      const w = K.auditWinding(m);
      vols[kind] = signedVolume(m);
      ok('12.prof  ' + kind + ' sweeps a ' + want[kind] + '-sided section',
         r.ed.groups.length === want[kind] * 2 + 2, 'groups=' + r.ed.groups.length);
      ok('12.prof  ' + kind + ' is closed, agrees with itself and is SOLID',
         w.boundary === 0 && w.conflictEdges === 0 && w.nonManifold === 0 &&
         w.shells === 1 && vols[kind] > 0,
         JSON.stringify(w) + ' vol=' + vols[kind].toFixed(4));
    });
    /* Flat has to be a STRIP, not a square by another name. Volume, because it
       is the one measure that does not care which way the frame's first
       radial happened to land - a bounding box of a rotated square does. */
    ok('12.prof  Flat is a strip, and Square is not',
       vols.flat > 0 && vols.square > 0 && vols.flat < vols.square * 0.4,
       'flat ' + (vols.flat || 0).toFixed(4) + ' vs square ' + (vols.square || 0).toFixed(4));
    ok('12.prof  Half is about half of Round',
       vols.half > vols.round * 0.35 && vols.half < vols.round * 0.75,
       'half ' + (vols.half || 0).toFixed(4) + ' vs round ' + (vols.round || 0).toFixed(4));
    mark('12.prof');

    /* 13 -- A RADIUS PER CONTROL POINT (v2.18) -----------------------------
       The radii live on the CURVE, as multipliers of the bar's one radius. */
    clearScene();
    const rc3 = mkCurve('R', [[0, 0, 0], [0, 1, 0], [0, 2, 0]], { type: 'poly', res: 4 });
    const cv3 = rc3.mesh.userData.kubikCurve;
    ok('13.radii a fresh curve is one multiplier per point, all ones',
       JSON.stringify(cv3.radii) === '[1,1,1]', JSON.stringify(cv3.radii));

    const t0 = K.tubeCurveOp(rc3, 0.1, 8, true, 'round');
    const m0 = K.createObjectFromEditable('T0', V(0, 0, 0), t0.ed, t0.mats, {});
    const b0 = new K.THREE.Box3().setFromObject(m0.mesh).getSize(new K.THREE.Vector3());
    cv3.radii[1] = 3;
    const t1 = K.tubeCurveOp(rc3, 0.1, 8, true, 'round');
    const m1 = K.createObjectFromEditable('T1', V(0, 0, 0), t1.ed, t1.mats, {});
    const b1 = new K.THREE.Box3().setFromObject(m1.mesh).getSize(new K.THREE.Vector3());
    const w1 = K.auditWinding(m1);
    /* ACROSS grows by exactly the multiplier, ALONG does not move at all. A
       radius that leaked into the sweep direction would pass a "it got
       bigger" test and be wrong. */
    ok('13.radii the middle point alone makes the middle fat',
       b1.x > b0.x * 2.9 && b1.x < b0.x * 3.1 && Math.abs(b1.y - b0.y) < 1e-6,
       'across ' + b0.x.toFixed(3) + '->' + b1.x.toFixed(3) +
       '  along ' + b0.y.toFixed(3) + '->' + b1.y.toFixed(3));
    ok('13.radii and a tube that changes width is still closed and solid',
       w1.boundary === 0 && w1.conflictEdges === 0 && w1.nonManifold === 0 &&
       signedVolume(m1) > 0, JSON.stringify(w1));

    // A BEZIER ramps between the two ends of each span rather than stepping.
    const bz = mkCurve('B', [[0, 0, 0], [0, 1, 0], [0, 2, 0]], { type: 'bezier', res: 6 });
    bz.mesh.userData.kubikCurve.radii = [1, 3, 1];
    const wts = [];
    K.curveSamplePoints(bz.mesh.userData.kubikCurve, wts);
    const rising = wts.slice(0, 6).every((v, i, a) => i === 0 || v >= a[i - 1] - 1e-9);
    ok('13.radii a Bezier ramps its radius along the span, and stays inside the ends',
       wts.length > 6 && rising && Math.min.apply(null, wts) >= 1 - 1e-9 &&
       Math.max.apply(null, wts) <= 3 + 1e-9,
       'n=' + wts.length + ' min=' + Math.min.apply(null, wts).toFixed(3) +
       ' max=' + Math.max.apply(null, wts).toFixed(3));

    // They belong to the curve, so they save, load and undo with it.
    clearScene();
    const sc3 = mkCurve('S', [[0, 0, 0], [0, 1, 0], [0, 2, 0]], { type: 'poly', res: 4 });
    sc3.mesh.userData.kubikCurve.radii = [1, 2.5, 0.5];
    const doc = K.serializeDoc();
    K.restoreDoc(doc, {});
    const back = K.App.objects.filter(K.isCurve)[0];
    ok('13.radii saved and loaded with the curve, not with the tube',
       !!back && JSON.stringify(back.mesh.userData.kubikCurve.radii) === '[1,2.5,0.5]',
       back && JSON.stringify(back.mesh.userData.kubikCurve.radii));

    // A file from before v2.18 has none, and points come and go.
    const old = mkCurve('Old', [[0, 0, 0], [0, 1, 0]], { type: 'poly', res: 4 });
    delete old.mesh.userData.kubikCurve.radii;
    K.rebuildCurveGeometry(old);
    ok('13.radii a curve with no radii at all reads as ones',
       JSON.stringify(old.mesh.userData.kubikCurve.radii) === '[1,1]',
       JSON.stringify(old.mesh.userData.kubikCurve.radii));
    old.mesh.userData.kubikCurve.pts.push([0, 2, 0]);
    old.mesh.userData.kubikCurve.radii[0] = 99;      // and out of range
    K.rebuildCurveGeometry(old);
    ok('13.radii a new point arrives at 1, and a wild one is clamped',
       old.mesh.userData.kubikCurve.radii.length === 3 &&
       old.mesh.userData.kubikCurve.radii[2] === 1 &&
       old.mesh.userData.kubikCurve.radii[0] === K.CURVE_R_MAX,
       JSON.stringify(old.mesh.userData.kubikCurve.radii));
    mark('13.radii');

    /* 14 -- THE HANDLE, driven the way a finger drives it (v2.18) ----------
       The control point IS the handle. Pull away from the side you grabbed
       and the tube gets fatter there; push back through the point and it
       gets thinner. Driven through the real pointer path - a probe that
       wrote cv.radii itself would pass while the handle was unreachable. */
    clearScene();
    const dc = mkCurve('D', [[0, 0, 0], [0, 1, 0], [0, 2, 0]], { type: 'poly', res: 4 });
    K.App.selectedObjectIds = new Set([dc.id]);
    K.tubeSelection();
    ok('14.handle the tube setup is open on the curve',
       !!K.opSetup && K.opSetup.kind === 'tube', K.opSetup && K.opSetup.kind);

    const rect = document.getElementById('viewport').getBoundingClientRect();
    const atPx = (v) => {
      const sp = K.worldToScreenPx(v);
      return sp ? { x: rect.left + sp.x, y: rect.top + sp.y } : null;
    };
    const mid = atPx(V(0, 1, 0));
    ok('14.handle the middle control point is on screen to be grabbed', !!mid);
    const evAt = (x, y) => ({ clientX: x, clientY: y, pointerId: 7, button: 0 });

    const found = mid ? K.pickCurvePointPx(evAt(mid.x + 6, mid.y)) : null;
    ok('14.handle a press near it finds THAT point, not another',
       !!found && found.i === 1, found && ('i=' + found.i));

    const h0 = dc.mesh.userData.kubikCurve.radii[1];
    const took = mid ? K.beginTubeRadiusDrag(evAt(mid.x + 6, mid.y)) : false;
    ok('14.handle and the press is claimed as a drag', !!took && !!K.tubeRadiusDrag);
    ok('14.handle taking hold of it changes nothing on its own',
       dc.mesh.userData.kubikCurve.radii[1] === h0);

    /* THE SURFACE FOLLOWS THE FINGER, which is a LINE through the grab point:
       twice the travel is twice the growth. Measured as a ratio so the probe
       needs to know neither the camera distance nor the viewport size - and
       so that a handle which simply slammed to its ceiling, which is what the
       first draft of this section was quietly passing on, fails it. */
    K.updateTubeRadiusDrag(evAt(mid.x + 26, mid.y));
    const near = dc.mesh.userData.kubikCurve.radii[1];
    K.updateTubeRadiusDrag(evAt(mid.x + 46, mid.y));
    const far2 = dc.mesh.userData.kubikCurve.radii[1];
    ok('14.handle pulling away from the point makes it fatter, in proportion',
       near > h0 * 1.05 && far2 < K.CURVE_R_MAX - 1e-9 &&
       Math.abs((far2 - h0) - 2 * (near - h0)) < 0.02 * (far2 - h0 + 1),
       h0 + ' -> ' + near.toFixed(4) + ' -> ' + far2.toFixed(4));
    ok('14.handle and only that point moved',
       dc.mesh.userData.kubikCurve.radii[0] === 1 &&
       dc.mesh.userData.kubikCurve.radii[2] === 1,
       JSON.stringify(dc.mesh.userData.kubikCurve.radii));

    // ...and back through it: thinner. A bare distance from the point could
    // not do this - it is positive on both sides, so this would grow again.
    K.updateTubeRadiusDrag(evAt(mid.x - 20, mid.y));
    const rIn = dc.mesh.userData.kubikCurve.radii[1];
    ok('14.handle pushing back through the point makes it thinner',
       rIn < h0, h0 + ' -> ' + rIn.toFixed(4));
    K.updateTubeRadiusDrag(evAt(mid.x - 4000, mid.y));
    ok('14.handle and it never goes past the floor',
       dc.mesh.userData.kubikCurve.radii[1] === K.CURVE_R_MIN,
       'min=' + K.CURVE_R_MIN + ' got ' + dc.mesh.userData.kubikCurve.radii[1]);
    K.endTubeRadiusDrag();

    /* THE OTHER SIDE OF THE SAME POINT, which is the whole reason the drag
       remembers a direction. Grab the left of it and pull LEFT: still fatter.
       An implementation that read screen-x alone would shrink here. */
    dc.mesh.userData.kubikCurve.radii[1] = 1;
    K.refreshOpSetupMesh();
    K.beginTubeRadiusDrag(evAt(mid.x - 6, mid.y));
    K.updateTubeRadiusDrag(evAt(mid.x - 46, mid.y));
    ok('14.handle whichever side you take hold of, away is fatter',
       dc.mesh.userData.kubikCurve.radii[1] > 1.05,
       'got ' + dc.mesh.userData.kubikCurve.radii[1].toFixed(4));
    K.endTubeRadiusDrag();
    dc.mesh.userData.kubikCurve.radii[1] = 1;
    K.refreshOpSetupMesh();

    const inHist = K.App.objects.length;
    K.endTubeRadiusDrag();
    ok('14.handle the drag ends without committing anything',
       !K.tubeRadiusDrag && K.App.objects.length === inHist);

    /* CANCEL PUTS THEM BACK. The radii are a curve edit made inside a preview,
       so the preview's own rule has to cover them: nothing survives a ✕. */
    K.finishOpSetup(false);
    ok('14.handle Cancel puts the radii back exactly as they were',
       JSON.stringify(dc.mesh.userData.kubikCurve.radii) === '[1,1,1]',
       JSON.stringify(dc.mesh.userData.kubikCurve.radii));

    // ...and OK keeps them, in the same one step as the mesh.
    K.App.selectedObjectIds = new Set([dc.id]);
    K.pushHistory();
    K.tubeSelection();
    const mid2 = atPx(V(0, 1, 0));
    K.beginTubeRadiusDrag(evAt(mid2.x + 6, mid2.y));
    K.updateTubeRadiusDrag(evAt(mid2.x + 90, mid2.y));
    K.endTubeRadiusDrag();
    const shaped = dc.mesh.userData.kubikCurve.radii[1];
    K.finishOpSetup(true);
    ok('14.handle OK keeps the shape you dialled into the curve',
       Math.abs(dc.mesh.userData.kubikCurve.radii[1] - shaped) < 1e-9 && shaped > 1.2,
       'radii=' + JSON.stringify(dc.mesh.userData.kubikCurve.radii));
    const objs2 = K.App.objects.length;
    K.undo();
    ok('14.handle and ONE undo takes back the tube and the radii together',
       objs2 === 2 && K.App.objects.length === 1 &&
       JSON.stringify(K.App.objects[0].mesh.userData.kubikCurve.radii) === '[1,1,1]',
       objs2 + ' -> ' + K.App.objects.length + ' ' +
       JSON.stringify(K.App.objects[0].mesh.userData.kubikCurve.radii));

    // A press nowhere near a point is not a handle grab - the camera keeps it.
    K.App.selectedObjectIds = new Set([K.App.objects[0].id]);
    K.tubeSelection();
    const far = atPx(V(3, 3, 3));
    ok('14.handle a press in open space is left for the camera',
       !far || !K.beginTubeRadiusDrag(evAt(far.x, far.y)));
    K.finishOpSetup(false);
    mark('14.handle');

    /* 15 -- WHAT THE REVIEW FOUND (v2.18) ---------------------------------
       Three defects, three inputs that provoke them. Each of these passed
       every check in sections 1-14 while it was broken. */

    /* (a) A DOUBLED CONTROL POINT IS ONE PLACE AND ONE RADIUS. A Bezier is
       given a corner by putting two control points on the same spot; the span
       between them is skipped, so the ring AT the corner is emitted by the
       next span. It used to carry the SECOND copy's radius while everything
       ramping into it aimed at the first copy's - and the handle you can grab
       is the first, so dragging it stepped the tube at the corner instead of
       shaping it. On a doubled ENDPOINT it did nothing visible at all. */
    clearScene();
    const cor = mkCurve('Cor', [[0, 0, 0], [1, 0, 0], [1, 0, 0], [1, 0, 1]],
                        { type: 'bezier', res: 4 });
    const ccv = cor.mesh.userData.kubikCurve;
    ccv.radii = [1, 4, 1, 1];          // the first copy - the one you can grab
    const cw = [];
    K.curveSamplePoints(ccv, cw);
    /* The corner sample is the one at the doubled position. Both the ramp
       into it and the ring on it have to read 4, or the tube steps there. */
    const cpts = K.curveSamplePoints(ccv);
    let ci = -1;
    for (let i = 0; i < cpts.length; i++) {
      if (Math.abs(cpts[i].x - 1) < 1e-9 && Math.abs(cpts[i].z) < 1e-9) { ci = i; break; }
    }
    ok('15.corner the corner sample carries the radius its handle sets',
       ci >= 0 && Math.abs(cw[ci] - 4) < 1e-9,
       'i=' + ci + ' w=' + (ci >= 0 ? cw[ci] : 'none'));
    ok('15.corner and the ramp reaches it without stepping',
       ci > 0 && cw[ci - 1] > 1 && cw[ci - 1] <= 4 + 1e-9,
       'before=' + (ci > 0 ? cw[ci - 1].toFixed(3) : 'none'));

    // A doubled ENDPOINT, where the drag used to do nothing at all.
    const end = mkCurve('End', [[0, 0, 0], [1, 0, 0], [1, 0, 0]],
                        { type: 'bezier', res: 4 });
    end.mesh.userData.kubikCurve.radii = [1, 5, 1];
    const ew = [];
    K.curveSamplePoints(end.mesh.userData.kubikCurve, ew);
    ok('15.corner a doubled endpoint takes the radius of the point you see',
       Math.abs(ew[ew.length - 1] - 5) < 1e-9, 'last=' + ew[ew.length - 1]);

    /* (b) THE TIGHT BEND THAT FLIPPED THE WHOLE WALL. Half's offsets all sit
       on one side of the spine, so a bend tight enough to tuck the inside of
       the first band behind its own neighbour outvoted every good band in the
       tube, and the entire surface came back inside out. Signed volume is the
       only measure that catches it: the mesh stays watertight, stays
       manifold, and every edge still agrees with its neighbour. */
    clearScene();
    const bend = mkCurve('Bend', [[0, 0, 0], [0, 0, 0.1], [-1, 0, 0.1]],
                         { type: 'poly', res: 4 });
    let worstProf = '', worstV = Infinity;
    ['round', 'square', 'flat', 'half'].forEach(kind => {
      // Fat enough that the inside of the corner folds behind the first ring.
      [0.06, 0.36, 0.5].forEach(rr => {
        const r = K.tubeCurveOp(bend, rr, 8, true, kind);
        if (!r.ok) return;
        const m = K.createObjectFromEditable('B', V(0, 0, 0), r.ed, r.mats, {});
        const v = signedVolume(m);
        if (v < worstV) { worstV = v; worstProf = kind + ' at r=' + rr; }
      });
    });
    ok('15.bend   a hairpin stays SOLID at every radius, in every profile',
       worstV > 0, 'worst was ' + worstProf + ' at ' + worstV.toFixed(5));

    /* (c) A CLOSED CURVE WHOSE LAST POINT SITS ON ITS FIRST. `closed` was
       decided on the control-point count, before the repeated samples came
       out - so this arrived at the sweep with two distinct points and a loop
       flag, and laid two coincident, opposite-wound bands along one leg. */
    clearScene();
    const lap = mkCurve('Lap', [[0, 0, 0], [0, 1, 0], [0, 0, 0]],
                        { type: 'poly', res: 4, closed: true });
    const rl = K.tubeCurveOp(lap, 0.1, 8, true, 'round');
    const lm = rl.ok ? K.createObjectFromEditable('L', V(0, 0, 0), rl.ed, rl.mats, {}) : null;
    const lw = lm ? K.auditWinding(lm) : null;
    ok('15.lap    a closed curve that comes back to its start is one tube, not two',
       !!lw && lw.boundary === 0 && lw.conflictEdges === 0 &&
       lw.nonManifold === 0 && lw.shells === 1 && signedVolume(lm) > 0,
       lw ? JSON.stringify(lw) + ' vol=' + signedVolume(lm).toFixed(5) : 'refused');
    mark('15.review');

    finish();
  }

  setTimeout(() => {
    run().catch(e => { say('THREW ' + (e && e.stack ? e.stack : e)); fails++; finish(); });
  }, 3000);
})();
