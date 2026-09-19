/* _uv64chk - двойной тап вписывает вид.

   Проверяется не «есть ли функция», а то, что жест читается ровно в тех
   четырёх местах, где 2D-вид разрешает тап, что он НЕ выполняет обычное
   действие тапа, что вписанный кадр действительно содержит то, во что
   вписывался, и что одиночный тап с перетаскиванием от этого не пострадали. */
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
  const up = (x, y, id) => svg.dispatchEvent(ev('pointerup', x, y, id));
  function tapAt(el, x, y, id) { down(el, x, y, id); up(x, y, id); }
  function tap(el, id) { const c = centreOf(el); tapAt(el, c.x, c.y, id); }
  // Два тапа в одно место, с запасом внутри 450 мс.
  async function dblTap(el, id) {
    const c = centreOf(el);
    tapAt(el, c.x, c.y, id);
    await wait(40);
    tapAt(el, c.x, c.y, id + 1);
    await wait(40);
  }
  const box = () => K.uvViewBoxNow;
  // Содержит ли текущий кадр коробку элемента целиком.
  function frameHolds(el) {
    const bb = el.getBBox(), b = box();
    return bb.x >= b.x - 1e-6 && bb.x + bb.width <= b.x + b.w + 1e-6 &&
           bb.y >= b.y - 1e-6 && bb.y + bb.height <= b.y + b.h + 1e-6;
  }
  const spanOf = el => { const b = el.getBBox(); return Math.max(b.width, b.height); };
  const uvOf = ai => {
    const o = A.objects.find(x => x.id === A.activeObjectId);
    return o.mesh.geometry.attributes.uv.getX(ai);
  };
  function uvSnapshot() {
    const o = A.objects.find(x => x.id === A.activeObjectId);
    return Array.prototype.slice.call(o.mesh.geometry.attributes.uv.array);
  }
  function uvSame(a, b) {
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) if (Math.abs(a[i] - b[i]) > 1e-9) return false;
    return true;
  }
  // Точка на пустом фоне: событие кладём на сам svg, там под пальцем ничего.
  function emptyMid() {
    const r = svg.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
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
    await wait(120);
    svg = document.getElementById('uvViewSvg');
    const islands = () => svg.querySelectorAll('.uv-island');
    ok('0.setup вид открыт', K.uvViewOpen && islands().length >= 2, 'islands=' + islands().length);
    ok('0.setup версия не ниже 2.64',
       parseFloat((((document.querySelector('.brand') || {}).textContent || '').match(/[\d.]+/) || [0])[0]) >= 2.64,
       (document.querySelector('.brand') || {}).textContent);
    mark('0');

    // ---------------------------------------------------------------- 1
    // Сам читатель жеста: 450 мс и 40 px, те же числа, что у 3D-вьюпорта.
    {
      const at = (x, y) => new PointerEvent('pointerup', { clientX: x, clientY: y, pointerId: 1 });
      ok('1.read  один тап - не двойной', K.uvIsDoubleTap(at(100, 100)) === false);
      ok('1.read  второй тап там же - двойной', K.uvIsDoubleTap(at(100, 100)) === true);
      ok('1.read  и он съеден: третий снова не двойной', K.uvIsDoubleTap(at(100, 100)) === false);
      ok('1.read  в 30 px - всё ещё двойной', K.uvIsDoubleTap(at(120, 120)) === true);
      K.uvIsDoubleTap(at(100, 100));
      ok('1.read  а в 100 px в стороне - нет', K.uvIsDoubleTap(at(200, 100)) === false);
      K.uvIsDoubleTap(at(100, 100));
      await wait(520);
      ok('1.read  и через полсекунды - тоже нет', K.uvIsDoubleTap(at(100, 100)) === false);
    }
    mark('1');

    // ---------------------------------------------------------------- 2
    // Остров: двойной тап вписывает ЕГО, а не переключает выбор.
    {
      K.resetUvViewBox();
      await wait(30);
      const isl = islands();
      const id0 = +isl[0].dataset.island;
      const w0 = box().w;
      const uv0 = uvSnapshot();
      await dblTap(isl[0], 501);
      await wait(60);
      const fresh = svg.querySelector('.uv-island[data-island="' + id0 + '"]');
      ok('2.isl   вид приблизился', box().w < w0, 'w ' + w0 + ' -> ' + box().w);
      ok('2.isl   остров целиком в кадре', frameHolds(fresh),
         'коробка ' + spanOf(fresh).toFixed(2) + ' кадр ' + box().w.toFixed(2));
      /* «Не намного больше» считается по ОБЕИМ сторонам (v2.69): высота кадра
         теперь w*aspect, поэтому вертикальный размах острова требует своей
         ширины - spanY/aspect, - и на широком экране именно он решает. */
      {
        const bb = fresh.getBBox(), a = K.uvAspect();
        const need = Math.max(bb.width, bb.height / a);
        ok('2.isl   и кадр не намного больше него',
           box().w <= Math.max(need * K.UV_FRAME_PAD, K.uvZoomW().min) + 1e-6,
           'w=' + box().w.toFixed(2) + ' нужно=' + need.toFixed(2) + ' aspect=' + a.toFixed(2));
      }
      ok('2.isl   первый тап выбрал его, второй выбор не снял',
         K.uvIslandSel.indexOf(id0) >= 0, JSON.stringify(K.uvIslandSel));
      ok('2.isl   и в UV ничего не записалось', uvSame(uv0, uvSnapshot()));
    }
    mark('2');

    // ---------------------------------------------------------------- 3
    // Двойной тап по пустому месту вписывает всю раскладку.
    {
      // Сперва уезжаем в дальний угол листа, чтобы было откуда возвращаться.
      K.zoomUvViewBoxAt(0.1, 800, -700);
      await wait(30);
      const away = box();
      ok('3.all   уехали далеко от раскладки', away.x > 300, 'x=' + away.x.toFixed(1));
      const p = emptyMid();
      tapAt(svg, p.x, p.y, 511);
      await wait(40);
      tapAt(svg, p.x, p.y, 512);
      await wait(80);
      const b = box();
      ok('3.all   вид вернулся к раскладке', b.x < 100 && b.x + b.w > 0,
         'кадр x ' + b.x.toFixed(1) + '..' + (b.x + b.w).toFixed(1));
      let held = 0;
      islands().forEach(g => { if (frameHolds(g)) held++; });
      ok('3.all   и все острова в кадре', held === islands().length,
         held + ' из ' + islands().length);
    }
    mark('3');

    // ---------------------------------------------------------------- 4
    // Vertex: то же, и сама вершина от двойного тапа не двигается.
    {
      K.setUvCompMode('vertex');
      await wait(60);
      K.resetUvViewBox();
      await wait(30);
      const d0 = svg.querySelectorAll('.uv-vertex')[0];
      const ai = +d0.dataset.ai;
      const u0 = uvOf(ai);
      const w0 = box().w;
      await dblTap(d0, 521);
      await wait(60);
      ok('4.vert  вид приблизился', box().w < w0, 'w ' + w0 + ' -> ' + box().w);
      ok('4.vert  но не мельче предела зума', box().w >= K.UV_ZOOM_MIN - 1e-6, 'w=' + box().w);
      ok('4.vert  и сама вершина не двинулась', Math.abs(uvOf(ai) - u0) < 1e-9,
         u0 + ' -> ' + uvOf(ai));
      ok('4.vert  она осталась выбрана', K.uvSel.indexOf(ai) >= 0, JSON.stringify(K.uvSel));
    }
    mark('4');

    // ---------------------------------------------------------------- 5
    // Edge: своего drag нет, тап резолвится в pointerup удержания.
    {
      K.setUvCompMode('edge');
      await wait(60);
      K.resetUvViewBox();
      await wait(30);
      const e0 = svg.querySelectorAll('.uv-edge')[0];
      const key = e0.dataset.key;
      const w0 = box().w;
      await dblTap(e0, 531);
      await wait(60);
      ok('5.edge  вид приблизился', box().w < w0, 'w ' + w0 + ' -> ' + box().w);
      const fresh = svg.querySelector('.uv-edge[data-key="' + key + '"]');
      ok('5.edge  ребро в кадре', !!fresh && frameHolds(fresh));
      ok('5.edge  и осталось выбранным', K.uvEdgeSel.indexOf(key) >= 0,
         JSON.stringify(K.uvEdgeSel));
      ok('5.edge  кольцо ребра не распустилось', !K.toolRingActive);
    }
    mark('5');

    // ---------------------------------------------------------------- 6
    // Face: тот же обработчик, что у вершины, но своя ячейка выбора.
    {
      K.setUvCompMode('face');
      await wait(60);
      K.resetUvViewBox();
      await wait(30);
      const f0 = svg.querySelectorAll('.uv-face')[0];
      const fg = +f0.dataset.fg;
      const w0 = box().w;
      const uv0 = uvSnapshot();
      await dblTap(f0, 541);
      await wait(60);
      ok('6.face  вид приблизился', box().w < w0, 'w ' + w0 + ' -> ' + box().w);
      const fresh = svg.querySelector('.uv-face[data-fg="' + fg + '"]');
      ok('6.face  грань в кадре', !!fresh && frameHolds(fresh));
      ok('6.face  и осталась выбранной', K.uvFaceSel.indexOf(fg) >= 0,
         JSON.stringify(K.uvFaceSel));
      ok('6.face  UV не тронут', uvSame(uv0, uvSnapshot()));
      K.setUvCompMode('island');
      await wait(60);
    }
    mark('6');

    // ---------------------------------------------------------------- 7
    /* Одиночный тап обязан работать как раньше: двойной не должен съесть
       обычное переключение выбора, а пара медленных тапов - это два тапа. */
    {
      K.resetUvViewBox();
      await wait(30);
      const isl = islands();
      const id0 = +isl[0].dataset.island;
      const w0 = box().w;
      const p = emptyMid();
      tapAt(svg, p.x, p.y, 551);          // снять всё с выбора
      await wait(520);
      ok('7.single выбор пуст', K.uvIslandSel.length === 0, JSON.stringify(K.uvIslandSel));
      tap(isl[0], 552);
      await wait(520);                    // больше 450 мс - следующий не двойной
      ok('7.single одиночный тап выбрал остров', K.uvIslandSel.indexOf(id0) >= 0,
         JSON.stringify(K.uvIslandSel));
      ok('7.single и вид не двинулся', Math.abs(box().w - w0) < 1e-6, 'w=' + box().w);
      tap(isl[0], 553);
      await wait(520);
      ok('7.single медленный повторный тап снял выбор', K.uvIslandSel.length === 0,
         JSON.stringify(K.uvIslandSel));
      ok('7.single и вид по-прежнему на месте', Math.abs(box().w - w0) < 1e-6, 'w=' + box().w);
    }
    mark('7');

    // ---------------------------------------------------------------- 8
    // Перетаскивание не тап, даже если перед ним был тап в той же точке.
    {
      K.resetUvViewBox();
      await wait(30);
      const isl = islands();
      const c = centreOf(isl[0]);
      const w0 = box().w;
      const uv0 = uvSnapshot();
      tapAt(isl[0], c.x, c.y, 561);
      await wait(40);
      down(isl[0], c.x, c.y, 562);
      svg.dispatchEvent(ev('pointermove', c.x + 30, c.y + 15, 562));
      svg.dispatchEvent(ev('pointermove', c.x + 60, c.y + 30, 562));
      up(c.x + 60, c.y + 30, 562);
      await wait(100);
      ok('8.drag  вид не вписался от перетаскивания',
         Math.abs(box().w - w0) < 1e-6, 'w=' + box().w);
      ok('8.drag  а правка записалась', !uvSame(uv0, uvSnapshot()));
      K.undo();
      await wait(120);
      ok('8.drag  и Undo её вернул', uvSame(uv0, uvSnapshot()));
    }
    mark('8');

    finish();
  }

  function boot() {
    K = window.__kubik;
    if (!K || !K.App || !K.frameUvAll || !K.HUB_TOOLS_WORLD) { setTimeout(boot, 120); return; }
    setTimeout(() => {
      run().catch(e => finish('THREW ' + (e && e.stack ? e.stack : e)));
    }, 500);
  }
  // Никакого window.load - урок v2.61.
  boot();
  setTimeout(() => { if (OUT.length === 0) finish('THREW boot timeout - __kubik не появился'); }, 110000);
})();
