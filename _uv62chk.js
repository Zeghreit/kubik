/* _uv62chk - строка состояния в 2D, и Undo, который не теряет твоё место.

   Проверяется не наличие элемента, а пять вещей, о которых он отчитывается,
   и то, что Undo внутри 2D-вида сохраняет кадрирование (островные индексы
   он по-прежнему сбрасывает - за ними могла измениться топология). */
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
  let K = null, A = null, T = null, svg = null;
  const wait = ms => new Promise(r => setTimeout(r, ms));
  const seat = (arr, key) => arr.find(t => t.key === key);

  function centreOf(el) {
    const bb = el.getBBox();
    const pt = svg.createSVGPoint();
    pt.x = bb.x + bb.width / 2; pt.y = bb.y + bb.height / 2;
    const p = pt.matrixTransform(svg.getScreenCTM());
    return { x: p.x, y: p.y };
  }
  const ev = (type, x, y, id) => new PointerEvent(type, {
    bubbles: true, cancelable: true, pointerId: id, pointerType: 'mouse',
    button: 0, buttons: type === 'pointerup' ? 0 : 1, clientX: x, clientY: y
  });
  const down = (el, x, y, id) => el.dispatchEvent(ev('pointerdown', x, y, id));
  const move = (x, y, id) => svg.dispatchEvent(ev('pointermove', x, y, id));
  const up = (x, y, id) => svg.dispatchEvent(ev('pointerup', x, y, id));
  function tap(el, id) {
    const c = centreOf(el);
    down(el, c.x, c.y, id); up(c.x, c.y, id);
  }
  function uvSnapshot() {
    const o = A.objects.find(x => x.id === A.activeObjectId);
    return Array.prototype.slice.call(o.mesh.geometry.attributes.uv.array);
  }
  function uvSame(a, b) {
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) if (Math.abs(a[i] - b[i]) > 1e-9) return false;
    return true;
  }

  async function run() {
    A = K.App; T = K.THREE;

    // ---------------------------------------------------------------- 0
    let o = A.objects[0];
    if (!o) { K.createPrimitiveObject('cube', { h: 1, v: 1 }, 'Cube', new T.Vector3(0, 0, 0)); o = A.objects[0]; }
    A.activeObjectId = o.id; A.selectedObjectIds = new Set([o.id]);
    K.setMode('edge'); K.ensureHelpers(o);
    A.selectedElements = new Set(o.mesh.userData.topo.edges.map((e, i) => i));
    K.markSeamSelection(true);
    A.selectedElements = new Set();
    K.setMode('uv');
    K.unwrapSelection();
    K.refreshUI();
    seat(K.HUB_TOOLS_WORLD, 'addgeo').run();
    await wait(120);
    svg = document.getElementById('uvViewSvg');
    const islands = () => svg.querySelectorAll('.uv-island');
    ok('0.setup вид открыт', K.uvViewOpen && islands().length >= 2, 'islands=' + islands().length);
    ok('0.setup версия 2.62',
       (document.querySelector('.brand') || {}).textContent.indexOf('2.62') >= 0,
       (document.querySelector('.brand') || {}).textContent);
    ok('0.setup строка состояния видна', K.uvStatusShown === true);
    mark('0');

    // ---------------------------------------------------------------- 1
    // Что она говорит, когда ничего не выбрано.
    {
      K.resetUvViewBox();
      await wait(20);
      const t = K.uvStatusText;
      ok('1.says  называет вид компонент', t.indexOf('Island') === 0, t);
      ok('1.says  и что ничего не выбрано', t.indexOf('nothing selected') > 0, t);
      ok('1.says  зум 100% при обычном кадре', t.indexOf('100%') > 0, t);
      /* Глубины Undo/Redo тут БОЛЬШЕ НЕТ (ревью): она устаревала после любого
         пуша, не менявшего экземпляр объекта, и могла противоречить самой
         кнопке, стоящей рядом. Справа только зум. */
      ok('1.says  справа только зум', /\| 100%$/.test(t) && !/⤺|⤻/.test(t), t);

      /* И строка стоит ВЫШЕ полосы кнопок: #quickRow (Undo/Redo, z13) и
         #hubBtn (z16) рисуются поверх этого вида, так что первый черновик
         строки печатался ровно под кнопкой Undo. */
      const sb = document.getElementById('uvViewStatus').getBoundingClientRect();
      ok('1.says  и поднята над нижними кнопками',
         window.innerHeight - sb.bottom >= 60,
         'до низа окна ' + Math.round(window.innerHeight - sb.bottom) + 'px');
    }
    mark('1');

    // ---------------------------------------------------------------- 2
    // Выбор и зум - и то и другое она обязана подхватить.
    {
      const isl = islands();
      tap(isl[0], 301);
      await wait(20);
      ok('2.live  выбор попал в строку', K.uvStatusText.indexOf('1 selected') > 0, K.uvStatusText);
      tap(isl[1], 302);
      await wait(20);
      ok('2.live  и второй остров тоже', K.uvStatusText.indexOf('2 selected') > 0, K.uvStatusText);
      K.zoomUvViewBoxAt(0.5, 50, 50);
      await wait(20);
      ok('2.live  зум подхвачен', K.uvStatusText.indexOf('200%') > 0, K.uvStatusText);
      ok('2.live  и выбор при этом не потерян', K.uvStatusText.indexOf('2 selected') > 0, K.uvStatusText);
    }
    mark('2');

    // ---------------------------------------------------------------- 3
    // Смена вида компонент меняет и слово, и счёт (наборы при ней чистятся).
    {
      K.setUvCompMode('vertex');
      await wait(60);
      const t = K.uvStatusText;
      ok('3.kind  слово сменилось', t.indexOf('Vertex') === 0, t);
      ok('3.kind  и счёт обнулился', t.indexOf('nothing selected') > 0, t);
      K.setUvCompMode('island');
      await wait(60);
      ok('3.kind  и обратно', K.uvStatusText.indexOf('Island') === 0, K.uvStatusText);
    }
    mark('3');

    // ---------------------------------------------------------------- 4
    /* Undo внутри 2D-вида. restoreDoc пересобирает объекты, поэтому sweep
       видит ДРУГОЙ объект под тем же id - и до v2.62 сбрасывал кадр вместе
       со всем прочим: каждый Undo выбрасывал тебя на весь квадрат. */
    {
      K.resetUvViewBox();
      const isl = islands();
      const c = centreOf(isl[0]);
      const uv0 = uvSnapshot();
      down(isl[0], c.x, c.y, 311);
      move(c.x + 20, c.y + 10, 311);
      move(c.x + 45, c.y + 22, 311);
      up(c.x + 45, c.y + 22, 311);
      await wait(80);
      const uv1 = uvSnapshot();
      ok('4.undo  перенос записался', !uvSame(uv0, uv1));
      // Зумимся и выбираем - чтобы было что терять.
      K.zoomUvViewBoxAt(0.5, 50, 50);
      await wait(20);
      const wZoom = K.uvViewBoxNow.w;
      ok('4.undo  вид приближён', Math.abs(wZoom - 50) < 1e-6, 'w=' + wZoom);
      const idBefore = A.activeObjectId;
      K.undo();
      await wait(120);
      ok('4.undo  тот же объект остался активным', A.activeObjectId === idBefore);
      ok('4.undo  кадр сохранён', Math.abs(K.uvViewBoxNow.w - wZoom) < 1e-6,
         'w=' + K.uvViewBoxNow.w);
      ok('4.undo  правка отменена', uvSame(uv0, uvSnapshot()));
      ok('4.undo  выбор сброшен (индексы могли поехать)', K.uvIslandSel.length === 0,
         JSON.stringify(K.uvIslandSel));
      ok('4.undo  и строка это говорит', K.uvStatusText.indexOf('nothing selected') > 0,
         K.uvStatusText);
      ok('4.undo  зум в строке тоже прежний', K.uvStatusText.indexOf('200%') > 0, K.uvStatusText);
      K.redo();
      await wait(120);
      ok('4.undo  Redo вернул правку', uvSame(uv1, uvSnapshot()));
      ok('4.undo  и кадр опять на месте', Math.abs(K.uvViewBoxNow.w - wZoom) < 1e-6,
         'w=' + K.uvViewBoxNow.w);
    }
    mark('4');

    // ---------------------------------------------------------------- 5
    // А вот СМЕНА объекта - другое дело: кадр там ни при чём, его сбрасываем.
    {
      K.zoomUvViewBoxAt(0.5, 50, 50);
      await wait(20);
      const second = K.createPrimitiveObject('cube', { h: 1, v: 1 }, 'Cube2', new T.Vector3(3, 0, 0));
      A.activeObjectId = second.id;
      A.selectedObjectIds = new Set([second.id]);
      K.refreshUI();
      await wait(120);
      ok('5.switch вид переехал на новый объект', K.uvViewTarget === second.id,
         'target=' + K.uvViewTarget);
      ok('5.switch и кадр сброшен', Math.abs(K.uvViewBoxNow.w - 100) < 1e-6,
         'w=' + K.uvViewBoxNow.w);
    }
    mark('5');

    // ---------------------------------------------------------------- 6
    // На объекте без развёртки строке нечего говорить - она прячется.
    {
      ok('6.empty у нового куба развёртки нет - вид пуст',
         svg.style.display === 'none' || islands().length === 0,
         'display=' + svg.style.display + ' islands=' + islands().length);
      ok('6.empty строка состояния спрятана', K.uvStatusShown === false);
    }
    mark('6');

    // ---------------------------------------------------------------- 7
    /* Id объектов приходят ИЗ ДОКУМЕНТА, поэтому «тот же id» значит «тот же
       объект» только внутри одного документа. Загрузка - не Undo: она зовёт
       restoreDoc без keepSelection, и 2D-вид должен закрыться, а не остаться
       открытым на чужой модели с прежним зумом (ровно то, от чего restoreDoc
       уже бросает geoSetup, opSetup и curveEdit). */
    {
      const first = A.objects[0];
      A.activeObjectId = first.id;
      A.selectedObjectIds = new Set([first.id]);
      K.refreshUI();
      await wait(80);
      ok('7.load  вид снова открыт на объекте с развёрткой',
         K.uvViewOpen && K.uvViewTarget === first.id, 'target=' + K.uvViewTarget);
      // Так выглядит File > Open: restoreDoc БЕЗ keepSelection.
      K.restoreDoc(A.history[A.historyIndex]);
      await wait(120);
      ok('7.load  загрузка закрыла 2D-вид', K.uvViewOpen === false);
      ok('7.load  и он ни на что не наведён', K.uvViewTarget === null,
         'target=' + K.uvViewTarget);
    }
    mark('7');

    finish();
  }

  function boot() {
    K = window.__kubik;
    if (!K || !K.App || !K.refreshUvStatus || !K.HUB_TOOLS_WORLD) { setTimeout(boot, 120); return; }
    setTimeout(() => {
      run().catch(e => finish('THREW ' + (e && e.stack ? e.stack : e)));
    }, 500);
  }
  // Никакого window.load - урок v2.61.
  boot();
  setTimeout(() => { if (OUT.length === 0) finish('THREW boot timeout - __kubik не появился'); }, 110000);
})();
