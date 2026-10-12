⛔ АРХИВ — УСТАРЕВШАЯ ПОЛИТИКА. «Триплanar, так что политика без-UV не затронута» — мертво с v2.28.

# Note — session ending at a2.30a (2026-08-27)

Everything below is **pushed and live** at `https://zeghreit.github.io/kubik/`.
Repo `C:\Users\a.bodrov\Projects\kubik`, reachable only through Desktop
Commander. `CURRENT_STATE.md` in that repo is the authority and is current
through this session; read it before changing anything.

## What shipped, in order

| Version | What |
|---|---|
| a2.29b | **Round edges** — a bevel in the shading only, from the gradient of the edge distance field. Plus noise that **warps** the field lookup instead of offsetting the coverage, and a **Noise scale** slider. |
| a2.29c | **Cross-masking** — Cavity stops at a convex lip, Edges stops at a crease. |
| a2.29d | **Winding** — a face wound backwards no longer inverts the edges it touches. |
| a2.29e | **Which side of the wall** — the fix for the tank. |
| a2.30 | **The help card folds** — twelve sections, one open at a time, and a QR of the live URL. |
| a2.30a | **Aim assist removed**, the last of the Smart camera. |

## The one thing worth carrying forward

**a2.29e was found by measuring Zeghreit's actual file, not by building
another test shape.** Three synthetic shapes and two plausible hypotheses
had already failed. Then:

1. He sent `kubikTank.json`.
2. `applyShading`'s wear-edge pass was reimplemented in Python and run over
   it — no browser, no transfer to the PC. That killed the winding
   hypothesis in one run (zero reversed triangles in all nine objects).
3. The real cause: **his fenders are a folded plate 0.04 thick, and the
   crease on the hidden underside was well inside the field's 0.37 reach.**
   The field measures distance through solid material.
4. The fix — compare how the field grows along the surface normal, stepping
   out and stepping in — had its threshold chosen by **ray-tracing real
   ambient occlusion at every painted pixel**. Every pixel scoring above 0.6
   has an AO of exactly 0.00. That is a measurement, not a taste.

One round trip for a file bought certainty that hours of guessing did not.

## Two thresholds that were wrong twice each

Both worth remembering because both *measured healthy* at the value being
tested and were dead everywhere else:

- **The bevel's gradient guard.** Set at half the ideal magnitude — but the
  four taps SHORTEN near an edge, so it fired over the last 9% of the range.
  Every Round edges below 0.09 did nothing at all; everything above it got a
  flat strip down the crest. The probe only tested 0.5, where it looked
  fine. It now also asserts 0.06, which read exactly `0.00` before the fix.
- **A `1e-12` epsilon** on an 8-bit field — ten million times below the
  noise floor. It never fired once.

## Standing instructions

- **Push without asking.** Verify, ship, then say it is up.
- Patch scripts, never paste the file. `python _verify.py index.html` before
  every ship. Numbers for new work, letters for fixes.
- A fresh reviewer agent after substantial shader or geometry work — across
  a2.24–a2.29d it found 3, 5, 7, 4, 4, 10, 9 and 4 real defects and zero
  false alarms, including the a2.29d premise being wrong.
- PowerShell mangles inline Python. Always write a file and run it.

## Open, for next time

1. **Normals from the masks** — the agreed next feature. A cloth mask is a
   greyscale field and a normal is its slope, so every noise type already
   built becomes a bump for free, as a third checkbox beside Colour and
   Roughness. Triplanar, so the no-UV policy survives.
2. **A decision is owed, asked three times.** Masks added to a preset
   material (Solid / Plastic / Metal) are written into a project file and
   silently dropped on open, because `restoreDoc` adopts a definition only
   when its id is absent. Three options: file wins, local wins, or import
   under a new id. It is a policy choice and it is yours.
3. **Material shelf revision** — needs taste, not analysis. And
   `material.envMapIntensity` has been inert since `scene.environment` was
   set; drop it or make it multiply.
4. **Unmeasured on a phone:** the environment's full-float DataTexture, the
   atlas's two-tap slice interpolation, and the four extra field fetches
   a2.29c and a2.29e added per pixel.

`claude/next-session-plan.md` has the long version.
