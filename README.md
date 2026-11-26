# @tiavision/sinter-alloy

Opinionated components for [sinter](https://github.com/tiaforge/sinter): the part of a UI that needs a script
because it cannot be written as attributes. Built for [temper](https://github.com/tiaforge/temper) (a required peer),
first used by [caley](https://github.com/tiavision/caley).

Today: **`<alloy-sortable>`**, a list the user reorders with a pointer (mouse, touch, pen) or the keyboard. Planned
(see [docs/DESIGN.md](docs/DESIGN.md)): boards, date and range pickers, a command palette, long lists, split panes.

```html
<sn-resource name="tasks" src="/api/tasks" key="id" order="rank" type="Task[]"></sn-resource>
<main data-sn-state="{ mv: /** @type {Move | null} */ (null) }">
  <alloy-sortable data-sn-with="{ items: tasks, keyOf: (t) => t.id, nameOf: (t) => t.title, label: 'Tasks' }"
                  data-sn-on-move="mv = $event.detail; run('save-order')">
    <span slot="item" data-grow data-sn-text="$slot.item.title"></span>
  </alloy-sortable>
  <span hidden id="save-order" data-sn-put="/api/tasks/order" data-sn-when="mv"
        data-sn-body="{ ids: alloy.keysAfter(tasks, mv, (t) => t.id) }"
        data-sn-optimistic="merge(tasks.find((t) => t.id === mv.key), { rank: alloy.between(tasks, mv, 'rank') })"></span>
</main>
```

The list renders in the first frame like any sinter markup. A drop changes nothing by itself: it emits `move`, and
the page answers with one optimistic `merge` (the resource's `order` sorts the row into place at once; a failed
request drops the change and the row goes back) and one request. A server event that re-sorts the resource moves
the row like any other change, so a second tab follows.

## Install

```sh
npm install @tiavision/sinter-alloy
```

```js
// vite.config.js
sinter({ libraries: ['@tiavision/sinter-alloy'] })
```

```ts
// src/sinter.helpers.ts
export * as alloy from '@tiavision/sinter-alloy';
// src/sinter.types.ts
export type { Move, SortableText } from '@tiavision/sinter-alloy';
```

With temper's Vite plugin, add the components to its `paths` so the icons they name (`grip-vertical`) are served:
`temper({ paths: [..., 'node_modules/@tiavision/sinter-alloy/sinter/components'], icons: { lucide: true } })`.

## `<alloy-sortable>`

| | |
| --- | --- |
| `items` | the rows, in their order |
| `keyOf` | a row's key (unique, stable) |
| `nameOf` | its name, for the handle's label and the announcements (default: the key) |
| `label` | the list's accessible name |
| `disabled` | no handles, nothing moves |
| `quiet` | handles show on hover and focus only (always on touch screens) |
| `text` | the words, for another language (`SortableText`, English by default) |
| slot `item` | a row: sees the page's scope plus `$slot.item`, `$slot.index` |
| event `move` | `Move`: `{ key, from, to, after, before, via }` (`to` in the list without the item; `after`/`before` the new neighbours' keys) |

Keyboard: the handle is a button. Space or Enter picks the row up, ArrowUp/ArrowDown/Home/End move it, Space or Enter
drops it, Escape or leaving the list puts it back. Each step is announced in the component's live region, and the
handle keeps the focus after the page has moved the row. Pointer: drag a handle; the row follows the pointer, a line
shows where it drops, the nearest scrolling box scrolls near its edges, Escape cancels. Only the handle has
`touch-action: none`, so the list still scrolls on a phone.

Helpers: `alloy.reorder(list, move)`, `alloy.keysAfter(list, move, keyOf)`, `alloy.between(list, move, field)` (the
sort value that puts the item between its new neighbours), `alloy.moved(list, move, keyOf)`.

## The package

```
sinter/
  components/alloy-sortable.html   markup, contract, scoped styles (tokens only)
  components/alloy-sortable.ts     the script: pointer and keyboard, writes only its state
  sortable.ts                      the state machine, pure
  order.ts                         the helpers, pure
  sinter.helpers.ts, sinter.types.ts, index.ts
fixtures/                          pages for `sinter check`
test/                              unit tests, `sinter check`, render tests with the real script
docs/DESIGN.md                     the design of the whole library
```

```sh
npm install
npx sinter check --strict
npm run typecheck
npm test
```

## License

MIT
