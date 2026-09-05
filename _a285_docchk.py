import io
s = io.open('CURRENT_STATE.md', encoding='utf-8').read()
for p in ('## The flat view is a real camera (a2.85)',
          'SUPERSEDED IN PART BY a2.85',
          "## Extrude's floor, and the backwards drag it uncovered (a2.84)",
          'Version at time of writing: **a2.85**'):
    print('%-62s %d' % (p[:62], s.count(p)))
print('lines', s.count('\n') + 1)
