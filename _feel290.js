/* v2.90 feel layer: mode swap class, touch ring, commit glow (added, then gone). */
(async function () {
  const wait = ms => new Promise(r => setTimeout(r, ms));
  const post = b => { const x = new XMLHttpRequest(); x.open('POST', '/result', true); x.send(b); };
  const out = []; let fails = 0;
  const ok = (n, c, d) => { out.push((c ? 'ok    ' : 'FAIL  ') + n + (d ? '  ' + d : '')); if (!c) fails++; };
  try {
    while (!(window.__kubik && window.__kubik.App)) await wait(50);
    await wait(1500);
    const K = window.__kubik, H = document.documentElement;
    K.App.objects.slice().forEach(o => { try { o.mesh.parent.remove(o.mesh); } catch (e) {} }); K.App.objects.length = 0;
    const mk = (n, k, x) => { const ed = K.buildPrimitiveEditable(k, k === 'sphere' ? { h: 16, v: 8 } : {});
      const o = K.createObjectFromEditable(n, new K.THREE.Vector3(x, 0, 0), ed, K.makeMaterialSet(ed.groups.length, 0x9aa3b2), {}); K.ensureHelpers(o); return o; };
    const A = mk('Cube', 'cube', 0);
    K.App.selectedObjectIds = new Set([A.id]); K.App.activeObjectId = A.id;
    K.setMode('object'); await wait(500);
    K.setMode('vertex'); await wait(30);
    ok('mode change puts mode-swap on <html>', H.classList.contains('mode-swap'), H.getAttribute('data-mode'));
    await wait(500);
    ok('and takes it off again', !H.classList.contains('mode-swap'));
    const btn = document.getElementById('btnMenu'), r = btn.getBoundingClientRect();
    btn.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, clientX: r.left + 5, clientY: r.top + 5 }));
    const ring = document.getElementById('touchRing');
    ok('a touch on a button opens the ring there', !!ring && ring.classList.contains('go') && ring.style.left === (r.left + 5) + 'px', ring && ring.style.left);
    btn.dispatchEvent(new PointerEvent('pointerup', { bubbles: true }));
    K.setMode('object'); await wait(400);
    const B = mk('Ball', 'sphere', 0.5);
    K.App.selectedObjectIds = new Set([A.id, B.id]); K.App.activeObjectId = null;
    K.booleanSelection();
    for (let i = 0; i < 200 && !K.App.opSetup; i++) await wait(25);
    const oid = K.App.opSetup.objId;
    K.finishOpSetup(true);
    await wait(60);
    const R = K.App.objects.find(o => o.id === oid);
    const glowOf = () => R && R.mesh.children.filter(c => c.isMesh && c.material && c.material.blending === K.THREE.AdditiveBlending).length;
    ok('the boolean result glows after OK', glowOf() === 1, 'glows ' + glowOf());
    await wait(700);
    ok('and the glow is gone after ~0.4s', glowOf() === 0, 'glows ' + glowOf());
    ok('the result is still there, its material untouched', !!R && R.mesh.visible && (Array.isArray(R.mesh.material) ? R.mesh.material[0] : R.mesh.material).blending === K.THREE.NormalBlending);
  } catch (e) { out.push('ERROR ' + e.stack); fails++; }
  out.push(fails ? 'FAILURES ' + fails : 'ALL GREEN');
  post(out.join('\n'));
})();
