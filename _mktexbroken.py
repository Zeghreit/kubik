"""Deliberately broken builds, one decision each.

A check that has never failed is not a check. Every one of these has to be
caught by the section that exists for it, and must NOT stop the probe before
the rest run - a broken copy that halts early proves only that check one
works, which this project got wrong twice at v2.9.

Five of the seven are review findings from v2.33: the ones a reading of the
code called safe.
"""
import io

ROOT = r'C:\Users\a.bodrov\Projects\kubik'
s0 = io.open(ROOT + r'\index.html', encoding='utf-8', newline='').read()

BREAKS = [
    # section 7: the picture is never turned over
    ('flip',
     "  if (flipY) { c2.translate(0, h); c2.scale(1, -1); }",
     "  if (false) { c2.translate(0, h); c2.scale(1, -1); }"),
    # sections 4 and 5: the bytes ride on every document, history included
    ('history',
     "  if (opts && opts.withTextures) {",
     "  if (true) {"),
    # section 8: a mesh with no UVs gets a map bound anyway
    ('nouv',
     "  const key = id + '|' + side + (uvless ? '|nouv' : '') + '|' + (own || '');",
     "  const key = id + '|' + side + '|' + (own || '');"),
    # section 12: the new leg goes back after `own`, where prunePool's suffix
    # test stops matching - the leak review found
    ('prunepool',
     "  const key = id + '|' + side + (uvless ? '|nouv' : '') + '|' + (own || '');",
     "  const key = id + '|' + side + '|' + (own || '') + (uvless ? '|nouv' : '');"),
    # section 9b: the tray's + copies a definition by hand and drops the maps
    ('fork',
     "      maps: hasMaps(src) ? mapList(src) : undefined });",
     "      maps: undefined });"),
    # section 11: an emissive map multiplied by black
    ('emissive',
     "      const lit = want ? 0xffffff : 0x000000;",
     "      const lit = 0x000000;"),
    # section 10: the encoder chooses by the material's flags again
    ('alpha',
     "  const png = slotKey === 'normal' || hasAlpha;",
     "  const png = slotKey === 'normal';"),
    # section 13: nothing frees the pictures when the last wearer goes
    ('prune',
     "function pruneTextures() {\n  const live = texKeysInUse();",
     "function pruneTextures() {\n  if (true) return;\n  const live = texKeysInUse();"),
]

for name, old, new in BREAKS:
    assert s0.count(old) == 1, 'anchor missed for %s' % name
    io.open(ROOT + r'\_tex_broken_%s.html' % name, 'w',
            encoding='utf-8', newline='').write(s0.replace(old, new))
    print('wrote _tex_broken_%s.html' % name)
