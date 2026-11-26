// The command palette's ranking and the commands it finds on the page itself, pure but for collect(), which reads
// the document.
import type { PaletteCommand } from './sinter.types.js';

const fold = (s: string) => s.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();

/**
 * How well `query` matches `text`: 0 for no match. Every word of the query must match: at the start of the text
 * (best), at the start of a word, inside a word, or as letters in order (an abbreviation, worst).
 */
export function score(query: string, text: string): number {
  const words = fold(query).split(/\s+/).filter(Boolean);
  if (!words.length) return 1;
  const t = fold(text);
  let total = 0;
  for (const w of words) {
    if (t.startsWith(w)) total += 8;
    else if (new RegExp(`(^|[^\\p{L}\\p{N}])${w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'u').test(t)) total += 6;
    else if (t.includes(w)) total += 3;
    else {
      let i = 0;
      for (const c of t) if (c === w[i]) i++;
      if (i < w.length) return 0;
      total += 1;
    }
  }
  return total;
}

/** The commands that match, best first (a label beats keywords; ties keep the order given), at most `limit`. */
export function rank(query: string, commands: readonly PaletteCommand[], limit = 50): PaletteCommand[] {
  return commands
    .map((c, i) => ({ c, i, s: Math.max(score(query, c.label) * 2, c.keywords ? score(query, c.keywords) : 0, c.group ? score(query, c.group) / 2 : 0) }))
    .filter((x) => x.s > 0)
    .sort((a, b) => b.s - a.s || a.i - b.i)
    .slice(0, limit)
    .map((x) => x.c);
}

/**
 * With an empty query: the recently picked ones first, then the rest in their order. A recent one the page still has is
 * shown as the page has it now (its button runs); one it has not (a server's answer) as it was kept.
 */
export function withRecent(commands: readonly PaletteCommand[], recent: readonly PaletteCommand[], recentGroup: string): PaletteCommand[] {
  const byId = new Map(commands.map((c) => [c.id, c]));
  const first = recent.map((r) => ({ ...(byId.get(r.id) ?? r), group: recentGroup }));
  const seen = new Set(first.map((c) => c.id));
  return [...first, ...commands.filter((c) => !seen.has(c.id))];
}

/** `c` first in the recent list (the command itself, without its group), kept to `max`. */
export function remember(recent: readonly PaletteCommand[], c: PaletteCommand, max = 5): PaletteCommand[] {
  const { group: _, ...kept } = c;
  return [kept, ...recent.filter((r) => r.id !== c.id)].slice(0, max);
}

/**
 * The page's own commands: its navigation's links ("Go to") and its buttons with a shortcut (`data-shortcut` or
 * `aria-keyshortcuts`, "Actions"), visible and enabled, each once. Their elements, by id, for running a button.
 */
export function collect(doc: Document, groups: { pages: string; actions: string }, inside: Element | null):
  { commands: PaletteCommand[]; elements: Map<string, HTMLElement> } {
  const commands: PaletteCommand[] = [], elements = new Map<string, HTMLElement>(), labels = new Set<string>();
  const name = (el: HTMLElement) => (el.getAttribute('aria-label') || el.textContent || el.title || '').replace(/\s+/g, ' ').trim();
  const shown = (el: HTMLElement) => !el.closest('[hidden], [inert]') && !(inside && inside.contains(el));
  doc.querySelectorAll<HTMLAnchorElement>('nav a[href]').forEach((a) => {
    const label = name(a), href = a.getAttribute('href')!;
    if (!label || !shown(a) || labels.has(`p:${label}`) || href.startsWith('#')) return;
    labels.add(`p:${label}`);
    commands.push({ id: `page:${href}`, label, group: groups.pages, href });
  });
  doc.querySelectorAll<HTMLElement>('button[data-shortcut], button[aria-keyshortcuts], a[aria-keyshortcuts]').forEach((el) => {
    const label = name(el);
    if (!label || !shown(el) || (el as HTMLButtonElement).disabled || labels.has(`a:${label}`)) return;
    labels.add(`a:${label}`);
    const id = `action:${label}`;
    const keys = el.getAttribute('aria-keyshortcuts') || el.getAttribute('data-shortcut') || undefined;
    commands.push({ id, label, group: groups.actions, shortcut: keys && keys.length === 1 ? keys.toUpperCase() : keys });
    elements.set(id, el);
  });
  return { commands, elements };
}
