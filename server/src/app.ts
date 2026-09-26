import express, { type Express } from "express";
import { getHealthPayload } from "./health.js";
import { createRequireAuth, requireAuth, type VerifyIdToken } from "./auth/middleware.js";
import { errorHandler } from "./errors.js";
import { createTransactionsRouter } from "./transactions/transactions-routes.js";
import type { TransactionRepository } from "./transactions/transaction-repository.js";
import { createBudgetsRouter } from "./budgets/budgets-routes.js";
import type { BudgetRepository } from "./budgets/budget-repository.js";
import { FirestoreBudgetRepository } from "./budgets/firestore-budget-repository.js";
import { FirestoreTransactionRepository } from "./transactions/firestore-transaction-repository.js";
import { createAnalyticsRouter } from "./analytics/analytics-routes.js";
import { createIntelligenceRouter } from "./intelligence/intelligence-routes.js";
import { createPhase7Router } from "./phase7/phase7-routes.js";
import type { GoalRepository } from "./goals/goal-repository.js";
import { FirestoreGoalRepository } from "./goals/firestore-goal-repository.js";
import { createReceiptsRouter } from "./receipts/receipts-routes.js";
import type { ReceiptExtractor } from "./receipts/receipt-service.js";
import { createForecastRouter } from "./forecast/forecast-routes.js";
import { createAiInsightsRouter } from "./ai-insights/ai-insights-routes.js";
import type { AiInsightGenerator } from "./ai-insights/ai-insights-service.js";
import { createAiFinanceRouter } from "./ai-finance/ai-finance-routes.js";
import type { FinanceIntentExtractor } from "./ai-finance/ai-finance-service.js";
import { createRequestGuard } from "./security/request-guard.js";

export function createApp(options: { verifyToken?: VerifyIdToken; transactionRepository?: TransactionRepository; budgetRepository?: BudgetRepository; goalRepository?: GoalRepository; receiptExtractor?: ReceiptExtractor; forecastClock?: () => string; aiInsightGenerator?: AiInsightGenerator; aiFinanceExtractor?: FinanceIntentExtractor; aiFinanceClock?: () => string } = {}): Express {
  const app = express();
  const authenticate = options.verifyToken ? createRequireAuth(options.verifyToken) : requireAuth;
  const transactionRepository = options.transactionRepository ?? new FirestoreTransactionRepository();
  const budgetRepository = options.budgetRepository ?? new FirestoreBudgetRepository();
  const goalRepository = options.goalRepository ?? new FirestoreGoalRepository();
  const receiptGuard = createRequestGuard({ windowMs: 60_000, maxRequests: 4, maxConcurrent: 2 });
  const aiInsightsGuard = createRequestGuard({ windowMs: 60_000, maxRequests: 6, maxConcurrent: 2 });
  const aiFinanceGuard = createRequestGuard({ windowMs: 60_000, maxRequests: 20, maxConcurrent: 2 });

  app.disable("x-powered-by");
  app.use((_request, response, next) => {
    response.setHeader("X-Content-Type-Options", "nosniff");
    response.setHeader("X-Frame-Options", "DENY");
    response.setHeader("Referrer-Policy", "no-referrer");
    response.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
    next();
  });
  app.use(express.json({ limit: "1mb" }));

  app.get("/api/health", (_req, res) => {
    res.json({ data: getHealthPayload() });
  });

  app.get("/api/auth/me", authenticate, (req, res) => {
    res.json({ data: req.auth });
  });

  app.use("/api/transactions", createTransactionsRouter({
    authenticate,
    repository: transactionRepository,
  }));

  app.use("/api/budgets", createBudgetsRouter({
    authenticate,
    repository: budgetRepository,
    transactionRepository,
  }));

  app.use("/api", createAnalyticsRouter({
    authenticate,
    transactionRepository,
    budgetRepository,
  }));

  app.use("/api", createIntelligenceRouter({
    authenticate,
    transactionRepository,
  }));

  app.use("/api", createPhase7Router({
    authenticate,
    transactionRepository,
    budgetRepository,
    goalRepository,
  }));

  app.use("/api", createReceiptsRouter({
    authenticate,
    extractor: options.receiptExtractor,
    rateLimit: receiptGuard,
  }));

  app.use("/api", createForecastRouter({
    authenticate,
    transactionRepository,
    clock: options.forecastClock,
  }));

  app.use("/api", createAiInsightsRouter({
    authenticate,
    transactionRepository,
    generator: options.aiInsightGenerator,
    rateLimit: aiInsightsGuard,
  }));

  app.use("/api", createAiFinanceRouter({
    authenticate,
    transactionRepository,
    budgetRepository,
    goalRepository,
    extractor: options.aiFinanceExtractor,
    clock: options.aiFinanceClock,
    forecastClock: options.forecastClock,
    rateLimit: aiFinanceGuard,
  }));

  app.use("/api", (_req, res) => {
    res.status(404).json({
      error: {
        code: "NOT_FOUND",
        message: "This API route is not available.",
      },
    });
  });

  app.use(errorHandler);
  return app;
}