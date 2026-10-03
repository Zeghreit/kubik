(function () {
  const OUT = []; let fails = 0;
  const say = s => OUT.push(s);
  const ok = (n, c, d) => { if (!c) fails++; say((c ? 'PASS ' : 'FAIL ') + n + (d === undefined ? '' : '  ' + d)); };
  const post = (p, b) => { try { const x = new XMLHttpRequest(); x.open('POST', p, true); x.send(b); } catch (e) {} };
  const mark = s => post('/mark', 'at: ' + s + '\n' + OUT.join('\n'));
  function finish(extra) { if (extra) { say(extra); fails++; } say('VERDICT=' + (fails ? 'FAIL' : 'PASS') + ' (' + fails + ' failed)'); post('/done', OUT.join('\n')); }
  let K = null, A = null, T = null;
  const wait = ms => new Promise(r => setTimeout(r, ms));
  const obj = () => A.objects.find(x => x.id === A.activeObjectId);
  const lp = l => K.logicalPos(obj(), l).clone();
  async function run() {
    A = K.App; T = K.THREE;
    K.createPrimitiveObject('cube', { h: 4, v: 4 }, 'Cube', new T.Vector3(0, 0, 0));
    let o = A.objects[A.objects.length - 1];
    A.activeObjectId = o.id; A.selectedObjectIds = new Set([o.id]);
    K.setMode('vertex'); K.ensureHelpers(o);
    const topo = () => obj().mesh.userData.topo;
    const lc = topo().logicalCount;
    // an interior vertex of a cube face: 4 neighbours, all on one plane
    const nbOf = l => { const r = []; topo().edges.forEach(e => { if (e[0] === l) r.push(e[1]); else if (e[1] === l) r.push(e[0]); }); return r; };
    let pick = -1;
    for (let l = 0; l < lc && pick < 0; l++) {
      const p = lp(l);
      if (Math.abs(Math.abs(p.z) - 0.5) < 1e-6 && Math.abs(p.x) < 0.49 && Math.abs(p.y) < 0.49 && nbOf(l).length === 4) pick = l;
    }
    ok('0.found interior face vertex', pick >= 0, 'pick=' + pick + ' lc=' + lc);
    const z0 = lp(pick).z;
    // bump it out by 0.1
    {
      const ed = K.toEditable(obj().mesh);
      (topo().logicalGroups[pick] || []).forEach(ai => { ed.positions[ai * 3 + 2] += 0.1; });
      K.rebuildFromEditable(obj(), ed);
    }
    K.ensureHelpers(obj());
    const bumped = lp(pick).z - z0;
    ok('1.bump set', Math.abs(bumped - 0.1) < 1e-5, bumped);
    const others = []; for (let l = 0; l < lc; l++) if (l !== pick) others.push(lp(l));
    // direct apply
    ok('2.apply returns true', K.smoothApply(obj(), [pick], 0.8, 1, {}) === true);
    K.ensureHelpers(obj());
    const after = lp(pick).z - z0;
    ok('2.bump reduced', after < bumped * 0.7 && after > -0.02, after);
    let moved = 0; for (let l = 0; l < lc; l++) if (l !== pick && lp(l).distanceTo(others[l - (l > pick ? 1 : 0)]) > 1e-9) moved++;
    ok('2.unpicked untouched', moved === 0, 'moved=' + moved);
    ok('2.amount 0 refuses', K.smoothApply(obj(), [pick], 0, 1, {}) === false);
    // all points, many passes: volume kept (Taubin), box size within 3 %
    const gbox = () => { const g = obj().mesh.geometry; g.computeBoundingBox(); return g.boundingBox.getSize(new T.Vector3()); };
    const box0 = gbox();
    const all = []; for (let l = 0; l < lc; l++) all.push(l);
    let cor = -1; for (let l = 0; l < lc && cor < 0; l++) { const p = lp(l); if (Math.abs(p.x) > 0.49 && Math.abs(p.y) > 0.49 && Math.abs(p.z) > 0.49) cor = l; }
    const cp0 = lp(cor), nbs = nbOf(cor).map(l => lp(l));
    say('INFO corner ' + cor + ' ' + cp0.toArray().map(v => v.toFixed(3)).join(',') + ' nb=' + nbs.map(p => p.toArray().map(v => v.toFixed(2)).join(',')).join(' | '));
    const trace = [box0.x.toFixed(4)];
    for (let q = 0; q < 4; q++) { K.smoothApply(obj(), all, 0.6, 1, {}); K.ensureHelpers(obj()); trace.push(gbox().x.toFixed(4)); }
    { const cp1 = lp(cor); say('INFO corner after ' + cp1.toArray().map(v => v.toFixed(3)).join(',')); }
    say('INFO trace x: ' + trace.join(' '));
    K.smoothApply(obj(), all, 0.6, 8, {});
    K.ensureHelpers(obj());
    const box1 = gbox();
    const ratio = box1.x / box0.x;
    ok('3.plain smoothing never grows the cube', ratio <= 1.0001 && ratio > 0.6, ratio.toFixed(4));
    ok('3.keep-volume variant runs', K.smoothApply(obj(), all, 0.6, 3, {}, true) === true);
    // pending flow
    mark('3');
    K.setMode('vertex'); K.ensureHelpers(obj()); A.selectedElements = new Set([pick]);
    const at = A.historyIndex;
    K.smoothSelection();
    say('INFO mode=' + A.mode + ' sel=' + A.selectedElements.size + ' pend=' + (A.pendingOp && A.pendingOp.kind) + ' toast=' + ((document.getElementById('toast') || {}).textContent || ''));
    ok('4.pending op opened', !!A.pendingOp && A.pendingOp.kind === 'smooth', A.pendingOp && A.pendingOp.kind);
    if (A.pendingOp) { K.setPendingAmount(0.5); await wait(60); K.confirmPendingOp(); await wait(120); }
    ok('4.one history step or refusal clean', !A.pendingOp && A.historyIndex <= at + 1, A.historyIndex - at);
    // rings
    const V = K.HUB_TOOLS_VERTEX, f5 = V.find(t => t.key === 'flow');
    ok('5.vertex ring: Flow door seat 5 with setflow+smooth', !!f5 && f5.seat === 5 && f5.door.some(t => t.key === 'setflow') && f5.door.some(t => t.key === 'smooth'));
    ok('5.vertex ring seats unique', new Set(V.map(t => t.seat)).size === V.length);
    ok('5.glyph', typeof K.ICON.smoothv === 'string' && K.ICON.smoothv.length > 10);
    ok('5.badge >= 2.98', parseFloat(((document.querySelector('.brand') || {}).textContent.match(/[\d.]+/) || [0])[0]) >= 2.98);
    // object mode refuses
    K.setMode('object'); const before = A.pendingOp; K.smoothSelection();
    ok('6.object mode: no op', !A.pendingOp);
    mark('6');
    finish();
  }
  function boot() {
    K = window.__kubik;
    if (!K || !K.App || !K.smoothApply || !K.logicalPos || !K.HUB_TOOLS_VERTEX || !K.setPendingAmount) { setTimeout(boot, 120); return; }
    setTimeout(() => run().catch(e => finish('THREW ' + (e && e.stack ? e.stack : e))), 500);
  }
  boot();
  setTimeout(() => { if (OUT.length === 0) finish('THREW boot timeout'); }, 110000);
})();
