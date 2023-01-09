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
 *
 * The filters we've looked at so far modify nodes in place by
 * changing one of their properties (`text`).
 * Sometimes we'll want to replace a node with a different kind of
 * node, or with several nodes, or to delete a node.  In these
 * cases we can end the filter function with a `return`.
 * If a single AST node is returned, it will replace the element
 * the filter is processing.  If an array of AST nodes is returned,
 * they will be spliced in to replace the element.  If an empty
 * array is returned, the element will be deleted.
 *
 * // This filter replaces certain Symb nodes with
 * // formatted text.
 * const substitutions = {
 *   mycorp: [ { tag: "str", text: "My Corp" },
 *             { tag: "superscript",
 *               [ { tag: "str", text: "(TM)" } ] } ],
 *   myloc: { tag: "str", text: "Coyote, NM" }
 *   };
 * return {
 *   symb: (e) => {
 *     const found = substitutions[e.alias];
 *     if (found) {
 *       return found;
 *     }
 *   }
 * }
 *
 * // This filter replaces all Image nodes with their descriptions.
 * return {
 *   image: (e) => {
 *     return e.children;
 *   }
 * }
 * It is possible to inhibit traversal into the children of a node,
 * by having the `enter` function return an object with the
 * property `stop`. The contents of `stop` will be used as the regular
 * return value. This can be used, for example, to prevent
 * the contents of a footnote from being processed:
 *
 *
 * return {
 *  footnote: {
 *    enter: (e) => {
 *      return {stop: [e]};
 *     }
 *   }
 * }
 *
 */

type Transform = (node : any) =>
                   void
                  | AstNode
                  | AstNode[]
                  | {stop: void | AstNode | AstNode[]};
type Action = Transform | { enter ?: Transform, exit : Transform };
type FilterPart = Record<string, Action>;
type Filter = () => (FilterPart | FilterPart[]);

class Walker {
  finished  = false;
  top: AstNode;
  current: AstNode;
  stack: {node : HasChildren<AstNode>, childIndex: number}[] = [];
  enter = true;

  constructor(node : AstNode) {
    this.top = node;
    this.current = node;
  }

  walk(callback : (walker : Walker) => void) {
    while (!this.finished) {
      callback(this); // apply the action to current this state
      const topStack = this.stack && this.stack[this.stack.length - 1];
      this.enter = this.enter && "children" in this.current;
      if (this.enter) {
        if ("children" in this.current &&
            this.current.children.length > 0) {
          // move to first child
          this.stack.push({ node: this.current, childIndex: 0 });
          this.current = this.current.children[0];
          this.enter = true;
        } else {
          // no children, set to exit
          this.enter = false;
        }
      } else { // exit
        if (topStack) {
          // try next sibling
          topStack.childIndex++;
          const nextChild = topStack.node.children[topStack.childIndex];
          if (nextChild) {
            this.current = nextChild;
            this.enter = true;
          } else {
            this.stack.pop();
            // go up to parent
            this.current = topStack.node as AstNode;
            this.enter = false;
          }
        } else {
          this.finished = true;
        }
      }
    }
  }
}

const applyFilterPartToNode = function(node : AstNode, enter : boolean,
                               filterpart : FilterPart) {
  if (!node || !node.tag) {
    throw(new Error("Filter called on a non-node."));
  }
  const trans = filterpart[node.tag];
  if (!trans) {
    return false;
  }
  if (enter && "enter" in trans) {
    const transform = trans.enter;
    if (!transform) {
      return false;
    }
    return transform(node);
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
    return transform(node);
  }
}

// Returns the node for convenience (but modifies it in place).
const traverse = function(node : AstNode, filterpart : FilterPart) : AstNode {
  new Walker(node).walk((walker) => {
    let result = applyFilterPartToNode(walker.current, walker.enter,
                                       filterpart);
    const stackTop = walker.stack[walker.stack.length - 1];
    if (result && "stop" in result) {
      result = result.stop;
      walker.enter = false; // set to exit, which stops traversal of children
    }
    if (result) {
      if (Array.isArray(result)) {
        if (stackTop) {
          stackTop.node.children.splice(stackTop.childIndex, 1, ...result);
          // stackTop.childIndex += (result.length - 1);
          walker.current = stackTop.node.children[stackTop.childIndex];
        } else {
          throw(Error("Cannot replace top node with multiple nodes"));
        }
      } else {
        if (stackTop) {
          stackTop.node.children[stackTop.childIndex] = result;
        } else {
          return result;
        }
      }
    }
  });

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
