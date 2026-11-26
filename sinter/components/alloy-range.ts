// The script of <alloy-range>: picks in the calendar (first the start, then the end), the presets, and where a range
// goes: the URL's parameters (`params`, through sinter's navigate()) and the `change` event.
import { navigate } from '@tiaforge-ui/sinter';
import { openFrom } from '../popover.js';
import { AlloyRangeComponent } from './alloy-range.html';
import { pickRange, presets, todayIso } from '../calendar.js';
import type { DateRange } from '../sinter.types.js';


export class AlloyRange extends AlloyRangeComponent {
  #stop = new AbortController();

  connected() {
    const signal = this.#stop.signal, { popover } = this.refs;
    openFrom(this.refs.toggle, popover, signal, (open) => (this.state.open = open));
    this.state.today = todayIso();
    popover.addEventListener('toggle', (e) => {
      if ((e as ToggleEvent).newState === 'open') {
        this.state.today = todayIso();
        requestAnimationFrame(() => popover.querySelector<HTMLElement>('[data-al-day][tabindex="0"]')?.focus());
      } else this.state.first = '';
    }, { signal });
    popover.addEventListener('pick', (e) => {
      const iso = (e as CustomEvent<string>).detail;
      const r = pickRange({ start: this.state.first, end: '', open: !!this.state.first }, iso);
      if (r.open) this.state.first = r.start;
      else this.#commit({ start: r.start, end: r.end });
    }, { signal });
    popover.addEventListener('click', (e) => {
      const id = (e.target as Element | null)?.closest?.('[data-al-preset]')?.getAttribute('data-al-preset');
      if (!id) return;
      if (id === 'clear') return this.#commit({ start: '', end: '' });
      const p = presets(todayIso()).find((x) => x.id === id);
      if (p) this.#commit({ start: p.start, end: p.end });
    }, { signal });
  }

  disconnected() {
    this.#stop.abort();
  }

  #commit(range: DateRange) {
    this.state.first = '';
    this.refs.popover.hidePopover();
    this.refs.toggle.focus();
    // a page that handles the range itself prevents the event; else, with `params`, it goes to the URL
    if (!this.emit('change', range) || !this.props.params) return;
    const [a, b] = this.props.params, url = new URL(location.href);
    for (const [k, v] of [[a, range.start], [b, range.end]] as const) v ? url.searchParams.set(k, v) : url.searchParams.delete(k);
    navigate(url.pathname + url.search + url.hash);
  }
}
