/* v3.15: Cut with a curve - Knife (edges only, same volume, one object) and
   Split (two closed objects whose volumes add up). Driven through the seat's
   own entry and the bar's buttons. Run: python3 _cloudprobe.py _curvecutchk.js */
(async function () {
  const out = [];
  const say = s => { out.push(s); try { const x = new XMLHttpRequest(); x.open('POST', '/p', true); x.send(s); } catch (e) {} };
  const post = b => { try { const x = new XMLHttpRequest(); x.open('POST', '/result', true); x.send(b); } catch (e) {} };
  const wait = ms => new Promise(r => setTimeout(r, ms));
  let fails = 0, K;
  const check = (n, ok, note) => { if (!ok) fails++; say((ok ? 'PASS ' : 'FAIL ') + n + (note != null ? '  ' + note : '')); };
  const S = () => K.App.opSetup;
  const chip = (label) => Array.from(document.querySelectorAll('#opGrouping button')).find(b => b.textContent === label);
  const V = (x, y, z) => new K.THREE.Vector3(x, y, z);
  function volume(o) {
    const ed = K.toEditable(o.mesh), P = ed.positions, m = o.mesh.matrixWorld;
    const a = V(0, 0, 0), b = V(0, 0, 0), c = V(0, 0, 0);
    let v = 0;
    ed.groups.forEach(g => g.triangles.forEach(t => {
      a.fromArray(P, t[0] * 3).applyMatrix4(m); b.fromArray(P, t[1] * 3).applyMatrix4(m); c.fromArray(P, t[2] * 3).applyMatrix4(m);
      v += a.dot(b.clone().cross(c)) / 6;
    }));
    return v;
  }
  const closed = o => { const w = K.auditWinding(o); return w.boundary === 0 && w.nonManifold === 0 && w.reversed === 0 && w.conflictEdges === 0; };
  const meshes = () => K.App.objects.filter(o => !K.isCurve(o));
  function scene(curvePts, isClosed) {
    if (S()) K.finishOpSetup(false);
    K.App.objects.slice().forEach(o => { try { o.mesh.parent.remove(o.mesh); } catch (e) {} });
    K.App.objects.length = 0; K.App.hidden.clear();
    const ed = K.buildPrimitiveEditable('cube', {});
    const cube = K.createObjectFromEditable('Box', V(0, 0, 0), ed, K.makeMaterialSet(ed.groups.length || 1, 0x9aa3b2), {});
    const cv = K.createCurveObject('Curve', V(0, 0, 0), curvePts.map(a => V(a[0], a[1], a[2])), { closed: isClosed, type: 'poly' });
    K.pushHistory();
    K.App.mode = 'object';
    K.App.selectedObjectIds = new Set([cube.id, cv.id]);
    return { cube, cv };
  }
  const toastText = () => (document.getElementById('toast') || {}).textContent;
  async function open() { K.curveCutSelection(); for (let i = 0; i < 400 && !S(); i++) await wait(25); if (!S()) say('INFO toast: ' + toastText()); return !!S(); }
  const ok = async () => { document.getElementById('opOk').click(); await wait(100); };
  const circle = [];
  for (let i = 0; i < 16; i++) { const a = 2 * Math.PI * i / 16; circle.push([0.25 * Math.cos(a), 0.8, 0.25 * Math.sin(a)]); }
  const circArea = 0.5 * 16 * 0.0625 * Math.sin(2 * Math.PI / 16);
  try {
    while (!(window.__kubik && window.__kubik.App)) await wait(50);
    await wait(1500);
    K = window.__kubik;
    const cw = console.warn; console.warn = function () { try { say('WARN ' + Array.from(arguments).map(a => a && a.stack ? a.stack.split('\n').slice(0, 4).join(' / ') : String(a)).join(' ')); } catch (e) {} return cw.apply(console, arguments); };

    /* 1. Closed circle above a cube, Knife: one object, same volume, more faces. */
    scene(circle, true);
    check('bar opens on a curve + an object', await open());
    check('Knife lit by default', chip('Knife') && chip('Knife').classList.contains('active'));
    check('no slider for Knife', document.getElementById('opSlider').style.display === 'none');
    await ok();
    let ms = meshes();
    check('knife: one object', ms.length === 1, ms.length);
    check('knife: closed', closed(ms[0]), JSON.stringify(K.auditWinding(ms[0])));
    check('knife: volume unchanged', Math.abs(volume(ms[0]) - 1) < 1e-5, volume(ms[0]).toFixed(6));
    const fk = K.toEditable(ms[0].mesh).groups.length;
    // top and bottom: the disc, and the ring round it bridged into two (a face cannot hold a hole) - 3 each, plus 4 sides
    check('knife: top and bottom each cut (10 faces)', fk === 10, fk);
    check('knife: the curve stays', K.App.objects.some(o => K.isCurve(o)));
    K.undo(); await wait(100);
    check('undo: the plain cube is back', meshes().length === 1 && K.toEditable(meshes()[0].mesh).groups.length === 6);

    /* 2. Same curve, Split: two closed objects, the core and the rest. */
    scene(circle, true);
    await open();
    chip('Split').click(); await wait(50);
    check('slider shown for Split', document.getElementById('opSlider').style.display !== 'none');
    check('readout says 2 pieces', /2 pieces/.test(document.getElementById('opReadout').textContent), document.getElementById('opReadout').textContent);
    await ok();
    ms = meshes();
    check('split: two objects', ms.length === 2, ms.length);
    const vs = ms.map(volume).sort((a, b) => a - b);
    check('split: both closed', ms.every(closed), ms.map(o => JSON.stringify(K.auditWinding(o))).join(' '));
    check('split: core = the circle\'s prism', Math.abs(vs[0] - circArea) < 1e-5, vs[0].toFixed(6) + ' vs ' + circArea.toFixed(6));
    check('split: volumes add up to the cube', Math.abs(vs[0] + vs[1] - 1) < 1e-5, (vs[0] + vs[1]).toFixed(6));
    check('split: both selected', K.App.selectedObjectIds.size === 2);
    K.undo(); await wait(100);
    check('undo after split: one cube', meshes().length === 1);

    /* 3. An open V across the cube, Split: two halves, volumes add up. */
    const vee = [[-1, 0.8, -0.2], [0, 0.8, 0.2], [1, 0.8, -0.2]];
    scene(vee, false);
    await open(); chip('Split').click(); await wait(50); await ok();
    ms = meshes();
    const v2 = ms.map(volume);
    check('open V split: two closed halves', ms.length === 2 && ms.every(closed), ms.length);
    check('open V split: volumes add up', Math.abs(v2.reduce((a, b) => a + b, 0) - 1) < 1e-5, v2.map(v => v.toFixed(4)).join(' + '));
    // The V's wall at x=0 is z=0.2: the side away from +z holds 0.5 + 0.5*0.2... just check both are real pieces.
    check('open V split: neither piece is empty', v2.every(v => v > 0.2), v2.map(v => v.toFixed(4)).join(','));

    /* 4. Open V, Knife: closed, same volume. */
    scene(vee, false);
    await open(); await ok();
    ms = meshes();
    check('open V knife: one closed object, same volume', ms.length === 1 && closed(ms[0]) && Math.abs(volume(ms[0]) - 1) < 1e-5, volume(ms[0]).toFixed(6));

    /* 5. Straight line (no plane of its own): cut away from the camera. */
    scene([[-1, 0.3, 0], [1, 0.3, 0]], false);
    await open(); chip('Split').click(); await wait(50); await ok();
    ms = meshes();
    check('straight line split: two closed pieces', ms.length === 2 && ms.every(closed), ms.length);

    /* 6. Cancel leaves the cube; a self-crossing curve is refused; a curve alone is refused. */
    scene(circle, true);
    await open(); document.getElementById('opCancel').click(); await wait(80);
    check('cancel: the cube and the curve, untouched', meshes().length === 1 && K.toEditable(meshes()[0].mesh).groups.length === 6 && K.App.objects.length === 2);
    scene([[-0.5, 0.8, -0.5], [0.5, 0.8, 0.5], [0.5, 0.8, -0.5], [-0.5, 0.8, 0.5]], true);
    K.curveCutSelection(); await wait(150);
    check('a bow-tie curve is refused', !S());
    const sc = scene(circle, true);
    K.App.selectedObjectIds = new Set([sc.cv.id]);
    K.curveCutSelection(); await wait(150);
    check('a curve alone is refused', !S());
    /* 7. A curve that misses the object entirely. */
    scene(circle.map(p => [p[0] + 5, p[1], p[2]]), true);
    K.curveCutSelection(); await wait(300);
    check('a curve that misses: refused or no change offered', !S() || /does not/.test(document.getElementById('opReadout').textContent + (document.querySelector('.toast') || {}).textContent), S() ? 'bar open' : 'refused');
    if (S()) K.finishOpSetup(false);

    /* 7b. Review fixes (v3.15). */
    scene(circle, true);
    await open(); document.getElementById('opCancel').click(); await wait(80);
    check('cancel keeps the curve selected (the seat stays lit)', K.App.objects.filter(o => K.App.selectedObjectIds.has(o.id)).length === 2);
    { const sc2 = scene(circle, true); sc2.cube.mesh.userData.autoSmoothAngle = Math.PI;
      await open(); chip('Split').click(); await wait(50);
      const said = +((/(\d+) pieces/.exec(document.getElementById('opReadout').textContent) || [])[1]);
      await ok();
      ms = meshes();
      check('split: the readout counted what OK made', said === ms.length, said + ' vs ' + ms.length);
      const bb = new K.THREE.Box3(); ms.forEach(o => bb.expandByObject(o.mesh));
      check('split: the pieces stand back where they were cut (no gap baked in)', bb.min.distanceTo(V(-0.5, -0.5, -0.5)) < 1e-5 && bb.max.distanceTo(V(0.5, 0.5, 0.5)) < 1e-5, bb.min.toArray().map(v => v.toFixed(4)) + ' ' + bb.max.toArray().map(v => v.toFixed(4)));
      check('split: every piece keeps the object\'s smoothing angle', ms.every(o => o.mesh.userData.autoSmoothAngle === Math.PI), ms.map(o => o.mesh.userData.autoSmoothAngle).join(','));
    }
    { // a strip across the cube: one cut, three pieces
      scene([[-0.15, 0.8, -1], [0.15, 0.8, -1], [0.15, 0.8, 1], [-0.15, 0.8, 1]], true);
      await open(); chip('Split').click(); await wait(50);
      const said = +((/(\d+) pieces/.exec(document.getElementById('opReadout').textContent) || [])[1]);
      await ok(); ms = meshes();
      check('strip split: 3 closed pieces, said so first', ms.length === 3 && said === 3 && ms.every(closed), said + ' / ' + ms.length);
    }
    { // a thick U started mid-way, and a Lambda with its feet turned in (fable)
      const U = [[-.4, .4], [-.4, -.4], [.4, -.4], [.4, .4], [.2, .4], [.2, -.2], [-.2, -.2], [-.2, .4]];
      const Us = U.slice(5).concat(U.slice(0, 5)).map(q => [q[0], 0.8, q[1]]);
      scene(Us, true); await open(); chip('Split').click(); await wait(50); await ok(); ms = meshes();
      const vU = ms.map(volume).sort((a, b) => a - b);
      check('U split (cap ear-clipped): 0.40 / 0.60, closed', ms.length === 2 && ms.every(closed) && Math.abs(vU[0] - 0.4) < 1e-5, vU.map(v => v.toFixed(4)).join(' / '));
      scene([[-1, 0.8, -0.3], [-.75, 0.8, -0.733], [0, 0.8, 0.3], [.75, 0.8, -0.733], [1, 0.8, -0.3]], false);
      await open(); chip('Split').click(); await wait(50); await ok(); ms = meshes();
      check('Lambda split: 2 closed pieces (the far edge clears the curve)', ms.length === 2 && ms.every(closed), ms.length + ' ' + ms.map(volume).map(v => v.toFixed(4)).join('/'));
    }
    { // six materials on one cube
      scene(circle, true);
      const cube = meshes()[0], defs = ['standard', 'plastic', 'lacquer', 'ceramic', 'rubber', 'velvet'];
      const mats = Array.isArray(cube.mesh.material) ? cube.mesh.material : [cube.mesh.material];
      say('INFO cube materials: ' + mats.length);
      if (K.applyMaterialToFaces) { defs.forEach((d, i) => { try { K.applyMaterialToFaces(cube, [i], d); } catch (e) {} }); }
      else mats.forEach((m, i) => { m.userData.kubikDef = defs[i % defs.length]; m.color.setHSL(i / 6, 0.5, 0.5); });
      await open(); chip('Split').click(); await wait(50);
      check('six materials: the bar builds', !!S() && /pieces/.test(document.getElementById('opReadout').textContent), document.getElementById('opReadout').textContent);
      if (S()) { await ok(); ms = meshes(); check('six materials: 2 closed pieces', ms.length === 2 && ms.every(closed), ms.length); }
    }

    /* 8. Curved targets: sphere and can, a bezier circle and an open bezier S. */
    const kinds = [['sphere', {}], ['cylinder', { h: 12, v: 1 }]];
    const curves = [['bezier circle', circle.map(p => [p[0] * 1.2, p[1], p[2] * 1.2]), true], ['open S', [[-1, 0.8, -0.3], [-0.3, 0.8, 0.25], [0.3, 0.8, -0.25], [1, 0.8, 0.3]], false]];
    for (const [kind, kp] of kinds) for (const [cname, pts, cl] of curves) for (const mode of ['Knife', 'Split']) {
      if (S()) K.finishOpSetup(false);
      K.App.objects.slice().forEach(o => { try { o.mesh.parent.remove(o.mesh); } catch (e) {} });
      K.App.objects.length = 0; K.App.hidden.clear();
      const ed = K.buildPrimitiveEditable(kind, kp);
      const ob = K.createObjectFromEditable(kind, V(0, 0, 0), ed, K.makeMaterialSet(ed.groups.length || 1, 0x9aa3b2), {});
      const V0 = volume(ob);
      const sc = new K.THREE.Box3().setFromObject(ob.mesh).getSize(V(0, 0, 0)).x;   // curves sized to the object
      const cv = K.createCurveObject('C', V(0, 0, 0), pts.map(a => V(a[0] * sc, a[1], a[2] * sc)), { closed: cl });
      K.pushHistory(); K.App.mode = 'object'; K.App.selectedObjectIds = new Set([ob.id, cv.id]);
      if (!(await open())) { check(kind + ' + ' + cname + ' ' + mode + ': opens', false); continue; }
      if (mode === 'Split') { chip('Split').click(); await wait(50); }
      await ok();
      const r = meshes(), vt = r.reduce((a, o) => a + volume(o), 0);
      check(kind + ' + ' + cname + ' ' + mode + ': ' + (mode === 'Knife' ? 1 : 2) + ' closed, volume kept',
            r.length === (mode === 'Knife' ? 1 : 2) && r.every(closed) && Math.abs(vt - V0) < 1e-4 * Math.max(1, V0),
            r.length + ' objects, ' + r.map(o => { const w = K.auditWinding(o); return 'b' + w.boundary + ' nm' + w.nonManifold; }).join(' ') + ', vol ' + vt.toFixed(5) + ' vs ' + V0.toFixed(5));
    }
  } catch (e) { fails++; say('ERROR ' + (e && e.stack || e)); }
  say(fails ? 'FAILURES ' + fails : 'ALL GREEN');
  post(out.join('\n'));
})();
