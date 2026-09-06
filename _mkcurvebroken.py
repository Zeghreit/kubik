# Builds _bak_curvebroken.html - v2.14 with five of the things _curvechk
# exists to guard taken back out, so the probe can be shown to FAIL.
#   1. refuseCurves never refuses  -> mesh ops run on a curve
#   2. no Bezier                   -> sampling is just the points
#   3. restoreDoc ignores curves   -> a curve does not survive a reload
#   4. no gizmoStrokes splice      -> a deleted curve leaks its material
#   5. the degenerate test back to a length test -> a lone point draws
import io, sys
sys.stdout.reconfigure(encoding='utf-8', errors='replace')
ROOT = r'C:\Users\a.bodrov\Projects\kubik'
src = io.open(ROOT + r'\index.html', encoding='utf-8').read()


def sub(old, new, why):
    global src
    n = src.count(old)
    assert n == 1, 'ANCHOR %r matched %d: %s' % (old[:50], n, why)
    src = src.replace(old, new, 1)
    print('  broke ', why)


sub('''function refuseCurves(what) {
  const bad''',
    '''function refuseCurves(what) {
  if (what) return false;                              // BROKEN: never refuses
  const bad''',
    '1. refuseCurves never refuses')

sub("""  if (cv.type !== 'bezier') {""",
    """  if (cv.type !== 'bezier' || cv.type === 'bezier') {   // BROKEN: no bezier""",
    '2. bezier sampling removed')

# Gently, so the run carries on and the other breaks are demonstrated too:
# skipping the branch outright throws inside restoreDoc (a curve record has no
# geometry block), which ends the probe at section 3 and proves nothing about
# sections 4 to 12.
sub('''        { closed: od.curve.closed, type: od.curve.type, res: od.curve.res });''',
    '''        { closed: false, type: 'poly', res: 4 });   // BROKEN: settings dropped''',
    '3. restoreDoc loses the curve settings')

sub('''    const gi = gizmoStrokes.indexOf(obj.mesh);
    if (gi >= 0) gizmoStrokes.splice(gi, 1);''',
    '''    const gi = -1;                                     // BROKEN: no splice
    if (gi >= 0) gizmoStrokes.splice(gi, 1);''',
    '4. gizmoStrokes leak')

sub('''  obj.mesh.visible = !degenerate && !App.hidden.has(obj.id);''',
    '''  obj.mesh.visible = !App.hidden.has(obj.id);        // BROKEN: lone point draws''',
    '5. the degenerate test')

io.open(ROOT + r'\_bak_curvebroken.html', 'w', encoding='utf-8', newline='').write(src)
print('WROTE _bak_curvebroken.html')
