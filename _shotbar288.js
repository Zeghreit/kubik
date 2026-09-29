/* v2.88 - the Boolean bar in the hybrid design: cube + sphere, bar left open on Loops. */
(async function () {
  const wait = ms => new Promise(r => setTimeout(r, ms));
  const post = b => { try { const x = new XMLHttpRequest(); x.open('POST', '/result', true); x.send(b); } catch (e) {} };
  try {
    while (!(window.__kubik && window.__kubik.App)) await wait(50);
    await wait(1500);
    const K = window.__kubik;
    K.App.objects.slice().forEach(o => { try { o.mesh.parent.remove(o.mesh); } catch (e) {} }); K.App.objects.length = 0;
    K.setMode('object');
    const mk = (n, k, p, x) => { const ed = K.buildPrimitiveEditable(k, p); const o = K.createObjectFromEditable(n, new K.THREE.Vector3(x, 0, 0), ed, K.makeMaterialSet(ed.groups.length, 0x9aa3b2), {}); K.ensureHelpers(o); return o; };
    const A = mk('Cube', 'cube', {}, 0), B = mk('Ball', 'sphere', { h: 16, v: 8 }, 0.5);
    K.App.selectedObjectIds = new Set([A.id, B.id]); K.App.activeObjectId = null;
    K.booleanSelection();
    for (let i = 0; i < 400 && !K.App.opSetup; i++) await wait(25);
    const chip = t => Array.from(document.querySelectorAll('#opGrouping2 button')).find(b => b.textContent === t);
    chip('Loops').click();
    await wait(800);
    const bar = document.getElementById('opBar'), r = bar.getBoundingClientRect();
    const btns = Array.from(bar.querySelectorAll('button')).filter(b => b.offsetParent).map(b => { const q = b.getBoundingClientRect(); return b.textContent.trim().slice(0, 12) + ' ' + Math.round(q.width) + 'x' + Math.round(q.height); });
    const over = bar.scrollWidth > bar.clientWidth + 1 || r.right > innerWidth + 1 || r.left < -1;
    post('viewport ' + innerWidth + 'x' + innerHeight + ' bar ' + Math.round(r.width) + 'x' + Math.round(r.height) + ' overflow ' + over +
         ' | readout: ' + document.getElementById('opReadout').textContent + ' | buttons: ' + btns.join(', '));
  } catch (e) { post('ERROR ' + e.stack); }
})();
