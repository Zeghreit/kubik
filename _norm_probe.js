/* Builds the same battery of models twice - once under the shipped file and
   once under HEAD - and reports, per model, a digest of every normal it
   produced. _norm_probe.py runs both and diffs the two reports, so a2.83's
   claim "the answer is unchanged except where it was black" is checked as an
   ANSWER, not as a timing. */
(function () {
  var out = [], errs = [];
  var _ce = console.error;
  console.error = function () { errs.push(Array.prototype.join.call(arguments, ' ')); _ce.apply(console, arguments); };
  function log(k, v) { out.push(k + '=' + v); }
  var k, A, THREE;

  function digest(o) {
    var n = o.mesh.geometry.attributes.normal;
    if (!n) return 'NO NORMAL ATTRIBUTE';
    var zeros = 0, nonUnit = 0, sum = 0;
    for (var i = 0; i < n.count; i++) {
      var x = n.getX(i), y = n.getY(i), z = n.getZ(i);
      var L = Math.sqrt(x * x + y * y + z * z);
      if (!isFinite(L)) { nonUnit++; continue; }
      if (L < 1e-6) zeros++;
      else if (Math.abs(L - 1) > 1e-4) nonUnit++;
      sum += Math.round(x * 1e6) + 2 * Math.round(y * 1e6) + 3 * Math.round(z * 1e6);
    }
    return n.count + 'v zero:' + zeros + ' nonUnit:' + nonUnit + ' sum:' + sum;
  }

  var rows = [];
  function measure(label, o) {
    if (!o) { rows.push(label + ' = NOT BUILT'); return; }
    k.applyShading(o);
    rows.push(label + ' = ' + digest(o));
  }

  function fresh(name) {
    var o = k.createCubeObject(name, new THREE.Vector3(0, 0, 0));
    A.selectedObjectIds = new Set([o.id]);
    A.activeObjectId = o.id;
    k.refreshUI();
    return o;
  }
  function sub(o) {
    k.setMode('object');
    A.selectedObjectIds = new Set([o.id]);
    A.activeObjectId = o.id;
    A.selectedElements = new Set();
    k.subdivideSelection();
    if (!A.pendingOp) return false;
    k.flushPendingApply();
    k.confirmPendingOp();
    return true;
  }

  function main() {
    k = window.__kubik; A = k.App; THREE = k.THREE;

    measure('cube', fresh('c'));
    var sm = fresh('s'); sub(sm); sub(sm);
    measure('cube.sub2', sm);

    var kinds = [];
    try { kinds = Object.keys(k.PRIM_SPECS || {}); } catch (e) { }
    kinds.sort().forEach(function (kind) {
      var spec = k.PRIM_SPECS[kind], def = {};
      for (var f in (spec.def || {})) def[f] = spec.def[f];
      var o = null;
      try { o = k.createPrimitiveObject(kind, def, kind, new THREE.Vector3(0, 0, 0)); } catch (e) { }
      measure('prim.' + kind, o);
    });

    measure('plane.open', k.createObjectFromEditable('p', new THREE.Vector3(0, 0, 0), {
      positions: [0, 0, 0, 1, 0, 0, 1, 0, 1, 0, 0, 1],
      groups: [{ triangles: [[0, 1, 2], [0, 2, 3]] }]
    }, k.makeMaterialSet(1), {}));

    /* THE FIXTURE THE CHANGE IS ABOUT. One face group, two triangles wound
       against each other, so at every corner the island's summed triangle
       normal is exactly zero. Under a2.82 all three vertices came out
       (0,0,0) - black - because the baseline that was supposed to cover this
       cancelled too. Under a2.83 they must be unit vectors. */
    var fin = null;
    try {
      fin = k.createObjectFromEditable('fin', new THREE.Vector3(0, 0, 0), {
        positions: [0, 0, 0, 1, 0, 0, 0, 0, 1],
        groups: [{ triangles: [[0, 1, 2], [0, 2, 1]] }]
      }, k.makeMaterialSet(1), {});
    } catch (e) { errs.push('fin: ' + e); }
    measure('fin.folded', fin);

    var fan = null;
    try {
      fan = k.createObjectFromEditable('fan', new THREE.Vector3(0, 0, 0), {
        positions: [0, 0, 0, 1, 0, 0, 0, 0, 1, -1, 0, 0, 0, 0, -1, 0, 1, 0],
        groups: [
          { triangles: [[0, 1, 2], [0, 2, 1]] },
          { triangles: [[0, 3, 4], [0, 4, 5]] }
        ]
      }, k.makeMaterialSet(2), {});
    } catch (e) { errs.push('fan: ' + e); }
    measure('fin.beside_live_fan', fan);

    function opCase(label, mode, sel, go) {
      var o = fresh('op' + label);
      sub(o); sub(o);
      try {
        k.setMode(mode);
        A.selectedObjectIds = new Set([o.id]);
        A.activeObjectId = o.id;
        k.ensureHelpers(o);
        A.selectedElements = new Set(sel);
        go(o);
        if (A.pendingOp) { k.flushPendingApply(); k.confirmPendingOp(); }
      } catch (e) { rows.push('op.' + label + ' = THREW ' + e); return; }
      measure('op.' + label, o);
    }
    opCase('extrude', 'face', [0], function () { k.extrudeSelection(); k.setPendingAmount(0.4); });
    opCase('inset', 'face', [0, 1], function () { k.insetSelection(); k.setPendingAmount(0.2); });
    opCase('bevel', 'edge', [0], function () { k.bevelSelection(); k.setPendingAmount(0.1); });
    opCase('subdivide', 'object', [], function () { k.subdivideSelection(); });
    opCase('solidify', 'object', [], function () { k.solidifySelection(); k.setPendingAmount(0.1); });
    opCase('array', 'object', [], function () { k.arraySelection(); k.setPendingAmount(1.5); });
    opCase('cleanup', 'object', [], function () { k.cleanupSelection(); });
    opCase('crease', 'edge', [0, 1, 2], function () { k.creaseSelection(); });
    opCase('slide', 'edge', [4], function () { k.slideSelection(); k.setPendingAmount(0.3); });

    rows.forEach(function (r) { log('m.' + r.split(' = ')[0], r.split(' = ').slice(1).join(' = ')); });
    log('console.errors', errs.length ? errs.join(' | ').slice(0, 300) : 'none');
  }

  var posted = false;
  function post() {
    if (posted) return;
    posted = true;
    try { fetch('/result', { method: 'POST', body: out.join('\n') }); } catch (e) { }
  }
  setTimeout(function () {
    if (!posted) { out.push('WATCHDOG=main did not finish'); post(); }
  }, 60000);
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
