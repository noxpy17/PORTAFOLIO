// Fondo de la portada: brasas de la marca (cian, violeta, magenta, rosa y blanco) que suben despacio,
// se apartan y se encienden alrededor del cursor o del dedo, dejan chispas al moverlo rápido,
// estallan al hacer clic y salen disparadas de la N cuando la llama se enciende.
(() => {
  const hero = document.querySelector('.hero');
  const canvas = hero && hero.querySelector('.hero-brasas');
  if (!canvas || !canvas.getContext) return;
  const ctx = canvas.getContext('2d');
  const quieto = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // Paleta de la marca y cuánto pesa cada color en la mezcla
  const COLORES = [[0, 237, 255], [127, 0, 255], [223, 0, 247], [255, 0, 122], [255, 255, 255]];
  const PESOS = [0.34, 0.22, 0.2, 0.13, 0.11];
  // Cada brasa se dibuja con un brillo pre-calculado: núcleo blanco y halo de su color
  const brillos = COLORES.map(([r, g, b]) => {
    const s = 64;
    const c = document.createElement('canvas');
    c.width = c.height = s;
    const x = c.getContext('2d');
    const gr = x.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
    gr.addColorStop(0, 'rgba(255,255,255,1)');
    gr.addColorStop(0.1, `rgba(${r},${g},${b},.95)`);
    gr.addColorStop(0.35, `rgba(${r},${g},${b},.3)`);
    gr.addColorStop(1, `rgba(${r},${g},${b},0)`);
    x.fillStyle = gr;
    x.fillRect(0, 0, s, s);
    return c;
  });
  const color = () => { let r = Math.random(), i = 0; while (r > PESOS[i] && i < PESOS.length - 1) { r -= PESOS[i]; i++; } return i; };

  let W = 0, H = 0, escala = 1;
  const ambiente = [];   // brasas que flotan siempre
  const chispas = [];    // chispas de estallidos y estelas, con vida corta
  const MAX_CHISPAS = 450;

  // Profundidad: z cerca de 0 = brasa lejana, fina y lenta; cerca de 1 = brasa cercana, grande,
  // desenfocada y más rápida (como bokeh delante de la cámara)
  const nuevaBrasa = (y) => {
    const z = Math.random() ** 2.2;
    const vy = -(12 + Math.random() * 30) * (0.6 + z * 1.8);
    return {
      x: Math.random() * W, y: y ?? Math.random() * H, z,
      vx: 0, vy, bx: (Math.random() - 0.5) * 12, by: vy,
      r: (0.6 + Math.random() * Math.random() * 2.4) * (1 + z * 4.5), c: color(),
      fase: Math.random() * 6.28, ritmo: 0.8 + Math.random() * 2.2, luz: 0,
    };
  };
  const chispa = (x, y, fuerza, color0) => {
    if (chispas.length >= MAX_CHISPAS) chispas.shift();
    const a = Math.random() * 6.283;
    const v = fuerza * (0.25 + Math.random() * 0.75);
    chispas.push({
      x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - fuerza * 0.15,
      r: 0.5 + Math.random() * 1.8, c: color0 ?? color(), t: 0, vida: 0.7 + Math.random() * 1.1,
    });
  };
  const estallar = (x, y, n, fuerza) => { for (let i = 0; i < n; i++) chispa(x, y, fuerza); };

  const medir = () => {
    const r = hero.getBoundingClientRect();
    escala = Math.min(window.devicePixelRatio || 1, 1.5);
    W = r.width; H = r.height;
    canvas.width = Math.round(W * escala);
    canvas.height = Math.round(H * escala);
    // Densidad según el área: protagonista en escritorio, más liviano en celular
    const meta = Math.round(Math.min(Math.max((W * H) / 1500, 160), 820));
    while (ambiente.length < meta) ambiente.push(nuevaBrasa());
    ambiente.length = meta;
  };

  // Cursor o dedo: posición, velocidad y si está dentro de la portada
  const p = { x: -1e4, y: -1e4, vx: 0, vy: 0, dentro: false, ultimo: 0 };
  const mover = (cx, cy) => {
    const r = hero.getBoundingClientRect();
    const x = cx - r.left, y = cy - r.top;
    const ahora = performance.now();
    const dt = Math.max((ahora - p.ultimo) / 1000, 0.008);
    if (p.dentro) { p.vx = (x - p.x) / dt; p.vy = (y - p.y) / dt; }
    p.x = x; p.y = y; p.ultimo = ahora; p.dentro = true;
    despertar();
  };
  hero.addEventListener('pointermove', (e) => mover(e.clientX, e.clientY), { passive: true });
  hero.addEventListener('touchmove', (e) => { const t = e.touches[0]; if (t) mover(t.clientX, t.clientY); }, { passive: true });
  hero.addEventListener('pointerleave', () => { p.dentro = false; p.vx = p.vy = 0; });
  hero.addEventListener('pointerdown', (e) => {
    if (e.target.closest('a, button')) return;
    const r = hero.getBoundingClientRect();
    estallar(e.clientX - r.left, e.clientY - r.top, 70, 420);
    despertar();
  });
  // Teléfono inclinado: las brasas derivan hacia ese lado
  let viento = 0;
  window.addEventListener('deviceorientation', (e) => { if (e.gamma != null) viento = Math.max(-1, Math.min(1, e.gamma / 35)) * 40; }, { passive: true });

  // La N se enciende (ver intro.js): sale un chorro de chispas desde la llama
  hero.addEventListener('noxpy:chispa', () => {
    const llama = hero.querySelector('.hero-llama svg');
    if (!llama) return;
    const a = llama.getBoundingClientRect(), r = hero.getBoundingClientRect();
    estallar(a.left - r.left + a.width * 0.45, a.top - r.top + a.height * 0.55, 160, 520);
    despertar();
  });

  // Intensidad general: arranca en cero y sube en el primer segundo y medio
  let encendido = quieto ? 1 : 0;
  let t0 = 0, antes = 0, raf = 0, visible = true;

  const dibujar = (dt, t) => {
    ctx.setTransform(escala, 0, 0, escala, 0, 0);
    ctx.globalCompositeOperation = 'source-over';
    ctx.clearRect(0, 0, W, H);
    ctx.globalCompositeOperation = 'lighter';
    const R = Math.min(Math.max(W * 0.13, 120), 210);   // radio de influencia del cursor
    const rapido = Math.hypot(p.vx, p.vy);

    for (const b of ambiente) {
      if (dt) {
        // Cursor: las aparta como una corriente de aire y las enciende al pasar cerca
        if (p.dentro) {
          const dx = b.x - p.x, dy = b.y - p.y, d = Math.hypot(dx, dy);
          if (d < R && d > 0.1) {
            const f = (1 - d / R) ** 2;
            b.vx += (dx / d) * f * 1400 * dt + p.vx * f * 0.9 * dt;
            b.vy += (dy / d) * f * 1400 * dt + p.vy * f * 0.9 * dt;
            b.luz = Math.max(b.luz, f);
          }
        }
        b.vx += (b.bx + viento - b.vx) * Math.min(1, dt * 1.6);
        b.vy += (b.by - b.vy) * Math.min(1, dt * 1.6);
        b.x += b.vx * dt + Math.sin(t * 0.6 + b.fase) * 6 * dt;
        b.y += b.vy * dt;
        b.luz *= Math.exp(-dt * 2.2);
        if (b.y < -20) { Object.assign(b, nuevaBrasa(H + 10)); }
        if (b.x < -30) b.x = W + 20; else if (b.x > W + 30) b.x = -20;
      }
      // Titileo como de brasa: cada una a su ritmo
      const titila = 0.45 + 0.55 * Math.abs(Math.sin(t * b.ritmo + b.fase));
      const alfa = Math.min(1, (0.3 + 0.7 * titila) * (0.6 + b.luz * 1.2) * (1 - b.z * 0.62)) * encendido;
      const s = b.r * (7 + b.luz * 9);
      ctx.globalAlpha = alfa;
      ctx.drawImage(brillos[b.c], b.x - s / 2, b.y - s / 2, s, s);
    }

    // Estela: al mover rápido el cursor se desprenden chispas
    if (dt && p.dentro && rapido > 420) {
      const n = Math.min(6, Math.floor(rapido / 420));
      for (let i = 0; i < n; i++) chispa(p.x, p.y, 90 + Math.random() * 120);
      p.vx *= 0.6; p.vy *= 0.6;
    }

    for (let i = chispas.length - 1; i >= 0; i--) {
      const c = chispas[i];
      if (dt) {
        c.t += dt;
        if (c.t > c.vida) { chispas.splice(i, 1); continue; }
        const roce = Math.exp(-dt * 2.4);
        c.vx *= roce; c.vy = c.vy * roce - 30 * dt;   // las chispas también suben, como el fuego
        c.x += c.vx * dt; c.y += c.vy * dt;
      }
      const k = 1 - c.t / c.vida;
      const s = c.r * (6 + 8 * k);
      ctx.globalAlpha = Math.min(1, k * 1.4) * encendido;
      ctx.drawImage(brillos[c.c], c.x - s / 2, c.y - s / 2, s, s);
    }
    ctx.globalAlpha = 1;
  };

  const cuadro = (ahora) => {
    raf = 0;
    if (!visible || document.hidden) { antes = 0; return; }
    if (!t0) t0 = ahora;
    const dt = antes ? Math.min((ahora - antes) / 1000, 0.05) : 1 / 60;
    antes = ahora;
    encendido = Math.min(1, (ahora - t0) / 1500);
    dibujar(dt, (ahora - t0) / 1000);
    raf = requestAnimationFrame(cuadro);
  };
  const despertar = () => { if (!quieto && !raf && visible && !document.hidden) raf = requestAnimationFrame(cuadro); };

  medir();
  if (quieto) { dibujar(0, 0); }
  window.addEventListener('resize', () => { medir(); if (quieto) dibujar(0, 0); });
  document.addEventListener('visibilitychange', despertar);
  // Fuera de pantalla no se dibuja nada
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(([e]) => { visible = e.isIntersecting; despertar(); }).observe(hero);
  }
  despertar();
})();
