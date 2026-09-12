/* _facemap - v2.23: грань и группа отрисовки развязаны.

   Главный риск этой правки не в производительности, а в том, что слияние
   групп В ЭТОМ ПРИЛОЖЕНИИ есть операция Dissolve Edge: ребро существует в
   топологии только потому, что его треугольники принадлежат разным группам, а
   нормаль осредняется по группе. Поэтому половина проверок ниже - не про
   выигрыш, а про то, что рёбра и резкие углы на месте. */
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
    if (extra) say(extra);
    say('VERDICT=' + (fails ? 'FAIL' : 'PASS') + ' (' + fails + ' failed)');
    post('/done', OUT.join('\n'));
  }

  let K = null;
  const V = (x, y, z) => new K.THREE.Vector3(x, y, z);

  function clearScene() {
    K.App.objects.slice().forEach(o => { try { o.mesh.parent.remove(o.mesh); } catch (e) {} });
    K.App.objects.length = 0;
    K.App.selectedObjectIds = new Set();
    K.App.activeObjectId = null;
    K.App.hidden.clear();
    K.App.mode = 'object';
    K.App.selectedElements.clear();
  }
  function mkCube(name, x, y, z) {
    const ed = K.buildPrimitiveEditable('cube', {});
    const mats = K.makeMaterialSet(ed.groups.length || 1, 0x9aa3b2);
    return K.createObjectFromEditable(name, V(x || 0, y || 0, z || 0), ed, mats, {});
  }
  const geoOf = (o) => o.mesh.geometry;
  const runs  = (o) => geoOf(o).groups.length;          // прогоны отрисовки
  const faces = (o) => K.faceCount(geoOf(o));           // грани
  const topoOf = (o) => { K.ensureHelpers(o); return o.mesh.userData.topo; };

  // Сумма длин всех прогонов должна покрывать индексный буфер ровно один раз.
  function runsCoverIndex(o) {
    const g = geoOf(o);
    const gs = g.groups;
    if (!gs.length) return false;
    let at = 0;
    for (let i = 0; i < gs.length; i++) {
      if (gs[i].start !== at) return false;
      at += gs[i].count;
    }
    return at === g.index.count;
  }

  async function run() {
    K = window.__kubik;
    if (!K) { finish('__kubik is undefined - приложение не поднялось'); return; }
    ok('0.boot  приложение поднято, карта граней экспортирована',
       !!K.App && typeof K.faceCount === 'function' &&
       typeof K.faceRanges === 'function' && typeof K.mergeDrawGroups === 'function');
    if (typeof K.faceCount !== 'function') { finish(); return; }
    mark('0.boot');

    /* 1 -- КУБ. Шесть граней, один материал, один прогон. */
    clearScene();
    const c = mkCube('C');
    ok('1.cube   карта граней опубликована',
       !!geoOf(c).userData.kubikFaces && geoOf(c).userData.kubikFaceGen > 0);
    ok('1.cube   шесть граней', faces(c) === 6, 'faces=' + faces(c));
    ok('1.cube   и ОДИН прогон отрисовки вместо шести',
       runs(c) === 1, 'runs=' + runs(c));
    ok('1.cube   прогоны покрывают индекс ровно один раз', runsCoverIndex(c));
    ok('1.cube   материалов по-прежнему по грани',
       Array.isArray(c.mesh.material) && c.mesh.material.length === 6,
       'mats=' + (Array.isArray(c.mesh.material) ? c.mesh.material.length : 1));
    ok('1.cube   и все шесть - один и тот же инстанс из пула',
       new Set(c.mesh.material).size === 1);
    mark('1.cube');

    /* 2 -- РЁБРА НА МЕСТЕ. Тот самый риск: слияние групп - это Dissolve Edge,
       так что у куба должно остаться ровно 12 рёбер, а не ноль. */
    const t2 = topoOf(c);
    ok('2.edges  у куба 12 рёбер, слияние их не растворило',
       t2.edges.length === 12, 'edges=' + t2.edges.length);
    ok('2.edges  8 логических вершин', t2.logicalCount === 8, 'V=' + t2.logicalCount);
    ok('2.edges  и шесть граней в топологии, по две триангуляции каждая',
       t2.faceGroups.length === 6 &&
       t2.faceGroups.every(fg => fg.triCount === 2),
       'faceGroups=' + t2.faceGroups.length);
    ok('2.edges  triStart каждой грани указывает туда же, куда карта',
       t2.faceGroups.every((fg, i) => fg.triStart === geoOf(c).userData.kubikFaces[i] / 3));
    mark('2.edges');

    /* 3 -- РЕЗКИЕ УГЛЫ НА МЕСТЕ. Нормаль осредняется ПО ГРУППЕ, поэтому
       слитый куб мог бы получить по одной сглаженной нормали на вершину:
       (±0.577, ±0.577, ±0.577) вместо осевой. */
    const na = geoOf(c).attributes.normal;
    let axial = 0, diagonal = 0;
    for (let i = 0; i < na.count; i++) {
      const ax = Math.abs(na.getX(i)), ay = Math.abs(na.getY(i)), az = Math.abs(na.getZ(i));
      const mx = Math.max(ax, ay, az);
      if (mx > 0.99) axial++;
      else if (mx < 0.7) diagonal++;
    }
    ok('3.sharp  каждая нормаль осевая - углы куба остались резкими',
       axial === na.count && diagonal === 0,
       'осевых ' + axial + ' из ' + na.count + ', диагональных ' + diagonal);
    mark('3.sharp');

    /* 4 -- ПОКРАСКА РАЗБИВАЕТ ПРОГОН. Красим одну грань в середине: прогонов
       становится три, и грань носит то, что ей дали. */
    const ids = Array.from(MATERIAL_IDS());
    function MATERIAL_IDS() { return ['standard', 'plastic', 'metal']; }
    K.App.activeObjectId = c.id;
    K.App.mode = 'face';
    K.App.selectedElements.clear();
    K.App.selectedElements.add(2);
    K.applyFinishToSelection(ids[2]);
    ok('4.paint  одна грань другим материалом - три прогона',
       runs(c) === 3, 'runs=' + runs(c));
    ok('4.paint  прогоны всё ещё покрывают индекс ровно один раз', runsCoverIndex(c));
    ok('4.paint  граней по-прежнему шесть', faces(c) === 6, 'faces=' + faces(c));
    ok('4.paint  и finishes назвали именно ту грань',
       c.mesh.userData.finishes[2] === ids[2],
       JSON.stringify(c.mesh.userData.finishes));
    ok('4.paint  средний прогон - ровно эта одна грань',
       geoOf(c).groups[1].materialIndex === 2 &&
       geoOf(c).groups[1].count === geoOf(c).userData.kubikFaces[3] - geoOf(c).userData.kubikFaces[2],
       'mi=' + geoOf(c).groups[1].materialIndex);
    ok('4.paint  рёбра не пострадали', topoOf(c).edges.length === 12,
       'edges=' + topoOf(c).edges.length);
    // ...и обратно в один прогон
    K.applyFinishToSelection(ids[0]);
    ok('4.paint  вернули тот же материал - снова один прогон',
       runs(c) === 1, 'runs=' + runs(c));
    K.App.selectedElements.clear();
    K.App.mode = 'object';
    mark('4.paint');

    /* 5 -- ОПЕРАЦИЯ. Subdivide: граней больше, прогон по-прежнему один. */
    clearScene();
    const s5 = mkCube('S');
    K.App.selectedObjectIds = new Set([s5.id]);
    K.App.activeObjectId = null;
    K.subdivideSelection();
    K.setPendingAmount(1);
    K.confirmPendingOp();
    ok('5.op     после subdivide граней стало 24',
       faces(s5) === 24, 'faces=' + faces(s5));
    ok('5.op     а прогон отрисовки всё ещё один',
       runs(s5) === 1, 'runs=' + runs(s5));
    ok('5.op     прогоны покрывают индекс', runsCoverIndex(s5));
    const t5 = topoOf(s5);
    ok('5.op     и рёбра посчитаны по ГРАНЯМ, а не по прогону',
       t5.edges.length === 48 && t5.faceGroups.length === 24,
       'edges=' + t5.edges.length + ' faces=' + t5.faceGroups.length);
    mark('5.op');

    /* 6 -- ФАЙЛ. На диске группы по грани, иначе документ, записанный этой
       версией, прочитается другой как меш из одной грани. */
    const doc = K.serializeDoc();
    const rec = doc.objects.find(o => o.geometry && o.geometry.groups);
    ok('6.file   в документе групп столько же, сколько граней',
       !!rec && rec.geometry.groups.length === 24,
       rec ? 'groups=' + rec.geometry.groups.length : 'записи нет');
    ok('6.file   и они идут подряд, без дыр',
       !!rec && rec.geometry.groups.every((g, i, a) =>
         i === 0 ? g.start === 0 : g.start === a[i - 1].start + a[i - 1].count));
    K.restoreDoc(doc, {});
    const back = K.App.objects.filter(o => !K.isCurve(o)).slice(-1)[0];
    ok('6.file   загрузка вернула те же 24 грани',
       faces(back) === 24, 'faces=' + faces(back));
    ok('6.file   и снова свела их в один прогон',
       runs(back) === 1, 'runs=' + runs(back));
    ok('6.file   рёбра после загрузки на месте',
       topoOf(back).edges.length === 48, 'edges=' + topoOf(back).edges.length);
    mark('6.file');

    /* 7 -- ЭКСПОРТ. GLTFExporter делает по primitive на группу, так что
       наружу грани должны уйти гранями - иначе модельер, державший две
       компланарные грани раздельно, получит их слитыми. */
    const eg = K.buildExportGroup();
    let exported = null;
    eg.traverse(o => { if (o.isMesh && !exported) exported = o; });
    ok('7.export экспорт развернул прогоны обратно в грани',
       !!exported && exported.geometry.groups.length === 24,
       exported ? 'groups=' + exported.geometry.groups.length : 'меша нет');
    ok('7.export а живая геометрия осталась слитой',
       runs(back) === 1, 'runs=' + runs(back));
    mark('7.export');

    /* 8 -- ДВА МАТЕРИАЛА ВРАЗБИВКУ. Худший случай для слияния: грани
       чередуются, так что сливать нечего и прогонов должно быть по грани. */
    clearScene();
    const c8 = mkCube('Z');
    K.App.activeObjectId = c8.id;
    K.App.mode = 'face';
    K.App.selectedElements.clear();
    K.App.selectedElements.add(1);
    K.App.selectedElements.add(3);
    K.App.selectedElements.add(5);
    K.applyFinishToSelection('metal');
    ok('8.alt    чередование через грань - шесть прогонов, сливать нечего',
       runs(c8) === 6, 'runs=' + runs(c8));
    ok('8.alt    покрытие индекса цело и здесь', runsCoverIndex(c8));
    ok('8.alt    и каждая грань носит своё',
       c8.mesh.userData.finishes[1] === 'metal' &&
       c8.mesh.userData.finishes[3] === 'metal' &&
       c8.mesh.userData.finishes[5] === 'metal' &&
       c8.mesh.userData.finishes[0] !== 'metal',
       JSON.stringify(c8.mesh.userData.finishes));
    K.App.selectedElements.clear();
    K.App.mode = 'object';
    mark('8.alt');

    /* 9 -- КОПИЯ. Нашло ревью: cloneObjectInto обнуляет userData геометрии,
       а клон несёт группы УЖЕ СЛИТЫМИ - так что без переноса карты копия
       считала гранями прогоны. На кубе это одна грань: ни одного ребра,
       гладкий шейдинг, и - при покрашенной ПОСЛЕДНЕЙ грани - materialIndex
       за границей укороченного массива материалов, то есть пропавшая грань
       и падение внутри raycaster.intersectObjects на следующем тапе. */
    clearScene();
    const src9 = mkCube('Src');
    K.App.activeObjectId = src9.id;
    K.App.mode = 'face';
    K.App.selectedElements.clear();
    K.App.selectedElements.add(5);          // последняя грань - худший случай
    K.applyFinishToSelection('metal');
    K.App.selectedElements.clear();
    K.App.mode = 'object';
    K.App.selectedObjectIds = new Set([src9.id]);
    K.App.activeObjectId = null;
    K.duplicateSelection();
    const dup = K.App.objects.filter(o => !K.isCurve(o)).slice(-1)[0];
    ok('9.clone  копия получила карту граней, а не прогоны',
       !!geoOf(dup).userData.kubikFaces && faces(dup) === 6,
       'faces=' + faces(dup));
    ok('9.clone  у копии все 12 рёбер - топология не растворилась',
       topoOf(dup).edges.length === 12, 'edges=' + topoOf(dup).edges.length);
    ok('9.clone  и покрытие индекса прогонами цело', runsCoverIndex(dup));
    ok('9.clone  каждый прогон указывает на существующий материал',
       geoOf(dup).groups.every(g => {
         const m = Array.isArray(dup.mesh.material) ? dup.mesh.material : [dup.mesh.material];
         return !!m[g.materialIndex];
       }),
       'runs=' + runs(dup) + ' mats=' +
       (Array.isArray(dup.mesh.material) ? dup.mesh.material.length : 1));
    // ...и рейкаст по сцене не падает на материале, которого нет
    let threw = null;
    try {
      const rc = new K.THREE.Raycaster();
      rc.setFromCamera(new K.THREE.Vector2(0, 0), K.camera);
      rc.intersectObjects(K.App.objects.map(o => o.mesh), false);
    } catch (e) { threw = e; }
    ok('9.clone  и рейкаст по сцене не падает', !threw, threw ? String(threw) : '');
    mark('9.clone');

    /* 10 -- СКОЛЬКО ЭТО СТОИТ НА САМОМ ДЕЛЕ. Не наш подсчёт прогонов, а
       счётчик самого three: именно в этих единицах GPU выставляет счёт.
       1536 граней - это куб, подразделённый четыре раза, то есть примерно
       пятая часть персонажа-воина. */
    clearScene();
    const big = mkCube('Big');
    K.App.selectedObjectIds = new Set([big.id]);
    K.App.activeObjectId = null;
    K.subdivideSelection();
    // Уровень подразбиения - это СТЕППЕР, не слайдер: три шага даёт 6*4^3.
    K.stepSegments(1); K.stepSegments(1);
    K.confirmPendingOp();
    const nf = faces(big);
    const calls = K.renderNow();
    ok('10.cost   куб подразделён до сотен граней',
       nf >= 300, 'faces=' + nf);
    ok('10.cost   прогон отрисовки один', runs(big) === 1, 'runs=' + runs(big));
    ok('10.cost   и three рисует единицы вызовов, а не по одному на грань',
       calls <= 4 && nf >= 300,
       'renderer.info.render.calls=' + calls + ' при ' + nf + ' гранях');
    say('       ^ до v2.23 этот же меш стоил бы ' + nf + ' вызовов отрисовки');
    mark('10.cost');

    finish();
  }

  setTimeout(() => {
    run().catch(e => { say('THREW ' + (e && e.stack ? e.stack : e)); fails++; finish(); });
  }, 3000);
})();
