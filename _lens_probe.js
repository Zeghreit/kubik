/* HOW PARALLEL IS THE LONG LENS, REALLY? Two rails that ARE parallel in the
   world, at different depths; engage the flat view through the pill; read
   the angle between them on screen. Zero is parallel.

   IT WAITS TWO FRAMES AFTER THE TAP. `project` reads matrixWorldInverse,
   which only the renderer refreshes. Measuring synchronously after the tap
   compares a STALE view matrix against the NEW projection matrix - a
   uniform scale, which preserves angles exactly, so the first version of
   this reported the emulated flat view as no more parallel than the lens.
   It was reading a picture that had not been drawn yet. */
(function () {
  var out = [], errs = [];
  var _ce = console.error;
  console.error = function () { errs.push(Array.prototype.join.call(arguments, ' ')); _ce.apply(console, arguments); };
  function log(kk, v) { out.push(kk + '=' + v); }

  function main(done) {
    var k = window.__kubik, THREE = k.THREE;
    var el = document.getElementById('viewport') ||
             document.querySelector('canvas').parentElement;

    function px(p) {
      var v = new THREE.Vector3(p[0], p[1], p[2]).project(k.camera);
      var r = el.getBoundingClientRect();
      return { x: (v.x * 0.5 + 0.5) * r.width, y: (-v.y * 0.5 + 0.5) * r.height };
    }
    function ang(a, b) {
      var p = px(a), q = px(b);
      return Math.atan2(q.y - p.y, q.x - p.x) * 180 / Math.PI;
    }
    function gap() {
      var d = Math.abs(ang([-2, 0, -3], [2, 0, -3]) - ang([-2, 0, 3], [2, 0, 3])) % 360;
      if (d > 180) d = 360 - d;
      if (d > 90) d = 180 - d;
      return d;
    }
    function fog() {
      return k.scene.fog ? k.scene.fog.near.toFixed(2) + '/' + k.scene.fog.far.toFixed(2) : 'none';
    }
    function dist() { return k.camera.position.distanceTo(k.orbit.target); }
    function frames(n, cb) {
      if (n <= 0) return cb();
      requestAnimationFrame(function () { k.invalidate(); frames(n - 1, cb); });
    }

    k.createPrimitiveObject('cube', k.PRIM_SPECS.cube.def, 'L', new THREE.Vector3(0, 0, 0));
    k.refreshUI();
    k.invalidate();

    frames(3, function () {
      log('perspective', 'convergence=' + gap().toFixed(4) + ' deg, camDist=' +
        dist().toFixed(3) + ', fog=' + fog());
      document.getElementById('projPill').click();
      frames(3, function () {
        log('flat', 'convergence=' + gap().toFixed(4) + ' deg, camDist=' +
          dist().toFixed(3) + ', fog=' + fog() +
          ', fov=' + (k.camera.fov === undefined ? 'none - parallel projection' : k.camera.fov));
        log('console.errors', errs.length ? errs.join(' | ').slice(0, 200) : 'none');
        done();
      });
    });
  }

  var posted = false;
  function post() {
    if (posted) return;
    posted = true;
    try { fetch('/result', { method: 'POST', body: out.join('\n') }); } catch (e) {}
  }
  setTimeout(function () { if (!posted) { out.push('WATCHDOG'); post(); } }, 25000);
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
        try { main(post); }
        catch (e) {
          out.push('ERROR=' + (e && e.stack ? e.stack.split('\n').slice(0, 6).join(' / ') : e));
          post();
        }
      }, 800);
    });
  }, 400);
})();
