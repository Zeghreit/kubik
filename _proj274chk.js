// v2.74 probe: New scene - one cube, no saved model open, one Undo back.
(function () {
  const OUT = [];
  let fails = 0, finished = false;
  const say = s => OUT.push(s);
  const ok = (name, cond, detail) => {
    if (!cond) fails++;
    say((cond ? 'PASS ' : 'FAIL ') + name + (detail === undefined ? '' : '  ' + detail));
  };
  const post = (p, b) => { try { const x = new XMLHttpRequest(); x.open('POST', p, true); x.send(b); } catch (e) {} };
  const mark = s => post('/mark', 'at: ' + s + '\n' + OUT.join('\n'));
  function finish(extra) {
    if (finished) return;
    finished = true;
    if (extra) { say(extra); fails++; }
    say('VERDICT=' + (fails ? 'FAIL' : 'PASS') + ' (' + fails + ' failed)');
    post('/done', OUT.join('\n'));
  }
  const wait = ms => new Promise(r => setTimeout(r, ms));
  let K = null, A = null;
  const $ = id => document.getElementById(id);
  const LS = () => { try { return localStorage.getItem('kubik.currentProject') || ''; } catch (e) { return '?'; } };

  async function run() {
    A = K.App;
    const p = K.createPrimitiveObject('plane', { h: 2, v: 2, x: 2, z: 2 }, 'Extra', new K.THREE.Vector3(3, 0, 0));
    A.activeObjectId = p.id; A.selectedObjectIds = new Set([p.id]);
    K.pushHistory();
    $('projName').value = 'probeN';
    $('btnProjSave').click();
    await wait(900);
    K.setMode('uv');
    await wait(200);
    const n0 = A.objects.length, h0 = A.history.length;
    ok('0.setup: two objects, a saved model open, UV mode', n0 >= 2 && LS() === 'probeN' && A.mode === 'uv',
       'objects=' + n0 + ' ls=' + LS() + ' mode=' + A.mode);
    $('toast').textContent = '';
    $('btnNewScene').click();
    await wait(400);
    const o = A.objects[0];
    ok('1.one cube and nothing else', A.objects.length === 1 && o && o.name === 'Cube 1',
       A.objects.length + ' objects, ' + (o && o.name));
    ok('1.it is active and selected', o && A.activeObjectId === o.id && A.selectedObjectIds.has(o.id),
       'active=' + A.activeObjectId);
    ok('1.back in object mode', A.mode === 'object', 'mode=' + A.mode);
    ok('1.no saved model open any more', LS() === '' && $('btnProjSaveAs').hidden && $('projCurrent').hidden, 'ls="' + LS() + '"');
    ok('1.one history step', A.history.length === h0 + 1, h0 + ' -> ' + A.history.length);
    ok('1.and says Undo brings it back', /Undo/.test($('toast').textContent), $('toast').textContent);
    mark('1');
    K.undo();
    await wait(400);
    ok('2.Undo brings the old scene back', A.objects.length === n0, n0 + ' vs ' + A.objects.length);
    mark('2');
    await K.deleteProject('probeN');
    finish();
  }
  function boot() {
    K = window.__kubik;
    if (!K || !K.App || !K.newScene || !document.getElementById('btnNewScene')) { setTimeout(boot, 120); return; }
    setTimeout(() => { run().catch(e => finish('THREW ' + (e && e.stack ? e.stack : e))); }, 1500);
  }
  boot();
  setTimeout(() => { if (!finished) finish('THREW watchdog - hung after: ' + (OUT[OUT.length - 1] || 'boot')); }, 110000);
})();
