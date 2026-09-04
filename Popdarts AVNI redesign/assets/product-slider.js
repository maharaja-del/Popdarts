/**
 * Using for recomendation products and recent view products
 */
if (!customElements.get('product-slider')) {
  customElements.define(
    'product-slider',
    class ProductSlider extends HTMLElement {
      constructor() {
        super();
      }

      connectedCallback() {
        this.selectors = {
          productsWrap: '.products-grid-wrap',
          products: '.products-grid',
        };
        this.classes = {
          grid: 'f-grid',
          swiper: 'swiper',
          swiperWrapper: 'swiper-wrapper',
        };

        this.sectionId = this.dataset.sectionId;
        this.elements = FoxTheme.utils.queryDomNodes(this.selectors, this);
        this.elements.section = this.closest(`.section-${this.sectionId}`);

        this.enableSlider = this.dataset.enableSlider === 'true';
        this.items = parseInt(this.dataset.items);
        this.tabletItems = parseInt(this.dataset.tabletItems);

        this.sliderInstance = false;

        if (!this.enableSlider) return;

        if (!this.elements.productsWrap || !this.elements.products) return;

        const mql = window.matchMedia(FoxTheme.config.mediaQueryMobile);
        mql.onchange = this.init.bind(this);
        this.init();
      }

      init() {
        if (FoxTheme.config.mqlMobile) {
          this.destroySlider();
        } else {
          this.initSlider();
        }
      }

      initSlider() {
        if (typeof this.sliderInstance === 'object') return;

        this.calcNavButtonsPosition();

        const columnGap = window.getComputedStyle(this.elements.products).getPropertyValue('--column-gap');
        const spaceBetween = parseFloat(columnGap.replace('rem', '')) * 10;

        this.sliderOptions = {
          slidesPerView: this.tabletItems > 3 ? 3 : parseInt(this.tabletItems),
          spaceBetween: spaceBetween,
          navigation: {
            nextEl: this.elements.section.querySelector('.swiper-button-next'),
            prevEl: this.elements.section.querySelector('.swiper-button-prev'),
          },
          breakpoints: {
            1280: {
              slidesPerView: parseInt(this.items),
            },
          },
          loop: true,
          threshold: 2,
        };

        this.elements.productsWrap.classList.add(this.classes.swiper);
        this.elements.products.classList.remove(this.classes.grid);
        this.elements.products.classList.add(this.classes.swiperWrapper);

        this.sliderInstance = new window.FoxTheme.Carousel(this.elements.productsWrap, this.sliderOptions);
        this.sliderInstance.init();
        this.handleAccessibility();
        this.fixQuickviewDuplicate();
      }

      handleAccessibility() {
        const focusableElements = FoxTheme.a11y.getFocusableElements(this);

        focusableElements.forEach((element) => {
          element.addEventListener('focusin', (event) => {
            if (event.relatedTarget !== null) {
              if (element.closest('.swiper-slide')) {
                const slide = element.closest('.swiper-slide');
                this.sliderInstance.slider.slideTo(this.sliderInstance.slider.slides.indexOf(slide));
              }
            } else {
              element.blur();
            }
          });
        });
      }

      destroySlider() {
        this.elements.productsWrap.classList.remove(this.classes.swiper);
        this.elements.products.classList.remove(this.classes.swiperWrapper);
        this.elements.products.classList.add(this.classes.grid);
        if (typeof this.sliderInstance !== 'object') return;
        this.sliderInstance.slider.destroy();
        this.sliderInstance = false;
      }

      calcNavButtonsPosition() {
        if (!this.dataset.calcButtonPosition === 'true') return;

        const firstMedia = this.querySelector('.product-card__image-wrapper');
        if (firstMedia && firstMedia.clientHeight > 0) {
          this.elements.section.style.setProperty(
            '--swiper-navigation-top-offset',
            parseInt(firstMedia.clientHeight) / 2 + 'px'
          );
        }
      }

      fixQuickviewDuplicate() {
        let modalIds = [];
        Array.from(this.querySelectorAll('quick-view-modal')).forEach((modal) => {
          const modalID = modal.getAttribute('id');
          if (modalIds.includes(modalID)) {
            modal.remove();
          } else {
            modalIds.push(modalID);
          }
        });
      }
    }
  );
}
