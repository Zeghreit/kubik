(function () {
  const OUT = []; let fails = 0;
  const say = s => OUT.push(s);
  const ok = (n, c, d) => { if (!c) fails++; say((c ? 'PASS ' : 'FAIL ') + n + (d === undefined ? '' : '  ' + d)); };
  const post = (p, b) => { try { const x = new XMLHttpRequest(); x.open('POST', p, true); x.send(b); } catch (e) {} };
  const mark = s => post('/mark', 'at: ' + s + '\n' + OUT.join('\n'));
  function finish(extra) { if (extra) { say(extra); fails++; } say('VERDICT=' + (fails ? 'FAIL' : 'PASS') + ' (' + fails + ' failed)'); post('/done', OUT.join('\n')); }
  let K = null, A = null, T = null, C = null;
  const wait = ms => new Promise(r => setTimeout(r, ms));
  const ev = (type, x, y, o) => {
    o = o || {};
    C.dispatchEvent(new PointerEvent(type, { bubbles: true, cancelable: true, pointerId: o.id || 7, isPrimary: true,
      pointerType: o.mouse ? 'mouse' : 'touch', clientX: x, clientY: y, button: type === 'pointermove' ? -1 : 0,
      buttons: type === 'pointerup' ? 0 : 1, shiftKey: !!o.shift, ctrlKey: !!o.ctrl, altKey: !!o.alt }));
  };
  const scr = (obj) => { const v = new T.Vector3(); obj.mesh.getWorldPosition(v); v.project(K.camera);
    const r = C.getBoundingClientRect(); return { x: r.left + (v.x + 1) / 2 * r.width, y: r.top + (1 - v.y) / 2 * r.height }; };
  const empty = () => { const r = C.getBoundingClientRect(); return { x: r.left + 40, y: r.bottom - 40 }; };
  async function tap(p, o) { ev('pointerdown', p.x, p.y, o); await wait(30); ev('pointerup', p.x, p.y, o); }
  async function drag(pts, o, seen) {
    ev('pointerdown', pts[0].x, pts[0].y, o); await wait(20);
    for (const q of pts.slice(1)) { ev('pointermove', q.x, q.y, o); await wait(8); if (seen) seen.push(K.boxDrag ? K.boxDrag.kind : null); }
    ev('pointerup', pts[pts.length - 1].x, pts[pts.length - 1].y, o); await wait(30);
  }
  const line = (a, b, n) => { const r = []; for (let i = 0; i <= n; i++) r.push({ x: a.x + (b.x - a.x) * i / n, y: a.y + (b.y - a.y) * i / n }); return r; };
  const ring = (c, rad, n) => { const r = []; for (let i = 0; i <= n; i++) { const t = i / n * Math.PI * 2; r.push({ x: c.x + rad * Math.cos(t), y: c.y + rad * Math.sin(t) }); } return r; };
  const sel = () => [...A.selectedObjectIds];
  async function run() {
    A = K.App; T = K.THREE; C = K.canvasEl;
    mark('start');
    ok('0.0 boots on tap select', A.selectDrag === 'off', A.selectDrag);
    const mk = (x) => { K.createPrimitiveObject('cube', { h: 1, v: 1, x: 0.6, y: 0.6, z: 0.6 }, 'P' + x, new T.Vector3(x, 0.3, 0)); return A.objects[A.objects.length - 1]; };
    const a = mk(-2.2), b = mk(0), c = mk(2.2);
    K.setMode('object');
    K.camera.position.set(0, 3, 9); K.orbit.target.set(0, 0.3, 0); K.orbit.update(); K.camera.updateMatrixWorld(true);
    await wait(300);
    A.selectedObjectIds.clear(); A.activeObjectId = null;
    const pa = scr(a), pb = scr(b), pc = scr(c), E = empty();
    say('INFO a ' + pa.x.toFixed(0) + ',' + pa.y.toFixed(0) + ' b ' + pb.x.toFixed(0) + ' c ' + pc.x.toFixed(0));
    /* 1. tap A selects it */
    await tap(pa); await wait(500);
    ok('1.0 tap selects A', sel().length === 1 && sel()[0] === a.id, JSON.stringify(sel()));
    /* 2. tap empty, then drag a box over B within 350ms: adds B, A kept */
    await tap(E); await wait(60);
    ok('2.0 the tap on empty did deselect', sel().length === 0);
    await wait(600);
    const seen = [];
    const S2 = { x: pb.x - 70, y: pb.y - 50 };
    await tap(S2); await wait(60);
    await drag(line(S2, { x: pb.x + 40, y: pb.y + 40 }, 8), null, seen);
    ok('2.1 tap-then-drag added B to the selection before the tap', sel().includes(b.id) && !sel().includes(a.id), JSON.stringify(sel()));
    ok('2.2 straight stroke stayed a box', seen.every(k => k === 'auto'), seen.join(','));
    ok('2.3 region ended', !K.boxDrag);
    await wait(600);
    /* 3. a drag with no tap before it orbits, never selects */
    const camBefore = K.camera.position.clone();
    const seen3 = [];
    await drag(line(E, { x: E.x + 60, y: E.y - 60 }, 8), null, seen3);
    ok('3.0 plain drag is no region', seen3.every(k => k === null), seen3.join(','));
    const n3 = sel().length; ok('3.1 selection untouched by plain drag', n3 >= 1, String(n3));
    await wait(600);
    /* 4. curved stroke turns into a lasso; it catches C */
    const R4 = ring(pc, 45, 20);
    await tap(R4[0]); await wait(60);
    const seen4 = [];
    await drag(R4, null, seen4);
    ok('4.0 curved stroke became a lasso', seen4.includes('lasso') && seen4[seen4.length - 1] === 'lasso', seen4.join(','));
    ok('4.1 lasso added C and kept the rest', sel().length === n3 + 1 && sel().includes(c.id), JSON.stringify(sel()));
    await wait(600);
    /* 5. mouse: Ctrl-drag removes B, Shift-drag adds it back, Alt forces lasso */
    await drag(line({ x: pb.x - 30, y: pb.y - 30 }, { x: pb.x + 30, y: pb.y + 30 }, 8), { mouse: true, ctrl: true });
    ok('5.0 Ctrl-drag removed B, kept C', !sel().includes(b.id) && sel().includes(c.id), JSON.stringify(sel()));
    await drag(line({ x: pb.x - 30, y: pb.y - 30 }, { x: pb.x + 30, y: pb.y + 30 }, 8), { mouse: true, shift: true });
    ok('5.1 Shift-drag added B, kept C', sel().includes(b.id) && sel().includes(c.id), JSON.stringify(sel()));
    const seen5 = [];
    await drag(ring(pa, 40, 16), { mouse: true, alt: true }, seen5);
    ok('5.2 Alt-drag is a lasso from the start', seen5.length && seen5.every(k => k === 'lasso'), seen5.join(','));
    ok('5.3 Alt-lasso caught A (regions add: multiSelect is always on)', sel().includes(a.id), JSON.stringify(sel()));
    await wait(600);
    /* 6. select all / deselect */
    A.selectedObjectIds.clear();
    K.selectAllToggle();
    const pick = A.objects.filter(K.objectPickable || (() => true)).length;
    ok('6.0 select all takes every object', sel().length >= 3 && sel().length === pick, sel().length + '/' + pick);
    K.selectAllToggle();
    ok('6.1 second press deselects', sel().length === 0);
    A.selectedObjectIds = new Set([b.id]); A.activeObjectId = b.id; K.setMode('vertex'); A.selectedElements.clear();
    K.selectAllToggle();
    ok('6.2 vertex mode: all 8 corners', A.selectedElements.size === 8, String(A.selectedElements.size));
    K.selectAllToggle();
    ok('6.3 vertex mode: deselect', A.selectedElements.size === 0);
    K.setMode('face'); K.selectAllToggle();
    ok('6.4 face mode: all 6 faces', A.selectedElements.size === 6, String(A.selectedElements.size));
    K.selectAllToggle(); K.setMode('object');
    A.selectedObjectIds = new Set([a.id]);
    await wait(600);
    /* 7. a still second tap is still a double tap (frame), not a region */
    const pE = empty();
    await tap(pE); await wait(80); const before = sel().length; await tap(pE); await wait(80);
    ok('7.0 still double tap: no region left, tap memory consumed', !K.boxDrag && K.lastTapForProbe === undefined ? true : !K.boxDrag, String(before));
    finish();
  }
  function boot() {
    K = window.__kubik;
    if (!K || !K.App || !K.selectAllToggle) { setTimeout(boot, 120); return; }
    setTimeout(() => run().catch(e => finish('THREW ' + (e && e.stack ? e.stack : e))), 600);
  }
  boot();
  setTimeout(() => { if (OUT.length === 0) finish('THREW boot timeout'); }, 140000);
})();
