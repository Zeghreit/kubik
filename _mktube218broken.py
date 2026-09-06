# Builds _bak_tube218broken.html - v2.18 with ONLY the v2.18 guards taken back
# out, so sections 12-15 can be shown to FAIL.
#
# Separate from _mktubebroken.py on purpose. That file's breaks include a
# reversed quad winding and a kept repeated point, and the two together send
# the ear clipper round a degenerate loop forever: the page stops answering and
# the probe reports nothing at all, which is not a failure anyone can read.
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


sub("""    const ri = Math.max(rad * Math.max(CURVE_R_MIN, wts[i] || 1), 4e-4 / chord);""",
    """    const ri = rad;                                    // BROKEN: one radius""",
    '1. the per-point radius is ignored')

sub("""  const prof = tubeProfilePoints(profile, N);""",
    """  const prof = tubeProfilePoints('round', N);          // BROKEN: always round""",
    '2. every profile sweeps a circle')

sub("""    t0: (p.x - hit.sp.x) * dx + (p.y - hit.sp.y) * dy,""",
    """    t0: 0,                                    // BROKEN: the grab itself jumps""",
    '3. taking hold of a point already changes it')

sub("""  if (undoSpec.restore) undoSpec.restore(s, s.snap);""",
    """  /* BROKEN: Cancel keeps the radii */""",
    '4. Cancel does not put the radii back')

sub("""  const wAt = (i) => W[wIdx[closed ? ((i % n) + n) % n : Math.max(0, Math.min(n - 1, i))]];""",
    """  const wAt = (i) => W[closed ? ((i % n) + n) % n : Math.max(0, Math.min(n - 1, i))];""",
    '5. a doubled point reads two different radii')

sub("""  if (n < 3) closed = false;""",
    """  /* BROKEN: the loop flag outlives the points that justified it */""",
    '6. a closed curve stays a loop after its repeats come out')

# The construction the flux vote was replaced by. Wound the other way is what
# a wrong answer from that vote used to produce: watertight, and inside out.
sub("""    ed.groups.push({ triangles: polygonTriangles(ed, q) });""",
    """    ed.groups.push({ triangles: polygonTriangles(ed, [q[0], q[3], q[2], q[1]]) });""",
    '7. the outward direction the construction guarantees')

io.open(ROOT + r'\_bak_tube218broken.html', 'w', encoding='utf-8', newline='').write(src)
print('WROTE _bak_tube218broken.html')
