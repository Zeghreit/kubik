/* Drives shading at several sizes so the injected race has something to
   measure, then reports what __RACE collected. */
(function () {
  var out = [], errs = [];
  var _ce = console.error;
  console.error = function () { errs.push(Array.prototype.join.call(arguments, ' ')); _ce.apply(console, arguments); };
  function log(k, v) { out.push(k + '=' + v); }
  var k, A, THREE;

  function freshCube() {
    var o = k.createCubeObject('R', new THREE.Vector3(0, 0, 0));
    A.selectedObjectIds = new Set([o.id]);
    A.activeObjectId = o.id;
    k.refreshUI();
    return o;
  }
  function subdivideOnce(o) {
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
  function tris(o) { return o.mesh.geometry.index.count / 3; }

  function main() {
    k = window.__kubik; A = k.App; THREE = k.THREE;

    log('0.injected', window.__RACE ? 'the legacy loop is in the page and running'
      : 'NO RACE OBJECT - nothing was injected, every number below is meaningless');

    var rows = [];
    var o = freshCube();
    for (var d = 0; d < 5; d++) {
      subdivideOnce(o);
      /* WARM FIRST, MEASURE SECOND. The first row of this table came out at
         -450% and it was the harness, not the code: it is the first thing
         the page measures, so the new loop was being JIT-compiled inside the
         window being timed while the old loop - which runs first in each
         shade - had already warmed every helper they share. _time_probe's
         own timeIt takes a MEDIAN of several runs for exactly this reason;
         this takes a mean, so it has to warm up explicitly. */
      for (var w = 0; w < 4; w++) k.applyShading(o);
      var before = window.__RACE ? { o: window.__RACE.oldMs, n: window.__RACE.newMs, r: window.__RACE.runs } : null;
      for (var i = 0; i < 8; i++) k.applyShading(o);
      if (before) {
        var dOld = window.__RACE.oldMs - before.o;
        var dNew = window.__RACE.newMs - before.n;
        var runs = window.__RACE.runs - before.r;
        rows.push(tris(o) + 'tri  old ' + (dOld / runs).toFixed(2) + 'ms  new ' +
          (dNew / runs).toFixed(2) + 'ms  ' +
          (dOld > 0 ? (100 * (dOld - dNew) / dOld).toFixed(0) + '% off' : '-'));
      }
      if (tris(o) > 20000) break;
    }
    log('1.race', rows.join('  |  '));

    if (window.__RACE) {
      var R = window.__RACE;
      log('2.totals', R.runs + ' shades: old ' + R.oldMs.toFixed(1) + 'ms, new ' +
        R.newMs.toFixed(1) + 'ms');
      log('2.faster', R.oldMs > 0
        ? (100 * (R.oldMs - R.newMs) / R.oldMs).toFixed(0) + '% off the union-find, measured in ONE run against the loop it replaces'
        : 'NO TIME RECORDED');
      /* THE HALF THAT MATTERS MORE. A faster answer that is a different
         answer is not an optimisation. Every normal component of every shade
         is compared; the worst absolute difference across all of them is
         what this reports. */
      log('3.identical', R.worst === 0
        ? 'every one of ' + R.checked + ' normal components came out BIT FOR BIT identical'
        : 'THE ANSWERS DIFFER - worst component off by ' + R.worst);
    }

    /* ---- 4. THE STAMP SURVIVES A THROW. The review's one real finding,
       and nothing else would have caught it: applyShading's catch
       deliberately lets the app carry on, so a throw part way through used
       to leave the shared stamp counter at the value the dead call STARTED
       from. The next shade re-issued those numbers, `enrol` found its own
       stamp already there and skipped the reset, and the union-find began on
       the dead call's forest - un-normalised normals from two calls, written
       with no error on screen because the catch had fired on the previous
       one.

       The throw is injected into the harness's own copy of the loop, so the
       shipped file carries no test hook. (The first attempt tried to reach
       geo.userData.shadeTopo from out here, which is null outside a direct
       drag - so it reported "no cached topo" and the two assertions below
       passed having tested nothing at all.) */
    var o4 = freshCube();
    subdivideOnce(o4); subdivideOnce(o4);
    k.applyShading(o4);
    var good = o4.mesh.geometry.attributes.normal.array.slice();

    var lever = (typeof window.__FORCE_THROW !== 'undefined') || true;
    window.__FORCE_THROW = 20;          // fail on the 20th logical vertex
    var errsBefore = errs.length;
    k.applyShading(o4);                 // applyShading swallows it by design
    var fired = window.__FORCE_THROW === 0;
    window.__FORCE_THROW = 0;
    log('4.forced_throw', fired
      ? 'a shade was made to fail on its 20th vertex, and applyShading swallowed it as it is designed to'
      : 'THE LEVER DID NOT FIRE - section 4 tested nothing (counter left at ' +
        window.__FORCE_THROW + ')');
    log('4.was_reported', errs.length > errsBefore
      ? 'and it was reported to the console, so the failure was real'
      : 'nothing reached the console');

    // A clean shade must now produce exactly what it did before the failure.
    k.applyShading(o4);
    var after = o4.mesh.geometry.attributes.normal.array;
    var worst4 = 0;
    for (var i4 = 0; i4 < good.length; i4++) {
      var d4 = Math.abs(after[i4] - good[i4]);
      if (d4 > worst4) worst4 = d4;
    }
    log('4.recovers', fired && worst4 === 0
      ? 'the shade after a failed one is bit-for-bit what it was before it - the stamp namespace did not collide'
      : (fired ? 'STALE STAMPS: the next shade differs by up to ' + worst4
        : 'not tested - the lever did not fire'));
    var worstLen = 0;
    for (var j4 = 0; j4 + 2 < after.length; j4 += 3) {
      var L4 = Math.sqrt(after[j4] * after[j4] + after[j4 + 1] * after[j4 + 1] + after[j4 + 2] * after[j4 + 2]);
      if (L4 > 1e-6) worstLen = Math.max(worstLen, Math.abs(L4 - 1));
    }
    log('4.unit_normals', fired && worstLen < 1e-5
      ? 'and every normal is still a unit vector - an un-normalised island is exactly what a collision produced'
      : (fired ? 'NORMALS ARE NOT UNIT: worst off by ' + worstLen : 'not tested'));
    void lever;

    log('console.errors', errs.length ? errs.join(' | ').slice(0, 300) : 'none');
  }

  var posted = false;
  function post() {
    if (posted) return;
    posted = true;
    try { fetch('/result', { method: 'POST', body: out.join('\n') }); }
    catch (e) { /* nothing else to try */ }
  }
  setTimeout(function () {
    if (!posted) { out.push('WATCHDOG=main did not finish - the last line above is where it hung'); post(); }
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
