/* _uv57chk - Auto seams: рез там, где уже ломается затенение.

   Правило заимствованное, а не новое, поэтому проверяется именно оно: ручная
   пометка ребра важнее угла, угол берётся из effectiveSmoothAngle (включая
   переопределение на объекте), рёбра не с двумя гранями не трогаются вовсе.
   Плюс - что Unwrap на неразмеченной модели делает это сам, а на размеченной
   не лезет. */
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
  let K = null, A = null, T = null;
  const wait = ms => new Promise(r => setTimeout(r, ms));
  const seat = (arr, key) => arr.find(t => t.key === key);

  /* Разрешение ВСЕГДА явно. primParams подставляет за пропущенное поле не
     PRIM_SPECS.def, а hMin/vMin (`num(a, lo)` внутри clampInt), так что `{}`
     даёт трёхгранный цилиндр и шестигранную сферу - а на кубе, где hMin и def
     оба равны 1, разницы не видно, и промах живёт. */
  function fresh(kind, name, params) {
    const o = K.createPrimitiveObject(kind, params || {}, name, new T.Vector3(0, 0, 0));
    A.activeObjectId = o.id;
    A.selectedObjectIds = new Set([o.id]);
    A.selectedElements = new Set();
    K.ensureHelpers(o);
    // Базовая точка истории: создание примитива само ничего не пушит, а без
    // неё undo уходит в документ, где этого объекта ещё нет.
    K.pushHistory();
    return o;
  }
  const seamCount = o => Object.keys(o.mesh.userData.seams || {}).length;
  function islandCount(o) { K.ensureHelpers(o); return K.computeUVIslands(o).count; }
  function edgeKey(o, ei) {
    const e = o.mesh.userData.topo.edges[ei];
    return e ? K.creaseKeyFor(K.logicalPos(o, e[0]), K.logicalPos(o, e[1])) : null;
  }

  async function run() {
    A = K.App; T = K.THREE;

    // ---------------------------------------------------------------- 0
    // Куб: двенадцать рёбер по 90 градусов, шесть островов.
    {
      const o = fresh('cube', 'A0');
      ok('0.cube   на кубе нет швов до запуска', seamCount(o) === 0);
      const r = K.autoSeamEdges(o);
      ok('0.cube   двенадцать рёбер прорезаны', r.added === 12, 'added=' + r.added + ' edges=' + r.edges);
      ok('0.cube   и это шесть островов', islandCount(o) === 6, 'count=' + islandCount(o));
      const r2 = K.autoSeamEdges(o);
      ok('0.cube   повтор не добавляет ничего', r2.added === 0, 'added=' + r2.added);
      ok('0.cube   и не снимает уже поставленное', seamCount(o) === 12, 'seams=' + seamCount(o));
    }
    mark('0');

    // ---------------------------------------------------------------- 1
    // Ручная пометка важнее угла - в обе стороны.
    {
      const o = fresh('cube', 'A1');
      const k = edgeKey(o, 0);
      ok('1.mark   ключ ребра получен', !!k, String(k));
      o.mesh.userData.edgeShade = {};
      o.mesh.userData.edgeShade[k] = 'smooth';
      const r = K.autoSeamEdges(o);
      ok('1.mark   помеченное smooth ребро не режется', r.added === 11, 'added=' + r.added);
      ok('1.mark   и его действительно нет среди швов', !(o.mesh.userData.seams || {})[k]);
      ok('1.mark   две грани остались одним островом', islandCount(o) === 5, 'count=' + islandCount(o));
    }
    {
      const o = fresh('cube', 'A2');
      // Порог выше прямого угла - по углу не режется ничего.
      o.mesh.userData.autoSmoothAngle = 95 * Math.PI / 180;
      const r = K.autoSeamEdges(o);
      ok('1.angle  порог объекта соблюдается', r.added === 0 && r.edges === 12,
         'added=' + r.added + ' edges=' + r.edges);
      const k = edgeKey(o, 0);
      o.mesh.userData.edgeShade = {};
      o.mesh.userData.edgeShade[k] = 'sharp';
      const r2 = K.autoSeamEdges(o);
      ok('1.angle  но пометка sharp режет вопреки углу', r2.added === 1, 'added=' + r2.added);
    }
    mark('1');

    // ---------------------------------------------------------------- 2
    // Цилиндр: режутся два кольца под крышками, бок остаётся трубой.
    {
      const o = fresh('cylinder', 'A3', { h: 12, v: 1 });
      const tp = o.mesh.userData.topo;
      ok('2.cyl    двенадцатигранный цилиндр: 14 граней, 36 рёбер',
         tp.faceGroups.length === 14 && tp.edges.length === 36,
         'faces=' + tp.faceGroups.length + ' edges=' + tp.edges.length);
      const r = K.autoSeamEdges(o);
      /* Соседние грани бока сходятся на 360/12 = 30 градусов - ровно ниже
         SHARP_ANGLE, и это тот самый случай, ради которого порог поставлен на
         33, а не на 30. Значит бок остаётся трубой, а режутся только два
         кольца под крышками: 12 + 12. */
      ok('2.cyl    прорезаны только два кольца под крышками', r.added === 24,
         'added=' + r.added + ' edges=' + r.edges);
      ok('2.cyl    и это ровно три острова - две крышки и бок',
         islandCount(o) === 3, 'count=' + islandCount(o));
    }
    // Сфера: твёрдых рёбер нет, находить нечего - и это честный ответ, а не
    // рез наугад.
    {
      const o = fresh('sphere', 'A4', { h: 16, v: 8 });
      const r = K.autoSeamEdges(o);
      ok('2.sphere на гладкой сфере ничего не режется', r.added === 0, 'added=' + r.added);
      ok('2.sphere но рёбра там есть - значит отказ осознанный', r.edges > 0, 'edges=' + r.edges);
      ok('2.sphere остров остался один', islandCount(o) === 1, 'count=' + islandCount(o));
    }
    // Плоскость: внутренних рёбер нет вовсе.
    {
      const o = fresh('plane', 'A5', { h: 1, v: 1 });
      const r = K.autoSeamEdges(o);
      ok('2.plane  на одиночной грани резать нечего', r.added === 0, 'added=' + r.added);
    }
    mark('2');

    // ---------------------------------------------------------------- 3
    // Unwrap на неразмеченной модели размечает её сам.
    {
      const o = fresh('cube', 'A6');
      K.setMode('uv');
      K.unwrapSelection();
      await wait(20);
      ok('3.unwrap  Unwrap сам поставил швы', seamCount(o) === 12, 'seams=' + seamCount(o));
      ok('3.unwrap  и получил шесть островов', islandCount(o) === 6, 'count=' + islandCount(o));
      // Развёртка настоящая, а не тень: острова не лежат друг на друге в
      // одной точке - у каждого своя площадь и ненулевой размер.
      const uv = o.mesh.geometry.attributes.uv;
      let minU = Infinity, maxU = -Infinity, minV = Infinity, maxV = -Infinity;
      for (let i = 0; i < uv.count; i++) {
        minU = Math.min(minU, uv.getX(i)); maxU = Math.max(maxU, uv.getX(i));
        minV = Math.min(minV, uv.getY(i)); maxV = Math.max(maxV, uv.getY(i));
      }
      ok('3.unwrap  развёртка занимает квадрат, а не точку',
         maxU - minU > 0.5 && maxV - minV > 0.5,
         'u=' + (maxU - minU).toFixed(3) + ' v=' + (maxV - minV).toFixed(3));
      // И один шаг истории: undo снимает и швы, и развёртку.
      K.undo();
      await wait(30);
      const o2 = K.findObject(A.activeObjectId) || o;
      ok('3.unwrap  объект пережил undo', !!K.findObject(A.activeObjectId), 'id=' + A.activeObjectId);
      ok('3.unwrap  undo снял всё одним шагом', seamCount(o2) === 0, 'seams=' + seamCount(o2));
    }
    mark('3');

    // ---------------------------------------------------------------- 4
    // А на размеченной - не лезет: один ручной шов и есть вся разметка.
    {
      const o = fresh('cube', 'A7');
      K.setMode('edge');
      A.selectedElements = new Set([0]);
      K.markSeamSelection(true);
      ok('4.keep   ручной шов поставлен', seamCount(o) === 1, 'seams=' + seamCount(o));
      A.selectedElements = new Set();
      K.setMode('uv');
      K.unwrapSelection();
      await wait(20);
      ok('4.keep   Unwrap ничего не дорисовал', seamCount(o) === 1, 'seams=' + seamCount(o));
    }
    mark('4');

    // ---------------------------------------------------------------- 5
    // Настоящее место в кольце, а не прямой вызов.
    {
      const o = fresh('cube', 'A8');
      K.setMode('uv');
      K.refreshUI();
      const st = seat(K.HUB_TOOLS_UV, 'autoseam');
      ok('5.seat   место в кольце есть', !!st && st.seat === 4, st ? 'seat=' + st.seat : 'нет');
      st.run();
      await wait(20);
      ok('5.seat   и оно режет', seamCount(o) === 12, 'seams=' + seamCount(o));
      ok('5.seat   один шаг истории', (function () {
        K.undo();
        const o2 = K.findObject(A.activeObjectId) || o;
        return seamCount(o2) === 0;
      })(), 'после undo seams=' + seamCount(K.findObject(A.activeObjectId) || o));
    }
    mark('5');

    // ---------------------------------------------------------------- 6
    // «Уже прорезано» - это НЕ «нечего резать». Второй проход по кубу
    // находит все двенадцать рёбер и не добавляет ни одного.
    {
      const o = fresh('cube', 'A9');
      const r1 = K.autoSeamEdges(o);
      ok('6.again  первый проход режет', r1.added === 12 && r1.found === 12,
         'added=' + r1.added + ' found=' + r1.found);
      const r2 = K.autoSeamEdges(o);
      ok('6.again  второй находит столько же и не добавляет ничего',
         r2.found === 12 && r2.added === 0, 'found=' + r2.found + ' added=' + r2.added);
      ok('6.again  и видит, что швы живые', r2.live === 12, 'live=' + r2.live);
    }
    // Плоскость не гнётся, сфера гнётся - это и отличает «одна карта потому
    // что так и надо» от «одна карта потому что не нашлось твёрдых рёбер».
    {
      const flat = fresh('plane', 'A10', { h: 3, v: 3 });
      const rf = K.autoSeamEdges(flat);
      ok('6.bent   плоская сетка не гнётся нигде', rf.bent === 0 && rf.edges > 0,
         'bent=' + rf.bent + ' edges=' + rf.edges);
      const ball = fresh('sphere', 'A11', { h: 16, v: 8 });
      const rb = K.autoSeamEdges(ball);
      ok('6.bent   сфера гнётся везде', rb.bent === rb.edges && rb.edges > 0,
         'bent=' + rb.bent + ' edges=' + rb.edges);
    }
    mark('6');

    // ---------------------------------------------------------------- 7
    // Осиротевшие ключи швов - не разметка. Словарь непустой, но ни один
    // ключ не называет ребро, которое у этого меша есть.
    {
      const o = fresh('cube', 'A12');
      o.mesh.userData.seams = { 'nothing_here|nothing_there': true };
      const r = K.autoSeamEdges(o, { onlyWhenUnmarked: true });
      ok('7.stale  мусорный ключ живым швом не считается', r.live === 0, 'live=' + r.live);
      ok('7.stale  и модель всё-таки размечается', r.added === 12, 'added=' + r.added);
    }
    // А настоящий шов - считается, и тогда обещание «не лезу» держится.
    {
      const o = fresh('cube', 'A13');
      K.setMode('edge');
      A.selectedElements = new Set([0]);
      K.markSeamSelection(true);
      A.selectedElements = new Set();
      const r = K.autoSeamEdges(o, { onlyWhenUnmarked: true });
      ok('7.stale  живой шов останавливает автоматику',
         r.live === 1 && r.added === 0, 'live=' + r.live + ' added=' + r.added);
      ok('7.stale  но она всё равно посчитала, что нашла бы', r.found === 12, 'found=' + r.found);
    }
    // И Unwrap идёт по тому же признаку, а не по размеру словаря.
    {
      const o = fresh('cube', 'A14');
      o.mesh.userData.seams = { 'nothing_here|nothing_there': true };
      K.setMode('uv');
      K.unwrapSelection();
      await wait(20);
      ok('7.stale  Unwrap размечает модель с мусорным словарём',
         islandCount(o) === 6, 'count=' + islandCount(o));
    }
    mark('7');

    finish();
  }

  function boot() {
    K = window.__kubik;
    if (!K || !K.App || !K.HUB_TOOLS_UV || !K.autoSeamEdges) { setTimeout(boot, 120); return; }
    setTimeout(() => {
      run().catch(e => finish('THREW ' + (e && e.stack ? e.stack : e)));
    }, 400);
  }
  if (document.readyState === 'complete') boot();
  else window.addEventListener('load', boot);
})();
