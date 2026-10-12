# Kubik — orientation for a new session

Single self-contained HTML file, three.js from a CDN, no build step. Repo at
`C:\Users\a.bodrov\Projects\kubik` (Windows, reached via Desktop Commander).
Read `CURRENT_STATE.md` in the repo first — it is authoritative and it wins
over anything else.

## Getting a build onto Zeghreit's iPhone / iPad

He tests on iOS. Three routes, in the order to reach for them:

**1. GitHub Pages — `https://zeghreit.github.io/kubik/`**
The normal one. Push and it deploys in about 90 seconds.

**2. raw.githack.com — the one that saved an evening**
```
https://raw.githack.com/Zeghreit/kubik/main/index.html
```
Serves the repo's file with a real HTML content-type over HTTPS, straight
from the git ref. **Needs only a push, no Pages build.** Works on cellular.
This is the answer when Pages is broken, and it is also faster for
iterating — a push is live immediately with no build queue.
A QR page for it lives at `_qr_dev.html` (untracked, served locally).

**3. LAN from the PC — `http://192.168.1.55:8765`**
`python -m http.server 8765 --bind 0.0.0.0` in the repo. Serves the working
tree, so no commit at all is needed. **But it fought us for an hour:**
- Windows classifies his Wi-Fi as **Public**, so a `-Profile Private`
  firewall rule does nothing. Use `-Profile Any` / plain `netsh`.
- The rule needs elevation. Adding it is a security setting, so hand him a
  `.cmd` to right-click → run as administrator rather than doing it.
- Even with the rule in place and the server logging correctly, his phone's
  packets never arrived — almost certainly router client isolation.
Try route 2 before spending time here.

**Storage is per ORIGIN.** Every route above is a different origin, so each
gets its own empty `localStorage` — his models (`kubik.project.*`), autosave
(`kubik.autosave`) and material library (`kubik.materials.v1`) do not travel
between them and CANNOT be damaged by testing elsewhere. Tell him that
plainly; he worried about it. To carry work across, use the drawer's
Download .json / Open .json — the project JSON embeds its own palette, so
materials, masks and lighting ride along.

**Worth repeating to him:** his only copy of anything lives in Safari's
storage on the device, and iOS evicts that on its own. Exporting .json is
the only real backup.

## When Pages will not deploy

Seen 2026-08-26: `pages-build-deployment` #137 "Startup failure" with no
duration, then #138/#139 stuck in Queued for 20+ minutes, and **cancel
requests also did nothing**. That last part is the tell — cancels are queued
work too, so nothing repo-side can help. It is a GitHub capacity incident.
- Verify the push actually landed with `git ls-remote origin refs/heads/main`
  against `git rev-parse HEAD`. Do not trust the push output alone.
- Check what is really being served, with a cache-buster, and watch the CDN
  `age` header: climbing = stale cache, `age: 0` with old content = the
  ORIGIN itself is stale, so no build ran.
- Do not push more commits at it. Each adds another queued run.
- `.nojekyll` was added on 2026-08-26 and is correct regardless: Kubik uses
  no Jekyll feature, and Liquid parses every tracked file including the
  Markdown notes.

## Local tooling

- `python _verify.py index.html` before shipping — duplicate top-level
  declarations plus `node --check`. Always run it.
- Edit via Python patch FILES, never inline `python -c`: PowerShell mangles
  the quoting, repeatedly.
- Version bumps: anchor on the brand `<span>` (`_patch_ver.py`), never the
  bare version string — version numbers appear in code comments now.
- `_test.html` is a scratch copy of index.html plus a probe patch that
  widens the `__kubik` debug handle. Never apply the probe to index.html.
- `?debug=1` exposes `window.__kubik`. Without it there is no handle.
- `gh` CLI is NOT installed on this machine.
