# -*- coding: utf-8 -*-
import io, sys
p = '_uv67chk.js'
s = io.open(p, encoding='utf-8').read()
n0 = len(s)

# 1. a helper that writes UV without a history step (finishMeshEdit is not
#    exported, and the setup states below are not edits worth a step anyway).
a = """  function boxOf(id) {"""
if a not in s: sys.exit('FAIL helper anchor')
helper = """  /* Записать UV без шага истории: finishMeshEdit наружу не выставлен, да и
     подготовка состояния для проверки - не правка, которую стоит помнить.
     Значит и разбирать её надо этой же функцией по снимку, а не Undo. */
  function setUvs(arr) {
    const o = obj();
    const ed = K.toEditable(o.mesh);
    for (let i = 0; i < ed.uvs.length && i < arr.length; i++) ed.uvs[i] = arr[i];
    K.rebuildFromEditable(o, ed);
    K.refreshUvView(o);
  }
  function boxOf(id) {"""
s = s.replace(a, helper, 1)

# 2. section 4: squash without finishMeshEdit
old4 = """      {
        const o4 = obj();
        const ed = K.toEditable(o4.mesh);
        for (let i = 1; i < ed.uvs.length; i += 2) ed.uvs[i] = 0.5 + (ed.uvs[i] - 0.5) * 0.25;
        K.rebuildFromEditable(o4, ed);
        K.finishMeshEdit(o4, 'squash for test');
        await wait(200);
      }"""
new4 = """      const base4 = uvSnapshot();
      {
        const sq = base4.slice();
        for (let i = 1; i < sq.length; i += 2) sq[i] = 0.5 + (sq[i] - 0.5) * 0.25;
        setUvs(sq);
        await wait(200);
      }"""
if old4 not in s: sys.exit('FAIL s4')
s = s.replace(old4, new4, 1)
s = s.replace("""      if (again) { K.undo(); await wait(200); }
      while (A.historyIndex > at) { K.undo(); await wait(160); }
    }
    mark('4');""",
"""      if (again) { K.undo(); await wait(200); }
      while (A.historyIndex > at) { K.undo(); await wait(160); }
      setUvs(base4); await wait(160);
      ok('4.sq    лист восстановлен', uvSame(base4, uvSnapshot(), 1e-6));
    }
    mark('4');""", 1)

# 3. section 5: collapse everything without a step
old5 = """      {
        const o5 = obj();
        const ed = K.toEditable(o5.mesh);
        for (let i = 0; i < ed.uvs.length; i++) ed.uvs[i] = 0.5;
        K.rebuildFromEditable(o5, ed);
        K.finishMeshEdit(o5, 'collapse for test');
        await wait(200);
      }"""
new5 = """      const base5 = uvSnapshot();
      {
        setUvs(base5.map(() => 0.5));
        await wait(200);
      }"""
if old5 not in s: sys.exit('FAIL s5')
s = s.replace(old5, new5, 1)
s = s.replace("""      while (A.historyIndex > at) { K.undo(); await wait(160); }
    }
    mark('5');""",
"""      while (A.historyIndex > at) { K.undo(); await wait(160); }
      setUvs(base5); await wait(160);
      ok('5.degen лист восстановлен', uvSame(base5, uvSnapshot(), 1e-6));
    }
    mark('5');""", 1)

# 4. section 6: collapse one island without a step
old6 = """      {
        const o6 = obj();
        const ed = K.toEditable(o6.mesh);
        const { attrIsland } = K.islandVertexMap(o6);
        for (let ai = 0; ai < attrIsland.length; ai++) {
          if (attrIsland[ai] !== victim) continue;
          ed.uvs[ai * 2] = 0.2; ed.uvs[ai * 2 + 1] = 0.2;
        }
        K.rebuildFromEditable(o6, ed);
        K.finishMeshEdit(o6, 'collapse one for test');
        await wait(200);
      }"""
new6 = """      const base6 = uvSnapshot();
      {
        const o6 = obj();
        const { attrIsland } = K.islandVertexMap(o6);
        const c = base6.slice();
        for (let ai = 0; ai < attrIsland.length; ai++) {
          if (attrIsland[ai] !== victim) continue;
          c[ai * 2] = 0.2; c[ai * 2 + 1] = 0.2;
        }
        setUvs(c);
        await wait(200);
      }"""
if old6 not in s: sys.exit('FAIL s6')
s = s.replace(old6, new6, 1)
s = s.replace("""      while (A.historyIndex > at) { K.undo(); await wait(160); }
    }
    mark('6');""",
"""      while (A.historyIndex > at) { K.undo(); await wait(160); }
      setUvs(base6); await wait(160);
      ok('6.one   лист восстановлен', uvSame(base6, uvSnapshot(), 1e-6));
    }
    mark('6');""", 1)

# 5. islandVertexMap is not exported either - section 6 needs another route to
#    "which attribute vertices belong to island N". boxOf already uses it, so
#    it must be there; check and fail loudly if not.
io.open(p, 'w', encoding='utf-8', newline='').write(s)
print('OK probe patched %+d chars' % (len(s) - n0))
