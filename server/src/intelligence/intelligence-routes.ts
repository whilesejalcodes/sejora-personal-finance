import { Router, type RequestHandler } from "express";
import { insightsQuerySchema, recurringPaymentsQuerySchema } from "../../../shared/schemas/index.js";
import { shiftMonth } from "../../../shared/finance/calculations.js";
import { ApiError, validationError } from "../errors.js";
import type { TransactionRepository } from "../transactions/transaction-repository.js";
import { IntelligenceDataTooLargeError, IntelligenceService } from "./intelligence-service.js";

type IntelligenceRouterOptions = {
  authenticate: RequestHandler;
  transactionRepository: TransactionRepository;
};

function uidFrom(request: import("express").Request): string {
  if (!request.auth?.uid) throw new ApiError(401, "AUTHENTICATION_REQUIRED", "Authentication is required.");
  return request.auth.uid;
}

function parseOrThrow<T>(result: { success: true; data: T } | { success: false; error: import("zod").ZodError }): T {
  if (!result.success) throw validationError(result.error);
  return result.data;
}

function currentMonth(): string {
  return new Date().toISOString().slice(0, 7);
}

export function createIntelligenceRouter(options: IntelligenceRouterOptions): Router {
  const router = Router();
  const service = new IntelligenceService(options.transactionRepository);
  router.use(options.authenticate);

  router.get("/insights", async (request, response, next) => {
    try {
      const query = parseOrThrow(insightsQuerySchema.safeParse(request.query));
      response.json({ data: await service.insights(uidFrom(request), query.month ?? currentMonth()) });
    } catch (error) {
      next(error instanceof IntelligenceDataTooLargeError ? new ApiError(400, "VALIDATION_ERROR", error.message) : error);
    }
  });

  router.get("/recurring-payments", async (request, response, next) => {
    try {
      const query = parseOrThrow(recurringPaymentsQuerySchema.safeParse(request.query));
      const to = query.to ?? currentMonth();
      const from = query.from ?? shiftMonth(to, -11);
      response.json({ data: await service.recurringPayments(uidFrom(request), from, to) });
    } catch (error) {
      next(error instanceof IntelligenceDataTooLargeError ? new ApiError(400, "VALIDATION_ERROR", error.message) : error);
    }
  });

  return router;
}