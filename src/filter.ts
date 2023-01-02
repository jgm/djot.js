import { Doc, AstNode } from "./ast";

// TODO convert code examples to js:
/* Support filters that walk the AST and transform a
 * document between parsing and rendering, like pandoc Lua filters.
 *
 * This filter uppercases all str elements.
 *
 *     return {
 *       str: function(e)
 *         e.text = e.text:upper()
 *        }
 *     }
 *
 * A filter may define functions for as many different tag types
 * as it likes.  traverse will walk the AST and apply matching
 * functions to each node.
 *
 * To load a filter:
 *
 *     let filter = require_filter(path)
 *
 * or
 *
 *     let filter = load_filter(string)
 *
 * By default filters do a bottom-up traversal; that is, the
 * filter for a node is run after its children have been processed.
 * It is possible to do a top-down travel, though, and even
 * to run separate actions on entering a node (before processing the
 * children) and on exiting (after processing the children). To do
 * this, associate the node's tag with a table containing `enter` and/or
 * `exit` functions.  The following filter will capitalize text
 * that is nested inside emphasis, but not other text:
 *
 *     let capitalize = 0
 *     return {
 *        emph = {
 *          enter = function(e)
 *            capitalize = capitalize + 1
 *          end,
 *          exit = function(e)
 *            capitalize = capitalize - 1
 *          end,
 *        },
 *        str = function(e)
 *          if capitalize > 0 {
 *            e.text = e.text:upper()
 *           }
 *        }
 *     }
 *
 * For a top-down traversal, you'd just use the `enter` functions.
 * If the tag is associated directly with a function, as in the
 * first example above, it is treated as an `exit` function.
 *
 * It is possible to inhibit traversal into the children of a node,
 * by having the `enter` function return the value true (or any truish
 * value, say `'stop'`).  This can be used, for example, to prevent
 * the contents of a footnote from being processed:
 *
 *     return {
 *       footnote = {
 *         enter = function(e)
 *           return true
 *         }
 *        }
 *     }
 *
 * A single filter may return a table with multiple tables, which will be
 * applied sequentially.
 */

type Transform = (node : any) => void | boolean;
type Action = Transform | { enter ?: Transform, exit : Transform };
type FilterPart = Record<string, Action>;
type Filter = () => (FilterPart | FilterPart[]);

const handleAstNode = function(node : any, filterpart : FilterPart) : void {
  if (!node || !node.tag) {
    throw(new Error("Filter caled on a non-node."));
  }
  let transformIn : Transform | undefined;
  let transformOut : Transform | undefined;
  const transform = filterpart[node.tag];
  if (transform) {
    if ("exit" in transform && transform.exit) {
      transformOut = transform.exit;
      transformIn = transform.enter;
    } else if (typeof transform === "function") {
      transformOut = transform;
    } else {
      throw(new Error("Transform has wrong type."));
    }
    if (transformIn) {
      const stopTraversal = transformIn(node);
      if (stopTraversal) {
        return;
      }
    }
  }
  if ("children" in node && node.children) {
    node.children.forEach((child : AstNode) => {
      handleAstNode(child, filterpart);
    });
  }
  if ("footnotes" in node && node.footnotes) {
    for (const key in node.footnotes) {
      const note = node.footnotes[key];
      handleAstNode(note, filterpart);
    }
  }
  if (transformOut) {
    transformOut(node);
  }
}

// Returns the node for convenience (but modifies it in place).
const traverse = function(node : AstNode, filterpart : FilterPart) : AstNode {
  handleAstNode(node, filterpart);
  return node;
}

// Apply a filter to a document.
const applyFilter = function(node : Doc, filter : Filter) : void {
  const f : FilterPart | FilterPart[] = filter();
  if (Array.isArray(f)) {
    for (let i=0; i<f.length; i++) {
      traverse(node, f[i]);
    }
  } else if (typeof f === "object") {
    traverse(node, f);
  } else {
    throw(new Error("Filter returned wrong type: " + typeof f));
  }
}

export {
  Action,
  FilterPart,
  Filter,
  applyFilter
}
