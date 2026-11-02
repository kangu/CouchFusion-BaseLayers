import { describe, expect, it } from "vitest";
import { createExclusionMatcher } from "./exclusions";
import { normalizePath } from "./hit";
import { DEFAULT_EXCLUDED_PATHS } from "./sites";

describe("default excluded paths", () => {
  const excluded = createExclusionMatcher(DEFAULT_EXCLUDED_PATHS);
  const isExcluded = (path: string) => excluded(normalizePath(path));

  it("leave out admin work: admin area, login and the content builder (/builder and its /k alias)", () => {
    for (const path of ["/admin", "/admin/analytics/events", "/login", "/builder", "/builder/despre", "/k", "/k/", "/k/test/head"]) {
      expect({ path, excluded: isExcluded(path) }).toEqual({ path, excluded: true });
    }
  });

  it("still count public pages, including ones that merely start with the same letters", () => {
    for (const path of ["/", "/kids", "/kangaroo/k", "/builders-guild", "/test/head", "/logins-explained"]) {
      expect({ path, excluded: isExcluded(path) }).toEqual({ path, excluded: false });
    }
  });
});
