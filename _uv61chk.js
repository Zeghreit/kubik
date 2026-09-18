/* _uv61chk - два пальца = вид, кроме выделенного острова (v2.61).

   Проверяется не «есть ли функция», а кто в итоге получил второй палец:
   какой жест жив после его прихода, что стало с незавершённой правкой
   (откатилась ли провизорная добавка в выбор, не записался ли шаг в UV) и
   поехал ли viewBox. Все четыре режима компонент плюс пустой фон. */
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
  const cancel = id => svg.dispatchEvent(ev('pointercancel', 0, 0, id));
  function tap(el, id) {
    const c = centreOf(el);
    down(el, c.x, c.y, id);
    up(c.x, c.y, id);
  }
  // Точка на пустом фоне внутри квадрата: угол SVG, где по построению
  // острова не лежат (renderUvView держит UV_VIEW_PAD по краям).
  function emptyPoint() {
    const r = svg.getBoundingClientRect();
    return { x: r.left + 3, y: r.top + 3 };
  }
  /* Пустой фон кладём НА САМ svg, а не через elementFromPoint: у окна
     сверху лежат панель и кнопки с большим z-index, и в углу
     elementFromPoint отдаёт их - событие тогда не доходит ни до одного
     обработчика вида, и проверялось бы это, а не жест. Цель = сам svg
     означает ровно то, что нужно: closest('.uv-island') не найдёт ничего,
     то есть «под пальцем пусто». По островам и точкам события по-прежнему
     кладутся на их настоящие элементы. */
  function emptyTargetAt(p) { return svg; }
  const box = () => K.uvViewBoxNow;
  const uvOf = ai => {
    const uv = A.objects.find(o => o.id === A.activeObjectId).mesh.geometry.attributes.uv;
    return [uv.getX(ai), uv.getY(ai)];
  };
  // Полный слепок UV - чтобы отличить «жест ничего не записал» от «записал».
  function uvSnapshot() {
    const uv = A.objects.find(o => o.id === A.activeObjectId).mesh.geometry.attributes.uv;
    return Array.prototype.slice.call(uv.array);
  }
  function uvSame(a, b) {
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) if (Math.abs(a[i] - b[i]) > 1e-9) return false;
    return true;
  }
  // Развести два пальца: id2 уезжает от id1, вид должен приблизиться.
  function spread(c1, c2, id1, id2, k) {
    move(c2.x + (c2.x - c1.x) * k, c2.y + (c2.y - c1.y) * k, id2);
  }

  async function run() {
    A = K.App; T = K.THREE;

    // ---------------------------------------------------------------- 0
    let o = A.objects[0];
    if (!o) { K.createPrimitiveObject('cube', { h: 1, v: 1 }, 'Cube', new T.Vector3(0, 0, 0)); o = A.objects[0]; }
    A.activeObjectId = o.id; A.selectedObjectIds = new Set([o.id]);
    K.setMode('edge'); K.ensureHelpers(o);
    const topo = o.mesh.userData.topo;
    A.selectedElements = new Set(topo.edges.map((e, i) => i));
    K.markSeamSelection(true);          // каждая грань - свой остров
    A.selectedElements = new Set();
    K.setMode('uv');
    K.unwrapSelection();
    K.refreshUI();
    seat(K.HUB_TOOLS_WORLD, 'addgeo').run();
    await wait(120);
    svg = document.getElementById('uvViewSvg');
    const islands = () => svg.querySelectorAll('.uv-island');
    ok('0.setup вид открыт, островов хотя бы два',
       K.uvViewOpen && islands().length >= 2, 'islands=' + islands().length);
    ok('0.setup привратник на месте', typeof K.uvSecondPointer === 'function');
    const brand = (document.querySelector('.brand') || {}).textContent || '';
    ok('0.setup версия не ниже 2.61', parseFloat((brand.match(/[\d.]+/) || [0])[0]) >= 2.61, brand);
    mark('0');

    // ---------------------------------------------------------------- 1
    /* НЕвыделенный остров: второй палец забирает жест виду, правка
       отменяется, провизорная добавка в выбор откатывается. */
    {
      K.resetUvViewBox();
      const isl = islands();
      const c1 = centreOf(isl[0]), c2 = centreOf(isl[1]);
      const uv0 = uvSnapshot();
      down(isl[0], c1.x, c1.y, 101);
      await wait(10);
      ok('1.fresh один палец на острове - это перенос', K.uvDragMode === 'translate',
         'mode=' + K.uvDragMode);
      ok('1.fresh и остров добавлен в выбор провизорно', K.uvIslandSel.length === 1,
         JSON.stringify(K.uvIslandSel));
      const b0 = box();
      down(isl[1], c2.x, c2.y, 102);
      await wait(10);
      ok('1.fresh второй палец отдан ВИДУ', K.uvPinchViewLive === true);
      ok('1.fresh жест острова снят', K.uvDragMode === null, 'mode=' + K.uvDragMode);
      ok('1.fresh провизорный выбор откатился', K.uvIslandSel.length === 0,
         JSON.stringify(K.uvIslandSel));
      ok('1.fresh и остров вернулся на место (transform снят)',
         !isl[0].getAttribute('transform'), isl[0].getAttribute('transform') || '(нет)');
      spread(c1, c2, 101, 102, 1.0);
      await wait(10);
      const b1 = box();
      ok('1.fresh развели пальцы - вид приблизился', b1.w < b0.w - 1e-6,
         'w ' + b0.w.toFixed(2) + ' -> ' + b1.w.toFixed(2));
      up(c1.x, c1.y, 101);
      up(c2.x, c2.y, 102);
      await wait(10);
      ok('1.fresh пинч вида закрылся на отрыве', K.uvPinchViewLive === false);
      ok('1.fresh и в UV ничего не записалось', uvSame(uv0, uvSnapshot()));
    }
    mark('1');

    // ---------------------------------------------------------------- 2
    /* ВЫДЕЛЕННЫЙ остров - единственное исключение: два пальца по-прежнему
       вращают и масштабируют ЕГО, а вид стоит. */
    {
      K.resetUvViewBox();
      const isl = islands();
      tap(isl[0], 110);
      await wait(20);
      ok('2.sel   остров выбран тапом', K.uvIslandSel.length === 1, JSON.stringify(K.uvIslandSel));
      const c1 = centreOf(isl[0]), c2 = centreOf(isl[1]);
      const b0 = box();
      down(isl[0], c1.x, c1.y, 111);
      await wait(10);
      ok('2.sel   палец на выделенном острове - перенос', K.uvDragMode === 'translate',
         'mode=' + K.uvDragMode);
      down(isl[1], c2.x, c2.y, 112);
      await wait(10);
      ok('2.sel   второй палец достался ОСТРОВУ', K.uvDragMode === 'pinch', 'mode=' + K.uvDragMode);
      ok('2.sel   вид его не забрал', K.uvPinchViewLive === false);
      spread(c1, c2, 111, 112, 1.0);
      await wait(10);
      const b1 = box();
      ok('2.sel   и viewBox не шевельнулся',
         Math.abs(b1.w - b0.w) < 1e-9 && Math.abs(b1.x - b0.x) < 1e-9,
         'w ' + b0.w.toFixed(3) + ' -> ' + b1.w.toFixed(3));
      cancel(111); cancel(112);
      await wait(10);
      ok('2.sel   отмена закрыла жест', K.uvDragMode === null, 'mode=' + K.uvDragMode);
      // Выбор снимаем тапом по пустому месту, чтобы дальше начать с чистого.
      const p = emptyPoint();
      down(emptyTargetAt(p), p.x, p.y, 113);
      up(p.x, p.y, 113);
      await wait(20);
      ok('2.sel   тап по пустому снял выбор', K.uvIslandSel.length === 0,
         JSON.stringify(K.uvIslandSel));
    }
    mark('2');

    // ---------------------------------------------------------------- 3
    /* Vertex: раньше второй палец просто отбрасывался - отсюда и «в 2д
       редактирование невозможно». Теперь он отдаётся виду, а начатая
       правка вершины отменяется, ничего не записав. */
    {
      K.setUvCompMode('vertex');
      await wait(40);
      K.resetUvViewBox();
      const dots = svg.querySelectorAll('.uv-vertex');
      ok('3.vert  точки есть', dots.length > 0, 'dots=' + dots.length);
      const d0 = dots[0];
      const ai = +d0.dataset.ai;
      const before = uvOf(ai);
      const uv0 = uvSnapshot();
      const c1 = centreOf(d0);
      const p2 = emptyPoint();
      down(d0, c1.x, c1.y, 121);
      await wait(10);
      ok('3.vert  один палец - перетаскивание вершины', K.uvVDragLive === true);
      ok('3.vert  и вершина добавлена провизорно', K.uvSel.length === 1, JSON.stringify(K.uvSel));
      move(c1.x + 40, c1.y + 40, 121);   // заметно больше RING_MOVE_CANCEL_PX
      await wait(10);
      const b0 = box();
      down(emptyTargetAt(p2), p2.x, p2.y, 122);
      await wait(10);
      ok('3.vert  второй палец отдан виду', K.uvPinchViewLive === true);
      ok('3.vert  перетаскивание вершины снято', K.uvVDragLive === false);
      ok('3.vert  провизорный выбор откатился', K.uvSel.length === 0, JSON.stringify(K.uvSel));
      const c1b = { x: c1.x + 40, y: c1.y + 40 };
      spread(c1b, p2, 121, 122, 1.0);
      await wait(10);
      ok('3.vert  вид приблизился', box().w < b0.w - 1e-6,
         'w ' + b0.w.toFixed(2) + ' -> ' + box().w.toFixed(2));
      up(p2.x, p2.y, 122);
      up(c1b.x, c1b.y, 121);
      await wait(20);
      const after = uvOf(ai);
      ok('3.vert  вершина не поехала',
         Math.abs(after[0] - before[0]) < 1e-9 && Math.abs(after[1] - before[1]) < 1e-9,
         before + ' -> ' + after);
      ok('3.vert  и весь UV цел - шага истории не было', uvSame(uv0, uvSnapshot()));
      ok('3.vert  пинч вида закрылся', K.uvPinchViewLive === false);
    }
    mark('3');

    // ---------------------------------------------------------------- 4
    // Face: тот же обработчик, но своя ячейка выбора - проверяем откат её.
    {
      K.setUvCompMode('face');
      await wait(40);
      K.resetUvViewBox();
      const faces = svg.querySelectorAll('.uv-face');
      ok('4.face  грани есть', faces.length > 0, 'faces=' + faces.length);
      const f0 = faces[0];
      const uv0 = uvSnapshot();
      const c1 = centreOf(f0), p2 = emptyPoint();
      down(f0, c1.x, c1.y, 131);
      move(c1.x + 40, c1.y + 30, 131);
      await wait(10);
      ok('4.face  жест грани жив', K.uvVDragLive === true);
      ok('4.face  и грань выбрана провизорно', K.uvFaceSel.length === 1, JSON.stringify(K.uvFaceSel));
      down(emptyTargetAt(p2), p2.x, p2.y, 132);
      await wait(10);
      ok('4.face  второй палец отдан виду', K.uvPinchViewLive === true);
      ok('4.face  жест грани снят', K.uvVDragLive === false);
      ok('4.face  провизорный выбор грани откатился', K.uvFaceSel.length === 0,
         JSON.stringify(K.uvFaceSel));
      up(p2.x, p2.y, 132);
      up(c1.x + 40, c1.y + 30, 131);
      await wait(20);
      ok('4.face  UV не тронут', uvSame(uv0, uvSnapshot()));
    }
    mark('4');

    // ---------------------------------------------------------------- 5
    // Edge: у него нет своего drag, есть таймер удержания - он тоже гаснет.
    {
      K.setUvCompMode('edge');
      await wait(40);
      K.resetUvViewBox();
      const edges = svg.querySelectorAll('.uv-edge');
      ok('5.edge  рёбра есть', edges.length > 0, 'edges=' + edges.length);
      const e0 = edges[0];
      const c1 = centreOf(e0), p2 = emptyPoint();
      down(e0, c1.x, c1.y, 141);
      await wait(10);
      ok('5.edge  удержание ребра началось', K.uvEdgeHoldLive === true);
      ok('5.edge  и ребро выбрано провизорно', K.uvEdgeSel.length === 1, JSON.stringify(K.uvEdgeSel));
      down(emptyTargetAt(p2), p2.x, p2.y, 142);
      await wait(10);
      ok('5.edge  второй палец отдан виду', K.uvPinchViewLive === true);
      ok('5.edge  удержание ребра снято', K.uvEdgeHoldLive === false);
      ok('5.edge  провизорный выбор ребра откатился', K.uvEdgeSel.length === 0,
         JSON.stringify(K.uvEdgeSel));
      // И кольцо HUB_TOOLS_UV не должно распуститься после отбора пальца.
      await wait(560);
      ok('5.edge  кольцо ребра не распустилось', !K.toolRingActive);
      up(p2.x, p2.y, 142);
      up(c1.x, c1.y, 141);
      await wait(10);
      ok('5.edge  пинч вида закрылся', K.uvPinchViewLive === false);
    }
    mark('5');

    // ---------------------------------------------------------------- 6
    // Пустой фон (v2.51) должен работать ровно как раньше.
    {
      K.setUvCompMode('island');
      await wait(40);
      K.resetUvViewBox();
      const p1 = emptyPoint();
      const b0 = box();
      down(emptyTargetAt(p1), p1.x, p1.y, 151);
      // Два движения, не одно: startUvPan берёт своё начало ИЗ того move,
      // который перешагнул RING_MOVE_CANCEL_PX, так что после одного
      // движения пан жив, но по построению не сдвинулся ни на сколько.
      move(p1.x + 15, p1.y + 15, 151);
      move(p1.x + 45, p1.y + 45, 151);
      await wait(10);
      ok('6.empty один палец по пустому - пан вида', K.uvPanLive === true);
      const b1 = box();
      ok('6.empty и вид поехал', Math.abs(b1.x - b0.x) > 1e-6 || Math.abs(b1.y - b0.y) > 1e-6,
         'x ' + b0.x.toFixed(2) + ' -> ' + b1.x.toFixed(2));
      const p2 = { x: p1.x + 200, y: p1.y + 200 };
      down(emptyTargetAt(p2), p2.x, p2.y, 152);
      await wait(10);
      ok('6.empty второй палец превратил пан в пинч', K.uvPinchViewLive === true);
      ok('6.empty и пан обнулён', K.uvPanLive === false);
      /* ТРЕТИЙ ПАЛЕЦ ВО ВРЕМЯ ПИНЧА НЕ ЗАВОДИТ НОВЫЙ ЖЕСТ (до v2.61 он
         заводил таймер удержания и распускал кольцо «3D» посреди зума). */
      const p3 = { x: p1.x + 100, y: p1.y + 5 };
      down(emptyTargetAt(p3), p3.x, p3.y, 153);
      await wait(560);
      ok('6.empty третий палец не распустил кольцо «3D»', !K.toolRingActive);
      ok('6.empty и пинч вида всё ещё жив', K.uvPinchViewLive === true);
      up(p3.x, p3.y, 153);
      up(p2.x, p2.y, 152);
      up(p1.x + 45, p1.y + 45, 151);
      await wait(10);
      ok('6.empty всё закрылось', K.uvPinchViewLive === false && K.uvPanLive === false);
    }
    mark('6');

    // ---------------------------------------------------------------- 7
    // И главное: одним пальцем правка по-прежнему работает и пишется.
    {
      K.resetUvViewBox();
      const isl = islands();
      const id0 = +isl[0].dataset.island;
      const uv0 = uvSnapshot();
      const c1 = centreOf(isl[0]);
      down(isl[0], c1.x, c1.y, 161);
      move(c1.x + 20, c1.y + 10, 161);
      move(c1.x + 40, c1.y + 20, 161);
      await wait(10);
      ok('7.one   один палец всё ещё тащит остров', K.uvDragMode === 'translate',
         'mode=' + K.uvDragMode);
      up(c1.x + 40, c1.y + 20, 161);
      await wait(60);
      ok('7.one   и записал сдвиг в UV', !uvSame(uv0, uvSnapshot()));
      ok('7.one   остров остался выбран после переноса',
         K.uvIslandSel.indexOf(id0) >= 0, JSON.stringify(K.uvIslandSel));
    }
    mark('7');

    // ---------------------------------------------------------------- 8
    /* F1: полоски по бокам квадрата. Обработчик на карточке сторожил не те
       элементы - целью нажатия там всегда #uvViewSvgWrap, так что вся
       треть экрана не делала ничего: ни удержания, ни кольца, ни выхода.
       Геометрия окна здесь квадратная, полосок нет вовсе, поэтому событие
       кладётся прямо на wrap - проверяется сторож, а не вёрстка. */
    {
      K.resetUvViewBox();
      const wrap = document.getElementById('uvViewSvgWrap');
      ok('8.strip обёртка на месте', !!wrap);
      const r = svg.getBoundingClientRect();
      const x = r.left + 20, y = r.top + 20;
      wrap.dispatchEvent(ev('pointerdown', x, y, 171));
      await wait(10);
      const b0 = box();
      move(x + 15, y + 15, 171);
      move(x + 45, y + 45, 171);
      await wait(10);
      ok('8.strip нажатие по полоске стало паном вида', K.uvPanLive === true);
      ok('8.strip и вид поехал', Math.abs(box().x - b0.x) > 1e-6 || Math.abs(box().y - b0.y) > 1e-6,
         'x ' + b0.x.toFixed(2) + ' -> ' + box().x.toFixed(2));
      up(x + 45, y + 45, 171);
      await wait(10);
      ok('8.strip и всё закрылось', K.uvPanLive === false && K.uvPointerCount === 0,
         'pointers=' + K.uvPointerCount);
    }
    mark('8');

    // ---------------------------------------------------------------- 9
    /* F2: палец, чей напарник отпущен, не владеет ничем - и следующее
       касание читалось как ПЕРВОЕ, начиная правку двумя пальцами на стекле
       и записывая её в историю. Теперь оно возобновляет пинч вида. */
    {
      K.resetUvViewBox();
      // Секция 7 оставила остров выбранным - здесь нужен именно НЕвыбранный,
      // иначе измерялось бы исключение, а не общее правило.
      const pz = emptyPoint();
      down(emptyTargetAt(pz), pz.x, pz.y, 180); up(pz.x, pz.y, 180);
      await wait(20);
      ok('9.back  начинаем с пустого выбора', K.uvIslandSel.length === 0,
         JSON.stringify(K.uvIslandSel));
      const isl = islands();
      const uv0 = uvSnapshot();
      const c1 = centreOf(isl[0]), c2 = centreOf(isl[1]);
      down(isl[0], c1.x, c1.y, 181);
      down(isl[1], c2.x, c2.y, 182);
      await wait(10);
      ok('9.back  два пальца - пинч вида', K.uvPinchViewLive === true);
      ok('9.back  и оба пальца на учёте', K.uvPointerCount === 2, 'pointers=' + K.uvPointerCount);
      up(c2.x, c2.y, 182);
      await wait(10);
      ok('9.back  отрыв одного закрыл пинч', K.uvPinchViewLive === false);
      ok('9.back  но первый палец ещё на учёте', K.uvPointerCount === 1,
         'pointers=' + K.uvPointerCount);
      down(isl[1], c2.x, c2.y, 182);
      await wait(10);
      ok('9.back  вернувшийся палец возобновил пинч ВИДА', K.uvPinchViewLive === true);
      ok('9.back  а не начал правку острова', K.uvDragMode === null, 'mode=' + K.uvDragMode);
      ok('9.back  и в выбор ничего не попало', K.uvIslandSel.length === 0,
         JSON.stringify(K.uvIslandSel));
      up(c2.x, c2.y, 182);
      up(c1.x, c1.y, 181);
      await wait(30);
      ok('9.back  UV не тронут', uvSame(uv0, uvSnapshot()));
      ok('9.back  учёт пальцев пуст', K.uvPointerCount === 0, 'pointers=' + K.uvPointerCount);
    }
    mark('9');

    // ---------------------------------------------------------------- 10
    /* F3: удержание ребра терпит любой дрейф пальца (так задумано с v2.50),
       поэтому точка НАЖАТИЯ - не то место, где палец сейчас. Пинч, засеянный
       ею, начинался с чужого расстояния: второй палец, легший рядом с
       исходным нажатием, давал startDist около нуля и прибивал вид к
       максимальному зуму. */
    {
      K.setUvCompMode('edge');
      await wait(40);
      K.resetUvViewBox();
      const edges = svg.querySelectorAll('.uv-edge');
      const e0 = edges[0];
      const c1 = centreOf(e0);
      down(e0, c1.x, c1.y, 191);
      move(c1.x + 150, c1.y + 150, 191);   // дрейф, запись жива по замыслу
      await wait(10);
      ok('10.drift удержание ребра выжило после дрейфа', K.uvEdgeHoldLive === true);
      // Второй палец ложится ровно в точку исходного нажатия - то есть
      // ДАЛЕКО от первого пальца. Значит startDist большой, и небольшое
      // движение второго пальца почти не меняет зум.
      down(emptyTargetAt({ x: c1.x, y: c1.y }), c1.x, c1.y, 192);
      await wait(10);
      ok('10.drift второй палец отдан виду', K.uvPinchViewLive === true);
      move(c1.x - 10, c1.y - 10, 192);
      await wait(10);
      ok('10.drift малое движение - малый зум', box().w > 90,
         'w=' + box().w.toFixed(2) + ' (с точкой нажатия вышло бы около 70)');
      up(c1.x - 10, c1.y - 10, 192);
      up(c1.x + 150, c1.y + 150, 191);
      await wait(10);
      ok('10.drift всё закрылось', K.uvPointerCount === 0, 'pointers=' + K.uvPointerCount);
    }
    mark('10');

    // ---------------------------------------------------------------- 11
    // F4: у пинча вида не было минимального разноса пальцев - только `|| 1`.
    {
      K.setUvCompMode('island');
      await wait(40);
      K.resetUvViewBox();
      ok('11.floor порог разноса объявлен', K.UV_VIEW_PINCH_MIN_PX >= 8,
         'px=' + K.UV_VIEW_PINCH_MIN_PX);
      const p1 = emptyPoint();
      down(emptyTargetAt(p1), p1.x, p1.y, 201);
      move(p1.x + 15, p1.y + 15, 201);
      move(p1.x + 45, p1.y + 45, 201);
      await wait(10);
      const f1 = { x: p1.x + 45, y: p1.y + 45 };
      // Второй палец в 5 px от первого - так палец и ложится случайно.
      const p2 = { x: f1.x + 5, y: f1.y };
      down(emptyTargetAt(p2), p2.x, p2.y, 202);
      await wait(10);
      ok('11.floor пинч вида начался', K.uvPinchViewLive === true);
      K.resetUvViewBox();   // мерим только то, что сделает следующий кадр
      // Разводим до ровно порога: ratio должен выйти 1, а не 5/24.
      move(f1.x + K.UV_VIEW_PINCH_MIN_PX, f1.y, 202);
      await wait(10);
      ok('11.floor разнос до порога зум не меняет', box().w > 95,
         'w=' + box().w.toFixed(2) + ' (без порога вышло бы около 20)');
      up(p2.x, p2.y, 202);
      up(f1.x, f1.y, 201);
      await wait(10);
      ok('11.floor всё закрылось', K.uvPointerCount === 0, 'pointers=' + K.uvPointerCount);
    }
    mark('11');

    // ---------------------------------------------------------------- 12
    /* F5: два пальца по ВЫДЕЛЕННОМУ острову, поднятые без поворота и
       масштаба, читались как тап - и снимали выбор с того самого острова,
       на котором лежала рука. */
    {
      K.resetUvViewBox();
      const isl = islands();
      const id0 = +isl[0].dataset.island;
      tap(isl[0], 210);
      await wait(20);
      ok('12.keep  остров выбран', K.uvIslandSel.indexOf(id0) >= 0, JSON.stringify(K.uvIslandSel));
      const uv0 = uvSnapshot();
      const c1 = centreOf(isl[0]), c2 = centreOf(isl[1]);
      down(isl[0], c1.x, c1.y, 211);
      down(isl[1], c2.x, c2.y, 212);
      await wait(10);
      ok('12.keep  это пинч ОСТРОВА', K.uvDragMode === 'pinch', 'mode=' + K.uvDragMode);
      up(c2.x, c2.y, 212);
      await wait(30);
      ok('12.keep  выбор остался', K.uvIslandSel.indexOf(id0) >= 0, JSON.stringify(K.uvIslandSel));
      ok('12.keep  и ничего не записалось', uvSame(uv0, uvSnapshot()));
      up(c1.x, c1.y, 211);
      await wait(10);
      ok('12.keep  учёт пальцев пуст', K.uvPointerCount === 0, 'pointers=' + K.uvPointerCount);
      // Убираем выбор для следующей секции.
      const pe = emptyPoint();
      down(emptyTargetAt(pe), pe.x, pe.y, 213); up(pe.x, pe.y, 213);
      await wait(20);
    }
    mark('12');

    // ---------------------------------------------------------------- 13
    // F7: переключение режима компонент гасит и жесты ВИДА.
    {
      K.resetUvViewBox();
      const p1 = emptyPoint();
      down(emptyTargetAt(p1), p1.x, p1.y, 221);
      move(p1.x + 15, p1.y + 15, 221);
      move(p1.x + 45, p1.y + 45, 221);
      const p2 = { x: p1.x + 200, y: p1.y + 200 };
      down(emptyTargetAt(p2), p2.x, p2.y, 222);
      await wait(10);
      ok('13.mode  пинч вида жив', K.uvPinchViewLive === true);
      K.setUvCompMode('vertex');
      await wait(40);
      ok('13.mode  смена режима погасила пинч', K.uvPinchViewLive === false);
      ok('13.mode  и пан', K.uvPanLive === false);
      ok('13.mode  но пальцы всё ещё на учёте', K.uvPointerCount === 2,
         'pointers=' + K.uvPointerCount);
      up(p2.x, p2.y, 222);
      up(p1.x + 45, p1.y + 45, 221);
      await wait(10);
      ok('13.mode  и снялись с учёта на отрыве', K.uvPointerCount === 0,
         'pointers=' + K.uvPointerCount);
      K.setUvCompMode('island');
      await wait(40);
    }
    mark('13');

    // ---------------------------------------------------------------- 14
    /* G1 BLOCKER: кольцо, распустившееся ИЗ этого вида, забирает захват
       указателя на canvas - и pointerup того пальца сюда уже не приходит.
       Учёт пальцев тогда подтекал навсегда, и после первого же кольца
       каждое следующее одиночное касание читалось как ВТОРОЕ: вид
       перестаёт выбирать, править и открывать то самое кольцо, которое с
       v2.53 - единственный выход отсюда. Палец, открывший кольцо, здесь
       намеренно НЕ отпускается - именно так это и выглядит вживую. */
    {
      K.setUvCompMode('island');
      await wait(40);
      K.resetUvViewBox();
      const p1 = emptyPoint();
      down(emptyTargetAt(p1), p1.x, p1.y, 231);
      await wait(560);
      ok('14.ring  кольцо «3D» распустилось', !!K.toolRingActive);
      ok('14.ring  и палец снят с учёта вида', K.uvPointerCount === 0,
         'pointers=' + K.uvPointerCount);
      const isl = islands();
      const c = centreOf(isl[0]);
      down(isl[0], c.x, c.y, 232);
      await wait(10);
      ok('14.ring  нажатие при открытом кольце не начало правку',
         K.uvDragMode === null, 'mode=' + K.uvDragMode);
      ok('14.ring  ничего не выбрало', K.uvIslandSel.length === 0, JSON.stringify(K.uvIslandSel));
      ok('14.ring  и не встало на учёт', K.uvPointerCount === 0, 'pointers=' + K.uvPointerCount);
      up(c.x, c.y, 232);
      K.closeToolRing(false);
      await wait(30);
      ok('14.ring  кольцо закрыто', !K.toolRingActive);
      // Палец 231 так и не отпущен внутри вида - и это не должно мешать.
      down(isl[0], c.x, c.y, 233);
      await wait(10);
      ok('14.ring  вид по-прежнему правится одним пальцем',
         K.uvDragMode === 'translate', 'mode=' + K.uvDragMode);
      cancel(233); cancel(231);
      await wait(10);
      ok('14.ring  учёт пуст', K.uvPointerCount === 0, 'pointers=' + K.uvPointerCount);
    }
    mark('14');

    // ---------------------------------------------------------------- 15
    // Тот же путь у кольца ребра (HUB_TOOLS_UV) - и ни одно его место не
    // закрывает вид, так что подтёк там был бы ещё и на успешном сценарии.
    {
      K.setUvCompMode('edge');
      await wait(40);
      const edges = svg.querySelectorAll('.uv-edge');
      const e0 = edges[0];
      const c1 = centreOf(e0);
      down(e0, c1.x, c1.y, 251);
      await wait(560);
      ok('15.ring  кольцо ребра распустилось', !!K.toolRingActive);
      ok('15.ring  и палец снят с учёта вида', K.uvPointerCount === 0,
         'pointers=' + K.uvPointerCount);
      K.closeToolRing(false);
      await wait(30);
      const e1 = svg.querySelectorAll('.uv-edge')[1];
      const c2 = centreOf(e1);
      down(e1, c2.x, c2.y, 252);
      await wait(10);
      ok('15.ring  вид по-прежнему принимает касания', K.uvEdgeHoldLive === true);
      cancel(252); cancel(251);
      await wait(10);
      ok('15.ring  учёт пуст', K.uvPointerCount === 0, 'pointers=' + K.uvPointerCount);
      K.setUvCompMode('island');
      await wait(40);
    }
    mark('15');

    // ---------------------------------------------------------------- 16
    // G4: тап по полоске рядом с квадратом теперь снимает выбор - ровно как
    // тап на два пикселя внутрь квадрата.
    {
      const isl = islands();
      const id0 = +isl[0].dataset.island;
      tap(isl[0], 261);
      await wait(20);
      ok('16.strip остров выбран', K.uvIslandSel.indexOf(id0) >= 0, JSON.stringify(K.uvIslandSel));
      const wrap = document.getElementById('uvViewSvgWrap');
      const r = svg.getBoundingClientRect();
      wrap.dispatchEvent(ev('pointerdown', r.left + 20, r.top + 20, 262));
      up(r.left + 20, r.top + 20, 262);
      await wait(20);
      ok('16.strip тап по полоске снял выбор', K.uvIslandSel.length === 0,
         JSON.stringify(K.uvIslandSel));
      ok('16.strip учёт пуст', K.uvPointerCount === 0, 'pointers=' + K.uvPointerCount);
    }
    mark('16');

    finish();
  }

  function boot() {
    K = window.__kubik;
    if (!K || !K.App || !K.uvSecondPointer || !K.HUB_TOOLS_WORLD) { setTimeout(boot, 120); return; }
    setTimeout(() => {
      run().catch(e => finish('THREW ' + (e && e.stack ? e.stack : e)));
    }, 500);
  }
  /* Никакого window.load (урок v2.61): __kubik создаётся модулем, который
     выполняется ДО load, а сам load держит любой висящий подресурс - и тогда
     проба молчит 110 секунд и отчитывается словом, которым отчитался бы
     сломанный файл. boot() опрашивает __kubik сам. */
  boot();
  // Если boot так и не дождался __kubik - отчёт всё равно уйдёт, и первым
  // словом в нём будет THREW, чтобы раннер не принял тишину за успех
  // (урок _uv55chk: сообщение таймаута, не начинавшееся с FAIL/THREW,
  // раннер посчитал PASS).
  setTimeout(() => { if (OUT.length === 0) finish('THREW boot timeout - __kubik не появился'); }, 110000);
})();
