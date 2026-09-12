/* REVOLVE (v2.11, off the ring at v2.12), checked against shapes whose answer is known before
   the tool runs — the rule this project got its geometry right by.

   Every case here is built as ONE QUAD placed by hand, so the profile edge,
   its radius and its distance from the axis are all chosen rather than
   discovered. A cylinder wall of 8 steps from a 1-edge profile is 8 faces
   and 14 new vertices, and no amount of shading or lighting can make that
   arithmetic ambiguous. */
(function () {
  const lines = [];
  const say = (s) => lines.push(s);
  let pass = 0, fail = 0;
  const ok = (name, good, detail) => {
    (good ? pass++ : fail++);
    say((good ? '  ok    ' : '  FAIL  ') + name.padEnd(48) + (detail || ''));
  };
  let done = false;
  const errs = [];
  window.addEventListener('error', (e) => errs.push('window: ' + e.message));
  function finish() {
    if (done) return; done = true;
    say('');
    say(fail ? 'VERDICT=FAIL (' + fail + ' of ' + (pass + fail) + ')'
             : 'VERDICT=PASS (' + pass + ' checks)');
    try { fetch('/report', { method: 'POST', body: lines.join('\n') }); } catch (_) {}
  }
  const sleep = (ms) => new Promise(r => setTimeout(r, ms));
  const mark = (w) => { try { fetch('/mark', { method: 'POST', body: lines.join('\n') + '\n>>> ' + w }); } catch (_) {} };
  const shot = (tag, url) => { try { fetch('/shot', { method: 'POST', body: tag + '|' + url }); } catch (_) {} };

  async function boot() {
    const K = window.__kubik, App = K.App;
    /* THREE is imported as a module, so it is not a global here. A Vector3
       is still reachable by cloning one the app already owns. */
    const ORIGIN = K.scene.position.clone().set(0, 0, 0);
    /* And a material to dress the test quads with - createObjectFromEditable
       wants a real array, and the app's own starting cube has one. */
    const _m0 = App.objects[0].mesh.material;
    const SRCMAT = Array.isArray(_m0) ? _m0[0] : _m0;
    setTimeout(() => { if (!done) { say(''); say('*** WATCHDOG ***'); finish(); } }, 120000);

    /* ONE QUAD, PLACED. `pts` is four corners in order; the face is wound so
       its outline runs the way the app's own faces do. */
    const makeQuad = (name, pts) => {
      const ed = { positions: [], groups: [{ triangles: [[0, 1, 2], [0, 2, 3]] }] };
      pts.forEach(p => ed.positions.push(p[0], p[1], p[2]));
      const o = K.createObjectFromEditable(name, ORIGIN.clone(), ed, [SRCMAT.clone()], null);
      K.ensureHelpers(o);
      App.mode = 'edge';
      App.activeObjectId = o.id;
      App.selectedObjectIds = new Set([o.id]);
      App.selectedElements = new Set();
      return o;
    };
    /* TWO quads sharing one edge, so that edge has a face on BOTH sides -
       the ordinary case for a profile drawn inside a solid, and the one the
       rim winding rule cannot speak for. Wound so they agree: A runs 1->2
       along the shared edge and B runs 2->1. */
    const makeStrip = (name, sx) => {
      const k = sx === undefined ? 1 : sx;
      const ed = {
        positions: [0, 0, 0, k, 0, 0, k, 1, 0, 0, 1, 0, 2 * k, 0, 0, 2 * k, 1, 0],
        groups: [{ triangles: [[0, 1, 2], [0, 2, 3]] },
                 { triangles: [[1, 4, 5], [1, 5, 2]] }]
      };
      const o = K.createObjectFromEditable(name, ORIGIN.clone(), ed,
                                           [SRCMAT.clone(), SRCMAT.clone()], null);
      K.ensureHelpers(o);
      App.mode = 'edge';
      App.activeObjectId = o.id;
      App.selectedObjectIds = new Set([o.id]);
      App.selectedElements = new Set();
      return o;
    };
    // The edge whose two ends sit at these two positions, by coordinate.
    const edgeAt = (o, a, b) => {
      const topo = o.mesh.userData.topo;
      const near = (p, q) => Math.abs(p.x - q[0]) < 1e-4 && Math.abs(p.y - q[1]) < 1e-4 && Math.abs(p.z - q[2]) < 1e-4;
      for (let i = 0; i < topo.edges.length; i++) {
        const e = topo.edges[i];
        const p = K.logicalPos(o, e[0]), q = K.logicalPos(o, e[1]);
        if ((near(p, a) && near(q, b)) || (near(p, b) && near(q, a))) return i;
      }
      return -1;
    };
    const faces = (o) => K.faceCount(o.mesh.geometry);
    const verts = (o) => {
      // LOGICAL vertices - the mesh separates every face's copies, so the
      // attribute count answers a different question than this one.
      const seen = new Set(), p = o.mesh.geometry.attributes.position;
      for (let i = 0; i < p.count; i++) {
        seen.add(Math.round(p.getX(i) * 1e4) + ',' + Math.round(p.getY(i) * 1e4) + ',' + Math.round(p.getZ(i) * 1e4));
      }
      return seen.size;
    };
    const spin = (o, ei, opts) => {
      App.selectedElements = new Set([ei]);
      K.revolveSelection();
      const op = App.pendingOp;
      if (!op) return null;
      if (opts) {
        if (opts.axis) op.groupMode = opts.axis;
        if (opts.segments) op.segments = opts.segments;
        if (opts.angle !== undefined) op.amount = opts.angle;
        K.applyPendingOp();
      }
      return op;
    };

    say('1. a profile off the axis makes a tube');
    mark('1');
    /* A unit-square face standing at x = 1..2, in the XZ-facing plane. Its
       inner edge runs from (1,0,0) to (1,1,0): radius 1 from the Y axis,
       one edge long. Spun a full turn in 8 steps that is a cylinder wall. */
    const o1 = makeQuad('tube', [[1, 0, 0], [2, 0, 0], [2, 1, 0], [1, 1, 0]]);
    const f0 = faces(o1), v0 = verts(o1);
    ok('the test quad is one face', f0 === 1, f0 + ' face(s), ' + v0 + ' vertices');
    const e1 = edgeAt(o1, [1, 0, 0], [1, 1, 0]);
    ok('found the profile edge', e1 >= 0, 'edge ' + e1);
    const op1 = spin(o1, e1, { axis: 'y', segments: 8, angle: 360 });
    ok('the bar opened', !!op1, op1 ? (op1.lastWhy || 'no refusal') : 'no op');
    if (!op1) { finish(); return; }
    /* 8 steps, 1 leg a band: 8 faces. And 7 NEW rings of 2 points - the
       eighth closes onto the profile itself, which is the whole difference
       between a full turn and an arc. */
    ok('8 steps of a 1-edge profile is 8 new faces', faces(o1) === f0 + 8,
       faces(o1) - f0 + ' added');
    ok('and 14 new vertices, not 16', verts(o1) === v0 + 14,
       verts(o1) - v0 + ' added');
    const w1 = K.auditWinding(o1);
    ok('every face agrees with its neighbours', w1.reversed === 0 && w1.conflictEdges === 0,
       w1.reversed + ' reversed, ' + w1.conflictEdges + ' conflicting');
    /* THE FIN, ASSERTED RATHER THAN TOLERATED. An edge only exists in this
       app where a face uses it, so a profile always carries one - and on a
       full turn the first and last bands both land on that edge, giving it
       three faces. Exactly one such edge, and the label says so while the
       bar is open. More than one would mean the sweep itself was welding
       where it should not. */
    ok('exactly one non-manifold edge - the profile fin', w1.nonManifold === 1,
       w1.nonManifold + ' non-manifold');
    ok('and the bar says so', (op1.finOnly === true), 'finOnly=' + op1.finOnly);
    /* A tube is open at both ends: 8 edges each. The 19 counted here is
       those 16 plus the profile face's own three remaining sides. A SLIT
       would push it higher still, and is what a full turn failing to weld
       its seam would look like. */
    ok('two open rims of 8, and the profile face is 3 more', w1.boundary === 19,
       w1.boundary + ' boundary edge(s)');
    K.confirmPendingOp();
    await sleep(60);

    say('');
    say('2. an arc is not a full turn');
    mark('2');
    const o2 = makeQuad('arc', [[1, 0, 0], [2, 0, 0], [2, 1, 0], [1, 1, 0]]);
    const a0 = verts(o2), af0 = faces(o2);
    const op2 = spin(o2, edgeAt(o2, [1, 0, 0], [1, 1, 0]), { axis: 'y', segments: 8, angle: 90 });
    ok('a 90 degree sweep still makes 8 bands', faces(o2) === af0 + 8, faces(o2) - af0 + ' added');
    /* AND ONE MORE RING THAN THE FULL TURN. Nothing closes, so all 8 rings
       are new: 16 vertices against the full turn's 14. This is the arithmetic
       the array records as "a full turn divides by n, an arc by n-1", in the
       form a swept surface takes it. */
    ok('but 16 new vertices - nothing welded', verts(o2) === a0 + 16, verts(o2) - a0 + ' added');
    const w2 = K.auditWinding(o2);
    ok('and it is still wound consistently', w2.ok,
       w2.reversed + ' reversed, ' + w2.conflictEdges + ' conflicting');
    K.confirmPendingOp();
    await sleep(60);

    say('');
    say('3. a point ON the axis is a pole, not eight vertices');
    mark('3');
    /* The inner edge runs from (0,1,0) - dead on the Y axis - out to
       (1,0,0). Every ring's copy of the axis point is the SAME point, so it
       must be shared rather than duplicated, and the quads there must come
       out as the triangles a cone actually has. */
    const o3 = makeQuad('cone', [[0, 1, 0], [1, 0, 0], [2, 0, 0], [2, 1, 0]]);
    const p0 = verts(o3), pf0 = faces(o3);
    const op3 = spin(o3, edgeAt(o3, [0, 1, 0], [1, 0, 0]), { axis: 'y', segments: 8, angle: 360 });
    ok('8 faces again', faces(o3) === pf0 + 8, faces(o3) - pf0 + ' added');
    /* ONE point moves, so 7 new rings of ONE vertex each. If the pole were
       copied this would be 14, and the extra 7 would be coincident - welded
       by computeLogicalOf into a vertex of degree 16 with degenerate faces
       hanging off it. */
    ok('only 7 new vertices - the pole is shared', verts(o3) === p0 + 7,
       verts(o3) - p0 + ' added');
    const tris = o3.mesh.geometry.groups.filter(g => g.count === 3).length;
    ok('and the faces at the pole are TRIANGLES', tris >= 8, tris + ' triangle face(s)');
    const w3 = K.auditWinding(o3);
    /* The pole is the thing under test here, so the assertion is that it
       added NO non-manifold edge of its own: one is the profile fin, the
       same as section 1, and a copied pole would show as several more. */
    ok('the pole adds nothing non-manifold', w3.reversed === 0 && w3.conflictEdges === 0 && w3.nonManifold === 1,
       w3.reversed + ' reversed, ' + w3.conflictEdges + ' conflicting, ' + w3.nonManifold + ' non-manifold');
    K.confirmPendingOp();
    await sleep(60);

    say('');
    say('4. it re-runs from the snapshot, live');
    mark('4');
    const o4 = makeQuad('live', [[1, 0, 0], [2, 0, 0], [2, 1, 0], [1, 1, 0]]);
    const l0 = faces(o4);
    const op4 = spin(o4, edgeAt(o4, [1, 0, 0], [1, 1, 0]), { axis: 'y', segments: 8, angle: 360 });
    const at8 = faces(o4);
    op4.segments = 16; K.applyPendingOp();
    const at16 = faces(o4);
    op4.segments = 8; K.applyPendingOp();
    const back8 = faces(o4);
    ok('more steps, more faces', at16 === l0 + 16, at16 - l0 + ' at 16 steps');
    /* THE POINT OF A LIVE OP: every re-run starts from the snapshot, so
       going back to 8 must land exactly where 8 landed the first time and
       not on top of the 16 already built. */
    ok('and going back lands exactly where it was', back8 === at8,
       at8 + ' -> ' + at16 + ' -> ' + back8);
    op4.groupMode = 'x'; K.applyPendingOp();
    ok('the axis chips re-run it too', faces(o4) === l0 + 8, faces(o4) - l0 + ' on X');
    K.confirmPendingOp();
    await sleep(60);

    say('');
    say('5. what it refuses, and says');
    mark('5');
    const refuse = (name, quad, a, b, opts, want) => {
      const o = makeQuad(name, quad);
      const before = faces(o);
      const tEl = document.getElementById('toast');
      if (tEl) tEl.textContent = '';
      const op = spin(o, edgeAt(o, a, b), opts);
      /* NO BAR IS ALSO A REFUSAL, and the better one: spinSelection runs a
         pass at open and tears the op down if the worker already has an
         answer, so a profile that can never sweep never gets a bar at all.
         The reason went to a toast, which is where it is read from. */
      const why = op ? op.lastWhy : (tEl ? tEl.textContent : '(no bar)');
      const untouched = faces(o) === before;
      if (op) { if (K.cancelPendingOp) K.cancelPendingOp(); else App.pendingOp = null; }
      ok(name, !!why && untouched && (!want || (why || '').indexOf(want) >= 0),
         why || ('accepted it - axis ' + (opts.axis || '?') + ', ' + (opts.angle || '?') +
                 ' degrees, ' + (opts.segments || '?') + ' steps, ' +
                 (faces(o) - before) + ' faces added'));
    };
    /* A profile lying ALONG the axis sweeps nothing - every point stays where
       it is and the result is a fan of zero-area faces. */
    refuse('a profile on the axis is refused',
           [[0, 0, 0], [1, 0, 0], [1, 1, 0], [0, 1, 0]], [0, 0, 0], [0, 1, 0],
           { axis: 'y', segments: 8, angle: 360 }, 'on the axis');
    /* A full turn in two steps folds flat across itself. */
    refuse('a full turn under 3 steps is refused',
           [[1, 0, 0], [2, 0, 0], [2, 1, 0], [1, 1, 0]], [1, 0, 0], [1, 1, 0],
           { axis: 'y', segments: 2, angle: 360 }, 'at least 3');

    say('');
    say('6. the ring kept its seats');
    mark('6');
    /* Spin displaced Slide rather than being added, so this guards BOTH ends
       of that trade - a later reshuffle that drops Slide entirely would
       otherwise be silent. */
    const edge = K.HUB_TOOLS_EDGE || [];
    const top = edge.find(t => t.key === 'spin');
    ok('Spin is in the Edge ring', !!top, top ? ('seat ' + top.seat) : 'missing');
    ok('and not in the top level twice', edge.filter(t => t.key === 'spin').length === 1);
    const doors = edge.filter(t => t.door).reduce((a, t) => a.concat(t.door), []);
    const slide = edge.find(t => t.key === 'slide') || doors.find(t => t.key === 'slide');
    ok('Slide is still reachable', !!slide,
       slide ? (edge.includes(slide) ? 'top level' : 'behind a door') : 'GONE');
    const seats = edge.map(t => t.seat).sort((a, b) => a - b);
    ok('no two top-level seats collide', new Set(seats).size === seats.length, seats.join(','));

    say('');
    say('8. the sweep faces outward');
    mark('8');
    /* THE CHECK THE REVIEW ASKED FOR. Winding was taken from the direction a
       neighbouring face runs the profile edge - bridge's rule - and on a
       lathe that measures NOTHING: a profile drawn inside a solid has two
       faces on it, so both directions are already taken and the test comes
       back true whatever it is asked. Which way the shell faced was really
       decided by whichever end edgeChains started walking from, and a
       uniformly inverted shell is invisible to auditWinding by design.

       So it is asserted here against the geometry instead: every swept face
       has to point AWAY from the axis it turns about. */
    /* TWO quads sharing the profile edge, which is the whole point: with one
       face on it the rim rule DOES carry information and the sweep rightly
       inherits that face's orientation (section 1 checks it stays consistent
       with it). With two, both directions are taken, the rim rule is mute,
       and the geometry has to answer instead. A lone quad measured 8 faces
       inward here and that was correct - it is what its source face does. */
    /* BOTH HANDS - AND THIS STILL DOES NOT DISCRIMINATE. Said plainly
       because a check that passes on the broken build is not a check, and
       this one does: with spinOp's geometric winding block disabled, both
       lines below still read 8 outward, 0 inward. Mirroring the strip was
       the attempt to reverse the order edgeChains walks the profile in, and
       it did not.

       What these two DO establish is that the sweep comes out outward on
       either hand, which is worth having on its own. What they do not
       establish is that the geometric rule is what makes it so. If a profile
       ever turns up that sweeps inside out, it is the case this section was
       looking for - add it here rather than starting again. */
    const sweepFacing = (o, before) => {
      const g = o.mesh.geometry, pos = g.attributes.position, idx = g.index;
      let outward = 0, inward = 0;
      for (let gi = before; gi < g.groups.length; gi++) {
        const gr = g.groups[gi];
        const a = idx.array[gr.start], b = idx.array[gr.start + 1], c = idx.array[gr.start + 2];
        const ax = pos.getX(a), ay = pos.getY(a), az = pos.getZ(a);
        const bx = pos.getX(b), by = pos.getY(b), bz = pos.getZ(b);
        const cx = pos.getX(c), cy = pos.getY(c), cz = pos.getZ(c);
        // Face normal, and the radial direction at its centroid. Y is the
        // axis, so the radial part is just the XZ offset from the origin.
        const nx = (by - ay) * (cz - az) - (bz - az) * (cy - ay);
        const nz = (bx - ax) * (cy - ay) - (by - ay) * (cx - ax);
        const mx = (ax + bx + cx) / 3, mz = (az + bz + cz) / 3;
        (nx * mx + nz * mz >= 0 ? outward++ : inward++);
      }
      return { out: outward, in: inward };
    };
    [1, -1].forEach(hand => {
      const o8 = makeStrip('outward' + hand, hand);
      const b8 = faces(o8);
      spin(o8, edgeAt(o8, [hand, 0, 0], [hand, 1, 0]), { axis: 'y', segments: 8, angle: 360 });
      const f8 = sweepFacing(o8, b8);
      ok('the sweep faces outward on the ' + (hand > 0 ? '+x' : '-x') + ' side',
         f8.in === 0 && f8.out > 0, f8.out + ' outward, ' + f8.in + ' inward');
      K.confirmPendingOp();
    });
    await sleep(60);

    say('');
    say('9. a refusal mid-drag says so');
    mark('9');
    /* restoreObjectState has already run by the time a refusal is known, so
       the shape snaps back to the bare profile with the bar still open. Left
       silent, that is a stepper that reads 2 over a mesh nothing happened to
       and no word until the tick. */
    const o9 = makeQuad('said', [[1, 0, 0], [2, 0, 0], [2, 1, 0], [1, 1, 0]]);
    const op9 = spin(o9, edgeAt(o9, [1, 0, 0], [1, 1, 0]), { axis: 'y', segments: 8, angle: 360 });
    op9.segments = 2; K.applyPendingOp();
    ok('the refusal is latched for a toast', !!(op9.saidWhy && Object.keys(op9.saidWhy).length),
       op9.saidWhy ? Object.keys(op9.saidWhy)[0] : 'said nothing');
    const lab9 = document.getElementById('opLabel');
    ok('and the label stops claiming the last success',
       !!lab9 && lab9.textContent.indexOf('3 steps') >= 0, lab9 ? lab9.textContent : 'no label');
    /* ONE toast per reason, not one per press - this re-runs on every step. */
    const n9 = Object.keys(op9.saidWhy).length;
    op9.segments = 1; K.applyPendingOp();
    ok('and says it once, not once per press', Object.keys(op9.saidWhy).length === n9,
       Object.keys(op9.saidWhy).length + ' reason(s) latched');
    if (K.cancelPendingOp) K.cancelPendingOp(); else App.pendingOp = null;
    await sleep(60);

    say('');
    say('10. symmetry turns the other way, or refuses');
    mark('10');
    /* A reflection conjugates a rotation into a rotation the OTHER way,
       except when the mirror is along the spin axis itself. Spinning about
       the axis symmetry mirrors across is the case the chips open on and the
       only one that had ever been tried; any other needs the sign flipped
       AND the centre on the mirror plane, or no sign works at all. */
    const o10 = makeQuad('sym', [[1, 0, 0], [2, 0, 0], [2, 1, 0], [1, 1, 0]]);
    K.setSymmetryAxes ? K.setSymmetryAxes(['y']) : (App.symmetryAxes = ['y']);
    const op10 = spin(o10, edgeAt(o10, [1, 0, 0], [1, 1, 0]), { axis: 'y', segments: 8, angle: 90 });
    ok('spinning about the mirrored axis is allowed', !!op10 && !op10.lastWhy,
       op10 ? (op10.lastWhy || 'ran') : 'no bar');
    /* The centre is the world origin and the Y mirror plane passes through
       it, so an X spin is repairable by the sign alone and must NOT refuse. */
    if (op10) { op10.groupMode = 'x'; K.applyPendingOp(); }
    /* These two establish that the axis-differs path is not refused when it
       is repairable, and that neither run throws - NOT that the two halves
       come out mirror images, which needs a profile whose mirror exists in
       the mesh and is left to a model to demonstrate. The sign rule itself
       is arithmetic, stated where it is applied. */
    ok('a different axis through the plane is allowed too',
       !!op10 && !op10.lastWhy, op10 ? (op10.symWhy || op10.lastWhy || 'ran') : 'no bar');
    if (K.cancelPendingOp) K.cancelPendingOp(); else App.pendingOp = null;
    K.setSymmetryAxes ? K.setSymmetryAxes([]) : (App.symmetryAxes = []);
    await sleep(60);

    say('');
    say('7. nothing complained');
    const shaderErrs = errs.filter(e => /shader|program|glsl|webgl/i.test(e));
    ok('no shader or program errors', shaderErrs.length === 0, shaderErrs[0] || '');
    ok('no page errors at all', errs.length === 0, errs[0] || '');

    // A picture, not only a mean.
    try {
      K.renderer.render(K.scene, K.camera);
      shot('scene', K.renderer.domElement.toDataURL());
    } catch (_) {}

    ok('the probe ran to the end', true);
    finish();
  }
  const go = () => setTimeout(() => {
    boot().catch(e => { say('THREW ' + e.message + '\n' + (e.stack || '')); ok('the probe ran to the end', false, e.message); finish(); });
  }, 2500);
  if (document.readyState === 'complete') go(); else window.addEventListener('load', go);
})();
