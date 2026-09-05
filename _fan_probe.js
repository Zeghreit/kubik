/* a2.83 investigation. Runs a battery of models through applyShading and
   reports, per model, which attribute vertices the union-find write loop
   leaves alone - because those, and only those, are what the opening
   geo.computeVertexNormals() is still paying for. */
(function () {
  var out = [], errs = [];
  var _ce = console.error;
  console.error = function () { errs.push(Array.prototype.join.call(arguments, ' ')); _ce.apply(console, arguments); };
  function log(k, v) { out.push(k + '=' + v); }
  var k, A, THREE;

  function snap() {
    var F = window.__FAN;
    return {
      used: F.used, unwritten: F.unwritten, degen: F.degen,
      noGroup: F.noGroup, notEnrolled: F.notEnrolled, noAcc: F.noAcc,
      dbz: F.degenBaseZero, dbn: F.degenBaseNonZero,
      ubz: F.unwrittenBaseZero, ubn: F.unwrittenBaseNonZero,
      gap: F.maxBaseGap
    };
  }
  function delta(a, b) {
    var d = {};
    for (var key in b) d[key] = key === 'gap' ? b[key] : b[key] - a[key];
    return d;
  }

  var rows = [];
  function measure(label, obj) {
    if (!obj) { rows.push(label + ': NOT BUILT'); return null; }
    var before = snap();
    k.applyShading(obj);
    var d = delta(before, snap());
    var tris = obj.mesh.geometry.index ? obj.mesh.geometry.index.count / 3 : 0;
    rows.push(label + ': ' + tris + 'tri ' + d.used + 'v' +
      ' | unwritten ' + d.unwritten +
      (d.unwritten ? ' (base zero ' + d.ubz + ', live ' + d.ubn + ')' : '') +
      ' | degen ' + d.degen +
      (d.degen ? ' (base zero ' + d.dbz + ', live ' + d.dbn + ')' : '') +
      (d.noGroup ? ' | noGroup ' + d.noGroup : '') +
      (d.notEnrolled ? ' | notEnrolled ' + d.notEnrolled : '') +
      (d.noAcc ? ' | noAcc ' + d.noAcc : ''));
    return d;
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

    log('0.instrumented', window.__FAN
      ? 'the write loop is counting; entry state ' + (window.__FAN0 ? 'too' : 'MISSING')
      : 'NO __FAN OBJECT - nothing was injected, every number below is meaningless');
    if (!window.__FAN) { return; }

    /* ---- 1. The battery. Every shape the app can make plus a couple it
       cannot, because the whole question is whether the baseline is ever
       READ, and one shape that reads it is enough to make dropping it a
       correctness change rather than a deletion. ---- */

    var cube = fresh('flat cube');
    measure('cube (flat)', cube);

    var sm = fresh('smooth cube');
    k.setMode('object');
    A.selectedObjectIds = new Set([sm.id]);
    A.activeObjectId = sm.id;
    sub(sm); sub(sm);
    measure('cube subdivided x2', sm);

    var kinds = [];
    try { kinds = Object.keys(k.PRIM_SPECS || {}); } catch (e) { kinds = []; }
    log('1.primitive_kinds', kinds.length ? kinds.join(', ') : 'PRIM_SPECS not reachable - primitives skipped');
    kinds.forEach(function (kind) {
      var spec = k.PRIM_SPECS[kind];
      var def = {};
      for (var f in (spec.def || {})) def[f] = spec.def[f];
      var o = null;
      try { o = k.createPrimitiveObject(kind, def, kind, new THREE.Vector3(0, 0, 0)); } catch (e) { }
      if (o) measure('prim ' + kind, o);
    });

    /* An OPEN surface: every boundary edge has one face, which the sharp
       rule forces sharp, so islands are as fragmented as they get. */
    var plane = k.createObjectFromEditable('plane', new THREE.Vector3(0, 0, 0), {
      positions: [0, 0, 0, 1, 0, 0, 1, 0, 1, 0, 0, 1],
      groups: [{ triangles: [[0, 1, 2], [0, 2, 3]] }]
    }, k.makeMaterialSet(1), {});
    measure('open plane (one quad)', plane);

    /* THE FIXTURE THAT EXISTS TO TRIP IT. Two triangles in ONE face group,
       wound against each other, so at every one of their shared corners the
       island's summed triangle normal is exactly zero - which is the
       `degenerate fan` continue, the one branch that demonstrably reads the
       baseline. Union-find nodes are FACE GROUPS, so putting both triangles
       in one group is what guarantees they land in the same island; two
       groups would be split by the sharp test instead and prove nothing. */
    var fin = null;
    try {
      fin = k.createObjectFromEditable('fin', new THREE.Vector3(0, 0, 0), {
        positions: [0, 0, 0, 1, 0, 0, 0, 0, 1],
        groups: [{ triangles: [[0, 1, 2], [0, 2, 1]] }]
      }, k.makeMaterialSet(1), {});
    } catch (e) { errs.push('fin: ' + e); }
    var finD = measure('folded fin (one group, opposed winding)', fin);

    /* And the same fold with a real fan around it - a vertex where two
       opposed triangles meet AND four ordinary ones do, so the island sum
       cancels while the baseline, which sums every adjacent triangle
       regardless of island, does not. */
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
    measure('folded fin beside a live fan', fan);

    /* ---- 1b. AFTER THE OPS. Every op funnels through
       rebuildFromEditable, which makes a BRAND NEW BufferGeometry with no
       normal attribute - so an op is exactly the case where "whatever was
       in the array" is nothing at all, and any vertex the write loop skips
       would render black. ---- */
    function opCase(label, mode, sel, go) {
      var o = fresh('op ' + label);
      sub(o); sub(o);
      try {
        k.setMode(mode);
        A.selectedObjectIds = new Set([o.id]);
        A.activeObjectId = o.id;
        k.ensureHelpers(o);
        A.selectedElements = new Set(sel);
        go(o);
        if (A.pendingOp) { k.flushPendingApply(); k.confirmPendingOp(); }
      } catch (e) { rows.push('op ' + label + ': THREW ' + e); return; }
      measure('after ' + label, o);
    }
    opCase('extrude', 'face', [0], function () { k.extrudeSelection(); k.setPendingAmount(0.4); });
    opCase('inset', 'face', [0, 1], function () { k.insetSelection(); k.setPendingAmount(0.2); });
    opCase('bevel', 'edge', [0], function () { k.bevelSelection(); k.setPendingAmount(0.1); });
    opCase('subdivide', 'object', [], function () { k.subdivideSelection(); });
    opCase('solidify', 'object', [], function () { k.solidifySelection(); k.setPendingAmount(0.1); });
    opCase('array', 'object', [], function () { k.arraySelection(); k.setPendingAmount(1.5); });
    opCase('cleanup', 'object', [], function () { k.cleanupSelection(); });
    opCase('crease', 'edge', [0, 1, 2], function () { k.creaseSelection(); });
    opCase('shade smooth', 'object', [], function () { k.smoothByAngleSelection && k.smoothByAngleSelection(); });
    opCase('slide', 'edge', [4], function () { k.slideSelection(); k.setPendingAmount(0.3); });

    log('1.battery', rows.join('  ||  '));

    /* ---- 2. The verdict on unwritten vertices ---- */
    var F = window.__FAN;
    log('2.unwritten', F.unwritten === 0
      ? 'across every model above, the write loop wrote EVERY attribute vertex the index references - ' +
        F.used + ' of them - so nothing but the degenerate branch can read the baseline'
      : F.unwritten + ' of ' + F.used + ' referenced vertices were left to the baseline (' +
        F.unwrittenBaseZero + ' of them holding zero, ' + F.unwrittenBaseNonZero + ' holding a real normal)');
    log('2.why', 'noGroup ' + F.noGroup + ', notEnrolled ' + F.notEnrolled +
      ', noAcc ' + F.noAcc + ', degenerate fan ' + F.degen);

    /* ---- 3. Does the degenerate branch ever fire, and on what ---- */
    log('3.degenerate_fires', F.degen > 0
      ? 'yes - ' + F.degen + ' times, and the fixture built to cause it ' +
        (finD && finD.degen > 0 ? 'did' : 'DID NOT, so section 3 is about something else')
      : 'NEVER, on any model above - including the fixture built to cause it, which means the fixture is wrong, not the branch');
    log('3.what_the_baseline_gives', F.degen === 0 ? 'n/a'
      : F.degenBaseZero + ' of those kept a ZERO normal (the baseline cancelled too, so the fallback falls back to nothing) and ' +
        F.degenBaseNonZero + ' kept a live one summed across islands the shading model says are separate');
    log('3.islands_at_those_vertices', F.degen === 0 ? 'n/a'
      : (F.degenIslands / F.degen).toFixed(2) + ' islands on average at a degenerate vertex' +
        (F.degenIslands / F.degen > 1.01 ? ' - more than one, so the baseline is answering across a crease' : ''));

    /* ---- 4. Is the baseline even close to the answer where it IS
       overwritten? If it were, calling it a "safe baseline" would be fair.
       A unit-vector gap of 2 is a normal pointing the opposite way. ---- */
    log('4.max_baseline_gap', F.maxBaseGap.toFixed(4) +
      ' between two unit vectors, which is ' +
      (2 * Math.asin(Math.min(1, F.maxBaseGap / 2)) * 180 / Math.PI).toFixed(0) + ' degrees' +
      (F.maxBaseGap > 0.02
        ? ' - so the baseline is not an approximation of the shading answer, it is a different answer that happens to be overwritten'
        : ' - the two agree everywhere, which would make it a fair fallback'));

    /* ---- 5. What the normal attribute holds AT ENTRY. If the baseline is
       dropped this is what an unwritten vertex would keep. ---- */
    var G = window.__FAN0;
    log('5.entry_state', G
      ? G.calls + ' calls: no attribute at all ' + G.noAttr + ', wrong size ' + G.wrongSize +
        ', all zero ' + G.allZero + ', already holding normals ' + G.live
      : 'NOT INSTRUMENTED');
    log('5.means', !G ? 'n/a' : (G.noAttr > 0
      ? 'dropping the baseline needs an explicit create - ' + G.noAttr + ' calls arrived with no normal attribute'
      : 'the attribute always exists at entry, so dropping the baseline needs no allocation, only a value for every vertex'));

    log('console.errors', errs.length ? errs.join(' | ').slice(0, 400) : 'none');
  }

  var posted = false;
  function post() {
    if (posted) return;
    posted = true;
    try { fetch('/result', { method: 'POST', body: out.join('\n') }); }
    catch (e) { }
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
