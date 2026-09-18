/* _uv53chk - 2D-развёртка как вид, а не карточка.

   Проверяем не наличие функций, а поведение через настоящие органы
   управления: сиденье мирового кольца открывает вид, кнопка режима
   переключает компонент, сиденье "3D" закрывает. */
(function () {
  const OUT = [];
  let fails = 0;
  const say = s => OUT.push(s);
  const ok = (name, cond, detail) => {
    if (!cond) fails++;
    say((cond ? 'PASS ' : 'FAIL ') + name + (detail === undefined ? '' : '  ' + detail));
  };
  const post = (p, b) => { try { const x = new XMLHttpRequest(); x.open('POST', p, true); x.send(b); } catch (e) {} };
  const mark = s => post('/mark', 'at: ' + s + '\n' + OUT.join('\n'));
  function finish(extra) {
    if (extra) { say(extra); fails++; }
    say('VERDICT=' + (fails ? 'FAIL' : 'PASS') + ' (' + fails + ' failed)');
    post('/done', OUT.join('\n'));
  }
  let K = null;
  const seat = (arr, key) => arr.find(t => t.key === key);
  const cube = () => document.getElementById('viewCube');
  const wait = ms => new Promise(r => setTimeout(r, ms));

  async function run() {
    const A = K.App, T = K.THREE;
    let o = A.objects[0];
    if (!o) { K.createPrimitiveObject('cube', {}, 'Cube', new T.Vector3(0, 0, 0)); o = A.objects[0]; }
    A.activeObjectId = o.id; A.selectedObjectIds = new Set([o.id]);
    K.setMode('edge'); K.ensureHelpers(o);
    const topo = o.mesh.userData.topo;
    A.selectedElements = new Set(topo.edges.map((e, i) => i));
    K.markSeamSelection(true);
    A.selectedElements = new Set();
    K.setMode('uv');
    K.unwrapSelection();           // чтобы в 2D было что показывать
    K.refreshUI();
    mark('setup');

    // 1. Мировое кольцо открывает вид - тем же сиденьем, что и палец.
    seat(K.HUB_TOOLS_WORLD, 'addgeo').run();
    await wait(60);
    ok('1.open  вид открыт', K.uvViewOpen);
    ok('1.open  гизмо-куб спрятан', cube().style.display === 'none', 'display="' + cube().style.display + '"');
    const uvEl = document.getElementById('uvView');
    const cs = getComputedStyle(uvEl);
    ok('1.open  фон непрозрачный, не затемнение',
       cs.backgroundColor.indexOf('rgba') < 0 || cs.backgroundColor.indexOf(', 0.') < 0, cs.backgroundColor);
    ok('1.open  карточка без шапки и без крестика',
       !document.getElementById('uvViewClose') && !document.getElementById('uvModeToggle'));
    mark('1');

    // 2. 3D больше не рисуется.
    const r0 = K.PERF ? K.PERF.render : -1;
    K.invalidate && K.invalidate();
    await wait(600);
    const r1 = K.PERF ? K.PERF.render : -1;
    ok('2.sleep 3D-кадры не рисуются, пока открыт 2D', r0 >= 0 && r1 === r0, r0 + ' -> ' + r1);
    mark('2');

    // 3. Кнопка режима переключает компонент: тап и блум.
    const before = K.uvCompMode;
    K.modeButtonTap();
    const afterTap = K.uvCompMode;
    ok('3.mode  тап по кнопке режима переключает компонент', afterTap !== before, before + ' -> ' + afterTap);
    seat(K.HUB_TOOLS_UV2D_MODE, 'uvcomp-edge').run();
    ok('3.mode  сиденье Edge даёт edge', K.uvCompMode === 'edge', K.uvCompMode);
    ok('3.mode  лит ровно один seat',
       K.HUB_TOOLS_UV2D_MODE.filter(t => t.on()).length === 1);
    const hn = document.getElementById('hdrModeName');
    ok('3.mode  слово в шапке называет компонент', /edge/.test(hn.textContent), hn.textContent);
    ok('3.mode  режим приложения при этом остался uv', A.mode === 'uv', A.mode);
    mark('3');

    // 4. Вид следует за активным объектом аутлайнера.
    K.createPrimitiveObject('cylinder', {}, 'Cyl', new T.Vector3(3, 0, 0));
    const o2 = A.objects[A.objects.length - 1];
    A.activeObjectId = o2.id; A.selectedObjectIds = new Set([o2.id]);
    K.refreshUI();
    await wait(30);
    ok('4.follow вид переехал на активный объект', K.uvViewTarget === o2.id, 'target=' + K.uvViewTarget + ' want=' + o2.id);
    ok('4.follow вид не закрылся', K.uvViewOpen);
    ok('4.follow выбор от прошлого объекта сброшен', K.uvSel.length === 0 && K.uvEdgeSel.length === 0);
    mark('4');

    // 5. Сиденье "3D" возвращает 3D - и кадры вместе с ним.
    seat(K.HUB_TOOLS_UV2D_WORLD, 'to3d').run();
    await wait(60);
    ok('5.close вид закрыт', !K.uvViewOpen);
    ok('5.close гизмо-куб вернулся', cube().style.display === '', 'display="' + cube().style.display + '"');
    const r2 = K.PERF ? K.PERF.render : -1;
    K.invalidate && K.invalidate();
    await wait(400);
    ok('5.close 3D снова рисуется', K.PERF.render > r2, r2 + ' -> ' + K.PERF.render);
    ok('5.close компонент вернулся в island', K.uvCompMode === 'island', K.uvCompMode);
    mark('5');

    // 6. Удалённый объект не оставляет вид висеть в пустоте.
    seat(K.HUB_TOOLS_WORLD, 'addgeo').run();
    await wait(30);
    ok('6.gone  вид снова открыт', K.uvViewOpen);
    K.removeObjects([o2]);
    K.refreshUI();
    await wait(30);
    ok('6.gone  вид закрылся вместе с объектом', !K.uvViewOpen);
    ok('6.gone  куб вернулся и здесь', cube().style.display === '');
    mark('6');

    // 7. Уход из UV-режима закрывает вид - он принадлежит режиму.
    A.activeObjectId = A.objects[0].id; A.selectedObjectIds = new Set([A.objects[0].id]);
    K.setMode('uv');
    seat(K.HUB_TOOLS_WORLD, 'addgeo').run();
    await wait(30);
    ok('7.mode  вид открыт перед проверкой', K.uvViewOpen);
    K.setMode('object');
    K.refreshUI();
    await wait(30);
    ok('7.mode  уход из UV закрыл вид', !K.uvViewOpen);
    ok('7.mode  куб на месте', cube().style.display === '');
    mark('7');

    // 8. Полоса рядом с квадратом держит долгий тап, как и сам квадрат.
    K.setMode('uv');
    seat(K.HUB_TOOLS_WORLD, 'addgeo').run();
    await wait(30);
    const svg = document.getElementById('uvViewSvg').getBoundingClientRect();
    const card = document.getElementById('uvViewCard');
    const cr = card.getBoundingClientRect();
    const stripY = svg.top > cr.top + 8 ? (cr.top + svg.top) / 2 : (svg.bottom + cr.bottom) / 2;
    const ev = new PointerEvent('pointerdown', {
      bubbles: true, cancelable: true, pointerId: 77, pointerType: 'mouse',
      button: 0, clientX: Math.round(cr.left + cr.width / 2), clientY: Math.round(stripY)
    });
    card.dispatchEvent(ev);
    await wait(700);
    ok('8.strip долгий тап по полосе открыл кольцо', !!K.toolRingActive,
       'strip y=' + Math.round(stripY) + ' svg.top=' + Math.round(svg.top));
    mark('8');

    finish();
  }

  function boot() {
    const t0 = Date.now();
    (function w() {
      if (window.__kubik && window.__kubik.App && window.__kubik.App.objects) {
        K = window.__kubik;
        run().catch(e => finish('THREW: ' + (e && e.stack || e)));
        return;
      }
      if (Date.now() - t0 > 20000) { finish('__kubik не появился за 20с'); return; }
      setTimeout(w, 100);
    })();
  }
  if (document.readyState === 'complete') setTimeout(boot, 500);
  else window.addEventListener('load', () => setTimeout(boot, 500));
})();
