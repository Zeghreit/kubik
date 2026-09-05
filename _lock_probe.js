/* a2.57 - the frame marks what a tap can reach, and a component mode works
   on one object.

   Two complaints, one idea. Every assertion below is about what is VISIBLE
   or what a tap DID, never about internals for their own sake. */
(function () {
  var out = [], errs = [];
  var _ce = console.error;
  console.error = function () { errs.push(Array.prototype.join.call(arguments, ' ')); _ce.apply(console, arguments); };
  function log(k, v) { out.push(k + '=' + v); }
  var k, A, T3, a, b;

  function framed() {
    return A.objects.filter(function (o) {
      var l = o.mesh.userData.edgeLines;
      return l && l.visible;
    }).map(function (o) { return o.name; });
  }
  function hasTopo(o) { return !!o.mesh.userData.topo; }
  // A screen point over an object's centre, for a tap that should land on it.
  function atObject(o) {
    o.mesh.updateMatrixWorld(true);
    var p = new T3.Vector3().setFromMatrixPosition(o.mesh.matrixWorld).project(k.camera);
    var r = k.renderer.domElement.getBoundingClientRect();
    return { clientX: r.left + (p.x * 0.5 + 0.5) * r.width,
             clientY: r.top + (-p.y * 0.5 + 0.5) * r.height };
  }

  function main() {
    k = window.__kubik; A = k.App; T3 = k.THREE;
    /* handleTap takes ONE argument - `additive` comes from App.multiSelect or
       a held shift, not from the caller. Passing a second argument here did
       nothing and the multi-select toggle quietly made every tap additive. */
    A.multiSelect = false;
    a = A.objects[0];
    a.mesh.position.set(-2.2, 0.5, 0);
    A.selectedObjectIds = new Set([a.id]);
    k.duplicateSelection();
    b = A.objects[A.objects.length - 1];
    b.mesh.position.set(2.2, 0.5, 0);
    b.mesh.updateMatrixWorld(true);
    a.mesh.updateMatrixWorld(true);
    log('0.scene', A.objects.length + ' objects: ' + A.objects.map(function (o) { return o.name; }).join(', '));

    /* ---- 1. Object mode: only what is selected is framed ---- */
    k.setMode('object');
    A.selectedObjectIds = new Set([a.id]);
    A.activeObjectId = null;
    k.refreshUI();
    log('1.framed', '[' + framed().join(', ') + ']  (must be just ' + a.name + ')');

    /* ---- 2. ...and nothing else had its topology built for it ----
       One tap used to build the full topology of every model in the scene. */
    A.objects.forEach(function (o) { o.mesh.userData.topo = null; });
    k.refreshUI();
    log('2.topo_built_for', A.objects.filter(hasTopo).map(function (o) { return o.name; }).join(', ') +
      '  (must be just ' + a.name + ')');

    /* ---- 3. Component mode frames the ACTIVE object alone ---- */
    A.activeObjectId = a.id;
    k.setMode('face');
    k.ensureHelpers(a);
    A.selectedElements = new Set([0]);
    k.refreshUI();
    log('3.framed', '[' + framed().join(', ') + ']  (must be just ' + a.name + ')');

    /* ---- 4. THE ONE THAT MATTERS: a tap on the other object is refused ----
       This is the near-miss that used to move the mode, the selection and
       the anchors onto whatever was under the finger. ---- */
    var before = { active: A.activeObjectId, sel: A.selectedElements.size, mode: A.mode };
    k.handleTap(atObject(b));
    log('4.active_held', A.activeObjectId === before.active
      ? 'still editing ' + a.name : 'JUMPED TO ' + (k.findObject(A.activeObjectId) || {}).name);
    log('4.selection_held', A.selectedElements.size === before.sel
      ? before.sel + ' element(s) kept' : 'SELECTION LOST');
    /* The REFUSAL wording, not just the object's name: the old build's
       "Editing Cube 1 copy" contains "Cube 1" as a substring and passed a
       name-only check while doing exactly the wrong thing. */
    var msg4 = document.getElementById('toast').textContent || '';
    log('4.said_so', (msg4.indexOf(a.name) >= 0 && msg4.indexOf('Object mode') >= 0)
      ? 'toast names the locked object and the way out' : 'WRONG MESSAGE: "' + msg4 + '"');
    log('4.other_unframed', framed().indexOf(b.name) < 0 ? b.name + ' stays dark' : 'STILL FRAMED');

    /* ---- 5. Tapping the active object still works ---- */
    var s5 = A.selectedElements.size;
    k.handleTap(atObject(a));
    log('5.own_object_live', A.selectedElements.size !== s5 || A.activeObjectId === a.id
      ? 'the tap reached ' + a.name : 'OWN OBJECT REFUSED TOO');

    /* ---- 6. Object mode is the way out, and it works ---- */
    k.setMode('object');
    k.handleTap(atObject(b));
    log('6.switch_in_object_mode', A.selectedObjectIds.has(b.id)
      ? 'selected ' + b.name : 'COULD NOT SWITCH');
    log('6.framed_after', '[' + framed().join(', ') + ']  (must be just ' + b.name + ')');
    log('6.diag', 'selectedObjectIds=' + Array.from(A.selectedObjectIds).map(function (id) {
      return (k.findObject(id) || {}).name; }).join('+') + ' · activeObjectId=' +
      ((k.findObject(A.activeObjectId) || {}).name || 'none') + ' · mode=' + A.mode);

    /* ---- 7. With no object to be locked to, a tap adopts one ----
       How you get in at all: after a delete, or on a fresh scene. ---- */
    k.setMode('face');
    A.activeObjectId = null;
    A.selectedElements.clear();
    k.handleTap(atObject(b));
    log('7.adopts_when_free', A.activeObjectId === b.id
      ? 'adopted ' + b.name + ' when nothing held the lock' : 'STRANDED with no active object');

    /* ---- 8. THE DOOR the toast promises: Object mode moves the lock ----
       The refusal in 4 tells you to switch objects in Object mode. Object
       mode writes selectedObjectIds and NOT activeObjectId, so unless
       entering a component mode re-reads the selection, the advice is a
       lie and the Scene list is the only way out. ---- */
    k.setMode('object');
    A.selectedObjectIds = new Set([b.id]);
    A.activeObjectId = a.id;              // the lock left behind
    k.setMode('face');
    log('8.door', A.activeObjectId === b.id
      ? 'Object mode moved the lock to ' + b.name
      : 'LOCK STUCK ON ' + ((k.findObject(A.activeObjectId) || {}).name || 'none'));

    // An EMPTY object selection must NOT steal the lock - that is the
    // "carry on where you were" case.
    k.setMode('object');
    A.selectedObjectIds.clear();
    A.activeObjectId = a.id;
    k.setMode('edge');
    log('8.empty_selection', A.activeObjectId === a.id
      ? 'kept ' + a.name : 'LOST THE LOCK TO NOTHING');

    // Duplicate leaves the selection on the copy and the lock on the
    // original, so the copy would be untappable in a component mode.
    k.setMode('object');
    A.selectedObjectIds = new Set([a.id]);
    A.activeObjectId = a.id;
    k.duplicateSelection();
    var c = A.objects[A.objects.length - 1];
    k.setMode('vertex');
    log('8.after_duplicate', A.activeObjectId === c.id
      ? 'lock follows the copy' : 'LOCK LEFT ON THE ORIGINAL');

    /* ---- 9. Snapping ONTO an object nobody framed ----
       The frame no longer builds every object's topology, and the snap
       refiner reads topo without building it: no topo means no corners and
       no edges, and the snap silently degrades to "wherever the ray met the
       surface" with no message at all. ---- */
    k.setMode('object');
    A.selectedObjectIds = new Set([a.id]);
    A.activeObjectId = a.id;
    k.refreshUI();
    A.objects.forEach(function (o) { o.mesh.userData.topo = null; });   // as if never framed
    b.mesh.updateMatrixWorld(true);
    var r9 = k.renderer.domElement.getBoundingClientRect();
    var scr = function (w) {
      var p = w.clone().project(k.camera);
      return { x: r9.left + (p.x * 0.5 + 0.5) * r9.width, y: r9.top + (-p.y * 0.5 + 0.5) * r9.height };
    };
    var gp = b.mesh.geometry.attributes.position;
    var best = null, bestY = Infinity;
    for (var i = 0; i < gp.count; i++) {                 // the topmost corner
      var w = b.mesh.localToWorld(new T3.Vector3(gp.getX(i), gp.getY(i), gp.getZ(i)));
      var s = scr(w);
      if (s.y < bestY) { bestY = s.y; best = s; }
    }
    var mid = scr(new T3.Vector3().setFromMatrixPosition(b.mesh.matrixWorld));
    // A few px INSIDE the silhouette, so the ray certainly hits the mesh
    // and the corner is still well within SNAP_VERT_PX.
    var ev9 = { clientX: best.x + (mid.x - best.x) * 0.08,
                clientY: best.y + (mid.y - best.y) * 0.08 };
    var t9 = k.snapTargetAt(ev9, { objects: new Set([a.id]) });
    log('9.snap_kind', (t9 ? t9.kind : 'NO TARGET') + '  (must be vertex, not face)');
    log('9.topo_on_demand', hasTopo(b) ? 'built for the target' : 'TARGET STILL BARE');
    log('9.target_unframed', framed().indexOf(b.name) < 0
      ? b.name + ' stayed dark while being snapped to' : 'SNAP TARGET LIT UP');

    /* ---- 10. The OTHER door: the Scene list, and it has to stick ----
       The chip moves the lock without touching the object selection, so
       once entering a component mode re-reads that selection, a trip out to
       Object mode and back would silently undo the switch. ---- */
    k.setMode('object');
    A.selectedObjectIds = new Set([a.id]);
    A.activeObjectId = a.id;
    k.setMode('vertex');
    k.refreshUI();
    /* a2.91: the object list is the OUTLINER now, not chips in the drawer -
       and it is built only while the shelf is open, so open it first. */
    k.setOutlinerOpen(true);
    var chips = document.querySelectorAll('.outRow');
    var chipB = chips[A.objects.indexOf(b)];
    if (!chipB) { log('10.chip', 'NO CHIP FOUND (' + chips.length + ' chips)'); }
    else {
      chipB.click();
      log('10.chip_moves_lock', A.activeObjectId === b.id
        ? 'chip handed the lock to ' + b.name
        : 'CHIP DID NOTHING (' + ((k.findObject(A.activeObjectId) || {}).name || 'none') + ')');
      k.setMode('object');
      k.setMode('vertex');
      log('10.chip_survives_roundtrip', A.activeObjectId === b.id
        ? 'still ' + b.name + ' after Object mode and back'
        : 'REVERTED TO ' + ((k.findObject(A.activeObjectId) || {}).name || 'none'));
    }

    log('console.errors', errs.length ? errs.join(' | ').slice(0, 400) : 'none');
  }

  window.addEventListener('error', function (e) { errs.push('onerror: ' + (e.message || e) + ' @' + (e.lineno || '')); });
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
        try { main(); } catch (e) {
          out.push('ERROR=' + (e && e.stack ? e.stack.split('\n').slice(0, 6).join(' / ') : e));
        }
        finish();
      }, 600);
    });
  }, 300);
})();
