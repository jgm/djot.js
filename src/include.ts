import { Options, IncludeOptions, Warning } from "./options";
import { Event } from "./event";
import { parseEvents } from "./block";

const IMAGE_EXT_RE = /\.(?:png|jpe?g|gif|svg|webp|bmp|ico|tiff?|avif|heic|mp4|webm|ogg|pdf)$/i;
const URL_RE = /^[a-z][a-z0-9+.-]*:\/\//i;
const INCLUSION_RE = /!\[([^\]]*)\]\(([^)]+)\)/g;
const FOOTNOTE_DEF_RE = /^\[\^([^\]]+)\]:/gm;
const REFERENCE_DEF_RE = /^\[([^\]^][^\]]*)\]:/gm;
const EXPLICIT_ID_RE = /\{[^}]*#([\w-]+)/g;
const FENCE_OPEN_RE = /^(\s*)(`{3,}|~{3,})/;

function pathDirname(p: string): string {
  const idx = p.lastIndexOf("/");
  if (idx < 0) return ".";
  if (idx === 0) return "/";
  return p.substring(0, idx);
}

function normalizePath(p: string): string {
  const parts = p.split("/");
  const resolved: string[] = [];
  for (const part of parts) {
    if (part === "." || part === "") continue;
    if (part === ".." && resolved.length > 0 && resolved[resolved.length - 1] !== "..") {
      resolved.pop();
    } else {
      resolved.push(part);
    }
  }
  const result = resolved.join("/");
  return p.startsWith("/") ? "/" + result : result || ".";
}

function pathResolve(base: string, relative: string): string {
  if (relative.startsWith("/")) return normalizePath(relative);
  return normalizePath(base + "/" + relative);
}

export function isImageFile(destination: string): boolean {
  return IMAGE_EXT_RE.test(destination);
}

export function isBinaryContent(content: string): boolean {
  const sample = content.slice(0, 8192);
  return sample.includes("\0");
}

function isUrl(destination: string): boolean {
  return URL_RE.test(destination);
}

export interface InclusionRecord {
  sourcePath: string;
  sourceOffset: number;
  resolvedPath: string;
  destination: string;
  resultOffset: number;
  resultLength: number;
  children: InclusionRecord[];
}

export interface PreprocessResult {
  text: string;
  inclusions: InclusionRecord[];
}

interface TextSegment {
  content: string;
  isCode: boolean;
}

export function splitByCodeFences(text: string): TextSegment[] {
  const lines = text.split("\n");
  const segments: TextSegment[] = [];
  let currentLines: string[] = [];
  let inFence = false;
  let fencePattern: RegExp | null = null;

  for (const line of lines) {
    if (inFence) {
      currentLines.push(line);
      if (fencePattern && fencePattern.test(line)) {
        segments.push({ content: currentLines.join("\n"), isCode: true });
        currentLines = [];
        inFence = false;
        fencePattern = null;
      }
    } else {
      const m = line.match(FENCE_OPEN_RE);
      if (m) {
        if (currentLines.length > 0) {
          segments.push({ content: currentLines.join("\n"), isCode: false });
          currentLines = [];
        }
        currentLines.push(line);
        inFence = true;
        const marker = m[2][0];
        const len = m[2].length;
        fencePattern = new RegExp("^\\s*" + marker + "{" + len + ",}\\s*$");
      } else {
        currentLines.push(line);
      }
    }
  }

  if (currentLines.length > 0) {
    segments.push({ content: currentLines.join("\n"), isCode: inFence });
  }

  // Further split non-fence segments to protect inline backtick spans
  // and attribute comments — single pass over each segment's characters.
  const result: TextSegment[] = [];
  for (const seg of segments) {
    if (seg.isCode) {
      result.push(seg);
    } else {
      splitByInlineProtected(seg.content, result);
    }
  }

  return result;
}

// Scans text for inline backtick spans (single or multi-line) and attribute
// comments ({%...%} and {% inside {... % comment}). Appends segments to `out`.
// Single pass: each character examined at most once.
function splitByInlineProtected(text: string, out: TextSegment[]): void {
  let i = 0;
  let normalStart = 0;

  while (i < text.length) {
    const ch = text[i];

    // --- inline backtick span ---
    if (ch === "`") {
      // Count consecutive opening backticks
      let backtickLen = 0;
      let j = i;
      while (j < text.length && text[j] === "`") {
        backtickLen++;
        j++;
      }
      // Search for matching closing sequence of exactly backtickLen backticks
      let closePos = -1;
      let k = j;
      while (k <= text.length - backtickLen) {
        if (text[k] === "`") {
          let run = 0;
          let kk = k;
          while (kk < text.length && text[kk] === "`") { run++; kk++; }
          if (run === backtickLen) {
            closePos = k;
            break;
          }
          k = kk; // skip past this backtick run
          continue;
        }
        k++;
      }
      if (closePos !== -1) {
        // Push preceding normal text
        if (i > normalStart) {
          out.push({ content: text.substring(normalStart, i), isCode: false });
        }
        const endPos = closePos + backtickLen;
        out.push({ content: text.substring(i, endPos), isCode: true });
        i = endPos;
        normalStart = i;
        continue;
      }
      // No matching close — treat as normal text
      i = j;
      continue;
    }

    // --- block attribute comment {%...%} ---
    if (ch === "{" && i + 1 < text.length && text[i + 1] === "%") {
      const closePos = text.indexOf("%}", i + 2);
      if (closePos !== -1) {
        if (i > normalStart) {
          out.push({ content: text.substring(normalStart, i), isCode: false });
        }
        const endPos = closePos + 2;
        out.push({ content: text.substring(i, endPos), isCode: true });
        i = endPos;
        normalStart = i;
        continue;
      }
    }

    // --- inline attribute comment { ... % comment } ---
    if (ch === "{" && !(i + 1 < text.length && text[i + 1] === "%")) {
      // Scan ahead for % before the closing }
      let j = i + 1;
      let foundPercent = false;
      while (j < text.length) {
        if (text[j] === "}") break;
        if (text[j] === "%") { foundPercent = true; break; }
        j++;
      }
      if (foundPercent) {
        // Find closing }
        let closePos = text.indexOf("}", j + 1);
        if (closePos !== -1) {
          if (i > normalStart) {
            out.push({ content: text.substring(normalStart, i), isCode: false });
          }
          const endPos = closePos + 1;
          out.push({ content: text.substring(i, endPos), isCode: true });
          i = endPos;
          normalStart = i;
          continue;
        }
      }
    }

    i++;
  }

  if (normalStart < text.length) {
    out.push({ content: text.substring(normalStart), isCode: false });
  }
}

export function collectFootnoteLabels(text: string): Set<string> {
  const labels = new Set<string>();
  const segments = splitByCodeFences(text);
  for (const seg of segments) {
    if (seg.isCode) continue;
    const re = new RegExp(FOOTNOTE_DEF_RE.source, "gm");
    let m;
    while ((m = re.exec(seg.content)) !== null) {
      labels.add(m[1]);
    }
  }
  return labels;
}

export function collectReferenceLabels(text: string): Set<string> {
  const labels = new Set<string>();
  const segments = splitByCodeFences(text);
  for (const seg of segments) {
    if (seg.isCode) continue;
    const re = new RegExp(REFERENCE_DEF_RE.source, "gm");
    let m;
    while ((m = re.exec(seg.content)) !== null) {
      labels.add(m[1]);
    }
  }
  return labels;
}

export function collectExplicitIds(text: string): Set<string> {
  const ids = new Set<string>();
  const segments = splitByCodeFences(text);
  for (const seg of segments) {
    if (seg.isCode) continue;
    const re = new RegExp(EXPLICIT_ID_RE.source, "g");
    let m;
    while ((m = re.exec(seg.content)) !== null) {
      ids.add(m[1]);
    }
  }
  return ids;
}

export function renameFootnoteInText(
  text: string,
  oldLabel: string,
  newLabel: string
): string {
  const segments = splitByCodeFences(text);
  return segments
    .map((seg) => {
      if (seg.isCode) return seg.content;
      const escaped = oldLabel.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      return seg.content
        .replace(
          new RegExp("^(\\[\\^)" + escaped + "(\\]:)", "gm"),
          "$1" + newLabel + "$2"
        )
        .replace(
          new RegExp("(\\[\\^)" + escaped + "(\\])", "g"),
          "$1" + newLabel + "$2"
        );
    })
    .join("\n");
}

export function removeReferenceDefinition(
  text: string,
  label: string
): string {
  const segments = splitByCodeFences(text);
  return segments
    .map((seg) => {
      if (seg.isCode) return seg.content;
      const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const defRe = new RegExp(
        "^\\[" + escaped + "\\]:[^\\n]*(?:\\n(?=  )[^\\n]*)*\\n?",
        "gm"
      );
      return seg.content.replace(defRe, "");
    })
    .join("\n");
}

export function renameIdInText(
  text: string,
  oldId: string,
  newId: string
): string {
  const segments = splitByCodeFences(text);
  return segments
    .map((seg) => {
      if (seg.isCode) return seg.content;
      const escaped = oldId.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      return seg.content.replace(
        new RegExp("(\\{[^}]*#)" + escaped + "(?=[}\\s])", "g"),
        "$1" + newId
      );
    })
    .join("\n");
}

function resolveConflicts(
  parentText: string,
  includedText: string,
  warn: (warning: Warning) => void
): string {
  let result = includedText;

  const parentFootnotes = collectFootnoteLabels(parentText);
  const childFootnotes = collectFootnoteLabels(result);
  for (const label of childFootnotes) {
    if (parentFootnotes.has(label)) {
      let n = 1;
      let newLabel = label + "-" + n;
      while (parentFootnotes.has(newLabel) || childFootnotes.has(newLabel)) {
        n++;
        newLabel = label + "-" + n;
      }
      warn(
        new Warning(
          `Footnote [^${label}] conflicts with parent; renamed to [^${newLabel}]`
        )
      );
      result = renameFootnoteInText(result, label, newLabel);
      childFootnotes.delete(label);
      childFootnotes.add(newLabel);
    }
  }

  const parentRefs = collectReferenceLabels(parentText);
  const childRefs = collectReferenceLabels(result);
  for (const label of childRefs) {
    if (parentRefs.has(label)) {
      warn(
        new Warning(
          `Reference [${label}] conflicts with parent; using parent definition`
        )
      );
      result = removeReferenceDefinition(result, label);
    }
  }

  const parentIds = collectExplicitIds(parentText);
  const childIds = collectExplicitIds(result);
  for (const id of childIds) {
    if (parentIds.has(id)) {
      let n = 1;
      let newId = id + "-" + n;
      while (parentIds.has(newId) || childIds.has(newId)) {
        n++;
        newId = id + "-" + n;
      }
      warn(
        new Warning(
          `Explicit ID {#${id}} conflicts with parent; renamed to {#${newId}}`
        )
      );
      result = renameIdInText(result, id, newId);
      childIds.delete(id);
      childIds.add(newId);
    }
  }

  return result;
}

export function preprocessInclusions(
  input: string,
  options: IncludeOptions & Options,
  inclusionStack?: string[]
): PreprocessResult {
  const stack = inclusionStack || [];
  const warn = options.warn || (() => {});
  const basePath = options.basePath || ".";
  const inclusions: InclusionRecord[] = [];

  const segments = splitByCodeFences(input);
  let accumulatedText = "";

  const processedSegments = segments.map((seg) => {
    if (seg.isCode) {
      accumulatedText += seg.content + "\n";
      return seg.content;
    }

    const re = new RegExp(INCLUSION_RE.source, "g");
    let result = "";
    let lastIndex = 0;
    let m;
    while ((m = re.exec(seg.content)) !== null) {
      const beforeMatch = seg.content.substring(lastIndex, m.index);
      result += beforeMatch;
      accumulatedText += beforeMatch;
      lastIndex = m.index + m[0].length;

      const destination = m[2];
      const altText = m[1];
      const sourceOffset = m.index;

      if (isUrl(destination) || isImageFile(destination)) {
        result += m[0];
        accumulatedText += m[0];
        continue;
      }

      const resolvedPath = pathResolve(basePath, destination);

      if (!options.readFile) {
        result += altText;
        accumulatedText += altText;
        continue;
      }

      if (stack.includes(resolvedPath)) {
        warn(new Warning(`Cyclic inclusion of ${resolvedPath}`));
        result += altText;
        accumulatedText += altText;
        continue;
      }

      let content: string | null;
      try {
        content = options.readFile(resolvedPath);
      } catch {
        warn(new Warning(`Could not read file ${resolvedPath}`));
        result += altText;
        accumulatedText += altText;
        continue;
      }

      if (content === null) {
        warn(new Warning(`Could not read file ${resolvedPath}`));
        result += altText;
        accumulatedText += altText;
        continue;
      }

      if (isBinaryContent(content)) {
        result += m[0];
        accumulatedText += m[0];
        continue;
      }

      // Strip one trailing newline (POSIX text files typically end with one)
      if (content.endsWith("\n")) {
        content = content.slice(0, -1);
      }

      const childBasePath = pathDirname(resolvedPath);
      stack.push(resolvedPath);
      const childResult = preprocessInclusions(
        content,
        { ...options, basePath: childBasePath },
        stack
      );
      stack.pop();

      let processed = resolveConflicts(accumulatedText, childResult.text, warn);

      const resultOffset = accumulatedText.length;
      result += processed;
      accumulatedText += processed;

      inclusions.push({
        sourcePath: basePath,
        sourceOffset,
        resolvedPath,
        destination,
        resultOffset,
        resultLength: processed.length,
        children: childResult.inclusions,
      });
    }

    const tail = seg.content.substring(lastIndex);
    result += tail;
    accumulatedText += tail + "\n";
    return result;
  });

  return {
    text: processedSegments.join("\n"),
    inclusions,
  };
}

export interface EventStreams {
  expandedEvents: Event[];
  mainFileEvents: Event[];
  isWellFormed: boolean;
  expandedText: string;
  inclusions: InclusionRecord[];
}


export function buildEventStreams(
  input: string,
  options: IncludeOptions & Options
): EventStreams {
  const ppResult = preprocessInclusions(input, options);
  const expandedParser = parseEvents(ppResult.text, options);
  const rawExpanded = Array.from(expandedParser);
  const expandedEvents = mergeInclusionEvents(rawExpanded, ppResult.inclusions);
  // Parse the original input for main-file events (editor highlighting).
  // If no inclusions, the original input equals the preprocessed text,
  // so reuse rawExpanded and the same parser's well-formedness flags.
  let mainFileEvents: Event[];
  let isWellFormed: boolean;
  if (ppResult.inclusions.length === 0) {
    mainFileEvents = rawExpanded;
    isWellFormed = !expandedParser.hasUnmatchedOpeners && !expandedParser.hasUnmatchedClosers;
  } else {
    const parser = parseEvents(input, options);
    mainFileEvents = Array.from(parser);
    isWellFormed = !parser.hasUnmatchedOpeners && !parser.hasUnmatchedClosers;
  }
  return {
    expandedEvents,
    mainFileEvents,
    isWellFormed,
    expandedText: ppResult.text,
    inclusions: ppResult.inclusions,
  };
}

interface InclusionBoundary {
  offset: number;
  type: "open" | "close";
  resolvedPath: string;
  destination: string;
}

function flattenBoundaries(
  inclusions: InclusionRecord[]
): InclusionBoundary[] {
  const boundaries: InclusionBoundary[] = [];
  for (const rec of inclusions) {
    boundaries.push({
      offset: rec.resultOffset,
      type: "open",
      resolvedPath: rec.resolvedPath,
      destination: rec.destination,
    });
    // Recurse into children — they are already at their correct resultOffset
    const childBoundaries = flattenBoundaries(rec.children);
    for (const cb of childBoundaries) {
      boundaries.push(cb);
    }
    boundaries.push({
      offset: rec.resultOffset + rec.resultLength,
      type: "close",
      resolvedPath: rec.resolvedPath,
      destination: rec.destination,
    });
  }
  // Sort by offset; closes before opens at same offset
  // (back-to-back inclusions: previous must close before next opens)
  boundaries.sort((a, b) => {
    if (a.offset !== b.offset) return a.offset - b.offset;
    return a.type === "close" ? -1 : 1;
  });
  return boundaries;
}

export function mergeInclusionEvents(
  events: Event[],
  inclusions: InclusionRecord[]
): Event[] {
  if (inclusions.length === 0) return events;

  const boundaries = flattenBoundaries(inclusions);
  const opens = boundaries.filter((b) => b.type === "open");
  const closes = boundaries.filter((b) => b.type === "close");

  // Two-pass approach: first determine insertion indices, then build result.

  // For opens at offset X: insert before the first event with startpos >= X
  const openInserts: { index: number; boundary: InclusionBoundary }[] = [];
  let oi = 0;
  for (let i = 0; i < events.length && oi < opens.length; i++) {
    while (oi < opens.length && opens[oi].offset <= events[i].startpos) {
      openInserts.push({ index: i, boundary: opens[oi] });
      oi++;
    }
  }
  // Any remaining opens go at the end
  while (oi < opens.length) {
    openInserts.push({ index: events.length, boundary: opens[oi] });
    oi++;
  }

  // For closes at offset X: insert after the last event where
  // startpos < X, or (startpos == X and annot starts with "-").
  // This ensures container close events at the boundary are included
  // before the -inclusion marker.
  const closeInserts: { index: number; boundary: InclusionBoundary }[] = [];
  let ci = 0;
  for (let i = 0; i < events.length && ci < closes.length; i++) {
    const ev = events[i];
    const nextEv = i + 1 < events.length ? events[i + 1] : null;
    const closeOffset = closes[ci].offset;

    // Check if this is the last event that belongs to the inclusion:
    // The current event is within range, and either there's no next event,
    // or the next event is beyond the boundary (starts past closeOffset),
    // or the next event is at the boundary but is an open event (not a close).
    const evBelongs = ev.startpos < closeOffset ||
      (ev.startpos === closeOffset && ev.annot.startsWith("-"));
    const nextBelongs = nextEv &&
      (nextEv.startpos < closeOffset ||
       (nextEv.startpos === closeOffset && nextEv.annot.startsWith("-")));

    if (evBelongs && !nextBelongs) {
      closeInserts.push({ index: i + 1, boundary: closes[ci] });
      ci++;
      // Check if multiple closes fire at the same position
      while (ci < closes.length && closes[ci].offset <= closeOffset) {
        closeInserts.push({ index: i + 1, boundary: closes[ci] });
        ci++;
      }
    }
  }
  // Any remaining closes go at the end
  while (ci < closes.length) {
    closeInserts.push({ index: events.length, boundary: closes[ci] });
    ci++;
  }

  // Merge all insertions sorted by index (opens before closes at same index,
  // since opens at an index go before the event there and closes go after)
  const allInserts: { index: number; event: Event }[] = [];
  for (const o of openInserts) {
    allInserts.push({
      index: o.index,
      event: {
        startpos: o.boundary.offset,
        endpos: o.boundary.offset,
        annot: "+inclusion|" + o.boundary.resolvedPath,
      },
    });
  }
  for (const c of closeInserts) {
    allInserts.push({
      index: c.index,
      event: {
        startpos: c.boundary.offset,
        endpos: c.boundary.offset,
        annot: "-inclusion",
      },
    });
  }
  // Stable sort: by index, then by boundary offset, then closes before opens.
  // Closes-before-opens handles back-to-back (sequential) inclusions correctly:
  // the previous inclusion must close before the next one opens.
  // For nested boundaries, opens and closes are always at different offsets,
  // so this tiebreaker never applies and nesting is preserved by offset order.
  allInserts.sort((a, b) => {
    if (a.index !== b.index) return a.index - b.index;
    if (a.event.startpos !== b.event.startpos) return a.event.startpos - b.event.startpos;
    const aIsClose = a.event.annot.startsWith("-") ? 0 : 1;
    const bIsClose = b.event.annot.startsWith("-") ? 0 : 1;
    return aIsClose - bIsClose;
  });

  // Build result
  const result: Event[] = [];
  let insertIdx = 0;
  for (let i = 0; i < events.length; i++) {
    // Insert any synthetic events that go before this index
    while (insertIdx < allInserts.length && allInserts[insertIdx].index === i) {
      result.push(allInserts[insertIdx].event);
      insertIdx++;
    }
    result.push(events[i]);
  }
  // Insert any remaining synthetic events at the end
  while (insertIdx < allInserts.length) {
    result.push(allInserts[insertIdx].event);
    insertIdx++;
  }

  return result;
}
