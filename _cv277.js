// v2.77 probe: Bezier handles inside the Tube bar, on the selected point only.
(function () {
  const OUT = [];
  let fails = 0, finished = false;
  const say = s => OUT.push(s);
  const ok = (name, cond, detail) => { if (!cond) fails++; say((cond ? 'PASS ' : 'FAIL ') + name + (detail === undefined ? '' : '  ' + detail)); };
  const post = (p, b) => { try { const x = new XMLHttpRequest(); x.open('POST', p, true); x.send(b); } catch (e) {} };
  function finish(extra) {
    if (finished) return; finished = true;
    if (extra) { say(extra); fails++; }
    say('VERDICT=' + (fails ? 'FAIL' : 'PASS') + ' (' + fails + ' failed)');
    post('/done', OUT.join('\n'));
  }
  const wait = ms => new Promise(r => setTimeout(r, ms));
  let K = null, A = null;
  const $ = id => document.getElementById(id);
  const E = (x, y) => { const r = $('viewport').getBoundingClientRect(); return { pointerId: 7, clientX: r.left + x, clientY: r.top + y, button: 0, pointerType: 'touch', preventDefault() {} }; };
  function tap(p) { K.curveEditPointerDown(E(p.x, p.y)); K.curveEditPointerUp(E(p.x, p.y)); }
  function drag(p, q) {
    const own = K.curveEditPointerDown(E(p.x, p.y));
    for (let k = 1; k <= 6; k++) K.curveEditPointerMove(E(p.x + (q.x - p.x) * k / 6, p.y + (q.y - p.y) * k / 6));
    K.curveEditPointerUp(E(q.x, q.y));
    return own;
  }
  const cvOf = o => o.mesh.userData.kubikCurve;
  const ringLens = () => K.tubeRingPts.map(r => r.length);
  const meshSum = () => {
    const o = K.findObject(A.opSetup.objId), a = o.mesh.geometry.attributes.position.array;
    let s = 0; for (let i = 0; i < a.length; i++) s += a[i] * ((i % 7) + 1); return s;
  };
  const dotPx = (o, i) => { o.mesh.updateMatrixWorld(); const a = cvOf(o).pts[i];
    return K.worldToScreenPx(new K.THREE.Vector3(a[0], a[1], a[2]).applyMatrix4(o.mesh.matrixWorld)); };

  async function run() {
    A = K.App;
    const V = (x, y, z) => new K.THREE.Vector3(x, y, z);
    const c = K.createCurveObject('Spine', V(0, 0.5, 0),
      [V(-1.8, 0, 0), V(-0.6, 0.9, 0), V(0.6, -0.9, 0), V(1.8, 0, 0)], { type: 'bezier', res: 8 });
    cvOf(c).handles = [null, { mode: 'corner', hIn: [-0.5, 0.35, 0], hOut: [0.5, 0.35, 0] }, null, null];
    K.rebuildCurveGeometry(c);
    K.pushHistory();
    K.startOpSetup('tube', { curveId: c.id });
    await wait(150);
    const ce = A.curveEdit;
    ok('0.tube bar hosts the point editor', !!ce && ce.hosted && A.opSetup && A.opSetup.kind === 'tube');
    K.setOpSetupAmount(0.15);
    const o = K.findObject(A.opSetup.curveId);
    ok('0.no point selected: no handles, every ring drawn',
       K.curveHandlesShown().length === 0 && ringLens().every(n => n > 0), JSON.stringify(ringLens()));

    // 1. select point 1 -> handles, its ring steps aside
    tap(dotPx(o, 1));
    const H = K.curveHandlesShown();
    ok('1.tap selects point 1', ce.sel === 1, 'sel=' + ce.sel);
    ok('1.handles shown in the tube bar', H.length === 2, 'n=' + H.length);
    const L = ringLens();
    ok('1.ring 1 stepped aside, the rest stay', L[1] === 0 && L[0] > 0 && L[2] > 0 && L[3] > 0, JSON.stringify(L));
    ok('1.tube bar still up, curve bar not', !!A.opSetup && ce.hosted);

    // 2. drag the out handle: shape changes, tube rebuilt, one step
    const m0 = meshSum(), h0 = JSON.stringify(cvOf(o).handles[1]);
    const outH = H.find(h => h.which === 'out');
    const p = K.worldToScreenPx(outH.world);
    const own = drag(p, { x: p.x + 30, y: p.y - 25 });
    const h1 = cvOf(o).handles[1];
    ok('2.handle press claimed', own === true);
    ok('2.out handle moved', JSON.stringify(h1) !== h0, JSON.stringify(h1));
    ok('2.corner stays corner, in handle untouched', h1.mode === 'corner' && h1.hIn[0] === -0.5 && h1.hIn[1] === 0.35);
    ok('2.tube mesh rebuilt', Math.abs(meshSum() - m0) > 1e-6, (meshSum() - m0).toExponential(2));
    ok('2.selection kept, ring 1 still aside', ce.sel === 1 && ringLens()[1] === 0);

    // 3. undo inside the bar restores the handle and the mesh
    K.opSetupStepBack();
    await wait(30);
    ok('3.undo restores the handle', JSON.stringify(cvOf(K.findObject(A.opSetup.curveId)).handles[1]) === h0,
       JSON.stringify(cvOf(K.findObject(A.opSetup.curveId)).handles[1]));
    ok('3.undo restores the mesh', Math.abs(meshSum() - m0) < 1e-6);

    // 4. second tap lets the point go: ring comes back, handles gone
    const o2 = K.findObject(A.opSetup.curveId);
    if (ce.sel !== 1) { tap(dotPx(o2, 1)); }
    tap(dotPx(o2, 1));
    ok('4.second tap deselects', ce.sel < 0, 'sel=' + ce.sel);
    ok('4.handles gone, ring 1 back', K.curveHandlesShown().length === 0 && ringLens()[1] > 0, JSON.stringify(ringLens()));

    // 5. a ring grab on point 2 keeps that ring while held, then it steps aside
    K.setOpSetupAmount(0.4);   // big enough on screen to be offered as a ring
    const ring = K.tubeRingPts[2];
    say('info ring2 screen span ' + Math.round(K.worldToScreenPx(ring[0]).x - K.worldToScreenPx(ring[16]).x) + 'px');
    const rp = K.worldToScreenPx(ring[0]);
    const took = K.curveEditPointerDown(E(rp.x, rp.y));
    ok('5.ring press taken as a radius drag', took === true && !!K.tubeRadiusDrag && ce.sel === 2,
       'took=' + took + ' drag=' + !!K.tubeRadiusDrag + ' sel=' + ce.sel);
    ok('5.held ring stays drawn', ringLens()[2] > 0, JSON.stringify(ringLens()));
    K.curveEditPointerUp(E(rp.x, rp.y));
    ok('5.released: ring 2 aside for its handles', !K.tubeRadiusDrag && ringLens()[2] === 0 &&
       K.curveHandlesShown().length === 2, JSON.stringify(ringLens()));

    // 6. a press on a stepped-aside slot does not throw and picks nothing there
    let threw = null, pk = null;
    try { pk = K.pickTubeRingPx(E(rp.x, rp.y)); } catch (e) { threw = e.message; }
    ok('6.pick over an empty slot is safe', !threw && (!pk || pk.i !== 2), threw || JSON.stringify(pk));

    // 7. accept, reopen - handles came through on the tube
    K.finishOpSetup();
    await wait(50);
    const t = A.objects[A.objects.length - 1];
    ok('7.tube kept the edited curve handles', !!(cvOf(t) && cvOf(t).handles && cvOf(t).handles[1] && cvOf(t).handles[1].mode === 'corner'));
    finish();
  }

  function boot() {
    K = window.__kubik;
    if (!K || !K.App) return setTimeout(boot, 200);
    setTimeout(() => run().catch(e => finish('THREW ' + (e && e.stack ? e.stack : e))), 1500);
  }
  setTimeout(() => finish('NO REPORT: timeout inside page'), 120000);
  boot();
})();
