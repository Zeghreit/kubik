/* Solidify (a2.79). Does an open surface come back closed, the right way
   out, the right thickness, and with the bar behaving? */
(function () {
  var out = [], errs = [];
  var _ce = console.error;
  console.error = function () { errs.push(Array.prototype.join.call(arguments, ' ')); _ce.apply(console, arguments); };
  function log(k, v) { out.push(k + '=' + v); }
  var k, A, THREE;

  function plane(name) {
    var o = k.createPrimitiveObject('plane', k.PRIM_SPECS.plane.def, name || 'P',
      new THREE.Vector3(0, 0, 0));
    A.selectedObjectIds = new Set([o.id]);
    A.activeObjectId = o.id;
    k.setMode('object');
    k.refreshUI();
    return o;
  }
  function cube(name) {
    var o = k.createCubeObject(name || 'C', new THREE.Vector3(0, 0, 0));
    A.selectedObjectIds = new Set([o.id]);
    A.activeObjectId = o.id;
    k.setMode('object');
    k.refreshUI();
    return o;
  }
  /* Two quads sharing a full edge: the smallest surface with an INTERIOR
     edge, which a single plane does not have. */
  function strip(name) {
    var ed = {
      positions: [
        0, 0, 0,  1, 0, 0,  1, 0, 1,  0, 0, 1,
        1, 0, 0,  2, 0, 0,  2, 0, 1,  1, 0, 1
      ],
      groups: [
        { triangles: [[0, 2, 1], [0, 3, 2]] },
        { triangles: [[4, 6, 5], [4, 7, 6]] }
      ]
    };
    var o = k.createObjectFromEditable(name, new THREE.Vector3(0, 0, 0), ed,
      [new THREE.MeshStandardMaterial({ color: 0x888888 }),
       new THREE.MeshStandardMaterial({ color: 0x888888 })], {});
    A.selectedObjectIds = new Set([o.id]);
    A.activeObjectId = o.id;
    k.setMode('object');
    k.refreshUI();
    return o;
  }

  function tris(o) { return o.mesh.geometry.index.count / 3; }
  function faces(o) { return o.mesh.geometry.groups.length; }
  function mats(o) { return Array.isArray(o.mesh.material) ? o.mesh.material.length : 1; }
  function size(o) {
    return new THREE.Box3().setFromBufferAttribute(
      o.mesh.geometry.attributes.position).getSize(new THREE.Vector3());
  }

  /* IS IT CLOSED? Count how many faces use each logical edge. A watertight
     shell uses every edge exactly twice; an open sheet has a rim of edges
     used once. This is the whole point of the op, so it gets measured
     rather than assumed. */
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
  /* AND IS IT THE RIGHT WAY OUT? Signed volume over every triangle: positive
     means the faces wind outward. A shell built with the back copy NOT
     reversed comes out at (or near) zero, which is the failure this catches. */
  /* Per-group signed volume, so a winding fault can be localised instead of
     guessed at. The caps and the walls are separate groups, so the sign
     pattern says which of them disagrees. */
  function groupVolumes(o) {
    var geo = o.mesh.geometry, pos = geo.attributes.position, idx = geo.index;
    var rows = [];
    geo.groups.forEach(function (g, gi) {
      var v = 0, a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3();
      for (var i = g.start; i < g.start + g.count; i += 3) {
        a.fromBufferAttribute(pos, idx.getX(i));
        b.fromBufferAttribute(pos, idx.getX(i + 1));
        c.fromBufferAttribute(pos, idx.getX(i + 2));
        v += a.dot(new THREE.Vector3().crossVectors(b, c)) / 6;
      }
      rows.push('g' + gi + ' ' + v.toFixed(4));
    });
    return rows.join(', ');
  }

  function signedVolume(o) {
    var geo = o.mesh.geometry, pos = geo.attributes.position, idx = geo.index;
    var v = 0, a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3();
    for (var i = 0; i < idx.count; i += 3) {
      a.fromBufferAttribute(pos, idx.getX(i));
      b.fromBufferAttribute(pos, idx.getX(i + 1));
      c.fromBufferAttribute(pos, idx.getX(i + 2));
      v += a.dot(new THREE.Vector3().crossVectors(b, c)) / 6;
    }
    return v;
  }

  function main() {
    k = window.__kubik; A = k.App; THREE = k.THREE;

    // ---- 1. a plane is open to start with ----
    var o1 = plane('S1');
    var f1 = faces(o1), t1 = tris(o1);
    log('1.plane', t1 + ' triangles, ' + f1 + ' faces, ' + openEdges(o1) + ' open edges');
    log('1.is_open', openEdges(o1) > 0
      ? 'a plane has a rim - that is what Solidify is for'
      : 'THE FIXTURE IS NOT OPEN, section 2 would prove nothing');
    var s1 = size(o1);
    log('1.flat', 'y extent ' + s1.y.toFixed(4));

    // ---- 2. solidified, it is closed ----
    var ok2 = k.solidifyOp(o1, 0.1, 'in');
    log('2.built', ok2 ? 'built' : 'REFUSED');
    log('2.counts', tris(o1) + ' triangles, ' + faces(o1) + ' faces, ' + mats(o1) + ' materials');
    log('2.closed', openEdges(o1) === 0
      ? 'no open edges left - every edge is used by exactly two faces, so it is watertight'
      : 'STILL OPEN: ' + openEdges(o1) + ' edges used once');
    log('2.groups_match_materials', faces(o1) === mats(o1)
      ? 'the material array matches the group count'
      : 'MISMATCH ' + faces(o1) + ' vs ' + mats(o1) + ' - three raycast would crash');
    log('2.right_way_out', signedVolume(o1) > 0
      ? 'positive signed volume - the back copy really was reversed'
      : 'INSIDE OUT or degenerate: volume ' + signedVolume(o1).toFixed(6));
    /* WHICH PART is wound wrong. A global flip would show every group with
       the same sign; a wall problem shows the caps agreeing and the walls
       not. Guessing between those two cost a whole cycle last time. */
    log('2.by_group', groupVolumes(o1));
    var aw = null;
    try { aw = k.auditWinding(o1); } catch (e) { aw = 'threw: ' + e.message; }
    log('2.audit', typeof aw === 'string' ? aw : JSON.stringify(aw).slice(0, 220));
    log('2.audit_clean', aw && aw.ok && aw.boundary === 0 && aw.reversed === 0
      ? 'the app own winding audit calls it clean: closed, no reversed faces, no conflicting edges'
      : 'THE AUDIT IS NOT CLEAN - see the line above');

    // ---- 3. the thickness is a fraction of the model, and it is right ----
    var s3 = size(o1);
    log('3.thickness', 'y went ' + s1.y.toFixed(4) + ' -> ' + s3.y.toFixed(4) +
      ' against a width of ' + s3.x.toFixed(3));
    log('3.is_ten_percent', Math.abs(s3.y - 0.1 * Math.max(s1.x, s1.z)) < 1e-3
      ? '0.1 of the model size gave exactly that thickness'
      : 'WRONG THICKNESS: got ' + s3.y.toFixed(4) + ', expected ' +
        (0.1 * Math.max(s1.x, s1.z)).toFixed(4));

    // ---- 4. Behind leaves the surface where it was ----
    var o4 = plane('S4');
    var top4 = new THREE.Box3().setFromBufferAttribute(o4.mesh.geometry.attributes.position).max.y;
    k.solidifyOp(o4, 0.1, 'in');
    var b4 = new THREE.Box3().setFromBufferAttribute(o4.mesh.geometry.attributes.position);
    log('4.behind', 'top was ' + top4.toFixed(4) + ', now ' + b4.max.y.toFixed(4) +
      ', bottom ' + b4.min.y.toFixed(4));
    log('4.surface_stays', Math.abs(b4.max.y - top4) < 1e-4 && b4.min.y < top4 - 1e-3
      ? 'the surface you could see stayed exactly put and the body went behind it'
      : 'BEHIND MOVED THE SURFACE');

    // ---- 5. Centred splits it either side ----
    var o5 = plane('S5');
    k.solidifyOp(o5, 0.1, 'both');
    var b5 = new THREE.Box3().setFromBufferAttribute(o5.mesh.geometry.attributes.position);
    log('5.centred', 'y from ' + b5.min.y.toFixed(4) + ' to ' + b5.max.y.toFixed(4));
    log('5.is_centred', Math.abs(b5.max.y + b5.min.y) < 1e-4 && b5.max.y > 1e-3
      ? 'half the thickness each side of where the surface was'
      : 'NOT CENTRED');

    // ---- 6. In front puts it the other way ----
    var o6 = plane('S6');
    k.solidifyOp(o6, 0.1, 'out');
    var b6 = new THREE.Box3().setFromBufferAttribute(o6.mesh.geometry.attributes.position);
    log('6.infront', 'y from ' + b6.min.y.toFixed(4) + ' to ' + b6.max.y.toFixed(4));
    log('6.grows_forward', Math.abs(b6.min.y) < 1e-4 && b6.max.y > 1e-3
      ? 'the surface became the BACK and the body grew in front of it'
      : 'IN FRONT DID NOT GROW FORWARD');

    // ---- 7. a closed solid is refused, not quietly doubled ----
    var o7 = cube('S7');
    var f7 = faces(o7);
    var ok7 = k.solidifyOp(o7, 0.1, 'in');
    log('7.cube_refused', ok7 === false && faces(o7) === f7
      ? 'a cube is refused and left alone - hollowing it would double the faces and look identical'
      : 'IT SOLIDIFIED A CLOSED SOLID: ' + faces(o7) + ' faces from ' + f7);

    // ---- 8. it survives the app's own machinery ----
    var o8 = plane('S8');
    k.solidifyOp(o8, 0.08, 'in');
    var threw = null;
    try {
      k.ensureHelpers(o8);
      k.applyShading(o8);
      k.refreshUI();
      k.rebuildFromEditable(o8, k.toEditable(o8.mesh));
      k.ensureHelpers(o8);
    } catch (e) { threw = e && e.message; }
    log('8.round_trip', threw ? 'THREW: ' + threw
      : 'shades, re-reads and rebuilds cleanly - ' + tris(o8) + ' triangles, ' +
        o8.mesh.userData.topo.logicalCount + ' logical vertices');

    // ---- 9. a crease on the surface follows it ----
    /* A PLANE HAS NO INTERIOR EDGE - all four of a single quad's edges are
       rim - so creasing one and expecting it to survive tested the opposite
       of the rule (a rim crease is dropped ON PURPOSE, because that edge
       becomes the joint with the new wall). Two quads sharing an edge is the
       smallest fixture with a real interior edge. */
    var o9 = strip('S9');
    var shared9 = k.creaseKeyFor(new THREE.Vector3(1, 0, 0), new THREE.Vector3(1, 0, 1));
    var rim9 = k.creaseKeyFor(new THREE.Vector3(0, 0, 0), new THREE.Vector3(1, 0, 0));
    o9.mesh.userData.creases = {};
    o9.mesh.userData.creases[shared9] = true;
    o9.mesh.userData.creases[rim9] = true;
    k.solidifyOp(o9, 0.1, 'both');   // 'both' MOVES every vertex, so a naive carry loses it
    var got9 = Object.keys(o9.mesh.userData.creases || {});
    log('9.creases_left', got9.length + ' of 2');
    log('9.interior_follows', got9.length === 1
      ? 'the interior crease survived a Centred solidify, which moves every vertex, and the RIM one was dropped - that edge is now the joint with the wall'
      : 'WRONG: ' + got9.length + ' creases left, expected exactly the interior one');

    // ---- 10-13. THROUGH THE OP BAR ----
    var o10 = plane('S10');
    k.solidifySelection();
    var op = A.pendingOp;
    log('10.opens', op ? 'bar open: ' + op.kind + ', mode ' + op.groupMode +
      ', amount ' + op.amount : 'NO PENDING OP');
    k.setPendingAmount(0.3);
    k.flushPendingApply();
    log('11.slider', Math.abs(A.pendingOp.amount - 0.3) < 1e-6
      ? 'the slider set 0.3 and it stuck'
      : 'CLAMPED TO ' + A.pendingOp.amount);
    var thick11 = size(o10).y;
    log('11.preview', 'previewing at ' + thick11.toFixed(3) + ' thick');
    A.pendingOp.groupMode = 'both';
    k.refreshOpAmountVisibility();
    k.applyPendingOp();
    log('12.chip_keeps_amount', Math.abs(A.pendingOp.amount - 0.3) < 1e-6
      ? 'switching to Centred kept the 0.3 - Solidify declares no per-option range, so nothing resets'
      : 'THE CHIP RESET THE AMOUNT TO ' + A.pendingOp.amount);
    k.cancelPendingOp();
    log('13.cancel', faces(o10) === faces(plane('S13ref'))
      ? 'cancel put the plain plane back'
      : 'CANCEL LEFT ' + faces(o10) + ' faces');

    // ---- 14. a refusal reaches the user while the bar is open ----
    var o14 = cube('S14');
    var why14 = k.solidifySurvey(o14);
    log('14.refusal_reason', typeof why14 === 'string'
      ? 'the survey names it up front: "' + why14.slice(0, 70) + '"'
      : 'THE SURVEY ACCEPTED A CLOSED SOLID');

    /* ---- 15. TWO RIMS MEETING AT ONE VERTEX ----
       The review's finding, and nothing above would have caught it. Two
       quads touching at a single corner - which is every checkerboard of
       deleted faces - are two rim loops sharing one vertex. The first cut
       walked the rim into ordered loops, and a `walked` set then blocked the
       second loop from crossing that vertex: two walls went missing and one
       was invented across an edge that does not exist, all reported as a
       clean success. Built by hand, because no primitive makes this. */
    function pinchObject(name) {
      var ed = {
        positions: [
          0, 0, 0,  1, 0, 0,  1, 0, 1,  0, 0, 1,          // quad A, 0..3
          1, 0, 1,  2, 0, 1,  2, 0, 2,  1, 0, 2           // quad B, 4..7, touching A at (1,0,1)
        ],
        groups: [
          { triangles: [[0, 2, 1], [0, 3, 2]] },
          { triangles: [[4, 6, 5], [4, 7, 6]] }
        ]
      };
      var o = k.createObjectFromEditable(name, new THREE.Vector3(0, 0, 0), ed,
        [new THREE.MeshStandardMaterial({ color: 0x888888 }),
         new THREE.MeshStandardMaterial({ color: 0x888888 })], {});
      A.selectedObjectIds = new Set([o.id]);
      A.activeObjectId = o.id;
      k.setMode('object');
      k.refreshUI();
      return o;
    }
    var o15 = null;
    try { o15 = pinchObject('S15'); } catch (e15) { o15 = null; log('15.threw', e15.message); }
    if (!o15) { log('15.pinch', 'NO FIXTURE BUILT - section 15 tested nothing'); }
    else {
      var rim15 = openEdges(o15);
      log('15.fixture', faces(o15) + ' faces, ' + rim15 +
        ' open edges (two quads touching at one corner)');
      log('15.fixture_is_a_pinch', rim15 === 8
        ? 'eight rim edges over two loops that share a vertex - the case the loop walk got wrong'
        : 'FIXTURE IS NOT WHAT I THINK: ' + rim15 + ' open edges');
      var ok15 = k.solidifyOp(o15, 0.1, 'in');
      log('15.built', ok15 ? 'built, ' + faces(o15) + ' faces' : 'REFUSED');
      log('15.closed', openEdges(o15) === 0
        ? 'still watertight with two rims meeting at a point - every rim edge got its wall'
        : 'HOLES: ' + openEdges(o15) + ' edges used once');
      var aw15 = null;
      try { aw15 = k.auditWinding(o15); } catch (e) { aw15 = null; }
      log('15.audit', aw15 ? JSON.stringify(aw15).slice(0, 200) : 'audit threw');
      /* nonManifold 1 and ok false are CORRECT here and not a defect: the two
         slabs genuinely touch at a single point, which is what the fixture is.
         What matters is boundary 0 (nothing left open) and reversed 0. */
      log('15.audit_reads_right', aw15 && aw15.boundary === 0 && aw15.reversed === 0 &&
        aw15.conflictEdges === 0 && aw15.nonManifold === 1
        ? 'closed, consistently wound, and non-manifold at exactly the one point the fixture touches itself - which is the fixture, not a fault'
        : 'THE AUDIT SAYS SOMETHING ELSE - see the line above');
      log('15.walls', faces(o15) === 2 * 2 + 8
        ? '4 caps plus exactly 8 walls - one per rim edge, none missing and none invented'
        : 'WRONG WALL COUNT: ' + faces(o15) + ' faces, expected 12');
    }

    // ---- 16. a wall inherits the material of the face it grew from ----
    var o16 = null;
    try { o16 = pinchObject('S16'); } catch (e) { o16 = null; }
    if (o16) {
      o16.mesh.material[0].color.setHex(0xff0000);
      o16.mesh.material[1].color.setHex(0x0000ff);
      k.solidifyOp(o16, 0.1, 'in');
      var ms16 = o16.mesh.material;
      // caps 0,1 = fronts; 2,3 = backs; 4..11 = walls, 4 from face 0, 4 from face 1
      var reds = 0, blues = 0;
      for (var w = 4; w < ms16.length; w++) {
        if (ms16[w].color.getHex() === 0xff0000) reds++;
        if (ms16[w].color.getHex() === 0x0000ff) blues++;
      }
      log('16.wall_colours', reds + ' walls red, ' + blues + ' blue, of ' + (ms16.length - 4));
      log('16.walls_inherit', reds === 4 && blues === 4
        ? 'each wall took the colour of the face it grew from, not face 0 for all of them'
        : 'WALLS DID NOT INHERIT - they should split 4/4');
    } else { log('16.walls_inherit', 'NO FIXTURE'); }

    // ---- 17. a sliver face does not inflate the thickness ----
    var o17 = null;
    try {
      var edS = {
        positions: [
          0, 0, 0,  1, 0, 0,  1, 0, 1,  0, 0, 1,
          // a zero-area sliver glued along one edge: three points in a line
          0, 0, 0,  0.5, 0, 0,  1, 0, 0
        ],
        groups: [
          { triangles: [[0, 2, 1], [0, 3, 2]] },
          { triangles: [[4, 5, 6]] }
        ]
      };
      o17 = k.createObjectFromEditable('S17', new THREE.Vector3(0, 0, 0), edS,
        [new THREE.MeshStandardMaterial({ color: 0x888888 }),
         new THREE.MeshStandardMaterial({ color: 0x888888 })], {});
      A.selectedObjectIds = new Set([o17.id]); A.activeObjectId = o17.id;
      k.setMode('object'); k.refreshUI();
    } catch (e) { o17 = null; log('17.threw', e.message); }
    if (!o17) { log('17.sliver', 'NO FIXTURE BUILT'); }
    else {
      var ok17 = k.solidifyOp(o17, 0.1, 'in');
      var s17 = size(o17);
      log('17.built', ok17 ? 'built' : 'REFUSED');
      log('17.thickness', 'y extent ' + s17.y.toFixed(4) + ' (asked for 0.1 of a 1-unit model)');
      log('17.sliver_ignored', ok17 && Math.abs(s17.y - 0.1) < 1e-3
        ? 'a zero-area sliver was left out of the normals - the thickness is what was asked for, not 2.9x it'
        : 'THE SLIVER GOT A VOTE: thickness ' + s17.y.toFixed(4));
    }

    // ---- 18. uneven scale is refused rather than made lumpy ----
    var o18 = plane('S18');
    o18.mesh.scale.set(1, 1, 10);
    o18.mesh.updateMatrixWorld();
    var ok18 = k.solidifyOp(o18, 0.1, 'in');
    log('18.uneven_scale', ok18 === false
      ? 'refused - a local thickness under 1,1,10 would come out thin at the sides'
      : 'IT SOLIDIFIED AN UNEVENLY SCALED OBJECT');

    // ---- 19. the bar does not open over a mesh that can never work ----
    var o19 = cube('S19');
    k.solidifySelection();
    log('19.no_dead_bar', !A.pendingOp
      ? 'a closed solid is refused before the bar opens, not after the tick'
      : 'THE BAR OPENED over a mesh where every option and every slider value refuses');
    if (A.pendingOp) k.cancelPendingOp();

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
