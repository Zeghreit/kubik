/* SYMMETRY ACROSS A SET OF AXES (a2.89). The property the feature exists to
   create is that the MESH comes back symmetric about every live plane - so
   that is what gets asserted, not the number of maps. */
(function () {
  var out = [], errs = [];
  var _ce = console.error;
  console.error = function () { errs.push(Array.prototype.join.call(arguments, ' ')); _ce.apply(console, arguments); };
  function log(kk, v) { out.push(kk + '=' + v); }
  function verdict(c, good, bad) { return c ? ' - ' + good : ' ' + bad; }
  var k, A, THREE;

  function cube(name) {
    var o = k.createPrimitiveObject('cube', k.PRIM_SPECS.cube.def, name || 'C',
      new THREE.Vector3(0, 0, 0));
    A.selectedObjectIds = new Set([o.id]);
    A.activeObjectId = o.id;
    k.setMode('object');
    k.refreshUI();
    k.ensureHelpers(o);
    return o;
  }
  /* THE PROPERTY ITSELF: every vertex has a partner at its reflection. Asked
     of the finished mesh, with the app's own weld tolerance, so it cannot
     agree with the code that built it by construction. */
  function symmetricAbout(o, axis) {
    var topo = o.mesh.userData.topo;
    var pts = [];
    for (var l = 0; l < topo.logicalCount; l++) pts.push(k.logicalPos(o, l));
    var size = new THREE.Box3().setFromPoints(pts).getSize(new THREE.Vector3());
    var tol = Math.max(size.x, size.y, size.z, 1) * 1e-3;
    var off = k.symmetryPlane(o, axis).offset;
    var missing = 0;
    for (var i = 0; i < pts.length; i++) {
      var m = pts[i].clone();
      m[axis] = 2 * off - m[axis];
      var found = false;
      for (var j = 0; j < pts.length && !found; j++) {
        if (m.distanceTo(pts[j]) <= tol) found = true;
      }
      if (!found) missing++;
    }
    return { missing: missing, of: pts.length };
  }
  /* Through the buttons, always - they are the whole control since a2.90 and
     driving the array instead would be asserting the state the probe exists
     to check. */
  function tapAxis(a) {
    document.querySelector('#symAxes button[data-sym="' + a + '"]').click();
  }
  function setAxes(list) {
    ['x', 'y', 'z'].forEach(function (a) {
      var want = list.indexOf(a) >= 0;
      var have = A.symmetryAxes.indexOf(a) >= 0;
      if (want !== have) tapAxis(a);
    });
  }

  function main() {
    k = window.__kubik; A = k.App; THREE = k.THREE;

    /* 1. THERE IS NO TOGGLE. A lit axis is symmetry on; none lit is off, and
       the state a2.89 had to special-case cannot be expressed at all now. */
    var block = document.getElementById('symAxes');
    var cubeEl = document.getElementById('viewCube');
    setAxes([]);
    var offAtStart = !A.symmetry;
    tapAxis('x');
    var onAfterTap = A.symmetry && A.symmetryAxes.join() === 'x';
    log('1.the_axes_are_the_switch', 'offWithNoneLit=' + offAtStart +
      ' onAfterOneTap=' + onAfterTap + ' axes=' + JSON.stringify(A.symmetryAxes) +
      verdict(offAtStart && onAfterTap,
        'one tap is the whole gesture - there is nothing else to turn on',
        'THE AXES DO NOT CARRY THE STATE'));

    var br = block.getBoundingClientRect();
    var cr0 = cubeEl.getBoundingClientRect();
    var vp0 = document.getElementById('viewport').getBoundingClientRect();
    /* The strip is the axes' alone since a2.90a - the projection pill went
       to the menu corner, so the row sits against the right edge under the
       cube rather than 52px in to clear it. */
    log('1.row_box', 'x ' + Math.round(br.left) + '..' + Math.round(br.right) +
      ' y ' + Math.round(br.top) + '..' + Math.round(br.bottom) +
      ' (' + Math.round(br.width) + 'x' + Math.round(br.height) + ')' +
      ', cube ends y ' + Math.round(cr0.bottom) +
      ', viewport right ' + Math.round(vp0.right) +
      verdict(Math.round(br.height) === 44 &&
              br.top >= cr0.bottom - 0.5 &&
              Math.abs(br.right - vp0.right) < 20,
        'one 44px row against the right edge, under the cube',
        'THE ROW IS NOT IN THE CUBE STRIP'));
    /* The pill left the viewport entirely at a2.90b - it is a seat in the
       world ring. The axes have the strip, and there is nothing else up here
       to share it with. */
    log('1.axes_have_the_strip', !document.getElementById('projPill')
      ? 'no pill anywhere - the strip is the axes\' alone'
      : 'THE PROJECTION PILL IS BACK IN THE VIEWPORT');

    /* THE CUBE'S OWN TAPS MUST STILL MEAN ONLY "LOOK DOWN THIS AXIS". The
       whole risk of this neighbourhood is the two reading as one thing, so
       the switches must not be over the faces. */
    log('1.clear_of_the_cube_faces', 'row y ' + Math.round(br.top) +
      ', cube y ' + Math.round(cr0.top) + '..' + Math.round(cr0.bottom) +
      verdict(br.top >= cr0.bottom - 0.5,
        'nothing tappable sits on the cube itself',
        'THE SWITCHES OVERLAP THE CUBE - its taps become ambiguous'));

    // ---- 2. and at phone width, which is the case a2.65 was about ----
    var vpEl = document.getElementById('viewport');
    var held = vpEl.style.width;
    vpEl.style.width = '375px';
    var br2 = block.getBoundingClientRect(), vp2 = vpEl.getBoundingClientRect();
    var fits = br2.right <= vp2.right + 0.5 && br2.left >= vp2.left - 0.5;
    log('2.at_375', 'row x ' + Math.round(br2.left) + '..' + Math.round(br2.right) +
      ' of ' + Math.round(vp2.width) + 'px' +
      verdict(fits,
        'three cells fit the narrow case',
        'IT DOES NOT FIT AT PHONE WIDTH'));
    var menu2 = document.getElementById('btnMenu').getBoundingClientRect();
    log('2.top_left_is_free', 'menu ends y ' + Math.round(menu2.bottom) +
      ', nearest thing on the left is at x ' + Math.round(br2.left) +
      verdict(br2.left > menu2.right,
        'the menu button has the corner to itself - a2.89 and a2.90a both put ' +
          'something there and both were taken back out',
        'SOMETHING IS STACKED UNDER THE MENU AGAIN'));
    vpEl.style.width = held;

    // ---- 3. the mirror group grows the way a group does ----
    var o3 = cube('S3');
    var sizes = [];
    [['x'], ['x', 'y'], ['x', 'y', 'z']].forEach(function (list) {
      setAxes(list);
      sizes.push(k.symmetryMaps(o3).length);
    });
    log('3.group_size', '1 axis -> ' + sizes[0] + ' maps, 2 -> ' + sizes[1] +
      ', 3 -> ' + sizes[2] + '  (2^n - 1)' +
      verdict(sizes[0] === 1 && sizes[1] === 3 && sizes[2] === 7,
        'the X mirror, the Y mirror and the diagonal, and so on',
        'THE GROUP IS THE WRONG SIZE - compositions are missing'));

    // ---- 4. a selection expands to its whole orbit ----
    var o4 = cube('S4');
    var counts = [];
    [['x'], ['x', 'y'], ['x', 'y', 'z']].forEach(function (list) {
      setAxes(list);
      k.setMode('vertex');
      A.selectedObjectIds = new Set([o4.id]); A.activeObjectId = o4.id;
      A.selectedElements = new Set([0]);
      k.symExpand(o4);
      counts.push(A.selectedElements.size);
    });
    log('4.orbit', 'one corner of a cube expands to ' + counts.join(', ') +
      ' for 1, 2 and 3 axes' +
      verdict(counts[0] === 2 && counts[1] === 4 && counts[2] === 8,
        'an edge pair, a face quad, then every corner',
        'THE ORBIT IS WRONG - the images are not being unioned'));

    // ---- 5. THE PROPERTY: an op leaves the mesh symmetric about EVERY plane ----
    var o5 = cube('S5');
    setAxes(['x', 'y']);
    k.setMode('face');
    A.selectedObjectIds = new Set([o5.id]); A.activeObjectId = o5.id;
    A.selectedElements = new Set([0]);
    k.symExpand(o5);
    var facesPicked = A.selectedElements.size;
    k.extrudeSelection();
    var ran = !!A.pendingOp;
    if (ran) { k.setPendingAmount(0.4); k.confirmPendingOp(); }
    var o5b = k.findObject(o5.id);
    var sx = symmetricAbout(o5b, 'x'), sy = symmetricAbout(o5b, 'y');
    var w5 = k.auditWinding(o5b);
    log('5.op_keeps_both_planes', 'extruded ' + facesPicked + ' faces, ran=' + ran +
      ', unmatched across X ' + sx.missing + '/' + sx.of +
      ', across Y ' + sy.missing + '/' + sy.of + ', winding ok=' + w5.ok +
      verdict(ran && sx.missing === 0 && sy.missing === 0 && w5.ok,
        'every vertex has a partner in both planes',
        'THE MESH CAME BACK LOPSIDED'));

    /* 6. AND ONE AXIS IS STILL ONE AXIS. Two-axis symmetry that quietly
       mirrored across a third would pass section 5 just as well, so the
       single-axis case has to be checked for what it must NOT do. */
    var o6 = cube('S6');
    setAxes(['x']);
    k.setMode('vertex');
    A.selectedObjectIds = new Set([o6.id]); A.activeObjectId = o6.id;
    A.selectedElements = new Set([0]);
    var before6 = A.selectedElements.size;
    k.symExpand(o6);
    log('6.one_axis_stays_one', before6 + ' -> ' + A.selectedElements.size +
      ' selected, maps=' + k.symmetryMaps(o6).length +
      verdict(A.selectedElements.size === 2 && k.symmetryMaps(o6).length === 1,
        'one axis still pairs, and only pairs',
        'ONE AXIS IS BEHAVING LIKE MORE THAN ONE'));

    /* 7. The last axis off IS symmetry off, and it forgets - no memory, by
       decision, so what you see is all there is. */
    setAxes(['x', 'y']);
    tapAxis('x'); tapAxis('y');
    var offNow = !A.symmetry;
    var forgot = A.symmetryAxes.length === 0;
    log('7.last_axis_off', 'symmetry=' + A.symmetry + ' axes=' + JSON.stringify(A.symmetryAxes) +
      verdict(offNow && forgot,
        'off, and nothing remembered - the next arm is an explicit tap',
        'IT KEPT A HIDDEN SET, or left symmetry on with nothing lit'));

    // ---- 8. a saved file carries the set, and an old one still opens ----
    setAxes(['x', 'z']);
    var doc = k.serializeDoc();
    var savedAxes = JSON.stringify(doc.symmetry.axes) + ' (legacy axis "' + doc.symmetry.axis + '")';
    k.restoreDoc(JSON.parse(JSON.stringify(doc)));
    var round = JSON.stringify(A.symmetryAxes);
    k.restoreDoc({ objects: [], symmetry: { on: true, axis: 'y' } });
    var legacy = JSON.stringify(A.symmetryAxes);
    log('8.round_trip', 'saved ' + savedAxes + ', reloaded ' + round +
      ', a pre-a2.89 file reloads as ' + legacy +
      verdict(round === '["x","z"]' && legacy === '["y"]',
        'the set survives, and one axis still means one axis',
        'THE SET DID NOT SURVIVE A SAVE'));

    /* 9. THE TOAST MUST NOT COVER THE SWITCHES (a2.89a). Reported from the
       app: the info text landed on top of the X/Y/Z buttons. It faded, and
       it was still wrong - a message that hides the control it describes
       costs more than it says. Measured at 375px, where a centred toast is
       widest relative to the viewport and the collision is real. */
    var vpEl9 = document.getElementById('viewport');
    var held9 = vpEl9.style.width;
    vpEl9.style.width = '375px';
    setAxes([]);
    setAxes(['x', 'y', 'z']);
    k.toast('Symmetry on (X+Y+Z = 0.00) - 8 pairs - switch to a component mode');
    var tr = document.getElementById('toast').getBoundingClientRect();
    var brx = document.getElementById('symAxes').getBoundingClientRect();
    function overlaps(a, b) {
      return a.left < b.right - 0.5 && a.right > b.left + 0.5 &&
             a.top < b.bottom - 0.5 && a.bottom > b.top + 0.5;
    }
    /* a2.89a had to PUSH the toast out of the way; a2.90 moved the switches
       instead, so the toast keeps its own row and the two simply do not meet.
       Asserted with the longest message the feature can produce, at the width
       where a centred toast is widest relative to the viewport. */
    var clash = overlaps(tr, brx);
    log('9.toast_clears_the_switches', 'toast x ' + Math.round(tr.left) + '..' +
      Math.round(tr.right) + ' y ' + Math.round(tr.top) + '..' + Math.round(tr.bottom) +
      ', switches y ' + Math.round(brx.top) + '..' + Math.round(brx.bottom) +
      verdict(!clash,
        'they no longer share a band at all - nothing had to dodge',
        'THE TOAST IS ON TOP OF THE SWITCHES'));
    log('9.toast_kept_its_row', 'toast top ' + Math.round(tr.top) +
      verdict(tr.top < brx.top,
        'still on its own row, above the strip',
        'THE TOAST HAS BEEN DISPLACED'));

    /* THE BAND THE TOAST CROSSES. a2.89a had it over the symmetry switches
       and a2.90a had it a horizontal hair from the projection pill; a2.90b
       emptied that corner, so the question becomes general - does the toast
       cross ANYTHING tappable? A transient thing over a control is invisible
       to any static measurement that did not think to ask, and this is the
       third version running where asking would have caught something. */
    var crossed = [];
    Array.prototype.forEach.call(
      document.querySelectorAll('#viewport > *'), function (el) {
        if (!el.id || el.id === 'toast') return;
        /* Something you cannot tap is not a control the toast can obscure -
           and #vignette is a full-viewport decoration, so counting it would
           make this check pass or fail on nothing. */
        if (getComputedStyle(el).pointerEvents === 'none') return;
        var r = el.getBoundingClientRect();
        if (r.width && r.height && overlaps(tr, r)) crossed.push(el.id);
      });
    /* THE VIEW CUBE IS A KNOWN, PRE-a2.90b OVERLAP. The toast has been
       top-centre since a2.65 and the cube top-right since long before; on a
       375px screen a long message reaches it. Nothing in this version moved
       either, so it is REPORTED with its numbers rather than failed - but it
       is reported, because dropping it from the list is how a check quietly
       stops asking anything. */
    var cubeR = document.getElementById('viewCube').getBoundingClientRect();
    var overCube = overlaps(tr, cubeR);
    var others = crossed.filter(function (id) { return id !== 'viewCube'; });
    log('9.toast_crosses_no_control', 'toast x ' + Math.round(tr.left) + '..' +
      Math.round(tr.right) + ' y ' + Math.round(tr.top) + '..' + Math.round(tr.bottom) +
      (others.length ? ', over: ' + others.join(', ') : ', over nothing new') +
      verdict(!others.length,
        'the longest message in the app clears every control this version touched',
        'THE TOAST IS ON TOP OF A CONTROL'));
    log('9.toast_vs_cube_known', overCube
      ? 'it does cross the cube by x ' + Math.round(Math.max(tr.left, cubeR.left)) + '..' +
        Math.round(Math.min(tr.right, cubeR.right)) + ' - pre-existing, recorded not fixed'
      : 'clear of the cube too');
    vpEl9.style.width = held9;

    /* 10. And the axis tap says nothing at all now, because the buttons do.
       Checked by counting what a tap puts on screen, not by reading the
       source - the point is what the person sees. */
    setAxes([]);
    setAxes(['x']);
    document.getElementById('toast').classList.remove('show');
    tapAxis('y');
    var shown = document.getElementById('toast').classList.contains('show');
    log('10.second_axis_is_quiet', 'toast shown after tapping Y: ' + shown +
      ', axes now ' + JSON.stringify(A.symmetryAxes) +
      verdict(!shown && A.symmetryAxes.length === 2,
        'the lit button is the message once symmetry is already live',
        'A SECOND AXIS STILL RAISES A TOAST'));
    /* But the FIRST one speaks, because the pair count is the one thing the
       buttons cannot show - and it is how you find out the mesh is not
       symmetric about what you just asked for. */
    setAxes([]);
    cube('S10');
    document.getElementById('toast').classList.remove('show');
    tapAxis('x');
    var spoke = document.getElementById('toast').classList.contains('show');
    var said = (document.getElementById('toast').textContent || '');
    log('10.first_axis_reports_pairs', 'toast: "' + said.slice(0, 60) + '"' +
      verdict(spoke && /pair/.test(said),
        'arming says how many pairs it found',
        'ARMING SAID NOTHING - the pair count is the only thing the buttons cannot show'));

    log('console.errors', errs.length ? errs.join(' | ').slice(0, 300) : 'none');
  }

  var posted = false;
  function post() {
    if (posted) return;
    posted = true;
    try { fetch('/result', { method: 'POST', body: out.join('\n') }); } catch (e) {}
  }
  setTimeout(function () {
    if (!posted) { out.push('WATCHDOG=main did not finish - the last line above is where it hung'); post(); }
  }, 45000);
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
