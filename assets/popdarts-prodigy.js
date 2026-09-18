(() => {
  "use strict";

  if (window.__pdProdigyInit) return;
  window.__pdProdigyInit = true;

  const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* Marks the page as JS-confirmed-running before anything else, so the
     CSS opacity:0 reveal rule (scoped to html.pd-js) can never apply
     unless this script actually executed. */
  document.documentElement.classList.add("pd-js");

  /* ============================================================
     SLIDERS — competition + offer product gallery
     ============================================================ */
  class Slider {
    constructor(root) {
      this.root = root;
      this.track = root.querySelector("[data-slider-track]");
      this.prevBtn = root.querySelector("[data-slider-prev]");
      this.nextBtn = root.querySelector("[data-slider-next]");
      if (!this.track) return;
      this.slides = Array.from(this.track.children);
      this.moved = false;
      this.bind();
      this.update();
    }

    bind() {
      this.prevBtn && this.prevBtn.addEventListener("click", () => this.scrollByOne(-1));
      this.nextBtn && this.nextBtn.addEventListener("click", () => this.scrollByOne(1));

      this.track.addEventListener(
        "scroll",
        () => {
          if (this._raf) return;
          this._raf = requestAnimationFrame(() => {
            this.update();
            this._raf = null;
          });
        },
        { passive: true }
      );

      this.track.addEventListener("keydown", (e) => {
        if (e.key === "ArrowRight") {
          e.preventDefault();
          this.scrollByOne(1);
        } else if (e.key === "ArrowLeft") {
          e.preventDefault();
          this.scrollByOne(-1);
        }
      });

      let isDown = false;
      let startX = 0;
      let startScroll = 0;

      this.track.addEventListener("pointerdown", (e) => {
        if (e.pointerType === "touch") return;
        if (e.target.closest("button, a")) return;
        isDown = true;
        this.moved = false;
        startX = e.clientX;
        startScroll = this.track.scrollLeft;
        this.track.setPointerCapture(e.pointerId);
      });
      this.track.addEventListener("pointermove", (e) => {
        if (!isDown) return;
        const dx = e.clientX - startX;
        if (Math.abs(dx) > 4) this.moved = true;
        this.track.scrollLeft = startScroll - dx;
      });
      const release = () => {
        isDown = false;
      };
      this.track.addEventListener("pointerup", release);
      this.track.addEventListener("pointercancel", release);
      this.track.addEventListener(
        "click",
        (e) => {
          if (this.moved) {
            e.preventDefault();
            e.stopPropagation();
          }
        },
        true
      );
    }

    scrollByOne(dir) {
      const slide = this.slides[0];
      if (!slide) return;
      const gap = parseFloat(getComputedStyle(this.track).gap) || 20;
      const width = slide.getBoundingClientRect().width + gap;
      this.track.scrollBy({ left: dir * width, behavior: prefersReducedMotion ? "auto" : "smooth" });
    }

    update() {
      const { scrollLeft, scrollWidth, clientWidth } = this.track;
      if (this.prevBtn) this.prevBtn.disabled = scrollLeft <= 4;
      if (this.nextBtn) this.nextBtn.disabled = scrollLeft + clientWidth >= scrollWidth - 4;
    }
  }

  function initSliders() {
    document.querySelectorAll("[data-slider]").forEach((el) => {
      if (!el.__pdSliderInit) {
        el.__pdSliderInit = true;
        new Slider(el);
      }
    });
  }

  /* ============================================================
     VIDEO SLIDES — click to play/pause
     ============================================================ */
  function initVideoSlides() {
    const videos = Array.from(document.querySelectorAll("[data-slide-video]"));
    videos.forEach((video) => {
      if (video.__pdVideoInit) return;
      video.__pdVideoInit = true;
      const article = video.closest(".slide");
      const btn = article.querySelector("[data-slide-playbtn]");
      if (!btn) return;
      btn.addEventListener("click", () => {
        if (video.paused) {
          videos.forEach((v) => {
            if (v !== video && !v.paused) {
              v.pause();
              v.currentTime = 0;
              const b = v.closest(".slide").querySelector("[data-slide-playbtn]");
              if (b) b.removeAttribute("data-playing");
            }
          });
          video.play();
          btn.setAttribute("data-playing", "");
        } else {
          video.pause();
          btn.removeAttribute("data-playing");
        }
      });
      video.addEventListener("ended", () => btn.removeAttribute("data-playing"));
      video.addEventListener("pause", () => btn.removeAttribute("data-playing"));
    });
  }

  /* ============================================================
     INSTAGRAM REEL WALL — click a tile to open a full-screen,
     Reels-style player. The tile videos stay muted/looping in place;
     the modal video gets the real src set on open (so it isn't
     downloaded twice) and plays with sound since it's a real click.
     ============================================================ */
  function initInstagramReels() {
    const modal = document.querySelector("[data-ig-modal]");
    const tiles = Array.from(document.querySelectorAll("[data-ig-open]"));
    if (!modal || !tiles.length) return;
    if (modal.__pdIgInit) return;
    modal.__pdIgInit = true;

    // Shopify wraps every section in its own .shopify-section element, and
    // the theme has a content-visibility:auto rule that can apply to those
    // wrappers during initial load — that property forces a new containing
    // block, which would trap this fixed-position modal inside the section
    // and stop it from ever covering the header, no matter the z-index.
    // Moving it to be a direct child of <body> rules that out entirely.
    if (modal.parentElement !== document.body) {
      document.body.appendChild(modal);
    }

    const video = modal.querySelector("[data-ig-modal-video]");
    const backdrop = modal.querySelector(".pd-ig-modal__backdrop");
    const closeEls = modal.querySelectorAll("[data-ig-close]");
    let lastFocus = null;

    // Belt-and-suspenders: force the dark overlay via inline style too, so
    // it can't be silently lost to a stylesheet load/cache issue — inline
    // styles win over any non-!important CSS rule regardless of source order.
    const paintBackdrop = () => {
      if (!backdrop) return;
      backdrop.style.position = "absolute";
      backdrop.style.inset = "0";
      backdrop.style.zIndex = "0";
      backdrop.style.backgroundColor = "#06070a";
      backdrop.style.opacity = "0.92";
    };

    const open = (src) => {
      lastFocus = document.activeElement;
      paintBackdrop();
      video.src = src;
      modal.hidden = false;
      document.body.classList.add("pd-ig-modal-open");
      video.currentTime = 0;
      video.muted = false;
      video.play().catch(() => {
        // Autoplay-with-sound can be blocked; fall back to muted so it still plays.
        video.muted = true;
        video.play().catch(() => {});
      });
    };

    const close = () => {
      modal.hidden = true;
      document.body.classList.remove("pd-ig-modal-open");
      video.pause();
      video.removeAttribute("src");
      video.load();
      if (lastFocus && typeof lastFocus.focus === "function") lastFocus.focus();
    };

    tiles.forEach((tile) => {
      tile.addEventListener("click", () => open(tile.dataset.igSrc));
    });
    closeEls.forEach((el) => el.addEventListener("click", close));
    video.addEventListener("click", () => {
      if (video.paused) video.play();
      else video.pause();
    });
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && !modal.hidden) close();
    });
  }

  /* ============================================================
     HW AUTO SLIDE — crossfading image slider used by the Halloween buy
     box and "what's in the box" photo (toggles .is-active between the
     img children of [data-hw-autoslide]). Prev/next arrows are siblings
     of that element, not children of it, so they never get mistaken for
     a slide; clicking one restarts the auto-advance timer. Static on the
     first image when reduced motion is requested or there's only one.
     ============================================================ */
  function initHwAutoSlide() {
    document.querySelectorAll("[data-hw-autoslide]").forEach((el) => {
      if (el.__pdHwSlideInit) return;
      el.__pdHwSlideInit = true;
      const slides = Array.from(el.children).filter((c) => c.tagName === "IMG");
      if (slides.length < 2) return;
      let i = 0;
      let timer = null;

      const show = (n) => {
        slides[i].classList.remove("is-active");
        i = (n + slides.length) % slides.length;
        slides[i].classList.add("is-active");
      };
      const stop = () => {
        if (timer) clearInterval(timer);
        timer = null;
      };
      const start = () => {
        stop();
        if (prefersReducedMotion) return;
        timer = setInterval(() => show(i + 1), 3800);
      };

      const scope = el.parentElement;
      const prevBtn = scope && scope.querySelector("[data-hw-prev]");
      const nextBtn = scope && scope.querySelector("[data-hw-next]");
      if (prevBtn) prevBtn.addEventListener("click", () => { show(i - 1); start(); });
      if (nextBtn) nextBtn.addEventListener("click", () => { show(i + 1); start(); });

      start();
    });
  }

  /* ============================================================
     HALLOWEEN CARD — flashlight follows the pointer (CSS vars --hw-mx/
     --hw-my), the card tilts toward it and the artwork shifts for a
     little parallax. With no pointer the card keeps .is-auto and CSS
     drifts the light on its own. Touch devices: no tilt, light follows
     a finger drag. Plus a live "Sale ends in" countdown.
     ============================================================ */
  function initHalloween() {
    document.querySelectorAll("[data-hw-card]").forEach((card) => {
      if (card.__pdHwInit) return;
      card.__pdHwInit = true;
      const canHover = window.matchMedia("(hover: hover)").matches;
      const tilt = card.dataset.hwTilt !== "off"; // hero: flashlight + parallax, no tilt
      let raf = null;
      let last = null;

      const apply = () => {
        raf = null;
        if (!last) return;
        const r = card.getBoundingClientRect();
        const x = Math.min(Math.max((last.x - r.left) / r.width, 0), 1);
        const y = Math.min(Math.max((last.y - r.top) / r.height, 0), 1);
        card.style.setProperty("--hw-mx", (x * 100).toFixed(2) + "%");
        card.style.setProperty("--hw-my", (y * 100).toFixed(2) + "%");
        if (canHover && !prefersReducedMotion) {
          card.style.setProperty("--hw-px", ((x - 0.5) * -16).toFixed(1) + "px");
          card.style.setProperty("--hw-py", ((y - 0.5) * -10).toFixed(1) + "px");
          if (tilt) {
            card.style.setProperty("--hw-rx", ((x - 0.5) * 6).toFixed(2) + "deg");
            card.style.setProperty("--hw-ry", ((0.5 - y) * 5).toFixed(2) + "deg");
          }
        }
      };
      const onMove = (e) => {
        last = { x: e.clientX, y: e.clientY };
        card.classList.remove("is-auto");
        card.classList.add("is-hover");
        if (!raf) raf = requestAnimationFrame(apply);
      };
      const onLeave = () => {
        last = null;
        card.classList.remove("is-hover");
        ["--hw-mx", "--hw-my", "--hw-rx", "--hw-ry", "--hw-px", "--hw-py"].forEach((v) => card.style.removeProperty(v));
        card.classList.add("is-auto");
      };
      card.addEventListener("pointermove", onMove);
      card.addEventListener("pointerleave", onLeave);
      card.addEventListener("pointercancel", onLeave);
      card.addEventListener("pointerup", (e) => {
        if (e.pointerType !== "mouse") setTimeout(onLeave, 900);
      });
    });

    document.querySelectorAll("[data-hw-countdown]").forEach((el) => {
      if (el.__pdHwCd) return;
      el.__pdHwCd = true;
      const end = new Date(el.dataset.end).getTime();
      const out = el.querySelector("[data-hw-countdown-value]");
      if (isNaN(end) || !out) return;
      const pad = (n) => String(n).padStart(2, "0");
      const tick = () => {
        const left = end - Date.now();
        if (left <= 0) {
          el.textContent = el.dataset.ended || "";
          return;
        }
        const d = Math.floor(left / 864e5);
        const h = Math.floor((left % 864e5) / 36e5);
        const m = Math.floor((left % 36e5) / 6e4);
        out.textContent = (d > 0 ? d + "d " : "") + pad(h) + "h " + pad(m) + "m";
        setTimeout(tick, 30000);
      };
      tick();
    });
  }

  /* ============================================================
     ADD TO CART — [data-pd-atc][data-variant-id]: adds one unit via
     /cart/add.js, tells the theme's cart drawer, and shows "Added".
     Anything without a variant id is a plain link to the product.
     ============================================================ */
  function initAtc() {
    if (document.__pdAtcInit) return;
    document.__pdAtcInit = true;
    document.addEventListener("click", (e) => {
      const btn = e.target.closest("[data-pd-atc]");
      if (!btn) return;
      const id = parseInt(btn.dataset.variantId, 10);
      if (!id) return;
      e.preventDefault();
      if (btn.classList.contains("is-busy")) return;
      const label = btn.querySelector("[data-pd-atc-label]") || btn;
      const original = label.textContent;
      btn.classList.add("is-busy");
      label.textContent = "Adding…";
      fetch("/cart/add.js", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ items: [{ id, quantity: 1 }] }),
      })
        .then((res) => {
          if (!res.ok) throw new Error("add failed");
          return fetch("/cart.js").then((r) => r.json());
        })
        .then((cart) => {
          btn.classList.remove("is-busy");
          btn.classList.add("is-done");
          label.textContent = "Added to cart ✓";
          document.querySelectorAll("[data-cart-count], .cart-count, .cart-count-bubble, [data-header-cart-count]").forEach((el) => {
            el.textContent = cart.item_count;
          });
          ["cart:refresh", "cart:change", "cart:build", "cart-drawer:refresh"].forEach((name) => {
            document.documentElement.dispatchEvent(new CustomEvent(name, { bubbles: true, detail: { cart } }));
          });
          setTimeout(() => {
            btn.classList.remove("is-done");
            label.textContent = original;
          }, 2600);
        })
        .catch(() => {
          btn.classList.remove("is-busy");
          label.textContent = original;
          if (btn.getAttribute("href")) window.location.href = btn.getAttribute("href");
        });
    });
  }

  /* ============================================================
     STICKY MOBILE CTA — shows once the hero has left the viewport,
     hides while the final CTA or footer is in view. CSS limits it to
     small screens; this only toggles the class.
     ============================================================ */
  function initStickyCta() {
    const bar = document.querySelector("[data-sticky-cta]");
    if (!bar || bar.__pdStickyInit) return;
    bar.__pdStickyInit = true;
    if (!("IntersectionObserver" in window)) return;
    const hero = bar.closest(".hero") || document.querySelector(".hero");
    if (!hero) return;
    const enders = Array.from(document.querySelectorAll(".final, .pd-footer, .shopify-section-group-footer-group"));
    let heroIn = true;
    const enderIn = new Set();
    const update = () => bar.classList.toggle("is-on", !heroIn && enderIn.size === 0);
    new IntersectionObserver(
      (entries) => {
        heroIn = entries[0].isIntersecting;
        update();
      },
      { threshold: 0.04 }
    ).observe(hero);
    if (enders.length) {
      const io = new IntersectionObserver(
        (entries) => {
          entries.forEach((e) => (e.isIntersecting ? enderIn.add(e.target) : enderIn.delete(e.target)));
          update();
        },
        { threshold: 0.05 }
      );
      enders.forEach((el) => io.observe(el));
    }
  }

  /* ============================================================
     FIT LINES — any [data-fit-line] is a single no-wrap line; if it's
     wider than its container, step its font-size down (to a floor)
     until it fits. Re-run on resize. Keeps headlines at exactly the
     number of lines the markup says, whatever the copy length.
     ============================================================ */
  function fitLines() {
    document.querySelectorAll("[data-fit-line]").forEach((el) => {
      el.style.fontSize = "";
      const parent = el.parentElement;
      if (!parent) return;
      const max = parent.clientWidth;
      if (!max) return;
      let size = parseFloat(getComputedStyle(el).fontSize);
      const floor = 16;
      let guard = 40;
      while (el.scrollWidth > max && size > floor && guard--) {
        size -= 1;
        el.style.fontSize = size + "px";
      }
    });
  }
  let fitRaf = null;
  window.addEventListener("resize", () => {
    if (fitRaf) return;
    fitRaf = requestAnimationFrame(() => {
      fitRaf = null;
      fitLines();
    });
  });
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(fitLines);

  /* ============================================================
     INIT — runs on first paint and again on Shopify section
     load/reorder events, so the customizer never leaves a
     newly-added section unwired
     ============================================================ */
  function initAll() {
    // Every init is isolated so a throw in one feature can't block the rest.
    [initSliders, initVideoSlides, initInstagramReels, initHwAutoSlide, fitLines, initStickyCta, initHalloween, initAtc].forEach((fn) => {
      try {
        fn();
      } catch (err) {
        if (window.console) console.warn("[popdarts-prodigy]", fn.name, err);
      }
    });
  }

  // This script is loaded from inside the hero section. If the theme
  // renders that section after the document has already finished
  // loading, DOMContentLoaded has come and gone — so run now in that
  // case, and always take a second pass on window load (initAll is
  // idempotent) to catch sections parsed after the first pass.
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initAll);
  } else {
    initAll();
  }
  window.addEventListener("load", initAll);
  document.addEventListener("shopify:section:load", initAll);
  document.addEventListener("shopify:section:reorder", initAll);
})();
