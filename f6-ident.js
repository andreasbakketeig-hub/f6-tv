/* F6 TV – ident og kanalskift.  Ingen lyd. Ingen nettverk utenom kanalbildet. Bare transform og opacity animeres.

   f6Intro(kanalId, navn, lang, valg)      -> Promise. Løses når åpningen mot videoen starter. (.ferdig = alt er borte)
   f6Kanalskift(fraId, tilId, navn, valg)  -> Promise. Løses når dekket er borte. (.dekket = skjermen er helt dekket, bytt video nå)

   valg:
     bilde      intro: URL til kanalens bilde           (standard: f6Ident.bildeSti med {id} byttet ut)
     fraBilde   kanalskift: URL til bildet vi forlater
     tilBilde   kanalskift: URL til bildet vi går til
     variant    'rolig' (standard) eller 'ident' (3D-vending og lysstripe)
     rot        element som identen legges i (standard document.body)
     lang       'no' eller 'en' (brukes bare når navn mangler)
     onDekket   kanalskift: funksjon som kalles når skjermen er dekket */
(function (global) {
  'use strict';

  var MERKE = 'M63.6 325.3L317.75 0L534.75 0L365.1 217.15A300 300 0 1 1 63.6 325.3ZM420 510A120 120 0 1 0 180 510A120 120 0 1 0 420 510ZM339.53 33.03L415.18 92.13L391.54 122.39L346.15 86.93L320.14 120.22L342.84 137.95L319.2 168.21L296.5 150.48L266.95 188.3L236.69 164.66Z';
  var REKKEFOLGE = ["dj", "mat", "natur", "rommet", "studio", "bbq", "komedie", "verden", "kos", "konserter", "dokumentar", "favoritter"];
  var NAVN = {
    no: { dj: 'DJ', mat: 'Mat', natur: 'Natur', rommet: 'Rommet', studio: 'Studio', bbq: 'BBQ', komedie: 'Komedie', verden: 'Verden', kos: 'Kos', konserter: 'Konserter', dokumentar: 'Dokumentar', favoritter: 'Favoritter' },
    en: { dj: 'DJ', mat: 'Food', natur: 'Nature', rommet: 'Space', studio: 'Studio', bbq: 'BBQ', komedie: 'Comedy', verden: 'World', kos: 'Cozy', konserter: 'Concerts', dokumentar: 'Docs', favoritter: 'Favourites' }
  };
  /* Kanalens farger. Brukes som bakgrunn til bildet er lastet, og hvis bildet mangler. */
  var KANAL = {
    dj: { lys: '#FF5CD6', dyp: '#7A3DFF', bunn: '#190A2E' },
    mat: { lys: '#FFA06B', dyp: '#F0403A', bunn: '#2A0D0B' },
    natur: { lys: '#8CF5B8', dyp: '#0F9E6A', bunn: '#05231B' },
    rommet: { lys: '#A9BBFF', dyp: '#4A46E0', bunn: '#090C2B' },
    studio: { lys: '#7BF6F0', dyp: '#0E9DC6', bunn: '#04212B' },
    bbq: { lys: '#FFC93D', dyp: '#F0431A', bunn: '#160D0B' },
    komedie: { lys: '#FFE85C', dyp: '#FF9D2E', bunn: '#1B1140' },
    verden: { lys: '#86CBFF', dyp: '#1E6BE8', bunn: '#051A34' },
    kos: { lys: '#FFD0A6', dyp: '#E8735F', bunn: '#241019' },
    konserter: { lys: '#FF5CD6', dyp: '#4F7BFF', bunn: '#0E0A24' },
    dokumentar: { lys: '#F2F6FF', dyp: '#8FA3C4', bunn: '#111A26' },
    favoritter: { lys: '#F7E6A1', dyp: '#D9A84A', bunn: '#10192D' }
  };

  var api = { kanaler: REKKEFOLGE, farger: KANAL, navn: NAVN, bildeSti: 'fliser/{id}.jpg', variant: 'rolig' };
  var aktiv = [];

  function finnId(x) {
    if (!x) return 'favoritter';
    var s = String(x).toLowerCase().replace(/^f6\s*(tv)?\s*/, '').trim();
    if (KANAL[s]) return s;
    for (var i = 0; i < REKKEFOLGE.length; i++) {
      var k = REKKEFOLGE[i];
      if (NAVN.no[k].toLowerCase() === s || NAVN.en[k].toLowerCase() === s) return k;
    }
    return 'favoritter';
  }
  function sprak(l) {
    if (l === 'en' || l === 'no') return l;
    try { if (new URLSearchParams(global.location.search).get('lang') === 'en') return 'en'; } catch (e) {}
    return 'no';
  }
  function navnFor(id, lang) { return NAVN[sprak(lang)][finnId(id)]; }
  function bildeFor(id, url) { return url || api.bildeSti.replace('{id}', finnId(id)); }
  /* Henter bildene på forhånd, så de ligger klare i nettleseren. Feil overses. */
  function forhandslast(liste) {
    return Promise.all((liste || REKKEFOLGE).map(function (x) {
      return new Promise(function (res) {
        var im = new Image(); im.onload = im.onerror = function () { res(); };
        im.src = /[\/.]/.test(x) ? x : bildeFor(x);
      });
    }));
  }

  function esc(t) { return String(t).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function rgba(hex, a) {
    var n = parseInt(hex.slice(1), 16);
    return 'rgba(' + (n >> 16) + ',' + ((n >> 8) & 255) + ',' + (n & 255) + ',' + a + ')';
  }
  function reserve(k) {
    var c = KANAL[k];
    return 'radial-gradient(circle at 50% 42%,' + rgba(c.dyp, .55) + ',' + rgba(c.dyp, 0) + ' 65%),' +
           'radial-gradient(circle at 8% 0%,' + rgba(c.lys, .26) + ',' + rgba(c.lys, 0) + ' 55%),' + c.bunn;
  }
  function merke(kl) { return '<svg class="' + kl + '" viewBox="0 0 600 810" aria-hidden="true"><path fill-rule="evenodd" d="' + MERKE + '"/></svg>'; }
  /* Stemning: bildet, lite og uskarpt, blåst opp til hele skjermen. Billig for skjermkortet. */
  function stemning(k, url, kl) {
    return '<div class="f6i-stemning ' + (kl || '') + '" style="background:' + reserve(k) + '">' +
      '<div class="f6i-uskarp"><img src="' + esc(url) + '" alt=""></div><div class="f6i-slor"></div></div>';
  }
  /* Kortet: flisen fra Home Assistant i stort. Bilde, mørk overgang og F6 TV-merkelapp. */
  function kort(k, url) {
    return '<div class="f6i-kort" style="background:' + reserve(k) + '">' +
      '<img class="f6i-foto" src="' + esc(url) + '" alt=""><div class="f6i-grad"></div>' +
      '<div class="f6i-merkelapp">F6 TV</div><div class="f6i-sveip"></div></div>';
  }
  /* Bildet tones inn når det er lastet. Mangler det, står kanalfargen igjen. */
  function bilder(el) {
    Array.prototype.forEach.call(el.querySelectorAll('img'), function (im) {
      if (im.complete && im.naturalWidth) { im.className += ' f6i-inne'; return; }
      im.onload = function () { im.className += ' f6i-inne'; };
      im.onerror = function () { im.style.display = 'none'; };
    });
  }

  function rot(valg, klasse) {
    var vert = (valg && valg.rot) || document.body;
    var el = document.createElement('div');
    el.className = 'f6i ' + klasse + (vert === document.body ? ' f6i-fast' : '');
    el.setAttribute('aria-hidden', 'true');
    vert.appendChild(el);
    var w = el.clientWidth || global.innerWidth, h = el.clientHeight || global.innerHeight;
    var em = Math.min(h / 108, w / 192);          // 1em = 10 px på 1080p
    el.style.fontSize = em + 'px';
    el._em = em; el._w = w; el._h = h;
    aktiv.push(el);
    return el;
  }
  function fjern(el) {
    var i = aktiv.indexOf(el); if (i >= 0) aktiv.splice(i, 1);
    (el._t || []).forEach(clearTimeout); el._vent = null;
    if (el.parentNode) el.parentNode.removeChild(el);
  }
  function avbryt() { aktiv.slice().forEach(fjern); }
  /* Tidsur starter først når første bilde er tegnet, så de går i takt med animasjonene. */
  function etter(el, ms, fn) { (el._vent = el._vent || []).push([ms, fn]); }
  function start(el) {
    var gang = function () {
      if (!el._vent) return;
      el._t = el._vent.map(function (v) { return setTimeout(v[1], v[0]); }); el._vent = null;
    };
    var a = el.getAnimations ? el.getAnimations({ subtree: true })[0] : null;
    if (a && a.ready) a.ready.then(gang, gang); else gang();
  }
  function q(el, s) { return el.querySelector(s); }

  /* Web Animations. fill 'both' holder start- og sluttbildet. Animasjon nummer to på samme element bruker 'forwards'. */
  function anim(el, bilder, start, varighet, ease, fill) {
    if (!el || !el.animate) return null;
    return el.animate(bilder, { delay: start, duration: varighet, easing: ease || UT, fill: fill || 'both' });
  }
  var UT = 'cubic-bezier(.2,.7,.2,1)', INNUT = 'cubic-bezier(.6,0,.3,1)', INN = 'cubic-bezier(.5,0,.9,.5)';

  /* Navnet får aldri bli bredere enn plassen sin. Skriften krymper ved behov. */
  function tilpass(el, tekstEl, maks) {
    var bredde = tekstEl.scrollWidth, grense = el._w * maks;
    if (bredde > grense) tekstEl.style.fontSize = (parseFloat(getComputedStyle(tekstEl).fontSize) * grense / bredde) + 'px';
  }
  function bokstaver(tekst) {
    return Array.prototype.map.call(String(tekst), function (c) {
      return c === ' ' ? '<span class="f6i-b">&nbsp;</span>' : '<span class="f6i-b">' + esc(c) + '</span>';
    }).join('');
  }

  /* ───────── INTRO ───────── */
  function f6Intro(kanalId, navn, lang, valg) {
    valg = valg || {};
    var k = finnId(kanalId || navn);
    var tekst = navn || navnFor(k, lang || valg.lang);
    var url = bildeFor(k, valg.bilde);
    var ident = (valg.variant || api.variant) === 'ident';
    var el = rot(valg, 'f6i-intro ' + (ident ? 'f6i-ident' : 'f6i-rolig'));
    el.innerHTML =
      '<div class="f6i-bunn"></div>' +
      stemning(k, url) +
      '<div class="f6i-scene"><div class="f6i-zoom"><div class="f6i-vend">' +
        '<div class="f6i-side f6i-forside">' + merke('f6i-merke') + '</div>' +
        '<div class="f6i-side f6i-bakside">' + kort(k, url) + '</div>' +
      '</div></div></div>' +
      '<div class="f6i-tekst"><div class="f6i-navn">' + bokstaver(tekst) + '</div><div class="f6i-linje"></div></div>';
    bilder(el);
    tilpass(el, q(el, '.f6i-navn'), .84);

    var T = { vend: 650, tekst: 1250, apne: 3450, slutt: 4300 };
    // 1. F6-merket i gull på marineblå
    anim(q(el, '.f6i-forside'), [{ opacity: 0, transform: 'scale(.86)' }, { opacity: 1, transform: 'scale(1)' }], 80, 520);
    // 2. Merket blir til kanalens bilde. Stemningen fra bildet fyller skjermen.
    if (ident) {
      anim(q(el, '.f6i-vend'), [
        { transform: 'rotateY(0deg) scale(1)' },
        { transform: 'rotateY(-90deg) scale(1.08)', offset: .5 },
        { transform: 'rotateY(-180deg) scale(1)' }], T.vend, 750, INNUT);
      anim(q(el, '.f6i-sveip'), [
        { transform: 'translateX(-140%) skewX(-14deg)' }, { transform: 'translateX(340%) skewX(-14deg)' }], 1900, 1100, 'ease-in-out');
    } else {
      anim(q(el, '.f6i-forside'), [{ opacity: 1 }, { opacity: 0 }], T.vend, 450, 'ease', 'forwards');
      anim(q(el, '.f6i-bakside'), [{ opacity: 0, transform: 'scale(.95)' }, { opacity: 1, transform: 'scale(1)' }], T.vend + 200, 750);
    }
    anim(q(el, '.f6i-stemning'), [{ opacity: 0 }, { opacity: 1 }], T.vend + 150, 700, 'ease');
    // 3. Rolig zoom og panorering i bildet (Ken Burns)
    anim(q(el, '.f6i-foto'), [
      { transform: 'scale(1.03) translate(1%,1%)' },
      { transform: 'scale(1.15) translate(-1.2%,-1.6%)' }], T.vend, T.slutt - T.vend, 'linear');
    // 4. Navnet, bokstav for bokstav, og gullinjen
    var b = el.querySelectorAll('.f6i-b'), steg = Math.min(45, 400 / Math.max(1, b.length));
    for (var i = 0; i < b.length; i++)
      anim(b[i], [{ opacity: 0, transform: 'translateY(.3em)' }, { opacity: 1, transform: 'translateY(0)' }], T.tekst + i * steg, 520);
    anim(q(el, '.f6i-linje'), [{ transform: 'scaleX(0)' }, { transform: 'scaleX(1)' }], T.tekst + 250, 900, INNUT);
    // 5. Åpningen: alt løser seg opp over videoen
    anim(q(el, '.f6i-tekst'), [{ opacity: 1 }, { opacity: 0 }], T.apne - 100, 400, 'ease');
    if (ident) anim(q(el, '.f6i-zoom'), [{ opacity: 1, transform: 'scale(1)' }, { opacity: 0, transform: 'scale(1.5)' }], T.apne, 700, INN);
    else anim(q(el, '.f6i-zoom'), [{ opacity: 1, transform: 'scale(1)' }, { opacity: 0, transform: 'scale(1.04)' }], T.apne, 600, 'ease');
    anim(q(el, '.f6i-bunn'), [{ opacity: 1 }, { opacity: 0 }], T.apne + 100, 650, 'ease');
    anim(q(el, '.f6i-stemning'), [{ opacity: 1 }, { opacity: 0 }], T.apne + 150, 700, 'ease', 'forwards');

    var ferdig = new Promise(function (res) { etter(el, T.slutt, function () { fjern(el); res(); }); });
    var p = new Promise(function (res) { etter(el, T.apne, res); });
    p.ferdig = ferdig; p.element = el;
    start(el);
    return p;
  }

  /* ───────── KANALSKIFT ───────── */
  function f6Kanalskift(fraId, tilId, navn, valg) {
    valg = valg || {};
    var fra = finnId(fraId), til = finnId(tilId || navn);
    var tekst = navn || navnFor(til, valg.lang);
    var fraUrl = bildeFor(fra, valg.fraBilde), tilUrl = bildeFor(til, valg.tilBilde);
    var ident = (valg.variant || api.variant) === 'ident';
    // Et nytt skift erstatter et som fortsatt vises
    aktiv.slice().forEach(function (a) { if (/f6i-skift/.test(a.className)) fjern(a); });
    var el = rot(valg, 'f6i-skift ' + (ident ? 'f6i-ident' : 'f6i-rolig'));
    el.innerHTML =
      '<div class="f6i-dekke"><div class="f6i-bunn"></div>' + stemning(fra, fraUrl) + stemning(til, tilUrl, 'f6i-ny') + '</div>' +
      '<div class="f6i-skygge"></div>' +
      '<div class="f6i-tredjedel"><div class="f6i-f6">F6 TV</div><div class="f6i-navn">' + esc(tekst) + '</div><div class="f6i-linje"></div></div>' +
      '<div class="f6i-fly"><div class="f6i-vend">' +
        '<div class="f6i-side f6i-forside">' + kort(fra, fraUrl) + '</div>' +
        '<div class="f6i-side f6i-bakside">' + kort(til, tilUrl) + '</div>' +
      '</div></div>';
    bilder(el);
    var em = el._em;
    tilpass(el, q(el, '.f6i-navn'), (el._w - 38.2 * em) / el._w);   // plass til kortet og høyre marg

    // Kortet flyr fra midten til plassen sin nede til venstre (9,6em fra kanten, 15em stort)
    var dx = (9.6 + 7.5) * em - el._w / 2, dy = (el._h - (8.6 + 7.5) * em) - el._h / 2;
    var T = { dekket: 170, vend: 110, fly: 640, av: 820, slutt: 1200, bli: 3600 };
    anim(q(el, '.f6i-dekke'), [{ opacity: 0 }, { opacity: 1 }], 0, T.dekket, 'ease-out');
    anim(q(el, '.f6i-fly'), [{ opacity: 0, transform: 'scale(.86)' }, { opacity: 1, transform: 'scale(1)' }], 0, 200);
    if (ident) {
      anim(q(el, '.f6i-vend'), [
        { transform: 'rotateY(0deg) scale(1)' },
        { transform: 'rotateY(-90deg) scale(1.12)', offset: .5 },
        { transform: 'rotateY(-180deg) scale(1)' }], T.vend, 520, INNUT);
    } else {
      anim(q(el, '.f6i-bakside'), [{ opacity: 0 }, { opacity: 1 }], T.vend + 120, 340, 'ease');
    }
    anim(q(el, '.f6i-ny'), [{ opacity: 0 }, { opacity: 1 }], T.vend + 150, 320, 'ease');
    anim(q(el, '.f6i-bakside .f6i-foto'), [{ transform: 'scale(1.03)' }, { transform: 'scale(1.12)' }], T.vend, T.bli + 450, 'linear');
    anim(q(el, '.f6i-bakside .f6i-merkelapp'), [{ opacity: 1 }, { opacity: 0 }], T.fly, 250, 'ease');
    anim(q(el, '.f6i-fly'), [
      { transform: 'translate(0,0) scale(1)' },
      { transform: 'translate(' + dx + 'px,' + dy + 'px) scale(.3409)' }], T.fly, 500, INNUT, 'forwards');
    anim(q(el, '.f6i-skygge'), [{ opacity: 0 }, { opacity: 1 }], T.fly, 300, 'ease');
    anim(q(el, '.f6i-tredjedel'), [{ opacity: 0, transform: 'translateX(-3em)' }, { opacity: 1, transform: 'translateX(0)' }], T.fly + 180, 380);
    anim(q(el, '.f6i-tredjedel .f6i-linje'), [{ transform: 'scaleX(0)' }, { transform: 'scaleX(1)' }], T.fly + 300, 600, INNUT);
    anim(q(el, '.f6i-dekke'), [{ opacity: 1 }, { opacity: 0 }], T.av, T.slutt - T.av, 'ease', 'forwards');
    // Nedre tredjedel blir stående litt, og toner så ut
    anim(el, [{ opacity: 1 }, { opacity: 0 }], T.bli, 450, 'ease');

    var dekket = new Promise(function (res) { etter(el, T.dekket + 20, function () { if (valg.onDekket) valg.onDekket(); res(); }); });
    var ferdig = new Promise(function (res) { etter(el, T.bli + 470, function () { fjern(el); res(); }); });
    var p = new Promise(function (res) { etter(el, T.slutt, res); });
    p.dekket = dekket; p.ferdig = ferdig; p.element = el;
    start(el);
    return p;
  }

  api.finnId = finnId; api.navnFor = navnFor; api.bildeFor = bildeFor; api.forhandslast = forhandslast; api.avbryt = avbryt;
  global.f6Intro = f6Intro;
  global.f6Kanalskift = f6Kanalskift;
  global.f6Ident = api;
})(window);
