/* Array (a2.78). Does it make the right number of the right thing, in the
   right places, and does it hand back a mesh the rest of the app can hold? */
(function () {
  var out = [], errs = [];
  var _ce = console.error;
  console.error = function () { errs.push(Array.prototype.join.call(arguments, ' ')); _ce.apply(console, arguments); };
  function log(k, v) { out.push(k + '=' + v); }
  var k, A, THREE;

  function fresh(name, pos) {
    var o = k.createCubeObject(name, pos || new THREE.Vector3(0, 0, 0));
    A.selectedObjectIds = new Set([o.id]);
    A.activeObjectId = o.id;
    k.setMode('object');
    k.refreshUI();
    return o;
  }
  function tris(o) { return o.mesh.geometry.index.count / 3; }
  function faces(o) { return o.mesh.geometry.groups.length; }
  function mats(o) { return Array.isArray(o.mesh.material) ? o.mesh.material.length : 1; }
  function bbox(o) {
    var b = new THREE.Box3().setFromBufferAttribute(o.mesh.geometry.attributes.position);
    return b;
  }
  /* Every face group's centroid, as a distance from `centre` measured in
     the plane the ring sweeps. A ring has them all equal; a row does not. */
  function groupRadii(o, centre, axis) {
    var perp = axis === 'y' ? ['x', 'z'] : axis === 'x' ? ['y', 'z'] : ['x', 'y'];
    var pos = o.mesh.geometry.attributes.position, idx = o.mesh.geometry.index;
    var mn = Infinity, mx = -Infinity, n = 0;
    o.mesh.geometry.groups.forEach(function (g) {
      var c = new THREE.Vector3(), cnt = 0;
      for (var i = g.start; i < g.start + g.count; i++) {
        var a = idx.getX(i);
        c.x += pos.getX(a); c.y += pos.getY(a); c.z += pos.getZ(a); cnt++;
      }
      c.divideScalar(cnt);
      var r = Math.hypot(c[perp[0]] - centre[perp[0]], c[perp[1]] - centre[perp[1]]);
      if (r < mn) mn = r;
      if (r > mx) mx = r;
      n++;
    });
    return { min: mn, max: mx, n: n };
  }

  /* WHERE EACH COPY ACTUALLY SITS. A bounding box cannot tell a ring from a
     hexagon - six cubes in a perfect ring have x and z spans 0.7 apart, and
     the first pass of this probe called that a failure. What defines a ring
     is the copies' ANGLES about the centre, so measure those: the copies are
     consecutive blocks of `per` face groups, and each block's centroid is
     that copy's position. Angles are returned as gaps between neighbours,
     unsigned, so the test does not care which way round three.js turns. */
  function copyAngles(o, centre, axis, per) {
    var perp = axis === 'y' ? ['x', 'z'] : axis === 'x' ? ['y', 'z'] : ['x', 'y'];
    var pos = o.mesh.geometry.attributes.position, idx = o.mesh.geometry.index;
    var gs = o.mesh.geometry.groups;
    var angs = [], radii = [];
    for (var c = 0; c * per < gs.length; c++) {
      var acc = new THREE.Vector3(), cnt = 0;
      for (var gi = c * per; gi < (c + 1) * per && gi < gs.length; gi++) {
        var g = gs[gi];
        for (var i = g.start; i < g.start + g.count; i++) {
          var a = idx.getX(i);
          acc.x += pos.getX(a); acc.y += pos.getY(a); acc.z += pos.getZ(a); cnt++;
        }
      }
      acc.divideScalar(cnt);
      var du = acc[perp[0]] - centre[perp[0]], dv = acc[perp[1]] - centre[perp[1]];
      radii.push(Math.hypot(du, dv));
      angs.push(Math.atan2(dv, du) * 180 / Math.PI);
    }
    var gaps = [];
    for (var j = 1; j < angs.length; j++) {
      var d = Math.abs(angs[j] - angs[j - 1]) % 360;
      gaps.push(d > 180 ? 360 - d : d);
    }
    return { angs: angs, gaps: gaps, rmin: Math.min.apply(null, radii), rmax: Math.max.apply(null, radii) };
  }

  function run(o, count, mode, amount, axis) {
    /* a2.89: the axis became a SET. Written as a one-element set here so
       these sections keep meaning exactly what they meant before. */
    A.symmetryAxes = [axis || 'x'];
    return k.arrayOp(o, count, mode, amount, k.primarySymAxis());
  }

  function main() {
    k = window.__kubik; A = k.App; THREE = k.THREE;

    // ---- 1. a line makes the right number of everything ----
    var objsBefore = A.objects.length;
    var o1 = fresh('L1');
    var t0 = tris(o1), f0 = faces(o1), m0 = mats(o1);
    log('1.before', t0 + ' triangles, ' + f0 + ' faces, ' + m0 + ' materials');
    run(o1, 4, 'line', 1.5, 'x');
    log('1.after', tris(o1) + ' triangles, ' + faces(o1) + ' faces, ' + mats(o1) + ' materials');
    log('1.counts', (tris(o1) === t0 * 4 && faces(o1) === f0 * 4 && mats(o1) === f0 * 4)
      ? 'x4 of everything - triangles, faces AND materials all quadrupled together'
      : 'MISMATCH - a geometry with more groups than materials crashes three raycast');

    // ---- 2. it is ONE object, and the copies are where they should be ----
    log('2.one_object', A.objects.length === objsBefore + 1
      ? 'the array added no objects at all - the copies went into the one that was there'
      : 'IT ADDED ' + (A.objects.length - objsBefore - 1) + ' EXTRA OBJECTS - it should bake into one');
    var b2 = bbox(o1), s2 = b2.getSize(new THREE.Vector3());
    /* A unit cube arrayed 4 times at spacing 1.5: the last copy's ORIGIN is
       3 x 1.5 = 4.5 widths along, and the box then runs half a width further
       at each end, so the span is 1 + 4.5 = 5.5 widths. (First pass expected
       4.5 and called the app wrong - the shape's own width was left out.) */
    var w = 1;   // measured below against the un-arrayed axis
    var wy = s2.y;
    var ratio = s2.x / wy;
    log('2.span', 'x spans ' + s2.x.toFixed(3) + ' against y ' + wy.toFixed(3) +
      ' - ratio ' + ratio.toFixed(3));
    log('2.spacing_right', Math.abs(ratio - 5.5) < 0.05
      ? 'exactly 1 + 3x1.5 shape widths, so the spacing really is a multiple of the shape'
      : 'WRONG SPAN - expected a ratio of 5.5, got ' + ratio.toFixed(3));
    log('2.other_axes_untouched', (Math.abs(s2.y - s2.z) < 1e-4)
      ? 'y and z are unchanged - a line moves along one axis only'
      : 'THE OTHER AXES MOVED TOO');
    void w;

    // ---- 3. the axis is App.symmetryAxis ----
    var o3 = fresh('L3');
    run(o3, 3, 'line', 2, 'z');
    var s3 = bbox(o3).getSize(new THREE.Vector3());
    log('3.axis_follows_symmetry', (s3.z > s3.x * 2 && Math.abs(s3.x - s3.y) < 1e-4)
      ? 'set the symmetry axis to Z and the row went along Z'
      : 'AXIS IGNORED - x ' + s3.x.toFixed(2) + ' y ' + s3.y.toFixed(2) + ' z ' + s3.z.toFixed(2));

    // ---- 4. a ring refuses when it has nothing to turn around ----
    var o4 = fresh('R4', new THREE.Vector3(0, 0, 0));
    k.setPivotAuto && k.setPivotAuto();
    var ok4 = run(o4, 6, 'ring', 360, 'y');
    log('4.ring_at_centre', ok4 === false
      ? 'refused - a shape sitting on the centre has no radius to sweep, and the copies would interleave'
      : 'IT BUILT A KNOT - ' + faces(o4) + ' faces stacked on the origin');

    // ---- 5. a ring off the centre makes a real ring ----
    var o5 = fresh('R5', new THREE.Vector3(4, 0, 0));
    var ok5 = run(o5, 6, 'ring', 360, 'y');
    log('5.built', ok5 ? 'built' : 'REFUSED - it should not have');
    var b5 = bbox(o5), s5 = b5.getSize(new THREE.Vector3());
    log('5.faces', faces(o5) + ' faces from 6 copies of a 6-faced cube');
    /* A BOUNDING BOX CANNOT TELL A RING FROM A HEXAGON, and six copies of a
       cube ARE a hexagon - the first pass compared the x and z spans and
       called a perfectly good ring wrong because they differ by 0.7. What
       actually defines a ring is that every copy sits at the SAME RADIUS
       from the centre it turns around, so measure that instead. */
    var a5 = copyAngles(o5, new THREE.Vector3(-4, 0, 0), 'y', 6);
    log('5.radii', 'the 6 copy centres sit at radius ' + a5.rmin.toFixed(3) +
      ' to ' + a5.rmax.toFixed(3));
    log('5.gaps', 'gaps between neighbours: ' + a5.gaps.map(function (g) { return g.toFixed(1); }).join(', '));
    var even5 = a5.gaps.every(function (g) { return Math.abs(g - 60) < 0.01; });
    log('5.is_a_ring', ((a5.rmax - a5.rmin) < 0.01 && even5 && s5.y < 1.5)
      ? 'all six copies at one radius, 60 degrees apart, still one cube tall - that is an even ring'
      : 'NOT AN EVEN RING - radius spread ' + (a5.rmax - a5.rmin).toFixed(3) +
        ', gaps ' + a5.gaps.map(function (g) { return g.toFixed(1); }).join('/'));

    // ---- 6. a full turn does not double up at the seam ----
    var o6 = fresh('R6', new THREE.Vector3(4, 0, 0));
    run(o6, 6, 'ring', 360, 'y');
    /* Six copies at 60 degrees each. If the step were 360/(n-1) = 72 the
       last copy would land past the first and two would coincide, which
       shows up as a pair of face groups with the same centroid. */
    var cents = [];
    var pos6 = o6.mesh.geometry.attributes.position;
    o6.mesh.geometry.groups.forEach(function (g) {
      var c = new THREE.Vector3(), nn = 0;
      var idx = o6.mesh.geometry.index;
      for (var i = g.start; i < g.start + g.count; i++) {
        var a = idx.getX(i);
        c.x += pos6.getX(a); c.y += pos6.getY(a); c.z += pos6.getZ(a); nn++;
      }
      cents.push(c.divideScalar(nn));
    });
    var dup = 0;
    for (var i6 = 0; i6 < cents.length; i6++)
      for (var j6 = i6 + 1; j6 < cents.length; j6++)
        if (cents[i6].distanceTo(cents[j6]) < 1e-3) dup++;
    log('6.no_seam_overlap', dup === 0
      ? 'no two face groups share a centroid - a full turn divides by n, so the last copy stops short of the first instead of landing on it'
      : dup + ' PAIRS OF FACES SIT ON TOP OF EACH OTHER - the full turn is dividing by n-1');

    // ---- 7. an arc puts the last copy AT the end of the sweep ----
    var o7 = fresh('R7', new THREE.Vector3(4, 0, 0));
    var ok7 = run(o7, 3, 'ring', 90, 'y');
    log('7.built', ok7 ? 'built, ' + faces(o7) + ' faces' :
      'REFUSED - "' + (k.App.lastRefusal || 'no reason recorded') + '"');
    var b7 = bbox(o7);
    /* Three copies over 90 degrees is 45 apart, so the last sits on +z at
       radius 4 while the first is still on +x. The box therefore reaches
       about 4.5 on both axes and no further. */
    void b7;
    var a7 = copyAngles(o7, new THREE.Vector3(-4, 0, 0), 'y', 6);
    log('7.gaps', 'gaps ' + a7.gaps.map(function (g) { return g.toFixed(1); }).join(', ') +
      ', total sweep ' + a7.gaps.reduce(function (x, y) { return x + y; }, 0).toFixed(1) + ' degrees');
    /* THREE copies over 90 degrees is 45 apart - n-1 gaps, not n - so the
       first copy sits at one end of the sweep and the last at the other.
       Dividing by n here would give 30 and stop short of the quarter turn. */
    log('7.arc_ends_on_the_sweep',
      a7.gaps.length === 2 && a7.gaps.every(function (g) { return Math.abs(g - 45) < 0.01; })
      ? 'three copies 45 degrees apart, spanning exactly the 90 asked for - an arc divides by n-1 so it ends ON the sweep'
      : 'THE ARC IS WRONG - gaps ' + a7.gaps.map(function (g) { return g.toFixed(1); }).join('/'));

    // ---- 8. materials are CLONES, not shared ----
    var o8 = fresh('M8');
    run(o8, 3, 'line', 1.5, 'x');
    /* THE CONSEQUENCE, NOT THE MECHANISM (v2.8). This used to assert that
       copy 2's face 0 was a different material OBJECT from copy 0's - true
       when every face group owned its own material, and deliberately false
       since the pool. Painting one copy still must not paint the others, so
       ask that instead: paint face 0 and count how many groups moved. */
    var A8 = k.App;
    A8.mode = 'face';
    A8.activeObjectId = o8.id;
    A8.selectedObjectIds = new Set([o8.id]);
    A8.selectedElements = new Set([0]);
    k.MATERIALS.set('mat_probe8', { id: 'mat_probe8', name: 'Probe 8', color: '#1188ff',
                                    roughness: 0.4, metalness: 0, bevel: 0, masks: [] });
    k.applyFinishToSelection('mat_probe8');
    var fin8 = o8.mesh.userData.finishes || {};
    var moved = Object.keys(fin8).filter(function (g) { return fin8[g] === 'mat_probe8'; });
    var ms = o8.mesh.material;
    var lit = [];
    for (var i8 = 0; i8 < ms.length; i8++) {
      if (ms[i8] && ms[i8].userData.kubikDef === 'mat_probe8') lit.push(i8);
    }
    log('8.distinct_materials', (moved.length === 1 && lit.length === 1 && lit[0] === 0)
      ? 'painting face 0 painted face 0 - the other copies are untouched'
      : 'PAINTING ONE COPY SPREAD - map ' + moved.join(',') + ' / drawn ' + lit.join(','));
    A8.selectedElements = new Set();
    A8.mode = 'object';

    // ---- 9. the mesh survives the app's own machinery ----
    var o9 = fresh('S9');
    run(o9, 4, 'line', 1.5, 'x');
    var threw = null;
    try {
      k.ensureHelpers(o9);
      k.applyShading(o9);
      k.refreshUI();
      var ed = k.toEditable(o9.mesh);
      k.rebuildFromEditable(o9, ed);
      k.ensureHelpers(o9);
    } catch (e) { threw = e && e.message; }
    log('9.round_trip', threw ? 'THREW: ' + threw
      : 'shades, re-reads and rebuilds cleanly - ' + tris(o9) + ' triangles, ' +
        o9.mesh.userData.topo.logicalCount + ' logical vertices');
    /* Four separate cubes share no vertices, so the weld must find 4x8 = 32
       logical vertices - not 8, which would mean the copies were welded into
       each other, and not 96, which would mean the weld is not running. */
    log('9.copies_are_separate', o9.mesh.userData.topo.logicalCount === 32
      ? '32 logical vertices - four separate 8-corner cubes, welded within each copy and not across them'
      : 'WELD IS WRONG: ' + o9.mesh.userData.topo.logicalCount + ' logical vertices, expected 32');

    // ---- 10. count 1 is a no-op, not a crash ----
    var o10 = fresh('N10');
    var t10 = tris(o10);
    run(o10, 1, 'line', 1.5, 'x');
    log('10.count_one', tris(o10) === t10 && faces(o10) === 6
      ? 'a count of 1 leaves the shape exactly as it was'
      : 'COUNT 1 CHANGED THE MESH: ' + tris(o10) + ' triangles, ' + faces(o10) + ' faces');

    // ---- 11. a flat shape still marches along its flat axis ----
    var o11 = null;
    try {
      o11 = k.createPrimitiveObject('plane', k.PRIM_SPECS.plane.def, 'F11', new THREE.Vector3(0, 0, 0));
    } catch (e11) { o11 = null; }
    if (!o11) { log('11.flat', 'NO PLANE BUILT - section 11 tested nothing'); }
    else {
      A.selectedObjectIds = new Set([o11.id]); A.activeObjectId = o11.id;
      k.setMode('object'); k.refreshUI();
      var before11 = bbox(o11).getSize(new THREE.Vector3());
      // A plane is flat in Y, so array it along Y - the degenerate case.
      run(o11, 3, 'line', 1.5, 'y');
      var after11 = bbox(o11).getSize(new THREE.Vector3());
      log('11.flat_before', 'y extent ' + before11.y.toFixed(4));
      log('11.flat_marches', after11.y > Math.max(before11.y, 0.001) * 2
        ? 'a plane arrayed along its own flat axis still spreads out (y ' +
          before11.y.toFixed(4) + ' -> ' + after11.y.toFixed(3) +
          ') - the fallback extent keeps the slider meaning something'
        : 'THE COPIES STACKED - y went ' + before11.y.toFixed(4) + ' -> ' + after11.y.toFixed(4));
    }

    // ---- 12. the pivot is what a ring turns around ----
    var o12 = fresh('P12', new THREE.Vector3(0, 0, 0));
    k.setPivotPoint(new THREE.Vector3(-5, 0, 0));
    var ok12 = run(o12, 4, 'ring', 360, 'y');
    var b12 = bbox(o12);
    // World-space: the object is at the origin and the pivot 5 to the -x, so
    // the ring is centred on the pivot with radius 5.
    o12.mesh.updateMatrixWorld();
    var wb12 = new THREE.Box3().setFromObject(o12.mesh);
    var c12 = wb12.getCenter(new THREE.Vector3());
    log('12.pivot_ring', ok12 ? 'built' : 'REFUSED');
    log('12.turns_around_pivot', (ok12 && Math.abs(c12.x - (-5)) < 0.35 && Math.abs(c12.z) < 0.35)
      ? 'the ring is centred on the placed pivot (' + c12.x.toFixed(2) + ', ' + c12.z.toFixed(2) +
        '), not on the world origin'
      : 'IT IGNORED THE PIVOT - ring centre at ' + c12.x.toFixed(2) + ', ' + c12.z.toFixed(2));
    k.setPivotAuto && k.setPivotAuto();

    /* ---- 13-19. THROUGH THE OP BAR, which is where the bugs were ----
       Sections 1-12 call arrayOp directly, and every one of them passed
       while the tool itself was broken: the slider clamped Ring's sweep to
       Line's range, the count stepper reset it, the axis was read live so
       the toast announced one thing and the geometry was another. A worker
       function is not a tool. These drive the same controls a finger does. */
    var o13 = fresh('B13', new THREE.Vector3(4, 0, 0));
    A.symmetryAxes = ['y'];
    k.arraySelection();
    var op = A.pendingOp;
    log('13.opens', op ? 'op bar open: ' + op.kind + ', mode ' + op.groupMode +
      ', count ' + op.segments + ', amount ' + op.amount : 'NO PENDING OP');
    log('13.axis_captured', op && op.axis === 'y'
      ? 'the axis was captured when the bar opened, not read live'
      : 'AXIS NOT CAPTURED: ' + (op && op.axis));

    // 14. switch to Ring, then move the slider - the clamp bug
    k.setPendingGroupMode ? k.setPendingGroupMode('ring') : (function () {
      A.pendingOp.groupMode = 'ring'; k.refreshOpGrouping && k.refreshOpGrouping();
    })();
    // Go through the same function the slider calls.
    k.setPendingAmount(360);
    k.flushPendingApply();
    log('14.ring_sweep_survives', Math.abs(A.pendingOp.amount - 360) < 0.001
      ? 'a 360 sweep set through the slider stays 360'
      : 'THE SWEEP WAS CLAMPED TO ' + A.pendingOp.amount + ' - Ring is being held to Line range');

    // 15. the count stepper must not reset the sweep
    k.stepSegments(1);
    k.flushPendingApply();
    log('15.stepper_keeps_sweep', Math.abs(A.pendingOp.amount - 360) < 0.001
      ? 'pressing + on the count left the sweep at 360'
      : 'THE STEPPER RESET THE SWEEP TO ' + A.pendingOp.amount);
    log('15.count', 'count is now ' + A.pendingOp.segments);

    // 16. Ring -> Line -> Ring remembers each side's own amount
    A.pendingOp.groupMode = 'line';
    k.refreshOpAmountVisibility();
    var lineAmt = A.pendingOp.amount;
    log('16.line_range', 'switching to Line put the amount at ' + lineAmt.toFixed(2) +
      ' (slider max ' + document.getElementById('opSlider').max + ')');
    log('16.line_not_degrees', lineAmt <= 4.001
      ? 'Line got a spacing, not the 360 degrees Ring was holding'
      : 'LINE INHERITED THE RING SWEEP - a spacing of 360 shape widths');
    A.pendingOp.groupMode = 'ring';
    k.refreshOpAmountVisibility();
    log('16.ring_remembered', Math.abs(A.pendingOp.amount - 360) < 0.001
      ? 'and going back to Ring restored the 360 it had'
      : 'RING CAME BACK AT ' + A.pendingOp.amount);

    // 17. cancel puts everything back
    var before17 = tris(o13), f17 = faces(o13);
    k.cancelPendingOp();
    log('17.cancel', tris(o13) === 12 && faces(o13) === 6
      ? 'cancel restored the single cube (' + before17 + '/' + f17 + ' while open -> 12/6)'
      : 'CANCEL LEFT ' + tris(o13) + ' triangles and ' + faces(o13) + ' faces');

    // 18. materials do not leak across re-runs
    var o18 = fresh('B18');
    A.symmetryAxes = ['x'];
    var clones0 = k.PERF.matClone;
    k.arraySelection();
    for (var q18 = 0; q18 < 6; q18++) { k.stepSegments(q18 % 2 ? -1 : 1); k.flushPendingApply(); }
    var binned = (typeof k.opMatBinSize === 'number') ? k.opMatBinSize : null;
    log('18.clones', (k.PERF.matClone - clones0) + ' material clones over 6 stepper presses');
    log('18.binned', binned === null ? 'bin size not exposed'
      : binned + ' outgoing materials were binned rather than dropped');
    log('18.no_leak', binned === null || binned > 0
      ? 'the outgoing arrays go to the bin, so dispose still happens'
      : 'NOTHING WAS BINNED - every re-run abandons a material array');
    k.cancelPendingOp();

    // 19. a hand-marked crease travels to every copy
    var o19 = fresh('B19');
    var topo19 = (k.ensureHelpers(o19), o19.mesh.userData.topo);
    var e0 = topo19.edges[0];
    var pa = k.logicalPos(o19, e0[0]), pb = k.logicalPos(o19, e0[1]);
    o19.mesh.userData.creases = {};
    o19.mesh.userData.creases[k.creaseKeyFor(pa, pb)] = true;
    k.arrayOp(o19, 4, 'line', 1.5, 'x');
    var nc = Object.keys(o19.mesh.userData.creases || {}).length;
    log('19.creases_travel', nc === 4
      ? 'one crease on the original became 4 - one on each copy, moved to where that copy is'
      : 'CREASES DID NOT TRAVEL: ' + nc + ' entries after arraying x4, expected 4');

    // 20. refusals are refusals, not silent successes
    var o20 = fresh('B20');
    var r1 = k.arrayOp(o20, 1, 'line', 1.5, 'x');
    log('20.count_one_refuses', r1 === false
      ? 'a count of 1 is refused rather than reported as a success over an untouched mesh'
      : 'COUNT 1 CLAIMED SUCCESS');

    // 21. a ring under uneven scale is refused rather than skewed
    var o21 = fresh('B21', new THREE.Vector3(4, 0, 0));
    o21.mesh.scale.set(2, 1, 1);
    o21.mesh.updateMatrixWorld();
    var r21 = k.arrayOp(o21, 6, 'ring', 360, 'y');
    log('21.uneven_scale', r21 === false
      ? 'refused - rotating in local space under 2,1,1 would shear every copy'
      : 'IT BUILT SKEWED COPIES under non-uniform scale');

    log('console.errors', errs.length ? errs.join(' | ').slice(0, 300) : 'none');
  }

  var posted = false;
  function post() {
    if (posted) return;
    posted = true;
    try { fetch('/result', { method: 'POST', body: out.join('\n') }); }
    catch (e) { /* nothing else to try */ }
  }
  /* A WATCHDOG, because "NO PROBE OUTPUT (timed out)" says nothing at all
     about where it stopped. If main hangs, send whatever has been logged so
     far - the last line that made it IS the bisection. */
  setTimeout(function () {
    if (!posted) { out.push('WATCHDOG=main did not finish - the last line above is where it hung'); post(); }
  }, 30000);
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
        try { main(); }
        catch (e) { out.push('ERROR=' + (e && e.stack ? e.stack.split('\n').slice(0, 8).join(' / ') : e)); }
        post();
      }, 800);
    });
  }, 400);
})();
