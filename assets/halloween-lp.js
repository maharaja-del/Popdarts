/* POPDARTS — Halloween Pro Pack LP behaviors
   - live countdowns          [data-hw-countdown]
   - scroll reveals           [data-hw-reveal]
   - sticky add-to-cart bar   [data-hw-sticky] (shows after [data-hw-hero-watch] leaves view)
   - AJAX add to cart         [data-hw-atc] (falls back to product link if no variant id)
*/
(function () {
  'use strict';
  if (window.__hwLpInit) return;
  window.__hwLpInit = true;

  function ready(fn) {
    if (document.readyState !== 'loading') fn();
    else document.addEventListener('DOMContentLoaded', fn);
  }

  /* ---------- countdowns ---------- */
  function pad(n) { return n < 10 ? '0' + n : '' + n; }

  function initCountdowns() {
    var nodes = document.querySelectorAll('[data-hw-countdown]');
    if (!nodes.length) return;

    function render() {
      var now = Date.now();
      nodes.forEach(function (el) {
        var deadline = Date.parse(el.getAttribute('data-deadline') || '');
        if (isNaN(deadline)) return;
        var diff = Math.max(0, deadline - now);
        var d = Math.floor(diff / 86400000);
        var h = Math.floor(diff / 3600000) % 24;
        var m = Math.floor(diff / 60000) % 60;
        var s = Math.floor(diff / 1000) % 60;
        var map = { d: pad(d), h: pad(h), m: pad(m), s: pad(s) };
        el.querySelectorAll('[data-hw-unit]').forEach(function (u) {
          var key = u.getAttribute('data-hw-unit');
          if (map[key] !== undefined && u.textContent !== map[key]) u.textContent = map[key];
        });
        if (diff === 0 && el.getAttribute('data-expired-text') && !el.__hwExpired) {
          el.__hwExpired = true;
          var msg = el.querySelector('[data-hw-expired-slot]');
          if (msg) msg.textContent = el.getAttribute('data-expired-text');
        }
      });
    }
    render();
    setInterval(render, 1000);
  }

  /* ---------- scroll reveals ---------- */
  function initReveals() {
    var els = document.querySelectorAll('[data-hw-reveal]');
    if (!els.length) return;
    if (!('IntersectionObserver' in window)) {
      els.forEach(function (el) { el.classList.add('hw-in'); });
      return;
    }
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add('hw-in');
          io.unobserve(entry.target);
        }
      });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.08 });
    els.forEach(function (el) { io.observe(el); });
  }

  /* ---------- sticky ATC bar ---------- */
  function initSticky() {
    var bar = document.querySelector('[data-hw-sticky]');
    var hero = document.querySelector('[data-hw-hero-watch]');
    if (!bar) return;
    if (!hero || !('IntersectionObserver' in window)) {
      bar.classList.add('hw-sticky--show');
      return;
    }
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        bar.classList.toggle('hw-sticky--show', !entry.isIntersecting && entry.boundingClientRect.top < 0);
      });
    }, { threshold: 0 });
    io.observe(hero);
  }

  /* ---------- add to cart ---------- */
  function initAtc() {
    document.addEventListener('click', function (e) {
      var btn = e.target.closest('[data-hw-atc]');
      if (!btn) return;
      var variantId = (btn.getAttribute('data-variant-id') || '').trim();
      if (!variantId) return; /* no variant configured -> follow the link fallback */
      e.preventDefault();
      if (btn.classList.contains('hw-btn--loading')) return;

      var original = btn.innerHTML;
      btn.classList.add('hw-btn--loading');
      btn.innerHTML = 'Adding…';

      fetch('/cart/add.js', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        body: JSON.stringify({ items: [{ id: parseInt(variantId, 10), quantity: 1 }] })
      })
        .then(function (res) {
          if (!res.ok) throw new Error('add failed');
          return fetch('/cart.js').then(function (r) { return r.json(); });
        })
        .then(function (cart) {
          btn.classList.remove('hw-btn--loading');
          btn.innerHTML = 'Added to cart ✓';
          /* update any visible cart counters */
          document.querySelectorAll('[data-cart-count], .cart-count, .cart-count-bubble, [data-header-cart-count]').forEach(function (el) {
            el.textContent = cart.item_count;
          });
          /* let the theme / cart-drawer apps know the cart changed */
          ['cart:refresh', 'cart:change', 'cart:build', 'cart-drawer:refresh'].forEach(function (name) {
            document.documentElement.dispatchEvent(new CustomEvent(name, { bubbles: true, detail: { cart: cart } }));
          });
          setTimeout(function () { btn.innerHTML = original; }, 2600);
        })
        .catch(function () {
          btn.classList.remove('hw-btn--loading');
          btn.innerHTML = original;
          var href = btn.getAttribute('href') || btn.getAttribute('data-fallback-url');
          if (href) window.location.href = href;
        });
    });
  }

  ready(function () {
    initCountdowns();
    initReveals();
    initSticky();
    initAtc();
  });
})();
