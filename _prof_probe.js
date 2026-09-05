/* Where the rest of applyShading goes.
   _prof_probe.py instruments the function in a COPY of index.html; this
   reads the accumulator it fills. Every number is a share of the same run
   on the same mesh, which is the only sound way to compare phases. */
(function () {
  var out = [], errs = [];
  var _ce = console.error;
  console.error = function () { errs.push(Array.prototype.join.call(arguments, ' ')); _ce.apply(console, arguments); };
  function log(k, v) { out.push(k + '=' + v); }
  var k, A, THREE;

  function ms(x) { return x.toFixed(2) + 'ms'; }

  // Median of several runs: one run on a cold JIT is noise, not a number.
  function timeIt(runs, fn) {
    var ts = [];
    for (var i = 0; i < runs; i++) {
      var t0 = performance.now();
      fn(i);
      ts.push(performance.now() - t0);
    }
    ts.sort(function (a, b) { return a - b; });
    return ts[Math.floor(ts.length / 2)];
  }

  function freshCube() {
    var o = k.createCubeObject('T', new THREE.Vector3(0, 0, 0));
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

  /* Run applyShading n times and return the accumulator, wall time and the
     phase table. Resetting __PROF here is what keeps one measurement from
     leaking into the next. */
  function profile(fn, n) {
    window.__PROF = {};
    var t0 = performance.now();
    for (var i = 0; i < n; i++) fn(i);
    var wall = performance.now() - t0;
    var P = window.__PROF, keys = Object.keys(P).sort();
    /* A key like 2a_ is INSIDE 2_, so it must not be summed with it - that
       would double-count and put the accounted share over 100%. Top-level
       keys are `<digit>_`; sub-phases are `<digit><letter>_`. */
    var rows = [], subs = [], sum = 0;
    for (var j = 0; j < keys.length; j++) {
      var kk = keys[j], v = P[kk];
      var line = kk + ' ' + ms(v / n) + ' ' + (100 * v / wall).toFixed(0) + '%';
      if (/^\d[a-z]_/.test(kk)) { subs.push(line); }
      else { sum += v; rows.push(line); }
    }
    return { rows: rows, subs: subs, wall: wall, per: wall / n, sum: sum, P: P, keys: keys };
  }

  function main() {
    k = window.__kubik; A = k.App; THREE = k.THREE;

    if (!window.__PROF && typeof k.applyShading === 'function') {
      // The marks open the accumulator on first call, so touch it once.
      var probeObj = freshCube();
      k.applyShading(probeObj);
    }
    log('0.instrumented', window.__PROF ? 'yes - ' + Object.keys(window.__PROF).length +
      ' phases reporting' : 'NO - THE MARKS DID NOT RUN, EVERY NUMBER BELOW IS MEANINGLESS');

    /* ---- 1. WARM CACHE: the same geometry shaded over and over. This is
       the shape of a slider frame that does not rebuild topology, and it is
       the case a2.74 section 6 measured. ---- */
    var o1 = freshCube();
    for (var d = 0; d < 4; d++) subdivideOnce(o1);
    log('1.mesh', tris(o1) + ' triangles, ' + o1.mesh.geometry.groups.length +
      ' faces, wantsWear=' + o1.mesh.userData.wantsWear);

    k.applyShading(o1);   // warm the topology cache and the JIT
    var w = profile(function () { k.applyShading(o1); }, 9);
    log('1.total', ms(w.per) + ' per applyShading, ' + (100 * w.sum / w.wall).toFixed(0) +
      '% of it accounted for by the marks');
    log('1.phases', w.rows.join(' | '));
    log('1.inside_topo', w.subs.length ? w.subs.join(' | ') : 'NO SUB-MARKS'); 

    /* ---- 2. COLD CACHE: what every real op actually pays. rebuildFromEditable
       installs a NEW geometry, so shadingTopoFor misses every time. The
       phase table is still applyShading's own; the wall clock is the whole
       rebuild, so the percentages here are shares of the OP, not of the
       shade. ---- */
    var o2 = freshCube();
    for (var d2 = 0; d2 < 4; d2++) subdivideOnce(o2);
    k.rebuildFromEditable(o2, k.toEditable(o2.mesh));
    var c = profile(function () {
      k.rebuildFromEditable(o2, k.toEditable(o2.mesh));
    }, 7);
    log('2.total', ms(c.per) + ' per rebuildFromEditable (a new geometry each time, ' +
      'which is what every op does)');
    log('2.phases_share_of_op', c.rows.join(' | '));
    log('2.inside_topo', c.subs.length ? c.subs.join(' | ') : 'NO SUB-MARKS');
    log('2.shade_share', (100 * c.sum / c.wall).toFixed(0) +
      '% of the whole op is inside applyShading; the rest is toEditable and the rebuild');

    /* ---- 3. THE DOUBLE NORMALS, stated as the decision it is ----
       Phase 1 is computeVertexNormals run as a safety baseline. Phase 6
       overwrites almost all of it. The question the queue asks is what
       phase 1 is worth, so put the two side by side. */
    var b = w.P['1_baseNormals'] || 0, u = w.P['6_unionFind'] || 0, t4 = w.P['4_triNormals'] || 0;
    log('3.double_normals', 'baseline ' + ms(b / 9) + ' vs the pass that replaces it ' +
      ms((t4 + u) / 9) + ' - dropping the baseline would return ' +
      (100 * b / w.wall).toFixed(0) + '% of a warm shade and ' +
      (100 * (w.P['1_baseNormals'] || 0) / w.wall).toFixed(0) + '% here');

    /* ---- 4. HOW EACH PHASE SCALES. A phase that is 5% at 3k triangles and
       30% at 50k is a different problem from one that is flat. Only the
       phases are compared, and only within this run. ---- */
    var o4 = freshCube();
    var srows = [];
    for (var d4 = 0; d4 < 6; d4++) {
      subdivideOnce(o4);
      k.applyShading(o4);
      var s = profile(function () { k.applyShading(o4); }, 3);
      srows.push(tris(o4) + 'tri ' + ms(s.per) + ' [' + s.rows.join(', ') + ' // ' + s.subs.join(', ') + ']');
      if (tris(o4) > 20000) break;
    }
    log('4.curve', srows.join('  ||  '));

    /* ---- 5. WITH THE WEAR PASS ON, so phase 7 is not a zero. On most
       objects a2.75 skips it; this is what it costs when it runs. ---- */
    var o5 = freshCube();
    for (var d5 = 0; d5 < 4; d5++) subdivideOnce(o5);
    o5.mesh.userData.wantsWear = true;
    k.applyShading(o5);
    var ww = profile(function () { k.applyShading(o5); }, 7);
    log('5.wear_on', ms(ww.per) + ' per shade with the wear list built');
    log('5.phases', ww.rows.join(' | '));
    log('5.inside_topo', ww.subs.length ? ww.subs.join(' | ') : 'NO SUB-MARKS');

    /* ---- 6. THE TWO CANDIDATES, A/B'd BEFORE ANY REFACTOR ----
       The profile says 2e_edgeMaps and 2a_computeLogicalOf are the two
       biggest pieces of the topology build. Both have an obvious suspect:
       computeLogicalOf builds a STRING key per attribute vertex, and the
       edge pass keeps SIX parallel Maps and does four lookups per edge
       plus a linear indexOf. Whether the obvious rewrite is actually
       faster in this engine is a question, not a fact - so both versions
       are written here, over the same geometry, in the same run. */
    var o6 = freshCube();
    for (var d6 = 0; d6 < 5; d6++) subdivideOnce(o6);
    var geo6 = o6.mesh.geometry, idx6 = geo6.index, pos6 = geo6.attributes.position;
    log('6.mesh', (idx6.count / 3) + ' triangles, ' + pos6.count + ' attribute vertices');

    // --- 6a. the logical weld -------------------------------------------
    function weldString() {
      var n = pos6.count, map = new Map(), lo = new Int32Array(n), lg = [];
      for (var i = 0; i < n; i++) {
        var x = Math.round(pos6.getX(i) * 1e4),
            y = Math.round(pos6.getY(i) * 1e4),
            z = Math.round(pos6.getZ(i) * 1e4);
        var kk = x + '_' + y + '_' + z;
        var lid = map.get(kk);
        if (lid === undefined) { lid = lg.length; map.set(kk, lid); lg.push([]); }
        lo[i] = lid; lg[lid].push(i);
      }
      return { logicalOf: lo, logicalGroups: lg };
    }
    /* Nested maps rather than a combined number: three rounded coordinates
       cannot be packed into one double without a range assumption, and a
       key collision here WELDS TWO VERTICES THAT ARE NOT THE SAME. Nesting
       is exactly equivalent by construction, whatever the model's scale. */
    function weldNested() {
      var n = pos6.count, mx = new Map(), lo = new Int32Array(n), lg = [];
      for (var i = 0; i < n; i++) {
        var x = Math.round(pos6.getX(i) * 1e4),
            y = Math.round(pos6.getY(i) * 1e4),
            z = Math.round(pos6.getZ(i) * 1e4);
        var my = mx.get(x); if (!my) { my = new Map(); mx.set(x, my); }
        var mz = my.get(y); if (!mz) { mz = new Map(); my.set(y, mz); }
        var lid = mz.get(z);
        if (lid === undefined) { lid = lg.length; mz.set(z, lid); lg.push([]); }
        lo[i] = lid; lg[lid].push(i);
      }
      return { logicalOf: lo, logicalGroups: lg };
    }
    var wS = null, wN = null;
    var tWS = timeIt(7, function () { wS = weldString(); });
    var tWN = timeIt(7, function () { wN = weldNested(); });
    var sameWeld = wS.logicalGroups.length === wN.logicalGroups.length;
    if (sameWeld) for (var q = 0; q < wS.logicalOf.length && sameWeld; q++) {
      // ids may be numbered differently only if iteration order differs;
      // it does not, both walk i ascending and mint on first sight.
      if (wS.logicalOf[q] !== wN.logicalOf[q]) sameWeld = false;
    }
    log('6a.weld', 'string keys ' + ms(tWS) + ' | nested maps ' + ms(tWN) + ' -> ' +
      (tWN < tWS ? (100 * (tWS - tWN) / tWS).toFixed(0) + '% faster' : 'NO WIN, keep the strings'));
    log('6a.identical', sameWeld
      ? 'both produce the same ' + wS.logicalGroups.length + ' logical vertices, vertex for vertex'
      : 'THEY DISAGREE - the nested version is not equivalent, do not ship it');

    // --- 6b. the edge maps ----------------------------------------------
    var lof = wS.logicalOf, nLog = wS.logicalGroups.length, triN = idx6.count / 3;
    var tg = new Int32Array(triN);
    (geo6.groups.length ? geo6.groups : [{ start: 0, count: idx6.count }]).forEach(function (g, gi) {
      var ts = g.start / 3, tc = g.count / 3;
      for (var t = 0; t < tc; t++) tg[ts + t] = gi;
    });

    // the shipped shape: six parallel Maps, four gets per repeat edge
    function edgesSix() {
      var edgeUse = new Map(), edgeOpp = new Map(), edgeTri = new Map(),
          edgeFaces = new Map(), edgeEnds = new Map(), incident = new Map();
      for (var t = 0; t < triN; t++) {
        var ls = [lof[idx6.getX(t * 3)], lof[idx6.getX(t * 3 + 1)], lof[idx6.getX(t * 3 + 2)]];
        for (var e = 0; e < 3; e++) {
          var a = ls[e], b = ls[(e + 1) % 3];
          if (a === b) continue;
          var lo2 = a < b ? a : b, hi = a < b ? b : a, kk = lo2 * nLog + hi;
          var fs = edgeFaces.get(kk), cs, ops, ots;
          if (!fs) {
            fs = []; cs = []; ops = []; ots = [];
            edgeFaces.set(kk, fs); edgeUse.set(kk, cs); edgeOpp.set(kk, ops);
            edgeTri.set(kk, ots); edgeEnds.set(kk, [lo2, hi]);
            var ia = incident.get(lo2); if (!ia) { ia = []; incident.set(lo2, ia); } ia.push(kk);
            var ib = incident.get(hi); if (!ib) { ib = []; incident.set(hi, ib); } ib.push(kk);
          } else { cs = edgeUse.get(kk); ops = edgeOpp.get(kk); ots = edgeTri.get(kk); }
          var g2 = tg[t], gi2 = fs.indexOf(g2);
          if (gi2 < 0) { gi2 = fs.length; fs.push(g2); cs.push(0); ops.push(idx6.getX(t * 3 + (e + 2) % 3)); ots.push(t); }
          cs[gi2]++;
        }
      }
      return edgeFaces.size;
    }
    // one Map of records: one get per edge, the five arrays hang off it
    function edgesOne() {
      var edges = new Map(), incident = new Map();
      for (var t = 0; t < triN; t++) {
        var i0 = lof[idx6.getX(t * 3)], i1 = lof[idx6.getX(t * 3 + 1)], i2 = lof[idx6.getX(t * 3 + 2)];
        for (var e = 0; e < 3; e++) {
          var a = e === 0 ? i0 : e === 1 ? i1 : i2;
          var b = e === 0 ? i1 : e === 1 ? i2 : i0;
          if (a === b) continue;
          var lo2 = a < b ? a : b, hi = a < b ? b : a, kk = lo2 * nLog + hi;
          var rec = edges.get(kk);
          if (rec === undefined) {
            rec = { faces: [], use: [], opp: [], tri: [], ends: [lo2, hi] };
            edges.set(kk, rec);
            var ia = incident.get(lo2); if (!ia) { ia = []; incident.set(lo2, ia); } ia.push(kk);
            var ib = incident.get(hi); if (!ib) { ib = []; incident.set(hi, ib); } ib.push(kk);
          }
          var fs = rec.faces, g2 = tg[t], gi2 = -1;
          for (var z = 0; z < fs.length; z++) if (fs[z] === g2) { gi2 = z; break; }
          if (gi2 < 0) {
            gi2 = fs.length; fs.push(g2); rec.use.push(0);
            rec.opp.push(idx6.getX(t * 3 + (e + 2) % 3)); rec.tri.push(t);
          }
          rec.use[gi2]++;
        }
      }
      return edges.size;
    }
    var nSix = 0, nOne = 0;
    var tSix = timeIt(7, function () { nSix = edgesSix(); });
    var tOne = timeIt(7, function () { nOne = edgesOne(); });
    log('6b.edges', 'six parallel Maps ' + ms(tSix) + ' | one Map of records ' + ms(tOne) + ' -> ' +
      (tOne < tSix ? (100 * (tSix - tOne) / tSix).toFixed(0) + '% faster' : 'NO WIN, leave it alone'));
    log('6b.same_edges', nSix === nOne
      ? 'both find the same ' + nSix + ' logical edges'
      : 'DIFFERENT EDGE COUNTS (' + nSix + ' vs ' + nOne + ') - not equivalent');

    /* ---- 7. THE WELD ON SCATTERED COORDINATES ----
       Section 6a measured the weld on a SUBDIVIDED PRIMITIVE, and that is
       the best case for nested maps: a subdivided cube has a handful of
       distinct rounded x values, so a few dozen inner Maps serve tens of
       thousands of vertices. An imported CAD or scanned mesh is the
       opposite - almost every rounded x is distinct, so nesting allocates
       up to TWO Maps per vertex where the string form allocated one short
       string. That is the case every import path feeds through here, and
       section 6a cannot see it. Same three implementations, a fixture that
       is nothing but distinct coordinates. */
    /* WORST CASE BY CONSTRUCTION, not by random numbers. The first attempt
       used an LCG whose multiply overflowed 2^53, so the sequence collapsed
       and the "scattered" fixture came back with 6,222 distinct positions
       out of 40,000 - clustered, which is the case already covered. What
       matters here is the number of DISTINCT ROUNDED X values, because that
       is what decides how many inner Maps the nested weld allocates. So: x
       distinct for every vertex by construction, y and z spread, and every
       position used by exactly two attribute vertices, which is what a mesh
       with shared corners looks like. */
    function scatterAttr(n) {
      var a = new Float32Array(n * 3);
      var m = n >> 1;                    // m distinct positions, two vertices each
      for (var i = 0; i < m; i++) {
        var x = i * 0.0007;              // *1e4 -> i*7, distinct for every i
        var y = ((i * 2654435761) % 1000003) * 0.0011;
        var z = ((i * 40503) % 999983) * 0.0013;
        a[(2 * i) * 3] = x; a[(2 * i) * 3 + 1] = y; a[(2 * i) * 3 + 2] = z;
        a[(2 * i + 1) * 3] = x; a[(2 * i + 1) * 3 + 1] = y; a[(2 * i + 1) * 3 + 2] = z;
      }
      return new THREE.BufferAttribute(a, 3);
    }

    function weldStringOn(pa) {
      var n = pa.count, map = new Map(), lo = new Int32Array(n), lg = [];
      for (var i = 0; i < n; i++) {
        var x = Math.round(pa.getX(i) * 1e4), y = Math.round(pa.getY(i) * 1e4), z = Math.round(pa.getZ(i) * 1e4);
        var kk = x + '_' + y + '_' + z;
        var lid = map.get(kk);
        if (lid === undefined) { lid = lg.length; map.set(kk, lid); lg.push([]); }
        lo[i] = lid; lg[lid].push(i);
      }
      return { logicalOf: lo, logicalGroups: lg };
    }
    function weldNestedOn(pa) {
      var n = pa.count, mx = new Map(), lo = new Int32Array(n), lg = [];
      for (var i = 0; i < n; i++) {
        var x = Math.round(pa.getX(i) * 1e4), y = Math.round(pa.getY(i) * 1e4), z = Math.round(pa.getZ(i) * 1e4);
        var my = mx.get(x); if (my === undefined) { my = new Map(); mx.set(x, my); }
        var mz = my.get(y); if (mz === undefined) { mz = new Map(); my.set(y, mz); }
        var lid = mz.get(z);
        if (lid === undefined) { lid = lg.length; mz.set(z, lid); lg.push([]); }
        lo[i] = lid; lg[lid].push(i);
      }
      return { logicalOf: lo, logicalGroups: lg };
    }
    /* ONE Map, a numeric HASH, and the three coordinates kept so a collision
       is resolved rather than trusted. No scale assumption and no packing:
       the bucket says "one of these", and the compare says which. */
    function weldHashOn(pa) {
      var n = pa.count, map = new Map(), lo = new Int32Array(n), lg = [];
      var bx = [], by = [], bz = [];
      for (var i = 0; i < n; i++) {
        var x = Math.round(pa.getX(i) * 1e4), y = Math.round(pa.getY(i) * 1e4), z = Math.round(pa.getZ(i) * 1e4);
        var h = (x * 73856093 ^ y * 19349663 ^ z * 83492791) | 0;
        var b = map.get(h), lid = -1;
        if (b === undefined) { b = []; map.set(h, b); }
        else for (var q = 0; q < b.length; q++) {
          var c = b[q];
          if (bx[c] === x && by[c] === y && bz[c] === z) { lid = c; break; }
        }
        if (lid < 0) { lid = lg.length; bx.push(x); by.push(y); bz.push(z); b.push(lid); lg.push([]); }
        lo[i] = lid; lg[lid].push(i);
      }
      return { logicalOf: lo, logicalGroups: lg };
    }

    function agree(a, b) {
      if (a.logicalGroups.length !== b.logicalGroups.length) return false;
      for (var i = 0; i < a.logicalOf.length; i++) if (a.logicalOf[i] !== b.logicalOf[i]) return false;
      return true;
    }

    var sc = scatterAttr(40000);
    var rS = null, rN = null, rH = null;
    var tS2 = timeIt(5, function () { rS = weldStringOn(sc); });
    var tN2 = timeIt(5, function () { rN = weldNestedOn(sc); });
    var tH2 = timeIt(5, function () { rH = weldHashOn(sc); });
    log('7.fixture', sc.count + ' attribute vertices, ' + rS.logicalGroups.length +
      ' distinct positions - almost every rounded coordinate is its own, which is ' +
      'what an imported CAD or scanned mesh looks like');
    log('7.scattered', 'string ' + ms(tS2) + ' | nested maps ' + ms(tN2) + ' | hash+verify ' + ms(tH2));
    log('7.verdict', (tN2 > tS2
        ? 'NESTED MAPS LOSE HERE by ' + (100 * (tN2 - tS2) / tS2).toFixed(0) + '%'
        : 'nested maps still win here by ' + (100 * (tS2 - tN2) / tS2).toFixed(0) + '%') +
      '; hash+verify is ' + (tH2 < tS2
        ? (100 * (tS2 - tH2) / tS2).toFixed(0) + '% faster than the string'
        : (100 * (tH2 - tS2) / tS2).toFixed(0) + '% SLOWER than the string'));
    log('7.identical', (agree(rS, rN) ? 'nested==string' : 'NESTED DISAGREES WITH STRING') + ', ' +
      (agree(rS, rH) ? 'hash==string' : 'HASH DISAGREES WITH STRING'));

    // And the same three on the clustered case, so both are in one run.
    var cl = geo6.attributes.position;
    var cS = null, cN = null, cH = null;
    var tS3 = timeIt(5, function () { cS = weldStringOn(cl); });
    var tN3 = timeIt(5, function () { cN = weldNestedOn(cl); });
    var tH3 = timeIt(5, function () { cH = weldHashOn(cl); });
    log('7.clustered', cl.count + ' vertices / ' + cS.logicalGroups.length + ' distinct: string ' +
      ms(tS3) + ' | nested ' + ms(tN3) + ' | hash+verify ' + ms(tH3));
    log('7.clustered_identical', (agree(cS, cN) ? 'nested==string' : 'NESTED DISAGREES') + ', ' +
      (agree(cS, cH) ? 'hash==string' : 'HASH DISAGREES'));

    log('console.errors', errs.length ? errs.join(' | ').slice(0, 300) : 'none');
  }

  function post() {
    try { fetch('/result', { method: 'POST', body: out.join('\n') }); }
    catch (e) { /* nothing else to try */ }
  }
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
