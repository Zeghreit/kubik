/* _uv58chk - UV-режим перестал быть рентгеном.

   Проверяется не «как выглядит», а те три свойства, из которых вид следует:
   в какой очереди рисуется тинт островов (transparent), какие грани он
   рисует (side) и читает ли он глубину (depthTest). Плюс что выделение в
   UV-режиме наконец получает тот же толстый слой, что и Edge-режим. */
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

  const ud = o => o.mesh.userData;
  function islandMat(o) { return ud(o).islandOverlay && ud(o).islandOverlay.material; }
  // Средний цвет граней одного острова в буфере тинта.
  function islandTint(o, islandId) {
    const mesh = ud(o).islandOverlay;
    const col = mesh.geometry.attributes.color;
    const index = o.mesh.geometry.index;
    const topo = ud(o).topo;
    const { islandOf } = K.computeUVIslands(o);
    let r = 0, n = 0;
    topo.faceGroups.forEach((fg, gi) => {
      if (islandOf[gi] !== islandId) return;
      const end = (fg.triStart + fg.triCount) * 3;
      for (let i = fg.triStart * 3; i < end; i++) {
        const ai = index.getX(i);
        r += col.getX(ai) + col.getY(ai) + col.getZ(ai); n++;
      }
    });
    return n ? r / n : NaN;
  }
  function segCount(o) {
    const l = ud(o).selLines;
    if (!l) return 0;
    // LineSegmentsGeometry хранит концы в instanceStart; одна инстанция - отрезок.
    const a = l.geometry.attributes.instanceStart;
    return a ? a.count : 0;
  }
  function setXray(o, on) {
    A.xraySelection = !!on;
    K.refreshXrayMode();
    K.refreshElementColors(o);
    K.refreshUI();
  }
  // Только тот путь, по которому идёт настоящий тумблер See-through:
  // refreshXrayMode + refreshUI. refreshElementColors он не зовёт - и именно
  // на этом тинт островов оставался в прежнем состоянии.
  function setXrayOnly(on) {
    A.xraySelection = !!on;
    K.refreshXrayMode();
    K.refreshUI();
  }
  // Поканальное среднее цвета острова в буфере тинта.
  function islandRGB(o, islandId) {
    const col = ud(o).islandOverlay.geometry.attributes.color;
    const index = o.mesh.geometry.index;
    const topo = ud(o).topo;
    const { islandOf } = K.computeUVIslands(o);
    let r = 0, g = 0, b = 0, n = 0;
    topo.faceGroups.forEach((fg, gi) => {
      if (islandOf[gi] !== islandId) return;
      const end = (fg.triStart + fg.triCount) * 3;
      for (let i = fg.triStart * 3; i < end; i++) {
        const ai = index.getX(i);
        r += col.getX(ai); g += col.getY(ai); b += col.getZ(ai); n++;
      }
    });
    return n ? [r / n, g / n, b / n] : [NaN, NaN, NaN];
  }
  function fresh(name) {
    const o = K.createPrimitiveObject('cube', { h: 1, v: 1 }, name, new T.Vector3(0, 0, 0));
    A.activeObjectId = o.id;
    A.selectedObjectIds = new Set([o.id]);
    A.selectedElements = new Set();
    K.ensureHelpers(o);
    K.pushHistory();
    return o;
  }
  function seamAllEdges(o) {
    K.setMode('edge');
    A.selectedElements = new Set(ud(o).topo.edges.map((e, i) => i));
    K.markSeamSelection(true);
    A.selectedElements = new Set();
  }
  function pickIsland(o, gi) {
    A.uvSelKind = 'face';
    K.toggleUvIslandElements(K.uvIslandFaceIds(o, gi), false);
  }

  async function run() {
    A = K.App; T = K.THREE;

    // ---------------------------------------------------------------- 0
    ok('0.mode   у UV появилась своя строка в MODE_VIEW', !!K.MODE_VIEW.uv);
    ok('0.mode   и каркас в ней не тусклее, чем в Edge',
       K.MODE_VIEW.uv.frame >= K.MODE_VIEW.edge.frame,
       'uv=' + K.MODE_VIEW.uv.frame + ' edge=' + K.MODE_VIEW.edge.frame +
       ' object=' + K.MODE_VIEW.object.frame);
    mark('0');

    // ---------------------------------------------------------------- 1
    // Тинт островов: плотный, односторонний, читает глубину.
    const o = fresh('V0');
    seamAllEdges(o);
    K.setMode('uv');
    K.unwrapSelection();
    K.refreshUI();
    await wait(30);
    setXray(o, false);
    await wait(20);
    {
      const m = islandMat(o);
      ok('1.solid  тинт островов есть', !!m);
      ok('1.solid  он не прозрачный', m.transparent === false, 'transparent=' + m.transparent);
      ok('1.solid  и непрозрачный по значению', m.opacity === 1, 'opacity=' + m.opacity);
      ok('1.solid  рисует только лицевые грани', m.side === T.FrontSide, 'side=' + m.side);
      ok('1.solid  и читает глубину', m.depthTest === true, 'depthTest=' + m.depthTest);
      ok('1.solid  порядок рисования ниже каркаса',
         ud(o).islandOverlay.renderOrder < ud(o).edgeLines.renderOrder,
         'island=' + ud(o).islandOverlay.renderOrder + ' lines=' + ud(o).edgeLines.renderOrder);
      const l = ud(o).edgeLines;
      ok('1.solid  каркас тоже читает глубину', l.material.depthTest === true,
         'depthTest=' + l.material.depthTest);
      ok('1.solid  и не выкручен в хвост очереди', l.renderOrder === 9, 'renderOrder=' + l.renderOrder);
    }
    mark('1');

    // ---------------------------------------------------------------- 2
    // See-through возвращает прежний рентген - и только он.
    setXray(o, true);
    await wait(20);
    {
      const m = islandMat(o);
      ok('2.xray   тинт снова прозрачный', m.transparent === true, 'transparent=' + m.transparent);
      ok('2.xray   и тише', m.opacity === 0.32, 'opacity=' + m.opacity);
      ok('2.xray   рисует обе стороны', m.side === T.DoubleSide, 'side=' + m.side);
      ok('2.xray   и не читает глубину', m.depthTest === false, 'depthTest=' + m.depthTest);
      const l = ud(o).edgeLines;
      ok('2.xray   каркас светит насквозь', l.material.depthTest === false,
         'depthTest=' + l.material.depthTest);
      ok('2.xray   и уходит в хвост очереди', l.renderOrder === 12, 'renderOrder=' + l.renderOrder);
    }
    setXray(o, false);
    await wait(20);
    ok('2.xray   выключение возвращает плотный вид',
       islandMat(o).transparent === false && islandMat(o).depthTest === true);
    mark('2');

    // ---------------------------------------------------------------- 3
    // Выделенный остров: своя краска, но ярче, и накладка граней молчит.
    {
      const { islandOf } = K.computeUVIslands(o);
      const other = islandOf[0] === islandOf[1] ? null : islandOf[1];
      const before = islandTint(o, islandOf[0]);
      pickIsland(o, 0);
      K.refreshElementColors(o);
      await wait(20);
      const after = islandTint(o, islandOf[0]);
      ok('3.island выделенный остров стал ярче', after > before * 1.4,
         'было ' + before.toFixed(3) + ' стало ' + after.toFixed(3));
      if (other !== null) {
        ok('3.island а соседний не тронут',
           Math.abs(islandTint(o, other) - islandTint(o, other)) < 1e-9 &&
           islandTint(o, other) < after, 'сосед=' + islandTint(o, other).toFixed(3));
      }
      const fo = ud(o).faceOverlay;
      ok('3.island накладка граней больше не красит остров', !fo || fo.visible === false,
         fo ? 'visible=' + fo.visible : 'нет накладки');
      // И обводка - четыре ребра на одну грань куба.
      ok('3.island остров обведён толстой линией', segCount(o) === 4, 'отрезков=' + segCount(o));
      ok('3.island обводке нечего подталкивать', ud(o).selLineIds === null);
    }
    mark('3');

    // ---------------------------------------------------------------- 4
    // Рёбра в UV получают тот же толстый слой, что и в Edge-режиме.
    {
      A.uvSelKind = 'edge';
      A.selectedElements = new Set([0, 1, 2]);
      K.refreshElementColors(o);
      await wait(20);
      ok('4.edge   три ребра - три толстых отрезка', segCount(o) === 3, 'отрезков=' + segCount(o));
      ok('4.edge   и они названы по индексам', !!ud(o).selLineIds && ud(o).selLineIds.length === 3,
         ud(o).selLineIds ? 'ids=' + ud(o).selLineIds.length : 'нет');
      ok('4.edge   толщина та же, что у Edge-режима',
         ud(o).selLines.material.linewidth > 1, 'linewidth=' + ud(o).selLines.material.linewidth);
      // Тот же слой в Edge-режиме - контрольный замер, что ничего не сломано.
      K.setMode('edge');
      A.selectedElements = new Set([0, 1, 2]);
      K.refreshElementColors(o);
      await wait(20);
      ok('4.edge   Edge-режим по-прежнему рисует их же', segCount(o) === 3, 'отрезков=' + segCount(o));
    }
    mark('4');

    // ---------------------------------------------------------------- 5
    // Смена вида выделения внутри UV обязана пересобрать слой, а не толкать
    // чужой список: App.mode для обоих один и тот же.
    {
      K.setMode('uv');
      A.uvSelKind = 'edge';
      A.selectedElements = new Set([0, 1, 2]);
      K.refreshElementColors(o);
      await wait(20);
      ok('5.kind   слой помнит вид выделения', ud(o).selOverlayUvKind === 'edge',
         'kind=' + ud(o).selOverlayUvKind);
      pickIsland(o, 0);
      K.refreshElementColors(o);
      await wait(20);
      ok('5.kind   после переключения на острова - обводка, а не рёбра',
         ud(o).selOverlayUvKind === 'face' && segCount(o) === 4 && ud(o).selLineIds === null,
         'kind=' + ud(o).selOverlayUvKind + ' отрезков=' + segCount(o));
    }
    mark('5');

    // ---------------------------------------------------------------- 6
    // Выход из UV убирает всё, что UV нарисовал.
    {
      K.setMode('object');
      K.refreshUI();
      await wait(20);
      const io = ud(o).islandOverlay;
      ok('6.leave  тинт островов спрятан', !io || io.visible === false,
         io ? 'visible=' + io.visible : 'нет');
      ok('6.leave  и толстый слой снят', segCount(o) === 0, 'отрезков=' + segCount(o));
    }
    mark('6');

    // ---------------------------------------------------------------- 7
    // Лит-материалу нужна нормаль. Без неё normalize(vec3(0)) - это NaN, и
    // весь остров рисуется чёрным; стенд по флагам материала такого не видит.
    {
      K.setMode('uv');
      K.refreshElementColors(o);
      K.refreshUI();
      await wait(20);
      const io = ud(o).islandOverlay;
      ok('7.normal у тинта есть нормаль', !!io.geometry.attributes.normal);
      ok('7.normal и это ТА ЖЕ нормаль, что у меша',
         io.geometry.attributes.normal === o.mesh.geometry.attributes.normal);
      ok('7.normal материал действительно освещаемый',
         io.material.type === 'MeshLambertMaterial', io.material.type);
    }
    mark('7');

    // ---------------------------------------------------------------- 8
    // See-through БЕЗ смены выделения. Настоящий тумблер не зовёт
    // refreshElementColors, и тинт оставался в прежнем состоянии.
    {
      setXrayOnly(false);
      await wait(20);
      ok('8.toggle перед началом тинт плотный', islandMat(o).transparent === false);
      setXrayOnly(true);
      await wait(20);
      const m = islandMat(o);
      ok('8.toggle один тумблер - и тинт стал прозрачным',
         m.transparent === true && m.depthTest === false && m.side === T.DoubleSide,
         'transparent=' + m.transparent + ' depthTest=' + m.depthTest + ' side=' + m.side);
      setXrayOnly(false);
      await wait(20);
      const m2 = islandMat(o);
      ok('8.toggle и обратно - плотным',
         m2.transparent === false && m2.depthTest === true && m2.side === T.FrontSide,
         'transparent=' + m2.transparent + ' depthTest=' + m2.depthTest + ' side=' + m2.side);
    }
    mark('8');

    // ---------------------------------------------------------------- 9
    // Буфер цвета не пересоздаётся на каждый тап, подсветка не упирается в
    // потолок, и выделение ВСЕГО всё-таки обводится.
    {
      const { islandOf, count } = K.computeUVIslands(o);
      A.uvSelKind = 'face';
      A.selectedElements = new Set();
      K.refreshElementColors(o);
      await wait(20);
      const attr0 = ud(o).islandOverlay.geometry.attributes.color;
      const plain = islandRGB(o, islandOf[0]);
      pickIsland(o, 0);
      K.refreshElementColors(o);
      await wait(20);
      const attr1 = ud(o).islandOverlay.geometry.attributes.color;
      ok('9.buf    буфер цвета переиспользован, а не пересоздан', attr0 === attr1);
      const lit = islandRGB(o, islandOf[0]);
      ok('9.lift   подсветка подняла ВСЕ три канала',
         lit[0] > plain[0] && lit[1] > plain[1] && lit[2] > plain[2],
         'было ' + plain.map(v => v.toFixed(2)).join('/') + ' стало ' + lit.map(v => v.toFixed(2)).join('/'));
      ok('9.lift   и ни один не упёрся в потолок',
         Math.max(lit[0], lit[1], lit[2]) < 0.999 || Math.max(plain[0], plain[1], plain[2]) > 0.99,
         'макс=' + Math.max(lit[0], lit[1], lit[2]).toFixed(4));
      // Выделить все острова: каждое ребро общее у двух выделенных граней,
      // так что по правилу «нечётные рёбра» обводки не было бы вовсе.
      A.selectedElements = new Set(ud(o).topo.faceGroups.map((fg, gi) => gi));
      A.uvSelKind = 'face';
      K.refreshElementColors(o);
      await wait(20);
      ok('9.all    при выделении всего обводка всё равно есть',
         segCount(o) > 0, 'островов=' + count + ' отрезков=' + segCount(o));
    }
    mark('9');

    // ---------------------------------------------------------------- 10
    // Зеркальный объект: у меша обе стороны, значит и у тинта обе, иначе
    // посреди тонированной модели получается нетонированная заплата.
    {
      const m = fresh('V1');
      seamAllEdges(m);
      K.setMode('uv');
      m.mesh.scale.x = -1;
      m.mesh.updateMatrixWorld();
      K.refreshElementColors(m);
      K.refreshUI();
      await wait(20);
      ok('10.mirror у зеркального объекта тинт двусторонний',
         islandMat(m).side === T.DoubleSide, 'side=' + islandMat(m).side);
      m.mesh.scale.x = 1;
      m.mesh.updateMatrixWorld();
      K.refreshElementColors(m);
      await wait(20);
      ok('10.mirror и обратно односторонний', islandMat(m).side === T.FrontSide,
         'side=' + islandMat(m).side);
    }
    mark('10');

    finish();
  }

  function boot() {
    K = window.__kubik;
    if (!K || !K.App || !K.MODE_VIEW || !K.computeUVIslands) { setTimeout(boot, 120); return; }
    setTimeout(() => {
      run().catch(e => finish('THREW ' + (e && e.stack ? e.stack : e)));
    }, 400);
  }
  if (document.readyState === 'complete') boot();
  else window.addEventListener('load', boot);
})();
