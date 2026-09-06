# Builds _bak_v222broken.html - v2.22 with each of its answers taken back out,
# so _v222chk can be shown to FAIL. A probe that has never failed proves
# nothing.
#
#   py _mkv222broken.py          -> _bak_v222broken.html
#   py _mkv222broken.py late     -> _bak_v222broken2.html, with break 4 swapped
#                                   for the other way of getting deselect wrong,
#                                   because the first one masks a check.
import io, sys
sys.stdout.reconfigure(encoding='utf-8', errors='replace')
ROOT = r'C:\Users\a.bodrov\Projects\kubik'
src = io.open(ROOT + r'\index.html', encoding='utf-8').read()
LATE = len(sys.argv) > 1 and sys.argv[1] == 'late'
OUT = '_bak_v222broken2.html' if LATE else '_bak_v222broken.html'


def sub(old, new, why):
    global src
    n = src.count(old)
    assert n == 1, 'ANCHOR %r matched %d: %s' % (old[:60], n, why)
    src = src.replace(old, new, 1)
    print('  broke ', why)


# --- v2.22: the camera keeps its gestures ----------------------------------
sub("""function cameraButton(ev) {
  return ev.pointerType === 'mouse' && ev.button > 0;
}""",
    """function cameraButton(ev) {
  return false;                             // BROKEN: every button is a tool's
}""",
    '1. right and middle drag are swallowed by the open tool again')

sub("""  ce.drag = hit ? { i: hit.i, from: hit.world.clone() } : null;
  if (!hit) {""",
    """  ce.drag = hit ? { i: hit.i, from: hit.world.clone() } : null;
  if (!hit) return true;                    // BROKEN: it claims empty space too
  if (!hit) {""",
    '2. a press on empty space takes the camera away again')

sub("""  const p3 = cameraPlanePoint(ev, ce.drag.from);
  if (!p3) return;
  const r = { p: p3 };""",
    """  const r = curveResolve(ev, ce.drag.from); // BROKEN: snaps to what is under it
  if (!r) return;""",
    '3. a dragged point sticks to whatever solid is under the cursor')

sub("""  if (ce.sel === hit.i) ce.togg = true;
  else { ce.sel = hit.i; curveEditSelChanged(); }""",
    ("""  // BROKEN: deselected on the PRESS, so a drag of it deselects too
  if (ce.sel === hit.i) { ce.sel = -1; curveEditSelChanged(); }
  else { ce.sel = hit.i; curveEditSelChanged(); }""" if LATE else
     """  { ce.sel = hit.i; curveEditSelChanged(); }   // BROKEN: no way to deselect"""),
    '4. deselect happens on the press' if LATE else
    '4. a second tap on the selected point does nothing')

sub("""  const head = n > 1 && ce.sel === 0;""",
    """  const head = false;                       // BROKEN: only ever the last end""",
    '5. a curve cannot be extended from its first point')

sub("""  const i = opSliderPoint();
  if (i >= 0) {
    /* Written to the CURVE, not to the bar. The weights belong to the shape
       the way its points do - they save, load and undo with it - and the ✕
       still answers for them through the snapshot the spec already takes. */
    const c = findObject(s.curveId);
    const cv = c.mesh.userData.kubikCurve;
    const w = normaliseCurveRadii(cv);
    w[i] = Math.max(CURVE_R_MIN,
                    Math.min(CURVE_R_MAX, val / Math.max(1e-4, s.p[sl.key])));
    cv.radii = w;
  } else {
    s.p[sl.key] = val;
  }""",
    """  s.p[sl.key] = val;                        // BROKEN: always the whole tube""",
    '6. the slider moves the whole tube even with a point selected')

sub("""  if (opSliderPoint() >= 0) {
    const base = Math.max(1e-4, s.p[sl.key]);
    return { lo: base * CURVE_R_MIN, hi: base * CURVE_R_MAX,
             step: Math.max(1e-4, base * CURVE_R_MIN * 0.25) };
  }""",
    """  if (false) { }                            // BROKEN: the tube's travel, always""",
    '7. the travel is not the range a point can express')

sub("""  const spi = opSliderPoint();
  document.getElementById('opLabel').textContent =
    spec.label + (!spec.slider ? ''
      : spi >= 0 ? ' · point ' + (spi + 1) + ' radius'
      : ' · ' + (spec.slider.key === 'sweep' ? 'degrees' : 'radius'));""",
    """  document.getElementById('opLabel').textContent =
    spec.label + (spec.slider ? ' · ' + (spec.slider.key === 'sweep' ? 'degrees' : 'radius') : '');""",
    '8. the bar no longer says which point the slider means')

sub("""  if (!cd.moved &&
      Math.hypot(ev.clientX - cd.x0, ev.clientY - cd.y0) > DIRECT_DECIDE_PX) {
    cd.moved = true;
    cd.live = null;
  }
  if (cd.moved) { refreshCurvePreview(); return; }""",
    """  /* BROKEN: a press that travels is still placing a point */""",
    '9. an orbit inside a draw still drops a point where it let go')

# --- v2.22a: what the review found -----------------------------------------
sub("""    refreshTubeRings();
    if (selAlso) showOpSetupBar();""",
    """    refreshTubeRings();                     // BROKEN: the bar keeps the old point""",
    '10. an insert or a delete leaves the bar describing the wrong point')

sub("""  refreshTubeRings();
  syncOpSlider();     // the ring and the slider are the same number (v2.22a)""",
    """  refreshTubeRings();                       // BROKEN: the readout goes stale""",
    '11. a ring drag leaves the slider reading the pre-drag value')

sub("""    opValueEl.value = Number(opSliderValue().toFixed(sl.decimals));""",
    """    opValueEl.value = Number(App.opSetup.p[sl.key].toFixed(sl.decimals));  // BROKEN""",
    "12. leaving the number box puts the TUBE's radius into a point's box")

sub("""  if (!ce.markedDrag) { ce.markedDrag = true; editStepMark(); }""",
    """  /* BROKEN: no step when the drag becomes real */""",
    '13a. the step is no longer taken when the drag becomes real')

sub("""  /* A SECOND TAP ON THE SAME POINT LETS IT GO (v2.22).""",
    """  editStepMark();                           // BROKEN: a selection is a step
  /* A SECOND TAP ON THE SAME POINT LETS IT GO (v2.22).""",
    '13b. ...and every press on a point takes one instead')

sub("""  const aimSpan = ce.tapSpan, aimEnd = ce.tapEnd;""",
    """  const aimSpan = pickCurveSpanOn(obj, ev, CURVE_LINE_PX);  // BROKEN: judged late
  const aimEnd = ce.tapEnd;""",
    '14. the tap is judged against the camera it ended on, not the one it began on')

sub("""    const grab = Math.min(RING_GRAB_PX, Math.max(14, far * 0.55));""",
    """    const grab = RING_GRAB_PX;              // BROKEN: the same band at any size""",
    '15. a small ring swallows every press for 34px around its stroke')

io.open(ROOT + '\\' + OUT, 'w', encoding='utf-8', newline='').write(src)
print('WROTE ' + OUT)
