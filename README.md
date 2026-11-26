# @tiavision/sinter-alloy

Opinionated components for [sinter](https://github.com/tiaforge/sinter): the part of a UI that needs a script
because it cannot be written as attributes. Built for [temper](https://github.com/tiaforge/temper) (a required peer),
first used by [caley](https://github.com/tiavision/caley).

| Component | Status |
| --- | --- |
| [`<alloy-sortable>`](#alloy-sortable) | built: a list reordered with a pointer (mouse, touch, pen) or the keyboard |
| [`<alloy-board>`](#alloy-board) | built: cards moved within and between columns |
| [`<alloy-split>`](#alloy-split) | built: two panes and a separator that keeps its size |
| [`<alloy-date>`, `<alloy-range>`, `<alloy-month>`](#planned) | designed: dates in the page's language, a range in the URL |
| [`<alloy-palette>`](#planned) | designed: a Ctrl+K command palette |
| [`<alloy-virtual>`](#planned) | designed: a long list over sinter's `append` pagination |

**[Preview](https://claude.ai/artifact/QHz6QSprLs8idJk7Pk2L2F)** (private for now: share it from its Share menu): the three
built components live, and mockups of the designed ones. Its source is `preview/` (`npm run preview:build`). The
design, the decisions and the open questions are in [docs/DESIGN.md](docs/DESIGN.md).

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

## `<alloy-board>`

```html
<sn-resource name="cards" src="/api/cards" key="id" order="rank" type="Card[]"></sn-resource>

<alloy-board data-sn-with="{ lists: [{ id: 'todo', title: 'To do' }, { id: 'done', title: 'Done' }],
                             listKey: (c) => c.id, listName: (c) => c.title, items: cards, keyOf: (c) => c.id,
                             nameOf: (c) => c.title, group: 'status', label: 'Tasks',
                             resource: 'cards', field: 'rank', save: '/api/cards/order' }">
  <span slot="item" data-grow data-sn-text="$slot.item.title"></span>
</alloy-board>
```

One list of cards; each card's `group` field (`status`) names its column, `field` (`rank`) orders a column. A drop
moves the card at once (an optimistic merge of its group and rank) and saves the column it landed in:

```
PUT /api/cards/order      { "group": "done", "order": ["b", "a"] }      → any 2xx (an answer holding cards is applied by key)
```

The server sets the card's group and renumbers that column. A refused save puts the card back with a note. Without
`resource` and `save`, a drop emits `move` (a `BoardMove`: `fromGroup`, `toGroup` besides the sortable's fields) and
the page applies it; for cards kept in state, `alloy.regroup(cards, $event.detail, (c) => c.id, 'status')`.

| | |
| --- | --- |
| `lists`, `listKey`, `listName` | the columns in order, a column's key (the value of the cards' `group`), its name |
| `items`, `keyOf`, `nameOf`, `group`, `field` | the cards, their key and name, the field naming their column, the sort field |
| `label`, `disabled`, `text` | the board's accessible name; no handles; the words (`BoardText`) |
| `resource`, `save` | the round trip above (interim, as the sortable's) |
| slot `item` | a card: `$slot.item`, `$slot.index`, `$slot.list` |
| slot `list` | a column's header: `$slot.list`, `$slot.count` (default: its name and a count badge) |
| events | `move` (`BoardMove`, cancelable), `sort-error` (`{ move, error }`) |

Keyboard: Space or Enter on a card's handle picks it up, ArrowUp/ArrowDown/Home/End move it in its column,
ArrowLeft/ArrowRight to the neighbouring column, Space or Enter drops, Escape puts it back; each step is announced
with the column's name. Pointer: the card follows the pointer across columns, a line shows the place, an empty column
is outlined, the board scrolls sideways near its edges. Helpers: `alloy.columnAfter`, `alloy.rankIn`, `alloy.regroup`.

## `<alloy-split>`

```html
<alloy-split data-sn-with="{ name: 'mail-sidebar', initial: 220, min: 140, max: 400, label: 'Folders width' }">
  <nav slot="start">…</nav>
  <section slot="end">…</section>
</alloy-split>
```

Two panes and a separator. The component lays them out (a grid as large as its box; give a column split a height) and
keeps the size itself: with `name` it is stored in localStorage (`sn:alloy-split:<name>`) and comes back on the next
visit, so the page writes no state. A page that keeps the size in its own state binds it instead:
`data-sn-model="widths.sidebar"` (nothing is stored then).

| | |
| --- | --- |
| `initial`, `min`, `max`, `step` | the sized pane's size in px; one arrow key's move (16, Shift four times) |
| `direction`, `reverse` | `'row'` (side by side, default) or `'column'`; `reverse`: the end pane is the sized one |
| `name` | where the size is kept; without it, nothing is |
| `label`, `controls` | the separator's accessible name; the sized pane's id (`aria-controls`) |
| `value` / event `change` | the size, for `data-sn-model`; `change` after every move |

Keyboard: the separator is focusable (`role="separator"`, `aria-valuenow/min/max`); the arrows move it, Shift for
bigger steps, Home and End go to min and max, Enter collapses the pane and opens it again. Pointer: drag it with a
mouse, touch or pen; double-click puts it back to `initial`.

CSP: sinter writes the size into the first frame's HTML as a `style` attribute. A page served with `style-src 'self'`
alone needs `style-src-attr 'unsafe-inline'` for it, or the panes start at 30% until the page module applies the size.

## Planned

Designed in [docs/DESIGN.md](docs/DESIGN.md), not built yet; the preview shows a mockup of each. Each assumes one shape,
as the sortable does, so a page writes the tag and nothing else.

- **`<alloy-date>`, `<alloy-range>`, `<alloy-month>`**: a date field with a calendar popover, a range bound to two URL
  parameters (`params: ['start', 'end']`, ISO dates), a month picker; weekday names and the week's first day from the
  page's language, whatever the browser's.
- **`<alloy-palette>`**: opens with Ctrl+K; lists the page's own links and shortcut buttons with no setup, and asks
  `GET <src>?q=` for more (`[{ id, label, href, group }]`).
- **`<alloy-virtual>`**: renders only the rows in view of a resource paginated with sinter's `append` mode, and loads
  the next page near the end. temper's `data-lazy` is the first choice before it.

## The package

```
sinter/
  components/alloy-sortable.html   markup, contract, scoped styles (tokens only)
  components/alloy-sortable.ts     the script: pointer and keyboard, writes only its state
  components/alloy-board.html/.ts  the board, the same way
  components/alloy-split.html/.ts  the split panes
  split.ts                         the split's decisions, pure
  board.ts                         the board's state machine, pure
  sortable.ts                      the state machine, pure
  save.ts                          the round trip's body and answer, pure
  order.ts                         the helpers, pure
  sinter.helpers.ts, sinter.types.ts, index.ts
fixtures/                          pages for `sinter check` and the browser tests
preview/                           the preview page (`npm run preview:build`)
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
