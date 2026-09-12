"""Build a deliberately broken copy of v2.24, so the probe has to earn its PASS.

  py _mkv224broken.py          -> _broken224.html   (the budget/pairing breaks)
  py _mkv224broken.py late     -> _broken224.html   (the ordering/carry breaks)
  py _mkv224broken.py v224     -> _broken224.html   (v2.24 EXACTLY as review
                                 found it: flatness-only scoring, angle 40, no
                                 short-circuit, lathe and subdivide ungated)

Then: py _v224chk.py _broken224.html
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
    brk('const MESH_FACE_BUDGET = 12000;', 'const MESH_FACE_BUDGET = 4000;',
        '1 hold ceiling back to 4000')
    brk('const OP_FACE_BUDGET = 4000;', 'const OP_FACE_BUDGET = 12000;',
        '2 op budget raised too')
    brk("""  const faceTotal = quads.length + ((!closed && caps) ? 2 : 0);
  if (faceTotal > OP_FACE_BUDGET) {""",
        """  const faceTotal = quads.length + ((!closed && caps) ? 2 : 0);
  if (faceTotal > MESH_FACE_BUDGET) {""",
        '3 tube reads the hold ceiling')
    brk("""  if (ed.groups.length > OP_FACE_BUDGET) {""",
        """  if (ed.groups.length > MESH_FACE_BUDGET) {""",
        '4 boolean reads the hold ceiling')
    brk("""  built.forEach(b => {
    const old = b.ed.groups;
    const r = pairTrisInEditable(b.ed, IMPORT_PAIR_ANGLE,""",
        """  built.forEach(b => {
    if (b) return;
    const old = b.ed.groups;
    const r = pairTrisInEditable(b.ed, IMPORT_PAIR_ANGLE,""",
        '5 pairing pass never runs')
    brk("""    (pairedTotal ? ' (' + pairedTotal + ' quad' + (pairedTotal === 1 ? '' : 's') +
      ' recovered)' : '') +""", '', '6 toast stops saying the quads')
    brk("    if (matKeyOf(ga) !== matKeyOf(gb)) return;",
        "    if (false) return;", '7 core ignores the material key')
    brk("""  const bands = segs * (closed ? profile.length : Math.max(0, profile.length - 1));
  if (bands > OP_FACE_BUDGET) {""",
        """  const bands = segs * (closed ? profile.length : Math.max(0, profile.length - 1));
  if (false) {""", '8 every sweep of revolution ungated again')
    brk("""  const willBe = loops.reduce((a, lp) => a + (lp.length >= 3 ? lp.length : 1), 0);
  if (willBe > MESH_FACE_BUDGET) {""",
        """  const willBe = loops.reduce((a, lp) => a + (lp.length >= 3 ? lp.length : 1), 0);
  if (false) {""", '9 subdivide ungated again')

elif MODE == 'late':
    brk("""  let pairedTotal = 0;
  built.forEach(b => {
    const old = b.ed.groups;""",
        """  let pairedTotal = 0;
  if (faceTotal > MESH_FACE_BUDGET) {
    toast(faceTotal + ' faces - too many to edit (limit ' + MESH_FACE_BUDGET +
      '). It is probably a scan or a smooth-shaded model.');
    return;
  }
  built.forEach(b => {
    const old = b.ed.groups;""",
        'L1 the budget refuses before pairing')
    brk("""  if (pairedTotal) {
    faceTotal = 0;
    built.forEach(b => { faceTotal += b.ed.groups.length; });
  }
""", '', 'L2 faceTotal not recounted')
    brk("""    b.ed.groups = r.groups.map((g, gi) => {
      const src = old[r.srcOf[gi]];
      return (src && src.mat !== undefined) ? { triangles: g.triangles, mat: src.mat } : g;
    });""",
        '    b.ed.groups = r.groups;', 'L3 material carry-over dropped')
    brk("      (gi) => (old[gi] ? old[gi].mat : undefined), () => false);",
        "      () => undefined, () => false);",
        'L4 landImport ignores the file material key')
    brk("""    const r = pairTrisInEditable(b.ed, IMPORT_PAIR_ANGLE,""",
        """    const r = pairTrisInEditable(b.ed, 20,""",
        'L5 import pairs at the bar angle')

elif MODE == 'v224':
    # v2.24 EXACTLY as review found it. None of these ever shipped, and each is
    # a defect with a named failing scenario.
    brk('const IMPORT_PAIR_ANGLE = 30;', 'const IMPORT_PAIR_ANGLE = 40;',
        'V1 tolerance back above SHARP_ANGLE (33) - import softens real creases')
    brk("""    const shape = quadShape(ga, gb);
    if (shape === null) return;""",
        """    const shape = quadShape(ga, gb);
    if (shape === null) return;
    if (true) { cands.push({ ga, gb, k, d, shape, err: -d }); return; }""",
        'V2 scored on flatness alone - the wrong partner on every curved strip')
    brk("""  if (faceTotal > MESH_FACE_BUDGET * 2) {""",
        """  if (false) {""",
        'V3 no short-circuit - a multi-second freeze before a certain refusal')
    brk("""  const bands = segs * (closed ? profile.length : Math.max(0, profile.length - 1));
  if (bands > OP_FACE_BUDGET) {""",
        """  const bands = segs * (closed ? profile.length : Math.max(0, profile.length - 1));
  if (false) {""", 'V4 lathe and revolve with no budget at all')
    brk("""  const willBe = loops.reduce((a, lp) => a + (lp.length >= 3 ? lp.length : 1), 0);
  if (willBe > MESH_FACE_BUDGET) {""",
        """  const willBe = loops.reduce((a, lp) => a + (lp.length >= 3 ? lp.length : 1), 0);
  if (false) {""", 'V5 subdivide with no budget - 11000 faces becomes 44000')

else:
    raise SystemExit('modes: default | late | v224')

io.open('_broken224.html', 'w', encoding='utf-8', newline='').write(s)
print('wrote _broken224.html with', n, 'breaks (%s)' % MODE)
