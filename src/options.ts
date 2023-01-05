import { SourceLoc } from "./ast";

class Warning {
  message : string;
  offset ?: number;
  sourceLoc ?: SourceLoc;
  constructor(message : string, pos ?: number | SourceLoc) {
    this.message = message;
    if (typeof pos === "number") {
      this.offset = pos;
    } else if (pos && "line" in pos) {
      this.sourceLoc = pos;
      this.offset = pos.offset;
    }
  }
  render() : string {
    let result = this.message;
    if (this.sourceLoc) {
      result += ` at line ${this.sourceLoc.line}, col ${this.sourceLoc.col}`;
    } else if (this.offset) {
      result += ` at offset ${this.offset}`;
    }
    return result;
  }
}

interface Options {
  warn?: (warning : Warning) => void;
}

export type {
  SourceLoc,
  Options,
}
export {
  Warning,
}
