/* _uv271chk - Cut separates, Weld joins (v2.71).

   The claims:
   - cutting every edge at one vertex splits that vertex into one point per
     face, and leaves the island in one piece (nothing was disconnected);
   - the pieces land far enough apart to be TAPPED apart, which is the
     v2.69c loose end this version was supposed to close;
   - clearing the same seam puts them back together;
   - Weld melts picked points of one mesh vertex and clears the seams that
     have become pointless;
   - a single cut edge splits nothing - that is a dart, and it is correct. */
(function () {
  const OUT = [];
  let fails = 0;
  const say = s => OUT.push(s);
  const ok = (name, cond, detail) => {
    if (!cond) fails++;
    say((cond ? 'PASS ' : 'FAIL ') + name + (detail === undefined ? '' : '  ' + detail));
  };
  const note = (name, detail) => say('NOTE ' + name + '  ' + detail);
  const post = (p, b) => { try { const x = new XMLHttpRequest(); x.open('POST', p, true); x.send(b); } catch (e) {} };
  const mark = s => post('/mark', 'at: ' + s + '\n' + OUT.join('\n'));
  function finish(extra) {
    if (extra) { say(extra); fails++; }
    say('VERDICT=' + (fails ? 'FAIL' : 'PASS') + ' (' + fails + ' failed)');
    post('/done', OUT.join('\n'));
  }
  let K = null, A = null, T = null, obj = null, svg = null;
  const wait = ms => new Promise(r => setTimeout(r, ms));
  const seat = (arr, key) => arr.find(t => t.key === key);
  const r3 = n => Math.round(n * 1000) / 1000;

  function geo() { return K.findObject(obj.id).mesh.geometry; }
  function uvCopy() { return Array.from(geo().attributes.uv.array); }
  function dots() { return Array.from(svg.querySelectorAll('.uv-vertex')); }
  function dotAt(x, y, tol) {
    return dots().filter(d => Math.hypot(+d.getAttribute('cx') - x, +d.getAttribute('cy') - y) <= tol);
  }
  /* Triangles wound against the majority: a UV fold. A cut opens a gap at a
     vertex the faces all the way round it have to make room for, so this is
     the number that says whether the room came from somewhere legal. */
  function flips() {
    const g = geo(), U = g.attributes.uv.array, idx = g.index.array;
    let pos = 0, neg = 0;
    for (let i = 0; i < idx.length; i += 3) {
      const a = idx[i], b = idx[i + 1], c = idx[i + 2];
      const s = (U[b * 2] - U[a * 2]) * (U[c * 2 + 1] - U[a * 2 + 1]) -
                (U[c * 2] - U[a * 2]) * (U[b * 2 + 1] - U[a * 2 + 1]);
      if (s > 0) pos++; else if (s < 0) neg++;
    }
    return Math.min(pos, neg);
  }
  function seamCount() {
    const s = K.seamSet(K.findObject(obj.id));
    return s ? Object.keys(s).length : 0;
  }
  function islandCount() {
    const r = K.computeUVIslands(K.findObject(obj.id));
    return r ? r.count : -1;
  }
  // A real tap on an element: down then up, no movement.
  async function tap(el) {
    const bb = el.getBBox ? el.getBBox() : null;
    let cx, cy;
    if (el.classList.contains('uv-vertex')) {
      cx = +el.getAttribute('cx'); cy = +el.getAttribute('cy');
    } else { cx = bb.x + bb.width / 2; cy = bb.y + bb.height / 2; }
    const q = svg.createSVGPoint(); q.x = cx; q.y = cy;
    const c = q.matrixTransform(svg.getScreenCTM());
    const id = 90 + Math.floor(Math.random() * 900);
    const ev = type => new PointerEvent(type, {
      bubbles: true, cancelable: true, pointerId: id, pointerType: 'touch',
      button: 0, buttons: type === 'pointerup' ? 0 : 1, clientX: c.x, clientY: c.y
    });
    el.dispatchEvent(ev('pointerdown'));
    await wait(30);
    svg.dispatchEvent(ev('pointerup'));
    await wait(120);
  }
  // The two drawn ends of an edge group, in card units.
  function edgeEnds(el) {
    const ink = el.querySelector('line');
    if (!ink) return null;
    return { x1: +ink.getAttribute('x1'), y1: +ink.getAttribute('y1'),
             x2: +ink.getAttribute('x2'), y2: +ink.getAttribute('y2') };
  }

  async function run() {
    A = K.App; T = K.THREE;

    // ---------------------------------------------------------------- 0
    obj = K.createPrimitiveObject('sphere', { h: 12, v: 8 }, 'Sphere', new T.Vector3(0, 0, 0));
    A.activeObjectId = obj.id; A.selectedObjectIds = new Set([obj.id]);
    K.ensureHelpers(obj);
    K.setMode('uv');
    K.unwrapSelection();
    K.refreshUI();
    seat(K.HUB_TOOLS_WORLD, 'addgeo').run();
    await wait(400);
    svg = document.getElementById('uvViewSvg');
    K.setUvCompMode('vertex');
    await wait(200);
    ok('0.setup 2D view open in vertex mode', K.uvViewOpen && K.uvCompMode === 'vertex',
       'open=' + K.uvViewOpen + ' mode=' + K.uvCompMode);

    // ---------------------------------------------------------------- 1
    const ring = K.HUB_TOOLS_UV2D_VERT;
    ok('1.vertex mode has a door now', Array.isArray(ring) && ring.length >= 1,
       'seats=' + (ring ? ring.length : '-'));
    const s0 = ring && seat(ring, 'uvweld');
    ok('1.with Weld on it, and a glyph', !!s0 && !!K.ICON[s0.icon],
       s0 ? 'seat=' + s0.seat + ' icon=' + s0.icon : 'missing');
    ok('1.hatched until two points are picked', !!s0 && s0.enabled() === false,
       'picked=' + K.uvSel.length);
    mark('1');

    // ---------------------------------------------------------------- 2
    /* One vertex near the middle of the sheet, and every edge that reaches
       it. Cutting all of them isolates each face around it: one point per
       face, and the island still in one piece, because the faces are still
       joined to each other everywhere else. */
    const all = dots();
    let cx = 0, cy = 0;
    all.forEach(d => { cx += +d.getAttribute('cx'); cy += +d.getAttribute('cy'); });
    cx /= all.length; cy /= all.length;
    let mid = null, bd = Infinity;
    all.forEach(d => {
      const dd = Math.hypot(+d.getAttribute('cx') - cx, +d.getAttribute('cy') - cy);
      if (dd < bd) { bd = dd; mid = d; }
    });
    const vx = +mid.getAttribute('cx'), vy = +mid.getAttribute('cy');
    const rDot = +mid.getAttribute('r');
    const before = uvCopy(), seam0 = seamCount(), isl0 = islandCount(), h0 = A.history.length;
    const dots0 = dotAt(vx, vy, rDot).length, flips0 = flips();
    /* The edges are only DRAWN in edge mode, so the fan has to be collected
       there - the dot above had to be found here, because the dots are the
       other way round. */
    K.setUvCompMode('edge');
    await wait(250);
    const fan = Array.from(svg.querySelectorAll('.uv-edge')).filter(e => {
      const p = edgeEnds(e);
      if (!p) return false;
      return Math.hypot(p.x1 - vx, p.y1 - vy) < 0.01 || Math.hypot(p.x2 - vx, p.y2 - vy) < 0.01;
    });
    ok('2.found a vertex with a fan of edges', fan.length >= 3,
       'edges=' + fan.length + ' dot r=' + r3(rDot));
    if (fan.length < 3) { finish(); return; }
    /* By KEY from here on. A cut moves one end of every edge in the fan, so
       finding them by where they are drawn works exactly once. */
    const fanKeys = fan.map(e => e.dataset.key);
    async function pickFan() {
      K.setUvCompMode('edge');
      await wait(200);
      for (const k of fanKeys) {
        const el = svg.querySelector('.uv-edge[data-key="' + k + '"]');
        if (el) await tap(el);
      }
      return K.uvEdgeSel.length;
    }
    async function toDots() { K.setUvCompMode('vertex'); await wait(220); }
    for (const e of fan) await tap(e);
    ok('2.the fan is selected', K.uvEdgeSel.length === fan.length,
       'selected=' + K.uvEdgeSel.length + '/' + fan.length);
    mark('2');

    // ---------------------------------------------------------------- 3
    K.markSeamSelectionUv(true);
    await wait(300);
    await toDots();
    const split = dotAt(vx, vy, rDot * 6);
    note('3.cut', 'dots at that spot ' + dots0 + ' -> ' + split.length +
         '  seams ' + seam0 + ' -> ' + seamCount() +
         '  islands ' + isl0 + ' -> ' + islandCount() +
         '  history ' + h0 + ' -> ' + A.history.length);
    ok('3.the vertex became one point per face', split.length >= 3,
       dots0 + ' -> ' + split.length + ' (fan of ' + fan.length + ')');
    ok('3.and the island did not come apart', islandCount() === isl0,
       isl0 + ' -> ' + islandCount());
    ok('3.one cut, one history step', A.history.length === h0 + 1,
       h0 + ' -> ' + A.history.length);
    /* THE POINT OF THE GAP: two dots closer than a diameter cannot be
       picked apart, which is exactly the v2.69c loose end. */
    let worst = Infinity;
    for (let i = 0; i < split.length; i++) {
      for (let j = i + 1; j < split.length; j++) {
        worst = Math.min(worst, Math.hypot(
          +split[i].getAttribute('cx') - +split[j].getAttribute('cx'),
          +split[i].getAttribute('cy') - +split[j].getAttribute('cy')));
      }
    }
    ok('3.and they are far enough apart to tap apart', worst >= rDot * 2,
       'closest pair ' + r3(worst) + ' vs a diameter ' + r3(rDot * 2));
    ok('3.and the cut turned no triangle over', flips() === flips0,
       flips0 + ' -> ' + flips());
    mark('3');

    // ---------------------------------------------------------------- 4
    /* Clearing the same seam brings them back. Not bit-exact by design with
       three or more runs - see uvSeparateFans - so the test is the gap, not
       the bit. */
    const got4 = await pickFan();
    ok('4.the fan is pickable again after a cut', got4 === fanKeys.length,
       'selected=' + got4 + '/' + fanKeys.length);
    K.markSeamSelectionUv(false);
    await wait(300);
    await toDots();
    const back = dotAt(vx, vy, rDot * 6);
    const after4 = uvCopy();
    let drift = 0;
    for (let i = 0; i < before.length; i++) drift = Math.max(drift, Math.abs(after4[i] - before[i]));
    note('4.uncut', 'dots ' + split.length + ' -> ' + back.length +
         '  seams now ' + seamCount() + '  worst UV drift ' + drift.toExponential(2));
    ok('4.the pieces join back up', back.length === dots0,
       dots0 + ' -> ' + back.length);
    ok('4.the seam is gone', seamCount() === seam0, seam0 + ' -> ' + seamCount());
    ok('4.and every UV is back within a fraction of the gap', drift < 0.02,
       'worst ' + drift.toExponential(2));
    mark('4');

    // ---------------------------------------------------------------- 5
    /* A SINGLE cut edge is a dart: the faces around each of its ends still
       form one ring, so nothing splits and nothing moves. */
    const uv5 = uvCopy();
    K.setUvCompMode('edge');
    await wait(200);
    const one5 = svg.querySelector('.uv-edge[data-key="' + fanKeys[0] + '"]');
    if (one5) await tap(one5);
    ok('5.one edge picked', K.uvEdgeSel.length === 1, 'selected=' + K.uvEdgeSel.length);
    K.markSeamSelectionUv(true);
    await wait(300);
    const uv5b = uvCopy();
    let moved5 = 0;
    for (let i = 0; i < uv5.length; i++) if (uv5[i] !== uv5b[i]) moved5++;
    note('5.dart', 'seams ' + seam0 + ' -> ' + seamCount() + '  islands ' +
         isl0 + ' -> ' + islandCount() + '  UVs moved ' + moved5);
    ok('5.a dart splits no point', moved5 === 0, 'moved=' + moved5);
    ok('5.but it is still a seam', seamCount() === seam0 + 1,
       seam0 + ' -> ' + seamCount());
    K.markSeamSelectionUv(false);
    await wait(250);
    mark('5');

    // ---------------------------------------------------------------- 6
    /* Cut again, then pick the pieces APART by tapping - the thing the gap
       exists for - and Weld them back. */
    await pickFan();
    K.markSeamSelectionUv(true);
    await wait(300);
    await toDots();
    const fresh = dotAt(vx, vy, rDot * 6);
    for (const d of fresh) await tap(d);
    ok('6.every piece can be picked by tapping it', K.uvSel.length === fresh.length,
       'picked=' + K.uvSel.length + ' of ' + fresh.length);
    const seam6 = seamCount(), h6 = A.history.length;
    const did = K.uvWeldSelection();
    await wait(300);
    const one = dotAt(vx, vy, rDot * 6);
    const wl = K.uvWeldLast || {};
    note('6.weld', 'ran=' + did + '  dots ' + fresh.length + ' -> ' + one.length +
         '  seams ' + seam6 + ' -> ' + seamCount() +
         '  history ' + h6 + ' -> ' + A.history.length +
         '  (picked=' + wl.picked + ' groups=' + wl.groups + ' welded=' + wl.welded +
         ' whole=' + wl.whole + ' dropped=' + wl.dropped + ')');
    ok('6.it ran', did === true, 'did=' + did);
    ok('6.the pieces became one point again', one.length === 1,
       fresh.length + ' -> ' + one.length);
    ok('6.and the seams it made pointless are gone', seamCount() === seam0,
       seam6 + ' -> ' + seamCount() + ' (started at ' + seam0 + ')');
    ok('6.one weld, one history step', A.history.length === h6 + 1,
       h6 + ' -> ' + A.history.length);
    mark('6');

    // ---------------------------------------------------------------- 7
    /* Weld refuses what it must: one point, and two points of two different
       mesh vertices. */
    const h7 = A.history.length;
    const d2 = dots();
    K.setUvCompMode('vertex');
    await wait(150);
    await tap(d2[0]);
    const one1 = K.uvWeldSelection();
    ok('7.one point is not a weld', one1 === false, 'returned=' + one1);
    await tap(d2[Math.floor(d2.length / 2)]);
    const two = K.uvWeldSelection();
    ok('7.two points of two vertices is not a weld either', two === false,
       'returned=' + two + ' picked=' + K.uvSel.length);
    ok('7.and neither wrote history', A.history.length === h7,
       h7 + ' -> ' + A.history.length);
    mark('7');

    // ---------------------------------------------------------------- 8
    /* CLEARING ONE CUT OF SEVERAL must leave the others exactly alone. The
       first draft wrote the average over every run at the vertex to all of
       them, which welded across the seams still standing - so this is the
       regression test for the worst bug the review found. */
    await pickFan();
    K.markSeamSelectionUv(true);
    await wait(300);
    await toDots();
    const many = dotAt(vx, vy, rDot * 6);
    const uv8 = uvCopy();
    K.setUvCompMode('edge');
    await wait(200);
    const oneEl = svg.querySelector('.uv-edge[data-key="' + fanKeys[0] + '"]');
    if (oneEl) await tap(oneEl);
    const sel8 = K.uvEdgeSel.length;
    K.markSeamSelectionUv(false);
    await wait(300);
    await toDots();
    const left = dotAt(vx, vy, rDot * 6);
    const uv8b = uvCopy();
    let movedAis = 0;
    for (let i = 0; i < uv8.length; i += 2) {
      if (uv8[i] !== uv8b[i] || uv8[i + 1] !== uv8b[i + 1]) movedAis++;
    }
    note('8.partial clear', 'picked=' + sel8 + '  dots ' + many.length + ' -> ' + left.length +
         '  seams ' + seamCount() + '  attribute vertices moved ' + movedAis);
    ok('8.one cleared cut joins two pieces and no more',
       many.length >= 3 && left.length === many.length - 1,
       many.length + ' -> ' + left.length);
    ok('8.and the runs it did not touch stayed where they were',
       movedAis > 0 && movedAis <= 12,
       'moved ' + movedAis + ' attribute vertices');
    mark('8');

    finish();
  }

  function boot() {
    K = window.__kubik;
    if (!K || !K.App || !K.uvWeldSelection || !K.HUB_TOOLS_UV2D_VERT) { setTimeout(boot, 120); return; }
    setTimeout(() => { run().catch(e => finish('THREW ' + (e && e.stack ? e.stack : e))); }, 500);
  }
  boot();
  setTimeout(() => { if (OUT.length === 0) finish('THREW boot timeout'); }, 110000);
})();
