/* The six defects the a2.36 review found, each driven the way a user hits it. */
(function () {
  var out = [], errs = [];
  var _ce = console.error;
  console.error = function () { errs.push(Array.prototype.join.call(arguments, ' ')); _ce.apply(console, arguments); };
  function log(k, v) { out.push(k + '=' + v); }
  var k, A, steps = [], si = 0;
  function step(fn) { steps.push(fn); }
  function barShown() { return document.getElementById('geoBar').classList.contains('show'); }
  function vr() { return document.getElementById('viewport').getBoundingClientRect(); }
  function atObj(o) {
    var r = vr(), sp = k.worldToScreenPx(o.mesh.position.clone());
    return sp ? { clientX: sp.x + r.left, clientY: sp.y + r.top, pointerId: 1, pointerType: 'touch' } : null;
  }

  // 1. Dragging the new primitive into place must not push its own step.
  step(function () {
    k = window.__kubik; A = k.App;
    k.startGeoSetup('cube');
    var o = k.findObject(A.geoSetup.objId);
    o.mesh.position.set(4.5, 0.5, 4.5); o.mesh.updateMatrixWorld(true);
    var h0 = A.historyIndex, n0 = A.objects.length;
    var p = atObj(o);
    /* The move is made by hand between begin and end. updateDirectDrag needs
       live pointer tracking a synthetic event does not have, and a drag that
       moves NOTHING proves nothing here: pushHistory skips a step whose model
       signature is unchanged, so a still drag would read as "guarded" whether
       the guard existed or not. */
    var began = p ? k.beginDirectDrag(p) : false;
    if (began) { o.mesh.position.x += 0.7; o.mesh.updateMatrixWorld(true); k.endDirectDrag(); }
    log('1.drag.began', began ? 'yes' : 'NO (probe could not grab it)');
    log('1.drag.history', (A.historyIndex - h0) + ' step(s), want 0');
    log('1.drag.moved', o.mesh.position.x.toFixed(2) !== '4.50' ? 'yes' : 'no');
    k.finishGeoSetup(true);
    log('1.done.history', (A.historyIndex - h0) + ' step(s) total, want 1');
    // The CONTROL: the same drag with no setup open still pushes its step,
    // so the line above is the guard working rather than the drag failing.
    var h1 = A.historyIndex;
    if (k.beginDirectDrag(atObj(o))) { o.mesh.position.x += 0.7; o.mesh.updateMatrixWorld(true); k.endDirectDrag(); }
    log('1.control.history', (A.historyIndex - h1) + ' step(s), want 1');
    k.undo(); k.undo();
    log('1.undo.clears', A.objects.length + ' (want ' + (n0 - 1) + ' - the primitive gone)');
  });

  // 2. Loading a document while the bar is open.
  step(function () {
    k.startGeoSetup('torus');
    var doc = k.serializeDoc();
    k.restoreDoc(doc, { keepAppearance: true, keepSelection: true });
    log('2.load.setup', A.geoSetup ? 'STILL OPEN' : 'closed');
    log('2.load.bar', barShown() ? 'STILL SHOWN' : 'hidden');
  });

  // 3. A press that never reaches the canvas still dismisses a sticky ring.
  step(function () { k.openGeoRing(); });
  step(function () {
    log('3.ring.up', document.querySelectorAll('#touchToolRing .hub-item').length + ' items');
    document.getElementById('btnUndo').dispatchEvent(
      new PointerEvent('pointerdown', { bubbles: true, cancelable: true, pointerId: 9 }));
    log('3.ring.dismissed', document.querySelectorAll('#touchToolRing .hub-item').length === 0 ? 'yes' : 'NO');
    log('3.orbit.back', k.orbit.enabled ? 'enabled' : 'STILL DISABLED');
  });

  // 4 + 6. A new shape resolves the mode and whatever op was dialled in.
  step(function () {
    var cube = A.objects[0];
    A.selectedObjectIds = new Set([cube.id]);
    A.activeObjectId = cube.id;
    k.setMode('face');
    k.ensureHelpers(cube);
    A.selectedElements = new Set([0, 1]);
    k.insetSelection();
    log('4.before', 'mode=' + A.mode + ' sel=' + A.selectedElements.size + ' pendingOp=' + (A.pendingOp ? A.pendingOp.kind : 'none'));
    k.startGeoSetup('sphere');
    log('4.mode', A.mode + '  want object');
    log('4.stale.elements', A.selectedElements.size + '  want 0');
    log('6.pendingOp', A.pendingOp ? 'STILL ' + A.pendingOp.kind : 'resolved');
    log('6.opbar', document.getElementById('opBar').classList.contains('show') ? 'STILL SHOWN' : 'hidden');
    var dots = A.objects.filter(function (o) {
      return o.id !== A.geoSetup.objId && o.mesh.userData.vertexPoints && o.mesh.userData.vertexPoints.visible;
    }).length;
    log('4.old.helpers', dots + ' object(s) still showing dots, want 0');
    k.finishGeoSetup(false);
  });

  // 5. A size field you are typing in is not written back over.
  step(function () {
    k.startGeoSetup('cube');
    var x = document.getElementById('geoX');
    x.value = '';
    x.dispatchEvent(new Event('input', { bubbles: true }));
    log('5.emptied', x.value === '' ? 'stays empty' : 'REFILLED with "' + x.value + '"');
    x.value = '0';
    x.dispatchEvent(new Event('input', { bubbles: true }));
    log('5.typing.zero', x.value === '0' ? 'left alone' : 'REWRITTEN to "' + x.value + '"');
    x.value = '0.5';
    x.dispatchEvent(new Event('input', { bubbles: true }));
    log('5.typed.value', x.value + '  params.x=' + A.geoSetup.params.x);
    x.dispatchEvent(new Event('blur', { bubbles: false }));
    log('5.blur.squares.up', x.value + '  want 0.5');
    // And a stepper still writes its clamp through.
    k.applyGeoParams({ h: 1, v: 1, x: -3, y: 1, z: 1 });
    log('5.stepper.syncs', document.getElementById('geoX').value + '  want 3');
    k.finishGeoSetup(false);
  });

  // 7. A discarded primitive leaves the autosave with it.
  step(function () {
    k.startGeoSetup('cube');
    var id = A.geoSetup.objId;
    // Something else arms the timer mid-setup, the way painting a material
    // or the op this setup resolved on its way in does.
    k.scheduleAutosave();
  });
  step(function () { k.finishGeoSetup(false); });
  // The autosave timer is ~900ms; both writes have to land before it is read.
  var wait = function () {}; wait.wait = 2400; step(wait);
  step(function () {
    var raw = null;
    try { raw = localStorage.getItem(k.AUTOSAVE_KEY || 'kubik.autosave'); } catch (e) { raw = 'THREW ' + e; }
    var n = -1;
    try { n = JSON.parse(raw).doc.objects.length; } catch (e) { n = -1; }
    log('7.autosave.objects', n + '  want ' + A.objects.length + ' (the scene as it stands)');
  });

  // 8. A keyboard command accepts the shape rather than burying it.
  step(function () {
    k.startGeoSetup('sphere');
    var id = A.geoSetup.objId, h0 = A.historyIndex;
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'd', ctrlKey: true, bubbles: true }));
    log('8.ctrlD.setup', A.geoSetup ? 'STILL OPEN' : 'committed');
    log('8.ctrlD.objects', A.objects.length + '  (sphere + its copy)');
    log('8.ctrlD.history', (A.historyIndex - h0) + ' step(s), want 2 (the sphere, then the copy)');
    k.undo();
    log('8.undo.1', (k.findObject(id) ? 'sphere still there' : 'SPHERE GONE') + ', copy ' + (A.objects.length));
    k.undo();
    log('8.undo.2', k.findObject(id) ? 'SPHERE STILL THERE' : 'sphere gone too');
    // Ctrl+Z over an open setup is still the setup's own undo.
    k.startGeoSetup('torus');
    var tid = A.geoSetup.objId, h1 = A.historyIndex;
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'z', ctrlKey: true, bubbles: true }));
    log('8.ctrlZ.setup', A.geoSetup ? 'STILL OPEN' : 'cancelled');
    log('8.ctrlZ.gone', k.findObject(tid) ? 'TORUS STILL THERE' : 'torus gone');
    log('8.ctrlZ.history', (A.historyIndex - h1) + ' (want 0)');
    log('final.winding', k.windingAudit().every(function (w) { return w.ok; }) ? 'all ok' : 'BROKEN');
    log('console.errors', errs.length ? errs.join(' | ').slice(0, 400) : 'none');
  });

  window.addEventListener('error', function (e) { errs.push('onerror: ' + (e.message || e) + ' @' + (e.lineno || '')); });
  function finish() {
    var pre = document.createElement('pre');
    pre.id = 'probeOut';
    pre.textContent = '<<<PROBE\n' + out.join('\n') + '\nPROBE>>>';
    document.body.appendChild(pre);
    document.title = 'PROBE-DONE';
  }
  function run() {
    if (si >= steps.length) return finish();
    var fn = steps[si++];
    try { fn(); } catch (e) {
      out.push('ERROR@' + (si - 1) + '=' + (e && e.stack ? e.stack.split('\n').slice(0, 4).join(' / ') : e));
      return finish();
    }
    setTimeout(run, fn.wait || 140);
  }
  function ready(t) {
    t = t || 0;
    if (window.__kubik && window.__kubik.App) return setTimeout(run, 600);
    if (t > 250) { out.push('ERROR=no __kubik'); return finish(); }
    setTimeout(function () { ready(t + 1); }, 20);
  }
  setTimeout(function () { ready(); }, 300);
})();
