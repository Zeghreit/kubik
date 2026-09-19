/* _uv68chk - точный масштаб как прилипающий щипок.

   Главное, что тут проверяется: щипок, который пальцами дал ×1.98, обязан и
   ПОКАЗАТЬ, и ЗАПИСАТЬ ровно ×2 - превью и коммит читают одно поле, и именно
   это делает их одним числом. Плюс: вне окна прилипания значение сырое и без
   дрожи, композиция двух щипков даёт точное произведение, поворот липнет к
   пятнадцати, и строка статуса гаснет, когда пальцы убраны. */
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
    bubbles: true, cancelable: true, pointerId: id, pointerType: 'touch',
    button: 0, buttons: type === 'pointerup' ? 0 : 1, clientX: x, clientY: y
  });
  function centreOf(el) {
    const bb = el.getBBox();
    const pt = svg.createSVGPoint();
    pt.x = bb.x + bb.width / 2; pt.y = bb.y + bb.height / 2;
    const p = pt.matrixTransform(svg.getScreenCTM());
    return { x: p.x, y: p.y };
  }
  function tap(el, id) {
    const c = centreOf(el);
    el.dispatchEvent(ev('pointerdown', c.x, c.y, id));
    svg.dispatchEvent(ev('pointerup', c.x, c.y, id));
  }
  let clearId = 700;
  async function clearSel() {
    if (K.toolRingActive) { K.closeToolRing(false); await wait(40); }
    const r = svg.getBoundingClientRect();
    const id = ++clearId;
    svg.dispatchEvent(ev('pointerdown', r.left + r.width / 2, r.top + r.height / 2, id));
    svg.dispatchEvent(ev('pointerup', r.left + r.width / 2, r.top + r.height / 2, id));
    await wait(520);
  }
  function uvSnapshot() {
    return Array.prototype.slice.call(obj().mesh.geometry.attributes.uv.array);
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
  function setUvs(arr) {
    const o = obj();
    const ed = K.toEditable(o.mesh);
    for (let i = 0; i < ed.uvs.length && i < arr.length; i++) ed.uvs[i] = arr[i];
    K.rebuildFromEditable(o, ed);
    K.refreshUvView(o);
  }
  const statusL = () => (document.getElementById('uvViewStatusL') || {}).textContent || '';

  /* ЩИПОК ПАЛЬЦАМИ. Первый палец садится на остров (это и вооружает островной
     щипок с v2.61), второй приходит рядом, а потом РАСХОДЯТСЯ до нужного
     отношения. Растягиваем строго по горизонтали, чтобы угол остался нулём,
     когда он нам не нужен. */
  async function pinch(islandEl, ratio, turnDeg) {
    const c = centreOf(islandEl);
    const id1 = 801, id2 = 802;
    const d0 = 120;               // стартовое расстояние между пальцами
    islandEl.dispatchEvent(ev('pointerdown', c.x - d0 / 2, c.y, id1));
    await wait(30);
    svg.dispatchEvent(ev('pointerdown', c.x + d0 / 2, c.y, id2));
    await wait(30);
    const d1 = d0 * ratio;
    const a = (turnDeg || 0) * Math.PI / 180;
    // Обе точки симметрично вокруг центра - тогда центр щипка не уезжает.
    const hx = Math.cos(a) * d1 / 2, hy = Math.sin(a) * d1 / 2;
    // Несколько шагов, как настоящий палец, а не один прыжок.
    for (let k = 1; k <= 4; k++) {
      const t = k / 4;
      const dd = d0 + (d1 - d0) * t;
      const aa = a * t;
      const gx = Math.cos(aa) * dd / 2, gy = Math.sin(aa) * dd / 2;
      svg.dispatchEvent(ev('pointermove', c.x - gx, c.y - gy, id1));
      svg.dispatchEvent(ev('pointermove', c.x + gx, c.y + gy, id2));
      await wait(25);
    }
    const live = { scale: K.uvPinchNow && K.uvPinchNow.scale, angle: K.uvPinchNow && K.uvPinchNow.angleDeg,
                   readout: K.uvPinchReadout, status: statusL() };
    svg.dispatchEvent(ev('pointerup', c.x + hx, c.y + hy, id2));
    await wait(30);
    svg.dispatchEvent(ev('pointerup', c.x - hx, c.y - hy, id1));
    await wait(220);
    return live;
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
    await wait(140);
    svg = document.getElementById('uvViewSvg');
    K.setUvCompMode('island');
    await wait(100);
    const islands = () => svg.querySelectorAll('.uv-island');
    ok('0.setup вид открыт', K.uvViewOpen && islands().length >= 2, 'islands=' + islands().length);
    ok('0.setup версия не ниже 2.68',
       parseFloat((((document.querySelector('.brand') || {}).textContent || '').match(/[\d.]+/) || [0])[0]) >= 2.68,
       (document.querySelector('.brand') || {}).textContent);
    ok('0.setup режим островов', K.uvCompMode === 'island', K.uvCompMode);
    mark('0');

    // ---------------------------------------------------------------- 1
    // Чистая арифметика прилипания, без единого пальца.
    {
      const S = K.UV_SNAP_SCALES;
      ok('1.table таблица есть', Array.isArray(S) && S.length >= 8, 'n=' + (S && S.length));
      /* ×⅛ и ×¼ убраны намеренно: полоса прилипания равна 0.06·t·startDist
         ПИКСЕЛЕЙ хода пальцев, то есть пропорциональна цели, и у ×⅛ она уже
         меньше половины пикселя - да и сами пальцы пришлось бы свести на шесть
         пикселей. Сжимать сильно нужно двумя щипками, и композиция как раз
         точная (раздел 4). */
      ok('1.table недостижимых целей нет', S.every(t => t.v >= 1 / 3 - 1e-9),
         'минимум=' + Math.min.apply(null, S.map(t => t.v)).toFixed(4));
      ok('1.table и ×⅓ на месте', S.some(t => Math.abs(t.v - 1 / 3) < 1e-9));
      ok('1.table значения возрастают',
         S.every((t, i) => i === 0 || t.v > S[i - 1].v), JSON.stringify(S.map(t => +t.v.toFixed(4))));
      ok('1.table у каждого подпись', S.every(t => typeof t.s === 'string' && t.s.length),
         JSON.stringify(S.map(t => t.s)));
      ok('1.table и подписи разные', new Set(S.map(t => t.s)).size === S.length);
      ok('1.table единица в таблице', S.some(t => t.v === 1));
      // Окна не перекрываются: иначе значение попадало бы в два прилипания.
      let overlap = 0;
      for (let i = 1; i < S.length; i++) {
        const hi = S[i - 1].v * (1 + K.UV_SNAP_SCALE_REL);
        const lo = S[i].v * (1 - K.UV_SNAP_SCALE_REL);
        if (hi >= lo) overlap++;
      }
      ok('1.table окна не перекрываются', overlap === 0, 'перекрытий=' + overlap);
      // Внутри окна - ровно цель; вне - ровно сырое.
      const a = K.snapUvScale(2 * (1 + K.UV_SNAP_SCALE_REL * 0.5));
      ok('1.table внутри окна липнет', a.snapped === true && a.value === 2,
         JSON.stringify(a));
      const b = K.snapUvScale(1.37);
      ok('1.table вне окна - сырое', b.snapped === false && b.value === 1.37,
         JSON.stringify(b));
      const c = K.snapUvScale(2 * (1 + K.UV_SNAP_SCALE_REL * 2));
      ok('1.table и рядом с окном не липнет', c.snapped === false, JSON.stringify(c));
      // Окно относительное: одинаково работает на обоих концах.
      // Оба конца ТЕПЕРЕШНЕЙ таблицы: ×⅛ и ×¼ из неё убраны намеренно.
      const loV = Math.min.apply(null, S.map(t => t.v));
      const hiV = Math.max.apply(null, S.map(t => t.v));
      const lo = K.snapUvScale(loV * 1.02), hi = K.snapUvScale(hiV * 1.02);
      ok('1.table окно относительное', lo.snapped && hi.snapped &&
         lo.value === loV && hi.value === hiV, JSON.stringify([lo.value, hi.value]));
      // Угол.
      const g1 = K.snapUvAngle(44);
      ok('1.table 44 липнет к 45', g1.snapped === true && g1.value === 45, JSON.stringify(g1));
      const g2 = K.snapUvAngle(38);
      ok('1.table 38 не липнет', g2.snapped === false && g2.value === 38, JSON.stringify(g2));
      const g3 = K.snapUvAngle(-89);
      ok('1.table и отрицательный тоже', g3.snapped === true && g3.value === -90, JSON.stringify(g3));
      ok('1.table нуль липнет к нулю', K.snapUvAngle(0.4).value === 0);
    }
    mark('1');

    // ---------------------------------------------------------------- 2
    /* САМОЕ ГЛАВНОЕ. Пальцы дают отношение внутри окна вокруг ×2 - и в UV
       должно оказаться РОВНО ×2, а не то, что дали пальцы. */
    {
      await clearSel();
      const isl = islands()[0];
      const id = +isl.dataset.island;
      tap(isl, 811); await wait(520);
      ok('2.exact остров выбран', K.uvIslandSel.length === 1, JSON.stringify(K.uvIslandSel));
      const before = boxOf(id);
      const at = A.historyIndex;
      const live = await pinch(svg.querySelector('.uv-island[data-island="' + id + '"]'),
                              2 * (1 + K.UV_SNAP_SCALE_REL * 0.5), 0);
      ok('2.exact щипок записал шаг', A.historyIndex === at + 1,
         at + ' -> ' + A.historyIndex);
      const after = boxOf(id);
      const k = after.w / before.w;
      ok('2.exact в UV оказалось РОВНО x2', Math.abs(k - 2) < 1e-4, 'k=' + k.toFixed(8));
      ok('2.exact и по V тоже', Math.abs(after.h / before.h - 2) < 1e-4,
         (after.h / before.h).toFixed(8));
      ok('2.exact превью показывало то же', Math.abs(live.scale - 2) < 1e-9,
         'live=' + live.scale);
      ok('2.exact строка статуса сказала snap', /snap/.test(live.status), JSON.stringify(live.status));
      ok('2.exact и назвала значение дробью', /×2/.test(live.status), JSON.stringify(live.status));
      ok('2.exact после отпускания строка вернулась',
         K.uvPinchReadout === null && /selected/.test(statusL()), JSON.stringify(statusL()));
      K.undo(); await wait(200);
      ok('2.exact Undo вернул размер', Math.abs(boxOf(id).w - before.w) < 1e-6);
    }
    mark('2');

    // ---------------------------------------------------------------- 3
    // Вне окна щипок остаётся честным: сколько дали пальцы, столько и записано.
    {
      await clearSel();
      const isl = islands()[0];
      const id = +isl.dataset.island;
      tap(isl, 821); await wait(520);
      const before = boxOf(id);
      const want = 1.37;
      const live = await pinch(svg.querySelector('.uv-island[data-island="' + id + '"]'), want, 0);
      const k = boxOf(id).w / before.w;
      ok('3.free  вне окна - сырое значение', Math.abs(k - want) < 5e-3,
         'k=' + k.toFixed(5) + ' хотели ' + want);
      ok('3.free  и строка без snap', !/snap/.test(live.status), JSON.stringify(live.status));
      ok('3.free  но значение показала', /×1\.3/.test(live.status), JSON.stringify(live.status));
      K.undo(); await wait(200);
    }
    mark('3');

    // ---------------------------------------------------------------- 4
    /* Композиция. Два щипка по ×2 обязаны дать РОВНО ×4 - именно за этим
       прилипание и нужно: без него две операции дают 3.9 или 4.1. */
    {
      await clearSel();
      const isl = islands()[0];
      const id = +isl.dataset.island;
      tap(isl, 831); await wait(520);
      const before = boxOf(id);
      const at = A.historyIndex;
      const sel = () => svg.querySelector('.uv-island[data-island="' + id + '"]');
      await pinch(sel(), 2 * (1 + K.UV_SNAP_SCALE_REL * 0.5), 0);
      ok('4.comp первый прошёл', A.historyIndex === at + 1);
      // Выделение остаётся после щипка - иначе второй щипок не вооружится.
      ok('4.comp выделение цело', K.uvIslandSel.length === 1, JSON.stringify(K.uvIslandSel));
      await pinch(sel(), 2 * (1 - K.UV_SNAP_SCALE_REL * 0.5), 0);
      ok('4.comp второй прошёл', A.historyIndex === at + 2, at + ' -> ' + A.historyIndex);
      const k = boxOf(id).w / before.w;
      ok('4.comp вместе РОВНО x4', Math.abs(k - 4) < 1e-3, 'k=' + k.toFixed(8));
      K.undo(); await wait(180);
      K.undo(); await wait(180);
      ok('4.comp два Undo вернули всё', Math.abs(boxOf(id).w - before.w) < 1e-6);
    }
    mark('4');

    // ---------------------------------------------------------------- 5
    /* Около единицы прилипание работает на то, что раньше было невозможно:
       повернуть остров, НЕ изменив его размера. */
    {
      await clearSel();
      const isl = islands()[0];
      const id = +isl.dataset.island;
      tap(isl, 841); await wait(520);
      const before = boxOf(id);
      const at = A.historyIndex;
      const live = await pinch(svg.querySelector('.uv-island[data-island="' + id + '"]'),
                               1 + K.UV_SNAP_SCALE_REL * 0.5, 45);
      ok('5.turn  превью показало x1', Math.abs(live.scale - 1) < 1e-9, 'live=' + live.scale);
      ok('5.turn  и угол 45', Math.abs(live.angle - 45) < 1e-9, 'angle=' + live.angle);
      ok('5.turn  строка назвала оба', /snap/.test(live.status) && /45/.test(live.status),
         JSON.stringify(live.status));
      ok('5.turn  шаг записан', A.historyIndex === at + 1, at + ' -> ' + A.historyIndex);
      // Поворот на 45 меняет коробку, но ПЛОЩАДЬ UV обязана остаться той же:
      // масштаба не было.
      const ed = K.toEditable(obj().mesh);
      const a1 = K.uvIslandAreas(obj(), ed)[id];
      K.undo(); await wait(200);
      const a0 = K.uvIslandAreas(obj(), K.toEditable(obj().mesh))[id];
      ok('5.turn  площадь UV не изменилась', Math.abs(a1.uv / a0.uv - 1) < 1e-3,
         (a1.uv / a0.uv).toFixed(6));
      ok('5.turn  Undo вернул коробку', Math.abs(boxOf(id).w - before.w) < 1e-6);
    }
    mark('5');

    // ---------------------------------------------------------------- 6
    // Отменённый щипок не оставляет ни цифры на строке, ни правки в UV.
    {
      await clearSel();
      const isl = islands()[0];
      const id = +isl.dataset.island;
      tap(isl, 851); await wait(520);
      const before = uvSnapshot();
      const at = A.historyIndex;
      const c = centreOf(svg.querySelector('.uv-island[data-island="' + id + '"]'));
      svg.querySelector('.uv-island[data-island="' + id + '"]')
         .dispatchEvent(ev('pointerdown', c.x - 60, c.y, 861));
      await wait(30);
      svg.dispatchEvent(ev('pointerdown', c.x + 60, c.y, 862));
      await wait(30);
      svg.dispatchEvent(ev('pointermove', c.x - 120, c.y, 861));
      svg.dispatchEvent(ev('pointermove', c.x + 120, c.y, 862));
      await wait(60);
      ok('6.cancel во время щипка цифра есть', K.uvPinchReadout !== null,
         JSON.stringify(K.uvPinchReadout));
      svg.dispatchEvent(new PointerEvent('pointercancel',
        { bubbles: true, pointerId: 862, pointerType: 'touch' }));
      svg.dispatchEvent(new PointerEvent('pointercancel',
        { bubbles: true, pointerId: 861, pointerType: 'touch' }));
      await wait(220);
      ok('6.cancel цифра убрана', K.uvPinchReadout === null, JSON.stringify(K.uvPinchReadout));
      ok('6.cancel строка снова про выбор', /selected/.test(statusL()), JSON.stringify(statusL()));
      let same = true;
      const now = uvSnapshot();
      for (let i = 0; i < before.length; i++) if (Math.abs(before[i] - now[i]) > 1e-9) { same = false; break; }
      ok('6.cancel UV не тронут', same);
      ok('6.cancel и шага нет', A.historyIndex === at, at + ' -> ' + A.historyIndex);
    }
    mark('6');

    // ---------------------------------------------------------------- 7
    // Щипок ВИДА не липнет: у зума нет точных значений, липнуть ему некуда.
    {
      await clearSel();
      const z0 = K.uvViewBoxNow.w;
      K.zoomUvViewBoxAt(2 * (1 + K.UV_SNAP_SCALE_REL * 0.5), 400, 400);
      await wait(60);
      const z1 = K.uvViewBoxNow.w;
      ok('7.view  зум вида не прилип', Math.abs(z0 / z1 - 2) > 1e-6,
         'было ' + z0.toFixed(4) + ' стало ' + z1.toFixed(4));
      ok('7.view  и цифры щипка на строке нет', K.uvPinchReadout === null);
      K.resetUvViewBox();
      await wait(60);
    }
    mark('7');

    // ---------------------------------------------------------------- 8
    /* Гистерезис. С одной жёсткой границей палец, стоящий рядом с ней и
       дрожащий на пиксель, пересекает её каждый кадр: остров прыгает на три
       процента туда-обратно, и телефон жужжит на каждом пересечении. Полоса, В
       КОТОРОЙ ЩИПОК УЖЕ НАХОДИТСЯ, шире. */
    {
      const R = K.UV_SNAP_SCALE_REL, E = K.UV_SNAP_EXIT;
      ok('8.hyst выход шире входа', E > 1, 'exit=' + E);
      // Значение чуть за обычной границей: без held не липнет, с held - липнет.
      const just = 2 * (1 + R * 1.3);
      ok('8.hyst без держания не липнет', K.snapUvScale(just, null).snapped === false,
         JSON.stringify(K.snapUvScale(just, null)));
      ok('8.hyst а с держанием липнет', K.snapUvScale(just, 2).snapped === true,
         JSON.stringify(K.snapUvScale(just, 2)));
      // Но не бесконечно: за широкой границей отпускает даже с held.
      const far = 2 * (1 + R * E * 1.2);
      ok('8.hyst за широкой границей отпускает',
         K.snapUvScale(far, 2).snapped === false, JSON.stringify(K.snapUvScale(far, 2)));
      // Держание ЧУЖОЙ цели не расширяет эту полосу.
      ok('8.hyst чужое держание не помогает',
         K.snapUvScale(just, 3).snapped === false, JSON.stringify(K.snapUvScale(just, 3)));
      // То же для угла.
      const jw = K.UV_SNAP_ANGLE_WIN;
      ok('8.hyst угол: без держания не липнет',
         K.snapUvAngle(15 + jw * 1.3, null).snapped === false);
      ok('8.hyst угол: с держанием липнет',
         K.snapUvAngle(15 + jw * 1.3, 15).snapped === true);
      ok('8.hyst угол: за широкой отпускает',
         K.snapUvAngle(15 + jw * E * 1.2, 15).snapped === false);
    }
    mark('8');

    // ---------------------------------------------------------------- 9
    /* Строка статуса обязана МОЛЧАТЬ, пока щипок ничего не сделал. Щипок
       начинается с масштаба 1 и угла 0, а нуль - это кратное пятнадцати, так
       что без явной проверки строка говорила "×1 snap" в тот момент, когда
       второй палец только коснулся стекла. */
    {
      await clearSel();
      const isl = islands()[0];
      const id = +isl.dataset.island;
      tap(isl, 871); await wait(520);
      const before = uvSnapshot();
      const at = A.historyIndex;
      const el = svg.querySelector('.uv-island[data-island="' + id + '"]');
      const c = centreOf(el);
      el.dispatchEvent(ev('pointerdown', c.x - 60, c.y, 881));
      await wait(30);
      svg.dispatchEvent(ev('pointerdown', c.x + 60, c.y, 882));
      await wait(40);
      ok('9.quiet щипок начался', K.uvPinchNow !== null);
      // Крошечное движение: внутри мёртвой зоны и по масштабу, и по углу.
      svg.dispatchEvent(ev('pointermove', c.x - 60.3, c.y, 881));
      svg.dispatchEvent(ev('pointermove', c.x + 60.3, c.y, 882));
      await wait(60);
      ok('9.quiet цифры ещё нет', K.uvPinchReadout === null,
         JSON.stringify(K.uvPinchReadout));
      ok('9.quiet строка про выбор', /selected/.test(statusL()), JSON.stringify(statusL()));
      // Теперь настоящее движение - цифра появляется.
      svg.dispatchEvent(ev('pointermove', c.x - 120, c.y, 881));
      svg.dispatchEvent(ev('pointermove', c.x + 120, c.y, 882));
      await wait(60);
      ok('9.quiet после движения цифра есть', K.uvPinchReadout !== null,
         JSON.stringify(K.uvPinchReadout));
      ok('9.quiet и это ×2 snap', /\u00d72 snap/.test(K.uvPinchReadout),
         JSON.stringify(K.uvPinchReadout));
      /* Вернулись почти в начало. Цифра ОСТАЁТСЯ - и это правка v2.68a: раньше
         она гасла, и самое заметное прилипание, какое есть у этой штуки
         (возврат к ×1, который двигает остров на три процента), оказывалось
         единственным без всякого отклика. Липкость на весь жест. */
      svg.dispatchEvent(ev('pointermove', c.x - 60.2, c.y, 881));
      svg.dispatchEvent(ev('pointermove', c.x + 60.2, c.y, 882));
      await wait(60);
      ok('9.quiet вернулись - цифра осталась', K.uvPinchReadout !== null,
         JSON.stringify(K.uvPinchReadout));
      ok('9.quiet и это ×1 snap', /\u00d71 snap/.test(K.uvPinchReadout),
         JSON.stringify(K.uvPinchReadout));
      svg.dispatchEvent(ev('pointerup', c.x + 60.2, c.y, 882));
      await wait(30);
      svg.dispatchEvent(ev('pointerup', c.x - 60.2, c.y, 881));
      await wait(220);
      // Щипок, вернувшийся к единице, не имеет права ничего записать.
      let same = true;
      const now = uvSnapshot();
      for (let i = 0; i < before.length; i++) if (Math.abs(before[i] - now[i]) > 1e-9) { same = false; break; }
      ok('9.quiet и ничего не записал', same && A.historyIndex === at,
         at + ' -> ' + A.historyIndex);
      ok('9.quiet выделение цело', K.uvIslandSel.length === 1, JSON.stringify(K.uvIslandSel));
    }
    mark('9');

    // ---------------------------------------------------------------- 10
    /* Жужжание - на ВХОДЕ в полосу, а не на выходе. Считаем вызовы vibrate,
       подменив его на время опыта: чистый щипок по масштабу держит угол внутри
       нулевой полосы всё время, и общий ключ из двух полей жужжал и на выходе
       из каждой полосы масштаба, и на самом первом кадре. */
    {
      await clearSel();
      const isl = islands()[0];
      const id = +isl.dataset.island;
      tap(isl, 891); await wait(520);
      const real = navigator.vibrate;
      let buzz = 0;
      try { navigator.vibrate = () => { buzz++; return true; }; } catch (e) {}
      const canSpy = navigator.vibrate !== real;
      ok('10.buzz подмена удалась', canSpy);
      const el = svg.querySelector('.uv-island[data-island="' + id + '"]');
      const c = centreOf(el);
      el.dispatchEvent(ev('pointerdown', c.x - 60, c.y, 901));
      await wait(30);
      svg.dispatchEvent(ev('pointerdown', c.x + 60, c.y, 902));
      await wait(40);
      ok('10.buzz на старте молчит', buzz === 0, 'buzz=' + buzz);
      // Проходим ×2 насквозь: вход - один щелчок, выход - ни одного.
      const step = async (half) => {
        svg.dispatchEvent(ev('pointermove', c.x - half, c.y, 901));
        svg.dispatchEvent(ev('pointermove', c.x + half, c.y, 902));
        await wait(40);
      };
      /* Пальцы двигаются ПО ОДНОМУ - так приходят и настоящие pointermove, по
         событию на палец - поэтому широкий развод проходит по дороге и через
         ×1½: от 60 до 118 первый кадр даёт 178/120 = 1.48 (полоса ×1½), второй
         236/120 = 1.97 (полоса ×2). Два щелчка тут ПРАВИЛЬНЫ: полос и вправду
         пройдено две. Проверять надо не их число, а то, что на выходе и внутри
         полосы щелчков нет - ниже. */
      await step(118);            // ×1.967 - внутри полосы ×2
      const afterIn = buzz;
      ok('10.buzz вход дал щелчок (одна-две полосы)', afterIn >= 1 && afterIn <= 2,
         'buzz=' + afterIn);
      await step(119);            // всё ещё внутри
      ok('10.buzz внутри молчит', buzz === afterIn, 'buzz=' + buzz);
      await step(160);            // ×2.67 - далеко за широкой границей
      ok('10.buzz выход молчит', buzz === afterIn, 'buzz=' + buzz);
      await step(180);            // ×3 - новая полоса
      ok('10.buzz новая полоса - новый щелчок', buzz === afterIn + 1, 'buzz=' + buzz);
      svg.dispatchEvent(ev('pointerup', c.x + 180, c.y, 902));
      await wait(30);
      svg.dispatchEvent(ev('pointerup', c.x - 180, c.y, 901));
      await wait(220);
      try { navigator.vibrate = real; } catch (e) {}
      K.undo(); await wait(200);
    }
    mark('10');

    // ---------------------------------------------------------------- 11
    /* Потеря захвата обязана ЗАКОНЧИТЬ жест. `uvDrag = null` живёт ровно в
       одном месте, в endUvDrag, поэтому захват, ушедший без pointerup и без
       pointercancel, раньше оставлял запись стоять навсегда - а стоящая запись
       не косметика: uvSecondPointer отвечает "занято" на КАЖДОЕ следующее
       нажатие, и в карточке больше нельзя ни выбрать, ни потащить, ни даже
       выйти в 3D. */
    {
      await clearSel();
      const isl = islands()[0];
      const id = +isl.dataset.island;
      tap(isl, 911); await wait(520);
      const before = uvSnapshot();
      const at = A.historyIndex;
      const el = svg.querySelector('.uv-island[data-island="' + id + '"]');
      const c = centreOf(el);
      el.dispatchEvent(ev('pointerdown', c.x - 60, c.y, 921));
      await wait(30);
      svg.dispatchEvent(ev('pointerdown', c.x + 60, c.y, 922));
      await wait(30);
      svg.dispatchEvent(ev('pointermove', c.x - 120, c.y, 921));
      svg.dispatchEvent(ev('pointermove', c.x + 120, c.y, 922));
      await wait(60);
      ok('11.lost щипок идёт', K.uvPinchNow !== null);
      ok('11.lost и цифра на строке', K.uvPinchReadout !== null);
      // Захват уходит - и ни одного pointerup/cancel вслед.
      svg.dispatchEvent(new PointerEvent('lostpointercapture',
        { bubbles: true, pointerId: 921, pointerType: 'touch' }));
      svg.dispatchEvent(new PointerEvent('lostpointercapture',
        { bubbles: true, pointerId: 922, pointerType: 'touch' }));
      await wait(160);
      ok('11.lost жест закончен', K.uvPinchNow === null);
      ok('11.lost цифра убрана', K.uvPinchReadout === null,
         JSON.stringify(K.uvPinchReadout));
      ok('11.lost строка про выбор', /selected/.test(statusL()), JSON.stringify(statusL()));
      // Отменён, а не записан: координаты перестали приходить.
      let same = true;
      const now = uvSnapshot();
      for (let i = 0; i < before.length; i++) if (Math.abs(before[i] - now[i]) > 1e-9) { same = false; break; }
      ok('11.lost UV не тронут', same);
      ok('11.lost и шага нет', A.historyIndex === at, at + ' -> ' + A.historyIndex);
      // И главное: карточка снова слушается.
      /* Требуем ДРУГОЙ остров, а не просто непустой выбор: прошлая версия этой
         проверки проходила ровно тогда, когда карточка никого не слушала - в
         выделении просто оставался прежний остров. */
      let other = -1;
      islands().forEach(g => { const v = +g.dataset.island; if (v !== id && other < 0) other = v; });
      ok('11.lost есть другой остров', other >= 0, 'other=' + other);
      tap(svg.querySelector('.uv-island[data-island="' + other + '"]'), 931);
      await wait(520);
      ok('11.lost вид снова живой', K.uvIslandSel.indexOf(other) >= 0,
         JSON.stringify(K.uvIslandSel) + ' ждали ' + other);
      ok('11.lost и очередь пальцев пуста', K.uvPointerCount === 0,
         'pointers=' + K.uvPointerCount);
    }
    mark('11');

    // ---------------------------------------------------------------- 12
    /* Строка обязана называть ВСЕ ТРИ части того, что запишется. endUvDrag
       решает по трём флагам, а цифра знала о двух: щипок, успевший до второго
       пальца протащить остров, оставлял строку со словами "1 selected", пока
       настоящий сдвиг уже был готов записаться. */
    {
      await clearSel();
      const isl = islands()[0];
      const id = +isl.dataset.island;
      tap(isl, 941); await wait(520);
      const before = boxOf(id);
      const at = A.historyIndex;
      const el = svg.querySelector('.uv-island[data-island="' + id + '"]');
      const c = centreOf(el);
      // Один палец тащит остров дальше, чем tap slop.
      el.dispatchEvent(ev('pointerdown', c.x, c.y, 951));
      await wait(30);
      svg.dispatchEvent(ev('pointermove', c.x + 40, c.y, 951));
      await wait(40);
      svg.dispatchEvent(ev('pointermove', c.x + 60, c.y, 951));
      await wait(40);
      // Теперь второй палец, и разводим РОВНО в полосу ×1: масштаба не будет.
      svg.dispatchEvent(ev('pointerdown', c.x + 120, c.y, 952));
      await wait(40);
      svg.dispatchEvent(ev('pointermove', c.x + 60.5, c.y, 951));
      svg.dispatchEvent(ev('pointermove', c.x + 120.5, c.y, 952));
      await wait(60);
      const live = K.uvPinchReadout;
      ok('12.moved цифра есть, а не молчание', live !== null, JSON.stringify(live));
      ok('12.moved и сказала про сдвиг', /moved/.test(live || ''), JSON.stringify(live));
      svg.dispatchEvent(ev('pointerup', c.x + 120.5, c.y, 952));
      await wait(30);
      svg.dispatchEvent(ev('pointerup', c.x + 60.5, c.y, 951));
      await wait(240);
      ok('12.moved и сдвиг действительно записан', A.historyIndex === at + 1,
         at + ' -> ' + A.historyIndex);
      const after = boxOf(id);
      ok('12.moved остров правда уехал', Math.abs(after.minU - before.minU) > 1e-4,
         before.minU.toFixed(5) + ' -> ' + after.minU.toFixed(5));
      ok('12.moved а размер цел', Math.abs(after.w / before.w - 1) < 1e-4,
         (after.w / before.w).toFixed(6));
      ok('12.moved цифра убрана', K.uvPinchReadout === null);
      if (A.historyIndex > at) { K.undo(); await wait(200); }
      ok('12.moved и Undo вернул остров', Math.abs(boxOf(id).minU - before.minU) < 1e-6,
         boxOf(id).minU.toFixed(6) + ' vs ' + before.minU.toFixed(6));
    }
    mark('12');

    // ---------------------------------------------------------------- 13
    // Жужжание ограничено по частоте: мотор не умеет сказать два раза за
    // десятую секунды, и быстрый развод через четыре полосы - это один рокот.
    {
      ok('13.rate предел есть', K.UV_SNAP_BUZZ_MS >= 50, 'ms=' + K.UV_SNAP_BUZZ_MS);
      await clearSel();
      const isl = islands()[0];
      const id = +isl.dataset.island;
      tap(isl, 961); await wait(520);
      const at13 = A.historyIndex;
      const real = navigator.vibrate;
      let buzz = 0;
      try { navigator.vibrate = () => { buzz++; return true; }; } catch (e) {}
      const el = svg.querySelector('.uv-island[data-island="' + id + '"]');
      const c = centreOf(el);
      el.dispatchEvent(ev('pointerdown', c.x - 60, c.y, 971));
      await wait(30);
      svg.dispatchEvent(ev('pointerdown', c.x + 60, c.y, 972));
      await wait(30);
      // Пролетаем ×1½, ×2, ×3, ×4 БЕЗ пауз - кадры подряд.
      for (const half of [90, 120, 180, 240]) {
        svg.dispatchEvent(ev('pointermove', c.x - half, c.y, 971));
        svg.dispatchEvent(ev('pointermove', c.x + half, c.y, 972));
      }
      await wait(60);
      ok('13.rate четыре полосы - не четыре щелчка', buzz <= 1, 'buzz=' + buzz);
      // После паузы следующая полоса снова имеет право щёлкнуть.
      await wait(K.UV_SNAP_BUZZ_MS + 60);
      const b0 = buzz;
      svg.dispatchEvent(ev('pointermove', c.x - 480, c.y, 971));
      svg.dispatchEvent(ev('pointermove', c.x + 480, c.y, 972));
      await wait(60);
      ok('13.rate после паузы щелчок снова можно', buzz === b0 + 1, 'buzz=' + buzz);
      svg.dispatchEvent(ev('pointerup', c.x + 480, c.y, 972));
      await wait(30);
      svg.dispatchEvent(ev('pointerup', c.x - 480, c.y, 971));
      await wait(240);
      try { navigator.vibrate = real; } catch (e) {}
      if (A.historyIndex > at13) { K.undo(); await wait(200); }
      ok('13.rate вид цел', islands().length >= 2, 'islands=' + islands().length);
    }
    mark('13');

    // ---------------------------------------------------------------- 14
    /* Кольцо, чей палец уже убран, не имеет права дальше съедать нажатия.
       Именно эта ветка превращала незакрывшееся кольцо в МЁРТВОЕ приложение:
       uvSecondPointer отвечает "занято" на каждое нажатие в карточке, и
       вернуться в 3D тоже нечем. Причина самого незакрытия пока не найдена -
       эта проверка про то, что цена ошибки должна быть одно касание, а не
       перезагрузка. */
    {
      await clearSel();
      const isl = islands()[0];
      const id = +isl.dataset.island;
      // Кольцо с пальцем, которого нет: ровно то состояние, в котором телефон
      // остаётся, чем бы оно ни было вызвано.
      K.bloomToolRing(200, 300, K.HUB_TOOLS_UV2D_WORLD, 999999, null);
      await wait(120);
      ok('14.stuck кольцо открыто', !!K.toolRingActive);
      /* Первое нажатие ЗАКРЫВАЕТ кольцо и на этом свою работу заканчивает -
         ровно так же ведёт себя холст со вторым пальцем. Оно не выделяет: это
         нажатие-отмена. Второе уже работает, и вот этого раньше не было
         вообще. */
      tap(isl, 991);
      await wait(560);
      ok('14.stuck первое нажатие закрыло кольцо', !K.toolRingActive);
      ok('14.stuck и ничего не выделило', K.uvIslandSel.length === 0,
         JSON.stringify(K.uvIslandSel));
      ok('14.stuck и не осело в очереди', K.uvPointerCount === 0,
         'pointers=' + K.uvPointerCount);
      tap(isl, 992);
      await wait(560);
      ok('14.stuck второе - работает', K.uvIslandSel.indexOf(id) >= 0,
         JSON.stringify(K.uvIslandSel) + ' ждали ' + id);
      ok('14.stuck кольцо не вернулось', !K.toolRingActive);
    }
    mark('14');

    finish();
  }

  function boot() {
    K = window.__kubik;
    if (!K || !K.App || !K.snapUvScale || !K.snapUvAngle || !K.UV_SNAP_SCALES) { setTimeout(boot, 120); return; }
    setTimeout(() => {
      run().catch(e => finish('THREW ' + (e && e.stack ? e.stack : e)));
    }, 500);
  }
  // Никакого window.load - урок v2.61.
  boot();
  setTimeout(() => { if (OUT.length === 0) finish('THREW boot timeout - __kubik не появился'); }, 110000);
})();
