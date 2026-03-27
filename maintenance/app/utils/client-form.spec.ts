import { describe, expect, it } from "vitest";
import { normalizeGasSensorFormFields } from "./client-form";

describe("normalizeGasSensorFormFields", () => {
  it("clears gas sensor period when expiration date is blank", () => {
    expect(
      normalizeGasSensorFormFields({
        gasSensorExpirationDate: "",
        gasSensorPeriodMonths: "12",
      }),
    ).toEqual({
      gasSensorExpirationDate: null,
      gasSensorPeriodMonths: null,
    });
  });

  it("keeps gas sensor period when expiration date is present", () => {
    expect(
      normalizeGasSensorFormFields({
        gasSensorExpirationDate: "2026-04-12",
        gasSensorPeriodMonths: "12",
      }),
    ).toEqual({
      gasSensorExpirationDate: "2026-04-12",
      gasSensorPeriodMonths: 12,
    });
  });
});
