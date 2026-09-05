/* Circularize (a2.42), against shapes whose answer is a number.

   The tube: two rings of N vertices at z = -1 and z = +1, bridged into a
   quad band. A ring that starts as a squashed ellipse must come back as a
   circle of the mean radius; the OTHER ring must not move at all, which is
   what proves the islands split works and symmetry cannot fold the mesh. */
(function () {
  var out = [], errs = [];
  var _ce = console.error;
  console.error = function () { errs.push(Array.prototype.join.call(arguments, ' ')); _ce.apply(console, arguments); };
  function log(k, v) { out.push(k + '=' + v); }
  function K() { return window.__kubik; }

  var N = 8;

  /* sx/sy squash the TOP ring (z=+1) only; the bottom stays a true circle of
     radius 1 so it can serve as the control. */
  function tube(sx, sy, jitter, both) {
    var pos = [], groups = [];
    for (var r = 0; r < 2; r++) {
      var hit = both || r === 1;             // `both` makes the tube mirror-symmetric about z=0
      for (var i = 0; i < N; i++) {
        var a = (i / N) * Math.PI * 2;
        var j = (hit && jitter) ? (1 + jitter * Math.sin(i * 2.7)) : 1;
        var kx = hit ? sx : 1, ky = hit ? sy : 1;
        pos.push(Math.cos(a) * kx * j, Math.sin(a) * ky * j, r === 0 ? -1 : 1);
      }
    }
    for (var q = 0; q < N; q++) {
      var a0 = q, b0 = (q + 1) % N, c0 = N + ((q + 1) % N), d0 = N + q;
      groups.push({ triangles: [[a0, b0, c0], [a0, c0, d0]] });
    }
    return { positions: pos, groups: groups };
  }

  /* A closed cube, for the "a solid is not a loop" test. */
  function cube() {
    var pos = [], groups = [];
    [-1, 1].forEach(function (x) {
      [-1, 1].forEach(function (y) {
        [-1, 1].forEach(function (z) { pos.push(x, y, z); });
      });
    });
    var idx = function (x, y, z) { return x * 4 + y * 2 + z; };
    var quads = [
      [idx(0, 0, 0), idx(0, 1, 0), idx(0, 1, 1), idx(0, 0, 1)],   // x-
      [idx(1, 0, 0), idx(1, 0, 1), idx(1, 1, 1), idx(1, 1, 0)],   // x+
      [idx(0, 0, 0), idx(0, 0, 1), idx(1, 0, 1), idx(1, 0, 0)],   // y-
      [idx(0, 1, 0), idx(1, 1, 0), idx(1, 1, 1), idx(0, 1, 1)],   // y+
      [idx(0, 0, 0), idx(1, 0, 0), idx(1, 1, 0), idx(0, 1, 0)],   // z-
      [idx(0, 0, 1), idx(0, 1, 1), idx(1, 1, 1), idx(1, 0, 1)]    // z+
    ];
    quads.forEach(function (q) {
      groups.push({ triangles: [[q[0], q[1], q[2]], [q[0], q[2], q[3]]] });
    });
    return { positions: pos, groups: groups };
  }

  /* A flat 3x3 grid of quads in the XZ plane, for the non-convex rim test. */
  var G = 4;
  function grid() {
    var pos = [], groups = [];
    for (var r = 0; r < G; r++) for (var c = 0; c < G; c++) pos.push(c - 1.5, 0, r - 1.5);
    for (var rr = 0; rr < G - 1; rr++) for (var cc = 0; cc < G - 1; cc++) {
      var a = rr * G + cc, b = rr * G + cc + 1, d = (rr + 1) * G + cc + 1, e = (rr + 1) * G + cc;
      groups.push({ triangles: [[a, b, d], [a, d, e]] });
    }
    return { positions: pos, groups: groups };
  }
  function faceAt(r, c) { return r * (G - 1) + c; }
  // Three quads in an L: (0,0), (1,0), (1,1). Its rim has a reflex corner.
  function lShapeFaces() { return [faceAt(0, 0), faceAt(1, 0), faceAt(1, 1)]; }
  // The rim of a face set, as ordered logical ids - the same once-only test
  // the app uses, walked here so the probe can measure the ring for itself.
  function rimOf(faces) {
    var count = new Map(), ends = new Map(), adj = new Map();
    faces.forEach(function (gi) {
      var lp = k.groupLogicalLoop(obj, gi);
      for (var i = 0; i < lp.length; i++) {
        var a = lp[i], b = lp[(i + 1) % lp.length], kk = k.edgeKey(a, b);
        count.set(kk, (count.get(kk) || 0) + 1);
        if (!ends.has(kk)) ends.set(kk, [a, b]);
      }
    });
    count.forEach(function (c, kk) {
      if (c !== 1) return;
      var e = ends.get(kk);
      if (!adj.has(e[0])) adj.set(e[0], []);
      if (!adj.has(e[1])) adj.set(e[1], []);
      adj.get(e[0]).push(e[1]); adj.get(e[1]).push(e[0]);
    });
    var start = adj.keys().next().value, ids = [start], seen = new Set([start]), cur = start;
    for (;;) {
      var nx = adj.get(cur).filter(function (n) { return !seen.has(n); })[0];
      if (nx === undefined) break;
      seen.add(nx); ids.push(nx); cur = nx;
    }
    return ids;
  }
  function rimLength(ids) {
    var t = 0;
    for (var i = 0; i < ids.length; i++) t += P(ids[i]).distanceTo(P(ids[(i + 1) % ids.length]));
    return t;
  }

  var k, A, obj, objId;
  function build(ed) { k.rebuildFromEditable(obj, ed); k.ensureHelpers(obj); }
  function P(l) { return k.logicalPos(obj, l); }
  function topo() { return obj.mesh.userData.topo; }
  function at(x, y, z) {
    var t = topo(), best = -1, bd = 1e9;
    for (var l = 0; l < t.logicalCount; l++) {
      var p = P(l), d = (p.x - x) * (p.x - x) + (p.y - y) * (p.y - y) + (p.z - z) * (p.z - z);
      if (d < bd) { bd = d; best = l; }
    }
    return best;
  }
  // Every logical id whose z matches, i.e. one ring of the tube.
  function ring(z) {
    var t = topo(), ids = [];
    for (var l = 0; l < t.logicalCount; l++) if (Math.abs(P(l).z - z) < 0.25) ids.push(l);
    return ids;
  }
  function edgeBetween(la, lb) {
    var e = topo().edges;
    for (var i = 0; i < e.length; i++) {
      if ((e[i][0] === la && e[i][1] === lb) || (e[i][0] === lb && e[i][1] === la)) return i;
    }
    return -1;
  }
  // Radii of a set of ids about their own centroid, as [min, max, mean].
  function radii(ids) {
    var cx = 0, cy = 0, cz = 0;
    ids.forEach(function (l) { var p = P(l); cx += p.x; cy += p.y; cz += p.z; });
    cx /= ids.length; cy /= ids.length; cz /= ids.length;
    var lo = 1e9, hi = -1e9, sum = 0;
    ids.forEach(function (l) {
      var p = P(l);
      var d = Math.sqrt((p.x - cx) * (p.x - cx) + (p.y - cy) * (p.y - cy) + (p.z - cz) * (p.z - cz));
      lo = Math.min(lo, d); hi = Math.max(hi, d); sum += d;
    });
    return [lo, hi, sum / ids.length];
  }
  function snapshot() {
    var t = topo(), a = [];
    for (var l = 0; l < t.logicalCount; l++) { var p = P(l); a.push(p.x, p.y, p.z); }
    return a;
  }
  function maxDrift(before) {
    var now = snapshot(), m = 0;
    for (var i = 0; i < Math.min(now.length, before.length); i += 3) {
      m = Math.max(m, Math.hypot(now[i] - before[i], now[i + 1] - before[i + 1], now[i + 2] - before[i + 2]));
    }
    return m;
  }
  // Consecutive-gap spread around a ring, sorted by angle in XY.
  function gapSpread(ids) {
    var cx = 0, cy = 0;
    ids.forEach(function (l) { var p = P(l); cx += p.x; cy += p.y; });
    cx /= ids.length; cy /= ids.length;
    var angs = ids.map(function (l) { var p = P(l); return Math.atan2(p.y - cy, p.x - cx); }).sort(function (a, b) { return a - b; });
    var lo = 1e9, hi = -1e9;
    for (var i = 0; i < angs.length; i++) {
      var g = (i + 1 < angs.length) ? angs[i + 1] - angs[i] : (angs[0] + Math.PI * 2 - angs[i]);
      lo = Math.min(lo, g); hi = Math.max(hi, g);
    }
    return hi - lo;
  }

  function runCirc(amount, even) {
    k.circularizeSelection();
    if (!A.pendingOp) return 'REFUSED: ' + ((document.getElementById('toast') || {}).textContent || '');
    if (even) A.pendingOp.even = true;
    k.setPendingAmount(amount);
    k.confirmPendingOp();
    return null;
  }
  function selectRing(z) {
    var ids = ring(z), sel = [];
    // Ordered by angle so consecutive pairs are real edges.
    var cx = 0, cy = 0;
    ids.forEach(function (l) { var p = P(l); cx += p.x; cy += p.y; });
    cx /= ids.length; cy /= ids.length;
    ids.sort(function (a, b) {
      var pa = P(a), pb = P(b);
      return Math.atan2(pa.y - cy, pa.x - cx) - Math.atan2(pb.y - cy, pb.x - cx);
    });
    for (var i = 0; i < ids.length; i++) {
      var e = edgeBetween(ids[i], ids[(i + 1) % ids.length]);
      if (e >= 0) sel.push(e);
    }
    return { ids: ids, edges: sel };
  }

  function main() {
    k = K(); A = k.App;
    objId = A.activeObjectId || Array.from(A.selectedObjectIds)[0];
    obj = k.findObject(objId);
    A.activeObjectId = objId;
    A.symmetry = false;

    /* ---- 1. An ellipse becomes a circle, and only the ring picked moves ---- */
    build(tube(1.6, 0.6, 0));
    A.mode = 'edge';
    var top = selectRing(1);
    var botIds = ring(-1);
    var botBefore = botIds.map(function (l) { return P(l).clone(); });
    A.selectedElements = new Set(top.edges);
    var r1 = runCirc(1, false);
    var rr = radii(ring(1));
    log('1.ellipse.edges', top.edges.length + ' edges' + (r1 ? ' | ' + r1 : ''));
    log('1.ellipse.spread', (rr[1] - rr[0]).toFixed(6) + '  (must be ~0)  mean r=' + rr[2].toFixed(4));
    var botMove = 0;
    ring(-1).forEach(function (l, i) {
      if (botBefore[i]) botMove = Math.max(botMove, P(l).distanceTo(botBefore[i]));
    });
    log('1.ellipse.other_ring_moved', botMove.toFixed(6) + '  (must be 0)');

    /* ---- 2. Amount 0.5 lands exactly half way ---- */
    build(tube(1.6, 0.6, 0));
    A.mode = 'edge';
    var t2 = selectRing(1);
    var probeId = t2.ids[0];
    var start = P(probeId).clone();
    A.selectedElements = new Set(t2.edges);
    var r2a = runCirc(1, false);
    var full = P(probeId).clone();
    k.App.history && null;
    build(tube(1.6, 0.6, 0));
    var t2b = selectRing(1);
    A.selectedElements = new Set(t2b.edges);
    var r2b = runCirc(0.5, false);
    var half = P(t2b.ids[0]).clone();
    var want = start.clone().lerp(full, 0.5);
    log('2.half', (r2a || r2b) ? ('' + (r2a || r2b)) :
      half.distanceTo(want).toFixed(6) + '  from the midpoint of start and full  (must be 0)');

    /* ---- 3. Both rings picked at once stay two circles ---- */
    build(tube(1.6, 0.6, 0));
    A.mode = 'edge';
    var tt = selectRing(1), bb = selectRing(-1);
    A.selectedElements = new Set(tt.edges.concat(bb.edges));
    var r3 = runCirc(1, false);
    var rt = radii(ring(1)), rb = radii(ring(-1));
    var zt = ring(1).map(function (l) { return P(l).z; });
    log('3.two_rings', r3 ? r3 : 'top spread ' + (rt[1] - rt[0]).toFixed(6) +
      ', bottom spread ' + (rb[1] - rb[0]).toFixed(6) + '  (both ~0)');
    log('3.two_rings.z_kept', (Math.max.apply(null, zt) - Math.min.apply(null, zt)).toFixed(6) +
      ' spread, at z=' + zt[0].toFixed(4) + '  (must stay 1)');

    /* ---- 4. Even respaces; without it the angles are kept ---- */
    build(tube(1, 1, 0.35));                 // round-ish but unevenly spaced
    A.mode = 'edge';
    var t4 = selectRing(1);
    A.selectedElements = new Set(t4.edges);
    var beforeGap = gapSpread(t4.ids);
    var r4 = runCirc(1, false);
    var keptGap = gapSpread(ring(1));
    build(tube(1, 1, 0.35));
    var t4b = selectRing(1);
    A.selectedElements = new Set(t4b.edges);
    var r4b = runCirc(1, true);
    var evenGap = gapSpread(ring(1));
    log('4.spacing.before', beforeGap.toFixed(5));
    // Keep-angles holds each vertex at ITS OWN angle about the fitted centre,
    // which is not the ring's centroid, so this shifts a little. What matters
    // is that it stays small - a permuted ring measures in whole radians.
    log('4.spacing.kept', (r4 ? r4 : keptGap.toFixed(5) + '  (must stay well under 1)'));
    log('4.spacing.even', (r4b ? r4b : evenGap.toFixed(5) + '  (must be ~0)'));

    /* ---- 5. A perfect circle is refused, not silently "applied" ---- */
    build(tube(1, 1, 0));
    A.mode = 'edge';
    var t5 = selectRing(1);
    A.selectedElements = new Set(t5.edges);
    var before5 = snapshot();
    k.circularizeSelection();
    var opened = !!A.pendingOp;
    var refusal = k.opRefusal;
    if (A.pendingOp) k.cancelPendingOp();
    log('5.already_round', 'opened=' + opened + ' refusal=' + (refusal || 'none') +
      ' drift=' + maxDrift(before5).toFixed(6));

    /* ---- 6. Vertex mode, face mode, and too few points ---- */
    build(tube(1.6, 0.6, 0));
    A.mode = 'vertex';
    var v6 = ring(1);
    A.selectedElements = new Set(v6);
    var r6 = runCirc(1, false);
    var r6r = radii(ring(1));
    log('6.vertex_mode', r6 ? r6 : 'spread ' + (r6r[1] - r6r[0]).toFixed(6) + '  (must be ~0)');

    build(tube(1.6, 0.6, 0));
    A.mode = 'vertex';
    A.selectedElements = new Set([v6[0], v6[1]]);
    var before6 = snapshot();
    k.circularizeSelection();
    var opened2 = !!A.pendingOp;
    if (A.pendingOp) k.cancelPendingOp();
    log('6.two_points', 'opened=' + opened2 + ' (must be false) drift=' + maxDrift(before6).toFixed(6));

    /* ---- 7. Scattered, unconnected picks still make one circle ---- */
    build(tube(1.6, 0.6, 0));
    A.mode = 'vertex';
    // Angle-ordered, so 0/2/4/6 really are alternating around the ring and
    // share no edge. Logical-id order is NOT angle order.
    var r7ids = selectRing(1).ids;
    var got7 = [r7ids[0], r7ids[2], r7ids[4], r7ids[6]];
    A.selectedElements = new Set(got7);
    var r7 = runCirc(1, false);
    log('7.scattered', r7 ? r7 : 'spread ' + (radii(got7)[1] - radii(got7)[0]).toFixed(6) + '  (must be ~0)');

    /* ---- 8. Object mode refuses, and refuses cleanly ---- */
    build(tube(1.6, 0.6, 0));
    A.mode = 'object';
    A.selectedElements = new Set();
    var before8 = snapshot();
    k.circularizeSelection();
    log('8.object_mode', 'opened=' + (!!A.pendingOp) + ' (must be false) drift=' + maxDrift(before8).toFixed(6));
    if (A.pendingOp) k.cancelPendingOp();

    /* ---- 9. The bar shows the Even switch, and Set flow's does not ---- */
    build(tube(1.6, 0.6, 0));
    A.mode = 'edge';
    var t9 = selectRing(1);
    A.selectedElements = new Set(t9.edges);
    k.circularizeSelection();
    var wrap = document.getElementById('opToggleWrap').style.display;
    var lbl = document.getElementById('opToggle').textContent;
    if (A.pendingOp) k.cancelPendingOp();
    log('9.toggle', 'display=' + wrap + ' label=' + lbl + '  (must be shown, "Even")');

    /* ---- 10. Undo puts it back exactly ---- */
    build(tube(1.6, 0.6, 0));
    // build() writes the mesh straight in and pushes NOTHING, so without this
    // the undo would step back past the fixture into the previous test.
    k.pushHistory();
    A.mode = 'edge';
    var t10 = selectRing(1);
    A.selectedElements = new Set(t10.edges);
    var before10 = snapshot();
    var r10 = runCirc(1, false);
    var movedNow = maxDrift(before10);
    k.undo && k.undo();
    obj = k.findObject(objId);                 // undo rebuilds: the old ref is stale
    var back = maxDrift(before10);
    log('10.undo', r10 ? r10 : 'moved ' + movedNow.toFixed(4) + ' then came back to ' + back.toFixed(6) + '  (must be ~0)');

    /* ---- 11. Symmetry on: the mirrored ring is its own circle ---- */
    build(tube(1.6, 0.6, 0));
    A.mode = 'edge';
    A.symmetry = true;
    // z, so the mirror of the squashed top ring IS the round bottom ring -
    // the exact case one shared circle across both would fold together.
    /* a2.89: the axis became a SET. Written as a one-element set here so
       these sections keep meaning exactly what they meant before. */
    A.symmetryAxes = ['z'];
    var t11 = selectRing(1);
    A.selectedElements = new Set(t11.edges);
    var r11 = runCirc(1, false);
    var rt11 = radii(ring(1)), rb11 = radii(ring(-1));
    log('11.symmetry', r11 ? r11 : 'top spread ' + (rt11[1] - rt11[0]).toFixed(6) +
      ', bottom spread ' + (rb11[1] - rb11[0]).toFixed(6) + ', bottom r=' + rb11[2].toFixed(4) + ' (was 1)');
    A.symmetry = false;

    /* ---- 12. Circularize sits on every component ring, once ---- */
    var seats = ['HUB_TOOLS_VERTEX', 'HUB_TOOLS_EDGE', 'HUB_TOOLS_FACE'].map(function (nm) {
      var list = k[nm];
      if (!list) return nm + '=MISSING';
      var hit = list.filter(function (t) { return t.key === 'circularize'; });
      return nm + '=' + hit.length + '@' + (hit[0] ? hit[0].seat : '-');
    });
    log('12.seats', seats.join(' '));

    /* ---- 13. A branching selection is refused before the bar ever opens ----
       Two rim edges plus the vertical edge hanging off the vertex between
       them: a genuine T, with no single circle to be on. (A fully selected
       band is NOT this - see 20 - it is two clean rims.) */
    build(tube(1.6, 0.6, 0));
    A.mode = 'edge';
    var t13 = selectRing(1);
    var stem = -1;                     // the vertical edge hanging off ids[1]
    topo().edges.forEach(function (e, ei) {
      if (stem >= 0) return;
      var a = e[0], b = e[1];
      if ((a === t13.ids[1] || b === t13.ids[1]) && Math.abs(P(a).z - P(b).z) > 1) stem = ei;
    });
    A.selectedElements = new Set([t13.edges[0], t13.edges[1], stem]);
    var before13 = snapshot();
    k.circularizeSelection();
    var opened13 = !!A.pendingOp;
    if (A.pendingOp) k.cancelPendingOp();
    log('13.patch', 'opened=' + opened13 + ' (must be false) drift=' + maxDrift(before13).toFixed(6) +
      ' toast=' + ((document.getElementById('toast') || {}).textContent || ''));

    /* ---- 14. Helpers follow the mesh, and flat shading survives ---- */
    build(tube(1.6, 0.6, 0));
    A.shadeSmooth = false;
    k.rebuildFromEditable(obj, k.toEditable(obj.mesh));
    k.ensureHelpers(obj);
    var normBefore = obj.mesh.geometry.attributes.normal.count;
    A.mode = 'edge';
    var t14 = selectRing(1);
    A.selectedElements = new Set(t14.edges);
    var r14 = runCirc(1, false);
    var stale = obj.mesh.userData.topo;
    // Every helper dot must sit on a mesh vertex; a stale helper sits where
    // the vertex USED to be.
    var vp = obj.mesh.userData.vertexPoints;
    var worst = -1;
    if (vp && vp.geometry && vp.geometry.attributes.position) {
      var hp = vp.geometry.attributes.position;
      worst = 0;
      for (var h = 0; h < hp.count; h++) {
        var hv = new (k.THREE.Vector3)(hp.getX(h), hp.getY(h), hp.getZ(h));
        var bd = 1e9;
        for (var lz = 0; lz < topo().logicalCount; lz++) bd = Math.min(bd, hv.distanceTo(P(lz)));
        worst = Math.max(worst, bd);
      }
    }
    log('14.helpers', r14 ? r14 : 'topo=' + (stale ? 'cached' : 'rebuilt') +
      ' worst helper offset ' + (worst < 0 ? 'n/a' : worst.toFixed(6)) + '  (must be ~0)');
    log('14.shading', 'normals ' + normBefore + ' -> ' + obj.mesh.geometry.attributes.normal.count +
      ' flat=' + (A.shadeSmooth === false));
    A.shadeSmooth = true;

    /* ---- 15. Even on an OPEN arc keeps it an arc ---- */
    build(tube(1, 1, 0.35));
    A.mode = 'edge';
    var t15 = selectRing(1);
    A.selectedElements = new Set(t15.edges.slice(0, 3));   // 4 vertices, open run
    var arcIds = [t15.ids[0], t15.ids[1], t15.ids[2], t15.ids[3]];
    // What the fit actually says about this arc, before anything moves.
    var fx = arcIds.map(function (l) { return P(l).x; });
    var fy = arcIds.map(function (l) { return P(l).y; });
    var fit15 = k.fitCircle2D(fx, fy);
    log('15.fit', fit15 ? ('centre ' + fit15.x.toFixed(3) + ',' + fit15.y.toFixed(3) +
      ' r ' + fit15.r.toFixed(3) + '  (truth is near 0,0 r 1)') : 'singular');
    var r15 = runCirc(1, true);
    // The span the four vertices cover, about the CENTRE of the ring they
    // came from. A full-circle respacing would blow this out to ~2pi.
    var cx15 = 0, cy15 = 0, allR = ring(1);
    allR.forEach(function (l) { var p = P(l); cx15 += p.x; cy15 += p.y; });
    cx15 /= allR.length; cy15 /= allR.length;
    var ang15 = arcIds.map(function (l) { var p = P(l); return Math.atan2(p.y - cy15, p.x - cx15); });
    var span = Math.max.apply(null, ang15) - Math.min.apply(null, ang15);
    var far15 = 0;
    arcIds.forEach(function (l) { far15 = Math.max(far15, Math.hypot(P(l).x - cx15, P(l).y - cy15)); });
    log('15.open_arc_even', r15 ? r15 : 'span ' + span.toFixed(3) +
      ' rad over 4 consecutive of 8 points, furthest ' + far15.toFixed(3) +
      ' from the ring centre  (span must stay near 2.36, radius near 1)');

    /* ---- 16. Even under symmetry stays symmetric ----
       Both rings jittered IDENTICALLY, so the fixture is genuinely mirror-
       symmetric about z=0 before the op runs. Jittering only the top ring
       measures the fixture's own asymmetry, not the op's. */
    build(tube(1, 1, 0.35, true));
    A.mode = 'edge';
    A.symmetry = true;
    A.symmetryAxes = ['z'];
    var t16 = selectRing(1);
    A.selectedElements = new Set(t16.edges);
    var r16 = runCirc(1, true);
    // Every top vertex must have a bottom vertex directly under it.
    var worstSym = 0;
    ring(1).forEach(function (l) {
      var p = P(l), bd = 1e9;
      ring(-1).forEach(function (m) {
        var q = P(m);
        bd = Math.min(bd, Math.hypot(p.x - q.x, p.y - q.y));
      });
      worstSym = Math.max(worstSym, bd);
    });
    log('16.even_symmetry', r16 ? r16 : 'worst mirror mismatch ' + worstSym.toFixed(6) + '  (must be ~0)');
    A.symmetry = false;

    /* ---- 17. Sharp marks survive the move ---- */
    build(tube(1.6, 0.6, 0));
    A.mode = 'edge';
    var t17 = selectRing(1);
    A.selectedElements = new Set(t17.edges);
    k.markSharpSelection();
    var marksBefore = Object.keys(obj.mesh.userData.edgeShade || {}).length;
    A.selectedElements = new Set(t17.edges);
    var r17 = runCirc(1, false);
    var marksAfter = Object.keys(obj.mesh.userData.edgeShade || {}).length;
    // A mark is alive only if its key still matches a real edge.
    var alive = 0, tp = topo();
    var shade = obj.mesh.userData.edgeShade || {};
    tp.edges.forEach(function (e) {
      if (shade[k.creaseKeyFor ? k.creaseKeyFor(P(e[0]), P(e[1])) : '']) alive++;
    });
    log('17.marks', r17 ? r17 : marksBefore + ' marked -> ' + marksAfter + ' kept, ' + alive +
      ' still on a real edge  (alive must equal kept)');

    /* ---- 18. Three points ALREADY lie on a circle: nothing may move ----
       The centroid-and-mean-radius version failed this every time. */
    build(tube(1, 1, 0));
    A.mode = 'edge';
    var t18 = selectRing(1);
    A.selectedElements = new Set(t18.edges.slice(0, 2));   // an open run of 3
    var arc3 = [t18.ids[0], t18.ids[1], t18.ids[2]];
    var pre18 = arc3.map(function (l) { return P(l).clone(); });
    k.circularizeSelection();
    var opened18 = !!A.pendingOp;
    if (A.pendingOp) { k.setPendingAmount(1); k.confirmPendingOp(); }
    var move18 = 0;
    arc3.forEach(function (l, n) { move18 = Math.max(move18, P(l).distanceTo(pre18[n])); });
    log('18.three_on_a_circle', 'opened=' + opened18 + ' moved ' + move18.toFixed(6) +
      '  (must be 0 — three points always lie on a circle)');

    /* ---- 19. Two disjoint edges are two runs, not one four-point circle ---- */
    build(tube(1.6, 0.6, 0));
    A.mode = 'edge';
    var t19 = selectRing(1);
    var pair = [t19.edges[0], t19.edges[4]];               // opposite sides
    A.selectedElements = new Set(pair);
    var before19 = snapshot();
    k.circularizeSelection();
    var opened19 = !!A.pendingOp;
    if (A.pendingOp) { k.setPendingAmount(1); k.confirmPendingOp(); }
    log('19.two_edges', 'opened=' + opened19 + ' (must be false) drift=' +
      maxDrift(before19).toFixed(6) + ' toast=' + ((document.getElementById('toast') || {}).textContent || ''));

    /* ---- 20. A whole cylinder band in VERTEX mode is two rims, not a patch ---- */
    build(tube(1.6, 0.6, 0));
    A.mode = 'vertex';
    var all20 = [];
    for (var l20 = 0; l20 < topo().logicalCount; l20++) all20.push(l20);
    A.selectedElements = new Set(all20);
    var r20 = runCirc(1, false);
    var rt20 = radii(ring(1)), rb20 = radii(ring(-1));
    var z20 = ring(1).map(function (l) { return P(l).z; });
    log('20.band_vertex_mode', r20 ? r20 : 'top spread ' + (rt20[1] - rt20[0]).toFixed(6) +
      ', bottom spread ' + (rb20[1] - rb20[0]).toFixed(6) +
      ', top z ' + z20[0].toFixed(4) + '  (both rims rounded, z still 1)');

    /* ---- 21. Even on a non-convex rim keeps the ring in order ----
       An L of three quads off a flat grid: its rim has a reflex corner that
       sorts out of sequence by angle, so an angle-ordered Even permutes the
       loop and folds the faces through each other. Measured as "does any rim
       edge cross another" via total rim length, which explodes when the ring
       is permuted. */
    build(grid());
    A.mode = 'face';
    A.selectedElements = new Set(lShapeFaces());
    var rim21 = rimOf(lShapeFaces());
    var lenBefore = rimLength(rim21);
    var r21 = runCirc(1, true);
    var lenAfter = rimLength(rim21);
    log('21.nonconvex_even', r21 ? r21 : 'rim perimeter ' + lenBefore.toFixed(3) + ' -> ' +
      lenAfter.toFixed(3) + '  (a permuted ring roughly doubles it)');

    /* ---- 22. A whole closed solid in vertex mode must NOT be flattened ----
       Every face is covered, so the patch has no border and the narrowing
       takes every loop edge with it. Read as "unconnected", a cube goes down
       the scattered path and comes back as an eight-point ring. */
    build(cube());
    A.mode = 'vertex';
    var all22 = [];
    for (var l22 = 0; l22 < topo().logicalCount; l22++) all22.push(l22);
    A.selectedElements = new Set(all22);
    var before22 = snapshot();
    k.circularizeSelection();
    var opened22 = !!A.pendingOp;
    if (A.pendingOp) { k.setPendingAmount(1); k.confirmPendingOp(); }
    // A cube keeps 8 distinct z values in pairs; a flattened one collapses.
    var zs22 = [];
    for (var q22 = 0; q22 < topo().logicalCount; q22++) zs22.push(P(q22).z);
    log('22.solid_vertex_mode', 'opened=' + opened22 + ' (must be false) drift=' +
      maxDrift(before22).toFixed(6) + ' z range ' +
      (Math.max.apply(null, zs22) - Math.min.apply(null, zs22)).toFixed(3) + ' (must stay 2)');

    /* ---- 23. Even on a scattered pick must not use TAP order ----
       Four alternating vertices of a ring, handed over deliberately shuffled.
       In tap order the ring comes back permuted, which shows up as a
       perimeter roughly 40% longer than the square they should form. */
    build(tube(1, 1, 0));
    A.mode = 'vertex';
    var r23 = selectRing(1).ids;
    var pick23 = [r23[0], r23[4], r23[2], r23[6]];      // shuffled on purpose
    A.selectedElements = new Set(pick23);
    var e23 = runCirc(1, true);
    // Perimeter walked in ANGLE order: a correct result is a square.
    var cx23 = 0, cy23 = 0;
    pick23.forEach(function (l) { var p = P(l); cx23 += p.x; cy23 += p.y; });
    cx23 /= 4; cy23 /= 4;
    var ord23 = pick23.slice().sort(function (a, b) {
      return Math.atan2(P(a).y - cy23, P(a).x - cx23) - Math.atan2(P(b).y - cy23, P(b).x - cx23);
    });
    var gaps23 = ord23.map(function (l, n) {
      return P(l).distanceTo(P(ord23[(n + 1) % 4]));
    });
    log('23.scattered_even', e23 ? e23 : 'side lengths ' +
      gaps23.map(function (g) { return g.toFixed(3); }).join(' ') + '  (must all be equal)');

    log('console.errors', errs.length ? errs.join(' | ').slice(0, 500) : 'none');
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
