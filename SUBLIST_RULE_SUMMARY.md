# Modified Sublist Interruption Rule: Findings and Summary

## The Rule Change

**Before:** A blank line is unconditionally required before a sublist (or any block-level element) inside a list item.

**After:** A blank line is required before a sublist *only if the list item has continuation lines*. If the item is a single line, a sublist can interrupt it immediately.

In other words: `- foo\n  - bar` now creates a nested list, but `- foo\n  cont\n  - bar` still treats `- bar` as paragraph text (requiring a blank line to start a sublist).

## How the Current Rule Works

The blank-line requirement is not an explicit check in the parser. Instead, it is an emergent consequence of how paragraphs interact with container opening:

1. When a list item opens and has text, a **paragraph** container (`content: Inline`) is pushed.
2. The `checkStarts` gate at the top of the new-container-opening loop prevents any new containers from starting when the innermost matched container has `content === Inline`.
3. A second gate (the inner type check in the spec-matching loop) requires `lastMatch.content === spec.type`, which also fails when `lastMatch` is a paragraph.
4. A blank line causes the paragraph's `continue` to return `false`, closing it and exposing the list item (`content: Block`), which permits new containers.

## Implementation

Four changes to `src/block.ts`:

### 1. Track `linesSeen` on list items
Each `list_item` container gets `linesSeen: 0` in its `extra` data. The `continue` function increments this counter for each non-blank line where the item continues. Since `continue` is first called on the line *after* the marker, `linesSeen === 1` means only the initial content line exists.

### 2. Helper method: `parentListItem()`
Walks the container stack backward to find the nearest `list_item` container and returns it (or `null` if not inside a list item). The caller reads `linesSeen` from the returned container.

### 3. Modified `checkStarts` gate
Before the gate, the result is cached: `const parentItem = self.parentListItem()` and `const canInterruptPara = parentItem !== null && (parentItem.extra.linesSeen || 0) <= 1`. The gate adds `(lastMatch.content === Inline && canInterruptPara)` as an additional condition allowing new container starts.

### 4. Modified inner type check
Added the same `canInterruptPara` condition to allow Block-type specs to be tried when the paragraph belongs to a single-line list item. Without this, the outer gate would open but no spec would ever be evaluated.

### 5. Lazy continuation tracking
When a lazy continuation occurs (unindented text that continues a paragraph), the nearest parent list item's `linesSeen` is incremented. This prevents `- foo\nbar\n  - baz` from incorrectly allowing the sublist.

The existing `addContainer` method already handles closing the paragraph when a new block container opens, so no additional cleanup was needed.

## Edge Cases Examined

### Cases the new rule handles cleanly

| Input | Result | Notes |
|-------|--------|-------|
| `- foo\n  - bar` | Nested list | Core case: single-line item, sublist interrupts |
| `- foo\n  bar\n  - baz` | `- baz` is paragraph text | Multi-line item blocks interruption |
| `- a\n  - b\n    - c` | Three-level nesting | Each item is single-line, so each allows interruption |
| `- a\n  - b\n  - c` | Tight sublist with two items | Second sibling `- c` is matched by the list's own continue function |
| `- a\n  - b\n\n  - c` | Loose sublist (b and c) | Blank line between items makes inner list loose |
| `- foo\n  > bar` | Blockquote inside list item | Block-level elements other than lists also interrupt |
| `- foo\n  bar\n  > baz` | `> baz` is paragraph text | Continuation blocks all block elements, not just lists |
| `- foo\n  1. bar` | Ordered sublist inside unordered | Mixed list types work |
| `- foo\nbar\n  - baz` | `- baz` is paragraph text | Lazy continuation counts as a content line |
| `- - - a` | Three nested lists (same line) | Unchanged; these are same-line opens, not continuations |
| `- foo\n  bar\n\n  - sub` | Sublist after blank line | Existing behavior preserved; blank line closes paragraph |

### Blockquotes inside list items

The rule applies uniformly to all block-level elements, including blockquotes. `- foo\n  > bar` creates a blockquote inside the list item. This is consistent with the principle: if the item has only one line, the author's intent is unambiguous. After continuation lines, the same `> bar` becomes paragraph text.

This seems correct. There's no reason to treat blockquotes differently from sublists here.

### Tight/loose determination

The tight/loose logic was **not affected** by this change. Blank line events are only emitted on actual blank lines, and the tight/loose tracking in `parse.ts` operates on the event stream. When a sublist opens without a blank line, no `blankline` event exists, so both lists stay tight. When a blank line separates sub-items (e.g., `- b\n\n  - c`), the inner list correctly becomes loose.

### The `linesSeen` counter is per-item

Each `list_item` container has its own `linesSeen` in `container.extra`. Deeply nested items each track their own count independently. This means `- a\n  - b\n    cont\n    - c` correctly allows `- b` (single-line parent) but blocks `- c` (parent has continuation "cont").

## Refinement During Implementation

One refinement was needed beyond the original plan: **lazy continuation tracking**.

Lazy continuation occurs when a line isn't indented enough to match the list item's `continue` function, but the tip is a paragraph, so the parser continues the paragraph "lazily." For example:

```
- foo
bar
  - baz
```

Here `bar` is a lazy continuation of `foo`'s paragraph. The `list_item.continue` function returns `false` for `bar` (insufficient indent), so `linesSeen` is never incremented through the normal path. Without the fix, `linesSeen` would still be 0 on the third line, incorrectly allowing `- baz` to start a sublist.

The fix: when `isLazy` is true, walk the container stack to find the parent `list_item` and increment its `linesSeen`. This makes `- foo\nbar\n  - baz` correctly treat `- baz` as paragraph continuation.

## Test Results

- **3 existing tests changed** (all in `lists.test`): lines 15, 131, 154. All three previously asserted that sublist markers without blank lines are treated as paragraph text. They now assert nested list output.
- **9 new test cases added** covering the edge cases above.
- **All 356 tests pass** across all 13 test suites. No other tests were affected.
- The `block.spec.ts`, `parse.spec.ts`, `pandoc.spec.ts`, `djot-renderer.spec.ts`, and all other spec files pass unchanged.

## Assessment

The rule change is clean and well-contained. The implementation:

- Touches only `block.ts` (5 localized changes)
- Introduces no new data structures; uses the existing `container.extra` mechanism
- Does not affect parsing outside of list items
- Preserves all existing behavior when blank lines are present
- Handles all examined edge cases correctly without special-casing

No fundamental problems were encountered. The only refinement (lazy continuation tracking) was a natural consequence of the parser's existing lazy continuation mechanism and was straightforward to address.

The change makes djot's list syntax more intuitive for the common case (single-line items with sublists) while preserving the safety of requiring blank lines when intent is ambiguous (multi-line items).
