/* Slide (a2.80). The whole op rests on one thing: does every vertex of the
   loop go the SAME way? Everything else is arithmetic. */
(function () {
  var out = [], errs = [];
  var _ce = console.error;
  console.error = function () { errs.push(Array.prototype.join.call(arguments, ' ')); _ce.apply(console, arguments); };
  function log(k, v) { out.push(k + '=' + v); }
  var k, A, THREE;

  function cyl(name, sides, up, height) {
    var def = Object.assign({}, k.PRIM_SPECS.cylinder.def);
    def.h = sides || 12;      // sides around
    def.v = up || 4;          // bands UP - v:1 (the default) has no interior ring
    if (height) { def.y = height; }   // LOCAL height - what the weld rounds
    var o = k.createPrimitiveObject('cylinder', def, name || 'C', new THREE.Vector3(0, 0, 0));
    A.selectedObjectIds = new Set([o.id]);
    A.activeObjectId = o.id;
    k.setMode('object');
    k.refreshUI();
    k.ensureHelpers(o);
    return o;
  }
  function pos(o, l) { return k.logicalPos(o, l); }

  /* The middle ring of a cylinder: every logical vertex whose height is
     nearest zero and which is not on a cap centre. Found by height rather
     than by index, so it does not depend on how the primitive numbers
     things. */
  function middleRing(o) {
    var topo = o.mesh.userData.topo, ys = [];
    for (var l = 0; l < topo.logicalCount; l++) ys.push(pos(o, l).y);
    var uniq = [];
    ys.forEach(function (y) {
      if (!uniq.some(function (u) { return Math.abs(u - y) < 1e-4; })) uniq.push(y);
    });
    uniq.sort(function (a, b) { return a - b; });
    var mid = uniq[Math.floor(uniq.length / 2)];
    var ring = [];
    for (var l2 = 0; l2 < topo.logicalCount; l2++) {
      if (Math.abs(pos(o, l2).y - mid) < 1e-4) ring.push(l2);
    }
    return { ring: ring, y: mid, levels: uniq };
  }

  // Select those vertices' edges, in edge mode.
  function selectRingEdges(o, ring) {
    k.setMode('edge');
    var topo = o.mesh.userData.topo, set = new Set(ring), sel = new Set();
    topo.edges.forEach(function (e, ei) {
      if (set.has(e[0]) && set.has(e[1])) sel.add(ei);
    });
    A.selectedElements = sel;
    k.refreshUI();
    return sel;
  }

  function main() {
    k = window.__kubik; A = k.App; THREE = k.THREE;

    // ---- 1. the fixture ----
    var o1 = cyl('L1', 12, 4);
    var m1 = middleRing(o1);
    log('1.cylinder', o1.mesh.geometry.groups.length + ' faces, ' +
      o1.mesh.userData.topo.logicalCount + ' vertices, ring levels y=' +
      m1.levels.map(function (y) { return y.toFixed(2); }).join('/'));
    log('1.ring', m1.ring.length + ' vertices on the middle ring at y=' + m1.y.toFixed(3));
    var sel1 = selectRingEdges(o1, m1.ring);
    log('1.selected', sel1.size + ' edges selected round the middle');
    /* CHECK THE FIXTURE CONTAINS THE THING BEING TESTED. The first run used a
       default cylinder, which is one band tall and has no interior ring, so
       the "middle ring" was the top RIM - a boundary, which Slide refuses,
       and every section below reported a failure that was really the
       fixture's. */
    log('1.fixture_has_interior_ring', m1.levels.length >= 3 &&
      Math.abs(m1.y - m1.levels[0]) > 1e-4 && Math.abs(m1.y - m1.levels[m1.levels.length - 1]) > 1e-4
      ? 'the ring is a genuine interior loop with mesh above and below it'
      : 'FIXTURE IS WRONG - the ring at y=' + m1.y.toFixed(3) + ' is a rim, not an interior loop');

    // ---- 2. the items orient consistently ----
    var items = k.orientedSlideItems(o1);
    log('2.items', items.length + ' of ' + m1.ring.length + ' ring vertices got a slide pair');
    /* THE TEST THIS OP EXISTS FOR. Every item's `a` must be on the SAME side.
       On a cylinder the two sides are the ring above and the ring below, so
       "same side" is simply "same sign of y difference". A per-vertex guess
       would split roughly half and half. */
    var ups = 0, downs = 0;
    items.forEach(function (it) {
      var d = pos(o1, it.a).y - pos(o1, it.v).y;
      if (d > 1e-6) ups++; else if (d < -1e-6) downs++;
    });
    log('2.sides', ups + ' point up, ' + downs + ' point down');
    log('2.consistent', (ups === 0 || downs === 0) && items.length === m1.ring.length
      ? 'every vertex on the loop chose the SAME side - the orientation propagated'
      : 'THE LOOP IS TORN: ' + ups + ' up and ' + downs + ' down out of ' + items.length);

    // ---- 3. sliding moves the whole ring together ----
    var before3 = m1.ring.map(function (l) { return pos(o1, l).y; });
    var moved = k.slideApply(o1, items, 0.5);
    k.ensureHelpers(o1);
    var after3 = m1.ring.map(function (l) { return pos(o1, l).y; });
    var deltas = after3.map(function (y, i) { return y - before3[i]; });
    var dmin = Math.min.apply(null, deltas), dmax = Math.max.apply(null, deltas);
    log('3.moved', moved + ' vertices moved');
    log('3.deltas', 'y changed by ' + dmin.toFixed(4) + ' to ' + dmax.toFixed(4));
    log('3.together', Math.abs(dmax - dmin) < 1e-4 && Math.abs(dmin) > 1e-4
      ? 'the whole ring moved by the same amount in the same direction - it stayed a ring'
      : 'THE RING DID NOT MOVE AS ONE');

    // ---- 4. it is still a ring: the shape is preserved ----
    var r4 = m1.ring.map(function (l) { var p = pos(o1, l); return Math.hypot(p.x, p.z); });
    var rmin = Math.min.apply(null, r4), rmax = Math.max.apply(null, r4);
    log('4.radius', 'radius ' + rmin.toFixed(4) + ' to ' + rmax.toFixed(4));
    log('4.shape_kept', (rmax - rmin) < 1e-4
      ? 'every vertex is still the same distance from the axis - a slide moves the loop, it does not reshape it'
      : 'THE LOOP WAS DEFORMED: radii spread ' + (rmax - rmin).toFixed(4));

    // ---- 5. half way is half way ----
    var o5 = cyl('L5', 12, 4);
    var m5 = middleRing(o5);
    selectRingEdges(o5, m5.ring);
    var it5 = k.orientedSlideItems(o5);
    if (!it5.length) { log('5.is_half', 'NO ITEMS - section 5 tested nothing'); return; }
    var gap5 = Math.abs(pos(o5, it5[0].a).y - pos(o5, it5[0].v).y);
    var y0 = pos(o5, it5[0].v).y;
    k.slideApply(o5, it5, 0.5);
    k.ensureHelpers(o5);
    var y1 = pos(o5, it5[0].v).y;
    log('5.half', 'gap to the next loop ' + gap5.toFixed(4) + ', moved ' + Math.abs(y1 - y0).toFixed(4));
    log('5.is_half', Math.abs(Math.abs(y1 - y0) - gap5 * 0.5) < 1e-4
      ? '0.5 moved it exactly half way to the neighbouring loop'
      : 'WRONG DISTANCE');

    // ---- 6. the sign reverses the direction ----
    var o6 = cyl('L6', 12, 4);
    var m6 = middleRing(o6);
    selectRingEdges(o6, m6.ring);
    var it6 = k.orientedSlideItems(o6);
    var y6a = pos(o6, it6[0].v).y;
    k.slideApply(o6, it6, -0.5);
    k.ensureHelpers(o6);
    var y6b = pos(o6, it6[0].v).y;
    var dirPlus = pos(o5, it5[0].v).y - y0;      // where +0.5 went, from s.5
    var dirMinus = y6b - y6a;
    log('6.signs', '+0.5 went ' + dirPlus.toFixed(4) + ', -0.5 went ' + dirMinus.toFixed(4));
    log('6.opposite', dirPlus * dirMinus < 0
      ? 'the sign reverses the direction, as a signed slider must'
      : 'BOTH SIGNS WENT THE SAME WAY');

    // ---- 7. zero is the identity and is NOT a refusal ----
    var o7 = cyl('L7', 12, 4);
    var m7 = middleRing(o7);
    selectRingEdges(o7, m7.ring);
    var it7 = k.orientedSlideItems(o7);
    var moved7 = k.slideApply(o7, it7, 0);
    log('7.zero_moves_nothing', moved7 === 0 ? 'nothing moved at 0, as it should' : 'IT MOVED AT ZERO');

    // ---- 8. 0.95 stops short of a weld ----
    var o8 = cyl('L8', 12, 4);
    var m8 = middleRing(o8);
    selectRingEdges(o8, m8.ring);
    var it8 = k.orientedSlideItems(o8);
    var gap8 = Math.abs(pos(o8, it8[0].a).y - pos(o8, it8[0].v).y);
    k.slideApply(o8, it8, 5);            // deliberately past the limit
    k.ensureHelpers(o8);
    var left8 = Math.abs(pos(o8, it8[0].a).y - pos(o8, it8[0].v).y);
    log('8.clamped', 'asked for 5, gap went ' + gap8.toFixed(4) + ' -> ' + left8.toFixed(4));
    log('8.no_weld', left8 > gap8 * 0.04 && left8 < gap8 * 0.06
      ? 'clamped at 0.95, so a twentieth of the gap is left and nothing welded'
      : 'THE CLAMP DID NOT HOLD');
    log('8.vertex_count_held', o8.mesh.userData.topo.logicalCount === o7.mesh.userData.topo.logicalCount
      ? 'and the vertex count is unchanged - no accidental weld'
      : 'VERTICES WERE LOST: ' + o8.mesh.userData.topo.logicalCount);

    // ---- 9. a cube edge loop is refused, inherited from Set flow ----
    var o9 = k.createCubeObject('L9', new THREE.Vector3(0, 0, 0));
    A.selectedObjectIds = new Set([o9.id]); A.activeObjectId = o9.id;
    k.setMode('object'); k.refreshUI(); k.ensureHelpers(o9);
    k.setMode('edge');
    A.selectedElements = new Set([0, 1, 2, 3]);
    var it9 = k.orientedSlideItems(o9);
    log('9.cube_corner', it9.length === 0
      ? 'edges on a cube give no slide pairs - every vertex is a right-angled corner where "across" has no meaning, and the opposition test Set flow already pays for refuses them'
      : 'IT ACCEPTED CUBE CORNERS: ' + it9.length + ' items');

    // ---- 10-13. THROUGH THE OP BAR ----
    var o10 = cyl('L10', 12, 4);
    var m10 = middleRing(o10);
    selectRingEdges(o10, m10.ring);
    var y10 = pos(o10, m10.ring[0]).y;
    k.slideSelection();
    var op = A.pendingOp;
    log('10.opens', op ? 'bar open: ' + op.kind + ', amount ' + op.amount +
      ', ' + op.payload.items.length + ' items' : 'NO PENDING OP');
    log('10.opens_at_zero', op && op.amount === 0
      ? 'it opens at 0 - a slide starts from where the loop already is'
      : 'IT DID NOT OPEN AT ZERO');
    k.setPendingAmount(0.4);
    k.flushPendingApply();
    k.ensureHelpers(o10);
    log('11.drag', Math.abs(pos(o10, m10.ring[0]).y - y10) > 1e-4
      ? 'dragging the slider moved the loop'
      : 'THE SLIDER DID NOTHING');
    log('11.no_false_refusal', !A.pendingOp.lastWhy
      ? 'and nothing was refused'
      : 'REFUSED WHILE WORKING: ' + A.pendingOp.lastWhy);
    // back to zero: must not claim a refusal
    k.setPendingAmount(0);
    k.flushPendingApply();
    log('12.zero_is_not_a_refusal', !A.pendingOp.lastWhy
      ? 'sliding back to 0 is the identity, not a failure - no false explanation on screen'
      : 'IT REFUSED AT ZERO: "' + A.pendingOp.lastWhy + '"');
    k.setPendingAmount(0.4);
    k.flushPendingApply();
    var selBefore = A.selectedElements.size;
    k.confirmPendingOp();
    k.ensureHelpers(o10);
    log('13.confirm', !A.pendingOp ? 'confirmed and the bar closed' : 'BAR STILL OPEN');
    log('13.selection_survives', A.selectedElements.size === selBefore
      ? 'the loop is still selected afterwards - nothing about the topology changed'
      : 'SELECTION CHANGED: ' + A.selectedElements.size + ' vs ' + selBefore);

    // ---- 14. cancel puts it back ----
    var o14 = cyl('L14', 12, 4);
    var m14 = middleRing(o14);
    selectRingEdges(o14, m14.ring);
    var y14 = pos(o14, m14.ring[0]).y;
    k.slideSelection();
    k.setPendingAmount(0.6);
    k.flushPendingApply();
    k.cancelPendingOp();
    k.ensureHelpers(o14);
    log('14.cancel', Math.abs(pos(o14, m14.ring[0]).y - y14) < 1e-6
      ? 'cancel put the loop back exactly where it was'
      : 'CANCEL LEFT IT MOVED');

    // ---- 15. vertex mode works too ----
    var o15 = cyl('L15', 12, 4);
    var m15 = middleRing(o15);
    k.setMode('vertex');
    A.selectedElements = new Set(m15.ring);
    k.refreshUI();
    var it15 = k.orientedSlideItems(o15);
    var ups15 = 0, downs15 = 0;
    it15.forEach(function (it) {
      var d = pos(o15, it.a).y - pos(o15, it.v).y;
      if (d > 1e-6) ups15++; else if (d < -1e-6) downs15++;
    });
    log('15.vertex_mode', it15.length + ' items, ' + ups15 + ' up / ' + downs15 + ' down');
    log('15.vertex_consistent', it15.length === m15.ring.length && (ups15 === 0 || downs15 === 0)
      ? 'selecting the ring as VERTICES gives the same consistent answer'
      : 'VERTEX MODE DISAGREES WITH EDGE MODE');

    /* ---- 16. SYMMETRY. The review's finding, and the one the reasoning got
       wrong: "per-element like Set flow" carries for Set flow because Set
       flow is direction-free. A slide has a global SIGN, and the mirror of
       "toward +Y" is "toward -Y". Before the fix both halves slid the same
       way through the model and it came out lopsided. A cylinder with Y
       symmetry and BOTH interior rings picked is the canonical case: the
       two rings are mirror partners across y=0. */
    var o16 = cyl('L16', 12, 4);
    var lv16 = middleRing(o16).levels;                 // -0.5 -0.25 0 0.25 0.5
    var topo16 = o16.mesh.userData.topo;
    function ringAt(o, y) {
      var t = o.mesh.userData.topo, r = [];
      for (var l = 0; l < t.logicalCount; l++) if (Math.abs(pos(o, l).y - y) < 1e-4) r.push(l);
      return r;
    }
    var up16 = ringAt(o16, 0.25), dn16 = ringAt(o16, -0.25);
    /* a2.89: the axis became a SET. Written as a one-element set here so
       these sections keep meaning exactly what they meant before. */
    A.symmetryAxes = ['y'];
    A.symmetry = true;
    k.setMode('edge');
    var sel16 = new Set();
    var both16 = new Set(up16.concat(dn16));
    topo16.edges.forEach(function (e, ei) {
      if (both16.has(e[0]) && both16.has(e[1])) sel16.add(ei);
    });
    A.selectedElements = sel16;
    k.refreshUI();
    var it16 = k.orientedSlideItems(o16);
    log('16.fixture', up16.length + ' up-ring and ' + dn16.length +
      ' down-ring vertices, symmetry ' + (A.symmetry ? 'ON' : 'off') + ' about ' + k.primarySymAxis());
    log('16.items', it16.length + ' items');
    // Where does each half want to go?
    var dUp = 0, dDn = 0;
    it16.forEach(function (it) {
      var d = pos(o16, it.a).y - pos(o16, it.v).y;
      if (pos(o16, it.v).y > 0) dUp += d; else dDn += d;
    });
    log('16.directions', 'upper half sums ' + dUp.toFixed(3) + ', lower half sums ' + dDn.toFixed(3));
    log('16.mirrored', dUp * dDn < 0
      ? 'the two halves go OPPOSITE ways - a symmetric slide stays symmetric'
      : 'SYMMETRY BROKEN: both halves slide the same way through the model');
    // and prove it on the geometry, not just the intent
    k.slideApply(o16, it16, 0.5);
    k.ensureHelpers(o16);
    var yUp = pos(o16, up16[0]).y, yDn = pos(o16, dn16[0]).y;
    log('16.after', 'upper ring at ' + yUp.toFixed(4) + ', lower at ' + yDn.toFixed(4));
    log('16.still_symmetric', Math.abs(yUp + yDn) < 1e-4
      ? 'the model is still symmetric about y=0 after the slide'
      : 'THE MODEL IS LOPSIDED: ' + yUp.toFixed(4) + ' vs ' + yDn.toFixed(4));
    A.symmetry = false;

    /* ---- 17. A PARTLY PAIRABLE LOOP IS REFUSED WHOLE. A vertex with no way
       across stays put while its neighbours move a whole quad, which is a
       spike in the mesh from one drag. All of the loop or none of it. */
    var o17 = cyl('L17', 12, 4);
    var m17 = middleRing(o17);
    selectRingEdges(o17, m17.ring);
    // Add one vertex that is nowhere near the loop: it can have no pair.
    var stray = -1;
    for (var l17 = 0; l17 < o17.mesh.userData.topo.logicalCount; l17++) {
      if (Math.abs(pos(o17, l17).y - m17.y) > 0.2) { stray = l17; break; }
    }
    k.setMode('vertex');
    A.selectedElements = new Set(m17.ring.concat([stray]));
    k.refreshUI();
    var before17 = o17.mesh.geometry.attributes.position.array.slice();
    k.slideSelection();
    log('17.stray', 'selected the ring plus one loose vertex at y=' + pos(o17, stray).y.toFixed(2));
    log('17.refused_whole', !A.pendingOp
      ? 'refused rather than opening a bar that would spike the mesh'
      : 'IT OPENED ANYWAY with ' + A.pendingOp.payload.items.length + ' items');
    if (A.pendingOp) k.cancelPendingOp();

    /* ---- 18. THE WELD FLOOR. The 0.95 stop is relative and the weld is
       absolute, so on a small enough model a twentieth of the gap rounds to
       the same key and the loop merges into its neighbour. */
    /* SCALING THE OBJECT PROVES NOTHING. logicalPos reads the geometry's LOCAL
       coordinates and computeLogicalOf rounds those, so mesh.scale does not
       move the weld one bit - the first version of this section set
       scale 0.002 and measured a gap of 2.5e-1, exactly the same as the
       full-size model, and passed without testing anything. The size has to
       be built into the geometry. A local height of 0.008 over 4 bands puts
       the gap at 2e-3, where a naive 5% residual (1e-4) is inside the weld
       tolerance and the tighter absolute cap has to take over. */
    var o18 = cyl('L18', 12, 4, 0.008);
    var m18 = middleRing(o18);
    selectRingEdges(o18, m18.ring);
    var it18 = k.orientedSlideItems(o18);
    var before18 = o18.mesh.userData.topo.logicalCount;
    var gap18 = Math.abs(pos(o18, it18[0].a).y - pos(o18, it18[0].v).y);
    k.slideApply(o18, it18, 5);
    k.ensureHelpers(o18);
    var after18 = o18.mesh.userData.topo.logicalCount;
    var left18 = Math.abs(pos(o18, it18[0].a).y - pos(o18, it18[0].v).y);
    log('18.small_model', 'gap ' + gap18.toExponential(2) + ', left ' + left18.toExponential(2) +
      ' (' + (100 * left18 / gap18).toFixed(0) + '% of the gap), vertices ' +
      before18 + ' -> ' + after18);
    /* The condition that makes this fixture test anything, written out
       rather than guessed at: the plain 5% stop has to land INSIDE the
       absolute floor, or the floor is never reached and the section proves
       nothing. gap*0.05 < 5e-4, i.e. gap < 1e-2. (A first pass asserted
       gap < 2.1e-3, a number with no reasoning behind it, and called a
       perfectly good fixture wrong.) */
    log('18.fixture_is_small_enough', gap18 * 0.05 < 5e-4
      ? 'a plain 5% stop would leave ' + (gap18 * 0.05).toExponential(2) +
        ', inside the weld tolerance - so the floor is what has to save it'
      : 'FIXTURE IS NOT SMALL - 5% of the gap is ' + (gap18 * 0.05).toExponential(2) +
        ', already clear of the weld, so this tests nothing');
    log('18.no_weld_at_scale', after18 === before18 && left18 > 4e-4
      ? 'the absolute floor took over from the 5% stop and held the loop clear of the weld tolerance'
      : 'IT WELDED: ' + before18 + ' -> ' + after18 + ' vertices, ' + left18.toExponential(2) + ' left');

    /* ---- 19. TWO SEPARATE LOOPS AGREE. Each island gets its own arbitrary
       seed; without aligning them one drag could send one loop up and the
       other down, and which way changed with every edit. */
    var o19 = cyl('L19', 12, 6);
    var t19 = o19.mesh.userData.topo;
    var lv19 = [];
    for (var l19 = 0; l19 < t19.logicalCount; l19++) {
      var y19 = pos(o19, l19).y;
      if (!lv19.some(function (u) { return Math.abs(u - y19) < 1e-4; })) lv19.push(y19);
    }
    lv19.sort(function (a, b) { return a - b; });
    var rA = ringAt(o19, lv19[2]), rB = ringAt(o19, lv19[4]);
    k.setMode('edge');
    var sel19 = new Set(), both19 = new Set(rA.concat(rB));
    t19.edges.forEach(function (e, ei) {
      if (both19.has(e[0]) && both19.has(e[1])) sel19.add(ei);
    });
    A.selectedElements = sel19;
    k.refreshUI();
    var it19 = k.orientedSlideItems(o19);
    var sA = 0, sB = 0;
    it19.forEach(function (it) {
      var d = pos(o19, it.a).y - pos(o19, it.v).y;
      if (Math.abs(pos(o19, it.v).y - lv19[2]) < 1e-4) sA += d; else sB += d;
    });
    log('19.two_loops', it19.length + ' items; loop A sums ' + sA.toFixed(3) +
      ', loop B sums ' + sB.toFixed(3));
    log('19.islands_agree', sA * sB > 0
      ? 'two separate loops picked together slide the SAME way'
      : 'THE TWO LOOPS DISAGREE - one would go up and the other down');

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
