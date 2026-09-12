/* _v224chk - v2.24: квады на импорте и два бюджета вместо одного.

   Суть правки в одном числе: файл из пайплайна приходит триангулированным,
   поэтому 8858 квадов превращались в 17716 одногранных треугольников, и бюджет
   спрашивали про число, которого в файле никогда не было. Поэтому главная
   проверка здесь - не «парность сработала», а «меш такого размера
   ПРИЗЕМЛЯЕТСЯ», и рядом с ней честный замер времени: парность, которая
   считается полминуты, импорт не спасает. */
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
    if (extra) say(extra);
    say('VERDICT=' + (fails ? 'FAIL' : 'PASS') + ' (' + fails + ' failed)');
    post('/done', OUT.join('\n'));
  }

  let K = null;

  function clearScene() {
    K.App.objects.slice().forEach(o => { try { o.mesh.parent.remove(o.mesh); } catch (e) {} });
    K.App.objects.length = 0;
    K.App.selectedObjectIds = new Set();
    K.App.activeObjectId = null;
    K.App.hidden.clear();
    K.App.mode = 'object';
    K.App.selectedElements.clear();
  }

  /* ЧТО ТАКОЕ «ТРИАНГУЛИРОВАННЫЙ ФАЙЛ» на входе: сетка ячеек, каждая разрезана
     по диагонали на два треугольника, и КАЖДЫЙ треугольник - своя грань.
     Именно в таком виде приезжает любой экспорт из Blender, Tripo и Mixamo.

     Сетка лежит на куполе, а не в плоскости, и это не украшение. На идеально
     плоской сетке все двугранные углы равны нулю, парность становится
     произвольной, и тест мерил бы порядок обхода. На кривой поверхности
     диагональ ячейки - самая плоская пара, которая есть у её треугольников, а
     это ровно то допущение, на котором стоит вся правка. (В реальном импорте
     плоские участки до парности не доходят: их раньше склеивает
     mergeCoplanarTriangles.) */
  function triangulatedGrid(n, bulge, matOfCell) {
    const positions = [];
    const groups = [];
    const h = 2 / n;
    const at = (ix, iy) => {
      const x = -1 + ix * h, y = -1 + iy * h;
      return [x, y, (bulge || 0) * (x * x + y * y)];
    };
    const push = (a, b, c, mat) => {
      const base = positions.length / 3;
      [a, b, c].forEach(p => { positions.push(p[0], p[1], p[2]); });
      const g = { triangles: [[base, base + 1, base + 2]] };
      if (mat !== undefined) g.mat = mat;
      groups.push(g);
    };
    for (let iy = 0; iy < n; iy++) {
      for (let ix = 0; ix < n; ix++) {
        const p00 = at(ix, iy), p10 = at(ix + 1, iy);
        const p11 = at(ix + 1, iy + 1), p01 = at(ix, iy + 1);
        const m = matOfCell ? matOfCell(ix, iy) : undefined;
        push(p00, p10, p11, m);
        push(p00, p11, p01, m);
      }
    }
    return { positions: positions, groups: groups, triCount: groups.length };
  }

  const geoOf = (o) => o.mesh.geometry;
  const runs = (o) => geoOf(o).groups.length;
  const faces = (o) => K.faceCount(geoOf(o));

  function runsCoverIndex(o) {
    const g = geoOf(o);
    const gs = g.groups;
    if (!gs.length) return false;
    let at = 0;
    for (let i = 0; i < gs.length; i++) {
      if (gs[i].start !== at) return false;
      at += gs[i].count;
    }
    return at === g.index.count;
  }

  // Сколько граней имеют ровно четырёхугольный контур - то, ради чего
  // парность и существует: edgeLoopOp шагает только через такие.
  function quadOutlines(ed) {
    let four = 0, other = 0;
    for (let gi = 0; gi < ed.groups.length; gi++) {
      let lp = null;
      try { lp = K.getGroupBoundaryLoopAttr(ed, gi); } catch (e) { lp = null; }
      if (lp && lp.length === 4 && new Set(lp).size === 4) four++; else other++;
    }
    return { four: four, other: other };
  }

  /* Тост читается из элемента, а не перехватом: `toast` - функция модуля, и
     подмена K.toast ничего не меняет для вызовов внутри файла. Элемент она
     пишет синхронно, так что сразу после landImport там уже нужный текст. */
  const toastNow = () => {
    const el = document.getElementById('toast');
    return el ? (el.textContent || '').trim() : '';
  };

  async function run() {
    K = window.__kubik;
    if (!K) { finish('__kubik is undefined - приложение не поднялось'); return; }

    /* 1 -- ЭКСПОРТЫ И САМИ ЧИСЛА. Бюджеты разошлись, и в этом весь смысл: одно
       число было про «каждая грань - draw call», и эта причина ушла в v2.23, а
       второе - про то, что свип пересчитывается каждый кадр перетаскивания. */
    ok('1.boot   ядро парности и оба бюджета экспортированы',
       typeof K.pairTrisInEditable === 'function' &&
       typeof K.MESH_FACE_BUDGET === 'number' &&
       typeof K.OP_FACE_BUDGET === 'number' &&
       typeof K.landImport === 'function');
    if (typeof K.pairTrisInEditable !== 'function') { finish(); return; }
    ok('1.boot   бюджет импорта поднят до 12000',
       K.MESH_FACE_BUDGET === 12000, 'MESH_FACE_BUDGET=' + K.MESH_FACE_BUDGET);
    ok('1.boot   бюджет операций остался 4000',
       K.OP_FACE_BUDGET === 4000, 'OP_FACE_BUDGET=' + K.OP_FACE_BUDGET);
    ok('1.boot   они РАЗНЫЕ (иначе правка ничего не развязала)',
       K.MESH_FACE_BUDGET !== K.OP_FACE_BUDGET);
    /* САМАЯ ВАЖНАЯ ОДНА СТРОКА ВО ВСЁМ ЭТОМ ФАЙЛЕ. SHARP_ANGLE - порог, по
       которому applyShading рисует ребро резким; всё, что гнётся между
       допуском парности и им, приложение само считает складкой, а парность
       это склеивает - и обратно уже не вернуть, потому что ребра больше нет в
       топологии. Допуск обязан быть СТРОГО меньше. */
    const sharpDeg = K.SHARP_ANGLE * 180 / Math.PI;
    ok('1.boot   допуск парности СТРОГО ниже порога резкости приложения',
       K.IMPORT_PAIR_ANGLE < sharpDeg,
       'pair=' + K.IMPORT_PAIR_ANGLE + ' sharp=' + Math.round(sharpDeg));
    ok('1.boot   и не выродился в ноль', K.IMPORT_PAIR_ANGLE >= 15,
       'IMPORT_PAIR_ANGLE=' + K.IMPORT_PAIR_ANGLE);
    ok('1.boot   предел формы квада экспортирован и разумен',
       typeof K.MAX_QUAD_SHAPE_DEG === 'number' &&
       K.MAX_QUAD_SHAPE_DEG > 10 && K.MAX_QUAD_SHAPE_DEG <= 60,
       'MAX_QUAD_SHAPE_DEG=' + K.MAX_QUAD_SHAPE_DEG);
    mark('1.boot');

    /* 2 -- ОДНА ЯЧЕЙКА. Наименьший случай, и он точный: два треугольника,
       согнутые чуть-чуть, обязаны стать ОДНОЙ гранью с четырьмя углами. */
    const one = triangulatedGrid(1, 0.08);
    ok('2.one    на входе две грани по треугольнику', one.groups.length === 2);
    const r1 = K.pairTrisInEditable(one, K.IMPORT_PAIR_ANGLE, () => undefined, () => false);
    ok('2.one    пара найдена', !!r1.groups && r1.pairs === 1,
       r1.why || ('pairs=' + r1.pairs));
    if (r1.groups) {
      one.groups = r1.groups;
      ok('2.one    одна грань из двух', one.groups.length === 1,
         'groups=' + one.groups.length);
      ok('2.one    и в ней два треугольника', one.groups[0].triangles.length === 2);
      const q = quadOutlines(one);
      ok('2.one    контур четырёхугольный - значит по ней пойдёт loop cut',
         q.four === 1 && q.other === 0, 'four=' + q.four + ' other=' + q.other);
    }
    mark('2.one');

    /* 3 -- ЗАЛОМ НЕ СКЛЕИВАЕТСЯ. Те же два треугольника, согнутые на ~80
       градусов: это уже ребро, которое кто-то сделал, и парность обязана
       пройти мимо. Без этой проверки «допуск» - просто число в файле. */
    const fold = { positions: [], groups: [] };
    (function () {
      const P = [[0, 0, 0], [1, 0, 0], [1, 1, 0], [0, 1, 0]];
      const Q = [[0, 0, 0], [1, 0, 0], [1, 0.17, 0.98], [0, 0.17, 0.98]];
      const add = (a, b, c) => {
        const base = fold.positions.length / 3;
        [a, b, c].forEach(p => fold.positions.push(p[0], p[1], p[2]));
        fold.groups.push({ triangles: [[base, base + 1, base + 2]] });
      };
      add(P[0], P[1], P[2]);   // плоский треугольник
      add(Q[0], Q[2], Q[1]);   // его сосед по ребру 0-1, загнутый вверх
      fold.triCount = 2;
    })();
    const rf = K.pairTrisInEditable(fold, K.IMPORT_PAIR_ANGLE, () => undefined, () => false);
    ok('3.fold   залом на ~80 градусов НЕ склеен',
       !rf.groups || rf.pairs === 0, rf.groups ? ('pairs=' + rf.pairs) : ('отказ: ' + rf.why));
    mark('3.fold');

    /* 4 -- МАТЕРИАЛ ИЗ ФАЙЛА РАЗДЕЛЯЕТ ГРАНИ. У импорта нет ни finishes, ни
       затенения - единственное, чем он отвечает на «это одна поверхность?»,
       это ключ материала из файла. Если его не спросить, склейка молча
       перекрашивает половину грани. */
    const two = triangulatedGrid(1, 0.08);
    two.groups[0].mat = 'skin';
    two.groups[1].mat = 'cloth';
    const r2 = K.pairTrisInEditable(two, K.IMPORT_PAIR_ANGLE,
      (gi) => two.groups[gi] && two.groups[gi].mat, () => false);
    ok('4.mat    два материала в одной ячейке НЕ склеены',
       !r2.groups || r2.pairs === 0, r2.groups ? ('pairs=' + r2.pairs) : ('отказ: ' + r2.why));
    mark('4.mat');

    /* 4b -- И ТЕПЕРЬ ТО ЖЕ, НО ТАК, ЧТО ГЕОМЕТРИЯ ТЯНЕТ В ДРУГУЮ СТОРОНУ.
       Проверка 4 спрашивает ядро с ключом, который ей передали; эта спрашивает
       landImport, передаёт ли он ключ ВООБЩЕ. Разница видна только если самая
       плоская пара лежит ЧЕРЕЗ границу материала.

       Две ячейки рядом, каждая согнута по своей диагонали на 20 градусов, а
       друг с другом они лежат в одной плоскости. Тогда пара через общее ребро
       идеально плоская (d=1) и по флатности бьёт обе диагонали (d=cos20). Если
       ключ материала спрашивают - склеятся диагонали, выйдет 2 грани. Если нет
       - выиграет пара через границу, двум оставшимся треугольникам партнёра не
       достанется, и выйдет 3 грани и чужой материал в грани.

       (Заодно это честная запись того, как парность себя ведёт: она идёт за
       плоскостью, а не за исходной сеткой, и ключ материала - единственное,
       что держит её внутри одной поверхности.) */
    function rotAbout(pt, a, b, deg) {
      const P = new K.THREE.Vector3(pt[0], pt[1], pt[2]);
      const A = new K.THREE.Vector3(a[0], a[1], a[2]);
      const B = new K.THREE.Vector3(b[0], b[1], b[2]);
      const u = B.clone().sub(A).normalize();
      const v = P.clone().sub(A);
      const out = v.clone().applyAxisAngle(u, deg * Math.PI / 180).add(A);
      return [out.x, out.y, out.z];
    }
    function foldedPair() {
      const a0 = [0, 0, 0], a1 = [1, 0, 0], a2 = [1, 1, 0], a3 = [0, 1, 0];
      const b1 = [2, 0, 0], b2 = [2, 1, 0];
      //  A2 = a1,a2,a3   (плоская, z=0)      - общее ребро a1-a2 с B1
      //  A1 = a1,a3,P    (согнута на 20 по диагонали a1-a3)
      //  B1 = a1,b1,a2   (плоская, z=0)
      //  B2 = b1,b2',a2  (согнута на 20 по диагонали b1-a2)
      const P = rotAbout(a0, a1, a3, 20);
      const Q = rotAbout(b2, b1, a2, -20);
      const positions = [];
      const groups = [];
      const add = (tri, mat) => {
        const base = positions.length / 3;
        tri.forEach(q => positions.push(q[0], q[1], q[2]));
        groups.push({ triangles: [[base, base + 1, base + 2]], mat: mat });
      };
      add([a1, a3, P], 'm0');      // 0 - ячейка A
      add([a1, a2, a3], 'm0');     // 1 - ячейка A
      add([a1, b1, a2], 'm1');     // 2 - ячейка B
      add([b1, Q, a2], 'm1');      // 3 - ячейка B
      return { positions: positions, groups: groups, triCount: 4 };
    }

    /* ЭТА ГЕОМЕТРИЯ ЛОМАЛА v2.24 И ПЕРЕСТАЛА ЛОМАТЬ v2.24a, и проверка
       записана именно так. По плоскости кросс-пара здесь выигрывает: она
       идеально плоская, а обе диагонали согнуты на 20 градусов. Версия, которая
       считала только плоскость, забирала её и отдавала 3 грани вместо 2. С
       добавленным слагаемым формы исходные ячейки - почти квадраты, а кросс-пара
       перекошена, и сумма ставит диагонали первыми БЕЗ всякого ключа материала.

       Поэтому дальше ключ проверяется не здесь, а на ядре (проверка 4, где
       склеить просто нечего кроме запрещённой пары) и статически в раннере,
       который смотрит, ЧТО landImport передаёт в callback. */
    const fp0 = foldedPair();
    const rNo = K.pairTrisInEditable(fp0, K.IMPORT_PAIR_ANGLE, () => undefined, () => false);
    ok('4b.shape форма сама выбирает исходные квады, без ключа материала',
       !!rNo.groups && rNo.pairs === 2 && rNo.groups.length === 2,
       rNo.why || ('pairs=' + rNo.pairs + ' faces=' + rNo.groups.length));

    const fp1 = foldedPair();
    const rYes = K.pairTrisInEditable(fp1, K.IMPORT_PAIR_ANGLE,
      (gi) => fp1.groups[gi] && fp1.groups[gi].mat, () => false);
    ok('4b.key   с ключом склеены диагонали, а не граница',
       !!rYes.groups && rYes.pairs === 2 && rYes.groups.length === 2,
       rYes.why || ('pairs=' + rYes.pairs + ' faces=' + rYes.groups.length));

    // И то же через landImport, который ключ обязан взять сам.
    clearScene();
    const fpL = foldedPair();
    K.landImport([{ name: 'Folded', ed: {
      positions: fpL.positions, groups: fpL.groups, triCount: 4,
      matSrc: new Map([['m0', null], ['m1', null]]) } }], 'Folded');
    ok('4b.land  landImport спрашивает ключ материала из ФАЙЛА',
       K.App.objects.length === 1 && faces(K.App.objects[0]) === 2,
       'objects=' + K.App.objects.length + ' faces=' +
       (K.App.objects.length ? faces(K.App.objects[0]) : '-'));
    mark('4b.key');

    /* 4c -- И МАТЕРИАЛ ДОЕЗЖАЕТ ДО ТОЙ ЖЕ ГРАНИ. Парность возвращает НОВЫЙ
       список групп, и номера в нём другие - поэтому landImport переносит
       материалы по srcOf. Потерять этот перенос дешевле всего: модель
       приземлится, будет правильной формы и целиком одного цвета, и ни один
       счётчик граней этого не заметит. Поэтому здесь настоящие исходные
       материалы, чтобы idFor намонетил два разных id, и спрашиваем, что у двух
       граней они РАЗНЫЕ и стоят в том порядке, в каком лежат ячейки. */
    clearScene();
    const fpM = foldedPair();
    const srcRed = { color: new K.THREE.Color(0.9, 0.1, 0.1), roughness: 0.2,
                     metalness: 0, name: 'KubikProbeRed' };
    const srcBlue = { color: new K.THREE.Color(0.1, 0.1, 0.9), roughness: 0.9,
                      metalness: 0, name: 'KubikProbeBlue' };
    K.landImport([{ name: 'Painted', ed: {
      positions: fpM.positions, groups: fpM.groups, triCount: 4,
      matSrc: new Map([['m0', srcRed], ['m1', srcBlue]]) } }], 'Painted');
    ok('4c.carry объект приземлился двумя гранями',
       K.App.objects.length === 1 && faces(K.App.objects[0]) === 2,
       'objects=' + K.App.objects.length);
    if (K.App.objects.length === 1) {
      const fin = K.App.objects[0].mesh.userData.finishes || {};
      const f0 = fin[0] || 'standard', f1 = fin[1] || 'standard';
      ok('4c.carry у двух граней РАЗНЫЕ материалы - перенос по srcOf жив',
         f0 !== f1, 'finishes=' + f0 + ' / ' + f1);
      ok('4c.carry и ни один из них не потерян в "standard"',
         f0 !== 'standard' && f1 !== 'standard', 'finishes=' + f0 + ' / ' + f1);
    }
    mark('4c.carry');

    /* 4d -- ПОЛОСА КВАДОВ, КОТОРАЯ ГНЁТСЯ ВДОЛЬ СИЛЬНЕЕ, ЧЕМ ВНУТРИ КВАДА.
       Это контрпример из ревью, и он ломал v2.24 насквозь: пара ЧЕРЕЗ границу
       двух квадов здесь плоскее обеих диагоналей (5.4 градуса против 23.4 и
       23.6), так что выбор «по плоскости» забирал её, а двум оставшимся
       треугольникам партнёра не доставалось - 3 грани вместо 2, одно
       настоящее ребро исчезло, и на его месте встала диагональ триангуляции.

       Чинится вторым слагаемым: настоящий квад почти прямоугольный, а пара
       через его границу - перекошенный змей с углом около 45. Ровно так это
       считает и Tris to Quads у Blender: два угла, Face и Shape, а не один.

       Один материал на всё - иначе проверку вытянул бы ключ материала, а не
       оценка формы, и она бы ничего не доказывала. */
    const strip = (function () {
      const A0 = [0, 0, 0], A1 = [1, 0, 0], A2 = [2, 0.2, 0];
      const B0 = [0, 0, 1], B1 = [1, 0.3, 1], B2 = [2, 0.2, 1];
      const positions = [], groups = [];
      const add = (tri) => {
        const base = positions.length / 3;
        tri.forEach(q => positions.push(q[0], q[1], q[2]));
        groups.push({ triangles: [[base, base + 1, base + 2]] });
      };
      add([A0, A1, B1]);    // 0 - квад 1
      add([A0, B1, B0]);    // 1 - квад 1
      add([A1, A2, B2]);    // 2 - квад 2
      add([A1, B2, B1]);    // 3 - квад 2
      return { positions: positions, groups: groups, triCount: 4 };
    })();
    const rs = K.pairTrisInEditable(strip, K.IMPORT_PAIR_ANGLE, () => undefined, () => false);
    ok('4d.strip полоса квадов даёт ДВЕ грани, а не три',
       !!rs.groups && rs.groups.length === 2 && rs.pairs === 2,
       rs.why || ('faces=' + rs.groups.length + ' pairs=' + rs.pairs));
    if (rs.groups && rs.groups.length === 2) {
      /* И это ИСХОДНЫЕ квады, а не какая-то другая пара на два. Квад 1 - это
         треугольники 0 и 1, то есть индексы 0..5; квад 2 - 6..11. Грань,
         которая взяла по треугольнику из обоих, видна по диапазону. */
      const spans = rs.groups.map(g => {
        let lo = 1e9, hi = -1;
        g.triangles.forEach(t => t.forEach(v => { if (v < lo) lo = v; if (v > hi) hi = v; }));
        return (lo < 6) === (hi < 6);
      });
      ok('4d.strip и это ИСХОДНЫЕ квады - ни одна грань не лезет через границу',
         spans.every(Boolean), 'within=' + spans.join(','));
    }
    mark('4d.strip');

    /* 5 -- ТОТ ЖЕ ПУТЬ, НО ЧЕРЕЗ landImport, и с ключами материала, которые
       совпадают внутри ячейки и расходятся между ячейками. Считаем не только
       грани: ни одна грань не должна состоять из треугольников двух ячеек. */
    clearScene();
    const before = K.App.objects.length;
    const chk = triangulatedGrid(6, 0.10, (ix, iy) => 'm' + ((ix + iy) % 2));
    const srcMat = new Map([['m0', null], ['m1', null]]);
    K.landImport([{ name: 'Checker', ed: { positions: chk.positions.slice(),
      groups: chk.groups.map(g => ({ triangles: g.triangles.map(t => t.slice()), mat: g.mat })),
      triCount: chk.triCount, matSrc: srcMat } }], 'Checker');
    ok('5.land   объект приземлился', K.App.objects.length === before + 1);
    const oc = K.App.objects[K.App.objects.length - 1];
    ok('5.land   36 ячеек из 72 треугольников стали 36 гранями',
       faces(oc) === 36, 'faces=' + faces(oc));
    ok('5.land   и это ОДИН прогон отрисовки', runs(oc) === 1, 'runs=' + runs(oc));
    ok('5.land   прогоны покрывают индекс ровно один раз', runsCoverIndex(oc));
    ok('5.land   материалов по-прежнему по грани',
       Array.isArray(oc.mesh.material) && oc.mesh.material.length === 36,
       'mats=' + (Array.isArray(oc.mesh.material) ? oc.mesh.material.length : 1));
    const edc = K.toEditable(oc.mesh);
    const qc = quadOutlines(edc);
    ok('5.land   все 36 граней четырёхугольные', qc.four === 36 && qc.other === 0,
       'four=' + qc.four + ' other=' + qc.other);
    const t5 = toastNow();
    ok('5.land   тост сказал про квады', /quad/.test(t5), 'toast=' + t5);
    mark('5.land');

    /* 6 -- ТО, ЗА ЧЕМ ВСЁ ЭТО ДЕЛАЛОСЬ. 9025 квадов - это худший реальный
       случай пайплайна (8858) с запасом. До v2.24 он приезжал как 18050
       граней и упирался в 4000; теперь он обязан ПРИЗЕМЛИТЬСЯ. Рядом -
       честное время: если парность считается полминуты, число в бюджете
       ничего не стоит. */
    clearScene();
    const N = 95;
    const big = triangulatedGrid(N, 0.22);
    const ideal = N * N;
    note('6.heavy', 'на входе ' + big.groups.length + ' граней по треугольнику, ' +
         'ячеек ' + ideal);
    ok('6.heavy  до парности это больше бюджета импорта',
       big.groups.length > K.MESH_FACE_BUDGET,
       'tris=' + big.groups.length + ' limit=' + K.MESH_FACE_BUDGET);
    const t0 = performance.now();
    const rb = K.pairTrisInEditable(big, K.IMPORT_PAIR_ANGLE, () => undefined, () => false);
    const ms = Math.round(performance.now() - t0);
    ok('6.heavy  парность не отказалась', !!rb.groups, rb.why || '');
    if (rb.groups) {
      note('6.heavy', 'парность: ' + ms + ' мс на ' + big.groups.length +
           ' треугольников, пар ' + rb.pairs + ' из ' + ideal + ' возможных');
      ok('6.heavy  спарено не меньше 90% возможного',
         rb.pairs >= ideal * 0.9, 'pairs=' + rb.pairs + ' ideal=' + ideal);
      ok('6.heavy  и результат влезает в бюджет импорта',
         rb.groups.length <= K.MESH_FACE_BUDGET,
         'faces=' + rb.groups.length + ' limit=' + K.MESH_FACE_BUDGET);
      ok('6.heavy  а в старый бюджет 4000 он не влезал бы и после парности',
         rb.groups.length > 4000, 'faces=' + rb.groups.length);
      ok('6.heavy  ни один треугольник не потерян и не размножен',
         rb.groups.reduce((a, g) => a + g.triangles.length, 0) === big.groups.length,
         'tris out=' + rb.groups.reduce((a, g) => a + g.triangles.length, 0));
      ok('6.heavy  парность укладывается в 3 секунды',
         ms < 3000, ms + ' мс');
    }
    mark('6.heavy');

    /* 7 -- И ТОТ ЖЕ МЕШ ЦЕЛИКОМ ЧЕРЕЗ ИМПОРТ, потому что бюджет проверяется в
       landImport, а не в ядре, и именно там до v2.24 стоял отказ. Дорого, но
       это единственная проверка, которая отвечает на вопрос пользователя
       словом «открылся». */
    clearScene();
    const heavy = triangulatedGrid(N, 0.22);
    const tl0 = performance.now();
    K.landImport([{ name: 'Heavy', ed: heavy, triCount: heavy.triCount }], 'Heavy');
    const lms = Math.round(performance.now() - tl0);
    ok('7.open   персонаж такого размера приземлился',
       K.App.objects.length === 1, 'objects=' + K.App.objects.length);
    if (K.App.objects.length === 1) {
      const oh = K.App.objects[0];
      note('7.open', 'landImport целиком: ' + lms + ' мс, граней ' + faces(oh) +
           ', прогонов ' + runs(oh) + ', треугольников ' +
           (geoOf(oh).index ? geoOf(oh).index.count / 3 : 0));
      ok('7.open   граней меньше бюджета', faces(oh) <= K.MESH_FACE_BUDGET,
         'faces=' + faces(oh));
      ok('7.open   прогонов отрисовки ЕДИНИЦЫ, а не тысячи', runs(oh) <= 4,
         'runs=' + runs(oh));
      ok('7.open   прогоны покрывают индекс ровно один раз', runsCoverIndex(oh));
      ok('7.open   геометрия цела: треугольников столько же, сколько в файле',
         geoOf(oh).index && geoOf(oh).index.count / 3 === N * N * 2,
         'tris=' + (geoOf(oh).index ? geoOf(oh).index.count / 3 : 0));
      let finite = true;
      const pa = geoOf(oh).attributes.position.array;
      for (let i = 0; i < pa.length; i++) if (!Number.isFinite(pa[i])) { finite = false; break; }
      ok('7.open   и ни одной нечисловой координаты', finite);
      const t7 = toastNow();
      ok('7.open   тост сказал про квады и здесь', /quad/.test(t7), 'toast=' + t7);
      const calls = K.renderNow();
      ok('7.open   и кадр рисуется за единицы вызовов', calls <= 8, 'draw calls=' + calls);
    }
    mark('7.open');

    /* 8 -- ОТКАЗ ВСЁ ЕЩЁ ЕСТЬ. Поднять потолок - не то же самое, что снять
       его: сканированный меш, который после парности всё равно за 12000,
       обязан быть отвергнут словами, а не приземлиться и повесить app. */
    clearScene();
    const tooMany = triangulatedGrid(130, 0.22);   // 33800 треугольников, 16900 ячеек
    ok('8.refuse на входе больше бюджета даже после идеальной парности',
       tooMany.groups.length / 2 > K.MESH_FACE_BUDGET,
       'ideal faces=' + (tooMany.groups.length / 2));
    K.landImport([{ name: 'TooMany', ed: tooMany, triCount: tooMany.triCount }], 'TooMany');
    ok('8.refuse ничего не приземлилось', K.App.objects.length === 0,
       'objects=' + K.App.objects.length);
    const t8 = toastNow();
    ok('8.refuse и отказ назвал число и предел',
       /faces/.test(t8) && /12000/.test(t8), 'toast=' + t8);
    mark('8.refuse');

    /* 9 -- ЛУЧШАЯ ПАРА ПЕРВОЙ, И «ЛУЧШАЯ» - ЭТО СУММА ДВУХ УГЛОВ. У
       треугольника обычно двое желающих, и «кто первый подошёл» оставляет
       лучшую пару ни с кем - так кривая поверхность и выходит половина
       квадами, половина полосками. До v2.24a «лучшая» значила «самая
       плоская», и ровно это было ошибкой.

       Проверка не угадывает ответ, а считает правило: для обоих кандидатов
       берём угол между нормалями и худший угол контура, складываем, и
       спрашиваем, взяло ли ядро меньшую сумму. Так тест проверяет
       задокументированное правило, а не конкретную геометрию. */
    const fan = { positions: [], groups: [] };
    (function () {
      /* РАВНОСТОРОННИЙ центральный треугольник, и это не косметика. С
         прямоугольным любая пара по КАТЕТУ наследует его 45-градусный угол и
         жёсткий предел формы отвергает её сразу - то есть форма решает всё
         ещё до суммы, и сумму проверить нечем. У равностороннего все углы по
         60, обе пары - ромбы одинаковой формы, и остаётся единственная
         разница: насколько пара плоская. Это и проверяем. */
      const A = [0, 0, 0], B = [1, 0, 0], C = [0.5, 0.866, 0];
      const Lp = [-0.5, 0.866, 0.15];        // ромб слева, почти в плоскости
      const Rp = [1.5, 0.866, 0.45];         // такой же ромб справа, но задран
      const add = (a, b, c) => {
        const base = fan.positions.length / 3;
        [a, b, c].forEach(p => fan.positions.push(p[0], p[1], p[2]));
        fan.groups.push({ triangles: [[base, base + 1, base + 2]] });
      };
      add(A, B, C);          // 0 - центральный, индексы 0..2
      add(A, C, Lp);         // 1 - по ребру A-C, почти плоский, 3..5
      add(B, Rp, C);         // 2 - по ребру B-C, задран, 6..8
      fan.triCount = 3;
    })();

    // Та же арифметика, что в ядре, записанная здесь отдельно.
    const vAt = (ed, i) => new K.THREE.Vector3(
      ed.positions[i * 3], ed.positions[i * 3 + 1], ed.positions[i * 3 + 2]);
    const triN = (ed, t) => {
      const a = vAt(ed, t[0]), b = vAt(ed, t[1]), c = vAt(ed, t[2]);
      return new K.THREE.Vector3().crossVectors(b.clone().sub(a), c.clone().sub(a)).normalize();
    };
    const scoreOf = (gi) => {
      const probe = { positions: fan.positions.slice(),
                      groups: fan.groups.map(g => ({ triangles: g.triangles.map(t => t.slice()) })) };
      const n0 = triN(probe, probe.groups[0].triangles[0]);
      const nk = triN(probe, probe.groups[gi].triangles[0]);
      const faceDeg = Math.acos(Math.min(1, Math.max(-1, n0.dot(nk)))) * 180 / Math.PI;
      // Контур пары, через ту же функцию, которой пользуется ядро.
      const single = K.pairTrisInEditable(
        { positions: probe.positions, groups: [probe.groups[0], probe.groups[gi]] },
        180, () => undefined, () => false);
      /* Отказ - это не «не смогли посчитать», а бесконечная цена: пара,
         которую жёсткий предел формы не пускает, проиграет любой допустимой.
         Первая версия этой проверки возвращала null и падала на том, что
         самый ПЛОСКИЙ сосед оказался слишком вытянутым, чтобы быть квадом -
         то есть на правильном поведении v2.24a. */
      if (!single.groups || single.groups.length !== 1) return Infinity;
      const lp = K.getGroupBoundaryLoopAttr(
        { positions: probe.positions, groups: single.groups }, 0);
      if (!lp || lp.length !== 4) return Infinity;
      let worst = 0;
      const ed2 = { positions: probe.positions };
      for (let i = 0; i < 4; i++) {
        const pa = vAt(ed2, lp[(i + 3) % 4]), pb = vAt(ed2, lp[i]), pc = vAt(ed2, lp[(i + 1) % 4]);
        const off = Math.abs(pa.clone().sub(pb).angleTo(pc.clone().sub(pb)) * 180 / Math.PI - 90);
        if (off > worst) worst = off;
      }
      return faceDeg + worst;
    };
    const sL = scoreOf(1), sR = scoreOf(2);
    const fmt = v => (v === Infinity ? 'отказ' : v.toFixed(1));
    ok('9.best   оба кандидата допустимы, значит решает сумма',
       sL !== Infinity && sR !== Infinity && sL !== sR,
       'L=' + fmt(sL) + ' R=' + fmt(sR));
    const rfan = K.pairTrisInEditable(fan, 60, () => undefined, () => false);
    ok('9.best   ровно одна пара из трёх треугольников',
       !!rfan.groups && rfan.pairs === 1, rfan.why || ('pairs=' + rfan.pairs));
    if (rfan.groups) {
      const paired = rfan.groups.find(g => g.triangles.length === 2);
      const tookL = !!paired && paired.triangles.some(t => t.some(v => v >= 3 && v <= 5));
      const tookR = !!paired && paired.triangles.some(t => t.some(v => v >= 6 && v <= 8));
      ok('9.best   и взята пара с МЕНЬШЕЙ суммой двух углов',
         (sL <= sR) ? (tookL && !tookR) : (tookR && !tookL),
         'L=' + fmt(sL) + ' R=' + fmt(sR) +
         ' tookL=' + tookL + ' tookR=' + tookR);
    }
    mark('9.best');

    /* 10 -- БЮДЖЕТ ОПЕРАЦИЙ НЕ УЕХАЛ ВМЕСТЕ С ИМПОРТНЫМ, и это проверяется
       настоящим отказом, а не константой. Свип - та самая причина, по которой
       числа разошлись: он пересчитывается целиком на каждом кадре
       перетаскивания ползунка, так что поднять ему потолок до 12000 значило
       бы разрешить ползунку строить 12000 граней в кадр. */
    clearScene();
    const pts = [];
    for (let i = 0; i < 120; i++) pts.push(new K.THREE.Vector3(i * 0.1, 0, 0));
    const cur = K.createCurveObject('C', new K.THREE.Vector3(0, 0, 0), pts, {});
    const rt = K.tubeCurveOp(cur, 0.2, 64, true, null);
    ok('10.ops   свип на 120x64 отказан', !!rt && rt.ok === false,
       rt ? ('ok=' + rt.ok) : 'вернул ничего');
    ok('10.ops   и отказ называет 4000, а не 12000',
       !!rt && /4000/.test(rt.why || '') && !/12000/.test(rt.why || ''),
       rt ? ('why=' + rt.why) : '');
    mark('10.ops');

    /* 11 -- ДВА БЮДЖЕТА, КОТОРЫХ НЕ БЫЛО ВООБЩЕ. Ревью нашло их обоих, и
       оба проверяются настоящим отказом: статическая половина на них даёт
       ложный зелёный, потому что сломанная сборка оставляет имя константы
       внутри мёртвой ветки, и поиск по тексту его находит. */

    /* Lathe никогда не имел бюджета граней - Tube получил его в v2.24, а этот
       пропустили. Проверка стоит на revolveSweep, куда приходят и Lathe, и
       Revolve по меш-профилю. */
    clearScene();
    const lpts = [];
    for (let i = 0; i < 200; i++) lpts.push(new K.THREE.Vector3(1 + i * 0.01, i * 0.02, 0));
    const lcur = K.createCurveObject('L', new K.THREE.Vector3(0, 0, 0), lpts, {});
    const rl = K.latheCurveOp(lcur, 'y', 360, 32, 1);
    ok('11.lathe токарка на 200x32 отказана, а не построена',
       !!rl && rl.ok === false, rl ? ('ok=' + rl.ok) : 'вернул ничего');
    ok('11.lathe и отказ называет 4000 - это покадровый бюджет',
       !!rl && /4000/.test(rl.why || ''), rl ? ('why=' + rl.why) : '');

    /* Subdivide - единственная операция, которая МНОЖИТ уже имеющееся число
       граней, и до ревью она была без бюджета совсем. Берём сетку, которую
       импорт теперь пропускает, и просим уровень: 3136 квадов дают 12544
       грани, то есть за потолок. */
    clearScene();
    const sgrid = triangulatedGrid(56, 0.22);
    K.landImport([{ name: 'Grid', ed: sgrid, triCount: sgrid.triCount }], 'Grid');
    ok('11.sub   сетка на 3136 квадов приземлилась',
       K.App.objects.length === 1 && faces(K.App.objects[0]) === 3136,
       'objects=' + K.App.objects.length + ' faces=' +
       (K.App.objects.length ? faces(K.App.objects[0]) : '-'));
    if (K.App.objects.length === 1) {
      const so = K.App.objects[0];
      const was = faces(so);
      const rs2 = K.subdivideOp(so, 'keep');
      ok('11.sub   подразбиение отказано, а не выполнено',
         rs2 === false, 'вернул ' + rs2);
      ok('11.sub   и меш не тронут', faces(so) === was,
         'faces=' + faces(so) + ' было ' + was);
      ok('11.sub   отказ назвал число и потолок',
         /12000/.test(K.opRefusal || '') && /faces/.test(K.opRefusal || ''),
         'opRefusal=' + K.opRefusal);
    }
    mark('11.budgets');

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
