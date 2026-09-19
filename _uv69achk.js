/* _uv69achk - the wireframe follows the vertex, and the view has no frame
   (v2.69a).

   The live half is checked on the PATH STRING, mid-gesture, before any
   pointerup: that string is the only place "what is on screen right now"
   actually lives. A check that waits for the commit would pass on the old
   file, because the old file was correct at the commit - it was wrong in
   between, which is the whole complaint. */
(function () {
  const OUT = [];
  let fails = 0;
  const say = s => OUT.push(s);
  const ok = (name, cond, detail) => {
    if (!cond) fails++;
    say((cond ? 'PASS ' : 'FAIL ') + name + (detail === undefined ? '' : '  ' + detail));
  };
  const post = (p, b) => { try { const x = new XMLHttpRequest(); x.open('POST', p, true); x.send(b); } catch (e) {} };
  const mark = s => post('/mark', 'at: ' + s + '\n' + OUT.join('\n'));
  function finish(extra) {
    if (extra) { say(extra); fails++; }
    say('VERDICT=' + (fails ? 'FAIL' : 'PASS') + ' (' + fails + ' failed)');
    post('/done', OUT.join('\n'));
  }
  let K = null, A = null, T = null, svg = null;
  const wait = ms => new Promise(r => setTimeout(r, ms));
  const seat = (arr, key) => arr.find(t => t.key === key);
  const obj = () => A.objects.find(x => x.id === A.activeObjectId);
  const r2 = n => Math.round(n * 100) / 100;

  const ev = (type, x, y, id) => new PointerEvent(type, {
    bubbles: true, cancelable: true, pointerId: id, pointerType: 'touch',
    button: 0, buttons: type === 'pointerup' || type === 'pointercancel' ? 0 : 1,
    clientX: x, clientY: y
  });
  // A card-units point, on screen.
  function toScreen(x, y) {
    const q = svg.createSVGPoint();
    q.x = x; q.y = y;
    return q.matrixTransform(svg.getScreenCTM());
  }
  // How many triangles a path string holds, and whether a given corner is in it.
  const zCount = el => (el && (el.getAttribute('d') || '').split('Z').length - 1) || 0;
  const hasPt = (el, x, y) =>
    !!el && (el.getAttribute('d') || '').indexOf(x.toFixed(2) + ',' + y.toFixed(2)) >= 0;
  // The island group whose wireframe is drawn through a given corner.
  function islandAt(x, y) {
    let found = null;
    svg.querySelectorAll('.uv-island').forEach(g => {
      if (found) return;
      if (hasPt(g.querySelector('.uv-fill'), x, y)) found = g;
    });
    return found;
  }
  const fills = g => g.querySelectorAll('.uv-fill');
  const edges = g => g.querySelectorAll('.uv-edges');

  async function run() {
    A = K.App; T = K.THREE;

    // ---------------------------------------------------------------- 0
    /* A SPHERE ON AUTOMATIC SEAMS, and deliberately not the other probes'
       setup. They seam EVERY edge, which puts each face in an island of its
       own: two triangles, every corner touching both, and a split into
       "moving" and "still" with nothing on the still side - section 2's
       arithmetic would pass while testing nothing. One big island with an
       interior vertex in it is the case this version is about. */
    // Always made, never borrowed: the app boots with a cube in the scene and
    // the other probes' `if (!objects[0])` therefore never fires.
    const o = K.createPrimitiveObject('sphere', { h: 12, v: 8 }, 'Sphere',
                                      new T.Vector3(0, 0, 0));
    A.activeObjectId = o.id; A.selectedObjectIds = new Set([o.id]);
    K.ensureHelpers(o);
    K.setMode('uv');
    K.unwrapSelection();
    K.refreshUI();
    seat(K.HUB_TOOLS_WORLD, 'addgeo').run();
    await wait(300);
    svg = document.getElementById('uvViewSvg');
    K.setUvCompMode('vertex');
    await wait(200);
    const dots = () => svg.querySelectorAll('.uv-vertex');
    ok('0.setup view open, in vertex mode',
       K.uvViewOpen && K.uvCompMode === 'vertex' && dots().length >= 8,
       'dots=' + dots().length + ' islands=' + svg.querySelectorAll('.uv-island').length);
    mark('0');

    // ---------------------------------------------------------------- 1
    /* NO FRAME. The complaint was a grey slab with a rule around it sitting
       over the app; the answer is the svg carrying neither. */
    {
      const cs = getComputedStyle(svg);
      const b = ['borderTopWidth', 'borderRightWidth', 'borderBottomWidth', 'borderLeftWidth']
        .map(k => parseFloat(cs[k]) || 0);
      ok('1.frame no border on any side', b.every(n => n === 0), JSON.stringify(b));
      /* Transparent, not "the same colour as the view": a colour copied from
         --bg would be one more thing to keep in step with the theme. */
      const bg = cs.backgroundColor.replace(/\s/g, '');
      ok('1.frame no background of its own',
         bg === 'rgba(0,0,0,0)' || bg === 'transparent', cs.backgroundColor);
      // And the view under it still paints, so nothing is see-through to white.
      const vbg = getComputedStyle(document.getElementById('uvView')).backgroundColor;
      ok('1.frame the view itself still has one', vbg && vbg.replace(/\s/g, '') !== 'rgba(0,0,0,0)', vbg);
      // With the border gone, the border box IS the content box.
      const r = svg.getBoundingClientRect();
      ok('1.frame the aspect is the whole element now',
         Math.abs(K.uvAspect() - r.height / r.width) < 1e-3,
         r2(K.uvAspect()) + ' vs ' + r2(r.height / r.width));
    }
    mark('1');

    // ---------------------------------------------------------------- 2
    /* THE LIVE HALF. Measured mid-gesture, on the path string - that string is
       the only place "what is on screen right now" lives, and a check that
       waited for the commit would pass on the old file too. */
    let dot = null, cx = 0, cy = 0, g0 = null, z0 = 0;
    {
      const all = Array.from(dots());
      for (let i = 0; i < all.length && !dot; i++) {
        const x = parseFloat(all[i].getAttribute('cx')), y = parseFloat(all[i].getAttribute('cy'));
        const g = islandAt(x, y);
        if (g && zCount(g.querySelector('.uv-fill')) >= 4) { dot = all[i]; cx = x; cy = y; g0 = g; }
      }
      ok('2.live found a vertex on an island worth splitting', !!dot,
         dot ? 'island ' + g0.dataset.island + ' tris ' + zCount(g0.querySelector('.uv-fill')) : '');
    }
    if (dot) {
      const fill0 = g0.querySelector('.uv-fill'), edge0 = g0.querySelector('.uv-edges');
      z0 = zCount(fill0);
      const s = toScreen(cx, cy);
      const id = 601;
      dot.dispatchEvent(ev('pointerdown', s.x, s.y, id));
      await wait(30);
      /* A TAP PAYS NOTHING (review finding). The split waits for a move past
         the tap threshold, because building a selection in this view is done
         one tap at a time and a toEditable per tap is not free. */
      ok('2.live a press alone splits nothing', K.uvLivePartCount === 0,
         'parts=' + K.uvLivePartCount);
      const dx = 9, dy = -6;
      const t = toScreen(cx + dx, cy + dy);
      svg.dispatchEvent(ev('pointermove', t.x, t.y, id));
      await wait(40);
      ok('2.live the move split it', K.uvLivePartCount === 1, 'parts=' + K.uvLivePartCount);
      ok('2.live the moving set is the fan, not the island',
         K.uvLiveMovingTris >= 1 && K.uvLiveMovingTris < z0,
         'moving=' + K.uvLiveMovingTris + ' of ' + z0);
      /* ONE path, still - two was the first draft and drew a hairline seam
         around the moving fan. */
      ok('2.live still one fill and one wireframe',
         fills(g0).length === 1 && edges(g0).length === 1,
         fills(g0).length + '/' + edges(g0).length);
      ok('2.live and no triangle was lost or drawn twice',
         zCount(fill0) === z0, zCount(fill0) + ' vs ' + z0);
      ok('2.live THE WIREFRAME IS AT THE DRAGGED CORNER, mid-gesture',
         hasPt(fill0, cx + dx, cy + dy) && hasPt(edge0, cx + dx, cy + dy),
         'want ' + (cx + dx).toFixed(2) + ',' + (cy + dy).toFixed(2));
      // The dot and the corner it is drawn on cannot disagree.
      const tr = dot.getAttribute('transform') || '';
      ok('2.live the dot carries the same delta', tr.indexOf('translate(9.00,-6.00)') >= 0, tr);
      svg.dispatchEvent(ev('pointerup', t.x, t.y, id));
      await wait(200);
    }
    mark('2');

    // ---------------------------------------------------------------- 3
    /* AND THE SPLIT IS PUT AWAY. A commit redraws, so the island has to come
       back at its real settled coordinates, not the temporary string. */
    if (dot) {
      ok('3.after no live parts left', K.uvLivePartCount === 0, 'parts=' + K.uvLivePartCount);
      const g = svg.querySelector('.uv-island[data-island="' + g0.dataset.island + '"]');
      ok('3.after one fill and one wireframe', !!g &&
         fills(g).length === 1 && edges(g).length === 1,
         g ? fills(g).length + '/' + edges(g).length : 'island gone');
      ok('3.after the same triangle count as before', !!g && zCount(g.querySelector('.uv-fill')) === z0,
         g ? zCount(g.querySelector('.uv-fill')) + ' vs ' + z0 : '');
      ok('3.after the committed wireframe holds the moved corner',
         !!g && hasPt(g.querySelector('.uv-fill'), cx + 9, cy - 6),
         'want ' + (cx + 9).toFixed(2) + ',' + (cy - 6).toFixed(2));
    }
    mark('3');

    // ---------------------------------------------------------------- 4
    /* A CANCEL LEAVES NO TRACE. Nothing redraws behind a pointercancel, so if
       endUvLiveParts did not restore the saved d the island would be left
       showing the drag's last frame for good. */
    {
      const all = Array.from(dots());
      let d2 = null, x2 = 0, y2 = 0, g2 = null;
      for (let i = 0; i < all.length && !d2; i++) {
        const x = parseFloat(all[i].getAttribute('cx')), y = parseFloat(all[i].getAttribute('cy'));
        const g = islandAt(x, y);
        if (g && zCount(g.querySelector('.uv-fill')) >= 4) { d2 = all[i]; x2 = x; y2 = y; g2 = g; }
      }
      ok('4.cancel found a vertex', !!d2);
      if (d2) {
        const beforeFill = g2.querySelector('.uv-fill').getAttribute('d');
        const beforeEdges = g2.querySelector('.uv-edges').getAttribute('d');
        const uvBefore = Array.prototype.slice.call(obj().mesh.geometry.attributes.uv.array);
        const s = toScreen(x2, y2), id = 602;
        d2.dispatchEvent(ev('pointerdown', s.x, s.y, id));
        await wait(30);
        const t = toScreen(x2 + 7, y2 + 4);
        svg.dispatchEvent(ev('pointermove', t.x, t.y, id));
        await wait(40);
        ok('4.cancel the split stood', K.uvLivePartCount === 1, 'parts=' + K.uvLivePartCount);
        ok('4.cancel and the wireframe moved', g2.querySelector('.uv-fill').getAttribute('d') !== beforeFill);
        svg.dispatchEvent(ev('pointercancel', t.x, t.y, id));
        await wait(150);
        ok('4.cancel the split is gone', K.uvLivePartCount === 0, 'parts=' + K.uvLivePartCount);
        ok('4.cancel and the wireframe is exactly what it was',
           g2.querySelector('.uv-fill').getAttribute('d') === beforeFill &&
           g2.querySelector('.uv-edges').getAttribute('d') === beforeEdges);
        const uvAfter = Array.prototype.slice.call(obj().mesh.geometry.attributes.uv.array);
        ok('4.cancel and nothing was written to the UVs',
           uvAfter.length === uvBefore.length &&
           uvAfter.every((n, i) => Math.abs(n - uvBefore[i]) < 1e-9));
      }
    }
    mark('4');
    // ---------------------------------------------------------------- 5
    /* A TRIANGLE WITH MORE THAN ONE MOVING CORNER, and a neighbour that must
       not move. Sections 2-4 pick a vertex sitting in a single triangle, which
       never exercises the per-corner test inside uvTriPaths - a triangle where
       two corners take the delta and the third does not is where an off-by-one
       there would show. */
    {
      const all = Array.from(dots());
      const home = all[Math.floor(all.length / 2)];
      const hx = parseFloat(home.getAttribute('cx')), hy = parseFloat(home.getAttribute('cy'));
      const near = all.map(el => ({
        el, x: parseFloat(el.getAttribute('cx')), y: parseFloat(el.getAttribute('cy'))
      })).sort((a, b) => Math.hypot(a.x - hx, a.y - hy) - Math.hypot(b.x - hx, b.y - hy))
        .slice(0, 8);
      // Only the first four are selected; the rest are neighbours that must
      // stay where they are, which is what makes the last check say something.
      const picked = near.slice(0, 4), anchored = near.slice(4);
      let pid = 650;
      for (const n of picked) {
        const p = toScreen(n.x, n.y);
        n.el.dispatchEvent(ev('pointerdown', p.x, p.y, ++pid));
        svg.dispatchEvent(ev('pointerup', p.x, p.y, pid));
        await wait(60);
      }
      ok('5.group several vertices are selected', K.uvSel.length >= 3,
         'selected=' + K.uvSel.length);
      const g = islandAt(hx, hy);
      ok('5.group they are on a drawn island', !!g);
      if (g) {
        const fill = g.querySelector('.uv-fill');
        const zAll = zCount(fill), before = fill.getAttribute('d');
        const s0 = toScreen(hx, hy), id = 670;
        home.dispatchEvent(ev('pointerdown', s0.x, s0.y, id));
        await wait(30);
        const dx = -8, dy = 5;
        const t = toScreen(hx + dx, hy + dy);
        svg.dispatchEvent(ev('pointermove', t.x, t.y, id));
        await wait(40);
        ok('5.group the moving set is a fan of several triangles',
           K.uvLiveMovingTris >= 3, 'moving=' + K.uvLiveMovingTris + ' of ' + zAll);
        ok('5.group and no triangle was lost or drawn twice',
           zCount(fill) === zAll, zCount(fill) + ' vs ' + zAll);
        ok('5.group the dragged corner is at its new place',
           hasPt(fill, hx + dx, hy + dy),
           'want ' + (hx + dx).toFixed(2) + ',' + (hy + dy).toFixed(2));
        /* THE ANCHORED CORNERS OF A MOVING TRIANGLE STAYED PUT, which is why a
           transform could not do this: a triangle with two moving corners and
           one anchored one has to deform, not slide. */
        const free = anchored.filter(n => K.uvSel.indexOf(+n.el.dataset.ai) < 0);
        ok('5.group there IS an unselected neighbour to check', free.length > 0,
           'free=' + free.length);
        ok('5.group and it stayed exactly where it was',
           free.every(n => hasPt(fill, n.x, n.y)),
           free.map(n => n.x.toFixed(2) + ',' + n.y.toFixed(2)).join(' '));

        // ------------------------------------------------------------ 6
        /* WHAT A FRAME COSTS. One path means the browser re-parses the whole
           island's `d` every frame - the price of not drawing a seam. This is
           the number that says whether that price is payable; if it ever
           climbs, two paths (or a size threshold) is the fallback. */
        const t0 = performance.now();
        const N = 40;
        for (let i = 0; i < N; i++) K.updateUvLiveParts(dx + (i % 2), dy);
        const per = (performance.now() - t0) / N;
        say('6.cost ' + per.toFixed(2) + 'ms per frame, island ' + zAll +
            ' triangles, ' + K.uvLiveMovingTris + ' moving');
        /* 8ms is half a 60fps frame and this runs inside a pointermove that
           does nothing else heavy. On the stand's software rasteriser this is
           pessimistic, which is the right direction for a budget. */
        ok('6.cost a drag frame stays under 8ms', per < 8, per.toFixed(2) + 'ms');
        svg.dispatchEvent(ev('pointercancel', t.x, t.y, id));
        await wait(150);
        ok('6.cost the island is exactly as it was', fill.getAttribute('d') === before);
      }
    }
    mark('5');

    // ---------------------------------------------------------------- 7
    /* THE SAME FRAME, NEAR THE CAP. UV_VIEW_TRI_CAP is 20 000 and this builds
       a sphere of about half that in ONE island - the worst shape for the
       one-path choice, because the whole `d` is re-parsed every frame while
       only the fan is rebuilt. If this number is ever bad, the fallback is
       two paths and the hairline seam they draw. */
    {
      const heavy = K.createPrimitiveObject('sphere', { h: 90, v: 55 }, 'Heavy',
                                            new T.Vector3(4, 0, 0));
      A.activeObjectId = heavy.id; A.selectedObjectIds = new Set([heavy.id]);
      K.ensureHelpers(heavy);
      K.setMode('uv');
      K.unwrapSelection();
      K.refreshUI();
      await wait(500);
      K.setUvCompMode('vertex');
      await wait(400);
      const all = Array.from(dots());
      ok('7.heavy it drew', all.length > 100 && svg.querySelectorAll('.uv-island').length >= 1,
         'dots=' + all.length + ' islands=' + svg.querySelectorAll('.uv-island').length);
      let big = null, bz = 0;
      svg.querySelectorAll('.uv-island').forEach(g => {
        const z = zCount(g.querySelector('.uv-fill'));
        if (z > bz) { bz = z; big = g; }
      });
      say('7.heavy biggest island ' + bz + ' triangles');
      // A dot on that island.
      let pick = null, px = 0, py = 0;
      for (let i = 0; i < all.length && !pick; i++) {
        const x = parseFloat(all[i].getAttribute('cx')), y = parseFloat(all[i].getAttribute('cy'));
        if (islandAt(x, y) === big) { pick = all[i]; px = x; py = y; }
      }
      ok('7.heavy found a vertex on it', !!pick);
      if (pick) {
        const s0 = toScreen(px, py), id = 690;
        const tDown = performance.now();
        pick.dispatchEvent(ev('pointerdown', s0.x, s0.y, id));
        // The dispatch ALONE - an await here would time the sleep as work.
        const downMs = performance.now() - tDown;
        await wait(30);
        const t = toScreen(px + 5, py + 3);
        const tSplit = performance.now();
        svg.dispatchEvent(ev('pointermove', t.x, t.y, id));
        const splitMs = performance.now() - tSplit;
        await wait(40);
        const t0 = performance.now(), N = 30;
        for (let i = 0; i < N; i++) K.updateUvLiveParts(5 + (i % 2), 3);
        const per = (performance.now() - t0) / N;
        say('7.heavy press ' + downMs.toFixed(1) + 'ms, first move (the split) ' +
            splitMs.toFixed(1) + 'ms, then ' + per.toFixed(2) + 'ms per frame · ' +
            K.uvLiveMovingTris + ' moving of ' + bz);
        // A press is a tap until proven otherwise, and must stay cheap.
        ok('7.heavy a press is still cheap', downMs < 30, downMs.toFixed(1) + 'ms');
        ok('7.heavy the split itself is one-off and bearable', splitMs < 250,
           splitMs.toFixed(1) + 'ms');
        ok('7.heavy and a drag frame stays under 8ms', per < 8, per.toFixed(2) + 'ms');
        svg.dispatchEvent(ev('pointercancel', t.x, t.y, id));
        await wait(150);
        ok('7.heavy nothing left behind', K.uvLivePartCount === 0);
      }
    }
    mark('7');

    finish();
  }

  function boot() {
    K = window.__kubik;
    if (!K || !K.App || !K.uvTriPaths || K.uvLivePartCount === undefined) { setTimeout(boot, 120); return; }
    setTimeout(() => {
      run().catch(e => finish('THREW ' + (e && e.stack ? e.stack : e)));
    }, 500);
  }
  // No window.load - the v2.61 lesson.
  boot();
  setTimeout(() => { if (OUT.length === 0) finish('THREW boot timeout - __kubik never appeared'); }, 110000);
})();
