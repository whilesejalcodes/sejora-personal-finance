import { describe, expect, it, vi } from "vitest";
import { GeminiReceiptExtractor, normalizeReceiptResponse, ReceiptExtractionError } from "../../server/src/receipts/receipt-service.js";

describe("receipt extraction normalization", () => {
  it("converts rupee values to integer paise and preserves review fields", () => {
    const result = normalizeReceiptResponse({
      merchant: "  Fresh Market ",
      date: "2026-09-10",
      totalAmount: "1,250.50",
      currency: "inr",
      transactionType: "expense",
      category: "Food",
      paymentMethod: "UPI",
      lineItems: [{ description: "Fruit", quantity: "2", unitPrice: "100", total: "200" }],
    });
    expect(result.extraction).toMatchObject({
      merchant: "Fresh Market",
      occurredAt: "2026-09-10",
      amountMinor: 125_050,
      currency: "INR",
      type: "expense",
      category: "Food",
      paymentMethod: "UPI",
      needsReview: [],
    });
    expect(result.extraction.lineItems[0]).toMatchObject({ quantity: 2, unitPriceMinor: 10_000, totalMinor: 20_000 });
  });

  it("does not invent missing data and marks it for review", () => {
    const result = normalizeReceiptResponse({ merchant: null, date: null, totalAmount: null, currency: null, transactionType: null, category: null, paymentMethod: null, lineItems: [] });
    expect(result.extraction).toMatchObject({
      merchant: null,
      occurredAt: null,
      amountMinor: null,
      currency: null,
      type: null,
      needsReview: ["merchant", "occurredAt", "amountMinor", "type", "currency"],
    });
  });

  it("rejects unexpected response shapes", () => {
    expect(() => normalizeReceiptResponse({ merchant: "Store", unexpected: true })).toThrow(ReceiptExtractionError);
    expect(() => normalizeReceiptResponse({ lineItems: [{ total: "1.00" }] })).toThrow(ReceiptExtractionError);
  });

  it("turns invalid dates and currencies into explicit review states", () => {
    const result = normalizeReceiptResponse({ merchant: "Store", date: "2026-02-31", totalAmount: 1, currency: "USD", transactionType: "expense", category: null, lineItems: [] });
    expect(result.extraction.occurredAt).toBeNull();
    expect(result.extraction.currency).toBeNull();
    expect(result.extraction.needsReview).toEqual(["occurredAt", "category", "currency"]);
  });

  it("fails safely when the Gemini secret is missing", async () => {
    vi.stubEnv("GEMINI_API_KEY", "");
    await expect(new GeminiReceiptExtractor().extract(Buffer.from([1, 2, 3]), "image/png")).rejects.toMatchObject({
      message: "Receipt scanning is not configured.",
    });
  });
});