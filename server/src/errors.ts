import { ZodError } from "zod";
import { MulterError } from "multer";
import { ReceiptExtractionError, ReceiptProviderError } from "./receipts/receipt-service.js";
import { BudgetRepositoryError } from "./budgets/budget-repository.js";
import { GoalRepositoryError } from "./goals/goal-repository.js";
import { InvalidTransactionCursorError, TransactionRepositoryError } from "./transactions/transaction-repository.js";
import { AiInsightsExtractionError, AiInsightsProviderError } from "./ai-insights/ai-insights-service.js";
import { AiFinanceExtractionError, AiFinanceProviderError } from "./ai-finance/ai-finance-service.js";

export type ApiErrorCode =
  | "AUTHENTICATION_REQUIRED"
  | "AUTHENTICATION_UNAVAILABLE"
  | "EMAIL_VERIFICATION_REQUIRED"
  | "VALIDATION_ERROR"
  | "REQUEST_TOO_LARGE"
  | "RATE_LIMITED"
  | "RESOURCE_NOT_FOUND"
  | "FIRESTORE_ERROR"
  | "INTERNAL_ERROR";

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: ApiErrorCode,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export class ResourceNotFoundError extends Error {
  constructor(resource = "Transaction") {
    super(`${resource} not found.`);
    this.name = "ResourceNotFoundError";
  }
}

export function validationError(error: ZodError): ApiError {
  return new ApiError(
    400,
    "VALIDATION_ERROR",
    "The transaction request is invalid.",
    error.issues.map(({ path, message }) => ({ path, message })),
  );
}

export class ReceiptUploadError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ReceiptUploadError";
  }
}

export function errorHandler(error: unknown, _request: unknown, response: import("express").Response, _next: import("express").NextFunction) {
  if (error instanceof ApiError) {
    response.status(error.status).json({
      error: {
        code: error.code,
        message: error.message,
        ...(error.details ? { details: error.details } : {}),
      },
    });
    return;
  }

  if (error instanceof ZodError) {
    response.status(400).json({
      error: {
        code: "VALIDATION_ERROR",
        message: "The request is invalid.",
        details: error.issues.map(({ path, message }) => ({ path, message })),
      },
    });
    return;
  }

  if (error instanceof ResourceNotFoundError) {
    response.status(404).json({ error: { code: "RESOURCE_NOT_FOUND", message: error.message } });
    return;
  }

  if (error instanceof InvalidTransactionCursorError) {
    response.status(400).json({ error: { code: "VALIDATION_ERROR", message: error.message } });
    return;
  }

  if (error instanceof MulterError) {
    response.status(400).json({
      error: {
        code: "RECEIPT_UPLOAD_INVALID",
        message: error.code === "LIMIT_FILE_SIZE" ? "Receipt images must be 5 MB or smaller." : "The receipt upload is invalid.",
      },
    });
    return;
  }

  if (error instanceof SyntaxError && (error as SyntaxError & { type?: string; status?: number }).type === "entity.parse.failed") {
    response.status(400).json({ error: { code: "VALIDATION_ERROR", message: "The request body contains invalid JSON." } });
    return;
  }

  if ((error as { type?: string; status?: number } | null)?.type === "entity.too.large") {
    response.status(413).json({ error: { code: "REQUEST_TOO_LARGE", message: "The request body is too large." } });
    return;
  }

  if (error instanceof ReceiptUploadError) {
    response.status(400).json({ error: { code: "RECEIPT_UPLOAD_INVALID", message: error.message } });
    return;
  }

  if (error instanceof ReceiptExtractionError) {
    response.status(502).json({ error: { code: "RECEIPT_EXTRACTION_INVALID", message: "The receipt could not be understood. Try a clearer image." } });
    return;
  }

  if (error instanceof ReceiptProviderError) {
    response.status(503).json({ error: { code: "RECEIPT_PROVIDER_ERROR", message: error.message } });
    return;
  }

  if (error instanceof AiInsightsExtractionError) {
    response.status(502).json({ error: { code: "AI_INSIGHTS_EXTRACTION_INVALID", message: "The generated insights could not be validated. Please try again." } });
    return;
  }

  if (error instanceof AiInsightsProviderError) {
    response.status(503).json({ error: { code: "AI_INSIGHTS_PROVIDER_ERROR", message: error.message } });
    return;
  }

  if (error instanceof AiFinanceExtractionError) {
    response.status(502).json({ error: { code: "AI_FINANCE_EXTRACTION_INVALID", message: "The question could not be interpreted safely. Try rephrasing it." } });
    return;
  }

  if (error instanceof AiFinanceProviderError) {
    response.status(503).json({ error: { code: "AI_FINANCE_PROVIDER_ERROR", message: error.message } });
    return;
  }

  if (error instanceof TransactionRepositoryError) {
    console.error("Firestore transaction operation failed.");
    response.status(503).json({ error: { code: "FIRESTORE_ERROR", message: "Transaction data is temporarily unavailable." } });
    return;
  }

  if (error instanceof BudgetRepositoryError) {
    console.error("Firestore budget operation failed.");
    response.status(503).json({ error: { code: "FIRESTORE_ERROR", message: "Budget data is temporarily unavailable." } });
    return;
  }

  if (error instanceof GoalRepositoryError) {
    console.error("Firestore goal operation failed.");
    response.status(503).json({ error: { code: "FIRESTORE_ERROR", message: "Goal data is temporarily unavailable." } });
    return;
  }

  console.error("Unhandled API error.");
  response.status(500).json({ error: { code: "INTERNAL_ERROR", message: "The request could not be completed." } });
}