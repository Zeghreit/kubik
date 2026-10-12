# Спасённое из трёх удалённых доков

Оригиналы (`a3.0-spec-critique.md`, `bloom-two-layer-critique.md`,
`icon-redesign-handoff.md`) удалены 19.09.2026: все трое перебиты более
поздними решениями. Ниже — ровно то, что в них оставалось ценным.

## Из a3.0-spec-critique.md — что закончено и не пересматривается

> ## 6 · What is finished and must not be revisited
>
> Named so a later session does not "improve" them:
>
> - **"Filled = press · framed = state · hatched = not now."** One testable
>   rule that decides every control the app will ever grow. §6.4 already
>   states it as an acceptance test. Keep it as one.
> - **One hue, four places** — strip, mode block, hub, model. Restricting
>   Object to white so a fresh scene has no colour in it is a real idea, not
>   decoration. Signal orange as the no-mode colour is correct.
> - **The 6px toggle square** used identically in axis locks, world-ring
>   toggles, deck options and drawer rows. This is what a system looks like.
> - **Fixed bearings across rings** (N = default transform, E = slide,
>   SE = bevel, S = delete, W = make-less/make-more), with unsupported ops
>   drawn **disabled in place** rather than removed. This is what makes a
>   radial menu learnable instead of a lottery.
> - **The top strip numbers work.** Drawer 14–58, mode block 60–184, locks
>   243–379, view cube under the locks. No collisions at 393px. Verified.
> - **The motion table (§5)** — per event: duration, curve, and what actually
>   moves. Unusually implementable; most specs stop at "smooth".
> - **Words, not icons, on seats.** Correct at that size, and it is why the
>   ring survives translation and low light.
>
> None of the resolutions above changes any of this. The palette, type scale,
> seven atoms, hue rule, cut-corner logic, z-order and haptic map are adopted
> as written.

## Из bloom-two-layer-critique.md — инвентарь бездомных и выдуманных операций

> This is the finding that matters most. The map is a taxonomy of ops Kubik
> mostly does not have, and it drops most of the ops it does.
>
> Shipped today: Vertex 7 · Edge 14 · Face 11 · Object 17 · World 9.
>
> **Homeless — shipped, no seat in the map:**
>
> - Vertex: `connect`, `merge`, `set flow`, `circularize`
> - Edge: `knife`, `split`, `cap hole`, `set flow`, `circularize`,
>   `mark sharp`, `crease` — **7 of 14**
> - Face: `detach`, `knife`, `cap holes`, `set flow`, `circularize`,
>   `shade`, `flip normals` — **7 of 11**
> - Object: `array`, `flip`, `cap holes`, `shade`, `flip normals`,
>   `solidify`, `clean up`, `smooth by angle` — **8 of 17**
>
> **Invented — a seat in the map, not in the app:** DISSOLVE, ALIGN, GROW,
> SHRINK, LOOP, RING, SIMILAR, INVERT, NONE, INSTANCE, BOOLEAN, HIDE,
> BY MATERIAL, HIERARCHY, LAST, RESET.
>
> Two structural consequences:
>
> - **SELECT is a quarter of layer 1 and is almost entirely empty.**
>   Selection today is a viewport tap plus the World ring's
>   Tap/Box/Lasso. Grow/Shrink/Loop/Ring are not built. A category that
>   holds nothing costs one of four blind targets.
> - **MOVE / ROTATE / SCALE as seats is a model change, not a menu
>   change.** They are direct-drag today and the project rule is explicit:
>   *no gizmo, and it must not be rebuilt.* Putting them on seats implies a
>   current-transform mode. That is a decision to make on the record, not a
>   side effect of a taxonomy.
>
> Capacity is fine — 4 x 7 usable = 28 slots against a worst case of 17. The
> map just needs rewriting from the real inventory.

## Из icon-redesign-handoff.md — пиксельные правила отрисовки иконок

> Pixel rules: dash gaps <4.8 raw fuse; detail <1.8u collapses; never dash
> diagonals. ICON dict ~index.html:9615; HUB_TOOLS_* ~9700.

Эти правила выведены 26-пиксельным растеризатором-рецензентом (он же дал
пре-протестированные запасные варианты иконок). Других численных правил
отрисовки в оригинале не было.

## Что НЕ спасено и почему
- Четырёхкатегорийная модель кольца из bloom-two-layer-critique — прямо
  отвергнута в `ring-capacity-and-grouping.md`.
- Числа `seat 56px, radius 132` из a3.0-spec-critique — перебиты дважды,
  сейчас R=108, op seat 52; 132 позже названо значением, которое «прибивает
  кольцо к середине экрана».
- Отложенный список правок иконок из icon-redesign-handoff — описывает иконки
  колец, которых больше нет (рестайл a2.97–a2.108 заменил иконки словами).
