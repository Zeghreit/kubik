# Kubik — Low-Poly Mesh Editor (three.js)

Live: https://zeghreit.github.io/kubik/ · one self-contained `index.html`
(~56 000 lines), three.js from CDN. It must run by opening the file — no
install, no server, no build step.

## Read first, in this order
1. `CURRENT_STATE.md` — single source of truth about how the app works. It has
   "Deliberately absent — do not rebuild these" and "Loose ends". Where it and
   this file disagree, it wins. It is ~19 000 lines: read the top, then
   `grep -n '^#'` and open sections by line range. Never read it whole.
2. `docs/claude/00-INDEX.md` — the resource map: which doc to open and which
   docs lie. Never pick a doc by its filename alone.
3. `docs/claude/handoff-next-session.md` — where we stopped.
4. `docs/claude/method-and-tooling.md` — bench, scripts, traps, model invariants.

Paths written as `claude/X.md` inside the docs mean `docs/claude/X.md`. The
copy in the claude.ai Project is frozen as of 12.10.2026 — the repo copy is
the master now. `docs/` is served publicly by Pages: nothing secret goes there.

**Project law: a note is not a measurement, and an old note is not even a
hypothesis.** Docs below level 1 of the index explain WHY something was done,
never how it works now. Code and CURRENT_STATE.md do.

## Roles
- Zeghreit gives creative direction and tests. Beginner coder — explain in
  plain words, two or three lines.
- Claude writes ALL code.

## Design principles
- Viewport is the hero, UI stays out of the way.
- Direct manipulation: grab the thing and move it. There is NO gizmo and one
  must not be rebuilt.
- Touch targets sized for fingers; no hover-only controls.
- General-purpose tool — no assumptions about game assets or printing.
- UV transform stays 2D-only — nothing in the 3D viewport's UV mode.

## Token discipline — not optional
- **`index.html` is NEVER read whole** (~3 MB). Use the Grep tool, then Read
  with `offset`/`limit` for a range. Same for `CURRENT_STATE.md`.
- Never paste the file or a large slice of it into chat.
- After a patch, do NOT re-read to check — `py _verify.py` and
  `node --check` say it cheaper.
- Don't restate tool output between steps. Post-change summary: two or three
  plain-language lines.
- One session = one feature. Use `/clear` between features. At ~60% context,
  say so and propose closing the version. End a session by appending to
  `docs/claude/handoff-next-session.md` and committing it.

## Workflow — five steps, every time
1. **Scope.** Fix (letter, v3.13 → v3.13a) or feature (number)? One line from
   Zeghreit.
2. **Recon.** Grep by the map. Delegate to `kubik-recon` if it's a sweep.
   Nothing "just in case".
3. **Plan in 3–5 lines, before code.** This is where "should this exist at
   all" gets caught — polishing instead of questioning has caused rework.
4. **Patch.** Python patch script (rules below), then `py _verify.py` plus the
   duplicate-declaration check.
5. **Verify.** Numbers, not reasoning. Ask for `?debug=1` console output rather
   than reasoning about a blank screen. A boot timeout means run `_err61chk`
   first, not the probe again. Probes call `boot()` directly, never gate on
   `window.load`. Battery: `_runprobes.py` / `_suite.ps1` (~12 min) plus
   `_retry.ps1` — long runs in the background.

Clean up scratch files before committing (`_*` is gitignored except the
harness — see `.gitignore`). Commit only what belongs; never `git add -A` with
unrelated scratch around. After push, `git rev-list --left-right --count
origin/main...main` must print `0 0`.

## Subagents — context isolation, not help
Delegate on your own initiative when the input fits in a paragraph and the
output fits in a short summary. Launch independent ones in parallel.
- `kubik-recon` (haiku) — code recon, sweeps, mechanical batch edits
- `kubik-reviewer` (opus) — code review of a finished patch
- `kubik-geometry-adversary` (fable) — adversarial review of geometry and
  numerical code: CSG, curve maths, UV, anything with a tolerance in it

Fable found the v2.67 blocker and a world-vs-local scale error; opus, reviewing
the fixes, found the replacement shape test was invariant under independent
U/V scaling. Neither produced a false alarm.
Do NOT delegate step-by-step debugging, feature implementation, or anything
needing Zeghreit's answer mid-task. Report the conclusion, not the narration.

## Docs hygiene
One doc per topic. A version number in a filename means the doc is history.
Shipped a version → append to `handoff-next-session.md`, don't start a new doc.
An overruled doc gets a warning header and moves to `docs/claude/archive/`, or
its valuable part is salvaged and it is deleted. Three docs about the same
thing IS the problem.

## Processes
Close what you started (servers, headless Chrome, scripts) by exact PID when
done. Never kill by process name — python/node on this PC also run other
services. Never touch apps Zeghreit opened himself.

## Окружение и оболочка

- Python запускать через `py` (или alias `python` из `~/.bashrc`); `python.exe` в WindowsApps — заглушка Microsoft Store (exit 49).
- Многострочные патч-скрипты писать инструментом Write в файл `_*.py`, не через heredoc (`\n` в строках heredoc становится настоящим переводом строки → SyntaxError); перед запуском `py -m py_compile <файл>`.
- Правки `index.html` — только через `rep(a, b)` с `assert s.count(a) == 1`; файл записывать один раз в конце скрипта, чтобы при несовпадении якоря ничего не применялось наполовину.
- Не писать голый `sleep N` (блокирует харнесс); долгие задачи (`py _runprobes.py …`, ~5.5 мин) запускать с `run_in_background` и ждать через `until [ -s <файл-результата> ]; do sleep 5; done`.
- Пока идёт набор проб (`_runprobes.py` читает `index.html` перед каждой пробой), `index.html` не редактировать.
- Локальный сервер: `py -m http.server 8765 --bind 127.0.0.1` в фоне из корня репозитория; после перезапуска приложения сервер и сессии playwright-cli умирают — поднимать заново.
- `git push` при «Internal Server Error» (500 от GitHub) повторить через несколько секунд; никогда не `--force`.
- Сообщение коммита: заголовок, ПУСТАЯ строка, тело — без пустой строки тело склеивается с заголовком.
- «Shell cwd was reset» при репозитории вне рабочей папки сессии — не ошибка; лучше открывать сессию прямо в папке репозитория.
- Сеть песочницы Bash: разрешённые домены — в `.claude/settings.json` → `sandbox.network.allowedDomains` (сейчас fonts.googleapis.com, fonts.gstatic.com).
- Пробы на ПК: `py _clean_probe.py <probe>.js out.txt` (headless Chrome, CDN живой) — облачные пробы тоже идут здесь. `PROBE_TIMEOUT=<с>` (по умолчанию 120), `PROBE_PORT=<n>` — свой порт и страница, чтобы два прогона (или субагент) не столкнулись. Не запускать прогон через `(… &)` — умирает вместе с оболочкой; только `run_in_background`.
- Окно headless-проб по умолчанию 900 px: правила `@media (max-width: 520px)` там не срабатывают, даже если проба сужает элемент вьюпорта. Для них `PROBE_WINDOW=500,800` (innerWidth 512) — или встроенный браузер (`resize_window` 375 / 320).
- curl к Google даёт HTTP 000 / `CRYPT_E_REVOCATION_OFFLINE` — это schannel не может проверить отзыв сертификата; лечится `ssl-no-revoke` в `~/.curlrc` (уже добавлено) или флагом `--ssl-no-revoke`.
