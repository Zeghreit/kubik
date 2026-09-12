/* _histchk - v2.27: что стоит шаг истории.

   Правка меняет, КАК отвечают на вопрос «этот шаг такой же, как предыдущий»:
   был полный JSON.stringify модели дважды на каждую операцию, стало структурное
   сравнение с ранним выходом.

   Первый вариант этой версии считал числовой хэш и использовал его как
   отрицательный тест. Замер его и убил: 9.5 мс против 11.75 мс, которые стоило
   бы просто ЗАПОМНИТЬ одну из двух подписей. 19% не стоят сотни строк обхода,
   у которого цена ошибки - потерянный шаг Undo.

   Сравнение точное, поэтому никакой асимметрии «можно говорить только разные»
   здесь нет. Но проверять надо то же самое: оно обязано видеть КАЖДУЮ правку,
   которую видел stringify, иначе Undo начнёт терять шаги - а «Undo is the one
   thing that has to be trustworthy». Поэтому ниже сначала согласие со
   stringify на всех видах правок, и только потом скорость. */
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
      [a, b, c].forEach(q => positions.push(q[0], q[1], q[2]));
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

  async function run() {
    K = window.__kubik;
    if (!K) { finish('__kubik is undefined - приложение не поднялось'); return; }
    ok('0.boot   сравнение, оценка веса и обрезка экспортированы',
       typeof K.sameDocModel === 'function' && typeof K.estimateDocBytes === 'function' &&
       typeof K.trimHistory === 'function' && typeof K.HISTORY_MIN_STEPS === 'number');
    if (typeof K.sameDocModel !== 'function') { finish(); return; }
    const sigOf = (d) => JSON.stringify({ objects: d.objects, groups: d.groups,
                                          environment: d.environment, materialLib: d.materialLib });

    /* 1 -- ХЭШ СОГЛАСОВАН С ПОДПИСЬЮ В ОДНУ СТОРОНУ: если подписи равны, хэши
       ОБЯЗАНЫ быть равны. Обратное не требуется и не проверяется - в этом и
       смысл. */
    clearScene();
    mkCube('A');
    mkCube('B', 3, 0, 0);
    const d1 = K.serializeDoc();
    const d2 = K.serializeDoc();
    ok('1.same   два снимка одной сцены дают одну подпись',
       sigOf(d1) === sigOf(d2));
    ok('1.same   и сравнение говорит "одинаковые"', K.sameDocModel(d1, d2) === true);
    ok('1.same   и документ равен самому себе', K.sameDocModel(d1, d1) === true);
    mark('1.same');

    /* 2 -- И РАЗЛИЧАЕТ ТО, ЧТО ДОЛЖЕН. Каждая правка ниже - из тех, что
       когда-то терялись: сдвиг вершины, переименование, группа, материал. */
    const o = K.App.objects[0];
    const base = K.serializeDoc();
    const cases = [];

    /* НЕ ПЕРВЫЙ ЭЛЕМЕНТ И НЕ ПЕРВЫЙ ОБЪЕКТ. Первая версия этой секции правила
       только objects[0] и нулевую вершину - и сломанная сборка, которая
       сравнивала массивы ПО ПЕРВОМУ ЭЛЕМЕНТУ, проходила её целиком. Правка,
       которую не видит сравнение, это потерянный шаг Undo, так что случаи
       обязаны лежать в глубине. */
    const o2 = K.App.objects[1];

    // первая вершина - самый простой случай
    const pa = geoOf(o).attributes.position;
    pa.setX(0, pa.getX(0) + 0.0001);
    pa.needsUpdate = true;
    cases.push(['первая вершина на 0.0001', K.serializeDoc()]);
    pa.setX(0, pa.getX(0) - 0.0001);
    pa.needsUpdate = true;

    // ПОСЛЕДНЯЯ вершина первого объекта
    const li = pa.count - 1;
    const lz = pa.getZ(li);
    pa.setZ(li, lz + 0.0001);
    pa.needsUpdate = true;
    cases.push(['ПОСЛЕДНЯЯ вершина первого объекта', K.serializeDoc()]);
    pa.setZ(li, lz);
    pa.needsUpdate = true;

    // вершина ВТОРОГО объекта
    const pa2 = geoOf(o2).attributes.position;
    const m2 = Math.floor(pa2.count / 2);
    const y2 = pa2.getY(m2);
    pa2.setY(m2, y2 + 0.0001);
    pa2.needsUpdate = true;
    cases.push(['вершина ВТОРОГО объекта', K.serializeDoc()]);
    pa2.setY(m2, y2);
    pa2.needsUpdate = true;

    // материал ПОСЛЕДНЕЙ грани второго объекта
    const mats2 = Array.isArray(o2.mesh.material) ? o2.mesh.material : [o2.mesh.material];
    const mLast = mats2[mats2.length - 1];
    const mr = mLast.roughness;
    mLast.roughness = mr + 0.01;
    cases.push(['материал ПОСЛЕДНЕЙ грани второго объекта', K.serializeDoc()]);
    mLast.roughness = mr;

    /* ПОЛЕ, КОТОРОГО В ОДНОМ ДОКУМЕНТЕ НЕТ. autoSmoothAngleDeg пишется только
       когда угол задан, так что это ровно тот случай, на котором в a2.93
       перестал откатываться Group: ключ есть в одном снимке и отсутствует в
       другом, а сравнение по значениям этого не видит. */
    const asWas = o2.mesh.userData.autoSmoothAngle;
    o2.mesh.userData.autoSmoothAngle = 0.7;
    cases.push(['ПОЯВИВШЕЕСЯ поле autoSmoothAngleDeg', K.serializeDoc()]);
    if (asWas === undefined) delete o2.mesh.userData.autoSmoothAngle;
    else o2.mesh.userData.autoSmoothAngle = asWas;

    // имя
    const was = o.name; o.name = was + 'x';
    cases.push(['имя объекта', K.serializeDoc()]);
    o.name = was;

    // материал
    const m0 = Array.isArray(o.mesh.material) ? o.mesh.material[0] : o.mesh.material;
    const hex = m0.color.getHex();
    m0.color.setHex(0x112233);
    cases.push(['цвет материала', K.serializeDoc()]);
    m0.color.setHex(hex);

    // шероховатость на шаг слайдера
    const r0 = m0.roughness; m0.roughness = r0 + 0.01;
    cases.push(['roughness на 0.01', K.serializeDoc()]);
    m0.roughness = r0;

    // положение объекта
    o.mesh.position.x += 0.001;
    cases.push(['позиция объекта', K.serializeDoc()]);
    o.mesh.position.x -= 0.001;

    // группа
    K.App.groups.push({ id: 9991, name: 'G', childIds: [o.id], open: true });
    cases.push(['новая группа', K.serializeDoc()]);
    K.App.groups.pop();

    // окружение
    const env0 = K.App.env.rotation; K.App.env.rotation = env0 + 0.01;
    cases.push(['поворот окружения', K.serializeDoc()]);
    K.App.env.rotation = env0;

    /* КАЖДАЯ правка, которую видит stringify, обязана быть видна сравнению -
       и наоборот. Расхождение в любую сторону это баг: в одну теряется шаг
       Undo, в другую записывается шаг, которого не было. */
    let missed = [], spurious = [];
    cases.forEach(([what, d]) => {
      const sigDiffers = sigOf(d) !== sigOf(base);
      const cmpSame = K.sameDocModel(base, d);
      if (!sigDiffers) { missed.push(what + ' (stringify тоже не видит!)'); return; }
      if (cmpSame) missed.push(what);
    });
    ok('2.diff   сравнение видит ВСЕ правки, которые видит stringify',
       missed.length === 0, missed.join(' | '));
    note('2.diff', 'проверено случаев: ' + cases.length);

    /* NaN. stringify пишет и тот и другой как `null`, то есть считает их
       одинаковыми - и сравнение обязано делать то же, иначе одна NaN-координата
       заставит КАЖДУЮ операцию выглядеть правкой, навсегда. */
    const pn = geoOf(o).attributes.position;
    const nWas = pn.getX(2);
    pn.setX(2, NaN);
    pn.needsUpdate = true;
    const nanA = K.serializeDoc(), nanB = K.serializeDoc();
    ok('2.diff   два снимка с NaN в одном месте равны - как их видит stringify',
       sigOf(nanA) === sigOf(nanB) && K.sameDocModel(nanA, nanB) === true,
       'stringify: ' + (sigOf(nanA) === sigOf(nanB)) +
       ', сравнение: ' + K.sameDocModel(nanA, nanB));
    pn.setX(2, nWas);
    pn.needsUpdate = true;
    const noNan = K.serializeDoc();
    ok('2.diff   а NaN против числа - это правка',
       K.sameDocModel(nanA, noNan) === false);
    // И в обратную сторону: на двух одинаковых снимках оба молчат.
    const s1 = K.serializeDoc(), s2 = K.serializeDoc();
    ok('2.diff   и на одинаковых снимках оба согласны, что правок нет',
       (sigOf(s1) === sigOf(s2)) && K.sameDocModel(s1, s2) === true);
    mark('2.diff');

    /* 3 -- И САМОЕ ВАЖНОЕ: ХЭШ НИКОГДА НЕ РЕШАЕТ САМ. Здесь проверяется не
       значение, а ПУТЬ: pushHistory обязан сравнивать подписи даже когда хэши
       сошлись. Проверяем поведением - после честной правки шаг есть, после
       no-op операции шага нет. */
    clearScene();
    mkCube('A');
    K.App.history.length = 0;
    K.App.historyIndex = -1;
    K.pushHistory();
    const n0 = K.App.history.length;
    ok('3.path   первый шаг записан', n0 === 1, 'шагов=' + n0);

    K.pushHistory();   // ничего не менялось
    ok('3.path   повторный push без правок шага НЕ добавил',
       K.App.history.length === n0, 'шагов=' + K.App.history.length);

    const oa = K.App.objects[0];
    oa.mesh.position.x += 1;
    K.pushHistory();
    ok('3.path   а после настоящей правки - добавил',
       K.App.history.length === n0 + 1, 'шагов=' + K.App.history.length);

    // И правка ВПЕРЁД-НАЗАД обязана снова стать no-op.
    oa.mesh.position.x -= 1;
    K.pushHistory();
    const afterBack = K.App.history.length;
    oa.mesh.position.x += 0;   // буквально ничего
    K.pushHistory();
    ok('3.path   возврат в прежнее состояние - это шаг, а повтор его - нет',
       K.App.history.length === afterBack, 'шагов=' + K.App.history.length);

    /* -0 ПОСЛЕ ЗЕРКАЛА. JSON.stringify пишет и 0, и -0 как "0", так что
       подпись их не различает; хэш по битам различил бы и записал лишний шаг.
       Нормализация в num() для этого и стоит. */
    const pb = geoOf(oa).attributes.position;
    let zi = -1;
    for (let i = 0; i < pb.count; i++) if (pb.getX(i) === 0) { zi = i; break; }
    if (zi < 0) { pb.setX(0, 0); zi = 0; pb.needsUpdate = true; K.pushHistory(); }
    const beforeNeg = K.App.history.length;
    pb.setX(zi, -0);
    pb.needsUpdate = true;
    K.pushHistory();
    ok('3.path   -0 вместо 0 не создаёт лишний шаг - подпись их не различает',
       K.App.history.length === beforeNeg,
       'шагов=' + K.App.history.length + ' было ' + beforeNeg);
    mark('3.path');

    /* 4 -- UNDO/REDO ЖИВЫ. Проверка на поведении, а не на счётчиках. */
    clearScene();
    const ou = mkCube('U');
    K.App.history.length = 0; K.App.historyIndex = -1;
    K.pushHistory();
    for (let i = 1; i <= 4; i++) { ou.mesh.position.x = i; K.pushHistory(); }
    ok('4.undo   пять шагов', K.App.history.length === 5, 'шагов=' + K.App.history.length);
    K.undo(); K.undo();
    const afterUndo = K.findObject(ou.id) ? K.findObject(ou.id).mesh.position.x : null;
    ok('4.undo   два undo вернули на два шага назад', Math.abs(afterUndo - 2) < 1e-6,
       'x=' + afterUndo);
    K.redo();
    const afterRedo = K.findObject(ou.id) ? K.findObject(ou.id).mesh.position.x : null;
    ok('4.undo   redo вернул вперёд', Math.abs(afterRedo - 3) < 1e-6, 'x=' + afterRedo);
    mark('4.undo');

    /* 5 -- ПОТОЛОК ПО РАЗМЕРУ, И ПОЛ, КОТОРЫЙ ЕГО ПЕРЕБИВАЕТ. */
    ok('5.cap    пол ниже потолка по числу шагов',
       K.HISTORY_MIN_STEPS > 0 && K.HISTORY_MIN_STEPS < K.HISTORY_MAX_STEPS,
       'min=' + K.HISTORY_MIN_STEPS + ' max=' + K.HISTORY_MAX_STEPS);
    note('5.cap', 'потолок по памяти ' + Math.round(K.HISTORY_MAX_BYTES / 1048576) + ' МБ');
    /* ОБА ЛИМИТА ОБЯЗАНЫ ЧТО-ТО ЗНАЧИТЬ. На 96 МБ пол был недостижим
       арифметически: чтобы его задеть, шаг должен весить больше 12 МБ, а
       MESH_FACE_BUDGET ограничивает самый тяжёлый шаг примерно 3.3 МБ - то есть
       один из двух лимитов был украшением. Это нашла сломанная сборка, в
       которой пол убрали, и ни одна проверка этого не заметила.

       Проверяется именно арифметика, а не ветка: ветку пола на достижимых
       размерах не выполнить, и делать вид, что она покрыта, хуже, чем сказать,
       что покрыта не она. */
    const heaviestStep = 3.3 * 1048576;          // 12000 граней, измерено
    const atCeiling = Math.floor(K.HISTORY_MAX_BYTES / heaviestStep);
    note('5.cap', 'на самом тяжёлом меше (12000 граней, ~3.3 МБ/шаг) в потолок ' +
         'влезает около ' + atCeiling + ' шагов');
    ok('5.cap    на предельном меше байтовый потолок жёстче шагового - иначе он украшение',
       atCeiling < K.HISTORY_MAX_STEPS, atCeiling + ' < ' + K.HISTORY_MAX_STEPS);
    ok('5.cap    но оставляет больше шагов, чем пол - иначе украшение уже пол',
       atCeiling > K.HISTORY_MIN_STEPS,
       atCeiling + ' > ' + K.HISTORY_MIN_STEPS);
    ok('5.cap    и пол живой в пределах досягаемости: шаг вдвое тяжелее его задевает',
       Math.floor(K.HISTORY_MAX_BYTES / (heaviestStep * 2)) <= K.HISTORY_MIN_STEPS,
       'при ~6.6 МБ/шаг влезает ' +
       Math.floor(K.HISTORY_MAX_BYTES / (heaviestStep * 2)) + ' шагов');

    /* РАЗМЕР ВЫБРАН ТАК, ЧТОБЫ СРАБОТАЛ ИМЕННО БАЙТОВЫЙ ПОТОЛОК. На 3600
       гранях шаг весит 1.32 МБ, и шестьдесят таких влезают в 96 МБ - то есть
       обрезка шла бы по старому лимиту в 60 шагов, и новый лимит проверка бы не
       тронула вообще. 90x90 даёт шаг тяжелее 96/60 МБ, и тогда решает он. */
    clearScene();
    const g5 = triangulatedGrid(90, 0.22);   // 8100 граней
    K.landImport([{ name: 'H', ed: g5, triCount: g5.triCount }], 'H');
    const oh = K.App.objects[0];
    const d5 = K.serializeDoc();
    const cost = K.estimateDocBytes(d5);
    note('5.cap', K.faceCount(geoOf(oh)) + ' граней: один шаг оценён в ' +
         (cost / 1048576).toFixed(2) + ' МБ, то есть ' +
         Math.floor(K.HISTORY_MAX_BYTES / cost) + ' шагов в потолке');
    ok('5.cap    оценка веса шага не ноль и не абсурд',
       cost > 100000 && cost < 200 * 1048576, 'bytes=' + cost);
    ok('5.cap    и байтовый потолок действительно жёстче шагового на этом размере',
       Math.floor(K.HISTORY_MAX_BYTES / cost) < K.HISTORY_MAX_STEPS,
       'в потолок влезает ' + Math.floor(K.HISTORY_MAX_BYTES / cost) +
       ' шагов из ' + K.HISTORY_MAX_STEPS);

    // Набиваем историю и смотрим, что обрезка сработала по РАЗМЕРУ.
    K.App.history.length = 0; K.App.historyIndex = -1;
    K.pushHistory();
    const pushes = K.HISTORY_MAX_STEPS + 5;
    for (let i = 1; i <= pushes; i++) { oh.mesh.position.x = i * 0.01; K.pushHistory(); }
    const kept = K.App.history.length;
    const wouldFit = Math.max(K.HISTORY_MIN_STEPS,
                              Math.floor(K.HISTORY_MAX_BYTES / cost));
    note('5.cap', (pushes + 1) + ' операций -> осталось шагов ' + kept +
         ' (в байтовый потолок влезает около ' + wouldFit +
         ', в шаговый ' + K.HISTORY_MAX_STEPS + ')');
    ok('5.cap    обрезка пошла по РАЗМЕРУ: шагов меньше, чем позволял бы старый лимит',
       kept < K.HISTORY_MAX_STEPS, 'kept=' + kept + ' max=' + K.HISTORY_MAX_STEPS);
    ok('5.cap    и примерно столько, сколько влезает в байты',
       Math.abs(kept - wouldFit) <= 2, 'kept=' + kept + ' влезает=' + wouldFit);
    ok('5.cap    но не меньше пола', kept >= K.HISTORY_MIN_STEPS, 'kept=' + kept);
    ok('5.cap    и курсор остался внутри',
       K.App.historyIndex >= 0 && K.App.historyIndex < K.App.history.length,
       'index=' + K.App.historyIndex + ' из ' + K.App.history.length);
    // И undo после обрезки всё ещё работает.
    const xBefore = K.findObject(oh.id).mesh.position.x;
    K.undo();
    const xAfter = K.findObject(oh.id).mesh.position.x;
    ok('5.cap    undo после обрезки работает', Math.abs(xAfter - xBefore) > 1e-9,
       'было ' + xBefore.toFixed(3) + ', стало ' + xAfter.toFixed(3));
    mark('5.cap');

    /* 5b -- ДВА НАХОДКИ РЕВЬЮ, ОБЕ ПРО ОЦЕНКУ ВЕСА.

       ПЕРВАЯ: строка стоила `JSON.stringify(materialLib).length * 2` и была
       названа «small, and exact». Ни то, ни другое. serializeDoc пишет ВСЮ
       библиотеку, а маска-картинка хранит 128x128 PNG как data URL; четыре
       слота на материал, библиотека не ограничена и живёт в localStorage между
       сессиями. Сорок картинок - это около 2 МБ base64 на шаг, и `* 2` это
       удваивало: base64 - это ASCII, V8 держит такую строку по байту на символ.
       Пользователь с фото-масками на десяти материалах видел, как Undo
       упирается на двенадцатом нажатии - на КУБЕ. */
    const libBytesFor = (len) => K.estimateDocBytes({
      objects: [],
      materialLib: [{ name: 'm', masks: [{ img: 'x'.repeat(len) }] }]
    });
    const b0 = libBytesFor(0), b1 = libBytesFor(100000);
    const perChar = (b1 - b0) / 100000;
    note('5b.lib', 'на символ data URL приходится ' + perChar.toFixed(2) + ' байта оценки');
    ok('5b.lib   картинка в маске считается по БАЙТУ на символ, а не по два',
       Math.abs(perChar - 1) < 0.01, 'perChar=' + perChar.toFixed(3));
    ok('5b.lib   но она всё-таки считается - память настоящая, её тратит каждый шаг',
       b1 > b0 + 90000, 'b0=' + b0 + ' b1=' + b1);
    ok('5b.lib   и оценка не зовёт JSON.stringify - библиотека без картинок дешёвая',
       libBytesFor(0) < 4096, 'bytes=' + libBytesFor(0));

    /* И NaN в документе больше не травит оценку навсегда: одно нечисловое поле
       делало total = NaN, все сравнения с потолком - false, и байтовый потолок
       умирал до конца сессии, в том числе для здоровых шагов. */
    const poisoned = K.estimateDocBytes({ objects: [{ name: 1, geometry: null }] });
    ok('5b.lib   нечисловое поле в документе не делает оценку NaN',
       Number.isFinite(poisoned) && poisoned > 0, 'bytes=' + poisoned);

    /* ВТОРАЯ: пол был числом ШАГОВ, а шаг держит СЦЕНУ, не меш.
       MESH_FACE_BUDGET проверяется на меш; сцену не ограничивает ничто. Четыре
       копии персонажа - это 13 МБ на шаг, и простой пол делал байтовый потолок
       инертным: цикл останавливался на восьми шагах, держащих 104 МБ.

       Жёсткий ярус проверяется через библиотеку, потому что так можно сделать
       шаг любого веса, не строя сцену на сто тысяч граней. */
    ok('5b.tier жёсткий потолок есть и он выше мягкого',
       typeof K.HISTORY_HARD_BYTES === 'number' &&
       K.HISTORY_HARD_BYTES > K.HISTORY_MAX_BYTES,
       'hard=' + Math.round(K.HISTORY_HARD_BYTES / 1048576) + ' МБ, soft=' +
       Math.round(K.HISTORY_MAX_BYTES / 1048576) + ' МБ');

    clearScene();
    mkCube('T');
    // Шаг тяжелее HARD/MIN: восемь таких не влезают в жёсткий потолок.
    const need = Math.ceil(K.HISTORY_HARD_BYTES / K.HISTORY_MIN_STEPS) + 1048576;
    K.MATERIALS.set('probe_fat', { id: 'probe_fat', name: 'fat',
      color: '#808080', roughness: 0.5, metalness: 0,
      masks: [{ type: 'picture', img: 'x'.repeat(need) }] });
    const fatDoc = K.serializeDoc();
    const fatCost = K.estimateDocBytes(fatDoc);
    note('5b.tier', 'шаг с раздутой библиотекой: ' +
         (fatCost / 1048576).toFixed(1) + ' МБ, восемь таких = ' +
         (fatCost * K.HISTORY_MIN_STEPS / 1048576).toFixed(0) + ' МБ против жёстких ' +
         Math.round(K.HISTORY_HARD_BYTES / 1048576) + ' МБ');
    ok('5b.tier и он действительно тяжелее, чем HARD/MIN',
       fatCost * K.HISTORY_MIN_STEPS > K.HISTORY_HARD_BYTES,
       'fat=' + (fatCost / 1048576).toFixed(1) + ' МБ');

    const ot = K.App.objects[0];
    K.App.history.length = 0; K.App.historyIndex = -1;
    K.pushHistory();
    for (let i = 1; i <= 12; i++) { ot.mesh.position.x = i; K.pushHistory(); }
    const fatKept = K.App.history.length;
    note('5b.tier', '13 операций на таких шагах -> осталось ' + fatKept);
    ok('5b.tier на таком весе пол уступает - шагов МЕНЬШЕ восьми',
       fatKept < K.HISTORY_MIN_STEPS, 'kept=' + fatKept + ' пол=' + K.HISTORY_MIN_STEPS);
    ok('5b.tier но не ноль - один шаг остаётся всегда', fatKept >= 1, 'kept=' + fatKept);
    ok('5b.tier и курсор остался внутри',
       K.App.historyIndex >= 0 && K.App.historyIndex < K.App.history.length,
       'index=' + K.App.historyIndex + ' из ' + K.App.history.length);
    K.MATERIALS.delete('probe_fat');
    mark('5b.tier');

    /* 6 -- ЗАМЕР, РАДИ ЧЕГО ВСЁ ЭТО. Хэш против двух stringify. */
    /* СВОЙ СОБСТВЕННЫЙ ТЯЖЁЛЫЙ МЕШ. Секция 5b чистит сцену и оставляет куб, а
       на кубе два stringify стоят 0.0 мс - и отношение к нулю ничего не
       значит. Замер обязан приносить свой предмет с собой. */
    clearScene();
    const g6 = triangulatedGrid(60, 0.22);
    K.landImport([{ name: 'S', ed: g6, triCount: g6.triCount }], 'S');
    const oh2 = K.App.objects[0];
    const dd = K.serializeDoc();
    const dOther = (function () {
      const c = K.serializeDoc();
      c.objects[0].position[0] += 1;     // отличается в ПЕРВОМ же объекте
      return c;
    })();
    let t = performance.now();
    for (let i = 0; i < 10; i++) { sigOf(dd); sigOf(dd); }
    const tOld = (performance.now() - t) / 10;
    t = performance.now();
    for (let i = 0; i < 200; i++) K.sameDocModel(dd, dOther);
    const tDiff = (performance.now() - t) / 200;
    t = performance.now();
    for (let i = 0; i < 20; i++) K.sameDocModel(dd, K.serializeDoc());
    const tEq = (performance.now() - t) / 20 - (function () {
      const t2 = performance.now();
      for (let i = 0; i < 20; i++) K.serializeDoc();
      return (performance.now() - t2) / 20;
    })();
    t = performance.now();
    for (let i = 0; i < 20; i++) K.serializeDoc();
    const tSer = (performance.now() - t) / 20;
    note('6.speed', K.faceCount(geoOf(oh2)) + ' граней: два stringify ' +
         tOld.toFixed(1) + ' мс; сравнение при РАЗНЫХ документах ' +
         tDiff.toFixed(3) + ' мс (ранний выход), при одинаковых ' +
         Math.max(0, tEq).toFixed(1) + ' мс. serializeDoc сам ' +
         tSer.toFixed(1) + ' мс - он остался и теперь главная цена шага.');
    ok('6.speed  обычный случай (что-то изменилось) дешевле двух stringify на два порядка',
       tDiff * 100 < tOld, 'old=' + tOld.toFixed(1) + ' diff=' + tDiff.toFixed(3));
    /* ХУДШИЙ СЛУЧАЙ - это РЕДКИЙ случай, и требование к нему скромное: он не
       должен быть хуже того, что заменил. Раньше 28.9 мс платила КАЖДАЯ
       операция; теперь их платит только no-op, а обычная - две микросекунды. */
    ok('6.speed  а худший случай (документы равны, редкость) не хуже того, что заменил',
       Math.max(0, tEq) <= tOld, 'old=' + tOld.toFixed(1) + ' eq=' + Math.max(0, tEq).toFixed(1));
    mark('6.speed');

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
