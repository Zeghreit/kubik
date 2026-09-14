"""Deliberately broken builds for the named saves (2.37).

One decision each. Every one is something a reading of the code would call
fine, and most of them lose or hide a model rather than throwing.

Not here, and said out loud rather than quietly missing: the migration's
"remove the old copy only after the write has COMMITTED" cannot be broken
observably. In a healthy run the end state is identical either way; the
difference only shows when the write fails, which needs a simulated quota.
It is held by construction, shared with the same rule at 2.36.
"""
import io

ROOT = r'C:\Users\a.bodrov\Projects\kubik'
s0 = io.open(ROOT + r'\index.html', encoding='utf-8', newline='').read()

BREAKS = [
    # 1 and 4: no IndexedDB at all, so everything falls back to the old road
    # and the old ceiling. The fallback is a road, not a failure - but if it
    # is the only road, 2.37 bought nothing.
    ('nodocdb',
     "function docsTx(mode, stores) {\n  return texDb().then(db => {",
     "function docsTx(mode, stores) {\n  return Promise.resolve(null).then(db => {"),
    # 1: written to IndexedDB AND left in localStorage. A move that is really
    # a copy leaves the five-megabyte ceiling exactly where it was.
    ('copynotmove',
     "      try { localStorage.removeItem(PROJECT_PREFIX + clean); } catch (err) {}",
     "      try { localStorage.setItem(PROJECT_PREFIX + clean, JSON.stringify(rec)); } catch (err) {}"),
    # 2 and 3: the record names its pictures and carries none. It saves, it
    # lists, it opens - flat, and only on a machine whose library is a
    # different one, which is to say on somebody else's.
    ('flatrecord',
     "  const rec = { savedAt: Date.now(), doc: serializeDoc({ withTextures: true }) };",
     "  const rec = { savedAt: Date.now(), doc: serializeDoc() };"),
    # 7: delete clears the new road only, so an un-migrated copy comes back
    # on the next reload and the delete looks like it did not work.
    ('halfdelete',
     "  try { localStorage.removeItem(PROJECT_PREFIX + name); } catch (err) { /* nothing to do */ }\n  await refreshProjectList();",
     "  await refreshProjectList();"),
    # 9: the dates store stops being written, so every record sorts to the
    # bottom for ever and the drawer's order stops meaning anything. A second
    # store that drifts is worse than no second store.
    ('nodates',
     "        tx.objectStore(DOCMETA_STORE).put({ savedAt: rec.savedAt }, clean);",
     "        /* not written */"),
]

for name, old, new in BREAKS:
    assert s0.count(old) == 1, 'anchor missed for %s' % name
    io.open(ROOT + r'\_proj_broken_%s.html' % name, 'w',
            encoding='utf-8', newline='').write(s0.replace(old, new))
    print('wrote _proj_broken_%s.html' % name)
