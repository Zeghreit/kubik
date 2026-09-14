
# The texture probe.
#
# REAL WALL CLOCK, NO --virtual-time-budget, RESULTS BY POST.
#
# This runner used to use virtual time and --dump-dom, and it worked right up
# until the store moved to IndexedDB at 2.36 - then section 6c hung every run.
# IndexedDB is real off-thread I/O: under virtual time the clock races to the
# end of the budget before a single request completes, so the watchdog fires
# first and every section after it tests nothing. Same trap _prof_probe.py
# documented for performance.now(), and the same one this probe hit for image
# decode in GLTFLoader. Anything asynchronous and off the main thread needs a
# real clock.
import io, os, shutil, sys, tempfile, subprocess, threading

ROOT = r'C:\Users\a.bodrov\Projects\kubik'
TARGET = sys.argv[1] if len(sys.argv) > 1 else 'index.html'
OUT = sys.argv[2] if len(sys.argv) > 2 else '_texchk_out.txt'
# A FRESH profile of this probe's own: a stale one carries an IndexedDB from
# the previous run, and a store that was already full would let a build that
# never writes anything pass section 6c.
PROF = tempfile.mkdtemp(prefix='_texchk_prof_')
CHROME = r'C:\Program Files\Google\Chrome\Application\chrome.exe'
PORT = 8873

src = io.open(os.path.join(ROOT, TARGET), encoding='utf-8').read()
js = io.open(os.path.join(ROOT, '_texchk.js'), encoding='utf-8').read()
assert '</body>' in src
io.open(os.path.join(ROOT, '_texchk.html'), 'w', encoding='utf-8', newline='').write(
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


# THREADED, and the reason is a real hang. A plain TCPServer serves one
# connection at a time, so a page that leaves a socket open - which the
# no-IndexedDB build did - blocks the POST that carries the result forever,
# and the probe reports NO PROBE OUTPUT as though the build were dead.
class Srv(socketserver.ThreadingTCPServer):
    allow_reuse_address = True
    daemon_threads = True
    def handle_error(self, *a):
        pass


srv = Srv(('127.0.0.1', PORT), H)
threading.Thread(target=srv.serve_forever, daemon=True).start()

url = 'http://127.0.0.1:%d/_texchk.html?debug=1' % PORT
cmd = [CHROME, '--headless=new', '--user-data-dir=' + PROF,
       '--no-first-run', '--no-default-browser-check', '--disable-sync',
       '--disable-background-networking', '--disable-component-update',
       '--disable-default-apps', '--disable-extensions', '--metrics-recording-only',
       '--mute-audio', '--disable-gpu-sandbox', '--no-sandbox',
       '--enable-unsafe-swiftshader', '--use-angle=swiftshader',
       # Shared cache on purpose: the app pulls three.js from a CDN on load,
       # and only the profile has to be fresh.
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
