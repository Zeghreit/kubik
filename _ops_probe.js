/* Kubik ops sweep. Appended to a COPY of index.html; never shipped.

   Runs every user-facing operation from a known mesh and checks the same
   handful of invariants each time, so a regression anywhere shows up as one
   changed line rather than "it feels wrong":

     silent   - the op changed nothing AND said nothing (the worst failure
                mode in this codebase, by its own notes)
     winding  - reversed / conflicting / non-manifold triangles
     maps     - material[] and finishes still agree with the face groups
     history  - exactly one step per committed op, and Undo restoring the
                geometry EXACTLY (string compare on every coordinate)
*/
(function () {
  var out = [], errs = [];
  var _ce = console.error;
  console.error = function () { errs.push(Array.prototype.join.call(arguments, ' ')); _ce.apply(console, arguments); };
  function log(k, v) { out.push(k + '=' + v); }
  function K() { return window.__kubik; }

  function topo(o) { return o.mesh.userData.topo; }
  function counts(o) {
    var t = topo(o);
    return t.faceGroups.length + 'f/' + t.logicalCount + 'v/' + t.edges.length + 'e';
  }
  function pos(o) {
    var pa = o.mesh.geometry.attributes.position, a = [];
    for (var i = 0; i < pa.count; i++) a.push(pa.getX(i).toFixed(5), pa.getY(i).toFixed(5), pa.getZ(i).toFixed(5));
    return a.join(',');
  }
  function toastText() {
    var t = document.getElementById('toast');
    return t ? (t.textContent || '').trim() : '';
  }
  // material[] and finishes have to keep agreeing with the face groups.
  function mapsOK(o) {
    var t = topo(o), n = t.faceGroups.length;
    var mats = Array.isArray(o.mesh.material) ? o.mesh.material : [o.mesh.material];
    var bad = [];
    if (mats.length !== n) bad.push('mats ' + mats.length + ' vs ' + n + ' groups');
    var fin = o.mesh.userData.finishes || {};
    Object.keys(fin).forEach(function (k) {
      var i = +k;
      if (!(i >= 0 && i < n)) bad.push('finish key ' + k + ' out of range');
    });
    return bad.length ? bad.join('; ') : '';
  }
  /* Everything an op is allowed to change, in one string. Geometry alone
     misses crease, sharp, shade and material edits, which then read as
     "nothing happened" - the probe would report its own blindness as a bug
     in the app. */
  function parts(o) {
    // Some ops leave the topology to be rebuilt lazily (mirror does), and
    // reading counts before that is the probe's problem, not the app's.
    K().ensureHelpers(o);
    var d = o.mesh.userData;
    var mats = Array.isArray(o.mesh.material) ? o.mesh.material : [o.mesh.material];
    var ix = o.mesh.geometry.index;
    return {
      /* The app's OWN answer to "did the model change", so the probe and
         pushHistory cannot disagree: anything serializeDoc records is worth
         a history step, and anything it does not, is not. The named parts
         below stay only to make a failure message readable. */
      doc: JSON.stringify(K().serializeDoc().objects),
      geometry: pos(o),
      /* The triangle ORDER too. Mirror rebuilds a symmetric object into the
         same positions with a different index, which is a real change to the
         saved document - without this the probe called it a no-op and blamed
         the app for recording it. */
      index: ix ? Array.from(ix.array).join(',') : '-',
      counts: counts(o),
      objects: '' + K().App.objects.length,
      materials: mats.map(function (m) {
        return m.color.getHexString() + m.roughness.toFixed(3) + m.metalness.toFixed(3);
      }).join(','),
      finishes: JSON.stringify(d.finishes || {}),
      creases: JSON.stringify(d.creases || {}),
      edgeShade: JSON.stringify(d.edgeShade || {}),
      autoSmooth: (typeof d.autoSmoothAngle === 'number' ? d.autoSmoothAngle.toFixed(4) : '-')
    };
  }
  function fingerprint(o) {
    var f = parts(o), a = [];
    for (var q in f) a.push(f[q]);
    return a.join('|');
  }
  // Which named part changed, for a message worth reading.
  function diffParts(a, b) {
    var out = [];
    for (var q in a) if (a[q] !== b[q]) {
      out.push(q + ' (' + String(a[q]).slice(0, 34) + ' -> ' + String(b[q]).slice(0, 34) + ')');
    }
    return out.join(', ') || 'nothing';
  }
  function windOK(o) {
    var w = K().auditWinding(o);
    var bad = [];
    if (w.reversed) bad.push(w.reversed + ' reversed');
    if (w.conflictEdges) bad.push(w.conflictEdges + ' bad edges');
    if (w.nonManifold) bad.push(w.nonManifold + ' non-manifold');
    return bad.length ? bad.join(', ') : '';
  }

  var k, A, objId, obj, snap, docSnap;

  /* Back to the cube, with the mode and selection the case asked for. The
     object is re-fetched every time: an undo runs restoreDoc, which disposes
     every object and builds new ones, so a held reference goes stale. */
  function reset(mode, sel) {
    obj = k.findObject(objId);
    if (!obj) {                       // a case blew the object away
      k.restoreDoc(docSnap, {});
      objId = A.objects[0] && A.objects[0].id;
      obj = k.findObject(objId);
      k.ensureHelpers(obj);
      snap = k.captureObjectState(obj);
    }
    k.restoreObjectState(obj, snap);
    k.ensureHelpers(obj);
    A.mode = mode;
    A.activeObjectId = objId;
    A.selectedObjectIds.clear();
    A.selectedObjectIds.add(objId);
    A.selectedElements = new Set(sel || []);
    A.symmetry = false;
    k.ensureHelpers(obj);
    /* The cube has to BE the current history entry, or the undo check below
       is measuring against whatever the previous case left behind. */
    k.pushHistory();
  }

  /* One case. `go` runs the op and returns nothing; anything that opens the
     op bar is confirmed here so every case ends committed or refused. */
  function run(name, mode, sel, go, opts) {
    opts = opts || {};
    var line = [];
    try {
      reset(mode, sel);
      var pBefore = parts(obj), before = fingerprint(obj), cBefore = counts(obj);
      /* The INDEX, not the length. Every case undoes itself, so the next
         push truncates and re-fills the same slot and the length never
         moves - which read as "no history step" for ops that had pushed
         one perfectly well. */
      var iBefore = A.historyIndex, tBefore = toastText();
      var eBefore = errs.length;

      go();
      if (A.pendingOp) k.confirmPendingOp();
      if (A.knife) k.cancelKnife(true);

      var moved = fingerprint(obj) !== before;
      var said = toastText() !== tBefore && toastText() !== '';
      var cAfter = counts(obj);

      // 1. the worst failure mode: nothing happened and nothing was said
      if (!moved && !said) line.push('SILENT');
      // 2. topology
      var w = windOK(obj);
      if (w && !opts.expectWinding) line.push('winding: ' + w);
      var m = mapsOK(obj); if (m) line.push('maps: ' + m);
      // 3. history: a committed op is one step, a refusal is none
      var steps = A.historyIndex - iBefore;
      if (moved && steps !== 1) line.push('history ' + steps + ' steps for a change');
      if (!moved && steps !== 0) line.push('history ' + steps + ' steps for NO change');
      // 4. undo puts the geometry back exactly
      if (steps === 1) {
        k.undo();
        obj = k.findObject(objId);           // restoreDoc built a new one
        if (!obj) line.push('UNDO lost the object');
        else {
          if (fingerprint(obj) !== before) {
            line.push('UNDO did not restore: ' + diffParts(pBefore, parts(obj)));
          }
          var mu = mapsOK(obj); if (mu) line.push('maps after undo: ' + mu);
        }
      }
      if (errs.length > eBefore) line.push('console: ' + errs.slice(eBefore).join(' | ').slice(0, 90));

      log(name, (line.length ? 'FAIL ' + line.join(' · ') : 'ok') +
        '  [' + cBefore + ' -> ' + cAfter + (said ? ', "' + toastText().slice(0, 46) + '"' : '') + ']');
    } catch (e) {
      log(name, 'THREW ' + (e && e.message ? e.message : e) +
        (e && e.stack ? ' @ ' + e.stack.split('\n').slice(1, 4).join(' / ').replace(/https?:[^)]*?:/g, '') : ''));
    }
  }

  // An edge of the cube, and the two vertices of one.
  function anEdge() { return 0; }
  function twoVerts() { var e = topo(obj).edges[0]; return [e[0], e[1]]; }

  function main() {
    k = K(); A = k.App;
    objId = A.activeObjectId;
    if (!objId && A.selectedObjectIds && A.selectedObjectIds.size) objId = Array.from(A.selectedObjectIds)[0];
    obj = k.findObject(objId);
    A.activeObjectId = objId;
    k.ensureHelpers(obj);
    snap = k.captureObjectState(obj);
    docSnap = k.serializeDoc();
    log('cube', counts(obj));

    /* ---------------- FACE mode ---------------- */
    run('face.extrude', 'face', [0], function () {
      k.extrudeSelection(); k.setPendingAmount(0.5);
    });
    run('face.extrude.two.opposite', 'face', [0, 1], function () {
      k.extrudeSelection(); k.setPendingAmount(0.5);
    });
    run('face.extrude.two.adjacent', 'face', [0, 2], function () {
      k.extrudeSelection(); k.setPendingAmount(0.5);
    });
    run('face.inset.each', 'face', [0], function () {
      k.insetSelection(); k.setPendingAmount(0.25);
    });
    run('face.inset.closed.organic', 'face', [0, 1, 2, 3, 4, 5], function () {
      k.insetSelection();
      if (A.pendingOp) { A.pendingOp.groupMode = 'organic'; k.applyPendingOp(); k.setPendingAmount(0.25); }
    });
    run('face.subdivide', 'face', [0], function () {
      k.subdivideSelection();
    });
    run('face.delete', 'face', [0], function () { k.deleteSelection(); });
    run('face.detach', 'face', [0], function () { k.detachFacesSelection(); });
    // Flipping one face of a closed cube inverts it against its neighbours
    // BY DEFINITION - the toast says so under ?debug=1.
    run('face.flip', 'face', [0], function () { k.flipNormalsSelection(); }, { expectWinding: true });
    run('face.shade.smooth', 'face', [0], function () { k.shadeSelection(true); });
    run('face.shade.flat', 'face', [0], function () { k.shadeSelection(false); });
    run('face.separate', 'face', [0], function () { k.separateSelection(); });
    /* Two opposite faces of a CLOSED cube: the walls land on edges that
       already had two faces each, so non-manifold is the honest result of
       the request, not a defect. The op says "folds over itself". */
    run('face.bridge.opposite', 'face', [0, 1], function () { k.bridgeSelection(); },
        { expectWinding: true });
    run('face.grow', 'face', [0], function () { k.growSelection(); });
    run('face.shrink', 'face', [0, 1, 2], function () { k.shrinkSelection(); });
    run('face.setflow', 'face', [0], function () {
      k.setFlowSelection(); k.setPendingAmount(1);
    });
    run('edge.loopcut.flow', 'edge', [anEdge()], function () {
      k.edgeLoopSelection();
      if (A.pendingOp) { A.pendingOp.flow = true; k.applyPendingOp(); }
    });

    /* ---------------- EDGE mode ---------------- */
    // A flap grown from an edge of a closed mesh hangs off an edge that
    // already had two faces: non-manifold by construction, not by mistake.
    run('edge.extrude', 'edge', [anEdge()], function () {
      k.extrudeSelection(); k.setPendingAmount(0.4);
    }, { expectWinding: true });
    run('edge.bevel', 'edge', [anEdge()], function () {
      k.bevelSelection(); k.setPendingAmount(0.08);
    });
    run('edge.loopcut', 'edge', [anEdge()], function () {
      k.edgeLoopSelection();
    });
    run('edge.split', 'edge', [anEdge()], function () { k.splitSelection(); });
    run('edge.crease.on', 'edge', [anEdge()], function () { k.creaseSelection(true); });
    run('edge.crease.off', 'edge', [anEdge()], function () { k.creaseSelection(false); });
    run('edge.marksharp', 'edge', [anEdge()], function () { k.markSharpSelection(); });
    run('edge.collapse', 'edge', [anEdge()], function () { k.collapseSelection(); });
    run('edge.delete', 'edge', [anEdge()], function () { k.deleteSelection(); });
    run('edge.grow', 'edge', [anEdge()], function () { k.growSelection(); });
    run('edge.setflow', 'edge', [anEdge()], function () {
      k.setFlowSelection(); k.setPendingAmount(1);
    });

    /* ---------------- VERTEX mode ---------------- */
    run('vertex.weld', 'vertex', [], function () {
      A.selectedElements = new Set(twoVerts()); k.weldSelection();
    });
    run('vertex.merge', 'vertex', [], function () {
      A.selectedElements = new Set(twoVerts()); k.mergeSelection();
    });
    run('vertex.connect', 'vertex', [], function () {
      var t = topo(obj), g = t.faceGroups[0].logicalVerts;
      A.selectedElements = new Set([g[0], g[2]]);
      k.connectSelection();
    });
    run('vertex.delete', 'vertex', [0], function () { k.deleteSelection(); });
    run('vertex.grow', 'vertex', [0], function () { k.growSelection(); });
    run('vertex.setflow', 'vertex', [], function () {
      A.selectedElements = new Set(twoVerts());
      k.setFlowSelection(); k.setPendingAmount(1);
    });

    /* ---------------- OBJECT mode ---------------- */
    run('object.subdivide', 'object', [], function () { k.subdivideSelection(); });
    run('object.autosmooth', 'object', [], function () { k.autoSmoothSelection(); });
    run('object.flip', 'object', [], function () { k.flipNormalsSelection(); });
    run('object.fillholes', 'object', [], function () { k.fillHolesSelection(); });
    run('object.mirror', 'object', [], function () { k.mirrorSelectedObjects('x', false); });
    run('object.mirror.apart', 'object', [], function () { k.mirrorSelectedObjects('x', true); });

    /* ---------------- refusals that must be spoken ---------------- */
    reset('face', [0]);
    k.insetSelection();
    var t0 = toastText();
    k.bridgeSelection();
    log('guard.bridge.over.bar', toastText() !== t0 ? 'says: ' + toastText().slice(0, 44) : 'SILENT');
    if (A.pendingOp) k.cancelPendingOp();
    reset('edge', [0]);
    k.bevelSelection();
    var t1 = toastText();
    k.startKnife();
    log('guard.knife.over.bar', toastText() !== t1 ? 'says: ' + toastText().slice(0, 44) : 'SILENT');
    if (A.pendingOp) k.cancelPendingOp();
    if (A.knife) k.cancelKnife(true);

    log('console.errors', errs.length ? errs.join(' | ').slice(0, 400) : 'none');
  }

  window.addEventListener('error', function (e) { errs.push('onerror: ' + (e.message || e) + ' @' + (e.lineno || '')); });
  window.addEventListener('unhandledrejection', function (e) { errs.push('rejection: ' + ((e.reason && (e.reason.stack || e.reason.message)) || e.reason)); });
  function ready(cb, tries) {
    tries = tries || 0;
    if (window.__kubik && window.__kubik.renderer && window.__kubik.App) return cb();
    if (tries > 250) { out.push('ERROR=__kubik never appeared'); return finish(); }
    setTimeout(function () { ready(cb, tries + 1); }, 20);
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
        try { main(); } catch (e) { out.push('ERROR=' + (e && e.stack ? e.stack.split('\n').slice(0, 5).join(' / ') : e)); }
        finish();
      }, 600);
    });
  }, 300);
})();
