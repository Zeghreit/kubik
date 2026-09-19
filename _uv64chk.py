# -*- coding: utf-8 -*-
"""v2.58: UV-СЂРµР¶РёРј РїРµСЂРµСЃС‚Р°Р» Р±С‹С‚СЊ СЂРµРЅС‚РіРµРЅРѕРј. Run: py -3 _uv64chk.py [target.html]"""
import io, os, shutil, subprocess, sys, tempfile, threading, time
import http.server, socketserver

ROOT = r'C:\Users\a.bodrov\Projects\kubik'
PROF = tempfile.mkdtemp(prefix='_prof_')
CHROME = r'C:\Program Files\Google\Chrome\Application\chrome.exe'
PORT = 8946
TARGET = sys.argv[1] if len(sys.argv) > 1 else 'index.html'
RESULT = {}

src = io.open(os.path.join(ROOT, TARGET), encoding='utf-8').read()
js = io.open(os.path.join(ROOT, '_uv64chk.js'), encoding='utf-8').read()
io.open(os.path.join(ROOT, '_uv64chk.html'), 'w', encoding='utf-8', newline='').write(
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

url = 'http://127.0.0.1:%d/_uv64chk.html?debug=1&t=%d' % (PORT, int(time.time()))
cmd = [CHROME, '--headless=new', '--no-sandbox', '--user-data-dir=' + PROF,
       '--no-first-run', '--no-default-browser-check', '--disable-sync',
       '--disable-background-networking', '--disable-component-update',
       '--disable-default-apps', '--disable-extensions', '--metrics-recording-only',
       '--mute-audio', '--enable-unsafe-swiftshader', '--use-angle=swiftshader',
       '--hide-scrollbars', '--window-size=900,900', url]
p = subprocess.Popen(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
t0 = time.time()
while time.time() - t0 < 150 and 'txt' not in RESULT:
    time.sleep(0.3)
p.kill()
srv.shutdown()
shutil.rmtree(PROF, ignore_errors=True)

txt = RESULT.get('txt')
if txt is None:
    txt = 'NO REPORT after 150s\nlast mark:\n' + RESULT.get('mark', '(none - РЅРµ РґРѕС€Р»Рѕ РґРѕ boot)')
rfails = len([x for x in txt.split('\n')
              if x.startswith('FAIL') or x.startswith('THREW') or x.startswith('NO REPORT')])
txt = '\n'.join([x for x in txt.split('\n') if not x.startswith('VERDICT=')])
out = txt + '\nVERDICT=%s (%d failed)' % ('FAIL' if rfails else 'PASS', rfails)
io.open(os.path.join(ROOT, '_uv64chk_out.txt'), 'w', encoding='utf-8').write(out + '\n')
print('TARGET %s\n%s' % (TARGET, out))




