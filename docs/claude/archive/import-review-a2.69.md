⛔ АРХИВ — УСТАРЕВШАЯ ПОЛИТИКА. Утверждение «в этом приложении вообще нет UV» мертво с v2.28; карты (normal/AO/emissive/opacity) приезжают с v2.33. Перечисленное здесь как «специально не поддерживается» — незаконченная работа, а не запрет.

# a2.69 review — imported glTF materials. Reviewed, fixed, SHIPPED.

Live at https://zeghreit.github.io/kubik/ (`a2.69`, commit `18629b3`).

A fresh opus reviewer with no knowledge of the code was given the three
patch scripts and the regions they touch. It found **four defects, all
real**, one of which was a live bug older than this increment. All four are
fixed and covered by new probe sections.

## What shipped

glTF's core PBR numbers map onto the three the library already stores:
`baseColorFactor` → colour, `metallicFactor` → metalness, `roughnessFactor`
→ roughness. Nothing else is mapped, on purpose — textures (no UVs in this
app at all), emissive, opacity, normal/AO maps, every KHR extension. A
textured material lands on its base colour.

Each merged face group carries the key of the source material it came from;
`importMaterialContext()` turns each source material into a library id,
deduped by `materialDefSig` against the whole library and capped at 64
minted entries per import. `applyFinish` stamps the group's material
**before** `rebuildFromEditable`, because `reconcileFinishes` derives
`userData.finishes` from that stamp.

Exports now write each material's name, so a .glb opened in Blender is no
longer six copies of `Material.001` — and, since a2.69 reads the name back
as part of what a material *is*, that name is what makes a Kubik round trip
land on the entries it left as.

## The four

### 1. The one-key index — a live bug, not introduced here

Both `restoreDoc` and the new importer built their lookup as

```js
bySig.set(v.srcSig || materialDefSig(v), id);     // WRONG
```

A material minted by an import is RENAMED on a collision and stores
`srcSig` — the signature of what it came FROM. Under `||` it was therefore
findable **only** by that, never by what it now IS. So saving a file that
held one and opening it again missed, minted `"Gold (imported) (imported)"`,
and repointed every face that wore it — then one level deeper on the next
open, for ever.

Live since a2.65a. **a2.69 is what made it routine**, because `idFor` now
renames on a plain *name* collision, where only an *id* collision used to
produce a renamed entry. Both sites now index both keys, first writer wins.

### 2. The themed-preset shortcut ran before the library was asked

The presets carry `color: null` and follow the theme; a .glb records the
grey that was on screen, so an incoming colour that IS the current default
grey with a preset's roughness/metalness is taken to be that preset. Correct
— but it sat above the signature lookup, so a material somebody mixed by
hand to exactly that grey, named it, exported and re-imported, was answered
"that is Solid" and lost its name, with its exact signature sitting in the
index one line below. Moved down.

### 3. A non-string material name threw mid-import

`GLTFLoader` assigns `materialDef.name` straight from JSON with no coercion,
so `"name": 123` gave a number and `.trim is not a function` threw **inside
the object loop** — after `createCubeObject` had put a half-built object in
the scene and before `rebuildFromEditable` could give it matching geometry.
The catch upstairs then toasted "Could not read that file" over a broken
scene with no history entry, which the autosave wrote out. `String()`.

### 4. A NaN base colour would have been persisted

`baseColorFactor: ["a","b","c"]` makes a `Color` with NaN channels, and
`getHexString()` returns `"000NaN"`. Nothing crashes on it; it simply goes
into the library, into localStorage and into every saved file. Rejected with
a `/^#[0-9a-f]{6}$/` test before minting.

Also taken: an out-of-range `materialIndex` now resolves to *no* material
rather than a neighbouring one; migrated `srcSig` strings are saved even
when an import mints nothing; an open material tray repaints after an
import.

## Probe

`_imp_probe` grew sections 9–13 (24 suites total, unchanged count — the
suite grew, not the list). The round-trip section 9 sits **before** section
3, because section 3 extrudes and therefore grows the material array.

```
9.no_duplicates_minted=a Kubik file re-imported into Kubik minted nothing
9.custom_reunited=the painted face came back on the SAME library entry
9.presets_stay_themed=the other 5 faces came back on Solid, still following the theme
10.pbr_mapped=baseColour, roughness and metalness all landed (Gold #d4af37 r0.3 m1)
10.float32_tolerated=and so does the float32 a real file actually stores
10.budget_holds=past the cap of 64 the rest land on Solid (63 minted, 27 refused)
11.reopen_finds_it=opening the same file again reuses it - one entry, not two
11.exported_name_finds_it=and so does a .glb carrying its renamed display name
12.named_grey_kept=a hand-mixed material that IS the theme grey keeps its own identity
12.nameless_grey_is_solid=while a nameless one still lands on Solid and follows the theme
13.numeric_name_survives=a numeric material name imported without throwing
13.nan_colour_refused=a NaN baseColour lands on Solid rather than persisting "#000NaN"
```

`_cmp.py _a268d _a269f` → 23 files byte-identical, only `_imp_out.txt` and
`_run.txt` differ.

## Harness fix worth remembering

`_imp_probe` fetches `GLTFExporter` from the CDN and lost that race in
roughly every batch run while passing every time it was run alone. It writes
its own `NO PROBE OUTPUT` file, so `_runprobes.py` saw a file, reported
`ok 16 bytes`, and **the run looked green**. `_runprobes.py` now retries once
on that marker and reports `NO PROBE OUTPUT (twice)` if it fails again.

*A probe that reports its own failure as a file is a probe the harness
cannot distinguish from a pass.*

## Lesson

Two of the four were in code the reviewer was asked to check *against its own
precedent* — and the precedent itself was the bug. Mirroring an established
pattern faithfully is not the same as the pattern being right; a2.65a's own
comment claims to have closed exactly the failure mode `||` was still
causing.
