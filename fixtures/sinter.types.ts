// The fixture pages' types module, as an app writes its own: alloy's types, and the fixtures' items.
export type { Move, SortableText, SortError, BoardMove, BoardText, BoardError, DateText, RangeText, DateRange, MonthText } from '@tiavision/sinter-alloy';

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
