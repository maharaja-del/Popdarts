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
     AVATARS — "Pick Your Player" tabbed stage.
     Desktop (>900px): tabs swap a stacked card deck; optional
     autoplay drives a CSS progress bar and pauses on hover, on
     keyboard focus, and whenever the section scrolls out of view.
     Mobile: the deck is a native swipe track — swiping updates the
     active tab, tapping a tab scrolls the track. Both directions
     stay in sync without ever scrolling the page itself.
     ============================================================ */
  function initAvatars() {
    document.querySelectorAll("[data-avatars]").forEach((root) => {
      if (root.__pdAvatarsInit) return;
      root.__pdAvatarsInit = true;

      const tabsEl = root.querySelector("[data-avatar-tabs]");
      const stage = root.querySelector("[data-avatar-stage]");
      const tabs = Array.from(root.querySelectorAll("[data-avatar-tab]"));
      const cards = Array.from(root.querySelectorAll("[data-avatar-card]"));
      if (!tabsEl || !stage || !tabs.length || tabs.length !== cards.length) return;

      const desktop = window.matchMedia("(min-width: 901px)");
      const autoplay = root.dataset.autoplay === "true" && !prefersReducedMotion;
      const interval = Math.max(3000, parseInt(root.dataset.interval, 10) || 6000);
      const behavior = prefersReducedMotion ? "auto" : "smooth";

      let index = 0;
      let timer = null;
      let hovered = false;
      let focused = false;
      let inView = false;
      let syncing = false;
      let syncTimer = null;

      const render = () => {
        tabs.forEach((t, n) => {
          const on = n === index;
          t.classList.toggle("is-active", on);
          t.setAttribute("aria-selected", on ? "true" : "false");
          t.tabIndex = on ? 0 : -1;
        });
        cards.forEach((c, n) => {
          const on = n === index;
          c.classList.toggle("is-active", on);
          if (desktop.matches) c.setAttribute("aria-hidden", on ? "false" : "true");
          else c.removeAttribute("aria-hidden");
        });
      };

      /* Keep the active pill centred in the strip (mobile only). Uses
         scrollLeft rather than scrollIntoView so the page never jumps. */
      const centerTab = () => {
        if (desktop.matches) return;
        const t = tabs[index];
        tabsEl.scrollTo({ left: t.offsetLeft - (tabsEl.clientWidth - t.offsetWidth) / 2, behavior });
      };

      const scrollStage = () => {
        if (desktop.matches) return;
        const c = cards[index];
        const pad = parseFloat(getComputedStyle(stage).paddingLeft) || 0;
        syncing = true;
        clearTimeout(syncTimer);
        syncTimer = setTimeout(() => (syncing = false), 700);
        stage.scrollTo({ left: c.offsetLeft - pad, behavior });
      };

      const stop = () => {
        clearTimeout(timer);
        timer = null;
        root.classList.remove("is-autoplay");
      };
      const play = () => {
        stop();
        if (!autoplay || !desktop.matches || hovered || focused || !inView) return;
        void root.offsetWidth; // restart the progress-bar animation from zero
        root.classList.add("is-autoplay");
        timer = setTimeout(() => setActive(index + 1), interval);
      };

      const setActive = (i, opts) => {
        index = ((i % cards.length) + cards.length) % cards.length;
        render();
        if (!opts || opts.scroll !== false) scrollStage();
        centerTab();
        play();
      };

      tabs.forEach((t, n) => {
        t.addEventListener("click", () => setActive(n));
        t.addEventListener("keydown", (e) => {
          let next = null;
          if (e.key === "ArrowRight" || e.key === "ArrowDown") next = index + 1;
          else if (e.key === "ArrowLeft" || e.key === "ArrowUp") next = index - 1;
          else if (e.key === "Home") next = 0;
          else if (e.key === "End") next = cards.length - 1;
          if (next === null) return;
          e.preventDefault();
          setActive(next);
          tabs[index].focus();
        });
      });

      /* Mobile: follow the swipe — whichever card is nearest the centre wins */
      let raf = null;
      stage.addEventListener(
        "scroll",
        () => {
          if (desktop.matches || syncing || raf) return;
          raf = requestAnimationFrame(() => {
            raf = null;
            const mid = stage.scrollLeft + stage.clientWidth / 2;
            let best = 0;
            let bestDist = Infinity;
            cards.forEach((c, n) => {
              const d = Math.abs(c.offsetLeft + c.offsetWidth / 2 - mid);
              if (d < bestDist) {
                bestDist = d;
                best = n;
              }
            });
            if (best !== index) setActive(best, { scroll: false });
          });
        },
        { passive: true }
      );

      root.addEventListener("pointerenter", (e) => {
        if (e.pointerType !== "mouse") return;
        hovered = true;
        stop();
      });
      root.addEventListener("pointerleave", (e) => {
        if (e.pointerType !== "mouse") return;
        hovered = false;
        play();
      });
      root.addEventListener("focusin", () => {
        focused = true;
        stop();
      });
      root.addEventListener("focusout", (e) => {
        if (root.contains(e.relatedTarget)) return;
        focused = false;
        play();
      });

      if ("IntersectionObserver" in window) {
        new IntersectionObserver(
          (entries) => {
            inView = entries[0].isIntersecting;
            inView ? play() : stop();
          },
          { threshold: 0.3 }
        ).observe(root);
      } else {
        inView = true;
        play();
      }

      const onLayoutChange = () => {
        syncing = false;
        render();
        play();
      };
      if (desktop.addEventListener) desktop.addEventListener("change", onLayoutChange);
      else desktop.addListener(onLayoutChange);

      render();
    });
  }

  /* ============================================================
     SCROLL REVEAL — fade/rise sections in as they enter view.
     Belt-and-suspenders against ever getting stuck invisible:
     a 2.5s timeout force-reveals anything the observer hasn't
     caught yet (slow layout, an element that never intersects,
     browser quirks), regardless of what triggered it.
     ============================================================ */
  function initReveal() {
    if (prefersReducedMotion) return;
    const targets = Array.from(document.querySelectorAll(".pd-page section:not(.hero):not(.home-hero)")).filter(
      (el) => !el.__pdRevealInit
    );
    if (!targets.length) return;
    targets.forEach((el) => (el.__pdRevealInit = true));

    const reveal = (el) => el.classList.add("is-visible");

    if ("IntersectionObserver" in window) {
      const io = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (entry.isIntersecting) {
              reveal(entry.target);
              io.unobserve(entry.target);
            }
          });
        },
        { threshold: 0.12, rootMargin: "0px 0px -8% 0px" }
      );
      targets.forEach((el) => io.observe(el));
    } else {
      targets.forEach(reveal);
    }

    setTimeout(() => targets.forEach(reveal), 2500);
  }

  /* ============================================================
     INIT — runs on first paint and again on Shopify section
     load/reorder events, so the customizer never leaves a
     newly-added section unwired
     ============================================================ */
  function initAll() {
    initSliders();
    initVideoSlides();
    initAvatars();
    initReveal();
  }

  document.addEventListener("DOMContentLoaded", initAll);
  document.addEventListener("shopify:section:load", initAll);
  document.addEventListener("shopify:section:reorder", initAll);
})();
