/* a2.52 - applyShading's topology cache.

   The claim is narrow and total: for the length of one drag the topology is
   built ONCE, and the shading that comes out of the cached pass is identical,
   value for value, to what the full pass produces from the same positions.
   Every case below either counts builds or compares two arrays. */
(function () {
  var out = [], errs = [];
  var _ce = console.error;
  console.error = function () { errs.push(Array.prototype.join.call(arguments, ' ')); _ce.apply(console, arguments); };
  function log(k, v) { out.push(k + '=' + v); }
  var k, A, P, T3, obj;

  function geo() { return obj.mesh.geometry; }
  function normals() { return Float32Array.from(geo().attributes.normal.array); }
  function edges() {
    var e = geo().userData.kubikEdges || { pos: new Float32Array(0), kind: new Uint8Array(0) };
    return { pos: Float32Array.from(e.pos), kind: Uint8Array.from(e.kind) };
  }
  // Exact, not near: the two passes do the same arithmetic in the same order,
  // so anything but bit equality is a real difference.
  function same(a, b) {
    if (a.length !== b.length) return 'LENGTH ' + a.length + ' vs ' + b.length;
    for (var i = 0; i < a.length; i++) {
      if (a[i] !== b[i]) return 'DIFFERS at ' + i + ': ' + a[i] + ' vs ' + b[i];
    }
    return null;
  }
  function nearestLogical(o, x, y, z) {
    var t = o.mesh.userData.topo, best = -1, bd = 1e9, want = new T3.Vector3(x, y, z);
    for (var l = 0; l < t.logicalCount; l++) {
      var d = k.logicalPos(o, l).distanceTo(want);
      if (d < bd) { bd = d; best = l; }
    }
    return best;
  }
  function drag(n) {
    k.setTransformTool('move');
    A.transformMode = 'free';
    k.beginDirectDrag({ clientX: 400, clientY: 400, pointerId: 1, pointerType: 'touch' });
    for (var i = 0; i < n; i++) {
      k.applyDeltaToSelection(new T3.Matrix4().makeTranslation(0.08 * (i + 1), 0.05 * (i + 1), 0.03 * (i + 1)));
    }
  }

  function main() {
    k = window.__kubik; A = k.App; P = k.PERF; T3 = k.THREE;
    obj = A.objects[0];
    A.selectedObjectIds = new Set([obj.id]); A.activeObjectId = obj.id;
    k.ensureHelpers(obj);
    /* a2.75 skips the wear-edge pass for an object that wears no shape
       mask, and nothing in this file wore one - so every assertion below
       about wear positions was comparing two EMPTY lists and passing.

       The flag cannot be set by hand: ensureMaskPatches recomputes it from
       the material definitions on every rebuild. And setting it on ONE
       object is not enough either, because sections 6 and 8 build their
       own. So the DEFAULT definition gets a bevel - defWantsField reads
       `d.bevel > 0` first - and every object this probe makes then wants a
       wear list, which is the state the whole file was written against. */
    k.MATERIALS.get('standard').bevel = 0.2;
    k.rebuildFromEditable(obj, k.toEditable(obj.mesh));
    var wear0 = k.__wearCount ? k.__wearCount(obj) :
      ((obj.mesh.geometry.userData.kubikEdges || {}).kind || []).length;
    log('0.wear_pass_runs', wear0 > 0
      ? 'the wear pass is on for this probe (' + wear0 + ' edges)'
      : 'THE WEAR PASS IS OFF - every wear assertion below is vacuous');

    /* ---- 1. Idle, there is no cache at all ----
       Two calls with no finger down must do two full builds and leave
       nothing behind, or an edit that welds two vertices would keep reading
       the grouping from before it. */
    var t1 = P.shadeTopo;
    k.applyShading(obj);
    k.applyShading(obj);
    log('1.idle_builds', (P.shadeTopo - t1) + '  (must be 2 - one per call)');
    log('1.idle_stores_nothing', geo().userData.shadeTopo ? 'STORED - MUST BE NULL' : 'null');

    /* ---- 2. One build for a whole drag ---- */
    k.setMode('vertex');
    k.ensureHelpers(obj);
    A.selectedElements = new Set([nearestLogical(obj, 1, 1, 1)]);
    var s2 = P.shade, t2 = P.shadeTopo;
    drag(6);
    log('2.passes_and_builds', (P.shade - s2) + ' shading passes, ' + (P.shadeTopo - t2) +
      ' topology builds  (must be 6 and 1)');
    log('2.cache_live', geo().userData.shadeTopo ? 'held on the geometry' : 'MISSING MID-DRAG');

    /* ---- 3. THE ONE THAT MATTERS: cached == uncached ----
       The normals on screen are the ones the sixth, cached frame wrote.
       Clearing the cache and running again re-derives everything from the
       same positions; the two must agree exactly. */
    var nCached = normals(), eCached = edges();
    geo().userData.shadeTopo = null;
    k.applyShading(obj);
    var nFull = normals(), eFull = edges();
    log('3.normals', same(nCached, nFull) || 'identical (' + nFull.length + ' floats)');
    log('3.wear_positions', same(eCached.pos, eFull.pos) || 'identical (' + (eFull.pos.length / 6) + ' edges)');
    log('3.wear_kinds', same(eCached.kind, eFull.kind) || 'identical');

    /* ---- 4. The cache dies with the drag ---- */
    var midDrag = !!geo().userData.shadeTopo;
    k.endDirectDrag();
    var t4 = P.shadeTopo;
    k.applyShading(obj);
    log('4.dropped_on_lift', 'live during the drag=' + midDrag + ', builds on the next call=' +
      (P.shadeTopo - t4) + ' (must be 1), stored now=' +
      (geo().userData.shadeTopo ? 'YES - MUST BE NULL' : 'null'));

    /* ---- 5. An op installs a new geometry, and it is shaded from scratch ---- */
    k.setMode('face');
    A.selectedElements = new Set([0]);
    k.insetSelection();
    if (A.pendingOp) { A.pendingOp.amount = 0.3; k.applyPendingOp(); k.confirmPendingOp(); }
    var n5 = normals();
    geo().userData.shadeTopo = null;
    k.applyShading(obj);
    log('5.after_op', same(n5, normals()) || 'identical after an inset rebuilt the mesh');

    /* ---- 6. A closed curved shell, which is where the winding test bites ----
       A sphere has one component, a real signed volume and hundreds of edges
       under the smoothing angle - the parts of the pass that stayed
       position-dependent. If the cached shell ever disagreed with the full
       one, it would show here first. */
    k.startGeoSetup('sphere');
    var sid = A.geoSetup.objId;
    k.finishGeoSetup(true);
    obj = k.findObject(sid);
    A.selectedObjectIds = new Set([sid]); A.activeObjectId = sid;
    k.setMode('vertex');
    k.ensureHelpers(obj);
    log('6.sphere', geo().index.count / 3 + ' triangles, ' + obj.mesh.userData.topo.logicalCount + ' vertices');
    A.selectedElements = new Set([nearestLogical(obj, 0, 1, 0)]);
    var s6 = P.shade, t6 = P.shadeTopo;
    drag(5);
    log('6.passes_and_builds', (P.shade - s6) + ' passes, ' + (P.shadeTopo - t6) +
      ' builds  (must be 5 and 1)');
    var n6 = normals(), e6 = edges();
    geo().userData.shadeTopo = null;
    k.applyShading(obj);
    log('6.normals', same(n6, normals()) || 'identical (' + n6.length + ' floats)');
    log('6.wear_positions', same(e6.pos, edges().pos) || 'identical (' + (e6.pos.length / 6) + ' edges)');
    log('6.wear_kinds', same(e6.kind, edges().kind) || 'identical');
    k.endDirectDrag();

    /* ---- 7. And with hand marks on, which is the other branch of `sharp` ---- */
    k.setMode('edge');
    k.ensureHelpers(obj);
    A.selectedElements = new Set([0, 1, 2, 3, 4]);
    k.markSharpSelection();
    k.setMode('vertex');
    A.selectedElements = new Set([nearestLogical(obj, 0, 1, 0)]);
    drag(4);
    var n7 = normals();
    geo().userData.shadeTopo = null;
    k.applyShading(obj);
    log('7.marked_normals', same(n7, normals()) || 'identical with 5 edges marked sharp');
    k.endDirectDrag();

    /* ---- 8. What is on screen when the finger LIFTS is the full pass ----
       The cache freezes the vertex welding for the length of the gesture.
       That is fine while it lasts, and wrong the moment it outlives one:
       drag a corner exactly onto another corner - which is what snapping is
       for - and the two are now ONE vertex. Review round 1 found the drag
       ending with the cached answer still on screen, so this drags a plane's
       corner onto its neighbour, lets go, and demands the settled result
       match a pass that never saw the cache. */
    k.startGeoSetup('plane');
    var pid = A.geoSetup.objId;
    k.applyGeoParams({ h: 1, v: 1, x: 2, y: 1, z: 2 });
    k.finishGeoSetup(true);
    obj = k.findObject(pid);
    A.selectedObjectIds = new Set([pid]); A.activeObjectId = pid;
    k.setMode('vertex');
    k.ensureHelpers(obj);
    var corner = nearestLogical(obj, 1, 0, 1);
    A.selectedElements = new Set([corner]);
    k.setTransformTool('move');
    A.transformMode = 'free';
    k.beginDirectDrag({ clientX: 400, clientY: 400, pointerId: 1, pointerType: 'touch' });
    k.applyDeltaToSelection(new T3.Matrix4().makeTranslation(-1, 0, 0));
    k.applyDeltaToSelection(new T3.Matrix4().makeTranslation(-2, 0, 0));   // exactly onto (-1, 0, 1)
    k.endDirectDrag();
    var n8 = normals(), e8 = edges();
    log('8.cache_released', geo().userData.shadeTopo ? 'STILL HELD AFTER THE LIFT' : 'released');
    geo().userData.shadeTopo = null;
    k.applyShading(obj);
    log('8.settled_normals', same(n8, normals()) || 'identical after the lift');
    log('8.settled_wear', same(e8.pos, edges().pos) || 'identical after the lift (' +
      (e8.pos.length / 6) + ' edges)');

    /* ================= a2.53 - the selection overlay ================= */

    /* ---- 9. Vertex mode: nudged, not rebuilt ---- */
    obj = k.findObject(pid);
    k.setMode('vertex');
    k.ensureHelpers(obj);
    var v9 = nearestLogical(obj, 1, 0, -1);
    A.selectedElements = new Set([v9]);
    k.refreshElementColors(obj);
    var pts9 = obj.mesh.userData.selPoints;
    var r9 = P.selRebuild, strokes9 = k.gizmoStrokes.length;
    drag(6);
    log('9.rebuilds', (P.selRebuild - r9) + ' rebuilds across 6 drag frames  (must be 0)');
    log('9.same_object', obj.mesh.userData.selPoints === pts9
      ? 'the same Points object throughout' : 'REPLACED');
    var want9 = k.logicalPos(obj, v9);
    var got9 = obj.mesh.userData.selPoints.geometry.attributes.position;
    log('9.dot_followed', Math.abs(got9.getX(0) - want9.x) < 1e-6 && Math.abs(got9.getY(0) - want9.y) < 1e-6
      ? 'the dot sits on the vertex' : 'STALE: dot ' + got9.getX(0).toFixed(3) + ' vs vertex ' + want9.x.toFixed(3));
    log('9.strokes', k.gizmoStrokes.length === strokes9
      ? 'stroke list did not grow' : 'GREW ' + strokes9 + ' -> ' + k.gizmoStrokes.length);

    /* ---- 10. ...and the moment it stops describing the selection, it is
       rebuilt. The nudge is not allowed to be a guess. ---- */
    var r10 = P.selRebuild;
    A.selectedElements.add(nearestLogical(obj, -1, 0, -1));
    k.applyDeltaToSelection(new T3.Matrix4().makeTranslation(0.2, 0, 0));
    log('10.rebuilt_on_change', (P.selRebuild - r10) + ' rebuild  (must be 1)');
    log('10.now_holds', (obj.mesh.userData.selPointIds || []).length + ' dots  (must be 2)');
    k.endDirectDrag();

    /* ---- 11. Edge mode, where the rebuild also churned the stroke list ---- */
    k.setMode('edge');
    k.ensureHelpers(obj);
    A.selectedElements = new Set([0, 1]);
    k.refreshElementColors(obj);
    var seg11 = obj.mesh.userData.selLines;
    var r11 = P.selRebuild, strokes11 = k.gizmoStrokes.length;
    drag(6);
    log('11.rebuilds', (P.selRebuild - r11) + ' rebuilds across 6 drag frames  (must be 0)');
    log('11.same_object', obj.mesh.userData.selLines === seg11
      ? 'the same LineSegments2 throughout' : 'REPLACED');
    log('11.strokes', k.gizmoStrokes.length === strokes11
      ? 'stroke list did not grow' : 'GREW ' + strokes11 + ' -> ' + k.gizmoStrokes.length);
    k.endDirectDrag();

    /* ---- 12. Face mode draws none of this, and must not rebuild for ever ---- */
    k.setMode('face');
    k.ensureHelpers(obj);
    A.selectedElements = new Set([0]);
    k.refreshElementColors(obj);
    var r12 = P.selRebuild;
    drag(4);
    log('12.face_mode', (P.selRebuild - r12) + ' rebuilds  (must be 0 - there is nothing drawn to rebuild)');
    log('12.nothing_left', (!obj.mesh.userData.selPoints && !obj.mesh.userData.selLines)
      ? 'no vertex or edge overlay in Face mode' : 'LEFTOVER LAYER');
    k.endDirectDrag();

    /* ---- 13. A nudged geometry keeps the bounding sphere it was BUILT with,
       and three only recomputes a null one. Rebuilding every frame used to
       hide that: one selected vertex has a radius-0 sphere at the old corner,
       so dragging it into a spike and orbiting away took its own dot off
       screen. Review round 1. ---- */
    k.setMode('vertex');
    k.ensureHelpers(obj);
    var v13 = nearestLogical(obj, 1, 0, -1);
    A.selectedElements = new Set([v13]);
    k.refreshElementColors(obj);
    var pts13 = obj.mesh.userData.selPoints;
    log('13.dots_not_culled', pts13 && pts13.frustumCulled === false
      ? 'the selected dots are exempt from frustum culling' : 'CULLED - a stale sphere can hide them');
    log('13.soft_not_culled', (function () {
      // A radius wide enough to actually reach the other corners, or the
      // field is empty and there is no layer to check.
      A.soft = true; A.softRadius = 3; A.softRadiusFor = obj.id;
      k.refreshElementColors(obj);
      var sp = obj.mesh.userData.softPoints;
      A.soft = false;
      k.refreshElementColors(obj);
      return !sp ? 'no falloff layer here to check'
        : sp.frustumCulled === false ? 'the falloff dots too (a2.40 had the same hole)'
        : 'FALLOFF DOTS STILL CULLED';
    })());

    /* ---- 14. The fit test compares against the selection the overlay was
       BUILT for, not against what got drawn - or an element the topology
       cannot place would latch the rebuild on for every frame, silently
       giving back the whole win. ---- */
    k.setMode('edge');
    k.ensureHelpers(obj);
    A.selectedElements = new Set([0, 999999]);   // one real edge, one that is not
    k.refreshElementColors(obj);
    log('14.drew_fewer', (obj.mesh.userData.selLineIds || []).length + ' drawn of ' +
      A.selectedElements.size + ' selected  (the unplaceable one is skipped)');
    var r14 = P.selRebuild;
    k.syncHelperGeometry(obj);
    k.syncHelperGeometry(obj);
    k.syncHelperGeometry(obj);
    log('14.no_latch', (P.selRebuild - r14) + ' rebuilds across 3 frames  (must be 0)');
    A.selectedElements = new Set();
    k.refreshElementColors(obj);

    /* ================= a2.54 - one face overlay ================= */

    /* ---- 15. The helper count no longer follows the face count ----
       One Mesh + geometry + material per face group used to be added to the
       mesh and left there for the session, so updateMatrixWorld walked all of
       them every frame to draw the two that were selected. ---- */
    k.startGeoSetup('sphere');
    var sid15 = A.geoSetup.objId;
    k.finishGeoSetup(true);
    var sph = k.findObject(sid15);
    A.selectedObjectIds = new Set([sid15]); A.activeObjectId = sid15;
    k.setMode('face');
    k.ensureHelpers(sph);
    var groups = sph.mesh.userData.topo.faceGroups.length;
    log('15.children', sph.mesh.children.length + ' helper children for ' + groups +
      ' face groups  (must not grow with the face count)');

    /* ---- 16. ...and it still draws exactly the selected faces ---- */
    A.selectedElements = new Set([0, 1, 2]);
    k.refreshElementColors(sph);
    var fo = sph.mesh.userData.faceOverlay;
    var wantTris = 0;
    [0, 1, 2].forEach(function (gi) { wantTris += sph.mesh.userData.topo.faceGroups[gi].triCount; });
    log('16.overlay', fo && fo.visible ? 'drawn' : 'MISSING');
    log('16.right_triangles', fo && fo.geometry.index
      ? (fo.geometry.index.count / 3) + ' triangles for 3 groups  (want ' + wantTris + ')' : 'NO INDEX');
    log('16.borrows_positions', fo && fo.geometry.attributes.position === sph.mesh.geometry.attributes.position
      ? 'shares the live position attribute, so it follows a drag for free' : 'HAS ITS OWN COPY');
    log('16.not_culled', fo && fo.frustumCulled === false
      ? 'exempt from culling, like the other nudged layers' : 'CULLED');

    /* ---- 17. A different selection re-indexes it; an empty one hides it ---- */
    A.selectedElements = new Set([5]);
    k.refreshElementColors(sph);
    var one = sph.mesh.userData.topo.faceGroups[5].triCount;
    log('17.reindexed', (fo.geometry.index.count / 3) + ' triangles for 1 group  (want ' + one + ')');
    log('17.same_object', sph.mesh.userData.faceOverlay === fo ? 'the same Mesh, re-indexed' : 'REPLACED');
    A.selectedElements = new Set();
    k.refreshElementColors(sph);
    log('17.hidden_when_empty', !sph.mesh.userData.faceOverlay.visible ? 'hidden' : 'STILL DRAWN');
    log('17.still_one_child', sph.mesh.children.length + ' children  (the overlay is kept, not re-added)');

    /* ---- 18. The selection belongs to ONE object ----
       App.selectedElements is global and every object carries a topo once
       anything is selected, so an overlay drawn for a non-active object
       paints ITS face 2 because face 2 of something ELSE is selected.
       applyTheme is the path that reaches every object at once. ---- */
    A.activeObjectId = sid15;
    A.selectedElements = new Set([0, 1]);
    k.refreshElementColors(sph);
    var other = A.objects[0];
    k.ensureHelpers(other);
    k.refreshElementColors(other);       // as applyTheme does, for every object
    log('18.other_object', !other.mesh.userData.faceOverlay || !other.mesh.userData.faceOverlay.visible
      ? 'nothing drawn on the object the selection is not about' : 'TINTED THE WRONG OBJECT');
    log('18.active_still_drawn', sph.mesh.userData.faceOverlay && sph.mesh.userData.faceOverlay.visible
      ? 'and the active one still is' : 'LOST THE ACTIVE OVERLAY');
    k.applyTheme && k.applyTheme();
    log('18.after_theme', (!other.mesh.userData.faceOverlay || !other.mesh.userData.faceOverlay.visible)
      ? 'still clean after a theme change' : 'THEME TINTED THE WRONG OBJECT');

    log('console.errors', errs.length ? errs.join(' | ').slice(0, 400) : 'none');
  }

  window.addEventListener('error', function (e) { errs.push('onerror: ' + (e.message || e) + ' @' + (e.lineno || '')); });
  function ready(cb, t) {
    t = t || 0;
    if (window.__kubik && window.__kubik.App && window.__kubik.PERF) return cb();
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
