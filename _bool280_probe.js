/* v2.80 - the Quads topology type in the Boolean bar, driven through the real
   bar buttons. A primitive cube minus a rod, then Zeghreit's model
   (_dev/female.json, not in the repo) minus / plus a sphere on its side.
   Run: python3 _cloudprobe.py _bool280_probe.js
   PROBE_QS=&w=2 ... is not a thing: band width is a Generate variant. */
(async function () {
  const out = [];
  const say = s => out.push(s);
  let K;
  const post = b => { try { const x = new XMLHttpRequest(); x.open('POST', '/result', true); x.send(b); } catch (e) {} };
  const wait = ms => new Promise(r => setTimeout(r, ms));
  let fails = 0;
  const check = (name, ok, note) => { if (!ok) fails++; say((ok ? 'PASS ' : 'FAIL ') + name + (note ? '  ' + note : '')); };

  function mk(name, kind, params, x, y, z) {
    const ed = K.buildPrimitiveEditable(kind, params || {});
    const mats = K.makeMaterialSet(ed.groups.length || 1, 0x9aa3b2);
    return K.createObjectFromEditable(name, new K.THREE.Vector3(x || 0, y || 0, z || 0), ed, mats, {});
  }
  const clear = () => {
    K.App.objects.slice().forEach(o => { try { o.mesh.parent.remove(o.mesh); } catch (e) {} });
    K.App.objects.length = 0;
  };
  const readout = () => document.getElementById('opReadout').textContent;
  const chip2 = label => Array.from(document.querySelectorAll('#opGrouping2 button')).find(b => b.textContent === label);
  const chip1 = label => Array.from(document.querySelectorAll('#opGrouping button')).find(b => b.textContent === label);
  const gen = () => { const t = performance.now(); document.getElementById('opExtra').click(); return performance.now() - t; };
  const tap = el => { const t = performance.now(); el.click(); return performance.now() - t; };
  const S = () => K.App.opSetup;

  async function open(ids) {
    K.App.selectedObjectIds = new Set(ids);
    K.App.activeObjectId = null;
    K.booleanSelection();
    for (let i = 0; i < 400 && !S(); i++) await wait(25);
    return !!S();
  }
  const faceStats = o => {
    const ed = K.toEditable(o.mesh), c = { 3: 0, 4: 0, n: 0 };
    ed.groups.forEach(g => { const k = g.triangles.length + 2; if (k === 3) c[3]++; else if (k === 4) c[4]++; else c.n++; });
    return ed.groups.length + ' faces (' + c[4] + ' quads, ' + c[3] + ' tris, ' + c.n + ' n-gons)';
  };

  /* One setup: N-gon as it opens, then Quads, Generate through the layouts,
     Undo, and a commit of `commitSeedTaps` Generates. Returns the result and
     what N-gon's commit would have left open (measured on a second setup). */
  async function session(tag, ids, kind, commitTaps, stress) {
    check(tag + ': bar opens', await open(ids));
    if (!S()) return null;
    if (kind !== 'union') chip1(kind === 'difference' ? 'Difference' : 'Intersect').click();
    check(tag + ': Quads chip shown', !!chip2('Quads'));
    const ngon = S().topoInfo;
    say(tag + ': ' + readout());
    const ms = tap(chip2('Quads'));
    const q = S().topoInfo;
    say(tag + ': Quads ' + ms.toFixed(0) + ' ms -> ' + readout() + '  rebuilt ' + q.rebuilt + (q.failed && q.failed.length ? ', kept N-gon: ' + q.failed.join(', ') : ''));
    check(tag + ': Quads chip lights, readout says Quads var 1', chip2('Quads').classList.contains('active') && /^Quads · var 1 · /.test(readout()), readout());
    if (!stress) check(tag + ': Quads rebuilt at least one piece', q.rebuilt > 0, q.rebuilt + '');
    if (!stress) check(tag + ': Quads layout differs from N-gon', q.hash !== ngon.hash);
    const hs = [q.hash], times = [];
    for (let i = 0; i < 5; i++) { times.push(gen()); hs.push(S().topoInfo.hash);
      say(tag + ':   Generate -> ' + readout() + ' (seed ' + S().p.seed + ', rebuilt ' + S().topoInfo.rebuilt + ')'); }
    say(tag + ': Generate ms ' + times.map(t => t.toFixed(0)).join(', '));
    if (!stress) {
      check(tag + ': 5 Generates = 6 distinct Quads layouts', new Set(hs).size === 6, new Set(hs).size + '');
      K.opSetupStepBack();
      check(tag + ': Undo -> previous layout', S().topoInfo.hash === hs[4] && /· var 5 ·/.test(readout()), readout());
    }
    // back to the first Quads layout and on by the asked number of taps
    chip2('N-gon').click(); chip2('Quads').click();
    check(tag + ': Quads chip again -> var 1', S().topoInfo.hash === hs[0] && /var 1 ·/.test(readout()), readout());
    for (let i = 0; i < commitTaps; i++) gen();
    const shown = S().topoInfo.stats, seed = S().p.seed;
    const objId = S().objId;
    K.finishOpSetup(true);
    const R = K.App.objects.find(o => o.id === objId) || K.App.objects[K.App.objects.length - 1];
    const w = K.auditWinding(R);
    say(tag + ': committed (seed ' + seed + ') ' + faceStats(R) + ' ' + JSON.stringify(w));
    check(tag + ': readout and chips gone after OK', document.getElementById('opReadout').style.display === 'none' &&
          document.getElementById('opGrouping2').style.display === 'none');
    say(tag + ': shown region ' + JSON.stringify(shown));
    return { R, w };
  }
  try {
    while (!(window.__kubik && window.__kubik.App)) await wait(50);
    await wait(1500);
    K = window.__kubik;
    clear();
    K.setMode('object');

    // 1. cube minus a rod: every piece flat or a straight wall
    const cube = mk('Cube', 'cube', {}, 0, 0, 0);
    const rod = mk('Rod', 'cylinder', {}, 0, 0, 0);
    rod.mesh.scale.set(0.25, 2, 0.25); rod.mesh.updateMatrixWorld(true);
    K.ensureHelpers(cube); K.ensureHelpers(rod);
    const r1 = await session('cube-rod', [cube.id, rod.id], 'difference', 0);
    if (r1) check('cube-rod: committed closed and wound', r1.w.ok && r1.w.boundary === 0 && r1.w.nonManifold === 0, JSON.stringify(r1.w));

    // 2. Zeghreit's model with a sphere on its side, at mid height
    for (const [kind, where] of [['difference', 'chest'], ['union', 'chest'], ['difference', 'arm']]) {
      clear();
      const doc = await (await fetch('/_dev/female.json')).json();
      K.restoreDoc(doc);
      await wait(300);
      const A = K.App.objects[0];
      A.mesh.updateMatrixWorld(true);
      const box = new K.THREE.Box3().setFromObject(A.mesh);
      const H = box.max.y - box.min.y, midY = box.min.y + 0.62 * H;
      const pa = A.mesh.geometry.attributes.position, v = new K.THREE.Vector3();
      let best = null;
      for (let i = 0; i < pa.count; i++) {
        v.fromBufferAttribute(pa, i).applyMatrix4(A.mesh.matrixWorld);
        if (where === 'arm') {
          if (Math.abs(v.y - midY) > H * 0.05) continue;
          if (!best || v.x > best.x) best = v.clone();
        } else {
          // the chest: front-most point near the middle line at 70% height
          if (Math.abs(v.x) >= 0.06 * H || Math.abs(v.y - (box.min.y + 0.7 * H)) >= 0.04 * H) continue;
          if (!best || v.z > best.z) best = v.clone();
        }
      }
      const B = mk('Ball', 'sphere', { h: 16, v: 8 }, best.x, best.y, best.z);
      B.mesh.scale.setScalar(H * 0.07); B.mesh.updateMatrixWorld(true);
      K.ensureHelpers(A); K.ensureHelpers(B);
      if (kind === 'difference') say('model ' + A.name.slice(0, 20) + ', ' + faceStats(A) + '; ball ' + faceStats(B));
      const tag = 'female-' + kind + '-' + where;
      const r = await session(tag, [A.id, B.id], kind, 0, where === 'arm');
      // N-gon on the same inputs, from a fresh copy of the model: the bar for "never worse"
      clear(); K.restoreDoc(doc); await wait(300);
      const A2 = K.App.objects[0];
      const B2 = mk('Ball', 'sphere', { h: 16, v: 8 }, best.x, best.y, best.z);
      B2.mesh.scale.setScalar(H * 0.07); B2.mesh.updateMatrixWorld(true);
      K.ensureHelpers(A2); K.ensureHelpers(B2);
      await open([A2.id, B2.id]);
      if (kind !== 'union') chip1('Difference').click();
      const oid = S().objId; K.finishOpSetup(true);
      const wN = K.auditWinding(K.App.objects.find(o => o.id === oid) || K.App.objects[K.App.objects.length - 1]);
      say(tag + ': N-gon commit ' + JSON.stringify(wN));
      if (r) check(tag + ': Quads commit no more open edges than N-gon, none non-manifold or reversed',
                   r.w.boundary <= wN.boundary && r.w.nonManifold === 0 && r.w.reversed === 0, 'quads ' + r.w.boundary + ' vs ngon ' + wN.boundary);
    }
  } catch (e) {
    say('ERROR=' + (e && e.stack ? e.stack.split('\n').slice(0, 6).join(' / ') : e));
    fails++;
  }
  say(fails ? 'FAILURES ' + fails : 'ALL GREEN');
  post(out.join('\n'));
})();
