/* "An immediate edit has one ending" - measure it, do not reason about it.

   v2.38 routed nine open-coded tails through finishMeshEdit /
   finishObjectGone / finishSceneEdit. The claim is not "the code is tidier".
   It is three things a probe can see:

     the audit runs   - finishMeshEdit audits winding under ?debug=1 and logs
                        a [winding] line. Nine operations never called it, and
                        they are exactly the ones that can break winding. One
                        line per edit is the direct evidence the edit went
                        through the door.
     one step         - exactly one history step per edit, and none at all for
                        an edit that refused.
     only itself      - an edit that kills its object takes THAT object out of
                        the selection. One of the four hand-written copies
                        cleared the whole set, so deleting the last face of one
                        object deselected every other selected object too.

   Everything here drives the real tools - deleteSelection, weldSelection and
   so on - because finishMeshEdit is deliberately NOT exported: a probe that
   called the door directly would agree with any bug in the corridor. */
(function () {
  var out = [], errs = [], fails = 0, done = false, at = 'start', hardFail = '';
  window.addEventListener('error', function (e) { errs.push(e.message); });
  window.addEventListener('unhandledrejection', function (e) {
    errs.push('rejected: ' + (e.reason && e.reason.message ? e.reason.message : e.reason));
  });
  setTimeout(function () {
    if (!done) { hardFail = 'the probe hung at ' + at; out.push('WATCHDOG at ' + at); finishUp(); }
  }, 150000);
  function log(s) { out.push(s); }
  function mark(s) { at = s; }
  function verdict(ok, good, bad) { if (!ok) fails++; return ok ? '  ok  ' + good : '  FAIL ' + bad; }

  /* THE AUDIT COUNTER. finishMeshEdit's console.log is the only observable
     proof it ran, so it is counted rather than believed. */
  var winds = 0;
  var realLog = console.log;
  console.log = function () {
    if (arguments[0] === '[winding]') winds++;
    return realLog.apply(console, arguments);
  };

  async function main() {
    var k = window.__kubik, A = k.App, THREE = k.THREE;
    var toastEl = document.getElementById('toast');
    var drift = [];

    function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
    function said() { return (toastEl && toastEl.textContent || '').trim(); }
    function clearScene() { A.objects.slice().forEach(function (o) { k.removeObjects([o]); }); }
    function cube(name, x) {
      var o = k.createCubeObject(name, new THREE.Vector3(x || 0, 0.5, 0));
      k.ensureHelpers(o);
      return o;
    }
    function faces(o) {
      return Array.isArray(o.mesh.material) ? o.mesh.material.length : 1;
    }
    function edgeCount(o) { return o.mesh.userData.topo.edges.length; }
    function vertCount(o) { return o.mesh.userData.topo.logicalCount; }

    /* ONE EDIT, MEASURED. Everything a section wants to know about a tool is
       the same four numbers, so they are taken the same way every time. */
    async function edit(name, fn) {
      if (toastEl) toastEl.textContent = '';
      var h0 = A.historyIndex, w0 = winds, n0 = A.objects.length;
      var doc0 = k.serializeDoc();
      fn();
      await sleep(60);
      /* AND THE INVARIANT, after every single edit: IF the tool changed the
         scene, a history step holds it. Conditional on purpose - a section
         builds its fixture outside the history, so "the top step is the
         scene" is false for reasons that have nothing to do with the tool,
         and the first version of this flagged an edit that by definition
         changed nothing. Counting steps is only worth anything if the
         step is really the edit - and the way this goes wrong is not two
         steps, it is ZERO: a tool that changed the mesh and then returned
         down a path that never reached an ending leaves the change sitting
         in the scene in no step at all, so Undo walks straight past it and
         the next unrelated edit bakes it in. */
      var doc1 = k.serializeDoc();
      var changed = !k.sameDocModel(doc0, doc1);
      var top = A.history[A.historyIndex];
      var sync = !changed || (!!top && k.sameDocModel(top, doc1));
      if (!sync) drift.push(name);
      return {
        name: name, steps: A.historyIndex - h0, audits: winds - w0,
        objs: A.objects.length - n0, toast: said(), sync: sync
      };
    }
    function line(r) {
      return '  ' + r.name + ': ' + r.steps + ' step(s), ' + r.audits +
        ' audit(s), said "' + (r.toast || '(nothing)') + '"';
    }

    /* ---- 1. every immediate tool goes through the door ----
       One history step and one winding audit per edit. Before 2.38 the audit
       column would read 0 for all seven of these. */
    mark('section1');
    var rows = [];
    clearScene();
    var c = cube('C', 0);
    k.setMode('face');
    A.activeObjectId = c.id;
    A.selectedObjectIds = new Set([c.id]);
    A.selectedElements = new Set([0]);
    rows.push(await edit('delete a face', function () { k.deleteSelection(); }));

    k.ensureHelpers(c);
    k.setMode('face');
    rows.push(await edit('cap the hole', function () { k.fillHolesSelection(); }));

    k.ensureHelpers(c);
    A.selectedElements = new Set([0]);
    rows.push(await edit('flip normals', function () { k.flipNormalsSelection(); }));

    k.ensureHelpers(c);
    k.setMode('edge');
    A.selectedElements = new Set([0]);
    rows.push(await edit('dissolve an edge', function () { k.deleteSelection(); }));

    k.ensureHelpers(c);
    k.setMode('vertex');
    A.selectedElements = new Set([0, 1]);
    rows.push(await edit('weld two vertices', function () { k.weldSelection(); }));

    k.ensureHelpers(c);
    k.setMode('edge');
    A.selectedElements = new Set([0]);
    rows.push(await edit('collapse an edge', function () { k.collapseSelection(); }));

    k.ensureHelpers(c);
    k.setMode('face');
    A.selectedElements = new Set([0]);
    rows.push(await edit('detach a face', function () { k.detachFacesSelection(); }));

    log('=== 1. every immediate tool ends the same way ===');
    rows.forEach(function (r) { log(line(r)); });
    var ran = rows.filter(function (r) { return r.steps === 1; });
    var audited = ran.filter(function (r) { return r.audits === 1; });
    var twice = rows.filter(function (r) { return r.steps > 1; });
    log('  ' + ran.length + ' of ' + rows.length + ' tools made exactly one step; ' +
      audited.length + ' of those audited winding exactly once');
    log(verdict(ran.length >= 6 && audited.length === ran.length && !twice.length,
      'one step and one audit per edit',
      (ran.length < 6 ? 'ONLY ' + ran.length + ' OF ' + rows.length +
        ' TOOLS DID ANYTHING - this section tested nothing; ' : '') +
      (audited.length !== ran.length ? (ran.length - audited.length) +
        ' TOOL(S) NEVER AUDITED WINDING - they did not go through the door: ' +
        ran.filter(function (r) { return r.audits !== 1; })
           .map(function (r) { return r.name; }).join(', ') + '; ' : '') +
      (twice.length ? twice.length + ' TOOL(S) WROTE MORE THAN ONE STEP' : '')));

    /* ---- 2. a refusal is not an edit ----
       Nothing shares a spot on a fresh cube, so Merge has nothing to do. It
       must leave the history alone AND not pretend to have edited - an
       audit line here would mean the tail ran on a mesh that never moved. */
    mark('section2');
    clearScene();
    var c2 = cube('C2', 0);
    k.setMode('vertex');
    A.activeObjectId = c2.id;
    A.selectedObjectIds = new Set([c2.id]);
    A.selectedElements = new Set([0, 1]);
    var before2 = vertCount(c2);
    var r2 = await edit('merge, nothing coincident', function () { k.mergeSelection(); });
    log('');
    log('=== 2. a refusal writes nothing ===');
    log(line(r2));
    log('  vertices ' + before2 + ' -> ' + vertCount(c2));
    log(verdict(r2.steps === 0 && r2.audits === 0 && vertCount(c2) === before2 &&
      /nothing shares/i.test(r2.toast),
      'it said why, changed nothing, and left the history alone',
      (r2.steps ? 'IT PUSHED ' + r2.steps + ' HISTORY STEP(S) FOR AN EDIT THAT DID NOT HAPPEN; ' : '') +
      (r2.audits ? 'IT RAN THE COMMIT TAIL ON A MESH THAT NEVER MOVED; ' : '') +
      (vertCount(c2) !== before2 ? 'THE MESH CHANGED; ' : '') +
      (!/nothing shares/i.test(r2.toast) ? 'IT DID NOT SAY WHY (said "' + r2.toast + '")' : '')));

    /* ---- 3. an edit that kills its object takes only that object ----
       THE behaviour change in 2.38. Four sites did this by hand and one of
       them cleared the whole selection, so deleting the last face of one
       object quietly deselected every other object you had selected. */
    mark('section3');
    clearScene();
    var a3 = cube('A3', -2), b3 = cube('B3', 2);
    k.setMode('face');
    A.activeObjectId = a3.id;
    A.selectedObjectIds = new Set([a3.id, b3.id]);
    var all = [];
    for (var i = 0; i < faces(a3); i++) all.push(i);
    A.selectedElements = new Set(all);
    var r3 = await edit('delete every face', function () { k.deleteSelection(); });
    var aGone = !A.objects.some(function (o) { return o.id === a3.id; });
    var bKept = A.objects.some(function (o) { return o.id === b3.id; });
    var bStillSelected = A.selectedObjectIds.has(b3.id);
    var aDeselected = !A.selectedObjectIds.has(a3.id);
    log('');
    log('=== 3. the object that died leaves, and only it ===');
    log(line(r3));
    log('  A3 gone: ' + aGone + ', B3 still in the scene: ' + bKept +
      ', B3 still selected: ' + bStillSelected + ', A3 deselected: ' + aDeselected);
    log(verdict(aGone && bKept && bStillSelected && aDeselected && r3.steps === 1,
      'the dead object leaves the selection and nothing else does',
      (!aGone ? 'THE OBJECT SURVIVED DELETING EVERY FACE - this section tested nothing; ' : '') +
      (!bKept ? 'THE OTHER OBJECT WAS REMOVED TOO; ' : '') +
      (!bStillSelected ? 'THE OTHER OBJECT WAS DESELECTED - one dying object cleared the whole selection; ' : '') +
      (!aDeselected ? 'THE DEAD OBJECT IS STILL IN selectedObjectIds; ' : '') +
      (r3.steps !== 1 ? 'IT WROTE ' + r3.steps + ' HISTORY STEP(S)' : '')));

    /* ---- 4. the mirrored pass is one edit, not two ----
       runMirrored runs the tool once per side and suppresses the inner push
       with a global. Routing every tail through one door is exactly the kind
       of change that could start writing a step per side, and Undo would
       then take back half a symmetric edit. Two audits, one step. */
    mark('section4');
    clearScene();
    var c4 = cube('C4', 0);
    k.setMode('vertex');
    A.activeObjectId = c4.id;
    A.selectedObjectIds = new Set([c4.id]);
    var symOn = false;
    try { A.symmetry = { axis: 'x' }; symOn = !!A.symmetry; } catch (e) {}
    /* Two vertices on ONE side, so their mirror images are a second job.
       Picked by position rather than by index, because an index is whatever
       the last rebuild made it. */
    k.ensureHelpers(c4);
    var pos = [], topo = c4.mesh.userData.topo;
    for (var v = 0; v < vertCount(c4); v++) {
      var p = k.logicalPos ? k.logicalPos(c4, v) : null;
      if (p && p.x > 0) pos.push(v);
    }
    A.selectedElements = new Set(pos.slice(0, 2));
    var r4 = await edit('weld, with symmetry on', function () { k.weldSelection(); });
    try { A.symmetry = null; } catch (e) {}
    log('');
    log('=== 4. a mirrored edit is one step ===');
    log('  symmetry on: ' + symOn + ', vertices on one side: ' + pos.length);
    log(line(r4));
    log(verdict(r4.steps === 1 && r4.audits >= 1,
      'however many passes it took, it is one thing to undo',
      (r4.steps === 0 ? 'IT DID NOTHING - this section tested nothing; ' : '') +
      (r4.steps > 1 ? 'IT WROTE ' + r4.steps + ' STEPS - Undo would take back half a symmetric edit; ' : '') +
      (r4.audits < 1 ? 'IT NEVER AUDITED' : '')));

    /* ---- 5. Undo puts back exactly what one tool did ----
       The point of counting steps: the step count is only interesting if a
       step is really the whole edit. */
    mark('section5');
    clearScene();
    var c5 = cube('C5', 0);
    k.setMode('face');
    A.activeObjectId = c5.id;
    A.selectedObjectIds = new Set([c5.id]);
    /* THE FIXTURE HAS TO BE IN THE HISTORY. Building a cube writes no step,
       so without this the step before the delete is the PREVIOUS section's
       scene, Undo restores that quite correctly, and the probe reports the
       app lost an object it had never been told about. */
    k.pushHistory();
    A.selectedElements = new Set([0]);
    var before5 = faces(c5);
    await edit('delete a face', function () { k.deleteSelection(); });
    var mid5 = faces(byName('C5'));
    k.undo();
    await sleep(200);
    // By NAME: Undo rebuilds the scene from a document, so a reference held
    // across it is a corpse.
    var back = byName('C5');
    var after5 = back ? faces(back) : -1;
    log('');
    log('=== 5. one press of Undo is one tool ===');
    log('  faces ' + before5 + ' -> ' + mid5 + ' -> ' + after5 + ' after Undo');
    log(verdict(mid5 < before5 && after5 === before5,
      'the step it wrote is the whole edit',
      (mid5 >= before5 ? 'THE EDIT DID NOTHING - this section tested nothing; ' : '') +
      (after5 !== before5 ? 'UNDO DID NOT PUT IT BACK (' + after5 + ' of ' + before5 + ')' : '')));

    function byName(n) {
      return A.objects.filter(function (o) { return o.name === n; })[0] || null;
    }

    /* ---- 6. nothing is left pointing into the mesh that died ----
       A selection that outlives its object does not throw, it lies: the HUD
       goes on reporting "3 faces" with nothing left to pick, and the root
       keeps its armed state. Seven call sites used to clear this by hand
       before knocking, which is a door one line short of being a door. */
    mark('section6');
    clearScene();
    var c6 = cube('C6', 0);
    k.setMode('face');
    A.activeObjectId = c6.id;
    A.selectedObjectIds = new Set([c6.id]);
    var all6 = [];
    for (var j = 0; j < faces(c6); j++) all6.push(j);
    A.selectedElements = new Set(all6);
    A.vertAnchor = 3;
    A.edgeAnchor = 4;
    var r6 = await edit('delete every face', function () { k.deleteSelection(); });
    var stale = A.selectedElements.size;
    var anchors = [A.vertAnchor, A.edgeAnchor, A.lastVertPick, A.lastEdgePick]
      .filter(function (x) { return x !== null && x !== undefined; }).length;
    log('');
    log('=== 6. nothing points into the dead mesh ===');
    log(line(r6));
    log('  elements still selected: ' + stale + ', anchors still set: ' + anchors +
      ', active object: ' + (A.activeObjectId === null ? 'none' : A.activeObjectId));
    log(verdict(r6.objs === -1 && stale === 0 && anchors === 0 && A.activeObjectId === null,
      'the selection, the anchors and the active object all went with it',
      (r6.objs !== -1 ? 'THE OBJECT DID NOT DIE - this section tested nothing; ' : '') +
      (stale ? stale + ' ELEMENT(S) STILL SELECTED IN A MESH THAT IS GONE; ' : '') +
      (anchors ? anchors + ' ANCHOR(S) STILL POINTING AT IT; ' : '') +
      (A.activeObjectId !== null ? 'IT IS STILL THE ACTIVE OBJECT' : '')));

    /* ---- 7. deleting several objects is one step and one refresh ---- */
    mark('section7');
    clearScene();
    var d1 = cube('D1', -3), d2 = cube('D2', 0), d3 = cube('D3', 3);
    k.setMode('object');
    A.activeObjectId = d2.id;
    A.selectedObjectIds = new Set([d1.id, d2.id, d3.id]);
    k.pushHistory();
    var r7 = await edit('delete three objects', function () { k.deleteSelection(); });
    log('');
    log('=== 7. three objects, one step ===');
    log(line(r7));
    log('  objects left: ' + A.objects.length + ', still selected: ' + A.selectedObjectIds.size);
    log(verdict(r7.steps === 1 && r7.objs === -3 && A.selectedObjectIds.size === 0,
      'they left together and it is one thing to undo',
      (r7.objs !== -3 ? 'IT REMOVED ' + (-r7.objs) + ' OF 3 - this section tested nothing; ' : '') +
      (r7.steps !== 1 ? 'IT WROTE ' + r7.steps + ' STEP(S); ' : '') +
      (A.selectedObjectIds.size ? 'DEAD IDS ARE STILL SELECTED' : '')));

    /* ---- 8. the running invariant, gathered ---- */
    mark('section8');
    log('');
    log('=== 8. the scene is never ahead of the history ===');
    log('  checked after every edit above: if it changed the scene, a step holds it');
    log(verdict(!drift.length,
      'every edit that changed the mesh is in a step',
      drift.length + ' EDIT(S) CHANGED THE SCENE WITHOUT A STEP TO HOLD IT: ' +
        drift.join(', ') + ' - Undo walks past those and the next edit bakes them in'));

    finishUp();
  }

  function finishUp() {
    if (done) return;
    done = true;
    console.log = realLog;
    out.push('');
    if (hardFail) out.push('DID NOT FINISH: ' + hardFail);
    out.push('VERDICT=' + ((fails || hardFail) ?
      'FAIL (' + (fails + (hardFail ? 1 : 0)) + ')' : 'PASS'));
    out.push('page.errors=' + (errs.length ? errs.join(' | ').slice(0, 400) : 'none'));
    var pre = document.createElement('pre');
    pre.id = 'probeOut';
    pre.textContent = '<<<PROBE\n' + out.join('\n') + '\nPROBE>>>';
    document.body.appendChild(pre);
    document.title = 'PROBE-DONE';
    try {
      var x = new XMLHttpRequest();
      x.open('POST', '/__probe', true);
      x.send(out.join('\n'));
    } catch (e) {}
  }
  function ready(cb, t) {
    t = t || 0;
    if (window.__kubik && window.__kubik.App && window.__kubik.App.objects) return cb();
    if (t > 300) { hardFail = 'the app never came up'; out.push('ERROR=no __kubik'); return finishUp(); }
    setTimeout(function () { ready(cb, t + 1); }, 20);
  }
  setTimeout(function () {
    ready(function () {
      setTimeout(function () {
        main().catch(function (e) {
          hardFail = 'it threw';
          out.push('ERROR=' + (e && e.stack ? e.stack.split('\n').slice(0, 8).join(' / ') : e));
          finishUp();
        });
      }, 800);
    });
  }, 300);
})();
