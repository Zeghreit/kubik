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
# A1. A PRESET ID IS THAT PRESET. It never mints a copy of itself.
#
# Measured on the real Kubik_NeoTank.json: library of 3 in, 9 out, and two of
# the six new cards were "Solid (imported)" and "Plastic (imported)".
# =====================================================================
rep("""      /* IS THIS LOOK - OR THIS NAME - ALREADY IN THE LIBRARY, under any id?""",
"""      /* A PRESET ID IS THAT PRESET, AND NEVER A COPY OF IT (v2.30).

         standard, plastic and metal belong to the APP, not to any document:
         there is exactly one Solid, and a shelf card called "Solid (imported)"
         is incoherent by construction. But a document records a preset's
         colour as it stood when it was saved, and `color: null` - "follow the
         theme" - comes back as an explicit grey the moment anyone nudges a
         slider while that preset is open (see meApplyLive, which is the
         upstream half of this bug). That frozen grey then misses the signature
         index, the id is already taken, and the only branch left was to MINT.

         Measured on a real project file: three entries in, nine out, two of
         them "Solid (imported)" and "Plastic (imported)" - and one more pair
         for every theme the file travels through.

         Said out loud rather than dropped silently: a file whose preset really
         does differ - someone's Metal with scratches on it - is the case the
         minting branch was built for, and the person deserves to know their
         own is being shown instead of a second card appearing for ever. */
      if (presetDefaults(d.id)) {
        const mine = MATERIALS.get(d.id);
        if (mine && materialDefSig(d) !== materialDefSig(mine)) presetDrift.push(mine.name || d.id);
        return;
      }
      /* IS THIS LOOK - OR THIS NAME - ALREADY IN THE LIBRARY, under any id?""",
    'harvest-preset-guard')

rep("""    const bySig = new Map();
    /* migrateSig as well as on the way in:""",
"""    const bySig = new Map();
    const presetDrift = [];
    /* migrateSig as well as on the way in:""", 'presetDrift-decl')

rep("""      bySig.set(sig, nid);
    });
    saveMaterialLibrary();""",
"""      bySig.set(sig, nid);
    });
    if (presetDrift.length) {
      toast(presetDrift.join(' and ') + ' differ in this file \\u2014 kept yours');
    }
    saveMaterialLibrary();""", 'presetDrift-toast')


# =====================================================================
# A2. The upstream half: the editor stops freezing a preset's colour.
# =====================================================================
rep("""const meName = document.getElementById('meName');""",
"""/* The colour the editor OPENED with, so meApplyLive can tell "the person
   moved the picker" from "the person moved some other slider" (v2.30). */
let meColorOpened = null;
const meName = document.getElementById('meName');""", 'meColorOpened-decl')

rep("""  meColor.value = d.color || '#' + DEFAULT_MATERIAL_COLOR.toString(16).padStart(6, '0');""",
"""  meColor.value = d.color || '#' + DEFAULT_MATERIAL_COLOR.toString(16).padStart(6, '0');
  // Read BACK, not the string we just assigned: the input normalises case.
  meColorOpened = meColor.value;""", 'meColorOpened-set')

rep("""  const d = liveMaterialDef(matEditingId);
  if (!d) return;
  d.color = meColor.value;""",
"""  const d = liveMaterialDef(matEditingId);
  if (!d) return;
  /* `color: null` ON A PRESET MEANS "THE THEME'S GREY" (v2.30). Writing the
     picker back unconditionally froze that to an explicit hex the moment
     anyone nudged roughness on Solid: the preset stopped following the theme,
     saveMaterialLibrary wrote a presetOverride, serializeDoc put the frozen
     grey into every saved file, and every later open of that file minted a
     "Solid (imported)" beside it. So the colour is written only when the
     picker has actually MOVED. For a material that already has a colour this
     changes nothing - opened value and current value are the same string. */
  if (meColor.value !== meColorOpened) d.color = meColor.value;""", 'meApplyLive-colour')


# =====================================================================
# B. The shelf card can be edited with a finger.
#
# The pencil showed on the ACTIVE card only - the one the selection is
# already wearing - so for every other material the 500ms hold was the only
# way in. On iOS the scroller claims the touch and fires pointercancel on a
# shelf this long, and v2.3b cancels the hold on any pointercancel at all, so
# on a phone there was NO way to open the editor for most cards.
# =====================================================================
rep("""  .mat-edit {
    position: absolute; top: 2px; right: 2px; width: 20px; height: 20px;
    border-radius: 0; background: var(--signal); color: var(--on-accent);
    font-size: 11px; line-height: 20px; text-align: center; display: none;
  }
  .mat-card.active .mat-edit { display: block; }""",
"""  /* ON EVERY CARD (v2.30), not just the active one. It is the only way to
     open a material that the selection is not already wearing, and reaching
     it through a 500ms hold does not survive a scrolling shelf on iOS. A
     control may not be gesture-only - the same rule as no hover-only.
     Still ONE red mark in the shelf: the pencil is quiet everywhere except
     on the applied card, so a2.101's signal is intact. */
  .mat-edit {
    position: absolute; top: 2px; right: 2px; width: 20px; height: 20px;
    border-radius: 0; background: var(--panel2); color: var(--text-dim);
    font-size: 11px; line-height: 20px; text-align: center; display: block;
  }
  /* A FINGER IS BIGGER THAN 20 PIXELS. The hit area reaches past the glyph
     without changing what the glyph looks like. */
  .mat-edit::after { content: ''; position: absolute; inset: -6px; }
  .mat-card.active .mat-edit { background: var(--signal); color: var(--on-accent); }""",
    'pencil-everywhere')

rep("""    let lpTimer = null, longPressed = false;
    b.addEventListener('pointerdown', () => {
      longPressed = false;
      lpTimer = setTimeout(() => { longPressed = true; openMatEditor(k); }, 500);
    });
    const cancelLp = () => { if (lpTimer) { clearTimeout(lpTimer); lpTimer = null; } };""",
"""    let lpTimer = null, longPressed = false, lpX = 0, lpY = 0, lpMoved = false;
    b.addEventListener('pointerdown', (ev) => {
      longPressed = false; lpMoved = false;
      lpX = ev.clientX; lpY = ev.clientY;
      lpTimer = setTimeout(() => { longPressed = true; openMatEditor(k); }, 500);
    });
    const cancelLp = () => { if (lpTimer) { clearTimeout(lpTimer); lpTimer = null; } };
    /* MOVEMENT is what says "this is a scroll, not a hold" (v2.30) - the same
       rule the outliner's hold and a2.94's pickup already use. v2.3b read
       pointercancel as that signal instead, which is true on a desktop and
       false on a phone: iOS fires it for a STATIONARY press once the scroller
       decides it might own the gesture, so the hold could not complete at all
       on the shelf this matters most in. A flick moves, so it still cancels. */
    b.addEventListener('pointermove', (ev) => {
      if (!lpTimer) return;
      if (Math.abs(ev.clientX - lpX) + Math.abs(ev.clientY - lpY) > 8) {
        lpMoved = true;
        cancelLp();
      }
    });""", 'hold-movement-guard')

rep("""    b.addEventListener('pointercancel', cancelLp);""",
"""    b.addEventListener('pointercancel', () => { if (lpMoved) cancelLp(); });""",
    'pointercancel-conditional')

# ---- version ----
rep('font-weight:400;">2.29</span>', 'font-weight:400;">2.30</span>', 'version')

io.open(P, 'w', encoding='utf-8', newline='').write(s)
print('patches applied:', n)
