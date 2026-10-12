# One material per definition (v2.8)

Shipped and live. Every face group used to carry its own
`MeshStandardMaterial` — 1536 of them on a twice-subdivided cube, six
definitions between the lot. They are pooled now.

**Measured:** 640 material clones per apply → **0**. A 22-group mesh wearing
two definitions holds **two** material instances (`_bak_v27.html`: 22).

## The key

`definition id | side | owner`.

- **Definition** — everything that can make two materials differ lives there
  already: colour, roughness, metalness, the mask stack, the bevel.
- **Side** — a mirrored object has reversed winding and must stay
  `DoubleSide` while everything else culls, and the x-ray toggle flips it.
  Part of the key rather than something written onto a shared instance.
- **Owner** — empty for most definitions. See "the one the reviewer found".

## The ops did not have to learn anything

All thirty still clone the material of the face their new faces grew from,
and that clone is still what says which definition the new group wears. It is
read by `reconcileFinishes` — the one function that sees the finished group
list and the finished material array together, which is why it already
derived `finishes` — and then dropped. **Pooling happens at the end of that
one function**, which `rebuildFromEditable` calls and every op funnels
through. Not one op site was touched.

Objects that are *created* rather than edited — a new cube, a primitive, an
import, a clone, a document being loaded — are dressed late, by a healer at
the top of `ensureMaskPatches` gated on `userData.matSide === undefined`.
**Late on purpose:** `restoreDoc` builds materials from a file's stored
surface values and `harvestLegacyMaterials` is what mints definitions for
those, so dressing during a load would replace a file's look with a
definition that had not been written yet.

## A pooled material cannot be disposed

A dozen places dispose a material array — object delete, primitive swap, the
op bin, an import's throwaway cube. Rather than teach all twelve, the pooled
instance's own `dispose` is replaced with a no-op and the real one kept as
`__dispose`, which `prunePool` uses. Blunt, one line, and impossible for the
next op somebody writes to forget.

`prunePool` retires entries two ways: a definition deleted, and an object
deleted (which retires only the instances that were its own).

## THE RULE: a pooled material IS its definition

It may never be re-dressed as another one. **`applyFinish` refuses** — a
guard, not a comment, because every bug this release produced was old code
doing the obviously right thing for a material it thought it owned:

- `applyFinishToSelection` calling `applyFinish` on the material at a group.
- `reconcileFinishes` dressing the material it had just read the stamp off.
- its deleted-definition branch restamping one to read the stamp back.

All three write the **finishes map** and re-dress from the pool now.

**The suite caught all three in a single run**, each with a different
symptom of the same cause: an Array's copies painting together (`_array`), a
repaint under an open op spreading from one face to six (`_bug`), Solidify's
walls all inheriting one colour (`_solid`), and an exported cube coming back
with no preset faces left on it (`_imp`). That is what 35 byte-compared probe
outputs are for.

## And the one only a reviewer would have found

`applyMaskPatch` hangs an `onBeforeRender` on a material to fill per-**mesh**
uniforms — the object's distance field, its normal matrix. three calls that
hook once per drawn object, so sharing looks safe. It is not: three uploads a
material's custom uniforms only when `refreshMaterial` is set in
`setProgram`, and that is skipped when the material is the same as the last
draw — which, since the opaque sort puts same-material draws next to each
other, is exactly the second object. Two objects wearing one shape-masked
definition: the second would have rendered with the **first object's field**.
Wear and rounded edges taken from the wrong shape, on every multi-object
scene — the tank above all.

So **a definition that hangs that hook gets one instance per object**, by the
same test `applyMaskPatch` uses to decide whether to hang it
(`defNeedsOwn = defWantsField || defWantsBump`), so the two cannot drift. It
is still the whole win — a subdivided cube goes from 1536 materials to one —
and every definition with no per-object state stays shared across the scene.

## Measured

- `_poolchk.py` — 25 checks, real clock. Verified against `_bak_v27.html`,
  where 10 of them fail.
- The suite: 33 of 35 byte-identical to `_det2`. `_perf`'s `material_churn`
  reads 0 instead of 640; `_array`'s section 8 was rewritten — it asserted
  two copies held different material *objects*, which the pool breaks by
  design, and now asserts the consequence that still has to hold, that
  painting one copy paints only that copy.

## A probe is code too, and a broken one is SILENT (v2.8a)

Three traps cost most of an afternoon, and all three look identical from
outside — "NO OUTPUT", which reads exactly like a build that will not load:

1. **A syntax error in the probe's own JS.** One stray `\'` inside a
   single-quoted string ended it early; the appended `<script>` never parsed,
   so not one line ran — not even the watchdog. **Run `node --check` on the
   probe file.** `_verify.py` only looks at index.html.
2. **`start "" /b` swallowed the run.** Foreground it and wait.
3. **Waiting for `load` never fires if the module graph stalls.** The probe
   starts on a plain three-second timer now; if the app is not up, `__kubik`
   is undefined and the report *says so*, which is a fact. Silence is not.

The fix that ends the class: **a running mark**. `_poolchk` POSTs its lines
so far to `/mark` after every section, and the runner prints the last mark
when no report arrives — so a stall names the section it stalled in. Copy
that into any new probe that does real work.
