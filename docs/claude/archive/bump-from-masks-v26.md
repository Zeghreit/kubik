⛔ АРХИВ — ЧТЕНИЕ КАК ЕСТЬ ЛОМАЕТ КОД. Два мёртвых утверждения: (1) «политика без-UV остаётся нетронутой» — мертво с v2.28; (2) «ничто в приложении не привязывает normalMap; в тот день, когда привяжет, вот эта строка» — этот день наступил в v2.33 и был отвечен в v2.34: `kubikTurn` ПОВОРАЧИВАЕТ то, что произвёл `<normal_fragment_maps>`, а не заменяет его.

# Normals from the masks (v2.6, signed in v2.7)

Shipped and live. A third checkbox beside Colour and Roughness in the mask
editor, with a depth slider of its own. Every noise type already built —
Clouds, Cells, Scratches, Dots, Stripes, your own pictures, Cavity and
Edges — is now also a bump. Triplanar like everything else, so the no-UV
policy survives untouched.

**Edges + Bump** is the combination to reach for: a raised welt along every
convex rim, which is a chamfer you can put on and take off without touching
the geometry.

## The depth is signed (v2.7)

Left of the middle **carves** the mask into the surface, right of it stands
it out, zero is flat — one continuous sweep, not two ranges with a hole
between them. The control renames itself **Carve** at the crossing, which is
the only thing on screen that says the slider has a left half.

An invert switch was the obvious alternative and the more expensive one: it
would have been a *second* key on every mask, and another chance for
absent-versus-false to make a material stop matching itself across a file.
The sign rides on the number that is already stored.

## The data design: the key's existence is the switch

There is no `bumpOn` field and no `invert` field. `mk.bump` is **present**
when the box is ticked and **deleted** when it is cleared, and
`maskBumped(mk)` — "is the key there" — is the single predicate that reads
it, in all six places that used to ask `mk.bump > 0`.

Two things follow:

- A **zero depth is a live mask parked flat**, not an absent one. That is
  what lets the slider cross over: if zero meant off, dragging from carve to
  bump would switch the mask off and on again in the middle, recompiling on
  the way past.
- A mask nobody has given a bump to serialises **byte for byte** the way it
  did in v2.5. `materialDefSig` stringifies the mask objects themselves, so a
  mask carrying `bumpOn: false` and an otherwise identical one carrying no
  such key are two different materials to the import matcher — the
  absent-versus-zero trap that once minted an "(imported)" copy of every
  masked preset on every single load. The probe asserts it.

**Anything added to a mask later has to follow the same rule** — or normalise
the whole mask inside the signature and migrate every stored one, which is
the structural fix and a much bigger change.

The depth slider is `disabled` while the box is clear, not merely dimmed —
the only component slider that is, for the same reason: there is nowhere to
put the number until the key exists.

## The maths

Mikkelsen's surface gradient. The two screen-space derivatives of the
**object-space** position span the tangent plane at a pixel; the same two
derivatives of the accumulated height say how fast it climbs along each. That
is the whole trick, and it is why this was cheap: no UVs, no tangents, so it
works on a shape mask exactly as readily as on a cloth one.

```glsl
vec3 kubikBumpN(vec3 p, vec3 n, float dHx, float dHy) {
  vec3 sx = dFdx(p), sy = dFdy(p);
  vec3 R1 = cross(sy, n), R2 = cross(n, sx);
  float det = dot(sx, R1);
  if (abs(det) < 1e-20) return n;
  vec3 grad = sign(det) * (dHx * R1 + dHy * R2);
  return normalize(abs(det) * n - grad);
}
```

**The sigmas are deliberately not normalised.** three's own
`perturbNormalArb` normalises them, which makes `dH` shrink with the pixel
footprint while nothing shrinks with it — so the texture fades out as you
lean in. Left raw, `dH` and `R1`/`R2` each carry one power of the footprint
and `det` carries two: the ratio is scale free.

**Faded on minification only, by the square of the footprint.** Nothing
shrinks the height as the camera pulls back either, so a mask whose texels
fall under a pixel would keep full amplitude and crawl. A cloth mask is 128
texels across its period, so one texel is `2/(128*scale)` object units, and
the height is multiplied by `clamp(texel/footprint, 0, 1)` **squared**. The
exponent is the behaviour: linear leaves the *slope* constant once a texel
drops under a pixel — amplitude falls exactly as fast as frequency rises — so
a mask ten times too fine came back neither steeper nor quieter, just
permanently noisy. Squared, it flattens the way a mipmapped surface does.
Leaning in saturates the clamp at 1, so close up nothing is taken away.

Height is a real length: `depth * 0.15` object units, so depth 1 is 15% of a
default cube. It has to be, because the gradient is compared against a real
pixel footprint — and it means a fine mask is steeper than a coarse one at
the same depth, which is what fine and deep actually looks like.

## Two bugs it flushed out, one of them old

**Every cloth bump reached the shader through an identity normal matrix.**
`uKubikNrmMat` — the uniform that carries a bent normal into view space — is
maintained in `onBeforeRender`, and `onBeforeRender` was hung on
`defWantsField`, because until now the only thing that bent a normal was
Round edges, which needs the distance field anyway. A Clouds mask driving
Bump needs no field, so it got no hook, so it kept the identity matrix packed
at compile time: an object-space normal used as a view-space one, lit from a
fixed direction in the model's own frame, unchanged by the camera **and
unchanged by the depth slider**. It looked convincingly like stone.
`defWantsBump` is now the second question and the hook answers to either.

Found by a check that had no business failing: render at a depth of 0.01 — a
fiftieth of the reference — which should be indistinguishable from no bump,
and the spread came back identical to depth 0.5. That check is in the probe,
named for the bug.

**And `object.normalMatrix` was one render stale.** three calls
`onBeforeRender` from `renderObject` *before* it sets `modelViewMatrix` and
`normalMatrix` for that draw, so `copy(object.normalMatrix)` took the matrix
from the previous frame. Round edges has been shading itself with a
one-frame-old camera since the day it was written — invisible in motion,
which is exactly why it survived. Computed from `camera.matrixWorldInverse *
object.matrixWorld` now, which is what three is about to compute anyway.

## Measured

`_bumpchk.py` — 31 checks, real clock, POSTs its report back and **writes its
pictures out**, which is the lesson every shader round in this project has
had to relearn. Shown to fail against two broken copies:

- `_bak_v25.html`: no control, no function — 3 of 3 fail.
- `_bak_v26pre.html`, built by `_mkbroken26.py` with the normal-matrix hook
  and the footprint fade undone: the depth check and the fine-mask check
  fail, and each names its own bug.

The v2.7 checks drive the **real slider** rather than writing the field, and
assert that carving carries *as much* texture as the ridge rather than less —
it is the same height field with the sign flipped, not a weaker bump.

Full suite after each release: **35 of 35 files identical** to the `_det2`
baseline.

## Known, and left

- **A shape mask's bump does not show in the tray thumbnail.** The preview
  ball binds a 1×1 black field so a thumbnail can show what a shape mask
  does; a constant field has a zero gradient, so there is nothing to bend.
  Cloth bumps preview correctly.
- **Round edges makes a bump slightly deeper along a rim** — `det` carries
  the cosine of the lean, up to about 1.4× on a full bevel crest. That is the
  surface genuinely being steeper there.
- **This block now owns the normal outright.** It starts from the vertex
  normal, so anything `<normal_fragment_maps>` produces is discarded. Nothing
  in the app binds a normalMap; the day something does, that is the line.
- `mkStructural` re-bakes the 128² cloth on a component tick, which changes
  no cloth. Pre-existing, shared with Colour and Roughness, one cheap win.
