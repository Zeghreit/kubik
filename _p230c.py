# -*- coding: utf-8 -*-
import io

P = '_matchk.js'
s = io.open(P, encoding='utf-8').read()

old = """    resetLib();
    mark('3.buttons');

    finish();"""
assert s.count(old) == 1, 'match %d' % s.count(old)

new = u"""    resetLib();
    mark('3.buttons');

    /* ================= 4. Настоящий файл пользователя (v2.30) ============ */

    /* _neolib.json - это materialLib из Kubik_NeoTank.json, присланного
       пользователем. Пресеты в нём сохранены с ПРИБИТЫМИ цветами
       (#858585 и #999999) вместо color:null, потому что раньше движение
       любого ползунка при открытом пресете замораживало его цвет. Прибитый
       серый не совпадает с нашим null по подписи, id занят - и оставалась
       одна ветка: чеканить. Замер до правки: 3 записи -> 9. */
    resetLib();
    const neo = await fetch('_neolib.json?t=' + Date.now()).then(r => r.json());
    n0 = K.MATERIALS.size;
    K.restoreDoc(JSON.parse(JSON.stringify(neo)), {});
    ok('4.1 пресет из документа НЕ чеканит копию себя',
       !K.MATERIALS.has('mat_standard_i') && !K.MATERIALS.has('mat_plastic_i'),
       names());
    ok('4.1 приехали ровно четыре настоящих материала файла',
       K.MATERIALS.size === n0 + 4, n0 + ' -> ' + K.MATERIALS.size);
    ok('4.1 и ничего не названо "(imported)"', !anyImportedName(), names());
    ok('4.1 пресеты продолжают следовать теме',
       K.MATERIALS.get('standard').color === null &&
       K.MATERIALS.get('plastic').color === null,
       K.MATERIALS.get('standard').color + ' / ' + K.MATERIALS.get('plastic').color);
    ok('4.2 и про расхождение сказано вслух, а не молча',
       bodyHas('differ in this file'));

    /* Повторные открытия того же файла ничего не добавляют. */
    const afterNeo = K.MATERIALS.size;
    K.restoreDoc(JSON.parse(JSON.stringify(neo)), {});
    K.restoreDoc(JSON.parse(JSON.stringify(neo)), {});
    ok('4.1 и три открытия подряд не растят библиотеку',
       K.MATERIALS.size === afterNeo, afterNeo + ' -> ' + K.MATERIALS.size);
    mark('4.neotank');

    /* ВЕРХОВАЯ ПРИЧИНА: редактор примораживал цвет пресета. color:null значит
       "серый темы", и запись поля цвета без разбора превращала это в явный
       hex от одного движения ЛЮБОГО ползунка. */
    resetLib();
    K.closeMatEditor(false);
    K.openMatEditor('standard');
    const meRough = document.getElementById('meRough');
    meRough.value = '0.63';
    meRough.dispatchEvent(new Event('input', { bubbles: true }));
    ok('4.3 ползунок roughness НЕ примораживает цвет пресета',
       K.MATERIALS.get('standard').color === null,
       'color=' + K.MATERIALS.get('standard').color);
    ok('4.3 но сам roughness записан',
       Math.abs(K.MATERIALS.get('standard').roughness - 0.63) < 1e-9,
       'r=' + K.MATERIALS.get('standard').roughness);

    const meColor2 = document.getElementById('meColor');
    meColor2.value = '#123456';
    meColor2.dispatchEvent(new Event('input', { bubbles: true }));
    ok('4.4 а движение самого поля цвета - записывает',
       K.MATERIALS.get('standard').color === '#123456',
       'color=' + K.MATERIALS.get('standard').color);
    K.closeMatEditor(false);
    resetLib();
    mark('4.pin');

    /* Уборка. Сносит только то, что не носит ни один объект, и никогда
       пресет - тогда картинка измениться не может по построению. */
    resetLib();
    addCustom('mat_keep', 'Worn', '#010203', 0.5, 0);
    addCustom('mat_drop1', 'Unworn 1', '#040506', 0.5, 0);
    addCustom('mat_drop2', 'Unworn 2', '#070809', 0.5, 0);
    const obj0 = K.App.objects[0];
    const savedFin = obj0 ? obj0.mesh.userData.finishes : null;
    if (obj0) obj0.mesh.userData.finishes = { 0: 'mat_keep' };
    K.setMatTrayOpen(true);
    K.buildMatTray();
    const sweepBtn = K.matTrayInnerEl.querySelector('.mat-card.sweep');
    ok('4.5 кнопка уборки есть в полке', !!sweepBtn);
    ok('4.5 и matTrayStale её не считает за карточку материала',
       K.matTrayStale() === false);
    if (sweepBtn) sweepBtn.click();
    ok('4.5 ненадетые снесены',
       !K.MATERIALS.has('mat_drop1') && !K.MATERIALS.has('mat_drop2'),
       names());
    ok('4.5 надетый уцелел', K.MATERIALS.has('mat_keep'), names());
    ok('4.5 пресеты уцелели',
       K.MATERIALS.has('standard') && K.MATERIALS.has('plastic') && K.MATERIALS.has('metal'),
       names());
    ok('4.5 и сказано, сколько снесено', bodyHas('Removed 2 unused'));
    const before5 = K.MATERIALS.size;
    K.matTrayInnerEl.querySelector('.mat-card.sweep').click();
    ok('4.5 повторное нажатие ничего не сносит и говорит об этом',
       K.MATERIALS.size === before5 && bodyHas('Nothing unused'),
       before5 + ' -> ' + K.MATERIALS.size);
    if (obj0) obj0.mesh.userData.finishes = savedFin;
    K.setMatTrayOpen(false);
    resetLib();
    mark('4.sweep');

    finish();"""

s = s.replace(old, new)
io.open(P, 'w', encoding='utf-8', newline='').write(s)
print('probe group 4 added')
