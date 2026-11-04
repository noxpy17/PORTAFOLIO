// Fondo de la portada: montaje de proyectos del portafolio, dibujado con WebGL en la tarjeta gráfica.
// - Ritmo: ráfagas de cortes rápidos y, entre ráfaga y ráfaga, una imagen que se sostiene con un empuje
//   lento de cámara (el empuje y el paralaje los hace CSS, sin redibujar).
// - Gradación fría con rojos intensos: base gris azulada; los tonos cálidos (pieles, ropa, luces) se vuelven
//   rojo casi magenta y se estiran hacia un lado; desfase RGB leve, grano de película animado y bloom.
// - Cortes con glitch VHS: líneas de barrido, temblor vertical, banda de tracking, sangrado de color y ruido.
// - Hover: el cursor estira la imagen en la dirección del movimiento (azul del lado de la foto, rojo
//   hacia donde se estira) y la imagen vuelve sola a su lugar en unos segundos.
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
    uniform sampler2D uTex, uBloom, uEstela;   // uEstela: r = intensidad, g/b = dirección del movimiento
    uniform vec2 uRes, uCubre;          // resolución del lienzo y escala para cubrir con la imagen
    uniform float uGlitch, uT, uFade;
    float h(float n){ return fract(sin(n) * 43758.5453); }
    float h2(vec2 q){ return fract(sin(dot(q, vec2(12.9898, 78.233))) * 43758.5453); }
    vec2 cubrir(vec2 q){ return (q - .5) * uCubre + .5; }
    // Cuánto "cálido" tiene un color (rojos, naranjas, pieles): de ahí sale el rojo intenso
    float calor(vec3 c){ return smoothstep(.07, .3, c.r - max(c.g * .85, c.b)); }
    vec3 gradar(vec3 c){
      float l = dot(c, vec3(.299, .587, .114));
      // Base fría: casi sin saturación, con sombras azul petróleo y luces gris azulado
      vec3 frio = mix(vec3(l), c, .3) * vec3(.8, .9, 1.1) + vec3(.02, .035, .07) * (1. - l);
      // Cálidos: rojo intenso, casi magenta
      vec3 rojo = vec3(1., .1, .26) * (.22 + l * 1.25) + vec3(.2, .05, .1) * smoothstep(.6, 1., l);
      c = mix(frio, rojo, calor(c));
      c = (c - .5) * 1.14 + .5;                                    // contraste
      return clamp(c, 0., 1.) * .88;
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
      float sangra = .0015 + .004 * g;                            // desfase RGB leve siempre, más en los cortes
      vec2 q = cubrir(uv);
      vec3 c;
      c.r = texture2D(uTex, q + vec2(sangra, 0.)).r;
      c.g = texture2D(uTex, q).g;
      c.b = texture2D(uTex, q - vec2(sangra, 0.)).b;
      c = gradar(c);
      // Bloom: luces altas pre-desenfocadas, con la misma gradación
      c += gradar(texture2D(uBloom, q).rgb) * .55;
      // Rojos estirados: los cálidos se arrastran hacia un lado, como una foto movida con flash
      vec3 barrido = vec3(0.);
      for (int i = 1; i <= 7; i++) {
        float f = float(i) / 7.;
        vec3 m = texture2D(uTex, cubrir(uv - vec2(.055, .008) * f)).rgb;
        float lm = dot(m, vec3(.299, .587, .114));
        barrido = max(barrido, vec3(1., .12, .3) * (.25 + lm) * calor(m) * (1. - f) * .85);
      }
      c = 1. - (1. - c) * (1. - barrido);                          // se suma como luz (screen)
      // Estela del cursor: estira la foto en la dirección del movimiento (los píxeles se arrastran desde
      // atrás) y se relaja sola en unos segundos. Del lado de la foto se enfría a azul; hacia donde se
      // estira se calienta a naranja, con el rojo y el azul separados como en una exposición larga.
      // Estela suavizada (9 muestras) para que el estiramiento no quede dentado
      vec2 ue = vec2(v.x, 1. - v.y), px = vec2(2.4 / 320., 2.4 / 180.);   // misma orientación que el lienzo de la estela
      vec4 e = vec4(0.);
      for (int j = -1; j <= 1; j++) for (int i = -1; i <= 1; i++) e += texture2D(uEstela, ue + vec2(float(i), float(j)) * px);
      e /= 9.;
      float k = smoothstep(0., .6, e.r); k = k * k * (3. - 2. * k);   // transición doble: bordes muy suaves
      if (k > .001) {
        vec2 dir = (e.gb - .5) * 2.;
        dir = length(dir) > .02 ? normalize(dir) : vec2(1., 0.);
        // Desplazamiento: cada píxel toma la foto que quedó atrás; como la fuerza varía dentro de la estela,
        // la imagen se estira (no se emborrona). Unas pocas muestras cercanas dan el barrido suave
        vec2 atras = -dir * vec2(uRes.y / uRes.x, 1.) * .12 * k * k;   // 40 % del largo anterior
        vec3 suma = vec3(0.);
        for (int i = 0; i < 6; i++) {
          float f = .72 + float(i) / 5. * .28;
          vec2 o = atras * f;
          suma.r += texture2D(uTex, cubrir(uv + o * 1.06)).r;
          suma.g += texture2D(uTex, cubrir(uv + o)).g;
          suma.b += texture2D(uTex, cubrir(uv + o * .94)).b;
        }
        vec3 estirada = gradar(suma / 6.);
        // Color de la referencia: azul frío donde apenas se estira, naranja cálido donde más se arrastra
        float l = dot(estirada, vec3(.299, .587, .114));
        vec3 frio = vec3(.12, .42, .95) * (.25 + l * 1.5);
        vec3 calido = vec3(1., .14, .3) * (.3 + l * 1.7);
        vec3 tono = mix(frio, calido, smoothstep(.25, .9, k));
        c = mix(c, mix(estirada, tono, .42 * smoothstep(.2, .8, k)), k);   // el tono solo donde más se estira: bordes limpios
      }
      // VHS: líneas de barrido (siempre, muy suaves), ruido y desteñido en la banda
      c *= .965 + .035 * sin(v.y * uRes.y * 1.6);
      // Grano de película: grueso (2 px) y animado; más fuerte en los cortes
      c += (h2(floor(v * uRes / 1.6) + fract(uT * 7.3) * 91.) - .5) * (.085 + .14 * g);
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
    ['uTex', 'uBloom', 'uEstela', 'uRes', 'uCubre', 'uGlitch', 'uT', 'uFade'].forEach((n) => { uni[n] = gl.getUniformLocation(prog, n); });
    gl.uniform1i(uni.uTex, 0);
    gl.uniform1i(uni.uBloom, 1);
    gl.uniform1i(uni.uEstela, 2);
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
  let ultimoGrano = 0;
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

  // Estela del cursor: un lienzo pequeño (se estira en la tarjeta gráfica) donde el cursor pinta manchas suaves.
  // Rojo = intensidad; verde/azul = dirección del movimiento. Cada cuadro se desvanece un poco.
  const estela = document.createElement('canvas');
  estela.width = 320; estela.height = 180;
  const ectx = estela.getContext('2d');
  ectx.fillStyle = 'rgb(0,128,128)'; ectx.fillRect(0, 0, 320, 180);
  let estelaTex = null, estelaViva = 0;
  if (gl) {
    estelaTex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, estelaTex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, estela);
  }
  const pintarEstela = (x0, y0, x1, y1, vx, vy) => {
    const pasos = Math.max(1, Math.ceil(Math.hypot(x1 - x0, y1 - y0) / 3));
    const v = Math.hypot(vx, vy) || 1;
    const gC = Math.round(128 + (vx / v) * 127), bC = Math.round(128 + (vy / v) * 127);
    const fuerza = Math.min(1, v / 900);
    for (let i = 1; i <= pasos; i++) {
      const x = x0 + (x1 - x0) * (i / pasos), y = y0 + (y1 - y0) * (i / pasos);
      const R = 13 + fuerza * 11;   // 40 % del tamaño anterior
      const gr = ectx.createRadialGradient(x, y, 0, x, y, R);
      const a = 0.6 * fuerza + 0.25;
      // Caída gaussiana: sin borde marcado donde termina el efecto
      [[0, 1], [0.25, 0.85], [0.5, 0.5], [0.75, 0.16], [1, 0]].forEach(([t, k]) => gr.addColorStop(t, `rgba(255,${gC},${bC},${(a * k).toFixed(3)})`));
      ectx.fillStyle = gr;
      ectx.fillRect(x - R, y - R, R * 2, R * 2);
    }
    estelaViva = 1;
  };

  // Mouse / dedo: paralaje (CSS) y estela (sombreador)
  const m = { x: 0, y: 0, tx: 0, ty: 0, ex: -1, ey: -1, ultimo: 0 };
  const mover = (cx, cy) => {
    const r = hero.getBoundingClientRect(), rc = canvas.getBoundingClientRect();
    m.tx = (cx - r.left) / r.width - 0.5; m.ty = (cy - r.top) / r.height - 0.5;
    const ex = ((cx - rc.left) / rc.width) * 320, ey = ((cy - rc.top) / rc.height) * 180;
    const ahora = performance.now(), dt = Math.max((ahora - m.ultimo) / 1000, 0.008);
    if (m.ex >= 0 && ahora - m.ultimo < 120) {
      const vx = ((ex - m.ex) / 320) * rc.width / dt, vy = ((ey - m.ey) / 180) * rc.height / dt;
      pintarEstela(m.ex, m.ey, ex, ey, vx, vy);
    }
    m.ex = ex; m.ey = ey; m.ultimo = ahora;
    despertar();
  };
  hero.addEventListener('pointerleave', () => { m.ex = -1; });
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
    // La estela se desvanece hacia "sin intensidad y sin dirección"
    if (estelaViva > 0) {
      ectx.fillStyle = 'rgba(0,128,128,0.022)';   // se relaja en unos 3 segundos
      ectx.fillRect(0, 0, 320, 180);
      estelaViva *= 0.988;
      if (estelaViva < 0.02) { estelaViva = 0; ectx.fillStyle = 'rgb(0,128,128)'; ectx.fillRect(0, 0, 320, 180); }
      if (gl) { gl.activeTexture(gl.TEXTURE2); gl.bindTexture(gl.TEXTURE_2D, estelaTex); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, estela); }
      sucio = true;
    }
    // Solo se redibuja con un corte, durante el VHS, mientras vive la estela o mientras se enciende
    // El grano se renueva unas 12 veces por segundo, como película
    if (ahora - ultimoGrano > 83) { ultimoGrano = ahora; sucio = true; }
    if (!(sucio || g > 0.01 || encendido < 1)) return;
    sucio = false;

    const s = Math.max(W / item.w, H / item.h);
    if (gl) {
      gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, item.tex);
      gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, item.bloom);
      gl.uniform2f(uni.uRes, W, H);
      gl.uniform2f(uni.uCubre, W / (item.w * s), H / (item.h * s));
      gl.activeTexture(gl.TEXTURE2); gl.bindTexture(gl.TEXTURE_2D, estelaTex);
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
