// Fondo de la portada: montaje de proyectos del portafolio, dibujado con WebGL en la tarjeta gráfica.
// - Ritmo: ráfagas de cortes rápidos y, entre ráfaga y ráfaga, una imagen que se sostiene con un empuje
//   lento de cámara (el empuje y el paralaje los hace CSS, sin redibujar).
// - Gradación teal & orange: sombras verde azulado, luces y pieles naranja, con bloom en las luces altas.
// - Cortes con glitch VHS: líneas de barrido, temblor vertical, banda de tracking, sangrado de color y ruido.
// - Hover: el cursor deforma la imagen como agua, con separación RGB en el borde de la onda.
// Sin WebGL, las fotos se muestran con un oscurecido simple.
(() => {
  const hero = document.querySelector('.hero');
  const canvas = hero && hero.querySelector('.hero-montaje');
  if (!canvas) return;
  const quieto = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const NOMBRES = ['puntos-azules', 'gatozorro-portada', 'andina-refajo', 'naiza-120', 'dapper-portada', 'avianca-cargo',
    'la-liga-epm', 'andina-feria-cali', 'gatozorro-01', 'puntos-colombia', 'dapper'];
  const RAFAGA = { cortes: 7, ms: 95 };   // cortes rápidos por ráfaga y duración de cada uno
  const SOSTEN = 2200;                   // ms que se sostiene la imagen entre ráfagas
  const GLITCH = 260;                    // ms de VHS después de cada corte

  const gl = canvas.getContext('webgl', { alpha: false, antialias: false, premultipliedAlpha: false });
  const ctx2d = gl ? null : canvas.getContext('2d');

  // ---------- Sombreadores ----------
  const VERT = `attribute vec2 p; varying vec2 v; void main(){ v = p * .5 + .5; gl_Position = vec4(p, 0., 1.); }`;
  const FRAG = `
    precision mediump float;
    varying vec2 v;
    uniform sampler2D uTex, uBloom;
    uniform vec2 uRes, uCubre;          // resolución del lienzo y escala para cubrir con la imagen
    uniform vec2 uMouse;                 // cursor en coordenadas 0..1
    uniform float uLiquido, uGlitch, uT, uFade;
    float h(float n){ return fract(sin(n) * 43758.5453); }
    float h2(vec2 q){ return fract(sin(dot(q, vec2(12.9898, 78.233))) * 43758.5453); }
    vec2 cubrir(vec2 q){ return (q - .5) * uCubre + .5; }
    vec3 gradar(vec3 c){
      float l = dot(c, vec3(.299, .587, .114));
      c = mix(vec3(l), c, .82);                                   // un poco menos de saturación de base
      vec3 teal = vec3(.38, .86, 1.0), naranja = vec3(1.22, .78, .42);
      c *= mix(teal, naranja, smoothstep(.18, .72, l));           // teal en sombras, naranja en luces
      c = (c - .5) * 1.12 + .5;                                    // contraste
      return clamp(c, 0., 1.) * .86;
    }
    void main(){
      vec2 uv = vec2(v.x, 1. - v.y);
      float g = uGlitch;
      // VHS: temblor vertical, jitter por línea y banda de tracking
      uv.y += (h(floor(uT * 30.)) - .5) * .018 * g;
      float linea = floor(uv.y * 220.);
      uv.x += (h(linea + floor(uT * 60.)) - .5) * .012 * g;
      float banda = fract(uT * .9);
      float enBanda = smoothstep(.06, 0., abs(uv.y - banda)) * g;
      uv.x += enBanda * .035 * sin(uv.y * 400. + uT * 40.);
      // Líquido: ondas concéntricas alrededor del cursor
      vec2 asp = vec2(uRes.x / uRes.y, 1.);
      vec2 d = (uv - uMouse) * asp;
      float r = length(d);
      float onda = sin(r * 38. - uT * 7.) * exp(-r * 5.5) * uLiquido;
      vec2 dir = r > .0001 ? d / r : vec2(0.);
      vec2 off = dir / asp * onda * .022;
      float borde = abs(onda) * 1.6;                               // separación RGB donde la onda es más fuerte
      float sangra = .004 * g + .006 * borde;
      vec2 q = cubrir(uv + off);
      vec3 c;
      c.r = texture2D(uTex, q + vec2(sangra, 0.)).r;
      c.g = texture2D(uTex, q).g;
      c.b = texture2D(uTex, q - vec2(sangra, 0.)).b;
      c = gradar(c);
      // Bloom: luces altas pre-desenfocadas, con la misma gradación
      vec3 b = gradar(texture2D(uBloom, cubrir(uv + off * .5)).rgb);
      c += b * .55;
      // VHS: líneas de barrido (siempre, muy suaves), ruido y desteñido en la banda
      c *= .965 + .035 * sin(v.y * uRes.y * 1.6);
      c += (h2(v * uRes + uT) - .5) * (.03 + .16 * g);
      c = mix(c, vec3(dot(c, vec3(.33))) * 1.15, enBanda * .6);
      gl_FragColor = vec4(c * uFade, 1.);
    }`;

  let prog = null;
  const uni = {};
  if (gl) {
    const sh = (tipo, src) => { const s = gl.createShader(tipo); gl.shaderSource(s, src); gl.compileShader(s); return s; };
    prog = gl.createProgram();
    gl.attachShader(prog, sh(gl.VERTEX_SHADER, VERT));
    gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, FRAG));
    gl.linkProgram(prog);
    gl.useProgram(prog);
    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(prog, 'p');
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    ['uTex', 'uBloom', 'uRes', 'uCubre', 'uMouse', 'uLiquido', 'uGlitch', 'uT', 'uFade'].forEach((n) => { uni[n] = gl.getUniformLocation(prog, n); });
    gl.uniform1i(uni.uTex, 0);
    gl.uniform1i(uni.uBloom, 1);
  }
  const textura = (fuente) => {
    const t = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, t);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, fuente);
    return t;
  };
  // Bloom: se quedan solo las luces altas, a 1/12 del tamaño; al estirarlas en la tarjeta gráfica quedan difusas
  const luces = (img) => {
    const w = Math.max(8, Math.round(img.naturalWidth / 12)), hh = Math.max(8, Math.round(img.naturalHeight / 12));
    const c = document.createElement('canvas');
    c.width = w; c.height = hh;
    const x = c.getContext('2d');
    x.drawImage(img, 0, 0, w, hh);
    const d = x.getImageData(0, 0, w, hh), p = d.data;
    for (let i = 0; i < p.length; i += 4) {
      const l = (p[i] * 0.299 + p[i + 1] * 0.587 + p[i + 2] * 0.114) / 255;
      const k = Math.max(0, (l - 0.58) / 0.42) ** 1.5;
      p[i] *= k; p[i + 1] *= k; p[i + 2] *= k;
    }
    x.putImageData(d, 0, 0);
    // Una pasada más chica y de vuelta, para ablandar
    const c2 = document.createElement('canvas');
    c2.width = Math.max(4, w >> 1); c2.height = Math.max(4, hh >> 1);
    c2.getContext('2d').drawImage(c, 0, 0, c2.width, c2.height);
    x.clearRect(0, 0, w, hh);
    x.drawImage(c2, 0, 0, w, hh);
    return c;
  };

  let W = 0, H = 0;
  let actual = 0, corteEn = -1e9, cortesRestantes = 0, proximoCorte = 0, sostenDesde = 0, encendido = quieto ? 1 : 0, t0 = 0, sucio = true;

  // El lienzo trabaja a la resolución de las fotos (máx. 1280 px de ancho); la tarjeta gráfica lo estira
  const medir = () => {
    const r = hero.getBoundingClientRect();
    const w = r.width * 1.12, hh = r.height * 1.12;   // 12 % de margen para el empuje de cámara y el paralaje
    const e = Math.min(1, 1280 / w);
    W = canvas.width = Math.round(w * e); H = canvas.height = Math.round(hh * e);
    if (gl) gl.viewport(0, 0, W, H);
    sucio = true;
  };

  // Las imágenes se cargan en orden y entran al montaje a medida que llegan
  const listas = [];
  const base = document.querySelector('script[src*="montaje.js"]').getAttribute('src').split('assets/js/')[0] + 'assets/img/montaje/';
  NOMBRES.forEach((n, i) => {
    const img = new Image();
    img.decoding = 'async';
    img.onload = () => {
      const item = { i, img, w: img.naturalWidth, h: img.naturalHeight };
      if (gl) { item.tex = textura(img); item.bloom = textura(luces(img)); }
      listas.push(item);
      listas.sort((a, b) => a.i - b.i);
      if (listas.length === 1) { medir(); despertar(); }
    };
    img.src = `${base}${n}.webp`;
  });

  // Mouse / dedo: paralaje (CSS) y onda líquida (sombreador)
  const m = { x: 0, y: 0, tx: 0, ty: 0, ux: 0.5, uy: 0.5, liq: 0, px: 0, py: 0, ultimo: 0 };
  const mover = (cx, cy) => {
    const r = hero.getBoundingClientRect(), rc = canvas.getBoundingClientRect();
    m.tx = (cx - r.left) / r.width - 0.5; m.ty = (cy - r.top) / r.height - 0.5;
    m.ux = (cx - rc.left) / rc.width; m.uy = (cy - rc.top) / rc.height;
    const ahora = performance.now(), dt = Math.max((ahora - m.ultimo) / 1000, 0.008);
    // La onda crece con la velocidad del cursor y se calma sola
    m.liq = Math.min(1, m.liq + Math.hypot(cx - m.px, cy - m.py) / dt / 2500 + 0.04);
    m.px = cx; m.py = cy; m.ultimo = ahora;
    despertar();
  };
  hero.addEventListener('pointermove', (e) => mover(e.clientX, e.clientY), { passive: true });
  hero.addEventListener('touchmove', (e) => { const t = e.touches[0]; if (t) mover(t.clientX, t.clientY); }, { passive: true });
  hero.addEventListener('pointerdown', (e) => { if (!e.target.closest('a, button')) { iniciarRafaga(3); despertar(); } });
  // La N se enciende (ver intro.js): ráfaga
  hero.addEventListener('noxpy:chispa', () => { iniciarRafaga(RAFAGA.cortes); despertar(); });

  const iniciarRafaga = (n) => { cortesRestantes = n; proximoCorte = 0; };
  const cortar = (ahora) => {
    if (listas.length < 2) return;
    let siguiente; do { siguiente = Math.floor(Math.random() * listas.length); } while (siguiente === actual);
    actual = siguiente; corteEn = ahora; sucio = true;
  };

  const dibujar = (ahora) => {
    if (!listas.length) return;
    const item = listas[actual % listas.length];
    const enRafaga = cortesRestantes > 0;
    // Empuje de cámara y paralaje: los mueve la tarjeta gráfica (transform), sin redibujar
    const empuje = enRafaga ? 1.02 : 1 + Math.min((ahora - sostenDesde) / SOSTEN, 1) * 0.05;
    m.x += (m.tx - m.x) * 0.08; m.y += (m.ty - m.y) * 0.08;
    canvas.style.transform = `translate3d(${(-m.x * 26).toFixed(1)}px, ${(-m.y * 18).toFixed(1)}px, 0) scale(${empuje.toFixed(4)})`;

    const desde = ahora - corteEn;
    const g = Math.max(desde < GLITCH ? 1 - desde / GLITCH : 0, enRafaga ? 0.25 : 0);
    m.liq *= 0.95;
    // Solo se redibuja con un corte, durante el VHS, mientras ondula el agua o mientras se enciende
    if (!(sucio || g > 0.01 || m.liq > 0.01 || encendido < 1)) return;
    sucio = false;

    const s = Math.max(W / item.w, H / item.h);
    if (gl) {
      gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, item.tex);
      gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, item.bloom);
      gl.uniform2f(uni.uRes, W, H);
      gl.uniform2f(uni.uCubre, W / (item.w * s), H / (item.h * s));
      gl.uniform2f(uni.uMouse, m.ux, m.uy);
      gl.uniform1f(uni.uLiquido, m.liq);
      gl.uniform1f(uni.uGlitch, g);
      gl.uniform1f(uni.uT, (ahora - t0) / 1000);
      gl.uniform1f(uni.uFade, encendido);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    } else {
      const w = item.w * s, hh = item.h * s;
      ctx2d.globalAlpha = 1; ctx2d.fillStyle = '#050a0a'; ctx2d.fillRect(0, 0, W, H);
      ctx2d.globalAlpha = 0.75 * encendido;
      ctx2d.drawImage(item.img, (W - w) / 2, (H - hh) / 2, w, hh);
    }
  };

  let raf = 0, visible = true;
  const cuadro = (ahora) => {
    raf = 0;
    if (!visible || document.hidden) return;
    if (!t0) { t0 = ahora; sostenDesde = ahora; iniciarRafaga(RAFAGA.cortes); }
    encendido = Math.min(1, (ahora - t0) / 900);
    // Ritmo: ráfaga de cortes rápidos → imagen sostenida → nueva ráfaga
    if (cortesRestantes > 0) {
      if (ahora >= proximoCorte) {
        cortar(ahora);
        cortesRestantes--;
        proximoCorte = ahora + RAFAGA.ms * (0.7 + Math.random() * 0.6);
        if (cortesRestantes === 0) sostenDesde = ahora;
      }
    } else if (ahora - sostenDesde > SOSTEN) {
      iniciarRafaga(RAFAGA.cortes);
    }
    dibujar(ahora);
    raf = requestAnimationFrame(cuadro);
  };
  function despertar() {
    if (quieto) { if (!t0) t0 = performance.now(); sucio = true; dibujar(performance.now()); return; }
    if (!raf && visible && !document.hidden && listas.length) raf = requestAnimationFrame(cuadro);
  }

  medir();
  window.addEventListener('resize', () => { medir(); despertar(); });
  document.addEventListener('visibilitychange', despertar);
  // Fuera de pantalla no se dibuja nada
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(([e]) => { visible = e.isIntersecting; despertar(); }).observe(hero);
  }
})();
