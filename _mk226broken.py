"""Build a deliberately broken copy of v2.26, so _p226chk has to earn its PASS.

  py _mk226broken.py        -> _broken226.html  (the three wins undone)
  py _mk226broken.py subtle -> _broken226.html  (the two bugs the probe found
                               in my own first cut, put back)

Then: py _p226chk.py _broken226.html
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
    # 1. The frame stops clearing the cache. Nothing is slower; every pick
    #    after a layout change is offset until a resize or a scroll.
    brk("  /* The viewport rect cache lives one frame (v2.26). See viewportRect: a\n"
        "     stale rect is an offset pick, so it is dropped here rather than trusted\n"
        "     across anything that could have moved the element. */\n"
        "  _vpRect = null;",
        "  /* the frame no longer drops it */", '1 the frame keeps a stale rect')

    # 2. The projector reads the rect per call again - the whole win undone.
    brk("""  const v = p.clone().project(camera);
  if (v.z > 1) return null;
  const r = viewportRect();""",
        """  const v = p.clone().project(camera);
  if (v.z > 1) return null;
  const r = viewportEl.getBoundingClientRect();""",
        '2 worldToScreenPx reads the rect per call again')

    # 3. The wear gate reads the flag the other way round, so `undefined` -
    #    nobody has asked yet - now means NO. The list below is then built from
    #    an empty Map and the Edges mask paints nothing, silently.
    brk("    const needWear = obj.mesh.userData.wantsWear !== false;",
        "    const needWear = obj.mesh.userData.wantsWear === true;",
        '3 the two wantsWear tests disagree')

    # 4. The settle stops recomputing, so a drag out and back leaves the radius
    #    inflated for the rest of the session.
    brk("""  obj.mesh.geometry.computeBoundingSphere();
  obj.mesh.geometry.computeBoundingBox();
  /* AND THE RAYCAST TREE""",
        """  /* AND THE RAYCAST TREE""",
        '4 the settle stops recomputing the bounds')

elif MODE == 'subtle':
    # These two were in my own first cut and the probe caught both. They are the
    # reason this file exists: each puts a vertex OUTSIDE the bounds, and a mesh
    # outside its own sphere is culled - it vanishes mid-drag.

    # S1. Trust the value being stored instead of reading it back. The attribute
    #     is Float32 and the vector is a double, so the stored coordinate can
    #     land a hair outside a bound built from what we meant to store.
    brk("""      _sv.set(pa.getX(a0), pa.getY(a0), pa.getZ(a0));""",
        """      _sv.copy(v);""",
        'S1 bounds built from doubles, not from what was stored')

    # S2. Grow the radius from the box corners instead of per point. The
    #     farthest corner of a box from a centre is one of EIGHT, and min/max
    #     are two of them.
    brk("""      if (_sphC) { const d = _sphC.distanceTo(_sv); if (d > _rNeed) _rNeed = d; }""",
        """      /* per-point measurement removed */""",
        'S2 the sphere no longer measures per point')
    brk("""  if (rNeed > geo.boundingSphere.radius) geo.boundingSphere.radius = rNeed;""",
        """  const c = geo.boundingSphere.center;
  geo.boundingSphere.radius = Math.max(geo.boundingSphere.radius,
                                       c.distanceTo(lo), c.distanceTo(hi));""",
        'S2b the radius grows from two corners')

else:
    raise SystemExit('modes: default | subtle')

io.open('_broken226.html', 'w', encoding='utf-8', newline='').write(s)
print('wrote _broken226.html with', n, 'breaks (%s)' % MODE)
