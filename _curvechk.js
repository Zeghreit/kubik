/* v2.14 Curves. _boolchk's shape: VERDICT=PASS/FAIL, running marks, and
   verified against _mkcurvebroken.py's copy. */
(function () {
  const OUT = [];
  let fails = 0;
  const say = s => OUT.push(s);
  const ok = (name, cond, detail) => {
    if (!cond) fails++;
    say((cond ? 'PASS ' : 'FAIL ') + name + (detail === undefined ? '' : '  ' + detail));
  };
  const post = (path, body) => {
    try { const x = new XMLHttpRequest(); x.open('POST', path, true); x.send(body); } catch (e) {}
  };
  const mark = s => post('/mark', 'at: ' + s + '\n' + OUT.join('\n'));
  function finish(extra) {
    if (extra) say(extra);
    say('VERDICT=' + (fails ? 'FAIL' : 'PASS') + ' (' + fails + ' failed)');
    post('/done', OUT.join('\n'));
  }

  let K = null;
  const V = (x, y, z) => new K.THREE.Vector3(x, y, z);

  // The toast element, so a refusal can be checked for what it SAYS and not
  // merely for not throwing. A guard that refuses silently is the failure
  // mode this app names as its worst.
  function lastToast() {
    const el = document.getElementById('toast');
    return el ? (el.textContent || '') : '(no toast element)';
  }

  function clearScene() {
    K.App.objects.slice().forEach(o => { try { K.App.objects; o.mesh.parent.remove(o.mesh); } catch (e) {} });
    K.App.objects.length = 0;
    K.App.selectedObjectIds = new Set();
    K.App.activeObjectId = null;
    K.App.mode = 'object';
  }

  function mkCurve(name, pts, opts) {
    return K.createCurveObject(name, V(0, 0, 0), pts.map(a => V(a[0], a[1], a[2])), opts || {});
  }

  function mkCube(name, x) {
    const ed = K.buildPrimitiveEditable('cube', {});
    const mats = K.makeMaterialSet(ed.groups.length || 1, 0x9aa3b2);
    return K.createObjectFromEditable(name, V(x || 0, 0, 0), ed, mats, {});
  }

  function ptsOf(o) { return o.mesh.userData.kubikCurve.pts; }

  async function run() {
    K = window.__kubik;
    if (!K) { finish('__kubik is undefined - the app never started'); return; }
    ok('0.boot  app up, curve exported',
       !!K.App && typeof K.createCurveObject === 'function' && typeof K.isCurve === 'function');
    if (typeof K.createCurveObject !== 'function') { finish(); return; }
    mark('0.boot');

    // 1 -- a curve is an ordinary object ---------------------------------
    clearScene();
    const c1 = mkCurve('C', [[-1, 0, 0], [0, 1, 0], [1, 0, 0]], { type: 'bezier', res: 8 });
    ok('1.entity it lands in App.objects', K.App.objects.length === 1 && K.App.objects[0] === c1);
    ok('1.entity isCurve says so, and says no to a mesh',
       K.isCurve(c1) === true && K.isCurve(mkCube('Cube', 3)) === false);
    ok('1.entity its mesh is a Line2 with a real geometry',
       !!c1.mesh.geometry && !!c1.mesh.material && c1.mesh.isMesh === true);
    const bs = c1.mesh.geometry.boundingSphere;
    ok('1.entity bounding sphere is finite (not NaN)',
       !!bs && Number.isFinite(bs.radius) && Number.isFinite(bs.center.x),
       bs && ('r=' + bs.radius));
    const box = new K.THREE.Box3().setFromObject(c1.mesh);
    ok('1.entity Box3.setFromObject gives a real box',
       Number.isFinite(box.min.x) && box.max.x - box.min.x > 1.5,
       JSON.stringify(box.max));
    mark('1.entity');

    // 2 -- the sampling, which IS the surface resolution ------------------
    const cv = (pts, type, res, closed) => ({ pts: pts, type: type, res: res, closed: closed });
    const P3 = [[-1, 0, 0], [0, 1, 0], [1, 0, 0]];
    const P4 = [[-1, 0, 0], [0, 1, 0], [1, 0, 0], [0, -1, 0]];
    ok('2.sample poly open is its own points',
       K.curveSamplePoints(cv(P3, 'poly', 8, false)).length === 3);
    ok('2.sample poly closed comes back to the start',
       K.curveSamplePoints(cv(P3, 'poly', 8, true)).length === 4);
    ok('2.sample bezier open: (n-1)*res + 1',
       K.curveSamplePoints(cv(P3, 'bezier', 8, false)).length === 2 * 8 + 1,
       String(K.curveSamplePoints(cv(P3, 'bezier', 8, false)).length));
    ok('2.sample bezier closed: n*res + 1',
       K.curveSamplePoints(cv(P4, 'bezier', 4, true)).length === 4 * 4 + 1,
       String(K.curveSamplePoints(cv(P4, 'bezier', 4, true)).length));
    const s = K.curveSamplePoints(cv(P3, 'bezier', 8, false));
    // Length-guarded, so a broken sampler FAILS this line rather than throwing
    // and taking every later section with it.
    ok('2.sample it passes through its own control points',
       s.length === 17 &&
       s[0].distanceTo(V(-1, 0, 0)) < 1e-6 &&
       s[8].distanceTo(V(0, 1, 0)) < 1e-6 &&
       s[16].distanceTo(V(1, 0, 0)) < 1e-6,
       s[8] ? ('mid=' + s[8].toArray().map(n => n.toFixed(3)).join(',')) : ('n=' + s.length));
    ok('2.sample every sample is finite',
       s.every(p => Number.isFinite(p.x) && Number.isFinite(p.y) && Number.isFinite(p.z)));
    mark('2.sample');

    // 3 -- it survives a save and a load ---------------------------------
    clearScene();
    const before = mkCurve('Profile', [[0, 0, 0], [1, 0.5, 0], [1.5, 2, 0]],
                           { type: 'bezier', res: 16, closed: true });
    before.mesh.position.set(2, 3, 4);
    mkCube('Cube', 3);
    const doc = JSON.parse(JSON.stringify(K.serializeDoc()));
    const rec = doc.objects.filter(o => o.curve)[0];
    ok('3.file  the record carries `curve` and no geometry block',
       !!rec && !!rec.curve && rec.geometry === undefined);
    K.restoreDoc(doc);
    const back = K.App.objects.filter(K.isCurve)[0];
    const bcv = back && back.mesh.userData.kubikCurve;
    ok('3.file  it comes back a curve', !!back && K.isCurve(back));
    ok('3.file  it keeps its id and name',
       !!back && back.id === before.id && back.name === 'Profile',
       back && (back.id + ' ' + back.name));
    ok('3.file  points, type, res and closed all survive',
       !!bcv && bcv.pts.length === 3 && bcv.type === 'bezier' && bcv.res === 16 &&
       bcv.closed === true && Math.abs(bcv.pts[2][1] - 2) < 1e-6,
       bcv && JSON.stringify(bcv));
    ok('3.file  and its transform',
       !!back && Math.abs(back.mesh.position.x - 2) < 1e-6 && Math.abs(back.mesh.position.z - 4) < 1e-6);
    ok('3.file  the mesh beside it came back too',
       K.App.objects.length === 2 && K.App.objects.filter(o => !K.isCurve(o)).length === 1);
    mark('3.file');

    // 4 -- it can be picked ------------------------------------------------
    // The whole architecture rests on Line2 having a working raycast(); if it
    // does not, a curve is invisible to every tap in the app.
    clearScene();
    const pc = mkCurve('Pick', [[-1, 0, 0], [1, 0, 0]], { type: 'poly' });
    pc.mesh.updateMatrixWorld();
    /* Through the app's OWN picker, with a synthetic tap where the curve
       actually is on screen - which is the path a finger takes. A bare
       Raycaster is not the same test: Line2.raycast reads raycaster.camera
       for its screen-space width and throws without one, and setFromCamera is
       what sets it. */
    const sp = K.worldToScreenPx(V(0, 0, 0));
    const vr = K.viewportEl.getBoundingClientRect();
    const hit = sp ? K.pickObjectAt({ clientX: sp.x + vr.left, clientY: sp.y + vr.top }) : null;
    ok('4.pick  a tap on the curve picks it', !!hit && hit.id === pc.id,
       hit ? ('got ' + hit.name) : 'nothing, sp=' + JSON.stringify(sp));
    // And a tap well clear of it picks nothing, so the 14px threshold has not
    // turned every curve into a screen-wide target.
    const miss = sp ? K.pickObjectAt({ clientX: sp.x + vr.left + 220, clientY: sp.y + vr.top }) : null;
    ok('4.pick  a tap away from it picks nothing', !miss, miss && miss.name);
    mark('4.pick');

    // 5 -- every mesh op refuses a curve, BY NAME --------------------------
    clearScene();
    const rc2 = mkCurve('Squiggle', [[0, 0, 0], [1, 1, 0], [2, 0, 0]], {});
    K.App.selectedObjectIds = new Set([rc2.id]);
    ok('5.refuse refuseCurves sees it', K.refuseCurves('Test') === true);
    ok('5.refuse and the toast names the curve',
       lastToast().indexOf('Squiggle') >= 0, lastToast());

    const ops = [['Subdivide', K.subdivideSelection], ['Solidify', K.solidifySelection],
                 ['Join', K.joinSelection], ['Separate', K.separateSelection],
                 ['Array', K.arraySelection], ['Clean up', K.cleanupSelection],
                 ['Cap holes', K.fillHolesSelection]];
    let threw = 0, refused = 0;
    ops.forEach(pair => {
      if (typeof pair[1] !== 'function') return;
      try {
        pair[1]();
        if (lastToast().indexOf('Squiggle') >= 0 || lastToast().indexOf('curve') >= 0) refused++;
      } catch (e) { threw++; say('   threw on ' + pair[0] + ': ' + e.message); }
    });
    ok('5.refuse no mesh op throws on a curve', threw === 0, 'threw=' + threw);
    ok('5.refuse and they all say why', refused >= 5, 'refused=' + refused + ' of ' + ops.length);
    ok('5.refuse the curve is untouched',
       K.App.objects.length === 1 && ptsOf(rc2).length === 3);
    ok('5.refuse Boolean refuses it in the survey',
       typeof K.booleanSurvey([rc2, rc2]) === 'string' &&
       K.booleanSurvey([rc2, rc2]).indexOf('curve') >= 0,
       String(K.booleanSurvey([rc2, rc2])));
    mark('5.refuse');

    // 6 -- the backstop, and the door ---------------------------------------
    let named = false;
    try { K.toEditable ? K.toEditable(rc2.mesh) : (named = true); }
    catch (e) { named = /curve/.test(e.message); }
    ok('6.guard toEditable fails loudly on a curve, not quietly', named === true);

    K.App.selectedObjectIds = new Set([rc2.id]);
    K.setMode('vertex');
    ok('6.guard component modes refuse a curve selection',
       K.App.mode === 'object', 'mode=' + K.App.mode);
    ok('6.guard and say why', lastToast().indexOf('curve') >= 0, lastToast());
    mark('6.guard');

    // 7 -- the ring switches on the selection's TYPE -----------------------
    clearScene();
    const rc3 = mkCurve('C', [[0, 0, 0], [1, 1, 0]], {});
    const cube7 = mkCube('Cube', 3);
    K.App.mode = 'object';
    K.App.selectedObjectIds = new Set([rc3.id]);
    let ring = K.currentHubTools();
    ok('7.ring   a curve selection gets the curve ring',
       ring.some(t => t.key === 'curvetype') && !ring.some(t => t.key === 'subdivide'),
       ring.map(t => t.key).join(','));
    K.App.selectedObjectIds = new Set([rc3.id, cube7.id]);
    ring = K.currentHubTools();
    ok('7.ring   a MIXED selection keeps the object ring',
       ring.some(t => t.key === 'subdivide') && !ring.some(t => t.key === 'curvetype'));
    K.App.selectedObjectIds = new Set([cube7.id]);
    ring = K.currentHubTools();
    ok('7.ring   a mesh selection is unchanged',
       ring.some(t => t.key === 'subdivide') && !ring.some(t => t.key === 'curvetype'));
    mark('7.ring');

    // 8 -- UNDO covers a curve edit ----------------------------------------
    // The architectural claim, tested: pushHistory dedupes on a signature over
    // App.objects, so a curve outside that array would record no step at all.
    clearScene();
    const uc = mkCurve('U', [[0, 0, 0], [1, 1, 0], [2, 0, 0]], { type: 'bezier', res: 8 });
    K.App.selectedObjectIds = new Set([uc.id]);
    K.pushHistory();
    K.toggleCurveType();                                  // -> poly, pushes
    const afterType = uc.mesh.userData.kubikCurve.type;
    K.undo();
    const nowC = K.App.objects.filter(K.isCurve)[0];
    ok('8.undo   a type flip is a real history step',
       afterType === 'poly' && !!nowC && nowC.mesh.userData.kubikCurve.type === 'bezier',
       afterType + ' -> ' + (nowC && nowC.mesh.userData.kubikCurve.type));

    K.App.selectedObjectIds = new Set([nowC.id]);
    K.cycleCurveRes();
    const afterRes = nowC.mesh.userData.kubikCurve.res;
    K.undo();
    const nowC2 = K.App.objects.filter(K.isCurve)[0];
    ok('8.undo   so is a resolution change',
       !!nowC2 && nowC2.mesh.userData.kubikCurve.res === 8 && afterRes !== 8,
       afterRes + ' -> ' + (nowC2 && nowC2.mesh.userData.kubikCurve.res));
    mark('8.undo');

    // 9 -- duplicate makes a real copy, not a shared one -------------------
    clearScene();
    const dc = mkCurve('D', [[0, 0, 0], [1, 1, 0], [2, 0, 0]], { type: 'poly', res: 4, closed: true });
    K.App.selectedObjectIds = new Set([dc.id]);
    K.duplicateSelection();
    const curves = K.App.objects.filter(K.isCurve);
    ok('9.dupe   there are two curves now', curves.length === 2, 'n=' + curves.length);
    const other = curves.filter(o => o.id !== dc.id)[0];
    ok('9.dupe   the copy carries the settings',
       !!other && other.mesh.userData.kubikCurve.type === 'poly' &&
       other.mesh.userData.kubikCurve.closed === true);
    if (other) {
      other.mesh.userData.kubikCurve.pts[0][0] = 99;
      ok('9.dupe   and its own points, not the original’s',
         ptsOf(dc)[0][0] === 0, 'orig=' + ptsOf(dc)[0][0]);
    }
    mark('9.dupe');

    // 10 -- the work plane --------------------------------------------------
    clearScene();
    K.startCurveDraw(null);
    ok('10.plane a draw is open', !!K.curveDraw);
    if (K.curveDraw) {
      K.curveDraw.plane = 'y';
      const pl = K.curveWorkPlane();
      ok('10.plane Y names the plane whose NORMAL is Y',
         Math.abs(pl.normal.y - 1) < 1e-6 && Math.abs(pl.constant) < 1e-6,
         JSON.stringify(pl.normal));
      K.curveDraw.plane = 'x';
      ok('10.plane and X likewise', Math.abs(K.curveWorkPlane().normal.x - 1) < 1e-6);
      K.curveDraw.plane = 'free';
      const f = K.curveWorkPlane().normal;
      const cam = new K.THREE.Vector3();
      K.camera.getWorldDirection(cam);
      ok('10.plane Free faces the camera', Math.abs(f.dot(cam) + 1) < 1e-3,
         'dot=' + f.dot(cam).toFixed(4));
    }
    K.cancelCurveDraw(true);
    ok('10.plane cancel clears the draw and hands the camera back',
       !K.curveDraw && K.orbit.enabled === true);
    mark('10.plane');

    // 11 -- a lone point cannot poison the scene ---------------------------
    clearScene();
    const one = mkCurve('One', [[1, 2, 3]], {});
    const sph = one.mesh.geometry.boundingSphere;
    ok('11.lone  a one-point curve draws nothing and stays finite',
       one.mesh.visible === false &&
       (!sph || (Number.isFinite(sph.radius) && Number.isFinite(sph.center.x))),
       sph ? ('r=' + sph.radius) : 'no sphere');
    const wb = new K.THREE.Box3().setFromObject(one.mesh);
    ok('11.lone  and framing it does not go NaN',
       !Number.isNaN(wb.min.x) && !Number.isNaN(wb.max.x));
    mark('11.lone');

    // 12 -- delete leaves nothing behind ------------------------------------
    clearScene();
    const del = mkCurve('Gone', [[0, 0, 0], [1, 0, 0]], {});
    const inScene = () => K.scene.children.indexOf(del.mesh) >= 0;
    ok('12.del   it is in the scene to begin with', inScene());
    const strokesBefore = K.gizmoStrokes ? K.gizmoStrokes.length : -1;
    K.App.selectedObjectIds = new Set([del.id]);
    K.deleteSelection();
    ok('12.del   the object is gone', K.App.objects.length === 0 && !inScene());
    ok('12.del   and its material left the resize list',
       K.gizmoStrokes ? K.gizmoStrokes.length === strokesBefore - 1 : true,
       K.gizmoStrokes ? (strokesBefore + ' -> ' + K.gizmoStrokes.length) : 'not exported');
    mark('12.del');

    finish();
  }

  setTimeout(() => {
    run().catch(e => {
      say('THREW ' + (e && e.stack ? e.stack : e));
      fails++;
      finish();
    });
  }, 3000);
})();
