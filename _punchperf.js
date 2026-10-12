/* v3.13a - Punch on a phone: the heal cycle, the relax budget and the slider.
   Run: python3 _cloudprobe.py _punchperf.js out.txt */
(async function () {
  const out = [];
  const say = s => { out.push(s); try { const x = new XMLHttpRequest(); x.open('POST', '/p', false); x.send(s); } catch (e) {} };
  let K, fails = 0;
  const check = (n, ok, note) => { if (!ok) fails++; say((ok ? 'PASS ' : 'FAIL ') + n + (note != null ? '  ' + note : '')); };
  const post = b => { try { const x = new XMLHttpRequest(); x.open('POST', '/result', true); x.send(b); } catch (e) {} };
  const wait = ms => new Promise(r => setTimeout(r, ms));
  const S = () => K.App.opSetup;
  function mk(kind, params) {
    const ed = K.buildPrimitiveEditable(kind, params || {});
    const o = K.createObjectFromEditable('T', new K.THREE.Vector3(0, 0, 0), ed, K.makeMaterialSet(ed.groups.length || 1, 0x9aa3b2), {});
    K.pushHistory(); return o;
  }
  const clear = () => {
    if (S()) K.finishOpSetup(false);
    K.App.objects.slice().forEach(o => { try { o.mesh.parent.remove(o.mesh); } catch (e) {} });
    K.App.objects.length = 0;
  };
  async function openOn(o) {
    K.setMode && K.setMode('object');
    K.App.selectedObjectIds = new Set([o.id]); K.App.activeObjectId = null;
    K.punchSelection();
    for (let i = 0; i < 400 && !S(); i++) await wait(25);
    return !!S();
  }
  // Open edges of the preview mesh, welded the way the volume test reads it.
  function openEdges(o) {
    const ed = K.toEditable(o.mesh), P = ed.positions, key = i => [P[i*3], P[i*3+1], P[i*3+2]].map(x => Math.round(x * 1e4)).join(',');
    const m = new Map();
    ed.groups.forEach(g => g.triangles.forEach(t => {
      for (let e = 0; e < 3; e++) { const a = key(t[e]), b = key(t[(e + 1) % 3]); if (a === b) continue; const k = a < b ? a + '|' + b : b + '|' + a; m.set(k, (m.get(k) || 0) + 1); }
    }));
    let n = 0; m.forEach(v => { if (v % 2) n++; }); return n;
  }
  const preview = () => K.App.objects.find(o => o.id === S().objId);
  try {
    while (!(window.__kubik && window.__kubik.App)) await wait(50);
    await wait(1500);
    K = window.__kubik;
    K.camera.position.set(1.6, 2.6, 2.2); K.orbit.target.set(0, 0, 0); K.orbit.update();

    clear();
    const o = mk('sphere', { h: 48, v: 32 });
    check('bar opens', await openOn(o));
    S().p.topo = 'quads';

    // 1. The size that hung.
    S().p.size = 0.636;
    let a = performance.now(); K.refreshOpSetupMesh();
    const t636 = performance.now() - a;
    check('0.636 builds fast', t636 < 2000, t636.toFixed(0) + 'ms');
    { const w = K.auditWinding(preview()); say('INFO 0.636 shell ' + JSON.stringify(w)); }   // known open: CSG on dense curved targets (loose end)

    // 2. A sweep, as a slider would pass through it.
    let worst = 0, wsz = 0, opens = 0, nb = 0; const bad = [], slow = [];
    for (let sz = 0.3; sz <= 1.2; sz += 0.006) {
      S().p.size = +sz.toFixed(3);
      a = performance.now(); K.refreshOpSetupMesh(); const d = performance.now() - a;
      nb++;
      if (d > worst) { worst = d; wsz = S().p.size; }
      const w = K.auditWinding(preview());
      if (w.boundary || w.nonManifold || w.reversed) { opens++; bad.push(S().p.size + ':' + w.boundary + '/' + w.nonManifold + '/' + w.reversed); }
      if (d > 1500) slow.push(S().p.size + ':' + d.toFixed(0));
    }
    check('sweep: no slow build', worst < 4000, nb + ' builds, worst ' + worst.toFixed(0) + 'ms at ' + wsz);
    say('INFO sweep: open in ' + opens + ' of ' + nb);   // known, see CURRENT_STATE v3.13a
    say('slow: ' + slow.join(' '));

    // 3. A finger on the slider: 30 moves, then the lift.
    const sl = document.getElementById('opSlider'), lo = +sl.min, hi = +sl.max;
    sl.dispatchEvent(new Event('pointerdown', { bubbles: true }));
    const before = S().p.size;
    let busy = 0, last = 0;
    for (let i = 0; i < 30; i++) {
      sl.value = lo + (hi - lo) * (0.2 + 0.4 * i / 30); last = +sl.value;
      a = performance.now(); sl.dispatchEvent(new Event('input', { bubbles: true })); busy += performance.now() - a;
      await wait(16);
    }
    check('drag: moves are cheap', busy < 100, busy.toFixed(1) + 'ms for 30');
    check('drag: no build while moving', S().p.size === before);
    check('drag: value box follows', Math.abs(+document.getElementById('opValue').value - last) < 1e-3);
    a = performance.now();
    sl.dispatchEvent(new Event('change', { bubbles: true }));
    sl.dispatchEvent(new Event('pointerup', { bubbles: true }));
    check('lift: one build at the last size', Math.abs(S().p.size - last) < 1e-6 && S().built.size === S().p.size,
          'size=' + S().p.size + ' last=' + last + ' ' + (performance.now() - a).toFixed(0) + 'ms');
    // 4. OK while the slider is still live commits the number on screen.
    sl.value = lo + (hi - lo) * 0.3; sl.dispatchEvent(new Event('input', { bubbles: true }));
    const want = S().sliderLive, hist = K.App.historyIndex;
    document.getElementById('opOk').click(); await wait(100);
    check('OK mid-drag keeps the live size', !S() && K.App.historyIndex === hist + 1, 'live=' + want);

    /* 5. v3.14: the most a pattern makes - 24 cutters - and the slider with
       24 copies to place on every move. Desktop CPU; a phone is a few times slower. */
    const time = (f) => { const t = performance.now(); f(); return performance.now() - t; };
    const shell = () => { const w = K.auditWinding(preview()); return 'shells ' + w.shells + ' boundary ' + w.boundary + ' nm ' + w.nonManifold; };
    clear();
    const bar = K.createObjectFromEditable('Bar', new K.THREE.Vector3(0, 0, 0),
      K.buildPrimitiveEditable('cube', { h: 1, v: 1, x: 8, y: 1, z: 1 }), K.makeMaterialSet(6, 0x9aa3b2), {});
    K.pushHistory();
    check('bar opens', await openOn(bar));
    Object.assign(S().p, { px: 0, py: 0.5, pz: 0, nx: 0, ny: 1, nz: 0, ux: 1, uy: 0, uz: 0, size: 0.2, pat: 'line', axis: 'x', count: 24, gap: 5 });
    for (const topo of ['ngon', 'quads']) {
      S().p.topo = topo;
      const d = time(() => K.refreshOpSetupMesh());
      check('line x24 holes, ' + topo + ': builds', d < 8000, d.toFixed(0) + 'ms, ' + S().copiesMemo.val.list.length + ' cutters, ' + shell());
    }
    clear();
    const can = mk('cylinder', { h: 48, v: 1 });
    check('can opens', await openOn(can));
    Object.assign(S().p, { px: 0.5, py: 0.25, pz: 0, nx: 1, ny: 0, nz: 0, ux: 0, uy: 1, uz: 0, size: 0.1, kind: 'dent',
                           pat: 'ring', axis: 'y', count: 12, mirror: true });
    for (const topo of ['ngon', 'quads']) {
      S().p.topo = topo;
      const d = time(() => K.refreshOpSetupMesh());
      check('ring x12 + mirror (24 dents), ' + topo + ': builds', d < 8000, d.toFixed(0) + 'ms, ' + S().copiesMemo.val.list.length + ' cutters, ' + shell());
    }
    clear();
    const ball = mk('sphere', { h: 48, v: 32 });
    check('sphere opens', await openOn(ball));
    Object.assign(S().p, { size: 0.15, pat: 'ring', axis: 'y', count: 24, kind: 'dent' });
    K.refreshOpSetupMesh();
    const sl2 = document.getElementById('opSlider'), lo2 = +sl2.min, hi2 = +sl2.max;
    sl2.dispatchEvent(new Event('pointerdown', { bubbles: true }));
    let busy2 = 0;
    for (let i = 0; i < 30; i++) {
      sl2.value = lo2 + (hi2 - lo2) * (0.05 + 0.1 * i / 30);
      const a2 = performance.now(); sl2.dispatchEvent(new Event('input', { bubbles: true })); busy2 += performance.now() - a2;
      await wait(16);
    }
    check('drag with 24 copies on a 48x32 sphere: moves stay cheap', busy2 < 300, busy2.toFixed(1) + 'ms for 30');
    sl2.dispatchEvent(new Event('change', { bubbles: true }));
    say('INFO lift: ' + S().copiesMemo.val.list.length + ' dents, ' + shell());
  } catch (e) { fails++; say('ERROR ' + e.message + ' ' + (e.stack || '').split('\n')[1]); }
  say(fails ? fails + ' FAILED' : 'ALL PASS');
  post(out.join('\n'));
})();
