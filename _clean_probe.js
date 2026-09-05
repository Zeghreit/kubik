/* Clean up (a2.81). Tris to quads is only worth having if it makes an
   imported mesh EDITABLE, so that is what gets asserted - not the pair count. */
(function () {
  var out = [], errs = [];
  var _ce = console.error;
  console.error = function () { errs.push(Array.prototype.join.call(arguments, ' ')); _ce.apply(console, arguments); };
  function log(k, v) { out.push(k + '=' + v); }
  var k, A, THREE;

  function faces(o) { return o.mesh.geometry.groups.length; }
  function tris(o) { return o.mesh.geometry.index.count / 3; }
  function mats(o) { return Array.isArray(o.mesh.material) ? o.mesh.material.length : 1; }
  function verts(o) { return o.mesh.userData.topo.logicalCount; }
  function sizeOf(o) {
    return new THREE.Box3().setFromBufferAttribute(
      o.mesh.geometry.attributes.position).getSize(new THREE.Vector3());
  }
  function sel(o) {
    A.selectedObjectIds = new Set([o.id]); A.activeObjectId = o.id;
    k.setMode('object'); k.refreshUI(); k.ensureHelpers(o);
    return o;
  }
  // How many face groups have exactly n triangles.
  function withTris(o, n) {
    var c = 0;
    o.mesh.geometry.groups.forEach(function (g) { if (g.count / 3 === n) c++; });
    return c;
  }

  /* A GRID OF LOOSE TRIANGLES, which is what an imported mesh looks like:
     every triangle its own face group. Built by hand because no primitive
     makes one - a Kubik plane is a single quad face. */
  function triGrid(name, nx, nz, bend) {
    var positions = [], groups = [];
    function push(x, z) {
      /* WARPED, not merely curved. Any height of the form f(x)+g(z) - and
         bend*(x*x+z*z) is exactly that - leaves every axis-aligned quad
         PLANAR, because its corner heights satisfy yA+yC = yB+yD. The first
         fixture used it, so its "curved" grid had perfectly flat quads and
         the angle threshold measured nothing. A product term warps them. */
      var y = bend ? bend * x * z : 0;
      positions.push(x, y, z);
      return positions.length / 3 - 1;
    }
    for (var i = 0; i < nx; i++) {
      for (var j = 0; j < nz; j++) {
        var x0 = i, x1 = i + 1, z0 = j, z1 = j + 1;
        var a = push(x0, z0), b = push(x1, z0), c = push(x1, z1), d = push(x0, z1);
        // two triangles, each its OWN group - the import shape
        groups.push({ triangles: [[a, c, b]] });
        groups.push({ triangles: [[a, d, c]] });
      }
    }
    var ms = groups.map(function () {
      return new THREE.MeshStandardMaterial({ color: 0x888888 });
    });
    var o = k.createObjectFromEditable(name, new THREE.Vector3(0, 0, 0),
      { positions: positions, groups: groups }, ms, {});
    return sel(o);
  }

  function main() {
    k = window.__kubik; A = k.App; THREE = k.THREE;

    // ---- 1. the fixture really is triangle soup ----
    var o1 = triGrid('C1', 3, 3, 0);
    log('1.grid', faces(o1) + ' faces, ' + tris(o1) + ' triangles, ' + verts(o1) + ' vertices');
    log('1.all_singles', withTris(o1, 1) === faces(o1) && faces(o1) === 18
      ? 'every face is one triangle - 18 of them, which is what an import looks like'
      : 'FIXTURE IS WRONG: ' + withTris(o1, 1) + ' single-triangle faces of ' + faces(o1));

    // ---- 2. THE POINT: loop cut cannot cross it before ----
    k.setMode('edge');
    A.selectedElements = new Set([0]);
    k.refreshUI();
    var before2 = tris(o1);
    var cutBefore = k.edgeLoopOp(o1, o1.mesh.userData.topo.edges[0], [0.5]);
    log('2.loopcut_before', (cutBefore ? 'cut ' + cutBefore : 'refused') +
      ' - "' + (k.opRefusal || 'no reason') + '"');
    log('2.cannot_be_cut', !cutBefore && tris(o1) === before2
      ? 'a ring can only cross four-sided faces, so an all-triangle mesh cannot be loop cut at all'
      : 'IT CUT ANYWAY - the fixture does not show the problem');

    // ---- 3. pairing turns them into quads ----
    var o3 = triGrid('C3', 3, 3, 0);
    var t3 = tris(o3);
    var paired = k.trisToQuadsOp(o3, 20);
    k.ensureHelpers(o3);
    log('3.paired', paired + ' pairs made');
    log('3.after', faces(o3) + ' faces, ' + tris(o3) + ' triangles, ' + mats(o3) + ' materials');
    log('3.geometry_untouched', tris(o3) === t3
      ? 'not one triangle was created or destroyed - it is a regrouping, nothing more'
      : 'THE GEOMETRY CHANGED: ' + t3 + ' -> ' + tris(o3) + ' triangles');
    log('3.all_quads', withTris(o3, 2) === 9 && faces(o3) === 9
      ? 'nine two-triangle faces from eighteen loose ones - a clean quad grid'
      : 'NOT A CLEAN GRID: ' + withTris(o3, 2) + ' quads of ' + faces(o3) + ' faces');
    log('3.materials_match', faces(o3) === mats(o3)
      ? 'the material array still matches the group count'
      : 'MISMATCH ' + faces(o3) + ' vs ' + mats(o3));

    // ---- 4. AND NOW IT CAN BE LOOP CUT ----
    k.setMode('edge');
    A.selectedElements = new Set([0]);
    k.refreshUI();
    var before4 = tris(o3);
    var cutAfter = k.edgeLoopOp(o3, o3.mesh.userData.topo.edges[0], [0.5]);
    k.ensureHelpers(o3);
    log('4.loopcut_after', (cutAfter ? 'cut ' + cutAfter + ' faces' : 'REFUSED: ' + (k.opRefusal || '')));
    log('4.now_editable', cutAfter && tris(o3) > before4
      ? 'the same mesh takes a loop cut once its triangles are paired - that is what the op is for'
      : 'STILL CANNOT BE CUT');

    // ---- 5. the angle threshold is what does the work ----
    var o5a = triGrid('C5a', 3, 3, 0.6);       // a WARPED grid
    var p5a = k.trisToQuadsOp(o5a, 2);
    var o5b = triGrid('C5b', 3, 3, 0.6);
    var p5b = k.trisToQuadsOp(o5b, 45);
    log('5.fixture_is_warped', p5a < 9
      ? 'at 2 degrees it could not pair everything, so the quads really are warped'
      : 'FIXTURE IS FLAT - 9 pairs even at 2 degrees, so section 5 tests nothing');
    log('5.tight_vs_loose', 'at 2 degrees ' + p5a + ' pairs, at 45 degrees ' + p5b + ' pairs');
    log('5.threshold_bites', p5b > p5a
      ? 'a wider angle pairs more of a CURVED surface - which is the case the import path cannot reach at its fixed 1.15 degrees'
      : 'THE THRESHOLD DID NOTHING: ' + p5a + ' vs ' + p5b);

    // ---- 6. it will not pair across a material boundary ----
    var o6 = triGrid('C6', 2, 1, 0);
    // give the two triangles of the first quad different library entries
    o6.mesh.userData.finishes = { 0: 'aaa', 1: 'bbb' };
    var p6 = k.trisToQuadsOp(o6, 45);
    log('6.mixed_materials', 'pairs made: ' + p6 + ' of a possible 2');
    log('6.respects_material', p6 <= 1
      ? 'two faces on different library entries were left alone - pairing them would silently repaint half a face'
      : 'IT MERGED ACROSS A MATERIAL BOUNDARY');

    // ---- 7. an already-quad mesh is refused, not churned ----
    var o7 = sel(k.createCubeObject('C7', new THREE.Vector3(0, 0, 0)));
    var f7 = faces(o7);
    var p7 = k.trisToQuadsOp(o7, 45);
    log('7.cube', 'returned ' + p7 + ', faces ' + f7 + ' -> ' + faces(o7));
    log('7.refused', p7 === 0 && faces(o7) === f7
      ? 'a cube is already six quads and is left exactly alone'
      : 'IT CHURNED AN ALREADY-CLEAN MESH');

    // ---- 8. merge by distance closes a crack ----
    /* Two quads a hair apart along x - the classic import seam. */
    var o8 = (function () {
      var eps = 0.004;
      var positions = [
        0, 0, 0,  1, 0, 0,  1, 0, 1,  0, 0, 1,
        1 + eps, 0, 0,  2, 0, 0,  2, 0, 1,  1 + eps, 0, 1
      ];
      var groups = [
        { triangles: [[0, 2, 1], [0, 3, 2]] },
        { triangles: [[4, 6, 5], [4, 7, 6]] }
      ];
      var ms = [new THREE.MeshStandardMaterial({ color: 0x888888 }),
                new THREE.MeshStandardMaterial({ color: 0x888888 })];
      return sel(k.createObjectFromEditable('C8', new THREE.Vector3(0, 0, 0),
        { positions: positions, groups: groups }, ms, {}));
    })();
    var v8 = verts(o8);
    log('8.cracked', v8 + ' vertices - the two quads are 0.004 apart and do not share corners');
    var m8 = k.mergeByDistanceOp(o8, 0.01);   // 1% of a 2-unit model = 0.02
    k.ensureHelpers(o8);
    log('8.merged', m8 + ' vertices merged, now ' + verts(o8) + ' vertices, ' +
      faces(o8) + ' faces, ' + tris(o8) + ' triangles');
    log('8.crack_closed', verts(o8) === 6 && faces(o8) === 2 && tris(o8) === 4
      ? 'the seam is welded: six shared corners, both faces intact, no triangle lost'
      : 'WRONG RESULT: ' + verts(o8) + ' vertices, ' + faces(o8) + ' faces, ' + tris(o8) + ' triangles');

    // ---- 9. too small a distance does nothing, and says so ----
    var o9 = triGrid('C9', 2, 2, 0);
    var v9 = verts(o9);
    var m9 = k.mergeByDistanceOp(o9, 0.0002);
    log('9.tiny', 'returned ' + m9 + ', vertices ' + v9 + ' -> ' + verts(o9));
    log('9.no_silent_success', m9 === 0 && verts(o9) === v9
      ? 'a distance nothing falls inside is refused rather than reported as a success'
      : 'IT CLAIMED TO MERGE SOMETHING');

    // ---- 10. a huge distance is refused rather than collapsing the model ----
    var o10 = triGrid('C10', 2, 2, 0);
    var f10 = faces(o10);
    var m10 = k.mergeByDistanceOp(o10, 5);
    log('10.huge', 'returned ' + m10 + ', faces ' + f10 + ' -> ' + faces(o10));
    log('10.not_collapsed', faces(o10) === f10
      ? 'a distance that would swallow the whole model is refused and the mesh is untouched'
      : 'THE MODEL WAS COLLAPSED TO ' + faces(o10) + ' faces');

    // ---- 11. it survives the app's own machinery ----
    var o11 = triGrid('C11', 3, 3, 0);
    k.trisToQuadsOp(o11, 20);
    var threw = null;
    try {
      k.ensureHelpers(o11); k.applyShading(o11); k.refreshUI();
      k.rebuildFromEditable(o11, k.toEditable(o11.mesh));
      k.ensureHelpers(o11);
    } catch (e) { threw = e && e.message; }
    log('11.round_trip', threw ? 'THREW: ' + threw
      : 'shades, re-reads and rebuilds cleanly - ' + faces(o11) + ' faces');

    // ---- 12-15. THROUGH THE OP BAR ----
    var o12 = triGrid('C12', 3, 3, 0);
    sel(o12);
    k.cleanupSelection();
    var op = A.pendingOp;
    log('12.opens', op ? 'bar open: ' + op.kind + ', mode ' + op.groupMode +
      ', amount ' + op.amount : 'NO PENDING OP');
    k.flushPendingApply();
    k.ensureHelpers(o12);
    log('13.preview', faces(o12) < 18
      ? 'the preview paired on open: ' + faces(o12) + ' faces'
      : 'NO PREVIEW: still ' + faces(o12) + ' faces');
    // switch to Merge: the amount must jump to ITS range, not stay at 20
    A.pendingOp.groupMode = 'merge';
    k.refreshOpAmountVisibility();
    log('14.chip_range', A.pendingOp.amount <= 0.05
      ? 'switching to Merge moved the amount into its own range (' +
        A.pendingOp.amount + '), not 20 degrees read as 2000% of the model'
      : 'THE RANGE DID NOT FOLLOW THE CHIP: ' + A.pendingOp.amount);
    A.pendingOp.groupMode = 'quads';
    k.refreshOpAmountVisibility();
    log('14.back_again', A.pendingOp.amount === 20
      ? 'and going back to Tris to quads restored the 20 degrees it had'
      : 'QUADS CAME BACK AT ' + A.pendingOp.amount);
    k.flushPendingApply();
    k.cancelPendingOp();
    k.ensureHelpers(o12);
    log('15.cancel', faces(o12) === 18
      ? 'cancel put all eighteen loose triangles back'
      : 'CANCEL LEFT ' + faces(o12) + ' faces');

    /* ---- 16. TWO COINCIDENT TRIANGLES. The review's first malformed-quad
       case: they share all three logical edges, so all three candidates
       score a perfect 1.0 and sort to the very front of the greedy. After
       the remap every corner of the mate resolves into the first triangle's
       and the "quad" is two triangles over three vertices - every edge used
       twice, no outline at all. */
    var o16 = (function () {
      var positions = [0, 0, 0, 1, 0, 0, 1, 0, 1,
                       0, 0, 0, 1, 0, 0, 1, 0, 1];
      var groups = [{ triangles: [[0, 2, 1]] }, { triangles: [[3, 5, 4]] }];
      var ms = groups.map(function () { return new THREE.MeshStandardMaterial({ color: 0x888888 }); });
      return sel(k.createObjectFromEditable('C16', new THREE.Vector3(0, 0, 0),
        { positions: positions, groups: groups }, ms, {}));
    })();
    var f16 = faces(o16);
    var p16 = k.trisToQuadsOp(o16, 45);
    k.ensureHelpers(o16);
    log('16.duplicates', 'returned ' + p16 + ', faces ' + f16 + ' -> ' + faces(o16));
    log('16.refused', p16 === 0 && faces(o16) === f16
      ? 'two triangles sitting on top of each other are not a quad, and are left alone'
      : 'IT PAIRED COINCIDENT TRIANGLES into a face with no outline');

    /* ---- 17. A FOLDED PAIR WOUND INCONSISTENTLY. The second case: folded
       back on itself the normals still agree, so the angle test passes, but
       both triangles emit the shared edge the SAME way and the outline walk
       returns three entries for a four-corner face - not loop-cuttable, and
       it tears the next time anything builds a rim from it. */
    var o17 = (function () {
      var positions = [0, 0, 0,  1, 0, 0,  0, 0, 1,          // A
                       0, 0, 0,  1, 0, 0,  0, 0, -1];        // B, folded over the shared edge
      // wound so that both use the edge 0->1 in the SAME direction
      var groups = [{ triangles: [[0, 1, 2]] }, { triangles: [[3, 4, 5]] }];
      var ms = groups.map(function () { return new THREE.MeshStandardMaterial({ color: 0x888888 }); });
      return sel(k.createObjectFromEditable('C17', new THREE.Vector3(0, 0, 0),
        { positions: positions, groups: groups }, ms, {}));
    })();
    var f17 = faces(o17);
    var p17 = k.trisToQuadsOp(o17, 60);
    k.ensureHelpers(o17);
    var ring17 = -1;
    if (faces(o17) === 1) {
      var ed17 = k.toEditable(o17.mesh);
      var lp17 = k.getGroupBoundaryLoopAttr(ed17, 0);
      ring17 = lp17 ? lp17.length : -1;
    }
    log('17.folded', 'returned ' + p17 + ', faces ' + f17 + ' -> ' + faces(o17) +
      (ring17 >= 0 ? ', outline ' + ring17 + ' sides' : ''));
    log('17.only_real_quads', p17 === 0 || ring17 === 4
      ? 'anything that would not come out as a genuine four-sided face is refused'
      : 'IT BUILT A ' + ring17 + '-SIDED "QUAD"');

    /* ---- 18. A TRIANGLE MEETING A QUAD is not a manifold pair. Counting
       only the single-triangle faces cannot tell the difference. */
    var o18 = (function () {
      var positions = [
        0, 0, 0,  1, 0, 0,  1, 0, 1,  0, 0, 1,      // an existing QUAD 0..3
        1, 0, 0,  2, 0, 0,  1, 0, 1,                // triangle sharing edge (1,0)-(1,1)
        1, 0, 1,  2, 0, 0,  2, 0, 1                 // its neighbour
      ];
      var groups = [
        { triangles: [[0, 2, 1], [0, 3, 2]] },      // the quad
        { triangles: [[4, 6, 5]] },
        { triangles: [[7, 9, 8]] }
      ];
      var ms = groups.map(function () { return new THREE.MeshStandardMaterial({ color: 0x888888 }); });
      return sel(k.createObjectFromEditable('C18', new THREE.Vector3(0, 0, 0),
        { positions: positions, groups: groups }, ms, {}));
    })();
    var p18 = k.trisToQuadsOp(o18, 45);
    k.ensureHelpers(o18);
    log('18.t_junction', 'returned ' + p18 + ', faces now ' + faces(o18));
    log('18.quad_not_counted', faces(o18) >= 2
      ? 'the existing quad was not bonded to a triangle - the edge census counts every face, not only the triangles'
      : 'IT BONDED ACROSS A T-JUNCTION: ' + faces(o18) + ' faces left');

    /* ---- 19. SMOOTH AND FLAT ARE NOT THE SAME FACE. smoothGroups is a
       separate map the finishes guard says nothing about, and `add` keeps
       only the lower group's flag - so group ORDER decided which shading
       survived a pairing. */
    var o19 = triGrid('C19', 1, 1, 0);
    o19.mesh.userData.smoothGroups = { 0: true };
    var p19 = k.trisToQuadsOp(o19, 45);
    log('19.mixed_shading', 'returned ' + p19 + ' of a possible 1');
    log('19.respects_shading', p19 === 0
      ? 'a smooth face and a flat one are left as they are rather than one silently winning'
      : 'IT PAIRED ACROSS A SHADING BOUNDARY');

    /* ---- 20. A CREASE ON A MERGED EDGE. creases are position-keyed, and
       this op both moves vertices and collapses edges. */
    var o20 = (function () {
      var eps = 0.004;
      var positions = [
        0, 0, 0,  1, 0, 0,  1, 0, 1,  0, 0, 1,
        1 + eps, 0, 0,  2, 0, 0,  2, 0, 1,  1 + eps, 0, 1
      ];
      var groups = [
        { triangles: [[0, 2, 1], [0, 3, 2]] },
        { triangles: [[4, 6, 5], [4, 7, 6]] }
      ];
      var ms = [new THREE.MeshStandardMaterial({ color: 0x888888 }),
                new THREE.MeshStandardMaterial({ color: 0x888888 })];
      return sel(k.createObjectFromEditable('C20', new THREE.Vector3(0, 0, 0),
        { positions: positions, groups: groups }, ms, {}));
    })();
    // one crease that SURVIVES the merge (the far edge) and one that is
    // ON the seam, whose two ends land on each other
    var keepK = k.creaseKeyFor(new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 0, 1));
    var dieK = k.creaseKeyFor(new THREE.Vector3(1, 0, 0), new THREE.Vector3(1 + 0.004, 0, 0));
    o20.mesh.userData.creases = {};
    o20.mesh.userData.creases[keepK] = true;
    o20.mesh.userData.creases[dieK] = true;
    k.mergeByDistanceOp(o20, 0.01);
    k.ensureHelpers(o20);
    var got20 = Object.keys(o20.mesh.userData.creases || {});
    log('20.creases', got20.length + ' of 2 left');
    log('20.marks_travel', got20.length === 1 && got20[0] === keepK
      ? 'the surviving crease kept its edge, and the one whose ends merged onto each other was dropped rather than left aliasing a point'
      : 'WRONG: ' + got20.length + ' creases, match=' + (got20[0] === keepK));

    /* ---- 21. THE READOUT. Merge steps by 0.0002, and three decimals shows
       its first two stops as "0". */
    var o21 = triGrid('C21', 2, 2, 0);
    sel(o21);
    k.cleanupSelection();
    A.pendingOp.groupMode = 'merge';
    k.refreshOpAmountVisibility();
    k.setPendingAmount(0.0004);
    var shown = document.getElementById('opValue').value;
    log('21.readout', 'amount ' + A.pendingOp.amount + ' shows as "' + shown + '"');
    log('21.not_zero', Number(shown) > 0
      ? 'the readout takes its decimals from the step, so a small merge distance does not display as 0'
      : 'THE READOUT SHOWS ZERO for a real value');
    k.cancelPendingOp();

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
