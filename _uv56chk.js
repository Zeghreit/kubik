/* _uv56chk - настоящий Merge islands: жёсткое совмещение UV двух островов.

   Выделение островов делается теми же функциями, что и настоящий тап
   (uvIslandFaceIds + toggleUvIslandElements + App.uvSelKind, как в
   handleTap), сама операция запускается через место 'merge' в HUB_TOOLS_UV -
   ни одна проверка не зовёт alignUvIslands напрямую, кроме той, что про
   его собственные отказы. */
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
  const f3 = v => (Math.round(v * 1000) / 1000);

  function islands(o) { K.ensureHelpers(o); return K.computeUVIslands(o); }

  function uvSnap(o) {
    const a = o.mesh.geometry.attributes.uv;
    const out = [];
    for (let i = 0; i < a.count; i++) out.push(a.getX(i), a.getY(i));
    return out;
  }
  function posKey(o, ai) {
    const p = o.mesh.geometry.attributes.position;
    return p.getX(ai).toFixed(5) + ',' + p.getY(ai).toFixed(5) + ',' + p.getZ(ai).toFixed(5);
  }
  function idsOfIsland(o, id) {
    const { islandOf } = islands(o);
    const r = [];
    for (let gi = 0; gi < islandOf.length; gi++) if (islandOf[gi] === id) r.push(gi);
    return r;
  }
  // Пары островов, у которых есть общее ребро, и пары, у которых нет.
  function touchMap(o) {
    const { islandOf, edgeFaces, count } = islands(o);
    const touch = new Set();
    edgeFaces.forEach(gis => {
      if (gis.length !== 2) return;
      const a = islandOf[gis[0]], b = islandOf[gis[1]];
      if (a !== b) touch.add(Math.min(a, b) + '_' + Math.max(a, b));
    });
    return { touch: touch, count: count };
  }
  function adjacentPair(o) {
    const { touch } = touchMap(o);
    const first = Array.from(touch)[0];
    return first ? first.split('_').map(Number) : null;
  }
  function adjacentChain(o) {
    // Три острова цепочкой: a-b и b-c, при этом a и c могут не касаться.
    const { touch, count } = touchMap(o);
    for (let b = 0; b < count; b++) {
      const nb = [];
      for (let x = 0; x < count; x++) {
        if (x === b) continue;
        if (touch.has(Math.min(x, b) + '_' + Math.max(x, b))) nb.push(x);
      }
      if (nb.length >= 2) return [nb[0], b, nb[1]];
    }
    return null;
  }
  function nonAdjacentPair(o) {
    const { touch, count } = touchMap(o);
    for (let a = 0; a < count; a++) {
      for (let b = a + 1; b < count; b++) if (!touch.has(a + '_' + b)) return [a, b];
    }
    return null;
  }
  // Выделить острова ровно так, как это делает настоящий тап.
  function pickIslands(o, ids) {
    A.uvSelKind = 'face';
    ids.forEach((id, i) => K.toggleUvIslandElements(idsOfIsland(o, id), i > 0));
  }
  // Ключи позиций вершин, лежащих на швах между выбранными островами.
  function seamPosKeys(o, picked) {
    const { islandOf, edgeFaces } = islands(o);
    const topo = o.mesh.userData.topo;
    const keys = new Set();
    edgeFaces.forEach((gis, key) => {
      if (gis.length !== 2) return;
      const ia = islandOf[gis[0]], ib = islandOf[gis[1]];
      if (ia === ib || picked.indexOf(ia) < 0 || picked.indexOf(ib) < 0) return;
      key.split('_').map(Number).forEach(l => {
        const g = topo.logicalGroups[l];
        if (g && g.length) keys.add(posKey(o, g[0]));
      });
    });
    return keys;
  }
  // Разброс UV в одной точке внутри одного острова - нуль означает, что шов
  // сшит по-настоящему, а не почти.
  function spreadAt(o, islandId, keys) {
    const { islandOf } = islands(o);
    const topo = o.mesh.userData.topo, index = o.mesh.geometry.index;
    const uv = o.mesh.geometry.attributes.uv;
    const byKey = new Map();
    topo.faceGroups.forEach((fg, gi) => {
      if (islandOf[gi] !== islandId) return;
      const end = (fg.triStart + fg.triCount) * 3;
      for (let i = fg.triStart * 3; i < end; i++) {
        const ai = index.getX(i);
        const k = posKey(o, ai);
        if (!keys.has(k)) continue;
        let a = byKey.get(k);
        if (!a) { a = []; byKey.set(k, a); }
        if (a.indexOf(ai) < 0) a.push(ai);
      }
    });
    let worst = 0, seen = 0;
    byKey.forEach(arr => {
      seen++;
      for (let i = 1; i < arr.length; i++) {
        const d = Math.hypot(uv.getX(arr[i]) - uv.getX(arr[0]), uv.getY(arr[i]) - uv.getY(arr[0]));
        if (d > worst) worst = d;
      }
    });
    return { worst: worst, seen: seen };
  }
  // Знаковая площадь острова в UV и сколько треугольников смотрят в каждую
  // сторону: смешанные знаки внутри одного острова - это складка.
  function areaOf(o, islandId) {
    const { islandOf } = islands(o);
    const topo = o.mesh.userData.topo, index = o.mesh.geometry.index;
    const uv = o.mesh.geometry.attributes.uv;
    let total = 0, pos = 0, neg = 0;
    topo.faceGroups.forEach((fg, gi) => {
      if (islandOf[gi] !== islandId) return;
      const end = (fg.triStart + fg.triCount) * 3;
      for (let i = fg.triStart * 3; i < end; i += 3) {
        const a0 = index.getX(i), a1 = index.getX(i + 1), a2 = index.getX(i + 2);
        const x0 = uv.getX(a0), y0 = uv.getY(a0);
        const s = ((uv.getX(a1) - x0) * (uv.getY(a2) - y0) - (uv.getX(a2) - x0) * (uv.getY(a1) - y0)) * 0.5;
        total += s;
        if (s > 1e-10) pos++; else if (s < -1e-10) neg++;
      }
    });
    return { total: total, pos: pos, neg: neg };
  }
  function meanUv(o, islandId) {
    const { attrIsland } = K.islandVertexMap(o);
    const { islandOf } = islands(o);
    const uv = o.mesh.geometry.attributes.uv;
    let sx = 0, sy = 0, n = 0;
    for (let ai = 0; ai < attrIsland.length; ai++) {
      if (attrIsland[ai] !== islandId) continue;
      sx += uv.getX(ai); sy += uv.getY(ai); n++;
    }
    return n ? { x: sx / n, y: sy / n, n: n } : { x: NaN, y: NaN, n: 0 };
  }

  // Сколько attribute-вершин острова разъехалось со снимком uv0. Индексы
  // переживают rebuildFromEditable: разделение по группам уже сделано, и
  // порядок обхода тот же.
  function movedIn(o, attrIslandBefore, islandId, uv0) {
    const uv = o.mesh.geometry.attributes.uv;
    let moved = 0, seen = 0;
    for (let ai = 0; ai < attrIslandBefore.length; ai++) {
      if (attrIslandBefore[ai] !== islandId) continue;
      if (ai >= uv.count || ai * 2 + 1 >= uv0.length) continue;
      seen++;
      if (Math.hypot(uv.getX(ai) - uv0[ai * 2], uv.getY(ai) - uv0[ai * 2 + 1]) > 1e-9) moved++;
    }
    return { moved: moved, seen: seen };
  }

  function fresh(name) {
    K.createPrimitiveObject('cube', {}, name, new T.Vector3(0, 0, 0));
    const o = A.objects[A.objects.length - 1];
    A.activeObjectId = o.id;
    A.selectedObjectIds = new Set([o.id]);
    K.setMode('edge');
    K.ensureHelpers(o);
    A.selectedElements = new Set(o.mesh.userData.topo.edges.map((e, i) => i));
    K.markSeamSelection(true);          // каждая грань - свой остров
    A.selectedElements = new Set();
    K.setMode('uv');
    K.unwrapSelection();
    K.refreshUI();
    return o;
  }
  const runMerge = () => seat(K.HUB_TOOLS_UV, 'merge').run();

  async function run() {
    A = K.App; T = K.THREE;
    // ---------------------------------------------------------------- 0
    let o = fresh('C1');
    let st = islands(o);
    ok('0.setup  шесть островов на кубе', st.count === 6, 'count=' + st.count);
    const pair = adjacentPair(o);
    ok('0.setup  есть соседняя пара', !!pair, JSON.stringify(pair));
    if (!pair) return finish('нет соседних островов - дальше смысла нет');
    mark('0');

    // ---------------------------------------------------------------- 1
    // Сшивка соседней пары: остров-якорь не двигается, второй приезжает.
    const anchor = Math.min(pair[0], pair[1]), other = Math.max(pair[0], pair[1]);
    const keys = seamPosKeys(o, [anchor, other]);
    const areaB0 = areaOf(o, other);
    const uv0 = uvSnap(o);
    pickIslands(o, [anchor, other]);
    ok('1.pick   выбраны два острова', A.selectedElements.size === 2 && A.uvSelKind === 'face',
       'n=' + A.selectedElements.size + ' kind=' + A.uvSelKind);
    runMerge();
    await wait(20);
    st = islands(o);
    ok('1.merge  островов стало пять', st.count === 5, 'count=' + st.count);
    const mergedId = islands(o).islandOf[Array.from(A.selectedElements)[0]];
    ok('1.merge  выделен получившийся остров',
       A.selectedElements.size === 2 && A.uvSelKind === 'face',
       'n=' + A.selectedElements.size + ' kind=' + A.uvSelKind);
    const sp = spreadAt(o, mergedId, keys);
    ok('1.stitch шов сшит точно', sp.seen >= 2 && sp.worst < 1e-6,
       'точек=' + sp.seen + ' макс.расхождение=' + sp.worst.toExponential(2));
    mark('1');

    // Якорь не сдвинулся ни на одну вершину: сравниваем каждую его
    // attribute-вершину с тем, что было до операции. Индексы переживают
    // rebuildFromEditable (разделение по группам уже было сделано), но
    // сверяемся по позиции, а не по номеру.
    {
      const { islandOf } = islands(o);
      const topo = o.mesh.userData.topo, index = o.mesh.geometry.index;
      const uv = o.mesh.geometry.attributes.uv;
      // какие face-группы были в якоре до слияния
      const anchorGroups = new Set(idsOfIsland(o, mergedId));
      let movedAnchor = 0, checked = 0;
      topo.faceGroups.forEach((fg, gi) => {
        if (!anchorGroups.has(gi)) return;
        const end = (fg.triStart + fg.triCount) * 3;
        for (let i = fg.triStart * 3; i < end; i++) {
          const ai = index.getX(i);
          if (ai * 2 + 1 >= uv0.length) continue;
          checked++;
          const d = Math.hypot(uv.getX(ai) - uv0[ai * 2], uv.getY(ai) - uv0[ai * 2 + 1]);
          if (d > 1e-9) movedAnchor++;
        }
      });
      // Половина вершин слитого острова должна остаться ровно на месте -
      // это якорь; вторая половина обязана сдвинуться, иначе ничего не
      // произошло.
      ok('1.anchor часть вершин не двигалась, часть двигалась',
         movedAnchor > 0 && movedAnchor < checked,
         'сдвинулось ' + movedAnchor + ' из ' + checked);
    }

    // Масштаб не улетел: площадь приехавшего острова осталась в разумных
    // пределах относительно того, что было.
    {
      const a1 = areaOf(o, mergedId);
      ok('1.scale  площадь слитого острова примерно вдвое больше исходного',
         Math.abs(a1.total) > Math.abs(areaB0.total) * 1.2 &&
         Math.abs(a1.total) < Math.abs(areaB0.total) * 4,
         'было ' + f3(areaB0.total) + ' стало ' + f3(a1.total));
      ok('1.fold   складок внутри острова нет',
         a1.pos === 0 || a1.neg === 0, 'pos=' + a1.pos + ' neg=' + a1.neg);
    }
    mark('1b');

    // ---------------------------------------------------------------- 2
    // Один шаг истории: undo возвращает и швы, и координаты.
    K.undo();
    await wait(30);
    // restoreDoc пересобирает объекты - прежняя ссылка теперь на выброшенный.
    o = K.findObject(A.activeObjectId) || o;
    st = islands(o);
    ok('2.undo   шесть островов вернулись', st.count === 6, 'count=' + st.count);
    {
      const uv = o.mesh.geometry.attributes.uv;
      let worst = 0;
      for (let i = 0; i < Math.min(uv.count, uv0.length / 2); i++) {
        worst = Math.max(worst, Math.hypot(uv.getX(i) - uv0[i * 2], uv.getY(i) - uv0[i * 2 + 1]));
      }
      ok('2.undo   координаты вернулись', worst < 1e-6, 'макс=' + worst.toExponential(2));
    }
    K.redo();
    await wait(30);
    o = K.findObject(A.activeObjectId) || o;
    ok('2.redo   redo снова сшивает', islands(o).count === 5, 'count=' + islands(o).count);
    mark('2');

    // ---------------------------------------------------------------- 3
    // Несоседние острова: отказ, и ничего не меняется.
    {
      const o3 = fresh('C3');
      const np = nonAdjacentPair(o3);
      ok('3.apart  нашлась несоседняя пара', !!np, JSON.stringify(np));
      if (np) {
        const before = uvSnap(o3);
        pickIslands(o3, np);
        runMerge();
        await wait(20);
        const after = uvSnap(o3);
        let worst = 0;
        for (let i = 0; i < Math.min(before.length, after.length); i += 2) {
          worst = Math.max(worst, Math.hypot(after[i] - before[i], after[i + 1] - before[i + 1]));
        }
        ok('3.apart  островов столько же', islands(o3).count === 6, 'count=' + islands(o3).count);
        ok('3.apart  ни одна UV не сдвинулась', worst === 0, 'макс=' + worst.toExponential(2));
      }
    }
    mark('3');

    // ---------------------------------------------------------------- 4
    // Один остров - отказ с подсказкой, ничего не меняется.
    {
      const o4 = fresh('C4');
      const before = uvSnap(o4);
      pickIslands(o4, [0]);
      runMerge();
      await wait(20);
      const after = uvSnap(o4);
      let worst = 0;
      for (let i = 0; i < before.length; i += 2) {
        worst = Math.max(worst, Math.hypot(after[i] - before[i], after[i + 1] - before[i + 1]));
      }
      ok('4.one    один остров ничего не меняет',
         islands(o4).count === 6 && worst === 0, 'count=' + islands(o4).count + ' макс=' + worst.toExponential(2));
    }
    mark('4');

    // ---------------------------------------------------------------- 5
    // Цепочка из трёх: a-b-c сшивается в один лист, включая пару a-c,
    // которая друг друга не касается и едет через b.
    {
      const o5 = fresh('C5');
      const ch = adjacentChain(o5);
      ok('5.chain  нашлась цепочка из трёх', !!ch, JSON.stringify(ch));
      if (ch) {
        const keys5 = seamPosKeys(o5, ch);
        pickIslands(o5, ch);
        runMerge();
        await wait(20);
        const st5 = islands(o5);
        ok('5.chain  шесть островов стало четырьмя', st5.count === 4, 'count=' + st5.count);
        const id5 = st5.islandOf[Array.from(A.selectedElements)[0]];
        const sp5 = spreadAt(o5, id5, keys5);
        ok('5.chain  все три шва сшиты точно', sp5.seen >= 3 && sp5.worst < 1e-6,
           'точек=' + sp5.seen + ' макс=' + sp5.worst.toExponential(2));
        const a5 = areaOf(o5, id5);
        ok('5.chain  складок нет', a5.pos === 0 || a5.neg === 0, 'pos=' + a5.pos + ' neg=' + a5.neg);
        ok('5.chain  в острове три грани', idsOfIsland(o5, id5).length === 3,
           'граней=' + idsOfIsland(o5, id5).length);
      }
    }
    mark('5');

    // ---------------------------------------------------------------- 6
    // Зеркальный остров. Переворачиваем UV одного острова по v - его
    // ориентация становится противоположной соседу. Сшивка обязана
    // развернуть его обратно, иначе внутри одного острова окажется складка.
    {
      const o6 = fresh('C6');
      const p6 = adjacentPair(o6);
      const a6 = Math.min(p6[0], p6[1]), b6 = Math.max(p6[0], p6[1]);
      const uv = o6.mesh.geometry.attributes.uv;
      const { attrIsland } = K.islandVertexMap(o6);
      for (let ai = 0; ai < attrIsland.length; ai++) {
        if (attrIsland[ai] !== b6) continue;
        uv.setY(ai, 2 - uv.getY(ai));      // отражение + сдвиг подальше
      }
      uv.needsUpdate = true;
      const before = areaOf(o6, a6), mirrored = areaOf(o6, b6);
      ok('6.mirror остров действительно перевёрнут',
         (before.total > 0) !== (mirrored.total > 0),
         'a=' + f3(before.total) + ' b=' + f3(mirrored.total));
      // САМО РЕШЕНИЕ, а не его следствие. Прежнее правило - знак суммарной
      // площади всего уложенного листа, с кандидатом уже внутри него - на
      // двух равных по площади островах давало ~1e-17, проваливалось под
      // эпсилон и молча отвечало "не отражать". Следствие при этом выглядело
      // прилично, поэтому спрашиваем ответ напрямую.
      {
        const stG = islands(o6);
        const diag = K.alignUvIslands(o6, stG.islandOf, stG.edgeFaces, new Set([a6, b6]));
        ok('6.mirror отражение действительно решено',
           !!diag && diag.mirrored === 1 && diag.moved === 1,
           diag ? 'moved=' + diag.moved + ' mirrored=' + diag.mirrored : 'null');
      }
      const keys6 = seamPosKeys(o6, [a6, b6]);
      const attr6 = K.islandVertexMap(o6).attrIsland.slice();
      const uv6 = uvSnap(o6);
      pickIslands(o6, [a6, b6]);
      runMerge();
      await wait(20);
      const st6 = islands(o6);
      const id6 = st6.islandOf[Array.from(A.selectedElements)[0]];
      const after6 = areaOf(o6, id6);
      ok('6.mirror складки нет - отражение исправлено',
         after6.pos === 0 || after6.neg === 0, 'pos=' + after6.pos + ' neg=' + after6.neg);
      const sp6 = spreadAt(o6, id6, keys6);
      ok('6.mirror шов всё равно сшит точно', sp6.seen >= 2 && sp6.worst < 1e-6,
         'точек=' + sp6.seen + ' макс=' + sp6.worst.toExponential(2));
      // Равные по площади острова с противоположной ориентацией - ровно тот
      // случай, на котором прежний глобальный тест по знаку площади давал
      // ~1e-17 и молча отвечал "не отражать".
      const mv6 = movedIn(o6, attr6, a6, uv6);
      ok('6.mirror якорь не сдвинулся ни на вершину',
         mv6.seen > 0 && mv6.moved === 0, 'сдвинулось ' + mv6.moved + ' из ' + mv6.seen);
      const mvB = movedIn(o6, attr6, b6, uv6);
      ok('6.mirror а отражённый - сдвинулся весь',
         mvB.seen > 0 && mvB.moved === mvB.seen, 'сдвинулось ' + mvB.moved + ' из ' + mvB.seen);
    }
    mark('6');

    // ---------------------------------------------------------------- 6b
    // Якорь МЕНЬШЕ кандидата и перевёрнут относительно него: сумма площадей
    // уверенно берёт знак кандидата, и правило по суммарной площади здесь
    // ошибается не от невезения, а всегда.
    {
      const o6b = fresh('C6b');
      const p = adjacentPair(o6b);
      const a = Math.min(p[0], p[1]), b = Math.max(p[0], p[1]);
      const uv = o6b.mesh.geometry.attributes.uv;
      const ai0 = K.islandVertexMap(o6b).attrIsland;
      let cx = 0, cy = 0, cn = 0;
      for (let i = 0; i < ai0.length; i++) {
        if (ai0[i] !== a) continue;
        cx += uv.getX(i); cy += uv.getY(i); cn++;
      }
      cx /= cn; cy /= cn;
      for (let i = 0; i < ai0.length; i++) {
        if (ai0[i] === a) {            // якорь вчетверо меньше по площади
          uv.setXY(i, cx + (uv.getX(i) - cx) * 0.5, cy + (uv.getY(i) - cy) * 0.5);
        } else if (ai0[i] === b) {     // кандидат перевёрнут
          uv.setY(i, 2 - uv.getY(i));
        }
      }
      uv.needsUpdate = true;
      const aa = areaOf(o6b, a), ab = areaOf(o6b, b);
      ok('6b.noise якорь меньше кандидата и перевёрнут относительно него',
         Math.abs(aa.total) < Math.abs(ab.total) * 0.5 && (aa.total > 0) !== (ab.total > 0),
         'a=' + f3(aa.total) + ' b=' + f3(ab.total) + ' sum=' + (aa.total + ab.total).toExponential(2));
      const st = islands(o6b);
      const diag = K.alignUvIslands(o6b, st.islandOf, st.edgeFaces, new Set([a, b]));
      ok('6b.noise отражение всё равно решено верно',
         !!diag && diag.mirrored === 1, diag ? 'mirrored=' + diag.mirrored : 'null');
      const keysb = seamPosKeys(o6b, [a, b]);
      pickIslands(o6b, [a, b]);
      runMerge();
      await wait(20);
      const stb = islands(o6b);
      const idb = stb.islandOf[Array.from(A.selectedElements)[0]];
      const ab2 = areaOf(o6b, idb);
      ok('6b.noise складки нет', ab2.pos === 0 || ab2.neg === 0, 'pos=' + ab2.pos + ' neg=' + ab2.neg);
      const spb = spreadAt(o6b, idb, keysb);
      ok('6b.noise шов сшит точно', spb.seen >= 2 && spb.worst < 1e-6,
         'точек=' + spb.seen + ' макс=' + spb.worst.toExponential(2));
    }
    mark('6b');

    // ---------------------------------------------------------------- 7
    // Выделение РЕБРОМ по-прежнему означает "снять шов" и ничего не двигает
    // (поведение v2.52, которое нельзя было сломать).
    {
      const o7 = fresh('C7');
      const before = uvSnap(o7);
      A.uvSelKind = 'edge';
      A.selectedElements = new Set([0]);
      runMerge();
      await wait(20);
      const after = uvSnap(o7);
      let worst = 0;
      for (let i = 0; i < Math.min(before.length, after.length); i += 2) {
        worst = Math.max(worst, Math.hypot(after[i] - before[i], after[i + 1] - before[i + 1]));
      }
      ok('7.edge   шов под ребром снят', islands(o7).count === 5, 'count=' + islands(o7).count);
      ok('7.edge   и координаты не тронуты', worst === 0, 'макс=' + worst.toExponential(2));
    }
    mark('7');

    // ---------------------------------------------------------------- 8
    // Собственные отказы alignUvIslands: один остров - нечего совмещать;
    // нет UV - не с чем работать. Единственное место, где он зовётся
    // напрямую.
    {
      const o8 = fresh('C8');
      const st8 = islands(o8);
      ok('8.guard  один остров - null',
         K.alignUvIslands(o8, st8.islandOf, st8.edgeFaces, new Set([0])) === null);
      const p8 = adjacentPair(o8);
      const good = K.alignUvIslands(o8, st8.islandOf, st8.edgeFaces, new Set(p8));
      ok('8.guard  на согласованной паре отражения нет',
         !!good && good.mirrored === 0, good ? 'mirrored=' + good.mirrored : 'null');
      ok('8.guard  пара островов - результат есть',
         !!good && good.moved === 1 && good.uv.length === o8.mesh.geometry.attributes.uv.count * 2,
         good ? 'moved=' + good.moved + ' worst=' + good.worst.toExponential(2) : 'null');
      ok('8.guard  и он ничего не записал в меш',
         (function () {
           const uv = o8.mesh.geometry.attributes.uv;
           let same = true;
           for (let i = 0; i < uv.count && same; i++) {
             if (Math.abs(uv.getX(i) - good.uv[i * 2]) > 1e-12) same = false;
           }
           return !same;   // хотя бы одна координата в результате отличается от меша
         })(), 'результат - копия, меш не тронут');
      const cnt = o8.mesh.geometry.attributes.uv.count;
      o8.mesh.geometry.deleteAttribute('uv');
      ok('8.guard  без UV - null',
         K.alignUvIslands(o8, st8.islandOf, st8.edgeFaces, new Set(p8)) === null);
      o8.mesh.geometry.setAttribute('uv', new T.Float32BufferAttribute(new Float32Array(cnt * 2), 2));
    }
    mark('8');

    // ---------------------------------------------------------------- 9
    // Якорь - больший остров. Сначала сшиваем пару в остров из двух граней,
    // потом присоединяем к нему одиночную: двигаться обязана одиночная.
    {
      const o9 = fresh('C9');
      const p9 = adjacentPair(o9);
      pickIslands(o9, p9);
      runMerge();
      await wait(20);
      const big = islands(o9).islandOf[Array.from(A.selectedElements)[0]];
      ok('9.anchor собран остров из двух граней',
         idsOfIsland(o9, big).length === 2, 'граней=' + idsOfIsland(o9, big).length);
      const tm = touchMap(o9);
      let small = -1;
      for (let x = 0; x < tm.count && small < 0; x++) {
        if (x === big) continue;
        if (tm.touch.has(Math.min(x, big) + '_' + Math.max(x, big)) && idsOfIsland(o9, x).length === 1) small = x;
      }
      ok('9.anchor нашёлся одиночный сосед', small >= 0, 'small=' + small);
      if (small >= 0) {
        const attr9 = K.islandVertexMap(o9).attrIsland.slice();
        const uv9 = uvSnap(o9);
        pickIslands(o9, [big, small]);
        runMerge();
        await wait(20);
        const mvBig = movedIn(o9, attr9, big, uv9);
        const mvSm = movedIn(o9, attr9, small, uv9);
        ok('9.anchor большой остался на месте',
           mvBig.seen > 0 && mvBig.moved === 0, 'сдвинулось ' + mvBig.moved + ' из ' + mvBig.seen);
        ok('9.anchor а маленький приехал',
           mvSm.seen > 0 && mvSm.moved > 0, 'сдвинулось ' + mvSm.moved + ' из ' + mvSm.seen);
      }
    }
    mark('9');

    // ---------------------------------------------------------------- 10
    // Сосед со схлопнутой развёрткой: подгонять не к чему и не от чего.
    // Остров обязан остаться на месте, а шов - всё равно сняться.
    {
      const o10 = fresh('C10');
      const p = adjacentPair(o10);
      const a = Math.min(p[0], p[1]), b = Math.max(p[0], p[1]);
      const uv = o10.mesh.geometry.attributes.uv;
      const ai0 = K.islandVertexMap(o10).attrIsland;
      let fx = null;
      for (let i = 0; i < ai0.length; i++) {
        if (ai0[i] !== b) continue;
        if (!fx) fx = [uv.getX(i), uv.getY(i)];
        uv.setXY(i, fx[0], fx[1]);          // весь остров в одну точку
      }
      uv.needsUpdate = true;
      const st = islands(o10);
      ok('10.flat  схлопнутый сосед - подгонка отказывает',
         K.alignUvIslands(o10, st.islandOf, st.edgeFaces, new Set([a, b])) === null);
      const before = uvSnap(o10);
      pickIslands(o10, [a, b]);
      runMerge();
      await wait(20);
      const after = uvSnap(o10);
      let d = 0;
      for (let i = 0; i < Math.min(before.length, after.length); i += 2) {
        d = Math.max(d, Math.hypot(after[i] - before[i], after[i + 1] - before[i + 1]));
      }
      ok('10.flat  но шов всё равно снят', islands(o10).count === 5, 'count=' + islands(o10).count);
      ok('10.flat  и ни одна UV не уехала', d === 0, 'макс=' + d.toExponential(2));
    }
    mark('10');

    // Разница масштабов в миллион раз: такая подгонка - это не «остров
    // действительно во столько раз больше», это мусорные соответствия.
    {
      const o11 = fresh('C11');
      const p = adjacentPair(o11);
      const a = Math.min(p[0], p[1]), b = Math.max(p[0], p[1]);
      const uv = o11.mesh.geometry.attributes.uv;
      const ai0 = K.islandVertexMap(o11).attrIsland;
      let cx = 0, cy = 0, cn = 0;
      for (let i = 0; i < ai0.length; i++) {
        if (ai0[i] !== b) continue;
        cx += uv.getX(i); cy += uv.getY(i); cn++;
      }
      cx /= cn; cy /= cn;
      for (let i = 0; i < ai0.length; i++) {
        if (ai0[i] !== b) continue;
        uv.setXY(i, cx + (uv.getX(i) - cx) * 1e6, cy + (uv.getY(i) - cy) * 1e6);
      }
      uv.needsUpdate = true;
      const st = islands(o11);
      ok('11.scale масштаб вне разумного - подгонка отказывает',
         K.alignUvIslands(o11, st.islandOf, st.edgeFaces, new Set([a, b])) === null);
      const before = uvSnap(o11);
      pickIslands(o11, [a, b]);
      runMerge();
      await wait(20);
      const after = uvSnap(o11);
      let d = 0;
      for (let i = 0; i < Math.min(before.length, after.length); i += 2) {
        d = Math.max(d, Math.hypot(after[i] - before[i], after[i + 1] - before[i + 1]));
      }
      ok('11.scale но шов всё равно снят', islands(o11).count === 5, 'count=' + islands(o11).count);
      ok('11.scale и ни одна UV не уехала', d === 0, 'макс=' + d.toExponential(2));
    }
    mark('11');

    finish();
  }

  function boot() {
    K = window.__kubik;
    if (!K || !K.App || !K.HUB_TOOLS_UV) { setTimeout(boot, 120); return; }
    setTimeout(() => {
      run().catch(e => finish('THREW ' + (e && e.stack ? e.stack : e)));
    }, 400);
  }
  if (document.readyState === 'complete') boot();
  else window.addEventListener('load', boot);
})();
