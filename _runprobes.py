# Runs the probe suites and files each result under a named folder, so an
# after-run can be DIFFED against a before-run. Stale _*_out.txt files are
# deleted first - the one failure mode this project has hit before is reading
# yesterday's output as today's pass.
import io, os, shutil, subprocess, sys, time

ROOT = r'C:\Users\a.bodrov\Projects\kubik'
PAIRS = [
    ('_ops_probe.py', '_ops_out.txt'), ('_bug_probe.py', '_bug_out.txt'),
    ('_circ_probe.py', '_circ_out.txt'), ('_perf_probe.py', '_perf_out.txt'),
    ('_geo_probe.py', '_geo_out.txt'), ('_geo_probe2.py', '_geo2_out.txt'),
    ('_prim_probe.py', '_prim_out.txt'), ('_piv_probe.py', '_piv_out.txt'),
    ('_flow_probe.py', '_flow_out.txt'), ('_snap_probe.py', '_snap_out.txt'),
    ('_iso_probe.py', '_iso_out.txt'), ('_iso2_probe.py', '_iso2_out.txt'),
    ('_soft_probe.py', '_soft_out.txt'), ('_soft2_probe.py', '_soft2_out.txt'),
    ('_soft3_probe.py', '_soft3_out.txt'), ('_tw_probe.py', '_tw_out.txt'),
    ('_sviz_probe.py', '_sviz_out.txt'), ('_sel_probe.py', '_sel_out.txt'),
    # Appended, so 0..17 keep the indices the before/after runs were taken at.
    ('_shade_probe.py', '_shade_out.txt'), ('_axis_probe.py', '_axis_out.txt'),
    ('_lock_probe.py', '_lock_out.txt'), ('_theme_probe.py', '_theme_out.txt'),
    # a2.65a. Appended for the same reason as the block above: 0..21 keep the
    # indices every before/after run so far was taken at.
    ('_mat_probe.py', '_mat_out.txt'),
    # a2.68. Appended for the same reason as the blocks above.
    ('_imp_probe.py', '_imp_out.txt'),
    # a2.70. Appended for the same reason as the blocks above: 0..23 keep the
    # indices every before/after run so far was taken at.
    ('_obj_probe.py', '_obj_out.txt'),
    # a2.72. Appended for the same reason as the blocks above: 0..24 keep the
    # indices every before/after run so far was taken at.
    ('_pick_probe.py', '_pick_out.txt'),
    # a2.73. Appended for the same reason as the blocks above: 0..25 keep the
    # indices every before/after run so far was taken at.
    ('_vfx_probe.py', '_vfx_out.txt'),
    # a2.78. Appended for the same reason as the blocks above: 0..26 keep the
    # indices every before/after run so far was taken at.
    ('_array_probe.py', '_array_out.txt'),
    # a2.79. Appended for the same reason as the blocks above: 0..27 keep the
    # indices every before/after run so far was taken at.
    ('_solid_probe.py', '_solid_out.txt'),
    # a2.80. Appended for the same reason as the blocks above: 0..28 keep the
    # indices every before/after run so far was taken at.
    ('_slide_probe.py', '_slide_out.txt'),
    # a2.81. Appended for the same reason as the blocks above: 0..29 keep the
    # indices every before/after run so far was taken at.
    ('_clean_probe.py', '_clean_out.txt'),
    # a2.102. Appended for the same reason as the blocks above: 0..30 keep the
    # indices every before/after run so far was taken at.
    ('_amt_probe.py', '_amt_out.txt'),
    # a2.110 / a2.113. Appended for the same reason as the blocks above: 0..31
    # keep the indices every before/after run so far was taken at. The ring's
    # bearings and doors, and the vertex bevel's geometry.
    ('_door_probe.py', '_door_out.txt'),
    ('_vbev_probe.py', '_vbev_out.txt'),
    # v2.0a, appended for the same reason as every block above: the help card,
    # checked against the rings it claims to describe.
    ('_help_probe.py', '_help_out.txt'),
]

dest = os.path.join(ROOT, sys.argv[1])
lo = int(sys.argv[2]) if len(sys.argv) > 2 else 0
hi = int(sys.argv[3]) if len(sys.argv) > 3 else len(PAIRS)
if not os.path.isdir(dest):
    os.makedirs(dest)

lines = []
for script, outf in PAIRS[lo:hi]:
    p = os.path.join(ROOT, outf)
    if os.path.exists(p):
        os.remove(p)
    def run_once():
        return subprocess.run([sys.executable, script], cwd=ROOT, capture_output=True,
                              text=True, encoding='utf-8', errors='replace', timeout=400)
    r = run_once()
    # A BEAT BEFORE THE RETRY. The one probe that still fails inside the suite
    # and passes alone is _imp_probe, which fetches GLTFExporter over the
    # network INSIDE a virtual clock - so it is racing a real round trip while
    # the clock runs at machine speed, and it loses that race under the load of
    # the Chrome that has just exited. Retrying instantly retries into the same
    # load; three seconds is enough for the previous browser to be gone.
    if os.path.exists(p) and io.open(p, encoding='utf-8').read(15) == 'NO PROBE OUTPUT':
        time.sleep(3)
    # A probe that writes its OWN 'NO PROBE OUTPUT' file is not a missing
    # file, so the loop below used to file it as `ok` with a byte count and
    # the run looked green. _imp_probe fetches GLTFExporter over the network
    # and loses that race maybe one batch in one, while passing every time it
    # is run alone. Retried once, and named for what it is if it fails twice.
    if os.path.exists(p) and io.open(p, encoding='utf-8').read(15) == 'NO PROBE OUTPUT':
        os.remove(p)
        r = run_once()
    if os.path.exists(p) and io.open(p, encoding='utf-8').read(15) == 'NO PROBE OUTPUT':
        shutil.copyfile(p, os.path.join(dest, outf))
        lines.append('%-18s NO PROBE OUTPUT (twice)' % script)
        continue
    if os.path.exists(p):
        shutil.copyfile(p, os.path.join(dest, outf))
        lines.append('%-18s ok  %d bytes' % (script, os.path.getsize(p)))
    else:
        io.open(os.path.join(dest, outf), 'w', encoding='utf-8').write(
            'NO OUTPUT\n' + (r.stdout or '')[-800:] + '\n--stderr--\n' + (r.stderr or '')[-800:])
        lines.append('%-18s NO OUTPUT' % script)

io.open(os.path.join(dest, '_run.txt'), 'w', encoding='utf-8').write('\n'.join(lines) + '\n')
