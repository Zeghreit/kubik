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

sub('  const flip = flux < 0;',
    '  const flip = flux > 0;                              // BROKEN: sign inverted',
    '3. the outward-facing measurement')

# 6. The exact regression the v2.16 review found: measure the radial from the
#    QUAD CENTROID again, which on a closed curve keeps half a step along the
#    seam corner that T[0] - a central difference there - cannot project away.
sub('''    radv.copy(vecAt(ed, rings[0][j])).add(vecAt(ed, rings[0][k]))
        .multiplyScalar(0.5).sub(pts[0]);''',
    '''    radv.set(0, 0, 0);                                  // BROKEN: centroid again
    quads[j].forEach(a => radv.add(vecAt(ed, a)));
    radv.multiplyScalar(0.25).sub(pts[0]);
    radv.addScaledVector(T[0], -radv.dot(T[0]));''',
    '6. the radial back to the quad centroid')

sub('  if (!closed && caps) {\n    [[rings[0]',
    '  if (false && !closed && caps) {\n    [[rings[0]',
    '4. the caps')

sub('  raw.forEach(p => { if (!pts.length || p.distanceTo(pts[pts.length - 1]) > 1e-6) pts.push(p); });',
    '  raw.forEach(p => pts.push(p));                      // BROKEN: keeps repeats',
    '5. the repeated-point drop')

io.open(ROOT + r'\_bak_tubebroken.html', 'w', encoding='utf-8', newline='').write(src)
print('WROTE _bak_tubebroken.html')
