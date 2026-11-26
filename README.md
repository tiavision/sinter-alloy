# @tiavision/sinter-alloy

Opinionated components for [sinter](https://github.com/tiaforge/sinter): the part of a UI that needs a script
because it cannot be written as attributes. Built for [temper](https://github.com/tiaforge/temper) (a required peer),
first used by [caley](https://github.com/tiavision/caley).

Today: **`<alloy-sortable>`**, a list the user reorders with a pointer (mouse, touch, pen) or the keyboard. Planned
(see [docs/DESIGN.md](docs/DESIGN.md)): boards, date and range pickers, a command palette, long lists, split panes.

```html
<sn-resource name="tasks" src="/api/tasks" key="id" order="rank" type="Task[]"></sn-resource>

<alloy-sortable data-sn-with="{ items: tasks, keyOf: (t) => t.id, nameOf: (t) => t.title, label: 'Tasks',
                                resource: 'tasks', field: 'rank', save: '/api/tasks/order' }">
  <span slot="item" data-grow data-sn-text="$slot.item.title"></span>
</alloy-sortable>
```

That is all a page writes, as `paginate` is all a paged list needs. The list renders in the first frame like any
sinter markup. A drop moves the row at once (an optimistic merge of its `rank` in the page's store: the resource's
`order` sorts it into place) and saves the new order with one request of a fixed shape:

```
PUT /api/tasks/order      { "order": ["c", "a", "b"] }      → any 2xx (an answer holding the list's items is applied by key)
```

A refused request drops the change (the row goes back) and shows a note in the component. A second tab follows
through the server's own events, as for any change. An API of another shape: leave out `resource` and `save`, handle
the `move` event and send what that API wants (fixtures/manual.html).

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
| `resource`, `save`, `field` | the round trip: the resource's name, the full URL of `PUT { order }`, the sort field (default `sort_order`). Interim: once sinter passes a resource handle as a prop, `items` alone will do (docs/DESIGN.md, S9) |
| `disabled` | no handles, nothing moves |
| `quiet` | handles show on hover and focus only (always on touch screens) |
| `text` | the words, for another language (`SortableText`, English by default) |
| slot `item` | a row: sees the page's scope plus `$slot.item`, `$slot.index` |
| event `move` | `Move`: `{ key, from, to, after, before, via }` (`to` in the list without the item; `after`/`before` the new neighbours' keys); cancelable: preventing it skips the component's own save |
| event `sort-error` | `{ move, error }` after a refused save; preventing it hides the component's note |

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
  save.ts                          the round trip's body and answer, pure
  order.ts                         the helpers, pure
  sinter.helpers.ts, sinter.types.ts, index.ts
fixtures/                          pages for `sinter check`
test/                              unit tests, `sinter check`, render tests with the real script, Chromium tests
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
