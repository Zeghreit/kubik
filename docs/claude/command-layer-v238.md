# v2.38 — one ending for an immediate edit (stage 3, slice 1)

Shipped 17 Sep 2026, commit `bf450ab`. First slice of stage 3 in
`claude/uv-commands-maps-plan.md`.

## The map, made before designing anything

Three corrections to the plan came out of reading the code first, and they
matter for the rest of stage 3:

- **There are no Web Workers in this app.** Zero `new Worker`, zero
  `postMessage`. "Worker" is this project's *prose* word for the pure `*Op`
  geometry function, as opposed to the op-bar wrapper around it. The plan's
  "операции с чистым воркером" means ops whose geometry function is pure.
- **`weldsAcrossSeam` does not exist.** The guard that earns `uvsSafe` on
  Tris-to-quads is **`pairTrisInEditable`**.
- **`uvsSafe` already has three producers**, not one: `trisToQuadsOp` on the
  rebuild path, plus `separateObject` and `detachFacesOp` through
  `createObjectFromEditable`. Treat it as a general op-declared capability.

Also worth carrying: there are **three invocation regimes**, not one.
Immediate ops (`xxxSelection` → op → `rebuildFromEditable` → the caller ends
it), pending/op-bar ops (`beginPendingOp` → `applyPendingOpInner`'s 490-line
ladder → `confirmPendingOp`), and op-setup (Lathe, Tube, Boolean — the only
regime where the op is a pure function returning `{ok, ed, mats, count}`).

`rebuildFromEditable` is already the universal write funnel (~48 sites) and
already owns the UV decision, the face map and shading. `toEditable` is the
universal read funnel and already stamps `uvIndexSig`. **Do not build a second
of either.**

## What this slice did

Immediate edits ended in **fourteen** places. Now three doors:

- `finishSceneEdit(message)` — refresh, gizmo, **the history step**, toast, hide
- `finishMeshEdit(obj, message)` — helpers, the winding audit, helper
  visibility, `refreshElementColors`, then the above
- `finishObjectGone(obj, message)` — `dropObject`, then the above

`dropObject(obj)` is the state surgery split out, because a multi-object
delete does it N times and ends once.

### Value beyond tidiness

- The **winding audit** now covers the nine tools that never called it — which
  are exactly the tools that can break winding.
- **`refreshElementColors`** now runs after every immediate edit.
  `setActiveObjectHelpersVisible` documents that its overlay is "hidden, not
  torn down: `refreshElementColors` runs right after every path that reaches
  here" — and all nine open-coded tails violated that.
- The **dying object takes only itself** out of the selection.
- **Nothing is left pointing into a dead mesh**: the element selection and all
  four pick anchors go with it.

### The bug the review found

**A mirrored edit could write zero history steps.** `runMirrored` lets only
the last pass write the step, and the last pass can return before reaching any
ending. The earlier passes' changes then sat in the scene in no step at all —
Undo walks past them, the next edit bakes them in. Fixed by pushing
unconditionally after the loop; an unchanged document is not a step.

## Probe technique worth reusing

- **Count the side effect, don't trust the code.** `finishMeshEdit`'s
  `console.log('[winding]', …)` is the only observable proof it ran, so the
  probe wraps `console.log` and counts. `finishMeshEdit` is deliberately **not
  exported**, so every section drives the real tools — a probe that called the
  door directly would agree with any bug in the corridor.
- **A running invariant beats a section.** After *every* edit: if the tool
  changed the scene, a history step holds it. Conditional on purpose.
- **A probe that sets up its fixture outside the history cannot ask the
  history about it.** This bit twice in one hour: a section undid past its own
  cube and reported the app had lost an object; the first invariant flagged an
  edit that by definition changed nothing.
- **A break that passes can be correct.** Removing the selection clear from
  the door changes nothing observable, because all seven callers still clear
  it themselves. Re-aimed at the pick anchors, which nothing else clears.

## What is still inconsistent — the next slices, ranked

1. **Eight return conventions** across ~25 functions and ~40 call sites:
   `true`/`false`; count-where-0-means-refused; count-with-`-1`-meaning-the-
   object-died; `{ok, why, count}`; `{done, skipped}` + ad-hoc `.torn`/
   `.closed`; `{part, survived}`; `{cuts, skipped, rimSplits}`; and
   always-`true`-plus-a-mutated-out-param (`circularizeApply`).
2. **Failure reported three ways.** The `opRefusal` module global (9 ops, 20
   write sites, 5 read sites), returned `{ok:false, why}` (6 ops), and bare
   falsy with the *caller* inventing the prose. Bridge is hardcoded out of the
   general path **by name** — `if (op.kind !== 'bridge')` — a rule nobody can
   discover. `slideSelection`'s comment is the canonical indictment: a stale
   `opRefusal` is "a confident wrong answer about the shape under your finger".
3. **`applyPendingOpInner` is a 490-line `if/else if` ladder** on `op.kind`,
   16 branches, plus `OP_SPECS` and a separate 9-branch toast ladder in
   `confirmPendingOp`. Three tables that want to be one per-op record. Largest
   structural win.
4. **Ops reading app state.** `arrayOp`, `revolveOp`, `latheCurveOp` read
   `App.pivotMode`/`App.pivotPoint`; `mergeByDistanceOp` and `trisToQuadsOp`
   branch on `App.pendingOp`; `rebuildFromEditable` reads `App.pendingOp`
   twice to decide whether to toast. **These three values are the explicit
   command-context parameters the layer must pass in.**
5. **`mergeByDistanceOp.lastDropped`** — a second return value smuggled out as
   a static property, written *after* the rebuild, correct only because one
   caller remembers to null it first.
6. **`op.saidWhy` is a string in three branches and a `{}` map in two.**

The command contract still has to answer the UV question: each command
declares whether it preserved the attribute-vertex correspondence, i.e.
whether it sets `uvsSafe`.
