# -*- coding: utf-8 -*-
import io

# ---- new broken modes ----
P = '_mkmatbroken.py'
s = io.open(P, encoding='utf-8').read()

old = """else:
    raise SystemExit('unknown mode ' + MODE)"""
assert s.count(old) == 1

new = '''elif MODE == 'presetmint':
    # The harvest stops treating a preset id as that preset, so a document
    # whose Solid carries a frozen grey mints a copy again. Expect 4.1.
    rep("      if (presetDefaults(d.id)) {", "      if (false && presetDefaults(d.id)) {")

elif MODE == 'driftmute':
    # A file whose preset really differs is discarded silently. Expect 4.2.
    rep("    if (presetDrift.length) {", "    if (false && presetDrift.length) {")

elif MODE == 'pincolor':
    # meApplyLive writes the picker back unconditionally, so nudging roughness
    # on Solid freezes its colour again - the upstream cause. Expect 4.3.
    rep("  if (meColor.value !== meColorOpened) d.color = meColor.value;",
        "  d.color = meColor.value;")

elif MODE == 'nocolor':
    # ...and the opposite: the colour field itself stops working. Expect 4.4.
    rep("  if (meColor.value !== meColorOpened) d.color = meColor.value;",
        "  if (false) d.color = meColor.value;")

elif MODE == 'sweeppreset':
    # The sweep stops sparing presets (all but Solid, so the app still runs
    # and the probe reaches its checks rather than throwing). Expect 4.5.
    rep("      if (isPresetDef(d) || worn.has(id)) return;",
        "      if (isPresetDef(d) && d.id === 'standard') return;\\n"
        "      if (worn.has(id)) return;")

elif MODE == 'sweepworn':
    # The sweep stops sparing what the scene is wearing. Expect 4.5.
    rep("      if (isPresetDef(d) || worn.has(id)) return;",
        "      if (isPresetDef(d)) return;")

else:
    raise SystemExit('unknown mode ' + MODE)'''

s = s.replace(old, new)
io.open(P, 'w', encoding='utf-8', newline='').write(s)
print('broken modes added')

# ---- EXPECT ----
P2 = '_matbrokenrun.py'
s2 = io.open(P2, encoding='utf-8').read()
old2 = "    'mute':         ['3.3', '3.10'],\n}"
assert s2.count(old2) == 1
new2 = """    'mute':         ['3.3', '3.10'],
    'presetmint':   ['4.1'],
    'driftmute':    ['4.2'],
    'pincolor':     ['4.3'],
    'nocolor':      ['4.4'],
    'sweeppreset':  ['4.5'],
    'sweepworn':    ['4.5'],
}"""
s2 = s2.replace(old2, new2)
io.open(P2, 'w', encoding='utf-8', newline='').write(s2)
print('EXPECT extended')
