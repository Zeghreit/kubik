/* _uv69cchk - two loose ends closed (v2.69c).

   1. An island drag the sheet clamp pinned to nothing used to push a history
      step named "Moved UV island" over UVs identical to the ones before it -
      an Undo that undoes nothing. endUvVertexDrag has guarded this since
      v2.63; endUvDrag never did.
   2. Two islands can put a UV point on the same spot - a seam marked without
      re-unwrapping is the everyday way - and since v2.69b's one-dot-per-point
      the second one hides under the first. A ring says it is there. */
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
  const r2 = n => Math.round(n * 100) / 100;
  const ev = (type, x, y, id) => new PointerEvent(type, {
    bubbles: true, cancelable: true, pointerId: id, pointerType: 'touch',
    button: 0, buttons: type === 'pointerup' ? 0 : 1, clientX: x, clientY: y
  });
  const box = () => K.uvViewBoxNow;
  const islands = () => Array.from(svg.querySelectorAll('.uv-island'));
  const dots = () => Array.from(svg.querySelectorAll('.uv-vertex'));
  // Card units -> client pixels, through the CTM the view actually draws with.
  function toScreen(x, y) {
    const q = svg.createSVGPoint(); q.x = x; q.y = y;
    return q.matrixTransform(svg.getScreenCTM());
  }
  function centreOf(el) {
    const bb = el.getBBox();
    return toScreen(bb.x + bb.width / 2, bb.y + bb.height / 2);
  }
  // One island drag, in card units, in a few steps like a real finger.
  async function dragIsland(el, dxUnits, dyUnits, id) {
    const c = centreOf(el);
    const s0 = toScreen(0, 0), s1 = toScreen(dxUnits, dyUnits);
    const px = s1.x - s0.x, py = s1.y - s0.y;
    el.dispatchEvent(ev('pointerdown', c.x, c.y, id));
    await wait(30);
    for (let k = 1; k <= 3; k++) {
      svg.dispatchEvent(ev('pointermove', c.x + px * k / 3, c.y + py * k / 3, id));
      await wait(30);
    }
    svg.dispatchEvent(ev('pointerup', c.x + px, c.y + py, id));
    await wait(320);
  }

  async function run() {
    A = K.App; T = K.THREE;

    // ---------------------------------------------------------------- 0
    const o = K.createPrimitiveObject('sphere', { h: 12, v: 8 }, 'Sphere', new T.Vector3(0, 0, 0));
    A.activeObjectId = o.id; A.selectedObjectIds = new Set([o.id]);
    K.ensureHelpers(o);
    K.setMode('uv');
    K.unwrapSelection();
    K.refreshUI();
    seat(K.HUB_TOOLS_WORLD, 'addgeo').run();
    await wait(400);
    svg = document.getElementById('uvViewSvg');
    K.setUvCompMode('island');
    await wait(250);
    ok('0.setup open in island mode', K.uvViewOpen && K.uvCompMode === 'island' && islands().length >= 1,
       'islands=' + islands().length);
    mark('0');

    // ---------------------------------------------------------------- 1
    /* A DRAG THE CLAMP PINNED TO NOTHING WRITES NOTHING. Two drags in the same
       direction: the first is a real move that ends against the sheet's edge,
       the second travels just as far on screen and cannot go anywhere. */
    {
      const b = K.udimBounds();
      say('1.pin sheet x ' + b.x0 + '..' + b.x1 + '  y ' + b.y0.toFixed(1) + '..' + b.y1);
      const isl = islands()[0];
      const h0 = A.historyIndex;
      // Hard left - far past the reachable window, so the clamp stops it.
      await dragIsland(isl, -4000, 0, 801);
      const h1 = A.historyIndex;
      ok('1.pin the first drag is a real move', h1 === h0 + 1, h0 + ' -> ' + h1);
      const isl2 = islands()[0];
      const bbBefore = isl2.getBBox();
      say('1.pin island now at x ' + r2(bbBefore.x) + ' (reach starts at ' + (b.x0 - 20) + ')');
      // And again, the same way, from a position that cannot move any further.
      // The toast is blanked first: the word from the drag above is still on
      // screen, and reading it would be reading the wrong gesture.
      const toastEl = document.getElementById('toast');
      if (toastEl) toastEl.textContent = '';
      await dragIsland(isl2, -4000, 0, 802);
      const h2 = A.historyIndex;
      ok('1.pin THE SECOND WRITES NO HISTORY STEP', h2 === h1, h1 + ' -> ' + h2);
      const isl3 = islands()[0];
      ok('1.pin and the island has not moved', Math.abs(isl3.getBBox().x - bbBefore.x) < 0.01,
         r2(isl3.getBBox().x) + ' vs ' + r2(bbBefore.x));
      const toastTxt = (document.getElementById('toast') || {}).textContent || '';
      ok('1.pin and nothing was announced', toastTxt === '', '"' + toastTxt + '"');
      // A real move still commits, so the guard is not simply a wall.
      await dragIsland(isl3, 25, 0, 803);
      ok('1.pin a move that CAN go somewhere still commits', A.historyIndex === h2 + 1,
         h2 + ' -> ' + A.historyIndex);
      while (A.historyIndex > h0) { K.undo(); await wait(120); }
      await wait(200);
    }
    mark('1');

    // ---------------------------------------------------------------- 2
    /* NO RING WHERE NOTHING OVERLAPS. A freshly unwrapped sphere is one
       island, so every UV point is its own - the ring must not appear just
       because a dot is there. */
    K.setUvCompMode('vertex');
    await wait(300);
    ok('2.quiet a clean layout has no rings', K.uvSplitRings.length === 0,
       'rings=' + K.uvSplitRings.length + ' dots=' + dots().length);
    mark('2');

    // ---------------------------------------------------------------- 3
    /* AND ONE WHERE TWO ISLANDS MEET. Seams marked WITHOUT re-unwrapping is
       the case: the islands split apart while their UVs stay exactly where
       they were, so the two sides of every seam land on each other. */
    {
      K.closeUvView();
      await wait(200);
      K.setMode('edge');
      K.ensureHelpers(o);
      A.selectedElements = new Set(o.mesh.userData.topo.edges.map((e, i) => i));
      K.markSeamSelection(true);
      A.selectedElements = new Set();
      K.setMode('uv');
      K.refreshUI();
      // Deliberately NO unwrapSelection here - that is the whole case.
      seat(K.HUB_TOOLS_WORLD, 'addgeo').run();
      await wait(400);
      svg = document.getElementById('uvViewSvg');
      K.setUvCompMode('vertex');
      await wait(350);
      const rings = K.uvSplitRings;
      say('3.ring islands=' + islands().length + ' dots=' + dots().length +
          ' rings=' + rings.length);
      ok('3.ring the seams split the layout', islands().length > 1, 'islands=' + islands().length);
      ok('3.ring and the overlaps are marked', rings.length > 0, 'rings=' + rings.length);
      ok('3.ring every ring stands for at least two points',
         rings.every(r => r.n >= 2), JSON.stringify(rings.slice(0, 3)));
      // A ring sits exactly on a dot, never off on its own.
      const at = (x, y) => dots().some(el =>
        Math.abs(parseFloat(el.getAttribute('cx')) - x) < 1e-6 &&
        Math.abs(parseFloat(el.getAttribute('cy')) - y) < 1e-6);
      ok('3.ring and each one is on a dot', rings.every(r => at(r.x, r.y)),
         JSON.stringify(rings.filter(r => !at(r.x, r.y)).slice(0, 3)));
      // It is a sign, not a target: the finger still lands on the dot.
      if (rings.length) {
        const p = toScreen(rings[0].x, rings[0].y);
        const top = document.elementFromPoint(p.x, p.y);
        ok('3.ring it catches nothing - the dot does',
           !!top && (top.getAttribute('class') || '').indexOf('uv-vertex-split') < 0,
           top ? top.getAttribute('class') : 'null');
      }
      // And it is drawn behind every dot, so it cannot hide one.
      const kids = Array.from(svg.children);
      const lastRing = kids.map((el, i) => (el.getAttribute('class') || '').indexOf('uv-vertex-split') >= 0 ? i : -1)
        .reduce((a, b) => Math.max(a, b), -1);
      const firstDot = kids.findIndex(el => (el.getAttribute('class') || '') === 'uv-vertex' ||
        (el.getAttribute('class') || '').indexOf('uv-vertex ') === 0);
      ok('3.ring and every ring is behind every dot',
         lastRing < 0 || firstDot < 0 || lastRing < firstDot,
         'lastRing=' + lastRing + ' firstDot=' + firstDot);
    }
    mark('3');

    finish();
  }

  function boot() {
    K = window.__kubik;
    if (!K || !K.App || K.uvSplitRings === undefined || !K.udimBounds) { setTimeout(boot, 120); return; }
    setTimeout(() => { run().catch(e => finish('THREW ' + (e && e.stack ? e.stack : e))); }, 500);
  }
  boot();
  setTimeout(() => { if (OUT.length === 0) finish('THREW boot timeout'); }, 110000);
})();
