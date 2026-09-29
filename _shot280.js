/* v2.80 screenshot: model U / - ball on the chest, committed with the topology
   type from ?topo=ngon|quads and ?op=union|difference, shown in Edge mode. */
(async function () {
  const wait = ms => new Promise(r => setTimeout(r, ms));
  const q = new URLSearchParams(location.search), topo = q.get('topo') || 'quads', op = q.get('op') || 'union';
  const post = b => { try { const x = new XMLHttpRequest(); x.open('POST', '/result', true); x.send(b); } catch (e) {} };
  try {
    while (!(window.__kubik && window.__kubik.App)) await wait(50);
    await wait(1500);
    const K = window.__kubik;
    K.App.objects.slice().forEach(o => { try { o.mesh.parent.remove(o.mesh); } catch (e) {} }); K.App.objects.length = 0;
    K.setMode('object');
    const doc = await (await fetch('/_dev/female.json')).json();
    K.restoreDoc(doc); await wait(300);
    const A = K.App.objects[0]; A.mesh.updateMatrixWorld(true);
    const box = new K.THREE.Box3().setFromObject(A.mesh), H = box.max.y - box.min.y;
    const pa = A.mesh.geometry.attributes.position, v = new K.THREE.Vector3();
    let best = null;
    for (let i = 0; i < pa.count; i++) { v.fromBufferAttribute(pa, i).applyMatrix4(A.mesh.matrixWorld);
      if (Math.abs(v.x) >= 0.06 * H || Math.abs(v.y - (box.min.y + 0.7 * H)) >= 0.04 * H) continue;
      if (!best || v.z > best.z) best = v.clone(); }
    const ed = K.buildPrimitiveEditable('sphere', { h: 16, v: 8 });
    const B = K.createObjectFromEditable('Ball', best.clone(), ed, K.makeMaterialSet(ed.groups.length, 0x9aa3b2), {});
    B.mesh.scale.setScalar(H * 0.07); B.mesh.updateMatrixWorld(true);
    K.ensureHelpers(A); K.ensureHelpers(B);
    K.App.selectedObjectIds = new Set([A.id, B.id]); K.App.activeObjectId = null;
    K.booleanSelection();
    for (let i = 0; i < 400 && !K.App.opSetup; i++) await wait(25);
    if (op === 'difference') Array.from(document.querySelectorAll('#opGrouping button')).find(b => b.textContent === 'Difference').click();
    Array.from(document.querySelectorAll('#opGrouping2 button')).find(b => b.textContent === (topo === 'quads' ? 'Quads' : 'N-gon')).click();
    const sd = +(q.get('seed') || 0);
    if (sd) { K.App.opSetup.p.seed = sd; K.refreshOpSetupMesh(); K.showOpSetupBar(); }
    const txt = document.getElementById('opReadout').textContent;
    const oid = K.App.opSetup.objId;
    K.finishOpSetup(true);
    const R = K.App.objects.find(o => o.id === oid);
    K.App.selectedObjectIds = new Set([R.id]); K.App.activeObjectId = R.id;
    K.setMode('edge');
    const r = H * 0.06, c = best;
    K.frameBox(new K.THREE.Box3(new K.THREE.Vector3(c.x - r, c.y - r, c.z - r), new K.THREE.Vector3(c.x + r, c.y + r, c.z + r)));
    await wait(2500);
    const cam = K.camera;
    // frameBox has put the orbit target on the ball; come in along the same line
    cam.position.sub(c).multiplyScalar(0.3).add(c);
    K.renderNow && K.renderNow();
    await wait(1000);
    post(topo + ' ' + op + ': ' + txt);
  } catch (e) { post('ERROR ' + e.stack); }
})();
