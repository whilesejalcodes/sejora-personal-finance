import { Router, type RequestHandler } from "express";
import { financeQuestionInputSchema } from "../../../shared/schemas/index.js";
import { ApiError, validationError } from "../errors.js";
import type { BudgetRepository } from "../budgets/budget-repository.js";
import type { GoalRepository } from "../goals/goal-repository.js";
import {
  AiFinanceService,
  type FinanceIntentExtractor,
} from "./ai-finance-service.js";
import type { TransactionRepository } from "../transactions/transaction-repository.js";

type AiFinanceRouterOptions = {
  authenticate: RequestHandler;
  transactionRepository: TransactionRepository;
  budgetRepository: BudgetRepository;
  goalRepository: GoalRepository;
  extractor?: FinanceIntentExtractor;
  clock?: () => string;
  forecastClock?: () => string;
  rateLimit?: RequestHandler;
};

function uidFrom(request: import("express").Request): string {
  if (!request.auth?.uid) throw new ApiError(401, "AUTHENTICATION_REQUIRED", "Authentication is required.");
  return request.auth.uid;
}

export function createAiFinanceRouter(options: AiFinanceRouterOptions): Router {
  const router = Router();
  const service = new AiFinanceService(
    options.transactionRepository,
    options.budgetRepository,
    options.goalRepository,
    options.extractor,
    options.clock,
    options.forecastClock,
  );
  router.use(options.authenticate);
  if (options.rateLimit) router.use(options.rateLimit);

  router.post("/ai-finance/questions", async (request, response, next) => {
    try {
      const parsed = financeQuestionInputSchema.safeParse(request.body);
      if (!parsed.success) throw validationError(parsed.error);
      response.json({ data: await service.answer(uidFrom(request), parsed.data.question) });
    } catch (error) {
      next(error);
    }
  });

  return router;
}