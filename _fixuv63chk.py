# -*- coding: utf-8 -*-
# Ошибка пробы, не кода: zoomUvViewBoxAt с коэффициентом 1 ничего не двигает
# по построению (x = svgX - (svgX - x) * 1). Чтобы уехать в дальний угол,
# надо приблизиться К НЕМУ - тогда окно и сдвигается к якорю.
import io, sys
P = '_uv63chk.js'
s = io.open(P, encoding='utf-8').read()
old = u"""      // Толкаем вид далеко за угол и смотрим, где его остановит клампер.
      K.zoomUvViewBoxAt(1, 0, 0);
      const bx = box();
      // Прямая проверка клампера: ставим заведомо запредельный кадр.
      const far = K.uvViewBoxNow;
      ok('4.pan   кадр по умолчанию - тайл 1001',
         Math.abs(far.w - 100) < 1e-6, 'w=' + far.w);
      // Панимся вручную через колесо+перетаскивание слишком долго; вместо
      // этого дёргаем сам клампер через публичный zoom (он его зовёт).
      K.zoomUvViewBoxAt(1, b.x1 + 500, b.y0 - 500);
      await wait(20);"""
new = u"""      ok('4.pan   кадр по умолчанию - тайл 1001',
         Math.abs(box().w - 100) < 1e-6, 'w=' + box().w);
      /* Уезжаем в дальний верхний правый угол листа - тайл 1100 - приближаясь
         к его точке: якорь зума и есть то, что остаётся под пальцем. */
      K.zoomUvViewBoxAt(0.1, b.x1, b.y0);
      await wait(20);"""
n = s.count(old)
if n != 1:
    print('FAIL anchor %d' % n); sys.exit(1)
s = s.replace(old, new, 1)

old2 = u"""      ok('4.pan   но не дальше листа с полями',
         p.x <= b.x1 + 20 + 1e-6 && p.y >= b.y0 - 20 - 1e-6,
         'x=' + p.x.toFixed(1) + ' y=' + p.y.toFixed(1));"""
new2 = u"""      ok('4.pan   но не дальше листа с полями',
         p.x + p.w <= b.x1 + 20 + 1e-6 && p.y >= b.y0 - 20 - 1e-6,
         'x=' + p.x.toFixed(1) + '..' + (p.x + p.w).toFixed(1) +
         ' y=' + p.y.toFixed(1));
      // И в этом кадре виден номер дальнего тайла.
      const seen = Array.from(svg.querySelectorAll('.uv-udim-num')).filter(t => {
        const x = parseFloat(t.getAttribute('x')), y = parseFloat(t.getAttribute('y'));
        return x >= p.x && x <= p.x + p.w && y >= p.y && y <= p.y + p.h;
      }).map(t => t.textContent);
      ok('4.pan   и в кадре виден тайл 1100', seen.indexOf('1100') >= 0,
         'видно: ' + seen.join(','));"""
n2 = s.count(old2)
if n2 != 1:
    print('FAIL anchor2 %d' % n2); sys.exit(1)
s = s.replace(old2, new2, 1)

io.open(P, 'w', encoding='utf-8', newline='').write(s)
print('ok sec4')
