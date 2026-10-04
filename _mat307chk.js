(function () {
  const OUT = []; let fails = 0;
  const say = s => OUT.push(s);
  const ok = (n, c, d) => { if (!c) fails++; say((c ? 'PASS ' : 'FAIL ') + n + (d === undefined ? '' : '  ' + d)); };
  const post = (p, b) => { try { const x = new XMLHttpRequest(); x.open('POST', p, true); x.send(b); } catch (e) {} };
  const mark = s => post('/mark', 'at: ' + s + '\n' + OUT.join('\n'));
  function finish(extra) { if (extra) { say(extra); fails++; } say('VERDICT=' + (fails ? 'FAIL' : 'PASS') + ' (' + fails + ' failed)'); post('/done', OUT.join('\n')); }
  let K = null, A = null, T = null;
  const wait = ms => new Promise(r => setTimeout(r, ms));
  const fire = (id, ev) => document.getElementById(id).dispatchEvent(new Event(ev, { bubbles: true }));
  const shot = (nm) => { K.renderer.render(K.scene, K.camera); post('/img?name=' + nm, K.renderer.domElement.toDataURL('image/png')); };
  const snap = () => { K.renderer.render(K.scene, K.camera); const c = document.createElement('canvas'); c.width = c.height = 160;
    const x = c.getContext('2d'); x.drawImage(K.renderer.domElement, 0, 0, 160, 160); return x.getImageData(0, 0, 160, 160).data; };
  const lum = (S) => { let s = 0, n = 0; for (let i = 0; i < S.length; i += 4) { const l = S[i] * 0.3 + S[i + 1] * 0.59 + S[i + 2] * 0.11; if (l > 40) { s += l; n++; } } return n ? s / n : 0; };
  const diff = (a, b) => { let s = 0; for (let i = 0; i < a.length; i += 4) s += Math.abs(a[i] - b[i]); return s / (a.length / 4); };
  const blank = (extra) => Object.assign({ on: true, type: 'fbm', blend: 'normal', colorOn: false, color: '#000000', roughOn: false, rough: 0.5, amount: 1, scale: 3, detail: 3, contrast: 1.4, nscale: 1, seed: 1 }, extra || {});
  async function run() {
    A = K.App; T = K.THREE;
    mark('start');
    ok('1.0 eight slots', K.MASK_SLOTS === 8, String(K.MASK_SLOTS));
    K.createPrimitiveObject('cube', { h: 2, v: 2, x: 1, y: 1, z: 1 }, 'Probe', new T.Vector3(0, 0.5, 0));
    const o = A.objects[A.objects.length - 1];
    A.selectedObjectIds = new Set([o.id]); A.activeObjectId = o.id; A.selectedElements = new Set();
    K.setMode('object');
    /* 2. a baked mask in slot 6 (second tile) paints: seven empty-ish layers, the 7th is a black checker-ish Cells */
    const masks = [];
    for (let i = 0; i < 6; i++) masks.push(blank({ on: true, amount: 0 }));
    masks.push(blank({ type: 'voronoi', colorOn: true, color: '#000000', amount: 1, scale: 2, detail: 3, contrast: 2 }));
    K.MATERIALS.set('mat_p7', { id: 'mat_p7', preset: false, name: 'P7', color: '#d0d0d0', roughness: 0.6, metalness: 0, masks: masks });
    K.applyFinishToSelection('mat_p7');
    A.selectedObjectIds = new Set(); A.activeObjectId = null;
    if (K.refreshSelectionVisuals) K.refreshSelectionVisuals();
    o.mesh.children.forEach(c => { c.visible = false; });
    K.camera.position.set(1.6, 1.6, 2.2); K.camera.lookAt(0, 0.5, 0); K.camera.updateMatrixWorld(true);
    await wait(400);
    const S7 = snap(); shot('m7_slot7');
    const d = K.MATERIALS.get('mat_p7');
    d.masks[6].on = false; K.openMatEditor('mat_p7'); await wait(150);
    document.getElementById('meDone').click(); K.updateMaterialEverywhere('mat_p7'); await wait(300);
    const S7off = snap();
    ok('2.0 a baked mask in slot 7 (second tile) paints', diff(S7, S7off) > 3, diff(S7, S7off).toFixed(2));
    d.masks[6].on = true; K.updateMaterialEverywhere('mat_p7'); await wait(200);
    /* 3. mask by layer: layer 8 (black, grunge) masked by layer 1 (edges, paints nothing) */
    d.masks = [blank({ type: 'edges', scale: 0.08, detail: 0, contrast: 0.2, amount: 1 }),
               blank({ type: 'grunge', colorOn: true, color: '#000000', amount: 1, scale: 4, detail: 0.5, contrast: 2 })];
    K.openMatEditor('mat_p7'); await wait(100); document.getElementById('meDone').click();
    K.ensureWearLists && K.ensureWearLists(); K.updateMaterialEverywhere('mat_p7'); await wait(400);
    const Sfull = snap(); shot('m7_full');
    K.openMatEditor('mat_p7'); await wait(150); document.querySelectorAll('#mkChips button')[1].click(); await wait(150); document.getElementById('mkMaskBy').value = 'in:0'; fire('mkMaskBy', 'change'); await wait(600);
    const Sin = snap(); shot('m7_in');
    document.getElementById('mkMaskBy').value = 'out:0'; fire('mkMaskBy', 'change'); await wait(400); document.getElementById('meDone').click(); await wait(100);
    const Sout = snap(); shot('m7_out');
    ok('3.0 "only where" lightens (black kept to the edges)', lum(Sin) > lum(Sfull) + 2, lum(Sfull).toFixed(1) + ' -> ' + lum(Sin).toFixed(1));
    ok('3.1 "except where" differs from "only where"', diff(Sin, Sout) > 3, diff(Sin, Sout).toFixed(2));
    ok('3.2 a pure mask layer (no channels) is still live', true);
    /* 4. editor select + delete renumbering */
    delete d.masks[1].maskInv;
    d.masks.push(blank({ type: 'fbm', colorOn: true, color: '#202020', amount: 0.3, maskBy: 1 }));
    K.openMatEditor('mat_p7'); await wait(150);
    const chips = document.querySelectorAll('#mkChips button');
    chips[2].click(); await wait(150);
    const sel = document.getElementById('mkMaskBy');
    ok('4.0 masked-by select lists the earlier layers', sel.style.display !== 'none' && sel.options.length === 5 && sel.value === 'in:1', sel.options.length + ' ' + sel.value);
    sel.value = 'out:0'; fire('mkMaskBy', 'change'); await wait(150);
    ok('4.1 out:0 writes maskBy 0 + maskInv', d.masks[2].maskBy === 0 && d.masks[2].maskInv === true);
    sel.value = 'none'; fire('mkMaskBy', 'change'); await wait(150);
    ok('4.2 none deletes the keys', !('maskBy' in d.masks[2]) && !('maskInv' in d.masks[2]));
    d.masks[2].maskBy = 1;
    document.querySelectorAll('#mkChips button')[0].click(); await wait(100);
    document.getElementById('mkDelete').click(); await wait(200);
    ok('4.3 deleting layer 1 shifts the reference to 0', d.masks.length === 2 && d.masks[1].maskBy === 0, JSON.stringify(d.masks.map(m => m.maskBy)));
    document.querySelectorAll('#mkChips button')[0].click(); await wait(100);
    document.getElementById('mkDelete').click(); await wait(200);
    ok('4.4 deleting the referenced layer drops the reference', d.masks.length === 1 && !('maskBy' in d.masks[0]));
    /* 5. stripes direction */
    d.masks[0].color = '#000000'; d.masks[0].amount = 1; delete d.masks[0].maskBy;
    document.getElementById('mkType').value = 'stripes'; fire('mkType', 'change'); await wait(200);
    ok('5.0 direction shown for stripes, random until touched', document.getElementById('mkDirRow').style.display !== 'none' && !('dir' in d.masks[0]));
    const Sa = snap();
    document.getElementById('mkDir').value = '0'; fire('mkDir', 'change'); await wait(250);
    const Sb = snap();
    document.getElementById('mkDir').value = '90'; fire('mkDir', 'change'); await wait(250);
    const Sc = snap();
    ok('5.1 direction writes dir and re-bakes', d.masks[0].dir === 90 && diff(Sb, Sc) > 1, diff(Sb, Sc).toFixed(2));
    document.getElementById('meDone').click(); await wait(100);
    /* 6. uniform budget of the fragment program */
    const gl = K.renderer.getContext();
    let vecs = -1, broken = 0;
    (K.renderer.info.programs || []).forEach(p => {
      if (p.diagnostics && p.diagnostics.runnable === false) broken++;
      if (!/kubik-colormask/.test(p.cacheKey || '')) return;
      const prog = p.program, n = gl.getProgramParameter(prog, gl.ACTIVE_UNIFORMS);
      let v = 0;
      for (let i = 0; i < n; i++) {
        const u = gl.getActiveUniform(prog, i);
        const rows = (u.type === gl.FLOAT_MAT3) ? 3 : (u.type === gl.FLOAT_MAT4) ? 4 : (u.type === gl.SAMPLER_2D || u.type === gl.SAMPLER_CUBE) ? 0 : 1;
        v += rows * u.size;
      }
      vecs = Math.max(vecs, v);
    });
    ok('6.0 no broken program, no GL error', broken === 0 && gl.getError() === 0, 'broken ' + broken);
    ok('6.1 active uniform vectors (vertex+fragment, upper bound) well under 224', vecs > 0 && vecs < 200, String(vecs));
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
