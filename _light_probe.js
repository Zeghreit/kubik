/* a2.95 - the headlight rig. Every assertion is a MEASUREMENT of the real
   light objects and the real OrbitControls angle, not an inference from
   what a render looks like. */
(function () {
  var out = [], errs = [];
  var _ce = console.error;
  console.error = function () { errs.push(Array.prototype.join.call(arguments, ' ')); _ce.apply(console, arguments); };
  function log(k, v) { out.push(k + '=' + v); }
  function azOf(light) {
    // Same convention as envDirFromAzEl: atan2(x, z), in degrees.
    return Math.atan2(light.position.x, light.position.z) * 180 / Math.PI;
  }
  function wrap180(d) {
    d = ((d + 180) % 360 + 360) % 360 - 180;
    return d;
  }
  function orbitAzDeltaDeg(deltaDeg, k) {
    var cam = k.camera, t = k.orbit.target;
    var offX = cam.position.x - t.x, offZ = cam.position.z - t.z, offY = cam.position.y - t.y;
    var r = Math.hypot(offX, offZ);
    var curAz = Math.atan2(offX, offZ);
    var newAz = curAz + deltaDeg * Math.PI / 180;
    cam.position.set(t.x + r * Math.sin(newAz), t.y + offY, t.z + r * Math.cos(newAz));
    k.orbit.update();
  }

  function main() {
    var k = window.__kubik, A = k.App;

    log('0.baseline_rotation', A.env.rotation);
    log('0.baseline_cameraTurnDeg', k.cameraTurnDeg().toFixed(3));
    log('0.baseline_ok', A.env.rotation === 0 && Math.abs(k.cameraTurnDeg()) < 0.01 ? 'yes' : 'NO');

    var az0 = { dir: azOf(k.dir), fill: azOf(k.fill), rim: azOf(k.rimLight) };
    var envRot0 = k.scene.environmentRotation.y;
    log('1.az0', JSON.stringify(az0));

    // Orbit the camera +40 degrees in azimuth, same as a real drag would -
    // the 'change' listener this ships fires from orbit.update() itself.
    orbitAzDeltaDeg(40, k);
    var turn1 = k.cameraTurnDeg();
    log('2.cameraTurnDeg_after_+40', turn1.toFixed(3));
    log('2.tracks_camera', Math.abs(turn1 - 40) < 0.5 ? 'yes' : 'NO - ' + turn1);
    var az1 = { dir: azOf(k.dir), fill: azOf(k.fill), rim: azOf(k.rimLight) };
    ['dir', 'fill', 'rim'].forEach(function (n) {
      var d = wrap180(az1[n] - az0[n]);
      log('2.' + n + '_shift', d.toFixed(2));
      log('2.' + n + '_ok', Math.abs(d - 40) < 0.5 ? 'yes' : 'NO');
    });
    var envShift = wrap180((k.scene.environmentRotation.y - envRot0) * 180 / Math.PI);
    log('2.env_rotation_shift', envShift.toFixed(2));
    log('2.env_rotation_ok', Math.abs(envShift - 40) < 0.5 ? 'yes' : 'NO');

    log('3.manual_rotation_untouched_by_orbit', A.env.rotation === 0 ? 'yes' : 'NO - ' + A.env.rotation);

    // The manual gesture writes App.env.rotation then calls applyEnvLive(),
    // same as lightSlideMove does - it should ADD to the camera turn, not
    // replace it.
    A.env.rotation = 25;
    k.applyEnvLive();
    var az2 = { dir: azOf(k.dir), fill: azOf(k.fill), rim: azOf(k.rimLight) };
    ['dir', 'fill', 'rim'].forEach(function (n) {
      var d = wrap180(az2[n] - az0[n]);
      log('4.' + n + '_shift_with_manual25', d.toFixed(2));
      log('4.' + n + '_ok', Math.abs(d - 65) < 0.5 ? 'yes' : 'NO');
    });
    // Round trip: back to home azimuth and rotation 0 should reproduce az0
    // exactly, not drift.
    orbitAzDeltaDeg(-40, k);
    A.env.rotation = 0;
    k.applyEnvLive();
    var az3 = { dir: azOf(k.dir), fill: azOf(k.fill), rim: azOf(k.rimLight) };
    ['dir', 'fill', 'rim'].forEach(function (n) {
      var d = wrap180(az3[n] - az0[n]);
      log('5.' + n + '_roundtrip_drift', d.toFixed(3));
      log('5.' + n + '_ok', Math.abs(d) < 0.05 ? 'yes' : 'NO');
    });
    log('5.homeCamAzDeg', k.homeCamAzDeg.toFixed(3));

    // A pan changes camera.position without changing azimuth - the change
    // listener should see no-op turn and the epsilon guard should skip the
    // recompute (light positions unchanged).
    var az4before = { dir: azOf(k.dir), fill: azOf(k.fill), rim: azOf(k.rimLight) };
    k.orbit.target.set(0.3, 0.1, -0.2);
    k.camera.position.x += 0.3; k.camera.position.y += 0.1; k.camera.position.z += -0.2;
    k.orbit.update();
    var az4after = { dir: azOf(k.dir), fill: azOf(k.fill), rim: azOf(k.rimLight) };
    log('6.pan_leaves_lights_alone', JSON.stringify(az4before) === JSON.stringify(az4after) ? 'yes' : 'NO - ' + JSON.stringify(az4after));

    log('console.errors', errs.length ? errs.join(' | ').slice(0, 400) : 'none');
  }

  window.addEventListener('error', function (e) { errs.push('onerror: ' + (e.message || e) + ' @' + (e.lineno || '')); });
  function ready(cb, t) {
    t = t || 0;
    if (window.__kubik && window.__kubik.App) return cb();
    if (t > 250) {
      out.push('ERROR=no __kubik after ' + (t * 20) + 'ms');
      out.push('page.errors=' + (errs.length ? errs.join(' | ').slice(0, 600) : 'none'));
      return finish();
    }
    setTimeout(function () { ready(cb, t + 1); }, 20);
  }
  function finish() {
    var pre = document.createElement('pre');
    pre.id = 'probeOut';
    pre.textContent = '<<<PROBE\n' + out.join('\n') + '\nPROBE>>>';
    document.body.appendChild(pre);
    document.title = 'PROBE-DONE';
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
