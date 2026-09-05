/* WHAT DOES buildSymmetryMap COST? It finds each vertex's mirror partner by
   scanning every vertex - O(V^2). Multi-axis symmetry needs up to seven of
   these maps instead of one, so the answer decides whether the feature can
   be built on it as it stands. Sizes are logical vertices, warmed first. */
(function () {
  var out = [], errs = [];
  var _ce = console.error;
  console.error = function () { errs.push(Array.prototype.join.call(arguments, ' ')); _ce.apply(console, arguments); };
  function log(kk, v) { out.push(kk + '=' + v); }

  function main() {
    var k = window.__kubik, A = k.App, THREE = k.THREE;

    function sphere(name, h, v) {
      var def = Object.assign({}, k.PRIM_SPECS.sphere.def);
      if (h) def.h = h;
      if (v) def.v = v;
      var o = k.createPrimitiveObject('sphere', def, name, new THREE.Vector3(0, 0, 0));
      A.selectedObjectIds = new Set([o.id]);
      A.activeObjectId = o.id;
      k.setMode('object');
      k.refreshUI();
      k.ensureHelpers(o);
      return o;
    }

    // Warm the JIT before any number is believed - a2.82's first race said
    // the new loop was five times slower at 48 triangles. Cold JIT.
    var warm = sphere('W', 8, 6);
    for (var w = 0; w < 3; w++) k.buildSymmetryMap(warm, 'x');

    [[12, 8], [24, 16], [48, 32], [72, 48]].forEach(function (hv) {
      var o = sphere('S' + hv[0], hv[0], hv[1]);
      var topo = o.mesh.userData.topo;
      var V = topo ? topo.logicalCount : 0;
      var t0 = performance.now();
      var m = k.buildSymmetryMap(o, 'x');
      var t1 = performance.now();
      var paired = 0;
      m.forEach(function (val, key) { if (val !== key) paired++; });
      log('size.' + V, 'one map ' + (t1 - t0).toFixed(1) + 'ms, ' +
        Math.round(paired / 2) + ' pairs, x7 for three axes = ' +
        ((t1 - t0) * 7).toFixed(0) + 'ms');
    });

    log('console.errors', errs.length ? errs.join(' | ').slice(0, 200) : 'none');
  }

  var posted = false;
  function post() {
    if (posted) return;
    posted = true;
    try { fetch('/result', { method: 'POST', body: out.join('\n') }); } catch (e) {}
  }
  setTimeout(function () { if (!posted) { out.push('WATCHDOG'); post(); } }, 60000);
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
      }, 800);
    });
  }, 400);
})();
