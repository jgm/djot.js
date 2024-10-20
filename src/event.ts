import { AttrAnnot } from "./attributes";
import { BlockAnnot } from "./block";
import { InlineAnnot } from "./inline";

export type Annot = BlockAnnot | InlineAnnot | AttrAnnot;

interface Event {
  startpos : number;
  endpos : number;
  annot : Annot;

}

export type { Event }
