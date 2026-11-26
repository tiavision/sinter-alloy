// The preview page's helpers module, as an app writes its own: the package as the namespace `alloy`.
export * as alloy from '@tiavision/sinter-alloy';

const FIRST = ['Maria', 'Mark', 'Mei', 'Milan', 'Amara', 'Jonas', 'Lea', 'Omar', 'Priya', 'Tomás', 'Yuki', 'Zoe'];
const LAST = ['Alonso', 'Becker', 'Chen', 'Dvořák', 'Eze', 'Fischer', 'García', 'Haddad', 'Iyer', 'Jensen', 'Kowalski', 'Lindqvist'];

/** `n` made-up contacts for the long list's demo, the same every time. */
export function people(n: number): Array<{ id: string; name: string; initials: string }> {
  return Array.from({ length: n }, (_, i) => {
    const f = FIRST[(i * 7) % FIRST.length]!, l = LAST[(i * 5 + Math.floor(i / 12)) % LAST.length]!;
    return { id: `c${i}`, name: `${f} ${l}`, initials: f[0]! + l[0]! };
  });
}
