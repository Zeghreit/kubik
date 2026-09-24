// v2.75 probe: Bezier handles in the curve point editor.
(function () {
  const OUT = [];
  let fails = 0, finished = false;
  const say = s => OUT.push(s);
  const ok = (name, cond, detail) => {
    if (!cond) fails++;
    say((cond ? 'PASS ' : 'FAIL ') + name + (detail === undefined ? '' : '  ' + detail));
  };
  const post = (p, b) => { try { const x = new XMLHttpRequest(); x.open('POST', p, true); x.send(b); } catch (e) {} };
  const mark = s => post('/mark', 'at: ' + s + '\n' + OUT.join('\n'));
  function finish(extra) {
    if (finished) return;
    finished = true;
    if (extra) { say(extra); fails++; }
    say('VERDICT=' + (fails ? 'FAIL' : 'PASS') + ' (' + fails + ' failed)');
    post('/done', OUT.join('\n'));
  }
  const wait = ms => new Promise(r => setTimeout(r, ms));
  let K = null, A = null;
  const $ = id => document.getElementById(id);
  const R = () => $('viewport').getBoundingClientRect();
  const E = (x, y) => { const r = R(); return { pointerId: 7, clientX: r.left + x, clientY: r.top + y, button: 0, pointerType: 'touch', preventDefault() {} }; };
  const scr = w => K.worldToScreenPx(w);
  function gesture(x0, y0, dx, dy) {
    const down = K.curveEditPointerDown(E(x0, y0));
    for (let k = 1; k <= 6; k++) K.curveEditPointerMove(E(x0 + dx * k / 6, y0 + dy * k / 6));
    K.curveEditPointerUp(E(x0 + dx, y0 + dy));
    return down;
  }
  const tap = (x, y) => gesture(x, y, 0, 0);
  const cvOf = o => o.mesh.userData.kubikCurve;
  const len = a => Math.hypot(a[0], a[1], a[2]);
  const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  const samples = o => JSON.stringify(K.curveSamplePoints(cvOf(o)).map(v => [v.x, v.y, v.z].map(c => +c.toFixed(9))));
  const dev = (a, b) => { a = JSON.parse(a); b = JSON.parse(b); if (a.length !== b.length) return 1e9; let m = 0; a.forEach((p, i) => p.forEach((c, k) => { m = Math.max(m, Math.abs(c - b[i][k])); })); return m; };
  const chip = k => document.querySelector('#opGrouping [data-curve-handle="' + k + '"]');
  const shown = k => { const b = chip(k); return !!b && b.style.display !== 'none'; };
  const active = k => { const b = chip(k); return !!b && b.classList.contains('active'); };
  const handleScr = which => { const h = K.curveHandlesShown().find(q => q.which === which); return h ? scr(h.world) : null; };
  const pointScr = (o, i) => { const a = cvOf(o).pts[i]; o.mesh.updateMatrixWorld(); return scr(new K.THREE.Vector3(a[0], a[1], a[2]).applyMatrix4(o.mesh.matrixWorld)); };

  async function run() {
    A = K.App;
    const V = (x, y, z) => new K.THREE.Vector3(x, y, z);
    const o = K.createCurveObject('ProbeCurve', V(0, 0.5, 0),
      [V(-1.6, 0, 0), V(-0.5, 0.8, 0), V(0.5, -0.8, 0), V(1.6, 0, 0)], { type: 'bezier', res: 8 });
    K.pushHistory();
    const auto0 = samples(o);
    const r = R();
    const ps = [0, 1, 2, 3].map(i => pointScr(o, i));
    ok('0.points on screen', ps.every(p => p && p.x > 20 && p.x < r.width - 20 && p.y > 20 && p.y < r.height - 20),
       ps.map(p => p && p.x.toFixed(0) + ',' + p.y.toFixed(0)).join(' '));

    K.startCurveEdit(o);
    await wait(100);
    ok('1.no selection: no handles, no chips', K.curveHandlesShown().length === 0 && !shown('auto') && !shown('corner'));
    tap(ps[1].x, ps[1].y);
    ok('1.tap point 1 selects it', A.curveEdit.sel === 1, 'sel=' + A.curveEdit.sel);
    ok('1.two handles shown, chips shown, Auto lit', K.curveHandlesShown().length === 2 && shown('auto') && active('auto') && !active('corner'));
    tap(ps[0].x, ps[0].y);
    ok('1.open end shows one handle', K.curveHandlesShown().length === 1 && K.curveHandlesShown()[0].which === 'out');
    tap(ps[1].x, ps[1].y);
    mark('1');

    // 2. drag the out handle of an Auto point: it becomes Smooth, the other mirrors in direction only
    const inLen0 = len(K.curveAutoHandle(cvOf(o), 1).hIn);
    const steps0 = A.curveEdit.steps.length;
    const hs = handleScr('out');
    const n0 = cvOf(o).pts.length;
    const claimed = gesture(hs.x, hs.y, 35, -45);
    let h = cvOf(o).handles[1];
    ok('2.handle press is claimed', claimed === true);
    ok('2.Auto became Smooth', h && h.mode === 'smooth', JSON.stringify(h));
    ok('2.pair stays in line, in keeps its length',
       h && Math.abs(dot(h.hIn, h.hOut) + len(h.hIn) * len(h.hOut)) < 1e-6 && Math.abs(len(h.hIn) - inLen0) < 1e-6,
       h && 'cos=' + (dot(h.hIn, h.hOut) / len(h.hIn) / len(h.hOut)).toFixed(6) + ' |in| ' + inLen0.toFixed(4) + '->' + len(h.hIn).toFixed(4));
    ok('2.shape changed, no point added, one step', samples(o) !== auto0 && cvOf(o).pts.length === n0 && A.curveEdit.steps.length === steps0 + 1,
       'steps ' + steps0 + '->' + A.curveEdit.steps.length);
    ok('2.the handle followed the finger', (() => { const q = handleScr('out'); return q && Math.hypot(q.x - hs.x - 35, q.y - hs.y + 45) < 2; })());
    ok('2.chips: neither lit (Smooth)', !active('auto') && !active('corner'));
    K.curveEditStepBack();
    ok('2.step back: Auto again, shape exactly back', cvOf(o).handles[1] === null && samples(o) === auto0);
    mark('2');

    // 3. a tap on a handle does nothing - no point on the line under it
    const hs3 = handleScr('in');
    const nb = cvOf(o).pts.length, sb = samples(o);
    tap(hs3.x, hs3.y);
    ok('3.tap on a handle adds nothing', cvOf(o).pts.length === nb && samples(o) === sb && A.curveEdit.sel === 1);

    // 4. Corner: handles move apart
    $('toast').textContent = '';
    chip('corner').click();
    h = cvOf(o).handles[1];
    ok('4.Corner chip: corner, shape held', h && h.mode === 'corner' && dev(samples(o), sb) < 1e-8, JSON.stringify(h));
    ok('4.Corner lit', active('corner') && !active('auto'));
    const out4 = h.hOut.slice();
    const hi = handleScr('in');
    gesture(hi.x, hi.y, -40, -30);
    h = cvOf(o).handles[1];
    ok('4.dragging in leaves out alone', h.hOut.join() === out4.join() && Math.abs(dot(h.hIn, h.hOut) + len(h.hIn) * len(h.hOut)) > 1e-3);
    chip('corner').click();
    h = cvOf(o).handles[1];
    ok('4.Corner again: Smooth, lined up, out kept', h.mode === 'smooth' && h.hOut.join() === out4.join() &&
       Math.abs(dot(h.hIn, h.hOut) + len(h.hIn) * len(h.hOut)) < 1e-6);
    chip('corner').click();
    mark('4');

    // 5. dragging the POINT carries its handles
    const hb = JSON.stringify(cvOf(o).handles[1]);
    const p1 = pointScr(o, 1);
    gesture(p1.x, p1.y, 25, 30);
    ok('5.point moved, handles ride along', JSON.stringify(cvOf(o).handles[1]) === hb && Math.hypot(pointScr(o, 1).x - p1.x - 25, pointScr(o, 1).y - p1.y - 30) < 2);

    // 6. Delete point 0: the handle row moves with its point
    tap(pointScr(o, 0).x, pointScr(o, 0).y);
    K.curveEditDelete();
    ok('6.delete keeps rows together', cvOf(o).handles.length === cvOf(o).pts.length && JSON.stringify(cvOf(o).handles[0]) === hb,
       cvOf(o).handles.length + '/' + cvOf(o).pts.length);
    // 7. Auto chip
    ok('7.select the handled point', A.curveEdit.sel === 0);
    const beforeAuto = JSON.stringify(cvOf(o).handles[0]);
    chip('auto').click();
    ok('7.Auto chip clears it', cvOf(o).handles[0] === null && active('auto'));
    K.curveEditStepBack();
    ok('7.step back restores it', JSON.stringify(cvOf(o).handles[0]) === beforeAuto);
    mark('7');

    // 8. OK: one history step; save/load; Undo
    const hist0 = A.historyIndex;
    const shape8 = samples(o);
    K.finishCurveEdit(true);
    ok('8.OK pushes one step', A.historyIndex === hist0 + 1);
    const doc = K.serializeDoc();
    const dcv = JSON.parse(JSON.stringify(doc)).objects.find(d => d.name === 'ProbeCurve');
    ok('8.saved with handles', dcv && dcv.curve && Array.isArray(dcv.curve.handles) && dcv.curve.handles[0] && dcv.curve.handles[0].mode === 'corner');
    K.restoreDoc(JSON.parse(JSON.stringify(doc)));
    await wait(200);
    const o2 = A.objects.find(q => q.name === 'ProbeCurve');
    ok('8.loads back the same shape', o2 && samples(o2) === shape8);
    // an older file: no handles field at all
    const old = JSON.parse(JSON.stringify(doc));
    old.objects.forEach(d => { if (d.curve) delete d.curve.handles; });
    K.restoreDoc(old);
    await wait(200);
    const o3 = A.objects.find(q => q.name === 'ProbeCurve');
    ok('8.old file loads as Auto', o3 && cvOf(o3).handles.every(x => x === null), o3 && JSON.stringify(cvOf(o3).handles));
    K.restoreDoc(JSON.parse(JSON.stringify(doc)));
    await wait(200);
    K.undo(); await wait(300);
    const o4 = A.objects.find(q => q.name === 'ProbeCurve');
    ok('8.Undo: back to all Auto', o4 && cvOf(o4).handles.every(x => x === null) && samples(o4) === auto0);
    K.redo(); await wait(300);
    const o5 = A.objects.find(q => q.name === 'ProbeCurve');
    ok('8.Redo: handles back', o5 && samples(o5) === shape8);
    mark('8');

    // 9. Cancel returns the handles too
    K.startCurveEdit(o5);
    tap(pointScr(o5, 0).x, pointScr(o5, 0).y);
    const h9 = JSON.stringify(cvOf(o5).handles);
    const hs9 = handleScr('out');
    gesture(hs9.x, hs9.y, 30, 30);
    const moved9 = JSON.stringify(cvOf(o5).handles) !== h9;
    K.finishCurveEdit(false);
    ok('9.Cancel puts the handles back', moved9 && JSON.stringify(cvOf(o5).handles) === h9 && samples(o5) === shape8);
    // 10. Poly shows no handles; duplicate carries them
    K.startCurveEdit(o5);
    tap(pointScr(o5, 0).x, pointScr(o5, 0).y);
    cvOf(o5).type = 'poly';
    ok('10.poly: no handles', K.curveHandlesShown().length === 0);
    cvOf(o5).type = 'bezier';
    K.finishCurveEdit(false);
    // 12. Duplicate carries them, as copies
    const dup = K.cloneObjectInto(o5, 'ProbeDup');
    ok('12.duplicate carries handles', dup && JSON.stringify(cvOf(dup).handles) === JSON.stringify(cvOf(o5).handles) &&
       cvOf(dup).handles !== cvOf(o5).handles && samples(dup) === samples(o5));
    // 13. Add points keeps the handles of the points it started with...
    const hAdd = JSON.stringify(cvOf(o5).handles[0]);
    K.startCurveDraw(o5);
    ok('13.draw carries world handles', A.curveDraw && A.curveDraw.handlesW.length === cvOf(o5).pts.length);
    const last = A.curveDraw.pts[A.curveDraw.pts.length - 1];
    A.curveDraw.pts.push(last.clone().add(V(0.8, 0.4, 0)));
    K.applyCurveDraw(); await wait(200);
    ok('13.apply keeps the old handles, new point Auto', JSON.stringify(cvOf(o5).handles[0]) === hAdd &&
       cvOf(o5).handles[cvOf(o5).handles.length - 1] === null, JSON.stringify(cvOf(o5).handles));
    // ...and Back past the originals takes their handles away
    K.startCurveDraw(o5);
    const nOrig = A.curveDraw.pts.length;
    for (let k = 0; k < nOrig; k++) $('opToggle').click();
    ok('13.Back pops handles with points', A.curveDraw.pts.length === 0 && A.curveDraw.handlesW.length === 0,
       A.curveDraw.pts.length + '/' + A.curveDraw.handlesW.length);
    [V(-1, 0, 0), V(0, 1, 0), V(1, 0, 0)].forEach(v => A.curveDraw.pts.push(v));
    K.applyCurveDraw(); await wait(200);
    ok('13.new points after Back are all Auto', cvOf(o5).handles.every(x => x === null), JSON.stringify(cvOf(o5).handles));
    K.undo(); K.undo(); await wait(300);
    const o6 = A.objects.find(q => q.name === 'ProbeCurve');
    ok('13.undo x2 back to the handled curve', o6 && JSON.stringify(cvOf(o6).handles[0]) === hAdd);
    // 11. Tube follows the handles: sweep with and without
    const tubeHash = () => { try { const t = K.tubeCurveOp(o6, 0.1, 6, true); const g = t && t.ed; return g ? Array.from(g.positions.slice(0, 600)).map(v => v.toFixed(5)).join() : JSON.stringify(Object.keys(t || {})); } catch (e) { return 'threw ' + e.message; } };
    const tA = tubeHash();
    const keep = JSON.stringify(cvOf(o6).handles);
    cvOf(o6).handles = cvOf(o6).handles.map(() => null);
    const tB = tubeHash();
    cvOf(o6).handles = JSON.parse(keep);
    ok('11.tube differs with handles', tA !== tB && tA.indexOf('threw') < 0, tA.slice(0, 60) + ' | ' + tB.slice(0, 60));
    finish();
  }
  function boot() {
    K = window.__kubik;
    if (!K || !K.App || !K.curveHandlesShown) { setTimeout(boot, 120); return; }
    setTimeout(() => { run().catch(e => finish('THREW ' + (e && e.stack ? e.stack : e))); }, 1500);
  }
  boot();
  setTimeout(() => { if (!finished) finish('THREW watchdog - hung after: ' + (OUT[OUT.length - 1] || 'boot')); }, 110000);
})();
