/* _uv69bchk - what looks like one vertex IS one vertex, and a selected one
   looks selected (v2.69b).

   The numbers this replaces, measured on the same sphere before the change:
   360 dots at 104 positions, 92 positions holding more than one dot, the
   deepest holding twelve, all twelve one logical mesh vertex; a selected dot
   computed to #d5dce4 against an unselected #eef1f4; and a drag moved one of
   the twelve triangles meeting at that point. */
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
  let K = null, A = null, T = null, svg = null, obj = null;
  const wait = ms => new Promise(r => setTimeout(r, ms));
  const seat = (arr, key) => arr.find(t => t.key === key);
  const r2 = n => Math.round(n * 100) / 100;
  const ev = (type, x, y, id) => new PointerEvent(type, {
    bubbles: true, cancelable: true, pointerId: id, pointerType: 'touch',
    button: 0, buttons: type === 'pointerup' || type === 'pointercancel' ? 0 : 1,
    clientX: x, clientY: y
  });
  function toScreen(x, y) {
    const q = svg.createSVGPoint(); q.x = x; q.y = y;
    return q.matrixTransform(svg.getScreenCTM());
  }
  const dots = () => Array.from(svg.querySelectorAll('.uv-vertex'));
  const posOf = el => el.getAttribute('cx') + ',' + el.getAttribute('cy');
  // How many of an island's triangles have a corner written at a given spot.
  const cornersAt = (g, x, y) => {
    const d = (g.querySelector('.uv-fill').getAttribute('d') || '');
    const s = x.toFixed(2) + ',' + y.toFixed(2);
    let n = 0, i = d.indexOf(s);
    while (i >= 0) { n++; i = d.indexOf(s, i + 1); }
    return n;
  };
  function islandAt(x, y) {
    let found = null;
    svg.querySelectorAll('.uv-island').forEach(g => {
      if (found) return;
      if (cornersAt(g, x, y) > 0) found = g;
    });
    return found;
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
    await wait(300);
    ok('0.setup open in vertex mode', K.uvViewOpen && K.uvCompMode === 'vertex' && dots().length > 8,
       'dots=' + dots().length);
    mark('0');

    // ---------------------------------------------------------------- 1
    /* ONE DOT PER UV POINT. Before: 360 dots on 104 positions. */
    {
      const all = dots();
      const byPos = new Map();
      all.forEach(el => {
        const k = posOf(el);
        byPos.set(k, (byPos.get(k) || 0) + 1);
      });
      let deepest = 0;
      byPos.forEach(n => { if (n > deepest) deepest = n; });
      say('1.one ' + all.length + ' dots on ' + byPos.size + ' positions, deepest stack ' + deepest);
      ok('1.one no two dots share a position', deepest === 1, 'deepest=' + deepest);
      ok('1.one a dot for every welded point', all.length === K.uvWeldPoints,
         all.length + ' vs ' + K.uvWeldPoints);
      /* And the welding is not vacuous - if every group were a single ai this
         whole version would be testing nothing. */
      const ns = all.map(el => +el.dataset.n);
      const biggest = Math.max.apply(null, ns);
      ok('1.one and a point really does stand for several ais', biggest > 1,
         'biggest group=' + biggest + ' total ais=' + ns.reduce((a, b) => a + b, 0));
      say('1.one biggest group ' + biggest + ', ' + ns.reduce((a, b) => a + b, 0) +
          ' attribute vertices behind ' + all.length + ' dots');
    }
    mark('1');

    // ---------------------------------------------------------------- 2
    /* A SELECTED DOT LOOKS SELECTED. The accent was white on white. */
    {
      ok('2.colour the element carries the kind', svg.dataset.kind === 'vertex', svg.dataset.kind);
      const accent = getComputedStyle(svg).getPropertyValue('--accent').trim().toLowerCase();
      ok('2.colour vertex mode gets the vertex accent', accent === '#d9ff3d', accent);
      K.setUvCompMode('edge');
      await wait(200);
      ok('2.colour edge mode gets its own', svg.dataset.kind === 'edge' &&
         getComputedStyle(svg).getPropertyValue('--accent').trim().toLowerCase() === '#46e1ff',
         svg.dataset.kind + ' ' + getComputedStyle(svg).getPropertyValue('--accent'));
      K.setUvCompMode('vertex');
      await wait(250);
    }
    mark('2');

    // ---------------------------------------------------------------- 3
    /* A TAP SELECTS IT, AND THE DIFFERENCE IS VISIBLE. Read off the computed
       fill, not off the class: the class was right before this version and the
       two colours were still a hair apart. */
    let pick = null, px = 0, py = 0, group = null, gEl = null;
    {
      const all = dots();
      // The dot standing for the most attribute vertices - the case that tore.
      all.forEach(el => { if (!pick || +el.dataset.n > +pick.dataset.n) pick = el; });
      px = parseFloat(pick.getAttribute('cx')); py = parseFloat(pick.getAttribute('cy'));
      group = K.uvWeldGroupOf(+pick.dataset.ai);
      gEl = islandAt(px, py);
      ok('3.pick a dot standing for several ais', !!group && group.length > 1,
         'ais=' + (group ? group.length : 0));
      ok('3.pick on a drawn island', !!gEl);
      const before = getComputedStyle(pick).fill;
      const p = toScreen(px, py);
      pick.dispatchEvent(ev('pointerdown', p.x, p.y, 701));
      svg.dispatchEvent(ev('pointerup', p.x, p.y, 701));
      await wait(400);
      const fresh = svg.querySelector('.uv-vertex[data-ai="' + pick.dataset.ai + '"]');
      ok('3.pick the dot is still there', !!fresh);
      ok('3.pick exactly one vertex is selected', K.uvSel.length === 1,
         JSON.stringify(K.uvSel));
      ok('3.pick and the status line says one', K.uvStatusText.indexOf('1 selected') > 0,
         K.uvStatusText);
      const after = fresh ? getComputedStyle(fresh).fill : '';
      say('3.pick fill ' + before + ' -> ' + after);
      ok('3.pick the colour actually changed', !!fresh && after !== before, after);
      ok('3.pick and it is the accent', after.replace(/\s/g, '') === 'rgb(217,255,61)', after);
      // Nothing is drawn over it any more, so the colour reaches the eye.
      const here = dots().filter(el => Math.abs(parseFloat(el.getAttribute('cx')) - px) < 1e-6 &&
                                       Math.abs(parseFloat(el.getAttribute('cy')) - py) < 1e-6);
      ok('3.pick nothing is stacked over it', here.length === 1, 'dots here=' + here.length);
      /* AND A FINGER AIMED AT IT LANDS ON IT - asked at a dot with room
         around it. `pick` above is the biggest weld group, which on a sphere
         is a POLE, where the grid crowds to within a touch target's width of
         itself; there the topmost stroke wins and it is not always the dot you
         aimed at. That is the generous target (--uv-hit) doing its job, not
         this version's doing, and the answer to it is the zoom. */
      const others = dots();
      let roomy = null, roomyGap = 0;
      others.forEach(el => {
        const ex = parseFloat(el.getAttribute('cx')), ey = parseFloat(el.getAttribute('cy'));
        let near = Infinity;
        others.forEach(o => {
          if (o === el) return;
          const d = Math.hypot(parseFloat(o.getAttribute('cx')) - ex,
                               parseFloat(o.getAttribute('cy')) - ey);
          if (d < near) near = d;
        });
        if (near > roomyGap) { roomyGap = near; roomy = el; }
      });
      say('3.pick loneliest dot has ' + roomyGap.toFixed(2) + ' units of clear space');
      const rp = toScreen(parseFloat(roomy.getAttribute('cx')),
                          parseFloat(roomy.getAttribute('cy')));
      const top = document.elementFromPoint(rp.x, rp.y);
      ok('3.pick a finger aimed at a dot lands on that dot',
         !!top && top.dataset && +top.dataset.ai === +roomy.dataset.ai,
         top && top.dataset ? 'ai=' + top.dataset.ai + ' wanted ' + roomy.dataset.ai
                            : String(top));
    }
    mark('3');

    // ---------------------------------------------------------------- 4
    /* A DRAG TAKES THE WHOLE POINT WITH IT. Before: one of the twelve
       triangles meeting there moved and the island tore open. */
    if (pick && gEl && group) {
      const had = cornersAt(gEl, px, py);
      say('4.weld ' + had + ' triangle corners are written at that spot, ' +
          group.length + ' ais behind them');
      ok('4.weld more than one triangle meets there', had > 1, 'corners=' + had);
      const dx = 7, dy = -5;
      const p0 = toScreen(px, py), p1 = toScreen(px + dx, py + dy), id = 711;
      pick.dispatchEvent(ev('pointerdown', p0.x, p0.y, id));
      await wait(30);
      svg.dispatchEvent(ev('pointermove', p1.x, p1.y, id));
      await wait(60);
      ok('4.weld mid-drag, NOTHING is left at the old spot',
         cornersAt(gEl, px, py) === 0, 'still there: ' + cornersAt(gEl, px, py));
      ok('4.weld and every one of them is at the new spot',
         cornersAt(gEl, px + dx, py + dy) === had,
         cornersAt(gEl, px + dx, py + dy) + ' vs ' + had);
      svg.dispatchEvent(ev('pointerup', p1.x, p1.y, id));
      await wait(250);
      /* AND THE WORD FOR IT IS COUNTED IN DOTS (review finding). `ids` is now
         every attribute vertex of the point, so a commit that counted what it
         wrote said "Moved 12 UV vertices" about one dot - directly above a
         status line reading "1 selected". */
      const toastTxt = (document.getElementById('toast') || {}).textContent || '';
      say('4.weld the toast said: "' + toastTxt + '"');
      ok('4.weld the toast counts dots, not attribute vertices',
         toastTxt.indexOf('Moved UV vertex') >= 0, toastTxt +
         ' (the point stands for ' + group.length + ' ais)');
      /* And the commit wrote the same thing: every ai of the point moved by
         the same delta, so they are still one point afterwards. */
      const uv = obj.mesh.geometry.attributes.uv;
      const us = group.map(ai => r2(K.uvToX(uv.getX(ai))));
      const vs = group.map(ai => r2(K.uvToY(uv.getY(ai))));
      ok('4.weld after the commit they are still one point',
         us.every(u => Math.abs(u - us[0]) < 0.02) && vs.every(v => Math.abs(v - vs[0]) < 0.02),
         JSON.stringify(us) + ' ' + JSON.stringify(vs));
      ok('4.weld and that point is where it was dropped',
         Math.abs(us[0] - (px + dx)) < 0.05 && Math.abs(vs[0] - (py + dy)) < 0.05,
         us[0] + ',' + vs[0] + ' want ' + (px + dx).toFixed(2) + ',' + (py + dy).toFixed(2));
      // One dot still, not a fan of them.
      const here = dots().filter(el => Math.abs(parseFloat(el.getAttribute('cx')) - us[0]) < 0.02 &&
                                       Math.abs(parseFloat(el.getAttribute('cy')) - vs[0]) < 0.02);
      ok('4.weld and it is still one dot', here.length === 1, 'dots=' + here.length);
    }
    mark('4');

    finish();
  }

  function boot() {
    K = window.__kubik;
    if (!K || !K.App || K.uvWeldPoints === undefined || !K.uvWeldGroupOf) { setTimeout(boot, 120); return; }
    setTimeout(() => { run().catch(e => finish('THREW ' + (e && e.stack ? e.stack : e))); }, 500);
  }
  boot();
  setTimeout(() => { if (OUT.length === 0) finish('THREW boot timeout'); }, 110000);
})();
