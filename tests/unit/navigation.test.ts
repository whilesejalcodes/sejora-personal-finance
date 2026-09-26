import { describe, expect, it } from "vitest";
import { getNavigationContext } from "../../client/src/components/layout/navigation";

describe("navigation breadcrumb context", () => {
  it.each([
    ["/dashboard", "Workspace", "Overview"],
    ["/transactions", "Workspace", "Transactions"],
    ["/budgets", "Workspace", "Budgets"],
    ["/analytics", "Workspace", "Analytics"],
    ["/goals", "Workspace", "Goals"],
    ["/cash-flow", "Workspace", "Upcoming cash flow"],
    ["/forecast", "Intelligence", "Forecast"],
    ["/recurring-payments", "Intelligence", "Recurring payments"],
    ["/receipts", "Intelligence", "Receipt scanner"],
    ["/insights", "Intelligence", "Insights"],
    ["/ai-finance", "Intelligence", "AI Finance"],
    ["/settings", "Workspace", "Settings"],
  ])("maps %s to %s / %s", (pathname, group, label) => {
    expect(getNavigationContext(pathname)).toEqual({ group, label });
  });

  it("falls back to overview for an unknown path", () => {
    expect(getNavigationContext("/unknown")).toEqual({ group: "Workspace", label: "Overview" });
  });
});