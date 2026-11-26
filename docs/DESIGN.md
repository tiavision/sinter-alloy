# sinter-alloy: design

Status: draft. Phase 1 (this document) and the phase 2 spike (`<alloy-sortable>`, built, tested, used in caley's
mail sidebar) are done. Open questions are marked **Q-…** and gathered at the end; each needs a decision before
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
3. **The page owns the data.** A component reads props and emits typed events. It never changes a resource, sends a
   request or writes page state. The page applies an event with its own actions, usually one optimistic change and
   one request, so the rollback, the retry policy, write-through and live sync are sinter's, unchanged.
4. **Built for temper.** temper is a required peer. Components use temper's attributes (`data-variant`, `data-layout`, `data-icon`, …) and its
   tokens. The scoped CSS that remains is structural and uses `--tm-*` tokens only; each such rule is listed below as
   something temper could own instead, so the aim is no CSS at all.
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
<sn-resource name="folders" src="/email/folders" order="sort_order"></sn-resource>

<alloy-sortable data-sn-with="{ items: folders, keyOf: (f) => f.folder_id, nameOf: (f) => f.display_name,
                                label: m.mail_virtualFolders(), quiet: true, text: sortText() }"
                data-sn-on-move="folderMove = $event.detail; run('folders-order')">
  <div slot="item" data-layout="row" data-grow data-sn-let="{ f: /** @type {VirtualFolder} */ ($slot.item) }">
    <button data-variant="item" data-sn-text="f.display_name" …></button>
  </div>
</alloy-sortable>

<span hidden id="folders-order" data-sn-put="/email/folders/order" data-sn-when="folderMove"
      data-sn-body="{ folder_ids: alloy.keysAfter(folders, folderMove, (f) => f.folder_id) }"
      data-sn-optimistic="merge(folders.find((f) => f.folder_id === folderMove.key),
                                { sort_order: alloy.between(folders, folderMove, 'sort_order') })"
      data-sn-catch="folderOrderError = m.mail_folderOrderFailed()"></span>
```

**API.**

- Props: `items: readonly any[]`, `keyOf(item): string`, `nameOf?(item): string`, `label: string`,
  `disabled?`, `quiet?` (handles on hover/focus only; always on touch), `text?: Partial<SortableText>`.
- Slot `item: Slot<{ item: any; index: number }>`: the app's row, in the app's scope. The component owns the row's
  frame (an `<li>` with a grip handle before the fill), so it can draw the row's moving state from its own state
  without touching slot content.
- Event `move: Move` — `{ key, from, to, after, before, via }`. `to` counts the list without the item (as `splice`
  puts it back); `after`/`before` are the new neighbours' keys, so an API of the "put it after X" kind needs nothing
  else; an API that takes the whole order gets it from `alloy.keysAfter`.
- Helpers: `reorder`, `keysAfter`, `between`, `moved`. `between(list, move, field)` is the key idea: the moved
  item's sort value halfway between its new neighbours' (±1 past an end). Merged into a resource that has
  `order="<field>"`, the store sorts it into place, so **the optimistic reorder is one `merge`**, and its rollback is
  that one layer dropped. Overlapping moves are separate layers and roll back independently. Neighbours with equal
  values (a list never ordered: all `0`) cannot be split; the server's answer, which renumbers, settles it through
  write-through (caley's endpoint answers the renumbered list).
- The component never changes the list. Until the page changes `items`, the row stays where it was; that is what
  makes the rollback and a refused move correct without extra code.

**Binding to resources, actions and sync** (caley's wiring, verified end to end):

- `PUT /api/email/folders/order { folder_ids }` renumbers the user's folders 0…n (ids it does not list follow in
  their order; an id not the user's, or repeated, is a 404 and nothing is written) and answers the folders as
  `GET /email/folders` does. Write-through patches each folder's `sort_order` with the server's value: the
  optimistic fraction becomes an integer with no visible change.
- The server sends `folders_changed` on every create, update, delete and reorder; the page maps it to
  `refresh` of `folders`. A second tab (or device) re-sorts by itself. An event arriving while a move is pending is
  applied to the base and the pending layer stays on top (sinter's model), so nothing flickers back.
- Moves made before an answer queue (sinter's default `queue` concurrency for a non-form action).

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

**Runtime cost.** Script plus state machine: **2.2 kB gzip** minified; helpers (`order.ts`): 0.3 kB, foldable at
build time. The markup is expanded per use like any component. Bundled with the pages that use it (the mail page),
nowhere else.

**Tests.** `alloy/test`: the state machine and helpers (every from→to pair checked against a store-like sort by
`between`), `sinter check --strict` over the fixtures, `render()` with the real script (keyboard move, optimistic
reorder before the answer, rollback on a 500, Escape, items from state in German). caley: three mail page tests
(keyboard move and the request body, a refused order goes back with a note, `folders_changed` re-sorts), the
backend's reorder unit tests and cross-user case, and `npm run check:folders`, a Playwright check against the build
on the demo backend: mouse drag (row follows, line placed, order at once, saved after reload), keyboard move with
its announcements and focus, Escape, a second tab following through `folders_changed`, a touch drag on a phone
viewport with the sidebar as a drawer, and no console error or CSP violation (CSP `script-src 'self'`).

**Where caley uses it next:** mail accounts in the mail sidebar and settings (`imap_accounts.sort_order`), CalDAV
accounts and calendars (`caldav_accounts.sort_order`; calendars would need a column), identities (the compose
"From" order and default). Each needs only an order endpoint like the folders' one.

### `<alloy-board>` (designed)

Several lists, items moved within and between them: a kanban board, and in caley, the calendar (an event dragged to
another day; the week view's columns are lists, the month grid's cells too) and messages dropped on a mailbox.

```html
<alloy-board data-sn-with="{ lists: columns, items: cards, listOf: (c) => c.status, keyOf: (c) => c.id,
                             nameOf: (c) => c.title, label: 'Board' }"
             data-sn-on-move="mv = $event.detail; run('card-move')">
  <h2 slot="list-header" data-sn-text="$slot.list.title"></h2>
  <article slot="item" data-sn-text="$slot.item.title"></article>
</alloy-board>
<span hidden id="card-move" data-sn-patch="/cards/{mv.key}" data-sn-when="mv"
      data-sn-body="{ status: mv.toList, rank: alloy.between(cardsIn(cards, mv.toList), mv, 'rank') }"
      data-sn-optimistic="merge(cards.find((c) => c.id === mv.key), { status: mv.toList, rank: alloy.between(…) })"></span>
```

- One resource of items with a list field (`status`) and a sort field: a move between lists is still one `merge`
  (both fields), so the same rollback and sync apply. `BoardMove` extends `Move` with `fromList`, `toList`.
- Keyboard: as the sortable, plus ArrowLeft/ArrowRight move to the neighbouring list (at the nearest index), and
  announcements name the list ("Moved to Done, position 2 of 4").
- Lists as drop targets only (no reordering of lists) in v1 (**Q-B1**).
- The calendar is a board whose lists are days and whose "index" is a time: a `placeOf` prop that maps a pointer
  position to a slot (`{ list: day, at: minutes }`) instead of an index, so one component serves kanban and the week
  grid (**Q-B2**).
- Message → mailbox: the mailbox rows are drop targets only (`targets` prop, no items of their own). This replaces
  caley's native drag and drop and gains touch and a keyboard path.
- Same styling needs as the sortable plus a column surface (temper's `article` or `data-list`).
- Cost estimate: 3–4 kB gzip (the sortable's machine generalised to 2D hit testing).

## 2. Split panes: `<alloy-split>`

```html
<div class="mail-layout" data-sn-state="{ widths: { sidebar: 220, list: 320 } }" data-sn-persist="mail-widths">
  <aside data-sn-style="{ 'inline-size': widths.sidebar + 'px' }">…</aside>
  <alloy-split data-sn-model="widths.sidebar" data-sn-with="{ min: 140, max: 400, label: m.mail_aria_folders() }"></alloy-split>
  <section …>…</section>
</div>
```

- A separator, not a container: placed between two panes, it binds one size with `data-sn-model` (sinter's custom
  input contract: a `value` prop and a `change` event), so the page keeps the sizes in its own (persisted) state
  and lays the panes out with temper/CSS as it likes. Props: `value` (px), `min`, `max`, `step?` (keyboard, default
  16), `label`, `orientation?: 'vertical' | 'horizontal'`, `reverse?` (the pane after the separator is the sized
  one).
- Keyboard and a11y: `role="separator"`, `tabindex="0"`, `aria-orientation`, `aria-valuenow/min/max`,
  `aria-controls` (the sized pane's id, **Q-SP1**), `aria-label`. Arrow keys by `step`, Shift+Arrow by 4×, Home/End
  to min/max, Enter toggles collapsed (to min) and back (WAI-ARIA window splitter pattern).
- Pointer: drag with pointer capture, `change` on every frame (rAF), double-click resets to the initial value.
  Emits `change` only; clamping is the component's (it knows min/max), so caley's `clampWidth`/`keyWidth` helpers go.
- Styling: needs temper's separator look (T4); until then scoped CSS for the hit area and a hover/focus line.
- Cost: under 1 kB gzip. Replaces `email-split.html/.ts`, two helpers and the handle CSS in caley.

## 3. Date, time and range pickers

Three components over one pure calendar module (`calendar.ts`: the month grid for a locale's first weekday, ISO
dates as strings, no time zones: a date picker picks a calendar date):

- `<alloy-date data-sn-model="draft.date" data-sn-with="{ label, min?, max?, required?, marks? }">` — a text field
  (typed dates parsed in the page's locale) with a calendar popover. Value: `'YYYY-MM-DD'` or `''`.
- `<alloy-range data-sn-with="{ start: $url.start, end: $url.end, label, presets? }" data-sn-on-change="…">` — two
  dates and one calendar that selects a range (first click start, second end; end < start swaps), with presets
  ("Last 7 days", "This month") from the app. Event `change: { start, end }`; binding both to `$url` stays the
  page's (**Q-D2**: one `value: { start, end }` with `data-sn-model`, or two props).
- `<alloy-month data-sn-model="gridMonth" data-sn-with="{ marks }">` — the calendar's month/week picker as a
  component, `marks` (days with events) from the page's resource; replaces caley's hand-built `#month-picker`.
- Time: `<alloy-time>` is not planned. Native `type="time"` is good on every platform; a time list (15-minute
  steps, typed times) for the event form is **Q-D3**.

**First frame.** The field and the popover's grid for the current value render as markup (the grid is a
`data-sn-for` over a helper, `alloy.monthGrid(value, $locale)`, which folds or renders early). The script only
moves the focus in the grid and parses typing.

**Keyboard and a11y.** The field is a combobox (`aria-haspopup="dialog"`); the popover is a `[popover]` (temper's
`data-menu` placement) holding a `role="grid"` with roving focus: arrows by day/week, PageUp/PageDown by month
(Shift: year), Home/End to week start/end, Enter selects, Escape closes and returns focus. Today is
`aria-current="date"`, the selection `aria-selected`, disabled days `aria-disabled`. Month and year headings are
live. Week starts and names come from `Intl` for `$locale`, so `/de/` pages show German, Monday-first calendars
whatever the browser's language.

**Styling.** temper: the popover (`data-menu`), ghost buttons for days, `data-caption` for weekday names. Needs:
a 7-column grid (backlog item 41), `aria-current="date"` styling (item 42), a selected-range fill (T5).

**Cost.** About 3 kB gzip for the three (shared module), mostly `Intl` glue and the grid's keyboard.

## 4. Command palette: `<alloy-palette>`

```html
<alloy-palette data-sn-with="{ commands: paletteCommands(folders, accounts, $url), label: m.palette_label(),
                               placeholder: m.palette_search() }"
               data-sn-on-pick="run($event.detail.action) /* or navigate($event.detail.href) */"></alloy-palette>
```

- Opens with Mod+K (and `/` optionally) from anywhere (a key filter on `<body>` that the component's docs give the
  page, `data-sn-on-keydown-mod-k="openDialog('palette')"`, or the component listens on its document: **Q-C1**).
- A modal `<dialog>` with a search field and a list. The list keys are sinter's own `data-sn-options` (a combobox:
  arrows, Enter, Escape, `aria-activedescendant`), so the script only does what sinter does not: fuzzy ranking
  (a pure `rank(query, commands)` helper, so it renders early and is tested without a DOM), opening on the shortcut,
  restoring focus, and remembering recent picks (localStorage, per-viewer).
- Commands are data the page passes: `{ id, label, group?, keywords?, href?, shortcut?, icon? }`. Navigation is a link
  (`data-sn-href`), so it swaps like any link; an action is the page's (the component emits `pick`, the page runs
  it). Remote results (contacts, messages) are a resource the page declares with `when` on the query (the
  component emits `query` changes; **Q-C2**: whether the palette takes a resource name or the page merges results
  into `commands`).
- a11y: `role="combobox"` field (sinter adds it with `data-sn-options`), `role="listbox"` grouped with
  `role="group"`/`aria-labelledby`, shortcuts in `aria-keyshortcuts` and shown as `<kbd>`.
- Styling: temper's dialog and `data-menu` list; needs a top-anchored dialog variant and a marked-option style for
  `[data-sn-marked]` (T6).
- Cost: about 1.5 kB gzip (ranking included).

## 5. Virtualized list: `<alloy-virtual>`

```html
<alloy-virtual data-sn-with="{ items: contacts, keyOf: (c) => contactKey(c), estimate: 56, label }">
  <contact-row slot="item" data-sn-with="{ contact: $slot.item }"></contact-row>
</alloy-virtual>
```

- Renders only the rows in view plus an overscan, as a `data-sn-for` over `items.slice(start, end)` (state the script
  writes from scroll position and measured heights), between two spacer elements sized from state. Rows are keyed,
  so sinter reuses them while scrolling. Everything is still sinter rendering; the script only measures.
- First frame: the first `ceil(viewport / estimate)` rows render as markup (build-time `start = 0`), so the page
  is not blank before the script runs.
- Paginated resources: when the end is near, the component emits `end`, and the page calls `page(list, 'next')`
  (`append`). Live updates insert/remove rows as usual; the script keeps the scroll anchored to the first visible
  key.
- Keyboard and a11y: `role="list"` with `aria-setsize`/`aria-posinset` on rows so screen readers know the real
  length; `data-sn-options` lists (arrow keys) must be able to mark a row not rendered yet: the component scrolls
  it in on `sn-…` mark requests (needs S5). Find-in-page cannot find unrendered rows: documented as the cost, and
  the reason temper's `data-lazy` (CSS `content-visibility`, which keeps every row in the DOM) is the first choice.
- Cost: about 1.5 kB gzip.

---

## What alloy needs from sinter (no changes made to sinter)

| | Need | Why | Found in |
| --- | --- | --- | --- |
| S1 | **Generic components**: type parameters on `data-sn-props`, inferred per use (`<template data-sn-props="<T>{ items: readonly T[]; keyOf: (item: T) => string; item: Slot<{ item: T }> }">`) | Today `items` is `any[]` and `$slot.item` is `any`: the app's fill loses type checking, and caley casts in a let (`/** @type {VirtualFolder} */ ($slot.item)`). Every alloy collection component (sortable, board, virtual, palette) has this. | spike |
| S2 | **`$event` in `data-sn-optimistic` (and `data-sn-when`) of an action triggered by a component event**, or `data-sn-when` allowed on a component's tag | The natural wiring is the action on the tag, `data-sn-put="…" data-sn-trigger="move"` with `$event.detail` in body and optimistic change. The body accepts `$event`; the optimistic change does not (SN201), and `data-sn-when` cannot go on a component's tag (SN102), so a page needs state plus a hidden `run()` target. | spike |
| S3 | **Investigate `run('id')` into an element inside a nested `data-sn-state` scope** | In caley's mail page, a hidden action span inside the sidebar `<aside data-sn-state="…">` was not started by `run()` in the built page: the handler ran and set the state the target's `data-sn-when` reads, but no request, no `then`, no `catch` followed. The same markup works in `render()`. Moved to the page's top-level scope (beside `#wipe`) it works. Not root-caused; a reduced repro is the first step. | spike |
| S4 | **A component script's state writes flush with `flush()` in tests**, or document that they render on the next task | `render()` tests must `await settle()` (which also waits for held requests) or wait a task, to see what a script set. | spike |
| S5 | **`render()` takes `libraries`**, and a library can import its own component scripts in its own tests | Apps glob a library's `node_modules` files into `components`/`scripts` (caley does it for sinter-mail and alloy). A library's own vitest needs a self-link in `node_modules` (alloy's `test/link.ts`) because sinter serves a script's `.html` base class only for a configured library. | spike |
| S6 | `data-sn-options` able to mark an option that is not rendered (a callback or event the list answers by scrolling it in) | Virtualized lists and long palettes. | design |
| S7 | Library messages: a library ships its own inlang messages, merged under its namespace, translated by the app | Every alloy component needs a `text` prop today (**Q-L1**). | design |
| S8 | Optional lazy component scripts (a script that loads on first focus/pointerdown on its root) | The palette and pickers are idle on most page loads; markup must still render early. | design |

Already sufficient: slots that pass data (`Slot<T>`), component scripts with refs and state, `data-sn-model` on
components (split, pickers), `data-sn-options` (palette), resource `order` re-sorting merged items (the whole
optimistic-reorder idea rests on it: `store.ts` sorts layer values with the base), write-through, `<sn-event>`
refresh, `data-sn-persist`.

## What alloy needs from temper (no changes made to temper)

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
- **Q-S1 — The `run()` workaround.** Keep page-level action targets as caley does now, or wait for S2 so the action
  sits on the component's tag and needs no state? Recommendation: ask sinter for S2; it also makes `run()` and the
  extra state unnecessary.
- **Q-S2 — Whole row as the grab area.** Handles only (today: clear on touch, never fights a row's click) or also
  the whole row with a mouse after a 4 px threshold? Recommendation: handles only, `grab: 'row'` later if asked.
- **Q-S3 — Where else to reorder in caley first:** mail accounts, CalDAV accounts/calendars, identities. Each needs
  a backend endpoint like `PUT /email/folders/order`; calendars need a `sort_order` column.
- **Q-B1 — Boards: reorder the lists themselves?** (kanban columns). Not in v1 unless a use appears.
- **Q-B2 — One board for kanban and the calendar grid** (a `placeOf` mapping pointer → `{ list, at }`), or a
  separate `alloy-schedule` for time grids? Recommendation: try one; split if the props get conditional.
- **Q-SP1 — Split panes and ids.** `aria-controls` needs the pane's id; pass it as a prop (`controls: 'mail-list'`)
  or let the component find the previous sibling? Recommendation: a prop.
- **Q-D1 — Native date inputs.** Keep native inputs as the default and use `alloy-date` only where the locale or
  marks matter (calendar, search), or replace them everywhere for consistency?
- **Q-D2 — Range value shape:** one `{ start, end }` value with `data-sn-model`, or two props and a `change`
  event (easier to bind to two `$url` parameters)?
- **Q-D3 — Time picker:** keep native `type="time"`, or a list of times for the event form?
- **Q-C1 — Palette shortcut:** the page binds Mod+K (explicit, visible in markup) or the component listens on the
  document (zero setup, hidden behaviour)?
- **Q-C2 — Palette data:** commands only from props, or a resource the palette queries as the user types?
- **Q-V1 — Virtual list:** build at all, or rely on temper's `data-lazy` until a list needs more?
