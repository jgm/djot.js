import { pattern, find, boundedFind } from "./find.js";

describe("find", () => {
  it("finds a pattern at 0", () => {
    let m1 = find("hello there", pattern("^(he)\\w+"), 0);
    expect(m1).not.toBeNull;
    if (m1 !== null) {
      expect(m1.startpos).toBe(0);
      expect(m1.endpos).toBe(4);
      expect(m1.captures).toStrictEqual(["he"]);
    }
  });
  it("doesn't find a pattern at 1", () => {
    let m2 = find("hello there", pattern("^(he)\\w+"), 1);
    expect(m2).toBeNull;
  });
});

describe("boundedFind", () => {
  it("finds a pattern at 0", () => {
    let m1 = boundedFind("hello there", pattern("^(he)\\w+"), 0, 5);
    expect(m1).not.toBeNull;
    if (m1 !== null) {
      expect(m1.startpos).toBe(0);
      expect(m1.endpos).toBe(4);
      expect(m1.captures).toStrictEqual(["he"]);
    }
  });
  it("doesn't find a pattern that ends after the bound", () => {
    let m2 = boundedFind("hello there", pattern("^hello"), 0, 3);
    expect(m2).toBeNull;
  });
})
