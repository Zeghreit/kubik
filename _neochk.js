/* _neochk - воспроизведение на НАСТОЯЩЕЙ библиотеке из Kubik_NeoTank.json.
   Никаких синтетических данных: _neolib.json - это materialLib того самого
   файла, с которого лезут дубли. Открываем документ трижды подряд и смотрим,
   что происходит с библиотекой. */
(function () {
  const OUT = [];
  const say = s => OUT.push(s);
  const post = (p, b) => { try { const x = new XMLHttpRequest(); x.open('POST', p, true); x.send(b); } catch (e) {} };
  function finish(extra) {
    if (extra) say(extra);
    post('/done', OUT.join('\n'));
  }

  function dump(K, tag) {
    say('--- ' + tag + ': ' + K.MATERIALS.size + ' записей ---');
    K.MATERIALS.forEach((d, id) => {
      const del = K.isPresetDef ? (K.isPresetDef(d) ? 'REFUSED' : 'ok') :
                  (d.preset ? 'REFUSED' : 'ok');
      say('   ' + ('' + id).padEnd(22) +
          ' name=' + JSON.stringify(d.name || '').padEnd(24) +
          ' preset=' + String(!!d.preset).padEnd(6) +
          ' color=' + String(d.color).padEnd(9) +
          ' r=' + String(d.roughness).padEnd(5) +
          ' m=' + String(d.metalness).padEnd(5) +
          ' masks=' + (Array.isArray(d.masks) ? d.masks.length : '-') +
          ' srcSig=' + (d.srcSig ? 'yes' : 'no') +
          '  delete=' + del);
    });
  }

  async function run() {
    const K = window.__kubik;
    const doc = await fetch('_neolib.json?t=' + Date.now()).then(r => r.json());
    say('версия сборки: ' + (document.querySelector('.brand') || {}).textContent);
    say('liveMaterialDef присутствует: ' + (typeof K.liveMaterialDef === 'function'));
    say('');

    dump(K, 'библиотека ДО открытия (чистая, как на свежем телефоне)');
    say('');
    say('подписи, которые сравниваются:');
    ['standard', 'plastic', 'metal'].forEach(id => {
      const mine = K.MATERIALS.get(id);
      const theirs = doc.materialLib.filter(x => x.id === id)[0];
      say('   ' + id);
      say('      наша  : ' + K.materialDefSig(mine));
      say('      в файле: ' + K.materialDefSig(theirs));
      say('      совпало: ' + (K.materialDefSig(mine) === K.materialDefSig(theirs)));
    });

    for (let i = 1; i <= 3; i++) {
      K.restoreDoc(JSON.parse(JSON.stringify(doc)), {});
      say('');
      dump(K, 'после открытия #' + i);
    }
    finish();
  }

  function boot() {
    const t0 = Date.now();
    (function wait() {
      if (window.__kubik && window.__kubik.MATERIALS && window.__kubik.App) {
        run().catch(e => finish('THREW: ' + (e && e.stack || e)));
        return;
      }
      if (Date.now() - t0 > 20000) { finish('__kubik не появился за 20с'); return; }
      setTimeout(wait, 100);
    })();
  }
  // Без window.load (урок v2.61): событие ждёт подресурсы, а __kubik
  // создаётся модулем до него; опрос внутри и так есть.
  setTimeout(boot, 500);
})();
