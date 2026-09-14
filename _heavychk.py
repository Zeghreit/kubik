# Stage 2 of the UV plan: what a real textured model costs.
#
# REAL WALL CLOCK, NO --virtual-time-budget, RESULTS BY POST - the shape
# _prof_probe.py and _time_probe.py already use, and the reason is the whole
# point of this probe. The first version of this runner was copied from
# _texchk.py, which uses virtual time and --dump-dom, and every single timing
# came back "0ms": under virtual time performance.now() does not advance
# across synchronous work, so a rebuild of a 160-face shell measured as free.
# The counts and the byte sizes were real; the clock was not.
import io, os, shutil, sys, tempfile, subprocess, threading
import http.server, socketserver

ROOT = r'C:\Users\a.bodrov\Projects\kubik'
PROF = tempfile.mkdtemp(prefix='_heavy_prof_')
CHROME = r'C:\Program Files\Google\Chrome\Application\chrome.exe'
PORT = 8877
TARGET = sys.argv[1] if len(sys.argv) > 1 else 'index.html'
OUT = sys.argv[2] if len(sys.argv) > 2 else '_heavychk_out.txt'

src = io.open(os.path.join(ROOT, TARGET), encoding='utf-8').read()
js = io.open(os.path.join(ROOT, '_heavychk.js'), encoding='utf-8').read()
assert '</body>' in src
io.open(os.path.join(ROOT, '_heavychk.html'), 'w', encoding='utf-8', newline='').write(
    src.replace('</body>', '<script>\n' + js + '\n</script>\n</body>', 1))

result = {'text': None}
done = threading.Event()

class H(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *a, **kw):
        super().__init__(*a, directory=ROOT, **kw)
    def log_message(self, *a):
        pass
    def do_POST(self):
        n = int(self.headers.get('Content-Length', 0))
        result['text'] = self.rfile.read(n).decode('utf-8', 'replace')
        self.send_response(204)
        self.end_headers()
        done.set()

socketserver.TCPServer.allow_reuse_address = True
srv = socketserver.TCPServer(('127.0.0.1', PORT), H)
threading.Thread(target=srv.serve_forever, daemon=True).start()

url = 'http://127.0.0.1:%d/_heavychk.html?debug=1' % PORT
cmd = [CHROME, '--headless=new', '--disable-gpu-sandbox', '--no-sandbox',
       '--enable-unsafe-swiftshader', '--use-angle=swiftshader',
       '--window-size=900,700', '--user-data-dir=' + PROF,
       # Shared on purpose, like _prof_probe: state fresh, network warm. The
       # app pulls three.js from a CDN on every load.
       '--disk-cache-dir=' + os.path.join(ROOT, '_httpcache'),
       '--no-first-run', '--no-default-browser-check', '--disable-sync',
       '--disable-background-networking', '--disable-component-update',
       '--disable-default-apps', '--disable-extensions', '--metrics-recording-only',
       '--mute-audio',
       url]
p = subprocess.Popen(cmd, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
ok = done.wait(timeout=300)
try:
    p.terminate()
    p.wait(timeout=20)
except Exception:
    p.kill()
srv.shutdown()
shutil.rmtree(PROF, ignore_errors=True)

txt = result['text'] if ok and result['text'] else 'NO PROBE OUTPUT (timed out)'
io.open(os.path.join(ROOT, OUT), 'w', encoding='utf-8').write(txt)
print(txt)
