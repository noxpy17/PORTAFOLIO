// Portada: el titular se escribe a máquina y el manifiesto corto escribe y borra sus líneas.
// "Lento donde pesa, rápido donde golpea" (brandbook): la primera línea va despacio,
// las líneas en cian van rápido. Sin animación (o sin anime.js) el texto queda quieto y completo.
(() => {
  const hero = document.querySelector('.hero');
  if (!hero) return;
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const A = !reduceMotion && window.anime ? window.anime : null;
  if (!A) return;

  const h1 = hero.querySelector('[data-split]');
  const manifiesto = hero.querySelector('.m-tipeo');
  const esperar = (ms) => new Promise((r) => setTimeout(r, ms));

  // Cada letra ocupa su lugar desde el principio (sin saltos de diseño); solo se enciende
  h1.setAttribute('aria-label', h1.textContent.replace(/\s+/g, ' ').trim());
  const lineas = [...h1.querySelectorAll('.linea')].map((linea) => {
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
  const extras = hero.querySelectorAll('[data-intro]');
  extras.forEach((el) => { el.style.opacity = '0'; });

  // Enciende las letras una a una con un ritmo humano (no metrónomo)
  async function escribir(chars, ms) {
    for (let i = 0; i < chars.length; i++) {
      if (i > 0) chars[i - 1].classList.remove('cursor');
      chars[i].classList.add('on', 'cursor');
      const ch = chars[i].textContent;
      await esperar(ms * (0.6 + Math.random() * 0.8) + (ch === ' ' ? ms * 0.8 : 0) + (ch === '.' ? ms * 3 : 0));
    }
  }

  async function entrar() {
    A.animate(extras, { opacity: [0, 1], translateY: [12, 0], duration: 700, delay: A.stagger(140, { start: 250 }), ease: 'inOut(3)' });
    // Respaldo: si algo frena la escritura, a los 6 s el titular queda completo
    setTimeout(() => { lineas.flat().forEach((c) => c.classList.add('on')); }, 6000);
    const [primera, ...luz] = lineas;
    await escribir(primera, 55);
    await esperar(350);
    primera[primera.length - 1].classList.remove('cursor');
    for (let i = 0; i < luz.length; i++) {
      await escribir(luz[i], 32);
      if (i < luz.length - 1) { await esperar(160); luz[i][luz[i].length - 1].classList.remove('cursor'); }
    }
    await esperar(900);
    const ultima = luz[luz.length - 1] || primera;
    ultima[ultima.length - 1].classList.remove('cursor');
    maquinaManifiesto();
  }

  // Manifiesto corto: escribe, sostiene (más de 2 s) y borra, una línea a la vez
  async function maquinaManifiesto() {
    if (!manifiesto) return;
    const frases = manifiesto.dataset.lineas.split('|');
    const texto = manifiesto.querySelector('.m-texto');
    manifiesto.classList.add('is-tipeando');
    texto.textContent = '';
    for (let i = 0; ; i = (i + 1) % frases.length) {
      const frase = frases[i];
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
      while (document.hidden) await esperar(500);
    }
  }

  entrar();
})();
