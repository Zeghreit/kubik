import io, os, shutil, tempfile, sys, subprocess, threading
import http.server, socketserver
# The console is cp1251: one '╭' in a result killed the final print (the file
# was already written, but the run looked dead).
sys.stdout.reconfigure(errors='replace')

ROOT = r'C:\Users\a.bodrov\Projects\kubik'
# A FRESH profile of this probe's own. Sharing Chrome's default profile
# makes the run exit in seconds whenever a Chrome is open; a FIXED
# directory makes the next run open this run's autosaved scene.
PROF = tempfile.mkdtemp(prefix='_prof_')
CHROME = r'C:\Program Files\Google\Chrome\Application\chrome.exe'
PORT = int(os.environ.get('PROBE_PORT', '8859'))   # its own port and page, so two runs can share the PC
PAGE = '_clean_probe.html' if PORT == 8859 else '_clean_probe_%d.html' % PORT
JS = sys.argv[1] if len(sys.argv) > 1 else '_clean_probe.js'
OUT = sys.argv[2] if len(sys.argv) > 2 else '_clean_out.txt'

src = io.open(os.path.join(ROOT, 'index.html'), encoding='utf-8').read()
js = io.open(os.path.join(ROOT, JS), encoding='utf-8').read()
assert '</body>' in src
io.open(os.path.join(ROOT, PAGE), 'w', encoding='utf-8', newline='').write(
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
        body = self.rfile.read(n).decode('utf-8', 'replace')
        # Only a final post ends the run - /result, or _opbarchk's /report,
        # or _boolchk's /done; any other path is progress (_punchperf's /p,
        # _boolchk's /mark).
        if self.path.split('?')[0] not in ('/result', '/report', '/done'):
            print('.. ' + body, flush=True)
            self.send_response(204)
            self.end_headers()
            return
        result['text'] = body
        self.send_response(204)
        self.end_headers()
        done.set()

socketserver.TCPServer.allow_reuse_address = True
srv = socketserver.TCPServer(('127.0.0.1', PORT), H)
threading.Thread(target=srv.serve_forever, daemon=True).start()

url = 'http://127.0.0.1:%d/%s?debug=1' % (PORT, PAGE)
cmd = [CHROME, '--headless=new', '--disable-gpu-sandbox', '--no-sandbox',
       '--enable-unsafe-swiftshader', '--use-angle=swiftshader',
       # PROBE_WINDOW=500,800 makes the max-width: 520px rules fire (innerWidth 512).
       '--window-size=' + os.environ.get('PROBE_WINDOW', '900,700'), '--user-data-dir=' + PROF,
       # SHARED, and deliberately not the fresh profile: the app pulls three.js
       # from a CDN on every load, and a cold cache is what actually broke
       # _imp_probe. State fresh, network warm.
       '--disk-cache-dir=' + os.path.join(ROOT, '_httpcache'),
       '--no-first-run', '--no-default-browser-check', '--disable-sync',
       '--disable-background-networking', '--disable-component-update',
       '--disable-default-apps', '--disable-extensions', '--metrics-recording-only',
       '--mute-audio',
       url]
p = subprocess.Popen(cmd, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
ok = done.wait(timeout=float(os.environ.get('PROBE_TIMEOUT', '120')))
try:
    p.terminate(); p.wait(timeout=20)
except Exception:
    p.kill()
srv.shutdown()
shutil.rmtree(PROF, ignore_errors=True)

txt = result['text'] if ok and result['text'] else 'NO PROBE OUTPUT (timed out)'
io.open(os.path.join(ROOT, OUT), 'w', encoding='utf-8').write(txt)
print(txt)
