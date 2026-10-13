/* Heavy-mesh scaling bench (plan toward ~1M faces). UV spheres of growing size,
   created past the import budget. CPU-side costs only - SwiftShader frame time
   is about this CPU, not a phone GPU. Run: PROBE_TIMEOUT=900 python3 _cloudprobe.py _heavyscale.js */
(async function () {
  const out = [];
  const say = s => { out.push(s); try { const x = new XMLHttpRequest(); x.open('POST', '/p', true); x.send(s); } catch (e) {} };
  const post = b => { try { const x = new XMLHttpRequest(); x.open('POST', '/result', true); x.send(b); } catch (e) {} };
  const wait = ms => new Promise(r => setTimeout(r, ms));
  const ms = x => x.toFixed(1) + 'ms';
  const t = (f, n) => { n = n || 1; const a = performance.now(); for (let i = 0; i < n; i++) f(); return (performance.now() - a) / n; };
  const mem = () => performance.memory ? Math.round(performance.memory.usedJSHeapSize / 1048576) + 'MB' : '?';
  try {
    while (!(window.__kubik && window.__kubik.App)) await wait(50);
    await wait(1500);
    const K = window.__kubik, V = (x, y, z) => new K.THREE.Vector3(x, y, z);
    const sizes = (window.location.search.match(/sizes=([\d,x]+)/) || [, '64x48,128x96,256x192,360x280,512x400'])[1].split(',');
    say('size | faces | build (of it import) | rebuild(op) | applyShading | syncHelpers | history push | step bytes | vertex pick | render | heap');
    for (const sz of sizes) {
      const [h, v] = sz.split('x').map(Number);
      K.App.objects.slice().forEach(o => { try { o.mesh.parent.remove(o.mesh); } catch (e) {} });
      K.App.objects.length = 0;
      let o, ed;
      let tImp = 0;
      const tb = t(() => {
        const g = new K.THREE.SphereGeometry(0.5, h, v), pa = g.attributes.position;
        // A rough surface, so the importer's coplanar merge leaves every face a face.
        let sd = 1; const rnd = () => ((sd = (sd * 16807) % 2147483647) / 2147483647);
        const bump = new Map();
        for (let i = 0; i < pa.count; i++) { const k = pa.getX(i).toFixed(5) + pa.getY(i).toFixed(5) + pa.getZ(i).toFixed(5); if (!bump.has(k)) bump.set(k, 1 + 0.3 * (rnd() - 0.5) * (Math.PI / v)); const f = bump.get(k); pa.setXYZ(i, pa.getX(i) * f, pa.getY(i) * f, pa.getZ(i) * f); }
        const m = new K.THREE.Mesh(g, new K.THREE.MeshStandardMaterial());
        m.updateMatrixWorld(true);
        const a = performance.now();
        ed = K.editableFromImportedMeshes([m]);   // the importer's own path: weld, tris -> quads
        tImp = performance.now() - a;
        o = K.createObjectFromEditable('S', V(0, 0, 0), ed, K.makeMaterialSet(1, 0x9aa3b2), {});
      });
      const faces = K.toEditable(o.mesh).groups.length;
      await wait(50);
      const e2 = K.toEditable(o.mesh);
      const tr = t(() => K.rebuildFromEditable(o, e2));
      const ts = t(() => K.applyShading(o), 3);
      K.App.activeObjectId = o.id;
      const th = t(() => K.syncHelperGeometry(o), 3);
      const tp = t(() => K.pushHistory());
      const bytes = K.estimateDocBytes ? K.estimateDocBytes(K.serializeDoc()) : JSON.stringify(K.serializeDoc()).length;
      K.setMode('vertex'); await wait(30);
      const r = K.renderer.domElement.getBoundingClientRect();
      const ev = { clientX: r.left + r.width / 2, clientY: r.top + r.height / 2 };
      let tv = NaN; try { tv = t(() => K.pickVertexOnActive(ev), 3); } catch (e) { say('pick error ' + e.message); }
      K.setMode('object');
      const tf = t(() => K.renderer.render(K.scene, K.camera), 3);
      say(`${sz} | ${faces} | ${ms(tb)} (${ms(tImp)}) | ${ms(tr)} | ${ms(ts)} | ${ms(th)} | ${ms(tp)} | ${Math.round(bytes / 1024)}kB | ${ms(tv)} | ${ms(tf)} | ${mem()}`);
    }
  } catch (e) { say('ERROR ' + (e && e.stack || e)); }
  say('DONE');
  post(out.join('\n'));
})();
