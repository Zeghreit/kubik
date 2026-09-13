# -*- coding: utf-8 -*-
import io

P = '_matchk.js'
s = io.open(P, encoding='utf-8').read()

old = u"""    const obj0 = K.createCubeObject('Probe cube', new K.THREE.Vector3(0, 0.5, 0));
    obj0.mesh.userData.finishes = { 0: 'mat_keep' };"""
assert s.count(old) == 1, 'match %d' % s.count(old)

new = u"""    /* Через НАСТОЯЩИЙ путь приложения, а не присваиванием userData.finishes:
       объект дозаполняет карту по всем своим группам, и написанное руками
       ровно одно поле затиралось - зонд поймал это на себе. */
    const obj0 = K.createCubeObject('Probe cube', new K.THREE.Vector3(0, 0.5, 0));
    K.App.mode = 'object';
    K.App.selectedObjectIds = new Set([obj0.id]);
    K.App.activeObjectId = obj0.id;
    K.applyFinishToSelection('mat_keep');"""

s = s.replace(old, new)
io.open(P, 'w', encoding='utf-8', newline='').write(s)
print('sweep setup fixed')
