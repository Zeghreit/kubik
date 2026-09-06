# Builds _bak_lathebroken.html - v2.15 with four of the things _lathechk
# guards taken back out, so the probe can be shown to FAIL.
#   1. the full-turn seam does not weld
#   2. a pole is copied instead of shared
#   3. the geometric winding answer is disabled  <- the v2.11 open question
#   4. a closed curve's duplicated last sample is not dropped
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


sub('  if (full) rings.push(profile);',
    '  if (false && full) rings.push(profile);          // BROKEN: seam',
    '1. the full-turn seam')

sub('      if (onAxis[i]) return profile[i];',
    '      if (false && onAxis[i]) return profile[i];   // BROKEN: pole',
    '2. the shared pole')

sub('    if (flux < 0) flip = !flip;',
    '    if (flux > 0) flip = !flip;   // BROKEN: the sign inverted',
    '3. the geometric winding answer')

sub('  if (cv.closed && samples.length > 2) samples = samples.slice(0, -1);',
    '  if (false && cv.closed) samples = samples.slice(0, -1);   // BROKEN: closed',
    '4. the closed-curve duplicate sample')

# 5. The exact regression the v2.16 review found: decide the whole shell from
#    leg 0 instead of summing the band. Straight profiles still pass; every cup
#    and every closed profile comes out inside out.
sub('    const legs0 = closed ? profile.length : profile.length - 1;',
    '    const legs0 = 1;                                   // BROKEN: leg 0 only',
    '5. the outward test back to leg 0 alone')

io.open(ROOT + r'\_bak_lathebroken.html', 'w', encoding='utf-8', newline='').write(src)
print('WROTE _bak_lathebroken.html')
