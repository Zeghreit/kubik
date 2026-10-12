# v2.37 — named saves move to IndexedDB

Shipped 14 Sep 2026, commit `5bcdd23`. Removes the wall `claude/texture-store-idb-v236.md`
left standing.

## Why

`saveProject` wrote `serializeDoc({withTextures: true})` into localStorage.
The 2.35 measurement (~5,090kb origin ceiling, ~1,162kb a 1024 picture)
applied to it unchanged, so the character that could finally be **built** and
**kept in the library** still could not be **saved under a name** — and the
message it got, "Not enough room to save - delete an older model", named the
wrong cause.

Measured, not argued: the probe now saves and re-opens a **5,496kb** record.

## Shape

- Database `kubik`, version **3**. Stores: `textures` (2.36), `projects`,
  `projectMeta`.
- `projectMeta` holds only `{savedAt}` per name, written in the **same
  transaction** as the record. Without it, listing means deserialising every
  saved model in full to read one integer — and a record carries its own
  pictures, so ten models is ~90MB read on every save, delete and boot.
- localStorage stays as the fallback and as the road a not-yet-migrated
  record is still on.

## The autosave did NOT move, on purpose

It is read **synchronously** at boot by `init()` to decide whether to build a
fresh cube; async means either an `await` in front of all of `init()` or a
cube that flashes up and is replaced. And it carries no pictures
(`serializeDoc()` with no options), so it is ~1,375kb on the heaviest thing
measured. Once the named saves left it has the whole ~5,090kb to itself.
Probe section 8 asserts this so a later version cannot move it by accident.

## Both roads, always

`listProjects` merges IndexedDB with localStorage; `readProject` tries both;
`deleteProject` clears both. A record left behind by an interrupted migration
is still the user's model, and a list that hides it looks exactly like one
that lost it. The migration removes the localStorage copy only after
`tx.oncomplete` — the same rule as 2.36 — and never migrates into a database
that has just failed a read.

## Review findings that were defects

- **A "no" from the database was remembered for ever.** `texDb()` memoises,
  and `onblocked` / `onerror` / the 6-second clock all resolved null into that
  memo. Upgrading with a second Kubik tab already open — holding the v1
  connection, which 2.36 never yields — meant blocked, fallback, and
  localStorage for the whole session: multi-megabyte textured documents into
  a 5MB store, being told the model was too big, with a reload the only cure
  and nothing saying so. Now remembered for 15 seconds.
- **The re-open after an upgrade asked for the version it already knew**,
  which after somebody else's upgrade is the old one → `VersionError` →
  permanent demotion. Opens with **no version** after a versionchange.
- **`listProjectsLocal` gated on `storageAvailable()`**, which *writes* a test
  key — and that throws exactly when localStorage is full, the one condition
  this version exists for. Every un-migrated model vanished from the drawer
  and the migration never ran. Reading needs no room.
- **The migration overwrote blindly.** Compares `savedAt` now.
- **Delete said "Deleted" whatever happened** — an aborted delete left the row
  in the list under a toast saying it had gone.
- **Two list refreshes could finish out of order** and restore a deleted row.
  Generation counter: the last refresh *started* wins.

Not a defect, worth recording: the transactions are created inside a `.then`
and their requests issued after an `await`, but both run in the same
microtask checkpoint, so the transaction is still active. No dead
transactions.

## Harness lessons

- **A probe must not pin a database version.** `_texchk` section 6c opened
  `kubik` at version 1; the bump made it report "INDEXEDDB WAS NOT REACHABLE"
   — a probe failure dressed as an app failure.
- **`clearScene` removes objects, not definitions.** Section 4 loaded its
  extra maps onto the first definition in `MATERIALS` with any, which was the
  previous section's, worn by nothing — so the record did not carry them and
  the fixture weighed 2,570kb. It *said so* rather than passing.
- **Flat colour is free to JPEG.** With that fixed, the fixture was still too
  small because the sheets had noise only across the middle. A real roughness
  or AO bake has detail everywhere.
- **Sections 5 and 6 broke the moment section 4 started working**, because
  they built their legacy fixture out of the current scene — which was now
  5,496kb. The probe hit the exact wall it had just measured.

Five broken builds, all caught: `nodocdb`, `copynotmove`, `flatrecord`,
`halfdelete`, `nodates`. Said out loud: the migration's commit-ordering rule
**cannot be broken observably** — in a healthy run the end state is identical
either way. Held by construction, shared with 2.36.
