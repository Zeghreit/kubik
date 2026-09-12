"""Build a deliberately broken copy of v2.25, so _bvhchk has to earn its PASS.

  py _mkbvhbroken.py          -> _brokenbvh.html  (the three silent killers)
  py _mkbvhbroken.py policy   -> _brokenbvh.html  (the drag economics undone)

Then: py _bvhchk.py _brokenbvh.html
"""
import io, sys

MODE = (sys.argv[1] if len(sys.argv) > 1 else 'default')
s = io.open('index.html', encoding='utf-8').read()
n = 0


def brk(old, new, why):
    global s, n
    c = s.count(old)
    assert c == 1, 'break %s matched %d times: %r' % (why, c, old[:80])
    s = s.replace(old, new)
    n += 1
    print('broke', why)


if MODE == 'default':
    # 1. THE ONE THAT LOOKS LIKE NOTHING. Without indirect mode MeshBVH
    #    reorders the index buffer for cache locality, and the whole v2.23 face
    #    map is offsets into that buffer. Every face pick, every op, every
    #    export, silently against the wrong triangles.
    brk("  const t = geo.computeBoundsTree({ indirect: true });",
        "  const t = geo.computeBoundsTree();",
        '1 indirect dropped - the index buffer gets reordered')

    # 2. A STALE TREE ANSWERS WRONGLY, NOT SLOWLY. Drop the position-version
    #    test and every ray during and after a drag is answered about where the
    #    vertices used to be.
    brk("  return t._kubikPosVer === geo.attributes.position.version;",
        "  return true;",
        '2 staleness test removed - the tree answers about old positions')

    # 3. The settle never repairs, so the tree stays stale for the rest of the
    #    session and the accelerated path is never reached again.
    brk("  if (_bvhOn) freshenBoundsTree(obj.mesh.geometry);",
        "  if (false) freshenBoundsTree(obj.mesh.geometry);",
        '3 the settle stops repairing the tree')

elif MODE == 'policy':
    # P1. The first version of v2.25: refit on every ray that finds a stale
    #     tree. Correct, and twelve times more expensive than the brute force
    #     it replaces, every frame of a drag.
    brk("  return t._kubikPosVer === geo.attributes.position.version;",
        """  if (t._kubikPosVer !== geo.attributes.position.version) {
    t.refit(); t._kubikPosVer = geo.attributes.position.version;
  }
  return true;""",
        'P1 refit per ray instead of once at the settle')

    # P2. And build the tree mid-drag, which throws it away on the next frame.
    brk("  if (!t) return bvhDraggingMesh(mesh) ? false : bvhBuild(geo);",
        "  if (!t) return bvhBuild(geo);",
        'P2 builds the tree while a drag is running')

    # P3. The gate asks "is ANY drag running" instead of "is THIS mesh moving",
    #     so every static mesh snapTargetAt raycasts per frame loses its tree
    #     for the whole gesture - the one frame loop this change is for.
    brk("""    if (!directDrag || !dragCtx || dragCtx.objId === undefined) return false;
    return !!mesh && mesh.userData && mesh.userData.objId === dragCtx.objId;""",
        "    return !!(directDrag && dragCtx);",
        'P3 the drag gate is global again')

else:
    raise SystemExit('modes: default | policy')

io.open('_brokenbvh.html', 'w', encoding='utf-8', newline='').write(s)
print('wrote _brokenbvh.html with', n, 'breaks (%s)' % MODE)
