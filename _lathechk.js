/* v2.15 Lathe, and the Revolve regression that _spinchk turned out not to
   carry: _spinchk tests Spin EDGE, so lifting revolveSweep out of revolveOp
   was unguarded until this file existed. Section 1 is that guard. */
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
    K.App.pivotMode = 'auto';
  }

  function mkPrim(name, kind, x) {
    const ed = K.buildPrimitiveEditable(kind, {});
    const mats = K.makeMaterialSet(ed.groups.length || 1, 0x9aa3b2);
    return K.createObjectFromEditable(name, V(x || 0, 0, 0), ed, mats, {});
  }

  function mkCurve(name, pts, opts) {
    return K.createCurveObject(name, V(0, 0, 0), pts.map(a => V(a[0], a[1], a[2])), opts || {});
  }

  /* Does a face point AWAY from the axis it was turned about? Newell over the
     face's own boundary loop, against the radial at its centroid. This is the
     question revolveOp's winding block has been answering unmeasured since
     v2.11. */
  function facesOutward(obj, gi, axis) {
    const ed = K.toEditable(obj.mesh);
    const L = K.edLogical(ed);
    const loop = K.getGroupBoundaryLoopAttr(ed, gi);
    if (loop.length < 3) return null;
    const pts = loop.map(a => V(ed.positions[a * 3], ed.positions[a * 3 + 1], ed.positions[a * 3 + 2]));
    const n = V(0, 0, 0), c = V(0, 0, 0);
    for (let i = 0; i < pts.length; i++) {
      const a = pts[i], b = pts[(i + 1) % pts.length];
      n.x += (a.y - b.y) * (a.z + b.z);
      n.y += (a.z - b.z) * (a.x + b.x);
      n.z += (a.x - b.x) * (a.y + b.y);
      c.add(a);
    }
    c.multiplyScalar(1 / pts.length);
    // The object's own transform is baked out: positions are local, and the
    // lathe result sits at the box centre, so bring both into world.
    obj.mesh.updateMatrixWorld();
    const ax = V(axis === 'x' ? 1 : 0, axis === 'y' ? 1 : 0, axis === 'z' ? 1 : 0);
    const cw = c.clone().applyMatrix4(obj.mesh.matrixWorld);
    const radial = cw.clone().sub(ax.clone().multiplyScalar(cw.dot(ax)));
    const nw = n.clone().transformDirection(obj.mesh.matrixWorld);
    if (radial.lengthSq() < 1e-9) return null;
    void L;
    return nw.dot(radial);
  }

  async function run() {
    K = window.__kubik;
    if (!K) { finish('__kubik is undefined - the app never started'); return; }
    ok('0.boot  app up, lathe exported',
       !!K.App && typeof K.latheCurveOp === 'function' && typeof K.revolveSweep === 'function');
    if (typeof K.latheCurveOp !== 'function') { finish(); return; }
    mark('0.boot');

    /* 1 -- REVOLVE IS UNCHANGED BY THE REFACTOR ------------------------------
       The numbers are the ones CURRENT_STATE quotes from v2.11: a one-edge
       profile in 8 steps is 8 faces and 14 new vertices - not 16, because a
       full turn's seam welds onto the profile itself - and an arc is 16,
       because nothing welds. If lifting the sweep out changed anything, it
       changed one of these.

       THE PLANE SITS AT x = 2 ON PURPOSE. At the origin its four corners lie
       on one circle 45 degrees apart, so eight steps of 45 rotate them onto
       each other AND onto their own ring copies: the honest answer there is 4
       new vertices, not 14, and the first draft of this check read that as a
       regression when it was the geometry. Off-axis the two profile points
       sit at different radii and nothing coincides. */
    clearScene();
    let plane = mkPrim('Plane', 'plane', 2);
    K.ensureHelpers(plane);
    let topo = plane.mesh.userData.topo;
    const before1 = topo.logicalCount;
    // An edge clear of the Y axis, so there is something to sweep.
    let pick = -1;
    for (let e = 0; e < topo.edges.length; e++) {
      const p0 = K.logicalPos(plane, topo.edges[e][0]);
      const p1 = K.logicalPos(plane, topo.edges[e][1]);
      if (Math.hypot(p0.x, p0.z) > 0.2 && Math.hypot(p1.x, p1.z) > 0.2) { pick = e; break; }
    }
    ok('1.revolve found an edge off the axis to turn', pick >= 0, 'edge=' + pick);
    let r1 = pick >= 0
      ? K.revolveOp(plane, [[topo.edges[pick][0], topo.edges[pick][1]]], 8, 360, 'y', 1)
      : { ok: false, why: 'no edge' };
    K.ensureHelpers(plane);
    const after1 = plane.mesh.userData.topo ? plane.mesh.userData.topo.logicalCount : -1;
    ok('1.revolve a full turn of one edge in 8 steps is 8 faces',
       r1.ok === true && r1.count === 8, JSON.stringify(r1.ok ? { count: r1.count } : r1));
    ok('1.revolve and 14 new vertices, because the seam welds',
       after1 - before1 === 14, before1 + ' -> ' + after1);

    clearScene();
    plane = mkPrim('Plane', 'plane', 2);
    K.ensureHelpers(plane);
    topo = plane.mesh.userData.topo;
    const before2 = topo.logicalCount;
    pick = -1;
    for (let e = 0; e < topo.edges.length; e++) {
      const p0 = K.logicalPos(plane, topo.edges[e][0]);
      const p1 = K.logicalPos(plane, topo.edges[e][1]);
      if (Math.hypot(p0.x, p0.z) > 0.2 && Math.hypot(p1.x, p1.z) > 0.2) { pick = e; break; }
    }
    const r2 = pick >= 0
      ? K.revolveOp(plane, [[topo.edges[pick][0], topo.edges[pick][1]]], 8, 180, 'y', 1)
      : { ok: false };
    K.ensureHelpers(plane);
    const after2 = plane.mesh.userData.topo ? plane.mesh.userData.topo.logicalCount : -1;
    ok('1.revolve an arc of 180 in 8 steps is 16 new vertices, because nothing welds',
       r2.ok === true && after2 - before2 === 16, before2 + ' -> ' + after2);
    mark('1.revolve');

    // 2 -- a curve, turned ------------------------------------------------
    clearScene();
    const prof = mkCurve('Profile', [[0.6, -0.5, 0], [0.6, 0.5, 0]], { type: 'poly', res: 8 });
    K.App.selectedObjectIds = new Set([prof.id]);
    K.runLathe(prof, 'y');
    let made = K.App.objects.filter(o => !K.isCurve(o))[0];
    let w = made ? K.auditWinding(made) : null;
    ok('2.turn   it made a mesh', !!made && made.name.indexOf('lathe') >= 0,
       made && made.name);
    ok('2.turn   8 faces, one per segment',
       !!made && made.mesh.geometry.groups.length === 8,
       made && ('groups=' + made.mesh.geometry.groups.length));
    ok('2.turn   wound consistently, nothing non-manifold',
       !!w && w.conflictEdges === 0 && w.nonManifold === 0 && w.reversed === 0,
       w && JSON.stringify(w));
    ok('2.turn   one shell', !!w && w.shells === 1, w && ('shells=' + w.shells));
    ok('2.turn   open exactly at its two rims and nowhere else',
       !!w && w.boundary === 16, w && ('boundary=' + w.boundary));
    ok('2.turn   the curve is still there to turn again',
       K.App.objects.filter(K.isCurve).length === 1);
    ok('2.turn   and the RESULT is what is selected',
       K.App.selectedObjectIds.size === 1 && K.App.selectedObjectIds.has(made.id));
    mark('2.turn');

    /* 3 -- THE WINDING BLOCK, MEASURED AT LAST ----------------------------
       v2.11 left this open in writing: the rim rule carries no information
       when the profile's edge has two faces, so a geometric answer was put in
       - the first quad's normal against the outward radial - and marked
       "reasoned, not measured", because it passed with itself disabled on
       every profile that could be built. The note asks for "a profile whose
       chain walk runs the other way". A curve IS that profile: it has no rim
       at all, so the geometric answer is the only thing deciding, and the
       point order is ours to reverse. */
    clearScene();
    const up = mkCurve('Up', [[0.6, -0.5, 0], [0.6, 0.5, 0]], { type: 'poly', res: 8 });
    K.runLathe(up, 'y');
    const mUp = K.App.objects.filter(o => !K.isCurve(o))[0];
    const dUp = mUp ? facesOutward(mUp, 0, 'y') : null;
    ok('3.facing a curve drawn UP sweeps outward', dUp !== null && dUp > 0,
       'normalВ·radial = ' + (dUp === null ? 'n/a' : dUp.toFixed(4)));

    clearScene();
    const dn = mkCurve('Down', [[0.6, 0.5, 0], [0.6, -0.5, 0]], { type: 'poly', res: 8 });
    K.runLathe(dn, 'y');
    const mDn = K.App.objects.filter(o => !K.isCurve(o))[0];
    const dDn = mDn ? facesOutward(mDn, 0, 'y') : null;
    ok('3.facing and drawn DOWN it still sweeps outward', dDn !== null && dDn > 0,
       'normalВ·radial = ' + (dDn === null ? 'n/a' : dDn.toFixed(4)));
    say('   ^ this is the case the v2.11 note could not construct: with no rim,'
        + ' the geometric answer is the ONLY thing deciding.');
    mark('3.facing');

    // 4 -- a closed profile makes a closed solid ---------------------------
    clearScene();
    const ring = mkCurve('Ring',
      [[0.8, -0.2, 0], [1.2, -0.2, 0], [1.2, 0.2, 0], [0.8, 0.2, 0]],
      { type: 'poly', res: 8, closed: true });
    K.runLathe(ring, 'y');
    const torus = K.App.objects.filter(o => !K.isCurve(o))[0];
    const tw = torus ? K.auditWinding(torus) : null;
    ok('4.closed a closed profile turns into a closed solid',
       !!tw && tw.boundary === 0, tw && ('boundary=' + tw.boundary));
    ok('4.closed wound consistently',
       !!tw && tw.conflictEdges === 0 && tw.nonManifold === 0 && tw.reversed === 0,
       tw && JSON.stringify(tw));
    ok('4.closed 4 sides x 8 segments',
       !!torus && torus.mesh.geometry.groups.length === 32,
       torus && ('groups=' + torus.mesh.geometry.groups.length));
    mark('4.closed');

    // 5 -- the pole ---------------------------------------------------------
    // A profile point ON the axis is shared by every ring, which is what turns
    // the quads round it into the triangles a cone actually has.
    clearScene();
    const cone = mkCurve('Cone', [[0, 1, 0], [0.7, -0.3, 0]], { type: 'poly', res: 8 });
    K.runLathe(cone, 'y');
    const cm = K.App.objects.filter(o => !K.isCurve(o))[0];
    const cw = cm ? K.auditWinding(cm) : null;
    ok('5.pole   a point on the axis makes a cone, not a collapse',
       !!cm && cm.mesh.geometry.groups.length === 8 && !!cw && cw.conflictEdges === 0,
       cm && ('groups=' + cm.mesh.geometry.groups.length + ' ' + JSON.stringify(cw)));
    if (cm) {
      const ced = K.toEditable(cm.mesh);
      const triCounts = ced.groups.map(g => g.triangles.length);
      ok('5.pole   and every face round the pole is ONE triangle',
         triCounts.every(n => n === 1), JSON.stringify(triCounts));
    }

    clearScene();
    const onAxis = mkCurve('OnAxis', [[0, -1, 0], [0, 1, 0]], { type: 'poly', res: 8 });
    const rAx = K.latheCurveOp(onAxis, 'y', 360, 8, 1);
    ok('5.pole   a profile entirely on the axis is refused, out loud',
       rAx.ok === false && /axis/.test(rAx.why || ''), JSON.stringify(rAx));
    mark('5.pole');

    // 6 -- the other refusals ----------------------------------------------
    clearScene();
    const coarse = mkCurve('Coarse', [[0.6, -0.5, 0], [0.6, 0.5, 0]], { type: 'poly', res: 2 });
    const rC = K.latheCurveOp(coarse, 'y', 360, 2, 1);
    ok('6.refuse a full turn in 2 segments is refused, and says what to raise',
       rC.ok === false && /Segments/.test(rC.why || ''), JSON.stringify(rC));

    clearScene();
    const lone = mkCurve('Lone', [[0.5, 0, 0]], { type: 'poly', res: 8 });
    const rL = K.latheCurveOp(lone, 'y', 360, 8, 1);
    ok('6.refuse a one-point curve is refused', rL.ok === false, JSON.stringify(rL));
    mark('6.refuse');

    // 7 -- undo takes the lathe back ---------------------------------------
    clearScene();
    const uc = mkCurve('U', [[0.6, -0.5, 0], [0.6, 0.5, 0]], { type: 'poly', res: 8 });
    K.pushHistory();
    K.runLathe(uc, 'y');
    const n1 = K.App.objects.length;
    K.undo();
    ok('7.undo   the mesh goes and the curve stays',
       n1 === 2 && K.App.objects.length === 1 && K.isCurve(K.App.objects[0]),
       n1 + ' -> ' + K.App.objects.length);
    mark('7.undo');

    // 8 -- Lathe is reachable, and only from a curve -------------------------
    clearScene();
    const rc = mkCurve('C', [[0.6, 0, 0], [0.6, 1, 0]], {});
    const cube = mkPrim('Cube', 'cube', 4);
    K.App.selectedObjectIds = new Set([rc.id]);
    let ring2 = K.currentHubTools();
    ok('8.ring   the curve ring holds Lathe at seat 6',
       ring2.some(t => t.key === 'lathe' && t.seat === 6),
       ring2.map(t => t.key + '@' + t.seat).join(','));
    K.App.selectedObjectIds = new Set([cube.id]);
    ring2 = K.currentHubTools();
    ok('8.ring   and a mesh selection has no Lathe on it',
       !ring2.some(t => t.key === 'lathe'));
    mark('8.ring');

    finish();
  }

  setTimeout(() => {
    run().catch(e => { say('THREW ' + (e && e.stack ? e.stack : e)); fails++; finish(); });
  }, 3000);
})();
