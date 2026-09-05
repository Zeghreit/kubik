import io, os, re, subprocess, threading, functools, html as _html
import http.server, socketserver

ROOT = r'C:\Users\a.bodrov\Projects\kubik'
CHROME = r'C:\Program Files\Google\Chrome\Application\chrome.exe'
PORT = 8795

js = r"""
setTimeout(function () {
  var k = window.__kubik, out = [];
  try {
    out.push('App.aimAssist=' + (k.App.aimAssist === undefined ? 'gone' : k.App.aimAssist));
    out.push('ringKeys=' + k.HUB_TOOLS_WORLD.map(function (t) { return t.key; }).join(','));
    out.push('aimThresholds=' + (k.aimThresholds === undefined ? 'gone' : 'STILL THERE'));
    out.push('toggleAimAssist=' + (typeof window.toggleAimAssist));
    // A vertex tap must leave the camera exactly where it was.
    k.App.mode = 'vertex';
    if (!k.App.activeObjectId && k.App.objects.length) k.App.activeObjectId = k.App.objects[0].id;
    var obj = k.findObject(k.App.activeObjectId);
    k.ensureHelpers(obj);
    var before = k.camera.position.clone(), bt = k.orbit.target.clone();
    var topo = obj.mesh.userData.topo;
    var pa = obj.mesh.geometry.attributes.position;
    var g = topo.logicalGroups[0];
    var p = new (before.constructor)(pa.getX(g[0]), pa.getY(g[0]), pa.getZ(g[0]));
    obj.mesh.localToWorld(p);
    var sp = k.worldToScreenPx(p);
    var rect = k.renderer.domElement.getBoundingClientRect();
    k.pickVertexOnActive({ clientX: sp.x + rect.left, clientY: sp.y + rect.top });
    setTimeout(function () {
      out.push('camAnim=' + (k.camAnim ? 'RUNNING' : 'null'));
      out.push('camMoved=' + before.distanceTo(k.camera.position).toFixed(4) +
               ' targetMoved=' + bt.distanceTo(k.orbit.target).toFixed(4));
      done(out);
    }, 700);
  } catch (e) {
    out.push('ERROR=' + (e && e.stack ? e.stack.split('\n').slice(0, 3).join(' / ') : e));
    done(out);
  }
  function done(o) {
    var pre = document.createElement('pre'); pre.id = 'probeOut';
    pre.textContent = '<<<P\n' + o.join('\n') + '\nP>>>';
    document.body.appendChild(pre); document.title = 'DONE';
  }
}, 1500);
"""

src = io.open(os.path.join(ROOT, 'index.html'), encoding='utf-8').read()
io.open(os.path.join(ROOT, '_chk.html'), 'w', encoding='utf-8', newline='').write(
    src.replace('</body>', '<script>\n' + js + '\n</script>\n</body>', 1))

Handler = functools.partial(http.server.SimpleHTTPRequestHandler, directory=ROOT)
class Quiet(Handler.func):
    def log_message(self, *a): pass
srv = socketserver.TCPServer(('127.0.0.1', PORT), functools.partial(Quiet, directory=ROOT))
threading.Thread(target=srv.serve_forever, daemon=True).start()
cmd = [CHROME, '--headless=new', '--disable-gpu-sandbox', '--no-sandbox',
       '--enable-unsafe-swiftshader', '--use-angle=swiftshader',
       '--window-size=900,700', '--virtual-time-budget=20000', '--dump-dom',
       'http://127.0.0.1:%d/_chk.html?debug=1' % PORT]
r = subprocess.run(cmd, capture_output=True, text=True, encoding='utf-8',
                   errors='replace', timeout=180)
srv.shutdown()
m = re.search(r'<pre id="probeOut">(.*?)</pre>', r.stdout, re.S)
print(_html.unescape(m.group(1)).strip() if m else 'NO OUTPUT\n' + (r.stderr or '')[-900:])
