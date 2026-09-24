// v2.76 probe: a tap on the line beside a handled point splits without moving the curve.
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
  const cvOf = o => o.mesh.userData.kubikCurve;
  // world samples of a curve, dense
  function dense(o) {
    const c = JSON.parse(JSON.stringify(cvOf(o))); c.res = 32;
    o.mesh.updateMatrixWorld();
    return K.curveSamplePoints(c).map(v => v.clone().applyMatrix4(o.mesh.matrixWorld));
  }
  // worst distance from any sample of B to the polyline A
  function offCurve(a, b) {
    let worst = 0;
    b.forEach(p => {
      let best = Infinity;
      for (let i = 0; i + 1 < a.length; i++) {
        const ab = a[i + 1].clone().sub(a[i]), ap = p.clone().sub(a[i]);
        const t = Math.max(0, Math.min(1, ap.dot(ab) / Math.max(1e-12, ab.lengthSq())));
        best = Math.min(best, a[i].clone().add(ab.multiplyScalar(t)).distanceTo(p));
      }
      worst = Math.max(worst, best);
    });
    return worst;
  }
  // screen point in the middle of span s, on the drawn line
  function spanMid(o, s) {
    const cv = cvOf(o), res = cv.res || 8;
    o.mesh.updateMatrixWorld();
    const q = K.curveSamplePoints(cv)[s * res + Math.floor(res / 2)].clone().applyMatrix4(o.mesh.matrixWorld);
    return K.worldToScreenPx(q);
  }

  async function run() {
    A = K.App;
    const V = (x, y, z) => new K.THREE.Vector3(x, y, z);
    const o = K.createCurveObject('Split', V(0, 0.5, 0),
      [V(-1.8, 0, 0), V(-0.6, 0.9, 0), V(0.6, -0.9, 0), V(1.8, 0, 0)], { type: 'bezier', res: 8 });
    cvOf(o).handles = [null, { mode: 'corner', hIn: [-0.3, -0.4, 0], hOut: [0.9, 0.7, 0] }, null, null];
    K.rebuildCurveGeometry(o);
    K.pushHistory();
    const before = dense(o);
    K.startCurveEdit(o);
    await wait(100);

    // 1. beside the handled point: split, shape unchanged
    const steps0 = A.curveEdit.steps.length;
    tap(spanMid(o, 1));
    const cv = cvOf(o);
    ok('1.tap on the handled span adds one point', cv.pts.length === 5 && A.curveEdit.sel === 2, 'n=' + cv.pts.length + ' sel=' + A.curveEdit.sel);
    const dev = offCurve(before, dense(o));
    ok('1.the curve did not move', dev < 2e-3, 'max off ' + dev.toExponential(2));
    ok('1.new point Smooth, point 1 still Corner, point 3 frozen Smooth',
       cv.handles[2] && cv.handles[2].mode === 'smooth' && cv.handles[1].mode === 'corner' &&
       cv.handles[3] && cv.handles[3].mode === 'smooth' && cv.handles[0] === null && cv.handles[4] === null,
       JSON.stringify(cv.handles.map(h => h && h.mode)));
    ok('1.one step', A.curveEdit.steps.length === steps0 + 1);
    ok('1.handles on the new point shown', K.curveHandlesShown().length === 2);
    K.curveEditStepBack();
    ok('1.step back: 4 points, handles as before', cvOf(o).pts.length === 4 && cvOf(o).handles[3] === null && offCurve(before, dense(o)) < 1e-6);

    // 2. an all-Auto span: the old insert, new point Auto
    // span 2 touches point 3 (Auto) and point 2 (Auto)
    tap(spanMid(o, 2));
    ok('2.auto span: point added as Auto, neighbours stay Auto',
       cvOf(o).pts.length === 5 && cvOf(o).handles[3] === null && cvOf(o).handles[2] === null && cvOf(o).handles[4] === null,
       JSON.stringify(cvOf(o).handles.map(h => h && h.mode)));
    K.finishCurveEdit(false);
    ok('3.Cancel: back to four points', cvOf(o).pts.length === 4 && offCurve(before, dense(o)) < 1e-6);
    finish();
  }
  function boot() {
    K = window.__kubik;
    if (!K || !K.App || !K.curveSplitSpan) { setTimeout(boot, 120); return; }
    setTimeout(() => { run().catch(e => finish('THREW ' + (e && e.stack ? e.stack : e))); }, 1500);
  }
  boot();
  setTimeout(() => { if (!finished) finish('THREW watchdog'); }, 110000);
})();
