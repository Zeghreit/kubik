(function () {
  const OUT = []; let fails = 0;
  const say = s => OUT.push(s);
  const ok = (n, c, d) => { if (!c) fails++; say((c ? 'PASS ' : 'FAIL ') + n + (d === undefined ? '' : '  ' + d)); };
  const post = (p, b) => { try { const x = new XMLHttpRequest(); x.open('POST', p, true); x.send(b); } catch (e) {} };
  const mark = s => post('/mark', 'at: ' + s + '\n' + OUT.join('\n'));
  function finish(extra) { if (extra) { say(extra); fails++; } say('VERDICT=' + (fails ? 'FAIL' : 'PASS') + ' (' + fails + ' failed)'); post('/done', OUT.join('\n')); }
  let K = null, A = null, T = null;
  const wait = ms => new Promise(r => setTimeout(r, ms));
  const clone = o => JSON.parse(JSON.stringify(o));
  const mat0 = o => Array.isArray(o.mesh.material) ? o.mesh.material[0] : o.mesh.material;
  const imported = () => Array.from(K.MATERIALS.values()).filter(d => /imported/i.test(d.name || '')).map(d => d.id);
  async function run() {
    A = K.App; T = K.THREE;
    mark('start');
    K.createPrimitiveObject('cube', { h: 8, v: 6, x: 1, y: 1, z: 1 }, 'Probe', new T.Vector3(0, 0.5, 0));
    const o = A.objects[A.objects.length - 1];
    A.selectedObjectIds = new Set([o.id]); A.activeObjectId = o.id; A.selectedElements = new Set();
    K.setMode('object');

    /* 1. a doc with presets only asks nothing */
    K.applyFinishToSelection('gold');
    const docP = clone(K.serializeDoc());
    ok('1.0 presets only: nothing foreign', K.foreignDocMaterials(docP).length === 0, JSON.stringify(K.foreignDocMaterials(docP)));

    /* 2. a custom material the library will not have */
    K.MATERIALS.set('mat_probe', { id: 'mat_probe', preset: false, name: 'Probe Paint', color: '#12ab34', roughness: 0.3, metalness: 0.2, bevel: 0 });
    K.applyFinishToSelection('mat_probe');
    const docC = clone(K.serializeDoc());
    ok('2.0 it is in the doc library', (docC.materialLib || []).some(d => d.id === 'mat_probe'));
    ok('2.1 present here: not foreign', K.foreignDocMaterials(docC).length === 0);
    K.MATERIALS.delete('mat_probe');
    const f = K.foreignDocMaterials(docC);
    ok('2.2 gone from the library: foreign', f.length === 1 && f[0] === 'Probe Paint', JSON.stringify(f));

    /* 3. the dialog */
    mark('dialog');
    const pr = K.materialsChoice(clone(docC));
    await wait(50);
    const btns = Array.from(document.querySelectorAll('body > div button')).filter(b => /Add materials|Model only|Cancel/.test(b.textContent));
    ok('3.0 three buttons', btns.length === 3, btns.map(b => b.textContent.slice(0, 14)).join('|'));
    btns.find(b => /Model only/.test(b.textContent)).click();
    ok('3.1 Model only resolves skip', (await pr) === 'skip');
    ok('3.2 the dialog is gone', !Array.from(document.querySelectorAll('button')).some(b => /Model only/.test(b.textContent)));
    const pr2 = K.materialsChoice(clone(docC)); await wait(30);
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    ok('3.3 Escape cancels', (await pr2) === null);
    ok('3.4 nothing to ask: undefined', (await K.materialsChoice(clone(docP))) === undefined);

    /* 4. model only */
    mark('skip');
    K.restoreDoc(clone(docC), { materials: 'skip' });
    const oS = A.objects[A.objects.length - 1];
    const mS = mat0(oS);
    ok('4.0 library did not grow', !K.MATERIALS.has('mat_probe') && imported().length === 0, imported().join(','));
    const std = K.getMaterialDef('standard');
    ok('4.1 the face is Clay, not Probe Paint', Math.abs(mS.roughness - std.roughness) < 1e-6 && Math.abs(mS.metalness - std.metalness) < 1e-6,
      mS.roughness + ' ' + mS.metalness);
    const fin = Object.values((oS.mesh.userData.finishes) || {});
    ok('4.2 finishes say standard', fin.length > 0 && fin.every(v => v === 'standard'), JSON.stringify(fin));

    /* 5. bring them */
    mark('bring');
    K.restoreDoc(clone(docC));
    const oB = A.objects[A.objects.length - 1];
    ok('5.0 library has Probe Paint again', K.MATERIALS.has('mat_probe'));
    ok('5.1 the face wears it', Math.abs(mat0(oB).roughness - 0.3) < 1e-6, String(mat0(oB).roughness));

    /* 6. a known preset-only file in skip mode changes nothing */
    K.restoreDoc(clone(docP), { materials: 'skip' });
    const oG = A.objects[A.objects.length - 1];
    ok('6.0 gold stays gold', Math.abs(mat0(oG).metalness - 1) < 1e-6, String(mat0(oG).metalness));
    finish();
  }
  function boot() {
    K = window.__kubik;
    if (!K || !K.App || !K.createPrimitiveObject || !K.restoreDoc || !K.materialsChoice) { setTimeout(boot, 120); return; }
    setTimeout(() => run().catch(e => finish('THREW ' + (e && e.stack ? e.stack : e))), 600);
  }
  boot();
  setTimeout(() => { if (OUT.join('').indexOf('VERDICT') < 0) finish('THREW timeout'); }, 90000);
})();
