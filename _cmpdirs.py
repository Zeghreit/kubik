import glob, os, sys, difflib, io
sys.stdout.reconfigure(encoding='utf-8', errors='replace')
A, B = sys.argv[1], sys.argv[2]
names = sorted(os.path.basename(x) for x in glob.glob(os.path.join(A, '*_out.txt')))
def rd(p):
    return io.open(p, encoding='utf-8', errors='replace').read().split('\n')
n_same = 0
for n in names:
    pb = os.path.join(B, n)
    if not os.path.exists(pb):
        print('MISSING in %s: %s' % (B, n)); continue
    a, b = rd(os.path.join(A, n)), rd(pb)
    if a == b:
        n_same += 1; continue
    d = [l for l in difflib.unified_diff(a, b, lineterm='', n=0)
         if l[:1] in '+-' and l[:3] not in ('---', '+++')]
    print('=== %s  (%d changed lines)' % (n, len(d)))
    for l in d[:40]:
        print('   ' + l[:170])
print('\n%d of %d files identical' % (n_same, len(names)))
