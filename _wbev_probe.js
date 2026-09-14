/* "After a bevel there are unstitched points" - measure it, do not reason
   about it.

   Two questions per case, and they are DIFFERENT questions:

     open   - outline edges used by exactly ONE face, counted through the
              app's own weld (edLogical). Non-zero on a closed solid means a
              real hole.
     twins  - pairs of DISTINCT logical vertices sitting within 1e-5 of each
              other. The app thinks they are two points; they are one place.
              This is what "unstitched" looks like from the outside: you drag
              one and half the surface stays behind.

   computeLogicalOf welds by GRID ROUNDING - Math.round(p * 1e4) - not by
   distance. Two points 1e-12 apart that straddle a cell boundary land in
   different cells and never weld, so twins can be arbitrarily close and
   still count as two. That is the mechanism under suspicion; the probe does
   not assume it, it reports the actual separations it finds.
*/
(function () {
  var out = [], errs = [], fails = 0;
  window.addEventListener('error', function (e) { errs.push(e.message); });
  function log(s) { out.push(s); }
  function verdict(ok, good, bad) { if (!ok) fails++; return ok ? '  ok  ' + good : '  FAIL ' + bad; }

  function main() {
    var k = window.__kubik, A = k.App;
    var V3 = k.THREE.Vector3;

    function clearScene() { A.objects.slice().forEach(function (o) { k.removeObjects([o]); }); }

    function makePrim(kind, params) {
      var ed = k.buildPrimitiveEditable(kind, params || {});
      var mats = k.makeMaterialSet(ed.groups.length, 0x9aa3ad, null);
      var o = k.createObjectFromEditable(kind, new V3(0, 0, 0), ed, mats, {});
      A.activeObjectId = o.id;
      A.selectedObjectIds = new Set([o.id]);
      k.ensureHelpers(o);
      return o;
    }

    // Survey through the app's own weld, exactly as the app sees the mesh.
    function survey(o) {
      var ed = k.toEditable(o.mesh);
      var L = k.edLogical(ed);
      var n = L.logicalGroups.length;

      var pos = [];
      for (var l = 0; l < n; l++) {
        var ai = L.logicalGroups[l][0];
        pos.push(new V3(ed.positions[ai * 3], ed.positions[ai * 3 + 1], ed.positions[ai * 3 + 2]));
      }

      var cnt = {};
      for (var gi = 0; gi < ed.groups.length; gi++) {
        var lp = k.getGroupBoundaryLoopAttr(ed, gi).map(function (a) { return L.logicalOf[a]; });
        for (var i = 0; i < lp.length; i++) {
          var a = lp[i], b = lp[(i + 1) % lp.length];
          if (a === b) continue;
          var key = a < b ? a + '_' + b : b + '_' + a;
          cnt[key] = (cnt[key] || 0) + 1;
        }
      }
      var open = 0;
      Object.keys(cnt).forEach(function (x) { if (cnt[x] !== 2) open++; });

      // Twins, bucketed so this stays cheap on a dense mesh.
      var CELL = 1e-3, buckets = {}, twins = 0, worst = 0, closest = Infinity;
      for (var l2 = 0; l2 < n; l2++) {
        var p = pos[l2];
        var bx = Math.floor(p.x / CELL), by = Math.floor(p.y / CELL), bz = Math.floor(p.z / CELL);
        for (var dx = -1; dx <= 1; dx++) for (var dy = -1; dy <= 1; dy++) for (var dz = -1; dz <= 1; dz++) {
          var kk = (bx + dx) + ',' + (by + dy) + ',' + (bz + dz);
          var list = buckets[kk];
          if (!list) continue;
          for (var j = 0; j < list.length; j++) {
            var d = p.distanceTo(pos[list[j]]);
            if (d < 1e-5) { twins++; worst = Math.max(worst, d); }
            else if (d < 1e-3) closest = Math.min(closest, d);
          }
        }
        var own = bx + ',' + by + ',' + bz;
        (buckets[own] = buckets[own] || []).push(l2);
      }

      /* A hole is not the only way a patch can be wrong. A face wound the
         other way round is invisible from outside (the app culls back faces)
         and closes the hole count just as well as a correct one - so every
         case asks the app's own audit too. `ok` ignores boundary edges, which
         a sheet legitimately has. */
      var w = k.auditWinding(o);

      return {
        verts: n, faces: ed.groups.length, open: open, twins: twins,
        worstTwin: worst, nearestNonTwin: closest === Infinity ? -1 : closest,
        conflict: w.conflictEdges, reversed: w.reversed, nonManifold: w.nonManifold,
        wok: w.ok
      };
    }

    // Every logical edge of the object, as index pairs into topo.edges.
    function allEdgeIds(o) {
      var e = o.mesh.userData.topo.edges, a = [];
      for (var i = 0; i < e.length; i++) a.push(i);
      return a;
    }

    function bevel(o, edgeIds, amount, segments, profile) {
      k.setMode('edge');
      A.selectedElements = new Set(edgeIds);
      k.bevelSelection();
      if (!A.pendingOp) return false;
      A.pendingOp.amount = amount;
      A.pendingOp.segments = segments;
      A.pendingOp.groupMode = profile;
      k.applyPendingOp();
      /* COMMIT IT, through the button a person presses. applyPendingOp
         changes the mesh but leaves the op OPEN, and the next beginPendingOp
         restores that op's snapshot first - so a probe that measures a
         second operation without confirming the first is measuring the first
         one being undone. Three sections of this probe read as app bugs for
         exactly that reason before the button went in. */
      var ok = document.getElementById('opOk');
      if (ok) ok.click();
      k.ensureHelpers(o);
      return true;
    }
    /* A BEVEL THAT DECLINES IS SILENT. bevelEdgesOp returns false when its
       inversion guard trips, and applyPendingOpInner ignores the return
       value - no toast, no refusal, the snapshot simply comes back. From
       outside, "it did nothing" and "there was nothing to do" look the same,
       so the probe has to say which. */
    function nochange(b, a) {
      return b.verts === a.verts && b.faces === a.faces
        ? '  NOTE: nothing changed - the bevel silently declined' : '';
    }

    function run(title, build, pick, amount, segments, profile) {
      clearScene();
      var o = build();
      var b = survey(o);
      var ids = pick(o);
      if (!ids.length) { log(title + '\n  FAIL no edges picked'); fails++; return; }
      if (!bevel(o, ids, amount, segments, profile)) {
        log(title + '\n  FAIL bevel refused to start'); fails++; return;
      }
      var a = survey(o);
      log(title +
        '\n  ' + ids.length + ' edges, amount ' + amount + ', ' + segments + ' seg, ' + profile +
        '\n  verts ' + b.verts + ' -> ' + a.verts + ', faces ' + b.faces + ' -> ' + a.faces +
        '\n  open edges ' + a.open + ', twins ' + a.twins +
        (a.twins ? ' (worst separation ' + a.worstTwin.toExponential(2) + ')' : '') +
        (a.nearestNonTwin >= 0 ? ', nearest other pair ' + a.nearestNonTwin.toExponential(2) : '') +
        '\n  winding: ' + a.conflict + ' conflicting edge(s), ' + a.reversed +
        ' face(s) the wrong way round, ' + a.nonManifold + ' non-manifold' +
        '\n' + verdict(a.open === 0 && a.twins === 0 && a.wok,
          'closed, stitched, and every face the same way round',
          (a.open ? a.open + ' OPEN EDGE(S) ' : '') +
          (a.twins ? a.twins + ' UNSTITCHED POINT(S) ' : '') +
          (a.wok ? '' : a.conflict + ' CONFLICTING EDGE(S), ' + a.reversed + ' FACE(S) FLIPPED')));
      return o;
    }

    var cube = function () { return makePrim('cube', {}); };

    /* An edge is "at the top" / "vertical" etc. by the positions of its two
       logical ends, read fresh - ids renumber on every rebuild. */
    function edgesWhere(o, test) {
      var e = o.mesh.userData.topo.edges, ids = [];
      for (var i = 0; i < e.length; i++) {
        var p = k.logicalPos(o, e[i][0]), q = k.logicalPos(o, e[i][1]);
        if (test(p, q)) ids.push(i);
      }
      return ids;
    }

    log('=== 1. the plain cases ===');
    run('1.1 cube, every edge, flat', cube, allEdgeIds, 0.06, 1, 'flat');
    run('1.2 cube, every edge, round 3 seg', cube, allEdgeIds, 0.06, 3, 'round');
    run('1.3 cube, one edge, flat', cube, function (o) {
      return [allEdgeIds(o)[0]];
    }, 0.06, 1, 'flat');

    log('');
    log('=== 2. three edges meeting at one corner - the corner patch ===');
    run('2.1 corner, flat', cube, function (o) {
      return edgesWhere(o, function (p, q) {
        var s = function (v) { return v.x > 0.24 && v.y > 0.24 && v.z > 0.24; };
        return s(p) || s(q);
      }).slice(0, 3);
    }, 0.06, 1, 'flat');
    run('2.2 corner, round 3 seg', cube, function (o) {
      return edgesWhere(o, function (p, q) {
        var s = function (v) { return v.x > 0.24 && v.y > 0.24 && v.z > 0.24; };
        return s(p) || s(q);
      }).slice(0, 3);
    }, 0.06, 3, 'round');

    log('');
    log('=== 3. coordinates that do not land on the weld grid ===');
    /* The default cube sits at +-0.5 and every offset is a round multiple of
       1e-4, so a grid weld cannot miss. A cube whose corners are irrational
       is the case the grid is supposed to handle and the one nobody tests. */
    var oddCube = function () {
      var o = makePrim('cube', {});
      var ed = k.toEditable(o.mesh);
      var s = Math.SQRT2 / 2.7183, r = 0.31415926;
      for (var i = 0; i < ed.positions.length; i += 3) {
        var x = ed.positions[i], y = ed.positions[i + 1], z = ed.positions[i + 2];
        // scale, then rotate about Y by an angle with no nice sine
        ed.positions[i] = (x * s) * Math.cos(r) - (z * s) * Math.sin(r);
        ed.positions[i + 1] = y * s * 1.37;
        ed.positions[i + 2] = (x * s) * Math.sin(r) + (z * s) * Math.cos(r);
      }
      k.rebuildFromEditable(o, ed);
      k.ensureHelpers(o);
      return o;
    };
    run('3.1 skewed+rotated cube, every edge, flat', oddCube, allEdgeIds, 0.037, 1, 'flat');
    run('3.2 skewed+rotated cube, every edge, round 2 seg', oddCube, allEdgeIds, 0.037, 2, 'round');
    run('3.3 skewed+rotated cube, one corner, flat', oddCube, function (o) {
      var best = -1, bs = -1e9, e = o.mesh.userData.topo.edges;
      for (var l = 0; l < o.mesh.userData.topo.logicalCount; l++) {
        var p = k.logicalPos(o, l), s2 = p.x + p.y + p.z;
        if (s2 > bs) { bs = s2; best = l; }
      }
      var ids = [];
      for (var i = 0; i < e.length; i++) if (e[i][0] === best || e[i][1] === best) ids.push(i);
      return ids;
    }, 0.037, 1, 'flat');

    log('');
    log('=== 4. a ring on a tube, where every corner has four faces ===');
    // h is the radial count - `radialSegments` is not a key primParams reads,
    // and passing it silently built a 3-sided prism instead of a tube.
    var tube = function () { return makePrim('cylinder', { h: 12 }); };
    run('4.1 tube, top ring, flat', tube, function (o) {
      var maxY = -1e9;
      for (var l = 0; l < o.mesh.userData.topo.logicalCount; l++) {
        maxY = Math.max(maxY, k.logicalPos(o, l).y);
      }
      return edgesWhere(o, function (p, q) {
        return Math.abs(p.y - maxY) < 1e-6 && Math.abs(q.y - maxY) < 1e-6;
      });
    }, 0.04, 1, 'flat');
    run('4.2 tube, top ring, round 3 seg', tube, function (o) {
      var maxY = -1e9;
      for (var l = 0; l < o.mesh.userData.topo.logicalCount; l++) {
        maxY = Math.max(maxY, k.logicalPos(o, l).y);
      }
      return edgesWhere(o, function (p, q) {
        return Math.abs(p.y - maxY) < 1e-6 && Math.abs(q.y - maxY) < 1e-6;
      });
    }, 0.04, 3, 'round');

    log('');
    log('=== 5. sweeping the amount - a twin may need one exact value ===');
    /* If the split is grid rounding, it appears at particular amounts and not
       at their neighbours. One case run at many amounts says which. */
    var worstRun = null, badAmounts = [];
    for (var t = 1; t <= 40; t++) {
      var amt = t * 0.005;
      clearScene();
      var oo = oddCube();
      var ids2 = allEdgeIds(oo);
      if (!bevel(oo, ids2, amt, 1, 'flat')) continue;
      var s3 = survey(oo);
      if (s3.open || s3.twins) {
        badAmounts.push(amt.toFixed(3) + '(open ' + s3.open + '/twins ' + s3.twins + ')');
        if (!worstRun || s3.twins > worstRun.twins) worstRun = s3;
      }
    }
    log('5.1 40 amounts on the skewed cube, flat, 1 seg' +
      '\n  bad amounts: ' + (badAmounts.length ? badAmounts.join(' ') : 'none') +
      '\n' + verdict(badAmounts.length === 0,
        'every amount came out closed and stitched',
        badAmounts.length + ' OF 40 AMOUNTS LEFT A HOLE OR A TWIN'));

    log('');
    log('=== 6. the cases real use actually reaches ===');

    /* 6.1 SYMMETRY. Bevel calls symExpand and the mirrored halves are held
       together by nothing but position welding - if an offset near the plane
       lands a hair off it, the model splits down the middle. This is the
       likeliest shape of "unstitched points" on a character. */
    (function () {
      clearScene();
      var o = cube();
      A.symmetry = true;
      A.symmetryAxes = ['x'];
      k.setMode('edge');
      // Edges that CROSS the plane x=0 - on a plain cube there are none, so
      // subdivide once first and take the four that straddle it.
      var ids = edgesWhere(o, function (p, q) { return p.x * q.x < -1e-9 || Math.abs(p.x) < 1e-9 || Math.abs(q.x) < 1e-9; });
      var b = survey(o);
      if (!ids.length) ids = allEdgeIds(o);
      bevel(o, ids, 0.06, 1, 'flat');
      var a = survey(o);
      A.symmetry = false;
      log('6.1 cube with X symmetry on, ' + ids.length + ' edges, flat' +
        '\n  verts ' + b.verts + ' -> ' + a.verts + ', faces ' + b.faces + ' -> ' + a.faces +
        '\n  open edges ' + a.open + ', twins ' + a.twins +
        (a.twins ? ' (worst separation ' + a.worstTwin.toExponential(2) + ')' : '') +
        '\n' + verdict(a.open === 0 && a.twins === 0,
          'symmetry did not split the mesh',
          (a.open ? a.open + ' OPEN EDGE(S) ' : '') + (a.twins ? a.twins + ' UNSTITCHED POINT(S)' : '')));
    })();

    /* 6.2 BEVEL A BEVEL. The second pass runs on geometry the first pass
       created, where corners already carry offset coordinates rather than
       the primitive's round ones. */
    (function () {
      clearScene();
      var o = cube();
      bevel(o, allEdgeIds(o), 0.06, 1, 'flat');
      var mid = survey(o);
      var ids = allEdgeIds(o);
      bevel(o, ids, 0.02, 1, 'flat');
      var a = survey(o);
      log('6.2 bevel, then bevel every edge of the result' +
        '\n  after first ' + mid.verts + ' verts / ' + mid.faces + ' faces, ' +
        ids.length + ' edges beveled again' +
        '\n  verts -> ' + a.verts + ', faces -> ' + a.faces +
        '\n  open edges ' + a.open + ', twins ' + a.twins +
        (a.twins ? ' (worst separation ' + a.worstTwin.toExponential(2) + ')' : '') +
        '\n' + verdict(a.open === 0 && a.twins === 0 && !nochange(mid, a),
          'a bevel of a bevel is still closed and stitched',
          (a.open ? a.open + ' OPEN EDGE(S) ' : '') + (a.twins ? a.twins + ' UNSTITCHED POINT(S) ' : '') +
          (nochange(mid, a) ? 'THE SECOND BEVEL SILENTLY DID NOTHING' : '')));
    })();

    /* 6.3 SUBDIVIDED CUBE - every corner has four faces and every face has
       four neighbours, which is the topology a bevel meets on a real model
       rather than on a six-face box. */
    (function () {
      clearScene();
      var o = cube();
      // Subdivide is an OBJECT-mode op and takes the object selection, not a
      // face selection - driving it from Face mode returns silently.
      k.setMode('object');
      A.selectedObjectIds = new Set([o.id]);
      A.activeObjectId = o.id;
      var pre = survey(o);
      k.subdivideSelection();
      var started = !!A.pendingOp;
      if (A.pendingOp) {
        A.pendingOp.segments = 2; A.pendingOp.groupMode = 'flat';
        k.applyPendingOp();
        var okBtn = document.getElementById('opOk');
        if (okBtn) okBtn.click();
      }
      k.ensureHelpers(o);
      var b = survey(o);
      log('  (setup) subdivide started=' + started + ', faces ' + pre.faces + ' -> ' + b.faces);
      var ids = edgesWhere(o, function (p, q) {
        // the edges on one face's boundary, an L-shaped run
        return Math.abs(p.z - 0.5) < 1e-6 && Math.abs(q.z - 0.5) < 1e-6;
      });
      if (!ids.length) ids = allEdgeIds(o).slice(0, 8);
      bevel(o, ids, 0.03, 2, 'round');
      var a = survey(o);
      log('6.3 subdivided cube, ' + ids.length + ' edges, round 2 seg' +
        '\n  verts ' + b.verts + ' -> ' + a.verts + ', faces ' + b.faces + ' -> ' + a.faces +
        '\n  open edges ' + a.open + ', twins ' + a.twins +
        (a.twins ? ' (worst separation ' + a.worstTwin.toExponential(2) + ')' : '') +
        '\n' + verdict(a.open === 0 && a.twins === 0,
          'closed and stitched on a dense corner',
          (a.open ? a.open + ' OPEN EDGE(S) ' : '') + (a.twins ? a.twins + ' UNSTITCHED POINT(S)' : '')));
    })();

    /* 6.4 AN OPEN MESH. A plane's rim edges have ONE face, so step 2 skips
       them outright (`fs.length !== 2`) while step 1 has already moved the
       corners. Whatever that leaves is what the user sees. Open edges are
       EXPECTED here - a plane has a rim - so only twins are the failure. */
    (function () {
      clearScene();
      var o = makePrim('plane', { h: 3, v: 3 });
      var b = survey(o);
      var ids = allEdgeIds(o);
      bevel(o, ids, 0.03, 1, 'flat');
      var a = survey(o);
      log('6.4 3x3 plane (open rim), every edge, flat' +
        '\n  verts ' + b.verts + ' -> ' + a.verts + ', faces ' + b.faces + ' -> ' + a.faces +
        '\n  open edges ' + b.open + ' -> ' + a.open + ' (a plane HAS a rim), twins ' + a.twins +
        (a.twins ? ' (worst separation ' + a.worstTwin.toExponential(2) + ')' : '') +
        '\n' + verdict(a.twins === 0,
          'no two logical vertices share a place',
          a.twins + ' UNSTITCHED POINT(S)'));
    })();

    /* 6.5 THE SPHERE POLE, where many faces meet at one vertex. */
    (function () {
      clearScene();
      var o = makePrim('sphere', { h: 12, v: 8 });
      var b = survey(o);
      var top = -1, ty = -1e9;
      for (var l = 0; l < o.mesh.userData.topo.logicalCount; l++) {
        var p = k.logicalPos(o, l);
        if (p.y > ty) { ty = p.y; top = l; }
      }
      var e = o.mesh.userData.topo.edges, ids = [];
      for (var i = 0; i < e.length; i++) if (e[i][0] === top || e[i][1] === top) ids.push(i);
      bevel(o, ids, 0.03, 1, 'flat');
      var a = survey(o);
      log('6.5 sphere, the ' + ids.length + ' edges meeting at the pole, flat' +
        '\n  verts ' + b.verts + ' -> ' + a.verts + ', faces ' + b.faces + ' -> ' + a.faces +
        '\n  open edges ' + b.open + ' -> ' + a.open + ', twins ' + a.twins +
        (a.twins ? ' (worst separation ' + a.worstTwin.toExponential(2) + ')' : '') +
        '\n' + verdict(a.open === b.open && a.twins === 0,
          'the pole beveled without opening anything new',
          (a.open ? a.open + ' OPEN EDGE(S) ' : '') + (a.twins ? a.twins + ' UNSTITCHED POINT(S)' : '')));
    })();

    /* 6.6 A PARTIAL RUN ON A TUBE - half the top ring, so the bevel starts
       and stops in the middle of a loop. Both ends are the case step 4 was
       written for. */
    (function () {
      clearScene();
      var o = tube();
      var maxY = -1e9;
      for (var l = 0; l < o.mesh.userData.topo.logicalCount; l++) {
        maxY = Math.max(maxY, k.logicalPos(o, l).y);
      }
      var ring = edgesWhere(o, function (p, q) {
        return Math.abs(p.y - maxY) < 1e-6 && Math.abs(q.y - maxY) < 1e-6;
      });
      var half = ring.slice(0, Math.max(1, Math.floor(ring.length / 2)));
      var b = survey(o);
      bevel(o, half, 0.05, 2, 'round');
      var a = survey(o);
      log('6.6 tube, ' + half.length + ' of ' + ring.length + ' top-ring edges, round 2 seg' +
        '\n  verts ' + b.verts + ' -> ' + a.verts + ', faces ' + b.faces + ' -> ' + a.faces +
        '\n  open edges ' + a.open + ', twins ' + a.twins +
        (a.twins ? ' (worst separation ' + a.worstTwin.toExponential(2) + ')' : '') +
        '\n' + verdict(a.open === 0 && a.twins === 0,
          'a run that stops mid-loop still closes',
          (a.open ? a.open + ' OPEN EDGE(S) ' : '') + (a.twins ? a.twins + ' UNSTITCHED POINT(S)' : '')));
    })();

    /* 6.7 VERTICAL EDGES OF A TUBE - a full loop the long way, meeting the
       caps at both ends. */
    (function () {
      clearScene();
      var o = tube();
      var ids = edgesWhere(o, function (p, q) { return Math.abs(p.y - q.y) > 1e-6; });
      var b = survey(o);
      bevel(o, ids, 0.03, 1, 'flat');
      var a = survey(o);
      log('6.7 tube, ' + ids.length + ' vertical edges, flat' +
        '\n  verts ' + b.verts + ' -> ' + a.verts + ', faces ' + b.faces + ' -> ' + a.faces +
        '\n  open edges ' + a.open + ', twins ' + a.twins +
        (a.twins ? ' (worst separation ' + a.worstTwin.toExponential(2) + ')' : '') +
        '\n' + verdict(a.open === 0 && a.twins === 0,
          'closed and stitched',
          (a.open ? a.open + ' OPEN EDGE(S) ' : '') + (a.twins ? a.twins + ' UNSTITCHED POINT(S)' : '')));
    })();

    /* 6.8 THE WHOLE TUBE, every edge at once - the heaviest thing the button
       can be asked to do on a simple model. */
    (function () {
      clearScene();
      var o = tube();
      var b = survey(o);
      bevel(o, allEdgeIds(o), 0.03, 2, 'round');
      var a = survey(o);
      log('6.8 tube, every edge, round 2 seg' +
        '\n  verts ' + b.verts + ' -> ' + a.verts + ', faces ' + b.faces + ' -> ' + a.faces +
        '\n  open edges ' + a.open + ', twins ' + a.twins +
        (a.twins ? ' (worst separation ' + a.worstTwin.toExponential(2) + ')' : '') +
        '\n' + verdict(a.open === 0 && a.twins === 0,
          'closed and stitched',
          (a.open ? a.open + ' OPEN EDGE(S) ' : '') + (a.twins ? a.twins + ' UNSTITCHED POINT(S)' : '')));
    })();

    /* 6.9 IS THE SECOND BEVEL EVER POSSIBLE? If 6.2 declines at every amount
       the guard is refusing the whole operation, not one value of it. */
    (function () {
      var worked = [], declined = [];
      [0.002, 0.005, 0.01, 0.015, 0.02, 0.03, 0.04].forEach(function (amt) {
        clearScene();
        var o = cube();
        bevel(o, allEdgeIds(o), 0.06, 1, 'flat');
        var mid = survey(o);
        bevel(o, allEdgeIds(o), amt, 1, 'flat');
        var a = survey(o);
        (mid.verts === a.verts && mid.faces === a.faces ? declined : worked).push(amt);
      });
      log('6.9 second bevel over seven amounts' +
        '\n  worked: ' + (worked.length ? worked.join(' ') : 'none') +
        '\n  declined silently: ' + (declined.length ? declined.join(' ') : 'none') +
        '\n' + verdict(declined.length === 0,
          'a beveled mesh can be beveled again at any amount',
          'THE SECOND BEVEL DECLINES AT ' + declined.length + ' OF 7 AMOUNTS, WITH NO MESSAGE'));
    })();

    log('');
    log('=== 7. how many faces may meet at the vertex before it tears ===');
    /* 6.5 opened 36 edges on a sphere pole. The pole is the highest-valence
       vertex in the app's own primitives, and a cube corner (valence 3)
       passed, so the question is where between the two it stops working -
       and whether it is valence at all. */
    (function () {
      var line = [];
      [4, 5, 6, 8, 10, 12, 16].forEach(function (h) {
        clearScene();
        var o = makePrim('sphere', { h: h, v: 8 });
        var b = survey(o);
        var top = -1, ty = -1e9;
        for (var l = 0; l < o.mesh.userData.topo.logicalCount; l++) {
          var p = k.logicalPos(o, l);
          if (p.y > ty) { ty = p.y; top = l; }
        }
        var e = o.mesh.userData.topo.edges, ids = [];
        for (var i = 0; i < e.length; i++) if (e[i][0] === top || e[i][1] === top) ids.push(i);
        bevel(o, ids, 0.03, 1, 'flat');
        var a = survey(o);
        line.push('valence ' + ids.length + ': open ' + b.open + ' -> ' + a.open +
          (b.verts === a.verts && b.faces === a.faces ? ' (declined)' : ''));
      });
      var bad = line.filter(function (s) { return s.indexOf('-> 0') < 0; });
      log('7.1 the pole of a sphere, radial count 4..16\n  ' + line.join('\n  ') +
        '\n' + verdict(bad.length === 0,
          'every valence beveled closed',
          bad.length + ' OF ' + line.length + ' VALENCES TORE THE MESH OPEN'));
    })();

    /* 7.2 Is it the valence, or is it that the pole's faces are TRIANGLES?
       A tube cap is one n-gon, so its rim vertices have three faces however
       many sides it has - the control for 7.1. */
    (function () {
      var line = [];
      [6, 12, 24].forEach(function (h) {
        clearScene();
        var o = makePrim('cylinder', { h: h });
        var b = survey(o);
        bevel(o, allEdgeIds(o), 0.02, 1, 'flat');
        var a = survey(o);
        line.push('tube h=' + h + ': open ' + b.open + ' -> ' + a.open +
          (b.verts === a.verts && b.faces === a.faces ? ' (declined)' : ''));
      });
      var bad = line.filter(function (s) { return s.indexOf('-> 0') < 0; });
      log('7.2 whole tube, 6 / 12 / 24 sides (rim vertices are valence 3)\n  ' + line.join('\n  ') +
        '\n' + verdict(bad.length === 0,
          'a tube of any resolution beveled closed',
          bad.length + ' OF ' + line.length + ' TORE OPEN'));
    })();

    /* 7.3 WHERE the tear is. The smallest failing case is a 4-sided pole with
       12 open edges; dump each one so the shape of the hole is a fact rather
       than a deduction. Distances are measured from the old pole and from the
       ring it sat on. */
    (function () {
      clearScene();
      var o = makePrim('sphere', { h: 4, v: 8 });
      var top = -1, ty = -1e9;
      for (var l = 0; l < o.mesh.userData.topo.logicalCount; l++) {
        var p = k.logicalPos(o, l);
        if (p.y > ty) { ty = p.y; top = l; }
      }
      var pole = k.logicalPos(o, top).clone();
      var e = o.mesh.userData.topo.edges, ids = [];
      for (var i = 0; i < e.length; i++) if (e[i][0] === top || e[i][1] === top) ids.push(i);
      bevel(o, ids, 0.03, 1, 'flat');

      var ed = k.toEditable(o.mesh);
      var L = k.edLogical(ed);
      var pos = [];
      for (var l2 = 0; l2 < L.logicalGroups.length; l2++) {
        var ai = L.logicalGroups[l2][0];
        pos.push(new V3(ed.positions[ai * 3], ed.positions[ai * 3 + 1], ed.positions[ai * 3 + 2]));
      }
      var cnt = {}, holder = {};
      for (var gi = 0; gi < ed.groups.length; gi++) {
        var lp = k.getGroupBoundaryLoopAttr(ed, gi).map(function (a) { return L.logicalOf[a]; });
        for (var q = 0; q < lp.length; q++) {
          var a1 = lp[q], b1 = lp[(q + 1) % lp.length];
          if (a1 === b1) continue;
          var key = a1 < b1 ? a1 + '_' + b1 : b1 + '_' + a1;
          cnt[key] = (cnt[key] || 0) + 1;
          (holder[key] = holder[key] || []).push(gi);
        }
      }
      var lines = [];
      Object.keys(cnt).forEach(function (key) {
        if (cnt[key] === 2) return;
        var ab = key.split('_').map(Number);
        var pa = pos[ab[0]], pb = pos[ab[1]];
        lines.push('used by ' + cnt[key] + ' face(s) [' + holder[key].join(',') + ']  ' +
          'dist from pole ' + pa.distanceTo(pole).toFixed(4) + ' / ' + pb.distanceTo(pole).toFixed(4) +
          ', length ' + pa.distanceTo(pb).toFixed(4));
      });
      log('7.3 the 4-sided pole, every open edge\n  ' + lines.join('\n  ') +
        '\n  faces now ' + ed.groups.length + ', bevel amount 0.03');

      /* Which faces actually touch the pole, and with which logical corners.
         If a strip and the triangle beside it name DIFFERENT ids for the same
         corner, the tear is a missing shared vertex; if they name the same
         ids, it is a missing FACE. */
      var near = [];
      for (var g2 = 0; g2 < ed.groups.length; g2++) {
        var lp2 = k.getGroupBoundaryLoopAttr(ed, g2).map(function (a) { return L.logicalOf[a]; });
        var closest = 1e9;
        lp2.forEach(function (l3) { closest = Math.min(closest, pos[l3].distanceTo(pole)); });
        if (closest > 0.2) continue;
        near.push('face ' + g2 + ': [' + lp2.join(' ') + ']  ' +
          lp2.map(function (l3) { return pos[l3].distanceTo(pole).toFixed(4); }).join(' '));
      }
      log('7.4 every face within 0.2 of the old pole, by logical corner id\n  ' + near.join('\n  '));
    })();

    log('');
    log('=== 8. a strip that STOPS at a vertex other faces also use ===');
    /* The tear lives at the END of a selection, not along it: a vertex where
       some faces moved and some did not. Section 7 found one arrangement of
       that (a whole edge star at a pole). These are the others, and each one
       reaches a different branch: one spoke (two untouched faces flanking the
       run, both keeping the corner), two opposite spokes (a single untouched
       face between two runs - it throws its corner away and lays a chord
       across nothing), three in a row, and a profile with points partway
       along it. Winding is asserted with the hole count, because a patch put
       in backwards closes the count and is invisible from outside. */
    function topLogical(o) {
      var top = -1, ty = -1e9;
      for (var l = 0; l < o.mesh.userData.topo.logicalCount; l++) {
        var p = k.logicalPos(o, l);
        if (p.y > ty) { ty = p.y; top = l; }
      }
      return top;
    }
    // Rotational order round the pole, so "opposite" and "in a row" mean what
    // they say - topo edge ids are in build order, not angle order.
    function spokesSorted(o) {
      var l0 = topLogical(o), e = o.mesh.userData.topo.edges, arr = [];
      for (var i = 0; i < e.length; i++) {
        if (e[i][0] !== l0 && e[i][1] !== l0) continue;
        var other = e[i][0] === l0 ? e[i][1] : e[i][0];
        var p = k.logicalPos(o, other);
        arr.push({ id: i, a: Math.atan2(p.z, p.x) });
      }
      arr.sort(function (x, y) { return x.a - y.a; });
      return arr.map(function (x) { return x.id; });
    }
    var sphere6 = function () { return makePrim('sphere', { h: 6, v: 6 }); };
    var sphere8 = function () { return makePrim('sphere', { h: 8, v: 6 }); };

    run('8.1 sphere pole, ONE spoke of six, flat', sphere6, function (o) {
      return [spokesSorted(o)[0]];
    }, 0.03, 1, 'flat');

    run('8.2 sphere pole, two OPPOSITE spokes of six, flat', sphere6, function (o) {
      var s = spokesSorted(o);
      return [s[0], s[3]];
    }, 0.03, 1, 'flat');

    run('8.3 sphere pole, three spokes in a row of eight, flat', sphere8, function (o) {
      var s = spokesSorted(o);
      return [s[0], s[1], s[2]];
    }, 0.03, 1, 'flat');

    run('8.4 sphere pole, two neighbouring spokes, round 3 seg', sphere6, function (o) {
      var s = spokesSorted(o);
      return [s[0], s[1]];
    }, 0.03, 3, 'round');

    run('8.4a sphere pole, ONE spoke, round 3 seg', sphere6, function (o) {
      return [spokesSorted(o)[0]];
    }, 0.03, 3, 'round');

    run('8.4b sphere pole, two neighbouring spokes, flat 1 seg', sphere6, function (o) {
      var s = spokesSorted(o);
      return [s[0], s[1]];
    }, 0.03, 1, 'flat');

    run('8.4c sphere pole, two neighbouring spokes, round 2 seg', sphere6, function (o) {
      var s = spokesSorted(o);
      return [s[0], s[1]];
    }, 0.03, 2, 'round');

    run('8.5 tube, one vertical edge (the cap meets the wall there)', tube, function (o) {
      var ids = edgesWhere(o, function (p, q) { return Math.abs(p.y - q.y) > 1e-6; });
      return ids.slice(0, 1);
    }, 0.04, 2, 'round');

    /* 8.6 THE FLAT CASE, which is NOT a hole. On a flat grid the corner sits
       exactly between the two points its faces move to, so the gap has no
       area - a T-junction, not a tear. The patch deliberately declines to put
       a zero-area face (with a cloned material of its own) there, so open
       edges are EXPECTED; what must hold is that nothing is left unstitched
       and nothing is wound backwards. */
    (function () {
      clearScene();
      var o = makePrim('plane', { h: 3, v: 3 });
      var b = survey(o);
      var ids = edgesWhere(o, function (p, q) {
        return Math.abs(p.x) < 1e-9 && Math.abs(q.x) < 1e-9 && Math.abs(p.z - q.z) > 1e-9;
      });
      if (!ids.length) ids = [allEdgeIds(o)[0]];
      bevel(o, ids, 0.03, 1, 'flat');
      var a = survey(o);
      log('8.6 flat grid, one interior edge (a T-junction, not a hole)' +
        '\n  ' + ids.length + ' edges, verts ' + b.verts + ' -> ' + a.verts +
        ', faces ' + b.faces + ' -> ' + a.faces +
        '\n  open edges ' + b.open + ' -> ' + a.open + ' (a sheet has a rim), twins ' + a.twins +
        '\n  winding: ' + a.conflict + ' conflicting, ' + a.reversed + ' flipped' +
        '\n' + verdict(a.twins === 0 && a.wok,
          'stitched, and no zero-area patch went in',
          (a.twins ? a.twins + ' UNSTITCHED POINT(S) ' : '') +
          (a.wok ? '' : a.conflict + ' CONFLICTING EDGE(S), ' + a.reversed + ' FLIPPED')));
    })();

    /* 8.7 WHERE the multi-segment tear is. 8.4a is the smallest failing case -
       ONE spoke, round 3 seg - and its flat twin passes, so the profile points
       are the whole difference. Dump the faces and the open edges instead of
       deducing them. Distances are given as (from the old pole / from the old
       far end), so a point on the profile is recognisable by both. */
    (function () {
      clearScene();
      var o = sphere6();
      var top = topLogical(o);
      var sp = spokesSorted(o), id = sp[0];
      var e0 = o.mesh.userData.topo.edges[id];
      var pole = k.logicalPos(o, top).clone();
      var far = k.logicalPos(o, e0[0] === top ? e0[1] : e0[0]).clone();
      bevel(o, [sp[0], sp[1]], 0.03, 2, 'round');

      var ed = k.toEditable(o.mesh), L = k.edLogical(ed), pos = [];
      for (var l = 0; l < L.logicalGroups.length; l++) {
        var ai = L.logicalGroups[l][0];
        pos.push(new V3(ed.positions[ai * 3], ed.positions[ai * 3 + 1], ed.positions[ai * 3 + 2]));
      }
      var cnt = {}, holder = {}, loops = [];
      for (var gi = 0; gi < ed.groups.length; gi++) {
        var lp = k.getGroupBoundaryLoopAttr(ed, gi).map(function (a) { return L.logicalOf[a]; });
        loops.push(lp);
        for (var q = 0; q < lp.length; q++) {
          var a1 = lp[q], b1 = lp[(q + 1) % lp.length];
          if (a1 === b1) continue;
          var key = a1 < b1 ? a1 + '_' + b1 : b1 + '_' + a1;
          cnt[key] = (cnt[key] || 0) + 1;
          (holder[key] = holder[key] || []).push(gi);
        }
      }
      var d = function (l) {
        return pos[l].distanceTo(pole).toFixed(4) + '/' + pos[l].distanceTo(far).toFixed(4);
      };
      var lines = [];
      Object.keys(cnt).forEach(function (key) {
        if (cnt[key] === 2) return;
        var ab = key.split('_').map(Number);
        lines.push('[' + ab[0] + '-' + ab[1] + '] used by ' + cnt[key] + ' face(s) [' +
          holder[key].join(',') + ']  ' + d(ab[0]) + ' , ' + d(ab[1]));
      });
      log('8.7 8.4a dumped - every edge NOT used by exactly two faces\n  ' +
        (lines.length ? lines.join('\n  ') : '(none)'));
      var near = [];
      loops.forEach(function (lp, g2) {
        var close = false;
        lp.forEach(function (l3) {
          if (pos[l3].distanceTo(pole) < 0.25 || pos[l3].distanceTo(far) < 0.25) close = true;
        });
        if (close) near.push('face ' + g2 + ': [' + lp.join(' ') + ']  ' + lp.map(d).join('  '));
      });
      log('  faces near either end of the beveled edge\n  ' + near.join('\n  '));
    })();

    log('');
    log('=== 9. two arrangements a reviewer named, and the probe had not ===');

    /* 9.1 AN OPEN MESH. Step 5 drops any chain that reaches either end of an
       open fan, on the grounds that the gap there is the rim of the sheet.
       That is only true when the face at that end MOVED. Cut one triangle out
       beside the pole and bevel each spoke in turn: for a spoke that does not
       touch the hole nothing about the rim changes, so the open count must
       come back exactly as it went in. */
    function openKeys(o) {
      var ed = k.toEditable(o.mesh), L = k.edLogical(ed), cnt = {}, set = {};
      for (var gi = 0; gi < ed.groups.length; gi++) {
        var lp = k.getGroupBoundaryLoopAttr(ed, gi).map(function (a) { return L.logicalOf[a]; });
        for (var i = 0; i < lp.length; i++) {
          var a = lp[i], b = lp[(i + 1) % lp.length];
          if (a === b) continue;
          var key = a < b ? a + '_' + b : b + '_' + a;
          cnt[key] = (cnt[key] || 0) + 1;
        }
      }
      Object.keys(cnt).forEach(function (x) { if (cnt[x] !== 2) set[x] = cnt[x]; });
      return set;
    }
    /* On a sheet the count of open edges is the wrong question - a bevel that
       reaches the rim legitimately makes the rim longer. The invariant is that
       the boundary stays ONE closed loop: a tear adds a second one. */
    function boundaryLoops(o) {
      var keys = Object.keys(openKeys(o)), adj = {}, n = 0;
      keys.forEach(function (key) {
        var ab = key.split('_');
        (adj[ab[0]] = adj[ab[0]] || []).push(ab[1]);
        (adj[ab[1]] = adj[ab[1]] || []).push(ab[0]);
      });
      var seen = {};
      Object.keys(adj).forEach(function (v) {
        if (seen[v]) return;
        n++;
        var stack = [v];
        while (stack.length) {
          var x = stack.pop();
          if (seen[x]) continue;
          seen[x] = 1;
          (adj[x] || []).forEach(function (y) { if (!seen[y]) stack.push(y); });
        }
      });
      return n;
    }
    function holedSphere() {
      var ed = k.buildPrimitiveEditable('sphere', { h: 6, v: 6 });
      var maxy = -1e9, n = ed.positions.length / 3;
      for (var i = 0; i < n; i++) maxy = Math.max(maxy, ed.positions[i * 3 + 1]);
      var drop = -1;
      for (var g = 0; g < ed.groups.length && drop < 0; g++) {
        var tri = ed.groups[g].triangles;
        for (var t = 0; t < tri.length && drop < 0; t++)
          for (var q = 0; q < 3; q++)
            if (ed.positions[tri[t][q] * 3 + 1] > maxy - 1e-6) drop = g;
      }
      ed.groups.splice(drop, 1);
      var mats = k.makeMaterialSet(ed.groups.length, 0x9aa3ad, null);
      var o = k.createObjectFromEditable('sphere', new V3(0, 0, 0), ed, mats, {});
      A.activeObjectId = o.id;
      A.selectedObjectIds = new Set([o.id]);
      k.ensureHelpers(o);
      return o;
    }
    (function () {
      var lines = [], bad = 0;
      for (var si = 0; si < 6; si++) {
        clearScene();
        var o = holedSphere();
        var sp = spokesSorted(o);
        if (si >= sp.length) break;
        var b = survey(o), bk = openKeys(o), bl = boundaryLoops(o);
        var e = o.mesh.userData.topo.edges[sp[si]];
        var key = e[0] < e[1] ? e[0] + '_' + e[1] : e[1] + '_' + e[0];
        var onRim = !!bk[key];
        bevel(o, [sp[si]], 0.03, 1, 'flat');
        var a = survey(o), al = boundaryLoops(o);
        var ok = al === bl && a.twins === 0 && a.wok;
        if (!ok) bad++;
        lines.push('spoke ' + si + (onRim ? ' (an edge of the hole)' : '') +
          ': rim loops ' + bl + ' -> ' + al + ', open ' + b.open + ' -> ' + a.open +
          ', faces ' + b.faces + ' -> ' + a.faces + (ok ? '' : '   <-- TORE'));
      }
      log('9.1 a sphere with one triangle cut out, each pole spoke in turn\n  ' +
        lines.join('\n  ') + '\n' + verdict(bad === 0,
          'the sheet still has exactly one boundary, wherever the bevel went',
          bad + ' SPOKE(S) OPENED A SECOND BOUNDARY'));
    })();

    /* 9.2 A VERTEX WITH NO UNTOUCHED NEIGHBOUR TO FAN FROM. Two edges meeting
       at a four-quad vertex: three faces move, the fourth has a moved face on
       both sides, so nothing round that vertex keeps its corner. There is then
       no surviving corner for the patch to fan from and it falls back to the
       projection, which is what tore in the first place. Curved and
       multi-segment on purpose - a flat one has no fold to mis-project. */
    (function () {
      clearScene();
      var o = makePrim('sphere', { h: 8, v: 6 });
      var topo = o.mesh.userData.topo, ys = [];
      for (var l = 0; l < topo.logicalCount; l++) ys.push(k.logicalPos(o, l).y);
      var uniq = ys.slice().sort(function (a, b) { return b - a; })
        .filter(function (v, i, arr) { return i === 0 || Math.abs(v - arr[i - 1]) > 1e-6; });
      var ty = uniq[2], v0 = -1;
      for (var l2 = 0; l2 < topo.logicalCount && v0 < 0; l2++) if (Math.abs(ys[l2] - ty) < 1e-6) v0 = l2;
      var ring = -1, up = -1;
      for (var i = 0; i < topo.edges.length; i++) {
        var e = topo.edges[i];
        if (e[0] !== v0 && e[1] !== v0) continue;
        var d = k.logicalPos(o, e[0] === v0 ? e[1] : e[0]).y - ty;
        if (Math.abs(d) < 1e-6) { if (ring < 0) ring = i; }
        else if (d > 0) { if (up < 0) up = i; }
      }
      var b = survey(o);
      var vpos = k.logicalPos(o, v0).clone();
      bevel(o, [ring, up], 0.03, 3, 'round');
      var a = survey(o);
      (function () {
        var ed = k.toEditable(o.mesh), L = k.edLogical(ed), pos = [], cnt = {}, hold = {};
        for (var l = 0; l < L.logicalGroups.length; l++) {
          var ai = L.logicalGroups[l][0];
          pos.push(new V3(ed.positions[ai * 3], ed.positions[ai * 3 + 1], ed.positions[ai * 3 + 2]));
        }
        var loops = [];
        for (var gi = 0; gi < ed.groups.length; gi++) {
          var lp = k.getGroupBoundaryLoopAttr(ed, gi).map(function (x) { return L.logicalOf[x]; });
          loops.push(lp);
          for (var q = 0; q < lp.length; q++) {
            var a1 = lp[q], b1 = lp[(q + 1) % lp.length];
            if (a1 === b1) continue;
            var key = a1 < b1 ? a1 + '_' + b1 : b1 + '_' + a1;
            cnt[key] = (cnt[key] || 0) + 1;
            (hold[key] = hold[key] || []).push(gi);
          }
        }
        var dd = function (l) { return pos[l].distanceTo(vpos).toFixed(4); };
        var bad = [];
        Object.keys(cnt).forEach(function (key) {
          if (cnt[key] === 2) return;
          var ab = key.split('_').map(Number);
          bad.push('[' + ab[0] + '-' + ab[1] + '] used by ' + cnt[key] + ' [' + hold[key].join(',') +
            ']  d ' + dd(ab[0]) + ' , ' + dd(ab[1]));
        });
        var near = [];
        loops.forEach(function (lp, g2) {
          if (!lp.some(function (l3) { return pos[l3].distanceTo(vpos) < 0.2; })) return;
          near.push('face ' + g2 + ': [' + lp.join(' ') + ']  ' + lp.map(dd).join(' '));
        });
        log('  dump: edges not used by exactly two faces\n    ' +
          (bad.length ? bad.join('\n    ') : '(none)') +
          '\n  faces within 0.2 of the vertex\n    ' + near.join('\n    '));
      })();
      log('9.2 an L of two edges at a four-quad vertex, round 3 seg' +
        '\n  verts ' + b.verts + ' -> ' + a.verts + ', faces ' + b.faces + ' -> ' + a.faces +
        '\n  open edges ' + a.open + ', twins ' + a.twins +
        '\n  winding: ' + a.conflict + ' conflicting, ' + a.reversed + ' flipped, ' +
        a.nonManifold + ' non-manifold' +
        '\n' + verdict(a.open === 0 && a.twins === 0 && a.wok,
          'closed, stitched, and every face the same way round',
          (a.open ? a.open + ' OPEN EDGE(S) ' : '') +
          (a.wok ? '' : a.conflict + ' CONFLICTING, ' + a.reversed + ' FLIPPED')));
    })();

    out.push('');
    out.push('VERDICT=' + (fails ? 'FAIL (' + fails + ')' : 'PASS'));
    out.push('page.errors=' + (errs.length ? errs.join(' | ').slice(0, 400) : 'none'));
  }

  function finish() {
    var pre = document.createElement('pre');
    pre.id = 'probeOut';
    pre.textContent = '<<<PROBE\n' + out.join('\n') + '\nPROBE>>>';
    document.body.appendChild(pre);
    document.title = 'PROBE-DONE';
  }
  function ready(cb, t) {
    t = t || 0;
    if (window.__kubik && window.__kubik.App && window.__kubik.App.objects) return cb();
    if (t > 300) { out.push('ERROR=no __kubik'); return finish(); }
    setTimeout(function () { ready(cb, t + 1); }, 20);
  }
  setTimeout(function () {
    ready(function () {
      setTimeout(function () {
        try { main(); } catch (e) {
          out.push('ERROR=' + (e && e.stack ? e.stack.split('\n').slice(0, 10).join(' / ') : e));
        }
        finish();
      }, 600);
    });
  }, 300);
})();
