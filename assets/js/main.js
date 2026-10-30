(() => {
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const A = !reduceMotion && window.anime ? window.anime : null;
  // Ritmo del brandbook: ease-in-out, 0.4 a 0.8 s
  const EASE = 'inOut(3)';

  // Rendimiento: todo lo que se mueve en bucle usa solo transform y opacity (los hace la GPU).
  // Nada de máscaras, filtros o fondos que cambien en cada cuadro.

  // Grano: una textura de ruido generada una vez; la animación de salto va en CSS
  const grainTargets = document.querySelectorAll('.grain, .hero-grain');
  if (grainTargets.length) {
    const c = document.createElement('canvas');
    c.width = c.height = 160;
    const ctx = c.getContext('2d');
    const img = ctx.createImageData(160, 160);
    for (let i = 0; i < img.data.length; i += 4) {
      const v = Math.random() * 255;
      img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
      img.data[i + 3] = 255;
    }
    ctx.putImageData(img, 0, 0);
    const url = `url(${c.toDataURL()})`;
    grainTargets.forEach((g) => { g.style.backgroundImage = url; });
  }

  // Con movimiento reducido: la llama del logo aparece completa y quieta
  if (reduceMotion) {
    document.querySelectorAll('.hero-llama svg').forEach((s) => {
      if (s.setCurrentTime) s.setCurrentTime(5);
      if (s.pauseAnimations) s.pauseAnimations();
    });
  }

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
    let ultimoY = window.scrollY, tic = false, quieto = 0;
    const root = document.documentElement;
    window.addEventListener('scroll', () => {
      // Mientras hay scroll, el grano deja de saltar (no se nota y libera la GPU)
      root.classList.add('en-scroll');
      clearTimeout(quieto);
      quieto = setTimeout(() => root.classList.remove('en-scroll'), 180);
      if (tic) return;
      tic = true;
      requestAnimationFrame(() => {
        const y = window.scrollY;
        if (!header.classList.contains('menu-abierto')) {
          if (y > ultimoY + 6 && y > 160) header.classList.add('oculto');
          else if (y < ultimoY - 6 || y < 160) header.classList.remove('oculto');
        }
        if (Math.abs(y - ultimoY) > 6) ultimoY = y;
        tic = false;
      });
    }, { passive: true });
  }

  // Todos los proyectos: la tarjeta entra con un fundido y el color sube de abajo hacia arriba.
  // El color es una cortina en blanco y negro que se desliza hacia arriba (solo transform).
  if (A && 'IntersectionObserver' in window) {
    const io = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        io.unobserve(entry.target);
        const el = entry.target;
        if (el.matches('.card figure')) {
          const card = el.closest('.card');
          A.animate(card, {
            opacity: [0, 1], translateY: [28, 0], duration: 1100, ease: 'inOut(2)',
            onComplete: () => { card.style.opacity = ''; card.style.transform = ''; },
          });
          const cortina = el.querySelector('.card-bn');
          if (cortina) {
            requestAnimationFrame(() => cortina.classList.add('se-va'));
            cortina.addEventListener('transitionend', () => {
              cortina.remove();
              const folder = el.closest('.card-folder');
              if (folder) folder.style.setProperty('--p', '1');
            }, { once: true });
          }
        } else if (el.matches('.halo')) {
          A.animate(el, { opacity: [0, 0.9, 0], scale: [0.8, 1.15], duration: 1600, ease: EASE });
        }
      });
    }, { rootMargin: '0px 0px -12% 0px' });

    // Solo lo que todavía no está en pantalla; lo visible al cargar se queda quieto
    const fold = window.innerHeight;
    document.querySelectorAll('.card figure, .halo').forEach((el) => {
      if (el.getBoundingClientRect().top <= fold) return;
      if (el.matches('.card figure')) {
        const src = el.querySelector('img');
        const cortina = document.createElement('div');
        cortina.className = 'card-bn';
        cortina.setAttribute('aria-hidden', 'true');
        const bn = src.cloneNode();
        bn.alt = '';
        bn.removeAttribute('loading');
        cortina.append(bn);
        el.append(cortina);
        el.closest('.card').style.opacity = '0';
      }
      io.observe(el);
    });
  }

  // Destacados: carpetas apiladas; una "linterna" abre la luz sobre la imagen con el scroll
  const features = [...document.querySelectorAll('.feature')];
  if (features.length) {
    const clamp = (v) => Math.min(Math.max(v, 0), 1);
    const suave = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2); // ease-in-out

    // Sombra que cae sobre la carpeta que queda debajo, y la oscuridad con el hueco de la linterna
    features.forEach((f) => {
      const shade = document.createElement('div');
      shade.className = 'feature-shade';
      shade.setAttribute('aria-hidden', 'true');
      f.querySelector('.feature-inner').append(shade);
      const oscuridad = document.createElement('div');
      oscuridad.className = 'feature-oscuridad';
      oscuridad.setAttribute('aria-hidden', 'true');
      f.querySelector('.feature-media').append(oscuridad);
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
        folder: f.querySelector('.folder'),
        img: f.querySelector('.feature-media img'),
        oscuridad: f.querySelector('.feature-oscuridad'),
        copy: f.querySelector('.feature-copy'),
        shade: f.querySelector('.feature-shade'),
        last: '',
      }));

      const apply = (p, e0, c0, d, hasNext) => {
        const e = suave(e0);
        const open = 1 - e;
        // Linterna: el hueco de luz entra por la esquina inferior izquierda y crece hasta llenar
        // la imagen. La capa oscura mide 3 veces la imagen; se mueve y escala (solo transform).
        if (open > 0.002) {
          const x = 22 + e * 33, y = 96 - e * 52;          // centro del hueco, en % de la imagen
          const s = 0.18 + e * e * 4.2;                      // tamaño del hueco
          p.oscuridad.style.opacity = '1';
          p.oscuridad.style.transform = `translate3d(${((x - 50) / 3).toFixed(2)}%, ${((y - 50) / 3).toFixed(2)}%, 0) scale(${s.toFixed(3)})`;
        } else if (p.oscuridad.style.opacity !== '0') {
          p.oscuridad.style.opacity = '0';
        }
        // Paralaje: la imagen viaja más lento que la página y sigue derivando mientras está cubierta
        p.img.style.transform = `translate3d(0, ${d.toFixed(2)}%, 0) scale(${(1.2 - e * 0.1).toFixed(4)})`;
        // El texto llega un poco después que la imagen: profundidad
        p.copy.style.transform = `translate3d(0, ${(open * 90 - c0 * 40).toFixed(1)}px, 0)`;
        p.copy.style.opacity = Math.max(Math.min(e * 1.6 - 0.4, 1 - c0 * 2.2), 0).toFixed(3);
        // Salida: la siguiente carpeta la cubre; esta se aleja y cae en sombra
        if (hasNext) {
          const c = suave(c0);
          p.folder.style.transform = c > 0.001 ? `translate3d(0, ${(-c * 3).toFixed(2)}%, 0) scale(${(1 - c * 0.1).toFixed(4)})` : '';
          p.shade.style.opacity = (c * 0.8).toFixed(3);
        }
        // La línea de la pestaña y su apagado (variables heredadas por la pestaña, que es pequeña)
        const key = `${e.toFixed(2)}|${c0.toFixed(2)}`;
        if (key !== p.last) {
          p.last = key;
          p.folder.style.setProperty('--p', e.toFixed(2));
          p.folder.style.setProperty('--c', c0.toFixed(2));
        }
      };

      let raf = 0;
      const frame = () => {
        const vh = window.innerHeight;
        const rects = features.map((f) => f.getBoundingClientRect());
        const stackBottom = stack.getBoundingClientRect().bottom;
        let moving = false;
        parts.forEach((p, i) => {
          const e = clamp(1 - rects[i].top / vh);
          const next = rects[i + 1];
          // La última carpeta solo empieza a "salir" cuando el bloque de destacados termina
          const c = next ? clamp(1 - next.top / vh) : clamp((vh - stackBottom) / vh);
          // La geometría sigue el scroll exacto; solo el paralaje de la imagen lleva inercia
          const td = (1 - e) * -8 + c * 4;
          if (p.d === undefined) p.d = td;
          p.d += (td - p.d) * 0.16;
          if (Math.abs(td - p.d) > 0.01) moving = true;
          if (rects[i].top > vh * 1.1 || rects[i].bottom < -vh * 0.1) return;   // fuera de pantalla: no se toca
          apply(p, e, c, p.d, !!next);
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
