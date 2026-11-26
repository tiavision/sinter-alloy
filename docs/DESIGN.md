# sinter-alloy: design

Status: draft. Built: `<alloy-sortable>` (used in caley's mail sidebar in its page-wired form) and `<alloy-board>`.
Designed: the rest. A preview page (`preview/`, published at https://claude.ai/artifact/QHz6QSprLs8idJk7Pk2L2F)
shows the two built ones live and mockups of the designed ones. Open questions are marked **Q-…** and gathered at the end; each needs a decision before
the component it belongs to is built.

## What sinter-alloy is

sinter covers the 90% of a UI that is data shown and changed: resources, bindings, actions, optimistic layers, live
sync, dialogs, `data-sn-options` lists. temper covers its looks with attributes. What is left is the **hard 10%**:
interactions that need a script because they follow a pointer, measure layout, or keep transient state no
attribute can express. sinter-alloy is a sinter component library for that 10%, and nothing else.

Rules every alloy component follows:

1. **Markup in the first frame.** A component's markup is ordinary sinter markup, expanded at build time: it renders
   in the first paint with embedded data, like the page around it. The script adds behaviour when the page module
   runs; it never builds what the first frame should show.
2. **The script writes only the component's state** (`this.state`), as sinter requires. Everything visible (a lifted
   row, a drop line, an open popover, a selected range) is a binding over that state in the component's own markup.
3. **One assumed API shape per component, like `paginate`.** A component that changes data does the whole round trip
   itself against one fixed request shape (the sortable: `PUT <list>/order { order: [...] }`), through the page's
   store, so its optimistic change, rollback and live sync are sinter's. The page names the resource and the URL and
   writes nothing else. Every such component still emits a typed, cancelable event (`move`): a page whose API has
   another shape prevents the component's save and sends its own request. Components never write page state.
4. **Built for temper.** temper is a required peer. Components use temper's attributes (`data-variant`, `data-layout`, `data-icon`, …) and its
   tokens. The scoped CSS that remains is structural and uses `--tm-*` tokens only; each such rule is listed below as
   something temper could own instead, so the aim is no CSS at all.
   Wherever a component paints a surface (a card, a column, a lifted row), it sets the matching text token with it
   (`--tm-surface` with `--tm-text`): inherited text colour is the host's, and a host whose reset colours `body` (the
   claude.ai artifact viewer's) otherwise left dark ink on the board's dark cards.
5. **Keyboard and screen reader first.** Every pointer interaction has a keyboard path, and each state change is
   announced (a live region in the component) or reflected in ARIA.
6. **Small.** A component's script is measured (gzip, minified, its pure modules included) and listed here. Pure
   logic lives in modules beside it (unit-tested without a DOM); the script is a thin adapter.
7. **Words come from the app.** English defaults, every string replaceable through a `text` prop (**Q-L1**).

Out of scope: the rich-text editor (tiavision/sinter-richtext). alloy follows its conventions where they fit: a
component with a script over pure, exported command functions (`commands.ts` there, `sortable.ts` / `order.ts`
here), fixtures checked by `sinter check`, a browser test under a strict CSP. It departs from them on styling:
sinter-richtext ships its own colours and borders; alloy uses temper.

## Packaging

sinter-alloy is a standalone repository and package, `@tiavision/sinter-alloy` (tiavision/sinter-alloy). It lives
under `@tiavision`, not `@tiaforge-ui`, on purpose: `@tiaforge-ui` holds sinter's neutral foundations, and this library
is opinionated (handles only, one optimistic merge per move, temper required, priorities set by caley). A component
that proves general and stable can later be generalised into a foundation package; the reverse would be harder.

It is laid out like sinter-mail:

```
package.json        "sinter": "./sinter", exports "." → sinter/index.ts, peers: sinter >=0.22, temper >=0.4 (required)
sinter/
  components/       public components (alloy-*), each <name>.html + <name>.ts
  components/internal/
  *.ts              pure modules (state machines, helpers)
  sinter.helpers.ts helpers apps call as `alloy.*`
  sinter.types.ts   types apps re-export
  index.ts
fixtures/           pages `sinter check --strict` compiles (the library's own check), with sinter.helpers.ts/types.ts
test/               unit tests, the check, render tests with the real scripts (jsdom), browser tests
docs/DESIGN.md
llms.txt, README.md
```

An app registers it with `sinter({ libraries: ['@tiavision/sinter-alloy'] })`, re-exports the helpers as `alloy` and the
types it names. caley depends on it as a checkout beside its own (`"@tiavision/sinter-alloy": "file:../../sinter-alloy"`, the way
sinter-richtext uses `file:../sinter`), until the package is published or caley pins the GitHub repository
(**Q-P1**).

The component prefix is `alloy-` and the helper namespace `alloy` (sinter: one prefix per library, owned by it); the
package is `sinter-alloy` like its siblings (sinter-mail, sinter-richtext). Short (`al-`) was considered; `alloy-`
reads clearly in an app's markup and cannot collide with an app's own components.

---

## How caley does these things today

| Need | Where | Today | Cost today |
| --- | --- | --- | --- |
| Reorder a list | virtual folders, mail accounts, CalDAV accounts, identities | **Not possible.** Four tables have a `sort_order` column (`virtual_folders`, `imap_accounts`, `caldav_accounts`, `email_identities`) that the API reads and orders by, but nothing could write it: every new row was `0`, sorted by name. | A missing feature. |
| Drag to a target | message → mailbox (mail sidebar) | Native HTML drag and drop: `draggable` rows, `drag` state, `data-sn-on-dragover/leave`, the mailbox row is an action with `data-sn-trigger="drop"`. | Works with a mouse only: no touch, no keyboard path (Move is in the reader's menu instead). |
| Board / drag between lists | calendar (an event to another day or time) | Not possible; edit the event's date in the form. | A missing feature. |
| Date input | event form, search page, mail search | Native `<input type="date">`, `time`, `datetime-local`. | Fine, except: they follow the browser's locale, not the page's (`/de/` pages show an English picker in an English browser); `datetime-local` for reminders is clumsy. |
| Month/week picker | calendar header | A popover (`#month-picker`, `data-menu`) with its own grid, month and year selects, a second resource (`pickerGrid`, `/calendar?month=`) for the month view: about 45 lines of markup plus helpers. | Hand-built, calendar-only. |
| Date range | search (`start`, `end`), mail search (`after`, `before`) | Two separate date inputs bound to `$url`. | Nothing stops end < start; no presets. |
| Command palette | — | None. Shortcuts are `data-shortcut` buttons (src/islands/common.ts). | A missing feature. |
| Long lists | mail list, contacts, search results | Mail and search are paginated by the server (offset pages in `$url.page`, keyset for search). Contacts loads every contact and filters in the browser, grouped by letter. temper's `data-lazy` (content-visibility) is not used. | Fine at today's sizes; contacts grows with the address book. |
| Resizable panes | mail: folders \| list \| reader | `<email-split>` (a component with a 34-line script), `clampWidth`/`keyWidth` helpers, keyboard handled on the tag, widths in persisted state (`mail-widths`), CSS for the handle. Used twice. | Bespoke; temper's backlog item 32 asks for it. |

## Ranking

By value to caley (what users get, what code goes away, how often it is used), against cost and risk:

| # | Component | Why here |
| --- | --- | --- |
| 1 | **Sortable list → board** (`alloy-sortable`, then `alloy-board`) | Unlocks four reorderings caley stores but cannot set, and later drag-to-reschedule in the calendar and touch/keyboard moves of messages to folders. It is the one candidate that shows sinter's model at its best: one optimistic merge, rollback, live sync. **Built (spike).** |
| 2 | **Split panes** (`alloy-split`) | Replaces `<email-split>` and its helpers with a reusable, accessible splitter; small and low-risk. Value is mostly code removed and consistency, so it ranks under the sortable despite being cheap. |
| 3 | **Date, time and range pickers** (`alloy-date`, `alloy-range`, `alloy-month`) | Fixes the locale mismatch of native inputs on `/de/` pages, gives search a real range, and replaces the calendar's hand-built month picker. The largest of the five to do well (calendar math, locales, keyboard grid): it ranks below split panes on cost. **Q-D1** asks whether native inputs stay the default. |
| 4 | **Command palette** (`alloy-palette`) | A new capability (go to a folder, contact, event, settings; run an action) with little code behind it, since sinter's `data-sn-options` already does the list keys. Lower than pickers because caley works without it; higher than virtual lists because it is cheap. |
| 5 | **Virtualized list** (`alloy-virtual`) | caley paginates on the server and lists stay short; temper's `data-lazy` (CSS only) covers most of what remains (contacts). Build it when a list outgrows `data-lazy`, not before. |

---

## 1. Sortable list and board

### `<alloy-sortable>` (built)

```html
<sn-resource name="tasks" src="/api/tasks" key="id" order="rank" type="Task[]"></sn-resource>

<alloy-sortable data-sn-with="{ items: tasks, keyOf: (t) => t.id, nameOf: (t) => t.title, label: 'Tasks',
                                resource: 'tasks', field: 'rank', save: '/api/tasks/order' }">
  <span slot="item" data-grow data-sn-text="$slot.item.title"></span>
</alloy-sortable>
```

That is the whole page side, as `paginate="…"` is the whole page side of a paged list. A first version made the page
wire every move itself (state, a hidden action, `run()`, two helper calls: about ten lines, and one trap, S3); it
was hard to use, so the component now owns the round trip.

**The assumed API shape.**

```
PUT <save>      { "order": ["key", …] }      every key of the list, in its new order
→ any 2xx       an answer that is the list, or an object holding it ({ "tasks": [...] }), has its `field` applied by key
```

The server renumbers the list 0…n−1 in that order, in one transaction. Chosen over "move one item"
(`{ key, after }`) because it is idempotent (safe to retry; concurrent moves converge, the last full order wins),
needs no fractional ranks on the server (plain integer columns), and is trivial to implement. Its limit: the whole
list must be loaded, so it is not for paginated or filtered lists (a `move` shape for those is a later mode, Q-S4).
caley's `PUT /api/email/folders/order` has this shape but for the body's name (`folder_ids`).

**What the component does on a drop** (`resource` and `save` given):

1. Emits `move` (cancelable). A page that prevents it does its own save; nothing else happens.
2. In the page's store (`instance(document)`: `app.resource(resource)`, `app.optimistic(change, run)`), merges the
   moved item's `field` (default `sort_order`) to a value between its new neighbours' (`alloy.between`). The
   resource keeps `order="<field>"`, so the store sorts the row into place at once; that is the whole optimistic
   reorder, one layer, rolled back by dropping it.
3. Sends `PUT <save> { order }` through sinter's request layer (headers, 401 handling, allowed origins). Moves made
   before an answer go out one after another, each with the order it made.
4. On success: applies the answer's sort values by key, so the fractions become the server's integers. On failure:
   the layer is dropped (the row goes back), `sort-error` `{ move, error }` is emitted (cancelable) and, unless
   prevented, the component's alert line shows `text.failed`.

A second tab (or device) follows through the server's own events (caley: `folders_changed` → `refresh`); an event
that arrives while a move is pending is applied to the base and the pending layer stays on top (sinter's model).

**Interim props, and the sinter asks behind them.** `resource` (the store name), `field` and `save` (a full URL,
with the API's base) say what the resource already knows. Once sinter passes a resource handle as a prop (S9) and the
handle exposes its resolved `src` and `order` (S10), they go: `items: tasks` alone is enough, `save` defaults to
`<src>/order` and `field` to the resource's `order`. The resource name is not checked by `sinter check` until then.

**API.**

- Props: `items: readonly any[]`, `keyOf(item): string`, `nameOf?(item): string`, `label: string`, `resource?`,
  `field?`, `save?`, `disabled?`, `quiet?` (handles on hover/focus only; always on touch),
  `text?: Partial<SortableText>`.
- Slot `item: Slot<{ item: any; index: number }>`: the app's row, in the app's scope. The component owns the row's
  frame (an `<li>` with a grip handle before the fill), so it can draw the row's moving state from its own state
  without touching slot content.
- Events: `move: Move` — `{ key, from, to, after, before, via }`; `to` counts the list without the item (as `splice`
  puts it back), `after`/`before` are the new neighbours' keys, so a "put it after X" API needs nothing else.
  `sort-error: SortError` — `{ move, error }`. Both cancelable.
- Helpers, for pages that save a move themselves: `reorder`, `keysAfter`, `between`, `moved`. `between(list, move,
  field)` is the key idea: halfway between the new neighbours' values (±1 past an end). Neighbours with equal values
  (a list never ordered: all `0`) cannot be split; the server's renumbered answer settles it.
- Without `resource` and `save` the component only emits `move`, and the page applies it (fixtures/manual.html: a
  hidden action with the same one-merge optimistic change). caley's mail sidebar still uses this form; moving it to
  the self-saving one is the caley step left for later.

**Keyboard and accessibility.**

- The handle is a `<button>` (`data-icon="grip-vertical"`), labelled "Move {name}", with the instructions in
  `aria-description`; `aria-pressed="true"` while its row is picked up.
- Space or Enter picks up (a click with `detail === 0`, so the browser's own button activation is used), ArrowUp /
  ArrowDown / Home / End move the target, Space or Enter drops, Escape cancels (and does not close a dialog around
  the list: the key stops at the component), focus leaving the list cancels.
- A polite `role="status"` region inside the component announces "Picked up X. Position 2 of 5.", each step, the
  drop and a cancel. After a keyboard drop the handle of the moved row gets the focus back once the page has moved it
  (a moved element loses focus in some browsers).
- The list is `role="list"` with `aria-label`. Not `listbox`: rows hold their own controls (links, buttons).
- Pointer: from the handle only. `touch-action: none` on the handle alone keeps the list scrollable on a phone; a
  movement threshold is not needed since the handle does nothing else. The row follows the pointer
  (`translateY` from state), a 2px accent line marks the drop place, the nearest scrolling box autoscrolls within
  40px of its edges, Escape cancels.
- Reduced motion: no transitions.

**Styling.** temper attributes on the component's markup: `data-layout="stack"`/`"row"`, `data-variant="ghost"
data-size="sm" data-icon="grip-vertical"` on the handle, `data-sr-only` on the live region. Remaining scoped CSS
(about 20 lines, tokens only): list reset, `touch-action`/`cursor` on the handle, the lifted row's surface and shadow
(`--tm-surface-raised`, `--tm-shadow-sm/lg`), the drop line (`--tm-accent`), hiding quiet handles on hover devices.
Each is a temper candidate (T1–T3 below).

**Runtime cost.** Script plus state machine: **2.2 kB gzip** minified (measured before the self-saving mode; that
adds well under 1 kB: `save.ts` and the store calls); helpers (`order.ts`): 0.3 kB, foldable at build time. The markup is expanded per use like any component. Bundled with the pages that use it (the mail page),
nowhere else.

**Tests.** In this repository: the state machine and helpers (every from→to pair checked against a store-like sort
by `between`; the request body and the answer's values), `sinter check --strict` over the three fixtures, `render()`
with the real script (keyboard move; the row moved before the answer; the body; a refused save rolls back with the
note; the renumbered answer replacing the fractions; moves queued one after another; the page's own save; Escape;
German words), and Chromium over the fixtures built with sinter and temper under a strict CSP (mouse drag with the
drop line and the saved order after a reload, keyboard move and focus, a refused save, a touch drag on a phone
viewport, the page's own request). In caley (the first, page-wired form): three mail page tests
(keyboard move and the request body, a refused order goes back with a note, `folders_changed` re-sorts), the
backend's reorder unit tests and cross-user case, and `npm run check:folders`, a Playwright check against the build
on the demo backend: mouse drag (row follows, line placed, order at once, saved after reload), keyboard move with
its announcements and focus, Escape, a second tab following through `folders_changed`, a touch drag on a phone
viewport with the sidebar as a drawer, and no console error or CSP violation (CSP `script-src 'self'`).

**Where caley uses it next:** mail accounts in the mail sidebar and settings (`imap_accounts.sort_order`), CalDAV
accounts and calendars (`caldav_accounts.sort_order`; calendars would need a column), identities (the compose
"From" order and default). Each needs only an order endpoint like the folders' one.

### `<alloy-board>` (built)

```html
<alloy-board data-sn-with="{ lists: columns, listKey: (c) => c.id, listName: (c) => c.title, items: cards,
                             keyOf: (c) => c.id, nameOf: (c) => c.title, group: 'status', label: 'Board',
                             resource: 'cards', field: 'rank', save: '/api/cards/order' }">
  <article slot="item" data-sn-text="$slot.item.title"></article>
</alloy-board>
```

Several columns, cards moved within and between them: a kanban board, and in caley later the calendar (an event to
another day) and messages dropped on a mailbox.

- One resource of cards with a group field (`status`) and a sort field: a move between columns is still one `merge`
  (both fields), so the same rollback and sync apply. The markup renders each column as a `data-sn-for` over
  `items.filter((x) => x[group] === listKey(l))`.
- Assumed shape, the sortable's for one column: `PUT <save> { group, order }`, `order` every key of the target column
  in its new order; the server sets the card's group and renumbers that column. Still one idempotent request. An
  answer holding cards has their group and sort field applied by key.
- `BoardMove` extends `Move` with `fromGroup` and `toGroup` (`from` in the old column, `to` in the new one, counted
  without the card); cancelable, as the sortable's. Helpers for pages that apply it themselves: `columnAfter` (the
  target column's order), `rankIn` (the card's new sort value there), `regroup` (cards kept in state).
- Keyboard: as the sortable, plus ArrowLeft/ArrowRight move to the neighbouring column at the same index (or its end),
  and announcements name the column ("Beta: Doing, position 2 of 2"). Pointer: the column under the pointer (else the
  nearest), the place by the rows' middles; the card follows the pointer (`translate` from state); an empty column is
  outlined as the target; the board scrolls sideways and the page vertically near the edges.
- Columns are drop targets only (no reordering of columns, **Q-B1**). The calendar's time grid (a place that is a time,
  not an index) is not covered: a `placeOf` prop or a separate `alloy-schedule` (**Q-B2**). Message → mailbox drops
  (targets without cards) are not covered yet either.
- Styling: temper attributes (`data-layout`, `data-scroll`, `data-caption`, `data-badge`, the ghost handle); scoped
  CSS with tokens for the column surface (`--tm-fill`), the card (`--tm-surface`, `--tm-border`), the lifted card, the
  drop line and the empty column's outline (T1–T3, plus a column surface).
- Cost: **3.6 kB gzip** for the script with its state machine and the save (the sortable: 2.9 kB with its save).
- Tests: the state machine (within and across columns, ends, empty columns, the line, hit testing), the helpers, render
  tests with the real script (keyboard across columns with the announcements, the request body, the answer, a refused
  save, cards in state with custom headers) and Chromium (a drag to another column with the line and the saved state
  after a reload, a drag into an empty column, keyboard over state; strict CSP, no errors).

## 2. Split panes: `<alloy-split>`

```html
<alloy-split data-sn-with="{ name: 'mail-sidebar', min: 140, max: 400, initial: 220, label: m.mail_aria_folders() }">
  <aside slot="start">…</aside>
  <section slot="end">…</section>
</alloy-split>
```

- No API to assume: the opinion is that it owns the layout of its two panes (slots `start` and `end`) and keeps its
  size itself (persisted under `name`, as `data-sn-persist` would), so the page writes no state, styles and helpers.
  caley's `mail-widths` state, `clampWidth`/`keyWidth` and the handle CSS go. A second form for a page that keeps the
  size in its own state is the separator alone with `data-sn-model` (sinter's custom input contract).
- Props: `name` (the storage key), `initial`, `min`, `max` (px), `step?` (keyboard, default 16), `label`,
  `orientation?: 'vertical' | 'horizontal'`, `reverse?` (the `end` pane is the sized one).
- Keyboard and a11y: `role="separator"`, `tabindex="0"`, `aria-orientation`, `aria-valuenow/min/max`,
  `aria-controls` (the sized pane's id, **Q-SP1**), `aria-label`. Arrow keys by `step`, Shift+Arrow by 4×, Home/End
  to min/max, Enter toggles collapsed (to min) and back (WAI-ARIA window splitter pattern).
- Pointer: drag with pointer capture, the size follows on every frame (rAF), double-click resets to `initial`.
  Clamping is the component's (it knows min/max), and it emits `change` with the size for a page that wants it.
- Styling: needs temper's separator look (T4); until then scoped CSS for the hit area and a hover/focus line.
- Cost: under 1 kB gzip. Replaces `email-split.html/.ts`, two helpers and the handle CSS in caley.

## 3. Date, time and range pickers

Three components over one pure calendar module (`calendar.ts`: the month grid for a locale's first weekday, ISO
dates as strings, no time zones: a date picker picks a calendar date):

- `<alloy-date data-sn-model="draft.date" data-sn-with="{ label, min?, max?, required?, marks? }">` — a text field
  (typed dates parsed in the page's locale) with a calendar popover. Value: `'YYYY-MM-DD'` or `''`.
- `<alloy-range data-sn-with="{ params: ['start', 'end'], label, presets? }">` — two dates and one calendar that
  selects a range (first click start, second end; end < start swaps), with presets ("Last 7 days", "This month").
  The assumed shape is the URL's: ISO dates in those two query parameters, written as a `$url` model would (a
  history entry per pick), so a search page's resource that reads `$url.start` and `$url.end` reloads by itself.
  For state instead of the URL: `data-sn-model` on a `{ start, end }` value (**Q-D2**).
- `<alloy-month data-sn-model="gridMonth" data-sn-with="{ marks }">` — the calendar's month/week picker as a
  component, `marks` (days with events) from the page's resource; replaces caley's hand-built `#month-picker`.
- Time: `<alloy-time>` is not planned. Native `type="time"` is good on every platform; a time list (15-minute
  steps, typed times) for the event form is **Q-D3**.

**First frame.** The field and the popover's grid for the current value render as markup (the grid is a
`data-sn-for` over a helper, `alloy.monthGrid(value, $locale)`, which folds or renders early). The script only
moves the focus in the grid and parses typing.

**Keyboard and a11y.** The field is a combobox (`aria-haspopup="dialog"`); the popover is a `[popover]` (temper's
`data-menu` placement) holding a `role="grid"` with roving focus: arrows by day/week, PageUp/PageDown by month
(Shift: year), Home/End to week start/end, Enter selects, Escape closes and returns focus. The month heading sits centred between the previous and next buttons. Today is
`aria-current="date"`, the selection `aria-selected`, disabled days `aria-disabled`. Month and year headings are
live. Week starts and names come from `Intl` for `$locale`, so `/de/` pages show German, Monday-first calendars
whatever the browser's language.

**Styling.** temper: the popover (`data-menu`), ghost buttons for days, `data-caption` for weekday names. Needs:
a 7-column grid (backlog item 41), `aria-current="date"` styling (item 42), a selected-range fill (T5).

**Cost.** About 3 kB gzip for the three (shared module), mostly `Intl` glue and the grid's keyboard.

## 4. Command palette: `<alloy-palette>`

```html
<alloy-palette data-sn-with="{ src: '/api/search/commands', label: m.palette_label() }"></alloy-palette>
```

- Opens with Mod+K (and `/` optionally) from anywhere (a key filter on `<body>` that the component's docs give the
  page, `data-sn-on-keydown-mod-k="openDialog('palette')"`, or the component listens on its document: **Q-C1**).
- A modal `<dialog>` with a search field and a list. The list keys are sinter's own `data-sn-options` (a combobox:
  arrows, Enter, Escape, `aria-activedescendant`), so the script only does what sinter does not: fuzzy ranking
  (a pure `rank(query, commands)` helper, so it renders early and is tested without a DOM), opening on the shortcut,
  restoring focus, and remembering recent picks (localStorage, per-viewer).
- Zero setup: it builds its commands from the page itself, every link of the navigation (`nav a[href]`) and every
  button with a `data-shortcut` (its label and key), so `<alloy-palette></alloy-palette>` is useful as is. A page adds
  its own commands as data, `{ id, label, group?, keywords?, href?, shortcut?, icon? }`; a link swaps like any link, an
  action is the page's (the component emits `pick`).
- Remote results, the assumed shape: `src="/search/commands"` → `GET <src>?q=<text>` answering
  `[{ id, label, href, group? }]`, requested through sinter's request layer as the user types (latest wins, a pause
  of 150 ms). caley would answer it from its search (folders, contacts, events) (**Q-C2**).
- a11y: `role="combobox"` field (sinter adds it with `data-sn-options`), `role="listbox"` grouped with
  `role="group"`/`aria-labelledby`, shortcuts in `aria-keyshortcuts` and shown as `<kbd>`.
- Styling: temper's dialog and `data-menu` list; needs a top-anchored dialog variant and a marked-option style for
  `[data-sn-marked]` (T6).
- Cost: about 1.5 kB gzip (ranking included).

## 5. Virtualized list: `<alloy-virtual>`

```html
<sn-resource name="contacts" src="/contacts" paginate="{ append: { after: $item.id }, size: 50 }"></sn-resource>

<alloy-virtual data-sn-with="{ items: contacts, keyOf: (c) => c.id, estimate: 56, label, resource: 'contacts' }">
  <contact-row slot="item" data-sn-with="{ contact: $slot.item }"></contact-row>
</alloy-virtual>
```

**It reuses sinter's pagination; it does not bring its own.** sinter's `append` mode is the "load more / infinite
scroll" mode: every loaded page stays in the list, `page(list, 'next')` loads the next one, `hasNext` turns false
after a short page, and the cursor and parameters are the API's, configured once (`apis.<name>.paginate`). The
virtual list is the other half: it renders only the loaded rows in view.

- Rendering: a `data-sn-for` over `items.slice(start, end)` (state the script writes from the scroll position and
  measured heights) between two spacers sized from state. Rows are keyed, so sinter reuses them while scrolling.
- Loading: near the end of what is loaded it asks for the next page itself, through the store (with `resource`;
  S9 would make it the handle's), or emits `end` for `data-sn-on-end="page(contacts, 'next')"`. It stops when
  `$meta.contacts.hasNext` is false. `$meta.contacts.total` (when the server sends it) sizes the scrollbar for the
  rows not loaded yet and gives `aria-setsize`.
- First frame: sinter already reserves `size` rows' space for a paginated list before its data arrives, and the
  first page renders as plain markup (embedded data), so nothing changes for the first paint.
- Live updates insert and remove rows as usual (an `upsert` outside the loaded range becomes a reload of that page,
  sinter's rule); the script keeps the scroll anchored to the first visible key.
- Not for numbered or keyset pages (they replace the list), and not instead of `data-lazy`: temper's CSS-only
  `content-visibility` keeps every row in the DOM (find in page works) and is the first choice up to a few thousand
  rows. caley needs neither yet (**Q-V1**).
- Keyboard and a11y: `role="list"`, `aria-setsize`/`aria-posinset` on rows; `data-sn-options` must be able to mark a
  row not rendered yet (S6).
- Cost: about 1.5 kB gzip.

---

## What sinter-alloy needs from sinter (no changes made to sinter)

| | Need | Why | Found in |
| --- | --- | --- | --- |
| S1 | **Generic components**: type parameters on `data-sn-props`, inferred per use (`<template data-sn-props="<T>{ items: readonly T[]; keyOf: (item: T) => string; item: Slot<{ item: T }> }">`) | Today `items` is `any[]` and `$slot.item` is `any`: the app's fill loses type checking, and caley casts in a let (`/** @type {VirtualFolder} */ ($slot.item)`). Every alloy collection component (sortable, board, virtual, palette) has this. | spike |
| S2 | **`$event` in `data-sn-optimistic` (and `data-sn-when`) of an action triggered by a component event**, or `data-sn-when` allowed on a component's tag | The natural wiring is the action on the tag, `data-sn-put="…" data-sn-trigger="move"` with `$event.detail` in body and optimistic change. The body accepts `$event`; the optimistic change does not (SN201), and `data-sn-when` cannot go on a component's tag (SN102), so a page needs state plus a hidden `run()` target. | spike |
| S3 | **Investigate a `run('id')` that did nothing in a built page** | In caley's mail page, a hidden action span inside the sidebar `<aside data-sn-state="…">` was not started by `run()` in the build: the handler ran and set the state the target's `data-sn-when` reads, but no request, `then` or `catch` followed. The same markup works in `render()`, and moved to the page's top level (beside `#wipe`) it works. A nested state scope alone is not the cause: this repository's fixtures/manual.html has its target in a `<main data-sn-state>` and works in Chromium. The aside sits in a large page with embedded data, swaps and a permanent rail; a reduced repro from caley is the next step. The self-saving sortable no longer needs `run()`. | spike |
| S4 | **A component script's state writes flush with `flush()` in tests**, or document that they render on the next task | `render()` tests must `await settle()` (which also waits for held requests) or wait a task, to see what a script set. | spike |
| S5 | **`render()` takes `libraries`**, and a library can import its own component scripts in its own tests | Apps glob a library's `node_modules` files into `components`/`scripts` (caley does it for sinter-mail and alloy). A library's own vitest needs a self-link in `node_modules` (alloy's `test/link.ts`) because sinter serves a script's `.html` base class only for a configured library. | spike |
| S6 | `data-sn-options` able to mark an option that is not rendered (a callback or event the list answers by scrolling it in) | Virtualized lists and long palettes. | design |
| S7 | Library messages: a library ships its own inlang messages, merged under its namespace, translated by the app | Every alloy component needs a `text` prop today (**Q-L1**). | design |
| S8 | Optional lazy component scripts (a script that loads on first focus/pointerdown on its root) | The palette and pickers are idle on most page loads; markup must still render early. | design |
| S9 | **A resource handle as a prop**: a prop typed `Resource<T>` (or a marker in `data-sn-props`) gets the store handle of the resource the use names (`items: tasks`), checked like store functions' arguments (SN301) | The self-saving sortable and the virtual list need the handle; today they take the resource's name as a string (`resource: 'tasks'`), which nothing checks, and find it with `instance(document).resource(name)`. With `T`, it also types the rows (S1). | after the spike |
| S10 | **The store handle exposes its resolved `src` and its `order` field** | Then `save` defaults to `<src>/order` and `field` to `order`, and the sortable needs only `items`. Today the handle has `name`, `key`, `meta`, `get`, `merge`, … but neither. | after the spike |

Already sufficient: slots that pass data (`Slot<T>`), component scripts with refs and state, `data-sn-model` on
components (split, pickers), `data-sn-options` (palette), resource `order` re-sorting merged items (the whole
optimistic-reorder idea rests on it: `store.ts` sorts layer values with the base), write-through, `<sn-event>`
refresh, `data-sn-persist`.

## What sinter-alloy needs from temper (no changes made to temper)

| | Need | Why |
| --- | --- | --- |
| T0 | **The Vite plugin reads sinter's `libraries`** (or a `libraries` option): checks their components and emits the icons they name | caley had to add `node_modules/@tiavision/sinter-alloy/sinter/components` to temper's `paths`; without it `grip-vertical` was missing from the CSS and the handles were empty. |
| T1 | A **drag handle**: `data-handle` (grip icon, `cursor: grab`, `touch-action: none`, hidden-until-hover option) | removes the handle CSS from alloy |
| T2 | **Moving states**: a lifted surface (raised background, shadow; e.g. `aria-pressed` on a row or `data-lifted`) and a **drop indicator** (`data-drop="before" \| "after" \| "inside"`: an accent line or outline) | sortable, board, mail drop targets (caley's `drag-target`/`drag-over` classes too) |
| T3 | A list reset for `ul[role="list"][data-layout]` (no bullets, no padding) | every list component |
| T4 | **Separator styling**: `[role="separator"][aria-orientation]` focusable hit area, hover and focus line (backlog item 32) | split panes |
| T5 | **Calendar grid**: fixed 7 columns (backlog 41), `aria-current="date"` (42), range fill (start, middle, end of `aria-selected` runs) | pickers |
| T6 | A **top-anchored dialog** (palette) and a marked-option style for `[data-sn-marked]` in `data-menu`/listbox | palette |

---

## Open questions

Decide these before the component they belong to is built.

- **Q-P1 — How caley consumes sinter-alloy.** Now `file:../../sinter-alloy` (a checkout beside caley's), which caley's CI and
  Docker build do not have yet. Options: publish `@tiavision/sinter-alloy` to npm and depend on a version; depend on the
  GitHub repo; or check out both repos side by side in CI and Docker.
  Recommendation: the GitHub dependency (`github:tiavision/sinter-alloy#v0.1.0`) until 0.x settles, then npm.
- **Q-L1 — Words.** A `text` prop of functions per component (today) or library messages merged into the app's inlang
  project (needs S7)? Recommendation: `text` now, S7 when a second library needs it.
- **Q-S1 — decided:** the sortable saves itself against one shape, `PUT <list>/order { order }`, with interim props
  (`resource`, `field`, `save`) until S9/S10; the page-wired form stays for other API shapes.
- **Q-S2 — Whole row as the grab area.** Handles only (today: clear on touch, never fights a row's click) or also
  the whole row with a mouse after a 4 px threshold? Recommendation: handles only, `grab: 'row'` later if asked.
- **Q-S4 — A second shape for long lists:** `POST <list>/move { key, after }` for paginated or filtered lists, where the
  whole order is not loaded. Not before a list needs it.
- **Q-S3 — Where else to reorder in caley first:** mail accounts, CalDAV accounts/calendars, identities. Each needs
  a backend endpoint like `PUT /email/folders/order`; calendars need a `sort_order` column.
- **Q-B1 — Boards: reorder the lists themselves?** (kanban columns). Not in v1 unless a use appears.
- **Q-B2 — One board for kanban and the calendar grid** (a `placeOf` mapping pointer → `{ list, at }`), or a
  separate `alloy-schedule` for time grids? Recommendation: try one; split if the props get conditional.
- **Q-SP1 — Split panes and ids.** `aria-controls` needs the pane's id; pass it as a prop (`controls: 'mail-list'`)
  or let the component find the previous sibling? Recommendation: a prop.
- **Q-D1 — Native date inputs.** Keep native inputs as the default and use `alloy-date` only where the locale or
  marks matter (calendar, search), or replace them everywhere for consistency?
- **Q-D2 — Range binding:** the URL form (`params: ['start', 'end']`) is the assumed default; is a
  `data-sn-model` form on a `{ start, end }` value needed too?
- **Q-D3 — Time picker:** keep native `type="time"`, or a list of times for the event form?
- **Q-C1 — Palette shortcut:** the page binds Mod+K (explicit, visible in markup) or the component listens on the
  document (zero setup, hidden behaviour)?
- **Q-C2 — Palette data:** the page's own links and shortcuts plus `GET <src>?q=` → `[{ id, label, href, group? }]`;
  is that shape right for caley's search, or should results carry an action besides a link?
- **Q-V1 — Virtual list:** build at all, or rely on temper's `data-lazy` until a list needs more? It needs nothing new
  from sinter's pagination (`append` mode), only S9 to load pages without a page handler.
