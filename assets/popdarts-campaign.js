/* Popdarts campaign landing pages — shared behaviour for .popdarts-campaign sections.
   Loaded by every campaign section; runs once. */
(function () {
  if (window.PopdartsCampaign) {
    window.PopdartsCampaign.init(document);
    return;
  }

  var doc = document.documentElement;
  doc.classList.add('popdarts-js');
  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var canHover = window.matchMedia('(hover: hover)').matches;

  function $(sel, root) { return (root || document).querySelector(sel); }
  function $$(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }
  function once(el, key) { if (el['__popdarts_' + key]) return false; el['__popdarts_' + key] = true; return true; }
  function pad(n) { return (n < 10 ? '0' : '') + n; }

  /* ---------------- campaign clock (one shared 1s tick) ---------------- */
  var clock = { start: NaN, end: NaN, labels: {}, timer: null };

  function readClock() {
    var node = $('script[data-popdarts-clock]');
    if (!node) return false;
    try {
      var cfg = JSON.parse(node.textContent);
      clock.start = new Date(cfg.start).getTime();
      clock.end = new Date(cfg.end).getTime();
      clock.labels = cfg.labels || {};
      return !isNaN(clock.end);
    } catch (e) { return false; }
  }

  function state(now) {
    if (!isNaN(clock.start) && now < clock.start) return 'before';
    if (now < clock.end) return 'live';
    return 'after';
  }

  function tick() {
    var now = Date.now();
    var s = state(now);
    if (doc.getAttribute('data-popdarts-state') !== s) doc.setAttribute('data-popdarts-state', s);
    var target = s === 'before' ? clock.start : clock.end;
    var diff = Math.max(0, target - now);
    var d = Math.floor(diff / 86400000);
    var h = Math.floor((diff % 86400000) / 3600000);
    var m = Math.floor((diff % 3600000) / 60000);
    var sec = Math.floor((diff % 60000) / 1000);
    var parts = { d: String(d), h: pad(h), m: pad(m), s: pad(sec) };

    $$('[data-popdarts-timer]').forEach(function (t) {
      $$('[data-popdarts-t]', t).forEach(function (b) {
        var v = parts[b.getAttribute('data-popdarts-t')];
        if (b.textContent !== v) {
          b.textContent = v;
          if (!reduceMotion) { b.classList.remove('is-tick'); void b.offsetWidth; b.classList.add('is-tick'); }
        }
      });
      // final day: drop the "0 days" tile so hours/min/sec get the room
      $$('[data-popdarts-t="d"]', t).forEach(function (b) {
        var tile = b.parentElement, hide = d === 0;
        if (tile && tile.hidden !== hide) tile.hidden = hide;
      });
      $$('[data-popdarts-label]', t).forEach(function (l) {
        var txt = clock.labels[s];
        if (txt && l.textContent !== txt) l.textContent = txt;
      });
    });
    $$('[data-popdarts-compact]').forEach(function (c) {
      var txt = (d > 0 ? d + 'd ' : '') + parts.h + ':' + parts.m + ':' + parts.s;
      if (c.textContent !== txt) c.textContent = txt;
    });
  }

  function startClock() {
    if (clock.timer || !readClock()) return;
    tick();
    clock.timer = setInterval(tick, 1000);
  }

  /* ---------------- money-free variant pickers ---------------- */
  function selectVariant(picker, swatch) {
    $$('[data-popdarts-swatch]', picker).forEach(function (s) {
      var on = s === swatch;
      s.setAttribute('aria-checked', on ? 'true' : 'false');
      s.tabIndex = on ? 0 : -1;
    });
    var d = swatch.dataset;
    var img = $('[data-popdarts-pick-img]', picker);
    if (img && img.tagName !== 'IMG') img = img.querySelector('img');
    if (img && d.image) {
      img.src = d.image;
      if (d.srcset) img.srcset = d.srcset;
      img.alt = d.alt || img.alt;
    }
    var name = $('[data-popdarts-pick-name]', picker);
    if (name) name.textContent = d.title;
    var now = $('[data-popdarts-pick-now]', picker);
    if (now) now.textContent = d.price;
    var was = $('[data-popdarts-pick-was]', picker);
    if (was) { was.textContent = d.was || ''; was.hidden = !d.was; }
    var save = $('[data-popdarts-pick-save]', picker);
    if (save) { save.textContent = d.save || ''; save.hidden = !d.save; }
    var off = $('[data-popdarts-pick-off]', picker);
    if (off) { off.textContent = d.off || ''; off.hidden = !d.off; }
    var link = $('[data-popdarts-pick-link]', picker);
    if (link && d.url) link.href = d.url;
    var btn = $('[data-popdarts-atc]', picker);
    if (btn) {
      var available = d.available === 'true';
      btn.dataset.variantId = d.id;
      btn.disabled = !available;
      var label = $('.popdarts-btn__label', btn) || btn;
      label.textContent = available ? (btn.dataset.labelAdd || 'Add to cart') : (btn.dataset.labelSoldout || 'Sold out');
    }
    if (picker.closest('[data-popdarts-hero]')) syncDock();
  }

  function initPickers(root) {
    $$('[data-popdarts-picker]', root).forEach(function (picker) {
      if (!once(picker, 'picker')) return;
      var swatches = $$('[data-popdarts-swatch]', picker);
      swatches.forEach(function (s, i) {
        s.addEventListener('click', function () { selectVariant(picker, s); });
        s.addEventListener('keydown', function (e) {
          var k = e.key, j = -1;
          if (k === 'ArrowRight' || k === 'ArrowDown') j = (i + 1) % swatches.length;
          if (k === 'ArrowLeft' || k === 'ArrowUp') j = (i - 1 + swatches.length) % swatches.length;
          if (j > -1) { e.preventDefault(); selectVariant(picker, swatches[j]); swatches[j].focus(); }
        });
      });
    });
  }

  /* ---------------- add to cart (theme cart drawer integration) ---------------- */
  var live;
  function announce(msg) {
    if (!live) {
      live = document.createElement('div');
      live.className = 'popdarts-sr';
      live.setAttribute('aria-live', 'polite');
      document.body.appendChild(live);
    }
    live.textContent = '';
    setTimeout(function () { live.textContent = msg; }, 30);
  }

  function rootUrl() {
    return (window.Shopify && window.Shopify.routes && window.Shopify.routes.root) || '/';
  }
  function cartAddUrl() {
    var base = (window.FoxTheme && window.FoxTheme.routes && window.FoxTheme.routes.cart_add_url) || (rootUrl() + 'cart/add');
    return base.replace(/\.js$/, '') + '.js';
  }

  function addToCart(btn) {
    if (btn.classList.contains('is-loading') || btn.disabled) return;
    var id = parseInt(btn.dataset.variantId, 10);
    if (!id) return;
    var label = $('.popdarts-btn__label', btn) || btn;
    var original = label.textContent;
    btn.classList.remove('is-added', 'is-error');
    btn.classList.add('is-loading');
    btn.setAttribute('aria-busy', 'true');

    fetch(cartAddUrl(), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ items: [{ id: id, quantity: 1 }] })
    })
      .then(function (res) {
        return res.json().then(function (data) {
          if (!res.ok) throw new Error(data.description || data.message || 'Could not add to cart');
          return fetch(rootUrl() + 'cart.js', { headers: { Accept: 'application/json' } }).then(function (r) { return r.json(); });
        });
      })
      .then(function (cart) {
        btn.classList.remove('is-loading');
        btn.removeAttribute('aria-busy');
        btn.classList.add('is-added');
        label.textContent = btn.dataset.labelAdded || 'Added ✓';
        announce((btn.dataset.productTitle || 'Item') + ' added to cart');
        if (navigator.vibrate) { try { navigator.vibrate(12); } catch (e) {} }

        var fox = window.FoxTheme;
        if (fox && fox.pubsub && fox.pubsub.PUB_SUB_EVENTS) {
          fox.pubsub.publish(fox.pubsub.PUB_SUB_EVENTS.cartUpdate, { cart: cart, source: 'popdarts-campaign' });
        }
        document.dispatchEvent(new CustomEvent('cart:updated', { detail: { cart: cart } }));
        if ($('cart-drawer')) {
          document.dispatchEvent(new CustomEvent('cart:refresh', { detail: { open: true } }));
        } else {
          window.location.href = rootUrl() + 'cart';
        }
        setTimeout(function () { btn.classList.remove('is-added'); label.textContent = original; }, 2400);
      })
      .catch(function (err) {
        btn.classList.remove('is-loading');
        btn.removeAttribute('aria-busy');
        btn.classList.add('is-error');
        label.textContent = 'Try again';
        announce(err.message || 'Could not add to cart');
        setTimeout(function () { btn.classList.remove('is-error'); label.textContent = original; }, 2600);
      });
  }

  document.addEventListener('click', function (e) {
    var btn = e.target.closest('.popdarts-campaign [data-popdarts-atc]');
    if (btn) { e.preventDefault(); addToCart(btn); }
  });

  /* ---------------- in-page jumps ---------------- */
  document.addEventListener('click', function (e) {
    var a = e.target.closest('.popdarts-campaign a[href^="#"]');
    if (!a || e.defaultPrevented) return;
    var id = a.getAttribute('href').slice(1);
    var target = id && document.getElementById(id);
    if (!target) return;
    e.preventDefault();
    target.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' });
    if (!target.hasAttribute('tabindex')) target.setAttribute('tabindex', '-1');
    try { target.focus({ preventScroll: true }); } catch (err) {}
  });

  function initJump(root) {
    $$('[data-popdarts-jump] a[href^="#"]', root).forEach(function (a) {
      var id = a.getAttribute('href').slice(1);
      a.hidden = !!id && !document.getElementById(id);
    });
  }

  /* ---------------- tabs ---------------- */
  function initTabs(root) {
    $$('[data-popdarts-tabs]', root).forEach(function (wrap) {
      if (!once(wrap, 'tabs')) return;
      var tabs = $$('[role="tab"]', wrap);
      function select(i, focus) {
        tabs.forEach(function (t, j) {
          var on = i === j;
          t.setAttribute('aria-selected', on ? 'true' : 'false');
          t.tabIndex = on ? 0 : -1;
          var panel = document.getElementById(t.getAttribute('aria-controls'));
          if (panel) panel.hidden = !on;
        });
        if (focus) tabs[i].focus();
      }
      tabs.forEach(function (t, i) {
        t.addEventListener('click', function () { select(i); });
        t.addEventListener('keydown', function (e) {
          if (e.key === 'ArrowRight') { e.preventDefault(); select((i + 1) % tabs.length, true); }
          if (e.key === 'ArrowLeft') { e.preventDefault(); select((i - 1 + tabs.length) % tabs.length, true); }
        });
      });
    });
  }

  /* ---------------- accordion ---------------- */
  function initAccordions(root) {
    $$('[data-popdarts-accordion] .popdarts-faq__q', root).forEach(function (q) {
      if (!once(q, 'acc')) return;
      q.addEventListener('click', function () {
        var open = q.getAttribute('aria-expanded') === 'true';
        q.setAttribute('aria-expanded', open ? 'false' : 'true');
        var panel = document.getElementById(q.getAttribute('aria-controls'));
        if (panel) panel.hidden = open;
      });
    });
  }

  /* ---------------- slider dots ---------------- */
  function initSliders(root) {
    $$('[data-popdarts-slider]', root).forEach(function (track) {
      if (!once(track, 'slider')) return;
      var dots = track.parentElement.querySelector('[data-popdarts-dots]');
      if (!dots) return;
      var items = Array.prototype.slice.call(track.children);
      var buttons = $$('button', dots);
      function current() {
        var x = track.scrollLeft, best = 0, dist = Infinity;
        items.forEach(function (it, i) {
          var d = Math.abs(it.offsetLeft - track.offsetLeft - x - parseFloat(getComputedStyle(track).scrollPaddingLeft || 0));
          if (d < dist) { dist = d; best = i; }
        });
        buttons.forEach(function (b, i) { b.setAttribute('aria-current', i === best ? 'true' : 'false'); });
      }
      buttons.forEach(function (b, i) {
        b.addEventListener('click', function () {
          track.scrollTo({ left: items[i].offsetLeft - track.offsetLeft - parseFloat(getComputedStyle(track).scrollPaddingLeft || 0), behavior: reduceMotion ? 'auto' : 'smooth' });
        });
      });
      var raf;
      track.addEventListener('scroll', function () { cancelAnimationFrame(raf); raf = requestAnimationFrame(current); }, { passive: true });
      current();
    });
  }

  /* ---------------- spotlight tilt ---------------- */
  function initTilt(root) {
    if (!canHover || reduceMotion) return;
    $$('[data-popdarts-tilt]', root).forEach(function (card) {
      if (!once(card, 'tilt')) return;
      var zone = card.closest('[data-popdarts-hero]') || card;
      zone.addEventListener('pointermove', function (e) {
        var r = card.getBoundingClientRect();
        var x = (e.clientX - (r.left + r.width / 2)) / r.width;
        var y = (e.clientY - (r.top + r.height / 2)) / r.height;
        card.style.setProperty('--ry', (x * 8).toFixed(2) + 'deg');
        card.style.setProperty('--rx', (y * -6).toFixed(2) + 'deg');
      });
      zone.addEventListener('pointerleave', function () {
        card.style.setProperty('--ry', '-3deg');
        card.style.setProperty('--rx', '0deg');
      });
    });
  }

  /* ---------------- lazy gameplay video ---------------- */
  var videoIO = 'IntersectionObserver' in window ? new IntersectionObserver(function (entries) {
    entries.forEach(function (en) {
      var v = en.target;
      if (en.isIntersecting) {
        if (!v.src && v.dataset.src) { v.src = v.dataset.src; v.load(); }
        if (!reduceMotion) { var p = v.play(); if (p && p.catch) p.catch(function () {}); }
      } else if (!v.paused) {
        v.pause();
      }
    });
  }, { rootMargin: '200px 0px' }) : null;

  function initVideos(root) {
    $$('video[data-popdarts-lazy]', root).forEach(function (v) {
      if (!once(v, 'video')) return;
      if (reduceMotion) v.controls = true;
      if (videoIO) videoIO.observe(v); else if (v.dataset.src) v.src = v.dataset.src;
    });
  }

  /* ---------------- sticky mobile buy dock ---------------- */
  var sticky = { bar: null, buy: null, link: null, out: false, closingIn: false };
  function drawerOpen() {
    return !!document.querySelector('cart-drawer[open], drawer-component[open], menu-drawer[open], search-drawer[open], .drawer[open]');
  }
  function heroPicker() { return $('[data-popdarts-hero] [data-popdarts-picker]'); }

  // Copy the hero's current pick (already formatted by Liquid) into the dock.
  function syncDock() {
    var buy = sticky.buy, link = sticky.link;
    if (!buy) return;
    var picker = heroPicker();
    var src = picker && $('[data-popdarts-atc]', picker);
    var ok = !!(src && !src.disabled && src.dataset.variantId);
    buy.hidden = !ok;
    if (link) link.hidden = ok;
    if (!ok) return;

    var checked = $('[data-popdarts-swatch][aria-checked="true"]', picker);
    var thumb = checked ? $('img', checked) : $('[data-popdarts-pick-img] img', picker);
    var img = $('[data-popdarts-sticky-img]', buy);
    if (img && thumb) {
      var url = thumb.currentSrc || thumb.src;
      if (url && img.getAttribute('src') !== url) img.src = url;
    }
    function copy(from, to) {
      var a = $(from, picker), b = $(to, buy);
      if (!b) return '';
      var txt = a && !a.hidden ? a.textContent.trim() : '';
      b.textContent = txt;
      b.hidden = !txt;
      return txt;
    }
    var name = copy('[data-popdarts-pick-name]', '[data-popdarts-sticky-name]');
    copy('[data-popdarts-pick-now]', '[data-popdarts-sticky-now]');
    copy('[data-popdarts-pick-was]', '[data-popdarts-sticky-was]');
    var offSrc = $('[data-popdarts-pick-off]', picker), off = $('[data-popdarts-sticky-off]', buy);
    if (off) {
      var pct = offSrc && !offSrc.hidden ? (offSrc.textContent.match(/\d+/) || [''])[0] : '';
      off.textContent = pct ? '-' + pct + '%' : '';
      off.hidden = !pct;
    }
    var btn = $('[data-popdarts-atc]', buy);
    if (btn && !btn.classList.contains('is-loading')) {
      btn.dataset.variantId = src.dataset.variantId;
      btn.dataset.productTitle = (src.dataset.productTitle || '') + (name ? ' — ' + name : '');
    }
  }

  function updateSticky() {
    if (!sticky.bar) return;
    var show = sticky.out && !sticky.closingIn && !drawerOpen();
    sticky.bar.classList.toggle('is-visible', show);
    sticky.bar.setAttribute('aria-hidden', show ? 'false' : 'true');
    document.body.classList.toggle('popdarts-dock-on', show);
    $$('a, button', sticky.bar).forEach(function (el) { el.tabIndex = show ? 0 : -1; });
  }
  function initSticky() {
    var bar = $('[data-popdarts-sticky]');
    if (!bar || !once(bar, 'sticky')) return;
    sticky.bar = bar;
    sticky.buy = $('[data-popdarts-sticky-buy]', bar);
    sticky.link = $('[data-popdarts-sticky-link]', bar);
    document.body.classList.add('popdarts-has-sticky');
    syncDock();
    if (!('IntersectionObserver' in window)) { sticky.out = true; updateSticky(); return; }
    // Show the dock only while the hero's own add-to-cart is fully off screen
    // (below the fold on short phones, or scrolled past) — never two buy buttons at once.
    var picker = heroPicker();
    var heroAtc = picker && $('[data-popdarts-atc]', picker);
    var anchor = heroAtc || $('[data-popdarts-hero]');
    if (anchor) {
      new IntersectionObserver(function (en) { sticky.out = !en[0].isIntersecting; updateSticky(); },
        { rootMargin: '0px' }).observe(anchor);
    } else sticky.out = true;
    var closing = $('[data-popdarts-closing]');
    if (closing) new IntersectionObserver(function (en) { sticky.closingIn = en[0].isIntersecting; updateSticky(); }).observe(closing);
    new MutationObserver(updateSticky).observe(document.body, { attributes: true, attributeFilter: ['open'], subtree: true });
    updateSticky();
  }

  /* ---------------- boot ---------------- */
  function init(root) {
    startClock();
    initPickers(root);
    initTabs(root);
    initAccordions(root);
    initSliders(root);
    initTilt(root);
    initVideos(root);
    initJump(root);
    initSticky();
    syncDock();
  }

  window.PopdartsCampaign = { init: init, tick: tick };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', function () { init(document); });
  else init(document);

  // Theme editor: re-wire sections as they're added/re-rendered.
  document.addEventListener('shopify:section:load', function (e) {
    if (e.target.querySelector('script[data-popdarts-clock]')) { clearInterval(clock.timer); clock.timer = null; }
    init(e.target);
  });
  document.addEventListener('shopify:section:unload', function (e) {
    if (sticky.bar && e.target.contains(sticky.bar)) {
      sticky.bar = sticky.buy = sticky.link = null;
      document.body.classList.remove('popdarts-has-sticky', 'popdarts-dock-on');
    }
  });
})();
