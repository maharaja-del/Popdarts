if (!customElements.get('featured-collection')) {
  customElements.define(
    'featured-collection',
    class FeaturedCollection extends HTMLElement {
      constructor() {
        super();
      }

      connectedCallback() {
        this.selectors = {
          sliderWrapper: '.featured-collection__items',
          nextEl: '.swiper-button-next',
          prevEl: '.swiper-button-prev',
        };
        this.classes = {
          grid: 'f-grid',
          swiper: 'swiper',
          swiperWrapper: 'swiper-wrapper',
        };

        this.sectionId = this.dataset.sectionId;
        this.section = this.closest(`.section-${this.sectionId}`);
        this.sliderWrapper = this.querySelector(this.selectors.sliderWrapper);

        this.enableSlider = this.dataset.enableSlider === 'true';
        this.items = parseInt(this.dataset.items);
        this.tabletItems = parseInt(this.dataset.tabletItems);

        this.sliderInstance = false;

        if (!this.enableSlider) return;

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

        const columnGap = window.getComputedStyle(this.sliderWrapper).getPropertyValue('--column-gap');
        const spaceBetween = parseFloat(columnGap.replace('rem', '')) * 10;

        this.sliderOptions = {
          modules: [FoxTheme.Swiper.Navigation, FoxTheme.Swiper.Pagination],
          slidesPerView: this.tabletItems > 3 ? 3 : parseInt(this.tabletItems),
          spaceBetween: spaceBetween,
          navigation: {
            nextEl: this.section.querySelector(this.selectors.nextEl),
            prevEl: this.section.querySelector(this.selectors.prevEl),
          },
          pagination: false,
          breakpoints: {
            1280: {
              slidesPerView: parseInt(this.items),
            },
          },
          loop: true,
          threshold: 2,
        };

        this.classList.add(this.classes.swiper);
        this.sliderWrapper.classList.remove(this.classes.grid);
        this.sliderWrapper.classList.add(this.classes.swiperWrapper);

        this.sliderInstance = new window.FoxTheme.Carousel(this, this.sliderOptions);
        this.sliderInstance.init();

        this.calcNavButtonsPosition();
        this.calcHeadingColumnHeight();
        this.fixQuickviewDuplicate();
      }

      destroySlider() {
        this.classList.remove(this.classes.swiper);
        this.sliderWrapper.classList.remove(this.classes.swiperWrapper);
        this.sliderWrapper.classList.add(this.classes.grid);
        if (typeof this.sliderInstance !== 'object') return;
        this.sliderInstance.slider.destroy();
        this.sliderInstance = false;
      }

      calcNavButtonsPosition() {
        if (this.dataset.calcButtonPosition !== 'true') return;

        const firstMedia = this.querySelector('.product-card__image-wrapper');
        if (firstMedia && firstMedia.clientHeight > 0) {
          this.section.style.setProperty(
            '--swiper-navigation-top-offset',
            parseInt(firstMedia.clientHeight) / 2 + 'px'
          );
        }
      }

      calcHeadingColumnHeight() {
        if (this.dataset.calcHeadingColumnHeight !== 'true') return;

        const firstMedia = this.querySelector('.product-card__image-wrapper');
        if (firstMedia && firstMedia.clientHeight > 0) {
          this.section.style.setProperty('--heading-column-height', firstMedia.clientHeight + 'px');
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
