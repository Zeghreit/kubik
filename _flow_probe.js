/* Set flow (a2.34), measured against shapes whose answer is known first.

   The ribbon: five loops of two vertices, sitting exactly on a circle of
   radius 2 in the XY plane, extruded along Z. Flatten the middle loop and
   the right answer is "put it back on the circle" - checkable to a number,
   not to an eye. */
(function () {
  var out = [], errs = [];
  var _ce = console.error;
  console.error = function () { errs.push(Array.prototype.join.call(arguments, ' ')); _ce.apply(console, arguments); };
  function log(k, v) { out.push(k + '=' + v); }
  function K() { return window.__kubik; }

  var R = 2, ANG = [-40, -20, 0, 20, 40];

  var ROWS = 4, ZS = [-1.5, -0.5, 0.5, 1.5];
  function ribbon(flattenMiddle) {
    var pos = [], groups = [];
    for (var i = 0; i < ANG.length; i++) {
      var a = ANG[i] * Math.PI / 180;
      var x = R * Math.sin(a), y = R * Math.cos(a);
      for (var j = 0; j < ROWS; j++) pos.push(x, y, ZS[j]);
    }
    if (flattenMiddle) {
      // The middle loop, moved to the CHORD between its neighbours - which
      // is exactly where Set flow at 0 should leave it.
      for (var j2 = 0; j2 < ROWS; j2++) {
        var i1 = (1 * ROWS + j2) * 3, i3 = (3 * ROWS + j2) * 3, i2 = (2 * ROWS + j2) * 3;
        pos[i2] = (pos[i1] + pos[i3]) / 2;
        pos[i2 + 1] = (pos[i1 + 1] + pos[i3 + 1]) / 2;
        pos[i2 + 2] = (pos[i1 + 2] + pos[i3 + 2]) / 2;
      }
    }
    for (var q = 0; q < ANG.length - 1; q++) {
      for (var r = 0; r < ROWS - 1; r++) {
        var a0 = q * ROWS + r, b0 = q * ROWS + r + 1;
        var c0 = (q + 1) * ROWS + r + 1, d0 = (q + 1) * ROWS + r;
        groups.push({ triangles: [[a0, b0, c0], [a0, c0, d0]] });
      }
    }
    return { positions: pos, groups: groups };
  }
  // A face of the grid, by which loop gap and which row it spans.
  function faceAt(q, r) { return q * (ROWS - 1) + r; }

  function plane() {                       // 3x3 quads, dead flat
    var pos = [], groups = [];
    for (var r = 0; r < 4; r++) for (var c = 0; c < 4; c++) pos.push((c - 1.5), 0, (r - 1.5));
    for (var rr = 0; rr < 3; rr++) for (var cc = 0; cc < 3; cc++) {
      var a = rr * 4 + cc, b = rr * 4 + cc + 1, d = (rr + 1) * 4 + cc + 1, e = (rr + 1) * 4 + cc;
      groups.push({ triangles: [[a, b, d], [a, d, e]] });
    }
    return { positions: pos, groups: groups };
  }

  var k, A, obj, objId;
  function build(ed) {
    k.rebuildFromEditable(obj, ed);
    k.ensureHelpers(obj);
  }
  function P(l) { return k.logicalPos(obj, l); }
  function topo() { return obj.mesh.userData.topo; }
  // The logical id nearest a point, so a test can name a vertex by where it is.
  function at(x, y, z) {
    var t = topo(), best = -1, bd = 1e9;
    for (var l = 0; l < t.logicalCount; l++) {
      var p = P(l), d = (p.x - x) * (p.x - x) + (p.y - y) * (p.y - y) + (p.z - z) * (p.z - z);
      if (d < bd) { bd = d; best = l; }
    }
    return best;
  }
  function edgeBetween(la, lb) {
    var e = topo().edges;
    for (var i = 0; i < e.length; i++) {
      if ((e[i][0] === la && e[i][1] === lb) || (e[i][0] === lb && e[i][1] === la)) return i;
    }
    return -1;
  }
  // Distance from the circle's centre, which is the whole point of the ribbon.
  function radiusOf(l) { var p = P(l); return Math.sqrt(p.x * p.x + p.y * p.y); }
  // Every edge running ALONG one loop, named by where the loop sits.
  function loopEdges(x, y) {
    var ids = ZS.map(function (z) { return at(x, y, z); }), out = [];
    for (var i = 0; i + 1 < ids.length; i++) {
      var e = edgeBetween(ids[i], ids[i + 1]);
      if (e >= 0) out.push(e);
    }
    return out;
  }

  function runFlow(amount) {
    k.setFlowSelection();
    if (!A.pendingOp) return 'REFUSED: ' + (document.getElementById('toast') || {}).textContent;
    k.setPendingAmount(amount);
    k.confirmPendingOp();
    return null;
  }

  function main() {
    k = K(); A = k.App;
    objId = A.activeObjectId || Array.from(A.selectedObjectIds)[0];
    obj = k.findObject(objId);
    A.activeObjectId = objId;
    A.symmetry = false;

    /* ---- 1. A flat surface implies a straight line: nothing may move ---- */
    build(plane());
    A.mode = 'edge';
    var c0 = at(-0.5, 0, -1.5), c1 = at(-0.5, 0, 1.5);   // a whole column
    // the three edges of the middle column, end to end
    var col = [at(-0.5, 0, -1.5), at(-0.5, 0, -0.5), at(-0.5, 0, 0.5), at(-0.5, 0, 1.5)];
    var sel = [];
    for (var i = 0; i + 1 < col.length; i++) {
      var e = edgeBetween(col[i], col[i + 1]);
      if (e >= 0) sel.push(e);
    }
    A.selectedElements = new Set(sel);
    var beforeY = col.map(function (l) { return P(l).y; });
    var r1 = runFlow(1);
    var movedFlat = col.map(function (l, n) { return Math.abs(P(l).y - beforeY[n]); })
      .reduce(function (a, b) { return Math.max(a, b); }, 0);
    log('1.flat.edges', sel.length + ' selected' + (r1 ? ' | ' + r1 : ''));
    log('1.flat.maxmove', movedFlat.toFixed(6) + '  (must be 0)');

    /* ---- 2. Amount 0 IS Maya's flat transition: the midpoint ---- */
    build(ribbon(false));
    A.mode = 'edge';
    var m0 = at(0, R, -0.5), m1 = at(0, R, 0.5);            // the middle loop
    var n1a = at(R * Math.sin(-20 * Math.PI / 180), R * Math.cos(-20 * Math.PI / 180), -0.5);
    var n3a = at(R * Math.sin(20 * Math.PI / 180), R * Math.cos(20 * Math.PI / 180), -0.5);
    var wantMid = P(n1a).clone().add(P(n3a)).multiplyScalar(0.5);
    A.selectedElements = new Set(loopEdges(0, R));
    var r2 = runFlow(0);
    var gotMid = P(at(wantMid.x, wantMid.y, -0.5));
    log('2.amount0', (r2 ? r2 : 'landed ' + gotMid.distanceTo(wantMid).toFixed(6) +
      ' from the midpoint of its neighbours  (must be 0)'));

    /* ---- 3. Amount 1 puts a flattened loop back on the circle ---- */
    build(ribbon(true));
    A.mode = 'edge';
    var f0 = at(0, 0, -0.5), f1 = at(0, 0, 0.5);
    // the flattened middle loop sits at the chord, so look for it there
    var chordY = R * Math.cos(20 * Math.PI / 180);
    f0 = at(0, chordY, -0.5); f1 = at(0, chordY, 0.5);
    var rFlat = radiusOf(f0);
    A.selectedElements = new Set(loopEdges(0, chordY));
    var r3 = runFlow(1);
    var after = at(0, R, -0.5);
    log('3.flattened.radius', r3 ? r3 : rFlat.toFixed(4) + ' -> ' + radiusOf(after).toFixed(4) +
      '  (target ' + R.toFixed(4) + ', error ' + Math.abs(radiusOf(after) - R).toFixed(4) + ')');

    /* ---- 4. It is monotone, and 2 over-bends past the surface ---- */
    var rads = [];
    [0, 0.5, 1, 2].forEach(function (amt) {
      build(ribbon(true));
      A.mode = 'edge';
      var a0 = at(0, chordY, -0.5), a1 = at(0, chordY, 0.5);
      A.selectedElements = new Set(loopEdges(0, chordY));
      runFlow(amt);
      rads.push(radiusOf(at(0, R * 1.2, -0.5)).toFixed(4));
    });
    log('4.radius.by.amount', '0:' + rads[0] + '  0.5:' + rads[1] + '  1:' + rads[2] + '  2:' + rads[3]);

    /* ---- 5. Vertex mode reads the same loop ---- */
    build(ribbon(true));
    A.mode = 'vertex';
    var v0 = at(0, chordY, -0.5), v1 = at(0, chordY, 0.5);
    A.selectedElements = new Set(ZS.map(function (z) { return at(0, chordY, z); }));
    var r5 = runFlow(1);
    log('5.vertex.mode', r5 ? r5 : 'radius ' + radiusOf(at(0, R, -0.5)).toFixed(4) +
      '  (target ' + R.toFixed(4) + ')');

    /* ---- 6. Face mode flows the RIM of the patch ---- */
    build(ribbon(true));
    k.ensureHelpers(obj);
    A.mode = 'face';
    // the two quads either side of the flattened loop, so its loop is the rim
    /* ONE column of faces, on one side of the flattened loop, so that loop
       IS the patch's rim - and the mesh on the far side of it is what the
       rim has to curve toward. A patch straddling the loop would make it
       interior instead, and a patch one face wide would leave its rim with
       nothing on the inside. */
    A.selectedElements = new Set([faceAt(2, 0), faceAt(2, 1), faceAt(2, 2)]);
    var beforeR6 = radiusOf(at(0, chordY, -0.5));
    var r6 = runFlow(1);
    log('6.face.rim', r6 ? r6 : 'rim moved: ' + beforeR6.toFixed(4) + ' -> ' +
      radiusOf(at(0, R, -0.5)).toFixed(4));

    /* ---- 7. Loop cut, with the Flow switch off and on ---- */
    function cutAt(flow) {
      build(ribbon(false));
      k.ensureHelpers(obj);
      A.mode = 'edge';
      // a RING edge: one running across the loops, between loop 1 and loop 2
      var p1 = P(at(R * Math.sin(-20 * Math.PI / 180), R * Math.cos(-20 * Math.PI / 180), -0.5));
      var e = edgeBetween(at(p1.x, p1.y, -0.5), at(0, R, -0.5));
      A.selectedElements = new Set([e]);
      k.edgeLoopSelection();
      if (!A.pendingOp) return { err: 'no bar: ' + (document.getElementById('toast') || {}).textContent };
      var wasFlow = !!A.pendingOp.flow;
      if (flow) A.pendingOp.flow = true;
      k.applyPendingOp();
      k.confirmPendingOp();
      k.ensureHelpers(obj);
      // the new loop sits half way round between -20 and 0 degrees
      var mid = -10 * Math.PI / 180;
      var want = { x: R * Math.sin(mid), y: R * Math.cos(mid) };
      var l = at(want.x, want.y, -0.5);
      return { defaultFlow: wasFlow, radius: radiusOf(l), chord: Math.sqrt(want.x * want.x + want.y * want.y) };
    }
    var off = cutAt(false), on = cutAt(true);
    log('7.loopcut.flow.default', off.err ? off.err : String(off.defaultFlow) + '  (must be false)');
    log('7.loopcut.off', off.err ? off.err : 'radius ' + off.radius.toFixed(4));
    log('7.loopcut.on', on.err ? on.err : 'radius ' + on.radius.toFixed(4) +
      '  (target ' + R.toFixed(4) + ')');

    /* ---- 8. The bar carries the switch, and only for Loop cut ---- */
    build(ribbon(false));
    A.mode = 'edge';
    A.selectedElements = new Set([0]);
    k.setFlowSelection();
    var wrapFlow = document.getElementById('opToggleWrap').style.display;
    if (A.pendingOp) k.cancelPendingOp();
    log('8.toggle.on.setflow', wrapFlow === 'none' ? 'hidden, correct' : 'SHOWN: ' + wrapFlow);

    log('console.errors', errs.length ? errs.join(' | ').slice(0, 400) : 'none');
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
        try { main(); } catch (e) { out.push('ERROR=' + (e && e.stack ? e.stack.split('\n').slice(0, 5).join(' / ') : e)); }
        finish();
      }, 600);
    });
  }, 300);
})();
