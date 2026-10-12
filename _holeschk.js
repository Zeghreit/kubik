// v3.14 known limit 1 - run: PROBE_PORT=8862 PROBE_TIMEOUT=300 py _clean_probe.py _holeschk.js out.txt
// Is "many holes in one flat face come back open in N-gon" the Boolean's own
// limit (code v3.14 did not touch), or the pattern's? Plain booleanBuild with
// real cylinder objects through a bar.
(async function () {
  const out = [], say = s => out.push(s);
  const post = b => { try { const x = new XMLHttpRequest(); x.open('POST', '/result', true); x.send(b); } catch (e) {} };
  const wait = ms => new Promise(r => setTimeout(r, ms));
  try {
    while (!(window.__kubik && window.__kubik.App)) await wait(50);
    await wait(1500);
    const K = window.__kubik, T = K.THREE;
    const mk = (kind, params, pos) => {
      const ed = K.buildPrimitiveEditable(kind, params);
      return K.createObjectFromEditable(kind, pos || new T.Vector3(), ed, K.makeMaterialSet(ed.groups.length, 0x9aa3b2), {});
    };
    // The engine loads on the first Punch: open one and drop it.
    const warm = mk('cube', {});
    K.setMode('object'); K.App.selectedObjectIds = new Set([warm.id]); K.punchSelection();
    for (let i = 0; i < 400 && !K.App.opSetup; i++) await wait(25);
    K.finishOpSetup(false);
    for (const n of [1, 2, 4, 8, 12, 24]) {
      K.App.objects.slice().forEach(o => { try { o.mesh.parent.remove(o.mesh); } catch (e) {} });
      K.App.objects.length = 0;
      const bar = mk('cube', { h: 1, v: 1, x: 8, y: 1, z: 1 });
      const cyl = [];
      for (let k = 0; k < n; k++) cyl.push(mk('cylinder', { h: 12, v: 1, x: 0.2, y: 2, z: 0.2 }, new T.Vector3((k - (n - 1) / 2) * 0.3, 0, 0)));
      const row = [];
      for (const type of ['ngon', 'tris', 'quads', 'loops']) {
        const r = K.booleanBuild([bar].concat(cyl), 'difference', { type: type });
        if (!r.ok) { row.push(type + ' REFUSED ' + r.why); continue; }
        const o = K.createObjectFromEditable('R', new T.Vector3(), r.ed, r.mats, {});
        const w = K.auditWinding(o);
        row.push(type + ' b' + w.boundary + (r.note ? '(' + r.note + ')' : ''));
        o.mesh.parent.remove(o.mesh); K.App.objects.splice(K.App.objects.indexOf(o), 1);
      }
      say(String(n).padStart(2) + ' holes: ' + row.join('  '));
    }
  } catch (e) { say('ERROR ' + e.stack); }
  post(out.join('\n'));
})();
