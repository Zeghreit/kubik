# -*- coding: utf-8 -*-
# Ошибка пробы: 900 + random() вычислялось ДВАЖДЫ, так что pointerup приходил с
# другим id, чем pointerdown. Таймер удержания пустого места не гасился, через
# 480 мс распускалось кольцо «3D» - и дальше uvSecondPointer съедал каждое
# нажатие (`if (toolRingActive) return true`), поэтому выбор оставался пустым.
import io, sys
P = '_uv66chk.js'
s = io.open(P, encoding='utf-8').read()
old = u"""  async function clearSel() {
    const r = svg.getBoundingClientRect();
    const x = r.left + r.width / 2, y = r.top + r.height / 2;
    svg.dispatchEvent(ev('pointerdown', x, y, 900 + Math.floor(Math.random() * 90)));
    svg.dispatchEvent(ev('pointerup', x, y, 900 + Math.floor(Math.random() * 90)));
    await wait(520);
  }"""
new = u"""  // ОДИН id на нажатие и отпускание: разные id оставляют таймер удержания
  // живым, он распускает кольцо, а открытое кольцо съедает все следующие
  // нажатия. И если кольцо всё же открыто - закрываем, прежде чем тапать.
  let clearId = 900;
  async function clearSel() {
    if (K.toolRingActive) { K.closeToolRing(false); await wait(40); }
    const r = svg.getBoundingClientRect();
    const x = r.left + r.width / 2, y = r.top + r.height / 2;
    const id = ++clearId;
    svg.dispatchEvent(ev('pointerdown', x, y, id));
    svg.dispatchEvent(ev('pointerup', x, y, id));
    await wait(520);
  }"""
n = s.count(old)
if n != 1:
    print('FAIL anchor %d' % n); sys.exit(1)
io.open(P, 'w', encoding='utf-8', newline='').write(s.replace(old, new, 1))
print('ok clearSel')
