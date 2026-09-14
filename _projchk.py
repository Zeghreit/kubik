
# v2.37: does Save under a name hold a textured model.
#
# Real wall clock, results by POST, threaded server. All three were learned
# the hard way on _texchk one version ago: IndexedDB is off-thread I/O and
# never completes under --virtual-time-budget, and a single-threaded server
# lets one open socket block the POST that carries the result.
import io, os, shutil, sys, tempfile, subprocess, threading

ROOT = r'C:\Users\a.bodrov\Projects\kubik'
TARGET = sys.argv[1] if len(sys.argv) > 1 else 'index.html'
OUT = sys.argv[2] if len(sys.argv) > 2 else '_projchk_out.txt'
# Fresh profile: a stale one carries the previous run's IndexedDB, and a
# database that already holds the record would let a build that never writes
# anything pass section 1.
PROF = tempfile.mkdtemp(prefix='_projchk_prof_')
CHROME = r'C:\Program Files\Google\Chrome\Application\chrome.exe'
PORT = 8879

src = io.open(os.path.join(ROOT, TARGET), encoding='utf-8').read()
js = io.open(os.path.join(ROOT, '_projchk.js'), encoding='utf-8').read()
assert '</body>' in src
io.open(os.path.join(ROOT, '_projchk.html'), 'w', encoding='utf-8', newline='').write(
    src.replace('</body>', '<script>\n' + js + '\n</script>\n</body>', 1))

import http.server, socketserver
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


class Srv(socketserver.ThreadingTCPServer):
    allow_reuse_address = True
    daemon_threads = True

    def handle_error(self, *a):
        pass


srv = Srv(('127.0.0.1', PORT), H)
threading.Thread(target=srv.serve_forever, daemon=True).start()

url = 'http://127.0.0.1:%d/_projchk.html?debug=1' % PORT
cmd = [CHROME, '--headless=new', '--user-data-dir=' + PROF,
       '--no-first-run', '--no-default-browser-check', '--disable-sync',
       '--disable-background-networking', '--disable-component-update',
       '--disable-default-apps', '--disable-extensions', '--metrics-recording-only',
       '--mute-audio', '--disable-gpu-sandbox', '--no-sandbox',
       '--enable-unsafe-swiftshader', '--use-angle=swiftshader',
       '--disk-cache-dir=' + os.path.join(ROOT, '_httpcache'),
       '--window-size=512,900', url]
p = subprocess.Popen(cmd, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
ok = done.wait(timeout=300)
try:
    p.terminate()
    p.wait(timeout=20)
except Exception:
    p.kill()
srv.shutdown()
shutil.rmtree(PROF, ignore_errors=True)

txt = result['text'] if ok and result['text'] else 'NO PROBE OUTPUT (timed out)\nVERDICT=FAIL (no output)'
io.open(os.path.join(ROOT, OUT), 'w', encoding='utf-8').write(txt)
print(txt)
