// v2.73 probe: Save writes over the open model, Save as takes a new name.
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
  let K = null;
  const $ = id => document.getElementById(id);
  const names = async () => (await K.listProjects()).map(p => p.name);
  const nObj = async n => { const r = await K.readProject(n); return r ? r.doc.objects.length : -1; };
  const curRow = () => { const r = document.querySelector('#projList .proj-row.cur'); return r ? r.dataset.name : ''; };
  const LS = () => { try { return localStorage.getItem('kubik.currentProject') || ''; } catch (e) { return '?'; } };

  async function run() {
    for (const n of await names()) if (/^probe/.test(n)) await K.deleteProject(n);
    await wait(300);
    // 0
    ok('0.nothing open: one Save button, no "Editing"', $('btnProjSaveAs').hidden && $('projCurrent').hidden,
       'asHidden=' + $('btnProjSaveAs').hidden + ' curHidden=' + $('projCurrent').hidden);
    // 1 first save names the model
    $('projName').value = 'probeA';
    $('btnProjSave').click();
    await wait(900);
    ok('1.first Save saves under the typed name', (await names()).includes('probeA'), (await names()).join(','));
    ok('1.and that model is now the open one', $('projCurrent').textContent === 'Editing "probeA"' &&
       !$('btnProjSaveAs').hidden && LS() === 'probeA' && curRow() === 'probeA',
       $('projCurrent').textContent + ' as=' + !$('btnProjSaveAs').hidden + ' ls=' + LS() + ' row=' + curRow());
    ok('1.the name box is cleared', $('projName').value === '', '"' + $('projName').value + '"');
    mark('1');
    // 2 Save again, nothing typed: overwrites
    const before = (await names()).length, a0 = await nObj('probeA');
    K.createPrimitiveObject('plane', { h: 1, v: 1, x: 1, z: 1 }, 'Extra', new K.THREE.Vector3(3, 0, 0));
    $('btnProjSave').click();
    await wait(900);
    const a1 = await nObj('probeA');
    ok('2.Save with nothing typed writes over the open model', a1 === a0 + 1 && (await names()).length === before,
       'objects ' + a0 + ' -> ' + a1 + ', saves ' + before + ' -> ' + (await names()).length);
    mark('2');
    // 3 Save as
    $('projName').value = 'probeB';
    $('btnProjSaveAs').click();
    await wait(900);
    ok('3.Save as makes a new save and switches to it',
       (await names()).includes('probeA') && (await names()).includes('probeB') && LS() === 'probeB' && curRow() === 'probeB',
       (await names()).filter(n => /^probe/.test(n)).join(',') + ' ls=' + LS());
    $('projName').value = '';
    $('btnProjSaveAs').click();
    await wait(300);
    ok('3.Save as with no name refuses', !(await names()).includes('') && LS() === 'probeB', 'ls=' + LS());
    mark('3');
    // 4 Enter with a name typed is Save as
    $('projName').value = 'probeC';
    $('projName').dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    await wait(900);
    ok('4.Enter with a name typed saves as that name', (await names()).includes('probeC') && LS() === 'probeC', 'ls=' + LS());
    mark('4');
    // 5 opening a saved model makes it the open one
    await K.loadProject('probeA');
    await wait(300);
    ok('5.opening a saved model makes it current', LS() === 'probeA' && curRow() === 'probeA', 'ls=' + LS() + ' row=' + curRow());
    // 6 deleting the open model clears it
    const row = document.querySelector('#projList .proj-row[data-name="probeA"] .proj-del');
    if (row) row.click();
    await wait(900);
    ok('6.deleting the open model clears it', !(await names()).includes('probeA') && LS() === '' &&
       $('btnProjSaveAs').hidden && $('projCurrent').hidden, 'ls="' + LS() + '"');
    mark('6');
    for (const n of await names()) if (/^probe/.test(n)) await K.deleteProject(n);
    finish();
  }
  function boot() {
    K = window.__kubik;
    if (!K || !K.App || !K.saveProject || !document.getElementById('btnProjSaveAs')) { setTimeout(boot, 120); return; }
    setTimeout(() => { run().catch(e => finish('THREW ' + (e && e.stack ? e.stack : e))); }, 1500);
  }
  boot();
  setTimeout(() => { if (!finished) finish('THREW watchdog - hung after: ' + (OUT[OUT.length - 1] || 'boot')); }, 110000);
})();
