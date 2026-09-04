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
     SCROLL REVEAL — fade/rise sections in as they enter view.
     Belt-and-suspenders against ever getting stuck invisible:
     a 2.5s timeout force-reveals anything the observer hasn't
     caught yet (slow layout, an element that never intersects,
     browser quirks), regardless of what triggered it.
     ============================================================ */
  function initReveal() {
    if (prefersReducedMotion) return;
    // `section.pd-page`, not `.pd-page section` — the sections ARE the
    // .pd-page elements; the descendant form matched nothing (see CSS).
    const targets = Array.from(document.querySelectorAll("section.pd-page:not(.hero):not(.home-hero)")).filter(
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
    // Reveal goes first and every init is isolated: a throw in one
    // feature must never leave the page's sections sitting at opacity 0.
    [initReveal, initSliders, initVideoSlides, fitLines].forEach((fn) => {
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
