/* a2.72 - can you select a thing you cannot see?

   The diagnosis from a2.68, restated as a measurement rather than a belief:

   `vertexVisible` and `edgeVisible` are FACING tests, not occlusion tests -
   "is any face touching this turned toward the camera". On a convex cube
   that is exactly back-face culling and it is correct. On anything concave,
   or on any model with an inner wall, a hidden component sits on a
   camera-facing face and stays a candidate.

   `preferUnoccluded` is a real occlusion test, but it only runs with TWO or
   more candidates and returns the whole list when every one of them is
   hidden - so a lone hidden candidate is never refused.

   The fixture is the smallest thing that has an inner wall: two quads facing
   the camera, a big one in front and a smaller one behind it, in ONE object.
   Every corner of the back quad is on a camera-facing face AND behind the
   front quad. That is a wall inside a box, which is what every real model
   that is not a cube has. */
(function () {
  var out = [], errs = [];
  var _ce = console.error;
  console.error = function () { errs.push(Array.prototype.join.call(arguments, ' ')); _ce.apply(console, arguments); };
  function log(k, v) { out.push(k + '=' + v); }
  var k, A;

  function main() {
    k = window.__kubik; A = k.App;
    var THREE = k.THREE;

    /* ---- the fixture ---- */
    var positions = [
      -1, -1, 1,   1, -1, 1,   1, 1, 1,   -1, 1, 1,        // 0..3 front quad
      -0.6, -0.6, -1,  0.6, -0.6, -1,  0.6, 0.6, -1,  -0.6, 0.6, -1  // 4..7 back
    ];
    var groups = [
      { triangles: [[0, 1, 2], [0, 2, 3]] },     // front, wound toward +z
      { triangles: [[4, 5, 6], [4, 6, 7]] }      // back, ALSO wound toward +z
    ];
    var obj = k.createCubeObject('Wall', new THREE.Vector3(0, 0, 0));
    k.rebuildFromEditable(obj, { positions: positions, groups: groups });
    A.selectedObjectIds = new Set([obj.id]);
    A.activeObjectId = obj.id;
    A.selectedElements = new Set();
    A.xraySelection = false;
    k.setMode('vertex');
    k.ensureHelpers(obj);

    // Straight down -z, so both quads face the camera square on.
    k.camera.position.set(0, 0, 6);
    k.orbit.target.set(0, 0, 0);
    k.camera.lookAt(0, 0, 0);
    k.camera.updateMatrixWorld(true);
    k.camera.updateProjectionMatrix();
    obj.mesh.updateMatrixWorld(true);

    function screenOf(x, y, z) { return k.worldToScreenPx(new THREE.Vector3(x, y, z)); }
    var vp = document.getElementById('viewport').getBoundingClientRect();
    function ev(s) { return { clientX: s.x + vp.left, clientY: s.y + vp.top }; }

    var sBack = screenOf(0.6, 0.6, -1);     // a corner of the hidden wall
    var sFront = screenOf(1, 1, 1);         // the nearest corner you CAN see
    log('0.geometry', 'front corner at ' + sFront.x.toFixed(0) + ',' + sFront.y.toFixed(0) +
      '  hidden corner at ' + sBack.x.toFixed(0) + ',' + sBack.y.toFixed(0) +
      '  ' + sFront.distanceTo(sBack).toFixed(1) + 'px apart');

    /* The fixture only means anything if the hidden corner is ALONE inside
       the catch radius - otherwise the tie-break could be doing the work. */
    log('0.fixture_is_isolating', sFront.distanceTo(sBack) > 28
      ? 'the visible corner is outside the 28px radius, so the hidden one is the only candidate'
      : 'FIXTURE TOO TIGHT - both corners are candidates (' +
        sFront.distanceTo(sBack).toFixed(1) + 'px)');

    /* ---- 1. The facing test says the hidden corner is visible ----
       Which is the defect in one line: it is asking the wrong question. */
    var pBack = new THREE.Vector3(0.6, 0.6, -1);
    obj.mesh.localToWorld(pBack);
    log('1.facing_test_says', k.vertexVisible(obj, findLogical(obj, 0.6, 0.6, -1))
      ? 'VISIBLE - the facing test passes a corner behind a wall'
      : 'hidden (the facing test caught it)');
    log('1.occlusion_test_says', k.pointOccluded(obj, pBack)
      ? 'occluded - the raycast knows perfectly well it is behind the front quad'
      : 'NOT OCCLUDED - the fixture is wrong, nothing is in front of it');

    /* ---- 2. So what does a tap on it actually select? ---- */
    var hit = k.pickVertexOnActive(ev(sBack));
    var wantHidden = findLogical(obj, 0.6, 0.6, -1);
    log('2.tap_on_hidden_corner', hit === -1
      ? 'nothing - a vertex you cannot see is not selectable'
      : (hit === wantHidden
        ? 'IT SELECTED THE HIDDEN CORNER (logical ' + hit + ')'
        : 'it selected logical ' + hit));

    /* ---- 3. And the free tap should give you what is under your thumb ----
       which is the FRONT quad, not a vertex on the wall behind it. */
    var comp = k.pickComponentOnActive(ev(sBack));
    log('3.free_tap', comp ? comp.type + ' ' + comp.index : 'nothing');
    log('3.free_tap_is_the_front', comp && comp.type === 'face' && comp.index === 0
      ? 'a free tap falls through to the face under the thumb'
      : 'A FREE TAP RETURNED ' + (comp ? comp.type + ' ' + comp.index : 'nothing'));

    /* ---- 4. Nothing visible may become harder to reach ----
       This is the assertion that stops the fix from being "refuse more". */
    var vFront = findLogical(obj, 1, 1, 1);
    log('4.visible_corner_still_picks', k.pickVertexOnActive(ev(sFront)) === vFront
      ? 'the corner you can see is still picked from dead on'
      : 'A VISIBLE CORNER STOPPED WORKING (' + k.pickVertexOnActive(ev(sFront)) + ' vs ' + vFront + ')');
    // ...and from a sloppy 20px away, which is what the radius is for.
    var sloppy = { x: sFront.x - 14, y: sFront.y - 14 };
    log('4.still_forgiving', k.pickVertexOnActive(ev(sloppy)) === vFront
      ? 'and from 20px off, so the catch radius still does its job'
      : 'THE RADIUS STOPPED FORGIVING (' + k.pickVertexOnActive(ev(sloppy)) + ')');

    /* ---- 5. See-through is the escape hatch, and must still work ---- */
    A.xraySelection = true;
    log('5.xray_reaches_it', k.pickVertexOnActive(ev(sBack)) === wantHidden
      ? 'with See-through on, the hidden corner is reachable again'
      : 'SEE-THROUGH NO LONGER REACHES IT (' + k.pickVertexOnActive(ev(sBack)) + ')');
    A.xraySelection = false;

    /* ---- 6. Edges, same question ---- */
    k.setMode('edge');
    A.selectedElements = new Set();
    var sBackMid = screenOf(0.6, 0, -1);          // middle of a hidden wall edge
    var eHit = k.pickEdgeOnActive(ev(sBackMid));
    var eIsHidden = eHit >= 0 && edgeTouches(obj, eHit, 0.6, 0.6, -1);
    log('6.tap_on_hidden_edge', eHit === -1
      ? 'nothing - an edge behind a wall is not selectable either'
      : (eIsHidden ? 'IT SELECTED THE HIDDEN EDGE (' + eHit + ')'
                   : 'it selected edge ' + eHit + ', which is not the hidden one'));
    var sFrontMid = screenOf(1, 0, 1);
    log('6.visible_edge_still_picks', k.pickEdgeOnActive(ev(sFrontMid)) >= 0
      ? 'and a visible edge is still picked'
      : 'A VISIBLE EDGE STOPPED WORKING');

    /* ---- 7. A convex cube must be completely unaffected ----
       The facing test was always right here, and the whole risk of adding a
       real occlusion test is that it starts refusing silhouettes. Every one
       of a cube's 8 corners is on the silhouette from a 3/4 view. */
    var cube = k.createCubeObject('Cube', new THREE.Vector3(0, 0, 0));
    A.selectedObjectIds = new Set([cube.id]);
    A.activeObjectId = cube.id;
    A.selectedElements = new Set();
    k.setMode('vertex');
    k.ensureHelpers(cube);
    k.camera.position.set(3, 2.4, 3.6);
    k.camera.lookAt(0, 0, 0);
    k.camera.updateMatrixWorld(true);
    cube.mesh.updateMatrixWorld(true);
    var topo = cube.mesh.userData.topo;
    var pa = cube.mesh.geometry.attributes.position;
    var got = 0, front = 0;
    for (var l = 0; l < topo.logicalCount; l++) {
      var ai = topo.logicalGroups[l][0];
      var p = new THREE.Vector3(pa.getX(ai), pa.getY(ai), pa.getZ(ai));
      cube.mesh.localToWorld(p);
      if (!k.vertexVisible(cube, l)) continue;    // the far corner, correctly culled
      front++;
      var sp = k.worldToScreenPx(p);
      if (sp && k.pickVertexOnActive(ev(sp)) === l) got++;
    }
    log('7.cube_corners', got + ' of ' + front + ' front-facing corners pick themselves');
    log('7.cube_unaffected', got === front && front >= 7
      ? 'every corner of a plain cube still picks, including the silhouette ones'
      : 'THE CUBE REGRESSED - ' + got + '/' + front);

    /* ---- 8. A HIDDEN CANDIDATE MUST NOT BLOCK A VISIBLE ONE ----
       This is the whole reason the occlusion test is banded rather than a
       filter over one dMin. If the nearest thing to your thumb is hidden and
       something visible sits 18px further out, the visible one is what you
       meant - not "nothing", and certainly not the hidden one.

       The back quad is resized until its corner projects ~18px from the
       front corner, rather than hardcoding a size: the pixel scale depends
       on the FOV and the viewport, and a hardcoded fixture that drifts out
       of the catch radius would pass by not testing anything. */
    A.selectedObjectIds = new Set([obj.id]);
    A.activeObjectId = obj.id;
    A.selectedElements = new Set();
    k.setMode('vertex');
    k.camera.position.set(0, 0, 6);
    k.camera.lookAt(0, 0, 0);
    k.camera.updateMatrixWorld(true);

    /* The gap SHRINKS as h grows, and it bottoms out at zero where the two
       corners project on top of each other - so bracket the search at that
       point and bisect a monotonic stretch. */
    var camZ = k.camera.position.z;
    var hOverlap = 1 * (camZ + 1) / (camZ - 1);
    var lo = 0.4, hi = hOverlap, h = 1;
    for (var it = 0; it < 50; it++) {
      h = (lo + hi) / 2;
      var d = screenOf(h, h, -1).distanceTo(sFront);
      if (d > 18) lo = h; else hi = h;
    }
    var pos8 = [
      -1, -1, 1,   1, -1, 1,   1, 1, 1,   -1, 1, 1,
      -h, -h, -1,   h, -h, -1,   h, h, -1,   -h, h, -1
    ];
    k.rebuildFromEditable(obj, { positions: pos8, groups: [
      { triangles: [[0, 1, 2], [0, 2, 3]] },
      { triangles: [[4, 5, 6], [4, 6, 7]] }
    ] });
    k.ensureHelpers(obj);
    obj.mesh.updateMatrixWorld(true);

    var sHidden8 = screenOf(h, h, -1);
    var sFront8 = screenOf(1, 1, 1);
    var vFront8 = findLogical(obj, 1, 1, 1);
    var vHidden8 = findLogical(obj, h, h, -1);
    var gap8 = sHidden8.distanceTo(sFront8);
    log('8.fixture', 'hidden corner ' + gap8.toFixed(1) + 'px from the visible one, ' +
      'both inside the 28px radius');
    var pH8 = new THREE.Vector3(h, h, -1); obj.mesh.localToWorld(pH8);
    log('8.hidden_is_hidden', k.pointOccluded(obj, pH8) && gap8 < 28 && gap8 > 8
      ? 'and it really is behind the front quad, outside the 8px tie band'
      : 'FIXTURE WRONG (gap ' + gap8.toFixed(1) + ', occluded ' + k.pointOccluded(obj, pH8) + ')');

    var got8 = k.pickVertexOnActive(ev(sHidden8));
    log('8.visible_wins_from_further', got8 === vFront8
      ? 'tapping the hidden corner selects the VISIBLE one 18px away instead'
      : (got8 === vHidden8 ? 'IT STILL TOOK THE HIDDEN ONE'
         : got8 === -1 ? 'IT REFUSED INSTEAD OF FALLING THROUGH TO THE VISIBLE ONE'
         : 'it selected logical ' + got8));
    /* And the reported distance is the WINNER's, or a vertex you cannot see
       would go on beating an edge you can in the free tap. */
    log('8.distance_is_the_winners', got8 === vFront8 && k.pickDistPx > 8
      ? 'and the reported distance is the winner\'s (' + k.pickDistPx.toFixed(1) +
        'px), not the hidden one\'s'
      : 'pickDistPx=' + k.pickDistPx.toFixed(1));

    /* ---- 9. A locked-mode refusal must say WHY ----
       "Nothing happened" is indistinguishable from the app being broken,
       which is how this whole strand was reported in the first place. */
    k.rebuildFromEditable(obj, { positions: positions, groups: groups });
    k.ensureHelpers(obj);
    obj.mesh.updateMatrixWorld(true);
    k.setMode('vertex');
    A.selectedElements = new Set([findLogical(obj, 1, 1, 1)]);   // lock the type
    /* WRONG TYPE BEATS HIDDEN, because it is the more specific finding. A
       hidden vertex has surface in front of it by definition, so there is
       always a face under the thumb, and "that is a face - vertex is
       locked" is both true and the thing to act on. See 12 for the case
       where "hidden" is the only honest answer left. */
    var p9 = k.pickComponentOnActive(ev(sBack));
    log('9.locked_tap_on_hidden', p9 === null && k.pickBlockedBy === 'face'
      ? 'refused as "a face - vertex is locked", which is the specific truth'
      : 'GOT ' + (p9 ? p9.type : 'null') + ' / blocked=' + k.pickBlockedBy);

    /* ---- 11. YOU CAN ALWAYS LET GO OF WHAT YOU ARE HOLDING ----
       Box select, grow and loop select all reach components occlusion would
       refuse - none of them consults visibility - and a selected element's
       dot is drawn. So refusing a tap on one made it impossible to drop from
       the selection by any means but clearing the lot. */
    var vHidden11 = findLogical(obj, 0.6, 0.6, -1);
    A.selectedElements = new Set([vHidden11]);        // as a box select would
    log('11.deselect_reaches_it', k.pickVertexOnActive(ev(sBack)) === vHidden11
      ? 'a hidden vertex you have already selected can still be tapped to drop it'
      : 'IT CANNOT BE DESELECTED (' + k.pickVertexOnActive(ev(sBack)) + ')');
    /* And that fallback must never steal a tap from something visible. */
    A.selectedElements = new Set([vHidden11]);
    log('11.fallback_never_steals', k.pickVertexOnActive(ev(sFront)) === findLogical(obj, 1, 1, 1)
      ? 'and it still loses to a visible candidate, because it only runs last'
      : 'THE SELECTED-HIDDEN FALLBACK STOLE A VISIBLE TAP');
    A.selectedElements = new Set();

    /* ---- 12. Where "hidden" is the only honest answer ----
       A single-sided surface seen from behind. The renderer culls it, so
       nothing is drawn and nothing occludes - but the vertex dots ARE depth
       tested rather than back-face culled, so you can see dots floating on
       an invisible surface. Only the FACING test refuses those, and before
       this it refused them in complete silence: no face under the thumb
       either, so the tap evaporated. */
    var plane = k.createCubeObject('Plane', new THREE.Vector3(0, 0, 0));
    plane.mesh.material.forEach(function (mm) { mm.dispose(); });
    plane.mesh.material = k.makeMaterialSet(1, 0x888888);
    k.rebuildFromEditable(plane, {
      positions: [-1, -1, 0, 1, -1, 0, 1, 1, 0, -1, 1, 0],
      groups: [{ triangles: [[0, 1, 2], [0, 2, 3]] }]
    });
    A.selectedObjectIds = new Set([plane.id]);
    A.activeObjectId = plane.id;
    A.selectedElements = new Set();
    k.setMode('vertex');
    k.ensureHelpers(plane);
    k.refreshXrayMode();                 // so the material takes FrontSide
    k.camera.position.set(0, 0, -5);     // BEHIND it
    k.camera.lookAt(0, 0, 0);
    k.camera.updateMatrixWorld(true);
    plane.mesh.updateMatrixWorld(true);
    var sCorner12 = k.worldToScreenPx(new THREE.Vector3(1, 1, 0));
    var l12 = findLogical(plane, 1, 1, 0);
    log('12.facing_refuses_it', !k.vertexVisible(plane, l12)
      ? 'the facing test refuses a corner on the back of a single-sided plane'
      : 'THE FACING TEST PASSED IT');
    log('12.nothing_else_is_there', k.pickFaceOnActive(ev(sCorner12)) === -1
      ? 'and there is no face under the thumb either - the ray goes straight through'
      : 'A FACE WAS HIT FROM BEHIND');
    A.selectedElements = new Set([l12]);   // lock the type so the message path runs
    /* ON the dot, not near it: a tap outside the 28px radius considers no
       candidate at all, so there is nothing for the app to report and the
       first version of this assertion was measuring an empty radius. */
    var p12 = k.pickComponentOnActive(ev(sCorner12));
    log('12.says_hidden', p12 === null && k.pickBlockedBy === 'hidden'
      ? 'so a locked tap on it says "behind the surface" instead of evaporating'
      : 'GOT ' + (p12 ? p12.type : 'null') + ' / blocked=' + k.pickBlockedBy);
    A.selectedElements = new Set();

    /* ---- 10. The cost, on a mesh dense enough for it to matter ----
       Each occlusion test is a raycast against the whole mesh, and a dense
       model can put thirty candidates inside 28px. OCC_TEST_BUDGET bounds
       it; this is the measurement that says whether the bound is doing its
       job or whether picking has quietly become a frame-eater. */
    var N = 24;
    var gp = [], gg = [];
    for (var gy = 0; gy <= N; gy++) for (var gx = 0; gx <= N; gx++)
      gp.push(gx / N * 2 - 1, gy / N * 2 - 1, 0);
    function gi2(x, y) { return y * (N + 1) + x; }
    for (var cy = 0; cy < N; cy++) for (var cx = 0; cx < N; cx++)
      gg.push({ triangles: [[gi2(cx, cy), gi2(cx + 1, cy), gi2(cx + 1, cy + 1)],
                            [gi2(cx, cy), gi2(cx + 1, cy + 1), gi2(cx, cy + 1)]] });
    var dense = k.createCubeObject('Dense', new THREE.Vector3(0, 0, 0));
    /* A material PER GROUP, the way the importer does it. Left at
       createCubeObject's six, material[6..] is undefined and three's own
       raycast throws on `material.side` - which is a crash in the probe,
       not in the app, but it is the same mistake the importer had to fix. */
    dense.mesh.material.forEach(function (mm) { mm.dispose(); });
    dense.mesh.material = k.makeMaterialSet(gg.length, 0x888888);
    k.rebuildFromEditable(dense, { positions: gp, groups: gg });
    A.selectedObjectIds = new Set([dense.id]);
    A.activeObjectId = dense.id;
    A.selectedElements = new Set();
    k.setMode('vertex');
    k.ensureHelpers(dense);
    k.camera.position.set(0, 0, 3);
    k.camera.lookAt(0, 0, 0);
    k.camera.updateMatrixWorld(true);
    dense.mesh.updateMatrixWorld(true);
    var topo10 = dense.mesh.userData.topo;
    log('10.dense_mesh', topo10.faceGroups.length + ' faces, ' +
      topo10.logicalCount + ' vertices, ' + topo10.edges.length + ' edges');

    var taps = [];
    for (var s10 = 0; s10 < 20; s10++) {
      var sp10 = screenOf((s10 % 5) / 5 * 1.6 - 0.8, Math.floor(s10 / 5) / 4 * 1.6 - 0.8, 0);
      if (sp10) taps.push(ev(sp10));
    }
    /* RAYCASTS, not milliseconds. performance.now() is frozen under headless
       --virtual-time-budget, so a timing assertion here reads 0.0ms and
       passes while measuring nothing - which is this project's own
       "a test that reads back what it just wrote" trap in another costume.
       The raycast count is deterministic and is exactly what the budget
       bounds. */
    var hits10 = 0, worst = 0;
    taps.forEach(function (e10) {
      k.resetOccCount();
      if (k.pickVertexOnActive(e10) >= 0) hits10++;
      if (k.occTestCount > worst) worst = k.occTestCount;
    });
    log('10.cost', 'worst pick on that mesh cost ' + worst + ' occlusion raycasts (budget ' +
      k.OCC_TEST_BUDGET + '), ' + hits10 + ' of ' + taps.length + ' taps found something');
    log('10.bounded', worst <= k.OCC_TEST_BUDGET && worst > 0
      ? 'the budget holds - a pick can never raycast more than ' + k.OCC_TEST_BUDGET +
        ' times however many candidates are in reach'
      : 'THE BUDGET LEAKED (' + worst + ' raycasts)');
    log('10.dense_still_picks', hits10 === taps.length
      ? 'and every tap on a dense flat mesh still finds a vertex'
      : 'ONLY ' + hits10 + ' OF ' + taps.length + ' TAPS FOUND ANYTHING');

    /* ================= a2.76: the box, too =================
       a2.72 made "you cannot select what you cannot see" true of TAP only.
       A box swept up the back of everything it crossed. */
    var cube76 = k.createCubeObject('Box76', new THREE.Vector3(0, 0, 0));
    A.selectedObjectIds = new Set([cube76.id]);
    A.activeObjectId = cube76.id;
    A.selectedElements = new Set();
    A.xraySelection = false;
    A.multiSelect = false;
    k.ensureHelpers(cube76);
    k.camera.position.set(3, 2.4, 3.6);
    k.camera.lookAt(0, 0, 0);
    k.camera.updateMatrixWorld(true);
    cube76.mesh.updateMatrixWorld(true);

    // A rectangle over the whole viewport: everything is inside it, so the
    // only thing that can reduce the count is visibility.
    var whole = { kind: 'box', x0: -9999, y0: -9999, x1: 9999, y1: 9999 };
    var topo76 = cube76.mesh.userData.topo;

    /* ---- 14. Vertices ---- */
    k.setMode('vertex');
    A.selectedElements = new Set();
    k.performRegionSelect(whole);
    var vGot = A.selectedElements.size;
    var vFacing = 0;
    for (var l76 = 0; l76 < topo76.logicalCount; l76++) if (k.vertexVisible(cube76, l76)) vFacing++;
    log('14.cube_vertices', vGot + ' of ' + topo76.logicalCount +
      ' selected by a full-screen box (' + vFacing + ' face the camera)');
    log('14.back_left_out', vGot === vFacing && vGot < topo76.logicalCount
      ? 'the corners facing away were left out, as the dots on screen already were'
      : 'IT TOOK ' + vGot + ' OF ' + topo76.logicalCount);

    /* ---- 15. Faces, where it is most obvious ----
       Three faces of a cube face you from a 3/4 view. A box over the whole
       screen used to select all six. */
    k.setMode('face');
    A.selectedElements = new Set();
    k.performRegionSelect(whole);
    var fGot = A.selectedElements.size;
    log('15.cube_faces', fGot + ' of ' + topo76.faceGroups.length + ' faces');
    log('15.three_faces', fGot === 3
      ? 'a box over a cube selects the three faces you can see, not all six'
      : 'IT SELECTED ' + fGot);

    /* ---- 16. See-through is still the way to reach the rest ---- */
    A.xraySelection = true;
    A.selectedElements = new Set();
    k.performRegionSelect(whole);
    var fXray = A.selectedElements.size;
    A.xraySelection = false;
    log('16.xray_takes_all', fXray === topo76.faceGroups.length
      ? 'with See-through on, the same box takes all ' + fXray
      : 'SEE-THROUGH GAVE ' + fXray + ' OF ' + topo76.faceGroups.length);

    /* And GROW must NOT be filtered - it is topological, not screen-space.
       A neighbour that faces away is still the neighbour you asked for. */
    k.setMode('face');
    A.selectedElements = new Set([0]);
    var grew = k.grownElements ? k.grownElements(cube76) : null;
    log('16.grow_unfiltered', grew && grew.size > 1
      ? 'grow still reaches round the model (' + grew.size + ' from 1) - it is topology, not what is on screen'
      : 'GROW WAS FILTERED TOO (' + (grew ? grew.size : 'n/a') + ')');

    /* ---- 17. The memo, which is the only reason this is affordable ----
       vertexVisible asks groupFacesCamera once per ADJACENT FACE, so a
       sweep over the whole mesh would ask it three or four times per vertex
       without one. */
    var dense76 = k.createCubeObject('Dense76', new THREE.Vector3(0, 0, 0));
    dense76.mesh.material.forEach(function (mm) { mm.dispose(); });
    var gp76 = [], gg76 = [], N76 = 20;
    for (var y76 = 0; y76 <= N76; y76++) for (var x76 = 0; x76 <= N76; x76++)
      gp76.push(x76 / N76 * 2 - 1, y76 / N76 * 2 - 1, 0);
    function ix76(x, y) { return y * (N76 + 1) + x; }
    for (var cy76 = 0; cy76 < N76; cy76++) for (var cx76 = 0; cx76 < N76; cx76++)
      gg76.push({ triangles: [[ix76(cx76, cy76), ix76(cx76 + 1, cy76), ix76(cx76 + 1, cy76 + 1)],
                              [ix76(cx76, cy76), ix76(cx76 + 1, cy76 + 1), ix76(cx76, cy76 + 1)]] });
    dense76.mesh.material = k.makeMaterialSet(gg76.length, 0x888888);
    k.rebuildFromEditable(dense76, { positions: gp76, groups: gg76 });
    A.selectedObjectIds = new Set([dense76.id]);
    A.activeObjectId = dense76.id;
    k.ensureHelpers(dense76);
    k.camera.position.set(0, 0, 4);
    k.camera.lookAt(0, 0, 0);
    k.camera.updateMatrixWorld(true);
    dense76.mesh.updateMatrixWorld(true);
    k.setMode('vertex');
    A.selectedElements = new Set();
    var topoD = dense76.mesh.userData.topo;
    k.performRegionSelect(whole);
    log('17.dense', topoD.logicalCount + ' vertices over ' +
      topoD.faceGroups.length + ' faces; the box took ' + A.selectedElements.size);
    log('17.flat_sheet_all_in', A.selectedElements.size === topoD.logicalCount
      ? 'a flat sheet facing the camera keeps every vertex - the filter costs nothing it should not'
      : 'IT DROPPED ' + (topoD.logicalCount - A.selectedElements.size) + ' VERTICES OF A SHEET FACING THE CAMERA');

    /* ---- 18. WHERE THE FACING TEST DOES NOT REACH ----
       vertexVisible passes a vertex if ANY face touching it faces the
       camera. Every rim vertex of a cylinder touches the cap, so a box takes
       the back rim as well - and reports nothing skipped, because nothing
       was. A tap survives this by raycasting after the facing test; a box
       has no second stage.

       Asserted as it IS, not as it should be. If someone later adds a depth
       pre-pass this flips, and a failing assertion here is exactly the
       prompt to update the note that admits the limit. */
    var cyl = null;
    try {
      // (kind, params, NAME, position) - the name slot is third.
      cyl = k.createPrimitiveObject('cylinder', k.PRIM_SPECS.cylinder.def,
        'Cyl18', new THREE.Vector3(0, 0, 0));
    } catch (e18) { cyl = null; log('18.threw', e18 && e18.message); }
    log('18.built', cyl && cyl.mesh
      ? cyl.name + ', ' + (cyl.mesh.geometry.index.count / 3) + ' triangles'
      : 'createPrimitiveObject returned ' + cyl);
    /* NO FALLBACK. The first version fell back to "the last object in the
       scene", which was section 17's flat sheet - and 441 of 441 on a sheet
       facing the camera is trivially true, so the assertion passed while
       testing nothing at all. If there is no cylinder, say so. */
    // ensureHelpers FIRST - topo does not exist until it runs, so checking
    // for it before was checking whether the probe had asked yet.
    if (cyl && cyl.mesh) k.ensureHelpers(cyl);
    if (cyl && cyl.mesh && cyl.mesh.userData.topo &&
        cyl.mesh.userData.topo.logicalCount > 8) {
      A.selectedObjectIds = new Set([cyl.id]);
      A.activeObjectId = cyl.id;
      A.selectedElements = new Set();
      A.xraySelection = false;
      k.camera.position.set(2.5, 2.0, 3.0);
      k.camera.lookAt(0, 0, 0);
      k.camera.updateMatrixWorld(true);
      cyl.mesh.updateMatrixWorld(true);
      k.setMode('vertex');
      var topoC = cyl.mesh.userData.topo;
      var facingC = 0;
      for (var lc = 0; lc < topoC.logicalCount; lc++) if (k.vertexVisible(cyl, lc)) facingC++;
      A.selectedElements = new Set();
      k.performRegionSelect(whole);
      log('18.cylinder', cyl.name + ': ' + A.selectedElements.size + ' of ' +
        topoC.logicalCount + ' vertices taken; the facing test passes ' + facingC);
      log('18.known_limit', A.selectedElements.size === facingC
        ? 'the box agrees with the facing test, which on a capped shape is ' +
          'MORE than you can see - the documented limit, and the reason the ' +
          'note does not claim occlusion'
        : 'THE BOX AND THE FACING TEST DISAGREE (' + A.selectedElements.size + ' vs ' + facingC + ')');
    } else {
      log('18.cylinder', 'NO CYLINDER BUILT - section 18 tested nothing');
    }

    log('console.errors', errs.length ? errs.join(' | ').slice(0, 400) : 'none');
  }

  // Logical vertex id at a local position, by the app's own welding tolerance.
  function findLogical(obj, x, y, z) {
    var topo = obj.mesh.userData.topo;
    var pa = obj.mesh.geometry.attributes.position;
    var key = Math.round(x * 1e4) + '_' + Math.round(y * 1e4) + '_' + Math.round(z * 1e4);
    for (var l = 0; l < topo.logicalCount; l++) {
      var ai = topo.logicalGroups[l][0];
      var kk = Math.round(pa.getX(ai) * 1e4) + '_' + Math.round(pa.getY(ai) * 1e4) +
               '_' + Math.round(pa.getZ(ai) * 1e4);
      if (kk === key) return l;
    }
    return -1;
  }
  function edgeTouches(obj, ei, x, y, z) {
    var topo = obj.mesh.userData.topo;
    var l = findLogical(obj, x, y, z);
    var e = topo.edges[ei];
    return !!e && (e[0] === l || e[1] === l);
  }

  function ready(cb, t) {
    t = t || 0;
    if (window.__kubik && window.__kubik.App) return cb();
    if (t > 250) { out.push('ERROR=no __kubik'); return finish(); }
    setTimeout(function () { ready(cb, t + 1); }, 20);
  }
  function finish() {
    var pre = document.createElement('pre');
    pre.id = 'probeOut';
    pre.textContent = '<<<PROBE\n' + out.join('\n') + '\nPROBE>>>';
    document.body.appendChild(pre);
    document.title = 'PROBE-DONE';
  }
  window.addEventListener('error', function (e) { errs.push('onerror: ' + (e.message || e)); });
  setTimeout(function () {
    ready(function () {
      setTimeout(function () {
        try { main(); }
        catch (e) { out.push('ERROR=' + (e && e.stack ? e.stack.split('\n').slice(0, 6).join(' / ') : e)); }
        finish();
      }, 600);
    });
  }, 300);
})();
