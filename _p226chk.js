/* _p226chk - v2.26: три мелочи с немедленной отдачей.

   Все три - про стоимость кадра, и у каждой есть способ испортить
   корректность, а не только скорость:

     - кэш прямоугольника вьюпорта: устаревший прямоугольник - это не медленно,
       это СДВИНУТЫЙ пик, каждый тап в пикселях мимо пальца;
     - гейт карты wear: если два теста флага разойдутся, список рёбер будет
       построен из пустой карты, и маска Edges перестанет рисовать;
     - рост габаритов вместо пересчёта: сфера, которая перестала содержать меш,
       заставляет рендерер ОТСЕЧЬ объект посреди драга - он исчезает.

   Поэтому замеры здесь есть, но главное - инварианты. */
(function () {
  const OUT = [];
  let fails = 0;
  const say = s => OUT.push(s);
  const ok = (name, cond, detail) => {
    if (!cond) fails++;
    say((cond ? 'PASS ' : 'FAIL ') + name + (detail === undefined ? '' : '  ' + detail));
  };
  const note = (name, detail) => say('   .. ' + name + '  ' + detail);
  const post = (p, b) => { try { const x = new XMLHttpRequest(); x.open('POST', p, true); x.send(b); } catch (e) {} };
  const mark = s => post('/mark', 'at: ' + s + '\n' + OUT.join('\n'));
  function finish(extra) {
    if (extra) { say(extra); fails++; }
    say('VERDICT=' + (fails ? 'FAIL' : 'PASS') + ' (' + fails + ' failed)');
    post('/done', OUT.join('\n'));
  }

  let K = null;
  const V = (x, y, z) => new K.THREE.Vector3(x, y, z);

  function clearScene() {
    K.App.objects.slice().forEach(o => { try { o.mesh.parent.remove(o.mesh); } catch (e) {} });
    K.App.objects.length = 0;
    K.App.selectedObjectIds = new Set();
    K.App.activeObjectId = null;
    K.App.hidden.clear();
    K.App.mode = 'object';
    K.App.selectedElements.clear();
  }
  function mkCube(name, x, y, z) {
    const ed = K.buildPrimitiveEditable('cube', {});
    const mats = K.makeMaterialSet(ed.groups.length || 1, 0x9aa3b2);
    return K.createObjectFromEditable(name, V(x || 0, y || 0, z || 0), ed, mats, {});
  }
  const geoOf = (o) => o.mesh.geometry;

  function triangulatedGrid(n, bulge) {
    const positions = [], groups = [];
    const h = 2 / n;
    const at = (ix, iy) => {
      const x = -1 + ix * h, y = -1 + iy * h;
      return [x, y, (bulge || 0) * (x * x + y * y)];
    };
    const push = (a, b, c) => {
      const base = positions.length / 3;
      [a, b, c].forEach(p => positions.push(p[0], p[1], p[2]));
      groups.push({ triangles: [[base, base + 1, base + 2]] });
    };
    for (let iy = 0; iy < n; iy++) {
      for (let ix = 0; ix < n; ix++) {
        const p00 = at(ix, iy), p10 = at(ix + 1, iy);
        const p11 = at(ix + 1, iy + 1), p01 = at(ix, iy + 1);
        push(p00, p10, p11);
        push(p00, p11, p01);
      }
    }
    return { positions: positions, groups: groups, triCount: groups.length };
  }

  // Нормали, как строка, чтобы сравнивать затенение байт в байт.
  const normalsOf = (o) => {
    const n = geoOf(o).attributes.normal;
    if (!n) return 'none';
    const a = n.array;
    let h = '';
    for (let i = 0; i < a.length; i++) h += Math.round(a[i] * 1e5) + ',';
    return h;
  };

  /* ИНВАРИАНТ, ИЗ-ЗА КОТОРОГО ОБЪЕКТ НЕ ИСЧЕЗАЕТ: сфера обязана СОДЕРЖАТЬ
     каждую вершину. Рендерер отсекает по ней, так что сфера меньше меша - это
     пропавшая модель, а больше - всего лишь осторожное отсечение. */
  function sphereContainsAll(o) {
    const g = geoOf(o);
    if (!g.boundingSphere) return 'нет сферы';
    const c = g.boundingSphere.center, r = g.boundingSphere.radius + 1e-4;
    const a = g.attributes.position.array;
    const p = new K.THREE.Vector3();
    let worst = 0;
    for (let i = 0; i < a.length; i += 3) {
      p.set(a[i], a[i + 1], a[i + 2]);
      const d = c.distanceTo(p);
      if (d > worst) worst = d;
    }
    return worst <= r ? true : ('вершина в ' + worst.toFixed(4) + ' при радиусе ' + r.toFixed(4));
  }
  function boxContainsAll(o) {
    const g = geoOf(o);
    if (!g.boundingBox) return 'нет бокса';
    const a = g.attributes.position.array;
    const p = new K.THREE.Vector3();
    for (let i = 0; i < a.length; i += 3) {
      p.set(a[i], a[i + 1], a[i + 2]);
      if (!g.boundingBox.containsPoint(p)) return 'вершина вне бокса: ' + p.toArray();
    }
    return true;
  }

  async function run() {
    K = window.__kubik;
    if (!K) { finish('__kubik is undefined - приложение не поднялось'); return; }
    ok('0.boot   новые функции экспортированы',
       typeof K.viewportRect === 'function' && typeof K.growBounds === 'function');
    if (typeof K.viewportRect !== 'function') { finish(); return; }

    /* 1 -- ОДНО ЧТЕНИЕ ЛЭЙАУТА НА КАДР. Считаем настоящие вызовы
       getBoundingClientRect, подменив их на счётчик: это прямой замер того,
       что правка обещает, а не косвенный. */
    clearScene();
    const g1 = triangulatedGrid(30, 0.22);
    K.landImport([{ name: 'G', ed: g1, triCount: g1.triCount }], 'G');
    const o1 = K.App.objects[0];
    K.App.activeObjectId = o1.id;
    K.setMode('vertex');
    K.ensureHelpers(o1);
    K.focusOnAll();
    K.camera.updateMatrixWorld();

    const realRect = Element.prototype.getBoundingClientRect;
    let rectCalls = 0;
    Element.prototype.getBoundingClientRect = function () {
      rectCalls++;
      return realRect.apply(this, arguments);
    };
    const rr = realRect.call(K.canvasEl);
    const taps = [];
    for (let i = 1; i <= 5; i++) {
      for (let j = 1; j <= 5; j++) {
        taps.push({ clientX: rr.left + rr.width * (0.25 + 0.5 * i / 6),
                    clientY: rr.top + rr.height * (0.25 + 0.5 * j / 6),
                    pointerType: 'touch', pointerId: 1, button: 0 });
      }
    }
    // Кэш сброшен ровно один раз, как это делает кадр.
    K.invalidateViewportRect();
    rectCalls = 0;
    taps.forEach(t => { K.pickVertexOnActive(t); });
    const cachedCalls = rectCalls;

    // И то же самое без кэша: сбрасываем перед каждым тапом, что равносильно
    // чтению на каждый вызов.
    rectCalls = 0;
    taps.forEach(t => {
      K.invalidateViewportRect();
      K.pickVertexOnActive(t);
    });
    const perTapCalls = rectCalls;
    Element.prototype.getBoundingClientRect = realRect;

    /* ЧЕСТНАЯ АРИФМЕТИКА. До v2.26 прямоугольник читался на КАЖДЫЙ вызов
       worldToScreenPx, а свип по вершинам зовёт его по разу на логическую
       вершину - так что цена одного свипа была не «один раз», а N. Вторая
       цифра ниже - это сброс на каждый ТАП, то есть нижняя граница прежнего
       поведения, а не оно само. */
    const lv = (o1.mesh.userData.topo && o1.mesh.userData.topo.logicalCount) || 0;
    note('1.layout', taps.length + ' свипов по ' + lv + ' логических вершин: ' +
         cachedCalls + ' чтений лэйаута всего с кэшем за кадр. До v2.26 читалось ' +
         'на каждый вызов worldToScreenPx, то есть порядка ' + (taps.length * lv) +
         ' (сброс на каждый тап даёт ' + perTapCalls + ' - нижняя граница).');
    ok('1.layout  кэш переживает свип - одно чтение, а не по вызову',
       cachedCalls <= 2, 'чтений=' + cachedCalls);
    ok('1.layout  и сброс правда работает - без него чтений больше',
       perTapCalls > cachedCalls, perTapCalls + ' > ' + cachedCalls);

    // И ГЛАВНОЕ: кэш не врёт. Тот же прямоугольник, что вернул бы браузер.
    const fresh = realRect.call(K.viewportEl || document.getElementById('viewport'));
    const cached = K.viewportRect();
    ok('1.layout  кэшированный прямоугольник совпадает с настоящим',
       !!fresh && Math.abs(fresh.width - cached.width) < 0.01 &&
       Math.abs(fresh.height - cached.height) < 0.01 &&
       Math.abs(fresh.left - cached.left) < 0.01 &&
       Math.abs(fresh.top - cached.top) < 0.01,
       'cached=' + [cached.left, cached.top, cached.width, cached.height].map(v => Math.round(v)).join(',') +
       ' fresh=' + (fresh ? [fresh.left, fresh.top, fresh.width, fresh.height].map(v => Math.round(v)).join(',') : '-'));

    // И пики те же, что при чтении на каждый вызов.
    const withCache = taps.map(t => K.pickVertexOnActive(t)).join(',');
    const withoutCache = taps.map(t => { K.invalidateViewportRect(); return K.pickVertexOnActive(t); }).join(',');
    const someHit = withCache.split(',').filter(x => x !== '-1' && x !== 'null' && x !== '').length;
    ok('1.layout  тапы попадают - сравнение не пустое', someHit >= 10, 'попаданий ' + someHit);
    ok('1.layout  и пик с кэшем - ТОТ ЖЕ пик, что без него',
       withCache === withoutCache, 'cached=' + withCache.slice(0, 60) +
       ' fresh=' + withoutCache.slice(0, 60));
    mark('1.layout');

    /* 2 -- КАРТА WEAR. Два теста одного флага обязаны согласоваться: если
       разойдутся, список рёбер построится из пустой карты и маска Edges
       перестанет рисовать, молча. */
    clearScene();
    const cube = mkCube('C');
    // Сначала как есть: флага ещё никто не ставил, значит "да".
    cube.mesh.userData.wantsWear = undefined;
    K.applyShading(cube);
    const wearOn = geoOf(cube).userData.kubikEdges;
    const normOn = normalsOf(cube);
    ok('2.wear   undefined значит ДА - список построен',
       !!wearOn && wearOn.pos && wearOn.pos.length > 0,
       'рёбер=' + (wearOn && wearOn.pos ? wearOn.pos.length / 6 : 0));

    cube.mesh.userData.wantsWear = false;
    K.applyShading(cube);
    ok('2.wear   с false список не строится', !geoOf(cube).userData.kubikEdges);
    ok('2.wear   а ЗАТЕНЕНИЕ байт в байт то же - гейт не трогает нормали',
       normalsOf(cube) === normOn);

    cube.mesh.userData.wantsWear = true;
    K.applyShading(cube);
    const wearBack = geoOf(cube).userData.kubikEdges;
    ok('2.wear   и с true список возвращается тем же',
       !!wearBack && wearBack.pos.length === wearOn.pos.length &&
       Array.from(wearBack.kind).join(',') === Array.from(wearOn.kind).join(','),
       'было ' + (wearOn.pos.length / 6) + ' рёбер, стало ' +
       (wearBack ? wearBack.pos.length / 6 : 0));

    /* И с КРЕЙСАМИ, потому что крейс читается только для wear - если этот
       lookup загейтить не тем флагом, крейс перестанет быть ребром формы. */
    K.ensureHelpers(cube);
    const topoC = cube.mesh.userData.topo;
    const creases = K.creaseSet(cube);
    // topo.edges is an ARRAY of [a, b] logical pairs, not a Map of records.
    const someEdge = (topoC && topoC.edges && topoC.edges.length) ? topoC.edges[0] : null;
    if (someEdge) {
      // Ставим крейс на реальное ребро через тот же ключ, что строит приложение.
      const pa = geoOf(cube).attributes.position;
      const A = new K.THREE.Vector3().fromBufferAttribute(pa, topoC.logicalGroups[someEdge[0]][0]);
      const B = new K.THREE.Vector3().fromBufferAttribute(pa, topoC.logicalGroups[someEdge[1]][0]);
      creases[K.creaseKeyFor(A, B)] = true;
      cube.mesh.userData.wantsWear = true;
      K.applyShading(cube);
      const withCrease = geoOf(cube).userData.kubikEdges;
      ok('2.wear   крейс по-прежнему попадает в список рёбер формы',
         !!withCrease && withCrease.pos.length >= wearOn.pos.length,
         'рёбер с крейсом=' + (withCrease ? withCrease.pos.length / 6 : 0) +
         ' было ' + (wearOn.pos.length / 6));
      delete creases[K.creaseKeyFor(A, B)];
    }
    mark('2.wear');

    /* 3 -- ГАБАРИТЫ. Инвариант: сфера СОДЕРЖИТ каждую вершину на каждом кадре
       драга. Сфера меньше меша - это пропавшая модель. */
    clearScene();
    const g3 = triangulatedGrid(40, 0.22);
    K.landImport([{ name: 'H', ed: g3, triCount: g3.triCount }], 'H');
    const o3 = K.App.objects[0];
    K.App.activeObjectId = o3.id;
    K.setMode('vertex');
    K.ensureHelpers(o3);
    const topo3 = o3.mesh.userData.topo;
    K.App.selectedElements.clear();
    for (let i = 0; i < 8 && i < topo3.logicalCount; i++) K.App.selectedElements.add(i);
    K.refreshUI();
    K.focusOnAll();
    K.camera.updateMatrixWorld();

    const r0 = geoOf(o3).boundingSphere ? geoOf(o3).boundingSphere.radius : 0;
    const rect3 = K.canvasEl.getBoundingClientRect();
    const began = K.beginDirectDrag({ clientX: rect3.left + rect3.width / 2,
                                      clientY: rect3.top + rect3.height / 2,
                                      pointerId: 1, pointerType: 'touch', button: 0 });
    ok('3.bounds драг начался', began !== false, 'began=' + began);

    // Тащим выделение далеко наружу, кадр за кадром, как это делает палец.
    let worstSphere = true, worstBox = true;
    for (let f = 1; f <= 6; f++) {
      const m = new K.THREE.Matrix4().makeTranslation(0, 0, f * 1.5);
      K.applyDeltaToSelection(m);
      const sc = sphereContainsAll(o3);
      const bc = boxContainsAll(o3);
      if (sc !== true) { worstSphere = sc; note('3.diag', 'кадр ' + f + ' сфера: ' + sc); }
      if (bc !== true) {
        worstBox = bc;
        const g = geoOf(o3);
        // Сам посчитаем бокс по всем вершинам и сравним с тем, что в геометрии.
        const mine = new K.THREE.Box3().setFromBufferAttribute(g.attributes.position);
        note('3.diag', 'кадр ' + f + ' бокс в геометрии min=' +
             g.boundingBox.min.toArray().map(v => v.toFixed(3)).join(',') +
             ' max=' + g.boundingBox.max.toArray().map(v => v.toFixed(3)).join(','));
        note('3.diag', 'кадр ' + f + ' честный бокс      min=' +
             mine.min.toArray().map(v => v.toFixed(3)).join(',') +
             ' max=' + mine.max.toArray().map(v => v.toFixed(3)).join(','));
        // Двигается ли вообще эта вершина? Сколько их в выделении и в контексте.
        note('3.diag', 'выделено логических ' + K.App.selectedElements.size +
             ', записей в драге ' + (K.dragCtxPeek ? K.dragCtxPeek().entries.length : '?'));
      }
    }
    ok('3.bounds сфера содержит каждую вершину на КАЖДОМ кадре драга',
       worstSphere === true, '' + worstSphere);
    ok('3.bounds и бокс тоже', worstBox === true, '' + worstBox);
    const rDrag = geoOf(o3).boundingSphere.radius;
    ok('3.bounds радиус действительно вырос - проверка не тавтология',
       rDrag > r0 * 1.2, 'было ' + r0.toFixed(3) + ', стало ' + rDrag.toFixed(3));

    /* И settle обязан посчитать ТОЧНО: кадровый цикл только растит, так что
       драг туда и обратно оставляет радиус слишком большим. */
    const back = new K.THREE.Matrix4().makeTranslation(0, 0, 0);
    K.applyDeltaToSelection(back);
    const rLoose = geoOf(o3).boundingSphere.radius;
    K.endDirectDrag();
    const rTight = geoOf(o3).boundingSphere.radius;
    const refBox = geoOf(o3).boundingBox.clone();
    const refR = geoOf(o3).boundingSphere.radius;
    geoOf(o3).computeBoundingSphere();
    geoOf(o3).computeBoundingBox();
    ok('3.bounds settle посчитал сферу ТОЧНО, а не оставил раздутой',
       Math.abs(refR - geoOf(o3).boundingSphere.radius) < 1e-4,
       'settle=' + refR.toFixed(5) + ' честно=' + geoOf(o3).boundingSphere.radius.toFixed(5) +
       ' (во время драга было ' + rLoose.toFixed(3) + ')');
    ok('3.bounds и бокс тоже точно',
       refBox.min.distanceTo(geoOf(o3).boundingBox.min) < 1e-4 &&
       refBox.max.distanceTo(geoOf(o3).boundingBox.max) < 1e-4);
    note('3.bounds', 'радиус: до драга ' + r0.toFixed(3) + ', на пике ' +
         rDrag.toFixed(3) + ', обратно (раздут) ' + rLoose.toFixed(3) +
         ', после settle ' + rTight.toFixed(3));
    mark('3.bounds');

    /* 3b -- РАЗДУТЫЕ ГАБАРИТЫ НАЗЫВАЮТ СЕБЯ РАЗДУТЫМИ. Ревью сказало, что
       безопасность пункта 3 держится на совпадении: восемь мест читают эти
       габариты как ИЗМЕРЕНИЕ формы, и ни одно из них сегодня не может
       выполниться между первым кадром драга и settle - каждому нужен жест или
       подтверждение, которое драг сначала закончит. Это правда, и это везение.
       Поэтому состояние помечено, а exactBounds - единственный способ
       спросить настоящее. */
    const g3b = geoOf(o3);
    // После settle выше метка снята и габариты точные.
    ok('3b.mark  после settle габариты не помечены раздутыми',
       g3b.userData.kubikBoundsGrown === false,
       'flag=' + g3b.userData.kubikBoundsGrown);
    ok('3b.mark  и exactBounds на точных габаритах ничего не меняет',
       (function () {
         const r = g3b.boundingSphere.radius;
         K.exactBounds(g3b);
         return Math.abs(g3b.boundingSphere.radius - r) < 1e-9;
       })());

    // Теперь снова вырастим их и проверим, что метка встала и снимается.
    K.App.selectedElements.clear();
    for (let i = 0; i < 8 && i < topo3.logicalCount; i++) K.App.selectedElements.add(i);
    K.refreshUI();
    const rect3b = K.canvasEl.getBoundingClientRect();
    if (K.beginDirectDrag({ clientX: rect3b.left + rect3b.width / 2,
                            clientY: rect3b.top + rect3b.height / 2,
                            pointerId: 1, pointerType: 'touch', button: 0 }) !== false) {
      K.applyDeltaToSelection(new K.THREE.Matrix4().makeTranslation(0, 0, 9));
      ok('3b.mark  во время драга габариты помечены раздутыми',
         g3b.userData.kubikBoundsGrown === true);
      const rGrown = g3b.boundingSphere.radius;
      K.applyDeltaToSelection(new K.THREE.Matrix4().makeTranslation(0, 0, 0));
      ok('3b.mark  и после возврата радиус всё ещё раздут - метка не врёт',
         g3b.boundingSphere.radius > rGrown * 0.9 &&
         g3b.userData.kubikBoundsGrown === true,
         'r=' + g3b.boundingSphere.radius.toFixed(3));
      const honest = (function () {
        const c = geoOf(o3).clone();
        c.computeBoundingSphere();
        const r = c.boundingSphere.radius;
        c.dispose();
        return r;
      })();
      K.exactBounds(g3b);
      ok('3b.mark  exactBounds даёт настоящий радиус и снимает метку',
         Math.abs(g3b.boundingSphere.radius - honest) < 1e-4 &&
         g3b.userData.kubikBoundsGrown === false,
         'exact=' + g3b.boundingSphere.radius.toFixed(5) +
         ' честно=' + honest.toFixed(5) + ' flag=' + g3b.userData.kubikBoundsGrown);
      K.endDirectDrag();
    }
    mark('3b.mark');

    /* 4 -- И ЗАМЕР, РАДИ ЧЕГО ПУНКТ 3 ВООБЩЕ ЕСТЬ: стоимость двух вызовов на
       кадр при 40-тысячном атрибуте против роста по восьми точкам. */
    const geo4 = geoOf(o3);
    const nVerts = geo4.attributes.position.count;
    let t = performance.now();
    for (let i = 0; i < 40; i++) { geo4.computeBoundingSphere(); geo4.computeBoundingBox(); }
    const tFull = (performance.now() - t) / 40;
    const lo = new K.THREE.Vector3(0.1, 0.1, 0.1), hi = new K.THREE.Vector3(0.2, 0.2, 0.2);
    t = performance.now();
    for (let i = 0; i < 40; i++) K.growBounds(geo4, lo, hi);
    const tGrow = (performance.now() - t) / 40;
    note('4.cost', nVerts + ' вершин в атрибуте: пересчёт двух габаритов ' +
         tFull.toFixed(3) + ' мс, рост по двум точкам ' + tGrow.toFixed(4) + ' мс');
    ok('4.cost   рост дешевле пересчёта минимум на порядок',
       tGrow * 10 < tFull, 'full=' + tFull.toFixed(3) + ' grow=' + tGrow.toFixed(4));
    mark('4.cost');

    finish();
  }

  function boot() {
    const t0 = Date.now();
    (function wait() {
      if (window.__kubik && window.__kubik.App && window.__kubik.App.objects) {
        run().catch(e => finish('THREW: ' + (e && e.stack || e)));
        return;
      }
      if (Date.now() - t0 > 20000) { finish('__kubik не появился за 20с'); return; }
      setTimeout(wait, 100);
    })();
  }
  if (document.readyState === 'complete') setTimeout(boot, 400);
  else window.addEventListener('load', () => setTimeout(boot, 400));
})();
