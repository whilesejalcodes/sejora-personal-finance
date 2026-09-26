import { Router, type RequestHandler } from "express";
import {
  goalCreateSchema,
  goalIdSchema,
  goalListQuerySchema,
  goalUpdateSchema,
  monthSchema,
  upcomingCashFlowQuerySchema,
} from "../../../shared/schemas/index.js";
import { ApiError, validationError } from "../errors.js";
import { FirestoreGoalRepository } from "../goals/firestore-goal-repository.js";
import { GoalService } from "../goals/goal-service.js";
import type { GoalRepository } from "../goals/goal-repository.js";
import { FirestoreBudgetRepository } from "../budgets/firestore-budget-repository.js";
import type { BudgetRepository } from "../budgets/budget-repository.js";
import { Phase7Service } from "./phase7-service.js";
import { FirestoreTransactionRepository } from "../transactions/firestore-transaction-repository.js";
import type { TransactionRepository } from "../transactions/transaction-repository.js";

type Phase7RouterOptions = {
  authenticate: RequestHandler;
  transactionRepository?: TransactionRepository;
  budgetRepository?: BudgetRepository;
  goalRepository?: GoalRepository;
};

function uidFrom(request: import("express").Request): string {
  if (!request.auth?.uid) throw new ApiError(401, "AUTHENTICATION_REQUIRED", "Authentication is required.");
  return request.auth.uid;
}

function parseOrThrow<T>(result: { success: true; data: T } | { success: false; error: import("zod").ZodError }): T {
  if (!result.success) throw validationError(result.error);
  return result.data;
}

export function createPhase7Router(options: Phase7RouterOptions): Router {
  const router = Router();
  const transactionRepository = options.transactionRepository ?? new FirestoreTransactionRepository();
  const budgetRepository = options.budgetRepository ?? new FirestoreBudgetRepository();
  const goalRepository = options.goalRepository ?? new FirestoreGoalRepository();
  const goalService = new GoalService(goalRepository);
  const phase7Service = new Phase7Service(transactionRepository, budgetRepository, goalRepository);
  router.use(options.authenticate);

  router.get("/goals", async (request, response, next) => {
    try {
      response.json({ data: await goalService.list(uidFrom(request), parseOrThrow(goalListQuerySchema.safeParse(request.query))) });
    } catch (error) {
      next(error);
    }
  });

  router.post("/goals", async (request, response, next) => {
    try {
      response.status(201).json({ data: await goalService.create(uidFrom(request), parseOrThrow(goalCreateSchema.safeParse(request.body))) });
    } catch (error) {
      next(error);
    }
  });

  router.get("/goals/:id", async (request, response, next) => {
    try {
      response.json({ data: await goalService.get(uidFrom(request), parseOrThrow(goalIdSchema.safeParse(request.params.id))) });
    } catch (error) {
      next(error);
    }
  });

  router.patch("/goals/:id", async (request, response, next) => {
    try {
      const goalId = parseOrThrow(goalIdSchema.safeParse(request.params.id));
      response.json({ data: await goalService.update(uidFrom(request), goalId, parseOrThrow(goalUpdateSchema.safeParse(request.body))) });
    } catch (error) {
      next(error);
    }
  });

  router.delete("/goals/:id", async (request, response, next) => {
    try {
      await goalService.delete(uidFrom(request), parseOrThrow(goalIdSchema.safeParse(request.params.id)));
      response.status(204).send();
    } catch (error) {
      next(error);
    }
  });

  router.get("/financial-health", async (request, response, next) => {
    try {
      const query = parseOrThrow(monthSchema.optional().safeParse(request.query.month));
      const month = query ?? new Date().toISOString().slice(0, 7);
      response.json({ data: await phase7Service.financialHealth(uidFrom(request), month) });
    } catch (error) {
      next(error);
    }
  });

  router.get("/cash-flow/upcoming", async (request, response, next) => {
    try {
      const query = parseOrThrow(upcomingCashFlowQuerySchema.safeParse(request.query));
      const defaults = Phase7Service.defaultUpcomingRange();
      response.json({ data: await phase7Service.upcomingCashFlow(uidFrom(request), query.from ?? defaults.from, query.to ?? defaults.to) });
    } catch (error) {
      next(error);
    }
  });

  return router;
}