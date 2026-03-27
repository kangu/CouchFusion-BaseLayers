import { beforeEach, describe, expect, it, vi } from "vitest";

const readCouchConfigValuesMock = vi.fn();

vi.mock("#database/utils/couch-config", () => {
  return {
    buildCouchEnvSection: (slug: string) => `cf_env_${slug}`,
    readCouchConfigValues: (...args: unknown[]) => readCouchConfigValuesMock(...args),
  };
});

describe("readMaintenanceEnvConfig", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal("useRuntimeConfig", () => ({
      public: {
        appSlug: "gas-maintenance",
      },
    }));
  });

  it("reads company identity fields from couch config", async () => {
    readCouchConfigValuesMock.mockResolvedValueOnce({
      maintenance_company_name: "GasOps SRL",
      maintenance_company_address: "Str. Energiei 12, Cluj-Napoca",
    });

    const { readMaintenanceEnvConfig } = await import("./config");
    const config = await readMaintenanceEnvConfig();

    expect(config.companyName).toBe("GasOps SRL");
    expect(config.companyAddress).toBe("Str. Energiei 12, Cluj-Napoca");
  });
});
