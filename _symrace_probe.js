/* THE OLD MAP BESIDE THE NEW ONE (a2.88). The scan buildSymmetryMap used to
   do is re-implemented here, verbatim, and run on the same geometry as the
   shipped one. The interesting line is the DIFF, not the clock: same answer
   or the speed is worth nothing. */
(function () {
  var out = [], errs = [];
  var _ce = console.error;
  console.error = function () { errs.push(Array.prototype.join.call(arguments, ' ')); _ce.apply(console, arguments); };
  function log(kk, v) { out.push(kk + '=' + v); }
  function verdict(c, good, bad) { return c ? ' - ' + good : ' ' + bad; }

  function main() {
    var k = window.__kubik, A = k.App, THREE = k.THREE;

    /* THE IMPLEMENTATION a2.88 REPLACED, character for character from
       `git show HEAD:index.html`, so this is the old answer and not a
       reconstruction of what the old answer ought to have been. */
    function oldMap(obj, axis) {
      var topo = obj.mesh.userData.topo;
      if (!topo || !topo.logicalCount) return new Map();
      var pts = [];
      for (var l = 0; l < topo.logicalCount; l++) pts.push(k.logicalPos(obj, l));
      var size = new THREE.Box3().setFromPoints(pts).getSize(new THREE.Vector3());
      var tol = Math.max(size.x, size.y, size.z, 1) * 1e-3;
      var tol2 = tol * tol;
      var off = k.symmetryPlane(obj, axis).offset;
      var map = new Map();
      var m = new THREE.Vector3();
      for (var l2 = 0; l2 < topo.logicalCount; l2++) {
        m.copy(pts[l2]);
        m[axis] = 2 * off - m[axis];
        var best = -1, bestD = tol2;
        for (var q = 0; q < pts.length; q++) {
          var d = m.distanceToSquared(pts[q]);
          if (d < bestD) { bestD = d; best = q; }
        }
        if (best >= 0) map.set(l2, best);
      }
      return map;
    }

    function same(a, b) {
      if (a.size !== b.size) return 'sizes differ: ' + a.size + ' vs ' + b.size;
      var bad = 0, first = null;
      a.forEach(function (v, key) {
        if (b.get(key) !== v) {
          bad++;
          if (!first) first = 'vertex ' + key + ': old ' + v + ', new ' + b.get(key);
        }
      });
      return bad ? bad + ' of ' + a.size + ' differ (' + first + ')' : null;
    }

    function prim(kind, name, h, v) {
      var def = Object.assign({}, k.PRIM_SPECS[kind].def);
      if (h) def.h = h;
      if (v) def.v = v;
      var o = k.createPrimitiveObject(kind, def, name, new THREE.Vector3(0, 0, 0));
      A.selectedObjectIds = new Set([o.id]);
      A.activeObjectId = o.id;
      k.setMode('object');
      k.refreshUI();
      k.ensureHelpers(o);
      return o;
    }

    // Warm both, or the first number measures the compiler (a2.82).
    var w = prim('sphere', 'W', 8, 6);
    for (var i = 0; i < 3; i++) { oldMap(w, 'x'); k.buildSymmetryMap(w, 'x'); }

    /* PRIM_SPECS CLAMPS h AND v, so asking for a 180x120 sphere returns the
       same 1,986 logical vertices a 72x48 does - the second cut of this
       probe "reached import sizes" by asking for them and never checking
       that it got them. The primitives cover the SHAPES; the grid built by
       hand below covers the SIZE. */
    var cases = [
      ['sphere', 12, 8], ['sphere', 24, 16], ['sphere', 48, 32], ['sphere', 72, 48],
      ['cylinder', 24, 4], ['torus', 32, 16], ['cube', 0, 0], ['plane', 16, 16]
    ];
    var mismatches = 0, n = 0;
    cases.forEach(function (c) {
      ['x', 'y', 'z'].forEach(function (axis) {
        var o = prim(c[0], c[0][0] + c[1] + axis, c[1], c[2]);
        var V = o.mesh.userData.topo.logicalCount;

        var t0 = performance.now(); var a = oldMap(o, axis); var t1 = performance.now();
        var t2 = performance.now(); var b = k.buildSymmetryMap(o, axis); var t3 = performance.now();

        var bad = same(a, b);
        n++;
        if (bad) mismatches++;
        if (axis === 'x' || bad) {
          var paired = 0;
          a.forEach(function (val, key) { if (val !== key) paired++; });
          log(c[0] + '.' + V + '.' + axis,
            'scan ' + (t1 - t0).toFixed(1) + 'ms -> grid ' + (t3 - t2).toFixed(1) + 'ms' +
            (t3 - t2 > 0.05 ? ' (' + ((t1 - t0) / (t3 - t2)).toFixed(1) + 'x)' : '') +
            ', ' + Math.round(paired / 2) + ' pairs' +
            (bad ? ' -- ' + bad : ' - identical'));
        }
      });
    });

    /* THE SIZE THE FEATURE HAS TO SURVIVE. A grid of N x N quads, centred so
       the x reflection has a real partner for every vertex. This is where
       O(V^2) stops being a curiosity: the whole reason a2.88 exists is the
       claim that an imported mesh costs seconds per map, and a claim like
       that is worth measuring rather than asserting. */
    function bigGrid(name, N) {
      var pos = [], tri = [], i, j;
      for (j = 0; j <= N; j++) {
        for (i = 0; i <= N; i++) {
          pos.push((i / N - 0.5) * 4, 0, (j / N - 0.5) * 4);
        }
      }
      var idx = function (a, b) { return b * (N + 1) + a; };
      for (j = 0; j < N; j++) {
        for (i = 0; i < N; i++) {
          tri.push([idx(i, j), idx(i, j + 1), idx(i + 1, j + 1)]);
          tri.push([idx(i, j), idx(i + 1, j + 1), idx(i + 1, j)]);
        }
      }
      var o = k.createObjectFromEditable(name, new THREE.Vector3(0, 0, 0),
        { positions: pos, groups: [{ triangles: tri }] },
        [new THREE.MeshStandardMaterial({ color: 0x888888 })], {});
      A.activeObjectId = o.id; A.selectedObjectIds = new Set([o.id]);
      k.setMode('object'); k.refreshUI(); k.ensureHelpers(o);
      return o;
    }

    [40, 80, 120].forEach(function (N) {
      var g = bigGrid('G' + N, N);
      var V = g.mesh.userData.topo.logicalCount;
      var s0 = performance.now(); var ga = oldMap(g, 'x'); var s1 = performance.now();
      var s2 = performance.now(); var gb = k.buildSymmetryMap(g, 'x'); var s3 = performance.now();
      var gbad = same(ga, gb);
      n++;
      if (gbad) mismatches++;
      log('grid.' + V, 'scan ' + (s1 - s0).toFixed(0) + 'ms -> grid ' +
        (s3 - s2).toFixed(1) + 'ms (' + ((s1 - s0) / Math.max(s3 - s2, 0.01)).toFixed(0) +
        'x), seven maps: ' + ((s1 - s0) * 7 / 1000).toFixed(1) + 's -> ' +
        ((s3 - s2) * 7).toFixed(0) + 'ms' + (gbad ? ' -- ' + gbad : ' - identical'));
    });

    log('ANSWERS', n + ' maps across 8 shapes, 3 axes and 3 grid sizes, ' + mismatches + ' mismatched' +
      verdict(mismatches === 0,
        'the grid gives the scan\'s answer everywhere',
        'THE GRID CHANGED THE ANSWER - the speed is worth nothing'));

    /* A SHAPE WITH NO PARTNERS. An asymmetric mesh must still come back with
       the same map - mostly empty - rather than the grid inventing pairs the
       scan would have rejected as outside the tolerance. */
    var ed = {
      positions: [0, 0, 0, 1, 0, 0, 1, 0, 1, 0, 0, 1, 0.37, 0.9, 0.21],
      groups: [{ triangles: [[0, 2, 1], [0, 3, 2], [0, 4, 3]] }]
    };
    var odd = k.createObjectFromEditable('Odd', new THREE.Vector3(0, 0, 0), ed,
      [new THREE.MeshStandardMaterial({ color: 0x888888 })], {});
    A.activeObjectId = odd.id; A.selectedObjectIds = new Set([odd.id]);
    k.setMode('object'); k.refreshUI(); k.ensureHelpers(odd);
    var oa = oldMap(odd, 'x'), ob = k.buildSymmetryMap(odd, 'x');
    var oddBad = same(oa, ob);
    log('asymmetric', 'old ' + oa.size + ' entries, new ' + ob.size +
      verdict(!oddBad, 'the same sparse answer, no invented pairs',
        'DIFFERS ON AN ASYMMETRIC MESH: ' + oddBad));

    log('console.errors', errs.length ? errs.join(' | ').slice(0, 250) : 'none');
  }

  var posted = false;
  function post() {
    if (posted) return;
    posted = true;
    try { fetch('/result', { method: 'POST', body: out.join('\n') }); } catch (e) {}
  }
  setTimeout(function () { if (!posted) { out.push('WATCHDOG'); post(); } }, 90000);
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
