/* Почему не появился __kubik: ошибка загрузки, или что-то в самом файле. */
(function () {
  const OUT = [];
  const post = (p, b) => { try { const x = new XMLHttpRequest(); x.open('POST', p, true); x.send(b); } catch (e) {} };
  window.addEventListener('error', (e) => {
    if (e.target && e.target.tagName === 'SCRIPT') {
      OUT.push('FAIL script failed to load: ' + (e.target.src || '(inline)'));
      return;
    }
    OUT.push('FAIL onerror: ' + e.message + ' @ ' + e.filename + ':' + e.lineno + ':' + e.colno);
  }, true);
  window.addEventListener('unhandledrejection', (e) => {
    OUT.push('FAIL unhandledrejection: ' + (e.reason && e.reason.message ? e.reason.message : e.reason));
  });
  setTimeout(() => {
    const K = window.__kubik;
    OUT.push('INFO THREE=' + (typeof window.THREE) + ' __kubik=' + (typeof K));
    if (K) {
      OUT.push('INFO App=' + (typeof K.App) +
               ' uvSecondPointer=' + (typeof K.uvSecondPointer) +
               ' HUB_TOOLS_WORLD=' + (typeof K.HUB_TOOLS_WORLD) +
               ' uvPointerCount=' + K.uvPointerCount);
    }
    OUT.push('VERDICT=' + (OUT.some(l => l.startsWith('FAIL')) ? 'FAIL' : 'PASS'));
    post('/done', OUT.join('\n'));
  }, 6000);
})();
