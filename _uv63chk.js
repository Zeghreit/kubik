/* _uv63chk - 2D-вид перестал быть коробкой.

   Проверяется не «нарисована ли сетка», а то, что из неё следует: что за
   пределы тайла 1001 теперь можно УЙТИ - и видом, и перетаскиванием, - и
   что уйдя, оттуда можно вернуться. */
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
  function tap(el, id) {
    const c = centreOf(el);
    down(el, c.x, c.y, id); up(c.x, c.y, id);
  }
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
  const box = () => K.uvViewBoxNow;

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
    ok('0.setup версия не ниже 2.63',
       parseFloat((((document.querySelector('.brand') || {}).textContent || '').match(/[\d.]+/) || [0])[0]) >= 2.63,
       (document.querySelector('.brand') || {}).textContent);
    mark('0');

    // ---------------------------------------------------------------- 1
    // Сама разметка: сетка есть, рамки 0..1 больше нет.
    {
      ok('1.sheet ограничивающего квадрата больше нет',
         svg.querySelectorAll('.uv-square').length === 0);
      ok('1.sheet сетка нарисована', svg.querySelectorAll('.uv-udim').length === 2,
         'paths=' + svg.querySelectorAll('.uv-udim').length);
      ok('1.sheet есть выделенные оси u=0/v=0',
         svg.querySelectorAll('.uv-udim-axis').length === 1);
      const nums = svg.querySelectorAll('.uv-udim-num');
      ok('1.sheet сто тайлов подписаны', nums.length === 100, 'nums=' + nums.length);
      ok('1.sheet первый - 1001', nums[0].textContent === '1001', nums[0].textContent);
      ok('1.sheet последний - 1100', nums[99].textContent === '1100', nums[99].textContent);
      // 1001 стоит в левом нижнем углу тайла 0..1: x = PAD, y = 100 - PAD.
      ok('1.sheet 1001 стоит в своём углу',
         Math.abs(parseFloat(nums[0].getAttribute('x')) - 4) < 0.01 &&
         Math.abs(parseFloat(nums[0].getAttribute('y')) - 96) < 0.01,
         nums[0].getAttribute('x') + ',' + nums[0].getAttribute('y'));
      // 1002 - соседний тайл справа, ровно на ширину тайла дальше.
      ok('1.sheet 1002 ровно на тайл правее',
         Math.abs(parseFloat(nums[1].getAttribute('x')) - (4 + 92)) < 0.01,
         nums[1].getAttribute('x'));
      // 1011 - тайл над 1001, то есть ВЫШЕ по экрану (SVG Y вниз).
      ok('1.sheet 1011 ровно на тайл выше',
         Math.abs(parseFloat(nums[10].getAttribute('y')) - (96 - 92)) < 0.01,
         nums[10].getAttribute('y'));
      ok('1.sheet и ничего из этого не ловит палец',
         getComputedStyle(svg.querySelector('.uv-udim')).pointerEvents === 'none' &&
         getComputedStyle(nums[0]).pointerEvents === 'none');
    }
    mark('1');

    // ---------------------------------------------------------------- 2
    // Номера держат размер на экране, как точки с v2.60.
    {
      K.resetUvViewBox();
      await wait(20);
      const n1 = parseFloat(svg.style.getPropertyValue('--uv-num'));
      ok('2.num   размер номера задан', n1 > 0, '--uv-num=' + n1);
      K.zoomUvViewBoxAt(0.5, 50, 50);
      await wait(20);
      const n2 = parseFloat(svg.style.getPropertyValue('--uv-num'));
      // Допуск, а не равенство: значение пишется округлённым до сотых.
      ok('2.num   при зуме вдвое он вдвое меньше в юнитах',
         Math.abs(n2 - n1 / 2) < 0.011, n1 + ' -> ' + n2);
    }
    mark('2');

    // ---------------------------------------------------------------- 3
    /* Вид дотягивается до всего листа: и отъезжает, чтобы увидеть все сто
       тайлов, и панится до дальнего угла. Раньше зум-аут упирался в кадр по
       умолчанию, а пан - в квадрат 0..100, то есть в один тайл. */
    {
      const b = K.udimBounds();
      ok('3.reach лист - десять на десять тайлов',
         K.UDIM_COLS === 10 && K.UDIM_ROWS === 10);
      K.resetUvViewBox();
      K.zoomUvViewBoxAt(50, 50, 50);   // проси больше, чем дают
      await wait(20);
      const z = box();
      /* ПРЕДЕЛ ТЕПЕРЬ НА УЗКОЙ СТОРОНЕ (v2.69): UV_ZOOM_MAX держит меньшую из
         двух сторон, иначе широкий экран упирался бы в h=562 при листе в 920
         и переставал вмещать лист - ровно то, ради чего это число выбрано.
         Две проверки ниже, про лист в кадре по X и по Y, и есть смысл этой. */
      ok('3.reach зум-аут дошёл до предела', Math.abs(z.w - K.uvZoomW().max) < 1e-6,
         'w=' + z.w + ' предел ' + K.uvZoomW().max);
      ok('3.reach и в кадр влез весь лист по X', z.x <= b.x0 && z.x + z.w >= b.x1,
         'box x ' + z.x.toFixed(1) + '..' + (z.x + z.w).toFixed(1) +
         ' лист ' + b.x0.toFixed(1) + '..' + b.x1.toFixed(1));
      ok('3.reach и по Y', z.y <= b.y0 && z.y + z.h >= b.y1,
         'box y ' + z.y.toFixed(1) + '..' + (z.y + z.h).toFixed(1) +
         ' лист ' + b.y0.toFixed(1) + '..' + b.y1.toFixed(1));
    }
    mark('3');

    // ---------------------------------------------------------------- 4
    // Пан доходит до тайла 1100 - дальнего верхнего правого угла листа.
    {
      K.resetUvViewBox();
      await wait(20);
      const b = K.udimBounds();
      /* Тайл 1001 целиком - а ширина кадра, в которой он целиком помещается,
         с v2.69 зависит от формы экрана: 100 на высоком, 100/aspect на широком. */
      const span1001 = (b.x1 - b.x0) / K.UDIM_COLS;
      const holds1001 = () => {
        const z = box();
        return z.x <= b.x0 + 1e-6 && z.x + z.w >= b.x0 + span1001 - 1e-6 &&
               z.y <= b.y1 - span1001 + 1e-6 && z.y + z.h >= b.y1 - 1e-6;
      };
      ok('4.pan   кадр по умолчанию - тайл 1001', holds1001(),
         'w=' + box().w + ' x=' + box().x.toFixed(1) + ' y=' + box().y.toFixed(1));
      /* Уезжаем в дальний верхний правый угол листа - тайл 1100 - приближаясь
         к его точке: якорь зума и есть то, что остаётся под пальцем. */
      K.zoomUvViewBoxAt(0.1, b.x1, b.y0);
      await wait(20);
      const p = box();
      ok('4.pan   вид ушёл далеко вправо от тайла 1001', p.x > 100,
         'x=' + p.x.toFixed(1));
      ok('4.pan   но не дальше листа с полями',
         p.x + p.w <= b.x1 + 20 + 1e-6 && p.y >= b.y0 - 20 - 1e-6,
         'x=' + p.x.toFixed(1) + '..' + (p.x + p.w).toFixed(1) +
         ' y=' + p.y.toFixed(1));
      // И в этом кадре виден номер дальнего тайла.
      const seen = Array.from(svg.querySelectorAll('.uv-udim-num')).filter(t => {
        const x = parseFloat(t.getAttribute('x')), y = parseFloat(t.getAttribute('y'));
        return x >= p.x && x <= p.x + p.w && y >= p.y && y <= p.y + p.h;
      }).map(t => t.textContent);
      ok('4.pan   и в кадре виден тайл 1100', seen.indexOf('1100') >= 0,
         'видно: ' + seen.join(','));
      K.resetUvViewBox();
      await wait(20);
      ok('4.pan   и сброс возвращает на 1001', holds1001(),
         'x=' + box().x + ' w=' + box().w);
    }
    mark('4');

    // ---------------------------------------------------------------- 5
    /* ГЛАВНОЕ: остров можно утащить за пределы тайла 1001. Раньше кламп
       держал его внутри карточки, то есть внутри одного тайла. */
    {
      K.resetUvViewBox();
      K.zoomUvViewBoxAt(4, 50, 50);   // отъезжаем, чтобы палец прошёл больше UV
      await wait(20);
      const isl = islands();
      const id0 = +isl[0].dataset.island;
      const obj = A.objects.find(x => x.id === A.activeObjectId);
      const u0 = islandMeanU(obj, id0);
      ok('5.drag  остров начинает внутри тайла 1001', u0 > 0 && u0 < 1, 'u=' + u0.toFixed(3));
      const c = centreOf(isl[0]);
      down(isl[0], c.x, c.y, 401);
      move(c.x + 150, c.y, 401);
      move(c.x + 400, c.y, 401);
      up(c.x + 400, c.y, 401);
      await wait(100);
      const obj2 = A.objects.find(x => x.id === A.activeObjectId);
      const u1 = islandMeanU(obj2, id0);
      ok('5.drag  и уехал за его правый край', u1 > 1,
         'u ' + u0.toFixed(3) + ' -> ' + u1.toFixed(3));
      // И вернулся - то есть уехавшее не потеряно.
      K.undo();
      await wait(120);
      const obj3 = A.objects.find(x => x.id === A.activeObjectId);
      ok('5.drag  Undo вернул его назад',
         Math.abs(islandMeanU(obj3, id0) - u0) < 1e-6,
         'u=' + islandMeanU(obj3, id0).toFixed(3));
    }
    mark('5');

    // ---------------------------------------------------------------- 6
    // Вершину - тоже: у неё был свой кламп, на тех же основаниях.
    {
      K.setUvCompMode('vertex');
      await wait(60);
      K.resetUvViewBox();
      K.zoomUvViewBoxAt(4, 50, 50);
      await wait(20);
      const d0 = svg.querySelectorAll('.uv-vertex')[0];
      const ai = +d0.dataset.ai;
      const obj = A.objects.find(x => x.id === A.activeObjectId);
      const before = obj.mesh.geometry.attributes.uv.getX(ai);
      const c = centreOf(d0);
      down(d0, c.x, c.y, 411);
      move(c.x + 150, c.y, 411);
      move(c.x + 400, c.y, 411);
      up(c.x + 400, c.y, 411);
      await wait(100);
      const obj2 = A.objects.find(x => x.id === A.activeObjectId);
      const after = obj2.mesh.geometry.attributes.uv.getX(ai);
      ok('6.vert  вершина ушла за край тайла', after > 1,
         'u ' + before.toFixed(3) + ' -> ' + after.toFixed(3));
      K.undo();
      await wait(120);
      K.setUvCompMode('island');
      await wait(60);
    }
    mark('6');

    // ---------------------------------------------------------------- 7
    /* Свобода перетаскивания кончается там же, где кончается досягаемость
       вида. Первый черновик снял клампы совсем - и одним махом на широком
       зуме остров улетал на десятки тайлов за лист, куда вид не доезжает:
       ни увидеть, ни ткнуть, только Undo, и только пока следующая правка не
       легла сверху. Теперь предел - ВЕСЬ лист с полями, а не один тайл. */
    {
      K.setUvCompMode('island');
      await wait(60);
      K.resetUvViewBox();
      K.zoomUvViewBoxAt(50, 50, 50);   // максимальный отъезд: 1 px = много UV
      await wait(20);
      const R = K.udimBounds();
      const isl = islands();
      const id0 = +isl[0].dataset.island;
      const obj = A.objects.find(x => x.id === A.activeObjectId);
      const u0 = islandMeanU(obj, id0);
      const c = centreOf(isl[0]);
      // Мах на пол-карточки влево - без клампа это ушло бы за -5 по u.
      down(isl[0], c.x, c.y, 421);
      move(c.x - 200, c.y, 421);
      move(c.x - 600, c.y, 421);
      up(c.x - 600, c.y, 421);
      await wait(100);
      const obj2 = A.objects.find(x => x.id === A.activeObjectId);
      const u1 = islandMeanU(obj2, id0);
      ok('7.reach остров всё-таки поехал влево', u1 < u0,
         'u ' + u0.toFixed(3) + ' -> ' + u1.toFixed(3));
      // Досягаемый диапазон по u: (x - PAD) / span для x от x0-20 до x1+20.
      const uMin = ((R.x0 - 20) - 4) / 92, uMax = ((R.x1 + 20) - 4) / 92;
      ok('7.reach но остался в досягаемости вида', u1 >= uMin && u1 <= uMax,
         'u=' + u1.toFixed(3) + ' окно ' + uMin.toFixed(3) + '..' + uMax.toFixed(3));
      // И его всё ещё можно найти и ткнуть.
      const still = svg.querySelector('.uv-island[data-island="' + id0 + '"]');
      ok('7.reach и он по-прежнему на месте в разметке', !!still);
      if (still) {
        const bb = still.getBBox();
        ok('7.reach а его коробка - внутри досягаемого окна',
           bb.x >= R.x0 - 20 - 1e-6 && bb.x + bb.width <= R.x1 + 20 + 1e-6,
           'x ' + bb.x.toFixed(1) + '..' + (bb.x + bb.width).toFixed(1));
        /* Тап по нему ПЕРЕКЛЮЧАЕТ выбор - это и значит, что элемент живой и
           достижим. Именно переключает: перетаскивание было настоящим
           жестом, так что провизорная добавка осталась и остров уже выбран. */
        const selBefore = K.uvIslandSel.indexOf(id0) >= 0;
        tap(still, 422);
        await wait(30);
        ok('7.reach и тап по нему переключает выбор',
           (K.uvIslandSel.indexOf(id0) >= 0) !== selBefore,
           'было ' + selBefore + ', стало ' + JSON.stringify(K.uvIslandSel));
        tap(still, 423);
        await wait(30);
      }
      K.undo();
      await wait(120);
      K.resetUvViewBox();
      await wait(20);
    }
    mark('7');

    // ---------------------------------------------------------------- 8
    /* Номера тайлов меряются В ПИКСЕЛЯХ ЭКРАНА, а не в сотых долях кадра:
       сотая доля кадра - это всегда сотая доля КАРТОЧКИ, то есть 3.9 px на
       телефоне 390 px, каким бы ни был зум. */
    {
      const cardPx = svg.getBoundingClientRect().width;
      ok('8.size  карточка измерена', cardPx > 0, 'cardPx=' + cardPx.toFixed(0));
      const px = () => parseFloat(svg.style.getPropertyValue('--uv-num')) * cardPx / box().w;
      K.resetUvViewBox();
      await wait(20);
      const p1 = px();
      ok('8.size  номер около 11 px на экране', Math.abs(p1 - 11) < 0.5,
         'px=' + p1.toFixed(2));
      K.zoomUvViewBoxAt(0.25, 50, 50);
      await wait(20);
      const p2 = px();
      ok('8.size  и при зуме вчетверо он того же размера', Math.abs(p2 - p1) < 0.5,
         'px=' + p2.toFixed(2));
      ok('8.size  при обычном кадре номера показаны',
         !svg.classList.contains('uv-nums-off'));
      K.resetUvViewBox();
      await wait(20);
    }
    mark('8');

    finish();
  }

  function boot() {
    K = window.__kubik;
    if (!K || !K.App || !K.udimBounds || !K.HUB_TOOLS_WORLD) { setTimeout(boot, 120); return; }
    setTimeout(() => {
      run().catch(e => finish('THREW ' + (e && e.stack ? e.stack : e)));
    }, 500);
  }
  // Никакого window.load - урок v2.61.
  boot();
  setTimeout(() => { if (OUT.length === 0) finish('THREW boot timeout - __kubik не появился'); }, 110000);
})();
