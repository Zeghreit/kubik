"""Deliberately broken builds for the move to IndexedDB (2.36).

One decision each. `silent` is the one that had to be rewritten: the first
version broke `dressFromPool` and the probe passed, correctly - the line that
actually re-binds a pooled material is `updateMaterialEverywhere`, and
dressFromPool behind it is belt and braces. A break that the probe shrugs at
is a break aimed at the wrong line, not a hole in the probe.
"""
import io

ROOT = r'C:\Users\a.bodrov\Projects\kubik'
s0 = io.open(ROOT + r'\index.html', encoding='utf-8', newline='').read()

BREAKS = [
    # 6c: IndexedDB refused, so everything falls back to the old ceiling.
    # The fallback is a road and not a failure - but if it is the ONLY road,
    # 2.36 bought nothing and four pictures still fill the origin.
    ('noidb',
     "    setTimeout(() => give(null), 6000);",
     "    setTimeout(() => give(null), 6000);\n    return give(null);"),
    # 6c from the other side: the bytes go to IndexedDB AND stay in
    # localStorage. A move that is really a copy leaves the old ceiling
    # exactly where it was, and nobody finds out until the fifth picture.
    ('bothroads',
     "    if (!db) return saveTextureLibraryLocal(used);",
     "    saveTextureLibraryLocal(used);\n    if (!db) return;"),
    # 6d: the bytes arrive and nothing is told. Every material that drew
    # before they landed keeps drawing flat - the exact cost of going async.
    ('silent',
     "  MATERIALS.forEach(d => { if (hasMaps(d)) { any = true; updateMaterialEverywhere(d.id); } });",
     "  MATERIALS.forEach(d => { if (hasMaps(d)) { any = true; } });"),
]

for name, old, new in BREAKS:
    assert s0.count(old) == 1, 'anchor missed for %s' % name
    io.open(ROOT + r'\_tex_broken_%s.html' % name, 'w',
            encoding='utf-8', newline='').write(s0.replace(old, new))
    print('wrote _tex_broken_%s.html' % name)
