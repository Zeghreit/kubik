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

# ---- A. the harvest asked the library only AFTER adopting a foreign id ----
#
# Found by the probe: a doc carrying its own id for a material the library
# already holds took the "never seen this id" branch and was adopted as a
# SECOND entry beside it. The signature test - and the new name test - sat
# below that branch and never ran. Which is the whole complaint.
rep("""      if (!MATERIALS.has(d.id)) {
        MATERIALS.set(d.id, Object.assign({}, d, { preset: !!MATERIAL_DEFAULTS[d.id] }));
        bySig.set(materialDefSig(d), d.id);
        return;
      }
      /* We already hold this id. Is this look anywhere in the library - under
         that id or another? Then point at it and mint nothing. That covers
         "identical, keep ours" and "we imported this last time" in one test. */
      const sig = materialDefSig(d);
      const known = bySig.get(sig);
      if (known) {
        if (known !== d.id) matIdRemap.set(d.id, known);
        return;
      }
      /* Same name, different look: OURS (v2.29). Without this a project file
         holding a "Skin" that has since been tuned here arrived as a second
         "Skin (imported)" on every open. */
      const byn = byName.get((d.name || '').toLowerCase());
      if (byn && (d.name || '')) {
        if (byn !== d.id) matIdRemap.set(d.id, byn);
        return;
      }
      const nid = freshMaterialId(d.id);""",
"""      /* IS THIS LOOK - OR THIS NAME - ALREADY IN THE LIBRARY, under any id?
         Then point at it and add nothing.

         ASKED BEFORE THE ID IS LOOKED AT (v2.29, found by the probe). This
         test used to sit BELOW "we have never seen this id", so a file
         carrying its own id for a material the library already held was
         adopted as a second entry beside it and the test never ran. Two
         "Skin" cards in the tray, one more on the next open - which is the
         stack growing per open that this version exists to stop.

         By signature first, then by NAME: same name is the same material, and
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
      }
      const nid = freshMaterialId(d.id);""", 'harvest-order')

# ---- B. "open" outlives the tray by one transition ----
#
# Found by the probe: setMatTrayOpen(false) adds `closing` and removes `open`
# 240ms later, so a hand-rolled `contains('open')` read a closed shelf as open
# and every selection tap would have paid for a rebuild. matTrayIsOpen already
# states what open means; there is no reason for a second opinion.
rep("""  if (!matTrayInnerEl || !matFlyEl || !matFlyEl.classList.contains('open')) return false;""",
"""  if (!matTrayInnerEl || !matFlyEl || !matTrayIsOpen()) return false;""", 'tray-open-test')

io.open(P, 'w', encoding='utf-8', newline='').write(s)
print('patches applied:', n)
