# Design canvas — full text of all four turns (extracted 2026-09-03 from the published artifact)

Canvas: https://claude.ai/code/artifact/0fc45564-558a-46b7-8509-344684d96e7d — turns appear newest first (3, 2, 1, 0).

3
Flow — one direction, worked through by thumb
This time one direction, built from the spec's own ergonomics rather than a look: rings pick by angle from the finger and never need landing on; on-axis seats (straight up / straight down) are the only ones that need no aim, so the most frequent tool and Delete own them; the op bar is "the surface you hold a thumb on for the whole length of an operation"; every target is 44px; the drawer is other-hand territory. Colour comes from the extraction-shooter palette — acid signal on near-black, with cyan and magenta as the other two mode hues at matched chroma — and the shapes are its chevrons, ticks, cut corners and reticles. Structure stays Modernist: Archivo, zero radius, 2px rules, flush-left labels.
Three ergonomic changes proposed on top of a2.95, each argued beside its screen: the mode hub moves to the thumb-side corner (with a left-hand mirror), Help leaves the bottom row for the drawer (12 persistent controls → 9), and an op's amount can be set by dragging anywhere on the viewport — the same rule the pivot marker already uses — so the slider becomes a readout you can also grab.
3aFlow — the direction, seven states, reasoning beside each
REACH MAP · RIGHT THUMB · 393×852
ROOT ≈ (340, 780)
HARD
Other-hand corner. Drawer, view cube, symmetry, help. Nothing you touch mid-operation.
STRETCH
Edge tabs live here — outliner left, material right — because a tab is a flick, not an aim.
EASY
Mode hub, confirm, undo, the op deck. Rings bloom wherever the thumb already is, so they are always here by definition.
OBJ
VTX
EDG
FCE
DEL
SURF
Ground rules
The map is what every placement below is checked against. Persistent chrome sits only in HARD (rare, other hand) or EASY (frequent, thumb). Nothing persistent in STRETCH except edge tabs.
Mode hues keep a2.58's rule — the accent IS the mode — and a2.59's — selection wears the mode hue on the model. Object stays neutral so a fresh scene shows no colour at all; the acid signal only appears when something is being edited.
Danger is orange, not red, so it never reads as the Face magenta at a glance — the same argument a2.58a made about #ff5d5d beside salmon.
OBJECT
MOVE · AXIS · CUBE 3
FRONT
RIGHT
TOP
X
Y
Z
⤺
⤻
Idle · Object
Nine persistent controls, down from twelve. The readout moves off the centre line to sit beside the menu — one left-anchored block instead of three scattered corners. Cube keeps 128px (a2.60: it is a viewport object, and its faces are targets).
Hub goes thumb-side, hexagonal so it is the one silhouette that is never a tool seat or a toggle. 64px, larger than the 56 today, because it is tapped more than anything else. Left-hand mode mirrors the bottom row and both edge tabs.
Undo/redo sit at the far bottom-left — the doc's own "reads better sharing a bottom edge" — as 56×44 so a mis-aim on redo (empty) cannot hit undo.
EXTRUDE
INSET
BEVEL
BRIDGE
KNIFE
DELETE
SUBDIV
LOOP
SPLIT
SHADE
FACE
HOLD · AIM · LIFT → EXTRUDE
⤺
⤻
Face ring · aiming
The ring is a compass, drawn as one: 14 ticks at the spec's seat pitch (25.7°), so the same op is always in the same direction and the directions are learnable. The aim line from the dead-zone reticle to the seat under your bearing is the feedback the current ring lacks — you see what lifting will run before you lift.
On-axis seats are the free ones (no angular guesswork), so they are drawn bigger: Extrude up, Delete down, in the danger orange with a hollow fill until aimed. Ten seats, all rectangles pointing nowhere — the tick ring carries the geometry, the seats carry the word.
Chrome dims to 35% while a ring is open. The ring holds pointer capture anyway (spec), so this is honesty, not a lock.
EXTRUDE
DRAG ANYWHERE TO SET · 1 → 5 FACES
0.00
2.00 · SNAP 0.25
DISTANCE · UP
0.42
+
−
STEPS1
EACH
JOINED
SNAP ON
CANCEL
LIFT OUTSIDE = KEEP
✓
Op deck · mid-extrude
The amount is set by dragging anywhere — the viewport included — as the pivot marker already is ("aiming at a 17px dot with a thumb is exactly what this app does not ask of people"). The ruler at the top of the deck is the readout of that drag: ticks every snap step, a wedge at the value. It is still a 56px target if you would rather grab it.
Confirm is the hexagon in the EASY corner, the same silhouette as the hub — "the thing under your thumb finishes the operation". Cancel is small and far, on purpose; the doc's reviewer measured OK and Cancel at 36px and asked for 44 — here they are 72 and 48.
Each / Joined / Snap are one row of equal cells (Modernist's segmented control), the raised-on-recessed contrast a2.65's review demanded.
SEE-THRU
GRID ●
AIM
SNAP ●
+ CUBE
PIVOT
TAP ●
BOX
LASSO
WORLD
HELD ON EMPTY SPACE · 480 MS
World ring · toggles
Layout as specified: toggles in the top half, select gestures in the bottom half, Add Cube alone on the right pole (the one item that makes something), Pivot on the left pole. Drawn where it fits, aimed from the finger — so it can sit off-centre without the seats ever being out of reach.
State is shown, not the action (a2.65's rule for the symmetry button): a toggle that is ON wears the acid signal and a dot; OFF is neutral. Signal is the brand hue here because Object mode has no accent of its own — it is the colour of "on".
No icons anywhere in the rings. The doc's own pixel laws for icon detail at ring size ("dash gaps under 4.8 units fuse") disappear when the seat is a word.
OBJECT
MATERIAL · TAP APPLIES · HOLD EDITS
LIBRARY · 6
Solid
Plastic
Metal
Signal ●
Material 5
+ NEW
SIGNALON 3 OBJ
COLOUR
METALNESS0.00
ROUGHNESS0.40
MASKS
DONE
⤺
⤻
Material tray + editor
The tray stays on the thumb-side edge under the cube (spec), but drops its card-in-card look: one column, 2px rules, the open tab becomes the tray's shoulder (a2.65: "one silhouette, one border, and the close affordance sits where your thumb already is").
Preview balls are cut to hexagons — the same silhouette as the hub, because both mean "a thing you apply". The applied material is marked by a signal bar and the word, not by a border that fights the rule grid.
The editor opens beside the tray, not inside it, so the 104px preview column never has to hold three sliders. Slider box 44, track 2, knob 14×28 — grabbable, but drawn as an instrument.
KUBIKa2.95 · 12 MODELS
MODEL THUMB
CONTINUE
Cube 3
486 F · SYM X · 2 MIN AGO
OPEN →
Turret1 204 F · 4 GROUPSYESTERDAY
Hull312 F3 DAYS
Plate study96 F · IMPORTED .OBJ3 DAYS
BRING INGLB OBJ STL
SETTINGS
NEW
CUBE
+
Models · the only shell screen
No splash. The app has no account and restores your last state anyway (spec: "Kept inside the app, no files involved"), so the launch screen is the model list with the last one on top, marked CONTINUE. One tap and you are modelling.
New Cube is the same hexagon as the hub in the same EASY corner — the primary action of every screen lives in one place. Settings replaces the drawer's "things set once" role here so the drawer in the viewport can shrink to Scene, Lighting and Files.
Thumbnails print grayscale (Modernist) — colour on this screen means only "this is where you left off".
Try next: "show the left-hand mirror of 3a" · "add the outliner shelf and the drawer to 3a" · "the Vertex and Edge rings, same compass" · "prototype the drag-anywhere op deck so I can feel it".
2
Again — with the graphic language of a tactical extraction-shooter HUD
Borrowed devices, not their assets: near-black ground, bracketed corners, dense monospace readouts, hazard stripes, oversized numerals that run off the edge, hard diagonal cuts, a dot-grid field. Still inside Modernist — Archivo, zero radius, 2px rules, flush-left labels, one accent. The system's dark-ground step (#ff563c) stands in for the game's signal colour; if you want it acid-green instead say so and I'll swap the accent role across the whole turn. Three intensities: 2a readout, 2b hazard, 2c signal.
2aReadout — bracketed panels, mono telemetry, indexed tool seats
KUBIK // a2.95LOCAL · OFFLINE OK
01 / MESH EDITOR
KUBIK
A fidget for 3D artists. One hand. No gizmo.
MODELS
12
LAST
2M
FACES
486
NEW CUBE[ TAP ]
RESUME CUBE 319:42 · AUTOSAVE
BRING INGLB OBJ STL
MODELS12 STORED · 1.9 MB
01ACTIVE
MODEL THUMB
Cube 3
486 F · 2 MIN
02YESTERDAY
MODEL THUMB
Turret
1 204 F · 4 GRP
033 DAYS
MODEL THUMB
Hull
312 F · SYM X
043 DAYS
MODEL THUMB
Plate study
96 F · IMPORT
NEW CUBE
BRING IN
MODE
FACE
MOVE · AXIS X
SEL 1 / 6
CUBE 3
00EXTRUDE
01INSET
02BEVEL
03BRIDGE
07DELETE
06SUBDIV
05LOOP
04SEPARATE
MODEFACE
HISTUNDO 14
REDO 0
?
OP
EXTRUDE
LIVE PREVIEW
1 FACE → 5
CUBE 3
DISTANCE
0.42
SNAP 0.25
MAX 2.00
EACH
JOINED
−
01
+
ABORT
COMMIT[ ✓ ]
MODEFACE
HISTUNDO 14
REDO 0
?
2bHazard — stripe bands as structure, type that runs off the edge, diamond ring
KUBIKa2.95
KUBIK
A fidget for 3D artists. Something pleasant to turn over while you think.
New cube
Resume Cube 32 MIN AGO
Models12
MODELS12 · BY LAST EDIT
THUMB
Cube 3486 F · SYM XACTIVE · 2 MIN
Turret1 204 F · 4 GROUPSYESTERDAY
Hull312 F3 DAYS
Plate study96 F · IMPORTED .OBJ3 DAYS
New cube
Bring in
FACE.
MOVE · AXIS X · 1 SEL
X
Y
Z
EXTRUDE
INSET
BEVEL
BRIDGE
DELETE
SUBDIV
LOOP
SPLIT
FACE
UNDO
REDO
?
EXTRUDE.
DRAG TO SET · LIFT TO KEEP
0.42
UP·EACH·SNAP 0.251 → 5 FACES
EACH
JOINED
−
+
CANCEL
APPLY EXTRUDE
2cSignal — heavy accent fields, diagonal cuts, offset type; the loudest of the three
KUBIK · a2.95 · LOW-POLY MESH EDITOR
KUBIK
KUBIK
A fidget for 3D artists. Grab what's selected and drag it — no gizmo.
New cube
Resume Cube 32 MIN
Models12
MODELS/12LAST EDIT ↓
01 · ACTIVE
Cube 3
486 F · 2 MIN
02
Turret
1 204 F · YESTERDAY
03
Hull
312 F · 3 DAYS
04
Plate study
96 F · 3 DAYS
New cube
Bring in
MODE
FACE
X
Y
Z
MOVE · 1 OF 6 FACES · CUBE 3
EXTRUDE
INSET
BEVEL
BRIDGE
DELETE
SUBDIV
LOOP
SPLIT
SLIDE OUT
FACE
UNDO
REDO
?
OP · LIVE
EXTRUDE
0.42
UP · EACH
SNAP 0.25
1 → 5 F
EACH
JOINED
−
+
CANCEL
APPLY
Try next: "2a with 2b's giant numeral" · "swap the accent to signal green across turn 2" · "2c but calmer — drop the diagonal cuts" · "build the drawer, outliner and material tray for 2a".
1
Modernist Kubik — the shell, the ring, the op bar
Same rules in all three: zero radius, one control size, 2px rules doing the organising, labels flush left (even inside buttons), Archivo throughout, one accent. The shell is Modernist as written — ink on #f3f2f2, accent #ec3013. The viewport keeps a dark ground (the model needs it) and takes the same tokens inverted: surface #201e1d, rules #4a4544, accent #ff563c — the ramp step the system specifies for a dark ground. What changes between them is where chrome lives: welded to rails 1a, gathered into one sheet 1b, or run down a spine 1c.
1aRails — nothing floats; chrome is welded to two edges and divided by rules
KUBIK a2.95
KUBIK
A fidget for 3D artists.
New cube+
Open lastCube 3 · 2 min ago
Bring in a model.glb .obj .stl
NO INSTALL · NO ACCOUNT · WORKS OFFLINE
MODELS12
MODEL THUMB
Cube 3
486 F · 2 MIN
MODEL THUMB
Turret
1 204 F · YESTERDAY
MODEL THUMB
Hull
312 F · 3 DAYS
MODEL THUMB
Plate study
96 F · 3 DAYS
Kept inside the app, no files involved. Your last state is restored automatically when you come back.
New cube+
OBJECT
MOVE · AXIS
X
Y
Z
EXTRUDE
INSET
BEVEL
BRIDGE
DELETE
SUBDIV
LOOP CUT
SEPARATE
OBJECT
UNDO
REDO
?
FACE
1 SELECTED
X
Y
Z
EXTRUDE
0.42
EACH
JOINED
−
1
+
CANCEL
APPLY EXTRUDE
FACE
UNDO
REDO
?
SAVE486 F · 1 204 V
NAME
Cube 3
In the appAUTOSAVED · 19:44
Download .jsonEDITABLE · 84 KB
.glbWITH MATERIALS
.obj+ .MTL
.stlFOR PRINTING
A model comes back as faces, not triangles, so it edits like something you built here.
Save
Copy link
1bSheet — one surface holds every control; the viewport is empty until you touch it
KUBIK a2.95 · OPEN AND PUSH A CUBE AROUND
A FIDGET
FOR 3D
ARTISTS
New cubeONE TAP
Cube 3RESUME · 2 MIN
Models12
MODELSFACES · EDITED
Cube 3
OPEN NOW
486
2 MIN
Turret
4 GROUPS
1 204
YESTERDAY
Hull
SYMMETRY X
312
3 DAYS
Plate study
IMPORTED .OBJ
96
3 DAYS
BRING IN A MODEL.GLB .GLTF .OBJ .STL
New cube+
OBJECT · MOVE · AXIS X
CUBE 3
FACE TOOLS · 1 SELECTED
EXTRUDE
INSET
BEVEL
BRIDGE
SUBDIV
LOOP CUT
SEPARATE
MIRROR
DELETE
MODELS
MATERIAL
VIEW
FACE
UNDO
REDO
?
FACE · EXTRUDING
CUBE 3
EXTRUDE · EACH
0.42
+
−
0.00SNAP 0.252.00
EACH
JOINED
STEPS 1
CANCEL
APPLY+0.42 UP
1cSpine — a 56px left column carries mode and tools; the ring becomes a lattice
KUBIK
a2.95
LOW-POLY MESH EDITOR · ONE HAND
PUSH A
CUBE
AROUND
New cube+
Cube 32 MIN
Models12
There is no gizmo. You grab what is selected and drag it.
MODELS
12 SAVED
SORTED BY LAST EDIT
01
Cube 3
486 FACES · SYM X
OPEN NOW
02
Turret
1 204 FACES · 4 GROUPS
YESTERDAY
03
Hull
312 FACES
3 DAYS
New cube+
≡
FACE
X
Y
Z
⤺
⤻
FACE · MOVE · 1 SELECTED
SUBDIV
LOOP
SEPARATE
INSET
EXTRUDE
BEVEL
BRIDGE
MIRROR
DELETE
MATERIAL
VIEW
?
≡
EXTRUDE
HOLD AND DRAG TO SET · LIFT TO KEEP
0.42
UP · EACH · 1 STEP
−0.25
+0.25
JOINED
CANCEL
KEEP IT
Try next: "take 1a's rails but 1b's tool sheet" · "1c loses the spine in landscape — show me" · "give the chosen one the drawer, outliner, material tray and save screen" · "new directions".
0
Baseline — Kubik a2.95 as it stands
Recreated from your four screenshots plus CURRENT_STATE.md. index.html is not in the repo, so anything the screenshots do not show (bloom-ring seat angles, op-bar internals) is rebuilt from the spec's own numbers — 44px controls, 56px hub, 128px view cube, --edge 14px / --edge-b 4px, mode accents Object #a8afbd · Vertex #DDB863 · Edge #6EA6D8 · Face #E8836C, panel ground #181b21.
Your read — "sketchy and chaotic, overpopulated, elements look too default" — is visible here as soon as the states sit side by side: nine floating rounded rectangles in four corners, three radii of the same shape, and every panel a soft dark card with no relationship to any other. That is the brief for turn 1. Model is a placeholder cube, not your tank.
0aIdle viewport · Object mode
Move Axis
FRONT
RIGHT
TOP
X
Y
Z
›
‹
⤺
⤻
?
0bFace mode · accent + modeBar
Move Axis · 1 face
FRONT
RIGHT
TOP
X
Y
Z
›
‹
⤺
⤻
?
0cWorld ring · hold on empty space
✛
▦
◁
◉
⌖
▣
◎
✧
⬚
Move Axis
FRONT
RIGHT
TOP
⤺
⤻
?
0dSelection ring · Face tools, delete at seat 7
⬆
◱
◲
⌗
✕
◧
◨
⬒
Move Axis · 1 face
⤺
⤻
?
0eOp bar · mid-extrude
Extrude 0.42
Extrude
Each
Joined
−
1
+
0.42
✓
✕
⤺
⤻
?
0fOutliner shelf
Cube 3
◉
Cube 3 copy
◉
Cube 3 copy copy
◉
Cube 2 copy
◉
Cube 3 copy copy cop…
◉
Cube 33 sym
◉
Cube 3 detached
◉
Cube 1 joined sym sy…
◉
‹
Move Axis
FRONT
RIGHT
TOP
X
Y
Z
?
0gMaterial tray + editor
Solid
Plastic
Metal
Material 4
›
Plastic
Colour
Metalness0.00
Roughness0.40
Move Axis
FRONT
RIGHT
TOP
0hDrawer open
Kubik
a2.95
✕
APPEARANCE
Colour is in the material — the tab on the right edge.
Lighting — pick the type here. Hold two fingers still anywhere, then slide with the other hand to aim it.
Studio
Softbox
Rim
Overcast
EDITING
⌗ Values
Clear creases
Drag speed0.70
SNAP AMOUNTS
Move0.25
Rotate15°
Scale0.10
Switched on in the world ring; these are what it lands on.
FILES
Download .json
Open .json
.glb
.obj
.stl
Next: turn 1 rebuilds the shell around this (launch · library · save & share) and the ring + op bar, in the Modernist system. Say if any baseline state is wrong before I build on it.
Made with Claude Design
