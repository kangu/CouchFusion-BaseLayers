import { describe, expect, it } from "vitest";

import { buildCouchEnvSection, resolveRuntimeAppSlug } from "./couch-config";

describe("resolveRuntimeAppSlug", () => {
  it("prefers runtimeConfig.public.appSlug when present", () => {
    expect(
      resolveRuntimeAppSlug({
        public: {
          appSlug: "bitvocation",
        },
      }),
    ).toBe("bitvocation");
  });

  it("falls back to the normalized cwd/app folder name", () => {
    expect(resolveRuntimeAppSlug({}, "Bitvocation")).toBe("bitvocation");
  });

  it("builds the expected couch env section name", () => {
    expect(buildCouchEnvSection("bitvocation")).toBe("cf_env_bitvocation");
  });
});
