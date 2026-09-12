# Строит сломанную копию v2.23, чтобы _facemap можно было показать ПАДАЮЩИМ.
# Пробник, который ни разу не падал, ничего не доказывает.
#
#   py _mkfacemapbroken.py        -> _bak_facemapbroken.html
#        слияние не происходит вовсе: прогон на каждую грань, как было до v2.23
#   py _mkfacemapbroken.py late   -> _bak_facemapbroken2.html
#        слияние происходит СЛИШКОМ агрессивно - всё в одну группу, невзирая на
#        материал. Это и есть та самая ловушка: ребро перестаёт существовать,
#        нормаль осредняется, покраска не работает. Плюс сломаны файл и экспорт.
import io, sys
sys.stdout.reconfigure(encoding='utf-8', errors='replace')
ROOT = r'C:\Users\a.bodrov\Projects\kubik'
src = io.open(ROOT + r'\index.html', encoding='utf-8').read()
LATE = len(sys.argv) > 1 and sys.argv[1] == 'late'
OUT = '_bak_facemapbroken2.html' if LATE else '_bak_facemapbroken.html'


def sub(old, new, why):
    global src
    n = src.count(old)
    assert n == 1, 'ANCHOR %r matched %d: %s' % (old[:60], n, why)
    src = src.replace(old, new, 1)
    print('  broke ', why)


if not LATE:
    sub("""  let runStart = 0;
  for (let i = 1; i <= n; i++) {
    if (i < n && mats[i] === mats[runStart]) continue;""",
        """  let runStart = 0;
  for (let i = 1; i <= n; i++) {
    if (false) continue;                   // BROKEN: один прогон на грань""",
        '1. слияние не происходит - draw call на каждую грань, как до v2.23')
else:
    # ЭТОТ БИЛД - ПРО ТО, ЗАЧЕМ РАЗВЯЗКА НУЖНА. Слияние оставлено рабочим, а
    # топология и шейдинг возвращены на группы отрисовки, как было до v2.23.
    # Тогда сливающийся куб теряет все рёбра и все резкие углы - ровно та
    # ловушка, из-за которой наивное слияние уничтожило бы модель.
    sub("""  const groupsSrc = faceRanges(geometry);
  const faceGroups = [];""",
        """  const groupsSrc = geometry.groups.length ? geometry.groups : faceRanges(geometry);
  const faceGroups = [];   // BROKEN: топология снова от прогонов отрисовки""",
        '2. computeTopology читает прогоны отрисовки - рёбра растворяются')

    sub("""  const groupsSrc = faceRanges(geo);
  const triCount = index.count / 3;""",
        """  const groupsSrc = geo.groups.length ? geo.groups : faceRanges(geo);
  const triCount = index.count / 3;   // BROKEN: нормаль осредняется по прогону""",
        '3. buildShadingTopo читает прогоны - резкие углы сглаживаются')

    sub("""          groups: faceRanges(g).map(gr => ({ start: gr.start, count: gr.count, materialIndex: gr.materialIndex }))""",
        """          groups: g.groups.map(gr => ({ start: gr.start, count: gr.count, materialIndex: gr.materialIndex }))   // BROKEN""",
        '4. документ хранит прогоны отрисовки вместо граней')

    sub("""    eg.clearGroups();
    faceRanges(source.geometry).forEach(gr => eg.addGroup(gr.start, gr.count, gr.materialIndex));""",
        """    /* BROKEN: экспорт отдаёт прогоны, сливая грани наружу */""",
        '5. экспорт не разворачивает прогоны обратно в грани')

    sub("""  if (srcUD.kubikFaces) {
    newGeo.userData.kubikFaces = srcUD.kubikFaces;
    newGeo.userData.kubikFaceGen = srcUD.kubikFaceGen;
  }""",
        """  /* BROKEN: клон теряет карту граней и считает гранями прогоны */""",
        '6. клон объекта не переносит карту граней')

io.open(ROOT + '\\' + OUT, 'w', encoding='utf-8', newline='').write(src)
print('WROTE ' + OUT)
