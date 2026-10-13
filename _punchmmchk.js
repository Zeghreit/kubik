/* v3.16a: Punch on a cube whose six faces wear six materials used to fail in
   three-bvh-csg (groupIndices). Run: python3 _cloudprobe.py _punchmmchk.js */
(async function () {
  const out = [];
  const say = s => { out.push(s); try { const x = new XMLHttpRequest(); x.open('POST', '/p', true); x.send(s); } catch (e) {} };
  const post = b => { try { const x = new XMLHttpRequest(); x.open('POST', '/result', true); x.send(b); } catch (e) {} };
  const wait = ms => new Promise(r => setTimeout(r, ms));
  let K;
  const S = () => K.App.opSetup;
  const V = (x, y, z) => new K.THREE.Vector3(x, y, z);
  try {
    while (!(window.__kubik && window.__kubik.App)) await wait(50);
    await wait(1500);
    K = window.__kubik;
    const cw = console.warn; console.warn = function () { try { say('WARN ' + Array.from(arguments).map(a => a && a.stack ? a.stack.split('\n').slice(0, 3).join(' / ') : String(a)).join(' ').slice(0, 400)); } catch (e) {} return cw.apply(console, arguments); };
    const ids = ['plastic', 'lacquer', 'ceramic', 'rubber', 'velvet', 'wood'];
    const ed = K.buildPrimitiveEditable('cube', {});
    const o = K.createObjectFromEditable('Obj', V(0, 0, 0), ed, ed.groups.map((g, i) => K.makeMaterialSet(1, 0x9aa3b2, ids[i % 6])[0]), {});
    K.pushHistory(); K.App.mode = 'object'; K.App.selectedObjectIds = new Set([o.id]); K.App.activeObjectId = null;
    K.punchSelection();
    for (let i = 0; i < 400 && !S(); i++) await wait(25);
    say('punch on a six-material cube: setup ' + (S() ? 'open' : 'refused') + ' toast "' + (document.getElementById('toast') || {}).textContent + '"');
    if (S()) { document.getElementById('opOk').click(); await wait(150); say('after OK: ' + K.App.objects.length + ' objects, toast "' + (document.getElementById('toast') || {}).textContent + '"'); }
  } catch (e) { say('ERROR ' + (e && e.stack || e)); }
  say(/after OK: 2 objects/.test(out.join(' ')) ? 'ALL GREEN' : 'FAILURES 1');
  post(out.join('\n'));
})();
