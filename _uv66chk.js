/* _uv66chk - раскладка: выравнивание группы и упаковка листа.

   Проверяется, что выравнивание переносит, а не масштабирует; что остров,
   задающий край, не двигается; что оси u и v не перепутаны; и что Pack
   собирает всё в 0..1, не потеряв ни острова. */
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
  const near = (a, b, e) => Math.abs(a - b) < (e === undefined ? 1e-6 : e);

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
  // ОДИН id на нажатие и отпускание: разные id оставляют таймер удержания
  // живым, он распускает кольцо, а открытое кольцо съедает все следующие
  // нажатия. И если кольцо всё же открыто - закрываем, прежде чем тапать.
  let clearId = 900;
  async function clearSel() {
    if (K.toolRingActive) { K.closeToolRing(false); await wait(40); }
    const r = svg.getBoundingClientRect();
    const x = r.left + r.width / 2, y = r.top + r.height / 2;
    const id = ++clearId;
    svg.dispatchEvent(ev('pointerdown', x, y, id));
    svg.dispatchEvent(ev('pointerup', x, y, id));
    await wait(520);
  }
  // Коробка одного острова по текущим UV.
  function boxOf(id) {
    const o = obj();
    const uv = o.mesh.geometry.attributes.uv;
    const { attrIsland } = K.islandVertexMap(o);
    let minU = Infinity, minV = Infinity, maxU = -Infinity, maxV = -Infinity;
    for (let ai = 0; ai < attrIsland.length; ai++) {
      if (attrIsland[ai] !== id) continue;
      const u = uv.getX(ai), v = uv.getY(ai);
      if (!Number.isFinite(u) || !Number.isFinite(v)) continue;
      if (u < minU) minU = u;
      if (u > maxU) maxU = u;
      if (v < minV) minV = v;
      if (v > maxV) maxV = v;
    }
    return { minU, minV, maxU, maxV, w: maxU - minU, h: maxV - minV };
  }
  /* Отменять только то, что действительно записалось: операция может честно
     отказаться (нечего выравнивать), и тогда слепой Undo забирает чужой шаг -
     ровно так этот прогон и уехал к состоянию без развёртки. */
  async function undoIfStepped(at) {
    if (A.historyIndex > at) { K.undo(); await wait(160); }
  }
  function uvSnapshot() {
    return Array.prototype.slice.call(obj().mesh.geometry.attributes.uv.array);
  }
  function uvSame(a, b, e) {
    const eps = e === undefined ? 1e-9 : e;
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) if (Math.abs(a[i] - b[i]) > eps) return false;
    return true;
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
    ok('0.setup версия не ниже 2.66',
       parseFloat((((document.querySelector('.brand') || {}).textContent || '').match(/[\d.]+/) || [0])[0]) >= 2.66,
       (document.querySelector('.brand') || {}).textContent);
    mark('0');

    // ---------------------------------------------------------------- 1
    // Кольца: восемь мест у острова, Pack - в кольце пустого места.
    {
      const R = K.HUB_TOOLS_UV2D_ISLAND;
      ok('1.ring  в кольце острова восемь мест', R.length === 8, 'seats=' + R.length);
      ok('1.ring  места пронумерованы 0..7',
         R.every((t, i) => t.seat === i), R.map(t => t.seat).join(','));
      const al = Object.keys(K.UV_ALIGN);
      ok('1.ring  четыре выравнивания', al.length === 4, al.join(','));
      ok('1.ring  и последние четыре места - они',
         al.every((k, i) => R[4 + i].key === 'uva-' + k), R.slice(4).map(t => t.key).join(','));
      ok('1.ring  все восемь картинок различны',
         new Set(R.map(t => t.icon)).size === 8, R.map(t => t.icon).join(','));
      const pack = seat(K.HUB_TOOLS_UV2D_WORLD, 'uvpack');
      ok('1.ring  Pack есть в кольце пустого места', !!pack && typeof pack.run === 'function');
      ok('1.ring  и не рядом с выходом в 3D',
         !!pack && Math.abs(pack.seat - seat(K.HUB_TOOLS_UV2D_WORLD, 'to3d').seat) > 1,
         'seats ' + (pack && pack.seat) + ' vs ' + seat(K.HUB_TOOLS_UV2D_WORLD, 'to3d').seat);
    }
    mark('1');

    // ---------------------------------------------------------------- 2
    /* Выравнивание влево: у всех выбранных minU становится общим минимумом,
       остров, который его задавал, не двигается, и размеры не меняются. */
    {
      await clearSel();
      const isl = islands();
      const idA = +isl[0].dataset.island, idB = +isl[1].dataset.island;
      tap(isl[0], 701); await wait(520);
      tap(svg.querySelector('.uv-island[data-island="' + idB + '"]'), 702); await wait(520);
      ok('2.left  выбраны два острова', K.uvIslandSel.length === 2, JSON.stringify(K.uvIslandSel));
      const atLeft = A.historyIndex;
      const a0 = boxOf(idA), b0 = boxOf(idB);
      ok('2.left  и их левые края разные', !near(a0.minU, b0.minU),
         a0.minU.toFixed(4) + ' vs ' + b0.minU.toFixed(4));
      const gMin = Math.min(a0.minU, b0.minU);
      const anchor = a0.minU < b0.minU ? idA : idB, mover = anchor === idA ? idB : idA;
      const anchorBefore = boxOf(anchor);
      ok('2.left  операция прошла', K.uvAlignIslands('left') === true);
      await wait(80);
      const a1 = boxOf(idA), b1 = boxOf(idB);
      ok('2.left  левые края сошлись', near(a1.minU, b1.minU) && near(a1.minU, gMin),
         a1.minU.toFixed(4) + ' / ' + b1.minU.toFixed(4) + ' цель ' + gMin.toFixed(4));
      ok('2.left  задающий край остров не двинулся',
         near(boxOf(anchor).minU, anchorBefore.minU) && near(boxOf(anchor).minV, anchorBefore.minV));
      ok('2.left  и размеры целы',
         near(a1.w, a0.w) && near(a1.h, a0.h) && near(b1.w, b0.w) && near(b1.h, b0.h),
         a0.w.toFixed(4) + 'x' + a0.h.toFixed(4) + ' -> ' + a1.w.toFixed(4) + 'x' + a1.h.toFixed(4));
      ok('2.left  по V ничего не поехало', near(a1.minV, a0.minV) && near(b1.minV, b0.minV));
      await undoIfStepped(atLeft);
    }
    mark('2');

    // ---------------------------------------------------------------- 3
    // Верх - это V, а не U: оси не перепутаны.
    {
      const isl = islands();
      const idA = +isl[0].dataset.island, idB = +isl[1].dataset.island;
      if (K.uvIslandSel.length !== 2) {
        await clearSel();
        tap(svg.querySelector('.uv-island[data-island="' + idA + '"]'), 711); await wait(520);
        tap(svg.querySelector('.uv-island[data-island="' + idB + '"]'), 712); await wait(520);
      }
      /* Свежая развёртка кладёт острова полками, так что верхние края у
         соседей часто уже совпадают - а выравнивать уже выровненное операция
         правомерно отказывается. Разводим их сами. */
      K.commitUvIslandTransform([idA], 0, 0.07 * 92, 0, 1, 50, 50);
      await wait(140);
      const a0 = boxOf(idA), b0 = boxOf(idB);
      ok('3.top   верхние края разошлись', !near(a0.maxV, b0.maxV),
         a0.maxV.toFixed(4) + ' vs ' + b0.maxV.toFixed(4));
      const gMax = Math.max(a0.maxV, b0.maxV);
      const atTop = A.historyIndex;
      ok('3.top   операция прошла', K.uvAlignIslands('top') === true);
      await wait(80);
      const a1 = boxOf(idA), b1 = boxOf(idB);
      ok('3.top   верхние края сошлись', near(a1.maxV, b1.maxV) && near(a1.maxV, gMax),
         a1.maxV.toFixed(4) + ' / ' + b1.maxV.toFixed(4) + ' цель ' + gMax.toFixed(4));
      ok('3.top   а по U не тронуто', near(a1.minU, a0.minU) && near(b1.minU, b0.minU));
      await undoIfStepped(atTop);
      await undoIfStepped(atTop - 1);   // и сам развод краёв
      ok('3.top   вид на месте', islands().length >= 2, 'n=' + islands().length);
    }
    mark('3');

    // ---------------------------------------------------------------- 4
    // Одного острова мало - операция отказывается и ничего не пишет.
    {
      await clearSel();
      ok('4.one   острова всё ещё нарисованы', islands().length >= 2,
         'n=' + islands().length + ' open=' + K.uvViewOpen +
         ' target=' + K.uvViewTarget + ' svg=' + svg.style.display +
         ' hist=' + A.historyIndex + '/' + A.history.length +
         ' mode=' + A.mode + ' uvkind=' + K.uvCompMode);
      if (!islands().length) { K.unwrapSelection(); await wait(160); }
      const isl = islands();
      if (!isl.length) { say('SKIP 4-7: вид пуст, дальше нечего проверять'); finish(); return; }
      tap(isl[0], 721); await wait(520);
      ok('4.one   выбран один', K.uvIslandSel.length === 1, JSON.stringify(K.uvIslandSel));
      const before = uvSnapshot();
      const at = A.historyIndex;
      ok('4.one   выравнивание отказалось', K.uvAlignIslands('left') === false);
      await wait(40);
      ok('4.one   UV не тронут', uvSame(before, uvSnapshot()));
      ok('4.one   и шага истории нет', A.historyIndex === at, at + ' -> ' + A.historyIndex);
    }
    mark('4');

    // ---------------------------------------------------------------- 5
    /* Pack собирает ВСЁ в 0..1 - даже то, что уехало на десятый тайл, - не
       потеряв ни острова и сохранив пропорции каждого. */
    {
      await clearSel();
      const isl = islands();
      const idA = +isl[0].dataset.island;
      const count = islands().length;
      // Уносим один остров далеко за квадрат.
      tap(isl[0], 731); await wait(520);
      K.commitUvIslandTransform([idA], 8 * 92, 0, 0, 1, 50, 50);
      await wait(140);
      const away = boxOf(idA);
      ok('5.pack  один остров уехал за квадрат', away.minU > 7, 'minU=' + away.minU.toFixed(3));
      const aspect0 = away.w / away.h;
      const at0 = A.historyIndex;
      ok('5.pack  Pack прошёл', K.uvPackAll() === true);
      await wait(140);
      // Всё в 0..1.
      const uv = obj().mesh.geometry.attributes.uv;
      let lo = Infinity, hi = -Infinity, bad = 0;
      for (let i = 0; i < uv.count; i++) {
        const u = uv.getX(i), v = uv.getY(i);
        if (!Number.isFinite(u) || !Number.isFinite(v)) { bad++; continue; }
        lo = Math.min(lo, u, v); hi = Math.max(hi, u, v);
      }
      ok('5.pack  нечисловых UV не появилось', bad === 0, 'bad=' + bad);
      ok('5.pack  всё уложилось в 0..1', lo >= -1e-6 && hi <= 1 + 1e-6,
         lo.toFixed(4) + '..' + hi.toFixed(4));
      ok('5.pack  островов столько же', islands().length === count,
         count + ' -> ' + islands().length);
      const after = boxOf(idA);
      ok('5.pack  и пропорции острова целы', near(after.w / after.h, aspect0, 1e-3),
         aspect0.toFixed(4) + ' -> ' + (after.w / after.h).toFixed(4));
      ok('5.pack  шаг истории ровно один', A.historyIndex === at0 + 1,
         at0 + ' -> ' + A.historyIndex);
      // И каждый остров непустой - то есть параллельные массивы не разъехались.
      let empty = 0;
      for (let i = 0; i < count; i++) {
        const b = boxOf(+islands()[i].dataset.island);
        if (!Number.isFinite(b.minU)) empty++;
      }
      ok('5.pack  ни один остров не потерялся', empty === 0, 'пустых=' + empty);
      K.undo(); await wait(160);
      K.undo(); await wait(160);
      ok('5.pack  Undo вернул уехавший остров на место',
         boxOf(idA).minU < 1, 'minU=' + boxOf(idA).minU.toFixed(3));
    }
    mark('5');

    // ---------------------------------------------------------------- 6
    // Pack не зависит от выбора - он про весь лист.
    {
      await clearSel();
      ok('6.all   выбор пуст', K.uvIslandSel.length === 0, JSON.stringify(K.uvIslandSel));
      const before = uvSnapshot();
      ok('6.all   и Pack всё равно работает', K.uvPackAll() === true);
      await wait(140);
      ok('6.all   раскладка изменилась', !uvSame(before, uvSnapshot()));
      K.undo(); await wait(160);
      ok('6.all   Undo вернул', uvSame(before, uvSnapshot(), 1e-6));
    }
    mark('6');

    // ---------------------------------------------------------------- 7
    // Выравнивание из чужого режима не действует.
    {
      K.setUvCompMode('vertex');
      await wait(60);
      const before = uvSnapshot();
      ok('7.mode  из vertex выравнивание отказалось', K.uvAlignIslands('left') === false);
      await wait(40);
      ok('7.mode  UV не тронут', uvSame(before, uvSnapshot()));
      K.setUvCompMode('island');
      await wait(60);
    }
    mark('7');

    // ---------------------------------------------------------------- 8
    /* Второй раз - не правка. И у Pack, и у выравнивания: pushHistory шаг,
       совпадающий с текущим документом, не пишет, а тост всё равно звучал -
       и следующий Undo забирал ЧУЖОЙ шаг. */
    {
      await clearSel();
      const at0 = A.historyIndex;
      ok('8.twice первый Pack прошёл', K.uvPackAll() === true);
      await wait(160);
      ok('8.twice и записал шаг', A.historyIndex === at0 + 1,
         at0 + ' -> ' + A.historyIndex);
      const at1 = A.historyIndex;
      const before = uvSnapshot();
      const second = K.uvPackAll();
      await wait(120);
      const now = uvSnapshot();
      let maxD = 0, nD = 0;
      for (let i = 0; i < before.length; i++) {
        const d = Math.abs(before[i] - now[i]);
        if (d > 0) { nD++; if (d > maxD) maxD = d; }
      }
      /* Второй Pack НЕ обязан быть пустым: зазор в shelfPack
         аддитивный и не масштабируется, а перенос строк считается
         по w*scale+gutter - после первой раскладки острова уже мельче,
         и полки могут лечь иначе. Проверяем то, что обещает гарантия:
         true ⇔ UV действительно сменились ⇔ в истории прибавился шаг.
         Именно расхождение этих трёх и съедало чужой Undo. */
      const moved = !uvSame(before, now);
      const stepped = A.historyIndex === at1 + 1;
      ok('8.twice второй Pack: ответ = факту', second === moved,
         'вернул ' + second + ', изменилось значений=' + nD +
         ' макс=' + maxD.toExponential(3));
      ok('8.twice второй Pack: шаг = факту', stepped === moved,
         at1 + ' -> ' + A.historyIndex + ', сдвинулось=' + moved);
      if (second) { K.undo(); await wait(160); }
      // Теперь то же для выравнивания: сразу после Pack полки делят края.
      const isl = islands();
      const idA = +isl[0].dataset.island, idB = +isl[1].dataset.island;
      tap(isl[0], 801); await wait(520);
      tap(svg.querySelector('.uv-island[data-island="' + idB + '"]'), 802); await wait(520);
      const at2 = A.historyIndex;
      const b0 = uvSnapshot();
      const first = K.uvAlignIslands('left');
      await wait(120);
      if (first) {
        ok('8.twice выравнивание записало шаг', A.historyIndex === at2 + 1,
           at2 + ' -> ' + A.historyIndex);
        const at3 = A.historyIndex;
        ok('8.twice повторное - отказ', K.uvAlignIslands('left') === false);
        await wait(120);
        ok('8.twice и без шага', A.historyIndex === at3);
      } else {
        // Края уже совпали - тогда отказ должен быть уже первым, и без шага.
        ok('8.twice уже выровнено - отказ без шага',
           A.historyIndex === at2 && uvSame(b0, uvSnapshot()));
      }
      K.undo(); await wait(160);
    }
    mark('8');

    // ---------------------------------------------------------------- 9
    /* Выравнивание отказывается, когда выделение достаёт за лист: иначе оно
       переносит край недосягаемого острова на все остальные. */
    {
      await clearSel();
      const isl = islands();
      const idA = +isl[0].dataset.island, idB = +isl[1].dataset.island;
      tap(isl[0], 811); await wait(520);
      tap(svg.querySelector('.uv-island[data-island="' + idB + '"]'), 812); await wait(520);
      ok('9.far   выбраны два', K.uvIslandSel.length === 2, JSON.stringify(K.uvIslandSel));
      // Уносим один за пределы досягаемости вида (u1 = 10.217).
      K.commitUvIslandTransform([idA], 12 * 92, 0, 0, 1, 50, 50);
      await wait(160);
      const R = K.udimReachUV();
      const far = boxOf(idA);
      ok('9.far   и один ушёл за лист', far.minU > R.u1,
         'minU=' + far.minU.toFixed(3) + ' предел ' + R.u1.toFixed(3));
      ok('9.far   выбор цел', K.uvIslandSel.length === 2, JSON.stringify(K.uvIslandSel));
      const before = uvSnapshot();
      const at = A.historyIndex;
      ok('9.far   выравнивание отказалось', K.uvAlignIslands('right') === false);
      await wait(80);
      ok('9.far   UV не тронут', uvSame(before, uvSnapshot()));
      ok('9.far   и шага нет', A.historyIndex === at);
      K.undo(); await wait(160);
      ok('9.far   Undo вернул остров', boxOf(idA).minU < R.u1);
    }
    mark('9');

    // ---------------------------------------------------------------- 10
    // Pack переносит ВСЁ, поэтому вид едет за ним; и места выравнивания
    // заштрихованы, когда выравнивать нечего.
    {
      await clearSel();
      // Отъезжаем в дальний угол листа, чтобы после Pack было что заметить.
      K.zoomUvViewBoxAt(0.1, 800, -700);
      await wait(40);
      const away = K.uvViewBoxNow;
      ok('10.view уехали от раскладки', away.x > 300, 'x=' + away.x.toFixed(1));
      ok('10.view Pack прошёл', K.uvPackAll() === true);
      await wait(180);
      const b = K.uvViewBoxNow;
      let held = 0;
      const all = islands();
      all.forEach(g => {
        const bb = g.getBBox();
        if (bb.x >= b.x - 1e-6 && bb.x + bb.width <= b.x + b.w + 1e-6 &&
            bb.y >= b.y - 1e-6 && bb.y + bb.height <= b.y + b.h + 1e-6) held++;
      });
      ok('10.view вид сам встал на раскладку', held === all.length,
         held + ' из ' + all.length + ' в кадре, box x ' + b.x.toFixed(1));
      K.undo(); await wait(160);

      // Штриховка мест выравнивания.
      await clearSel();
      const R = K.HUB_TOOLS_UV2D_ISLAND;
      const al = R.slice(4);
      ok('10.view у мест выравнивания есть enabled',
         al.every(t => typeof t.enabled === 'function'));
      ok('10.view без выбора они недоступны', al.every(t => t.enabled() === false));
      const isl2 = islands();
      tap(isl2[0], 821); await wait(520);
      ok('10.view с одним островом - тоже', al.every(t => t.enabled() === false),
         JSON.stringify(K.uvIslandSel));
      tap(svg.querySelector('.uv-island[data-island="' + (+isl2[1].dataset.island) + '"]'), 822);
      await wait(520);
      ok('10.view с двумя - доступны', al.every(t => t.enabled() === true),
         JSON.stringify(K.uvIslandSel));
      ok('10.view а трансформы доступны всегда',
         R.slice(0, 4).every(t => t.enabled === undefined));
    }
    mark('10');

    finish();
  }

  function boot() {
    K = window.__kubik;
    if (!K || !K.App || !K.uvPackAll || !K.HUB_TOOLS_WORLD) { setTimeout(boot, 120); return; }
    setTimeout(() => {
      run().catch(e => finish('THREW ' + (e && e.stack ? e.stack : e)));
    }, 500);
  }
  // Никакого window.load - урок v2.61.
  boot();
  setTimeout(() => { if (OUT.length === 0) finish('THREW boot timeout - __kubik не появился'); }, 110000);
})();
