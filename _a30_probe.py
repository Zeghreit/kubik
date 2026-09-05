import io, os, shutil, tempfile, re, subprocess, threading, functools
import http.server, socketserver

ROOT = r'C:\Users\a.bodrov\Projects\kubik'
# A FRESH profile of this probe's own. Sharing Chrome's default profile
# makes the run exit in seconds whenever a Chrome is open; a FIXED
# directory makes the next run open this run's autosaved scene.
PROF = tempfile.mkdtemp(prefix='_prof_')
CHROME = r'C:\Program Files\Google\Chrome\Application\chrome.exe'
PORT = 8849

src = io.open(os.path.join(ROOT, 'index.html'), encoding='utf-8').read()
js = io.open(os.path.join(ROOT, '_a30_probe.js'), encoding='utf-8').read()
assert '</body>' in src
io.open(os.path.join(ROOT, '_a30_probe.html'), 'w', encoding='utf-8', newline='').write(
    src.replace('</body>', '<script>\n' + js + '\n</script>\n</body>', 1))

Handler = functools.partial(http.server.SimpleHTTPRequestHandler, directory=ROOT)
class Quiet(Handler.func):
    def log_message(self, *a): pass
srv = socketserver.TCPServer(('127.0.0.1', PORT), functools.partial(Quiet, directory=ROOT))
threading.Thread(target=srv.serve_forever, daemon=True).start()

url = 'http://127.0.0.1:%d/_a30_probe.html?debug=1' % PORT
cmd = [CHROME, '--headless=new', '--user-data-dir=' + PROF, '--disk-cache-dir=' + os.path.join(ROOT, '_httpcache'), '--no-first-run', '--no-default-browser-check', '--disable-sync',
       '--disable-background-networking', '--disable-component-update',
       '--disable-default-apps', '--disable-extensions', '--metrics-recording-only',
       '--mute-audio', '--disable-gpu-sandbox', '--no-sandbox',
       '--enable-unsafe-swiftshader', '--use-angle=swiftshader',
       '--window-size=393,852', '--virtual-time-budget=25000',
       '--dump-dom', url]
r = subprocess.run(cmd, capture_output=True, text=True, encoding='utf-8', errors='replace', timeout=180)
srv.shutdown()
shutil.rmtree(PROF, ignore_errors=True)

import html as _html
m = re.search(r'<pre id="probeOut">(.*?)</pre>', r.stdout, re.S)
txt = (_html.unescape(m.group(1)).replace('<<<PROBE', '').replace('PROBE>>>', '').strip()
       if m else 'NO PROBE OUTPUT\nstderr tail:\n' + (r.stderr or '')[-1500:])
io.open(os.path.join(ROOT, '_a30_out.txt'), 'w', encoding='utf-8').write(txt)
print(txt)
