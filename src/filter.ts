import { Doc, AstNode, HasChildren } from "./ast";

/* Support filters that walk the AST and transform a
 * document between parsing and rendering, like pandoc Lua filters.
 * Here is an example of a filter that
 * capitalizes all the content text in a document:
 *
 * // This filter capitalizes regular text, leaving code and URLs unaffected
 * return {
 *   str: (el) => {
 *     el.text = el.text.toUpperCase();
 *   }
 * }
 *
 * Here's a filter that prints a list of all the URLs you
 * link to in a document.  This filter doesn't alter the
 * document at all; it just prints the list to stderr.
 *
 * return {
 *   link: (el) => {
 *     process.stderr:write(el.destination + "\n")
 *   }
 * }
 *
 * By default filters do a bottom-up traversal; that is, the
 * filter for a node is run after its children have been processed.
 * It is possible to do a top-down travel, though, and even
 * to run separate actions on entering a node (before processing the
 * children) and on exiting (after processing the children). To do
 * this, associate the node's tag with a table containing `enter` and/or
 * `exit` functions.  The `enter` function is run when we traverse
 * *into* the node, before we traverse its children, and the `exit`
 * function is run after we have traversed the node's children.
 * For a top-down traversal, you'd just use the `enter` functions.
 * If the tag is associated directly with a function, as in the
 * first example above, it is treated as an `exit' function.
 *
 * The following filter will capitalize text
 * that is nested inside emphasis, but not other text:
 *
 * // This filter capitalizes the contents of emph
 * // nodes instead of italicizing them.
 * let capitalize = 0;
 * return {
 *    emph: {
 *      enter: (e) => {
 *        capitalize = capitalize + 1;
 *      },
 *      exit: (e) => {
 *        capitalize = capitalize - 1;
 *        e.tag = "span";
 *      },
 *    },
 *    str: (e) => {
 *      if (capitalize > 0) {
 *        e.text = e.text.toUpperCase();
 *       }
 *    }
 * }
 *
 * It is possible to inhibit traversal into the children of a node,
 * by having the `enter` function return the value true (or any truish
 * value, say `"stop"`).  This can be used, for example, to prevent
 * the contents of a footnote from being processed:
 *
 *
 * return {
 *  footnote: {
 *    enter: (e) => {
 *      return true
 *     }
 *   }
 * }
 *
 * A single filter may return a table with multiple tables, which will be
 * applied sequentially:
 *
 * // This filter includes two sub-filters, run in sequence
 * return [
 *   { // first filter changes (TM) to trademark symbol
 *     str: (e) => {
 *       e.text = e.text.replace(/\\(TM\\)/, "™");
 *     }
 *   },
 *   { // second filter changes '[]' to '()' in text
 *     str: (e) => {
 *       e.text = e.text.replace(/\\(/,"[").replace(/\\)/,"]");
 *     }
 *   }
 * ]
 */

type Transform = (node : any) => void | boolean;
type Action = Transform | { enter ?: Transform, exit : Transform };
type FilterPart = Record<string, Action>;
type Filter = () => (FilterPart | FilterPart[]);

type Visit = {
  node: AstNode;
  enter: boolean;
  parent?: { node: HasChildren<AstNode>, childIndex: number};
}

type NodeIterator = {
  next: () => { value: Visit, done: boolean };
}


class Walker {
  finished : boolean = false;
  top: AstNode;
  current: AstNode;
  stack: {node : HasChildren<AstNode>, childIndex: number}[] = [];
  enter: boolean = true;

  constructor(node : AstNode) {
    this.top = node;
    this.current = node;
  }

  [Symbol.iterator](): NodeIterator {
    let walker : Walker = this;
    return {
      next() {
        const topStack =
                   walker.stack && walker.stack[walker.stack.length - 1];
        const current = walker.current;
        const parent = topStack ? { node: topStack.node,
                                    childIndex: topStack.childIndex }
                                 : undefined;
        if (walker.finished) {
          return { value: { node: walker.current, enter: false,
                            parent: parent },
                   done: true };
        }
        walker.enter = walker.enter && "children" in current;
        if (walker.enter) {
          if ("children" in current && current.children.length > 0) {
            walker.stack.push({ node: current, childIndex: 0 });
            walker.current = current.children[0];
            walker.enter = true;
          } else {
            walker.enter = false;
          }
          return { value: { node: current, enter: true,
                            parent: parent }, done: false };
        } else { // exit
          if (topStack) {
            // try next sibling
            topStack.childIndex++;
            let nextChild = topStack.node.children[topStack.childIndex];
            if (nextChild) {
              walker.current = nextChild;
              walker.enter = true;
            } else {
              walker.stack.pop();
              // go up to parent
              walker.current = topStack.node as AstNode;
              walker.enter = false;
            }
          } else {
            walker.finished = true;
          }
          return { value: { node: current, enter: false, parent: parent },
                     done: false } ;
        }
      }
    }
  }
}

// returns true to stop traverse
const handleAstNode = function(visit : Visit, filterpart : FilterPart) : boolean {
  const node = visit.node;
  const parent = visit.parent;
  if (!node || !node.tag) {
    throw(new Error("Filter called on a non-node."));
  }
  const trans = filterpart[node.tag];
  if (!trans) {
    return false;
  }
  if (visit.enter && "enter" in trans) {
    let transform = trans.enter;
    if (!transform) {
      return false;
    }
    return (transform(node) === true);
  } else {
    let transform;
    if ("exit" in trans) {
      transform = trans.exit;
    } else {
      transform = trans;
    }
    if (!transform) {
      return false;
    }
    return (transform(node) === true);
  }
}

// Returns the node for convenience (but modifies it in place).
const traverse = function(node : AstNode, filterpart : FilterPart) : AstNode {
  for (const visit of new Walker(node)) {
    let stopTraverse = handleAstNode(visit, filterpart);
    if (stopTraverse) {
      break;
    };
  }
  return node;
}

// Apply a filter to a document.
const applyFilter = function(doc : Doc, filter : Filter) : void {
  const f : FilterPart | FilterPart[] = filter();
  let filterparts;
  if (Array.isArray(f)) {
    filterparts = f;
  } else {
    filterparts = [f];
  }
  for (const f of filterparts) {
    traverse(doc, f);
    for (const i in doc.footnotes) {
      traverse(doc.footnotes[i], f);
    }
    for (const i in doc.references) {
      traverse(doc.references[i], f);
    }
  }
}

export type {
  Action,
  FilterPart,
  Filter,
}
export {
  applyFilter,
}
