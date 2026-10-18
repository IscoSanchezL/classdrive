/* Class Drive · idiomas (español / inglés)
 *
 * - Idioma guardado en localStorage 'labs-lang' ('es' | 'en'). Por defecto: el del navegador
 *   (si empieza por 'en' → inglés; si no → español).
 * - t(clave, vars): la clave es el texto en español de origen; admite {x} y {0}, {1}...
 *   En español devuelve el texto tal cual; en inglés busca la traducción en I18N.add({...}).
 * - La interfaz se traduce sola: el texto de la página (también el que se genera dinámicamente)
 *   se sustituye por su traducción al cambiar de idioma, sin recargar, y se restaura al volver a español.
 * - alert / confirm / prompt se traducen con la misma tabla.
 * - Selector ES | EN: cualquier elemento con la clase "lang-slot" recibe los botones.
 */
(function () {
  'use strict';
  var KEY = 'labs-lang';
  var EN = Object.create(null);   // frase exacta (normalizada) → inglés
  var PATS = [];                  // frases con huecos {0},{1}… → expresión regular
  var cbs = [];
  var L = 'es';

  var MONTHS = { Enero: 'January', Febrero: 'February', Marzo: 'March', Abril: 'April', Mayo: 'May', Junio: 'June', Julio: 'July', Agosto: 'August', Septiembre: 'September', Octubre: 'October', Noviembre: 'November', Diciembre: 'December' };
  var DAYS = { Lunes: 'Monday', Martes: 'Tuesday', 'Miércoles': 'Wednesday', Jueves: 'Thursday', Viernes: 'Friday', 'Sábado': 'Saturday', Domingo: 'Sunday' };
  var SDAYS = { Lun: 'Mon', Mar: 'Tue', 'Mié': 'Wed', Jue: 'Thu', Vie: 'Fri', 'Sáb': 'Sat', Dom: 'Sun' };
  var GRADES = { Primero: 'First', Segundo: 'Second', Tercero: 'Third', Cuarto: 'Fourth', Quinto: 'Fifth', Sexto: 'Sixth', PRIMERO: 'FIRST', SEGUNDO: 'SECOND', TERCERO: 'THIRD', CUARTO: 'FOURTH', QUINTO: 'FIFTH', SEXTO: 'SIXTH' };
  var TOKENS = [];
  [MONTHS, DAYS, SDAYS, GRADES].forEach(function (m) {
    Object.keys(m).forEach(function (k) { TOKENS.push([new RegExp('(^|[^A-Za-zÁÉÍÓÚáéíóúñÑ])' + k + '(?![A-Za-zÁÉÍÓÚáéíóúñÑ])', 'g'), m[k]]); });
  });

  function read() { try { return localStorage.getItem(KEY); } catch (e) { return null; } }
  function detect() {
    var s = read();
    if (s === 'es' || s === 'en') return s;
    return String(navigator.language || 'es').toLowerCase().indexOf('en') === 0 ? 'en' : 'es';
  }
  L = detect();

  function norm(s) { return String(s).replace(/\s+/g, ' ').trim(); }
  function esc(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }
  function fmt(s, v) {
    if (v) for (var k in v) if (Object.prototype.hasOwnProperty.call(v, k)) s = s.split('{' + k + '}').join(String(v[k]));
    return s;
  }

  function add(map) {
    Object.keys(map).forEach(function (k) {
      var nk = norm(k);
      EN[nk] = map[k];
      if (/\{\d+\}/.test(nk)) {
        var idx = [];
        var src = nk.split(/(\{\d+\})/).map(function (p) {
          var m = /^\{(\d+)\}$/.exec(p);
          if (m) { idx.push(+m[1]); return '(.*?)'; }
          return esc(p);
        }).join('');
        PATS.push({ re: new RegExp('^' + src + '$'), idx: idx, en: map[k], len: nk.length });
      }
    });
    PATS.sort(function (a, b) { return b.len - a.len; });
  }

  function capt(v) { return v.length <= 40 && (v in EN) ? EN[v] : v; }
  function exact(n) {
    if (n in EN) return EN[n];
    for (var i = 0; i < PATS.length; i++) {
      var m = PATS[i].re.exec(n);
      if (m) {
        var out = PATS[i].en;
        for (var j = 0; j < PATS[i].idx.length; j++) out = out.split('{' + PATS[i].idx[j] + '}').join(capt(m[j + 1]));
        return out;
      }
    }
    return null;
  }
  var LEAD = /^[^\p{L}\p{N}{¿¡"'(]+/u, TRAIL = /[^\p{L}\p{N}}.!?…:)"'»]+$/u;

  // Devuelve la traducción de un texto ya compuesto, o null si no la hay.
  function lookup(text) {
    var n = norm(text);
    if (!n) return null;
    var r = exact(n);
    if (r !== null) return r;
    // sin emojis / símbolos al principio o al final
    var lead = (LEAD.exec(n) || [''])[0], rest = n.slice(lead.length);
    var trail = (TRAIL.exec(rest) || [''])[0], core = rest.slice(0, rest.length - trail.length);
    if ((lead || trail) && core) {
      r = exact(core);
      if (r !== null) return lead + r + trail;
    }
    var changed = n;
    for (var t = 0; t < TOKENS.length; t++) changed = changed.replace(TOKENS[t][0], function (_, p) { return p + TOKENS[t][1]; });
    return changed !== n ? changed : null;
  }

  function t(key, vars) {
    var s = key;
    if (L === 'en') { var e = lookup(fmt(key, null)); if (e !== null) s = e; }
    return fmt(s, vars);
  }

  /* ── Traducción del DOM ── */
  var SKIP = { SCRIPT: 1, STYLE: 1, TEXTAREA: 1, NOSCRIPT: 1, CODE: 1, PRE: 1, IFRAME: 1, CANVAS: 1, SVG: 1 };
  var ATTRS = ['placeholder', 'title', 'alt', 'aria-label'];
  function skipAttrEl(el) {
    for (var e = el; e && e.nodeType === 1; e = e.parentNode) {
      if (e.hasAttribute && (e.hasAttribute('data-no-i18n') || e.getAttribute('contenteditable') === 'true')) return true;
    }
    return false;
  }
  function skipEl(el) {
    for (var e = el; e && e.nodeType === 1; e = e.parentNode) {
      if (SKIP[e.nodeName] || (e.hasAttribute && (e.hasAttribute('data-no-i18n') || e.getAttribute('contenteditable') === 'true'))) return true;
    }
    return false;
  }

  function doText(n) {
    var cur = n.nodeValue;
    if (L === 'en') {
      if (n.__en !== undefined && cur === n.__en) return;               // ya traducido por nosotros
      if (!/[A-Za-zÁÉÍÓÚáéíóúñÑ]/.test(cur)) return;
      var tr = lookup(cur);
      if (tr === null) { n.__es = undefined; n.__en = undefined; return; }
      var lead = /^\s*/.exec(cur)[0], trail = /\s*$/.exec(cur)[0];
      n.__es = cur; n.__en = lead + tr + trail;
      n.nodeValue = n.__en;
    } else if (n.__es !== undefined && cur === n.__en) {
      n.nodeValue = n.__es; n.__es = undefined; n.__en = undefined;
    }
  }
  function doAttr(el, a) {
    var cur = el.getAttribute(a);
    if (cur === null) return;
    var st = el.__i18n || (el.__i18n = {});
    var rec = st[a];
    if (L === 'en') {
      if (rec && cur === rec.en) return;
      var tr = lookup(cur);
      if (tr === null) { delete st[a]; return; }
      st[a] = { es: cur, en: tr };
      el.setAttribute(a, tr);
    } else if (rec && cur === rec.en) {
      el.setAttribute(a, rec.es); delete st[a];
    }
  }
  function doEl(el) {
    for (var i = 0; i < ATTRS.length; i++) if (el.hasAttribute(ATTRS[i])) doAttr(el, ATTRS[i]);
    if (el.nodeName === 'INPUT' && (el.type === 'button' || el.type === 'submit') && el.hasAttribute('value')) doAttr(el, 'value');
  }
  function walk(root) {
    if (!root) return;
    if (root.nodeType === 3) { if (root.parentNode && !skipEl(root.parentNode)) doText(root); return; }
    if (root.nodeType !== 1) return;
    if (!skipAttrEl(root)) doEl(root);
    var w = document.createTreeWalker(root, 1 | 4, null);
    var n;
    while ((n = w.nextNode())) {
      if (n.nodeType === 3) { if (!skipEl(n.parentNode)) doText(n); }
      else if (!skipAttrEl(n)) doEl(n);
    }
  }

  var obs = null, queue = [], raf = 0;
  function flush() {
    raf = 0;
    var q = queue; queue = [];
    if (obs) obs.disconnect();
    for (var i = 0; i < q.length; i++) {
      var m = q[i];
      if (m.type === 'characterData') walk(m.target);
      else if (m.type === 'attributes') { if (!skipAttrEl(m.target)) doAttr(m.target, m.attributeName); }
      else for (var j = 0; j < m.addedNodes.length; j++) walk(m.addedNodes[j]);
    }
    connect();
  }
  function connect() {
    if (!obs || !document.documentElement) return;
    obs.observe(document.documentElement, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ATTRS });
  }
  function startObserver() {
    if (obs) return;
    obs = new MutationObserver(function (ms) {
      if (L !== 'en') return;
      for (var i = 0; i < ms.length; i++) queue.push(ms[i]);
      if (!raf) raf = requestAnimationFrame(flush);
    });
    connect();
  }

  function apply() {
    document.documentElement.lang = L;
    var meta = document.querySelector('meta[name="description"]');
    if (meta) {
      if (meta.__es === undefined) meta.__es = meta.getAttribute('content') || '';
      if (meta.__es) { var d = L === 'en' ? lookup(meta.__es) : null; meta.setAttribute('content', d !== null ? d : meta.__es); }
    }
    var tt = document.querySelector('title');
    if (tt) {
      if (tt.__es === undefined) tt.__es = tt.textContent;
      var x = L === 'en' ? lookup(tt.__es) : null; tt.textContent = x !== null ? x : tt.__es;
    }
    if (obs) obs.disconnect();
    walk(document.body);
    connect();
    var btns = document.querySelectorAll('.lang button');
    for (var i = 0; i < btns.length; i++) btns[i].setAttribute('aria-pressed', String(btns[i].getAttribute('data-l') === L));
    cbs.forEach(function (f) { try { f(L); } catch (e) { console.error(e); } });
  }

  function set(l) {
    if (l !== 'es' && l !== 'en') return;
    L = l;
    try { localStorage.setItem(KEY, l); } catch (e) { /* sin almacenamiento */ }
    apply();
  }

  function mountSelectors() {
    var slots = document.querySelectorAll('.lang-slot');
    for (var i = 0; i < slots.length; i++) {
      var c = slots[i];
      if (c.firstChild) continue;
      c.classList.add('lang');
      c.setAttribute('role', 'group');
      c.setAttribute('aria-label', 'Idioma / Language');
      [['es', 'ES'], ['en', 'EN']].forEach(function (p) {
        var b = document.createElement('button');
        b.type = 'button'; b.setAttribute('data-l', p[0]); b.textContent = p[1];
        b.setAttribute('data-no-i18n', '');
        b.addEventListener('click', function (ev) { ev.stopPropagation(); set(p[0]); });
        c.appendChild(b);
      });
    }
  }

  function injectStyle() {
    var s = document.createElement('style');
    s.textContent = '.lang{display:inline-flex;align-items:center;border:1px solid var(--brh,rgba(128,128,128,.4));border-radius:8px;overflow:hidden;flex:none}' +
      '.lang button{background:transparent;color:var(--ts,#7a8fae);border:0;padding:4px 9px;font:700 11px/1.2 inherit;font-family:inherit;letter-spacing:.04em;cursor:pointer}' +
      '.lang button+button{border-left:1px solid var(--brh,rgba(128,128,128,.4))}' +
      '.lang button:hover{color:var(--tp,#e8eef8)}' +
      '.lang button[aria-pressed="true"]{background:var(--ac,#6366f1);color:#fff}';
    document.head.appendChild(s);
  }

  // alert / confirm / prompt
  ['alert', 'confirm', 'prompt'].forEach(function (name) {
    var orig = window[name];
    if (typeof orig !== 'function') return;
    window[name] = function (msg) {
      var a = Array.prototype.slice.call(arguments);
      if (L === 'en' && a.length) { a[0] = trMulti(a[0]); if (name === 'prompt' && a.length > 1 && typeof a[1] === 'string') a[1] = trMulti(a[1]); }
      return orig.apply(window, a);
    };
  });
  // Traduce cada línea por separado si el mensaje completo no está en la tabla.
  function trMulti(msg) {
    var s = String(msg);
    var whole = lookup(s);
    if (whole !== null) return whole;
    return s.split('\n').map(function (ln) { var x = lookup(ln); return x !== null ? x : ln; }).join('\n');
  }

  window.I18N = {
    t: t, add: add, set: set, lang: function () { return L; },
    locale: function () { return L === 'en' ? 'en-US' : 'es-CO'; },
    onChange: function (f) { cbs.push(f); },
    translate: function (s) { var x = L === 'en' ? lookup(s) : null; return x !== null ? x : s; },
    refresh: apply
  };
  window.t = window.t || t;

  function init() {
    injectStyle();
    mountSelectors();
    startObserver();
    apply();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
