# -*- coding: utf-8 -*-
"""v2.74: New scene - one cube, no saved model open, one Undo back.
Run: py -3 _cv277.py [target.html] [W] [H]   (default 412x915, his phone)"""
import io, os, shutil, subprocess, sys, tempfile, threading, time
import http.server, socketserver

ROOT = r'C:\Users\a.bodrov\Projects\kubik'
PROF = tempfile.mkdtemp(prefix='_prof_')
CHROME = r'C:\Program Files\Google\Chrome\Application\chrome.exe'
PORT = 8982
TARGET = sys.argv[1] if len(sys.argv) > 1 else 'index.html'
WIN_W = sys.argv[2] if len(sys.argv) > 2 else '412'
WIN_H = sys.argv[3] if len(sys.argv) > 3 else '915'
RESULT = {}

src = io.open(os.path.join(ROOT, TARGET), encoding='utf-8').read()
js = io.open(os.path.join(ROOT, '_cv277.js'), encoding='utf-8').read()
io.open(os.path.join(ROOT, '_cv277.html'), 'w', encoding='utf-8', newline='').write(
    src.replace('</body>', '<script>\n' + js + '\n</script>\n</body>', 1))


class H(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *a, **k):
        super().__init__(*a, directory=ROOT, **k)

    def log_message(self, *a):
        pass

    def do_POST(self):
        n = int(self.headers.get('Content-Length') or 0)
        body = self.rfile.read(n).decode('utf-8', 'replace')
        RESULT['mark' if self.path.startswith('/mark') else 'txt'] = body
        self.send_response(204)
        self.end_headers()


socketserver.TCPServer.allow_reuse_address = True
srv = socketserver.TCPServer(('127.0.0.1', PORT), H)
threading.Thread(target=srv.serve_forever, daemon=True).start()

url = 'http://127.0.0.1:%d/_cv277.html?debug=1&t=%d' % (PORT, int(time.time()))
cmd = [CHROME, '--headless=new', '--no-sandbox', '--user-data-dir=' + PROF,
       '--no-first-run', '--no-default-browser-check', '--disable-sync',
       '--disable-background-networking', '--disable-component-update',
       '--disable-default-apps', '--disable-extensions', '--metrics-recording-only',
       '--mute-audio', '--enable-unsafe-swiftshader', '--use-angle=swiftshader',
       '--hide-scrollbars', '--window-size=%s,%s' % (WIN_W, WIN_H), url]
p = subprocess.Popen(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
t0 = time.time()
while time.time() - t0 < 150 and 'txt' not in RESULT:
    time.sleep(0.3)
p.kill()
srv.shutdown()
shutil.rmtree(PROF, ignore_errors=True)

txt = RESULT.get('txt')
if txt is None:
    txt = 'NO REPORT after 150s\nlast mark:\n' + RESULT.get('mark', '(none - never reached boot)')
rfails = len([x for x in txt.split('\n')
              if x.startswith('FAIL') or x.startswith('THREW') or x.startswith('NO REPORT')])
txt = '\n'.join([x for x in txt.split('\n') if not x.startswith('VERDICT=')])
out = txt + '\nVERDICT=%s (%d failed)' % ('FAIL' if rfails else 'PASS', rfails)
io.open(os.path.join(ROOT, '_cv277_out.txt'), 'w', encoding='utf-8').write(out + '\n')
print('TARGET %s  %sx%s\n%s' % (TARGET, WIN_W, WIN_H, out))
