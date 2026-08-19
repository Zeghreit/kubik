# Working notes

Which of the loaded skills actually apply to Kubik, and when to reach for
them. Recorded here so the decision survives past the conversation it was
made in.

## Reach for these

**gesture-patterns** — whenever a new gesture is added or an existing one
misbehaves. It has already paid for itself: the three transform bugs in v1.64
were all one principle from it (direction lock, and "don't require precision
timing"). Its conflict-resolution section is the framework for the tool
gestures still to come, where pinch-to-inset has to coexist with
pinch-to-zoom.

**mobile-game-dev** — before anything ships to real phones. "Touch input has
unique needs: no hover states, fat fingers, palm rejection" and "design for
interruption." The interruption case has already bitten once (a lost pointer
left the tracker stuck until `pointercancel` handling was added). Two-finger
gestures will raise palm rejection next.

**interfaces-that-feel** — for the moment an operation lands. Right now an
extrude simply happens, with no acknowledgement. "Micro-wins deserve
acknowledgment; don't absorb them silently" is what a fidget needs and
currently lacks.

**design-qa-checklist** — before any release shared beyond the author. "QA
against the design spec, not memory" is precisely the failure that produced
four broken deploys in one afternoon.

**design-debt-audit** — before the next large redesign, not after. There is
real debt already: the fan menu still lists handles-era tools, the drawer has
orphaned sections, and new cubes spawn off-centre.

**personal-tool-builder** — as a corrective when polish starts before proof.
"Only polish what proves useful." Several versions went into styling a gizmo
that turned out not to belong in the app at all.

## Deliberately not used

Asset-making skills (concept-art, creature-design, texture-art,
environment-art) build models and textures; Kubik is the tool, not the
content. Text-and-form skills (form-design, readable-measure, spacing-system,
responsive-design, dark-mode-design) assume an interface made of text and
inputs; Kubik is a viewport with almost none. 3d-modeling and game-design read
as relevant but target production art pipelines and game systems.

## Caveat

Several of these skills reference `references/patterns.md` and
`sharp_edges.md` files that are not present, so only their framing is
available, not their detailed guidance.
