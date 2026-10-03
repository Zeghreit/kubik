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
  const byName = n => A.objects.find(x => x.name === n);
  function mk(kind, name, x, finish) {
    K.createPrimitiveObject(kind, { h: 8, v: 6, x: 1, y: 1, z: 1 }, name, new T.Vector3(x, 0.5, 0));
    const o = A.objects[A.objects.length - 1];
    A.selectedObjectIds = new Set([o.id]); A.activeObjectId = o.id; A.selectedElements = new Set();
    K.setMode('object');
    K.applyFinishToSelection(finish);
    return o;
  }
  const importedNames = () => Array.from(K.MATERIALS.values()).filter(d => /imported/i.test(d.name || '')).map(d => d.id + ':' + d.name);
  async function run() {
    A = K.App; T = K.THREE;
    mark('start');
    /* 1. the set itself */
    const ids = Object.keys(K.MATERIAL_DEFAULTS);
    ok('1.0 preset ids', ids.join(',') === 'standard,plastic,lacquer,ceramic,rubber,velvet,leather,wood,concrete,steel,steelworn,paintchip,gold,copper,bronze', ids.join(','));
    ok('1.1 metal is not a preset any more, plastic is one again', !K.MATERIAL_DEFAULTS.metal && !!K.MATERIAL_DEFAULTS.plastic);
    ok('1.2 getMaterialDef alias net', K.getMaterialDef('plastic').id === 'plastic' && K.getMaterialDef('metal').id === 'steel',
      K.getMaterialDef('plastic').id + ' ' + K.getMaterialDef('metal').id);
    ok('1.3 unknown id still falls back to standard', K.getMaterialDef('nope-zzz').id === 'standard');

    /* 2. live materials are physical and carry the values */
    const A1 = mk('sphere', 'PA', -2, 'lacquer'), B1 = mk('sphere', 'PB', 0, 'velvet'), C1 = mk('sphere', 'PC', 2, 'gold');
    const ma = mat0(A1), mb = mat0(B1), mc = mat0(C1);
    ok('2.0 class is Physical', ma.isMeshPhysicalMaterial && mb.isMeshPhysicalMaterial && mc.isMeshPhysicalMaterial, ma.type + '/' + mb.type + '/' + mc.type);
    ok('2.1 lacquer coat', ma.clearcoat === 1 && Math.abs(ma.clearcoatRoughness - 0.04) < 1e-9, ma.clearcoat + ' ' + ma.clearcoatRoughness);
    ok('2.2 velvet sheen', mb.sheen === 1 && mb.sheenColor.getHexString() === 'b48cff' && Math.abs(mb.sheenRoughness - 0.55) < 1e-9 && Math.abs(mb.specularIntensity - 0.3) < 1e-9,
      mb.sheen + ' ' + mb.sheenColor.getHexString() + ' ' + mb.sheenRoughness + ' ' + mb.specularIntensity);
    ok('2.3 gold is plain metal', mc.metalness === 1 && mc.clearcoat === 0 && mc.sheen === 0 && mc.specularIntensity === 1);

    /* 3. signatures: a definition with none of the new fields keeps the old shape */
    const sigOld = K.materialDefSig({ name: 'X', color: '#112233', roughness: 0.5, metalness: 0 });
    ok('3.0 no phys key without phys fields', sigOld.indexOf('phys') < 0, sigOld);
    const sigNew = K.materialDefSig({ name: 'X', color: '#112233', roughness: 0.5, metalness: 0, clearcoat: 0.5 });
    ok('3.1 phys key when one differs', sigNew.indexOf('"phys"') >= 0 && sigNew.indexOf('clearcoat') >= 0, sigNew);
    ok('3.2 default values do not move the signature', K.materialDefSig({ name: 'X', color: '#112233', roughness: 0.5, metalness: 0, clearcoat: 0, sheenRoughness: 1, specularIntensity: 1, sheenColor: '#000000' }) === sigOld);

    /* 4. save + reload round trip */
    mark('roundtrip');
    const doc = clone(K.serializeDoc());
    const od = doc.objects.find(x => x.name === 'PA');
    ok('4.0 snapshot carries phys', od && od.materials && od.materials[0].phys && od.materials[0].phys.clearcoat === 1, JSON.stringify(od && od.materials && od.materials[0]));
    const libL = (doc.materialLib || []).find(d => d.id === 'lacquer');
    ok('4.1 library carries the preset', !!libL && libL.clearcoat === 1, JSON.stringify(libL));
    const nBefore = K.MATERIALS.size;
    K.restoreDoc(clone(doc));
    await wait(300);
    const A2 = byName('PA'), B2 = byName('PB');
    ok('4.2 objects back', !!A2 && !!B2);
    if (A2 && B2) {
      const m1 = mat0(A2), m2 = mat0(B2);
      ok('4.3 coat survives', m1.isMeshPhysicalMaterial && m1.clearcoat === 1, m1.type + ' ' + m1.clearcoat);
      ok('4.4 sheen survives', m2.isMeshPhysicalMaterial && m2.sheen === 1 && m2.sheenColor.getHexString() === 'b48cff', m2.sheen + ' ' + m2.sheenColor.getHexString());
      ok('4.5 finishes ids intact', (A2.mesh.userData.finishes || {})[0] === 'lacquer' && (B2.mesh.userData.finishes || {})[0] === 'velvet', JSON.stringify(A2.mesh.userData.finishes));
    }
    ok('4.6 no duplicate library entries', K.MATERIALS.size === nBefore && importedNames().length === 0, K.MATERIALS.size + ' vs ' + nBefore + ' ' + importedNames().join(','));

    /* 5. an OLD document: Solid / Plastic / Metal as v2.99 wrote them */
    mark('olddoc');
    const old = clone(doc);
    old.materialLib = [
      { id: 'standard', preset: true, name: 'Solid', color: '#303338', roughness: 1, metalness: 0, envMapIntensity: 1 },
      { id: 'plastic', preset: true, name: 'Plastic', color: '#303338', roughness: 0.4, metalness: 0 },
      { id: 'metal', preset: true, name: 'Metal', color: '#303338', roughness: 0.25, metalness: 1 }
    ];
    const setOld = (name, fin, r, m) => {
      const o = old.objects.find(x => x.name === name);
      o.finishes = { 0: fin };
      o.materials = [{ color: '#303338', roughness: r, metalness: m, themed: true }];
    };
    setOld('PA', 'plastic', 0.4, 0); setOld('PB', 'metal', 0.25, 1); setOld('PC', 'standard', 1, 0);
    const sizeBefore = K.MATERIALS.size;
    K.restoreDoc(old);
    await wait(300);
    const OA = byName('PA'), OB = byName('PB'), OC = byName('PC');
    ok('5.0 objects back', !!OA && !!OB && !!OC);
    ok('5.1 no (imported) copies minted', importedNames().length === 0, importedNames().join(','));
    ok('5.2 library did not grow', K.MATERIALS.size === sizeBefore, K.MATERIALS.size + ' vs ' + sizeBefore);
    ok('5.3 plastic stays plastic, metal -> steel, standard stays',
      OA && (OA.mesh.userData.finishes || {})[0] === 'plastic' && OB && (OB.mesh.userData.finishes || {})[0] === 'steel' && OC && (OC.mesh.userData.finishes || {})[0] === 'standard',
      JSON.stringify([OA && OA.mesh.userData.finishes, OB && OB.mesh.userData.finishes, OC && OC.mesh.userData.finishes]));
    ok('5.4 no stray metal id in the library', !K.MATERIALS.has('metal'));
    if (OA) { const m = mat0(OA); ok('5.5 the surface is a Physical material of the library', m.isMeshPhysicalMaterial, m.type + ' r=' + m.roughness + ' cc=' + m.clearcoat); }

    /* 6. an old Plastic somebody CHANGED is kept, not discarded */
    mark('customold');
    const old2 = clone(doc);
    old2.materialLib = [
      { id: 'standard', preset: true, name: 'Solid', color: '#303338', roughness: 1, metalness: 0 },
      { id: 'plastic', preset: true, name: 'Plastic', color: '#303338', roughness: 0.4, metalness: 0, bevel: 0.3 }
    ];
    { const o = old2.objects.find(x => x.name === 'PA'); o.finishes = { 0: 'plastic' }; o.materials = [{ color: '#303338', roughness: 0.4, metalness: 0, themed: true }]; }
    K.restoreDoc(old2);
    await wait(300);
    const O6 = byName('PA');
    const f6 = O6 && (O6.mesh.userData.finishes || {})[0];
    const d6 = f6 && K.MATERIALS.get(f6);
    ok('6.0 a customised old Plastic survives with its bevel', !!d6 && d6.bevel === 0.3, f6 + ' ' + JSON.stringify(d6 && { n: d6.name, b: d6.bevel }));

    /* 7. localStorage override written for Solid */
    mark('override');
    try {
      localStorage.setItem(K.MATLIB_KEY, JSON.stringify({ customs: [], presetOverrides: { standard: { name: 'Solid', color: null, roughness: 1, metalness: 0, masks: [], bevel: 0 },
        metal: { name: 'Metal', color: null, roughness: 0.25, metalness: 1, masks: [], bevel: 0 } }, nextNum: 1 }));
      K.loadMaterialLibrary();
    } catch (e) { say('override threw ' + e); }
    const st = K.MATERIALS.get('standard');
    ok('7.0 an old Solid override does not overwrite Clay', st && st.name === 'Clay' && Math.abs(st.roughness - 0.82) < 1e-9, JSON.stringify(st && { n: st.name, r: st.roughness }));
    ok('7.1 an override for a removed preset is never a preset', !(K.MATERIALS.get('metal') && K.MATERIALS.get('metal').preset));

    /* 8. the editor */
    mark('editor');
    K.openMatEditor('lacquer');
    const q = id => document.getElementById(id);
    ok('8.0 sliders show the preset', q('meCoat') && parseFloat(q('meCoat').value) === 1 && Math.abs(parseFloat(q('meCoatR').value) - 0.04) < 1e-9);
    const fire = (el, v) => { el.value = v; el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true })); };
    A.selectedObjectIds = new Set([byName('PA').id]); A.activeObjectId = byName('PA').id;
    K.applyFinishToSelection('lacquer');
    fire(q('meCoat'), 0.25);
    await wait(150);
    const dl = K.MATERIALS.get('lacquer');
    ok('8.1 slider writes the definition', dl.clearcoat === 0.25, dl.clearcoat);
    ok('8.2 and the live material', mat0(byName('PA')).clearcoat === 0.25, mat0(byName('PA')).clearcoat);
    fire(q('meSheen'), 0.5);
    await wait(150);
    ok('8.3 raising sheen on a black-sheen material gives it a light colour', K.MATERIALS.get('lacquer').sheenColor === '#ffffff', K.MATERIALS.get('lacquer').sheenColor);
    ok('8.4 lacquer is now an override in the library', JSON.parse(localStorage.getItem(K.MATLIB_KEY) || '{}').presetOverrides.lacquer.clearcoat === 0.25);
    q('meReset').click();
    await wait(200);
    const dr = K.MATERIALS.get('lacquer');
    ok('8.5 Reset brings the coat back and clears the sheen', dr.clearcoat === 1 && !(dr.sheen > 0), JSON.stringify({ c: dr.clearcoat, s: dr.sheen, sc: dr.sheenColor }));
    ok('8.6 and the signature is stock again', K.materialDefSig(dr) === K.materialDefSig(Object.assign({ id: 'lacquer', preset: true }, K.MATERIAL_DEFAULTS.lacquer, { masks: K.presetMasks ? K.presetMasks(K.MATERIAL_DEFAULTS.lacquer) : [] })));

    /* 9. glTF */
    mark('gltf');
    try {
      const mod = await import('three/addons/exporters/GLTFExporter.js');
      const grp = K.buildExportGroup();
      const res = await new mod.GLTFExporter().parseAsync(grp, { binary: false });
      const ms = res.materials || [];
      const exts = ms.map(m => Object.keys(m.extensions || {}).join('+'));
      ok('9.0 coat exported', ms.some(m => m.extensions && m.extensions.KHR_materials_clearcoat), exts.join(' | '));
      ok('9.1 sheen exported', ms.some(m => m.extensions && m.extensions.KHR_materials_sheen), exts.join(' | '));
      ok('9.2 extensions declared', (res.extensionsUsed || []).indexOf('KHR_materials_clearcoat') >= 0 && (res.extensionsUsed || []).indexOf('KHR_materials_sheen') >= 0, (res.extensionsUsed || []).join(','));
    } catch (e) { ok('9.x glTF export', false, String(e && e.stack || e)); }

    /* 11. presets that carry masks (v3.02) */
    mark('preset-masks');
    try {
      const dw = K.MATERIALS.get('steelworn');
      ok('11.0 Worn metal has its three masks, filled in', dw.masks.length === 3 && dw.masks.every(m => m.blend && m.seed !== undefined), String(dw.masks.length));
      ok('11.1 they are its own copies', dw.masks[0] !== K.MATERIAL_DEFAULTS.steelworn.masks[0]);
      const stock = K.materialDefSig(dw);
      dw.masks[0].amount = 0.1;
      ok('11.2 an edit moves the signature', K.materialDefSig(dw) !== stock);
      K.saveMaterialLibrary();
      const lib = JSON.parse(localStorage.getItem(K.MATLIB_KEY));
      ok('11.3 the edited masks are written as an override', !!(lib.presetOverrides && lib.presetOverrides.steelworn && lib.presetOverrides.steelworn.masks.length === 3));
      K.openMatEditor('steelworn'); await wait(150);
      document.getElementById('meReset').click(); await wait(300);
      const dr2 = K.MATERIALS.get('steelworn');
      ok('11.4 Reset brings the preset masks back, not an empty list', dr2.masks.length === 3 && Math.abs(dr2.masks[0].amount - 0.8) < 1e-9, dr2.masks.length + ' ' + dr2.masks[0].amount);
      { const a1 = K.materialDefSig(dr2); let at = 0; while (at < a1.length && a1[at] === stock[at]) at++; ok('11.5 and the signature is stock again', a1 === stock, 'differs at ' + at + ': ' + stock.slice(Math.max(0, at - 40), at + 60) + ' <> ' + a1.slice(Math.max(0, at - 40), at + 60)); }
      const lib2 = JSON.parse(localStorage.getItem(K.MATLIB_KEY));
      ok('11.6 an untouched preset with masks writes no override', !(lib2.presetOverrides && lib2.presetOverrides.steelworn));
    } catch (e) { ok('11.x preset masks', false, String(e && e.stack || e)); }

    /* 11b. every preset mask sits inside the editor's slider ranges (else opening the editor rewrites it) */
    try {
      const bad = [];
      Object.keys(K.MATERIAL_DEFAULTS).forEach(id => {
        (K.MATERIALS.get(id).masks || []).forEach((m, i) => {
          const sp = K.maskTypeOf(m);
          const rng = (v, lo, hi) => v >= lo - 1e-9 && v <= hi + 1e-9;
          if (!rng(m.scale, sp.sMin !== undefined ? sp.sMin : 0.25, sp.sMax !== undefined ? sp.sMax : 20)) bad.push(id + '#' + i + ' scale ' + m.scale);
          if (!rng(m.contrast, sp.cMin !== undefined ? sp.cMin : 0.5, sp.cMax !== undefined ? sp.cMax : 3)) bad.push(id + '#' + i + ' contrast ' + m.contrast);
          if (sp.detail && !rng(m.detail, sp.dMin !== undefined ? sp.dMin : 1, sp.dMax !== undefined ? sp.dMax : 5)) bad.push(id + '#' + i + ' detail ' + m.detail);
          if (sp.detail && (sp.dStep === undefined || sp.dStep >= 1) && m.detail !== Math.round(m.detail)) bad.push(id + '#' + i + ' detail not whole ' + m.detail);
          if (!rng(m.amount, 0, 1) || !rng(m.rough, 0, 1)) bad.push(id + '#' + i + ' amount/rough');
          if ((sp.curv ? 1 : 0) + 0 > 1) bad.push('x');
        });
        const curvs = (K.MATERIALS.get(id).masks || []).filter(m => K.maskTypeOf(m).curv).length;
        if (curvs > 1) bad.push(id + ' has ' + curvs + ' curvature layers');
      });
      ok('11.7 preset masks inside editor ranges, at most one curvature layer each', bad.length === 0, bad.join('; '));
    } catch (e) { ok('11.7 ranges', false, String(e && e.stack || e)); }

    /* 10. the coat over a rounded edge: program must link (v3.00 review: clearcoatNormal patch) */
    mark('coat-bevel');
    try {
      const dl = K.MATERIALS.get('lacquer'); dl.bevel = 0.6;
      mk('cube', 'CoatBevel', 4, 'lacquer');
      K.updateMaterialEverywhere('lacquer'); K.ensureWearLists(); K.ensureMaskPatches();
      K.renderer.render(K.scene, K.camera);
      await wait(300);
      K.renderer.render(K.scene, K.camera);
      const progs = (K.renderer.info.programs || []);
      const bad = progs.filter(pr => pr.diagnostics && pr.diagnostics.runnable === false);
      ok('10.0 every program links with coat + round edges', bad.length === 0, progs.length + ' programs, ' + bad.length + ' broken');
      const gl = K.renderer.getContext();
      ok('10.1 no GL error', gl.getError() === 0);
    } catch (e) { ok('10.x coat+bevel', false, String(e && e.stack || e)); }

    finish();
  }
  function boot() {
    K = window.__kubik;
    if (!K || !K.App || !K.createPrimitiveObject || !K.restoreDoc) { setTimeout(boot, 120); return; }
    setTimeout(() => run().catch(e => finish('THREW ' + (e && e.stack ? e.stack : e))), 600);
  }
  boot();
  setTimeout(() => { if (OUT.length === 0 || OUT.join('').indexOf('VERDICT') < 0) finish('THREW timeout'); }, 120000);
})();
