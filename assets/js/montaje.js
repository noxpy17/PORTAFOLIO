// Fondo de la portada: montaje de proyectos del portafolio. Ráfagas de cortes rápidos con glitch
// (franjas desplazadas y desfase RGB #df00f7 / cian) y, entre ráfaga y ráfaga, una imagen que se
// sostiene con un empuje lento de cámara. Las fotos van apagadas (semidesaturadas, con un velo violeta
// en las sombras y un toque cian en las luces); al pasar el cursor, una linterna revela la foto a todo color.
// El mouse también mueve la imagen (paralaje); un clic lanza una ráfaga.
(() => {
  const hero = document.querySelector('.hero');
  const canvas = hero && hero.querySelector('.hero-montaje');
  if (!canvas || !canvas.getContext) return;
  const ctx = canvas.getContext('2d');
  const quieto = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const NOMBRES = ['puntos-azules', 'gatozorro-portada', 'andina-refajo', 'naiza-120', 'dapper-portada', 'avianca-cargo',
    'la-liga-epm', 'andina-feria-cali', 'gatozorro-01', 'puntos-colombia', 'dapper'];
  const RAFAGA = { cortes: 7, ms: 95 };   // cortes rápidos por ráfaga y duración de cada uno
  const SOSTEN = 2200;                   // ms que se sostiene la imagen entre ráfagas
  const GLITCH = 160;                    // ms de glitch después de cada corte

  // Duotono de la marca: tabla de 256 tonos de luminancia a color
  const paradas = [[0, [5, 10, 10]], [0.32, [40, 8, 110]], [0.6, [127, 0, 255]], [0.82, [0, 237, 255]], [1, [235, 255, 255]]];
  const tabla = new Uint8ClampedArray(256 * 3);
  for (let i = 0; i < 256; i++) {
    const t = i / 255;
    let k = 0; while (k < paradas.length - 2 && t > paradas[k + 1][0]) k++;
    const [t0, c0] = paradas[k], [t1, c1] = paradas[k + 1];
    const f = (t - t0) / (t1 - t0);
    for (let j = 0; j < 3; j++) tabla[i * 3 + j] = c0[j] + (c1[j] - c0[j]) * f;
  }
  // Tono sutil: la foto conserva parte de su color, se desatura y se oscurece, y toma un poco del duotono
  const tono = (img) => {
    const c = document.createElement('canvas');
    c.width = img.naturalWidth; c.height = img.naturalHeight;
    const x = c.getContext('2d');
    x.drawImage(img, 0, 0);
    const d = x.getImageData(0, 0, c.width, c.height), p = d.data;
    for (let i = 0; i < p.length; i += 4) {
      // Luminancia con algo más de contraste
      let l = (p[i] * 0.299 + p[i + 1] * 0.587 + p[i + 2] * 0.114) / 255;
      l = Math.min(1, Math.max(0, (l - 0.5) * 1.25 + 0.5));
      const k = Math.round(l * 255) * 3, gris = l * 255;
      for (let j = 0; j < 3; j++) {
        const desat = p[i + j] * 0.45 + gris * 0.55;
        p[i + j] = (desat * 0.72 + tabla[k + j] * 0.28) * 0.82;
      }
    }
    x.putImageData(d, 0, 0);
    return c;
  };

  // Las imágenes se cargan en orden y entran al montaje a medida que llegan
  const listas = [];
  const base = (document.querySelector('script[src*="montaje.js"]').getAttribute('src').split('assets/js/')[0]) + 'assets/img/montaje/';
  NOMBRES.forEach((n, i) => {
    const img = new Image();
    img.decoding = 'async';
    img.onload = () => {
      listas.push({ i, lienzo: tono(img), color: img });
      listas.sort((a, b) => a.i - b.i);
      if (listas.length === 1) { medir(); despertar(); }
    };
    img.src = `${base}${n}.webp`;
  });

  // Copias teñidas (#df00f7 y cian) de la imagen actual para el desfase RGB: se tiñen una sola vez por corte
  const teñidas = { de: null, capas: [['#df00f7', -1], ['#00edff', 1]].map(([color, lado]) => ({ color, lado, c: document.createElement('canvas') })) };
  const teñir = (c) => {
    if (teñidas.de === c) return;
    teñidas.de = c;
    for (const t of teñidas.capas) {
      t.c.width = canvas.width; t.c.height = canvas.height;
      const x = t.c.getContext('2d');
      cubrir(c, 1, 0, 0, x);
      x.globalCompositeOperation = 'multiply';
      x.fillStyle = t.color;
      x.fillRect(0, 0, t.c.width, t.c.height);
    }
  };

  let W = 0, H = 0, escala = 1;
  // El lienzo trabaja a la resolución de las fotos (máx. 1280 px de ancho); la tarjeta gráfica lo estira
  const medir = () => {
    const r = hero.getBoundingClientRect();
    W = r.width * 1.12; H = r.height * 1.12;   // 12 % de margen para el empuje de cámara y el paralaje
    escala = Math.min(1, 1024 / W);
    canvas.width = Math.round(W * escala); canvas.height = Math.round(H * escala);
    teñidas.de = null;
    sucio = true;
  };

  // Mouse / dedo: paralaje suave y velocidad que alimenta el glitch
  const m = { x: 0, y: 0, tx: 0, ty: 0, vel: 0, ultimo: 0, px: 0, py: 0 };
  // Linterna: posición en píxeles del lienzo (con inercia) y opacidad (aparece y se apaga suave)
  const luz = { x: 0, y: 0, tx: 0, ty: 0, a: 0, ta: 0 };
  const apuntar = (cx, cy) => {
    const r = canvas.getBoundingClientRect();
    luz.tx = ((cx - r.left) / r.width) * canvas.width;
    luz.ty = ((cy - r.top) / r.height) * canvas.height;
    if (luz.a < 0.01) { luz.x = luz.tx; luz.y = luz.ty; }
    luz.ta = 1;
  };
  const mover = (cx, cy) => {
    const r = hero.getBoundingClientRect();
    const nx = (cx - r.left) / r.width - 0.5, ny = (cy - r.top) / r.height - 0.5;
    const ahora = performance.now(), dt = Math.max((ahora - m.ultimo) / 1000, 0.008);
    m.vel = Math.min(1, m.vel + Math.hypot(cx - m.px, cy - m.py) / dt / 6000);
    m.px = cx; m.py = cy; m.ultimo = ahora; m.tx = nx; m.ty = ny;
    apuntar(cx, cy);
    despertar();
  };
  hero.addEventListener('pointermove', (e) => mover(e.clientX, e.clientY), { passive: true });
  hero.addEventListener('touchmove', (e) => { const t = e.touches[0]; if (t) mover(t.clientX, t.clientY); }, { passive: true });
  hero.addEventListener('pointerleave', () => { luz.ta = 0; despertar(); });
  hero.addEventListener('touchend', () => { luz.ta = 0; despertar(); }, { passive: true });
  hero.addEventListener('pointerdown', (e) => { if (!e.target.closest('a, button')) { iniciarRafaga(3); despertar(); } });
  // La N se enciende (ver intro.js): ráfaga
  hero.addEventListener('noxpy:chispa', () => { iniciarRafaga(RAFAGA.cortes); despertar(); });

  // Estado del montaje
  let actual = 0, corteEn = 0, cortesRestantes = 0, proximoCorte = 0, sostenDesde = 0, encendido = quieto ? 1 : 0, t0 = 0;
  let semilla = 1, ultimoDibujo = null, sucio = true, cuadros = 0;
  const azar = () => { semilla = (semilla * 16807) % 2147483647; return semilla / 2147483647; };
  const iniciarRafaga = (n) => { cortesRestantes = n; proximoCorte = 0; };
  const cortar = (ahora) => {
    if (listas.length < 2) return;
    let siguiente; do { siguiente = Math.floor(Math.random() * listas.length); } while (siguiente === actual);
    actual = siguiente; corteEn = ahora; semilla = Math.floor(Math.random() * 1e6) + 1;
  };

  // Dibuja una imagen cubriendo el lienzo, con empuje de cámara y paralaje
  const cubrir = (c, zoom, dx, dy, destino) => {
    const cw = canvas.width, ch = canvas.height;
    const s = Math.max(cw / c.width, ch / c.height) * zoom;
    const w = c.width * s, h = c.height * s;
    destino.drawImage(c, (cw - w) / 2 + dx * escala, (ch - h) / 2 + dy * escala, w, h);
  };

  const dibujar = (ahora) => {
    const imgs = listas;
    if (!imgs.length) return;
    const cw = canvas.width, ch = canvas.height;
    const c = imgs[actual % imgs.length].lienzo;
    const enRafaga = cortesRestantes > 0;
    // Empuje de cámara y paralaje: los mueve la tarjeta gráfica (transform), sin redibujar
    const zoom = 1, dx = 0, dy = 0;
    const empuje = enRafaga ? 1.02 : 1 + Math.min((ahora - sostenDesde) / SOSTEN, 1) * 0.05;
    m.x += (m.tx - m.x) * 0.08; m.y += (m.ty - m.y) * 0.08;
    canvas.style.transform = `translate3d(${(-m.x * 26).toFixed(1)}px, ${(-m.y * 18).toFixed(1)}px, 0) scale(${empuje.toFixed(4)})`;
    // Solo se redibuja con un corte nuevo, mientras dura el glitch o si el mouse se mueve rápido
    const desde0 = ahora - corteEn;
    luz.x += (luz.tx - luz.x) * 0.18; luz.y += (luz.ty - luz.y) * 0.18;
    luz.a += (luz.ta - luz.a) * 0.12;
    const luzMoviendo = (luz.a > 0.01 && Math.hypot(luz.tx - luz.x, luz.ty - luz.y) > 0.5) || Math.abs(luz.ta - luz.a) > 0.01;
    const necesita = c !== ultimoDibujo || desde0 < GLITCH + 40 || m.vel > 0.02 || encendido < 1 || sucio || luzMoviendo;
    if (!necesita) return;
    // Durante el glitch basta con 30 cuadros por segundo (y se siente más entrecortado)
    if (c === ultimoDibujo && !sucio && !luzMoviendo && (cuadros++ & 1)) return;
    ultimoDibujo = c; sucio = false;

    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1;
    ctx.fillStyle = '#050a0a';
    ctx.fillRect(0, 0, cw, ch);
    ctx.globalAlpha = encendido;
    cubrir(c, zoom, dx, dy, ctx);

    // Glitch justo después de cada corte, y más fuerte si el mouse se mueve rápido
    const desde = ahora - corteEn;
    const g = Math.max(desde < GLITCH ? 1 - desde / GLITCH : 0, m.vel * 0.4);
    if (g > 0.02) {
      // Desfase RGB: copias teñidas desplazadas a cada lado
      const off = (6 + 22 * g) * escala;
      teñir(c);
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = 0.55 * g * encendido;
      for (const t of teñidas.capas) ctx.drawImage(t.c, off * t.lado, 0);
      // Franjas horizontales desplazadas
      ctx.globalCompositeOperation = 'source-over';
      ctx.globalAlpha = encendido;
      const franjas = 2 + Math.floor(g * 6);
      for (let i = 0; i < franjas; i++) {
        const y = azar() * ch, h = (4 + azar() * 46) * escala, corrimiento = (azar() - 0.5) * 120 * g * escala;
        ctx.drawImage(canvas, 0, y, cw, h, corrimiento, y, cw, h);
      }
    }
    // Linterna: la foto a todo color dentro de un círculo de bordes suaves que sigue al cursor
    if (luz.a > 0.01) {
      const item = imgs[actual % imgs.length];
      const R = Math.round(Math.min(cw, ch) * 0.24);
      if (lente.width !== R * 2) { lente.width = lente.height = R * 2; }
      const s = Math.max(cw / item.color.naturalWidth, ch / item.color.naturalHeight);
      const w = item.color.naturalWidth * s, h = item.color.naturalHeight * s;
      lctx.globalCompositeOperation = 'source-over';
      lctx.clearRect(0, 0, R * 2, R * 2);
      lctx.drawImage(item.color, (cw - w) / 2 - (luz.x - R), (ch - h) / 2 - (luz.y - R), w, h);
      lctx.globalCompositeOperation = 'destination-in';
      const gr = lctx.createRadialGradient(R, R, 0, R, R, R);
      gr.addColorStop(0, 'rgba(0,0,0,1)'); gr.addColorStop(0.55, 'rgba(0,0,0,.9)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
      lctx.fillStyle = gr;
      lctx.fillRect(0, 0, R * 2, R * 2);
      ctx.globalCompositeOperation = 'source-over';
      ctx.globalAlpha = luz.a * encendido;
      ctx.drawImage(lente, luz.x - R, luz.y - R);
    }
    ctx.globalAlpha = 1;
    m.vel *= 0.9;
  };
  const lente = document.createElement('canvas');
  const lctx = lente.getContext('2d');

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
  const despertar = () => {
    if (quieto) { medir(); dibujar(performance.now()); return; }
    if (!raf && visible && !document.hidden && listas.length) raf = requestAnimationFrame(cuadro);
  };

  medir();
  window.addEventListener('resize', () => { medir(); despertar(); });
  document.addEventListener('visibilitychange', despertar);
  // Fuera de pantalla no se dibuja nada
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(([e]) => { visible = e.isIntersecting; despertar(); }).observe(hero);
  }
})();
