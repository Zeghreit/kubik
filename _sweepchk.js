/* v2.8b: five correctness fixes, each with the sequence that broke it.
   Verified against _bak_v28.html, where four of them fail.
   (The bin-flush one has no seam from outside - opMatBin is module state -
   so it is asserted as "the branch is taken and nothing throws".) */
(function () {
  const lines = [];
  const say = (s) => lines.push(s);
  let pass = 0, fail = 0;
  const ok = (name, good, detail) => {
    (good ? pass++ : fail++);
    say((good ? '  ok    ' : '  FAIL  ') + name.padEnd(44) + (detail || ''));
  };
  let done = false;
  const errs = [];
  function finish() {
    if (done) return; done = true;
    say('');
    say(fail ? 'VERDICT=FAIL (' + fail + ' of ' + (pass + fail) + ')'
             : 'VERDICT=PASS (' + pass + ' checks)');
    try { fetch('/report', { method: 'POST', body: lines.join('\n') }); } catch (_) {}
  }
  window.addEventListener('error', (e) => errs.push('window: ' + e.message));
  const sleep = (ms) => new Promise(r => setTimeout(r, ms));
  const mark = (w) => { try { fetch('/mark', { method: 'POST', body: lines.join('\n') + '\n>>> reached ' + w }); } catch (_) {} };
  const toastText = () => (document.getElementById('toast') || {}).textContent || '';
  const verts = (o) => o.mesh.geometry.attributes.position.count;

  async function boot() {
    const K = window.__kubik, App = K.App;
    setTimeout(() => { if (!done) { say(''); say('*** WATCHDOG ***'); finish(); } }, 90000);

    // ---- 1. an op that throws puts the shape back and closes the bar ------
    say('1. a thrown op does not leave a half-built mesh under an open bar');
    const cube = App.objects[0];
    App.mode = 'face';
    App.activeObjectId = cube.id;
    App.selectedObjectIds = new Set([cube.id]);
    App.selectedElements = new Set([0]);
    K.ensureHelpers(cube);
    K.refreshUI();
    const v0 = verts(cube);
    K.insetSelection();          // the same entry point the ring uses
    K.refreshUI();
    await sleep(150);
    ok('an op bar is open', !!App.pendingOp, App.pendingOp ? App.pendingOp.kind : 'none');
    if (App.pendingOp) {
      K.setPendingAmount(0.2);
      K.flushPendingApply();
      await sleep(150);
      const vMid = verts(cube);
      ok('and it changed the mesh', vMid !== v0, v0 + ' -> ' + vMid);
      /* THE SEAM. payload is read AFTER restoreObjectState has already put
         the snapshot back this frame, so the throw lands with the shape in
         exactly the state the wrapper has to leave behind. */
      App.pendingOp.payload = null;
      K.applyPendingOp();
      await sleep(200);
      ok('the bar is closed', !App.pendingOp);
      ok('the shape is back as it was', verts(cube) === v0, v0 + ' vs ' + verts(cube));
      ok('and it said so', /could not finish/i.test(toastText()), toastText().slice(0, 44));
    }
    mark('2');

    // ---- 2. the object-gone branch is taken cleanly -----------------------
    say('');
    say('2. an object deleted from under an open bar');
    App.selectedElements = new Set([0]);
    K.insetSelection();
    await sleep(120);
    const had = !!App.pendingOp;
    if (App.pendingOp) App.pendingOp.objId = 99999;      // as if it had been deleted
    let threw2 = null;
    try { K.applyPendingOp(); } catch (e) { threw2 = e && e.message; }
    await sleep(120);
    ok('the bar closes without throwing', had && !App.pendingOp && !threw2,
       threw2 || (had ? 'closed' : 'no op opened'));

    // ---- 3. Slide does not borrow another op's reason ---------------------
    say('');
    say('3. Slide explains itself, not the last refusal');
    K.refuseOp('STALE-MARKER-FROM-ANOTHER-OP');
    K.setMode('vertex');
    App.activeObjectId = cube.id;
    K.ensureHelpers(cube);
    /* One corner vertex of a cube: there is no loop to slide, so Slide
       refuses - and the question is WHOSE reason it gives. */
    App.selectedElements = new Set([0]);
    K.slideSelection();
    await sleep(150);
    const t3 = toastText();
    ok('it did refuse', !!t3, t3.slice(0, 50));
    ok('and not with the stale reason', t3.indexOf('STALE-MARKER') < 0, t3.slice(0, 50));
    mark('4');

    // ---- 4. the toast waits for the share sheet to be answered ------------
    say('');
    say('4. a cancelled share does not read as saved');
    const realMatch = window.matchMedia;
    const realCanShare = navigator.canShare;
    const realShare = navigator.share;
    const realClick = HTMLAnchorElement.prototype.click;
    let downloads = 0;
    HTMLAnchorElement.prototype.click = function () {
      if (this.download) downloads++; else realClick.call(this);
    };
    window.matchMedia = (q) => (String(q).indexOf('pointer: coarse') >= 0)
      ? { matches: true, media: q, addListener() {}, removeListener() {} }
      : realMatch.call(window, q);
    navigator.canShare = () => true;

    // a sheet that is cancelled
    let settle; const held = new Promise(r => { settle = r; });
    navigator.share = () => held;
    document.getElementById('toast').textContent = '';
    downloads = 0;
    K.downloadBlob(['x'], 'a.obj', 'text/plain', 'Exported .obj');
    await sleep(60);
    ok('nothing is claimed while the sheet is open', toastText() === '',
       toastText().slice(0, 40) || '(silent)');
    settle(Promise.reject(Object.assign(new Error('x'), { name: 'AbortError' })));
    await sleep(120);
    ok('and cancelling says nothing at all', toastText() === '' && downloads === 0,
       '"' + toastText().slice(0, 30) + '" / ' + downloads + ' download(s)');

    // a sheet that is accepted
    navigator.share = () => Promise.resolve();
    document.getElementById('toast').textContent = '';
    K.downloadBlob(['x'], 'b.obj', 'text/plain', 'Exported .obj');
    await sleep(150);
    ok('an accepted share does say so', toastText() === 'Exported .obj', toastText().slice(0, 40));

    // and a plain desktop download still says so immediately
    window.matchMedia = realMatch;
    Object.defineProperty(navigator, 'canShare', { value: undefined, configurable: true });
    document.getElementById('toast').textContent = '';
    downloads = 0;
    K.downloadBlob(['x'], 'c.obj', 'text/plain', 'Exported .obj');
    await sleep(60);
    ok('a download says so straight away', toastText() === 'Exported .obj' && downloads === 1,
       toastText().slice(0, 30) + ' / ' + downloads + ' download(s)');
    HTMLAnchorElement.prototype.click = realClick;
    if (realCanShare) navigator.canShare = realCanShare;
    if (realShare) navigator.share = realShare;

    // ---- 5. a saved doc does not alias the live library -------------------
    say('');
    say('5. a serialised doc owns its own materials');
    const doc = K.serializeDoc();
    const live = K.getMaterialDef('standard');
    const inDoc = (doc.materialLib || []).filter(d => d.id === 'standard')[0];
    ok('the doc has the definition', !!inDoc);
    ok('but not the SAME object', !!inDoc && inDoc !== live);
    /* The consequence, which is the thing that actually bit: edit the live
       definition and the doc must not change under whoever is holding it. */
    const wasName = inDoc && inDoc.name;
    live.name = 'Renamed after the save';
    ok('editing the library leaves the doc alone', !!inDoc && inDoc.name === wasName,
       inDoc ? inDoc.name : '?');
    live.name = wasName;

    say('');
    say('6. nothing complained');
    ok('no page errors', errs.length === 0, errs.slice(0, 2).join(' | '));
    finish();
  }
  let started = false;
  const go = () => { if (started) return; started = true;
    /* A THROW IS A FAILURE, not a short report. Counted as one, or a build
       where the very thing under test escapes into the caller comes back
       saying PASS with two checks in it - which is how the pre-fix build
       reported the bug this probe exists to catch. */
    boot().catch(e => {
      ok('the probe ran to the end', false, 'THREW ' + (e && e.message));
      say((e && e.stack) || '');
      finish();
    }); };
  setTimeout(go, 3000);
})();
