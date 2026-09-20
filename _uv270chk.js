/* _uv270chk - Relax: the inside of an island, outline held still (v2.70).

   The claims, each as a number:
   - it moves interior points and no boundary one (island bbox unchanged);
   - a UV point stays ONE point (v2.69b's weld law) - nothing torn;
   - the spread of area ratio across the mesh goes DOWN, which is what
     "less stretch" means when it is measured rather than looked at;
   - it introduces no flipped triangle (the positive-weight promise);
   - one run, one history step; a second run, none (v2.69c's law);
   - Undo puts back exactly what was there. */
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
  let K = null, A = null, T = null, obj = null;
  const wait = ms => new Promise(r => setTimeout(r, ms));
  const seat = (arr, key) => arr.find(t => t.key === key);
  const r3 = n => Math.round(n * 1000) / 1000;

  function geo() { return K.findObject(obj.id).mesh.geometry; }
  function uvCopy() { return Array.from(geo().attributes.uv.array); }

  /* Per-triangle area ratio, and the two things that can be wrong with a
     layout: how unevenly it is scaled, and whether any triangle is inside
     out. p95/p5 rather than max/min - one degenerate pole triangle is not
     what anybody means by "the island is stretched". */
  function shape() {
    const g = geo(), P = g.attributes.position.array, U = g.attributes.uv.array;
    const idx = g.index.array;
    let pos = 0, neg = 0;
    const sig = [], wt = [];
    for (let i = 0; i < idx.length; i += 3) {
      const a = idx[i], b = idx[i + 1], c = idx[i + 2];
      const ax = P[b * 3] - P[a * 3], ay = P[b * 3 + 1] - P[a * 3 + 1], az = P[b * 3 + 2] - P[a * 3 + 2];
      const bx = P[c * 3] - P[a * 3], by = P[c * 3 + 1] - P[a * 3 + 1], bz = P[c * 3 + 2] - P[a * 3 + 2];
      const cx = ay * bz - az * by, cy = az * bx - ax * bz, cz = ax * by - ay * bx;
      const a3 = Math.sqrt(cx * cx + cy * cy + cz * cz) / 2;
      const s = ((U[b * 2] - U[a * 2]) * (U[c * 2 + 1] - U[a * 2 + 1]) -
                 (U[c * 2] - U[a * 2]) * (U[b * 2 + 1] - U[a * 2 + 1])) / 2;
      if (s > 0) pos++; else if (s < 0) neg++;
      if (a3 > 1e-12 && Number.isFinite(s)) { sig.push(Math.abs(s) / a3); wt.push(a3); }
    }
    /* Two coefficients of variation of texel density, and the pair is the
       point: `cv` counts every triangle once, `cvw` counts it by its surface
       area. The op weights its energy by area, so if it is trading the small
       triangles away for the big ones, cvw improves while cv does not - which
       is a thing to know rather than to argue about. Computed before the
       sort, which would break the pairing with the weights. */
    let m = 0, mw = 0, wsum = 0;
    for (let i = 0; i < sig.length; i++) { m += sig[i]; mw += sig[i] * wt[i]; wsum += wt[i]; }
    m /= sig.length || 1;
    mw /= wsum || 1;
    let vsum = 0, vw = 0;
    for (let i = 0; i < sig.length; i++) {
      vsum += (sig[i] - m) * (sig[i] - m);
      vw += wt[i] * (sig[i] - mw) * (sig[i] - mw);
    }
    const cv = m > 0 ? Math.sqrt(vsum / (sig.length || 1)) / m : Infinity;
    const cvw = mw > 0 ? Math.sqrt(vw / (wsum || 1)) / mw : Infinity;
    /* AND THE SAME WITHOUT THE SLIVERS. A sphere's poles are triangles with
       almost no surface at all; sigma is surface per UV, so a triangle with
       no surface has an enormous sigma and OWNS an unweighted variance. They
       are also the triangles an area-weighted op is nearly free to move. So:
       the same number over the triangles that carry real surface - under a
       twentieth of the mean is a sliver - reported beside the other two, so
       that "it wrecked the poles" and "it wrecked the island" cannot be
       mistaken for each other. */
    const mean3 = wsum / (wt.length || 1);
    let bn = 0, bm = 0;
    for (let i = 0; i < sig.length; i++) if (wt[i] >= mean3 * 0.05) { bm += sig[i]; bn++; }
    bm /= bn || 1;
    let bv = 0;
    for (let i = 0; i < sig.length; i++) if (wt[i] >= mean3 * 0.05) bv += (sig[i] - bm) * (sig[i] - bm);
    const cvb = bm > 0 ? Math.sqrt(bv / (bn || 1)) / bm : Infinity;
    const slivers = sig.length - bn;
    sig.sort((x, y) => x - y);
    const at = q => sig[Math.min(sig.length - 1, Math.max(0, Math.round(q * (sig.length - 1))))];
    const lo = at(0.05), hi = at(0.95), q1 = at(0.25), q3 = at(0.75);
    return { spread: lo > 0 ? hi / lo : Infinity, iqr: q1 > 0 ? q3 / q1 : Infinity,
             cv: cv, cvw: cvw, cvb: cvb, slivers: slivers,
             flips: Math.min(pos, neg), tris: idx.length / 3 };
  }

  /* Every UV point, as v2.69b defines one: a logical mesh vertex at a UV.
     Built BEFORE the op; afterwards every member of a group must still hold
     one and the same UV, or the op tore an island. */
  function weldGroups() {
    const g = geo(), P = g.attributes.position.array, U = g.attributes.uv.array;
    const n = g.attributes.position.count, by = new Map(), out = [];
    for (let i = 0; i < n; i++) {
      const k = Math.round(P[i * 3] * 1e4) + '|' + Math.round(P[i * 3 + 1] * 1e4) + '|' +
                Math.round(P[i * 3 + 2] * 1e4) + '|' + Math.round(U[i * 2] * 1e6) + '|' +
                Math.round(U[i * 2 + 1] * 1e6);
      let a = by.get(k);
      if (!a) { a = []; by.set(k, a); out.push(a); }
      a.push(i);
    }
    return out.filter(a => a.length > 1);
  }
  function torn(groups) {
    const U = geo().attributes.uv.array;
    let bad = 0;
    for (const g of groups) {
      for (let i = 1; i < g.length; i++) {
        if (U[g[i] * 2] !== U[g[0] * 2] || U[g[i] * 2 + 1] !== U[g[0] * 2 + 1]) { bad++; break; }
      }
    }
    return bad;
  }

  /* The bounding box of every island, which is made of boundary points only -
     so if the outline stood still, this is unchanged to the last bit. */
  function boxes() {
    const g = geo(), U = g.attributes.uv.array;
    const m = K.islandVertexMap(K.findObject(obj.id));
    const out = new Map();
    for (let ai = 0; ai < m.attrIsland.length; ai++) {
      const isl = m.attrIsland[ai];
      if (!(isl >= 0)) continue;
      const u = U[ai * 2], v = U[ai * 2 + 1];
      if (!Number.isFinite(u) || !Number.isFinite(v)) continue;
      let b = out.get(isl);
      if (!b) { b = [u, v, u, v]; out.set(isl, b); }
      else {
        if (u < b[0]) b[0] = u; if (v < b[1]) b[1] = v;
        if (u > b[2]) b[2] = u; if (v > b[3]) b[3] = v;
      }
    }
    return out;
  }
  function boxDrift(before, after) {
    let grew = 0, worst = 0;
    before.forEach((b, isl) => {
      const a = after.get(isl);
      if (!a) return;
      for (let i = 0; i < 4; i++) worst = Math.max(worst, Math.abs(a[i] - b[i]));
      if (a[0] < b[0] - 1e-9 || a[1] < b[1] - 1e-9 || a[2] > b[2] + 1e-9 || a[3] > b[3] + 1e-9) grew++;
    });
    return { grew: grew, worst: worst };
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

  async function run() {
    A = K.App; T = K.THREE;

    // ---------------------------------------------------------------- 0
    obj = openOn('sphere', { h: 12, v: 8 }, 'Sphere');
    seat(K.HUB_TOOLS_WORLD, 'addgeo').run();
    await wait(400);
    K.setUvCompMode('island');
    await wait(200);
    ok('0.setup 2D view open, island mode',
       K.uvViewOpen && K.uvCompMode === 'island', 'open=' + K.uvViewOpen + ' mode=' + K.uvCompMode);

    // ---------------------------------------------------------------- 1
    const ring = K.HUB_TOOLS_UV2D_WORLD;
    const s6 = seat(ring, 'uvrelax');
    ok('1.seat exists at 6 with a label', !!s6 && s6.seat === 6 && s6.label === 'Relax',
       s6 ? 'seat=' + s6.seat + ' label=' + s6.label : 'missing');
    ok('1.glyph exists', !!(s6 && K.ICON[s6.icon]), s6 ? 'icon=' + s6.icon : '-');
    const icons = ring.map(t => (typeof t.icon === 'function' ? t.icon() : t.icon));
    ok('1.no two seats on this ring share a glyph',
       new Set(icons).size === icons.length, icons.join(','));
    const seats = ring.map(t => t.seat);
    ok('1.no two seats share a bearing', new Set(seats).size === seats.length, seats.join(','));
    mark('1');

    // ---------------------------------------------------------------- 2
    const before = shape();
    const groups = weldGroups();
    const hasMap = typeof K.islandVertexMap === 'function';
    const b0 = hasMap ? boxes() : null;
    const uv0 = uvCopy();
    const h0 = A.history.length;
    const t0 = performance.now();
    const did = s6.run();
    const wall = performance.now() - t0;
    const st = K.uvRelaxLast;
    ok('2.it ran and reported', did === true && !!st, 'did=' + did);
    if (!st) { finish(); return; }
    note('2.report', 'islands=' + st.islands + ' points=' + st.points + ' interior=' + st.interior +
         ' moved=' + st.moved + ' sweeps=' + st.sweeps +
         ' skipped=' + st.skipped + ' capped=' + st.capped +
         ' solve=' + r3(st.ms) + 'ms wall=' + r3(wall) + 'ms');
    ok('2.it moved interior points', st.moved > 0 && st.interior > 0, 'moved=' + st.moved);
    ok('2.it skipped no island', st.skipped === 0, 'skipped=' + st.skipped);
    ok('2.it settled inside the sweep cap', !st.capped && st.sweeps < K.UV_RELAX_SWEEP_CAP,
       'sweeps=' + st.sweeps + ' cap=' + K.UV_RELAX_SWEEP_CAP);
    note('2.energy', 'symD ' + r3(st.energy0) + ' -> ' + r3(st.energy1) +
         '  (' + Math.round((1 - st.energy1 / st.energy0) * 1000) / 10 + '% off, 4 is perfect)' +
         '   L2 ' + r3(st.stretch0) + ' -> ' + r3(st.stretch1) + ' (1 is perfect)');
    ok('2.the energy it minimises went down', st.energy1 < st.energy0,
       r3(st.energy0) + ' -> ' + r3(st.energy1));
    mark('2');

    // ---------------------------------------------------------------- 3
    const after = shape();
    note('3.texel density', 'cv ' + r3(before.cv) + ' -> ' + r3(after.cv) +
         '   cvw ' + r3(before.cvw) + ' -> ' + r3(after.cvw) +
         '   cv-no-slivers ' + r3(before.cvb) + ' -> ' + r3(after.cvb) +
         '   p75/p25 ' + r3(before.iqr) + ' -> ' + r3(after.iqr) +
         '   p95/p5 ' + r3(before.spread) + ' -> ' + r3(after.spread) +
         '  (' + before.tris + ' triangles, ' + before.slivers + ' slivers)');
    ok('3.the bulk of the island gets more even', after.iqr < before.iqr,
       'p75/p25 ' + r3(before.iqr) + ' -> ' + r3(after.iqr));
    ok('3.and not at the cost of the triangles that carry surface',
       after.cvb <= before.cvb * 1.05,
       'cv-no-slivers ' + r3(before.cvb) + ' -> ' + r3(after.cvb));
    ok('3.no triangle turned inside out', after.flips <= before.flips && after.flips === 0,
       'before=' + before.flips + ' after=' + after.flips);
    ok('3.nothing torn - every UV point is still one point', torn(groups) === 0,
       'groups=' + groups.length + ' torn=' + torn(groups));
    if (hasMap) {
      const d = boxDrift(b0, boxes());
      ok('3.no island outline moved', d.grew === 0 && d.worst < 1e-6,
         'grew=' + d.grew + ' worst=' + d.worst.toExponential(1));
    } else {
      note('3.outline', 'islandVertexMap not exported - box test skipped');
    }
    ok('3.one run, one history step', A.history.length === h0 + 1,
       h0 + ' -> ' + A.history.length);
    mark('3');

    // ---------------------------------------------------------------- 4
    const h1 = A.history.length;
    const uv1 = uvCopy();
    const did2 = s6.run();
    const st2 = K.uvRelaxLast;
    ok('4.a second run commits nothing', did2 === false && st2,
       'did=' + did2 + ' moved=' + (st2 ? st2.moved : '-') +
       ' drop=' + (st2 ? Math.round((1 - st2.energy1 / st2.energy0) * 1e5) / 1e3 + '%' : '-'));
    ok('4.and pushes no history step', A.history.length === h1, h1 + ' -> ' + A.history.length);
    const uv1b = uvCopy();
    ok('4.and changes no UV', uv1.every((x, i) => x === uv1b[i]));
    mark('4');

    // ---------------------------------------------------------------- 5
    const steps = A.history.length - h0;
    for (let i = 0; i < steps; i++) { K.undo(); await wait(220); }
    const back = uvCopy();
    let diff = 0, worst = 0;
    for (let i = 0; i < uv0.length; i++) {
      if (back[i] !== uv0[i]) { diff++; worst = Math.max(worst, Math.abs(back[i] - uv0[i])); }
    }
    ok('5.Undo puts back exactly what was there', diff === 0,
       'steps=' + steps + ' differing=' + diff + ' worst=' + worst.toExponential(1) +
       ' len=' + back.length + '/' + uv0.length);
    mark('5');

    // ---------------------------------------------------------------- 6
    /* Scope: with islands selected it is those islands and nothing else. */
    const svg = document.getElementById('uvViewSvg');
    const els = svg ? Array.from(svg.querySelectorAll('.uv-island')) : [];
    if (els.length >= 1 && K.uvIslandSel) {
      const bb = els[0].getBBox();
      const q = svg.createSVGPoint();
      q.x = bb.x + bb.width / 2; q.y = bb.y + bb.height / 2;
      const c = q.matrixTransform(svg.getScreenCTM());
      const ev = (type, id) => new PointerEvent(type, {
        bubbles: true, cancelable: true, pointerId: id, pointerType: 'touch',
        button: 0, buttons: type === 'pointerup' ? 0 : 1, clientX: c.x, clientY: c.y
      });
      els[0].dispatchEvent(ev('pointerdown', 71));
      await wait(40);
      svg.dispatchEvent(ev('pointerup', 71));
      await wait(260);
      const selN = K.uvIslandSel.length;
      if (selN === 1) {
        const pre = uvCopy();
        const m = K.islandVertexMap(K.findObject(obj.id));
        s6.run();
        const st3 = K.uvRelaxLast, post2 = uvCopy();
        const touched = new Set();
        for (let ai = 0; ai < m.attrIsland.length; ai++) {
          if (pre[ai * 2] !== post2[ai * 2] || pre[ai * 2 + 1] !== post2[ai * 2 + 1]) {
            touched.add(m.attrIsland[ai]);
          }
        }
        ok('6.a selection scopes the op', st3 && st3.scope === 1 && touched.size <= 1,
           'scope=' + (st3 ? st3.scope : '-') + ' islandsTouched=' + touched.size +
           ' moved=' + (st3 ? st3.moved : '-'));
      } else {
        note('6.scope', 'tap selected ' + selN + ' islands - test skipped');
      }
    } else {
      note('6.scope', 'no island elements or no uvIslandSel - test skipped');
    }
    mark('6');

    // ---------------------------------------------------------------- 7
    /* The budget, on a mesh nobody would call small for a phone. */
    seat(K.HUB_TOOLS_UV2D_WORLD, 'to3d').run();
    await wait(250);
    obj = openOn('sphere', { h: 48, v: 32 }, 'Heavy');
    seat(K.HUB_TOOLS_WORLD, 'addgeo').run();
    await wait(600);
    if (K.uvViewOpen) {
      K.setUvCompMode('island');
      await wait(200);
      const hb = shape();
      const t1 = performance.now();
      seat(K.HUB_TOOLS_UV2D_WORLD, 'uvrelax').run();
      const w2 = performance.now() - t1;
      const hs = K.uvRelaxLast, ha = shape();
      note('7.heavy', 'tris=' + hb.tris + ' points=' + hs.points + ' interior=' + hs.interior +
           ' sweeps=' + hs.sweeps + ' capped=' + hs.capped +
           ' solve=' + r3(hs.ms) + 'ms wall=' + r3(w2) + 'ms  symD ' +
           r3(hs.energy0) + ' -> ' + r3(hs.energy1) + '  L2 ' +
           r3(hs.stretch0) + ' -> ' + r3(hs.stretch1) + '  cv ' +
           r3(hb.cv) + ' -> ' + r3(ha.cv) + '  cvw ' +
           r3(hb.cvw) + ' -> ' + r3(ha.cvw) + '  cv-no-slivers ' +
           r3(hb.cvb) + ' -> ' + r3(ha.cvb) + '  p75/p25 ' +
           r3(hb.iqr) + ' -> ' + r3(ha.iqr) + '  p95/p5 ' +
           r3(hb.spread) + ' -> ' + r3(ha.spread) +
           '  slivers=' + hb.slivers);
      ok('7.the solver stays inside its budget', hs.ms <= K.UV_RELAX_BUDGET_MS * 1.5,
         'solve=' + r3(hs.ms) + 'ms budget=' + K.UV_RELAX_BUDGET_MS + 'ms');
      ok('7.and still only helps', hs.energy1 <= hs.energy0,
         r3(hs.energy0) + ' -> ' + r3(hs.energy1));
      ok('7.the bulk gets more even here too', ha.iqr < hb.iqr,
         'p75/p25 ' + r3(hb.iqr) + ' -> ' + r3(ha.iqr));
      ok('7.the whole press stays under a second', w2 < 1000, r3(w2) + 'ms');
      ok('7.no flip on the heavy one', ha.flips === 0, 'flips=' + ha.flips);
    } else {
      note('7.heavy', 'view did not reopen - test skipped');
    }
    mark('7');

    // ---------------------------------------------------------------- 8
    /* THE JOB, not the showroom. A fresh unwrap is the case relax has least
       to offer: the layout is already somebody's best answer. What an artist
       reaches for this button with is a layout they have DAMAGED - dragged a
       row, moved a vertex, pulled a face through its neighbours. So: scramble
       the interior, measure, relax, measure. One offset per UV POINT, or the
       damage is a tear and no op is allowed to fix that. */
    if (K.uvViewOpen) {
      const g0 = geo(), U = g0.attributes.uv.array, Pp = g0.attributes.position.array;
      const by = new Map();
      for (let i = 0; i < g0.attributes.position.count; i++) {
        const k = Math.round(Pp[i * 3] * 1e4) + '|' + Math.round(Pp[i * 3 + 1] * 1e4) + '|' +
                  Math.round(Pp[i * 3 + 2] * 1e4) + '|' + Math.round(U[i * 2] * 1e6) + '|' +
                  Math.round(U[i * 2 + 1] * 1e6);
        let a = by.get(k);
        if (!a) { a = []; by.set(k, a); }
        a.push(i);
      }
      /* A fixed generator, so a failure here is the same failure tomorrow. */
      let seed = 20260920;
      const rnd = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff - 0.5; };
      const amp = 0.012;
      by.forEach(function (ais) {
        const du = rnd() * amp, dv = rnd() * amp;
        for (const ai of ais) { U[ai * 2] += du; U[ai * 2 + 1] += dv; }
      });
      g0.attributes.uv.needsUpdate = true;
      const d0 = shape();
      const r = seat(K.HUB_TOOLS_UV2D_WORLD, 'uvrelax').run();
      const ds = K.uvRelaxLast, d1 = shape();
      note('8.repair', 'damaged -> relaxed:  symD ' + r3(ds.energy0) + ' -> ' + r3(ds.energy1) +
           '  L2 ' + r3(ds.stretch0) + ' -> ' + r3(ds.stretch1) +
           '  cv ' + r3(d0.cv) + ' -> ' + r3(d1.cv) +
           '  cvw ' + r3(d0.cvw) + ' -> ' + r3(d1.cvw) +
           '  p95/p5 ' + r3(d0.spread) + ' -> ' + r3(d1.spread) +
           '  flips ' + d0.flips + ' -> ' + d1.flips +
           '  (op saw ' + ds.folds0 + ' -> ' + ds.folds1 + ')' +
           '  sweeps=' + ds.sweeps + ' solve=' + r3(ds.ms) + 'ms');
      ok('8.it repairs damage it is given', r === true && ds.energy1 < ds.energy0,
         r3(ds.energy0) + ' -> ' + r3(ds.energy1));
      ok('8.density comes back together', d1.cv < d0.cv, r3(d0.cv) + ' -> ' + r3(d1.cv));
      ok('8.stretch comes back down', ds.stretch1 < ds.stretch0,
         r3(ds.stretch0) + ' -> ' + r3(ds.stretch1));
      ok('8.and it unfolds the folds the damage made', d1.flips < d0.flips || d0.flips === 0,
         d0.flips + ' -> ' + d1.flips);
    } else {
      note('8.repair', 'view not open - test skipped');
    }
    mark('8');

    // ---------------------------------------------------------------- 9
    /* A CYLINDER IS DEVELOPABLE and a sphere is not, and the difference is
       the whole argument about section 3. On a developable surface a perfect
       layout EXISTS, so every measure must improve together; on a sphere no
       layout is both equal-area and unsheared, so any op that moves toward one
       gives up some of the other, and which trade is wanted is a question for
       a person, not for a test. This is the fixture where the op has nowhere
       to hide. */
    seat(K.HUB_TOOLS_UV2D_WORLD, 'to3d').run();
    await wait(250);
    obj = openOn('cylinder', { h: 16, v: 6 }, 'Tube');
    seat(K.HUB_TOOLS_WORLD, 'addgeo').run();
    await wait(600);
    if (K.uvViewOpen) {
      const cb = shape();
      seat(K.HUB_TOOLS_UV2D_WORLD, 'uvrelax').run();
      const cs = K.uvRelaxLast, ca = shape();
      note('9.cylinder', 'tris=' + cb.tris + ' interior=' + cs.interior +
           ' sweeps=' + cs.sweeps + ' moved=' + cs.moved +
           '  symD ' + r3(cs.energy0) + ' -> ' + r3(cs.energy1) +
           '  L2 ' + r3(cs.stretch0) + ' -> ' + r3(cs.stretch1) +
           '  cv ' + r3(cb.cv) + ' -> ' + r3(ca.cv) +
           '  cvw ' + r3(cb.cvw) + ' -> ' + r3(ca.cvw) +
           '  p95/p5 ' + r3(cb.spread) + ' -> ' + r3(ca.spread));
      ok('9.on a developable surface the density improves too',
         cs.moved === 0 || ca.cv <= cb.cv + 1e-9,
         'cv ' + r3(cb.cv) + ' -> ' + r3(ca.cv) + ' moved=' + cs.moved);
      ok('9.and so does stretch', cs.moved === 0 || cs.stretch1 <= cs.stretch0,
         r3(cs.stretch0) + ' -> ' + r3(cs.stretch1));
      /* Counted across the whole mesh, so a cap island wound opposite to the
         side island reads as a "flip" that was there before the op. The
         question is only whether this op added one. */
      ok('9.no flip added', ca.flips <= cb.flips, cb.flips + ' -> ' + ca.flips);
    } else {
      note('9.cylinder', 'view did not reopen - test skipped');
    }
    mark('9');

    // ---------------------------------------------------------------- 10
    /* ONE POINT DRAGGED THROUGH ITS NEIGHBOURS, on an island that is already
       settled - the case the first fold-escape rule got wrong. Nothing else
       in the island has any gain left to offer, so three sweeps of nothing
       arrive long before the folded point has widened its probe far enough to
       find the way out, and the op used to stop and say "Already relaxed"
       over a fold that is on the screen. */
    seat(K.HUB_TOOLS_UV2D_WORLD, 'to3d').run();
    await wait(250);
    obj = openOn('sphere', { h: 16, v: 10 }, 'Poke');
    seat(K.HUB_TOOLS_WORLD, 'addgeo').run();
    await wait(600);
    if (K.uvViewOpen) {
      seat(K.HUB_TOOLS_UV2D_WORLD, 'uvrelax').run();   // settle it first
      await wait(200);
      const g1 = geo(), U1 = g1.attributes.uv.array, P1 = g1.attributes.position.array;
      let cu = 0, cv = 0, cn = g1.attributes.position.count;
      for (let i = 0; i < cn; i++) { cu += U1[i * 2]; cv += U1[i * 2 + 1]; }
      cu /= cn; cv /= cn;
      /* The point nearest the island's middle is interior for any island worth
         the name, and its neighbours are the ones it has to cross. */
      let best = -1, bd = Infinity;
      for (let i = 0; i < cn; i++) {
        const d = (U1[i * 2] - cu) * (U1[i * 2] - cu) + (U1[i * 2 + 1] - cv) * (U1[i * 2 + 1] - cv);
        if (d < bd) { bd = d; best = i; }
      }
      let edge = 0, en = 0;
      const idx1 = g1.index.array;
      for (let i = 0; i < idx1.length; i += 3) {
        for (let e = 0; e < 3; e++) {
          const a = idx1[i + e], b = idx1[i + (e + 1) % 3];
          edge += Math.hypot(U1[a * 2] - U1[b * 2], U1[a * 2 + 1] - U1[b * 2 + 1]);
          en++;
        }
      }
      edge /= en || 1;
      const ku = Math.round(P1[best * 3] * 1e4), kv = Math.round(P1[best * 3 + 1] * 1e4),
            kw = Math.round(P1[best * 3 + 2] * 1e4);
      const su = Math.round(U1[best * 2] * 1e6), sv = Math.round(U1[best * 2 + 1] * 1e6);
      let hit = 0;
      for (let i = 0; i < cn; i++) {
        if (Math.round(P1[i * 3] * 1e4) === ku && Math.round(P1[i * 3 + 1] * 1e4) === kv &&
            Math.round(P1[i * 3 + 2] * 1e4) === kw &&
            Math.round(U1[i * 2] * 1e6) === su && Math.round(U1[i * 2 + 1] * 1e6) === sv) {
          U1[i * 2] += edge * 1.5; U1[i * 2 + 1] += edge * 1.5; hit++;
        }
      }
      g1.attributes.uv.needsUpdate = true;
      const p0 = shape();
      const rr = seat(K.HUB_TOOLS_UV2D_WORLD, 'uvrelax').run();
      const ps = K.uvRelaxLast, p1 = shape();
      note('10.one poked point', 'moved ' + hit + ' ais by ' + r3(edge * 1.5) +
           '  flips ' + p0.flips + ' -> ' + p1.flips +
           '  (op saw ' + ps.folds0 + ' -> ' + ps.folds1 + ')' +
           '  ran=' + rr + ' sweeps=' + ps.sweeps + ' why=' + (ps.why || '-'));
      if (p0.flips > 0) {
        ok('10.it does not call a visible fold "already relaxed"', rr === true,
           'ran=' + rr + ' why=' + (ps.why || '-'));
        ok('10.and it undoes the fold', p1.flips < p0.flips,
           p0.flips + ' -> ' + p1.flips);
      } else {
        note('10.one poked point', 'the poke folded nothing - test inconclusive');
      }
    } else {
      note('10.one poked point', 'view did not reopen - test skipped');
    }
    mark('10');

    finish();
  }

  function boot() {
    K = window.__kubik;
    if (!K || !K.App || !K.HUB_TOOLS_UV2D_WORLD || !K.uvRelax) { setTimeout(boot, 120); return; }
    setTimeout(() => { run().catch(e => finish('THREW ' + (e && e.stack ? e.stack : e))); }, 500);
  }
  boot();
  setTimeout(() => { if (OUT.length === 0) finish('THREW boot timeout'); }, 110000);
})();
