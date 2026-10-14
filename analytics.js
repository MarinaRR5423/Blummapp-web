/*
 * analytics.js — analítica de blummapp.com
 *
 * PostHog (UE) SIN cookies: sin identify, sin autocapture, sin grabación de sesiones y
 * con la propiedad site=web. Se elimina ?ref= (id real de la usuaria) de las URLs capturadas.
 * No hay píxeles publicitarios (Meta y TikTok se retiraron: datos de salud, ver la política).
 *
 * Uso en las páginas:  <script src="analytics.js?v=2" defer></script>
 * API: window.blummTrack(evento, propiedades)   — solo categorías, nunca datos personales.
 */
(function () {
  'use strict';

  var POSTHOG_KEY = 'phc_zkpJJdPGeZyZCorxBfaqPggyc9maxov2tDXWg3yiKuwe'; // clave pública (solo escritura)
  var POSTHOG_HOST = 'https://eu.i.posthog.com';
  var POSTHOG_ASSETS = 'https://eu-assets.i.posthog.com';

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

  initPostHog();
})();
