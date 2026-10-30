// Portada: bruma con profundidad de cine (Three.js).
// Capas de niebla a distintas distancias; la cámara avanza lento entre ellas hacia
// una luz lejana y tenue. Penumbra, contraluz y rayos que atraviesan la bruma.
// En la intro, el logo horizontal sale de la bruma; después se queda en la escena,
// a un lado del titular, con refracción de agua y destellos cálidos (brandbook: texturas).
import * as THREE from '../vendor/three.module.min.js';

const hero = document.querySelector('.hero');
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// Estado de la intro, animado desde intro.js. Sin intro, el logo no aparece.
const intro = window.__noxpyIntro || (window.__noxpyIntro = { trace: 1, fill: 1, word: 1, clear: 0.35, collapse: 0, center: 0 });

const vertex = /* glsl */ `
  varying vec2 vUv;
  void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }
`;

const fragment = /* glsl */ `
  precision highp float;
  varying vec2 vUv;
  uniform float uTime;
  uniform float uScroll;
  uniform float uLight;
  uniform float uPulse;
  uniform float uPortrait;
  uniform vec2 uRes;
  uniform vec2 uMouse;
  uniform vec2 uLightPos;
  uniform vec3 uNegro;
  uniform vec3 uCian;
  uniform vec3 uVioleta;
  uniform vec3 uCalido;
  // Logo de la intro (R: wordmark, G: llama)
  uniform sampler2D uLogo;
  uniform vec2 uLogoSize;
  uniform vec2 uTexel;
  uniform vec2 uFlameC;
  uniform float uTrace;
  uniform float uFill;
  uniform float uWord;
  uniform float uClear;
  uniform float uCollapse;
  uniform float uWater;     // 0 en la intro, 1 cuando el logo ya está en reposo
  uniform float uCenter;    // 1 mientras dura la intro (foco al centro)
  uniform vec3 uCalidoL;

  float hash(vec2 p) { p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
  float noise(vec2 p) {
    vec2 i = floor(p), f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1, 0)), u.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), u.x), u.y);
  }
  const mat2 R = mat2(0.8, -0.6, 0.6, 0.8);
  float fbm(vec2 p) {
    float v = 0.0, a = 0.5;
    for (int i = 0; i < 5; i++) { v += a * noise(p); p = R * p * 2.02 + 3.1; a *= 0.5; }
    return v;
  }
  float fbm3(vec2 p) {
    float v = 0.0, a = 0.5;
    for (int i = 0; i < 3; i++) { v += a * noise(p); p = R * p * 2.03 + 1.7; a *= 0.5; }
    return v;
  }

  void main() {
    float aspect = uRes.x / uRes.y;
    vec2 uv = vUv;
    vec2 p = (uv - 0.5) * vec2(aspect, 1.0);
    vec2 par = uMouse - 0.5;                       // paralaje con el cursor
    vec2 L = (uLightPos - 0.5) * vec2(aspect, 1.0) + par * 0.05;
    float dl = length(p - L);

    // ---- Logo de la intro (detrás de la bruma) ----
    float present = 1.0 - uCollapse;
    vec3 logoCol = vec3(0.0);
    float logoA = 0.0;
    float logoLuz = 0.0;
    if (present > 0.001) {
      vec2 c = uLightPos + par * 0.05 / vec2(aspect, 1.0);
      float sc = 1.0 - 0.9 * uCollapse;            // se contrae hacia la luz
      vec2 luv = (uv - c) / (uLogoSize * sc) + 0.5;
      // Refracción de agua sobre el logo en reposo: bandas que suben y tuercen la forma
      float banda = fbm3(vec2(luv.x * 3.0 + sin(luv.y * 3.0) * 0.4, luv.y * 3.5 - uTime * 0.14));
      float agua = smoothstep(0.48, 0.64, banda) * uWater;
      float onda = sin(luv.y * 22.0 + banda * 9.0 - uTime * 1.4);
      luv += vec2(onda * 0.0035, onda * 0.006) * agua;     // sutil: el logo se lee siempre
      float filoAgua = smoothstep(0.38, 0.44, banda) * (1.0 - smoothstep(0.44, 0.54, banda)) * uWater;
      if (luv.x > 0.0 && luv.x < 1.0 && luv.y > 0.0 && luv.y < 1.0) {
        vec4 t = texture2D(uLogo, luv);
        float llama = t.g, palabra = t.r;
        float gmin = min(min(texture2D(uLogo, luv + vec2(uTexel.x, 0.0)).g, texture2D(uLogo, luv - vec2(uTexel.x, 0.0)).g),
                         min(texture2D(uLogo, luv + vec2(0.0, uTexel.y)).g, texture2D(uLogo, luv - vec2(0.0, uTexel.y)).g));
        float borde = clamp((llama - gmin) * 1.6, 0.0, 1.0);
        // Trazo de luz que recorre el contorno de la llama
        vec2 d = (luv - uFlameC) * vec2(uLogoSize.x / uLogoSize.y, 1.0);
        float ang = atan(d.y, d.x) / 6.2831853 + 0.5;
        float trazo = borde * smoothstep(ang - 0.04, ang, uTrace * 1.04);
        float aLlama = max(trazo * (1.0 - uFill), llama * uFill);
        // Wordmark: barrido de luz de izquierda a derecha
        float barrido = smoothstep(luv.x - 0.05, luv.x + 0.05, uWord * 1.1 - 0.05);
        float aPalabra = palabra * barrido;
        logoCol = mix(mix(uCian * 1.6, uCian, uFill), vec3(1.0), aPalabra);
        logoCol += uCalidoL * filoAgua * 0.9;                 // destello cálido en el filo del agua
        logoCol = mix(logoCol, logoCol * vec3(0.8, 0.92, 1.1), agua * 0.4);
        logoA = max(aLlama, aPalabra) * present;
      }
      logoLuz = (uTrace * 0.25 + uFill * 0.45) * present;
    }

    // Penumbra: la luz de fondo queda tenue, sin núcleo ni destello
    float on = max(uLight * (1.0 - uScroll * 0.6) * 0.5, logoLuz * 0.5);

    vec3 col = uNegro;
    col += uVioleta * exp(-dl * 3.4) * 0.3 * on;
    col += uVioleta * exp(-dl * 1.5) * 0.12 * on;

    // Capas de bruma de lejos a cerca. Cada capa avanza hacia la cámara y,
    // al pasarla, vuelve al fondo con la misma identidad (sin saltos).
    float travel = uTime * 0.028 + uScroll * 1.4;
    float k = floor(travel);
    float s = fract(travel);
    float abre = uClear * (1.0 - smoothstep(0.1, 0.6, dl));
    float T = 1.0;
    for (int i = 0; i < LAYERS; i++) {
      float fi = float(i);
      float z = (fi + s) / float(LAYERS);          // 0 lejos · 1 encima de la cámara
      float id = fi - k;
      float depth = mix(3.4, 0.32, z);
      float fade = smoothstep(0.0, 0.22, z) * (1.0 - smoothstep(0.72, 1.0, z));
      vec2 q = p * depth * 1.7 + par * (0.9 * z) + vec2(id * 7.31, id * 3.17)
             + vec2(uTime * 0.02 * (1.0 + z), uTime * 0.005);
      float w = fbm3(q * 0.6 + uTime * 0.025);
      float n = fbm(q + w * 1.8);
      n = clamp((n - 0.5) * 2.6 + 0.5, 0.0, 1.0);
      float d = n * n * fade * (1.0 - abre * 0.92);
      float lit = exp(-dl * (1.6 + z * 2.6)) * on * (0.3 + 0.9 * (1.0 - z));
      float borde = smoothstep(0.25, 0.55, n) * (1.0 - smoothstep(0.55, 0.95, n));
      vec3 luz = mix(uVioleta * 1.3, uCian * 1.1, exp(-dl * 3.2));
      vec3 ambiente = vec3(0.022, 0.03, 0.038) * (1.0 - z * 0.6);
      vec3 fog = uNegro + ambiente + luz * lit * (0.6 + borde * 1.1);
      col = mix(col, fog, d * 0.92);
      T *= 1.0 - d * 0.92;
    }

    // Rayos de luz que atraviesan los huecos de la bruma
    vec2 dir = (L - p) / 24.0;
    vec2 sp = p;
    float ill = 0.0, dec = 1.0;
    for (int j = 0; j < 24; j++) {
      sp += dir;
      float occ = smoothstep(0.42, 0.8, fbm3(sp * 1.3 + vec2(travel * 0.7, 0.0) + 11.0));
      ill += (1.0 - occ) * dec;
      dec *= 0.955;
    }
    ill /= 24.0;
    ill = ill * ill * 1.6;
    col += mix(uVioleta, uCian, 0.6) * ill * exp(-dl * 1.8) * 0.4 * on;
    col += uCian * exp(-dl * 3.0) * uPulse * 0.35;

    // Nada encima del texto: la luz se apaga hacia él (durante la intro no hay texto)
    float lado = mix(smoothstep(0.0, 0.62, uv.x), 1.0, uPortrait);
    float abajo = mix(1.0, smoothstep(0.0, 0.55, uv.y) * 0.8 + 0.2, uPortrait);
    float mascara = mix(mix(0.3, 1.0, lado) * abajo, 0.85, uCenter);
    col = mix(uNegro, col, mascara);
    // En la intro, la oscuridad cierra alrededor del logo como un foco
    col = mix(col, mix(uNegro, col, 0.12 + 0.88 * (1.0 - smoothstep(0.15, 1.0, dl))), uCenter);

    // Tono fílmico y viñeta
    col = col / (1.0 + col * 0.45) * 1.2;
    vec2 v = uv - 0.5;
    col *= 1.0 - dot(v, v) * 1.25;
    col = max(col, uNegro * 0.6);

    // El logo va detrás de la bruma, pero con su color exacto
    col = mix(col, logoCol, logoA * T);
    gl_FragColor = vec4(col, 1.0);
  }
`;

function loadTexture(src) {
  return new Promise((resolve) => {
    new THREE.TextureLoader().load(src, (t) => { t.minFilter = THREE.LinearFilter; resolve(t); }, undefined, () => resolve(null));
  });
}

// Centro de la llama (canal G) en la textura del logo, para que el trazo gire a su alrededor
function centroLlama(img) {
  const c = document.createElement('canvas');
  c.width = img.width; c.height = img.height;
  const ctx = c.getContext('2d');
  ctx.drawImage(img, 0, 0);
  const d = ctx.getImageData(0, 0, c.width, c.height).data;
  let sx = 0, sy = 0, n = 0;
  for (let y = 0; y < c.height; y += 2) {
    for (let x = 0; x < c.width; x += 2) {
      if (d[(y * c.width + x) * 4 + 1] > 128) { sx += x; sy += y; n++; }
    }
  }
  return n ? new THREE.Vector2(sx / n / c.width, 1 - sy / n / c.height) : new THREE.Vector2(0.25, 0.6);
}

async function start() {
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ antialias: false, alpha: false, powerPreference: 'high-performance' });
  } catch (e) {
    document.dispatchEvent(new Event('noxpy:sin-escena'));
    return; // Sin WebGL: queda el halo en CSS
  }
  const portrait = () => hero.clientWidth < 760;
  // La bruma es suave: se pinta a menor resolución; el logo pide un poco más
  const baseRatio = () => Math.min(window.devicePixelRatio, 1.25) * (portrait() ? 0.6 : 0.8);
  const sharpRatio = () => Math.min(window.devicePixelRatio, 1);
  let sharp = intro.center > 0;
  renderer.setPixelRatio(sharp ? sharpRatio() : baseRatio());
  renderer.outputColorSpace = THREE.LinearSRGBColorSpace;
  const canvas = renderer.domElement;
  canvas.setAttribute('aria-hidden', 'true');
  hero.prepend(canvas);

  const logoTex = await loadTexture('assets/img/logo-intro.png');
  const logoImg = logoTex && logoTex.image;

  const color = (name) => new THREE.Color(getComputedStyle(document.documentElement).getPropertyValue(name).trim()).convertLinearToSRGB();
  const uniforms = {
    uTime: { value: 0 },
    uScroll: { value: 0 },
    uLight: { value: 0 },
    uPulse: { value: 0 },
    uPortrait: { value: 0 },
    uRes: { value: new THREE.Vector2(1, 1) },
    uMouse: { value: new THREE.Vector2(0.5, 0.5) },
    uLightPos: { value: new THREE.Vector2(0.7, 0.58) },
    uNegro: { value: color('--negro') },
    uCian: { value: color('--cian') },
    uVioleta: { value: color('--violeta') },
    uCalido: { value: new THREE.Vector3(1.0, 0.62, 0.38) },
    uLogo: { value: logoTex },
    uLogoSize: { value: new THREE.Vector2(0.3, 0.1) },
    uTexel: { value: new THREE.Vector2(logoImg ? 2 / logoImg.width : 0.004, logoImg ? 2 / logoImg.height : 0.01) },
    uFlameC: { value: logoImg ? centroLlama(logoImg) : new THREE.Vector2(0.25, 0.6) },
    uTrace: { value: 0 },
    uFill: { value: 0 },
    uWord: { value: 0 },
    uClear: { value: 0 },
    uCollapse: { value: 1 },
    uWater: { value: 0 },
    uCenter: { value: 0 },
    uCalidoL: { value: new THREE.Vector3(1.0, 0.62, 0.38) },
  };
  const material = new THREE.ShaderMaterial({
    vertexShader: vertex, fragmentShader: fragment, uniforms,
    defines: { LAYERS: portrait() ? 4 : 6 },
  });
  const scene = new THREE.Scene();
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  scene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), material));

  // Luz en reposo (a un lado del titular, donde queda el logo) y luz de la intro (al centro)
  const rest = new THREE.Vector2(), center = new THREE.Vector2();
  const layout = () => {
    const w = hero.clientWidth, h = hero.clientHeight;
    renderer.setSize(w, h, false);
    uniforms.uRes.value.set(w, h);
    const pt = w < 760;
    uniforms.uPortrait.value = pt ? 1 : 0;
    const hr = hero.getBoundingClientRect();
    rest.set(pt ? 0.5 : 0.7, pt ? 0.72 : 0.56);
    center.set(0.5, pt ? 0.58 : 0.54);
    const aspectLogo = logoImg ? logoImg.height / logoImg.width : 0.27;
    const logoW = pt ? 0.78 : Math.min(0.34, 520 / w);
    uniforms.uLogoSize.value.set(logoW, logoW * aspectLogo * (w / h));
  };
  new ResizeObserver(() => { layout(); if (reduceMotion) render(); }).observe(hero);
  layout();

  const target = new THREE.Vector2(0.5, 0.5);
  hero.addEventListener('pointermove', (e) => {
    const r = hero.getBoundingClientRect();
    target.set((e.clientX - r.left) / r.width, 1 - (e.clientY - r.top) / r.height);
  });
  hero.addEventListener('pointerdown', () => { uniforms.uPulse.value = 1; });

  const render = () => renderer.render(scene, camera);
  hero.classList.add('has-webgl');
  window.__noxpyScene = true;
  document.dispatchEvent(new Event('noxpy:escena'));


  if (reduceMotion) {
    uniforms.uTime.value = 20; uniforms.uLight.value = 1; uniforms.uWater.value = 1;
    uniforms.uLightPos.value.copy(rest); render(); return;
  }

  // Al bajar, el texto sube un poco más lento que la página: profundidad
  const grid = hero.querySelector('.hero-grid');

  let visible = true, raf = 0, last = performance.now(), clock = 0;
  const loop = (now) => {
    const dt = Math.min(Math.max((now - last) / 1000, 0), 0.05); last = now;
    clock += dt;
    uniforms.uTime.value = clock;
    uniforms.uMouse.value.lerp(target, 0.04);
    uniforms.uPulse.value *= 0.95;
    const goal = window.__noxpyLight ?? 1;
    uniforms.uLight.value += (goal - uniforms.uLight.value) * 0.03;
    uniforms.uCenter.value = intro.center;
    uniforms.uWater.value = 1 - intro.center;
    uniforms.uTrace.value = intro.trace;
    uniforms.uFill.value = intro.fill;
    uniforms.uWord.value = intro.word;
    uniforms.uClear.value = intro.clear;
    uniforms.uCollapse.value = intro.collapse;
    uniforms.uLightPos.value.lerpVectors(rest, center, intro.center);
    const wantSharp = intro.center > 0.01;
    if (wantSharp !== sharp) { sharp = wantSharp; renderer.setPixelRatio(sharp ? sharpRatio() : baseRatio()); layout(); }

    const r = hero.getBoundingClientRect();
    const sc = Math.min(Math.max(-r.top / r.height, 0), 1);
    uniforms.uScroll.value += (sc - uniforms.uScroll.value) * 0.12;
    grid.style.transform = sc > 0 ? `translate3d(0, ${(sc * r.height * 0.18).toFixed(1)}px, 0)` : '';

    render();
    raf = visible && !document.hidden ? requestAnimationFrame(loop) : 0;
  };
  const resume = () => { if (!raf && visible && !document.hidden) { last = performance.now(); raf = requestAnimationFrame(loop); } };
  new IntersectionObserver(([e]) => { visible = e.isIntersecting; resume(); }).observe(hero);
  document.addEventListener('visibilitychange', resume);
  resume();
}

if (hero) start();
