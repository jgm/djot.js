# NAME

djot -- converts djot markup.

# SYNOPSIS

djot [options] [file..]

# DESCRIPTION

djot is a command-line parser for [djot markup](https://djot.net).
It can produce

- an HMTL document (default behavior or `-t html`)
- a stream of annotated tokens with byte offsets (`-t events`)
- an AST in either human-readable or JSON form (`-t ast`, `-t astpretty`).
- a djot document (`-t djot`)
- a pandoc AST serialized to JSON (`-t pandoc`), which can be
  read by pandoc and converted to many other formats

It can also read a JSON-serialized djot AST (`-f ast`) or
a pandoc AST serialized to JSON (`-f pandoc`), allowing
conversion from many other formats.

Finally, it can apply *filters* that modify the parsed AST
between the parsing and rendering steps.  This is the primary
way in which djot syntax can be customized.

# OPTIONS

`--to,-t` *FORMAT*

:   Specify format to convert to. Valid values are
    `html` (the default), `ast` (JSON-formatted AST), `astpretty`
    (human-readable AST), `events` (JSON array of
    events produced by the tokenizer), `djot` (djot markup),
    or `pandoc` (JSON serialized pandoc AST).

`--from,-f` *FORMAT*

:   Specify format to convert from. Valid values are
    `djot` (the default), `ast` (JSON-formatted AST), and
    `pandoc` (JSON serialized pandoc AST).

`--filter` *FILE*

:   Read a filter from *FILE* and apply it to the parsed AST
    prior to rendering. This option may be used multiple times;
    the filters will be applied in the order specified on the
    command line. See FILTERS below for details.

`--compact`

:   Use compact JSON for the AST, with no extra spacing for
    readbility.

`--width,-w` *NUMBER*

:   Text width to which to wrap output of `-t djot`. If *NUMBER*
    is 0, no wrapping will be done, and line breaks in the
    input will be preserved in the output.  If it is -1,
    no wrapping will be done, and line breaks in the input
    will be treated as spaces.

`--sourcepos,-p`

:   Include information about the start and end positions of
    elements in the HTML and AST.  Source positions include the
    line number, column number (counting UTF-16 code units,
    which might not accord with visible columns), and character
    offset in the entire document (again, in UTF-16 code units).

`--time`

:   Print timings for parsing, filtering, and rendering to stderr.

`--quiet`

:   Suppress warnings.

`--version`

:   Print version

`--help,-h`

:   Print this message.

# FILTERS

Filters are JavaScript programs that modify the parsed document
prior to rendering.  Here is an example of a filter that
capitalizes all the content text in a document:

```
// This filter capitalizes regular text, leaving code and URLs unaffected
return {
  str: (el) => {
    el.text = el.text.toUpperCase();
  }
}
```

Save this as `caps.js` use tell djot to use it using

```
djot --filter caps input.js
```

Note: never run a filter from a source you don't trust,
without inspecting the code carefully. Filters are programs,
and like any programs they can do bad things on your system.

Here's a filter that prints a list of all the URLs you
link to in a document.  This filter doesn't alter the
document at all; it just prints the list to stderr.

```
return {
  link: (el) => {
    process.stderr:write(el.destination + "\n")
  }
}
```

A filter walks the document's abstract syntax tree, applying
functions to like-tagged nodes, so you will want to get familiar
with how djot's AST is designed. The easiest way to do this is
to use `djot --ast` or `djot --astpretty`.

By default filters do a bottom-up traversal; that is, the
filter for a node is run after its children have been processed.
It is possible to do a top-down travel, though, and even
to run separate actions on entering a node (before processing the
children) and on exiting (after processing the children). To do
this, associate the node's tag with a table containing `enter` and/or
`exit` functions.  The `enter` function is run when we traverse
*into* the node, before we traverse its children, and the `exit`
function is run after we have traversed the node's children.
For a top-down traversal, you'd just use the `enter` functions.
If the tag is associated directly with a function, as in the
first example above, it is treated as an `exit' function.

The following filter will capitalize text
that is nested inside emphasis, but not other text:

``` js
// This filter capitalizes the contents of emph
// nodes instead of italicizing them.
let capitalize = 0;
return {
   emph: {
     enter: (e) => {
       capitalize = capitalize + 1;
     },
     exit: (e) => {
       capitalize = capitalize - 1;
       e.tag = "span";
     },
   },
   str: (e) => {
     if (capitalize > 0) {
       e.text = e.text.toUpperCase();
      }
   }
}
```

Here is a simple filter that changes letter enumerated lists
to roman-numbered:

``` js
// Changes letter-enumerated lists to roman-numbered
return {
  list: (e) => {
    if (e.style === 'a.') {
      e.style = 'i.';
    } else if (e.style === 'A.') {
      e.style = 'I.';
    }
  }
}
```

A single filter may return a table with multiple tables, which will be
applied sequentially:

```js
// This filter includes two sub-filters, run in sequence
return [
  { // first filter changes (TM) to trademark symbol
    str: (e) => {
      e.text = e.text.replace(/\\(TM\\)/, "™");
    }
  },
  { // second filter changes '[]' to '()' in text
    str: (e) => {
      e.text = e.text.replace(/\\(/,"[").replace(/\\)/,"]");
    }
  }
]
```

The filters we've looked at so far modify nodes in place by
changing one of their properties (`text`).
Sometimes we'll want to replace a node with a different kind of
node, or with several nodes, or to delete a node.  In these
cases we can end the filter function with a `return`.
If a single AST node is returned, it will replace the element
the filter is processing.  If an array of AST nodes is returned,
they will be spliced in to replace the element.  If an empty
array is returned, the element will be deleted.

```js
// This filter replaces certain Symb nodes with
// formatted text.
const substitutions = {
  mycorp: [ { tag: "str", text: "My Corp" },
            { tag: "superscript",
              [ { tag: "str", text: "(TM)" } ] } ],
  myloc: { tag: "str", text: "Coyote, NM" }
  };
return {
  symb: (e) => {
    const found = substitutions[e.alias];
    if (found) {
      return found;
    }
  }
}
```

```js
// This filter replaces all Image nodes with their descriptions.
return {
  image: (e) => {
    return e.children;
  }
}
```

It is possible to inhibit traversal into the children of a node,
by having the `enter` function return an object with the
property `stop`. The contents of `stop` will be used as the regular
return value. This can be used, for example, to prevent
the contents of a footnote from being processed:

```js
return {
 footnote: {
   enter: (e) => {
     return {stop: [e]};
    }
  }
}
```



# AUTHORS

John MacFarlane (<jgm@berkeley.edu>).

