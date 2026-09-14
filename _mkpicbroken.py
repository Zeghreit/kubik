"""Broken builds for the v2.35 picture channels, one decision each.

Same rule as _mktexbroken.py: each has to be caught by the section written
for it, and none may stop the probe before the rest run. The last four are
review findings - the ones a reading of the code called fine.
"""
import io

ROOT = r'C:\Users\a.bodrov\Projects\kubik'
s0 = io.open(ROOT + r'\index.html', encoding='utf-8', newline='').read()

BREAKS = [
    # 12c: the picker ignores which chip is open and always writes the first
    # channel - the bug a probe that called the worker directly would miss.
    ('slot',
     "  const slot = MAP_SLOTS[mpEditing];\n  const gen = ++_picGen;",
     "  const slot = MAP_SLOTS[0];\n  const gen = ++_picGen;"),
    # 12c: no dot, so which channels are set is invisible until you open them
    ('dot',
     "    b.textContent = sl.label + (maps[sl.key] ? ' \\u2022' : '');",
     "    b.textContent = sl.label;"),
    # 12d: an empty `maps` key survives removal, so the material stops
    # matching itself across a file - the a2.65a failure, again
    ('empty',
     "  if (!hasMaps(d)) delete d.maps;\n  mpStructural(d);",
     "  mpStructural(d);"),
    # 12e: two picks land in decode order, so the big photo you replaced
    # arrives last and overwrites the one you chose instead of it
    ('gen',
     "    if (gen !== _picGen) return;             // a later pick is already in flight",
     "    if (false) return;"),
    # 12e: the editor never tells the document anything, so the last autosave
    # predates every change made here
    ('autosave',
     "  scheduleAutosave();\n  const keep = matEditingId;",
     "  const keep = matEditingId;"),
    # 12f: Object.assign cannot clear a key the defaults do not have
    ('reset',
     "  delete d.maps;\n  rebakeMaskTexture(d);",
     "  rebakeMaskTexture(d);"),
    # 12f: an empty src is a fetch of index.html, decoded as an image
    ('src',
     "  if (entry) prev.src = entry.url; else prev.removeAttribute('src');",
     "  prev.src = entry ? entry.url : '';"),
]

for name, old, new in BREAKS:
    assert s0.count(old) == 1, 'anchor missed for %s' % name
    io.open(ROOT + r'\_pic_broken_%s.html' % name, 'w',
            encoding='utf-8', newline='').write(s0.replace(old, new))
    print('wrote _pic_broken_%s.html' % name)
