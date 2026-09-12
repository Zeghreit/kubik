"""Build a deliberately broken copy of v2.28, so _uvchk has to earn its PASS.

  py _mkuvbroken.py        -> _brokenuv.html  (the channel leaks)
  py _mkuvbroken.py wrong  -> _brokenuv.html  (the gate opens the wrong way -
                              UV carried onto vertices it does not describe,
                              which is worse than losing it)

Then: py _uvchk.py _brokenuv.html
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
    # 1. separateGroupVertices drops it, which is every op and every rebuild.
    brk("        if (uvs) uvs.push(ed.uvs[vi * 2], ed.uvs[vi * 2 + 1]);",
        "        if (false) uvs.push(ed.uvs[vi * 2], ed.uvs[vi * 2 + 1]);",
        '1 separateGroupVertices stops carrying UV')

    # 2. The op snapshot forgets it, so the first nudge of any bar - and Cancel,
    #    which is meant to change nothing - strips a texture.
    brk("    uvs: ed.uvs ? ed.uvs.slice() : undefined,",
        "    uvs: undefined,",
        '2 the op snapshot forgets UV')

    # 3. The file forgets it, so a save-and-open loses the mapping silently.
    brk("          uv: g.attributes.uv ? Array.from(g.attributes.uv.array) : undefined,",
        "          uv: undefined,",
        '3 the document stops carrying UV')

    # 4. The import reader stops reading it, so the whole point of the version
    #    goes away while everything still "works".
    brk("""    const uvAttr = geo.attributes.uv;
    if (uvAttr && uvAttr.count === pos.count) {
      for (let i = 0; i < uvAttr.count; i++) uvs.push(uvAttr.getX(i), uvAttr.getY(i));
    } else {""",
        """    const uvAttr = null;
    if (uvAttr && uvAttr.count === pos.count) {
      for (let i = 0; i < uvAttr.count; i++) uvs.push(uvAttr.getX(i), uvAttr.getY(i));
    } else {""",
        '4 the glTF reader stops reading UV')

    # 5. The pairing welds across a UV seam, smearing one island's mapping onto
    #    the other island's corner.
    brk("    if (weldsAcrossSeam(ga, gb)) return;",
        "    if (false) return;",
        '5 the pairing welds across a UV seam')

    # 6. Separate stops carrying UV, which is the review's named scenario: a
    #    textured character split into loose parts loses every texture.
    brk("        if (compactUV) compactUV.push(ed.uvs[v * 2], ed.uvs[v * 2 + 1]);",
        "        if (false) compactUV.push(ed.uvs[v * 2], ed.uvs[v * 2 + 1]);",
        '6 Separate stops carrying UV')

elif MODE == 'wrong':
    # THE GATE OPENED THE WRONG WAY. Carrying UV onto vertices it does not
    # describe is worse than dropping it: the model keeps a texture and the
    # texture is wrong, which is the failure mode this file fears most. Review
    # named the live case - Dissolve, Dissolve vertex and Spin reindex without
    # moving a vertex - and these are the two ways to stop seeing it.
    brk("""  const sig = ed.uvIndexSig;
  if (!sig) return true;
  const now = uvIndexSigOf(ed);""",
        """  const sig = null;
  if (!sig) return true;
  const now = uvIndexSigOf(ed);""",
        'W1 the index comparison never runs - a reindex carries UV')

    # And the length half, which is the cheap prefix.
    brk("""function uvsMatch(ed) {
  return !!(ed && ed.uvs && ed.uvs.length * 3 === ed.positions.length * 2);
}""",
        """function uvsMatch(ed) {
  return !!(ed && ed.uvs);
}""",
        'W2 the gate stops checking the length')

    # And the primitive brings BoxGeometry's UV back, so "no primitive has UV"
    # is false again and the toast fires on every Add.
    brk("  geo.deleteAttribute('uv');",
        "  // the box keeps its uv",
        'W3 primitives carry BoxGeometry UV again')

else:
    raise SystemExit('modes: default | wrong')

io.open('_brokenuv.html', 'w', encoding='utf-8', newline='').write(s)
print('wrote _brokenuv.html with', n, 'breaks (%s)' % MODE)
