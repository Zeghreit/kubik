# Adds a fourth injection point to _fan_probe.py: the state of the normal
# attribute AT ENTRY, before the baseline runs. If the baseline is dropped,
# whatever is in the array at this moment is what an unwritten vertex keeps -
# so "does it exist, is it the right size, is it all zero" is the question that
# decides whether dropping it is safe at all.
import io

P = '_fan_probe.py'
s = io.open(P, encoding='utf-8').read()

OLD = """for name, old, new in (('head', HEAD_ANCHOR, HEAD_ANCHOR + HEAD_ADD),"""
NEW = '''ENTRY_ANCHOR = """  // Safe baseline: if anything below throws, the mesh is still shaded.
  geo.computeVertexNormals();"""
ENTRY_ADD = """  {
    /* ---- INJECTED BY _fan_probe.py ---- */
    var _G = window.__FAN0 = window.__FAN0 || { calls: 0, noAttr: 0, allZero: 0, wrongSize: 0, live: 0 };
    _G.calls++;
    var _na = geo.attributes.normal;
    if (!_na) _G.noAttr++;
    else if (geo.attributes.position && _na.count !== geo.attributes.position.count) _G.wrongSize++;
    else {
      var _z = true;
      for (var _i = 0; _i < _na.array.length; _i++) if (_na.array[_i] !== 0) { _z = false; break; }
      if (_z) _G.allZero++; else _G.live++;
    }
  }
"""

for name, old, new in (('entry', ENTRY_ANCHOR, ENTRY_ADD + ENTRY_ANCHOR),
                       ('head', HEAD_ANCHOR, HEAD_ANCHOR + HEAD_ADD),'''

assert s.count(OLD) == 1, 'ANCHOR MISS'
s = s.replace(OLD, NEW, 1)
io.open(P, 'w', encoding='utf-8', newline='').write(s)
print('entry-state injection added')
