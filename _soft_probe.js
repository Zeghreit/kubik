/* Soft selection, measured rather than eyeballed.

   The shapes are built with the app's own primitives so the topology is real:
   a subdivided plane for the falloff numbers, and a deliberately THIN box for
   the question that decides whether the tool is trustworthy - does the far
   wall come with you. */
(function () {
  var out = [], errs = [];
  var _ce = console.error;
  console.error = function () { errs.push(Array.prototype.join.call(arguments, ' ')); _ce.apply(console, arguments); };
  function log(k, v) { out.push(k + '=' + v); }
  var k, A, T3;

  function lp(obj, l) { return k.logicalPos(obj, l).clone(); }
  function nearestLogical(obj, x, y, z) {
    var t = obj.mesh.userData.topo, best = -1, bd = 1e9;
    var want = new T3.Vector3(x, y, z);
    for (var l = 0; l < t.logicalCount; l++) {
      var d = lp(obj, l).distanceTo(want);
      if (d < bd) { bd = d; best = l; }
    }
    return best;
  }

  function main() {
    k = window.__kubik; A = k.App;
    // No `var` - that would shadow the outer T3 and leave every helper
    // outside main() reading undefined. three.js is a module here, so there
    // is no global THREE to reach for; the app hands its own out.
    T3 = k.THREE;

    /* ---- 1. The curve itself ---- */
    log('1.falloff', [0, 0.25, 0.5, 0.75, 1].map(function (t) {
      return t + ':' + k.softFalloff(t).toFixed(3);
    }).join(' ') + '   want 0:1.000 0.25:0.854 0.5:0.500 0.75:0.146 1:0.000');

    /* ---- 2. A flat grid: weights by ring ---- */
    // 8x8 quads across 8 units, so an edge is exactly 1 unit long.
    k.startGeoSetup('plane');
    k.applyGeoParams({ h: 8, v: 8, x: 8, y: 1, z: 8 });
    k.finishGeoSetup(true);
    var grid = k.findObject(A.geoSetup ? A.geoSetup.objId : A.activeObjectId);
    k.ensureHelpers(grid);
    log('2.grid', grid.mesh.userData.topo.logicalCount + ' verts, ' +
      grid.mesh.userData.topo.faceGroups.length + ' faces  want 81/64');

    var centre = nearestLogical(grid, 0, 0, 0);
    var seeds = new Set([centre]);
    // Radius 3 with 1-unit edges: rings at 1, 2 in; ring at 3 exactly on the
    // boundary and excluded, which is what "0 at the edge" has to mean.
    var w = k.softWeights(grid, seeds, 3);
    log('2.centre.weight', w.get(centre).toFixed(3) + '  want 1.000');
    var ring1 = nearestLogical(grid, 1, 0, 0), ring2 = nearestLogical(grid, 2, 0, 0);
    var ring3 = nearestLogical(grid, 3, 0, 0), diag = nearestLogical(grid, 1, 0, 1);
    log('2.ring1', w.get(ring1).toFixed(3) + '  want ' + k.softFalloff(1 / 3).toFixed(3));
    log('2.ring2', w.get(ring2).toFixed(3) + '  want ' + k.softFalloff(2 / 3).toFixed(3));
    log('2.ring3', (w.has(ring3) ? 'INCLUDED ' + w.get(ring3) : 'excluded') + '  want excluded (d = r)');
    // The diagonal neighbour is 2 units by the EDGES even though it is 1.41
    // through the air - which is the whole point of walking the surface.
    log('2.diagonal', w.get(diag).toFixed(3) + '  want ' + k.softFalloff(2 / 3).toFixed(3) +
      ' (2 hops, not 1.414 through the air)');
    log('2.monotonic', (w.get(centre) > w.get(ring1) && w.get(ring1) > w.get(ring2)) ? 'yes' : 'NO');
    log('2.count', w.size + ' verts in the field of 81');

    /* ---- 3. THE QUESTION: a thin box, does the far wall follow ---- */
    k.startGeoSetup('cube');
    k.applyGeoParams({ h: 6, v: 6, x: 4, y: 0.2, z: 4 });
    k.finishGeoSetup(true);
    var slab = k.findObject(A.activeObjectId);
    k.ensureHelpers(slab);
    var top = nearestLogical(slab, 0, 0.1, 0);
    var bot = nearestLogical(slab, 0, -0.1, 0);
    var straight = lp(slab, top).distanceTo(lp(slab, bot));
    var w2 = k.softWeights(slab, new Set([top]), 1.0);
    log('3.slab.thickness', straight.toFixed(3) + ' apart through the air');
    log('3.far.wall', (w2.has(bot) ? 'FOLLOWS at ' + w2.get(bot).toFixed(3) : 'untouched') +
      '  want untouched (radius 1.0 >> ' + straight.toFixed(2) + ')');
    log('3.top.face.moves', w2.size + ' verts in the field (the near side only)');

    /* ---- 4. A separate object is never reached ---- */
    var before = w2.size;
    var w3 = k.softWeights(slab, new Set([top]), 1000);
    log('4.huge.radius', w3.size + ' of ' + slab.mesh.userData.topo.logicalCount +
      ' verts, and 0 from any other object (no path)');

    /* ---- 5. The drag actually falls off ---- */
    A.selectedObjectIds = new Set([grid.id]);
    A.activeObjectId = grid.id;
    k.setMode('vertex');
    A.selectedElements = new Set([centre]);
    A.soft = true; A.softRadius = 3;
    k.setTransformTool('move');
    A.transformMode = 'free';

    var y0c = lp(grid, centre).y, y0r1 = lp(grid, ring1).y, y0r3 = lp(grid, ring3).y;
    var vr = document.getElementById('viewport').getBoundingClientRect();
    var sp = k.worldToScreenPx(lp(grid, centre));
    var p0 = { clientX: sp.x + vr.left, clientY: sp.y + vr.top, pointerId: 1, pointerType: 'touch' };
    var began = k.beginDirectDrag(p0);
    log('5.drag.began', began ? 'yes' : 'NO');
    log('5.ctx.soft', k.dragCtx && k.dragCtx.soft ? 'field captured' : 'NO FIELD');
    log('5.ctx.entries', k.dragCtx ? k.dragCtx.entries.length + ' entries (1 selected + neighbourhood)' : 'none');
    // Drive the delta directly - a synthetic pointermove has no live tracking.
    k.applyDeltaToSelection(new T3.Matrix4().makeTranslation(0, 1, 0));
    var dC = lp(grid, centre).y - y0c, d1 = lp(grid, ring1).y - y0r1, d3 = lp(grid, ring3).y - y0r3;
    log('5.centre.moved', dC.toFixed(3) + '  want 1.000');
    log('5.ring1.moved', d1.toFixed(3) + '  want ' + k.softFalloff(1 / 3).toFixed(3));
    log('5.ring3.moved', d3.toFixed(3) + '  want 0.000 (outside the radius)');
    k.endDirectDrag();
    log('5.selection.intact', A.selectedElements.size + ' selected, still just the one  want 1');
    log('5.winding', k.auditWinding(grid).ok ? 'ok' : 'BROKEN');

    /* ---- 6. Soft off is the old behaviour, exactly ----

       Undo DISPOSES every object and rebuilds it from the document, so every
       reference taken before it is stale - reading one throws on a null topo,
       which looks exactly like the app losing its mesh and is purely the
       harness holding a dead pointer. Re-fetch after every undo, and re-find
       the vertices by POSITION rather than trusting the ids to survive. */
    var gridId = grid.id;
    function afterUndo() {
      k.undo();
      grid = k.findObject(gridId);
      k.ensureHelpers(grid);
      centre = nearestLogical(grid, 0, 0, 0);
      ring1 = nearestLogical(grid, 1, 0, 0);
      ring3 = nearestLogical(grid, 3, 0, 0);
      A.selectedObjectIds = new Set([grid.id]);
      A.activeObjectId = grid.id;
      A.selectedElements = new Set([centre]);
    }

    afterUndo();
    log('6.reacquired', grid ? 'grid back, centre at ' + lp(grid, centre).toArray().join(',') : 'GRID GONE');
    A.soft = false;
    var y1 = lp(grid, ring1).y;
    k.beginDirectDrag(p0);
    log('6.ctx.soft', k.dragCtx && k.dragCtx.soft ? 'FIELD CAPTURED' : 'none, correct');
    log('6.ctx.entries', k.dragCtx.entries.length + ' entries  want 1');
    k.applyDeltaToSelection(new T3.Matrix4().makeTranslation(0, 1, 0));
    log('6.ring1.still', (lp(grid, ring1).y - y1).toFixed(3) + '  want 0.000');
    k.endDirectDrag();
    afterUndo();

    /* ---- 7. Rotate and scale fall off too ---- */
    A.soft = true;
    k.setTransformTool('scale');
    /* A real scale and a real rotation, not a translation with the scale tool
       selected - applyDeltaToSelection is tool-agnostic, so only a matrix that
       is actually a scale or a rotation tests that the weight composes with
       one. Expected position computed independently: lerp from where the
       vertex was to where the FULL transform would have put it. */
    var wExp = k.softFalloff(1 / 3);
    [['scale', new T3.Matrix4().makeScale(2, 2, 2)],
     ['rotate', new T3.Matrix4().makeRotationY(Math.PI / 3)]].forEach(function (pair) {
      var before = lp(grid, ring1).clone();
      var expect = before.clone().lerp(before.clone().applyMatrix4(pair[1]), wExp);
      k.beginDirectDrag(p0);
      k.applyDeltaToSelection(pair[1]);
      log('7.' + pair[0] + '.falloff',
        lp(grid, ring1).distanceTo(expect).toFixed(4) + ' from the expected lerp  want 0.0000');
      k.endDirectDrag();
      afterUndo();
    });
    k.setTransformTool('move');

    /* ---- 8. Extrude mode is left alone ---- */
    k.setMode('face');
    A.selectedElements = new Set([0]);
    k.extrudeSelection();
    var live = A.pendingOp && A.pendingOp.live;
    k.beginDirectDrag(p0);
    log('8.extrude.live', live ? 'yes' : 'NO (probe could not open it)');
    log('8.extrude.soft', k.dragCtx && k.dragCtx.soft ? 'FIELD CAPTURED - wrong' : 'no field, correct');
    k.endDirectDrag();
    if (A.pendingOp) k.cancelPendingOp();

    /* ---- 9. Nothing to do cases ---- */
    log('9.no.seeds', k.softWeights(grid, new Set(), 3) === null ? 'null' : 'NOT NULL');
    log('9.zero.radius', k.softWeights(grid, new Set([centre]), 0) === null ? 'null' : 'NOT NULL');
    log('9.seed.only', (function () {
      var m = k.softWeights(grid, new Set([centre]), 0.5);
      return m && m.size === 1 ? 'just the seed' : (m ? m.size + ' verts' : 'null');
    })() + '  want just the seed (radius under one edge)');

    /* ---- 10. Cost, on something big ---- */
    k.startGeoSetup('sphere');
    k.applyGeoParams({ h: 48, v: 32, x: 2, y: 2, z: 2 });
    k.finishGeoSetup(true);
    var ball = k.findObject(A.activeObjectId);
    k.ensureHelpers(ball);
    var n = ball.mesh.userData.topo.logicalCount;
    var t0 = performance.now();
    var big = k.softWeights(ball, new Set([0]), 1.2);
    var t1 = performance.now();
    log('10.sphere', n + ' verts, field of ' + (big ? big.size : 0) + ' in ' + (t1 - t0).toFixed(1) + 'ms');

    log('final.winding', k.windingAudit().every(function (x) { return x.ok; }) ? 'all ok' : 'BROKEN');
    log('console.errors', errs.length ? errs.join(' | ').slice(0, 400) : 'none');
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
