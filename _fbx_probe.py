import io, os, shutil, sys, tempfile, re, subprocess, threading
import http.server, socketserver
import urllib.request

ROOT = r'C:\Users\a.bodrov\Projects\kubik'
TARGET = sys.argv[1] if len(sys.argv) > 1 else 'index.html'
OUT = sys.argv[2] if len(sys.argv) > 2 else '_fbx_out.txt'
PROF = tempfile.mkdtemp(prefix='_fbx_prof_')
CHROME = r'C:\Program Files\Google\Chrome\Application\chrome.exe'
PORT = 8873

# three.js's own example models. Fetched once and left in the tree; they are
# megabytes of binary and are NOT committed (see .gitignore / the -f list).
FIXTURES = {
    '_fbxfix_nurbs.fbx': 'nurbs.fbx',
    '_fbxfix_samba.fbx': 'Samba%20Dancing.fbx',
    '_fbxfix_bunny.fbx': 'stanford-bunny.fbx',
}
BASE = 'https://raw.githubusercontent.com/mrdoob/three.js/r184/examples/models/fbx/'
# The one small mesh fixture is written, not downloaded - three ships nothing
# under Kubik's budget, so every real file it has proves only a refusal.
subprocess.run([sys.executable, '-u', os.path.join(ROOT, '_mkfbx.py')], check=True)
for local, remote in FIXTURES.items():
    p = os.path.join(ROOT, local)
    if os.path.exists(p) and os.path.getsize(p) > 1000:
        continue
    print('fetching %s ...' % local)
    urllib.request.urlretrieve(BASE + remote, p)

src = io.open(os.path.join(ROOT, TARGET), encoding='utf-8').read()
js = io.open(os.path.join(ROOT, '_fbx_probe.js'), encoding='utf-8').read()
assert '</body>' in src
io.open(os.path.join(ROOT, '_fbx_probe.html'), 'w', encoding='utf-8', newline='').write(
    src.replace('</body>', '<script>\n' + js + '\n</script>\n</body>', 1))

class Quiet(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *a, **kw):
        super().__init__(*a, directory=ROOT, **kw)
    def log_message(self, *a): pass

socketserver.TCPServer.allow_reuse_address = True
srv = socketserver.TCPServer(('127.0.0.1', PORT), Quiet)
srv.daemon_threads = True
threading.Thread(target=srv.serve_forever, daemon=True).start()

# NO shared --disk-cache-dir: a stale _httpcache makes Chrome exit with an
# empty DOM and an empty stderr, which reads exactly like a broken build.
url = 'http://127.0.0.1:%d/_fbx_probe.html?debug=1' % PORT
cmd = [CHROME, '--headless=new', '--user-data-dir=' + PROF,
       '--no-first-run', '--no-default-browser-check', '--disable-sync',
       '--disable-background-networking', '--disable-component-update',
       '--disable-default-apps', '--disable-extensions', '--metrics-recording-only',
       '--mute-audio', '--disable-gpu-sandbox', '--no-sandbox',
       '--enable-unsafe-swiftshader', '--use-angle=swiftshader',
       '--window-size=512,900', '--virtual-time-budget=120000', '--dump-dom', url]
r = subprocess.run(cmd, capture_output=True, text=True, encoding='utf-8',
                   errors='replace', timeout=300)
srv.shutdown()
shutil.rmtree(PROF, ignore_errors=True)

import html as _html
m = re.search(r'<pre id="probeOut">(.*?)</pre>', r.stdout, re.S)
txt = (_html.unescape(m.group(1)).replace('<<<PROBE', '').replace('PROBE>>>', '').strip()
       if m else 'NO PROBE OUTPUT\nstderr tail:\n' + (r.stderr or '')[-1500:])
io.open(os.path.join(ROOT, OUT), 'w', encoding='utf-8').write(txt)
print(txt)
