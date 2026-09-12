import io, re, sys

P = 'index.html'
s = io.open(P, encoding='utf-8').read()
orig = s
n = 0

def rep(old, new, label):
    global s, n
    c = s.count(old)
    assert c == 1, 'MATCH %d for %s' % (c, label)
    s = s.replace(old, new)
    n += 1
    print('ok', label)

# ---------- 1. import: byName becomes an index, not a set of taken names ----------
rep("""  const bySig = new Map();
  const byName = new Set();
  MATERIALS.forEach((v, id) => {""",
"""  const bySig = new Map();
  /* NAME -> ID, not a set of names already taken (v2.29). THE NAME IS THE
     IDENTITY. A file that calls its material "Skin" means the Skin already in
     the tray, even when it exports 0.52 roughness against the 0.5 that was
     typed, and even when its colour lands one 8-bit step out on the
     sRGB round trip. Any such difference missed the signature index, and the
     only branch left was to MINT - "Skin (imported)", then "Skin (imported 2)"
     on the next file. The stack grew by one entry per open and nothing ever
     merged back, which is what this index is here to stop. */
  const byName = new Map();
  MATERIALS.forEach((v, id) => {""", 'byName-map')

rep("""    byName.add((v.name || '').toLowerCase());
  });""",
"""    const ln = (v.name || '').toLowerCase();
    if (ln && !byName.has(ln)) byName.set(ln, id);   // first writer wins
  });""", 'byName-fill')

# ---------- 2. idFor: remember whether the source actually stated a name ----------
rep("""      const raw = String(src.name == null ? '' : src.name).trim().slice(0, 32) || 'Imported';""",
"""      const stated = String(src.name == null ? '' : src.name).trim().slice(0, 32);
      const raw = stated || 'Imported';""", 'stated-name')

# ---------- 3. idFor: merge by name instead of minting a renamed copy ----------
rep("""      if (minted >= IMPORT_MATERIAL_BUDGET) { cache.set(src, 'standard'); return 'standard'; }""",
"""      /* SAME NAME IS THE SAME MATERIAL (v2.29). Reached only once the exact
         signature has missed - which IS the case this fixes: a name the
         library already holds, carrying a look that differs by a rounding
         step, by a colour that survived a round trip imperfectly, or by a
         tweak the person made after importing it the first time.

         THE LOCAL DEFINITION WINS. A material someone has tuned must not be
         repainted by whatever a file happens to carry; merging onto what is
         already there is the whole point of merging.

         Only for a source that actually stated a name. `raw` falls back to
         "Imported" for one that did not, and collapsing every unnamed
         material in a file onto a single entry would throw their colours
         away - which is the opposite of a merge. */
      if (stated) {
        const byn = byName.get(stated.toLowerCase());
        if (byn) { cache.set(src, byn); return byn; }
      }
      if (minted >= IMPORT_MATERIAL_BUDGET) { cache.set(src, 'standard'); return 'standard'; }""",
    'merge-by-name-import')

rep("""      byName.add(name.toLowerCase());
      bySig.set(sig, nid);""",
"""      byName.set(name.toLowerCase(), nid);
      bySig.set(sig, nid);""", 'byName-set')

# ---------- 4. restoreDoc harvest: the same merge ----------
rep("""      const own = materialDefSig(v);
      if (!bySig.has(own)) bySig.set(own, id);
      if (v.srcSig && !bySig.has(v.srcSig)) bySig.set(v.srcSig, id);
    });""",
"""      const own = materialDefSig(v);
      if (!bySig.has(own)) bySig.set(own, id);
      if (v.srcSig && !bySig.has(v.srcSig)) bySig.set(v.srcSig, id);
      // Merge by name here too (v2.29) - see the note in importMaterialContext.
      const ln = (v.name || '').toLowerCase();
      if (ln && !byName.has(ln)) byName.set(ln, id);
    });""", 'restore-byname-fill')

rep("""    const bySig = new Map();
    /* migrateSig as well as on the way in:""",
"""    const bySig = new Map();
    const byName = new Map();
    /* migrateSig as well as on the way in:""", 'restore-byname-decl')

rep("""      const sig = materialDefSig(d);
      const known = bySig.get(sig);
      if (known) {
        if (known !== d.id) matIdRemap.set(d.id, known);
        return;
      }
      const nid = freshMaterialId(d.id);""",
"""      const sig = materialDefSig(d);
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
      const nid = freshMaterialId(d.id);""", 'merge-by-name-restore')

# ---------- 5. a lookup that does not lie to the editor ----------
rep("""function getMaterialDef(id) {
  return normaliseDefMasks(MATERIALS.get(id) || MATERIALS.get('standard'));
}""",
"""function getMaterialDef(id) {
  return normaliseDefMasks(MATERIALS.get(id) || MATERIALS.get('standard'));
}

/* THE FALLBACK ABOVE IS RIGHT EVERYWHERE EXCEPT THE EDITOR (v2.29).

   Every DRAWING path wants it: a face still wearing a finish that has been
   deleted has to be painted with something, and Solid is the right something.

   The material editor is the one caller for which it is a lie. A tray card
   captures its id in a closure when the tray is built, and an import or an
   undo can REMAP or drop ids underneath an open tray. Opening such a card
   then handed back the Solid PRESET under the dead card's name: the header
   read "Solid (preset)", the Delete button hid itself because presets cannot
   be deleted, Reset restored Solid, and all eleven controls edited Solid.

   From the outside that is a material that has moved into the tray and can be
   neither deleted nor edited - which is exactly what it looked like. */
function liveMaterialDef(id) {
  return MATERIALS.has(id) ? normaliseDefMasks(MATERIALS.get(id)) : null;
}""", 'liveMaterialDef')

# ---------- 6. heal an entry flagged preset that has no default ----------
rep("""    if (Number.isFinite(raw.nextNum)) nextMaterialNum = raw.nextNum;
  } catch (e) { /* a broken library entry must never stop the app */ }
}""",
"""    if (Number.isFinite(raw.nextNum)) nextMaterialNum = raw.nextNum;
  } catch (e) { /* a broken library entry must never stop the app */ }
  /* A PRESET IS ONE OF THE THREE IN MATERIAL_DEFAULTS AND NOTHING ELSE
     (v2.29). An entry flagged `preset` whose id is not in there could be
     neither deleted (meDelete refuses presets) nor reset (there is no default
     to go back to), and saveMaterialLibrary read base.color straight off it -
     which throws, OUTSIDE that function's try, taking the whole library's
     persistence down with it. Nothing in this build can write one, so this
     heals anything an older one left behind and keeps the invariant stated in
     one place rather than assumed in four. */
  MATERIALS.forEach(d => { if (d.preset && !MATERIAL_DEFAULTS[d.id]) d.preset = false; });
}""", 'heal-orphan-preset')

# ---------- 7. and it can no longer throw the library away ----------
rep("""    const base = MATERIAL_DEFAULTS[d.id];
    if (d.color !== base.color || d.roughness !== base.roughness ||""",
"""    const base = MATERIAL_DEFAULTS[d.id];
    if (!base) { customs.push(d); return; }   // flagged preset, no default (v2.29)
    if (d.color !== base.color || d.roughness !== base.roughness ||""", 'save-base-guard')

# ---------- 8. a stale card cannot survive a refresh ----------
rep("""function refreshMatTray() {
  const cur = currentSelectionFinish();""",
"""/* A STALE CARD IS A MATERIAL NOBODY CAN EDIT (v2.29). Cards capture their id
   when the tray is built, and an import or an undo remaps and drops ids under
   an open tray - restoreDoc only nulls the preview cache, it does not rebuild.
   So before repainting the highlight, check that the cards still ARE the
   library and rebuild if they are not.

   O(cards) on a panel holding a few dozen, against the alternative of having
   to remember to rebuild at every site that touches MATERIALS - which is the
   thing that was forgotten. Only while the shelf is actually open and has
   been built once: buildMatTray costs one GPU render and one toDataURL per
   material, and refreshMatTray is called on every selection change. */
function matTrayStale() {
  if (!matTrayInnerEl || !matFlyEl || !matFlyEl.classList.contains('open')) return false;
  const cards = matTrayInnerEl.querySelectorAll('.mat-card:not(.add)');
  if (!cards.length) return false;                       // never built
  if (cards.length !== MATERIALS.size) return true;
  for (let i = 0; i < cards.length; i++) {
    if (!MATERIALS.has(cards[i].dataset.finish)) return true;
  }
  return false;
}

function refreshMatTray() {
  if (matTrayStale()) { _matPreviews = null; buildMatTray(); }
  const cur = currentSelectionFinish();""", 'tray-stale')

# ---------- 9..12. the editor stops editing Solid behind your back ----------
rep("""function openMatEditor(id) {
  matEditingId = id;
  const d = getMaterialDef(id);
  meName.textContent = d.name + (d.preset ? ' (preset)' : '');""",
"""function openMatEditor(id) {
  const d = liveMaterialDef(id);
  /* Gone from the library - a stale card. Rebuild and say so, rather than
     opening the Solid preset wearing this card's name (v2.29). */
  if (!d) {
    matEditingId = null;
    _matPreviews = null;
    buildMatTray();
    refreshMatTray();
    toast('That material is no longer in the library');
    return;
  }
  matEditingId = id;
  meName.textContent = d.name + (d.preset ? ' (preset)' : '');""", 'openMatEditor')

rep("""function meApplyLive() {
  if (!matEditingId) return;
  const d = getMaterialDef(matEditingId);
  d.color = meColor.value;""",
"""function meApplyLive() {
  if (!matEditingId) return;
  // Strict: the fallback would write all eleven controls into Solid (v2.29).
  const d = liveMaterialDef(matEditingId);
  if (!d) return;
  d.color = meColor.value;""", 'meApplyLive')

rep("""  const d = getMaterialDef(matEditingId);
  if (!d || !d.preset) return;
  Object.assign(d, MATERIAL_DEFAULTS[d.id]);""",
"""  const d = liveMaterialDef(matEditingId);
  if (!d) return;
  const base = MATERIAL_DEFAULTS[d.id];
  /* Only a real preset has somewhere to go back to, and the refusal is said
     out loud: a button that silently does nothing reads as a broken app, and
     Object.assign(d, undefined) did nothing while still toasting "Reset to
     default" (v2.29). */
  if (!d.preset || !base) { toast('Only Solid, Plastic and Metal have a default'); return; }
  Object.assign(d, base);""", 'meReset')

rep("""  const d = getMaterialDef(matEditingId);
  if (!d || d.preset) return;
  App.objects.forEach(o => {""",
"""  const d = liveMaterialDef(matEditingId);
  if (!d) { closeMatEditor(true); return; }
  // Said out loud, for the same reason as Reset above (v2.29).
  if (d.preset) { toast('Solid, Plastic and Metal cannot be deleted \\u2014 use Reset'); return; }
  App.objects.forEach(o => {""", 'meDelete')

# ---------- 13. version (the brand badge ONLY - every other 2.28 is history) ----------
rep('font-weight:400;">2.28</span>', 'font-weight:400;">2.29</span>', 'version')

io.open(P, 'w', encoding='utf-8', newline='').write(s)
print('patches applied:', n, 'bytes', len(orig), '->', len(s))
