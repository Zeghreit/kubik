# How other software does edge wear and cavity dirt

Researched 2026-08-27, from vendor documentation rather than memory. Written
after Kubik went through five architectures for the same feature. The short
version: **every render-time technique in every major package fails on a
flat-shaded low-poly cube**, for exactly the reasons Kubik hit, and the
industry's answer is either to change the geometry or to sample within a
RADIUS — which is what Kubik's a2.28 distance field does.

---

## 1. The taxonomy

Four mechanisms, and everything is one of them.

| Mechanism | Evaluated | Examples |
|---|---|---|
| Per-vertex attribute, interpolated | CPU, once | Blender **Pointiness**, Houdini `measure` SOP, Blender **Dirty Vertex Colors** |
| Ray-traced accessibility at the shading point | per-pixel, at render | Blender **Bevel** and **AO** nodes, Houdini **Karma Curvature** (`Samples` = probe rays), Redshift **Round Corners**, Marmoset **Bevel** |
| Screen-space derivative of the normal | per-pixel (2×2 quad) | `ddx/ddy`, Houdini **Curvature VOP**, UE material functions |
| Volumetric signed distance field | per-pixel sample of a 3D texture | UE **Mesh Distance Fields** |

The ancestor of the second row is Miller, *Efficient Algorithms for Local and
Global Accessibility Shading*, SIGGRAPH 1994 — a spherical probe rolled over
the surface, producing "the patina on certain tarnished surfaces which have
then been cleaned". Blender's Bevel node is literally that rolling sphere.

## 2. Everything fails on an unbevelled low-poly cube

This is the finding that matters, and it is not a Kubik problem.

- **Substance's curvature bake is a derivative of the normal field.** A hard
  cube has six constant normals and an infinitely thin discontinuity that
  lies exactly on a UV seam. Polycount, on hard-edged low-poly with no bevel:
  *"literally 0 curvature data."* Marmoset's docs state the principle: the
  baker *"only sees changes in direction, not depth."*
- **Blender's Pointiness** is a per-vertex attribute computed at scene sync
  from vertex normals and adjacency, then interpolated like a vertex colour.
  A cube has eight topologically identical vertices, so every one gets the
  same number. This is Kubik's architecture 1, exactly, including the
  symptom: tutorials universally hang a Map Range off it because the raw
  values cluster in a band a few hundredths wide around 0.5.
- **`ddx/ddy` of the normal** is zero inside a flat-shaded face by
  construction. Houdini's own Curvature VOP docs say it: *"derivatives for
  polygonal meshes are not continuous, which results in a 'faceted' look."*
  Mark Serena's UE screen-space curvature function ships with the caveat
  *"The normals are interpolated linearly so the faceting can't be fixed."*
  It is also screen-resolution dependent, so the band swims as you move —
  fine for a shading term, fatal for a texturing signal.

**Kubik's first four architectures each rediscovered one of these.** That is
worth knowing: they were not careless, they were the standard approaches,
and the standard approaches genuinely do not work on this geometry.

## 3. What does work: sample within a RADIUS

The only Substance path that produces a wide band on unbevelled geometry is
the ray-traced **Curvature from Mesh** baker, whose key parameter is
**Sampling Radius** — *"how far the baker considers nearby geometry; higher
gives stronger/wider edge definition, lower gives thinner edges"*, with
**Relative To Bounding Box** to make it scale-independent.

That is conceptually the same move as Kubik's a2.28 distance field: stop
differentiating a normal field and start measuring distance to geometry
within a radius. Kubik's `range` (15% of the object's largest dimension) and
Width-as-a-fraction-of-range are the same idea as Sampling Radius plus
Relative To Bounding Box.

**Distance-to-EDGE fields specifically appear to have no published prior
art.** UE's Mesh Distance Fields are distance-to-*surface* (fp16, ~50³ per
mesh, 128³ cap) and are used for AO, shadows, Lumen and particle collision —
never for wear, and the material nodes read the coarse *global* field. The
weathering literature (Chen et al. γ-ton tracing 2005; Mérillou &
Ghazanfarpour survey 2008) attacks it as transport and accessibility, not
distance. So a2.28 is unusual, but it is a principled answer to a case the
standard tools genuinely cannot serve.

## 4. The parameter set — Kubik got most of this right by accident

Substance's generators, verbatim:

- **Edge Select**: global **Level**, **Contrast**, then symmetric convex and
  concave branches each with **Edges Width**, **Softness**, **Intensity**.
- **Metal Edge Wear**: **Wear Level**, **Wear Contrast**, **Edges
  Smoothness** ("falloff from edges"), **Grunge Amount** ("blend between
  edges"), **Grunge Scale**, **Ambient Occlusion Masking**, **Curvature
  Weight**.
- **Dirt** (the cavity counterpart): **Dirt Level**, **Dirt Contrast**,
  **Grunge Amount**, **Edges Masking** ("removes dirt from raised edges").
- **Mask Builder**, curvature section: **Convex Range**, **Convex
  Contrast**, **Concave Range**, **Concave Contrast**, **Smoothness**,
  **Level Boost**, **Noisiness**, **Noise Scale**, **Noise Type** (Spots /
  Cloud / Moisture / White Noise).

The pipeline every one of them implies, in slider order:

```
signal -> perturb with noise -> soft threshold (Level + Contrast)
       -> widen/soften (Width, Smoothness) -> multiply by an AO term
       -> global Level / Contrast / Invert
```

Kubik's **Width / Blur / Noise** maps onto Edges Width / Softness /
Noisiness. The soft threshold is `smoothstep(w*(1-blur), w, d)`, which is
Substance's **Histogram Scan** (*Position* shifts the midpoint, *Contrast*
sets the hardness of the transition) by another name.

## 5. The three things Kubik is missing

**A. Cross-masking. Every generator has it and Kubik has none.** Metal Edge
Wear has **Ambient Occlusion Masking**; Dirt has **Edges Masking** —
"removes dirt from raised edges". Wear does not collect in crevices and dirt
does not sit on exposed corners. Kubik already holds BOTH signals in the
same texture (red = distance to convex edges, green = to concave), so this
is one slider and two lines of shader: suppress Edges where the concave
distance is small, and vice versa.

**B. The noise should WARP the lookup, not offset the distance.** Designer's
canonical tool for making a clean mask boundary ragged is **Slope Blur**
(*Samples*, *Intensity*, *Mode: Blur / Min / Max*, where Min erodes and Max
dilates) or **Warp**, both driven by a noise. Kubik adds noise to the
distance, which ruffles the rim; warping the sample position instead gives
chipped, flake-shaped bites, which is what worn paint actually looks like.
Also: **Noise Scale is a separate slider from Noisiness** everywhere, and
Kubik ties the scale to the width.

**C. The bevel shader — the biggest visual win, and the industry's actual
answer for hard-surface.** Blender **Bevel** (`Radius`, `Samples`), Marmoset
**Bevel** (**Bevel Width**, **Bevel Angle**, **Bevel Samples**), Redshift
**Round Corners** (**Radius**, **Num samples**). All of them perturb the
shading normal within a radius of a hard edge without adding geometry.
Blender's release notes: *"Slight rounding on edges helps to capture
specular highlights that you would also see in the real world."* Marmoset
markets that their bevel also feeds the AO and Curvature bakes, "eliminating
the need for separate generation tools", and lets you "eliminate the
time-consuming process of adding edge loops".

All three implementations pay for ray probes — Blender warns the Bevel node
*"may slow down renders by 20%"*. **Kubik would not: the gradient of the
distance field IS the bevel normal**, available from three extra taps. That
is a rounded-edge look, a specular catch along every edge, and a real
curvature signal, on a mesh with no bevel geometry at all — which is exactly
the case every package tells you to solve by changing the model.

## 6. Where the industry is heading

SideFX appears to be deprecating render-time curvature: a forum post quotes
*"Karma Curvature is no longer supported, please pre-compute a primvar and
import. (Since version 21.0.)"* — not visible on the docs page, so treat as
unconfirmed. Their shipped recipe is SOP-side `measure` or Labs Measure
Curvature → **`attribblur`** → remap → write to a point attribute → read as
a primvar. Labs' node has **Blur Amount** and **Remap Range** built in;
Blender's Dirty Vertex Colors has **Blur Strength** and **Blur Iterations**.

Everyone blurs the raw signal. Kubik's field is smooth by construction, so
that step is already paid for.

---

## Sources

Adobe Substance 3D bakers — [Curvature](https://experienceleague.adobe.com/en/docs/substance-3d/bakers/bakers-settings/curvature),
[Curvature from Mesh](https://experienceleague.adobe.com/en/docs/substance-3d/bakers/bakers-settings/curvature-from-mesh),
[sbsbaker CLI](https://helpx.adobe.com/substance-3d-sat/command-line-tools/sbsbaker/sbsbaker-command-line-options.html).
Substance 3D Designer — [Metal Edge Wear](https://experienceleague.adobe.com/en/docs/substance-3d-designer/using/substance-graphs/nodes-reference-for-substance-graphs/node-library/mesh-based-generators/mask-generators/metal-edge-wear),
[Edge Select](https://experienceleague.adobe.com/en/docs/substance-3d-designer/using/substance-graphs/nodes-reference-for-substance-graphs/node-library/mesh-based-generators/mask-generators/edge-select),
[Dirt](https://experienceleague.adobe.com/en/docs/substance-3d-designer/using/substance-graphs/nodes-reference-for-substance-graphs/node-library/mesh-based-generators/mask-generators/dirt),
[Mask Builder](https://experienceleague.adobe.com/en/docs/substance-3d-designer/using/substance-graphs/nodes-reference-for-substance-graphs/node-library/mesh-based-generators/mask-generators/mask-builder),
[Histogram Scan](https://experienceleague.adobe.com/en/docs/substance-3d-designer/using/substance-graphs/nodes-reference-for-substance-graphs/node-library/filters/adjustments/histogram-scan),
[Slope Blur](https://experienceleague.adobe.com/en/docs/substance-3d-designer/using/substance-graphs/nodes-reference-for-substance-graphs/node-library/filters/blurs/slope-blur).
Blender — [2.80 release notes, Cycles](https://developer.blender.org/docs/release_notes/2.80/cycles/),
[2.79 Dirty Vertex Colors](https://docs.blender.org/manual/en/2.79/sculpt_paint/painting/vertex_paint/tools.html),
[Sharybin on Pointiness](https://blog.gregzaal.com/2015/02/10/pointiness-output/).
SideFX — [Measure 2.0](https://www.sidefx.com/docs/houdini/nodes/sop/measure.html),
[Labs Measure Curvature](https://www.sidefx.com/docs/houdini/nodes/sop/labs--measure_curvature-3.1.html),
[Curvature VOP](https://www.sidefx.com/docs/houdini/nodes/vop/curvature.html),
[Karma Curvature VOP](https://www.sidefx.com/docs/houdini/nodes/vop/kma_curvature.html),
[Attribute Blur](https://www.sidefx.com/docs/houdini/nodes/sop/attribblur.html).
Epic — [Mesh Distance Fields](https://dev.epicgames.com/documentation/en-us/unreal-engine/mesh-distance-fields-in-unreal-engine),
[Utility Material Expressions](https://dev.epicgames.com/documentation/unreal-engine/utility-material-expressions-in-unreal-engine),
[Wright, SIGGRAPH 2015](https://advances.realtimerendering.com/s2015/DynamicOcclusionWithSignedDistanceFields.pdf).
Marmoset — [Bevel surface module](https://docs.marmoset.co/docs/bevel-mode-surface-module/),
[Baking tips](https://docs.marmoset.co/docs/tips-tricks/).
Maxon — [Round Corners](https://help.maxon.net/r3d/blender/en-us/Content/html/Round+Corners.html).
Papers — [Miller 1994](https://history.siggraph.org/learning/efficient-algorithms-for-local-and-global-accessibility-shading-by-miller/),
[Rusinkiewicz 2004](https://gfx.cs.princeton.edu/pubs/Rusinkiewicz_2004_ECA/index.php),
[Chen et al. 2005](https://ttwong12.github.io/papers/gammaton/gammaton.pdf),
[Penner & Borshukov 2011](https://slidetodoc.com/advances-in-realtime-rendering-in-games-preintegrated-skin/).
Community, flagged as such — Polycount threads on curvature maps and the
FWVN edge-wear function; Mark Serena's screen-space curvature function.
