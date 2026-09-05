/* Target weld by gesture (a2.35): tap a vertex, double-tap another.

   Driven through the REAL handleTap / handleDoubleTap with synthetic
   {clientX, clientY} aimed at the projected vertices, so the anchor, the
   near-miss forgiveness and the double-tap branch are all exercised rather
   than bypassed. */
(function () {
  var out = [], errs = [];
  var _ce = console.error;
  console.error = function () { errs.push(Array.prototype.join.call(arguments, ' ')); _ce.apply(console, arguments); };
  function log(k, v) { out.push(k + '=' + v); }
  function K() { return window.__kubik; }

  var k, A, objId, obj;
  function topo() { return obj.mesh.userData.topo; }
  function counts() {
    var t = topo();
    return t.faceGroups.length + 'f/' + t.logicalCount + 'v/' + t.edges.length + 'e';
  }
  function P(l) { return k.logicalPos(obj, l); }
  function fresh() { obj = k.findObject(objId); k.ensureHelpers(obj); }

  // A tap aimed at where a vertex actually is on screen.
  function evAt(l) {
    var r = k.renderer.domElement.getBoundingClientRect();
    var p = k.worldToScreenPx(obj.mesh.localToWorld(P(l).clone()));
    if (!p) return null;
    return { clientX: p.x + r.left, clientY: p.y + r.top };
  }
  function nearest(x, y, z) {
    var t = topo(), best = -1, bd = 1e9;
    for (var l = 0; l < t.logicalCount; l++) {
      var p = P(l), d = (p.x - x) * (p.x - x) + (p.y - y) * (p.y - y) + (p.z - z) * (p.z - z);
      if (d < bd) { bd = d; best = l; }
    }
    return { l: best, d: Math.sqrt(bd) };
  }
  function has(x, y, z) { return nearest(x, y, z).d < 1e-4; }

  function tap(l) { var e = evAt(l); if (e) k.handleTap(e); return e; }
  function doubleTap(l) {
    var e = evAt(l);
    if (!e) return null;
    k.handleTap(e);          // the first tap of the pair, as the real one does
    k.handleDoubleTap(e);
    return e;
  }

  function main() {
    k = K(); A = k.App;
    objId = A.activeObjectId || Array.from(A.selectedObjectIds)[0];
    A.activeObjectId = objId;
    fresh();
    A.symmetry = false;
    A.mode = 'vertex';
    var snap = k.captureObjectState(obj);
    log('cube', counts());

    function reset() {
      obj = k.findObject(objId);
      if (!obj) { k.restoreDoc(doc0, {}); objId = A.objects[0].id; obj = k.findObject(objId); }
      k.restoreObjectState(obj, snap);
      k.ensureHelpers(obj);
      A.mode = 'vertex';
      A.activeObjectId = objId;
      A.selectedElements = new Set();
      A.vertAnchor = null;
      k.pushHistory();
    }
    var doc0 = k.serializeDoc();

    /* ---- 1. tap A, double-tap B: A lands ON B, B does not move ---- */
    reset();
    // two corners sharing an edge of the default cube
    var a = nearest(-0.5, 0.5, 0.5).l, b = nearest(0.5, 0.5, 0.5).l;
    var pa = P(a).clone(), pb = P(b).clone();
    var h0 = A.historyIndex;
    var e1 = tap(a);
    log('1.first.tap', e1 ? 'selected ' + Array.from(A.selectedElements).join(',') +
      '  anchor:' + JSON.stringify(A.vertAnchor) : 'COULD NOT PROJECT');
    doubleTap(b);
    fresh();
    log('1.after', counts() + '  history:+' + (A.historyIndex - h0));
    log('1.target.held', has(pb.x, pb.y, pb.z) ? 'B still exactly where it was' : 'B MOVED');
    log('1.source.gone', has(pa.x, pa.y, pa.z) ? 'A IS STILL THERE' : 'A gone');
    var mid = pa.clone().add(pb).multiplyScalar(0.5);
    log('1.not.midpoint', has(mid.x, mid.y, mid.z) ? 'LANDED IN THE MIDDLE (wrong)' : 'nothing at the midpoint');
    log('1.winding', k.auditWinding(obj).ok ? 'ok' : JSON.stringify(k.auditWinding(obj)));
    log('1.selected', A.selectedElements.size + ' selected' +
      (A.selectedElements.size === 1 && has(pb.x, pb.y, pb.z) ? ' (the survivor)' : ''));

    /* ---- 2. undo puts both back ---- */
    k.undo();
    fresh();
    log('2.undo', counts() + (has(pa.x, pa.y, pa.z) && has(pb.x, pb.y, pb.z) ? '  both back' : '  WRONG'));

    /* ---- 3. the ring Weld still melts to the middle ---- */
    reset();
    A.selectedElements = new Set([a, b]);
    k.weldSelection();
    fresh();
    log('3.ring.weld', has(mid.x, mid.y, mid.z) ? 'melted to the middle, as before' : 'CHANGED BEHAVIOUR');

    /* ---- 4. no anchor: a double-tap is still Focus, not a weld ---- */
    reset();
    var before4 = counts();
    doubleTap(b);
    fresh();
    log('4.no.anchor', counts() === before4 ? 'nothing welded, correct' : 'WELDED WITH NO ANCHOR');

    /* ---- 5. the same vertex twice never welds ---- */
    reset();
    tap(a);
    doubleTap(a);
    fresh();
    log('5.same.vertex', counts() === before4 ? 'nothing welded, correct' : 'WELDED ONTO ITSELF');

    /* ---- 6. symmetry welds the mirrored pair too ---- */
    reset();
    /* a2.89: the axis became a SET. Written as a one-element set here so
       these sections keep meaning exactly what they meant before. */
    A.symmetryAxes = ['x'];
    A.symmetry = true;
    var h6 = A.historyIndex, c6 = counts();
    tap(nearest(-0.5, 0.5, 0.5).l);
    doubleTap(nearest(-0.5, 0.5, -0.5).l);
    fresh();
    log('6.symmetry', c6 + ' -> ' + counts() + '  history:+' + (A.historyIndex - h6));
    log('6.both.sides', (!has(-0.5, 0.5, 0.5) && !has(0.5, 0.5, 0.5))
      ? 'both sides welded' : 'ONE SIDE ONLY');
    A.symmetry = false;

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
