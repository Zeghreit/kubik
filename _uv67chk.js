/* _uv67chk - раскладка part 2: ровная плотность и растяжение в квадрат.

   Главные инварианты: плотность = sqrt(uvArea/worldArea) и после Even density
   она одинакова у ВСЕХ островов; растяжение - ОДНА аффинная карта на весь
   лист, поэтому союзная коробка ровно заполняет квадрат, а отношение ширин
   двух островов не меняется. */
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

  const ev = (type, x, y, id) => new PointerEvent(type, {
    bubbles: true, cancelable: true, pointerId: id, pointerType: 'mouse',
    button: 0, buttons: type === 'pointerup' ? 0 : 1, clientX: x, clientY: y
  });
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
  async function undoIfStepped(at) {
    if (A.historyIndex > at) { K.undo(); await wait(200); }
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
  /* Записать UV без шага истории: finishMeshEdit наружу не выставлен, да и
     подготовка состояния для проверки - не правка, которую стоит помнить.
     Значит и разбирать её надо этой же функцией по снимку, а не Undo. */
  function setUvs(arr) {
    const o = obj();
    const ed = K.toEditable(o.mesh);
    for (let i = 0; i < ed.uvs.length && i < arr.length; i++) ed.uvs[i] = arr[i];
    K.rebuildFromEditable(o, ed);
    K.refreshUvView(o);
  }
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
  function allBox() {
    const uv = obj().mesh.geometry.attributes.uv.array;
    let minU = Infinity, minV = Infinity, maxU = -Infinity, maxV = -Infinity;
    for (let i = 0; i < uv.length; i += 2) {
      const u = uv[i], v = uv[i + 1];
      if (!Number.isFinite(u) || !Number.isFinite(v)) continue;
      if (u < minU) minU = u;
      if (u > maxU) maxU = u;
      if (v < minV) minV = v;
      if (v > maxV) maxV = v;
    }
    return { minU, minV, maxU, maxV, w: maxU - minU, h: maxV - minV };
  }
  // Плотности прямо из приложения, но по СВЕЖЕМУ editable - чтобы мерить то,
  // что лежит в геометрии сейчас, а не то, что было до операции.
  function densities() {
    const o = obj();
    const ed = K.toEditable(o.mesh);
    const a = K.uvIslandAreas(o, ed);
    return a.map(r => r.density);
  }
  function live(ds) { return ds.filter(d => d > 0); }
  function spread(ds) {
    const L = live(ds);
    if (L.length < 2) return 1;
    return Math.max.apply(null, L) / Math.min.apply(null, L);
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
    ok('0.setup версия не ниже 2.67',
       parseFloat((((document.querySelector('.brand') || {}).textContent || '').match(/[\d.]+/) || [0])[0]) >= 2.67,
       (document.querySelector('.brand') || {}).textContent);
    mark('0');

    // ---------------------------------------------------------------- 1
    // Места в кольце пустого места и их глифы.
    {
      const W = K.HUB_TOOLS_UV2D_WORLD;
      const d = seat(W, 'uvdensity'), q = seat(W, 'uvsquare');
      ok('1.ring  Even density на месте 3', !!d && d.seat === 3, d && d.seat);
      ok('1.ring  Stretch на месте 4', !!q && q.seat === 4, q && q.seat);
      ok('1.ring  ни одно место не занято дважды',
         new Set(W.map(t => t.seat)).size === W.length,
         JSON.stringify(W.map(t => t.seat)));
      ok('1.ring  мест не больше восьми', W.length <= 8, 'n=' + W.length);
      const glyphs = W.map(t => K.ICON[t.icon]);
      ok('1.ring  у каждого глиф есть', glyphs.every(g => typeof g === 'string' && g.length > 10),
         JSON.stringify(W.map(t => t.icon)));
      ok('1.ring  и все глифы разные', new Set(glyphs).size === glyphs.length);
      ok('1.ring  оба доступны без выбора',
         d.enabled === undefined && q.enabled === undefined);
      // В 3D эти места не появляются.
      ok('1.ring  в 3D кольце их нет',
         !seat(K.HUB_TOOLS_WORLD, 'uvdensity') && !seat(K.HUB_TOOLS_WORLD, 'uvsquare'));
    }
    mark('1');

    // ---------------------------------------------------------------- 2
    /* Сама мера. density = sqrt(uv/world), поэтому равномерный масштаб UV в
       k раз обязан умножить плотность на k, а мировую площадь не тронуть. */
    {
      await clearSel();
      const o2 = obj();
      const ed = K.toEditable(o2.mesh);
      const a0 = K.uvIslandAreas(o2, ed);
      const idx = a0.findIndex(r => r.density > 0);
      ok('2.area  есть остров с площадью', idx >= 0);
      const r0 = a0[idx];
      ok('2.area  мировая площадь положительна', r0.world > 0, 'world=' + r0.world.toExponential(3));
      ok('2.area  и UV площадь тоже', r0.uv > 0, 'uv=' + r0.uv.toExponential(3));
      ok('2.area  density = sqrt(uv/world)',
         Math.abs(r0.density - Math.sqrt(r0.uv / r0.world)) < 1e-12,
         r0.density.toFixed(6));
      ok('2.area  треугольники посчитаны', r0.tris >= 1, 'tris=' + r0.tris);
      // Масштабируем ОДИН остров вдвое и смотрим на обе площади.
      const at = A.historyIndex;
      K.commitUvIslandTransform([idx], 0, 0, 0, 2, 50, 50);
      await wait(180);
      const o3 = obj();
      const a1 = K.uvIslandAreas(o3, K.toEditable(o3.mesh));
      ok('2.area  мировая площадь не изменилась',
         Math.abs(a1[idx].world - r0.world) < 1e-5 * Math.max(1, r0.world),
         r0.world.toExponential(4) + ' -> ' + a1[idx].world.toExponential(4));
      ok('2.area  UV площадь выросла вчетверо',
         Math.abs(a1[idx].uv / r0.uv - 4) < 1e-3,
         (a1[idx].uv / r0.uv).toFixed(5));
      ok('2.area  а плотность - вдвое',
         Math.abs(a1[idx].density / r0.density - 2) < 1e-4,
         (a1[idx].density / r0.density).toFixed(6));
      // Остальные острова не тронуты.
      let others = 0;
      for (let i = 0; i < a0.length; i++) {
        if (i === idx) continue;
        if (Math.abs(a1[i].density - a0[i].density) > 1e-9) others++;
      }
      ok('2.area  и чужие плотности целы', others === 0, 'сдвинулось ' + others);
      await undoIfStepped(at);
    }
    mark('2');

    // ---------------------------------------------------------------- 3
    /* Even density. Сначала намеренно портим лист - один остров вдвое, другой
       вполовину - и смотрим, что операция сводит разброс к единице. */
    {
      await clearSel();
      const d0 = densities();
      const idl = [];
      for (let i = 0; i < d0.length; i++) if (d0[i] > 0) idl.push(i);
      ok('3.even  островов хотя бы три', idl.length >= 3, 'n=' + idl.length);
      const at = A.historyIndex;
      K.commitUvIslandTransform([idl[0]], 0, 0, 0, 2.5, 50, 50);
      await wait(140);
      K.commitUvIslandTransform([idl[1]], 0, 0, 0, 0.4, 50, 50);
      await wait(140);
      const dBad = densities();
      ok('3.even  разброс испорчен', spread(dBad) > 3, 'spread=' + spread(dBad).toFixed(3));
      const nBefore = live(dBad).length;
      ok('3.even  операция прошла', K.uvEvenDensity() === true);
      await wait(220);
      const dOk = densities();
      ok('3.even  плотность стала одинаковой', spread(dOk) - 1 < 1e-4,
         'spread=' + spread(dOk).toFixed(8));
      ok('3.even  ни один остров не потерян', live(dOk).length === nBefore,
         nBefore + ' -> ' + live(dOk).length);
      ok('3.even  чисел без NaN', dOk.every(x => Number.isFinite(x)));
      // Pack в конце: всё внутри 0..1.
      const B = allBox();
      ok('3.even  и всё внутри 0..1',
         B.minU >= -1e-6 && B.maxU <= 1 + 1e-6 && B.minV >= -1e-6 && B.maxV <= 1 + 1e-6,
         B.minU.toFixed(4) + '..' + B.maxU.toFixed(4) + ' / ' +
         B.minV.toFixed(4) + '..' + B.maxV.toFixed(4));
      ok('3.even  записан один шаг', A.historyIndex === at + 3,
         at + ' -> ' + A.historyIndex);
      // Повтор: плотность уже ровная, поэтому ответ/движение/шаг должны
      // совпасть друг с другом - тот же инвариант, что у Pack в v2.66.
      const at2 = A.historyIndex;
      const before = uvSnapshot();
      const again = K.uvEvenDensity();
      await wait(180);
      const moved = !uvSame(before, uvSnapshot());
      ok('3.even  повтор: ответ = факту', again === moved,
         'вернул ' + again + ', сдвинулось ' + moved);
      ok('3.even  повтор: шаг = факту', (A.historyIndex === at2 + 1) === moved,
         at2 + ' -> ' + A.historyIndex);
      ok('3.even  и плотность всё ещё ровная', spread(densities()) - 1 < 1e-4,
         spread(densities()).toFixed(8));
      if (again) { K.undo(); await wait(200); }
      // Разбираем всё, что набросали.
      while (A.historyIndex > at) { K.undo(); await wait(160); }
      ok('3.even  Undo вернул разброс', Math.abs(spread(densities()) - spread(d0)) < 1e-3,
         spread(densities()).toFixed(4) + ' vs ' + spread(d0).toFixed(4));
    }
    mark('3');

    // ---------------------------------------------------------------- 4
    /* Stretch to square. Союзная коробка ровно заполняет квадрат с отступом
       упаковщика, и это ОДНА карта: отношение ширин двух островов цело. */
    {
      await clearSel();
      const d0 = densities();
      const idl = [];
      for (let i = 0; i < d0.length; i++) if (d0[i] > 0) idl.push(i);
      const at = A.historyIndex;
      // Делаем лист заведомо неквадратным: сжимаем ВСЁ по V.
      const base4 = uvSnapshot();
      {
        const sq = base4.slice();
        for (let i = 1; i < sq.length; i += 2) sq[i] = 0.5 + (sq[i] - 0.5) * 0.25;
        setUvs(sq);
        await wait(200);
      }
      const B0 = allBox();
      ok('4.sq    лист неквадратный', B0.w / B0.h > 2, (B0.w / B0.h).toFixed(3));
      const r0 = boxOf(idl[0]).w / boxOf(idl[1]).w;
      ok('4.sq    операция прошла', K.uvStretchToSquare() === true);
      await wait(220);
      const B = allBox();
      const g = 0.015;
      ok('4.sq    коробка заполнила квадрат',
         Math.abs(B.minU - g) < 1e-5 && Math.abs(B.maxU - (1 - g)) < 1e-5 &&
         Math.abs(B.minV - g) < 1e-5 && Math.abs(B.maxV - (1 - g)) < 1e-5,
         B.minU.toFixed(5) + '..' + B.maxU.toFixed(5) + ' / ' +
         B.minV.toFixed(5) + '..' + B.maxV.toFixed(5));
      ok('4.sq    и она квадратная', Math.abs(B.w - B.h) < 1e-5,
         B.w.toFixed(6) + ' x ' + B.h.toFixed(6));
      const r1 = boxOf(idl[0]).w / boxOf(idl[1]).w;
      ok('4.sq    одна карта: отношение ширин цело', Math.abs(r1 / r0 - 1) < 1e-4,
         r0.toFixed(6) + ' -> ' + r1.toFixed(6));
      // Подготовка (сжатие по V) шага не пишет, так что шаг тут ровно один.
      ok('4.sq    записан один шаг', A.historyIndex === at + 1,
         at + ' -> ' + A.historyIndex);
      // Повтор: уже заполнено - ответ, движение и шаг согласны.
      const at2 = A.historyIndex;
      const before = uvSnapshot();
      const again = K.uvStretchToSquare();
      await wait(180);
      const moved = !uvSame(before, uvSnapshot());
      ok('4.sq    повтор: ответ = факту', again === moved,
         'вернул ' + again + ', сдвинулось ' + moved);
      ok('4.sq    повтор: шаг = факту', (A.historyIndex === at2 + 1) === moved,
         at2 + ' -> ' + A.historyIndex);
      if (again) { K.undo(); await wait(200); }
      while (A.historyIndex > at) { K.undo(); await wait(160); }
      setUvs(base4); await wait(160);
      ok('4.sq    лист восстановлен', uvSame(base4, uvSnapshot(), 1e-6));
    }
    mark('4');

    // ---------------------------------------------------------------- 5
    /* Вырожденный лист. Все UV в одной точке - растягивать нечего, и это
       должен быть отказ, а не деление на ноль. */
    {
      await clearSel();
      const at = A.historyIndex;
      const base5 = uvSnapshot();
      {
        setUvs(base5.map(() => 0.5));
        await wait(200);
      }
      const B = allBox();
      ok('5.degen лист - точка', B.w === 0 && B.h === 0, B.w + ' x ' + B.h);
      const before = uvSnapshot();
      const at1 = A.historyIndex;
      ok('5.degen растяжение отказалось', K.uvStretchToSquare() === false);
      await wait(120);
      ok('5.degen UV не тронут', uvSame(before, uvSnapshot()));
      ok('5.degen и шага нет', A.historyIndex === at1, at1 + ' -> ' + A.historyIndex);
      // Even density: площадь UV нулевая у всех, значит мерить нечего.
      ok('5.degen плотность мерить нечем', K.uvEvenDensity() === false);
      await wait(120);
      ok('5.degen UV по-прежнему цел', uvSame(before, uvSnapshot()));
      ok('5.degen и тут шага нет', A.historyIndex === at1);
      ok('5.degen без NaN в геометрии',
         Array.prototype.every.call(obj().mesh.geometry.attributes.uv.array, Number.isFinite));
      while (A.historyIndex > at) { K.undo(); await wait(160); }
      setUvs(base5); await wait(160);
      ok('5.degen лист восстановлен', uvSame(base5, uvSnapshot(), 1e-6));
    }
    mark('5');

    // ---------------------------------------------------------------- 6
    /* Один остров схлопнут, остальные целы: его плотность не измерить, но он
       обязан попасть в упаковку, а не исчезнуть. */
    {
      await clearSel();
      const at = A.historyIndex;
      const d0 = densities();
      const idl = [];
      for (let i = 0; i < d0.length; i++) if (d0[i] > 0) idl.push(i);
      const victim = idl[0];
      const base6 = uvSnapshot();
      {
        const o6 = obj();
        const { attrIsland } = K.islandVertexMap(o6);
        const c = base6.slice();
        for (let ai = 0; ai < attrIsland.length; ai++) {
          if (attrIsland[ai] !== victim) continue;
          c[ai * 2] = 0.2; c[ai * 2 + 1] = 0.2;
        }
        setUvs(c);
        await wait(200);
      }
      const dBad = densities();
      ok('6.one   остров схлопнут', dBad[victim] === 0, 'd=' + dBad[victim]);
      const nLive = live(dBad).length;
      ok('6.one   но остальные живы', nLive === idl.length - 1,
         nLive + ' из ' + idl.length);
      ok('6.one   операция прошла', K.uvEvenDensity() === true);
      await wait(220);
      const dOk = densities();
      ok('6.one   живые выровнялись', spread(dOk) - 1 < 1e-4, spread(dOk).toFixed(8));
      ok('6.one   схлопнутый так и остался точкой', dOk[victim] === 0);
      const vb = boxOf(victim);
      ok('6.one   но он на листе, а не потерян',
         Number.isFinite(vb.minU) && vb.minU >= -1e-6 && vb.maxU <= 1 + 1e-6 &&
         vb.minV >= -1e-6 && vb.maxV <= 1 + 1e-6,
         vb.minU.toFixed(4) + ',' + vb.minV.toFixed(4));
      ok('6.one   и без NaN',
         Array.prototype.every.call(obj().mesh.geometry.attributes.uv.array, Number.isFinite));
      while (A.historyIndex > at) { K.undo(); await wait(160); }
      setUvs(base6); await wait(160);
      ok('6.one   лист восстановлен', uvSame(base6, uvSnapshot(), 1e-6));
    }
    mark('6');

    // ---------------------------------------------------------------- 7
    // Обе операции двигают ВЕСЬ лист, поэтому вид обязан встать на него сам.
    {
      await clearSel();
      const at = A.historyIndex;
      const inFrame = () => {
        const b = K.uvViewBoxNow;
        let held = 0;
        const all = islands();
        all.forEach(gEl => {
          const bb = gEl.getBBox();
          if (bb.x >= b.x - 1e-6 && bb.x + bb.width <= b.x + b.w + 1e-6 &&
              bb.y >= b.y - 1e-6 && bb.y + bb.height <= b.y + b.h + 1e-6) held++;
        });
        return held + '/' + all.length;
      };
      K.zoomUvViewBoxAt(0.1, 800, -700);
      await wait(40);
      ok('7.view  уехали от раскладки', K.uvViewBoxNow.x > 300,
         'x=' + K.uvViewBoxNow.x.toFixed(1));
      ok('7.view  Even density прошёл', K.uvEvenDensity() === true);
      await wait(220);
      let f = inFrame();
      ok('7.view  вид встал на раскладку', f === f.split('/')[1] + '/' + f.split('/')[1], f);
      K.zoomUvViewBoxAt(0.1, 800, -700);
      await wait(40);
      ok('7.view  снова уехали', K.uvViewBoxNow.x > 300);
      ok('7.view  Stretch прошёл', K.uvStretchToSquare() === true);
      await wait(220);
      f = inFrame();
      ok('7.view  и вид опять на месте', f === f.split('/')[1] + '/' + f.split('/')[1], f);
      while (A.historyIndex > at) { K.undo(); await wait(160); }
    }
    mark('7');

    // ---------------------------------------------------------------- 8
    // Вне 2D вида ни одна из них не работает: uvViewObj - их единственная цель.
    {
      const at = A.historyIndex;
      const before = uvSnapshot();
      K.closeUvView();
      await wait(160);
      ok('8.out   вид закрыт', !K.uvViewOpen);
      ok('8.out   Even density отказался', K.uvEvenDensity() === false);
      ok('8.out   Stretch отказался', K.uvStretchToSquare() === false);
      await wait(120);
      ok('8.out   UV не тронут', uvSame(before, uvSnapshot()));
      ok('8.out   и шага нет', A.historyIndex === at, at + ' -> ' + A.historyIndex);
    }
    mark('8');

    // ---------------------------------------------------------------- 9
    /* БЛОКЕР прошлого прогона. Остров, чьи UV лежат на ПРЯМОЙ, даёт площадь не
       нуль, а шум float32 - плотность около 1e-4, масштаб около тысячи, и
       упаковщик после этого подгоняет лист под него, а все настоящие острова
       уезжают в миллионную долю тайла. Тост при этом читается как успех.
       Теперь это ловит проверка ФОРМЫ: какую долю своей же коробки остров
       закрывает. */
    {
      // Вид мог закрыться в разделе 8 - открываем заново.
      if (!K.uvViewOpen) { seat(K.HUB_TOOLS_WORLD, 'addgeo').run(); await wait(160); }
      svg = document.getElementById('uvViewSvg');
      // Выделение виновника имеет смысл только в режиме островов - говорим это
      // вслух, а не надеемся на состояние, оставшееся от прошлого раздела.
      K.setUvCompMode('island');
      await wait(120);
      ok('9.line  режим островов', K.uvCompMode === 'island', K.uvCompMode);
      await clearSel();
      const base = uvSnapshot();
      const at = A.historyIndex;
      const o9 = obj();
      const { attrIsland } = K.islandVertexMap(o9);
      const d0 = densities();
      let victim = -1;
      for (let i = 0; i < d0.length; i++) if (d0[i] > 0) { victim = i; break; }
      // Кладём остров на прямую НЕ по диагонали: точно нулевого векторного
      // произведения в float32 там не получается - ровно в этом и был подвох.
      {
        const c = base.slice();
        let t = 0;
        for (let ai = 0; ai < attrIsland.length; ai++) {
          if (attrIsland[ai] !== victim) continue;
          const p = 0.1 + 0.2 * (t++);
          c[ai * 2] = p; c[ai * 2 + 1] = 0.2 + 0.7 * p;
        }
        setUvs(c);
        await wait(200);
      }
      const A9 = K.uvIslandAreas(obj(), K.toEditable(obj().mesh));
      /* Вот он, весь подвох: площадь НЕ нуль, а шум - поэтому плотность
         измеряется, и всякая проверка формы острова его пропускает. Ловить
         надо не остров, а ИСХОД. */
      ok('9.line  UV площадь - шум, а не нуль', A9[victim].uv > 0 && A9[victim].uv < 1e-6,
         'uv=' + A9[victim].uv.toExponential(3));
      ok('9.line  и плотность измеряется', A9[victim].density > 0,
         'd=' + A9[victim].density.toExponential(3));
      ok('9.line  разброс огромный', spread(A9.map(r => r.density)) > 100,
         'spread=' + spread(A9.map(r => r.density)).toExponential(3));
      const before = uvSnapshot();
      const at1 = A.historyIndex;
      ok('9.line  операция отказалась', K.uvEvenDensity() === false);
      // СРАЗУ, без ожидания: если выделение виновника кто-то потом сбрасывает,
      // надо знать, поставили ли его вообще.
      const selNow = K.uvIslandSel.slice();
      await wait(200);
      const selLater = K.uvIslandSel.slice();
      ok('9.line  виновник выделен сразу', selNow.length === 1 && selNow[0] === victim,
         JSON.stringify(selNow) + ' vs ' + victim);
      ok('9.line  и выделение не сбросили', selLater.length === selNow.length,
         JSON.stringify(selLater));
      ok('9.line  и лист не тронут', uvSame(before, uvSnapshot()));
      ok('9.line  и шага нет', A.historyIndex === at1, at1 + ' -> ' + A.historyIndex);
      const t9 = (document.getElementById('toast') || {}).textContent || '';
      ok('9.line  тост говорит про разрешение', /resolution/i.test(t9), JSON.stringify(t9));

      while (A.historyIndex > at) { K.undo(); await wait(160); }
      setUvs(base); await wait(160);
    }
    mark('9');

    // ---------------------------------------------------------------- 10
    /* Плотность мерится в МИРОВОМ пространстве. Неравномерный масштаб объекта
       (инспектор ставит x, y, z независимо) - это ровно тот случай, где
       локальные площади дают ровный лист и неровную текстуру на модели. */
    {
      await clearSel();
      const o10 = obj();
      const s0 = o10.mesh.scale.clone();
      const edL = K.toEditable(o10.mesh);
      const aBefore = K.uvIslandAreas(o10, edL).map(r => r.world);
      o10.mesh.scale.set(1, 1, 5);
      o10.mesh.updateMatrixWorld(true);
      const aAfter = K.uvIslandAreas(o10, K.toEditable(o10.mesh)).map(r => r.world);
      let grew = 0, same = 0;
      for (let i = 0; i < aBefore.length; i++) {
        if (aBefore[i] <= 0) continue;
        const k = aAfter[i] / aBefore[i];
        if (Math.abs(k - 5) < 1e-4) grew++;
        else if (Math.abs(k - 1) < 1e-4) same++;
      }
      ok('10.world масштаб объекта виден в площадях', grew >= 1 && same >= 1,
         'выросло вчетверо-впятеро: ' + grew + ', не изменилось: ' + same);
      // И выравнивание теперь целится в мировую плотность: длинные стороны
      // обязаны получить БОЛЬШЕ UV, чем крышки.
      const at = A.historyIndex;
      ok('10.world операция прошла', K.uvEvenDensity() === true);
      await wait(240);
      const dW = densities();
      ok('10.world мировая плотность ровная', spread(dW) - 1 < 1e-4, spread(dW).toFixed(8));
      // Локальная при этом обязана быть НЕровной - иначе ничего не изменилось.
      const o10b = obj();
      const keep = o10b.mesh.scale.clone();
      o10b.mesh.scale.set(1, 1, 1);
      o10b.mesh.updateMatrixWorld(true);
      const dL = K.uvIslandAreas(o10b, K.toEditable(o10b.mesh)).map(r => r.density);
      o10b.mesh.scale.copy(keep);
      o10b.mesh.updateMatrixWorld(true);
      ok('10.world а локальная - нет', spread(dL) > 1.5, spread(dL).toFixed(4));
      while (A.historyIndex > at) { K.undo(); await wait(160); }
      obj().mesh.scale.copy(s0);
      obj().mesh.updateMatrixWorld(true);
      await wait(80);
    }
    mark('10');

    // ---------------------------------------------------------------- 11
    /* NaN в UV: операция, которая его не трогает, не имеет права сообщать о
       правке - pushHistory такой шаг выбрасывает, и следующий Undo забирает
       ЧУЖОЙ. Сравнение NaN с NaN должно говорить "не изменилось". */
    {
      await clearSel();
      const base = uvSnapshot();
      const at = A.historyIndex;
      // Сначала честно вписываем лист в квадрат, потом портим ОДНУ пару.
      ok('11.nan  лист вписан', K.uvStretchToSquare() === true);
      await wait(240);
      const at1 = A.historyIndex;
      {
        const cur = uvSnapshot();
        cur[0] = NaN; cur[1] = NaN;
        setUvs(cur);
        await wait(200);
      }
      const uvNow = obj().mesh.geometry.attributes.uv.array;
      ok('11.nan  NaN на месте', Number.isNaN(uvNow[0]));
      const before = uvSnapshot();
      const again = K.uvStretchToSquare();
      await wait(180);
      const nowArr = uvSnapshot();
      let moved = false;
      for (let i = 0; i < before.length; i++) {
        if (Number.isNaN(before[i]) && Number.isNaN(nowArr[i])) continue;
        if (Math.abs(before[i] - nowArr[i]) > 1e-9) { moved = true; break; }
      }
      ok('11.nan  ответ = факту', again === moved,
         'вернул ' + again + ', сдвинулось ' + moved);
      ok('11.nan  шаг = факту', (A.historyIndex === at1 + 1) === moved,
         at1 + ' -> ' + A.historyIndex);
      // И прямая проверка самого сравнения.
      ok('11.nan  NaN равен NaN для сторожа',
         K.uvsChangedAsStored([NaN, 0.5], [NaN, 0.5]) === false);
      ok('11.nan  а настоящая правка видна',
         K.uvsChangedAsStored([NaN, 0.5], [NaN, 0.25]) === true);
      while (A.historyIndex > at) { K.undo(); await wait(160); }
      setUvs(base); await wait(160);
    }
    mark('11');

    // ---------------------------------------------------------------- 12
    /* Растяжение теперь отказывается ДО записи: карта не идеально
       идемпотентна, поэтому сторож после дела почти никогда не срабатывал, а
       второе нажатие писало шаг из одного ulp шума. */
    {
      await clearSel();
      const base = uvSnapshot();
      const at = A.historyIndex;
      ok('12.idem первое прошло', K.uvStretchToSquare() === true);
      await wait(240);
      const at1 = A.historyIndex;
      const before = uvSnapshot();
      ok('12.idem второе отказалось', K.uvStretchToSquare() === false);
      await wait(140);
      ok('12.idem UV не тронут', uvSame(before, uvSnapshot()));
      ok('12.idem и шага нет', A.historyIndex === at1, at1 + ' -> ' + A.historyIndex);
      ok('12.idem третье тоже', K.uvStretchToSquare() === false);
      await wait(120);
      ok('12.idem и всё ещё без шага', A.historyIndex === at1);
      while (A.historyIndex > at) { K.undo(); await wait(160); }
      setUvs(base); await wait(160);
    }
    mark('12');

    // ---------------------------------------------------------------- 13
    /* Обратная сторона раздела 9, и она важнее, чем кажется: остров, сжатый
       РАВНОМЕРНО в двести раз, выравнивается без всякой платы - его просто
       возвращают к нужному размеру, и лист от этого не теряет ничего. Первая
       версия этой проверки ждала отказа и была неправа: отказываться тут
       нельзя, иначе операция ругается на совершенно нормальную раскладку.
       Платит лист только за РАСТЯНУТЫЙ остров (раздел 9), чья форма не может
       впитать нужный масштаб. И честная подпись, когда выравнивать нечего. */
    {
      await clearSel();
      const base = uvSnapshot();
      const at = A.historyIndex;
      ok('13.cap  предел есть', K.UV_DENSITY_MAX_LOSS >= 2,
         'loss=' + K.UV_DENSITY_MAX_LOSS);
      const o13 = obj();
      const { attrIsland } = K.islandVertexMap(o13);
      const d0 = densities();
      let victim = -1;
      for (let i = 0; i < d0.length; i++) if (d0[i] > 0) { victim = i; break; }
      // Сжимаем один остров так, чтобы он остался КВАДРАТНЫМ (форма цела,
      // значит проверка формы его не отсеет) и при этом плотность упала
      // сильнее предела.
      /* Остров остаётся КВАДРАТНЫМ - никакая проверка формы к нему не
         придерётся - но его плотность падает настолько, что выравнивание
         пришлось бы оплачивать разрешением всего листа. */
      {
        const c = base.slice();
        const b = boxOf(victim);
        const cu = (b.minU + b.maxU) / 2, cv = (b.minV + b.maxV) / 2;
        const k = 1 / 200;
        for (let ai = 0; ai < attrIsland.length; ai++) {
          if (attrIsland[ai] !== victim) continue;
          c[ai * 2] = cu + (c[ai * 2] - cu) * k;
          c[ai * 2 + 1] = cv + (c[ai * 2 + 1] - cv) * k;
        }
        setUvs(c);
        await wait(200);
      }
      const A13 = K.uvIslandAreas(obj(), K.toEditable(obj().mesh));
      ok('13.cap  остров не выродился', A13[victim].uv > 0 && A13[victim].tris >= 1,
         'uv=' + A13[victim].uv.toExponential(3) + ' tris=' + A13[victim].tris);
      ok('13.cap  но плотность далеко', A13[victim].density > 0 &&
         spread(A13.map(r => r.density)) > 100,
         'spread=' + spread(A13.map(r => r.density)).toExponential(3));
      const at1 = A.historyIndex;
      ok('13.cap  операция прошла, а не отказалась', K.uvEvenDensity() === true);
      await wait(240);
      ok('13.cap  и записала шаг', A.historyIndex === at1 + 1,
         at1 + ' -> ' + A.historyIndex);
      ok('13.cap  плотность выровнялась', spread(densities()) - 1 < 1e-4,
         spread(densities()).toFixed(8));
      const B13 = allBox();
      ok('13.cap  лист цел и в 0..1',
         B13.minU >= -1e-6 && B13.maxU <= 1 + 1e-6 &&
         B13.minV >= -1e-6 && B13.maxV <= 1 + 1e-6 && B13.w > 0.5,
         B13.minU.toFixed(4) + '..' + B13.maxU.toFixed(4));
      const t13 = (document.getElementById('toast') || {}).textContent || '';
      ok('13.cap  и подпись назвала разброс', /200|199|201/.test(t13), JSON.stringify(t13));
      while (A.historyIndex > at) { K.undo(); await wait(160); }
      setUvs(base); await wait(160);
      // Честная подпись на уже ровном листе: это Pack, а не "было 1.00x off".
      await clearSel();
      const at2 = A.historyIndex;
      /* Подпись читаем с ТОСТА, а не из истории: finishMeshEdit пишет её туда,
         и именно её видит человек. Первый прогон этой проверки достал из
         history пустую строку и поэтому не проверял ничего. */
      const toastEl = document.getElementById('toast');
      ok('13.cap  тост есть', !!toastEl);
      ok('13.cap  на ровном листе прошло', K.uvEvenDensity() === true);
      await wait(240);
      const label = (toastEl && toastEl.textContent) || '';
      ok('13.cap  подпись непустая', label.length > 3, JSON.stringify(label));
      ok('13.cap  и не врёт про 1.00x', label.indexOf('1.00') < 0, JSON.stringify(label));
      ok('13.cap  а говорит, что это перекладка',
         /repack/i.test(label), JSON.stringify(label));
      while (A.historyIndex > at2) { K.undo(); await wait(160); }
    }
    mark('13');

    // ---------------------------------------------------------------- 14
    /* Остров, у которого НИ ОДИН треугольник не измеряется - NaN в UV центра
       веера - раньше молча считался вырожденным и выпадал из операции. Теперь
       он посчитан и назван в подписи. */
    {
      await clearSel();
      const base = uvSnapshot();
      const at = A.historyIndex;
      const o14 = obj();
      const { attrIsland } = K.islandVertexMap(o14);
      const d0 = densities();
      let victim = -1;
      for (let i = 0; i < d0.length; i++) if (d0[i] > 0) { victim = i; break; }
      {
        const c = base.slice();
        for (let ai = 0; ai < attrIsland.length; ai++) {
          if (attrIsland[ai] !== victim) continue;
          c[ai * 2] = NaN; c[ai * 2 + 1] = NaN;
        }
        setUvs(c);
        await wait(200);
      }
      const A14 = K.uvIslandAreas(obj(), K.toEditable(obj().mesh));
      ok('14.brk  треугольники пропущены', A14[victim].skipped >= 1,
         'skipped=' + A14[victim].skipped + ' tris=' + A14[victim].tris);
      ok('14.brk  и остров назван сломанным', A14[victim].broken === true);
      ok('14.brk  а не просто плоским', A14[victim].density === 0);
      ok('14.brk  операция прошла', K.uvEvenDensity() === true);
      await wait(240);
      const t14 = (document.getElementById('toast') || {}).textContent || '';
      ok('14.brk  подпись сказала про UV', /unusable UV/i.test(t14), JSON.stringify(t14));
      ok('14.brk  живые выровнялись', spread(densities()) - 1 < 1e-4,
         spread(densities()).toFixed(8));
      while (A.historyIndex > at) { K.undo(); await wait(160); }
      setUvs(base); await wait(160);
    }
    mark('14');

    // ---------------------------------------------------------------- 15
    /* Растяжение мерит коробку по ОСТРОВАМ. Вершина, не принадлежащая ни
       одному, не имеет права раздувать союзную коробку - иначе видимая
       раскладка не заполнит квадрат, о котором операция отчиталась. */
    {
      await clearSel();
      const map = K.islandVertexMap(obj());
      let loose = 0;
      for (let ai = 0; ai < map.attrIsland.length; ai++) {
        if (map.attrIsland[ai] < 0) loose++;
      }
      // На меше, собранном приложением, бесхозных вершин быть не должно -
      // тогда проверяем то, что можно: коробка по островам = коробка по всему.
      const base = uvSnapshot();
      const at = A.historyIndex;
      ok('15.loose бесхозных вершин нет', loose === 0, 'loose=' + loose);
      ok('15.loose операция прошла', K.uvStretchToSquare() === true);
      await wait(240);
      // Коробка ПО ОСТРОВАМ обязана лечь ровно в цель.
      let mnU = Infinity, mxU = -Infinity, mnV = Infinity, mxV = -Infinity;
      const uvA = obj().mesh.geometry.attributes.uv;
      const m2 = K.islandVertexMap(obj());
      for (let ai = 0; ai < m2.attrIsland.length; ai++) {
        if (m2.attrIsland[ai] < 0) continue;
        const u = uvA.getX(ai), v = uvA.getY(ai);
        if (!Number.isFinite(u) || !Number.isFinite(v)) continue;
        if (u < mnU) mnU = u;
        if (u > mxU) mxU = u;
        if (v < mnV) mnV = v;
        if (v > mxV) mxV = v;
      }
      ok('15.loose коробка островов в цели',
         Math.abs(mnU - 0.015) < 1e-5 && Math.abs(mxU - 0.985) < 1e-5 &&
         Math.abs(mnV - 0.015) < 1e-5 && Math.abs(mxV - 0.985) < 1e-5,
         mnU.toFixed(5) + '..' + mxU.toFixed(5) + ' / ' +
         mnV.toFixed(5) + '..' + mxV.toFixed(5));
      while (A.historyIndex > at) { K.undo(); await wait(160); }
      setUvs(base); await wait(160);
    }
    mark('15');

    finish();
  }

  function boot() {
    K = window.__kubik;
    if (!K || !K.App || !K.uvEvenDensity || !K.uvStretchToSquare || !K.uvIslandAreas) { setTimeout(boot, 120); return; }
    setTimeout(() => {
      run().catch(e => finish('THREW ' + (e && e.stack ? e.stack : e)));
    }, 500);
  }
  // Никакого window.load - урок v2.61.
  boot();
  setTimeout(() => { if (OUT.length === 0) finish('THREW boot timeout - __kubik не появился'); }, 110000);
})();
