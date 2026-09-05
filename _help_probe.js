/* The help card, v2.0a. Four questions a reading cannot answer reliably:
     1. does it render at all, with every section and no empty rows?
     2. does every icon a row names actually EXIST? A missing glyph draws a
        blank box beside a term and nothing throws, so this is invisible.
     3. does every tool in every ring - doors included - have a row somewhere
        in the card? That is the promise the card makes about itself.
     4. does the card name anything that no longer exists in any ring?
   3 and 4 are matched on the seat's own WORD, which is what a reader sees
   and what they would search the card for.
*/
(function () {
  var out = [], errs = [], fails = 0;
  window.addEventListener('error', function (e) { errs.push(e.message); });
  function log(k, v) { out.push(k + '=' + v); }
  function verdict(ok, good, bad) { if (!ok) fails++; return '  - ' + (ok ? good : bad); }

  function main() {
    var k = window.__kubik;

    /* ---- 1. it renders ---- */
    k.openHelp();
    var body = document.getElementById('helpBody');
    var secs = body.querySelectorAll('details.help-sec');
    var rows = body.querySelectorAll('.help-row');
    var titles = Array.prototype.map.call(
      body.querySelectorAll('.help-sec-title'), function (s) { return s.textContent; });
    var emptyTerm = 0;
    Array.prototype.forEach.call(body.querySelectorAll('.help-row .term'), function (t) {
      if (!t.textContent.trim()) emptyTerm++;
    });
    log('1.renders', secs.length + ' sections, ' + rows.length + ' rows, ' +
      emptyTerm + ' rows with no term' +
      verdict(secs.length >= 12 && rows.length >= 90 && emptyTerm === 0,
        'the whole card is built',
        'THE CARD IS SHORT OR HAS A BLANK ROW'));
    log('1b.sections', titles.join(' | '));

    /* ---- 2. every icon a row names exists ---- */
    var missing = [];
    var all = [].concat.apply([], k.HELP_SECTIONS.map(function (s) { return s.rows; }))
                .concat(k.HELP_KEYS);
    all.forEach(function (r) {
      if (!r[0]) return;
      var svg = k.icon(r[0], 17);
      // A missing glyph still returns an <svg> wrapper - it is the PATH inside
      // that is absent, so an empty body is the tell.
      if (!svg || !/<(path|rect|circle|line|polyline|polygon)/.test(svg)) missing.push(r[0]);
    });
    log('2.icons_exist', all.length + ' rows checked, ' +
      (missing.length ? 'missing: ' + missing.join(',') : 'none missing') +
      verdict(missing.length === 0,
        'every glyph a row asks for is in the table',
        'A ROW NAMES A GLYPH THAT DOES NOT EXIST'));

    /* ---- 3 + 4. the card and the rings agree ---- */
    var words = {};                       // every word the card prints as a term
    /* A term is not always one word. "CUT — a door" is the seat whose own
       label is "Cut"; "Group / Ungroup" is one seat that says either. Both
       are split down to the words a seat can actually show. */
    function addTerm(t) {
      t = String(t).toLowerCase().replace(/\s+—\s+a door$/, '');
      t.split('/').forEach(function (p) {
        p = p.trim(); if (p) words[p] = 1;
      });
    }
    k.HELP_SECTIONS.forEach(function (s) {
      s.rows.forEach(function (r) { addTerm(r[1]); });
      // Door rows list their contents in the description rather than as terms.
      s.rows.forEach(function (r) {
        String(r[2]).split(/[,.]/).forEach(function (p) {
          p = p.trim().toLowerCase(); if (p) words[p] = 1;
        });
      });
      if (s.lead) String(s.lead).split(/[,.]/).forEach(function (p) {
        p = p.trim().toLowerCase(); if (p) words[p] = 1;
      });
    });

    /* The object ring is asked for LIVE, with something selected, because the
       grouping seat is conditional and reports whichever of its two words
       applies - and a ring read from the constant alone would not have it at
       all. */
    k.setMode('object');
    if (k.App.objects.length) k.App.selectedObjectIds = new Set([k.App.objects[0].id]);
    k.refreshUI();
    var RINGS = { vertex: k.HUB_TOOLS_VERTEX, edge: k.HUB_TOOLS_EDGE,
                  face: k.HUB_TOOLS_FACE, world: k.HUB_TOOLS_WORLD,
                  object: k.currentHubTools() };
    var unlisted = [];
    Object.keys(RINGS).forEach(function (name) {
      RINGS[name].forEach(function (t) {
        var flat = [t].concat(t.door || []);
        flat.forEach(function (tool) {
          var w = String(k.toolLabel(tool)).toLowerCase().replace(/\s+/g, ' ');
          if (!words[w]) unlisted.push(name + '.' + tool.key + ' "' + w + '"');
        });
      });
    });
    log('3.every_seat_has_a_row',
      (unlisted.length ? unlisted.join('; ') : 'every seat and every door item is written up') +
      verdict(unlisted.length === 0,
        'nothing in a ring is missing from the card',
        'A TOOL IS IN THE APP AND NOT IN THE CARD'));

    /* 4. and the card does not promise a tool that is gone. Only the four
       tool sections are checked - the rest of the card is about gestures and
       panels, which have no ring entry by definition. */
    var live = {};
    Object.keys(RINGS).forEach(function (name) {
      RINGS[name].forEach(function (t) {
        [t].concat(t.door || []).forEach(function (tool) {
          live[String(k.toolLabel(tool)).toLowerCase().replace(/\s+/g, ' ')] = 1;
        });
      });
    });
    var TOOLSECS = { 'vertex tools': 1, 'edge tools': 1, 'face tools': 1, 'object tools': 1 };
    var ghosts = [];
    k.HELP_SECTIONS.forEach(function (s) {
      if (!TOOLSECS[String(s.title).toLowerCase()]) return;
      s.rows.forEach(function (r) {
        var w = String(r[1]).toLowerCase();
        if (/ — a door$/.test(w)) return;            // a door header, not a tool
        // A seat that says either of two words is written with both.
        var any = w.split('/').some(function (p) { return live[p.trim()]; });
        if (!any) ghosts.push(s.title + ' / ' + r[1]);
      });
    });
    log('4.no_ghost_tools',
      (ghosts.length ? ghosts.join('; ') : 'every tool row names a live seat') +
      verdict(ghosts.length === 0,
        'the card promises nothing the rings no longer have',
        'THE CARD NAMES A TOOL THAT IS GONE'));

    out.push('---');
    out.push('VERDICT=' + (fails ? 'FAIL' : 'PASS'));
    out.push('page.errors=' + (errs.length ? errs.join(' | ').slice(0, 400) : 'none'));
  }

  function finish() {
    var pre = document.createElement('pre');
    pre.id = 'probeOut';
    pre.textContent = '<<<PROBE\n' + out.join('\n') + '\nPROBE>>>';
    document.body.appendChild(pre);
    document.title = 'PROBE-DONE';
  }
  function ready(cb, t) {
    t = t || 0;
    if (window.__kubik && document.getElementById('helpBody')) return cb();
    if (t > 300) { out.push('ERROR=no __kubik'); return finish(); }
    setTimeout(function () { ready(cb, t + 1); }, 20);
  }
  setTimeout(function () {
    ready(function () {
      setTimeout(function () {
        try { main(); } catch (e) {
          out.push('ERROR=' + (e && e.stack ? e.stack.split('\n').slice(0, 6).join(' / ') : e));
        }
        finish();
      }, 600);
    });
  }, 300);
})();
