# -*- coding: utf-8 -*-
# v2.66 добавил в кольцо острова четыре места выравнивания. Проба v2.65
# проверяла, что мест РОВНО четыре - её дело в том, что первые четыре это
# трансформы, а не в том, что кольцо больше не растёт.
import io, sys
P = '_uv65chk.js'
s = io.open(P, encoding='utf-8').read()
old = u"""      ok('1.ring  и столько же мест', K.HUB_TOOLS_UV2D_ISLAND.length === 4);"""
new = u"""      // Не «ровно четыре»: с v2.66 в кольце ещё и выравнивания. Важно, что на
      // каждый трансформ есть место и они идут первыми.
      ok('1.ring  мест не меньше', K.HUB_TOOLS_UV2D_ISLAND.length >= 4,
         'seats=' + K.HUB_TOOLS_UV2D_ISLAND.length);"""
n = s.count(old)
if n != 1:
    print('FAIL anchor %d' % n); sys.exit(1)
io.open(P, 'w', encoding='utf-8', newline='').write(s.replace(old, new, 1))
print('ok ring-size')
