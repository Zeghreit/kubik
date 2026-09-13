# -*- coding: utf-8 -*-
import io

P = '_matchk.js'
s = io.open(P, encoding='utf-8').read()
n = 0

def rep(old, new, label):
    global s, n
    c = s.count(old)
    assert c == 1, 'MATCH %d for %s' % (c, label)
    s = s.replace(old, new)
    n += 1
    print('ok', label)


rep(u"""    ok('4.2 и про расхождение сказано вслух, а не молча',
       bodyHas('differ in this file'));""",
u"""    /* ГРАНИЦА ПРАВИЛА. Разница ТОЛЬКО в цвете - артефакт сериализации, и
       копия не чеканится (4.1 выше). Любая другая разница - это то, что
       человек сделал руками, и она обязана приехать своей копией: ровно
       правило a2.6x («добавь Metal царапины, сохрани, открой в другом
       месте»), которое первый вариант защиты молча ломал. */
    resetLib();
    n0 = K.MATERIALS.size;
    let docM = K.serializeDoc();
    docM.materialLib = [{ id: 'metal', preset: true, name: 'Metal', color: null,
      roughness: 0.25, metalness: 1, bevel: 0,
      masks: [{ on: true, type: 'edges', blend: 'normal', colorOn: true, color: '#ffffff',
                roughOn: false, rough: 0, amount: 0.4, scale: 0.1, detail: 0,
                contrast: 1, nscale: 1, seed: 7 }] }];
    K.restoreDoc(docM, {});
    ok('4.2 пресет с НАСТОЯЩЕЙ правкой (маска) приезжает своей копией',
       K.MATERIALS.size === n0 + 1 && anyImportedName(), names());
    const copy = Array.from(K.MATERIALS.values()).filter(d => /\\(imported/.test(d.name || ''))[0];
    ok('4.2 и копия несёт ту самую маску',
       !!copy && Array.isArray(copy.masks) && copy.masks.length === 1,
       copy ? (copy.name + ' masks=' + (copy.masks || []).length) : 'нет копии');
    ok('4.2 а наш Metal не тронут',
       K.MATERIALS.get('metal').color === null &&
       !(K.MATERIALS.get('metal').masks || []).length);""", 'probe-4.2')


rep(u"""    ok('4.4 а движение самого поля цвета - записывает',
       K.MATERIALS.get('standard').color === '#123456',
       'color=' + K.MATERIALS.get('standard').color);""",
u"""    ok('4.4 а движение самого поля цвета - записывает',
       K.MATERIALS.get('standard').color === '#123456',
       'color=' + K.MATERIALS.get('standard').color);

    /* И ВЕРНУТЬСЯ К ИСХОДНОМУ ЗНАЧЕНИЮ - тоже правка. «Отличается прямо
       сейчас» не то же самое, что «двигали»: провести пипетку в красный и
       обратно оставляло красный за золотым квадратиком. */
    resetLib();
    addCustom('mat_gold', 'Gold', '#ffcc00', 0.3, 1);
    K.closeMatEditor(false);
    K.openMatEditor('mat_gold');
    const mc = document.getElementById('meColor');
    mc.value = '#ff0000';
    mc.dispatchEvent(new Event('input', { bubbles: true }));
    mc.value = '#ffcc00';
    mc.dispatchEvent(new Event('input', { bubbles: true }));
    ok('4.4 возврат к исходному цвету записывается, а не игнорируется',
       K.MATERIALS.get('mat_gold').color === '#ffcc00',
       'color=' + K.MATERIALS.get('mat_gold').color);
    K.closeMatEditor(false);
    resetLib();""", 'probe-4.4b')


rep(u"""    K.setMatTrayOpen(false);
    resetLib();
    mark('4.sweep');""",
u"""    K.setMatTrayOpen(false);

    /* ДОКУМЕНТ НЕСЁТ ТО, ЧТО ИСПОЛЬЗУЕТ. Раньше в файл писалась ВСЯ
       библиотека, поэтому следующее открытие возвращало всё, что уборка
       только что убрала - то есть уборка не работала вовсе. */
    addCustom('mat_never', 'Never used', '#0a0b0c', 0.5, 0);
    const docU = K.serializeDoc();
    const libIds = (docU.materialLib || []).map(d => d.id);
    ok('4.6 неиспользуемый материал в документ не попадает',
       libIds.indexOf('mat_never') < 0, libIds.join(','));
    ok('4.6 надетый - попадает', libIds.indexOf('mat_keep') >= 0, libIds.join(','));
    ok('4.6 и три пресета едут всегда',
       libIds.indexOf('standard') >= 0 && libIds.indexOf('plastic') >= 0 &&
       libIds.indexOf('metal') >= 0, libIds.join(','));

    /* УБОРКА СМОТРИТ И В ИСТОРИЮ. Удалить единственный объект в материале,
       убраться, отменить - и объект возвращался в Solid, без масок и без
       дороги назад: сборщик на откате не переусыновляет (keepAppearance). */
    addCustom('mat_hist', 'Only in history', '#0d0e0f', 0.5, 0);
    K.App.selectedObjectIds = new Set([obj0.id]);
    K.App.activeObjectId = obj0.id;
    K.applyFinishToSelection('mat_hist');
    K.pushHistory();
    K.App.objects.length = 0;          // как будто объект удалён
    K.setMatTrayOpen(true);
    K.buildMatTray();
    K.matTrayInnerEl.querySelector('.mat-card.sweep').click();
    ok('4.7 материал, который носит только шаг истории, уцелел',
       K.MATERIALS.has('mat_hist'), names());
    ok('4.7 а не носимый вообще нигде - снесён',
       !K.MATERIALS.has('mat_never'), names());
    K.setMatTrayOpen(false);
    resetLib();
    mark('4.sweep');""", 'probe-4.6-4.7')

io.open(P, 'w', encoding='utf-8', newline='').write(s)
print('probe updated:', n)
