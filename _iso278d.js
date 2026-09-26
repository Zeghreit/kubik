/* v2.78d - the "N hidden" chip must be gone once a boolean is finished.
   Run: python3 _cloudprobe.py _iso278d.js */
(async function () {
  const out = [], say = s => out.push(s);
  const post = b => { try { const x = new XMLHttpRequest(); x.open('POST', '/result', true); x.send(b); } catch (e) {} };
  let K;
  const state = tag => {
    const chip = document.getElementById('isoChip');
    const shown = chip && !chip.hidden && getComputedStyle(chip).display !== 'none' && chip.classList.length >= 0 ? chip.className + '|hidden=' + chip.hidden : 'none';
    say(tag + ': objects ' + K.App.objects.map(o => o.name).join(', ') + ' | App.hidden ' + K.App.hidden.size +
        ' [' + Array.from(K.App.hidden).join(',') + '] ids [' + K.App.objects.map(o => o.id).join(',') + '] | chip ' + shown +
        ' | body.isolating ' + document.body.classList.contains('isolating'));
  };
  function mk(name, kind, x) {
    const ed = K.buildPrimitiveEditable(kind, {});
    return K.createObjectFromEditable(name, new K.THREE.Vector3(x, 0, 0), ed, K.makeMaterialSet(ed.groups.length || 1, 0x9aa3b2), {});
  }
  async function run(kind, keep, chipTo) {
    K.App.boolKeep = keep;
    K.booleanSelection();
    for (let i = 0; i < 400 && !K.opSetup; i++) await new Promise(r => setTimeout(r, 25));
    if (!K.opSetup) { say('setup did not open'); return; }
    state('  during preview');
    if (chipTo) { K.opSetup.p.kind = chipTo; K.refreshOpSetupMesh(); }
    K.finishOpSetup(true);
    await new Promise(r => setTimeout(r, 400));
  }
  try {
    while (!(window.__kubik && window.__kubik.App)) await new Promise(r => setTimeout(r, 50));
    await new Promise(r => setTimeout(r, 1500));
    K = window.__kubik;
    for (const [label, keep, chip] of [['union', false, null], ['union keep', true, null], ['union->difference', false, 'difference']]) {
      K.App.objects.slice().forEach(o => { try { o.mesh.parent.remove(o.mesh); } catch (e) {} });
      K.App.objects.length = 0; K.App.hidden = new Set(); K.setMode('object');
      const A = mk('A', 'cube', 0), B = mk('B', 'sphere', 0.6);
      K.App.selectedObjectIds = new Set([A.id, B.id]); K.App.activeObjectId = null;
      say('== ' + label);
      await run('union', keep, chip);
      K.refreshUI && K.refreshUI();
      state('  after OK');
      say('  CHECK ' + (K.App.hidden.size === 0 && !document.body.classList.contains('isolating') ? 'PASS' : 'FAIL'));
    }
  } catch (e) { say('ERROR=' + (e && e.stack ? e.stack.split('\n').slice(0, 5).join(' / ') : e)); }
  post(out.join('\n'));
})();
