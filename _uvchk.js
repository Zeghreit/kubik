/* _uvchk - v2.28: UV как необязательный канал.

   Главная мысль правки не в том, что UV появился, а в том, что НИ ОДНА из 52
   операций о нём не знает. Калитка одна - сравнение длин в
   rebuildFromEditable - и из неё следует всё:

     - операция, которая только ДВИГАЕТ вершины, сохраняет UV бесплатно и
       правильно (трансформ, сглаживание, затенение, симметрия, чистка);
     - операция, которая добавляет или убирает геометрию, теряет UV и говорит
       об этом вслух.

   Поэтому проверки ниже - не про то, что атрибут есть, а про то, что калитка
   стоит в нужную сторону: не роняет того, что должна нести, и не несёт того,
   что обязана уронить. Второе важнее: перенести UV на не те вершины хуже, чем
   потерять его. */
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
  const geoOf = (o) => o.mesh.geometry;
  const uvOf = (o) => geoOf(o).attributes.uv;
  const hasUV = (o) => !!uvOf(o);
  const vertCount = (o) => geoOf(o).attributes.position.count;

  /* Куб с UV, собранный как приземляется импорт: каждый треугольник - своя
     грань, и UV задан так, что его легко проверить - u = x+0.5, v = y+0.5. */
  function landCubeWithUV(name) {
    const ed = K.buildPrimitiveEditable('cube', {});
    // Разворачиваем в плоский список треугольников-граней, как делает импорт.
    const positions = ed.positions.slice();
    const uvs = [];
    for (let i = 0; i < positions.length / 3; i++) {
      uvs.push(positions[i * 3] + 0.5, positions[i * 3 + 1] + 0.5);
    }
    const groups = [];
    ed.groups.forEach(g => g.triangles.forEach(t => groups.push({ triangles: [t.slice()] })));
    K.landImport([{ name: name, ed: { positions: positions, uvs: uvs, groups: groups,
                                     triCount: groups.length } }], name);
    return K.App.objects[K.App.objects.length - 1];
  }

  // UV как строка, чтобы сравнивать побайтово.
  const uvSig = (o) => {
    const a = uvOf(o);
    if (!a) return 'none';
    let s = '';
    for (let i = 0; i < a.count; i++) s += Math.round(a.getX(i) * 1e5) + ',' + Math.round(a.getY(i) * 1e5) + ';';
    return s;
  };

  /* ЧТО ЗНАЧИТ «UV ПРАВИЛЬНЫЙ». Не «он есть», а «он описывает ТЕ вершины».
     Проверяем по построению: u = x+0.5, v = y+0.5 должно держаться на каждой
     вершине, где бы она ни оказалась после пересборки. */
  function uvMatchesRule(o, eps) {
    const g = geoOf(o);
    const pa = g.attributes.position, ua = g.attributes.uv;
    if (!ua) return 'нет UV';
    if (ua.count !== pa.count) return 'длины разошлись: ' + ua.count + ' против ' + pa.count;
    const e = eps === undefined ? 1e-4 : eps;
    let worst = 0;
    for (let i = 0; i < pa.count; i++) {
      const du = Math.abs(ua.getX(i) - (pa.getX(i) + 0.5));
      const dv = Math.abs(ua.getY(i) - (pa.getY(i) + 0.5));
      if (du > worst) worst = du;
      if (dv > worst) worst = dv;
    }
    return worst <= e ? true : ('UV уехал от своей вершины на ' + worst.toFixed(5));
  }

  async function run() {
    K = window.__kubik;
    if (!K) { finish('__kubik is undefined - приложение не поднялось'); return; }
    ok('0.boot   канал и калитка экспортированы',
       typeof K.uvsMatch === 'function' && typeof K.toEditable === 'function');
    if (typeof K.uvsMatch !== 'function') { finish(); return; }

    /* 1 -- КАЛИТКА. Сравнение длин, и ничего умнее. */
    ok('1.gate   UV нужной длины проходит',
       K.uvsMatch({ positions: [0, 0, 0, 1, 0, 0], uvs: [0, 0, 1, 1] }) === true);
    ok('1.gate   короткий не проходит',
       K.uvsMatch({ positions: [0, 0, 0, 1, 0, 0], uvs: [0, 0] }) === false);
    ok('1.gate   длинный тоже',
       K.uvsMatch({ positions: [0, 0, 0, 1, 0, 0], uvs: [0, 0, 1, 1, 2, 2] }) === false);
    ok('1.gate   отсутствующий - это не ошибка, это "нет UV"',
       K.uvsMatch({ positions: [0, 0, 0] }) === false);
    mark('1.gate');

    /* 1b -- И ТА ЖЕ КАЛИТКА НА ПОВЕДЕНИИ, а не только на функции. Операция,
       которая отдала UV не той длины, не должна получить НИКАКОГО UV - ни
       обрезанного, ни дополненного нулями, ни из NaN. Перенести UV на вершины,
       которых он не описывает, хуже, чем потерять его: модель сохраняет
       текстуру, и текстура неверная. */
    clearScene();
    const gcube = landCubeWithUV('Gate');
    const edG = K.toEditable(gcube.mesh);
    /* ЗАЩИЩЕНО ОТ БРОСКА, и это не перестраховка. Первая версия этой секции
       делала `edG.uvs.slice()` без проверки - на сломанной сборке, где UV не
       читается вообще, она упала и утащила с собой ДЕСЯТЬ последующих падений,
       так что сборка с пятью поломками отрапортовала две. Бросок в пробе
       скрывает всё, что за ним. */
    const gateHasUV = !!edG.uvs;
    ok('1b.gate  у снимка UV есть', gateHasUV);
    if (gateHasUV) {
      // Отдаём UV на одну вершину короче, как это сделала бы операция,
      // добавившая геометрию и не знающая про канал.
      edG.uvs = edG.uvs.slice(0, edG.uvs.length - 2);
      K.rebuildFromEditable(gcube, edG);
      ok('1b.gate  UV не той длины отброшен целиком', !hasUV(gcube),
         hasUV(gcube) ? ('остался, count=' + uvOf(gcube).count) : '');
      // И ни одной нечисловой координаты в позициях - геометрия цела.
      ok('1b.gate  и геометрия не пострадала',
         (function () {
           const a = geoOf(gcube).attributes.position.array;
           for (let i = 0; i < a.length; i++) if (!Number.isFinite(a[i])) return false;
           return a.length > 0;
         })());
      // Пустой массив - тоже не UV.
      const edE = K.toEditable(gcube.mesh);
      edE.uvs = [];
      K.rebuildFromEditable(gcube, edE);
      ok('1b.gate  и пустой массив не становится атрибутом нулевой длины',
         !hasUV(gcube), hasUV(gcube) ? ('count=' + uvOf(gcube).count) : '');
    }
    mark('1b.gate');

    /* 2 -- ПРИЗЕМЛЕНИЕ. Импорт с UV доносит его до геометрии, и доносит
       ПРАВИЛЬНО - по правилу, а не просто по наличию атрибута. */
    clearScene();
    const c = landCubeWithUV('UVCube');
    ok('2.land   объект приземлился и у него есть UV', !!c && hasUV(c),
       'objects=' + K.App.objects.length);
    ok('2.land   UV описывает свои вершины', uvMatchesRule(c) === true,
       '' + uvMatchesRule(c));
    note('2.land', 'граней ' + K.faceCount(geoOf(c)) + ', вершин ' + vertCount(c));
    ok('2.land   и примитив БЕЗ UV его не получает',
       (function () {
         const ed = K.buildPrimitiveEditable('cube', {});
         const mats = K.makeMaterialSet(ed.groups.length || 1, 0x9aa3b2);
         const plain = K.createObjectFromEditable('Plain', V(4, 0, 0), ed, mats, {});
         const r = !hasUV(plain);
         try { plain.mesh.parent.remove(plain.mesh); } catch (e) {}
         K.App.objects.splice(K.App.objects.indexOf(plain), 1);
         return r;
       })());
    mark('2.land');

    /* 3 -- КРУГОВОЙ ОБХОД ЧЕРЕЗ toEditable/rebuildFromEditable, то есть то, что
       делает КАЖДАЯ операция. Без изменений UV обязан вернуться тем же. */
    const before = uvSig(c);
    const ed3 = K.toEditable(c.mesh);
    ok('3.trip   toEditable забрал UV', !!ed3.uvs && ed3.uvs.length === vertCount(c) * 2,
       'uvs=' + (ed3.uvs ? ed3.uvs.length : 0) + ' вершин=' + vertCount(c));
    K.rebuildFromEditable(c, ed3);
    ok('3.trip   и пересборка вернула его БАЙТ В БАЙТ', uvSig(c) === before,
       uvSig(c) === before ? '' : 'UV изменился');
    ok('3.trip   и он по-прежнему описывает свои вершины', uvMatchesRule(c) === true,
       '' + uvMatchesRule(c));
    mark('3.trip');

    /* 4 -- ОПЕРАЦИИ, КОТОРЫЕ ТОЛЬКО ДВИГАЮТ ВЕРШИНЫ, сохраняют UV - и ни одна
       из них про UV не знает. Это и есть утверждение версии. */
    clearScene();
    const m = landCubeWithUV('Move');
    K.App.activeObjectId = m.id;
    K.setMode('vertex');
    K.ensureHelpers(m);
    const topo = m.mesh.userData.topo;
    K.App.selectedElements.clear();
    for (let i = 0; i < Math.min(4, topo.logicalCount); i++) K.App.selectedElements.add(i);
    K.refreshUI();
    const r4 = K.canvasEl.getBoundingClientRect();
    const began = K.beginDirectDrag({ clientX: r4.left + r4.width / 2,
                                      clientY: r4.top + r4.height / 2,
                                      pointerId: 1, pointerType: 'touch', button: 0 });
    if (began !== false) {
      /* В X, а не в Z. Правило - u = x+0.5, так что сдвиг по Z его сломать не
         может, и первая версия этой проверки не проверяла ничего. */
      K.applyDeltaToSelection(new K.THREE.Matrix4().makeTranslation(0.4, 0, 0));
      ok('4.move   драг вершин не потерял UV', hasUV(m));
      K.endDirectDrag();
      ok('4.move   и после settle он на месте', hasUV(m),
         'вершин=' + vertCount(m));
      /* Правило u=x+0.5 тут УЖЕ НЕ ДОЛЖНО держаться - вершины переехали по X, а
         UV нет, и это ровно то, чего от UV и хотят: он прилеплен к вершине, а не
         к её положению. Проверяем, что он НЕ пересчитался. */
      ok('4.move   и НЕ пересчитался под новые позиции - UV едет с вершиной',
         uvMatchesRule(m) !== true, 'правило: ' + uvMatchesRule(m));
      /* И ровно столько UV, сколько вершин: драг не добавил и не потерял ни
         одной, значит калитка несла, а не роняла-и-пересобирала. */
      ok('4.move   и длины по-прежнему сходятся',
         uvOf(m).count === vertCount(m),
         uvOf(m).count + ' против ' + vertCount(m));
    } else {
      ok('4.move   драг начался', false, 'began=false');
    }
    mark('4.move');

    /* 5 -- ОПЕРАЦИЯ, КОТОРАЯ МЕНЯЕТ НАБОР ВЕРШИН, теряет UV - и говорит об
       этом. Потерять хуже, чем сохранить, но перенести на не те вершины хуже,
       чем потерять: это и есть причина, по которой калитка закрыта. */
    clearScene();
    const sd = landCubeWithUV('Sub');
    ok('5.drop   до подразбиения UV есть', hasUV(sd));
    const vBefore = vertCount(sd);
    const res = K.subdivideOp(sd, 'keep');
    ok('5.drop   подразбиение выполнено', res !== false, 'вернул ' + res);
    ok('5.drop   набор вершин изменился', vertCount(sd) !== vBefore,
       'было ' + vBefore + ', стало ' + vertCount(sd));
    ok('5.drop   и UV снят, а не перенесён на чужие вершины', !hasUV(sd));
    ok('5.drop   и объект помечен как потерявший UV - тост сказан один раз',
       sd.mesh.userData.kubikUVLost === true,
       'flag=' + sd.mesh.userData.kubikUVLost);
    mark('5.drop');

    /* 5b -- ЧТО НАШЛО РЕВЬЮ, И ПОЧЕМУ ПЕРВАЯ КАЛИТКА БЫЛА НЕВЕРНА.

       Dissolve, Dissolve vertex и Spin НЕ ТРОГАЮТ позиции - они пере-веером
       собирают контур грани из `L.logicalGroups[l][0]`, то есть из НАИМЕНЬШЕГО
       индекса в этой точке, а он после separateGroupVertices принадлежит
       грани с наименьшим номером из касающихся - обычно СОСЕДНЕЙ. Число вершин
       не меняется, так что проверка длин говорила «нести», и склеенная грань
       начинала сэмплить текстурный остров соседа. Молча.

       Это ровно тот провал, который весь этот дизайн называет хуже потери: меш
       сохраняет текстуру, и текстура неверная. Поэтому калитка теперь
       спрашивает не только длину, но и «указывают ли треугольники на ТЕ ЖЕ
       вершины». */
    clearScene();
    const dz = landCubeWithUV('Dis');
    K.App.activeObjectId = dz.id;
    ok('5b.reidx до операции UV есть', hasUV(dz));
    const edR = K.toEditable(dz.mesh);
    ok('5b.reidx toEditable поставил штамп индексов',
       !!edR.uvIndexSig && edR.uvIndexSig.length > 0,
       'sig=' + (edR.uvIndexSig ? edR.uvIndexSig.length : 0));
    // Переиндексируем, не двигая ни одной вершины и не меняя их число - ровно
    // то, что делает Dissolve.
    const g0 = edR.groups[0], g1 = edR.groups[1];
    if (g0 && g1 && g0.triangles.length && g1.triangles.length) {
      const borrowed = g1.triangles[0][0];
      edR.groups[0] = { triangles: g0.triangles.map((tr, k) =>
        k === 0 ? [borrowed, tr[1], tr[2]] : tr.slice()) };
      ok('5b.reidx число вершин не изменилось',
         edR.positions.length / 3 === vertCount(dz),
         edR.positions.length / 3 + ' против ' + vertCount(dz));
      ok('5b.reidx длины UV по-прежнему сходятся - старая калитка сказала бы "нести"',
         K.uvsMatch(edR) === true);
      ok('5b.reidx а новая видит переиндексацию и говорит "уронить"',
         K.uvsStillValid(edR) === false);
      K.rebuildFromEditable(dz, edR);
      ok('5b.reidx и UV действительно снят, а не перенесён на чужие вершины',
         !hasUV(dz));
    } else {
      ok('5b.reidx сцена пригодна для проверки', false, 'нет двух граней');
    }

    // И та же операция, но с честным заявлением `uvsSafe`, UV сохраняет.
    clearScene();
    const ds = landCubeWithUV('Safe');
    const edS = K.toEditable(ds.mesh);
    const h0 = edS.groups[0], h1 = edS.groups[1];
    edS.groups[0] = { triangles: h0.triangles.map((tr, k) =>
      k === 0 ? [h1.triangles[0][0], tr[1], tr[2]] : tr.slice()) };
    edS.uvsSafe = true;
    K.rebuildFromEditable(ds, edS);
    ok('5b.reidx а операция, которая заявила uvsSafe, UV сохраняет', hasUV(ds),
       'это и есть зацепка для этапа 4');
    mark('5b.reidx');

    /* 5c -- ПРИМИТИВ НЕ ДОЛЖЕН ПРИНОСИТЬ UV ОТ BoxGeometry. Каждый объект в
       приложении начинается как BoxGeometry, а у неё есть uv на 24 записи - так
       что утверждение «ни один примитив не имеет UV» было просто неверным, и
       тост «потерял UV» выскакивал на КАЖДОЕ добавление объекта. */
    clearScene();
    const cc = K.createCubeObject('Box', V(0, 0, 0));
    ok('5c.prim  свежий куб из createCubeObject БЕЗ UV', !hasUV(cc),
       hasUV(cc) ? ('count=' + uvOf(cc).count) : '');
    ok('5c.prim  и не помечен потерявшим UV',
       cc.mesh.userData.kubikUVLost === undefined,
       'flag=' + cc.mesh.userData.kubikUVLost);
    const docPrim = K.serializeDoc();
    ok('5c.prim  и документ сцены по умолчанию не получает ключа uv',
       JSON.stringify(docPrim.objects[0].geometry).indexOf('"uv"') < 0);
    mark('5c.prim');

    /* 5d -- SEPARATE И SPLIT НЕСУТ UV. Чистое подмножество с явным ремапом -
       текстурированный персонаж, разобранный на части, терял текстуру целиком,
       и это был названный ревью сценарий. */
    clearScene();
    const twoShell = (function () {
      // Две не связанные оболочки в одном объекте, обе с UV.
      const ed = K.buildPrimitiveEditable('cube', {});
      const positions = [], uvs = [], groups = [];
      const push = (dx) => {
        const off = positions.length / 3;
        for (let i = 0; i < ed.positions.length / 3; i++) {
          positions.push(ed.positions[i * 3] + dx, ed.positions[i * 3 + 1], ed.positions[i * 3 + 2]);
          uvs.push(ed.positions[i * 3] + 0.5, ed.positions[i * 3 + 1] + 0.5);
        }
        ed.groups.forEach(g => g.triangles.forEach(tr =>
          groups.push({ triangles: [[tr[0] + off, tr[1] + off, tr[2] + off]] })));
      };
      push(0); push(4);
      return { positions: positions, uvs: uvs, groups: groups, triCount: groups.length };
    })();
    K.landImport([{ name: 'Shells', ed: twoShell }], 'Shells');
    const sh = K.App.objects[0];
    ok('5d.sep   объект с двумя оболочками и UV приземлился', hasUV(sh));
    /* ПРАВИЛО u=x+0.5 ТУТ НЕ РАБОТАЕТ, и это моя ошибка, не кода: оболочки
       сдвинуты друг от друга, а UV построен по x ДО сдвига, плюс landImport
       рецентрирует. Поэтому перенос проверяется не правилом, а тем, что UV
       каждой части ВЗЯТ ИЗ исходного набора - это и есть «перенесён». */
    const srcUVs = new Set();
    (function () {
       const a = uvOf(sh);
       for (let i = 0; i < a.count; i++) {
         srcUVs.add(Math.round(a.getX(i) * 1e5) + ',' + Math.round(a.getY(i) * 1e5));
       }
    })();
    const parts = K.separateObject(sh);
    ok('5d.sep   Separate разделил', !!parts && parts.length === 2,
       'частей ' + (parts ? parts.length : 0));
    if (parts && parts.length) {
      ok('5d.sep   и КАЖДАЯ часть сохранила UV', parts.every(x => hasUV(x)),
         parts.map(x => hasUV(x) ? 'да' : 'нет').join(','));
      const allFromSource = parts.every(x => {
        const a = uvOf(x);
        if (!a) return false;
        for (let i = 0; i < a.count; i++) {
          const k = Math.round(a.getX(i) * 1e5) + ',' + Math.round(a.getY(i) * 1e5);
          if (!srcUVs.has(k)) return false;
        }
        return true;
      });
      ok('5d.sep   и каждое UV части взято из исходного набора, а не придумано',
         allFromSource, 'исходных пар ' + srcUVs.size);
      ok('5d.sep   и длины у частей сходятся с их вершинами',
         parts.every(x => uvOf(x).count === vertCount(x)),
         parts.map(x => uvOf(x).count + '/' + vertCount(x)).join(' '));
    }
    mark('5d.sep');

    /* 6 -- ФАЙЛ. UV доезжает до документа и обратно, и документ БЕЗ UV
       остаётся ровно таким, каким был до этой версии. */
    clearScene();
    const f = landCubeWithUV('File');
    const fSig = uvSig(f);
    const doc = K.serializeDoc();
    ok('6.file   документ несёт UV',
       !!doc.objects[0].geometry.uv &&
       doc.objects[0].geometry.uv.length === vertCount(f) * 2,
       'uv=' + (doc.objects[0].geometry.uv ? doc.objects[0].geometry.uv.length : 0));
    K.restoreDoc(doc, { keepAppearance: true, keepSelection: true });
    const f2 = K.App.objects[0];
    ok('6.file   и возвращает его байт в байт', hasUV(f2) && uvSig(f2) === fSig,
       hasUV(f2) ? (uvSig(f2) === fSig ? '' : 'UV изменился') : 'UV не вернулся');
    ok('6.file   и правило держится после круга через файл',
       uvMatchesRule(f2) === true, '' + uvMatchesRule(f2));

    clearScene();
    const ed6 = K.buildPrimitiveEditable('cube', {});
    const mats6 = K.makeMaterialSet(ed6.groups.length || 1, 0x9aa3b2);
    K.createObjectFromEditable('NoUV', V(0, 0, 0), ed6, mats6, {});
    const docNo = K.serializeDoc();
    ok('6.file   а документ без UV не получает ключа вовсе - старые файлы те же',
       docNo.objects[0].geometry.uv === undefined,
       'uv=' + JSON.stringify(docNo.objects[0].geometry.uv));
    ok('6.file   и в JSON ключа нет, а не null',
       JSON.stringify(docNo.objects[0].geometry).indexOf('"uv"') < 0);
    mark('6.file');

    /* 7 -- СНИМОК ОПЕРАЦИИ. Каждый кадр перетаскивания ползунка
       восстанавливается из него, и Cancel тоже - снимок без UV снял бы
       текстуру на первом же шевелении бара. */
    clearScene();
    const sn = landCubeWithUV('Snap');
    const snSig = uvSig(sn);
    const st = K.captureObjectState(sn);
    ok('7.snap   снимок несёт UV', !!st.uvs && st.uvs.length === vertCount(sn) * 2,
       'uvs=' + (st.uvs ? st.uvs.length : 0));
    // Портим геометрию, как это делает предпросмотр операции, и восстанавливаем.
    K.subdivideOp(sn, 'keep');
    ok('7.snap   предпросмотр снял UV, как и должен', !hasUV(sn));
    K.restoreObjectState(sn, st);
    ok('7.snap   а восстановление из снимка вернуло его', hasUV(sn) && uvSig(sn) === snSig,
       hasUV(sn) ? (uvSig(sn) === snSig ? '' : 'UV изменился') : 'UV не вернулся');
    mark('7.snap');

    /* 8 -- ЭКСПОРТ. buildExportGroup клонирует геометрию, так что UV должен
       доезжать сам - но «должен сам» это предположение, пока его не спросили. */
    clearScene();
    const e = landCubeWithUV('Exp');
    const grp = K.buildExportGroup();
    let found = null;
    grp.traverse(n => { if (n.isMesh && !found) found = n; });
    ok('8.exp    экспортная группа собрана и в ней есть меш', !!found);
    ok('8.exp    и у него есть UV', !!found && !!found.geometry.attributes.uv,
       found ? ('attrs=' + Object.keys(found.geometry.attributes).join(',')) : '');
    ok('8.exp    той же длины, что у живого',
       !!found && found.geometry.attributes.uv &&
       found.geometry.attributes.uv.count === vertCount(e),
       found && found.geometry.attributes.uv
         ? (found.geometry.attributes.uv.count + ' против ' + vertCount(e)) : '');
    mark('8.exp');

    /* 9 -- ШОВ. Парность на импорте приваривает угол напарника к своему, забирая
       его UV с собой. Два угла в одной точке с РАЗНЫМИ UV - это шов, и склеивать
       их нельзя: мазнёт маппингом одного острова по углу другого. */
    const seam = (function () {
      // Два треугольника одного квада, плоские, но с разрывом UV по общему ребру.
      const A = [0, 0, 0], B = [1, 0, 0], C = [1, 1, 0], D = [0, 1, 0];
      const positions = [], uvs = [], groups = [];
      const add = (tri, uvTri) => {
        const base = positions.length / 3;
        tri.forEach(p => positions.push(p[0], p[1], p[2]));
        uvTri.forEach(q => uvs.push(q[0], q[1]));
        groups.push({ triangles: [[base, base + 1, base + 2]] });
      };
      add([A, B, C], [[0, 0], [1, 0], [1, 1]]);
      // Второй треугольник того же квада, но его UV на общих углах ДРУГОЙ.
      add([A, C, D], [[0.5, 0.5], [0.9, 0.9], [0.5, 0.9]]);
      return { positions: positions, uvs: uvs, groups: groups, triCount: 2 };
    })();
    const rSeam = K.pairTrisInEditable(seam, 40, () => undefined, () => false);
    ok('9.seam   пара через шов не склеена',
       !rSeam.groups || rSeam.pairs === 0,
       rSeam.groups ? ('pairs=' + rSeam.pairs) : ('отказ: ' + rSeam.why));

    // А тот же квад с СОГЛАСОВАННЫМ UV на общих углах - склеивается.
    const noSeam = (function () {
      const A = [0, 0, 0], B = [1, 0, 0], C = [1, 1, 0], D = [0, 1, 0];
      const positions = [], uvs = [], groups = [];
      const uvOfP = (p) => [p[0], p[1]];
      const add = (tri) => {
        const base = positions.length / 3;
        tri.forEach(p => { positions.push(p[0], p[1], p[2]); const q = uvOfP(p); uvs.push(q[0], q[1]); });
        groups.push({ triangles: [[base, base + 1, base + 2]] });
      };
      add([A, B, C]);
      add([A, C, D]);
      return { positions: positions, uvs: uvs, groups: groups, triCount: 2 };
    })();
    const rNo = K.pairTrisInEditable(noSeam, 40, () => undefined, () => false);
    ok('9.seam   а с согласованным UV - склеивается',
       !!rNo.groups && rNo.pairs === 1, rNo.why || ('pairs=' + rNo.pairs));
    ok('9.seam   проверка не тавтология: без UV тот же шовный квад склеился бы',
       (function () {
         const bare = { positions: seam.positions.slice(),
                        groups: seam.groups.map(g => ({ triangles: g.triangles.map(t => t.slice()) })),
                        triCount: 2 };
         const r = K.pairTrisInEditable(bare, 40, () => undefined, () => false);
         return !!r.groups && r.pairs === 1;
       })());
    mark('9.seam');

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
