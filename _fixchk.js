/* v2.3b's four correctness fixes, each with the sequence that used to break
   it. Real clock: two of them are about timers and one about a rebuild. */
(function () {
  const lines = [];
  const say = (s) => lines.push(s);
  let pass = 0, fail = 0;
  const ok = (name, good, detail) => {
    (good ? pass++ : fail++);
    say((good ? '  ok    ' : '  FAIL  ') + name.padEnd(34) + (detail || ''));
  };
  let done = false;
  function finish() {
    if (done) return; done = true;
    say('');
    say(fail ? 'VERDICT=FAIL (' + fail + ' of ' + (pass + fail) + ')'
             : 'VERDICT=PASS (' + pass + ' checks)');
    try { fetch('/report', { method: 'POST', body: lines.join('\n') }); } catch (_) {}
  }
  window.addEventListener('error', (e) => say('PAGE ERROR ' + e.message));
  const sleep = (ms) => new Promise(r => setTimeout(r, ms));

  function pickEdge(K) {
    const A = K.App, o = A.objects[0];
    K.setMode('edge');
    A.activeObjectId = o.id;
    A.selectedObjectIds = new Set([o.id]);
    K.ensureHelpers(o);
    A.selectedElements = new Set([0]);
    K.refreshUI();
    return o;
  }
  const barShown = () => document.getElementById('opBar').classList.contains('show');

  async function boot() {
    const K = window.__kubik, A = K.App;

    // ---- 1. a Load while an op bar is open --------------------------------
    say('1. Load with an op bar open');
    pickEdge(K);
    K.bevelSelection();
    await sleep(150);
    const opened = !!A.pendingOp && barShown();
    const doc = JSON.parse(JSON.stringify(K.serializeDoc()));
    K.restoreDoc(doc);
    await sleep(200);
    ok('bar opened to begin with', opened);
    ok('pendingOp abandoned by the load', !A.pendingOp,
       A.pendingOp ? 'STILL POINTS AT objId ' + A.pendingOp.objId : '');
    ok('and the bar is off screen', !barShown());

    // ---- 2. Undo with a non-live op bar open ------------------------------
    say('');
    say('2. Undo with a bevel bar open');
    pickEdge(K);
    K.bevelSelection();
    await sleep(150);
    K.setPendingAmount(0.08);
    K.flushPendingApply();
    K.confirmPendingOp();
    await sleep(200);
    const committed = A.historyIndex;
    pickEdge(K);
    K.bevelSelection();
    await sleep(150);
    ok('a second bevel bar is open', !!A.pendingOp && barShown());
    document.getElementById('btnUndo').click();
    await sleep(250);
    ok('first Undo takes the preview only', A.historyIndex === committed,
       'historyIndex ' + committed + ' -> ' + A.historyIndex +
       (A.historyIndex === committed ? '' : '  *** IT ATE A COMMITTED STEP'));
    ok('and the preview is gone', !A.pendingOp && !barShown());
    document.getElementById('btnUndo').click();
    await sleep(250);
    ok('second Undo steps history', A.historyIndex === committed - 1,
       'historyIndex -> ' + A.historyIndex);

    // ---- 3. the material card's hold, cancelled by a scroll ---------------
    say('');
    say('3. Material card long-press, cancelled');
    K.setMatTrayOpen(true);
    await sleep(500);
    const card = document.querySelector('#matTrayInner .mat-card');
    ok('a card is in the tray', !!card);
    if (card) {
      const editingBefore = document.getElementById('matFly').classList.contains('editing');
      card.dispatchEvent(new PointerEvent('pointerdown', { pointerId: 3, bubbles: true }));
      await sleep(80);
      // What the browser does when it claims the touch for a scroll.
      card.dispatchEvent(new PointerEvent('pointercancel', { pointerId: 3, bubbles: true }));
      await sleep(700);
      const editingAfter = document.getElementById('matFly').classList.contains('editing');
      ok('a cancelled hold opens nothing', !editingBefore && !editingAfter,
         editingAfter ? '*** THE EDITOR OPENED ON A SCROLL' : '');
    }
    K.setMatTrayOpen(false);
    await sleep(300);

    // ---- 4. the per-axis symmetry planes survive a round trip -------------
    say('');
    say('4. symPlanes through serialize/restore');
    const o = A.objects[0];
    K.captureSymmetryPlane(o, 'x');
    K.captureSymmetryPlane(o, 'y');
    const before = o.mesh.userData.symPlanes;
    const hadTwo = !!(before && before.x && before.y);
    ok('two axes captured', hadTwo);
    const bx = hadTwo ? before.x.offset : null, by = hadTwo ? before.y.offset : null;
    const doc2 = JSON.parse(JSON.stringify(K.serializeDoc()));
    ok('serializeDoc writes them', !!(doc2.objects[0] && doc2.objects[0].symPlanes &&
       doc2.objects[0].symPlanes.x && doc2.objects[0].symPlanes.y),
       doc2.objects[0] && doc2.objects[0].symPlanes ? '' : '*** DROPPED BY THE SAVE');
    K.restoreDoc(doc2);
    await sleep(250);
    const after = A.objects[0].mesh.userData.symPlanes;
    ok('and restoreDoc reads them back', !!(after && after.x && after.y),
       after ? '' : '*** GONE AFTER THE LOAD');
    if (after && after.x && after.y) {
      ok('with the same offsets', Math.abs(after.x.offset - bx) < 1e-9 &&
                                  Math.abs(after.y.offset - by) < 1e-9,
         'x ' + bx + ' -> ' + after.x.offset + ', y ' + by + ' -> ' + after.y.offset);
    }
    finish();
  }
  const go = () => setTimeout(() => { boot().catch(e => { say('THREW ' + e.message + '\n' + e.stack); finish(); }); }, 2200);
  if (document.readyState === 'complete') go(); else window.addEventListener('load', go);
})();
