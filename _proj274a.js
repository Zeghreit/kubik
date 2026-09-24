// v2.74a probe: Undo across New scene keeps the name, Save as asks before overwriting, Connect on a diagonal.
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
    for (const n of ['probeA', 'probeB']) { try { await K.deleteProject(n); } catch (e) {} }
    const p = K.createPrimitiveObject('plane', { h: 2, v: 2, x: 2, z: 2 }, 'Extra', new K.THREE.Vector3(3, 0, 0));
    A.activeObjectId = p.id; A.selectedObjectIds = new Set([p.id]);
    K.pushHistory();
    $('projName').value = 'probeA';
    $('btnProjSave').click();
    await wait(900);
    const n0 = A.objects.length;
    ok('0.setup: saved as probeA', LS() === 'probeA', 'ls=' + LS());

    $('btnNewScene').click();
    await wait(400);
    ok('1.New scene clears the name', LS() === '' && $('projCurrent').hidden, 'ls="' + LS() + '"');
    K.undo(); await wait(400);
    ok('1.Undo: objects back', A.objects.length === n0, A.objects.length + ' vs ' + n0);
    ok('1.Undo: name back', LS() === 'probeA' && !$('projCurrent').hidden, 'ls="' + LS() + '" note=' + $('projCurrent').textContent);
    K.redo(); await wait(400);
    ok('1.Redo: name cleared again', LS() === '' && A.objects.length === 1, 'ls="' + LS() + '" objs=' + A.objects.length);
    K.undo(); await wait(400);
    ok('1.Undo again: probeA', LS() === 'probeA', 'ls="' + LS() + '"');
    mark('1');

    // Save as a new name, then Undo a geometry step: the name must stay.
    $('projName').value = 'probeB';
    $('btnProjSaveAs').click();
    await wait(900);
    ok('2.Save as new name saves at once', LS() === 'probeB', 'ls=' + LS());
    const hi = A.historyIndex;
    K.undo(); await wait(400);
    ok('2.Undo after Save as keeps probeB', A.historyIndex === hi - 1 && LS() === 'probeB', 'idx ' + hi + '->' + A.historyIndex + ' ls=' + LS());
    K.redo(); await wait(300);
    mark('2');

    // Save as onto an existing name: first press refuses, second replaces.
    const t0 = (await K.readProject('probeA')).savedAt;
    $('toast').textContent = '';
    $('projName').value = 'probeA';
    $('btnProjSaveAs').click();
    await wait(900);
    const t1 = (await K.readProject('probeA')).savedAt;
    ok('3.first press does not overwrite', t1 === t0 && LS() === 'probeB', t0 + ' vs ' + t1 + ' ls=' + LS());
    ok('3.and says so', /already exists/.test($('toast').textContent), $('toast').textContent);
    $('btnProjSaveAs').click();
    await wait(900);
    const t2 = (await K.readProject('probeA')).savedAt;
    ok('3.second press replaces', t2 > t0 && LS() === 'probeA', t0 + ' -> ' + t2 + ' ls=' + LS());
    mark('3');

    // Connect across a quad's diagonal.
    const q = K.createPrimitiveObject('plane', { h: 1, v: 1, x: 2, z: 2 }, 'Quad', new K.THREE.Vector3(0, 0, 6));
    A.activeObjectId = q.id; A.selectedObjectIds = new Set([q.id]);
    K.pushHistory();
    K.setMode('vertex');
    K.ensureHelpers(q);
    const nL = q.mesh.userData.topo.logicalGroups.length;
    let lo = -1, hi2 = -1, best = Infinity, worst = -Infinity;
    for (let l = 0; l < nL; l++) {
      const v = K.logicalPos(q, l); const s = v.x + v.z;
      if (s < best) { best = s; lo = l; }
      if (s > worst) { worst = s; hi2 = l; }
    }
    const g0 = q.mesh.userData.topo.faceGroups.length, e0 = q.mesh.userData.topo.edges.length;
    A.selectedElements = new Set([lo, hi2]);
    $('toast').textContent = '';
    K.connectSelection();
    await wait(300);
    K.ensureHelpers(q); const g1 = q.mesh.userData.topo.faceGroups.length, e1 = q.mesh.userData.topo.edges.length;
    ok('4.Connect on the diagonal splits the quad', nL === 4 && g0 === 1 && g1 === 2 && e1 === e0 + 1, 'edges ' + e0 + '->' + e1 + ' ' +
       'topo=' + Object.keys(q.mesh.userData.topo).map(k => k + ':' + ((q.mesh.userData.topo[k] || {}).length)).join(',') + ' tris=' + q.mesh.geometry.index.count / 3 + ' verts=' + nL + ' groups ' + g0 + '->' + g1 + ' toast=' + $('toast').textContent);
    mark('4');

    for (const n of ['probeA', 'probeB']) { try { await K.deleteProject(n); } catch (e) {} }
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
