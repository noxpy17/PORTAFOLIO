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
      img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
      img.data[i + 3] = 255;
    }
    ctx.putImageData(img, 0, 0);
    grain.style.backgroundImage = `url(${c.toDataURL()})`;
    document.querySelectorAll('.hero-grain').forEach((g) => { g.style.backgroundImage = grain.style.backgroundImage; });
    if (!reduceMotion) {
      setInterval(() => {
        grain.style.backgroundPosition = `${Math.random() * 180}px ${Math.random() * 180}px`;
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
            A.animate(card, {
              opacity: [0, 1], translateY: [28, 0], duration: 1100, ease: 'inOut(2)',
              onComplete: () => { card.style.opacity = ''; card.style.transform = ''; },
            });
          }
          // Carpeta: el color sube despacio desde abajo sobre la versión en blanco y negro
          const img = el.querySelector('img:not(.card-bn)');
          const folder = el.closest('.card-folder');
          const color = { r: -0 };
          A.animate(color, {
            r: [0, 135], duration: 2200, ease: 'inOut(2)',
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

  // Destacados: el revelado sigue al scroll (suavizado), con paralaje y apilado
  const features = [...document.querySelectorAll('.feature')];
  if (features.length) {
    const clamp = (v) => Math.min(Math.max(v, 0), 1);
    const suave = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2); // ease-in-out

    // Sombra que cae sobre el proyecto que queda debajo
    features.forEach((f) => {
      const shade = document.createElement('div');
      shade.className = 'feature-shade';
      shade.setAttribute('aria-hidden', 'true');
      f.querySelector('.feature-inner').append(shade);
    });

    // Título letra por letra y datos: entran cuando el proyecto ya está casi asentado
    if (A && 'IntersectionObserver' in window) {
      const fold = window.innerHeight;
      const io2 = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          io2.unobserve(entry.target);
          const f = entry.target;
          const tl = A.createTimeline({ defaults: { ease: EASE } });
          tl.add(f.querySelectorAll('.feature-title .ch'), {
            translateY: ['110%', '0%'], rotate: [4, 0], duration: 900, delay: A.stagger(22),
          })
            .add(f.querySelector('.feature-index'), { opacity: [0, 1], translateX: [-16, 0], duration: 700 }, 0)
            .add(f.querySelectorAll('.feature-meta > *'), {
              opacity: [0, 1], translateY: [18, 0], duration: 700, delay: A.stagger(90),
            }, '-=600');
        });
      }, { threshold: 0.55 });

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
        io2.observe(f);
      });
    }

    if (!reduceMotion) {
      const stack = document.querySelector('.feature-stack');
      const parts = features.map((f) => ({
        inner: f.querySelector('.folder'),
        media: f.querySelector('.feature-media'),
        img: f.querySelector('.feature-media img'),
        copy: f.querySelector('.feature-copy'),
        shade: f.querySelector('.feature-shade'),
        e: -1, c: -1, // valores suavizados (entrada y cubierta)
      }));

      const apply = (p, hasNext) => {
        const e = suave(p.e);
        const open = 1 - e;
        // Revelado: una linterna entra por la esquina inferior y abre la luz sobre la imagen
        if (open > 0.002) {
          p.media.style.setProperty('--lr', `${(e * 165).toFixed(1)}%`);
          p.media.style.setProperty('--lx', `${(22 + e * 33).toFixed(1)}%`);
          p.media.style.setProperty('--ly', `${(96 - e * 52).toFixed(1)}%`);
        } else {
          p.media.style.setProperty('--lr', '165%');
          p.media.style.setProperty('--lx', '55%');
          p.media.style.setProperty('--ly', '44%');
        }
        // Paralaje: la imagen viaja más lento que la página y sigue derivando mientras está cubierta
        p.img.style.transform = `translate3d(0, ${p.d.toFixed(2)}%, 0) scale(${(1.2 - e * 0.1).toFixed(4)})`;
        // El texto llega un poco después que la imagen: profundidad
        p.copy.style.transform = `translate3d(0, ${(open * 90 - p.c * 40).toFixed(1)}px, 0)`;
        p.copy.style.opacity = Math.max(Math.min(e * 1.6 - 0.4, 1 - p.c * 2.2), 0).toFixed(3);
        // Salida: el siguiente lo cubre; este se aleja, se redondea y cae en sombra
        if (hasNext) {
          const c = suave(p.c);
          p.inner.style.transform = c > 0.001 ? `translate3d(0, ${(-c * 3).toFixed(2)}%, 0) scale(${(1 - c * 0.1).toFixed(4)})` : '';
          p.shade.style.opacity = (c * 0.8).toFixed(3);
        }
        p.inner.style.setProperty('--p', e.toFixed(3));
        p.inner.style.setProperty('--c', p.c.toFixed(3));
      };

      let raf = 0;
      const frame = () => {
        const vh = window.innerHeight;
        const rects = features.map((f) => f.getBoundingClientRect());
        const stackBottom = stack.getBoundingClientRect().bottom;
        let moving = false;
        parts.forEach((p, i) => {
          const te = clamp(1 - rects[i].top / vh);
          const next = rects[i + 1];
          // El último destacado solo empieza a "salir" cuando el bloque de destacados termina
          const tc = next ? clamp(1 - next.top / vh) : clamp((vh - stackBottom) / vh);
          // La geometría (recorte, escala, sombra) sigue el scroll exacto: así nunca se
          // desfasa del bloque. Solo el paralaje de la imagen lleva inercia.
          p.e = te;
          p.c = tc;
          const td = (1 - te) * -8 + tc * 4;
          if (p.d === undefined) p.d = td;
          p.d += (td - p.d) * 0.16;
          if (Math.abs(td - p.d) > 0.01) moving = true;
          // Lo que está lejos de la pantalla no se toca
          if (rects[i].top > vh * 1.1 || rects[i].bottom < -vh * 0.1) return;
          apply(p, !!next);
        });
        raf = moving ? requestAnimationFrame(frame) : 0;
      };
      const kickScroll = () => { if (!raf) raf = requestAnimationFrame(frame); };
      window.addEventListener('scroll', kickScroll, { passive: true });
      window.addEventListener('resize', kickScroll);
      kickScroll();

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

  // Filtros del portafolio
  const grid = document.querySelector('.work-grid');
  const chips = document.querySelectorAll('.chip');
  if (grid && chips.length) {
    const cards = [...grid.querySelectorAll('.card')];
    const matches = (card, f) => f === 'todos' || card.dataset.cat.split(' ').includes(f);
    let busy = false;

    const relayout = () => {
      cards.filter((c) => !c.hidden).forEach((c, i) => c.classList.toggle('is-offset', i % 2 === 1));
    };

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
