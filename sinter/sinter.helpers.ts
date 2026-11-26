// alloy's helpers, which an app re-exports as a namespace (`export * as alloy from '@tiavision/sinter-alloy'` in
// its src/sinter.helpers.ts) and calls in markup: `alloy.between(folders, mv, 'sort_order')`.
// Pure and light: they fold at build time where their inputs are constants, and render early.
export { reorder, keysAfter, between, moved } from './order.js';
