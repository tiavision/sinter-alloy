// Vitest's global setup: links the package into its own node_modules (scripts/self-link.mjs), so the render tests
// import the components' scripts as an app would.
import { selfLink } from '../scripts/self-link.mjs';

export default function setup() {
  selfLink();
}
