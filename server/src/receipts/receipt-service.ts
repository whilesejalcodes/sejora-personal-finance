import { GoogleGenerativeAI } from "@google/generative-ai";
import { receiptModelResponseSchema } from "../../../shared/schemas/index.js";
import type { ReceiptExtraction, ReceiptLineItem, ReceiptScanData } from "../../../shared/types/index.js";

export const MAX_RECEIPT_BYTES = 5 * 1024 * 1024;
export const SUPPORTED_RECEIPT_MIME_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;

const GEMINI_MODEL = "gemini-3.6-flash";
const GEMINI_TIMEOUT_MS = 70_000;

const RECEIPT_PROMPT = `You extract data from one receipt image for a personal finance app.
Return JSON only, with exactly these fields:
{
  "merchant": string|null,
  "date": "YYYY-MM-DD"|null,
  "totalAmount": number|string|null,
  "currency": string|null,
  "transactionType": "income"|"expense"|null,
  "category": string|null,
  "paymentMethod": string|null,
  "lineItems": [
    {"description": string, "quantity": number|string|null, "unitPrice": number|string|null, "total": number|string|null}
  ]
}

Use null when the receipt does not clearly provide a value. Do not guess, infer a date from the upload date, invent a merchant, or calculate account-level financial values. The totalAmount and line-item money values must be in rupees as printed, without a currency symbol. Use INR only when the receipt clearly uses Indian rupees. If the receipt is unreadable or not a receipt, return null fields and an empty lineItems array.`;

export class ReceiptProviderError extends Error {
  constructor(message = "Receipt scanning is temporarily unavailable.", options?: ErrorOptions) {
    super(message, options);
    this.name = "ReceiptProviderError";
  }
}

export class ReceiptExtractionError extends Error {
  constructor(message = "The receipt response could not be validated.", options?: ErrorOptions) {
    super(message, options);
    this.name = "ReceiptExtractionError";
  }
}

export interface ReceiptExtractor {
  extract(image: Buffer, mimeType: string): Promise<ReceiptScanData>;
}

function validDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day)).toISOString().slice(0, 10) === value;
}

function parseMoneyToMinor(value: unknown): number | null {
  if (typeof value !== "number" && typeof value !== "string") return null;
  const text = String(value).trim().replace(/^(?:₹|INR)\s*/i, "").replace(/,/g, "");
  if (!/^\d+(?:\.\d{1,2})?$/.test(text)) return null;
  const [whole, fraction = ""] = text.split(".");
  const minor = Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
  return Number.isSafeInteger(minor) && minor > 0 && minor <= 9_999_999_999 ? minor : null;
}

function parseNullableNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const number = typeof value === "number" ? value : Number(String(value).replace(/,/g, "").trim());
  return Number.isFinite(number) && number >= 0 && number <= 1_000_000 ? number : null;
}

function cleanText(value: string | null | undefined): string | null {
  const text = value?.trim();
  return text ? text : null;
}

export function normalizeReceiptResponse(input: unknown): ReceiptScanData {
  const parsed = receiptModelResponseSchema.safeParse(input);
  if (!parsed.success) throw new ReceiptExtractionError();
  const raw = parsed.data;
  const merchant = cleanText(raw.merchant);
  const occurredAt = raw.date && validDate(raw.date) ? raw.date : null;
  const amountMinor = parseMoneyToMinor(raw.totalAmount);
  const currency = raw.currency?.trim().toUpperCase() === "INR" ? "INR" : null;
  const type = raw.transactionType ?? null;
  const category = cleanText(raw.category);
  const paymentMethod = cleanText(raw.paymentMethod);
  const lineItems: ReceiptLineItem[] = (raw.lineItems ?? []).map((item) => ({
    description: item.description.trim(),
    quantity: parseNullableNumber(item.quantity),
    unitPriceMinor: parseMoneyToMinor(item.unitPrice),
    totalMinor: parseMoneyToMinor(item.total),
  }));
  const needsReview: ReceiptExtraction["needsReview"] = [];
  if (!merchant) needsReview.push("merchant");
  if (!occurredAt) needsReview.push("occurredAt");
  if (!amountMinor) needsReview.push("amountMinor");
  if (!type) needsReview.push("type");
  if (type === "expense" && !category) needsReview.push("category");
  if (currency !== "INR") needsReview.push("currency");

  return {
    extraction: { merchant, occurredAt, amountMinor, currency, type, category, paymentMethod, lineItems, needsReview },
    reviewMessage: "Receipt details were extracted automatically. Review and correct every field before saving.",
  };
}

function stripCodeFence(text: string): string {
  return text.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
}

function providerErrorDetails(error: unknown): { name: string; status?: number } {
  if (error instanceof Error) {
    const providerError = error as Error & { status?: number };
    return { name: providerError.name, status: providerError.status };
  }
  return { name: "UnknownError" };
}

function withTimeout<T>(promise: Promise<T>, onTimeout: () => void): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timeout = setTimeout(() => {
      onTimeout();
      reject(new ReceiptProviderError("Receipt scanning timed out. Please try again."));
    }, GEMINI_TIMEOUT_MS);
    promise.then((value) => {
      clearTimeout(timeout);
      resolve(value);
    }).catch((error) => {
      clearTimeout(timeout);
      reject(error);
    });
  });
}

export class GeminiReceiptExtractor implements ReceiptExtractor {
  async extract(image: Buffer, mimeType: string): Promise<ReceiptScanData> {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new ReceiptProviderError("Receipt scanning is not configured.");
    try {
      const client = new GoogleGenerativeAI(apiKey);
      const model = client.getGenerativeModel({
        model: GEMINI_MODEL,
        generationConfig: { responseMimeType: "application/json", temperature: 0 },
      });
      const startedAt = Date.now();
      console.info(`[receipt-scan] Gemini request started imageBytes=${image.length} mimeType=${mimeType}`);
      const providerCall = model.generateContent([
        { text: RECEIPT_PROMPT },
        { inlineData: { data: image.toString("base64"), mimeType } },
      ]).then((result) => {
        console.info(`[receipt-scan] Gemini request completed elapsedMs=${Date.now() - startedAt}`);
        return result;
      }).catch((error: unknown) => {
        const details = providerErrorDetails(error);
        console.warn(`[receipt-scan] Gemini request failed elapsedMs=${Date.now() - startedAt} name=${details.name} status=${details.status ?? "unknown"}`);
        throw error;
      });
      const result = await withTimeout(providerCall, () => {
        console.warn(`[receipt-scan] Gemini request timed out elapsedMs=${Date.now() - startedAt} timeoutMs=${GEMINI_TIMEOUT_MS}`);
      });
      console.info(`[receipt-scan] Gemini response parsing started elapsedMs=${Date.now() - startedAt}`);
      const text = result.response.text();
      let json: unknown;
      try {
        json = JSON.parse(stripCodeFence(text));
      } catch (error) {
        throw new ReceiptExtractionError("The receipt response was not valid structured data.", { cause: error });
      }
      const normalized = normalizeReceiptResponse(json);
      console.info(`[receipt-scan] Gemini response parsing succeeded elapsedMs=${Date.now() - startedAt}`);
      return normalized;
    } catch (error) {
      if (error instanceof ReceiptExtractionError || error instanceof ReceiptProviderError) throw error;
      throw new ReceiptProviderError("Receipt scanning is temporarily unavailable.", { cause: error });
    }
  }
}