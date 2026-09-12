/* _matchk - v2.29: библиотека материалов. Две жалобы, две разные болезни.

   1. КАЖДЫЙ ОТКРЫТЫЙ МЕШ ПЛОДИЛ МАТЕРИАЛЫ. Подпись материала включает имя,
      цвет, roughness, metalness, фаску и маски - и совпадение требовалось
      ТОЧНОЕ. Любая мелочь мимо: цвет, съехавший на один 8-битный шаг на
      круге sRGB -> linear -> sRGB, roughness 0.52 вместо 0.5, правка,
      сделанная руками после первого импорта. Промах по подписи вёл в
      единственную оставшуюся ветку - ЧЕКАНИТЬ: "Skin (imported)", потом
      "Skin (imported 2)". Стопка росла на запись за открытие и никогда не
      сливалась обратно.

   2. МАТЕРИАЛ, КОТОРЫЙ НЕЛЬЗЯ НИ УДАЛИТЬ, НИ ОТРЕДАКТИРОВАТЬ. Другая
      причина, не связанная с первой. getMaterialDef на незнакомый id
      возвращает ПРЕСЕТ Solid - это верно для всех путей рисования и ложь для
      редактора. Карточка в полке запоминает свой id при сборке полки, а
      импорт или откат переименовывают и выбрасывают id под открытой полкой.
      Открытие такой карточки отдавало Solid под её именем: заголовок
      "Solid (preset)", кнопка Delete спрятана (пресеты не удаляются), а все
      одиннадцать ручек правили Solid.

   Проверки ниже - про ворота, а не про наличие. Слияние обязано срабатывать
   по имени и обязано НЕ срабатывать там, где имени нет: схлопнуть все
   безымянные материалы файла в одну запись - потерять их цвета, то есть
   ровно противоположность слиянию. */
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

  // ---- хелперы -------------------------------------------------------------

  // Библиотека ровно из трёх пресетов, как на чистой машине.
  function resetLib() {
    Array.from(K.MATERIALS.keys()).forEach(id => {
      if (!K.MATERIAL_DEFAULTS[id]) K.MATERIALS.delete(id);
    });
    Object.keys(K.MATERIAL_DEFAULTS).forEach(id => {
      const d = K.MATERIALS.get(id);
      if (d) { Object.assign(d, K.MATERIAL_DEFAULTS[id], { id: id, preset: true }); d.bevel = 0; d.masks = []; }
    });
  }

  function addCustom(id, name, hex, rough, metal) {
    K.MATERIALS.set(id, { id: id, preset: false, name: name, color: hex,
      roughness: rough, metalness: metal, bevel: 0, masks: [] });
    return id;
  }

  // Источник такой, каким его отдаёт GLTFLoader: THREE-материал.
  function src(name, hex, rough, metal) {
    const m = new K.THREE.MeshStandardMaterial({ color: new K.THREE.Color(hex) });
    m.name = name;
    m.roughness = rough;
    m.metalness = metal;
    return m;
  }

  const ids = () => Array.from(K.MATERIALS.keys()).join(',');
  const names = () => Array.from(K.MATERIALS.values()).map(d => d.name).join('|');
  const anyImportedName = () => Array.from(K.MATERIALS.values())
    .some(d => /\(imported/i.test(d.name || ''));
  const bodyHas = (s) => (document.body.innerText || '').indexOf(s) >= 0;

  // ---- прогон --------------------------------------------------------------

  async function run() {
    K = window.__kubik;

    /* ================= 1. Слияние по имени (то, о чём просили) ============ */

    resetLib();
    addCustom('mat_skin', 'Skin', '#aa8866', 0.5, 0);
    let n0 = K.MATERIALS.size;
    let ctx = K.importMaterialContext();
    /* Цвет на один 8-битный шаг мимо И roughness мимо на 0.02 - ровно то, чем
       отличается материал, съездивший в файл и обратно, от своего оригинала. */
    let got = ctx.idFor(src('Skin', '#aa8867', 0.52, 0));
    ok('1.1 имя совпало - берём то, что уже есть, а не чеканим копию',
       got === 'mat_skin', 'idFor -> ' + got);
    ok('1.1 в библиотеке не появилось записи',
       K.MATERIALS.size === n0, n0 + ' -> ' + K.MATERIALS.size + ' [' + names() + ']');
    ok('1.1 и ничего не названо "(imported)"', !anyImportedName(), names());

    const skin = K.MATERIALS.get('mat_skin');
    ok('1.2 ПОБЕЖДАЕТ МЕСТНОЕ определение - файл его не перекрашивает',
       skin.color === '#aa8866' && Math.abs(skin.roughness - 0.5) < 1e-9,
       skin.color + ' rough=' + skin.roughness);

    ctx = K.importMaterialContext();
    got = ctx.idFor(src('SKIN', '#112233', 0.9, 1));
    ok('1.3 регистр имени не важен', got === 'mat_skin', 'idFor -> ' + got);

    ctx = K.importMaterialContext();
    got = ctx.idFor(src('Skin', '#aa8866', 0.5, 0));
    ok('1.4 точное совпадение подписи по-прежнему работает',
       got === 'mat_skin' && K.MATERIALS.size === n0, 'idFor -> ' + got);
    mark('1.merge');

    /* Имени в библиотеке нет - чеканим, но РОВНО ОДИН раз и без суффикса. */
    resetLib();
    addCustom('mat_skin', 'Skin', '#aa8866', 0.5, 0);
    n0 = K.MATERIALS.size;
    ctx = K.importMaterialContext();
    got = ctx.idFor(src('Gold', '#ffcc33', 0.3, 1));
    ok('1.5 незнакомое имя - одна новая запись',
       K.MATERIALS.size === n0 + 1, n0 + ' -> ' + K.MATERIALS.size);
    ok('1.5 и она названа своим именем, без "(imported)"',
       got && K.MATERIALS.get(got) && K.MATERIALS.get(got).name === 'Gold',
       got + ' -> ' + (K.MATERIALS.get(got) || {}).name);

    /* ЛОВУШКА, и она важнее всего остального в этой группе. Безымянные
       материалы слипаться не должны: raw подставляет "Imported" за них
       обоих, и слияние по имени схлопнуло бы красный с синим в один. */
    resetLib();
    n0 = K.MATERIALS.size;
    ctx = K.importMaterialContext();
    const u1 = ctx.idFor(src('', '#ff0000', 0.5, 0));
    const u2 = ctx.idFor(src('', '#0000ff', 0.5, 0));
    ok('1.6 два БЕЗЫМЯННЫХ источника остаются двумя записями',
       !!u1 && !!u2 && u1 !== u2, u1 + ' / ' + u2);
    ok('1.6 цвета уцелели',
       !!K.MATERIALS.get(u1) && !!K.MATERIALS.get(u2) &&
       K.MATERIALS.get(u1).color === '#ff0000' && K.MATERIALS.get(u2).color === '#0000ff',
       (K.MATERIALS.get(u1) || {}).color + ' / ' + (K.MATERIALS.get(u2) || {}).color);
    /* И между ФАЙЛАМИ тоже: безымянный источник не садится на "Imported",
       оставленный предыдущим импортом. */
    const afterU = K.MATERIALS.size;
    ctx = K.importMaterialContext();
    const u3 = ctx.idFor(src('', '#00ff00', 0.5, 0));
    ok('1.6 и безымянный из следующего файла - тоже своя запись',
       u3 !== u1 && u3 !== u2 && K.MATERIALS.size === afterU + 1,
       u3 + ' size ' + K.MATERIALS.size);

    /* Повторный импорт того же файла: свежий контекст, тот же источник. */
    resetLib();
    addCustom('mat_skin', 'Skin', '#aa8866', 0.5, 0);
    n0 = K.MATERIALS.size;
    for (let i = 0; i < 4; i++) {
      const c = K.importMaterialContext();
      c.idFor(src('Skin', '#aa88' + (66 + i), 0.5 + i * 0.01, 0));
    }
    ok('1.7 четыре открытия одного и того же - библиотека не растёт',
       K.MATERIALS.size === n0, n0 + ' -> ' + K.MATERIALS.size + ' [' + names() + ']');

    /* ПРЕСЕТ НЕ ЦЕЛЬ ДЛЯ СЛИЯНИЯ. Solid, Plastic и Metal несут color: null -
       "какой сейчас серый у темы", - поэтому слить ЗОЛОТОЙ материал с именем
       "Metal" на пресет Metal значит перекрасить его в серый и заставить
       следовать теме навсегда. А "Metal" - одно из самых частых имён в
       скачанном ассете. */
    resetLib();
    n0 = K.MATERIALS.size;
    ctx = K.importMaterialContext();
    got = ctx.idFor(src('Metal', '#ffcc33', 0.2, 1));
    ok('1.8 золотой "Metal" НЕ становится пресетом Metal',
       got !== 'metal', 'idFor -> ' + got);
    ok('1.8 он получает свою запись и своё золото',
       K.MATERIALS.size === n0 + 1 && (K.MATERIALS.get(got) || {}).color === '#ffcc33',
       (K.MATERIALS.get(got) || {}).name + ' ' + (K.MATERIALS.get(got) || {}).color);
    const met = K.MATERIALS.get('metal');
    ok('1.8 и пресет Metal не тронут',
       met.color === null && Math.abs(met.roughness - K.MATERIAL_DEFAULTS.metal.roughness) < 1e-9,
       met.color + ' rough=' + met.roughness);

    /* А дорога на пресет осталась ровно одна - та, что была: цвет, который
       ЕСТЬ наш серый, с roughness пресета. Иначе экспорт куба и его открытие
       обратно чеканили явный серый, и куб перестал бы следовать теме. */
    resetLib();
    n0 = K.MATERIALS.size;
    ctx = K.importMaterialContext();
    got = ctx.idFor(src('Whatever', K.themedGreyHex(), K.MATERIAL_DEFAULTS.metal.roughness,
                        K.MATERIAL_DEFAULTS.metal.metalness));
    ok('1.9 наш серый с roughness пресета по-прежнему ЕСТЬ пресет',
       got === 'metal' && K.MATERIALS.size === n0, 'idFor -> ' + got);

    /* ДВА ОДНОИМЁННЫХ МАТЕРИАЛА В ОДНОМ ФАЙЛЕ - это два материала. Схлопнуть
       их значит убить один из двух цветов: ровно то, от чего защищён
       безымянный случай. Свежая запись не становится целью для слияния
       внутри своего же импорта. */
    resetLib();
    n0 = K.MATERIALS.size;
    ctx = K.importMaterialContext();
    const m1 = ctx.idFor(src('Material', '#ff0000', 0.5, 0));
    const m2 = ctx.idFor(src('Material', '#0000ff', 0.5, 0));
    ok('1.10 два "Material" в одном файле остаются двумя',
       m1 !== m2 && K.MATERIALS.size === n0 + 2, m1 + ' / ' + m2);
    ok('1.10 оба цвета уцелели',
       (K.MATERIALS.get(m1) || {}).color === '#ff0000' &&
       (K.MATERIALS.get(m2) || {}).color === '#0000ff',
       (K.MATERIALS.get(m1) || {}).color + ' / ' + (K.MATERIALS.get(m2) || {}).color);

    /* ...но то же имя из СЛЕДУЮЩЕГО файла садится на то, что оставил этот. */
    const after = K.MATERIALS.size;
    ctx = K.importMaterialContext();
    got = ctx.idFor(src('Material', '#ff0001', 0.51, 0));
    ok('1.10 а из следующего файла - сливается, а не чеканит',
       got === m1 && K.MATERIALS.size === after, 'idFor -> ' + got + ' size ' + K.MATERIALS.size);

    /* Имя - ключ целиком, а не первые 32 символа: иначе два разных имени,
       совпадающих по префиксу, слиплись бы и один цвет умер. */
    resetLib();
    n0 = K.MATERIALS.size;
    const long1 = 'Metal_Rough_Scratched_Variant_01_Red';
    const long2 = 'Metal_Rough_Scratched_Variant_01_Blue';
    ctx = K.importMaterialContext();
    const L1 = ctx.idFor(src(long1, '#ff0000', 0.5, 0));
    ctx = K.importMaterialContext();
    const L2 = ctx.idFor(src(long2, '#0000ff', 0.5, 0));
    ok('1.11 имена, расходящиеся после 32-го символа, не слипаются',
       L1 !== L2 && K.MATERIALS.size === n0 + 2,
       L1 + ' / ' + L2 + ' size ' + K.MATERIALS.size);
    ctx = K.importMaterialContext();
    ok('1.11 и длинное имя по-прежнему находится по себе же',
       ctx.idFor(src(long1, '#ff0002', 0.52, 0)) === L1);
    mark('1.mint');

    /* ================= 2. Тот же сплав на пути восстановления ============= */

    /* ОДИНАКОВАЯ ПОДПИСЬ - показываем на свою запись и не добавляем ничего.
       Это та половина, которая безопасна: подписи равны, значит вид тот же, и
       терять нечего. Раньше чужой id проскакивал вперёд этой проверки и
       оседал второй идентичной записью - ровно та стопка, что росла. */
    resetLib();
    addCustom('mat_skin', 'Skin', '#aa8866', 0.5, 0);
    n0 = K.MATERIALS.size;
    let doc = K.serializeDoc();
    doc.materialLib = [{ id: 'mat_alien', name: 'Skin', color: '#aa8866',
                         roughness: 0.5, metalness: 0, bevel: 0, masks: [] }];
    K.restoreDoc(doc, {});
    ok('2.1 тот же ВИД под чужим id - сливается, не дублируется',
       K.MATERIALS.size === n0 && !K.MATERIALS.has('mat_alien'),
       n0 + ' -> ' + K.MATERIALS.size + ' [' + names() + ']');

    /* А ДРУГОЙ ВИД ПОД ТЕМ ЖЕ ИМЕНЕМ - это определение документа, и оно
       обязано уцелеть. serializeDoc пишет в materialLib ВСЮ библиотеку,
       пресеты в том числе, под их неизменными именами - поэтому ключ по имени
       на этом пути означал бы, что Metal из файла всегда находит локальный
       Metal, и правки файла (царапины, фаска, цвет) молча пропадают. */
    resetLib();
    addCustom('mat_skin', 'Skin', '#aa8866', 0.5, 0);
    n0 = K.MATERIALS.size;
    doc = K.serializeDoc();
    doc.materialLib = [{ id: 'mat_alien', name: 'Skin', color: '#112233',
                         roughness: 0.91, metalness: 0.2, bevel: 0, masks: [] }];
    K.restoreDoc(doc, {});
    ok('2.2 другой ВИД под тем же именем сохраняет определение файла',
       K.MATERIALS.has('mat_alien') &&
       K.MATERIALS.get('mat_alien').color === '#112233',
       (K.MATERIALS.get('mat_alien') || {}).color + ' [' + names() + ']');
    ok('2.2 и местный Skin не перекрашен файлом',
       (K.MATERIALS.get('mat_skin') || {}).color === '#aa8866',
       (K.MATERIALS.get('mat_skin') || {}).color);

    /* id из прототипа Object: MATERIAL_DEFAULTS - обычный литерал, поэтому
       MATERIAL_DEFAULTS['constructor'] истинно, и такая запись приезжала с
       preset:true - то есть ровно тем материалом, который нельзя ни удалить,
       ни сбросить. */
    resetLib();
    doc = K.serializeDoc();
    doc.materialLib = [{ id: 'constructor', name: 'Sneaky', color: '#ff0000',
                         roughness: 0.5, metalness: 0, bevel: 0, masks: [] }];
    K.restoreDoc(doc, {});
    const sneaky = K.MATERIALS.get('constructor');
    ok('2.3 id из прототипа не даёт записи статус пресета',
       !sneaky || (sneaky.preset === false && K.isPresetDef(sneaky) === false),
       sneaky ? ('preset=' + sneaky.preset) : 'не принята');
    resetLib();
    K.MATERIALS.delete('constructor');
    mark('2.restore');

    /* ================= 3. Материал, который нельзя тронуть =============== */

    resetLib();
    ok('3.1 getMaterialDef на чужой id по-прежнему отдаёт Solid (это нужно рисованию)',
       K.getMaterialDef('нет_такого') === K.MATERIALS.get('standard'));
    ok('3.2 а liveMaterialDef отдаёт null - редактор больше не обманут',
       K.liveMaterialDef('нет_такого') === null);
    ok('3.2 и на живой id отдаёт его же запись',
       K.liveMaterialDef('standard') === K.MATERIALS.get('standard'));

    const solid = K.MATERIALS.get('standard');
    const solidBefore = JSON.stringify({ c: solid.color, r: solid.roughness, m: solid.metalness });
    K.closeMatEditor(false);
    K.openMatEditor('мёртвый_id');
    ok('3.3 openMatEditor на мёртвый id НЕ открывается',
       K.matEditingId === null, 'matEditingId=' + K.matEditingId);
    ok('3.3 и не начинает править Solid',
       JSON.stringify({ c: solid.color, r: solid.roughness, m: solid.metalness }) === solidBefore);
    ok('3.3 и говорит об этом вслух', bodyHas('no longer in the library'));

    const cid = addCustom('mat_probe', 'Probe', '#334455', 0.6, 0.1);
    K.openMatEditor(cid);
    ok('3.4 а на живой id открывается', K.matEditingId === cid, 'matEditingId=' + K.matEditingId);
    mark('3.strict');

    /* Ровно тот сценарий, который это породил: редактор открыт, id исчез
       из библиотеки под ним, и ручка дёрнута. */
    K.MATERIALS.delete(cid);
    const meColor = document.getElementById('meColor');
    meColor.value = '#00ff00';
    meColor.dispatchEvent(new Event('input', { bubbles: true }));
    ok('3.5 ручка при исчезнувшем id не перекрашивает Solid',
       solid.color !== '#00ff00',
       'solid.color=' + solid.color);
    K.closeMatEditor(true);

    /* Полка: карточки обязаны БЫТЬ библиотекой. */
    resetLib();
    addCustom('mat_a', 'A', '#111111', 0.5, 0);
    K.setMatTrayOpen(true);
    K.buildMatTray();
    ok('3.6 сразу после сборки полка не устарела', K.matTrayStale() === false);
    K.MATERIALS.delete('mat_a');
    ok('3.6 исчез id - полка устарела', K.matTrayStale() === true);
    K.refreshMatTray();
    ok('3.6 refreshMatTray пересобрал - снова не устарела', K.matTrayStale() === false);
    const cards = K.matTrayInnerEl.querySelectorAll('.mat-card:not(.add)');
    ok('3.6 и карточек ровно столько, сколько записей',
       cards.length === K.MATERIALS.size, cards.length + ' / ' + K.MATERIALS.size);
    K.setMatTrayOpen(false);
    K.MATERIALS.delete('metal');
    ok('3.7 на ЗАКРЫТОЙ полке устаревание не считается (иначе каждый тап по выделению платит за пересборку)',
       K.matTrayStale() === false);
    resetLib();
    mark('3.tray');

    /* Запись с preset:true, у которой нет дефолта: прежде её нельзя было ни
       удалить (meDelete отказывал пресетам), ни сбросить (сбрасывать не к
       чему), а saveMaterialLibrary читала base.color СНАРУЖИ своего try. */
    K.MATERIALS.set('mat_orphan', { id: 'mat_orphan', preset: true, name: 'Orphan',
      color: '#123456', roughness: 0.5, metalness: 0, bevel: 0, masks: [] });
    let threw = null;
    try { K.saveMaterialLibrary(); } catch (e) { threw = String(e); }
    ok('3.8 saveMaterialLibrary не падает на сироте-пресете', threw === null, threw || '');
    ok('3.8 и она сохранена как обычный материал',
       /mat_orphan/.test(localStorage.getItem(K.MATLIB_KEY) || ''),
       (localStorage.getItem(K.MATLIB_KEY) || '').slice(0, 0) + 'len=' +
       (localStorage.getItem(K.MATLIB_KEY) || '').length);
    /* И она не выдаёт себя за пресет там, где это решает судьбу кнопки.
       Флаг `preset` отвечал на вопрос, на который может ответить только
       MATERIAL_DEFAULTS, и такая запись удовлетворяла все три проверки разом:
       Reset показан, Delete спрятан, а сбрасывать не к чему. */
    K.MATERIALS.set('mat_orphan', { id: 'mat_orphan', preset: true, name: 'Orphan',
      color: '#123456', roughness: 0.5, metalness: 0, bevel: 0, masks: [] });
    ok('3.9 isPresetDef смотрит в дефолты, а не в флаг',
       K.isPresetDef(K.MATERIALS.get('mat_orphan')) === false &&
       K.isPresetDef(K.MATERIALS.get('standard')) === true);
    K.closeMatEditor(false);
    K.openMatEditor('mat_orphan');
    ok('3.9 сирота не подписана "(preset)"',
       document.getElementById('meName').textContent.indexOf('(preset)') < 0,
       document.getElementById('meName').textContent);
    ok('3.9 и Delete у неё показан',
       document.getElementById('meDelete').style.display !== 'none',
       'display=' + document.getElementById('meDelete').style.display);
    const n9 = K.MATERIALS.size;
    document.getElementById('meDelete').click();
    ok('3.9 и она удаляется',
       K.MATERIALS.size === n9 - 1 && !K.MATERIALS.has('mat_orphan'),
       n9 + ' -> ' + K.MATERIALS.size);
    K.closeMatEditor(true);

    /* Кнопки. Отказ обязан быть слышен. */
    K.openMatEditor('standard');
    let before = K.MATERIALS.size;
    document.getElementById('meDelete').click();
    ok('3.10 Delete на пресете ничего не удаляет',
       K.MATERIALS.size === before, before + ' -> ' + K.MATERIALS.size);
    ok('3.10 и объясняет почему, вместо молчания', bodyHas('cannot be deleted'));
    K.closeMatEditor(true);

    K.MATERIALS.delete('mat_orphan');
    const did = addCustom('mat_kill', 'Kill', '#654321', 0.4, 0);
    K.openMatEditor(did);
    before = K.MATERIALS.size;
    document.getElementById('meDelete').click();
    ok('3.11 а обычный материал по-прежнему удаляется',
       K.MATERIALS.size === before - 1 && !K.MATERIALS.has(did),
       before + ' -> ' + K.MATERIALS.size);
    resetLib();
    mark('3.buttons');

    finish();
  }

  function boot() {
    const t0 = Date.now();
    (function wait() {
      if (window.__kubik && window.__kubik.MATERIALS && window.__kubik.App &&
          window.__kubik.App.objects) {
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
