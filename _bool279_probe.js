/* v2.79 - topology chips and Generate in the Boolean bar, driven through the
   real bar buttons. Zeghreit's model (_dev/female.json, not in the repo)
   minus / plus a cube, and a primitive cube minus a rod for N-gon bridges.
   Run: python3 _cloudprobe.py _bool279_probe.js */
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
  const S = () => K.App.opSetup;

  async function open(ids) {
    K.App.selectedObjectIds = new Set(ids);
    K.App.activeObjectId = null;
    K.booleanSelection();
    for (let i = 0; i < 400 && !S(); i++) await wait(25);
    return !!S();
  }

  async function session(tag, ids, kind, wantNgonVariants, open0) {
    const t0 = performance.now();
    check(tag + ': bar opens', await open(ids));
    if (!S()) return;
    say(tag + ': open ' + (performance.now() - t0).toFixed(0) + ' ms');
    if (kind !== 'union') { chip1(kind === 'difference' ? 'Difference' : 'Intersect').click(); }
    check(tag + ': topology chips shown', document.getElementById('opGrouping2').style.display !== 'none' &&
          !!chip2('N-gon') && !!chip2('Tris'));
    check(tag + ': Generate shown', document.getElementById('opExtraWrap').style.display !== 'none' &&
          document.getElementById('opExtra').textContent === 'Generate');
    say(tag + ': ' + readout());
    check(tag + ': readout N-gon var 1', /^N-gon · var 1 · /.test(readout()), readout());
    const h0 = S().topoInfo && S().topoInfo.hash;

    // N-gon Generate
    const nh = [h0];
    for (let i = 0; i < 3; i++) {
      const ms = gen();
      const h = S().topoInfo.hash;
      say(tag + ': N-gon Generate ' + ms.toFixed(0) + ' ms -> ' + readout());
      if (nh.indexOf(h) < 0) nh.push(h);
    }
    if (wantNgonVariants) check(tag + ': N-gon Generate gives new layouts', nh.length >= 3, nh.length + ' distinct');

    // Tris
    chip2('Tris').click();
    check(tag + ': Tris chip lights', chip2('Tris').classList.contains('active'));
    check(tag + ': Tris var 1, no quads or n-gons in the region',
          /^Tris · var 1 · /.test(readout()) && S().topoInfo.stats.quads === 0 && S().topoInfo.stats.ngons === 0, readout());
    const th = [S().topoInfo.hash];
    const times = [];
    for (let i = 0; i < 4; i++) { times.push(gen()); th.push(S().topoInfo.hash); }
    say(tag + ': Tris Generate ms ' + times.map(t => t.toFixed(0)).join(', ') + ' -> ' + readout());
    check(tag + ': 4 Generates = 5 distinct Tris layouts', new Set(th).size === 5, new Set(th).size + '');
    check(tag + ': readout says var 5', /· var 5 ·/.test(readout()), readout());

    // Undo walks back one layout
    K.opSetupStepBack();
    check(tag + ': Undo -> previous layout', S().topoInfo.hash === th[3] && /· var 4 ·/.test(readout()), readout());

    // Back to N-gon: seed 0 again, the first layout
    chip2('N-gon').click();
    check(tag + ': N-gon chip -> the first N-gon layout', S().p.seed === 0 && S().topoInfo.hash === h0, readout());

    // Undo past the chip switch: back on Tris, the numbering still right
    K.opSetupStepBack();
    check(tag + ': Undo past a chip switch -> Tris var 4', S().p.topo === 'tris' && /^Tris · var 4 ·/.test(readout()), readout());
    chip2('N-gon').click();
    // Tapping the lit op chip changes nothing
    gen(); const hl = S().topoInfo.hash, sl = S().p.seed;
    chip1(kind === 'difference' ? 'Difference' : kind === 'union' ? 'Union' : 'Intersect').click();
    check(tag + ': tapping the lit op chip keeps the layout', S().topoInfo.hash === hl && S().p.seed === sl, readout());
    // Kind switch resets the seed
    gen();
    chip1('Union').click(); chip1(kind === 'union' ? 'Difference' : kind === 'difference' ? 'Difference' : 'Intersect').click();
    check(tag + ': op chip resets to layout 1', S().p.seed === 0 && /var 1 ·/.test(readout()), readout());

    if (wantNgonVariants) {
      chip2('Tris').click();
      let wrapped = -1; const hs = new Set([S().topoInfo.hash]);
      for (let i = 0; i < 200 && wrapped < 0; i++) { gen(); if (S().p.seed === 0) wrapped = i; else hs.add(S().topoInfo.hash); }
      say(tag + ': Tris wrapped after ' + wrapped + ' taps, ' + hs.size + ' layouts');
      gen();
      check(tag + ': after the wrap, Generate walks the found layouts', wrapped > 0 && S().p.seed !== 0 && /var 2 ·/.test(readout()), readout());
      chip2('N-gon').click();
    }
    // Tris again, one Generate, commit: what is kept is what was shown
    chip2('Tris').click(); gen();
    const shown = S().topoInfo.stats;
    const objId = S().objId;
    K.finishOpSetup(true);
    const R = K.App.objects.find(o => o.id === objId) || K.App.objects[K.App.objects.length - 1];
    const w = K.auditWinding(R);
    say(tag + ': committed ' + JSON.stringify(w));
    check(tag + ': committed result wound, no more open edges than main', w.ok && w.boundary <= open0 && w.nonManifold === 0, 'boundary ' + w.boundary + ' (main ' + open0 + ')');
    check(tag + ': readout and chips gone after OK', document.getElementById('opReadout').style.display === 'none' &&
          document.getElementById('opGrouping2').style.display === 'none');
    say(tag + ': shown region ' + JSON.stringify(shown));
    return R;
  }

  try {
    while (!(window.__kubik && window.__kubik.App)) await wait(50);
    await wait(1500);
    K = window.__kubik;
    clear();
    K.setMode('object');

    // 1. primitives: cube minus a rod (holes -> bridges -> N-gon variants)
    const cube = mk('Cube', 'cube', {}, 0, 0, 0);
    const rod = mk('Rod', 'cylinder', {}, 0, 0, 0);
    rod.mesh.scale.set(0.25, 2, 0.25); rod.mesh.updateMatrixWorld(true);
    K.ensureHelpers(cube); K.ensureHelpers(rod);
    await session('cube-rod', [cube.id, rod.id], 'difference', true, 0);

    // 2. Zeghreit's model minus / plus a cube at mid height
    clear();
    const doc = await (await fetch('/_dev/female.json')).json();
    K.restoreDoc(doc);
    await wait(300);
    const A = K.App.objects[0];
    A.mesh.updateMatrixWorld(true);
    const box = new K.THREE.Box3().setFromObject(A.mesh);
    const H = box.max.y - box.min.y, midY = (box.min.y + box.max.y) / 2;
    const pa = A.mesh.geometry.attributes.position, v = new K.THREE.Vector3();
    let best = null;
    for (let i = 0; i < pa.count; i++) {
      v.fromBufferAttribute(pa, i).applyMatrix4(A.mesh.matrixWorld);
      if (Math.abs(v.y - midY) > H * 0.08) continue;
      if (!best || v.x > best.x) best = v.clone();
    }
    const B = mk('Box', 'cube', {}, best.x, best.y, best.z);
    B.mesh.scale.setScalar(H * 0.04); B.mesh.updateMatrixWorld(true);
    K.ensureHelpers(A); K.ensureHelpers(B);
    say('model ' + A.name.slice(0, 20) + ', faces ' + K.toEditable(A.mesh).groups.length);
    // 4 open edges: main does the same at its default layout (v2.77 too).
    await session('female-cube', [A.id, B.id], 'difference', false, 4);
  } catch (e) {
    say('ERROR=' + (e && e.stack ? e.stack.split('\n').slice(0, 6).join(' / ') : e));
    fails++;
  }
  say(fails ? 'FAILURES ' + fails : 'ALL GREEN');
  post(out.join('\n'));
})();
