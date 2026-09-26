import { describe, expect, it } from "vitest";
import { getCategoryInputState } from "../../client/src/components/forms/category-input";
import { getPaymentMethodInputState } from "../../client/src/components/forms/payment-method-input";
import {
  COMMON_CATEGORIES,
  CUSTOM_CATEGORY_OPTION,
  MERCHANT_SUGGESTIONS,
  OTHER_PAYMENT_METHOD_OPTION,
  PAYMENT_METHODS,
} from "../../client/src/lib/finance-options";
import { isCategoryRequired, transactionCreateSchema, transactionUpdateSchema } from "../../shared/schemas/index.js";

describe("transaction and budget UX options", () => {
  it("shares the required category vocabulary", () => {
    expect(COMMON_CATEGORIES).toEqual([
      "Food",
      "Shopping",
      "Transport",
      "Housing",
      "Bills & Utilities",
      "Education",
      "Health",
      "Entertainment",
      "Travel",
      "Gifts",
      "Investments",
      "Other / Miscellaneous",
    ]);
  });

  it("preserves an existing custom category in the Custom input state", () => {
    expect(getCategoryInputState("Coffee club")).toEqual({
      selection: CUSTOM_CATEGORY_OPTION,
      customValue: "Coffee club",
    });
    expect(getCategoryInputState("Food")).toEqual({ selection: "Food", customValue: "" });
  });

  it("requires category for expenses while allowing uncategorized income", () => {
    const shared = {
      amountMinor: 12500,
      merchant: "Salary",
      occurredAt: "2026-09-01",
    };
    expect(transactionCreateSchema.safeParse({ ...shared, type: "expense" }).success).toBe(false);
    expect(transactionCreateSchema.safeParse({ ...shared, type: "income" }).success).toBe(true);
    expect(isCategoryRequired("expense")).toBe(true);
    expect(isCategoryRequired("income")).toBe(false);
  });

  it("removes category validation when switching Expense to Income", () => {
    const draft = {
      amountMinor: 12500,
      merchant: "Salary",
      occurredAt: "2026-09-01",
    };
    expect(transactionCreateSchema.safeParse({ ...draft, type: "expense" }).success).toBe(false);
    expect(transactionCreateSchema.safeParse({ ...draft, type: "income" }).success).toBe(true);
  });

  it("restores category validation when switching Income to Expense", () => {
    const draft = {
      amountMinor: 12500,
      merchant: "Salary",
      occurredAt: "2026-09-01",
    };
    expect(transactionCreateSchema.safeParse({ ...draft, type: "income" }).success).toBe(true);
    expect(transactionCreateSchema.safeParse({ ...draft, type: "expense" }).success).toBe(false);
    expect(transactionCreateSchema.safeParse({ ...draft, type: "expense", category: "Other" }).success).toBe(true);
  });

  it("keeps existing categorized transaction edits valid", () => {
    expect(transactionUpdateSchema.safeParse({ type: "income", category: "Salary" }).success).toBe(true);
  });

  it("keeps merchant suggestions optional and accepts arbitrary merchant text", () => {
    expect(MERCHANT_SUGGESTIONS).toContain("Swiggy");
    const result = transactionCreateSchema.safeParse({
      amountMinor: 12500,
      type: "expense",
      merchant: "My neighborhood repair shop",
      category: "Coffee club",
      occurredAt: "2026-09-01",
    });
    expect(result.success).toBe(true);
  });

  it("offers common payment methods while preserving an arbitrary existing value", () => {
    expect(PAYMENT_METHODS).toEqual(["UPI", "Bank", "Card", "Cash"]);
    expect(getPaymentMethodInputState("Net banking")).toEqual({
      selection: OTHER_PAYMENT_METHOD_OPTION,
      otherValue: "Net banking",
    });
    expect(getPaymentMethodInputState("UPI")).toEqual({ selection: "UPI", otherValue: "" });
  });
});