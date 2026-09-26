import { Router, type RequestHandler } from "express";
import { analyticsQuerySchema, dashboardQuerySchema } from "../../../shared/schemas/index.js";
import { shiftMonth } from "../../../shared/finance/calculations.js";
import { ApiError, validationError } from "../errors.js";
import { FirestoreBudgetRepository } from "../budgets/firestore-budget-repository.js";
import type { BudgetRepository } from "../budgets/budget-repository.js";
import { FirestoreTransactionRepository } from "../transactions/firestore-transaction-repository.js";
import type { TransactionRepository } from "../transactions/transaction-repository.js";
import { AnalyticsDataTooLargeError, AnalyticsService } from "./analytics-service.js";

type AnalyticsRouterOptions = {
  authenticate: RequestHandler;
  transactionRepository: TransactionRepository;
  budgetRepository: BudgetRepository;
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

export function createAnalyticsRouter(options: Partial<AnalyticsRouterOptions> & { authenticate: RequestHandler }): Router {
  const router = Router();
  const transactionRepository = options.transactionRepository ?? new FirestoreTransactionRepository();
  const budgetRepository = options.budgetRepository ?? new FirestoreBudgetRepository();
  const service = new AnalyticsService(transactionRepository, budgetRepository);
  router.use(options.authenticate);

  router.get("/dashboard", async (request, response, next) => {
    try {
      const query = parseOrThrow(dashboardQuerySchema.safeParse(request.query));
      response.json({ data: await service.dashboard(uidFrom(request), query.month ?? currentMonth()) });
    } catch (error) {
      next(error instanceof AnalyticsDataTooLargeError ? AnalyticsService.rangeError(error.message) : error);
    }
  });

  router.get("/analytics", async (request, response, next) => {
    try {
      const query = parseOrThrow(analyticsQuerySchema.safeParse(request.query));
      const to = query.to ?? currentMonth();
      const from = query.from ?? shiftMonth(to, -5);
      response.json({ data: await service.analytics(uidFrom(request), from, to) });
    } catch (error) {
      next(error instanceof AnalyticsDataTooLargeError ? AnalyticsService.rangeError(error.message) : error);
    }
  });

  return router;
}