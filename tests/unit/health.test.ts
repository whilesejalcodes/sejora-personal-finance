import { describe, expect, it } from "vitest";
import { getHealthPayload } from "../../server/src/health";
import { currencySymbol, formatCurrency } from "../../client/src/lib/currency";

describe("foundation health payload", () => {
  it("returns the stable service contract", () => {
    expect(getHealthPayload()).toEqual({
      status: "ok",
      service: "sejora-api",
      phase: "foundation",
    });
  });

  it("formats the initial INR display currency with Indian grouping", () => {
    expect(formatCurrency(45000)).toBe("₹45,000");
    expect(formatCurrency(5000)).toBe("₹5,000");
    expect(currencySymbol()).toBe("₹");
  });
});