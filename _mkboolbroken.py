# Builds _bak_boolbroken.html - v2.13 with the three things _boolchk exists
# to guard taken back out, so the probe can be shown to FAIL. A probe that has
# never failed proves nothing.
#   1. no T-junction healing   -> results are open where solids interpenetrate
#   2. no position weld        -> a quad's diagonal reads as a boundary edge
#   3. booleanSurvey says yes  -> an open object is no longer refused
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


sub('  const healed = healTJunctions(positions, tris, matOfTri);',
    '  const healed = { tris: tris, matOf: matOfTri };   // BROKEN: no healing',
    '1. T-junction healing removed')

sub('''    let n = weld.get(k);
    if (n === undefined) {''',
    '''    let n = undefined;                                 // BROKEN: no weld
    if (n === undefined) {''',
    '2. position weld removed')

sub('''function booleanSurvey(objs) {
  for (let i = 0; i < objs.length; i++) {''',
    '''function booleanSurvey(objs) {
  if (objs) return null;                               // BROKEN: never refuses
  for (let i = 0; i < objs.length; i++) {''',
    '3. survey never refuses')

# v2.17: the preview itself. Sections 16 and 17 exist for these three.
sub("""  if (s.inputIds) {
    s.inputIds.forEach(id => {""",
    """  if (false && s.inputIds) {                           // BROKEN: nothing hides
    s.inputIds.forEach(id => {""",
    '4. the inputs are not hidden behind the preview')

sub("""  if (spec.renames) {
    const nm = spec.name(s);""",
    """  if (false && spec.renames) {                         // BROKEN: stale name
    const nm = spec.name(s);""",
    '5. the name no longer follows the chips')

sub("""      if (s.inputIds && !s.p.keep) {""",
    """      if (s.inputIds) {                                // BROKEN: Keep ignored""",
    '6. OK consumes the inputs even with Keep originals on')

sub("""  if (App.opSetup) { finishOpSetup(false); return; }
  /* A live op has pushed NOTHING onto the history yet""",
    """  /* BROKEN: Undo no longer knows a setup is open.
     A live op has pushed NOTHING onto the history yet""",
    '7. Undo takes the step under the preview as well')

sub("""    s.p = Object.assign({}, s.built);
    showOpSetupBar();""",
    """    /* BROKEN: the refused setting stays on the bar */""",
    '8. a refused chip stays lit over the shape it did not make')

io.open(ROOT + r'\_bak_boolbroken.html', 'w', encoding='utf-8', newline='').write(src)
print('WROTE _bak_boolbroken.html')
