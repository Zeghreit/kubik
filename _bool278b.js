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
    const B = mk('Bite', 'sphere', { segments: 12, rings: 8 }, best.x, best.y, best.z);
    B.mesh.scale.setScalar(H * 0.04); B.mesh.updateMatrixWorld(true);
    K.ensureHelpers(A); K.ensureHelpers(B);
    const a0 = stats(A, 'A before');
    K.App.selectedObjectIds = new Set([A.id, B.id]);
    K.App.activeObjectId = null;
    const ok = await runBool('difference');
    say('boolean ' + (ok ? 'ran' : 'DID NOT OPEN'));
    const R = K.App.objects[K.App.objects.length - 1];
    K.ensureHelpers(R);
    const r = stats(R, 'Result');
    say('quads kept: ' + r.quad + ' of ' + a0.quad + '; triangles ' + r.tri);
    say('winding before ' + JSON.stringify(K.auditWinding(A.mesh.parent ? A : A)) );
    say('winding result ' + JSON.stringify(K.auditWinding(R)));
    say('result smooth angle ' + (R.mesh.userData.autoSmoothAngle * 180 / Math.PI).toFixed(0) + ', uv ' + !!R.mesh.geometry.attributes.uv);
  } catch (e) {
    say('ERROR=' + (e && e.stack ? e.stack.split('\n').slice(0, 6).join(' / ') : e));
  }
  post(out.join('\n'));
})();
