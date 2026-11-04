// Fondo de la portada: montaje de proyectos del portafolio, dibujado con WebGL en la tarjeta gráfica.
// - Ritmo de latido en frases: fuerte-lento · fuerte-fuerte-lento · fuerte-lento-lento, con un empuje de cámara que no
//   para y un pulso en cada latido (el empuje y el paralaje los hace CSS, sin redibujar).
// - Gradación fría con rojos intensos: base gris azulada; los tonos cálidos (pieles, ropa, luces) se vuelven
//   rojo casi magenta y se estiran hacia un lado; desfase RGB leve, grano de película animado y bloom.
// - Cortes con glitch prismático: columnas de vidrio que refractan la foto, dispersión roja y azul,
//   filos de luz, haces y rayos verticales; la foto nueva se abre desde el centro.
// - Hover: el cursor estira la imagen en la dirección del movimiento y revela su negativo; la imagen
//   vuelve sola a su lugar en unos segundos.
// Sin WebGL, o si la tarjeta gráfica no logra compilar el efecto, las fotos se muestran con un oscurecido simple.
// En celulares y tabletas se usa una versión ligera del efecto (menos muestras por píxel), se recupera solo si el
// sistema le quita la tarjeta gráfica a la página (pasa en iPhone al cambiar de app) y el logo deformado solo
// pide su propio contexto WebGL la primera vez que se usa.
(() => {
  const hero = document.querySelector('.hero');
  let canvas = hero && hero.querySelector('.hero-montaje');
  if (!canvas) return;
  const quieto = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const ligero = window.matchMedia('(pointer: coarse)').matches || (navigator.deviceMemory && navigator.deviceMemory <= 2);

  const NOMBRES = ['puntos-azules', 'gatozorro-portada', 'andina-refajo', 'naiza-120', 'dapper-portada', 'avianca-cargo',
    'la-liga-epm', 'andina-feria-cali', 'gatozorro-01', 'puntos-colombia', 'dapper'];
  // Ritmo de latido en frases que se repiten: F = latido fuerte (rápido y brillante), L = latido lento
  // (más suave y más largo). Entre latidos de una frase hay poco tiempo; entre frases, una pausa corta.
  const FRASES = [['F', 'L'], ['F', 'F', 'L'], ['F', 'L', 'L']];
  const LATIDO = {
    F: { fuerza: 1, dura: 1, luego: 2000 },      // fuerte: glitch completo; la foto queda 2 s
    L: { fuerza: 0.55, dura: 1.5, luego: 2300 }, // lento: más tenue, se apaga más despacio; la foto queda 2,3 s
    pausa: 2700,                                  // la última foto de cada frase se queda un poco más
  };
  const GLITCH = 630;                    // ms que dura el glitch prismático después de cada corte

  let gl = canvas.getContext('webgl', { alpha: false, antialias: false, premultipliedAlpha: false, powerPreference: 'low-power' });
  let ctx2d = gl ? null : canvas.getContext('2d');
  let perdido = false;   // la tarjeta gráfica se perdió (se recupera con webglcontextrestored)

  // ---------- Sombreadores ----------
  const VERT = `attribute vec2 p; varying vec2 v; void main(){ v = p * .5 + .5; gl_Position = vec4(p, 0., 1.); }`;
  // Alta precisión cuando el equipo la tiene: en media precisión (muchos celulares) el ruido y las ondas se dañan
  const PRECISION = `
    #ifdef GL_FRAGMENT_PRECISION_HIGH
      precision highp float;
    #else
      precision mediump float;
    #endif
  `;
  const FRAG = `
    varying vec2 v;
    uniform sampler2D uTex, uBloom, uEstela, uPrev;   // uPrev: la foto anterior, para fundir el corte   // uEstela: r = intensidad, g/b = dirección del movimiento
    uniform vec2 uRes, uCubre, uCubreP;          // resolución del lienzo y escala para cubrir con la imagen
    uniform float uGlitch, uT, uFade, uMezcla, uSemilla, uProg, uHayEstela;
    float h(float n){ return fract(sin(n) * 43758.5453); }
    float h2(vec2 q){ return fract(sin(dot(q, vec2(12.9898, 78.233))) * 43758.5453); }
    vec2 cubrir(vec2 q){ return (q - .5) * uCubre + .5; }
    // Cuánto "cálido" tiene un color (rojos, naranjas, pieles): de ahí sale el rojo intenso
    float calor(vec3 c){ return smoothstep(.07, .3, c.r - max(c.g * .85, c.b)); }
    // Base fría: casi sin saturación, con sombras azul petróleo y luces gris azulado
    vec3 frioDe(vec3 c){ float l = dot(c, vec3(.299, .587, .114)); return mix(vec3(l), c, .42) * vec3(.72, .9, 1.22) + vec3(.015, .04, .1) * (1. - l); }
    // Cálidos: rojo casi magenta, suavizado (menos saturado y menos brillante)
    vec3 rojoDe(vec3 c){ float l = dot(c, vec3(.299, .587, .114)); return vec3(.92, .16, .32) * (.24 + l * 1.15) + vec3(.18, .07, .1) * smoothstep(.6, 1., l); }
    // Ondas que fluyen: la estela se mueve como un líquido y no como un corte
    vec2 ola(vec2 p, float t){ return vec2(sin(p.y * 22. + t * 3.1 + sin(p.x * 13. - t * 1.7) * 1.6), sin(p.x * 19. - t * 2.6 + sin(p.y * 15. + t * 2.2) * 1.6)); }
    vec3 acabado(vec3 c){ return clamp((c - .5) * 1.14 + .5, 0., 1.) * .88; }   // contraste
    // Intensidad del filtro de color (frío con rojos): 0 = foto original, 1 = filtro completo
    const float FILTRO = .1;
    vec3 gradar(vec3 c){ return mix(c, acabado(mix(frioDe(c), rojoDe(c), calor(c) * .85)), FILTRO); }
    void main(){
      vec2 uv = vec2(v.x, 1. - v.y);
      float g = uGlitch;
      // Glitch prismático: en los cortes la foto se ve a través de columnas de vidrio. Cada columna
      // refracta su franja (la corre y la amplía), abre el color en rojo y azul y tiene un filo de luz.
      float semilla = uSemilla;                                // cada corte trae un vidrio distinto
      // Columnas siempre verticales, en espejo desde el centro: en cada corte se abren del centro hacia afuera
      float aspP = uRes.x / uRes.y;
      vec2 eje = vec2(1., 0.);
      vec2 ejeUV = eje / vec2(aspP, 1.);
      float cols = 3.2 + h(semilla) * 3.;                      // columnas gruesas: de 3 a 6 por alto de pantalla
      float lado = uv.x < .5 ? -1. : 1.;                       // mitad izquierda hacia la izquierda, derecha hacia la derecha
      float cx = abs(uv.x - .5) * aspP * cols - uProg * 1.6;    // el patrón avanza hacia afuera mientras dura el corte
      float id = floor(cx), fr = fract(cx), lente = fr - .5;
      float pr = (lente * (.05 + .07 * h(id + semilla * 7.)) + (h(id * 2.3 + semilla) - .5) * .03) * g;
      float dp = (.003 + abs(lente) * .03) * g;                // dispersión: más fuerte hacia los bordes de cada columna
      uv += ejeUV * pr * lado;
      vec2 sv = vec2(.003, 0.) + ejeUV * dp * lado;                   // desfase de canales leve siempre, más en el vidrio
      // Transición: solo durante el corte, la foto llega apenas estirada en horizontal (un solo eje)
      // y se recoge enseguida; casi imperceptible
      uv.x = .5 + (uv.x - .5) / (1. + .04 * g);
      vec2 q = cubrir(uv);
      vec3 c;
      c.r = texture2D(uTex, q + sv).r;
      c.g = texture2D(uTex, q).g;
      c.b = texture2D(uTex, q - sv).b;
      // Fundido: la foto anterior se disuelve en la nueva en unos cuadros, en vez de un salto seco
      if (uMezcla < 1.) {
        vec2 qp = (uv - .5) * uCubreP + .5;
        vec3 cp = vec3(texture2D(uPrev, qp + sv).r, texture2D(uPrev, qp).g, texture2D(uPrev, qp - sv).b);
        // La foto nueva se abre desde el centro hacia los lados
        float frente = uMezcla * .72;
        c = mix(cp, c, 1. - smoothstep(frente - .2, frente, abs(uv.x - .5)));
      }
      #ifndef LIGERO
      // Eco muy sutil: dos copias tenues de la foto, corridas hacia afuera, que se apagan con el glitch
      if (g > .01) {
        vec3 eco = texture2D(uTex, cubrir(uv - ejeUV * lado * .035 * g)).rgb * .6
                 + texture2D(uTex, cubrir(uv - ejeUV * lado * .07 * g)).rgb * .4;
        c = mix(c, max(c, eco), .22 * g);
      }
      // Rojos con motion blur: la capa cálida se promedia en horizontal, como si se moviera; la base fría queda nítida
      vec3 rs = vec3(0.); float ws = 0.;
      for (int i = 0; i < 9; i++) {
        vec3 m = texture2D(uTex, q + (float(i) - 4.) * vec2(.0075, .0012)).rgb;
        float w = calor(m);
        rs += rojoDe(m) * w; ws += w;
      }
      c = mix(c, acabado(mix(frioDe(c), rs / max(ws, .001), ws / 9. * .85)), FILTRO);
      #else
      c = gradar(c);
      #endif
      #ifndef LIGERO
      // Extremos desenfocados en diagonal curva: nítido en una banda que cruza la imagen en diagonal
      // y que se curva; hacia las esquinas opuestas la foto se desenfoca poco a poco
      vec2 pd = vec2((uv.x - .5) * uRes.x / uRes.y, uv.y - .5);
      float lejos = abs(pd.y + .42 * pd.x - .32 * pd.x * pd.x);
      float desenfoque = smoothstep(.16, .5, lejos);
      if (desenfoque > .01) {
        vec3 db = vec3(0.);
        for (int i = 0; i < 12; i++) {
          float a = float(i) * 2.39996, r = sqrt((float(i) + .5) / 12.);   // espiral dorada: disco uniforme
          db += texture2D(uTex, q + vec2(cos(a), sin(a)) * r * desenfoque * vec2(.03 * uRes.y / uRes.x, .03)).rgb;
        }
        c = mix(c, gradar(db / 12.), desenfoque);
      }
      #endif
      // Bloom: luces altas pre-desenfocadas, con la misma gradación
      c += gradar(texture2D(uBloom, q).rgb) * .55;
      #ifndef LIGERO
      // Rojos estirados: los cálidos se arrastran hacia un lado, como una foto movida con flash
      vec3 barrido = vec3(0.);
      for (int i = 1; i <= 7; i++) {
        float f = float(i) / 7.;
        vec3 m = texture2D(uTex, cubrir(uv - vec2(.055, .008) * f)).rgb;
        float lm = dot(m, vec3(.299, .587, .114));
        barrido = max(barrido, vec3(.92, .15, .3) * (.25 + lm) * calor(m) * (1. - f) * .6 * FILTRO);
      }
      c = 1. - (1. - c) * (1. - barrido);                          // se suma como luz (screen)
      #endif
      // Estela del cursor: estira la foto en la dirección del movimiento (los píxeles se arrastran desde
      // atrás) y se relaja sola en unos segundos. Del lado de la foto se enfría a azul; hacia donde se
      // estira se calienta a naranja, con el rojo y el azul separados como en una exposición larga.
      // Estela suavizada (9 muestras) para que el estiramiento no quede dentado
      vec2 ue = vec2(v.x, 1. - v.y), px = vec2(3.4 / 320., 3.4 / 180.);   // misma orientación que el lienzo de la estela
      // El borde de la estela tiembla como la superficie de un líquido
      vec2 aspE = vec2(uRes.y / uRes.x, 1.);
      vec2 ueL = ue + ola(ue / aspE * .7, uT * .8) * aspE * .0045;
      vec4 e = vec4(0., .5, .5, 0.); vec2 gr = vec2(0.);   // gr: pendiente de la estela, para la refracción y el brillo
      if (uHayEstela > .5) {
      e = vec4(0.);
      for (int j = -1; j <= 1; j++) for (int i = -1; i <= 1; i++) {
        vec4 s = texture2D(uEstela, ueL + vec2(float(i), float(j)) * px);
        e += s; gr += s.r * vec2(float(i), float(j));
      }
      e /= 9.;
      }
      float k = smoothstep(.02, .7, e.r); k = k * k * (3. - 2. * k);   // transición doble: bordes muy suaves
      if (k > .001) {
        vec2 dir = (e.gb - .5) * 2.;
        dir = length(dir) > .02 ? normalize(dir) : vec2(1., 0.);
        // Desplazamiento: cada píxel toma la foto que quedó atrás; como la fuerza varía dentro de la estela,
        // la imagen se estira (no se emborrona). Unas pocas muestras cercanas dan el barrido suave
        vec2 asp = vec2(uRes.y / uRes.x, 1.);
        vec2 atras = -dir * asp * .096 * k * k;   // 20 % más corto que antes
        atras += ola(ue / asp, uT) * asp * .02 * k;   // ondulación líquida dentro de la estela
        atras += gr * asp * .02;                        // los bordes refractan la foto, como una gota
        // Una sola muestra por canal: la foto se deforma y se mezcla como agua, sin copias repetidas
        vec2 disp = gr * asp * .006;   // dispersión: el color se abre donde el líquido se curva
        vec2 o = atras * .86;
        vec3 suma = vec3(texture2D(uTex, cubrir(uv + o * 1.02 + disp)).r,
                         texture2D(uTex, cubrir(uv + o)).g,
                         texture2D(uTex, cubrir(uv + o * .98 - disp)).b);
        vec3 estirada = gradar(suma);
        // Revela el negativo de la foto: más fuerte en el centro de la estela, se funde hacia los bordes
        vec3 negativo = pow(max(1. - estirada, 0.), vec3(1.6)) * .6;   // negativo oscuro
        c = mix(c, mix(estirada, negativo, smoothstep(.15, .75, k)), k);
        // Brillo húmedo: una luz suave se refleja en la pendiente de la estela
        vec3 nrm = normalize(vec3(-gr * 2.2, .35));
        float brillo = pow(max(dot(nrm, normalize(vec3(-.45, .55, .7))), 0.), 18.);
        float destello = pow(max(dot(nrm, normalize(vec3(.5, -.35, .8))), 0.), 60.);
        c += vec3(.85, .9, 1.) * (brillo * .32 + destello * .22) * smoothstep(.05, .4, k);
        // Menisco: filo cian muy tenue donde el líquido toca la foto
        c += vec3(0., .55, .65) * smoothstep(.04, .25, k) * (1. - smoothstep(.25, .6, k)) * .14;
      }
      // Filos de luz de las columnas de vidrio (rojo a un lado, azul al otro) y rayos verticales de las luces
      if (g > .01) {
        c += (vec3(smoothstep(.08, 0., fr) * .6, 0., smoothstep(.92, 1., fr) * .75) + vec3(.9, .92, 1.) * smoothstep(.025, 0., abs(fr - .04)) * .5) * g;
        vec3 rayo = vec3(0.);
        for (int i = 0; i < 5; i++) rayo += texture2D(uBloom, q + vec2(-eje.y / aspP, eje.x) * (float(i) - 2.) * .07 * g).rgb;   // a lo largo de la columna
        c += gradar(rayo / 5.) * .7 * g;
        // Haces de luz: algunas columnas se encienden con un haz rosado y blanco, con halo amplio,
        // y toda la imagen se ilumina con una bruma violeta
        float enc = step(.62, h(id * 5.1 + semilla * 3.7));
        float xh = (fr - .5) / .1, xl = (fr - .5) / .38;   // al cuadrado a mano: pow() con base negativa da NaN en muchos celulares
        float haz = exp(-xh * xh), halo = exp(-xl * xl);
        vec3 tinte = mix(vec3(1., .42, .78), vec3(.55, .62, 1.), h(id + semilla));
        c += (mix(tinte, vec3(1.), haz * .6) * haz * 1.05 + tinte * halo * .25) * enc * g;
        c = c * (1. + .22 * g) + vec3(.32, .2, .42) * .15 * g;
      }
      // Grano de película: grueso (2 px) y animado, a la mitad de lo que tenía; más fuerte en los cortes
      c += (h2(floor(v * uRes / 1.6) + fract(uT * 7.3) * 91.) - .5) * (.042 + .07 * g);
      gl_FragColor = vec4(c * uFade, 1.);
    }`;

  let prog = null;
  const uni = {};
  // Compilar en dos pasos: pedir la compilación (no bloquea) y, después, preguntar si quedó bien.
  // Preguntar enseguida obliga a esperar: en celular, con un efecto grande, la página se congelaba segundos
  const crearPrograma = (ctx, frag) => {
    const sh = (tipo, src) => { const x = ctx.createShader(tipo); ctx.shaderSource(x, src); ctx.compileShader(x); return x; };
    const vs = sh(ctx.VERTEX_SHADER, VERT), fs = sh(ctx.FRAGMENT_SHADER, frag);
    const pr = ctx.createProgram();
    ctx.attachShader(pr, vs); ctx.attachShader(pr, fs); ctx.linkProgram(pr);
    pr.partes = [vs, fs];
    return pr;
  };
  const programaValido = (ctx, pr) => {
    if (ctx.getProgramParameter(pr, ctx.LINK_STATUS)) return true;
    if (!ctx.isContextLost()) pr.partes.forEach((x) => { const log = ctx.getShaderInfoLog(x); if (log) console.warn('NOXPY montaje:', log); });
    return false;
  };
  const programa = (ctx, frag) => { const pr = crearPrograma(ctx, frag); return programaValido(ctx, pr) ? pr : null; };
  const paralelo = gl && gl.getExtension('KHR_parallel_shader_compile');
  let glListo = false;
  // Sin WebGL utilizable: el lienzo se cambia por uno 2D (un lienzo que ya pidió WebGL no puede dar 2D)
  const caerA2D = () => {
    const nuevo = canvas.cloneNode(false);
    canvas.replaceWith(nuevo);
    canvas = nuevo; gl = null; prog = null;
    ctx2d = canvas.getContext('2d');
    medir(); sucio = true;
  };
  // Prepara la tarjeta gráfica: programa (completo o, si no compila, ligero), geometría y uniformes.
  // Donde el navegador lo permite, la compilación corre en segundo plano y la página sigue fluida.
  // Se repite si el sistema le quita la tarjeta gráfica a la página
  const iniciarGL = (alTerminar) => {
    glListo = false;
    const versiones = ligero ? ['#define LIGERO\n'] : ['', '#define LIGERO\n'];
    const probar = (k) => {
      if (!gl || k >= versiones.length) { alTerminar(false); return; }
      const pr = crearPrograma(gl, PRECISION + versiones[k] + FRAG);
      const revisar = () => {
        if (gl.isContextLost()) return;   // se reintenta cuando vuelva la tarjeta gráfica
        if (programaValido(gl, pr)) { configurar(pr); glListo = true; alTerminar(true); } else probar(k + 1);
      };
      if (paralelo) {
        const mirar = () => { if (gl.isContextLost()) return; if (gl.getProgramParameter(pr, paralelo.COMPLETION_STATUS_KHR)) revisar(); else setTimeout(mirar, 40); };
        mirar();
      } else revisar();
    };
    probar(0);
  };
  const configurar = (pr) => {
    prog = pr;
    gl.useProgram(prog);
    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(prog, 'p');
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    ['uTex', 'uBloom', 'uEstela', 'uRes', 'uCubre', 'uGlitch', 'uT', 'uFade', 'uPrev', 'uCubreP', 'uMezcla', 'uSemilla', 'uProg', 'uHayEstela'].forEach((n) => { uni[n] = gl.getUniformLocation(prog, n); });
    gl.uniform1i(uni.uTex, 0);
    gl.uniform1i(uni.uBloom, 1);
    gl.uniform1i(uni.uEstela, 2);
    gl.uniform1i(uni.uPrev, 3);
    if (W) gl.viewport(0, 0, W, H);
  };
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
    const iw = img.naturalWidth || img.width, ih = img.naturalHeight || img.height;   // <img> o ImageBitmap
    const w = Math.max(8, Math.round(iw / 12)), hh = Math.max(8, Math.round(ih / 12));
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
  let previo = 0, cortes = 0, gSuave = 0, ultimoCuadro = 0, encendidoDesde = 0;
  let frase = 0, paso = 0, fuerzaCorte = 1, duraCorte = 1, duraImagen = 2000;
  let actual = 0, corteEn = -1e9, proximoCorte = 0, sostenDesde = 0, encendido = quieto ? 1 : 0, t0 = 0, sucio = true;

  // El lienzo trabaja a la resolución de las fotos (máx. 1280 px de ancho); la tarjeta gráfica lo estira
  const medir = () => {
    const r = hero.getBoundingClientRect();
    const w = r.width * 1.12, hh = r.height * 1.12;   // 12 % de margen para el empuje de cámara y el paralaje
    const e = Math.min(1, (ligero ? 900 : 1280) / w);
    const nw = Math.round(w * e), nh = Math.round(hh * e);
    // Cambiar el tamaño borra el lienzo: solo se hace si de verdad cambió (en celular la barra del navegador
    // dispara "resize" a cada rato al hacer scroll)
    if (nw !== canvas.width || nh !== canvas.height) { canvas.width = nw; canvas.height = nh; }
    W = nw; H = nh;
    if (gl) gl.viewport(0, 0, W, H);
    sucio = true;
  };

  // La tarjeta gráfica se prepara cuando ya llegó la primera foto (no antes: así el texto y la entrada
  // de la portada no compiten con ella al cargar)
  let glPedido = false;
  const arrancarGL = () => {
    if (glPedido || !gl) return;
    glPedido = true;
    iniciarGL((ok) => {
      if (!ok) { caerA2D(); despertar(); return; }
      estelaTex = textura(estela);
      if (listas.length) subir(listas[actual % listas.length]);
      sucio = true; despertar();
    });
  };

  // Las imágenes entran al montaje a medida que llegan. La primera se pide sola y con prioridad, para que el
  // fondo aparezca rápido aun con mala señal; las demás se piden cuando ya está (o a los 2,5 s si tarda).
  // Cada foto se decodifica fuera del hilo principal y se sube a la tarjeta gráfica recién cuando le toca
  // salir (o un momento antes): subir las 11 de una vez congelaba el celular
  const listas = [];
  const base = document.querySelector('script[src*="montaje.js"]').getAttribute('src').split('assets/js/')[0] + 'assets/img/montaje/';
  const subirDesde = (item, fuente) => {
    if (!gl || perdido || !glListo || item.tex) return;
    item.tex = textura(fuente);
    item.bloom = textura(item.luces || (item.luces = luces(fuente)));
    sucio = true;
  };
  // Con calma: decodifica fuera del hilo principal y sube cuando está lista
  const subir = (item) => {
    if (!gl || perdido || !glListo || item.tex || item.preparando) return;
    if (!window.createImageBitmap) { subirDesde(item, item.img); return; }
    item.preparando = true;
    createImageBitmap(item.img).then((bm) => {
      item.preparando = false;
      subirDesde(item, bm);
      if (bm.close) bm.close();
      despertar();
    }, () => { item.preparando = false; subirDesde(item, item.img); });
  };
  const cargar = (n, i) => {
    const img = new Image();
    img.decoding = 'async';
    if (i === 0 && 'fetchPriority' in img) img.fetchPriority = 'high';
    img.onload = () => {
      const item = { i, img, w: img.naturalWidth, h: img.naturalHeight, tex: null, bloom: null, preparando: false };
      listas.push(item);
      listas.sort((a, b) => a.i - b.i);
      if (listas.length === 1) { medir(); arrancarGL(); despertar(); }
      if (i === 0) resto();
    };
    img.onerror = () => { if (i === 0) resto(); };
    img.src = `${base}${n}.webp`;
  };
  let restoPedido = false;
  const resto = () => { if (restoPedido) return; restoPedido = true; NOMBRES.slice(1).forEach((n, k) => cargar(n, k + 1)); };
  cargar(NOMBRES[0], 0);
  setTimeout(resto, 2500);

  // Estela del cursor: un lienzo pequeño (se estira en la tarjeta gráfica) donde el cursor pinta manchas suaves.
  // Rojo = intensidad; verde/azul = dirección del movimiento. Cada cuadro se desvanece un poco.
  const estela = document.createElement('canvas');
  estela.width = 320; estela.height = 180;
  const ectx = estela.getContext('2d');
  ectx.fillStyle = 'rgb(0,128,128)'; ectx.fillRect(0, 0, 320, 180);
  let estelaTex = null, estelaViva = 0;

  // Si el sistema le quita la tarjeta gráfica a la página (iPhone al cambiar de app, poca memoria),
  // se espera a que la devuelva y se vuelve a preparar todo; mientras tanto no se dibuja nada
  canvas.addEventListener('webglcontextlost', (e) => { e.preventDefault(); perdido = true; }, false);
  canvas.addEventListener('webglcontextrestored', () => {
    perdido = false;
    listas.forEach((it) => { it.tex = null; it.bloom = null; });   // las texturas viejas ya no sirven
    iniciarGL((ok) => {
      if (!ok) { caerA2D(); despertar(); return; }
      estelaTex = textura(estela);
      medir(); despertar();
    });
  }, false);
  const pintarEstela = (x0, y0, x1, y1, vx, vy) => {
    const pasos = Math.max(1, Math.ceil(Math.hypot(x1 - x0, y1 - y0) / 3));
    const v = Math.hypot(vx, vy) || 1;
    const gC = Math.round(128 + (vx / v) * 127), bC = Math.round(128 + (vy / v) * 127);
    const fuerza = Math.min(1, v / 900);
    for (let i = 1; i <= pasos; i++) {
      const x = x0 + (x1 - x0) * (i / pasos), y = y0 + (y1 - y0) * (i / pasos);
      const R = 10.4 + fuerza * 8.8;   // 20 % más pequeño que antes
      const gr = ectx.createRadialGradient(x, y, 0, x, y, R);
      const a = 0.6 * fuerza + 0.25;
      // Caída gaussiana: sin borde marcado donde termina el efecto
      [[0, 1], [0.2, 0.82], [0.45, 0.45], [0.7, 0.15], [0.88, 0.04], [1, 0]].forEach(([t, k]) => gr.addColorStop(t, `rgba(255,${gC},${bC},${(a * k).toFixed(3)})`));
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
    if (m.ex >= 0 && ahora - m.ultimo < 250) {   // tolera equipos lentos
      const vx = ((ex - m.ex) / 320) * rc.width / dt, vy = ((ey - m.ey) / 180) * rc.height / dt;
      pintarEstela(m.ex, m.ey, ex, ey, vx, vy);
    }
    m.ex = ex; m.ey = ey; m.ultimo = ahora;
    despertar();
  };
  hero.addEventListener('pointerleave', () => { m.ex = -1; });
  hero.addEventListener('pointermove', (e) => mover(e.clientX, e.clientY), { passive: true });
  hero.addEventListener('touchmove', (e) => { const t = e.touches[0]; if (t) mover(t.clientX, t.clientY); }, { passive: true });
  hero.addEventListener('pointerdown', (e) => { if (!e.target.closest('a, button')) { latirYa(); despertar(); } });
  // La N se enciende (ver intro.js): ráfaga
  hero.addEventListener('noxpy:chispa', () => { latirYa(); despertar(); });

  const latirYa = () => { frase = 0; paso = 0; proximoCorte = 0; };
  // La foto que sigue se elige con anticipación y se sube a la tarjeta gráfica un momento después del corte,
  // con calma, para que el siguiente corte no tenga que esperarla
  let proxima = -1;
  const elegirProxima = () => {
    if (listas.length < 2) { proxima = -1; return; }
    do { proxima = Math.floor(Math.random() * listas.length); } while (proxima === actual);
    const it = listas[proxima];
    setTimeout(() => subir(it), 350);
  };
  const cortar = (ahora) => {
    if (listas.length < 2) return;
    let siguiente = proxima;
    if (siguiente < 0 || siguiente === actual || siguiente >= listas.length) { do { siguiente = Math.floor(Math.random() * listas.length); } while (siguiente === actual); }
    previo = actual; actual = siguiente; corteEn = ahora; cortes++; sucio = true;
    elegirProxima();
  };

  const dibujar = (ahora) => {
    if (!listas.length) return;
    const item = listas[actual % listas.length];
    // Empuje de cámara y paralaje: los mueve la tarjeta gráfica (transform), sin redibujar.
    // La cámara nunca se queda quieta: avanza lento durante todo el ciclo y cada latido la empuja un poco más
    // Cada foto hace su propio acercamiento lento durante todo el tiempo que está en pantalla
    const avance = Math.min((ahora - corteEn) / duraImagen, 1);
    const pulso = Math.exp(-(ahora - corteEn) / 220) * fuerzaCorte;
    const empuje = 1.02 + avance * 0.07 + pulso * 0.03;
    m.x += (m.tx - m.x) * 0.08; m.y += (m.ty - m.y) * 0.08;
    canvas.style.transform = `translate3d(${(-m.x * 26).toFixed(1)}px, ${(-m.y * 18).toFixed(1)}px, 0) scale(${empuje.toFixed(4)})`;

    const desde = ahora - corteEn;
    // El brillo del corte se apaga con una curva suave (rápido al principio, lento al final)
    // El glitch entra y sale suave: se sostiene un instante tras el corte, baja despacio, y además
    // se filtra cuadro a cuadro para que nunca salte de golpe (ni al subir ni al bajar)
    const largo = GLITCH * duraCorte;
    const objetivo = (desde < 112 ? 1 : desde < largo ? (1 - (desde - 112) / (largo - 112)) ** 2 : 0) * fuerzaCorte;
    const dt = Math.min(ahora - (ultimoCuadro || ahora), 100); ultimoCuadro = ahora;
    gSuave += (objetivo - gSuave) * (1 - Math.exp(-dt / 140));
    const g = gSuave < 0.003 ? 0 : gSuave;
    // Fundido entre la foto anterior y la nueva (unos 420 ms)
    const tm = Math.min(desde / (420 * duraCorte), 1), mezcla = tm * tm * (3 - 2 * tm);
    // La estela se desvanece hacia "sin intensidad y sin dirección"
    if (estelaViva > 0) {
      ectx.fillStyle = 'rgba(0,128,128,0.017)';   // se relaja despacio, como un líquido espeso
      ectx.fillRect(0, 0, 320, 180);
      estelaViva *= 0.991;
      if (estelaViva < 0.02) { estelaViva = 0; ectx.fillStyle = 'rgb(0,128,128)'; ectx.fillRect(0, 0, 320, 180); }
      if (gl && !perdido) { gl.activeTexture(gl.TEXTURE2); gl.bindTexture(gl.TEXTURE_2D, estelaTex); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, estela); }
      if (estelaViva > 0) { const mk = obtenerMarca(); if (mk) mk.dibujar(canvas, ((ahora - t0) / 1000) % 3600); } else if (marca) marca.soltar();
      sucio = true;
    }
    // Solo se redibuja con un corte, durante el VHS, mientras vive la estela o mientras se enciende
    // El grano se renueva unas 12 veces por segundo, como película
    if (ahora - ultimoGrano > 83) { ultimoGrano = ahora; sucio = true; }
    if (!(sucio || g > 0.01 || encendido < 1)) return;
    if (gl && (perdido || !glListo)) return;
    if (gl && !item.tex) {
      // La foto que toca aún no está en la tarjeta gráfica: se espera a la decodificación en curso o, si no hay, se sube ya
      if (item.preparando) return;
      subirDesde(item, item.img);
    }
    sucio = false;
    // El fondo aparece con un fundido desde el primer cuadro que de verdad se dibuja
    if (!encendidoDesde) encendidoDesde = ahora;
    encendido = quieto ? 1 : Math.min(1, (ahora - encendidoDesde) / 900);

    const s = Math.max(W / item.w, H / item.h);
    if (gl) {
      gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, item.tex);
      gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, item.bloom);
      gl.uniform2f(uni.uRes, W, H);
      gl.uniform2f(uni.uCubre, W / (item.w * s), H / (item.h * s));
      gl.activeTexture(gl.TEXTURE2); gl.bindTexture(gl.TEXTURE_2D, estelaTex);
      gl.uniform1f(uni.uGlitch, g);
      gl.uniform1f(uni.uT, ((ahora - t0) / 1000) % 3600);   // acotado: con números grandes las ondas pierden precisión
      gl.uniform1f(uni.uHayEstela, estelaViva > 0 ? 1 : 0);
      gl.uniform1f(uni.uFade, encendido);
      const pv0 = listas[previo % listas.length], pv = pv0 && pv0.tex ? pv0 : item, sp = Math.max(W / pv.w, H / pv.h);
      gl.activeTexture(gl.TEXTURE3); gl.bindTexture(gl.TEXTURE_2D, pv.tex);
      gl.uniform2f(uni.uCubreP, W / (pv.w * sp), H / (pv.h * sp));
      gl.uniform1f(uni.uMezcla, mezcla);
      gl.uniform1f(uni.uProg, Math.min(desde / (GLITCH * duraCorte), 1));
      gl.uniform1f(uni.uSemilla, cortes % 97);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    } else {
      const w = item.w * s, hh = item.h * s;
      ctx2d.globalAlpha = 1; ctx2d.fillStyle = '#050a0a'; ctx2d.fillRect(0, 0, W, H);
      ctx2d.globalAlpha = 0.75 * encendido;
      ctx2d.drawImage(item.img, (W - w) / 2, (H - hh) / 2, w, hh);
    }
  };

  // ---------- PORTAFOLIO deformado por la estela ----------
  // Mientras haya estela, el logo se dibuja en un lienzo propio (WebGL) con el mismo estiramiento; el <img>
  // se oculta y el lienzo hereda su brillo (filtros CSS) y sus animaciones. Al apagarse la estela vuelve el <img>.
  const marcaLuz = hero.querySelector('.hero-marca-luz');
  const marcaImg = marcaLuz && marcaLuz.querySelector('img');
  // Se crea solo la primera vez que hace falta: así nadie paga un segundo contexto WebGL si no toca la portada
  let marca;
  const obtenerMarca = () => {
    if (marca === undefined) marca = marcaImg && gl ? crearMarca() : null;
    return marca;
  };
  const crearMarca = () => {
    const cv = document.createElement('canvas');
    cv.className = 'marca-deformada';
    cv.setAttribute('aria-hidden', 'true');
    marcaLuz.append(cv);
    const lg = cv.getContext('webgl', { alpha: true, premultipliedAlpha: true, antialias: false });
    if (!lg) { cv.remove(); return null; }
    const FRAG_M = PRECISION + `
      varying vec2 v;
      uniform sampler2D uLogo, uEstela;
      uniform vec4 uIn, uMap;     // uIn: rectángulo del logo dentro del lienzo; uMap: lienzo → coordenadas de la estela
      uniform vec2 uConv, uAsp;
      uniform float uT;   // de desplazamiento del montaje a desplazamiento del lienzo; proporción del montaje
      // Ondas que fluyen: la estela se mueve como un líquido y no como un corte
      vec2 ola(vec2 p, float t){ return vec2(sin(p.y * 22. + t * 3.1 + sin(p.x * 13. - t * 1.7) * 1.6), sin(p.x * 19. - t * 2.6 + sin(p.y * 15. + t * 2.2) * 1.6)); }
      vec4 logo(vec2 q){ vec2 t = (q - uIn.xy) / uIn.zw; return (t.x < 0. || t.y < 0. || t.x > 1. || t.y > 1.) ? vec4(0.) : texture2D(uLogo, t); }
      void main(){
        vec2 u = vec2(v.x, 1. - v.y);
        vec2 ue = uMap.xy + u * uMap.zw, px = vec2(3.4 / 320., 3.4 / 180.);
        vec4 e = vec4(0.);
        for (int j = -1; j <= 1; j++) for (int i = -1; i <= 1; i++) e += texture2D(uEstela, ue + vec2(float(i), float(j)) * px);
        e /= 9.;
        float k = smoothstep(.02, .7, e.r); k = k * k * (3. - 2. * k);
        vec2 dir = (e.gb - .5) * 2.;
        dir = length(dir) > .02 ? normalize(dir) : vec2(1., 0.);
        vec2 atras = (-dir * uAsp * .096 * k * k + ola(ue / uAsp, uT) * uAsp * .016 * k) * uConv;
        // Una sola muestra: el logo se deforma como agua, sin copias repetidas (efecto acordeón)
        vec2 o = atras * .86;
        vec4 a = logo(u + o * 1.015), b = logo(u + o), c = logo(u + o * .985);
        gl_FragColor = vec4(a.r, b.g, c.b, max(a.a, max(b.a, c.a)));
      }`;
    const pr = programa(lg, FRAG_M);
    if (!pr) { cv.remove(); return null; }
    lg.useProgram(pr);
    cv.addEventListener('webglcontextlost', (e) => { e.preventDefault(); marcaLuz.classList.remove('deformando'); cv.remove(); marca = null; }, false);
    const bf = lg.createBuffer();
    lg.bindBuffer(lg.ARRAY_BUFFER, bf);
    lg.bufferData(lg.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), lg.STATIC_DRAW);
    const lc = lg.getAttribLocation(pr, 'p');
    lg.enableVertexAttribArray(lc); lg.vertexAttribPointer(lc, 2, lg.FLOAT, false, 0, 0);
    const u = {};
    ['uLogo', 'uEstela', 'uIn', 'uMap', 'uConv', 'uAsp', 'uT'].forEach((n) => { u[n] = lg.getUniformLocation(pr, n); });
    lg.uniform1i(u.uLogo, 0); lg.uniform1i(u.uEstela, 1);
    lg.pixelStorei(lg.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
    const nueva = () => {
      const t = lg.createTexture();
      lg.bindTexture(lg.TEXTURE_2D, t);
      lg.texParameteri(lg.TEXTURE_2D, lg.TEXTURE_MIN_FILTER, lg.LINEAR);
      lg.texParameteri(lg.TEXTURE_2D, lg.TEXTURE_MAG_FILTER, lg.LINEAR);
      lg.texParameteri(lg.TEXTURE_2D, lg.TEXTURE_WRAP_S, lg.CLAMP_TO_EDGE);
      lg.texParameteri(lg.TEXTURE_2D, lg.TEXTURE_WRAP_T, lg.CLAMP_TO_EDGE);
      return t;
    };
    const tLogo = nueva(), tEstela = nueva();
    let listo = false, ancho = 0;
    // El logo se rasteriza a la resolución de la pantalla cada vez que cambia su tamaño
    const rasterizar = () => {
      const r = marcaImg.getBoundingClientRect();
      if (!r.width || !marcaImg.complete) return false;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      if (Math.round(r.width * dpr) === ancho) return true;
      ancho = Math.round(r.width * dpr);
      const c = document.createElement('canvas');
      c.width = ancho; c.height = Math.round(r.height * dpr);
      c.getContext('2d').drawImage(marcaImg, 0, 0, c.width, c.height);
      lg.activeTexture(lg.TEXTURE0); lg.bindTexture(lg.TEXTURE_2D, tLogo);
      lg.texImage2D(lg.TEXTURE_2D, 0, lg.RGBA, lg.RGBA, lg.UNSIGNED_BYTE, c);
      return true;
    };
    return {
      dibujar(montaje, t) {
        if (!rasterizar()) return;
        const r = marcaImg.getBoundingClientRect(), dpr = Math.min(window.devicePixelRatio || 1, 2);
        // Margen alrededor del logo para que el estiramiento no se corte
        const pad = Math.round(Math.max(r.width, r.height) * 0.45);
        const w = r.width + pad * 2, h = r.height + pad * 2;
        if (cv.width !== Math.round(w * dpr)) { cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr); }
        cv.style.cssText = `left:${-pad}px;top:${-pad}px;width:${w}px;height:${h}px`;
        lg.viewport(0, 0, cv.width, cv.height);
        const cr = { x: r.left - pad, y: r.top - pad, w, h };
        const m = montaje.getBoundingClientRect();
        lg.uniform4f(u.uIn, pad / w, pad / h, r.width / w, r.height / h);
        lg.uniform4f(u.uMap, (cr.x - m.left) / m.width, (cr.y - m.top) / m.height, w / m.width, h / m.height);
        lg.uniform2f(u.uConv, m.width / w, m.height / h);
        lg.uniform2f(u.uAsp, m.height / m.width, 1);
        lg.uniform1f(u.uT, t);
        lg.activeTexture(lg.TEXTURE0); lg.bindTexture(lg.TEXTURE_2D, tLogo);
        lg.activeTexture(lg.TEXTURE1); lg.bindTexture(lg.TEXTURE_2D, tEstela);
        lg.pixelStorei(lg.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
        lg.texImage2D(lg.TEXTURE_2D, 0, lg.RGB, lg.RGB, lg.UNSIGNED_BYTE, estela);
        lg.pixelStorei(lg.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
        lg.clearColor(0, 0, 0, 0); lg.clear(lg.COLOR_BUFFER_BIT);
        lg.drawArrays(lg.TRIANGLE_STRIP, 0, 4);
        if (!listo) { listo = true; }
        marcaLuz.classList.add('deformando');
      },
      soltar() { marcaLuz.classList.remove('deformando'); },
    };
  };

  let raf = 0, visible = true;
  const cuadro = (ahora) => {
    raf = 0;
    if (!visible || document.hidden) return;
    if (!t0) { t0 = ahora; sostenDesde = ahora; latirYa(); }
    // Ritmo: F-L · F-F-L · F-L-L · y vuelve a empezar
    if (ahora >= proximoCorte) {
      cortar(ahora);
      const tipo = FRASES[frase][paso], l = LATIDO[tipo];
      fuerzaCorte = l.fuerza; duraCorte = l.dura;
      if (paso === 0) sostenDesde = ahora;
      const finFrase = paso === FRASES[frase].length - 1;
      duraImagen = (finFrase ? LATIDO.pausa : l.luego) * (1 + Math.random() * 0.1);   // nunca menos de 2 s
      proximoCorte = ahora + duraImagen;
      if (finFrase) { paso = 0; frase = (frase + 1) % FRASES.length; } else paso++;
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
