# -*- coding: utf-8 -*-
import io

P = '_matchk.js'
s = io.open(P, encoding='utf-8').read()

REPEAT = u"""
    /* Повторные открытия того же файла ничего не добавляют. */
    const afterNeo = K.MATERIALS.size;
    K.restoreDoc(JSON.parse(JSON.stringify(neo)), {});
    K.restoreDoc(JSON.parse(JSON.stringify(neo)), {});
    ok('4.1 и три открытия подряд не растят библиотеку',
       K.MATERIALS.size === afterNeo, afterNeo + ' -> ' + K.MATERIALS.size);
"""
assert s.count(REPEAT) == 1, 'repeat block %d' % s.count(REPEAT)
s = s.replace(REPEAT, '\n')

anchor = u"""       K.MATERIALS.get('plastic').color === null,
       K.MATERIALS.get('standard').color + ' / ' + K.MATERIALS.get('plastic').color);
"""
assert s.count(anchor) == 1, 'anchor %d' % s.count(anchor)
s = s.replace(anchor, anchor + REPEAT)

io.open(P, 'w', encoding='utf-8', newline='').write(s)
print('repeat-open check moved before the 4.2 block')
