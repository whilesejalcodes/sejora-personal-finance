import { Router, type RequestHandler } from "express";
import { insightsQuerySchema } from "../../../shared/schemas/index.js";
import { ApiError, validationError } from "../errors.js";
import { IntelligenceDataTooLargeError } from "../intelligence/intelligence-service.js";
import type { TransactionRepository } from "../transactions/transaction-repository.js";
import { AiInsightsService, type AiInsightGenerator } from "./ai-insights-service.js";

type AiInsightsRouterOptions = {
  authenticate: RequestHandler;
  transactionRepository: TransactionRepository;
  generator?: AiInsightGenerator;
  rateLimit?: RequestHandler;
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

export function createAiInsightsRouter(options: AiInsightsRouterOptions): Router {
  const router = Router();
  const service = new AiInsightsService(options.transactionRepository, options.generator);
  router.use(options.authenticate);
  if (options.rateLimit) router.use(options.rateLimit);

  router.post("/insights/ai", async (request, response, next) => {
    try {
      const query = parseOrThrow(insightsQuerySchema.safeParse(request.query));
      response.json({ data: await service.generate(uidFrom(request), query.month ?? currentMonth()) });
    } catch (error) {
      next(error instanceof IntelligenceDataTooLargeError ? new ApiError(400, "VALIDATION_ERROR", error.message) : error);
    }
  });

  return router;
}