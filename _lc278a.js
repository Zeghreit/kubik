/* v2.78a - loop cut ENDS. Where a ring stops at a triangle, its cut point must
   become a corner of that triangle (a quad now), not a T-junction on its edge.
   Run on the PC:  py _clean_probe.py _lc278a.js _lc278a_out.txt
   In the cloud:   python3 _cloudprobe.py _lc278a.js */
(function () {
  var out = [], errs = [], posted = false;
  var _ce = console.error;
  console.error = function () { errs.push(Array.prototype.join.call(arguments, ' ')); _ce.apply(console, arguments); };
  function log(k, v) { out.push(k + '=' + v); }
  var k, A, THREE;

  // Every face's outline as position keys, straight off the editable.
  function outlines(o) {
    var ed = k.toEditable(o.mesh), res = [];
    var key = function (ai) {
      return [0, 1, 2].map(function (c) { return Math.round(ed.positions[ai * 3 + c] * 1e4); }).join('_');
    };
    ed.groups.forEach(function (g, gi) { res.push(k.getGroupBoundaryLoopAttr(ed, gi).map(key)); });
    return res;
  }
  // T = a vertex lying inside an edge used by only one face outline.
  function audit(o) {
    var L = outlines(o), use = {}, pts = {};
    L.forEach(function (lp) {
      lp.forEach(function (a, i) {
        var b = lp[(i + 1) % lp.length];
        var e = a < b ? a + '|' + b : b + '|' + a;
        use[e] = (use[e] || 0) + 1;
        pts[a] = 1;
      });
    });
    var P = function (s) { return s.split('_').map(Number); };
    var tj = 0, once = 0;
    Object.keys(use).forEach(function (e) {
      if (use[e] !== 1) return;
      once++;
      var ab = e.split('|'), a = P(ab[0]), b = P(ab[1]);
      Object.keys(pts).forEach(function (s) {
        if (s === ab[0] || s === ab[1]) return;
        var p = P(s), u = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], w = [p[0] - a[0], p[1] - a[1], p[2] - a[2]];
        var L2 = u[0] * u[0] + u[1] * u[1] + u[2] * u[2];
        var t = (w[0] * u[0] + w[1] * u[1] + w[2] * u[2]) / L2;
        if (t <= 0.001 || t >= 0.999) return;
        if (Math.hypot(w[0] - t * u[0], w[1] - t * u[1], w[2] - t * u[2]) < 2) tj++;   // 2e-4
      });
    });
    return { faces: L.length, sizes: L.map(function (l) { return l.length; }).sort().join(','), tj: tj, open: once };
  }
  function edgeAt(o, p, q) {
    k.ensureHelpers(o);
    var best = null;
    o.mesh.userData.topo.edges.forEach(function (e) {
      var a = k.logicalPos(o, e[0]), b = k.logicalPos(o, e[1]);
      if ((a.distanceTo(p) < 1e-6 && b.distanceTo(q) < 1e-6) || (a.distanceTo(q) < 1e-6 && b.distanceTo(p) < 1e-6)) best = e;
    });
    return best;
  }
  function make(name, positions, groups) {
    var ms = groups.map(function () { return new THREE.MeshStandardMaterial({ color: 0x888888 }); });
    var o = k.createObjectFromEditable(name, new THREE.Vector3(0, 0, 0),
      { positions: positions.slice(), groups: JSON.parse(JSON.stringify(groups)) }, ms, {});
    A.selectedObjectIds = new Set([o.id]); A.activeObjectId = o.id;
    return o;
  }

  function main() {
    k = window.__kubik; A = k.App; THREE = k.THREE;
    var V = THREE.Vector3;

    // A flat strip: quad, quad, then a triangle. A ring started on x=1 runs
    // out through x=2 into the triangle. Each face owns its vertices, as here.
    var P = [0,0,0, 1,0,0, 2,0,0, 0,0,1, 1,0,1, 2,0,1, 3,0,0.5];
    var pos = [], groups = [];
    function face(ids) {
      var base = pos.length / 3;
      ids.forEach(function (i) { pos.push(P[i * 3], P[i * 3 + 1], P[i * 3 + 2]); });
      var tri = [];
      for (var i = 1; i + 1 < ids.length; i++) tri.push([base, base + i + 1, base + i]);
      groups.push({ triangles: tri });
    }
    face([0, 1, 4, 3]); face([1, 2, 5, 4]); face([2, 6, 5]);

    // 1. One cut: the triangle becomes a quad.
    var o = make('LC1', pos, groups);
    var b0 = audit(o);
    log('1.before', b0.faces + ' faces [' + b0.sizes + '] T=' + b0.tj + ' open=' + b0.open);
    var e = edgeAt(o, new V(1, 0, 0), new V(1, 0, 1));
    log('1.edge', e ? 'found' : 'MISSING');
    var r = k.edgeLoopOp(o, e, [0.5]);
    var a1 = audit(o);
    log('1.after', 'cut ' + r + ', ' + a1.faces + ' faces [' + a1.sizes + '] T=' + a1.tj + ' open=' + a1.open);
    log('1.CHECK', a1.tj === 0 && a1.sizes === '4,4,4,4,4' && a1.open === b0.open + 1
      ? 'PASS the triangle became a quad, no T-junction'
      : 'FAIL expected 5 quads, T=0, open ' + (b0.open + 1));

    // 2. Two cuts: the triangle gains two points - a pentagon.
    var o2 = make('LC2', pos, groups);
    var r2 = k.edgeLoopOp(o2, edgeAt(o2, new V(1, 0, 0), new V(1, 0, 1)), [0.33, 0.66]);
    var a2 = audit(o2);
    log('2.after', 'cut ' + r2 + ', ' + a2.faces + ' faces [' + a2.sizes + '] T=' + a2.tj);
    log('2.CHECK', a2.tj === 0 && a2.sizes.split(',').filter(function (s) { return s === '5'; }).length === 1
      ? 'PASS two points, one pentagon, no T-junction' : 'FAIL');

    // 3. A closed ring touches nothing else: a cube, 6 -> 10 faces.
    var o3 = A.objects.filter(function (x) { return x.mesh && x !== o && x !== o2 && k.faceCount(x.mesh.geometry) === 6; })[0];
    if (o3) {
      k.ensureHelpers(o3);
      var c0 = audit(o3);
      var r3 = k.edgeLoopOp(o3, o3.mesh.userData.topo.edges[0], [0.5]);
      var c1 = audit(o3);
      log('3.cube', 'cut ' + r3 + ', ' + c0.faces + ' -> ' + c1.faces + ' faces, T=' + c1.tj + ', open=' + c1.open);
      log('3.CHECK', c1.faces === c0.faces + 4 && c1.tj === 0 && c1.open === 0 ? 'PASS' : 'FAIL');
    } else log('3.cube', 'no cube in the scene - skipped');

    // 4. Slide (one cut off-centre). Both halves of the ring start on the same
    //    edge from opposite windings; they must still meet in one point.
    var o4 = make('LC4', pos, groups);
    var r4 = k.edgeLoopOp(o4, edgeAt(o4, new V(1, 0, 0), new V(1, 0, 1)), [0.3]);
    var a4 = audit(o4);
    log('4.slide', 'cut ' + r4 + ', ' + a4.faces + ' faces [' + a4.sizes + '] T=' + a4.tj);
    log('4.CHECK', a4.tj === 0 && a4.sizes === '4,4,4,4,4' ? 'PASS' : 'FAIL');
    // 5. SYMMETRY + SLIDE through the real op path. A 4x2 grid, x in [-2,2];
    //    the ring starts on a column at x in [-2,-1] and its mirror is the
    //    column [1,2]. Both rings have faces on both sides of the start edge,
    //    which is exactly where the Slide fix changes t.
    var gp = [], gg = [];
    for (var i = 0; i < 4; i++) for (var j = 0; j < 2; j++) {
      var x0 = -2 + i, z0 = j, b5 = gp.length / 3;
      gp.push(x0, 0, z0, x0 + 1, 0, z0, x0 + 1, 0, z0 + 1, x0, 0, z0 + 1);
      gg.push({ triangles: [[b5, b5 + 2, b5 + 1], [b5, b5 + 3, b5 + 2]] });
    }
    var o5 = make('LC5', gp, gg);
    k.ensureHelpers(o5);
    var before5 = {};
    for (var l = 0; l < o5.mesh.userData.topo.logicalCount; l++) {
      var q = k.logicalPos(o5, l); before5[q.x.toFixed(4) + ',' + q.z.toFixed(4)] = 1;
    }
    A.symmetry = true; if ('symmetryAxis' in A) A.symmetryAxis = 'x';
    k.setMode('edge');
    var e5 = edgeAt(o5, new V(-2, 0, 1), new V(-1, 0, 1));
    var idx5 = o5.mesh.userData.topo.edges.indexOf(e5);
    A.selectedElements = new Set([idx5]);
    k.edgeLoopSelection();
    var op5 = A.pendingOp;
    if (!op5) { log('5.sym', 'no pending op'); }
    else {
      op5.groupMode = 'slide';
      k.setPendingAmount(0.25);
      k.applyPendingOp();
      k.confirmPendingOp();
      k.ensureHelpers(o5);
      var xs = {};
      for (var l2 = 0; l2 < o5.mesh.userData.topo.logicalCount; l2++) {
        var q2 = k.logicalPos(o5, l2), key5 = q2.x.toFixed(4) + ',' + q2.z.toFixed(4);
        if (!before5[key5]) xs[q2.x.toFixed(4)] = (xs[q2.x.toFixed(4)] || 0) + 1;
      }
      var xk = Object.keys(xs).map(Number).sort(function (p, q) { return p - q; });
      var a5 = audit(o5);
      log('5.sym', 'mflip=' + op5.payload.mflip + ', new vertex x: ' + JSON.stringify(xs) + ', faces ' + a5.faces + ', T=' + a5.tj);
      log('5.CHECK', xk.length === 2 && Math.abs(xk[0] + xk[1]) < 1e-4 && xs[xk[0].toFixed(4)] === 3 &&
        xs[xk[1].toFixed(4)] === 3 && a5.tj === 0 && Math.abs(xk[0] + 2) > 0.05 && Math.abs(xk[0] + 1.5) > 0.05
        ? 'PASS both rings straight, mirrored, off-centre' : 'FAIL');
    }
    A.symmetry = false;
    log('errors', errs.length ? errs.slice(0, 3).join(' | ') : 'none');
  }

  function post() {
    if (posted) return;
    posted = true;
    try { fetch('/result', { method: 'POST', body: out.join('\n') }); } catch (e) {}
  }
  setTimeout(function () { if (!posted) { out.push('WATCHDOG=main did not finish'); post(); } }, 30000);
  function ready(cb, t) {
    t = t || 0;
    if (window.__kubik && window.__kubik.App) return cb();
    if (t > 400) { out.push('ERROR=no __kubik'); return post(); }
    setTimeout(function () { ready(cb, t + 1); }, 20);
  }
  window.addEventListener('error', function (e) { errs.push('onerror: ' + (e.message || e)); });
  setTimeout(function () {
    ready(function () {
      setTimeout(function () {
        try { main(); } catch (e) { out.push('ERROR=' + (e && e.stack ? e.stack.split('\n').slice(0, 8).join(' / ') : e)); }
        post();
      }, 1500);
    });
  }, 400);
})();
