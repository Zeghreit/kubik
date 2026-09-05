/* Extrude's floor (a2.84). Does an OPEN surface come back closed, does a
   CLOSED one come back untouched, and is the floor wound the right way when
   the drag went backwards? Every section prints its own numbers. */
(function () {
  var out = [], errs = [];
  var _ce = console.error;
  console.error = function () { errs.push(Array.prototype.join.call(arguments, ' ')); _ce.apply(console, arguments); };
  function log(kk, v) { out.push(kk + '=' + v); }
  var k, A, THREE;

  /* Count edges used by exactly one face. A watertight shell has none; an
     open sheet has a rim of them. This is the whole question, so it gets
     measured here rather than taken from the op's own answer. */
  function openEdges(o) {
    var ed = k.toEditable(o.mesh), L = k.edLogical(ed);
    var c = new Map();
    ed.groups.forEach(function (g) {
      g.triangles.forEach(function (t) {
        for (var e = 0; e < 3; e++) {
          var a = L.logicalOf[t[e]], b = L.logicalOf[t[(e + 1) % 3]];
          if (a === b) continue;
          var kk = a < b ? a + '_' + b : b + '_' + a;
          c.set(kk, (c.get(kk) || 0) + 1);
        }
      });
    });
    var once = 0;
    c.forEach(function (n) { if (n === 1) once++; });
    return once;
  }

  function faces(o) { return o.mesh.geometry.groups.length; }
  /* Signed volume of a closed mesh: positive when the faces point OUT.
     `auditWinding.ok` only says the shell agrees with itself - an entirely
     inside-out box passes it. This is the question that one cannot answer. */
  function vol(o) {
    var g = o.mesh.geometry, pos = g.attributes.position, idx = g.index, v = 0;
    var a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3();
    for (var i = 0; i < idx.count; i += 3) {
      a.fromBufferAttribute(pos, idx.getX(i));
      b.fromBufferAttribute(pos, idx.getX(i + 1));
      c.fromBufferAttribute(pos, idx.getX(i + 2));
      v += a.dot(b.clone().cross(c)) / 6;
    }
    return v;
  }
  function mats(o) { return Array.isArray(o.mesh.material) ? o.mesh.material.length : 1; }
  function bbox(o) {
    return new THREE.Box3().setFromBufferAttribute(
      o.mesh.geometry.attributes.position).getSize(new THREE.Vector3());
  }
  function sel(o) {
    A.selectedObjectIds = new Set([o.id]);
    A.activeObjectId = o.id;
    k.setMode('object');
    k.refreshUI();
    return o;
  }
  function plane(name, h, v) {
    var def = Object.assign({}, k.PRIM_SPECS.plane.def);
    if (h) def.h = h;
    if (v) def.v = v;
    return sel(k.createPrimitiveObject('plane', def, name, new THREE.Vector3(0, 0, 0)));
  }
  function cube(name) {
    return sel(k.createPrimitiveObject('cube', k.PRIM_SPECS.cube.def, name,
      new THREE.Vector3(0, 0, 0)));
  }
  /* Two quads sharing a full edge - the smallest sheet with an INTERIOR
     edge, which one plane does not have. Selecting either quad gives a rim
     that is part open and part shared, the case the floor must refuse. */
  function strip(name) {
    var ed = {
      positions: [
        0, 0, 0, 1, 0, 0, 1, 0, 1, 0, 0, 1,
        1, 0, 0, 2, 0, 0, 2, 0, 1, 1, 0, 1
      ],
      groups: [
        { triangles: [[0, 2, 1], [0, 3, 2]] },
        { triangles: [[4, 6, 5], [4, 7, 6]] }
      ]
    };
    return sel(k.createObjectFromEditable(name, new THREE.Vector3(0, 0, 0), ed,
      [new THREE.MeshStandardMaterial({ color: 0x888888 }),
       new THREE.MeshStandardMaterial({ color: 0x888888 })], {}));
  }

  function allFaces(o) {
    return o.mesh.userData.topo.faceGroups.map(function (g, i) { return i; });
  }
  function pickFaces(o, idx) {
    k.setMode('face');
    A.selectedObjectIds = new Set([o.id]);
    A.activeObjectId = o.id;
    A.selectedElements = new Set(idx);
    k.refreshUI();
    return A.selectedElements.size;
  }
  /* The op BAR, not the worker underneath it. a2.78 passed twelve sections
     against arrayOp while the tool itself was broken in six places. */
  function extrude(amount, stacks) {
    k.extrudeSelection();
    if (!A.pendingOp) return 'NO PENDING OP - the bar never opened';
    for (var i = 0; i < (stacks || 0); i++) {
      k.setPendingAmount(amount);
      k.stackExtrudeSection();
    }
    k.setPendingAmount(amount);
    k.confirmPendingOp();
    return 'ran';
  }
  function w(o) { return k.auditWinding(o); }
  /* The Each chip goes through extrudeFaceGroup, a different function to
     the one the Joined chips use. Same drag, same selection - the two have
     to agree. */
  function extrudeEach(amount) {
    k.extrudeSelection();
    if (!A.pendingOp) return 'NO PENDING OP - the bar never opened';
    A.pendingOp.groupMode = 'each';
    k.setPendingAmount(amount);
    k.confirmPendingOp();
    return 'ran';
  }
  function verdict(cond, good, bad) { return cond ? ' - ' + good : ' ' + bad; }

  function main() {
    k = window.__kubik; A = k.App; THREE = k.THREE;

    // ---- 1. a Plane is genuinely open BEFORE we start ----
    var o1 = plane('E1', 1, 1);
    var f1 = faces(o1), open1 = openEdges(o1);
    log('1.fixture', 'faces=' + f1 + ' openEdges=' + open1 +
      verdict(f1 === 1 && open1 === 4,
        'one quad, four open edges - a real open sheet',
        'FIXTURE IS NOT A SINGLE OPEN QUAD - later sections test nothing'));

    // ---- 2. extruded forward, it closes ----
    var n1 = pickFaces(o1, allFaces(o1));
    var r1 = extrude(0.5);
    var a1 = w(o1), open1b = openEdges(o1);
    log('2.forward_run', 'selected=' + n1 + ' extrude=' + r1);
    log('2.forward_closed', 'openEdges=' + open1b + ' boundary=' + a1.boundary +
      ' reversed=' + a1.reversed + ' conflict=' + a1.conflictEdges +
      ' nonManifold=' + a1.nonManifold + ' ok=' + a1.ok +
      verdict(open1b === 0 && a1.boundary === 0 && a1.ok,
        'the box has a bottom', 'STILL OPEN - the floor did not land'));
    log('2.forward_groups', 'faces ' + f1 + ' -> ' + faces(o1) + ' expected 6 (1 face + 4 walls + 1 floor)' +
      ' mats=' + mats(o1) +
      verdict(faces(o1) === 6 && mats(o1) === faces(o1),
        'one floor, materials in step',
        'WRONG GROUP COUNT or materials out of step - three raycast crashes on that'));
    var b1 = bbox(o1);
    log('2.forward_height', 'y=' + b1.y.toFixed(4) +
      verdict(Math.abs(b1.y - 0.5) < 1e-3,
        'the drag distance, so the floor stayed at the old level',
        'NOT THE DRAG DISTANCE - the floor moved with the face'));
    var v1 = vol(o1);
    log('2.forward_outward', 'signedVolume=' + v1.toFixed(4) +
      verdict(v1 > 0, 'faces point out', 'THE WHOLE BOX IS INSIDE OUT'));

    // ---- 3. a closed solid gains walls and nothing else ----
    var o3 = cube('E3');
    var f3 = faces(o3), open3 = openEdges(o3);
    log('3.cube_fixture', 'faces=' + f3 + ' openEdges=' + open3 +
      verdict(open3 === 0, 'closed before', 'THE CUBE FIXTURE WAS ALREADY OPEN'));
    pickFaces(o3, [0]);
    extrude(0.5);
    var a3 = w(o3);
    log('3.cube_untouched', 'faces ' + f3 + ' -> ' + faces(o3) + ' expected ' + (f3 + 4) +
      verdict(faces(o3) === f3 + 4,
        'four walls, no floor',
        'A FLOOR WAS ADDED INSIDE A SOLID - it would sit buried in the extrusion'));
    log('3.cube_closed', 'openEdges=' + openEdges(o3) + ' boundary=' + a3.boundary +
      ' reversed=' + a3.reversed + ' ok=' + a3.ok +
      verdict(openEdges(o3) === 0 && a3.ok, 'still watertight', 'THE CUBE CAME BACK BROKEN'));

    // ---- 4. dragged backwards, the cap is its top and faces the other way ----
    var o4 = plane('E4', 1, 1);
    pickFaces(o4, allFaces(o4));
    extrude(-0.5);
    var a4 = w(o4), b4 = bbox(o4);
    log('4.backwards', 'openEdges=' + openEdges(o4) + ' boundary=' + a4.boundary +
      ' reversed=' + a4.reversed + ' conflict=' + a4.conflictEdges + ' ok=' + a4.ok +
      ' height=' + b4.y.toFixed(4) +
      verdict(openEdges(o4) === 0 && a4.reversed === 0 && a4.ok,
        'closed and wound consistently',
        'THE CAP DISAGREES WITH THE WALLS IT CLOSES'));
    var v4 = vol(o4);
    log('4.backwards_outward', 'signedVolume=' + v4.toFixed(4) +
      verdict(v4 > 0, 'faces point out',
        'INSIDE OUT - and note this is about the whole backwards extrude, not the floor'));

    // ---- 5. stacking adds one floor, not one per section ----
    var o5 = plane('E5', 1, 1);
    pickFaces(o5, allFaces(o5));
    extrude(0.4, 2);
    var a5 = w(o5);
    log('5.stacked', 'faces=' + faces(o5) + ' openEdges=' + openEdges(o5) +
      ' boundary=' + a5.boundary + ' reversed=' + a5.reversed + ' ok=' + a5.ok +
      verdict(openEdges(o5) === 0 && a5.ok,
        'three sections, one floor',
        'STACKING LEFT IT OPEN or piled floors inside itself'));
    log('5.stacked_outward', 'signedVolume=' + vol(o5).toFixed(4) +
      verdict(vol(o5) > 0, 'faces point out', 'STACKED RESULT IS INSIDE OUT'));

    // ---- 6. a mixed rim is refused: half a floor is worse than none ----
    var o6 = strip('E6');
    var f6 = faces(o6), open6 = openEdges(o6);
    log('6.strip_fixture', 'faces=' + f6 + ' openEdges=' + open6 +
      verdict(f6 === 2 && open6 === 6,
        'two quads welded along one shared edge',
        'THE STRIP DID NOT WELD - there is no interior edge, so this tests nothing'));
    pickFaces(o6, [0]);
    extrude(0.5);
    log('6.corner_left_alone', 'faces ' + f6 + ' -> ' + faces(o6) + ' expected ' + (f6 + 4) +
      verdict(faces(o6) === f6 + 4,
        'no floor on a rim that is only half open',
        'A FLOOR WAS ADDED ON A MIXED RIM - it would stop halfway across'));

    // ---- 7. a subdivided plane, every face selected ----
    var o7 = plane('E7', 2, 2);
    var f7 = faces(o7);
    var n7 = pickFaces(o7, allFaces(o7));
    extrude(0.5);
    var a7 = w(o7);
    log('7.subdivided', 'faces ' + f7 + ' selected ' + n7 + ' -> ' + faces(o7) +
      ' openEdges=' + openEdges(o7) + ' boundary=' + a7.boundary +
      ' reversed=' + a7.reversed + ' ok=' + a7.ok +
      verdict(f7 > 1 && openEdges(o7) === 0 && a7.ok,
        'a multi-face sheet closes too',
        'A SUBDIVIDED SHEET DID NOT CLOSE, or the fixture was not subdivided'));
    log('7.subdivided_outward', 'signedVolume=' + vol(o7).toFixed(4) +
      verdict(vol(o7) > 0, 'faces point out', 'SUBDIVIDED RESULT IS INSIDE OUT'));


    // ---- 8. Each agrees with Joined on one face ----
    var o8 = plane('E8', 1, 1);
    var f8 = faces(o8);
    pickFaces(o8, allFaces(o8));
    var r8 = extrudeEach(0.5);
    var a8 = w(o8);
    log('8.each_one_face', 'run=' + r8 + ' faces ' + f8 + ' -> ' + faces(o8) +
      ' openEdges=' + openEdges(o8) + ' boundary=' + a8.boundary +
      ' reversed=' + a8.reversed + ' ok=' + a8.ok +
      ' signedVolume=' + vol(o8).toFixed(4) +
      verdict(openEdges(o8) === 0 && a8.ok && vol(o8) > 0,
        'the Each chip gives the same box as the Joined chips',
        'EACH AND JOINED DISAGREE ON THE SAME DRAG'));

    // ---- 9. Each on a solid still adds no floor ----
    var o9 = cube('E9');
    var f9 = faces(o9);
    pickFaces(o9, [0]);
    extrudeEach(0.5);
    var a9 = w(o9);
    log('9.each_cube', 'faces ' + f9 + ' -> ' + faces(o9) + ' expected ' + (f9 + 4) +
      ' openEdges=' + openEdges(o9) + ' ok=' + a9.ok +
      verdict(faces(o9) === f9 + 4 && openEdges(o9) === 0 && a9.ok,
        'four walls, no buried floor',
        'EACH PUT A FLOOR INSIDE A SOLID'));

    // ---- 10. Each backwards on one face ----
    var o10 = plane('E10', 1, 1);
    pickFaces(o10, allFaces(o10));
    extrudeEach(-0.5);
    var a10 = w(o10);
    log('10.each_backwards', 'openEdges=' + openEdges(o10) + ' reversed=' + a10.reversed +
      ' ok=' + a10.ok + ' signedVolume=' + vol(o10).toFixed(4) +
      verdict(openEdges(o10) === 0 && a10.ok && vol(o10) > 0,
        'closed and pointing out',
        'EACH BACKWARDS IS OPEN OR INSIDE OUT'));

    /* 11. Each over SEVERAL faces of a sheet is left exactly as it was -
       open and non-manifold on a2.83 too. Recorded so the number is on the
       page rather than in somebody's memory, not asserted as good. */
    var o11 = plane('E11', 2, 2);
    var f11 = faces(o11);
    pickFaces(o11, allFaces(o11));
    extrudeEach(0.5);
    var a11 = w(o11);
    log('11.each_many_recorded', 'faces ' + f11 + ' -> ' + faces(o11) +
      ' openEdges=' + openEdges(o11) + ' nonManifold=' + a11.nonManifold +
      ' ok=' + a11.ok + ' - unchanged from a2.83 by design; Joined is the tool for this');

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
  }, 30000);
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
