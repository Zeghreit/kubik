# -*- coding: utf-8 -*-
import io

P = '_mkmatbroken.py'
s = io.open(P, encoding='utf-8').read()

# the drift toast no longer exists
old_drift = """elif MODE == 'driftmute':
    # A file whose preset really differs is discarded silently. Expect 4.2.
    rep("    if (presetDrift.length) {", "    if (false && presetDrift.length) {")

"""
assert s.count(old_drift) == 1
s = s.replace(old_drift, "")

old = """else:
    raise SystemExit('unknown mode ' + MODE)"""
assert s.count(old) == 1

new = '''elif MODE == 'guardwide':
    # The guard returns for EVERY preset, so a file's genuinely customised
    # Metal (a mask on it) is discarded instead of arriving as a copy - the
    # a2.6x regression the review caught in the first cut. Expect 4.2.
    rep("        if (mine && materialDefSig(Object.assign({}, d, { color: mine.color })) ===\\n"
        "                    materialDefSig(mine)) return;",
        "        if (mine) return;")

elif MODE == 'guardcolour':
    # The guard compares the colour too, so the frozen theme grey reads as a
    # difference again and mints "Solid (imported)". Expect 4.1.
    rep("        if (mine && materialDefSig(Object.assign({}, d, { color: mine.color })) ===\\n"
        "                    materialDefSig(mine)) return;",
        "        if (mine && materialDefSig(d) === materialDefSig(mine)) return;")

elif MODE == 'colorsticky':
    # Back to "differs from the value it opened with" instead of a sticky
    # flag: moving the picker away and back leaves the away value. Expect 4.4.
    rep("let meColorTouched = false;", "let meColorTouched = false;\\nlet meColorOpened = null;")
    rep("  meColorTouched = false;", "  meColorTouched = false; meColorOpened = meColor.value;")
    rep("  if (meColorTouched) d.color = meColor.value;",
        "  if (meColor.value !== meColorOpened) d.color = meColor.value;")

elif MODE == 'docall':
    # A document carries the WHOLE library again, so the next open puts back
    # everything CLEAN removed. Expect 4.6.
    rep("        if (presetDefaults(d.id)) return true;", "        if (true) return true;")

elif MODE == 'sweepnohistory':
    # CLEAN reads only the live scene, so a material only an undo step wears
    # is taken. Expect 4.7.
    rep("    (App.history || []).forEach(doc => {", "    (false && App.history || []).forEach(doc => {")

else:
    raise SystemExit('unknown mode ' + MODE)'''

s = s.replace(old, new)
io.open(P, 'w', encoding='utf-8', newline='').write(s)
print('broken modes updated')

P2 = '_matbrokenrun.py'
s2 = io.open(P2, encoding='utf-8').read()
old2 = "    'driftmute':    ['4.2'],\n"
assert s2.count(old2) == 1
s2 = s2.replace(old2, "")
old3 = "    'sweepworn':    ['4.5'],\n}"
assert s2.count(old3) == 1
s2 = s2.replace(old3, """    'sweepworn':    ['4.5'],
    'guardwide':    ['4.2'],
    'guardcolour':  ['4.1'],
    'colorsticky':  ['4.4'],
    'docall':       ['4.6'],
    'sweepnohistory': ['4.7'],
}""")
io.open(P2, 'w', encoding='utf-8', newline='').write(s2)
print('EXPECT updated')
