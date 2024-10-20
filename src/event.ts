import { AttrAnnot } from "./attributes";
import { BlockAnnot } from "./block";
import { InlineAnnot } from "./inline";

export type Annot = BlockAnnot | InlineAnnot | AttrAnnot;

type Event = {
  startpos : number;
  endpos : number;
} & ({
  annot : Exclude<Annot, "+list" | "+list_item">;
} | {
  annot : "+list" | "+list_item";
  listStyles: string[];
});

export type { Event }
