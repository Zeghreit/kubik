import io, os, re, shutil, subprocess, tempfile, threading, functools
import http.server, socketserver

ROOT = r'C:\Users\a.bodrov\Projects\kubik'
CHROME = r'C:\Program Files\Google\Chrome\Application\chrome.exe'
PORT = 8841

src = io.open(os.path.join(ROOT, 'index.html'), encoding='utf-8').read()
js = io.open(os.path.join(ROOT, '_imp_probe.js'), encoding='utf-8').read()
assert '</body>' in src
io.open(os.path.join(ROOT, '_imp_probe.html'), 'w', encoding='utf-8', newline='').write(
    src.replace('</body>', '<script>\n' + js + '\n</script>\n</body>', 1))

Handler = functools.partial(http.server.SimpleHTTPRequestHandler, directory=ROOT)
class Quiet(Handler.func):
    def log_message(self, *a): pass
srv = socketserver.TCPServer(('127.0.0.1', PORT), functools.partial(Quiet, directory=ROOT))
threading.Thread(target=srv.serve_forever, daemon=True).start()

url = 'http://127.0.0.1:%d/_imp_probe.html?debug=1' % PORT
# ITS OWN PROFILE, AND A FRESH ONE. Without --user-data-dir this shares the
# default one, and a Chrome the user has open makes the headless run exit in
# four seconds with an empty DOM - which is exactly what "the known
# _imp_probe flake" has looked like every time it was written down.
#
# FRESH, not fixed: the app autosaves the document into localStorage, so a
# profile that survives from one run to the next means the probe opens the
# PREVIOUS run's scene and counts its objects. A fixed dir made this probe
# report "2 objects added" and a changed face count on its second run.
prof = tempfile.mkdtemp(prefix='_imp_prof_')
cmd = [CHROME, '--headless=new', '--disable-gpu-sandbox', '--no-sandbox',
       '--user-data-dir=' + prof, '--disk-cache-dir=' + os.path.join(ROOT, '_httpcache'), '--no-first-run', '--no-default-browser-check', '--disable-sync',
       '--disable-background-networking', '--disable-component-update',
       '--disable-default-apps', '--disable-extensions', '--metrics-recording-only',
       '--mute-audio',
       '--enable-unsafe-swiftshader', '--use-angle=swiftshader',
       '--window-size=900,700', '--virtual-time-budget=90000',
       '--dump-dom', url]
r = subprocess.run(cmd, capture_output=True, text=True, encoding='utf-8', errors='replace', timeout=240)
srv.shutdown()
shutil.rmtree(prof, ignore_errors=True)

import html as _html
m = re.search(r'<pre id="probeOut">(.*?)</pre>', r.stdout, re.S)
if m:
    txt = _html.unescape(m.group(1)).replace('<<<PROBE', '').replace('PROBE>>>', '').strip()
    io.open(os.path.join(ROOT, '_imp_out.txt'), 'w', encoding='utf-8').write(txt)
else:
    io.open(os.path.join(ROOT, '_imp_out.txt'), 'w', encoding='utf-8').write(
        'NO PROBE OUTPUT\nstderr tail:\n' + (r.stderr or '')[-1500:])
