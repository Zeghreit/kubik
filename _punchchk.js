/* v3.12 - Punch, driven through the seat's own entry, real pointer events on
   the canvas, and the bar's own buttons. Run: python3 _cloudprobe.py _punchchk.js
   Asserts the property the op exists for: the right amount of material gone
   (or added), a closed wound shell, one history step, nothing left on Cancel. */
(async function () {
  const out = [];
  const say = s => out.push(s);
  let K;
  const post = b => { try { const x = new XMLHttpRequest(); x.open('POST', '/result', true); x.send(b); } catch (e) {} };
  const wait = ms => new Promise(r => setTimeout(r, ms));
  let fails = 0;
  const check = (name, ok, note) => { if (!ok) fails++; say((ok ? 'PASS ' : 'FAIL ') + name + (note != null ? '  ' + note : '')); };
  const S = () => K.App.opSetup;
  const chip = (row, label) => Array.from(document.querySelectorAll('#' + row + ' button')).find(b => b.textContent === label);
  const readout = () => document.getElementById('opReadout').textContent;

  function mk(name, kind, params) {
    const ed = K.buildPrimitiveEditable(kind, params || {});
    const mats = K.makeMaterialSet(ed.groups.length || 1, 0x9aa3b2);
    const o = K.createObjectFromEditable(name, new K.THREE.Vector3(0, 0, 0), ed, mats, {});
    K.pushHistory();   // so an Undo after a punch lands on THIS scene
    return o;
  }
  const clear = () => {
    if (S()) K.finishOpSetup(false);
    K.App.objects.slice().forEach(o => { try { o.mesh.parent.remove(o.mesh); } catch (e) {} });
    K.App.objects.length = 0;
    K.App.hidden.clear();
  };
  // Closed-shell volume in WORLD units, by the divergence theorem.
  function volume(o) {
    const ed = K.toEditable(o.mesh), P = ed.positions, m = o.mesh.matrixWorld;
    const a = new K.THREE.Vector3(), b = new K.THREE.Vector3(), c = new K.THREE.Vector3();
    let v = 0;
    ed.groups.forEach(g => g.triangles.forEach(t => {
      a.fromArray(P, t[0] * 3).applyMatrix4(m); b.fromArray(P, t[1] * 3).applyMatrix4(m); c.fromArray(P, t[2] * 3).applyMatrix4(m);
      v += a.dot(b.clone().cross(c)) / 6;
    }));
    return v;
  }
  function stats(o) {
    const ed = K.toEditable(o.mesh), c = { q: 0, t: 0, n: 0 };
    ed.groups.forEach(g => { const k = g.triangles.length + 2; if (k === 3) c.t++; else if (k === 4) c.q++; else c.n++; });
    return { faces: ed.groups.length, quads: c.q, tris: c.t, ngons: c.n };
  }
  const ngonArea = (n, r) => 0.5 * n * r * r * Math.sin(2 * Math.PI / n);
  const near = (a, b, tol) => Math.abs(a - b) <= tol * Math.max(1, Math.abs(b));
  const outline = () => K.scene.children.find(c => c.isLineLoop && c.renderOrder === 999);

  function aim() {
    K.camera.position.set(1.6, 2.6, 2.2);
    K.orbit.target.set(0, 0, 0);
    K.camera.lookAt(0, 0, 0);
    K.orbit.update();
    K.camera.updateMatrixWorld(true);
  }
  function screenOf(x, y, z) {
    const v = new K.THREE.Vector3(x, y, z).project(K.camera);
    const r = K.renderer.domElement.getBoundingClientRect();
    return { x: r.left + (v.x + 1) / 2 * r.width, y: r.top + (1 - v.y) / 2 * r.height };
  }
  let pid = 40;
  function ptr(type, p, id) {
    const ev = new PointerEvent(type, { bubbles: true, cancelable: true, clientX: p.x, clientY: p.y,
      pointerId: id, pointerType: 'mouse', button: 0, buttons: type === 'pointerup' ? 0 : 1, isPrimary: true });
    K.renderer.domElement.dispatchEvent(ev);
  }
  async function tapAt(x, y, z) {
    const p = screenOf(x, y, z), id = ++pid;
    ptr('pointerdown', p, id); await wait(30); ptr('pointerup', p, id); await wait(60);
  }
  async function dragAt(from, dx) {
    const p = screenOf(from[0], from[1], from[2]), id = ++pid;
    ptr('pointerdown', p, id); await wait(30);
    for (let i = 1; i <= 6; i++) { ptr('pointermove', { x: p.x + dx * i / 6, y: p.y }, id); await wait(16); }
    ptr('pointerup', { x: p.x + dx, y: p.y }, id); await wait(60);
  }
  async function openOn(o) {
    K.setMode && K.setMode('object');
    K.App.selectedObjectIds = new Set([o.id]);
    K.App.activeObjectId = null;
    K.punchSelection();
    for (let i = 0; i < 400 && !S(); i++) await wait(25);
    return !!S();
  }
  const histLen = () => K.App.historyIndex;
  const ok = () => document.getElementById('opOk').click();
  const cancel = () => document.getElementById('opCancel').click();
  const result = () => K.App.objects.find(o => K.App.selectedObjectIds.has(o.id));

  try {
    while (!(window.__kubik && window.__kubik.App)) await wait(50);
    await wait(1500);
    K = window.__kubik;

    /* 1. Opens on one cube, Quads lit, outline drawn, target hidden. */
    clear(); aim();
    let A = mk('Box', 'cube', { h: 1, v: 1 });
    check('refused for two objects', (() => { const B = mk('B2', 'cube', {}); K.App.selectedObjectIds = new Set([A.id, B.id]); K.punchSelection(); const r = !S(); K.App.objects.splice(K.App.objects.indexOf(B), 1); B.mesh.parent.remove(B.mesh); K.pushHistory(); return r; })());
    check('bar opens', await openOn(A));
    check('Hole/Dent/Boss chips', !!chip('opGrouping', 'Hole') && !!chip('opGrouping', 'Dent') && !!chip('opGrouping', 'Boss'));
    check('Quads lit by default', chip('opGrouping2', 'Quads') && chip('opGrouping2', 'Quads').classList.contains('active'));
    check('outline shown', outline() && outline().visible);
    check('target hidden under the preview', K.App.hidden.has(A.id));
    check('depth stepper hidden for a hole', document.getElementById('opSegments').style.display === 'none');
    check('sides stepper shows 12', document.getElementById('opSegments2').style.display !== 'none' && document.getElementById('opSeg2Value').textContent === '12');

    /* 2. A tap on the top face moves the cutter there, normal +Y. */
    await tapAt(0.15, 0.5, -0.1);
    const p = S().p;
    check('tap placed on top face', near(p.py, 0.5, 1e-4) && near(p.ny, 1, 1e-6), [p.px, p.py, p.pz, p.nx, p.ny, p.nz].map(v => v.toFixed(3)).join(','));
    check('tap x/z where aimed', Math.abs(p.px - 0.15) < 0.01 && Math.abs(p.pz + 0.1) < 0.01);
    /* 3. A press off the object is the camera's. */
    const before = JSON.stringify(S().p);
    await tapAt(3, 3, 3);
    check('press off the object leaves the cutter', JSON.stringify(S().p) === before);

    /* 4. Size by a drag; the slider follows. */
    S().p.size = 0.3; K.refreshOpSetupMesh && K.refreshOpSetupMesh();
    await dragAt([0.15, 0.5, -0.1], 50);
    const sz = S().p.size;
    check('drag changed the size', Math.abs(sz - 0.3) > 0.02, sz);
    check('slider shows the size', Math.abs(Number(document.getElementById('opSlider').value) - sz) < 1e-3, document.getElementById('opSlider').value);
    check('label says size', /size/.test(document.getElementById('opLabel').textContent), document.getElementById('opLabel').textContent);
    // pin a known size for the volume checks, through the slider's own path
    const setSize = (v) => { const sl = document.getElementById('opSlider'); sl.value = v; sl.dispatchEvent(new Event('input', { bubbles: true })); };
    setSize(0.4);
    check('slider input sets size', near(S().p.size, 0.4, 1e-3), S().p.size);
    say('hole preview: ' + readout());

    /* 5. Hole through the box: volume 1 - area * 1. */
    const h0 = histLen();
    const r12 = 0.2;
    ok(); await wait(80);
    let R = result();
    let w = K.auditWinding(R), st = stats(R), vol = volume(R);
    const exp = 1 - ngonArea(12, r12) * 1;
    check('hole: committed closed and wound', w.boundary === 0 && w.nonManifold === 0 && w.reversed === 0 && w.conflictEdges === 0, JSON.stringify(w));
    check('hole: volume', near(vol, exp, 2e-3), vol.toFixed(5) + ' vs ' + exp.toFixed(5));
    check('hole: one object left', K.App.objects.length === 1, K.App.objects.map(o => o.name).join(','));
    check('hole: outline gone', !outline().visible);
    say('hole: ' + JSON.stringify(st));
    check('hole: mostly quads', st.quads >= st.tris + st.ngons, JSON.stringify(st));
    check('hole: one history step', histLen() === h0 + 1 || h0 < 0, h0 + ' -> ' + histLen());
    K.undo(); await wait(80);
    check('undo gives the box back', K.App.objects.length === 1 && near(volume(K.App.objects[0]), 1, 1e-6) && K.App.objects[0].name === 'Box', K.App.objects.map(o => o.name).join(','));

    /* 6. Dent, depth 3 (30% of 0.4 = 0.12): volume 1 - area * 0.12. */
    A = K.App.objects[0];
    await openOn(A); await tapAt(0, 0.5, 0); setSize(0.4);
    chip('opGrouping', 'Dent').click();
    check('dent: depth stepper shown as 30%', document.getElementById('opSegments').style.display !== 'none' && document.getElementById('opSegValue').textContent === '30%', document.getElementById('opSegValue').textContent);
    say('dent preview: ' + readout());
    ok(); await wait(80);
    R = result(); w = K.auditWinding(R); vol = volume(R);
    check('dent: closed and wound', w.boundary === 0 && w.nonManifold === 0 && w.reversed === 0 && w.conflictEdges === 0, JSON.stringify(w));
    check('dent: volume', near(vol, 1 - ngonArea(12, 0.2) * 0.12, 2e-3), vol.toFixed(5));
    say('dent: ' + JSON.stringify(stats(R)));
    K.undo(); await wait(80);

    /* 7. Boss, depth 5 (0.2 high), square: volume 1 + 0.4^2 * 0.2. */
    A = K.App.objects[0];
    await openOn(A); await tapAt(0, 0.5, 0); setSize(0.4);
    chip('opGrouping', 'Boss').click();
    document.getElementById('opToggle').click();
    check('boss: square hides the sides stepper', document.getElementById('opSegments2').style.display === 'none');
    document.getElementById('opSegPlus').click(); document.getElementById('opSegPlus').click();
    check('boss: depth 50%', document.getElementById('opSegValue').textContent === '50%', document.getElementById('opSegValue').textContent);
    say('boss preview: ' + readout());
    ok(); await wait(80);
    R = result(); w = K.auditWinding(R); vol = volume(R); st = stats(R);
    check('boss: closed and wound', w.boundary === 0 && w.nonManifold === 0 && w.reversed === 0 && w.conflictEdges === 0, JSON.stringify(w));
    check('boss: volume', near(vol, 1 + 0.16 * 0.2, 2e-3), vol.toFixed(5));
    check('boss: square sits square (bbox 1 x 1.2 x 1)', (() => { const b = new K.THREE.Box3().setFromObject(R.mesh), s3 = b.getSize(new K.THREE.Vector3()); return near(s3.x, 1, 1e-4) && near(s3.y, 1.2, 1e-4) && near(s3.z, 1, 1e-4); })());
    say('boss: ' + JSON.stringify(st));
    K.undo(); await wait(80);

    /* 8. Cancel leaves nothing: same object, visible, no history step. */
    A = K.App.objects[0];
    const h1 = histLen();
    await openOn(A); await tapAt(0.1, 0.5, 0.1);
    cancel(); await wait(80);
    check('cancel: the box is back, alone and visible', K.App.objects.length === 1 && K.App.objects[0] === A && !K.App.hidden.has(A.id) && near(volume(A), 1, 1e-6));
    check('cancel: no history step', histLen() === h1);
    check('cancel: outline gone', !outline().visible);

    /* 9. Undo inside the bar walks back a re-placement. */
    await openOn(A); await tapAt(0.2, 0.5, 0.2);
    const pA = S().p.px;
    await tapAt(-0.2, 0.5, -0.2);
    K.opSetupStepBack();
    check('bar undo takes the cutter back', near(S().p.px, pA, 1e-9), S().p.px + ' vs ' + pA);
    /* 10. Generate on a punch. */
    const hs = new Set([S().topoInfo && S().topoInfo.hash]);
    for (let i = 0; i < 3; i++) { document.getElementById('opExtra').click(); hs.add(S().topoInfo && S().topoInfo.hash); }
    say('generate: ' + hs.size + ' layouts, ' + readout());
    check('generate keeps a valid layout', !!S().topoInfo);
    cancel(); await wait(50);

    /* 11. A side wall: tap on +X face, hole goes through along X. */
    await openOn(A); await tapAt(0.5, 0.1, 0.1);
    check('side tap: normal +X', near(S().p.nx, 1, 1e-6), [S().p.nx, S().p.ny, S().p.nz].join(','));
    setSize(0.3);
    ok(); await wait(80);
    R = result(); w = K.auditWinding(R);
    check('side hole: closed and wound', w.boundary === 0 && w.nonManifold === 0 && w.reversed === 0, JSON.stringify(w));
    check('side hole: volume', near(volume(R), 1 - ngonArea(12, 0.15), 2e-3), volume(R).toFixed(5));
    K.undo(); await wait(80);

    /* 12. A cylinder: hole across its round wall (the case loose end 16 names). */
    clear(); aim();
    const C = mk('Can', 'cylinder', { h: 16, v: 1 });
    await openOn(C);
    const t0 = performance.now();
    await tapAt(0.5 * Math.cos(-0.3), 0.1, 0.5 * Math.sin(-0.3));
    setSize(0.25);
    const ms = performance.now() - t0;
    say('cylinder preview ' + ms.toFixed(0) + ' ms: ' + readout());
    ok(); await wait(80);
    R = result(); w = K.auditWinding(R);
    check('cylinder hole: closed and wound', w.boundary === 0 && w.nonManifold === 0 && w.reversed === 0, JSON.stringify(w));
    say('cylinder hole: ' + JSON.stringify(stats(R)) + ' vol ' + volume(R).toFixed(5));

    /* 13. A sphere, boss on its curved top: base must meet the surface all round. */
    clear(); aim();
    const P = mk('Ball', 'sphere', { h: 16, v: 8 });
    await openOn(P); await tapAt(0, 0.5, 0); setSize(0.3);
    chip('opGrouping', 'Boss').click();
    ok(); await wait(80);
    R = result(); w = K.auditWinding(R);
    check('sphere boss: closed and wound, one shell', w.boundary === 0 && w.nonManifold === 0 && w.reversed === 0 && (w.shells == null || w.shells === 1), JSON.stringify(w));
    say('sphere boss: ' + JSON.stringify(stats(R)));
  } catch (e) {
    say('ERROR=' + (e && e.stack ? e.stack.split('\n').slice(0, 6).join(' / ') : e));
    fails++;
  }
  say(fails ? 'FAILURES ' + fails : 'ALL GREEN');
  post(out.join('\n'));
})();
