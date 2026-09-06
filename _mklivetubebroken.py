# Builds _bak_livetubebroken.html - v2.20 with the live tube's guards taken
# back out, so _livetube can be shown to FAIL.
#
# `py _mklivetubebroken.py late` leaves the first three out. They stop a tube
# from ever existing, so every section after the second has nothing to test
# and the run says less, not more - the same lesson the tube's own broken copy
# taught: breaks that stack can hide each other.
import io, sys
sys.stdout.reconfigure(encoding='utf-8', errors='replace')
LATE = len(sys.argv) > 1 and sys.argv[1] == 'late'
OUT = '_bak_livetubelate.html' if LATE else '_bak_livetubebroken.html'
ROOT = r'C:\Users\a.bodrov\Projects\kubik'
src = io.open(ROOT + r'\index.html', encoding='utf-8').read()
SKIP_WHEN_LATE = ('1. ', '2. ', '3. ', '4. ')


def sub(old, new, why):
    global src
    if LATE and why.startswith(SKIP_WHEN_LATE):
        return
    n = src.count(old)
    assert n == 1, 'ANCHOR %r matched %d: %s' % (old[:60], n, why)
    src = src.replace(old, new, 1)
    print('  broke ', why)


sub("""      if (s.kind === 'tube') {""",
    """      if (false) {                              // BROKEN: it commits as a mesh""",
    '1. accepting a tube leaves an ordinary mesh')

sub("""    if (sel.length === 1 && isLiveTube(sel[0])) {""",
    """    if (false) {                                // BROKEN: no way back in""",
    '2. Component mode on a tube does not re-open its bar')

sub("""    s.objId = seed.objId;
    s.adopted = true;""",
    """    s.objId = seed.objId;
    s.adopted = false;                          // BROKEN: it is a copy again""",
    '3. re-opening makes a second object instead of editing this one')

sub("""function isCurve(obj) {
  return hasCurveData(obj) && !obj.mesh.userData.kubikTube;
}""",
    """function isCurve(obj) {
  return hasCurveData(obj);                     // BROKEN: a tube reads as one
}""",
    '4. a tube is refused everywhere a curve is')

sub("""      const tcv = o.mesh.userData.kubikTube && o.mesh.userData.kubikCurve;""",
    """      const tcv = null;                         // BROKEN: the spine is not saved""",
    '5. a saved tube loses the curve inside it')

sub("""    if (far < RING_MIN_PX) continue;""",
    """    // BROKEN: a ring inside the dot's own grab radius is offered anyway""",
    '6. a ring too small to aim at is offered')

sub("""  if (!keep && s.adopted && s.p0 && findObject(s.objId)) {""",
    """  if (false) {                                // BROKEN: Cancel keeps the changes""",
    '7. Cancel leaves the settings it was asked to drop')

sub("""  if (srcT && srcC) {
    newMesh.userData.kubikTube = { p: Object.assign({}, srcT.p) };""",
    """  if (false) {                                // BROKEN: a copy is a dead mesh
    newMesh.userData.kubikTube = { p: Object.assign({}, srcT.p) };""",
    '8. a duplicate of a tube is not a tube')

sub("""    if (opSetupStepBack()) return;""",
    """    if (false) return;                        // BROKEN: Undo drops the lot""",
    '9. Undo throws the whole setup away again')

sub("""  if (!s || !spec || !spec.stepper) return;
  opSetupMark();""",
    """  if (!s || !spec || !spec.stepper) return;   // BROKEN: the counter marks nothing""",
    '10. a counter tap is not a step')

io.open(ROOT + '\\' + OUT, 'w', encoding='utf-8', newline='').write(src)
print('WROTE ' + OUT)
