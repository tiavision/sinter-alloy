// The script of <alloy-palette>: the shortcut, the dialog, the commands (the page's own, the props', the server's),
// their ranking as the user types, and running the one picked.
import { instance, navigate, type App } from '@tiaforge-ui/sinter';
import { AlloyPaletteComponent } from './alloy-palette.html';
import { collect, rank, remember, withRecent } from '../palette.js';
import type { PaletteCommand, PaletteText } from '../sinter.types.js';

const ENGLISH: PaletteText = {
  open: 'Search commands', placeholder: 'Type a command or search', empty: 'Nothing found',
  recent: 'Recent', pages: 'Go to', actions: 'Actions', results: 'Results',
};
const RECENT = 'sn:alloy-palette:recent';

export class AlloyPalette extends AlloyPaletteComponent {
  #stop = new AbortController();
  #local: PaletteCommand[] = [];
  #remote: PaletteCommand[] = [];
  #elements = new Map<string, HTMLElement>();
  #back: HTMLElement | null = null;
  #timer = 0;
  #asked = 0;

  connected() {
    // the dialog's contents render when it opens (sinter defers them): the field is reached through events and after
    // showModal(), never as a ref at connect
    const signal = this.#stop.signal, { open } = this.refs, dialog = this.#dialog();
    this.state.mac = /Mac|iPhone|iPad/.test(navigator.platform);
    open.addEventListener('click', () => this.#open(), { signal });
    document.addEventListener('keydown', (e) => {
      if (this.props.keys === false || e.key.toLowerCase() !== 'k' || e.altKey || e.shiftKey) return;
      if (!(this.state.mac ? e.metaKey && !e.ctrlKey : e.ctrlKey && !e.metaKey)) return;
      e.preventDefault();
      dialog.open ? dialog.close() : this.#open();
    }, { signal });
    this.root.addEventListener('input', (e) => {
      const el = e.target as HTMLInputElement | null;
      if (el?.closest?.('dialog') === dialog) this.#query(el.value);
    }, { signal });
    this.root.addEventListener('pick', (e) => this.#run((e as CustomEvent<PaletteCommand>).detail), { signal });
    dialog.addEventListener('close', () => {
      clearTimeout(this.#timer);
      this.#back?.focus();
    }, { signal });
    // Escape in the field: sinter's combobox keeps the key while its list shows and sends sn-dismiss; it closes the palette
    this.root.addEventListener('sn-dismiss', () => dialog.open && dialog.close(), { signal });
    // a click on the backdrop closes it
    dialog.addEventListener('click', (e) => { if (e.target === dialog) dialog.close(); }, { signal });
  }

  disconnected() {
    this.#stop.abort();
    clearTimeout(this.#timer);
  }

  /** the dialog (not a ref: sinter defers a dialog's contents, and its refs with them, until it opens) */
  #dialog = (): HTMLDialogElement => this.root.querySelector('dialog')!;
  #text = (): PaletteText => ({ ...ENGLISH, ...this.props.text });

  #open() {
    const t = this.#text(), dialog = this.#dialog();
    const found = collect(document, { pages: t.pages, actions: t.actions }, this.root);
    this.#elements = found.elements;
    this.#local = [...(this.props.commands ?? []), ...found.commands];
    this.#remote = [];
    this.#back = document.activeElement as HTMLElement | null;
    this.state.q = '';
    this.#query('');
    dialog.showModal();
    const field = () => dialog.querySelector<HTMLInputElement>('input');
    field()?.focus();
    // rendered on opening: focus it once it is there
    if (!field()) requestAnimationFrame(() => field()?.focus());
  }

  #query(q: string) {
    const t = this.#text();
    this.state.results = q.trim() ? rank(q, [...this.#local, ...this.#remote]) : withRecent(this.#local, recent(), t.recent);
    clearTimeout(this.#timer);
    const src = this.props.src;
    if (!src || !q.trim()) { this.state.loading = false; return; }
    this.state.loading = true;
    const asked = ++this.#asked;
    this.#timer = window.setTimeout(async () => {
      const app = mounted(this.root);
      try {
        const got = await (app ? app.request(`${src}${src.includes('?') ? '&' : '?'}q=${encodeURIComponent(q)}`) : Promise.resolve([]));
        if (asked !== this.#asked) return; // a later query has asked since
        this.#remote = (Array.isArray(got) ? got : []).filter((c): c is PaletteCommand => !!c && typeof c.id === 'string' && typeof c.label === 'string')
          .map((c) => ({ ...c, id: `remote:${c.id}`, group: c.group ?? t.results }));
      } catch {
        if (asked !== this.#asked) return;
        this.#remote = [];
      }
      this.state.loading = false;
      this.state.results = rank(this.#dialog().querySelector('input')?.value ?? q, [...this.#local, ...this.#remote]);
    }, 150);
  }

  #run(c: PaletteCommand) {
    write(remember(recent(), c));
    const el = this.#elements.get(c.id);
    this.#back = el ?? this.#back;
    this.#dialog().close();
    if (c.href) navigate(c.href);
    else el?.click();
  }
}

/** the recent commands kept in this browser (anything else there, an older version's, is dropped) */
function recent(): PaletteCommand[] {
  try {
    const v = JSON.parse(globalThis.localStorage?.getItem(RECENT) ?? '[]');
    return Array.isArray(v) ? v.filter((c): c is PaletteCommand => !!c && typeof c.id === 'string' && typeof c.label === 'string') : [];
  } catch { return []; }
}
function write(list: PaletteCommand[]) {
  try { globalThis.localStorage?.setItem(RECENT, JSON.stringify(list)); } catch { /* not kept */ }
}
function mounted(el: Element): App | null {
  for (let n: Node | null = el; n; n = n.parentNode) {
    try { return instance(n as Element | Document); } catch { /* not a mount root */ }
  }
  return null;
}
