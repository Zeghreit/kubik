"""The half of v2.34 that one run cannot measure.

Sections 1 and 2 say the map contributes NOW. They cannot say the bend still
lands where it used to when there is no map at all - that needs the release
before it. So: run the same probe against `git show HEAD:index.html`, and

  - the sections that name the defect must FAIL there, and
  - the no-map renders must be the SAME picture, within a tile or two of
    rounding. Not the same PNG: this release rewrites the arithmetic that
    produces every one of those normals, and a hash calls a last-bit
    difference a behaviour change. Eight-by-eight tiles of mean luma, and a
    tolerance of 1 level out of 255.

The working copy is restored whatever happens.
"""
import io, os, re, shutil, subprocess

ROOT = r'C:\Users\a.bodrov\Projects\kubik'
MINE = os.path.join(ROOT, '_mine_index.html')
LIVE = os.path.join(ROOT, 'index.html')
OUT = os.path.join(ROOT, '_nmapchk_out.txt')
TOL = 1

def tiles(txt, name):
    m = re.search(r'^\s*' + re.escape(name) + r'\s+([\d,]+)\s*$', txt, re.M)
    return [int(x) for x in m.group(1).split(',')] if m else None

def verdict(txt):
    m = re.search(r'^VERDICT=(.*)$', txt, re.M)
    return m.group(1) if m else '(none)'

def fails(txt):
    return [x.strip() for x in re.findall(r'^  FAIL (.{0,70})', txt, re.M)]

def run():
    subprocess.run(['py', '_nmapchk.py'], cwd=ROOT, capture_output=True, timeout=300)
    return io.open(OUT, encoding='utf-8').read()

shutil.copyfile(LIVE, MINE)
try:
    head = subprocess.run(['git', 'show', 'HEAD:index.html'], cwd=ROOT, capture_output=True)
    assert head.returncode == 0 and len(head.stdout) > 100000, 'git show failed'
    with open(LIVE, 'wb') as f:
        f.write(head.stdout)
    head_txt = run()
finally:
    shutil.copyfile(MINE, LIVE)
    os.remove(MINE)
mine_txt = run()

print('HEAD verdict:', verdict(head_txt))
for f in fails(head_txt):
    print('   HEAD failed:', f)
print('MINE verdict:', verdict(mine_txt))
for f in fails(mine_txt):
    print('   MINE failed:', f)
print()

worst = 0
for name in ('bevel-only', 'bump-only', 'plain'):
    a, b = tiles(head_txt, name), tiles(mine_txt, name)
    if not a or not b or len(a) != len(b):
        print('%-11s NO SIGNATURE' % name)
        worst = 999
        continue
    d = max(abs(x - y) for x, y in zip(a, b))
    worst = max(worst, d)
    print('%-11s worst tile diff %3d  %s' % (name, d, 'same' if d <= TOL else 'MOVED'))
print()
print('no-map renders unchanged within %d level(s): %s' % (TOL, worst <= TOL))

d = subprocess.run(['git', 'diff', '--stat', 'index.html'], cwd=ROOT, capture_output=True, text=True)
print('restored:', d.stdout.strip().splitlines()[0] if d.stdout.strip() else '(CLEAN - WRONG)')
