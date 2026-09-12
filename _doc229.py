# -*- coding: utf-8 -*-
import io

P = 'CURRENT_STATE.md'
s = io.open(P, encoding='utf-8').read()

old = "- Version at time of writing: **2.28**"
assert s.count(old) == 1
s = s.replace(old, "- Version at time of writing: **2.29**")

anchor = "## UV exists, as an optional channel (v2.28)"
assert s.count(anchor) == 1

NEW = u"""## The material library merges instead of growing (v2.29)

Two complaints, two unrelated diseases. Both were in the library, and the
texture-channel work was deliberately held until they were out.

### Every opened mesh multiplied the stack

A material is identified by `materialDefSig(d)` - a stable stringify of
`{name, color, roughness, metalness, bevel, masks}` - and the match had to be
EXACT. Any small difference missed: a colour one 8-bit step out after the
sRGB -> linear -> sRGB round trip, 0.52 roughness against the 0.5 that was
typed, a tweak made by hand after the first import. A miss left one branch,
MINT, so the tray filled with "Skin (imported)", then "Skin (imported 2)".
One more entry per open, and nothing ever merged back.

**The name is now the identity, on the IMPORT path only.** A `byName` index
(lowercased name -> id) is seeded from the library when
`importMaterialContext()` is built. On a signature miss the same name reuses
that entry and THE LOCAL DEFINITION WINS - a material someone has tuned must
not be repainted by whatever a file happens to carry.

Four rules earn their keep, and three of them exist because something real
broke without them:

- **A source that stated no name mints its own entry.** `raw` falls back to
  "Imported", so merging on it would collapse every unnamed material in a
  file onto one and throw their colours away. That is the opposite of a
  merge.
- **PRESETS ARE NOT MERGE TARGETS.** Solid, Plastic and Metal carry
  `color: null`, meaning "whatever the theme's grey is now". Merging a GOLD
  material named "Metal" onto the Metal preset would repaint it grey and make
  it follow the theme for ever - and "Metal" is one of the commonest names in
  a downloaded asset. The only road onto a preset is still the themed-preset
  shortcut, bounded by `nearHex` and a roughness tolerance. `_imp_probe`'s
  `11.rename_on_collision` has asserted exactly this since a2.69; the first
  cut of v2.29 would have broken it.
- **A mint does not become a merge target inside its own import.** `byName` is
  seeded once and never grows; a separate `taken` Set feeds the rename loop.
  So two materials in ONE file that share a name stay two materials with
  their two colours, while the same name arriving from a LATER file merges
  onto what this one left behind.
- **The key is the FULL name, and a minted entry remembers it as `srcName`.**
  The stored name is sliced to 32 characters, so an entry minted from
  `Metal_Rough_Scratched_Variant_01_Red` is called
  `Metal_Rough_Scratched_Variant_01` - keying on the slice merges it with
  `..._Blue` and kills a colour, while keying on the full name could never
  find it again. `srcName` does for the name what `srcSig` does for the look.

**`restoreDoc`'s harvest does NOT merge by name, and that is deliberate.**
`serializeDoc` writes the WHOLE library into `doc.materialLib`, presets
included, under their fixed names - so a name key made a file's modified
Metal always find the local Metal, `known === d.id`, and the file's
definition was silently discarded. That is the bug the comment a dozen lines
above the harvest already describes ("Add scratches to Metal, save, open the
file anywhere else, and the model arrived wearing plain Metal"). A project
file's own definitions ARE the document; merging by name belongs to import,
where the incoming material has no history here.

What the harvest DID get is the order. The signature lookup now runs BEFORE
the "we have never seen this id" branch, where it used to run after - so a
file carrying its own id for a look the library already holds points at ours
instead of settling in beside it. Safe in a way the name is not: equal
signatures mean equal looks, so nothing is lost.

### One material could be neither deleted nor edited

Different cause entirely. `getMaterialDef(id)` returns
`MATERIALS.get(id) || MATERIALS.get('standard')`. Every DRAWING path wants
that fallback - a face still wearing a deleted finish has to be painted with
something. The EDITOR did not.

A tray card captures its id in a closure when `buildMatTray()` runs, and an
import or an undo remaps and drops ids underneath an open tray -
`restoreDoc` only nulls `_matPreviews`, it does not rebuild. Opening such a
card handed back the Solid PRESET under the dead card's name: the header read
"Solid (preset)", the Delete button hid itself because presets cannot be
deleted, Reset restored Solid, and all eleven controls quietly edited Solid.
From the outside: a material that has moved in and cannot be touched.

Four parts, and they are independent:

- **`liveMaterialDef(id)`** is the strict lookup, returning null. Used by
  `openMatEditor`, `meApplyLive`, `meReset`, `meDelete`. `getMaterialDef`
  keeps the fallback for everything that draws.
- **`matTrayStale()` + a rebuild inside `refreshMatTray()`.** The cards must
  BE the library; if they are not, rebuild. Only while `matTrayIsOpen()` -
  which is `open && !closing`, because `setMatTrayOpen(false)` leaves `open`
  on for one 240ms transition and reading the class by hand made every
  selection tap pay for a `renderMatPreviews()`. O(cards) beats having to
  remember to rebuild at every site that touches MATERIALS, which is the
  thing that was forgotten.
- **`isPresetDef(d)`** = `d.preset && presetDefaults(d.id)`, replacing the raw
  flag at the three points that decide a button's fate. `presetDefaults` uses
  `hasOwnProperty`, not a bare index: `MATERIAL_DEFAULTS` is a plain object
  literal, so `MATERIAL_DEFAULTS['constructor']` is truthy and a materialLib
  entry with `"id": "constructor"` was adopted with `preset: true` - becoming
  precisely the untouchable material this predicate exists to kill.
- **The refusals speak.** `meDelete` on a preset and `meReset` on a custom
  both used to `return` silently; `Object.assign(d, undefined)` did nothing
  while still toasting "Reset to default". A button that does nothing reads
  as a broken app. `saveMaterialLibrary` also read `MATERIAL_DEFAULTS[d.id].color`
  OUTSIDE its own try, so one flagged-preset entry with no default would
  throw and take the library's whole persistence with it.

### What this cost to get right

The first cut shipped none of this correctly. My own probe caught two
(`restoreDoc` adopting a foreign id before it ever asked the library;
`matTrayStale` reading a closing shelf as open). A reviewer agent with no
stake in the code then found SEVEN more, three of them design-level: the
name key on the restore path silently discarding a saved file's looks, the
import merge having no look check at all so gold "Metal" became grey, and
prototype keys satisfying the preset test. A first attempt at a heal in
`loadMaterialLibrary` turned out to be unreachable dead code - the
broken-build run proved it by changing nothing any check could see - and was
replaced by the derived predicate.

**`_matchk.js` / `_matchk.py`** (port 8902), 46 checks in three groups:
merge-by-name and every rule that bounds it, the restore path, and the
editor. Verified against **14** deliberately broken builds
(`_mkmatbroken.py`, driven by `_matbrokenrun.py`) - merge, unnamed,
presettarget, samefile, slice, namekey, harvest, protokey, strict, tray,
trayopen, save, heal, mute - each of which must fail the specific checks it
breaks. All 14 caught. The full 35-probe suite is green and 34 of its 35
outputs are byte-identical to v2.28's.

"""

s = s.replace(anchor, NEW + anchor)
io.open(P, 'w', encoding='utf-8', newline='').write(s)
print('CURRENT_STATE.md updated, %d lines' % len(s.split('\n')))
