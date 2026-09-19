# Two bugs in the probe itself, not in v2.61:
#  1. toolRingActive is `{...} | null`, never a boolean - `=== false` never held.
#  2. startUvPan takes its origin FROM the move that crossed the threshold, so
#     one pointermove starts a pan that has, by construction, panned nowhere.
import io, sys
P = '_uv61chk.js'
s = io.open(P, encoding='utf-8').read()

def sub(old, new, tag):
    global s
    n = s.count(old)
    if n != 1:
        print('FAIL %s: %d' % (tag, n)); sys.exit(1)
    s = s.replace(old, new, 1); print('ok %s' % tag)

sub("ok('5.edge  кольцо ребра не распустилось', K.toolRingActive === false);",
    "ok('5.edge  кольцо ребра не распустилось', !K.toolRingActive);", 'ring-5')
sub("ok('6.empty третий палец не распустил кольцо «3D»', K.toolRingActive === false);",
    "ok('6.empty третий палец не распустил кольцо «3D»', !K.toolRingActive);", 'ring-6')

sub("""      down(emptyTargetAt(p1), p1.x, p1.y, 151);
      move(p1.x + 30, p1.y + 30, 151);
      await wait(10);""",
"""      down(emptyTargetAt(p1), p1.x, p1.y, 151);
      // Два движения, не одно: startUvPan берёт своё начало ИЗ того move,
      // который перешагнул RING_MOVE_CANCEL_PX, так что после одного
      // движения пан жив, но по построению не сдвинулся ни на сколько.
      move(p1.x + 15, p1.y + 15, 151);
      move(p1.x + 45, p1.y + 45, 151);
      await wait(10);""", 'pan-two-moves')
sub("      up(p1.x + 30, p1.y + 30, 151);",
    "      up(p1.x + 45, p1.y + 45, 151);", 'pan-up')

io.open(P, 'w', encoding='utf-8', newline='').write(s)
print('written')
