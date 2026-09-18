/* _uv55chk - выделение островов и Face-режим в 2D-развёртке.

   Всё через настоящие указательные события по настоящим элементам: тап -
   это pointerdown+pointerup на месте, драг - с движением дальше порога.
   Ни одна проверка не зовёт коммит напрямую. */
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
  let K = null;
  const wait = ms => new Promise(r => setTimeout(r, ms));
  const seat = (arr, key) => arr.find(t => t.key === key);
  let svg = null;

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
  function tap(el, id) {
    const c = centreOf(el);
    el.dispatchEvent(ev('pointerdown', c.x, c.y, id));
    svg.dispatchEvent(ev('pointerup', c.x, c.y, id));
  }
  function drag(el, dxPx, dyPx, id) {
    const c = centreOf(el);
    el.dispatchEvent(ev('pointerdown', c.x, c.y, id));
    svg.dispatchEvent(ev('pointermove', c.x + dxPx * 0.5, c.y + dyPx * 0.5, id));
    svg.dispatchEvent(ev('pointermove', c.x + dxPx, c.y + dyPx, id));
    svg.dispatchEvent(ev('pointerup', c.x + dxPx, c.y + dyPx, id));
  }
  // Средний u островов - чтобы увидеть, что двинулось, а что нет.
  function islandMeanU(obj, id) {
    const uv = obj.mesh.geometry.attributes.uv;
    const { attrIsland } = K.islandVertexMap(obj);
    let sum = 0, n = 0;
    for (let ai = 0; ai < attrIsland.length; ai++) {
      if (attrIsland[ai] !== id) continue;
      sum += uv.getX(ai); n++;
    }
    return n ? sum / n : NaN;
  }

  async function run() {
    const A = K.App, T = K.THREE;
    let o = A.objects[0];
    if (!o) { K.createPrimitiveObject('cube', {}, 'Cube', new T.Vector3(0, 0, 0)); o = A.objects[0]; }
    A.activeObjectId = o.id; A.selectedObjectIds = new Set([o.id]);
    K.setMode('edge'); K.ensureHelpers(o);
    const topo = o.mesh.userData.topo;
    A.selectedElements = new Set(topo.edges.map((e, i) => i));
    K.markSeamSelection(true);          // каждая грань - свой остров
    A.selectedElements = new Set();
    K.setMode('uv');
    K.unwrapSelection();
    K.refreshUI();
    seat(K.HUB_TOOLS_WORLD, 'addgeo').run();   // открыть 2D-вид
    await wait(80);
    svg = document.getElementById('uvViewSvg');
    ok('0.setup вид открыт, острова есть', K.uvViewOpen && svg.querySelectorAll('.uv-island').length >= 2,
       'islands=' + svg.querySelectorAll('.uv-island').length);
    mark('0');

    // 1. Тап по острову выбирает его, повторный - снимает.
    const isl = svg.querySelectorAll('.uv-island');
    tap(isl[0], 11);
    await wait(20);
    ok('1.tap   тап выбрал остров', K.uvIslandSel.length === 1, JSON.stringify(K.uvIslandSel));
    ok('1.tap   и это видно в классе', isl[0].classList.contains('selected'));
    tap(isl[0], 12);
    await wait(20);
    ok('1.tap   повторный тап снял выбор', K.uvIslandSel.length === 0, JSON.stringify(K.uvIslandSel));
    mark('1');

    // 2. Два острова, и драг двигает ОБА.
    tap(isl[0], 13); tap(isl[1], 14);
    await wait(20);
    ok('2.multi два острова выбраны', K.uvIslandSel.length === 2, JSON.stringify(K.uvIslandSel));
    const idA = +isl[0].dataset.island, idB = +isl[1].dataset.island;
    const beforeA = islandMeanU(o, idA), beforeB = islandMeanU(o, idB);
    const steps0 = K.App.history ? K.App.history.length : -1;
    drag(svg.querySelector('.uv-island[data-island="' + idA + '"]'), 60, 0, 15);
    await wait(60);
    const afterA = islandMeanU(o, idA), afterB = islandMeanU(o, idB);
    ok('2.multi схваченный остров поехал', Math.abs(afterA - beforeA) > 0.01,
       beforeA.toFixed(3) + ' -> ' + afterA.toFixed(3));
    ok('2.multi и второй выбранный тоже', Math.abs(afterB - beforeB) > 0.01,
       beforeB.toFixed(3) + ' -> ' + afterB.toFixed(3));
    ok('2.multi на столько же', Math.abs((afterA - beforeA) - (afterB - beforeB)) < 1e-6,
       (afterA - beforeA).toFixed(4) + ' vs ' + (afterB - beforeB).toFixed(4));
    mark('2');

    // 3. Тап по пустому месту отпускает группу.
    const sq = svg.querySelector('.uv-square');
    const cSq = { x: svg.getBoundingClientRect().left + 4, y: svg.getBoundingClientRect().top + 4 };
    svg.dispatchEvent(ev('pointerdown', cSq.x, cSq.y, 16));
    svg.dispatchEvent(ev('pointerup', cSq.x, cSq.y, 16));
    await wait(20);
    ok('3.empty тап по пустому снял выбор островов', K.uvIslandSel.length === 0,
       JSON.stringify(K.uvIslandSel) + ' sq=' + !!sq);
    mark('3');

    // 3b. Пан по пустому месту НЕ должен стирать собранную группу.
    //     Элементы перезапрашиваются: после драга выше renderUvView
    //     построил новые, а старый NodeList указывает в никуда - тап по
    //     оторванному элементу не всплывёт, и проверка пройдёт впустую.
    const isl2 = svg.querySelectorAll('.uv-island');
    tap(isl2[0], 17); tap(isl2[1], 18);
    await wait(20);
    const had = K.uvIslandSel.length;
    ok('3b.pan  группа собрана перед проверкой', had === 2, 'had=' + had);
    const r = svg.getBoundingClientRect();
    const ex = r.left + 6, ey = r.top + 6;
    svg.dispatchEvent(ev('pointerdown', ex, ey, 19));
    svg.dispatchEvent(ev('pointermove', ex + 40, ey + 30, 19));
    svg.dispatchEvent(ev('pointerup', ex + 40, ey + 30, 19));
    await wait(20);
    ok('3b.pan  пан по пустому не снял выбор', K.uvIslandSel.length === had,
       had + ' -> ' + K.uvIslandSel.length);
    svg.dispatchEvent(ev('pointerdown', ex, ey, 20));
    svg.dispatchEvent(ev('pointerup', ex, ey, 20));
    await wait(20);
    ok('3b.pan  а тап по тому же месту снял', K.uvIslandSel.length === 0);
    mark('3b');

    // 4. Face-режим: четвёртый вид есть, и он рисует грани.
    K.setUvCompMode('face');
    await wait(30);
    ok('4.face  режим face есть в списке', K.HUB_TOOLS_UV2D_MODE.some(t => t.key === 'uvcomp-face'));
    const faces = svg.querySelectorAll('.uv-face');
    ok('4.face  грани нарисованы', faces.length >= 2, 'faces=' + faces.length);
    tap(faces[0], 21);
    await wait(20);
    ok('4.face  тап выбрал грань', K.uvFaceSel.length === 1, JSON.stringify(K.uvFaceSel));
    mark('4');

    // 5. Драг грани двигает ИМЕННО её вершины, и пишет один шаг истории.
    const uvBefore = [];
    const uvAttr = o.mesh.geometry.attributes.uv;
    for (let i = 0; i < uvAttr.count; i++) uvBefore.push(uvAttr.getX(i), uvAttr.getY(i));
    drag(svg.querySelector('.uv-face'), 0, 50, 22);
    await wait(60);
    const uvAfter = o.mesh.geometry.attributes.uv;
    let movedN = 0;
    for (let i = 0; i < uvAfter.count && i * 2 + 1 < uvBefore.length; i++) {
      if (Math.abs(uvAfter.getX(i) - uvBefore[i * 2]) > 1e-6 ||
          Math.abs(uvAfter.getY(i) - uvBefore[i * 2 + 1]) > 1e-6) movedN++;
    }
    ok('5.face  часть вершин поехала, но не все', movedN > 0 && movedN < uvAfter.count,
       movedN + ' из ' + uvAfter.count);
    mark('5');

    // 5b. Отменённый тап по грани не оставляет подсветки-призрака.
    // Начинаем с чистого листа: после пункта 5 одна грань законно выбрана.
    K.setUvCompMode('island'); K.setUvCompMode('face');
    await wait(30);
    const f2 = svg.querySelectorAll('.uv-face');
    const fgId = +f2[1].dataset.fg;
    const c2 = centreOf(f2[1]);
    f2[1].dispatchEvent(ev('pointerdown', c2.x, c2.y, 23));
    svg.dispatchEvent(new PointerEvent('pointercancel', { bubbles: true, pointerId: 23, pointerType: 'mouse' }));
    await wait(20);
    ok('5b.cancel отменённый тап не оставил выбора',
       K.uvFaceSel.indexOf(fgId) < 0, JSON.stringify(K.uvFaceSel) + ' fg=' + fgId);
    ok('5b.cancel и не оставил подсветки',
       !svg.querySelector('.uv-face.selected[data-fg="' + fgId + '"]'),
       'lit=' + svg.querySelectorAll('.uv-face.selected').length);
    mark('5b');

    // 6. Смена вида компонента сбрасывает чужие выборы.
    K.setUvCompMode('island');
    await wait(20);
    ok('6.reset смена режима очистила выбор граней', K.uvFaceSel.length === 0 && K.uvIslandSel.length === 0);
    mark('6');

    // ---------------------------------------------------------------- 9
    // Размер точки (v2.60): видимая маленькая, хит-таргет прежний, и оба
    // держат постоянный размер на экране при зуме.
    {
      K.setUvCompMode('vertex');
      await wait(60);
      const dot = svg.querySelector('.uv-vertex');
      ok('9.dot    точки в вершинном режиме есть', !!dot);
      if (dot) {
        const rAttr = parseFloat(dot.getAttribute('r'));
        ok('9.dot    видимая точка много меньше прежних 3.2',
           rAttr > 0 && rAttr < 1.2, 'r=' + rAttr);
        const cs = getComputedStyle(dot);
        const sw = parseFloat(cs.strokeWidth);
        ok('9.dot    но прозрачная обводка возвращает прежний охват',
           rAttr + sw / 2 > 2.8, 'r=' + rAttr + ' stroke=' + sw +
           ' охват=' + (rAttr + sw / 2).toFixed(2));
        ok('9.dot    и она действительно ловит указатель',
           cs.pointerEvents === 'all', 'pointer-events=' + cs.pointerEvents);
        // Зум вдвое - радиус в единицах SVG обязан уполовиниться, иначе на
        // экране точка вырастет.
        const before = K.uvDotR();
        K.zoomUvViewBoxAt(0.5, 50, 50);
        await wait(20);
        const after = K.uvDotR();
        ok('9.dot    при зуме радиус следует за viewBox',
           Math.abs(after - before * 0.5) < 0.02,
           'было ' + before + ' стало ' + after);
        ok('9.dot    и переменная на svg обновилась',
           Math.abs(parseFloat(svg.style.getPropertyValue('--uv-dot')) - after) < 1e-6,
           'var=' + svg.style.getPropertyValue('--uv-dot'));
        K.resetUvViewBox();
        await wait(20);
      }
    }
    mark('9');

    finish();
  }

  function boot() {
    const t0 = Date.now();
    (function w() {
      if (window.__kubik && window.__kubik.App && window.__kubik.App.objects) {
        K = window.__kubik;
        run().catch(e => finish('THREW: ' + (e && e.stack || e)));
        return;
      }
      if (Date.now() - t0 > 20000) {
        // 'THREW' первым словом не для красоты: раннер считает провалы по началу
        // строки, и без этого незагрузившаяся проба уходила в PASS.
        finish('THREW: __kubik не появился за 20с');
        return;
      }
      setTimeout(w, 100);
    })();
  }
  if (document.readyState === 'complete') setTimeout(boot, 500);
  else window.addEventListener('load', () => setTimeout(boot, 500));
})();
