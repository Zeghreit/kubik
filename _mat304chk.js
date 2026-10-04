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
  const fire = (id, ev) => document.getElementById(id).dispatchEvent(new Event(ev, { bubbles: true }));
  function lum() {
    K.renderer.render(K.scene, K.camera);
    const src = K.renderer.domElement, c = document.createElement('canvas');
    c.width = 160; c.height = 160;
    const x = c.getContext('2d'); x.drawImage(src, 0, 0, 160, 160);
    const d = x.getImageData(0, 0, 160, 160).data; let s = 0, n = 0;
    for (let i = 0; i < d.length; i += 4) { const l = d[i] * 0.3 + d[i + 1] * 0.59 + d[i + 2] * 0.11; if (l > 40) { s += l; n++; } }
    return n ? s / n : 0;
  }
  async function run() {
    A = K.App; T = K.THREE;
    mark('start');
    /* 1. catalogue */
    const ids = ['wood', 'leather', 'grunge'];
    ok('1.0 procedural types exist', ids.every((id, i) => K.MASK_TYPES.some(t => t.id === id && t.proc === 3 + i)));
    /* 2. an old mask keeps its signature: no new keys appear on it */
    const old = { id: 'mat_old', preset: false, name: 'Old', color: '#556677', roughness: 0.5, metalness: 0,
      masks: [{ on: true, type: 'fbm', blend: 'normal', colorOn: true, color: '#7a4a20', roughOn: false, rough: 0.25, amount: 0.7, scale: 2, detail: 3, contrast: 1.4, nscale: 1, seed: 1 }] };
    const sig0 = K.materialDefSig(clone(old));
    ok('2.0 old mask signature has no metal/brk', !/"metal"|"brk"|"bscale"/.test(sig0));
    /* 3. editor toggles */
    K.createPrimitiveObject('cube', { h: 2, v: 2, x: 1, y: 1, z: 1 }, 'Probe', new T.Vector3(0, 0.5, 0));
    const o = A.objects[A.objects.length - 1];
    A.selectedObjectIds = new Set([o.id]); A.activeObjectId = o.id; A.selectedElements = new Set();
    K.setMode('object');
    K.MATERIALS.set('mat_p4', { id: 'mat_p4', preset: false, name: 'P4', color: '#808080', roughness: 0.5, metalness: 0,
      masks: [{ on: true, type: 'grunge', blend: 'normal', colorOn: true, color: '#000000', roughOn: false, rough: 0.5, amount: 1, scale: 3, detail: 0.5, contrast: 1.6, nscale: 1, seed: 1 }] });
    K.applyFinishToSelection('mat_p4');
    A.selectedObjectIds = new Set(); A.activeObjectId = null;
    if (K.refreshSelectionVisuals) K.refreshSelectionVisuals();
    o.mesh.children.forEach(c => { c.visible = false; });
    K.camera.position.set(1.6, 1.6, 2.2); K.camera.lookAt(0, 0.5, 0); K.camera.updateMatrixWorld(true);
    await wait(300);
    const L0 = lum();
    mark('editor');
    K.openMatEditor('mat_p4'); await wait(200);
    const d = K.MATERIALS.get('mat_p4');
    const sigStart = K.materialDefSig(d);
    ok('3.0 controls exist', ['mkMetalOn', 'mkMetal', 'mkBrkOn', 'mkBrk', 'mkBScale'].every(id => !!document.getElementById(id)));
    ok('3.1 metal slider disabled while off', document.getElementById('mkMetal').disabled === true);
    document.getElementById('mkMetalOn').checked = true; fire('mkMetalOn', 'change'); await wait(150);
    ok('3.2 tick Metal writes the key', typeof d.masks[0].metal === 'number', String(d.masks[0].metal));
    document.getElementById('mkMetal').value = '0.3'; fire('mkMetal', 'input'); await wait(50);
    ok('3.3 slider writes the value', Math.abs(d.masks[0].metal - 0.3) < 1e-9, String(d.masks[0].metal));
    document.getElementById('mkMetalOn').checked = false; fire('mkMetalOn', 'change'); await wait(150);
    ok('3.4 untick deletes the key', !('metal' in d.masks[0]));
    document.getElementById('mkBrkOn').checked = true; fire('mkBrkOn', 'change'); await wait(150);
    ok('3.5 tick Breakup writes brk + bscale', typeof d.masks[0].brk === 'number' && typeof d.masks[0].bscale === 'number', d.masks[0].brk + '/' + d.masks[0].bscale);
    document.getElementById('mkBScale').value = '6'; fire('mkBScale', 'input'); await wait(50);
    ok('3.6 size slider writes bscale', Math.abs(d.masks[0].bscale - 6) < 1e-9, String(d.masks[0].bscale));
    document.getElementById('mkBrk').value = '1'; fire('mkBrk', 'input'); await wait(300);
    const L1 = lum();
    ok('4.0 breakup 1 removes the black layer (lighter)', L1 > L0 + 3, L0.toFixed(1) + ' -> ' + L1.toFixed(1));
    document.getElementById('mkBrkOn').checked = false; fire('mkBrkOn', 'change'); await wait(300);
    ok('3.7 untick deletes brk and bscale', !('brk' in d.masks[0]) && !('bscale' in d.masks[0]));
    const L2 = lum();
    ok('4.1 and the layer is back', Math.abs(L2 - L0) < 2, L0.toFixed(1) + ' vs ' + L2.toFixed(1));
    ok('3.8 signature back to the start (sliders off leave no keys)', K.materialDefSig(d) === sigStart);
    /* 4b. a type switch to wood / leather renders and differs */
    const sel = document.getElementById('mkType');
    sel.value = 'wood'; fire('mkType', 'change'); await wait(300);
    const LW = lum();
    sel.value = 'leather'; fire('mkType', 'change'); await wait(300);
    const LL = lum();
    ok('4.2 wood and leather paint something different', Math.abs(LW - LL) > 0.5 && Math.abs(LW - L0) > 0.5, [L0, LW, LL].map(v => v.toFixed(1)).join(' '));
    ok('4.3 leather took its own scale default', Math.abs(d.masks[0].scale - K.maskTypeOf(d.masks[0]).sDef) < 1e-9, String(d.masks[0].scale));
    document.getElementById('meDone').click(); await wait(150);
    /* 5. round trip keeps the new keys and matches itself */
    mark('roundtrip');
    d.masks[0].metal = 1; d.masks[0].brk = 0.5; d.masks[0].bscale = 4;
    const doc = clone(K.serializeDoc());
    const before = K.MATERIALS.size;
    K.restoreDoc(clone(doc), {}); await wait(200);
    const back = K.MATERIALS.get('mat_p4');
    ok('5.0 keys survive the file', back && back.masks[0].metal === 1 && back.masks[0].brk === 0.5 && back.masks[0].bscale === 4);
    ok('5.1 no (imported) copy minted', K.MATERIALS.size === before && !Array.from(K.MATERIALS.values()).some(x => /imported/.test(x.name || '')), before + ' -> ' + K.MATERIALS.size);
    /* 6. programs */
    let broken = 0;
    (K.renderer.info.programs || []).forEach(p => { if (p.diagnostics && p.diagnostics.runnable === false) broken++; });
    const gl = K.renderer.getContext();
    ok('6.0 no broken program, no GL error', broken === 0 && gl.getError() === 0, 'broken ' + broken);
    finish();
  }
  function boot() {
    K = window.__kubik;
    if (!K || !K.App || !K.openMatEditor) { setTimeout(boot, 120); return; }
    setTimeout(() => run().catch(e => finish('THREW ' + (e && e.stack ? e.stack : e))), 600);
  }
  boot();
  setTimeout(() => { if (OUT.length === 0) finish('THREW boot timeout'); }, 140000);
})();
