# -*- coding: utf-8 -*-
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
# R5 + R3 + R4. The guard was too wide, and its toast was both a false
# positive and invisible. All three go away by narrowing it to the artefact.
# =====================================================================
rep("""      if (presetDefaults(d.id)) {
        const mine = MATERIALS.get(d.id);
        if (mine && materialDefSig(d) !== materialDefSig(mine)) presetDrift.push(mine.name || d.id);
        return;
      }""",
"""      if (presetDefaults(d.id)) {
        const mine = MATERIALS.get(d.id);
        /* COLOUR IS THEME DATA ON A PRESET, NOT DOCUMENT DATA (v2.30, narrowed
           in review). `color: null` means "the theme's grey", and an older
           build froze that to an explicit hex the moment any slider moved
           while the preset was open - which is the whole bug. So a difference
           in COLOUR ALONE is a serialisation artefact and this IS our preset:
           resolve to it, mint nothing, say nothing, because there is nothing
           to say.

           ANY OTHER DIFFERENCE - masks, bevel, roughness, metalness, name -
           is something a person made, and falls through to the branch that
           has always carried it: "Metal (imported)", remapped onto the faces
           that wore it. That is the a2.6x rule ("add scratches to Metal, save,
           open the file anywhere else") and it stays intact.

           The first cut of this guard returned for EVERY preset and toasted
           when the signatures differed. Both halves were wrong: it discarded
           real customisation, and it toasted on every open of the very file
           it was written for - where the only difference IS the frozen grey.
           The toast was also invisible, overwritten by loadProject's own
           "Opened ..." in the same tick. */
        if (mine && materialDefSig(Object.assign({}, d, { color: mine.color })) ===
                    materialDefSig(mine)) return;
      }""", 'guard-narrow')

rep("""    const bySig = new Map();
    const presetDrift = [];
""", """    const bySig = new Map();
""", 'drop-presetDrift-decl')

rep("""    if (presetDrift.length) {
      toast(presetDrift.join(' and ') + ' differ in this file \\u2014 kept yours');
    }
""", "", 'drop-presetDrift-toast')


# =====================================================================
# R7. "Differs from the opening value" is not "the person moved the picker":
# drag red and back to gold and the write was skipped, leaving red behind the
# gold swatch. A sticky flag, set by the colour input itself.
# =====================================================================
rep("""/* The colour the editor OPENED with, so meApplyLive can tell "the person
   moved the picker" from "the person moved some other slider" (v2.30). */
let meColorOpened = null;""",
"""/* HAS THE PERSON TOUCHED THE COLOUR PICKER since this editor opened (v2.30)?
   meApplyLive runs for all four controls and cannot otherwise tell which one
   fired, and a preset's `color: null` must survive a nudge of roughness.

   A STICKY FLAG, not a comparison against the opening value (found in review):
   dragging the picker to red and back to the gold it started on left d.color
   red while the swatch showed gold, because "differs right now" is not "was
   moved". Set by a listener on meColor itself, registered before the shared
   one so it is already true when meApplyLive reads it. */
let meColorTouched = false;""", 'meColorTouched-decl')

rep("""  // Read BACK, not the string we just assigned: the input normalises case.
  meColorOpened = meColor.value;""",
"""  meColorTouched = false;""", 'meColorTouched-reset')

rep("""  if (meColor.value !== meColorOpened) d.color = meColor.value;""",
"""  if (meColorTouched) d.color = meColor.value;""", 'meColorTouched-use')

rep("""[meColor, meMetal, meRough, meBevel].forEach(el => {
  el.addEventListener('input', meApplyLive);""",
"""// FIRST, so the flag is already set when meApplyLive reads it below.
['input', 'change'].forEach(ev => meColor.addEventListener(ev, () => { meColorTouched = true; }));
[meColor, meMetal, meRough, meBevel].forEach(el => {
  el.addEventListener('input', meApplyLive);""", 'meColorTouched-listener')


# =====================================================================
# R6. The conditional pointercancel could never fire - lpMoved is only ever
# set in the same block that already cancelled - so v2.3b's guard was removed
# rather than narrowed. It costs nothing to put back now: the pencil is on
# every card, so the hold is no longer the only way in.
# =====================================================================
rep("""    let lpTimer = null, longPressed = false, lpX = 0, lpY = 0, lpMoved = false;
    b.addEventListener('pointerdown', (ev) => {
      longPressed = false; lpMoved = false;""",
"""    let lpTimer = null, longPressed = false, lpX = 0, lpY = 0;
    b.addEventListener('pointerdown', (ev) => {
      longPressed = false;""", 'drop-lpMoved-decl')

rep("""      if (Math.abs(ev.clientX - lpX) + Math.abs(ev.clientY - lpY) > 8) {
        lpMoved = true;
        cancelLp();
      }""",
"""      if (Math.abs(ev.clientX - lpX) + Math.abs(ev.clientY - lpY) > 8) cancelLp();""",
    'drop-lpMoved-set')

rep("""    b.addEventListener('pointercancel', () => { if (lpMoved) cancelLp(); });""",
"""    /* BLANKET AGAIN, as v2.3b had it (found in review). Making it conditional
       on movement was dead code - the flag was only ever set in the block that
       had already cancelled - and the reasoning behind it is gone anyway: the
       pencil is on every card now, so a hold that iOS eats costs nothing,
       while a hold that survives a scroll opens an editor for a card the
       person was only scrolling past. The pointermove guard above stays as the
       belt for browsers that deliver a move but no cancel. */
    b.addEventListener('pointercancel', cancelLp);""", 'blanket-pointercancel')


# =====================================================================
# R1. A document carried the WHOLE library, so the next open put back
# everything CLEAN had just removed. A file should carry what it uses.
# =====================================================================
rep("""    materialLib: JSON.parse(JSON.stringify(Array.from(MATERIALS.values()).map(normaliseDefMasks))),""",
"""    /* WHAT THE DOCUMENT USES, not the whole library (v2.30, found in review).
       Writing every entry meant a file put back everything CLEAN had just
       removed - and a library that only ever grows was the bug in the first
       place. The three presets always travel, because they carry the
       overrides a person made to them and are three entries. */
    materialLib: JSON.parse(JSON.stringify(Array.from(MATERIALS.values())
      .filter(d => {
        if (presetDefaults(d.id)) return true;
        return App.objects.some(o => {
          const fin = o.mesh.userData.finishes || {};
          return Object.keys(fin).some(g => fin[g] === d.id);
        });
      })
      .map(normaliseDefMasks))),""", 'serializeDoc-used-only')


# =====================================================================
# R2. CLEAN read only the live scene, so undoing a delete brought an object
# back wearing a definition the sweep had taken. History is state too.
# =====================================================================
rep("""    const worn = new Set();
    App.objects.forEach(o => {
      const fin = o.mesh.userData.finishes || {};
      Object.keys(fin).forEach(g => worn.add(fin[g]));
    });""",
"""    const worn = new Set();
    App.objects.forEach(o => {
      const fin = o.mesh.userData.finishes || {};
      Object.keys(fin).forEach(g => worn.add(fin[g]));
    });
    /* AND EVERY HISTORY STEP (found in review). "Nothing in the scene wears
       it" is true of the scene and false of what undo can put back: delete the
       one object wearing a material, sweep, undo, and the object returned
       wearing Solid with its masks gone and no way back - the harvest does not
       re-adopt on undo, because undo passes keepAppearance. */
    (App.history || []).forEach(doc => {
      ((doc && doc.objects) || []).forEach(o => {
        const fin = o.finishes || {};
        Object.keys(fin).forEach(g => worn.add(fin[g]));
      });
    });""", 'sweep-history')

io.open(P, 'w', encoding='utf-8', newline='').write(s)
print('patches applied:', n)
