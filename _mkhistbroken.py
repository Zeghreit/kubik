"""Build a deliberately broken copy of v2.27, so _histchk has to earn its PASS.

  py _mkhistbroken.py        -> _brokenhist.html  (the comparison goes blind)
  py _mkhistbroken.py cap    -> _brokenhist.html  (the cap misbehaves)

Then: py _histchk.py _brokenhist.html
"""
import io, sys

MODE = (sys.argv[1] if len(sys.argv) > 1 else 'default')
s = io.open('index.html', encoding='utf-8').read()
n = 0


def brk(old, new, why):
    global s, n
    c = s.count(old)
    assert c == 1, 'break %s matched %d times: %r' % (why, c, old[:80])
    s = s.replace(old, new)
    n += 1
    print('broke', why)


if MODE == 'default':
    # 1. THE ONE THAT LOSES UNDO STEPS. Stop at the first object: every later
    #    object's edits become invisible to the dedup, so a move on object two
    #    records no step at all and Undo silently does nothing.
    brk("""  if (aArr) {
    const n = a.length;
    if (n !== b.length) return false;""",
        """  if (aArr) {
    const n = Math.min(1, a.length);
    if (a.length !== b.length) return false;""",
        '1 arrays compared by their first element only')

    # 2. Keys not counted, so a field present in one document and absent in the
    #    other reads as identical - which is exactly how Group stopped being
    #    undoable at a2.93.
    brk("  if (na !== nb) return false;",
        "  if (false) return false;",
        '2 a key present in one document and absent in the other')

    # 3. NaN treated as a difference rather than as the `null` stringify writes,
    #    so one NaN coordinate makes every commit look like a change for ever.
    brk("  if (ta === 'number') return a !== a && b !== b;     // NaN == NaN, as JSON sees it",
        "  if (ta === 'number') return false;",
        '3 NaN no longer equals NaN')

elif MODE == 'cap':
    # C1 WAS HERE AND IS GONE ON PURPOSE. Removing the floor broke nothing any
    # check could see, because at the budget this version shipped with the floor
    # is unreachable on any mesh the app will hold - which is what sent the
    # budget from 96 MB to 48. The probe now tests that ARITHMETIC instead, and
    # a break nothing can catch does not belong here looking covered.

    # C2. The cursor is not carried back when the oldest step is dropped, so it
    #     points one step too far and Undo walks to the wrong place.
    brk("""    if (App.historyIndex > 0) App.historyIndex--;
  }
  return total;
}""",
        """  }
  return total;
}""",
        'C2 the cursor is not moved with the shift')

    # C3. The estimate ignores geometry, so every step is counted as tiny and
    #     the byte limit never bites.
    brk("""      n += (g.position ? g.position.length * 8 : 0);""",
        """      n += 0;""",
        'C3 the cost estimate stops counting positions')

else:
    raise SystemExit('modes: default | cap')

io.open('_brokenhist.html', 'w', encoding='utf-8', newline='').write(s)
print('wrote _brokenhist.html with', n, 'breaks (%s)' % MODE)
