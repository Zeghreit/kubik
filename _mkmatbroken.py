import io, sys

MODE = sys.argv[1] if len(sys.argv) > 1 else 'merge'
s = io.open('index.html', encoding='utf-8').read()


def rep(old, new):
    global s
    assert s.count(old) == 1, 'MATCH %d' % s.count(old)
    s = s.replace(old, new)


MERGE = """      if (full) {
        const byn = byName.get(full.toLowerCase());
        if (byn) { cache.set(src, byn); return byn; }
      }"""

HARVEST_SIG = """      const sig = materialDefSig(d);
      const known = bySig.get(sig);
      if (known) {
        if (known !== d.id) matIdRemap.set(d.id, known);
        return;
      }
      if (!MATERIALS.has(d.id)) {
        MATERIALS.set(d.id, Object.assign({}, d, { preset: !!presetDefaults(d.id) }));
        bySig.set(sig, d.id);
        return;
      }"""

if MODE == 'merge':
    # The merge-by-name branch never fires. Expect 1.1 / 1.3 / 1.7 / 1.10.
    rep(MERGE, MERGE.replace('if (full) {', 'if (false && full) {'))

elif MODE == 'unnamed':
    # Merge by name even for a source that stated none, so every unnamed
    # material in a file collapses onto one entry. Expect 1.6.
    rep(MERGE, MERGE.replace('if (full) {', 'if (true) {')
               .replace('byName.get(full.toLowerCase())', 'byName.get(raw.toLowerCase())'))
    # ...and the mint registers its fallback name, which is what makes the
    # collapse reachable inside one file as well as across two.
    rep("      taken.add(name.toLowerCase());\n      bySig.set(sig, nid);",
        "      taken.add(name.toLowerCase());\n"
        "      byName.set(raw.toLowerCase(), nid);\n"
        "      bySig.set(sig, nid);")

elif MODE == 'presettarget':
    # Presets become merge targets again, so a gold "Metal" turns into the grey
    # theme-following Metal preset. Expect 1.8.
    rep("    if (!isPresetDef(v)) {\n      [v.srcName, v.name].forEach(x => {",
        "    if (true) {\n      [v.srcName, v.name].forEach(x => {")

elif MODE == 'samefile':
    # A freshly minted entry becomes a merge target inside its own import, so
    # two same-named materials in ONE file collapse. Expect 1.10.
    rep("      taken.add(name.toLowerCase());\n      bySig.set(sig, nid);",
        "      taken.add(name.toLowerCase());\n"
        "      byName.set(String(full || name).toLowerCase(), nid);\n"
        "      bySig.set(sig, nid);")

elif MODE == 'slice':
    # Key the merge on the 32-character slice, so two names that agree in their
    # first 32 characters collapse. Expect 1.11.
    rep("        const byn = byName.get(full.toLowerCase());",
        "        const byn = byName.get(stated.toLowerCase());")

elif MODE == 'namekey':
    # Put the NAME back into restoreDoc's lookup, so a project file's own
    # definition is discarded whenever the library holds that name. Expect 2.2.
    rep("      const sig = materialDefSig(d);\n      const known = bySig.get(sig);",
        "      const sig = materialDefSig(d);\n"
        "      let known = bySig.get(sig);\n"
        "      if (!known) MATERIALS.forEach((v, id) => {\n"
        "        if (!known && (v.name || '') === (d.name || '')) known = id;\n"
        "      });")

elif MODE == 'harvest':
    # The id branch goes back in front of the library lookup, so a foreign id
    # for a look we already hold is adopted as a second entry. Expect 2.1.
    rep(HARVEST_SIG, """      const sig = materialDefSig(d);
      if (!MATERIALS.has(d.id)) {
        MATERIALS.set(d.id, Object.assign({}, d, { preset: !!presetDefaults(d.id) }));
        bySig.set(sig, d.id);
        return;
      }
      const known = bySig.get(sig);
      if (known) {
        if (known !== d.id) matIdRemap.set(d.id, known);
        return;
      }""")

elif MODE == 'protokey':
    # Back to a bare index into MATERIAL_DEFAULTS, so an id off Object's
    # prototype reads as a preset. Expect 2.3.
    rep("  return !!(d && d.preset && presetDefaults(d.id));",
        "  return !!(d && d.preset && MATERIAL_DEFAULTS[d.id]);")
    rep("        MATERIALS.set(d.id, Object.assign({}, d, { preset: !!presetDefaults(d.id) }));",
        "        MATERIALS.set(d.id, Object.assign({}, d, { preset: !!MATERIAL_DEFAULTS[d.id] }));")

elif MODE == 'strict':
    # liveMaterialDef lies the way getMaterialDef does. Expect 3.2 / 3.3 / 3.5.
    rep("  return MATERIALS.has(id) ? normaliseDefMasks(MATERIALS.get(id)) : null;",
        "  return normaliseDefMasks(MATERIALS.get(id) || MATERIALS.get('standard'));")

elif MODE == 'tray':
    # A stale card is never noticed. Expect 3.6.
    rep("  if (!matTrayInnerEl || !matFlyEl || !matTrayIsOpen()) return false;",
        "  if (true) return false;\n  if (!matTrayInnerEl || !matFlyEl || !matTrayIsOpen()) return false;")

elif MODE == 'trayopen':
    # Read the class by hand, so a closing shelf reads as open. Expect 3.7.
    rep("  if (!matTrayInnerEl || !matFlyEl || !matTrayIsOpen()) return false;",
        "  if (!matTrayInnerEl || !matFlyEl || !matFlyEl.classList.contains('open')) return false;")

elif MODE == 'save':
    # saveMaterialLibrary reads base.color with no guard again. Expect 3.8.
    rep("    if (!base) { customs.push(d); return; }   // flagged preset, no default (v2.29)\n", "")

elif MODE == 'heal':
    # isPresetDef trusts the stored flag, so an entry flagged preset with no
    # default is undeletable and un-resettable. Expect 3.9.
    rep("  return !!(d && d.preset && presetDefaults(d.id));", "  return !!(d && d.preset);")

elif MODE == 'mute':
    # The refusals go back to returning silently. Expect 3.3 / 3.10.
    rep("    toast('That material is no longer in the library');\n", "")
    rep("  if (isPresetDef(d)) { toast('Solid, Plastic and Metal cannot be deleted \\u2014 use Reset'); return; }",
        "  if (isPresetDef(d)) { return; }")

else:
    raise SystemExit('unknown mode ' + MODE)

io.open('_broken_mat.html', 'w', encoding='utf-8', newline='').write(s)
print('wrote _broken_mat.html  mode=' + MODE)
