// The script of <alloy-date>: typing read in the page's language, the calendar opened and closed, a pick applied.
import { openFrom, show } from '../popover.js';
import { AlloyDateComponent } from './alloy-date.html';
import { langOf, parseDate, todayIso } from '../calendar.js';


export class AlloyDate extends AlloyDateComponent {
  #stop = new AbortController();

  connected() {
    const signal = this.#stop.signal, { input, popover } = this.refs;
    openFrom(this.refs.toggle, popover, signal, (open) => (this.state.open = open), this.refs.field);
    this.state.today = todayIso();
    input.addEventListener('change', () => this.#typed(), { signal });
    input.addEventListener('input', () => (this.state.invalid = false), { signal });
    input.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowDown' && e.altKey) { e.preventDefault(); show(popover, this.refs.field); }
    }, { signal });
    popover.addEventListener('toggle', (e) => {
      if ((e as ToggleEvent).newState === 'open') {
        this.state.today = todayIso();
        requestAnimationFrame(() => popover.querySelector<HTMLElement>('[data-al-day][tabindex="0"]')?.focus());
      }
    }, { signal });
    popover.addEventListener('pick', (e) => {
      this.state.invalid = false;
      this.emit('change', (e as CustomEvent<string>).detail);
      popover.hidePopover();
      input.focus();
    }, { signal });
  }

  disconnected() {
    this.#stop.abort();
  }

  #typed() {
    const text = this.refs.input.value.trim();
    if (!text) {
      this.state.invalid = !!this.props.required;
      if (this.props.value) this.emit('change', '');
      return;
    }
    const iso = parseDate(text, langOf(this.root));
    const { min, max } = this.props;
    if (!iso || (min && iso < min) || (max && iso > max)) {
      this.state.invalid = true;
      return;
    }
    this.state.invalid = false;
    if (iso !== this.props.value) this.emit('change', iso);
  }
}
