# Builds _bak_tubebroken.html - v2.16 with five of the things _tubechk guards
# taken back out, so the probe can be shown to FAIL.
#   1. the frame goes back to naive cross-with-up
#   2. the closed-curve twist correction is dropped
#   3. the outward-facing measurement is dropped
#   4. caps are never built
#   5. repeated points are not dropped
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


sub('  for (let i = 0; i + 1 < n; i++) R.push(step(i, i + 1));',
    '''  for (let i = 0; i + 1 < n; i++) {                    // BROKEN: naive frame
    const up = new THREE.Vector3(0, 1, 0);
    const c = new THREE.Vector3().crossVectors(T[i + 1], up);
    R.push(c.lengthSq() < 1e-12 ? R[R.length - 1].clone() : c.normalize());
  }''',
    '1. the rotation-minimising frame')

sub('    for (let i = 0; i < n; i++) R[i].applyAxisAngle(T[i], defect * i / n).normalize();',
    '    for (let i = 0; i < n; i++) R[i].normalize();     // BROKEN: no correction',
    '2. the closed-curve twist correction')

sub('''  quads.forEach(q => {
    ed.groups.push({ triangles: polygonTriangles(ed, q) });
  });''',
    '''  quads.forEach(q => {                                  // BROKEN: inside out
    ed.groups.push({ triangles: polygonTriangles(ed, [q[0], q[3], q[2], q[1]]) });
  });''',
    '3. the outward direction the construction guarantees')

sub('  if (!closed && caps) {\n    [[rings[0]',
    '  if (false && !closed && caps) {\n    [[rings[0]',
    '4. the caps')

sub('''    if (pts.length && p.distanceTo(pts[pts.length - 1]) <= 1e-6) return;''',
    '''    if (false) return;                                // BROKEN: keeps repeats''',
    '5. the repeated-point drop')

# --- v2.18 -----------------------------------------------------------------
sub("""      const p = pts[i].clone()
        .addScaledVector(R[i], prof[j][0] * ri)
        .addScaledVector(B, prof[j][1] * ri);""",
    """      const p = pts[i].clone()
        .addScaledVector(R[i], prof[j][0] * rad)
        .addScaledVector(B, prof[j][1] * rad);   // BROKEN: one radius again""",
    '6. the per-point radius is ignored')

sub("""  const prof = tubeProfilePoints(profile, N);""",
    """  const prof = tubeProfilePoints('round', N);   // BROKEN: always round""",
    '7. every profile sweeps a circle')

sub("""    t0: (p.x - hit.sp.x) * dx + (p.y - hit.sp.y) * dy,""",
    """    t0: 0,   // BROKEN: the grab jumps the radius before the finger moves""",
    '8. taking hold of a point changes it')

sub("""  if (undoSpec.restore) undoSpec.restore(s, s.snap);""",
    """  /* BROKEN: Cancel keeps the radii */""",
    '9. Cancel does not put the radii back')

sub("""  const wAt = (i) => W[wIdx[closed ? ((i % n) + n) % n : Math.max(0, Math.min(n - 1, i))]];""",
    """  const wAt = (i) => W[closed ? ((i % n) + n) % n : Math.max(0, Math.min(n - 1, i))];""",
    '10. a doubled point reads two different radii again')

sub("""  if (n < 3) closed = false;""",
    """  /* BROKEN: the loop flag outlives the points that justified it */""",
    '11. a closed curve is still a loop after its repeats come out')

io.open(ROOT + r'\_bak_tubebroken.html', 'w', encoding='utf-8', newline='').write(src)
print('WROTE _bak_tubebroken.html')
