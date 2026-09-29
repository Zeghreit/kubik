/* Design pass: scene looks, tried live on Zeghreit's model (no code change).
   ?var=0 as is, 1 studio, 2 blueprint, 3 horizon. */
(async function () {
  const wait = ms => new Promise(r => setTimeout(r, ms));
  const post = b => { try { const x = new XMLHttpRequest(); x.open('POST', '/result', true); x.send(b); } catch (e) {} };
  try {
    while (!(window.__kubik && window.__kubik.App)) await wait(50);
    await wait(1500);
    const K = window.__kubik, T = K.THREE, S = K.scene;
    const v = +(new URLSearchParams(location.search).get('var') || 0);
    K.App.objects.slice().forEach(o => { try { o.mesh.parent.remove(o.mesh); } catch (e) {} }); K.App.objects.length = 0;
    K.setMode('object');
    const doc = await (await fetch('/_dev/female.json')).json();
    K.restoreDoc(doc); await wait(400);
    const A = K.App.objects[0];
    K.App.selectedObjectIds = new Set(); K.App.activeObjectId = null;
    const box = new T.Box3().setFromObject(A.mesh);
    K.frameBox(box);
    await wait(600);
    const H = box.max.y - box.min.y;
    const grad = (stops, radial) => {
      const c = document.createElement('canvas'); c.width = 16; c.height = 512;
      const g = c.getContext('2d'), L = g.createLinearGradient(0, 0, 0, 512);
      stops.forEach(([o, col]) => L.addColorStop(o, col)); g.fillStyle = L; g.fillRect(0, 0, 16, 512);
      const t = new T.CanvasTexture(c); t.colorSpace = T.SRGBColorSpace; return t;
    };
    // shader grid: fades with distance, a stronger line every 5, the two axes tinted
    const shaderGrid = (opt) => {
      const m = new T.ShaderMaterial({ transparent: true, depthWrite: false, fog: false,
        uniforms: { uMinor: { value: new T.Color(opt.minor) }, uMajor: { value: new T.Color(opt.major) }, uAxis: { value: new T.Color(opt.axis) },
                    uStep: { value: opt.step }, uFade: { value: opt.fade }, uDots: { value: opt.dots ? 1 : 0 }, uA: { value: opt.alpha } },
        vertexShader: 'varying vec3 vW; void main(){ vec4 w = modelMatrix * vec4(position,1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }',
        fragmentShader: `uniform vec3 uMinor,uMajor,uAxis; uniform float uStep,uFade,uDots,uA; varying vec3 vW;
          float line(vec2 p, float s, float w){ vec2 g = abs(fract(p/s - 0.5) - 0.5) / fwidth(p/s); return 1.0 - min(min(g.x,g.y)/w, 1.0); }
          float dots(vec2 p, float s){ vec2 q = abs(fract(p/s - 0.5) - 0.5) / fwidth(p/s); return 1.0 - min(length(q)/2.6, 1.0); }
          void main(){ vec2 p = vW.xz; float d = length(p - cameraPosition.xz * 0.0);
            float fade = 1.0 - smoothstep(uFade*0.35, uFade, length(p));
            float mi = uDots > 0.5 ? dots(p, uStep) : line(p, uStep, 1.3);
            float ma = line(p, uStep*5.0, 1.2);
            vec2 aw = abs(p) / fwidth(p); float ax = 1.0 - min(min(aw.x, aw.y)/1.5, 1.0);
            vec3 col = uMinor; float a = mi*0.9;
            if (ma > 0.0) { col = mix(col, uMajor, ma); a = max(a, ma*0.8); }
            if (ax > 0.0) { col = mix(col, uAxis, ax); a = max(a, ax*0.55); }
            gl_FragColor = vec4(col, a * fade * uA); }` });
      const g = new T.Mesh(new T.PlaneGeometry(1, 1), m); g.rotation.x = -Math.PI / 2; g.scale.setScalar(opt.fade * 2.2); g.position.y = box.min.y - 0.001;
      return g;
    };
    const hideGrid = () => S.traverse(o => { if (o.type === 'GridHelper' || (o.isLineSegments && o.geometry && o.geometry.type === 'BufferGeometry' && o.parent === S && !o.userData.keep)) o.visible = false; });
    let tag = 'as is';
    const step = H / 12;
    if (v === 1) {             // STUDIO: soft vertical gradient, fine fading grid, a warm key and a cool rim
      tag = 'studio';
      S.background = grad([[0, '#23272e'], [0.55, '#15171b'], [1, '#0c0d0f']]);
      S.fog = null; hideGrid();
      S.add(shaderGrid({ minor: 0x4b515b, major: 0x6b7380, axis: 0x8a9a3c, step: step, fade: H * 1.6, alpha: 0.9 }));
    } else if (v === 2) {      // BLUEPRINT: cool deep blue-black, dot grid, lime axes
      tag = 'blueprint';
      S.background = grad([[0, '#141b24'], [1, '#07090c']]);
      S.fog = null; hideGrid();
      S.add(shaderGrid({ minor: 0x56708f, major: 0x6f8cb0, axis: 0xc8f135, step: step, fade: H * 1.8, dots: true, alpha: 1 }));
    } else if (v === 3) {      // HORIZON: no grid, a lit floor fading into a horizon band
      tag = 'horizon';
      S.background = grad([[0, '#0d0e10'], [0.48, '#1d2026'], [0.52, '#2a2e35'], [1, '#101113']]);
      S.fog = null; hideGrid();
      const floor = new T.Mesh(new T.CircleGeometry(H * 1.2, 64), new T.ShaderMaterial({ transparent: true, depthWrite: false,
        vertexShader: 'varying vec2 vU; void main(){ vU = uv; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0); }',
        fragmentShader: 'varying vec2 vU; void main(){ float r = length(vU-0.5)*2.0; gl_FragColor = vec4(vec3(0.30,0.32,0.36), (1.0-smoothstep(0.0,1.0,r))*0.8); }' }));
      floor.rotation.x = -Math.PI / 2; floor.position.y = box.min.y - 0.001; S.add(floor);
    }
    if (v === 4 || v === 5) {  // STUDIO + a soft horizon: calm gradient, a gentle band at the horizon, a lit floor under the grid
      tag = v === 4 ? 'studio+horizon' : 'studio+horizon softer';
      const k = v === 4 ? 1 : 0.6;
      S.background = v === 4 ? grad([[0, '#1c1f24'], [0.47, '#171a1e'], [0.52, '#1f2227'], [0.6, '#141619'], [1, '#0e0f11']])
                             : grad([[0, '#1a1d21'], [0.46, '#16181c'], [0.52, '#1b1e22'], [0.62, '#131518'], [1, '#0e0f11']]);
      S.fog = null; hideGrid();
      const floor = new T.Mesh(new T.CircleGeometry(H * 1.4, 64), new T.ShaderMaterial({ transparent: true, depthWrite: false,
        uniforms: { uK: { value: k } },
        vertexShader: 'varying vec2 vU; void main(){ vU = uv; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0); }',
        fragmentShader: 'uniform float uK; varying vec2 vU; void main(){ float r = length(vU-0.5)*2.0; gl_FragColor = vec4(vec3(0.24,0.25,0.28), (1.0-smoothstep(0.0,1.0,r))*0.55*uK); }' }));
      floor.rotation.x = -Math.PI / 2; floor.position.y = box.min.y - 0.002; S.add(floor);
      S.add(shaderGrid({ minor: 0x4b515b, major: 0x6b7380, axis: 0x8a9a3c, step: step, fade: H * 1.6, alpha: v === 4 ? 0.8 : 0.65 }));
    }
    K.renderNow && K.renderNow();
    await wait(1500);
    post('var ' + v + ' ' + tag);
  } catch (e) { post('ERROR ' + e.stack); }
})();
