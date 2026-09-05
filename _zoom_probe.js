/* Is the ring's size actually tied to ZOOM, or to where you pressed?
   Blooms the same ring at the same point at four camera distances, then at
   four press points at one distance, and reports the drawn radius each time.
   Only one of the two can be moving it. */
(function () {
  var out = [];
  function ringEl() { return document.getElementById('touchToolRing'); }
  function radius() {
    var host = ringEl().parentElement.getBoundingClientRect(), el = ringEl();
    var ox = host.left + parseFloat(el.style.left || '0');
    var oy = host.top + parseFloat(el.style.top || '0');
    var s = el.querySelector('.hub-item');
    if (!s) return -1;
    var r = s.getBoundingClientRect();
    return Math.hypot(r.left + r.width / 2 - ox, r.top + r.height / 2 - oy);
  }
  function centre() {
    var host = ringEl().parentElement.getBoundingClientRect(), el = ringEl();
    return host.left + parseFloat(el.style.left || '0');
  }

  function main() {
    var k = window.__kubik, A = k.App;
    var host = ringEl().parentElement.getBoundingClientRect();
    var mx = host.left + host.width / 2, my = host.top + host.height / 2;
    k.setMode('object');
    A.selectedObjectIds = new Set([A.objects[0].id]);
    k.refreshUI();

    var bloom = function (x, y) {
      k.bloomToolRing(x, y, k.currentHubTools(), undefined, { x: x, y: y });
    };

    // ---- zoom sweep, same press point ----
    var zr = [];
    [0.35, 1, 3, 9].forEach(function (d) {
      k.orbit.radius = d * 4;
      if (k.orbit.apply) k.orbit.apply();
      k.invalidate && k.invalidate();
      bloom(mx, my);
      zr.push('dist ' + (d * 4).toFixed(1) + ' -> R ' + radius().toFixed(1));
    });
    out.push('zoom=' + zr.join(' | '));

    // ---- press-point sweep, one zoom ----
    var pr = [];
    [0.04, 0.15, 0.3, 0.5].forEach(function (f) {
      var x = host.left + host.width * f;
      bloom(x, my);
      pr.push('x ' + Math.round(host.width * f) + ' -> R ' + radius().toFixed(1) +
              ' at cx ' + Math.round(centre() - host.left));
    });
    out.push('press=' + pr.join(' | '));
    out.push('viewport=' + Math.round(host.width) + 'x' + Math.round(host.height));
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
    if (window.__kubik && document.getElementById('touchToolRing')) return cb();
    if (t > 300) { out.push('ERROR=no __kubik'); return finish(); }
    setTimeout(function () { ready(cb, t + 1); }, 20);
  }
  setTimeout(function () {
    ready(function () {
      setTimeout(function () {
        try { main(); } catch (e) {
          out.push('ERROR=' + (e && e.stack ? e.stack.split('\n').slice(0, 5).join(' / ') : e));
        }
        finish();
      }, 600);
    });
  }, 300);
})();
