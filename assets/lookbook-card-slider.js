if (!customElements.get('lookbook-card-slider')) {
  customElements.define(
    'lookbook-card-slider',
    class LookbookCardSlider extends HTMLElement {
      constructor() {
        super();
      }

      connectedCallback() {
        this.sliderWrapper = this.querySelector('.swiper');
        if (!this.sliderWrapper) {
          return;
        }

        this.lookbookIcons = this.querySelectorAll('lookbook-icon');
        this.productCards = this.querySelectorAll('.product-card');
        this.sliderInstance = false;
        this.initSlider();

        Array.from(this.lookbookIcons).forEach((icon) => {
          icon.addEventListener('mouseover', this.onMouseOver.bind(this));
          icon.addEventListener('mouseleave', this.onMouseLeave.bind(this));
        });
      }

      disconnectedCallback() {
        Array.from(this.lookbookIcons).forEach((icon) => {
          icon.removeEventListener('mouseover', this.onMouseOver.bind(this));
          icon.removeEventListener('mouseleave', this.onMouseLeave.bind(this));
        });
      }

      initSlider() {
        const items = parseInt(this.dataset.items);
        const columnGap = window.getComputedStyle(this.sliderWrapper).getPropertyValue('--column-gap');
        const spaceBetween = parseFloat(columnGap.replace('rem', '')) * 10;

        this.sliderOptions = {
          init: false,
          slidesPerView: 1,
          spaceBetween: spaceBetween,
          breakpoints: {
            768: {
              slidesPerView: items,
            },
          },
          navigation: {
            nextEl: this.querySelector('.swiper-button-next'),
            prevEl: this.querySelector('.swiper-button-prev'),
          },
          pagination: {
            el: this.querySelector('.swiper-pagination'),
            clickable: true,
          },
          speed: 500,
          loop: true,
          threshold: 2,
        };

        this.sliderCounter = this.querySelector('.swiper-pagination-counter');
        this.sliderWrapper.querySelector('.swiper-wrapper').classList.remove('f-grid');

        this.calcNavButtonsPosition();

        this.sliderInstance = new window.FoxTheme.Carousel(this.sliderWrapper, this.sliderOptions);
        this.sliderInstance.init();

        this.sliderInstance.slider.on('afterInit', this.onSlideAfterInit.bind(this));
        this.sliderInstance.slider.on('realIndexChange', this.onSlideChange.bind(this));

        this.sliderInstance.slider.init();

        this.fixQuickviewDuplicate();
      }

      calcNavButtonsPosition() {
        if (this.dataset.calcButtonPosition !== 'true') return;

        const firstMedia = this.querySelector('.product-card__image-wrapper');
        if (firstMedia && firstMedia.clientHeight > 0) {
          this.style.setProperty('--swiper-navigation-top-offset', parseInt(firstMedia.clientHeight) / 2 + 'px');
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

      onSlideAfterInit(swiper) {
        const { realIndex } = swiper;
        if (this.sliderCounter && swiper.pagination.bullets) {
          this.sliderCounter.querySelector('.swiper-pagination-current').innerText = realIndex + 1;
          this.sliderCounter.querySelector('.swiper-pagination-total').innerText = swiper.pagination.bullets.length;
        }

        this.detectVisibleSlides(swiper);
      }

      onSlideChange(swiper) {
        const { slides, realIndex } = swiper;

        this.detectVisibleSlides(swiper);

        if (slides[realIndex]) {
          Array.from(this.lookbookIcons).forEach((icon) => icon.classList.remove('is-active'));
          this.lookbookIcons[realIndex] && this.lookbookIcons[realIndex].classList.add('is-active');
        }

        if (this.sliderCounter && swiper.pagination.bullets) {
          this.sliderCounter.querySelector('.swiper-pagination-current').innerText = realIndex + 1;
        }
      }

      detectVisibleSlides(swiper) {
        const {
          activeIndex,
          params: { slidesPerView },
        } = swiper;

        this.activeIndexs = [];
        for (let i = 0; i < slidesPerView; i++) {
          const slideIndex = (activeIndex + i) % swiper.slides.length;
          const index = Number(swiper.slides[slideIndex].dataset.swiperSlideIndex);
          this.activeIndexs.push(index);
        }

        this.animateVisiblePins();
      }

      animateVisiblePins() {
        this.resetAnimatePins();
        this.startAnimatePins();
      }

      resetAnimatePins() {
        Array.from(this.lookbookIcons).forEach((icon) => icon.classList.remove('is-visible'));
      }

      startAnimatePins() {
        Array.from(this.activeIndexs).forEach((index) => {
          this.lookbookIcons[index] && this.lookbookIcons[index].classList.add('is-visible');
        });
      }

      onMouseOver(event) {
        const target = event.currentTarget;
        const index = Number(target.dataset.index);
        target.classList.add('is-active');

        if (typeof this.sliderInstance.slider === 'object') {
          if (this.sliderOptions.loop) {
            this.sliderInstance.slider.slideToLoop(index, this.sliderOptions.speed);
          } else {
            this.sliderInstance.slider.slideTo(index, this.sliderOptions.speed);
          }

          this.classList.add('is-hovering');

          this.resetAnimatePins();
        }
      }

      onMouseLeave(event) {
        Array.from(this.productCards).forEach((card) => card.classList.remove('is-active'));
        Array.from(this.lookbookIcons).forEach((icon) => icon.classList.remove('is-active'));
        this.classList.remove('is-hovering');

        this.startAnimatePins();
      }
    }
  );
}
