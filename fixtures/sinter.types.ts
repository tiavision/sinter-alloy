// The fixture pages' types module, as an app writes its own: alloy's types, and the fixtures' items.
export type { Move, SortableText } from '@tiavision/sinter-alloy';

export interface Task {
  id: string;
  title: string;
  rank: number;
}
