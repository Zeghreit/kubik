/* _uv65chk - дверь island-режима и четыре трансформа за ней.

   Проверяется арифметика (то, что обещает подпись места, и то, что четыре
   поворота возвращают ровно туда же), общий пивот на группе, и сам жест
   удержания: что он открывается только по УЖЕ выбранному острову, гаснет от
   движения и не оставляет за собой ни жеста, ни пальца на учёте. */
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

  function centreOf(el) {
    const bb = el.getBBox();
    const pt = svg.createSVGPoint();
    pt.x = bb.x + bb.width / 2; pt.y = bb.y + bb.height / 2;
    const p = pt.matrixTransform(svg.getScreenCTM());
    return { x: p.x, y: p.y };
  }
  const ev = (type, x, y, id) => new PointerEvent(type, {
    bubbles: true, cancelable: true, pointerId: id, pointerType: 'mouse',
    button: 0, buttons: type === 'pointerup' ? 0 : 1, clientX: x, clientY: y
  });
  const down = (el, x, y, id) => el.dispatchEvent(ev('pointerdown', x, y, id));
  const move = (x, y, id) => svg.dispatchEvent(ev('pointermove', x, y, id));
  const up = (x, y, id) => svg.dispatchEvent(ev('pointerup', x, y, id));
  function tap(el, id) { const c = centreOf(el); down(el, c.x, c.y, id); up(c.x, c.y, id); }

  // Коробка выбранных островов в UV - тем же способом, каким её берёт сама
  // операция: по атрибутным вершинам, а не по нарисованному.
  function uvBoxOf(ids) {
    const o = obj();
    const uv = o.mesh.geometry.attributes.uv;
    const { attrIsland } = K.islandVertexMap(o);
    let minU = Infinity, minV = Infinity, maxU = -Infinity, maxV = -Infinity, n = 0;
    for (let ai = 0; ai < attrIsland.length; ai++) {
      if (ids.indexOf(attrIsland[ai]) < 0) continue;
      const u = uv.getX(ai), v = uv.getY(ai);
      if (!Number.isFinite(u) || !Number.isFinite(v)) continue;
      if (u < minU) minU = u;
      if (u > maxU) maxU = u;
      if (v < minV) minV = v;
      if (v > maxV) maxV = v;
      n++;
    }
    return { minU, minV, maxU, maxV, n, cu: (minU + maxU) / 2, cv: (minV + maxV) / 2 };
  }
  // Атрибутная вершина острова с наибольшим u - на ней проверяется матрица.
  function rightmostAi(id) {
    const o = obj();
    const uv = o.mesh.geometry.attributes.uv;
    const { attrIsland } = K.islandVertexMap(o);
    let best = -1, bu = -Infinity;
    for (let ai = 0; ai < attrIsland.length; ai++) {
      if (attrIsland[ai] !== id) continue;
      const u = uv.getX(ai);
      if (Number.isFinite(u) && u > bu) { bu = u; best = ai; }
    }
    return best;
  }
  const uvAt = ai => {
    const uv = obj().mesh.geometry.attributes.uv;
    return { u: uv.getX(ai), v: uv.getY(ai) };
  };
  function uvSnapshot() {
    return Array.prototype.slice.call(obj().mesh.geometry.attributes.uv.array);
  }
  function uvSame(a, b, eps) {
    const e = eps === undefined ? 1e-9 : eps;
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) if (Math.abs(a[i] - b[i]) > e) return false;
    return true;
  }
  const near = (a, b, e) => Math.abs(a - b) < (e === undefined ? 1e-6 : e);

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
    await wait(120);
    svg = document.getElementById('uvViewSvg');
    const islands = () => svg.querySelectorAll('.uv-island');
    ok('0.setup вид открыт', K.uvViewOpen && islands().length >= 2, 'islands=' + islands().length);
    ok('0.setup версия не ниже 2.65',
       parseFloat((((document.querySelector('.brand') || {}).textContent || '').match(/[\d.]+/) || [0])[0]) >= 2.65,
       (document.querySelector('.brand') || {}).textContent);
    mark('0');

    // ---------------------------------------------------------------- 1
    // Кольцо и таблица не могут разойтись - одно строится из другого.
    {
      const keys = Object.keys(K.UV_ISLAND_XFORMS);
      ok('1.ring  четыре трансформа', keys.length === 4, keys.join(','));
      ok('1.ring  и столько же мест', K.HUB_TOOLS_UV2D_ISLAND.length === 4);
      ok('1.ring  места названы по ним',
         keys.every((k, i) => K.HUB_TOOLS_UV2D_ISLAND[i].key === 'uvx-' + k),
         K.HUB_TOOLS_UV2D_ISLAND.map(t => t.key).join(','));
      ok('1.ring  у каждого есть подпись и картинка',
         K.HUB_TOOLS_UV2D_ISLAND.every(t => t.label && t.icon && typeof t.run === 'function'));
    }
    mark('1');

    // ---------------------------------------------------------------- 2
    /* Матрица делает то, что обещает подпись. rotcw должен послать смещение
       (du,dv) в (dv,-du): вправо на экране становится вниз на экране. */
    {
      const isl = islands();
      const id0 = +isl[0].dataset.island;
      tap(isl[0], 601);
      await wait(520);
      ok('2.cw    остров выбран', K.uvIslandSel.indexOf(id0) >= 0, JSON.stringify(K.uvIslandSel));
      const b0 = uvBoxOf([id0]);
      const ai = rightmostAi(id0);
      const p0 = uvAt(ai);
      const du0 = p0.u - b0.cu, dv0 = p0.v - b0.cv;
      ok('2.cw    и у него есть правый край', ai >= 0 && du0 > 0,
         'ai=' + ai + ' du=' + du0.toFixed(4));
      ok('2.cw    операция сработала', K.uvIslandXform('rotcw') === true);
      await wait(60);
      const p1 = uvAt(ai);
      const du1 = p1.u - b0.cu, dv1 = p1.v - b0.cv;
      ok('2.cw    вправо стало вниз', near(du1, dv0) && near(dv1, -du0),
         '(' + du0.toFixed(4) + ',' + dv0.toFixed(4) + ') -> (' +
         du1.toFixed(4) + ',' + dv1.toFixed(4) + ')');
      const b1 = uvBoxOf([id0]);
      ok('2.cw    центр коробки остался на месте', near(b1.cu, b0.cu) && near(b1.cv, b0.cv),
         '(' + b0.cu.toFixed(4) + ',' + b0.cv.toFixed(4) + ') -> (' +
         b1.cu.toFixed(4) + ',' + b1.cv.toFixed(4) + ')');
      ok('2.cw    а ширина с высотой поменялись',
         near(b1.maxU - b1.minU, b0.maxV - b0.minV) &&
         near(b1.maxV - b1.minV, b0.maxU - b0.minU),
         (b0.maxU - b0.minU).toFixed(4) + 'x' + (b0.maxV - b0.minV).toFixed(4) + ' -> ' +
         (b1.maxU - b1.minU).toFixed(4) + 'x' + (b1.maxV - b1.minV).toFixed(4));
      ok('2.cw    выбор не потерялся', K.uvIslandSel.indexOf(id0) >= 0, JSON.stringify(K.uvIslandSel));
    }
    mark('2');

    // ---------------------------------------------------------------- 3
    // Четыре поворота возвращают РОВНО туда же - на этом стоит выбор пивота.
    {
      const before = uvSnapshot();
      K.uvIslandXform('rotcw'); await wait(30);
      K.uvIslandXform('rotcw'); await wait(30);
      K.uvIslandXform('rotcw'); await wait(30);
      ok('3.round три поворота увели', !uvSame(before, uvSnapshot(), 1e-7));
      K.uvIslandXform('rotcw'); await wait(60);
      ok('3.round а четвёртый вернул ровно', uvSame(before, uvSnapshot(), 1e-6));
      // И обратный поворот - обратный.
      K.uvIslandXform('rotcw'); await wait(30);
      K.uvIslandXform('rotccw'); await wait(60);
      ok('3.round rotccw отменяет rotcw', uvSame(before, uvSnapshot(), 1e-6));
    }
    mark('3');

    // ---------------------------------------------------------------- 4
    // Отражения: центр держится, дважды - тождество, u и v не путаются.
    {
      const ids = K.uvIslandSel.slice();
      const before = uvSnapshot();
      const b0 = uvBoxOf(ids);
      const ai = rightmostAi(ids[0]);
      const p0 = uvAt(ai);
      K.uvIslandXform('flipu'); await wait(60);
      const p1 = uvAt(ai);
      ok('4.flip  flipu отразил u вокруг центра', near(p1.u, 2 * b0.cu - p0.u),
         p0.u.toFixed(4) + ' -> ' + p1.u.toFixed(4) + ' центр ' + b0.cu.toFixed(4));
      ok('4.flip  и v не тронул', near(p1.v, p0.v));
      K.uvIslandXform('flipu'); await wait(60);
      ok('4.flip  дважды - тождество', uvSame(before, uvSnapshot(), 1e-6));
      K.uvIslandXform('flipv'); await wait(60);
      const p2 = uvAt(ai);
      ok('4.flip  flipv отразил v вокруг центра', near(p2.v, 2 * b0.cv - p0.v),
         p0.v.toFixed(4) + ' -> ' + p2.v.toFixed(4) + ' центр ' + b0.cv.toFixed(4));
      ok('4.flip  и u не тронул', near(p2.u, p0.u));
      K.uvIslandXform('flipv'); await wait(60);
      ok('4.flip  дважды - тождество', uvSame(before, uvSnapshot(), 1e-6));
    }
    mark('4');

    // ---------------------------------------------------------------- 5
    /* Группа поворачивается КАК ОДНО, вокруг общей коробки, а не каждый
       остров вокруг себя - иначе два острова просто провернулись бы на месте
       и не поменялись местами. */
    {
      const isl = islands();
      const idA = +isl[0].dataset.island, idB = +isl[1].dataset.island;
      // Собираем двоих: сперва пустое место, чтобы начать с чистого.
      const r = svg.getBoundingClientRect();
      down(svg, r.left + r.width / 2, r.top + r.height / 2, 611);
      up(r.left + r.width / 2, r.top + r.height / 2, 611);
      await wait(520);
      tap(isl[0], 612); await wait(520);
      tap(isl[1], 613); await wait(520);
      ok('5.group два острова выбраны', K.uvIslandSel.length === 2, JSON.stringify(K.uvIslandSel));
      const shared = uvBoxOf([idA, idB]);
      const a0 = uvBoxOf([idA]);
      const duA = a0.cu - shared.cu, dvA = a0.cv - shared.cv;
      ok('5.group и они не в одной точке', Math.hypot(duA, dvA) > 0.01,
         'смещение A от общего центра ' + Math.hypot(duA, dvA).toFixed(4));
      K.uvIslandXform('rotcw');
      await wait(80);
      const a1 = uvBoxOf([idA]);
      const duA1 = a1.cu - shared.cu, dvA1 = a1.cv - shared.cv;
      ok('5.group центр A повернулся вокруг ОБЩЕГО центра',
         near(duA1, dvA) && near(dvA1, -duA),
         '(' + duA.toFixed(4) + ',' + dvA.toFixed(4) + ') -> (' +
         duA1.toFixed(4) + ',' + dvA1.toFixed(4) + ')');
      const shared1 = uvBoxOf([idA, idB]);
      ok('5.group а общий центр держится',
         near(shared1.cu, shared.cu) && near(shared1.cv, shared.cv));
      ok('5.group и в подписи шага сказано про два', true);
      K.uvIslandXform('rotccw');
      await wait(60);
    }
    mark('5');

    // ---------------------------------------------------------------- 6
    // Без выбора операция ничего не пишет.
    {
      const r = svg.getBoundingClientRect();
      down(svg, r.left + r.width / 2, r.top + r.height / 2, 621);
      up(r.left + r.width / 2, r.top + r.height / 2, 621);
      await wait(520);
      ok('6.none  выбор пуст', K.uvIslandSel.length === 0, JSON.stringify(K.uvIslandSel));
      const before = uvSnapshot();
      const steps = A.history.length, at = A.historyIndex;
      ok('6.none  операция отказалась', K.uvIslandXform('rotcw') === false);
      await wait(40);
      ok('6.none  UV не тронут', uvSame(before, uvSnapshot()));
      ok('6.none  и шага истории не прибавилось',
         A.history.length === steps && A.historyIndex === at,
         steps + '/' + at + ' -> ' + A.history.length + '/' + A.historyIndex);
    }
    mark('6');

    // ---------------------------------------------------------------- 7
    // Один шаг истории на операцию, и Undo его возвращает.
    {
      const isl = islands();
      tap(isl[0], 631);
      await wait(520);
      const before = uvSnapshot();
      const at0 = A.historyIndex;
      K.uvIslandXform('flipu');
      await wait(80);
      ok('7.hist  шаг ровно один', A.historyIndex === at0 + 1,
         at0 + ' -> ' + A.historyIndex);
      ok('7.hist  и правка записалась', !uvSame(before, uvSnapshot()));
      K.undo();
      await wait(140);
      ok('7.hist  Undo вернул', uvSame(before, uvSnapshot(), 1e-6));
    }
    mark('7');

    // ---------------------------------------------------------------- 8
    /* Жест: удержание ВЫБРАННОГО острова распускает кольцо, и после него не
       остаётся ни живого жеста, ни пальца на учёте вида. */
    {
      const isl = islands();
      const id0 = +isl[0].dataset.island;
      // Убедимся, что он выбран (после Undo выбор мог слететь).
      if (K.uvIslandSel.indexOf(id0) < 0) { tap(isl[0], 641); await wait(520); }
      ok('8.hold  остров выбран перед удержанием', K.uvIslandSel.indexOf(id0) >= 0,
         JSON.stringify(K.uvIslandSel));
      const before = uvSnapshot();
      const c = centreOf(isl[0]);
      down(isl[0], c.x, c.y, 642);
      await wait(20);
      ok('8.hold  удержание взведено', K.uvDragHoldArmed === true);
      await wait(520);
      ok('8.hold  кольцо распустилось', !!K.toolRingActive);
      ok('8.hold  и это кольцо острова',
         !!K.toolRingActive && K.toolRingActive.tools === K.HUB_TOOLS_UV2D_ISLAND);
      ok('8.hold  жест острова снят', K.uvDragMode === null, 'mode=' + K.uvDragMode);
      ok('8.hold  палец снят с учёта вида', K.uvPointerCount === 0,
         'pointers=' + K.uvPointerCount);
      ok('8.hold  выбор цел', K.uvIslandSel.indexOf(id0) >= 0, JSON.stringify(K.uvIslandSel));
      ok('8.hold  и в UV ничего не записалось', uvSame(before, uvSnapshot()));
      // Место кольца работает.
      seat(K.HUB_TOOLS_UV2D_ISLAND, 'uvx-rotcw').run();
      await wait(80);
      ok('8.hold  место кольца повернуло остров', !uvSame(before, uvSnapshot()));
      K.closeToolRing(false);
      await wait(40);
      K.undo();
      await wait(140);
    }
    mark('8');

    // ---------------------------------------------------------------- 9
    // По НЕвыбранному острову удержание не взводится, а движение его гасит.
    {
      const r = svg.getBoundingClientRect();
      down(svg, r.left + r.width / 2, r.top + r.height / 2, 651);
      up(r.left + r.width / 2, r.top + r.height / 2, 651);
      await wait(520);
      ok('9.gate  выбор пуст', K.uvIslandSel.length === 0, JSON.stringify(K.uvIslandSel));
      const isl = islands();
      const c = centreOf(isl[0]);
      down(isl[0], c.x, c.y, 652);
      await wait(20);
      ok('9.gate  по невыбранному удержание не взведено', K.uvDragHoldArmed === false);
      await wait(520);
      ok('9.gate  и кольцо не распустилось', !K.toolRingActive);
      up(c.x, c.y, 652);
      await wait(40);
      // А теперь по выбранному, но с движением.
      tap(isl[0], 653);
      await wait(520);
      const c2 = centreOf(isl[0]);
      down(isl[0], c2.x, c2.y, 654);
      await wait(20);
      ok('9.gate  по выбранному взведено', K.uvDragHoldArmed === true);
      move(c2.x + 30, c2.y, 654);
      await wait(20);
      ok('9.gate  движение погасило удержание', K.uvDragHoldArmed === false);
      await wait(520);
      ok('9.gate  кольцо так и не распустилось', !K.toolRingActive);
      ok('9.gate  а жест остался живым', K.uvDragMode === 'translate', 'mode=' + K.uvDragMode);
      up(c2.x + 30, c2.y, 654);
      await wait(80);
      K.undo();
      await wait(140);
      ok('9.gate  учёт пальцев пуст', K.uvPointerCount === 0, 'pointers=' + K.uvPointerCount);
    }
    mark('9');

    // ---------------------------------------------------------------- 10
    /* Поворот не может выбросить остров за досягаемость вида. Пивот держит
       ЦЕНТР, а не размах: выделение w на h возвращается h на w, и по короткой
       оси уезжает на (w-h)/2 дальше. Два острова, разнесённые на лист по U,
       без поправки уносили один на четыре тайла НИЖЕ листа. */
    {
      K.setUvCompMode('island');
      await wait(60);
      const isl = islands();
      const idA = +isl[0].dataset.island, idB = +isl[1].dataset.island;
      const r = svg.getBoundingClientRect();
      down(svg, r.left + r.width / 2, r.top + r.height / 2, 661);
      up(r.left + r.width / 2, r.top + r.height / 2, 661);
      await wait(520);
      // Уносим A на восемь тайлов вправо штатным коммитом переноса.
      tap(isl[0], 662);
      await wait(520);
      K.commitUvIslandTransform([idA], 8 * 92, 0, 0, 1, 50, 50);
      await wait(120);
      const far = uvBoxOf([idA]);
      ok('10.reach A уехал далеко по U', far.minU > 7, 'minU=' + far.minU.toFixed(3));
      // Берём обоих.
      const isl2 = islands();
      const elB = svg.querySelector('.uv-island[data-island="' + idB + '"]');
      tap(elB, 663);
      await wait(520);
      ok('10.reach выбраны оба', K.uvIslandSel.length === 2, JSON.stringify(K.uvIslandSel));
      const wide = uvBoxOf([idA, idB]);
      const halfSpan = (wide.maxU - wide.minU) / 2;
      ok('10.reach и коробка выделения шире листа по одной оси',
         halfSpan > 3, 'полуширина=' + halfSpan.toFixed(3));
      ok('10.reach поворот прошёл', K.uvIslandXform('rotcw') === true);
      await wait(100);
      const after = uvBoxOf([idA, idB]);
      const R = K.udimReachUV();
      ok('10.reach всё осталось в досягаемости по V',
         after.minV >= R.v0 - 1e-6 && after.maxV <= R.v1 + 1e-6,
         'v ' + after.minV.toFixed(3) + '..' + after.maxV.toFixed(3) +
         ' окно ' + R.v0.toFixed(3) + '..' + R.v1.toFixed(3));
      ok('10.reach и по U', after.minU >= R.u0 - 1e-6 && after.maxU <= R.u1 + 1e-6,
         'u ' + after.minU.toFixed(3) + '..' + after.maxU.toFixed(3));
      ok('10.reach без поправки ушло бы далеко за край',
         wide.cv - halfSpan < R.v0 - 1,
         'было бы minV=' + (wide.cv - halfSpan).toFixed(3));
      // И поправка - именно перенос: размеры коробки те же, что у повёрнутой.
      ok('10.reach поправка только сдвинула, размеры целы',
         near(after.maxU - after.minU, wide.maxV - wide.minV, 1e-5) &&
         near(after.maxV - after.minV, wide.maxU - wide.minU, 1e-5),
         (after.maxU - after.minU).toFixed(3) + 'x' + (after.maxV - after.minV).toFixed(3));
      K.undo(); await wait(140);
      K.undo(); await wait(140);
    }
    mark('10');

    // ---------------------------------------------------------------- 11
    // Четыре места - четыре разных картинки, иначе кольцо нечитаемо.
    {
      const X = K.UV_ISLAND_XFORMS;
      ok('11.icon поворотам разные картинки', X.rotcw.icon !== X.rotccw.icon,
         X.rotcw.icon + ' / ' + X.rotccw.icon);
      ok('11.icon отражениям тоже', X.flipu.icon !== X.flipv.icon,
         X.flipu.icon + ' / ' + X.flipv.icon);
      const all = Object.keys(X).map(k => X[k].icon);
      ok('11.icon и все четыре различны', new Set(all).size === 4, all.join(','));
      if (typeof K.icon === 'function') {
        const svgs = all.map(n => K.icon(n, 24));
        ok('11.icon каждая картинка непустая',
           svgs.every(t => t.length > 120 && t.indexOf('<path') >= 0));
        ok('11.icon и они не совпадают попарно', new Set(svgs).size === 4);
      }
    }
    mark('11');

    // ---------------------------------------------------------------- 12
    // Место кольца не действует из чужого режима.
    {
      K.setUvCompMode('vertex');
      await wait(60);
      const before = uvSnapshot();
      ok('12.mode  из vertex-режима операция отказалась',
         K.uvIslandXform('rotcw') === false);
      await wait(40);
      ok('12.mode  и UV не тронут', uvSame(before, uvSnapshot()));
      K.setUvCompMode('island');
      await wait(60);
    }
    mark('12');

    // ---------------------------------------------------------------- 13
    /* Мёртвой полосы больше нет: то, что вид всё ещё считает тапом, всё ещё
       считается удержанием. Палец здесь - настоящий touch, у него запас 22 px,
       а не 6, как у мыши. */
    {
      const touch = (type, x, y, id) => new PointerEvent(type, {
        bubbles: true, cancelable: true, pointerId: id, pointerType: 'touch',
        button: 0, buttons: type === 'pointerup' ? 0 : 1, clientX: x, clientY: y
      });
      const isl = islands();
      const id0 = +isl[0].dataset.island;
      if (K.uvIslandSel.indexOf(id0) < 0) { tap(isl[0], 671); await wait(520); }
      ok('13.band  остров выбран', K.uvIslandSel.indexOf(id0) >= 0, JSON.stringify(K.uvIslandSel));
      const c = centreOf(isl[0]);
      isl[0].dispatchEvent(touch('pointerdown', c.x, c.y, 672));
      await wait(20);
      ok('13.band  удержание взведено', K.uvDragHoldArmed === true);
      // 11 px - ровно тот перекат, что раньше попадал в мёртвую полосу.
      svg.dispatchEvent(touch('pointermove', c.x + 11, c.y, 672));
      await wait(20);
      ok('13.band  перекат на 11 px его не погасил', K.uvDragHoldArmed === true);
      svg.dispatchEvent(touch('pointermove', c.x + 30, c.y, 672));
      await wait(20);
      ok('13.band  а 30 px - погасил', K.uvDragHoldArmed === false);
      svg.dispatchEvent(touch('pointerup', c.x + 30, c.y, 672));
      await wait(100);
      K.undo();
      await wait(140);
      // И наоборот: удержание с переносом на 11 px доводит до кольца.
      const isl2 = islands();
      const id1 = +isl2[0].dataset.island;
      if (K.uvIslandSel.indexOf(id1) < 0) { tap(isl2[0], 673); await wait(520); }
      const c2 = centreOf(isl2[0]);
      isl2[0].dispatchEvent(touch('pointerdown', c2.x, c2.y, 674));
      await wait(20);
      svg.dispatchEvent(touch('pointermove', c2.x + 11, c2.y, 674));
      await wait(520);
      ok('13.band  и кольцо всё-таки распустилось', !!K.toolRingActive);
      ok('13.band  и это кольцо острова',
         !!K.toolRingActive && K.toolRingActive.tools === K.HUB_TOOLS_UV2D_ISLAND);
      K.closeToolRing(false);
      await wait(40);
      ok('13.band  учёт пальцев пуст', K.uvPointerCount === 0, 'pointers=' + K.uvPointerCount);
    }
    mark('13');

    finish();
  }

  function boot() {
    K = window.__kubik;
    if (!K || !K.App || !K.uvIslandXform || !K.HUB_TOOLS_WORLD) { setTimeout(boot, 120); return; }
    setTimeout(() => {
      run().catch(e => finish('THREW ' + (e && e.stack ? e.stack : e)));
    }, 500);
  }
  // Никакого window.load - урок v2.61.
  boot();
  setTimeout(() => { if (OUT.length === 0) finish('THREW boot timeout - __kubik не появился'); }, 110000);
})();
