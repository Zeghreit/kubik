# -*- coding: utf-8 -*-
import io

P = 'CURRENT_STATE.md'
s = io.open(P, encoding='utf-8').read()

old = "- Version at time of writing: **2.29**"
assert s.count(old) == 1, 'version line %d' % s.count(old)
s = s.replace(old, "- Version at time of writing: **2.30**")

anchor = "## The material library merges instead of growing (v2.29)"
assert s.count(anchor) == 1

NEW = u"""## A preset is never a copy of itself (v2.30)

v2.29 fixed the wrong path. It merged by name on IMPORT (glTF/OBJ), while the
duplicates being reported arrive on PROJECT OPEN - the one path v2.29
deliberately left alone on review advice. The reviewer was right about his
case and did not know about this one. Three versions were spent diagnosing
this from code and desktop logic; what actually settled it was the user's own
project file and three screenshots from his phone. **Ask for the artefact
first.**

### The duplication

`Kubik_NeoTank.json`, straight from the user:

```
standard  color="#858585"   ← MATERIAL_DEFAULTS says null
plastic   color="#999999"   ← and here too
metal     color=null        ← matches, which is why it never doubled
```

`color: null` on a preset means "whatever the theme's grey is now". A frozen
grey misses `materialDefSig`, the id is already taken, and the only branch
left in `restoreDoc`'s harvest was to MINT - so every open of that file added
`Solid (imported)` and `Plastic (imported)` to the shelf. Both were visible in
the user's screenshots, mid-list.

**Measured on that file: library 3 entries in -> 9 out. Now 3 -> 7**, which is
exactly the four real materials it carries.

**A preset id resolves to that preset and never mints.** standard, plastic and
metal belong to the app, not to any document: there is one Solid, and a card
called "Solid (imported)" is incoherent by construction. A file whose preset
genuinely differs - someone's Metal with scratches, the case the minting
branch was built for - gets one toast (`... differ in this file - kept yours`)
rather than a second card that accumulates for ever.

### The upstream half

`meApplyLive` did `d.color = meColor.value` unconditionally, so moving ANY
slider while a preset was open froze its colour. The preset stopped following
the theme, `saveMaterialLibrary` wrote a presetOverride, `serializeDoc` put the
frozen grey into every saved file, and every later open of that file minted a
copy. That is how `#858585` got into the document in the first place. The
colour is now written only when the picker itself has moved (compared against
the value the editor opened with); for a material that already has a colour
nothing changes.

### And on a phone there was nothing to tap

Separate disease, and the one that made a card "impossible to delete or edit".
`.mat-card.active .mat-edit { display: block }` - **the pencil existed only on
the card the selection was already wearing.** For every other card the only way
into the editor was a 500ms hold, and v2.3b cancels a hold on any
`pointercancel` - which iOS fires for a *stationary* press once the scroller
decides it might own the gesture. On a shelf this long, on the device the user
actually tests on, most cards could not be opened at all.

- the pencil is on every card now, quiet (`--panel2`/`--text-dim`) everywhere
  except the applied one, so a2.101's single red mark survives;
- `.mat-edit::after { inset: -6px }` - the hit area reaches past the glyph,
  because a finger is bigger than 20px;
- the hold aborts on MOVEMENT (> 8px), the rule the outliner hold and a2.94's
  pickup already use; `pointercancel` only cancels if the finger moved. A flick
  moves, so v2.3b's bug does not come back.

### CLEAN

A library only ever grew: every file opened brought its materials, nothing
removed one again, and before this version presets minted copies of
themselves. The user's shelf was thirty cards long. A `CLEAN` card sits beside
the `+` and removes everything NOTHING in the scene wears - never a preset, so
the picture cannot change - and says how many went.

Two things make it safe to press. `worn` is gathered from `App.history` as
well as the scene, because undoing a delete does not re-adopt a material
(`keepAppearance`): without that, cleaning after deleting the only object in a
material and then pressing undo brought the object back on Solid with its
masks gone and no way back. And `serializeDoc` now writes only the materials
the document actually uses plus the three presets - it used to write the whole
library, so the next open handed back everything CLEAN had just removed.

### Probe

`_matchk` is ~70 checks now; group 4 runs the user's real `materialLib`
(`_neolib.json`, driven by `_neochk` on port 8904 for the standalone 3 -> 7
measurement). Verified against **24** deliberately broken builds; all 24
caught. Two of the new checks failed first on the probe's own bugs - a
`resetLib` that could not restore a preset it had deleted, and a
`userData.finishes` written by hand that the object immediately overwrote.
Both now go through the real API.

"""

s = s.replace(anchor, NEW + anchor)
io.open(P, 'w', encoding='utf-8', newline='').write(s)
print('CURRENT_STATE.md updated')
