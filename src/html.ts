import { Doc, Reference, Footnote, Link, HasChildren,
         HasAttributes, AstNode, Visitor } from "./ast";
import { getStringContent } from "./parse";
import { Options, Warning } from "./options";

interface HTMLRenderOptions extends Options {
  overrides?: Visitor<HTMLRenderer, string>;
}

const reNeedsEscape = /[&<>]/;
const reNeedsEscapeAttr = /[&<>"]/;

// Heading tag names, so that a heading does not have to build one.  The
// parser only ever produces levels 1-6; anything else falls back to
// composing the name.
const headingTags = ["h1", "h2", "h3", "h4", "h5", "h6"];

// Look up a key that may be user-supplied (e.g. "constructor") without
// hitting inherited Object.prototype properties:
const getOwn = function<T>(obj : Record<string, T>, key : string) : T | undefined {
  return Object.prototype.hasOwnProperty.call(obj, key) ? obj[key] : undefined;
}

// The HTML a node contributes around its children: `open` is emitted
// before them and `close` after them.  `children` is the array to walk
// into, taken from the node where the switch in renderNodeParts has
// narrowed its type; it is undefined when there is nothing to walk into
// (leaves, and images, whose children only supply the alt text), and
// then `open` holds the node's entire output and `close` is not read.
interface NodeParts {
  open: string;
  close: string;
  children: AstNode[] | undefined;
  // the `tight` value to apply while the children are rendered, for the
  // three list tags that carry the flag; undefined for every other node:
  tight: boolean | undefined;
  // a doc's footnotes, whose section can only be rendered once the body
  // has assigned every footnote its index; undefined for other nodes:
  footnotes: Record<string, Footnote> | undefined;
}

// An entry on the renderer's explicit stack: a node whose `open` has
// been emitted and whose children are still being walked.  Frames are
// reused as the walk moves back down the tree (see renderNested), so
// every field is always set rather than left absent.
interface RenderFrame {
  children: AstNode[];
  childIndex: number;
  close: string;
  // the `tight` value to restore afterwards, for nodes carrying a
  // `tight` flag that applies while their children are rendered;
  // undefined for every other node:
  oldTight: boolean | undefined;
  // a doc's footnotes, whose section can only be rendered once the body
  // has assigned every footnote its index; undefined for other nodes:
  footnotes: Record<string, Footnote> | undefined;
}

class HTMLRenderer {
  warn: (warning : Warning) => void;
  options: HTMLRenderOptions;
  private tight: boolean;
  footnoteIndex: Record<string, number>;
  nextFootnoteIndex: number;
  fnrefIdEmitted: Record<string, boolean>;
  references: Record<string, Reference>;
  autoReferences: Record<string, Reference>;
  // Scratch space returned by renderNodeParts.  Its contents are only
  // valid until the next renderNodeParts call; the walk in renderNested
  // consumes them before making another.
  private parts: NodeParts;
  // memoised `<tag>` (attribute-free only) and `</tag>` strings:
  private openTags: Map<string, string>;
  private closeTags: Map<string, string>;

  constructor(options : HTMLRenderOptions) {
    this.warn = options.warn || (() => {});
    this.options = options || {};
    this.tight = false;
    this.footnoteIndex = Object.create(null); // keys are user-supplied labels
    this.nextFootnoteIndex = 1;
    this.fnrefIdEmitted = Object.create(null);
    this.references = Object.create(null);
    this.autoReferences = Object.create(null);
    this.parts = { open: "", close: "", children: undefined,
                   tight: undefined, footnotes: undefined };
    this.openTags = new Map();
    this.closeTags = new Map();
  }

  escape(s: string): string {
    if (reNeedsEscape.test(s)) {
      return s
       .replace(/&/g, "&amp;")
       .replace(/</g, "&lt;")
       .replace(/>/g, "&gt;");
    } else {
      return s;
    }
  }

  escapeAttribute(s: string): string {
    if (reNeedsEscapeAttr.test(s)) {
      return s
       .replace(/&/g, "&amp;")
       .replace(/</g, "&lt;")
       .replace(/>/g, "&gt;")
       .replace(/"/g, "&quot;");
    } else {
      return s;
    }
  }

  smartPunctuationMap : Record<string, string> = {
    right_single_quote: "’",
    left_single_quote: "‘",
    right_double_quote: "”",
    left_double_quote: "“",
    ellipses: "…",
    em_dash: "—",
    en_dash: "–"
  }

  renderAttributes(node: HasAttributes, extraAttrs?: Record<string, string>)
    : string {
    let result  = "";
    if (extraAttrs) {
      for (const k in extraAttrs) {
        if (k === "class") {
          let v = extraAttrs[k];
          if (node.attributes && node.attributes.class) {
            v = `${v} ${node.attributes.class}`;
          }
          result += ` ${k}="${this.escapeAttribute(v)}"`;
        } else {
          result += ` ${k}="${this.escapeAttribute(extraAttrs[k])}"`;
        }
      }
    }
    // `attributes` win over `autoAttributes` of the same name but keep
    // the position the auto one held, which the merge takes care of.
    // Only do it when there is something to merge: a node that gets
    // here carrying nothing but a `pos` -- which, under
    // `sourcePositions`, is every node in the document -- would
    // otherwise build an empty object and walk it.
    if (node.autoAttributes !== undefined || node.attributes !== undefined) {
      const attributes = {
        ...node.autoAttributes,
        ...node.attributes,
      }
      for (const k in attributes) {
        const v = attributes[k];
        if (!(k === "class" && extraAttrs && extraAttrs.class)) {
          result += ` ${k}="${this.escapeAttribute(v)}"`;
        }
      }
    }
    if (node.pos) {
      const sp = node.pos.start;
      const ep = node.pos.end;
      result += ` data-startpos="${sp.line}:${sp.col}:${sp.offset}" data-endpos="${ep.line}:${ep.col}:${ep.offset}"`;
    }
    return result;
  }

  renderTag(tag: string, node: AstNode, extraAttrs?: Record<string, string>)
    : string {
    if (node.attributes || node.autoAttributes || extraAttrs || node.pos) {
      return `<${tag}${this.renderAttributes(node, extraAttrs)}>`;
    }
    // with no attributes the tag depends on nothing but its name, and a
    // document asks for the same handful of names over and over, so it
    // is built once rather than reallocated per node
    let cached = this.openTags.get(tag);
    if (cached === undefined) {
      cached = `<${tag}>`;
      this.openTags.set(tag, cached);
    }
    return cached;
  }

  renderCloseTag(tag: string): string {
    let cached = this.closeTags.get(tag);
    if (cached === undefined) {
      cached = `</${tag}>`;
      this.closeTags.set(tag, cached);
    }
    return cached;
  }

  // Fill in the scratch NodeParts.  Reusing one object rather than
  // returning a fresh one keeps the walk free of per-node allocation;
  // see the `parts` field.
  private setParts(open: string, close: string,
    children: AstNode[] | undefined): NodeParts {
    const parts = this.parts;
    parts.open = open;
    parts.close = close;
    parts.children = children;
    // the rare fields default to "not applicable"; the few cases that
    // want them assign them on the returned object
    parts.tight = undefined;
    parts.footnotes = undefined;
    return parts;
  }

  // A node with no rendered children, whose output is already known.
  // Only `open` and `children` are assigned: with no children to walk
  // into, none of the other fields is read.
  private leafParts(open: string): NodeParts {
    const parts = this.parts;
    parts.open = open;
    parts.children = undefined;
    return parts;
  }

  // A node rendered as `tag` wrapped around its children.  Requiring a
  // node that has children makes it a compile-time error to wrap a tag
  // around a node the walk could not then descend into.
  private tagParts(tag: string, node: AstNode & HasChildren<AstNode>,
    newlines: number, extraAttrs?: Record<string, string>): NodeParts {
    const open = this.renderTag(tag, node, extraAttrs);
    const close = this.renderCloseTag(tag);
    // spelt out per case so that the common inline tags, which want no
    // newline at all, do no concatenation
    if (newlines === 0) {
      return this.setParts(open, close, node.children);
    } else if (newlines === 1) {
      return this.setParts(open, close + "\n", node.children);
    } else {
      return this.setParts(open + "\n", close + "\n", node.children);
    }
  }

  addBacklink(note : string, ident: number): string {
    const backlink  = `<a href="#fnref${ident}" role="doc-backlink">\u21A9\uFE0E</a>`;
    if (/\<\/p\>[\r\n]*$/.test(note)) {
      return note.replace(/\<\/p\>([\r\n]*)$/, backlink + "</p>$1");
    } else {
      return note + `<p>${backlink}</p>\n`;
    }
  }

  // Render `node` and its descendants.  The walk keeps its own stack of
  // frames instead of recursing, so the only limit on nesting depth is
  // available heap, not the JS call stack.  `applyOverride` is false when
  // the caller has already committed to the default handler for `node`
  // itself; overrides still apply to its descendants.
  private renderNested(node: AstNode, applyOverride: boolean): string {
    let result = "";
    // `stack` holds frames for depths 0..depth-1, and keeps the frames
    // above `depth` around for reuse, so a render allocates only as many
    // frames as the content is deep rather than one per container.
    const stack: RenderFrame[] = [];
    const overrides = this.options.overrides;
    // the table to consult for the node being entered: undefined both
    // when there are no overrides at all and, for the root only, when the
    // caller has already committed to the default handler
    let lookup = applyOverride ? overrides : undefined;
    let depth = 0;
    let current: AstNode | undefined = node;
    while (true) {
      if (current !== undefined) {
        const override = lookup !== undefined
          ? lookup[current.tag]
          : undefined;
        lookup = overrides;
        if (override) {
          // An override renders its own subtree, so it may recurse; that
          // is inherent to the string-returning override signature.
          result += (override as
            (node: AstNode, context: HTMLRenderer) => string)(current, this);
        } else {
          const parts = this.renderNodeParts(current);
          result += parts.open;
          const children = parts.children;
          if (children !== undefined) {
            const tight = parts.tight;
            let frame = stack[depth];
            if (frame === undefined) {
              frame = { children: children, childIndex: 0,
                        close: parts.close, oldTight: undefined,
                        footnotes: parts.footnotes };
              stack[depth] = frame;
            } else {
              frame.children = children;
              frame.childIndex = 0;
              frame.close = parts.close;
              frame.oldTight = undefined;
              frame.footnotes = parts.footnotes;
            }
            depth++;
            if (tight !== undefined) {
              frame.oldTight = this.tight;
              this.tight = tight;
            }
          }
          // a childless node has no `close`: leafParts puts its whole
          // output in `open`, so there is nothing to emit on the way out
        }
        current = undefined;
      }
      if (depth === 0) {
        return result;
      }
      const frame = stack[depth - 1];
      if (frame.childIndex < frame.children.length) {
        current = frame.children[frame.childIndex];
        frame.childIndex++;
      } else {
        depth--;
        result += frame.close;
        if (frame.oldTight !== undefined) {
          this.tight = frame.oldTight;
        }
        if (frame.footnotes && this.nextFootnoteIndex > 1) {
          result += this.renderNotes(frame.footnotes);
        }
      }
    }
  }

  renderChildren(node: HasChildren<AstNode>): string {
    let result = "";
    const oldtight = this.tight;
    if ("tight" in node) {
      this.tight = !!node.tight;
    }
    for (const child of node.children) {
      result += this.renderNested(child, true);
    }
    if ("tight" in node) {
      this.tight = oldtight;
    }
    return result;
  }

  // Kept for overrides that render a node as a tag wrapped around its
  // children.  The renderer itself no longer uses it -- it splits a node
  // into the text before and after its children instead, so that the walk
  // can stay iterative -- but it costs nothing to express in terms of
  // renderChildren, which is iterative, so the children of a node passed
  // here can be arbitrarily deep.
  inTags(tag: string, node: HasChildren<AstNode>, newlines: number,
    extraAttrs?: Record<string, string>): string {
    const afterOpenSpace = newlines >= 2 ? "\n" : "";
    const afterCloseSpace = newlines >= 1 ? "\n" : "";
    return `${this.renderTag(tag, node as AstNode, extraAttrs)}${afterOpenSpace}${this.renderChildren(node)}${this.renderCloseTag(tag)}${afterCloseSpace}`;
  }

  renderAstNode(node: AstNode): string {
    return this.renderNested(node, true);
  }

  renderNotes(notes: Record<string, Footnote>): string {
    let result  = "";
    const orderedFootnotes = [];
    const renderedNotes : Record<string, string> = Object.create(null);
    for (const k in notes) {
      renderedNotes[k] = this.renderChildren(notes[k]);
    }
    // now this.footnoteIndex includes notes only indexed in other notes (#37)
    for (const k in this.footnoteIndex) {
      const index = this.footnoteIndex[k];
      if (index) {
        orderedFootnotes[index] = renderedNotes[k];
      }
    }
    result += `<section role="doc-endnotes">\n<hr>\n<ol>\n`;
    for (let i = 1; i < orderedFootnotes.length; i++) {
      // note: there can be gaps in the sequence, so we
      // want to insert a dummy note in that case
      const note = orderedFootnotes[i] || "";
      result += `<li id="fn${i}">\n`;
      result += this.addBacklink(note, i);
      result += `</li>\n`;
    }
    result += `</ol>\n</section>\n`;
    return result;
  }

  renderAstNodeDefault(node: AstNode): string {
    return this.renderNested(node, false);
  }

  // Compute what `node` emits around its children, without rendering
  // them.  Every case that used to call renderChildren now hands its
  // children back and leaves the walk in renderNested to do it.
  private renderNodeParts(node: AstNode): NodeParts {
    // The cases are mutually exclusive, so their order is free, and V8
    // compiles a switch over strings into a chain of comparisons.  The
    // tags that dominate any real document therefore come first; the
    // rest follow in the order they appear in the AST definition.
    switch (node.tag) {
      case "str": {
        if (node.attributes || node.autoAttributes) {
          return this.leafParts(
            `${this.renderTag("span", node)}${this.escape(node.text)}</span>`);
        } else {
          return this.leafParts(this.escape(node.text));
        }
      }

      case "soft_break":
        return this.leafParts("\n");

      case "emph":
        return this.tagParts("em", node, 0);

      case "strong":
        return this.tagParts("strong", node, 0);

      case "doc": {
        // the notes section is appended by renderNested on the way out
        const parts = this.setParts("", "", node.children);
        parts.footnotes = node.footnotes;
        return parts;
      }

      case "para": {
        if (this.tight) {
          return this.setParts("", "\n", node.children);
        } else {
          return this.tagParts("p", node, 1);
        }
      }

      case "block_quote":
        return this.tagParts("blockquote", node, 2);

      case "div":
        return this.tagParts("div", node, 2);

      case "section":
        return this.tagParts("section", node, 2);

      case "list_item":
        return this.tagParts("li", node, 2);

      case "task_list_item": {
        let open = "<li>\n";
        if (node.checkbox === "checked") {
          open += '<input disabled="" type="checkbox" checked=""/>\n';
        } else {
          open += '<input disabled="" type="checkbox"/>\n';
        }
        return this.setParts(open, this.renderCloseTag("li") + "\n",
          node.children);
      }

      case "definition_list_item":
        return this.setParts("", "", node.children);

      case "definition":
        return this.tagParts("dd", node, 2);

      case "term":
        return this.tagParts("dt", node, 1);

      case "definition_list":
        return this.tagParts("dl", node, 2);

      // the three list tags are the only ones carrying `tight`, which
      // governs whether their nested paragraphs get <p> tags:
      case "bullet_list": {
        const parts = this.tagParts("ul", node, 2);
        parts.tight = node.tight;
        return parts;
      }

      case "task_list": {
        const parts = this.tagParts("ul", node, 2, { class: "task-list" });
        parts.tight = node.tight;
        return parts;
      }

      case "ordered_list": {
        const extraAttr : Record<string,string> = {};
        if (node.start && node.start !== 1) {
          extraAttr.start = node.start.toString();
        }
        if (node.style && !/1/.test(node.style)) {
          extraAttr.type = node.style.replace(/[().]/g, "");
        }
        const parts = this.tagParts("ol", node, 2, extraAttr);
        parts.tight = node.tight;
        return parts;
      }

      case "heading": {
        const level = node.level;
        return this.tagParts(
          level >= 1 && level <= 6 ? headingTags[level - 1] : `h${level}`,
          node, 1);
      }

      case "footnote_reference": {
        let result = "";
        const label = node.text;
        let index = this.footnoteIndex[label];
        if (!index) {
          index = this.nextFootnoteIndex;
          this.footnoteIndex[label] = index;
          this.nextFootnoteIndex++;
        }
        const extraAttrs: Record<string, string> = {};
        if (!this.fnrefIdEmitted[label]) {
          extraAttrs.id = "fnref" + index;
          this.fnrefIdEmitted[label] = true;
        }
        extraAttrs.href = "#fn" + index;
        extraAttrs.role = "doc-noteref";
        result += this.renderTag("a", node, extraAttrs);
        result += "<sup>";
        result += this.escape(index.toString());
        result += "</sup></a>";
        return this.leafParts(result);
      }

      case "table":
        return this.tagParts("table", node, 2);

      case "caption": {
        // AST always has at least a dummy caption, no
        // need to render that.
        if (node.children.length > 0) {
          return this.tagParts("caption", node, 1);
        }
        return this.leafParts("");
      }

      case "row":
        return this.tagParts("tr", node, 2);

      case "cell": {
        const cellAttr: Record<string, string> = {};
        if (node.align && node.align !== "default") {
          cellAttr.style = `text-align: ${node.align};`;
        }
        return this.tagParts(node.head ? "th" : "td", node, 1, cellAttr);
      }

      case "thematic_break":
        return this.leafParts(this.renderTag("hr", node) + "\n");

      case "code_block": {
        let result = "";
        result += this.renderTag("pre", node);
        result += "<code";
        if (node.lang) {
          result += ` class="language-${this.escapeAttribute(node.lang)}"`;
        }
        result += ">";
        result += this.escape(node.text);
        result += this.renderCloseTag("code");
        result += this.renderCloseTag("pre");
        result += "\n";
        return this.leafParts(result);
      }

      case "raw_block":
        return this.leafParts(node.format === "html" ? node.text : "");

      case "smart_punctuation":
        return this.leafParts(this.smartPunctuationMap[node.type] || node.text);

      case "double_quoted":
        return this.setParts(
          this.smartPunctuationMap.left_double_quote || '"',
          this.smartPunctuationMap.right_double_quote || '"',
          node.children);

      case "single_quoted":
        return this.setParts(
          this.smartPunctuationMap.left_single_quote || "'",
          this.smartPunctuationMap.right_single_quote || "'",
          node.children);

      case "symb":
        return this.leafParts(this.escape(`:${node.alias}:`));

      case "inline_math": {
        let result = "";
        result += this.renderTag("span", node, { class: "math inline" });
        result += `\\(${this.escape(node.text)}\\)`;
        result += this.renderCloseTag("span");
        return this.leafParts(result);
      }

      case "display_math": {
        let result = "";
        result += this.renderTag("span", node, { class: "math display" });
        result += `\\[${this.escape(node.text)}\\]`;
        result += this.renderCloseTag("span");
        return this.leafParts(result);
      }

      case "verbatim": {
        let result = "";
        result += this.renderTag("code", node);
        result += this.escape(node.text);
        result += this.renderCloseTag("code");
        return this.leafParts(result);
      }

      case "raw_inline":
        return this.leafParts(node.format === "html" ? node.text : "");

      case "hard_break":
        return this.leafParts("<br>\n");

      case "non_breaking_space":
        return this.leafParts("&nbsp;");

      case "link":
      case "image": {
        const extraAttr : Record<string,string> = {};
        let dest: string | undefined = node.destination;
        if (node.reference) {
          // use getOwn because this.references may be a plain object
          // (e.g. from a doc parsed from external JSON):
          const ref = getOwn(this.references, node.reference) ||
                      getOwn(this.autoReferences, node.reference);
          if (ref) {
            dest = ref.destination;
            if (node.tag === "image") {
              extraAttr.alt = getStringContent(node);
              extraAttr.src = dest;
            } else {
              extraAttr.href = dest;
            }
            if (ref.attributes) {
              for (const k in ref.attributes) {
                if (!node.attributes || !node.attributes[k]) {
                  // attribs on link take priority over attribs on reference
                  extraAttr[k] = ref.attributes[k];
                }
              }
            }
            if (ref.autoAttributes) {
              for (const k in ref.autoAttributes) {
                if (!node.autoAttributes || !node.autoAttributes[k]) {
                  // attribs on link take priority over attribs on reference
                  extraAttr[k] = ref.autoAttributes[k];
                }
              }
            }
          } else {
            this.warn(new Warning(`Reference ${JSON.stringify(node.reference)} not found`, node?.pos?.end));
          }
        }
        else {
          if (node.tag === "image") {
            extraAttr.alt = getStringContent(node);
            if (dest !== undefined) {
              extraAttr.src = dest;
            }
          } else {
            if (dest !== undefined) {
              extraAttr.href = dest;
            }
          }
        }
        if (node.tag === "image") {
          // an image's children only supply the alt text, so they are
          // not rendered as content
          return this.leafParts(this.renderTag("img", node, extraAttr));
        } else {
          return this.tagParts("a", node, 0, extraAttr);
        }
      }

      case "url":
      case "email": {
        let result = "";
        const extraAttr : Record<string,string> = {};
        if (node.tag === "email") {
          extraAttr.href = "mailto:" + node.text;
        } else {
          extraAttr.href = node.text;
        }
        result += this.renderTag("a", node, extraAttr);
        result += this.escape(node.text);
        result += this.renderCloseTag("a");
        return this.leafParts(result);
      }

      case "span":
        return this.tagParts("span", node, 0);

      case "mark":
        return this.tagParts("mark", node, 0);

      case "insert":
        return this.tagParts("ins", node, 0);

      case "delete":
        return this.tagParts("del", node, 0);

      case "superscript":
        return this.tagParts("sup", node, 0);

      case "subscript":
        return this.tagParts("sub", node, 0);

      default:
        return this.leafParts("");
    }
  }

  render(doc: Doc): string {
    this.references = doc.references;
    this.autoReferences = doc.autoReferences;
    return this.renderAstNode(doc);
  }
}

const renderHTML = function(ast: Doc, options: HTMLRenderOptions = {}): string {
  const renderer = new HTMLRenderer(options);
  return renderer.render(ast);
}

export type {
  HTMLRenderOptions
}
export {
  renderHTML,
  HTMLRenderer
}
