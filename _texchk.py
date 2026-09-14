import io, os, shutil, sys, tempfile, re, subprocess, threading, functools
import http.server, socketserver

ROOT = r'C:\Users\a.bodrov\Projects\kubik'
TARGET = sys.argv[1] if len(sys.argv) > 1 else 'index.html'
OUT = sys.argv[2] if len(sys.argv) > 2 else '_texchk_out.txt'
# A FRESH profile of this probe's own, and NO shared --disk-cache-dir: a
# stale _httpcache from an earlier run makes Chrome exit with an empty DOM
# and an empty stderr, which reads exactly like a broken build.
PROF = tempfile.mkdtemp(prefix='_texchk_prof_')
CHROME = r'C:\Program Files\Google\Chrome\Application\chrome.exe'
PORT = 8873

src = io.open(os.path.join(ROOT, TARGET), encoding='utf-8').read()
js = io.open(os.path.join(ROOT, '_texchk.js'), encoding='utf-8').read()
assert '</body>' in src
io.open(os.path.join(ROOT, '_texchk.html'), 'w', encoding='utf-8', newline='').write(
    src.replace('</body>', '<script>\n' + js + '\n</script>\n</body>', 1))

class Quiet(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *a, **kw):
        super().__init__(*a, directory=ROOT, **kw)
    def log_message(self, *a): pass

socketserver.TCPServer.allow_reuse_address = True
srv = socketserver.TCPServer(('127.0.0.1', PORT), Quiet)
threading.Thread(target=srv.serve_forever, daemon=True).start()

url = 'http://127.0.0.1:%d/_texchk.html?debug=1' % PORT
cmd = [CHROME, '--headless=new', '--user-data-dir=' + PROF,
       '--no-first-run', '--no-default-browser-check', '--disable-sync',
       '--disable-background-networking', '--disable-component-update',
       '--disable-default-apps', '--disable-extensions', '--metrics-recording-only',
       '--mute-audio', '--disable-gpu-sandbox', '--no-sandbox',
       '--enable-unsafe-swiftshader', '--use-angle=swiftshader',
       '--window-size=512,900', '--virtual-time-budget=90000', '--dump-dom', url]
r = subprocess.run(cmd, capture_output=True, text=True, encoding='utf-8',
                   errors='replace', timeout=240)
srv.shutdown()
shutil.rmtree(PROF, ignore_errors=True)

import html as _html
m = re.search(r'<pre id="probeOut">(.*?)</pre>', r.stdout, re.S)
txt = (_html.unescape(m.group(1)).replace('<<<PROBE', '').replace('PROBE>>>', '').strip()
       if m else 'NO PROBE OUTPUT\nstderr tail:\n' + (r.stderr or '')[-1500:])
io.open(os.path.join(ROOT, OUT), 'w', encoding='utf-8').write(txt)
print(txt)
