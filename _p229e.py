import io

P = 'index.html'
s = io.open(P, encoding='utf-8').read()
n = 0

def rep(old, new, label):
    global s, n
    c = s.count(old)
    assert c == 1, 'MATCH %d for %s' % (c, label)
    s = s.replace(old, new)
    n += 1
    print('ok', label)

# =====================================================================
# A. "is this id a preset" must be an OWN-PROPERTY question.
#    MATERIAL_DEFAULTS is a plain object literal, so ['constructor'],
#    ['toString'], ['valueOf'] are all truthy - and a file carrying
#    {"id":"constructor"} was adopted with preset:true, which is exactly the
#    undeletable, unresettable material this version exists to kill.
# =====================================================================
rep("""/* A PRESET IS ONE OF THE THREE IN MATERIAL_DEFAULTS, AND NOTHING ELSE (v2.29).""",
"""/* hasOwnProperty, not a bare index (v2.29, found in review). MATERIAL_DEFAULTS
   is a plain object literal, so MATERIAL_DEFAULTS['constructor'] and
   ['toString'] and ['valueOf'] are all truthy. A materialLib entry with
   `"id": "constructor"` - hand-edited, or written by anything else - was
   adopted with preset:true and became precisely the material described below:
   Delete hidden, Reset restoring nothing, and persistence writing it to
   presetOverrides where the next load drops it while faces still wear it. */
function presetDefaults(id) {
  return Object.prototype.hasOwnProperty.call(MATERIAL_DEFAULTS, id)
    ? MATERIAL_DEFAULTS[id] : undefined;
}

/* A PRESET IS ONE OF THE THREE IN MATERIAL_DEFAULTS, AND NOTHING ELSE (v2.29).""",
    'presetDefaults')

rep("""function isPresetDef(d) {
  return !!(d && d.preset && MATERIAL_DEFAULTS[d.id]);
}""",
"""function isPresetDef(d) {
  return !!(d && d.preset && presetDefaults(d.id));
}""", 'isPresetDef-own')

rep("""    const base = MATERIAL_DEFAULTS[d.id];
    if (!base) { customs.push(d); return; }   // flagged preset, no default (v2.29)""",
"""    const base = presetDefaults(d.id);
    if (!base) { customs.push(d); return; }   // flagged preset, no default (v2.29)""",
    'save-presetDefaults')

rep("  Object.assign(d, MATERIAL_DEFAULTS[d.id]);",
    "  Object.assign(d, presetDefaults(d.id));", 'meReset-presetDefaults')

# The themed-preset shortcut trusted the raw flag too.
rep("          if (hit || !v.preset) return;",
    "          if (hit || !isPresetDef(v)) return;", 'themed-shortcut-predicate')

# =====================================================================
# B. restoreDoc: the NAME is not a key here. Reverted (found in review).
#
#    serializeDoc writes EVERY library entry into doc.materialLib, presets
#    included, under their fixed names. Keyed on the name, a file's modified
#    Metal always found the local Metal, `known === d.id`, and the file's
#    definition was discarded - silently undoing the a2.x fix whose comment
#    sits a dozen lines above ("Add scratches to Metal, save, open the file
#    anywhere else, and the model arrived wearing plain Metal"). Two distinct
#    materials sharing a name inside one file collapsed the same way, and that
#    one survived the next save.
#
#    The SIGNATURE stays in front of the id branch, which is the half that is
#    safe and still fixes real duplication: an identical signature means an
#    identical look, so pointing at ours loses nothing.
# =====================================================================
rep("""    const bySig = new Map();
    const byName = new Map();
    /* migrateSig as well as on the way in:""",
"""    const bySig = new Map();
    /* migrateSig as well as on the way in:""", 'restore-drop-byname-decl')

rep("""      if (v.srcSig && !bySig.has(v.srcSig)) bySig.set(v.srcSig, id);
      // Merge by name here too (v2.29) - see the note in importMaterialContext.
      const ln = (v.name || '').toLowerCase();
      if (ln && !byName.has(ln)) byName.set(ln, id);
    });""",
"""      if (v.srcSig && !bySig.has(v.srcSig)) bySig.set(v.srcSig, id);
    });""", 'restore-drop-byname-fill')

rep("""         By signature first, then by NAME: same name is the same material, and
         the local definition is the one that survives. */
      const sig = materialDefSig(d);
      const dn = (d.name || '').toLowerCase();
      const known = bySig.get(sig) || (dn ? byName.get(dn) : undefined);
      if (known) {
        if (known !== d.id) matIdRemap.set(d.id, known);
        return;
      }
      if (!MATERIALS.has(d.id)) {
        MATERIALS.set(d.id, Object.assign({}, d, { preset: !!MATERIAL_DEFAULTS[d.id] }));
        bySig.set(sig, d.id);
        // Into the name index too, so two materials inside ONE file that
        // share a name land on one entry rather than two.
        if (dn && !byName.has(dn)) byName.set(dn, d.id);
        return;
      }""",
"""         BY SIGNATURE ONLY, and the NAME is deliberately not a key on this path
         (v2.29, found in review). serializeDoc writes every library entry into
         materialLib, presets included, under their fixed names - so a name key
         made a file's modified Metal always find the local Metal and throw the
         file's definition away, which is the bug the note above describes.
         Merging by name belongs to IMPORT, where the incoming material has no
         history here; a project file's own definitions are the document. An
         identical SIGNATURE is different in kind: the looks are the same, so
         pointing at ours loses nothing at all. */
      const sig = materialDefSig(d);
      const known = bySig.get(sig);
      if (known) {
        if (known !== d.id) matIdRemap.set(d.id, known);
        return;
      }
      if (!MATERIALS.has(d.id)) {
        MATERIALS.set(d.id, Object.assign({}, d, { preset: !!presetDefaults(d.id) }));
        bySig.set(sig, d.id);
        return;
      }""", 'restore-sig-only')

# =====================================================================
# C. import: presets are not merge targets, the key is the FULL name, and a
#    mint does not become a merge target within its own file.
# =====================================================================
rep("""  /* NAME -> ID, not a set of names already taken (v2.29). THE NAME IS THE
     IDENTITY. A file that calls its material "Skin" means the Skin already in
     the tray, even when it exports 0.52 roughness against the 0.5 that was
     typed, and even when its colour lands one 8-bit step out on the
     sRGB round trip. Any such difference missed the signature index, and the
     only branch left was to MINT - "Skin (imported)", then "Skin (imported 2)"
     on the next file. The stack grew by one entry per open and nothing ever
     merged back, which is what this index is here to stop. */
  const byName = new Map();""",
"""  /* TWO INDEXES ON THE NAME, ASKING DIFFERENT QUESTIONS (v2.29).

     `byName` answers "is this material already in the library". THE NAME IS
     THE IDENTITY: a file that calls its material "Skin" means the Skin already
     in the tray, even when it exports 0.52 roughness against the 0.5 that was
     typed, and even when its colour lands one 8-bit step out on the sRGB round
     trip. Any such difference missed the signature index, and the only branch
     left was to MINT - "Skin (imported)", then "Skin (imported 2)" on the next
     file. The stack grew by one entry per open and nothing merged back.

     PRESETS ARE LEFT OUT OF IT (found in review). Solid, Plastic and Metal
     carry `color: null`, which means "whatever the theme's grey is now" - so
     merging a GOLD material named "Metal" onto the Metal preset would repaint
     it grey and make it follow the theme for ever, and "Metal" is one of the
     commonest names in a downloaded asset. An incoming colour that really is
     our grey is caught by the themed-preset shortcut further down, which is
     bounded by nearHex and a roughness tolerance. That is the only road onto a
     preset, and it stays the only one.

     `taken` answers "is this name spoken for", for the rename loop at the
     bottom. It grows as we mint; byName does NOT. So two materials inside ONE
     file that happen to share a name stay two materials with their two
     colours, while the same name arriving from a LATER file merges onto what
     this one left behind. */
  const byName = new Map();
  const taken = new Set();""", 'import-two-indexes')

rep("""    const ln = (v.name || '').toLowerCase();
    if (ln && !byName.has(ln)) byName.set(ln, id);   // first writer wins
  });""",
"""    const ln = (v.name || '').toLowerCase();
    if (ln) {
      taken.add(ln);
      if (!isPresetDef(v) && !byName.has(ln)) byName.set(ln, id);   // first writer wins
    }
  });""", 'import-fill-two')

rep("""      const stated = String(src.name == null ? '' : src.name).trim().slice(0, 32);
      const raw = stated || 'Imported';""",
"""      const full = String(src.name == null ? '' : src.name).trim();
      const stated = full.slice(0, 32);
      const raw = stated || 'Imported';""", 'import-full-name')

rep("""      if (stated) {
        const byn = byName.get(stated.toLowerCase());
        if (byn) { cache.set(src, byn); return byn; }
      }""",
"""      /* Keyed on the FULL name, not the 32-character slice that becomes the
         stored one (found in review): two names that differ only after
         character 32 are two names, and a library entry whose own name is
         longer than that has to be findable by it. */
      if (full) {
        const byn = byName.get(full.toLowerCase());
        if (byn) { cache.set(src, byn); return byn; }
      }""", 'import-merge-full')

rep("""      let name = raw, k = 1;
      while (byName.has(name.toLowerCase())) {""",
"""      let name = raw, k = 1;
      while (taken.has(name.toLowerCase())) {""", 'rename-loop-taken')

rep("""      byName.set(name.toLowerCase(), nid);
      bySig.set(sig, nid);""",
"""      /* `taken`, NOT byName - see the note on the two indexes. A material
         minted from this file must not become the merge target for the next
         material in the SAME file. */
      taken.add(name.toLowerCase());
      bySig.set(sig, nid);""", 'mint-taken-only')

io.open(P, 'w', encoding='utf-8', newline='').write(s)
print('patches applied:', n)
