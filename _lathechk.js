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
  /* Lathe is a SETUP now, not a one-tap chooser (v2.17): it makes a preview
     you dial in and confirm. Driven here the way a finger drives it - open,
     set, refresh, OK - so the probe exercises the real path rather than a
     shortcut past the bar. */
  function lathe(c, axis, sweep, segs) {
    K.App.selectedObjectIds = new Set([c.id]);
    K.startOpSetup('lathe', { curveId: c.id });
    if (!K.opSetup) return null;
    if (axis) K.opSetup.p.axis = axis;
    if (sweep !== undefined) K.opSetup.p.sweep = sweep;
    if (segs !== undefined) K.opSetup.p.segs = segs;
    K.refreshOpSetupMesh();
    K.finishOpSetup(true);
    return K.App.objects.filter(o => !K.isCurve(o))[0];
  }

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
    lathe(prof, 'y');
    let made = K.App.objects.filter(o => !K.isCurve(o))[0];
    let w = made ? K.auditWinding(made) : null;
    ok('2.turn   it made a mesh', !!made && made.name.indexOf('lathe') >= 0,
       made && made.name);
    ok('2.turn   8 faces, one per segment',
       !!made && K.faceCount(made.mesh.geometry) === 8,
       made && ('groups=' + K.faceCount(made.mesh.geometry)));
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
    lathe(up, 'y');
    const mUp = K.App.objects.filter(o => !K.isCurve(o))[0];
    const dUp = mUp ? facesOutward(mUp, 0, 'y') : null;
    ok('3.facing a curve drawn UP sweeps outward', dUp !== null && dUp > 0,
       'normalВ·radial = ' + (dUp === null ? 'n/a' : dUp.toFixed(4)));

    clearScene();
    const dn = mkCurve('Down', [[0.6, 0.5, 0], [0.6, -0.5, 0]], { type: 'poly', res: 8 });
    lathe(dn, 'y');
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
    lathe(ring, 'y');
    const torus = K.App.objects.filter(o => !K.isCurve(o))[0];
    const tw = torus ? K.auditWinding(torus) : null;
    ok('4.closed a closed profile turns into a closed solid',
       !!tw && tw.boundary === 0, tw && ('boundary=' + tw.boundary));
    ok('4.closed wound consistently',
       !!tw && tw.conflictEdges === 0 && tw.nonManifold === 0 && tw.reversed === 0,
       tw && JSON.stringify(tw));
    ok('4.closed 4 sides x 8 segments',
       !!torus && K.faceCount(torus.mesh.geometry) === 32,
       torus && ('groups=' + K.faceCount(torus.mesh.geometry)));
    mark('4.closed');

    // 5 -- the pole ---------------------------------------------------------
    // A profile point ON the axis is shared by every ring, which is what turns
    // the quads round it into the triangles a cone actually has.
    clearScene();
    const cone = mkCurve('Cone', [[0, 1, 0], [0.7, -0.3, 0]], { type: 'poly', res: 8 });
    lathe(cone, 'y');
    const cm = K.App.objects.filter(o => !K.isCurve(o))[0];
    const cw = cm ? K.auditWinding(cm) : null;
    ok('5.pole   a point on the axis makes a cone, not a collapse',
       !!cm && K.faceCount(cm.mesh.geometry) === 8 && !!cw && cw.conflictEdges === 0,
       cm && ('groups=' + K.faceCount(cm.mesh.geometry) + ' ' + JSON.stringify(cw)));
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
    /* NOT A REFUSAL ANY MORE, A CLAMP (v2.17). The op still refuses two
       segments on a full turn - that is arithmetic - but the bar no longer
       lets you ask for it: the stepper's floor is 3 while the angle is 360
       and 1 once it is an arc, so the control stops instead of arguing. */
    clearScene();
    const coarse = mkCurve('Coarse', [[0.6, -0.5, 0], [0.6, 0.5, 0]], { type: 'poly', res: 2 });
    const rC = K.latheCurveOp(coarse, 'y', 360, 2, 1);
    ok('6.refuse the op itself still refuses 2 segments on a full turn',
       rC.ok === false && /segments/i.test(rC.why || ''), JSON.stringify(rC));
    K.App.selectedObjectIds = new Set([coarse.id]);
    K.startOpSetup('lathe', { curveId: coarse.id });
    const floor360 = K.opSetup ? K.opSetup.p.segs : -1;
    if (K.opSetup) { K.stepOpSetup(-5); }
    const clamped = K.opSetup ? K.opSetup.p.segs : -1;
    ok('6.refuse and the bar cannot ask for it - the stepper stops at 3',
       floor360 === 3 && clamped === 3, floor360 + ' then ' + clamped);
    if (K.opSetup) {
      K.setOpSetupAmount(180);
      K.stepOpSetup(-5);
      ok('6.refuse but an ARC may go down to one', K.opSetup.p.segs === 1,
         'segs=' + K.opSetup.p.segs);
      K.finishOpSetup(false);
    } else {
      ok('6.refuse but an ARC may go down to one', false, 'no setup');
    }

    clearScene();
    const lone = mkCurve('Lone', [[0.5, 0, 0]], { type: 'poly', res: 8 });
    const rL = K.latheCurveOp(lone, 'y', 360, 8, 1);
    ok('6.refuse a one-point curve is refused', rL.ok === false, JSON.stringify(rL));
    mark('6.refuse');

    // 7 -- undo takes the lathe back ---------------------------------------
    clearScene();
    const uc = mkCurve('U', [[0.6, -0.5, 0], [0.6, 0.5, 0]], { type: 'poly', res: 8 });
    K.pushHistory();
    lathe(uc, 'y');
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

    /* 9 -- ORIENTATION, THE WAY THE REVIEW FOUND IT WRONG -------------------
       Sections 2 and 3 turn a single straight profile parallel to the axis,
       which is the ONE shape whose first leg gives a clean answer - so they
       passed while every cup and every closed profile came out inside out.
       An inverted shell is watertight, consistently wound and invisible to
       auditWinding by design, so the test has to measure orientation itself.

       Signed volume does it for anything closed: sum a.(b x c)/6 over every
       triangle. Calibrated against a cube first, because the sign convention
       is the app's, not arithmetic's. */
    function signedVolume(obj) {
      const ed = K.toEditable(obj.mesh);
      let v = 0;
      const g = (i) => V(ed.positions[i * 3], ed.positions[i * 3 + 1], ed.positions[i * 3 + 2]);
      ed.groups.forEach(grp => grp.triangles.forEach(t => {
        v += g(t[0]).dot(new K.THREE.Vector3().crossVectors(g(t[1]), g(t[2]))) / 6;
      }));
      return v;
    }
    // And the flux measure, for a shell that is open and so has no volume.
    function outwardFlux(obj, axis) {
      const ed = K.toEditable(obj.mesh);
      const ax = V(axis === 'x' ? 1 : 0, axis === 'y' ? 1 : 0, axis === 'z' ? 1 : 0);
      obj.mesh.updateMatrixWorld();
      let f = 0;
      for (let gi = 0; gi < ed.groups.length; gi++) {
        const loop = K.getGroupBoundaryLoopAttr(ed, gi);
        if (loop.length < 3) continue;
        const p = loop.map(a => V(ed.positions[a * 3], ed.positions[a * 3 + 1], ed.positions[a * 3 + 2])
          .applyMatrix4(obj.mesh.matrixWorld));
        const nrm = V(0, 0, 0), cen = V(0, 0, 0);
        for (let i = 0; i < p.length; i++) {
          const a = p[i], b = p[(i + 1) % p.length];
          nrm.x += (a.y - b.y) * (a.z + b.z);
          nrm.y += (a.z - b.z) * (a.x + b.x);
          nrm.z += (a.x - b.x) * (a.y + b.y);
          cen.add(a);
        }
        cen.multiplyScalar(1 / p.length);
        cen.addScaledVector(ax, -cen.dot(ax));
        f += nrm.dot(cen);
      }
      return f;
    }

    clearScene();
    const calib = mkPrim('Cube', 'cube', 0);
    const vCube = signedVolume(calib);
    ok('9.orient a cube reads POSITIVE, so positive is outward here',
       vCube > 0, 'volume = ' + vCube.toFixed(4));

    /* THE CLOSED RECTANGLE, from every corner and both ways round. The review
       traced four of these eight as inverted, and which one you got depended
       on which corner you happened to draw first. */
    const rect = [[0.8, -0.2, 0], [1.2, -0.2, 0], [1.2, 0.2, 0], [0.8, 0.2, 0]];
    let worstV = Infinity, worstName = '';
    for (let start = 0; start < 4; start++) {
      for (let dir = 0; dir < 2; dir++) {
        const pts = [];
        for (let i = 0; i < 4; i++) pts.push(rect[(start + i) % 4]);
        if (dir) pts.reverse();
        clearScene();
        const c = mkCurve('R', pts, { type: 'poly', res: 8, closed: true });
        lathe(c, 'y');
        const m = K.App.objects.filter(o => !K.isCurve(o))[0];
        const v = m ? signedVolume(m) : 0;
        if (v < worstV) { worstV = v; worstName = 'start ' + start + (dir ? ' reversed' : ''); }
      }
    }
    ok('9.orient a closed profile comes out SOLID from every corner, both ways',
       worstV > 0, 'worst was ' + worstName + ' at ' + worstV.toFixed(4));

    // The cup: drawn from the axis outward and then up, so the FIRST leg is
    // the bottom - the leg whose radial dot is zero, which is what used to
    // decide the whole shell.
    clearScene();
    const cup = mkCurve('Cup', [[0, 0, 0], [1, 0, 0], [1, 1, 0]], { type: 'poly', res: 8 });
    lathe(cup, 'y');
    const cupM = K.App.objects.filter(o => !K.isCurve(o))[0];
    const cupF = cupM ? outwardFlux(cupM, 'y') : 0;
    ok('9.orient a cup drawn from the axis faces outward, not in',
       cupF > 0, 'flux = ' + cupF.toFixed(4));

    clearScene();
    const cupB = mkCurve('CupB', [[0, 0, 0], [1, 0, 0], [1, 1, 0]], { type: 'bezier', res: 8 });
    lathe(cupB, 'y');
    const cupBM = K.App.objects.filter(o => !K.isCurve(o))[0];
    const cupBF = cupBM ? outwardFlux(cupBM, 'y') : 0;
    ok('9.orient and so does the Bezier version, whose first leg dips',
       cupBF > 0, 'flux = ' + cupBF.toFixed(4));
    mark('9.orient');

    // 10 -- degenerate profiles the review named ---------------------------
    clearScene();
    const two = mkCurve('Two', [[0.6, 0, 0], [0.6, 1, 0]], { type: 'poly', res: 8, closed: true });
    lathe(two, 'y');
    const twoM = K.App.objects.filter(o => !K.isCurve(o))[0];
    const twoW = twoM ? K.auditWinding(twoM) : null;
    ok('10.degen a CLOSED two-point curve is swept as the open profile it is',
       !!twoW && twoW.conflictEdges === 0 && K.faceCount(twoM.mesh.geometry) === 8,
       twoW && (JSON.stringify(twoW) + ' groups=' + K.faceCount(twoM.mesh.geometry)));

    clearScene();
    const rep = mkCurve('Rep', [[0.6, 0, 0], [0.6, 0, 0], [0.6, 1, 0]], { type: 'poly', res: 8 });
    lathe(rep, 'y');
    const repM = K.App.objects.filter(o => !K.isCurve(o))[0];
    ok('10.degen a repeated point is dropped, not swept into zero-area faces',
       !!repM && K.faceCount(repM.mesh.geometry) === 8,
       repM && ('groups=' + K.faceCount(repM.mesh.geometry)));
    mark('10.degen');

    /* 11 -- THE PREVIEW, THE DEGREES AND THE STEPPER (v2.17) ---------------
       Lathe stopped committing on the tap. What it does now is make the mesh
       at once and hand you handles on it, so the things to check are that the
       handles reach the shape and that nothing reaches history until OK. */
    clearScene();
    const pv = mkCurve('P', [[0.6, -0.5, 0], [0.6, 0.5, 0]], { type: 'poly', res: 8 });
    K.App.selectedObjectIds = new Set([pv.id]);
    K.pushHistory();
    const steps0 = K.App.objects.length;
    K.startOpSetup('lathe', { curveId: pv.id });
    ok('11.preview the mesh is there the moment you tap it',
       !!K.opSetup && K.App.objects.length === 2, 'objects=' + K.App.objects.length);
    ok('11.preview and it opened on a full turn at the curve’s own segments',
       !!K.opSetup && K.opSetup.p.sweep === 360 && K.opSetup.p.segs === 8,
       K.opSetup && (K.opSetup.p.sweep + '° x ' + K.opSetup.p.segs));

    let pm = K.findObject(K.opSetup.objId);
    const full = K.auditWinding(pm);
    ok('11.preview a full turn closes round: two rims and nothing else',
       full.boundary === 16, 'boundary=' + full.boundary);

    /* DEGREES. A half turn is the same tool - and the difference is visible
       in the topology, not just the picture: an arc has the two ends of the
       profile standing open as well as its two rims. */
    K.setOpSetupAmount(180);
    pm = K.findObject(K.opSetup.objId);
    const half = K.auditWinding(pm);
    ok('11.preview 180 degrees leaves the profile ends open too',
       half.boundary === 18 && half.conflictEdges === 0,
       'boundary=' + half.boundary + ' ' + JSON.stringify(half));
    /* Measured on Z, not X. A half turn about Y starting at +x still reaches
       -x, so the X span is the full 1.2 either way; it is the OTHER axis that
       only gets one side of the circle. The first draft asserted X and failed,
       correctly, on a lathe that was right. */
    const halfSz = new K.THREE.Box3().setFromObject(pm.mesh).getSize(new K.THREE.Vector3());
    ok('11.preview and it only reaches half way round',
       halfSz.z < 0.7 && halfSz.x > 1.1,
       'x ' + halfSz.x.toFixed(3) + ' z ' + halfSz.z.toFixed(3));

    // THE STEPPER is what makes it rounder, which is a face count.
    K.setOpSetupAmount(360);
    K.stepOpSetup(4);
    pm = K.findObject(K.opSetup.objId);
    ok('11.preview the stepper makes it rounder',
       K.opSetup.p.segs === 12 && K.faceCount(pm.mesh.geometry) === 12,
       K.opSetup.p.segs + ' segments, ' + K.faceCount(pm.mesh.geometry) + ' faces');

    // The axis chips still work, and are remembered for the next one.
    K.opSetup.p.axis = 'x';
    K.refreshOpSetupMesh();
    pm = K.findObject(K.opSetup.objId);
    const xBox = new K.THREE.Box3().setFromObject(pm.mesh);
    ok('11.preview turning about X sweeps the other way round',
       xBox.getSize(new K.THREE.Vector3()).x < 0.2,
       'x span = ' + xBox.getSize(new K.THREE.Vector3()).x.toFixed(3));

    ok('11.preview and NOTHING has reached history yet',
       K.App.objects.length === 2, 'objects=' + K.App.objects.length);
    K.finishOpSetup(false);
    ok('11.preview Cancel takes the mesh away and gives the curve back',
       K.App.objects.length === steps0 && K.isCurve(K.App.objects[0]) &&
       K.App.selectedObjectIds.has(pv.id),
       'objects=' + K.App.objects.length);
    mark('11.preview');

    // 12 -- and OK is exactly one step, whatever you tried on the way -------
    clearScene();
    const ov = mkCurve('O', [[0.6, -0.5, 0], [0.6, 0.5, 0]], { type: 'poly', res: 8 });
    K.App.selectedObjectIds = new Set([ov.id]);
    K.pushHistory();
    K.startOpSetup('lathe', { curveId: ov.id });
    K.setOpSetupAmount(90);
    K.stepOpSetup(3);
    K.setOpSetupAmount(270);
    K.stepOpSetup(-2);
    K.finishOpSetup(true);
    const kept = K.App.objects.length;
    K.undo();
    ok('12.commit OK keeps it, and every setting tried on the way is ONE step',
       kept === 2 && K.App.objects.length === 1 && K.isCurve(K.App.objects[0]),
       kept + ' -> ' + K.App.objects.length);
    mark('12.commit');

    finish();
  }

  setTimeout(() => {
    run().catch(e => { say('THREW ' + (e && e.stack ? e.stack : e)); fails++; finish(); });
  }, 3000);
})();
