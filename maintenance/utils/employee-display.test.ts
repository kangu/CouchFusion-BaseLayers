import { describe, expect, test } from "bun:test";
import { getEmployeeDisplayLabel, readEmployeeFullName } from "./employee-display";

describe("employee display helpers", () => {
  test("reads full name from profile.full_name", () => {
    expect(
      readEmployeeFullName({
        profile: {
          full_name: "Ada Lovelace",
        },
      }),
    ).toBe("Ada Lovelace");
  });

  test("falls back to profile.fullName and top-level full_name", () => {
    expect(
      readEmployeeFullName({
        profile: {
          fullName: "Grace Hopper",
        },
      }),
    ).toBe("Grace Hopper");

    expect(
      readEmployeeFullName({
        full_name: "Katherine Johnson",
      }),
    ).toBe("Katherine Johnson");
  });

  test("uses fallback username when no full name exists", () => {
    expect(
      getEmployeeDisplayLabel(
        {
          name: "gas-worker-1",
        },
        "worker-1",
      ),
    ).toBe("worker-1");
  });
});
