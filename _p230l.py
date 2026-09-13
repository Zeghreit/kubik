# -*- coding: utf-8 -*-
import io

P = '_mkmatbroken.py'
s = io.open(P, encoding='utf-8').read()
n = 0

def rep(old, new):
    global s, n
    assert s.count(old) == 1, 'MATCH %d for %r' % (s.count(old), old[:60])
    s = s.replace(old, new)
    n += 1

# pincolor / nocolor still named the pre-review predicate
rep('''    rep("  if (meColor.value !== meColorOpened) d.color = meColor.value;",
        "  d.color = meColor.value;")''',
    '''    rep("  if (meColorTouched) d.color = meColor.value;",
        "  d.color = meColor.value;")''')

rep('''    rep("  if (meColor.value !== meColorOpened) d.color = meColor.value;",
        "  if (false) d.color = meColor.value;")''',
    '''    rep("  if (meColorTouched) d.color = meColor.value;",
        "  if (false) d.color = meColor.value;")''')

io.open(P, 'w', encoding='utf-8', newline='').write(s)
print('pincolor/nocolor retargeted:', n)
