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

# ---- the heal was unreachable, so it was never a guard ----
#
# The broken-build run proved it: removing it changed nothing any check could
# see. loadMaterialLibrary seeds the three defaults, forces every custom to
# preset:false and applies presetOverrides only onto entries that are already
# presets - so an orphan cannot exist when it finishes, and a line that cannot
# fire is worse than no line, because it reads like protection.
#
# What the three decision points actually need is to stop trusting a stored
# FLAG for a question the defaults already answer.
rep("""  /* A PRESET IS ONE OF THE THREE IN MATERIAL_DEFAULTS AND NOTHING ELSE
     (v2.29). An entry flagged `preset` whose id is not in there could be
     neither deleted (meDelete refuses presets) nor reset (there is no default
     to go back to), and saveMaterialLibrary read base.color straight off it -
     which throws, OUTSIDE that function's try, taking the whole library's
     persistence down with it. Nothing in this build can write one, so this
     heals anything an older one left behind and keeps the invariant stated in
     one place rather than assumed in four. */
  MATERIALS.forEach(d => { if (d.preset && !MATERIAL_DEFAULTS[d.id]) d.preset = false; });
}""", "}", 'drop-dead-heal')

rep("""function liveMaterialDef(id) {
  return MATERIALS.has(id) ? normaliseDefMasks(MATERIALS.get(id)) : null;
}""",
"""function liveMaterialDef(id) {
  return MATERIALS.has(id) ? normaliseDefMasks(MATERIALS.get(id)) : null;
}

/* A PRESET IS ONE OF THE THREE IN MATERIAL_DEFAULTS, AND NOTHING ELSE (v2.29).

   `preset` is a stored boolean on an entry that outlives the release which
   wrote it, and three places asked it a question only MATERIAL_DEFAULTS can
   answer: the editor (is there a Reset button), Delete (refuse it) and Reset
   (what do I restore). An entry flagged preset with no default there satisfied
   all three and could be neither deleted nor reset - a material that has moved
   into the tray for good.

   Derived rather than healed on load. A heal only covers the entries that
   happen to pass through the loader; asking the defaults covers the question
   wherever it is asked, and cannot go stale. */
function isPresetDef(d) {
  return !!(d && d.preset && MATERIAL_DEFAULTS[d.id]);
}""", 'isPresetDef')

rep("  meName.textContent = d.name + (d.preset ? ' (preset)' : '');",
    "  meName.textContent = d.name + (isPresetDef(d) ? ' (preset)' : '');", 'editor-label')

rep("""  document.getElementById('meReset').style.display = d.preset ? '' : 'none';
  document.getElementById('meDelete').style.display = d.preset ? 'none' : '';""",
"""  document.getElementById('meReset').style.display = isPresetDef(d) ? '' : 'none';
  document.getElementById('meDelete').style.display = isPresetDef(d) ? 'none' : '';""",
    'editor-buttons')

rep("""  const base = MATERIAL_DEFAULTS[d.id];
  /* Only a real preset has somewhere to go back to, and the refusal is said
     out loud: a button that silently does nothing reads as a broken app, and
     Object.assign(d, undefined) did nothing while still toasting "Reset to
     default" (v2.29). */
  if (!d.preset || !base) { toast('Only Solid, Plastic and Metal have a default'); return; }
  Object.assign(d, base);""",
"""  /* Only a real preset has somewhere to go back to, and the refusal is said
     out loud: a button that silently does nothing reads as a broken app, and
     Object.assign(d, undefined) did nothing while still toasting "Reset to
     default" (v2.29). */
  if (!isPresetDef(d)) { toast('Only Solid, Plastic and Metal have a default'); return; }
  Object.assign(d, MATERIAL_DEFAULTS[d.id]);""", 'meReset-predicate')

rep("  if (d.preset) { toast('Solid, Plastic and Metal cannot be deleted \\u2014 use Reset'); return; }",
    "  if (isPresetDef(d)) { toast('Solid, Plastic and Metal cannot be deleted \\u2014 use Reset'); return; }",
    'meDelete-predicate')

# exported for the probe
rep("    MATERIAL_DEFAULTS, liveMaterialDef, matTrayStale, buildMatTray,",
    "    MATERIAL_DEFAULTS, liveMaterialDef, isPresetDef, matTrayStale, buildMatTray,",
    'export-isPresetDef')

io.open(P, 'w', encoding='utf-8', newline='').write(s)
print('patches applied:', n)
