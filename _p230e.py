# -*- coding: utf-8 -*-
import io

P = '_matchk.js'
s = io.open(P, encoding='utf-8').read()

old = u"""    const sweepBtn = K.matTrayInnerEl.querySelector('.mat-card.sweep');"""
assert s.count(old) == 1, 'match %d' % s.count(old)

new = u"""    note('4.5 сцена', 'objects=' + K.App.objects.length + ' finishes=' +
         JSON.stringify(K.App.objects.map(o => o.mesh.userData.finishes || null)));
    const sweepBtn = K.matTrayInnerEl.querySelector('.mat-card.sweep');"""

s = s.replace(old, new)
io.open(P, 'w', encoding='utf-8', newline='').write(s)
print('diagnostic added')
