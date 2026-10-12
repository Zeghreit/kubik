// v3.14 known limit 2 - run: PROBE_PORT=8862 PROBE_TIMEOUT=300 py _clean_probe.py _crosschk.js out.txt
// Does a TOLERANCE weld (cluster within 3.5e-4) close what the 1e-4 GRID weld
// leaves open? Snap the raw CSG result's near vertices together first, then
// hand it to the app's own editableFromCSGResult.
(async function () {
  const out = [], say = s => out.push(s);
  const post = b => { try { const x = new XMLHttpRequest(); x.open('POST', '/result', true); x.send(b); } catch (e) {} };
  const wait = ms => new Promise(r => setTimeout(r, ms));
  let K, T;
  function geoOf(ed, m) {
    const g = new T.BufferGeometry();
    g.setAttribute('position', new T.Float32BufferAttribute(ed.positions, 3));
    const idx = [];
    ed.groups.forEach(gr => { const s = idx.length; gr.triangles.forEach(t => idx.push(t[0], t[1], t[2])); g.addGroup(s, idx.length - s, 0); });
    g.setIndex(idx);
    if (m) g.applyMatrix4(m);
    g.computeVertexNormals();
    return g;
  }
  // Closed or not, T-junctions allowed: a closed surface has the same signed
  // volume from any origin, an open one does not.
  function rawGap(geo) {
    const pa = geo.attributes.position, ix = geo.index, n = ix ? ix.count : pa.count;
    const a = new T.Vector3(), b = new T.Vector3(), c = new T.Vector3(), o = new T.Vector3(10, 7, 3);
    let v1 = 0, v2 = 0;
    for (let i = 0; i + 2 < n; i += 3) {
      a.fromBufferAttribute(pa, ix ? ix.getX(i) : i); b.fromBufferAttribute(pa, ix ? ix.getX(i + 1) : i + 1);
      c.fromBufferAttribute(pa, ix ? ix.getX(i + 2) : i + 2);
      v1 += a.dot(b.clone().cross(c)) / 6;
      const A = a.clone().sub(o), B = b.clone().sub(o), C = c.clone().sub(o);
      v2 += A.dot(B.cross(C)) / 6;
    }
    return v1 - v2;
  }
  // Union-find over vertices closer than tol, every member moved onto its root.
  function snap(geo, tol) {
    const pa = geo.attributes.position, n = pa.count, cell = tol;
    const grid = new Map(), par = new Int32Array(n).map((_, i) => i);
    const find = i => { while (par[i] !== i) { par[i] = par[par[i]]; i = par[i]; } return i; };
    const key = (x, y, z) => x + '_' + y + '_' + z;
    for (let i = 0; i < n; i++) {
      const x = pa.getX(i), y = pa.getY(i), z = pa.getZ(i);
      const cx = Math.floor(x / cell), cy = Math.floor(y / cell), cz = Math.floor(z / cell);
      for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) for (let dz = -1; dz <= 1; dz++) {
        const l = grid.get(key(cx + dx, cy + dy, cz + dz));
        if (!l) continue;
        l.forEach(j => {
          const ex = pa.getX(j) - x, ey = pa.getY(j) - y, ez = pa.getZ(j) - z;
          if (ex * ex + ey * ey + ez * ez < tol * tol) { const a = find(i), b = find(j); if (a !== b) par[a] = b; }
        });
      }
      const k = key(cx, cy, cz);
      (grid.get(k) || grid.set(k, []).get(k)).push(i);
    }
    let moved = 0;
    for (let i = 0; i < n; i++) { const r = find(i); if (r !== i && (pa.getX(r) !== pa.getX(i) || pa.getY(r) !== pa.getY(i) || pa.getZ(r) !== pa.getZ(i))) { pa.setXYZ(i, pa.getX(r), pa.getY(r), pa.getZ(r)); moved++; } }
    pa.needsUpdate = true;
    return moved;
  }
  try {
    while (!(window.__kubik && window.__kubik.App)) await wait(50);
    await wait(1500);
    K = window.__kubik; T = K.THREE;
    const CSG = await import('three-bvh-csg');
    const mat = new T.MeshBasicMaterial();
    const fa = -15 * Math.PI / 180, R0 = 0.5 * Math.cos(15 * Math.PI / 180);
    function bore(px, pz, nx, nz, size, sides, L) {
      const ed = K.buildPrimitiveEditable('cylinder', { h: sides, v: 1, x: size, y: 2 * L, z: size });
      const n = new T.Vector3(nx, 0, nz).normalize(), u = new T.Vector3(0, 1, 0), w = new T.Vector3().crossVectors(u, n).normalize();
      const m = new T.Matrix4().makeBasis(u, n, w); m.setPosition(px, 0.1, pz);
      return geoOf(ed, m);
    }
    function ring(off, count, keep) {
      const th = off * Math.PI / 180, r = R0 / Math.cos(th - fa), res = [];
      for (let k = 0; k < (keep || count); k++) {
        const a = 2 * Math.PI * k / count;
        res.push(bore(r * Math.cos(th + a), r * Math.sin(th + a), Math.cos(fa + a), Math.sin(fa + a), 0.2, 12, 2));
      }
      return res;
    }
    const target = () => geoOf(K.buildPrimitiveEditable('cylinder', { h: 12, v: 1 }));
    const ev = new CSG.Evaluator();
    ev.attributes = ['position', 'normal']; ev.useCDTClipping = true; ev.useGroups = true; ev.consolidateGroups = true; ev.removeUnusedMaterials = true;
    // [tap angle, count, how many of them] - [-15, 6, 3] is the deduped even ring through the axis
    for (const cfg of [[-2.6, 4], [-2.6, 6], [-15, 6, 3], [-15, 8, 4], [-9, 6], [-9, 8]]) {
      for (const tol of [0, 3.5e-4]) {
        let acc = new CSG.Brush(target(), [mat]); acc.updateMatrixWorld();
        ring(cfg[0], cfg[1], cfg[2]).forEach(g => { const b = new CSG.Brush(g, [mat]); b.updateMatrixWorld(); acc = ev.evaluate(acc, b, CSG.SUBTRACTION); });
        const raw = rawGap(acc.geometry);   // the evaluator's own output, before any weld
        const moved = tol ? snap(acc.geometry, tol) : 0;
        const ed = K.editableFromCSGResult(acc, null, { type: 'ngon', seed: 0 });
        let aud = 'null';
        if (ed && ed.groups) { const o = K.createObjectFromEditable('X', new T.Vector3(), { positions: ed.positions, groups: ed.groups }, K.makeMaterialSet(ed.groups.length, 0x999999), {}); const w = K.auditWinding(o); aud = 'shells ' + w.shells + ' boundary ' + w.boundary + ' nm ' + w.nonManifold + ' faces ' + w.faces; o.mesh.parent.remove(o.mesh); K.App.objects.splice(K.App.objects.indexOf(o), 1); }
        say(('tap ' + cfg.join('/')).padEnd(14) + 'raw gap ' + raw.toExponential(1).padEnd(9) + (tol ? 'SNAP ' : 'grid ') + 'moved ' + String(moved).padEnd(5) + ' -> ' + aud + (ed && ed.capped ? ' CAPPED' : ''));
      }
    }
  } catch (e) { say('ERROR ' + e.stack); }
  post(out.join('\n'));
})();
