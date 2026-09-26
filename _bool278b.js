/* v2.78b - a smooth organic-ish mesh minus a small sphere. Zeghreit: the
   "Female" model came back fully triangulated with its shading broken.
   Measures faces, triangle-only faces, quads, and how many logical vertices
   carry a shading seam (attribute normals differing by > 20 deg).
   Run: python3 _cloudprobe.py _bool278b.js   (KUBIK_INDEX=... for an A/B) */
(async function () {
  const out = [];
  const say = s => out.push(s);
  let K;
  const post = b => { try { const x = new XMLHttpRequest(); x.open('POST', '/result', true); x.send(b); } catch (e) {} };

  function stats(o, tag) {
    const g = o.mesh.geometry, ed = K.toEditable(o.mesh);
    let tri = 0, quad = 0, big = 0;
    ed.groups.forEach((gr, gi) => {
      const n = K.getGroupBoundaryLoopAttr(ed, gi).length;
      if (n === 3) tri++; else if (n === 4) quad++; else big++;
    });
    // shading seams: same position, different normal
    const P = g.attributes.position, N = g.attributes.normal, by = new Map();
    for (let i = 0; i < P.count; i++) {
      const k = Math.round(P.getX(i) * 1e4) + '_' + Math.round(P.getY(i) * 1e4) + '_' + Math.round(P.getZ(i) * 1e4);
      if (!by.has(k)) by.set(k, []);
      by.get(k).push([N.getX(i), N.getY(i), N.getZ(i)]);
    }
    let seams = 0;
    by.forEach(l => {
      for (let a = 1; a < l.length; a++) {
        const d = l[0][0] * l[a][0] + l[0][1] * l[a][1] + l[0][2] * l[a][2];
        if (d < Math.cos(20 * Math.PI / 180)) { seams++; return; }
      }
    });
    say(tag + ': faces ' + ed.groups.length + ' (tri ' + tri + ', quad ' + quad + ', n-gon ' + big + '), vertices ' +
        by.size + ', seam vertices ' + seams);
    return { faces: ed.groups.length, tri: tri, quad: quad, seams: seams, verts: by.size };
  }

  async function runBool(kind) {
    K.booleanSelection();
    for (let i = 0; i < 400 && !K.opSetup; i++) await new Promise(r => setTimeout(r, 25));
    if (!K.opSetup) return false;
    if (K.opSetup.p.kind !== kind) { K.opSetup.p.kind = kind; K.refreshOpSetupMesh(); }
    K.finishOpSetup(true);
    return true;
  }
  function mk(name, kind, params, x, y, z) {
    const ed = K.buildPrimitiveEditable(kind, params || {});
    const mats = K.makeMaterialSet(ed.groups.length || 1, 0x9aa3b2);
    return K.createObjectFromEditable(name, new K.THREE.Vector3(x || 0, y || 0, z || 0), ed, mats, {});
  }

  function closeUp() {
    const h = window.__hole; if (!h) return;
    const c = K.camera;
    c.position.set(h.x + 0.16, h.y + 0.05, h.z + 0.08);
    c.lookAt(h); c.updateMatrixWorld(true);
    window.__lockCam = () => { const cc = K.camera; cc.position.set(h.x + 0.16, h.y + 0.05, h.z + 0.08); cc.lookAt(h); cc.updateMatrixWorld(true); };
    const tick = () => { window.__lockCam(); if (K.renderNow) K.renderNow(); requestAnimationFrame(tick); };
    tick();
  }
  try {
    while (!(window.__kubik && window.__kubik.App)) await new Promise(r => setTimeout(r, 50));
    await new Promise(r => setTimeout(r, 1500));
    K = window.__kubik;
    K.App.objects.slice().forEach(o => { try { o.mesh.parent.remove(o.mesh); } catch (e) {} });
    K.App.objects.length = 0;
    K.setMode('object');

    // A: Zeghreit's test model (_dev/female.json), B: a small sphere biting
    // its side at mid height.
    const doc = await (await fetch('/_dev/female.json')).json();
    K.restoreDoc(doc);
    await new Promise(r => setTimeout(r, 300));
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
    say('model: ' + A.name + ', height ' + H.toFixed(3) + ', smooth angle ' +
        (A.mesh.userData.autoSmoothAngle * 180 / Math.PI).toFixed(0));
    window.__hole = best.clone();
    const B = /cube/.test(location.search) ? mk('Box', 'cube', {}, best.x, best.y, best.z) : mk('Bite', 'sphere', { segments: 12, rings: 8 }, best.x, best.y, best.z);
    B.mesh.scale.setScalar(H * 0.04); B.mesh.updateMatrixWorld(true);
    K.ensureHelpers(A); K.ensureHelpers(B);
    const a0 = stats(A, 'A before');
    const union = /union/.test(location.search);
    K.App.selectedObjectIds = union ? new Set([B.id, A.id]) : new Set([A.id, B.id]);
    K.App.activeObjectId = null;
    if (/nobool/.test(location.search)) {
      K.App.objects.slice(1).forEach(o => { try { o.mesh.parent.remove(o.mesh); } catch (e) {} });
      K.App.objects.length = 1;
      closeUp();
      post(out.join('\n'));
      return;
    }
    const ok = await runBool(union ? 'union' : 'difference');
    say('boolean ' + (ok ? 'ran' : 'DID NOT OPEN'));
    const R = K.App.objects[K.App.objects.length - 1];
    K.ensureHelpers(R);
    const r = stats(R, 'Result');
    K.applyShading(R); stats(R, 'Result after applyShading');
    { const t = R.mesh.userData.topo, es = R.mesh.userData.edgeShade || {}; let hit = 0, sharp = 0, smooth = 0;
      t.edges.forEach(e => { const pa = K.logicalPos(R, e[0]), pb = K.logicalPos(R, e[1]);
        const ka = Math.round(pa.x * 1e4) + '_' + Math.round(pa.y * 1e4) + '_' + Math.round(pa.z * 1e4), kb = Math.round(pb.x * 1e4) + '_' + Math.round(pb.y * 1e4) + '_' + Math.round(pb.z * 1e4);
        const k = ka < kb ? ka + '|' + kb : kb + '|' + ka; if (es[k]) { hit++; if (es[k] === 'sharp') sharp++; else smooth++; } });
      { const ks = Object.keys(es).slice(0, 2); say('sample marks ' + ks.join(' ; '));
        const pa = K.logicalPos(R, t.edges[0][0]); say('R.pos ' + R.mesh.position.toArray().map(x => x.toFixed(4)) + ' first vertex ' + [pa.x, pa.y, pa.z].map(x => x.toFixed(4)));
        const near = []; const m0 = ks[0] && ks[0].split('|')[0].split('_').map(n => n / 1e4);
        if (m0) { for (let l = 0; l < t.logicalCount; l++) { const q = K.logicalPos(R, l); const d = Math.hypot(q.x - m0[0], q.y - m0[1], q.z - m0[2]); near.push([d, l]); }
          near.sort((x, y) => x[0] - y[0]); say('nearest vertex to first mark end: d=' + near[0][0].toFixed(5)); } }
      say('marks ' + Object.keys(es).length + ', on real edges ' + hit + ' (sharp ' + sharp + ', smooth ' + smooth + '), result angle ' +
          (R.mesh.userData.autoSmoothAngle * 180 / Math.PI).toFixed(0) + ', B angle ' + (B.mesh.userData.autoSmoothAngle === undefined ? 'default' : (B.mesh.userData.autoSmoothAngle * 180 / Math.PI).toFixed(0)));
    }
    say('quads kept: ' + r.quad + ' of ' + a0.quad + '; triangles ' + r.tri);
    const bA = new K.THREE.Box3().setFromObject(A.mesh), bR = new K.THREE.Box3().setFromObject(R.mesh);
    say('A pos ' + A.mesh.position.toArray().map(x => x.toFixed(3)) + ' scale ' + A.mesh.scale.toArray().map(x => x.toFixed(3)) +
        ' box y ' + bA.min.y.toFixed(3) + '..' + bA.max.y.toFixed(3));
    say('R pos ' + R.mesh.position.toArray().map(x => x.toFixed(3)) + ' scale ' + R.mesh.scale.toArray().map(x => x.toFixed(3)) +
        ' box y ' + bR.min.y.toFixed(3) + '..' + bR.max.y.toFixed(3));
    say('R material count ' + (Array.isArray(R.mesh.material) ? R.mesh.material.length : 1) + ', A ' + (Array.isArray(A.mesh.material) ? A.mesh.material.length : 1) +
        '; A mat0 ' + JSON.stringify({ type: (A.mesh.material[0] || A.mesh.material).type, flat: (A.mesh.material[0] || A.mesh.material).flatShading, rough: (A.mesh.material[0] || A.mesh.material).roughness, metal: (A.mesh.material[0] || A.mesh.material).metalness, color: (A.mesh.material[0] || A.mesh.material).color.getHexString() }) +
        '; R mat0 ' + JSON.stringify({ type: (R.mesh.material[0] || R.mesh.material).type, flat: (R.mesh.material[0] || R.mesh.material).flatShading, rough: (R.mesh.material[0] || R.mesh.material).roughness, metal: (R.mesh.material[0] || R.mesh.material).metalness, color: (R.mesh.material[0] || R.mesh.material).color.getHexString() }));
    const ka = Object.keys(A.mesh.userData), kr = Object.keys(R.mesh.userData);
    say('userData only on A: ' + ka.filter(k => kr.indexOf(k) < 0).join(',') + ' | only on R: ' + kr.filter(k => ka.indexOf(k) < 0).join(','));
    const summ = v => v == null ? String(v) : typeof v === 'object' ? (Array.isArray(v) ? 'array ' + v.length : 'obj ' + Object.keys(v).length + ' ' + JSON.stringify(v).slice(0, 80)) : String(v);
    ['finishes', 'smoothGroups', 'wantsWear', 'matSide', 'autoSmoothAngle', 'edgeShade', 'creases'].forEach(k =>
      say('  ' + k + ': A ' + summ(A.mesh.userData[k]) + ' | R ' + summ(R.mesh.userData[k])));
    say('userData A ' + Object.keys(A.mesh.userData).sort().join(',') + ' | R ' + Object.keys(R.mesh.userData).sort().join(','));
    say('winding before ' + JSON.stringify(K.auditWinding(A.mesh.parent ? A : A)) );
    say('winding result ' + JSON.stringify(K.auditWinding(R)));
    closeUp();
    say('result smooth angle ' + (R.mesh.userData.autoSmoothAngle * 180 / Math.PI).toFixed(0) + ', uv ' + !!R.mesh.geometry.attributes.uv);
  } catch (e) {
    say('ERROR=' + (e && e.stack ? e.stack.split('\n').slice(0, 6).join(' / ') : e));
  }
  post(out.join('\n'));
})();
