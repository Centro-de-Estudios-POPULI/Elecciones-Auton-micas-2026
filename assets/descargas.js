/* Descargas de los tableros electorales de POPULI: CSV de cada tabla y PNG de cada gráfico.
   Un solo archivo para todos los tableros (el navegador lo guarda tras la primera visita).
   Se equipa solo: cuando cambia el contenido de la página busca tablas y gráficos SVG y les pone
   sus botones. El PNG sale de tamaño fijo, 2160 px de ancho, con título, leyenda (la que el mapa
   describe en data-spec), fuente a la izquierda y la firma oficial a la derecha. */
(function () {
  'use strict';
  var FUENTE = 'Fuente: Tribunal Supremo Electoral, cómputo oficial 2026 · Elaboración: Centro de Estudios POPULI';
  var CONT = '.card,.map-svg-outer,.map-svg-container,.scatter-outer,.flujo-card,.hemi-wrap';
  var ANCHO = 2160, MARGEN = 96, K = ANCHO / 800;   // tipografía de una lámina de 800 px lógicos
  var PROPS = ['fill', 'fill-opacity', 'stroke', 'stroke-width', 'stroke-opacity', 'stroke-dasharray', 'stroke-linejoin',
    'stroke-linecap', 'opacity', 'font-family', 'font-size', 'font-weight', 'font-style', 'text-anchor',
    'dominant-baseline', 'letter-spacing', 'visibility', 'display'];

  var css = document.createElement('style');
  css.textContent = '.dl-btns{position:absolute;top:8px;right:8px;display:flex;gap:4px;z-index:6}'
    + '.dl-barra{display:flex;justify-content:flex-end;gap:4px;margin:0 0 6px}'
    + '.dl-btn{font:600 10px/1 "JetBrains Mono",ui-monospace,monospace;letter-spacing:.04em;padding:5px 7px;'
    + 'border:1px solid #D3CCBF;background:rgba(255,255,255,.94);color:#5C6B70;cursor:pointer;border-radius:0}'
    + '.dl-btn:hover{border-color:#001219;color:#001219}'
    + '@media print{.dl-btns,.dl-barra{display:none}}';
  document.head.appendChild(css);

  function slug(t) {
    return (t || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
      .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 70);
  }
  function pagina() { return slug(document.title.replace(/—\s*POPULI\s*$/, '')) || 'populi'; }
  function nombre(titulo) { return pagina() + (titulo ? '-' + slug(titulo) : ''); }

  // título de un bloque: su h3/h4, o el título de sección más cercano hacia arriba
  function tituloDe(el) {
    var c = el.closest(CONT) || el;
    var h = c.querySelector('h3,h4');
    if (h && h.textContent.trim()) return h.textContent.trim();
    var n = c;
    while (n && n !== document.body && !(n.classList && n.classList.contains('panel'))) {
      var p = n.previousElementSibling;
      while (p) {
        if (p.classList && p.classList.contains('sec-title')) return p.textContent.trim();
        var s = p.querySelectorAll ? p.querySelectorAll('.sec-title') : [];
        if (s.length) return s[s.length - 1].textContent.trim();
        p = p.previousElementSibling;
      }
      n = n.parentElement;
    }
    return '';
  }
  function bajar(blob, archivo) {
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = archivo;
    document.body.appendChild(a);
    a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 500);
  }

  // ── CSV: lo que se ve en la tabla, con punto y coma (Excel en español) ──
  function csv(tabla, archivo) {
    var filas = [].map.call(tabla.querySelectorAll('tr'), function (tr) {
      return [].map.call(tr.querySelectorAll('th,td'), function (c) {
        var t = c.textContent.replace(/\s+/g, ' ').trim();
        return /[;"\n]/.test(t) ? '"' + t.replace(/"/g, '""') + '"' : t;
      }).join(';');
    });
    bajar(new Blob(['﻿' + filas.join('\r\n')], { type: 'text/csv;charset=utf-8' }), archivo + '.csv');
  }

  // ── PNG ──
  // Copia los estilos calculados a la copia del SVG (la imagen no ve la hoja de estilos de la página).
  // Los trazos «non-scaling-stroke» se pasan a unidades del dibujo para que conserven su grosor.
  function estilos(orig, copia, factor) {
    var cs = getComputedStyle(orig), s = '';
    PROPS.forEach(function (p) { var v = cs.getPropertyValue(p); if (v) s += p + ':' + v + ';'; });
    if (cs.getPropertyValue('vector-effect') === 'non-scaling-stroke') {
      s += 'stroke-width:' + ((parseFloat(cs.getPropertyValue('stroke-width')) || 1) * factor).toFixed(2) + 'px;';
    }
    copia.setAttribute('style', s);
    copia.removeAttribute('class');
    var a = orig.children, b = copia.children;
    for (var i = 0; i < a.length; i++) if (b[i]) estilos(a[i], b[i], factor);
  }

  // la firma de las imágenes del Banco de Gráficos (populi-marca/monitor/monitor.js)
  function firma(c, xDer, yBase, h) {
    var s = h / 64, tP = '400 ' + (64 * s) + 'px "Playfair Display", Georgia, serif',
      tR = 'italic 400 ' + (40 * s) + 'px "Playfair Display", Georgia, serif';
    c.textAlign = 'left'; c.textBaseline = 'alphabetic';
    c.font = tP; var wP = c.measureText('P').width;
    c.font = tR; var wR = c.measureText('opuli').width;
    var ancho = wP + wR + 8 * s, x = xDer - ancho;
    c.font = tP; c.fillStyle = '#C71E1D'; c.fillText('P', x, yBase);
    c.font = tR; c.fillStyle = '#001219'; c.fillText('opuli', x + wP - 5 * s, yBase);
    var arriba = yBase - 64 * s, grueso = Math.max(2, 2.4 * s * 64 / 52);
    c.fillStyle = '#C71E1D'; c.fillRect(x, arriba - 7 * h / 52 - grueso, xDer - x, grueso);
    return ancho;
  }

  // leyenda: [{t:'c',col,txt}] cuadro de color · [{t:'g',txt}] rótulo · [{t:'r',u,txt}] círculo (u en unidades del mapa)
  function leyenda(x, L, x0, y0, ancho, escalaU, medir) {
    var fs = 8.6 * K, lin = 16 * K, gap = 5 * K, sep = 13 * K, yy = y0;
    x.textBaseline = 'middle'; x.textAlign = 'left';
    if (L.titulo) {
      x.font = '700 ' + fs + 'px Inter, system-ui, sans-serif';
      var linea = '';
      L.titulo.split(' ').forEach(function (p) {
        var prueba = linea ? linea + ' ' + p : p;
        if (x.measureText(prueba).width > ancho && linea) {
          if (!medir) { x.fillStyle = '#5C6B70'; x.fillText(linea, x0, yy + lin / 2); }
          yy += lin; linea = p;
        } else linea = prueba;
      });
      if (linea) { if (!medir) { x.fillStyle = '#5C6B70'; x.fillText(linea, x0, yy + lin / 2); } yy += lin; }
      yy += 3 * K;
    }
    // primera pasada: medir y repartir en filas
    var filas = [], fila = { items: [], alto: lin }, xx = x0;
    (L.items || []).forEach(function (it) {
      x.font = (it.t === 'g' ? '700 ' : '400 ') + fs + 'px Inter, system-ui, sans-serif';
      var d = it.t === 'r' ? Math.max(6 * K, (it.u || 0) * escalaU) : it.t === 'c' ? 10 * K : 0;
      var w = (d ? d + gap : 0) + x.measureText(it.txt).width;
      if (xx > x0 && xx + w > x0 + ancho) { filas.push(fila); fila = { items: [], alto: lin }; xx = x0; }
      fila.items.push({ it: it, d: d, x: xx });
      fila.alto = Math.max(fila.alto, d + 4 * K);
      xx += w + sep;
    });
    if (fila.items.length) filas.push(fila);
    // segunda pasada: dibujar, centrado en la altura de su fila
    filas.forEach(function (f) {
      var cy = yy + f.alto / 2;
      if (!medir) f.items.forEach(function (e) {
        var it = e.it, d = e.d;
        x.font = (it.t === 'g' ? '700 ' : '400 ') + fs + 'px Inter, system-ui, sans-serif';
        if (it.t === 'c') { x.fillStyle = it.col; x.fillRect(e.x, cy - d / 2, d, d); }
        if (it.t === 'r') {
          x.beginPath(); x.arc(e.x + d / 2, cy, d / 2, 0, 2 * Math.PI);
          x.fillStyle = '#FFFFFF'; x.fill(); x.lineWidth = 1.5 * K; x.strokeStyle = '#8A9699'; x.stroke();
        }
        x.fillStyle = it.t === 'g' ? '#001219' : '#33393B';
        x.fillText(it.txt, e.x + (d ? d + gap : 0), cy);
      });
      yy += f.alto + 2 * K;
    });
    return (yy - y0) + 8 * K;
  }

  function fuentes() {
    if (!document.fonts || !document.fonts.load) return Promise.resolve();
    return Promise.all(['400 40px "Playfair Display"', 'italic 400 40px "Playfair Display"', '600 40px "Playfair Display"',
      '400 20px Inter', '700 20px Inter'].map(function (f) { return document.fonts.load(f).catch(function () {}); }));
  }

  function png(svg, titulo, L, archivo, nota) {
    var vb = svg.viewBox && svg.viewBox.baseVal;
    var cw = svg.clientWidth || svg.getBoundingClientRect().width || 800;
    var vw = vb && vb.width ? vb.width : cw, vh = vb && vb.height ? vb.height : (svg.clientHeight || cw * 0.7);
    var copia = svg.cloneNode(true);
    estilos(svg, copia, Math.max(vw / cw, vh / (svg.clientHeight || vh)));
    var iw = ANCHO - 2 * MARGEN, ih = Math.round(iw * vh / vw);
    copia.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
    copia.setAttribute('width', iw);
    copia.setAttribute('height', ih);
    if (vb && vb.width) copia.setAttribute('viewBox', vb.x + ' ' + vb.y + ' ' + vb.width + ' ' + vb.height);
    var img = new Image();
    img.onload = function () {
      fuentes().then(function () {
        var c = document.createElement('canvas'), x = c.getContext('2d');
        x.font = '600 ' + (19 * K) + 'px "Playfair Display", Georgia, serif';
        // el título se parte en renglones si no entra en el ancho
        var lineasTit = [], lt = '';
        (titulo || '').split(' ').forEach(function (p) { var pr = lt ? lt + ' ' + p : p; if (x.measureText(pr).width > iw && lt) { lineasTit.push(lt); lt = p; } else lt = pr; });
        if (lt) lineasTit.push(lt);
        var altoTit = lineasTit.length ? lineasTit.length * 26 * K + 8 * K : 0, lineasNota = [];
        if (nota) {
          x.font = '400 ' + (10 * K) + 'px Inter, system-ui, sans-serif';
          var ln = '';
          nota.split(' ').forEach(function (p) { var pr = ln ? ln + ' ' + p : p; if (x.measureText(pr).width > iw && ln) { lineasNota.push(ln); ln = p; } else ln = pr; });
          if (ln) lineasNota.push(ln);
        }
        var altoNota = lineasNota.length ? lineasNota.length * 15 * K + 6 * K : 0;
        var altoLey = L ? leyenda(x, L, MARGEN, 0, iw, iw / vw, true) : 0;
        var pie = 52 * K;
        c.width = ANCHO;
        c.height = Math.round(MARGEN * 0.8 + altoTit + altoNota + altoLey + ih + pie + MARGEN * 0.4);
        x.fillStyle = '#FFFFFF'; x.fillRect(0, 0, c.width, c.height);
        var y = MARGEN * 0.8;
        if (lineasTit.length) {
          x.fillStyle = '#001219'; x.textBaseline = 'top'; x.textAlign = 'left';
          x.font = '600 ' + (19 * K) + 'px "Playfair Display", Georgia, serif';
          lineasTit.forEach(function (l, k) { x.fillText(l, MARGEN, y + k * 26 * K); });
          y += altoTit;
        }
        if (lineasNota.length) {
          x.fillStyle = '#33393B'; x.textBaseline = 'top';
          x.font = '400 ' + (10 * K) + 'px Inter, system-ui, sans-serif';
          lineasNota.forEach(function (l) { x.fillText(l, MARGEN, y); y += 15 * K; });
          y += 6 * K;
        }
        if (L) { leyenda(x, L, MARGEN, y, iw, iw / vw, false); y += altoLey; }
        x.drawImage(img, MARGEN, y, iw, ih);
        y += ih + 34 * K;
        x.fillStyle = '#5C6B70'; x.textBaseline = 'alphabetic'; x.textAlign = 'left';
        x.font = '400 ' + (8.4 * K) + 'px Inter, system-ui, sans-serif';
        x.fillText(FUENTE, MARGEN, y);
        firma(x, ANCHO - MARGEN, y + 2 * K, 17 * K);
        c.toBlob(function (b) { if (b) bajar(b, archivo + '.png'); }, 'image/png');
      });
    };
    img.onerror = function () { console.warn('[descargas] no se pudo dibujar el gráfico'); };
    img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(new XMLSerializer().serializeToString(copia));
  }

  // el SVG principal de un bloque: el más grande (no los iconos ni las barritas de las tablas)
  function svgDe(c) {
    var mejor = null, area = 0;
    c.querySelectorAll('svg').forEach(function (s) {
      if (s.closest('.dl-btns,.dl-barra,button,.tab')) return;
      var a = (s.clientWidth || 0) * (s.clientHeight || 0);
      if (a > area) { area = a; mejor = s; }
    });
    return mejor;
  }
  function specDe(c) {
    var el = c.querySelector('[data-spec]');
    if (!el) return null;
    try { return JSON.parse(el.getAttribute('data-spec')); } catch (e) { return null; }
  }

  function boton(c, tipo, fn) {
    var g = c.querySelector(':scope > .dl-btns');
    if (!g) {
      if (getComputedStyle(c).position === 'static') c.style.position = 'relative';
      g = document.createElement('div');
      g.className = 'dl-btns';
      c.appendChild(g);
    }
    if (g.querySelector('[data-tipo="' + tipo + '"]')) return;
    var b = document.createElement('button');
    b.type = 'button'; b.className = 'dl-btn'; b.dataset.tipo = tipo; b.textContent = tipo;
    b.title = tipo === 'CSV' ? 'Descargar la tabla (CSV)' : 'Descargar el gráfico (PNG)';
    b.addEventListener('click', fn);
    if (tipo === 'CSV') g.insertBefore(b, g.firstChild); else g.appendChild(b);
  }
  function barra(w, fn) {
    var p = w.previousElementSibling;
    if (p && p.classList.contains('dl-barra')) return;
    var d = document.createElement('div');
    d.className = 'dl-barra';
    var b = document.createElement('button');
    b.type = 'button'; b.className = 'dl-btn'; b.textContent = 'CSV'; b.title = 'Descargar la tabla (CSV)';
    b.addEventListener('click', fn);
    d.appendChild(b);
    w.parentNode.insertBefore(d, w);
  }

  function equipar(raiz) {
    (raiz || document).querySelectorAll('table').forEach(function (t) {
      if (t.closest('.dl-ignorar') || !t.querySelector('tr')) return;
      var c = t.closest(CONT);
      if (c) boton(c, 'CSV', function () { csv(c.querySelector('table'), nombre(tituloDe(c))); });
      else {
        var w = t.closest('.table-wrap,.scroll-box,.dhondt-wrap') || t;
        barra(w, function () { csv(t, nombre(tituloDe(w))); });
      }
    });
    (raiz || document).querySelectorAll('svg').forEach(function (s) {
      if (s.closest('.dl-ignorar,.tab,button,.dl-btns,.sm-grid,table')) return;
      if ((s.clientWidth || 0) < 240) return;
      var c = s.closest(CONT) || s.parentElement;
      boton(c, 'PNG', function () {
        var sv = svgDe(c);
        if (!sv) return;
        var L = specDe(c), t = c.dataset.titulo || tituloDe(c) || (L && L.titulo) || document.title;
        if (L && L.titulo === t) L = { titulo: '', items: L.items };
        png(sv, t, L, nombre(t), c.dataset.nota || '');
      });
    });
  }

  var pendiente = null;
  function programar() {
    if (pendiente) return;
    pendiente = setTimeout(function () { pendiente = null; equipar(document); }, 250);
  }
  function iniciar() {
    equipar(document);
    new MutationObserver(programar).observe(document.body, { childList: true, subtree: true });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', iniciar); else iniciar();
  window.POPULI_DESC = { equipar: equipar, csv: csv, png: png };
})();
