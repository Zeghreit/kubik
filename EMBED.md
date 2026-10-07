# Embedding Kubik — protocol reference (v3.13)

Kubik can live in an `<iframe>` on another page (a "host") and be driven over
`postMessage`. Without `?embed=1` none of this exists — not even a `message`
listener. The API is general: nothing in it knows who the host is.

## Opening it

```html
<iframe src="https://<where-kubik-is>/index.html?embed=1&view=node"></iframe>
```

| URL parameter | meaning |
|---|---|
| `embed=1` | turns the mode on |
| `view=node` (default) / `view=full` | `node`: the viewport only, slow turntable, drag turns, ~330×250 px is fine. `full`: the whole editor |
| `host=<origin>` | one more origin allowed to send commands, besides Kubik's own |

In embed mode Kubik starts **empty**, never writes its autosave, never checks
for updates and never shows the first-run hint. The document lives in memory
and leaves only through `export`. The personal material library is read as usual.

## Security

Commands are accepted only from `window.parent`, and only when the message's
origin is Kubik's own `location.origin` or the `?host=` origin. Everything
else is ignored silently (no reply). Replies go to the origin that asked.
Binary data travels as `ArrayBuffer` in the transfer list, both ways.

## Envelopes

```js
// host -> Kubik
{ kubik: 1, id: 'q7', cmd: 'load', args: { ... } }
// Kubik -> host, one per request, same id
{ kubik: 1, id: 'q7', ok: true,  result: ..., rev }
{ kubik: 1, id: 'q7', ok: false, error: { code, message, ...numbers } }
// Kubik -> host, events (no id)
{ kubik: 1, event: 'ready', data: { version, caps } }
```

Commands run **one at a time, in order of arrival**. An unknown `cmd`
answers `error.code = 'unknown'`.

## Events

| event | data | when |
|---|---|---|
| `ready` | `{ version, caps }` | once, when commands can be sent. Wait for it. |
| `dirty` | `{ dirty: true, rev }` | after any edit made **in** Kubik (by the person), debounced 300 ms. A host's own commands do not fire it. |
| `selection` | `{ mode, count }` | when the selection mode or count changes. `mode` is `object`, `vertex`, `edge` or `face`. |

## Commands

| cmd | args | result |
|---|---|---|
| `hello` | — | `{ version, caps, view }` |
| `load` | `{ url \| buffer, format?, name?, replace? }` | `stats` of what was loaded (+ `notes` if Kubik had something to say) |
| `export` | `{ format: 'glb', objects?: 'all' \| [id or name] }` | `ArrayBuffer` (GLB) |
| `stats` | `{ objects?: 'all' \| [id or name] }` | see below |
| `measure` | `{ objects?: 'all' \| [id or name] }` | shells, open/torn edges, bbox, volume - see below (v3.13) |
| `snapshot` | `{ w?, h?, view? }` | `ArrayBuffer` (PNG, exactly w×h) |
| `setMaps` | `{ object?, material?, name?, flipY?, maps: {...} }` | `{ material, flipY, applied: [...] }` |
| `setView` | `{ view: 'node' \| 'full' }` | `{ view }` — no reload |
| `ops` | - | `{ ops: [...], gesture: [...] }` - see op |
| `op` | `{ name, select?, params? }` | `{ op, selection, said, stats }` |
| `undo` / `redo` | - | `{ stats }` |
| `selection` | - | `{ mode, object, objects, ids, count, rev }` |
| `camera` | `{ preset: 'fit' \| 'front' \| 'back' \| 'left' \| 'right' \| 'top' \| 'three-quarter' }` | `null` |

### load
- `url` is resolved against Kubik's page. Prefer it over `buffer` for FBX and
  glTF: **textures next to the file are fetched relative to that url**,
  including the FBX SDK's `<name>.fbm/` folder. A `buffer` has nowhere to look,
  so its external textures are left behind (embedded ones still arrive).
- `format`: `glb`, `gltf`, `fbx`, `obj`. Default: from `name` / the url's
  extension, else `glb`.
- `replace` (default `true`): the old scene is removed **only after** the new
  file has landed — a refused file leaves the scene as it was.
- `load` answers after the textures have decoded.
- three.js's FBX reader maps only the colour and normal maps of an FBX
  material; roughness/metallic/AO pictures in an FBX are not read. Send them
  with `setMaps`.
- A rigged glTF loads as its mesh in bind pose; skin and clips are not kept.

### stats
```js
{ objects, faces, tris, quads, verts, hasUV, materials: [names],
  textured: { materialName: ['baseColor', 'normal', ...] },
  list: [{ id, name, faces, tris, quads, verts, hasUV, materials, textured }] }
```
`faces` are Kubik faces (a quad is one face of two triangles). `verts` counts
distinct positions. `hasUV` is true only if every object has UVs.

### measure (v3.13)
```js
{ objects, tris, shellCount, nonManifoldEdges, boundaryEdges, tornEdges, edges,
  degenerateTris, volume, bbox: { min: [x,y,z], max, size },
  list: [{ id, name, tris, weldedVerts, edges, boundaryEdges, tornEdges,
           nonManifoldEdges, shellCount, shells: [tris, ...largest first, max 1000],
           degenerateTris, bbox, volume }] }
```
The questions a mesh gate asks, on the geometry the export would clone, in
world space (Y up). Positions are **welded first** (rounded to 1e-5): Kubik
draws every face group with private vertex copies and an FBX splits at every
seam, so unwelded connectivity would measure the drawing, not the model.
- a **shell** is welded vertices joined by edges; its size is in triangles,
  triangles the weld collapsed are not counted (`degenerateTris` counts them);
- an edge is **non-manifold** when it is not shared by exactly two triangles:
  `boundaryEdges` (one - open surface) + `tornEdges` (three or more);
- `volume` is the absolute signed volume. On an open mesh it depends on where
  the origin is and means little; zero on a closed one means flat or inverted.
Checked against Blender (`bmesh` weld + `is_manifold` + `calc_volume`) on three
production meshes: triangles, shell count and the largest shells identical,
non-manifold equal or within the triangles Kubik's importer drops. `edges` is
counted after the weld; Blender's share of non-manifold edges divides by the
unwelded count, so the same mesh reads a few points lower here.

### export
One glTF primitive per material, vertices welded on exact position + normal +
UV. Object names go on the nodes, material names on the materials. Curves are
not exported.

**Round trip without edits** (`load` → `export`), measured on the AF test
meshes (see CURRENT_STATE): same welded vertex count, same UVs, same names.
Kubik drops **zero-area triangles** (collinear slivers) on import, so the
triangle count can fall by exactly that many (Tripo stool: 29 of 24577), and
a coplanar patch next to such a sliver may be re-cut along another diagonal
(Tripo crate: 5 of 29680). The surface does not change.

### snapshot
`w`, `h` default 330×250 (16…2048). `view`: `three-quarter` (default),
`front`, `back`, `left`, `right`, `top` frame the whole scene; `current` is
what the viewport shows. Grid and helpers are hidden in the picture.

### setMaps
- `maps`: any of `baseColor`, `normal`, `roughness`, `metallic`, `ao`,
  `emissive`; each a url or an `ArrayBuffer` (PNG/JPEG).
- Colour spaces are fixed by the slot, not by the caller: `baseColor` and
  `emissive` are sRGB, the rest Linear (non-colour). `applied[]` reports, per
  map, the `colorSpace` on the material that actually draws, next to the
  `expected` one — compare them.
- `object` (id or name, or a list) — default all objects. `material` — only
  the faces wearing the material with that name.
- `flipY` — which way up the pictures are. Default: `true` for meshes loaded
  from FBX/OBJ, `false` for glTF.
- With a roughness/metallic map the factor is set to 1, so the map rules.
- Pictures are resized to 1024 on the long side, as every texture in Kubik.
- An object without UVs is refused (`nouv`).

### op - the command layer (v3.11)

```js
{ cmd: 'op', args: { name: 'inset',
    select: { mode: 'face', object: 1, ids: [0, 3], rev: 12 },   // optional
    params: { amount: 0.3, option: 'each', segments: 2, toggle: true } } }  // optional
// -> { op, selection: { mode, count, rev }, said: [...], stats }
```

An op is exactly what a finger does on the ring: the same tool, the same
refusals, **one history step**, undoable by `undo`. Names and parameters
come from `ops` (read it, do not hardcode): one entry per tool per mode,
`kind: 'bar'` (has an op bar; `params` lists `amount` {min,max,step,start},
`option.choices` - a choice may carry its own `amount` range - `segments`,
`toggle`) or `kind: 'immediate'` (takes no params). Tools that need a gesture
(`knife`, `mirror`, `boolean`) are listed under `gesture` and not runnable.

- `select` omitted: the selection as it stands (a person picked, the host
  acts). The reply's `selection` says what it was applied to.
- `ids`: `'all'` (default), or element ids - logical vertex, edge or face
  group numbers from `selection`. **Element ids are only valid for the `rev`
  they were read at**, so `rev` is required with them; an old `rev` answers
  `stale` and touches nothing. In `object` mode `ids` are object ids or names
  and need no rev.
- `params` are set in the bar's order: segments, option, amount (clamped to
  the active option's range), toggle. Missing ones keep the bar's defaults.
  Extrude is dragged by a person, so its default pulls nothing: pass `amount`.
- A refusal is `refused` with the tool's own sentence as `message`.

`rev` is the document revision. It is on **every reply** (envelope field
`rev`) and on `dirty`; it changes with every committed edit, undo, redo and
load, and not with a selection or an open preview. `undo` / `redo` answer
`{ stats }` or `nothing`. `selection` answers `{ mode, object, objects, ids,
count, rev }`. All of these answer `busy` while a person has an operation
open in the editor.

Not yet: choosing elements by a rule (`where: { normal, angle }`, `box`,
`side`, grow/shrink/loop) - planned as a declarative select computed inside
Kubik that answers `{ count, ids, bounds }`, never a per-element dump.

## Error codes

| code | meaning | extra fields |
|---|---|---|
| `budget` | too heavy to edit | `unit` (`faces` \| `triangles`), `count`, `limit`, `approx` (triangle counts are rounded to thousands) |
| `unsupported` | Draco/meshopt/unknown extension, FBX too old | |
| `nomesh` | nothing importable in the file | |
| `corrupt` | non-finite coordinates | |
| `fetch` | url could not be fetched | `status` |
| `nouv` | `setMaps` on an object without UVs | `objects` |
| `image`, `maps` | a picture could not be decoded / did not take | |
| `stale` | element ids from an older `rev` | `rev` (current) |
| `refused` | the tool declined; `message` is its own reason | `selection` |
| `busy` | a person has an operation open in the editor | |
| `nothing` | nothing to undo / redo | |
| `args`, `format`, `noobject`, `empty`, `load`, `export`, `snapshot`, `unknown`, `internal` | as named | |

Budgets in embed mode: 40 000 triangles per file, 25 000 Kubik faces
(after quads are paired). The standalone editor keeps 12 000 faces.

## Minimal client

```js
function kubikClient(frame, origin) {
  let seq = 0; const pend = new Map(); const on = {};
  addEventListener('message', (ev) => {
    if (ev.source !== frame.contentWindow || !ev.data || ev.data.kubik !== 1) return;
    const d = ev.data;
    if (d.event) { (on[d.event] || []).forEach(f => f(d.data)); return; }
    const p = pend.get(d.id); if (!p) return; pend.delete(d.id);
    d.ok ? p.res(d.result) : p.rej(Object.assign(new Error(d.error.message), d.error));
  });
  return {
    on(name, f) { (on[name] = on[name] || []).push(f); },
    call(cmd, args = {}, transfer = []) {
      const id = 'q' + (++seq);
      return new Promise((res, rej) => {
        pend.set(id, { res, rej });
        frame.contentWindow.postMessage({ kubik: 1, id, cmd, args }, origin, transfer);
      });
    }
  };
}
// k.on('ready', async () => {
//   await k.call('load', { url: 'runs/stool_r01/04_pbr/stool_r01_pbr.fbx' });
//   const png = await k.call('snapshot', { w: 330, h: 250 });
//   const glb = await k.call('export', { format: 'glb' });
// });
```

A full working host is the probe `_embedchk.html` on the dev machine (not in
the repo, like every other probe); it drives every command above.
