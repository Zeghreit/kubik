/* _uv272chk - Unfold: the outline is free (v2.72).

   THE FIXTURE IS A CYLINDER ON PURPOSE (the v2.70 lesson). A sphere cannot be
   both equal-area and unsheared, so on a sphere any result can be defended. A
   cylinder's side is developable: there is a flattening with no distortion at
   all, so EVERY measure must improve and the density spread must land on 1.

   The claims, each as a number:
   - a damaged layout comes back with less conformal energy and a density
     spread near 1, which is what "it unfolded" means on a developable;
   - no triangle is left inside out, and the island's handedness is the one it
     had;
   - the island lands where it was: the fit matches centroids exactly;
   - one press, one history step; a second press, none;
   - Undo puts back exactly what was there;
   - a closed island is refused by name, not solved into nonsense;
   - a conformal input reads as zero energy, which is the solver saying it
     understands its own question. */
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
  let finished = false;
  function finish(extra) {
    if (finished) return;
    finished = true;
    if (extra) { say(extra); fails++; }
    say('VERDICT=' + (fails ? 'FAIL' : 'PASS') + ' (' + fails + ' failed)');
    post('/done', OUT.join('\n'));
  }
  let K = null, A = null, T = null, obj = null;
  const wait = ms => new Promise(r => setTimeout(r, ms));
  const seat = (arr, key) => arr.find(t => t.key === key);
  const r3 = n => Math.round(n * 1000) / 1000;
  const r6 = n => Math.round(n * 1e6) / 1e6;

  function geo() { return K.findObject(obj.id).mesh.geometry; }
  function uvCopy() { return Array.from(geo().attributes.uv.array); }

  /* The mesh, read the way the op reads it: per triangle, surface area over
     UV area. p95/p5 of the square root, so the number is a LENGTH ratio -
     "the most stretched part of this island is 1.4x the least" - and a
     developable surface laid out properly answers 1. */
  function measure(islandOnly) {
    const g = geo(), P = g.attributes.position.array, U = g.attributes.uv.array;
    const idx = g.index.array;
    const sig = [];
    let signed = 0, pos = 0, neg = 0;
    for (let i = 0; i < idx.length; i += 3) {
      const a = idx[i], b = idx[i + 1], c = idx[i + 2];
      if (islandOnly && !islandOnly.has(a)) continue;
      const ax = P[b * 3] - P[a * 3], ay = P[b * 3 + 1] - P[a * 3 + 1], az = P[b * 3 + 2] - P[a * 3 + 2];
      const bx = P[c * 3] - P[a * 3], by = P[c * 3 + 1] - P[a * 3 + 1], bz = P[c * 3 + 2] - P[a * 3 + 2];
      const cx = ay * bz - az * by, cy = az * bx - ax * bz, cz = ax * by - ay * bx;
      const a3 = Math.sqrt(cx * cx + cy * cy + cz * cz) / 2;
      const s = ((U[b * 2] - U[a * 2]) * (U[c * 2 + 1] - U[a * 2 + 1]) -
                 (U[c * 2] - U[a * 2]) * (U[b * 2 + 1] - U[a * 2 + 1])) / 2;
      signed += s;
      if (s > 0) pos++; else if (s < 0) neg++;
      if (a3 > 1e-12 && Math.abs(s) > 1e-18) sig.push(a3 / Math.abs(s));
    }
    sig.sort((x, y) => x - y);
    const lo = sig[Math.floor(sig.length * 0.05)], hi = sig[Math.floor(sig.length * 0.95)];
    return { spread: lo > 0 ? Math.sqrt(hi / lo) : Infinity, signed: signed,
             folds: Math.min(pos, neg), tris: sig.length };
  }

  /* The centroid of the island's POINTS - one per distinct UV, because that
     is the thing the similarity fit matched. */
  function centroid(ais) {
    const U = geo().attributes.uv.array, seen = new Set();
    let su = 0, sv = 0, n = 0;
    ais.forEach(ai => {
      const u = U[ai * 2], v = U[ai * 2 + 1];
      const k = Math.round(u * 1e6) + '_' + Math.round(v * 1e6);
      if (seen.has(k)) return;
      seen.add(k); su += u; sv += v; n++;
    });
    return n ? { u: su / n, v: sv / n, n: n } : { u: 0, v: 0, n: 0 };
  }

  /* DAMAGE IS A LEGITIMATE FIXTURE (v2.70's note), but it must be damage and
     not a TEAR: one offset per UV POINT, so every attribute vertex that was
     one point stays one point. Fixed generator, so the fixture is the same on
     every run. */
  function scramble(ais, amp) {
    const g = geo(), U = g.attributes.uv.array;
    const off = new Map();
    let seed = 20720272;
    const rnd = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
    ais.forEach(ai => {
      const k = Math.round(U[ai * 2] * 1e6) + '_' + Math.round(U[ai * 2 + 1] * 1e6);
      if (!off.has(k)) off.set(k, [(rnd() - 0.5) * amp, (rnd() - 0.5) * amp]);
    });
    ais.forEach(ai => {
      const k = Math.round(U[ai * 2] * 1e6) + '_' + Math.round(U[ai * 2 + 1] * 1e6);
      const d = off.get(k);
      U[ai * 2] += d[0]; U[ai * 2 + 1] += d[1];
    });
    g.attributes.uv.needsUpdate = true;
    return off.size;
  }

  function openOn(kind, seg, name) {
    const o = K.createPrimitiveObject(kind, seg, name, new T.Vector3(0, 0, 0));
    A.activeObjectId = o.id; A.selectedObjectIds = new Set([o.id]);
    K.ensureHelpers(o);
    K.setMode('uv');
    K.unwrapSelection();
    K.refreshUI();
    return o;
  }

  function biggestIsland() {
    const o = K.findObject(obj.id);
    const m = K.islandVertexMap(o).attrIsland;
    const by = new Map();
    for (let i = 0; i < m.length; i++) {
      const isl = m[i];
      if (!(isl >= 0)) continue;
      if (!by.has(isl)) by.set(isl, []);
      by.get(isl).push(i);
    }
    let best = null, id = -1;
    by.forEach((ais, isl) => { if (!best || ais.length > best.length) { best = ais; id = isl; } });
    return { id: id, ais: best || [], islands: by.size };
  }

  async function run() {
    A = K.App; T = K.THREE;

    // ---------------------------------------------------------------- 0
    obj = openOn('cylinder', { h: 24, v: 6, x: 2, y: 3, z: 2 }, 'Cyl');
    seat(K.HUB_TOOLS_WORLD, 'addgeo').run();
    await wait(400);
    K.setUvCompMode('island');
    await wait(200);
    ok('0.setup 2D view open, island mode',
       K.uvViewOpen && K.uvCompMode === 'island', 'open=' + K.uvViewOpen + ' mode=' + K.uvCompMode);
    const isl = biggestIsland();
    ok('0.the cylinder unwrapped into islands and one is the side',
       isl.islands >= 1 && isl.ais.length > 20,
       'islands=' + isl.islands + ' biggest=' + isl.ais.length + ' ais');
    const side = new Set(isl.ais);

    // ---------------------------------------------------------------- 1
    const ring = K.HUB_TOOLS_UV2D_WORLD;
    const s5 = seat(ring, 'uvunfold');
    ok('1.seat exists at 5 with a label', !!s5 && s5.seat === 5 && s5.label === 'Unfold',
       s5 ? 'seat=' + s5.seat + ' label=' + s5.label : 'missing');
    ok('1.glyph exists', !!(s5 && K.ICON[s5.icon]), s5 ? 'icon=' + s5.icon : '-');
    const icons = ring.map(t => (typeof t.icon === 'function' ? t.icon() : t.icon));
    ok('1.no two seats on this ring share a glyph',
       new Set(icons).size === icons.length, icons.join(','));
    const seats = ring.map(t => t.seat);
    ok('1.no two seats share a bearing', new Set(seats).size === seats.length, seats.join(','));
    mark('1');

    // ---------------------------------------------------------------- 2
    const pts = scramble(isl.ais, 0.09);
    /* THE DAMAGE HAS TO BE A DOCUMENT STATE, not just bytes in a buffer.
       The scramble writes the attribute directly, so without this the last
       thing in history is the CLEAN unwrap - and the Undo check below then
       measures the scramble rather than the op, which is how it first read
       4.5e-2 and looked like a bug in Unfold. */
    K.pushHistory();
    const m0 = measure(side), c0 = centroid(isl.ais), before = uvCopy();
    const h0 = A.history.length;
    note('2.damaged', 'points offset=' + pts + '  spread ' + r3(m0.spread) +
         '  folds ' + m0.folds + '  tris ' + m0.tris);
    const did = s5.run();
    await wait(300);
    const st = K.uvUnfoldLast, m1 = measure(side), c1 = centroid(isl.ais);
    note('2.unfold', 'ran=' + did + '  islands=' + st.islands + ' done=' + st.done +
         ' no=' + JSON.stringify(st.no) +
         '  e ' + r6(st.e0) + ' -> ' + r6(st.e1) + '  iters=' + st.iters +
         '  ' + Math.round(st.ms) + 'ms');
    ok('2.it ran', did === true, 'ran=' + did);
    ok('2.the conformal energy went down', st.e1 < st.e0,
       r6(st.e0) + ' -> ' + r6(st.e1));
    ok('2.and so did the density spread', m1.spread < m0.spread,
       r3(m0.spread) + ' -> ' + r3(m1.spread));
    /* THE FIXTURE WHERE NO TRADE IS POSSIBLE. A cylinder's side is
       developable, so a correct flattening has one density everywhere. This
       is the check a sphere could never have carried. */
    ok('2.a developable side lands on one density', m1.spread < 1.05,
       'spread=' + r3(m1.spread) + ' (1.00 is perfect)');
    ok('2.no triangle is left inside out', m1.folds === 0,
       m0.folds + ' -> ' + m1.folds);
    ok('2.the island kept its handedness',
       (m0.signed < 0) === (m1.signed < 0),
       r6(m0.signed) + ' -> ' + r6(m1.signed));
    /* The similarity fit matches centroids exactly - not approximately - so
       this is a check on the arithmetic, not on the taste. */
    const dc = Math.sqrt((c1.u - c0.u) * (c1.u - c0.u) + (c1.v - c0.v) * (c1.v - c0.v));
    ok('2.and it landed where it was', dc < 1e-6,
       'centroid moved ' + dc.toExponential(1) + ' over ' + c0.n + ' points');
    ok('2.one press, one history step', A.history.length === h0 + 1,
       h0 + ' -> ' + A.history.length);
    /* The caps are NOT free here, and that is a finding rather than a
       failure: a disk projected onto the sheet and then scaled to fit it is
       an affine map, not a conformal one, so Unfold has something to say
       about them too. What must hold is that every island it touched, it
       improved by its own measure. */
    /* IT TOOK THE ONE THAT NEEDED IT AND LEFT THE OTHER TWO ALONE. The caps
       are flat disks and their projection is already conformal, so the only
       island with anything to win is the side this fixture damaged. An op
       that rewrote all three would be an op that cannot tell. */
    ok('2.it took the damaged island and left the flat caps alone',
       st.done === 1 && st.no.already === 2 && st.refused === 2,
       'islands=' + st.islands + ' done=' + st.done + ' no=' + JSON.stringify(st.no));
    mark('2');

    // ---------------------------------------------------------------- 3
    const h3 = A.history.length;
    const again = s5.run();
    await wait(250);
    const st2 = K.uvUnfoldLast;
    note('3.second press', 'done=' + st2.done + ' why=' + st2.why);
    ok('3.and says why by name', st2.why === 'Already unfolded', st2.why);
    ok('3.a second press is not an edit', again === false, 'ran=' + again);
    ok('3.and writes no history', A.history.length === h3,
       h3 + ' -> ' + A.history.length);
    mark('3');

    // ---------------------------------------------------------------- 4
    K.undo();
    await wait(300);
    const back = uvCopy();
    let worst = 0;
    for (let i = 0; i < before.length && i < back.length; i++) {
      worst = Math.max(worst, Math.abs(Math.fround(before[i]) - Math.fround(back[i])));
    }
    ok('4.Undo puts back exactly what was there',
       back.length === before.length && worst === 0,
       'len ' + before.length + '/' + back.length + ' worst ' + worst.toExponential(1));
    mark('4');

    // ---------------------------------------------------------------- 5
    /* A CLOSED ISLAND, BY HAND. A tetrahedron: every edge carried by two
       faces, so nothing is on an outline and there is no free boundary to
       free. The op must say so rather than pin two arbitrary points and
       hand back a flattened sphere. */
    const tP = [0, 0, 0, 1, 0, 0, 0.5, 0.87, 0, 0.5, 0.29, 0.82];
    const tU = [0, 0, 1, 0, 0.5, 0.87, 0.5, 0.29];
    const tT = [[0, 2, 1], [0, 1, 3], [1, 2, 3], [2, 0, 3]];
    const tfab = K.uvIslandFabric(tT, tP, tU, [0, 1, 2, 3], true);
    const closed = K.uvUnfoldIsland(tfab.pts, tfab.tri, performance.now() + 2000);
    const tT2 = tT.concat([[0, 1, 4]]);
    const tfab2 = K.uvIslandFabric(tT2, tP.concat([0.5, -0.8, 0.3]), tU.concat([0.5, -0.5]), [0, 1, 2, 3, 4], true);
    const fin = K.uvUnfoldIsland(tfab2.pts, tfab2.tri, performance.now() + 2000);
    ok('5.a closed island with a fin is refused as non-manifold', fin.why === 'nonmanifold',
       'why=' + (fin.why || '(solved it anyway)'));

    ok('5.a closed island is refused by name', closed.why === 'closed',
       'why=' + (closed.why || '(solved it anyway)'));
    mark('5');

    // ---------------------------------------------------------------- 6
    /* THE SOLVER'S OWN UNIT TEST, on a case with a known answer. A flat 3x3
       patch mapped by the identity IS conformal, so the energy must read
       zero; the same patch mapped by something bent must come back at zero
       too, because a plane has an exact flattening and this op is supposed to
       find exactly that. If either number is not zero the energy is not the
       energy this op claims to minimise. */
    function patch(f) {
      const P = [], TR = [];
      for (let j = 0; j < 3; j++) {
        for (let i = 0; i < 3; i++) {
          const z = f(i, j);
          P.push({ x: i, y: j, z: 0, u: z[0], v: z[1],
                   fixed: (i === 0 || i === 2 || j === 0 || j === 2), ais: [j * 3 + i] });
        }
      }
      for (let j = 0; j < 2; j++) {
        for (let i = 0; i < 2; i++) {
          const p = j * 3 + i;
          TR.push({ a: p, b: p + 1, c: p + 4, A3: 0.5 });
          TR.push({ a: p, b: p + 4, c: p + 3, A3: 0.5 });
        }
      }
      return K.uvUnfoldIsland(P, TR);
    }
    const flat = patch((i, j) => [i, j]);
    ok('6.a conformal input reads as zero energy', flat.e0 < 1e-12,
       'e0=' + (flat.e0 === 0 ? '0' : flat.e0.toExponential(2)));
    const bent = patch((i, j) => [i + 0.35 * j * j, j - 0.2 * i * i]);
    note('6.bent patch', 'e ' + bent.e0.toExponential(2) + ' -> ' + bent.e1.toExponential(2) +
         '  iters=' + bent.iters + '  folds ' + bent.folds0 + ' -> ' + bent.folds1);
    ok('6.a bent one was bent', bent.e0 > 1e-6, 'e0=' + bent.e0.toExponential(2));
    ok('6.and a plane flattens to nothing', bent.e1 < 1e-10,
       'e1=' + bent.e1.toExponential(2));
    ok('6.with no fold in it', bent.folds1 === 0, bent.folds0 + ' -> ' + bent.folds1);
    mark('6');

    // ---------------------------------------------------------------- 7
    /* THE SELECTION PATH, which no test touched (opus review) - and it is the
       one the scope-widening bug class lives on. Damage the side AND a cap,
       select only the side: the cap must not move, and the toast must name
       the selection, not the work. Then clear it: the toast names every
       island, and the count that changed follows it. */
    const all = biggestIsland();
    const m7 = K.islandVertexMap(K.findObject(obj.id)).attrIsland;
    let capId = -1;
    for (let i = 0; i < m7.length; i++) if (m7[i] >= 0 && m7[i] !== all.id) { capId = m7[i]; break; }
    const capAis = [];
    for (let i = 0; i < m7.length; i++) if (m7[i] === capId) capAis.push(i);
    scramble(all.ais, 0.09); scramble(capAis, 0.02);
    K.pushHistory();
    const capBefore = capAis.map(i => [geo().attributes.uv.array[i * 2], geo().attributes.uv.array[i * 2 + 1]]);
    K.uvIslandSelSet([all.id]);
    document.getElementById('toast').textContent = '';
    const r7 = s5.run();
    await wait(300);
    const t7 = document.getElementById('toast').textContent;
    const capAfter = capAis.map(i => [geo().attributes.uv.array[i * 2], geo().attributes.uv.array[i * 2 + 1]]);
    const capMoved = capAfter.some((p, k) => p[0] !== capBefore[k][0] || p[1] !== capBefore[k][1]);
    ok('7.with one island selected, only it moves', r7 === true && !capMoved && K.uvUnfoldLast.islands === 1,
       'ran=' + r7 + ' capMoved=' + capMoved + ' islands=' + K.uvUnfoldLast.islands);
    ok('7.and the toast says this island', /this island/.test(t7), t7);
    K.uvIslandSelSet([]);
    document.getElementById('toast').textContent = '';
    const r7b = s5.run();
    await wait(300);
    const t7b = document.getElementById('toast').textContent, s7 = K.uvUnfoldLast;
    ok('7.with none selected, the toast names every island and what changed',
       r7b === true && new RegExp('all ' + s7.islands + ' islands').test(t7b) &&
       (s7.done === s7.islands || new RegExp(s7.done + ' changed').test(t7b)),
       t7b + '  (islands=' + s7.islands + ' done=' + s7.done + ')');
    mark('7');

    // ---------------------------------------------------------------- 8
    /* A DART (v2.72a). Two seamed edges in a line through the middle of a
       6x6 plane: the island stays whole, the middle vertex has two runs of
       faces, the two ends one each. The fabric's key must split exactly the
       middle one - and nothing when there are no seams. */
    const pl = openOn('plane', { h: 6, v: 6, x: 6, z: 6 }, 'Dart');
    const pg = K.findObject(pl.id).mesh.geometry, ptopo = K.findObject(pl.id).mesh.userData.topo;
    const pos = pg.attributes.position;
    const Lat = (x, z) => { for (let i = 0; i < pos.count; i++)
      if (Math.abs(pos.getX(i) - x) < 1e-6 && Math.abs(pos.getZ(i) - z) < 1e-6) return ptopo.logicalOf[i]; return -1; };
    const La = Lat(0, -1), Lb = Lat(0, 0), Lc = Lat(0, 1);
    const pobj = K.findObject(pl.id);
    const base = K.computeLogicalOf(pos).logicalOf;
    const distinct = a => new Set(Array.from(a)).size;
    const d0 = distinct(K.uvSeamSplitLogical(pobj, K.toEditable(pobj.mesh), base));
    const keys = [K.creaseKeyFor(K.logicalPos(pobj, La), K.logicalPos(pobj, Lb)),
                  K.creaseKeyFor(K.logicalPos(pobj, Lb), K.logicalPos(pobj, Lc))];
    K.toggleSeamKeys(pobj, keys, true);
    const d1 = distinct(K.uvSeamSplitLogical(pobj, K.toEditable(pobj.mesh), base));
    ok('8.no seams, no split', d0 === distinct(base), d0 + ' vs ' + distinct(base));
    ok('8.a dart splits its middle vertex and only that', La >= 0 && Lc >= 0 && d1 === d0 + 1,
       'ids ' + d0 + ' -> ' + d1 + '  L=' + [La, Lb, Lc].join(','));
    /* Cut's diagonal guard reads topo.edges as LOGICAL outline edges: a
       quad's side must be in it, its diagonal must not. */
    const oset = new Set(ptopo.edges.map(e => e[0] < e[1] ? e[0] + '_' + e[1] : e[1] + '_' + e[0]));
    const kk = (p, q) => p < q ? p + '_' + q : q + '_' + p;
    const Ld = Lat(1, 0);
    const Ldiag1 = Lat(1, 1), Ldiag2 = Lat(1, -1);
    ok('8.an outline edge is an edge, a diagonal is not',
       oset.has(kk(Lb, Ld)) && !(oset.has(kk(Lb, Ldiag1)) && oset.has(kk(Lb, Ldiag2))),
       'side=' + oset.has(kk(Lb, Ld)) + ' diag=' + oset.has(kk(Lb, Ldiag1)) + '/' + oset.has(kk(Lb, Ldiag2)));
    mark('8');
    finish();
  }

  function boot() {
    K = window.__kubik;
    if (!K || !K.App || !K.HUB_TOOLS_UV2D_WORLD || !K.uvUnfold) { setTimeout(boot, 120); return; }
    setTimeout(() => { run().catch(e => finish('THREW ' + (e && e.stack ? e.stack : e))); }, 500);
  }
  boot();
  setTimeout(() => { if (!finished) finish('THREW watchdog - hung after: ' + (OUT[OUT.length - 1] || 'boot')); }, 110000);
})();
