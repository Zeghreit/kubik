import io

P = 'index.html'
s = io.open(P, encoding='utf-8').read()
n = 0

def rep(old, new, label):
    global s, n
    c = s.count(old)
    assert c == 1, 'MATCH %d for %s' % (c, label)
    s = s.replace(old, new)
    n += 1
    print('ok', label)

# The stored name is sliced to 32 characters, so keying the merge on the FULL
# incoming name could never match an entry minted from a longer one - the probe
# caught it. Keying on the slice instead merges two different names that agree
# in their first 32, which is the defect the review found. So the entry
# remembers the full name it came from, the same way srcSig remembers the look
# it came from, and the index holds both keys.
rep("""    const ln = (v.name || '').toLowerCase();
    if (ln) {
      taken.add(ln);
      if (!isPresetDef(v) && !byName.has(ln)) byName.set(ln, id);   // first writer wins
    }
  });""",
"""    const ln = (v.name || '').toLowerCase();
    if (ln) taken.add(ln);                       // display names, for the rename loop
    /* BOTH KEYS, and srcName is why (found by the probe). A stored name is
       sliced to 32 characters, so an entry minted from
       "Metal_Rough_Scratched_Variant_01_Red" is called
       "Metal_Rough_Scratched_Variant_01" - and the file that created it could
       never find it again by the name it actually carries. Keying on the slice
       instead would merge that entry with ..._Blue and kill one of the two
       colours. So the full source name is remembered on the entry, exactly as
       srcSig remembers the look, and both are keys. First writer wins. */
    if (!isPresetDef(v)) {
      [v.srcName, v.name].forEach(x => {
        const k = String(x == null ? '' : x).toLowerCase();
        if (k && !byName.has(k)) byName.set(k, id);
      });
    }
  });""", 'seed-srcName')

rep("""      MATERIALS.set(nid, { id: nid, preset: false, name: name, color: defColor,
        roughness: rough, metalness: metal, srcSig: sig });""",
"""      MATERIALS.set(nid, Object.assign({ id: nid, preset: false, name: name,
        color: defColor, roughness: rough, metalness: metal, srcSig: sig },
        // Only when it is not already the name - no reason to carry a copy.
        full && full !== name ? { srcName: full } : null));""", 'mint-srcName')

io.open(P, 'w', encoding='utf-8', newline='').write(s)
print('patches applied:', n)
