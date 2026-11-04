// Portada: intro del logo dentro de la bruma y entrada del hero escrita a máquina.
// Brandbook: oscuridad → trazo de luz → la llama se revela → wordmark → logo estático.
// Aquí el logo vive en la escena WebGL: sale de la bruma, se sostiene y viaja a su
// lugar junto al titular, donde queda con refracción de agua. Después el titular se escribe letra por letra.
(() => {
  const hero = document.querySelector('.hero');
  if (!hero) return;
  const root = document.documentElement;
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const A = !reduceMotion && window.anime ? window.anime : null;
  const EASE = 'inOut(3)';

  const h1 = hero.querySelector('[data-split]');
  const saltar = hero.querySelector('.intro-saltar');
  const manifiesto = hero.querySelector('.m-tipeo');

  // Estado que la escena lee en cada frame (ver hero-bruma.js)
  // Sin intro, el logo ya está en reposo junto al titular
  const estado = window.__noxpyIntro = { trace: 1, fill: 1, word: 1, clear: 0.35, collapse: 0, center: 0 };
  window.__noxpyLight = 1;

  if (!A) return; // Sin animación: el texto queda escrito y quieto

  const letras = prepararTitular();
  hero.querySelectorAll('[data-intro]').forEach((el) => { el.style.opacity = '0'; });

  // La N espera su turno: su animación (SVG y CSS) queda congelada en el instante 0 hasta que entre
  const llama = hero.querySelector('.hero-llama svg');
  const animacionesN = llama ? llama.getAnimations({ subtree: true }) : [];
  if (llama && llama.pauseAnimations) {
    hero.dataset.esperaN = '1';
    llama.pauseAnimations();
    llama.setCurrentTime(0);
    animacionesN.forEach((a) => { a.pause(); a.currentTime = 0; });
  }
  const arrancarN = () => {
    delete hero.dataset.esperaN;
    hero.classList.add('n-viva');   // arranca también el halo pre-calculado
    setTimeout(() => hero.dispatchEvent(new CustomEvent('noxpy:chispa')), 600);   // estallido: brasas desde la llama (brasas.js)
    if (!llama || !llama.unpauseAnimations) return;
    llama.setCurrentTime(0);
    animacionesN.forEach((a) => { a.currentTime = 0; a.play(); });
    if (!hero.classList.contains('fuera')) llama.unpauseAnimations();
  };

  // La intro del logo en la bruma (WebGL) queda en pausa mientras la portada es una imagen fija.
  // Para volver a activarla: INTRO_ACTIVA = true y cargar de nuevo assets/js/hero-bruma.js en index.html.
  const INTRO_ACTIVA = false;
  let seen = !INTRO_ACTIVA;
  if (INTRO_ACTIVA) {
    try { seen = sessionStorage.getItem('noxpy-intro') === '1'; } catch (e) { /* sin almacenamiento: se muestra la intro */ }
  }

  if (seen) {
    entrarHero(0);
    return;
  }

  // Primera visita: la intro espera a que la escena esté lista (o sigue sin ella)
  Object.assign(estado, { trace: 0, fill: 0, word: 0, clear: 0, collapse: 0, center: 1 });
  window.__noxpyLight = 0;
  root.classList.add('en-intro');
  root.style.overflow = 'hidden';

  let empezo = false;
  const empezar = () => { if (!empezo) { empezo = true; reproducirIntro(); } };
  if (window.__noxpyScene) empezar();
  document.addEventListener('noxpy:escena', empezar, { once: true });
  document.addEventListener('noxpy:sin-escena', () => { empezo = true; terminarIntro(true); }, { once: true });
  setTimeout(() => { if (!empezo) { empezo = true; terminarIntro(true); } }, 2500);

  let tl = null;
  let terminada = false;

  function reproducirIntro() {
    saltar.hidden = false;
    tl = A.createTimeline({ defaults: { ease: EASE } });
    // 0 a 0.5 s: oscuridad con bruma y grano
    tl.add(estado, { trace: [0, 1], duration: 1000 }, 500)          // trazo de luz sobre el contorno
      .add(estado, { fill: [0, 1], clear: [0, 1], duration: 1100 }, 1500) // la niebla se abre y la llama aparece
      .add(estado, { word: [0, 1], duration: 900 }, 2500)            // wordmark con barrido de luz
      .add({ duration: 700 }, 3400)                                   // logo estático
      .then(() => terminarIntro(false));

    const skip = () => { if (!terminada) { tl.pause(); terminarIntro(true); } };
    saltar.addEventListener('click', skip);
    window.addEventListener('keydown', function onKey(e) {
      if (['Escape', 'ArrowDown', 'PageDown', ' '].includes(e.key)) { skip(); window.removeEventListener('keydown', onKey); }
    });
    window.addEventListener('wheel', skip, { once: true, passive: true });
    window.addEventListener('touchmove', skip, { once: true, passive: true });
  }

  // El logo se contrae hasta volverse la luz, la luz se va a su lugar y entra el texto
  function terminarIntro(rapido) {
    if (terminada) return;
    terminada = true;
    try { sessionStorage.setItem('noxpy-intro', '1'); } catch (e) { /* nada que guardar */ }
    saltar.hidden = true;

    const fin = A.createTimeline({ defaults: { ease: EASE } });
    if (rapido) {
      Object.assign(estado, { trace: 1, fill: 1, word: 1 });
      fin.add(estado, { clear: 0.35, duration: 500 }, 0)
        .add(estado, { center: 0, duration: 900 }, 0);
    } else {
      // El logo viaja a su lugar junto al titular y el agua empieza a correr sobre él
      fin.add(estado, { center: [1, 0], duration: 1400 }, 0)
        .add(estado, { clear: [1, 0.35], duration: 1400 }, 200);
    }
    // La luz es el motor del movimiento: se enciende cuando el logo se vuelve luz
    setTimeout(() => { window.__noxpyLight = 1; }, rapido ? 100 : 350);
    setTimeout(() => {
      root.classList.remove('en-intro');
      root.style.overflow = '';
    }, rapido ? 200 : 900);
    entrarHero(rapido ? 500 : 1300);
  }

  // ---- Escritura a máquina ----

  function prepararTitular() {
    h1.setAttribute('aria-label', h1.textContent.replace(/\s+/g, ' ').trim());
    return [...h1.querySelectorAll('.linea')].map((linea) => {
      const texto = linea.textContent.trim();
      linea.textContent = '';
      linea.setAttribute('aria-hidden', 'true');
      return [...texto].map((ch) => {
        const s = document.createElement('span');
        s.className = 'tch';
        s.textContent = ch;
        linea.append(s);
        return s;
      });
    });
  }

  function esperar(ms) { return new Promise((r) => setTimeout(r, ms)); }

  // Enciende las letras una a una con un ritmo humano (no metrónomo)
  async function escribir(chars, ms) {
    for (let i = 0; i < chars.length; i++) {
      if (i > 0) chars[i - 1].classList.remove('cursor');
      chars[i].classList.add('on', 'cursor');
      const ch = chars[i].textContent;
      await esperar(ms * (0.6 + Math.random() * 0.8) + (ch === ' ' ? ms * 0.8 : 0) + (ch === '.' ? ms * 3 : 0));
    }
  }

  // Orden de entrada: PORTAFOLIO (glitch, CSS) → la N → Dirección de arte… → titular a máquina → manifiesto y botones
  async function entrarHero(delay) {
    await esperar(delay);
    const [linea1, ...luz] = letras;
    const entrar = (sel) => A.animate(hero.querySelectorAll(sel), {
      opacity: [0, 1], translateY: [12, 0], duration: 700, delay: A.stagger(140), ease: EASE,
    });
    // Respaldo: si algo frena la secuencia, a los 9 s todo queda visible
    setTimeout(() => {
      letras.flat().forEach((c) => c.classList.add('on'));
      hero.querySelectorAll('[data-intro]').forEach((el) => { if (el.style.opacity === '0') el.style.opacity = ''; });
      if (hero.dataset.esperaN) arrancarN();
    }, 9000);
    // 1. PORTAFOLIO entra solo con su glitch (0,05 s a 0,75 s)
    await esperar(850);
    // 2. La N: parpadeo, chispa y estallido de la llama
    arrancarN();
    await esperar(1500);
    // 3. Dirección de arte · Ilustración · Motion graphics
    entrar('.hero-eyebrow[data-intro]');
    await esperar(550);
    // 4. El titular, a máquina: lento donde pesa…
    await escribir(linea1, 55);
    await esperar(350);
    linea1[linea1.length - 1].classList.remove('cursor');
    // …rápido donde golpea
    for (let i = 0; i < luz.length; i++) {
      await escribir(luz[i], 32);
      if (i < luz.length - 1) { await esperar(160); luz[i][luz[i].length - 1].classList.remove('cursor'); }
    }
    await esperar(500);
    const ultima = luz[luz.length - 1];
    ultima[ultima.length - 1].classList.remove('cursor');
    // 5. Pienso antes de producir… y los botones
    entrar('.manifiesto[data-intro], .hero-foot[data-intro]');
    maquinaManifiesto();
  }

  // Manifiesto corto: escribe, sostiene (más de 2 s) y borra, una línea a la vez
  async function maquinaManifiesto() {
    if (!manifiesto) return;
    const lineas = manifiesto.dataset.lineas.split('|');
    const texto = manifiesto.querySelector('.m-texto');
    manifiesto.classList.add('is-tipeando');
    texto.textContent = '';
    let i = 0;
    for (;;) {
      const frase = lineas[i];
      for (let n = 1; n <= frase.length; n++) {
        texto.textContent = frase.slice(0, n);
        await esperar(45 * (0.6 + Math.random() * 0.8));
      }
      await esperar(2600);
      for (let n = frase.length; n >= 0; n--) {
        texto.textContent = frase.slice(0, n);
        await esperar(18);
      }
      await esperar(350);
      i = (i + 1) % lineas.length;
      while (document.hidden || hero.classList.contains('fuera')) await esperar(500);
    }
  }
})();
