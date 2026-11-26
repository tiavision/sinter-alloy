// The script of <alloy-split>: the separator's keys and pointer drags, and the size kept under `name`. It writes only the
// component's state (`size`, `dragging`); with a bound `value` it only emits `change` and the page writes it back.
import { AlloySplitComponent } from './alloy-split.html';
import { clamp, dragSize, keySize, kept, toggle } from '../split.js';

export class AlloySplit extends AlloySplitComponent {
  #stop = new AbortController();
  /** the size before Enter collapsed the pane */
  #remembered: number | null = null;

  connected() {
    const sep = this.refs.separator, signal = this.#stop.signal;
    const stored = this.props.value === undefined && this.props.name ? kept(read(this.#key()), this.#bounds()) : null;
    if (stored != null) this.state.size = stored;
    sep.addEventListener('keydown', (e) => this.#keydown(e), { signal });
    sep.addEventListener('pointerdown', (e) => this.#down(e), { signal });
    sep.addEventListener('dblclick', () => this.#set(clamp(this.props.initial, this.#bounds())), { signal });
  }

  disconnected() {
    this.#stop.abort();
  }

  #key = () => `sn:alloy-split:${this.props.name}`;
  #bounds = () => ({ min: this.props.min, max: this.props.max });
  #size = (): number => this.props.value ?? (this.state.size < 0 ? this.props.initial : this.state.size);

  /** a new size: shown (or handed to the page's model), kept, announced by `change` */
  #set(size: number, commit = true) {
    if (this.props.value === undefined) this.state.size = size;
    if (!commit) return;
    if (this.props.value === undefined && this.props.name) write(this.#key(), JSON.stringify(size));
    this.emit('change', size);
  }

  #keydown(e: KeyboardEvent) {
    if (e.altKey || e.ctrlKey || e.metaKey) return;
    const size = this.#size(), b = this.#bounds();
    if (e.key === 'Enter') {
      e.preventDefault();
      const t = toggle(size, this.#remembered, this.props.initial, b);
      this.#remembered = t.remembered;
      this.#set(t.size);
      return;
    }
    const next = keySize(size, e.key, e.shiftKey, b, { step: this.props.step ?? 16, direction: this.props.direction ?? 'row', reverse: !!this.props.reverse });
    if (next == null) return;
    e.preventDefault();
    this.#remembered = null;
    if (next !== size) this.#set(next);
  }

  #down(e: PointerEvent) {
    if (e.button !== 0) return;
    e.preventDefault();
    const sep = this.refs.separator, column = this.props.direction === 'column';
    sep.setPointerCapture?.(e.pointerId);
    sep.focus({ preventScroll: true });
    const start = this.#size(), from = column ? e.clientY : e.clientX, b = this.#bounds(), reverse = !!this.props.reverse;
    let last = start, frame = 0, at = from;
    this.state.dragging = true;
    const off = new AbortController(), opts = { signal: AbortSignal.any([this.#stop.signal, off.signal]) };
    sep.addEventListener('pointermove', (ev) => {
      if (ev.pointerId !== e.pointerId) return;
      at = column ? ev.clientY : ev.clientX;
      frame ||= requestAnimationFrame(() => {
        frame = 0;
        last = dragSize(start, at - from, b, reverse);
        // a bound value follows the page's model on every frame; the component's own size too, kept at the end
        if (this.props.value !== undefined) this.emit('change', last);
        else this.state.size = last;
      });
    }, opts);
    const end = (ev: PointerEvent) => {
      if (ev.pointerId !== e.pointerId) return;
      off.abort();
      cancelAnimationFrame(frame);
      last = dragSize(start, at - from, b, reverse);
      this.state.dragging = false;
      this.#remembered = null;
      if (last !== start) this.#set(last);
    };
    sep.addEventListener('pointerup', end, opts);
    sep.addEventListener('pointercancel', end, opts);
  }
}

/** localStorage, where it is there and allowed (a private window, blocked site data: nothing is kept) */
function read(key: string): string | null {
  try { return globalThis.localStorage?.getItem(key) ?? null; } catch { return null; }
}
function write(key: string, value: string) {
  try { globalThis.localStorage?.setItem(key, value); } catch { /* not kept */ }
}
