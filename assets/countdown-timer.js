if (!customElements.get('countdown-timer')) {
  customElements.define(
    'countdown-timer',
    class CountdownTimer extends HTMLElement {
      constructor() {
        super();

        FoxTheme.Motion.inView(this.closest('.countdown__wrapper'), async () => {
          this.setupConstants();
          this.initSelectors();

          const countdownData = this.dataset.countdownTimer;
          if (countdownData) {
            this.initializeCountdown(countdownData);
          }
        });
      }

      setupConstants() {
        this.MILLISECONDS = {
          DAY: 24 * 60 * 60 * 1000,
          HOUR: 60 * 60 * 1000,
          MINUTE: 60 * 1000,
          SECOND: 1000,
        };
        this.intervalDuration = 1000;
      }

      initSelectors() {
        this.selectorMapping = {
          day: '[data-timer-day]',
          hour: '[data-timer-hour]',
          minute: '[data-timer-minute]',
          second: '[data-timer-second]',
        };
        this.units = ['day', 'hour', 'minute', 'second'];
      }

      initializeCountdown(countdownData) {
        this.startTime = Date.now();
        this.targetTime = new Date(countdownData).getTime();
        this.loop = false;
        this.onComplete = () => {};
        this.shouldAddLeadingZero = true;

        if (this.targetTime > this.startTime) {
          this.fetchDomElements();
          this.beginCountdown();
        }
      }

      fetchDomElements() {
        this.elements = {};
        this.units.forEach((unit) => {
          this.elements[unit] = this.querySelector(this.selectorMapping[unit]);
        });
      }

      beginCountdown() {
        this.intervalId = setInterval(() => {
          const remainingTime = this.targetTime - Date.now();
          if (remainingTime <= 0) {
            this.terminateCountdown();
          } else {
            this.updateDisplay(remainingTime);
          }
        }, this.intervalDuration);
        this.classList.remove('hidden');
      }

      updateDisplay(remainingTime) {
        const timeComponents = this.computeTimeComponents(remainingTime);
        this.units.forEach((unit) => {
          if (this.elements[unit]) {
            this.elements[unit].textContent = this.formatTimeComponent(timeComponents[unit]);
          }
        });
      }

      computeTimeComponents(ms) {
        return {
          day: Math.floor(ms / this.MILLISECONDS.DAY),
          hour: Math.floor((ms % this.MILLISECONDS.DAY) / this.MILLISECONDS.HOUR),
          minute: Math.floor((ms % this.MILLISECONDS.HOUR) / this.MILLISECONDS.MINUTE),
          second: Math.floor((ms % this.MILLISECONDS.MINUTE) / this.MILLISECONDS.SECOND),
        };
      }

      formatTimeComponent(value) {
        return this.shouldAddLeadingZero && value < 10 ? `0${value}` : value.toString();
      }

      terminateCountdown() {
        clearInterval(this.intervalId);
        if (this.loop) {
          this.beginCountdown();
        } else {
          this.onComplete();
          this.classList.add('hidden');
        }
      }

      resetCountdown() {
        clearInterval(this.intervalId);
        this.units.forEach((unit) => {
          if (this.elements[unit]) {
            this.elements[unit].textContent = '00';
          }
        });
      }
    }
  );
}
