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


# resetLib re-assigned only the presets that still EXISTED, so once 3.7 deleted
# 'metal' to test the closed-shelf rule, every later group ran a library with
# two presets in it - and 4.5 read metal's absence as "the sweep took a preset".
rep(u"""    Object.keys(K.MATERIAL_DEFAULTS).forEach(id => {
      const d = K.MATERIALS.get(id);
      if (d) { Object.assign(d, K.MATERIAL_DEFAULTS[id], { id: id, preset: true }); d.bevel = 0; d.masks = []; }
    });""",
u"""    Object.keys(K.MATERIAL_DEFAULTS).forEach(id => {
      /* RE-CREATED, not just re-assigned. 3.7 deletes 'metal' on purpose, and
         a resetLib that only touched surviving entries left every later group
         running against two presets - which 4.5 then read as "the sweep took a
         preset". Found by 4.5 itself. */
      let d = K.MATERIALS.get(id);
      if (!d) { d = { id: id }; K.MATERIALS.set(id, d); }
      Object.assign(d, K.MATERIAL_DEFAULTS[id], { id: id, preset: true });
      d.bevel = 0;
      d.masks = [];
    });""", 'resetLib-recreate')

# The scene is empty by group 4: restoreDoc(neo) carries objects: [], so
# App.objects[0] was undefined and nothing was "worn".
rep(u"""    const obj0 = K.App.objects[0];
    const savedFin = obj0 ? obj0.mesh.userData.finishes : null;
    if (obj0) obj0.mesh.userData.finishes = { 0: 'mat_keep' };""",
u"""    /* Своя болванка: сцена к этому месту пуста - _neolib.json несёт
       objects: [], - а «надето» без объектов не проверить. */
    const obj0 = K.createCubeObject('Probe cube', new K.THREE.Vector3(0, 0.5, 0));
    obj0.mesh.userData.finishes = { 0: 'mat_keep' };""", 'sweep-own-cube')

rep(u"""    if (obj0) obj0.mesh.userData.finishes = savedFin;
    K.setMatTrayOpen(false);""",
u"""    K.setMatTrayOpen(false);""", 'sweep-no-restore')

io.open(P, 'w', encoding='utf-8', newline='').write(s)
print('probe fixes applied:', n)
