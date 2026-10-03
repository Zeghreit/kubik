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
  const dens = () => { const o = obj(); return K.uvIslandAreas(o, K.toEditable(o.mesh)).map(r => r.density); };
  const uvs = () => Array.prototype.slice.call(obj().mesh.geometry.attributes.uv.array);
  async function run() {
    A = K.App; T = K.THREE;
    let o = A.objects[0];
    if (!o) { K.createPrimitiveObject('cube', { h: 1, v: 1 }, 'Cube', new T.Vector3(0, 0, 0)); o = A.objects[0]; }
    A.activeObjectId = o.id; A.selectedObjectIds = new Set([o.id]);
    K.setMode('edge'); K.ensureHelpers(o);
    A.selectedElements = new Set(o.mesh.userData.topo.edges.map((e, i) => i));
    K.markSeamSelection(true);
    A.selectedElements = new Set();
    K.setMode('uv'); K.unwrapSelection(); K.refreshUI();
    K.HUB_TOOLS_WORLD.find(t => t.key === 'addgeo').run();
    await wait(150);
    ok('0.setup', K.uvViewOpen && dens().filter(d => d > 0).length >= 2, 'islands=' + dens().length);
    ok('0.badge >= 2.95', parseFloat(((document.querySelector('.brand') || {}).textContent.match(/[\d.]+/) || [0])[0]) >= 2.95);
    const W = K.HUB_TOOLS_UV2D_WORLD, s = W.find(t => t.key === 'uvsize');
    ok('1.ring seat 7', !!s && s.seat === 7, s && s.seat);
    ok('1.ring seats unique, <=8', new Set(W.map(t => t.seat)).size === W.length && W.length <= 8, JSON.stringify(W.map(t => t.seat)));
    ok('1.ring glyph', typeof K.ICON.tilesize === 'string' && K.ICON.tilesize.length > 10);
    ok('1.not in 3D ring', !K.HUB_TOOLS_WORLD.find(t => t.key === 'uvsize'));
    mark('1');
    const at = A.historyIndex, base = uvs();
    // bad input
    ok('2.zero refused', K.uvSetWorldSize(0) === false && A.historyIndex === at);
    ok('2.NaN refused', K.uvSetWorldSize(NaN) === false && A.historyIndex === at);
    ok('2.neg refused', K.uvSetWorldSize(-1) === false && A.historyIndex === at);
    // exact
    ok('3.apply 0.5', K.uvSetWorldSize(0.5) === true); await wait(200);
    let d = dens().filter(x => x > 0);
    ok('3.density = 1/N = 2', d.length >= 2 && d.every(x => Math.abs(x - 2) < 2e-3), d.join(','));
    ok('3.one history step', A.historyIndex === at + 1, A.historyIndex - at);
    ok('3.same again refused', K.uvSetWorldSize(0.5) === false && A.historyIndex === at + 1);
    ok('3.N=2 -> density 0.5', K.uvSetWorldSize(2) === true); await wait(200);
    d = dens().filter(x => x > 0);
    ok('3.density 0.5', d.every(x => Math.abs(x - 0.5) < 5e-4), d.join(','));
    K.undo(); await wait(200); K.undo(); await wait(200);
    ok('4.undo restores', A.historyIndex === at && uvs().every((v, i) => Math.abs(v - base[i]) < 1e-6));
    // panel
    ok('5.panel opens', K.uvOpenSizePanel() === true);
    const p = document.getElementById('uvSizePanel'), inp = document.getElementById('uvSizeInput');
    ok('5.panel visible + input', !!p && p.style.display === 'flex' && !!inp && inp.value === '1', inp && inp.value);
    inp.value = '0.25'; document.getElementById('uvSizeOk').click(); await wait(250);
    d = dens().filter(x => x > 0);
    ok('5.OK applies 0.25 (density 4)', d.every(x => Math.abs(x - 4) < 4e-3), d.join(','));
    ok('5.panel closes', p.style.display === 'none');
    while (A.historyIndex > at) { K.undo(); await wait(160); }
    mark('5');
    finish();
  }
  function boot() {
    K = window.__kubik;
    if (!K || !K.App || !K.uvSetWorldSize || !K.uvOpenSizePanel || !K.uvIslandAreas) { setTimeout(boot, 120); return; }
    setTimeout(() => run().catch(e => finish('THREW ' + (e && e.stack ? e.stack : e))), 500);
  }
  boot();
  setTimeout(() => { if (OUT.length === 0) finish('THREW boot timeout'); }, 110000);
})();
