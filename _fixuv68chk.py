# -*- coding: utf-8 -*-
import io, sys
P = '_uv68chk.js'
s = io.open(P, encoding='utf-8').read()

old1 = u"""      const lo = K.snapUvScale(0.125 * 1.02), hi = K.snapUvScale(8 * 1.02);
      ok('1.table окно относительное', lo.snapped && hi.snapped &&
         lo.value === 0.125 && hi.value === 8, JSON.stringify([lo.value, hi.value]));"""
new1 = u"""      // Оба конца ТЕПЕРЕШНЕЙ таблицы: ×⅛ и ×¼ из неё убраны намеренно.
      const loV = Math.min.apply(null, S.map(t => t.v));
      const hiV = Math.max.apply(null, S.map(t => t.v));
      const lo = K.snapUvScale(loV * 1.02), hi = K.snapUvScale(hiV * 1.02);
      ok('1.table окно относительное', lo.snapped && hi.snapped &&
         lo.value === loV && hi.value === hiV, JSON.stringify([lo.value, hi.value]));"""
if old1 not in s: sys.exit('FAIL 1')
s = s.replace(old1, new1, 1)

old2 = u"""      await step(118);            // ×1.967 - внутри полосы ×2
      const afterIn = buzz;
      ok('10.buzz вход дал щелчок', afterIn === 1, 'buzz=' + afterIn);"""
new2 = u"""      /* Пальцы двигаются ПО ОДНОМУ - так приходят и настоящие pointermove, по
         событию на палец - поэтому широкий развод проходит по дороге и через
         ×1½: от 60 до 118 первый кадр даёт 178/120 = 1.48 (полоса ×1½), второй
         236/120 = 1.97 (полоса ×2). Два щелчка тут ПРАВИЛЬНЫ: полос и вправду
         пройдено две. Проверять надо не их число, а то, что на выходе и внутри
         полосы щелчков нет - ниже. */
      await step(118);            // ×1.967 - внутри полосы ×2
      const afterIn = buzz;
      ok('10.buzz вход дал щелчок (одна-две полосы)', afterIn >= 1 && afterIn <= 2,
         'buzz=' + afterIn);"""
if old2 not in s: sys.exit('FAIL 2')
s = s.replace(old2, new2, 1)

io.open(P, 'w', encoding='utf-8', newline='').write(s)
print('OK two stale expectations fixed')
