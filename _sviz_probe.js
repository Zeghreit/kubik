/* The soft falloff, drawn: that the three layers exist in the right modes,
   that the alpha actually carries the weight, and that nothing is left behind. */
(function () {
  var out = [], errs = [];
  var _ce = console.error;
  console.error = function () { errs.push(Array.prototype.join.call(arguments, ' ')); _ce.apply(console, arguments); };
  function log(k, v) { out.push(k + '=' + v); }
  var k, A, T3, grid;

  function lp(obj, l) { return k.logicalPos(obj, l).clone(); }
  function nearestLogical(obj, x, y, z) {
    var t = obj.mesh.userData.topo, best = -1, bd = 1e9, want = new T3.Vector3(x, y, z);
    for (var l = 0; l < t.logicalCount; l++) { var d = lp(obj, l).distanceTo(want); if (d < bd) { bd = d; best = l; } }
    return best;
  }
  function ud(key) { return grid.mesh.userData[key]; }
  function alphas(o) {
    if (!o) return null;
    var c = o.geometry.attributes.color;
    if (!c) return null;
    var a = [];
    for (var i = 0; i < c.count; i++) a.push(c.getW ? c.getW(i) : null);
    return a;
  }

  function main() {
    k = window.__kubik; A = k.App; T3 = k.THREE;

    // An 8x8 plane across 8 units, so an edge is exactly 1 unit.
    k.startGeoSetup('plane');
    var id = A.geoSetup.objId;
    k.applyGeoParams({ h: 8, v: 8, x: 8, y: 1, z: 8 });
    k.finishGeoSetup(true);
    grid = k.findObject(id);
    A.selectedObjectIds = new Set([id]); A.activeObjectId = id;
    k.ensureHelpers(grid);

    k.setMode('vertex');
    var centre = nearestLogical(grid, 0, 0, 0);
    A.selectedElements = new Set([centre]);
    /* The radius set here is a REQUEST, not the final word: refreshSoftField
       re-measures it for an object it has not measured before (a2.37a), so the
       field ends up at a quarter of this plane's diagonal rather than at 3.
       That is the intended behaviour, and the weights below are checked
       against whatever the field actually holds rather than against arithmetic
       done here - which is why the top alpha reads ~0.72 and not 0.75. */
    A.soft = true; A.softRadius = 3;
    k.refreshElementColors(grid);

    /* ---- 1. Dots: they exist, and their alpha IS the weight ---- */
    var pts = ud('softPoints');
    log('1.points', pts ? pts.geometry.attributes.position.count + ' dots' : 'NONE');
    var f = k.softField;
    log('1.field', f ? f.size + ' verts (one of them the seed, drawn by the selection overlay)' : 'NONE');
    log('1.count.matches', (pts && f && pts.geometry.attributes.position.count === f.size - 1)
      ? 'one dot per field vertex except the seed' : 'MISMATCH');
    var col = pts && pts.geometry.attributes.color;
    log('1.rgba', col ? col.itemSize + ' components  want 4 (per-vertex alpha)' : 'NO COLOUR');
    log('1.vertexColors', pts && pts.material.vertexColors ? 'on' : 'OFF');
    log('1.no.alphaTest', pts && !pts.material.alphaTest ? 'none, so the falloff is not clipped' : 'ALPHATEST WOULD CLIP IT');

    // The alphas must run the full range and be sorted by distance.
    var av = alphas(pts) || [];
    av.sort(function (a, b) { return a - b; });
    log('1.alpha.range', av.length ? av[0].toFixed(3) + ' .. ' + av[av.length - 1].toFixed(3) +
      '  want a spread, not one value' : 'NONE');
    log('1.graded', (av.length && av[av.length - 1] - av[0] > 0.2) ? 'a real gradient' : 'FLAT');

    // And each dot's alpha equals that vertex's weight exactly.
    var worst = 0;
    if (pts) {
      var p = pts.geometry.attributes.position, c2 = pts.geometry.attributes.color;
      for (var i = 0; i < p.count; i++) {
        var l = nearestLogical(grid, p.getX(i), p.getY(i), p.getZ(i));
        var w = f.get(l);
        if (w !== undefined) worst = Math.max(worst, Math.abs(w - c2.getW(i)));
      }
    }
    log('1.alpha.is.weight', worst < 1e-6 ? 'exactly' : 'OFF BY ' + worst.toFixed(5));

    /* ---- 2. Edges only in Edge mode ---- */
    log('2.lines.in.vertex', ud('softLines') ? 'DRAWN IN VERTEX MODE' : 'none, correct');
    k.setMode('edge');
    k.ensureHelpers(grid);
    // An edge whose ends straddle the centre.
    var e0 = -1, topo = grid.mesh.userData.topo;
    for (var j = 0; j < topo.edges.length; j++) {
      if (topo.edges[j][0] === centre || topo.edges[j][1] === centre) { e0 = j; break; }
    }
    A.selectedElements = new Set([e0]);
    k.refreshElementColors(grid);
    var ln = ud('softLines');
    log('2.lines', ln ? ln.geometry.attributes.instanceStart.count + ' segments' : 'NONE');
    log('2.vertexColors', ln && ln.material.vertexColors ? 'on (fat lines are RGB only - the fade is by colour)' : 'OFF');
    log('2.in.strokes', ln && k.gizmoStrokes.indexOf(ln) >= 0 ? 'registered for resize' : 'NOT REGISTERED');

    /* ---- 3. Faces only in Face mode, with alpha across each triangle ---- */
    log('3.faces.in.edge', ud('softFaces') ? 'DRAWN IN EDGE MODE' : 'none, correct');
    k.setMode('face');
    k.ensureHelpers(grid);
    A.selectedElements = new Set([0]);
    A.softRadius = 4;
    k.refreshElementColors(grid);
    var fc = ud('softFaces');
    log('3.faces', fc ? (fc.geometry.attributes.position.count / 3) + ' triangles' : 'NONE');
    log('3.rgba', fc ? fc.geometry.attributes.color.itemSize + ' components  want 4' : 'NONE');
    var fa = alphas(fc) || [];
    var lo = Math.min.apply(null, fa), hi = Math.max.apply(null, fa);
    log('3.alpha.range', fa.length ? lo.toFixed(3) + ' .. ' + hi.toFixed(3) : 'NONE');
    log('3.capped', hi <= 0.5 + 1e-6 ? 'never a coat of paint (<= 0.5)' : 'TOO OPAQUE at ' + hi);
    log('3.graded', (hi - lo) > 0.05 ? 'fades across the surface' : 'FLAT');

    /* ---- 4. The base dots went quiet ---- */
    var base = grid.mesh.userData.vertexPoints.geometry.attributes.color;
    var far = nearestLogical(grid, 3, 0, 0);
    var farCol = [base.getX(far), base.getY(far), base.getZ(far)];
    var unrelated = nearestLogical(grid, -4, 0, -4);
    var unCol = [base.getX(unrelated), base.getY(unrelated), base.getZ(unrelated)];
    log('4.base.quiet', (Math.abs(farCol[0] - unCol[0]) + Math.abs(farCol[1] - unCol[1]) + Math.abs(farCol[2] - unCol[2])) < 1e-6
      ? 'base dots no longer carry the falloff - the overlay owns it' : 'BASE DOTS STILL TINTED');

    /* ---- 5. Turning soft off takes all of it away ---- */
    k.setSoft(false);
    k.refreshElementColors(grid);
    log('5.cleared', (!ud('softPoints') && !ud('softLines') && !ud('softFaces')) ? 'all three gone' : 'SOMETHING LEFT BEHIND');
    log('5.strokes.clean', k.gizmoStrokes.filter(function (o) { return o === ln; }).length === 0
      ? 'the line left the stroke list too' : 'STILL IN THE STROKE LIST');

    /* ---- 6. And it comes back, without piling up ---- */
    k.setSoft(true);
    A.selectedElements = new Set([0]);
    var before = k.gizmoStrokes.length;
    for (var r = 0; r < 5; r++) { A.softRadius = 3 + r * 0.1; k.refreshElementColors(grid); }
    log('6.rebuilds', 'stroke list ' + before + ' -> ' + k.gizmoStrokes.length + '  want no growth');
    var kids = grid.mesh.children.filter(function (o) { return o === ud('softPoints') || o === ud('softLines') || o === ud('softFaces'); });
    log('6.no.duplicates', grid.mesh.children.filter(function (o) { return o.isPoints; }).length <= 3
      ? 'no stack of orphaned layers' : 'ORPHANS: ' + grid.mesh.children.length + ' children');

    /* ---- 7. Object mode draws none of it ---- */
    k.setMode('object');
    k.refreshElementColors(grid);
    log('7.object.mode', (!ud('softPoints') && !ud('softLines') && !ud('softFaces')) ? 'nothing drawn' : 'DRAWN IN OBJECT MODE');

    /* ---- 8. THE ONE THAT MATTERS: it follows the mesh through a drag ---- */
    k.setSoft(true);
    k.setMode('vertex');
    k.ensureHelpers(grid);
    centre = nearestLogical(grid, 0, 0, 0);
    A.selectedElements = new Set([centre]);
    k.refreshElementColors(grid);
    var p8 = ud('softPoints');
    log('8.built', p8 ? p8.geometry.attributes.position.count + ' dots' : 'NONE');
    var y0 = p8.geometry.attributes.position.getY(0);
    var meshY0 = (function () {
      var ids = grid.mesh.userData.softPointIds;
      return lp(grid, ids[0]).y;
    })();

    k.setTransformTool('move');
    A.transformMode = 'free';
    k.beginDirectDrag({ clientX: 400, clientY: 400, pointerId: 1, pointerType: 'touch' });
    k.applyDeltaToSelection(new T3.Matrix4().makeTranslation(0, 2, 0));
    var ids8 = grid.mesh.userData.softPointIds;
    var meshY1 = lp(grid, ids8[0]).y;
    var overlayY1 = ud('softPoints').geometry.attributes.position.getY(0);
    log('8.mesh.moved', (meshY1 - meshY0).toFixed(3) + '  (the vertex itself)');
    log('8.overlay.follows', Math.abs(overlayY1 - meshY1) < 1e-5
      ? 'the dot moved with it' : 'STALE: dot at ' + overlayY1.toFixed(3) + ', vertex at ' + meshY1.toFixed(3));
    log('8.same.count', ud('softPoints').geometry.attributes.position.count === p8.geometry.attributes.position.count
      ? 'not rebuilt, just moved' : 'REBUILT MID-DRAG');
    k.endDirectDrag();
    k.undo();
    grid = k.findObject(id);
    k.ensureHelpers(grid);
    A.selectedObjectIds = new Set([id]); A.activeObjectId = id;

    /* ---- 9. The face layer is actually visible ---- */
    k.setMode('face');
    A.selectedElements = new Set([0]);
    k.refreshElementColors(grid);
    var f9 = ud('softFaces');
    log('9.faces', f9 ? (f9.geometry.attributes.position.count / 3) + ' triangles' : 'NONE');
    log('9.depthTest', f9 && f9.material.depthTest === false
      ? 'off - coplanar with the surface, so a depth test would hide it' : 'ON, IT WILL Z-FIGHT');
    log('9.side', f9 && f9.material.side === T3.DoubleSide
      ? 'DoubleSide - a mirrored object has reversed winding' : 'NOT DOUBLESIDE');
    log('9.layers.agree', (function () {
      var a = ud('softPoints'), b = ud('softLines'), c = ud('softFaces');
      var vals = [a && a.material.depthTest, c && c.material.depthTest].filter(function (v) { return v !== null && v !== undefined; });
      return vals.every(function (v) { return v === false; }) ? 'all layers depth-test the same way' : 'LAYERS DISAGREE';
    })());
    log('9.renderOrder', [ud('softFaces'), ud('softLines'), ud('softPoints')]
      .map(function (o) { return o ? o.renderOrder : '-'; }).join('/') +
      '  want them between the base helpers (<=10) and the selection (11,12)');

    /* ---- 10. Extrude mode draws no falloff, because the drag applies none ---- */
    k.setMode('face');
    A.selectedElements = new Set([0]);
    k.extrudeSelection();
    var live = A.pendingOp && A.pendingOp.live;
    k.refreshElementColors(grid);
    log('10.extrude.live', live ? 'yes' : 'NO (probe could not open it)');
    log('10.no.overlay', (!ud('softPoints') && !ud('softFaces')) ? 'nothing drawn, correct' : 'DRAWN OVER A LIVE EXTRUDE');
    if (A.pendingOp) k.cancelPendingOp();

    /* ---- 11. The stroke list stops growing ---- */
    k.setMode('edge');
    k.ensureHelpers(grid);
    A.selectedElements = new Set([0]);
    k.refreshElementColors(grid);
    var n0 = k.gizmoStrokes.length;
    for (var q = 0; q < 30; q++) k.syncHelperGeometry(grid);   // what a drag does per frame
    log('11.selection.leak', k.gizmoStrokes.length === n0
      ? 'stroke list steady across 30 frames (' + n0 + ')'
      : 'GREW ' + n0 + ' -> ' + k.gizmoStrokes.length);

    log('final.winding', k.windingAudit().every(function (x) { return x.ok; }) ? 'all ok' : 'BROKEN');
    log('console.errors', errs.length ? errs.length + ': ' + errs.join(' | ').slice(0, 250) : 'none');
  }

  window.addEventListener('error', function (e) { errs.push('onerror: ' + (e.message || e) + ' @' + (e.lineno || '')); });
  function finish() {
    var pre = document.createElement('pre');
    pre.id = 'probeOut';
    pre.textContent = '<<<PROBE\n' + out.join('\n') + '\nPROBE>>>';
    document.body.appendChild(pre);
    document.title = 'PROBE-DONE';
  }
  function ready(t) {
    t = t || 0;
    if (window.__kubik && window.__kubik.App) {
      return setTimeout(function () {
        try { main(); } catch (e) { out.push('ERROR=' + (e && e.stack ? e.stack.split('\n').slice(0, 5).join(' / ') : e)); }
        finish();
      }, 700);
    }
    if (t > 250) { out.push('ERROR=no __kubik'); return finish(); }
    setTimeout(function () { ready(t + 1); }, 20);
  }
  setTimeout(function () { ready(); }, 300);
})();
