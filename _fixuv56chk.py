# -*- coding: utf-8 -*-
# undo/redo прогоняет restoreDoc, который пересобирает объекты - ссылка `o`
# после него указывает на выброшенный объект. Берём его заново по id.
import io
P = r'C:\Users\a.bodrov\Projects\kubik\_uv56chk.js'
s = io.open(P, encoding='utf-8').read()
N = [1]
def sub(old, new):
    global s
    assert s.count(old) == 1, 'anchor %d: %d hits' % (N[0], s.count(old))
    N[0] += 1
    s = s.replace(old, new, 1)

sub("""    K.undo();
    await wait(30);
    st = islands(o);""",
    """    K.undo();
    await wait(30);
    // restoreDoc пересобирает объекты - прежняя ссылка теперь на выброшенный.
    o = K.findObject(A.activeObjectId) || o;
    st = islands(o);""")

sub("""    K.redo();
    await wait(30);
    ok('2.redo""",
    """    K.redo();
    await wait(30);
    o = K.findObject(A.activeObjectId) || o;
    ok('2.redo""")

sub("""      const uv = o.mesh.geometry.attributes.uv;
      let worst = 0;
      for (let i = 0; i < Math.min(uv.count, uv0.length / 2); i++) {""",
    """      const uv = o.mesh.geometry.attributes.uv;
      let worst = 0;
      for (let i = 0; i < Math.min(uv.count, uv0.length / 2); i++) {""")

io.open(P, 'w', encoding='utf-8', newline='').write(s)
print('probe fixed: %d' % (N[0] - 1))
