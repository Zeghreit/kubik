# -*- coding: utf-8 -*-
# Правки после холодного ревью v2.62.
import io, sys
P = '_uv62chk.js'
s = io.open(P, encoding='utf-8').read()

def sub(old, new, tag):
    global s
    n = s.count(old)
    if n != 1:
        print('FAIL %s: %d' % (tag, n)); sys.exit(1)
    s = s.replace(old, new, 1); print('ok %s' % tag)

A = u'\u293a'   # \u2ba
B = u'\u293b'
sub(u"      ok('1.says  и глубину Undo/Redo', /" + A + u"\\d+ " + B + u"\\d+/.test(t), t);",
u"""      /* Глубины Undo/Redo тут БОЛЬШЕ НЕТ (ревью): она устаревала после любого
         пуша, не менявшего экземпляр объекта, и могла противоречить самой
         кнопке, стоящей рядом. Справа только зум. */
      ok('1.says  справа только зум', /\\| 100%$/.test(t) && !/""" + A + u"|" + B + u"""/.test(t), t);

      /* И строка стоит ВЫШЕ полосы кнопок: #quickRow (Undo/Redo, z13) и
         #hubBtn (z16) рисуются поверх этого вида, так что первый черновик
         строки печатался ровно под кнопкой Undo. */
      const sb = document.getElementById('uvViewStatus').getBoundingClientRect();
      ok('1.says  и поднята над нижними кнопками',
         window.innerHeight - sb.bottom >= 60,
         'до низа окна ' + Math.round(window.innerHeight - sb.bottom) + 'px');""", 'sec1')

sub(u"""    mark('6');

    finish();""",
u"""    mark('6');

    // ---------------------------------------------------------------- 7
    /* Id объектов приходят ИЗ ДОКУМЕНТА, поэтому «тот же id» значит «тот же
       объект» только внутри одного документа. Загрузка - не Undo: она зовёт
       restoreDoc без keepSelection, и 2D-вид должен закрыться, а не остаться
       открытым на чужой модели с прежним зумом (ровно то, от чего restoreDoc
       уже бросает geoSetup, opSetup и curveEdit). */
    {
      const first = A.objects[0];
      A.activeObjectId = first.id;
      A.selectedObjectIds = new Set([first.id]);
      K.refreshUI();
      await wait(80);
      ok('7.load  вид снова открыт на объекте с развёрткой',
         K.uvViewOpen && K.uvViewTarget === first.id, 'target=' + K.uvViewTarget);
      // Так выглядит File > Open: restoreDoc БЕЗ keepSelection.
      K.restoreDoc(A.history[A.historyIndex]);
      await wait(120);
      ok('7.load  загрузка закрыла 2D-вид', K.uvViewOpen === false);
      ok('7.load  и он ни на что не наведён', K.uvViewTarget === null,
         'target=' + K.uvViewTarget);
    }
    mark('7');

    finish();""", 'sec7')

io.open(P, 'w', encoding='utf-8', newline='').write(s)
print('written')
