/*
 * analytics.js — analítica y consentimiento de blummapp.com
 *
 *  - PostHog (UE) SIN cookies: se carga siempre. Sin identify, sin autocapture,
 *    sin grabación de sesiones y sin el parámetro ?ref= (id real de la usuaria).
 *  - Meta Pixel y TikTok Pixel: solo si la usuaria pulsa "Aceptar" en el banner
 *    y la página lleva el atributo data-ads en su <script>.
 *  - La elección se guarda en localStorage ("blumm_consent": granted | denied)
 *    y se puede cambiar desde cualquier enlace con el atributo data-consent-open.
 *
 * Uso en las páginas:  <script src="analytics.js?v=1" defer data-ads></script>
 * API: window.blummTrack(evento, propiedades) · window.blummOpenConsent()
 */
(function () {
  'use strict';

  var CONSENT_KEY = 'blumm_consent';
  var LANG_KEY = 'meirins_lang';
  var META_PIXEL_ID = '1379456450843415';
  var TIKTOK_PIXEL_ID = 'DAFTA2RC77U4RNF8LF8G';
  var POSTHOG_KEY = 'phc_zkpJJdPGeZyZCorxBfaqPggyc9maxov2tDXWg3yiKuwe'; // clave pública (solo escritura)
  var POSTHOG_HOST = 'https://eu.i.posthog.com';
  var POSTHOG_ASSETS = 'https://eu-assets.i.posthog.com';

  // Esta página ¿carga píxeles publicitarios (si hay consentimiento)?
  var ADS_PAGE = !!(document.currentScript && document.currentScript.hasAttribute('data-ads'));

  /* ── Consentimiento ─────────────────────────────────────────────── */
  function getConsent() {
    try { return localStorage.getItem(CONSENT_KEY); } catch (e) { return null; }
  }
  function setConsent(v) {
    try { localStorage.setItem(CONSENT_KEY, v); } catch (e) { /* sin almacenamiento */ }
  }

  // Primera capa: finalidad clara, sin nombres. Segunda capa («Más información»): quiénes son.
  var TEXTS = {
    es: {
      title: 'Tu privacidad, tú decides',
      text: 'Usamos cookies de terceros para medir y mejorar nuestros anuncios en redes sociales.',
      note: 'Solo se activan si las aceptas. La analítica de la web no usa cookies.',
      more: 'Más información',
      details: 'Los píxeles de Meta (Meta Platforms Ireland) y TikTok (TikTok Technology Limited) miden nuestros anuncios y permiten mostrártelos de nuevo. Pueden instalar cookies y recibir datos de tu visita, que pueden tratar fuera de la UE. Puedes cambiar tu elección cuando quieras desde «Preferencias de cookies».',
      policy: 'Leer la política de privacidad',
      reject: 'Rechazar', accept: 'Aceptar'
    },
    en: {
      title: 'Your privacy, your choice',
      text: 'We use third-party cookies to measure and improve our ads on social networks.',
      note: "They are only activated if you accept. Our site analytics don't use cookies.",
      more: 'Learn more',
      details: 'The Meta (Meta Platforms Ireland) and TikTok (TikTok Technology Limited) pixels measure our ads and let us show them to you again. They may set cookies and receive data about your visit, which they may process outside the EU. You can change your choice at any time from “Cookie preferences”.',
      policy: 'Read the privacy policy',
      reject: 'Reject', accept: 'Accept'
    },
    fr: {
      title: 'Ta vie privée, ton choix',
      text: 'Nous utilisons des cookies tiers pour mesurer et améliorer nos publicités sur les réseaux sociaux.',
      note: "Ils ne s'activent que si tu les acceptes. L'analyse du site n'utilise pas de cookies.",
      more: 'En savoir plus',
      details: "Les pixels de Meta (Meta Platforms Ireland) et de TikTok (TikTok Technology Limited) mesurent nos publicités et permettent de te les montrer à nouveau. Ils peuvent déposer des cookies et recevoir des données sur ta visite, qu'ils peuvent traiter hors de l'UE. Tu peux changer ton choix à tout moment depuis « Préférences cookies ».",
      policy: 'Lire la politique de confidentialité',
      reject: 'Refuser', accept: 'Accepter'
    },
    it: {
      title: 'La tua privacy, decidi tu',
      text: 'Usiamo cookie di terze parti per misurare e migliorare i nostri annunci sui social network.',
      note: "Si attivano solo se li accetti. L'analisi del sito non usa cookie.",
      more: 'Maggiori informazioni',
      details: "I pixel di Meta (Meta Platforms Ireland) e TikTok (TikTok Technology Limited) misurano i nostri annunci e permettono di mostrarteli di nuovo. Possono installare cookie e ricevere dati sulla tua visita, che possono trattare fuori dall'UE. Puoi cambiare la tua scelta in qualsiasi momento da «Preferenze cookie».",
      policy: "Leggi l'informativa sulla privacy",
      reject: 'Rifiuta', accept: 'Accetta'
    }
  };

  function currentLang() {
    var l = '';
    try { l = (localStorage.getItem(LANG_KEY) || '').slice(0, 2); } catch (e) { /* noop */ }
    if (!TEXTS[l]) l = ((navigator.language || 'es').slice(0, 2));
    return TEXTS[l] ? l : 'es';
  }

  var banner = null;
  var detailsOpen = false;

  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text) n.textContent = text;
    return n;
  }

  function renderBanner() {
    var t = TEXTS[currentLang()];
    if (!banner) {
      banner = el('div', 'consent-banner');
      banner.setAttribute('role', 'dialog');
      banner.setAttribute('aria-live', 'polite');
      document.body.appendChild(banner);
    }
    banner.setAttribute('aria-label', t.title);
    banner.textContent = '';
    banner.appendChild(el('p', 'consent-title', t.title));
    var p = el('p', 'consent-text', t.text + ' ');
    var more = el('button', 'consent-more', t.more);
    more.type = 'button';
    more.setAttribute('aria-expanded', detailsOpen ? 'true' : 'false');
    p.appendChild(more);
    banner.appendChild(p);

    // Segunda capa: quiénes reciben los datos
    var details = el('div', 'consent-details' + (detailsOpen ? '' : ' hidden'));
    details.appendChild(el('p', '', t.note));
    details.appendChild(el('p', '', t.details));
    var policy = el('a', '', t.policy);
    policy.href = 'privacy.html#web';
    details.appendChild(policy);
    banner.appendChild(details);
    more.addEventListener('click', function () {
      detailsOpen = !detailsOpen;
      details.classList.toggle('hidden', !detailsOpen);
      more.setAttribute('aria-expanded', detailsOpen ? 'true' : 'false');
    });
    var actions = el('div', 'consent-actions');
    var reject = el('button', 'consent-btn consent-reject', t.reject);
    reject.type = 'button';
    reject.addEventListener('click', function () { decide('denied'); });
    var accept = el('button', 'consent-btn consent-accept', t.accept);
    accept.type = 'button';
    accept.addEventListener('click', function () { decide('granted'); });
    actions.appendChild(reject);
    actions.appendChild(accept);
    banner.appendChild(actions);
  }

  function hideBanner() {
    if (banner && banner.parentNode) banner.parentNode.removeChild(banner);
    banner = null;
    detailsOpen = false;
  }

  function openConsent() {
    renderBanner();
  }

  function decide(value) {
    var previous = getConsent();
    setConsent(value);
    hideBanner();
    if (value === 'granted') {
      if (ADS_PAGE) loadAdPixels();
    } else if (previous === 'granted') {
      // Retirada del consentimiento: borrar cookies publicitarias y recargar sin píxeles
      clearAdCookies();
      location.reload();
    }
  }

  function clearAdCookies() {
    var names = ['_fbp', '_fbc', '_ttp', 'ttclid', '_tt_enable_cookie', 'ttwid'];
    var host = location.hostname;
    var parts = host.split('.');
    var domains = ['', host, '.' + host];
    if (parts.length > 2) domains.push('.' + parts.slice(-2).join('.'));
    names.forEach(function (n) {
      domains.forEach(function (d) {
        document.cookie = n + '=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/' + (d ? '; domain=' + d : '');
      });
    });
  }

  /* ── Píxeles publicitarios (solo tras aceptar) ──────────────────── */
  var adsLoaded = false;
  function loadAdPixels() {
    if (adsLoaded) return;
    adsLoaded = true;
    loadMeta();
    loadTikTok();
  }

  function loadMeta() {
    if (window.fbq) return;
    /* código oficial de Meta Pixel */
    !function(f,b,e,v,n,t,s)
    {if(f.fbq)return;n=f.fbq=function(){n.callMethod?
    n.callMethod.apply(n,arguments):n.queue.push(arguments)};
    if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
    n.queue=[];t=b.createElement(e);t.async=!0;
    t.src=v;s=b.getElementsByTagName(e)[0];
    s.parentNode.insertBefore(t,s)}(window,document,'script',
    'https://connect.facebook.net/en_US/fbevents.js');
    window.fbq('init', META_PIXEL_ID);
    window.fbq('track', 'PageView');
  }

  function loadTikTok() {
    /* código oficial de TikTok Pixel (incluye ttq.load y ttq.page) */
    !function (w, d, t) {
    w.TiktokAnalyticsObject=t;var ttq=w[t]=w[t]||[];ttq.methods=["page","track","identify","instances","debug","on","off","once","ready","alias","group","enableCookie","disableCookie","holdConsent","revokeConsent","grantConsent"],ttq.setAndDefer=function(t,e){t[e]=function(){t.push([e].concat(Array.prototype.slice.call(arguments,0)))}};for(var i=0;i<ttq.methods.length;i++)ttq.setAndDefer(ttq,ttq.methods[i]);ttq.instance=function(t){for(var e=ttq._i[t]||[],n=0;n<ttq.methods.length;n++)ttq.setAndDefer(e,ttq.methods[n]);return e},ttq.load=function(e,n){var r="https://analytics.tiktok.com/i18n/pixel/events.js",o=n&&n.partner;ttq._i=ttq._i||{},ttq._i[e]=[],ttq._i[e]._u=r,ttq._t=ttq._t||{},ttq._t[e]=+new Date,ttq._o=ttq._o||{},ttq._o[e]=n||{};n=document.createElement("script");n.type="text/javascript",n.async=!0,n.src=r+"?sdkid="+e+"&lib="+t;e=document.getElementsByTagName("script")[0];e.parentNode.insertBefore(n,e)};
    ttq.load('DAFTA2RC77U4RNF8LF8G');
    ttq.page();
  }(window, document, 'ttq');
  }

  /* ── PostHog (UE), sin cookies ──────────────────────────────────── */
  var ph = null;
  var queue = [];

  function stripRef(u) {
    return u
      .replace(/([?&])ref=[^&#]*(&?)/g, function (m, p1, p2) { return p2 ? p1 : ''; })
      .replace(/[?&]$/, '');
  }

  // Marca el evento como web y elimina ?ref= (es el id real de la usuaria)
  function sanitize(ev) {
    if (!ev || !ev.properties) return ev;
    ev.properties.site = 'web';
    Object.keys(ev.properties).forEach(function (k) {
      var v = ev.properties[k];
      if (typeof v === 'string' && v.indexOf('ref=') !== -1) ev.properties[k] = stripRef(v);
    });
    return ev;
  }

  function initPostHog() {
    // En local (localhost) no se envía nada, para no ensuciar los datos reales.
    // Para probar en local: localStorage.setItem('blumm_dev_analytics', 'dry')  → registra los eventos en
    // window.__phCaptured sin enviarlos;  'send' → los envía de verdad.
    var isLocal = /^(localhost|127\.0\.0\.1|\[::1\])$/.test(location.hostname) || location.protocol === 'file:';
    var dev = null;
    try { dev = localStorage.getItem('blumm_dev_analytics'); } catch (e) { /* noop */ }
    if (isLocal && dev !== 'dry' && dev !== 'send') return;
    var dry = isLocal && dev === 'dry';
    var s = document.createElement('script');
    s.async = true;
    s.crossOrigin = 'anonymous';
    s.src = POSTHOG_ASSETS + '/static/array.js';
    s.onload = function () {
      if (!window.posthog || typeof window.posthog.init !== 'function') return;
      window.posthog.init(POSTHOG_KEY, {
        api_host: POSTHOG_HOST,
        ui_host: 'https://eu.posthog.com',
        cookieless_mode: 'always',        // sin cookies ni almacenamiento (requiere activarlo en el proyecto)
        person_profiles: 'identified_only',
        autocapture: false,
        capture_pageview: true,
        capture_pageleave: false,
        disable_session_recording: true,
        disable_surveys: true,
        capture_dead_clicks: false,       // el proyecto los activa para la app; en la web no
        capture_heatmaps: false,
        capture_performance: false,
        advanced_disable_feature_flags: true,
        before_send: dry
          ? function (ev) { var e = sanitize(ev); (window.__phCaptured = window.__phCaptured || []).push(JSON.parse(JSON.stringify(e))); return null; }
          : sanitize
      });
      ph = window.posthog;
      while (queue.length) { var q = queue.shift(); ph.capture(q[0], q[1]); }
    };
    document.head.appendChild(s);
  }

  window.blummTrack = function (name, props) {
    if (ph) ph.capture(name, props || {});
    else queue.push([name, props || {}]);
  };
  window.blummOpenConsent = openConsent;
  window.blummRefreshConsent = function () { if (banner) renderBanner(); };

  /* ── Arranque ───────────────────────────────────────────────────── */
  function start() {
    initPostHog();
    document.addEventListener('click', function (e) {
      var a = e.target.closest && e.target.closest('[data-consent-open]');
      if (a) { e.preventDefault(); openConsent(); }
    });
    if (!ADS_PAGE) return;
    var c = getConsent();
    if (c === 'granted') loadAdPixels();
    else if (!c) renderBanner();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();
