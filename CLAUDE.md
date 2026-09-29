# Kubik

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
- curl к Google даёт HTTP 000 / `CRYPT_E_REVOCATION_OFFLINE` — это schannel не может проверить отзыв сертификата; лечится `ssl-no-revoke` в `~/.curlrc` (уже добавлено) или флагом `--ssl-no-revoke`.
