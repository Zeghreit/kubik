/* _uv69chk - the 2D UV view uses the whole screen (v2.69).

   Every check here is a NUMBER off the live DOM: the element's own rect, the
   screen CTM, the box. The thing being tested is exactly the thing that was
   broken before - a square SVG in a tall view - so a check that reasons about
   the box without measuring the element would pass on the old file too. */
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
  const near = (a, b, eps) => Math.abs(a - b) <= eps;
  const r2 = n => Math.round(n * 100) / 100;

  // The element as the browser lays it out. An svg's VIEWPORT is its content
  // box, and this one has a 2px border, so every containment check below works
  // in the content rect - the border box is what section 1 wants instead.
  const rectB = () => svg.getBoundingClientRect();
  function rect() {
    const r = rectB(), cs = getComputedStyle(svg);
    const l = parseFloat(cs.borderLeftWidth) || 0, t = parseFloat(cs.borderTopWidth) || 0;
    const rr = parseFloat(cs.borderRightWidth) || 0, b = parseFloat(cs.borderBottomWidth) || 0;
    return { left: r.left + l, top: r.top + t, right: r.right - rr, bottom: r.bottom - b,
             width: r.width - l - rr, height: r.height - t - b };
  }
  const ctm = () => svg.getScreenCTM();
  const box = () => K.uvViewBoxNow;
  // Everything drawn, in SCREEN pixels - which is the only space in which
  // "the layout fills the view" means anything.
  function islandsScreen() {
    const m = ctm();
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    svg.querySelectorAll('.uv-island').forEach(g => {
      let bb;
      try { bb = g.getBBox(); } catch (e) { return; }
      [[bb.x, bb.y], [bb.x + bb.width, bb.y + bb.height]].forEach(p => {
        const q = svg.createSVGPoint();
        q.x = p[0]; q.y = p[1];
        const s = q.matrixTransform(m);
        if (s.x < x0) x0 = s.x;
        if (s.y < y0) y0 = s.y;
        if (s.x > x1) x1 = s.x;
        if (s.y > y1) y1 = s.y;
      });
    });
    return { x0, y0, x1, y1, w: x1 - x0, h: y1 - y0 };
  }
  // A point of the card's own units, on screen.
  function toScreen(x, y) {
    const q = svg.createSVGPoint();
    q.x = x; q.y = y;
    return q.matrixTransform(ctm());
  }

  async function run() {
    A = K.App; T = K.THREE;

    // ---------------------------------------------------------------- 0
    let o = A.objects[0];
    if (!o) { K.createPrimitiveObject('cube', { h: 1, v: 1 }, 'Cube', new T.Vector3(0, 0, 0)); o = A.objects[0]; }
    A.activeObjectId = o.id; A.selectedObjectIds = new Set([o.id]);
    K.setMode('edge'); K.ensureHelpers(o);
    A.selectedElements = new Set(o.mesh.userData.topo.edges.map((e, i) => i));
    K.markSeamSelection(true);
    A.selectedElements = new Set();
    K.setMode('uv');
    K.unwrapSelection();
    K.refreshUI();
    seat(K.HUB_TOOLS_WORLD, 'addgeo').run();
    await wait(300);
    svg = document.getElementById('uvViewSvg');
    K.setUvCompMode('island');
    await wait(200);
    const islands = () => svg.querySelectorAll('.uv-island');
    ok('0.setup view open', K.uvViewOpen && islands().length >= 2, 'islands=' + islands().length);
    const R0 = rect();
    say('0.setup element ' + r2(R0.width) + 'x' + r2(R0.height) +
        '  box ' + JSON.stringify(box()) + '  aspect ' + r2(K.uvAspect()));
    mark('0');

    // ---------------------------------------------------------------- 1
    /* THE SVG IS THE WRAPPER. The old rule gave the largest square that fits
       both axes: on 412x915 that is 412x412 inside an ~828 tall wrapper, and
       the whole point of this version is that it no longer is. */
    {
      const w = document.getElementById('uvViewSvgWrap').getBoundingClientRect();
      const s = rectB();   // the wrapper is filled by the BORDER box
      ok('1.fill svg width is the wrapper width', near(s.width, w.width, 1.5),
         r2(s.width) + ' vs ' + r2(w.width));
      /* 10px of padding-bottom and nothing else: the height may be that much
         short of the wrapper and no more. A square would be ~416 short. */
      ok('1.fill svg height is the wrapper height less the gap',
         s.height <= w.height + 0.5 && s.height >= w.height - 12,
         r2(s.height) + ' vs ' + r2(w.height));
      ok('1.fill it is not a square on a tall view',
         Math.abs(w.height - w.width) < 12 || !near(s.width, s.height, 2),
         r2(s.width) + 'x' + r2(s.height));
    }
    mark('1');

    // ---------------------------------------------------------------- 2
    /* AND A UV CELL IS STILL SQUARE. The box carries the element's aspect, so
       preserveAspectRatio has nothing left to letterbox and the screen CTM
       scales both axes by the same number. Checked through the CTM rather
       than the numbers in the box: the CTM is what actually draws. */
    {
      const s = rect(), b = box(), m = ctm();
      ok('2.aspect box aspect is the element aspect',
         near(b.h / b.w, s.height / s.width, 1e-3),
         r2(b.h / b.w) + ' vs ' + r2(s.height / s.width));
      ok('2.aspect the CTM scales both axes alike', near(m.a, m.d, Math.abs(m.a) * 1e-6 + 1e-9),
         m.a + ' / ' + m.d);
      ok('2.aspect and it fills the element, no letterbox',
         near(m.a * b.w, s.width, 0.75) && near(m.d * b.h, s.height, 0.75),
         r2(m.a * b.w) + 'x' + r2(m.d * b.h) + ' vs ' + r2(s.width) + 'x' + r2(s.height));
      ok('2.aspect uvAspect agrees with the element',
         near(K.uvAspect(), s.height / s.width, 1e-3), r2(K.uvAspect()));
    }
    mark('2');

    // ---------------------------------------------------------------- 3
    /* IT OPENED ON THE LAYOUT. UV_FRAME_PAD is 1.25, so the axis that limits
       the framing should take about 1/1.25 = 80% of the view, and neither
       axis may spill out of it. Measured on the screen rect, not on the box:
       this is the complaint being answered. */
    {
      const s = rect(), L = islandsScreen();
      ok('3.open something is drawn', isFinite(L.w) && L.w > 0, JSON.stringify(L));
      const fw = L.w / s.width, fh = L.h / s.height;
      ok('3.open the layout fills its limiting axis', Math.max(fw, fh) > 0.7,
         'w ' + r2(fw) + ' h ' + r2(fh));
      ok('3.open and nothing of it is off screen',
         L.x0 >= s.left - 1 && L.x1 <= s.right + 1 && L.y0 >= s.top - 1 && L.y1 <= s.bottom + 1,
         JSON.stringify({ l: r2(L.x0 - s.left), r: r2(s.right - L.x1),
                          t: r2(L.y0 - s.top), b: r2(s.bottom - L.y1) }));
      /* The regression this replaces: the old open framed tile 1001 and a
         cube's islands took 88% of its width but 58% of its height, in a
         square that was itself 45% of the view - 26% of the screen height. */
      ok('3.open it beats what the square gave', fh > 0.30, 'h ' + r2(fh));
    }
    mark('3');

    // ---------------------------------------------------------------- 4
    // The status line still reads the width, and the width still means zoom.
    {
      const b = box();
      const want = Math.round(10000 / b.w) + '%';
      ok('4.zoom the readout is the width', K.uvStatusText.indexOf(want) >= 0,
         K.uvStatusText + ' wanted ' + want);
    }
    mark('4');

    // ---------------------------------------------------------------- 5
    /* RESET STILL SHOWS TILE 1001 WHOLE. That is the promise this function
       has always made, and the aspect must not have cost it: width-limited on
       a tall view, height-limited on a wide one, cropped on neither. */
    {
      K.resetUvViewBox();
      await wait(80);
      const a = K.uvAspect(), b = box(), s = rect();
      const u = K.udimBounds(), span = (u.x1 - u.x0) / K.UDIM_COLS;
      ok('5.reset the box takes the limiting axis',
         near(b.w, a >= 1 ? 100 : 100 / a, 0.01), 'w=' + r2(b.w) + ' a=' + r2(a));
      ok('5.reset and h follows it', near(b.h, b.w * a, 1e-6), r2(b.h));
      const c = [[u.x0, u.y1 - span], [u.x0 + span, u.y1]].map(p => toScreen(p[0], p[1]));
      const x0 = Math.min(c[0].x, c[1].x), x1 = Math.max(c[0].x, c[1].x);
      const y0 = Math.min(c[0].y, c[1].y), y1 = Math.max(c[0].y, c[1].y);
      ok('5.reset tile 1001 is whole on screen',
         x0 >= s.left - 1 && x1 <= s.right + 1 && y0 >= s.top - 1 && y1 <= s.bottom + 1,
         JSON.stringify({ l: r2(x0 - s.left), r: r2(s.right - x1),
                          t: r2(y0 - s.top), b: r2(s.bottom - y1) }));
      ok('5.reset and it is square on screen', near(x1 - x0, y1 - y0, 1),
         r2(x1 - x0) + 'x' + r2(y1 - y0));
    }
    mark('5');

    // ---------------------------------------------------------------- 6
    /* NOTHING CAN WRITE A BOX THAT BREAKS THE RULE, because clampUvViewBox
       is where the rule lives and every writer ends with it. Walked through
       a zoom in, a zoom past the far end, and a pan. */
    {
      const a = K.uvAspect();
      const held = tag => ok('6.rule ' + tag, near(box().h, box().w * a, 1e-6),
                             JSON.stringify(box()) + ' a=' + r2(a));
      const w0 = box().w;
      K.zoomUvViewBoxAt(0.5, 50, 50); held('after a zoom in');
      /* Relative, not absolute: reset leaves w at 100 on a tall view and at
         100/aspect on a wide one, so the absolute number is not the same test
         in the two orientations this probe is run in. */
      ok('6.rule the zoom went in', near(box().w, w0 / 2, 0.01),
         r2(box().w) + ' from ' + r2(w0));
      const Z = K.uvZoomW();
      K.zoomUvViewBoxAt(9999, 50, 50); held('after a zoom past the end');
      ok('6.rule and stopped at the far end', near(box().w, Z.max, 1e-6),
         r2(box().w) + ' max ' + r2(Z.max));
      /* THE FAR END STILL SHOWS THE WHOLE SHEET, which is what UV_ZOOM_MAX was
         chosen for and what a cap on w alone would have cost a wide view. */
      {
        const u = K.udimBounds(), b = box();
        ok('6.rule and the whole sheet fits in it',
           b.w >= u.x1 - u.x0 && b.h >= u.y1 - u.y0,
           JSON.stringify({ w: r2(b.w), h: r2(b.h),
                            sheet: r2(u.x1 - u.x0) + 'x' + r2(u.y1 - u.y0) }));
      }
      K.zoomUvViewBoxAt(1e-9, 50, 50); held('after a zoom past the near end');
      ok('6.rule and stopped at the near end', near(box().w, Z.min, 1e-6),
         r2(box().w) + ' min ' + r2(Z.min));
      // Whichever side is narrower is the one UV_ZOOM_MIN actually guards.
      ok('6.rule the narrow side is UV_ZOOM_MIN',
         near(Math.min(box().w, box().h), K.UV_ZOOM_MIN, 1e-6),
         r2(Math.min(box().w, box().h)));
      // A bare clamp on a box someone left square must also fix it.
      K.clampUvViewBox(); held('after a bare clamp');
    }
    mark('6');

    // ---------------------------------------------------------------- 7
    /* FRAMING ONE ISLAND OBEYS BOTH SPANS. A tall island in a tall view is
       the case the old max(spanX, spanY) got wrong in the other direction:
       with h derived from w, a vertical span that needed more width than the
       horizontal one would have been cropped. */
    {
      const gs = svg.querySelectorAll('.uv-island');
      let worst = null, worstR = -1;
      gs.forEach(g => {
        let bb; try { bb = g.getBBox(); } catch (e) { return; }
        const r = bb.width > 0 ? bb.height / bb.width : 0;
        if (r > worstR) { worstR = r; worst = g; }
      });
      ok('7.one there is an island to frame', !!worst);
      if (worst) {
        K.frameUvElement(worst, '', false);
        await wait(80);
        const s = rect(), m = ctm(), bb = worst.getBBox();
        const p0 = toScreen(bb.x, bb.y), p1 = toScreen(bb.x + bb.width, bb.y + bb.height);
        ok('7.one the island is whole on screen',
           Math.min(p0.x, p1.x) >= s.left - 1 && Math.max(p0.x, p1.x) <= s.right + 1 &&
           Math.min(p0.y, p1.y) >= s.top - 1 && Math.max(p0.y, p1.y) <= s.bottom + 1,
           JSON.stringify({ x: r2(Math.abs(p1.x - p0.x)), y: r2(Math.abs(p1.y - p0.y)),
                            s: r2(s.width) + 'x' + r2(s.height) }));
        const fw = Math.abs(p1.x - p0.x) / s.width, fh = Math.abs(p1.y - p0.y) / s.height;
        ok('7.one and it fills its limiting axis', Math.max(fw, fh) > 0.7,
           'w ' + r2(fw) + ' h ' + r2(fh));
        ok('7.one the box still carries the aspect',
           near(box().h, box().w * K.uvAspect(), 1e-6), JSON.stringify(box()));
      }
      K.frameUvAll(true);
      await wait(80);
    }
    mark('7');

    finish();
  }

  function boot() {
    K = window.__kubik;
    if (!K || !K.App || !K.uvAspect || !K.syncUvBoxH || !K.frameUvAll) { setTimeout(boot, 120); return; }
    setTimeout(() => {
      run().catch(e => finish('THREW ' + (e && e.stack ? e.stack : e)));
    }, 500);
  }
  // No window.load - the v2.61 lesson.
  boot();
  setTimeout(() => { if (OUT.length === 0) finish('THREW boot timeout - __kubik never appeared'); }, 110000);
})();
