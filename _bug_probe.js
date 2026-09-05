/* a2.43 - the correctness pass. Every case here is a sequence the audit said
   a real user hits, driven end to end rather than asserted about in the
   abstract. */
(function () {
  var out = [], errs = [];
  var _ce = console.error;
  console.error = function () { errs.push(Array.prototype.join.call(arguments, ' ')); _ce.apply(console, arguments); };
  function log(k, v) { out.push(k + '=' + v); }
  function K() { return window.__kubik; }

  var k, A, canvas;

  function pe(type, opts) {
    opts = opts || {};
    return new PointerEvent(type, {
      pointerId: opts.id === undefined ? 1 : opts.id,
      clientX: opts.x || 0, clientY: opts.y || 0,
      bubbles: true, cancelable: true, pointerType: opts.pointerType || 'touch',
      isPrimary: opts.primary !== false
    });
  }
  // A fresh single-cube scene, so every case starts from the same place.
  function reset() {
    A.selectedElements.clear();
    A.selectedObjectIds.clear();
    if (A.pendingOp) k.cancelPendingOp();
    if (A.knife) k.cancelKnife();
    k.setMode('object');
  }
  function anyObject() { return A.objects[0]; }
  function P(obj, l) { return k.logicalPos(obj, l); }

  /* Starts a real vertex drag through the public entry point, then reports
     whether the app still thinks a drag is running. */
  function startVertexDrag(obj) {
    k.setMode('vertex');
    A.activeObjectId = obj.id;
    k.ensureHelpers(obj);
    A.selectedElements = new Set([0]);
    var scr = k.worldToScreenPx(obj.mesh.localToWorld(P(obj, 0).clone()));
    var ev = { clientX: scr.x, clientY: scr.y, pointerId: 1 };
    /* The app tracks pointers in activePointers, and the window backstop only
       answers for a pointer it is tracking. beginDirectDrag alone does not
       record one, so a probe that skips the press has to. */
    k.activePointers.set(1, { x: scr.x, y: scr.y, t: performance.now(), moved: 0 });
    k.beginDirectDrag(ev);
    return !!k.directDrag;
  }
  /* `dragCtx` is NOT the answer: endDirectDrag leaves it in place (nothing
     reads it once directDrag is gone). `directDrag` is what "a drag is
     running" actually means. */
  function dragLive() { return !!k.directDrag; }

  function main() {
    k = K(); A = k.App;
    canvas = k.renderer.domElement;

    /* ---- 1. A cancelled touch must not leave the drag live ---- */
    reset();
    var o1 = anyObject();
    var began = startVertexDrag(o1);
    var h0 = A.historyIndex;
    canvas.dispatchEvent(pe('pointercancel', { id: 1 }));
    log('1.cancel', 'drag began=' + began + ' still live=' + dragLive() +
      ' orbit=' + k.orbit.enabled + ' history ' + h0 + '->' + A.historyIndex +
      '  (live must be false, orbit true)');

    /* ---- 2. A release that never reaches the canvas ---- */
    reset();
    var o2 = anyObject();
    var began2 = startVertexDrag(o2);
    document.body.dispatchEvent(pe('pointerup', { id: 1 }));
    log('2.offcanvas_release', 'began=' + began2 + ' still live=' + dragLive() +
      ' orbit=' + k.orbit.enabled + '  (live must be false)');

    /* ---- 3. Pointerleave must NOT end a drag that strays over the top bar ---- */
    reset();
    var o3 = anyObject();
    startVertexDrag(o3);
    canvas.dispatchEvent(pe('pointerleave', { id: 1 }));
    var survived = dragLive();
    if (dragLive()) k.endDirectDrag();
    log('3.leave_keeps_drag', 'still live=' + survived + '  (must be true - a stray is not a cancel)');

    /* ---- 4. A second finger commits the step instead of swallowing it ---- */
    reset();
    var o4 = anyObject();
    startVertexDrag(o4);
    // Move it somewhere, so there is a real edit to lose.
    var m = new k.THREE.Matrix4().makeTranslation(0.4, 0.25, 0);
    k.applyDeltaToSelection(m);
    var before4 = A.historyIndex;
    // Two fingers down: the camera takes over.
    canvas.dispatchEvent(pe('pointerdown', { id: 1, x: 100, y: 100 }));
    canvas.dispatchEvent(pe('pointerdown', { id: 2, x: 200, y: 200 }));
    log('4.second_finger', 'history ' + before4 + '->' + A.historyIndex +
      ' drag live=' + dragLive() + '  (history must advance, drag must end)');
    canvas.dispatchEvent(pe('pointerup', { id: 1 }));
    canvas.dispatchEvent(pe('pointerup', { id: 2 }));

    /* ---- 5. The Mirror chooser has a working exit ---- */
    reset();
    A.selectedObjectIds = new Set([anyObject().id]);
    k.showMirrorChooser('x');
    var barShown = document.getElementById('opBar').classList.contains('show');
    var cancelShown = document.getElementById('opCancel').style.display !== 'none';
    k.cancelPendingOp();                       // what the ✕ calls
    var barAfter = document.getElementById('opBar').classList.contains('show');
    log('5.mirror_exit', 'bar shown=' + barShown + ' cancel visible=' + cancelShown +
      ' bar after ✕=' + barAfter + '  (must be true/true/false)');

    /* ---- 6. The chooser mirrors what it was OPENED on ---- */
    reset();
    var keep = anyObject();
    A.selectedObjectIds = new Set([keep.id]);
    k.showMirrorChooser('x');
    var captured = k.mirrorChooser ? k.mirrorChooser.ids.slice() : null;
    A.selectedObjectIds = new Set();          // the user wanders off and picks nothing
    log('6.mirror_capture', 'captured ' + (captured ? captured.length : 'none') +
      ' id(s) at open, live selection now ' + A.selectedObjectIds.size +
      '  (the capture is what Joined/Apart must use)');
    k.cancelPendingOp();

    /* ---- 7. A selection that outlives its object ---- */
    reset();
    A.selectedObjectIds = new Set([anyObject().id, 'ghost_not_a_real_id']);
    k.refreshUI();
    var pruned = !A.selectedObjectIds.has('ghost_not_a_real_id');
    log('7.ghost_pruned', 'pruned=' + pruned + ' left ' + A.selectedObjectIds.size +
      '  (must be true, 1)');

    /* ---- 8. ...and the two consumers survive one even before the prune ---- */
    reset();
    A.selectedObjectIds = new Set(['ghost_not_a_real_id']);
    var threw8a = null, threw8b = null;
    try { k.captureDragContext(new k.THREE.Object3D()); } catch (e) { threw8a = e.message; }
    A.selectedObjectIds = new Set(['ghost_not_a_real_id']);
    try { k.duplicateSelection(); } catch (e) { threw8b = e.message; }
    log('8.ghost_consumers', 'captureDragContext=' + (threw8a || 'ok') +
      ' duplicate=' + (threw8b || 'ok') + '  (both must be ok)');

    /* ---- 9. Redo must not delete the primitive being set up ---- */
    reset();
    var nBefore = A.objects.length;
    k.startGeoSetup('sphere');
    var duringSetup = !!A.geoSetup;
    k.redo();
    log('9.redo_keeps_primitive', 'setup open=' + duringSetup + ' objects ' + nBefore +
      '->' + A.objects.length + ' setup after=' + !!A.geoSetup +
      '  (the sphere must survive: count ' + (nBefore + 1) + ', setup still open)');
    if (A.geoSetup) k.finishGeoSetup(false);

    /* ---- 10. A stale edge id must not throw out of Bevel or Split ---- */
    reset();
    var o10 = anyObject();
    k.setMode('edge');
    A.activeObjectId = o10.id;
    k.ensureHelpers(o10);
    var bogus = o10.mesh.userData.topo.edges.length + 25;
    var threwB = null, threwS = null;
    A.selectedElements = new Set([bogus]);
    try { k.bevelSelection(); } catch (e) { threwB = e.message; }
    if (A.pendingOp) k.cancelPendingOp();
    A.selectedElements = new Set([bogus]);
    try { k.splitSelection(); } catch (e) { threwS = e.message; }
    if (A.pendingOp) k.cancelPendingOp();
    log('10.stale_edge', 'bevel=' + (threwB || 'ok') + ' split=' + (threwS || 'ok') +
      '  (both must be ok)');

    /* ---- 11. The object row cancels an open knife ---- */
    reset();
    var o11 = anyObject();
    k.setMode('vertex');
    A.activeObjectId = o11.id;
    k.startKnife();
    var knifeOpen = !!A.knife;
    k.refreshUI();
    /* a2.91: the object list is the OUTLINER now, not chips in the drawer -
       and it is built only while the shelf is open, so open it first. */
    k.setOutlinerOpen(true);
    var chip = document.querySelector('.outRow');
    if (chip) chip.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    log('11.chip_cancels_knife', 'knife opened=' + knifeOpen + ' chip found=' + !!chip +
      ' knife after=' + !!A.knife + '  (must be true/true/false)');
    if (A.knife) k.cancelKnife();

    /* ---- 12. A stale Mirror flag must not hijack a REAL op's ✕ ----
       The a2.43 fix introduced this: showOpBar re-uses the bar without going
       through hideOpBar, so the chooser flag outlived the chooser and then
       swallowed Cancel for whatever opened next. */
    reset();
    var o12 = anyObject();
    A.selectedObjectIds = new Set([o12.id]);
    k.showMirrorChooser('x');                    // flag on
    k.setMode('edge');                           // wander off; bar still up
    A.activeObjectId = o12.id;
    k.ensureHelpers(o12);
    A.selectedElements = new Set([0]);
    k.bevelSelection();                          // a REAL op opens over it
    var opOpen = !!A.pendingOp;
    var flagAfterShow = !!k.mirrorChooser;
    k.cancelPendingOp();                         // the ✕
    log('12.stale_mirror_flag', 'op opened=' + opOpen + ' flag still set=' + flagAfterShow +
      ' op after ✕=' + !!A.pendingOp + '  (flag must be false, op must be null)');
    if (A.pendingOp) k.cancelPendingOp();

    /* ---- 13. Redo must not truncate the tail it was asked to walk ---- */
    reset();
    k.setMode('object');
    var o13 = anyObject();
    A.selectedObjectIds = new Set([o13.id]);
    o13.mesh.position.x += 0.5; k.pushHistory();      // edit A
    o13.mesh.position.x += 0.5; k.pushHistory();      // edit B
    k.undo();                                        // cursor back one
    var tailBefore = A.history.length - 1 - A.historyIndex;
    k.startGeoSetup('sphere');
    k.redo();
    var tailAfter = A.history.length - 1 - A.historyIndex;
    log('13.redo_keeps_tail', 'redoable steps ' + tailBefore + '->' + tailAfter +
      ' setup still open=' + !!A.geoSetup + '  (the tail must survive)');
    if (A.geoSetup) k.finishGeoSetup(false);

    /* ---- 14. A cancelled box drag hands the camera back ---- */
    reset();
    var prevDrag = A.selectDrag;
    A.selectDrag = 'box';                        // arm region select
    // A press on empty space is what starts the box drag and switches orbit off.
    canvas.dispatchEvent(pe('pointerdown', { id: 9, x: 8, y: 8 }));
    var boxStarted = !!k.boxDrag && k.orbit.enabled === false;
    canvas.dispatchEvent(pe('pointercancel', { id: 9 }));
    log('14.cancel_restores_orbit', 'box started=' + boxStarted + ' box after=' + !!k.boxDrag +
      ' orbit=' + k.orbit.enabled + '  (must be true/false/true)');
    A.selectDrag = prevDrag;

    /* ---- 15. The backstop ignores a pointer it never tracked ----
       A second finger tapping Undo while finger one drags must not commit
       the drag out from under it. */
    reset();
    var o15 = anyObject();
    startVertexDrag(o15);
    var liveBefore = dragLive();
    // pointerId 77 never went through the canvas, so it is not tracked.
    document.getElementById('btnUndo').dispatchEvent(pe('pointerup', { id: 77 }));
    var liveAfter = dragLive();
    log('15.backstop_ownership', 'live before=' + liveBefore + ' after a stray release=' +
      liveAfter + '  (must stay true)');
    if (dragLive()) k.endDirectDrag();

    /* ---- 18. Painting during a live op ----
       Two answers, and both must be honest. Inset ADDS face groups, so the
       snapshot has nowhere to keep the paint and it is refused out loud.
       Circularize leaves the grouping alone, so the paint is carried. */
    reset();
    var o18 = A.objects[0];
    var wearing = function (id) {
      var f = (k.findObject(id) || {}).mesh;
      if (!f) return -1;
      var fin = f.userData.finishes || {};
      return Object.keys(fin).filter(function (g) { return fin[g] === 'metal'; }).length;
    };

    // (a) an op that regroups: refuse, say so, paint nothing
    k.setMode('face');
    A.activeObjectId = o18.id;
    k.ensureHelpers(o18);
    A.selectedElements = new Set([0]);
    k.insetSelection();
    var insetOpen = !!A.pendingOp;
    A.selectedElements = new Set([0]);
    k.applyFinishToSelection('metal');
    var paintedUnderInset = wearing(o18.id);
    var toastSaid = (document.getElementById('toast') || {}).textContent || '';
    if (A.pendingOp) k.cancelPendingOp();
    log('18a.paint_under_inset', 'op open=' + insetOpen + ' faces painted=' + paintedUnderInset +
      ' toast="' + toastSaid + '"  (must be 0 and a "Finish the Inset first")');

    // (b) an op that does not regroup: the paint survives the re-run
    reset();
    var o18b = A.objects[0];
    k.setMode('face');
    A.activeObjectId = o18b.id;
    k.ensureHelpers(o18b);
    A.selectedElements = new Set([0]);
    k.circularizeSelection();
    var circOpen = !!A.pendingOp;
    A.selectedElements = new Set([0]);
    k.applyFinishToSelection('metal');
    var painted18b = wearing(o18b.id);
    k.setPendingAmount(0.5);                  // the re-run that used to erase it
    var afterNudge = wearing(o18b.id);
    if (A.pendingOp) k.cancelPendingOp();
    var afterCancel = wearing(o18b.id);
    log('18b.paint_under_circularize', 'op open=' + circOpen + ' painted=' + painted18b +
      ' after nudge=' + afterNudge + ' after cancel=' + afterCancel +
      '  (none may be 0)');

    /* ---- 19. The captured symmetry plane survives a round trip ---- */
    reset();
    var o19 = A.objects[0];
    /* a2.89: the axis became a SET. Written as a one-element set here so
       these sections keep meaning exactly what they meant before. */
    A.symmetry = true; A.symmetryAxes = ['x'];
    k.captureSymmetryPlane(o19, 'x');
    o19.mesh.userData.symPlane.offset = 3.75;   // a value no recapture would produce
    var doc19 = k.serializeDoc();
    A.symmetry = false;
    k.restoreDoc(doc19, {});
    var pl = A.objects[0].mesh.userData.symPlane;
    log('19.symplane_roundtrip', 'offset ' + (pl && pl.offset) + ' axis ' + (pl && pl.axis) +
      ' symmetry back on=' + A.symmetry + '  (must be 3.75 / x / true)');
    A.symmetry = false;

    /* ---- 16. A masked PRESET material survives the trip ----
       The oldest outstanding item in the project. Every preset id is seeded at
       startup, so "keep ours if we know that id" always discarded the file's
       version. */
    reset();
    var doc16 = k.serializeDoc();
    // A file whose "metal" is not this library's metal.
    var mine = k.MATERIALS.get('metal');
    doc16.materialLib = doc16.materialLib.map(function (d) {
      if (d.id !== 'metal') return d;
      return Object.assign({}, d, { color: '#ff00ff', roughness: 0.123 });
    });
    // ...and a face wearing it.
    doc16.objects[0].finishes = { 0: 'metal' };
    k.restoreDoc(doc16, {});
    var o16 = A.objects[0];
    var wornId = (o16.mesh.userData.finishes || {})[0];
    var wornDef = k.MATERIALS.get(wornId);
    log('16.preset_import', 'face wears "' + wornId + '" colour ' +
      (wornDef && wornDef.color) + ' rough ' + (wornDef && wornDef.roughness) +
      ' | our own metal still ' + (mine && mine.color) +
      '  (the face must wear the INCOMING #ff00ff, ours must be untouched)');

    /* ---- 17. ...and re-opening the same file must not breed copies ---- */
    var libBefore = k.MATERIALS.size;
    k.restoreDoc(doc16, {});
    k.restoreDoc(doc16, {});
    log('17.import_idempotent', 'library ' + libBefore + '->' + k.MATERIALS.size +
      ' after two more loads  (must not grow)');

    /* ---- 20. A MULTI-object op carries the paint too ----
       Subdivide snapshots every selected object into op.multi[] and re-runs
       from those, not from op.state - so a guard that looked only at op.objId
       let the paint through and then ate it. */
    reset();
    k.setMode('object');
    var dupSrc = A.objects[0];
    A.selectedObjectIds = new Set([dupSrc.id]);
    k.duplicateSelection();
    A.selectedObjectIds = new Set(A.objects.map(function (o) { return o.id; }));
    var nSel = A.selectedObjectIds.size;
    k.subdivideSelection();
    var multiOpen = !!(A.pendingOp && A.pendingOp.multi);
    k.applyFinishToSelection('metal');
    var toast20 = (document.getElementById('toast') || {}).textContent || '';
    var painted20 = A.objects.filter(function (o) {
      var f = o.mesh.userData.finishes || {};
      return Object.keys(f).some(function (g) { return f[g] === 'metal'; });
    }).length;
    if (A.pendingOp) k.cancelPendingOp();
    log('20.multi_op_paint', 'objects=' + nSel + ' multi op=' + multiOpen +
      ' painted=' + painted20 + ' toast="' + toast20 + '"' +
      '  (either all painted and kept, or a refusal - never a silent 0)');

    /* ---- 21. A masked preset must match ITSELF across a save/reload ----
       The signature used to be key-order sensitive, so the same material
       reached it as {..masks} in one session and {..masks,bevel:0} after a
       reload, and minted a duplicate on every single open. */
    reset();
    var metal = k.MATERIALS.get('metal');
    var sigA = k.materialDefSig(Object.assign({}, metal, { masks: [], bevel: 0 }));
    // The same value, keys inserted the other way round.
    var other = { bevel: 0, masks: [], envMapIntensity: metal.envMapIntensity,
                  metalness: metal.metalness, roughness: metal.roughness,
                  color: metal.color, name: metal.name, id: 'metal', preset: true };
    var sigB = k.materialDefSig(other);
    // ...and absent-versus-zero for bevel.
    var noBevel = Object.assign({}, metal, { masks: [] });
    delete noBevel.bevel;
    var sigC = k.materialDefSig(noBevel);
    log('21.sig_stable', 'key order match=' + (sigA === sigB) +
      ' absent-vs-zero match=' + (sigA === sigC) + '  (both must be true)');

    /* ---- 22. ...but two materials that differ only in NAME stay apart ---- */
    var sigD = k.materialDefSig(Object.assign({}, metal, { masks: [], bevel: 0, name: 'Something else' }));
    log('22.sig_name_counts', 'differ=' + (sigA !== sigD) + '  (must be true)');

    /* ---- 23. Undo must not flip symmetry ----
       Toggling symmetry pushes no history, so a step carries the state from
       the last GEOMETRY edit - restoring that on undo switched symmetry back
       on under the user. */
    reset();
    k.setMode('object');
    var o23 = A.objects[0];
    A.symmetry = true; A.symmetryAxes = ['x'];
    o23.mesh.position.x += 0.3; k.pushHistory();   // a step recorded with symmetry ON
    o23.mesh.position.x += 0.3; k.pushHistory();
    A.symmetry = false;                            // the user switches it off
    k.undo();
    log('23.undo_keeps_symmetry', 'symmetry after undo=' + A.symmetry +
      '  (must stay false - the user turned it off)');
    A.symmetry = false;

    /* Synthetic pointer events make OrbitControls throw on release - it never
       took a real capture. Proved a harness artefact at a2.37 with a control
       case; it is not the app. */
    var real = errs.filter(function (e) { return e.indexOf('PointerCapture') < 0; });
    log('console.errors', real.length ? real.join(' | ').slice(0, 500) :
      'none' + (errs.length ? ' (' + errs.length + ' set/releasePointerCapture, known harness artefact)' : ''));
  }

  window.addEventListener('error', function (e) { errs.push('onerror: ' + (e.message || e) + ' @' + (e.lineno || '')); });
  window.addEventListener('unhandledrejection', function (e) { errs.push('rejection: ' + ((e.reason && (e.reason.stack || e.reason.message)) || e.reason)); });
  function ready(cb, t) {
    t = t || 0;
    if (window.__kubik && window.__kubik.App) return cb();
    if (t > 250) { out.push('ERROR=no __kubik'); return finish(); }
    setTimeout(function () { ready(cb, t + 1); }, 20);
  }
  function finish() {
    var pre = document.createElement('pre');
    pre.id = 'probeOut';
    pre.textContent = '<<<PROBE\n' + out.join('\n') + '\nPROBE>>>';
    document.body.appendChild(pre);
    document.title = 'PROBE-DONE';
  }
  setTimeout(function () {
    ready(function () {
      setTimeout(function () {
        try { main(); } catch (e) { out.push('ERROR=' + (e && e.stack ? e.stack.split('\n').slice(0, 6).join(' / ') : e)); }
        finish();
      }, 600);
    });
  }, 300);
})();
