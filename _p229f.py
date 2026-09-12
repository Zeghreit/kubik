# -*- coding: utf-8 -*-
import io

# ---- export themedGreyHex so the probe can build "our" grey exactly ----
s = io.open('index.html', encoding='utf-8').read()
old = "    MATERIAL_DEFAULTS, liveMaterialDef, isPresetDef, matTrayStale, buildMatTray,"
new = "    MATERIAL_DEFAULTS, liveMaterialDef, isPresetDef, themedGreyHex, matTrayStale, buildMatTray,"
assert s.count(old) == 1
io.open('index.html', 'w', encoding='utf-8', newline='').write(s.replace(old, new))
print('ok export themedGreyHex')

# ---- retarget the probe at the rules the review changed ----
p = '_matchk.js'
s = io.open(p, encoding='utf-8').read()
n = 0


def rep(old, new, label):
    global s, n
    c = s.count(old)
    assert c == 1, 'MATCH %d for %s' % (c, label)
    s = s.replace(old, new)
    n += 1
    print('ok', label)


rep(u"""    /* Имя пресета. Раньше это давало "Metal (imported)" рядом с Metal. */
    resetLib();
    n0 = K.MATERIALS.size;
    ctx = K.importMaterialContext();
    got = ctx.idFor(src('Metal', '#8899aa', 0.8, 1));
    ok('1.8 источник с именем пресета сливается на пресет',
       got === 'metal' && K.MATERIALS.size === n0, 'idFor -> ' + got + ' size ' + K.MATERIALS.size);
    const met = K.MATERIALS.get('metal');
    ok('1.8 и пресет не перекрашен файлом',
       met.color === null && Math.abs(met.roughness - K.MATERIAL_DEFAULTS.metal.roughness) < 1e-9,
       met.color + ' rough=' + met.roughness);
    mark('1.mint');
""",
u"""    /* ПРЕСЕТ НЕ ЦЕЛЬ ДЛЯ СЛИЯНИЯ. Solid, Plastic и Metal несут color: null -
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
""", 'probe-1.8')

rep(u"""    resetLib();
    addCustom('mat_skin', 'Skin', '#aa8866', 0.5, 0);
    n0 = K.MATERIALS.size;
    const doc = K.serializeDoc();
    doc.materialLib = [{ id: 'mat_alien', name: 'Skin', color: '#112233',
                         roughness: 0.91, metalness: 0.2, bevel: 0, masks: [] }];
    K.restoreDoc(doc, {});
    ok('2.1 materialLib с тем же именем сливается, а не чеканит',
       K.MATERIALS.size === n0 && !K.MATERIALS.has('mat_alien'),
       n0 + ' -> ' + K.MATERIALS.size + ' [' + names() + ']');
    ok('2.1 и местное определение снова победило',
       (K.MATERIALS.get('mat_skin') || {}).color === '#aa8866',
       (K.MATERIALS.get('mat_skin') || {}).color);
    ok('2.1 ничего не названо "(imported)"', !anyImportedName(), names());
    mark('2.restore');
""",
u"""    /* ОДИНАКОВАЯ ПОДПИСЬ - показываем на свою запись и не добавляем ничего.
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
""", 'probe-2.1')

io.open(p, 'w', encoding='utf-8', newline='').write(s)
print('probe patches applied:', n)
