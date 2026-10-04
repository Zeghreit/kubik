# -*- coding: utf-8 -*-
"""v3.10 embed protocol probe. Run: py -3 _embedchk.py  -> _embedchk_out.txt
The host page _embedchk.html is served from http://localhost:PORT and drives
index.html?embed=1 in iframes over postMessage only. 127.0.0.1 on the same
port is the 'foreign origin'."""
import io, os, shutil, subprocess, sys, tempfile, threading, time
import http.server, socketserver

ROOT = r'C:\Users\a.bodrov\Projects\kubik'
PROF = tempfile.mkdtemp(prefix='_prof_')
CHROME = r'C:\Program Files\Google\Chrome\Application\chrome.exe'
PORT = 8996
RESULT = {}
LIMIT = 900
PAGE = sys.argv[1] if len(sys.argv) > 1 else '_embedchk.html'
OUT = '_embedchk_out.txt' if PAGE == '_embedchk.html' else PAGE.replace('.html', '_out.txt')

class H(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *a, **k):
        super().__init__(*a, directory=ROOT, **k)
    def log_message(self, *a):
        pass
    def end_headers(self):
        self.send_header('Cache-Control', 'no-store')
        super().end_headers()
    def do_POST(self):
        n = int(self.headers.get('Content-Length') or 0)
        body = self.rfile.read(n).decode('utf-8', 'replace')
        RESULT['mark' if self.path.startswith('/mark') else 'txt'] = body
        if self.path.startswith('/mark'):
            io.open(os.path.join(ROOT, '_embedchk_mark.txt'), 'w', encoding='utf-8').write(body)
        self.send_response(204)
        self.end_headers()

class S(socketserver.ThreadingMixIn, socketserver.TCPServer):
    daemon_threads = True
    allow_reuse_address = True

srv = S(('', PORT), H)
threading.Thread(target=srv.serve_forever, daemon=True).start()

url = 'http://localhost:%d/%s?t=%d' % (PORT, PAGE, int(time.time()))
cmd = [CHROME, '--headless=new', '--no-sandbox', '--user-data-dir=' + PROF,
       '--no-first-run', '--no-default-browser-check', '--disable-sync',
       '--disable-background-networking', '--disable-component-update',
       '--disable-default-apps', '--disable-extensions', '--metrics-recording-only',
       '--mute-audio', '--enable-unsafe-swiftshader', '--use-angle=swiftshader',
       '--hide-scrollbars', '--window-size=1000,900', url]
p = subprocess.Popen(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
t0 = time.time()
while time.time() - t0 < LIMIT and 'txt' not in RESULT:
    time.sleep(0.5)
p.kill()
srv.shutdown()
shutil.rmtree(PROF, ignore_errors=True)

txt = RESULT.get('txt')
if txt is None:
    txt = 'NO REPORT after %ds\nlast mark: %s' % (LIMIT, RESULT.get('mark', '(none)'))
lines = txt.split('\n')
fails = len([x for x in lines if x.startswith(('FAIL', 'THREW', 'NO REPORT'))])
passes = len([x for x in lines if x.startswith('PASS')])
out = txt + '\nVERDICT=%s (%d passed, %d failed, %ds)' % ('FAIL' if fails else 'PASS', passes, fails, time.time() - t0)
io.open(os.path.join(ROOT, OUT), 'w', encoding='utf-8').write(out + '\n')
print(out)
