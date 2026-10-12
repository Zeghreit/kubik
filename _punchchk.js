/* v3.12 - Punch, driven through the seat's own entry, real pointer events on
   the canvas, and the bar's own buttons. Run: python3 _cloudprobe.py _punchchk.js
   Asserts the property the op exists for: the right amount of material gone
   (or added), a closed wound shell, one history step, nothing left on Cancel. */
(async function () {
  const out = [];
  // Each line also goes out as progress (/p), so a hang shows where it stopped.
  const say = s => { out.push(s); try { const x = new XMLHttpRequest(); x.open('POST', '/p', true); x.send(s); } catch (e) {} };
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
  // v3.14: one loop per cutter, drawn as segments.
  const outline = () => K.scene.children.find(c => c.isLineSegments && c.renderOrder === 999 &&
                                                   c.material.color.getHex() === 0xffd23d);
  const outVerts = () => outline().geometry.attributes.position.count;

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
    const setSize = (v) => { const sl = document.getElementById('opSlider'); sl.value = v; sl.dispatchEvent(new Event('input', { bubbles: true })); sl.dispatchEvent(new Event('change', { bubbles: true })); };  // v3.13a: the build runs on release
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

    /* ---------------- v3.14: shapes and patterns ---------------- */
    const vis = id => document.getElementById(id).style.display !== 'none';
    const page = () => document.getElementById('opPage');
    const tg = () => document.getElementById('opToggle');
    const seg = () => document.getElementById('opSegValue').textContent;
    const seg2 = () => document.getElementById('opSeg2Value').textContent;
    const closed = w => w.boundary === 0 && w.nonManifold === 0 && w.reversed === 0 && w.conflictEdges === 0;

    /* 14. Rounded square: the button cycles Round -> Square -> Rounded, the
       corner counter reads 30%, the hole takes exactly the profile's area. */
    clear(); aim();
    A = mk('Box', 'cube', { h: 1, v: 1 });
    await openOn(A); await tapAt(0, 0.5, 0); setSize(0.4);
    check('shape: starts Round, unlit', tg().textContent === 'Round' && !tg().classList.contains('active'), tg().textContent);
    tg().click();
    check('shape: Square, lit, sides hidden', tg().textContent === 'Square' && tg().classList.contains('active') && !vis('opSegments2'));
    tg().click();
    check('shape: Rounded shows corner 30%', tg().textContent === 'Rounded' && vis('opSegments2') && seg2() === '╭30%', tg().textContent + ' ' + seg2());
    check('rounded outline: one loop of 20 sides', outVerts() === 40, outVerts());
    ok(); await wait(80);
    R = result(); w = K.auditWinding(R);
    const cr = 0.3 * 0.2;
    const aPoly = 0.16 - 4 * cr * cr * (1 - 2 * Math.sin(Math.PI / 8)), aArc = 0.16 - (4 - Math.PI) * cr * cr;
    check('rounded hole: closed and wound', closed(w), JSON.stringify(w));
    check('rounded hole: volume = 1 - profile area', near(volume(R), 1 - aPoly, 1e-4),
          volume(R).toFixed(6) + ' vs ' + (1 - aPoly).toFixed(6) + ' (true arcs ' + (1 - aArc).toFixed(6) + ')');
    say('rounded hole: ' + JSON.stringify(stats(R)));
    K.undo(); await wait(80);

    /* 15. The pattern page: its own controls, turning it is not a step,
       the bar's Undo walks a pattern change back. */
    clear(); aim();
    let Bar = mk('Bar', 'cube', { h: 1, v: 1, x: 4, y: 1, z: 1 });
    await openOn(Bar); await tapAt(0, 0.5, 0); setSize(0.3);
    const st0 = S().steps.length;
    check('page button says Pattern, unlit', page().textContent === 'Pattern' && !page().classList.contains('active'), page().textContent);
    page().click();
    check('pattern page: Back, One/Line/Ring, X/Y/Z, Mirror', page().textContent === 'Back' && !!chip('opGrouping', 'Ring') &&
          !!chip('opGrouping2', 'X') && tg().textContent === 'Mirror');
    check('pattern page: One and Y lit; counters and Generate hidden', chip('opGrouping', 'One').classList.contains('active') &&
          chip('opGrouping2', 'Y').classList.contains('active') && !vis('opSegments') && !vis('opSegments2') && !vis('opExtraWrap'));
    check('turning the page is not a step', S().steps.length === st0, st0 + ' -> ' + S().steps.length);
    chip('opGrouping', 'Ring').click();
    K.opSetupStepBack();
    check('bar undo takes the pattern back, page stays', S().p.pat === 'one' && page().textContent === 'Back', S().p.pat);
    chip('opGrouping', 'Line').click();
    check('line: count x6 and gap 50% shown', vis('opSegments') && seg() === '×6' && vis('opSegments2') && seg2() === '50%', seg() + ' ' + seg2());
    chip('opGrouping2', 'X').click();
    document.getElementById('opSegMinus').click(); document.getElementById('opSegMinus').click();
    check('line: count 4', S().p.count === 4 && seg() === '×4', seg());

    /* 16. A line of 4 holes along the bar's top: four times one hole. */
    check('line: 4 outline loops', outVerts() === 4 * 12 * 2, outVerts());
    check('line: no "k of N" in the readout', !/ of /.test(readout()), readout());
    say('line preview: ' + readout());
    page().click();
    check('back: the button names the pattern, lit', page().textContent === 'Line ×4 X' && page().classList.contains('active'), page().textContent);
    ok(); await wait(80);
    R = result(); w = K.auditWinding(R);
    check('line holes: closed and wound', closed(w), JSON.stringify(w));
    check('line holes: volume 4 - 4 holes', near(volume(R), 4 - 4 * ngonArea(12, 0.15), 1e-4), volume(R).toFixed(6) + ' vs ' + (4 - 4 * ngonArea(12, 0.15)).toFixed(6));
    say('line holes: ' + JSON.stringify(stats(R)));
    K.undo(); await wait(80);

    /* 17. Copies that run off the ends are counted; Mirror halves the count's ceiling. */
    Bar = K.App.objects[0];
    await openOn(Bar); await tapAt(0, 0.5, 0); setSize(0.3);
    page().click(); chip('opGrouping', 'Line').click(); chip('opGrouping2', 'X').click();
    S().p.gap = 50; K.refreshOpSetupMesh();      // 500%: copies at +-0.9, +-2.7, +-4.5 on a bar 4 long
    check('line off the ends: "2 of 6"', /^2 of 6 · /.test(readout()), readout());
    check('line off the ends: 2 loops', outVerts() === 2 * 12 * 2, outVerts());
    S().p.gap = 5; S().p.count = 20;
    tg().click();                                // Mirror on
    check('mirror clamps the count to 12', S().p.mirror && S().p.count === 12 && seg() === '×12', S().p.count + ' ' + seg());
    cancel(); await wait(50);

    /* 18. A ring of dents on a 12-sided can is six times one dent (60 degrees
       is a symmetry of the 12-gon, so every copy lands on an equal spot).
       N-gon: Quads rebuilds the band on a faceted wall as if it were round,
       which moves the volume (measured: one dent 0.00426 against 0.0018) -
       this checks where the copies land, not that. */
    clear(); aim();
    const Can = mk('Can12', 'cylinder', { h: 12, v: 1 });
    const V0 = volume(Can);
    const onWall = [0.47 * Math.cos(-0.3), 0.1, 0.47 * Math.sin(-0.3)];
    await openOn(Can); await tapAt(onWall[0], onWall[1], onWall[2]); setSize(0.2);
    chip('opGrouping', 'Dent').click(); chip('opGrouping2', 'N-gon').click();
    ok(); await wait(80);
    const V1 = volume(result());
    K.undo(); await wait(80);
    await openOn(K.App.objects[0]); await tapAt(onWall[0], onWall[1], onWall[2]); setSize(0.2);
    chip('opGrouping', 'Dent').click(); chip('opGrouping2', 'N-gon').click();
    page().click(); chip('opGrouping', 'Ring').click();
    check('ring of dents: 6 loops', outVerts() === 6 * 12 * 2, outVerts());
    ok(); await wait(80);
    R = result(); w = K.auditWinding(R);
    check('ring of dents: closed and wound, one shell', closed(w) && (w.shells == null || w.shells === 1), JSON.stringify(w));
    check('ring of dents: volume V0 - 6 dents', near(volume(R), V0 - 6 * (V0 - V1), 1e-4),
          volume(R).toFixed(6) + ' vs ' + (V0 - 6 * (V0 - V1)).toFixed(6) + ' (one dent ' + (V0 - V1).toFixed(6) + ')');
    K.undo(); await wait(80);

    /* 18b. v3.14a: Quads on the faceted wall may not move volume. One boss on
       the default 12-sided can used to come back LOSING volume (-0.0029 against
       N-gon's +0.0018): the band's quads chorded the 30 degree fold. */
    for (const kind of ['Boss', 'Dent']) {
      const d = {};
      for (const topo of ['N-gon', 'Quads']) {
        await openOn(K.App.objects[0]); await tapAt(onWall[0], onWall[1], onWall[2]); setSize(0.2);
        chip('opGrouping', kind).click(); chip('opGrouping2', topo).click();
        ok(); await wait(80);
        d[topo] = volume(result()) - V0;
        K.undo(); await wait(80);
      }
      check('quads on a faceted wall: ' + kind.toLowerCase() + ' volume as N-gon', Math.abs(d.Quads - d['N-gon']) <= 0.03 * Math.abs(d['N-gon']),
            d.Quads.toFixed(6) + ' vs ' + d['N-gon'].toFixed(6));
    }

    /* 19. INFO, a known limit: 6 through-holes round the SOLID can cross
       inside it; the weld and heal after the CSG can open that. */
    await openOn(K.App.objects[0]); await tapAt(onWall[0], onWall[1], onWall[2]); setSize(0.2);
    page().click(); chip('opGrouping', 'Ring').click();
    say('INFO ring of 6 holes through a solid can: ' + (outVerts() / 24) + ' cutters, ' + JSON.stringify(K.auditWinding(K.App.objects.find(o => o.id === S().objId))));
    cancel(); await wait(50);

    /* 19b. A ring of 4 holes round a box, tapped a little off the middle:
       each far copy lies beside the near bore (0.3 of the size), so it is
       dropped - 2 cutters, 4 openings, one closed shell. */
    clear(); aim();
    A = mk('Box', 'cube', { h: 1, v: 1 });
    await openOn(A); await tapAt(0.5, 0.05, 0.03); setSize(0.2);
    check('box ring: tapped the +X side', near(S().p.nx, 1, 1e-6), [S().p.nx, S().p.ny, S().p.nz].join(','));
    page().click(); chip('opGrouping', 'Ring').click();
    document.getElementById('opSegMinus').click(); document.getElementById('opSegMinus').click();
    check('box ring of 4 holes: far copies dropped, 2 loops', S().p.count === 4 && outVerts() === 2 * 12 * 2, outVerts());
    check('box ring of 4 holes: no "k of N"', !/ of /.test(readout()), readout());
    ok(); await wait(80);
    R = result(); w = K.auditWinding(R);
    check('box ring of 4 holes: closed and wound, one shell', closed(w) && (w.shells == null || w.shells === 1), JSON.stringify(w));
    say('box ring of 4 holes: ' + JSON.stringify(stats(R)) + ' vol ' + volume(R).toFixed(5));
    K.undo(); await wait(80);

    /* back to the can for 20 */
    clear(); aim();
    mk('Can12', 'cylinder', { h: 12, v: 1 });

    /* 20. A ring tapped on its own axis: only the one, and the readout says why. */
    await openOn(K.App.objects[0]); await tapAt(0, 0.5, 0);
    page().click(); chip('opGrouping', 'Ring').click();
    check('ring on the axis: "1 of 6 (on the axis)"', /^1 of 6 \(on the axis\) · /.test(readout()), readout());
    cancel(); await wait(50);

    /* 21. Mirror X on the bar: a pair of dents, the result symmetric across
       the middle (N-gon, so no new points are placed by the topology). */
    clear(); aim();
    Bar = mk('Bar', 'cube', { h: 1, v: 1, x: 4, y: 1, z: 1 });
    await openOn(Bar); await tapAt(1.0, 0.5, 0.2); setSize(0.3);
    chip('opGrouping', 'Dent').click(); chip('opGrouping2', 'N-gon').click();
    page().click(); tg().click(); chip('opGrouping2', 'X').click();
    check('mirror: 2 loops', outVerts() === 2 * 12 * 2, outVerts());
    page().click();
    check('mirror: the button says Mirror X', page().textContent === 'Mirror X', page().textContent);
    ok(); await wait(80);
    R = result(); w = K.auditWinding(R);
    check('mirror dents: closed and wound', closed(w), JSON.stringify(w));
    check('mirror dents: volume 4 - 2 dents', near(volume(R), 4 - 2 * ngonArea(12, 0.15) * 0.09, 1e-4), volume(R).toFixed(6));
    const pts = []; {
      const ed = K.toEditable(R.mesh), P = ed.positions, v = new K.THREE.Vector3();
      for (let i = 0; i < P.length; i += 3) pts.push(v.fromArray(P, i).applyMatrix4(R.mesh.matrixWorld).clone());
    }
    const unmatched = pts.filter(a => !pts.some(b => Math.abs(a.x + b.x) < 1e-4 && Math.abs(a.y - b.y) < 1e-4 && Math.abs(a.z - b.z) < 1e-4)).length;
    check('mirror dents: every point has its mirror across x = 0', unmatched === 0, unmatched + ' of ' + pts.length + ' unmatched');

    /* 22. A line round a FACETED wall stops where the axis points out of it
       (found in a visual check: on a 24-sided can it rocked across that
       facet and stacked copies). 9 along X from 34 degrees: 1 fits before
       0 degrees, 4 the other way. The gap along the surface is the promised
       0.225 (1.5 x 0.15), about 25.8 degrees of a 0.5 radius. */
    clear(); aim();
    const Can24 = mk('Can24', 'cylinder', { h: 24, v: 1 });
    await openOn(Can24);
    Object.assign(S().p, { px: 0.5 * Math.cos(0.6), py: 0.2, pz: 0.5 * Math.sin(0.6), nx: Math.cos(0.6), ny: 0, nz: Math.sin(0.6),
                           ux: 0, uy: 1, uz: 0, size: 0.15, kind: 'dent', pat: 'line', axis: 'x', count: 9 });
    K.refreshOpSetupMesh();
    const angs = S().copiesMemo.val.list.map(f => Math.atan2(f.pz, f.px) * 180 / Math.PI).sort((a, b) => a - b);
    const gaps = angs.slice(1).map((a, i) => a - angs[i]);
    check('faceted line: "6 of 9"', /^6 of 9 · /.test(readout()), readout());
    check('faceted line: evenly spaced along the wall', gaps.every(g => Math.abs(g - 25.8) < 1.5), angs.map(a => a.toFixed(1)).join(' '));

    /* 23. The readout says what the preview's own audit says, before OK
       (fable: Ring x6 of bosses on the default 12-sided can, Quads, came back
       open and only OK said so). Asserted as agreement, so it stays true
       whether the pipeline opens this case or one day closes it. */
    cancel(); await wait(50);
    /* The fixture has to BE open, or this passes on "no open edges, none
       said" (it did, the first time, on a can that closed): 4 holes through
       one face in N-gon was it until v3.14a closed it; now a ring of 8 holes
       through the solid can tapped 9 degrees off a facet's middle, whose bores
       cross inside it (the residue of known limit 2, _crosschk -9/8). */
    clear(); aim();
    Bar = mk('Can12', 'cylinder', { h: 12, v: 1 });
    await openOn(Bar);
    { const fa = -15 * Math.PI / 180, th = -9 * Math.PI / 180, r = 0.5 * Math.cos(15 * Math.PI / 180) / Math.cos(th - fa);
      Object.assign(S().p, { px: r * Math.cos(th), py: 0.1, pz: r * Math.sin(th), nx: Math.cos(fa), ny: 0, nz: Math.sin(fa), ux: 0, uy: 1, uz: 0,
                             size: 0.2, topo: 'ngon', pat: 'ring', axis: 'y', count: 8 }); }
    K.refreshOpSetupMesh();
    { const wp = K.auditWinding(K.App.objects.find(o => o.id === S().objId));
      const said = /^(\d+) open edges?[^·]* · /.exec(readout());
      check('the fixture is open (known limit 2)', wp.boundary > 0, 'audit ' + wp.boundary);
      check('readout says the preview\'s open edges, first', !!said && +said[1] === wp.boundary, 'audit ' + wp.boundary + ' / readout "' + readout() + '"');
      chip('opGrouping2', 'Quads').click();
      const wq = K.auditWinding(K.App.objects.find(o => o.id === S().objId));
      const saidQ = /^(\d+) open edges?[^·]* · /.exec(readout());
      check('...and in Quads still agrees with the audit', wq.boundary === 0 ? !saidQ : !!saidQ && +saidQ[1] === wq.boundary, 'audit ' + wq.boundary + ' / "' + readout() + '"'); }
    cancel(); await wait(50);

    /* 24. A pattern with no cutter on the object is refused, not committed
       unchanged (fable: a narrow bar, an even line whose half-steps both run off). */
    clear(); aim();
    const Narrow = mk('Narrow', 'cube', { h: 1, v: 1, x: 0.2, y: 1, z: 1 });
    await openOn(Narrow);
    Object.assign(S().p, { px: 0, py: 0.5, pz: 0, nx: 0, ny: 1, nz: 0, ux: 1, uy: 0, uz: 0, size: 0.15 });
    K.refreshOpSetupMesh();
    /* From a layout Generate found, so a reset shows (review: the refused
       build had wiped it - "var 0", and the bar's Undo swapped it for var 1). */
    document.getElementById('opExtra').click();
    const seed0 = S().p.seed, hash0 = S().topoInfo && S().topoInfo.hash, rd0 = readout();
    check('narrow bar: Generate found another layout first', seed0 > 0, 'seed ' + seed0 + ' "' + rd0 + '"');
    page().click(); chip('opGrouping', 'Line').click();   // 6 along X: the first half-step, 0.11, is past the 0.1 half-width
    check('no cutter lands: refused, the settings go back', S().p.pat === 'one' && S().built.pat === 'one', S().p.pat);
    check('...the layout and its readout stay', S().p.seed === seed0 && readout() === rd0, 'seed ' + S().p.seed + ' "' + readout() + '"');
    K.opSetupStepBack();
    check('...and Undo of the refused step keeps the layout', !!S().topoInfo && S().topoInfo.hash === hash0 && S().p.seed === seed0, 'seed ' + S().p.seed);
    cancel(); await wait(50);

    /* 25. Ring of 8 round a box from the middle of +X: the 45° copies aim at
       the edges and are not stood there (fable: grooves, open edges). */
    clear(); aim();
    const Box8 = mk('Box', 'cube', { h: 1, v: 1 });
    await openOn(Box8);
    Object.assign(S().p, { px: 0.5, py: 0, pz: 0, nx: 1, ny: 0, nz: 0, ux: 0, uy: 1, uz: 0, size: 0.2, kind: 'dent', pat: 'ring', count: 8 });
    K.refreshOpSetupMesh();
    check('ring of 8 round a box: the 4 on the faces only', /^4 of 8 · /.test(readout()) && S().copiesMemo.val.list.length === 4, readout());
    w = K.auditWinding(K.App.objects.find(o => o.id === S().objId));
    check('ring of 8 round a box: closed', closed(w), JSON.stringify(w));
    cancel(); await wait(50);

    /* 26. Near a sphere's pole a ring is one cutter, and the readout says so. */
    clear(); aim();
    const Ball = mk('Ball', 'sphere', { h: 16, v: 8 });
    await openOn(Ball);
    Object.assign(S().p, { px: 0.02, py: Math.sqrt(0.25 - 0.0004), pz: 0, nx: 0.04, ny: Math.sqrt(1 - 0.0016), nz: 0,
                           ux: 1, uy: 0, uz: 0, size: 0.2, kind: 'dent', pat: 'ring', count: 6 });
    K.refreshOpSetupMesh();
    check('ring at the pole: "1 of 6 (overlap)"', /^1 of 6 \(overlap\) · /.test(readout()), readout());
    cancel(); await wait(50);
  } catch (e) {
    say('ERROR=' + (e && e.stack ? e.stack.split('\n').slice(0, 6).join(' / ') : e));
    fails++;
  }
  say(fails ? 'FAILURES ' + fails : 'ALL GREEN');
  post(out.join('\n'));
})();
