import io, os, sys, re
A, B = sys.argv[1], sys.argv[2]
bad = []
for fn in sorted(os.listdir(B)):
    if fn == '_run.txt':
        continue
    pb = os.path.join(B, fn)
    txt = io.open(pb, encoding='utf-8', errors='replace').read()
    for m in re.finditer(r'.*(FAIL|ERROR|MISMATCH).*', txt):
        bad.append(fn + ': ' + m.group(0).strip()[:160])
    pa = os.path.join(A, fn)
    if os.path.exists(pa):
        old = io.open(pa, encoding='utf-8', errors='replace').read()
        if old != txt:
            print('CHANGED ' + fn)
    else:
        print('NEW     ' + fn)
print('---')
print('\n'.join(bad) if bad else 'no FAIL/ERROR lines')
