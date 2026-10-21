/* Popdarts Cyber Monday landing page — behaviour for .pdcm sections only.
   Loaded once by every Cyber Monday section (snippet popdarts-cm-assets). No dependencies.
   Everything is driven by data-cm-* attributes, so it never touches other pages or theme widgets. */
(function () {
  if (window.PopdartsCM) { window.PopdartsCM.init(document); return; }

  var doc = document.documentElement;
  doc.classList.add('pdcm-js');
  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var saveData = !!(navigator.connection && navigator.connection.saveData);

  function $(sel, root) { return (root || document).querySelector(sel); }
  function $$(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }
  function once(el, key) { if (el['__pdcm_' + key]) return false; el['__pdcm_' + key] = true; return true; }
  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function shown(el) { return !!el && el.getClientRects().length > 0; }
  function smooth() { return reduceMotion ? 'auto' : 'smooth'; }

  /* ---------------- campaign clock ----------------
     <script type="application/json" data-cm-clock>{"mode":"before|live|auto|after","start":ISO|null,"end":ISO|null,"confirmed":bool}</script>
     Sets <html data-cm-state="before|live|after">. Automatic mode without a start stays "before" (never claims a live sale by accident).
     The countdown only runs while live AND the deadline is confirmed. */
  var clock = { mode: 'before', start: NaN, end: NaN, confirmed: false, timer: null };

  function readClock() {
    var node = $('script[data-cm-clock]');
    if (!node) return false;
    try {
      var c = JSON.parse(node.textContent);
      clock.mode = c.mode || 'before';
      clock.start = c.start ? new Date(c.start).getTime() : NaN;
      clock.end = c.end ? new Date(c.end).getTime() : NaN;
      clock.confirmed = !!c.confirmed;
      return true;
    } catch (e) { return false; }
  }

  function state(now) {
    if (clock.mode === 'live' || clock.mode === 'after' || clock.mode === 'before') return clock.mode;
    if (isNaN(clock.start) || now < clock.start) return 'before';
    if (!isNaN(clock.end) && now >= clock.end) return 'after';
    return 'live';
  }

  function tick() {
    var now = Date.now();
    var s = state(now);
    if (doc.getAttribute('data-cm-state') !== s) {
      doc.setAttribute('data-cm-state', s);
      document.dispatchEvent(new CustomEvent('pdcm:state', { detail: { state: s } }));
    }
    var timers = $$('[data-cm-timer]');
    if (!timers.length) return;
    var counting = clock.confirmed && s === 'live' && !isNaN(clock.end);
    var diff = counting ? Math.max(0, clock.end - now) : 0;
    var d = Math.floor(diff / 86400000), h = Math.floor((diff % 86400000) / 3600000), m = Math.floor((diff % 3600000) / 60000), sec = Math.floor((diff % 60000) / 1000);
    var parts = { d: String(d), h: pad(h), m: pad(m), s: pad(sec) };
    timers.forEach(function (t) {
      t.hidden = !counting;
      $$('[data-cm-t]', t).forEach(function (b) {
        var k = b.getAttribute('data-cm-t');
        if (b.textContent !== parts[k]) b.textContent = parts[k];
        if (k === 'd' && b.parentElement) b.parentElement.hidden = d === 0;
      });
      $$('[data-cm-compact]', t).forEach(function (c) {
        var txt = (d > 0 ? d + 'd ' : '') + parts.h + ':' + parts.m + ':' + parts.s;
        if (c.textContent !== txt) c.textContent = txt;
      });
    });
  }

  function startClock() {
    if (clock.timer || !readClock()) return;
    tick();
    clock.timer = setInterval(tick, $('[data-cm-timer]') && clock.confirmed ? 1000 : 30000);
  }

  /* ---------------- variant pickers ----------------
     [data-cm-picker] contains [data-cm-swatch] radios or a [data-cm-select] whose options carry the same
     Liquid-formatted, approval-gated data: data-id, data-title, data-price, data-was, data-save, data-off,
     data-image, data-srcset, data-url, data-available. */
  function setText(el, txt) { if (!el) return; el.textContent = txt || ''; el.hidden = !txt; }

  function selectVariant(picker, swatch, focus) {
    $$('[data-cm-swatch]', picker).forEach(function (s) {
      if (s.tagName === 'OPTION') return;
      var on = s === swatch;
      s.setAttribute('aria-checked', on ? 'true' : 'false');
      s.tabIndex = on ? 0 : -1;
    });
    var d = swatch.dataset;
    var was = d.was || '', off = d.off || '';
    if (picker.hasAttribute('data-cm-use-register')) {
      // gift guide / quick picks never compute savings — only the deals section's approval register can supply one
      var reg = $('[data-cm-register]'), hit = reg && reg.querySelector('i[data-id="' + d.id + '"]');
      was = hit ? hit.getAttribute('data-was') : '';
      off = hit ? hit.getAttribute('data-off') : '';
    }
    var img = $('[data-cm-pick-img] img', picker);
    if (img && d.image) {
      if (d.srcset) img.srcset = d.srcset;
      img.src = d.image;
      img.alt = d.alt || img.alt;
    }
    setText($('[data-cm-pick-name]', picker), d.title);
    var now = $('[data-cm-pick-now]', picker);
    if (now) { now.textContent = d.price; now.classList.toggle('is-sale', !!was); }
    setText($('[data-cm-pick-was]', picker), was);
    setText($('[data-cm-pick-off]', picker), off);
    $$('[data-cm-pick-link]', picker).forEach(function (a) { if (d.url) a.href = d.url; });
    $$('[data-cm-atc]', picker).forEach(function (btn) {
      var available = d.available === 'true';
      btn.dataset.variantId = d.id;
      btn.dataset.productTitle = (picker.dataset.productTitle || '') + (d.title && d.title !== 'Default Title' ? ' — ' + d.title : '');
      btn.disabled = !available;
      btn.classList.remove('is-added', 'is-error');
      label(btn).textContent = available ? (btn.dataset.labelAdd || 'Add to cart') : (btn.dataset.labelSoldout || 'Sold out');
      clearMsg(btn);
    });
    if (focus && swatch.focus) swatch.focus();
    picker.dispatchEvent(new CustomEvent('pdcm:variant', { bubbles: true, detail: { id: d.id } }));
  }

  function initPickers(root) {
    $$('[data-cm-picker]', root).forEach(function (picker) {
      if (!once(picker, 'picker')) return;
      var swatches = $$('[data-cm-swatch]', picker).filter(function (s) { return s.tagName !== 'OPTION'; });
      swatches.forEach(function (s, i) {
        s.addEventListener('click', function () { selectVariant(picker, s); });
        s.addEventListener('keydown', function (e) {
          var k = e.key, j = -1;
          if (k === 'ArrowRight' || k === 'ArrowDown') j = (i + 1) % swatches.length;
          if (k === 'ArrowLeft' || k === 'ArrowUp') j = (i - 1 + swatches.length) % swatches.length;
          if (k === 'Home') j = 0;
          if (k === 'End') j = swatches.length - 1;
          if (j > -1) { e.preventDefault(); selectVariant(picker, swatches[j], true); }
        });
      });
      $$('[data-cm-select]', picker).forEach(function (sel) {
        sel.addEventListener('change', function () { var o = sel.options[sel.selectedIndex]; if (o) selectVariant(picker, o); });
      });
    });
  }

  /* ---------------- add to cart (theme cart drawer integration) ---------------- */
  var live;
  function announce(msg) {
    if (!live) {
      live = document.createElement('div');
      live.className = 'pdcm-sr';
      live.setAttribute('aria-live', 'polite');
      live.setAttribute('role', 'status');
      document.body.appendChild(live);
    }
    live.textContent = '';
    setTimeout(function () { live.textContent = msg; }, 40);
  }
  function label(btn) { return $('[data-cm-label]', btn) || btn; }
  function msgEl(btn) { var id = btn.getAttribute('aria-describedby'); return id ? document.getElementById(id) : null; }
  function clearMsg(btn) { var m = msgEl(btn); if (m) { m.textContent = ''; m.hidden = true; } }
  function rootUrl() { return (window.Shopify && window.Shopify.routes && window.Shopify.routes.root) || '/'; }
  function cartAddUrl() {
    var base = (window.FoxTheme && window.FoxTheme.routes && window.FoxTheme.routes.cart_add_url) || (rootUrl() + 'cart/add');
    return base.replace(/\.js$/, '') + '.js';
  }

  function cartUrl() { return (window.FoxTheme && window.FoxTheme.routes && window.FoxTheme.routes.cart_url) || (rootUrl() + 'cart'); }

  // The theme's cart drawer re-renders from a `sections` map, exactly as its own product forms do (theme.js
  // handleFormSubmit): ask who needs re-rendering, send those ids with the add, hand the result to the drawer.
  function sectionsToRender() {
    var ids = [];
    document.documentElement.dispatchEvent(new CustomEvent('cart:grouped-sections', { bubbles: true, detail: { sections: ids } }));
    return ids.filter(function (id, i) { return id && ids.indexOf(id) === i; });
  }

  // After a successful add nothing below may surface as an add error: the item is already in the cart.
  function refreshCartUi(btn, cart, added) {
    var fox = window.FoxTheme, drawer = $('cart-drawer'), shown = false;
    try {
      if (cart.sections && fox && fox.pubsub && fox.pubsub.PUB_SUB_EVENTS) fox.pubsub.publish(fox.pubsub.PUB_SUB_EVENTS.cartUpdate, { cart: cart, source: 'popdarts-cyber-monday' });
    } catch (e) { if (window.console) console.warn('[popdarts-cm] cart drawer update failed', e); }
    try { document.dispatchEvent(new CustomEvent('product-ajax:added', { detail: { product: added } })); } catch (e) { /* listener error */ }
    try { document.dispatchEvent(new CustomEvent('cart:updated', { detail: { cart: cart } })); } catch (e) { /* listener error */ }
    try {
      if (drawer && cart.sections && typeof drawer.show === 'function') { drawer.show(btn); shown = true; }
      else if (drawer) { document.dispatchEvent(new CustomEvent('cart:refresh', { detail: { open: true } })); shown = true; }
    } catch (e) { if (window.console) console.warn('[popdarts-cm] cart drawer open failed', e); }
    if (!shown && !drawer) window.location.href = cartUrl();
  }

  function addToCart(btn) {
    if (btn.classList.contains('is-loading') || btn.disabled) return;
    var id = parseInt(btn.dataset.variantId, 10);
    if (!id) return;
    var lab = label(btn);
    var original = btn.dataset.labelAdd || lab.textContent;
    btn.classList.remove('is-added', 'is-error');
    btn.classList.add('is-loading');
    btn.setAttribute('aria-busy', 'true');
    lab.textContent = btn.dataset.labelLoading || 'Adding…';
    clearMsg(btn);

    var sections = sectionsToRender();
    var payload = { items: [{ id: id, quantity: 1 }] };
    if (sections.length) { payload.sections = sections.join(','); payload.sections_url = window.location.pathname; }
    var added;

    fetch(cartAddUrl(), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json', 'X-Requested-With': 'XMLHttpRequest' },
      body: JSON.stringify(payload)
    })
      .then(function (res) {
        return res.json().catch(function () { return {}; }).then(function (data) {
          if (!res.ok || data.status) throw new Error(data.description || data.message || 'This item could not be added. Please try again.');
          added = data;
          return fetch(rootUrl() + 'cart.js', { headers: { Accept: 'application/json' } })
            .then(function (r) { return r.json(); })
            .catch(function () { return {}; });
        });
      })
      .then(function (cart) {
        cart = cart || {};
        if (added && added.sections) cart.sections = added.sections;
        btn.classList.remove('is-loading');
        btn.removeAttribute('aria-busy');
        btn.classList.add('is-added');
        lab.textContent = btn.dataset.labelAdded || 'Added ✓';
        announce((btn.dataset.productTitle || 'Item') + ' added to cart');
        refreshCartUi(btn, cart, added);
        setTimeout(function () { btn.classList.remove('is-added'); lab.textContent = original; }, 2600);
      }, function (err) {
        btn.classList.remove('is-loading', 'is-added');
        btn.removeAttribute('aria-busy');
        btn.classList.add('is-error');
        lab.textContent = btn.dataset.labelError || 'Try again';
        var m = msgEl(btn);
        var text = (err && err.message) || 'This item could not be added. Please try again.';
        if (m) { m.textContent = text; m.hidden = false; }
        announce(text);
        setTimeout(function () { btn.classList.remove('is-error'); lab.textContent = original; }, 3200);
      });
  }

  document.addEventListener('click', function (e) {
    var btn = e.target.closest('.pdcm [data-cm-atc]');
    if (btn) { e.preventDefault(); addToCart(btn); }
  });

  /* ---------------- approved-savings mirror ----------------
     The hero + deals section is the only approval register. Elsewhere, [data-cm-mirror="<variant id>"] copies
     an approved saving from [data-cm-register] — it never computes one. No register entry = regular price. */
  function initMirror(root) {
    var reg = $('[data-cm-register]');
    $$('[data-cm-mirror]', root).forEach(function (el) {
      var hit = reg && reg.querySelector('i[data-id="' + el.getAttribute('data-cm-mirror') + '"]');
      var was = $('[data-cm-pick-was]', el), now = $('[data-cm-pick-now]', el);
      if (hit) {
        setText(was, hit.getAttribute('data-was'));
        if (now) now.classList.add('is-sale');
      } else {
        setText(was, '');
        if (now) now.classList.remove('is-sale');
      }
      var pk = el.closest('[data-cm-picker]'), chip = pk && $('[data-cm-pick-off]', pk);
      if (chip) setText(chip, hit ? hit.getAttribute('data-off') : '');
    });
  }

  /* ---------------- gift tiers: "Save up to N%" from the approval register only ---------------- */
  function initTierSave(root) {
    var reg = $('[data-cm-register]');
    $$('[data-cm-tier]', root).forEach(function (tier) {
      var out = $('[data-cm-tier-save]', tier);
      if (!out) return;
      var ids = [];
      $$('[data-cm-mirror]', tier).forEach(function (el) { ids.push(el.getAttribute('data-cm-mirror')); });
      $$('select[data-cm-select] option', tier).forEach(function (o) { ids.push(o.value); });
      var best = 0;
      ids.forEach(function (id) {
        var hit = reg && reg.querySelector('i[data-id="' + id + '"]');
        var n = hit ? parseInt(hit.getAttribute('data-off'), 10) : 0;
        if (n > best) best = n;
      });
      out.textContent = best > 0 ? (out.dataset.prefix || 'Save up to') + ' ' + best + '%' : '';
      out.hidden = best <= 0;
    });
  }

  /* ---------------- filter chips + "show all": narrow a grid in place (nothing scrolls) ---------------- */
  function initFilters(root) {
    $$('[data-cm-filter]', root).forEach(function (wrap) {
      if (!once(wrap, 'filter')) return;
      var btns = $$('[data-cm-filter-btn]', wrap), grid = $('[data-cm-filter-grid]', wrap), more = $('[data-cm-more]', wrap);
      if (!grid) return;
      var limit = parseInt(wrap.getAttribute('data-limit'), 10) || 0, current = 'all', expanded = false;
      function apply() {
        var items = $$('[data-cm-group]', grid);
        items.forEach(function (it) { it.hidden = false; });
        // a card hidden by the sale state (data-cm-when) doesn't count
        var live = items.filter(function (it) { var c = it.firstElementChild; return !c || shown(c); });
        var match = live.filter(function (it) { return current === 'all' || it.getAttribute('data-cm-group') === current; });
        var cap = current === 'all' && !expanded && limit ? limit : match.length;
        items.forEach(function (it) { it.hidden = match.indexOf(it) < 0 || match.indexOf(it) >= cap; });
        if (more) {
          more.hidden = match.length <= cap;
          var lab = $('[data-cm-label]', more) || more;
          lab.textContent = (more.getAttribute('data-label') || 'Show all') + ' ' + match.length;
        }
      }
      btns.forEach(function (b) {
        b.addEventListener('click', function () {
          current = b.getAttribute('data-cm-filter-btn');
          btns.forEach(function (x) { x.setAttribute('aria-pressed', x === b ? 'true' : 'false'); });
          apply();
        });
      });
      if (more) more.addEventListener('click', function () { expanded = true; apply(); });
      wrap.__pdcmShowAll = function () {
        current = 'all'; expanded = true;
        btns.forEach(function (x) { x.setAttribute('aria-pressed', x.getAttribute('data-cm-filter-btn') === 'all' ? 'true' : 'false'); });
        apply();
      };
      document.addEventListener('pdcm:state', apply);
      apply();
    });
  }

  /* ---------------- tabs (skips tabs hidden in the current sale state) ---------------- */
  function resetRails(scope) {
    $$('[data-cm-track]', scope).forEach(function (t) { t.scrollLeft = 0; });
    $$('[data-cm-rail]', scope).forEach(function (r) { if (r.__pdcmUpdate) r.__pdcmUpdate(); });
  }
  function initTabs(root) {
    $$('[data-cm-tabs]', root).forEach(function (wrap) {
      if (!once(wrap, 'tabs')) return;
      var all = $$('[role="tab"]', wrap);
      if (!all.length) return;
      function visible() { return all.filter(shown); }
      function select(tab, focus) {
        all.forEach(function (t) {
          var on = t === tab;
          t.setAttribute('aria-selected', on ? 'true' : 'false');
          t.tabIndex = on ? 0 : -1;
          var panel = document.getElementById(t.getAttribute('aria-controls'));
          if (panel) panel.hidden = !on;
        });
        if (focus) tab.focus();
        var panel = document.getElementById(tab.getAttribute('aria-controls'));
        if (panel) resetRails(panel);
      }
      wrap.__pdcmSelect = select;
      function ensure() {
        var cur = all.filter(function (t) { return t.getAttribute('aria-selected') === 'true'; })[0];
        var vis = visible();
        if (vis.length && (!cur || !shown(cur))) select(vis[0]);
      }
      all.forEach(function (t) {
        t.addEventListener('click', function () { select(t); });
        t.addEventListener('keydown', function (e) {
          var vis = visible(), i = vis.indexOf(t), j = -1;
          if (e.key === 'ArrowRight') j = (i + 1) % vis.length;
          if (e.key === 'ArrowLeft') j = (i - 1 + vis.length) % vis.length;
          if (e.key === 'Home') j = 0;
          if (e.key === 'End') j = vis.length - 1;
          if (j > -1) { e.preventDefault(); select(vis[j], true); }
        });
      });
      document.addEventListener('pdcm:state', ensure);
      ensure();
    });
  }

  /* ---------------- rails: scroll-snap track + prev/next + dots ---------------- */
  function initRails(root) {
    $$('[data-cm-rail]', root).forEach(function (rail) {
      if (!once(rail, 'rail')) return;
      var track = $('[data-cm-track]', rail);
      if (!track) return;
      var prev = $('[data-cm-prev]', rail), next = $('[data-cm-next]', rail), dots = $('[data-cm-dots]', rail);
      function slides() { return Array.prototype.filter.call(track.children, shown); }
      function step() { var s = slides(); return s.length > 1 ? s[1].offsetLeft - s[0].offsetLeft : track.clientWidth; }
      function pages() {
        var s = slides(); if (!s.length) return 0;
        var per = Math.max(1, Math.floor((track.clientWidth + 8) / step()));
        return Math.max(1, s.length - per + 1);
      }
      function index() {
        var s = slides(), x = track.scrollLeft, best = 0, dist = Infinity;
        s.forEach(function (el, i) { var dd = Math.abs(el.offsetLeft - s[0].offsetLeft - x); if (dd < dist) { dist = dd; best = i; } });
        return best;
      }
      function go(i) { var s = slides(); if (s[i]) track.scrollTo({ left: s[i].offsetLeft - s[0].offsetLeft, behavior: smooth() }); }
      function buildDots() {
        if (!dots) return;
        var n = pages();
        if (dots.children.length !== n) {
          dots.innerHTML = '';
          for (var i = 0; i < n; i++) {
            var b = document.createElement('button');
            b.type = 'button';
            b.className = 'pdcm-dot';
            b.setAttribute('aria-label', (dots.dataset.labelPrefix || 'Go to slide') + ' ' + (i + 1));
            (function (k) { b.addEventListener('click', function () { go(k); }); })(i);
            dots.appendChild(b);
          }
        }
        dots.hidden = n < 2;
      }
      function update() {
        var max = track.scrollWidth - track.clientWidth - 2;
        var scrollable = max > 0;
        rail.classList.toggle('is-scrollable', scrollable);
        if (prev) { prev.disabled = !scrollable || track.scrollLeft <= 2; prev.hidden = !scrollable; }
        if (next) { next.disabled = !scrollable || track.scrollLeft >= max; next.hidden = !scrollable; }
        if (dots) {
          buildDots();
          var i = track.scrollLeft >= max ? dots.children.length - 1 : Math.min(index(), dots.children.length - 1);
          Array.prototype.forEach.call(dots.children, function (b, k) { b.setAttribute('aria-current', k === i ? 'true' : 'false'); });
        }
      }
      if (prev) prev.addEventListener('click', function () { track.scrollBy({ left: -step(), behavior: smooth() }); });
      if (next) next.addEventListener('click', function () { track.scrollBy({ left: step(), behavior: smooth() }); });
      var raf;
      function later() { cancelAnimationFrame(raf); raf = requestAnimationFrame(update); }
      track.addEventListener('scroll', later, { passive: true });
      window.addEventListener('resize', later);
      document.addEventListener('pdcm:state', function () { track.scrollLeft = 0; later(); });
      rail.__pdcmUpdate = update;
      update();
    });
  }

  /* ---------------- accordion (+ open on #anchor) ---------------- */
  function setOpen(q, open) {
    q.setAttribute('aria-expanded', open ? 'true' : 'false');
    var panel = document.getElementById(q.getAttribute('aria-controls'));
    if (panel) panel.hidden = !open;
  }
  function initAccordions(root) {
    $$('[data-cm-accordion] [data-cm-q]', root).forEach(function (q) {
      if (!once(q, 'acc')) return;
      q.addEventListener('click', function () { setOpen(q, q.getAttribute('aria-expanded') !== 'true'); });
    });
    if (location.hash) openFaq(document.getElementById(decodeURIComponent(location.hash.slice(1))));
  }
  function openFaq(target) {
    if (!target || !target.hasAttribute('data-cm-faq')) return false;
    var q = $('[data-cm-q]', target);
    if (q) setOpen(q, true);
    return true;
  }

  /* ---------------- in-page jumps + "Choose color" jumps to a deal card ---------------- */
  function flash(el) {
    el.classList.add('is-flash');
    setTimeout(function () { el.classList.remove('is-flash'); }, 1200);
  }
  function jumpToCard(card) {
    var panel = card.closest('[role="tabpanel"]');
    var tabs = card.closest('[data-cm-tabs]');
    if (panel && panel.hidden && tabs && tabs.__pdcmSelect) {
      var tab = document.getElementById(panel.getAttribute('aria-labelledby'));
      if (tab) tabs.__pdcmSelect(tab);
    }
    var track = card.closest('[data-cm-track]');
    var slide = card.closest('.pdcm-rail__slide') || card;
    (tabs || card).scrollIntoView({ behavior: smooth(), block: 'start' });
    if (track) track.scrollTo({ left: slide.offsetLeft - track.firstElementChild.offsetLeft, behavior: smooth() });
    var focusEl = $('[data-cm-swatch][aria-checked="true"], [data-cm-select], [data-cm-atc]', card);
    setTimeout(function () { try { (focusEl || card).focus({ preventScroll: true }); } catch (e) {} flash(card); }, reduceMotion ? 0 : 450);
  }
  function initJumps(root) {
    $$('[data-cm-jump]', root).forEach(function (a) {
      if (!once(a, 'jump')) return;
      a.addEventListener('click', function (e) {
        var card = document.getElementById(a.getAttribute('data-cm-jump'));
        if (!card) return; // not in the deals: follow the product link
        // a card in an inactive tab is fine — open its tab; a card hidden by the sale state is not
        var panel = card.closest('[role="tabpanel"]'), tabs = card.closest('[data-cm-tabs]');
        var tab = panel && document.getElementById(panel.getAttribute('aria-labelledby'));
        if (panel && panel.hidden && tab && shown(tab) && tabs && tabs.__pdcmSelect) tabs.__pdcmSelect(tab);
        if (!shown(card)) return;
        e.preventDefault();
        jumpToCard(card);
      });
    });
  }
  document.addEventListener('click', function (e) {
    var a = e.target.closest('.pdcm a[href^="#"]');
    if (!a || e.defaultPrevented || a.hasAttribute('data-cm-jump')) return;
    var id = decodeURIComponent(a.getAttribute('href').slice(1));
    var target = id && document.getElementById(id);
    if (!target) return;
    e.preventDefault();
    openFaq(target);
    target.scrollIntoView({ behavior: smooth(), block: 'start' });
    if (!target.hasAttribute('tabindex')) target.setAttribute('tabindex', '-1');
    try { target.focus({ preventScroll: true }); } catch (err) {}
  });

  /* ---------------- lazy, muted gameplay video ----------------
     <video data-cm-lazy data-src=… [data-cm-start] [data-cm-end] [data-cm-autoplay="false"]>. Loads near the viewport,
     loops only the start–end window, never autoplays with reduced motion or Save-Data. */
  function canAutoplay(v) { return !reduceMotion && !saveData && v.dataset.cmAutoplay !== 'false'; }
  function load(v) { if (!v.getAttribute('src') && v.dataset.src) { v.src = v.dataset.src; v.load(); } }
  var videoIO = 'IntersectionObserver' in window ? new IntersectionObserver(function (entries) {
    entries.forEach(function (en) {
      var v = en.target;
      if (en.isIntersecting) {
        if (canAutoplay(v)) { load(v); var p = v.play(); if (p && p.catch) p.catch(function () {}); }
      } else if (!v.paused) v.pause();
    });
  }, { rootMargin: '120px 0px', threshold: 0.35 }) : null;

  function initVideos(root) {
    $$('video[data-cm-lazy]', root).forEach(function (v) {
      if (!once(v, 'video')) return;
      var start = parseFloat(v.dataset.cmStart) || 0, end = parseFloat(v.dataset.cmEnd) || 0;
      if (start || end) {
        v.addEventListener('loadedmetadata', function () { if (start) v.currentTime = start; });
        v.addEventListener('timeupdate', function () {
          if ((end && v.currentTime >= end) || (start && v.currentTime < start - 0.3)) v.currentTime = start;
        });
      }
      if (videoIO) videoIO.observe(v);
    });
    $$('[data-cm-video-toggle]', root).forEach(function (btn) {
      if (!once(btn, 'vtoggle')) return;
      var v = document.getElementById(btn.getAttribute('aria-controls'));
      if (!v) return;
      function sync() {
        btn.setAttribute('aria-pressed', v.paused ? 'false' : 'true');
        btn.setAttribute('aria-label', v.paused ? (btn.dataset.labelPlay || 'Play video') : (btn.dataset.labelPause || 'Pause video'));
        btn.classList.toggle('is-playing', !v.paused);
      }
      btn.addEventListener('click', function () {
        load(v);
        if (v.paused) { v.dataset.cmAutoplay = 'true'; var p = v.play(); if (p && p.catch) p.catch(function () {}); }
        else { v.dataset.cmAutoplay = 'false'; v.pause(); }
      });
      v.addEventListener('play', sync); v.addEventListener('pause', sync); sync();
    });
  }

  /* ---------------- mobile buy bar ----------------
     [data-cm-dock] mirrors the picker the shopper last touched (starting with [data-cm-dock-source]). It shows only
     once that picker's own add-to-cart has scrolled ABOVE the viewport, never while a [data-cm-dock-stop] section
     (deals, gifting, final) is on screen, and never while a drawer is open — so there are never two buy buttons. */
  var dock = { bar: null, src: null, past: false, stops: new Set(), io: null };
  function drawerOpen() { return !!document.querySelector('cart-drawer[open], drawer-component[open], menu-drawer[open], search-drawer[open], .drawer[open]'); }
  function syncDock() {
    if (!dock.bar || !dock.src) return;
    var srcBtn = $('[data-cm-atc]', dock.src);
    var btn = $('[data-cm-atc]', dock.bar);
    if (!srcBtn || !btn) return;
    var ok = !srcBtn.disabled && !!srcBtn.dataset.variantId;
    var name = $('[data-cm-dock-name]', dock.bar);
    var vName = $('[data-cm-pick-name]', dock.src);
    if (name) name.textContent = (dock.src.dataset.productTitle || '') + (vName && vName.textContent && vName.textContent !== 'Default Title' ? ' · ' + vName.textContent : '');
    var map = { '[data-cm-dock-now]': '[data-cm-pick-now]', '[data-cm-dock-was]': '[data-cm-pick-was]' };
    Object.keys(map).forEach(function (to) {
      var a = $(map[to], dock.src), b = $(to, dock.bar);
      if (!b) return;
      var txt = a && !a.hidden ? a.textContent.trim() : '';
      b.textContent = txt; b.hidden = !txt;
      if (to === '[data-cm-dock-now]' && a) b.classList.toggle('is-sale', a.classList.contains('is-sale'));
    });
    var img = $('[data-cm-dock-img]', dock.bar);
    var thumb = $('[data-cm-swatch][aria-checked="true"] img', dock.src) || $('[data-cm-pick-img] img, .pdcm-row__thumb img, .pdcm-card__media img', dock.src);
    if (img && thumb) { var u = thumb.currentSrc || thumb.src; if (u && img.getAttribute('src') !== u) img.src = u; }
    if (!btn.classList.contains('is-loading')) {
      btn.dataset.variantId = srcBtn.dataset.variantId || '';
      btn.dataset.productTitle = srcBtn.dataset.productTitle || '';
      btn.disabled = !ok;
      label(btn).textContent = ok ? (btn.dataset.labelAdd || 'Add to cart') : (btn.dataset.labelSoldout || 'Sold out');
    }
  }
  function updateDock() {
    if (!dock.bar) return;
    var ready = dock.bar.dataset.ready === 'true';
    var show = ready && dock.past && dock.stops.size === 0 && !drawerOpen();
    dock.bar.classList.toggle('is-visible', show);
    dock.bar.setAttribute('aria-hidden', show ? 'false' : 'true');
    if (show) dock.bar.removeAttribute('inert'); else dock.bar.setAttribute('inert', '');
    document.body.classList.toggle('pdcm-dock-on', show);
  }
  function watchSource() {
    if (!dock.src || !('IntersectionObserver' in window)) return;
    if (dock.io) dock.io.disconnect();
    var anchor = $('[data-cm-atc]', dock.src) || dock.src;
    dock.io = new IntersectionObserver(function (en) {
      var e = en[0];
      dock.past = !e.isIntersecting && e.boundingClientRect.bottom < 0; // scrolled past, not merely below the fold
      updateDock();
    });
    dock.io.observe(anchor);
  }
  function setDockSource(picker) {
    if (!dock.bar || !picker || picker === dock.src || picker.closest('[data-cm-dock]')) return;
    if (!$('[data-cm-atc]', picker)) return;
    dock.src = picker;
    dock.bar.dataset.ready = 'true';
    syncDock();
    watchSource();
  }
  function initDock() {
    var bar = $('[data-cm-dock]');
    if (!bar || !once(bar, 'dock')) return;
    dock.bar = bar;
    document.body.classList.add('pdcm-has-dock');
    var first = $('[data-cm-dock-source]');
    if (first) setDockSource(first);
    document.addEventListener('pdcm:variant', function (e) { var p = e.target.closest('[data-cm-picker]'); if (p === dock.src) syncDock(); else setDockSource(p); });
    document.addEventListener('click', function (e) { var b = e.target.closest('.pdcm [data-cm-atc]'); if (b && !b.closest('[data-cm-dock]')) setDockSource(b.closest('[data-cm-picker]')); }, true);
    if (!('IntersectionObserver' in window)) return;
    var stopIO = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) { if (en.isIntersecting) dock.stops.add(en.target); else dock.stops.delete(en.target); });
      updateDock();
    }, { rootMargin: '-1px 0px' }); // edge-adjacent sections don't count as "on screen"
    $$('[data-cm-dock-stop]').forEach(function (s) { stopIO.observe(s); });
    new MutationObserver(updateDock).observe(document.body, { attributes: true, attributeFilter: ['open'], subtree: true });
    updateDock();
  }

  /* ---------------- boot ---------------- */
  function init(root) {
    startClock();
    initPickers(root);
    initMirror(root);
    initTierSave(root);
    initRails(root);
    initTabs(root);
    initFilters(root);
    initAccordions(root);
    initJumps(root);
    initVideos(root);
    initDock();
  }

  window.PopdartsCM = { init: init, tick: tick, syncDock: syncDock };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', function () { init(document); });
  else init(document);

  // Theme editor: re-wire sections as they're added/re-rendered.
  document.addEventListener('shopify:section:load', function (e) {
    if (e.target.querySelector('script[data-cm-clock]')) { clearInterval(clock.timer); clock.timer = null; }
    init(e.target);
  });
  // Theme editor: a selected block that sits in a closed tab or behind a filter is brought into view.
  document.addEventListener('shopify:block:select', function (e) {
    var el = e.target;
    if (!el || !el.closest) return;
    var panel = el.closest('[role="tabpanel"]'), tabs = panel && panel.closest('[data-cm-tabs]');
    if (panel && panel.hidden && tabs && tabs.__pdcmSelect) {
      var tab = document.getElementById(panel.getAttribute('aria-labelledby'));
      if (tab) tabs.__pdcmSelect(tab);
    }
    var item = el.closest('[data-cm-group]'), wrap = item && item.closest('[data-cm-filter]');
    if (item && item.hidden && wrap && wrap.__pdcmShowAll) wrap.__pdcmShowAll();
  });
  document.addEventListener('shopify:section:unload', function (e) {
    if (dock.bar && e.target.contains(dock.bar)) {
      if (dock.io) dock.io.disconnect();
      dock.bar = dock.src = null;
      dock.stops = new Set();
      document.body.classList.remove('pdcm-has-dock', 'pdcm-dock-on');
    }
  });
})();
