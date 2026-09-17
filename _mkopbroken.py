"""Deliberately broken builds for the one ending (2.38).

One decision each, and three of the four are states this code was actually in
before the version - which is the point: if the probe cannot tell 2.37 from
2.38 it is not measuring the change.
"""
import io

ROOT = r'C:\Users\a.bodrov\Projects\kubik'
s0 = io.open(ROOT + r'\index.html', encoding='utf-8', newline='').read()

BREAKS = [
    # 1: Weld goes back to its own hand-written tail - the 2.37 state. It
    # still works, it still writes one step, and it never audits winding,
    # which is the whole reason the door exists.
    ('weldapart',
     "  if (!ok) finishObjectGone(obj, 'Welding collapsed the whole mesh - removed the object');\n"
     "  else finishMeshEdit(obj, 'Welded');",
     "  if (!ok) finishObjectGone(obj, 'Welding collapsed the whole mesh - removed the object');\n"
     "  else {\n"
     "    ensureHelpers(obj);\n"
     "    setActiveObjectHelpersVisible(obj, App.mode);\n"
     "    toast('Welded');\n"
     "    hideRadialMenu(); refreshUI(); refreshGizmoAttachment(); pushHistory();\n"
     "  }"),
    # 3: the dying object clears the whole selection again - the state one of
    # the four hand-written copies was in, where deleting the last face of one
    # object quietly deselected every other object you had selected.
    ('wholeclear',
     "  App.selectedObjectIds.delete(obj.id);\n  if (wasActive) {",
     "  App.selectedObjectIds.clear();\n  if (wasActive) {"),
    # 6: the door goes back to leaving the PICK ANCHORS pointing into a mesh
    # that no longer exists - the lie outlinerDelete documents, and the half
    # of the door nothing else does for it. (Removing the selection clear
    # instead is not observable: all seven callers still clear it themselves
    # before knocking. That line is there for the eighth caller.)
    ('staleanchors',
     "one line short of being a door. */\n"
     "    App.selectedElements.clear();\n"
     "    App.edgeAnchor = null;\n    App.lastEdgePick = null;\n"
     "    App.vertAnchor = null;\n    App.lastVertPick = null;\n",
     "one line short of being a door. */\n    App.selectedElements.clear();\n"),
    # 1 and 8: Weld does the work and returns without reaching any ending, so
    # the mesh is changed and no step holds it. This is the shape of the
    # zero-step hole runMirrored's unconditional push closes, in a form a
    # probe can actually produce.
    ('nofinish',
     "  if (!ok) finishObjectGone(obj, 'Welding collapsed the whole mesh - removed the object');\n"
     "  else finishMeshEdit(obj, 'Welded');",
     "  if (!ok) finishObjectGone(obj, 'Welding collapsed the whole mesh - removed the object');\n"
     "  else toast('Welded');"),
    # 4: the mirrored second pass writes its own step, so Undo takes back half
    # a symmetric edit. The global that prevents it is easy to lose in a
    # refactor and impossible to see from inside a tool.
    ('loudmirror',
     "function pushHistory() {\n  /* The mirrored second",
     "function pushHistory() {\n  symQuietHistory = false;\n  /* The mirrored second"),
    # 2: the commit tail runs even when the tool refused - the failure the
    # refusal channel was invented for: "the bar reported <op> applied over a
    # mesh that had not moved".
    ('eagerfinish',
     "  const n = mergeVerticesOp(obj, App.selectedElements);\n"
     "  if (n === 0) { toast('Nothing shares a spot (within ' + MERGE_EPS + ')'); return; }",
     "  const n = mergeVerticesOp(obj, App.selectedElements);\n"
     "  if (n === 0) { finishMeshEdit(obj, 'Nothing shares a spot (within ' + MERGE_EPS + ')'); return; }"),
]

for name, old, new in BREAKS:
    assert s0.count(old) == 1, 'anchor missed for %s' % name
    io.open(ROOT + r'\_op_broken_%s.html' % name, 'w',
            encoding='utf-8', newline='').write(s0.replace(old, new))
    print('wrote _op_broken_%s.html' % name)
