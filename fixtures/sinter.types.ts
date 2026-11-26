// The fixture pages' types module, as an app writes its own: alloy's types, and the fixtures' items.
// only what the fixture pages' own markup names: a library type its components need must not depend on the app's exports
export type { Move } from '@tiavision/sinter-alloy';

export interface Task {
  id: string;
  title: string;
  rank: number;
}

export interface Card {
  id: string;
  title: string;
  status: string;
  rank: number;
}

export interface Person {
  id: string;
  name: string;
  note: string | null;
}
