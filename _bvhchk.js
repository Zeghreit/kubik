/* _bvhchk - v2.25: ускоренный рейкаст через three-mesh-bvh.

   Быстрый ответ не стоит ничего, пока не доказано, что это ТОТ ЖЕ ответ.
   Поэтому почти весь файл - не замер скорости, а сравнение: один и тот же луч
   пускается дважды, штатным путём и ускоренным, и сравниваются ВСЕ поля, по
   которым приложение принимает решения - faceIndex (по нему pickFaceOnActive
   находит грань через topo.faceGroups), точка, расстояние, materialIndex.

   Три вещи, которые здесь легко сломать молча:
     - `indirect: true`: без него MeshBVH ПЕРЕУПОРЯДОЧИВАЕТ индексный буфер, а
       вся карта граней v2.23 - это смещения в него;
     - устаревшее дерево: позиции едут каждый кадр драга, а snapTargetAt
       рейкастит во время драга;
     - порядок установки патча: библиотека захватывает Mesh.prototype.raycast
       себе в таблицу при своей загрузке и зовёт его как фолбэк. */
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
  /* A THROW IS A FAILURE. The first run of this probe threw in section 3 and
     still reported VERDICT=PASS, because `fails` only counts checks that ran -
     and a throw is precisely the case where the rest of them did not. */
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
  const triCount = (o) => (geoOf(o).index ? geoOf(o).index.count / 3 : 0);

  // Та же сетка, что в _v224chk - купол из триангулированных квадов, то есть
  // форма реального импорта.
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

  /* ЛУЧИ, КОТОРЫЕ НЕ ЗАВИСЯТ ОТ ПОЗЫ КАМЕРЫ. Генерируются по сетке NDC и
     пускаются через настоящий raycaster.setFromCamera - то есть ровно так, как
     их пускает приложение, - но детерминированно, чтобы две прогонки
     сравнивались луч к лучу. */
  function ndcGrid(n, reach) {
    const r = reach === undefined ? 0.45 : reach;
    const out = [];
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        out.push({ x: -r + 2 * r * i / (n - 1), y: -r + 2 * r * j / (n - 1) });
      }
    }
    return out;
  }

  // Снимок попаданий по всем объектам сцены для одного набора лучей.
  function shoot(rays, objs) {
    const rc = K.raycaster;
    const meshes = objs.map(o => o.mesh);
    const out = [];
    rays.forEach(nd => {
      rc.setFromCamera(new K.THREE.Vector2(nd.x, nd.y), K.camera);
      const hits = rc.intersectObjects(meshes, false);
      if (!hits.length) { out.push(null); return; }
      const h = hits[0];
      out.push({
        obj: h.object.userData.objId,
        faceIndex: h.faceIndex,
        mi: (h.face && h.face.materialIndex),
        d: h.distance,
        px: h.point.x, py: h.point.y, pz: h.point.z,
        count: hits.length
      });
    });
    return out;
  }

  function diffHits(a, b) {
    const bad = [];
    for (let i = 0; i < a.length; i++) {
      const x = a[i], y = b[i];
      if (!x && !y) continue;
      if (!x || !y) { bad.push(i + ':' + (x ? 'stock hit, bvh miss' : 'bvh hit, stock miss')); continue; }
      if (x.obj !== y.obj) { bad.push(i + ':obj ' + x.obj + '/' + y.obj); continue; }
      if (x.faceIndex !== y.faceIndex) { bad.push(i + ':faceIndex ' + x.faceIndex + '/' + y.faceIndex); continue; }
      if (x.mi !== y.mi) { bad.push(i + ':materialIndex ' + x.mi + '/' + y.mi); continue; }
      if (Math.abs(x.d - y.d) > 1e-6) { bad.push(i + ':distance ' + x.d + '/' + y.d); continue; }
      if (Math.abs(x.px - y.px) > 1e-6 || Math.abs(x.py - y.py) > 1e-6 ||
          Math.abs(x.pz - y.pz) > 1e-6) { bad.push(i + ':point'); continue; }
      if (x.count !== y.count) { bad.push(i + ':hit count ' + x.count + '/' + y.count); continue; }
    }
    return bad;
  }

  const idxSnapshot = (o) => Array.from(geoOf(o).index.array).join(',');

  // Сравнить два пути на текущей сцене и вернуть список расхождений.
  function compare(rays, objs) {
    K.setBVHEnabled(false);
    const stock = shoot(rays, objs);
    K.setBVHEnabled(true);
    const accel = shoot(rays, objs);
    const hitCount = stock.filter(Boolean).length;
    return { bad: diffHits(stock, accel), hits: hitCount, n: rays.length };
  }

  async function run() {
    K = window.__kubik;
    if (!K) { finish('__kubik is undefined - приложение не поднялось'); return; }

    /* 1 -- БИБЛИОТЕКА И ПОРЯДОК УСТАНОВКИ. Патч обязан вставать ПОСЛЕ
       загрузки: библиотека забирает Mesh.prototype.raycast себе в таблицу при
       своей загрузке и зовёт его как фолбэк для геометрии без дерева. Если
       патч поставить раньше, этот фолбэк - сам патч, и всё неускоренное
       рекурсирует до конца стека. */
    ok('1.boot   переключатель и загрузчик экспортированы',
       typeof K.loadBVH === 'function' && typeof K.setBVHEnabled === 'function' &&
       typeof K.freshenBoundsTree === 'function' && typeof K.BVH_MIN_TRIS === 'number');
    if (typeof K.loadBVH !== 'function') { finish(); return; }
    ok('1.boot   до загрузки ускорения нет, и включить его нельзя',
       K.bvhReady === false && K.setBVHEnabled(true) === false);
    let loadErr = null;
    const t0 = performance.now();
    try { await K.loadBVH(); } catch (e) { loadErr = e; }
    const loadMs = Math.round(performance.now() - t0);
    ok('1.boot   three-mesh-bvh загрузился из importmap',
       !loadErr && K.bvhReady === true, loadErr ? ('' + loadErr) : (loadMs + ' мс'));
    if (!K.bvhReady) { finish('без библиотеки остальное проверять нечего'); return; }
    ok('1.boot   прототипы геометрии получили computeBoundsTree/dispose',
       typeof K.THREE.BufferGeometry.prototype.computeBoundsTree === 'function' &&
       typeof K.THREE.BufferGeometry.prototype.disposeBoundsTree === 'function');
    mark('1.boot');

    /* 2 -- ИНДЕКСНЫЙ БУФЕР НЕ ТРОНУТ. Это самая дорогая из возможных тихих
       поломок: вся карта граней v2.23 - смещения в этот буфер, и группы
       отрисовки - его прогоны. MeshBVH по умолчанию переупорядочивает его для
       локальности кэша; `indirect: true` этого не делает. */
    clearScene();
    const grid = triangulatedGrid(60, 0.22);          // 7200 квадов -> 7200 граней
    K.landImport([{ name: 'G', ed: grid, triCount: grid.triCount }], 'G');
    ok('2.index  тяжёлый объект приземлился', K.App.objects.length === 1,
       'objects=' + K.App.objects.length);
    const go = K.App.objects[0];
    note('2.index', 'граней ' + K.faceCount(geoOf(go)) + ', треугольников ' + triCount(go) +
         ', прогонов ' + geoOf(go).groups.length);
    const before = idxSnapshot(go);
    const facesBefore = Array.from(geoOf(go).userData.kubikFaces).join(',');
    const runsBefore = geoOf(go).groups.map(g => g.start + '/' + g.count + '/' + g.materialIndex).join(',');
    K.freshenBoundsTree(geoOf(go));
    ok('2.index  дерево построено', !!geoOf(go).boundsTree);
    ok('2.index  индексный буфер БАЙТ В БАЙТ тот же - indirect работает',
       idxSnapshot(go) === before,
       idxSnapshot(go) === before ? '' : 'буфер переупорядочен');
    ok('2.index  карта граней на месте',
       Array.from(geoOf(go).userData.kubikFaces).join(',') === facesBefore);
    ok('2.index  и прогоны отрисовки тоже',
       geoOf(go).groups.map(g => g.start + '/' + g.count + '/' + g.materialIndex).join(',') === runsBefore);
    mark('2.index');

    /* 3 -- ТОТ ЖЕ ОТВЕТ, 400 ЛУЧЕЙ. Сравниваются все поля, по которым
       приложение принимает решения. */
    K.focusOnAll();
    K.camera.updateMatrixWorld();
    const rays = ndcGrid(20);
    const c3 = compare(rays, K.App.objects);
    note('3.same', 'попаданий ' + c3.hits + ' из ' + c3.n + ' лучей');
    ok('3.same   попаданий достаточно, чтобы сравнение что-то значило',
       c3.hits >= 50, 'hits=' + c3.hits + ' из ' + c3.n);
    ok('3.same   ускоренный ответ совпадает со штатным во всех полях',
       c3.bad.length === 0, c3.bad.slice(0, 6).join(' | '));
    mark('3.same');

    /* 4 -- ТО ЖЕ ПОД УГЛОМ И ВБЛИЗИ. Одна поза камеры ничего не доказывает:
       скользящие лучи и лучи изнутри габарита - это другие ветви обхода. */
    const poses = [
      [2.5, 2.0, 2.5], [0.2, 3.0, 0.05], [3.0, 0.05, 0.0], [0.4, 0.3, 0.5],
      [-2.0, -1.5, 1.0]
    ];
    let worst = 0, total = 0;
    poses.forEach((p, i) => {
      K.camera.position.set(p[0], p[1], p[2]);
      K.camera.lookAt(0, 0, 0);
      K.camera.updateMatrixWorld();
      const c = compare(rays, K.App.objects);
      total += c.hits;
      if (c.bad.length > worst) worst = c.bad.length;
      if (c.bad.length) note('4.poses', 'поза ' + i + ': ' + c.bad.slice(0, 3).join(' | '));
    });
    ok('4.poses  пять поз камеры, 2000 лучей - ни одного расхождения',
       worst === 0, 'расхождений в худшей позе: ' + worst + ', попаданий всего ' + total);
    mark('4.poses');

    /* 5 -- УСТАРЕВШЕЕ ДЕРЕВО. Главная ловушка: applyDeltaToSelection пишет в
       атрибут позиций на каждом кадре драга, а snapTargetAt рейкастит ВО
       ВРЕМЯ драга. Двигаем вершины руками, ровно как это делает драг, и
       спрашиваем, видит ли ускоренный путь новое положение. */
    K.focusOnAll();
    K.camera.updateMatrixWorld();
    K.setBVHEnabled(true);
    const h0 = shoot(rays, K.App.objects);
    const treeBefore = geoOf(go).boundsTree;
    const pa = geoOf(go).attributes.position;
    for (let i = 0; i < pa.count; i++) pa.setZ(i, pa.getZ(i) + 0.5);
    pa.needsUpdate = true;
    geoOf(go).computeBoundingSphere();
    geoOf(go).computeBoundingBox();
    const hMoved = shoot(rays, K.App.objects);
    K.setBVHEnabled(false);
    const hStock = shoot(rays, K.App.objects);
    const stale = diffHits(hStock, hMoved);
    ok('5.stale  после сдвига вершин ускоренный путь видит НОВОЕ положение',
       stale.length === 0, stale.slice(0, 6).join(' | '));
    const moved = diffHits(h0, hStock);
    ok('5.stale  и сдвиг вообще был заметен - проверка не тавтология',
       moved.length > 0, 'изменившихся лучей: ' + moved.length);
    K.setBVHEnabled(true);
    ok('5.stale  дерево переподогнано, а не перестроено с нуля',
       geoOf(go).boundsTree === treeBefore);
    mark('5.stale');

    /* 6 -- МЕЛКИЙ МЕШ ДЕРЕВА НЕ ПОЛУЧАЕТ. Ниже порога построение дороже, чем
       перебор, который оно экономит, и штатный путь обязан остаться штатным. */
    clearScene();
    const cube = mkCube('C');
    ok('6.small  куб - 12 треугольников, это ниже порога',
       triCount(cube) < K.BVH_MIN_TRIS, 'tris=' + triCount(cube) +
       ' порог=' + K.BVH_MIN_TRIS);
    ok('6.small  и bvhWorthIt говорит то же', K.bvhWorthIt(geoOf(cube)) === false);
    K.freshenBoundsTree(geoOf(cube));
    ok('6.small  дерево не построено', !geoOf(cube).boundsTree);
    K.focusOnAll();
    K.camera.updateMatrixWorld();
    const c6 = compare(rays, K.App.objects);
    ok('6.small  и куб по-прежнему пикается точно так же',
       c6.bad.length === 0 && c6.hits > 0,
       'hits=' + c6.hits + ' ' + c6.bad.slice(0, 4).join(' | '));
    mark('6.small');

    /* 7 -- НАСТОЯЩИЙ ПИК ГРАНИ, а не сравнение полей. pickFaceOnActive берёт
       faceIndex и ищет грань через topo.faceGroups; если faceIndex в
       indirect-режиме поехал, именно здесь это и вылезет. */
    clearScene();
    const g2 = triangulatedGrid(40, 0.22);
    K.landImport([{ name: 'P', ed: g2, triCount: g2.triCount }], 'P');
    const po = K.App.objects[0];
    K.App.activeObjectId = po.id;
    K.setMode('face');
    K.ensureHelpers(po);
    K.focusOnAll();
    K.camera.updateMatrixWorld();
    const rect = K.canvasEl.getBoundingClientRect();
    const taps = [];
    for (let i = 1; i <= 6; i++) {
      for (let j = 1; j <= 6; j++) {
        // Middle half of the canvas: focusOnAll puts the model there.
        taps.push({ clientX: rect.left + rect.width * (0.25 + 0.5 * i / 7),
                    clientY: rect.top + rect.height * (0.25 + 0.5 * j / 7) });
      }
    }
    K.setBVHEnabled(false);
    const fStock = taps.map(t => K.pickFaceOnActive(t));
    K.setBVHEnabled(true);
    const fAccel = taps.map(t => K.pickFaceOnActive(t));
    const hitFaces = fStock.filter(x => x >= 0).length;
    ok('7.face   тапы действительно попадают по граням', hitFaces >= 18,
       'попаданий ' + hitFaces + ' из ' + taps.length);
    ok('7.face   pickFaceOnActive возвращает ТУ ЖЕ грань на обоих путях',
       fStock.join(',') === fAccel.join(','),
       fStock.join(',') === fAccel.join(',') ? '' :
       ('stock=' + fStock.slice(0, 8).join(',') + ' bvh=' + fAccel.slice(0, 8).join(',')));
    mark('7.face');

    /* 8 -- DOUBLE SIDE. Зеркальный объект и x-ray включают THREE.DoubleSide, а
       библиотека берёт материал сама - если она смотрит только на material[0]
       или игнорирует side, задние грани начнут или перестанут ловиться. */
    const mats = Array.isArray(po.mesh.material) ? po.mesh.material : [po.mesh.material];
    mats.forEach(m => { m.side = K.THREE.DoubleSide; });
    K.camera.position.set(0, 0, -4);
    K.camera.lookAt(0, 0, 0);
    K.camera.updateMatrixWorld();
    const c8 = compare(rays, K.App.objects);
    ok('8.side   DoubleSide со спины: тот же ответ',
       c8.bad.length === 0, 'hits=' + c8.hits + ' ' + c8.bad.slice(0, 4).join(' | '));
    mats.forEach(m => { m.side = K.THREE.FrontSide; });
    const c8b = compare(rays, K.App.objects);
    ok('8.side   FrontSide со спины: тоже, и попаданий заметно меньше',
       c8b.bad.length === 0, 'hits=' + c8b.hits + ' (было ' + c8.hits + ')');
    ok('8.side   side вообще влияет - проверка не тавтология', c8b.hits < c8.hits,
       c8b.hits + ' < ' + c8.hits);
    mark('8.side');

    /* 9 -- ЗАЧЕМ ВСЁ ЭТО. Замер на форме реального персонажа, и рядом - где
       проходит порог. Цифры уезжают в отчёт, утверждение - только про то, что
       ускорение есть. */
    clearScene();
    const big = triangulatedGrid(95, 0.22);
    K.landImport([{ name: 'H', ed: big, triCount: big.triCount }], 'H');
    const ho = K.App.objects[0];
    K.App.activeObjectId = ho.id;
    K.focusOnAll();
    K.camera.updateMatrixWorld();
    const many = ndcGrid(12);
    const timeIt = (on) => {
      K.setBVHEnabled(on);
      if (on) K.freshenBoundsTree(geoOf(ho));
      shoot(many, K.App.objects);                 // прогрев
      const t = performance.now();
      for (let r = 0; r < 6; r++) shoot(many, K.App.objects);
      return (performance.now() - t) / 6;
    };
    const tAcc = timeIt(true);
    const tStd = timeIt(false);
    K.setBVHEnabled(true);
    note('9.speed', triCount(ho) + ' треугольников, ' + many.length + ' лучей: ' +
         'штатно ' + tStd.toFixed(1) + ' мс, через BVH ' + tAcc.toFixed(1) + ' мс, ' +
         'в ' + (tStd / tAcc).toFixed(1) + ' раза');
    ok('9.speed  на форме персонажа ускорение есть, и не в пределах шума',
       tAcc * 3 < tStd, 'stock=' + tStd.toFixed(1) + ' bvh=' + tAcc.toFixed(1));
    const tBuild = (function () {
      geoOf(ho).disposeBoundsTree();
      const t = performance.now();
      K.freshenBoundsTree(geoOf(ho));
      return performance.now() - t;
    })();
    note('9.speed', 'построение дерева на ' + triCount(ho) + ' треугольниках: ' +
         tBuild.toFixed(1) + ' мс (один раз на объект)');
    const tRefit = (function () {
      const pb = geoOf(ho).attributes.position;
      pb.needsUpdate = true;
      const t = performance.now();
      K.freshenBoundsTree(geoOf(ho));
      return performance.now() - t;
    })();
    note('9.speed', 'переподгонка после кадра драга: ' + tRefit.toFixed(2) + ' мс');
    ok('9.speed  переподгонка укладывается в кадр с большим запасом',
       tRefit < 8, tRefit.toFixed(2) + ' мс');
    mark('9.speed');

    /* 9b -- ЭКОНОМИКА ДРАГА, И ЭТО ТО, ЧТО ПЕРВАЯ ВЕРСИЯ v2.25 СДЕЛАЛА
       НАОБОРОТ. Переподгонка на 18050 треугольниках - 4.1 мс, а ОДИН
       brute-force луч по тому же мешу - 0.33 мс. Драг пускает по одному лучу
       snapTargetAt на кадр, так что чинить дерево ради него - это заплатить
       вдвенадцатеро за то, что экономишь, каждый кадр, ровно на том жесте,
       который и так самый тяжёлый.

       Поэтому политика такая: во время драга дерево НЕ строится и НЕ
       используется, луч уходит штатным путём, а починка происходит один раз -
       в settleShadingAfterDrag. Проверяем все три утверждения. */
    ok('9b.drag  измеренное: переподгонка дороже одного штатного луча',
       tRefit > (tStd / many.length), 'refit=' + tRefit.toFixed(2) +
       ' мс, один луч штатно=' + (tStd / many.length).toFixed(2) + ' мс');

    // Дерево есть и свежее - значит ускоренный путь доступен.
    K.setBVHEnabled(true);
    K.freshenBoundsTree(geoOf(ho));
    ok('9b.drag  вне драга дерево используется', K.bvhUsable(geoOf(ho), ho.mesh) === true);

    // Сдвигаем вершины, как это делает кадр драга: дерево устарело.
    const pc = geoOf(ho).attributes.position;
    pc.setZ(0, pc.getZ(0) + 0.3);
    pc.needsUpdate = true;
    ok('9b.drag  после кадра драга устаревшее дерево НЕ используется',
       K.bvhUsable(geoOf(ho), ho.mesh) === false);
    ok('9b.drag  но оно и не выброшено - чинить будем один раз, на settle',
       !!geoOf(ho).boundsTree);

    // И ответ при устаревшем дереве обязан быть верным, а не быстрым.
    const hAccelStale = shoot(many, K.App.objects);
    K.setBVHEnabled(false);
    const hStockNow = shoot(many, K.App.objects);
    K.setBVHEnabled(true);
    ok('9b.drag  и ответ во время драга верный - луч ушёл штатным путём',
       diffHits(hStockNow, hAccelStale).length === 0,
       diffHits(hStockNow, hAccelStale).slice(0, 4).join(' | '));

    // Settle чинит.
    K.freshenBoundsTree(geoOf(ho));
    ok('9b.drag  settle возвращает дерево в строй',
       K.bvhUsable(geoOf(ho), ho.mesh) === true);

    /* И то же про ПОСТРОЕНИЕ, на НАСТОЯЩЕМ драге. Во время драга дерева быть
       не должно: 4.7 мс уйдут на то, что устареет к следующему кадру. Драг
       начинается через beginDirectDrag, то есть тот самый вход, которым его
       начинает палец, - иначе проверялся бы не драг, а флаг. */
    geoOf(ho).disposeBoundsTree();
    ok('9b.drag  (вне драга) свежая сборка строит дерево',
       K.bvhUsable(geoOf(ho), ho.mesh) === true && !!geoOf(ho).boundsTree,
       'bvhDragging()=' + K.bvhDragging());

    K.App.activeObjectId = ho.id;
    K.setMode('vertex');
    K.ensureHelpers(ho);
    const topo = ho.mesh.userData.topo;
    K.App.selectedElements.clear();
    for (let i = 0; i < 12 && i < topo.logicalCount; i++) K.App.selectedElements.add(i);
    K.refreshUI();
    const r2 = K.canvasEl.getBoundingClientRect();
    const dragEv = { clientX: r2.left + r2.width / 2, clientY: r2.top + r2.height / 2,
                     pointerId: 1, pointerType: 'touch', button: 0 };
    geoOf(ho).disposeBoundsTree();
    const began = K.beginDirectDrag(dragEv);
    ok('9b.drag  настоящий драг начался', began !== false && K.bvhDragging() === true,
       'began=' + began + ' dragging=' + K.bvhDragging());
    if (K.bvhDragging()) {
      ok('9b.drag  во время драга дерево НЕ строится',
         K.bvhUsable(geoOf(ho), ho.mesh) === false && !geoOf(ho).boundsTree,
         'boundsTree=' + !!geoOf(ho).boundsTree);
      // И ответ всё равно верный: луч ушёл штатным путём.
      K.setBVHEnabled(true);
      const inDrag = shoot(many, K.App.objects);
      K.setBVHEnabled(false);
      const inDragStock = shoot(many, K.App.objects);
      K.setBVHEnabled(true);
      ok('9b.drag  и пик во время драга верный',
         diffHits(inDragStock, inDrag).length === 0,
         diffHits(inDragStock, inDrag).slice(0, 4).join(' | '));
    }
    /* И ФИНДИНГ, ИЗ-ЗА КОТОРОГО ВСЯ СЕКЦИЯ ИМЕЕТ СМЫСЛ. Луч, который идёт
       КАЖДЫЙ кадр драга, - это snapTargetAt, и он рейкастит все ОСТАЛЬНЫЕ
       объекты, чтобы найти, к чему прилипнуть. Они во время жеста не
       двигаются, и дерево им законно. Первая версия гейта спрашивала «идёт ли
       драг вообще» и отказывала всем - то есть ровно на том кадровом цикле, для
       которого всё это и делалось, ускорения не было. */
    if (K.bvhDragging()) {
      const other = mkCube('Other', 6, 0, 0);
      const g2b = triangulatedGrid(40, 0.22);
      // Второй тяжёлый объект руками, не через landImport: landImport
      // переcобрал бы сцену и уронил драг.
      const mats2 = K.makeMaterialSet(g2b.groups.length, 0x9aa3b2);
      const heavy2 = K.createObjectFromEditable('Heavy2', V(6, 0, 0), g2b, mats2, {});
      ok('9b.drag  второй тяжёлый объект создан, и он не тот, что тащат',
         triCount(heavy2) >= K.BVH_MIN_TRIS && heavy2.id !== ho.id,
         'tris=' + triCount(heavy2));
      ok('9b.drag  НЕ двигающийся меш получает дерево ДАЖЕ во время драга',
         K.bvhUsable(geoOf(heavy2), heavy2.mesh) === true && !!geoOf(heavy2).boundsTree,
         'usable=' + K.bvhUsable(geoOf(heavy2), heavy2.mesh) +
         ' tree=' + !!geoOf(heavy2).boundsTree);
      ok('9b.drag  а двигающийся - по-прежнему нет',
         K.bvhUsable(geoOf(ho), ho.mesh) === false,
         'tree=' + !!geoOf(ho).boundsTree);
      try { other.mesh.parent.remove(other.mesh); } catch (e) {}
      const oi = K.App.objects.indexOf(other);
      if (oi >= 0) K.App.objects.splice(oi, 1);
    }

    K.endDirectDrag();
    ok('9b.drag  драг закончился и settle построил дерево',
       K.bvhDragging() === false && !!geoOf(ho).boundsTree &&
       K.bvhUsable(geoOf(ho), ho.mesh) === true,
       'dragging=' + K.bvhDragging() + ' tree=' + !!geoOf(ho).boundsTree);
    /* И выключатель обязан выключать не только чтение, но и ПОЧИНКУ. _bvhAccel
       никогда не сбрасывается, так что условие «библиотека когда-либо
       вставала» оставляло settle платить 4-6 мс за дерево, которое с
       выключенным ускорением никто не прочитает. */
    K.setBVHEnabled(false);
    geoOf(ho).disposeBoundsTree();
    K.settleShadingAfterDrag({ objId: ho.id });
    ok('9c.off   с выключенным ускорением settle дерево не строит',
       !geoOf(ho).boundsTree, 'tree=' + !!geoOf(ho).boundsTree);
    K.setBVHEnabled(true);
    K.settleShadingAfterDrag({ objId: ho.id });
    ok('9c.off   а со включённым - строит', !!geoOf(ho).boundsTree);
    mark('9b.drag');

    /* 10 -- ПОРОГ, ИЗМЕРЕННЫЙ, А НЕ УГАДАННЫЙ. На каком размере построение
       дерева начинает отбиваться одним набором лучей. Цифры в отчёт. */
    for (const n of [8, 16, 24, 40]) {
      clearScene();
      const g = triangulatedGrid(n, 0.22);
      K.landImport([{ name: 'T' + n, ed: g, triCount: g.triCount }], 'T' + n);
      if (!K.App.objects.length) { note('10.cross', n + 'x' + n + ': не приземлился'); continue; }
      const o = K.App.objects[0];
      K.focusOnAll();
      K.camera.updateMatrixWorld();
      const rr = ndcGrid(12);
      K.setBVHEnabled(false);
      shoot(rr, K.App.objects);
      let t = performance.now();
      for (let r = 0; r < 8; r++) shoot(rr, K.App.objects);
      const std = (performance.now() - t) / 8;
      K.setBVHEnabled(true);
      geoOf(o).disposeBoundsTree();
      t = performance.now();
      K.freshenBoundsTree(geoOf(o));
      const build = performance.now() - t;
      shoot(rr, K.App.objects);
      t = performance.now();
      for (let r = 0; r < 8; r++) shoot(rr, K.App.objects);
      const acc = (performance.now() - t) / 8;
      note('10.cross', triCount(o) + ' треугольников: штатно ' + std.toFixed(2) +
           ' мс, BVH ' + acc.toFixed(2) + ' мс, построение ' + build.toFixed(2) +
           ' мс, окупается за ' + (build / Math.max(0.001, std - acc)).toFixed(1) +
           ' наборов лучей');
    }
    mark('10.cross');

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
