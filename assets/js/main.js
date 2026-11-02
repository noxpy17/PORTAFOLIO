(() => {
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const A = !reduceMotion && window.anime ? window.anime : null;
  // Ritmo del brandbook: ease-in-out, 0.4 a 0.8 s
  const EASE = 'inOut(3)';

  // Grano: textura de ruido generada una vez y desplazada a saltos
  const grain = document.querySelector('.grain');
  if (grain) {
    const c = document.createElement('canvas');
    c.width = c.height = 180;
    const ctx = c.getContext('2d');
    const img = ctx.createImageData(180, 180);
    for (let i = 0; i < img.data.length; i += 4) {
      const v = Math.random() * 255;
      // Blanco con transparencia: sobre el fondo da el mismo resultado que el modo "screen",
      // sin obligar al navegador a fusionar toda la página en cada cuadro
      img.data[i] = img.data[i + 1] = img.data[i + 2] = 255;
      img.data[i + 3] = v;
    }
    ctx.putImageData(img, 0, 0);
    grain.style.backgroundImage = `url(${c.toDataURL()})`;
    document.querySelectorAll('.hero-grain').forEach((g) => { g.style.backgroundImage = grain.style.backgroundImage; });
    if (!reduceMotion) {
      setInterval(() => {
        grain.style.transform = `translate3d(${(Math.random() * 180 - 90).toFixed(0)}px, ${(Math.random() * 180 - 90).toFixed(0)}px, 0)`;
      }, 90);
    }
  }

  // El degradado de la llama (SVG animado) se detiene si la persona pidió menos movimiento
  // Con movimiento reducido: se salta la entrada (la llama queda completa) y todo queda quieto
  if (reduceMotion) document.querySelectorAll('.hero-llama svg').forEach((s) => { if (s.setCurrentTime) s.setCurrentTime(5); if (s.pauseAnimations) s.pauseAnimations(); });

  // Encabezado: baja al 40% de opacidad al bajar, vuelve al subir; menú acordeón en celular
  const header = document.querySelector('.site-header');
  if (header) {
    const btn = header.querySelector('.menu-btn');
    const abrir = (si) => {
      header.classList.toggle('menu-abierto', si);
      if (btn) { btn.setAttribute('aria-expanded', String(si)); btn.setAttribute('aria-label', si ? 'Cerrar menú' : 'Abrir menú'); }
    };
    if (btn) {
      btn.addEventListener('click', () => abrir(!header.classList.contains('menu-abierto')));
      header.querySelectorAll('.nav a').forEach((a) => a.addEventListener('click', () => abrir(false)));
      window.addEventListener('keydown', (e) => { if (e.key === 'Escape' && header.classList.contains('menu-abierto')) { abrir(false); btn.focus(); } });
    }
  }

  // Respaldo CSS del hero: el halo sigue al cursor si no hay WebGL
  const hero = document.querySelector('.hero');
  if (hero && !reduceMotion) {
    hero.addEventListener('pointermove', (e) => {
      if (hero.classList.contains('has-webgl')) return;
      const r = hero.getBoundingClientRect();
      hero.style.setProperty('--mx', `${((e.clientX - r.left) / r.width) * 100}%`);
      hero.style.setProperty('--my', `${((e.clientY - r.top) / r.height) * 100}%`);
    });
  }

  // Portada fuera de pantalla: se pausan sus animaciones (llama, brillos, glitch) para no gastar en lo que no se ve
  if (hero && 'IntersectionObserver' in window) {
    const llama = hero.querySelector('.hero-llama svg');
    new IntersectionObserver(([entry]) => {
      const fuera = !entry.isIntersecting;
      hero.classList.toggle('fuera', fuera);
      if (llama && llama.pauseAnimations) {
        if (fuera) llama.pauseAnimations(); else llama.unpauseAnimations();
      }
    }).observe(hero);
  }

  // Linterna sobre el sujeto de la portada: sigue al cursor con inercia; sin cursor,
  // recorre el rostro sola, despacio, como alguien que busca con una luz suave
  const sujeto = document.querySelector('.hero-sujeto');
  if (sujeto && hero && !reduceMotion) {
    let fx = 50, fy = 28, tx = 50, ty = 28, ultimo = -1e9, t0 = performance.now();
    const fino = window.matchMedia('(pointer: fine)').matches;
    hero.addEventListener('pointermove', (e) => {
      if (!fino) return;
      const r = sujeto.getBoundingClientRect();
      tx = Math.min(Math.max(((e.clientX - r.left) / r.width) * 100, -10), 110);
      ty = Math.min(Math.max(((e.clientY - r.top) / r.height) * 100, -10), 110);
      ultimo = performance.now();
    });
    const luz = (now) => {
      if (now - ultimo > 2500) {
        const t = (now - t0) / 1000;
        tx = 50 + Math.sin(t * 0.45) * 16;
        ty = 30 + Math.sin(t * 0.31 + 1.2) * 10;
      }
      fx += (tx - fx) * 0.07;
      fy += (ty - fy) * 0.07;
      // La escena WebGL lee la linterna desde aquí (0..1 dentro del sujeto)
      window.__noxpyFlash = { x: fx / 100, y: fy / 100 };
      // El óvalo mide 0.95 del ancho del sujeto; se centra en el punto de luz
      const w = sujeto.clientWidth, h = sujeto.clientHeight, lw = w * 0.95;
      sujeto.style.setProperty('--lw', `${lw.toFixed(0)}px`);
      sujeto.style.setProperty('--lx', `${(fx / 100 * w - lw / 2).toFixed(1)}px`);
      sujeto.style.setProperty('--ly', `${(fy / 100 * h - lw / 2).toFixed(1)}px`);
      const r = hero.getBoundingClientRect();
      if (r.bottom > 0 && !document.hidden) requestAnimationFrame(luz);
      else setTimeout(() => requestAnimationFrame(luz), 400);
    };
    requestAnimationFrame(luz);
  }

  // Linterna en las fotos marcadas (Sobre mí)
  if (!reduceMotion) {
    document.querySelectorAll('.linterna').forEach((fig) => {
      const img = fig.querySelector('img');
      fig.addEventListener('pointermove', (e) => {
        const r = fig.getBoundingClientRect();
        img.style.setProperty('--fx', `${(((e.clientX - r.left) / r.width) * 100).toFixed(1)}%`);
        img.style.setProperty('--fy', `${(((e.clientY - r.top) / r.height) * 100).toFixed(1)}%`);
      });
    });
  }

  // Columna de cada proyecto en la rejilla: 2 columnas desplazan la segunda; 3 columnas escalonan las tres
  const rejilla = document.querySelector('.work-grid');
  const tres = window.matchMedia('(min-width: 1200px)');
  const dos = window.matchMedia('(min-width: 760px)');
  const ordenarRejilla = () => {
    if (!rejilla) return;
    const cols = tres.matches ? 3 : dos.matches ? 2 : 1;
    [...rejilla.querySelectorAll('.card')].filter((c) => !c.hidden).forEach((c, i) => {
      c.dataset.col = String(i % cols);
      c.classList.toggle('is-offset', cols === 2 && i % 2 === 1);
    });
  };
  ordenarRejilla();
  tres.addEventListener('change', ordenarRejilla);
  dos.addEventListener('change', ordenarRejilla);

  // Revelado al hacer scroll: imágenes con máscara y destello de halo en cada sección
  if (A && 'IntersectionObserver' in window) {
    const seen = new WeakSet();
    const io = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        const el = entry.target;
        if (!entry.isIntersecting || seen.has(el)) return;
        seen.add(el);
        io.unobserve(el);
        if (el.matches('.card figure')) {
          // La tarjeta entra con un fundido de opacidad y sube un poco
          const card = el.closest('.card');
          if (card) {
            // En la rejilla de tres, cada columna arranca un poco después: suben escalonadas
            const retraso = (Number(card.dataset.col) || 0) * 180;
            A.animate(card, {
              opacity: [0, 1], translateY: [48, 0], duration: 1100, ease: 'inOut(2)', delay: retraso,
              onComplete: () => { card.style.opacity = ''; card.style.transform = ''; },
            });
          }
          // Carpeta: el color sube despacio desde abajo sobre la versión en blanco y negro
          const img = el.querySelector('img:not(.card-bn)');
          const folder = el.closest('.card-folder');
          const color = { r: -0 };
          A.animate(color, {
            r: [0, 135], duration: 2200, ease: 'inOut(2)', delay: (Number(el.closest('.card')?.dataset.col) || 0) * 180,
            onUpdate: () => { img.style.setProperty('--rev', `${color.r.toFixed(1)}%`); },
            onComplete: () => {
              if (folder) folder.style.setProperty('--p', '1');
              const bn = el.querySelector('.card-bn');
              if (bn) bn.remove();
            },
          });
        } else if (el.matches('.gallery figure, .case-cover')) {
          const img = el.querySelector('img');
          A.animate(el, { clipPath: ['inset(5% 2.5% 5% 2.5%)', 'inset(0% 0% 0% 0%)'], opacity: [0.35, 1], duration: 1100, ease: 'inOut(2)' });
          if (img) A.animate(img, { scale: [1.06, 1], duration: 1400, ease: 'inOut(2)', onComplete: () => { img.style.transform = ''; } });
        } else if (el.matches('.about-foto')) {
          el.classList.remove('por-revelar');
        } else if (el.matches('.halo')) {
          A.animate(el, { opacity: [0, 0.9, 0], scale: [0.8, 1.15], duration: 1600, ease: EASE });
        }
      });
    }, { rootMargin: '0px 0px -12% 0px' });

    // Solo lo que todavía no está en pantalla; lo visible al cargar se queda quieto
    const fold = window.innerHeight;
    document.querySelectorAll('.card figure, .gallery figure, .case-cover, .halo, .about-foto').forEach((el) => {
      if (el.getBoundingClientRect().top <= fold) return;
      if (el.matches('.card figure')) {
        const img = el.querySelector('img');
        const bn = img.cloneNode();
        bn.className = 'card-bn';
        bn.alt = '';
        bn.setAttribute('aria-hidden', 'true');
        el.prepend(bn);
        img.style.setProperty('--rev', '0%');
        const card = el.closest('.card');
        if (card) card.style.opacity = '0';
      }
      if (el.matches('.about-foto')) el.classList.add('por-revelar');
      io.observe(el);
    });
  }

  // Destacados: carpetas apiladas. Viven en un escenario fijo; cada una sube y cubre a la anterior,
  // que se va hacia atrás desenfocada.
  // El avance sigue al scroll con inercia, así el movimiento es continuo aunque la rueda vaya a saltos
  const features = [...document.querySelectorAll('.feature')];
  if (features.length) {
    const clamp = (v, a = 0, b = 1) => Math.min(Math.max(v, a), b);
    const stack = document.querySelector('.feature-stack');
    const carrusel = !reduceMotion && !!stack;

    // Penumbra de las carpetas que no están al frente
    features.forEach((f) => {
      const shade = document.createElement('div');
      shade.className = 'feature-shade';
      shade.setAttribute('aria-hidden', 'true');
      f.querySelector('.feature-inner').append(shade);
    });

    let stage = null;
    if (carrusel) {
      stage = document.createElement('div');
      stage.className = 'feature-stage';
      features.forEach((f) => stage.append(f));
      stack.append(stage);
      stack.classList.add('carrusel');
    }

    // Título letra por letra y datos: entran cuando la carpeta llega al frente
    const entrarTitulo = (f) => {
      const tl = A.createTimeline({ defaults: { ease: EASE } });
      tl.add(f.querySelectorAll('.feature-title .ch'), {
        translateY: ['110%', '0%'], rotate: [4, 0], duration: 900, delay: A.stagger(22),
      })
        .add(f.querySelector('.feature-index'), { opacity: [0, 1], translateX: [-16, 0], duration: 700 }, 0)
        .add(f.querySelectorAll('.feature-meta > *'), {
          opacity: [0, 1], translateY: [18, 0], duration: 700, delay: A.stagger(90),
        }, '-=600');
    };
    const io2 = A && !carrusel && 'IntersectionObserver' in window
      ? new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          io2.unobserve(entry.target);
          entrarTitulo(entry.target);
        });
      }, { threshold: 0.55 })
      : null;
    if (A && (carrusel || io2)) {
      const fold = window.innerHeight;
      features.forEach((f) => {
        if (f.getBoundingClientRect().top < fold * 0.5) return; // lo visible al cargar se queda quieto
        const title = f.querySelector('.feature-title');
        title.setAttribute('aria-label', title.textContent.trim());
        const words = title.textContent.trim().split(/\s+/);
        title.textContent = '';
        words.forEach((w, i) => {
          const mask = document.createElement('span');
          mask.className = 'mask';
          mask.setAttribute('aria-hidden', 'true');
          [...w].forEach((ch) => {
            const c = document.createElement('span');
            c.className = 'ch';
            c.textContent = ch;
            c.style.transform = 'translateY(110%)';
            mask.append(c);
          });
          title.append(mask);
          if (i < words.length - 1) title.append(' ');
        });
        f.querySelectorAll('.feature-index, .feature-meta > *').forEach((el) => { el.style.opacity = '0'; });
        f.dataset.titulo = 'pendiente';
        if (io2) io2.observe(f);
      });
    }

    if (carrusel) {
      const N = features.length;
      const parts = features.map((f) => {
        const folder = f.querySelector('.folder');
        const img = f.querySelector('.feature-media img');
        // Foto desenfocada pre-calculada: se funde con opacidad en vez de desenfocar en vivo
        const blur = document.createElement('img');
        blur.className = 'feature-blur';
        blur.alt = '';
        blur.setAttribute('aria-hidden', 'true');
        blur.decoding = 'async';
        blur.src = img.getAttribute('src').replace('assets/img/', 'assets/img/desenfoque/');
        blur.style.cssText = img.style.cssText;
        img.after(blur);
        // Sombra de la carpeta en su propia capa: solo cambia su opacidad
        const sombra = document.createElement('div');
        sombra.className = 'folder-sombra';
        sombra.setAttribute('aria-hidden', 'true');
        folder.prepend(sombra);
        return {
          f, folder, img, blur, sombra,
          tab: f.querySelector('.folder-tab'),
          copy: f.querySelector('.feature-copy'),
          shade: f.querySelector('.feature-shade'),
          lejos: false, moviendo: false,
        };
      });
      // Pausas (en pantallas) antes de la primera carpeta y después de la última
      const INICIO = 0.3, FINAL = 0.4;
      // Entre carpeta y carpeta: una pausa corta y luego el paso con ease-in-out
      const paso = (x) => { const g = clamp((x - 0.1) / 0.8); return g * g * g * (g * (g * 6 - 15) + 10); };
      let unidad = 0;
      const medir = () => {
        unidad = stage.offsetHeight;
        // La carpeta al frente empieza justo bajo el encabezado
        const hdr = document.querySelector('.site-header');
        if (hdr) stack.style.setProperty('--hdr', `${hdr.offsetHeight}px`);
        stack.style.height = `${((N - 1 + INICIO + FINAL + 1) * unidad).toFixed(0)}px`;
      };
      medir();
      // Posición del carrusel según el scroll: 0 = primera carpeta al frente, N-1 = la última
      const objetivo = () => {
        const s = -stack.getBoundingClientRect().top / unidad;
        if (s < 0) return Math.max(s, -1); // la primera crece mientras el bloque entra
        const u = Math.min(s - INICIO, N - 1);
        if (u <= 0) return 0;
        const i = Math.floor(u);
        return i >= N - 1 ? N - 1 : i + paso(u - i);
      };

      const aplicar = (p, o, i) => {
        // Lo que ya quedó tapado del todo no se toca
        const lejos = o < -1.4 || o > 1.4;
        if (lejos && p.lejos) return;
        p.lejos = lejos;
        // e: cuánto llegó la carpeta al frente · c: cuánto la tapó la siguiente
        const e = 1 - clamp(o);
        const c = clamp(-o);
        const open = 1 - e;
        // Entrada: sube recta desde abajo, pequeña, y crece encima de la anterior.
        // La primera no sube: solo crece mientras el bloque entra en pantalla
        const sube = i === 0 ? 0 : open * unidad;
        // Salida: la siguiente la cubre; esta se va hacia atrás, se encoge, gira un poco, se desenfoca y cae en sombra
        const giro = -c * 2.5;
        const escala = (0.84 + e * 0.16) * (1 - c * 0.2);
        // Al frente queda quieta, recta y a pantalla completa, sin ninguna transformación encima
        const quieta = open < 0.0005 && c < 0.0005;
        p.folder.style.transform = quieta ? '' : `translate3d(0, ${(sube + (open * 0.06 - c * 0.08) * unidad).toFixed(1)}px, 0) scale(${escala.toFixed(4)}) rotate(${giro.toFixed(2)}deg)`;
        // Las esquinas se redondean solo mientras la carpeta está en movimiento (cambia una vez, no en cada cuadro)
        if (p.moviendo === quieta) { p.moviendo = !quieta; p.folder.classList.toggle('en-movimiento', !quieta); }
        p.sombra.style.opacity = Math.max(open, c).toFixed(3);
        // Paralaje: la imagen viaja más lento que la carpeta y sigue derivando mientras está cubierta
        const foto = `translate3d(0, ${(open * -11 + c * 3).toFixed(2)}%, 0) scale(${(1.24 - e * 0.16).toFixed(4)})`;
        p.img.style.transform = foto;
        // Desenfoque: la versión borrosa aparece a medida que la siguiente la cubre
        p.blur.style.opacity = Math.min(c * 1.4, 1).toFixed(3);
        if (c > 0.001) p.blur.style.transform = foto;
        // El texto llega después que la imagen: profundidad
        p.copy.style.transform = `translate3d(0, ${(open * 200 - c * 90).toFixed(1)}px, 0)`;
        p.copy.style.opacity = Math.max(Math.min(e * 1.6 - 0.4, 1 - c * 3.2), 0).toFixed(3);   // al irse atrás, el texto se apaga antes de que la foto se desenfoque
        p.shade.style.opacity = (c * 0.8).toFixed(3);
        // Pestaña: la línea cian se enciende al llegar y la pestaña se apaga cuando la cubren
        p.tab.style.setProperty('--p', e.toFixed(3));
        p.tab.style.opacity = Math.max(1 - c * 3, 0).toFixed(3);
        if (o < 0.2 && o > -0.5 && p.f.dataset.titulo === 'pendiente') {
          p.f.dataset.titulo = '';
          entrarTitulo(p.f);
        }
      };

      let t = objetivo(), raf = 0, antes = 0;
      const pintar = () => parts.forEach((p, i) => aplicar(p, i - t, i));
      const frame = (now) => {
        const dt = antes ? Math.min((now - antes) / 1000, 0.05) : 1 / 60;
        antes = now;
        const meta = objetivo();
        // Inercia suave e independiente de los fps: alcanza el scroll en algo más de medio segundo
        t += (meta - t) * (1 - Math.exp(-dt * 5));
        if (Math.abs(meta - t) < 0.0005) t = meta;
        pintar();
        raf = t !== meta ? requestAnimationFrame(frame) : 0;
        if (!raf) antes = 0;
      };
      const kickScroll = () => { if (!raf) raf = requestAnimationFrame(frame); };
      window.addEventListener('scroll', kickScroll, { passive: true });
      window.addEventListener('resize', () => { medir(); kickScroll(); });
      pintar();

      // Con teclado: al enfocar una carpeta, el scroll la trae al frente
      features.forEach((f, i) => {
        f.querySelector('.feature-inner').addEventListener('focus', () => {
          const y = window.scrollY + stack.getBoundingClientRect().top + (INICIO + i) * unidad;
          window.scrollTo({ top: y, behavior: 'smooth' });
        });
      });
    }

    if (!reduceMotion) {
      // Cursor "Ver": un anillo fino que sigue al mouse con inercia
      if (window.matchMedia('(pointer: fine)').matches) {
        const cur = document.createElement('div');
        cur.className = 'cursor-ver';
        cur.setAttribute('aria-hidden', 'true');
        cur.innerHTML = '<span>Ver</span>';
        document.body.append(cur);
        let x = -200, y = -200, tx = x, ty = y, s = 0, ts = 0, craf = 0;
        const loop = () => {
          x += (tx - x) * 0.14; y += (ty - y) * 0.14; s += (ts - s) * 0.12;
          cur.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0) scale(${s.toFixed(3)})`;
          craf = Math.abs(tx - x) + Math.abs(ty - y) + Math.abs(ts - s) * 100 > 0.15 ? requestAnimationFrame(loop) : 0;
        };
        const kick = () => { if (!craf) craf = requestAnimationFrame(loop); };
        features.forEach((f) => {
          const inner = f.querySelector('.feature-inner');
          inner.addEventListener('pointerenter', (e) => { tx = x = e.clientX; ty = y = e.clientY; ts = 1; cur.classList.add('is-on'); kick(); });
          inner.addEventListener('pointermove', (e) => { tx = e.clientX; ty = e.clientY; kick(); });
          inner.addEventListener('pointerleave', () => { ts = 0; cur.classList.remove('is-on'); kick(); });
        });
        // Sobre el botón "Ver proyecto" el anillo se encoge a un punto
        document.querySelectorAll('.feature-cta').forEach((b) => {
          b.addEventListener('pointerenter', () => { ts = 0.25; cur.classList.add('is-punto'); kick(); });
          b.addEventListener('pointerleave', () => { ts = 1; cur.classList.remove('is-punto'); kick(); });
        });
      }
    }
  }

  // Nombre en Quién soy: se escribe a máquina como el titular del inicio y se enfoca al terminar
  const nombre = document.querySelector('.nombre-tipeo');
  if (nombre && A && 'IntersectionObserver' in window && nombre.getBoundingClientRect().top > window.innerHeight) {
    const texto = nombre.textContent.trim();
    nombre.setAttribute('aria-label', texto);
    nombre.textContent = '';
    const letras = [...texto].map((ch) => {
      const l = document.createElement('span');
      l.className = 'tch';
      l.setAttribute('aria-hidden', 'true');
      l.textContent = ch;
      nombre.append(l);
      return l;
    });
    // Desenfoque sutil (máximo 3 px) y subida desde abajo: ambos se resuelven con la última letra
    const enfoque = (k) => {
      nombre.style.filter = k >= 1 ? '' : `blur(${((1 - k) * 3).toFixed(2)}px)`;
      nombre.style.transform = k >= 1 ? '' : `translateY(${((1 - k) * 28).toFixed(1)}px)`;
    };
    enfoque(0);
    const esperar = (ms) => new Promise((r) => setTimeout(r, ms));
    const ioNombre = new IntersectionObserver(async (entries) => {
      if (!entries.some((e) => e.isIntersecting)) return;
      ioNombre.disconnect();
      // Ritmo humano, no metrónomo: más pausa en los espacios
      for (let i = 0; i < letras.length; i++) {
        if (i > 0) letras[i - 1].classList.remove('cursor');
        letras[i].classList.add('on', 'cursor');
        enfoque((i + 1) / letras.length);
        const ch = letras[i].textContent;
        await esperar(70 * (0.6 + Math.random() * 0.8) + (ch === ' ' ? 90 : 0));
      }
      await esperar(900);
      letras[letras.length - 1].classList.remove('cursor');
    }, { rootMargin: '0px 0px -20% 0px' });
    ioNombre.observe(nombre);
  }

  // Qué puedo hacer por ti: los bloques suben uno tras otro y sus herramientas aparecen después
  const skills = document.querySelector('.skills');
  if (skills && A && 'IntersectionObserver' in window && skills.getBoundingClientRect().top > window.innerHeight) {
    const bloques = skills.querySelectorAll('.skill');
    const etiquetas = skills.querySelectorAll('.tools li');
    bloques.forEach((b) => { b.style.opacity = '0'; });
    etiquetas.forEach((t) => { t.style.opacity = '0'; });
    const ioSkills = new IntersectionObserver((entries) => {
      if (!entries.some((e) => e.isIntersecting)) return;
      ioSkills.disconnect();
      A.animate(bloques, { opacity: [0, 1], translateY: [32, 0], duration: 900, ease: EASE, delay: A.stagger(140) });
      A.animate(etiquetas, { opacity: [0, 1], translateY: [8, 0], duration: 500, ease: EASE, delay: A.stagger(45, { start: 500 }) });
    }, { rootMargin: '0px 0px -15% 0px' });
    ioSkills.observe(skills);
  }

  // Filtros del portafolio
  const grid = document.querySelector('.work-grid');
  const chips = document.querySelectorAll('.chip');
  if (grid && chips.length) {
    const cards = [...grid.querySelectorAll('.card')];
    const matches = (card, f) => f === 'todos' || card.dataset.cat.split(' ').includes(f);
    let busy = false;

    const relayout = ordenarRejilla;

    const apply = (f) => {
      cards.forEach((card) => { card.hidden = !matches(card, f); });
      relayout();
    };

    chips.forEach((chip) => {
      const f = chip.dataset.filter;
      const sup = document.createElement('sup');
      sup.textContent = cards.filter((c) => matches(c, f)).length;
      chip.append(sup);

      chip.addEventListener('click', () => {
        if (busy || chip.getAttribute('aria-pressed') === 'true') return;
        chips.forEach((c) => c.setAttribute('aria-pressed', String(c === chip)));
        if (!A) { apply(f); return; }
        busy = true;
        const out = cards.filter((c) => !c.hidden);
        A.animate(out, {
          opacity: [1, 0], translateY: [0, 16], duration: 400, ease: EASE, delay: A.stagger(30),
          onComplete: () => {
            apply(f);
            const shown = cards.filter((c) => !c.hidden);
            A.animate(shown, {
              opacity: [0, 1], translateY: [24, 0], duration: 600, ease: EASE, delay: A.stagger(70),
              onComplete: () => {
                cards.forEach((c) => { c.style.opacity = ''; c.style.transform = ''; });
                busy = false;
              },
            });
          },
        });
      });
    });
    relayout();
  }

  // Proyectos con video: se abren en una ventana sobre la página (sin salir del sitio)
  const modal = document.querySelector('.video-modal');
  if (modal) {
    const marco = modal.querySelector('.video-marco');
    let origen = null;
    const cerrar = () => {
      modal.hidden = true;
      marco.innerHTML = '';
      document.documentElement.style.overflow = '';
      if (origen) origen.focus();
    };
    document.querySelectorAll('[data-video]').forEach((link) => {
      link.addEventListener('click', (e) => {
        e.preventDefault();
        origen = link;
        const id = link.dataset.video;
        modal.querySelector('.video-titulo').textContent = link.dataset.videoTitulo || '';
        modal.querySelector('.video-yt').href = link.href;
        marco.innerHTML = `<iframe src="https://www.youtube-nocookie.com/embed/${id}?autoplay=1&rel=0" title="${link.dataset.videoTitulo || 'Video'}" allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowfullscreen></iframe>`;
        modal.hidden = false;
        document.documentElement.style.overflow = 'hidden';
        modal.querySelector('.video-cerrar').focus();
      });
    });
    modal.querySelector('.video-cerrar').addEventListener('click', cerrar);
    modal.addEventListener('click', (e) => { if (e.target === modal) cerrar(); });
    window.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !modal.hidden) cerrar(); });
  }

  // «Hablemos.» se escribe a máquina cuando la sección de contacto llega a pantalla
  const hablemos = document.querySelector('.contact h2 em');
  if (hablemos && A && 'IntersectionObserver' in window) {
    const texto = hablemos.textContent;
    hablemos.setAttribute('aria-label', texto);
    hablemos.textContent = '';
    const letras = [...texto].map((ch) => {
      const s = document.createElement('span');
      s.className = 'tch';
      s.setAttribute('aria-hidden', 'true');
      s.textContent = ch;
      hablemos.append(s);
      return s;
    });
    const espera = (ms) => new Promise((r) => setTimeout(r, ms));
    const ioH = new IntersectionObserver(async ([e]) => {
      if (!e.isIntersecting) return;
      ioH.disconnect();
      await espera(300);
      for (let i = 0; i < letras.length; i++) {
        if (i) letras[i - 1].classList.remove('cursor');
        letras[i].classList.add('on', 'cursor');
        await espera(70 * (0.6 + Math.random() * 0.8) + (letras[i].textContent === '.' ? 180 : 0));
      }
      // El cursor queda parpadeando un momento y se va
      await espera(1600);
      letras[letras.length - 1].classList.remove('cursor');
    }, { threshold: 0.6 });
    ioH.observe(hablemos);
  }

  // Copiar correo / teléfono
  document.querySelectorAll('[data-copy]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const text = btn.dataset.copy;
      const done = () => {
        const prev = btn.textContent;
        btn.textContent = 'Copiado';
        setTimeout(() => { btn.textContent = prev; }, 1600);
      };
      if (navigator.clipboard) {
        navigator.clipboard.writeText(text).then(done).catch(() => selectValue(btn));
      } else {
        selectValue(btn);
      }
    });
  });
  function selectValue(btn) {
    const value = btn.closest('.contact-line')?.querySelector('.value');
    if (!value) return;
    const range = document.createRange();
    range.selectNodeContents(value);
    const sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(range);
  }

  const y = document.querySelector('[data-year]');
  if (y) y.textContent = new Date().getFullYear();
})();
