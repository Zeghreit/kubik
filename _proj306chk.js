(function () {
  const OUT = []; let fails = 0;
  const say = s => OUT.push(s);
  const ok = (n, c, d) => { if (!c) fails++; say((c ? 'PASS ' : 'FAIL ') + n + (d === undefined ? '' : '  ' + d)); };
  const post = (p, b) => { try { const x = new XMLHttpRequest(); x.open('POST', p, true); x.send(b); } catch (e) {} };
  const mark = s => post('/mark', 'at: ' + s + '\n' + OUT.join('\n'));
  function finish(extra) { if (extra) { say(extra); fails++; } say('VERDICT=' + (fails ? 'FAIL' : 'PASS') + ' (' + fails + ' failed)'); post('/done', OUT.join('\n')); }
  let K = null, A = null, T = null;
  const wait = ms => new Promise(r => setTimeout(r, ms));
  async function run() {
    A = K.App; T = K.THREE;
    mark('start');
    A.objects.slice().forEach(o => { try { K.deleteObject ? K.deleteObject(o) : 0; } catch (e) {} });
    const mk = (kind, x, p) => { K.createPrimitiveObject(kind, p || {}, kind, new T.Vector3(x, 0.6, 0)); return A.objects[A.objects.length - 1]; };
    const cyl = mk('cylinder', -2.4, { h: 16, v: 1, x: 1, y: 1.4, z: 1 }), sph = mk('sphere', -0.8, { h: 24, v: 16, x: 1, y: 1, z: 1 }), cub = mk('cube', 0.8, { h: 2, v: 2, x: 1, y: 1, z: 1 }), pln = mk('plane', 2.4, { h: 4, v: 4, x: 1, y: 1, z: 1 }); const c8 = mk('cylinder', 0, { h: 8, v: 2, x: 0.6, y: 0.3, z: 0.6 }); c8.mesh.position.set(0, 0.2, 1.6);
    const t = o => { const s = K.meshShapeOf(o.mesh.geometry); return s ? s.t : -1; };
    [cyl, sph, cub, pln].forEach(o => { const g = o.mesh.geometry; const s = K.meshShapeOf(g); say('dbg ' + o.name + ' verts ' + g.getAttribute('position').count + ' normal ' + !!g.getAttribute('normal') + ' ' + JSON.stringify(s && [s.t, s._fit])); });
    ok('1.0 cylinder fits as a cylinder', t(cyl) === 2, String(t(cyl)));
    ok('1.1 sphere fits as a sphere', t(sph) === 3, String(t(sph)));
    ok('1.2 cube fits as nothing (triplanar)', t(cub) === 0, String(t(cub)));
    ok('1.3 plane fits as a plane', t(pln) === 1, String(t(pln)));
    ok('1.5 coarse 8-sided disc still a cylinder', t(c8) === 2, String(t(c8)));
    const cs = K.meshShapeOf(cyl.mesh.geometry);
    ok('1.4 cylinder axis is the long one (y)', Math.abs(cs.cylA[1]) > 0.99, JSON.stringify(cs.cylA.map(v => +v.toFixed(3))));
    /* a squashed cylinder (disc) */
    cyl.mesh.geometry.getAttribute('position').needsUpdate = true;
    /* 2. render: high-contrast stripes, triplanar vs auto */
    K.MATERIALS.set('mat_pj', { id: 'mat_pj', preset: false, name: 'PJ', color: '#e0e0e0', roughness: 0.6, metalness: 0,
      masks: [{ on: true, type: 'stripes', blend: 'normal', colorOn: true, color: '#101010', roughOn: false, rough: 0.5, amount: 1, scale: 3, detail: 3, contrast: 3, nscale: 1, seed: 6 }] });
    A.selectedObjectIds = new Set(A.objects.map(o => o.id)); A.activeObjectId = A.objects[0].id; A.selectedElements = new Set();
    K.setMode('object');
    K.applyFinishToSelection('mat_pj');
    A.selectedObjectIds = new Set(); A.activeObjectId = null;
    if (K.refreshSelectionVisuals) K.refreshSelectionVisuals();
    A.objects.forEach(o => o.mesh.children.forEach(c => { c.visible = false; }));
    K.camera.position.set(0, 1.9, 3.9); K.camera.lookAt(0, 0.55, 0.3); K.camera.updateMatrixWorld(true);
    await wait(400);
    K.renderer.render(K.scene, K.camera);
    post('/img?name=proj_tri', K.renderer.domElement.toDataURL('image/png'));
    await wait(100);
    const d = K.MATERIALS.get('mat_pj');
    K.openMatEditor('mat_pj'); await wait(200);
    const sel = document.getElementById('mkProj');
    ok('2.0 projection control shown for a baked mask', sel && sel.style.display !== 'none' && sel.options.length === 6);
    sel.value = 'auto'; sel.dispatchEvent(new Event('change', { bubbles: true })); await wait(400);
    ok('2.1 Auto writes proj', d.masks[0].proj === 'auto');
    K.renderer.render(K.scene, K.camera);
    post('/img?name=proj_auto', K.renderer.domElement.toDataURL('image/png'));
    await wait(100);
    /* own instances: every object draws with its own material once a projection is on */
    const firstMats = A.objects.map(o => (Array.isArray(o.mesh.material) ? o.mesh.material[0] : o.mesh.material));
    ok('2.2 each part has its own instance', new Set(firstMats).size === A.objects.length, new Set(firstMats).size + ' / ' + A.objects.length);
    sel.value = 'tri'; sel.dispatchEvent(new Event('change', { bubbles: true })); await wait(300);
    ok('2.3 Triplanar deletes the key', !('proj' in d.masks[0]));
    /* v3.08: rotate */
    const snap = () => { K.renderer.render(K.scene, K.camera); const c = document.createElement('canvas'); c.width = c.height = 160;
      const x = c.getContext('2d'); x.drawImage(K.renderer.domElement, 0, 0, 160, 160); return x.getImageData(0, 0, 160, 160).data; };
    const diff = (a, b) => { let s = 0; for (let i = 0; i < a.length; i += 4) s += Math.abs(a[i] - b[i]); return s / (a.length / 4); };
    const rotEl = document.getElementById('mkRot');
    ok('4.0 rotate shown for a tile', document.getElementById('mkRotRow').style.display !== 'none');
    const R0 = snap();
    rotEl.value = '45'; rotEl.dispatchEvent(new Event('change', { bubbles: true })); await wait(300);
    const R1 = snap();
    ok('4.1 rotate writes rot and turns the pattern', d.masks[0].rot === 45 && diff(R0, R1) > 2, diff(R0, R1).toFixed(2));
    post('/img?name=proj_rot45', K.renderer.domElement.toDataURL('image/png'));
    rotEl.value = '0'; rotEl.dispatchEvent(new Event('change', { bubbles: true })); await wait(200);
    ok('4.2 zero deletes rot', !('rot' in d.masks[0]));
    document.getElementById('mkType').value = 'wood'; document.getElementById('mkType').dispatchEvent(new Event('change', { bubbles: true })); await wait(300);
    ok('2.4 a procedural type offers axes (Auto/X/Y/Z/UV)', sel.style.display !== 'none' && sel.options.length === 5 && sel.value === 'auto', sel.options.length + ' ' + sel.value);
    const W0 = snap();
    post('/img?name=proj_wood_auto', K.renderer.domElement.toDataURL('image/png'));
    sel.value = 'z'; sel.dispatchEvent(new Event('change', { bubbles: true })); await wait(400);
    const Wz = snap();
    ok('4.3 axis Z writes proj and changes the wood', d.masks[0].proj === 'z' && diff(W0, Wz) > 2, diff(W0, Wz).toFixed(2));
    rotEl.value = '90'; rotEl.dispatchEvent(new Event('change', { bubbles: true })); await wait(300);
    ok('4.4 rotate turns a procedural layer too', diff(Wz, snap()) > 2);
    sel.value = 'auto'; sel.dispatchEvent(new Event('change', { bubbles: true })); await wait(200);
    ok('4.5 Auto deletes proj for a procedural layer', !('proj' in d.masks[0]));
    ok('4.6 the fit carries a principal axis', Array.isArray(K.meshShapeOf(cub.mesh.geometry).e1));
    document.getElementById('meDone').click(); await wait(100);
    let broken = 0;
    (K.renderer.info.programs || []).forEach(p => { if (p.diagnostics && p.diagnostics.runnable === false) broken++; });
    ok('3.0 no broken program, no GL error', broken === 0 && K.renderer.getContext().getError() === 0, 'broken ' + broken);
    finish();
  }
  function boot() {
    K = window.__kubik;
    if (!K || !K.App || !K.meshShapeOf) { setTimeout(boot, 120); return; }
    setTimeout(() => run().catch(e => finish('THREW ' + (e && e.stack ? e.stack : e))), 600);
  }
  boot();
  setTimeout(() => { if (OUT.length === 0) finish('THREW boot timeout'); }, 140000);
})();

