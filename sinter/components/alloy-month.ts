// The script of <alloy-month>: the year shown, the month names in the page's language, the keys, a pick.
import { openFrom } from '../popover.js';
import { AlloyMonthComponent } from './alloy-month.html';
import { langOf, monthKey, todayIso, yearMonths } from '../calendar.js';


export class AlloyMonth extends AlloyMonthComponent {
  #stop = new AbortController();

  connected() {
    const signal = this.#stop.signal, { popover } = this.refs;
    openFrom(this.refs.toggle, popover, signal, (open) => (this.state.open = open));
    this.#title();
    this.#show(this.#start());
    popover.addEventListener('toggle', (e) => {
      if ((e as ToggleEvent).newState !== 'open') return;
      this.#show(this.#start());
      requestAnimationFrame(() => popover.querySelector<HTMLElement>('[data-al-month][tabindex="0"]')?.focus());
    }, { signal });
    popover.addEventListener('click', (e) => {
      const el = (e.target as Element | null)?.closest?.('button');
      if (!el) return;
      if (el.classList.contains('al-prev')) return this.#show(`${this.state.year - 1}-${this.state.focus.slice(5)}`);
      if (el.classList.contains('al-next')) return this.#show(`${this.state.year + 1}-${this.state.focus.slice(5)}`);
      const month = el.getAttribute('data-al-month');
      if (month && el.getAttribute('aria-disabled') !== 'true') {
        this.emit('change', month);
        popover.hidePopover();
        this.refs.toggle.focus();
      }
    }, { signal });
    popover.addEventListener('keydown', (e) => {
      // from the focus kept in state: a key pressed before the last one's focus moved still steps on from there
      const on = (e.target as Element | null)?.getAttribute?.('data-al-month');
      if (on && (e.key === 'Enter' || e.key === ' ')) {
        e.preventDefault();
        const el = popover.querySelector(`[data-al-month="${this.state.focus}"]`);
        if (el?.getAttribute('aria-disabled') !== 'true') {
          this.emit('change', this.state.focus);
          popover.hidePopover();
          this.refs.toggle.focus();
        }
        return;
      }
      const to = on ? monthKey(this.state.focus, e.key) : null;
      if (!to || e.altKey || e.ctrlKey || e.metaKey) return;
      e.preventDefault();
      this.#show(to);
      requestAnimationFrame(() => popover.querySelector<HTMLElement>(`[data-al-month="${to}"]`)?.focus());
    }, { signal });
  }

  propsChanged() {
    this.#title();
  }

  disconnected() {
    this.#stop.abort();
  }

  #start = () => (/^\d{4}-\d{2}$/.test(this.props.value) ? this.props.value : todayIso().slice(0, 7));

  /** the button's text: the month in the language ("November 2026") */
  #title() {
    const v = this.props.value;
    this.state.current = /^\d{4}-\d{2}$/.test(v)
      ? new Intl.DateTimeFormat(langOf(this.root), { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${v}-01T00:00:00Z`))
      : '';
  }

  #show(month: string) {
    const year = +month.slice(0, 4);
    if (year !== this.state.year) {
      this.state.year = year;
      this.state.months = yearMonths(year, langOf(this.root));
    }
    this.state.focus = month;
  }
}
