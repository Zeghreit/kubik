import io

P = 'index.html'
s = io.open(P, encoding='utf-8').read()

old = """    MATERIALS, getMaterialDef, updateMaterialEverywhere, saveMaterialLibrary,
    harvestLegacyMaterials, applyFinishToSelection,"""
new = """    MATERIALS, getMaterialDef, updateMaterialEverywhere, saveMaterialLibrary,
    harvestLegacyMaterials, applyFinishToSelection,
    /* v2.29: the material LIBRARY's own invariants, which a probe could only
       infer from thumbnails before - and the two questions this version turns
       on: is this id actually in the library (liveMaterialDef) and do the tray
       cards still ARE it (matTrayStale). */
    MATERIAL_DEFAULTS, liveMaterialDef, matTrayStale, buildMatTray,
    refreshMatTray, loadMaterialLibrary, MATLIB_KEY,
    get matEditingId() { return matEditingId; },
    get matFlyEl() { return matFlyEl; },
    get matTrayInnerEl() { return matTrayInnerEl; },"""
assert s.count(old) == 1
s = s.replace(old, new)
io.open(P, 'w', encoding='utf-8', newline='').write(s)
print('debug handle extended')
