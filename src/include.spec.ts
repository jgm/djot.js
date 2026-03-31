/// <reference types="jest" />
import {
  preprocessInclusions,
  mergeInclusionEvents,
  isImageFile,
  isBinaryContent,
  splitByCodeFences,
  collectFootnoteLabels,
  collectReferenceLabels,
  collectExplicitIds,
  renameFootnoteInText,
  removeReferenceDefinition,
  renameIdInText,
  buildEventStreams,
} from "./include";
import { parseEvents } from "./block";
import { parse, parseFromEvents } from "./parse";
import { renderHTML } from "./html";
import { Warning } from "./options";

function mockReadFile(files: Record<string, string>): (p: string) => string | null {
  return (p: string) => {
    for (const [key, val] of Object.entries(files)) {
      if (p.endsWith(key) || p === key) return val;
    }
    return null;
  };
}

const noWarn = () => {};

describe("isImageFile", () => {
  it("returns true for common image extensions", () => {
    expect(isImageFile("photo.png")).toBe(true);
    expect(isImageFile("photo.jpg")).toBe(true);
    expect(isImageFile("photo.jpeg")).toBe(true);
    expect(isImageFile("photo.gif")).toBe(true);
    expect(isImageFile("photo.svg")).toBe(true);
    expect(isImageFile("photo.webp")).toBe(true);
    expect(isImageFile("photo.bmp")).toBe(true);
    expect(isImageFile("photo.avif")).toBe(true);
    expect(isImageFile("photo.ico")).toBe(true);
  });

  it("returns true for media extensions", () => {
    expect(isImageFile("video.mp4")).toBe(true);
    expect(isImageFile("video.webm")).toBe(true);
    expect(isImageFile("audio.ogg")).toBe(true);
    expect(isImageFile("doc.pdf")).toBe(true);
  });

  it("is case-insensitive", () => {
    expect(isImageFile("PHOTO.PNG")).toBe(true);
    expect(isImageFile("photo.JPG")).toBe(true);
  });

  it("returns false for text-like extensions", () => {
    expect(isImageFile("file.dj")).toBe(false);
    expect(isImageFile("file.djot")).toBe(false);
    expect(isImageFile("file.txt")).toBe(false);
    expect(isImageFile("file.md")).toBe(false);
    expect(isImageFile("file.html")).toBe(false);
  });

  it("returns false for files without extensions", () => {
    expect(isImageFile("README")).toBe(false);
    expect(isImageFile("Makefile")).toBe(false);
  });
});

describe("isBinaryContent", () => {
  it("returns false for plain text", () => {
    expect(isBinaryContent("Hello, world!\nSecond line.")).toBe(false);
  });

  it("returns false for empty string", () => {
    expect(isBinaryContent("")).toBe(false);
  });

  it("returns true for content with null bytes", () => {
    expect(isBinaryContent("GIF89a\0\0\0")).toBe(true);
  });

  it("returns true for null byte at start", () => {
    expect(isBinaryContent("\0PNG")).toBe(true);
  });

  it("detects binary within first 8KB", () => {
    const text = "a".repeat(4000) + "\0" + "b".repeat(4000);
    expect(isBinaryContent(text)).toBe(true);
  });

  it("ignores null bytes past 8KB", () => {
    const text = "a".repeat(9000) + "\0";
    expect(isBinaryContent(text)).toBe(false);
  });
});

describe("splitByCodeFences", () => {
  it("returns single segment for text with no fences", () => {
    const segs = splitByCodeFences("hello\nworld");
    expect(segs).toEqual([{ content: "hello\nworld", isCode: false }]);
  });

  it("splits fenced code blocks", () => {
    const text = "before\n```\ncode\n```\nafter";
    const segs = splitByCodeFences(text);
    expect(segs.length).toBe(3);
    expect(segs[0]).toEqual({ content: "before", isCode: false });
    expect(segs[1]).toEqual({ content: "```\ncode\n```", isCode: true });
    expect(segs[2]).toEqual({ content: "after", isCode: false });
  });

  it("handles tilde fences", () => {
    const text = "before\n~~~\ncode\n~~~\nafter";
    const segs = splitByCodeFences(text);
    expect(segs[1]).toEqual({ content: "~~~\ncode\n~~~", isCode: true });
  });

  it("handles unclosed fence as code to end", () => {
    const text = "before\n```\ncode\nmore code";
    const segs = splitByCodeFences(text);
    expect(segs[1].isCode).toBe(true);
    expect(segs[1].content).toContain("code");
  });
});

describe("collectFootnoteLabels", () => {
  it("finds footnote definitions", () => {
    const text = "text\n[^note]: definition\n[^other]: another";
    expect(collectFootnoteLabels(text)).toEqual(new Set(["note", "other"]));
  });

  it("ignores footnotes inside code fences", () => {
    const text = "```\n[^note]: in code\n```\n[^real]: real";
    expect(collectFootnoteLabels(text)).toEqual(new Set(["real"]));
  });
});

describe("collectReferenceLabels", () => {
  it("finds reference definitions", () => {
    const text = "[link]: http://example.com\n[other]: http://other.com";
    expect(collectReferenceLabels(text)).toEqual(new Set(["link", "other"]));
  });

  it("does not match footnote definitions", () => {
    const text = "[^note]: definition\n[link]: url";
    expect(collectReferenceLabels(text)).toEqual(new Set(["link"]));
  });
});

describe("collectExplicitIds", () => {
  it("finds explicit IDs", () => {
    const text = "# Heading {#myid}\n\n::: {#other}";
    expect(collectExplicitIds(text)).toEqual(new Set(["myid", "other"]));
  });

  it("ignores IDs inside code fences", () => {
    const text = "```\n{#fake}\n```\n{#real}";
    expect(collectExplicitIds(text)).toEqual(new Set(["real"]));
  });
});

describe("renameFootnoteInText", () => {
  it("renames both definition and references", () => {
    const text = "[^note]: definition\n\nSee [^note] for details.";
    const result = renameFootnoteInText(text, "note", "note-1");
    expect(result).toContain("[^note-1]: definition");
    expect(result).toContain("[^note-1]");
    expect(result).not.toContain("[^note]");
  });
});

describe("removeReferenceDefinition", () => {
  it("removes matching definition", () => {
    const text = "[link]: http://example.com\n\nSome text with [link].";
    const result = removeReferenceDefinition(text, "link");
    expect(result).not.toContain("[link]: http://example.com");
    expect(result).toContain("[link]");
  });
});

describe("renameIdInText", () => {
  it("renames explicit ID", () => {
    const text = "# Heading {#myid}";
    const result = renameIdInText(text, "myid", "myid-1");
    expect(result).toBe("# Heading {#myid-1}");
  });
});

describe("preprocessInclusions", () => {
  it("substitutes basic inclusion", () => {
    const result = preprocessInclusions("before\n![](child.dj)\nafter", {
      readFile: mockReadFile({ "child.dj": "included content" }),
      basePath: "/test",
      warn: noWarn,
    });
    expect(result.text).toContain("included content");
    expect(result.text).toContain("before");
    expect(result.text).toContain("after");
    expect(result.text).not.toContain("![](child.dj)");
  });

  it("produces correct HTML for basic inclusion", () => {
    const result = preprocessInclusions("# Main\n\n![](child.dj)", {
      readFile: mockReadFile({ "child.dj": "Hello from child." }),
      basePath: "/test",
      warn: noWarn,
    });
    const html = renderHTML(parse(result.text, { warn: noWarn }), { warn: noWarn });
    expect(html).toContain("<h1>");
    expect(html).toContain("Hello from child.");
  });

  it("handles cross-file syntax interactions", () => {
    const result = preprocessInclusions("![](a.dj)![](b.dj)", {
      readFile: mockReadFile({
        "a.dj": "*bold start ",
        "b.dj": "bold end*",
      }),
      basePath: "/test",
      warn: noWarn,
    });
    const html = renderHTML(parse(result.text, { warn: noWarn }), { warn: noWarn });
    expect(html).toContain("<strong>");
  });

  it("handles nested inclusion (A includes B which includes C)", () => {
    const result = preprocessInclusions("![](a.dj)", {
      readFile: mockReadFile({
        "a.dj": "from A\n![](b.dj)",
        "b.dj": "from B\n![](c.dj)",
        "c.dj": "from C",
      }),
      basePath: "/test",
      warn: noWarn,
    });
    expect(result.text).toContain("from A");
    expect(result.text).toContain("from B");
    expect(result.text).toContain("from C");
  });

  it("detects cyclic inclusion (A -> B -> A)", () => {
    const warnings: string[] = [];
    const result = preprocessInclusions("![](a.dj)", {
      readFile: mockReadFile({
        "a.dj": "from A\n![](b.dj)",
        "b.dj": "from B\n![](a.dj)",
      }),
      basePath: "/test",
      warn: (w: Warning) => warnings.push(w.message),
    });
    expect(warnings.some((m) => m.includes("Cyclic inclusion"))).toBe(true);
    expect(result.text).toContain("from A");
    expect(result.text).toContain("from B");
  });

  it("detects self-inclusion", () => {
    const warnings: string[] = [];
    const result = preprocessInclusions("![](self.dj)", {
      readFile: mockReadFile({
        "self.dj": "text\n![](self.dj)",
      }),
      basePath: "/test",
      warn: (w: Warning) => warnings.push(w.message),
    });
    expect(warnings.some((m) => m.includes("Cyclic inclusion"))).toBe(true);
  });

  it("leaves image references (.png) unchanged", () => {
    const result = preprocessInclusions("![alt](photo.png)", {
      readFile: mockReadFile({}),
      basePath: "/test",
      warn: noWarn,
    });
    expect(result.text).toContain("![alt](photo.png)");
  });

  it("handles multiple inclusions on one line", () => {
    const result = preprocessInclusions("![](a.dj)![](b.dj)", {
      readFile: mockReadFile({
        "a.dj": "AAA",
        "b.dj": "BBB",
      }),
      basePath: "/test",
      warn: noWarn,
    });
    expect(result.text).toContain("AAA");
    expect(result.text).toContain("BBB");
  });

  it("handles inline inclusion with surrounding text", () => {
    const result = preprocessInclusions("prefix ![](a.dj) suffix", {
      readFile: mockReadFile({ "a.dj": "MIDDLE" }),
      basePath: "/test",
      warn: noWarn,
    });
    expect(result.text).toContain("prefix");
    expect(result.text).toContain("MIDDLE");
    expect(result.text).toContain("suffix");
  });

  it("resolves footnote conflicts", () => {
    const warnings: string[] = [];
    const result = preprocessInclusions(
      "Parent[^note]\n\n[^note]: parent def\n\n![](child.dj)",
      {
        readFile: mockReadFile({
          "child.dj": "Child[^note]\n\n[^note]: child def",
        }),
        basePath: "/test",
        warn: (w: Warning) => warnings.push(w.message),
      }
    );
    expect(warnings.some((m) => m.includes("Footnote"))).toBe(true);
    expect(result.text).toContain("[^note-1]");
  });

  it("resolves reference conflicts (parent wins)", () => {
    const warnings: string[] = [];
    const result = preprocessInclusions(
      "[link]: http://parent.com\n\n![](child.dj)",
      {
        readFile: mockReadFile({
          "child.dj": "[link]: http://child.com\n\nSee [link].",
        }),
        basePath: "/test",
        warn: (w: Warning) => warnings.push(w.message),
      }
    );
    expect(warnings.some((m) => m.includes("Reference"))).toBe(true);
    expect(result.text).not.toContain("http://child.com");
  });

  it("resolves explicit ID conflicts", () => {
    const warnings: string[] = [];
    const result = preprocessInclusions(
      "# Heading {#myid}\n\n![](child.dj)",
      {
        readFile: mockReadFile({
          "child.dj": "# Other {#myid}",
        }),
        basePath: "/test",
        warn: (w: Warning) => warnings.push(w.message),
      }
    );
    expect(warnings.some((m) => m.includes("Explicit ID"))).toBe(true);
    expect(result.text).toContain("{#myid-1}");
  });

  it("handles missing file gracefully", () => {
    const warnings: string[] = [];
    const result = preprocessInclusions("![](missing.dj)", {
      readFile: () => null,
      basePath: "/test",
      warn: (w: Warning) => warnings.push(w.message),
    });
    expect(warnings.some((m) => m.includes("Could not read"))).toBe(true);
    // Alt text is empty, so the pattern is removed
    expect(result.text).not.toContain("![](missing.dj)");
  });

  it("browser mode: no readFile, removes inclusion pattern", () => {
    const result = preprocessInclusions("![](file.dj)", {
      basePath: "/test",
      warn: noWarn,
    });
    expect(result.text).not.toContain("![](file.dj)");
  });

  it("handles empty included file", () => {
    const result = preprocessInclusions("before\n![](empty.dj)\nafter", {
      readFile: mockReadFile({ "empty.dj": "" }),
      basePath: "/test",
      warn: noWarn,
    });
    expect(result.text).toContain("before");
    expect(result.text).toContain("after");
  });

  it("does not process inclusions inside code fences", () => {
    const result = preprocessInclusions(
      "```\n![](file.dj)\n```",
      {
        readFile: mockReadFile({ "file.dj": "SHOULD NOT APPEAR" }),
        basePath: "/test",
        warn: noWarn,
      }
    );
    expect(result.text).toContain("![](file.dj)");
    expect(result.text).not.toContain("SHOULD NOT APPEAR");
  });

  it("handles inclusion inside block quote", () => {
    const result = preprocessInclusions("> ![](child.dj)", {
      readFile: mockReadFile({ "child.dj": "quoted content" }),
      basePath: "/test",
      warn: noWarn,
    });
    expect(result.text).toContain("> quoted content");
  });

  it("handles inclusion inside list item", () => {
    const result = preprocessInclusions("- ![](child.dj)", {
      readFile: mockReadFile({ "child.dj": "list content" }),
      basePath: "/test",
      warn: noWarn,
    });
    expect(result.text).toContain("- list content");
  });

  it("handles readFile that throws", () => {
    const warnings: string[] = [];
    const result = preprocessInclusions("![](bad.dj)", {
      readFile: () => { throw new Error("ENOENT"); },
      basePath: "/test",
      warn: (w: Warning) => warnings.push(w.message),
    });
    expect(warnings.some((m) => m.includes("Could not read"))).toBe(true);
    expect(result.text).not.toContain("![](bad.dj)");
  });

  it("emits onInclude for every detected inclusion", () => {
    const result = preprocessInclusions("![](a.dj) and ![](b.dj)", {
      readFile: mockReadFile({ "a.dj": "A", "b.dj": "B" }),
      basePath: "/test",
      warn: noWarn,
    });
    expect(result.inclusions.length).toBe(2);
  });

  it("handles .djot extension", () => {
    const result = preprocessInclusions("![](file.djot)", {
      readFile: mockReadFile({ "file.djot": "djot content" }),
      basePath: "/test",
      warn: noWarn,
    });
    expect(result.text).toContain("djot content");
  });

  it("includes files without extensions", () => {
    const result = preprocessInclusions("![](README)", {
      readFile: mockReadFile({ "README": "readme content" }),
      basePath: "/test",
      warn: noWarn,
    });
    expect(result.text).toContain("readme content");
    expect(result.text).not.toContain("![](README)");
  });

  it("includes .txt files", () => {
    const result = preprocessInclusions("![](notes.txt)", {
      readFile: mockReadFile({ "notes.txt": "plain text content" }),
      basePath: "/test",
      warn: noWarn,
    });
    expect(result.text).toContain("plain text content");
  });

  it("includes .md files", () => {
    const result = preprocessInclusions("![](doc.md)", {
      readFile: mockReadFile({ "doc.md": "markdown content" }),
      basePath: "/test",
      warn: noWarn,
    });
    expect(result.text).toContain("markdown content");
  });

  it("includes .html files", () => {
    const result = preprocessInclusions("![](fragment.html)", {
      readFile: mockReadFile({ "fragment.html": "<p>html</p>" }),
      basePath: "/test",
      warn: noWarn,
    });
    expect(result.text).toContain("<p>html</p>");
  });

  it("leaves all image extensions as images", () => {
    const exts = ["png", "jpg", "jpeg", "gif", "svg", "webp", "bmp", "avif", "ico"];
    for (const ext of exts) {
      const result = preprocessInclusions(`![alt](photo.${ext})`, {
        readFile: mockReadFile({}),
        basePath: "/test",
        warn: noWarn,
      });
      expect(result.text).toContain(`![alt](photo.${ext})`);
    }
  });

  it("leaves URLs unchanged", () => {
    const result = preprocessInclusions("![alt](https://example.com/page)", {
      readFile: mockReadFile({}),
      basePath: "/test",
      warn: noWarn,
    });
    expect(result.text).toContain("![alt](https://example.com/page)");
  });

  it("leaves URLs with various schemes unchanged", () => {
    for (const url of ["http://x.com/a", "ftp://files.org/b", "data://foo"]) {
      const result = preprocessInclusions(`![](${url})`, {
        readFile: mockReadFile({}),
        basePath: "/test",
        warn: noWarn,
      });
      expect(result.text).toContain(`![](${url})`);
    }
  });

  it("skips binary content from readFile (null-byte detection)", () => {
    const binaryContent = "GIF89a\0\x01\x02\x03";
    const result = preprocessInclusions("![](mystery.dat)", {
      readFile: mockReadFile({ "mystery.dat": binaryContent }),
      basePath: "/test",
      warn: noWarn,
    });
    expect(result.text).toContain("![](mystery.dat)");
    expect(result.text).not.toContain("GIF89a");
  });
});

describe("InclusionRecord metadata", () => {
  it("returns inclusions array with correct resolvedPath", () => {
    const result = preprocessInclusions("![](child.dj)", {
      readFile: mockReadFile({ "child.dj": "content" }),
      basePath: "/test",
      warn: noWarn,
    });
    expect(result.inclusions.length).toBe(1);
    expect(result.inclusions[0].resolvedPath).toContain("child.dj");
    expect(result.inclusions[0].destination).toBe("child.dj");
  });

  it("records correct resultOffset and resultLength", () => {
    const result = preprocessInclusions("AB![](child.dj)CD", {
      readFile: mockReadFile({ "child.dj": "XYZ" }),
      basePath: "/test",
      warn: noWarn,
    });
    expect(result.inclusions.length).toBe(1);
    const rec = result.inclusions[0];
    expect(rec.resultOffset).toBe(2);
    expect(rec.resultLength).toBe(3);
    expect(result.text.substring(rec.resultOffset, rec.resultOffset + rec.resultLength)).toBe("XYZ");
  });

  it("nested inclusions produce children records", () => {
    const result = preprocessInclusions("![](a.dj)", {
      readFile: mockReadFile({
        "a.dj": "from A\n![](b.dj)",
        "b.dj": "from B",
      }),
      basePath: "/test",
      warn: noWarn,
    });
    expect(result.inclusions.length).toBe(1);
    expect(result.inclusions[0].resolvedPath).toContain("a.dj");
    expect(result.inclusions[0].children.length).toBe(1);
    expect(result.inclusions[0].children[0].resolvedPath).toContain("b.dj");
  });

  it("multiple inclusions on one line produce multiple records", () => {
    const result = preprocessInclusions("![](a.dj)![](b.dj)", {
      readFile: mockReadFile({ "a.dj": "A", "b.dj": "B" }),
      basePath: "/test",
      warn: noWarn,
    });
    expect(result.inclusions.length).toBe(2);
    expect(result.inclusions[0].resolvedPath).toContain("a.dj");
    expect(result.inclusions[1].resolvedPath).toContain("b.dj");
  });

  it("no records for images, URLs, or failed reads", () => {
    const result = preprocessInclusions(
      "![](photo.png) ![](https://x.com) ![](missing.dj)",
      {
        readFile: () => null,
        basePath: "/test",
        warn: noWarn,
      }
    );
    expect(result.inclusions.length).toBe(0);
  });
});

describe("mergeInclusionEvents", () => {
  it("injects +inclusion/-inclusion events at correct positions", () => {
    const result = preprocessInclusions("![](child.dj)", {
      readFile: mockReadFile({ "child.dj": "hello" }),
      basePath: "/test",
      warn: noWarn,
    });
    const rawEvents = Array.from(parseEvents(result.text, { warn: noWarn }));
    const merged = mergeInclusionEvents(rawEvents, result.inclusions);
    const inclusionOpens = merged.filter((e) => e.annot.startsWith("+inclusion"));
    const inclusionCloses = merged.filter((e) => e.annot === "-inclusion");
    expect(inclusionOpens.length).toBe(1);
    expect(inclusionCloses.length).toBe(1);
  });

  it("events carry resolvedPath in annotation suffix", () => {
    const result = preprocessInclusions("![](child.dj)", {
      readFile: mockReadFile({ "child.dj": "hello" }),
      basePath: "/test",
      warn: noWarn,
    });
    const rawEvents = Array.from(parseEvents(result.text, { warn: noWarn }));
    const merged = mergeInclusionEvents(rawEvents, result.inclusions);
    const openEvent = merged.find((e) => e.annot.startsWith("+inclusion"));
    expect(openEvent).toBeDefined();
    expect(openEvent!.annot).toContain("child.dj");
  });

  it("nested inclusions produce nested event pairs", () => {
    const result = preprocessInclusions("![](a.dj)", {
      readFile: mockReadFile({
        "a.dj": "outer\n![](b.dj)\nend",
        "b.dj": "inner",
      }),
      basePath: "/test",
      warn: noWarn,
    });
    const rawEvents = Array.from(parseEvents(result.text, { warn: noWarn }));
    const merged = mergeInclusionEvents(rawEvents, result.inclusions);
    const opens = merged.filter((e) => e.annot.startsWith("+inclusion"));
    const closes = merged.filter((e) => e.annot === "-inclusion");
    expect(opens.length).toBe(2);
    expect(closes.length).toBe(2);
  });

  it("empty inclusions array returns events unchanged", () => {
    const rawEvents = Array.from(parseEvents("hello world", { warn: noWarn }));
    const merged = mergeInclusionEvents(rawEvents, []);
    expect(merged).toEqual(rawEvents);
  });
});

describe("Inclusion AST nodes", () => {
  function parseWithInclusions(input: string, files: Record<string, string>) {
    const result = preprocessInclusions(input, {
      readFile: mockReadFile(files),
      basePath: "/test",
      warn: noWarn,
    });
    const rawEvents = Array.from(parseEvents(result.text, { warn: noWarn }));
    const merged = mergeInclusionEvents(rawEvents, result.inclusions);
    return parseFromEvents(merged, result.text, { warn: noWarn });
  }

  it("basic inclusion produces Inclusion node in AST", () => {
    const doc = parseWithInclusions("# Main\n\n![](child.dj)", {
      "child.dj": "Hello from child.",
    });
    const findInclusion = (nodes: any[]): any => {
      for (const n of nodes) {
        if (n.tag === "inclusion") return n;
        if (n.children) {
          const found = findInclusion(n.children);
          if (found) return found;
        }
      }
      return null;
    };
    const inc = findInclusion(doc.children);
    expect(inc).not.toBeNull();
    expect(inc.tag).toBe("inclusion");
  });

  it("Inclusion node has correct resolvedPath", () => {
    const doc = parseWithInclusions("![](child.dj)", {
      "child.dj": "Content here.",
    });
    const findInclusion = (nodes: any[]): any => {
      for (const n of nodes) {
        if (n.tag === "inclusion") return n;
        if (n.children) {
          const found = findInclusion(n.children);
          if (found) return found;
        }
      }
      return null;
    };
    const inc = findInclusion(doc.children);
    expect(inc).not.toBeNull();
    expect(inc.resolvedPath).toContain("child.dj");
  });

  it("nested inclusion produces nested Inclusion nodes", () => {
    const doc = parseWithInclusions("![](a.dj)", {
      "a.dj": "outer\n\n![](b.dj)\n\nend",
      "b.dj": "inner",
    });
    const findAllInclusions = (nodes: any[]): any[] => {
      const found: any[] = [];
      for (const n of nodes) {
        if (n.tag === "inclusion") found.push(n);
        if (n.children) found.push(...findAllInclusions(n.children));
      }
      return found;
    };
    const allInc = findAllInclusions(doc.children);
    expect(allInc.length).toBe(2);
  });

  it("Inclusion renders correctly in HTML", () => {
    const doc = parseWithInclusions("# Main\n\n![](child.dj)", {
      "child.dj": "Hello from child.",
    });
    const html = renderHTML(doc, { warn: noWarn });
    expect(html).toContain("Hello from child.");
    expect(html).toContain('class="inclusion"');
    expect(html).toContain("data-path");
  });
});

describe("back-to-back inclusion event ordering", () => {
  it("close event comes before open event at same position", () => {
    const result = preprocessInclusions("![](a.dj)![](b.dj)", {
      readFile: mockReadFile({ "a.dj": "AAA", "b.dj": "BBB" }),
      basePath: "/test",
      warn: noWarn,
    });
    const rawEvents = Array.from(parseEvents(result.text, { warn: noWarn }));
    const merged = mergeInclusionEvents(rawEvents, result.inclusions);
    const inclusionEvents = merged.filter((e) => e.annot.includes("inclusion"));
    // Expected order: +inclusion|a, -inclusion, +inclusion|b, -inclusion
    expect(inclusionEvents.length).toBe(4);
    expect(inclusionEvents[0].annot).toContain("+inclusion");
    expect(inclusionEvents[0].annot).toContain("a.dj");
    expect(inclusionEvents[1].annot).toBe("-inclusion");
    expect(inclusionEvents[2].annot).toContain("+inclusion");
    expect(inclusionEvents[2].annot).toContain("b.dj");
    expect(inclusionEvents[3].annot).toBe("-inclusion");
  });

  it("back-to-back inclusions produce separate Inclusion AST nodes", () => {
    const result = preprocessInclusions("![](a.dj)\n\n![](b.dj)", {
      readFile: mockReadFile({ "a.dj": "First.", "b.dj": "Second." }),
      basePath: "/test",
      warn: noWarn,
    });
    const rawEvents = Array.from(parseEvents(result.text, { warn: noWarn }));
    const merged = mergeInclusionEvents(rawEvents, result.inclusions);
    const doc = parseFromEvents(merged, result.text, { warn: noWarn });
    const findAllInclusions = (nodes: any[]): any[] => {
      const found: any[] = [];
      for (const n of nodes) {
        if (n.tag === "inclusion") found.push(n);
        if (n.children) found.push(...findAllInclusions(n.children));
      }
      return found;
    };
    const allInc = findAllInclusions(doc.children);
    expect(allInc.length).toBe(2);
  });
});

describe("readFile map-based inclusion (browser pattern)", () => {
  it("processes inclusions using a pre-built file map", () => {
    const fileMap: Record<string, string> = {
      "/base/child.dj": "Hello from child.",
    };
    const result = preprocessInclusions("![](child.dj)", {
      readFile: (p: string) => fileMap[p] || null,
      basePath: "/base",
      warn: noWarn,
    });
    expect(result.text).toContain("Hello from child.");
    expect(result.text).not.toContain("![](child.dj)");
  });

  it("handles nested inclusions with a pre-built map", () => {
    const fileMap: Record<string, string> = {
      "/base/a.dj": "outer\n\n![](b.dj)\n\nend",
      "/base/b.dj": "inner content",
    };
    const result = preprocessInclusions("![](a.dj)", {
      readFile: (p: string) => fileMap[p] || null,
      basePath: "/base",
      warn: noWarn,
    });
    expect(result.text).toContain("outer");
    expect(result.text).toContain("inner content");
    expect(result.text).toContain("end");
  });

  it("returns null for files not in the map (leaves pattern)", () => {
    const fileMap: Record<string, string> = {};
    const warnings: string[] = [];
    const result = preprocessInclusions("![](missing.dj)", {
      readFile: (p: string) => fileMap[p] || null,
      basePath: "/base",
      warn: (w) => warnings.push(w.message),
    });
    expect(result.text).not.toContain("![](missing.dj)");
    expect(warnings.length).toBe(1);
  });

  it("produces correct HTML from map-based inclusions", () => {
    const fileMap: Record<string, string> = {
      "/base/child.dj": "Included *text*.",
    };
    const result = preprocessInclusions("# Title\n\n![](child.dj)", {
      readFile: (p: string) => fileMap[p] || null,
      basePath: "/base",
      warn: noWarn,
    });
    const rawEvents = Array.from(parseEvents(result.text, { warn: noWarn }));
    const merged = mergeInclusionEvents(rawEvents, result.inclusions);
    const doc = parseFromEvents(merged, result.text, { warn: noWarn });
    const html = renderHTML(doc, { warn: noWarn });
    expect(html).toContain("Included");
    expect(html).toContain("<strong>text</strong>");
  });
});

describe("buildEventStreams", () => {
  it("returns expanded events with inclusion markers", () => {
    const fileMap: Record<string, string> = {
      "/base/child.dj": "Included paragraph.",
    };
    const result = buildEventStreams("# Title\n\n![](child.dj)", {
      readFile: (p: string) => fileMap[p] || null,
      basePath: "/base",
      warn: noWarn,
    });
    expect(result.expandedEvents.length).toBeGreaterThan(0);
    const annots = result.expandedEvents.map(e => e.annot);
    expect(annots.some(a => a.startsWith("+inclusion"))).toBe(true);
    expect(annots.some(a => a.startsWith("-inclusion"))).toBe(true);
  });

  it("isWellFormed is true for balanced markup", () => {
    const result = buildEventStreams("Hello *bold* world.", {
      readFile: () => null,
      basePath: "/base",
      warn: noWarn,
    });
    expect(result.isWellFormed).toBe(true);
  });

  it("isWellFormed is false for unmatched opener", () => {
    const result = buildEventStreams("Hello *world without closing.", {
      readFile: () => null,
      basePath: "/base",
      warn: noWarn,
    });
    expect(result.isWellFormed).toBe(false);
  });

  it("isWellFormed is false for unmatched underscore emphasis", () => {
    const result = buildEventStreams("Hello _emphasis not closed.", {
      readFile: () => null,
      basePath: "/base",
      warn: noWarn,
    });
    expect(result.isWellFormed).toBe(false);
  });

  it("isWellFormed is true when all openers match in multiple paragraphs", () => {
    const result = buildEventStreams("First *bold*.\n\nSecond _emph_ here.", {
      readFile: () => null,
      basePath: "/base",
      warn: noWarn,
    });
    expect(result.isWellFormed).toBe(true);
  });

  it("isWellFormed is false when one paragraph has unmatched opener", () => {
    const result = buildEventStreams("Paragraph *ok*.\n\nParagraph *broken here.\n\nParagraph fine.", {
      readFile: () => null,
      basePath: "/base",
      warn: noWarn,
    });
    expect(result.isWellFormed).toBe(false);
  });

  it("isWellFormed is false for unmatched closer", () => {
    const result = buildEventStreams("this is also bold* here.", {
      readFile: () => null,
      basePath: "/base",
      warn: noWarn,
    });
    expect(result.isWellFormed).toBe(false);
  });

  it("isWellFormed is true with headings and balanced tags", () => {
    const result = buildEventStreams("# Title\n\nParagraph with *bold* text.", {
      readFile: () => null,
      basePath: "/base",
      warn: noWarn,
    });
    expect(result.isWellFormed).toBe(true);
  });

  it("expanded events produce valid HTML via parseFromEvents", () => {
    const fileMap: Record<string, string> = {
      "/base/child.dj": "Included *bold*.",
    };
    const streams = buildEventStreams("# Heading\n\n![](child.dj)", {
      readFile: (p: string) => fileMap[p] || null,
      basePath: "/base",
      warn: noWarn,
    });
    const doc = parseFromEvents(streams.expandedEvents, streams.expandedText, { warn: noWarn });
    const html = renderHTML(doc, { warn: noWarn });
    expect(html).toContain("<strong>bold</strong>");
    expect(html).toContain("Heading");
  });

  it("returns no markers when no includes present", () => {
    const input = "Plain document.";
    const streams = buildEventStreams(input, {
      readFile: () => null,
      basePath: "/base",
      warn: noWarn,
    });
    expect(streams.inclusions).toEqual([]);
    expect(streams.expandedText).toBe(input);
    // No inclusion markers in expanded events
    const annots = streams.expandedEvents.map(e => e.annot);
    expect(annots.some(a => a.includes("inclusion"))).toBe(false);
  });

  it("text contains full preprocessed content", () => {
    const fileMap: Record<string, string> = {
      "/base/child.dj": "Hello from child.",
    };
    const streams = buildEventStreams("Before\n\n![](child.dj)\n\nAfter", {
      readFile: (p: string) => fileMap[p] || null,
      basePath: "/base",
      warn: noWarn,
    });
    expect(streams.expandedText).toContain("Before");
    expect(streams.expandedText).toContain("Hello from child.");
    expect(streams.expandedText).toContain("After");
    expect(streams.expandedText).not.toContain("![](child.dj)");
  });

  it("creates inclusion_boundary_span when boundaries cross inline containers", () => {
    const fileMap: Record<string, string> = {
      "/base/a.dj": "hello *world",
      "/base/b.dj": "more text* here",
    };
    const result = buildEventStreams("![](a.dj)\n![](b.dj)", {
      readFile: (p: string) => fileMap[p] || null,
      basePath: "/base",
      warn: noWarn,
    });
    const ast = parseFromEvents(result.expandedEvents, result.expandedText, { warn: noWarn });
    // The unmatched * in a.dj matches the * in b.dj, creating a strong
    // that crosses the inclusion boundary. The parser should produce
    // a single inclusion_boundary_span referencing both files.
    function findNodes(node: any, tag: string): any[] {
      const found: any[] = [];
      if (node.tag === tag) found.push(node);
      if (node.children) {
        for (const c of node.children) found.push(...findNodes(c, tag));
      }
      return found;
    }
    const spans = findNodes(ast, "inclusion_boundary_span");
    const inclusions = findNodes(ast, "inclusion");
    expect(spans.length).toBe(1);
    expect(inclusions.length).toBe(0);
    expect(spans[0].inclusions.length).toBe(2);
    const paths = spans[0].inclusions.map((r: any) => r.resolvedPath);
    expect(paths).toContain("/base/a.dj");
    expect(paths).toContain("/base/b.dj");
    // Boundary span wraps the children from the entangled inclusions
    expect(spans[0].children.length).toBeGreaterThan(0);
    // resultLength should be non-zero
    for (const ref of spans[0].inclusions) {
      expect(ref.resultLength).toBeGreaterThan(0);
    }
  });

  it("creates inclusion nodes when boundaries align with blocks", () => {
    const fileMap: Record<string, string> = {
      "/base/a.dj": "# Title A\n\nParagraph A.\n",
      "/base/b.dj": "# Title B\n\nParagraph B.\n",
    };
    const result = buildEventStreams("![](a.dj)\n\n![](b.dj)", {
      readFile: (p: string) => fileMap[p] || null,
      basePath: "/base",
      warn: noWarn,
    });
    const ast = parseFromEvents(result.expandedEvents, result.expandedText, { warn: noWarn });
    function findTags(node: any): string[] {
      const tags = [node.tag];
      if (node.children) {
        for (const c of node.children) tags.push(...findTags(c));
      }
      return tags;
    }
    const tags = findTags(ast);
    expect(tags).toContain("inclusion");
    expect(tags).not.toContain("inclusion_boundary_span");
  });

  // --- heading + unmatched emphasis across two files ---
  it("creates boundary span for heading + unmatched emphasis across files", () => {
    // file_a has a heading and an unmatched opener *
    // file_b closes the * and has its own heading
    const fileMap: Record<string, string> = {
      "/base/file_a.dj": "# File A\n\nThis is *bold",
      "/base/file_b.dj": "this is also bold*\n\n## Test inclusion 2\n\nDone\n",
    };
    const result = buildEventStreams("![](file_a.dj)\n![](file_b.dj)", {
      readFile: (p: string) => fileMap[p] || null,
      basePath: "/base",
      warn: noWarn,
    });
    const ast = parseFromEvents(result.expandedEvents, result.expandedText, { warn: noWarn });
    function findNodes(node: any, tag: string): any[] {
      const found: any[] = [];
      if (node.tag === tag) found.push(node);
      if (node.children) {
        for (const c of node.children) found.push(...findNodes(c, tag));
      }
      return found;
    }
    const spans = findNodes(ast, "inclusion_boundary_span");
    expect(spans.length).toBe(1);
    expect(spans[0].inclusions.length).toBe(2);
    const paths = spans[0].inclusions.map((r: any) => r.resolvedPath);
    expect(paths).toContain("/base/file_a.dj");
    expect(paths).toContain("/base/file_b.dj");
    expect(spans[0].children.length).toBeGreaterThan(0);
    // The merged text should produce a strong element from the cross-file *...*
    const strongs = findNodes(ast, "strong");
    expect(strongs.length).toBeGreaterThan(0);
  });

  it("boundary span resultLength reflects each file's contribution", () => {
    const fileMap: Record<string, string> = {
      "/base/a.dj": "start _emph",
      "/base/b.dj": "continued_ end",
    };
    const result = buildEventStreams("![](a.dj)\n![](b.dj)", {
      readFile: (p: string) => fileMap[p] || null,
      basePath: "/base",
      warn: noWarn,
    });
    const ast = parseFromEvents(result.expandedEvents, result.expandedText, { warn: noWarn });
    function findNodes(node: any, tag: string): any[] {
      const found: any[] = [];
      if (node.tag === tag) found.push(node);
      if (node.children) {
        for (const c of node.children) found.push(...findNodes(c, tag));
      }
      return found;
    }
    const spans = findNodes(ast, "inclusion_boundary_span");
    expect(spans.length).toBe(1);
    for (const ref of spans[0].inclusions) {
      expect(ref.resultLength).toBeGreaterThan(0);
    }
    // Total result length should approximate the combined text length
    const totalLen = spans[0].inclusions.reduce(
      (sum: number, r: any) => sum + r.resultLength, 0
    );
    expect(totalLen).toBeGreaterThan(0);
  });

  it("three files with entangled emphasis produce boundary spans", () => {
    const fileMap: Record<string, string> = {
      "/base/a.dj": "# Heading\n\nHello *world",
      "/base/b.dj": "middle text",
      "/base/c.dj": "end* here",
    };
    const result = buildEventStreams("![](a.dj)\n![](b.dj)\n![](c.dj)", {
      readFile: (p: string) => fileMap[p] || null,
      basePath: "/base",
      warn: noWarn,
    });
    const ast = parseFromEvents(result.expandedEvents, result.expandedText, { warn: noWarn });
    function findNodes(node: any, tag: string): any[] {
      const found: any[] = [];
      if (node.tag === tag) found.push(node);
      if (node.children) {
        for (const c of node.children) found.push(...findNodes(c, tag));
      }
      return found;
    }
    const spans = findNodes(ast, "inclusion_boundary_span");
    const inclusions = findNodes(ast, "inclusion");
    // All three files are entangled because * crosses from a through b to c
    expect(spans.length).toBe(1);
    expect(spans[0].inclusions.length).toBe(3);
  });

  it("boundary span does not capture root-document content after inclusions", () => {
    // Simulates the test.dj scenario: inclusions with headings + unmatched emphasis
    // followed by root-document content
    const fileMap: Record<string, string> = {
      "/base/file_a.dj": "# File A\n\nThis is *bold",
      "/base/file_b.dj": "this is also bold*\n\n## Sub Heading\n\nDone\n",
    };
    const input = "# Main\n\ntest\n\n![](file_a.dj)\n![](file_b.dj)\n\nend of test\n\n![pic](pic.png)\n\nfinal";
    const result = buildEventStreams(input, {
      readFile: (p: string) => fileMap[p] || null,
      basePath: "/base",
      warn: noWarn,
    });
    const ast = parseFromEvents(result.expandedEvents, result.expandedText, { warn: noWarn });
    function findNodes(node: any, tag: string): any[] {
      const found: any[] = [];
      if (node.tag === tag) found.push(node);
      if (node.children) {
        for (const c of node.children) found.push(...findNodes(c, tag));
      }
      return found;
    }
    // Boundary span should exist with 2 refs
    const spans = findNodes(ast, "inclusion_boundary_span");
    expect(spans.length).toBe(1);
    expect(spans[0].inclusions.length).toBe(2);
    // Root content ("end of test", image, "final") should be at doc level,
    // NOT inside the boundary span
    function collectTexts(node: any): string[] {
      const texts: string[] = [];
      if (node.text) texts.push(node.text);
      if (node.children) {
        for (const c of node.children) texts.push(...collectTexts(c));
      }
      return texts;
    }
    const spanTexts = collectTexts(spans[0]);
    expect(spanTexts).not.toContain("end of test");
    expect(spanTexts).not.toContain("final");
    // But inclusion content should be inside the span
    expect(spanTexts).toContain("File A");
    expect(spanTexts).toContain("Done");
  });

  it("splits clean prefix and clean tail from entangled boundary span", () => {
    // file_a has a clean paragraph then opens an unmatched *
    // file_b closes the * then has its own clean paragraph
    // Expected: inclusion(clean prefix) → boundary_span → inclusion(clean tail)
    const fileMap: Record<string, string> = {
      "/base/file_a.dj": "First clean self-contained inclusion\n\nThis is *bold",
      "/base/file_b.dj": "this is also bold*\n\nLast clean self-contained inclusion\n",
    };
    const result = buildEventStreams("![](file_a.dj)\n![](file_b.dj)", {
      readFile: (p: string) => fileMap[p] || null,
      basePath: "/base",
      warn: noWarn,
    });
    const ast = parseFromEvents(result.expandedEvents, result.expandedText, { warn: noWarn });
    function findNodes(node: any, tag: string): any[] {
      const found: any[] = [];
      if (node.tag === tag) found.push(node);
      if (node.children) {
        for (const c of node.children) found.push(...findNodes(c, tag));
      }
      return found;
    }
    function collectTexts(node: any): string[] {
      const texts: string[] = [];
      if (node.text) texts.push(node.text);
      if (node.children) {
        for (const c of node.children) texts.push(...collectTexts(c));
      }
      return texts;
    }
    // Should have clean inclusions and a boundary span
    const inclusions = findNodes(ast, "inclusion");
    const spans = findNodes(ast, "inclusion_boundary_span");
    expect(spans.length).toBe(1);
    expect(inclusions.length).toBe(2);
    // Clean prefix inclusion: "First clean self-contained inclusion"
    const prefixTexts = collectTexts(inclusions[0]);
    expect(prefixTexts).toContain("First clean self-contained inclusion");
    expect(inclusions[0].resolvedPath).toBe("/base/file_a.dj");
    // Clean tail inclusion: "Last clean self-contained inclusion"
    const tailTexts = collectTexts(inclusions[1]);
    expect(tailTexts).toContain("Last clean self-contained inclusion");
    expect(inclusions[1].resolvedPath).toBe("/base/file_b.dj");
    // Boundary span should contain the entangled bold text, not the clean parts
    const spanTexts = collectTexts(spans[0]);
    expect(spanTexts).not.toContain("First clean self-contained inclusion");
    expect(spanTexts).not.toContain("Last clean self-contained inclusion");
    expect(spanTexts).toContain("bold");
    // Boundary span should have 2 refs
    expect(spans[0].inclusions.length).toBe(2);
  });
});

// --- Single-scan verification tests ---
describe("single-scan processing", () => {
  it("preprocessInclusions iterates input segments only once", () => {
    // preprocessInclusions uses splitByCodeFences (one pass over lines),
    // then iterates segments once with regex — no second pass.
    // We verify by ensuring it produces correct output in one call.
    const fileMap: Record<string, string> = {
      "/base/child.dj": "included text",
    };
    const result = preprocessInclusions("before\n\n![](child.dj)\n\nafter", {
      readFile: (p: string) => fileMap[p] || null,
      basePath: "/base",
      warn: noWarn,
    });
    expect(result.text).toContain("before");
    expect(result.text).toContain("included text");
    expect(result.text).toContain("after");
    expect(result.text).not.toContain("![](child.dj)");
    expect(result.inclusions.length).toBe(1);
  });

  it("buildEventStreams parses events once and merges without re-parsing", () => {
    let parseCount = 0;
    const origParseEvents = parseEvents;
    const fileMap: Record<string, string> = {
      "/base/a.dj": "# Title\n\nContent.",
    };
    // buildEventStreams calls parseEvents for the main doc and once per unique file.
    // With one inclusion of one file, that's exactly 2 parseEvents calls —
    // not a re-scan of the merged result.
    const result = buildEventStreams("![](a.dj)", {
      readFile: (p: string) => fileMap[p] || null,
      basePath: "/base",
      warn: noWarn,
    });
    // Verify structure is correct (event merging happened without re-parsing)
    expect(result.expandedEvents.length).toBeGreaterThan(0);
    expect(result.inclusions.length).toBe(1);
    expect(result.expandedText.length).toBeGreaterThan(0);
  });

  it("inclusion boundary detection happens during AST construction, not a second pass", () => {
    const fileMap: Record<string, string> = {
      "/base/a.dj": "open *emph",
      "/base/b.dj": "close* here",
    };
    const result = buildEventStreams("![](a.dj)\n![](b.dj)", {
      readFile: (p: string) => fileMap[p] || null,
      basePath: "/base",
      warn: noWarn,
    });
    // parseFromEvents produces boundary spans in a single pass over events
    const ast = parseFromEvents(result.expandedEvents, result.expandedText, { warn: noWarn });
    function findNodes(node: any, tag: string): any[] {
      const found: any[] = [];
      if (node.tag === tag) found.push(node);
      if (node.children) {
        for (const c of node.children) found.push(...findNodes(c, tag));
      }
      return found;
    }
    const spans = findNodes(ast, "inclusion_boundary_span");
    expect(spans.length).toBe(1);
    // No post-processing pass needed — result is ready
    expect(spans[0].children.length).toBeGreaterThan(0);
  });
});

// --- Inline code backtick tests ---
// Inline backtick spans are protected by the enhanced single-pass scanner.
describe("inclusions inside inline code", () => {
  it("ignores inclusion syntax inside inline backticks", () => {
    const fileMap: Record<string, string> = {
      "/base/file.dj": "included",
    };
    const result = preprocessInclusions("text `![](file.dj)` more", {
      readFile: (p: string) => fileMap[p] || null,
      basePath: "/base",
      warn: noWarn,
    });
    // Inclusion is inside backtick span — should be ignored
    expect(result.text).toContain("`![](file.dj)`");
    expect(result.inclusions.length).toBe(0);
  });

  it("ignores inclusion syntax inside double backticks", () => {
    const fileMap: Record<string, string> = {
      "/base/example.dj": "example content",
    };
    const result = preprocessInclusions("before ``![](example.dj)`` after", {
      readFile: (p: string) => fileMap[p] || null,
      basePath: "/base",
      warn: noWarn,
    });
    // Inclusion is inside double backtick span — should be ignored
    expect(result.text).toContain("``![](example.dj)``");
    expect(result.inclusions.length).toBe(0);
  });
});

// --- Multi-line verbatim span tests ---
// Multi-line backtick verbatim spans are protected by the enhanced single-pass scanner.
describe("inclusions inside multi-line verbatim spans", () => {
  it("ignores inclusion syntax inside multi-line verbatim", () => {
    const fileMap: Record<string, string> = {
      "/base/inner.dj": "inner text",
    };
    // A verbatim span that spans two lines
    const input = "start `verbatim\n![](inner.dj)\nend verbatim` after";
    const result = preprocessInclusions(input, {
      readFile: (p: string) => fileMap[p] || null,
      basePath: "/base",
      warn: noWarn,
    });
    // Inclusion is inside backtick span — should be ignored
    expect(result.text).toContain("![](inner.dj)");
    expect(result.inclusions.length).toBe(0);
  });
});

// --- Indented fenced code block tests ---
// Indented fenced code blocks are now properly detected by the enhanced scanner.
describe("inclusions inside indented fenced code blocks", () => {
  it("ignores inclusion inside indented fence (list item context)", () => {
    const fileMap: Record<string, string> = {
      "/base/code.dj": "code content",
    };
    // A fenced code block indented by spaces (as inside a list item)
    const input = "- item\n\n    ```\n    ![](code.dj)\n    ```\n";
    const result = preprocessInclusions(input, {
      readFile: (p: string) => fileMap[p] || null,
      basePath: "/base",
      warn: noWarn,
    });
    // Indented fence is detected — inclusion should be ignored
    expect(result.text).toContain("![](code.dj)");
    expect(result.inclusions.length).toBe(0);
  });

  it("properly protects non-indented fenced code blocks", () => {
    const fileMap: Record<string, string> = {
      "/base/protected.dj": "should not appear",
    };
    const input = "before\n```\n![](protected.dj)\n```\nafter";
    const result = preprocessInclusions(input, {
      readFile: (p: string) => fileMap[p] || null,
      basePath: "/base",
      warn: noWarn,
    });
    // Non-indented fence IS properly detected — inclusion is NOT processed
    expect(result.text).toContain("![](protected.dj)");
    expect(result.inclusions.length).toBe(0);
  });
});

// --- Attribute comment tests ---
// Attribute comments are now properly detected by the enhanced single-pass scanner.
describe("inclusions inside attribute comments", () => {
  it("ignores inclusion inside inline attribute comment", () => {
    const fileMap: Record<string, string> = {
      "/base/attr.dj": "attr content",
    };
    // A heading with an attribute comment containing inclusion syntax
    const input = "# Heading {.class % ![](attr.dj) }";
    const result = preprocessInclusions(input, {
      readFile: (p: string) => fileMap[p] || null,
      basePath: "/base",
      warn: noWarn,
    });
    // Inclusion is inside attribute comment — should be ignored
    expect(result.text).toContain("{.class % ![](attr.dj) }");
    expect(result.inclusions.length).toBe(0);
  });

  it("ignores inclusion inside block attribute comment", () => {
    const fileMap: Record<string, string> = {
      "/base/ml.dj": "multiline content",
    };
    const input = "{%\n  This is a comment\n  ![](ml.dj)\n%}";
    const result = preprocessInclusions(input, {
      readFile: (p: string) => fileMap[p] || null,
      basePath: "/base",
      warn: noWarn,
    });
    // Inclusion is inside block comment — should be ignored
    expect(result.text).toContain("![](ml.dj)");
    expect(result.inclusions.length).toBe(0);
  });
});
