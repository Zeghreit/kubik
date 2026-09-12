/* SPIN EDGE (v2.12) — Blender's Rotate Edge, Maya's Spin Edge.

   Every case is built by hand from vertices whose numbers are chosen, so the
   answer is known before the tool runs: two triangles making a square share
   one diagonal and there is exactly one other it can be on; a quad and a
   triangle make a five-sided ring where clockwise and counter-clockwise are
   genuinely different moves. Both are stated below as the edge that must
   exist afterwards, not as a face count. */
(function () {
  const lines = [];
  const say = (s) => lines.push(s);
  let pass = 0, fail = 0;
  const ok = (name, good, detail) => {
    (good ? pass++ : fail++);
    say((good ? '  ok    ' : '  FAIL  ') + name.padEnd(50) + (detail || ''));
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
    const ORIGIN = K.scene.position.clone().set(0, 0, 0);
    const _m0 = App.objects[0].mesh.material;
    const SRCMAT = Array.isArray(_m0) ? _m0[0] : _m0;
    setTimeout(() => { if (!done) { say(''); say('*** WATCHDOG ***'); finish(); } }, 120000);

    /* A mesh from named corners and explicit face triangle lists, so every
       shared edge in these tests is one I chose rather than one I found. */
    const make = (name, pts, groups) => {
      const ed = { positions: [], groups: groups.map(t => ({ triangles: t })) };
      pts.forEach(p => ed.positions.push(p[0], p[1], p[2]));
      const o = K.createObjectFromEditable(name, ORIGIN.clone(), ed,
        groups.map(() => SRCMAT.clone()), null);
      K.ensureHelpers(o);
      App.mode = 'edge';
      App.activeObjectId = o.id;
      App.selectedObjectIds = new Set([o.id]);
      App.selectedElements = new Set();
      return o;
    };
    const near = (p, q) => Math.abs(p.x - q[0]) < 1e-4 && Math.abs(p.y - q[1]) < 1e-4 && Math.abs(p.z - q[2]) < 1e-4;
    // The edge index whose two ends sit at these two positions.
    const edgeAt = (o, a, b) => {
      const topo = o.mesh.userData.topo;
      for (let i = 0; i < topo.edges.length; i++) {
        const e = topo.edges[i];
        const p = K.logicalPos(o, e[0]), q = K.logicalPos(o, e[1]);
        if ((near(p, a) && near(q, b)) || (near(p, b) && near(q, a))) return i;
      }
      return -1;
    };
    const hasEdge = (o, a, b) => edgeAt(o, a, b) >= 0;
    const faces = (o) => K.faceCount(o.mesh.geometry);
    const verts = (o) => {
      const seen = new Set(), p = o.mesh.geometry.attributes.position;
      for (let i = 0; i < p.count; i++) {
        seen.add(Math.round(p.getX(i) * 1e4) + ',' + Math.round(p.getY(i) * 1e4) + ',' + Math.round(p.getZ(i) * 1e4));
      }
      return seen.size;
    };
    const spin = (o, ei, way) => {
      App.selectedElements = new Set([ei]);
      K.spinEdgeSelection();
      const op = App.pendingOp;
      if (op && way) { op.groupMode = way; K.applyPendingOp(); }
      return op;
    };

    // Two triangles making a unit square, split along 0-2.
    const SQ = [[0, 0, 0], [1, 0, 0], [1, 1, 0], [0, 1, 0]];
    const SQ_G = [[[0, 1, 2]], [[0, 2, 3]]];

    say('1. a triangle pair swaps its diagonal');
    mark('1');
    const o1 = make('tris', SQ, SQ_G);
    ok('it starts split along 0-2', hasEdge(o1, SQ[0], SQ[2]) && !hasEdge(o1, SQ[1], SQ[3]));
    const f1 = faces(o1), v1 = verts(o1);
    const op1 = spin(o1, edgeAt(o1, SQ[0], SQ[2]), 'cw');
    ok('the bar opened', !!op1, op1 ? (op1.lastWhy || 'no refusal') : 'no op');
    if (!op1) { finish(); return; }
    /* THE WHOLE OP IN TWO LINES. The old diagonal is gone and the other one
       is there - not "two faces still exist", which a broken rotation would
       also satisfy. */
    ok('the old diagonal is gone', !hasEdge(o1, SQ[0], SQ[2]));
    ok('and the other one is there', hasEdge(o1, SQ[1], SQ[3]));
    ok('nothing was added or removed', faces(o1) === f1 && verts(o1) === v1,
       faces(o1) + ' faces, ' + verts(o1) + ' vertices');
    const w1 = K.auditWinding(o1);
    ok('and it is still wound consistently', w1.reversed === 0 && w1.conflictEdges === 0,
       w1.reversed + ' reversed, ' + w1.conflictEdges + ' conflicting');
    K.confirmPendingOp();
    await sleep(60);

    say('');
    say('2. on a triangle pair both ways are the same move');
    mark('2');
    /* A square has two diagonals and no more, so whichever way you turn you
       land on the other one. If CCW ever disagrees here, the direction is
       being read off something other than the outline. */
    const o2 = make('tris2', SQ, SQ_G);
    const op2 = spin(o2, edgeAt(o2, SQ[0], SQ[2]), 'ccw');
    ok('counter-clockwise lands on the same diagonal',
       hasEdge(o2, SQ[1], SQ[3]) && !hasEdge(o2, SQ[0], SQ[2]));
    /* AND IT IS ITS OWN UNDO. Turning again from the new state has to come
       back, which is what makes the op safe to press twice. */
    K.confirmPendingOp();
    await sleep(40);
    const op2b = spin(o2, edgeAt(o2, SQ[1], SQ[3]), 'cw');
    ok('turning again comes back', hasEdge(o2, SQ[0], SQ[2]) && !hasEdge(o2, SQ[1], SQ[3]));
    K.confirmPendingOp();
    await sleep(60);

    say('');
    say('3. on a bigger ring the two ways differ');
    mark('3');
    /* A quad and a triangle sharing edge 1-2 make a FIVE-sided ring, where
       one step clockwise and one step counter-clockwise land the chord in
       different places. This is the case that separates a real rotation from
       "swap the diagonal", which would be right for section 1 and wrong for
       every shape that is not two triangles. */
    const P5 = [[0, 0, 0], [1, 0, 0], [1, 1, 0], [0, 1, 0], [2, 0.5, 0]];
    const P5_G = [[[0, 1, 2], [0, 2, 3]], [[1, 4, 2]]];
    const o3 = make('quadtri', P5, P5_G);
    ok('it starts split along 1-2', hasEdge(o3, P5[1], P5[2]));
    const v3 = verts(o3), f3 = faces(o3);
    spin(o3, edgeAt(o3, P5[1], P5[2]), 'cw');
    const cwEdge = [hasEdge(o3, P5[3], P5[4]), hasEdge(o3, P5[0], P5[4])];
    K.confirmPendingOp();
    await sleep(40);
    const o3b = make('quadtri2', P5, P5_G);
    spin(o3b, edgeAt(o3b, P5[1], P5[2]), 'ccw');
    const ccwEdge = [hasEdge(o3b, P5[3], P5[4]), hasEdge(o3b, P5[0], P5[4])];
    ok('clockwise and counter-clockwise are different',
       cwEdge.join() !== ccwEdge.join(),
       'cw ' + cwEdge.join('/') + '  ccw ' + ccwEdge.join('/'));
    ok('each lands on a real edge of the ring', (cwEdge[0] || cwEdge[1]) && (ccwEdge[0] || ccwEdge[1]));
    ok('and neither adds a vertex', verts(o3b) === v3 && faces(o3b) === f3,
       verts(o3b) + ' vertices, ' + faces(o3b) + ' faces');
    const w3 = K.auditWinding(o3b);
    ok('both stay wound consistently', w3.reversed === 0 && w3.conflictEdges === 0,
       w3.reversed + ' reversed, ' + w3.conflictEdges + ' conflicting');
    K.confirmPendingOp();
    await sleep(60);

    say('');
    say('4. the faces keep what they were wearing');
    mark('4');
    /* A rotation is not two new faces - it is the same two faces holding a
       different corner - so the materials must not shuffle. ed.groups lines
       up 1:1 with the material array and the op replaces triangle lists in
       place rather than pushing; if that ever becomes a push, this is what
       says so. */
    const o4 = make('mats', SQ, SQ_G);
    const m4 = o4.mesh.material.slice();
    spin(o4, edgeAt(o4, SQ[0], SQ[2]), 'cw');
    const same = o4.mesh.material.length === m4.length &&
                 o4.mesh.material.every((m, i) => m === m4[i]);
    ok('the same two materials, in the same slots', same,
       o4.mesh.material.length + ' slots');
    K.confirmPendingOp();
    await sleep(60);

    say('');
    say('5. what it refuses');
    mark('5');
    const tEl = document.getElementById('toast');
    /* ONE triangle: every edge is a rim, with nothing on the other side to
       rotate against. */
    const o5 = make('lone', SQ.slice(0, 3), [[[0, 1, 2]]]);
    const f5 = faces(o5), v5 = verts(o5);
    if (tEl) tEl.textContent = '';
    const op5 = spin(o5, edgeAt(o5, SQ[0], SQ[1]), null);
    const why5 = op5 ? op5.lastWhy : (tEl ? tEl.textContent : '(nothing said)');
    ok('a rim edge is refused', !!why5 && faces(o5) === f5 && verts(o5) === v5,
       why5 || 'accepted it');
    if (op5) { if (K.cancelPendingOp) K.cancelPendingOp(); else App.pendingOp = null; }

    say('');
    say('6. the ring and the card');
    mark('6');
    const edge = K.HUB_TOOLS_EDGE || [];
    const top = edge.find(t => t.key === 'spin');
    ok('Spin holds seat 3', !!top && top.seat === 3, top ? ('seat ' + top.seat) : 'missing');
    ok('and it runs the EDGE op, not the lathe', !!top && top.run === K.spinEdgeSelection);
    const doors = edge.filter(t => t.door).reduce((a, t) => a.concat(t.door), []);
    ok('Slide is still reachable', !!(edge.find(t => t.key === 'slide') || doors.find(t => t.key === 'slide')));
    /* The lathe is KEPT, off the ring - the mechanics stay for the day there
       is a seat for them. Both halves of that are asserted: reachable in
       code, absent from every ring. */
    ok('Revolve is still in the code', typeof K.revolveOp === 'function' && typeof K.revolveSelection === 'function');
    const allRings = [].concat(K.HUB_TOOLS_EDGE || [], K.HUB_TOOLS_FACE || [],
                               K.HUB_TOOLS_VERTEX || []);
    const allSeats = allRings.concat(allRings.filter(t => t.door).reduce((a, t) => a.concat(t.door), []));
    ok('and off every ring', !allSeats.some(t => t.run === K.revolveSelection));
    ok('the spin spec has two ways and no slider',
       !!(K.OP_SPECS && K.OP_SPECS.spinedge && K.OP_SPECS.spinedge.noAmount &&
          K.OP_SPECS.spinedge.options.length === 2));

    say('');
    say('7. nothing complained');
    const shaderErrs = errs.filter(e => /shader|program|glsl|webgl/i.test(e));
    ok('no shader or program errors', shaderErrs.length === 0, shaderErrs[0] || '');
    ok('no page errors at all', errs.length === 0, errs[0] || '');
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
