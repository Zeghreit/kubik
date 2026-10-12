/* v3.14c: the Export button writes one primitive per material, and Kubik
   reopens its own .glb with exactly the faces it had (_KUBIKFACE). The embed
   export path (no face numbers) is untouched. Run: python3 _cloudprobe.py _exportchk.js */
(async function () {
  const out = [];
  const say = s => { out.push(s); try { const x = new XMLHttpRequest(); x.open('POST', '/p', true); x.send(s); } catch (e) {} };
  const post = b => { try { const x = new XMLHttpRequest(); x.open('POST', '/result', true); x.send(b); } catch (e) {} };
  const wait = ms => new Promise(r => setTimeout(r, ms));
  let fails = 0;
  const check = (n, ok, note) => { if (!ok) fails++; say((ok ? 'PASS ' : 'FAIL ') + n + (note != null ? '  ' + note : '')); };
  const faces = o => K.toEditable(o.mesh).groups.length;
  let K;
  try {
    while (!(window.__kubik && window.__kubik.App)) await wait(50);
    await wait(1500);
    K = window.__kubik;
    K.App.objects.slice().forEach(o => { try { o.mesh.parent.remove(o.mesh); } catch (e) {} });
    K.App.objects.length = 0;
    // A 3x3 cube: nine coplanar quads per side, one material - the case a merge would fuse.
    const mk = (kind, p, x) => { const ed = K.buildPrimitiveEditable(kind, p); return K.createObjectFromEditable(kind, new K.THREE.Vector3(x, 0, 0), ed, K.makeMaterialSet(ed.groups.length || 1, 0x9aa3b2), {}); };
    const A = mk('cube', { h: 3, v: 3 }, 0), B = mk('cylinder', { h: 12, v: 2 }, 2), C = mk('sphere', {}, -2);
    K.pushHistory();
    const f0 = [A, B, C].map(faces);
    // Capture what the button downloads.
    let blob = null;
    const oc = URL.createObjectURL;
    URL.createObjectURL = b => { blob = b; return oc.call(URL, b); };
    const ck = HTMLAnchorElement.prototype.click;
    HTMLAnchorElement.prototype.click = function () {};
    document.getElementById('btnExportGlb').click();
    for (let i = 0; i < 200 && !blob; i++) await wait(50);
    URL.createObjectURL = oc; HTMLAnchorElement.prototype.click = ck;
    check('the button produced a file', !!blob, blob && blob.size);
    const buf = await blob.arrayBuffer();
    const dv = new DataView(buf), jl = dv.getUint32(12, true);
    const json = JSON.parse(new TextDecoder().decode(new Uint8Array(buf, 20, jl)));
    const prims = json.meshes.map(m => m.primitives.length);
    const totalFaces = f0.reduce((a, b) => a + b, 0);
    check('one primitive per material, not per face', prims.every(n => n <= 2), 'primitives ' + prims.join(',') + ' for ' + totalFaces + ' faces');
    check('face numbers written as _KUBIKFACE', json.meshes.every(m => m.primitives.every(p => '_KUBIKFACE' in p.attributes)));
    say('INFO ' + Math.round(buf.byteLength / 1024) + ' kB');
    const n0 = K.App.objects.length;
    await K.importGltfBuffer(buf, 'Round trip');
    for (let i = 0; i < 100 && K.App.objects.length === n0; i++) await wait(50);
    const back = K.App.objects.slice(n0);
    check('three objects came back', back.length === 3, back.length);
    const f1 = back.map(faces);
    check('every face came back, none merged', JSON.stringify(f1) === JSON.stringify(f0), f0.join(',') + ' -> ' + f1.join(','));
    back.forEach((o, i) => { const w = K.auditWinding(o); check('object ' + i + ' closed', w.boundary === 0 && w.nonManifold === 0, JSON.stringify(w)); });
  } catch (e) { fails++; say('ERROR ' + (e && e.stack || e)); }
  say(fails ? 'FAILURES ' + fails : 'ALL GREEN');
  post(out.join('\n'));
})();
