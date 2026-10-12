# 00-INDEX — карта ресурсов проекта Kubik

Обновлено 19.09.2026, состояние кода: **v2.67**, идёт UV-проход.
Этот файл — первое, что читается в новой сессии после `CURRENT_STATE.md`.
Он говорит, **какой док открывать и какому доку можно верить**.

**Главное правило проекта: заметка — не измерение, а старая заметка — даже не
гипотеза.** Всё, что ниже уровня 1, читается как «почему так сделали», а не как
«как сейчас устроено». Устройство — только `CURRENT_STATE.md` и код.

---

## Уровень 0 — читать всегда, в этом порядке

| док | зачем |
|---|---|
| `CURRENT_STATE.md` (в репозитории, не здесь) | единственный источник истины об устройстве; есть раздел «Deliberately absent — do not rebuild these» и «Loose ends» |
| `claude/00-INDEX.md` | этот файл |
| `claude/handoff-next-session.md` | где остановились: v2.67, что отгружено, что осталось по брифу |
| `claude/method-and-tooling.md` | стенд, скрипты, ловушки оболочки, инварианты модели |

## Уровень 1 — живое: планы и свежие решения

- `claude/uv-2d-pass-plan.md` — текущий проход
- `claude/uv-commands-maps-plan.md` — этапы UV, актуализирован 17.09
- `claude/command-layer-v238.md` — командный слой
- `claude/named-saves-idb-v237.md` — именованные сохранения в IndexedDB
- `claude/texture-store-idb-v236.md` — хранилище текстур ⚠ последний абзац («следующая стена — именованные сохранения») закрыт в v2.37
- `claude/op-gap-analysis.md` — инвентарь операций, переписан 17.09
- `claude/fbx-import-v231.md` — импорт FBX, переписан 17.09
- `claude/heavy-mesh-plan.md` — тяжёлые меши ⚠ предписание («потолок по РАЗМЕРУ, не по числу шагов») верно, арифметика п.5 перемерена в v2.35: шаг 1375kb, 35 шагов, 48 МБ

## Уровень 2 — справочники, читать по теме

- `claude/gap-inventory.md` — зафиксированные пробелы и два неисследованных перф-пункта
- `claude/ring-capacity-and-grouping.md` — **единственный действующий док про кольцо**; отвергает четырёхкатегорийную модель ⚠ инвентарь операций в нём — до v2.13 (нет BOOLEAN и кривых)
- `claude/salvage-ring-and-icons.md` — закрытые и не пересматриваемые решения + пиксельные правила отрисовки иконок
- `claude/bevel-tears-open-ends.md` — разрывы bevel на открытых краях
- `claude/wear-shading-prior-art.md` — прототипы затенения износа
- `claude/materials-roadmap.md` ⚠ «в файле вообще нет UV, поэтому всё триплanar» — мертво с v2.28
- `claude/material-pool-v28.md` ⚠ ключ описан трёхногим; с v2.33 нога текстур и стоит **перед** `own`
- `claude/design-pipeline.md` ⚠ `tokens.css` генерируется и должен пересобираться после любой правки `:root`; свидетельств пересборки нет — папка разошлась по определению
- `claude/kubik-orientation.md` ⚠ хранилище описано на localStorage; с v2.37 IndexedDB (БД `kubik` v3, сторы `textures`/`projects`/`projectMeta`). Совет про бэкап в силе
- `claude/design-pass-plan.md`, `claude/design-canvas-notes.md` — точная закрытая история дизайн-прохода
- `claude/promotion-plan-sep-oct-2026.md` — продвижение, не код
- `claude/doc-audit-2026-09-17.md` — аудит всех доков на v2.38; **указатель поправок**: открыл старый док — проверь его здесь

## Уровень 3 — история по версиям

Не действовать по ним. Открывать только чтобы понять, **почему** что-то сделано
так. Номера строк, места в кольцах и счётчики внутри устарели по определению.

`ring-envelope-v2.0.md` · `cool-running-v21.md` · `rail-and-cube-v22.md` ·
`hardening-v23bc.md` · `picture-v25.md` · `material-pool-v28.md` ·
`bump-facets-v210.md` · `booleans-v213.md` · `curves-v214.md` ·
`camera-and-slider-v222.md` · `bvh-v225.md` · `material-library-v229.md` ·
`material-library-v230.md` · `normal-map-composition-v234.md` ·
`import-plan.md` · `import-review-a2.68.md` · `import-review-a2.70-a2.71.md` ·
`picking-a2.72.md` · `surfacing-a2.73.md` · `performance-a2.74.md` ·
`region-select-a2.76.md` · `performance-a2.77.md` · `array-a2.78.md` ·
`solidify-a2.79.md` · `slide-a2.80.md` · `cleanup-a2.81.md` ·
`performance-a2.82.md` · `shading-a2.83.md` · `extrude-floor-a2.84.md` ·
`turn-keeps-flat-a2.86.md` · `row-gestures-a2.92.md` ·
`grouping-plan-a2.93.md` · `pickup-a2.94.md` · `headlight-a2.95.md` ·
`performance-a2.96.md` · `crosstest-findings.md`

Отдельно про два из них:

- `turn-keeps-flat-a2.86.md` — **действующее** правило поворота камеры; отменяет
  a2.85 (в архиве).
- `crosstest-findings.md` — AMBER #4 починен в v2.8, но см. открытый вопрос ниже.

## Уровень 4 — архив: читать только вместе с предупреждением

`claude/archive/` — документы, которые при буквальном чтении ломают код или
возвращают отменённые решения. У каждого в шапке написано, что именно мертво.

`ortho-camera-a2.85.md` · `import-review-a2.69.md` · `session-note-a2.30a.md` ·
`bump-from-masks-v26.md` · `texture-maps-v233.md`

---

## Открытые вопросы, которые никто не проверил

1. **Складки при гладком Subdivide.** `crosstest-findings.md` (AMBER #4)
   говорит, что складка теряется; `op-gap-analysis.md` говорит, что Subdivide
   честно держит складки (настоящий Catmull-Clark). Одно из двух неверно.
   Проверяется численно, не рассуждением.
2. **`tokens.css` разошёлся** с `:root` — см. `design-pipeline.md`.
3. **Маски не экспортируются**, развёртки в экспорте нет — незаконченная работа,
   а не политика (политику без-UV развернули 12.09.2026).

## Что делать с новым доком

- Новый док = одна тема, имя без номера версии, если он должен жить дольше
  версии. Номер версии в имени = обещание, что док историчен.
- Отгрузил версию — допиши `handoff-next-session.md`, не заводи новый док.
- Док, который перебит — не оставлять молча: либо шапка-предупреждение и в
  `claude/archive/`, либо спасти ценное и удалить.
- Три дока про одно и то же — это и есть проблема, а не подробность.
