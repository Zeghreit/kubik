# v2.36 — the texture store moves to IndexedDB

Shipped 14 Sep 2026, commit `8ec75a9`. Closes wall 1 of the stage-2
measurement in `claude/uv-commands-maps-plan.md`.

## Why

Measured, not remembered: the origin quota is about **5,090kb** and one
1024-square picture costs about **1,162kb** as a data URL, so the whole app
had room for about **four**. `kubik.textures.v1` already held 3,486kb. A
character with two materials and four maps each did not fit. The plan's
"if that bites, IndexedDB is the answer" was written as a contingency; it bit
at four pictures.

## What it is

Database `kubik`, object store `textures`, one record per content key, the
same `{url, wrap, rep, off, rot, cen}` shape localStorage used. localStorage
stays as the **fallback** — private window, `file://` origin, a browser that
refuses — where the old ceiling is still the ceiling.

Nothing above the store changed. Definitions carry keys and not bytes, a key
is a hash of the content plus the sampler settings, a history step carries
neither, a project file carries its own copy so it opens elsewhere.

## The cost: the bytes arrive after the first frame

`texturesArrived()` is what closes the gap. **`updateMaterialEverywhere` is
the load-bearing line** — it re-binds the pooled material in place.
`dressFromPool` behind it is belt and braces, for an object whose pooled
instance has to be swapped rather than mutated.

Two doors refuse to open in that gap: **Save under a name** and **Download
.json** both check `_texLoaded`. A file written there names map keys with no
bytes behind them, downloads without complaint, and opens flat on the next
machine — the one thing `withTextures` exists to prevent.

## Review findings that were real defects

Opus review of the first draft: nine findings, two blockers, both of which
destroyed the user's pictures rather than merely hiding them.

1. **The migration burned the only copy.** `localStorage.removeItem` ran in
   the same turn the IndexedDB write was *asked for*, not when it committed —
   and it also ran from the READ's error road, so a database sick enough to
   abort a read was answered by writing to it and deleting the fallback. Now
   it removes the old key from the write's `tx.oncomplete`, and a failed read
   does not migrate at all.
2. **A stale tab deleted a live tab's pictures.** The sweep asked which keys
   on disk `MATERIALS` did not want, and `MATERIALS` is one tab's snapshot,
   taken at load and never refreshed. A window open since the morning, nudged
   once, deleted everything a second window had imported since. The sweep now
   deletes only `_texDropped` — keys *this tab* has held and let go.
3. **`texDb()` could hang forever.** Every road out of it needed an event to
   fire; an open that neither succeeds nor errors parked the promise and with
   it every save *and* the fallback. 6-second clock, and a late connection is
   closed rather than leaked.
4. **`onabort` is not `onerror`.** Both transactions handle it now; without
   it `_texLoaded` could stay false for the life of the page, muting the
   missing-picture message forever.
5. **`restoreDoc` leaked the store.** It adopted a file's pictures and never
   let the previous file's go. It prunes once the definitions are in.

Deliberately NOT done: `pruneTextures()` is not called when no definition
carries a map at all. That shape is indistinguishable from a material library
that failed to load, and the wrong guess deletes everything.

## The next wall

`saveProject` writes `serializeDoc({withTextures: true})` into localStorage
under `kubik.project.*`. The same ~5,090kb / ~1,162kb numbers apply, so the
character that can now be **built** and **kept in the library** still cannot
be **saved under a name** in the browser, and the message it gets ("Not
enough room to save - delete an older model") names the wrong cause. Download
.json has no such limit.

## Harness lessons (three, all of them "the suite quietly stopped testing")

- **A hang was counting as a pass.** `_texchk` printed `WATCHDOG at
  section6c` and then `VERDICT=PASS`, because the verdict counted only the
  sections that had run. The watchdog, a thrown error, and "the app never
  came up" all force a FAIL now.
- **Virtual time cannot measure off-thread I/O.** Section 6c hung every run
  under `--virtual-time-budget`: the clock races to the end of the budget
  before a single IndexedDB request completes. Real wall clock and results by
  POST now — the third probe here to learn it, after `_prof_probe` for
  `performance.now()` and `_texchk` itself for image decode. The probe's own
  web server also had to become threaded: a page that leaves a socket open
  blocked the POST forever and looked like a dead build.
- **6d was vacuous, and a broken build proved it.** Clearing `TEX_STORE` does
  not unbind anything — the material holds its own `THREE.Texture` — so the
  count was 12 -> 12 whatever the app did. It takes the pictures off by hand
  first now.
- **Two anchors in `_mktexbroken.py` had been stale since 2.33.** v2.35
  factored the encoder into `encodePicture` and the `flip` and `alpha` breaks
  silently stopped applying. They assert on their anchor, which is the only
  reason it was caught. **Run the whole broken-build suite after a refactor,
  not only the sections you touched.**

Eleven broken builds, all caught. `_mkidbbroken.py` adds `noidb`,
`bothroads`, `silent`.
