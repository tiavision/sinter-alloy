// The script of <alloy-calendar>: the grid and names for the language, the focus moved by the keys, picks.
import { AlloyCalendarComponent } from './alloy-calendar.html';
import { langOf, clampDate, dayKey, dayLabel, firstWeekday, isDate, monthGrid, monthOf, monthTitle, weekdays, addMonths, firstOf } from '../../calendar.js';

export class AlloyCalendar extends AlloyCalendarComponent {
  #stop = new AbortController();
  /** a key moved the focus: once rendered, the focused day's button takes it */
  #refocus = false;

  connected() {
    const root = this.root, signal = this.#stop.signal;
    this.#show(this.#anchor());
    root.addEventListener('click', (e) => {
      const el = (e.target as Element | null)?.closest?.('button');
      if (!el) return;
      if (el.classList.contains('al-prev')) return this.#month(-1);
      if (el.classList.contains('al-next')) return this.#month(1);
      const iso = el.getAttribute('data-al-day');
      if (iso && el.getAttribute('aria-disabled') !== 'true') {
        this.state.focus = iso;
        this.emit('pick', iso);
      }
    }, { signal });
    root.addEventListener('keydown', (e) => {
      const iso = (e.target as Element | null)?.getAttribute?.('data-al-day');
      if (!iso || e.altKey || e.ctrlKey || e.metaKey) return;
      if (e.key === 'Enter' || e.key === ' ') {
        // the day in state: after fast arrow keys the browser's focus may not have reached it yet
        e.preventDefault();
        const day = this.root.querySelector(`[data-al-day="${this.state.focus || iso}"]`);
        if (day?.getAttribute('aria-disabled') !== 'true') this.emit('pick', this.state.focus || iso);
        return;
      }
      // from the focus kept in state: a key pressed before the last one's focus moved still steps on from there
      const next = dayKey(this.state.focus || iso, e.key, e.shiftKey, firstWeekday(this.#lang()));
      if (next == null) return;
      e.preventDefault();
      this.#refocus = true;
      this.#show(clampDate(next, this.props.min, this.props.max));
    }, { signal });
    root.addEventListener('pointerover', (e) => {
      const iso = (e.target as Element | null)?.getAttribute?.('data-al-day');
      if (iso && this.props.start && !this.props.end) this.state.hover = iso;
    }, { signal });
  }

  propsChanged() {
    // a new value or range start: show its month; a new language: the names again
    const anchor = this.#anchor();
    if (monthOf(anchor) !== this.state.month || this.#locale !== this.#lang()) this.#show(anchor);
    if (!this.props.start || this.props.end) this.state.hover = '';
  }

  disconnected() {
    this.#stop.abort();
  }

  /** the day to show first: the value, the range's start, else today (within min/max) */
  #anchor(): string {
    const p = this.props;
    const pick = [p.value, p.start, p.today].find((x) => isDate(x)) ?? p.today;
    return clampDate(pick, p.min, p.max);
  }

  #locale = '';
  /** the page's language: sinter's $locale, else the `lang` the page is in (an app without languages has no $locale) */
  #lang = (): string => this.props.locale || langOf(this.root);

  /** shows `focus`'s month with it focused */
  #show(focus: string) {
    const locale = this.#lang(), month = monthOf(focus);
    this.state.focus = focus;
    if (month !== this.state.month || locale !== this.#locale) {
      const weeks = monthGrid(month, locale);
      this.state.weeks = weeks;
      this.state.labels = Object.fromEntries(weeks.flat().map((d) => [d.iso, dayLabel(d.iso, locale)]));
      this.state.title = monthTitle(month, locale);
      this.state.month = month;
    }
    if (locale !== this.#locale) this.state.names = weekdays(locale);
    this.#locale = locale;
    if (this.#refocus) {
      this.#refocus = false;
      requestAnimationFrame(() => this.root.querySelector<HTMLElement>(`[data-al-day="${focus}"]`)?.focus());
    }
  }

  #month(by: number) {
    const day = +this.state.focus.slice(8) || 1;
    const target = addMonths(`${this.state.month}-${String(Math.min(day, 28)).padStart(2, '0')}`, by);
    this.#show(clampDate(firstOf(monthOf(target)) === target ? target : target, this.props.min, this.props.max));
  }

  /** for the pickers: moves the focus into the grid (on opening) */
  focusDay() {
    requestAnimationFrame(() => this.root.querySelector<HTMLElement>('[data-al-day][tabindex="0"]')?.focus());
  }
}
