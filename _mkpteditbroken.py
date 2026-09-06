# Builds _bak_pteditbroken.html - v2.19 with the point editor's guards taken
# back out, so _ptedit can be shown to FAIL. A probe that has never failed
# proves nothing.
import io, sys
sys.stdout.reconfigure(encoding='utf-8', errors='replace')
ROOT = r'C:\Users\a.bodrov\Projects\kubik'
src = io.open(ROOT + r'\index.html', encoding='utf-8').read()


def sub(old, new, why):
    global src
    n = src.count(old)
    assert n == 1, 'ANCHOR %r matched %d: %s' % (old[:60], n, why)
    src = src.replace(old, new, 1)
    print('  broke ', why)


sub("""      if (sel.length === 1) {
        if (App.curveEdit && App.curveEdit.objId === sel[0].id) return;
        startCurveEdit(sel[0]);
        return;
      }""",
    """      if (false) { }                          // BROKEN: the door is shut again""",
    '1. Component mode on a curve refuses again')

sub("""  const on = pickCurveSpanOn(obj, ev, CURVE_LINE_PX);""",
    """  const on = null;                          // BROKEN: the line is not a target""",
    '2. tapping the line no longer inserts')

sub("""  const at = Math.max(1, Math.min(cv.pts.length, span + 1));""",
    """  const at = cv.pts.length;                 // BROKEN: inserts at the end""",
    '3. an insert ignores the span it was aimed at')

sub("""  cv.radii.splice(at, 0, Math.max(CURVE_R_MIN, Math.min(CURVE_R_MAX, w || 1)));""",
    """  cv.radii.splice(at, 0, 1);                // BROKEN: a bulge at every insert""",
    '4. the new point does not take the thickness already there')

sub("""  if (cv.pts.length <= 2) { toast('A curve needs at least two points'); return; }""",
    """  /* BROKEN: a curve may be whittled down to one point */""",
    '5. Delete does not stop at two points')

sub("""  const loc = obj.mesh.worldToLocal(r.p.clone());
  cv.pts[ce.drag.i] = [loc.x, loc.y, loc.z];""",
    """  const loc = r.p.clone();                  // BROKEN: world into a local list
  cv.pts[ce.drag.i] = [loc.x, loc.y, loc.z];""",
    '6. a drag writes world coordinates into a local list')

sub("""    cv.pts = ce.pts0.map(a => [a[0], a[1], a[2]]);
    cv.radii = ce.radii0.slice();""",
    """    /* BROKEN: Cancel keeps everything it was asked to throw away */""",
    '7. Cancel does not put the points back')

sub("""  if (App.curveEdit) { finishCurveEdit(false); return; }
  /* A live op has pushed NOTHING onto the history yet""",
    """  /* BROKEN: Undo does not know the editor is open.
     A live op has pushed NOTHING onto the history yet""",
    '8. Undo takes the step under an open editor as well')

# --- and the nine the review found ------------------------------------------
sub("""  const r = curveResolve(ev, ce.drag.from);""",
    """  const r = curveResolve(ev);              // BROKEN: the plane is the pivot's""",
    '9. a drag teleports the point onto the world plane')

sub("""  if (App.curveEdit) { finishCurveEdit(true); return; }
  if (App.mode === 'object') { setSoft(false); setMode(App.lastComponentMode); }""",
    """  if (App.mode === 'object') { setSoft(false); setMode(App.lastComponentMode); }""",
    '10. the mode button is a dead end again')

sub("""  if (App.curveEdit && objs.some(o => o && o.id === App.curveEdit.objId)) {
    abandonCurveEdit();
  }""",
    """  /* BROKEN: the editor outlives what it edits */""",
    '11. deleting the curve strands the editor')

sub("""  if (App.curveEdit && App.curveEdit.objId !== id) finishCurveEdit(true);""",
    """  /* BROKEN: two curves, one editor */""",
    '12. picking another object leaves the editor on the first')

sub("""  if (App.curveEdit) {
    App.curveEdit = null;
    orbit.enabled = true;
    hideCurveEditBar();
  }
  scheduleAutosave();""",
    """  scheduleAutosave();                     // BROKEN: an outside push takes them""",
    '13. an outside push bakes points nothing accepted')

sub("""  ce.drag = null;
  ce.sel = Math.min(ce.sel, cv.pts.length - 1);""",
    """  ce.sel = Math.min(ce.sel, cv.pts.length - 1);   // BROKEN: the drag re-aims""",
    '14. deleting a held point re-aims the drag')

sub("""  if (hadPoint || pickCurvePointOn(obj, ev, GRAB_RADIUS_PX)) { refreshUI(); return; }""",
    """  if (pickCurvePointOn(obj, ev, GRAB_RADIUS_PX)) { refreshUI(); return; }""",
    '15. a grab that drifts adds a point')

sub("""  if (App.geoSetup || App.opSetup) {
    const undoish""",
    """  if (App.geoSetup || App.opSetup || App.curveEdit) {   // BROKEN: any key ends it
    const undoish""",
    '16. a bare modifier commits the session')

io.open(ROOT + r'\_bak_pteditbroken.html', 'w', encoding='utf-8', newline='').write(src)
print('WROTE _bak_pteditbroken.html')
