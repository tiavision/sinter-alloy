# sinter-alloy: design

Status: every component is built: `<alloy-sortable>` (used in caley's mail sidebar in its page-wired form),
`<alloy-board>`, `<alloy-split>`, `<alloy-date>`/`<alloy-range>`/`<alloy-month>`, `<alloy-palette>`, `<alloy-virtual>`.
The open questions below were answered with the recommendations, marked *provisional* where they are not settled.
The browser tests below, written as "Chromium", run in Chromium, Firefox and WebKit (CI, `BROWSER=`); Firefox and
WebKit cannot drive a touch drag, so there the touch tests send the pointer events a touch makes. A preview page (`preview/`, published at https://tiavision.github.io/sinter-alloy/)
shows them all live. Open questions are marked **Q-…** and gathered at the end; each needs a decision before
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
4. **Built for temper.** temper is a required peer. Components use temper's attributes (`data-tm-variant`, `data-tm-layout`, `data-tm-icon`, …) and its
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
| Month/week picker | calendar header | A popover (`#month-picker`, `data-tm-menu`) with its own grid, month and year selects, a second resource (`pickerGrid`, `/calendar?month=`) for the month view: about 45 lines of markup plus helpers. | Hand-built, calendar-only. |
| Date range | search (`start`, `end`), mail search (`after`, `before`) | Two separate date inputs bound to `$url`. | Nothing stops end < start; no presets. |
| Command palette | — | None. Shortcuts are `data-shortcut` buttons (src/islands/common.ts). | A missing feature. |
| Long lists | mail list, contacts, search results | Mail and search are paginated by the server (offset pages in `$url.page`, keyset for search). Contacts loads every contact and filters in the browser, grouped by letter. temper's `data-tm-lazy` (content-visibility) is not used. | Fine at today's sizes; contacts grows with the address book. |
| Resizable panes | mail: folders \| list \| reader | `<email-split>` (a component with a 34-line script), `clampWidth`/`keyWidth` helpers, keyboard handled on the tag, widths in persisted state (`mail-widths`), CSS for the handle. Used twice. | Bespoke; temper's backlog item 32 asks for it. |

## Ranking

By value to caley (what users get, what code goes away, how often it is used), against cost and risk:

| # | Component | Why here |
| --- | --- | --- |
| 1 | **Sortable list → board** (`alloy-sortable`, then `alloy-board`) | Unlocks four reorderings caley stores but cannot set, and later drag-to-reschedule in the calendar and touch/keyboard moves of messages to folders. It is the one candidate that shows sinter's model at its best: one optimistic merge, rollback, live sync. **Built (spike).** |
| 2 | **Split panes** (`alloy-split`) | Replaces `<email-split>` and its helpers with a reusable, accessible splitter; small and low-risk. Value is mostly code removed and consistency, so it ranks under the sortable despite being cheap. |
| 3 | **Date, time and range pickers** (`alloy-date`, `alloy-range`, `alloy-month`) | Fixes the locale mismatch of native inputs on `/de/` pages, gives search a real range, and replaces the calendar's hand-built month picker. The largest of the five to do well (calendar math, locales, keyboard grid): it ranks below split panes on cost. **Q-D1** asks whether native inputs stay the default. |
| 4 | **Command palette** (`alloy-palette`) | A new capability (go to a folder, contact, event, settings; run an action) with little code behind it, since sinter's `data-sn-options` already does the list keys. Lower than pickers because caley works without it; higher than virtual lists because it is cheap. |
| 5 | **Virtualized list** (`alloy-virtual`) | caley paginates on the server and lists stay short; temper's `data-tm-lazy` (CSS only) covers most of what remains (contacts). Build it when a list outgrows `data-tm-lazy`, not before. |

---

## 1. Sortable list and board

### `<alloy-sortable>` (built)

```html
<sn-resource name="tasks" src="/api/tasks" key="id" order="rank" type="Task[]"></sn-resource>

<alloy-sortable data-sn-with="{ items: tasks, keyOf: (t) => t.id, nameOf: (t) => t.title, label: 'Tasks',
                                resource: 'tasks', field: 'rank', save: '/api/tasks/order' }">
  <span slot="item" data-tm-grow data-sn-text="$slot.item.title"></span>
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

- The handle is a `<button data-tm-handle>` (temper draws its grip), labelled "Move {name}", with the instructions in
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

**Styling.** temper attributes on the component's markup: `data-tm-layout="stack"`/`"row"`, `data-tm-handle`
(`"quiet"` with the `quiet` prop: hidden until the row is hovered or focused, on devices that hover) and
`data-tm-size="sm"` on the handle, `data-tm-lifted` and `data-tm-drop` on the moving row and the drop place,
`data-tm-sr-only` on the live region. Scoped CSS left (four lines): the row's radius, the cursor on the whole list
while dragging, and the lifted row following the pointer (`translateY` from state). The rest was alloy's until temper
took it (T1–T3 below).

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
- Styling: temper attributes (`data-tm-layout`, `data-tm-scroll`, `data-tm-caption`, `data-tm-badge`, the ghost handle); scoped
  CSS with tokens for the column surface (`--tm-fill`), the card (`--tm-surface`, `--tm-border`), the lifted card, the
  drop line and the empty column's outline (T1–T3, plus a column surface).
- Cost: **3.6 kB gzip** for the script with its state machine and the save (the sortable: 2.9 kB with its save).
- Tests: the state machine (within and across columns, ends, empty columns, the line, hit testing), the helpers, render
  tests with the real script (keyboard across columns with the announcements, the request body, the answer, a refused
  save, cards in state with custom headers) and Chromium (a drag to another column with the line and the saved state
  after a reload, a drag into an empty column, keyboard over state; strict CSP, no errors).

## 2. Split panes: `<alloy-split>` (built)

```html
<alloy-split data-sn-with="{ name: 'mail-sidebar', initial: 220, min: 140, max: 400, label: m.mail_aria_folders() }">
  <aside slot="start">…</aside>
  <section slot="end">…</section>
</alloy-split>
```

- No API to assume: the opinion is that it owns the layout of its two panes (slots `start` and `end`, a grid as large
  as its box) and keeps its size itself, in localStorage under `sn:alloy-split:<name>` (a stored value is clamped to
  min/max, so a changed max does not break it). The page writes no state, styles or helpers: caley's `mail-widths`
  state, `clampWidth`/`keyWidth` and the handle CSS would go. A page that keeps the size in its own state binds it with
  `data-sn-model` (sinter's custom input contract: `value` and `change`); nothing is stored then.
- Props: `name`, `value`, `initial`, `min`, `max` (px), `step` (keyboard, default 16), `label`, `controls` (the sized
  pane's id for `aria-controls`; decided Q-SP1: a prop), `direction: 'row' | 'column'`, `reverse` (the `end` pane is
  sized). Event `change` with the size after each move.
- Keyboard and a11y: `role="separator"`, focusable, `aria-orientation` (vertical for a row split),
  `aria-valuenow/min/max`, `aria-label`, `aria-controls`. Arrow keys by `step` (the direction's own arrows, reversed for
  an end pane), Shift by 4×, Home/End to min/max, Enter collapses to min and opens to the remembered size (WAI-ARIA
  window splitter pattern).
- Pointer: drag with pointer capture (mouse, touch, pen; `touch-action: none` on the separator only), the size follows
  every frame, double-click puts it back to `initial`; the separator takes the focus, so the keys work after a drag.
- First frame and CSP: the size is a style binding (`--al-size`), which sinter pre-renders into the HTML as a `style`
  attribute. Under `style-src 'self'` alone the attribute is blocked: the panes start at a 30% fallback and the page
  module applies the size. A page needs `style-src-attr 'unsafe-inline'` for a right first frame (caley's CSP has
  `style-src 'self' 'unsafe-inline'`). A stored size is read by the script, after the first paint: the panes may move
  once on load for a size that differs from `initial` (S11).
- Styling: a 9px hit area with a 1px `--tm-border` line, `--tm-accent` and 3px on hover, focus and while dragging; scoped
  CSS (T4 would move it to temper). Not yet: a narrow-screen mode (panes stacked), which caley's mail page does itself.
- Tests: the decisions (keys, drag, collapse, stored values), render tests with the real script (keys, the stored size
  coming back, Enter, a bound value), Chromium (mouse drag with clamping, the stored size after a reload, double-click,
  a model-bound reversed split, a column split, a touch drag, and the page under `style-src 'self'` alone).

## 3. Date, range and month pickers (built)

Three public pickers over one internal day grid (`internal/alloy-calendar`) and one pure module (`calendar.ts`: ISO
dates computed in UTC, the month grid, names and the first weekday from `Intl`, typed-date parsing, the keys,
range picks, presets):

- `<alloy-date data-sn-model="draft.date" data-sn-with="{ label, min?, max?, marks?, required?, placeholder? }">` — a
  field and a calendar in a popover under it. The field's text is sinter's `date(value, 'medium')`, so it is in the
  first frame in the page's language; typing is read in that language's order of day, month and year (from
  `Intl.DateTimeFormat#formatToParts`), a two-digit year in this century, or an ISO date; a text that is no date (or
  outside min/max) is `aria-invalid` and changes nothing.
- `<alloy-range data-sn-with="{ params: ['start', 'end'], start: $url.start, end: $url.end, label }">` — the URL is the
  assumed shape (decided Q-D2): with `params` the script writes both parameters through sinter's `navigate()` (a
  history entry; the page stays; resources that read them reload), '' removing one; without, the page applies the
  cancelable `change` (`{ start, end }`). One calendar: the first pick starts the range, the second ends it (an
  earlier day becomes the start), the days between fill as the pointer moves; presets (last 7 and 30 days, this and
  last month) and Clear.
- `<alloy-month data-sn-model="month">` — a year of months; arrows by a month (↑/↓ by three), PageUp/PageDown by a year.
- Time: not built (Q-D3, provisional: the native `type="time"` stays).

**First frame.** The field and the buttons render as markup; the grids are in closed popovers and are computed by the
script when it connects. **Language.** `$locale` where the app has languages, else the `lang` of the page (an app
without sinter's languages has an empty `$locale`, found while testing).

**Keyboard and a11y.** The popover is a `[popover]` with `role="dialog"`, opened from its button as the popover's
`source` (which anchors it there; no ids, see S13), `aria-expanded` on the button. The day grid is a `role="grid"`
table with roving focus: arrows by a day or a week, PageUp/PageDown by a month (Shift: a year), Home/End to the week's
ends, Enter or Space picks; the month follows the focus; today is `aria-current="date"`, picked days `aria-selected`,
days outside min/max `aria-disabled`; each day's button is labelled with its full date ("Tuesday, November 10, 2026").
The keys work from the focus the grid keeps in state, not from the element the browser has focused, so fast keys
(before the focus has moved) still land on the right day. Escape closes (the popover's own), Alt+ArrowDown opens the
date field's.

**Styling.** temper's popover (`data-tm-menu`), `data-tm-field`, ghost and outline buttons; scoped CSS for the day buttons
(selected, between, today's ring, marks' dot, disabled) and a reset of temper's data-table look (stripes, row lines)
on the grid's table (T5).

**Cost.** Calendar grid 1.8 kB gzip, each picker 1.1–1.2 kB (with its share of `calendar.ts`).

**Tests.** The calendar module (dates across month ends and summer time, German/British/American weeks, grids,
parsing in three orders, keys, ranges, presets); Chromium (the date's text and grid in the language, the popover under
its button, keys, typing, an invalid text; a range into the URL with the fill while picking, Clear, a preset; the
month's keys).

## 4. Command palette: `<alloy-palette>` (built)

```html
<alloy-palette data-sn-with="{ label: 'Commands', src: '/api/search/commands' }"></alloy-palette>
```

- Opens with Ctrl+K / ⌘K, listened for by the component on its document (decided Q-C1, provisional: zero setup;
  `keys: false` turns it off for a page that binds its own), or its button, which shows the shortcut.
- Commands: the page's own, collected when it opens (its navigation's links, "Go to"; its buttons with `data-shortcut`
  or `aria-keyshortcuts`, "Actions"; hidden, inert and disabled ones left out), the `commands` prop, and with `src`
  the server's answers: `GET <src>?q=` → `[{ id, label, href?, group?, keywords?, shortcut? }]` through sinter's request
  layer, after 150 ms, the latest winning (decided Q-C2, provisional).
- Ranking (`palette.ts`, pure): every word of the query must match a label (at its start, at a word's start, inside,
  or as letters in order), keywords count, accents are folded; an empty field shows the recent picks first (the last
  five, kept whole in localStorage, so a server's answer comes back too).
- Picking: a link is followed with sinter's `navigate()`, a page button is clicked (and gets the focus back), anything
  else emits `pick` for the page. The dialog closes and the focus goes back where it was.
- Keys and a11y: the field is sinter's `data-sn-options` combobox (arrows, `aria-activedescendant`, Enter clicks the
  marked option); Escape arrives as `sn-dismiss` (the combobox keeps the key while its list shows) and closes; a click
  on the backdrop closes. The list is a `listbox` of `option`s with their group and shortcut.
- Found while building it: a `<dialog>`'s contents (and the refs inside it, and the dialog itself as a ref) are not
  rendered until it opens, so a component script reaches them by query after `showModal()` (S14).
- Styling: temper's dialog, `data-tm-field`, `kbd`; the top-anchored position a palette usually has needs a temper
  variant (T6: temper's checker refuses an outer margin, TM206).
- Cost: 2.2 kB gzip with the ranking.
- Tests: ranking and recents; Chromium (Ctrl+K, the page's commands, ranking, following a link, clicking a page
  button, a page command's `pick`, the server's answers, recents, Escape).

## 5. Virtualized list: `<alloy-virtual>` (built)

```html
<sn-resource name="contacts" src="/contacts" paginate="{ append: { after: $item.id }, size: 50 }"></sn-resource>

<alloy-virtual data-sn-with="{ items: contacts, keyOf: (c) => c.id, estimate: 56, label, total: $meta.contacts.total }"
               data-sn-on-end="page(contacts, 'next')">
  <contact-row slot="item" data-sn-with="{ contact: $slot.item }"></contact-row>
</alloy-virtual>
```

**It reuses sinter's pagination; it does not bring its own.** sinter's `append` mode is the "load more / infinite
scroll" mode: every loaded page stays in the list, `page(list, 'next')` loads the next one, `hasNext` turns false
after a short page, and the cursor and parameters are the API's, configured once (`apis.<name>.paginate`). The
virtual list is the other half: it renders only the loaded rows in view.

- Rendering: a `data-sn-for` over `items.slice(start, end)` (state the script writes from the scroll position and
  measured heights) between two spacers sized from state. Rows are keyed, so sinter reuses them while scrolling.
- Loading: near the end of what is loaded it emits `end` (once per list length), answered by the page with
  `data-sn-on-end="page(contacts, 'next')"`; S9 would let it page by itself. It stops when
  `$meta.contacts.hasNext` is false. `$meta.contacts.total` (when the server sends it) sizes the scrollbar for the
  rows not loaded yet and gives `aria-setsize`.
- First frame: sinter already reserves `size` rows' space for a paginated list before its data arrives, and the
  first page renders as plain markup (embedded data), so nothing changes for the first paint.
- Live updates insert and remove rows as usual (an `upsert` outside the loaded range becomes a reload of that page,
  sinter's rule); the script keeps the scroll anchored to the first visible key.
- Not for numbered or keyset pages (they replace the list), and not instead of `data-tm-lazy`: temper's CSS-only
  `content-visibility` keeps every row in the DOM (find in page works) and is the first choice up to a few thousand
  rows. caley needs neither yet (**Q-V1**).
- Keyboard and a11y: `role="list"`, `aria-setsize`/`aria-posinset` on rows; `data-sn-options` must be able to mark a
  row not rendered yet (S6).
- The window (`virtual.ts`, pure): offsets from measured heights (the measured average for the rest, `estimate` before
  any), a binary search for the first and last rows in view, `overscan` rows each side, the spacers' heights. A
  ResizeObserver measures the rows (their border box) and the box; the first row in view keeps its place across
  height changes and when rows are added.
- Scrolling: the scroll handler reads only `scrollTop`, once a frame; the offsets are computed again only when the
  items or a height change; the window moves only when the view comes within half the overscan of the rows rendered
  (a scroll of a row or two changes nothing in the page); only a new `items` array is a change of props (a page's
  `keyOf` arrow is new at every render, which made every window change measure everything again). Against the same
  rows scrolled natively by the browser, with nothing virtual (Chromium, 4× CPU throttling), it adds about 20
  points of CPU at a normal pace (it added 28) and nothing at a fling, where the browser's own painting is the
  limit.
- Keys: the list is focusable and scrolls with the browser's own keys; marking rows not rendered (S6) is not done.
- Cost: 1.1 kB gzip.
- Tests: the window; Chromium over 2,000 people in pages of 100 (a screenful rendered, the scroll height for all
  loaded rows, pages loading as the view reaches the end, `aria-posinset`/`aria-setsize`, back to the top); a scroll
  of a row or two changes nothing in the page; a row above the view that grows leaves the rows in view in place.

---

## What sinter-alloy needs from sinter

**Status:** in sinter's `main` (tiaforge/sinter#121–#123, not released yet): S10 (the handle's `src` and `order`:
the sortable's and the board's `save` and `field` now default to the resource's own), S14 (refs inside a closed
dialog: the palette uses them, with a query as the fallback for 0.22), S15 (`$locale` is the page's `lang`; the
calendar's own `lang` fallback stays for 0.22), one copy of sinter for a linked library (caley's `resolve.dedupe`
becomes unneeded), `$event` in `data-sn-optimistic` and actions on a component's tag (a page-wired sortable needs no
state and hidden `run()` target), the CSP note on first-frame `style` attributes (S12, docs). Still open, asked of
sinter (its verdicts: later, each needing a design first): S13 (ids per use: the pickers open their popovers from script, which is correct as it is; the palette's field finds its list with an empty `data-sn-options`, so it works more than once per page, without `aria-controls`), S9 (a resource handle as
a prop: `resource: 'folders'` stays), S6; S3 needs a reduced repro from caley. Found on the way: sinter linked into an app (`npm link`) breaks its
own plugin, and it cannot be installed from a git commit (no `prepare`), so unreleased sinter is tested from a packed
tarball.

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
| S11 | **Persisted state with a computed key, restored by the early script** (`data-sn-persist` whose key reads a prop) | The split keeps its size under `name`; restored by its script, after the first paint, the panes can move once on load. `data-sn-persist` takes a literal key, so a component used twice cannot persist each use. | split |
| S12 | **First-frame styles without a `style` attribute** (e.g. sinter's per-page stylesheet for initial style bindings, or setting them from the early script) | A style binding's initial value is written as a `style` attribute, which `style-src 'self'` blocks: the split needs `style-src-attr 'unsafe-inline'` for a right first frame. | split |
| S13 | **Unique ids for a component's own elements** (an id the build derives per use, for `aria-controls`, `popovertarget`, `aria-activedescendant`) | An `id` bound from data is SN503 (DOM clobbering) and a literal one breaks with two uses: the pickers open their popovers from the script (`showPopover({ source })`) instead of `popovertarget`, and the palette can only be used once per page (its list's literal id). | pickers, palette |
| S14 | **Refs inside a `<dialog>`**, or a documented way for a script to reach a deferred dialog's contents | A dialog's contents render when it opens, and its refs (the dialog itself included) are not set: the palette finds its dialog and field by query. | palette |
| S15 | **`$locale` in an app without languages** (the base language, or the page's `lang`) | It is empty there; the pickers fall back to the `lang` attribute. | pickers |

Already sufficient: slots that pass data (`Slot<T>`), component scripts with refs and state, `data-sn-model` on
components (split, pickers), `data-sn-options` (palette), resource `order` re-sorting merged items (the whole
optimistic-reorder idea rests on it: `store.ts` sorts layer values with the base), write-through, `<sn-event>`
refresh, `data-sn-persist`.

## What sinter-alloy needed from temper

**Status:** done in temper's `main` (tiaforge/temper#18, not released yet; alloy's `temper-next` branch builds against
it). temper also moved every attribute to `data-tm-*` (alloy's markup follows). What alloy uses now:
`data-tm-handle` (with `"quiet"`: temper draws the grip, so no icon has to be emitted for it) and `data-tm-lifted`
/ `data-tm-drop` (`before`, `after`, `inside` for the board's empty column) in the sortable and the board; temper's
focusable `role="separator"` in the split; `data-tm-plain` and the `aria-current="date"` ring in the calendar;
`data-tm-sheet="top"` and the listbox options' look in the palette; the list reset (T3) everywhere. What alloy keeps
of its own: following the pointer while a row is dragged (`data-al-lifted="pointer"`, a transform), the picked
day's solid fill and the range's fill between two picks (a run across table rows is the script's), the
keyboard-marked option (`data-sn-marked`), the cursors on the whole component while dragging.

| | Need | Why |
| --- | --- | --- |
| T0 | **The Vite plugin reads sinter's `libraries`** (or a `libraries` option): checks their components and emits the icons they name | caley had to add `node_modules/@tiavision/sinter-alloy/sinter/components` to temper's `paths`; without it `grip-vertical` was missing from the CSS and the handles were empty. |
| T1 | A **drag handle**: `data-tm-handle` (grip icon, `cursor: grab`, `touch-action: none`, hidden-until-hover option) | removes the handle CSS from alloy |
| T2 | **Moving states**: a lifted surface (raised background, shadow; e.g. `aria-pressed` on a row or `data-tm-lifted`) and a **drop indicator** (`data-tm-drop="before" \| "after" \| "inside"`: an accent line or outline) | sortable, board, mail drop targets (caley's `drag-target`/`drag-over` classes too) |
| T3 | A list reset for `ul[role="list"][data-tm-layout]` (no bullets, no padding) | every list component |
| T4 | **Separator styling**: `[role="separator"][aria-orientation]` focusable hit area, hover and focus line (backlog item 32) | split panes |
| T5 | **Calendar grid**: fixed 7 columns (backlog 41), `aria-current="date"` (42), range fill (start, middle, end of `aria-selected` runs) | pickers |
| T6 | A **top-anchored dialog** (palette: an outer margin is TM206) and a marked-option style for `[data-sn-marked]` in `data-tm-menu`/listbox | palette |
| T7 | **`data-tm-menu` popovers anchored to a `source`** (`showPopover({ source })`), not only to a `popovertarget` button | the pickers open their popovers without ids (S13) |
| T8 | **A table that is a grid**: an opt-out of the data-table look (`table[role=grid]` without stripes and row lines) | the calendar resets it in scoped CSS |

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
- **Q-SP1 — decided:** `aria-controls` from a `controls` prop. **Q-SP2:** a narrow-screen mode (stack the panes below a
  width), or leave narrow layouts to the page as caley's mail page does now?
- **Q-D2 — decided:** the URL (`params`) is the assumed shape; `change` for anything else. **Q-C1 — provisional:** the
  component listens for Ctrl/⌘+K; `keys: false` hands it to the page. **Q-C2 — provisional:** the page's commands, the
  prop's, and `GET <src>?q=`. **Q-D3 — provisional:** no time picker; native `type="time"`. **Q-V1 — built**, with
  temper's `data-tm-lazy` still the first choice.
- **Q-D1 — Native date inputs.** Keep native inputs as the default and use `alloy-date` only where the locale or
  marks matter (calendar, search), or replace them everywhere for consistency?
- **Q-D2 — Range binding:** the URL form (`params: ['start', 'end']`) is the assumed default; is a
  `data-sn-model` form on a `{ start, end }` value needed too?
- **Q-D3 — Time picker:** keep native `type="time"`, or a list of times for the event form?
- **Q-C1 — Palette shortcut:** the page binds Mod+K (explicit, visible in markup) or the component listens on the
  document (zero setup, hidden behaviour)?
- **Q-C2 — Palette data:** the page's own links and shortcuts plus `GET <src>?q=` → `[{ id, label, href, group? }]`;
  is that shape right for caley's search, or should results carry an action besides a link?
- **Q-V1 — Virtual list:** build at all, or rely on temper's `data-tm-lazy` until a list needs more? It needs nothing new
  from sinter's pagination (`append` mode), only S9 to load pages without a page handler.
