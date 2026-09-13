import io

P = 'index.html'
s = io.open(P, encoding='utf-8').read()
n = 0

def rep(old, new, label):
    global s, n
    c = s.count(old)
    assert c == 1, 'MATCH %d for %s' % (c, label)
    s = s.replace(old, new)
    n += 1
    print('ok', label)


rep("""  .mat-card.add { color: var(--text-dim); font-size: 22px; min-height: 44px; justify-content: center; }""",
"""  .mat-card.add { color: var(--text-dim); font-size: 22px; min-height: 44px; justify-content: center; }
  /* Sits beside the + at the end of the shelf, same quiet weight - a word
     rather than a glyph, because a second big symbol next to + reads as
     another way to add something (v2.30). */
  .mat-card.sweep { font-size: 10px; letter-spacing: 0.06em; }""", 'sweep-css')


rep("""  matTrayInnerEl.appendChild(add);
}""",
"""  matTrayInnerEl.appendChild(add);

  /* CLEAN UP (v2.30). A LIBRARY ONLY EVER GREW. Every project file opened
     brings its materials, nothing ever removed one again, and before this
     version a preset minted a copy of itself on the way in - so a shelf ends
     up thirty cards long, most of them nobody's. Deleting those one editor at
     a time, on a phone, is not a thing anyone will actually do.

     SAFE BY CONSTRUCTION: it removes only what NOTHING in the scene wears, so
     the picture cannot change, and never a preset, which must always be on the
     shelf. The one thing it can take that you might want is a material made
     with + and not yet applied to anything - hence the count in the toast, so
     an unexpected number is visible rather than silent. */
  const sweep = document.createElement('button');
  sweep.className = 'mat-card add sweep';
  sweep.title = 'Remove materials nothing is wearing';
  sweep.textContent = 'CLEAN';
  sweep.addEventListener('click', () => {
    const worn = new Set();
    App.objects.forEach(o => {
      const fin = o.mesh.userData.finishes || {};
      Object.keys(fin).forEach(g => worn.add(fin[g]));
    });
    const doomed = [];
    MATERIALS.forEach((d, id) => {
      if (isPresetDef(d) || worn.has(id)) return;
      doomed.push(id);
    });
    if (!doomed.length) { toast('Nothing unused to remove'); return; }
    doomed.forEach(id => {
      MATERIALS.delete(id);
      /* The same retirement meDelete does, for the same reason: an instance
         left in the pool goes on drawing a definition the library no longer
         has. */
      prunePool(id + '|', null);
      dropMaskTexture(id);
      if (_matPreviewRig) {
        const pm = _matPreviewRig.mats.get(id);
        if (pm) { pm.dispose(); _matPreviewRig.mats.delete(id); }
      }
    });
    App.objects.forEach(o => dressFromPool(o));
    pruneMaskImages();
    saveMaterialLibrary();
    if (matEditingId && !MATERIALS.has(matEditingId)) closeMatEditor(false);
    _matPreviews = null;
    buildMatTray();
    refreshMatTray();
    toast('Removed ' + doomed.length + ' unused material' + (doomed.length > 1 ? 's' : ''));
  });
  matTrayInnerEl.appendChild(sweep);
}""", 'sweep-card')

io.open(P, 'w', encoding='utf-8', newline='').write(s)
print('patches applied:', n)
