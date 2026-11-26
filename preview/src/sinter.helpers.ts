// The preview page's helpers module, as an app writes its own: the package as the namespace `alloy`.
export * as alloy from '@tiavision/sinter-alloy';

const FIRST = ['Maria', 'Mark', 'Mei', 'Milan', 'Amara', 'Jonas', 'Lea', 'Omar', 'Priya', 'Tomás', 'Yuki', 'Zoe'];
const LAST = ['Alonso', 'Becker', 'Chen', 'Dvořák', 'Eze', 'Fischer', 'García', 'Haddad', 'Iyer', 'Jensen', 'Kowalski', 'Lindqvist'];

/** `n` made-up contacts for the long list's demo, the same every time. */
const crowds = new Map<number, Array<{ id: string; name: string; initials: string }>>();

/** `n` generated contacts: the same array for the same `n`, as a resource keeps its list between renders. */
export function people(n: number): Array<{ id: string; name: string; initials: string }> {
  const kept = crowds.get(n);
  if (kept) return kept;
  const made = Array.from({ length: n }, (_, i) => {
    const f = FIRST[(i * 7) % FIRST.length]!, l = LAST[(i * 5 + Math.floor(i / 12)) % LAST.length]!;
    return { id: `c${i}`, name: `${f} ${l}`, initials: f[0]! + l[0]! };
  });
  crowds.set(n, made);
  return made;
}
