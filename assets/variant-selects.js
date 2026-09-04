if (!customElements.get('variant-selects')) {
  customElements.define(
    'variant-selects',
    class VariantSelects extends HTMLElement {
      constructor() {
        super();
      }

      get selectedOptionValues() {
        return Array.from(this.querySelectorAll('select option[selected], fieldset input:checked')).map(
          ({ dataset }) => dataset.optionValueId
        );
      }

      get selectedColor() {
        // Get selected color from dropdown or radio button
        const selectedInput = this.querySelector('fieldset input:checked') || this.querySelector('select');
        return selectedInput ? selectedInput.dataset.optionSwatchValue || selectedInput.value : null;
      }

      getInputForEventTarget(target) {
        return target.tagName === 'SELECT' ? target.selectedOptions[0] : target;
      }

      connectedCallback() {
        this.addEventListener('change', (event) => {
          const target = this.getInputForEventTarget(event.target);
          this.updateSelectedSwatchValue(event);
          this.updateThumbnailVisibility();
         this.updateProductImage();

          FoxTheme.pubsub.publish(FoxTheme.pubsub.PUB_SUB_EVENTS.optionValueSelectionChange, {
            data: {
              event,
              target,
              selectedOptionValues: this.selectedOptionValues,
            },
          });
        });

        this.updateThumbnailVisibility();
        this.updateProductImage();
      }
      
      updateSelectedSwatchValue({ target }) {
        const { tagName } = target;

        if (tagName === 'SELECT' && target.selectedOptions.length) {
          Array.from(target.options)
            .forEach((option) => option.removeAttribute('selected'));
          target.selectedOptions[0].setAttribute('selected', 'selected');

          const swatchValue = target.selectedOptions[0].dataset.optionSwatchValue;
          const selectedDropdownSwatchValue = target
            .closest('.product-form__input')
            .querySelector('[data-selected-value] > .swatch');

          if (!selectedDropdownSwatchValue) return;
          if (swatchValue) {
            selectedDropdownSwatchValue.style.setProperty('--swatch--background', swatchValue);
            selectedDropdownSwatchValue.classList.remove('swatch--unavailable');
          } else {
            selectedDropdownSwatchValue.style.setProperty('--swatch--background', 'unset');
            selectedDropdownSwatchValue.classList.add('swatch--unavailable');
          }

          selectedDropdownSwatchValue.style.setProperty(
            '--swatch-focal-point',
            target.selectedOptions[0].dataset.optionSwatchFocalPoint || 'unset'
          );
        } else if (tagName === 'INPUT' && target.type === 'radio') {
          const selectedSwatchValue = target.closest(`.product-form__input`).querySelector('[data-selected-value]');
          if (selectedSwatchValue) selectedSwatchValue.innerHTML = target.value;
        }
      }
updateThumbnailVisibility() {
    const selectedColor = this.selectedColor;
    const images = document.querySelectorAll('.product__media-item');
    const thumbnails = document.querySelectorAll('.product__thumbs-image');
    const prevButton = document.querySelector('.swiper-button-prev');
    const nextButton = document.querySelector('.swiper-button-next');

    if (!selectedColor) return;

    // Handle thumbnails visibility
    thumbnails.forEach((thumbnail) => {
        thumbnail.style.display = (thumbnail.getAttribute('thumbnail-color') === selectedColor) ? 'block' : 'none';
    });

    let visibleImages = 0;
    let firstDraggableIndex = -1;

    // Handle main images visibility
    images.forEach((image, index) => {
        if (image.getAttribute('main-image-color') === selectedColor) {
            image.classList.add('draggable');
            image.classList.remove('not-draggable');
            image.style.pointerEvents = "auto";
            if (firstDraggableIndex === -1) firstDraggableIndex = index;
            visibleImages++;
        } else {
            image.classList.add('not-draggable');
            image.classList.remove('draggable');
            image.style.pointerEvents = "none";
        }
    });
}
updateProductImage() {
        const selectedRadio = this.querySelector('fieldset input[type="radio"]:checked');
        if (!selectedRadio) {
          return;
        }

        const selectedId = selectedRadio.id;
        const selectedLabel = document.querySelector(`label[for="${selectedId}"]`);
        if (!selectedLabel) {
          return;
        }

        const variantImageUrl = selectedLabel.getAttribute('variantimage');
        if (!variantImageUrl) {
          return;
        }

        const imageElement = document.querySelector('.sticky-atc-bar__product-image img');
        if (imageElement) {
          imageElement.srcset = variantImageUrl;
        }
      }

    }
  );
}