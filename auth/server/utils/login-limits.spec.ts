import { describe, expect, it } from "vitest";
import { createFailureCounter } from "./login-limits";

describe("createFailureCounter", () => {
  it("blocks a key at `max` failures within the window, and only that key", () => {
    const counter = createFailureCounter({ max: 3, windowMs: 1000 });
    expect([counter.fail("a", 0), counter.fail("a", 10), counter.blocked("a", 20)]).toEqual([1, 2, false]);
    expect(counter.fail("a", 30)).toBe(3);
    expect(counter.blocked("a", 40)).toBe(true);
    expect(counter.blocked("b", 40)).toBe(false);
  });

  it("forgets failures once the window has passed, or on reset", () => {
    const counter = createFailureCounter({ max: 2, windowMs: 1000 });
    counter.fail("a", 0);
    counter.fail("a", 1);
    expect(counter.blocked("a", 999)).toBe(true);
    expect(counter.blocked("a", 1000)).toBe(false);
    expect(counter.fail("a", 1000)).toBe(1);
    counter.fail("a", 1001);
    counter.reset("a");
    expect(counter.blocked("a", 1002)).toBe(false);
  });
});
